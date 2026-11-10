import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { seedAuth } from '../scripts/auth-seed.ts';
import { createLocalClient, localEnvironment, root } from '../scripts/db-local.ts';

class VerificationFailure extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new VerificationFailure(message);
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  check(address && typeof address !== 'string', 'Could not reserve a loopback test port.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  await Promise.race([stopped, delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await stopped;
  }
}

/** Explicit local integration command: real HTTP cookies and PostgreSQL, no reset. */
async function verify(): Promise<void> {
  localEnvironment();
  check(process.env.BETTER_AUTH_SECRET, 'Run auth:init before auth:verify.');
  check(process.env.DEMO_OWNER_PASSWORD && process.env.DEMO_STAFF_PASSWORD, 'Local demo passwords are missing; run auth:init.');
  const client = await createLocalClient();
  let child: ChildProcess | undefined;
  const createdTokens = new Set<string>();
  let step = 'credential seed preservation';
  try {
    // Compare with a boolean so a failed check never prints password hashes.
    await seedAuth(client);
    const firstAccounts = await client.account.findMany({ orderBy: { id: 'asc' } });
    const firstUsers = await client.user.findMany({ include: { demoIdentity: true }, orderBy: { id: 'asc' } });
    await seedAuth(client);
    check(JSON.stringify(await client.account.findMany({ orderBy: { id: 'asc' } })) === JSON.stringify(firstAccounts), 'Repeated auth seed changed existing account records.');
    check(JSON.stringify(await client.user.findMany({ include: { demoIdentity: true }, orderBy: { id: 'asc' } })) === JSON.stringify(firstUsers), 'Repeated auth seed changed existing identity records.');

    step = 'development server startup';
    const port = await availablePort();
    const origin = `http://127.0.0.1:${port}`;
    let startupFailed = false;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin },
      // Framework/driver failures may include secrets; never relay raw child logs.
      stdio: 'ignore',
    });
    child.once('error', () => { startupFailed = true; });

    const request = (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    let ready = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      check(!startupFailed && child.exitCode === null, 'Test server failed to start; check the local setup and ensure no other Next dev server holds this checkout.');
      try {
        if ((await request('/api/demo/session')).status === 401) { ready = true; break; }
      } catch { /* Compilation/startup may briefly refuse the connection. */ }
      await delay(250);
    }
    check(ready, 'Test server did not become ready; check migration, auth configuration, and Next development setup.');

    const post = (path: string, body: unknown, cookie?: string, requestOrigin = origin) => request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
    const session = (cookie?: string, query = '') => request(`/api/demo/session${query}`, { headers: cookie ? { Cookie: cookie } : {} });
    const expectRedirect = async (path: string, target: string, cookie?: string) => {
      const response = await request(path, { headers: cookie ? { Cookie: cookie } : {} });
      check([302, 303, 307, 308].includes(response.status), 'Protected demo page did not redirect as expected.');
      const location = response.headers.get('location');
      check(location && new URL(location, origin).pathname === target, 'Protected demo page redirected to an unexpected destination.');
    };

    step = 'anonymous and forged-cookie rejection';
    check((await session()).status === 401, 'Anonymous demo API access was not rejected.');
    check((await session('better-auth.session_token=forged.invalid')).status === 401, 'Forged session cookie was accepted.');
    await expectRedirect('/demo/owner', '/demo/sign-in');
    await expectRedirect('/demo/staff', '/demo/sign-in');

    const ownerEmail = 'owner@encore-demo.invalid';
    const staffEmail = 'staff@encore-demo.invalid';
    const ownerPassword = process.env.DEMO_OWNER_PASSWORD;
    const staffPassword = process.env.DEMO_STAFF_PASSWORD;
    step = 'invalid credentials, signup, and cross-origin rejection';
    check((await post('/api/auth/sign-in/email', { email: ownerEmail, password: `${ownerPassword}-incorrect` })).status === 401, 'Incorrect password was not rejected.');
    check((await post('/api/auth/sign-in/email', { email: ownerEmail, password: ownerPassword }, undefined, 'https://untrusted.invalid')).status === 403, 'Cross-origin sign-in was not rejected with Forbidden.');
    check([403, 404].includes((await post('/api/auth/sign-up/email', { name: 'Synthetic unwanted signup', email: 'unwanted@encore-demo.invalid', password: ownerPassword })).status), 'Public signup was not explicitly disabled.');

    async function login(email: string, password: string): Promise<{ cookie: string; token: string; userId: string }> {
      let response = await post('/api/auth/sign-in/email', { email, password });
      for (let attempt = 0; response.status === 429 && attempt < 2; attempt += 1) {
        // Better Auth 1.7 uses X-Retry-After; also accept the standard header.
        const retryAfter = response.headers.get('retry-after') ?? response.headers.get('x-retry-after');
        const seconds = Number(retryAfter);
        check(retryAfter !== null && Number.isFinite(seconds) && seconds > 0 && seconds <= 60, 'Sign-in rate limit did not supply a bounded retry interval.');
        // Exercise the real limiter; never disable it to make the suite pass.
        await delay(Math.ceil(seconds * 1_000));
        response = await post('/api/auth/sign-in/email', { email, password });
      }
      check(response.status === 200, `Synthetic login did not succeed (HTTP ${response.status}).`);
      const value: unknown = await response.json();
      check(value && typeof value === 'object' && 'token' in value && typeof value.token === 'string', 'Login response did not contain a session token.');
      const token = value.token;
      createdTokens.add(token);
      const stored = await client.session.findUnique({ where: { token } });
      check(stored, 'Login did not create a persisted PostgreSQL session.');
      const setCookies = response.headers.getSetCookie();
      const sessionCookie = setCookies.find((item) => item.split('=', 1)[0]?.endsWith('session_token'));
      check(sessionCookie && /;\s*httponly(?:;|$)/i.test(sessionCookie), 'Session cookie is missing or is not HttpOnly.');
      check(/;\s*samesite=lax(?:;|$)/i.test(sessionCookie), 'Session cookie does not preserve SameSite=Lax.');
      return { cookie: sessionCookie.split(';', 1)[0] ?? '', token, userId: stored.userId };
    }

    step = 'owner and staff sessions and protected navigation';
    const owner = await login(ownerEmail, ownerPassword);
    const staff = await login(staffEmail, staffPassword);
    for (const [identity, role, email] of [[owner, 'OWNER', ownerEmail], [staff, 'STAFF', staffEmail]] as const) {
      const response = await session(identity.cookie);
      check(response.status === 200, 'Authenticated demo session was rejected.');
      const body: unknown = await response.json();
      check(body && typeof body === 'object' && 'role' in body && body.role === role && 'user' in body && body.user && typeof body.user === 'object' && 'email' in body.user && body.user.email === email, 'Demo identity did not match the server-side account.');
      const page = await request(`/demo/${role.toLowerCase()}`, { headers: { Cookie: identity.cookie } });
      check(page.status === 200, 'Authenticated protected demo screen did not load.');
      const text = await page.text();
      check(text.includes(email) && /synthetic/i.test(text), 'Protected demo screen omitted its identity or synthetic label.');
    }
    const spoofed = await session(staff.cookie, '?role=OWNER');
    check(spoofed.status === 200 && (await spoofed.json() as { role?: string }).role === 'STAFF', 'Client-supplied role changed demo navigation identity.');
    await expectRedirect('/demo/owner', '/demo/staff', staff.cookie);
    await expectRedirect('/demo/staff', '/demo/owner', owner.cookie);

    step = 'sign-out and cross-origin protection';
    check((await post('/api/auth/sign-out', {}, owner.cookie, 'https://untrusted.invalid')).status === 403, 'Cross-origin sign-out was not rejected with Forbidden.');
    check((await session(owner.cookie)).status === 200, 'Rejected cross-origin sign-out invalidated the session.');
    check((await post('/api/auth/sign-out', {}, owner.cookie)).status === 200, 'Sign-out failed.');
    check((await session(owner.cookie)).status === 401, 'Signed-out cookie still grants access.');
    check(await client.session.findUnique({ where: { token: owner.token } }) === null, 'Sign-out did not remove the persisted session.');

    step = 'expiry and revocation';
    await client.session.update({ where: { token: staff.token }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    check((await session(staff.cookie)).status === 401, 'Expired cookie still grants access.');
    const revoked = await login(staffEmail, staffPassword);
    await client.session.delete({ where: { token: revoked.token } });
    check((await session(revoked.cookie)).status === 401, 'Revoked cookie still grants access.');

    console.log('PASS real HTTP/PostgreSQL auth: stable credential seed, owner/staff login and persisted sessions, protected navigation, server-derived roles, anonymous/forged/wrong-password/expired/revoked rejection, signup disabled, origin checks, and sign-out invalidation. Production and browser layout are separate checks.');
  } catch (error) {
    // Do not stringify framework, driver, response, cookie, or assertion objects.
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: verification failed; raw diagnostics withheld to protect local credentials.`);
  } finally {
    if (child) await stopServer(child);
    try {
      if (createdTokens.size) await client.session.deleteMany({ where: { token: { in: [...createdTokens] } } });
    } finally { await client.$disconnect(); }
  }
}

await verify().catch((error: unknown) => {
  console.error(`FAIL auth verification: ${error instanceof VerificationFailure ? error.message : 'Local prerequisites failed; check auth:init, auth:seed, database health, and applied migrations.'}`);
  process.exitCode = 1;
});
