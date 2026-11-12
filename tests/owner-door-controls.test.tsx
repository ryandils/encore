import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerDoorControls } from '../src/features/owner/owner-door-controls';
import { createOwnerFixture, configureVenue, openFixtureNight, recordFixtureEvent, closeFixtureNight } from '../src/features/owner/fixture-model';
import { createLedgerFixtures } from '../src/domain/fixtures';
const commands = createLedgerFixtures().commands;
const opened = () => openFixtureNight(configureVenue(createOwnerFixture(), { ...commands.createVenue, capacity: 1 }), commands.openNight);
const render = (state = opened(), blocked = false) => renderToStaticMarkup(<OwnerDoorControls state={state} presets={state.presets.slice(0, 1)} blocked={blocked} onRecord={() => {}} />);

it('places exit before entry, offers saved prices and free entry, and prevents exit at zero', () => {
  const html = render();
  expect(html.indexOf('− Exit')).toBeLessThan(html.indexOf('+ Entry'));
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Record one person exiting"/);
  expect(html).toMatch(/<button(?![^>]*disabled)[^>]*aria-label="Record one person entering"/);
  expect(html).toContain('Free entry');
  expect(html).not.toContain('value="2"');
  expect(html).toContain('Practice only');
});
it('disables entry and exit before opening, during close confirmation, and after closing', () => {
  for (const html of [render(createOwnerFixture()), render(opened(), true), render(closeFixtureNight(opened(), commands.close))]) {
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  }
});
it('records single people with immutable cash, rejects negative occupancy, and preserves capacity warnings', () => {
  const empty = opened();
  expect(() => recordFixtureEvent(empty, 'EXIT')).toThrow();
  const entered = recordFixtureEvent(empty, 'ADMISSION', 1);
  expect(entered.active?.summary.projection).toMatchObject({ occupancy: 1, entries: 1, expectedCoverCents: 500, atOrAboveCapacity: true });
  const above = recordFixtureEvent(entered, 'ADMISSION');
  expect(above.active?.summary.projection).toMatchObject({ occupancy: 2, expectedCoverCents: 500, atOrAboveCapacity: true });
  const exited = recordFixtureEvent(above, 'EXIT');
  expect(exited.active?.summary.projection).toMatchObject({ occupancy: 1, exits: 1, expectedCoverCents: 500 });
  const closed = closeFixtureNight(exited, commands.close);
  expect(() => recordFixtureEvent(closed, 'ADMISSION', 1)).toThrow();
  expect(() => recordFixtureEvent(closed, 'EXIT')).toThrow();
});
