import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const headings = ['Task', 'Outcome', 'Changes', 'Verification', 'Context impact', 'Learning note', 'Next step'];
export function requiresHandoff(path: string) {
  return path !== 'README.md' && !(path.startsWith('docs/') && path.endsWith('.md'));
}
export function validateHandoff(content: string, template: string) {
  if (content.trim() === template.trim()) return ['Replace the copied template with actual evidence.'];
  const errors: string[] = [];
  for (const heading of headings) {
    const marker = `## ${heading}`;
    const lines = content.split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === marker);
    const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
    const body = start < 0 ? '' : lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
    if (!body || /^(?:TODO|TBD|N\/A|\.\.\.|\[.*\])\.?$/i.test(body)) {
      errors.push(`Fill the ${heading} section with task-specific context.`);
    }
  }
  return errors;
}
export function checkContext({ root, base }: { root: string; base: string }) {
  function git(args: string[]) {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr?.trim() || r.error?.message || 'Git command failed.');
    return r.stdout.trim();
  }
  if (!base || /^0+$/.test(base)) throw new Error('A real base commit/ref is required.');
  const sha = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]);
  const ancestor = git(['merge-base', sha, 'HEAD']);
  // Against the working tree includes committed, staged, and unstaged tracked changes.
  // Newly created files must be staged (or committed) before Git can include them.
  const paths = git(['diff', '--name-only', '-z', ancestor, '--']).split('\0').filter(Boolean);
  if (!paths.some(requiresHandoff)) return { required: false, handoffs: [] };
  const added = git(['diff', '--name-only', '--diff-filter=A', '-z', ancestor, '--'])
    .split('\0').filter(Boolean);
  const handoffs = added.filter(path => /^docs\/handoffs\/[^/]+\.md$/.test(path)
    && !['docs/handoffs/TEMPLATE.md', 'docs/handoffs/README.md'].includes(path));
  if (!handoffs.length) throw new Error('Code/tooling changed: add and stage a new docs/handoffs/<task>-<description>.md.');
  const template = readFileSync(join(root, 'docs/handoffs/TEMPLATE.md'), 'utf8');
  for (const path of handoffs) {
    const errors = validateHandoff(readFileSync(join(root, path), 'utf8'), template);
    if (errors.length) throw new Error(`${path}: ${errors.join(' ')}`);
  }
  return { required: true, handoffs };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = fileURLToPath(new URL('../', import.meta.url));
  try {
    if (args.length && (args.length !== 2 || args[0] !== '--base')) {
      throw new Error('Usage: npm run context:check -- --base <ref-or-sha>');
    }
    const result = checkContext({ root, base: args[1] || process.env.CONTEXT_BASE || 'origin/main' });
    console.log(result.required ? `PASS context handoff: ${result.handoffs.join(', ')}` : 'PASS context: docs-only or no changes.');
    console.log('Presence/structure verified only; review accuracy and canonical-doc impact in the PR.');
  } catch (error) {
    console.error(`FAIL context: ${error instanceof Error ? error.message : String(error)}\nFetch the base ref/history, stage new handoffs, and retry. No context update was generated.`);
    process.exitCode = 1;
  }
}
