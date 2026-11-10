# Encore skills — inventory, prioritization, and orchestration

## Task

Deliver three repository-local Encore skills in [PR #21](https://github.com/ryandils/encore/pull/21) so users can list issues, ask for a ranked opinion, or request scoped work in the current chat. This is a contributor-workflow deliverable, not implementation of the example product issues. The user has authorized merging PR #21 after validation; no merge is claimed by this handoff.

## Outcome

In a checkout containing the change, `$encore-issues` lists all open and closed issues, `$encore-prioritize` gives an evidence-backed ranked recommendation, and `$encore-orchestrator implement #5` requests scoped implementation. `$encore-orchestrator investigate #6` remains read-only. [AGENTS.md](../../AGENTS.md) explicitly routes named and plain-language requests when automatic skill discovery is unavailable.

Listing and recommendation questions take precedence over orchestration triggers and do not authorize claims or edits. Issue numbers are examples, not standing claims or recommendations. No global installation, skill-picker behavior, new chat launch, or cross-chat handoff is claimed.

## Changes

- Added [encore-issues](../../.agents/skills/encore-issues/SKILL.md) for complete open/closed issue inventory and optional state filtering.
- Added [encore-prioritize](../../.agents/skills/encore-prioritize/SKILL.md) for ranked opinions grounded in current GitHub and implementation evidence, without taking work.
- Added [encore-orchestrator](../../.agents/skills/encore-orchestrator/SKILL.md) for scoped implementation/read-only investigation with parallel subagents and independent review; its routing explicitly defers listing/recommendation questions to the read-only skills.
- Replaced the long [cloud prompt](../../.codex/prompts/cloud-orchestrator.md) with a compatibility entry and short examples. Updated agent routing, the prompt index, and cloud/harness/context guidance. [WORKFLOW.md](../WORKFLOW.md) remains the canonical coordination policy.
- Retained the parallel-cloud ownership rules and [context-upkeep skill](../../.agents/skills/encore-context-upkeep/SKILL.md) alignment: each coordinator updates only its own issue; issue closure requires explicit authorization.
- Recorded the saved environment's observed ready/runnable listing on November 10, 2026 without configuration IDs or an unobserved runtime-startup claim.

## Verification

The lead ran `corepack pnpm run doctor` (Node 24.22.1/pnpm 12.18.0), `corepack pnpm run typecheck` (strict TypeScript 7), `corepack pnpm run check`, `corepack pnpm run context:check --base origin/main`, and `git diff --cached --check` against this three-skill revision; all passed.

Independent review found no outstanding substantive findings. Review fixes ensure retrieval uses the selected repository, open PRs receive separate repository-wide coverage rather than relying on issue references, and closed issues cannot become ready candidates or be silently reopened. An opinion alone remains read-only while an explicit implementation request in the same message retains its authority. Manual reasoning covered capped/all-state listings, Open/Done contradictions, blocked/claimed/already-implemented issues, no-ready results, and partial evidence; these were inspected scenarios, not executed tests.

No live inventory/prioritization invocation, skill-picker check, or invocation in another host was performed. Application tests, build, and browser checks were not rerun because application behavior/configuration is unchanged. Hosted CI and merge remain pending.

## Context impact

[AGENTS.md](../../AGENTS.md) routes all three skills with read-only precedence. [CLOUD_ENVIRONMENT.md](../CLOUD_ENVIRONMENT.md) owns the invocation table and checkout availability; [WORKFLOW.md](../WORKFLOW.md) retains coordination policy. [HARNESS.md](../HARNESS.md), [CONTEXT.md](../CONTEXT.md), and the [prompt index](../../.codex/prompts/README.md) point to the appropriate entry points. GitHub remains the source of issue ownership/readiness. Product behavior, schemas, dependency pins, and application commands are unchanged.

## Learning note

A repository-local skill packages reusable instructions, not a new service or permission grant. Inventory answers what exists; prioritization explains what appears worth doing next; orchestration performs explicitly requested work. Keeping those intents separate makes asking for advice safe without accidentally claiming an issue.

## Next step

After hosted CI passes, perform the user-authorized merge of PR #21. After confirmed merge, contributors can update their checkouts from `main` and use the short requests in the current chat. Provide Conomos a copy-paste usage message without sending it. Recheck live GitHub prerequisites before any implementation; adding these skills does not claim product issues or unblock dependencies.
