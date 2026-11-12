import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getProtectedLocalSession } from '../../../../server/local-session';
import { demoAvailable } from '../../../../server/auth-config';
import { assertUuid } from '../../../../domain/validation';
import { LocalDoor } from './local-door';

export const dynamic = 'force-dynamic';

export default async function LocalDoorPage({ params }: { params: Promise<{ nightId: string }> }) {
  if (!demoAvailable()) notFound();
  const { nightId } = await params;
  try { assertUuid(nightId, 'nightId'); } catch { notFound(); }
  let session: Awaited<ReturnType<typeof getProtectedLocalSession>>;
  try { session = await getProtectedLocalSession(new Headers(await headers())); }
  catch { return <main id="main-content"><h1>Local door unavailable</h1><p>Check local authentication and database setup, then retry. Keep a physical backup.</p></main>; }
  if (!session) redirect('/local/account');
  // Session identity opens the shell; every API request independently checks venue/night access.
  return <LocalDoor key={`${session.user.id}:${nightId}`} nightId={nightId} userId={session.user.id} />;
}
