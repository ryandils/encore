'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { CloseCommand, CoverPreset, PresetSlot } from '../../domain/contracts';
import {
  acceptFixtureInvite, closeFixtureNight, configureVenue, createFixtureInvite,
  createOwnerFixture, dollarsToCents, exportFixtureNight, openFixtureNight,
  recordFixtureEvent, revokeFixtureAssignment, updateFixturePresets,
} from './fixture-model';
import type { OwnerFixtureNight, OwnerFixtureState } from './fixture-model';
import styles from './owner-console.module.css';
import { OwnerTonight } from './owner-tonight';
import { OwnerDoorControls } from './owner-door-controls';
import phone from './owner-phone.module.css';
import { createSampleOwnerNight } from './sample-owner-night';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const value = (form: FormData, name: string) => String(form.get(name) ?? '');
const integer = (form: FormData, name: string) => {
  const input = value(form, name);
  if (!/^\d+$/.test(input)) throw new Error('Enter a whole, nonnegative number.');
  return Number(input);
};
const when = (timestamp: string, timezone: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: timezone, dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(timestamp));

function Field({ label, name, initial, type = 'text', required = true, step, min, maxLength }: {
  label: string; name: string; initial?: string | number; type?: string; required?: boolean; step?: string; min?: string; maxLength?: number;
}) {
  return <label className={styles.field}><span>{label}</span><input name={name} type={type} defaultValue={initial} required={required} step={step} min={min} maxLength={maxLength} /></label>;
}

function PresetFields({ presets, count, onAdd }: { presets: readonly CoverPreset[]; count: number; onAdd: () => void }) {
  const fields = useRef<HTMLDivElement>(null);
  const focusAddedPrice = useRef(false);
  useEffect(() => {
    if (!focusAddedPrice.current) return;
    fields.current?.querySelector<HTMLInputElement>(`input[name="label${count}"]`)?.focus();
    focusAddedPrice.current = false;
  }, [count]);
  return <div ref={fields} className={`${styles.presetGrid} ${phone.presetGrid}`}>{presets.map((preset) => <fieldset key={preset.slot} hidden={preset.slot > count}>
    <legend>Entry price {preset.slot}</legend>
    <Field label={`Name for price ${preset.slot}`} name={`label${preset.slot}`} initial={preset.label} maxLength={80} />
    <Field label={`Price ${preset.slot} ($)`} name={`amount${preset.slot}`} initial={(preset.amountCents / 100).toFixed(2)} type="number" step="0.01" min="0" />
  </fieldset>)}{count < 3 && <button type="button" onClick={() => { focusAddedPrice.current = true; onAdd(); }} aria-label="Add another entry price"><span aria-hidden="true">+</span> Add price</button>}<p role="status" className={styles.muted}>{count} of 3 entry prices</p></div>;
}

function readPresets(form: FormData): CoverPreset[] {
  return ([1, 2, 3] as const).map((slot) => ({ slot, label: value(form, `label${slot}`), amountCents: dollarsToCents(value(form, `amount${slot}`)) }));
}

function Section({ title, children, id, eyebrow, hidden }: { title: string; children: ReactNode; id: string; eyebrow?: string; hidden: boolean }) {
  return <section className={styles.card} id={id} hidden={hidden} tabIndex={-1} aria-labelledby={`${id}-title`}><div className={styles.sectionHeading}>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h2 id={`${id}-title`}>{title}</h2></div>{children}</section>;
}

