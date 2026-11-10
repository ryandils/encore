import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { demoAvailable, getAuthConfig, getDemoPasswords } from '../src/server/auth-config.ts';
import { LocalDatabaseError, reportFailure, validateLocalDatabase } from './db-local.ts';

export function initializeAuth(envPath = new URL('../.env', import.meta.url)): void {
  if (!demoAvailable()) throw new LocalDatabaseError('The local authentication demo is unavailable in production.');
  let text: string;
  try { text = readFileSync(envPath, 'utf8'); } catch {
    throw new LocalDatabaseError('Run pnpm run db:init before pnpm run auth:init. Existing local settings are never overwritten.');
  }
  const values = parseEnv(text);
  validateLocalDatabase({ ...values, NODE_ENV: process.env.NODE_ENV });
  const additions: Record<string, string> = {};
  if (!Object.hasOwn(values, 'BETTER_AUTH_URL')) additions.BETTER_AUTH_URL = 'http://localhost:3000';
  if (!Object.hasOwn(values, 'BETTER_AUTH_SECRET')) additions.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
  if (!Object.hasOwn(values, 'DEMO_OWNER_PASSWORD')) additions.DEMO_OWNER_PASSWORD = randomBytes(24).toString('base64url');
  if (!Object.hasOwn(values, 'DEMO_STAFF_PASSWORD')) additions.DEMO_STAFF_PASSWORD = randomBytes(24).toString('base64url');
  const environment = { ...values, ...additions, NODE_ENV: process.env.NODE_ENV };
  getAuthConfig(environment);
  getDemoPasswords(environment);
  // appendFileSync's mode affects creation only; db:init may have copied a 0644 file.
  // Windows access is controlled by ACLs, not POSIX group/other permission bits.
  if (process.platform !== 'win32') chmodSync(envPath, 0o600);
  if (Object.keys(additions).length) {
    appendFileSync(envPath, `\n# Generated local synthetic authentication settings; never commit or share.\n${Object.entries(additions).map(([key, value]) => `${key}="${value}"`).join('\n')}\n`, { mode: 0o600 });
  }
  console.log('PASS local authentication settings are ready in ignored .env. Existing values were preserved. Read the local file for synthetic sign-in passwords; no values are printed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new LocalDatabaseError('auth:init does not accept arguments.');
    initializeAuth();
  } catch (error) {
    reportFailure(error instanceof Error ? new LocalDatabaseError('Local authentication initialization failed. Check the dedicated .env database, loopback origin, secret, and distinct demo passwords; no settings were overwritten.') : error);
  }
}
