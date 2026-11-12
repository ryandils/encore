import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { getAuth, getAuthDatabase } from './auth.ts';
import { demoAvailable, getAuthConfig } from './auth-config.ts';
import { type CapturedAuthEmail, createLocalAuthLifecycle } from './auth-lifecycle.ts';

export const APP_AUTH_COOKIE_PREFIX = 'encore-app-auth';
export const APP_AUTH_BASE_PATH = '/api/local-auth';
export function appAuthAvailable() {
  return demoAvailable() && process.env.ENCORE_AUTH_CAPTURE === '1';
}

/** Private local fixture sink: never served through an HTTP route or logged. */
export async function captureAppAuthEmail(message: CapturedAuthEmail) {
  if (!appAuthAvailable()) throw new Error('Local account rehearsal is unavailable.');
  const { baseURL } = getAuthConfig();
  if (!message.email.toLowerCase().endsWith('.invalid')) throw new Error('Synthetic recipient required.');
  const directory = join(process.cwd(), '.local-auth-mail');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Private capture directory is unavailable.');
  await chmod(directory, 0o700);
  const url = new URL(`/local/account/${message.kind === 'verification' ? 'verify' : 'reset'}`, baseURL);
  url.hash = new URLSearchParams({ token: message.token }).toString();
  const file = await open(join(directory, `${randomUUID()}.json`), 'wx', 0o600);
  try { await file.writeFile(JSON.stringify({ ...message, url: url.href }), 'utf8'); }
  finally { await file.close(); }
}

let auth: ReturnType<typeof createLocalAuthLifecycle> | undefined;
let configuration: string | undefined;
export function getAppAuth() {
  if (!appAuthAvailable()) throw new Error('Local account rehearsal is unavailable.');
  const current = JSON.stringify({ ...getAuthConfig(), directory: process.cwd() });
  if (configuration && current !== configuration) throw new Error('Restart after changing local account configuration.');
  configuration = current;
  auth ??= createLocalAuthLifecycle(prismaAdapter(getAuthDatabase(), { provider: 'postgresql', transaction: true }), captureAppAuthEmail, {
    basePath: APP_AUTH_BASE_PATH, cookiePrefix: APP_AUTH_COOKIE_PREFIX,
  });
  return auth;
}

export async function getAppSession(headers: Headers) {
  const session = await getAppAuth().api.getSession({ headers });
  return session?.user.emailVerified ? session : null;
}

/** End the legacy identity before changing app cookies, so logout cannot reveal it. */
export async function clearLegacySession(headers: Headers) {
  const { baseURL } = getAuthConfig();
  const forwarded = new Headers(headers);
  forwarded.set('origin', baseURL);
  forwarded.set('content-type', 'application/json');
  forwarded.delete('content-length');
  return getAuth().handler(new Request(new URL('/api/auth/sign-out', baseURL), { method: 'POST', headers: forwarded, body: '{}' }));
}
