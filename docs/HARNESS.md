# Encore's repository harness

Here, "harness" means the shared instructions, task briefs, executable checks, and review loop surrounding an AI coding task. It is not an autonomous agent service or model benchmark. All Codex interfaces should use the same repo contract.

## What runs today

| Command | What it proves |
| --- | --- |
| `pnpm install --frozen-lockfile` | The committed dependency lock can be installed; includes app tooling, TypeScript 7.0.2, its platform package, and Node 24 type definitions |
| `pnpm run doctor` | Node 24/pnpm 12.18.0, Git clone, and expected setup files are present |
| `pnpm run check` | Required docs exist, JSON parses, authored JavaScript files are rejected, simple inline relative file links resolve, and the installed compiler matches the pinned TypeScript 7 dependency; frozen installation validates the pnpm lockfile |
| `pnpm run typecheck` | Generates Prisma client and Next.js route declarations, then runs strict TypeScript 7 checks for the harness, database code, application, tests, and supported configs; no live database is required |
| `pnpm run lint` | Biome checks authored application/test/config source using recommended correctness and accessibility rules |
| `pnpm run test` | Landing-page, local database/authentication guard, pure ledger, and API-contract tests; no live PostgreSQL service is started |
| `pnpm run build` | Generates the Prisma client, then Next.js produces an optimized application build with TypeScript checking enabled; no live database is required |
| `pnpm run production:verify` | After a build, starts a temporary optimized HTTP server and checks the public setup page plus production demo/authentication denial with deliberately unusable database/auth configuration; no database is required |
| `pnpm run dev` / `pnpm run start` | Start the development server / serve a completed optimized build locally |
| `pnpm run db:verify` | With the local Compose database running, checks repeatable migration/seeding and persistence across a PostgreSQL restart |
| `pnpm run ledger:verify` | With local PostgreSQL running and migrations applied, verifies domain SQL constraints using synthetic records inside a rolled-back transaction; no live endpoint or permission enforcement is tested |
| `pnpm run ledger:service:verify` | With migrated local PostgreSQL, exercises internal B4 transactions, permissions, retries, concurrent writes and close races using temporary synthetic records; no HTTP or device convergence |
| `pnpm run ledger:http:verify` | With migrated/seeded local database and auth setup, exercises actual ledger HTTP routes with separate synthetic session cookies; no production or physical-device claim |
| `pnpm run venue:access:verify` | Synthetic local PostgreSQL setup, permission, invite lifecycle and assignment/revocation transaction tests |
| `pnpm run venue:http:verify` | Separate local synthetic cookie sessions exercise setup/access HTTP; no outbound mail or account-verification bypass |
| `pnpm run door:browser:verify` | With local database/auth and Chromium, exercises separate 320px persisted-door sessions, shared state, reload/unknown retry and revocation; not physical devices |
| `pnpm run auth:init` / `pnpm run auth:seed` | Generate ignored local authentication settings, then create repeatable synthetic credential accounts without printing passwords |
| `pnpm run auth:verify` | With local database/auth setup complete, starts a dedicated development server for HTTP/session regression checks |
| `pnpm run browser:verify` | With local database/auth setup and Chromium available, starts a dedicated development server and drives real owner/staff forms, refresh/sign-out, protected redirects, and narrow-phone layout/focus checks |

The link checker skips fenced examples and external URLs; it does not validate heading anchors or implement a complete Markdown parser. Doctor/check establish contributor setup and document consistency. Database-free tests cover the setup landing page, local command/authentication guards, ledger money/traffic projections, and shared API contracts. They do not verify B4 venue permissions or concurrent database commands. `auth:verify` provides separate HTTP/PostgreSQL session evidence. Real PostgreSQL behavior requires the separate database verification command described in [local setup](LOCAL_DATABASE.md). All authored executable source remains .ts/.tsx under strict TypeScript configurations. Node 24 executes erasable TypeScript without a transpiler dependency, but that execution alone does not validate types. `pnpm run compiler:version` prints the compiler version.

CI runs the same baseline plus app lint, tests, build, and the production HTTP check on Linux, Windows, and macOS for pull requests and main. A separate Ubuntu job starts the pinned Compose PostgreSQL service, verifies migration/seed/restart persistence, runs the rollback-only B1 ledger constraint check and temporary-record B4 kernel integration checks, initializes synthetic authentication and runs HTTP/session checks, exercises the explicitly confirmed disposable reset, reseeds identities and credentials, verifies authentication again, and stops the service. It has read-only repository permissions and uses only the local synthetic credentials. CI runs repository/application checks, not Codex, and needs no model credentials. A green result is evidence for the checks actually run, not general approval to ship. Merge rules/branch protections are a separate GitHub setting; this workflow does not enable them.

A fifth CI job, **Hosted Windows browser and PostgreSQL**, runs on `windows-2025`. It installs Chromium through pinned Playwright 1.65.0, starts native PostgreSQL 17 with a commit-pinned setup action on the guarded loopback port `54329` and dedicated `encore_local` database, migrates/seeds, and runs `browser:verify`. This runner does not exercise Docker Desktop. The browser test uses actual forms, synthetic sessions, owner at 390px and staff at 320px, and checks incorrect-password feedback, refresh, sign-out, protected redirects, visible keyboard focus, 44px controls, horizontal overflow, and page errors. It saves no screenshots/traces and withholds raw errors that could contain credentials. Nonempty `DEBUG` or `PWDEBUG` settings are rejected before Playwright loads or the test server starts, because browser debug logs can expose form values.

