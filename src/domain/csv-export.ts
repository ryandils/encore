import type { OwnerSummary } from './contracts.ts';
import { projectLedger } from './ledger.ts';
import type { DoorEvent } from './types.ts';
import { assertNonemptyString, assertNonnegativeInt, assertUtcTimestamp, assertUuid, DomainValidationError, INT32_MAX } from './validation.ts';

type CsvSummary = Pick<OwnerSummary, 'night' | 'openingFloatCents' | 'reconciliation'>;
function formulaPrefix(text: string): boolean {
  for (const char of text) {
    if (char.charCodeAt(0) < 32) return true;
    if (char.trim() !== '') return '=+-@'.includes(char);
  }
  return false;
}
function cell(value: string | number): string {
  const text = String(value);
  // Spreadsheet importers may discard whitespace/control prefixes before interpreting formulas.
  const safe = typeof value === 'string' && formulaPrefix(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Formatting only: callers authorize access and supply a coherent, server-owned snapshot.
 * Defaults to the fixture's 16 columns. Audit mode adds a night snapshot row plus
 * original request/correction references and five baseline fields (25 columns).
 */
export function formatNightCsv(summary: CsvSummary, events: readonly DoorEvent[], options: { readonly synthetic: boolean; readonly audit?: boolean; readonly reconciliationRequestId?: string }): string {
  const { night, reconciliation } = summary;
  if (options.reconciliationRequestId !== undefined) assertUuid(options.reconciliationRequestId, 'reconciliationRequestId');
  assertNonemptyString(night.label, 'night label');
  projectLedger({ nightId: night.id, venueId: night.venueId, startingOccupancy: night.startingOccupancy,
    openingFloatCents: summary.openingFloatCents, capacity: night.capacity, timezone: night.timezone, currency: night.currency }, events);
  if (reconciliation) {
    for (const key of ['countedCashCents', 'expectedCoverCents', 'floatCents', 'expectedDrawerCents'] as const) assertNonnegativeInt(reconciliation[key], key);
    if (!Number.isInteger(reconciliation.varianceCents) || Math.abs(reconciliation.varianceCents) > INT32_MAX) throw new DomainValidationError('varianceCents must be a signed 32-bit money value.');
    assertNonemptyString(reconciliation.closedBy, 'closedBy');
    assertUtcTimestamp(reconciliation.closedAt, 'closedAt');
    if (typeof reconciliation.notes !== 'string') throw new DomainValidationError('notes must be a string.');
  }
  const synthetic = options.synthetic ? 'true' : 'false';
  const rows: (string | number)[][] = [
    ['synthetic', 'recordType', 'nightId', 'nightLabel', 'id', 'sequence', 'type', 'amountCents', 'actorId', 'recordedAt', 'countedCashCents', 'expectedCoverCents', 'floatCents', 'expectedDrawerCents', 'varianceCents', 'notes'],
    ...events.map((event): (string | number)[] => [synthetic, 'event', event.nightId, night.label, event.id, event.sequence, event.type, event.amountCents, event.actorId, event.recordedAt, '', '', '', '', '', '']),
  ];
  if (reconciliation) {
    const r = reconciliation;
    rows.push([synthetic, 'reconciliation', night.id, night.label, '', '', '', '', r.closedBy, r.closedAt, r.countedCashCents, r.expectedCoverCents, r.floatCents, r.expectedDrawerCents, r.varianceCents, r.notes]);
  }
  if (options.audit) {
    rows[0].push('venueId', 'requestId', 'targetEventId', 'reason', 'startingOccupancy', 'openingFloatCents', 'timezone', 'capacity', 'currency');
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      rows[index + 1].push(event.venueId, event.requestId, event.type === 'REVERSAL' ? event.targetEventId : '', event.type === 'REVERSAL' ? event.reason : '', '', '', '', '', '');
    }
    if (reconciliation) rows.at(-1)?.push(night.venueId, options.reconciliationRequestId ?? '', '', '', '', '', '', '', '');
    rows.splice(1, 0, [synthetic, 'night', night.id, night.label, night.id, '', night.status, '', '', night.openedAt, '', '', '', '', '', '',
      night.venueId, '', '', '', night.startingOccupancy, summary.openingFloatCents, night.timezone, night.capacity, night.currency]);
  }
  return `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
