# Common demo baseline verification

Use this rehearsal to verify [B0.4](https://github.com/ryandils/encore/issues/7) from a fresh checkout on native Windows PowerShell and macOS Terminal. It connects installation, local PostgreSQL, synthetic owner/staff sign-in, and shutdown. Record each platform and environment separately using the template below. Windows acceptance may combine native contributor setup/Docker evidence with the dedicated hosted Windows automated browser check described below; that combination does not claim a physical interactive walkthrough or macOS acceptance.

This is a local synthetic demo. It does not verify venue permissions, admissions, cash reconciliation, deployment, or pilot readiness. Never use real patrons or venue records.

## 1. Prepare and identify the checkout

Follow [Quick start, steps 1–3](QUICKSTART.md) for Git, Node 24.x, pnpm 12.18.0, an editor, and a fresh Git clone. Use native PowerShell on Windows and Terminal on macOS. Follow [Docker Desktop setup](LOCAL_DATABASE.md) for your OS; Windows must use Linux containers. Wait for the engine to start.

A fresh checkout means no copied `node_modules`, `.next`, generated Prisma client, or `.env`. Docker volumes are machine-wide: a fresh clone does **not** create an independent database. Encore uses the fixed local Compose project `encore-local`, port `54329`, and database `encore_local`.

- **Fresh checkout and new database volume:** follow the full sequence below. `auth:init` generates the passwords that the new credential seed will store.
- **Existing database volume:** use your own existing checkout with its preserved matching `.env`, and record this as an existing-checkout/database rehearsal. Keep the original generated passwords; a fresh `.env` would generate different passwords that `auth:seed` must reject against existing credentials. Skip `db:init` when `.env` already exists; `auth:init` validates and preserves its existing settings.
- **Existing volume without matching local settings:** stop the database/authentication sequence and record it blocked. Do not reset the volume, replace credentials, or copy another contributor's `.env` to force a passing result.

Preserve existing data, and do not run two Encore database rehearsals concurrently. An existing-checkout rehearsal does not establish fresh-install acceptance; report the distinction.

From the repository root, run one line at a time:

```text
git status --short
git rev-parse HEAD
node --version
node -p "process.platform + '/' + process.arch"
pnpm --version
docker version
docker compose version
```

Expected: an initially clean working tree, a recorded full commit SHA, Node `v24...`, pnpm `12.18.0`, and Docker client **and server** versions. Record the OS version and CPU architecture. Choose the agreed merged commit, or explicitly identify the draft PR commit being tested; don't mix results from different revisions.

Use `corepack pnpm` instead of `pnpm` if you use Corepack. If PowerShell blocks `.ps1` launchers, use `pnpm.cmd`; don't disable execution policy. Network access is needed for npm packages, Prisma engine/checksum downloads from `binaries.prisma.sh`, and the pinned PostgreSQL container image. Keep port `3000` free for the interactive demo and `54329` free for its database.

## 2. Install and check the application without a database

```text
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run compiler:version
pnpm run check
pnpm run typecheck
pnpm run context:test
pnpm run lint
pnpm run test
pnpm run build
pnpm run production:verify
```

All commands must exit successfully. Doctor reports the contributor prerequisites; the compiler must report `Version 7.0.2`. Typechecking generates the Prisma client and Next route declarations without connecting to PostgreSQL. Unit tests, lint, and an optimized build are separate checks.

`production:verify` starts and stops its own optimized server on a temporary loopback port. It checks that `/` loads and that demo pages and auth APIs reject access in production, using deliberately unusable database/authentication configuration. No database, production credentials, or running development server is needed. This proves only the tested production boundary, not a deployment.

If a command fails, record its name and safe error summary, stop that sequence, and use the [quick-start](QUICKSTART.md) or [database troubleshooting](LOCAL_DATABASE.md) guidance. Do not mark later unrun steps passed.

## 3. Create, migrate, and seed the local demo

The full sequence below is for a fresh checkout and a new database volume. For an existing-volume rehearsal with your own matching `.env`, skip only `db:init` as described above. That command intentionally fails rather than overwriting an existing file.

```text
pnpm run db:init
pnpm run db:up
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run db:seed
pnpm run db:verify
pnpm run auth:init
pnpm run auth:seed
pnpm run auth:seed
pnpm run auth:verify
```

Expected results:

- `db:init` creates ignored `.env` for a fresh setup; an existing-file refusal is expected if you accidentally rerun it. `db:up` waits for the pinned local PostgreSQL service to be healthy on `127.0.0.1:54329`.
- Migration applies the checked-in schema. Repeated identity seeds preserve the same two synthetic identities. `db:verify` checks those records across a PostgreSQL restart; it performs no reset.
- `auth:init` generates local signing/password settings without printing them. Repeated `auth:seed` preserves existing credential accounts. It rejects mismatches instead of overwriting passwords.
- `auth:verify` starts its own development server and exercises real HTTP sessions against PostgreSQL: both synthetic roles, protected navigation, sign-out, and rejection cases. Stop any other `pnpm run dev` server in this checkout first; Next development processes share the checkout's generated files and lock.

Do not copy another contributor's `.env`. Existing shell environment values take precedence over `.env`; remove stale overrides locally if a guard refuses them. Leave the supplied local database target unchanged. The [database guide](LOCAL_DATABASE.md) explains these boundaries and the difference between identity seed and credential seed.

## 4. Walk through both roles in your browser

```text
pnpm run dev
```

Keep the terminal running. Open [http://localhost:3000](http://localhost:3000), confirm the setup/demo label, and open [the sign-in page](http://localhost:3000/demo/sign-in). Use the exact origin in `BETTER_AUTH_URL`; `localhost` and `127.0.0.1` are different origins. If the server chooses another port, stop it and resolve the port conflict before continuing with the default setup.

Read the passwords locally in your editor from ignored `.env`. Never paste them, the signing secret, cookies, tokens, or the environment file into a report or screenshot.

| Action | Expected result |
| --- | --- |
| Open `/demo/owner` while signed out | Redirect to sign-in. |
| Try an incorrect password once | A visible failure; no authenticated navigation. |
| Sign in as `owner@encore-demo.invalid` with `DEMO_OWNER_PASSWORD` | Labeled synthetic owner screen showing that identity. |
| Refresh the owner page | Session remains valid and the same identity appears. |
| Sign out, then revisit `/demo/owner` | Protected page redirects to sign-in. |
| Sign in as `staff@encore-demo.invalid` with `DEMO_STAFF_PASSWORD` | Labeled synthetic staff screen showing that identity. |
| Open `/demo/owner` as staff | Redirect to the staff demo, not an owner identity. |
| Refresh, sign out, then revisit `/demo/staff` | Refresh retains the staff session; sign-out removes access. |

Check the form and both demo screens at a narrow phone width such as 390px: labels and actions remain readable, the page has no horizontal overflow, and keyboard focus is visible. Record the browser/version and viewport used. This is an interactive walkthrough, distinct from HTTP integration checks. Avoid rapid repeated sign-in attempts; the demo retains real authentication rate limiting.

### Automated browser option

After completing database/authentication setup in section 3, stop any other `pnpm run dev` server in the checkout and unset `DEBUG`/`PWDEBUG` in the terminal, then run:

```text
pnpm exec playwright install chromium
pnpm run browser:verify
```

The first command downloads Chromium for pinned Playwright 1.65.0. It is optional for ordinary contributor checks; browser verification needs either this download or a compatible preinstalled Chromium selected by `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Record the browser version printed by the verifier, especially when using that override. Do not run `auth:verify` and `browser:verify` concurrently: each starts a development server in the same checkout.

`browser:verify` starts a temporary loopback development server, reads the existing generated demo passwords locally, and drives the actual browser forms. It verifies the owner journey at 390px and staff journey at 320px, incorrect-password feedback, session refresh, server-derived role redirects, UI sign-out, anonymous rejection, keyboard focus, controls at least 44px in each dimension, no horizontal overflow, and no uncaught page errors. It closes its browser/server afterward and saves no screenshots or traces. Nonempty `DEBUG` or `PWDEBUG` settings are refused before browser loading/server startup because debug output can expose local passwords. This is automated Chromium evidence; it does not claim a person used the page or a physical phone was tested.

The dedicated **Hosted Windows browser and PostgreSQL** CI job runs this sequence on `windows-2025`, with native PostgreSQL 17 installed by a commit-pinned setup action at the same guarded loopback port/database. It does not install or test Docker Desktop and does not run the Compose restart verifier. Native setup/Docker evidence comes from the separately recorded Windows rehearsal, not from this job. A passing job can supply the Windows UI portion without waiting for a physical Windows laptop walkthrough. Record its run URL, tested commit, browser version, and actual result alongside the native results. A pending job is not acceptance evidence.

## 5. Stop and resume without erasing data

Stop the development server with Ctrl+C, then run:

```text
pnpm run db:down
pnpm run db:up
pnpm run db:verify
pnpm run auth:verify
```

Expected: the database returns with the same synthetic identities, and authentication still works with the existing credentials. `db:down` keeps the named volume; there is no reset step in this rehearsal. The verification commands stop their own test servers. Finally run:

```text
pnpm run db:down
git status --short
```

Expected: PostgreSQL is stopped with its volume retained, and no tracked setup artifacts or secret files appear in Git status. A local volume is development storage, not a production backup.

## Evidence to attach to issue #7

Copy this template into the task's evidence update after testing. Record actual results; `not run` and `blocked` are valid outcomes. Include only safe summaries and public CI links. Do not include private paths, machine names, environment values, database URLs, passwords, session data, or real customer records.

```text
Platform: Windows/macOS; OS version; CPU architecture
Environment/evidence: native contributor machine / hosted Windows browser / local automated browser / physical interactive walkthrough
Shell: native PowerShell/macOS Terminal and version
Commit: full Git SHA
Starting state: fresh clone + new volume / own existing checkout + matching .env + existing volume / blocked missing settings
Tools: Git, Node, pnpm, TypeScript; Docker client/server and Compose versions for native setup, or PostgreSQL/Playwright versions for hosted browser
Browser and viewport: name/version, width
Date tested: date and timezone

Frozen install + doctor/compiler/check/typecheck/context:test: pass/fail/not run
Lint + unit tests + build: pass/fail/not run
Production HTTP verification: pass/fail/not run
Database init/up/generate/migrate/repeated seed/restart verification: pass/fail/not run
Authentication init/repeated seed/HTTP verification: pass/fail/not run
Owner + staff login/refresh/logout/protected redirects: pass/fail/not run; automated or interactive
Automated browser command/run URL and tested commit, if used:
Narrow-phone layout and keyboard focus: pass/fail/not run
Stop/resume + database/auth verification: pass/fail/not run
Final shutdown and clean Git status: pass/fail/not run
Failures, safe error summaries, workarounds, and unrun steps:
Hosted CI run URL and commit, if inspected separately:
```

The [initial B0.4 handoff](handoffs/7-demo-baseline.md), [native Windows evidence](handoffs/7-windows-verification.md), and [hosted Windows browser handoff](handoffs/7-hosted-windows-browser.md) record separate stages; [issue #7](https://github.com/ryandils/encore/issues/7) owns current acceptance status. For Windows, the user-authorized route combines the recorded native install/Docker results with a successful hosted Windows automated UI run. Preserve each source’s tested commit and limitations; no physical Windows walkthrough is implied. macOS setup and browser acceptance remain a separate requirement. Keep the overall B0.4 PR draft until its remaining acceptance evidence is complete; hosted macOS build success alone does not supply that evidence.
