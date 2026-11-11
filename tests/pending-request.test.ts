import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult, EventCommand, EventResult } from '../src/domain/contracts.ts';
import type { DoorApi } from '../src/components/door/controller.ts';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';
import { createPendingDoorApi, pendingRequestKey } from '../src/features/door/pending-request.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) };
}
const command = (): EventCommand => ({ type: 'FREE_ADMISSION', requestId: randomUUID() });
function setup() {
  const fixture = createLedgerFixtures(); const nightId = fixture.night.id;
  const api = { doorState: vi.fn<DoorApi['doorState']>(async () => ({ ok: true, data: fixture.doorState })), recordEvent: vi.fn<DoorApi['recordEvent']>(async (_night, input) => ({ ok: true, data: { requestId: input.requestId, eventId: randomUUID(), state: fixture.doorState } })) };
  const storage = memoryStorage(); const key = pendingRequestKey('verified-user', nightId); const onChange = vi.fn();
  return { api, storage, key, nightId, onChange, create: () => createPendingDoorApi(api, storage, key, nightId, onChange) };
}
const forbidden: ApiResult<EventResult> = { ok: false, error: { code: 'FORBIDDEN', message: 'Assignment revoked' } };

describe('single unresolved request journal', () => {
  it('partitions saved commands by authenticated account and night', () => {
    const firstNight = randomUUID(), secondNight = randomUUID();
    expect(pendingRequestKey('first-user', firstNight)).not.toBe(pendingRequestKey('second-user', firstNight));
    expect(pendingRequestKey('first-user', firstNight)).not.toBe(pendingRequestKey('first-user', secondNight));
    const { api, storage } = setup(); const pending = command();
    storage.values.set(pendingRequestKey('first-user', firstNight), JSON.stringify(pending));
    expect(createPendingDoorApi(api, storage, pendingRequestKey('first-user', firstNight), firstNight).pending()).toEqual(pending);
    expect(createPendingDoorApi(api, storage, pendingRequestKey('second-user', firstNight), firstNight).pending()).toBeNull();
    expect(createPendingDoorApi(api, storage, pendingRequestKey('first-user', secondNight), secondNight).pending()).toBeNull();
    expect(api.recordEvent).not.toHaveBeenCalled();
  });
  it('persists and verifies the original command before the first transport call', async () => {
    const s = setup(); const pending = command(); const journal = s.create();
    s.api.recordEvent.mockImplementation(async (_night, input) => {
      expect(JSON.parse(s.storage.values.get(s.key) ?? 'null')).toEqual(pending);
      expect(input).toEqual(pending);
      return { ok: true, data: { requestId: input.requestId, eventId: randomUUID(), state: createLedgerFixtures().doorState } };
    });
    expect((await journal.api.recordEvent(s.nightId, pending)).ok).toBe(true);
    expect(journal.pending()).toBeNull(); expect(s.storage.values.has(s.key)).toBe(false);
  });
  it('keeps an uncertain committed request through reload without autosending or creating a new ID', async () => {
    const s = setup(); const pending = command(); const first = s.create();
    s.api.recordEvent.mockRejectedValueOnce(new TypeError('Acknowledgement lost'));
    await expect(first.api.recordEvent(s.nightId, pending)).rejects.toThrow();
    expect(first.pending()).toEqual(pending); expect(JSON.parse(s.storage.values.get(s.key) ?? 'null')).toEqual(pending);
    const reloaded = s.create();
    expect(reloaded.pending()).toEqual(pending); expect(s.api.recordEvent).toHaveBeenCalledTimes(1);
    await expect(reloaded.api.recordEvent(s.nightId, command())).rejects.toThrow();
    expect(s.api.recordEvent).toHaveBeenCalledTimes(1);
    const recovered = await reloaded.retry();
    expect(recovered.ok).toBe(true);
    expect(s.api.recordEvent.mock.calls[0]?.[1]).toEqual(s.api.recordEvent.mock.calls[1]?.[1]);
    expect(reloaded.pending()).toBeNull(); expect(s.storage.values.has(s.key)).toBe(false);
  });
  it('clears only a definitely rejected initial submission', async () => {
    const s = setup(); const journal = s.create(); s.api.recordEvent.mockResolvedValueOnce(forbidden);
    expect(await journal.api.recordEvent(s.nightId, command())).toEqual(forbidden);
    expect(journal.pending()).toBeNull(); expect(s.storage.values.has(s.key)).toBe(false);
  });
  it('retains an unknown request when retry becomes forbidden, including after reload', async () => {
    const s = setup(); const pending = command();
    s.api.recordEvent.mockRejectedValueOnce(new TypeError('Network unknown'));
    await expect(s.create().api.recordEvent(s.nightId, pending)).rejects.toThrow();
    s.api.recordEvent.mockResolvedValue(forbidden);
    const reloaded = s.create(); expect(await reloaded.retry()).toEqual(forbidden);
    expect(reloaded.pending()).toEqual(pending); expect(s.create().pending()).toEqual(pending);
    await expect(reloaded.api.recordEvent(s.nightId, command())).rejects.toThrow();
    expect(s.api.recordEvent).toHaveBeenCalledTimes(2);
  });
  it('fails closed on corrupt or authority-bearing saved commands', () => {
    const s = setup();
    for (const value of ['{', JSON.stringify({ type: 'FREE_ADMISSION', requestId: randomUUID(), actorId: 'spoofed' })]) {
      s.storage.values.set(s.key, value);
      expect(s.create).toThrow(); expect(s.api.recordEvent).not.toHaveBeenCalled();
      expect(s.storage.values.get(s.key)).toBe(value);
    }
  });
  it('does not send a new action when storage is unavailable or exceeds quota', async () => {
    const s = setup(); const journal = s.create();
    s.storage.setItem.mockImplementation(() => { throw new Error('Quota unavailable'); });
    await expect(journal.api.recordEvent(s.nightId, command())).rejects.toThrow();
    expect(s.api.recordEvent).not.toHaveBeenCalled();
    expect(s.onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'FREE_ADMISSION' }), expect.any(String));
    const unavailable = setup(); unavailable.storage.getItem.mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(unavailable.create).toThrow(); expect(unavailable.api.recordEvent).not.toHaveBeenCalled();
  });
  it('rejects silent storage loss before transport instead of pretending persistence worked', async () => {
    const s = setup(); const journal = s.create(); s.storage.setItem.mockImplementation(() => {});
    await expect(journal.api.recordEvent(s.nightId, command())).rejects.toThrow();
    expect(s.api.recordEvent).not.toHaveBeenCalled();
  });
  it('keeps a receipt unresolved if removing its recovery record fails after acknowledgement', async () => {
    const s = setup(); const pending = command(); const journal = s.create();
    s.storage.removeItem.mockImplementation(() => { throw new Error('Storage blocked'); });
    await expect(journal.api.recordEvent(s.nightId, pending)).rejects.toThrow();
    expect(s.api.recordEvent).toHaveBeenCalledTimes(1);
    expect(s.storage.values.has(s.key)).toBe(true); expect(journal.pending()).toEqual(pending);
  });
  it.each(['request', 'night'] as const)('does not clear recovery storage for a mismatched %s acknowledgement', async (field) => {
    const s = setup(); const pending = command(); const journal = s.create(); const fixture = createLedgerFixtures();
    s.api.recordEvent.mockResolvedValueOnce({ ok: true, data: { requestId: field === 'request' ? randomUUID() : pending.requestId,
      eventId: randomUUID(), state: field === 'night' ? { ...fixture.doorState, night: { ...fixture.night, id: randomUUID() } } : fixture.doorState } });
    await expect(journal.api.recordEvent(s.nightId, pending)).rejects.toThrow();
    expect(journal.pending()).toEqual(pending); expect(s.storage.values.has(s.key)).toBe(true);
  });
  it('rejects another night without transporting or overwriting the pending request', async () => {
    const s = setup(); const pending = command(); s.storage.values.set(s.key, JSON.stringify(pending));
    const journal = s.create();
    await expect(journal.api.recordEvent(randomUUID(), pending)).rejects.toThrow();
    expect(s.api.recordEvent).not.toHaveBeenCalled(); expect(journal.pending()).toEqual(pending);
  });
});
