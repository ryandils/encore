'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        setError('Sign-out was not confirmed. Try again before leaving this device.');
        return;
      }
      router.replace('/demo/sign-in');
      router.refresh();
    } catch {
      setError('Sign-out was not confirmed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7">
      <button type="button" onClick={signOut} disabled={busy} className="min-h-12 w-full rounded-lg border border-slate-500 px-5 py-3 font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60">{busy ? 'Signing out…' : 'Sign out'}</button>
      <p role="alert" className="mt-3 text-sm leading-relaxed text-rose-300">{error}</p>
    </div>
  );
}
