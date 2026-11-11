# Implementation direction and shared contracts

The Next.js/React/Tailwind setup landing page, strict TypeScript 7 checks, local PostgreSQL/Prisma storage, and Better Auth sessions for synthetic local accounts exist. B1 adds pure ledger projections, shared API contracts/fixtures, and domain database models. Production authentication, live domain routes, transactional commands, and venue/night permission enforcement remain later build-plan work.

## Stack and structure

Use Next.js App Router, React, strict TypeScript 7 (pinned to 7.0.2), Tailwind CSS, PostgreSQL, Prisma, and Better Auth for server-managed email/password sessions. Pin supported compatible versions in B0; do not scatter independent scaffolds. No custom password cryptography. Email verification and password recovery need a configured provider before a real pilot; local demo must work with seeded fake accounts and no external services.

All authored source, including scripts/tests/configs where supported, uses .ts/.tsx. JavaScript source is rejected by the harness; generated runtime output and dependencies are excluded. Node 24 executes the erasable .ts harness; tsconfig.harness.json and pnpm run typecheck separately enforce types.

Preserve the TypeScript 7 baseline, strict harness config, and strict application tsconfig. Verify framework and library updates with the installed compiler; do not silently fall back to TypeScript 5/6.

The scaffold pins Next.js 16.4.5, React 19.3.1, and Tailwind CSS 4.3.5 in the shared manifest/lockfile. `next.config.ts` enables Next's `experimental.useTypeScriptCli` integration so builds use TypeScript 7's native CLI without disabling type checks. `experimental.strictRouteTypes` makes generated `next-env.d.ts` import the active route declarations and validator; the app tsconfig does not glob both development and production generated types, which would duplicate their global declarations after using both modes. `pnpm run typecheck` generates route declarations and checks the harness, app, tests, and supported configs. Biome performs app linting; Vitest runs the landing-page tests. The PostCSS plugin mapping is declarative JSON because Next's loader supports it without authored JavaScript.

Suggested layout:

- src/app: owner, door, auth, and route handlers.
- src/components: shared controls and presentation.
- src/domain: framework-independent event types, validation, and pure projections.
- src/server: authentication, authorization, transactional commands, and reads.
- prisma: schema, migrations, and synthetic seed data.
- tests: domain, API/database integration, and essential browser flows.

A future native client can reuse contracts and domain logic. Native UI is separate work. No AI runtime, payment SDK, SMS SDK, or analytics vendor is needed for B0-B5.

## Implemented local identity storage

B0.2 establishes identity fixtures, and B0.3 adds the maintained authentication library's account, session, and verification storage. B1 extends that storage with the domain models below while preserving the authentication models and existing migrations. See [local database setup](LOCAL_DATABASE.md) for migrations, seed, reset boundaries, and restart verification.

| Model | Stored fields and constraints |
| --- | --- |
| `User` | String identity ID, name, unique email, `emailVerified` defaulting to false, optional image, creation/update timestamps. Better Auth identity with relations to accounts and sessions; passwords are not stored on this model. |
| `DemoIdentity` | One profile per user (`userId` primary key and relation), `DemoRole` (`OWNER` or `STAFF`), and an explicit synthetic label. |
| `Account` | Better Auth account/provider linkage and maintained password hash for credential accounts. |
| `Session` | Better Auth persisted session token, user relation, and expiry. |
| `Verification` | Better Auth verification storage; real-user verification/recovery flows remain unconfigured. |

The seed uses stable synthetic IDs and reserved `.invalid` emails, writing both identities and their demo metadata in a transaction. Repeating it preserves identity IDs and creation timestamps. `DemoIdentity.role` is fixture metadata only: it must never substitute for `VenueMembership`, an active `NightAssignment`, or server authorization. B1 adds the domain contracts and models. The separate `auth:seed` command creates credential accounts with Better Auth hashing, preserves existing hashes/timestamps on repeats, and rejects conflicts. `db:seed` itself remains password-free.

