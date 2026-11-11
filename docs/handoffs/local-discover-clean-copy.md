# Local UI - simplify Discover preview copy

## Task

Remove the Discovery concept badge, the top fictional-data disclaimer, the illustrative-distance footnote and both design-review footer links as explicitly requested.

## Outcome

Discover no longer shows the requested copy or footer links. The three picture cards, occupancy filter, search and fixed bottom navigation remain. Orphaned distance asterisks were removed with their footnote. Existing local sample labels on imagery, counts and area remain.

## Changes

Edited discover.html only for the UI change. Updated the existing venue-profile test assertion to check the remaining Sample occupancy text instead of the intentionally removed disclaimer. Prior uncommitted work was preserved.

## Verification

All 35 focused preview tests passed. corepack pnpm run doctor, check and typecheck passed. HTTP 200 from http://127.0.0.1:4173/discover.html confirms all requested text absent and three picture cards, filter and navigation present. HTML is served fresh; no restart needed. No browser automation or production build was run for this copy-only edit.

## Context impact

No capability, contract, setup or product-scope change. Existing canonical docs remain accurate; this handoff records the requested presentation cleanup.

## Learning note

Removing a footnote also means removing its asterisk markers so the UI does not point to missing explanatory text.

## Next step

Refresh Discover to inspect. No commit, push or merge performed. No blockers.