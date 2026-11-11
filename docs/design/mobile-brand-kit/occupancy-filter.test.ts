import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOccupancy } from './occupancy-filter.ts';
import { venues } from './venue-data.ts';

test('sample occupancy filters select the expected venues', () => {
  const selected = (filter: string) => venues.filter(v => matchesOccupancy(v.occupancy, v.capacity, filter)).map(v => v.slug);
  assert.deepEqual(selected('all'), ['north-room', 'side-b', 'last-light']);
  assert.deepEqual(selected('quiet'), ['side-b']);
  assert.deepEqual(selected('moderate'), ['north-room']);
  assert.deepEqual(selected('busy'), ['last-light']);
});
test('occupancy ranges have exact non-overlapping boundaries', () => {
  for (const [occupancy, expected] of [[0, 'quiet'], [49, 'quiet'], [50, 'moderate'], [79, 'moderate'], [80, 'busy'], [100, 'busy'], [110, 'busy']] as const) {
    assert.deepEqual(['quiet', 'moderate', 'busy'].filter(filter => matchesOccupancy(occupancy, 100, filter)), [expected]);
  }
});
test('unknown capacity and invalid counts never imply quiet availability', () => {
  for (const [occupancy, capacity] of [[0, 0], [-1, 100], [NaN, 100], [5, Infinity]]) {
    assert.equal(matchesOccupancy(occupancy, capacity, 'quiet'), false);
    assert.equal(matchesOccupancy(occupancy, capacity, 'all'), true);
  }
  assert.equal(matchesOccupancy(50, 100, 'unknown'), false);
});