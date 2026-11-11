import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localEnvironment } from '../scripts/db-local.ts';
import { LedgerAccessError, PostgresLedgerService } from '../src/server/ledger-service.ts';
import { OwnerReadService } from '../src/server/owner-read-service.ts';
import { VenueAccessService } from '../src/server/venue-access-service.ts';

class VerificationFailure extends Error {}
function check(value: unknown, message: string): asserts value { if (!value) throw new VerificationFailure(message); }
async function forbidden(action: Promise<unknown>): Promise<void> {
  try { await action; } catch (error) { check(error instanceof LedgerAccessError && error.code === 'FORBIDDEN', 'Expected owner authorization failure.'); return; }
  throw new VerificationFailure('Owner-only operation was unexpectedly allowed.');
}
/** Independent CSV parser supports quoted newlines and doubled quotes. */
function readCsv(csv: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') { if (quoted && csv[index + 1] === '"') { field += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && char === '\r' && csv[index + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; index++; }
    else field += char;
  }
  check(!quoted && !field && row.length === 0, 'CSV quoting or final record terminator is invalid.');
  const header = rows.shift(); check(header && header.length === 25 && new Set(header).size === header.length, 'CSV headers are absent or duplicated.');
  check(['venueId', 'requestId', 'targetEventId', 'reason', 'startingOccupancy', 'openingFloatCents', 'timezone', 'capacity', 'currency'].every((column) => header.includes(column)), 'Audit columns are missing.');
  return rows.map((values) => { check(values.length === header.length, 'CSV row width differs from its header.'); return Object.fromEntries(header.map((column, index) => [column, values[index]])); });
}
const presets = [1, 2, 3].map((slot) => ({ slot: slot as 1 | 2 | 3, label: `Synthetic ${slot}`, amountCents: slot * 500 }));
const openInput = { label: '=Synthetic, "audit"\r\nnight', startingOccupancy: 0, openingFloatCents: 10000, currency: 'USD' as const };

