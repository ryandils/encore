import { notFound } from 'next/navigation';
import OwnerConsole from '../../../features/owner/owner-console';
import { demoAvailable } from '../../../server/auth-config';

export const dynamic = 'force-dynamic';

/** Isolated synthetic rehearsal; no account, venue data, or live API is exposed. */
export default function OwnerRehearsalPage() {
  if (!demoAvailable()) notFound();
  return <OwnerConsole />;
}
