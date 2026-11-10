import { describe, expect, it } from 'vitest';
import { closeRequestPayload, eventRequestPayload, parseAcceptInviteCommand, parseCloseCommand, parseCreateInviteCommand, parseCreateVenueCommand, parseEventCommand, parseOpenNightCommand, parsePresetsCommand } from '../src/domain/contracts.ts';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';
import { projectLedger } from '../src/domain/ledger.ts';

describe('shared B1 contracts and fixtures', () => {
  it('supplies labeled, coherent money and staff/owner views for the MVP scenario', () => {
    const fixture = createLedgerFixtures();
    expect(fixture.label).toMatch(/Synthetic.*no live backend/);
    expect(fixture.summary.projection).toMatchObject({ entries: 5, exits: 1, occupancy: 4, peakOccupancy: 4, expectedCoverCents: 5500, expectedDrawerCents: 15500, capacityEquivalentTurns: 0.05 });
    expect(fixture.closedSummary.reconciliation?.varianceCents).toBe(-500);
    expect(fixture.doorState).not.toHaveProperty('projection');
    expect(fixture.doorState).not.toHaveProperty('reconciliation');
    expect(fixture.doorState.night).not.toHaveProperty('openingFloatCents');
    expect(fixture.doorState.recentActions[0]).not.toHaveProperty('actorId');
    expect(fixture.originalPresets[1].amountCents).toBe(1000);
    expect(fixture.presets[1].amountCents).toBe(1500);
    expect(projectLedger(fixture.input, fixture.events).expectedCoverCents).toBe(5500);
    expect(fixture.responses.exportResult.csv).toContain(',5,EXIT,0,synthetic-staff-fixture,');
    expect(fixture.responses.exportResult.csv).toContain('15000,5500,10000,-500');
    const csvRows = fixture.responses.exportResult.csv.trim().split('\r\n').map((row) => row.split(','));
    expect(csvRows.every((row) => row.length === 12)).toBe(true);
    expect(csvRows.at(-1)?.[6]).toBe('synthetic-owner-fixture');
  });
  it('provides fresh fixture graphs and valid requests for every operation family', () => {
    const { commands } = createLedgerFixtures();
    for (const command of [commands.paidAdmission, commands.freeAdmission, commands.exit, commands.reversal]) expect(parseEventCommand(command)).toEqual(command);
    expect(parseCloseCommand(commands.close)).toEqual(commands.close);
    expect(parseCreateVenueCommand(commands.createVenue)).toEqual(commands.createVenue);
    expect(parseOpenNightCommand(commands.openNight)).toEqual(commands.openNight);
    expect(parsePresetsCommand(commands.updatePresets)).toEqual(commands.updatePresets);
    expect(parseCreateInviteCommand(commands.invite)).toEqual(commands.invite);
    expect(parseAcceptInviteCommand(commands.acceptInvite)).toEqual(commands.acceptInvite);
    const changed = createLedgerFixtures();
    changed.events.pop();
    expect(createLedgerFixtures().events).toHaveLength(6);
  });
  it('canonicalizes retries across property order while retaining payload differences and night scope', () => {
    const { input, commands } = createLedgerFixtures();
    const command = commands.paidAdmission;
    if (command.type !== 'ADMISSION') throw new Error('Fixture must be paid.');
    expect(eventRequestPayload(input.nightId, { expectedAmountCents: 1500, presetSlot: 2, requestId: command.requestId, type: 'ADMISSION' })).toBe(eventRequestPayload(input.nightId, command));
    expect(eventRequestPayload(input.nightId, { ...command, expectedAmountCents: 1000 })).not.toBe(eventRequestPayload(input.nightId, command));
    expect(eventRequestPayload(input.venueId, command)).not.toBe(eventRequestPayload(input.nightId, command));
    expect(closeRequestPayload(input.nightId, commands.close)).not.toBe(closeRequestPayload(input.nightId, { ...commands.close, countedCashCents: 1 }));
  });
  it('rejects untrusted identity, totals, bad prices and mismatched event payload shapes', () => {
    const { commands } = createLedgerFixtures();
    for (const extra of [{ actorId: 'owner' }, { venueId: 'venue' }, { role: 'OWNER' }, { expectedCoverCents: 0 }]) expect(() => parseEventCommand({ ...commands.paidAdmission, ...extra })).toThrow();
    for (const expectedAmountCents of [-1, 1.1, Number.NaN, Number.POSITIVE_INFINITY, 2147483648, '1500']) expect(() => parseEventCommand({ ...commands.paidAdmission, expectedAmountCents })).toThrow();
    expect(() => parseEventCommand({ ...commands.exit, amountCents: 0 })).toThrow();
    expect(() => parseEventCommand({ ...commands.paidAdmission, presetSlot: 4 })).toThrow();
    expect(() => parseEventCommand({ ...commands.reversal, reason: ' ' })).toThrow();
    expect(() => parseEventCommand({ ...commands.exit, requestId: 'not-a-uuid' })).toThrow();
    expect(() => parseCloseCommand({ ...commands.close, countedCashCents: -1 })).toThrow();
    expect(() => parseCloseCommand({ ...commands.close, expectedCoverCents: 0 })).toThrow();
  });
  it('rejects invalid setup, currency, preset slots and invite requests', () => {
    const { commands } = createLedgerFixtures();
    expect(() => parseCreateVenueCommand({ ...commands.createVenue, timezone: 'Not/AZone' })).toThrow();
    expect(() => parseCreateVenueCommand({ ...commands.createVenue, capacity: -1 })).toThrow();
    expect(() => parseOpenNightCommand({ ...commands.openNight, currency: 'EUR' })).toThrow();
    expect(() => parseOpenNightCommand({ ...commands.openNight, actorId: 'owner' })).toThrow();
    expect(() => parsePresetsCommand({ presets: [commands.updatePresets.presets[0]] })).toThrow();
    expect(() => parsePresetsCommand({ presets: Array(3).fill(commands.updatePresets.presets[0]) })).toThrow();
    expect(() => parseCreateInviteCommand({ intendedEmail: 'bad' })).toThrow();
    expect(() => parseAcceptInviteCommand({ token: '' })).toThrow();
  });
});
