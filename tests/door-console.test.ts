import { describe, expect, it, vi } from 'vitest';
import { DoorController } from '../src/components/door/controller.ts';
import type { DoorApi } from '../src/components/door/controller.ts';
import { createSyntheticDoorAdapter } from '../src/features/door/synthetic-adapter.ts';
import type { ApiResult, DoorState, EventResult } from '../src/domain/contracts.ts';

const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const paid = { type: 'ADMISSION' as const, presetSlot: 2 as const, expectedAmountCents: 1000 };

describe('door console request lifecycle', () => {
  it('keeps acknowledged count while pending and serializes rapid intentional taps', async () => {
    const adapter = createSyntheticDoorAdapter({ delayMs: 0 });
    const pending = deferred<ApiResult<EventResult>>();
    let first = true;
    const api: DoorApi = { doorState: adapter.api.doorState, recordEvent: vi.fn(async (night, command) => { const result = await adapter.api.recordEvent(night, command); if (first) { first = false; await pending.promise; } return result; }) };
    const controller = new DoorController(api, adapter.nightId);
    await controller.refresh();
    for (let index = 0; index < 4; index++) controller.submit(paid, '$10 entry');
    controller.submit({ type: 'EXIT' }, 'Exit');
    expect(controller.getSnapshot().state?.occupancy).toBe(0);
    expect(controller.getSnapshot().queue).toHaveLength(5);
    expect(api.recordEvent).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: false, error: { code: 'VALIDATION', message: 'release only' } });
    await flush();
    expect(controller.getSnapshot().state?.occupancy).toBe(3);
    expect(controller.getSnapshot().queue).toHaveLength(0);
    expect(api.recordEvent).toHaveBeenCalledTimes(5);
    const ids = vi.mocked(api.recordEvent).mock.calls.map(call => call[1].requestId);
    expect(new Set(ids).size).toBe(5);
  });

  it('retains an unknown request, blocks additional taps and reuses its ID without duplicating', async () => {
    const adapter = createSyntheticDoorAdapter({ delayMs: 0 });
    const api = { ...adapter.api, recordEvent: vi.fn(adapter.api.recordEvent) };
    const controller = new DoorController(api, adapter.nightId);
    await controller.refresh();
    adapter.setNextWriteOutcome('unknown');
    controller.submit(paid, '$10 entry');
    await flush();
    expect(controller.getSnapshot().phase).toBe('unknown');
    expect(controller.getSnapshot().state?.occupancy).toBe(0);
    controller.submit(paid, '$10 entry');
    controller.discardRejected();
    expect(controller.getSnapshot().queue).toHaveLength(1);
    controller.retry(); controller.retry();
    await flush();
    expect(api.recordEvent).toHaveBeenCalledTimes(2);
    expect(api.recordEvent.mock.calls[0]?.[1]).toEqual(api.recordEvent.mock.calls[1]?.[1]);
    expect(controller.getSnapshot().state?.occupancy).toBe(1);
    expect(controller.getSnapshot().phase).toBe('idle');
  });

  it('makes definite rejection visible and cancels unsent queued taps only by explicit action', async () => {
    const adapter = createSyntheticDoorAdapter({ delayMs: 0 });
    const controller = new DoorController(adapter.api, adapter.nightId);
    await controller.refresh();
    adapter.setNextWriteOutcome('reject');
    controller.submit(paid, '$10 entry'); controller.submit(paid, '$10 entry');
    await flush();
    expect(controller.getSnapshot().phase).toBe('failed');
    expect(controller.getSnapshot().queue).toHaveLength(2);
    expect(controller.getSnapshot().state?.occupancy).toBe(0);
    controller.discardRejected();
    expect(controller.getSnapshot().queue).toHaveLength(0);
    expect(controller.getSnapshot().phase).toBe('idle');
  });

  it('blocks new taps while disconnected or stale and preserves the last acknowledged count', async () => {
    let now = Date.now();
    const adapter = createSyntheticDoorAdapter({ now: () => now, delayMs: 0 });
    const controller = new DoorController(adapter.api, adapter.nightId, () => now);
    await controller.refresh();
    adapter.setOffline(true);
    await controller.refresh();
    controller.submit(paid, '$10 entry');
    expect(controller.getSnapshot().queue).toHaveLength(0);
    expect(controller.getSnapshot().syncError).not.toBeNull();
    now += 10001; controller.tick();
    expect(controller.isStale()).toBe(true);
    expect(controller.getSnapshot().state?.occupancy).toBe(0);
    adapter.setOffline(false); await controller.refresh();
    expect(controller.canSubmit()).toBe(true);
  });

  it('does not roll back a write when an older in-flight poll arrives late', async () => {
    const adapter = createSyntheticDoorAdapter({ delayMs: 0 });
    const old = await adapter.api.doorState(adapter.nightId);
    const pending = deferred<ApiResult<DoorState>>();
    let hold = false;
    const api: DoorApi = { ...adapter.api, doorState: async () => hold ? pending.promise : adapter.api.doorState(adapter.nightId) };
    const controller = new DoorController(api, adapter.nightId);
    await controller.refresh();
    hold = true;
    const polling = controller.refresh();
    controller.submit(paid, '$10 entry'); await flush();
    expect(controller.getSnapshot().state?.occupancy).toBe(1);
    pending.resolve(old); await polling;
    expect(controller.getSnapshot().state?.occupancy).toBe(1);
  });

  it('keeps an unknown original unresolved when retry is forbidden', async () => {
    const adapter = createSyntheticDoorAdapter({ delayMs: 0 });
    let revoked = false;
    const api: DoorApi = { ...adapter.api, recordEvent: async (night, command) => revoked ? { ok: false, error: { code: 'FORBIDDEN', message: 'Access revoked' } } : adapter.api.recordEvent(night, command) };
    const controller = new DoorController(api, adapter.nightId);
    await controller.refresh(); adapter.setNextWriteOutcome('unknown');
    controller.submit(paid, '$10 entry'); await flush();
    revoked = true; controller.retry(); await flush();
    expect(controller.getSnapshot().phase).toBe('unknown');
    expect(controller.getSnapshot().message).toContain('Original outcome still unknown');
    controller.discardRejected(); controller.submit(paid, '$10 entry');
    expect(controller.getSnapshot().queue).toHaveLength(1);
  });

  it('rejects older same-version metadata and does not renew freshness from old receipts', async () => {
    let now = Date.now();
    const adapter = createSyntheticDoorAdapter({ now: () => now, delayMs: 0 });
    const initial = await adapter.api.doorState(adapter.nightId);
    if (!initial.ok) throw new Error('Fixture setup failed');
    let result = initial;
    const controller = new DoorController({ ...adapter.api, doorState: async () => result }, adapter.nightId, () => now);
    await controller.refresh();
    now += 5000;
    result = { ok: true, data: { ...initial.data, syncedAt: new Date(now).toISOString(), recentActions: [] } };
    await controller.refresh();
    const freshSync = controller.getSnapshot().lastSync;
    now += 11000;
    result = { ok: true, data: { ...initial.data, night: { ...initial.data.night, status: 'CLOSED' } } };
    await controller.refresh();
    expect(controller.getSnapshot().state?.night.status).toBe('OPEN');
    expect(controller.getSnapshot().lastSync).toBe(freshSync);
    expect(controller.isStale()).toBe(true);
  });
});
