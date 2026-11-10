export class LocalDatabaseError extends Error {}

/** Restrict development writes to the dedicated, loopback-only Encore database. */
export function validateLocalDatabase(environment: Readonly<Record<string, string | undefined>>): string {
  if (environment.NODE_ENV === 'production') {
    throw new LocalDatabaseError('Local database commands are unavailable in production.');
  }
  const value = environment.DATABASE_URL;
  if (!value) throw new LocalDatabaseError('DATABASE_URL is missing. Run pnpm run db:init and use the local .env settings.');
  let url: URL;
  try { url = new URL(value); } catch {
    throw new LocalDatabaseError('DATABASE_URL is malformed. Use the dedicated local URL from .env.example.');
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.port !== '54329'
    || url.username !== 'encore_local'
    || !url.password
    || url.pathname !== '/encore_local'
    || url.hash
    || [...url.searchParams].some(([key, item]) => key !== 'schema' || item !== 'public')
    || url.searchParams.getAll('schema').length > 1) {
    throw new LocalDatabaseError('Refusing database access: use loopback port 54329, user/database encore_local, a password, and only the optional schema=public query. Remote and other databases are not supported by these local commands.');
  }
  return value;
}
