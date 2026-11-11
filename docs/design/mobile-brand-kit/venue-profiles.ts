import { venues } from './venue-data.ts';
export { venues } from './venue-data.ts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function appleMapsDirectionsUrl(address: string): string {
  return 'https://maps.apple.com/directions?destination=' + encodeURIComponent(address);
}

export function renderVenueProfile(path: string): string | undefined {
  const venue = venues.find((item) => path === `/venues/${item.slug}`);
  if (!venue) return undefined;
  const name = escapeHtml(venue.name);
  const percent = Math.round(venue.occupancy / venue.capacity * 100);
  const hours = venue.hours.map(([day, time]) => `<div><dt>${day}</dt><dd>${time}</dd></div>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><title>${name} | Encore sample profile</title><link rel="icon" href="/assets/encore-mark.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/discover.css"><link rel="stylesheet" href="/venue-profile.css"></head>
<body class="discovery venue-profile"><a class="skip" href="#venue-content">Skip to venue details</a><div class="discovery-shell">
<header class="venue-header"><a class="back-link" href="/discover.html#spot-${venue.slug}"><span aria-hidden="true">&larr;</span> All spots</a><a class="wordmark" href="/discover.html" aria-label="Encore discovery">encore<span>.</span></a></header>
<p class="discovery-disclaimer">Fictional venue. Sample details and occupancy, not live.</p>
<main id="venue-content" data-venue-slug="${venue.slug}"><figure class="venue-hero"><img src="/assets/sample-bar-interior.svg" alt="Illustrated bar interior used as a placeholder, not a photo of ${name}" width="960" height="640"><figcaption>Sample image &middot; bar photo placeholder</figcaption></figure>
<div class="venue-heading"><p class="eyebrow">${escapeHtml(venue.category)} &middot; East Quarter</p><h1>${name}<span>.</span></h1><p>${escapeHtml(venue.description)}</p></div>
<div class="favorite-actions"><button type="button" class="favorite-toggle" data-favorite-toggle aria-pressed="false" disabled><span data-favorite-icon aria-hidden="true">&#9825;</span><span data-favorite-label>Add to favorites</span></button><a class="my-spots-link" href="/discover.html#my-spots">View My Spots &rarr;</a></div><p class="fine storage-note" data-storage-note>Favorites and recent views stay in this browser on this device. No account or syncing.</p><p class="visually-hidden" data-spots-status role="status" aria-live="polite"></p><noscript><p class="fine">Enable JavaScript to use local favorites and recents.</p></noscript>
<section class="occupancy-card" aria-labelledby="occupancy-heading"><div class="section-heading"><h2 id="occupancy-heading">Occupancy</h2><span class="sample-tag">SAMPLE</span></div><p class="occupancy-total"><strong>${venue.occupancy}</strong><span> / ${venue.capacity} people</span></p><progress value="${venue.occupancy}" max="${venue.capacity}" aria-label="Sample occupancy: ${venue.occupancy} of ${venue.capacity} people">${percent}%</progress><div class="occupancy-caption"><strong>${percent}% of sample capacity</strong><span>Fixed example</span></div><p class="fine">This count is made up for the preview. It is not live, does not change with door activity, and does not guarantee entry.</p></section>
<section class="venue-section" aria-labelledby="address-heading"><div class="section-heading"><h2 id="address-heading">Address</h2><span class="sample-tag">SAMPLE</span></div><address><a class="address-link" href="${escapeHtml(appleMapsDirectionsUrl(venue.address))}" target="_blank" rel="noopener noreferrer" aria-label="Get directions to ${name} in Apple Maps (sample address; opens separately)" aria-describedby="maps-note"><span>${escapeHtml(venue.address)}</span><span class="maps-action">Get directions in Apple Maps <span aria-hidden="true">&nearr;</span></span></a></address><p class="fine" id="maps-note">Fictional sample address. Apple Maps may not find it. Opens Maps or its website only when tapped; this preview does not request your location.</p></section>
<section class="venue-section" aria-labelledby="hours-heading"><div class="section-heading"><h2 id="hours-heading">Hours</h2><span class="sample-tag">SAMPLE</span></div><dl class="venue-hours">${hours}</dl><p class="fine">Illustrative local hours. Closing times after midnight are the next day. These are not verified opening hours.</p></section>
<a class="return-action" href="/discover.html#spot-${venue.slug}">Back to all spots</a><p class="profile-endnote">Customer view concept. Owner editing, real photos, verified hours, and shared occupancy are not connected yet.</p></main><nav class="bottom-navigation" aria-label="Discovery navigation"><a href="/discover.html#discover" aria-current="location"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg><span>Discover</span></a><a href="/discover.html#my-spots"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg><span>My Spots</span></a><a href="/discover.html#profile"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span>Profile</span></a><a href="/discover.html#settings"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 3v18M12 3v18M20 3v18M1 8h6M9 16h6M17 9h6"/></svg><span>Settings</span></a></nav></div><script type="module" src="/discovery-client.js"></script></body></html>`;
}
