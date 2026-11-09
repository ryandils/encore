# Rehearsal and first pilot

## Objective

Learn whether staff can record door activity consistently and whether the owner values the resulting cash comparison and traffic history. A polished UI alone does not validate the business.

## Before using real data

- One willing owner, one designated entrance, and one separately managed door cash pool.
- Complete B4 and verify authentication, tenant isolation, staff roles, invite expiry/revocation, and closed-night enforcement.
- Configure production auth verification/recovery, HTTPS, database backups, and a tested restore path.
- Tell the owner which records are stored, who can see them, and how to export/delete pilot data.
- Use a physical clicker/log as backup. Encore does not replace venue ID checks, stamps, safety procedures, or official capacity requirements.
- Ensure every door operator and device knows whether it records entry, exit, or cash; do not count the same guest on two devices.
- Separate cover from tips, bar sales, refunds, and cash payouts. Record float at opening.
- Establish what happens on a lost connection: use the backup and resolve unknown requests before repeating them or closing.
- Do not collect guest phone numbers or send texts in this MVP.

## Synthetic rehearsal

Run the numbered scenario in MVP.md on two devices. Also test:

1. Simultaneous admissions from separate authenticated sessions.
2. Identical request retry after a timeout, including retry after close.
3. Same request ID with a changed payload.
4. Exit at zero; reversal affecting later exits.
5. Staff denied summary/export/close and wrong-night writes.
6. Cross-venue reads/writes denied.
7. Expired, consumed, revoked, and wrong-email invite attempts.
8. Staff revocation while their screen is already open.
9. Close racing against an admission: exactly one valid server ordering.
10. Refresh, sleep/wake, stale connection, and persistent history.
11. Venue timezone, midnight crossing, and daylight-saving bucket labels.
12. CSV quoting and formula escaping.

Keep test fixtures synthetic. Record devices, browser versions, and results in the implementation PR. A single browser with fake polling does not pass the two-device test.

## During the night

Record operational observations without patron identities: tap speed, mistaken taps, stale periods, missed counts, price changes, and why the operator stopped using it if they did.

At intervals, compare Encore's acknowledged count against the agreed physical reference. Note the difference and time; do not silently rewrite history to make a chart look right. If there is an outage or unrecorded admission, mark the night incomplete in closing notes.

## At close

Count physical cash including opening float before other expenses are removed. Close the night, review expected cover and variance, and export the records.

A negative variance is an unresolved mismatch. Missed taps, wrong prices, comps, change mistakes, and cash handling are possible explanations; Encore cannot establish that an employee stole money.

## Evidence to collect

- Time to set up and start the night.
- Time and mistakes per typical admission sequence.
- Count drift versus the agreed reference and reasons observed.
- Closing time compared with the owner's usual process.
- Whether the owner understands the cash variance without explanation.
- Whether the owner chooses to use Encore next weekend.

Proposed experiment targets: setup under 5 minutes, common admission action under 2 seconds, and an owner willing to repeat the pilot. These are targets, not measured results. Agree on an acceptable count-drift threshold with the venue before the shift.

Do not interpret one night's variance as recovered revenue or promise forecasting accuracy from a few weekends.

## Commercial follow-up

Interview the owner about willingness to pay per venue after they use it. Treat $5/$10/$20 and a free month as experiments. Before adding texting, calculate actual provider/number/message costs and consent/support requirements; a high tier does not automatically recoup a trial's costs.
