import type { DoorEvent, LedgerProjection, ReconciliationProjection } from './types.ts';
import { assertNonemptyString, assertNonnegativeInt, assertTimezone, assertUuid, DomainValidationError } from './validation.ts';

/** B1 contracts only. No endpoint or authorization is implemented by these types. */
export type PresetSlot = 1 | 2 | 3;
export type NightStatus = 'OPEN' | 'CLOSED';
export type MembershipRole = 'OWNER' | 'STAFF';
export interface CoverPreset { readonly slot: PresetSlot; readonly label: string; readonly amountCents: number }
export interface VenueView { readonly id: string; readonly name: string; readonly timezone: string; readonly capacity: number }
export interface NightView {
  readonly id: string; readonly venueId: string; readonly label: string; readonly status: NightStatus;
  readonly openedAt: string; readonly closedAt: string | null; readonly startingOccupancy: number;
  readonly currency: 'USD'; readonly capacity: number; readonly timezone: string; readonly version: number;
}
export type EventCommand =
  | { readonly type: 'ADMISSION'; readonly requestId: string; readonly presetSlot: PresetSlot; readonly expectedAmountCents: number }
  | { readonly type: 'FREE_ADMISSION'; readonly requestId: string }
  | { readonly type: 'EXIT'; readonly requestId: string }
  | { readonly type: 'REVERSAL'; readonly requestId: string; readonly targetEventId: string; readonly reason: string };
export interface CloseCommand { readonly requestId: string; readonly countedCashCents: number; readonly notes: string }
export interface CreateVenueCommand { readonly name: string; readonly timezone: string; readonly capacity: number; readonly presets: readonly CoverPreset[] }
export interface OpenNightCommand { readonly label: string; readonly startingOccupancy: number; readonly openingFloatCents: number; readonly currency: 'USD' }
export interface CreateInviteCommand { readonly intendedEmail: string }
export interface AcceptInviteCommand { readonly token: string }
export interface PresetsCommand { readonly presets: readonly CoverPreset[] }
/** Scoped event view: no actor identity, aggregate money, reconciliation, or owner notes. */
export interface RecentDoorAction {
  readonly id: string; readonly type: DoorEvent['type']; readonly sequence: number; readonly recordedAt: string;
  readonly amountCents: number; readonly reversed: boolean; readonly canUndo: boolean;
}
export interface DoorState {
  readonly night: NightView; readonly occupancy: number; readonly atOrAboveCapacity: boolean;
  readonly presets: readonly CoverPreset[]; readonly recentActions: readonly RecentDoorAction[]; readonly syncedAt: string;
}
export interface OwnerSummary {
  readonly night: NightView; readonly openingFloatCents: number; readonly projection: LedgerProjection;
  readonly reconciliation: (ReconciliationProjection & { readonly closedBy: string; readonly closedAt: string; readonly notes: string }) | null;
  readonly syncedAt: string;
}
export interface EventResult { readonly eventId: string; readonly requestId: string; readonly state: DoorState }
export interface CloseResult { readonly requestId: string; readonly summary: OwnerSummary }
export interface InviteResult { readonly id: string; readonly expiresAt: string; readonly inviteUrl: string }
export interface AssignmentView { readonly nightId: string; readonly userId: string; readonly startsAt: string; readonly endsAt: string; readonly revokedAt: string | null }
export type ApiErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION' | 'NOT_FOUND' | 'REQUEST_CONFLICT'
  | 'UNAVAILABLE' | 'NIGHT_CLOSED' | 'NIGHT_ALREADY_OPEN' | 'STALE_PRESET' | 'INVALID_HISTORY' | 'OVERFLOW' | 'INVITE_INVALID' | 'RATE_LIMITED';
export type ApiResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: { readonly code: ApiErrorCode; readonly message: string } };

/** All documented operations, including the owner-only operations B3 will consume. */
export interface LedgerApi {
  createVenue(input: CreateVenueCommand): Promise<ApiResult<VenueView>>;
  openNight(venueId: string, input: OpenNightCommand): Promise<ApiResult<OwnerSummary>>;
  updatePresets(venueId: string, input: PresetsCommand): Promise<ApiResult<readonly CoverPreset[]>>;
  createInvite(nightId: string, input: CreateInviteCommand): Promise<ApiResult<InviteResult>>;
  acceptInvite(input: AcceptInviteCommand): Promise<ApiResult<AssignmentView>>;
  revokeAssignment(nightId: string, userId: string): Promise<ApiResult<AssignmentView>>;
  recordEvent(nightId: string, input: EventCommand): Promise<ApiResult<EventResult>>;
  doorState(nightId: string): Promise<ApiResult<DoorState>>;
  summary(nightId: string): Promise<ApiResult<OwnerSummary>>;
  closeNight(nightId: string, input: CloseCommand): Promise<ApiResult<CloseResult>>;
  exportNight(nightId: string): Promise<ApiResult<{ readonly contentType: 'text/csv'; readonly filename: string; readonly csv: string }>>;
}