Prisma and its PostgreSQL adapter are pinned together in the manifest/lockfile. Generated TypeScript client output is untracked under `.generated/prisma`, outside `node_modules` so Node 24 can execute it with type stripping. Both typechecking and the build command generate the client first, so a fresh install does not depend on a prior command's generated output; generation requires no live database. Local migration/seed/reset commands reject production mode and targets outside the dedicated loopback database; reset additionally requires an explicit acknowledgement. The fixed local URL is a development boundary, not a production migration/deployment mechanism. The web landing page does not import the client, read the database, or expose seeded identities.

## Implemented local authentication boundary

Better Auth 1.7.20 uses the Prisma adapter for real email/password sessions. Its public declarations reference `bun:sqlite`; the pinned `bun-types` 1.4.4 development dependency supplies only `bun-types/sqlite` to the harness and app TypeScript configurations. Node remains the runtime, and strict checking with `skipLibCheck: false` stays enabled; Bun runtime globals are not introduced. A pure local-database target validator is shared by web and CLI code; filesystem/process CLI helpers are kept out of the web bundle. The lazy server factory requires an explicit HTTP loopback `BETTER_AUTH_URL`, generated `BETTER_AUTH_SECRET`, and the dedicated local database URL. No client-supplied role or actor is trusted. Production mode rejects all authentication and demo entry points before database access, including `next start`; this milestone does not provide production login.

`/api/auth/[...all]` exposes the bounded local sign-in, sign-out, and session flow. Public signup is disabled; origin/CSRF checks and authentication rate limiting remain enabled. Cookie caching is disabled so server session reads consult the database. `/api/demo/session` returns only the authenticated synthetic identity and demo role; protected `/demo/owner` and `/demo/staff` navigation derives that role on the server. These checks protect the synthetic demo only and are not B4 venue membership or active-night assignment enforcement.

`auth:init` generates a random local signing secret and distinct random owner/staff passwords into ignored `.env`, without printing or overwriting existing values. `auth:seed` hashes those passwords with the maintained library. No shared signing secret or login password is committed. Real-user email verification, password recovery, and a configured delivery provider are required before a pilot; no provider or outbound messaging is configured here.

## Domain entities and persistence boundary

| Entity | Key fields |
| --- | --- |
| User | auth-library identity; no hand-built password fields |
| Venue | id, name, timezone, capacity |
| VenueMembership | venueId, userId, role OWNER or STAFF; unique pair |
| Night | id, venueId, label, status OPEN/CLOSED, openedAt, closedAt, startingOccupancy, openingFloatCents, currency USD, version, capacity/timezone snapshots |
| CoverPreset | venueId, slot 1..3, label, amountCents; unique venue/slot |
| NightAssignment | nightId, userId, startsAt, endsAt, revokedAt |
| StaffInvite | tokenHash, venueId, nightId, intendedEmail, expiresAt, consumedAt, revokedAt |
| DoorEvent | id, venueId, nightId, actorId, requestId, sequence, type, amountCents, targetEventId, reason, recordedAt, requestPayload, responseSnapshot |
| Reconciliation | nightId unique, requestId, countedCashCents, expectedCoverCents, floatCents, expectedDrawerCents, varianceCents, notes, closedBy, closedAt, requestPayload, responseSnapshot |

The `20261110220000_domain_ledger` migration adds these tables without replacing the existing identity/authentication migrations or seeding live domain data. Domain IDs use PostgreSQL UUID columns; auth-library user IDs remain strings. A night snapshots the venue capacity and timezone so later venue edits do not reinterpret historical turns or arrival buckets.

Database constraints enforce one OPEN night per venue, unique membership/preset slots, one reconciliation per night, unique event sequence/request IDs and reversal targets, same-night/venue reversal links, valid event shapes, nonnegative money/counts, USD, and reconciliation arithmetic. Domain/audit foreign keys restrict cascading deletion. The partial OPEN-night index, extra same-night reversal foreign key, and SQL CHECK constraints live in the migration; retain them when evolving Prisma. The database does not validate complete event replay, authorize actors, or enforce append-only access by itself. Those runtime responsibilities remain B4 work.

`DoorEvent` and `Reconciliation` retain `requestPayload` and `responseSnapshot` JSON objects for B4 to save the validated original command and original result in the same transaction. These columns are storage contracts, not a working idempotency implementation. Do not store session secrets or invite tokens in receipts. B4 must validate their exact structure and financial visibility before persistence or replay.

