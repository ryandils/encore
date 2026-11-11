import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { hashPassword } from 'better-auth/crypto';
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
async function phoneLayout(page: Page, kind: 'owner' | 'staff door'): Promise<void> {
  console.log('CHECKPOINT owner workspace: checking layout viewport.');
  check(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1), 'The owner/staff workspace overflows a 320px viewport.');
  console.log('CHECKPOINT owner workspace: checking visible control dimensions.');
  const controls = page.locator('main button, main input:not([type="hidden"]), main select, main textarea, main a, header a');
  check(await controls.count() > 0, 'No workspace controls were available for layout verification.');
  for (const [index, control] of (await controls.all()).entries()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    if (!bounds || bounds.width < 44 || bounds.height < 44) {
      const tag = await control.evaluate((element) => element.tagName.toLowerCase());
      const dimensions = bounds ? `${bounds.width.toFixed(1)} by ${bounds.height.toFixed(1)}` : 'unavailable';
      throw new BrowserVerificationFailure(`${kind} control index ${index}, tag ${tag}, dimensions ${dimensions}: visible controls must be at least 44 by 44 CSS pixels.`);
    }
  }
}
async function countIs(page: Page, value: number): Promise<void> {
  await page.waitForFunction((expected) => document.querySelector('[data-testid="occupancy"]')?.textContent === String(expected), value, { timeout: 15000 });
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
  check(!quoted && field === '', 'The downloaded CSV did not contain complete quoted records.'); return rows;
}

