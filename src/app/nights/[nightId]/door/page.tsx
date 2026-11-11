import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '../../../../server/auth';
import { demoAvailable } from '../../../../server/auth-config';
import { assertUuid } from '../../../../domain/validation';
import { LocalDoor } from './local-door';

export const dynamic = 'force-dynamic';

export default async function LocalDoorPage({ params }: { params: Promise<{ nightId: string }> }) {
  if (!demoAvailable()) notFound();
  const { nightId } = await params;
  try { assertUuid(nightId, 'nightId'); } catch { notFound(); }
  let session: Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>;
  try { session = await getAuth().api.getSession({ headers: new Headers(await headers()) }); }
  catch { return <main id="main-content"><h1>Local door unavailable</h1><p>Check local authentication and database setup, then retry. Keep a physical backup.</p></main>; }
  if (!session) redirect('/demo/sign-in');
  // Session identity opens the shell; every API request independently checks venue/night access.
  return <LocalDoor key={`${session.user.id}:${nightId}`} nightId={nightId} userId={session.user.id} />;
}
