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
function readCsv(csv: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') { if (quoted && csv[index + 1] === '"') { field += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && char === '\r' && csv[index + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; index++; }
    else field += char;
  }
  check(!quoted && field.length === 0, 'CSV did not round-trip complete quoted rows.'); return rows;
}

/** Real local account cookies, owner-scoped discovery and downloadable audit CSV; no real email/data. */
async function verify(): Promise<void> {
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 4, connectionTimeoutMillis: 5000 });
  const marker = `Synthetic owner read HTTP ${randomUUID()}`;
  const names = [marker, `${marker} other`];
  const tokens: string[] = [];
  let child: ChildProcess | undefined;
  let step = 'local prerequisites';
  try {
    check(process.env.BETTER_AUTH_SECRET && process.env.DEMO_OWNER_PASSWORD && process.env.DEMO_STAFF_PASSWORD, 'Run auth:init and auth:seed before owner-read HTTP verification.');
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
      check(!failed && child.exitCode === null, 'Test server did not start; stop other Next development servers in this checkout.');
      try { const response = await request('/api/demo/session'); await response.text(); if (response.status === 401) { ready = true; break; } } catch { /* Startup compilation. */ }
      await delay(250);
    }
    check(ready, 'Owner-read HTTP server did not become ready.');
    const post = (path: string, body: unknown, cookie?: string) => request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    const get = (path: string, cookie?: string) => request(path, { headers: cookie ? { Cookie: cookie } : {} });
    async function login(email: string, password: string): Promise<string> {
      const response = await post('/api/auth/sign-in/email', { email, password }); check(response.status === 200, 'Synthetic cookie login failed.');
      const data = await response.json() as { token?: string }; check(typeof data.token === 'string', 'Session token is missing.'); tokens.push(data.token);
      const cookie = response.headers.getSetCookie().find((item) => item.split('=', 1)[0]?.endsWith('session_token')); check(cookie, 'Verified session cookie is missing.'); return cookie.split(';', 1)[0] ?? '';
    }
    step = 'separate real account sessions';
    const owner = await login('owner@encore-demo.invalid', process.env.DEMO_OWNER_PASSWORD);
    const staff = await login('staff@encore-demo.invalid', process.env.DEMO_STAFF_PASSWORD);
    check((await get('/api/venues')).status === 401, 'Anonymous owner discovery was accepted.');
    const presets = [1, 2, 3].map((slot) => ({ slot, label: `Synthetic cover ${slot}`, amountCents: slot * 1000 }));
    async function createVenue(name: string, cookie: string): Promise<string> {
      const response = await post('/api/venues', { name, timezone: 'UTC', capacity: 100, presets }, cookie); check(response.status === 200, 'Synthetic venue creation failed.');
      const body = await response.json() as { data?: { id?: string } }; check(typeof body.data?.id === 'string', 'Venue ID missing.'); return body.data.id;
    }
    const venue = await createVenue(names[0], owner);
    const unrelatedVenue = await createVenue(names[1], staff);
    step = 'owner-scoped venue and night discovery';
    const listed = await get('/api/venues', owner); check(listed.status === 200 && listed.headers.get('cache-control')?.includes('no-store'), 'Owner venue listing failed or was cacheable.');
    const listedBody = await listed.json() as { data?: { id: string }[] };
    check(Array.isArray(listedBody.data) && listedBody.data.some((item) => item.id === venue) && !listedBody.data.some((item) => item.id === unrelatedVenue), 'Owner venue listing crossed account boundaries.');
    check((await get(`/api/venues/${venue}`, owner)).status === 200, 'Owner venue configuration was unavailable.');
    for (const path of [`/api/venues/${venue}`, `/api/venues/${venue}/nights`]) check((await get(path, staff)).status === 403, 'Another account obtained owner-scoped venue information.');
    const opened = await post(`/api/venues/${venue}/nights`, { label: '=SUM(A1:A2)', startingOccupancy: 0, openingFloatCents: 10000, currency: 'USD' }, owner); check(opened.status === 200, 'Synthetic night creation failed.');
    const openBody = await opened.json() as { data?: { night?: { id?: string } } }; const night = openBody.data?.night?.id; check(typeof night === 'string', 'Night ID missing.');
    const nightsResponse = await get(`/api/venues/${venue}/nights`, owner); check(nightsResponse.status === 200, 'Owner night list failed.');
    const nightsBody = await nightsResponse.json() as { data?: { id: string }[] }; check(Array.isArray(nightsBody.data) && nightsBody.data.some((item) => item.id === night), 'Created night was absent from owner history.');
    step = 'owner-only sanitized access metadata';
    const invited = await post(`/api/nights/${night}/invites`, { intendedEmail: 'staff@encore-demo.invalid' }, owner); check(invited.status === 200, 'Synthetic invitation creation failed.');
    const invitedBody = await invited.json() as { data?: { id?: string; inviteUrl?: string } }; check(typeof invitedBody.data?.inviteUrl === 'string' && typeof invitedBody.data.id === 'string', 'Invite response was incomplete.');
    const secret = new URLSearchParams(new URL(invitedBody.data.inviteUrl).hash.slice(1)).get('token'); check(secret, 'Synthetic token missing.');
    const access = await get(`/api/nights/${night}/access`, owner); check(access.status === 200 && access.headers.get('cache-control')?.includes('no-store'), 'Owner access metadata failed or was cacheable.');
    const accessText = await access.text(); check(accessText.includes(invitedBody.data.id) && !accessText.includes(secret) && !/tokenHash|inviteUrl/.test(accessText), 'Access metadata disclosed a secret or omitted the pending invite.');
    check((await get(`/api/nights/${night}/access`, staff)).status === 403, 'Another account obtained access metadata.');
    step = 'audit events and immutable closeout';
    const first = { type: 'ADMISSION', requestId: randomUUID(), presetSlot: 1, expectedAmountCents: 1000 };
    check((await post(`/api/nights/${night}/events`, first, owner)).status === 200, 'First paid entry failed.');
    const second = await post(`/api/nights/${night}/events`, { ...first, requestId: randomUUID() }, owner); check(second.status === 200, 'Second paid entry failed.');
    const secondBody = await second.json() as { data?: { eventId?: string } }; check(typeof secondBody.data?.eventId === 'string', 'Second event receipt missing.');
    check((await post(`/api/nights/${night}/events`, { type: 'EXIT', requestId: randomUUID() }, owner)).status === 200, 'Synthetic exit failed.');
    check((await post(`/api/nights/${night}/events`, { type: 'REVERSAL', requestId: randomUUID(), targetEventId: secondBody.data.eventId, reason: '@SUM(A1:A2)' }, owner)).status === 200, 'Synthetic reversal failed.');
    check((await post(`/api/nights/${night}/close`, { requestId: randomUUID(), countedCashCents: 10500, notes: '+1+2, "synthetic"\nnotes' }, owner)).status === 200, 'Synthetic close failed.');
    step = 'owner-only downloadable CSV and formula escaping';
    const unauthorized = await get(`/api/nights/${night}/export`, staff);
    check(unauthorized.status === 403 && unauthorized.headers.get('content-type')?.includes('application/json') && !unauthorized.headers.has('content-disposition'), 'Denied export became a downloadable file.');
    const exported = await get(`/api/nights/${night}/export`, owner);
    check(exported.status === 200 && exported.headers.get('content-type')?.startsWith('text/csv') && exported.headers.get('cache-control')?.includes('no-store'), 'Owner export failed or was cacheable.');
    check(exported.headers.get('content-disposition') === `attachment; filename="synthetic-encore-${night}.csv"`, 'Export filename is not derived solely from the canonical night UUID.');
    const rows = readCsv(await exported.text());
    const columns = rows[0]; check(columns, 'CSV header missing.');
    const index = (name: string) => { const position = columns.indexOf(name); check(position >= 0, 'Required audit CSV column is missing.'); return position; };
    check(rows.slice(1).every((row) => row[index('synthetic')] === 'true'), 'Local export failed to label every record as synthetic.');
    const snapshot = rows.find((row) => row[index('recordType')] === 'night'); check(snapshot, 'CSV omitted the night snapshot.');
    check(snapshot[index('startingOccupancy')] === '0' && snapshot[index('openingFloatCents')] === '10000'
      && snapshot[index('timezone')] === 'UTC' && snapshot[index('capacity')] === '100' && snapshot[index('currency')] === 'USD', 'CSV omitted or altered the night metadata needed to interpret the ledger.');
    const reversal = rows.find((row) => row[index('type')] === 'REVERSAL'); check(reversal, 'CSV omitted the reversal record.');
    check(reversal[index('targetEventId')] === secondBody.data.eventId && reversal[index('reason')] === "'@SUM(A1:A2)", 'CSV omitted correction linkage or failed to neutralize its formula-like reason.');
    const close = rows.find((row) => row[index('recordType')] === 'reconciliation'); check(close, 'CSV omitted closeout.');
    check(close[index('varianceCents')] === '-500' && close[index('expectedCoverCents')] === '1000', 'CSV altered numeric cents or repriced reversed history.');
    check(close[index('notes')] === "'+1+2, \"synthetic\"\nnotes" && close[index('nightLabel')] === "'=SUM(A1:A2)", 'CSV failed to quote or neutralize owner-controlled text.');
    console.log('PASS owner-read HTTP: real separate cookie identities, scoped venue/night discovery, sanitized access metadata, owner-only downloadable CSV, reversal audit linkage, immutable closeout, quoted/formula-safe text and numeric cents. No production or physical-device acceptance.');
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: failed; raw diagnostics withheld to protect credentials.`);
  } finally {
    try { if (child) await stopServer(child); } finally {
      try {
        const created = await pool.query<{ id: string }>('SELECT id FROM venue WHERE name=ANY($1::text[])', [names]);
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
await verify().catch((error: unknown) => { console.error(`FAIL owner-read HTTP verification: ${error instanceof VerificationFailure ? error.message : 'Check local database, migrations and auth setup.'}`); process.exitCode = 1; });
