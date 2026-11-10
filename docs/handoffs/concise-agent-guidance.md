# Concise agent guidance

## Task

User-requested repository preferences on branch docs/concise-agent-guidance.

## Outcome

Agents default to short answers and minimal, readable code with low cyclomatic complexity. Read AGENTS.md when starting a task.

## Changes

Added five communication and code-simplicity guidelines to AGENTS.md, preserving required correctness checks.

## Verification

Using corepack pnpm, doctor, check, and typecheck passed. git diff --cached --check passed. The initial context check required this handoff; context:check --base origin/main passed after staging it.

## Context impact

AGENTS.md owns these preferences. Product behavior, architecture, commands, and implemented capabilities are unchanged.

## Learning note

Cyclomatic complexity reflects independent paths through code; fewer branches generally make code easier to reason about and test.

## Next step

Apply these defaults to future work. These are agent instructions, not automated complexity enforcement. Human review and merge remain pending.
