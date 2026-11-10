# Design — exit left, entry right

## Task

User-requested follow-up on `design/mobile-brand-kit` / draft PR #26: put Exit (−) on the left and Free entry (+) on the right.

## Outcome

The mobile specimen now matches the requested increment/decrement placement in both visual and document order. Preview at `http://127.0.0.1:4173/#door` using the existing design preview command.

## Changes

Swapped the two secondary button elements in the design HTML, specified the arrangement in the design guidelines, and refreshed saved/stale screenshots. Free entry still means $0 cover; Exit still means no refund. All product buttons remain inactive illustrations.

## Verification

Chromium passed at 320/390/430px: labels and element positions, disabled product controls, all five selectable states, hidden actions when closed, and no horizontal overflow. Doctor and check passed. Full typecheck attempted; existing Prisma download-host limitation remains. No application tests or live ledger behavior are claimed.

## Context impact

No canonical document changes: this adjusts only the design proposal, not application behavior, API/schema, or setup. Ryan's #6/#7/#8 scope remains untouched.

## Learning note

Changing document order, rather than only CSS placement, keeps the visual order and reading order aligned.

## Next step

Review the new placement in draft PR #26. Production implementation and physical-phone usability verification remain later work after prerequisites merge. No merge or deployment performed.
