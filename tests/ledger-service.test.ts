import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import type { EventResult } from '../src/domain/contracts.ts';
import type { DoorEvent } from '../src/domain/types.ts';
import { PostgresLedgerService } from '../src/server/ledger-service.ts';

const uuid = (value: number) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const now = Date.parse('2026-11-11T01:00:00.000Z');
const actor = 'synthetic-staff';
const otherActor = 'synthetic-other';
const context = { authenticatedUserId: actor, nightId: uuid(1) };

function admission(sequence: number, actorId = actor, age = 1000): DoorEvent {
  return { id: uuid(100 + sequence), requestId: uuid(100_000 + sequence), venueId: uuid(2), nightId: uuid(1),
    sequence, actorId, type: 'ADMISSION', amountCents: 0, recordedAt: new Date(now - age).toISOString() };
}
function reversal(sequence: number, target: number, actorId = actor): DoorEvent {
  return { ...admission(sequence, actorId), type: 'REVERSAL', amountCents: 0,
    targetEventId: uuid(100 + target), reason: 'Synthetic correction' };
}

/** Mock only the database boundary: validation, projection and service authorization stay real. */
function fixture(events: DoorEvent[], role: 'OWNER' | 'STAFF' = 'STAFF', instrument = false) {
  const data = { events: [...events], role, now: new Date(now), status: 'OPEN', propertyReads: 0, historyReads: 0, inserts: 0 };
  const receipts = new Map<string, { actorId: string; requestPayload: unknown; responseSnapshot: EventResult }>();
  const query = async (sql: string, values: unknown[] = []) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('SET LOCAL') || sql.startsWith('UPDATE night')) return { rows: [] };
    if (sql.startsWith('SELECT * FROM night')) return { rows: [{ id: uuid(1), venueId: uuid(2), label: 'Synthetic night', status: data.status,
      openedAt: new Date(now - 3_600_000), closedAt: data.status === 'CLOSED' ? data.now : null,
      startingOccupancy: 0, openingFloatCents: 0, capacity: 100, currency: 'USD', timezone: 'UTC', version: data.events.length }] };
    if (sql.startsWith('SELECT role')) return { rows: [{ role: data.role }] };
    if (sql.includes('FROM night_assignment')) return { rows: [{ startsAt: new Date(now - 3_600_000), endsAt: new Date(now + 3_600_000), revokedAt: null }] };
    if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now: data.now }] };
    if (sql.includes('FROM cover_preset')) return { rows: [] };
    if (sql.startsWith('SELECT "actorId"')) {
      const receipt = receipts.get(String(values[1]));
      return { rows: receipt ? [structuredClone(receipt)] : [] };
    }
    if (sql.startsWith('SELECT * FROM door_event')) {
      data.historyReads++;
      const rows = data.events.map(event => ({ ...event, recordedAt: new Date(event.recordedAt) }));
      if (!instrument) return { rows };
      // Count reads on hydrated events, including nested scans, independent of wall-clock speed.
      // The SQL rows' map is the hydration boundary; every subsequent production pass sees these proxies.
      return { rows: { map: (hydrate: (row: (typeof rows)[number]) => DoorEvent) => rows.map(row => new Proxy(hydrate(row), {
        get(target, key, receiver) { data.propertyReads++; return Reflect.get(target, key, receiver); },
      })) } };
    }
    if (sql.startsWith('INSERT INTO door_event')) {
      data.inserts++;
      receipts.set(String(values[4]), { actorId: String(values[3]), requestPayload: structuredClone(values[11]), responseSnapshot: structuredClone(values[12] as EventResult) });
      return { rows: [] };
    }
    throw new Error(`Unexpected mock query: ${sql}`);
  };
  const pool = { connect: async () => ({ query, release() {} }) } as unknown as Pool;
  return { data, service: new PostgresLedgerService(pool) };
}

