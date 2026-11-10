import { copyFileSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalDatabaseError, localEnvironment, reportFailure, requireResetConfirmation, runChecked, runCompose, runPrisma } from './db-local.ts';

export async function main(args: string[]): Promise<void> {
  const [command, ...options] = args;
  if (command === 'reset') requireResetConfirmation(options);
  else if (options.length) throw new LocalDatabaseError('Unexpected command arguments. See the local database commands in README.md.');

  if (command === 'init') {
    try {
      copyFileSync(new URL('../.env.example', import.meta.url), new URL('../.env', import.meta.url), constants.COPYFILE_EXCL);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        throw new LocalDatabaseError('.env already exists and was preserved. Compare it with .env.example; db:init never overwrites local settings.');
      }
      throw error;
    }
    console.log('PASS created .env for the dedicated local database. These are synthetic local-only credentials.');
    return;
  }
  if (command === 'generate') {
    runPrisma(['generate'], 'Prisma client generation');
    console.log('PASS generated the Prisma client; no database connection was required.');
    return;
  }
  if (!['up', 'down', 'status', 'migrate', 'seed', 'reset', 'verify'].includes(command ?? '')) {
    throw new LocalDatabaseError('Choose init, generate, up, down, status, migrate, seed, reset, or verify.');
  }
  localEnvironment();
  switch (command) {
    case 'up':
      runCompose(['up', '--detach', '--wait', '--wait-timeout', '60', 'db'], 'Local PostgreSQL startup');
      console.log('PASS local PostgreSQL is healthy on port 54329.');
      break;
    case 'down':
      runCompose(['down'], 'Local PostgreSQL shutdown');
      console.log('PASS stopped local PostgreSQL. The named data volume is preserved.');
      break;
    case 'status':
      console.log(runCompose(['ps', 'db'], 'Local PostgreSQL status').trim());
      break;
    case 'migrate':
      runPrisma(['migrate', 'deploy'], 'Local database migration');
      console.log('PASS applied committed migrations to the dedicated local database.');
      break;
    case 'seed':
      runChecked(process.execPath, ['prisma/seed.ts'], 'Synthetic local seed');
      console.log('PASS seeded two synthetic identities without login credentials or messages.');
      break;
    case 'reset':
      runPrisma(['migrate', 'reset', '--force'], 'Explicitly confirmed local database reset');
      console.log('PASS reset and migrated the dedicated local database. Run pnpm run db:seed to restore synthetic identities.');
      break;
    case 'verify':
      console.log(runChecked(process.execPath, ['tests/database.integration.ts'], 'Local migration, seed, and restart verification').trim());
      break;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2)).catch(reportFailure);
}
