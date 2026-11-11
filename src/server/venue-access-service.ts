import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AcceptInviteCommand, AssignmentView, CoverPreset, CreateInviteCommand, CreateVenueCommand, InviteResult, OpenNightCommand, OwnerSummary, PresetsCommand, VenueView } from '../domain/contracts.ts';
import { parseAcceptInviteCommand, parseCreateInviteCommand, parseCreateVenueCommand, parseOpenNightCommand, parsePresetsCommand } from '../domain/contracts.ts';
import { projectLedger } from '../domain/ledger.ts';
import { assertNonemptyString, assertUuid, DomainValidationError } from '../domain/validation.ts';
import { LedgerAccessError } from './ledger-service.ts';

type NightRow = { id: string; venueId: string; status: 'OPEN' | 'CLOSED' };
type AssignmentRow = { nightId: string; userId: string; startsAt: Date; endsAt: Date; revokedAt: Date | null };
const normalizedEmail = (email: string) => email.trim().toLowerCase();
function invalidInvite(): never { throw new LedgerAccessError('INVITE_INVALID', 'Invitation is invalid or unavailable.'); }
function assignmentView(row: AssignmentRow): AssignmentView {
  return { nightId: row.nightId, userId: row.userId, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null };
}
async function serverTime(db: PoolClient): Promise<Date> { return (await db.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0].now; }
async function owner(db: PoolClient, venueId: string, actorId: string): Promise<void> {
  const result = await db.query<{ role: string }>('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2 FOR SHARE', [venueId, actorId]);
  if (result.rows[0]?.role !== 'OWNER') throw new LedgerAccessError('FORBIDDEN', 'Owner access required.');
}
async function lockedNight(db: PoolClient, nightId: string): Promise<NightRow> {
  const { rows } = await db.query<NightRow>('SELECT id,"venueId",status FROM night WHERE id=$1 FOR UPDATE', [nightId]);
  if (!rows[0]) throw new LedgerAccessError('NOT_FOUND', 'Night not found.');
  return rows[0];
}
function open(night: NightRow): void { if (night.status !== 'OPEN') throw new LedgerAccessError('NIGHT_CLOSED', 'Night is closed.'); }
async function writePresets(db: PoolClient, venueId: string, presets: readonly CoverPreset[]): Promise<void> {
  for (const p of presets) await db.query('INSERT INTO cover_preset ("venueId",slot,label,"amountCents") VALUES ($1,$2,$3,$4) ON CONFLICT ("venueId",slot) DO UPDATE SET label=EXCLUDED.label,"amountCents"=EXCLUDED."amountCents"', [venueId, p.slot, p.label, p.amountCents]);
}

/** Session-derived actors only. No outbound mail or production authentication is introduced here.
 * Opening serializes on venue NO KEY UPDATE, then owner membership; it never locks an existing night.
 * Preset updates: venue NO KEY UPDATE -> active night -> membership/presets.
 * Night-scoped operations start with night; never acquire venue after night.
 * The venue lock permits FK KEY SHARE checks and serializes opening with preset edits.
 */
