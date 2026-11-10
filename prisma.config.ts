import { defineConfig } from 'prisma/config';

// Generation/validation need no credentials. Database commands load and validate
// the local URL in scripts/db.ts before invoking Prisma with this configuration.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
