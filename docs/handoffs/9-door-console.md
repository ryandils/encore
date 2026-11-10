# B2 — synthetic phone-first door console

## Task

Issue [#9](https://github.com/ryandils/encore/issues/9), branch `feat/b2-door-console`, based on merged B1 commit `21228f0`. This handoff does not claim merge or pilot readiness.

## Outcome

Run `pnpm run dev` and open `/demo/door`. The labeled fixture supports three paid-entry presets, free entry, exit, recorded occupancy, recent actions and confirmed eligible undo. It needs no database or login; refresh resets this isolated browser fixture. Production rejects the route. Owner finances are absent from the staff state and screen.

## Changes

- `src/components/door`: scoped phone UI and a controller that serializes intentional rapid taps, separates pending actions from acknowledged occupancy, polls every three seconds, refreshes on focus, and marks snapshots stale after ten seconds.
- `src/features/door/synthetic-adapter.ts`: in-memory implementation of the existing door-state/event API subset, B1 ledger projection, immutable charged amounts, same-ID receipts and bounded undo eligibility. Demo controls simulate rejected saves, lost acknowledgements after a save, and disconnection.
- Unknown outcomes remain unresolved even if a later retry is forbidden. An old receipt cannot overwrite newer state or make stale data look fresh. Independent review identified both cases; regression tests cover their fixes.
- `tests/door.browser.ts` verifies the isolated route against an already-running local dev server. `tests/production.integration.ts` includes its production-denial assertion.
- No shared contracts, schema, manifests, authentication, owner-screen files or global styles changed. No migration/configuration change is required by the feature.

## Verification

Local Linux, Node 24.22.1, pnpm 12.18.0, TypeScript 7.0.2:

- Frozen dependency install and doctor passed. The initial Corepack cache path was unavailable; using a writable `COREPACK_HOME=/workspace/.cache/corepack` resolved it without repository changes.
- `pnpm run check`, `pnpm run lint` (54 files), and `pnpm run test` (179 tests, including 13 new adapter/controller tests) passed.
- Fixture acceptance: four $10 admissions and an exit produce occupancy 3 and 4000 cents of immutable admission charges. Unit checks cover retry receipts, conflicting IDs, invalid/stale commands, free/undo expiry, pending/unknown/rejected state, ordering and stale metadata.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tests/door.browser.ts http://127.0.0.1:3000` passed using Chromium 156.0.8078.79 against `pnpm run dev`: paid/free entries, exit, undo, unknown and rejected retry, stale recovery, refresh reset, keyboard focus, no page errors, no horizontal overflow and at least 44px action buttons at 320px/390px. A 390px screenshot was visually inspected. This is automated local synthetic evidence, not a physical phone or two-device backend test.
- Standard `cloud:setup` / `typecheck` and `build` stop at Prisma generation: HTTP 403 fetching the engine checksum from `binaries.prisma.sh`. The enforced environment allowlist omits that host. No checksum or network-policy bypass was used. Optimized production HTTP verification cannot run locally without the build; its new guard assertion awaits CI.
- Context gate and final whitespace validation are recorded in the PR after staging this handoff.

## Context impact

README documents the new route and its limitations; CONTEXT distinguishes the working synthetic UI from absent live endpoints; ARCHITECTURE describes the adapter/controller boundary and B4 obligations. B3 has a separate issue/chat: preserve its independent sections when reconciling these canonical docs. The issue remains the live ownership/status record.

## Learning note

A request can save successfully even when its response is lost. Reusing its request ID lets the server acknowledge that same action instead of recording another person. A local fixture demonstrates the UI behavior; it does not prove a real database transaction.

## Next step

Review the PR and run standard typecheck/build/production verification in CI or an environment permitting `binaries.prisma.sh` and its checksums. B4 must supply real server authorization, transactions, persistence and concurrent-device verification. B3's owner UI is independent; no issue closure, merge, deployment or publication is included.
