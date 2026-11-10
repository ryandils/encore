'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function SignInForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        setError(response.status === 429
          ? 'Too many attempts. Wait a moment before trying again.'
          : response.status >= 500 || response.status === 404
            ? 'The local demo is unavailable. Check its setup and try again.'
            : 'Sign-in failed. Check the demo email and local password.');
        return;
      }
      const sessionResponse = await fetch('/api/demo/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!sessionResponse.ok) {
        setError('We could not confirm your demo session. Please try signing in again.');
        return;
      }
      const session: unknown = await sessionResponse.json();
      const role = session && typeof session === 'object' && 'role' in session ? session.role : null;
      if (role !== 'OWNER' && role !== 'STAFF') {
        setError('This account does not have a local demo screen.');
        return;
      }
      router.replace(role === 'OWNER' ? '/demo/owner' : '/demo/staff');
      router.refresh();
    } catch {
      setError('Unable to confirm sign-in. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={signIn} className="space-y-5" aria-busy={busy}>
      <div>
        <label htmlFor="demo-email" className="mb-2 block font-medium">Demo account</label>
        <select id="demo-email" name="email" autoComplete="username" disabled={busy} className="min-h-12 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-base focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60">
          <option value="owner@encore-demo.invalid">Owner — synthetic account</option>
          <option value="staff@encore-demo.invalid">Staff — synthetic account</option>
        </select>
        <p className="mt-2 break-all text-sm leading-relaxed text-slate-400">owner@encore-demo.invalid<br />staff@encore-demo.invalid</p>
      </div>
      <div>
        <label htmlFor="demo-password" className="mb-2 block font-medium">Local demo password</label>
        <input id="demo-password" name="password" type="password" required autoComplete="current-password" disabled={busy} aria-describedby="password-help" className="min-h-12 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-base focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60" />
        <p id="password-help" className="mt-2 text-sm leading-relaxed text-slate-400">Use the password generated for this account in your local setup. Do not enter a real account password.</p>
      </div>
      <p role="alert" className="text-sm leading-relaxed text-rose-300">{error}</p>
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in to demo'}
      </button>
    </form>
  );
}
