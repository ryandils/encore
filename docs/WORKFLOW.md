# Agent task and documentation workflow

## Source of truth

| Record | Owns |
| --- | --- |
| AGENTS.md and context-upkeep skill | How agents work and preserve context |
| CONTEXT.md | Small snapshot of implemented capabilities and durable constraints |
| MVP.md / ARCHITECTURE.md | Product boundaries and shared technical contracts |
| BUILD_PLAN.md | Milestone explanations and dependency shape |
| GitHub issues | Current task status, owner, dependency links and PR evidence |
| Per-change handoffs / PRs | What changed, what was verified, what is next |

## GitHub lifecycle

Use a **Status** field in the issue body: Ready → In progress → In review → Done, or Blocked. Tracking milestones use Planned until their child deliverables and acceptance are complete. No GitHub Project or custom status-label automation has been configured; this convention works with ordinary issues.

- Ready: acceptance defined, dependencies merged, unclaimed. Check actual dependencies, not just a possibly stale Status field.
- In progress: record the human/account owner, distinct chat/task owner, branch, and narrow task being built.
- In review: link the PR and its evidence; avoid claiming another task that changes the same contracts.
- Done: confirmed merge and acceptance. Issue closure requires explicit authorization; close a parent only after all children and milestone acceptance pass and closure is authorized.
- Blocked: name the concrete unmet issue/capability. After merge, recheck dependents and mark Ready only when every prerequisite is met.

The coordinator for an authorized task maintains only that task's issue status and evidence. Do not create issues, close issues, merge PRs, deploy, or publish environments without explicit authorization. Avoid automatic issue-closing keywords in PR descriptions unless closure is authorized. Human decisions remain for consequential scope changes. No background process selects or starts work; a user/Codex session initiates each task.

## Cloud orchestration

Use **encore cloud env** for authorized cloud work. Each chat has an isolated checkout, accountable lead orchestrator, and one issue/task branch. Separate chats may proceed in parallel on independent work within available capacity. The environment supplies startup configuration, not ownership coordination or a scheduler.

After orientation, run GitHub triage and local investigation in parallel. Inspect issues, comments, open PRs, actual code, and merged prerequisites. The coordinator recommends ready work; the lead selects it. Immediately before claiming, recheck ownership and overlap, then record a distinct chat/task owner and branch alongside the account owner. An assignee alone is not a lock when chats share an account. Preserve discussion and claims; if ownership is contested, stop overlapping work and resolve the assignment without overwriting another claim. GitHub updates are not atomic locks.

Dependencies must merge before dependent implementation starts. Do not build competing scaffolds or use unmerged contracts to keep chats busy. Read-only preparation for blocked work is allowed, but is not an implementation claim. If GitHub cannot be read, report the access failure and continue local investigation until ownership can be verified.

### Team inside each chat

The lead uses multiple parallel subagents where work is independent. Only the lead assigns/spawns agents. Combine roles for small tasks and parallelize useful investigation/review rather than manufacturing edits.

| Role | Responsibility and permissions |
| --- | --- |
| Lead orchestrator | Selects the issue, assigns agents, integrates results, owns all Git mutations and PR creation/updates, and verifies final acceptance. |
| Coordinator | Inspects GitHub readiness/ownership/dependencies/overlaps, records the lead's assignment map, and alone updates this chat's claimed issue after lead authorization. Other chats retain their own issue writers. |
| Investigation workers | Inspect bounded implementation/acceptance/test questions in parallel, read-only unless explicitly reassigned. |
| Implementation workers | Edit only their assigned exclusive files/directories and return acceptance evidence; request reassignment before editing outside their scope. |
| Independent reviewer | Reviews the combined diff for correctness, security, regressions, and acceptance coverage; prefer an agent who authored none of the changes. Reports findings to the lead. |

Assignments specify outcome, context, dependencies, named files, read/write permissions, and expected checks. Stay within host limits. Workers return changes/files, acceptance coverage, exact checks/results, and risks or integration needs; they do not post duplicate GitHub updates or spawn agents.

### Shared-checkout safety and handoff

Subagents share the chat's filesystem/Git state. Implement one issue at a time; only the lead may switch branches, stage, commit, stash, push, or perform other Git mutations. Additional worktrees require an explicit user request.

- Assign each edited file/directory to one worker. Give shared interfaces, dependency manifests/lockfiles, and common configuration one owner; finish required contracts before dependent edits.
- Assign canonical docs and the required handoff to one owner. Never revert another worker's edits; request reassignment when ownership must change.
- Serialize dependency installation and commands that mutate the same generated outputs or fixtures. Read-only investigation can continue independently.
- Stop workers from editing before changing branches or integrating conflicting work. Before the next issue, finish the current handoff, preserve all changes, and establish the next branch from the appropriate merged base.

The lead inspects the final diff and integrated repository/application checks; worker reports are evidence to verify. Resolve substantive independent-review findings before marking a PR ready. Report failed/unrun checks and external prerequisites; keep incomplete work in draft where appropriate. The coordinator links the PR and records the claimed issue's actual state. Handoff includes behavior, acceptance evidence, checks, resolved findings, limitations, and next eligible work.

Use [the Encore skill entry points](CLOUD_ENVIRONMENT.md) in the current chat. Issue-listing requests route to `encore-issues`; recommendation requests route to `encore-prioritize`. Both remain read-only and take precedence over broad orchestration triggers. `encore-orchestrator` applies this policy to an explicit implementation or investigation request. AGENTS.md provides routing when automatic discovery is unavailable; the checkout must contain the skill files. Skills do not create chats or schedule unattended work.

## Every change carries context

Read [.agents/skills/encore-context-upkeep/SKILL.md](../.agents/skills/encore-context-upkeep/SKILL.md) and use its routing table. Add a new structured handoff for each code/tooling/dependency/configuration PR. Canonical docs update only when their facts change. Docs-only PRs still maintain accuracy and explain doc impact in the PR; the gate does not demand an extra handoff for a simple wording fix.

Run locally after staging your new handoff:

```text
pnpm run doctor
pnpm run check
pnpm run context:check --base origin/main
```

The context gate compares changes since the merge base (including staged/unstaged work) and requires a newly added, non-template handoff with filled sections. Fetch origin when your reference is stale. New handoffs must be staged or committed to appear in Git's diff. CI fetches history and passes the PR base SHA or pre-push SHA explicitly. A missing/invalid base fails with instructions, never silently passes.

This gate does not prove documentation semantics or issue synchronization. Review the Context impact section alongside the actual diff. CI runs only the check; it never generates prose, changes files, or posts bot comments. Required merge enforcement still depends on repository branch/ruleset settings, which this change does not configure.

## Conomos's catch-up path

1. Read CONTEXT.md for what exists now.
2. Open the relevant task issue and PR; check dependencies and actual status.
3. Read the PR's handoff for the plain-language result, verification, one concept and next step.
4. Pull merged changes and follow QUICKSTART.md. Do not reproduce every historical agent chat.

Daily summaries are optional; do not create a separate mandatory progress diary that competes with issues.
