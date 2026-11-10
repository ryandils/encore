import { describe, expect, it } from 'vitest';
import { projectLedger, reconcileLedger } from '../src/domain/ledger.ts';
import type { DoorEvent, NightLedgerInput } from '../src/domain/types.ts';
import { DomainValidationError, INT32_MAX, validateDoorEvent, validateNightLedgerInput } from '../src/domain/validation.ts';

const uuid = (value: number) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const input: NightLedgerInput = {
  nightId: uuid(1), venueId: uuid(2), startingOccupancy: 0, openingFloatCents: 10_000,
  capacity: 100, timezone: 'America/New_York', currency: 'USD',
};

function event(sequence: number, type: 'ADMISSION' | 'EXIT' = 'ADMISSION', amountCents = 1000): DoorEvent {
  const identity = { id: uuid(100 + sequence), venueId: input.venueId, nightId: input.nightId,
    actorId: 'synthetic-staff-opaque-id', requestId: uuid(200 + sequence), sequence,
    recordedAt: `2026-11-10T23:${String(sequence).padStart(2, '0')}:00.000Z` };
  return type === 'ADMISSION' ? { ...identity, type, amountCents } : { ...identity, type, amountCents: 0 };
}

function reversal(sequence: number, targetSequence: number): DoorEvent {
  return { ...event(sequence), type: 'REVERSAL', amountCents: 0, targetEventId: uuid(100 + targetSequence), reason: 'Synthetic correction' };
}

const scenario = [event(1), event(2), event(3), event(4), event(5, 'EXIT'), event(6, 'ADMISSION', 1500)];

describe('documented ledger scenario', () => {
  it('preserves historical prices and calculates counts, peak, drawer and shortage', () => {
    expect(projectLedger(input, scenario.slice(0, 5))).toMatchObject({ entries: 4, exits: 1, occupancy: 3, expectedCoverCents: 4000 });
    const result = projectLedger(input, scenario);
    expect(result).toMatchObject({ entries: 5, paidAdmissions: 5, freeAdmissions: 0, exits: 1, occupancy: 4,
      peakOccupancy: 4, expectedCoverCents: 5500, expectedDrawerCents: 15_500,
      capacityEquivalentTurns: 0.05, atOrAboveCapacity: false, lastSequence: 6,
      admissionsByPrice: [{ amountCents: 1000, count: 4, totalCents: 4000 }, { amountCents: 1500, count: 1, totalCents: 1500 }] });
    expect(reconcileLedger(input, scenario, 15_000)).toEqual({ countedCashCents: 15_000, expectedCoverCents: 5500,
      floatCents: 10_000, expectedDrawerCents: 15_500, varianceCents: -500 });
  });

  it('free entry and exits change counts without changing cash', () => {
    expect(projectLedger(input, [event(1, 'ADMISSION', 0), event(2, 'EXIT')])).toMatchObject({
      entries: 1, freeAdmissions: 1, paidAdmissions: 0, exits: 1, occupancy: 0, peakOccupancy: 1,
      expectedCoverCents: 0, expectedDrawerCents: 10_000, admissionsByPrice: [{ amountCents: 0, count: 1, totalCents: 0 }],
    });
  });

  it('starting occupancy contributes no revenue and capacity is advisory', () => {
    const night = { ...input, startingOccupancy: 4, capacity: 4 };
    expect(projectLedger(night, [])).toMatchObject({ entries: 0, occupancy: 4, peakOccupancy: 4, expectedCoverCents: 0, atOrAboveCapacity: true });
    expect(projectLedger(night, [event(1)])).toMatchObject({ occupancy: 5, atOrAboveCapacity: true, capacityEquivalentTurns: 0.25 });
    expect(projectLedger({ ...night, capacity: 0 }, [])).toMatchObject({ capacityEquivalentTurns: null, atOrAboveCapacity: false });
  });

  it('uses server sequence despite shuffled input and nonmonotonic wall-clock timestamps', () => {
    const shuffled = [event(3), event(1), { ...event(2, 'EXIT'), recordedAt: '2026-11-10T22:00:00Z' }];
    expect(projectLedger(input, shuffled)).toMatchObject({ occupancy: 1, peakOccupancy: 1, lastSequence: 3 });
    expect(projectLedger(input, shuffled).effectiveEventIds).toEqual([uuid(101), uuid(102), uuid(103)]);
    expect(shuffled.map((item) => item.sequence)).toEqual([3, 1, 2]);
  });

  it('permits gaps in monotonic sequence values', () => {
    expect(projectLedger(input, [event(1), event(3)])).toMatchObject({ entries: 2, lastSequence: 3 });
  });
});

