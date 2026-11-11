import type { ApiErrorCode, ApiResult, AssignmentView, CloseResult, CoverPreset, InviteAccessView, InviteResult, LedgerApi, NightCsvExport, NightView, OwnerNightAccess, OwnerSummary, OwnerVenueConfiguration, VenueView } from '../../domain/contracts.ts';
import { parseAcceptInviteCommand, parseCloseCommand, parseCreateInviteCommand, parseCreateVenueCommand, parseOpenNightCommand, parsePresetsCommand } from '../../domain/contracts.ts';
import type { LedgerProjection } from '../../domain/types.ts';
import { assertNonemptyString, assertNonnegativeInt, assertTimezone, assertUtcTimestamp, assertUuid, INT32_MAX } from '../../domain/validation.ts';

export type OwnerApi = Omit<LedgerApi, 'recordEvent' | 'doorState'>;
function malformed(): never { throw new Error('The server response could not be verified. Its outcome may be unknown.'); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !keys.includes(key))) malformed();
  return row;
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) malformed(); return value; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') malformed(); return value; }
function text(value: unknown, field: string, max = 2000): string {
  assertNonemptyString(value, field); if (value.length > max) malformed(); return value;
}
function timestampOrNull(value: unknown): string | null { if (value === null) return null; assertUtcTimestamp(value, 'timestamp'); return value; }
function unique(values: readonly string[]): void { if (new Set(values).size !== values.length) malformed(); }
function sum(values: readonly number[]): number { const total = values.reduce((a, b) => a + b, 0); assertNonnegativeInt(total, 'total'); return total; }
function venue(value: unknown, id?: string): VenueView {
  const row = object(value, ['id', 'name', 'timezone', 'capacity']);
  assertUuid(row.id, 'venueId'); if (id && row.id !== id) malformed();
  assertTimezone(row.timezone, 'timezone'); assertNonnegativeInt(row.capacity, 'capacity');
  return { id: row.id, name: text(row.name, 'venue name', 200), timezone: row.timezone, capacity: row.capacity };
}
function night(value: unknown, id?: string, venueId?: string): NightView {
  const row = object(value, ['id', 'venueId', 'label', 'status', 'openedAt', 'closedAt', 'startingOccupancy', 'currency', 'capacity', 'timezone', 'version']);
  assertUuid(row.id, 'nightId'); assertUuid(row.venueId, 'venueId');
  if ((id && row.id !== id) || (venueId && row.venueId !== venueId) || row.currency !== 'USD' || !['OPEN', 'CLOSED'].includes(String(row.status))) malformed();
  assertUtcTimestamp(row.openedAt, 'openedAt'); assertTimezone(row.timezone, 'timezone');
  const closedAt = timestampOrNull(row.closedAt);
  if ((row.status === 'CLOSED') !== (closedAt !== null)) malformed();
  assertNonnegativeInt(row.startingOccupancy, 'startingOccupancy'); assertNonnegativeInt(row.capacity, 'capacity'); assertNonnegativeInt(row.version, 'version');
  return { id: row.id, venueId: row.venueId, label: text(row.label, 'night label', 200), status: row.status as 'OPEN' | 'CLOSED', openedAt: row.openedAt,
    closedAt, startingOccupancy: row.startingOccupancy, currency: 'USD', capacity: row.capacity, timezone: row.timezone, version: row.version };
}
function projection(value: unknown, scope: NightView, float: number): LedgerProjection {
  const keys = ['entries', 'paidAdmissions', 'freeAdmissions', 'exits', 'occupancy', 'peakOccupancy', 'expectedCoverCents', 'expectedDrawerCents', 'capacityEquivalentTurns', 'atOrAboveCapacity', 'admissionsByPrice', 'arrivalBuckets', 'effectiveEventIds', 'reversedEventIds', 'lastSequence'] as const;
  const row = object(value, keys);
  for (const key of ['entries', 'paidAdmissions', 'freeAdmissions', 'exits', 'occupancy', 'peakOccupancy', 'expectedCoverCents', 'expectedDrawerCents', 'lastSequence'] as const) assertNonnegativeInt(row[key], key);
  const p = row as unknown as LedgerProjection;
  if (p.entries !== p.paidAdmissions + p.freeAdmissions || p.occupancy !== scope.startingOccupancy + p.entries - p.exits
    || p.peakOccupancy < Math.max(scope.startingOccupancy, p.occupancy) || p.peakOccupancy > scope.startingOccupancy + p.entries || p.expectedDrawerCents !== float + p.expectedCoverCents || p.lastSequence > scope.version) malformed();
  if (p.capacityEquivalentTurns !== (scope.capacity > 0 ? p.entries / scope.capacity : null)) malformed();
  if (bool(row.atOrAboveCapacity) !== (scope.capacity > 0 && p.occupancy >= scope.capacity)) malformed();
  const admissionsByPrice = array(row.admissionsByPrice).map((value) => {
    const price = object(value, ['amountCents', 'count', 'totalCents']);
    assertNonnegativeInt(price.amountCents, 'amountCents'); assertNonnegativeInt(price.count, 'count'); assertNonnegativeInt(price.totalCents, 'totalCents');
    if (price.count === 0 || price.amountCents * price.count !== price.totalCents) malformed();
    return { amountCents: price.amountCents, count: price.count, totalCents: price.totalCents };
  });
  unique(admissionsByPrice.map((price) => String(price.amountCents)));
  if (sum(admissionsByPrice.map((price) => price.totalCents)) !== p.expectedCoverCents || sum(admissionsByPrice.map((price) => price.count)) !== p.entries
    || sum(admissionsByPrice.filter((price) => price.amountCents === 0).map((price) => price.count)) !== p.freeAdmissions) malformed();
  const arrivalBuckets = array(row.arrivalBuckets).map((value) => {
    const bucket = object(value, ['startUtc', 'label', 'offset', 'entries']);
    assertUtcTimestamp(bucket.startUtc, 'bucket start'); assertNonnegativeInt(bucket.entries, 'bucket entries');
    if (bucket.entries === 0 || typeof bucket.offset !== 'string' || !/^[+-]\d{2}:\d{2}$/.test(bucket.offset)) malformed();
    return { startUtc: bucket.startUtc, label: text(bucket.label, 'bucket label', 100), offset: bucket.offset, entries: bucket.entries };
  });
  unique(arrivalBuckets.map((bucket) => bucket.startUtc));
  if (sum(arrivalBuckets.map((bucket) => bucket.entries)) !== p.entries) malformed();
  const ids = (value: unknown) => array(value).map((id) => { assertUuid(id, 'eventId'); return id; });
  const effectiveEventIds = ids(row.effectiveEventIds), reversedEventIds = ids(row.reversedEventIds);
  unique([...effectiveEventIds, ...reversedEventIds]);
  if (effectiveEventIds.length !== p.entries + p.exits || p.lastSequence < effectiveEventIds.length + 2 * reversedEventIds.length) malformed();
  return { ...p, atOrAboveCapacity: row.atOrAboveCapacity as boolean, admissionsByPrice, arrivalBuckets, effectiveEventIds, reversedEventIds };
}
function summary(value: unknown, nightId?: string, venueId?: string): OwnerSummary {
  const row = object(value, ['night', 'openingFloatCents', 'projection', 'reconciliation', 'syncedAt']);
  const scope = night(row.night, nightId, venueId);
  assertNonnegativeInt(row.openingFloatCents, 'openingFloatCents'); assertUtcTimestamp(row.syncedAt, 'syncedAt');
  const p = projection(row.projection, scope, row.openingFloatCents);
  let reconciliation: OwnerSummary['reconciliation'] = null;
  if (row.reconciliation !== null) {
    const r = object(row.reconciliation, ['countedCashCents', 'expectedCoverCents', 'floatCents', 'expectedDrawerCents', 'varianceCents', 'closedBy', 'closedAt', 'notes']);
    for (const key of ['countedCashCents', 'expectedCoverCents', 'floatCents', 'expectedDrawerCents'] as const) assertNonnegativeInt(r[key], key);
    const countedCashCents = r.countedCashCents as number, expectedCoverCents = r.expectedCoverCents as number, floatCents = r.floatCents as number, expectedDrawerCents = r.expectedDrawerCents as number;
    if (typeof r.varianceCents !== 'number' || !Number.isInteger(r.varianceCents) || Math.abs(r.varianceCents) > INT32_MAX
      || r.varianceCents !== countedCashCents - expectedDrawerCents || expectedCoverCents !== p.expectedCoverCents || expectedDrawerCents !== p.expectedDrawerCents || floatCents !== row.openingFloatCents) malformed();
    assertUtcTimestamp(r.closedAt, 'closedAt');
    if (scope.status !== 'CLOSED' || r.closedAt !== scope.closedAt || typeof r.notes !== 'string' || r.notes.length > 2000) malformed();
    reconciliation = { countedCashCents, expectedCoverCents, floatCents, expectedDrawerCents,
      varianceCents: r.varianceCents, closedBy: text(r.closedBy, 'closedBy'), closedAt: r.closedAt, notes: r.notes };
  } else if (scope.status === 'CLOSED') malformed();
  return { night: scope, openingFloatCents: row.openingFloatCents, projection: p, reconciliation, syncedAt: row.syncedAt };
}
function assignment(value: unknown, nightId?: string, userId?: string): AssignmentView {
  const row = object(value, ['nightId', 'userId', 'startsAt', 'endsAt', 'revokedAt']);
  assertUuid(row.nightId, 'nightId'); assertUtcTimestamp(row.startsAt, 'startsAt'); assertUtcTimestamp(row.endsAt, 'endsAt');
  const id = text(row.userId, 'userId');
  if ((nightId && row.nightId !== nightId) || (userId && id !== userId) || Date.parse(row.endsAt) <= Date.parse(row.startsAt)) malformed();
  return { nightId: row.nightId, userId: id, startsAt: row.startsAt, endsAt: row.endsAt, revokedAt: timestampOrNull(row.revokedAt) };
}
function access(value: unknown, nightId: string): OwnerNightAccess {
  const row = object(value, ['invites', 'assignments']);
  const invites = array(row.invites).map((value): InviteAccessView => {
    const invite = object(value, ['id', 'intendedEmail', 'expiresAt', 'consumedAt', 'revokedAt']);
    assertUuid(invite.id, 'inviteId'); assertUtcTimestamp(invite.expiresAt, 'expiresAt');
    return { id: invite.id, intendedEmail: parseCreateInviteCommand({ intendedEmail: invite.intendedEmail }).intendedEmail, expiresAt: invite.expiresAt,
      consumedAt: timestampOrNull(invite.consumedAt), revokedAt: timestampOrNull(invite.revokedAt) };
  });
  const assignments = array(row.assignments).map((value) => {
    const item = object(value, ['nightId', 'userId', 'startsAt', 'endsAt', 'revokedAt', 'email']);
    const { email, ...rest } = item;
    return { ...assignment(rest, nightId), email: parseCreateInviteCommand({ intendedEmail: email }).intendedEmail };
  });
  unique(invites.map((invite) => invite.id)); unique(assignments.map((item) => item.userId));
  return { invites, assignments };
}
const errorCodes: readonly ApiErrorCode[] = ['UNAUTHENTICATED', 'FORBIDDEN', 'VALIDATION', 'NOT_FOUND', 'REQUEST_CONFLICT', 'UNAVAILABLE', 'NIGHT_CLOSED', 'NIGHT_ALREADY_OPEN', 'STALE_PRESET', 'INVALID_HISTORY', 'OVERFLOW', 'INVITE_INVALID', 'RATE_LIMITED'];
function apiError(value: unknown): { code: ApiErrorCode; message: string } {
  const row = object(value, ['code', 'message']);
  if (!errorCodes.includes(row.code as ApiErrorCode)) malformed();
  return { code: row.code as ApiErrorCode, message: text(row.message, 'error message') };
}
const csvHeader = ['synthetic', 'recordType', 'nightId', 'nightLabel', 'id', 'sequence', 'type', 'amountCents', 'actorId', 'recordedAt', 'countedCashCents', 'expectedCoverCents', 'floatCents', 'expectedDrawerCents', 'varianceCents', 'notes', 'venueId', 'requestId', 'targetEventId', 'reason', 'startingOccupancy', 'openingFloatCents', 'timezone', 'capacity', 'currency'];
function csvRows(csv: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let endedQuote = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) { if (char === '"') { if (csv[i + 1] === '"') { field += '"'; i++; } else { quoted = false; endedQuote = true; } } else field += char; continue; }
    if (char === '"' && field === '' && !endedQuote) { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ''; endedQuote = false; continue; }
    if (char === '\r' && csv[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; endedQuote = false; i++; continue; }
    if (endedQuote || char === '"' || char === '\r' || char === '\n') malformed();
    field += char;
  }
  if (quoted || row.length || field || endedQuote) malformed();
  return rows;
}
function csvExport(csv: string, nightId: string): NightCsvExport {
  const rows = csvRows(csv);
  if (JSON.stringify(rows[0]) !== JSON.stringify(csvHeader) || rows.length < 2 || rows.some((row) => row.length !== 25)) malformed();
  if (rows[1][1] !== 'night' || rows.filter((row) => row[1] === 'night').length !== 1) malformed();
  for (const row of rows.slice(1)) if (row[0] !== 'true' || row[2] !== nightId || !['night', 'event', 'reconciliation'].includes(row[1])) malformed();
  return { contentType: 'text/csv', filename: `synthetic-encore-${nightId}.csv`, csv };
}

