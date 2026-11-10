import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../.generated/prisma/client.ts';
import { getAuthConfig } from './auth-config.ts';

const globalAuth = globalThis as typeof globalThis & {
  encoreAuthDatabase?: { url: string; client: PrismaClient };
};

export function getAuthDatabase(): PrismaClient {
  const { databaseURL } = getAuthConfig();
  if (globalAuth.encoreAuthDatabase && globalAuth.encoreAuthDatabase.url !== databaseURL) {
    throw new Error('Restart the server after changing local authentication settings.');
  }
  globalAuth.encoreAuthDatabase ??= {
    url: databaseURL,
    client: new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseURL, connectionTimeoutMillis: 5000 }) }),
  };
  return globalAuth.encoreAuthDatabase.client;
}

function createAuth() {
  const config = getAuthConfig();
  return betterAuth({
    appName: 'Encore local synthetic demo',
    baseURL: config.baseURL,
    secret: config.secret,
    database: prismaAdapter(getAuthDatabase(), { provider: 'postgresql' }),
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: false },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true },
    logger: { disabled: true },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
let configuration: string | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  const current = JSON.stringify(getAuthConfig());
  if (configuration && configuration !== current) throw new Error('Restart the server after changing local authentication settings.');
  configuration = current;
  auth ??= createAuth();
  return auth;
}
