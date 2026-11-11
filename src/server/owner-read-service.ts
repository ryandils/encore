import type { Pool, PoolClient } from 'pg';
import type { AssignmentAccessView, CoverPreset, InviteAccessView, NightView, OwnerNightAccess, OwnerVenueConfiguration, VenueView } from '../domain/contracts.ts';
import { assertNonemptyString, assertUuid } from '../domain/validation.ts';
import { LedgerAccessError } from './ledger-service.ts';

type NightRow = Omit<NightView, 'openedAt' | 'closedAt'> & { openedAt: Date; closedAt: Date | null };
async function requireOwner(db: PoolClient, actorId: string, venueId: string): Promise<void> {
  const membership = await db.query<{ role: string }>('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2 FOR SHARE', [venueId, actorId]);
  if (membership.rows[0]?.role !== 'OWNER') throw new LedgerAccessError('FORBIDDEN', 'Owner access required.');
}

/** Scoped owner metadata reads. No tokens, hashes or ledger receipts are returned.
 * Config/history reads lock membership then perform only nonlocking SELECTs; they never
 * acquire a later night lock. Access reads follow the kernel's night -> membership order.
 */
export class OwnerReadService {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  private async transaction<T>(actorId: string, work: (db: PoolClient) => Promise<T>): Promise<T> {
    assertNonemptyString(actorId, 'authenticatedUserId');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout = '10000ms'");
      const result = await work(db);
      await db.query('COMMIT');
      return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  }
  listVenues(actorId: string): Promise<readonly VenueView[]> {
    return this.transaction(actorId, async (db) => {
      // Authorization and data projection share one statement snapshot.
      const result = await db.query<VenueView>('SELECT v.id,v.name,v.timezone,v.capacity FROM venue v JOIN venue_membership m ON m."venueId"=v.id WHERE m."userId"=$1 AND m.role=\'OWNER\' ORDER BY v.name,v.id', [actorId]);
      return result.rows;
    });
  }
  venueConfiguration(actorId: string, venueId: string): Promise<OwnerVenueConfiguration> {
    assertUuid(venueId, 'venueId');
    return this.transaction(actorId, async (db) => {
      await requireOwner(db, actorId, venueId);
      const venue = await db.query<VenueView>('SELECT id,name,timezone,capacity FROM venue WHERE id=$1', [venueId]);
      if (!venue.rows[0]) throw new LedgerAccessError('NOT_FOUND', 'Venue not found.');
      const presets = await db.query<CoverPreset>('SELECT slot,label,"amountCents" FROM cover_preset WHERE "venueId"=$1 ORDER BY slot', [venueId]);
      return { venue: venue.rows[0], presets: presets.rows };
    });
  }
  listNights(actorId: string, venueId: string): Promise<readonly NightView[]> {
    assertUuid(venueId, 'venueId');
    return this.transaction(actorId, async (db) => {
      await requireOwner(db, actorId, venueId);
      const result = await db.query<NightRow>('SELECT id,"venueId",label,status,"openedAt","closedAt","startingOccupancy",currency,capacity,timezone,version FROM night WHERE "venueId"=$1 ORDER BY "openedAt" DESC,id DESC', [venueId]);
      return result.rows.map((night) => ({ ...night, openedAt: night.openedAt.toISOString(), closedAt: night.closedAt?.toISOString() ?? null }));
    });
  }
  nightAccess(actorId: string, nightId: string): Promise<OwnerNightAccess> {
    assertUuid(nightId, 'nightId');
    return this.transaction(actorId, async (db) => {
      const night = await db.query<{ venueId: string }>('SELECT "venueId" FROM night WHERE id=$1 FOR UPDATE', [nightId]);
      if (!night.rows[0]) throw new LedgerAccessError('NOT_FOUND', 'Night not found.');
      await requireOwner(db, actorId, night.rows[0].venueId);
      type InviteRow = Omit<InviteAccessView, 'expiresAt' | 'consumedAt' | 'revokedAt'> & { expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null };
      const invites = await db.query<InviteRow>('SELECT id,"intendedEmail","expiresAt","consumedAt","revokedAt" FROM staff_invite WHERE "nightId"=$1 AND "venueId"=$2 ORDER BY "expiresAt" DESC,id DESC', [nightId, night.rows[0].venueId]);
      type AssignmentRow = Omit<AssignmentAccessView, 'startsAt' | 'endsAt' | 'revokedAt'> & { startsAt: Date; endsAt: Date; revokedAt: Date | null };
      const assignments = await db.query<AssignmentRow>('SELECT a."nightId",a."userId",a."startsAt",a."endsAt",a."revokedAt",u.email FROM night_assignment a JOIN "user" u ON u.id=a."userId" WHERE a."nightId"=$1 AND a."venueId"=$2 ORDER BY u.email,a."userId"', [nightId, night.rows[0].venueId]);
      return {
        invites: invites.rows.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString(), consumedAt: invite.consumedAt?.toISOString() ?? null, revokedAt: invite.revokedAt?.toISOString() ?? null })),
        assignments: assignments.rows.map((assignment) => ({ ...assignment, startsAt: assignment.startsAt.toISOString(), endsAt: assignment.endsAt.toISOString(), revokedAt: assignment.revokedAt?.toISOString() ?? null })),
      };
    });
  }
}
