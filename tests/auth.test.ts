import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeAuth } from '../scripts/auth-init.ts';
import { demoAvailable, getAuthConfig, getDemoPasswords } from '../src/server/auth-config.ts';
import { POST as authPost } from '../src/app/api/auth/[...all]/route.ts';
import { GET as demoGet } from '../src/app/api/demo/session/route.ts';

const mocks = vi.hoisted(() => ({ getAuth: vi.fn(), getAuthDatabase: vi.fn() }));
vi.mock('../src/server/auth.ts', () => mocks);

const environment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://encore_local:local_test_password@127.0.0.1:54329/encore_local?schema=public',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-only-generated-length-auth-secret-12345',
  DEMO_OWNER_PASSWORD: 'test-only-owner-password',
  DEMO_STAFF_PASSWORD: 'test-only-staff-password',
};

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetAllMocks(); });

it('switches out of the app namespace only after explicit successful demo sign-in', async () => {
  vi.stubEnv('NODE_ENV', 'test');
  const handler = vi.fn().mockResolvedValue(Response.json({ status: true }));
  mocks.getAuth.mockReturnValue({ handler });
  const request = () => new Request('http://localhost:3000/api/auth/sign-in/email', {
    method: 'POST', headers: { cookie: 'encore-app-auth.selected=1; encore-app-auth.session_token=opaque; unrelated=keep' },
  });
  const response = await authPost(request());
  expect(response.headers.getSetCookie()).toHaveLength(2);
  expect(response.headers.getSetCookie().every((cookie) => cookie.includes('Max-Age=0') && cookie.startsWith('encore-app-auth.'))).toBe(true);
  handler.mockResolvedValue(Response.json({ error: 'Rejected' }, { status: 401 }));
  expect((await authPost(request())).headers.getSetCookie()).toHaveLength(0);
});

describe('local authentication configuration boundary', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts an explicit HTTP loopback origin (%s)', (host) => {
    expect(getAuthConfig({ ...environment, BETTER_AUTH_URL: `http://${host}:3100` }).baseURL).toBe(`http://${host}:3100`);
  });
  it.each(['production', 'staging', 'unexpected'])('fails closed in %s', (mode) => {
    expect(demoAvailable({ NODE_ENV: mode })).toBe(false);
    expect(() => getAuthConfig({ ...environment, NODE_ENV: mode })).toThrow('unavailable');
  });
  it.each([undefined, '', 'invalid', 'https://localhost:3000', 'http://localhost.example:3000', 'http://0.0.0.0:3000', 'http://remote.example', 'http://user:password@localhost:3000', 'http://localhost:3000/path', 'http://localhost:3000?query=true', 'http://localhost:3000#fragment'])('rejects invalid or remote origins (%#)', (value) => {
    expect(() => getAuthConfig({ ...environment, BETTER_AUTH_URL: value })).toThrow();
  });
  it.each([undefined, '', 'short', 'better-auth-secret-12345678901234567890', `${environment.BETTER_AUTH_SECRET}\n`])('rejects absent, weak or built-in signing secrets (%#)', (value) => {
    expect(() => getAuthConfig({ ...environment, BETTER_AUTH_SECRET: value })).toThrow();
  });
  it('rejects a remote database without exposing connection credentials', () => {
    const secretURL = environment.DATABASE_URL.replace('127.0.0.1', 'private.example');
    try {
      getAuthConfig({ ...environment, DATABASE_URL: secretURL });
      expect.fail('Expected remote database rejection');
    } catch (error) {
      expect(String(error)).not.toContain('private.example');
      expect(String(error)).not.toContain('local_test_password');
      expect(String(error)).toContain('dedicated local database');
    }
  });
  it('requires two distinct sufficiently long local passwords', () => {
    expect(getDemoPasswords(environment)).toEqual({ OWNER: environment.DEMO_OWNER_PASSWORD, STAFF: environment.DEMO_STAFF_PASSWORD });
    for (const password of [undefined, '', 'short', 'x'.repeat(129), environment.DEMO_OWNER_PASSWORD]) {
      expect(() => getDemoPasswords({ ...environment, DEMO_STAFF_PASSWORD: password })).toThrow();
    }
  });
});

