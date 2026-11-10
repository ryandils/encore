# Encore · Mobile UI and brand guidelines

Design proposal v0.1 · November 10, 2026 · Synthetic examples only

**Know your door. Account for your cover.**

This kit preserves Encore's lowercase wordmark and tagline while proposing the user's requested black, white, electric-blue, sky-blue, periwinkle, violet, and silver identity. This direction supersedes the earlier navy/amber design seed for this proposal. It is a reviewable phone-first design for a busy door, not a functioning ledger, a new product contract, or a claim of pilot readiness. The [MVP](../../MVP.md) and [architecture](../../ARCHITECTURE.md) remain authoritative.

The independent scope is visual identity, screen composition, interaction specifications, and review assets. Ryan retains issues #6, #7, and #8. This kit does not modify authentication, demo access, database schema, APIs, shared manifests, CI, or canonical product documents. Production work on #9 and #10 still waits for merged prerequisites and a fresh ownership check.

## 1. Design intent

Encore should feel like a dependable instrument at the door: deliberate, unmistakable, and immediately readable. Pair a black field with oversized white numerals and a concentrated electric-blue action block. The distinctive rhythm is black space, a clear number, and a vivid action—not a rainbow of competing controls. Use sky, violet, periwinkle, and silver with specific supporting roles. Blue identifies the next action; it is not proof that a transaction saved. Status always has words and an icon or shape as well as color.

The operator must answer three questions at a glance: which night am I working, what count has been acknowledged, and did my last action save? Owner finance belongs in a separate view. Do not burden door staff with charts, cash totals, setup controls, or commercial upsells.

“AAA quality” is the polish target: careful hierarchy, complete edge states, comfortable mobile operation, and deliberate restraint. It is not a blanket WCAG AAA certification. Accessibility conformance requires implementation and testing across the complete experience.

## 2. Brand kit

### Identity

- Keep the wordmark lowercase: **encore.** Use white letters with a sky-blue period on black; electric blue may be used on a light background. The period is part of the identity; do not turn it into a connection indicator. The decorative period must carry no information independently of the wordmark.
- Use a semibold system sans with tight but readable spacing. Keep clear space of at least the lowercase letter height on all sides. Minimum proposed wordmark width: 88 CSS pixels. A proposed compact mark uses a white **E** on electric blue; retain a text name wherever it assists recognition.
- The primary tagline is “Know your door. Account for your cover.” Use it on introductions and branded collateral, not above every operational screen.
- Avoid gradients behind operational text, glowing controls, nightclub imagery as a UI background, and ornamental glass effects. An unforgettable identity comes from consistent composition and the blue action signature, not motion or visual noise.

### Palette and roles

| Token | Value | Role |
| --- | --- | --- |
| Black | `#000000` | Main canvas; ink on sky, periwinkle, and silver |
| White | `#FFFFFF` | Primary text; ink on electric blue and violet |
| Electric | `#0000FF` | Primary action, light-background brand period, selected emphasis |
| Sky | `#00A1FF` | Focus indicator, dark-background brand period, actionable supporting emphasis |
| Periwinkle | `#5381E6` | Secondary visual accents; use black text on a filled surface |
| Violet | `#5820C7` | Owner/review distinction; use white text on a filled surface |
| Silver | `#C0C0C0` | Supporting text on black, dividers, quiet secondary controls |

Calculated solid-color text contrast for the proposed palette:

| Foreground / background | Contrast | Usage |
| --- | --- | --- |
| White / black | 21.00:1 | Default operational text |
| White / electric blue | 8.59:1 | Primary admission labels |
| White / violet | 8.58:1 | Owner/review labels |
| Black / sky | 7.54:1 | High-emphasis secondary labels |
| Black / periwinkle | 5.65:1 | Meets a 4.5:1 normal-text target, not the 7:1 target; avoid for critical small text |
| Black / silver | 11.54:1 | Secondary controls |
| Silver / black | 11.54:1 | Supporting copy |

