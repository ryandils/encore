# Encore

Know your door. Account for your cover.

Encore is a phone-first tool for independent bars and small clubs that collect cash cover. Door staff record entries, exits, and the cover actually charged. Owners see the recorded crowd count and reconcile expected cover against cash counted at close.

## Current status

This repository contains the MVP specification and an executable contributor harness. **No Encore application, deployment, or working integrations exist yet.** The first app implementation task is B0 in [the build plan](docs/BUILD_PLAN.md).

## Start here: Windows or macOS

Follow [the quick start](docs/QUICKSTART.md) to install Git, Node 24.x/pnpm 12.18.0, clone the repo, and connect Codex. Both operating systems use the same commands from the repository root:

```text
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run check
pnpm run typecheck
```

All authored executable source is **TypeScript**, checked with pinned **TypeScript 7.0.2**. Run `pnpm run typecheck` for strict harness checking and `pnpm run compiler:version` for its version. Node 24 executes the .ts scripts directly using type stripping; the compiler separately verifies types. B0 will add app configuration and extend typechecking to the application.

These checks establish contributor readiness, not a working product. There are no app dev/build commands yet.

- [Harness and shared AI workflow](docs/HARNESS.md)
- [Conomos's first PR and learning path](docs/LEARNING_PATH.md)
- [Copy/paste Codex prompts](.codex/prompts/README.md)
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

Next available work, if still Ready/unclaimed: [B0.1 app scaffold](https://github.com/ryandils/encore/issues/4). Conomos can independently take [L0 first contribution](https://github.com/ryandils/encore/issues/13).

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
