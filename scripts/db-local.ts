import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { LocalDatabaseError, validateLocalDatabase } from '../src/server/local-database-config.ts';

export { LocalDatabaseError, validateLocalDatabase } from '../src/server/local-database-config.ts';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function requireResetConfirmation(args: string[]): void {
  if (args.length !== 1 || args[0] !== '--confirm-local-reset') {
    throw new LocalDatabaseError('Reset deletes all data in the dedicated local encore_local database. To confirm, run pnpm run db:reset --confirm-local-reset.');
  }
}

export function localEnvironment(): string {
  const envPath = new URL('../.env', import.meta.url);
  if (existsSync(envPath)) loadEnvFile(envPath);
  return validateLocalDatabase(process.env);
}

/** Classify untrusted diagnostic text; return only fixed, credential-free guidance. */
export function safeFailureDiagnostic(output: string): string {
  if (/binaries\.prisma\.sh/i.test(output) && /403|forbidden|connect|download|fetch/i.test(output)) {
    return 'Prisma engine download was blocked or failed. Allow HTTPS access to binaries.prisma.sh in the environment network settings, then retry pnpm run db:generate. Do not disable checksum verification.';
  }
  if (/\bP1000\b|\b28P01\b|password authentication failed/i.test(output)) {
    return 'P1000: local PostgreSQL authentication failed. Compare the local .env user/password with .env.example and the credentials used when the data volume was initialized. Existing volumes retain their original password.';
  }
  if (/\bP1001\b|ECONNREFUSED|can.t reach database server/i.test(output)) {
    return 'P1001: local PostgreSQL is unreachable. Start Docker and run pnpm run db:up, then pnpm run db:status; confirm the dedicated loopback port is 54329.';
  }
  if (/\bP3009\b|failed migrations in the target database/i.test(output)) {
    return 'P3009: a previous migration failed. Inspect the dedicated local database migration history and correct the cause before retrying. Do not mark migrations applied blindly; reset is only for explicitly disposable local data.';
  }
  if (/EADDRINUSE|address already in use|port is already allocated|ports are not available/i.test(output)) {
    return 'Local PostgreSQL could not bind port 54329 because it is unavailable. Stop the conflicting local service and retry pnpm run db:up; do not change the guarded database URL to another target.';
  }
  if (/cannot connect to the docker daemon|is the docker daemon running|docker daemon is not running|error during connect|dockerdesktoplinuxengine/i.test(output)) {
    return 'Docker engine is unavailable. Start Docker Desktop (Linux containers) or the local Docker engine, wait until it is ready, then retry pnpm run db:up.';
  }
  if (/compose.*(?:not a docker command|not found)|unknown command[^\n]*compose/i.test(output)) {
    return 'Docker Compose is unavailable. Install Docker Desktop with Compose v2, or the Docker Compose v2 plugin, and verify docker compose version.';
  }
  return 'Check Docker health, local .env settings, generated client, and applied migrations. Run pnpm run db:status. Unrecognized diagnostic details are withheld to protect connection credentials.';
}

export function runChecked(command: string, args: string[], purpose: string, environment: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync(command, args, { cwd: root, env: environment, encoding: 'utf8' });
  if (result.status !== 0) {
    // Driver/CLI output can contain connection URLs or passwords. Never print it.
    const missing = result.error && 'code' in result.error && result.error.code === 'ENOENT';
    throw new LocalDatabaseError(missing
      ? `${purpose} could not start: install ${command === 'docker' ? 'Docker Desktop with Compose and start its engine' : 'the pinned dependencies with pnpm install --frozen-lockfile'}.`
      : `${purpose} failed. ${safeFailureDiagnostic(`${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`)}`);
  }
  return result.stdout;
}

/** Docker context selection takes precedence over DOCKER_HOST, as in Docker CLI. */
export function resolveLocalDockerEndpoint(
  environment: Readonly<Record<string, string | undefined>>,
  inspectContext: (context: string | undefined) => string,
): string {
  const endpoint = (environment.DOCKER_CONTEXT
    ? inspectContext(environment.DOCKER_CONTEXT)
    : environment.DOCKER_HOST || inspectContext(undefined)).trim();
  const localUnixSocket = /^unix:\/\/\/[^?#]+$/.test(endpoint) && [...endpoint].every((character) => character.charCodeAt(0) > 31);
  const localWindowsPipe = /^npipe:\/\/\/\/\.\/pipe\/[a-zA-Z0-9_.-]+$/.test(endpoint);
  if (!localUnixSocket && !localWindowsPipe) {
    throw new LocalDatabaseError('Refusing Docker access: local database commands require a local Unix socket or Windows named-pipe Docker endpoint. Select a local Docker Desktop/socket context and clear remote DOCKER_HOST/DOCKER_CONTEXT overrides. TCP and SSH endpoints are not allowed, including loopback TCP.');
  }
  return endpoint;
}

export function runCompose(args: string[], purpose: string): string {
  const environment = { ...process.env };
  const endpoint = resolveLocalDockerEndpoint(environment, (context) => runChecked('docker', [
    'context', 'inspect', ...(context ? [context] : []), '--format', '{{.Endpoints.docker.Host}}',
  ], 'Docker context inspection', environment));
  // Pin the inspected endpoint so concurrent context changes cannot redirect the action.
  delete environment.DOCKER_CONTEXT;
  delete environment.DOCKER_HOST;
  delete environment.DOCKER_TLS;
  delete environment.DOCKER_TLS_VERIFY;
  delete environment.DOCKER_CERT_PATH;
  return runChecked('docker', ['--host', endpoint, 'compose', '--project-name', 'encore-local', '--file', fileURLToPath(new URL('../compose.yaml', import.meta.url)), ...args], purpose, environment);
}

export function runPrisma(args: string[], purpose: string): void {
  runChecked(process.execPath, ['node_modules/prisma/build/index.js', ...args], purpose);
}

export async function createLocalClient() {
  const connectionString = localEnvironment();
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import('../.generated/prisma/client.ts'),
    import('@prisma/adapter-pg'),
  ]);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
}

export function reportFailure(error: unknown): void {
  const details = error instanceof Error ? error.message + ('code' in error ? ` ${String(error.code)}` : '') : '';
  console.error(`FAIL local database: ${error instanceof LocalDatabaseError ? error.message : safeFailureDiagnostic(details)}`);
  process.exitCode = 1;
}
