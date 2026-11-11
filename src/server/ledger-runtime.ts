import { Pool } from 'pg';
import { getAuth } from './auth.ts';
import { demoAvailable, getAuthConfig } from './auth-config.ts';
import { createLedgerHttpHandler } from './ledger-http.ts';
import { PostgresLedgerService } from './ledger-service.ts';
import { VenueAccessService } from './venue-access-service.ts';
import { OwnerReadService } from './owner-read-service.ts';

interface LedgerRuntime { url: string; service: PostgresLedgerService; access: VenueAccessService; owners: OwnerReadService }
const shared = globalThis as typeof globalThis & { encoreOwnerLedgerRuntime?: LedgerRuntime };
function getRuntime(): LedgerRuntime {
  const { databaseURL } = getAuthConfig();
  if (shared.encoreOwnerLedgerRuntime && shared.encoreOwnerLedgerRuntime.url !== databaseURL) throw new Error('Restart after changing local database settings.');
  if (!shared.encoreOwnerLedgerRuntime) {
    const pool = new Pool({ connectionString: databaseURL, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000 });
    // Idle disconnects must not crash the process or log connection details; requests return opaque 503s.
    pool.on('error', () => {});
    shared.encoreOwnerLedgerRuntime = { url: databaseURL, service: new PostgresLedgerService(pool), access: new VenueAccessService(pool), owners: new OwnerReadService(pool) };
  }
  return shared.encoreOwnerLedgerRuntime;
}
// Each request performs the maintained library's DB-backed session check, not a fixture-role lookup.
export const handleLedgerRequest = createLedgerHttpHandler({
  available: demoAvailable,
  origin: () => getAuthConfig().baseURL,
  session: async (headers) => getAuth().api.getSession({ headers }),
  service: () => getRuntime().service,
  access: () => getRuntime().access,
  owners: () => getRuntime().owners,
});
