# B0.2 — Local PostgreSQL and reproducible synthetic seed

## Task

[Issue #5](https://github.com/ryandils/encore/issues/5), branch `feat/b0.2-local-postgres`, based on merged B0.1 commit `121e026e1e55a67610a4d321538f749aa29c52e5`. This is the local database slice of B0. GitHub owns current ownership, review, and merge status.

## Outcome

This draft adds the workflow for creating a dedicated local PostgreSQL service, applying checked-in Prisma migrations, and seeding two labeled synthetic identities repeatedly. Service startup is verified; the complete Prisma setup/seed/persistence path remains unverified because engine downloads are blocked. The [local database guide](../LOCAL_DATABASE.md) gives Windows/macOS setup, stop/resume, explicit destructive reset, and troubleshooting instructions. The setup landing page remains disconnected from the database and starts without credentials.

## Changes

- Added local Docker Compose PostgreSQL with a loopback-only published port and persistent named volume, plus `.env.example` using disposable local placeholders.
- Added Prisma identity storage: a Better Auth-shaped `User` and separate `DemoIdentity` fixture metadata. No passwords, sessions, login, venue authorization, or ledger models are implemented.
- Added portable TypeScript commands for initialization, client generation, migration, seed, status, shutdown, guarded reset, and integration verification. Reset requires an explicit local acknowledgement; database operations reject production mode and unsupported targets/options. Compose operations require and pin a local Unix-socket/Windows named-pipe Docker endpoint, rejecting remote/TCP contexts.
- The synthetic seed uses predictable `.invalid` identities in a transaction. Stable IDs and creation timestamps distinguish repeatable seeding from destructive recreation.
- Extended the shared manifest, lockfile, strict typechecking, lint/test configuration, and database verification while retaining Node 24, pnpm 12.18.0, and TypeScript 7.0.2. Prisma packages are pinned to 7.10.1; dependency build-script permission is limited to `prisma` and `@prisma/engines`. Both typecheck and build generate the untracked TypeScript client before using it.

## Verification

This change is intended for a **draft PR** while Prisma engine access blocks required verification. Evidence below was recorded on Linux with Node 24.22.1, pnpm 12.18.0, and TypeScript 7.0.2. Commands use `corepack pnpm` for the pinned manager. A passing baseline or raw SQL probe does not replace the outstanding Prisma acceptance checks.

| Check | Current evidence |
| --- | --- |
| Baseline `corepack pnpm run cloud:setup` | Passed on the unmodified merged B0.1 base. This is baseline evidence only. |
| `corepack pnpm install --frozen-lockfile` after dependency changes | Passed. |
| `corepack pnpm run doctor`, `run check`, and `run lint` | Passed; final lint covered 16 files, including the completed Docker-endpoint guard and build wrapper. |
| `corepack pnpm run test` | All 63 tests passed: 61 database guard/diagnostic/CLI/Docker-endpoint cases and two landing-page tests. The independent reviewer separately reproduced the preceding 44-test suite; final review is pending below. |
| `corepack pnpm run db:init`, `run db:up`, and `run db:status` | Passed: example environment initialized and pinned Compose PostgreSQL reported healthy on loopback port `54329`. Status also passed after local Docker-endpoint validation/pinning was added. |
| Migration SQL probe | The lead executed the migration's type/table/index/foreign-key DDL inside `BEGIN`/`ROLLBACK` through `psql` in the running Compose PostgreSQL service. SQL execution passed and persisted no schema. This is not Prisma migration acceptance. |
| `corepack pnpm run db:generate`, `run db:migrate`, and `run typecheck` | Blocked by HTTP 403 on proxy CONNECT to `binaries.prisma.sh`; required engines could not be downloaded. No pass claimed. |
| Fresh Prisma migration, seed twice, restart persistence, and permitted reset | Unverified pending engine access. The SQL probe and service health do not establish these behaviors. |
| `corepack pnpm run build` | Attempted; stopped during Prisma generation with the same engine-host HTTP 403. No build pass claimed. |
| `corepack pnpm run context:test` | Both context-gate regression tests passed. |
| Staged context and whitespace checks | After staging the handoff, corepack pnpm run context:check --base origin/main and git diff --cached --check both passed. The gate checks structure, not acceptance truth. |
| Independent review | Resolved the P2 remote-Docker-context finding with endpoint validation/pinning and regression tests. The independent reviewer reran all 63 tests and whitespace checks and reported no remaining substantive findings. Prisma-dependent acceptance remains blocked; review supports a draft PR only. |

Windows/macOS Docker Desktop flows are documented but have not been executed locally in this Linux chat. UI code is unchanged; no new browser check is claimed. Local identity persistence does not establish authentication, permissions, ledger concurrency, two-device behavior, backup/restore, deployment, or pilot readiness.

Current setup limitation: the pinned PostgreSQL image pulled successfully, but Prisma engine generation encountered HTTP 403 on the proxy CONNECT request to `binaries.prisma.sh`. The required host is documented; engine checksums remain enabled. Generation-dependent verification is pending network access or actual hosted-CI evidence, not reported as passing.

## Context impact

- `README.md`, `docs/QUICKSTART.md`, and new `docs/LOCAL_DATABASE.md` explain the real setup commands, synthetic records, prerequisites, destructive reset, and failure recovery.
- `docs/ARCHITECTURE.md` separates implemented identity storage from planned auth/domain contracts and states that demo roles grant no authorization.
- `AGENTS.md`, `docs/HARNESS.md`, and `docs/CLOUD_ENVIRONMENT.md` distinguish contributor checks, generated clients, and real PostgreSQL verification.
- `docs/CONTEXT.md` and `docs/BUILD_PLAN.md` reflect local database capability and retain the existing dependency sequence. Live status stays in GitHub.
- Product scope, ledger/API contracts, and pilot procedures are unchanged; `docs/MVP.md` and `docs/PILOT.md` need no edits.

## Learning note

A migration versions the database's structure; a seed supplies predictable fake data inside that structure. Repeating a seed should preserve the same identities, while resetting deliberately deletes data and reconstructs the schema. A generated Prisma client describes how code accesses the tables; generating it does not create those tables or prove that PostgreSQL is running.

## Next step

Keep the PR in draft and issue #5 in its actual blocked/incomplete state until Prisma engine access allows client generation, strict typechecking/build, and real migration/seed/restart/reset verification. Finish independent review, then seek human review/merge of B0.2. The coordinator will link the draft PR and actual evidence on issue #5. [B0.3 authentication and demo roles](https://github.com/ryandils/encore/issues/6) must wait for this prerequisite to merge and recheck ownership before starting; B1 remains responsible for full domain contracts/models. The local URL guard cannot detect a manually forwarded tunnel, and this development workflow is not a production migration or backup procedure.
