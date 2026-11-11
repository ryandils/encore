import type { ApiErrorCode, ApiResult, DoorState, EventResult, RecentDoorAction } from '../../domain/contracts.ts';
import { parseEventCommand, parsePresetsCommand } from '../../domain/contracts.ts';
import { assertNonemptyString, assertNonnegativeInt, assertTimezone, assertUtcTimestamp, assertUuid } from '../../domain/validation.ts';
import type { DoorApi } from '../../components/door/controller.ts';

function malformed(): never { throw new Error('The server response could not be verified.'); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) malformed();
  return result;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') malformed(); return value; }
function doorState(value: unknown, nightId: string): DoorState {
  const state = record(value, ['night', 'occupancy', 'atOrAboveCapacity', 'presets', 'recentActions', 'syncedAt']);
  const night = record(state.night, ['id', 'venueId', 'label', 'status', 'openedAt', 'closedAt', 'startingOccupancy', 'currency', 'capacity', 'timezone', 'version']);
  if (night.id !== nightId || night.currency !== 'USD' || !['OPEN', 'CLOSED'].includes(String(night.status))) malformed();
  assertUuid(night.id, 'nightId'); assertUuid(night.venueId, 'venueId'); assertNonemptyString(night.label, 'night label');
  assertUtcTimestamp(night.openedAt, 'openedAt'); assertTimezone(night.timezone, 'timezone');
  if (night.status === 'CLOSED') assertUtcTimestamp(night.closedAt, 'closedAt');
  else if (night.closedAt !== null) malformed();
  assertNonnegativeInt(night.startingOccupancy, 'startingOccupancy'); assertNonnegativeInt(night.capacity, 'capacity'); assertNonnegativeInt(night.version, 'version');
  assertNonnegativeInt(state.occupancy, 'occupancy'); assertUtcTimestamp(state.syncedAt, 'syncedAt');
  const presets = parsePresetsCommand({ presets: state.presets }).presets;
  if (!Array.isArray(state.recentActions) || state.recentActions.length > 20) malformed();
  const recentActions = state.recentActions.map((value): RecentDoorAction => {
    const action = record(value, ['id', 'type', 'sequence', 'recordedAt', 'amountCents', 'reversed', 'canUndo']);
    assertUuid(action.id, 'eventId'); assertNonnegativeInt(action.sequence, 'sequence');
    if (action.sequence === 0 || !['ADMISSION', 'EXIT', 'REVERSAL'].includes(String(action.type))) malformed();
    assertUtcTimestamp(action.recordedAt, 'recordedAt'); assertNonnegativeInt(action.amountCents, 'amountCents');
    if (action.type !== 'ADMISSION' && action.amountCents !== 0) malformed();
    return { id: action.id, type: action.type as RecentDoorAction['type'], sequence: action.sequence, recordedAt: action.recordedAt,
      amountCents: action.amountCents, reversed: boolean(action.reversed), canUndo: boolean(action.canUndo) };
  });
  if (Math.max(0, ...recentActions.map((action) => action.sequence)) > night.version) malformed();
  if (new Set(recentActions.map((action) => action.id)).size !== recentActions.length || new Set(recentActions.map((action) => action.sequence)).size !== recentActions.length) malformed();
  return { night: { id: night.id, venueId: night.venueId, label: night.label, status: night.status as 'OPEN' | 'CLOSED', openedAt: night.openedAt,
    closedAt: night.closedAt as string | null, startingOccupancy: night.startingOccupancy, currency: 'USD', capacity: night.capacity, timezone: night.timezone, version: night.version },
    occupancy: state.occupancy, atOrAboveCapacity: boolean(state.atOrAboveCapacity), presets, recentActions, syncedAt: state.syncedAt };
}
const errorCodes: readonly ApiErrorCode[] = ['UNAUTHENTICATED', 'FORBIDDEN', 'VALIDATION', 'NOT_FOUND', 'REQUEST_CONFLICT', 'UNAVAILABLE', 'NIGHT_CLOSED', 'NIGHT_ALREADY_OPEN', 'STALE_PRESET', 'INVALID_HISTORY', 'OVERFLOW', 'INVITE_INVALID', 'RATE_LIMITED'];
function apiError(value: unknown): { code: ApiErrorCode; message: string } {
  const error = record(value, ['code', 'message']);
  if (!errorCodes.includes(error.code as ApiErrorCode) || typeof error.message !== 'string' || !error.message.trim() || error.message.length > 2000) malformed();
  return { code: error.code as ApiErrorCode, message: error.message };
}

/** Session cookies authenticate; this adapter never accepts actors, roles or an arbitrary API host. */
export function createHttpDoorAdapter(options: { fetch?: typeof fetch } = {}): DoorApi {
  const transport = options.fetch ?? fetch;
  async function request<T>(nightId: string, path: string, init: RequestInit, parse: (value: unknown) => T): Promise<ApiResult<T>> {
    assertUuid(nightId, 'nightId');
    const response = await transport(`/api/nights/${encodeURIComponent(nightId)}/${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
    const body = record(await response.json(), ['ok', 'data', 'error']);
    if (body.ok === false) {
      if ('data' in body || response.ok) malformed();
      const error = apiError(body.error);
      // A server/database failure can occur after commit; it is never proof that a tap was rejected.
      if (init.method === 'POST' && (response.status < 400 || response.status >= 500 || error.code === 'UNAVAILABLE')) malformed();
      return { ok: false, error };
    }
    if (body.ok !== true || !response.ok || 'error' in body) malformed();
    return { ok: true, data: parse(body.data) };
  }
  return {
    doorState: (nightId) => request(nightId, 'door-state', { method: 'GET', headers: { Accept: 'application/json' } }, (value) => doorState(value, nightId)),
    recordEvent: (nightId, value) => {
      const command = parseEventCommand(value);
      return request(nightId, 'events', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(command) }, (value): EventResult => {
        const result = record(value, ['eventId', 'requestId', 'state']);
        assertUuid(result.eventId, 'eventId');
        if (result.requestId !== command.requestId) malformed();
        const state = doorState(result.state, nightId);
        const action = state.recentActions.find((item) => item.id === result.eventId);
        const expectedType = command.type === 'FREE_ADMISSION' ? 'ADMISSION' : command.type;
        const expectedAmount = command.type === 'ADMISSION' ? command.expectedAmountCents : 0;
        if (!action || action.type !== expectedType || action.amountCents !== expectedAmount) malformed();
        return { eventId: result.eventId, requestId: command.requestId, state };
      });
    },
  };
}