These ratios use sRGB relative luminance and opaque colors, not a rendered-page audit. Test actual rendered pairs, including opacity and overlays, before implementation. Aim for at least 7:1 contrast for normal operational text, 4.5:1 for large text, and 3:1 for essential control boundaries and focus indicators. Never place white normal-size text on sky, periwinkle, or silver. Black text on electric blue or violet is also unsuitable. Electric blue and violet against black are each below 3:1: use a contrasting border where a control boundary is essential, and a sky or white focus ring. Do not lower opacity on essential instructions to make a layout feel quieter.

### Typography, spacing, and shape

Use `-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`; no external font request is needed. Use tabular numerals for counts, prices, and totals. Never truncate a charged amount or conceal cents when nonzero.

| Element | Proposed size / line height | Weight |
| --- | --- | --- |
| Main recorded occupancy | 64–80 / 1.0 | 650–700 |
| Screen heading | 28 / 1.2 | 650–700 |
| Action price | 28–32 / 1.1 | 700 |
| Body and field input | 16 / 1.5 | 400–500 |
| Control label | 16 / 1.3 | 600–700 |
| Supporting label | 14 / 1.4 | 400–600 |

Use a 4-pixel spacing unit: 8 within a compact group, 12 between related controls, 16 inside small cards, 24 between sections, and 32 for a major transition. Screen gutters are 16 pixels at narrow widths and 24 when space allows. Use 12-pixel control corners, 20-pixel cards, and pills only for concise state labels. A thin divider is usually enough; avoid layered shadows in the dark UI.

## 3. Mobile composition

Design for 320 CSS pixels wide first, then check 360, 390, and 430. Content can expand naturally with larger text. On desktop, center the operator workspace at a comfortable phone-sized measure; a wider owner summary may use two columns without changing reading order.

The door screen has five stable regions in order:

1. **Context:** compact wordmark, venue/night, visible role, and synthetic-demo banner in a prototype.
2. **Trust:** persistent save/connectivity status with last successful sync time. Do not rely on a disappearing toast.
3. **Count:** “Recorded occupancy” above a large acknowledged number. Capacity sits below as a reference, never as an assertion that the room is safe.
4. **Actions:** three price controls, separate Free entry, and a visibly distinct Exit control. Place this group in the lower half on a typical phone without forcing important text off short screens.
5. **Recent actions:** acknowledgment, amount, time, permitted actor context, and eligible Undo. Keep pending items visibly separate from saved history.

Use at least 48 × 48 CSS pixel touch targets; prefer 56–64 pixels high for routine controls and larger price tiles. Leave at least 8 pixels between adjacent targets. Use full-width labels on 320-pixel screens if a three-column price layout would squeeze text. Place Exit (−) on the left and Free entry (+) on the right in both visual and document order. This puts the increment action on the right without changing its $0 meaning. Never position Exit directly against a primary admission target with no separation.

Respect safe-area insets at top and bottom. Sticky action groups must not cover focused controls, feedback, browser chrome, or the virtual keyboard. At large text sizes and short heights, allow ordinary page scrolling rather than shrinking text or trapping content in a fixed-height phone shell. No swipe-only, hover-only, long-press-only, or vibration-only operation.

## 4. Exact door journey

**Arrive at the screen.** Show venue, night, role, and last acknowledged state. Refresh on focus. A loading skeleton must not look like a real zero. If the first read fails, show “Count unavailable” and the physical-backup instruction; do not invent a count.

**Record a paid admission.** Each price tile reads, for example, “$10 · Admit 1.” A tap means one person admitted and that exact amount of cash cover recorded. It is not a payment collection flow. Four intentional $10 taps represent four admissions. Preserve intentional repeated taps by serializing local submissions; distinguish them from retrying one submission. Do not debounce legitimate taps away. Each new intentional action gets a new request ID.

