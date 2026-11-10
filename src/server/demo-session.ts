import { getAuth, getAuthDatabase } from './auth.ts';
import { demoAvailable } from './auth-config.ts';

export { demoAvailable } from './auth-config.ts';

export type DemoSession = {
  user: { id: string; name: string; email: string };
  role: 'OWNER' | 'STAFF';
};

/** Fixture role selects demo navigation only; it grants no venue/night access. */
export async function getDemoSession(headers: Headers): Promise<DemoSession | null> {
  if (!demoAvailable()) return null;
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  const fixture = await getAuthDatabase().demoIdentity.findUnique({ where: { userId: session.user.id } });
  if (!fixture) return null;
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email }, role: fixture.role };
}
