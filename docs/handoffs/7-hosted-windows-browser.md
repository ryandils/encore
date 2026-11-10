# B0.4 / issue #7 — hosted Windows browser verification

## Task

Follow-up for [issue #7](https://github.com/ryandils/encore/issues/7) and draft [PR #25](https://github.com/ryandils/encore/pull/25) on `chore/b0.4-demo-baseline`, after evidence commit `b29fdf0`. The user requested completion of the Windows UI evidence through hosted automation without waiting for a physical Windows laptop walkthrough. This does not authorize issue closure, merge, or deployment.

## Outcome

A repeatable `browser:verify` command drives the real synthetic owner/staff sign-in UI in Chromium. A dedicated hosted Windows job supplies automated UI evidence separately from Conomos's already recorded native installation, Docker Desktop, database, and HTTP checks. The overall B0.4 PR remains draft while macOS acceptance evidence is missing; no physical Windows interactive walkthrough is claimed.

## Changes

- Added pinned Playwright 1.65.0 as a development dependency and a separate optional Chromium download. Ordinary contributor checks do not download a browser.
- Added a strict TypeScript browser runner that starts a temporary development server, uses generated local credentials without printing them, drives the real owner/staff forms at 390px/320px, and closes its server/browser afterward.
- The UI checks cover incorrect-password feedback, protected navigation, session refresh, server-derived role redirects, UI sign-out, keyboard focus, controls at least 44px in each dimension, horizontal overflow, and page errors. No screenshots or traces are saved, and raw diagnostics that could include credentials are withheld. Nonempty `DEBUG` or `PWDEBUG` settings are rejected before the dynamic Playwright import or server startup; regression tests use canary credentials to verify that refusal.
- Added **Hosted Windows browser and PostgreSQL** on `windows-2025`, using a commit-pinned setup action for native PostgreSQL 17 at the guarded loopback port `54329` and dedicated `encore_local` database. This is a disposable runner with synthetic data, not Docker Desktop or a production service.
- Updated setup references and the common evidence guide to allow the user-authorized combination of native Windows setup/Docker results plus hosted automated UI results. No application behavior, schema, migration, authentication boundary, or product scope changed.

## Verification

Existing native Windows evidence is preserved unchanged in [its handoff](7-windows-verification.md): application commit `8c7d53d5df86e9f1e45f23d5905bd9a2c29e7a08` passed installation, application checks, real Docker Desktop PostgreSQL setup, HTTP authentication, and stop/resume persistence in native PowerShell. It explicitly did not complete interactive owner/staff browser verification. Evidence commit `b29fdf0` added that record without changing application behavior.

The lead verified the full new browser journey locally on Linux/x64 with system Chromium `156.0.8078.79`, selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Owner at 390px and staff at 320px passed actual form sign-in, incorrect-password feedback, persisted refresh, role redirects, UI sign-out, protected rejection, keyboard focus, 44px controls, no horizontal overflow, and no page errors; browser/server cleanup completed. This is Linux browser evidence, not a Windows result.

An initial browser attempt timed out waiting for network-idle navigation. The test now waits for DOM content and explicit UI readiness assertions. Independent review also identified that Playwright debug logging could expose form values; the implementation now refuses `DEBUG`/`PWDEBUG` before loading Playwright or starting the server and adds regression coverage. The independent reviewer confirmed no remaining findings after that fix.

Final local integrated checks passed:

- `cloud:setup`: frozen installation, doctor, TypeScript 7 version, strict typecheck, repository check, and both context-gate regression tests.
- Lint: 36 files, no warnings.
- Unit tests: all 96 passed, including two debug-logging regression tests.
- Optimized build and production HTTP verification passed.

Database shutdown preserved its volume. The staged `corepack pnpm run context:check --base origin/main` and whitespace checks passed. Hosted Windows CI is pending at this commit; its run and tested SHA will be recorded in the PR and issue evidence. The new checks did not reset the local database or alter application behavior.

Physical Windows interactive testing and macOS setup/browser acceptance remain unclaimed. A successful hosted Windows job will prove its automated Chromium journey with native PostgreSQL; it will not prove Docker Desktop behavior on that runner or any macOS behavior.

## Context impact

- `README.md` and `docs/QUICKSTART.md`: optional browser installation and verification commands after existing local database/auth setup.
- `docs/HARNESS.md`: browser command, fifth CI job, safe output behavior, and the distinction between native Docker evidence and hosted browser evidence.
- `docs/BASELINE_VERIFICATION.md`: automated browser route, separate environment/commit evidence, and remaining macOS requirement.
- `docs/CONTEXT.md`: durable hosted Windows browser capability without presenting an unobserved passing result.

Earlier handoffs remain historical evidence and were not rewritten. Product and architecture contracts are unchanged, so their canonical documents need no functional update. Issue #7 remains the live status record.

## Learning note

Automating a browser form tests the page's controls, redirects, cookies, and server session together. It is stronger evidence for that UI path than an HTTP-only request, but it still records one browser and environment. Combining it with native Docker setup evidence is useful only when the sources and their limits stay explicit.

## Next step

Verify the new command and hosted Windows job, record their exact commits/results, and resolve independent review findings. Keep PR #25 draft pending macOS setup/browser acceptance. Maintain issue #7 through its existing coordinator; no new issue, merge, deployment, physical walkthrough claim, or dependent implementation is implied.
