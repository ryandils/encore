import type { ApiErrorCode, ApiResult } from '../domain/contracts.ts';
import { parseAcceptInviteCommand, parseCloseCommand, parseCreateInviteCommand, parseCreateVenueCommand, parseEventCommand, parseOpenNightCommand, parsePresetsCommand } from '../domain/contracts.ts';
import { assertNonemptyString, assertUuid, DomainValidationError } from '../domain/validation.ts';
import { LedgerAccessError } from './ledger-service.ts';
import type { PostgresLedgerService } from './ledger-service.ts';
import type { VenueAccessService } from './venue-access-service.ts';

export type LedgerHttpOperation = 'events' | 'door-state' | 'summary' | 'close'
  | 'create-venue' | 'open-night' | 'presets' | 'create-invite' | 'accept-invite' | 'revoke-assignment' | 'revoke-invite';
export type VenueAccessHttpService = Pick<VenueAccessService, 'createVenue' | 'openNight' | 'updatePresets' | 'createInvite' | 'acceptInvite' | 'revokeAssignment' | 'revokeInvite'>;
const METHODS: Record<LedgerHttpOperation, string> = {
  events: 'POST', 'door-state': 'GET', summary: 'GET', close: 'POST',
  'create-venue': 'POST', 'open-night': 'POST', presets: 'PATCH', 'create-invite': 'POST', 'accept-invite': 'POST', 'revoke-assignment': 'DELETE', 'revoke-invite': 'DELETE',
};
export interface LedgerHttpDependencies {
  available(): boolean;
  origin(): string;
  session(headers: Headers): Promise<{ user: { id: string } } | null>;
  service(): Pick<PostgresLedgerService, 'record' | 'close' | 'doorState' | 'summary'>;
  access?(): VenueAccessHttpService;
  now?: () => number;
}
const MAX_BODY_BYTES = 16_384;
const REQUESTS_PER_MINUTE = 600;
const MAX_ACTIVE_USERS = 1000;
const errorStatuses: Partial<Record<ApiErrorCode, number>> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, REQUEST_CONFLICT: 409,
  NIGHT_CLOSED: 409, NIGHT_ALREADY_OPEN: 409, STALE_PRESET: 409, INVALID_HISTORY: 409,
  INVITE_INVALID: 400, RATE_LIMITED: 429, UNAVAILABLE: 503,
};
function json<T>(body: ApiResult<T>, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function problem(code: ApiErrorCode, message: string, status = errorStatuses[code] ?? 400): Response {
  return json({ ok: false, error: { code, message } }, status);
}
class BodyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
async function commandBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BodyError(415, 'Send an application/json command.');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    void request.body?.cancel().catch(() => {});
    throw new BodyError(413, 'Command body is too large or has an invalid length.');
  }
  if (!request.body) throw new BodyError(400, 'A JSON command is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        throw new BodyError(413, 'Command body is too large.');
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch (error) {
    if (error instanceof BodyError) throw error;
    throw new BodyError(400, 'Command body must contain valid JSON.');
  } finally { reader.releaseLock(); }
}

/** Local process safeguard, not a shared production rate limiter. Capacity fails closed. */
export function createLedgerHttpHandler(dependencies: LedgerHttpDependencies) {
  const buckets = new Map<string, { startedAt: number; count: number }>();
  const clock = dependencies.now ?? Date.now;
  function allowed(userId: string): boolean {
    const now = clock();
    for (const [key, bucket] of buckets) if (now - bucket.startedAt >= 60_000 || now < bucket.startedAt) buckets.delete(key);
    const existing = buckets.get(userId);
    if (existing) { if (existing.count >= REQUESTS_PER_MINUTE) return false; existing.count++; return true; }
    if (buckets.size >= MAX_ACTIVE_USERS) return false;
    buckets.set(userId, { startedAt: now, count: 1 }); return true;
  }
  return async function handle(operation: LedgerHttpOperation, request: Request, scopeId = '', targetId?: string): Promise<Response> {
    // Production must reject before reading auth settings, sessions or opening a database pool.
    if (!dependencies.available()) return problem('NOT_FOUND', 'Not found.');
    try {
      const method = METHODS[operation];
      const write = method !== 'GET';
      if (request.method !== method) {
        const response = problem('VALIDATION', 'Method not allowed.', 405);
        response.headers.set('Allow', method);
        return response;
      }
      const origin = write ? dependencies.origin() : '';
      if (write && (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site')) return problem('FORBIDDEN', 'A same-origin request is required.');
      const session = await dependencies.session(request.headers);
      if (!session) return problem('UNAUTHENTICATED', 'Sign in to the local application.');
      if (!allowed(session.user.id)) return problem('RATE_LIMITED', 'Too many requests. Wait a minute and retry.');
      if (operation !== 'create-venue' && operation !== 'accept-invite') assertUuid(scopeId, 'scopeId');
      const context = { authenticatedUserId: session.user.id, nightId: scopeId };
      switch (operation) {
        case 'events': {
          const command = parseEventCommand(await commandBody(request));
          return json({ ok: true, data: await dependencies.service().record(context, command) });
        }
        case 'close': {
          const command = parseCloseCommand(await commandBody(request));
          return json({ ok: true, data: await dependencies.service().close(context, command) });
        }
        case 'door-state': return json({ ok: true, data: await dependencies.service().doorState(context) });
        case 'summary': return json({ ok: true, data: await dependencies.service().summary(context) });
      }
      const access = dependencies.access?.();
      if (!access) throw new Error('Venue access service is unavailable.');
      const actor = session.user.id;
      switch (operation) {
        case 'create-venue': return json({ ok: true, data: await access.createVenue(actor, parseCreateVenueCommand(await commandBody(request))) });
        case 'open-night': return json({ ok: true, data: await access.openNight(actor, scopeId, parseOpenNightCommand(await commandBody(request))) });
        case 'presets': return json({ ok: true, data: await access.updatePresets(actor, scopeId, parsePresetsCommand(await commandBody(request))) });
        case 'create-invite': return json({ ok: true, data: await access.createInvite(actor, scopeId, parseCreateInviteCommand(await commandBody(request)), origin) });
        case 'accept-invite': return json({ ok: true, data: await access.acceptInvite(actor, parseAcceptInviteCommand(await commandBody(request))) });
        case 'revoke-assignment':
          assertNonemptyString(targetId, 'targetUserId');
          return json({ ok: true, data: await access.revokeAssignment(actor, scopeId, targetId) });
        case 'revoke-invite':
          assertUuid(targetId, 'inviteId');
          return json({ ok: true, data: await access.revokeInvite(actor, scopeId, targetId) });
      }
    } catch (error) {
      if (error instanceof BodyError) return problem('VALIDATION', error.message, error.status);
      if (error instanceof DomainValidationError || error instanceof LedgerAccessError) return problem(error.code, error.message);
      return problem('UNAVAILABLE', 'The local ledger is unavailable. Check local setup and retry.');
    }
  };
}