**Acknowledge.** Show “Saving · $10 admission” in the pending region while the acknowledged occupancy remains unchanged. On the authoritative response, update the count and show “Saved · $10 admission” in recent actions. A polite live-region message announces completion without repeatedly announcing every polling refresh. Never animate an unsaved count as if it were committed.

**Record free entry.** The separate control reads “Free entry · $0.” It increments occupancy without cash cover. Supporting explanation may say “For comps and returning guests.” Do not describe it as a new unique guest or replace the physical re-entry stamp.

**Record an exit.** The control reads “Exit · 1 person.” Exit reduces recorded occupancy only. Show “No cover refunded” in its explanation. At acknowledged zero, show the reason Exit is unavailable; the server must still reject any attempt that would go negative.

**Undo.** Offer “Undo” only for the staff member's own latest uncorrected action, within 60 seconds, while the night remains open. Show the exact target in the confirmation: “Undo your $10 admission?” Preserve the original record and submit a reversal. Do not offer a general delete button. If replay would create negative occupancy at any point, explain that the owner must resolve the dependent exit first. Expired or ineligible actions can say “Ask the owner to correct this.” Owner corrections require a reason and preserve target, actor, and time.

**Changed price.** Owner preset edits apply to future admissions only. Recent actions continue to display their original charged amounts. If a preset changes during use, make the new price visible before the next intentional tap; final behavior must follow merged B1 contracts rather than a guessed client pricing rule.

## 5. Component and state matrix

| State/component | Display and action | Required meaning |
| --- | --- | --- |
| Ready | “Up to date” plus last successful sync time | Acknowledged state; not a promise of exact physical occupancy |
| Saving | “Saving · $10 admission” in a separate pending region | Request submitted; do not add it to the saved count |
| Saved | Check icon, “Saved,” immutable amount and time | Server acknowledged; use authoritative state/version |
| Known failure | “Not saved” plus cause; “Retry” only when appropriate | Retry the same request ID; rejected validation may need correction instead |
| Unknown outcome | “Checking whether this saved. Do not tap again for this admission.” | Request may have committed; reconcile the same request before encouraging retry |
| Stale | Warning, “Count may be out of date,” last sync time, “Check connection” | After 10 seconds without successful sync; pending is still separate |
| Offline | “Connection lost. Use your physical backup.” | No implied offline multi-device queue or authoritative local count |
| Initial read failure | “Count unavailable” | Do not show 0 as a fallback occupancy |
| At/above capacity | “At capacity reference” or “Above capacity reference” plus reference value | Highlight only; do not silently drop actual arrivals or certify safety |
| Closed night | “Night closed” and read-only recorded results | New admissions, exits, and corrections are unavailable |
| Access revoked/expired | Explain unavailable access and provide a safe return path | No continued local authorization; remove inaccessible venue data |
| Owner close blocked | “Resolve pending requests before closing” | Unknown outcomes must be reconciled first |

Active screens poll within 3 seconds, refresh after writes and on focus, and become stale after 10 seconds without successful synchronization. A recent local click is not a successful sync. Preserve request identity until the outcome is known. A new tap must never serve as an implicit retry for an uncertain admission. The production integration must define reconciliation using the merged contracts; this design does not invent another endpoint.

## 6. Owner journey and financial language

Owner screens share the visual system but have explicit owner context. Staff payloads must not contain financial reconciliation data, even if controls are hidden. A role switch in a design review is a visual comparison, not application authorization.

**Set up the venue.** Use a single-column form with persistent labels for venue name, IANA timezone, capacity reference, and three nonnegative USD presets. Put helper text below the relevant field. Inputs remain at least 16 pixels to avoid mobile focus zoom. Show errors inline and in an accessible summary; retain entered values after validation failure.

**Open the night.** Review night label/date, opening time, starting occupancy, and opening door float. Default the last two to zero. Under starting occupancy, state: “People already inside. Earlier cover is unknown and is not added to expected cover.” Under float: “Cash in the dedicated door drawer before admissions.” Confirm the venue and timezone before opening. A night may cross midnight.