describe('HTTP demo boundaries', () => {
  it('blocks production before constructing authentication or touching the database', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await authPost(new Request('http://localhost:3000/api/auth/sign-in/email', { method: 'POST' }))).status).toBe(404);
    expect((await demoGet(new Request('http://localhost:3000/api/demo/session'))).status).toBe(404);
    expect(mocks.getAuth).not.toHaveBeenCalled();
    expect(mocks.getAuthDatabase).not.toHaveBeenCalled();
  });

  it('does not expose public signup or account-mutation endpoints', async () => {
    for (const endpoint of ['sign-up/email', 'change-password', 'request-password-reset']) {
      expect((await authPost(new Request(`http://localhost:3000/api/auth/${endpoint}`, { method: 'POST' }))).status).toBe(404);
    }
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it('rejects anonymous protected requests and omits session credentials from successful responses', async () => {
    const getSession = vi.fn().mockResolvedValue(null);
    mocks.getAuth.mockReturnValue({ api: { getSession } });
    expect((await demoGet(new Request('http://localhost:3000/api/demo/session'))).status).toBe(401);
    expect(mocks.getAuthDatabase).not.toHaveBeenCalled();
    getSession.mockResolvedValue({ user: { id: 'synthetic-owner', name: 'Synthetic owner', email: 'owner@encore-demo.invalid' }, session: { token: 'not-for-response' } });
    mocks.getAuthDatabase.mockReturnValue({ demoIdentity: { findUnique: vi.fn().mockResolvedValue({ role: 'OWNER' }) } });
    const response = await demoGet(new Request('http://localhost:3000/api/demo/session'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ user: { id: 'synthetic-owner', name: 'Synthetic owner', email: 'owner@encore-demo.invalid' }, role: 'OWNER' });
  });

  it('redacts configuration/database errors from HTTP responses', async () => {
    mocks.getAuth.mockImplementation(() => { throw new Error('postgresql://private:secret@private-host'); });
    for (const response of [
      await authPost(new Request('http://localhost:3000/api/auth/sign-in/email', { method: 'POST' })),
      await demoGet(new Request('http://localhost:3000/api/demo/session')),
    ]) {
      expect(response.status).toBe(503);
      expect(await response.text()).not.toMatch(/secret|private-host|postgresql/);
    }
  });
});

describe('local secret initialization', () => {
  it.skipIf(process.platform === 'win32')('restricts an existing Unix env file before adding secrets and on repeated initialization', () => {
    const directory = mkdtempSync(join(tmpdir(), 'encore-auth-mode-'));
    const path = pathToFileURL(join(directory, '.env'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      writeFileSync(path, `DATABASE_URL="${environment.DATABASE_URL}"\n`);
      chmodSync(path, 0o644);
      initializeAuth(path);
      expect(statSync(path).mode & 0o777).toBe(0o600);
      const initialized = readFileSync(path, 'utf8');
      chmodSync(path, 0o644);
      initializeAuth(path);
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(readFileSync(path, 'utf8')).toBe(initialized);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('generates missing values once without printing or replacing them', () => {
    const directory = mkdtempSync(join(tmpdir(), 'encore-auth-init-'));
    const path = pathToFileURL(join(directory, '.env'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      writeFileSync(path, `DATABASE_URL="${environment.DATABASE_URL}"\n# existing local comment\n`);
      initializeAuth(path);
      const first = readFileSync(path, 'utf8');
      const values = parseEnv(first);
      getAuthConfig(values);
      getDemoPasswords(values);
      initializeAuth(path);
      expect(readFileSync(path, 'utf8')).toBe(first);
      expect(first).toContain('# existing local comment');
      for (const key of ['BETTER_AUTH_SECRET', 'DEMO_OWNER_PASSWORD', 'DEMO_STAFF_PASSWORD']) {
        expect(log.mock.calls.flat().join(' ')).not.toContain(values[key]);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('preserves an invalid existing configuration and refuses production before reading a file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'encore-auth-init-'));
    const path = pathToFileURL(join(directory, '.env'));
    try {
      const original = `DATABASE_URL="${environment.DATABASE_URL}"\nBETTER_AUTH_SECRET="short"\n`;
      writeFileSync(path, original);
      expect(() => initializeAuth(path)).toThrow();
      expect(readFileSync(path, 'utf8')).toBe(original);
      vi.stubEnv('NODE_ENV', 'production');
      expect(() => initializeAuth(pathToFileURL(join(directory, 'missing')))).toThrow('production');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
