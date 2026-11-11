import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { localEnvironment, root } from '../scripts/db-local.ts';

class VerificationFailure extends Error {}
function check(value: unknown, message: string): asserts value { if (!value) throw new VerificationFailure(message); }
async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); check(address && typeof address !== 'string', 'Could not select a test port.');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); return address.port;
}
async function stopServer(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
    if (result.status !== 0 && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    const deadline = Date.now() + 5000;
    while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
  }
  const deadline = Date.now() + 2000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
  check(child.exitCode !== null || child.signalCode !== null, 'Could not confirm test-server cleanup.');
}

/** Real cookie sessions and HTTP setup routes; never verifies an account or sends email. */
async function verify(): Promise<void> {
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 4, connectionTimeoutMillis: 5000 });
  const marker = `Synthetic access HTTP ${randomUUID()}`;
  const tokens: string[] = [];
  let child: ChildProcess | undefined;
  let step = 'local prerequisites';
  try {
    check(process.env.BETTER_AUTH_SECRET && process.env.DEMO_OWNER_PASSWORD && process.env.DEMO_STAFF_PASSWORD, 'Run auth:init and auth:seed before venue:access:http:verify.');
    const users = await pool.query<{ id: string; email: string; emailVerified: boolean }>('SELECT id,email,"emailVerified" FROM "user" WHERE email=ANY($1::text[])', [['owner@encore-demo.invalid', 'staff@encore-demo.invalid']]);
    const owner = users.rows.find((user) => user.email === 'owner@encore-demo.invalid');
    const staff = users.rows.find((user) => user.email === 'staff@encore-demo.invalid');
    check(owner && staff, 'Synthetic seeded owner/staff accounts are missing.');
    step = 'development HTTP server';
    const origin = `http://127.0.0.1:${await availablePort()}`;
    let failed = false;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', new URL(origin).port], {
      cwd: root, env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin }, stdio: 'ignore', detached: process.platform !== 'win32',
    });
    child.once('error', () => { failed = true; });
    const request = (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    let ready = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      check(!failed && child.exitCode === null, 'Test server did not start; ensure no other Next dev server owns this checkout.');
      try { if ((await request('/api/demo/session')).status === 401) { ready = true; break; } } catch { /* Startup compilation. */ }
      await delay(250);
    }
    check(ready, 'Access HTTP server did not become ready.');
    const send = (path: string, body: unknown, cookie?: string, method = 'POST', requestOrigin = origin) => request(path, {
      method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
    });
    async function login(email: string, password: string): Promise<string> {
      const response = await send('/api/auth/sign-in/email', { email, password });
      check(response.status === 200, 'Synthetic cookie login failed.');
      const data = await response.json() as { token?: string }; check(typeof data.token === 'string', 'Session token is missing.'); tokens.push(data.token);
      const cookie = response.headers.getSetCookie().find((value) => value.split('=', 1)[0]?.endsWith('session_token'));
      check(cookie, 'Verified session cookie is missing.'); return cookie.split(';', 1)[0] ?? '';
    }
    const ownerCookie = await login(owner.email, process.env.DEMO_OWNER_PASSWORD);
    const staffCookie = await login(staff.email, process.env.DEMO_STAFF_PASSWORD);
    step = 'session-owned venue provisioning';
    const presets = [1, 2, 3].map((slot) => ({ slot, label: `Synthetic cover ${slot}`, amountCents: slot * 1000 }));
    const venueCommand = { name: marker, timezone: 'UTC', capacity: 100, presets };
    check((await send('/api/venues', venueCommand)).status === 401, 'Anonymous venue creation was accepted.');
    check((await send('/api/venues', { ...venueCommand, ownerId: staff.id }, ownerCookie)).status === 400, 'Client-supplied owner was accepted.');
    const created = await send('/api/venues', venueCommand, ownerCookie);
    check(created.status === 200 && created.headers.get('cache-control')?.includes('no-store'), 'Venue provisioning failed or was cacheable.');
    const venueBody = await created.json() as { data?: { id?: string } }; const venueId = venueBody.data?.id;
    check(typeof venueId === 'string', 'Venue response omitted its ID.');
    const memberships = await pool.query('SELECT "userId",role FROM venue_membership WHERE "venueId"=$1', [venueId]);
    check(memberships.rows.length === 1 && memberships.rows[0].userId === owner.id && memberships.rows[0].role === 'OWNER', 'HTTP venue did not atomically grant its session actor ownership.');
    step = 'owner-only night and preset configuration';
    const nightCommand = { label: 'Synthetic access HTTP night', startingOccupancy: 0, openingFloatCents: 10000, currency: 'USD' };
    const openPath = `/api/venues/${venueId}/nights`;
    check((await send(openPath, nightCommand, staffCookie)).status === 403, 'Unassigned account opened another owner venue.');
    const opened = await send(openPath, nightCommand, ownerCookie); check(opened.status === 200, 'Owner night opening failed.');
    const nightBody = await opened.json() as { data?: { night?: { id?: string } } }; const nightId = nightBody.data?.night?.id;
    check(typeof nightId === 'string', 'Open-night response omitted its night ID.');
    check((await send(openPath, nightCommand, ownerCookie)).status === 409, 'A second open night was accepted.');
    const newPresets = presets.map((preset) => ({ ...preset, amountCents: preset.amountCents + 500 }));
    const presetPath = `/api/venues/${venueId}/presets`;
    check((await send(presetPath, { presets: newPresets }, staffCookie, 'PATCH')).status === 403, 'Unassigned account changed cover presets.');
    check((await send(presetPath, { presets: newPresets }, ownerCookie, 'PATCH', 'https://untrusted.invalid')).status === 403, 'Cross-origin preset edit was accepted.');
    check((await send(presetPath, { presets: newPresets }, ownerCookie, 'PATCH')).status === 200, 'Owner preset edit failed.');
    const read = await request(`/api/nights/${nightId}/door-state`, { headers: { Cookie: ownerCookie } });
    const state = await read.json() as { data?: { presets?: { amountCents: number }[] } };
    check(read.status === 200 && state.data?.presets?.[0]?.amountCents === 1500, 'Updated preset was not visible through the existing ledger route.');
    step = 'invitation routing and account verification';
    const invitePath = `/api/nights/${nightId}/invites`;
    check((await send(invitePath, { intendedEmail: staff.email }, staffCookie)).status === 403, 'Unassigned account created an invite.');
    const invited = await send(invitePath, { intendedEmail: staff.email }, ownerCookie); check(invited.status === 200 && invited.headers.get('cache-control')?.includes('no-store'), 'Owner invitation failed or exposed cacheable credentials.');
    const inviteBody = await invited.json() as { data?: { id?: string; inviteUrl?: string } }; check(typeof inviteBody.data?.id === 'string' && typeof inviteBody.data.inviteUrl === 'string', 'Invite link is missing.');
    const link = new URL(inviteBody.data.inviteUrl); check(link.origin === origin, 'Invite link used an untrusted origin.');
    check(!link.search && link.pathname === '/invites/accept', 'Invite credentials must not appear in a query string.');
    const secret = new URLSearchParams(link.hash.slice(1)).get('token'); check(secret, 'Invite token is missing.');
    step = 'pending invitation cancellation';
    const cancelled = await request(`/api/nights/${nightId}/invites/${inviteBody.data.id}`, { method: 'DELETE', headers: { Origin: origin, Cookie: ownerCookie } });
    check(cancelled.status === 200, 'Body-free pending invite cancellation failed.');
    const cancelledRecord = await pool.query('SELECT "revokedAt" FROM staff_invite WHERE id=$1', [inviteBody.data.id]);
    check(cancelledRecord.rows[0]?.revokedAt instanceof Date, 'Invite cancellation did not persist revocation.');
    check((await send('/api/invites/accept', { token: secret }, staffCookie)).status === 400, 'Cancelled invite was accepted.');
    const replacement = await send(invitePath, { intendedEmail: staff.email }, ownerCookie);
    check(replacement.status === 200, 'Replacement invitation failed.');
    const replacementBody = await replacement.json() as { data?: { inviteUrl?: string } };
    check(typeof replacementBody.data?.inviteUrl === 'string', 'Replacement invitation link is missing.');
    const replacementLink = new URL(replacementBody.data.inviteUrl);
    check(replacementLink.origin === origin && !replacementLink.search, 'Replacement invite credentials have an unsafe origin/query.');
    const replacementSecret = new URLSearchParams(replacementLink.hash.slice(1)).get('token'); check(replacementSecret, 'Replacement token is missing.');
    step = 'database verified-account invitation acceptance';
    const accepted = await send('/api/invites/accept', { token: replacementSecret }, staffCookie);
    check(accepted.status === (staff.emailVerified ? 200 : 400), 'Invitation acceptance did not enforce the database account verification state.');
    if (!staff.emailVerified) {
      const assignments = await pool.query('SELECT 1 FROM night_assignment WHERE "nightId"=$1 AND "userId"=$2', [nightId, staff.id]);
      check(assignments.rows.length === 0, 'Unverified account received a night assignment.');
    } else {
      const revoked = await request(`/api/nights/${nightId}/assignments/${encodeURIComponent(staff.id)}`, { method: 'DELETE', headers: { Origin: origin, Cookie: ownerCookie } });
      check(revoked.status === 200, 'Body-free assignment revocation failed.');
    }
    console.log('PASS venue/access HTTP: verified session ownership, atomic venue creation, owner-only night/preset configuration, shared ledger visibility, trusted invite origin, pending invite cancellation and database email-verification enforcement. No account verification bypass, outbound email or production acceptance.');
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: failed; raw diagnostics withheld to protect credentials.`);
  } finally {
    try { if (child) await stopServer(child); } finally {
      try {
        const created = await pool.query<{ id: string }>('SELECT id FROM venue WHERE name=$1', [marker]);
        for (const { id } of created.rows) {
          await pool.query('DELETE FROM reconciliation WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM door_event WHERE "venueId"=$1 AND type=\'REVERSAL\'', [id]);
          await pool.query('DELETE FROM door_event WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM staff_invite WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM night_assignment WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM night WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM cover_preset WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM venue_membership WHERE "venueId"=$1', [id]);
          await pool.query('DELETE FROM venue WHERE id=$1', [id]);
        }
        if (tokens.length) await pool.query('DELETE FROM session WHERE token=ANY($1::text[])', [tokens]);
      } finally { await pool.end(); }
    }
  }
}
await verify().catch((error: unknown) => { console.error(`FAIL venue/access HTTP verification: ${error instanceof VerificationFailure ? error.message : 'Check local database, migrations, auth:init and auth:seed.'}`); process.exitCode = 1; });
