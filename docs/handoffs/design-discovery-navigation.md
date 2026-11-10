# Design — discovery feed and bottom navigation

## Task

User-requested design exploration on `design/mobile-brand-kit` / draft PR #26: Main feed with location-based bar discovery/search, plus Profile and Settings in bottom navigation. Use synthetic data and show denied/manual-location states.

## Outcome

[Discovery review](../design/mobile-brand-kit/discover.html) supplies three native selectable destinations, three illustrative location states, fictional venue cards/details, a fixed search-result example and expandable empty-state example. No location permission is requested, no account is connected, and no live venue data is used. Start the existing `preview.ts` server and visit `/discover.html`; the main review header links to it.

## Changes

Added design HTML/CSS and extended the preview server's explicit read-only asset allowlist. Updated design guidelines to document the new patron audience, privacy/permission assumptions, bottom-navigation behavior, and separate future product decisions. Existing staff/owner screens and all production files remain unchanged except the design review's link to the new concept.

## Verification

Independent Chromium review passed Main feed/Profile/Settings click and keyboard selection, visible bottom navigation at 320/390/430/768px, all location states, no horizontal overflow, and 320px enlarged text. Fictional data and nonfunctional search/account/location boundaries are visible. Lead verification and exact command results are recorded in the kit verification document. No real-device, live-search, geolocation, or production integration behavior is claimed.

## Context impact

No canonical product/architecture change: this is exploratory design beyond the current operator MVP, not an approved implementation expansion. Guidelines identify the audience change and decisions needed before future implementation. Ryan's ledger contracts and verification files are untouched.

## Learning note

A bottom navigation can be tested for comprehension before selecting a location provider or building accounts. A simulated permission state must not masquerade as a real browser permission grant.

## Next step

Review the patron-facing direction, then decide its roadmap priority, data source, privacy model, and profile value before creating an implementation task. The encore-issues read found #8 actively owned by Ryan's B1 chat, #9/#10 blocked on it, and #7 still awaiting native macOS evidence despite merged PR #25. No issue changes, merge, or deployment were performed by this design task.
