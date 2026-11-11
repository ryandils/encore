import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createLedgerHttpHandler } from '../src/server/ledger-http.ts';
import { LedgerAccessError } from '../src/server/ledger-service.ts';
import type { AssignmentView, CoverPreset, InviteResult, OwnerSummary, VenueView } from '../src/domain/contracts.ts';

const origin = 'http://127.0.0.1:3000';
const venueId = randomUUID();
const nightId = randomUUID();
const actor = 'verified-session-user';
const presets = [1, 2, 3].map((slot) => ({ slot, label: `Cover ${slot}`, amountCents: slot * 1000 }));
const venue = { name: 'Synthetic HTTP venue', timezone: 'UTC', capacity: 100, presets };
const night = { label: 'Synthetic night', startingOccupancy: 0, openingFloatCents: 10000, currency: 'USD' };
const invite = { intendedEmail: 'synthetic-staff@encore-demo.invalid' };
const token = { token: 'synthetic-opaque-secret-token' };
function setup() {
  const access = {
    createVenue: vi.fn(async (..._args: unknown[]) => ({ id: venueId } as VenueView)),
    openNight: vi.fn(async (..._args: unknown[]) => ({} as OwnerSummary)),
    updatePresets: vi.fn(async (..._args: unknown[]) => ([] as CoverPreset[])),
    createInvite: vi.fn(async (..._args: unknown[]) => ({} as InviteResult)),
    acceptInvite: vi.fn(async (..._args: unknown[]) => ({} as AssignmentView)),
    revokeInvite: vi.fn(async (..._args: unknown[]) => ({ id: randomUUID(), revokedAt: '2026-11-11T00:00:00.000Z' })),
    revokeAssignment: vi.fn(async (..._args: unknown[]) => ({} as AssignmentView)),
  };
  const dependencies = {
    available: vi.fn(() => true), origin: vi.fn(() => origin),
    session: vi.fn(async (_headers: Headers): Promise<{ user: { id: string } } | null> => ({ user: { id: actor } })),
    service: vi.fn(() => { throw new Error('Ledger service must not serve access operations.'); }),
    access: vi.fn(() => access), now: () => 1000,
  };
  return { access, dependencies, handle: createLedgerHttpHandler(dependencies) };
}
function request(method = 'POST', body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/access`, { method,
    headers: { Origin: origin, ...(method !== 'DELETE' ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(method !== 'DELETE' && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  });
}
const operations = [
  ['create-venue', 'POST', venue, '', undefined, 'createVenue'],
  ['open-night', 'POST', night, venueId, undefined, 'openNight'],
  ['presets', 'PATCH', { presets }, venueId, undefined, 'updatePresets'],
  ['create-invite', 'POST', invite, nightId, undefined, 'createInvite'],
  ['accept-invite', 'POST', token, '', undefined, 'acceptInvite'],
  ['revoke-invite', 'DELETE', undefined, nightId, venueId, 'revokeInvite'],
  ['revoke-assignment', 'DELETE', undefined, nightId, 'target-user', 'revokeAssignment'],
] as const;

describe('venue and staff-access HTTP boundary', () => {
  it.each(operations)('routes %s with server-derived actor and noncacheable results', async (op, method, body, scope, target, serviceMethod) => {
    const { handle, dependencies, access } = setup();
    const response = await handle(op, request(method, body), scope, target);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(dependencies.service).not.toHaveBeenCalled();
    expect(access[serviceMethod]).toHaveBeenCalledOnce();
    expect(access[serviceMethod].mock.calls[0]?.[0]).toBe(actor);
    if (op === 'create-invite') expect(access.createInvite).toHaveBeenCalledWith(actor, nightId, invite, origin);
    if (op === 'create-venue') expect(access.createVenue).toHaveBeenCalledWith(actor, venue);
    if (op === 'open-night') expect(access.openNight).toHaveBeenCalledWith(actor, venueId, night);
    if (op === 'presets') expect(access.updatePresets).toHaveBeenCalledWith(actor, venueId, { presets });
    if (op === 'accept-invite') expect(access.acceptInvite).toHaveBeenCalledWith(actor, token);
    if (op === 'revoke-invite') expect(access.revokeInvite).toHaveBeenCalledWith(actor, nightId, venueId);
    if (op === 'revoke-assignment') expect(access.revokeAssignment).toHaveBeenCalledWith(actor, nightId, 'target-user');
  });

  it.each(operations)('rejects production %s before config/session/access dependencies', async (op, method, body, scope, target) => {
    const { handle, dependencies } = setup(); dependencies.available.mockReturnValue(false);
    expect((await handle(op, request(method, body), scope, target)).status).toBe(404);
    expect(dependencies.origin).not.toHaveBeenCalled(); expect(dependencies.session).not.toHaveBeenCalled(); expect(dependencies.access).not.toHaveBeenCalled();
  });

  it.each(operations)('requires same-origin and a verified session for %s', async (op, method, body, scope, target) => {
    const { handle, dependencies } = setup();
    expect((await handle(op, request(method, body, { Origin: 'https://untrusted.invalid' }), scope, target)).status).toBe(403);
    expect(dependencies.session).not.toHaveBeenCalled();
    dependencies.session.mockResolvedValue(null);
    expect((await handle(op, request(method, body), scope, target)).status).toBe(401);
    expect(dependencies.access).not.toHaveBeenCalled();
  });

  it.each([
    ['create-venue', { ...venue, ownerId: 'forged' }, ''],
    ['open-night', { ...night, actorId: 'forged' }, venueId],
    ['presets', { presets, role: 'OWNER' }, venueId],
    ['create-invite', { ...invite, expiresAt: '2099-01-01T00:00:00.000Z' }, nightId],
    ['accept-invite', { ...token, emailVerified: true }, ''],
  ] as const)('rejects client authority/assignment fields in %s', async (op, body, scope) => {
    const { handle, access } = setup();
    const response = await handle(op, request(op === 'presets' ? 'PATCH' : 'POST', body), scope);
    expect(response.status).toBe(400);
    for (const method of Object.values(access)) expect(method).not.toHaveBeenCalled();
  });

  it.each(['open-night', 'presets', 'create-invite', 'revoke-invite', 'revoke-assignment'] as const)('validates scoped UUID for %s', async op => {
    const { handle, access } = setup();
    const method = op === 'presets' ? 'PATCH' : (op === 'revoke-assignment' || op === 'revoke-invite') ? 'DELETE' : 'POST';
    expect((await handle(op, request(method), 'not-a-uuid', 'target-user')).status).toBe(400);
    for (const action of Object.values(access)) expect(action).not.toHaveBeenCalled();
  });

  it('requires an opaque target user for revocation without requiring JSON', async () => {
    const { handle, access } = setup();
    expect((await handle('revoke-assignment', request('DELETE'), nightId, '')).status).toBe(400);
    expect(access.revokeAssignment).not.toHaveBeenCalled();
    expect((await handle('revoke-assignment', request('DELETE'), nightId, 'auth-id-not-uuid')).status).toBe(200);
    expect(access.revokeAssignment).toHaveBeenCalledWith(actor, nightId, 'auth-id-not-uuid');
  });

  it('validates pending-invite UUID and cancels without a JSON body', async () => {
    const { handle, access } = setup();
    expect((await handle('revoke-invite', request('DELETE'), nightId, 'not-a-uuid')).status).toBe(400);
    expect(access.revokeInvite).not.toHaveBeenCalled();
    expect((await handle('revoke-invite', request('DELETE'), nightId, venueId)).status).toBe(200);
    expect(access.revokeInvite).toHaveBeenCalledWith(actor, nightId, venueId);
  });

  it.each(operations)('reports allowed method for %s', async (op, method, _body, scope, target) => {
    const { handle } = setup();
    const response = await handle(op, request('GET'), scope, target);
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe(method);
  });

  it('builds invitation links from configured origin rather than the request URL', async () => {
    const { handle, access } = setup();
    const foreignUrl = new Request('https://untrusted.invalid/api/invites', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(invite) });
    expect((await handle('create-invite', foreignUrl, nightId)).status).toBe(200);
    expect(access.createInvite).toHaveBeenCalledWith(actor, nightId, invite, origin);
  });

  it('preserves verified-account rejection without trusting an HTTP email assertion', async () => {
    const { handle, access } = setup(); access.acceptInvite.mockRejectedValue(new LedgerAccessError('INVITE_INVALID', 'Invite is unavailable.'));
    const response = await handle('accept-invite', request('POST', token));
    expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ ok: false, error: { code: 'INVITE_INVALID' } });
    expect(access.acceptInvite).toHaveBeenCalledWith(actor, token);
  });

  it('returns stable permission and unavailable errors without exposing invite tokens', async () => {
    const { handle, access } = setup(); access.createInvite.mockRejectedValue(new LedgerAccessError('FORBIDDEN', 'Owner access required.'));
    expect((await handle('create-invite', request('POST', invite), nightId)).status).toBe(403);
    access.acceptInvite.mockRejectedValue(new Error(`private SQL ${token.token}`));
    const response = await handle('accept-invite', request('POST', token));
    expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).not.toMatch(/private SQL|synthetic-opaque-secret-token/);
  });

  it('retains bounded JSON validation for new command operations', async () => {
    const { handle, access } = setup();
    const oversized = request('POST', { token: 'x'.repeat(17000) });
    expect((await handle('accept-invite', oversized)).status).toBe(413);
    expect(access.acceptInvite).not.toHaveBeenCalled();
  });

  it('fails closed if an optional access implementation has not been wired', async () => {
    const { dependencies } = setup();
    const handle = createLedgerHttpHandler({ ...dependencies, access: undefined });
    const response = await handle('create-venue', request('POST', venue));
    expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
