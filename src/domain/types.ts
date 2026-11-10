/** Domain IDs use canonical lowercase UUIDs; auth-library user IDs are opaque strings. */
export interface NightLedgerInput {
  readonly nightId: string;
  readonly venueId: string;
  readonly startingOccupancy: number;
  readonly openingFloatCents: number;
  readonly capacity: number;
  readonly timezone: string;
  readonly currency: 'USD';
}

interface EventIdentity {
  readonly id: string;
  readonly venueId: string;
  readonly nightId: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly sequence: number;
  readonly recordedAt: string;
}

export interface AdmissionEvent extends EventIdentity {
  readonly type: 'ADMISSION';
  readonly amountCents: number;
  readonly targetEventId?: never;
  readonly reason?: never;
}

export interface ExitEvent extends EventIdentity {
  readonly type: 'EXIT';
  readonly amountCents: 0;
  readonly targetEventId?: never;
  readonly reason?: never;
}

export interface ReversalEvent extends EventIdentity {
  readonly type: 'REVERSAL';
  readonly amountCents: 0;
  readonly targetEventId: string;
  readonly reason: string;
}

export type DoorEvent = AdmissionEvent | ExitEvent | ReversalEvent;

export interface AdmissionPriceTotal {
  readonly amountCents: number;
  readonly count: number;
  readonly totalCents: number;
}

export interface ArrivalBucket {
  /** UTC instant identifies repeated local quarter-hours unambiguously. */
  readonly startUtc: string;
  readonly label: string;
  readonly offset: string;
  readonly entries: number;
}

export interface LedgerProjection {
  readonly entries: number;
  readonly paidAdmissions: number;
  readonly freeAdmissions: number;
  readonly exits: number;
  readonly occupancy: number;
  readonly peakOccupancy: number;
  readonly expectedCoverCents: number;
  readonly expectedDrawerCents: number;
  readonly capacityEquivalentTurns: number | null;
  readonly atOrAboveCapacity: boolean;
  readonly admissionsByPrice: readonly AdmissionPriceTotal[];
  readonly arrivalBuckets: readonly ArrivalBucket[];
  readonly effectiveEventIds: readonly string[];
  readonly reversedEventIds: readonly string[];
  readonly lastSequence: number;
}

export interface ReconciliationProjection {
  readonly countedCashCents: number;
  readonly expectedCoverCents: number;
  readonly floatCents: number;
  readonly expectedDrawerCents: number;
  readonly varianceCents: number;
}
