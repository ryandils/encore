import { notFound } from 'next/navigation';
import { demoAvailable } from '../../../server/auth-config';
import { OwnerPhonePreview } from './phone-preview';

export const dynamic = 'force-dynamic';

export default function OwnerMobilePage() {
  if (!demoAvailable()) notFound();
  return <OwnerPhonePreview />;
}