For end-to-end contributor acceptance, use [the common demo rehearsal](BASELINE_VERIFICATION.md). Windows evidence can combine recorded native setup/Docker results with a successful dedicated hosted Windows browser run, as authorized for B0.4. Keep each tested commit and environment explicit; this does not claim a physical Windows walkthrough or macOS acceptance. A compiled build alone does not exercise an HTTP server or browser. `production:verify` checks the production HTTP boundary; `browser:verify` checks the local demo in a real automated browser. Neither validates production authentication or deployment.

To run the browser check locally after database/auth setup, use `pnpm exec playwright install chromium` once, stop other development servers in the checkout, unset `DEBUG`/`PWDEBUG`, then run `pnpm run browser:verify`. The browser download is optional for ordinary contributor checks. If the environment already provides a compatible Chromium executable, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point to that local binary; record its actual browser version because it may differ from Playwright’s bundled version.

Next.js uses its `experimental.useTypeScriptCli` integration for TypeScript 7's native compiler; build-time checking remains enabled. With `experimental.strictRouteTypes`, generated `next-env.d.ts` imports the active route types and validator, so development and production output can coexist without duplicate global declarations. Keep those generated imports instead of globbing both output trees into tsconfig.json. Biome supplies linting because the evaluated typescript-eslint release expects the older TypeScript compiler API. Tailwind's PostCSS configuration is JSON, which Next.js supports, rather than authored JavaScript or an unsupported TypeScript PostCSS config. Application and test source still use .ts/.tsx.

## Context upkeep

Follow [WORKFLOW.md](WORKFLOW.md) and the [repository skill](../.agents/skills/encore-context-upkeep/SKILL.md). Read [current context](CONTEXT.md) at task start. Update affected canonical docs and add a new [handoff](handoffs/TEMPLATE.md) for non-document changes. After staging it, run `pnpm run context:check --base origin/main`; `pnpm run context:test` exercises the gate against temporary Git repositories.

CI runs the gate against the PR base or pre-push commit. It checks that a new handoff has filled sections, not whether its statements are true or GitHub issues are synchronized. No background bot is installed and branch protections are not configured by this workflow.

Use `pnpm add -D <package>` to add development dependencies and commit pnpm-lock.yaml. Do not generate package-lock.json. A frozen install intentionally rejects manifest/lock drift. npm remains only an optional way to bootstrap the pinned pnpm executable.

## One task, one reviewable change

1. **Orient:** read AGENTS.md and product docs; inspect branch, status, current tasks, and open PRs. If the agent cannot inspect GitHub, say so and have the human verify the claim before overlapping shared work.
2. **Define:** use an existing issue and [the task brief](tasks/TEMPLATE.md) to state user outcome, boundaries, dependencies, acceptance examples, and evidence. Create a new issue through the Deliverable form only when explicitly authorized. An issue ID is a claimable coordination point; issue assignment is not a lock.
3. **Plan:** name affected files and checks. For a learning session, explain the plan before making the first edit and give the learner a chance to ask questions. Explicit human instructions to proceed remain valid.
4. **Build:** one branch per task. Prefer the smallest useful vertical slice. No parallel independent app scaffolds.
5. **Verify:** run actual checks and inspect the diff. Record failures as failures. For app behavior, add the specific behavioral evidence required by the task, beyond the harness.
6. **Explain:** the learner can describe what changed, why, and one remaining limit. Agent explanations support this; they are not evidence that the learner understood.
7. **Review:** have an independent reviewer inspect the integrated diff, then open a PR with verified results and limitations. Humans decide whether to merge. Issue closure, merge, deployment, and environment publication require explicit authorization. After a confirmed merge, everyone updates their local main.

The [Encore skill entry points](CLOUD_ENVIRONMENT.md) support issue listing, ranked recommendations, and scoped orchestration in the current chat. Listing/recommendation requests remain read-only. Other files in [.codex/prompts](../.codex/prompts/README.md) remain copy/paste recipes; the old cloud prompt links to the orchestrator skill. AGENTS.md routes requests even without automatic discovery. No global installation, permission bypasses, or shared credentials are required.

## Parallel cloud teams and ownership

Use `$encore-orchestrator implement #5` or `$encore-orchestrator investigate #6` in an Encore checkout containing [the skill](../.agents/skills/encore-orchestrator/SKILL.md). For cloud work select **encore cloud env**. Each chat has an accountable lead, useful parallel subagents, and independent review. [WORKFLOW.md](WORKFLOW.md) owns the detailed coordination rules; the skill does not launch chats or install a scheduler.

## Keeping contributors from colliding

- Ryan or the first volunteer owns B0; confirm that claim on GitHub. Everyone else can complete L0 or review product assumptions now.
- B1 defines the shared types before Mike/Conomos split owner and door screens.
- Tell the team which issue/branch you took. Open a draft PR early for substantial work.
- Schema/API changes need a shared-contract update before other tasks depend on them.
- Don't use a generated feature on another person's unmerged branch as an invisible dependency.
- If you encounter another person's modifications, preserve them and describe the conflict.

## Extending the harness at B0

Keep Node/pnpm baseline and pnpm commands portable. Implement scripts using Node or cross-platform tooling, not `rm`, `cp`, `export`, shell-specific chaining, or hard-coded macOS paths. Add app checks to CI and document local database setup on both operating systems. B0 can introduce supported dev dependencies and update the lockfile; don't use `pnpm install --frozen-lockfile` to add dependencies.

Doctor should report required prerequisites honestly. If database or credentials become required for an app task, distinguish them from optional services. Don't make harness checks demand production secrets or send real emails. A fixture-only UI must be labeled.

## Public repository rules

The repository is public. Use synthetic records, no original chat screenshots, no venue/customer data, no personal contact details, and no credentials in commits/issues/PRs. `private: true` in package.json prevents accidental npm publication; it does not make GitHub private. Store configuration locally in ignored .env files when the app needs them. If a secret is exposed, revoke/rotate it first; deleting the file in a new commit does not remove history.
