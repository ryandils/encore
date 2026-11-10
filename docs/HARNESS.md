# Encore's repository harness

Here, "harness" means the shared instructions, task briefs, executable checks, and review loop surrounding an AI coding task. It is not an autonomous agent service or model benchmark. All Codex interfaces should use the same repo contract.

## What runs today

| Command | What it proves |
| --- | --- |
| `npm ci` | The committed dependency lock can be installed; there are no third-party harness dependencies today |
| `npm run doctor` | Node 24/npm 11, Git clone, and expected setup files are present |
| `npm run check` | Required docs exist, JSON parses, Node scripts parse, and simple inline relative file links resolve |

The link checker skips fenced examples and external URLs; it does not validate heading anchors or implement a complete Markdown parser. None of these commands checks product behavior, permissions, money math, or a database. B0 must add genuine app lint/typecheck/test/build commands without replacing these with success stubs.

CI runs the same baseline on Linux, Windows, and macOS for pull requests and main. It has read-only repository permissions. It runs repository checks, not Codex, and needs no model credentials. A green result is evidence for the checks actually run, not general approval to ship. Merge rules/branch protections are a separate GitHub setting; this workflow does not enable them.

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

Keep Node/npm baseline and npm commands portable. Implement scripts using Node or cross-platform tooling, not `rm`, `cp`, `export`, shell-specific chaining, or hard-coded macOS paths. Add app checks to CI and document local database setup on both operating systems. B0 can introduce supported dev dependencies and update the lockfile; don't use `npm ci` to add dependencies.

Doctor should report required prerequisites honestly. If database or credentials become required for an app task, distinguish them from optional services. Don't make harness checks demand production secrets or send real emails. A fixture-only UI must be labeled.

## Public repository rules

The repository is public. Use synthetic records, no original chat screenshots, no venue/customer data, no personal contact details, and no credentials in commits/issues/PRs. `private: true` in package.json prevents accidental npm publication; it does not make GitHub private. Store configuration locally in ignored .env files when the app needs them. If a secret is exposed, revoke/rotate it first; deleting the file in a new commit does not remove history.
