# Local UI - compact occupancy filter

## Task

Replace the visible sample-spot count with a compact occupancy filter at the right of Around this area. Preserve the preceding copy removals and other UI work.

## Outcome

Small Filter control sits in the heading's top-right position with a 44px minimum tap height. Native disclosure opens a bounded dropdown panel with the existing labeled select. Selecting a range closes the panel, highlights the active filter and returns keyboard focus. Result count remains a screen-reader live announcement only.

## Changes

Updated discover.html, discover.css and discovery-client.ts. All requested intro, badge, disclaimer, footnote and footer removals remain. Picture cards and bottom navigation are preserved.

## Verification

35 focused tests passed. Repository doctor passed earlier in this same task; check and typecheck passed after the compact filter edit. Preview restart compiled the strict browser client. HTTP 200 verified compact heading markup, hidden result count, all requested copy absent and updated client close/focus behavior served on port 4173. No browser automation was attempted under the prior browser-control stop; visual interaction review remains pending. No production app build run for this standalone prototype edit.

## Context impact

Design README updated for filter location and keyboard behavior. No backend, data contracts, product scope or setup changes.

## Learning note

A visually compact control can still have a 44px tap target. Keeping result announcements hidden visually preserves useful screen-reader feedback without the unwanted count label.

## Next step

Refresh http://127.0.0.1:4173/discover.html to inspect. No commit, push or merge performed.

## Pre-merge verification

Explicit user authorization now covers PR creation and merge after checks. The follow-up branch is feat/discovery-navigation-filter, integrated with main at b70d481. Doctor, check, typecheck, lint, 439 application tests (one skipped), 35 focused prototype tests, optimized build, production HTTP guards, context gate and whitespace checks pass. Independent review found restored filter selections did not synchronize the active highlight/accessible name; synchronization now runs on initialization and pageshow as well as change. Strict standalone client compilation passes after the correction. Hosted CI and confirmed merge status are recorded on the PR. Browser limitations above remain unchanged.
