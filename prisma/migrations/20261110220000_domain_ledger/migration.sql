-- B1 storage contracts only. B4 must authorize and serialize each command and
-- close under the Night row lock, validate ledger replay, and retain receipts.
-- Existing identity/authentication tables and data are preserved.
CREATE TYPE "VenueRole" AS ENUM ('OWNER', 'STAFF');
CREATE TYPE "NightStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "DoorEventType" AS ENUM ('ADMISSION', 'EXIT', 'REVERSAL');

CREATE TABLE "venue" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    CONSTRAINT "venue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "venue_values_check" CHECK (
      length(btrim("name")) > 0 AND length(btrim("timezone")) > 0 AND "capacity" >= 0
    )
);

CREATE TABLE "venue_membership" (
    "venueId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "VenueRole" NOT NULL,
    CONSTRAINT "venue_membership_pkey" PRIMARY KEY ("venueId", "userId"),
    CONSTRAINT "venue_membership_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "venue_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "venue_membership_userId_idx" ON "venue_membership"("userId");

CREATE TABLE "night" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" "NightStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    -- Snapshot these values so later venue edits do not reinterpret old nights.
    "capacity" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "startingOccupancy" INTEGER NOT NULL DEFAULT 0,
    "openingFloatCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "night_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "night_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "night_values_check" CHECK (
      length(btrim("label")) > 0 AND length(btrim("timezone")) > 0 AND
      "capacity" >= 0 AND "startingOccupancy" >= 0 AND "openingFloatCents" >= 0 AND
      "currency" = 'USD' AND "version" >= 0 AND
      (("status" = 'OPEN' AND "closedAt" IS NULL) OR
       ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedAt" >= "openedAt"))
    )
);
CREATE UNIQUE INDEX "night_id_venueId_key" ON "night"("id", "venueId");
CREATE INDEX "night_venueId_idx" ON "night"("venueId");
-- A database-enforced invariant, including concurrent attempts to open a night.
CREATE UNIQUE INDEX "night_one_open_per_venue" ON "night"("venueId") WHERE "status" = 'OPEN';

CREATE TABLE "cover_preset" (
    "venueId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "cover_preset_pkey" PRIMARY KEY ("venueId", "slot"),
    CONSTRAINT "cover_preset_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "cover_preset_values_check" CHECK ("slot" BETWEEN 1 AND 3 AND "amountCents" >= 0 AND length(btrim("label")) > 0)
);

CREATE TABLE "night_assignment" (
    "nightId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "night_assignment_pkey" PRIMARY KEY ("nightId", "userId"),
    CONSTRAINT "night_assignment_nightId_venueId_fkey" FOREIGN KEY ("nightId", "venueId") REFERENCES "night"("id", "venueId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "night_assignment_venueId_userId_fkey" FOREIGN KEY ("venueId", "userId") REFERENCES "venue_membership"("venueId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "night_assignment_interval_check" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "night_assignment_venueId_userId_idx" ON "night_assignment"("venueId", "userId");

CREATE TABLE "staff_invite" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "nightId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "intendedEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "staff_invite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_invite_nightId_venueId_fkey" FOREIGN KEY ("nightId", "venueId") REFERENCES "night"("id", "venueId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "staff_invite_values_check" CHECK (
      length(btrim("tokenHash")) > 0 AND length(btrim("intendedEmail")) > 0 AND "expiresAt" > "createdAt" AND
      ("consumedAt" IS NULL OR ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt"))
    )
);
CREATE UNIQUE INDEX "staff_invite_tokenHash_key" ON "staff_invite"("tokenHash");
CREATE INDEX "staff_invite_nightId_venueId_idx" ON "staff_invite"("nightId", "venueId");

CREATE TABLE "door_event" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "nightId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "DoorEventType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "targetEventId" UUID,
    "reason" TEXT,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    -- Canonical validated command and original authoritative result; no secrets.
    "requestPayload" JSONB NOT NULL,
    "responseSnapshot" JSONB NOT NULL,
    CONSTRAINT "door_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "door_event_nightId_venueId_fkey" FOREIGN KEY ("nightId", "venueId") REFERENCES "night"("id", "venueId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "door_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "door_event_values_check" CHECK (
      "sequence" > 0 AND "amountCents" >= 0 AND jsonb_typeof("requestPayload") = 'object' AND
      jsonb_typeof("responseSnapshot") = 'object' AND
      (("type" = 'ADMISSION' AND "targetEventId" IS NULL AND "reason" IS NULL) OR
       ("type" = 'EXIT' AND "amountCents" = 0 AND "targetEventId" IS NULL AND "reason" IS NULL) OR
       ("type" = 'REVERSAL' AND "amountCents" = 0 AND "targetEventId" IS NOT NULL AND
        "targetEventId" <> "id" AND "reason" IS NOT NULL AND length(btrim("reason")) > 0))
    )
);
CREATE UNIQUE INDEX "door_event_id_nightId_venueId_key" ON "door_event"("id", "nightId", "venueId");
CREATE UNIQUE INDEX "door_event_nightId_sequence_key" ON "door_event"("nightId", "sequence");
CREATE UNIQUE INDEX "door_event_nightId_requestId_key" ON "door_event"("nightId", "requestId");
CREATE UNIQUE INDEX "door_event_targetEventId_key" ON "door_event"("targetEventId");
CREATE INDEX "door_event_actorId_idx" ON "door_event"("actorId");
ALTER TABLE "door_event" ADD CONSTRAINT "door_event_targetEventId_fkey" FOREIGN KEY ("targetEventId") REFERENCES "door_event"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- Prisma describes the self-relation; this extra key enforces its tenant/night boundary.
ALTER TABLE "door_event" ADD CONSTRAINT "door_event_target_same_night_fkey" FOREIGN KEY ("targetEventId", "nightId", "venueId") REFERENCES "door_event"("id", "nightId", "venueId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "reconciliation" (
    "nightId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "countedCashCents" INTEGER NOT NULL,
    "expectedCoverCents" INTEGER NOT NULL,
    "expectedDrawerCents" INTEGER NOT NULL,
    "floatCents" INTEGER NOT NULL,
    "varianceCents" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "closedBy" TEXT NOT NULL,
    "closedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responseSnapshot" JSONB NOT NULL,
    CONSTRAINT "reconciliation_pkey" PRIMARY KEY ("nightId"),
    CONSTRAINT "reconciliation_nightId_venueId_fkey" FOREIGN KEY ("nightId", "venueId") REFERENCES "night"("id", "venueId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "reconciliation_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "reconciliation_values_check" CHECK (
      "countedCashCents" >= 0 AND "expectedCoverCents" >= 0 AND "floatCents" >= 0 AND "expectedDrawerCents" >= 0 AND
      "expectedDrawerCents"::BIGINT = "floatCents"::BIGINT + "expectedCoverCents"::BIGINT AND
      "varianceCents"::BIGINT = "countedCashCents"::BIGINT - "expectedDrawerCents"::BIGINT AND
      jsonb_typeof("requestPayload") = 'object' AND jsonb_typeof("responseSnapshot") = 'object'
    )
);
CREATE UNIQUE INDEX "reconciliation_nightId_venueId_key" ON "reconciliation"("nightId", "venueId");
CREATE INDEX "reconciliation_closedBy_idx" ON "reconciliation"("closedBy");
