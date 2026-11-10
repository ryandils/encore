'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { CloseCommand, CoverPreset, PresetSlot } from '../../domain/contracts';
import {
  acceptFixtureInvite, closeFixtureNight, configureVenue, createFixtureInvite,
  createOwnerFixture, dollarsToCents, exportFixtureNight, openFixtureNight,
  recordFixtureEvent, revokeFixtureAssignment, updateFixturePresets,
} from './fixture-model';
import type { OwnerFixtureNight, OwnerFixtureState } from './fixture-model';
import styles from './owner-console.module.css';

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

function PresetFields({ presets }: { presets: readonly CoverPreset[] }) {
  return <div className={styles.presetGrid}>{presets.map((preset) => <fieldset key={preset.slot}>
    <legend>Preset {preset.slot}</legend>
    <Field label={`Preset ${preset.slot} label`} name={`label${preset.slot}`} initial={preset.label} maxLength={80} />
    <Field label={`Preset ${preset.slot} amount (USD)`} name={`amount${preset.slot}`} initial={(preset.amountCents / 100).toFixed(2)} type="number" step="0.01" min="0" />
  </fieldset>)}</div>;
}

function readPresets(form: FormData): CoverPreset[] {
  return ([1, 2, 3] as const).map((slot) => ({ slot, label: value(form, `label${slot}`), amountCents: dollarsToCents(value(form, `amount${slot}`)) }));
}

function Section({ title, children, id, eyebrow }: { title: string; children: ReactNode; id?: string; eyebrow?: string }) {
  return <section className={styles.card} id={id}><div className={styles.sectionHeading}>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h2>{title}</h2></div>{children}</section>;
}

function Summary({ night }: { night: OwnerFixtureNight }) {
  const { summary } = night;
  const projection = summary.projection;
  const metrics = [
    ['Entries', projection.entries], ['Exits', projection.exits],
    ['Recorded occupancy', projection.occupancy], ['Peak recorded occupancy', projection.peakOccupancy],
  ];
  return <>
    <div className={styles.metrics}>{metrics.map(([label, amount]) => <div key={label}><span>{label}</span><strong>{amount}</strong></div>)}</div>
    {projection.atOrAboveCapacity && <p className={styles.notice}>At or above the capacity reference. This recorded count is an estimate, not a safety certification.</p>}
    <dl className={styles.totals}>
      <div><dt>Expected cover</dt><dd>{money(projection.expectedCoverCents)}</dd></div>
      <div><dt>Opening float</dt><dd>{money(summary.openingFloatCents)}</dd></div>
      <div className={styles.total}><dt>Expected drawer cash</dt><dd>{money(projection.expectedDrawerCents)}</dd></div>
      <div><dt>Capacity-equivalent turns</dt><dd>{projection.capacityEquivalentTurns === null ? 'Not available (capacity 0)' : projection.capacityEquivalentTurns.toFixed(2)}</dd></div>
    </dl>
    <p className={styles.muted}>Expected cover comes from recorded admissions, not occupancy or today’s presets. Starting occupancy of {summary.night.startingOccupancy} contributes no cover. Entries are visits, not unique guests.</p>
    <h3>Admissions by charged price</h3>
    {projection.admissionsByPrice.length === 0 ? <p className={styles.muted}>No admissions recorded in this rehearsal yet.</p> : <ul className={styles.rows}>{projection.admissionsByPrice.map((price) => <li key={price.amountCents}><span>{money(price.amountCents)} × {price.count}</span><strong>{money(price.totalCents)}</strong></li>)}</ul>}
    <h3>Arrival traffic · 15-minute buckets</h3>
    <p className={styles.muted}>{summary.night.timezone}; labels retain timezone offsets.</p>
    {projection.arrivalBuckets.length === 0 ? <p className={styles.muted}>Arrival traffic appears after the first admission.</p> : <ul className={styles.rows}>{projection.arrivalBuckets.map((bucket) => <li key={bucket.startUtc}><span>{bucket.label}</span><strong>{bucket.entries} entries</strong></li>)}</ul>}
    {summary.reconciliation && <div className={styles.closeResult}>
      <p className={styles.eyebrow}>Closed · read only</p><h3>Cash reconciliation</h3>
      <dl className={styles.totals}>
        <div><dt>Counted cash including float</dt><dd>{money(summary.reconciliation.countedCashCents)}</dd></div>
        <div className={styles.total}><dt>Cash variance</dt><dd>{money(summary.reconciliation.varianceCents)}</dd></div>
      </dl>
      <p className={styles.muted}>Counted cash minus expected drawer cash. A negative variance is a shortfall against recorded transactions; it does not establish a cause.</p>
      <p className={styles.notes}>{summary.reconciliation.notes || 'No closing notes.'}</p>
      <p className={styles.muted}>Closed {when(summary.reconciliation.closedAt, summary.night.timezone)}. New writes are blocked for this night.</p>
    </div>}
  </>;
}

