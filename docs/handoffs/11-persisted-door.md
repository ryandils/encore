# B4 — local persisted door rehearsal

## Task

Independent door client package under #11, branch `feat/b4-live-door`. It began from merged ledger HTTP #36 and integrates merged setup/access #37 without importing unmerged contracts.

## Outcome

The existing door console can use authenticated local HTTP state and writes at `/nights/[nightId]/door`, with explicit persisted-rehearsal labels, separate from the in-memory fixture demo. Reload recovery retains unresolved request IDs and blocks new actions until original acknowledgement.

## Changes

Strict scoped HTTP validation and a 20-second transport timeout preserve unknown outcomes. A single submitted-command journal is partitioned by server-derived user/night; storage writes/readback precede transport, and storage failures pause recording. Reload never automatically resubmits or discards an unresolved request. Default fixture labels/behavior remain unchanged. No production auth, schema, dependency or offline queue added.

## Verification

Local Linux Node 24.22.1/pnpm 12.18.0: cloud bootstrap, doctor/check, strict TypeScript 7, lint (91 files), all 324 unit tests, optimized build and production HTTP page denial passed. Independent source review found no unresolved findings and independently ran all 40 adapter/journal tests.

Actual Chromium 156.0.8078.79 against PostgreSQL passed two isolated synthetic cookie contexts at 320px: four paid admissions and one exit, shared refresh/reload persistence, committed-but-lost acknowledgement followed by reload and blocked controls until identical-ID retry, exactly one stored event, wrong-venue denial, already-open staff revocation with disabled controls/API 403, 44px targets, no horizontal overflow or page errors. The first run used a global alert selector for revocation; it was corrected to the console-specific permission alert and explicit disabled control, retaining the security assertion and adding an enabled-before-revoke precondition. The final strengthened run passed.

This is automated separate-session evidence, not physical devices or production acceptance. No screenshots/traces/passwords were saved. Final staged context/whitespace checks passed; the task database container was stopped with its named volume retained; hosted CI for the new PR is pending.

## Context impact

README/QUICKSTART/LOCAL_DATABASE replace stale broad absence claims with current local capability and production limits. ARCHITECTURE and CONTEXT document the separate client and per-tab recovery boundaries. HARNESS and CI include the real browser verifier. Production HTTP tests exercise denial of the new page.

## Learning note

A missing acknowledgement does not prove that a tap failed. Remembering and retrying its original ID lets the server acknowledge one stored action instead of recording the same person twice.

## Next step

Closing the tab or clearing storage can lose the local journal; use physical backup and reconcile before leaving. This remains a synthetic local rehearsal, not a real venue service. Remaining #11 work includes durable owner navigation/history and staff management UI, invitation acceptance UI, complete protected audit export, production verification/recovery and real-device evidence. #12 still requires those gates plus a willing venue and observed results.
