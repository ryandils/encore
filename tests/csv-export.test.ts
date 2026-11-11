import { describe, expect, it } from 'vitest';
import { formatNightCsv } from '../src/domain/csv-export.ts';
import type { DoorEvent } from '../src/domain/types.ts';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';

function fixtures() {
  const fixture = createLedgerFixtures();
  const reconciliation = fixture.closedSummary.reconciliation;
  if (!reconciliation) throw new Error('Expected the closed ledger fixture.');
  return { ...fixture, closedSummary: { ...fixture.closedSummary, reconciliation } };
}

/** Independent reader for quoted CSV, including embedded CRLF and doubled quotes. */
function readCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && char === '\r' && csv[index + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; index++; }
    else field += char;
  }
  expect(quoted).toBe(false);
  expect(field).toBe('');
  return rows;
}

describe('night CSV formatter', () => {
  it('round trips the existing columns, original prices and signed integer cents', () => {
    const fixture = fixtures();
    const summary = { ...fixture.closedSummary, night: { ...fixture.closedSummary.night, label: 'Friday, "late"\r\nnight' },
      reconciliation: { ...fixture.closedSummary.reconciliation, notes: 'Two, "quoted"\nlines\r\nand more' } };
    const rows = readCsv(formatNightCsv(summary, fixture.events, { synthetic: true }));
    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.length === 16)).toBe(true);
    expect(rows[0]).toEqual(['synthetic', 'recordType', 'nightId', 'nightLabel', 'id', 'sequence', 'type', 'amountCents', 'actorId', 'recordedAt', 'countedCashCents', 'expectedCoverCents', 'floatCents', 'expectedDrawerCents', 'varianceCents', 'notes']);
    expect(rows[1][3]).toBe(summary.night.label);
    expect(rows[1][7]).toBe('1000');
    expect(rows[6][7]).toBe('1500');
    expect(rows[7].slice(10, 15)).toEqual(['15000', '5500', '10000', '15500', '-500']);
    expect(rows[7][15]).toBe(summary.reconciliation.notes);
    expect(rows[7][0]).toBe('true');
  });

  it.each(['=SUM(A1:A2)', '+1+2', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1', ' \ttext', '\u0000=1+1', '\u0001@SUM(A1)', ' \u0000\t+1'])('neutralizes spreadsheet input %j in every untrusted exported field', (text) => {
    const fixture = fixtures();
    const summary = { ...fixture.closedSummary, night: { ...fixture.night, label: text },
      reconciliation: { ...fixture.closedSummary.reconciliation, closedBy: text, notes: text } };
    const events = fixture.events.map((event) => ({ ...event, actorId: text }));
    const rows = readCsv(formatNightCsv(summary, events, { synthetic: false }));
    expect(rows[1][3]).toBe(`'${text}`);
    expect(rows[1][8]).toBe(`'${text}`);
    expect(rows[7][8]).toBe(`'${text}`);
    expect(rows[7][15]).toBe(`'${text}`);
    expect(rows[1][0]).toBe('false');
    expect(rows[7][14]).toBe('-500');
  });

  it('preserves ordinary punctuation, Unicode and existing apostrophes', () => {
    const fixture = fixtures();
    for (const notes of ['Café 🍷 — paid', "'=already neutralized", 'Shortfall -5', '']) {
      const summary = { ...fixture.closedSummary, reconciliation: { ...fixture.closedSummary.reconciliation, notes } };
      expect(readCsv(formatNightCsv(summary, fixture.events, { synthetic: true }))[7][15]).toBe(notes);
    }
  });

  it('adds full audit identities and reversal context without changing the default columns', () => {
    const fixture = fixtures();
    const requestId = '00000000-0000-4000-8000-000000000901';
    const reversal: DoorEvent = { id: '00000000-0000-4000-8000-000000000902', requestId: '00000000-0000-4000-8000-000000000903',
      venueId: fixture.venue.id, nightId: fixture.night.id, actorId: 'Synthetic correcting owner', sequence: 7,
      type: 'REVERSAL', amountCents: 0, targetEventId: fixture.events[0].id, reason: '=SUM(A1), "reason"\r\nsecond line', recordedAt: '2026-11-11T02:06:00.000Z' };
    const events = [...fixture.events, reversal];
    const summary = { ...fixture.closedSummary, night: { ...fixture.closedSummary.night, version: 8 },
      reconciliation: { ...fixture.closedSummary.reconciliation, countedCashCents: 14000, expectedCoverCents: 4500, expectedDrawerCents: 14500 } };
    const rows = readCsv(formatNightCsv(summary, events, { synthetic: true, audit: true, reconciliationRequestId: requestId }));
    expect(rows).toHaveLength(10); expect(rows.every((row) => row.length === 25)).toBe(true);
    expect(rows[0].slice(16, 20)).toEqual(['venueId', 'requestId', 'targetEventId', 'reason']);
    expect(rows[0].slice(20)).toEqual(['startingOccupancy', 'openingFloatCents', 'timezone', 'capacity', 'currency']);
    const original = rows.find((row) => row[4] === fixture.events[0].id);
    const correction = rows.find((row) => row[4] === reversal.id);
    const closed = rows.find((row) => row[1] === 'reconciliation');
    const snapshot = rows.find((row) => row[1] === 'night');
    expect(original?.slice(16, 20)).toEqual([fixture.venue.id, fixture.events[0].requestId, '', '']);
    expect(correction?.slice(16, 20)).toEqual([fixture.venue.id, reversal.requestId, reversal.targetEventId, `'${reversal.reason}`]);
    expect(closed?.slice(16, 20)).toEqual([fixture.venue.id, requestId, '', '']);
    expect(closed?.[14]).toBe('-500');
    expect(snapshot?.slice(20)).toEqual(['0', '10000', fixture.night.timezone, '100', 'USD']);
    expect(snapshot?.[6]).toBe('CLOSED'); expect(snapshot?.[9]).toBe(fixture.night.openedAt);
    expect(readCsv(formatNightCsv(summary, events, { synthetic: true })).every((row) => row.length === 16)).toBe(true);
  });

  it.each(['@SUM(A1)', '\t=1+1', ' \u0000+1', '-not-a-number'])('neutralizes audit correction reasons %j while preserving numeric cents', (reason) => {
    const fixture = fixtures();
    const reversal: DoorEvent = { id: '00000000-0000-4000-8000-000000000902', requestId: '00000000-0000-4000-8000-000000000903',
      venueId: fixture.venue.id, nightId: fixture.night.id, actorId: 'Synthetic owner', sequence: 7, type: 'REVERSAL', amountCents: 0,
      targetEventId: fixture.events[0].id, reason, recordedAt: '2026-11-11T02:06:00.000Z' };
    const rows = readCsv(formatNightCsv(fixture.closedSummary, [...fixture.events, reversal], { synthetic: false, audit: true }));
    const correction = rows.find((row) => row[4] === reversal.id);
    expect(correction?.[19]).toBe(`'${reason}`); expect(correction?.[7]).toBe('0'); expect(rows.find((row) => row[1] === 'reconciliation')?.[14]).toBe('-500');
  });

  it('exports an empty open night snapshot without inventing events or closeout', () => {
    const fixture = fixtures(); const rows = readCsv(formatNightCsv(fixture.summary, [], { synthetic: true, audit: true }));
    expect(rows).toHaveLength(2); expect(rows[1][1]).toBe('night'); expect(rows[1][6]).toBe('OPEN');
    expect(rows[1].slice(20)).toEqual(['0', '10000', fixture.night.timezone, '100', 'USD']);
    expect(rows[1][0]).toBe('true');
  });

  it('rejects a malformed reconciliation request ID in an audit export', () => {
    const fixture = fixtures();
    expect(() => formatNightCsv(fixture.closedSummary, fixture.events, { synthetic: true, audit: true, reconciliationRequestId: '=not-a-uuid' })).toThrow();
  });

  it('exports an open empty night as a header without inventing a reconciliation', () => {
    const fixture = fixtures();
    expect(readCsv(formatNightCsv(fixture.summary, [], { synthetic: true }))).toHaveLength(1);
  });

  it('rejects events outside the exported night or venue', () => {
    const fixture = fixtures();
    for (const field of ['nightId', 'venueId'] as const) {
      const events = fixture.events.map((event, index) => index === 0 ? { ...event, [field]: '00000000-0000-4000-8000-000000000999' } : event);
      expect(() => formatNightCsv(fixture.closedSummary, events, { synthetic: true })).toThrow();
    }
  });

  it('rejects invalid history and nonfinite reconciliation numbers', () => {
    const fixture = fixtures();
    expect(() => formatNightCsv(fixture.summary, [fixture.events[4]], { synthetic: true })).toThrow();
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      const summary = { ...fixture.closedSummary, reconciliation: { ...fixture.closedSummary.reconciliation, varianceCents: value } };
      expect(() => formatNightCsv(summary, fixture.events, { synthetic: true })).toThrow();
    }
  });
});
