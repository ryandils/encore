import { getAuth } from '../../../../server/auth.ts';
import { demoAvailable } from '../../../../server/auth-config.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  if (!demoAvailable()) return Response.json({ error: 'Demo unavailable.' }, { status: 404, headers });
  // B0.3 exposes session flow only, not account enrollment or mutation workflows.
  const path = new URL(request.url).pathname;
  if (!['/api/auth/sign-in/email', '/api/auth/sign-out', '/api/auth/get-session'].includes(path)) {
    return Response.json({ error: 'Not found.' }, { status: 404, headers });
  }
  try {
    const response = await getAuth().handler(request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return Response.json({ error: 'Local authentication is unavailable. Check local setup and database health.' }, { status: 503, headers });
  }
}

export const GET = handler;
export const POST = handler;
