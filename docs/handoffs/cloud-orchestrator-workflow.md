# Parallel cloud chats — orchestrator workflow

## Task

Document the user-requested workflow for separate Encore cloud chats, with each chat's lead orchestrator coordinating multiple parallel subagents. This is a documentation deliverable, not implementation of the example product issues.

## Outcome

Contributors can select **encore cloud env** and current `main` in a new chat, then fill in an issue and mode in the [cloud orchestrator prompt](../../.codex/prompts/cloud-orchestrator.md). Each chat receives one independent implementation or read-only investigation scope. No chats were launched by this change.

## Changes

- Added a reusable launch prompt and linked it from the prompt index.
- Expanded [cloud environment instructions](../CLOUD_ENVIRONMENT.md) with manual launch steps, capability limits, and an illustrative implementation/investigation split across #5, #6, and #8.
- Recorded the saved environment's observed ready/runnable listing on November 10, 2026 without publishing configuration IDs or claiming new runtime startup success.
- Updated [agent instructions](../../AGENTS.md), [workflow](../WORKFLOW.md), and [harness guidance](../HARNESS.md) with the shared coordination policy. The prompt refers to those canonical rules instead of maintaining a separate policy system.
- Aligned the [context-upkeep skill](../../.agents/skills/encore-context-upkeep/SKILL.md) with coordinator-only issue updates and explicit authorization for issue closure.

## Verification

The lead orchestrator ran these checks successfully:

- `corepack pnpm run doctor`
- `corepack pnpm run typecheck`
- `corepack pnpm run check`
- `corepack pnpm run context:check --base origin/main`
- `git diff --cached --check`

Review fixes clarify distinguishable chat/account ownership, non-atomic GitHub claims, and read-only verification without staging, dependency installation, or generated-output changes. The independent reviewer confirmed no outstanding substantive findings; the skill's issue-closure conflict and the prompt's read-only-mode conflict are resolved. Application tests, build, and browser checks were not rerun because this change affects Markdown only.

## Context impact

[CONTEXT.md](../CONTEXT.md) now distinguishes the confirmed saved configuration listing from per-chat runtime verification. [CLOUD_ENVIRONMENT.md](../CLOUD_ENVIRONMENT.md) owns launch/setup guidance, while [WORKFLOW.md](../WORKFLOW.md), [HARNESS.md](../HARNESS.md), and [AGENTS.md](../../AGENTS.md) own contributor coordination rules. The [context-upkeep skill](../../.agents/skills/encore-context-upkeep/SKILL.md) now uses the same coordinator-only issue-update and explicitly authorized closure rules. GitHub remains the source of current issue ownership and readiness. Product behavior, schemas, dependency pins, and application commands are unchanged.

## Learning note

A cloud chat has its own checkout, while its subagents share that checkout. Separate chats avoid filesystem collisions, but they can still duplicate an issue or change the same contract. GitHub claims help coordinate ownership but are not atomic locks; exclusive file assignments prevent workers inside one chat from overwriting each other.

## Next step

After final independent review, submit the documentation PR for human review and merge. The new defaults reach `main` only after that PR merges; then launch each desired cloud chat explicitly with its issue and mode. The current session did not have chat-creation or cross-chat messaging tools, so no new chat launch or cross-chat handoff is claimed. Recheck live GitHub prerequisites before implementation; read-only investigations do not unblock dependent work.
