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
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
  else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    const deadline = Date.now() + 5000;
    while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
  }
  const deadline = Date.now() + 2000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
  check(child.exitCode !== null || child.signalCode !== null, 'Could not confirm test-server cleanup.');
}

/** Real loopback HTTP cookies and disposable local PostgreSQL fixtures; never resets a database. */
async function verify(): Promise<void> {
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 4, connectionTimeoutMillis: 5000 });
  const venue = randomUUID(), night = randomUUID(), otherVenue = randomUUID(), otherNight = randomUUID();
  const tokens: string[] = [];
  let child: ChildProcess | undefined;
  let step = 'local prerequisites';
  try {
    check(process.env.BETTER_AUTH_SECRET && process.env.DEMO_OWNER_PASSWORD && process.env.DEMO_STAFF_PASSWORD, 'Run auth:init and auth:seed before ledger:http:verify.');
    const users = await pool.query<{ id: string; email: string }>('SELECT id,email FROM "user" WHERE email=ANY($1::text[])', [['owner@encore-demo.invalid', 'staff@encore-demo.invalid']]);
    const owner = users.rows.find((u) => u.email === 'owner@encore-demo.invalid');
    const staff = users.rows.find((u) => u.email === 'staff@encore-demo.invalid');
    check(owner && staff, 'Synthetic seeded owner/staff accounts are missing.');
    step = 'unique synthetic fixtures';
    await pool.query('INSERT INTO venue (id,name,timezone,capacity) VALUES ($1,\'Synthetic HTTP venue\',\'UTC\',100),($2,\'Synthetic other HTTP venue\',\'UTC\',100)', [venue, otherVenue]);
    await pool.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\'),($1,$3,\'STAFF\')', [venue, owner.id, staff.id]);
    await pool.query('INSERT INTO night (id,"venueId",label,"openedAt",capacity,timezone,"openingFloatCents") VALUES ($1,$2,\'Synthetic HTTP night\',now(),100,\'UTC\',10000),($3,$4,\'Synthetic unrelated night\',now(),100,\'UTC\',0)', [night, venue, otherNight, otherVenue]);
    await pool.query('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,1,\'Synthetic cover\',1000)', [venue]);
    await pool.query('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,now()-interval \'1 minute\',now()+interval \'1 hour\')', [night, venue, staff.id]);
    step = 'development HTTP server';
    const origin = `http://127.0.0.1:${await availablePort()}`;
    let failed = false;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', new URL(origin).port], { cwd: root, env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin }, stdio: 'ignore', detached: process.platform !== 'win32' });
    child.once('error', () => { failed = true; });
    const request = (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const route = (operation: string, id = night) => `/api/nights/${id}/${operation}`;
    let ready = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      check(!failed && child.exitCode === null, 'Test server did not start; ensure no other Next dev server owns this checkout.');
      try { if ((await request(route('door-state'))).status === 401) { ready = true; break; } } catch { /* Startup compilation. */ }
      await delay(250);
    }
    check(ready, 'Ledger HTTP server did not become ready.');
    const post = (path: string, body: unknown, cookie?: string, requestOrigin = origin) => request(path, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    async function login(email: string, password: string): Promise<string> {
      const response = await post('/api/auth/sign-in/email', { email, password });
      check(response.status === 200, 'Synthetic cookie login failed.');
      const data = await response.json() as { token?: string }; check(typeof data.token === 'string', 'Session token is missing.'); tokens.push(data.token);
      const cookie = response.headers.getSetCookie().find((c) => c.split('=', 1)[0]?.endsWith('session_token'));
      check(cookie, 'Verified session cookie is missing.'); return cookie.split(';', 1)[0] ?? '';
    }
    step = 'real verified sessions';
    const ownerCookie = await login(owner.email, process.env.DEMO_OWNER_PASSWORD);
    const staffCookie = await login(staff.email, process.env.DEMO_STAFF_PASSWORD);
    const get = (operation: string, cookie: string, id = night) => request(route(operation, id), { headers: { Cookie: cookie } });
    check((await request(route('door-state'), { headers: { Cookie: 'better-auth.session_token=forged.invalid' } })).status === 401, 'Forged cookie grants ledger access.');
    check((await get('door-state', staffCookie, otherNight)).status === 403, 'Wrong-venue ledger read was accepted.');
    check((await get('summary', staffCookie)).status === 403, 'Staff obtained owner summary.');
    check((await post(route('close'), { requestId: randomUUID(), countedCashCents: 0, notes: '' }, staffCookie)).status === 403, 'Staff closed an owner night.');
    const paid = { type: 'ADMISSION', requestId: randomUUID(), presetSlot: 1, expectedAmountCents: 1000 };
    check((await post(route('events'), paid, staffCookie, 'https://untrusted.invalid')).status === 403, 'Cross-origin ledger write was accepted.');
    check((await post(route('events'), { ...paid, actorId: owner.id }, staffCookie)).status === 400, 'Spoofed actor field was accepted.');
    step = 'HTTP duplicate retries and authoritative identity';
    const responses = await Promise.all(Array.from({ length: 4 }, () => post(route('events'), paid, staffCookie)));
    check(responses.every((r) => r.status === 200 && r.headers.get('cache-control')?.includes('no-store')), 'Concurrent retry acknowledgement failed or was cacheable.');
    const stored = await pool.query<{ actorId: string; count: string }>('SELECT "actorId",count(*) FROM door_event WHERE "nightId"=$1 AND "requestId"=$2 GROUP BY "actorId"', [night, paid.requestId]);
    check(stored.rows.length === 1 && stored.rows[0].actorId === staff.id && stored.rows[0].count === '1', 'Retry duplicated an event or persisted a spoofed actor.');
    check((await post(route('events'), { ...paid, expectedAmountCents: 1500 }, staffCookie)).status === 409, 'Changed retry payload was accepted.');
    step = 'HTTP close/write serialization and durable receipts';
    const closing = { requestId: randomUUID(), countedCashCents: 11000, notes: 'Synthetic HTTP close' };
    const race = await Promise.all([post(route('events'), { type: 'EXIT', requestId: randomUUID() }, staffCookie), post(route('close'), closing, ownerCookie)]);
    check([200, 409].includes(race[0].status) && race[1].status === 200, 'HTTP close/write race violated serialization.');
    check((await post(route('close'), closing, ownerCookie)).status === 200, 'Close retry did not acknowledge the stored result.');
    check((await post(route('events'), { type: 'FREE_ADMISSION', requestId: randomUUID() }, staffCookie)).status === 409, 'Closed night accepted a new write.');
    check((await post(route('events'), paid, staffCookie)).status === 200, 'Committed event retry after close was lost.');
    const summary = await get('summary', ownerCookie);
    check(summary.status === 200 && summary.headers.get('cache-control')?.includes('no-store'), 'Owner summary failed or was cacheable.');
    const durable = await pool.query('SELECT "expectedCoverCents","expectedDrawerCents","closedBy" FROM reconciliation WHERE "nightId"=$1', [night]);
    check(durable.rows[0]?.expectedCoverCents === 1000 && durable.rows[0]?.expectedDrawerCents === 11000 && durable.rows[0]?.closedBy === owner.id, 'HTTP close did not persist authoritative totals/identity.');
    step = 'assignment and session revocation over HTTP';
    await pool.query('UPDATE night_assignment SET "revokedAt"=now() WHERE "nightId"=$1 AND "userId"=$2', [night, staff.id]);
    check((await get('door-state', staffCookie)).status === 403, 'Revoked assignment still grants a ledger read.');
    check((await post(route('events'), paid, staffCookie)).status === 403, 'Revoked assignment still grants stored event receipts.');
    await pool.query('DELETE FROM session WHERE token=$1', [tokens[1]]);
    check((await get('door-state', staffCookie)).status === 401, 'Revoked HTTP session still grants ledger access.');
    console.log('PASS ledger HTTP/PostgreSQL: verified cookie identity, cross-venue/staff/origin/spoof rejection, no-store responses, concurrent retries, serialized close/write, durable receipts and assignment/session revocation. Local synthetic HTTP sessions are not physical-device or production acceptance.');
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: failed; raw diagnostics withheld to protect credentials.`);
  } finally {
    try { if (child) await stopServer(child); } finally {
      try {
        await pool.query('DELETE FROM reconciliation WHERE "nightId"=ANY($1::uuid[])', [[night, otherNight]]);
        await pool.query('DELETE FROM door_event WHERE "nightId"=ANY($1::uuid[]) AND type=\'REVERSAL\'', [[night, otherNight]]);
        await pool.query('DELETE FROM door_event WHERE "nightId"=ANY($1::uuid[])', [[night, otherNight]]);
        await pool.query('DELETE FROM night_assignment WHERE "nightId"=ANY($1::uuid[])', [[night, otherNight]]);
        await pool.query('DELETE FROM night WHERE id=ANY($1::uuid[])', [[night, otherNight]]);
        await pool.query('DELETE FROM cover_preset WHERE "venueId"=ANY($1::uuid[])', [[venue, otherVenue]]);
        await pool.query('DELETE FROM venue_membership WHERE "venueId"=ANY($1::uuid[])', [[venue, otherVenue]]);
        await pool.query('DELETE FROM venue WHERE id=ANY($1::uuid[])', [[venue, otherVenue]]);
        if (tokens.length) await pool.query('DELETE FROM session WHERE token=ANY($1::text[])', [tokens]);
      } finally { await pool.end(); }
    }
  }
}
await verify().catch((error: unknown) => { console.error(`FAIL ledger HTTP verification: ${error instanceof VerificationFailure ? error.message : 'Check local database, migrations, auth:init and auth:seed.'}`); process.exitCode = 1; });
