import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createLedgerHttpHandler } from '../src/server/ledger-http.ts';
import { LedgerAccessError } from '../src/server/ledger-service.ts';

const origin = 'http://127.0.0.1:3000';
const venueId = randomUUID();
const nightId = randomUUID();
const actor = 'verified-owner-session';
const venue = { id: venueId, name: 'Synthetic venue', timezone: 'UTC', capacity: 100 };
const night = { id: nightId, venueId, label: 'Synthetic night', status: 'OPEN' as const, openedAt: '2026-11-11T00:00:00.000Z', closedAt: null,
  startingOccupancy: 0, currency: 'USD' as const, capacity: 100, timezone: 'UTC', version: 0 };
function setup() {
  const owners = {
    listVenues: vi.fn(async (..._args: unknown[]) => [venue]),
    venueConfiguration: vi.fn(async (..._args: unknown[]) => ({ venue, presets: [] })),
    listNights: vi.fn(async (..._args: unknown[]) => [night]),
    nightAccess: vi.fn(async (..._args: unknown[]) => ({ invites: [], assignments: [] })),
  };
  const service = {
    record: vi.fn(async () => { throw new Error('Unexpected event command.'); }),
    close: vi.fn(async () => { throw new Error('Unexpected close command.'); }),
    doorState: vi.fn(async () => { throw new Error('Unexpected door read.'); }),
    summary: vi.fn(async () => { throw new Error('Unexpected summary read.'); }),
    exportNight: vi.fn(async (..._args: unknown[]) => ({ contentType: 'text/csv' as const, filename: 'untrusted-service-name.csv', csv: '"nightId"\r\n"synthetic"\r\n' })),
  };
  const dependencies = {
    available: vi.fn(() => true), origin: vi.fn(() => origin),
    session: vi.fn(async (_headers: Headers): Promise<{ user: { id: string } } | null> => ({ user: { id: actor } })),
    service: vi.fn(() => service), owners: vi.fn(() => owners), now: () => 1000,
  };
  return { owners, service, dependencies, handle: createLedgerHttpHandler(dependencies) };
}
const read = (method = 'GET') => new Request(`${origin}/api/owners?role=OWNER&actorId=attacker`, { method });
const operations = [['venues', ''], ['venue-config', venueId], ['nights', venueId], ['night-access', nightId], ['export', nightId]] as const;

