# B4 — transactional ledger kernel

## Task

First focused implementation slice of #11 on `feat/b4-backend-permissions`. This does not complete the B4 milestone.

## Outcome

Internal PostgreSQL reads and commands authorize venue membership and staff night assignment, record immutable events with retry receipts, and close a night with a reconciliation in the same serialized transaction. Run `pnpm run ledger:service:verify` against migrated disposable local PostgreSQL.

## Changes

`src/server/ledger-service.ts` implements the existing command interface and scoped reads using the existing `pg` dependency. Night row locks serialize commands and closing; permission and preset locks protect decisions until commit. Server time is sampled after permission locks. Staff corrections require their own latest uncorrected action within 60 seconds. Event responses store actor-scoped history so a later role demotion cannot reveal other actors' history through retries.

No schema migration or dependency change is required. CI's PostgreSQL job now runs the service integration verifier. It creates and removes uniquely identified synthetic fixtures and does not reset the database.

## Verification

Local Linux Node 24.22.1/pnpm 12.18.0: frozen cloud bootstrap, strict TypeScript 7.0.2 checks, doctor/check, lint (62 files), all 187 database-free tests and optimized build passed. Final production HTTP checks passed. Fresh pinned PostgreSQL 17.7 startup and migrations passed; the kernel verifier passed against real PostgreSQL, including its concurrent connections and fresh-pool persistence check. The first native Node execution exposed non-erasable constructor properties, which were corrected; the next run exposed an order-sensitive JSON comparison, corrected to structural equality because PostgreSQL JSONB normalizes key order. Staged context gate against origin/main and whitespace checks passed. The existing schema verifier passed 36 PostgreSQL constraint rejection checks. Final lint and strict typecheck passed after the native-execution fix. Independent final review found no unresolved findings. The task-created database container was stopped with its volume retained; synthetic verifier records were removed. Hosted CI has not yet been observed for this PR.

Independent source review resolved role-demotion receipt disclosure and time sampling before authorization locks. Integration assertions cover wrong-venue access, missing/future/expired/revoked assignments, negative occupancy rollback, immutable pricing, concurrent duplicate/distinct requests, correction eligibility, close races and fresh-connection receipt persistence. These assertions executed successfully against local PostgreSQL. No HTTP session or real-device convergence was tested.

## Context impact

README and LOCAL_DATABASE document the new verifier and its temporary records. ARCHITECTURE describes locks, receipts, authorization and internal-only boundaries. CONTEXT and AGENTS distinguish implemented internal authorization from missing live endpoints. HARNESS describes the new CI coverage. Shared command interface comments now point to its implementation.

## Learning note

A database transaction holds the night lock while it validates and saves an action. A second device must wait, so two exits cannot both consume the same last occupant. A retry uses the original request ID to return its stored result rather than adding another action.

## Next step

B4 still needs authenticated HTTP routes, venue/night setup and invitation/revocation services, live screen adapters, protected CSV, production verification/recovery configuration, and a separately authenticated two-device rehearsal. The kernel accepts a server-authenticated context; callers must never take actor identity from browser input. #12 remains blocked. No production or physical-device acceptance is claimed.
