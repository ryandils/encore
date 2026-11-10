# Encore mobile design kit

Independent design proposal, not production UI. Open [index.html](index.html) in a browser, or from the repository root run:

```text
node docs/design/mobile-brand-kit/preview.ts
```

Then visit `http://127.0.0.1:4173`. Stop with Ctrl+C. Requires the repository's Node 24 baseline; no database, sign-in, package changes, or external requests. The server listens on loopback and serves only this review's explicit asset list. It does not serve the app or repository. If the port is occupied, stop the other preview first.

## Review

- Explore the mobile door composition; select Saved, Pending, Stale, Failed, and Closed to inspect state treatments. These are fixed examples, not simulated transactions.
- Scroll through owner opening, reconciliation, and close-confirmation compositions. The door and closeout use separate synthetic scenarios: 84 people for the staff visual; the canonical five-admission example for owner arithmetic.
- Inspect the complete requested palette, proposed E mark, typography, spacing, and voice.
- Read [GUIDELINES.md](GUIDELINES.md) for exact interaction states, limits, role separation, accessibility targets, and eventual integration gates.
- Read [VERIFICATION.md](VERIFICATION.md) for actual checks and remaining evidence gaps.

Product controls are intentionally inactive. Only review navigation, state selection, and the accessibility disclosure operate. No data is recorded or stored; refresh returns to fixed examples. The exact palette is black, white, electric `#0000FF`, sky `#00A1FF`, periwinkle `#5381E6`, violet `#5820C7`, and silver `#C0C0C0`. The mark is original vector geometry, not a licensed font logo. The wordmark is a system-font treatment; a final outlined logo remains a brand-review decision.

## Scope and integration

All work is additive under this directory plus the unique [handoff](../../handoffs/design-mobile-brand-kit.md). Ryan's #6, #7, and #8 remain untouched. No changes to shared manifests, application routes, auth/demo, schema, API, CI, or canonical product docs. This is not completion of #9 or #10; implementation must wait for merged prerequisites and fresh ownership checks.

The primary identity remains lowercase Encore and “Know your door. Account for your cover.” The new colors follow the explicit design request and supersede the old amber/navy seed only in this proposal. “After dark. In control.” is proposed editorial copy, not a promise of exact occupancy or loss prevention.
