const BASE_PATH = '/api/local-auth';
const METHODS: Record<string, string> = {
  'sign-in/email': 'POST', 'sign-out': 'POST', 'get-session': 'GET',
  'send-verification-email': 'POST', 'request-password-reset': 'POST',
  'verify-email': 'POST', 'reset-password': 'POST',
};
const LIMIT = 4096;
const SELECTION_COOKIE = 'encore-app-auth.selected=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000';
type Dependencies = {
  available(): boolean;
  origin(): string;
  auth(): { handler(request: Request): Promise<Response> };
  clearLegacySession(headers: Headers): Promise<Response>;
};
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
function problem(status: number) {
  return Response.json({ error: status === 503 ? 'Local account rehearsal is unavailable. Check local setup and retry.' : 'The request could not be completed.' }, { status, headers });
}
async function body(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/json') return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > LIMIT) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
function valid(value: Record<string, unknown>, path: string) {
  const fields = path === 'sign-in/email' ? ['email', 'password'] : path === 'reset-password' ? ['token', 'newPassword']
    : path === 'verify-email' ? ['token'] : path === 'sign-out' ? [] : ['email'];
  if (Object.keys(value).length !== fields.length || !fields.every((key) => typeof value[key] === 'string' && value[key].length > 0)) return false;
  if ('email' in value && (typeof value.email !== 'string' || value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.invalid$/i.test(value.email))) return false;
  return !('token' in value) || (typeof value.token === 'string' && value.token.length <= 2048);
}

export function createAppAuthHandler(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (!dependencies.available()) return problem(404);
    const url = new URL(request.url);
    const path = url.pathname.startsWith(`${BASE_PATH}/`) ? url.pathname.slice(BASE_PATH.length + 1) : '';
    if (!METHODS[path] || url.search) return problem(404);
    if (request.method !== METHODS[path]) return problem(405);
    try {
      const origin = dependencies.origin();
      if (request.method === 'POST' && request.headers.get('origin') !== origin) return problem(403);
      const value = request.method === 'POST' ? await body(request) : undefined;
      if (request.method === 'POST' && (!value || !valid(value, path))) return problem(400);
      const target = new URL(`${BASE_PATH}/${path}`, origin);
      const forwarded = new Headers(request.headers);
      forwarded.delete('content-length');
      let method = request.method;
      let payload = value ? JSON.stringify(value) : undefined;
      if (path === 'verify-email') {
        // Token travels externally in POST JSON, never an HTTP query or server access log.
        target.searchParams.set('token', String(value?.token));
        method = 'GET'; payload = undefined;
        forwarded.delete('content-type');
      }
      const response = await dependencies.auth().handler(new Request(target, { method, headers: forwarded, body: payload }));
      if (response.status === 429) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { ...headers, ...(response.headers.get('x-retry-after') ? { 'Retry-After': response.headers.get('x-retry-after') as string } : {}) } });
      if (response.status >= 500) return problem(503);
      if (path === 'send-verification-email' || path === 'request-password-reset') return Response.json({ status: true }, { headers });
      if (path === 'verify-email') return response.ok ? Response.json({ status: true }, { headers }) : problem(400);
      if (!response.ok) return problem(response.status >= 400 && response.status < 500 ? response.status : 400);
      // Preserve session cookies but avoid returning session tokens/user details in JSON.
      const safeHeaders = new Headers(headers);
      if (path === 'sign-in/email' || path === 'sign-out') {
        const legacy = await dependencies.clearLegacySession(request.headers);
        if (!legacy.ok) return problem(503);
        for (const cookie of legacy.headers.getSetCookie()) safeHeaders.append('Set-Cookie', cookie);
      }
      for (const cookie of response.headers.getSetCookie()) safeHeaders.append('Set-Cookie', cookie);
      // Denial-only namespace memory survives expired/deleted session cookies. It
      // never authenticates a user; explicit demo sign-in may clear this choice.
      const selected = request.headers.get('cookie')?.split(';').some((entry) => entry.trim().split('=', 1)[0].startsWith('encore-app-auth.'));
      if (path === 'sign-in/email' || path === 'sign-out' || (path === 'get-session' && selected)) safeHeaders.append('Set-Cookie', SELECTION_COOKIE);
      if (path === 'get-session') {
        const session = await response.json();
        return Response.json(session?.user?.emailVerified ? { user: { id: session.user.id, email: session.user.email, emailVerified: true } } : null, { headers: safeHeaders });
      }
      return Response.json({ status: true }, { headers: safeHeaders });
    } catch { return problem(503); }
  };
}
