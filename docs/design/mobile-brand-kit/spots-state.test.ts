import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SPOTS_STORAGE_KEY, parseSpots, readSpots, saveSpots, toggleFavorite, recordVisit, tabIdForHash } from './spots-state.ts';
import type { SpotsState, SpotsStorage } from './spots-state.ts';
import { renderVenueProfile, venues } from './venue-profiles.ts';

const empty = (): SpotsState => ({ favorites: [], recents: [] });
class MemoryStorage implements SpotsStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('new browser storage begins with empty favorites and recents', () => {
  assert.deepEqual(readSpots(new MemoryStorage()), { state: empty(), available: true });
});

test('favorite toggles on/off without recording a visit or mutating its input', () => {
  const original = empty();
  const saved = toggleFavorite(original, 'north-room');
  assert.deepEqual(saved, { favorites: ['north-room'], recents: [] });
  assert.deepEqual(original, empty());
  assert.deepEqual(toggleFavorite(saved, 'north-room'), empty());
});

test('unknown venues are ignored', () => {
  assert.deepEqual(toggleFavorite(empty(), 'fake'), empty());
  assert.deepEqual(recordVisit(empty(), 'fake'), empty());
});

test('recent visits are unique and ordered most recent first', () => {
  let state = recordVisit(empty(), 'north-room');
  state = recordVisit(state, 'side-b');
  state = recordVisit(state, 'north-room');
  assert.deepEqual(state.recents, ['north-room', 'side-b']);
  assert.deepEqual(state.favorites, []);
});

test('favoriting, refreshing, then removing persists in the same storage', () => {
  const storage = new MemoryStorage();
  assert.equal(saveSpots(storage, toggleFavorite(empty(), 'side-b')), true);
  assert.deepEqual(readSpots(storage).state.favorites, ['side-b']);
  assert.equal(saveSpots(storage, toggleFavorite(readSpots(storage).state, 'side-b')), true);
  assert.deepEqual(readSpots(storage).state.favorites, []);
  assert.deepEqual([...storage.values.keys()], [SPOTS_STORAGE_KEY]);
});

test('recents survive refresh independently of favorites', () => {
  const storage = new MemoryStorage();
  const state = recordVisit(toggleFavorite(empty(), 'last-light'), 'north-room');
  saveSpots(storage, state);
  assert.deepEqual(readSpots(storage).state, { favorites: ['last-light'], recents: ['north-room'] });
});

test('corrupt, unexpected, and untrusted saved values are safely normalized', () => {
  for (const raw of [null, '', '{', 'null', 'false', '17']) assert.deepEqual(parseSpots(raw), empty());
  assert.deepEqual(parseSpots(JSON.stringify({ favorites: ['north-room', 'north-room', '<script>', 3], recents: ['side-b', 'last-light', 'side-b'], other: 'ignored' })), { favorites: ['north-room'], recents: ['side-b', 'last-light'] });
  assert.deepEqual(parseSpots('{"favorites":{},"recents":"north-room"}'), empty());
});

test('blocked storage reads and unavailable storage are reported', () => {
  const storage: SpotsStorage = { getItem() { throw new Error('Blocked'); }, setItem() {} };
  assert.deepEqual(readSpots(storage), { state: empty(), available: false });
  assert.deepEqual(readSpots(), { state: empty(), available: false });
});

test('blocked/quota-exceeded writes report failure while in-memory state is usable', () => {
  const storage: SpotsStorage = { getItem() { return null; }, setItem() { throw new Error('Quota'); } };
  const state = toggleFavorite(empty(), 'north-room');
  assert.equal(saveSpots(storage, state), false);
  assert.equal(saveSpots(undefined, state), false);
  assert.deepEqual(state.favorites, ['north-room']);
});

test('all four tabs and two empty states are present without requiring an account', async () => {
  const page = await readFile(new URL('./discover.html', import.meta.url), 'utf8');
  for (const [id, label] of [['feed-view', 'Discover'], ['spots-view', 'My Spots'], ['profile-view', 'Profile'], ['settings-view', 'Settings']]) {
    assert.ok(page.includes(`id="${id}"`));
    assert.ok(page.includes(`for="${id}"`));
    assert.ok(page.includes(`<span>${label}</span>`));
  }
  assert.ok(page.includes('data-spots-empty="favorites"'));
  assert.ok(page.includes('data-spots-empty="recents"'));
  assert.ok(page.includes('Favorites and recent views stay in this browser'));
  assert.equal((page.match(/src="\/discovery-client.js"/g) ?? []).length, 1);
});

test('profile favorite control has toggle semantics and My Spots navigation', () => {
  for (const venue of venues) {
    const page = renderVenueProfile(`/venues/${venue.slug}`)!;
    assert.ok(page.includes(`data-venue-slug="${venue.slug}"`));
    assert.ok(page.includes('data-favorite-toggle aria-pressed="false"'));
    assert.ok(page.includes('href="/discover.html#my-spots"'));
    assert.ok(page.includes('src="/discovery-client.js"'));
  }
});

test('mobile controls retain four columns and large tap targets', async () => {
  const css = await readFile(new URL('./discover.css', import.meta.url), 'utf8');
  const profile = await readFile(new URL('./venue-profile.css', import.meta.url), 'utf8');
  assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert.match(css, /\.remove-favorite\s*\{[^}]*min-height:48px/);
  assert.match(profile, /\.favorite-toggle\s*\{[^}]*min-height:56px/);
});

test('Discover bars clears My Spots selection while skip links preserve it', () => {
  let selected = tabIdForHash('#my-spots');
  assert.equal(selected, 'spots-view');
  selected = tabIdForHash('') ?? selected;
  assert.equal(selected, 'feed-view');
  selected = tabIdForHash('#my-spots') ?? selected;
  selected = tabIdForHash('#discovery-content') ?? selected;
  assert.equal(selected, 'spots-view');
  assert.equal(tabIdForHash('#discover'), 'feed-view');
  assert.equal(tabIdForHash('#profile'), 'profile-view');
  assert.equal(tabIdForHash('#settings'), 'settings-view');
  assert.equal(tabIdForHash('#unknown'), undefined);
});

test('saved spot keyboard focus stays inside the clipped card', async () => {
  const css = await readFile(new URL('./discover.css', import.meta.url), 'utf8');
  assert.match(css, /\.saved-spot-link:focus-visible\s*\{[^}]*outline:3px solid #00a1ff;[^}]*outline-offset:-4px/);
});
