# PR #33 — undo eligibility performance

## Task

Address Ryan's [P2 review request](https://github.com/ryandils/encore/pull/33#issuecomment-6783393638) on the existing `feat/b4-backend-permissions` branch. This follow-up preserves the existing #11 ownership and does not merge the PR or complete B4.

## Outcome

Undo eligibility now builds a reversed-ID set and finds the actor's latest uncorrected action once per snapshot. Each recent action reuses that context instead of rescanning the full history with nested loops. Correction commands use the same eligibility rules with a freshly computed context.

## Changes

- `src/server/ledger-service.ts` reuses the projection's reversed IDs, uses set membership for reversal flags, and selects the latest action in server sequence order. Owner permissions, staff ownership and inclusive 60-second eligibility, closed-night restrictions, actor-scoped receipts and immutable retry responses are preserved.
- `tests/ledger-service.test.ts` exercises the actual service with only the database boundary mocked. Thirteen cases cover actor/sequence selection, corrected targets and reversals, exact time boundaries, owner permissions, the recent-action window, closed nights and saved retry responses. A property-read counter bounds event inspections for 500 and 1,000 admission histories without a flaky timing threshold.

## Verification

Local Linux, Node 24.22.1, pnpm 12.18.0, TypeScript 7.0.2:

- Frozen dependency install, doctor, repository check and lint passed. The original 187 unit tests and all 13 new service tests passed.
- Strict targeted TypeScript checking of the service and its new test passed with `tsc --ignoreConfig --noEmit --strict --target ES2023 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --skipLibCheck false src/server/ledger-service.ts tests/ledger-service.test.ts`.
- Actual pinned local PostgreSQL 17.7: `pnpm run ledger:service:verify` passed permission, retry, concurrency, correction, revocation, close-race and durable-receipt checks; `pnpm run ledger:verify` passed all 36 schema rejection checks and cleanup.
- Environment limitation: `cloud:setup` stopped at Prisma generation, and `db:migrate` and `build` failed because the proxy returned HTTP 403 for the Prisma engine checksum host `binaries.prisma.sh`. Checksums were not disabled. To run PostgreSQL verification independently, the three unchanged committed migration SQL files were applied transactionally to the verified-empty task-local database using the existing `pg` client and local-target validator. This is not a successful Prisma migration CLI check. Full repository typecheck, build and production HTTP verification remain unverified for this follow-up.
- The same tests run against an isolated temporary copy of original service `d785ee9` passed all 12 behavior cases and failed the complexity case. At 500/1,000 events, original property-read counts were 5,050,719/20,101,219 versus 20,723/41,223 after the fix. These are operation counts, not latency measurements.
- Independent source/test review found no substantive findings. The staged context gate against `origin/main` and whitespace checks passed. Hosted CI evidence remains pending at this writing.

The operation bound covers undo eligibility on admission histories. The existing domain projection still replays historical prefixes for reversals; this change does not claim all snapshot computation is linear or provide a PostgreSQL latency benchmark.

## Context impact

No canonical product, API, schema, dependency or setup contract changes. The original [kernel handoff](11-ledger-kernel.md) records the initial implementation's checks; this handoff separately records the performance follow-up and its current environment limitations.

## Learning note

A set answers whether an action was corrected without searching the whole event list. Computing that set and the latest eligible action once reduces work while the database lock is held.

## Next step

Confirm hosted CI for the follow-up and resolve the local Prisma host access limitation before claiming full local validation. Leave PR #33 unmerged and #11 incomplete. HTTP/session integration, live adapters and real two-device acceptance remain outside this fix.