function Summary({ night }: { night: OwnerFixtureNight }) {
  const { summary } = night;
  const projection = summary.projection;
  const metrics = [
    ['Entries', projection.entries], ['Exits', projection.exits],
    ['People inside (recorded)', projection.occupancy], ['Most inside at once', projection.peakOccupancy],
  ];
  return <>
    <div className={`${styles.metrics} ${phone.metrics}`}>{metrics.map(([label, amount]) => <div key={label}><span>{label}</span><strong>{amount}</strong></div>)}</div>
    {projection.atOrAboveCapacity && <p className={styles.notice}>At or above the capacity reference. This recorded count is an estimate, not a safety certification.</p>}
    <dl className={styles.totals}>
      <div><dt>Door money recorded</dt><dd>{money(projection.expectedCoverCents)}</dd></div>
      <div><dt>Starting cash</dt><dd>{money(summary.openingFloatCents)}</dd></div>
      <div className={styles.total}><dt>Cash to expect in the drawer</dt><dd>{money(projection.expectedDrawerCents)}</dd></div>
      <div><dt>Capacity-equivalent turns</dt><dd>{projection.capacityEquivalentTurns === null ? 'Not available (capacity 0)' : projection.capacityEquivalentTurns.toFixed(2)}</dd></div>
    </dl>
    <p className={styles.muted}>Door money recorded comes from recorded admissions, not occupancy or today’s presets. The {summary.night.startingOccupancy} people already inside add no door money. Entries are visits, not unique guests.</p>
    <h3>Admissions by charged price</h3>
    {projection.admissionsByPrice.length === 0 ? <p className={styles.muted}>No admissions recorded in this rehearsal yet.</p> : <ul className={styles.rows}>{projection.admissionsByPrice.map((price) => <li key={price.amountCents}><span>{money(price.amountCents)} × {price.count}</span><strong>{money(price.totalCents)}</strong></li>)}</ul>}
    <h3>Arrival traffic · 15-minute buckets</h3>
    <p className={styles.muted}>{summary.night.timezone}; labels retain timezone offsets.</p>
    {projection.arrivalBuckets.length === 0 ? <p className={styles.muted}>Arrival traffic appears after the first admission.</p> : <ul className={styles.rows}>{projection.arrivalBuckets.map((bucket) => <li key={bucket.startUtc}><span>{bucket.label}</span><strong>{bucket.entries} entries</strong></li>)}</ul>}
    {summary.reconciliation && <div className={styles.closeResult}>
      <p className={styles.eyebrow}>Closed · read only</p><h3>Final cash check</h3>
      <dl className={styles.totals}>
        <div><dt>Cash counted, including starting cash</dt><dd>{money(summary.reconciliation.countedCashCents)}</dd></div>
        <div className={styles.total}><dt>Cash difference</dt><dd>{money(summary.reconciliation.varianceCents)}</dd></div>
      </dl>
      <p className={styles.muted}>Cash counted minus the cash expected. A minus sign means less cash was counted. Review the difference before drawing conclusions.</p>
      <p className={styles.notes}>{summary.reconciliation.notes || 'No closing notes.'}</p>
      <p className={styles.muted}>Closed {when(summary.reconciliation.closedAt, summary.night.timezone)}. New writes are blocked for this night.</p>
    </div>}
  </>;
}

