import type { ArrivalBucket, DoorEvent, LedgerProjection, NightLedgerInput, ReconciliationProjection } from './types.ts';
import { assertNonnegativeInt, DomainValidationError, INT32_MAX, validateDoorEvent, validateNightLedgerInput } from './validation.ts';

function add(left: number, right: number, field: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result > INT32_MAX || result < 0) {
    throw new DomainValidationError(`${field} exceeds its nonnegative int32 range.`, 'OVERFLOW');
  }
  return result;
}

function invalid(message: string): never {
  throw new DomainValidationError(message, 'INVALID_HISTORY');
}

/** Recompute every effective prefix, not just final occupancy, when undoing an action. */
function replayOccupancy(start: number, events: readonly DoorEvent[], reversed: ReadonlySet<string>): number {
  let occupancy = start;
  for (const event of events) {
    if (event.type === 'REVERSAL' || reversed.has(event.id)) continue;
    if (event.type === 'EXIT' && occupancy === 0) invalid('The effective history would have negative occupancy.');
    occupancy = add(occupancy, event.type === 'ADMISSION' ? 1 : -1, 'occupancy');
  }
  return occupancy;
}

function arrivalBucket(recordedAt: string, formatter: Intl.DateTimeFormat): Omit<ArrivalBucket, 'entries'> {
  const instant = new Date(recordedAt);
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const minute = Number(part('minute'));
  const bucketMinute = minute - (minute % 15);
  const startUtc = new Date(instant.getTime() - (minute % 15) * 60_000 - Number(part('second')) * 1000 - instant.getUTCMilliseconds()).toISOString();
  const offset = part('timeZoneName').replace('GMT', '') || '+00:00';
  const label = `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${String(bucketMinute).padStart(2, '0')} ${offset}`;
  return { startUtc, label, offset };
}

/** Pure projection only: this does not authenticate, authorize, persist, or accept a command. */
export function projectLedger(input: NightLedgerInput, events: readonly DoorEvent[]): LedgerProjection {
  validateNightLedgerInput(input);
  if (!Array.isArray(events)) throw new DomainValidationError('events must be an array.');
  for (const event of events) validateDoorEvent(event);
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const known = new Map<string, DoorEvent>();
  const requests = new Set<string>();
  const reversed = new Set<string>();
  const accepted: DoorEvent[] = [];
  let lastSequence = 0;
  let historicalOccupancy = input.startingOccupancy;
  let historicalCover = 0;
  for (const event of ordered) {
    if (event.nightId !== input.nightId || event.venueId !== input.venueId) invalid('Event belongs to another venue or night.');
    if (event.sequence === lastSequence) invalid('Duplicate event sequence.');
    if (known.has(event.id)) invalid('Duplicate event ID.');
    if (requests.has(event.requestId)) invalid('Duplicate request ID: retries must not create a second event.');
    if (event.type === 'REVERSAL') {
      const target = known.get(event.targetEventId);
      if (!target) invalid('Reversal target must be an earlier event in this night.');
      if (target.type === 'REVERSAL') invalid('Cannot reverse a reversal.');
      if (reversed.has(target.id)) invalid('Cannot reverse the same event twice.');
      reversed.add(target.id);
      historicalOccupancy = replayOccupancy(input.startingOccupancy, accepted, reversed);
      if (target.type === 'ADMISSION') historicalCover -= target.amountCents;
    } else {
      if (event.type === 'EXIT' && historicalOccupancy === 0) invalid('Exit at zero occupancy cannot be accepted.');
      historicalOccupancy = add(historicalOccupancy, event.type === 'ADMISSION' ? 1 : -1, 'occupancy');
      if (event.type === 'ADMISSION') {
        historicalCover = add(historicalCover, event.amountCents, 'expected cover');
        add(input.openingFloatCents, historicalCover, 'expected drawer');
      }
    }
    known.set(event.id, event);
    requests.add(event.requestId);
    accepted.push(event);
    lastSequence = event.sequence;
  }

  let entries = 0;
  let paidAdmissions = 0;
  let freeAdmissions = 0;
  let exits = 0;
  let occupancy = input.startingOccupancy;
  let peakOccupancy = occupancy;
  let expectedCoverCents = 0;
  const effectiveEventIds: string[] = [];
  const prices = new Map<number, { amountCents: number; count: number; totalCents: number }>();
  const buckets = new Map<string, ArrivalBucket>();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: input.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
  });
  for (const event of ordered) {
    if (event.type === 'REVERSAL' || reversed.has(event.id)) continue;
    effectiveEventIds.push(event.id);
    if (event.type === 'ADMISSION') {
      entries = add(entries, 1, 'entries');
      if (event.amountCents === 0) freeAdmissions = add(freeAdmissions, 1, 'free admissions');
      else paidAdmissions = add(paidAdmissions, 1, 'paid admissions');
      occupancy = add(occupancy, 1, 'occupancy');
      expectedCoverCents = add(expectedCoverCents, event.amountCents, 'expected cover');
      const price = prices.get(event.amountCents) ?? { amountCents: event.amountCents, count: 0, totalCents: 0 };
      prices.set(event.amountCents, { ...price, count: add(price.count, 1, 'price count'), totalCents: add(price.totalCents, event.amountCents, 'price total') });
      const bucket = arrivalBucket(event.recordedAt, formatter);
      buckets.set(bucket.startUtc, { ...bucket, entries: add(buckets.get(bucket.startUtc)?.entries ?? 0, 1, 'bucket entries') });
    } else {
      exits = add(exits, 1, 'exits');
      occupancy -= 1;
    }
    peakOccupancy = Math.max(peakOccupancy, occupancy);
  }
  return {
    entries, paidAdmissions, freeAdmissions, exits, occupancy, peakOccupancy, expectedCoverCents,
    expectedDrawerCents: add(input.openingFloatCents, expectedCoverCents, 'expected drawer'),
    capacityEquivalentTurns: input.capacity > 0 ? entries / input.capacity : null,
    atOrAboveCapacity: input.capacity > 0 && occupancy >= input.capacity,
    admissionsByPrice: [...prices.values()].sort((left, right) => left.amountCents - right.amountCents),
    arrivalBuckets: [...buckets.values()].sort((left, right) => left.startUtc.localeCompare(right.startUtc)),
    effectiveEventIds, reversedEventIds: [...reversed], lastSequence,
  };
}

/** Computes a proposed closeout snapshot; B4 must atomically authorize and persist it. */
export function reconcileLedger(input: NightLedgerInput, events: readonly DoorEvent[], countedCashCents: number): ReconciliationProjection {
  assertNonnegativeInt(countedCashCents, 'countedCashCents');
  const projection = projectLedger(input, events);
  return {
    countedCashCents,
    expectedCoverCents: projection.expectedCoverCents,
    floatCents: input.openingFloatCents,
    expectedDrawerCents: projection.expectedDrawerCents,
    varianceCents: countedCashCents - projection.expectedDrawerCents,
  };
}
