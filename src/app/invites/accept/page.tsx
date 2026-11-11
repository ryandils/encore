import { notFound } from 'next/navigation';
import { demoAvailable } from '../../../server/auth-config';
import { AcceptInvite } from './accept-invite';

export const dynamic = 'force-dynamic';

export default function AcceptInvitePage() {
  // Fragments never reach this server. Do not redirect unauthenticated visitors and lose them.
  if (!demoAvailable()) notFound();
  return <AcceptInvite />;
}
