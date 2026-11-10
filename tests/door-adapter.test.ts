import { describe, expect, it } from 'vitest';
import type { ApiResult, EventCommand } from '../src/domain/contracts.ts';
import { createSyntheticDoorAdapter } from '../src/features/door/synthetic-adapter.ts';

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
const paid = (): EventCommand => ({ type: 'ADMISSION', requestId: crypto.randomUUID(), presetSlot: 2, expectedAmountCents: 1000 });
const setup = (now?: () => number) => createSyntheticDoorAdapter({ delayMs: 0, now });

describe('synthetic door adapter', () => {
  it('starts isolated and records four $10 admissions and an exit with occupancy 3 and $40 charged', async () => {
    const demo = setup();
    expect(data(await demo.api.doorState(demo.nightId)).occupancy).toBe(0);
    await Promise.all(Array.from({ length: 4 }, () => demo.api.recordEvent(demo.nightId, paid())));
    const saved = data(await demo.api.recordEvent(demo.nightId, { type: 'EXIT', requestId: crypto.randomUUID() }));
    expect(saved.state.occupancy).toBe(3);
    expect(saved.state.recentActions.filter((action) => action.type === 'ADMISSION').reduce((sum, action) => sum + action.amountCents, 0)).toBe(4000);
    expect(saved.state).not.toHaveProperty('projection');
    expect(saved.state).not.toHaveProperty('reconciliation');
    expect(saved.state.night).not.toHaveProperty('openingFloatCents');
    expect(saved.state.recentActions[0]).not.toHaveProperty('actorId');
    const separate = setup();
    expect(data(await separate.api.doorState(separate.nightId)).occupancy).toBe(0);
  });

  it('reconciles an unknown committed save once, preserving original receipt even after close', async () => {
    const demo = setup();
    const command = paid();
    demo.setNextWriteOutcome('unknown');
    await expect(demo.api.recordEvent(demo.nightId, command)).rejects.toThrow(/unknown/);
    expect(data(await demo.api.doorState(demo.nightId)).occupancy).toBe(1);
    const original = data(await demo.api.recordEvent(demo.nightId, command));
    demo.setClosed();
    expect(data(await demo.api.recordEvent(demo.nightId, command))).toEqual(original);
    expect(await demo.api.recordEvent(demo.nightId, paid())).toMatchObject({ ok: false, error: { code: 'NIGHT_CLOSED' } });
    expect(data(await demo.api.doorState(demo.nightId)).night.status).toBe('CLOSED');
    expect(await demo.api.recordEvent(demo.nightId, { type: 'FREE_ADMISSION', requestId: command.requestId })).toMatchObject({ ok: false, error: { code: 'REQUEST_CONFLICT' } });
  });

  it('returns detached receipts and state objects', async () => {
    const demo = setup();
    const command = paid();
    const first = data(await demo.api.recordEvent(demo.nightId, command));
    (first.state.presets as { amountCents: number }[])[1].amountCents = 7;
    expect(data(await demo.api.recordEvent(demo.nightId, command)).state.presets[1].amountCents).toBe(1000);
    expect(data(await demo.api.doorState(demo.nightId)).presets[1].amountCents).toBe(1000);
  });

  it('rejects failed, wrong-night, stale-price, malformed and negative-occupancy writes without changes', async () => {
    const demo = setup();
    demo.setNextWriteOutcome('reject');
    const command = paid();
    expect(await demo.api.recordEvent(demo.nightId, command)).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    expect(await demo.api.recordEvent(demo.nightId, { type: 'EXIT', requestId: crypto.randomUUID() })).toMatchObject({ ok: false, error: { code: 'INVALID_HISTORY' } });
    expect(await demo.api.recordEvent('wrong-night', paid())).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await demo.api.doorState('wrong-night')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await demo.api.recordEvent(demo.nightId, { type: 'ADMISSION', requestId: crypto.randomUUID(), presetSlot: 2, expectedAmountCents: 1 })).toMatchObject({ ok: false, error: { code: 'STALE_PRESET' } });
    expect(await demo.api.recordEvent(demo.nightId, { type: 'EXIT', requestId: 'invalid' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(data(await demo.api.doorState(demo.nightId)).occupancy).toBe(0);
    expect(data(await demo.api.recordEvent(demo.nightId, command)).state.occupancy).toBe(1);
  });

  it('keeps free admissions distinct from exits and enforces latest-action undo and expiry', async () => {
    let time = Date.parse('2026-11-11T02:00:00.000Z');
    const demo = setup(() => time);
    const first = data(await demo.api.recordEvent(demo.nightId, paid()));
    const free = data(await demo.api.recordEvent(demo.nightId, { type: 'FREE_ADMISSION', requestId: crypto.randomUUID() }));
    expect(free.state.occupancy).toBe(2);
    expect(free.state.recentActions[0]).toMatchObject({ type: 'ADMISSION', amountCents: 0, canUndo: true });
    expect(await demo.api.recordEvent(demo.nightId, { type: 'REVERSAL', requestId: crypto.randomUUID(), targetEventId: first.eventId, reason: 'Wrong tap' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const reversed = data(await demo.api.recordEvent(demo.nightId, { type: 'REVERSAL', requestId: crypto.randomUUID(), targetEventId: free.eventId, reason: 'Wrong tap' }));
    expect(reversed.state.occupancy).toBe(1);
    expect(reversed.state.recentActions.find((action) => action.id === free.eventId)).toMatchObject({ reversed: true, canUndo: false });
    time += 60_001;
    expect(data(await demo.api.doorState(demo.nightId)).recentActions.every((action) => !action.canUndo)).toBe(true);
    expect(await demo.api.recordEvent(demo.nightId, { type: 'REVERSAL', requestId: crypto.randomUUID(), targetEventId: first.eventId, reason: 'Too late' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('does not invent synchronization while offline', async () => {
    const demo = setup();
    demo.setOffline(true);
    await expect(demo.api.doorState(demo.nightId)).rejects.toThrow(/unavailable/);
    await expect(demo.api.recordEvent(demo.nightId, paid())).rejects.toThrow(/unavailable/);
    demo.setOffline(false);
    expect(data(await demo.api.doorState(demo.nightId)).occupancy).toBe(0);
  });
});
