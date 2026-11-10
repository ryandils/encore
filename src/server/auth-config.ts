import { validateLocalDatabase } from './local-database-config.ts';

export type AuthEnvironment = Readonly<Record<string, string | undefined>>;
export class AuthConfigurationError extends Error {}

/** B0.3 is a local demo; an optimized production server cannot enable it. */
export function demoAvailable(environment: AuthEnvironment = process.env): boolean {
  return environment.NODE_ENV === undefined || environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test';
}

export function getAuthConfig(environment: AuthEnvironment = process.env) {
  if (!demoAvailable(environment)) throw new AuthConfigurationError('The local authentication demo is unavailable in production.');
  let databaseURL: string;
  try { databaseURL = validateLocalDatabase(environment); } catch {
    throw new AuthConfigurationError('The local authentication demo requires the dedicated local database configuration.');
  }
  let url: URL;
  try { url = new URL(environment.BETTER_AUTH_URL ?? ''); } catch {
    throw new AuthConfigurationError('Set BETTER_AUTH_URL to the local demo origin. Run pnpm run auth:init.');
  }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new AuthConfigurationError('BETTER_AUTH_URL must be an HTTP loopback origin without credentials, path, query, or fragment.');
  }
  const secret = environment.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.trim() !== secret || secret.includes('\n')
    || secret === 'better-auth-secret-12345678901234567890') {
    throw new AuthConfigurationError('Configure a generated local authentication secret of at least 32 characters. Run pnpm run auth:init.');
  }
  return { databaseURL, baseURL: url.origin, secret };
}

export function getDemoPasswords(environment: AuthEnvironment = process.env) {
  const owner = environment.DEMO_OWNER_PASSWORD;
  const staff = environment.DEMO_STAFF_PASSWORD;
  if (!owner || !staff || [owner, staff].some((value) => value.length < 16 || value.length > 128 || value.trim() !== value)) {
    throw new AuthConfigurationError('Configure both generated local demo passwords (16–128 characters). Run pnpm run auth:init.');
  }
  if (owner === staff) throw new AuthConfigurationError('Use distinct passwords for the two synthetic demo identities.');
  return { OWNER: owner, STAFF: staff };
}
