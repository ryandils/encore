# B0.1 — Web app scaffold and TypeScript 7 checks

## Task

[Issue #4](https://github.com/ryandils/encore/issues/4), on branch `feat/b0.1-app-scaffold`. This is the app-scaffold slice of B0, not completion of the foundation milestone. GitHub owns its current review and merge state.

## Outcome

A contributor can start one Next.js/React/Tailwind app and view its phone-first landing page. The page explicitly says **Demo / setup milestone**, describes what works, and states that it cannot record admissions, track occupancy, or reconcile cash. It provides documentation navigation without pretending to offer working door controls.

From the repository root on Node 24/pnpm 12.18.0, run `pnpm install --frozen-lockfile` and `pnpm run dev`, then open [http://localhost:3000](http://localhost:3000). No environment file, database, or credentials are required. `pnpm run build` followed by `pnpm run start` serves the optimized local build.

## Changes

- Added the App Router page, root layout, local SVG icon, and Tailwind styles under `src/app`, plus landing-page tests under `tests`.
- Extended the existing manifest, lockfile, strict typechecking, and CI with application tooling while retaining Node 24, pnpm 12.18.0, TypeScript 7.0.2, and the contributor harness.
- Pinned Next.js 16.4.5, React 19.3.1, and Tailwind CSS 4.3.5. Next's `experimental.useTypeScriptCli` integration preserves build-time checking with TypeScript 7's native CLI. Biome supplies compatible linting; Vitest checks rendered landing-page content. PostCSS uses a supported JSON configuration rather than introducing authored JavaScript.
- Disabled Next's automatic agent-rules generation with `agentRules: false` so starting the development server does not rewrite the repository's authored `AGENTS.md` instructions.
- Enabled Next's `experimental.strictRouteTypes` and retained generated `next-env.d.ts` imports for the active route declarations/validator. Including both development and production output via tsconfig globs produced duplicate global declarations after running both modes; active imports preserve strict validation while allowing both caches to coexist. The `strict: true` and `skipLibCheck: false` settings remain unchanged.
- Kept database, authentication, ledger commands, and deployed services outside this deliverable.

## Verification

Executed on Linux with Node 24.22.1, pnpm 12.18.0, and TypeScript 7.0.2. Commands used `corepack pnpm` because the cloud image's direct `pnpm` fallback was version 11.25.0.

| Check | Result |
| --- | --- |
| Fresh frozen install | Removed installed dependencies and generated output, then `corepack pnpm run cloud:setup` passed. |
| Final `corepack pnpm run cloud:setup` | Passed frozen installation, doctor, compiler version, Next route generation, strict harness/app/config/test typechecks including active route validators, repository checks, and both context-gate regression tests. |
| `corepack pnpm run lint` | Passed for nine authored source/config files, including the SVG icon's accessible title. |
| `corepack pnpm run test` | Both landing-page server-rendering tests passed. |
| `corepack pnpm run build` | Passed Next.js 16.4.5/Turbopack and real TypeScript CLI checking; `/`, `/_not-found`, and `/icon.svg` were statically rendered. |
| Development → typecheck → build | Passed with both development and production generated directories retained; starting development did not rewrite `AGENTS.md`. |
| Development and optimized-server browser smoke | Passed at 320px and 390px: HTTP 200, expected demo label/title/main landmark, loaded CSS, no horizontal overflow, working keyboard skip-link and fragment navigation, 48px call-to-action, and zero console/page errors. Screenshots were visually inspected. |
| Staged context and whitespace checks | `corepack pnpm run context:check --base origin/main` and `git diff --cached --check` passed. |
| Independent review | No outstanding correctness, security, regression, or acceptance-coverage findings. Reviewer independently confirmed active Next.js generated-validator coverage and unchanged strict checking. |

Resolved validation findings included duplicate generated route globals, automatic agent-rule edits, and a missing icon/accessible SVG title. The fixes retain strict typechecking and lint assertions. Development smoke uses the documented `http://localhost:3000`; an initial `127.0.0.1` probe hit Next's HMR origin guard, so the probe was corrected without relaxing allowed origins.

These checks cover the setup scaffold; no database, real two-device behavior, authorization, money math, or pilot operations exist to validate yet. Windows/macOS jobs are configured in CI but were not executed locally.

## Context impact

- `README.md` and `docs/QUICKSTART.md` describe real app startup and verification commands, prerequisites, and limits.
- `AGENTS.md` and `docs/HARNESS.md` distinguish harness validation from application checks.
- `docs/CONTEXT.md`, `docs/BUILD_PLAN.md`, and `docs/ARCHITECTURE.md` replace the outdated claim that no app scaffold exists while preserving future product contracts.
- `docs/CLOUD_ENVIRONMENT.md` explains local app startup without claiming a deployment or saved-environment publication.
- Product scope and ledger/API contracts did not change, so `docs/MVP.md` and `docs/PILOT.md` remain unchanged.

## Learning note

TypeScript checks code shapes before runtime; Next.js supplies routing and rendering. A successful typecheck therefore says the code is consistent with its types, while a browser check establishes that the actual landing page renders at the tested width. Neither proves that an unimplemented ledger is safe to operate.

## Next step

Human review and merge of B0.1 are required before [B0.2 local PostgreSQL and seed](https://github.com/ryandils/encore/issues/5) can become ready. Recheck GitHub ownership and prerequisites before claiming it. No database migration or external configuration is needed for this scaffold. Authentication, ledger behavior, two-device synchronization, and pilot readiness remain unimplemented. Issue review status and PR evidence will be synchronized by the coordinator after validation.
