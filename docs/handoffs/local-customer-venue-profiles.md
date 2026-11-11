# Local customer venue-profile exploration

## Task

Add a customer flow in the separate local preview: tap a fictional bar to see its picture, hours, address, and occupancy. This is local prototype work, not a claim on B2, B3, B4, or a published product change.

## Outcome

The three discovery cards and the top-header search result open native linked venue profiles on the loopback design server. Each profile displays a labeled bar-image illustration placeholder, seven-day sample hours, fictional address, and explicitly synthetic occupancy/capacity. All spots navigation returns to the corresponding card; browser Back/Forward and direct reload use ordinary document navigation.

## Changes

Added a small TypeScript fixture renderer, a mobile profile stylesheet, an original SVG bar-interior placeholder, and focused tests. The preview server permits only the three known profile routes plus an explicit local asset list. The later My Spots request adds a small TypeScript client, compiled at preview startup into ignored output and served only from the same loopback origin. It stores favorite and recent fictional venue IDs locally, warns on blocked storage, preserves all four tabs, and uses a shared fixture module. No dependencies, account, database, or production application change was added. A follow-up request makes each address a native link to Apple Maps directions with an encoded fictional destination, no supplied origin, and no auto-navigation parameter. It requests no browser location permission. A further local refinement renames Main feed to Discover and moves the existing sample search into a native top-header magnifying-glass disclosure; it can open and close with keyboard or tap, with a fixed sample result. The customer Discover screen no longer exposes Area set, Denied, or Manual search test switches or their dormant review panels. Its fixed sample-area label and accessible header search remain; future optional-location/manual-entry requirements stay in the guidelines and Settings explanation. Existing checkouts and the separate Next.js app server are unchanged.

## Verification

Twenty-nine focused Node tests pass for requested details, all seven hours rows, synthetic-count labeling, navigation links, and unknown-path rejection, explicit 48px header-link targets, 56px address targets, encoded Apple Maps links with accessible labels, Discover labels, the accessible phone-sized search disclosure, favorite add/remove, storage reload persistence, recent ordering, malformed data, unavailable storage, all four tabs, empty-hash navigation, inset saved-card focus styling, and removal of development location switches without adding geolocation access. Standalone strict TypeScript checking of the preview server, profile renderer, and tests passes. Live HTTP checks pass for discovery, all three profiles, stylesheet, and image; private-file and unknown-venue requests return 404. HEAD succeeds. Doctor, repository check, full strict typecheck, lint, and the existing test suite pass (186 passed, 1 skipped). POST requests to a profile return 404. The SVG parses as valid XML. The structured context handoff gate passes. The browser client compiles strictly at preview startup. The optimized Next.js application build and production HTTP verification pass as pre-publication regression checks; this does not publish the standalone design server. Independent source review found no remaining material issues and reran the 29 tests, strict TypeScript checks, and a client navigation stub. That reviewer could inspect source but not the Git diff, and did not verify rendered browser behavior. Independent review findings were resolved: discovery documentation now requires server mode, and both profile header links have explicit 48px minimum tap targets. My Spots review also fixed empty-hash return to Discover while preserving skip links, plus clipped keyboard focus on saved cards.

Automated browser interaction was unavailable for this local change. Mobile layout, actual keyboard focus, and browser history behavior are not newly browser-verified; native links are used and their destinations are HTTP-verified. Storage behavior is tested through its adapter with in-memory test storage, not through automated user-browser clicks. This is not real-device or Safari acceptance. Apple Maps links were checked in rendered HTML and the live local response, not opened externally; native iOS app handoff and resolving the fictional destination are not claimed.

## Context impact

Updated the design README and CONTEXT to distinguish the new linked local fixture from the operator MVP. Product scope, API/schema, authentication, shared ledger contracts, dependency pins, and application commands remain unchanged, so no other canonical product document changes are needed.

## Learning note

A venue card can be a normal link to its own page. That gives customers a shareable local URL and ordinary Back/Forward behavior without pretending the preview has a live backend.

## Next step

Try the fictional profiles and refine the customer flow. Replace the labeled illustration with owner-provided photography only in an authorized follow-up. Real venue editing, verified information, publishing, privacy choices for crowd counts, and shared occupancy require separate product and backend work. The prototype is being prepared for repository review on feat/local-venue-profiles. It does not add production application routes or deploy a public discovery service. Publication, review, CI, and merge status belong to the pull request rather than this static handoff.