**Grant staff access.** Design only for the established account-bound, expiring single-use invite. Owner manually copies/shares the link. Never expose a real invite secret in design artifacts, screenshots, or logs. Auth, token behavior, and email verification remain Ryan's implementation scope.

**Inspect the night.** Lead with recorded occupancy and save state, then entries, exits, and peak recorded occupancy. Finance section contains expected cover, opening float, and expected drawer cash. Add admissions grouped by the amount actually charged and 15-minute arrival buckets. Display venue timezone and preserve offsets when daylight-saving time makes local labels ambiguous. Entries are visits, not unique people. Starting occupancy contributes to occupancy and peak but creates no cover revenue.

**Close and reconcile.** Require pending and unknown requests to resolve first. Ask for “Counted door cash, including opening float” and optional closing notes. Show expected cover + opening float = expected drawer cash, followed by counted cash − expected drawer cash = cash variance. Use “$5 below expected,” not “$5 stolen.” Explain that variance needs investigation and that this is the dedicated door pool, excluding tips, payouts, and bar sales.

Present a review step with the exact counted amount and “Close night” confirmation. Explain: “This stops new door actions. The reconciliation will be read-only.” Keep Cancel equally discoverable. A close request with an unknown result needs reconciliation, not a fresh close with a new ID. Closed-night history presents the immutable snapshot and an owner-only CSV export; reopening and revised reconciliations are deferred.

**Synthetic acceptance example:** opening float $100; four admissions at $10 and one exit give occupancy 3 and expected cover $40. A subsequent $15 admission gives occupancy 4, entries 5, peak 4, expected cover $55, and expected drawer cash $155. Counted cash $150 gives variance −$5. Earlier $10 admissions remain $10 after a preset edit. This is a review example, not backend test evidence.

## 7. Copy and interaction rules

| Use | Avoid |
| --- | --- |
| Recorded occupancy | Exact live headcount; safe occupancy |
| Expected cover | Payments collected; total venue revenue |
| Saved / Saving / Not saved / Checking result | A green dot with no explanation |
| Cash variance; below/above expected | Theft detected; missing money proved |
| Capacity reference | Legally approved capacity indicator |
| Entries / admissions | Unique customers |
| Free entry · $0 | Guest verified; identity checked |
| Synthetic design preview | Live demo when no backend exists |

Use sentence case, verbs first, and concrete amounts. Keep confirmations for consequential actions such as undo and close; routine paid admissions must remain fast. Avoid celebratory confetti or sounds for financial records. Optional subtle feedback cannot be the only acknowledgment. Honor reduced-motion preferences and use no flashing status effects.

## 8. Accessibility and review gates

Before this design becomes product UI, verify the following with the actual rendered components:

- At 320, 360, 390, and 430 CSS pixels wide, there is no horizontal overflow, clipped price, hidden status, or overlap with safe areas. Check short landscape screens and the virtual keyboard as well.
- At 200% text enlargement and browser zoom, labels and controls reflow; primary actions remain reachable. Test reflow at 400% desktop zoom where applicable.
- All interactive elements have semantic roles, accessible names, visible focus, logical focus order, and keyboard operation. On a confirmation dialog, move focus inside, contain it appropriately, and restore it to the invoking control on dismissal.
- Verify the proposed contrast targets for every actual foreground/background pair, including hover, pressed, disabled explanation, warning, and focus states. Color never carries state alone.
- Use a screen reader to exercise one admission, unknown outcome, eligible undo, and close review. Announce meaningful changes without announcing unchanged polling results every three seconds.
- Check one-handed use on a real narrow phone in a dim setting. Measure missed taps and mistaken Exit taps; visual screenshots alone cannot establish thumb comfort or venue usability.
- Confirm there is no patron information, real staff identity, invite secret, external analytics, or implicit marketing consent in assets or fixtures.

## 9. Integration handoff

