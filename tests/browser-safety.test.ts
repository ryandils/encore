import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test.each(['DEBUG', 'PWDEBUG'])('browser verification rejects %s before loading Playwright', (flag) => {
  const owner = 'synthetic-owner-canary-not-a-secret';
  const staff = 'synthetic-staff-canary-not-a-secret';
  const script = `
    import { createRequire } from 'node:module';
    import { BrowserVerificationFailure, verifyDemoBrowser } from ${JSON.stringify(new URL('./demo.browser.ts', import.meta.url).href)};
    const require = createRequire(${JSON.stringify(import.meta.url)});
    try {
      await verifyDemoBrowser('http://127.0.0.1:1', { owner: ${JSON.stringify(owner)}, staff: ${JSON.stringify(staff)} });
      process.exitCode = 1;
    } catch (error) {
      const loadedBrowser = Object.keys(require.cache).some((path) => /[\\\\/]playwright(?:-core)?[\\\\/]/.test(path));
      if (!(error instanceof BrowserVerificationFailure) || !error.message.startsWith('Unset DEBUG and PWDEBUG') || loadedBrowser) process.exitCode = 1;
      else console.log('PASS refused debug logging before browser import');
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, DEBUG: '', PWDEBUG: '', [flag]: flag === 'DEBUG' ? 'pw:api,pw:protocol' : '1' },
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('PASS refused debug logging before browser import');
  expect(`${result.stdout}${result.stderr}`).not.toContain(owner);
  expect(`${result.stdout}${result.stderr}`).not.toContain(staff);
});