Staff invitations bind to the intended account email. Verify email ownership through the maintained auth flow before granting a real assignment; demo identities cannot bypass this in production. Invite consumption and assignment creation must be atomic. Staff authorization requires both venue membership and an active, unrevoked night assignment. Assignments have a required end time later than their start time; B4 must choose and enforce that bounded interval when an invite is accepted. Expiry uses server time. Owners may revoke access immediately.

## Ledger contract

`src/domain/types.ts` exports `NightLedgerInput`, the discriminated `DoorEvent` union, `LedgerProjection`, and `ReconciliationProjection`. `projectLedger(input, events)` and `reconcileLedger(input, events, countedCashCents)` in `src/domain/ledger.ts` are pure functions: they do not authenticate, authorize, persist, or accept a live command.

Stored event types:

- ADMISSION: occupancy delta +1 and an immutable nonnegative amountCents (0 means free).
- EXIT: occupancy delta -1, amountCents 0.
- REVERSAL: targets one original ADMISSION or EXIT in the same night, with reason. Apply the inverse to projections; the original stays stored.

MVP corrections reverse whole actions. To fix a wrong price, reverse and re-enter. Never reverse a reversal or reverse a target twice. Projections treat a reversed target as absent in its original sequence, then recompute peak and history. Reject any correction producing a negative occupancy anywhere in the effective sequence. Permit correction above capacity with a visible warning.

The B4 runtime must implement this transaction boundary: lock the Night row, recheck permission/status, validate the command, assign the next monotonic sequence, insert the event, and increment version. Serialize close under the same lock. The schema supplies uniqueness constraints for `(nightId, sequence)`, `(nightId, requestId)`, and reversal target. It does not implement this transaction or make direct SQL writes append-only. State is an event-derived projection, never a client-side overwritable total.

The pure validator accepts canonical lowercase UUIDs for domain/request IDs and opaque nonempty strings for authentication user IDs. Currency is USD. Amounts, float, capacity, sequence, and counts use PostgreSQL-compatible signed 32-bit integer bounds; nonnegative fields are limited to 0–2,147,483,647, and sequences start above zero. Projection totals are checked for overflow. Variance can be negative. API timestamps use valid UTC ISO strings with seconds and optional millisecond precision.

Server sequence controls replay and peak occupancy, even if recorded timestamps move backward. Input arrays may be unordered; duplicate IDs, request IDs, sequences, and mixed venue/night histories are rejected. Validation checks each accepted prefix as well as every reversal's recomputed effective history, so a later correction cannot hide an earlier impossible negative count. Starting occupancy contributes to occupancy and peak only, never revenue. Above-capacity counts remain valid and set a warning flag; capacity zero produces `null` turns. Arrival buckets retain UTC identity and an explicit venue offset, keeping repeated daylight-saving quarter-hours distinct.

Retries must return the original result for an identical request ID and payload; a different payload with the same ID is a conflict. Authenticate/authorize before returning stored retry results. Idempotency lookup precedes the closed-night rejection so an already committed command can still be acknowledged after closing; no new event can be added after close.

## API shape

B1 exports TypeScript contracts and synthetic fixtures shared by B2/B3. The routes below define the shared API. Local-only HTTP handlers implement ledger operations plus venue/night configuration and invitations; export delivery remains outstanding. Every handler validates fields and enforces server authorization; production is denied.

- POST /api/venues: create venue and owner membership atomically.
- POST /api/venues/:venueId/nights: open night; prevent multiple open nights per venue.
- PATCH /api/venues/:venueId/presets: owner-only price edits.
- POST /api/nights/:nightId/invites: create staff invite; return secret link once.
- DELETE /api/nights/:nightId/invites/:inviteId: cancel a pending invitation; accepted access uses assignment revocation.
- POST /api/invites/accept: consume a token after account authentication/verification.
- DELETE /api/nights/:nightId/assignments/:userId: owner revokes access.
- POST /api/nights/:nightId/events: admission, exit, or reversal command with requestId.
- GET /api/nights/:nightId/door-state: occupancy, version, presets, recent permitted actions, last server sync time; no reconciliation data.
- GET /api/nights/:nightId/summary: owner financial/traffic summary.
- POST /api/nights/:nightId/close: owner-only countedCashCents and notes, idempotent requestId.
- GET /api/nights/:nightId/export: owner-only CSV.

