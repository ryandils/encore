# B3 / #10 — synthetic owner screens

## Task

[Issue #10](https://github.com/ryandils/encore/issues/10), branch `feat/b3-owner-screens`, based on merged B1 contracts in PR #27. Owner chat: `owner-screens-10`; account: `conomos`. Separate #9 work retains staff/door ownership.

## Outcome

An isolated owner rehearsal at `/demo/owner-rehearsal` for venue/night setup, immutable price history, simulated invitations and access revocation, traffic summary, cash closeout, closed history and CSV. Run `pnpm run dev`; no database or login is needed for this synthetic screen. Production rejects the route.

## Changes

Owner-specific immutable fixture state consumes B1 parsers and pure projections. The UI keeps fixtures local to a page session, labels that limitation, and requires confirmation before closing. Closed results and charged admission amounts remain snapshots. CSV includes actors, times and reconciliation and escapes formula-like text. No shared contracts, schema, packages or staff/door files change.

## Verification

Final `pnpm run doctor`, `pnpm run check`, `pnpm run lint` and `pnpm run test` passed (174 tests across 8 files). The owner model/route/UI/tests also pass a focused strict TypeScript 7 CLI check using the repository target/lib/module settings and `skipLibCheck: false`.

Full `pnpm run typecheck` and `pnpm run build` remain blocked at Prisma generation: the environment denies the checksum download from `binaries.prisma.sh` with HTTP 403. Checksum verification was not disabled. A focused typecheck is not a substitute for the blocked full check.

Playwright with system Chromium on the development server passed the complete rehearsal at 320 × 780: setup, four $10 admissions, exit, $15 preset edit/admission, invite creation/acceptance/revocation, $55 cover/$155 expected drawer/-$5 variance, close confirmation/read-only controls, closed summary, CSV download and refresh reset. App controls had no horizontal overflow or touch targets below 44px; no browser page errors occurred. The captured phone screenshot was visually inspected. This is synthetic single-browser evidence, not live backend or physical-device validation.

Independent review resolved ambiguous staff revoke controls by naming the recipient and prioritizing revoked invite status. No substantive review findings remain. `git diff --check` and `pnpm run context:check --base origin/main` passed.

### Integration with merged B2

Merged main at `62391c9` into this branch after PR #28 landed. Resolved README and CONTEXT conflicts by preserving both demos; independent review confirmed every B2 source/test file remains identical to main. The combined local doctor, repository check, lint and 187 tests pass. Full local typecheck remains blocked by the same Prisma proxy HTTP 403; hosted checks must pass on the integrated commit before merge.

## Context impact

README adds the runnable rehearsal and acceptance walkthrough. CONTEXT records the fixture capability separately from the live backend. ARCHITECTURE documents the production boundary, local state and B4 integration requirements.

## Learning note

Expected cover sums the price recorded on each admission. Changing a preset affects later admissions; an exit changes occupancy without reducing recorded cash.

## Next step

Complete review and validation before merging. Permit the required Prisma download host in environment settings to run full generation/typecheck/build. B4 (#11) must implement server authorization, transactional persistence, invite acceptance and shared state. This rehearsal does not prove refresh durability, two-device convergence or pilot readiness; refresh resets the synthetic session. No migration or secret configuration is added here.
