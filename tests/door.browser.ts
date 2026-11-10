import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against a local development server: node tests/door.browser.ts [http://localhost:3000].
const origin = new URL(process.argv[2] ?? 'http://localhost:3000');
assert.equal(origin.protocol, 'http:', 'Use a local HTTP development server.');
assert(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Only loopback fixture servers are allowed.');
assert(!origin.username && !origin.password, 'Do not supply credentials.');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 780 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/demo/door', origin).href);
  await page.getByRole('heading', { name: 'Keep the door moving.', exact: true }).waitFor();
  const occupancy = page.getByTestId('occupancy');
  const waitCount = async (value: number) => { await page.waitForFunction((count) => document.querySelector('[data-testid="occupancy"]')?.textContent === String(count), value); };
  await waitCount(0);
  const paid = page.getByRole('button', { name: /^\$10 Paid entry/ });
  for (let index = 0; index < 4; index++) await paid.click();
  await waitCount(4);
  await page.getByRole('button', { name: /^Exit No cover refund/ }).click();
  await waitCount(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm undo', exact: true }).click();
  await waitCount(4);
  await page.getByText('Demo connection controls', { exact: true }).click();
  await page.getByLabel('Next save outcome').selectOption('unknown');
  await paid.click();
  await page.getByRole('button', { name: 'Retry same request', exact: true }).waitFor();
  assert(await paid.isDisabled(), 'New taps must stop while an outcome is unknown.');
  await page.getByRole('button', { name: 'Retry same request', exact: true }).click();
  await waitCount(5);
  await page.getByLabel('Next save outcome').selectOption('reject');
  await paid.click();
  await page.getByRole('button', { name: 'Cancel rejected and unsent taps', exact: true }).waitFor();
  assert.equal(await occupancy.textContent(), '5', 'Rejected action changed occupancy.');
  await page.getByRole('button', { name: 'Retry same request', exact: true }).click();
  await waitCount(6);
  await page.getByRole('button', { name: /^Free entry \$0/ }).click();
  await waitCount(7);
  await page.getByLabel('Simulate disconnected adapter').check();
  await page.getByRole('button', { name: 'Refresh door state', exact: true }).click();
  await page.getByText('Stale count — not a current headcount.', { exact: true }).waitFor({ timeout: 15000 });
  assert(await paid.isDisabled(), 'Disconnected adapter allowed new taps.');
  assert.equal(await occupancy.textContent(), '7');
  await page.getByLabel('Simulate disconnected adapter').uncheck();
  await page.getByRole('button', { name: 'Refresh door state', exact: true }).click();
  await page.waitForFunction(() => !document.body.textContent?.includes('Disconnected / sync failed'));
  // The action journey is intentionally fixture-only and never enters account credentials.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 780 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow at ${width}px`);
    const controls = await page.locator('main button:visible').evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { name: button.textContent, width: rect.width, height: rect.height };
    }));
    for (const control of controls) assert(control.width >= 44 && control.height >= 44, `Small control: ${control.name}`);
  }
  await page.reload();
  await waitCount(0);
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement !== document.body), 'Keyboard focus did not reach a control.');
  assert.deepEqual(errors, [], 'Browser page errors');
  console.log(`PASS synthetic door browser: Chromium ${browser.version()}, four paid admissions, exit, undo, free entry, rejected/unknown retry, stale recovery, refresh reset, keyboard focus and 320px/390px thumb targets. No live backend or physical-device evidence.`);
} finally {
  await browser.close();
}