`src/domain/contracts.ts` exports `LedgerApi`, its command/result types, stable `ApiErrorCode` values, and runtime command parsers. Parsers reject unsupported fields rather than accepting client-supplied actors, roles, or computed totals. `DoorState` exposes the current night, occupancy, presets, scoped recent actions, and sync time. `OwnerSummary` additionally carries float, financial/traffic projections, and reconciliation; it must not be returned to staff.

A paid `ADMISSION` command sends `presetSlot` and `expectedAmountCents`, not an authoritative price. B4 reads that preset under the night transaction and rejects a stale expectation with `STALE_PRESET`. `FREE_ADMISSION` is a separate command that becomes a stored `ADMISSION` with zero cents. EXIT carries no money; REVERSAL identifies its target and reason. A new intentional tap gets a new UUID request ID. `eventRequestPayload` and `closeRequestPayload` produce canonical comparison strings for validated retry inputs, including night scope; they do not grant authorization.

`createLedgerFixtures()` in `src/domain/fixtures.ts` creates fresh labeled examples of the venue/night, original and edited presets, effective event history, staff state, owner summary, closeout, commands, invitation/assignment responses, and CSV response. Every consumer must show `SYNTHETIC_FIXTURE_LABEL`. The reserved `.invalid` invite URL and example token are inert; these fixtures are not seeded credentials, real assignments, or a functioning `LedgerApi` adapter. They demonstrate the $55 cover / $155 drawer / -$5 variance acceptance scenario without claiming live persistence or authorization.

`src/server/ledger-contract.ts` exports the internal `TransactionalLedgerCommands` interface. An authenticated server supplies its user context; it is not constructed from request-body identity fields. Besides membership/night assignment enforcement, B4 must enforce staff undo eligibility: their own latest uncorrected action, no more than 60 seconds old, while the night is open. Owner corrections still require a reason. The interface does not register routes or execute a transaction.

Use integer cents, UUIDs, server UTC timestamps, and venue timezone for display. Reject nonintegers, negative admission amounts, and unsupported currency. Error responses include a stable code and user-readable message; distinguish unauthenticated, forbidden, validation, duplicate-payload conflict, and closed-night failures. Return authoritative version and state after successful writes.

Closing captures an immutable reconciliation snapshot in the same transaction as closing the night. A repeated identical close request returns the original result; a different request cannot overwrite it. Owner reopening/revised reconciliations are deferred.

## B2 synthetic door console

`/demo/door` mounts the isolated phone-first console with an in-memory adapter from `src/features/door`. The server route rejects production before rendering. It deliberately needs no session because every record is a labeled synthetic fixture; this grants no real venue access and does not replace the protected sign-in demos.

The console consumes only `LedgerApi.doorState` and `LedgerApi.recordEvent`. Its controller serializes intentional taps, keeps pending actions separate from acknowledged occupancy, preserves request IDs on retry, and halts new actions after an uncertain result until reconciled. It polls and refreshes through the adapter; an unavailable or stale snapshot is visibly identified. No aggregate cover, float, reconciliation or owner configuration is exposed in the staff view. Undo asks for confirmation and a reason, with eligibility supplied by the adapter.

The fixture starts at zero occupancy with B1's original presets. It projects synthetic events with the shared pure ledger and simulates failed acknowledgements without claiming server persistence or authorization. Refresh resets the isolated fixture; B4 must replace the adapter with authorized transactional endpoints and verify concurrent devices. Existing B1 contracts, schema and authentication are unchanged.

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

## Owner fixture rehearsal boundary

`/demo/owner-rehearsal` is a production-disabled, database-free screen with synthetic local state, separate from session-backed `/demo/owner`. `src/features/owner/fixture-model.ts` consumes B1 command parsers and ledger/reconciliation functions without changing the shared contracts. Immutable client snapshots preserve historical charged amounts and closed results for this page session. Closing rejects later local writes; CSV escapes fields and formula-like text. Simulated invites use reserved `.invalid` recipients and inert links; accepting or revoking them grants no real permissions.

