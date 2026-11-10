import { demoAvailable, getDemoSession } from '../../../../server/demo-session.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  if (!demoAvailable()) return Response.json({ error: 'Demo unavailable.' }, { status: 404, headers });
  try {
    const session = await getDemoSession(request.headers);
    return session
      ? Response.json(session, { headers })
      : Response.json({ error: 'Sign in to the local demo.' }, { status: 401, headers });
  } catch {
    return Response.json({ error: 'Local authentication is unavailable. Check local setup and database health.' }, { status: 503, headers });
  }
}
