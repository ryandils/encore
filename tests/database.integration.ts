import assert from 'node:assert/strict';
import { demoIdentities, seedDemo } from '../prisma/seed.ts';
import { createLocalClient, localEnvironment, reportFailure, runCompose, runPrisma } from '../scripts/db-local.ts';

/** Explicit opt-in integration command; never part of the database-free Vitest suite. */
async function verify(): Promise<void> {
  localEnvironment();
  runPrisma(['migrate', 'deploy'], 'Integration migration');
  let client = await createLocalClient();
  try {
    const originalUsers = await client.user.findMany({ include: { demoIdentity: true }, orderBy: { id: 'asc' } });
    await seedDemo(client);
    const first = await client.user.findMany({ include: { demoIdentity: true }, orderBy: { id: 'asc' } });
    for (const identity of demoIdentities) {
      const users = first.filter((user) => user.id === identity.id || user.email === identity.email);
      assert.equal(users.length, 1, 'Each synthetic fixture must exist exactly once.');
      const user = users[0];
      assert.ok(user);
      assert.equal(user.id, identity.id);
      assert.equal(user.email, identity.email);
      assert.equal(user.name, identity.name);
      assert.equal(user.emailVerified, false);
      assert.equal(user.demoIdentity?.userId, identity.id);
      assert.equal(user.demoIdentity?.role, identity.role);
      assert.equal(user.demoIdentity?.label, identity.label);
    }
    for (const original of originalUsers) {
      assert.deepEqual(first.find((user) => user.id === original.id), original, 'Seeding must preserve existing local records.');
    }
    await seedDemo(client);
    const second = await client.user.findMany({ include: { demoIdentity: true }, orderBy: { id: 'asc' } });
    assert.deepEqual(second, first, 'Repeated seed must preserve all IDs, timestamps, records, and counts.');
    await client.$disconnect();
    runCompose(['restart', 'db'], 'PostgreSQL restart for persistence verification');
    runCompose(['up', '--detach', '--wait', '--wait-timeout', '60', 'db'], 'PostgreSQL health after restart');
    client = await createLocalClient();
    const restarted = await client.user.findMany({ include: { demoIdentity: true }, orderBy: { id: 'asc' } });
    assert.deepEqual(restarted, second, 'Records must survive a PostgreSQL restart with a fresh connection.');
    runPrisma(['migrate', 'deploy'], 'Repeated migration after restart');
    console.log(`PASS migrations, two seeds, exact synthetic identities, preservation of ${originalUsers.length} existing users, and PostgreSQL restart persistence (${restarted.length} total users). No reset was performed.`);
  } finally { await client.$disconnect(); }
}

await verify().catch(reportFailure);
