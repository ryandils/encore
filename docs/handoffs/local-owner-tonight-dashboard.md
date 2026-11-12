# Owner mobile preview and Tonight controls

## Task

User-requested UI refinement of the existing owner fixture, following the B3 owner screen work (#10). This does not claim or complete B4 backend integration (#11). Branch: feat/owner-tonight-dashboard.

## Outcome

Open /demo/owner-mobile for a 320/390/430px browser frame, or /demo/owner-rehearsal directly. Tonight shows empty totals initially and can load the canonical five-admission scenario. Each bottom destination shows its own section while preserving form drafts. Tonight records entries on the right and exits on the left using saved prices or free entry.

## Changes

- Added a fixture-only Tonight dashboard, canonical sample helper, phone CSS and explicit browser-preview wrapper. The shared persisted-owner stylesheet and backend are unchanged.
- Separated Tonight, My bar, Staff, Finish and Past nights. Hash navigation, focus targets and active destination labels support section changes; current and historical details remain reachable.
- Prepare shows one entry price initially and can reveal up to three. Draft slot visibility becomes active for admissions only after successful saving. The shared three-slot contract is preserved internally. Adding a price moves focus to the new input.
- Added direct entry/exit controls with recorded occupancy status. Exit is disabled at zero; both controls are disabled before opening, after closing and during cash confirmation. Capacity remains a warning/reference rather than a hard logging cap. Exits never alter recorded cash.
- Simplified labels, enlarged controls, preserved safe-area clearance and retained a compact practice/reset notice. Disabled the supported Next.js development indicator so its N badge does not cover navigation; development error reporting remains available.
- Added production-denial checks for both preview routes. No schema, API, authentication or database changes.

## Verification

Doctor, repository check, strict typecheck, lint, optimized build and production HTTP guards passed. The test suite passed 459 tests with one skipped. Tests cover canonical sample totals, current/closed dashboard guidance, phone-frame options, initially hidden sections, single navigation, progressive price defaults, entry/exit ordering, saved prices, zero/closed/confirmation boundaries and cash/capacity behavior. HTTP 200 was verified for both preview routes. Context gate and whitespace checks passed.

Independent source reviews identified and resolved selected-history navigation, unreachable open-night details, premature activation of draft prices and focus loss when adding the last price. Actual browser interaction and phone-width rendering remain unverified under the earlier browser-control stop; no alternative browser automation was used. Server-render/model tests are not a substitute for the phone walkthrough. No physical-device or two-device backend acceptance is claimed.

## Context impact

README documents the preview URL, simulation limits and owner controls. CONTEXT describes the fixture-only capabilities. Production and native iOS support remain absent. This authorized publication opens a reviewable UI branch; no merge is authorized.

## Learning note

The dashboard and controls share the existing fixture ledger instead of duplicating occupancy or cash calculations. Hidden panels stay mounted so switching sections preserves unsaved fields. The phone frame is a browser simulation and does not emulate Safari, native touch hardware or the iOS keyboard.

## Next step

Review the draft PR and complete the phone-width interaction walkthrough when browser control is permitted. Keep the persisted backend work independent. Do not merge without authorization.
