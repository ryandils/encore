import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProtectedLocalSession } from '../src/server/local-session.ts';

const mocks = vi.hoisted(() => ({ legacy: vi.fn(), app: vi.fn(), fixture: vi.fn() }));
vi.mock('../src/server/auth.ts', () => ({ getAuth: () => ({ api: { getSession: mocks.legacy } }), getAuthDatabase: () => ({ demoIdentity: { findUnique: mocks.fixture } }) }));
vi.mock('../src/server/app-auth.ts', () => ({ getAppSession: mocks.app }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe('local protected identity selection', () => {
  it('rejects an unverified non-demo session minted by legacy sign-in', async () => {
    mocks.legacy.mockResolvedValue({ user: { id: 'new-account', email: 'new@synthetic.invalid', emailVerified: false } });
    expect(await getProtectedLocalSession(new Headers())).toBeNull();
    expect(mocks.fixture).not.toHaveBeenCalled();
  });
  it('preserves only reserved server-owned demo fixtures as the local rehearsal exception', async () => {
    const fixture = { user: { id: '00000000-0000-4000-8000-000000000001', email: 'owner@encore-demo.invalid', emailVerified: false } };
    mocks.legacy.mockResolvedValue(fixture);
    mocks.fixture.mockResolvedValue(null);
    expect(await getProtectedLocalSession(new Headers())).toBeNull();
    mocks.fixture.mockResolvedValue({ role: 'OWNER' });
    expect(await getProtectedLocalSession(new Headers())).toEqual(fixture);
  });
  it('does not fall back to a different legacy identity after app session expiry', async () => {
    mocks.app.mockResolvedValue(null);
    mocks.legacy.mockResolvedValue({ user: { emailVerified: true } });
    expect(await getProtectedLocalSession(new Headers({ cookie: 'better-auth.session_token=old; encore-app-auth.session_token=expired' }))).toBeNull();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it('uses the verified app-session boundary when both cookies exist', async () => {
    const session = { user: { id: 'verified-app', emailVerified: true } };
    mocks.app.mockResolvedValue(session);
    expect(await getProtectedLocalSession(new Headers({ cookie: 'encore-app-auth.session_token=app' }))).toEqual(session);
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it('retains app selection after its session token expires or is deleted', async () => {
    mocks.app.mockResolvedValue(null);
    mocks.legacy.mockResolvedValue({ user: { id: 'other-account', emailVerified: true } });
    expect(await getProtectedLocalSession(new Headers({ cookie: 'encore-app-auth.selected=1; better-auth.session_token=other' }))).toBeNull();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it('denies production before either auth runtime loads', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(await getProtectedLocalSession(new Headers())).toBeNull();
    expect(mocks.app).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
});
