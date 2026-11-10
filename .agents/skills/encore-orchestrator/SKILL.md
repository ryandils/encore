---
name: encore-orchestrator
description: Coordinate explicitly requested Encore issue implementation or read-only investigation with an accountable lead, parallel subagents, current GitHub claims, independent review, and verified handoffs. Use for named issue action or an authorized request to implement the next ready issue; route issue-listing questions to encore-issues and recommendation questions to encore-prioritize.
---

# Encore orchestrator

Use this skill inside an existing Encore chat. It does not launch chats, install a scheduler, or grant access to GitHub or environments. Follow [AGENTS.md](../../../AGENTS.md), the canonical [workflow](../../../docs/WORKFLOW.md), and the [context-upkeep skill](../encore-context-upkeep/SKILL.md); apply the latter at startup and handoff.

## Resolve the scope

Listing issues belongs to [encore-issues](../encore-issues/SKILL.md); asking what to work on next belongs to [encore-prioritize](../encore-prioritize/SKILL.md). These read-only requests take precedence over broad orchestration triggers and do not authorize a claim or implementation. Continue into implementation only when the user has asked for that action.

These invocations are equivalent entry points; a skill picker is optional:

```text
$encore-orchestrator implement #5
Use encore-orchestrator to implement #5.
$encore-orchestrator investigate #6 read-only
Use encore-orchestrator to implement the next ready issue.
```

Resolve the issue and mode from the request and existing conversation. Explicit implementation authorizes the scoped claim, edits, validation, branch, and reviewable PR workflow; investigation remains read-only. Do not ask again for information or authority already established. If a missing target or mode is genuinely ambiguous, continue read-only triage and ask only for the unresolved scope decision before making changes.

For a named issue, stay on it. An explicit “implement the next ready issue” request permits selection of the highest-priority unclaimed deliverable with merged prerequisites according to the build plan; prefer a small complete outcome. If none is ready, report why. Do not silently substitute another issue for a blocked named target or turn investigation into implementation. Additional issues require scope already authorized by the user or a new assignment.

## Orient and delegate

Read the current [context](../../../docs/CONTEXT.md), [build plan](../../../docs/BUILD_PLAN.md), [harness](../../../docs/HARNESS.md), [cloud startup instructions](../../../docs/CLOUD_ENVIRONMENT.md), README, and relevant product/architecture docs. Inspect actual code, Git status, branches, recent commits, issues, comments, and open PRs. Verify the chat's isolated checkout and preserve existing changes. In implementation mode, follow saved startup instructions and verify the harness.

After orientation, run bounded GitHub triage and local implementation investigation in parallel. Only the lead spawns or assigns agents. Stay within available capacity, combine roles for narrow tasks, and parallelize useful independent work rather than inventing edits.

- **Lead:** selects work, assigns exclusive ownership, integrates evidence, owns every Git mutation and PR creation/update, and remains accountable for completion.
- **Coordinator:** inspects readiness, dependencies, ownership, and overlap; maintains the assignment map; alone writes this chat's authorized issue updates after lead selection.
- **Workers:** investigate read-only or implement only explicitly assigned files. Return changed files, acceptance coverage, exact checks/results, risks, and integration needs to the lead.
- **Independent reviewer:** challenges the combined diff and acceptance evidence, or the investigation's findings; prefer someone who authored none of the changes.

Each assignment specifies outcome, relevant context, dependencies, named files/directories, read/write permission, and expected verification. Agents do not spawn more agents or post duplicate GitHub updates.

## Coordinate before implementation

GitHub owns live status. Immediately before a claim, the coordinator rechecks ownership, comments, overlapping PRs, and merged prerequisites. Record account owner, distinct chat/task owner, branch, narrow scope, and In progress status. Preserve existing discussion. Claims are not atomic locks: stop contested work and resolve ownership without overwriting another claim.

Do not duplicate active work, scaffold competing foundations, or begin dependent implementation before prerequisites merge. When GitHub access fails, report the operation, observed HTTP status when available, safe response details, and authentication mechanism without credentials. Try an available authorized connector; avoid identical retries. Continue local read-only investigation, but do not invent issue state or claim supposedly unowned work.

## Protect the shared checkout

Separate cloud chats have isolated checkouts; workers inside this chat share files and Git state. Implement one issue at a time on one task branch from the appropriate merged base. Only the lead switches branches, stages, commits, stashes, pushes, or otherwise mutates Git. Additional worktrees require an explicit user request.

Assign exclusive file ownership before edits. Give shared contracts, manifests, lockfiles, and configuration one owner; finish prerequisites before dependent changes. Give canonical docs and the required handoff one designated owner. Workers request reassignment before editing outside scope and never revert another worker's changes. Serialize installations and commands that mutate shared generated outputs or fixtures. Stop workers before branch changes or conflicting integration; complete the current handoff and preserve all work before an authorized next issue.

Read-only investigation makes no claims, issue updates, file edits, Git mutations, dependency installs, or generated-output changes. Inspect existing verification evidence and run only non-mutating checks. Return acceptance gaps, dependencies, and a proposed ownership/test plan; label checks that were not run.

## Validate and hand off

In implementation mode, complete the acceptance criteria within scope. Follow the context-upkeep routing table for canonical docs and the per-change handoff. The lead verifies integrated results rather than treating worker reports as proof: run doctor, check, typecheck, and relevant application checks required by AGENTS.md/HARNESS.md. Stage the new handoff before `pnpm run context:check --base origin/main`. UI work requires a narrow-phone browser check. Distinguish harness success, application behavior, setup failures, repository defects, and missing external prerequisites; never weaken checks or claim unrun tests passed.

Both modes require independent review and resolution of substantive findings. For implementation, inspect the final diff/status and confirm checks cover final relevant changes. The lead opens or updates a focused PR with issue reference, behavior, acceptance evidence, checks, and limitations. Keep incomplete work in draft; the coordinator records its actual state and PR link, marking In review only when ready. For read-only investigation, hand off reviewed findings, evidence gaps, blockers, and the proposed plan in this chat without editing or staging a handoff, writing a PR, or updating the issue.

Do not create or close issues, use automatic issue-closing keywords, merge, deploy, publish environments, create chats, or install a scheduler without explicit user authorization for that action. Provide one coherent lead account of selected work, assignments, findings, checks, resolved review findings, PR links, blockers, and next eligible work. Finish the authorized scope; report concrete blockers without implying completion.
