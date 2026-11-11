import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '../../../server/auth';
import { demoAvailable } from '../../../server/auth-config';
import { OwnerWorkspace } from './owner-workspace';

export const dynamic = 'force-dynamic';
export default async function LocalOwnerPage() {
  if (!demoAvailable()) notFound();
  let session: Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>;
  try { session = await getAuth().api.getSession({ headers: new Headers(await headers()) }); }
  catch { return <main id="main-content"><h1>Local owner workspace unavailable</h1><p>Check local authentication and database setup, then retry. Keep a physical backup.</p></main>; }
  if (!session) redirect('/demo/sign-in');
  return <OwnerWorkspace key={session.user.id} userId={session.user.id} />;
}
