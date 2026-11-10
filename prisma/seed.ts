import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../.generated/prisma/client.ts';
import { createLocalClient, LocalDatabaseError, reportFailure } from '../scripts/db-local.ts';

export const demoIdentities = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'owner@encore-demo.invalid', name: 'Synthetic demo owner', role: 'OWNER', label: 'Synthetic local demo owner — not an authorization grant' },
  { id: '00000000-0000-4000-8000-000000000002', email: 'staff@encore-demo.invalid', name: 'Synthetic demo staff', role: 'STAFF', label: 'Synthetic local demo staff — not an authorization grant' },
] as const;

/** Caller must supply a client created only after validating the local target. */
export async function seedDemo(client: PrismaClient): Promise<void> {
  await client.$transaction(async (tx) => {
    for (const identity of demoIdentities) {
      const existing = await tx.user.findMany({
        where: { OR: [{ id: identity.id }, { email: identity.email }] },
        include: { demoIdentity: true },
      });
      if (existing.some((user) => user.id !== identity.id || user.email !== identity.email || !user.demoIdentity)) {
        throw new LocalDatabaseError('A reserved demo identity conflicts with existing local records. No demo records were changed; inspect the local database before reseeding.');
      }
      const { id, email, name, role, label } = identity;
      await tx.user.upsert({
        where: { id },
        update: {},
        create: { id, email, name, emailVerified: false, demoIdentity: { create: { role, label } } },
      });
    }
  });
}

async function main(): Promise<void> {
  const client = await createLocalClient();
  try {
    await seedDemo(client);
    console.log('PASS seeded two synthetic local identities. No passwords, login sessions, or messages were created.');
  } finally { await client.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(reportFailure);
}
