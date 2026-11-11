import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult, CloseCommand, CloseResult, OwnerSummary } from '../src/domain/contracts.ts';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';
import { createPendingCloseApi, pendingCloseKey, pendingCloseNightIds } from '../src/features/owner/pending-close.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, get length() { return values.size; }, key: vi.fn((index: number) => [...values.keys()][index] ?? null), getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) };
}
const command = (): CloseCommand => ({ requestId: randomUUID(), countedCashCents: 15000, notes: 'Synthetic immutable close' });
function receipt(input: CloseCommand): ApiResult<CloseResult> {
  const { closedSummary } = createLedgerFixtures();
  if (!closedSummary.reconciliation) throw new Error('Fixture failed');
  return { ok: true, data: { requestId: input.requestId, summary: { ...closedSummary, reconciliation: { ...closedSummary.reconciliation,
    countedCashCents: input.countedCashCents, varianceCents: input.countedCashCents - closedSummary.reconciliation.expectedDrawerCents, notes: input.notes } } } };
}
function setup() {
  const fixture = createLedgerFixtures(); const nightId = fixture.night.id;
  const api = { summary: vi.fn(async (): Promise<ApiResult<OwnerSummary>> => ({ ok: true, data: fixture.summary })),
    closeNight: vi.fn(async (_night: string, input: CloseCommand): Promise<ApiResult<CloseResult>> => receipt(input)) };
  const storage = memoryStorage(); const key = pendingCloseKey('verified-owner', nightId); const onChange = vi.fn();
  return { api, storage, key, nightId, onChange, create: () => createPendingCloseApi(api, storage, key, nightId, onChange) };
}
const forbidden: ApiResult<CloseResult> = { ok: false, error: { code: 'FORBIDDEN', message: 'Owner permission revoked' } };

