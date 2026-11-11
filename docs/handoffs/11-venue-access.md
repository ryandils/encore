# B4 — local venue setup and staff access

## Task

Next #11 package on `feat/b4-venue-access`, based on merged main `e2905eb`. Source, HTTP integration, tests and review have exclusive owners recorded in the issue.

## Outcome

Local session-protected APIs create venues/nights/presets and manage hashed invitations plus bounded staff assignments. There are no new UI pages, real emails or production access.

## Changes

A PostgreSQL service enforces owner permissions, serializes setup/access with ledger writes, requires database-verified intended emails, and returns fragment-only secret invitation links. Pending invite cancellation is separate from revoking accepted staff access; assignment revocation also invalidates outstanding recipient tokens. The shared HTTP boundary retains local-only guards, same-origin writes, bounded JSON, throttling, no-store responses and opaque errors. Shared contracts gain pending-invite revocation. No schema/dependency changes.

## Verification

Local Linux Node 24.22.1/pnpm 12.18.0: frozen cloud bootstrap, doctor/check, strict TypeScript 7, lint (84 files), all 284 unit tests, optimized build and expanded production HTTP 404 checks passed. Actual local PostgreSQL setup/access verification passed all scoped permission, invitation lifecycle, preset snapshot and concurrency/race assertions. Separate real-cookie venue/access HTTP verification and the existing ledger HTTP regression passed, including invitation cancellation, verification enforcement, retries, closing and immediate assignment/session revocation. No seeded account verification flag was changed.

Independent source review found no unresolved substantive findings; the reviewer independently ran 67 HTTP tests. Review changed secret links to fragment-only URLs and added pending-invitation cancellation rather than leaving that control absent. Full HTTP invitation acceptance remains dependent on a verified account; internal service fixtures explicitly use fake verified users. No physical-device, email delivery or production acceptance is claimed. Staged context/whitespace checks passed; the task-started database container was stopped with its named volume retained. Hosted CI for the new PR is pending.

## Context impact

ARCHITECTURE documents endpoint coverage, lock ordering, one-hour token expiry, twelve-hour assignments and cancellation behavior. README/HARNESS describe the local verifiers; CONTEXT/AGENTS reflect local setup/access capability while preserving production and UI limits. Production HTTP tests cover new endpoints.

## Learning note

Possessing a link does not prove who owns an email account. Invitation acceptance verifies the signed-in account and its database verification flag, then grants only that venue/night assignment. Hashing the token prevents a stored database value from being used directly as a secret link.

## Next step

Review and merge this package after checks. Full B4 still needs live screen integration, complete protected CSV export, production account verification/recovery delivery and real two-device evidence. B5 still needs full B4 acceptance, operational backup/recovery and a willing venue with observed results.
