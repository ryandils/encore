import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appAuthAvailable, captureAppAuthEmail, getAppAuth } from '../src/server/app-auth.ts';
import { createAppAuthHandler } from '../src/server/app-auth-http.ts';
import { type CapturedAuthEmail, createLocalAuthLifecycle } from '../src/server/auth-lifecycle.ts';

vi.mock('../src/server/auth.ts', () => ({ getAuthDatabase: vi.fn(() => { throw new Error('Unexpected database access'); }) }));
const origin = 'http://localhost:3000';
const password = 'synthetic-account-password-123';
const noLegacy = async () => Response.json({ status: true });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgresql://encore_local:local_test_password@127.0.0.1:54329/encore_local?schema=public');
  vi.stubEnv('BETTER_AUTH_URL', origin);
  vi.stubEnv('BETTER_AUTH_SECRET', 'synthetic-account-signing-secret-123456789');
  vi.stubEnv('ENCORE_AUTH_CAPTURE', '1');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function fixture() {
  const mail: CapturedAuthEmail[] = [];
  const store = { user: [], account: [], session: [], verification: [] };
  const auth = createLocalAuthLifecycle(memoryAdapter(store), async (message) => { mail.push(message); }, {
    basePath: '/api/local-auth', cookiePrefix: 'encore-app-auth',
  });
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({ email: 'account@encore-app.invalid', name: 'Synthetic account', emailVerified: false }, { method: 'email-password' });
  await context.internalAdapter.createAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password: await context.password.hash(password) });
  const legacy = createLocalAuthLifecycle(memoryAdapter(store), async () => {});
  const clearLegacySession = (headers: Headers) => legacy.handler(new Request(`${origin}/api/auth/sign-out`, {
    method: 'POST', headers, body: '{}',
  }));
  const handler = createAppAuthHandler({ available: appAuthAvailable, origin: () => origin, auth: () => auth, clearLegacySession });
  let requestNumber = 0;
  const request = (path: string, value?: Record<string, unknown>, cookie?: string) => handler(new Request(`${origin}/api/local-auth/${path}`, {
    method: value ? 'POST' : 'GET',
    headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': `192.0.2.${++requestNumber}`, ...(cookie ? { cookie } : {}) },
    body: value ? JSON.stringify(value) : undefined,
  }));
  return { auth, context, user, mail, request, handler, legacy };
}