describe('single unresolved close command journal', () => {
  it('partitions recovery commands by verified owner and night', () => {
    const firstNight = randomUUID(), secondNight = randomUUID(); const s = setup(); const pending = command();
    const key = pendingCloseKey('first-owner', firstNight); s.storage.values.set(key, JSON.stringify(pending));
    expect(createPendingCloseApi(s.api, s.storage, key, firstNight).pending()).toEqual(pending);
    expect(createPendingCloseApi(s.api, s.storage, pendingCloseKey('second-owner', firstNight), firstNight).pending()).toBeNull();
    expect(createPendingCloseApi(s.api, s.storage, pendingCloseKey('first-owner', secondNight), secondNight).pending()).toBeNull();
    expect(s.api.closeNight).not.toHaveBeenCalled();
  });
  it('persists only the validated original command before transport and clears on acknowledgement', async () => {
    const s = setup(); const pending = command(); const journal = s.create();
    s.api.closeNight.mockImplementation(async (_night, input) => {
      expect(JSON.parse(s.storage.values.get(s.key) ?? 'null')).toEqual(pending);
      expect(Object.keys(JSON.parse(s.storage.values.get(s.key) ?? '{}')).sort()).toEqual(['countedCashCents', 'notes', 'requestId']);
      return receipt(input);
    });
    expect(await journal.api.closeNight(s.nightId, pending)).toEqual(receipt(pending));
    expect(journal.pending()).toBeNull(); expect(s.storage.values.has(s.key)).toBe(false);
  });
  it('recovers the original immutable closed receipt after an unknown result and reload', async () => {
    const s = setup(); const pending = command(); const saved = receipt(pending);
    s.api.closeNight.mockRejectedValueOnce(new TypeError('Acknowledgement lost after commit'));
    await expect(s.create().api.closeNight(s.nightId, pending)).rejects.toThrow();
    const reloaded = s.create(); expect(reloaded.pending()).toEqual(pending); expect(s.api.closeNight).toHaveBeenCalledTimes(1);
    await expect(reloaded.api.closeNight(s.nightId, { ...pending, requestId: randomUUID(), countedCashCents: 1 })).rejects.toThrow();
    expect(s.api.closeNight).toHaveBeenCalledTimes(1);
    s.api.closeNight.mockResolvedValueOnce(saved);
    expect(await reloaded.retry()).toEqual(saved);
    expect(s.api.closeNight.mock.calls[0]?.[1]).toEqual(s.api.closeNight.mock.calls[1]?.[1]);
    expect(reloaded.pending()).toBeNull(); expect(s.storage.values.has(s.key)).toBe(false);
  });
  it('does not clear recovery merely because a refreshed summary says the night is closed', async () => {
    const s = setup(); const pending = command(); s.api.closeNight.mockRejectedValueOnce(new TypeError('Unknown'));
    await expect(s.create().api.closeNight(s.nightId, pending)).rejects.toThrow();
    const closed = createLedgerFixtures().closedSummary; s.api.summary.mockResolvedValueOnce({ ok: true, data: closed });
    const reloaded = s.create(); expect(await reloaded.api.summary(s.nightId)).toEqual({ ok: true, data: closed });
    expect(reloaded.pending()).toEqual(pending); expect(s.storage.values.has(s.key)).toBe(true);
    expect(s.api.closeNight).toHaveBeenCalledTimes(1);
  });
  it('does not treat a typed service-unavailable result as a definitive initial rejection', async () => {
    const s = setup(); const pending = command(); const journal = s.create();
    s.api.closeNight.mockResolvedValueOnce({ ok: false, error: { code: 'UNAVAILABLE', message: 'Unknown service outcome' } });
    await expect(journal.api.closeNight(s.nightId, pending)).rejects.toThrow(); expect(journal.pending()).toEqual(pending);
    expect(s.storage.values.has(s.key)).toBe(true);
  });
  it('serializes repeated retry clicks while the original close is in flight', async () => {
    const s = setup(); const pending = command(); const journal = s.create(); let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    s.api.closeNight.mockImplementation(async (_night, input) => { await wait; return receipt(input); });
    const original = journal.api.closeNight(s.nightId, pending);
    await expect(journal.retry()).rejects.toThrow(); expect(s.api.closeNight).toHaveBeenCalledTimes(1);
    release(); expect(await original).toEqual(receipt(pending)); expect(journal.pending()).toBeNull();
  });
  it('returns a detached pending command so edits cannot silently change the original close', async () => {
    const s = setup(); const pending = command(); s.storage.values.set(s.key, JSON.stringify(pending)); const journal = s.create();
    const exposed = journal.pending(); if (!exposed) throw new Error('Fixture failed'); Object.assign(exposed, { notes: 'Changed', countedCashCents: 1 });
    expect(journal.pending()).toEqual(pending); expect(await journal.retry()).toEqual(receipt(pending));
    expect(s.api.closeNight).toHaveBeenCalledWith(s.nightId, pending);
  });
  it('clears an initial definitive rejection but retains forbidden retry after uncertainty', async () => {
    const s = setup(); const initial = s.create(); s.api.closeNight.mockResolvedValueOnce(forbidden);
    expect(await initial.api.closeNight(s.nightId, command())).toEqual(forbidden); expect(initial.pending()).toBeNull();
    const pending = command(); s.api.closeNight.mockRejectedValueOnce(new TypeError('Unknown'));
    await expect(s.create().api.closeNight(s.nightId, pending)).rejects.toThrow();
    const reloaded = s.create(); s.api.closeNight.mockResolvedValueOnce(forbidden);
    expect(await reloaded.retry()).toEqual(forbidden); expect(reloaded.pending()).toEqual(pending); expect(s.create().pending()).toEqual(pending);
  });
  it('fails closed without deleting corrupt or authority-bearing saved commands', () => {
    const s = setup();
    for (const value of ['{', JSON.stringify({ ...command(), closedBy: 'spoofed' }), JSON.stringify({ ...command(), countedCashCents: -1 })]) {
      s.storage.values.set(s.key, value); expect(s.create).toThrow();
      expect(s.storage.values.get(s.key)).toBe(value); expect(s.api.closeNight).not.toHaveBeenCalled();
    }
  });
  it.each([-1, 1.5, Number.NaN])('rejects an invalid counted amount %s before persistence or transport', async (countedCashCents) => {
    const s = setup(); const journal = s.create();
    await expect(journal.api.closeNight(s.nightId, { ...command(), countedCashCents })).rejects.toThrow();
    expect(s.api.closeNight).not.toHaveBeenCalled(); expect(s.storage.values.has(s.key)).toBe(false);
  });
  it('does not fetch when storage is inaccessible, full or silently drops the write', async () => {
    const blocked = setup(); blocked.storage.getItem.mockImplementation(() => { throw new Error('Blocked'); });
    expect(blocked.create).toThrow(); expect(blocked.api.closeNight).not.toHaveBeenCalled();
    for (const fail of [true, false]) {
      const s = setup(); const journal = s.create();
      s.storage.setItem.mockImplementation(() => { if (fail) throw new Error('Quota'); });
      await expect(journal.api.closeNight(s.nightId, command())).rejects.toThrow(); expect(s.api.closeNight).not.toHaveBeenCalled();
      expect(s.onChange).toHaveBeenCalledWith(expect.anything(), expect.any(String));
    }
  });
  it('retains recovery data when clearing storage fails after the server acknowledgement', async () => {
    const s = setup(); const pending = command(); const journal = s.create();
    s.storage.removeItem.mockImplementation(() => { throw new Error('Blocked'); });
    await expect(journal.api.closeNight(s.nightId, pending)).rejects.toThrow();
    expect(s.api.closeNight).toHaveBeenCalledTimes(1); expect(journal.pending()).toEqual(pending); expect(s.storage.values.has(s.key)).toBe(true);
  });
  it.each(['request', 'night', 'status', 'counted', 'notes', 'reconciliation'] as const)('preserves the command for a mismatched %s close acknowledgement', async (mismatch) => {
    const s = setup(); const pending = command(); const valid = receipt(pending); if (!valid.ok || !valid.data.summary.reconciliation) throw new Error('Fixture failed');
    const summary = valid.data.summary;
    s.api.closeNight.mockResolvedValueOnce({ ok: true, data: { ...valid.data, requestId: mismatch === 'request' ? randomUUID() : pending.requestId,
      summary: { ...summary, night: { ...summary.night, ...(mismatch === 'night' ? { id: randomUUID() } : {}), ...(mismatch === 'status' ? { status: 'OPEN', closedAt: null } as const : {}) },
        reconciliation: mismatch === 'reconciliation' ? null : { ...valid.data.summary.reconciliation, ...(mismatch === 'counted' ? { countedCashCents: pending.countedCashCents + 1 } : {}), ...(mismatch === 'notes' ? { notes: 'Altered receipt' } : {}) } } } });
    const journal = s.create(); await expect(journal.api.closeNight(s.nightId, pending)).rejects.toThrow();
    expect(journal.pending()).toEqual(pending); expect(s.storage.values.has(s.key)).toBe(true);
  });
  it('rejects a different night without overwriting or sending the stored close', async () => {
    const s = setup(); const pending = command(); s.storage.values.set(s.key, JSON.stringify(pending)); const journal = s.create();
    await expect(journal.api.closeNight(randomUUID(), pending)).rejects.toThrow(); expect(s.api.closeNight).not.toHaveBeenCalled(); expect(journal.pending()).toEqual(pending);
  });
});


