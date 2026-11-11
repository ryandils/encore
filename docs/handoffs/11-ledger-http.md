# B4 — local authenticated ledger HTTP

## Task

Next bounded #11 slice after the user-approved kernel PR #33 merge `9cf262e`. Branch `feat/b4-ledger-http`; no dependency on unmerged CSV PR #35.

## Outcome

Local session-protected night reads and transactional event/close commands are exposed through four API routes. The separate synthetic screen rehearsals are unchanged.

## Changes

A shared injectable HTTP boundary validates sessions, write origins and bounded command bodies, then calls the merged kernel. Runtime wiring lazily creates local-only database/auth dependencies. Generic unavailable errors do not disclose driver/session details. Production remains denied before dependency access. The verifier uses real separate synthetic sessions against PostgreSQL; it is not a real-device rehearsal.

## Verification

Local Linux Node 24.22.1/pnpm 12.18.0: doctor/check, strict TypeScript 7, lint, all 222 unit tests, optimized build and production HTTP verification passed. The production check now exercises all four ledger routes with unusable auth/database settings and confirms 404 without database access. Real local PostgreSQL migrations/seed and auth setup passed without reset; `ledger:http:verify` passed with independent owner/staff cookies, forged actor/origin/venue/staff denials, concurrent retry deduplication, close/write serialization, stored authoritative totals, assignment revocation and session deletion rejection. Task records and exact sessions were removed by the verifier. No physical devices or production accounts were used.

Independent source/test review found no unresolved substantive findings. Boundary tests include 16KiB streamed overflow/cancellation, invalid UTF-8, 405 Allow, origin checks, generic error redaction, account-throttle capacity/expiry and production denial before dependency access. The per-process limit is 600 requests per account per minute with at most 1,000 active account buckets; it does not establish a shared production limiter. Final staged context and whitespace checks passed. The task-started database container was stopped with its named volume retained. Hosted CI for this new PR is pending.

## Context impact

README, ARCHITECTURE, CONTEXT and HARNESS document local route scope and verification. Shared API errors gain UNAVAILABLE. Production HTTP smoke checks cover the new route boundary. No schema or dependency change.

## Learning note

A signed-in user is not automatically allowed to use every venue. The HTTP layer establishes identity; the ledger kernel separately checks membership and night assignment for each operation.

## Next step

Review/merge this slice before dependent live adapters. Remaining B4 includes venue/night setup, invitations/revocation services, protected CSV delivery, production verification/recovery configuration, and authenticated two-device evidence. B5 remains blocked on full B4 and real venue participation.
