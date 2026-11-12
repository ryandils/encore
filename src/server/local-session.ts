import { getAuth, getAuthDatabase } from './auth.ts';
import { demoAvailable } from './auth-config.ts';
import { getAppSession } from './app-auth.ts';

/** Prefer app identity; an expired app cookie must never fall back to another account. */
export async function getProtectedLocalSession(headers: Headers) {
  if (!demoAvailable()) return null;
  if ((headers.get('cookie') ?? '').split(';').some((part) => part.trim().startsWith('encore-app-auth.'))) {
    return getAppSession(headers);
  }
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  if (session.user.emailVerified) return session;
  // Preserve only the original, explicitly labeled seed rehearsal's unverified identities.
  const reserved = (session.user.id === '00000000-0000-4000-8000-000000000001' && session.user.email === 'owner@encore-demo.invalid')
    || (session.user.id === '00000000-0000-4000-8000-000000000002' && session.user.email === 'staff@encore-demo.invalid');
  if (!reserved) return null;
  const fixture = await getAuthDatabase().demoIdentity.findUnique({ where: { userId: session.user.id } });
  return fixture ? session : null;
}
