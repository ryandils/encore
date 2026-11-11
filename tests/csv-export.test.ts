import { describe, expect, it } from 'vitest';
import { formatNightCsv } from '../src/domain/csv-export.ts';
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