export default function OwnerConsole() {
  const [state, setState] = useState(createOwnerFixture);
  const [message, setMessage] = useState('Ready to rehearse. No changes have been sent to a server.');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<CloseCommand | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
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
    return run((current) => change(current, form), feedback);
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

  return <div className={styles.console}>
    <header className={styles.header}><a href="/" aria-label="Encore home">encore<span>.</span></a><span className={styles.badge}>Owner rehearsal</span></header>
    <main>
      <div className={styles.hero}><p className={styles.eyebrow}>A clear picture of your night</p><h1>From first entry<br />to final count.</h1><p>Set up a synthetic venue, rehearse a shift, and see how recorded cover becomes a cash closeout.</p></div>
      <aside className={styles.notice}><strong>Synthetic demo only — no live backend or venue access.</strong><p>Changes exist only in this page’s memory. Refresh clears everything. Nothing is saved, shared with another device, or sent to staff. Use fake details only.</p></aside>
      <nav className={styles.nav} aria-label="Owner sections"><a href="#setup">Setup</a><a href="#summary">Summary</a><a href="#access">Staff access</a><a href="#closeout">Closeout</a><a href="#history">History</a></nav>
      <div className={styles.feedback}><p role="status">{message}</p>{error && <p role="alert" className={styles.error}>{error}</p>}</div>

      <Section id="setup" title={state.venue ? state.venue.name : 'Set up your venue'} eyebrow="01 · Prepare">
        {!state.venue ? <form onSubmit={(event) => formAction(event, (current, form) => configureVenue(current, {
          name: value(form, 'venueName'), timezone: value(form, 'timezone'), capacity: integer(form, 'capacity'), presets: readPresets(form),
        }), 'Synthetic venue configured in this page only. Open a night to continue.')}>
          <Field label="Venue name (synthetic)" name="venueName" initial="Synthetic Encore Venue" maxLength={200} />
          <div className={styles.twoColumns}><Field label="IANA timezone" name="timezone" initial="America/New_York" /><Field label="Capacity reference" name="capacity" initial={100} type="number" step="1" min="0" /></div>
          <PresetFields presets={state.presets} /><button type="submit" className={styles.primary}>Create demo venue</button>
        </form> : <>
          <p className={styles.muted}>{state.venue.timezone} · capacity reference {state.venue.capacity} · USD</p>
          {!isOpen && <details open={!active}><summary>Open a demo night</summary><form onSubmit={(event) => {
            if (formAction(event, (current, form) => openFixtureNight(current, { label: value(form, 'nightName'), startingOccupancy: integer(form, 'startingOccupancy'), openingFloatCents: dollarsToCents(value(form, 'float')), currency: 'USD' }), 'Demo night opened locally. No live door is connected.')) { setHistoryId(null); setConfirmation(null); }
          }}>
            <Field label="Night name / date label" name="nightName" initial="Synthetic Friday" maxLength={200} />
            <div className={styles.twoColumns}><Field label="Starting occupancy" name="startingOccupancy" initial={0} type="number" step="1" min="0" /><Field label="Opening float (USD)" name="float" initial="100.00" type="number" step="0.01" min="0" /></div>
            <p className={styles.muted}>Opening time is captured when you open the night. Starting occupancy adds no cover revenue.</p><button type="submit" className={styles.primary}>Open demo night</button>
          </form></details>}
          {isOpen && <details><summary>Edit cover presets</summary><form onSubmit={(event) => formAction(event, (current, form) => updateFixturePresets(current, { presets: readPresets(form) }), 'Presets updated locally. Earlier admissions keep their original charged price.')}><PresetFields presets={state.presets} /><p className={styles.muted}>Price changes apply to future admissions only.</p><button type="submit">Save demo presets</button></form></details>}
        </>}
      </Section>

      {isOpen && <Section title="Rehearse door activity" eyebrow="Fixture controls · this page only">
        <p className={styles.muted}>Current night: <strong>{active?.summary.night.label}</strong>.</p>
        <p className={styles.muted}>For the MVP scenario: admit four at $10, record one exit, change preset 2 to $15, then admit one at that new price. These controls simulate staff events; they are not the shared door console.</p>
        <div className={styles.actions}>{state.presets.map((preset) => <button key={preset.slot} type="button" disabled={confirmation !== null} onClick={() => run((current) => recordFixtureEvent(current, 'ADMISSION', preset.slot as PresetSlot), `One synthetic admission recorded locally at ${money(preset.amountCents)}.`)}><span>{preset.label}</span><strong>Admit {money(preset.amountCents)}</strong></button>)}</div>
        <div className={styles.twoColumns}><button type="button" disabled={confirmation !== null} onClick={() => run((current) => recordFixtureEvent(current, 'ADMISSION'), 'One free synthetic admission recorded locally.')}>Free entry · $0</button><button type="button" disabled={confirmation !== null} onClick={() => run((current) => recordFixtureEvent(current, 'EXIT'), 'One synthetic exit recorded locally. Cover is unchanged.')}>Record exit</button></div>
        <p className={styles.muted}>Exit changes occupancy only; it never refunds cover.</p>
      </Section>}

      <Section id="summary" title={selected ? selected.summary.night.label : 'Your night at a glance'} eyebrow="02 · Summary">
        {selected ? <><div className={styles.summaryMeta}><span className={styles.badge}>{selected.summary.night.status === 'OPEN' ? 'Open · local fixture' : 'Closed · read only'}</span><p>Opened {when(selected.summary.night.openedAt, selected.summary.night.timezone)}</p></div><Summary night={selected} /></> : <p className={styles.muted}>Open a demo night to see recorded traffic and cash totals.</p>}
        {historyId && <button type="button" onClick={() => setHistoryId(null)}>Return to current night</button>}
      </Section>

      <Section id="access" title="Staff access" eyebrow="03 · Invite & revoke">
        {active && <p className={styles.muted}>Current night: <strong>{active.summary.night.label}</strong>.</p>}
        <p className={styles.muted}>Synthetic invitations only. Use a reserved .invalid email address. No email is sent and no real account receives access.</p>
        {isOpen ? <form onSubmit={(event) => formAction(event, (current, form) => createFixtureInvite(current, { intendedEmail: value(form, 'email') }), 'Synthetic invite created locally. Its example link cannot grant real access.')}><Field label="Synthetic staff email" name="email" initial="staff@encore-fixture.invalid" type="email" maxLength={254} /><button type="submit">Create demo invite</button></form> : <p className={styles.muted}>Open a night to rehearse invitations and access changes.</p>}
        {state.invites.filter((invite) => invite.nightId === active?.summary.night.id).map((invite) => <div className={styles.invite} key={invite.id}>
          <strong>{invite.intendedEmail}</strong><p className={styles.muted}>{invite.revokedAt ? 'Revoked' : invite.consumedAt ? 'Accepted in this simulation' : 'Pending synthetic invitation'} · expires {when(invite.expiresAt, state.venue?.timezone ?? 'UTC')}</p>
          {!invite.consumedAt && !invite.revokedAt && <><label className={styles.field}><span>Inert example invite link — select to copy</span><input readOnly value={invite.inviteUrl} onFocus={(event) => event.currentTarget.select()} /></label><button type="button" disabled={!isOpen} onClick={() => run((current) => acceptFixtureInvite(current, invite.id), 'Synthetic invitation accepted locally. No real permissions were granted.')}>Simulate invite acceptance</button><button type="button" disabled={!isOpen} onClick={() => { if (window.confirm('Revoke this synthetic invitation? It will no longer be accepted in this rehearsal.')) run((current) => revokeFixtureAssignment(current, invite.userId), 'Synthetic invitation revoked locally.'); }}>Revoke demo invite</button></>}
        </div>)}
        {state.assignments.filter((assignment) => assignment.nightId === active?.summary.night.id).map((assignment) => <div className={styles.invite} key={assignment.userId}><strong>{state.invites.find((invite) => invite.userId === assignment.userId)?.intendedEmail ?? assignment.userId}</strong><p className={styles.muted}>Simulated assignment</p><p className={styles.muted}>{assignment.revokedAt ? 'Access revoked in this fixture' : 'Active in this fixture only'}</p>{!assignment.revokedAt && <button type="button" disabled={!isOpen} onClick={() => {
          if (window.confirm('Revoke this synthetic staff assignment? This affects only the local rehearsal.')) run((current) => revokeFixtureAssignment(current, assignment.userId), 'Synthetic staff assignment revoked locally.');
        }}>Revoke demo access for {state.invites.find((invite) => invite.userId === assignment.userId)?.intendedEmail ?? assignment.userId}</button>}</div>)}
      </Section>

      <Section id="closeout" title="Count, compare, close" eyebrow="04 · Cash closeout">
        {isOpen && active ? <>
          <p className={styles.muted}>Closing current night: <strong>{active.summary.night.label}</strong>.</p>
          <p className={styles.muted}>Count the dedicated door cash pool including its opening float. Expected drawer: <strong>{money(active.summary.projection.expectedDrawerCents)}</strong>.</p>
          {!confirmation ? <form onSubmit={requestClose}><Field label="Counted cash including float (USD)" name="counted" initial="150.00" type="number" step="0.01" min="0" /><label className={styles.field}><span>Closing notes (synthetic)</span><textarea name="notes" maxLength={2000} rows={3} placeholder="Record observations without assuming a cause." /></label><button type="submit" className={styles.primary}>Review closeout</button></form> : <fieldset className={styles.confirmation} aria-label="Confirm closeout"><h3>Close this demo night?</h3><p>Counted cash: <strong>{money(confirmation.countedCashCents)}</strong></p><p>Cash variance: <strong>{money(confirmation.countedCashCents - active.summary.projection.expectedDrawerCents)}</strong></p><p>Closing stops new writes. This night becomes read-only and cannot be reopened. The snapshot remains only until this page is refreshed.</p><div className={styles.twoColumns}><button type="button" className={styles.primary} onClick={() => {
            if (run((current) => closeFixtureNight(current, confirmation), 'Demo night closed locally. Its summary and export are read-only; refresh still clears the rehearsal.')) { setConfirmation(null); setHistoryId(null); }
          }}>Confirm close night</button><button type="button" onClick={() => setConfirmation(null)}>Keep night open</button></div></fieldset>}
        </> : <p className={styles.muted}>{active ? 'This night is closed. Review its reconciliation above or open another demo night.' : 'Open a demo night before counting cash.'}</p>}
      </Section>

      <Section id="history" title="Closed nights" eyebrow="05 · History & export">
        <p className={styles.muted}>Read-only snapshots from this rehearsal. Refresh clears this history. CSV contains synthetic event actors, times, charged amounts and reconciliation.</p>
        {state.history.length === 0 ? <p className={styles.empty}>Your closed nights will appear here.</p> : state.history.map((night) => <div className={styles.historyItem} key={night.summary.night.id}><div><strong>{night.summary.night.label}</strong><p className={styles.muted}>{money(night.summary.projection.expectedCoverCents)} expected cover · {night.summary.projection.entries} entries</p></div><div className={styles.twoColumns}><button type="button" onClick={() => { setHistoryId(night.summary.night.id); document.getElementById('summary')?.scrollIntoView({ behavior: 'smooth' }); }}>View closed summary</button><button type="button" onClick={() => download(night)}>Download CSV</button></div></div>)}
      </Section>
      <footer className={styles.footer}>Built for rehearsal. Live persistence, shared devices and server-enforced access are future backend work.</footer>
    </main>
  </div>;
}
