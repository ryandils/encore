import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { closeRequestPayload, eventRequestPayload, parseCloseCommand, parseEventCommand } from '../domain/contracts.ts';
import type { ApiErrorCode, CloseCommand, CloseResult, DoorState, EventCommand, EventResult, NightView, OwnerSummary } from '../domain/contracts.ts';
import { projectLedger, reconcileLedger } from '../domain/ledger.ts';
import type { DoorEvent, NightLedgerInput } from '../domain/types.ts';
import { assertNonemptyString, assertUuid, validateDoorEvent } from '../domain/validation.ts';
import type { LedgerCommandContext, TransactionalLedgerCommands } from './ledger-contract.ts';

export class LedgerAccessError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) { super(message); this.code = code; }
}
function fail(code: ApiErrorCode, message: string): never { throw new LedgerAccessError(code, message); }
type NightRow = { -readonly [K in keyof NightView]: K extends 'openedAt' ? Date : K extends 'closedAt' ? Date | null : NightView[K] } & { openingFloatCents: number };
interface Access { night: NightRow; role: 'OWNER' | 'STAFF'; now: Date }
function view(n: NightRow): NightView {
  return { id: n.id, venueId: n.venueId, label: n.label, status: n.status, openedAt: n.openedAt.toISOString(), closedAt: n.closedAt?.toISOString() ?? null,
    startingOccupancy: n.startingOccupancy, currency: n.currency, capacity: n.capacity, timezone: n.timezone, version: n.version };
}
function input(n: NightRow): NightLedgerInput { return { ...view(n), nightId: n.id, openingFloatCents: n.openingFloatCents }; }
async function history(db: PoolClient, nightId: string): Promise<DoorEvent[]> {
  const { rows } = await db.query('SELECT * FROM door_event WHERE "nightId"=$1 ORDER BY sequence', [nightId]);
  return rows.map((row): DoorEvent => {
    const event: unknown = { id: row.id, venueId: row.venueId, nightId: row.nightId, actorId: row.actorId, requestId: row.requestId,
      sequence: row.sequence, type: row.type, amountCents: row.amountCents, recordedAt: row.recordedAt.toISOString(),
      ...(row.type === 'REVERSAL' ? { targetEventId: row.targetEventId, reason: row.reason } : {}) };
    validateDoorEvent(event); return event;
  });
}
interface UndoContext { reversedIds: ReadonlySet<string>; latestActionId: string | undefined }
function undoContext(events: readonly DoorEvent[], actor: string, reversedIds: ReadonlySet<string>): UndoContext {
  // History is in server sequence order; timestamps do not determine the latest action.
  const latest = events.findLast((event) => event.actorId === actor && event.type !== 'REVERSAL' && !reversedIds.has(event.id));
  return { reversedIds, latestActionId: latest?.id };
}
function undoAllowed(event: DoorEvent, undo: UndoContext, access: Access, actor: string): boolean {
  if (access.night.status !== 'OPEN' || event.type === 'REVERSAL' || undo.reversedIds.has(event.id)) return false;
  if (access.role === 'OWNER') return true;
  const age = access.now.getTime() - Date.parse(event.recordedAt);
  return event.actorId === actor && undo.latestActionId === event.id && age >= 0 && age <= 60_000;
}
async function state(db: PoolClient, access: Access, actor: string, events: readonly DoorEvent[]): Promise<DoorState> {
  const projection = projectLedger(input(access.night), events);
  const undo = undoContext(events, actor, new Set(projection.reversedEventIds));
  const { rows: presets } = await db.query('SELECT slot,label,"amountCents" FROM cover_preset WHERE "venueId"=$1 ORDER BY slot', [access.night.venueId]);
  return { night: view(access.night), occupancy: projection.occupancy, atOrAboveCapacity: projection.atOrAboveCapacity, presets,
    recentActions: events.filter((e) => access.role === 'OWNER' || e.actorId === actor).slice(-20).reverse().map((e) => ({
      id: e.id, type: e.type, sequence: e.sequence, recordedAt: e.recordedAt, amountCents: e.amountCents,
      reversed: undo.reversedIds.has(e.id), canUndo: undoAllowed(e, undo, access, actor),
    })), syncedAt: access.now.toISOString() };
}
async function ownerSummary(db: PoolClient, access: Access, events: readonly DoorEvent[]): Promise<OwnerSummary> {
  if (access.role !== 'OWNER') fail('FORBIDDEN', 'Owner access required.');
  const { rows } = await db.query('SELECT * FROM reconciliation WHERE "nightId"=$1', [access.night.id]);
  const r = rows[0];
  return { night: view(access.night), openingFloatCents: access.night.openingFloatCents, projection: projectLedger(input(access.night), events),
    reconciliation: r ? { countedCashCents: r.countedCashCents, expectedCoverCents: r.expectedCoverCents, floatCents: r.floatCents,
      expectedDrawerCents: r.expectedDrawerCents, varianceCents: r.varianceCents, closedBy: r.closedBy, closedAt: r.closedAt.toISOString(), notes: r.notes } : null,
    syncedAt: access.now.toISOString() };
}