export default function OwnerConsole() {
  const [state, setState] = useState(createOwnerFixture);
  const [message, setMessage] = useState('');
  const [priceCount, setPriceCount] = useState(1);
  const [draftPriceCount, setDraftPriceCount] = useState(1);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<CloseCommand | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [section, setSection] = useState('#tonight');
  useEffect(() => {
    const update = () => setSection(['#tonight', '#setup', '#access', '#closeout', '#history', '#summary', '#activity'].includes(window.location.hash) ? window.location.hash : '#tonight');
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    const target = document.getElementById(section.slice(1));
    target?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [section]);
  const active = state.active;
  const isOpen = active?.summary.night.status === 'OPEN';
  const selected = historyId ? state.history.find((night) => night.summary.night.id === historyId) : active;

  function run(change: (current: OwnerFixtureState) => OwnerFixtureState, feedback: string) {
    try {
      const next = change(state);
      setState(next); setError(''); setMessage(feedback);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This demo action could not be completed.');
      return false;
    }
  }

  function formAction(event: FormEvent<HTMLFormElement>, change: (current: OwnerFixtureState, form: FormData) => OwnerFixtureState, feedback: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = run((current) => change(current, form), feedback);
    if (saved && form.has('amount1')) setPriceCount(draftPriceCount);
    return saved;
  }

  function download(night: OwnerFixtureNight) {
    try {
      const exported = exportFixtureNight(night);
      const url = URL.createObjectURL(new Blob([exported.csv], { type: exported.contentType }));
      const link = document.createElement('a'); link.href = url; link.download = exported.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(''); setMessage('Synthetic CSV prepared from this night’s recorded events and closeout.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'CSV could not be prepared.'); }
  }

  function requestClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const notes = value(form, 'notes');
      if (notes.length > 2000) throw new Error('Closing notes must be 2000 characters or fewer.');
      setConfirmation({ requestId: crypto.randomUUID(), countedCashCents: dollarsToCents(value(form, 'counted')), notes });
      setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Check the closeout fields.'); }
  }

  return <div className={`${styles.console} ${phone.phone}`}>
    <header className={styles.header}><a href="/" aria-label="Encore home">encore<span>.</span></a><span className={styles.badge}>Practice · resets on refresh</span></header>
    <main>
      <div hidden={section !== '#tonight'}><OwnerTonight state={state} onReviewCurrentNight={() => setHistoryId(null)} onLoadSample={() => {
        setPriceCount(3); setDraftPriceCount(3);
        run(() => createSampleOwnerNight(), 'Sample night loaded: five admissions, one exit and $55 expected cover. Nothing was sent to a server.');
      }}><OwnerDoorControls state={state} presets={state.presets.filter((preset) => preset.slot <= priceCount)} blocked={confirmation !== null} onRecord={(type, slot) => {
        if (confirmation) return;
        run((current) => recordFixtureEvent(current, type, slot), type === 'EXIT' ? 'One person exited. Door money is unchanged.' : 'One entry recorded at the selected price.');
      }} /></OwnerTonight></div>
      <nav className={phone.nav} aria-label="Owner sections">{[['#tonight', 'Tonight'], ['#setup', 'My bar'], ['#access', 'Staff'], ['#closeout', 'Finish'], ['#history', 'Past nights']].map(([href, label]) => <a key={href} href={href} aria-current={(href === section || (section === '#activity' && href === '#tonight') || (section === '#summary' && href === (historyId ? '#history' : '#tonight'))) ? 'location' : undefined}>{label}</a>)}</nav>
      <div className={styles.feedback} hidden={!message && !error}><p role="status">{message}</p>{error && <p role="alert" className={styles.error}>{error}</p>}</div>

      <Section hidden={section !== '#setup'} id="setup" title={state.venue ? state.venue.name : 'Set up your bar'} eyebrow="01 · Prepare">
        {!state.venue ? <form onSubmit={(event) => formAction(event, (current, form) => configureVenue(current, {
          name: value(form, 'venueName'), timezone: value(form, 'timezone'), capacity: integer(form, 'capacity'), presets: readPresets(form),
        }), 'Synthetic venue configured in this page only. Open a night to continue.')}>
          <Field label="Bar name" name="venueName" initial="Synthetic Encore Venue" maxLength={200} />
          <div className={`${styles.twoColumns} ${phone.twoColumns}`}><Field label="Time zone" name="timezone" initial="America/New_York" /><Field label="Room capacity" name="capacity" initial={100} type="number" step="1" min="0" /></div>
          <PresetFields presets={state.presets} count={draftPriceCount} onAdd={() => setDraftPriceCount((count) => Math.min(3, count + 1))} /><button type="submit" className={styles.primary}>Save my sample bar</button>
        </form> : <>
          <p className={styles.muted}>{state.venue.timezone} · capacity reference {state.venue.capacity} · USD</p>
          {!isOpen && <details open={!active}><summary>Start a sample night</summary><form onSubmit={(event) => {
            if (formAction(event, (current, form) => openFixtureNight(current, { label: value(form, 'nightName'), startingOccupancy: integer(form, 'startingOccupancy'), openingFloatCents: dollarsToCents(value(form, 'float')), currency: 'USD' }), 'Demo night opened locally. No live door is connected.')) { setHistoryId(null); setConfirmation(null); window.location.hash = '#tonight'; }
          }}>
            <Field label="Name for tonight" name="nightName" initial="Synthetic Friday" maxLength={200} />
            <div className={`${styles.twoColumns} ${phone.twoColumns}`}><Field label="People already inside" name="startingOccupancy" initial={0} type="number" step="1" min="0" /><Field label="Cash in the drawer before opening ($)" name="float" initial="100.00" type="number" step="0.01" min="0" /></div>
            <p className={styles.muted}>We record the time when you start. People already inside do not add any door money.</p><button type="submit" className={styles.primary}>Start sample night</button>
          </form></details>}
          {isOpen && <details><summary>Change entry prices</summary><form onSubmit={(event) => formAction(event, (current, form) => updateFixturePresets(current, { presets: readPresets(form) }), 'Presets updated locally. Earlier admissions keep their original charged price.')}><PresetFields presets={state.presets} count={draftPriceCount} onAdd={() => setDraftPriceCount((count) => Math.min(3, count + 1))} /><p className={styles.muted}>Price changes apply to future admissions only.</p><button type="submit">Save sample prices</button></form></details>}
        </>}
      </Section>

      {!isOpen && <Section hidden={section !== '#activity'} id="activity" title="Entries and exits"><p>Start a sample night before adding entries or exits.</p><a href="#setup">Go to My bar</a></Section>}
      {isOpen && <Section hidden={section !== '#activity'} id="activity" title="Try entries and exits" eyebrow="Fixture controls · this page only">
        <p className={styles.muted}>Current night: <strong>{active?.summary.night.label}</strong>.</p>
        <p className={styles.muted}>For the MVP scenario: admit four at $10, record one exit, change preset 2 to $15, then admit one at that new price. These controls simulate staff events; they are not the shared door console.</p>
        <div className={`${styles.actions} ${phone.actions}`}>{state.presets.filter((preset) => preset.slot <= priceCount).map((preset) => <button key={preset.slot} type="button" disabled={confirmation !== null} onClick={() => run((current) => recordFixtureEvent(current, 'ADMISSION', preset.slot as PresetSlot), `One synthetic admission recorded locally at ${money(preset.amountCents)}.`)}><span>{preset.label}</span><strong>Admit {money(preset.amountCents)}</strong></button>)}</div>
        <div className={`${styles.twoColumns} ${phone.twoColumns}`}><button type="button" disabled={confirmation !== null} onClick={() => run((current) => recordFixtureEvent(current, 'ADMISSION'), 'One free synthetic admission recorded locally.')}>Free entry · $0</button><button type="button" disabled={confirmation !== null} onClick={() => run((current) => recordFixtureEvent(current, 'EXIT'), 'One synthetic exit recorded locally. Cover is unchanged.')}>Record exit</button></div>
        <p className={styles.muted}>Exit changes occupancy only; it never refunds cover.</p>
      </Section>}

      <Section hidden={section !== '#summary'} id="summary" title={selected ? selected.summary.night.label : 'Your night at a glance'} eyebrow="02 · Summary">
        {selected ? <><div className={styles.summaryMeta}><span className={styles.badge}>{selected.summary.night.status === 'OPEN' ? 'Open · local fixture' : 'Closed · read only'}</span><p>Opened {when(selected.summary.night.openedAt, selected.summary.night.timezone)}</p></div><Summary night={selected} /></> : <p className={styles.muted}>Start a sample night to see recorded traffic and cash totals.</p>}
        {historyId && <button type="button" onClick={() => setHistoryId(null)}>Return to current night</button>}
      </Section>

      <Section hidden={section !== '#access'} id="access" title="Door staff" eyebrow="03 · Invite & revoke">
        {active && <p className={styles.muted}>Current night: <strong>{active.summary.night.label}</strong>.</p>}
        <p className={styles.muted}>Practice invitations do not send email or give anyone real access. Keep the sample email below, or use another address ending in .invalid.</p>
        {isOpen ? <form onSubmit={(event) => formAction(event, (current, form) => createFixtureInvite(current, { intendedEmail: value(form, 'email') }), 'Synthetic invite created locally. Its example link cannot grant real access.')}><Field label="Staff email" name="email" initial="staff@encore-fixture.invalid" type="email" maxLength={254} /><button type="submit">Make a sample invitation</button></form> : <p className={styles.muted}>Open a night to rehearse invitations and access changes.</p>}
        {state.invites.filter((invite) => invite.nightId === active?.summary.night.id).map((invite) => <div className={styles.invite} key={invite.id}>
          <strong>{invite.intendedEmail}</strong><p className={styles.muted}>{invite.revokedAt ? 'Revoked' : invite.consumedAt ? 'Accepted in this simulation' : 'Pending synthetic invitation'} · expires {when(invite.expiresAt, state.venue?.timezone ?? 'UTC')}</p>
          {!invite.consumedAt && !invite.revokedAt && <><label className={styles.field}><span>Inert example invite link — select to copy</span><input readOnly value={invite.inviteUrl} onFocus={(event) => event.currentTarget.select()} /></label><button type="button" disabled={!isOpen} onClick={() => run((current) => acceptFixtureInvite(current, invite.id), 'Synthetic invitation accepted locally. No real permissions were granted.')}>Try accepting this invitation</button><button type="button" disabled={!isOpen} onClick={() => { if (window.confirm('Revoke this synthetic invitation? It will no longer be accepted in this rehearsal.')) run((current) => revokeFixtureAssignment(current, invite.userId), 'Synthetic invitation revoked locally.'); }}>Cancel invitation</button></>}
        </div>)}
        {state.assignments.filter((assignment) => assignment.nightId === active?.summary.night.id).map((assignment) => <div className={styles.invite} key={assignment.userId}><strong>{state.invites.find((invite) => invite.userId === assignment.userId)?.intendedEmail ?? assignment.userId}</strong><p className={styles.muted}>Simulated assignment</p><p className={styles.muted}>{assignment.revokedAt ? 'Access revoked in this fixture' : 'Active in this fixture only'}</p>{!assignment.revokedAt && <button type="button" disabled={!isOpen} onClick={() => {
          if (window.confirm('Revoke this synthetic staff assignment? This affects only the local rehearsal.')) run((current) => revokeFixtureAssignment(current, assignment.userId), 'Synthetic staff assignment revoked locally.');
        }}>Remove access for {state.invites.find((invite) => invite.userId === assignment.userId)?.intendedEmail ?? assignment.userId}</button>}</div>)}
      </Section>

      <Section hidden={section !== '#closeout'} id="closeout" title="Count cash and finish" eyebrow="04 · Cash closeout">
        {isOpen && active ? <>
          <p className={styles.muted}>Closing current night: <strong>{active.summary.night.label}</strong>.</p>
          <p className={styles.muted}>Count only the door cash, including the money you started with. Cash to expect: <strong>{money(active.summary.projection.expectedDrawerCents)}</strong>.</p>
          {!confirmation ? <form onSubmit={requestClose}><Field label="Cash you counted, including starting cash ($)" name="counted" initial="150.00" type="number" step="0.01" min="0" /><label className={styles.field}><span>Notes for this sample night</span><textarea name="notes" maxLength={2000} rows={3} placeholder="Record observations without assuming a cause." /></label><button type="submit" className={styles.primary}>Check my cash count</button></form> : <fieldset className={styles.confirmation} aria-label="Confirm closeout"><h3>Close this demo night?</h3><p>Counted cash: <strong>{money(confirmation.countedCashCents)}</strong></p><p>Cash difference: <strong>{money(confirmation.countedCashCents - active.summary.projection.expectedDrawerCents)}</strong></p><p>Closing stops new writes. This night becomes read-only and cannot be reopened. The snapshot remains only until this page is refreshed.</p><div className={`${styles.twoColumns} ${phone.twoColumns}`}><button type="button" className={styles.primary} onClick={() => {
            if (run((current) => closeFixtureNight(current, confirmation), 'Demo night closed locally. Its summary and export are read-only; refresh still clears the rehearsal.')) { setConfirmation(null); setHistoryId(null); window.location.hash = '#summary'; }
          }}>Yes, finish this sample night</button><button type="button" onClick={() => setConfirmation(null)}>Go back - keep night open</button></div></fieldset>}
        </> : <p className={styles.muted}>{active ? 'This night is closed. Use Tonight to view final totals, or My bar to start another sample night.' : 'Start a sample night before counting cash.'}</p>}
      </Section>

      <Section hidden={section !== '#history'} id="history" title="Past nights" eyebrow="05 · History & export">
        <p className={styles.muted}>Read-only snapshots from this rehearsal. Refresh clears this history. CSV contains synthetic event actors, times, charged amounts and reconciliation.</p>
        {state.history.length === 0 ? <p className={styles.empty}>Your closed nights will appear here.</p> : state.history.map((night) => <div className={styles.historyItem} key={night.summary.night.id}><div><strong>{night.summary.night.label}</strong><p className={styles.muted}>{money(night.summary.projection.expectedCoverCents)} expected cover · {night.summary.projection.entries} entries</p></div><div className={`${styles.twoColumns} ${phone.twoColumns}`}><button type="button" onClick={() => { setHistoryId(night.summary.night.id); window.location.hash = '#summary'; }}>View final totals</button><button type="button" onClick={() => download(night)}>Download spreadsheet (.csv)</button></div></div>)}
      </Section>
      <footer className={styles.footer}>Built for rehearsal. This fixture does not use the separate persisted owner workspace or grant real venue access.</footer>
    </main>
  </div>;
}
