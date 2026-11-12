import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerTonight } from '../src/features/owner/owner-tonight';
import { createSampleOwnerNight } from '../src/features/owner/sample-owner-night';
import { closeFixtureNight, createOwnerFixture, recordFixtureEvent } from '../src/features/owner/fixture-model';

describe('owner Tonight dashboard', () => {
  it('keeps a new venue empty rather than presenting fixture totals as real activity', () => {
    const html = renderToStaticMarkup(<OwnerTonight state={createOwnerFixture()} onLoadSample={() => {}} onReviewCurrentNight={() => {}} />);
    expect(html).toContain('Not open');
    expect(html).toContain('Try it with sample numbers');
    expect(html).not.toContain('$55.00');
    expect(html).toContain('href="#setup"');
  });
  it('loads the shared acceptance scenario and updates from the same fixture ledger', () => {
    const state = createSampleOwnerNight();
    expect(state.active?.summary.projection).toMatchObject({ occupancy: 4, entries: 5, exits: 1, peakOccupancy: 4, expectedCoverCents: 5500, expectedDrawerCents: 15500 });
    expect(state.active?.events.filter(event => event.type === 'ADMISSION').map(event => event.amountCents)).toEqual([1000, 1000, 1000, 1000, 1500]);
    const next = recordFixtureEvent(state, 'EXIT');
    expect(next.active?.summary.projection).toMatchObject({ occupancy: 3, expectedCoverCents: 5500 });
    const html = renderToStaticMarkup(<OwnerTonight state={next} onLoadSample={() => {}} onReviewCurrentNight={() => {}} />);
    expect(html).toContain('$55.00');
    expect(html).toContain('$155.00');
    expect(html).toContain('Try adding an entry');
    expect(html).toContain('View current totals');
    expect(html).toContain('href="#summary"');
    expect(html).not.toContain('Try it with sample numbers');
  });
  it('shows review guidance after close instead of asking for more admissions', () => {
    const closed = closeFixtureNight(createSampleOwnerNight(), { requestId: crypto.randomUUID(), countedCashCents: 15000, notes: 'Synthetic test' });
    const html = renderToStaticMarkup(<OwnerTonight state={closed} onLoadSample={() => {}} onReviewCurrentNight={() => {}} />);
    expect(html).toContain('Closed');
    expect(html).toContain('View final totals');
    expect(html).not.toContain('Try adding an entry');
  });
});