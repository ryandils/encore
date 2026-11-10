# Consolidated agent guidance and post-PR #29 context upkeep

## Task

The user authorized merging [PR #29](https://github.com/ryandils/encore/pull/29), then running `encore-context-upkeep`. GitHub confirmed its squash merge as `3ed8400b1c2b666d8cde1baef60ae5322fa3ccef`. This follow-up starts from that merged `main` on `chore/post-29-context-upkeep`. The user then requested consolidating the context upkeep from the development-skills and issue-label chats; this PR also incorporates the concise-answer and minimal-code preferences previously proposed in PR #32.

## Outcome

Agent orientation now describes the implemented synthetic door and owner rehearsals, and continuation pointers lead to B4's prerequisite/ownership checks. Agents also default to succinct answers and the smallest readable implementation that meets requirements. No backend implementation or readiness claim is introduced.

## Changes

- Corrected the stale screen-absence statement in `AGENTS.md`. Actual routes and merged [PR #28](https://github.com/ryandils/encore/pull/28) / [PR #30](https://github.com/ryandils/encore/pull/30) establish the browser-memory fixtures and production guards.
- Updated README and CONTEXT continuation pointers without duplicating the live issue board. Preserved both demos, their limitations, and historical handoffs.
- Mirrored #9's coordinator-recorded Done status in its label after independently confirming PR #28 merged as `62391c9`. Preserved Conomos's assignment and issue body; no issue was closed.

- Added the five communication/code-simplicity guidelines from PR #32 to `AGENTS.md`, preserving correctness, authorization, validation, error handling, and meaningful tests. Consolidated the two proposed handoffs into this single record.

## Verification

On merged `3ed8400`, `corepack pnpm run doctor`, `check`, `typecheck`, and `context:check --base origin/main` passed. Strict checking generated Prisma client and Next route types normally. This runtime's pass is separate from other chats' historical Prisma-download failures.

After the orientation edits, repository and whitespace checks passed. The first context gate correctly requested a new handoff because `AGENTS.md` counts as contributor tooling; the gate passed with this structured handoff staged. Independent read-only review found no actionable findings, and staged/unstaged whitespace checks passed. No application behavior changed, so new app/browser/database acceptance was not run.

PR #29's exact head `86f9d8c` had successful CI before merge. PR #30's integrated head `67ea6fc` has a separately confirmed successful workflow run 42921497213; its PR records full five-job validation and synthetic owner acceptance. These are hosted results, not new local integration tests.

For the consolidated diff, frozen dependency installation, doctor, and repository check passed in a fresh checkout. Standard typecheck was attempted but stopped before checking types: Prisma checksum download from `binaries.prisma.sh` returned HTTP 403. No checksum bypass was used. Earlier successful checks above belong to the original changes. Independent read-only review of the combined guidance/context diff found no actionable issues. The staged `context:check --base origin/main` and staged/unstaged whitespace checks passed. App/browser/database checks were not rerun for this documentation-only consolidation.

## Context impact

`AGENTS.md` owns the communication and implementation preferences and now agrees with the implemented demo capabilities and B4 boundary. `README.md` and `docs/CONTEXT.md` direct the next contributor to backend prerequisites and live ownership checks. Product scope, APIs/schema, dependencies, setup commands, and environment configuration did not change.

## Learning note

The two browser rehearsals demonstrate controls and calculations, but refreshing clears their state. B4 must connect them through authenticated, transactional server storage before devices can share a ledger.

Fewer independent branches through code generally make it easier to understand and test; minimum code still has to satisfy correctness requirements. These preferences are instructions, not automated complexity enforcement.

## Next step

Review this focused context follow-up. At this check, #10's issue still says In progress despite confirmed PR #30 merge `4ba9d4e`; its existing coordinator must reconcile the final acceptance/status evidence. Recheck that record and all #11 prerequisites before claiming backend implementation. No other task is claimed, and no follow-up merge, issue closure, deployment, or environment publication is included.
