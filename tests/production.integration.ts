import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

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
  check(address && typeof address !== 'string', 'Could not select a loopback test port.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

/** Stop the whole server tree, including any framework subprocesses. */
async function stopServer(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true, timeout: 5_000,
    });
    // spawnSync prevents Node from observing an exit that races with taskkill.
    if (result.status !== 0) await delay(50);
    if (result.status !== 0 && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      throw new VerificationFailure('Could not confirm Windows test-server tree cleanup. Check for the test server before retrying.');
    }
  } else {
    // The detached child leads its own process group; never signal our caller's group.
    const signalGroup = (signal: NodeJS.Signals): boolean => {
      try { process.kill(-pid, signal); return true; } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
        throw new VerificationFailure('Could not stop the test-server process group.');
      }
    };
    if (signalGroup('SIGTERM')) {
      const deadline = Date.now() + 5_000;
      while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
      // Also stop descendants that outlived an already-exited parent.
      signalGroup('SIGKILL');
    }
  }
  const deadline = Date.now() + 2_000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(50);
  check(child.exitCode !== null || child.signalCode !== null, 'Test server did not exit after bounded cleanup.');
}

/** Real optimized-server checks, deliberately independent of PostgreSQL and .env. */
async function verify(): Promise<void> {
  check(existsSync(new URL('../.next/BUILD_ID', import.meta.url)), 'Run pnpm run build before production:verify.');
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  let spawnFailed = false;
  let step = 'optimized server startup';
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    detached: process.platform !== 'win32',
    windowsHide: true,
    // Existing .env values cannot make this check depend on a live database or secrets.
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: 'invalid-production-smoke-database-url',
      BETTER_AUTH_URL: 'invalid-production-smoke-auth-url',
      BETTER_AUTH_SECRET: 'invalid',
      DEMO_OWNER_PASSWORD: 'invalid',
      DEMO_STAFF_PASSWORD: 'invalid',
    },
    // Framework failures may contain settings; expose only fixed verification summaries.
    stdio: 'ignore',
  });
  child.once('error', () => { spawnFailed = true; });
  const request = (path: string, init: RequestInit = {}, timeout = 10_000) => fetch(`${origin}${path}`, {
    ...init, redirect: 'manual', signal: AbortSignal.timeout(timeout),
  });
  try {
    let ready = false;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      check(!spawnFailed && child.exitCode === null && child.signalCode === null, 'Optimized server failed to start; check the build and local port availability.');
      try {
        const response = await request('/', {}, Math.max(1, Math.min(2_000, deadline - Date.now())));
        const body = await response.text();
        if (response.status === 200) {
          check(body.includes('Demo / setup milestone'), 'The optimized landing page omitted its setup label.');
          ready = true;
          break;
        }
      } catch (error) {
        if (error instanceof VerificationFailure) throw error;
        // A just-spawned server may not yet accept connections.
      }
      await delay(100);
    }
    check(ready, 'Optimized landing page did not become available within 30 seconds.');

    step = 'production demo and authentication denial';
    const paths = ['/demo/sign-in', '/demo/owner', '/demo/staff', '/demo/door', '/api/demo/session', '/api/auth/get-session'];
    for (const path of paths) {
      const response = await request(path);
      await response.text();
      check(response.status === 404, `${path} did not reject production access with HTTP 404 (received ${response.status}).`);
    }
    for (const path of ['/api/auth/sign-in/email', '/api/auth/sign-out', '/api/auth/sign-up/email']) {
      const response = await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ email: 'owner@encore-demo.invalid', password: 'invalid' }),
      });
      await response.text();
      check(response.status === 404, `${path} did not reject production access with HTTP 404 (received ${response.status}).`);
    }
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: verification failed; raw diagnostics withheld to protect local settings.`);
  } finally {
    await stopServer(child);
  }
  console.log('PASS optimized production HTTP: labeled landing page returns 200; demo pages/session and authentication endpoints return 404 with invalid database/auth settings. No PostgreSQL service, credentials, browser walkthrough, or deployment was required.');
}

await verify().catch((error: unknown) => {
  console.error(`FAIL production verification: ${error instanceof VerificationFailure ? error.message : 'Could not prepare the local production smoke check; raw diagnostics withheld.'}`);
  process.exitCode = 1;
});
