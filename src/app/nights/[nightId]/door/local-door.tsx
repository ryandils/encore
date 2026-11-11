'use client';

import { useEffect, useState } from 'react';
import { DoorConsole } from '../../../../components/door/door-console';
import { createHttpDoorAdapter } from '../../../../features/door/http-adapter';
import { createPendingDoorApi, pendingRequestKey } from '../../../../features/door/pending-request';

type Journal = ReturnType<typeof createPendingDoorApi>;
export function LocalDoor({ nightId, userId }: { nightId: string; userId: string }) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const restored = createPendingDoorApi(createHttpDoorAdapter(), window.sessionStorage, pendingRequestKey(userId, nightId), nightId,
        (pending, failure) => { setHasPending(pending !== null); if (failure) setStorageError(failure); });
      setRecovering(restored.pending() !== null); setHasPending(restored.pending() !== null); setJournal(restored);
    } catch { setStorageError('Local request storage is unavailable or contains an unreadable pending request. Recording is paused; resolve prior requests before clearing storage.'); }
  }, [nightId, userId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (hasPending) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPending]);
  async function retry() {
    if (!journal || retrying) return;
    setRetrying(true); setError(null);
    try {
      const result = await journal.retry();
      if (result.ok) setRecovering(false);
      else setError(`Original outcome remains unknown: ${result.error.message} Keep a physical backup and ask the owner to reconcile; do not record this person again.`);
    } catch { setError('The original outcome is still unknown. Retry the same request when access returns; do not record this person again.'); }
    finally { setRetrying(false); }
  }
  return <main id="main-content">
    <aside style={{ maxWidth: '36rem', margin: 'auto', padding: '1rem 1.25rem', boxSizing: 'border-box', background: '#302b25', color: '#ffe3a1' }} aria-label="Local persisted rehearsal notice">
      <strong>Local persisted rehearsal — synthetic data only</strong>
      <p>Authorized sessions share this local database. Recorded actions survive reload. This is not a production service or a venue pilot.</p>
      <p>Keep a physical backup. A submitted request is retained for refresh recovery in this tab; closing the tab or clearing browser storage can lose it. Do not leave while a save is pending or unknown.</p>
    </aside>
    {storageError ? <section role="alert" style={{ maxWidth: '36rem', margin: 'auto', padding: '1.25rem' }}><h1>Recording paused</h1><p>{storageError}</p></section>
      : !journal ? <p>Checking this tab for an unresolved request…</p>
      : recovering ? <section style={{ maxWidth: '36rem', margin: 'auto', padding: '1.25rem' }} aria-label="Request recovery"><h1>Unresolved saved request</h1>
        <p>This request may already be saved. New actions are blocked until its original acknowledgement is recovered.</p>
        <p style={{ overflowWrap: 'anywhere' }}>Request ID: {journal.pending()?.requestId}</p>
        <button type="button" disabled={retrying} onClick={() => { void retry(); }} style={{ minHeight: 44, padding: '.75rem 1rem' }}>{retrying ? 'Retrying original request…' : 'Retry unresolved action'}</button>
        {error && <p role="alert">{error}</p>}
      </section> : <DoorConsole key={`${userId}:${nightId}`} api={journal.api} nightId={nightId} persisted />}
  </main>;
}
