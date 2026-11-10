import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { getAuthConfig, getDemoPasswords } from '../src/server/auth-config.ts';
import { BrowserVerificationFailure, verifyDemoBrowser } from '../tests/demo.browser.ts';
import { localEnvironment, root } from './db-local.ts';

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No loopback port.');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function stopServer(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true, timeout: 5_000,
    });
    if (result.status !== 0) await delay(50);
    if (result.status !== 0 && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      throw new BrowserVerificationFailure('Could not confirm Windows test-server tree cleanup.');
    }
  } else {
    const signalGroup = (signal: NodeJS.Signals): boolean => {
      try { process.kill(-pid, signal); return true; } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
        throw new BrowserVerificationFailure('Could not stop the test-server process group.');
      }
    };
    if (signalGroup('SIGTERM')) {
      const deadline = Date.now() + 5_000;
      while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
      signalGroup('SIGKILL');
    }
  }
  const deadline = Date.now() + 2_000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
  if (child.exitCode === null && child.signalCode === null) throw new BrowserVerificationFailure('Test server did not exit after bounded cleanup.');
}

async function verify(): Promise<void> {
  localEnvironment();
  if (process.env.DEBUG || process.env.PWDEBUG) {
    throw new BrowserVerificationFailure('Unset DEBUG and PWDEBUG before browser verification; debug output can expose local passwords.');
  }
  getAuthConfig();
  const credentials = getDemoPasswords();
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  let spawnFailed = false;
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    detached: process.platform !== 'win32',
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: origin },
    // Never relay framework/driver diagnostics, which may contain local credentials.
    stdio: 'ignore',
  });
  child.once('error', () => { spawnFailed = true; });
  try {
    let ready = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (spawnFailed || child.exitCode !== null || child.signalCode !== null) {
        throw new BrowserVerificationFailure('Development server failed to start. Stop other dev servers in this checkout and check local setup.');
      }
      try {
        const response = await fetch(`${origin}/api/demo/session`, {
          redirect: 'manual', signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, deadline - Date.now()))),
        });
        await response.text();
        if (response.status === 401) { ready = true; break; }
      } catch { /* Wait for compilation without exposing child diagnostics. */ }
      await delay(250);
    }
    if (!ready) throw new BrowserVerificationFailure('Demo server did not become ready within 90 seconds. Check migration, seed, and auth setup.');
    await verifyDemoBrowser(origin, { owner: credentials.OWNER, staff: credentials.STAFF });
  } finally {
    await stopServer(child);
  }
  console.log(`PASS browser demo on ${process.platform}/${process.arch}: real owner/staff forms, refresh, sign-out, protected redirects, phone layout, and keyboard focus. Hosted automation is separate from a physical-device walkthrough.`);
}

await verify().catch((error: unknown) => {
  console.error(`FAIL browser verification: ${error instanceof BrowserVerificationFailure ? error.message : 'Check local database/auth setup and installed Chromium. Raw diagnostics withheld to protect credentials.'}`);
  process.exitCode = 1;
});
