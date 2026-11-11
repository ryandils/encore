import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localEnvironment } from '../scripts/db-local.ts';
import { DomainValidationError } from '../src/domain/validation.ts';
import { LedgerAccessError, PostgresLedgerService } from '../src/server/ledger-service.ts';

/** Local-only synthetic fixtures, removed in FK order even after a failed assertion. */
const pool = new pg.Pool({ connectionString: localEnvironment(), max: 8, connectionTimeoutMillis: 5000 });
const service = new PostgresLedgerService(pool);
const venue = randomUUID();
const night = randomUUID();
const otherVenue = randomUUID();
const owner = `kernel-owner-${randomUUID()}`;
const staff = `kernel-staff-${randomUUID()}`;
const outsider = `kernel-other-${randomUUID()}`;
const context = (authenticatedUserId = owner) => ({ authenticatedUserId, nightId: night });
const free = () => ({ type: 'FREE_ADMISSION' as const, requestId: randomUUID() });
async function rejects(action: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof LedgerAccessError && error.code === code);
}
try {
  for (const id of [owner, staff, outsider]) await pool.query('INSERT INTO "user" (id,name,email,"createdAt","updatedAt") VALUES ($1,$1,$2,now(),now())', [id, `${id}@encore-demo.invalid`]);
  await pool.query('INSERT INTO venue (id,name,timezone,capacity) VALUES ($1,\'Synthetic kernel verification\',\'UTC\',100)', [venue]);
  await pool.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\'),($1,$3,\'STAFF\')', [venue, owner, staff]);
  await pool.query('INSERT INTO night (id,"venueId",label,"openedAt",capacity,timezone,"openingFloatCents") VALUES ($1,$2,\'Synthetic kernel night\',now(),100,\'UTC\',10000)', [night, venue]);
  await pool.query('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,1,\'Synthetic paid\',1000)', [venue]);
  await pool.query('INSERT INTO venue (id,name,timezone,capacity) VALUES ($1,\'Synthetic other venue\',\'UTC\',100)', [otherVenue]);
  await pool.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\')', [otherVenue, outsider]);
  await rejects(service.doorState(context(outsider)), 'FORBIDDEN');
  await assert.rejects(service.record(context(), { type: 'EXIT', requestId: randomUUID() }), (error: unknown) => error instanceof DomainValidationError && error.code === 'INVALID_HISTORY');
  assert.equal((await service.doorState(context())).night.version, 0);
  await rejects(service.doorState(context(staff)), 'FORBIDDEN');
  await pool.query('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,now()-interval \'1 minute\',now()+interval \'1 hour\')', [night, venue, staff]);
  await pool.query('UPDATE night_assignment SET "startsAt"=now()-interval \'2 hours\',"endsAt"=now()-interval \'1 hour\' WHERE "nightId"=$1 AND "userId"=$2', [night, staff]);
  await rejects(service.doorState(context(staff)), 'FORBIDDEN');
  await pool.query('UPDATE night_assignment SET "startsAt"=now()+interval \'1 hour\',"endsAt"=now()+interval \'2 hours\' WHERE "nightId"=$1 AND "userId"=$2', [night, staff]);
  await rejects(service.doorState(context(staff)), 'FORBIDDEN');
  await pool.query('UPDATE night_assignment SET "startsAt"=now()-interval \'1 minute\',"endsAt"=now()+interval \'1 hour\' WHERE "nightId"=$1 AND "userId"=$2', [night, staff]);
  await rejects(service.summary(context(staff)), 'FORBIDDEN');
  await rejects(service.record(context(), { type: 'ADMISSION', requestId: randomUUID(), presetSlot: 1, expectedAmountCents: 500 }), 'STALE_PRESET');
  const paid = { type: 'ADMISSION' as const, requestId: randomUUID(), presetSlot: 1 as const, expectedAmountCents: 1000 };
  const duplicates = await Promise.all(Array.from({ length: 6 }, () => service.record(context(staff), paid)));
  for (const response of duplicates) assert.deepEqual(response, duplicates[0]);
  assert.equal(duplicates[0].state.occupancy, 1);
  await pool.query('UPDATE cover_preset SET "amountCents"=1500 WHERE "venueId"=$1', [venue]);
  assert.deepEqual(await service.record(context(staff), paid), duplicates[0]);
  assert.equal((await service.summary(context())).projection.expectedCoverCents, 1000);
  assert.equal('openingFloatCents' in duplicates[0].state, false);
  await rejects(service.record(context(staff), { ...paid, expectedAmountCents: 1500 }), 'REQUEST_CONFLICT');
  await rejects(service.record(context(), paid), 'REQUEST_CONFLICT');
  const ownerCommands = Array.from({ length: 5 }, free);
  const ownerResults = await Promise.all(ownerCommands.map((command) => service.record(context(), command)));
  assert.ok(ownerResults.every((result) => !result.state.recentActions.some((event) => event.id === duplicates[0].eventId)));
  await pool.query('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,now()-interval \'1 minute\',now()+interval \'1 hour\')', [night, venue, owner]);
  await pool.query('UPDATE venue_membership SET role=\'STAFF\' WHERE "venueId"=$1 AND "userId"=$2', [venue, owner]);
  assert.deepEqual(await service.record(context(), ownerCommands[0]), ownerResults[0]);
  await rejects(service.summary(context()), 'FORBIDDEN');
  await pool.query('UPDATE venue_membership SET role=\'OWNER\' WHERE "venueId"=$1 AND "userId"=$2', [venue, owner]);
  assert.equal((await service.doorState(context())).occupancy, 6);
  await rejects(service.record(context(staff), { type: 'REVERSAL', requestId: randomUUID(), targetEventId: ownerResults[0].eventId, reason: 'Forbidden other actor' }), 'FORBIDDEN');
  const newerStaff = await service.record(context(staff), free());
  await rejects(service.record(context(staff), { type: 'REVERSAL', requestId: randomUUID(), targetEventId: duplicates[0].eventId, reason: 'Not latest' }), 'FORBIDDEN');
  await pool.query('UPDATE door_event SET "recordedAt"=clock_timestamp()-interval \'61 seconds\' WHERE id=$1', [newerStaff.eventId]);
  await rejects(service.record(context(staff), { type: 'REVERSAL', requestId: randomUUID(), targetEventId: newerStaff.eventId, reason: 'Too old' }), 'FORBIDDEN');
  await service.record(context(), { type: 'REVERSAL', requestId: randomUUID(), targetEventId: newerStaff.eventId, reason: 'Owner correction of old action' });
  const correction = { type: 'REVERSAL' as const, requestId: randomUUID(), targetEventId: duplicates[0].eventId, reason: 'Synthetic correction' };
  await service.record(context(staff), correction);
  assert.equal((await service.summary(context())).projection.expectedCoverCents, 0);
  await rejects(service.record(context(staff), { ...correction, requestId: randomUUID() }), 'FORBIDDEN');
  await pool.query('UPDATE night_assignment SET "revokedAt"=now() WHERE "nightId"=$1 AND "userId"=$2', [night, staff]);
  await rejects(service.record(context(staff), paid), 'FORBIDDEN');
  // A new exit and close race under the same row lock: either exit commits first or is rejected.
  const closing = { requestId: randomUUID(), countedCashCents: 10000, notes: 'Synthetic close' };
  const race = await Promise.allSettled([service.record(context(), { type: 'EXIT', requestId: randomUUID() }), service.close(context(), closing)]);
  assert.equal(race[1].status, 'fulfilled');
  if (race[0].status === 'rejected') assert.equal((race[0].reason as LedgerAccessError).code, 'NIGHT_CLOSED');
  const closed = await service.close(context(), closing);
  assert.equal(closed.summary.night.status, 'CLOSED');
  assert.equal(closed.summary.reconciliation?.expectedDrawerCents, 10000);
  await rejects(service.close(context(), { ...closing, countedCashCents: 9999 }), 'REQUEST_CONFLICT');
  await rejects(service.record(context(), free()), 'NIGHT_CLOSED');
  // Retry after close returns the original event response without repricing/reprojecting.
  const ownerEvents = await pool.query('SELECT "requestPayload","responseSnapshot" FROM door_event WHERE "nightId"=$1 AND "actorId"=$2 AND type=\'ADMISSION\' LIMIT 1', [night, owner]);
  const prior = ownerEvents.rows[0];
  assert.deepEqual(await service.record(context(), JSON.parse(prior.requestPayload.payload).command), prior.responseSnapshot);
  const freshPool = new pg.Pool({ connectionString: localEnvironment(), max: 1 });
  try { const persisted = await new PostgresLedgerService(freshPool).summary(context()); assert.deepEqual(persisted.reconciliation, closed.summary.reconciliation); assert.equal(persisted.night.version, closed.summary.night.version); } finally { await freshPool.end(); }
  const counts = await pool.query('SELECT count(*)::int AS count, count(DISTINCT sequence)::int AS sequences FROM door_event WHERE "nightId"=$1', [night]);
  assert.equal(counts.rows[0].count, race[0].status === 'fulfilled' ? 10 : 9);
  assert.equal(counts.rows[0].sequences, counts.rows[0].count);
  console.log('Ledger kernel PostgreSQL verification passed: permissions, retries, concurrency, corrections, revocation, close race and durable receipts.');
} finally {
  await pool.query('DELETE FROM reconciliation WHERE "nightId"=$1', [night]);
  await pool.query('DELETE FROM door_event WHERE "nightId"=$1 AND type=\'REVERSAL\'', [night]);
  await pool.query('DELETE FROM door_event WHERE "nightId"=$1', [night]);
  await pool.query('DELETE FROM night_assignment WHERE "nightId"=$1', [night]);
  await pool.query('DELETE FROM night WHERE id=$1', [night]);
  await pool.query('DELETE FROM cover_preset WHERE "venueId"=$1', [venue]);
  await pool.query('DELETE FROM venue_membership WHERE "venueId"=$1', [venue]);
  await pool.query('DELETE FROM venue WHERE id=$1', [venue]);
  await pool.query('DELETE FROM venue_membership WHERE "venueId"=$1', [otherVenue]);
  await pool.query('DELETE FROM venue WHERE id=$1', [otherVenue]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [[owner, staff, outsider]]);
  await pool.end();
}
