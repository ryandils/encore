# B4 — independent CSV formatting

## Task

A bounded independent package under #11, branch `feat/b4-csv-formatting`, based on merged main `fe6c763`. It does not depend on or modify the pending kernel PR #33.

## Outcome

Shared pure CSV formatting supports reuse by a future protected export. The existing synthetic owner rehearsal uses it without changing its labeled filename or columns.

## Changes

Extract the existing owner fixture formatting into `src/domain/csv-export.ts` and cover quoting, formula escaping, numeric cents and scope validation. No schema, dependency, HTTP route, account access or production integration changes.

## Verification

Local Linux Node 24.22.1/pnpm 12.18.0: frozen cloud bootstrap, doctor/check, strict TypeScript 7 typecheck, lint (62 files), all 204 unit tests, optimized build and production HTTP boundary verification passed. The reviewer independently reran 23 formatter/owner-fixture tests and found no unresolved substantive findings. The initial lint run rejected control-character regex ranges; the implementation uses a short character scan instead, with no lint suppression. Staged context gate against origin/main and whitespace checks passed. Hosted CI for this PR is pending. No UI layout or database behavior changed, so no new visual-browser/device or PostgreSQL check was run. No live endpoint or operational production behavior is claimed.

## Context impact

ARCHITECTURE documents the shared formatter and separates formatting from owner authorization. CONTEXT records the reusable capability without treating protected export or B4 as complete.

## Learning note

Quoting a CSV cell preserves commas and newlines but does not stop a spreadsheet from interpreting text as a formula. Text escaping and server-side access checks solve different problems; both matter for a future export endpoint.

## Next step

Review this focused package and pending kernel PR #33. This preserves the existing 16-column fixture export; a full audit export including reversal target/reason is still a future endpoint requirement. Remaining #11 work includes authenticated endpoints, setup/invitations, live adapters, protected export delivery, production auth/recovery and real two-device evidence. #12 remains blocked and needs a willing venue plus observed pilot results.
