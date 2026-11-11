import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DoorController } from '../src/components/door/controller.ts';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';
import type { ApiResult, DoorState, EventCommand, EventResult } from '../src/domain/contracts.ts';
import { createHttpDoorAdapter } from '../src/features/door/http-adapter.ts';

const fixture = () => createLedgerFixtures();
const result = (body: unknown, status = 200) => Response.json(body, { status });
function setup(body: unknown, status = 200) {
  const transport = vi.fn<typeof fetch>(async () => result(body, status));
  return { transport, api: createHttpDoorAdapter({ fetch: transport }) };
}
const free = (): EventCommand => ({ type: 'FREE_ADMISSION', requestId: randomUUID() });
function acknowledgement(command: EventCommand, state: DoorState = fixture().doorState): ApiResult<EventResult> {
  const eventId = state.recentActions[0]?.id ?? randomUUID();
  const action = { ...(state.recentActions[0] ?? { id: eventId, sequence: Math.max(1, state.night.version), recordedAt: state.syncedAt, reversed: false, canUndo: true }),
    type: command.type === 'FREE_ADMISSION' ? 'ADMISSION' as const : command.type,
    amountCents: command.type === 'ADMISSION' ? command.expectedAmountCents : 0 };
  const recentActions = [action, ...state.recentActions.slice(1)];
  return { ok: true, data: { requestId: command.requestId, eventId, state: { ...state, recentActions } } };
}

