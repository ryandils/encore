export function matchesOccupancy(occupancy: number, capacity: number, filter: string): boolean {
  if (filter === 'all') return true;
  if (!Number.isFinite(occupancy) || !Number.isFinite(capacity) || occupancy < 0 || capacity <= 0) return false;
  const ratio = occupancy / capacity;
  if (filter === 'quiet') return ratio < 0.5;
  if (filter === 'moderate') return ratio >= 0.5 && ratio < 0.8;
  if (filter === 'busy') return ratio >= 0.8;
  return false;
}