This UI is a rehearsal for B3, not a server API implementation. Refresh discards state, and separate tabs/devices and the B2 door fixture do not synchronize. B4 must replace local operations with authorized, transactional persistence before operational use. No schema, migration, authentication, or package changes are required by this rehearsal.

## Shared CSV formatting boundary

`src/domain/csv-export.ts` provides a pure CSV formatter over a scoped owner summary and ledger history. It quotes fields, escapes embedded quotes, and neutralizes formula-like text while preserving integer-cent numeric values. The existing synthetic owner export reuses it with the synthetic flag and filename preserved. Formatting is not authorization: future HTTP exports must derive the owner from a verified session and load only that owner's venue/night records. No protected export endpoint, production data access, or pilot acceptance is introduced by this extraction.

## B4 transactional kernel boundary

`PostgresLedgerService` implements internal `record`/`close` commands plus `doorState` and owner-only `summary` using the existing `pg` dependency and domain tables. Each operation locks the night row, checks venue membership and an active staff assignment, then evaluates server time after permission locks. Membership/assignment locks protect the authorization decision through commit. All future assignment and preset mutation services must use a compatible lock order: night first, then permission/preset rows.

Events, version changes and canonical request/response receipts commit together. Closing takes the same night lock and stores an immutable reconciliation/receipt. Identical authorized retries return the original snapshot before closed-night rejection; changed payload or actor conflicts. Event receipts scope recent actions to the actor even for owners, so demotion cannot disclose other actors through an old receipt. Full owner history remains available through owner-authorized reads. Paid commands read the stored preset, while historical charges remain on events.

The service takes an internal authenticated context; it does not validate a browser session or register HTTP routes. It adds no production auth, invitations, live adapters, export endpoint or two-device acceptance. Future routes must derive identity from verified sessions and add transport-level protections. The integration verifier uses guarded disposable local PostgreSQL and synthetic records, not venue data.

## Local authenticated ledger HTTP boundary

The B4 local integration exposes `GET /api/nights/[nightId]/door-state`, `GET /api/nights/[nightId]/summary`, `POST /api/nights/[nightId]/events` and `POST /api/nights/[nightId]/close`. Better Auth validates the session on the server; the authenticated user ID is supplied to the PostgreSQL kernel, which independently checks venue membership/assignment. Client actors, roles, venue IDs and totals are rejected by command parsers. Responses use the shared `ApiResult` shape and `Cache-Control: no-store`; unavailable backend/authentication returns a generic `UNAVAILABLE` error without internal diagnostics.

Writes require the configured local origin and bounded JSON bodies. A bounded per-process account throttle protects this local slice; it is not a distributed production rate limiter. Every route returns 404 before authentication/database work in production. Setup/access operations share this boundary as described below. No production auth, live screen adapter, protected export or two-device pilot acceptance is provided by these routes. The HTTP integration verifier uses separate real synthetic session cookies and local PostgreSQL, not physical devices.

## Local venue and staff access services

`VenueAccessService` creates venue/owner/presets atomically, opens one active night per venue, and serializes preset changes with the active night. Opening serializes on the venue with `FOR NO KEY UPDATE`, authorizes the owner and rejects an existing open night. Preset updates take that venue lock, then the active night, then membership/presets. Night access operations lock night first and never take the venue lock afterward. This is compatible with the ledger kernel; preset edits advance active-night version without changing stored admission charges.

The owner receives a random 32-byte invitation token once in a fragment-only URL, keeping it out of request paths/referrers; only its SHA-256 hash is stored. Tokens expire after one hour. Acceptance locks and rechecks the token and database account, requires the intended normalized email and `emailVerified=true`, never downgrades an owner, and atomically consumes the token plus grants a 12-hour staff assignment. The fragment link is an API artifact; no acceptance page, delivery provider or verification bypass is added. Seeded demo accounts remain subject to their actual verification state.

Pending invitation cancellation is owner-only and idempotently preserves its first revocation timestamp. A consumed invitation cannot be canceled as a substitute for revoking staff access. Assignment revocation marks the assignment and cancels outstanding invites for that recipient/night under the same night lock, preventing an older link from silently regranting access. Closed nights reject new night-scoped access mutations. No outbound messages are sent.
