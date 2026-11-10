import { ProtectedDemo } from '../protected-demo';

export const dynamic = 'force-dynamic';

export default function StaffDemoPage() {
  return <ProtectedDemo demoRole="STAFF" />;
}
