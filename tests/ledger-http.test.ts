import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createLedgerHttpHandler } from '../src/server/ledger-http.ts';
import { LedgerAccessError } from '../src/server/ledger-service.ts';
import type { CloseResult, DoorState, EventResult, OwnerSummary } from '../src/domain/contracts.ts';

const nightId = randomUUID();
const origin = 'http://127.0.0.1:3000';
function setup() {
  const service = {
    record: vi.fn(async () => ({ eventId: randomUUID() } as EventResult)),
    close: vi.fn(async () => ({} as CloseResult)),
    doorState: vi.fn(async () => ({} as DoorState)),
    summary: vi.fn(async () => ({} as OwnerSummary)),
  };
  const dependencies = {
    available: vi.fn(() => true), origin: vi.fn(() => origin),
    session: vi.fn(async (_headers: Headers): Promise<{ user: { id: string } } | null> => ({ user: { id: 'verified-user' } })),
    service: vi.fn(() => service), now: () => 1000,
  };
  return { service, dependencies, handle: createLedgerHttpHandler(dependencies) };
}
function write(body: unknown = { type: 'FREE_ADMISSION', requestId: randomUUID() }, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/ledger/nights/${nightId}/events`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}
const read = () => new Request(`${origin}/api/ledger/nights/${nightId}/state`);

describe('ledger HTTP trust boundary', () => {
  it('rejects production before loading configuration, auth or database', async () => {
    const { handle, dependencies } = setup(); dependencies.available.mockReturnValue(false);
    expect((await handle('events', write(), nightId)).status).toBe(404);
    expect(dependencies.origin).not.toHaveBeenCalled(); expect(dependencies.session).not.toHaveBeenCalled(); expect(dependencies.service).not.toHaveBeenCalled();
  });
  it('requires a verified session for reads', async () => {
    const { handle, dependencies } = setup(); dependencies.session.mockResolvedValue(null);
    expect((await handle('door-state', read(), nightId)).status).toBe(401);
    expect(dependencies.service).not.toHaveBeenCalled();
  });
  it('derives actor exclusively from the verified cookie session', async () => {
    const { handle, service } = setup();
    const response = await handle('events', write(), nightId);
    expect(response.status).toBe(200);
    expect(service.record).toHaveBeenCalledWith({ authenticatedUserId: 'verified-user', nightId }, expect.objectContaining({ type: 'FREE_ADMISSION' }));
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it.each([{ actorId: 'attacker' }, { role: 'OWNER' }, { venueId: randomUUID() }])('rejects client authority fields %s', async (extra) => {
    const { handle, dependencies } = setup();
    expect((await handle('events', write({ type: 'FREE_ADMISSION', requestId: randomUUID(), ...extra }), nightId)).status).toBe(400);
    expect(dependencies.service).not.toHaveBeenCalled();
  });
  it.each(['https://untrusted.invalid', 'null', ''])('rejects foreign or missing Origin %s', async (requestOrigin) => {
    const { handle, service } = setup();
    expect((await handle('events', write(undefined, { Origin: requestOrigin }), nightId)).status).toBe(403);
    expect(service.record).not.toHaveBeenCalled();
  });
  it('rejects cross-site fetch metadata even with a copied Origin', async () => {
    const { handle } = setup();
    expect((await handle('events', write(undefined, { 'Sec-Fetch-Site': 'cross-site' }), nightId)).status).toBe(403);
  });
  it('rejects unsupported content types', async () => {
    const { handle, service } = setup();
    expect((await handle('events', write(undefined, { 'Content-Type': 'text/plain' }), nightId)).status).toBe(415);
    expect(service.record).not.toHaveBeenCalled();
  });
  it('rejects oversized bodies without trusting Content-Length', async () => {
    const { handle, service } = setup();
    const request = new Request(`${origin}/events`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(17000))); controller.close(); } }), duplex: 'half' } as RequestInit);
    expect((await handle('events', request, nightId)).status).toBe(413);
    expect(service.record).not.toHaveBeenCalled();
  });
  it('cancels fragmented bodies after their aggregate bytes exceed the limit', async () => {
    const { handle, service } = setup();
    const cancel = vi.fn(); let chunks = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { chunks++; controller.enqueue(new Uint8Array(9000)); }, cancel });
    const request = new Request(`${origin}/events`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body, duplex: 'half' } as RequestInit);
    expect((await handle('events', request, nightId)).status).toBe(413);
    expect(chunks).toBeLessThan(5); expect(cancel).toHaveBeenCalledOnce(); expect(service.record).not.toHaveBeenCalled();
  });
  it('rejects malformed UTF-8 rather than replacing invalid bytes', async () => {
    const { handle } = setup();
    const request = new Request(`${origin}/events`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: new Uint8Array([123, 34, 255, 34, 58, 48, 125]) });
    expect((await handle('events', request, nightId)).status).toBe(400);
  });
  it('validates night IDs and supported methods with noncacheable failures', async () => {
    const { handle, dependencies } = setup();
    const invalid = await handle('door-state', read(), 'not-a-uuid');
    expect(invalid.status).toBe(400); expect(invalid.headers.get('cache-control')).toContain('no-store');
    const method = await handle('events', read(), nightId);
    expect(method.status).toBe(405); expect(method.headers.get('allow')).toBe('POST'); expect(method.headers.get('cache-control')).toContain('no-store');
    expect(dependencies.service).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON and invalid commands', async () => {
    const { handle, service } = setup();
    const malformed = new Request(`${origin}/events`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' });
    expect((await handle('events', malformed, nightId)).status).toBe(400);
    expect((await handle('events', write({ type: 'EXIT', requestId: 'invalid' }), nightId)).status).toBe(400);
    expect(service.record).not.toHaveBeenCalled();
  });
  it.each(['summary', 'close'] as const)('preserves server permission rejection for %s', async (operation) => {
    const { handle, service } = setup();
    service[operation].mockRejectedValue(new LedgerAccessError('FORBIDDEN', 'Owner access required.'));
    const request = operation === 'close' ? write({ requestId: randomUUID(), countedCashCents: 0, notes: '' }) : read();
    expect((await handle(operation, request, nightId)).status).toBe(403);
  });
  it('rejects wrong venue membership through the service', async () => {
    const { handle, service } = setup(); service.doorState.mockRejectedValue(new LedgerAccessError('FORBIDDEN', 'Venue access required.'));
    expect((await handle('door-state', read(), nightId)).status).toBe(403);
  });
  it('returns generic noncached errors without leaking driver or credentials', async () => {
    const { handle, service } = setup(); service.doorState.mockRejectedValue(new Error('postgres://secret-password@localhost private SQL'));
    const response = await handle('door-state', read(), nightId);
    expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).not.toMatch(/secret-password|private SQL|postgres:/);
  });
  it('caps active limiter keys and admits new users after the window expires', async () => {
    const { dependencies } = setup(); let now = 1000;
    const handle = createLedgerHttpHandler({ ...dependencies, now: () => now });
    for (let i = 0; i < 1000; i++) {
      dependencies.session.mockResolvedValue({ user: { id: `user-${i}` } });
      expect((await handle('door-state', read(), nightId)).status).toBe(200);
    }
    dependencies.session.mockResolvedValue({ user: { id: 'overflow-user' } });
    expect((await handle('door-state', read(), nightId)).status).toBe(429);
    now += 60000;
    expect((await handle('door-state', read(), nightId)).status).toBe(200);
  });
  it('bounds repeated authenticated requests with a user limiter', async () => {
    const { handle } = setup();
    for (let i = 0; i < 600; i++) expect((await handle('door-state', read(), nightId)).status).toBe(200);
    expect((await handle('door-state', read(), nightId)).status).toBe(429);
  });
});