describe('audit-preserving corrections', () => {
  it('removes an admission from its original place and recomputes prices, peak and arrivals', () => {
    const events = [event(1), event(2, 'ADMISSION', 1500), event(3, 'EXIT'), reversal(4, 1)];
    const before = structuredClone(events);
    expect(projectLedger(input, events)).toMatchObject({ entries: 1, exits: 1, occupancy: 0, peakOccupancy: 1,
      expectedCoverCents: 1500, effectiveEventIds: [uuid(102), uuid(103)], reversedEventIds: [uuid(101)],
      admissionsByPrice: [{ amountCents: 1500, count: 1, totalCents: 1500 }],
      arrivalBuckets: [{ entries: 1 }], lastSequence: 4 });
    expect(events).toEqual(before);
  });

  it('allows resolving the dependent exit before reversing its admission', () => {
    expect(projectLedger(input, [event(1), event(2, 'EXIT'), reversal(3, 2), reversal(4, 1)])).toMatchObject({
      entries: 0, exits: 0, occupancy: 0, peakOccupancy: 0, expectedCoverCents: 0, arrivalBuckets: [],
    });
  });

  it('rejects a negative effective prefix even when the final occupancy is nonnegative', () => {
    expect(() => projectLedger(input, [event(1), event(2, 'EXIT'), event(3), reversal(4, 1)])).toThrow('negative occupancy');
  });

  it('rejects a historically invalid exit even if a later correction would remove it', () => {
    expect(() => projectLedger(input, [event(1, 'EXIT'), reversal(2, 1)])).toThrow('Exit at zero');
  });

  it('rejects an invalid correction even if a later correction would repair the history', () => {
    expect(() => projectLedger(input, [event(1), event(2, 'EXIT'), reversal(3, 1), reversal(4, 2)])).toThrow('negative occupancy');
  });

  it.each([
    ['missing target', [event(1), reversal(2, 9)]],
    ['future target', [reversal(1, 2), event(2)]],
    ['self target', [event(1), reversal(2, 2)]],
    ['duplicate target', [event(1), reversal(2, 1), reversal(3, 1)]],
    ['reversal target', [event(1), reversal(2, 1), reversal(3, 2)]],
  ])('rejects %s', (_label, events) => {
    expect(() => projectLedger(input, events)).toThrow(DomainValidationError);
  });
});

describe('runtime ledger validation and range boundaries', () => {
  it.each([
    ['duplicate ID', [event(1), { ...event(2), id: uuid(101) }]],
    ['duplicate request', [event(1), { ...event(2), requestId: uuid(201) }]],
    ['duplicate sequence', [event(1), { ...event(2), sequence: 1 }]],
    ['wrong night', [{ ...event(1), nightId: uuid(9) }]],
    ['wrong venue', [{ ...event(1), venueId: uuid(9) }]],
  ])('rejects %s', (_label, events) => {
    expect(() => projectLedger(input, events)).toThrow(DomainValidationError);
  });

  it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, INT32_MAX + 1, '1000', null])('rejects invalid cents %s', (amountCents) => {
    expect(() => validateDoorEvent({ ...event(1), amountCents })).toThrow(DomainValidationError);
  });

  it.each([
    { type: 'OTHER' }, { type: { toString: (): string => 'ADMISSION' }, amountCents: 0 },
    { actorId: ' ' }, { id: 'opaque-not-uuid' }, { requestId: 'AAAAAAAA-0000-0000-0000-000000000000' },
    { sequence: 0 }, { sequence: -1 }, { sequence: 0.5 }, { sequence: INT32_MAX + 1 },
    { recordedAt: '2026-02-30T00:00:00Z' }, { recordedAt: '2026-11-10T23:01:00+00:00' },
    { recordedAt: '2026-11-10' }, { recordedAt: 'invalid' }, { targetEventId: uuid(9) }, { reason: 'not a reversal' },
    { type: 'EXIT', amountCents: 1 }, { type: 'REVERSAL', targetEventId: uuid(9), amountCents: 1, reason: 'test' },
    { type: 'REVERSAL', targetEventId: uuid(9), amountCents: 0, reason: ' ' },
  ])('rejects invalid event fields %#', (fields) => {
    expect(() => validateDoorEvent({ ...event(1), ...fields })).toThrow(DomainValidationError);
  });

  it.each([
    { currency: 'EUR' }, { startingOccupancy: -1 }, { startingOccupancy: 0.5 }, { capacity: -1 },
    { openingFloatCents: INT32_MAX + 1 }, { timezone: 'Not/A_Timezone' }, { timezone: '+05:00' },
    { nightId: '' }, { venueId: null },
  ])('rejects invalid night fields %#', (fields) => {
    expect(() => validateNightLedgerInput({ ...input, ...fields })).toThrow(DomainValidationError);
  });

  it('accepts opaque auth identities and canonical domain IDs', () => {
    expect(() => validateDoorEvent(event(1))).not.toThrow();
  });

  it('rejects non-record inputs and a non-array history without leaking native errors', () => {
    expect(() => validateDoorEvent(null)).toThrow(DomainValidationError);
    expect(() => validateNightLedgerInput([])).toThrow(DomainValidationError);
    expect(() => projectLedger(input, null as unknown as DoorEvent[])).toThrow(DomainValidationError);
  });

  it('rejects occupancy, cover and drawer overflows', () => {
    expect(() => projectLedger({ ...input, startingOccupancy: INT32_MAX }, [event(1)])).toThrow('occupancy exceeds');
    expect(() => projectLedger({ ...input, openingFloatCents: 0 }, [event(1, 'ADMISSION', INT32_MAX), event(2, 'ADMISSION', 1)])).toThrow('expected cover exceeds');
    expect(() => projectLedger(input, [event(1, 'ADMISSION', INT32_MAX)])).toThrow('expected drawer exceeds');
  });

  it('rejects historical overflow even when a later reversal reduces the total', () => {
    expect(() => projectLedger(input, [event(1, 'ADMISSION', INT32_MAX), reversal(2, 1)])).toThrow('expected drawer exceeds');
  });

  it('checks replay overflow when reversing an exit', () => {
    const night = { ...input, startingOccupancy: INT32_MAX };
    expect(() => projectLedger(night, [event(1, 'EXIT'), event(2), reversal(3, 1)])).toThrow('occupancy exceeds');
  });

  it('supports signed variance boundaries without floating-point money', () => {
    expect(reconcileLedger({ ...input, openingFloatCents: INT32_MAX }, [], 0).varianceCents).toBe(-INT32_MAX);
    expect(reconcileLedger({ ...input, openingFloatCents: 0 }, [], INT32_MAX).varianceCents).toBe(INT32_MAX);
    expect(() => reconcileLedger(input, [], -1)).toThrow(DomainValidationError);
    expect(() => reconcileLedger(input, [], 1.2)).toThrow(DomainValidationError);
  });
});