describe('persisted door HTTP adapter', () => {
  it('loads only the requested night through credentialed noncached GET', async () => {
    const f = fixture(); const { api, transport } = setup({ ok: true, data: f.doorState });
    expect(await api.doorState(f.night.id)).toEqual({ ok: true, data: f.doorState });
    expect(transport).toHaveBeenCalledWith(`/api/nights/${f.night.id}/door-state`, expect.objectContaining({ method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error' }));
  });
  it('posts the unchanged validated command without client actor or aggregate money', async () => {
    const command = free(); const f = fixture(); const receipt = acknowledgement(command, f.doorState);
    const { api, transport } = setup(receipt);
    expect(await api.recordEvent(f.night.id, command)).toEqual(receipt);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe(`/api/nights/${f.night.id}/events`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual(command);
  });
  it('preserves the original request ID across explicit retries', async () => {
    const command = free(); const f = fixture(); const { api, transport } = setup(acknowledgement(command));
    await api.recordEvent(f.night.id, command); await api.recordEvent(f.night.id, command);
    expect(transport.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).requestId)).toEqual([command.requestId, command.requestId]);
  });
  it('rejects malformed night scope locally before transport', async () => {
    const { api, transport } = setup({});
    await expect(api.doorState('../other-night')).rejects.toThrow();
    await expect(api.recordEvent('../other-night', free())).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects a different night in a successful read', async () => {
    const f = fixture(); const { api } = setup({ ok: true, data: { ...f.doorState, night: { ...f.night, id: randomUUID() } } });
    await expect(api.doorState(f.night.id)).rejects.toThrow();
  });
  it.each(['request', 'night'] as const)('keeps a mismatched %s acknowledgement unknown', async (mismatch) => {
    const command = free(); const f = fixture(); const receipt = acknowledgement(command);
    if (!receipt.ok) throw new Error('Fixture failed');
    const data = mismatch === 'request' ? { ...receipt.data, requestId: randomUUID() } : { ...receipt.data, state: { ...receipt.data.state, night: { ...f.night, id: randomUUID() } } };
    const { api } = setup({ ok: true, data });
    await expect(api.recordEvent(f.night.id, command)).rejects.toThrow();
  });
  it('rejects an acknowledged event missing from the scoped receipt', async () => {
    const command = free(); const receipt = acknowledgement(command);
    if (!receipt.ok) throw new Error('Fixture failed');
    const { api } = setup({ ok: true, data: { ...receipt.data, eventId: randomUUID() } });
    await expect(api.recordEvent(fixture().night.id, command)).rejects.toThrow();
  });
  it.each([
    { ok: false, error: { code: 'MADE_UP', message: 'Rejected' } },
    { ok: false, error: { code: 'FORBIDDEN', message: 123 } },
    { ok: false, data: {}, error: { code: 'FORBIDDEN', message: 'Rejected' } },
  ])('keeps malformed rejection envelopes unknown %#', async (body) => {
    const { api } = setup(body, 403);
    await expect(api.recordEvent(fixture().night.id, free())).rejects.toThrow();
  });
  it.each(['type', 'amount'] as const)('keeps a wrong acknowledged %s unknown', async (field) => {
    const command = free(); const receipt = acknowledgement(command);
    if (!receipt.ok) throw new Error('Fixture failed');
    const recentActions = receipt.data.state.recentActions.map((action) => action.id === receipt.data.eventId ? { ...action, ...(field === 'type' ? { type: 'EXIT' as const } : { amountCents: 1000 }) } : action);
    const { api } = setup({ ok: true, data: { ...receipt.data, state: { ...receipt.data.state, recentActions } } });
    await expect(api.recordEvent(fixture().night.id, command)).rejects.toThrow();
  });
  it('sets a bounded transport deadline and retains timeout as an unknown write', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new Error('Timed out')));
    try {
      const transport = vi.fn<typeof fetch>(async (_url, init) => { init?.signal?.throwIfAborted(); throw new Error('Missing abort'); });
      const api = createHttpDoorAdapter({ fetch: transport });
      await expect(api.recordEvent(fixture().night.id, free())).rejects.toThrow('Timed out');
      expect(timeout).toHaveBeenCalledWith(20000);
    } finally { timeout.mockRestore(); }
  });
  it.each([401, 403, 409, 429])('returns a valid definitive HTTP %s rejection without fake data', async (status) => {
    const code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'NIGHT_CLOSED' : 'RATE_LIMITED';
    const rejection = { ok: false, error: { code, message: 'Request rejected' } };
    const { api } = setup(rejection, status);
    expect(await api.recordEvent(fixture().night.id, free())).toEqual(rejection);
  });
  it('shows read service failure as an error result instead of inventing occupancy', async () => {
    const rejection = { ok: false, error: { code: 'UNAVAILABLE', message: 'Unavailable' } };
    const { api } = setup(rejection, 503);
    expect(await api.doorState(fixture().night.id)).toEqual(rejection);
  });
  it.each([500, 503])('treats HTTP %s write errors as unknown outcomes', async (status) => {
    const { api } = setup({ ok: false, error: { code: 'UNAVAILABLE', message: 'Unavailable' } }, status);
    await expect(api.recordEvent(fixture().night.id, free())).rejects.toThrow();
  });
  it.each([{}, { ok: true }, { ok: false, error: { code: 'MADE_UP', message: 'x' } }, { ok: false, error: { code: 'FORBIDDEN', message: 'x' } }])('rejects malformed or contradictory successful envelopes %#', async (body) => {
    const { api } = setup(body);
    await expect(api.recordEvent(fixture().night.id, free())).rejects.toThrow();
  });
  it('rejects a non-JSON server response and connection loss as unknown', async () => {
    const transport = vi.fn<typeof fetch>(async () => new Response('<html>proxy error</html>', { status: 200 }));
    const api = createHttpDoorAdapter({ fetch: transport });
    await expect(api.recordEvent(fixture().night.id, free())).rejects.toThrow();
    transport.mockRejectedValueOnce(new TypeError('Network failure'));
    await expect(api.recordEvent(fixture().night.id, free())).rejects.toThrow();
  });
  it('does not accept owner financial fields or invalid numeric state as a door response', async () => {
    const f = fixture();
    for (const data of [{ ...f.doorState, projection: f.summary.projection }, { ...f.doorState, occupancy: -1 }, { ...f.doorState, syncedAt: 'invalid-time' }]) {
      const { api } = setup({ ok: true, data });
      await expect(api.doorState(f.night.id)).rejects.toThrow();
    }
  });
  it('keeps the same queued request through a lost HTTP acknowledgement without speculative occupancy', async () => {
    const f = fixture(); const before: DoorState = { ...f.doorState, occupancy: 0, recentActions: [], night: { ...f.night, version: 0 } };
    const after: DoorState = { ...before, occupancy: 1, night: { ...before.night, version: 1 } };
    let committed: ApiResult<EventResult> | undefined;
    const commands: EventCommand[] = [];
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === 'GET') return result({ ok: true, data: committed ? after : before });
      const command = JSON.parse(String(init?.body)) as EventCommand; commands.push(command);
      if (!committed) { committed = acknowledgement(command, after); throw new TypeError('Acknowledgement lost after commit'); }
      return result(committed);
    });
    const controller = new DoorController(createHttpDoorAdapter({ fetch: transport }), f.night.id, () => Date.parse(before.syncedAt));
    await controller.refresh(); controller.submit({ type: 'FREE_ADMISSION' }, 'Free entry');
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('unknown'));
    expect(controller.getSnapshot().state?.occupancy).toBe(0);
    expect(controller.getSnapshot().queue).toHaveLength(1);
    controller.submit({ type: 'FREE_ADMISSION' }, 'Do not duplicate'); controller.discardRejected();
    expect(controller.getSnapshot().queue).toHaveLength(1);
    controller.retry();
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('idle'));
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1]);
    expect(controller.getSnapshot().queue).toHaveLength(0);
    expect(controller.getSnapshot().state?.occupancy).toBe(1);
  });
});
