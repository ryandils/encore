-- B0.2 identity storage only; no passwords, sessions, or domain authorization.
CREATE TYPE "DemoRole" AS ENUM ('OWNER', 'STAFF');

CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "demo_identity" (
    "userId" TEXT NOT NULL,
    "role" "DemoRole" NOT NULL,
    "label" TEXT NOT NULL,
    CONSTRAINT "demo_identity_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
ALTER TABLE "demo_identity" ADD CONSTRAINT "demo_identity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
