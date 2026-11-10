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
- In progress: record the owner, branch, and narrow task being built.
- In review: link the PR and its evidence; avoid claiming another task that changes the same contracts.
- Done: confirmed merge and acceptance; close the deliverable issue. Close a parent only after all children and milestone acceptance pass.
- Blocked: name the concrete unmet issue/capability. After merge, recheck dependents and mark Ready only when every prerequisite is met.

Agents working an assigned task may maintain that task's issue status and evidence. Human decisions remain for scope changes, merge and production deployment unless already explicitly authorized. No background process selects or starts work; a user/Codex session initiates each task.

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