function invalid(message: string): never { throw new DomainValidationError(message, 'VALIDATION'); }
function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('Expected a command object.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !allowed.includes(key))) invalid('Command contains unsupported fields.');
  return result;
}
function text(value: unknown, field: string, max: number): string {
  assertNonemptyString(value, field);
  if (value.length > max || value.trim().length === 0) invalid(`${field} is empty or too long.`);
  return value;
}
function slot(value: unknown): PresetSlot {
  if (value !== 1 && value !== 2 && value !== 3) invalid('Preset slot must be 1, 2, or 3.');
  return value;
}
export function parseEventCommand(value: unknown): EventCommand {
  const base = object(value, ['type', 'requestId', 'presetSlot', 'expectedAmountCents', 'targetEventId', 'reason']);
  assertUuid(base.requestId, 'requestId');
  switch (base.type) {
    case 'ADMISSION': {
      object(value, ['type', 'requestId', 'presetSlot', 'expectedAmountCents']);
      assertNonnegativeInt(base.expectedAmountCents, 'expectedAmountCents');
      return { type: base.type, requestId: base.requestId, presetSlot: slot(base.presetSlot), expectedAmountCents: base.expectedAmountCents };
    }
    case 'FREE_ADMISSION': case 'EXIT':
      object(value, ['type', 'requestId']);
      return { type: base.type, requestId: base.requestId };
    case 'REVERSAL':
      object(value, ['type', 'requestId', 'targetEventId', 'reason']);
      assertUuid(base.targetEventId, 'targetEventId');
      return { type: base.type, requestId: base.requestId, targetEventId: base.targetEventId, reason: text(base.reason, 'reason', 500) };
    default: return invalid('Unsupported event command.');
  }
}
export function parseCloseCommand(value: unknown): CloseCommand {
  const data = object(value, ['requestId', 'countedCashCents', 'notes']);
  assertUuid(data.requestId, 'requestId');
  assertNonnegativeInt(data.countedCashCents, 'countedCashCents');
  if (typeof data.notes !== 'string' || data.notes.length > 2000) invalid('notes must be a string of at most 2000 characters.');
  return { requestId: data.requestId, countedCashCents: data.countedCashCents, notes: data.notes };
}
export function parsePresetsCommand(value: unknown): PresetsCommand {
  const data = object(value, ['presets']);
  if (!Array.isArray(data.presets) || data.presets.length !== 3) invalid('Exactly three presets are required.');
  const presets = data.presets.map((item: unknown): CoverPreset => {
    const preset = object(item, ['slot', 'label', 'amountCents']);
    assertNonnegativeInt(preset.amountCents, 'amountCents');
    return { slot: slot(preset.slot), label: text(preset.label, 'label', 80), amountCents: preset.amountCents };
  }).sort((a, b) => a.slot - b.slot);
  if (new Set(presets.map((preset) => preset.slot)).size !== 3) invalid('Preset slots must be distinct.');
  return { presets };
}
export function parseCreateVenueCommand(value: unknown): CreateVenueCommand {
  const data = object(value, ['name', 'timezone', 'capacity', 'presets']);
  assertTimezone(data.timezone, 'timezone');
  assertNonnegativeInt(data.capacity, 'capacity');
  return { name: text(data.name, 'name', 200), timezone: data.timezone, capacity: data.capacity, ...parsePresetsCommand({ presets: data.presets }) };
}
export function parseOpenNightCommand(value: unknown): OpenNightCommand {
  const data = object(value, ['label', 'startingOccupancy', 'openingFloatCents', 'currency']);
  assertNonnegativeInt(data.startingOccupancy, 'startingOccupancy');
  assertNonnegativeInt(data.openingFloatCents, 'openingFloatCents');
  if (data.currency !== 'USD') invalid('Only USD is supported.');
  return { label: text(data.label, 'label', 200), startingOccupancy: data.startingOccupancy, openingFloatCents: data.openingFloatCents, currency: 'USD' };
}
export function parseCreateInviteCommand(value: unknown): CreateInviteCommand {
  const data = object(value, ['intendedEmail']);
  const intendedEmail = text(data.intendedEmail, 'intendedEmail', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intendedEmail)) invalid('Invalid intended email.');
  return { intendedEmail };
}
export function parseAcceptInviteCommand(value: unknown): AcceptInviteCommand {
  const data = object(value, ['token']);
  return { token: text(data.token, 'token', 512) };
}

/** Canonical retry comparison input, NOT a token or authorization decision. Never log invite tokens. */
export function eventRequestPayload(nightId: string, command: EventCommand): string {
  assertUuid(nightId, 'nightId');
  return JSON.stringify({ nightId, command: parseEventCommand(command) });
}
export function closeRequestPayload(nightId: string, command: CloseCommand): string {
  assertUuid(nightId, 'nightId');
  return JSON.stringify({ nightId, command: parseCloseCommand(command) });
}