/** Internal server kernel. Callers must derive authenticatedUserId from a verified session, never a body. */
export class PostgresLedgerService implements TransactionalLedgerCommands {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  private async transaction<T>(context: LedgerCommandContext, work: (db: PoolClient, access: Access) => Promise<T>): Promise<T> {
    assertUuid(context.nightId, 'nightId'); assertNonemptyString(context.authenticatedUserId, 'authenticatedUserId');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout = '10000ms'");
      const { rows } = await db.query<NightRow>('SELECT * FROM night WHERE id=$1 FOR UPDATE', [context.nightId]);
      const night = rows[0];
      if (!night) fail('NOT_FOUND', 'Night not found.');
      // Read fresh server time after waiting for the lock, including assignment expiration.
      const membership = await db.query<{ role: 'OWNER' | 'STAFF' }>('SELECT role FROM venue_membership WHERE "venueId"=$1 AND "userId"=$2 FOR SHARE', [night.venueId, context.authenticatedUserId]);
      const role = membership.rows[0]?.role;
      if (!role) fail('FORBIDDEN', 'Venue access required.');
      const assignment = role === 'STAFF' ? await db.query<{ startsAt: Date; endsAt: Date; revokedAt: Date | null }>('SELECT "startsAt","endsAt","revokedAt" FROM night_assignment WHERE "nightId"=$1 AND "venueId"=$2 AND "userId"=$3 FOR SHARE', [night.id, night.venueId, context.authenticatedUserId]) : null;
      const time = await db.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const now = time.rows[0].now;
      if (role === 'STAFF') {
        const active = assignment?.rows[0];
        if (!active || active.revokedAt || active.startsAt > now || active.endsAt <= now) fail('FORBIDDEN', 'Active night assignment required.');
      }
      const result = await work(db, { night, role, now });
      await db.query('COMMIT'); return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  }
  doorState(context: LedgerCommandContext): Promise<DoorState> {
    return this.transaction(context, async (db, access) => state(db, access, context.authenticatedUserId, await history(db, context.nightId)));
  }
  summary(context: LedgerCommandContext): Promise<OwnerSummary> {
    return this.transaction(context, async (db, access) => ownerSummary(db, access, await history(db, context.nightId)));
  }
  record(context: LedgerCommandContext, value: EventCommand): Promise<EventResult> {
    const command = parseEventCommand(value);
    const payload = eventRequestPayload(context.nightId, command);
    return this.transaction(context, async (db, access) => {
      const receipt = await db.query('SELECT "actorId","requestPayload","responseSnapshot" FROM door_event WHERE "nightId"=$1 AND "requestId"=$2', [context.nightId, command.requestId]);
      const prior = receipt.rows[0];
      if (prior) {
        if (prior.actorId !== context.authenticatedUserId || prior.requestPayload.payload !== payload) fail('REQUEST_CONFLICT', 'Request ID already belongs to another action.');
        return prior.responseSnapshot as EventResult;
      }
      if (access.night.status !== 'OPEN') fail('NIGHT_CLOSED', 'Night is closed.');
      const events = await history(db, context.nightId);
      let amountCents = 0;
      if (command.type === 'ADMISSION') {
        const preset = await db.query('SELECT "amountCents" FROM cover_preset WHERE "venueId"=$1 AND slot=$2 FOR SHARE', [access.night.venueId, command.presetSlot]);
        if (preset.rows[0]?.amountCents !== command.expectedAmountCents) fail('STALE_PRESET', 'Refresh the changed cover price.');
        amountCents = preset.rows[0].amountCents;
      }
      if (command.type === 'REVERSAL') {
        const target = events.find((e) => e.id === command.targetEventId);
        const reversedIds = new Set(events.filter((e) => e.type === 'REVERSAL').map((e) => e.targetEventId));
        const undo = undoContext(events, context.authenticatedUserId, reversedIds);
        if (!target || !undoAllowed(target, undo, access, context.authenticatedUserId)) fail('FORBIDDEN', 'This action cannot be corrected.');
      }
      const event = { id: randomUUID(), venueId: access.night.venueId, nightId: context.nightId, actorId: context.authenticatedUserId,
        requestId: command.requestId, sequence: (events.at(-1)?.sequence ?? 0) + 1, recordedAt: access.now.toISOString(),
        type: command.type === 'FREE_ADMISSION' ? 'ADMISSION' : command.type, amountCents,
        ...(command.type === 'REVERSAL' ? { targetEventId: command.targetEventId, reason: command.reason } : {}) };
      validateDoorEvent(event);
      projectLedger(input(access.night), [...events, event]);
      access.night.version++;
      // Retry receipts always contain only this actor's actions, even if an owner is later demoted.
      // Fetch doorState separately for the current owner's broader view.
      const result: EventResult = { eventId: event.id, requestId: command.requestId, state: await state(db, { ...access, role: 'STAFF' }, context.authenticatedUserId, [...events, event]) };
      await db.query('INSERT INTO door_event (id,"venueId","nightId","actorId","requestId",sequence,type,"amountCents","targetEventId",reason,"recordedAt","requestPayload","responseSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [event.id, event.venueId, event.nightId, event.actorId, event.requestId, event.sequence, event.type, event.amountCents,
          event.type === 'REVERSAL' ? event.targetEventId : null, event.type === 'REVERSAL' ? event.reason : null, access.now, { payload }, result]);
      await db.query('UPDATE night SET version=$2 WHERE id=$1', [context.nightId, access.night.version]);
      return result;
    });
  }
  close(context: LedgerCommandContext, value: CloseCommand): Promise<CloseResult> {
    const command = parseCloseCommand(value);
    const payload = closeRequestPayload(context.nightId, command);
    return this.transaction(context, async (db, access) => {
      if (access.role !== 'OWNER') fail('FORBIDDEN', 'Owner access required.');
      const receipt = await db.query('SELECT * FROM reconciliation WHERE "nightId"=$1', [context.nightId]);
      const prior = receipt.rows[0];
      if (prior?.requestId === command.requestId) {
        if (prior.closedBy !== context.authenticatedUserId || prior.requestPayload.payload !== payload) fail('REQUEST_CONFLICT', 'Close request payload changed.');
        return prior.responseSnapshot as CloseResult;
      }
      if (prior || access.night.status !== 'OPEN') fail('NIGHT_CLOSED', 'Night is closed.');
      const events = await history(db, context.nightId);
      const reconciliation = reconcileLedger(input(access.night), events, command.countedCashCents);
      access.night.status = 'CLOSED'; access.night.closedAt = access.now; access.night.version++;
      const summary: OwnerSummary = { ...await ownerSummary(db, access, events), reconciliation: { ...reconciliation, closedBy: context.authenticatedUserId, closedAt: access.now.toISOString(), notes: command.notes } };
      const result: CloseResult = { requestId: command.requestId, summary };
      await db.query('INSERT INTO reconciliation ("nightId","venueId","requestId","countedCashCents","expectedCoverCents","floatCents","expectedDrawerCents","varianceCents",notes,"closedBy","closedAt","requestPayload","responseSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [context.nightId, access.night.venueId, command.requestId, reconciliation.countedCashCents, reconciliation.expectedCoverCents, reconciliation.floatCents, reconciliation.expectedDrawerCents, reconciliation.varianceCents, command.notes, context.authenticatedUserId, access.now, { payload }, result]);
      await db.query('UPDATE night SET status=\'CLOSED\',"closedAt"=$2,version=$3 WHERE id=$1', [context.nightId, access.now, access.night.version]);
      return result;
    });
  }
}
