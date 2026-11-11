# Encore

Know your door. Account for your cover.

Encore is a phone-first tool for independent bars and small clubs that collect cash cover. Door staff record entries, exits, and the cover actually charged. Owners see the recorded crowd count and reconcile expected cover against cash counted at close.

## Current status

This repository contains the MVP specification, contributor harness, Next.js/React/Tailwind setup landing page, local PostgreSQL/Prisma storage, and a **synthetic local sign-in demo** using Better Auth. Owner/staff demo pages use real server-validated sessions. B1 adds pure ledger calculations, shared TypeScript contracts and synthetic fixtures, and domain database models. The separate synthetic door console exercises local entries, exits and undo without a database. A separate synthetic owner rehearsal covers setup, summary and closeout. Local ledger, setup/access, owner discovery and audit CSV APIs enforce server-side venue/night permissions. A separate persisted door rehearsal connects real local sessions to PostgreSQL; production authentication and operational pilot readiness remain outstanding. See [the build plan](docs/BUILD_PLAN.md) for the remaining work.

## Start here: Windows or macOS

Follow [the quick start](docs/QUICKSTART.md) to install Git, Node 24.x/pnpm 12.18.0, clone the repo, and connect Codex. For the full clone-to-sign-in rehearsal and a safe results template, use [common demo baseline verification](docs/BASELINE_VERIFICATION.md). Both operating systems use the same commands from the repository root:

```text
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run check
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run production:verify
```

All authored executable source is **TypeScript**, checked with pinned **TypeScript 7.0.2**. Run `pnpm run typecheck` for strict harness and application checking and `pnpm run compiler:version` for its version. Node 24 executes the .ts harness scripts directly using type stripping; the compiler separately verifies types.

Start the development server:

