# Local UI - remove Discover intro copy

## Task

Remove Good nights start somewhere and Find your next spot from Discover, preserving current UI work.

## Outcome

Both visible intro lines are removed. The document title is Encore - Discover. A visually hidden Discover h1 retains the section's accessible name without adding visible replacement copy.

## Changes

Only discover.html presentation copy changed. Picture cards, occupancy filter, fixed navigation and unrelated edits are preserved.

## Verification

All 35 focused preview tests passed. corepack pnpm run doctor, check and typecheck passed. HTTP 200 on http://127.0.0.1:4173/discover.html confirms both phrases absent and all three picture cards, filter and navigation present. HTML is served fresh, so no server restart was needed. No browser automation used; no production app build needed for this copy-only prototype edit.

## Context impact

No canonical capability, API, setup or product scope changed; existing design docs remain accurate. This handoff records the narrow copy removal.

## Learning note

A visually hidden heading preserves a useful screen-reader heading and section label without taking up visual space.

## Next step

Refresh the existing Discover preview. No commit, push or merge performed; no blockers.