describe('venue-local quarter-hour arrivals', () => {
  function at(sequence: number, recordedAt: string): DoorEvent {
    return { ...event(sequence), recordedAt };
  }

  it('places exact boundaries and fractional seconds in the correct bucket', () => {
    const result = projectLedger(input, [at(1, '2026-11-10T23:14:59.999Z'), at(2, '2026-11-10T23:15:00Z')]);
    expect(result.arrivalBuckets).toEqual([
      { startUtc: '2026-11-10T23:00:00.000Z', label: '2026-11-10 18:00 -05:00', offset: '-05:00', entries: 1 },
      { startUtc: '2026-11-10T23:15:00.000Z', label: '2026-11-10 18:15 -05:00', offset: '-05:00', entries: 1 },
    ]);
  });

  it('keeps repeated fall-back local times distinct by UTC instant and offset', () => {
    const result = projectLedger(input, [at(1, '2026-11-01T05:08:00Z'), at(2, '2026-11-01T06:08:00Z')]);
    expect(result.arrivalBuckets).toEqual([
      { startUtc: '2026-11-01T05:00:00.000Z', label: '2026-11-01 01:00 -04:00', offset: '-04:00', entries: 1 },
      { startUtc: '2026-11-01T06:00:00.000Z', label: '2026-11-01 01:00 -05:00', offset: '-05:00', entries: 1 },
    ]);
  });

  it('does not invent missing spring-forward buckets', () => {
    const result = projectLedger(input, [at(1, '2026-03-08T06:59:59Z'), at(2, '2026-03-08T07:00:00Z')]);
    expect(result.arrivalBuckets.map((bucket) => bucket.label)).toEqual(['2026-03-08 01:45 -05:00', '2026-03-08 03:00 -04:00']);
  });

  it('supports quarter-hour offset zones and midnight rollover', () => {
    const result = projectLedger({ ...input, timezone: 'Asia/Kathmandu' }, [at(1, '2026-11-10T18:20:00Z')]);
    expect(result.arrivalBuckets).toEqual([
      { startUtc: '2026-11-10T18:15:00.000Z', label: '2026-11-11 00:00 +05:45', offset: '+05:45', entries: 1 },
    ]);
  });

  it('labels UTC explicitly and excludes reversed arrivals from buckets', () => {
    const result = projectLedger({ ...input, timezone: 'UTC' }, [event(1), event(2), reversal(3, 1)]);
    expect(result.arrivalBuckets).toEqual([
      { startUtc: '2026-11-10T23:00:00.000Z', label: '2026-11-10 23:00 +00:00', offset: '+00:00', entries: 1 },
    ]);
  });
});
