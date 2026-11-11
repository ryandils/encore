import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import type { Browser, BrowserContext, Page, Route } from 'playwright';
import pg from 'pg';
import { localEnvironment, root } from '../scripts/db-local.ts';

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
async function countIs(page: Page, expected: number): Promise<void> {
  await page.waitForFunction((value) => document.querySelector('[data-testid="occupancy"]')?.textContent === String(value), expected, { timeout: 15000 });
}
async function phoneLayout(page: Page): Promise<void> {
  check(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1), 'The live door overflows its 320px viewport.');
  const controls = page.locator('main button, main input:not([type="hidden"]), main select, main a, header a');
  check(await controls.count() > 0, 'No live door controls were available for layout verification.');
  for (const control of await controls.all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    check(bounds && bounds.width >= 44 && bounds.height >= 44, 'A visible live door control is smaller than 44 by 44 CSS pixels.');
  }
}

/** Real Chromium, two isolated cookie jars and local PostgreSQL; no physical-device claim. */
async function verify(): Promise<void> {
  check(!process.env.DEBUG && !process.env.PWDEBUG, 'Unset DEBUG and PWDEBUG before browser verification; debug output can expose local passwords.');
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 4, connectionTimeoutMillis: 5000 });
  const venue = randomUUID(), night = randomUUID(), otherVenue = randomUUID(), otherNight = randomUUID();
  const tokens: string[] = [];
  const contexts: BrowserContext[] = [];
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  let pageError = false;
  let step = 'local prerequisites';
  try {
    check(process.env.BETTER_AUTH_SECRET && process.env.DEMO_OWNER_PASSWORD && process.env.DEMO_STAFF_PASSWORD, 'Run auth:init and auth:seed before the live door browser verifier.');
    const users = await pool.query<{ id: string; email: string }>('SELECT id,email FROM "user" WHERE email=ANY($1::text[])', [['owner@encore-demo.invalid', 'staff@encore-demo.invalid']]);
    const owner = users.rows.find((user) => user.email === 'owner@encore-demo.invalid');
    const staff = users.rows.find((user) => user.email === 'staff@encore-demo.invalid');
    check(owner && staff, 'Synthetic seeded owner/staff accounts are missing.');
    step = 'unique synthetic venue/night fixtures';
    await pool.query('INSERT INTO venue (id,name,timezone,capacity) VALUES ($1,\'Synthetic browser door\',\'UTC\',100),($2,\'Synthetic unrelated browser venue\',\'UTC\',100)', [venue, otherVenue]);
    await pool.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\'),($1,$3,\'STAFF\')', [venue, owner.id, staff.id]);
    await pool.query('INSERT INTO night (id,"venueId",label,"openedAt",capacity,timezone,"openingFloatCents") VALUES ($1,$2,\'Synthetic persisted browser night\',now(),100,\'UTC\',10000),($3,$4,\'Synthetic unrelated night\',now(),100,\'UTC\',0)', [night, venue, otherNight, otherVenue]);
    for (const [slot, amount] of [[1, 1000], [2, 1500], [3, 2000]]) await pool.query('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,$2,$3,$4)', [venue, slot, `Synthetic cover ${slot}`, amount]);
    await pool.query('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,now()-interval \'1 minute\',now()+interval \'1 hour\')', [night, venue, staff.id]);
    step = 'development HTTP server';
    const origin = `http://127.0.0.1:${await availablePort()}`;
    let failed = false;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', new URL(origin).port], {
      cwd: root, env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin }, stdio: 'ignore', detached: process.platform !== 'win32',
    });
    child.once('error', () => { failed = true; });
    let ready = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      check(!failed && child.exitCode === null, 'Test server did not start; stop other Next development servers in this checkout.');
      try { const response = await fetch(`${origin}/api/demo/session`, { signal: AbortSignal.timeout(5000), redirect: 'manual' }); await response.text(); if (response.status === 401) { ready = true; break; } } catch { /* Startup compilation. */ }
      await delay(250);
    }
    check(ready, 'Live door server did not become ready.');
    // Refuse unsafe debug settings before loading Playwright or handling any form values.
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, timeout: 30000 });
    const version = browser.version();
    async function loggedIn(email: string, password: string): Promise<{ context: BrowserContext; page: Page }> {
      check(browser, 'Browser is unavailable.');
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' }); contexts.push(context);
      const response = await context.request.post(`${origin}/api/auth/sign-in/email`, { headers: { Origin: origin }, data: { email, password }, timeout: 30000 });
      check(response.status() === 200, 'Synthetic browser cookie login failed.');
      const session = await response.json() as { token?: string }; check(typeof session.token === 'string', 'Session token is missing.'); tokens.push(session.token);
      const page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
      page.on('pageerror', () => { pageError = true; });
      return { context, page };
    }
    step = 'separate authenticated browser contexts';
    const staffBrowser = await loggedIn(staff.email, process.env.DEMO_STAFF_PASSWORD);
    const ownerBrowser = await loggedIn(owner.email, process.env.DEMO_OWNER_PASSWORD);
    const url = `${origin}/nights/${night}/door`;
    await staffBrowser.page.goto(url, { waitUntil: 'domcontentloaded' });
    await ownerBrowser.page.goto(url, { waitUntil: 'domcontentloaded' });
    await countIs(staffBrowser.page, 0); await countIs(ownerBrowser.page, 0);
    await staffBrowser.page.getByText('Local persisted rehearsal — synthetic data only', { exact: true }).waitFor();
    await phoneLayout(staffBrowser.page); await phoneLayout(ownerBrowser.page);
    const staffText = await staffBrowser.page.locator('main').textContent() ?? '';
    check(!/Expected cover|Expected drawer|Opening float|Counted cash|Variance|Close night|Export CSV/i.test(staffText), 'Staff door exposes owner finance or configuration controls.');
    const wrongVenue = await staffBrowser.context.request.get(`${origin}/api/nights/${otherNight}/door-state`);
    check(wrongVenue.status() === 403, 'Browser cookie read another venue night.');
    const paidButton = staffBrowser.page.getByRole('button', { name: /\$10.*Paid entry/ });
    step = 'four paid admissions and one exit';
    for (let count = 0; count < 4; count++) await paidButton.click();
    await countIs(staffBrowser.page, 4);
    await staffBrowser.page.getByRole('button', { name: /^Exit/ }).click();
    await countIs(staffBrowser.page, 3);
    await ownerBrowser.page.getByRole('button', { name: 'Refresh door state', exact: true }).click();
    await countIs(ownerBrowser.page, 3);
    const recorded = await pool.query('SELECT count(*)::int AS count,sum("amountCents")::int AS cover FROM door_event WHERE "nightId"=$1', [night]);
    check(recorded.rows[0]?.count === 5 && recorded.rows[0]?.cover === 4000, 'Browser actions did not persist four paid entries and an exit.');
    step = 'reload persistence and shared acknowledged state';
    await staffBrowser.page.reload({ waitUntil: 'domcontentloaded' }); await countIs(staffBrowser.page, 3);
    await ownerBrowser.page.reload({ waitUntil: 'domcontentloaded' }); await countIs(ownerBrowser.page, 3);
    step = 'lost acknowledgement and same-request retry';
    let dropped = false;
    let committedBeforeDrop = false;
    const requestIds: string[] = [];
    const pattern = `**/api/nights/${night}/events`;
    const intercept = async (route: Route) => {
      const body = route.request().postDataJSON() as { requestId?: string };
      if (typeof body.requestId === 'string') requestIds.push(body.requestId);
      if (!dropped) {
        dropped = true;
        const response = await route.fetch(); committedBeforeDrop = response.status() === 200;
        await route.abort('failed');
      } else await route.continue();
    };
    await staffBrowser.page.route(pattern, intercept);
    await paidButton.click();
    await staffBrowser.page.getByRole('button', { name: 'Retry same request', exact: true }).waitFor();
    check(committedBeforeDrop && requestIds.slice().length === 1, 'The interrupted request did not commit before its acknowledgement was lost.');
    step = 'reload retains the original unresolved request';
    await staffBrowser.page.reload({ waitUntil: 'domcontentloaded' });
    const recover = staffBrowser.page.getByRole('button', { name: 'Retry unresolved action', exact: true });
    await recover.waitFor();
    await staffBrowser.page.getByRole('heading', { name: 'Unresolved saved request', exact: true }).waitFor();
    check((await staffBrowser.page.locator('main').textContent() ?? '').includes(requestIds[0]), 'Reload omitted the original unresolved request ID.');
    check(await staffBrowser.page.getByRole('heading', { name: 'Admit one person', exact: true }).count() === 0, 'Reload mounted entry controls while an unresolved request remained.');
    const blockedPaid = staffBrowser.page.getByRole('button', { name: /\$10.*Paid entry/ });
    check(await blockedPaid.count() === 0 || await blockedPaid.isDisabled(), 'Reload allowed a new admission before the unresolved request was acknowledged.');
    await recover.click();
    await recover.waitFor({ state: 'hidden' });
    await countIs(staffBrowser.page, 4);
    await staffBrowser.page.unroute(pattern, intercept);
    check(requestIds.length === 2 && requestIds[0] === requestIds[1], 'Retry changed the original committed request ID.');
    const retries = await pool.query('SELECT count(*)::int AS count FROM door_event WHERE "nightId"=$1 AND "requestId"=$2', [night, requestIds[0]]);
    check(retries.rows[0]?.count === 1, 'Lost-acknowledgement recovery duplicated an event.');
    await ownerBrowser.page.getByRole('button', { name: 'Refresh door state', exact: true }).click(); await countIs(ownerBrowser.page, 4);
    step = 'revocation of an already-open staff screen';
    check(await paidButton.isEnabled(), 'Paid entry did not recover before the assignment revocation test.');
    await pool.query('UPDATE night_assignment SET "revokedAt"=now() WHERE "nightId"=$1 AND "userId"=$2', [night, staff.id]);
    await staffBrowser.page.getByRole('button', { name: 'Refresh door state', exact: true }).click();
    const door = staffBrowser.page.locator('section[aria-label="Door console"]');
    await door.getByRole('alert').waitFor();
    // Next.js also owns a global route-announcer alert. Wait for this console's actual
    // permission error and disabled admission control, not that unrelated announcement.
    await door.locator('button:disabled').filter({ hasText: /^\$10/ }).waitFor({ state: 'visible' });
    check(await paidButton.isDisabled(), 'Revoked staff can still submit admissions from the open screen.');
    const revokedWrite = await staffBrowser.context.request.post(`${origin}/api/nights/${night}/events`, { headers: { Origin: origin }, data: { type: 'FREE_ADMISSION', requestId: randomUUID() } });
    check(revokedWrite.status() === 403, 'Revoked staff cookie can still record an admission.');
    await phoneLayout(staffBrowser.page);
    check(!pageError, 'Live door journey reported an uncaught page error.');
    console.log(`PASS Chromium ${version}: two isolated synthetic cookie sessions at 320px, persisted paid entries/exit, reload and shared refresh, lost acknowledgement surviving reload with gated identical retry/no duplicate, wrong-venue rejection, open-screen revocation, 44px controls and no overflow/page errors. No physical devices, screenshots, traces, production accounts or pilot acceptance.`);
  } catch (error) {
    throw new BrowserVerificationFailure(error instanceof BrowserVerificationFailure ? `${step}: ${error.message}` : `${step}: browser verification failed; raw diagnostics withheld to protect credentials.`);
  } finally {
    try {
      for (const context of contexts) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    } finally {
      try { if (child) await stopServer(child); } finally {
        try {
          await pool.query('DELETE FROM reconciliation WHERE "nightId"=ANY($1::uuid[])', [[night, otherNight]]);
          await pool.query('DELETE FROM door_event WHERE "nightId"=ANY($1::uuid[]) AND type=\'REVERSAL\'', [[night, otherNight]]);
          await pool.query('DELETE FROM door_event WHERE "nightId"=ANY($1::uuid[])', [[night, otherNight]]);
          await pool.query('DELETE FROM staff_invite WHERE "nightId"=ANY($1::uuid[])', [[night, otherNight]]);
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
}
await verify().catch((error: unknown) => { console.error(`FAIL live door browser verification: ${error instanceof BrowserVerificationFailure ? error.message : 'Check local database, auth setup and Chromium.'}`); process.exitCode = 1; });
