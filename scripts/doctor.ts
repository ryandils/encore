import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
let failures = 0;
function report(ok: boolean | undefined, message: string) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${message}`);
  if (!ok) failures++;
}
report(Number(process.versions.node.split('.')[0]) === 24,
  `Node ${process.versions.node}; use Node 24.x (restart your terminal after installing).`);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const pinned = pkg.packageManager?.replace('pnpm@', '');
const pnpmVersion = process.env.npm_config_user_agent?.match(/pnpm\/(\d+\.\d+\.\d+)/)?.[1];
report(pnpmVersion === pinned,
  `pnpm ${pnpmVersion ?? 'unknown'}; use pinned ${pinned} and run pnpm run doctor.`);
const git = spawnSync('git', ['--version'], { encoding: 'utf8', cwd: root });
report(git.status === 0, git.stdout?.trim() || 'Install Git and restart your terminal.');
const repo = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', cwd: root });
report(repo.status === 0, 'Run from a Git clone, not a downloaded ZIP.');
for (const path of ['README.md', 'AGENTS.md', 'pnpm-lock.yaml', 'docs/QUICKSTART.md']) {
  report(existsSync(join(root, path)), `Repository file: ${path}`);
}
console.log(`Platform: ${process.platform}/${process.arch}`);
console.log(pkg.scripts.dev
  ? 'An app dev script exists; follow the current README for its additional prerequisites.'
  : 'Harness only: no Encore app server or database is implemented yet.');
console.log('Local database work additionally needs Docker Compose v2: run pnpm run db:status. The landing page and baseline checks do not need PostgreSQL.');
console.log('This check does not verify GitHub write access, Codex login, or pilot readiness.');
process.exitCode = failures ? 1 : 0;
