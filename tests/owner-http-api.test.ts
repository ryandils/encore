import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createLedgerFixtures } from '../src/domain/fixtures.ts';
import { formatNightCsv } from '../src/domain/csv-export.ts';
import { createHttpOwnerApi } from '../src/features/owner/http-owner-api.ts';

const origin = 'http://127.0.0.1:3000';
const fixtures = () => createLedgerFixtures();
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function setup(body: unknown, status = 200) {
  const transport = vi.fn<typeof fetch>(async () => response(body, status));
  return { transport, api: createHttpOwnerApi({ fetch: transport, origin }) };
}
function accessFixture() {
  const f = fixtures(); return { invites: [{ id: f.responses.inviteResult.id, intendedEmail: 'staff@encore-fixture.invalid', expiresAt: f.responses.inviteResult.expiresAt, consumedAt: null, revokedAt: null }],
    assignments: [{ ...f.responses.assignment, email: 'staff@encore-fixture.invalid' }] };
}
function csvResponse(csv: string, nightId: string, overrides: Record<string, string> = {}) {
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="synthetic-encore-${nightId}.csv"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...overrides } });
}

describe('owner HTTP API trust boundary', () => {
  it('loads server venue/config/night/access data through scoped noncached session requests', async () => {
    const f = fixtures(); const bodies = [{ ok: true, data: [f.venue] }, { ok: true, data: { venue: f.venue, presets: f.presets } }, { ok: true, data: [f.night] }, { ok: true, data: accessFixture() }];
    const transport = vi.fn<typeof fetch>(async () => response(bodies.shift())); const api = createHttpOwnerApi({ fetch: transport, origin });
    expect(await api.listVenues()).toEqual({ ok: true, data: [f.venue] });
    expect(await api.venueConfiguration(f.venue.id)).toEqual({ ok: true, data: { venue: f.venue, presets: f.presets } });
    expect(await api.listNights(f.venue.id)).toEqual({ ok: true, data: [f.night] });
    expect(await api.nightAccess(f.night.id)).toEqual({ ok: true, data: accessFixture() });
    expect(transport.mock.calls.map(([url]) => url)).toEqual(['/api/venues', `/api/venues/${f.venue.id}`, `/api/venues/${f.venue.id}/nights`, `/api/nights/${f.night.id}/access`]);
    for (const [, init] of transport.mock.calls) expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  });
  it('loads authoritative owner finance rather than deriving fake totals', async () => {
    const f = fixtures(); const { api } = setup({ ok: true, data: f.summary });
    expect(await api.summary(f.night.id)).toEqual({ ok: true, data: f.summary });
  });
  it('sends validated setup commands without authority or calculated totals', async () => {
    const f = fixtures(); const { api, transport } = setup({ ok: true, data: f.venue });
    await api.createVenue(f.commands.createVenue);
    const [url, init] = transport.mock.calls[0]; expect(url).toBe('/api/venues'); expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual(f.commands.createVenue);
    const spoofed = { ...f.commands.createVenue, actorId: 'spoofed', role: 'OWNER' };
    await expect(Promise.resolve().then(() => api.createVenue(spoofed))).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(1);
  });
  it('scopes opening and preset updates to the requested venue', async () => {
    const f = fixtures(); const transport = vi.fn<typeof fetch>(async (_url, init) => response({ ok: true, data: init?.method === 'PATCH' ? f.presets : f.summary }));
    const api = createHttpOwnerApi({ fetch: transport, origin });
    expect((await api.openNight(f.venue.id, f.commands.openNight)).ok).toBe(true);
    expect((await api.updatePresets(f.venue.id, f.commands.updatePresets)).ok).toBe(true);
    expect(transport.mock.calls[0][0]).toBe(`/api/venues/${f.venue.id}/nights`);
    expect(transport.mock.calls[1][0]).toBe(`/api/venues/${f.venue.id}/presets`); expect(transport.mock.calls[1][1]?.method).toBe('PATCH');
  });
  it.each(['configuration', 'night', 'summary', 'assignment'] as const)('rejects a successful wrong-scope %s payload', async (kind) => {
    const f = fixtures(); const other = randomUUID();
    if (kind === 'configuration') {
      const { api } = setup({ ok: true, data: { venue: { ...f.venue, id: other }, presets: f.presets } }); await expect(api.venueConfiguration(f.venue.id)).rejects.toThrow();
    } else if (kind === 'night') {
      const { api } = setup({ ok: true, data: [{ ...f.night, venueId: other }] }); await expect(api.listNights(f.venue.id)).rejects.toThrow();
    } else if (kind === 'summary') {
      const { api } = setup({ ok: true, data: { ...f.summary, night: { ...f.night, id: other } } }); await expect(api.summary(f.night.id)).rejects.toThrow();
    } else {
      const { api } = setup({ ok: true, data: { ...accessFixture(), assignments: [{ ...accessFixture().assignments[0], nightId: other }] } }); await expect(api.nightAccess(f.night.id)).rejects.toThrow();
    }
  });
  it.each([null, -1, 1.5, '5500'])('rejects malformed money %j rather than displaying invented finance', async (value) => {
    const f = fixtures(); const { api } = setup({ ok: true, data: { ...f.summary, projection: { ...f.summary.projection, expectedCoverCents: value } } });
    await expect(api.summary(f.night.id)).rejects.toThrow();
  });
  it('rejects NaN money transmitted as JSON null and inconsistent reconciliation arithmetic', async () => {
    const f = fixtures();
    const nan = setup({ ok: true, data: { ...f.summary, openingFloatCents: Number.NaN } }); await expect(nan.api.summary(f.night.id)).rejects.toThrow();
    const inconsistent = setup({ ok: true, data: { ...f.closedSummary, reconciliation: { ...f.closedSummary.reconciliation, varianceCents: 1 } } });
    await expect(inconsistent.api.summary(f.night.id)).rejects.toThrow();
  });
  it('rejects leaked invite hashes, raw secrets and authority fields in server metadata', async () => {
    const f = fixtures();
    for (const extra of [{ tokenHash: 'private hash' }, { token: 'private secret' }]) {
      const { api } = setup({ ok: true, data: { ...accessFixture(), invites: [{ ...accessFixture().invites[0], ...extra }] } }); await expect(api.nightAccess(f.night.id)).rejects.toThrow();
    }
    const { api } = setup({ ok: true, data: [{ ...f.venue, role: 'OWNER' }] }); await expect(api.listVenues()).rejects.toThrow();
  });
  it('accepts only a same-origin fragment invitation with the actual base64url secret format', async () => {
    const f = fixtures(); const invite = { id: f.responses.inviteResult.id, expiresAt: f.responses.inviteResult.expiresAt, inviteUrl: `${origin}/invites/accept#token=${'A'.repeat(43)}` };
    const { api, transport } = setup({ ok: true, data: invite }); expect(await api.createInvite(f.night.id, f.commands.invite)).toEqual({ ok: true, data: invite });
    expect(transport.mock.calls[0][0]).toBe(`/api/nights/${f.night.id}/invites`);
  });
  it.each([`https://untrusted.invalid/invites/accept#token=${'A'.repeat(43)}`, `${origin}/invites/accept?token=${'A'.repeat(43)}`, `${origin}/other#token=${'A'.repeat(43)}`, `${origin.replace('://', '://attacker@')}/invites/accept#token=${'A'.repeat(43)}`, `${origin}/invites/accept?debug=1#token=${'A'.repeat(43)}`, `javascript:alert(1)`, `${origin}/invites/accept#token=short`])('rejects an unsafe invitation URL %s', async (inviteUrl) => {
    const f = fixtures(); const { api } = setup({ ok: true, data: { ...f.responses.inviteResult, inviteUrl } }); await expect(api.createInvite(f.night.id, f.commands.invite)).rejects.toThrow();
  });
  it('validates revocation identities and encodes opaque assignment user IDs', async () => {
    const f = fixtures(); const userId = 'staff/account@example.invalid'; const assignment = { ...f.responses.revokedAssignment, userId };
    const { api, transport } = setup({ ok: true, data: assignment }); expect(await api.revokeAssignment(f.night.id, userId)).toEqual({ ok: true, data: assignment });
    expect(transport.mock.calls[0][0]).toBe(`/api/nights/${f.night.id}/assignments/${encodeURIComponent(userId)}`); expect(transport.mock.calls[0][1]?.method).toBe('DELETE');
    const wrong = setup({ ok: true, data: { id: randomUUID(), revokedAt: f.responses.revokedAssignment.revokedAt } }); await expect(wrong.api.revokeInvite(f.night.id, f.responses.inviteResult.id)).rejects.toThrow();
  });
  it.each([{}, { ok: true }, { ok: 'true', data: {} }, { ok: false, error: { code: 'FORBIDDEN', message: 'Rejected' } }])('rejects malformed or contradictory successful envelopes %#', async (body) => {
    const { api } = setup(body); await expect(api.summary(fixtures().night.id)).rejects.toThrow();
  });
  it('does not accept unknown error codes or successful data behind an error status', async () => {
    const badCode = setup({ ok: false, error: { code: 'MADE_UP', message: 'Rejected' } }, 403);
    await expect(badCode.api.summary(fixtures().night.id)).rejects.toThrow();
    const badStatus = setup({ ok: true, data: fixtures().summary }, 403);
    await expect(badStatus.api.summary(fixtures().night.id)).rejects.toThrow();
  });
  it('preserves a definitive permission failure without substituting finance', async () => {
    const failure = { ok: false, error: { code: 'FORBIDDEN', message: 'Owner access required' } }; const { api } = setup(failure, 403);
    expect(await api.summary(fixtures().night.id)).toEqual(failure); expect(await api.closeNight(fixtures().night.id, fixtures().commands.close)).toEqual(failure);
  });
  it('uses a bounded deadline and keeps timed-out writes unknown', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new Error('Timed out')));
    try {
      const transport = vi.fn<typeof fetch>(async (_url, init) => { init?.signal?.throwIfAborted(); throw new Error('Missing abort'); });
      const api = createHttpOwnerApi({ fetch: transport, origin });
      await expect(api.closeNight(fixtures().night.id, fixtures().commands.close)).rejects.toThrow('Timed out');
      expect(timeout).toHaveBeenCalledWith(20000); expect(transport).toHaveBeenCalledTimes(1);
    } finally { timeout.mockRestore(); }
  });
  it.each([500, 503])('keeps HTTP %s mutating outcomes unknown and never retries automatically', async (status) => {
    const f = fixtures(); const { api, transport } = setup({ ok: false, error: { code: 'UNAVAILABLE', message: 'Unavailable' } }, status);
    await expect(api.closeNight(f.night.id, f.commands.close)).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each(['request', 'night', 'counted', 'notes', 'status'] as const)('rejects a mismatched %s close receipt', async (kind) => {
    const f = fixtures(); if (!f.closedSummary.reconciliation) throw new Error('Fixture failed');
    const summary = { ...f.closedSummary, night: { ...f.closedSummary.night, ...(kind === 'night' ? { id: randomUUID() } : {}), ...(kind === 'status' ? { status: 'OPEN' as const, closedAt: null } : {}) },
      reconciliation: { ...f.closedSummary.reconciliation, ...(kind === 'counted' ? { countedCashCents: 1 } : {}), ...(kind === 'notes' ? { notes: 'Changed' } : {}) } };
    const { api } = setup({ ok: true, data: { requestId: kind === 'request' ? randomUUID() : f.commands.close.requestId, summary } });
    await expect(api.closeNight(f.night.id, f.commands.close)).rejects.toThrow();
  });
  it('downloads only scoped synthetic CSV with real download headers', async () => {
    const f = fixtures(); const summary = { ...f.closedSummary, reconciliation: f.closedSummary.reconciliation ? { ...f.closedSummary.reconciliation, notes: '@Synthetic, "notes"\r\ncontinued' } : null };
    const csv = formatNightCsv(summary, f.events, { synthetic: true, audit: true, reconciliationRequestId: f.commands.close.requestId });
    const transport = vi.fn<typeof fetch>(async () => csvResponse(csv, f.night.id)); const api = createHttpOwnerApi({ fetch: transport, origin });
    expect(await api.exportNight(f.night.id)).toEqual({ ok: true, data: { contentType: 'text/csv', filename: `synthetic-encore-${f.night.id}.csv`, csv } });
    expect(transport.mock.calls[0][0]).toBe(`/api/nights/${f.night.id}/export`); expect(transport.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
  });
  it.each(['media', 'filename', 'scope', 'synthetic', 'html', 'cache'] as const)('rejects an unsafe %s export', async (kind) => {
    const f = fixtures(); const csv = formatNightCsv(f.closedSummary, f.events, { synthetic: kind !== 'synthetic', audit: true });
    const headers: Record<string, string> = kind === 'media' ? { 'Content-Type': 'text/html' } : kind === 'filename' ? { 'Content-Disposition': 'attachment; filename="../../private.csv"' } : kind === 'cache' ? { 'Cache-Control': 'public, max-age=3600' } : {};
    const other = randomUUID();
    const wrongScopeCsv = kind === 'scope' ? formatNightCsv({ ...f.closedSummary, night: { ...f.closedSummary.night, id: other } }, f.events.map((event) => ({ ...event, nightId: other })), { synthetic: true, audit: true }) : csv;
    const transport = vi.fn<typeof fetch>(async () => csvResponse(kind === 'html' ? '<html>Proxy failure</html>' : wrongScopeCsv, f.night.id, headers));
    await expect(createHttpOwnerApi({ fetch: transport, origin }).exportNight(f.night.id)).rejects.toThrow();
  });
  it('preserves JSON export denial instead of treating it as a CSV download', async () => {
    const failure = { ok: false, error: { code: 'FORBIDDEN', message: 'Owner only' } }; const { api } = setup(failure, 403); expect(await api.exportNight(fixtures().night.id)).toEqual(failure);
  });
});
