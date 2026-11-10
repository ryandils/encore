import { describe, expect, it } from 'vitest';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';
import { acceptFixtureInvite, closeFixtureNight, configureVenue, createFixtureInvite, createOwnerFixture, dollarsToCents, exportFixtureNight, openFixtureNight, recordFixtureEvent, revokeFixtureAssignment, updateFixturePresets } from '../src/features/owner/fixture-model.ts';

const fixtures = createLedgerFixtures();
const time = '2026-11-11T02:00:00.000Z';
function opened() {
  return openFixtureNight(configureVenue(createOwnerFixture(), fixtures.commands.createVenue), fixtures.commands.openNight, time);
}
function scenario() {
  let state = opened();
  for (let i = 0; i < 4; i++) state = recordFixtureEvent(state, 'ADMISSION', 2, time);
  state = recordFixtureEvent(state, 'EXIT', undefined, time);
  state = updateFixturePresets(state, fixtures.commands.updatePresets);
  return recordFixtureEvent(state, 'ADMISSION', 2, '2026-11-11T02:16:00.000Z');
}
describe('owner fixture rehearsal', () => {
  it('rehearses the acceptance totals with immutable charged prices and a cash shortfall', () => {
    const state = scenario();
    expect(state.active?.summary.projection).toMatchObject({ entries: 5, exits: 1, occupancy: 4, peakOccupancy: 4, expectedCoverCents: 5500, expectedDrawerCents: 15500, capacityEquivalentTurns: 0.05 });
    expect(state.active?.summary.projection.admissionsByPrice).toEqual([{ amountCents: 1000, count: 4, totalCents: 4000 }, { amountCents: 1500, count: 1, totalCents: 1500 }]);
    expect(state.active?.summary.projection.arrivalBuckets.map((bucket) => bucket.entries)).toEqual([4, 1]);
    const closed = closeFixtureNight(state, fixtures.commands.close, '2026-11-11T03:00:00.000Z');
    expect(closed.active?.summary.reconciliation).toMatchObject({ countedCashCents: 15000, expectedCoverCents: 5500, expectedDrawerCents: 15500, varianceCents: -500 });
    expect(state.active?.summary.night.status).toBe('OPEN');
    expect(closed.history).toHaveLength(1);
    expect(closed.history[0]).toBe(closed.active);
    expect(closeFixtureNight(closed, fixtures.commands.close)).toBe(closed);
    expect(() => closeFixtureNight(closed, { ...fixtures.commands.close, countedCashCents: 16000 })).toThrow('cannot be overwritten');
    expect(() => recordFixtureEvent(closed, 'ADMISSION', 2)).toThrow('Closed nights');
    expect(() => createFixtureInvite(closed, fixtures.commands.invite)).toThrow('Closed nights');
    expect(() => updateFixturePresets(closed, fixtures.commands.updatePresets)).toThrow('read-only');
    const next = openFixtureNight(closed, { ...fixtures.commands.openNight, label: 'Another synthetic night' });
    expect(next.history[0].summary.reconciliation?.varianceCents).toBe(-500);
    expect(next.active?.events).toEqual([]);
  });
  it('does not fabricate cash for starting occupancy, free entries, or exits', () => {
    let state = openFixtureNight(configureVenue(createOwnerFixture(), { ...fixtures.commands.createVenue, capacity: 0 }), { ...fixtures.commands.openNight, startingOccupancy: 4 }, time);
    state = recordFixtureEvent(state, 'ADMISSION', undefined, time);
    state = recordFixtureEvent(state, 'EXIT', undefined, time);
    expect(state.active?.summary.projection).toMatchObject({ occupancy: 4, expectedCoverCents: 0, expectedDrawerCents: 10000, freeAdmissions: 1, capacityEquivalentTurns: null });
  });
  it('rejects invalid commands without mutating the original state', () => {
    const state = opened();
    expect(() => recordFixtureEvent(state, 'EXIT', undefined, time)).toThrow();
    expect(state.active?.events).toEqual([]);
    expect(() => openFixtureNight(state, fixtures.commands.openNight)).toThrow('Close the current');
    expect(() => configureVenue(state, fixtures.commands.createVenue)).toThrow('already has a venue');
    expect(() => configureVenue(createOwnerFixture(), { ...fixtures.commands.createVenue, timezone: 'Not/AZone' })).toThrow();
    expect(() => updateFixturePresets(state, { presets: [] })).toThrow();
    expect(() => closeFixtureNight(state, { ...fixtures.commands.close, countedCashCents: -1 })).toThrow();
  });
  it('strictly parses USD without rounding or accepting exponent notation', () => {
    expect(dollarsToCents(' 10.09 ')).toBe(1009);
    expect(dollarsToCents('0')).toBe(0);
    expect(dollarsToCents('5.5')).toBe(550);
    for (const input of ['', '-1', '1.001', '1e3', 'NaN', 'Infinity', '21474836.48']) expect(() => dollarsToCents(input)).toThrow();
  });
  it('simulates only synthetic, unexpired, single-use invitations and revocation', () => {
    const state = opened();
    expect(() => createFixtureInvite(state, { intendedEmail: 'staff@example.com' }, time)).toThrow('.invalid');
    const invited = createFixtureInvite(state, fixtures.commands.invite, time);
    const invite = invited.invites[0];
    expect(invite.inviteUrl).toMatch(/^https:\/\/encore-fixture\.invalid\//);
    expect(() => acceptFixtureInvite(invited, invite.id, invite.expiresAt)).toThrow('expired');
    const accepted = acceptFixtureInvite(invited, invite.id, '2026-11-11T02:01:00.000Z');
    expect(accepted.assignments).toHaveLength(1);
    expect(() => acceptFixtureInvite(accepted, invite.id, time)).toThrow('already used');
    const revoked = revokeFixtureAssignment(accepted, invite.userId, '2026-11-11T02:02:00.000Z');
    expect(revoked.assignments[0].revokedAt).toBe('2026-11-11T02:02:00.000Z');
    expect(accepted.assignments[0].revokedAt).toBeNull();
    const pendingRevoked = revokeFixtureAssignment(invited, invite.userId, time);
    expect(() => acceptFixtureInvite(pendingRevoked, invite.id, time)).toThrow('revoked');
  });
  it('exports individual charged amounts, actor/time and safe closing text', () => {
    const closed = closeFixtureNight(scenario(), { ...fixtures.commands.close, notes: ' =SUM(A1:A2), "synthetic"\nnotes' }, time);
    const night = closed.active;
    if (!night) throw new Error('Expected a closed fixture');
    const exported = exportFixtureNight(night);
    expect(exported.contentType).toBe('text/csv');
    expect(exported.csv).toContain('"ADMISSION","1000","synthetic-staff-fixture"');
    expect(exported.csv).toContain('"ADMISSION","1500","synthetic-staff-fixture"');
    expect(exported.csv).toContain('"EXIT","0"');
    expect(exported.csv).toContain('"15000","5500","10000","15500","-500"');
    expect(exported.csv).toContain('"\' =SUM(A1:A2), ""synthetic""\nnotes"');
    expect(exported.csv).toContain('2026-11-11T02:16:00.000Z');
  });
});
