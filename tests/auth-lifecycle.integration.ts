import { randomBytes, randomUUID } from 'node:crypto';
import { mock } from 'node:test';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createLocalClient, localEnvironment } from '../scripts/db-local.ts';
import { AUTH_TOKEN_LIFETIME_SECONDS, type CapturedAuthEmail, createLocalAuthLifecycle } from '../src/server/auth-lifecycle.ts';

class VerificationFailure extends Error {}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new VerificationFailure(message);
}
function matchesFixture(where: unknown, field: string, values: string[]): boolean {
  if (!where || typeof where !== 'object') return false;
  const condition = where as Record<string, unknown>;
  const value = condition[field];
  if (typeof value === 'string') return values.includes(value);
  if (value && typeof value === 'object' && 'equals' in value && typeof value.equals === 'string') return values.includes(value.equals);
  return Array.isArray(condition.AND) && condition.AND.some((entry) => matchesFixture(entry, field, values));
}

/** Explicit local PostgreSQL proof. No server, provider, real mail, or seed edits. */
async function verify() {
  localEnvironment();
  const origin = 'http://localhost:3000';
  process.env.BETTER_AUTH_URL = origin;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
  const client = await createLocalClient();
  const secondClient = await createLocalClient().catch(async (error: unknown) => { await client.$disconnect(); throw error; });
  const users: string[] = [];
  const emails: string[] = [];
  const mail: CapturedAuthEmail[] = [];
  const originalPassword = randomBytes(24).toString('hex');
  const replacementPassword = randomBytes(24).toString('hex');
  const competingPassword = randomBytes(24).toString('hex');
  const runId = randomUUID();
  const sentinelId = `lifecycle-sentinel-${runId}`;
  let sequence = 0;
  let step = 'initialization';
  let outboundAttempts = 0;
  let failUserUpdate = false;
  let failPasswordUpdate = false;
  let injectedFailures = 0;
  const originalFetch = globalThis.fetch;
  let seedIds: string[] = [];
  const seedSnapshot = async () => JSON.stringify(await client.user.findMany({ where: { id: { in: seedIds } }, include: { accounts: { orderBy: { id: 'asc' } }, sessions: { orderBy: { id: 'asc' } }, demoIdentity: true }, orderBy: { id: 'asc' } }));
  let beforeSeed: string | undefined;
  try {
    globalThis.fetch = async () => { outboundAttempts += 1; throw new Error('Outbound fetch prohibited'); };
    const faultClient = client.$extends({ query: {
      user: { async update({ args, query }) {
        if (failUserUpdate && matchesFixture(args.where, 'email', emails)) {
          injectedFailures += 1;
          throw new Error('Synthetic verification update failure');
        }
        return query(args);
      } },
      account: { async updateMany({ args, query }) {
        if (failPasswordUpdate && matchesFixture(args.where, 'userId', users)) {
          injectedFailures += 1;
          throw new Error('Synthetic password update failure');
        }
        return query(args);
      } },
    } });
    const capture = async (message: CapturedAuthEmail) => { mail.push(message); };
    // Adapter transactions default to false; reset rollback requires opting in.
    const auth = createLocalAuthLifecycle(prismaAdapter(faultClient, { provider: 'postgresql', transaction: true }), capture);
    const peer = createLocalAuthLifecycle(prismaAdapter(secondClient, { provider: 'postgresql', transaction: true }), capture);
    const context = await auth.$context;
    const clock = (now: number) => {
      mock.timers.reset();
      mock.timers.enable({ apis: ['Date'], now });
    };
    async function request(path: string, body?: Record<string, unknown>, cookie?: string, instance = auth, requestOrigin = origin) {
      const headers = new Headers({ origin: requestOrigin, 'x-forwarded-for': `192.0.2.${++sequence % 250 + 1}` });
      if (body) headers.set('content-type', 'application/json');
      if (cookie) headers.set('cookie', cookie);
      return instance.handler(new Request(new URL(path, origin), {
        method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
      }));
    }
    async function user() {
      const email = `lifecycle-${runId}-${users.length}@encore-tests.invalid`;
      const created = await context.internalAdapter.createUser({ email, name: 'Synthetic PostgreSQL lifecycle', emailVerified: false }, { method: 'email-password' });
      users.push(created.id);
      emails.push(email);
      await context.internalAdapter.createAccount({ userId: created.id, accountId: created.id, providerId: 'credential', password: await context.password.hash(originalPassword) });
      return created;
    }
    async function send(kind: CapturedAuthEmail['kind'], email: string) {
      const count = mail.length;
      const response = await request(`/api/auth/${kind === 'verification' ? 'send-verification-email' : 'request-password-reset'}`, {
        email, ...(kind === 'verification' ? { callbackURL: '/' } : { redirectTo: '/reset' }),
      });
      check(response.status === 200 && mail.length === count + 1, 'Synthetic email was not captured once.');
      const message = mail.at(-1);
      check(message && message.kind === kind && message.email === email && new URL(message.url).origin === origin, 'Captured email metadata was incorrect.');
      return message;
    }
    async function verifiedUser() {
      const created = await user();
      check((await request((await send('verification', created.email)).url)).status === 302, 'Verification failed.');
      return created;
    }
    const login = (email: string, password = originalPassword) => request('/api/auth/sign-in/email', { email, password });
    const reset = (token: string, newPassword = replacementPassword, instance = auth) => request('/api/auth/reset-password', { token, newPassword }, undefined, instance);
    function cookie(response: Response) {
      check(response.status === 200, 'Synthetic login failed.');
      const value = response.headers.getSetCookie().find((entry) => entry.split('=', 1)[0]?.endsWith('session_token'));
      check(value && /;\s*httponly(?:;|$)/i.test(value), 'Expected HttpOnly session cookie.');
      return value.split(';', 1)[0];
    }
    async function sessionUser(value: string) {
      const response = await request('/api/auth/get-session', undefined, value);
      check(response.status === 200, 'Session read failed.');
      const data = await response.json();
      return data?.user?.id as string | undefined;
    }
    const verified = async (id: string) => (await client.user.findUnique({ where: { id } }))?.emailVerified;
    // Snapshot existing synthetic demo records without ever logging hashes/tokens.
    seedIds = (await client.demoIdentity.findMany()).map((entry) => entry.userId);
    beforeSeed = await seedSnapshot();
    // Unrelated expired tokens must survive; lifecycle lookup must not globally sweep them.
    const sentinel = await client.verification.create({ data: { id: sentinelId, identifier: sentinelId, value: sentinelId, expiresAt: new Date(Date.now() - 1000) } });
    step = 'verification, tampering and sequential replay';
    const first = await user();
    check((await login(first.email)).status === 403, 'Unverified sign-in was allowed.');
    const firstMail = await send('verification', first.email);
    const tampered = new URL(firstMail.url);
    tampered.searchParams.set('token', `${firstMail.token}x`);
    check((await request(tampered.href)).status === 400 && !await verified(first.id), 'Tampered verification was accepted.');
    const accepted = await request(firstMail.url);
    check(accepted.status === 302 && !accepted.headers.has('set-cookie') && await verified(first.id), 'Verification did not persist without automatic sign-in.');
    check((await request(firstMail.url)).status === 400, 'Verification replay succeeded.');
    cookie(await login(first.email));

    step = 'concurrent verification across independent adapters';
    const concurrent = await user();
    const concurrentMail = await send('verification', concurrent.email);
    const verificationRace = await Promise.all([request(concurrentMail.url), request(concurrentMail.url, undefined, undefined, peer)]);
    check(verificationRace.map((entry) => entry.status).sort().join() === '302,400' && await verified(concurrent.id), 'Concurrent verification did not have exactly one winner.');

    step = 'same-second resend and verification failure recovery';
    clock(Math.floor(Date.now() / 1000) * 1000);
    const recovery = await user();
    const spent = await send('verification', recovery.email);
    failUserUpdate = true;
    const failedVerification = await request(spent.url);
    failUserUpdate = false;
    check(failedVerification.status >= 400 && injectedFailures === 1 && !await verified(recovery.id), 'Injected verification failure changed account state.');
    check((await request(spent.url)).status === 400, 'Failed verification did not spend its link.');
    const resent = await send('verification', recovery.email);
    check(resent.token !== spent.token, 'Same-second resend reused its token.');
    check((await request(resent.url)).status === 302 && await verified(recovery.id), 'Fresh verification did not recover.');
    mock.timers.reset();

    step = 'verification expiry';
    const expiring = await user();
    const expiredVerification = await send('verification', expiring.email);
    clock(Date.now() + (AUTH_TOKEN_LIFETIME_SECONDS + 1) * 1000);
    check((await request(expiredVerification.url)).status === 400 && !await verified(expiring.id), 'Expired verification changed account state.');
    check((await login(expiring.email)).status === 403, 'Expired verification enabled sign-in.');
    mock.timers.reset();

    step = 'reset expiry and tampering preserve password and sessions';
    const resetOwner = await verifiedUser();
    const ownerSessions = [cookie(await login(resetOwner.email)), cookie(await login(resetOwner.email))];
    const other = await verifiedUser();
    const otherSession = cookie(await login(other.email));
    const expires = await send('password-reset', resetOwner.email);
    check((await reset(`${expires.token}x`)).status === 400, 'Tampered reset was accepted.');
    check(await client.verification.count({ where: { identifier: `reset-password:${expires.token}` } }) === 1, 'Tampering consumed the valid reset token.');
    clock(Date.now() + (AUTH_TOKEN_LIFETIME_SECONDS + 1) * 1000);
    check((await request(expires.url)).headers.get('location')?.includes('INVALID_TOKEN'), 'Expired reset callback was accepted.');
    check((await reset(expires.token)).status === 400, 'Expired reset was accepted.');
    check((await login(resetOwner.email)).status === 200 && (await login(resetOwner.email, replacementPassword)).status === 401, 'Rejected reset changed the password.');
    for (const value of ownerSessions) check(await sessionUser(value) === resetOwner.id, 'Rejected reset revoked a session.');
    mock.timers.reset();

    step = 'reset transaction rollback after session deletion';
    const rollback = await send('password-reset', resetOwner.email);
    const accountBefore = await client.account.findFirst({ where: { userId: resetOwner.id, providerId: 'credential' } });
    const sessionsBefore = await client.session.count({ where: { userId: resetOwner.id } });
    failPasswordUpdate = true;
    const failedReset = await reset(rollback.token);
    failPasswordUpdate = false;
    check(failedReset.status >= 400 && Number(injectedFailures) === 2, 'Password-write failure was not exercised.');
    check((await client.account.findFirst({ where: { userId: resetOwner.id, providerId: 'credential' } }))?.password === accountBefore?.password, 'Failed reset changed the persisted password.');
    check(await client.session.count({ where: { userId: resetOwner.id } }) === sessionsBefore, 'Failed reset did not roll back session deletion.');
    check(await client.verification.count({ where: { identifier: `reset-password:${rollback.token}` } }) === 1, 'Failed reset did not restore its token.');
    for (const value of ownerSessions) check(await sessionUser(value) === resetOwner.id, 'Failed reset invalidated a session.');
    check((await request(rollback.url)).status === 302, 'Retained reset callback failed.');
    check((await reset(rollback.token)).status === 200, 'Retry after rolled-back reset failed.');
    check(await client.session.count({ where: { userId: resetOwner.id } }) === 0, 'Successful reset did not revoke every target session.');
    check((await reset(rollback.token, originalPassword)).status === 400, 'Sequential reset replay succeeded.');
    check((await login(resetOwner.email)).status === 401 && (await login(resetOwner.email, replacementPassword)).status === 200, 'Reset did not replace the password.');
    for (const value of ownerSessions) check(await sessionUser(value) === undefined, 'Reset retained a target session.');
    check(await sessionUser(otherSession) === other.id && (await login(other.email)).status === 200, 'Reset changed another account.');

    step = 'concurrent reset with competing passwords across independent adapters';
    const racing = await verifiedUser();
    const raceSession = cookie(await login(racing.email));
    const raceMail = await send('password-reset', racing.email);
    const resetRace = await Promise.all([reset(raceMail.token), reset(raceMail.token, competingPassword, peer)]);
    check(resetRace.map((entry) => entry.status).sort().join() === '200,400', 'Concurrent reset did not have exactly one winner.');
    const winner = resetRace[0].status === 200 ? replacementPassword : competingPassword;
    const loser = resetRace[0].status === 200 ? competingPassword : replacementPassword;
    check((await login(racing.email, winner)).status === 200 && (await login(racing.email, loser)).status === 401 && (await login(racing.email)).status === 401, 'Concurrent reset persisted the wrong password.');
    check(await sessionUser(raceSession) === undefined && await sessionUser(otherSession) === other.id, 'Concurrent reset session isolation failed.');

    step = 'unverified recovery, neutral responses and origin checks';
    const unverified = await user();
    const unverifiedReset = await send('password-reset', unverified.email);
    check((await reset(unverifiedReset.token)).status === 200 && !await verified(unverified.id), 'Password reset verified an email.');
    check((await login(unverified.email, replacementPassword)).status === 403, 'Unverified recovery enabled sign-in.');
    const existing = await request('/api/auth/request-password-reset', { email: other.email });
    const captureCount = mail.length;
    const absent = await request('/api/auth/request-password-reset', { email: `absent-${runId}@encore-tests.invalid` });
    check(existing.status === absent.status && JSON.stringify(await existing.json()) === JSON.stringify(await absent.json()) && mail.length === captureCount, 'Recovery disclosed account existence.');
    check((await request('/api/auth/sign-in/email', { email: other.email, password: originalPassword }, undefined, auth, 'https://untrusted.invalid')).status === 403, 'Cross-origin sign-in was accepted.');
    check((await request('/api/auth/request-password-reset', { email: other.email, redirectTo: 'https://untrusted.invalid/reset' })).status === 403 && mail.length === captureCount, 'Untrusted redirect captured email.');

    step = 'production denial and seed preservation';
    const priorMode = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: 'production' });
      let rejected = false;
      try { createLocalAuthLifecycle(prismaAdapter(client, { provider: 'postgresql', transaction: true }), capture); } catch { rejected = true; }
      check(rejected, 'Production lifecycle was enabled.');
    } finally {
      if (priorMode === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
      else Object.assign(process.env, { NODE_ENV: priorMode });
    }
    check(await seedSnapshot() === beforeSeed, 'Existing seeded identities, accounts or sessions changed.');
    check(JSON.stringify(await client.verification.findUnique({ where: { id: sentinelId } })) === JSON.stringify(sentinel), 'Lifecycle lookup changed an unrelated expired token.');
    check(outboundAttempts === 0, 'Lifecycle attempted outbound fetch.');
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: failed; raw diagnostics withheld.`);
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
    try {
      await client.verification.deleteMany({ where: { value: { in: users } } });
      await client.user.deleteMany({ where: { id: { in: users } } });
      await client.verification.deleteMany({ where: { id: sentinelId } });
      check(await client.user.count({ where: { id: { in: users } } }) === 0
        && await client.account.count({ where: { userId: { in: users } } }) === 0
        && await client.session.count({ where: { userId: { in: users } } }) === 0
        && await client.verification.count({ where: { value: { in: users } } }) === 0, 'Synthetic lifecycle cleanup failed.');
      if (beforeSeed !== undefined) check(await seedSnapshot() === beforeSeed, 'Cleanup changed seeded records.');
    } finally { await Promise.all([client.$disconnect(), secondClient.$disconnect()]); }
  }
  console.log('PASS Prisma/PostgreSQL lifecycle: verification, expiry/tampering, replay/concurrency, resend, password replacement, session isolation, reset rollback, verification failure recovery, origin/production denial and scoped cleanup. No mail sent.');
}

await verify().catch((error: unknown) => {
  console.error(`FAIL PostgreSQL lifecycle: ${error instanceof VerificationFailure ? error.message : 'Local prerequisites or cleanup failed; raw diagnostics withheld.'}`);
  process.exitCode = 1;
});