/** Same-origin session API. Writes never retry automatically; an unverifiable acknowledgement is unknown. */
export function createHttpOwnerApi(options: { fetch?: typeof fetch; origin?: string; expectedUserId?: string } = {}): OwnerApi {
  const transport = options.fetch ?? fetch;
  function requestHeaders(value?: HeadersInit): Headers {
    const headers = new Headers(value);
    if (options.expectedUserId !== undefined) {
      assertNonemptyString(options.expectedUserId, 'expectedUserId');
      headers.set('X-Encore-Expected-User', encodeURIComponent(options.expectedUserId));
    }
    return headers;
  }
  async function request<T>(path: string, init: RequestInit, parse: (value: unknown) => T): Promise<ApiResult<T>> {
    const response = await transport(path, { ...init, headers: requestHeaders(init.headers), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (response.redirected || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') malformed();
    const body = object(await response.json(), ['ok', 'data', 'error']);
    if (body.ok === false) {
      if ('data' in body || response.ok) malformed();
      const error = apiError(body.error);
      if (init.method !== 'GET' && (response.status < 400 || response.status >= 500 || error.code === 'UNAVAILABLE')) malformed();
      return { ok: false, error };
    }
    if (body.ok !== true || !response.ok || 'error' in body) malformed();
    return { ok: true, data: parse(body.data) };
  }
  const get = <T>(path: string, parse: (value: unknown) => T) => request(path, { method: 'GET', headers: { Accept: 'application/json' } }, parse);
  const write = <T>(path: string, method: string, body: unknown, parse: (value: unknown) => T) => request(path, {
    method, headers: { Accept: 'application/json', ...(method === 'DELETE' ? {} : { 'Content-Type': 'application/json' }) }, ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
  }, parse);
  const venuePath = (id: string) => { assertUuid(id, 'venueId'); return `/api/venues/${id}`; };
  const nightPath = (id: string) => { assertUuid(id, 'nightId'); return `/api/nights/${id}`; };
  return {
    listVenues: () => get('/api/venues', (value) => { const rows = array(value).map((item) => venue(item)); unique(rows.map((item) => item.id)); return rows; }),
    venueConfiguration: (id) => get(venuePath(id), (value): OwnerVenueConfiguration => {
      const row = object(value, ['venue', 'presets']); return { venue: venue(row.venue, id), presets: parsePresetsCommand({ presets: row.presets }).presets };
    }),
    listNights: (id) => get(`${venuePath(id)}/nights`, (value) => { const rows = array(value).map((item) => night(item, undefined, id)); unique(rows.map((item) => item.id)); return rows; }),
    nightAccess: (id) => get(`${nightPath(id)}/access`, (value) => access(value, id)),
    summary: (id) => get(`${nightPath(id)}/summary`, (value) => summary(value, id)),
    createVenue: (value) => {
      const command = parseCreateVenueCommand(value);
      return write('/api/venues', 'POST', command, (value) => {
        const result = venue(value);
        if (result.name !== command.name || result.timezone !== command.timezone || result.capacity !== command.capacity) malformed();
        return result;
      });
    },
    openNight: (id, value) => {
      const command = parseOpenNightCommand(value);
      return write(`${venuePath(id)}/nights`, 'POST', command, (value) => {
        const result = summary(value, undefined, id);
        if (result.night.status !== 'OPEN' || result.night.label !== command.label || result.night.startingOccupancy !== command.startingOccupancy || result.openingFloatCents !== command.openingFloatCents) malformed();
        return result;
      });
    },
    updatePresets: (id, value) => {
      const command = parsePresetsCommand(value);
      return write(`${venuePath(id)}/presets`, 'PATCH', command, (value): readonly CoverPreset[] => {
        const presets = parsePresetsCommand({ presets: value }).presets;
        if (JSON.stringify(presets) !== JSON.stringify(command.presets)) malformed(); return presets;
      });
    },
    createInvite: (id, value) => write(`${nightPath(id)}/invites`, 'POST', parseCreateInviteCommand(value), (value): InviteResult => {
      const row = object(value, ['id', 'expiresAt', 'inviteUrl']); assertUuid(row.id, 'inviteId'); assertUtcTimestamp(row.expiresAt, 'expiresAt');
      if (typeof row.inviteUrl !== 'string') malformed();
      const url = new URL(row.inviteUrl); const origin = options.origin ?? globalThis.location?.origin;
      if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (origin && url.origin !== origin)
        || url.pathname !== '/invites/accept' || url.search || url.username || url.password || !/^#token=[A-Za-z0-9_-]{43}$/.test(url.hash)) malformed();
      return { id: row.id, expiresAt: row.expiresAt, inviteUrl: url.toString() };
    }),
    acceptInvite: (value) => write('/api/invites/accept', 'POST', parseAcceptInviteCommand(value), (value) => {
      const result = assignment(value); if (result.revokedAt !== null) malformed(); return result;
    }),
    revokeInvite: (id, inviteId) => {
      assertUuid(inviteId, 'inviteId');
      return write(`${nightPath(id)}/invites/${inviteId}`, 'DELETE', undefined, (value) => {
        const row = object(value, ['id', 'revokedAt']); if (row.id !== inviteId) malformed(); assertUtcTimestamp(row.revokedAt, 'revokedAt'); return { id: inviteId, revokedAt: row.revokedAt };
      });
    },
    revokeAssignment: (id, userId) => {
      assertNonemptyString(userId, 'userId');
      return write(`${nightPath(id)}/assignments/${encodeURIComponent(userId)}`, 'DELETE', undefined, (value) => {
        const result = assignment(value, id, userId); if (result.revokedAt === null) malformed(); return result;
      });
    },
    closeNight: (id, value) => {
      const command = parseCloseCommand(value);
      return write(`${nightPath(id)}/close`, 'POST', command, (value): CloseResult => {
        const row = object(value, ['requestId', 'summary']); if (row.requestId !== command.requestId) malformed();
        const result = summary(row.summary, id);
        if (result.night.status !== 'CLOSED' || result.reconciliation?.countedCashCents !== command.countedCashCents || result.reconciliation.notes !== command.notes) malformed();
        return { requestId: command.requestId, summary: result };
      });
    },
    exportNight: async (id) => {
      const response = await transport(`${nightPath(id)}/export`, { method: 'GET', headers: requestHeaders({ Accept: 'text/csv' }), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
      if (response.redirected) malformed();
      if (!response.ok) {
        if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') malformed();
        const body = object(await response.json(), ['ok', 'error']); if (body.ok !== false) malformed(); return { ok: false, error: apiError(body.error) };
      }
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/csv'
        || response.headers.get('content-disposition') !== `attachment; filename="synthetic-encore-${id}.csv"`
        || !response.headers.get('cache-control')?.includes('no-store')) malformed();
      return { ok: true, data: csvExport(await response.text(), id) };
    },
  };
}
