'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'sign-in' | 'verify' | 'reset';
const inputClass = 'min-h-12 w-full min-w-0 rounded-lg border border-slate-500 bg-slate-950 px-3 py-3 text-base focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60';
const buttonClass = 'min-h-12 w-full rounded-lg bg-amber-300 px-4 py-3 font-semibold text-slate-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60';

async function post(path: string, body: Record<string, unknown>) {
  return fetch(`/api/local-auth/${path}`, {
    method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
}
function verifiedSession(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('user' in value)) return false;
  const user = value.user;
  return Boolean(user && typeof user === 'object' && 'emailVerified' in user && user.emailVerified === true);
}

export function AccountForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [finished, setFinished] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (mode === 'sign-in') {
      setReady(true);
      let active = true;
      void fetch('/api/local-auth/get-session', { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(15000) })
        .then(async (response) => { if (response.ok && active) setSignedIn(verifiedSession(await response.json())); })
        .catch(() => {});
      return () => { active = false; };
    }
    function captureLink() {
      const fragment = window.location.hash.slice(1);
      try {
        window.history.replaceState(null, '', window.location.pathname);
        if (fragment) {
          if (inFlight.current) {
            setError('A request is still pending. Open the new link again after it finishes.');
            return;
          }
          setFinished(false); setNotice(''); setError(''); setToken(null);
          const parameters = new URLSearchParams(fragment);
          const value = parameters.get('token');
          if (parameters.size !== 1 || !value || !/^[A-Za-z0-9._-]{16,4096}$/.test(value)) {
            setError('This link is missing or malformed. Request a fresh link below.');
          } else setToken(value);
        }
        setReady(true);
      } catch {
        setReady(false);
        setError('This link could not be removed safely from the address bar. Open it in a supported browser.');
      }
    }
    captureLink();
    window.addEventListener('hashchange', captureLink);
    return () => window.removeEventListener('hashchange', captureLink);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !ready || finished) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (mode === 'reset' && token && password !== form.get('confirm-password')) {
      setError('The passwords do not match. Enter them again.');
      return;
    }
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const path = mode === 'sign-in' ? 'sign-in/email' : mode === 'verify'
        ? token ? 'verify-email' : 'send-verification-email'
        : token ? 'reset-password' : 'request-password-reset';
      const body = mode === 'sign-in' ? { email, password } : token
        ? mode === 'verify' ? { token } : { token, newPassword: password }
        : { email };
      const response = await post(path, body);
      if (!response.ok) {
        setError(response.status === 429 ? 'Too many attempts. Wait a moment before trying again.'
          : response.status >= 500 || response.status === 404 ? 'Local account access is unavailable. Check local setup and try again.'
            : mode === 'sign-in' ? 'Sign-in failed. Check your email and password, or request a verification link.'
              : token ? 'This link could not be used. It may be expired or already used. Request a fresh link below.'
                : 'The request could not be accepted. Check the test email and try again.');
        return;
      }
      if (mode === 'sign-in') {
        const session = await fetch('/api/local-auth/get-session', { credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!session.ok || !verifiedSession(await session.json())) {
          setError('Your verified session could not be confirmed. Please try signing in again.');
          return;
        }
        router.replace('/local/owner'); router.refresh();
      } else if (token) {
        setToken(null); setFinished(true);
        setNotice(mode === 'verify' ? 'Email verified. You can now sign in.' : 'Password replaced. Sign in with your new password.');
      } else {
        setNotice('If this account is eligible, a link has been captured locally. No email was sent. Use the latest captured link.');
      }
    } catch {
      setError(mode === 'sign-in' ? 'Sign-in could not be confirmed. Check your connection and try again.'
        : token ? 'The result could not be confirmed. The link may have been used. Try signing in, or request a fresh link.'
          : 'The request could not be confirmed. Check your connection before requesting another link.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await post('sign-out', {});
      if (!response.ok) throw new Error('Sign-out unconfirmed');
      setSignedIn(false); setNotice('Signed out of this local account.'); router.refresh();
    } catch { setError('Sign-out could not be confirmed. Check your connection and try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="space-y-5">
    {signedIn && <div className="space-y-3 rounded-xl border border-emerald-700 p-4">
      <p>You have a verified local account session.</p>
      <a href="/local/owner" className="inline-flex min-h-12 items-center py-3 text-amber-200 underline">Open owner workspace</a>
      <button type="button" onClick={() => { void signOut(); }} disabled={busy} className={buttonClass}>Sign out</button>
    </div>}
    {!finished && <form method="post" onSubmit={submit} className="space-y-5" aria-busy={busy}>
      {!token && <div>
        <label htmlFor="account-email" className="mb-2 block font-medium">Email</label>
        <input id="account-email" name="email" type="email" required maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy || !ready} className={inputClass} />
      </div>}
      {(mode === 'sign-in' || mode === 'reset' && token) && <div>
        <label htmlFor="account-password" className="mb-2 block font-medium">{mode === 'reset' ? 'New password' : 'Password'}</label>
        <input id="account-password" name="password" type="password" required minLength={mode === 'reset' ? 8 : undefined} maxLength={128} autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} disabled={busy || !ready} className={inputClass} />
      </div>}
      {mode === 'reset' && token && <div>
        <label htmlFor="confirm-password" className="mb-2 block font-medium">Confirm password</label>
        <input id="confirm-password" name="confirm-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy || !ready} className={inputClass} />
      </div>}
      {token && <p className="text-sm leading-relaxed text-slate-300">The link was removed from the address bar. Confirm below to use it. Reloading this page loses the link; it is not saved in browser storage.</p>}
      <button type="submit" disabled={busy || !ready} className={buttonClass}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'verify' ? token ? 'Verify email' : 'Request verification link' : token ? 'Replace password' : 'Request recovery link'}</button>
    </form>}
    {token && <a href={mode === 'verify' ? '/local/account/verify' : '/local/account/reset'} className="inline-flex min-h-12 items-center py-3 text-amber-200 underline">Request a fresh link</a>}
    {notice && <p role="status" className="rounded-lg border border-emerald-700 p-4 leading-relaxed text-emerald-200">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-700 p-4 leading-relaxed text-rose-200">{error}</p>}
  </section>;
}
