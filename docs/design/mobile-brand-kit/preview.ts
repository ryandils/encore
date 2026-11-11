/** Local design review with browser-only sample storage; outside the application. */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { renderVenueProfile } from './venue-profiles.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
execFileSync(process.execPath, [
  fileURLToPath(new URL('../../../node_modules/typescript/bin/tsc', import.meta.url)),
  '--ignoreConfig', '--strict', '--target', 'es2023', '--module', 'nodenext',
  '--lib', 'es2023,dom', '--types', 'node', '--rewriteRelativeImportExtensions',
  '--outDir', '.generated/discovery-preview', 'docs/design/mobile-brand-kit/discovery-client.ts',
], { cwd: root, stdio: 'inherit' });

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/discover.html', ['discover.html', 'text/html; charset=utf-8']],
  ['/discover.css', ['discover.css', 'text/css; charset=utf-8']],
  ['/venue-profile.css', ['venue-profile.css', 'text/css; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/discovery-client.js', ['../../../.generated/discovery-preview/discovery-client.js', 'text/javascript; charset=utf-8']],
  ['/venue-data.js', ['../../../.generated/discovery-preview/venue-data.js', 'text/javascript; charset=utf-8']],
  ['/occupancy-filter.js', ['../../../.generated/discovery-preview/occupancy-filter.js', 'text/javascript; charset=utf-8']],
  ['/spots-state.js', ['../../../.generated/discovery-preview/spots-state.js', 'text/javascript; charset=utf-8']],
  ['/GUIDELINES.md', ['GUIDELINES.md', 'text/plain; charset=utf-8']],
  ['/assets/encore-mark.svg', ['assets/encore-mark.svg', 'image/svg+xml']],
  ['/assets/sample-bar-interior.svg', ['assets/sample-bar-interior.svg', 'image/svg+xml']],
] as const);

const server = createServer(async (request, response) => {
  const path = request.url?.split('?')[0] ?? '/';
  const file = files.get(path as Parameters<typeof files.get>[0]);
  const profile = renderVenueProfile(path);
  if ((!file && !profile) || (request.method !== 'GET' && request.method !== 'HEAD')) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = profile ?? (file ? await readFile(new URL(file[0], import.meta.url)) : '');
    response.writeHead(200, {
      'Content-Type': profile ? 'text/html; charset=utf-8' : file?.[1],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500).end('Preview file unavailable');
  }
});
server.on('error', (error: Error) => {
  console.error(`Design preview could not start: ${error.message}`);
  process.exitCode = 1;
});
const port = Number(process.env.ENCORE_PREVIEW_PORT ?? 4173);
server.listen(port, '127.0.0.1', () => {
  console.log('Encore design review: http://127.0.0.1:' + port + ' (Ctrl+C to stop)');
});
