import { Pool } from 'pg';
import { getAuth } from './auth.ts';
import { demoAvailable, getAuthConfig } from './auth-config.ts';
import { createLedgerHttpHandler } from './ledger-http.ts';
import { PostgresLedgerService } from './ledger-service.ts';

const shared = globalThis as typeof globalThis & {
  encoreLedgerRuntime?: { url: string; service: PostgresLedgerService };
};
function getLedgerService(): PostgresLedgerService {
  const { databaseURL } = getAuthConfig();
  if (shared.encoreLedgerRuntime && shared.encoreLedgerRuntime.url !== databaseURL) throw new Error('Restart after changing local database settings.');
  if (!shared.encoreLedgerRuntime) {
    const pool = new Pool({ connectionString: databaseURL, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000 });
    // Idle disconnects must not crash the process or log connection details; requests return opaque 503s.
    pool.on('error', () => {});
    shared.encoreLedgerRuntime = { url: databaseURL, service: new PostgresLedgerService(pool) };
  }
  return shared.encoreLedgerRuntime.service;
}
// Each request performs the maintained library's DB-backed session check, not a fixture-role lookup.
export const handleLedgerRequest = createLedgerHttpHandler({
  available: demoAvailable,
  origin: () => getAuthConfig().baseURL,
  session: async (headers) => getAuth().api.getSession({ headers }),
  service: getLedgerService,
});