describe('PostgreSQL ledger undo eligibility', () => {
  it('uses the latest uncorrected action by sequence for this actor, not timestamp or another actor', async () => {
    const { service } = fixture([admission(1, actor, 0), admission(2, actor, 20_000), admission(3, otherActor)]);
    const state = await service.doorState(context);
    expect(state.recentActions.map(action => [action.id, action.canUndo])).toEqual([[uuid(102), true], [uuid(101), false]]);
  });

  it('skips corrected actions and reversals to expose the preceding eligible action', async () => {
    const { service } = fixture([admission(1), admission(2), admission(3), reversal(4, 3, otherActor), reversal(5, 2)]);
    const state = await service.doorState(context);
    expect(state.recentActions.map(action => [action.id, action.reversed, action.canUndo])).toEqual([
      [uuid(105), false, false], [uuid(103), true, false], [uuid(102), true, false], [uuid(101), false, true],
    ]);
  });

  it.each([[-1, false], [0, true], [60_000, true], [60_001, false]])('enforces staff age %i ms on reads and correction commands', async (age, allowed) => {
    const { service } = fixture([admission(1, actor, age)]);
    expect((await service.doorState(context)).recentActions[0].canUndo).toBe(allowed);
    const command = { type: 'REVERSAL' as const, requestId: uuid(90), targetEventId: uuid(101), reason: 'Synthetic correction' };
    if (allowed) expect((await service.record(context, command)).state.occupancy).toBe(0);
    else await expect(service.record(context, command)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets owners correct old actions belonging to other actors, but never reversals or corrected actions', async () => {
    const { service } = fixture([admission(1, otherActor, 120_000), admission(2, otherActor), reversal(3, 2)], 'OWNER');
    expect((await service.doorState(context)).recentActions.map(action => action.canUndo)).toEqual([false, false, true]);
    const correction = { type: 'REVERSAL' as const, requestId: uuid(90), targetEventId: uuid(101), reason: 'Synthetic owner correction' };
    expect((await service.record(context, correction)).state.occupancy).toBe(0);
    for (const target of [102, 103]) await expect(service.record(context, { ...correction, requestId: uuid(target + 1000), targetEventId: uuid(target) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects staff corrections of another actor or an older uncorrected action', async () => {
    const { service } = fixture([admission(1), admission(2), admission(3, otherActor)]);
    for (const target of [101, 103]) await expect(service.record(context, {
      type: 'REVERSAL', requestId: uuid(target + 1000), targetEventId: uuid(target), reason: 'Synthetic denied correction',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps the newest 20 actor actions and applies corrections outside that visible window', async () => {
    const events = Array.from({ length: 25 }, (_, index) => admission(index + 1));
    events.push(reversal(26, 25, otherActor));
    const { service } = fixture(events);
    const state = await service.doorState(context);
    expect(state.recentActions.map(action => action.sequence)).toEqual(Array.from({ length: 20 }, (_, index) => 25 - index));
    expect(state.recentActions.filter(action => action.canUndo).map(action => action.sequence)).toEqual([24]);
    expect(state.recentActions[0].reversed).toBe(true);
  });

  it.each(['STAFF', 'OWNER'] as const)('disables all undo for closed nights (%s)', async role => {
    const { data, service } = fixture([admission(1)], role);
    data.status = 'CLOSED';
    expect((await service.doorState(context)).recentActions[0].canUndo).toBe(false);
    await expect(service.record(context, { type: 'REVERSAL', requestId: uuid(90), targetEventId: uuid(101), reason: 'Synthetic closed correction' })).rejects.toMatchObject({ code: 'NIGHT_CLOSED' });
  });

  it('keeps owner receipts actor-scoped and returns the saved snapshot after role, time and history changes', async () => {
    const { data, service } = fixture([admission(1), admission(2, otherActor)], 'OWNER');
    const command = { type: 'FREE_ADMISSION' as const, requestId: uuid(90) };
    const result = await service.record(context, command);
    const original = structuredClone(result);
    expect(result.state.recentActions.map(action => action.id)).toEqual([result.eventId, uuid(101)]);
    expect(result.state.recentActions.map(action => action.canUndo)).toEqual([true, false]);
    data.role = 'STAFF'; data.now = new Date(now + 120_000); data.status = 'CLOSED';
    data.events.push(admission(3, otherActor));
    const historyReads = data.historyReads;
    expect(await service.record(context, command)).toEqual(original);
    expect(result).toEqual(original);
    expect(data.historyReads).toBe(historyReads);
    expect(data.inserts).toBe(1);
    await expect(service.record({ ...context, authenticatedUserId: otherActor }, command)).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
  });

  it('bounds event inspections linearly when admission history doubles', async () => {
    const reads: number[] = [];
    for (const count of [500, 1000]) {
      const { data, service } = fixture(Array.from({ length: count }, (_, index) => admission(index + 1)), 'STAFF', true);
      const state = await service.doorState(context);
      expect(state.recentActions.filter(action => action.canUndo).map(action => action.sequence)).toEqual([count]);
      // Includes real validation and projection. No reversals: their prefix-replay cost is a separate concern.
      expect(data.propertyReads).toBeGreaterThan(count);
      expect(data.propertyReads).toBeLessThan(count * 150);
      reads.push(data.propertyReads);
    }
    expect(reads[1]).toBeLessThan(reads[0] * 2.2);
  });
});
