import { randomBytes } from 'node:crypto';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_TOKEN_LIFETIME_SECONDS, type CapturedAuthEmail, createLocalAuthLifecycle } from '../src/server/auth-lifecycle.ts';
import { GET, POST } from '../src/app/api/auth/[...all]/route.ts';

vi.mock('../src/server/auth.ts', () => ({ getAuth: vi.fn(() => { throw new Error('Application auth must not load'); }) }));

const origin = 'http://localhost:3000';
const password = 'synthetic-original-password-123';
const newPassword = 'synthetic-replacement-password-456';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Outbound network is forbidden in lifecycle fixtures'));
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgresql://encore_local:local_test_password@127.0.0.1:54329/encore_local?schema=public');
  vi.stubEnv('BETTER_AUTH_URL', origin);
  vi.stubEnv('BETTER_AUTH_SECRET', randomBytes(32).toString('hex'));
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

let fixtureNumber = 0;
async function fixture() {
  const address = `192.0.2.${++fixtureNumber}`;
  const mail: CapturedAuthEmail[] = [];
  const store = { user: [], account: [], session: [], verification: [] };
  const auth = createLocalAuthLifecycle(memoryAdapter(store), async (message) => { mail.push(message); });
  const context = await auth.$context;
  async function user(email = 'owner@encore-lifecycle.invalid') {
    const created = await context.internalAdapter.createUser({ name: 'Synthetic lifecycle account', email, emailVerified: false }, { method: 'email-password' });
    await context.internalAdapter.createAccount({ userId: created.id, accountId: created.id, providerId: 'credential', password: await context.password.hash(password) });
    return created;
  }
  async function request(path: string, body?: Record<string, unknown>, cookie?: string) {
    const headers = new Headers({ origin, 'x-forwarded-for': address });
    if (body) headers.set('content-type', 'application/json');
    if (cookie) headers.set('cookie', cookie);
    return auth.handler(new Request(new URL(path, origin), { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }));
  }
  async function send(kind: CapturedAuthEmail['kind'], email: string) {
    const count = mail.length;
    const response = await request(`/api/auth/${kind === 'verification' ? 'send-verification-email' : 'request-password-reset'}`, { email, ...(kind === 'verification' ? { callbackURL: '/' } : { redirectTo: '/reset' }) });
    expect(response.status).toBe(200);
    expect(mail.length).toBe(count + 1);
    const message = mail.at(-1);
    if (!message) throw new Error('Expected synthetic email capture');
    expect(message.kind).toBe(kind);
    expect(message.email).toBe(email);
    expect(new URL(message.url).origin).toBe(origin);
    return message;
  }
  async function verify(email: string) {
    const message = await send('verification', email);
    expect((await request(message.url)).status).toBe(302);
  }
  async function login(email: string, value = password) {
    return request('/api/auth/sign-in/email', { email, password: value });
  }
  return { auth, context, mail, store, user, request, send, verify, login };
}
function cookie(response: Response) {
  const value = response.headers.getSetCookie().map((entry) => entry.split(';')[0]).join('; ');
  expect(value).toContain('session_token=');
  return value;
}

