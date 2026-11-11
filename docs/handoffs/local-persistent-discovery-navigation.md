# Local UI - persistent discovery navigation

## Task

Dedicated local UI request: keep the bottom task bar visible when opening a venue and on all customer discovery pages. Work stays on feat/local-venue-profiles in the separate encore-preview checkout. No issue was claimed, pushed, merged, or closed. Open PR inspection showed #38 concerns persisted door/backend work, outside this change.

## Outcome

Discover, My Spots, Profile, Settings and all three fictional venue profiles retain a fixed bottom bar. Updated preview: http://127.0.0.1:4173/discover.html (also available on 4174). After the user reported refreshing did not show the fix, HTTP inspection confirmed 4173 still had the old in-memory renderer. Only its verified preview process was restarted. All three venue routes on both ports now return HTTP 200 with navigation and selected Discover; 4173 serves fixed/safe-area CSS. The app on 3000 remained available (HTTP 200). Different ports have separate local favorites. This follow-up used process and HTTP checks only, with no browser automation or safety-stop bypass.

## Changes

Shared discovery CSS pins navigation within the 480px shell and reserves bottom content/scroll space including safe-area inset. Both customer document templates use viewport-fit=cover. Venue profiles render native links for all four destinations and mark Discover as their parent section with aria-current. Existing discovery radio navigation retains its selected state and arrow-key behavior. ENCORE_PREVIEW_PORT allows an additional loopback preview without stopping another server. No dependencies, backend, application routes, schema, or authentication changes.

## Verification

- corepack pnpm run doctor, check, typecheck, lint: passed.
- corepack pnpm run test: 186 passed, 1 skipped.
- Node focused venue-profile and spots-state tests: 32 passed including navigation regression cases for all three venue profiles.
- Browser via supported computer-use tool: all three venue profiles, four destinations, native link Enter activation, radio arrow-key selection, browser Back and direct profile reload passed.
- At 320x640, no horizontal overflow and the final profile note ended at y=503.95 above the fixed bar at y=555. At 390x844, no horizontal overflow and all four links were 64px high. Screenshots visually confirmed the bar. No safety stop occurred.
- Independent read-only review: no substantive findings.
- corepack pnpm run context:check --base origin/main and git diff --check: passed.
- App production build not rerun: only the standalone design preview changed, and the existing application dev preview was preserved. The preview startup successfully compiled its strict TypeScript browser client. No physical phone or nonzero device safe-area measurement is claimed.

## Context impact

CONTEXT.md records persistent customer navigation. The design README explains navigation and the optional preview port. Operator MVP/API scope remains unchanged. No product or architecture contract changed.

## Learning note

A fixed navigation bar stays attached to the viewport across scroll positions; reserving equal or greater space beneath the document lets its final content scroll clear of that bar. Separate venue documents must actually render the navigation too.

## Next step

Review the local preview. No push or merge performed. Physical iOS safe-area verification remains optional follow-up; synthetic fixtures and browser-only favorites remain unchanged. Parent chat retains ownership of issue selection and coordination.