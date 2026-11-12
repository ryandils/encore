import { createLedgerFixtures } from '../../domain/fixtures.ts';
import { configureVenue, createOwnerFixture, openFixtureNight, recordFixtureEvent, updateFixturePresets } from './fixture-model.ts';

/** The canonical five-admission scenario, isolated in page memory. */
export function createSampleOwnerNight() {
  const { commands } = createLedgerFixtures();
  let state = configureVenue(createOwnerFixture(), commands.createVenue);
  state = openFixtureNight(state, commands.openNight, '2026-11-11T02:00:00.000Z');
  for (let index = 0; index < 4; index += 1) {
    state = recordFixtureEvent(state, 'ADMISSION', 2, `2026-11-11T02:0${index}:00.000Z`);
  }
  state = recordFixtureEvent(state, 'EXIT', undefined, '2026-11-11T02:04:00.000Z');
  state = updateFixturePresets(state, commands.updatePresets);
  return recordFixtureEvent(state, 'ADMISSION', 2, '2026-11-11T02:16:00.000Z');
}