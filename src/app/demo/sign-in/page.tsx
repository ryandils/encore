import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { demoAvailable, getDemoSession } from '../../../server/demo-session';
import { DemoShell, DemoUnavailable } from '../demo-shell';
import { SignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  if (!demoAvailable()) notFound();
  let session: Awaited<ReturnType<typeof getDemoSession>>;
  try {
    session = await getDemoSession(new Headers(await headers()));
  } catch {
    return <DemoUnavailable />;
  }
  if (session) redirect(session.role === 'OWNER' ? '/demo/owner' : '/demo/staff');
  return (
    <DemoShell title="Try the sign-in demo">
      <p className="mb-7 leading-relaxed text-slate-300">Choose a fake owner or staff account to try signing in and out. No real venue is connected.</p>
      <SignInForm />
    </DemoShell>
  );
}
