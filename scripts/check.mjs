import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const errors = [];
const skipped = new Set(['.git', 'node_modules', '.next', 'coverage', 'dist', 'out', '.vercel']);
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);
for (const path of ['README.md', 'AGENTS.md', 'docs/MVP.md', 'docs/ARCHITECTURE.md',
  'docs/BUILD_PLAN.md', 'docs/QUICKSTART.md', 'docs/HARNESS.md', 'docs/LEARNING_PATH.md',
  'docs/tasks/TEMPLATE.md', '.github/pull_request_template.md']) {
  if (!existsSync(join(root, path))) errors.push(`Missing required file: ${path}`);
}
for (const path of files) {
  const label = relative(root, path);
  const extension = extname(path);
  if (extension === '.json') {
    try { JSON.parse(readFileSync(path, 'utf8')); }
    catch (error) { errors.push(`${label}: invalid JSON: ${error.message}`); }
  }
  if (extension === '.mjs') {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    if (result.status !== 0) errors.push(`${label}: ${result.stderr || result.error}`);
  }
  if (extension !== '.md') continue;
  const content = readFileSync(path, 'utf8');
  // Simple inline Markdown links only. No network requests or heading validation.
  // Skip code blocks so example links/commands are not interpreted as documents.
  const prose = content.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  for (const match of prose.matchAll(/\]\(([^)]+)\)/g)) {
    let href = match[1].trim();
    if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1);
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) continue;
    try { href = decodeURIComponent(href.split(/[?#]/)[0]); }
    catch { errors.push(`${label}: invalid link encoding: ${href}`); continue; }
    const target = resolve(dirname(path), href);
    const rel = relative(root, target);
    if (isAbsolute(href) || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
      || isAbsolute(rel) || !existsSync(target) || !statSync(target).isFile()) {
      errors.push(`${label}: missing or nonportable local file link: ${href}`);
    }
  }
}
if (errors.length) {
  errors.forEach(error => console.error(`FAIL ${error}`));
  process.exitCode = 1;
} else {
  console.log('PASS harness: required docs, inline local file links, JSON, and Node script syntax.');
  console.log('No application lint, typecheck, tests, build, remote links, or heading anchors were checked.');
}
