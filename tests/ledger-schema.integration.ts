import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localEnvironment } from '../scripts/db-local.ts';

/** Explicit local-only integration check. Every synthetic write is rolled back. */
async function verifyLedgerSchema(): Promise<void> {
  const connectionString = localEnvironment();
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  const venue = randomUUID();
  const otherVenue = randomUUID();
  const night = randomUUID();
  const otherNight = randomUUID();
  const earlierNight = randomUUID();
  const actor = `ledger-schema-${randomUUID()}`;
  const recordedAt = '2026-11-10T20:00:00.000Z';
  let checks = 0;
  let inTransaction = false;
  await client.connect();
  try {
    await client.query('BEGIN');
    inTransaction = true;
    await client.query('SET LOCAL statement_timeout = 10000');
    await client.query('SET LOCAL lock_timeout = 3000');
    await client.query(
      'INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$4)',
      [actor, 'Synthetic ledger constraint actor', `${actor}@encore-demo.invalid`, recordedAt],
    );
    await client.query('INSERT INTO venue (id,name,timezone,capacity) VALUES ($1,$3,$4,100),($2,$3,$4,100)',
      [venue, otherVenue, 'Synthetic ledger constraint venue', 'America/New_York']);
    await client.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\')', [venue, actor]);
    await client.query(
      'INSERT INTO night (id,"venueId",label,"openedAt",capacity,timezone) VALUES ($1,$2,$5,$6,100,$7),($3,$4,$5,$6,100,$7)',
      [night, venue, otherNight, otherVenue, 'Synthetic constraint night', recordedAt, 'America/New_York'],
    );
    await client.query(
      'INSERT INTO night (id,"venueId",label,"openedAt","closedAt",status,capacity,timezone) VALUES ($1,$2,$3,$4,$4,\'CLOSED\',100,$5)',
      [earlierNight, venue, 'Synthetic closed constraint night', recordedAt, 'America/New_York'],
    );

    async function rejects(sql: string, values: unknown[], code: string, constraint?: string): Promise<void> {
      await client.query('SAVEPOINT expected_rejection');
      let failure: unknown;
      try { await client.query(sql, values); } catch (error) { failure = error; }
      await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
      await client.query('RELEASE SAVEPOINT expected_rejection');
      assert.ok(failure instanceof pg.DatabaseError, 'Expected a PostgreSQL constraint rejection.');
      assert.equal(failure.code, code, 'Expected the specific PostgreSQL error category.');
      if (constraint) assert.equal(failure.constraint, constraint, 'Expected the intended constraint.');
      checks++;
    }

    await rejects('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'STAFF\')',
      [venue, actor], '23505', 'venue_membership_pkey');
    await rejects('INSERT INTO night (id,"venueId",label,"openedAt",capacity,timezone) VALUES ($1,$2,$3,$4,100,$5)',
      [randomUUID(), venue, 'Duplicate open night', recordedAt, 'UTC'], '23505', 'night_one_open_per_venue');
    await rejects('UPDATE night SET currency = \'EUR\' WHERE id = $1', [night], '23514', 'night_values_check');
    await rejects('UPDATE night SET "startingOccupancy" = -1 WHERE id = $1', [night], '23514', 'night_values_check');
    await rejects('UPDATE night SET status = \'CLOSED\' WHERE id = $1', [night], '23514', 'night_values_check');
    await rejects('UPDATE venue SET capacity = -1 WHERE id = $1', [venue], '23514', 'venue_values_check');
    await rejects('UPDATE venue SET capacity = 2147483648 WHERE id = $1', [venue], '22003');

    await client.query('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,1,\'Synthetic cover\',1000)', [venue]);
    await rejects('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,1,\'Duplicate\',1500)',
      [venue], '23505', 'cover_preset_pkey');
    await rejects('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,4,\'Invalid slot\',1000)',
      [venue], '23514', 'cover_preset_values_check');
    await rejects('UPDATE cover_preset SET "amountCents" = -1 WHERE "venueId" = $1', [venue], '23514', 'cover_preset_values_check');

    await client.query('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,$4,$5)',
      [night, venue, actor, recordedAt, '2026-11-11T03:00:00Z']);
    await rejects('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,$4,$5)',
      [otherNight, venue, actor, recordedAt, '2026-11-11T03:00:00Z'], '23503', 'night_assignment_nightId_venueId_fkey');
    await rejects('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt") VALUES ($1,$2,$3,$4,$5)',
      [otherNight, otherVenue, actor, recordedAt, '2026-11-11T03:00:00Z'], '23503', 'night_assignment_venueId_userId_fkey');
    await rejects('UPDATE night_assignment SET "endsAt" = "startsAt" WHERE "nightId" = $1',
      [night], '23514', 'night_assignment_interval_check');

    const invite = randomUUID();
    const tokenHash = `synthetic-hash-${randomUUID()}`;
    await client.query('INSERT INTO staff_invite (id,"nightId","venueId","tokenHash","intendedEmail","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [invite, night, venue, tokenHash, 'synthetic-invite@encore-demo.invalid', recordedAt, '2026-11-11T03:00:00Z']);
    await rejects('UPDATE staff_invite SET "venueId" = $1 WHERE id = $2', [otherVenue, invite], '23503', 'staff_invite_nightId_venueId_fkey');
    await rejects('UPDATE staff_invite SET "consumedAt" = "expiresAt" WHERE id = $1', [invite], '23514', 'staff_invite_values_check');
    await rejects('INSERT INTO staff_invite (id,"nightId","venueId","tokenHash","intendedEmail","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), night, venue, tokenHash, 'synthetic-invite@encore-demo.invalid', recordedAt, '2026-11-11T03:00:00Z'], '23505', 'staff_invite_tokenHash_key');

    const eventSql = 'INSERT INTO door_event (id,"nightId","venueId","actorId","requestId",sequence,type,"amountCents","targetEventId",reason,"recordedAt","requestPayload","responseSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)';
    function eventValues(options: {
      id?: string; nightId?: string; venueId?: string; requestId?: string; sequence?: number;
      type?: string; amount?: number; target?: string | null; reason?: string | null; response?: unknown;
    } = {}): unknown[] {
      return [options.id ?? randomUUID(), options.nightId ?? night, options.venueId ?? venue, actor,
        options.requestId ?? randomUUID(), options.sequence ?? 1, options.type ?? 'ADMISSION', options.amount ?? 1000,
        options.target ?? null, options.reason ?? null, recordedAt,
        JSON.stringify({ synthetic: true }), JSON.stringify(options.response ?? { synthetic: true })];
    }
    const admission = randomUUID();
    const requestId = randomUUID();
    await client.query(eventSql, eventValues({ id: admission, requestId }));
    const free = randomUUID();
    await client.query(eventSql, eventValues({ id: free, sequence: 2, amount: 0 }));
    await client.query(eventSql, eventValues({ sequence: 3, type: 'EXIT', amount: 0 }));
    await rejects(eventSql, eventValues(), '23505', 'door_event_nightId_sequence_key');
    await rejects(eventSql, eventValues({ requestId, sequence: 4 }), '23505', 'door_event_nightId_requestId_key');
    await rejects(eventSql, eventValues({ sequence: 4, amount: -1 }), '23514', 'door_event_values_check');
    await rejects(eventSql, eventValues({ sequence: 4, type: 'EXIT', amount: 100 }), '23514', 'door_event_values_check');
    await rejects(eventSql, eventValues({ sequence: 4, venueId: otherVenue }), '23503', 'door_event_nightId_venueId_fkey');
    await rejects(eventSql, eventValues({ sequence: 4, response: [] }), '23514', 'door_event_values_check');
    await rejects(eventSql, eventValues({ sequence: 4, type: 'REVERSAL', target: admission, amount: 0 }), '23514', 'door_event_values_check');
    await rejects(eventSql, eventValues({ sequence: 4, type: 'REVERSAL', target: randomUUID(), reason: 'Synthetic correction', amount: 0 }), '23503');
    await rejects(eventSql, eventValues({ nightId: earlierNight, type: 'REVERSAL', target: admission, reason: 'Wrong night', amount: 0 }),
      '23503', 'door_event_target_same_night_fkey');
    const self = randomUUID();
    await rejects(eventSql, eventValues({ id: self, sequence: 4, type: 'REVERSAL', target: self, reason: 'Self', amount: 0 }),
      '23514', 'door_event_values_check');
    const reversal = randomUUID();
    await client.query(eventSql, eventValues({ id: reversal, sequence: 4, type: 'REVERSAL', target: free, reason: 'Synthetic correction', amount: 0 }));
    await rejects(eventSql, eventValues({ sequence: 5, type: 'REVERSAL', target: free, reason: 'Duplicate correction', amount: 0 }),
      '23505', 'door_event_targetEventId_key');
    const retained = await client.query<{ amountCents: number; targetEventId: string | null }>(
      'SELECT "amountCents","targetEventId" FROM door_event WHERE id = $1', [admission]);
    assert.deepEqual(retained.rows, [{ amountCents: 1000, targetEventId: null }]);
    await client.query('UPDATE cover_preset SET "amountCents" = 1500 WHERE "venueId" = $1', [venue]);
    const unchanged = await client.query<{ amountCents: number }>('SELECT "amountCents" FROM door_event WHERE id = $1', [admission]);
    assert.equal(unchanged.rows[0]?.amountCents, 1000, 'Preset changes must leave admission snapshots intact.');
    await rejects('DELETE FROM door_event WHERE id = $1', [free], '23503');
    await rejects('DELETE FROM "user" WHERE id = $1', [actor], '23503');
    await rejects('DELETE FROM night WHERE id = $1', [night], '23503');

    await client.query('UPDATE night SET status = \'CLOSED\', "closedAt" = $2 WHERE id = $1', [night, recordedAt]);
    const reconciliationSql = 'INSERT INTO reconciliation ("nightId","venueId","requestId","countedCashCents","expectedCoverCents","expectedDrawerCents","floatCents","varianceCents",notes,"closedBy","closedAt","requestPayload","responseSnapshot") VALUES ($1,$2,$3,15000,5500,15500,10000,-500,$4,$5,$6,$7,$7)';
    await client.query(reconciliationSql, [night, venue, randomUUID(), 'Synthetic constraint snapshot', actor, recordedAt, JSON.stringify({ synthetic: true })]);
    await rejects(reconciliationSql, [night, venue, randomUUID(), 'Duplicate close', actor, recordedAt, '{}'], '23505', 'reconciliation_pkey');
    await rejects('UPDATE reconciliation SET "varianceCents" = 0 WHERE "nightId" = $1', [night], '23514', 'reconciliation_values_check');
    await rejects('UPDATE reconciliation SET "expectedDrawerCents" = 15000 WHERE "nightId" = $1', [night], '23514', 'reconciliation_values_check');
    await rejects('UPDATE reconciliation SET "floatCents" = 2147483647 WHERE "nightId" = $1', [night], '23514', 'reconciliation_values_check');
    await rejects('UPDATE reconciliation SET "venueId" = $1 WHERE "nightId" = $2', [otherVenue, night], '23503', 'reconciliation_nightId_venueId_fkey');
    await rejects('UPDATE reconciliation SET "responseSnapshot" = \'[]\'::jsonb WHERE "nightId" = $1', [night], '23514', 'reconciliation_values_check');

    await client.query('ROLLBACK');
    inTransaction = false;
    const remaining = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM venue WHERE id = $1', [venue]);
    assert.equal(remaining.rows[0]?.count, '0', 'All verification fixtures must be rolled back.');
    console.log(`PASS ledger schema: ${checks} PostgreSQL constraint rejections, valid synthetic relations/events/reconciliation, price snapshot preservation, and rollback cleanup. No live command authorization or concurrency is claimed.`);
  } finally {
    if (inTransaction) await client.query('ROLLBACK');
    await client.end();
  }
}

await verifyLedgerSchema().catch(() => {
  // SQL errors may contain record data or connection credentials; keep output fixed.
  console.error('FAIL ledger schema verification. Check local PostgreSQL health and migrations; raw diagnostic details are withheld.');
  process.exitCode = 1;
});
