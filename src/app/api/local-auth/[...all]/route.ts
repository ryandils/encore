import { appAuthAvailable, clearLegacySession, getAppAuth } from '../../../../server/app-auth.ts';
import { getAuthConfig } from '../../../../server/auth-config.ts';
import { createAppAuthHandler } from '../../../../server/app-auth-http.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handler = createAppAuthHandler({ available: appAuthAvailable, origin: () => getAuthConfig().baseURL, auth: getAppAuth, clearLegacySession });
export const GET = handler;
export const POST = handler;
