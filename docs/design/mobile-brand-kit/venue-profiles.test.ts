import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { appleMapsDirectionsUrl, renderVenueProfile, venues } from './venue-profiles.ts';

for (const venue of venues) {
  test(`${venue.name} includes the requested customer details and sample labels`, () => {
    const page = renderVenueProfile(`/venues/${venue.slug}`);
    assert.ok(page);
    assert.ok(page.includes(`<h1>${venue.name}<span>.</span></h1>`));
    assert.ok(page.includes(venue.address));
    assert.ok(page.includes('sample-bar-interior.svg'));
    assert.ok(page.includes('bar photo placeholder'));
    assert.ok(page.includes(`value="${venue.occupancy}" max="${venue.capacity}"`));
    assert.ok(page.includes('not live'));
    assert.ok(page.includes('does not change with door activity'));
    assert.ok(page.includes(`/discover.html#spot-${venue.slug}`));
    for (const [day, time] of venue.hours) assert.ok(page.includes(`<dt>${day}</dt><dd>${time}</dd>`));
    assert.equal(venue.hours.length, 7);
    assert.ok(venue.occupancy >= 0 && venue.occupancy <= venue.capacity);
    assert.doesNotMatch(page.replace('<script type="module" src="/discovery-client.js"></script>', ''), /<script|navigator\.geolocation|http-equiv="refresh"/);
  });
}

test('unknown or injected venue paths do not resolve', () => {
  for (const path of ['/venues/missing', '/venues/../.env', '/venues/<script>', '/venues/north-room/extra', '/discover.html']) {
    assert.equal(renderVenueProfile(path), undefined);
  }
});

test('feed cards and top search result use ordinary profile links', async () => {
  const page = await readFile(new URL('./discover.html', import.meta.url), 'utf8');
  for (const venue of venues) {
    assert.ok(page.includes(`id="spot-${venue.slug}"`));
    assert.ok(page.includes(`href="/venues/${venue.slug}"`));
  }
  assert.equal((page.match(/href="\/venues\/north-room"/g) ?? []).length, 2);
  assert.ok(page.includes('Sample occupancy'));
});

test('both header links have explicit mobile tap target heights', async () => {
  const css = await readFile(new URL('./venue-profile.css', import.meta.url), 'utf8');
  assert.match(css, /\.venue-header \.wordmark\s*\{[^}]*min-height:48px/);
  assert.match(css, /\.back-link\s*\{[^}]*min-height:48px/);
});

for (const venue of venues) {
  test(`${venue.name} address is an accessible, encoded Apple Maps directions link`, () => {
    const page = renderVenueProfile(`/venues/${venue.slug}`);
    assert.ok(page);
    const link = page.match(/<a class="address-link" href="([^"]+)"[^>]+>/);
    assert.ok(link);
    const url = new URL(link[1].replaceAll('&amp;', '&'));
    assert.equal(url.origin, 'https://maps.apple.com');
    assert.equal(url.pathname, '/directions');
    assert.equal(url.searchParams.get('destination'), venue.address);
    assert.deepEqual([...url.searchParams.keys()], ['destination']);
    assert.ok(link[0].includes(`aria-label="Get directions to ${venue.name} in Apple Maps`));
    assert.ok(link[0].includes('aria-describedby="maps-note"'));
    assert.ok(link[0].includes('rel="noopener noreferrer"'));
    assert.ok(page.includes('Get directions in Apple Maps'));
    assert.ok(page.includes('Fictional sample address. Apple Maps may not find it.'));
    assert.ok(page.includes('only when tapped'));
    assert.equal((page.match(/href="https:\/\//g) ?? []).length, 1);
  });
}

test('Maps destination encoding preserves punctuation and Unicode without adding parameters', () => {
  const address = '12 A&B Lane, Cafe \u00c9toile #3? source=private';
  const url = new URL(appleMapsDirectionsUrl(address));
  assert.equal(url.searchParams.get('destination'), address);
  assert.deepEqual([...url.searchParams.keys()], ['destination']);
  assert.equal(url.hash, '');
});

test('address has an explicit thumb-sized tap target', async () => {
  const css = await readFile(new URL('./venue-profile.css', import.meta.url), 'utf8');
  assert.match(css, /\.address-link\s*\{[^}]*min-height:56px/);
});

test('Discover replaces Main feed throughout the customer preview', async () => {
  const page = await readFile(new URL('./discover.html', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /main feed/i);
  assert.ok(page.includes('<span>Discover</span>'));
  assert.equal((page.match(/Choose Discover in the bottom bar/g) ?? []).length, 2);
});

test('top search is an accessible native disclosure containing the existing sample search', async () => {
  const page = await readFile(new URL('./discover.html', import.meta.url), 'utf8');
  const disclosure = page.match(/<details class="header-search">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(disclosure);
  assert.ok(disclosure.includes('<summary aria-label="Search bars"'));
  assert.ok(disclosure.includes('<svg aria-hidden="true"'));
  assert.ok(disclosure.includes('<label for="sample-search">Look up a bar</label>'));
  assert.ok(disclosure.includes('id="sample-search" type="search"'));
  assert.ok(disclosure.includes('aria-describedby="search-note"'));
  assert.ok(disclosure.includes('live search is not connected'));
  assert.ok(disclosure.includes('href="/venues/north-room"'));
  assert.equal((page.match(/id="sample-search"/g) ?? []).length, 1);
  assert.doesNotMatch(page.replace('<script type="module" src="/discovery-client.js"></script>', ''), /<script|navigator\.geolocation/);
});

test('search disclosure has phone-width bounds and a 48px native toggle', async () => {
  const css = await readFile(new URL('./discover.css', import.meta.url), 'utf8');
  assert.match(css, /\.header-search summary\s*\{[^}]*width:48px;[^}]*min-height:48px/);
  assert.match(css, /\.header-search-panel\s*\{[^}]*left:16px; right:16px/);
  assert.match(css, /\.header-search\[open\] \.search-sample\s*\{ display:block; \}/);
});

test('Discover has no location-state test controls and keeps a non-live sample area', async () => {
  const page = await readFile(new URL('./discover.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('./discover.css', import.meta.url), 'utf8');
  const client = await readFile(new URL('./discovery-client.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /Preview location state|Area set|>Denied<|>Manual search<|location-picker|area-state|denied-state|manual-state|location-denied|location-manual|manual-results/);
  assert.doesNotMatch(css, /location-picker|area-state|denied-state|manual-state|location-denied|location-manual|manual-results/);
  assert.ok(page.includes('Sample area: East Quarter'));
  assert.ok(page.includes('Sample distances from this area, not your device.'));
  assert.ok(page.includes('No live location or accounts.'));
  assert.ok(page.includes('Denied or unavailable permission returns to manual area search'));
  assert.ok(page.includes('<details class="header-search">'));
  assert.equal((page.match(/<article class="venue-card /g) ?? []).length, 3);
  assert.equal((page.match(/<fieldset\b/g) ?? []).length, (page.match(/<\/fieldset>/g) ?? []).length);
  assert.doesNotMatch(page + client, /navigator\.geolocation|getCurrentPosition|watchPosition/);
});