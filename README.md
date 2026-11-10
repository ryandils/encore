# Encore

Know your door. Account for your cover.

Encore is a phone-first tool for independent bars and small clubs that collect cash cover. Door staff record entries, exits, and the cover actually charged. Owners see the recorded crowd count and reconcile expected cover against cash counted at close.

## Current status

This repository contains the MVP specification, contributor harness, Next.js/React/Tailwind setup landing page, local PostgreSQL/Prisma storage, and a **synthetic local sign-in demo** using Better Auth. Owner/staff demo pages use real server-validated sessions. **The door ledger, owner dashboard, venue/night authorization, and production authentication are not implemented.** The remaining foundation work is described in [the build plan](docs/BUILD_PLAN.md).

## Start here: Windows or macOS

Follow [the quick start](docs/QUICKSTART.md) to install Git, Node 24.x/pnpm 12.18.0, clone the repo, and connect Codex. Both operating systems use the same commands from the repository root:

```text
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run check
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

All authored executable source is **TypeScript**, checked with pinned **TypeScript 7.0.2**. Run `pnpm run typecheck` for strict harness and application checking and `pnpm run compiler:version` for its version. Node 24 executes the .ts harness scripts directly using type stripping; the compiler separately verifies types.

Start the development server:

```text
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page explains the setup milestone; it cannot record admissions or cash. Stop the server with Ctrl+C. To run the optimized local build instead, run `pnpm run build` followed by `pnpm run start` and open the same address. No environment file, database, credentials, or external service is required for this scaffold.

These checks cover contributor setup, the landing-page scaffold, and database-command guards. Real PostgreSQL verification is a separate command below; none of these checks establishes ledger, permission, or pilot readiness.

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

Run `pnpm run auth:verify` for the separate HTTP/PostgreSQL regression checks after authentication setup. See [local authentication setup and limits](docs/LOCAL_DATABASE.md).

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

[B0.3 authentication and demo roles](https://github.com/ryandils/encore/issues/6) establishes the local sign-in foundation. Before taking [B0.4 platform verification](https://github.com/ryandils/encore/issues/7), confirm prerequisite merges and current ownership on GitHub. These links identify work, not a live status snapshot.

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