/** Synthetic verified staff is a database fixture, never evidence of a real verification email. */
async function verify(): Promise<void> {
  check(!process.env.DEBUG && !process.env.PWDEBUG, 'Unset DEBUG and PWDEBUG before browser verification; debug output can expose local credentials.');
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 4, connectionTimeoutMillis: 5000 });
  const marker = `Synthetic owner workspace ${randomUUID()}`;
  const staffId = `synthetic-workspace-staff-${randomUUID()}`;
  const staffEmail = `${staffId}@encore-demo.invalid`;
  const pendingEmail = `synthetic-pending-${randomUUID()}@encore-demo.invalid`;
  const password = randomBytes(32).toString('base64url');
  const tokens: string[] = [];
  const contexts: BrowserContext[] = [];
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  let pageError = false;
  let unexpectedDialog = false;
  let step = 'local prerequisites';
  try {
    check(process.env.BETTER_AUTH_SECRET && process.env.DEMO_OWNER_PASSWORD, 'Run auth:init and auth:seed before owner workspace verification.');
    const ownerRows = await pool.query<{ id: string }>('SELECT id FROM "user" WHERE email=$1', ['owner@encore-demo.invalid']);
    const ownerId = ownerRows.rows[0]?.id; check(ownerId, 'Synthetic seeded owner account is missing.');
    step = 'explicit synthetic verified credential fixture';
    await pool.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,true,now(),now())', [staffId, 'Synthetic browser verified staff fixture', staffEmail]);
    await pool.query('INSERT INTO account (id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES ($1,$2,$2,\'credential\',$3,now(),now())', [`credential-${staffId}`, staffId, await hashPassword(password)]);
    step = 'development server';
    const origin = `http://127.0.0.1:${await availablePort()}`;
    let failed = false;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', new URL(origin).port], {
      cwd: root, env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin }, stdio: 'ignore', detached: process.platform !== 'win32',
    });
    child.once('error', () => { failed = true; });
    let ready = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      check(!failed && child.exitCode === null, 'Test server did not start; stop other development servers in this checkout.');
      try { const response = await fetch(`${origin}/api/demo/session`, { signal: AbortSignal.timeout(5000), redirect: 'manual' }); await response.text(); if (response.status === 401) { ready = true; break; } } catch { /* Startup compilation. */ }
      await delay(250);
    }
    check(ready, 'Owner workspace server did not become ready.');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, timeout: 30000 });
    const browserVersion = browser.version();
    async function login(email: string, secret: string): Promise<{ context: BrowserContext; page: Page }> {
      check(browser, 'Browser unavailable.');
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true }); contexts.push(context);
      const response = await context.request.post(`${origin}/api/auth/sign-in/email`, { headers: { Origin: origin }, data: { email, password: secret }, timeout: 30000 });
      check(response.status() === 200, 'Synthetic cookie login failed.');
      const value = await response.json() as { token?: string }; check(typeof value.token === 'string', 'Session token is missing.'); tokens.push(value.token);
      const page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
      page.on('pageerror', () => { pageError = true; });
      page.on('dialog', async (dialog) => { if (dialog.type() === 'beforeunload') await dialog.accept(); else { unexpectedDialog = true; await dialog.dismiss(); } });
      return { context, page };
    }
    step = 'separate owner/staff browser sessions';
    const owner = await login('owner@encore-demo.invalid', process.env.DEMO_OWNER_PASSWORD);
    const staff = await login(staffEmail, password);
    await owner.page.goto(`${origin}/local/owner`, { waitUntil: 'domcontentloaded' });
    await owner.page.getByRole('heading', { name: 'Local owner workspace', exact: true }).waitFor();
    await owner.page.getByRole('button', { name: 'Create venue', exact: true }).waitFor({ state: 'visible' });
    console.log('CHECKPOINT owner workspace: initial layout start.');
    await phoneLayout(owner.page, 'owner');
    console.log('CHECKPOINT owner workspace: initial layout passed.');
    step = 'venue creation and night opening through forms';
    const createForm = owner.page.locator('form').filter({ has: owner.page.getByRole('button', { name: 'Create venue', exact: true }) });
    step = 'venue form: venue name';
    await createForm.getByLabel('Venue name', { exact: true }).fill(marker);
    step = 'venue form: timezone';
    await createForm.getByLabel('Timezone', { exact: true }).fill('UTC');
    step = 'venue form: capacity';
    await createForm.getByLabel('Capacity', { exact: true }).fill('100');
    for (const [slot, amount] of [[1, '5'], [2, '10'], [3, '20']] as const) {
      step = `venue form: cover ${slot} label`;
      await createForm.getByLabel(`Cover ${slot} label`, { exact: true }).fill(`Synthetic cover ${slot}`);
      step = `venue form: cover ${slot} amount`;
      await createForm.getByLabel(`Cover ${slot} amount USD`, { exact: true }).fill(amount);
    }
    let venuePosts = 0; let venueCommittedBeforeDrop = false;
    const venuePattern = '**/api/venues';
    const dropCreatedVenue = async (route: Route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      venuePosts++;
      const response = await route.fetch(); venueCommittedBeforeDrop = response.status() === 200;
      await route.abort('failed');
    };
    step = 'venue create: install lost-acknowledgement interceptor';
    await owner.page.route(venuePattern, dropCreatedVenue);
    step = 'venue create: submit form';
    await createForm.getByRole('button', { name: 'Create venue', exact: true }).click();
    step = 'venue create: wait for unknown acknowledgement';
    await owner.page.getByText(/Outcome unknown/i).waitFor();
    check(venueCommittedBeforeDrop && venuePosts === 1, 'Venue creation did not commit before its acknowledgement was lost.');
    check(await createForm.getByRole('button', { name: 'Create venue', exact: true }).isDisabled(), 'Unknown venue creation allowed a blind duplicate submission.');
    step = 'venue create: manual authoritative rediscovery';
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/venues' && response.request().method() === 'GET' && response.status() === 200), owner.page.getByRole('button', { name: 'Refresh server data', exact: true }).click()]);
    await owner.page.unroute(venuePattern, dropCreatedVenue);
    check(venuePosts === 1, 'Venue rediscovery repeated the non-idempotent create request.');
    step = 'venue create: persisted unique venue';
    const venues = await pool.query<{ id: string }>('SELECT id FROM venue WHERE name=$1', [marker]); const venueId = venues.rows[0]?.id;
    check(venueId && venues.rows.length === 1, 'UI did not create exactly one synthetic venue.');
    step = 'venue create: select recovered venue';
    await owner.page.getByLabel('Venue', { exact: true }).selectOption(venueId);
    const openForm = owner.page.locator('form').filter({ has: owner.page.getByRole('button', { name: 'Open night', exact: true }) });
    step = 'night form: label';
    await openForm.getByLabel('Night label', { exact: true }).fill('=Synthetic browser night');
    step = 'night form: starting occupancy';
    await openForm.getByLabel('Starting occupancy', { exact: true }).fill('0');
    step = 'night form: opening float';
    await openForm.getByLabel('Opening float USD', { exact: true }).fill('100');
    step = 'night create: submit and authoritative acknowledgement';
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/venues/${venueId}/nights` && response.request().method() === 'POST' && response.status() === 200), openForm.getByRole('button', { name: 'Open night', exact: true }).click()]);
    const nights = await pool.query<{ id: string }>('SELECT id FROM night WHERE "venueId"=$1', [venueId]); const nightId = nights.rows[0]?.id;
    check(nightId && nights.rows.length === 1, 'UI did not create exactly one synthetic night.');
    console.log('CHECKPOINT owner workspace: venue and night forms passed.');
    step = 'fragment-only explicit invitation acceptance';
    const inviteForm = owner.page.locator('form').filter({ has: owner.page.getByRole('button', { name: 'Create staff invite', exact: true }) });
    await inviteForm.getByLabel('Staff email', { exact: true }).fill(staffEmail);
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/nights/${nightId}/invites` && response.request().method() === 'POST' && response.status() === 200), inviteForm.getByRole('button', { name: 'Create staff invite', exact: true }).click()]);
    const inviteField = owner.page.getByLabel('Invitation link — shown once', { exact: true }); await inviteField.waitFor();
    const inviteUrl = await inviteField.inputValue(); const inviteLink = new URL(inviteUrl);
    check(inviteLink.origin === origin && !inviteLink.search && inviteLink.pathname === '/invites/accept', 'UI invitation used an unsafe origin or token query string.');
    const secret = new URLSearchParams(inviteLink.hash.slice(1)).get('token'); check(secret, 'UI invitation fragment was missing.');
    let acceptedWithoutClick = false;
    let tokenInRequestUrl = false;
    staff.page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.search.includes(secret)) tokenInRequestUrl = true;
      if (url.pathname === '/api/invites/accept' && request.method() === 'POST') acceptedWithoutClick = true;
    });
    await staff.page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
    const acceptButton = staff.page.getByRole('button', { name: /Accept.*invit/i }); await acceptButton.waitFor();
    await staff.page.waitForFunction(() => window.location.hash === '' && !window.location.search.includes('token'));
    check(!acceptedWithoutClick && !tokenInRequestUrl, 'Opening an invitation submitted it automatically or placed its token in a request URL.');
    const storedToken = await staff.page.evaluate((value) => [localStorage, sessionStorage].some((storage) => Object.values(storage).some((entry: unknown) => typeof entry === 'string' && entry.includes(value))), secret);
    check(!storedToken, 'Invite token was persisted in browser storage.');
    await Promise.all([staff.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/invites/accept' && response.status() === 200), acceptButton.click()]);
    const doorLink = staff.page.locator(`a[href$="/nights/${nightId}/door"]`); await doorLink.waitFor(); await doorLink.click();
    await countIs(staff.page, 0); await phoneLayout(staff.page, 'staff door');
    check(!tokenInRequestUrl, 'Invitation acceptance exposed its token in a request URL.');
    console.log('CHECKPOINT owner workspace: explicit invitation acceptance passed.');
    check(!/Expected cover|Expected drawer|Counted cash|Cash variance/i.test(await staff.page.locator('main').textContent() ?? ''), 'Staff door disclosed owner financial summaries.');
    step = 'shared four paid entries and exit';
    const paid10 = staff.page.getByRole('button', { name: /\$10.*Paid entry/ });
    for (let index = 0; index < 4; index++) await paid10.click();
    await countIs(staff.page, 4); await staff.page.getByRole('button', { name: /^Exit/ }).click(); await countIs(staff.page, 3);
    step = 'owner price edit and immutable admission charges';
    const pricesForm = owner.page.locator('form').filter({ has: owner.page.getByRole('button', { name: 'Save cover prices', exact: true }) });
    await pricesForm.getByLabel('Cover 2 amount USD', { exact: true }).fill('15');
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/venues/${venueId}/presets` && response.request().method() === 'PATCH' && response.status() === 200), pricesForm.getByRole('button', { name: 'Save cover prices', exact: true }).click()]);
    await staff.page.getByRole('button', { name: 'Refresh door state', exact: true }).click();
    const paid15 = staff.page.getByRole('button', { name: /\$15.*Paid entry/ });
    await paid15.click(); await countIs(staff.page, 4);
    await owner.page.getByRole('button', { name: 'Refresh server data', exact: true }).click();
    await owner.page.waitForFunction(() => { const text = document.querySelector('main')?.textContent ?? ''; return /\$55(?:\.00)?\b/.test(text) && /\$155(?:\.00)?\b/.test(text); });
    const cover = await pool.query('SELECT sum("amountCents")::int AS cover FROM door_event WHERE "nightId"=$1', [nightId]); check(cover.rows[0]?.cover === 5500, 'Price edit changed historical charges or failed to save the new admission.');
    step = 'pending invitation cancellation';
    await inviteForm.getByLabel('Staff email', { exact: true }).fill(pendingEmail);
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/nights/${nightId}/invites` && response.request().method() === 'POST' && response.status() === 200), inviteForm.getByRole('button', { name: 'Create staff invite', exact: true }).click()]);
    const cancel = owner.page.getByRole('button', { name: `Cancel invite for ${pendingEmail}`, exact: true }); await cancel.waitFor();
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname.includes(`/api/nights/${nightId}/invites/`) && response.request().method() === 'DELETE' && response.status() === 200), cancel.click()]);
    const cancelled = await pool.query('SELECT "revokedAt" FROM staff_invite WHERE "nightId"=$1 AND "intendedEmail"=$2', [nightId, pendingEmail]); check(cancelled.rows[0]?.revokedAt instanceof Date, 'UI pending invitation cancellation did not persist.');
    step = 'access revocation disables an already-open staff screen';
    await owner.page.getByRole('button', { name: 'Refresh server data', exact: true }).click();
    const revoke = owner.page.getByRole('button', { name: `Revoke access for ${staffEmail}`, exact: true }); await revoke.waitFor();
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname.includes(`/api/nights/${nightId}/assignments/`) && response.request().method() === 'DELETE' && response.status() === 200), revoke.click()]);
    await staff.page.getByRole('button', { name: 'Refresh door state', exact: true }).click();
    const door = staff.page.locator('section[aria-label="Door console"]'); await door.getByRole('alert').waitFor();
    await door.locator('button:disabled').filter({ hasText: /^\$15/ }).waitFor({ state: 'visible' });
    check(await paid15.isDisabled(), 'Revoked staff can still submit from the open screen.');
    console.log('CHECKPOINT owner workspace: admissions, pricing and access controls passed.');
    step = 'unknown close acknowledgement survives reload';
    await owner.page.getByLabel('Counted cash including float USD', { exact: true }).fill('150');
    const notes = '=SUM(1,2), "synthetic"\nnotes'; await owner.page.getByLabel('Closing notes', { exact: true }).fill(notes);
    await owner.page.getByRole('button', { name: 'Review closeout', exact: true }).click();
    await owner.page.getByRole('heading', { name: 'Close this night?', exact: true }).waitFor();
    const closeBodies: { requestId?: string; countedCashCents?: number; notes?: string }[] = [];
    let dropped = false; let closedBeforeDrop = false;
    const closePattern = `**/api/nights/${nightId}/close`;
    const intercept = async (route: Route) => {
      closeBodies.push(route.request().postDataJSON() as { requestId?: string; countedCashCents?: number; notes?: string });
      if (!dropped) { dropped = true; const response = await route.fetch(); closedBeforeDrop = response.status() === 200; await route.abort('failed'); }
      else await route.continue();
    };
    await owner.page.route(closePattern, intercept); await owner.page.getByRole('button', { name: 'Confirm closeout', exact: true }).click();
    const retry = owner.page.getByRole('button', { name: 'Retry original closeout', exact: true }); await retry.waitFor();
    check(closedBeforeDrop && closeBodies.slice().length === 1, 'Closeout did not commit before its acknowledgement was lost.');
    step = 'unknown closeout: lost owner membership clears financial data';
    const removed = await pool.query('DELETE FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2', [venueId, ownerId]);
    check(removed.rowCount === 1, 'Synthetic owner membership was unavailable for the orphan recovery test.');
    await owner.page.getByRole('button', { name: 'Refresh server data', exact: true }).click();
    await owner.page.waitForFunction(() => !/Expected cover|Expected drawer cash/.test(document.querySelector('main')?.textContent ?? ''));
    await retry.waitFor();
    step = 'unknown closeout: orphaned request survives reload';
    await owner.page.reload({ waitUntil: 'domcontentloaded' }); await retry.waitFor();
    await owner.page.getByRole('heading', { name: 'Unresolved closeout request', exact: true }).waitFor();
    for (const name of ['Create venue', 'Open night', 'Save cover prices', 'Create staff invite', 'Confirm closeout']) {
      const control = owner.page.getByRole('button', { name, exact: true });
      for (const button of await control.all()) if (await button.isVisible()) check(await button.isDisabled(), 'Reload enabled a mutation while closeout remained unresolved.');
    }
    step = 'unknown closeout: forbidden retry retains its original journal';
    await Promise.all([owner.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/nights/${nightId}/close` && response.request().method() === 'POST' && response.status() === 403), retry.click()]);
    await retry.waitFor();
    await owner.page.getByRole('heading', { name: 'Unresolved closeout request', exact: true }).waitFor();
    step = 'unknown closeout: restore membership and recover the same receipt';
    await pool.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\')', [venueId, ownerId]);
    await owner.page.getByRole('button', { name: 'Refresh server data', exact: true }).click();
    await retry.click(); await retry.waitFor({ state: 'hidden' }); await owner.page.unroute(closePattern, intercept);
    check(closeBodies.length === 3 && closeBodies.every((body) => body.requestId === closeBodies[0].requestId && body.countedCashCents === 15000 && body.notes === notes), 'Recovered closeout changed its request ID or immutable command.');
    await owner.page.getByText('Cash variance', { exact: true }).waitFor();
    await owner.page.waitForFunction(() => /-\$5(?:\.00)?\b/.test(document.querySelector('main')?.textContent ?? ''));
    const reconciled = await pool.query('SELECT "requestId","countedCashCents","expectedCoverCents","expectedDrawerCents","varianceCents","closedBy" FROM reconciliation WHERE "nightId"=$1', [nightId]);
    check(reconciled.rows.length === 1 && reconciled.rows[0].requestId === closeBodies[0].requestId && reconciled.rows[0].countedCashCents === 15000 && reconciled.rows[0].expectedCoverCents === 5500 && reconciled.rows[0].expectedDrawerCents === 15500 && reconciled.rows[0].varianceCents === -500 && reconciled.rows[0].closedBy === ownerId, 'Closeout was duplicated, repriced or overwritten.');
    console.log('CHECKPOINT owner workspace: orphaned closeout recovery passed.');
    step = 'closed history survives reload and downloads an audit CSV';
    await owner.page.reload({ waitUntil: 'domcontentloaded' }); await owner.page.getByText('Cash variance', { exact: true }).waitFor();
    await owner.page.waitForFunction(() => /-\$5(?:\.00)?\b/.test(document.querySelector('main')?.textContent ?? ''));
    await owner.page.getByRole('heading', { name: 'Closed · read only', exact: true }).waitFor();
    check(await owner.page.getByRole('button', { name: 'Review closeout', exact: true }).count() === 0, 'Closed history still exposes a mutable closeout form.');
    const [download] = await Promise.all([owner.page.waitForEvent('download'), owner.page.getByRole('button', { name: 'Download night CSV', exact: true }).click()]);
    check(download.suggestedFilename() === `synthetic-encore-${nightId}.csv`, 'Downloaded filename was not the synthetic canonical night ID.');
    const path = await download.path(); check(path, 'Audit download did not produce a local file.');
    const rows = readCsv(await readFile(path, 'utf8')); const header = rows[0]; check(header, 'Audit CSV header missing.');
    const column = (name: string) => { const index = header.indexOf(name); check(index >= 0, 'Audit CSV column missing.'); return index; };
    check(header.length === 25 && rows.every((row) => row.length === header.length), 'Audit CSV record widths do not match the metadata header.');
    check(rows.slice(1).every((row) => row[column('synthetic')] === 'true'), 'Downloaded CSV did not label synthetic records.');
    const snapshot = rows.find((row) => row[column('recordType')] === 'night'); check(snapshot && snapshot[column('startingOccupancy')] === '0' && snapshot[column('openingFloatCents')] === '10000' && snapshot[column('timezone')] === 'UTC' && snapshot[column('capacity')] === '100' && snapshot[column('currency')] === 'USD' && snapshot[column('nightLabel')] === "'=Synthetic browser night", 'Audit CSV omitted the opening baseline.');
    const close = rows.find((row) => row[column('recordType')] === 'reconciliation'); check(close && close[column('varianceCents')] === '-500' && close[column('expectedCoverCents')] === '5500' && close[column('expectedDrawerCents')] === '15500' && close[column('notes')] === `'${notes}`, 'Audit CSV changed totals or failed formula/quote/newline escaping.');
    const closedWrite = await owner.context.request.post(`${origin}/api/nights/${nightId}/events`, { headers: { Origin: origin }, data: { type: 'FREE_ADMISSION', requestId: randomUUID() } }); check(closedWrite.status() === 409, 'Closed history accepted a new event.');
    console.log('CHECKPOINT owner workspace: audit CSV passed; final layout start.');
    await phoneLayout(owner.page, 'owner'); await phoneLayout(staff.page, 'staff door');
    console.log('CHECKPOINT owner workspace: final layout passed.');
    check(!pageError && !unexpectedDialog, 'Workspace journey reported an uncaught page error or unexpected dialog.');
    console.log(`PASS Chromium ${browserVersion}: 320px owner setup with unknown-create rediscovery, synthetic verified staff fragment acceptance, shared persisted door actions and immutable pricing, pending cancellation/revocation, unknown close surviving lost membership and reload with identical forbidden/successful retries, read-only closed history and formula-safe audit download. Two isolated synthetic contexts are not physical devices, real email verification or pilot acceptance.`);
  } catch (error) {
    throw new BrowserVerificationFailure(error instanceof BrowserVerificationFailure ? `${step}: ${error.message}` : `${step}: browser verification failed; raw diagnostics withheld to protect credentials.`);
  } finally {
    try {
      for (const context of contexts) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    } finally {
      try { if (child) await stopServer(child); } finally {
        try {
          const venues = await pool.query<{ id: string }>('SELECT id FROM venue WHERE name=$1', [marker]);
          for (const { id } of venues.rows) {
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
          await pool.query('DELETE FROM session WHERE "userId"=$1', [staffId]);
          await pool.query('DELETE FROM account WHERE "userId"=$1', [staffId]);
          await pool.query('DELETE FROM "user" WHERE id=$1', [staffId]);
        } finally { await pool.end(); }
      }
    }
  }
}
await verify().catch((error: unknown) => { console.error(`FAIL owner workspace browser verification: ${error instanceof BrowserVerificationFailure ? error.message : 'Check local database, auth setup and Chromium.'}`); process.exitCode = 1; });
