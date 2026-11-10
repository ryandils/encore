# B0.4 / issue #7 — common demo baseline verification

## Task

[Issue #7](https://github.com/ryandils/encore/issues/7), common Windows/macOS demo baseline, on `chore/b0.4-demo-baseline` from merged B0.3 commit `dbf36a3f13fd3ef6bc5b7527e7a6f40a1582a802`. This handoff does not claim the issue complete or the PR merged.

## Outcome

Contributors have one [clone-to-sign-in rehearsal](../BASELINE_VERIFICATION.md) with expected outcomes and a safe evidence template. CI gains a real production HTTP check after each OS build, while local database/authentication evidence stays separate. Native Windows and macOS Docker Desktop/browser walkthrough results are still required for full B0.4 acceptance.

## Changes

- Added `production:verify`, a strict TypeScript check that starts an optimized local server after a build, verifies the public setup page and disabled demo/authentication entry points with unusable database/auth settings, and shuts its server down. It requires no database and changes no application behavior.
- Added that command to the existing Ubuntu/Windows/macOS CI matrix. The Ubuntu database job also reseeds credentials and verifies authentication after its existing explicitly confirmed disposable reset; normal contributor rehearsal performs no reset.
- Connected README, quick start, database guide, harness reference, and current context to the common rehearsal. Clarified development-server locking, exact origins, preservation of matching settings for existing database volumes, and credential reseeding after an intentionally authorized reset.
- No dependencies, schema, migration, API contract, product behavior, production credentials, or deployment configuration changed.

## Verification

The lead verified the following in the fresh Linux/x64 cloud checkout on Node 24.22.1, pnpm 12.18.0, Docker 29.9.2, and Compose 2.40.3:

- Final `corepack pnpm run cloud:setup`: frozen installation, doctor, TypeScript 7.0.2 version, strict typecheck, repository check, and both context-gate regression tests passed.
- `pnpm run lint`: 34 files checked with no warnings. All 94 unit tests and the optimized build passed.
- `db:init`, `db:up`, `db:generate`, `db:migrate`, two `db:seed` runs, and `db:verify` passed against a new local volume. The two exact synthetic identities survived a PostgreSQL restart; no reset was performed.
- `auth:init`, `auth:seed`, and `auth:verify` passed: credential preservation, real persisted owner/staff sessions, protected navigation, server-derived roles, anonymous/forged/wrong-password/expired/revoked rejection, disabled signup, origin checks, and sign-out invalidation.
- `db:down` passed with the named volume retained.
- `production:verify` passed with PostgreSQL stopped: the labeled public page returned 200 and all eight tested demo/authentication endpoints returned 404 with invalid settings. Cleanup left no Next server processes. Its missing-build check also exited 1 with an instruction to run the build.
- Independent review identified an existing-volume setup ambiguity. The guide now requires the user's matching preserved local settings and stops if they are unavailable; a fresh checkout cannot silently replace credentials. Review reported no remaining substantive findings after that fix.

The staged `corepack pnpm run context:check --base origin/main`, repository check, and whitespace check passed. Current-PR hosted CI is pending at this commit; its eventual result belongs in the PR and issue evidence, not inferred from earlier B0.3 checks.

No interactive browser walkthrough was run in this task. Native Windows/macOS Docker Desktop and interactive browser rehearsals have not been supplied. Hosted CI cannot replace those results. The user can provide macOS evidence and Conomos can provide native Windows evidence on the same issue using the common template. No local database reset or real-user messaging was performed.

## Context impact

- `README.md` and `docs/QUICKSTART.md`: discoverable complete rehearsal, production command, and server sequencing.
- `docs/LOCAL_DATABASE.md`: rehearsal link, stop the active dev server before HTTP verification, and restore synthetic credentials after an intentionally authorized reset.
- `docs/HARNESS.md`: production HTTP command and CI scope, with separate native evidence requirements.
- `docs/CONTEXT.md`: durable verification capability and removal of the unverified assertion that no deployed service exists.
- `docs/BASELINE_VERIFICATION.md`: canonical step-by-step contributor rehearsal and safe results template.

Product and architecture contracts did not change, so `MVP.md` and `ARCHITECTURE.md` need no updates. Live ownership and status remain in issue #7.

## Learning note

A successful build proves the app can be compiled. Starting that build and requesting pages proves a different thing: its HTTP behavior. Neither establishes that a teammate can install Docker Desktop and sign in from their native browser; that needs a separate recorded walkthrough.

## Next step

Keep the PR draft while acceptance evidence is incomplete. Collect the native macOS and Windows results using the rehearsal template, resolve failures, and record the tested commit and hosted CI result. The coordinator maintains issue #7 and its PR link; no issue closure, merge, deployment, or dependent issue claim is implied. B1 remains downstream of B0 acceptance.
