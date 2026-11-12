import { expect, it } from 'vitest';
import { nextClosingTime } from '../src/features/owner/closing-time';
const next = (after: string, zone: string, time = '05:00') => new Date(nextClosingTime(Date.parse(after), zone, time)).toISOString();
it('uses the venue zone and rolls an evening opening to the following morning', () => {
  expect(next('2026-11-12T03:00:00Z', 'America/New_York')).toBe('2026-11-12T10:00:00.000Z');
  expect(next('2026-11-12T11:00:00Z', 'America/New_York')).toBe('2026-11-13T10:00:00.000Z');
  expect(next('2026-11-12T10:00:00Z', 'America/New_York')).toBe('2026-11-13T10:00:00.000Z');
  expect(next('2026-11-12T15:00:00Z', 'Asia/Tokyo')).toBe('2026-11-12T20:00:00.000Z');
});
it('handles daylight saving without adding a fixed 24 hours', () => {
  expect(next('2026-03-08T03:00:00Z', 'America/New_York')).toBe('2026-03-08T09:00:00.000Z');
  expect(next('2026-11-01T02:00:00Z', 'America/New_York')).toBe('2026-11-01T10:00:00.000Z');
});
it('uses the first valid time after a skipped time and the next occurrence of a repeated time', () => {
  expect(next('2026-03-08T06:00:00Z', 'America/New_York', '02:30')).toBe('2026-03-08T07:00:00.000Z');
  expect(next('2026-11-01T04:00:00Z', 'America/New_York', '01:30')).toBe('2026-11-01T05:30:00.000Z');
  expect(next('2026-11-01T05:45:00Z', 'America/New_York', '01:30')).toBe('2026-11-01T06:30:00.000Z');
  expect(next('2026-09-06T03:00:00Z', 'America/Santiago', '00:30')).toBe('2026-09-06T04:00:00.000Z');
});
it('rejects invalid input', () => {
  expect(() => nextClosingTime(Date.now(), 'UTC', '25:00')).toThrow();
  expect(() => nextClosingTime(Number.NaN, 'UTC', '05:00')).toThrow();
  expect(() => nextClosingTime(Date.now(), 'Invalid/Zone', '05:00')).toThrow();
});
