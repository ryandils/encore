import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manager = process.env.npm_execpath;
const version = process.env.npm_config_user_agent?.match(/pnpm\/(\d+\.\d+\.\d+)/)?.[1];

try {
  if (process.versions.node.split('.')[0] !== '24') throw new Error('Select Node 24 for this environment.');
  if (!manager || `pnpm@${version}` !== pkg.packageManager) {
    throw new Error(`Run through the pinned manager: corepack pnpm run cloud:setup (${pkg.packageManager}).`);
  }
  // pnpm can be either a Node entry point or a native executable. No shell is needed.
  const isNodeEntry = ['.js', '.cjs', '.mjs'].includes(extname(manager));
  function run(args: string[]) {
    const command = isNodeEntry ? process.execPath : manager!;
    const result = spawnSync(command, isNodeEntry ? [manager!, ...args] : args,
      { cwd: root, stdio: 'inherit', env: process.env });
    if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed: ${result.error?.message ?? result.status}`);
  }
  run(['install', '--frozen-lockfile']);
  for (const script of ['doctor', 'compiler:version', 'typecheck', 'check', 'context:test']) run(['run', script]);
  console.log('PASS Encore cloud checkout bootstrap. This does not create/publish a saved environment or run an app.');
} catch (error) {
  console.error(`FAIL cloud setup: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