export class VenueAccessService {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  private async transaction<T>(actorId: string, work: (db: PoolClient) => Promise<T>): Promise<T> {
    assertNonemptyString(actorId, 'authenticatedUserId');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout = '10000ms'");
      const result = await work(db);
      await db.query('COMMIT'); return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  }
  createVenue(actorId: string, value: CreateVenueCommand): Promise<VenueView> {
    const command = parseCreateVenueCommand(value);
    return this.transaction(actorId, async (db) => {
      const user = await db.query('SELECT id FROM "user" WHERE id=$1 FOR KEY SHARE', [actorId]);
      if (!user.rowCount) throw new LedgerAccessError('UNAUTHENTICATED', 'Sign in first.');
      const venue = { id: randomUUID(), name: command.name, timezone: command.timezone, capacity: command.capacity };
      await db.query('INSERT INTO venue (id,name,timezone,capacity) VALUES ($1,$2,$3,$4)', [venue.id, venue.name, venue.timezone, venue.capacity]);
      await db.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'OWNER\')', [venue.id, actorId]);
      await writePresets(db, venue.id, command.presets);
      return venue;
    });
  }
  openNight(actorId: string, venueId: string, value: OpenNightCommand): Promise<OwnerSummary> {
    assertUuid(venueId, 'venueId'); const command = parseOpenNightCommand(value);
    return this.transaction(actorId, async (db) => {
      const result = await db.query<VenueView>('SELECT id,name,timezone,capacity FROM venue WHERE id=$1 FOR NO KEY UPDATE', [venueId]);
      const venue = result.rows[0];
      if (!venue) throw new LedgerAccessError('NOT_FOUND', 'Venue not found.');
      await owner(db, venueId, actorId);
      const existing = await db.query('SELECT id FROM night WHERE "venueId"=$1 AND status=\'OPEN\'', [venueId]);
      if (existing.rowCount) throw new LedgerAccessError('NIGHT_ALREADY_OPEN', 'A night is already open.');
      const now = await serverTime(db);
      const night = { id: randomUUID(), venueId, label: command.label, status: 'OPEN' as const, openedAt: now.toISOString(), closedAt: null,
        startingOccupancy: command.startingOccupancy, currency: command.currency, capacity: venue.capacity, timezone: venue.timezone, version: 0 };
      await db.query('INSERT INTO night (id,"venueId",label,"openedAt",capacity,timezone,"startingOccupancy","openingFloatCents",currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [night.id, venueId, night.label, now, night.capacity, night.timezone, night.startingOccupancy, command.openingFloatCents, night.currency]);
      const projection = projectLedger({ ...night, nightId: night.id, openingFloatCents: command.openingFloatCents }, []);
      return { night, openingFloatCents: command.openingFloatCents, projection, reconciliation: null, syncedAt: now.toISOString() };
    });
  }
  updatePresets(actorId: string, venueId: string, value: PresetsCommand): Promise<readonly CoverPreset[]> {
    assertUuid(venueId, 'venueId'); const command = parsePresetsCommand(value);
    return this.transaction(actorId, async (db) => {
      const venue = await db.query('SELECT id FROM venue WHERE id=$1 FOR NO KEY UPDATE', [venueId]);
      if (!venue.rowCount) throw new LedgerAccessError('NOT_FOUND', 'Venue not found.');
      const active = await db.query<{ id: string }>('SELECT id FROM night WHERE "venueId"=$1 AND status=\'OPEN\' FOR UPDATE', [venueId]);
      await owner(db, venueId, actorId);
      await writePresets(db, venueId, command.presets);
      if (active.rows[0]) await db.query('UPDATE night SET version=version+1 WHERE id=$1', [active.rows[0].id]);
      return command.presets;
    });
  }
  createInvite(actorId: string, nightId: string, value: CreateInviteCommand, origin: string): Promise<InviteResult> {
    assertUuid(nightId, 'nightId'); const command = parseCreateInviteCommand(value);
    const url = new URL('/invites/accept', origin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new DomainValidationError('Invitation origin must use HTTP or HTTPS.');
    return this.transaction(actorId, async (db) => {
      const night = await lockedNight(db, nightId); await owner(db, night.venueId, actorId); open(night);
      const email = normalizedEmail(command.intendedEmail);
      const targetOwner = await db.query('SELECT 1 FROM venue_membership m JOIN "user" u ON u.id=m."userId" WHERE m."venueId"=$1 AND m.role=\'OWNER\' AND lower(trim(u.email))=$2', [night.venueId, email]);
      if (targetOwner.rowCount) throw new LedgerAccessError('FORBIDDEN', 'Owners cannot receive staff assignments.');
      const now = await serverTime(db);
      const expiresAt = new Date(now.getTime() + 60 * 60_000);
      const id = randomUUID(); const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await db.query('INSERT INTO staff_invite (id,"venueId","nightId","tokenHash","intendedEmail","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, night.venueId, nightId, tokenHash, email, now, expiresAt]);
      url.hash = `token=${token}`;
      return { id, expiresAt: expiresAt.toISOString(), inviteUrl: url.toString() };
    });
  }
  acceptInvite(actorId: string, value: AcceptInviteCommand): Promise<AssignmentView> {
    let token: string;
    try { token = parseAcceptInviteCommand(value).token; } catch { return Promise.reject(new LedgerAccessError('INVITE_INVALID', 'Invitation is invalid or unavailable.')); }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return Promise.reject(new LedgerAccessError('INVITE_INVALID', 'Invitation is invalid or unavailable.'));
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.transaction(actorId, async (db) => {
      // Discover scope without locking the invite before its night (same ordering as revocation).
      const lookup = await db.query<{ nightId: string }>('SELECT "nightId" FROM staff_invite WHERE "tokenHash"=$1', [tokenHash]);
      if (!lookup.rows[0]) invalidInvite();
      const night = await lockedNight(db, lookup.rows[0].nightId);
      if (night.status !== 'OPEN') invalidInvite();
      const account = await db.query<{ email: string; emailVerified: boolean }>('SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR SHARE', [actorId]);
      const user = account.rows[0];
      if (!user?.emailVerified) invalidInvite();
      const invite = await db.query<{ id: string; intendedEmail: string; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null }>('SELECT id,"intendedEmail","expiresAt","consumedAt","revokedAt" FROM staff_invite WHERE "tokenHash"=$1 AND "nightId"=$2 FOR UPDATE', [tokenHash, night.id]);
      const receipt = invite.rows[0];
      if (!receipt || receipt.consumedAt || receipt.revokedAt || normalizedEmail(user.email) !== receipt.intendedEmail) invalidInvite();
      const membership = await db.query<{ role: string }>('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2 FOR SHARE', [night.venueId, actorId]);
      if (membership.rows[0]?.role === 'OWNER') invalidInvite();
      await db.query('INSERT INTO venue_membership ("venueId","userId",role) VALUES ($1,$2,\'STAFF\') ON CONFLICT ("venueId","userId") DO NOTHING', [night.venueId, actorId]);
      // Recheck a concurrent membership insertion without ever downgrading an owner.
      const granted = await db.query<{ role: string }>('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2 FOR SHARE', [night.venueId, actorId]);
      if (granted.rows[0]?.role !== 'STAFF') invalidInvite();
      const now = await serverTime(db);
      if (receipt.expiresAt <= now) invalidInvite();
      const endsAt = new Date(now.getTime() + 12 * 60 * 60_000);
      const assignment = await db.query<AssignmentRow>('INSERT INTO night_assignment ("nightId","venueId","userId","startsAt","endsAt","revokedAt") VALUES ($1,$2,$3,$4,$5,NULL) ON CONFLICT ("nightId","userId") DO UPDATE SET "startsAt"=EXCLUDED."startsAt","endsAt"=EXCLUDED."endsAt","revokedAt"=NULL RETURNING "nightId","userId","startsAt","endsAt","revokedAt"', [night.id, night.venueId, actorId, now, endsAt]);
      await db.query('UPDATE staff_invite SET "consumedAt"=$2 WHERE id=$1', [receipt.id, now]);
      return assignmentView(assignment.rows[0]);
    });
  }
  revokeInvite(actorId: string, nightId: string, inviteId: string): Promise<{ id: string; revokedAt: string }> {
    assertUuid(nightId, 'nightId'); assertUuid(inviteId, 'inviteId');
    return this.transaction(actorId, async (db) => {
      const night = await lockedNight(db, nightId); await owner(db, night.venueId, actorId); open(night);
      const invite = await db.query<{ id: string; consumedAt: Date | null }>('SELECT id,"consumedAt" FROM staff_invite WHERE id=$1 AND "nightId"=$2 AND "venueId"=$3 FOR UPDATE', [inviteId, nightId, night.venueId]);
      if (!invite.rows[0]) throw new LedgerAccessError('NOT_FOUND', 'Invitation not found.');
      if (invite.rows[0].consumedAt) throw new LedgerAccessError('INVITE_INVALID', 'Use assignment revocation for accepted invitations.');
      const now = await serverTime(db);
      const updated = await db.query<{ id: string; revokedAt: Date }>('UPDATE staff_invite SET "revokedAt"=COALESCE("revokedAt",$2) WHERE id=$1 RETURNING id,"revokedAt"', [inviteId, now]);
      return { id: updated.rows[0].id, revokedAt: updated.rows[0].revokedAt.toISOString() };
    });
  }
  revokeAssignment(actorId: string, nightId: string, userId: string): Promise<AssignmentView> {
    assertUuid(nightId, 'nightId'); assertNonemptyString(userId, 'userId');
    return this.transaction(actorId, async (db) => {
      const night = await lockedNight(db, nightId); await owner(db, night.venueId, actorId); open(night);
      const target = await db.query<{ email: string }>('SELECT email FROM "user" WHERE id=$1 FOR SHARE', [userId]);
      const assignment = await db.query<AssignmentRow>('SELECT "nightId","userId","startsAt","endsAt","revokedAt" FROM night_assignment WHERE "nightId"=$1 AND "userId"=$2 FOR UPDATE', [nightId, userId]);
      if (!target.rows[0] || !assignment.rows[0]) throw new LedgerAccessError('NOT_FOUND', 'Assignment not found.');
      const now = await serverTime(db);
      const updated = await db.query<AssignmentRow>('UPDATE night_assignment SET "revokedAt"=COALESCE("revokedAt",$3) WHERE "nightId"=$1 AND "userId"=$2 RETURNING "nightId","userId","startsAt","endsAt","revokedAt"', [nightId, userId, now]);
      await db.query('UPDATE staff_invite SET "revokedAt"=$3 WHERE "nightId"=$1 AND "intendedEmail"=$2 AND "consumedAt" IS NULL AND "revokedAt" IS NULL', [nightId, normalizedEmail(target.rows[0].email), now]);
      return assignmentView(updated.rows[0]);
    });
  }
}
