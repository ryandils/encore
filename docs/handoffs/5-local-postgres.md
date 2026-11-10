# B0.2 — Local PostgreSQL and reproducible synthetic seed

## Task

[Issue #5](https://github.com/ryandils/encore/issues/5), [PR #22](https://github.com/ryandils/encore/pull/22), branch `feat/b0.2-local-postgres`, based on merged B0.1 commit `121e026e1e55a67610a4d321538f749aa29c52e5`. This is the local database slice of B0. GitHub owns current ownership, review, and merge status.

## Outcome

A contributor can create a dedicated local PostgreSQL service, apply checked-in Prisma migrations, and seed two labeled synthetic identities repeatedly. Hosted Ubuntu CI verified migration, two seeds, exact record/timestamp preservation across PostgreSQL restart, and confirmed reset/reseed. The [local database guide](../LOCAL_DATABASE.md) gives Windows/macOS setup, stop/resume, explicit destructive reset, and troubleshooting instructions. The landing page remains disconnected from the database and starts without credentials.

## Changes

- Added PostgreSQL 17.7 Alpine pinned by image digest, a loopback-only published port, and a persistent named volume. The `.env.example` values are public disposable local placeholders.
- Added Prisma 7.10.1 identity storage: a Better Auth-shaped `User` and separate `DemoIdentity` fixture metadata. No passwords, sessions, login, venue authorization, or ledger models are implemented.
- Added portable TypeScript commands for initialization, client generation, migration, seed, status, shutdown, guarded reset, and integration verification. Database operations reject production mode and unsupported targets/options; reset also requires explicit acknowledgement. Compose operations validate and pin a local Unix-socket/Windows named-pipe endpoint, rejecting remote/TCP contexts.
- The transactional seed uses stable `.invalid` identities and preserves their IDs and timestamps. Conflicting reserved IDs/emails fail rather than taking over other records.
- Extended dependencies, strict typechecking, lint/test configuration, and CI while retaining Node 24, pnpm 12.18.0, and TypeScript 7.0.2. Dependency build-script permission is limited to `prisma` and `@prisma/engines`. Typecheck and build generate the untracked TypeScript client before using it; no live database or credentials are needed for those commands.

## Verification

[Hosted CI run 42887120882](https://github.com/ryandils/encore/actions/runs/42887120882) passed all four jobs for implementation head `34086b86ceb99404faba59533615c554e1f4e245`. This handoff's evidence update changes documentation only. Local checks used Linux, Node 24.22.1, pnpm 12.18.0, and TypeScript 7.0.2; hosted runners used Node 24.22.2.

| Check | Actual evidence |
| --- | --- |
| Frozen install, doctor, repository check | Passed in the cloud checkout and all three hosted OS jobs. |
| `cloud:setup` including generation, compiler version, strict typecheck, and context regression tests | Passed on hosted Ubuntu, Windows, and macOS. TypeScript remained 7.0.2 with strict checking enabled. |
| Lint and tests | Local lint passed for 16 files; all 63 tests passed (61 database guard/diagnostic/CLI cases and two landing tests). Hosted lint/tests also passed on all three operating systems. |
| Optimized application build | Passed on all three hosted operating systems; no database credentials were supplied to the baseline jobs. |
| Local PostgreSQL lifecycle | `db:init`, `db:up`, and `db:status` passed in the cloud checkout, reporting a healthy service at loopback port 54329. `db:down` passed and retained the named volume. |
| Real Prisma database acceptance | Hosted Ubuntu generated the client, migrated a fresh PostgreSQL database, seeded twice, verified exact records/timestamps and two total identities after restart with a fresh connection, reapplied migration, then confirmed reset/remigration, reseed, and shutdown. |
| Migration SQL probe | The cloud checkout additionally executed migration DDL inside a rolled-back PostgreSQL transaction. This syntax probe is separate from the hosted Prisma evidence. |
| Context and whitespace | After staging the handoff, `context:check --base origin/main` and `git diff --cached --check` passed. Both local context-gate regression tests and hosted context gates passed. |
| Independent review | Resolved a P2 remote-Docker-context finding with endpoint validation/pinning. Reviewer independently reproduced 63 tests, accepted the environment-type correction, and found no remaining substantive code issues. |

The first hosted run exposed that Next.js augments `ProcessEnv` with required `NODE_ENV`, conflicting with intentionally incomplete guard-test inputs. Helpers now explicitly accept optional environment dictionaries; runtime checks remain intact. The subsequent full CI run passed.

Local limitation: generation, migration, typecheck, and build were attempted in this cloud checkout but stopped because its proxy returns HTTP 403 for `binaries.prisma.sh`. No engine checksum verification was bypassed. The hosted runs supply the successful Prisma/typecheck/build/database evidence; they do not mean this checkout's network setting was changed. Enable that host for future cloud Prisma work.

Native Windows/macOS Docker Desktop database flows are documented but were not exercised: those platforms ran baseline/guard/typecheck/build CI, while real PostgreSQL integration ran on Ubuntu. UI source is unchanged, so no new browser check was needed. These checks do not establish authentication, permissions, ledger concurrency, two-device behavior, backup/restore, deployment, or pilot readiness.

## Context impact

- `README.md`, `docs/QUICKSTART.md`, and new `docs/LOCAL_DATABASE.md` explain commands, synthetic records, prerequisites, reset, and failure recovery.
- `docs/ARCHITECTURE.md` separates implemented identity storage from planned auth/domain contracts and states that demo roles grant no authorization.
- `AGENTS.md`, `docs/HARNESS.md`, and `docs/CLOUD_ENVIRONMENT.md` distinguish contributor checks, client generation, and real PostgreSQL verification.
- `docs/CONTEXT.md` and `docs/BUILD_PLAN.md` reflect local database capability without duplicating live issue status.
- Product scope, ledger/API contracts, and pilot procedures are unchanged; `docs/MVP.md` and `docs/PILOT.md` need no edits.

## Learning note

A migration versions table structure; a seed supplies predictable fake data inside that structure. Repeating a seed preserves identities, while reset deliberately deletes data and reconstructs the schema. Generating the Prisma client does not create database tables. Prisma is a library used with PostgreSQL here; no Prisma account or hosted service is required.

## Next step

Human review and merge of B0.2 remain required. The coordinator will synchronize issue #5 with the PR and verification evidence. [B0.3 authentication and demo roles](https://github.com/ryandils/encore/issues/6) must wait for this prerequisite to merge and recheck ownership before starting; B1 remains responsible for full domain contracts/models. Enable `binaries.prisma.sh` for future work in this cloud runtime. The local URL guard cannot detect a manually forwarded tunnel, and this development workflow is not a production migration or backup procedure.