describe('pending close discovery before owner catalogs load', () => {
  it('discovers an orphaned night even when an owned-night catalog no longer contains it', () => {
    const s = setup(); const orphanedNight = randomUUID(); const user = 'owner:/雪'; const key = pendingCloseKey(user, orphanedNight);
    s.storage.values.set(key, JSON.stringify(command()));
    const ownedCatalog: string[] = [];
    expect(ownedCatalog).not.toContain(orphanedNight);
    expect(pendingCloseNightIds(user, s.storage)).toEqual([orphanedNight]);
    expect(s.api.summary).not.toHaveBeenCalled(); expect(s.api.closeNight).not.toHaveBeenCalled();
    expect(s.storage.values.has(key)).toBe(true);
  });
  it('does not read another account journal or unrelated storage while discovering current-user nights', () => {
    const s = setup(); const current = randomUUID(); const otherKey = pendingCloseKey('other-owner', randomUUID());
    const currentKey = pendingCloseKey('current-owner', current);
    s.storage.values.set(otherKey, '{ unreadable-other-user-data'); s.storage.values.set('unrelated-preferences', 'x');
    s.storage.values.set(`${pendingCloseKey('other-owner', randomUUID())}:bad-suffix`, 'x'); s.storage.values.set(currentKey, JSON.stringify(command()));
    expect(pendingCloseNightIds('current-owner', s.storage)).toEqual([current]);
    expect(s.storage.getItem.mock.calls.map(([key]) => key)).toEqual([currentKey]);
    expect(s.storage.values.get(otherKey)).toBe('{ unreadable-other-user-data');
  });
  it('retains a corrupt command for fail-closed journal recovery rather than hiding its night', () => {
    const s = setup(); const user = 'verified-owner'; s.storage.values.set(s.key, '{ unreadable command');
    expect(pendingCloseNightIds(user, s.storage)).toEqual([s.nightId]);
    expect(s.create).toThrow(/storage is unavailable or corrupted/i);
    expect(s.storage.values.get(s.key)).toBe('{ unreadable command'); expect(s.api.closeNight).not.toHaveBeenCalled();
  });
  it('fails closed for malformed current-user night keys without deleting them', () => {
    const s = setup(); const user = 'verified-owner'; const key = 'encore:pending-close:v1:verified-owner:not-a-uuid';
    s.storage.values.set(key, JSON.stringify(command()));
    expect(() => pendingCloseNightIds(user, s.storage)).toThrow(/storage is unavailable or corrupted/i);
    expect(s.storage.values.has(key)).toBe(true);
  });
  it('fails closed if enumeration names a pending record that disappeared', () => {
    const s = setup(); s.storage.values.set(s.key, JSON.stringify(command())); s.storage.getItem.mockReturnValue(null);
    expect(() => pendingCloseNightIds('verified-owner', s.storage)).toThrow(/storage is unavailable or corrupted/i);
    expect(s.storage.values.has(s.key)).toBe(true);
  });
  it.each(['length', 'key', 'getItem'] as const)('fails closed on an unavailable %s storage operation', (operation) => {
    const s = setup(); s.storage.values.set(s.key, JSON.stringify(command()));
    if (operation === 'length') Object.defineProperty(s.storage, 'length', { get() { throw new Error('Private implementation details'); } });
    else s.storage[operation].mockImplementation(() => { throw new Error('Private implementation details'); });
    expect(() => pendingCloseNightIds('verified-owner', s.storage)).toThrow(/storage is unavailable or corrupted/i);
    expect(s.api.closeNight).not.toHaveBeenCalled();
  });
});
