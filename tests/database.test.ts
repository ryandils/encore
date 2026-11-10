import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { requireResetConfirmation, resolveLocalDockerEndpoint, safeFailureDiagnostic, validateLocalDatabase } from '../scripts/db-local.ts';

const localUrl = 'postgresql://encore_local:encore_local_only@127.0.0.1:54329/encore_local?schema=public';

describe('dedicated local database boundary', () => {
  it.each(['127.0.0.1', 'localhost', '[::1]'])('accepts the dedicated target on %s', (host) => {
    const url = localUrl.replace('127.0.0.1', host);
    expect(validateLocalDatabase({ DATABASE_URL: url, NODE_ENV: 'development' })).toBe(url);
  });

  it('rejects production even for a valid local URL', () => {
    expect(() => validateLocalDatabase({ DATABASE_URL: localUrl, NODE_ENV: 'production' })).toThrow('production');
  });

  it.each([
    undefined,
    '',
    'not-a-url',
    localUrl.replace('postgresql:', 'https:'),
    localUrl.replace('127.0.0.1', 'db.example.com'),
    localUrl.replace('127.0.0.1', 'localhost.example.com'),
    localUrl.replace('127.0.0.1', '127.0.0.2'),
    localUrl.replace(':54329/', ':5432/'),
    localUrl.replace('encore_local:', 'postgres:'),
    localUrl.replace('/encore_local?', '/production?'),
    localUrl.replace('encore_local_only', ''),
    localUrl.replace('schema=public', 'schema=private'),
    `${localUrl}&schema=public`,
    `${localUrl}&host=db.example.com`,
    `${localUrl}&options=-csearch_path=private`,
    `${localUrl}#ignored-fragment`,
  ])('refuses an absent, malformed, or non-dedicated target (%#)', (url) => {
    expect(() => validateLocalDatabase({ DATABASE_URL: url })).toThrow();
  });

  it('requires the exact destructive-reset acknowledgement', () => {
    for (const args of [[], ['--force'], ['--confirm-local-reset', '--force']]) {
      expect(() => requireResetConfirmation(args)).toThrow('Reset deletes all data');
    }
    expect(() => requireResetConfirmation(['--confirm-local-reset'])).not.toThrow();
  });

  it.each(['migrate', 'seed', 'reset', 'verify'])('the %s CLI rejects production before contacting a database and redacts credentials', (command) => {
    const secret = 'SENSITIVE_TEST_PASSWORD';
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/db.ts', import.meta.url)), command,
      ...(command === 'reset' ? ['--confirm-local-reset'] : []),
    ], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: localUrl.replace('encore_local_only', secret) },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unavailable in production');
    expect(result.stdout + result.stderr).not.toContain(secret);
    expect(result.stdout + result.stderr).not.toContain(localUrl);
  });
});


