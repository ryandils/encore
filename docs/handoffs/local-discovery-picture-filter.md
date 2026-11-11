# Local UI - picture cards and occupancy filter

## Task

Dedicated UI request: replace initial-only Discover cards with bar preview pictures, put details to the right, and add an occupancy filter. Local encore-preview checkout on feat/local-venue-profiles. Prior navigation work was preserved; no remote writes authorized or performed.

## Outcome

All three Discover cards use the existing illustrated bar placeholder on the left and details on the right. Each image is visibly labeled Sample image and has descriptive placeholder alt text. Filter by occupancy opens a native keyboard-operable disclosure and select. Options are all, under 50%, 50% to under 80%, and 80% or greater, using existing fictional occupancy/capacity data. Count announcements and an empty message are provided. No live data or actual venue photos are implied.

## Changes

Updated discover.html/CSS and discovery-client.ts. Added a small occupancy-filter.ts pure helper and boundary tests. Registered the compiled module in the loopback preview allowlist. Source cards and native venue links remain available without JavaScript; filtering stays disabled until initialization. No application, backend, schema, dependency, storage format, or navigation changes.

## Verification

- 35 focused Node tests passed, including fixture selection, exact 50%/80% boundaries, full/over-capacity, invalid counts and unknown capacity.
- corepack pnpm run doctor, check, typecheck and lint passed. Application suite: 186 passed, 1 skipped.
- Restarted only the verified discovery server on 4173 in a hidden background process. Strict browser-client compilation succeeded. HTTP 200 verified for Discover, Side B profile, sample image, discovery-client.js and occupancy-filter.js. Served HTML contains exactly three picture cards, a filter, and no Side B initial tile.
- git diff --check passed. Context gate result recorded at handoff.
- No new browser automation was attempted because the parent instruction preserves a prior browser-control safety stop. Narrow-phone visual and interactive browser verification of this change remains pending user review. Existing navigation had been browser-verified in its earlier task.
- Production app build was not rerun for this standalone design prototype. No physical-device or live venue evidence is claimed.

## Context impact

Design README documents imagery/filter semantics and test command. CONTEXT.md records the local capability. Operator MVP and architecture contracts remain unchanged.

## Learning note

Filtering by percentage of capacity compares venues of different sizes fairly: Side B is 32/80 (40%), North Room is 84/120 (70%), and Last Light is 57/60 (95%). The labels always identify these as sample counts.

## Next step

Inspect http://127.0.0.1:4173/discover.html and try each filter. Actual venue photography remains unavailable; the reused illustration is deliberately labeled. No commit, push or merge performed. Parent chat retains issue coordination.