describe('owner discovery and audit export HTTP boundary', () => {
  it.each(operations)('authorizes %s using the verified session identity', async (operation, scope) => {
    const { handle, owners, service } = setup();
    const response = await handle(operation, read(), scope);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    switch (operation) {
      case 'venues': expect(owners.listVenues).toHaveBeenCalledWith(actor); break;
      case 'venue-config': expect(owners.venueConfiguration).toHaveBeenCalledWith(actor, venueId); break;
      case 'nights': expect(owners.listNights).toHaveBeenCalledWith(actor, venueId); break;
      case 'night-access': expect(owners.nightAccess).toHaveBeenCalledWith(actor, nightId); break;
      case 'export': expect(service.exportNight).toHaveBeenCalledWith({ authenticatedUserId: actor, nightId }); break;
    }
  });

  it.each(operations)('rejects production %s before loading any service or session', async (operation, scope) => {
    const { handle, dependencies } = setup(); dependencies.available.mockReturnValue(false);
    const response = await handle(operation, read(), scope);
    expect(response.status).toBe(404); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(dependencies.session).not.toHaveBeenCalled(); expect(dependencies.service).not.toHaveBeenCalled(); expect(dependencies.owners).not.toHaveBeenCalled();
  });

  it.each(operations)('requires verified authentication for %s', async (operation, scope) => {
    const { handle, dependencies } = setup(); dependencies.session.mockResolvedValue(null);
    const response = await handle(operation, read(), scope);
    expect(response.status).toBe(401); expect(dependencies.service).not.toHaveBeenCalled(); expect(dependencies.owners).not.toHaveBeenCalled();
    expect(response.headers.get('content-type')).toContain('application/json'); expect(response.headers.has('content-disposition')).toBe(false);
  });

  it.each(operations)('allows only GET for %s', async (operation, scope) => {
    const { handle, dependencies } = setup();
    const response = await handle(operation, read('POST'), scope);
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('GET');
    expect(dependencies.session).not.toHaveBeenCalled(); expect(dependencies.owners).not.toHaveBeenCalled(); expect(dependencies.service).not.toHaveBeenCalled();
  });

  it.each(['venue-config', 'nights', 'night-access', 'export'] as const)('validates canonical scope UUIDs for %s', async operation => {
    const { handle, dependencies } = setup();
    const response = await handle(operation, read(), 'not-a-uuid');
    expect(response.status).toBe(400); expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.has('content-disposition')).toBe(false); expect(dependencies.owners).not.toHaveBeenCalled(); expect(dependencies.service).not.toHaveBeenCalled();
  });

  it('returns a noncacheable CSV attachment with a UUID-only filename', async () => {
    const { handle, service } = setup();
    service.exportNight.mockResolvedValue({ contentType: 'text/csv', filename: 'unsafe"\r\nX-Injected: secret.csv', csv: '"quoted, field"\r\n' });
    const response = await handle('export', read(), nightId);
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="synthetic-encore-${nightId}.csv"`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.has('x-injected')).toBe(false); expect(await response.text()).toBe('"quoted, field"\r\n');
  });

  it('keeps denied export errors JSON rather than downloadable CSV', async () => {
    const { handle, service } = setup(); service.exportNight.mockRejectedValue(new LedgerAccessError('FORBIDDEN', 'Owner access required.'));
    const response = await handle('export', read(), nightId);
    expect(response.status).toBe(403); expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.has('content-disposition')).toBe(false); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('preserves wrong-venue permission rejection for configuration and access reads', async () => {
    const { handle, owners } = setup();
    owners.venueConfiguration.mockRejectedValue(new LedgerAccessError('FORBIDDEN', 'Owner access required.'));
    owners.nightAccess.mockRejectedValue(new LedgerAccessError('FORBIDDEN', 'Owner access required.'));
    expect((await handle('venue-config', read(), venueId)).status).toBe(403);
    expect((await handle('night-access', read(), nightId)).status).toBe(403);
  });

  it('returns sanitized metadata through JSON without attachment headers', async () => {
    const { handle } = setup(); const response = await handle('night-access', read(), nightId);
    expect(response.headers.get('content-type')).toContain('application/json'); expect(response.headers.has('content-disposition')).toBe(false);
    expect(await response.json()).toEqual({ ok: true, data: { invites: [], assignments: [] } });
  });

  it('hides unexpected driver failures for both CSV and JSON operations', async () => {
    const { handle, owners, service } = setup();
    owners.listVenues.mockRejectedValue(new Error('postgres://secret-password@localhost private SQL'));
    service.exportNight.mockRejectedValue(new Error('private invite token secret-token'));
    for (const [operation, scope] of [['venues', ''], ['export', nightId]] as const) {
      const response = await handle(operation, read(), scope);
      expect(response.status).toBe(503); expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.has('content-disposition')).toBe(false); expect(await response.text()).not.toMatch(/secret-password|private SQL|secret-token/);
    }
  });

  it('fails closed when optional owner reads or export are not wired', async () => {
    const { dependencies, service } = setup();
    const noOwners = createLedgerHttpHandler({ ...dependencies, owners: undefined });
    expect((await noOwners('venues', read())).status).toBe(503);
    const noExport = createLedgerHttpHandler({ ...dependencies, service: () => ({ ...service, exportNight: undefined }) });
    const response = await noExport('export', read(), nightId);
    expect(response.status).toBe(503); expect(response.headers.has('content-disposition')).toBe(false);
  });
});
