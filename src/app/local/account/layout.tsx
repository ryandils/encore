import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { demoAvailable } from '../../../server/auth-config';

export const dynamic = 'force-dynamic';
export default function LocalAccountLayout({ children }: { children: ReactNode }) {
  if (!demoAvailable()) notFound();
  return <main id="main-content" className="mx-auto max-w-md space-y-6 px-4 py-8">
    <p className="text-sm font-semibold uppercase tracking-wide text-amber-200">Synthetic local accounts</p>
    <p className="rounded-xl border border-amber-700 bg-amber-950 p-4 leading-relaxed text-amber-100">Use an existing test account and a test password. This rehearsal captures links locally; it sends no real email. Account registration is not available.</p>
    {children}
    <nav aria-label="Local account" className="flex flex-col gap-1 border-t border-slate-700 pt-4">
      <a href="/local/account" className="inline-flex min-h-12 items-center py-3 text-amber-200 underline">Sign in</a>
      <a href="/local/account/verify" className="inline-flex min-h-12 items-center py-3 text-amber-200 underline">Request verification link</a>
      <a href="/local/account/reset" className="inline-flex min-h-12 items-center py-3 text-amber-200 underline">Forgot password?</a>
      <a href="/demo/sign-in" className="inline-flex min-h-12 items-center py-3 text-slate-300 underline">Separate sign-in demo</a>
    </nav>
  </main>;
}
