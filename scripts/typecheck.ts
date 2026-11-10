import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const commands = [
  ['node_modules/next/dist/bin/next', 'typegen'],
  ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.harness.json'],
  ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.json'],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
