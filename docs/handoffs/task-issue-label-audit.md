# Issue-label audit and context upkeep

## Task

User-authorized review of every open issue in `ryandils/encore` against merged PRs and commits on `main`, preserving Conomos's #9/#10 work, followed by `encore-context-upkeep`. Documentation branch: `chore/issue-history-triage`, based on `21228f0f3ab6ad0419a61272caa97ab807a2e2ce`. No application implementation was claimed.

## Outcome

At the November 10, 2026, 5:40 PM EST audit snapshot, all ten open issues received one manual status label. Six are `status:done` (#3–#7 and #18), two are `status:in-progress` (#9/#10), and two are `status:blocked` (#11/#12). Open the issues and filter by label to inspect the underlying evidence. All ten remain open; GitHub state and workflow completion are separate.

## Changes

- Verified #4/#5/#6/#7 against merged PRs #20/#22/#24/#25 and their commits on `main`. Their acceptance supports the parent #3's Done status and completed child checklist; the parent remains open.
- Reviewed #7's later native macOS acceptance comment, which resolves the historical missing-platform blocker. Preserved the historical handoffs and separate Windows/native/hosted evidence.
- Resolved #18's stale saved-environment blocker using merged cloud configuration documentation, current runtime readiness, and a fresh successful bootstrap. Updated its body and label without changing environment settings or claiming sharing access.
- Preserved Conomos's assignees, claims, and bodies for #9/#10. During triage #9's coordinator updated its body to In progress and linked draft PR #28; the label follows that latest record, not the earlier blocked snapshot. Neither screen implementation is merged. #11 still needs #9/#10; #12 still needs #11.
- Documented manual status-label mirrors in the workflow and replaced stale B0 work pointers. No bot or label automation was added.

## Verification

- GitHub REST search reported `total_count: 10`, `incomplete_results: false`; the open issue collection contained ten issues plus PR #28, which was excluded. Page two was empty. Individual issue/PR reads verified statuses, ownership, acceptance, and merge evidence. The `main` commit collection and fetched Git history agree at `21228f0`.
- Fresh `corepack pnpm run cloud:setup` passed on Linux with Node 24.22.1, pnpm 12.18.0, and TypeScript 7.0.2: frozen install, normal Prisma engine/client generation, doctor, strict harness/application typecheck, repository check, and both context-gate tests. This is checkout/bootstrap evidence, not new app, database, or browser acceptance.
- After documentation edits, doctor and repository check passed again. Staged `context:check --base origin/main` passed for the docs-only diff, and staged/unstaged whitespace checks passed. Final GitHub collection readback confirmed all ten labels match their body Status fields, all ten issues remain open, and #9/#10 retain the `conomos` assignee.
- Independent read-only review confirmed the B0 and cloud-blocker conclusions, final documentation scope, and latest #9/#10 records; no actionable findings remained.

## Context impact

`docs/WORKFLOW.md` defines the new manual label convention while retaining issue bodies as source of truth. `docs/CONTEXT.md` records native baseline evidence, the merged design-reference boundary, and current work pointers. `README.md` points contributors to screen claims and backend prerequisites. No product behavior, API/schema, setup command, dependency, or runtime configuration changed, so those canonical contracts need no edits.

## Learning note

A merged PR shows what reached `main`; acceptance evidence shows whether the task's promised outcome was verified. A Done label can therefore coexist with an open issue when closure was not requested. Draft PRs and synthetic fixtures do not establish shared backend readiness.

## Next step

Keep #9/#10 coordination with their existing owners and inspect their latest evidence before further labels or claims. B4 implementation requires all of its prerequisites; B5 still requires B4 and actual pilot readiness. No new issue, issue closure, merge, deployment, or environment publication is part of this audit. This handoff is a dated change record, not a second live issue board.
