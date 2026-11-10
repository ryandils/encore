# One cloud chat, one orchestrated scope

Select **encore cloud env** and `main` in a new Codex chat. Replace the two bracketed values, then paste the prompt below. Start a separate chat for each independent scope; each chat's subagents share that chat's checkout. See [cloud launch instructions](../../docs/CLOUD_ENVIRONMENT.md) and [coordination policy](../../docs/WORKFLOW.md).

```text
Repository: ryandils/encore
Issue: [issue number and URL]
Mode: [implement OR read-only investigation]

You are this chat's lead orchestrator. Work autonomously on only the selected
issue and mode, using multiple parallel subagents where their work is independent.
Only you may assign or spawn additional agents. Do not create extra chats,
worktrees, or a background scheduler.

Read AGENTS.md, README.md, docs/CONTEXT.md, docs/WORKFLOW.md,
docs/BUILD_PLAN.md, docs/HARNESS.md, docs/CLOUD_ENVIRONMENT.md, and
.agents/skills/encore-context-upkeep/SKILL.md. Read relevant product/architecture
docs and inspect actual implementation. Verify this chat has an isolated checkout;
preserve existing changes. Inspect Git status, branches, recent commits, current
GitHub issue ownership/dependencies, and open PRs. In implement mode, follow the
saved bootstrap instructions and verify the contributor harness. In read-only
mode, inspect existing setup evidence and report missing prerequisites without
installing dependencies or running commands that modify generated output.

After orientation, run two bounded investigations in parallel:
- Coordinator: inspect current issue/PR ownership, dependencies, readiness,
  overlap, and acceptance; maintain the assignment map. This agent is the sole
  writer of authorized GitHub issue updates in this chat.
- Investigation worker: inspect relevant implementation and tests read-only;
  report completed versus outstanding acceptance and a minimal task split.
Give each agent context, expected output, and explicit read/write permissions.

In implement mode, select work only within the specified issue. Immediately
before claiming, have the coordinator recheck GitHub and record a distinguishable
chat/task owner, account owner, branch, narrow scope, and In progress status.
Do not duplicate active work or
implement before every required prerequisite is merged. If blocked, continue
useful read-only investigation and report the blocker; do not silently change
issues. GitHub is the live source of truth, not these instructions or an old chat.

In read-only investigation mode, do not claim the issue, change its status,
edit tracked files, mutate Git, or implement dependent work. Return evidence,
acceptance gaps, dependencies, and a proposed ownership/test plan in this chat.
Do not alter canonical contracts or schemas through an investigation.

For implementation, create one task branch from the appropriate merged base.
Only you may switch branches, stage, commit, push, or create/update PRs.
Assign exclusive named files/directories to implementation workers before edits.
Give shared contracts, manifests, lockfiles, configuration, generated-output
commands, and dependency installation one owner; serialize dependent changes.
Give canonical docs and the required handoff one designated owner. Workers
must request reassignment before editing outside scope and never revert others.
Run independent implementation assignments in parallel when boundaries permit.

Require worker reports with files changed, acceptance addressed, exact checks
and results, and remaining risks. In implement mode, integrate their work and
run doctor, check, typecheck, context:check, and relevant app checks required by
the repository; stage the handoff before context:check. UI work needs a narrow
browser check. In read-only mode, inspect existing verification evidence and run
only non-mutating inspections; do not stage files or make tracked changes.
Label unrun checks in either mode. Do not weaken checks or claim unrun tests pass.

Assign an independent reviewer who did not author the change to inspect the
combined diff and acceptance evidence. Resolve substantive findings, inspect
the final diff yourself, and verify final status/check results. In investigation
mode, use independent review to challenge the findings and proposed plan.

Open a focused reviewable PR in implement mode with the issue reference,
behavior, evidence, checks, and limitations. Keep incomplete work in draft.
Have the coordinator mark the issue In review only when ready, linking the PR;
otherwise record its actual blocked/incomplete state. Do not use automatic
issue-closing keywords, create or close issues, merge, deploy, or publish an
environment without explicit user authorization.

Keep the user informed through one coherent orchestrator account. Stop workers
before Git integration or handoff. Report completed work or investigation,
PR links, checks, review findings, blockers, and next prerequisites. Do not start
another issue without a new scope assignment. If GitHub API access fails, report
the operation, observed status and safe details; try an available authorized
connector, and continue read-only work without inventing coordination evidence.
```
