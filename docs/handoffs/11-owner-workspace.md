# B4 — local persisted owner workspace

## Task

Scoped package for [#11](https://github.com/ryandils/encore/issues/11): connect the local owner workflow and invitation acceptance to the merged session-protected APIs. Parent B4 and pilot acceptance remain incomplete.

## Outcome

After local database/auth setup, sign in and open `/local/owner`. Synthetic venue/night setup, preset changes, staff invites/cancellation/revocation, authoritative summaries, closeout, closed history and protected audit downloads persist in PostgreSQL. Staff open a fragment invitation and explicitly accept with the intended verified account, then use the persisted door console.

## Changes

- Separate persisted owner UI and strict HTTP client; existing fixture rehearsals remain isolated. Shared dollars-to-cents parser preserves the fixture interface.
- Server catalogs rediscover generated venue/night IDs after reload or uncertain setup responses. No automatic retries for non-idempotent setup/access commands.
- Original close command journals request ID, counted cash and notes before transport, validates storage readback, and gates writes across refresh until the original acknowledgement is reconciled. Recovery scans all current-account journal keys before catalog permissions can hide an earlier night, including lost venue ownership. Known authorization loss clears cached finance/access/invitation views while retaining the opaque request.
- Expected-account denial guard prevents an old owner page from writing under a newly signed-in account. The server session still determines identity and authorization.
- Fragment acceptance captures once under React Strict Mode, scrubs the address bar immediately, stores the secret only in memory, and never grants access on page load.
- Browser verifier uses unique synthetic records and a separate explicitly synthetic verified staff account, preserves seeded users and cleans its own records. CI runs it on hosted Windows with PostgreSQL/Chromium; production smoke checks include the two new pages.

## Verification

- Passed `pnpm run doctor`, `check`, `typecheck`, `lint`, and `test` (440 tests in 19 files).
- Passed `pnpm run ledger:http:verify` against actual local PostgreSQL and authenticated cookies after the shared identity guard change.
- Passed the optimized production build and `pnpm run production:verify`, including 404 denial for the new pages with invalid auth/database settings. The final application layout build passed.
- Independent source review found and resolved account-switch journal identity and lost-ownership closeout visibility. Reviewer's 169 focused tests passed. Extra regressions cover journal discovery/storage corruption and the session expectation guard.
- Passed `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm run owner:browser:verify` using Chromium 156.0.8078.79 at 320px: lost-create rediscovery without duplicate POST, explicit fragment acceptance with a synthetic verified fixture, four $10 entries/one exit then one $15 entry ($55 cover/$155 drawer), cancellation/revocation, lost close acknowledgement, lost ownership/forbidden retry/reload, original receipt recovery with one reconciliation, closed history, protected formula-safe CSV, 44px controls and no overflow/page errors. Final assertions were preserved while fixing labels and touch targets.
- Passed `pnpm run context:test` (2 tests) and `context:check --base origin/main` after staging this handoff. GitHub CI results belong to the PR; these local synthetic checks do not establish real email verification, physical devices or venue-pilot acceptance.

## Context impact

README explains the local workflow, invitation prerequisite and recovery limits. ARCHITECTURE documents account binding, strict HTTP acknowledgements and journal/fragment boundaries. CONTEXT, AGENTS and BUILD_PLAN describe the added local capability while retaining production/device gaps. HARNESS documents the new browser verifier and CI step.

## Learning note

A lost response is not a failed transaction. Retrying the same request ID and exact counted cash/notes lets the server return the original close receipt without closing twice. A fresh ID or changed payload would lose that guarantee.

## Next step

Real HTTPS deployment, a chosen domain/email provider/from-address, actual verification and password recovery, physical-device acceptance, backup/restore/retention decisions and a willing venue remain outstanding. No domain/provider is configured, no email is sent and production routes stay disabled. Closing the tab, clearing storage or switching devices can lose per-tab recovery data; it is not an offline queue. Automated synthetic verified fixtures do not prove real email ownership. The coordinator maintains #11's remaining gates and #12's blocked dependency; neither milestone is automatically closed.
