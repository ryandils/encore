import type { DoorEvent, NightLedgerInput } from './types.ts';

export const INT32_MAX = 2_147_483_647;

export class DomainValidationError extends Error {
  readonly code: 'VALIDATION' | 'INVALID_HISTORY' | 'OVERFLOW';

  constructor(message: string, code: 'VALIDATION' | 'INVALID_HISTORY' | 'OVERFLOW' = 'VALIDATION') {
    super(message);
    this.name = 'DomainValidationError';
    this.code = code;
  }
}

export function assertNonnegativeInt(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > INT32_MAX) {
    throw new DomainValidationError(`${field} must be an integer from 0 to ${INT32_MAX}.`);
  }
}

export function assertNonemptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainValidationError(`${field} must be a nonempty string.`);
  }
}

export function assertUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new DomainValidationError(`${field} must be a canonical lowercase UUID.`);
  }
}

export function assertUtcTimestamp(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new DomainValidationError(`${field} must be an ISO UTC timestamp with seconds and optional milliseconds.`);
  }
  const time = Date.parse(value);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(time) || new Date(time).toISOString() !== canonical) {
    throw new DomainValidationError(`${field} must be a valid UTC date.`);
  }
}

export function assertTimezone(value: unknown, field: string): asserts value is string {
  assertNonemptyString(value, field);
  // Intl also accepts fixed offsets; require a named timezone for venue DST rules.
  if (/^[+-]/.test(value)) throw new DomainValidationError(`${field} must be a named IANA timezone.`);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
  } catch {
    throw new DomainValidationError(`${field} must be a valid IANA timezone.`);
  }
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainValidationError('Expected a record.');
  }
}

export function validateNightLedgerInput(value: unknown): asserts value is NightLedgerInput {
  assertRecord(value);
  assertUuid(value.nightId, 'nightId');
  assertUuid(value.venueId, 'venueId');
  assertNonnegativeInt(value.startingOccupancy, 'startingOccupancy');
  assertNonnegativeInt(value.openingFloatCents, 'openingFloatCents');
  assertNonnegativeInt(value.capacity, 'capacity');
  assertTimezone(value.timezone, 'timezone');
  if (value.currency !== 'USD') throw new DomainValidationError('Only USD is supported.');
}

export function validateDoorEvent(value: unknown): asserts value is DoorEvent {
  assertRecord(value);
  for (const field of ['id', 'venueId', 'nightId', 'requestId']) assertUuid(value[field], field);
  assertNonemptyString(value.actorId, 'actorId');
  assertNonnegativeInt(value.sequence, 'sequence');
  if (value.sequence === 0) throw new DomainValidationError('sequence must be positive.');
  assertUtcTimestamp(value.recordedAt, 'recordedAt');
  assertNonnegativeInt(value.amountCents, 'amountCents');
  if (typeof value.type !== 'string' || !['ADMISSION', 'EXIT', 'REVERSAL'].includes(value.type)) {
    throw new DomainValidationError('Unknown door event type.');
  }
  if (value.type !== 'ADMISSION' && value.amountCents !== 0) {
    throw new DomainValidationError('Exits and reversals must have zero amountCents.');
  }
  if (value.type === 'REVERSAL') {
    assertUuid(value.targetEventId, 'targetEventId');
    assertNonemptyString(value.reason, 'reason');
  } else if (value.targetEventId !== undefined || value.reason !== undefined) {
    throw new DomainValidationError('Only reversals have a targetEventId and reason.');
  }
}
