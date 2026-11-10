import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { demoAvailable, getDemoSession } from '../../server/demo-session';
import { DemoShell, DemoUnavailable } from './demo-shell';
import { SignOutButton } from './sign-out-button';

export async function ProtectedDemo({ demoRole }: { demoRole: 'OWNER' | 'STAFF' }) {
  if (!demoAvailable()) notFound();
  let session: Awaited<ReturnType<typeof getDemoSession>>;
  try {
    session = await getDemoSession(new Headers(await headers()));
  } catch {
    return <DemoUnavailable />;
  }
  if (!session) redirect('/demo/sign-in');
  if (session.role !== demoRole) redirect(session.role === 'OWNER' ? '/demo/owner' : '/demo/staff');
  return (
    <DemoShell title={demoRole === 'OWNER' ? 'Owner demo' : 'Staff demo'}>
      <p className="leading-relaxed text-slate-300">You are signed in with a synthetic {demoRole === 'OWNER' ? 'owner' : 'staff'} account.</p>
      <section aria-labelledby="session-title" className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
        <h2 id="session-title" className="text-lg font-semibold">Your demo session</h2>
        <p className="mt-3 font-medium">{session.user.name}</p>
        <p className="mt-1 break-all text-sm text-slate-300">{session.user.email}</p>
        <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-relaxed text-slate-400">This account has no access to real venues or nights. Door recording, venue permissions, and cash closeout are still to come.</p>
      </section>
      <SignOutButton />
    </DemoShell>
  );
}
