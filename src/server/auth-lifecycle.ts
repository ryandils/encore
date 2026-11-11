import { createHash, randomUUID } from 'node:crypto';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware, createEmailVerificationToken } from 'better-auth/api';
import { getAuthConfig } from './auth-config.ts';

export type CapturedAuthEmail = { kind: 'verification' | 'password-reset'; email: string; url: string; token: string };
export const AUTH_TOKEN_LIFETIME_SECONDS = 3600;
function requireSyntheticEmail(email: string) {
  if (!email.toLowerCase().endsWith('.invalid')) throw new Error('Lifecycle fixtures require reserved synthetic email addresses.');
}
const verificationKey = (token: string) => `encore-email:${createHash('sha256').update(token).digest('hex')}`;

/** Isolated local lifecycle seam. No route or delivery provider enables this factory. */
export function createLocalAuthLifecycle(database: NonNullable<BetterAuthOptions['database']>, capture: (email: CapturedAuthEmail) => Promise<void>) {
  // Always consult the real process environment; callers cannot opt into production.
  const config = getAuthConfig();
  if (!database) throw new Error('An isolated lifecycle database adapter is required.');
  const auth = betterAuth({
    appName: 'Encore isolated synthetic auth lifecycle',
    baseURL: config.baseURL,
    secret: config.secret,
    database,
    trustedOrigins: [config.baseURL],
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: AUTH_TOKEN_LIFETIME_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        requireSyntheticEmail(user.email);
        await capture({ kind: 'password-reset', email: user.email, url, token });
      },
    },
    emailVerification: {
      expiresIn: AUTH_TOKEN_LIFETIME_SECONDS,
      autoSignInAfterVerification: false,
      sendOnSignIn: false,
      sendVerificationEmail: async ({ user, url }) => {
        requireSyntheticEmail(user.email);
        const context = await auth.$context;
        // Native tokens otherwise repeat for the same user within one second.
        const token = await createEmailVerificationToken(config.secret, user.email, undefined,
          AUTH_TOKEN_LIFETIME_SECONDS, { userId: user.id, jti: randomUUID() });
        const link = new URL(url);
        link.searchParams.set('token', token);
        // The library signs/validates the token; this stored digest adds replay denial.
        await context.internalAdapter.createVerificationValue({
          identifier: verificationKey(token), value: user.id,
          expiresAt: new Date(Date.now() + AUTH_TOKEN_LIFETIME_SECONDS * 1000),
        });
        await capture({ kind: 'verification', email: user.email, url: link.href, token });
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/verify-email') return;
        const token = ctx.query?.token;
        if (typeof token !== 'string' || !await ctx.context.internalAdapter.consumeVerificationValue(verificationKey(token))) {
          throw new APIError('BAD_REQUEST', { code: 'INVALID_TOKEN', message: 'Invalid verification token' });
        }
      }),
    },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
  return auth;
}