This kit can be reviewed independently now. After prerequisites merge, the assigned production implementers should map these designs onto the existing app and B1 contracts, preserving the single shared scaffold. Do not copy prototype controls into production and assume that visual behavior establishes ledger correctness.

The production acceptance gates include: four intentional admissions are retained; one retried request creates one action; two devices converge; pending requests never masquerade as saved; unknown outcomes reconcile before retry and close; polling and stale thresholds are correct; stored amounts survive price changes; exits never refund; corrections preserve the audit history and replay constraints; closed nights reject new writes; staff cannot receive owner finance; and cross-venue requests are rejected server-side. Those tests belong to the dependent implementation tasks, not this design deliverable.

Review this proposal for brand direction, mobile hierarchy, action placement, and state comprehension. Keep unresolved contract details with the B1 owner and record any accepted product change in the canonical docs through its own authorized implementation task.

## 10. Exploratory patron discovery and bottom navigation

The new [discovery concept](discover.html) proposes **Main feed · Profile · Settings** as a persistent bottom navigation. This is an explicit audience expansion: the current MVP serves venue owners and door staff; this concept serves people looking for a bar. It is authorized design exploration, not acceptance of a new production feature or a change to the MVP. The existing door console stays separate, with Exit left and Free entry right. No staff ledger, occupancy, financial, membership, or guest identity data feeds discovery.

### Navigation and discovery

Use three labeled destinations with icons, generous targets, a contrasting selected background, and a visible keyboard focus ring. Keep selection conveyed by more than color. Reserve space and respect the bottom safe area so the toolbar does not cover the last action. At large text sizes, let labels and content reflow. The review uses native radio controls rather than pretending they are fully implemented application routes; arrow keys select destinations. Production routes should expose their current destination semantically and preserve each screen's meaningful state.

Main feed presents a chosen area and fictional bar cards, then lets a user inspect sample venue details. Search stays inside Main feed rather than consuming another bottom-nav slot. Cards use editorial artwork, venue name, category, and clearly illustrative distance. No live crowd levels, real hours, prices, popularity, ranking algorithm, reservations, or route guidance are implied. Sample addresses and venues are fictional.

The location-state selector is a **review control**, not a permission setting. “Area set” shows three fabricated places around the fictional East Quarter. “Denied” explains that discovery can continue by selecting Manual search. “Manual search” shows fixed readonly example inputs and one fixed name match; expanding the no-results example demonstrates recovery copy. These are not actual filtering/geocoding or permission results.

### Location choice and privacy

In a future product, manual city/neighborhood entry must work without GPS. “Use my location” should appear only after the person chooses location-based discovery, with a short explanation before a browser permission prompt. Do not prompt on load. Denial, unavailable location, or timeout must retain the manual option and any entered query; never repeatedly prompt or claim an area was detected. Show the chosen reference area and qualify distances when accuracy is limited. Permission changes belong to the browser/device; do not represent a fake toggle as OS authorization.

The preview never invokes geolocation, creates an account, stores searches/location history, or sends patron details. Settings explains these boundaries and shows a fixed sample area. Profile is a guest-first placeholder: no fabricated identity, follower count, favorites, or functional sign-in. Browsing without an account is a proposed default, not a shipped authorization rule.

### Product decisions before implementation

Decide whether patron discovery belongs in Encore's near-term product or a separately scoped later experiment. Confirm venue data source/licensing and update ownership, search/geocoding provider and privacy/retention rules, geographic coverage, ranking criteria, stale/unavailable data handling, and whether profiles provide enough value to require accounts. None is needed to review this static design. Do not reuse the staff state endpoint for a public discovery feed: the current architecture explicitly has no public occupancy endpoint.

Production discovery needs its own authorized task and contracts. Existing #9 (staff door) and #10 (owner setup/closeout) are not discovery tasks. Keep Ryan's #8 contract work and #7 verification ownership intact. No new issue or claim is created by this design.
