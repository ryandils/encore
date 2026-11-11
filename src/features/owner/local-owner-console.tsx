'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ApiErrorCode, ApiResult, CloseCommand, CoverPreset, NightView, OwnerNightAccess, OwnerSummary, OwnerVenueConfiguration, PresetSlot, VenueView } from '../../domain/contracts.ts';
import type { OwnerApi } from './http-owner-api';
import { createPendingCloseApi, pendingCloseKey, pendingCloseNightIds } from './pending-close';
import { dollarsToCents } from './money-input';
import styles from './owner-console.module.css';
import local from './local-owner.module.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const text = (form: FormData, name: string) => String(form.get(name) ?? '');
function integer(form: FormData, name: string): number {
  const value = text(form, name);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Enter a whole, nonnegative number.');
  return Number(value);
}
function presets(form: FormData): CoverPreset[] {
  return ([1, 2, 3] as const).map((slot) => ({ slot, label: text(form, `label${slot}`), amountCents: dollarsToCents(text(form, `amount${slot}`)) }));
}
function Field({ label, name, initial = '', type = 'text', maxLength, required = true }: { label: string; name: string; initial?: string | number; type?: string; maxLength?: number; required?: boolean }) {
  return <label className={styles.field}><span>{label}</span><input name={name} type={type} defaultValue={initial} required={required} maxLength={maxLength} inputMode={type === 'email' ? 'email' : undefined} /></label>;
}
function Prices({ values }: { values?: readonly CoverPreset[] }) {
  return <div className={styles.presetGrid}>{([1, 2, 3] as const).map((slot: PresetSlot) => <fieldset key={slot}><legend>Cover {slot}</legend>
    <Field label={`Cover ${slot} label`} name={`label${slot}`} initial={values?.find((p) => p.slot === slot)?.label ?? `Cover ${slot}`} maxLength={80} />
    <Field label={`Cover ${slot} amount USD`} name={`amount${slot}`} initial={((values?.find((p) => p.slot === slot)?.amountCents ?? slot * 500) / 100).toFixed(2)} />
  </fieldset>)}</div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.card} aria-label={title}><div className={styles.sectionHeading}><h2>{title}</h2></div>{children}</section>;
}
function Summary({ value }: { value: OwnerSummary }) {
  const p = value.projection;
  return <>
    <div className={styles.metrics}>{[['Entries', p.entries], ['Exits', p.exits], ['Recorded occupancy', p.occupancy], ['Peak recorded occupancy', p.peakOccupancy]].map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div>
    <dl className={styles.totals}><div><dt>Expected cover</dt><dd>{money(p.expectedCoverCents)}</dd></div><div><dt>Opening float</dt><dd>{money(value.openingFloatCents)}</dd></div><div className={styles.total}><dt>Expected drawer cash</dt><dd>{money(p.expectedDrawerCents)}</dd></div><div><dt>Capacity-equivalent turns</dt><dd>{p.capacityEquivalentTurns === null ? 'Not available (capacity 0)' : p.capacityEquivalentTurns.toFixed(2)}</dd></div></dl>
    <p className={styles.muted}>Recorded admissions determine cover, not occupancy or current prices. Starting occupancy of {value.night.startingOccupancy} adds no cover. Counts are operational estimates.</p>
    {p.atOrAboveCapacity && <p className={styles.notice}>At or above the capacity reference. Follow venue procedures.</p>}
    <h3>Admissions by charged price</h3><ul className={styles.rows}>{p.admissionsByPrice.map((price) => <li key={price.amountCents}><span>{money(price.amountCents)} × {price.count}</span><strong>{money(price.totalCents)}</strong></li>)}</ul>
    <h3>Arrival traffic · 15-minute buckets</h3><p className={styles.muted}>{value.night.timezone}; bucket labels retain timezone offsets.</p><ul className={styles.rows}>{p.arrivalBuckets.map((bucket) => <li key={bucket.startUtc}><span>{bucket.label}</span><strong>{bucket.entries} entries</strong></li>)}</ul>
    {value.reconciliation && <div className={styles.closeResult}><h3>Closed · read only</h3><dl className={styles.totals}><div><dt>Counted cash including float</dt><dd>{money(value.reconciliation.countedCashCents)}</dd></div><div className={styles.total}><dt>Cash variance</dt><dd>{money(value.reconciliation.varianceCents)}</dd></div></dl><p className={styles.muted}>Counted cash minus expected drawer cash. A shortfall does not establish its cause.</p><p className={styles.notes}>{value.reconciliation.notes}</p></div>}
  </>;
}
class OwnerReadError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) { super(message); this.code = code; }
}
function data<T>(result: ApiResult<T>): T { if (!result.ok) throw new OwnerReadError(result.error.code, result.error.message); return result.data; }
type Journal = ReturnType<typeof createPendingCloseApi>;

