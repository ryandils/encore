import { formatNightCsv } from '../../domain/csv-export.ts';
import type { AssignmentView, CloseCommand, CoverPreset, CreateInviteCommand, CreateVenueCommand, OpenNightCommand, OwnerSummary, PresetSlot, PresetsCommand, VenueView } from '../../domain/contracts.ts';
import { parseCloseCommand, parseCreateInviteCommand, parseCreateVenueCommand, parseOpenNightCommand, parsePresetsCommand } from '../../domain/contracts.ts';
import { createLedgerFixtures } from '../../domain/fixtures.ts';
import { projectLedger, reconcileLedger } from '../../domain/ledger.ts';
import type { DoorEvent, NightLedgerInput } from '../../domain/types.ts';
import { assertNonnegativeInt, assertUtcTimestamp } from '../../domain/validation.ts';

/** Browser-local rehearsal only. These functions grant no real venue or staff access. */
export interface OwnerFixtureNight {
  readonly input: NightLedgerInput;
  readonly summary: OwnerSummary;
  readonly events: readonly DoorEvent[];
  readonly closeRequest: CloseCommand | null;
}
export interface OwnerFixtureInvite {
  readonly id: string; readonly nightId: string; readonly intendedEmail: string;
  readonly expiresAt: string; readonly inviteUrl: string; readonly consumedAt: string | null;
  readonly revokedAt: string | null; readonly userId: string;
}
export interface OwnerFixtureState {
  readonly venue: VenueView | null;
  readonly presets: readonly CoverPreset[];
  readonly active: OwnerFixtureNight | null;
  readonly history: readonly OwnerFixtureNight[];
  readonly invites: readonly OwnerFixtureInvite[];
  readonly assignments: readonly AssignmentView[];
}
const instant = (value?: string): string => {
  const now = value ?? new Date().toISOString();
  assertUtcTimestamp(now, 'time');
  return now;
};
function openNight(state: OwnerFixtureState): OwnerFixtureNight {
  if (state.active?.summary.night.status !== 'OPEN') throw new Error('Open a fixture night first. Closed nights cannot accept new writes.');
  return state.active;
}
export function createOwnerFixture(): OwnerFixtureState {
  return { venue: null, presets: createLedgerFixtures().originalPresets, active: null, history: [], invites: [], assignments: [] };
}
export function dollarsToCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a nonnegative USD amount with at most two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  assertNonnegativeInt(cents, 'amount');
  return cents;
}
export function configureVenue(state: OwnerFixtureState, command: CreateVenueCommand): OwnerFixtureState {
  if (state.venue) throw new Error('This rehearsal already has a venue. Reset the demo to configure another.');
  const parsed = parseCreateVenueCommand(command);
  return { ...state, venue: { id: crypto.randomUUID(), name: parsed.name, timezone: parsed.timezone, capacity: parsed.capacity }, presets: parsed.presets };
}
export function openFixtureNight(state: OwnerFixtureState, command: OpenNightCommand, time?: string): OwnerFixtureState {
  if (!state.venue) throw new Error('Set up a fixture venue first.');
  if (state.active?.summary.night.status === 'OPEN') throw new Error('Close the current fixture night before opening another.');
  const parsed = parseOpenNightCommand(command);
  const now = instant(time);
  const nightId = crypto.randomUUID();
  const input: NightLedgerInput = { venueId: state.venue.id, nightId, timezone: state.venue.timezone, capacity: state.venue.capacity, startingOccupancy: parsed.startingOccupancy, openingFloatCents: parsed.openingFloatCents, currency: 'USD' };
  const summary: OwnerSummary = {
    night: { id: nightId, venueId: input.venueId, label: parsed.label, status: 'OPEN', openedAt: now, closedAt: null, startingOccupancy: input.startingOccupancy, currency: 'USD', capacity: input.capacity, timezone: input.timezone, version: 0 },
    openingFloatCents: input.openingFloatCents, projection: projectLedger(input, []), reconciliation: null, syncedAt: now,
  };
  return { ...state, active: { input, summary, events: [], closeRequest: null } };
}
export function updateFixturePresets(state: OwnerFixtureState, command: PresetsCommand): OwnerFixtureState {
  if (!state.venue) throw new Error('Set up a fixture venue first.');
  if (state.active?.summary.night.status === 'CLOSED') throw new Error('Closed nights are read-only. Open another fixture night to change presets.');
  return { ...state, presets: parsePresetsCommand(command).presets };
}
export function recordFixtureEvent(state: OwnerFixtureState, type: 'ADMISSION' | 'EXIT', slot?: PresetSlot, time?: string): OwnerFixtureState {
  const active = openNight(state);
  const now = instant(time);
  const preset = slot === undefined ? undefined : state.presets.find((item) => item.slot === slot);
  if (slot !== undefined && !preset) throw new Error('Unknown fixture preset.');
  const base = { id: crypto.randomUUID(), requestId: crypto.randomUUID(), nightId: active.input.nightId, venueId: active.input.venueId, actorId: 'synthetic-staff-fixture', sequence: active.events.length + 1, recordedAt: now };
  const event: DoorEvent = type === 'EXIT' ? { ...base, type, amountCents: 0 } : { ...base, type, amountCents: preset?.amountCents ?? 0 };
  const events = [...active.events, event];
  const summary: OwnerSummary = { ...active.summary, night: { ...active.summary.night, version: active.summary.night.version + 1 }, projection: projectLedger(active.input, events), syncedAt: now };
  return { ...state, active: { ...active, summary, events } };
}
export function createFixtureInvite(state: OwnerFixtureState, command: CreateInviteCommand, time?: string): OwnerFixtureState {
  const active = openNight(state);
  const parsed = parseCreateInviteCommand(command);
  if (!/^[^@]+@[^@]+\.invalid$/i.test(parsed.intendedEmail)) throw new Error('Use a synthetic email ending in .invalid. No real invitation is sent.');
  const now = instant(time);
  const id = crypto.randomUUID();
  const invite: OwnerFixtureInvite = { id, nightId: active.input.nightId, intendedEmail: parsed.intendedEmail, expiresAt: new Date(Date.parse(now) + 4 * 60 * 60 * 1000).toISOString(), inviteUrl: `https://encore-fixture.invalid/invite/synthetic-${id}`, consumedAt: null, revokedAt: null, userId: `synthetic-staff-${id}` };
  return { ...state, invites: [...state.invites, invite] };
}
export function acceptFixtureInvite(state: OwnerFixtureState, inviteId: string, time?: string): OwnerFixtureState {
  const active = openNight(state);
  const now = instant(time);
  const invite = state.invites.find((item) => item.id === inviteId && item.nightId === active.input.nightId);
  if (!invite || invite.consumedAt || invite.revokedAt || Date.parse(now) >= Date.parse(invite.expiresAt)) throw new Error('This synthetic invite is unavailable, expired, revoked, or already used.');
  const assignment: AssignmentView = { nightId: invite.nightId, userId: invite.userId, startsAt: now, endsAt: invite.expiresAt, revokedAt: null };
  return { ...state, invites: state.invites.map((item) => item.id === inviteId ? { ...item, consumedAt: now } : item), assignments: [...state.assignments, assignment] };
}
export function revokeFixtureAssignment(state: OwnerFixtureState, userId: string, time?: string): OwnerFixtureState {
  const active = openNight(state);
  const now = instant(time);
  if (!state.invites.some((item) => item.userId === userId && item.nightId === active.input.nightId)) throw new Error('Synthetic staff access was not found for this night.');
  return { ...state,
    invites: state.invites.map((item) => item.userId === userId && item.nightId === active.input.nightId ? { ...item, revokedAt: item.revokedAt ?? now } : item),
    assignments: state.assignments.map((item) => item.userId === userId && item.nightId === active.input.nightId ? { ...item, revokedAt: item.revokedAt ?? now } : item),
  };
}
export function closeFixtureNight(state: OwnerFixtureState, command: CloseCommand, time?: string): OwnerFixtureState {
  const parsed = parseCloseCommand(command);
  if (state.active?.closeRequest) {
    if (JSON.stringify(parsed) === JSON.stringify(state.active.closeRequest)) return state;
    throw new Error('The fixture night is already closed; its reconciliation cannot be overwritten.');
  }
  const active = openNight(state);
  const now = instant(time);
  const summary: OwnerSummary = { ...active.summary,
    night: { ...active.summary.night, status: 'CLOSED', closedAt: now, version: active.summary.night.version + 1 },
    reconciliation: { ...reconcileLedger(active.input, active.events, parsed.countedCashCents), closedBy: 'synthetic-owner-fixture', closedAt: now, notes: parsed.notes }, syncedAt: now,
  };
  const closed: OwnerFixtureNight = { ...active, summary, closeRequest: parsed };
  return { ...state, active: closed, history: [...state.history, closed] };
}
export function exportFixtureNight(night: OwnerFixtureNight): { contentType: 'text/csv'; filename: string; csv: string } {
  return { contentType: 'text/csv', filename: `synthetic-encore-${night.input.nightId}.csv`, csv: formatNightCsv(night.summary, night.events, { synthetic: true }) };
}
