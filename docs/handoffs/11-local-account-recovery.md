# #11 — local existing-account verification and recovery

## Task

Separate package from merged PostgreSQL proof #45 (`1786e06`) on `feat/b4-local-account-recovery`. Ryan retains milestone ownership. Existing synthetic accounts only; public signup and enrollment policy remain disabled/unresolved. No production enablement, provider configuration, real email or merge authorized.

## Outcome

Phone forms at `/local/account` connect to the tested lifecycle for verified sign-in, resend and password recovery. Enable local capture explicitly with `ENCORE_AUTH_CAPTURE=1`; matching secret links remain in ignored private `.local-auth-mail/` files. No public capture endpoint exists.

## Changes

Separate app auth namespace/cookies and Prisma transactions, POST-only explicit verification, fragment scrubbing and private synthetic captures. Local protected pages/APIs require verified sessions except original reserved server-owned demo identities, preserving the labeled seed rehearsal. Invitation sign-in opens the app account flow in another tab. No schema or dependency change, no public signup.

## Verification

Doctor/check, clean lint and all 483 tests pass locally. Focused UI strict TypeScript checking passes; full typecheck/build remain blocked by official Prisma checksum host HTTP 403, with no checksum bypass. Review identified dual-cookie sign-out fallback; app sign-in/out now revoke presented legacy sessions, with unit and browser regressions. Persistent app-selection also prevents expired/revoked app sessions from falling through to a later legacy account; an explicit demo sign-in switches namespaces. The attempted local browser run failed its unmigrated database prerequisites; actual browser/PostgreSQL, production HTTP denial and final independent review remain pending. Do not infer application acceptance from the earlier isolated proof.

## Context impact

README, QUICKSTART and environment example document capture opt-in and private-file handling. ARCHITECTURE explains namespace/session and enrollment boundaries; CONTEXT records the local capability. HARNESS documents the new browser command. This package does not change pilot or public-enrollment scope.

## Learning note

Verifying an email and granting venue access are different checks. A verified session identifies an account; each ledger operation still checks its venue membership and night assignment.

## Next step

Complete independent review and actual hosted/browser evidence. Before public signup, Ryan must decide whether owners are operator/invitation-provisioned or self-registering, and how staff receive their first account. Real delivery, HTTPS hosting, physical-device and operational acceptance remain gates. #11 stays In progress, #12 Blocked; no merge authorized.
