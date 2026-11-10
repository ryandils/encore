# Implementation direction and shared contracts

This is a design contract, not a description of existing code.

## Stack and structure

Use Next.js App Router, React, strict TypeScript 7 (pinned to 7.0.2), Tailwind CSS, PostgreSQL, Prisma, and Better Auth for server-managed email/password sessions. Pin supported compatible versions in B0; do not scatter independent scaffolds. No custom password cryptography. Email verification and password recovery need a configured provider before a real pilot; local demo must work with seeded fake accounts and no external services.

All authored source, including scripts/tests/configs where supported, uses .ts/.tsx. JavaScript source is rejected by the harness; generated runtime output and dependencies are excluded. Node 24 executes the erasable .ts harness; tsconfig.harness.json and pnpm run typecheck separately enforce types.

B0 must preserve the TypeScript 7 baseline and harness config, add a strict application tsconfig, and verify the chosen Next.js and library versions with the installed compiler. Do not silently fall back to TypeScript 5/6 if scaffolding selects older defaults.

Suggested layout:

- src/app: owner, door, auth, and route handlers.
- src/components: shared controls and presentation.
- src/domain: framework-independent event types, validation, and pure projections.
- src/server: authentication, authorization, transactional commands, and reads.
- prisma: schema, migrations, and synthetic seed data.
- tests: domain, API/database integration, and essential browser flows.

A future native client can reuse contracts and domain logic. Native UI is separate work. No AI runtime, payment SDK, SMS SDK, or analytics vendor is needed for B0-B5.

## Minimal entities

| Entity | Key fields |
| --- | --- |
| User | auth-library identity; no hand-built password fields |
| Venue | id, name, timezone, capacity |
| VenueMembership | venueId, userId, role OWNER or STAFF; unique pair |
| Night | id, venueId, label, status OPEN/CLOSED, openedAt, closedAt, startingOccupancy, openingFloatCents, currency USD, version |
| CoverPreset | venueId, slot 1..3, label, amountCents; unique venue/slot |
| NightAssignment | nightId, userId, startsAt, endsAt, revokedAt |
| StaffInvite | tokenHash, venueId, nightId, intendedEmail, expiresAt, consumedAt, revokedAt |
| DoorEvent | id, venueId, nightId, actorId, requestId, sequence, type, amountCents, targetEventId, reason, recordedAt |
| Reconciliation | nightId unique, countedCashCents, expectedCoverCents, floatCents, varianceCents, notes, closedBy, closedAt |

Staff invitations bind to the intended account email. Verify email ownership through the maintained auth flow before granting a real assignment; demo identities cannot bypass this in production. Invite consumption and assignment creation must be atomic. Staff authorization requires both venue membership and an active, unrevoked night assignment. Expiry uses server time. Owners may revoke access immediately.

## Ledger contract

Types:

- ADMISSION: occupancy delta +1 and an immutable nonnegative amountCents (0 means free).
- EXIT: occupancy delta -1, amountCents 0.
- REVERSAL: targets one original ADMISSION or EXIT in the same night, with reason. Apply the inverse to projections; the original stays stored.

MVP corrections reverse whole actions. To fix a wrong price, reverse and re-enter. Never reverse a reversal or reverse a target twice. Projections treat a reversed target as absent in its original sequence, then recompute peak and history. Reject any correction producing a negative occupancy anywhere in the effective sequence. Permit correction above capacity with a visible warning.

A server transaction locks the Night row, rechecks permission/status, validates the command, assigns the next monotonic sequence, inserts the event, and increments version. Serialize close under the same lock. Add uniqueness constraints for (nightId, sequence), (nightId, requestId), and reversal target. State is an event-derived projection, never a client-side overwritable total.

Retries must return the original result for an identical request ID and payload; a different payload with the same ID is a conflict. Authenticate/authorize before returning stored retry results. Idempotency lookup precedes the closed-night rejection so an already committed command can still be acknowledged after closing; no new event can be added after close.

## API shape

B1 turns these into exported TypeScript contracts shared by B2/B3. Field validation and authoritative calculations live on the server.

- POST /api/venues: create venue and owner membership atomically.
- POST /api/venues/:venueId/nights: open night; prevent multiple open nights per venue.
- PATCH /api/venues/:venueId/presets: owner-only price edits.
- POST /api/nights/:nightId/invites: create staff invite; return secret link once.
- POST /api/invites/accept: consume a token after account authentication/verification.
- DELETE /api/nights/:nightId/assignments/:userId: owner revokes access.
- POST /api/nights/:nightId/events: admission, exit, or reversal command with requestId.
- GET /api/nights/:nightId/door-state: occupancy, version, presets, recent permitted actions, last server sync time; no reconciliation data.
- GET /api/nights/:nightId/summary: owner financial/traffic summary.
- POST /api/nights/:nightId/close: owner-only countedCashCents and notes, idempotent requestId.
- GET /api/nights/:nightId/export: owner-only CSV.

Use integer cents, UUIDs, server UTC timestamps, and venue timezone for display. Reject nonintegers, negative admission amounts, and unsupported currency. Error responses include a stable code and user-readable message; distinguish unauthenticated, forbidden, validation, duplicate-payload conflict, and closed-night failures. Return authoritative version and state after successful writes.

Closing captures an immutable reconciliation snapshot in the same transaction as closing the night. A repeated identical close request returns the original result; a different request cannot overwrite it. Owner reopening/revised reconciliations are deferred.

## Connectivity and operation

Online-first: persist each action on the backend, poll active screens within 3 seconds, refresh on focus, and mark data stale after 10 seconds without successful synchronization. Serialize local taps without dropping intentional repeated admissions. Retain each submitted request ID until its outcome is known; a retry reuses it. A new intentional tap gets a new ID.

An unknown network result may have committed: reconcile the same request before encouraging a second tap. Display pending actions separately from acknowledged counts. Do not add an offline queue that implies cross-device consistency. Provide a clear physical-clicker fallback and reconcile unresolved requests before closing.

Starting occupancy supports opening after doors are already active, but those earlier people have unknown cover. Starting occupancy never creates cash revenue. Show that limitation in the summary.

## Access and data handling

Server authorization on every route and command, scoped joins by venue, and no finance fields in staff responses. Use secure session cookies, CSRF protection appropriate to the auth framework, rate limits on auth/invites/writes, hashed invite tokens, and server-derived actor IDs. No public occupancy endpoint.

The anonymous ledger needs no patron PII. Staff emails stay within account/access controls; no phone lists, marketing consent, or guest tracking in this build. Redact credentials and invite tokens from logs. Exports must escape CSV formula injection and quote fields properly.

For the first pilot: encrypted transport, persistent managed database, backup/restore procedure, verified access controls, configured verification/recovery email, and an owner-visible data deletion/export path. Document retention as a pilot decision; do not retain real data indefinitely by accident.

## Decisions recorded

- Responsive web first, matching the final direction in the conversation.
- Cash recorded, never processed. No promise that recorded totals prove actual cash collection.
- One shared door cash pool; no bar sales, tips, or payouts mixed in.
- Counts are operational estimates. Keep ordinary ID checks, venue procedures, and authority requirements.
- No forecasting until enough comparable nights exist and accuracy can be measured.