export function LocalOwnerConsole({ api, userId }: { api: OwnerApi; userId: string }) {
  const [venues, setVenues] = useState<readonly VenueView[]>([]);
  const [nights, setNights] = useState<readonly NightView[]>([]);
  const [venueId, setVenueId] = useState('');
  const [nightId, setNightId] = useState('');
  const [configuration, setConfiguration] = useState<OwnerVenueConfiguration | null>(null);
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [access, setAccess] = useState<OwnerNightAccess | null>(null);
  const [catalogSynced, setCatalogSynced] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading owned venues and nights from the local server…');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [closeDraft, setCloseDraft] = useState<CloseCommand | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [pendingClose, setPendingClose] = useState<CloseCommand | null>(null);
  const [closeRecovery, setCloseRecovery] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const scope = useRef({ venueId: '', nightId: '' });
  const generation = useRef(0);
  const reading = useRef(false);
  const acknowledgeRefresh = useRef(false);
  const busyRef = useRef(false);
  const summaryRef = useRef<OwnerSummary | null>(null);
  const selected = useRef<{ venueId: string; nightId: string } | null>(null);
  const selectionKey = `encore:owner-selection:v1:${encodeURIComponent(userId)}`;

  const choose = useCallback((venue: string, night: string) => {
    if (scope.current.venueId === venue && scope.current.nightId === night) return;
    generation.current++;
    if (scope.current.venueId !== venue) setNights([]);
    const nightChanged = scope.current.nightId !== night;
    scope.current = { venueId: venue, nightId: night }; selected.current = scope.current;
    setVenueId(venue); setNightId(night); setConfiguration(null); setSummary(null); summaryRef.current = null; setAccess(null);
    if (nightChanged) { setJournal(null); setPendingClose(null); setCloseRecovery(false); }
    setCloseDraft(null); setInviteLink(null); setCatalogSynced(null);
    try { window.sessionStorage.setItem(selectionKey, JSON.stringify({ venueId: venue, nightId: night })); }
    catch { setStorageError('Browser storage is unavailable. Recording and closeout are paused; do not clear unresolved requests.'); }
  }, [selectionKey]);
  const acceptSummary = useCallback((value: OwnerSummary) => {
    if (value.night.id !== scope.current.nightId || value.night.venueId !== scope.current.venueId) return;
    const previous = summaryRef.current;
    if (previous && (value.night.version < previous.night.version || (value.night.version === previous.night.version && Date.parse(value.syncedAt) < Date.parse(previous.syncedAt)))) return;
    summaryRef.current = value; setSummary(value);
  }, []);
  const clearDeniedReads = useCallback((error: unknown) => {
    if (!(error instanceof OwnerReadError) || !['UNAUTHENTICATED', 'FORBIDDEN'].includes(error.code)) return;
    setSummary(null); summaryRef.current = null; setConfiguration(null); setAccess(null);
    setInviteLink(null); setCloseDraft(null); setVenues([]); setNights([]); setCatalogSynced(null);
    // Retain the opaque pending request and its journal; access denial cannot resolve its outcome.
  }, []);
  const refresh = useCallback(async (acknowledge = false) => {
    if (acknowledge) acknowledgeRefresh.current = true;
    if (reading.current || busyRef.current) return;
    reading.current = true;
    let relevantGeneration = generation.current;
    try {
      let pendingIds: readonly string[];
      try { pendingIds = pendingCloseNightIds(userId, window.sessionStorage); }
      catch { setStorageError('Unable to inspect closeout request storage. Writes are paused; resolve prior requests before clearing storage.'); return; }
      const pendingNightId = pendingIds.includes(scope.current.nightId) ? scope.current.nightId : pendingIds[0];
      if (pendingNightId && pendingNightId !== scope.current.nightId) {
        choose(selected.current?.nightId === pendingNightId ? selected.current.venueId : '', pendingNightId);
        relevantGeneration = generation.current;
      }
      const started = relevantGeneration;
      const owned = data(await api.listVenues());
      const catalogs = await Promise.all(owned.map(async (venue) => ({ venue, nights: data(await api.listNights(venue.id)) })));
      if (started !== generation.current) return;
      // Unresolved closes take precedence over selection/defaults, including a later night opened elsewhere or lost venue ownership.
      const unresolved = catalogs.flatMap((catalog) => catalog.nights.map((night) => ({ venue: catalog.venue, night }))).find(({ night }) => night.id === pendingNightId);
      if (pendingNightId && !unresolved) {
        choose('', pendingNightId); relevantGeneration = generation.current;
        setVenues(owned); setNights([]); setConfiguration(null); setSummary(null); summaryRef.current = null; setAccess(null);
        setSyncError('The unresolved closeout night is not in your current owned records. Contact its current owner to reconcile; the original request remains retained.');
        return;
      }
      const desired = unresolved ? { venueId: unresolved.venue.id, nightId: unresolved.night.id } : selected.current ?? scope.current;
      const venue = owned.find((value) => value.id === desired.venueId) ?? owned[0];
      const available = catalogs.find((value) => value.venue.id === venue?.id)?.nights ?? [];
      const night = available.find((value) => value.id === desired.nightId) ?? available.find((value) => value.status === 'OPEN') ?? available[0];
      choose(venue?.id ?? '', night?.id ?? '');
      const current = { ...scope.current }; const activeGeneration = generation.current; relevantGeneration = activeGeneration;
      setVenues(owned); setNights(available);
      if (venue) {
        const results = await Promise.all([api.venueConfiguration(venue.id), ...(night ? [api.summary(night.id), api.nightAccess(night.id)] as const : [])]);
        if (activeGeneration !== generation.current || scope.current.venueId !== current.venueId || scope.current.nightId !== current.nightId) return;
        const config = data(results[0] as ApiResult<OwnerVenueConfiguration>);
        setConfiguration(config);
        if (night) { acceptSummary(data(results[1] as ApiResult<OwnerSummary>)); setAccess(data(results[2] as ApiResult<OwnerNightAccess>)); }
      }
      setCatalogSynced(Date.now()); setSyncError(null);
      if (acknowledgeRefresh.current) { acknowledgeRefresh.current = false; setUncertain(false); setInviteLink(null); setMessage('Server records refreshed. Review the recovered venues, nights and access records before submitting another action.'); }
    } catch (error) { if (relevantGeneration === generation.current) { clearDeniedReads(error); setSyncError('Unable to synchronize owner records. Check session/access and local services; mutations are paused.'); } }
    finally { reading.current = false; }
  }, [api, choose, acceptSummary, clearDeniedReads, userId]);
  // Poll authoritative catalogs and summaries; never cache authoritative totals or projections.
  // The original submitted closeout command is journaled separately for safe retries.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(selectionKey);
      if (saved) {
        const value: unknown = JSON.parse(saved);
        if (value && typeof value === 'object' && 'venueId' in value && 'nightId' in value && typeof value.venueId === 'string' && typeof value.nightId === 'string') selected.current = { venueId: value.venueId, nightId: value.nightId };
      }
    } catch { setStorageError('Unable to read browser request storage. Closeout is paused; resolve prior requests before clearing storage.'); }
    void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 3000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus); window.addEventListener('online', focus);
    return () => { generation.current++; window.clearInterval(poll); window.clearInterval(tick); window.removeEventListener('focus', focus); window.removeEventListener('online', focus); };
  }, [refresh, selectionKey]);
  useEffect(() => {
    if (!nightId) return;
    try {
      const current = createPendingCloseApi(api, window.sessionStorage, pendingCloseKey(userId, nightId), nightId,
        (pending, failure) => { if (scope.current.nightId === nightId) { setPendingClose(pending); if (failure) setStorageError(failure); } });
      setJournal(current); setPendingClose(current.pending()); setCloseRecovery(current.pending() !== null);
    } catch { setStorageError('Closeout request storage is unavailable or unreadable. Resolve the original closeout before clearing storage.'); }
  }, [api, nightId, userId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (pendingClose) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [pendingClose]);

  const stale = catalogSynced === null || now - catalogSynced >= 10_000 || (summary !== null && now - Date.parse(summary.syncedAt) >= 10_000);
  const paused = busy || uncertain || pendingClose !== null || storageError !== null || syncError !== null || stale || (nightId !== '' && journal === null);
  const closed = summary?.night.status === 'CLOSED';
  const mutable = !paused && !closed;
  async function mutate<T>(action: () => Promise<ApiResult<T>>, success: (value: T) => void, label: string) {
    if (busyRef.current || paused) return;
    acknowledgeRefresh.current = false;
    generation.current++;
    busyRef.current = true; setBusy(true); setMessage('Saving to the local server…');
    try {
      const result = await action();
      if (!result.ok) { setMessage(`Not saved: ${result.error.message}`); return; }
      success(result.data); setMessage(label);
    } catch { setUncertain(true); setMessage('Outcome unknown. Do not repeat this action. Refresh server data and inspect existing records before creating anything again.'); }
    finally { busyRef.current = false; setBusy(false); void refresh(); }
  }
  function submit(event: FormEvent<HTMLFormElement>, action: (form: FormData, element: HTMLFormElement) => void) {
    event.preventDefault();
    try { action(new FormData(event.currentTarget), event.currentTarget); } catch (error) { setMessage(error instanceof Error ? error.message : 'Check the form values.'); }
  }
  async function close(command?: CloseCommand) {
    if (!journal || busyRef.current || storageError || (!pendingClose && !mutable)) return;
    acknowledgeRefresh.current = false;
    generation.current++;
    busyRef.current = true; setBusy(true); setCloseDraft(null); setMessage('Saving closeout to the local server…');
    try {
      const result = command ? await journal.api.closeNight(nightId, command) : await journal.retry();
      if (result.ok) { acceptSummary(result.data.summary); setPendingClose(journal.pending()); setCloseRecovery(false); setMessage('Closeout saved to the local server. This night is read only.'); }
      else { setCloseRecovery(journal.pending() !== null); setMessage(journal.pending() ? `Original closeout remains unresolved: ${result.error.message} Do not submit another closeout.` : `Closeout not saved: ${result.error.message}`); }
    } catch { setMessage('Closeout outcome unknown. Retry the original request below; do not enter another closeout.'); setPendingClose(journal.pending()); setCloseRecovery(journal.pending() !== null); }
    finally { busyRef.current = false; setBusy(false); void refresh(); }
  }
  async function download() {
    if (!nightId || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const exported = data(await api.exportNight(nightId));
      const url = URL.createObjectURL(new Blob([exported.csv], { type: exported.contentType }));
      const link = document.createElement('a'); link.href = url; link.download = exported.filename; link.click(); URL.revokeObjectURL(url);
      setMessage('Protected night CSV downloaded from the local server.');
    } catch (error) { clearDeniedReads(error); setMessage('CSV unavailable. Check owner access and local services.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <main id="main-content" className={`${styles.console} ${local.workspace}`}>
    <header className={styles.header}><a href="/">encore<span>.</span></a><span className={styles.badge}>Local owner workspace</span></header>
    <div className={styles.hero}><p className={styles.eyebrow}>Persisted rehearsal</p><h1>Local owner workspace</h1></div>
    <aside className={styles.notice}><strong>Synthetic local data only — not production or a venue pilot.</strong><p>Records come from the authorized local database. Browser storage retains selected IDs and the original submitted closeout command, never authoritative totals or invitation tokens. Keep a physical backup.</p><p>Closing the tab or clearing storage may lose an unresolved request. Resolve unknown outcomes before leaving.</p></aside>
    <div className={styles.feedback} role="status"><p>{message}</p><p>Last server sync: {catalogSynced === null ? 'never' : new Date(catalogSynced).toLocaleTimeString('en-US')} · {stale || syncError ? 'Stale / synchronization unavailable' : 'Synchronized with local server'}</p>{(syncError || storageError) && <p className={styles.error} role="alert">{storageError ?? syncError}</p>}</div>
    <button type="button" disabled={busy} onClick={() => { void refresh(true); }}>Refresh server data</button>
    <Section title="Venues and nights"><div className={styles.twoColumns}>
      <label className={styles.field}><span>Venue</span><select aria-label="Venue" value={venueId} disabled={busy || pendingClose !== null || storageError !== null} onChange={(event) => { choose(event.target.value, ''); void refresh(); }}>{venues.length === 0 && <option value="">No owned venues</option>}{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <label className={styles.field}><span>Night</span><select aria-label="Night" value={nightId} disabled={busy || pendingClose !== null || storageError !== null} onChange={(event) => { choose(venueId, event.target.value); void refresh(); }}>{nights.length === 0 && <option value="">No nights yet</option>}{nights.map((night) => <option key={night.id} value={night.id}>{night.label} · {night.status}</option>)}</select></label>
    </div>{venueId && <p className={styles.summaryMeta}>Venue ID: {venueId}</p>}{nightId && <p className={styles.summaryMeta}>Night ID: {nightId} · <a href={`/nights/${nightId}/door`}>Open this night’s door console</a></p>}</Section>
    {pendingClose && closeRecovery && <Section title="Unresolved closeout request"><p>This original request may already be saved. New mutations and selection changes are blocked until its acknowledgement is recovered. If access was removed, contact the current owner to reconcile; do not clear or replace this request.</p><p className={styles.summaryMeta}>Request ID: {pendingClose.requestId}</p><button type="button" disabled={busy || !!storageError} onClick={() => { void close(); }}>Retry original closeout</button></Section>}
    <Section title="Create venue"><form onSubmit={(event) => submit(event, (form, element) => { const command = { name: text(form, 'name'), timezone: text(form, 'timezone'), capacity: integer(form, 'capacity'), presets: presets(form) }; void mutate(() => api.createVenue(command), (value) => { choose(value.id, ''); element.reset(); }, 'Venue saved. Refreshing its server configuration.'); })}>
      <fieldset disabled={paused}><Field label="Venue name" name="name" maxLength={200} /><div className={styles.twoColumns}><Field label="Timezone" name="timezone" initial="America/New_York" /><Field label="Capacity" name="capacity" initial="100" /></div><Prices /><button type="submit" className={styles.primary}>Create venue</button></fieldset>
    </form></Section>
    {venueId && <Section title="Open night"><form onSubmit={(event) => submit(event, (form) => { const command = { label: text(form, 'label'), startingOccupancy: integer(form, 'starting'), openingFloatCents: dollarsToCents(text(form, 'float')), currency: 'USD' as const }; void mutate(() => api.openNight(venueId, command), (value) => { choose(venueId, value.night.id); acceptSummary(value); }, 'Night saved. Refreshing authoritative server records.'); })}>
      <fieldset disabled={paused || nights.some((night) => night.status === 'OPEN')}><Field label="Night label" name="label" maxLength={200} /><div className={styles.twoColumns}><Field label="Starting occupancy" name="starting" initial="0" /><Field label="Opening float USD" name="float" initial="0.00" /></div><button type="submit" className={styles.primary}>Open night</button></fieldset>
      {nights.some((night) => night.status === 'OPEN') && <p className={styles.muted}>Close the existing open night before opening another.</p>}
    </form></Section>}
    {configuration && <Section title="Cover prices"><form key={`${venueId}:${configuration.presets.map((p) => `${p.label}:${p.amountCents}`).join('|')}`} onSubmit={(event) => submit(event, (form) => { const command = { presets: presets(form) }; void mutate(() => api.updatePresets(venueId, command), (value) => setConfiguration({ ...configuration, presets: value }), 'Cover prices saved. Earlier charged amounts remain unchanged.'); })}>
      <fieldset disabled={!mutable}><Prices values={configuration.presets} /><button type="submit">Save cover prices</button></fieldset>
    </form></Section>}
    {summary && <Section title="Night summary"><Summary value={summary} /><button type="button" disabled={busy} onClick={() => { void download(); }}>Download night CSV</button></Section>}
    {nightId && <Section title="Staff access"><form onSubmit={(event) => submit(event, (form, element) => { void mutate(() => api.createInvite(nightId, { intendedEmail: text(form, 'email') }), (value) => { setInviteLink(value.inviteUrl); element.reset(); }, 'Invitation created. Copy its link now; it is not stored or sent by Encore.'); })}>
      <fieldset disabled={!mutable}><Field label="Staff email" name="email" type="email" maxLength={254} /><button type="submit">Create staff invite</button></fieldset>
    </form>{inviteLink && <div><label className={styles.field}><span>Invitation link — shown once</span><input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label><button type="button" onClick={() => setInviteLink(null)}>Hide invitation link</button></div>}
      <h3>Invitations from server</h3>{access?.invites.map((invite) => <div key={invite.id} className={styles.invite}><p>{invite.intendedEmail}</p><p>{invite.revokedAt ? 'Canceled' : invite.consumedAt ? 'Accepted' : Date.parse(invite.expiresAt) <= now ? 'Expired' : 'Pending'}</p><button type="button" disabled={!mutable || !!invite.revokedAt || !!invite.consumedAt} onClick={() => { void mutate(() => api.revokeInvite(nightId, invite.id), () => {}, 'Invitation canceled on the server.'); }}>Cancel invite for {invite.intendedEmail}</button></div>)}
      <h3>Night assignments from server</h3>{access?.assignments.map((assignment) => <div key={assignment.userId} className={styles.invite}><p>{assignment.email}</p><p>{assignment.revokedAt ? 'Access revoked' : Date.parse(assignment.endsAt) <= now ? 'Assignment expired' : 'Assigned'}</p><button type="button" disabled={!mutable || !!assignment.revokedAt} onClick={() => { void mutate(() => api.revokeAssignment(nightId, assignment.userId), () => {}, 'Assignment revoked on the server.'); }}>Revoke access for {assignment.email}</button></div>)}
    </Section>}
    {summary && !closed && <Section title="Cash closeout"><p>Count drawer cash including the opening float. Variance compares cash to recorded admissions; it does not establish a cause.</p><form onSubmit={(event) => submit(event, (form) => setCloseDraft({ requestId: crypto.randomUUID(), countedCashCents: dollarsToCents(text(form, 'counted')), notes: text(form, 'notes') }))}>
      <fieldset disabled={!mutable}><Field label="Counted cash including float USD" name="counted" /><label className={styles.field}><span>Closing notes</span><textarea name="notes" maxLength={2000} /></label><button type="submit">Review closeout</button></fieldset>
    </form>{closeDraft && <div className={styles.confirmation}><h3>Close this night?</h3><p>Counted cash including float: {money(closeDraft.countedCashCents)}. Closing stops new entries, exits and corrections. The reconciliation cannot be overwritten.</p><button type="button" disabled={!mutable} className={styles.primary} onClick={() => { void close(closeDraft); }}>Confirm closeout</button><button type="button" disabled={busy} onClick={() => setCloseDraft(null)}>Keep night open</button></div>}</Section>}
    <footer className={styles.footer}>History, access and money shown here come from the server. No production verification, recovery email or real two-device pilot is claimed.</footer>
  </main>;
}
