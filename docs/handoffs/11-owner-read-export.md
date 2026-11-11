# B4 — owner reads and protected local audit export

## Task

Next independent #11 package on `feat/b4-owner-read-export`, based on merged setup/access `4a72159`. It does not depend on unmerged door UI #38.

## Outcome

Authorized owners can rediscover venues, configuration, active/closed nights and access metadata from the server. A protected local CSV attachment includes original ledger/correction and opening/closing context, enabling future owner UI recovery/history.

## Changes

Explicit owner-scoped projections omit invitation secrets. CSV export shares the ledger night transaction and checks owner permission before finance/history. Audit mode adds a 25-column schema and night baseline while preserving default 16-column fixture output. All local exports retain synthetic labels and UUID-derived attachment names. New GET routes share session, throttle, no-store and production-denial guards. No schema, dependency, production configuration or UI changes.

## Verification

Local Linux Node 24.22.1/pnpm 12.18.0: cloud bootstrap, doctor/check, strict TypeScript 7, lint (91 files), all 321 unit tests, build and expanded production HTTP denial checks passed. Real PostgreSQL owner/read/export verification and actual separate-cookie owner HTTP verification passed scoped discovery, redacted access catalogs, complete audit linkage/opening/closing context, formula-safe quoted text, numeric cents, immutable historical snapshots and close/export races.

Independent review found no unresolved substantive findings and independently ran 60 owner HTTP/CSV/fixture tests. Default 16-column fixture formatting remains compatible. No layout changed, so no new browser journey ran for this backend package. No database backup, physical-device, production or pilot acceptance is claimed. Staged context/whitespace checks passed; the task database container was stopped with its named volume retained; hosted CI for this PR is pending.

## Context impact

README, ARCHITECTURE, CONTEXT and HARNESS describe discovery endpoints, audit columns, protected transport and verification commands. Shared types describe safe metadata projections; production HTTP tests cover all new GET endpoints. Earlier handoffs preserve the original fixture/kernel evidence.

## Learning note

A screen cannot recover a server-generated venue ID from a response it never received. Owner-scoped lists allow rediscovery without automatically repeating creation. A CSV download also needs an owner check; safe formatting alone does not protect financial records.

## Next step

Build the persisted owner/history/staff-management and fragment invitation-acceptance screens on these APIs after merge. Production domain and email provider/sender remain unchosen; production verification/recovery and real device/venue evidence are still required. #11 remains incomplete, #12 Blocked.
