# #11 — Prisma/PostgreSQL authentication lifecycle proof

## Task

Narrow follow-up to merged #42 on `feat/b4-auth-postgres-proof`, based on main `73f475c`. Ryan retains #11 ownership. This package follows his review handoff and does not authorize merging, real email, production enablement or application enrollment.

## Outcome

Adds `pnpm run auth:lifecycle:verify` for isolated verification and password-reset handlers against the actual Prisma/PostgreSQL adapter. Application auth routes remain session-only. Database validation is pending hosted CI; no passing PostgreSQL claim is made yet.

## Changes

The verifier uses independent clients/auth instances and explicitly enables adapter transactions. Scoped synthetic users and captured mail exercise token lifecycle and failure behavior without a provider or verification-flag bypass. The isolated lifecycle factory disables the library's global expired-token cleanup so fixture reads cannot sweep unrelated records; a sentinel checks preservation. Ubuntu and Windows PostgreSQL CI jobs run the new command. No schema, migration, dependency or production-route changes.

## Verification

Frozen install, doctor, repository check and all 465 existing tests passed locally on Node 24.22.1 / pnpm 12.18.0. The 11 memory lifecycle tests passed again after disabling global cleanup. Docker PostgreSQL starts successfully. Full cloud setup/typecheck, build and migration are blocked by HTTP 403 downloading the official Prisma engine checksum from binaries.prisma.sh; checksums were not bypassed. `auth:lifecycle:verify` fails its local prerequisites because the generated Prisma client is unavailable. Final lint/context gate, independent review and hosted CI are pending.

## Context impact

README, LOCAL_DATABASE and HARNESS document the new command, prerequisites and CI scope. ARCHITECTURE documents explicit adapter transactions and independent-client evidence. CONTEXT links this proof and preserves outstanding application, delivery and production gates.

## Learning note

One-use tokens need both a single winner under concurrent requests and rollback when a password reset fails halfway through. Separate database clients test the database guarantee; memory tests alone cannot prove it.

## Next step

Complete hosted PostgreSQL and full application checks and independent review. Application enrollment/verification/recovery is a separate package only after this proof merges; public signup additionally needs Ryan's owner-enrollment policy. Domain/HTTPS, provider/sender configuration, actual delivery, physical devices and operational acceptance remain gates. #11 stays In progress and #12 stays Blocked. No merge is authorized.
