'use client';

import { useEffect, useRef, useState } from 'react';
import type { AssignmentView } from '../../../domain/contracts';
import { createHttpOwnerApi } from '../../../features/owner/http-owner-api';

/** The secret is captured once, scrubbed immediately, and held only in this mounted page's memory. */
export function AcceptInvite() {
  const captured = useRef(false);
  const inFlight = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState('');
  const [assignment, setAssignment] = useState<AssignmentView | null>(null);
  useEffect(() => {
    // React Strict Mode replays effects; it must not replace the captured token with an empty fragment.
    if (captured.current) return;
    captured.current = true;
    const fragment = window.location.hash.slice(1);
    try {
      window.history.replaceState(null, '', window.location.pathname);
      const parameters = new URLSearchParams(fragment);
      const value = parameters.get('token');
      if (parameters.size !== 1 || !value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
        setError('This invitation link is missing or malformed. Ask the owner for a new invitation.');
        return;
      }
      setToken(value);
    } catch {
      setError('The invitation could not be safely removed from the address bar. Open it in a supported browser.');
    }
  }, []);

  async function accept() {
    if (!token || inFlight.current || assignment) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await createHttpOwnerApi().acceptInvite({ token });
      if (!result.ok) {
        setError(unknown
          ? 'The original acceptance outcome is still unknown. Ask the owner to check the night’s staff access before issuing another invitation.'
          : result.error.code === 'UNAUTHENTICATED'
            ? 'Sign in to the intended account in another tab, then return here and accept.'
            : 'This invitation is unavailable for this account. It may be expired, revoked, already used, or require the intended verified email. Ask the owner to check staff access.');
        return;
      }
      setAssignment(result.data); setToken(null); setUnknown(false);
    } catch {
      setUnknown(true);
      setError('Acceptance outcome is unknown. It may have saved. Retry this same invitation or ask the owner to check staff access; do not assume a new invitation is needed.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <main id="main-content" className="mx-auto max-w-xl space-y-6 px-4 py-10">
    <p className="text-sm font-semibold uppercase tracking-wide text-amber-200">Local database rehearsal</p>
    <h1 className="text-3xl font-semibold">Accept staff invitation</h1>
    <p className="leading-relaxed text-slate-300">Use the account matching the invitation’s intended email. The server requires verified email ownership and an available invitation; opening this page alone does not grant access.</p>
    <p className="rounded-xl border border-amber-700 bg-amber-950 p-4 leading-relaxed text-amber-100">This local build has no real-user email verification or password recovery configured. Synthetic test evidence is not real email verification. No message is sent from this page.</p>
    {!assignment && <>
      <a href="/demo/sign-in" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-lg border border-slate-500 px-4 py-3 font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Sign in in another tab</a>
      <p className="text-sm leading-relaxed text-slate-400">Keep this tab open while signing in. The link secret is removed from the address bar and is not saved in browser storage. Reloading or closing this tab loses it; reopen the original invitation if needed.</p>
      <button type="button" onClick={() => { void accept(); }} disabled={!token || busy} aria-busy={busy} className="min-h-12 w-full rounded-lg bg-amber-300 px-4 py-3 font-semibold text-slate-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50">{busy ? 'Checking invitation…' : unknown ? 'Retry same invitation' : 'Accept invitation'}</button>
    </>}
    {error && <p role="alert" className="rounded-lg border border-red-700 bg-red-950 p-4 leading-relaxed text-red-100">{error}</p>}
    {assignment && <section aria-live="polite" className="space-y-4 rounded-xl border border-emerald-700 p-4">
      <h2 className="text-xl font-semibold">Staff access confirmed</h2>
      <p className="leading-relaxed text-slate-300">The server has assigned this account to the night. Access still depends on the assignment’s end time and any later owner revocation.</p>
      <a href={`/nights/${assignment.nightId}/door`} className="inline-flex min-h-12 items-center rounded-lg bg-amber-300 px-4 py-3 font-semibold text-slate-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Open assigned door</a>
    </section>}
    <a href="/local/owner" className="inline-flex min-h-12 items-center px-1 py-3 text-amber-200 underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Owner workspace</a>
  </main>;
}
