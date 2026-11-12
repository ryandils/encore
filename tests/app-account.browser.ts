import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { hashPassword } from 'better-auth/crypto';
import type { Browser, BrowserContext, Page } from 'playwright';
import pg from 'pg';
import { localEnvironment, root } from '../scripts/db-local.ts';
import type { CapturedAuthEmail } from '../src/server/auth-lifecycle.ts';

class BrowserVerificationFailure extends Error {}
function check(value: unknown, message: string): asserts value { if (!value) throw new BrowserVerificationFailure(message); }
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
async function phoneLayout(page: Page): Promise<void> {
  check(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1), 'Account UI overflows the 320px viewport.');
  for (const control of await page.locator('main button, main input:not([type="hidden"]), main a').all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    check(bounds && bounds.width >= 44 && bounds.height >= 44, 'Account controls must be at least 44 by 44 CSS pixels.');
  }
}

/** Real local forms and captured links; accounts begin unverified and are never verified by SQL. */
async function verify(): Promise<void> {
  check(!process.env.DEBUG && !process.env.PWDEBUG, 'Unset DEBUG and PWDEBUG before browser checks; debug logs may expose credentials.');
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 4, connectionTimeoutMillis: 5000 });
  const ids = [`account-browser-${randomUUID()}`, `account-browser-${randomUUID()}`];
  const emails = ids.map((id) => `${id}@encore-tests.invalid`);
  const password = randomBytes(24).toString('hex');
  const replacement = randomBytes(24).toString('hex');
  const captureDirectory = join(root, '.local-auth-mail');
  const consumedFiles = new Set<string>();
  const contexts: BrowserContext[] = [];
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  let pageError = false;
  let pageCrashed = false;
  let browserDisconnected = false;
  let failedScripts = 0;
  let consoleErrors = 0;
  let stateReadError = '';
  const safeError = (error: unknown) => {
    let line = error instanceof Error ? `${error.name}: ${error.message.split('\n', 1)[0]}` : 'Unknown error';
    for (const secret of [password, replacement, ...emails, ...capturedTokens]) line = line.replaceAll(secret, '[redacted]');
    return line.slice(0, 240);
  };
  let diagnosticPage: Page | undefined;
  let tokenInUrl = false;
  const capturedTokens: string[] = [];
  let step = 'local prerequisites';
  let seedIds: string[] = [];
  let beforeSeeds: string | undefined;
  const seedSnapshot = async () => JSON.stringify((await Promise.all([
    pool.query('SELECT * FROM "user" WHERE id=ANY($1::text[]) ORDER BY id', [seedIds]),
    pool.query('SELECT * FROM account WHERE "userId"=ANY($1::text[]) ORDER BY id', [seedIds]),
    pool.query('SELECT * FROM session WHERE "userId"=ANY($1::text[]) ORDER BY id', [seedIds]),
    pool.query('SELECT * FROM demo_identity WHERE "userId"=ANY($1::text[]) ORDER BY "userId"', [seedIds]),
  ])).map((result) => result.rows));
  async function captures() {
    let names: string[];
    try { names = await readdir(captureDirectory); } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
    const matches: { name: string; message: CapturedAuthEmail }[] = [];
    for (const name of names.filter((entry) => /^[0-9a-f-]{36}\.json$/.test(entry))) {
      const message = JSON.parse(await readFile(join(captureDirectory, name), 'utf8')) as CapturedAuthEmail;
      if (emails.includes(message.email)) matches.push({ name, message });
    }
    return matches;
  }
  async function capture(email: string, kind: CapturedAuthEmail['kind']) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const found = (await captures()).find((entry) => entry.message.email === email && entry.message.kind === kind && !consumedFiles.has(entry.name));
      if (found) { consumedFiles.add(found.name); capturedTokens.push(found.message.token); return found.message; }
      await delay(100);
    }
    throw new BrowserVerificationFailure('Expected a private synthetic capture file.');
  }
  try {
    check(process.env.BETTER_AUTH_SECRET, 'Run auth:init before account browser verification.');
    seedIds = (await pool.query<{ userId: string }>('SELECT "userId" FROM demo_identity')).rows.map((row) => row.userId);
    beforeSeeds = await seedSnapshot();
    for (let index = 0; index < ids.length; index++) {
      await pool.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,false,now(),now())', [ids[index], 'Synthetic account browser fixture', emails[index]]);
      await pool.query('INSERT INTO account (id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES ($1,$2,$2,\'credential\',$3,now(),now())', [`credential-${ids[index]}`, ids[index], await hashPassword(password)]);
    }
    step = 'development server';
    const origin = `http://127.0.0.1:${await availablePort()}`;
    let failed = false;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', new URL(origin).port], {
      cwd: root, env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin, ENCORE_AUTH_CAPTURE: '1' }, stdio: 'ignore', detached: process.platform !== 'win32',
    });
    child.once('error', () => { failed = true; });
    let ready = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      check(!failed && child.exitCode === null, 'Test server did not start. Stop any other development server in this checkout.');
      try { const response = await fetch(`${origin}/api/local-auth/get-session`, { signal: AbortSignal.timeout(5000), redirect: 'manual' }); const session: unknown = await response.json(); if (response.status === 200 && session === null) { ready = true; break; } } catch { /* Startup compilation. */ }
      await delay(250);
    }
    check(ready, 'Account test server did not become ready.');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, timeout: 30000 });
    browser.on('disconnected', () => { browserDisconnected = true; });
    async function context() {
      check(browser, 'Browser unavailable.');
      const value = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' }); contexts.push(value); return value;
    }
    async function page(value: BrowserContext) {
      const result = await value.newPage(); result.setDefaultTimeout(30000); result.setDefaultNavigationTimeout(60000);
      result.on('pageerror', () => { pageError = true; });
      result.on('crash', () => { pageCrashed = true; });
      result.on('requestfailed', (request) => { if (request.resourceType() === 'script') failedScripts++; });
      result.on('console', (message) => { if (message.type() === 'error') consoleErrors++; });
      result.on('request', (request) => { if (capturedTokens.some((token) => request.url().includes(token))) tokenInUrl = true; });
      return result;
    }
    const target = await context(); const other = await context(); const legacy = await context();
    const targetPage = await page(target);
    diagnosticPage = targetPage;
    async function waitForRateLimit(response: { status(): number; headers(): Record<string, string> }) {
      if (response.status() !== 429) return false;
      const seconds = Number(response.headers()['retry-after'] ?? response.headers()['x-retry-after']);
      check(Number.isInteger(seconds) && seconds > 0 && seconds <= 60, 'Rate limit did not supply a bounded retry delay.');
      console.log(`CHECKPOINT account browser: respecting 429 Retry-After ${seconds}s.`);
      await delay(seconds * 1000);
      return true;
    }
    const post = async (value: BrowserContext, path: string, data: Record<string, unknown>) => {
      const send = () => value.request.post(`${origin}${path}`, { headers: { Origin: origin }, data, timeout: 30000 });
      const response = await send();
      return await waitForRateLimit(response) ? send() : response;
    };
    const submit = async (view: Page, button: string, endpoint: string) => {
      step = `account form ${endpoint}: wait for button`;
      await view.getByRole('button', { name: button, exact: true }).waitFor({ state: 'visible' });
      step = `account form ${endpoint}: submit and await response`;
      const send = async () => {
        const [response] = await Promise.all([view.waitForResponse((response) => new URL(response.url()).pathname === `/api/local-auth/${endpoint}` && response.request().method() === 'POST'), view.getByRole('button', { name: button, exact: true }).click()]);
        console.log(`CHECKPOINT account browser: ${endpoint} responded ${response.status()}.`);
        return response;
      };
      const response = await send();
      if (!await waitForRateLimit(response)) return response.status();
      // A 429 rejects before token/password handling; retry once after the server delay.
      await view.locator('main').getByRole('alert').waitFor();
      return (await send()).status();
    };
    async function signIn(secret: string) {
      step = 'sign-in: navigation';
      await targetPage.goto(`${origin}/local/account`, { waitUntil: 'domcontentloaded' });
      console.log('CHECKPOINT account browser: sign-in navigation completed.');
      step = 'sign-in: fill email';
      await targetPage.getByLabel('Email', { exact: true }).fill(emails[0]);
      step = 'sign-in: fill password';
      await targetPage.getByLabel('Password', { exact: true }).fill(secret);
      return submit(targetPage, 'Sign in', 'sign-in/email');
    }
    async function requestMail(kind: CapturedAuthEmail['kind']) {
      const verification = kind === 'verification';
      await targetPage.goto(`${origin}/local/account/${verification ? 'verify' : 'reset'}`, { waitUntil: 'domcontentloaded' });
      await targetPage.getByLabel('Email', { exact: true }).fill(emails[0]);
      check(await submit(targetPage, verification ? 'Request verification link' : 'Request recovery link', verification ? 'send-verification-email' : 'request-password-reset') === 200, 'Email request form failed.');
      await phoneLayout(targetPage);
      return capture(emails[0], kind);
    }
    async function openToken(message: CapturedAuthEmail) {
      check(new URL(message.url).origin === origin && !new URL(message.url).search, 'Capture link was not local and fragment-only.');
      step = 'captured link: navigation';
      await targetPage.goto(message.url, { waitUntil: 'domcontentloaded' });
      step = 'captured link: fragment scrub';
      await targetPage.waitForFunction(() => window.location.hash === '' && !window.location.search);
      check(!await targetPage.evaluate((token) => [localStorage, sessionStorage].some((storage) => Object.values(storage).some((value: unknown) => typeof value === 'string' && value.includes(token))), message.token), 'Token was persisted in browser storage.');
      check(!(await targetPage.locator('body').textContent())?.includes(message.token), 'Token was rendered into the page.');
      step = 'captured link: explicit confirmation control';
      await targetPage.getByRole('button', { name: message.kind === 'verification' ? 'Verify email' : 'Replace password', exact: true }).waitFor();
      await phoneLayout(targetPage);
    }

    step = 'unverified sessions: legacy sign-in';
    check((await post(legacy, '/api/auth/sign-in/email', { email: emails[0], password })).status() === 200, 'Legacy synthetic sign-in prerequisite failed.');
    console.log('CHECKPOINT account browser: legacy sign-in completed.');
    step = 'unverified sessions: protected venue denial';
    check((await legacy.request.get(`${origin}/api/venues`)).status() === 401, 'Unverified non-demo legacy session bypassed application verification.');
    console.log('CHECKPOINT account browser: unverified legacy session denied.');
    check(await signIn(password) === 403, 'Unverified application sign-in was allowed.');
    step = 'unverified sign-in: visible error';
    await targetPage.locator('main').getByRole('alert').waitFor();
    console.log('CHECKPOINT account browser: unverified sign-in error visible.');
    step = 'unverified sign-in: phone layout';
    await phoneLayout(targetPage);
    check(await targetPage.locator('a[href="/demo/sign-in"]').count() > 0, 'Separate labeled demo entry disappeared.');
    step = 'unverified sign-in: keyboard focus';
    await targetPage.getByLabel('Email', { exact: true }).focus(); await targetPage.keyboard.press('Tab');
    check(await targetPage.getByLabel('Password', { exact: true }).evaluate((element) => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), 'Keyboard focus is not visible.');

    step = 'expired verification and resend through actual forms';
    const expired = await requestMail('verification');
    await pool.query('UPDATE verification SET "expiresAt"=now()-interval \'1 second\' WHERE value=$1', [ids[0]]);
    await openToken(expired);
    check(await submit(targetPage, 'Verify email', 'verify-email') === 400, 'Expired verification was accepted.');
    await targetPage.locator('main').getByRole('alert').waitFor();
    const fresh = await requestMail('verification');
    check(fresh.token !== expired.token, 'Resend reused a token.');
    await openToken(fresh);
    check((await pool.query('SELECT "emailVerified" FROM "user" WHERE id=$1', [ids[0]])).rows[0]?.emailVerified === false, 'Opening a verification link changed account state before an explicit click.');
    check(await submit(targetPage, 'Verify email', 'verify-email') === 200, 'Explicit verification failed.');
    check((await pool.query('SELECT "emailVerified" FROM "user" WHERE id=$1', [ids[0]])).rows[0]?.emailVerified === true, 'Verification did not persist.');
    await openToken(fresh);
    check(await submit(targetPage, 'Verify email', 'verify-email') === 400, 'Verification replay succeeded.');
    await target.addCookies(await legacy.cookies());
    check(await signIn(password) === 200, 'Verified form sign-in failed.');
    check(await (await legacy.request.get(`${origin}/api/auth/get-session`)).json() === null, 'App sign-in did not revoke the presented legacy session.');
    await targetPage.waitForURL(`${origin}/local/owner`);
    check((await target.request.get(`${origin}/api/venues`)).status() === 200, 'Verified app session did not authorize local owner discovery.');

    step = 'independent other account';
    check((await post(other, '/api/local-auth/send-verification-email', { email: emails[1] })).status() === 200, 'Other verification request failed.');
    const otherMail = await capture(emails[1], 'verification');
    check((await post(other, '/api/local-auth/verify-email', { token: otherMail.token })).status() === 200, 'Other account verification failed.');
    check((await post(other, '/api/local-auth/sign-in/email', { email: emails[1], password })).status() === 200, 'Other account sign-in failed.');

    step = 'reset form replaces password and revokes prior sessions';
    const reset = await requestMail('password-reset');
    await openToken(reset);
    await targetPage.getByLabel('New password', { exact: true }).fill(replacement);
    await targetPage.getByLabel('Confirm password', { exact: true }).fill(replacement);
    check(await submit(targetPage, 'Replace password', 'reset-password') === 200, 'Reset password form failed.');
    check((await target.request.get(`${origin}/api/venues`)).status() === 401, 'Reset retained an existing target app session.');
    check((await other.request.get(`${origin}/api/venues`)).status() === 200, 'Reset revoked another account session.');
    check(await signIn(password) === 401, 'Old password still signs in.');
    check(await signIn(replacement) === 200, 'Replacement password cannot sign in.');
    await targetPage.waitForURL(`${origin}/local/owner`);

    step = 'neutral recovery and no public enrollment or capture endpoint';
    const known = await post(other, '/api/local-auth/request-password-reset', { email: emails[1] });
    const unknown = await post(other, '/api/local-auth/request-password-reset', { email: `absent-${randomUUID()}@encore-tests.invalid` });
    check(known.status() === unknown.status() && JSON.stringify(await known.json()) === JSON.stringify(await unknown.json()), 'Recovery responses disclose account existence.');
    check((await post(other, '/api/local-auth/sign-up/email', { email: emails[1], password, name: 'Synthetic' })).status() === 404, 'Public enrollment was exposed.');
    const privateFile = [...consumedFiles][0]; check(privateFile, 'Capture file was not observed.');
    check((await other.request.get(`${origin}/.local-auth-mail/${privateFile}`)).status() === 404, 'Private captures were exposed over HTTP.');
    step = 'revoked app session cannot fall through to a different legacy account';
    check((await post(legacy, '/api/auth/sign-in/email', { email: emails[1], password })).status() === 200, 'Different legacy account prerequisite failed.');
    await target.addCookies(await legacy.cookies());
    await pool.query('DELETE FROM session WHERE "userId"=$1', [ids[0]]);
    check(await (await target.request.get(`${origin}/api/local-auth/get-session`)).json() === null, 'Revoked app session remained active.');
    const selected = (await target.cookies()).find((cookie) => cookie.name === 'encore-app-auth.selected');
    check(selected?.httpOnly && selected.expires > Date.now() / 1000, 'App session selection was not retained privately after revocation.');
    check((await target.request.get(`${origin}/api/venues`)).status() === 401, 'Revoked app session fell through to another legacy account.');
    check((await legacy.request.get(`${origin}/api/venues`)).status() === 200, 'Different legacy account prerequisite was not a valid session.');
    check(await signIn(replacement) === 200, 'App reauthentication after revocation failed.');
    await targetPage.waitForURL(`${origin}/local/owner`);
    check(await (await legacy.request.get(`${origin}/api/auth/get-session`)).json() === null, 'App reauthentication did not revoke the other presented legacy session.');

    step = 'dual-cookie sign-out cannot resurrect a different legacy account';
    check((await post(legacy, '/api/auth/sign-in/email', { email: emails[1], password })).status() === 200, 'Verified legacy session prerequisite failed.');
    await target.addCookies(await legacy.cookies());
    await targetPage.goto(`${origin}/local/account`, { waitUntil: 'domcontentloaded' });
    check(await submit(targetPage, 'Sign out', 'sign-out') === 200, 'App sign-out failed.');
    check((await target.request.get(`${origin}/api/venues`)).status() === 401, 'App sign-out fell through to a legacy identity.');
    check(await (await legacy.request.get(`${origin}/api/auth/get-session`)).json() === null, 'App sign-out did not revoke the presented legacy session.');
    check(await seedSnapshot() === beforeSeeds, 'Account flow changed existing seeded records.');
    check(!pageError && !tokenInUrl, 'Account journey had a page error or exposed a token in a network URL.');
    console.log(`PASS Chromium ${browser.version()}: 320px account verification/resend/expiry/replay, verified sign-in, reset/password replacement/session isolation, demo-session bypass denial, private fragment captures, keyboard focus and scoped cleanup. Synthetic local browser evidence only; no email sent.`);
  } catch (error) {
    if (diagnosticPage && !diagnosticPage.isClosed()) {
      const state = await diagnosticPage.evaluate(() => ({
        path: window.location.pathname,
        controls: Array.from(document.querySelectorAll('main input, main button')).map((element) => ({
          tag: element.tagName, id: element.id, type: element.getAttribute('type'),
          disabled: element.hasAttribute('disabled'), visible: element.getClientRects().length > 0,
          labelCount: element instanceof HTMLInputElement ? element.labels?.length : undefined,
        })),
      })).catch((error: unknown) => { stateReadError = safeError(error); return null; });
      console.log(`CHECKPOINT account browser safe state: ${JSON.stringify(state)}`);
    }
    const diagnostic = { pageCrashed, browserDisconnected, failedScripts, consoleErrors, stateReadError, pageClosed: diagnosticPage?.isClosed(),
      disabledControl: error instanceof Error && error.message.includes('element is not enabled'),
      targetClosed: error instanceof Error && /Target.*closed|has been closed/.test(error.message),
      contextDestroyed: error instanceof Error && error.message.includes('Execution context was destroyed'),
      pageCrashedMessage: error instanceof Error && error.message.includes('Page crashed'),
    };
    console.log(`CHECKPOINT account browser failure category: ${JSON.stringify(diagnostic)}`);
    const kind = error instanceof Error && error.name === 'TimeoutError' ? 'browser timeout' : 'browser verification failed';
    throw new BrowserVerificationFailure(error instanceof BrowserVerificationFailure ? `${step}: ${error.message}` : `${step}: ${kind}; pageError=${pageError}; raw diagnostics withheld to protect credentials.`);
  } finally {
    try { for (const context of contexts) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {}); }
    finally {
      try { if (child) await stopServer(child); }
      finally {
        try {
          for (const { name } of await captures()) await unlink(join(captureDirectory, name));
          await pool.query('DELETE FROM verification WHERE value=ANY($1::text[])', [ids]);
          await pool.query('DELETE FROM session WHERE "userId"=ANY($1::text[])', [ids]);
          await pool.query('DELETE FROM account WHERE "userId"=ANY($1::text[])', [ids]);
          await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [ids]);
          check((await pool.query('SELECT id FROM "user" WHERE id=ANY($1::text[])', [ids])).rows.length === 0, 'Synthetic fixture cleanup failed.');
          if (beforeSeeds !== undefined) check(await seedSnapshot() === beforeSeeds, 'Cleanup changed existing seeded records.');
        } finally { await pool.end(); }
      }
    }
  }
}
await verify().catch((error: unknown) => { console.error(`FAIL account browser verification: ${error instanceof BrowserVerificationFailure ? error.message : 'Check local database, auth setup and Chromium.'}`); process.exitCode = 1; });