describe('local application account boundary', () => {
  it('requires opt-in and rejects production before auth/database construction', async () => {
    for (const mode of ['production', 'staging']) {
      vi.stubEnv('NODE_ENV', mode);
      expect(appAuthAvailable()).toBe(false);
      expect(() => getAppAuth()).toThrow('unavailable');
    }
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('ENCORE_AUTH_CAPTURE', '');
    expect(() => getAppAuth()).toThrow('unavailable');
    const auth = vi.fn();
    const handler = createAppAuthHandler({ available: appAuthAvailable, origin: () => origin, auth, clearLegacySession: noLegacy });
    expect((await handler(new Request(`${origin}/api/local-auth/get-session`))).status).toBe(404);
    expect(auth).not.toHaveBeenCalled();
  });

  it('verifies explicitly via POST then issues only the separate app cookie', async () => {
    const f = await fixture();
    expect((await f.request('sign-in/email', { email: f.user.email, password })).status).toBe(403);
    expect((await f.request('send-verification-email', { email: f.user.email })).status).toBe(200);
    const token = f.mail[0].token;
    expect((await f.request('verify-email', { token })).status).toBe(200);
    expect((await f.request('verify-email', { token })).status).toBe(400);
    const login = await f.request('sign-in/email', { email: f.user.email, password });
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ status: true });
    const cookies = login.headers.getSetCookie();
    expect(cookies.some((entry) => entry.startsWith('encore-app-auth.session_token='))).toBe(true);
    expect(cookies).toContain('encore-app-auth.selected=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000');
    expect(cookies.filter((entry) => entry.startsWith('better-auth.session_token=')).every((entry) => entry.includes('Max-Age=0'))).toBe(true);
    const cookie = cookies.map((entry) => entry.split(';')[0]).join('; ');
    const session = await f.request('get-session', undefined, cookie);
    expect(await session.json()).toEqual({ user: { id: f.user.id, email: f.user.email, emailVerified: true } });
    expect(session.headers.get('cache-control')).toBe('no-store');
    expect((await f.request('sign-out', {}, cookie)).status).toBe(200);
    expect(await (await f.request('get-session', undefined, cookie)).json()).toBeNull();
  });

  it('keeps verification and recovery request responses neutral', async () => {
    const f = await fixture();
    for (const path of ['send-verification-email', 'request-password-reset']) {
      const existing = await f.request(path, { email: f.user.email });
      const absent = await f.request(path, { email: 'absent@encore-app.invalid' });
      expect(existing.status).toBe(200); expect(absent.status).toBe(200);
      expect(await existing.json()).toEqual(await absent.json());
    }
    expect(f.mail).toHaveLength(2);
  });

  it('resets through the app boundary without verifying an unverified account', async () => {
    const f = await fixture();
    await f.request('request-password-reset', { email: f.user.email });
    const token = f.mail[0].token;
    expect((await f.request('reset-password', { token, newPassword: 'synthetic-new-password-456' })).status).toBe(200);
    expect((await f.request('reset-password', { token, newPassword: password })).status).toBe(400);
    expect((await f.request('sign-in/email', { email: f.user.email, password: 'synthetic-new-password-456' })).status).toBe(403);
    expect((await f.context.internalAdapter.findUserById(f.user.id))?.emailVerified).toBe(false);
  });

  it('rejects signup, query tokens, GET verification, extra fields and nonsynthetic recipients', async () => {
    const f = await fixture();
    expect((await f.request('sign-up/email', { email: f.user.email, password })).status).toBe(404);
    expect((await f.request('verify-email?token=secret')).status).toBe(404);
    expect((await f.request('verify-email')).status).toBe(405);
    expect((await f.request('send-verification-email', { email: f.user.email, callbackURL: 'https://untrusted.invalid' })).status).toBe(400);
    expect((await f.request('request-password-reset', { email: 'real@example.com' })).status).toBe(400);
    expect(f.mail).toHaveLength(0);
  });

  it('rejects cross-origin and oversized bodies before invoking auth', async () => {
    const auth = vi.fn();
    const handler = createAppAuthHandler({ available: () => true, origin: () => origin, auth, clearLegacySession: noLegacy });
    const request = (body: string, requestOrigin = origin) => new Request(`${origin}/api/local-auth/request-password-reset`, { method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json' }, body });
    expect((await handler(request('{}', 'https://untrusted.invalid'))).status).toBe(403);
    expect((await handler(request(JSON.stringify({ email: `${'x'.repeat(5000)}@test.invalid` })))).status).toBe(400);
    expect(auth).not.toHaveBeenCalled();
  });

  it('returns safe unavailable and rate-limit feedback without raw diagnostics', async () => {
    const raw = 'private-token-diagnostic';
    const handler = createAppAuthHandler({ available: () => true, origin: () => origin, auth: () => ({ handler: async () => { throw new Error(raw); } }), clearLegacySession: noLegacy });
    const response = await handler(new Request(`${origin}/api/local-auth/get-session`));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(raw);
    const limited = createAppAuthHandler({ available: () => true, origin: () => origin, auth: () => ({ handler: async () => new Response(raw, { status: 429, headers: { 'x-retry-after': '10' } }) }), clearLegacySession: noLegacy });
    const retry = await limited(new Request(`${origin}/api/local-auth/get-session`));
    expect(retry.status).toBe(429); expect(retry.headers.get('retry-after')).toBe('10'); expect(await retry.text()).not.toContain(raw);
  });

  it('revokes lingering legacy sessions on app sign-in and sign-out', async () => {
    const f = await fixture();
    await f.request('send-verification-email', { email: f.user.email });
    await f.request('verify-email', { token: f.mail[0].token });
    const legacyLogin = async () => {
      const response = await f.legacy.handler(new Request(`${origin}/api/auth/sign-in/email`, {
        method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.user.email, password }),
      }));
      expect(response.status).toBe(200);
      return response.headers.getSetCookie().map((entry) => entry.split(';')[0]).join('; ');
    };
    const legacySession = async (cookie: string) => (await f.legacy.handler(new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }))).json();
    const firstLegacy = await legacyLogin();
    expect(await legacySession(firstLegacy)).not.toBeNull();
    const login = await f.request('sign-in/email', { email: f.user.email, password }, firstLegacy);
    expect(login.status).toBe(200);
    expect(await legacySession(firstLegacy)).toBeNull();
    const appCookie = login.headers.getSetCookie().filter((entry) => entry.startsWith('encore-app-auth.')).map((entry) => entry.split(';')[0]).join('; ');
    const secondLegacy = await legacyLogin();
    expect(await legacySession(secondLegacy)).not.toBeNull();
    const logout = await f.request('sign-out', {}, `${appCookie}; ${secondLegacy}`);
    expect(logout.status).toBe(200);
    expect(await legacySession(secondLegacy)).toBeNull();
    expect(await (await f.request('get-session', undefined, appCookie)).json()).toBeNull();
    expect(logout.headers.getSetCookie().some((entry) => entry.startsWith('better-auth.session_token=') && entry.includes('Max-Age=0'))).toBe(true);
    expect(logout.headers.getSetCookie()).toContain('encore-app-auth.selected=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000');
  });

  it('retains app selection when an expired session becomes null, without granting access', async () => {
    const f = await fixture();
    for (const cookie of ['encore-app-auth.session_token=expired.invalid', 'encore-app-auth.selected=1']) {
      const response = await f.request('get-session', undefined, cookie);
      expect(await response.json()).toBeNull();
      expect(response.headers.getSetCookie()).toContain('encore-app-auth.selected=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000');
    }
    const anonymous = await f.request('get-session');
    expect(await anonymous.json()).toBeNull();
    expect(anonymous.headers.getSetCookie().some((entry) => entry.startsWith('encore-app-auth.selected='))).toBe(false);
  });

  it('does not clear or switch browser cookies if legacy revocation fails', async () => {
    const handler = createAppAuthHandler({ available: () => true, origin: () => origin,
      auth: () => ({ handler: async () => Response.json({ status: true }, { headers: { 'Set-Cookie': 'encore-app-auth.session_token=; Max-Age=0' } }) }),
      clearLegacySession: async () => new Response(null, { status: 503 }),
    });
    const response = await handler(new Request(`${origin}/api/local-auth/sign-out`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' }));
    expect(response.status).toBe(503);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('captures only in private local files with fragment links and no public endpoint', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'encore-app-mail-'));
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    try {
      await captureAppAuthEmail({ kind: 'verification', email: 'account@encore-app.invalid', token: 'synthetic-token', url: `${origin}/api/local-auth/verify-email?token=synthetic-token` });
      const captureDirectory = join(directory, '.local-auth-mail');
      const files = await readdir(captureDirectory);
      expect(files).toHaveLength(1);
      const captured = JSON.parse(await readFile(join(captureDirectory, files[0]), 'utf8'));
      expect(captured.url).toBe(`${origin}/local/account/verify#token=synthetic-token`);
      if (process.platform !== 'win32') {
        expect((await stat(captureDirectory)).mode & 0o777).toBe(0o700);
        expect((await stat(join(captureDirectory, files[0]))).mode & 0o777).toBe(0o600);
      }
      await expect(captureAppAuthEmail({ ...captured, email: 'real@example.com' })).rejects.toThrow('Synthetic');
      vi.stubEnv('NODE_ENV', 'production');
      await expect(captureAppAuthEmail(captured)).rejects.toThrow('unavailable');
      expect(await readdir(captureDirectory)).toHaveLength(1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
