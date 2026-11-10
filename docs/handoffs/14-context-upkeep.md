# H1 — durable task context and handoffs

## Task

[Issue #14](https://github.com/ryandils/encore/issues/14). This file accompanies the context-upkeep PR; it does not claim a merge.

## Outcome

Agents start from a concise project snapshot, maintain impacted docs as part of a change, and leave a small handoff Conomos can read. Run `npm run context:test`, then stage changes and use `npm run context:check -- --base origin/main` to try the gate.

## Changes

Added the repository-local encore-context-upkeep skill, explicit AGENTS.md routing, current-context/workflow docs, handoff template, portable Git-diff check, and gate tests. CI fetches history and checks against the event's base commit without generating content or posting comments.

Created roadmap issues #3–#12 and Conomos's independent L0 issue #13. B0 has four child deliverables; issue bodies own lifecycle/dependencies. No GitHub Project, custom labels, background agent runner, or branch-protection configuration was added.

## Verification

Locally on Linux: `npm ci --ignore-scripts`, `npm run doctor`, `npm run check`, and `npm run compiler:version` passed (TypeScript 7.0.2). `npm run context:test` passed both tests, including a real temporary Git repository exercising docs-only edits, missing/staged/committed/deleted handoffs and invalid base refs.

The actual working-branch gate correctly failed before adding this handoff. After adding and staging this file, the gate and staged whitespace check passed. Cross-platform execution is left to CI; interactive Windows setup and app behavior are not claimed here. No app exists yet.

## Context impact

Updated AGENTS.md and Codex prompts to route context upkeep; README/quickstart/harness to explain the new commands and source of truth; BUILD_PLAN.md to link live issues without duplicated daily status; task/PR templates to request doc impact and handoff evidence. Added CONTEXT.md, WORKFLOW.md, and the skill to make those rules durable. Product behavior and API/schema contracts are unchanged, so MVP.md and ARCHITECTURE.md did not need changes.

## Learning note

A handoff records what one change accomplished and how it was checked. Current project context says what works now; issues say who is working on what. Keeping those jobs separate avoids rereading chats and conflicting status logs.

## Next step

Review/merge this PR, then take B0.1 (#4) if still Ready and unclaimed. Conomos can independently complete L0 (#13). H1 remains In review until a confirmed merge; dependencies and milestone issues remain open. The gate enforces presence/structure, not the truth of prose, issue synchronization, or required merge protection.
