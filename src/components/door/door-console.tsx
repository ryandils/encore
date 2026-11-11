'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RecentDoorAction } from '../../domain/contracts.ts';
import { DoorController } from './controller';
import type { DoorApi } from './controller';
import styles from './door.module.css';

export function money(cents: number): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100); }
function actionLabel(action: RecentDoorAction) { return action.type === 'EXIT' ? 'Exit' : action.type === 'REVERSAL' ? 'Undo recorded' : action.amountCents === 0 ? 'Free entry' : `Paid entry · ${money(action.amountCents)}`; }

export function DoorConsole({ api, nightId, persisted = false }: { api: DoorApi; nightId: string; persisted?: boolean }) {
  const [controller] = useState(() => new DoorController(api, nightId, Date.now, () => crypto.randomUUID(), persisted ? 'saved to the local server.' : 'saved in this demo.'));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [undo, setUndo] = useState<RecentDoorAction | null>(null);
  const [reason, setReason] = useState('Accidental tap');
  useEffect(() => {
    void controller.refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void controller.refresh(); }, 3000);
    const tick = window.setInterval(controller.tick, 1000);
    const refresh = () => { if (document.visibilityState === 'visible') void controller.refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(poll); window.clearInterval(tick); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [controller]);
  const state = snapshot.state;
  const stale = snapshot.lastSync === null || snapshot.now - snapshot.lastSync >= 10000;
  const disabled = !controller.canSubmit();
  const canUndo = (action: RecentDoorAction) => state?.recentActions.some(current => current.id === action.id && current.canUndo && !current.reversed) && snapshot.now - Date.parse(action.recordedAt) <= 60000 && !disabled && snapshot.queue.length === 0;
  return <section className={styles.console} aria-label="Door console">
    <header className={styles.heading}><div><p className={styles.eyebrow}>ENCORE / DOOR</p><h1>Keep the door moving.</h1></div><span className={styles.badge}>{state?.night.status === 'CLOSED' ? 'Night closed' : persisted ? 'Local night' : 'Practice night'}</span></header>
    <section className={styles.countPanel} aria-labelledby="occupancy-label">
      <p id="occupancy-label">Recorded occupancy</p><p className={styles.count} data-testid="occupancy">{state ? state.occupancy : '—'}</p>
      <p>{state?.night.label ?? (persisted ? 'Connecting to the local night' : 'Connecting to the synthetic fixture')}</p>
      <p className={styles.muted}>Acknowledged actions only · capacity reference {state?.night.capacity ?? '—'}</p>
      {state?.atOrAboveCapacity && <p className={styles.warning}>At or above the capacity reference. Follow venue procedures.</p>}
      {stale && <p className={styles.warning}>Stale count — not a current headcount.</p>}
    </section>
    <div className={styles.sync} aria-live="polite"><strong>{snapshot.syncError ? 'Disconnected / sync failed' : stale ? 'Awaiting synchronization' : persisted ? 'Local night synchronized' : 'Fixture synchronized'}</strong><span>Last sync: {snapshot.lastSync === null ? 'never' : new Date(snapshot.lastSync).toLocaleTimeString('en-US')}</span></div>
    {snapshot.syncError && <p className={styles.warning} role="alert">{snapshot.syncError}</p>}
    <div className={styles.feedback} role="status"><p>{snapshot.message}</p>{snapshot.queue.length > 0 && <p>{snapshot.queue.length} pending {snapshot.queue.length === 1 ? 'action' : 'actions'} · excluded from acknowledged count until saved</p>}</div>
    {(snapshot.phase === 'unknown' || snapshot.phase === 'failed') && <div className={styles.recovery}><button type="button" onClick={controller.retry}>Retry same request</button>{snapshot.phase === 'failed' && <button type="button" onClick={controller.discardRejected}>Cancel rejected and unsent taps</button>}<p>Pause admissions in this screen. Keep a physical backup; do not tap again for the same person.</p></div>}
    {state?.night.status === 'CLOSED' && <p className={styles.warning}>This night is closed. New entries, exits, and undo are disabled.</p>}
    <section aria-label="Entry and exit controls"><h2>Admit one person</h2><div className={styles.prices}>{state?.presets.map(preset => <button className={styles.price} type="button" key={preset.slot} disabled={disabled} onClick={() => controller.submit({ type: 'ADMISSION', presetSlot: preset.slot, expectedAmountCents: preset.amountCents }, `${money(preset.amountCents)} entry`)}><strong>{money(preset.amountCents)}</strong><span>Paid entry</span><small>{preset.label}</small></button>)}</div><div className={styles.secondary}><button type="button" disabled={disabled} onClick={() => controller.submit({ type: 'FREE_ADMISSION' }, 'Free entry')}>Free entry <span>$0 · comp or re-entry</span></button><button type="button" disabled={disabled} onClick={() => controller.submit({ type: 'EXIT' }, 'Exit')}>Exit <span>No cover refund</span></button></div><p className={styles.muted}>One tap per person. Quick intentional taps are saved in order.</p></section>
    {snapshot.queue.length > 0 && <section aria-label="Pending actions"><h2>Pending actions</h2><ol className={styles.actions}>{snapshot.queue.map((action, index) => <li key={action.command.requestId}><span>{action.label}</span><small>{index === 0 ? snapshot.phase === 'unknown' ? 'Outcome unknown' : snapshot.phase === 'failed' ? 'Rejected' : 'Saving…' : 'Waiting to send'}</small></li>)}</ol></section>}
    <section aria-label="Recent actions"><h2>Recent actions</h2><p className={styles.muted}>Undo your latest eligible action within 60 seconds.</p>{!state?.recentActions.length && <p>No recorded actions yet.</p>}<ol className={styles.actions}>{[...(state?.recentActions ?? [])].sort((a, b) => b.sequence - a.sequence).map(action => <li key={action.id}><div><strong>{actionLabel(action)}</strong><small>{new Date(action.recordedAt).toLocaleTimeString('en-US')}{action.reversed ? ' · reversed' : ''}</small></div>{canUndo(action) && <button type="button" onClick={() => { setUndo(action); setReason('Accidental tap'); }}>Undo</button>}</li>)}</ol></section>
    {undo && <section className={styles.confirm} aria-label="Confirm undo"><h2>Undo {actionLabel(undo).toLowerCase()}?</h2><p>The original stays in the history. This records a correction, not a cash refund.</p><label htmlFor="undo-reason">Reason</label><input id="undo-reason" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /><div className={styles.secondary}><button type="button" disabled={!canUndo(undo) || !reason.trim()} onClick={() => { controller.submit({ type: 'REVERSAL', targetEventId: undo.id, reason: reason.trim() }, 'Undo'); setUndo(null); }}>Confirm undo</button><button type="button" onClick={() => setUndo(null)}>Keep action</button></div></section>}
    <button className={styles.refresh} type="button" onClick={() => { void controller.refresh(); }}>Refresh door state</button>
    <p className={styles.muted}>Recorded counts are an operational estimate. Continue ordinary ID checks and physical re-entry procedures.</p>
  </section>;
}