describe('isolated Better Auth token lifecycle', () => {
  it('requires actual verification, consumes its captured link once and never signs in on verification', async () => {
    const f = await fixture();
    const user = await f.user();
    expect((await f.login(user.email)).status).toBe(403);
    expect(f.mail).toHaveLength(0);
    const message = await f.send('verification', user.email);
    expect(new URL(message.url).searchParams.get('token')).toBe(message.token);
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(false);
    const accepted = await f.request(message.url);
    expect(accepted.status).toBe(302);
    expect(accepted.headers.get('set-cookie')).toBeNull();
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(true);
    expect((await f.request(message.url)).status).toBe(400);
    expect((await f.login(user.email)).status).toBe(200);
  });

  it('rejects tampering without consuming the valid verification link, and allows only one concurrent redemption', async () => {
    const f = await fixture();
    const user = await f.user();
    const message = await f.send('verification', user.email);
    const tampered = new URL(message.url);
    tampered.searchParams.set('token', `${message.token}x`);
    expect((await f.request(tampered.href)).status).toBe(400);
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(false);
    const results = await Promise.all([f.request(message.url), f.request(message.url)]);
    expect(results.map((r) => r.status).sort()).toEqual([302, 400]);
    expect(f.store.session).toHaveLength(0);
  });

  it('issues distinct same-second links and recovers after a consumed invalid callback without resurrecting its token', async () => {
    const f = await fixture();
    const user = await f.user();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T00:00:00.000Z'));
    const original = await f.send('verification', user.email);
    const badCallback = new URL(original.url);
    badCallback.searchParams.set('callbackURL', 'https://untrusted.invalid/');
    expect((await f.request(badCallback.href)).status).toBe(403);
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(false);
    expect((await f.request(original.url)).status).toBe(400);
    const replacement = await f.send('verification', user.email);
    expect(replacement.token).not.toBe(original.token);
    expect((await f.request(original.url)).status).toBe(400);
    expect((await f.request(replacement.url)).status).toBe(302);
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(true);
  });

  it('expires captured verification tokens without changing verification state', async () => {
    const f = await fixture();
    const user = await f.user();
    const message = await f.send('verification', user.email);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + (AUTH_TOKEN_LIFETIME_SECONDS + 1) * 1000);
    expect((await f.request(message.url)).status).toBe(400);
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(false);
    expect((await f.login(user.email)).status).toBe(403);
  });

  it('expires reset tokens while preserving the password and active sessions', async () => {
    const f = await fixture();
    const user = await f.user();
    await f.verify(user.email);
    const session = cookie(await f.login(user.email));
    const message = await f.send('password-reset', user.email);
    expect(new URL(message.url).pathname.endsWith(message.token)).toBe(true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + (AUTH_TOKEN_LIFETIME_SECONDS + 1) * 1000);
    expect((await f.request(message.url)).headers.get('location')).toContain('INVALID_TOKEN');
    expect((await f.request('/api/auth/reset-password', { token: message.token, newPassword })).status).toBe(400);
    expect((await f.login(user.email)).status).toBe(200);
    expect((await f.login(user.email, newPassword)).status).toBe(401);
    expect(await (await f.request('/api/auth/get-session', undefined, session)).json()).not.toBeNull();
  });

  it('resets once, replaces the password and revokes every target session while preserving another account', async () => {
    const f = await fixture();
    const owner = await f.user();
    const other = await f.user('staff@encore-lifecycle.invalid');
    await f.verify(owner.email);
    await f.verify(other.email);
    const sessions = [cookie(await f.login(owner.email)), cookie(await f.login(owner.email))];
    const otherSession = cookie(await f.login(other.email));
    const message = await f.send('password-reset', owner.email);
    const callback = await f.request(message.url);
    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get('location') ?? '').searchParams.get('token')).toBe(message.token);
    expect((await f.request('/api/auth/reset-password', { token: message.token, newPassword })).status).toBe(200);
    expect((await f.request('/api/auth/reset-password', { token: message.token, newPassword: password })).status).toBe(400);
    // Advance only the clock past the native sign-in rate-limit window.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    expect((await f.login(owner.email)).status).toBe(401);
    expect((await f.login(owner.email, newPassword)).status).toBe(200);
    for (const session of sessions) expect(await (await f.request('/api/auth/get-session', undefined, session)).json()).toBeNull();
    const retained = await (await f.request('/api/auth/get-session', undefined, otherSession)).json();
    expect(retained.user.id).toBe(other.id);
  });

  it('allows only one concurrent reset with the same captured token', async () => {
    const f = await fixture();
    const user = await f.user();
    await f.verify(user.email);
    const message = await f.send('password-reset', user.email);
    const results = await Promise.all([f.request('/api/auth/reset-password', { token: message.token, newPassword }), f.request('/api/auth/reset-password', { token: message.token, newPassword })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it('rejects cross-origin sign-in and untrusted recovery redirects without capturing email', async () => {
    const f = await fixture();
    const user = await f.user();
    const response = await f.auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: 'POST', headers: { origin: 'https://untrusted.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    }));
    expect(response.status).toBe(403);
    expect((await f.request('/api/auth/request-password-reset', { email: user.email, redirectTo: 'https://untrusted.invalid/reset' })).status).toBe(403);
    expect(f.mail).toHaveLength(0);
    expect(f.store.session).toHaveLength(0);
  });

  it('does not turn password recovery into email verification', async () => {
    const f = await fixture();
    const user = await f.user();
    const message = await f.send('password-reset', user.email);
    expect((await f.request('/api/auth/reset-password', { token: message.token, newPassword })).status).toBe(200);
    expect((await f.context.internalAdapter.findUserById(user.id))?.emailVerified).toBe(false);
    expect((await f.login(user.email, newPassword)).status).toBe(403);
    expect(f.store.session).toHaveLength(0);
  });

  it('returns generic reset results for unknown accounts and captures no email', async () => {
    const f = await fixture();
    const user = await f.user();
    const existing = await f.request('/api/auth/request-password-reset', { email: user.email });
    const unknown = await f.request('/api/auth/request-password-reset', { email: 'absent@encore-lifecycle.invalid' });
    expect(unknown.status).toBe(existing.status);
    expect(await unknown.json()).toEqual(await existing.json());
    expect(f.mail).toHaveLength(1);
  });

  it('fails closed in production and leaves lifecycle routes unavailable in the application', async () => {
    const capture = vi.fn();
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => createLocalAuthLifecycle(memoryAdapter({}), capture)).toThrow('unavailable');
    for (const mode of ['production', 'test']) {
      vi.stubEnv('NODE_ENV', mode);
      for (const path of ['send-verification-email', 'verify-email', 'request-password-reset', 'reset-password']) {
        expect((await GET(new Request(`${origin}/api/auth/${path}`))).status).toBe(404);
        expect((await POST(new Request(`${origin}/api/auth/${path}`, { method: 'POST' }))).status).toBe(404);
      }
    }
    expect(capture).not.toHaveBeenCalled();
  });
});
