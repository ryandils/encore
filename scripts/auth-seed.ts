import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { PrismaClient } from '../.generated/prisma/client.ts';
import { demoIdentities, seedDemo } from '../prisma/seed.ts';
import { type AuthEnvironment, getAuthConfig, getDemoPasswords } from '../src/server/auth-config.ts';
import { createLocalClient, LocalDatabaseError, localEnvironment, reportFailure } from './db-local.ts';

/** Explicit local-only credential provisioning; never called from an HTTP route. */
export async function seedAuth(client: PrismaClient, environment: AuthEnvironment = process.env): Promise<void> {
  getAuthConfig(environment);
  const passwords = getDemoPasswords(environment);
  await seedDemo(client);
  await client.$transaction(async (tx) => {
    for (const identity of demoIdentities) {
      const fixture = await tx.user.findUnique({ where: { id: identity.id }, include: { demoIdentity: true } });
      if (fixture?.email !== identity.email || fixture.demoIdentity?.role !== identity.role || fixture.demoIdentity.label !== identity.label) {
        throw new LocalDatabaseError('A reserved synthetic identity conflicts with expected fixture metadata. No credentials were changed.');
      }
      const id = `demo-credential-${identity.role.toLowerCase()}`;
      const existing = await tx.account.findMany({ where: { OR: [
        { id }, { providerId: 'credential', accountId: identity.id }, { providerId: 'credential', userId: identity.id },
      ] } });
      if (existing.length) {
        const account = existing[0];
        if (existing.length !== 1 || !account || account.id !== id || account.userId !== identity.id
          || account.accountId !== identity.id || account.providerId !== 'credential' || !account.password
          || !(await verifyPassword({ hash: account.password, password: passwords[identity.role] }))) {
          throw new LocalDatabaseError('Existing demo credentials conflict with local settings. No credentials were overwritten; restore the matching local password or deliberately reset the disposable database.');
        }
        continue;
      }
      await tx.account.create({ data: {
        id, userId: identity.id, accountId: identity.id, providerId: 'credential', password: await hashPassword(passwords[identity.role]),
      } });
    }
  });
}

async function main(): Promise<void> {
  if (process.argv.length !== 2) throw new LocalDatabaseError('auth:seed does not accept arguments.');
  localEnvironment();
  getAuthConfig();
  getDemoPasswords();
  const client = await createLocalClient();
  try {
    await seedAuth(client);
    console.log('PASS provisioned two synthetic local credential accounts. Existing passwords and timestamps were preserved; no sessions or messages were created.');
  } finally { await client.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(reportFailure);
}
