# #11 — isolated verification and password-reset lifecycle

## Task

Bounded #11 package on `feat/b4-auth-token-lifecycle`, based on merged PR #40 (`b3277d7`). Ryan retains milestone ownership. No merge, deployment, production enablement or email delivery is authorized by this package.

## Outcome

An unwired local factory runs Better Auth verification and password recovery against explicitly supplied isolated storage and synthetic captured email. Run `pnpm exec vitest run tests/auth-lifecycle.test.ts`. Application auth routes remain session-only and production-disabled.

## Changes

The factory requires verified email for sign-in, one-hour tokens, no automatic sign-in after verification, no cookie session cache and session revocation on reset. Origin/CSRF checks are explicitly enabled even in test mode; telemetry/logging are disabled. Captures accept reserved `.invalid` recipients only.

Better Auth creates/signs verification JWTs with a random `jti`; its verification store consumes a SHA-256 issuance digest to deny reuse, including same-second resends. Password cryptography/reset consumption remain library-owned. Verification consumption is fail-closed on attempted use: failure later in the handler spends the link and requires a fresh link. It is not an account-update transaction. The in-memory adapter evidence does not establish PostgreSQL concurrency or rollback behavior.

## Verification

Integrated `pnpm run test`: 451/451 passed across 20 files, including 11 new lifecycle cases. The focused lifecycle suite and Biome lint passed. Tests use real Better Auth handlers, captured synthetic links, isolated memory stores and fake Date for expiry; a fetch spy confirms no network fetch. Verification covers tampering, expiry, concurrent one-use redemption, same-second resend recovery, required verification, reset/password replacement, all target sessions revoked with another account preserved, unverified reset remaining unverified, origin/redirect denial and production/application-route denial. Frozen installation, doctor, repository check and whitespace checks passed. Full `cloud:setup` / `typecheck` and `build` stop at Prisma engine checksum download: `binaries.prisma.sh` returns HTTP 403 under this environment's network policy. No checksum bypass was used. Production HTTP smoke cannot run without the completed build. Focused strict TypeScript 7 checking of the new factory passed; this does not replace full repository typechecking.

Independent reviewer authored no changes, reviewed the combined code/tests/docs and reran all 11 lifecycle cases successfully; no unresolved findings. Review prompted an explicit required adapter and an unverified-reset regression. `pnpm run context:check --base origin/main` passed with the handoff staged.

## Context impact

README documents the database-free test command. ARCHITECTURE explains the unwired factory, one-time consumption, fail-closed recovery and adapter limitations. CONTEXT records the isolated capability without claiming production verification or delivery. No schema, migration, dependency or application-route changes.

## Learning note

A signed token proves authenticity; it does not by itself prove it has never been used. Verification adds a consumed issuance record, while the maintained reset flow already consumes its stored token.

## Next step

Complete full typecheck/build and production HTTP checks on an environment permitting the official Prisma engine/checksum host, or establish equivalent CI evidence before marking this package ready. Real HTTPS domain/provider/from-address configuration, actual email delivery, application enrollment/recovery integration and physical-device acceptance remain outstanding. #11 remains In progress; a focused draft PR will carry the bounded work without closing the milestone.
