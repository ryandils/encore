import { venues } from './venue-data.ts';
import { SPOTS_STORAGE_KEY, parseSpots, readSpots, saveSpots, toggleFavorite, recordVisit, tabIdForHash } from './spots-state.ts';
import type { SpotsState } from './spots-state.ts';

let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* Privacy settings can block storage. */ }
const initial = readSpots(storage);
let state = initial.state;
let persistent = initial.available;
const currentSlug = document.querySelector<HTMLElement>('[data-venue-slug]')?.dataset.venueSlug;
const favoriteButton = document.querySelector<HTMLButtonElement>('[data-favorite-toggle]');

function persist(next: SpotsState): void {
  state = next;
  persistent = saveSpots(storage, state);
  render();
}

function latestState(): SpotsState {
  if (!persistent) return state;
  const stored = readSpots(storage);
  if (!stored.available) { persistent = false; return state; }
  return stored.state;
}

function announce(message: string): void {
  const status = document.querySelector<HTMLElement>('[data-spots-status]');
  if (status) status.textContent = message;
}

function changeFavorite(slug: string): void {
  persist(toggleFavorite(latestState(), slug));
  const venue = venues.find((item) => item.slug === slug);
  const action = state.favorites.includes(slug) ? 'Added' : 'Removed';
  announce(`${action} ${venue?.name ?? 'bar'} ${action === 'Added' ? 'to' : 'from'} favorites${persistent ? ' in this browser.' : ' for this page only. Storage is unavailable.'}`);
}

function renderList(kind: 'favorites' | 'recents'): void {
  const list = document.querySelector<HTMLUListElement>(`[data-spots-list="${kind}"]`);
  if (!list) return;
  list.replaceChildren();
  for (const slug of state[kind]) {
    const venue = venues.find((item) => item.slug === slug);
    if (!venue) continue;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/venues/${venue.slug}`;
    link.className = 'saved-spot-link';
    const name = document.createElement('strong');
    name.textContent = venue.name;
    const detail = document.createElement('span');
    detail.textContent = `${venue.category} · Fictional venue`;
    link.append(name, detail);
    item.append(link);
    if (kind === 'favorites') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-favorite';
      remove.textContent = '♥';
      remove.setAttribute('aria-label', `Remove ${venue.name} from favorites`);
      remove.addEventListener('click', () => {
        changeFavorite(slug);
        const remaining = document.querySelector<HTMLButtonElement>('[data-spots-list="favorites"] button');
        (remaining ?? document.querySelector<HTMLElement>('#favorites-heading'))?.focus();
      });
      item.append(remove);
    }
    list.append(item);
  }
  const empty = document.querySelector<HTMLElement>(`[data-spots-empty="${kind}"]`);
  if (empty) empty.hidden = state[kind].length > 0;
  const count = document.querySelector<HTMLElement>(`[data-spots-count="${kind}"]`);
  if (count) count.textContent = String(state[kind].length);
}

function render(): void {
  document.querySelectorAll<HTMLElement>('[data-storage-note]').forEach((note) => {
    note.textContent = persistent
      ? 'Saved only in this browser on this device. No account or syncing. Clearing browser data removes your list.'
      : 'Browser storage is unavailable. Favorites work on this page only and will not survive refresh or navigation.';
    note.classList.toggle('storage-warning', !persistent);
  });
  if (favoriteButton && currentSlug) {
    const saved = state.favorites.includes(currentSlug);
    const venue = venues.find((item) => item.slug === currentSlug);
    favoriteButton.disabled = false;
    favoriteButton.setAttribute('aria-pressed', String(saved));
    favoriteButton.setAttribute('aria-label', `${saved ? 'Remove' : 'Add'} ${venue?.name ?? 'bar'} ${saved ? 'from' : 'to'} favorites`);
    const icon = favoriteButton.querySelector('[data-favorite-icon]');
    const label = favoriteButton.querySelector('[data-favorite-label]');
    if (icon) icon.textContent = saved ? '♥' : '♡';
    if (label) label.textContent = saved ? 'Saved to favorites' : 'Add to favorites';
  }
  renderList('favorites');
  renderList('recents');
}

favoriteButton?.addEventListener('click', () => { if (currentSlug) changeFavorite(currentSlug); });
window.addEventListener('storage', (event) => {
  if (event.storageArea === storage && (event.key === SPOTS_STORAGE_KEY || event.key === null)) {
    state = parseSpots(event.key === null ? null : event.newValue);
    persistent = true;
    render();
  }
});
window.addEventListener('pageshow', () => {
  if (!persistent) return;
  const stored = readSpots(storage);
  state = stored.state;
  persistent = stored.available;
  if (currentSlug) persist(recordVisit(state, currentSlug));
  else render();
});

const tabHashes: Record<string, string> = { 'feed-view': '#discover', 'spots-view': '#my-spots', 'profile-view': '#profile', 'settings-view': '#settings' };
function selectHashTab(): void {
  const id = tabIdForHash(location.hash);
  const radio = id ? document.getElementById(id) : null;
  if (radio instanceof HTMLInputElement) radio.checked = true;
}
document.querySelectorAll<HTMLInputElement>('.view-input').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked && tabHashes[radio.id]) history.replaceState(null, '', tabHashes[radio.id]);
  });
});
window.addEventListener('hashchange', selectHashTab);
selectHashTab();
if (currentSlug) persist(recordVisit(state, currentSlug));
else render();
