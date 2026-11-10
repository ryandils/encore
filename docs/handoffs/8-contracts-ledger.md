# B1 / #8 — Shared contracts and door ledger

## Task

[#8](https://github.com/ryandils/encore/issues/8), implemented on `feat/b1-contracts-ledger` from merged foundation commit `a555c695f8082d35d40ba74194d734f6659a597d`. This is a reviewable B1 change, not a merge or milestone-completion claim. The user authorized starting B1 while #7's native macOS acceptance remained outstanding. That separate platform evidence is not supplied by this change.

## Outcome

B2/B3 receive framework-independent door-event types, validated API contracts, and labeled synthetic fixtures. Pure functions calculate occupancy, admission totals, traffic, and closeout amounts from an auditable event history. Prisma models and a new migration establish the domain storage constraints while preserving the merged authentication schema.

Run `pnpm run test` for database-free ledger and contract tests. After the ordinary local database setup and migrations, run `pnpm run ledger:verify` for separate PostgreSQL constraint verification. These building blocks do not add a door screen, owner dashboard, live domain HTTP endpoint, or shared two-device ledger.

## Changes

- `src/domain/types.ts`, `validation.ts`, and `ledger.ts` define immutable charged amounts, sequence-ordered replay, corrections, int32 bounds, and offset-aware arrival buckets. Corrections remove their original action from the effective history; every resulting occupancy prefix must remain nonnegative.
- Shared contracts and synthetic fixtures distinguish staff door state from owner financial summaries. Server command interfaces describe future transaction behavior without implementing B4 permissions or persistence.
- Domain Prisma storage includes venue/night relationships, immutable-history fields, request/response receipts for future retries, and per-night capacity/timezone snapshots. A new migration adds uniqueness, tenant-consistent relations, and shape/range checks.
- `ledger:verify` is wired into the existing Ubuntu database CI job after migration/persistence verification; it does not add a separate service or replace the authentication checks.
- The documented acceptance calculation remains five admissions, one exit, occupancy and peak 4, cover 5500 cents, expected drawer 15500 cents, turns 0.05, and variance -500 cents when 15000 cents is counted.

## Verification

Local Linux verification reported by the lead, using Node 24.22.1, pnpm 12.18.0, and strict TypeScript 7.0.2:

- `corepack pnpm run cloud:setup` passed frozen installation, doctor, compiler version, strict checks, repository checks, and both context-gate regression tests.
- Prisma schema validation/client generation and the integrated `pnpm run typecheck` passed. The integrated typecheck was rerun successfully after correcting a test return type.
- `pnpm run lint` passed for 45 files. All 166 unit tests passed: 65 ledger, five contract, and 96 existing tests.
- `pnpm run build` passed. `pnpm run production:verify` passed: the public home returned HTTP 200 while demo/auth routes returned HTTP 404 with deliberately invalid configuration.
- `pnpm run doctor` and `pnpm run check` passed.
- Independent review has no remaining substantive findings. The CSV fixture field mismatch was corrected and covered by assertions.

Local PostgreSQL integration reported by the lead:

- Preflight found no existing environment file, containers, or volumes. `pnpm run db:init`, `pnpm run db:up`, and `pnpm run db:migrate` passed against the fresh task-owned local database.
- `pnpm run ledger:verify` passed 36 actual PostgreSQL constraint rejections, valid synthetic relations/events/reconciliation, preservation of original admission prices after a preset edit, and rollback cleanup. No reset was performed.

- `db:verify` passed migrations, two identical identity seeds, and restart persistence with two synthetic users. `auth:init` and `auth:seed` passed; `auth:verify` passed real HTTP/PostgreSQL session and credential-seed checks, including rejected anonymous/forged/expired/revoked sessions, origin checks, disabled signup, and sign-out invalidation.

`db:down` stopped the task database while retaining its volume. The staged `context:check --base origin/main` and whitespace checks passed. Hosted CI will be reported separately on the PR for its exact commit. No UI changed, so the local browser walkthrough was not rerun. No native macOS walkthrough is claimed.

## Context impact

`README.md`, `AGENTS.md`, `docs/CONTEXT.md`, and `docs/BUILD_PLAN.md` distinguish implemented pure/schema contracts from live backend work. `docs/ARCHITECTURE.md` records the exported contract and persistence boundary. `docs/HARNESS.md` and `docs/LOCAL_DATABASE.md` describe domain tests and the separate database verification command. Existing product invariants and UI behavior are unchanged.

## Learning note

The same event history can answer different questions: an exit lowers occupancy without subtracting cover, while a reversal removes an original action from the effective history and recomputes both. Saving the price on each admission keeps later preset edits from changing earlier cash totals.

## Next step

Human review and merge precede dependent B2/B3 screen implementation. B4 must implement server authorization, locked writes/close, retry result retrieval, invite consumption, and live endpoints. Database constraints and pure tests do not prove those behaviors. The native macOS baseline walkthrough remains tracked separately in #7; no issue closure, deployment, or parent milestone completion is part of this work.
