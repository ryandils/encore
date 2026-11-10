# Encore orchestrator — repository-local skill

## Task

Provide the user-requested Encore orchestration workflow as a repository-local skill in [PR #21](https://github.com/ryandils/encore/pull/21), so it can be invoked in the current chat without copying a long prompt or switching chats. This is a contributor-workflow deliverable, not implementation of the example product issues.

## Outcome

In a checkout containing the change, send `$encore-orchestrator implement #5` or `$encore-orchestrator investigate #6`. The plain-language fallback is `Use encore-orchestrator to implement #5`. [AGENTS.md](../../AGENTS.md) explicitly routes relevant requests to the skill when automatic discovery is unavailable. The skill applies the shared coordination policy with parallel subagents and independent review.

The skill reaches `main` only after PR #21 merges. No global installation, skill-picker behavior, new chat launch, or cross-chat handoff is claimed.

## Changes

- Added [.agents/skills/encore-orchestrator/SKILL.md](../../.agents/skills/encore-orchestrator/SKILL.md) as the reusable entry point for implementation and read-only investigation.
- Replaced the long [cloud prompt](../../.codex/prompts/cloud-orchestrator.md) with a short compatibility entry and invocation examples; its existing path still works.
- Updated agent routing, the prompt index, and cloud/harness/context guidance to use the skill in the current chat. [WORKFLOW.md](../WORKFLOW.md) remains the canonical coordination policy rather than duplicating it across entry points.
- Retained the parallel-cloud ownership rules and the [context-upkeep skill](../../.agents/skills/encore-context-upkeep/SKILL.md) alignment: each coordinator updates only its own issue, and issue closure requires explicit authorization.
- Recorded the saved environment's observed ready/runnable listing on November 10, 2026 without publishing configuration IDs or claiming runtime startup success.

## Verification

The lead ran `corepack pnpm run doctor`, `corepack pnpm run typecheck`, `corepack pnpm run check`, `corepack pnpm run context:check --base origin/main`, and `git diff --cached --check` against the skill revision; all passed. The skill worker validated YAML name/description fields and seven local links; the lead independently read the frontmatter and the repository check resolved local links.

Independent review found no substantive issues: frontmatter/triggers are valid, coordination and read-only safeguards are preserved, context-upkeep and AGENTS.md fallback routing are explicit, and the former prompt is a short compatibility entry. Application tests, build, and browser checks were not rerun because application behavior/configuration is unchanged. Skill-picker discovery and actual invocation in another host have not been tested.

## Context impact

[AGENTS.md](../../AGENTS.md) routes the skill explicitly. [CLOUD_ENVIRONMENT.md](../CLOUD_ENVIRONMENT.md) owns usage and checkout availability; [WORKFLOW.md](../WORKFLOW.md) retains ownership/validation policy. [HARNESS.md](../HARNESS.md), [CONTEXT.md](../CONTEXT.md), and the [prompt index](../../.codex/prompts/README.md) link to the skill instead of requiring the old long prompt. GitHub remains the source of issue ownership/readiness. Product behavior, schemas, dependency pins, and application commands are unchanged.

## Learning note

A repository-local skill packages reusable instructions; it is not a new service or permission grant. Explicit AGENTS.md routing lets an agent read those instructions even if an interface does not list the skill automatically. Subagents still share the current chat's checkout, so file ownership and GitHub coordination remain necessary.

## Next step

Human review and merge of PR #21 remain next. Use the one-line skill request in a checkout containing the change; after merge, update other checkouts from `main`. Recheck live GitHub prerequisites before any example implementation. No new chats, environment publication, product issue claims, or dependency unblocking result from adding the skill.
