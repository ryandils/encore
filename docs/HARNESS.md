# Encore's repository harness

Here, "harness" means the shared instructions, task briefs, executable checks, and review loop surrounding an AI coding task. It is not an autonomous agent service or model benchmark. All Codex interfaces should use the same repo contract.

## What runs today

| Command | What it proves |
| --- | --- |
| `pnpm install --frozen-lockfile` | The committed dependency lock can be installed; includes app tooling, TypeScript 7.0.2, its platform package, and Node 24 type definitions |
| `pnpm run doctor` | Node 24/pnpm 12.18.0, Git clone, and expected setup files are present |
| `pnpm run check` | Required docs exist, JSON parses, authored JavaScript files are rejected, simple inline relative file links resolve, and the installed compiler matches the pinned TypeScript 7 dependency; frozen installation validates the pnpm lockfile |
| `pnpm run typecheck` | Generates Next.js route declarations, then runs strict TypeScript 7 checks for the harness, application, tests, and supported configs; no JavaScript input or emitted application code |
| `pnpm run lint` | Biome checks authored application/test/config source using recommended correctness and accessibility rules |
| `pnpm run test` | Landing-page tests verify the demo label, limitations, navigation structure, and absence of data-entry controls |
| `pnpm run build` | Next.js produces an optimized application build with TypeScript checking enabled |
| `pnpm run dev` / `pnpm run start` | Start the development server / serve a completed optimized build locally |

The link checker skips fenced examples and external URLs; it does not validate heading anchors or implement a complete Markdown parser. Doctor/check establish contributor setup and document consistency. App tests cover the setup landing page, not future permissions, money math, or database behavior. All harness scripts/tests remain .ts under strict tsconfig.harness.json, and tsconfig.json covers the app. Node 24 executes erasable TypeScript without a transpiler dependency, but that execution alone does not validate types. `pnpm run compiler:version` prints the compiler version.

CI runs the same baseline plus app lint, tests, and build on Linux, Windows, and macOS for pull requests and main. It has read-only repository permissions. It runs repository/application checks, not Codex, and needs no model credentials. A green result is evidence for the checks actually run, not general approval to ship. Merge rules/branch protections are a separate GitHub setting; this workflow does not enable them.

Next.js uses its `experimental.useTypeScriptCli` integration for TypeScript 7's native compiler; build-time checking remains enabled. With `experimental.strictRouteTypes`, generated `next-env.d.ts` imports the active route types and validator, so development and production output can coexist without duplicate global declarations. Keep those generated imports instead of globbing both output trees into tsconfig.json. Biome supplies linting because the evaluated typescript-eslint release expects the older TypeScript compiler API. Tailwind's PostCSS configuration is JSON, which Next.js supports, rather than authored JavaScript or an unsupported TypeScript PostCSS config. Application and test source still use .ts/.tsx.

## Context upkeep

Follow [WORKFLOW.md](WORKFLOW.md) and the [repository skill](../.agents/skills/encore-context-upkeep/SKILL.md). Read [current context](CONTEXT.md) at task start. Update affected canonical docs and add a new [handoff](handoffs/TEMPLATE.md) for non-document changes. After staging it, run `pnpm run context:check --base origin/main`; `pnpm run context:test` exercises the gate against temporary Git repositories.

CI runs the gate against the PR base or pre-push commit. It checks that a new handoff has filled sections, not whether its statements are true or GitHub issues are synchronized. No background bot is installed and branch protections are not configured by this workflow.

Use `pnpm add -D <package>` to add development dependencies and commit pnpm-lock.yaml. Do not generate package-lock.json. A frozen install intentionally rejects manifest/lock drift. npm remains only an optional way to bootstrap the pinned pnpm executable.

## One task, one reviewable change

1. **Orient:** read AGENTS.md and product docs; inspect branch, status, current tasks, and open PRs. If the agent cannot inspect GitHub, say so and have the human verify the claim before overlapping shared work.
2. **Define:** copy [the task brief](tasks/TEMPLATE.md) or create a task through GitHub's Deliverable issue form. State user outcome, boundaries, dependencies, acceptance examples, and evidence. An issue ID is a claimable coordination point; issue assignment is not a lock.
3. **Plan:** name affected files and checks. For a learning session, explain the plan before making the first edit and give the learner a chance to ask questions. Explicit human instructions to proceed remain valid.
4. **Build:** one branch per task. Prefer the smallest useful vertical slice. No parallel independent app scaffolds.
5. **Verify:** run actual checks and inspect the diff. Record failures as failures. For app behavior, add the specific behavioral evidence required by the task, beyond the harness.
6. **Explain:** the learner can describe what changed, why, and one remaining limit. Agent explanations support this; they are not evidence that the learner understood.
7. **Review:** open a PR with results. Another person reviews; a human decides to merge. After merge, everyone updates their local main.

Prompt files in [.codex/prompts](../.codex/prompts/README.md) are copy/paste recipes. They are **not** automatically executed or special Codex commands. AGENTS.md is the persistent repository instruction entry point. No global Codex settings, permission bypasses, or shared credentials are required.

## Keeping three people from colliding

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
