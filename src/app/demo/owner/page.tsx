import { ProtectedDemo } from '../protected-demo';

export const dynamic = 'force-dynamic';

export default function OwnerDemoPage() {
  return <ProtectedDemo demoRole="OWNER" />;
}