/** Local synthetic service integration; no seed-user changes, email, resets or live venue records. */
async function verify(): Promise<void> {
  const pool = new pg.Pool({ connectionString: localEnvironment(), max: 8, connectionTimeoutMillis: 5000 });
  const owner = `=export-owner-${randomUUID()}`, staff = `export-staff-${randomUUID()}`, outsider = `export-other-${randomUUID()}`;
  const users = [owner, staff, outsider], venues: string[] = [];
  let step = 'unique synthetic fixture setup';
  try {
    for (const user of users) await pool.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$1,$2,true,now(),now())', [user, `${user}@encore-demo.invalid`]);
    const access = new VenueAccessService(pool), ledger = new PostgresLedgerService(pool), reads = new OwnerReadService(pool);
    const venue = await access.createVenue(owner, { name: 'Synthetic export venue', timezone: 'UTC', capacity: 100, presets }); venues.push(venue.id);
    const other = await access.createVenue(outsider, { name: 'Synthetic other export venue', timezone: 'UTC', capacity: 50, presets }); venues.push(other.id);
    const opened = await access.openNight(owner, venue.id, openInput); const nightId = opened.night.id;
    const context = (authenticatedUserId = owner) => ({ authenticatedUserId, nightId });
    const invite = await access.createInvite(owner, nightId, { intendedEmail: `${staff}@encore-demo.invalid` }, 'http://127.0.0.1:3000');
    const secret = new URLSearchParams(new URL(invite.inviteUrl).hash.slice(1)).get('token'); check(secret, 'Synthetic invitation secret is missing.');
    await access.acceptInvite(staff, { token: secret });
    const pendingInvite = await access.createInvite(owner, nightId, { intendedEmail: `${outsider}@encore-demo.invalid` }, 'http://127.0.0.1:3000');
    const pendingSecret = new URLSearchParams(new URL(pendingInvite.inviteUrl).hash.slice(1)).get('token'); check(pendingSecret, 'Pending synthetic secret is missing.');
    step = 'owner read isolation and private invitation projection';
    const owned = await reads.listVenues(owner); check(owned.length === 1 && owned[0]?.id === venue.id, 'Venue listing exposed another owner venue.');
    check((await reads.listVenues(staff)).length === 0, 'Staff membership appeared as an owned venue.');
    const configuration = await reads.venueConfiguration(owner, venue.id);
    check(configuration.venue.id === venue.id && configuration.presets.length === 3, 'Owner configuration did not reload authoritative venue presets.');
    const nights = await reads.listNights(owner, venue.id); check(nights.length === 1 && nights[0]?.id === nightId && nights[0]?.status === 'OPEN', 'Active-night listing was incorrect.');
    const accessView = await reads.nightAccess(owner, nightId);
    check(accessView.invites.length === 2 && accessView.assignments.some((assignment) => assignment.userId === staff), 'Access listing omitted stored invitations or assignments.');
    const accessJson = JSON.stringify(accessView);
    check(!accessJson.includes('tokenHash') && !accessJson.includes('token=') && !accessJson.includes(secret) && !accessJson.includes(pendingSecret), 'Owner read leaked invitation credentials.');
    for (const actor of [staff, outsider]) {
      await forbidden(reads.venueConfiguration(actor, venue.id)); await forbidden(reads.listNights(actor, venue.id));
      await forbidden(reads.nightAccess(actor, nightId)); await forbidden(ledger.exportNight(context(actor)));
    }
    step = 'original event audit and price snapshot preservation';
    const paid = { type: 'ADMISSION' as const, requestId: randomUUID(), presetSlot: 2 as const, expectedAmountCents: 1000 };
    const first = await ledger.record(context(), paid);
    await access.updatePresets(owner, venue.id, { presets: presets.map((preset) => ({ ...preset, amountCents: preset.amountCents + 500 })) });
    const secondCommand = { ...paid, requestId: randomUUID(), expectedAmountCents: 1500 };
    const second = await ledger.record(context(staff), secondCommand);
    const exiting = { type: 'EXIT' as const, requestId: randomUUID() }; const exit = await ledger.record(context(staff), exiting);
    const reversing = { type: 'REVERSAL' as const, requestId: randomUUID(), targetEventId: first.eventId, reason: '=SUM(A1), "reason"\r\nmore' };
    const reversal = await ledger.record(context(), reversing);
    const closeCommand = { requestId: randomUUID(), countedCashCents: 11000, notes: '@Synthetic shortfall, "review"\r\nnotes' };
    const close = await ledger.close(context(), closeCommand);
    check(close.summary.reconciliation?.varianceCents === -500, 'Fixture close variance is incorrect.');
    const exported = await ledger.exportNight(context());
    check(exported.contentType === 'text/csv' && exported.filename === `synthetic-encore-${nightId}.csv`, 'CSV download metadata is incorrect.');
    const rows = readCsv(exported.csv), events = rows.filter((row) => row.recordType === 'event');
    check(events.length === 4 && rows.length === 6, 'Audit export omitted original or reversed events.');
    const nightSnapshot = rows.find((row) => row.recordType === 'night');
    check(nightSnapshot?.startingOccupancy === '0' && nightSnapshot.openingFloatCents === '10000' && nightSnapshot.timezone === 'UTC' && nightSnapshot.capacity === '100' && nightSnapshot.currency === 'USD' && nightSnapshot.type === 'CLOSED' && nightSnapshot.id === nightId, 'Night opening metadata was absent from the audit.');
    check(rows.every((row) => row.synthetic === 'true'), 'Local export was not visibly labeled synthetic.');
    for (const [eventId, requestId] of [[first.eventId, paid.requestId], [second.eventId, secondCommand.requestId], [exit.eventId, exiting.requestId], [reversal.eventId, reversing.requestId]]) {
      const row = events.find((event) => event.id === eventId); check(row?.requestId === requestId && row.venueId === venue.id && row.nightId === nightId && Number.isFinite(Date.parse(row.recordedAt)), 'Audit event identity, scope, request or timestamp was lost.');
    }
    check(events.find((event) => event.id === first.eventId)?.amountCents === '1000' && events.find((event) => event.id === second.eventId)?.amountCents === '1500', 'Export repriced original events.');
    const correction = events.find((event) => event.id === reversal.eventId);
    check(correction?.targetEventId === first.eventId && correction.reason === `'${reversing.reason}`, 'Reversal target or formula-safe reason was lost.');
    check(events.find((event) => event.id === first.eventId)?.actorId === `'${owner}`, 'Actor identity formula was not neutralized.');
    const reconciliation = rows.find((row) => row.recordType === 'reconciliation');
    check(reconciliation?.expectedCoverCents === '1500' && reconciliation.expectedDrawerCents === '11500' && reconciliation.countedCashCents === '11000' && reconciliation.varianceCents === '-500', 'Exported financial snapshot is incorrect.');
    check(reconciliation.requestId === closeCommand.requestId && reconciliation.notes === `'${closeCommand.notes}`, 'Close audit request or safe notes were lost.');
    check(rows.every((row) => row.nightLabel === `'${openInput.label}`), 'Night label formula was not neutralized.');
    check(!exported.csv.includes(secret) && !exported.csv.includes(pendingSecret) && !exported.csv.includes('tokenHash'), 'Export included invitation credentials.');
    step = 'closed history, new active night and immutable prior export';
    const next = await access.openNight(owner, venue.id, { ...openInput, label: 'Synthetic next night' });
    const history = await reads.listNights(owner, venue.id);
    check(history.some((night) => night.id === nightId && night.status === 'CLOSED') && history.some((night) => night.id === next.night.id && night.status === 'OPEN'), 'Night history did not retain closed and active nights.');
    await access.updatePresets(owner, venue.id, { presets });
    check((await ledger.exportNight(context())).csv === exported.csv, 'Later preset/night changes rewrote the closed export.');
    const freshPool = new pg.Pool({ connectionString: localEnvironment(), max: 1 });
    try { check((await new OwnerReadService(freshPool).listNights(owner, venue.id)).length === 2, 'Night history did not survive a fresh connection.'); } finally { await freshPool.end(); }
    step = 'consistent export and close transaction race';
    const nextContext = { authenticatedUserId: owner, nightId: next.night.id };
    const race = await Promise.all([ledger.exportNight(nextContext), ledger.close(nextContext, { requestId: randomUUID(), countedCashCents: 10000, notes: 'Synthetic race' })]);
    const racingRows = readCsv(race[0].csv);
    const racingClose = racingRows.find((row) => row.recordType === 'reconciliation');
    check(racingRows.filter((row) => row.recordType === 'night').length === 1 && racingRows.every((row) => row.recordType === 'night' || row.recordType === 'reconciliation'), 'Concurrent export lost night metadata or invented events.');
    check(racingRows.find((row) => row.recordType === 'night')?.type === (racingClose ? 'CLOSED' : 'OPEN'), 'Night status and reconciliation came from different transaction snapshots.');
    check(racingRows.length === 1 || (racingRows.length === 2 && racingClose?.expectedCoverCents === '0' && racingClose.expectedDrawerCents === '10000'), 'Concurrent export mixed open and closed snapshots.');
    check(readCsv((await ledger.exportNight(nextContext)).csv).some((row) => row.recordType === 'reconciliation'), 'Committed close snapshot was missing from a later export.');
    console.log('PASS owner read/export PostgreSQL: owner isolation, safe access projections, durable night history, complete original-event audit, price/close snapshots, CSV formula safety and export/close consistency. Synthetic internal service evidence only.');
  } catch (error) {
    throw new VerificationFailure(error instanceof VerificationFailure ? `${step}: ${error.message}` : `${step}: failed; raw diagnostics withheld to protect invite credentials.`);
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
await verify().catch((error: unknown) => { console.error(`FAIL owner read/export verification: ${error instanceof VerificationFailure ? error.message : 'Check disposable local database prerequisites.'}`); process.exitCode = 1; });
