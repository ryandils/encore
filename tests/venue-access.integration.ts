import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { localEnvironment } from '../scripts/db-local.ts';
import { LedgerAccessError, PostgresLedgerService } from '../src/server/ledger-service.ts';
import { VenueAccessService } from '../src/server/venue-access-service.ts';

class VerificationFailure extends Error {}
function check(value: unknown, message: string): asserts value { if (!value) throw new VerificationFailure(message); }
async function rejects(action: Promise<unknown>, code: string): Promise<void> {
  try { await action; } catch (error) { check(error instanceof LedgerAccessError && error.code === code, 'Expected authorization/domain rejection was not returned.'); return; }
  throw new VerificationFailure('Expected rejection unexpectedly succeeded.');
}
const presets = [
  { slot: 1 as const, label: 'Synthetic regular', amountCents: 1000 },
  { slot: 2 as const, label: 'Synthetic reduced', amountCents: 500 },
  { slot: 3 as const, label: 'Synthetic late', amountCents: 1500 },
];
const openInput = { label: 'Synthetic access night', startingOccupancy: 0, openingFloatCents: 10000, currency: 'USD' as const };

/** Guarded local-only PostgreSQL; creates unique users/venues and removes only those fixtures. */
async function verify(): Promise<void> {
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 8, connectionTimeoutMillis: 5000 });
  const owner = `venue-owner-${randomUUID()}`, staff = `venue-staff-${randomUUID()}`, wrong = `venue-wrong-${randomUUID()}`, unverified = `venue-unverified-${randomUUID()}`;
  const users = [owner, staff, wrong, unverified];
  const venues: string[] = [];
  let step = 'unique synthetic account setup';
  try {
    for (const user of users) await pool.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$1,$2,$3,now(),now())', [user, `${user}@encore-demo.invalid`, user !== unverified]);
    const ledger = new PostgresLedgerService(pool);
    const access = new VenueAccessService(pool);
    step = 'atomic owner venue and presets';
    const venue = await access.createVenue(owner, { name: 'Synthetic access venue', timezone: 'UTC', capacity: 100, presets });
    venues.push(venue.id);
    const membership = await pool.query('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2', [venue.id, owner]);
    check(membership.rows[0]?.role === 'OWNER', 'Venue creator did not receive owner membership.');
    check((await pool.query('SELECT count(*)::int AS count FROM cover_preset WHERE "venueId"=$1', [venue.id])).rows[0]?.count === 3, 'Venue did not atomically receive all three presets.');
    const other = await access.createVenue(wrong, { name: 'Synthetic unrelated venue', timezone: 'UTC', capacity: 50, presets });
    venues.push(other.id);
    await rejects(access.openNight(wrong, venue.id, openInput), 'FORBIDDEN');
    await rejects(access.updatePresets(wrong, venue.id, { presets }), 'FORBIDDEN');
    const rollbackName = `Synthetic rollback ${randomUUID()}`;
    let failedCreate = false;
    try { await access.createVenue(`${owner}-missing`, { name: rollbackName, timezone: 'UTC', capacity: 100, presets }); } catch { failedCreate = true; }
    const orphaned = await pool.query<{ id: string }>('SELECT id FROM venue WHERE name=$1', [rollbackName]);
    venues.push(...orphaned.rows.map((row) => row.id));
    check(failedCreate && orphaned.rowCount === 0, 'Failed owner membership left a partially created venue.');
    step = 'one-open-night concurrent creation';
    const opening = await Promise.allSettled([access.openNight(owner, venue.id, openInput), access.openNight(owner, venue.id, openInput)]);
    const opened = opening.find((result) => result.status === 'fulfilled');
    check(opened?.status === 'fulfilled' && opening.filter((result) => result.status === 'fulfilled').length === 1, 'Concurrent opens did not yield exactly one night.');
    const blocked = opening.find((result) => result.status === 'rejected');
    check(blocked?.status === 'rejected' && blocked.reason instanceof LedgerAccessError && blocked.reason.code === 'NIGHT_ALREADY_OPEN', 'Duplicate open did not produce the stable conflict code.');
    const night = opened.value.night.id;
    const context = (authenticatedUserId = owner) => ({ authenticatedUserId, nightId: night });
    const origin = 'http://127.0.0.1:3000';
    const issueInvite = (id: string) => access.createInvite(owner, night, { intendedEmail: `${id}@encore-demo.invalid` }, origin);
    const token = (invite: { inviteUrl: string }): string => {
      const url = new URL(invite.inviteUrl);
      check(url.origin === origin && !url.search && url.pathname === '/invites/accept', 'Invite secret link was not confined to the origin and fragment.');
      const value = new URLSearchParams(url.hash.slice(1)).get('token'); check(value && value.length >= 43, 'Invitation lacks a cryptographically sized secret.'); return value;
    };
    step = 'hashed intended-account invitations';
    const invite = await issueInvite(staff); const secret = token(invite);
    const stored = await pool.query('SELECT "tokenHash","intendedEmail","expiresAt","createdAt" FROM staff_invite WHERE id=$1', [invite.id]);
    check(stored.rows[0]?.tokenHash === createHash('sha256').update(secret).digest('hex') && stored.rows[0]?.tokenHash !== secret, 'Raw invitation secret was stored or hash was incorrect.');
    check(stored.rows[0]?.intendedEmail === `${staff}@encore-demo.invalid`, 'Invitation lost its intended account.');
    check(+stored.rows[0].expiresAt > +stored.rows[0].createdAt && +stored.rows[0].expiresAt - +stored.rows[0].createdAt <= 3600001, 'Invite lifetime was not bounded to one hour.');
    await rejects(access.acceptInvite(wrong, { token: secret }), 'INVITE_INVALID');
    await rejects(access.createInvite(wrong, night, { intendedEmail: `${staff}@encore-demo.invalid` }, origin), 'FORBIDDEN');
    const unverifiedInvite = await issueInvite(unverified);
    check(token(unverifiedInvite) !== secret, 'Independent invites reused a secret.');
    await rejects(access.acceptInvite(unverified, { token: token(unverifiedInvite) }), 'INVITE_INVALID');
    await rejects(access.acceptInvite(staff, { token: 'not-a-real-secret' }), 'INVITE_INVALID');
    step = 'concurrent one-use invite acceptance';
    const accepts = await Promise.allSettled([access.acceptInvite(staff, { token: secret }), access.acceptInvite(staff, { token: secret })]);
    const accepted = accepts.find((result) => result.status === 'fulfilled');
    check(accepted?.status === 'fulfilled' && accepts.filter((result) => result.status === 'fulfilled').length === 1, 'Concurrent acceptance granted the same invite twice.');
    const assignment = accepted.value;
    check(assignment.userId === staff && assignment.nightId === night && Date.parse(assignment.endsAt) > Date.parse(assignment.startsAt) && Date.parse(assignment.endsAt) - Date.parse(assignment.startsAt) <= 12 * 3600000, 'Assignment identity or bounded duration was incorrect.');
    await rejects(access.acceptInvite(staff, { token: secret }), 'INVITE_INVALID');
    await rejects(access.revokeInvite(owner, night, invite.id), 'INVITE_INVALID');
    check((await pool.query('SELECT "revokedAt" FROM night_assignment WHERE "nightId"=$1 AND "userId"=$2', [night, staff])).rows[0]?.revokedAt === null, 'Canceling a consumed invite unexpectedly revoked its separate assignment.');
    await ledger.doorState(context(staff));
    await rejects(access.openNight(staff, venue.id, openInput), 'FORBIDDEN');
    await rejects(access.updatePresets(staff, venue.id, { presets }), 'FORBIDDEN');
    await rejects(access.createInvite(staff, night, { intendedEmail: `${wrong}@encore-demo.invalid` }, origin), 'FORBIDDEN');
    await rejects(access.revokeAssignment(staff, night, owner), 'FORBIDDEN');
    step = 'preset edits and immutable ledger charges';
    const paid = { type: 'ADMISSION' as const, requestId: randomUUID(), presetSlot: 1 as const, expectedAmountCents: 1000 };
    const first = await ledger.record(context(staff), paid);
    await access.updatePresets(owner, venue.id, { presets: presets.map((p) => ({ ...p, amountCents: p.amountCents + 500 })) });
    const changed = await ledger.doorState(context(staff));
    check(changed.night.version > first.state.night.version && changed.presets[0]?.amountCents === 1500, 'Preset change did not refresh authoritative version/price.');
    await rejects(ledger.record(context(staff), { ...paid, requestId: randomUUID() }), 'STALE_PRESET');
    check((await ledger.record(context(staff), paid)).eventId === first.eventId, 'Preset edit invalidated an existing retry receipt.');
    check((await ledger.summary(context())).projection.expectedCoverCents === 1000, 'Preset edit repriced historical admission.');
    step = 'expired and revoked invitations';
    const expired = await issueInvite(wrong);
    await pool.query('UPDATE staff_invite SET "createdAt"=now()-interval \'2 hours\',"expiresAt"=now()-interval \'1 hour\' WHERE id=$1', [expired.id]);
    await rejects(access.acceptInvite(wrong, { token: token(expired) }), 'INVITE_INVALID');
    const revoked = await issueInvite(wrong);
    await rejects(access.revokeInvite(staff, night, revoked.id), 'FORBIDDEN');
    await rejects(access.revokeInvite(owner, randomUUID(), revoked.id), 'NOT_FOUND');
    const cancellation = await access.revokeInvite(owner, night, revoked.id);
    check(cancellation.id === revoked.id && Number.isFinite(Date.parse(cancellation.revokedAt)), 'Pending invite cancellation omitted its immutable timestamp.');
    const recancelled = await access.revokeInvite(owner, night, revoked.id);
    check(recancelled.revokedAt === cancellation.revokedAt, 'Repeated cancellation changed its original timestamp.');
    await rejects(access.acceptInvite(wrong, { token: token(revoked) }), 'INVITE_INVALID');
    check((await pool.query('SELECT 1 FROM night_assignment WHERE "nightId"=$1 AND "userId"=$2', [night, wrong])).rowCount === 0, 'Canceling an unaccepted invitation created an assignment.');
    step = 'revocation stops ledger access and outstanding invitations';
    const outstanding = await issueInvite(staff);
    await access.revokeAssignment(owner, night, staff);
    await rejects(ledger.doorState(context(staff)), 'FORBIDDEN');
    await rejects(ledger.record(context(staff), paid), 'FORBIDDEN');
    await rejects(access.acceptInvite(staff, { token: token(outstanding) }), 'INVITE_INVALID');
    check((await pool.query('SELECT "revokedAt" FROM staff_invite WHERE id=$1', [outstanding.id])).rows[0]?.revokedAt, 'Revocation left a recipient invitation active.');
    step = 'concurrent assignment revocation and pending acceptance';
    const reinstatement = await issueInvite(staff);
    await access.acceptInvite(staff, { token: token(reinstatement) });
    const competing = await issueInvite(staff);
    const revokeRace = await Promise.allSettled([
      access.acceptInvite(staff, { token: token(competing) }),
      access.revokeAssignment(owner, night, staff),
    ]);
    check(revokeRace[1].status === 'fulfilled', 'Concurrent invitation acceptance prevented revocation.');
    if (revokeRace[0].status === 'rejected') check(revokeRace[0].reason instanceof LedgerAccessError && revokeRace[0].reason.code === 'INVITE_INVALID', 'Acceptance/revocation race failed unexpectedly.');
    check((await pool.query('SELECT "revokedAt" FROM night_assignment WHERE "nightId"=$1 AND "userId"=$2', [night, staff])).rows[0]?.revokedAt, 'Concurrent acceptance restored a revoked assignment.');
    await rejects(access.acceptInvite(staff, { token: token(competing) }), 'INVITE_INVALID');
    await rejects(ledger.doorState(context(staff)), 'FORBIDDEN');
    step = 'owner membership cannot be downgraded';
    await rejects(issueInvite(owner), 'FORBIDDEN');
    check((await pool.query('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2', [venue.id, owner])).rows[0]?.role === 'OWNER', 'Invitation flow downgraded owner membership.');
    const promotedInvite = await issueInvite(wrong);
    await pool.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\')', [venue.id, wrong]);
    await rejects(access.acceptInvite(wrong, { token: token(promotedInvite) }), 'INVITE_INVALID');
    check((await pool.query('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2', [venue.id, wrong])).rows[0]?.role === 'OWNER', 'Accepting an old staff invite downgraded a promoted owner.');
    await pool.query('DELETE FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2', [venue.id, wrong]);
    step = 'close and invitation acceptance race';
    const racingInvite = await issueInvite(wrong);
    const race = await Promise.allSettled([
      access.acceptInvite(wrong, { token: token(racingInvite) }),
      ledger.close(context(), { requestId: randomUUID(), countedCashCents: 11000, notes: 'Synthetic access close' }),
    ]);
    check(race[1].status === 'fulfilled', 'Close failed while invitation acceptance raced.');
    if (race[0].status === 'rejected') check(race[0].reason instanceof LedgerAccessError && ['NIGHT_CLOSED', 'INVITE_INVALID'].includes(race[0].reason.code), 'Acceptance failed with an unexpected race error.');
    else await rejects(ledger.record(context(wrong), { type: 'FREE_ADMISSION', requestId: randomUUID() }), 'NIGHT_CLOSED');
    await rejects(issueInvite(staff), 'NIGHT_CLOSED');
    console.log('PASS venue access PostgreSQL verification. Internal service evidence only; no real invitations, email delivery, HTTP or physical-device acceptance.');
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: failed; raw diagnostics withheld to protect invite secrets.`);
  } finally {
    try {
      if (venues.length) {
        await pool.query('DELETE FROM reconciliation WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM door_event WHERE "venueId"=ANY($1::uuid[]) AND type=\'REVERSAL\'', [venues]);
        await pool.query('DELETE FROM door_event WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM staff_invite WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM night_assignment WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM night WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM cover_preset WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM venue_membership WHERE "venueId"=ANY($1::uuid[])', [venues]);
        await pool.query('DELETE FROM venue WHERE id=ANY($1::uuid[])', [venues]);
      }
      await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
    } finally { await pool.end(); }
  }
}
await verify().catch((error: unknown) => { console.error(`FAIL venue access verification: ${error instanceof VerificationFailure ? error.message : 'Check disposable local database prerequisites.'}`); process.exitCode = 1; });