describe('safe setup-failure diagnostics', () => {
  it.each([
    ['P1000 password authentication failed', 'P1000: local PostgreSQL authentication failed'],
    ['28P01', 'P1000: local PostgreSQL authentication failed'],
    ['P1001 Cannot reach database server', 'P1001: local PostgreSQL is unreachable'],
    ['connect ECONNREFUSED 127.0.0.1:54329', 'P1001: local PostgreSQL is unreachable'],
    ['P3009 migrate found failed migrations', 'P3009: a previous migration failed'],
    ['Failed to fetch https://binaries.prisma.sh/engine.gz: 403 Forbidden CONNECT', 'Allow HTTPS access to binaries.prisma.sh'],
    ['Cannot connect to the Docker daemon. Is the docker daemon running?', 'Docker engine is unavailable'],
    ['error during connect: dockerDesktopLinuxEngine', 'Docker engine is unavailable'],
    ['docker: unknown command: docker compose', 'Docker Compose is unavailable'],
    ["compose is not a docker command", 'Docker Compose is unavailable'],
    ['listen EADDRINUSE', 'could not bind port 54329'],
    ['Bind for 127.0.0.1:54329 failed: port is already allocated', 'could not bind port 54329'],
    ['something entirely unexpected happened', 'Unrecognized diagnostic details are withheld'],
  ])('classifies known failures without echoing sensitive child output (%#)', (output, expected) => {
    const secret = 'DO_NOT_ECHO_THIS_PASSWORD';
    const unsafeOutput = `${output}\npostgresql://encore_local:${secret}@private-host.example:54329/encore_local`;
    const diagnosis = safeFailureDiagnostic(unsafeOutput);
    expect(diagnosis).toContain(expected);
    expect(diagnosis).not.toContain(secret);
    expect(diagnosis).not.toContain('private-host.example');
    expect(diagnosis).not.toContain('postgresql://');
  });

  it.each(['migrate', 'seed', 'reset', 'verify'])('the %s CLI refuses a remote target before spawning its database operation', (command) => {
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/db.ts', import.meta.url)), command,
      ...(command === 'reset' ? ['--confirm-local-reset'] : []),
    ], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: localUrl.replace('127.0.0.1', 'remote.example.com') },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing database access');
    expect(result.stderr).not.toContain('remote.example.com');
    expect(result.stderr).not.toContain('encore_local_only');
  });
});


describe('local Docker daemon boundary', () => {
  it.each(['unix:///var/run/docker.sock', 'unix:///home/example/.docker/run/docker.sock', 'npipe:////./pipe/docker_engine', 'npipe:////./pipe/dockerDesktopLinuxEngine'])(
    'allows a local socket endpoint (%#)', (endpoint) => {
      expect(resolveLocalDockerEndpoint({ DOCKER_HOST: endpoint }, () => { throw new Error('Unexpected context inspection'); })).toBe(endpoint);
    },
  );

  it.each(['tcp://remote.example:2376', 'tcp://127.0.0.1:2375', 'ssh://user@remote.example', 'unix://remote.example/var/run/docker.sock', 'npipe:////remote.example/pipe/docker_engine', 'npipe:////./pipe/../remote', 'https://remote.example', '', 'unix:///var/run/docker.sock?redirect=remote'])('rejects a non-local daemon (%#)', (endpoint) => {
    expect(() => resolveLocalDockerEndpoint({ DOCKER_HOST: endpoint }, () => endpoint)).toThrow('Refusing Docker access');
  });

  it('uses a named DOCKER_CONTEXT before DOCKER_HOST', () => {
    const inspect = vi.fn(() => 'unix:///var/run/docker.sock\n');
    expect(resolveLocalDockerEndpoint({ DOCKER_CONTEXT: 'desktop-linux', DOCKER_HOST: 'tcp://remote.example:2376' }, inspect)).toBe('unix:///var/run/docker.sock');
    expect(inspect).toHaveBeenCalledExactlyOnceWith('desktop-linux');
  });

  it('refuses a remote named context even when DOCKER_HOST is local', () => {
    const inspect = vi.fn(() => 'ssh://remote.example');
    expect(() => resolveLocalDockerEndpoint({ DOCKER_CONTEXT: 'remote', DOCKER_HOST: 'unix:///var/run/docker.sock' }, inspect)).toThrow('Refusing Docker access');
    expect(inspect).toHaveBeenCalledExactlyOnceWith('remote');
  });

  it('inspects the current context when neither override is set', () => {
    const inspect = vi.fn(() => 'unix:///var/run/docker.sock\n');
    expect(resolveLocalDockerEndpoint({}, inspect)).toBe('unix:///var/run/docker.sock');
    expect(inspect).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it.each(['up', 'down', 'status'])('the %s CLI rejects a remote Docker endpoint before any Compose action', (command) => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/db.ts', import.meta.url)), command], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: localUrl, DOCKER_HOST: 'tcp://sensitive-remote.example:2376', DOCKER_CONTEXT: '' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing Docker access');
    expect(result.stderr).not.toContain('sensitive-remote.example');
    expect(result.stderr).not.toContain('encore_local_only');
  });
});
