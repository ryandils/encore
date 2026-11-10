# B0.4 / issue #7 - native Windows verification

## Task

Native Windows follow-up under the existing [issue #7](https://github.com/ryandils/encore/issues/7) claim and draft [PR #25](https://github.com/ryandils/encore/pull/25), on `chore/b0.4-demo-baseline`.

## Outcome

The documented installation, application checks, real PostgreSQL setup, authentication HTTP checks, and stop/resume persistence passed in native Windows PowerShell. Interactive owner/staff browser verification remains pending user participation. This is partial native evidence, not full B0.4 acceptance or a macOS result.

## Changes

This evidence-only handoff adds no application, dependency, schema, migration, credential, or setup changes. The shared branch's existing work is preserved. Docker Desktop was started using its existing Linux-container configuration. No database reset or volume deletion was performed.

## Verification

Tested application commit: `8c7d53d5df86e9f1e45f23d5905bd9a2c29e7a08`.

- Date: November 10, 2026. Host execution date recorded; report timezone UTC.
- Platform: Windows build 26200, x64; native PowerShell 7.6.9; Node reports `win32/x64`.
- Tools: Git 2.49.0.windows.1; Node 24.14.1; Corepack 0.34.6; pnpm 12.18.0; TypeScript 7.0.2.
- Docker Desktop 4.39.0; client and Linux engine 28.0.1; Compose 2.33.1-desktop.1.
- Starting state: clean fresh Git clone of the shared branch, no copied dependencies or environment file, and no existing Compose-labelled Encore volume.
- `corepack.cmd pnpm install --frozen-lockfile`: passed, including Prisma engine installation. Corepack avoids a global pnpm installation; `.cmd` launchers avoid PowerShell execution-policy changes.
- `doctor`, `compiler:version`, `check`, and `typecheck`: passed. Prisma client and Next route generation succeeded.
- `context:test`: both tests passed.
- `lint`: 34 files checked, no fixes or warnings.
- `test`: 93 passed, one intentionally skipped on Windows (Unix environment-file permission mode); three test files passed. Do not report this as 94 Windows tests passed.
- `build`: optimized build and TypeScript checks passed.
- `production:verify`: passed with PostgreSQL not started; public labeled page returned 200 and tested demo/auth routes returned 404 with invalid configuration.
- `db:init`, `db:up`, `db:generate`, `db:migrate`, two `db:seed` runs, and `db:verify`: passed. Two synthetic users survived reseeding and PostgreSQL restart.
- `auth:init`, two `auth:seed` runs, and `auth:verify`: passed. Real HTTP/PostgreSQL checks covered persisted owner/staff sessions, protected navigation, server-derived roles, rejection cases, origin checks, and sign-out invalidation.
- Stop/resume sequence `db:down`, `db:up`, `db:verify`, `auth:verify`, `db:down`: passed with the named volume retained and credentials preserved.
- Git working tree remained clean after automated setup; `.env` and generated files were not tracked.
- The database was subsequently resumed and `corepack.cmd pnpm run dev --hostname localhost` started for the interactive walkthrough. The native in-app browser displayed the labeled synthetic sign-in form. Owner/staff interactive login, refresh, logout, protected redirects, browser version/viewport, narrow-phone layout, and keyboard-focus checks remain pending. A rendered sign-in page alone is not a completed walkthrough.
- Hosted CI was not used as a substitute for any native result and was not re-evaluated in this follow-up.
- After staging this handoff, `check`, `context:check --base origin/main`, and `git diff --cached --check` passed against freshly fetched main.

Execution-environment notes: the restricted agent sandbox could not resolve network hosts or access Docker's named pipe. Authorized host execution completed installation and Docker checks without changing machine security settings. Docker initially had no running engine; starting the installed Docker Desktop resolved that prerequisite. An agent-only launch attempt with an extra `--` before `--hostname` failed; passing `--hostname localhost` directly to `pnpm run dev` succeeded. The documented baseline command itself did not need a fix.

## Context impact

Only this uniquely named handoff is added. Existing canonical setup instructions worked, and product behavior and contracts are unchanged, so no canonical document needs a functional correction. Issue #7 remains the current acceptance/coordination record.

## Learning note

Native HTTP tests exercise real Windows processes and the database, but they do not prove that a person can use the browser form or see readable phone controls. Those results must be recorded separately.

## Next step

Complete section 4 of [the baseline rehearsal](../BASELINE_VERIFICATION.md) with both synthetic roles using the preserved local passwords, then stop the demo and database without removing the volume. Record actual browser/version/viewport and results. Keep PR #25 draft pending native Windows interactive and macOS evidence; do not merge, deploy, or close issue #7.
