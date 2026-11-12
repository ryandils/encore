import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getProtectedLocalSession } from '../../../server/local-session';
import { demoAvailable } from '../../../server/auth-config';
import { OwnerWorkspace } from './owner-workspace';

export const dynamic = 'force-dynamic';
export default async function LocalOwnerPage() {
  if (!demoAvailable()) notFound();
  let session: Awaited<ReturnType<typeof getProtectedLocalSession>>;
  try { session = await getProtectedLocalSession(new Headers(await headers())); }
  catch { return <main id="main-content"><h1>Local owner workspace unavailable</h1><p>Check local authentication and database setup, then retry. Keep a physical backup.</p></main>; }
  if (!session) redirect('/local/account');
  return <OwnerWorkspace key={session.user.id} userId={session.user.id} />;
}
