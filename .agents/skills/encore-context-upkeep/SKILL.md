---
name: encore-context-upkeep
description: Keep Encore project context, canonical docs, GitHub task state, and change handoffs accurate whenever changing code, tooling, dependencies, contracts, or setup instructions in this repository.
---

# Encore context upkeep

Apply this skill at task start and before a PR/handoff. It is repository-local; AGENTS.md explicitly routes agents here even when their interface does not discover skills. This file does not run a background service or grant external permissions.

## Start from current evidence

1. Read AGENTS.md, docs/CONTEXT.md, docs/WORKFLOW.md, and the task issue. Open the canonical product/architecture docs relevant to the task.
2. Inspect the actual branch, git status, current code and open PRs. Inspect recent merged handoffs relevant to the touched subsystem; do not load all history by default.
3. Recheck issue dependencies and ownership on GitHub before claiming a Ready task. If GitHub is unavailable, report that coordination is unverified; do not invent task state.
4. Record the task claim and branch in the issue when authorized. This project's task workflow authorizes updating the claimed task's status, dependencies and handoff links, not sending unrelated messages.

## Keep a small durable context

- docs/CONTEXT.md describes implemented capabilities, absent features, durable constraints, and where to find the next work. It is not a second issue board or diary. Update it when capabilities/constraints change.
- GitHub issues are the live status/ownership/dependency record. The build plan explains milestones and links to issues; do not maintain duplicate completion checklists in multiple files.
- Each code/tooling/dependency/configuration PR adds one uniquely named docs/handoffs/<issue-or-task>-<short-description>.md. Use docs/handoffs/TEMPLATE.md. Multiple agents create different files, not conflicting entries in one log.
- Read current code before trusting an old handoff. A handoff is evidence for that change, not an immutable description of today's app.

## Route changes to canonical docs

| Change | Update |
| --- | --- |
| Install/run/env/runtime/dependencies | README.md and docs/QUICKSTART.md where user steps change |
| API/schema/auth/roles/money/concurrency | docs/ARCHITECTURE.md |
| Product behavior or scope | docs/MVP.md |
| Contributor rules/commands/CI | AGENTS.md and docs/HARNESS.md as affected |
| Milestone dependencies | docs/BUILD_PLAN.md and affected GitHub issues |
| Operator procedures or readiness | docs/PILOT.md |
| What works now or persistent constraints | docs/CONTEXT.md |

Do not rewrite unrelated docs to satisfy a checkbox. In the handoff's Context impact section, list the files updated and why; if no canonical doc changed, explain concretely why behavior/contracts/setup remain the same. Never mark a PR as merged or a task Done before confirmation.

## Close the loop

1. Complete the smallest authorized deliverable and run actual checks. Record commands/results, fixture versus real integration, missing evidence and blockers. Do not turn planned checks into claimed results.
2. Add the change handoff and update impacted docs in the same PR. Give Conomos a short plain-language explanation, how to try the result, and one concept to learn.
3. Run npm run doctor, npm run check, npm run context:check -- --base origin/main, and appropriate app checks when present. Context checking compares committed changes plus the staged/unstaged working tree to the merge base; new handoff files may be staged before checking.
4. Set the claimed issue to In review with its PR link. The PR may use Closes #N for its own completed deliverable. Do not close a parent milestone just because one child shipped.
5. Humans review/merge unless explicitly authorized otherwise. After a confirmed merge, close/update the task and unblock dependent tasks only when all their prerequisites are satisfied. If tools cannot do so, report the exact pending synchronization in the handoff.

## Limits

The CI gate verifies a new structured handoff accompanies non-document changes; it cannot judge truth, update GitHub automatically, or prove every canonical doc is current. The skill handles that reasoning, and human review checks it. No auto-commits, unattended LLM jobs, additional bots, model API keys, or permission escalation are installed.
