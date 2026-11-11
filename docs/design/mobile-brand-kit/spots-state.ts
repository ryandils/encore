import { venues } from './venue-data.ts';

export const SPOTS_STORAGE_KEY = 'encore.discovery.spots.v1';
export interface SpotsState { favorites: string[]; recents: string[]; }
export interface SpotsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const knownSlugs = new Set(venues.map((venue) => venue.slug));
const emptyState = (): SpotsState => ({ favorites: [], recents: [] });

function knownList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((slug): slug is string => typeof slug === 'string' && knownSlugs.has(slug)))].slice(0, 10);
}

export function parseSpots(raw: string | null): SpotsState {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return emptyState();
    const data = value as Record<string, unknown>;
    return { favorites: knownList(data.favorites), recents: knownList(data.recents) };
  } catch { return emptyState(); }
}

export function readSpots(storage?: SpotsStorage): { state: SpotsState; available: boolean } {
  if (!storage) return { state: emptyState(), available: false };
  try { return { state: parseSpots(storage.getItem(SPOTS_STORAGE_KEY)), available: true }; }
  catch { return { state: emptyState(), available: false }; }
}

export function saveSpots(storage: SpotsStorage | undefined, state: SpotsState): boolean {
  if (!storage) return false;
  try { storage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function toggleFavorite(state: SpotsState, slug: string): SpotsState {
  if (!knownSlugs.has(slug)) return state;
  const favorites = state.favorites.includes(slug) ? state.favorites.filter((item) => item !== slug) : [slug, ...state.favorites];
  return { favorites, recents: [...state.recents] };
}

export function recordVisit(state: SpotsState, slug: string): SpotsState {
  if (!knownSlugs.has(slug)) return state;
  return { favorites: [...state.favorites], recents: [slug, ...state.recents.filter((item) => item !== slug)].slice(0, 10) };
}

/** Empty fragment returns to Discover; skip/content fragments preserve the selected tab. */
export function tabIdForHash(hash: string): string | undefined {
  const tabs: Record<string, string> = { '': 'feed-view', '#discover': 'feed-view', '#my-spots': 'spots-view', '#profile': 'profile-view', '#settings': 'settings-view' };
  return tabs[hash];
}
