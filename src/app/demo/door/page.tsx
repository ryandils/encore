import { notFound } from 'next/navigation';
import { DoorDemo } from './door-demo';

export const dynamic = 'force-dynamic';

export default function DoorDemoPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DoorDemo />;
}
