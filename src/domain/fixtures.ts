import type { AssignmentView, CloseCommand, CloseResult, CoverPreset, CreateInviteCommand, CreateVenueCommand, DoorState, EventCommand, EventResult, InviteResult, NightView, OpenNightCommand, OwnerSummary, VenueView } from './contracts.ts';
import type { DoorEvent, NightLedgerInput } from './types.ts';
import { projectLedger, reconcileLedger } from './ledger.ts';

export const SYNTHETIC_FIXTURE_LABEL = 'Synthetic B1 fixture — no live backend or venue access';
const id = (value: number): string => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

/** New objects on each call: UI demos cannot accidentally change another consumer's fixture. */
export function createLedgerFixtures() {
  const venueId = id(1);
  const nightId = id(2);
  const ownerId = 'synthetic-owner-fixture';
  const staffId = 'synthetic-staff-fixture';
  const input: NightLedgerInput = { venueId, nightId, startingOccupancy: 0, openingFloatCents: 10000, capacity: 100, timezone: 'America/New_York', currency: 'USD' };
  const originalPresets: readonly CoverPreset[] = [
    { slot: 1, label: '$5 cover', amountCents: 500 },
    { slot: 2, label: '$10 cover', amountCents: 1000 },
    { slot: 3, label: '$15 cover', amountCents: 1500 },
  ];
  const presets: readonly CoverPreset[] = originalPresets.map((preset) => preset.slot === 2 ? { ...preset, label: '$15 cover', amountCents: 1500 } : { ...preset });
  const events: DoorEvent[] = Array.from({ length: 6 }, (_, index): DoorEvent => {
    const base = { id: id(10 + index), requestId: id(20 + index), venueId, nightId, actorId: staffId, sequence: index + 1, recordedAt: `2026-11-11T02:0${index}:00.000Z` };
    return index === 4 ? { ...base, type: 'EXIT', amountCents: 0 } : { ...base, type: 'ADMISSION', amountCents: index === 5 ? 1500 : 1000 };
  });
  const venue: VenueView = { id: venueId, name: 'Synthetic Encore Venue', capacity: 100, timezone: input.timezone };
  const night: NightView = { id: nightId, venueId, label: 'Synthetic Tuesday', status: 'OPEN', openedAt: '2026-11-11T02:00:00.000Z', closedAt: null, startingOccupancy: 0, capacity: 100, timezone: input.timezone, currency: 'USD', version: 6 };
  const projection = projectLedger(input, events);
  const syncedAt = '2026-11-11T02:05:30.000Z';
  const doorState: DoorState = {
    night, occupancy: projection.occupancy, atOrAboveCapacity: projection.atOrAboveCapacity, presets, syncedAt,
    recentActions: events.map((event) => ({ id: event.id, type: event.type, sequence: event.sequence, recordedAt: event.recordedAt, amountCents: event.amountCents, reversed: false, canUndo: event.sequence === 6 })),
  };
  const summary: OwnerSummary = { night, openingFloatCents: input.openingFloatCents, projection, reconciliation: null, syncedAt };
  const closedSummary: OwnerSummary = {
    ...summary, night: { ...night, status: 'CLOSED', closedAt: '2026-11-11T03:00:00.000Z', version: 7 },
    reconciliation: { ...reconcileLedger(input, events, 15000), closedBy: ownerId, closedAt: '2026-11-11T03:00:00.000Z', notes: 'Synthetic $5 shortfall; investigate without assuming theft.' },
    syncedAt: '2026-11-11T03:00:00.000Z',
  };
  const createVenue: CreateVenueCommand = { name: venue.name, capacity: venue.capacity, timezone: venue.timezone, presets: originalPresets };
  const openNight: OpenNightCommand = { label: night.label, startingOccupancy: 0, openingFloatCents: 10000, currency: 'USD' };
  const paidAdmission: EventCommand = { type: 'ADMISSION', requestId: id(25), presetSlot: 2, expectedAmountCents: 1500 };
  const freeAdmission: EventCommand = { type: 'FREE_ADMISSION', requestId: id(26) };
  const exit: EventCommand = { type: 'EXIT', requestId: id(27) };
  const reversal: EventCommand = { type: 'REVERSAL', requestId: id(28), targetEventId: id(15), reason: 'Synthetic duplicate tap correction' };
  const eventResult: EventResult = { eventId: id(15), requestId: id(25), state: doorState };
  const close: CloseCommand = { requestId: id(30), countedCashCents: 15000, notes: closedSummary.reconciliation?.notes ?? '' };
  const closeResult: CloseResult = { requestId: close.requestId, summary: closedSummary };
  const invite: CreateInviteCommand = { intendedEmail: 'staff@encore-fixture.invalid' };
  // Reserved invalid domain and inert example token; never a real credential or live invite.
  const inviteResult: InviteResult = { id: id(40), expiresAt: '2026-11-11T03:00:00.000Z', inviteUrl: 'https://encore-fixture.invalid/invite/synthetic-not-a-token' };
  const assignment: AssignmentView = { nightId, userId: staffId, startsAt: night.openedAt, endsAt: '2026-11-11T06:00:00.000Z', revokedAt: null };
  const revokedAssignment: AssignmentView = { ...assignment, revokedAt: '2026-11-11T02:30:00.000Z' };
  const exportResult = { contentType: 'text/csv' as const, filename: 'synthetic-ledger.csv',
    csv: 'synthetic,recordType,id,sequence,type,amountCents,actorId,recordedAt,countedCashCents,expectedCoverCents,floatCents,varianceCents\r\n'
      + events.map((event) => `true,event,${event.id},${event.sequence},${event.type},${event.amountCents},${event.actorId},${event.recordedAt},,,,\r\n`).join('')
      + `true,reconciliation,${nightId},,,,${ownerId},2026-11-11T03:00:00.000Z,15000,5500,10000,-500\r\n` };
  return { label: SYNTHETIC_FIXTURE_LABEL, input, venue, night, events, originalPresets, presets, doorState, summary, closedSummary,
    commands: { createVenue, openNight, updatePresets: { presets }, paidAdmission, freeAdmission, exit, reversal, close, invite, acceptInvite: { token: 'synthetic-not-a-token' } },
    responses: { eventResult, closeResult, inviteResult, assignment, revokedAssignment, exportResult } };
}