```text
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page explains the setup milestone; it cannot record admissions or cash. Stop the server with Ctrl+C. To run the optimized local build instead, run `pnpm run build` followed by `pnpm run start` and open the same address. No environment file, database, credentials, or external service is required for this scaffold.

These checks cover contributor setup, the landing-page scaffold, database/authentication guards, and pure ledger and API-contract behavior. The production HTTP check starts its own temporary server after the build and verifies that the public setup page loads while demo/authentication routes remain disabled, without a database. Real PostgreSQL verification is a separate command below; pure ledger results do not establish live multi-device writes, permission enforcement, or pilot readiness.

## Shared ledger contracts for B2/B3

`src/domain/ledger.ts` exposes pure projections and closeout calculations. `src/domain/contracts.ts` supplies the shared command/result types and parsers; `src/domain/fixtures.ts` exposes `createLedgerFixtures()` with fresh, explicitly synthetic examples for the documented $10/$15 scenario. Consumers must display its synthetic label and must not imply that fixture state is saved or shared between devices.

Run `pnpm run test` for the database-free ledger and contract cases. With local PostgreSQL running and migrations applied, run `pnpm run ledger:verify` for database constraint checks. See [architecture and contract boundaries](docs/ARCHITECTURE.md) and [local database verification](docs/LOCAL_DATABASE.md). No live ledger API or door/owner UI is added by these modules.

## Owner screen rehearsal (synthetic only)

Run `pnpm run dev` and open [the owner rehearsal](http://localhost:3000/demo/owner-rehearsal). No database or login is needed for this isolated fixture screen; it exposes no account or real venue data and is disabled in production. Use fake values only. State lives in this browser page and resets on refresh; it is not saved or shared with the door demo or another device.

Create a venue with capacity 100 and $5/$10/$15 presets, then open a night with occupancy 0 and a $100 float. Use the labeled fixture controls for four $10 admissions and one exit. Change the second preset to $15 and admit once more. The summary should show five entries, one exit, occupancy/peak four, $55 cover and $155 expected drawer cash. Count $150 and confirm close to see a -$5 cash variance. Closed history and CSV preserve the charged prices and closeout snapshot for this page session. Synthetic invite creation, acceptance and revocation send no messages and grant no access.

The rehearsal uses B1 command types and pure calculations. It does not verify live authorization, atomic writes, persistence after refresh, or two-device convergence; those remain B4 (#11).

## Try the synthetic door console

Run `pnpm run dev` and open [http://localhost:3000/demo/door](http://localhost:3000/demo/door). This separate, visibly labeled fixture needs no database or sign-in. It records paid/free entries, exits and eligible undo actions in this browser tab only; refreshing resets the fixture. Staff screens show recorded occupancy and individual actions, not owner financial totals. Demo controls let you rehearse rejected saves, lost acknowledgements and disconnection. Retry keeps the original request ID to avoid recording an uncertain action twice.

The route returns 404 in production. This is UI/contract verification, not live persistence, venue authorization or shared-device operation; B4 supplies those capabilities.

## Local PostgreSQL and synthetic seed

Install and start Docker Desktop using the [Windows/macOS database guide](docs/LOCAL_DATABASE.md), then run these commands one line at a time from the repository root:

```text
pnpm run db:init
pnpm run db:up
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run db:seed
pnpm run db:verify
```

`db:init` creates an ignored `.env` from the local-only placeholders in `.env.example` without overwriting an existing file. PostgreSQL listens on `127.0.0.1:54329`, using a dedicated `encore_local` database and user. The database seed supplies labeled fake owner/staff identities without passwords or permission grants. The separate authentication setup below turns them into local demo login accounts. No production credentials, customer data, or outbound email is needed. `db:verify` checks repeatable seeding and persistence across a database restart.

Use `pnpm run db:down` to stop PostgreSQL while retaining its volume, and `pnpm run db:up` to resume it. To deliberately erase and rebuild only the dedicated local database, use `pnpm run db:reset --confirm-local-reset`, then `pnpm run db:seed`. Read the [reset boundaries and troubleshooting](docs/LOCAL_DATABASE.md) first; the reset is destructive and the commands reject production mode or a non-local target.

## Try the synthetic sign-in demo

After the database commands above, run:

```text
pnpm run auth:init
pnpm run auth:seed
pnpm run dev
```

Open [http://localhost:3000/demo/sign-in](http://localhost:3000/demo/sign-in). Sign in as `owner@encore-demo.invalid` or `staff@encore-demo.invalid` using the corresponding `DEMO_OWNER_PASSWORD` or `DEMO_STAFF_PASSWORD` from your ignored `.env`. `auth:init` generates a random signing secret and passwords without printing or replacing existing values. Read them locally in your editor; never share the file or include its values in a screenshot, issue, or PR. `auth:seed` preserves existing credential hashes and timestamps on repeat runs and rejects conflicts instead of resetting passwords.

The demo supports sign-in, session-backed owner/staff navigation, and sign-out. It grants no venue access and records no admissions or cash. All authentication and demo routes are disabled with `NODE_ENV=production`, including `pnpm run start`; use `pnpm run dev` for this local demo. Real-user email verification, password recovery, and production setup remain prerequisites for a pilot.

Stop `pnpm run dev` with Ctrl+C before running `pnpm run auth:verify` for the separate HTTP/PostgreSQL regression checks after authentication setup; the verifier starts its own development server in this checkout. See [local authentication setup and limits](docs/LOCAL_DATABASE.md).

To automate the real Chromium sign-in forms after local database/authentication setup, stop any development server and unset `DEBUG`/`PWDEBUG` in that terminal, then run:

```text
pnpm exec playwright install chromium
pnpm run browser:verify
```

The browser download is needed only for this optional check. It checks owner/staff forms, refresh and sign-out, protected redirects, and phone-sized controls at 390px/320px. It starts and stops its own development server and saves no screenshots or traces. The [baseline guide](docs/BASELINE_VERIFICATION.md) separates local Docker Desktop evidence from the hosted Windows browser job, which uses native PostgreSQL on its disposable runner.

- [Harness and shared AI workflow](docs/HARNESS.md)
- [Conomos's first PR and learning path](docs/LEARNING_PATH.md)
- [Codex skills and prompt recipes](.codex/prompts/README.md)
- [Task brief template](docs/tasks/TEMPLATE.md)

## The weekend MVP

1. An owner creates a venue and opens a night with three cover presets.
2. The owner grants a staff member access to that night through an expiring invite link.
3. Staff tap a price to record one paid entry, use a separate free-entry action, and tap Exit when someone leaves.
4. Owner and staff devices share the same recorded headcount.
5. The owner closes the night, enters counted door cash, and sees expected cover, cash variance, peak occupancy, and arrival traffic.

The first pilot covers one entrance, a single shared door cash pool, USD cash cover, and online operation. The schema must isolate venues even though the first pilot uses one. Anonymous walk-ins require no phone, name, or account.

## Cloud environment

[Cloud setup instructions](docs/CLOUD_ENVIRONMENT.md) define **encore cloud env**. From the checked-out repository root on Node 24, run `corepack pnpm run cloud:setup`. The command installs frozen dependencies and verifies the harness; it does not create or publish a saved Codex environment.

## Project context and live work

Start with [current context](docs/CONTEXT.md) and [the task workflow](docs/WORKFLOW.md). Live work is tracked in [GitHub issues](https://github.com/ryandils/encore/issues), not previous chats. Code changes include [task handoffs](docs/handoffs/README.md); agents follow the [context-upkeep skill](.agents/skills/encore-context-upkeep/SKILL.md).

For backend work, inspect [B4 shared backend integration](https://github.com/ryandils/encore/issues/11), including prerequisite acceptance and current ownership. The [B2 door-console](https://github.com/ryandils/encore/issues/9) and [B3 owner-screen](https://github.com/ryandils/encore/issues/10) records contain synthetic-screen evidence and integration boundaries. Confirm merges and current claims on GitHub before taking work. Issue-body Status fields and their manual `status:*` label mirrors are described in the workflow; these links identify work, not a live status snapshot.

## Read in this order

- [MVP scope, flows, and acceptance criteria](docs/MVP.md)
- [Architecture and data contracts](docs/ARCHITECTURE.md)
- [Ordered tasks and team handoffs](docs/BUILD_PLAN.md)
- [Pilot script and validation](docs/PILOT.md)
- [Agent instructions](AGENTS.md)

## Start with Codex

Connect this public repository to each collaborator's GitHub/Codex account. Each person needs repository access and must authorize their own Codex integration; these docs do not grant access.

Paste this into a fresh Codex chat:

> Read AGENTS.md, README.md, and docs/HARNESS.md. Explain what is implemented, inspect branch/status and open PRs if accessible, and run the harness checks. I am learning: suggest one small available task with acceptance criteria, but do not edit files yet.

One person takes B0 first. After B1 defines and tests the contracts, the proposed Ryan, Mike, and Conomos workstreams can proceed without independently scaffolding three applications.

## Product boundaries

This MVP does not process payments, verify identity or age, replace ID checks or re-entry stamps, send marketing texts, or guarantee occupancy accuracy. Recorded cash variance is a discrepancy to investigate, not evidence of theft. Manual counts are an operational estimate, not a regulatory certification.

QR guest lists, discounts, opt-in marketing, digital re-entry, NFC payments, forecasts, native apps, and subscriptions are later experiments. The proposed $5/$10/$20 tiers are pricing hypotheses; billing is not part of the weekend build.

## Development direction

Use a responsive TypeScript 7 web app first: Next.js, PostgreSQL, Prisma, and maintained authentication tooling. See the architecture document for the intended shape and pilot gates. Future React Native clients may share domain types and APIs, but web screens do not automatically port to native.

This repository is public. Do not commit credentials, personal contact details, actual venue/customer data, or the original group-chat screenshots. Use synthetic records. The package.json private flag prevents accidental npm publishing; it does not change GitHub visibility.

## Transactional ledger kernel (first B4 slice)

`src/server/ledger-service.ts` supplies internal PostgreSQL commands and authorized reads, using the existing domain schema. With the disposable local database running and migrated, run `pnpm run ledger:service:verify` for synthetic permission, retry, concurrent-write and close-race checks. The verifier creates uniquely named records and removes its own records afterward.

The kernel itself is a server foundation; the separate local HTTP boundary below exposes it with a separate local persisted door adapter described below. Callers must supply a user ID from a verified server session. Production authentication and recovery, persisted owner/setup screens and real two-device convergence remain outstanding under #11; #12 is not ready.

## Local authenticated ledger API (B4 slice)

After local database/auth setup, `pnpm run dev` exposes session-protected night reads and event/close commands under `/api/nights/[nightId]`. Venue membership and active staff assignment are enforced by the server kernel; synthetic login navigation roles do not grant access. Venue/night provisioning and staff access routes are described below; the separate persisted door client is also described below. The routes reject production mode. Run `pnpm run ledger:http:verify` with local PostgreSQL migrated, identities seeded and `auth:init`/`auth:seed` complete for real HTTP/session regression checks. The verifier starts and stops a temporary development server and removes its own synthetic domain records and sessions without resetting the database.

## Local venue and invitation API

The local API also supports creating venues, opening nights, changing presets, issuing/canceling staff invites, accepting an invite with a verified intended account, and revoking assignments. All routes share the local session/origin/body-limit safeguards and reject production. Invitation responses contain a secret fragment link once; there is no email delivery or acceptance page yet. Unverified accounts cannot accept an invitation, including seeded demo accounts whose verification flag is false.

Run `pnpm run venue:access:verify` for isolated PostgreSQL transaction/permission tests and `pnpm run venue:http:verify` after local auth setup for real HTTP/cookie checks. Both create only synthetic task records and remove their own records; they never reset the database or send messages. Account verification/recovery configuration, persisted owner/setup screens and real two-device acceptance remain outstanding.

## Owner discovery and local audit downloads

Owner-scoped reads now list owned venues, saved configuration/presets, active/closed nights, and invitation/assignment metadata. This lets a future owner screen recover server-created IDs and history after reload or a lost acknowledgement. Access lists return no invitation token, token hash or secret link.

`GET /api/nights/<night-id>/export` returns an owner-authorized, no-store CSV attachment for the local synthetic database. Its 25-column audit format includes the opening baseline, original event request/actor/time/charges, reversal target/reason, and closing request/totals. Text fields are spreadsheet-escaped and monetary values remain integer cents. It is an audit export, not a database backup or restore format. The existing 16-column fixture export remains unchanged.

Run `pnpm run owner:read:verify` for isolated PostgreSQL read/export checks and `pnpm run owner:http:verify` after local auth setup for real cookie/permission/download checks. Production remains disabled; persisted owner UI, real account verification/recovery, physical-device and pilot acceptance remain outstanding.

## Persisted local door rehearsal

With local database/auth setup and an authorized night assignment, open `/nights/<night-id>/door` using `pnpm run dev`. This separate page uses the session-protected HTTP API, shares acknowledged state with other authorized local sessions, and retains database history across reloads. It is visibly synthetic/local-only and returns 404 in production. The in-memory `/demo/door` remains unchanged.

A submitted request is journaled in this tab before transport. Reload after an unknown outcome blocks new actions until retrying the original UUID recovers its acknowledgement. Disabled/corrupt storage pauses recording instead of sending an untracked action. Closing the tab or clearing storage can lose the local recovery record; do not leave while a request is unresolved. This is not an offline queue or a production durability claim.

`pnpm run door:browser:verify` exercises separate synthetic browser sessions at 320px against local PostgreSQL, including shared counts, reload recovery and revocation. It is automated browser evidence, not a physical two-device or venue rehearsal.
