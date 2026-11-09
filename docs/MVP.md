# Weekend MVP specification

Status: proposed implementation baseline, distilled from the founders' conversation on November 9, 2026. Features discussed in that conversation are not all commitments.

## Product and buyer

**Encore helps a cash-cover venue owner understand door traffic and compare recorded cover charges with the cash handed over at the end of the night.**

Buyer: owner or manager of an independent bar/small club. Operator: employee working the door. Pilot: one entrance, one shared door cash pool, one active night per venue. The owner can also operate the door. Multiple staff devices must share the same ledger.

Upstream value hypothesis: fewer unexplained cash discrepancies and better staffing decisions from consistent arrival/occupancy history. These outcomes require pilot evidence. Existing competitors do not establish this product's fit.

## Must ship

| Capability | Minimum behavior |
| --- | --- |
| Access | Owner account; staff account; expiring single-use invite link granting access to one night. Owner copies/shares the link manually. No SMS dependency. |
| Venue setup | Name, IANA timezone, capacity reference, three nonnegative USD cover presets. |
| Open night | Name/date label, opening time, starting occupancy (default 0), opening door cash float (default $0). A night can cross midnight. |
| Door console | Three price buttons, free-entry button, Exit button, recorded occupancy, and recent actions. Every accepted tap receives visible save feedback. |
| Corrections | Staff may undo their own latest uncorrected action within 60 seconds while the night is open; owner can correct any action with a reason. Preserve originals. |
| Shared state | Online writes are transactional; devices poll at most every 3 seconds while active and refresh after writes. Show disconnected/stale status. |
| Owner summary | Entries, exits, recorded occupancy, peak recorded occupancy, admissions by charged price, expected cover, and 15-minute arrival buckets. |
| Close/reconcile | Owner closes the night and enters counted cash including float. Show expected drawer cash and variance. Closed nights are read-only. |
| History/export | Owner can reopen a summary and export the event ledger and reconciliation as CSV. |

No staff scheduling, SMS login, outbound invitations, guest signup, billing, or AI is required.

## Door interaction

A price tap means: admit exactly one person and record that exact cash cover. Four people paying $10 each means four $10 taps. A free admission increments occupancy with $0 cover. One Exit tap decrements occupancy without changing cover. Thus four $10 admissions and one exit produce four entries, one exit, net occupancy +3, and $40 expected cover.

Comped guests and returning guests use free entry in this MVP. Free entries can include repeat visits: do not call entries unique people. A price change applies only to subsequent admissions. Owners edit presets; staff select but cannot edit them.

Keep a physical re-entry stamp and existing ID/age checks during the pilot. A count is not a guest identity or a re-entry credential.

## Metrics and precise language

For valid, uncorrected events:

- Entries = paid admissions + free admissions.
- Recorded occupancy = starting occupancy + entries - exits.
- Peak occupancy = highest recorded occupancy in accepted server event order, including the starting value.
- Expected cover = sum of charged admission amounts in cents.
- Expected drawer cash = opening float + expected cover.
- Cash variance = actual counted drawer cash - expected drawer cash. Negative means a shortfall relative to recorded transactions.
- Capacity-equivalent turns = entries / capacity, only when capacity > 0. This is not unique customers or the number of times the room reached capacity.
- Arrival traffic = admissions per 15-minute bucket, displayed in venue timezone; retain timezone offsets across daylight-saving transitions.

Corrections recompute projections from the effective event ledger. Do not derive cash from current occupancy or the latest price. Do not infer total venue sales, drinks sold, profit, theft, or future attendance.

The MVP has no refunds, payouts, tips, deposits, or cash transfers. Keep those outside the dedicated door cash pool and record any real-world deviation in closing notes. A venue that cannot keep that pool separate is not ready for this pilot.

## Deliberate cuts and later sequence

1. First validate counting and cash reconciliation.
2. Then experiment with QR guest lists and one-use discounted admissions.
3. Add optional, separately consented marketing subscriptions and compliant messaging.
4. Consider digital re-entry only after identity and duplicate-entry behavior are designed.
5. Evaluate payment processing, forecasts, and native apps based on observed demand.

Deferred: NFC/Tap to Pay, prepaid cover, public crowd maps, patron subscriptions, staff schedules, POS integrations, cross-bar passes, automated pricing, heat maps, and theft detection. The proposed $5/$10/$20 monthly tiers are hypotheses; do not implement tier limits or promise SMS economics yet.

## Acceptance scenario

1. Owner opens a night with capacity 100, starting occupancy 0, float $100, and presets $5/$10/$15.
2. Staff admits four guests at $10; one guest exits.
3. Both devices converge to occupancy 3, entries 4, exits 1, and expected cover $40.
4. Owner changes the $10 preset to $15; one more guest enters at $15.
5. Summary shows occupancy 4, entries 5, peak occupancy 4, cover $55, expected drawer $155, and 0.05 capacity-equivalent turns.
6. Owner counts $150 and closes. Variance is -$5. Refresh preserves the result. New staff writes are rejected.
7. Export contains the individual $10/$15 admission amounts, exit, actors, times, and the closing result.

## Additional acceptance conditions

- Two devices admitting concurrently produce two entries; neither is overwritten.
- Retrying one request ID records one action, not two.
- Exit at occupancy zero is rejected without mutating the ledger.
- Reversing an admission is rejected if replay would make occupancy negative at any point; the owner must resolve the dependent exit first.
- Wrong-venue users cannot read events, invoke writes, or export summaries even with guessed IDs.
- Staff cannot view reconciliation, close nights, change prices, invite others, or operate outside their assignment.
- Expired, revoked, or consumed invites cannot grant new access.
- An offline attempt shows failure/pending state rather than an invented saved count. Use a physical backup; no offline multi-device merge is promised.
- Capacity is a reference: highlight an at/above-capacity count without silently dropping genuine arrivals or claiming a safety certification.
