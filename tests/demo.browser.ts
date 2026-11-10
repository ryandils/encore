import type { Locator, Page } from 'playwright';

export class BrowserVerificationFailure extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BrowserVerificationFailure(message);
}

async function verifyPhoneLayout(page: Page): Promise<void> {
  const fits = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1);
  check(fits, 'The demo overflows the narrow phone viewport horizontally.');
  const controls = page.locator('main button, main input:not([type="hidden"]), main select, main a, header a');
  check(await controls.count() > 0, 'The demo has no visible controls to verify.');
  for (const control of await controls.all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    check(bounds && bounds.width >= 44 && bounds.height >= 44, 'A visible demo control is smaller than 44 by 44 CSS pixels.');
  }
}

async function verifyKeyboardFocus(page: Page, control: Locator): Promise<void> {
  let reached = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await control.evaluate((element) => element === document.activeElement)) {
      reached = true;
      break;
    }
  }
  check(reached, 'The demo control could not be reached using the Tab key.');
  const visibleFocus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.matches(':focus-visible') && style.outlineStyle !== 'none'
      && Number.parseFloat(style.outlineWidth) >= 2
      && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.outlineColor);
  });
  check(visibleFocus, 'Keyboard focus does not have a visible outline.');
}

async function verifyIdentity(page: Page, role: 'owner' | 'staff'): Promise<void> {
  await page.getByRole('heading', { name: role === 'owner' ? 'Owner demo' : 'Staff demo', exact: true }).waitFor();
  await page.getByText('Synthetic local demo', { exact: true }).waitFor();
  await page.getByText(`You are signed in with a synthetic ${role} account.`, { exact: true }).waitFor();
  await page.getByText(`${role}@encore-demo.invalid`, { exact: true }).waitFor();
  await verifyPhoneLayout(page);
}

/** Actual form interaction only: no API login, storage injection, traces or screenshots. */
export async function verifyDemoBrowser(origin: string, credentials: { owner: string; staff: string }): Promise<void> {
  // Playwright debug output includes fill arguments. Refuse it before loading the library.
  check(!process.env.DEBUG && !process.env.PWDEBUG, 'Unset DEBUG and PWDEBUG before browser verification; debug output can expose local passwords.');
  let base: URL;
  try { base = new URL(origin); } catch { throw new BrowserVerificationFailure('The browser demo needs an HTTP loopback origin.'); }
  check(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
    && !base.username && !base.password && base.pathname === '/' && !base.search && !base.hash,
  'The browser demo refuses credentials or a non-loopback target.');
  check(credentials.owner && credentials.staff, 'The browser demo needs both generated local passwords.');

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    timeout: 30_000,
  });
  const browserVersion = browser.version();
  try {
    for (const [role, width] of [['owner', 390], ['staff', 320]] as const) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      let completed = false;
      let step = 'anonymous protected navigation and phone layout';
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(30_000);
        page.setDefaultNavigationTimeout(60_000);
        let pageError = false;
        page.on('pageerror', () => { pageError = true; });

        // Each fresh context starts anonymous and must be redirected from a protected page.
        await page.goto(`${base.origin}/demo/${role}`, { waitUntil: 'domcontentloaded' });
        check(new URL(page.url()).pathname === '/demo/sign-in', 'Anonymous protected navigation did not reach sign-in.');
        step = 'sign-in heading';
        await page.getByRole('heading', { name: 'Try the sign-in demo', exact: true }).waitFor();
        step = 'sign-in synthetic label and layout';
        await page.getByText('Synthetic local demo', { exact: true }).waitFor();
        await verifyPhoneLayout(page);

        const account = page.getByLabel('Demo account', { exact: true });
        const password = page.getByLabel('Local demo password', { exact: true });
        const signIn = page.getByRole('button', { name: 'Sign in to demo', exact: true });
        check(await password.getAttribute('type') === 'password', 'The password input does not conceal local credentials.');
        await verifyKeyboardFocus(page, account);
        await verifyKeyboardFocus(page, password);
        await account.selectOption(`${role}@encore-demo.invalid`);

        if (role === 'owner') {
          step = 'incorrect-password feedback';
          await password.fill(`${credentials.owner}-incorrect`);
          await signIn.click();
          await page.getByRole('alert').filter({ hasText: 'Sign-in failed. Check the demo email and local password.' }).waitFor();
          check(new URL(page.url()).pathname === '/demo/sign-in', 'An incorrect password left the sign-in screen.');
          await verifyPhoneLayout(page);
        }

        step = 'form sign-in and synthetic identity';
        await password.fill(credentials[role]);
        await Promise.all([
          page.waitForURL((url) => url.pathname === `/demo/${role}`),
          signIn.click(),
        ]);
        await verifyIdentity(page, role);
        step = 'session persistence after reload';
        await page.reload({ waitUntil: 'domcontentloaded' });
        check(new URL(page.url()).pathname === `/demo/${role}`, 'Reload lost the authenticated demo page.');
        await verifyIdentity(page, role);

        // Navigation privileges come from the server session, including the staff-to-owner denial.
        step = 'server-derived role navigation';
        const otherRole = role === 'owner' ? 'staff' : 'owner';
        await page.goto(`${base.origin}/demo/${otherRole}`, { waitUntil: 'domcontentloaded' });
        check(new URL(page.url()).pathname === `/demo/${role}`, 'The session could navigate to the other role screen.');
        await verifyIdentity(page, role);

        step = 'keyboard focus, UI sign-out and protected-page rejection';
        const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
        await verifyKeyboardFocus(page, signOut);
        await Promise.all([
          page.waitForURL((url) => url.pathname === '/demo/sign-in'),
          signOut.click(),
        ]);
        await page.getByRole('heading', { name: 'Try the sign-in demo', exact: true }).waitFor();
        await page.goto(`${base.origin}/demo/${role}`, { waitUntil: 'domcontentloaded' });
        check(new URL(page.url()).pathname === '/demo/sign-in', 'Signed-out navigation still reached a protected demo page.');
        await verifyPhoneLayout(page);
        check(!pageError, 'The browser reported an uncaught page error during the demo journey.');
        completed = true;
      } catch (error) {
        // Browser errors can include fill arguments; never surface their raw diagnostics.
        throw new BrowserVerificationFailure(`${role} at ${width}px, ${step}: ${error instanceof BrowserVerificationFailure ? error.message : 'Browser interaction failed; raw diagnostics withheld to protect local credentials.'}`);
      } finally {
        if (!completed) {
          // Failure cleanup only; successful verification signs out through the visible button.
          // This context's cookie jar cannot revoke another browser's session.
          await context.request.post(`${base.origin}/api/auth/sign-out`, {
            headers: { Origin: base.origin }, data: {}, timeout: 5_000,
          }).catch(() => {});
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`PASS Chromium ${browserVersion}: actual owner/staff form sign-in at 390px/320px, incorrect-password feedback, persisted refresh, server-derived role navigation, UI sign-out, anonymous rejection, 44px controls, keyboard focus and no horizontal overflow/page errors. No screenshots or traces were saved.`);
}
