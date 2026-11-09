# Build plan and team handoffs

This repository starts with docs only. Task status below is a baseline, not live coordination; use current GitHub issues/PRs to claim work and track completion. Suggested owners are workstream suggestions, not assignments or collaborator invitations.

## Dependency order

B0 -> B1 -> B2 and B3 in parallel -> B4 -> B5.

B2/B3 may build against B1's documented synthetic fixtures while B4 finishes backend integration. Do not mistake those fixtures for a working shared backend. Merge changes to shared contracts before dependent work diverges.

## B0 — One working scaffold

Suggested lead: Ryan or whichever founder starts first. Status: unstarted.

- Create a single Next.js/TypeScript/Tailwind app with the structure in ARCHITECTURE.md.
- Pin a supported Node version, package manager, dependencies, and lockfile.
- Add lint, typecheck, test, build, and seed scripts, plus CI for the supported checks.
- Provide local PostgreSQL setup, an .env.example with placeholders, and actual setup commands in README.md.
- Build a labeled demo shell with synthetic owner/staff accounts and no outbound messages.
- Set up the maintained auth library; make demo bypass impossible in production.

Done: another contributor can clone, install, start the database, migrate, seed, and run the demo using README.md. CI passes. Secrets are absent from git.

## B1 — Domain and API contracts

Suggested lead: Ryan. Status: unstarted. Depends on B0.

- Implement pure event projection and money/traffic calculations.
- Define schemas, request/response types, error codes, and fixtures for B2/B3.
- Create initial Prisma models/migrations and transactional command interfaces.
- Lock the API contract to ARCHITECTURE.md or update it with a concrete reason.

Done: tests cover admissions at multiple prices, free entry, exits, reversals, opening occupancy, invalid negative occupancy, money math, peak/buckets, and the MVP acceptance scenario. B2/B3 have shared types and synthetic fixtures.

## B2 — Door console

Suggested lead: Conomos. Status: unstarted. Depends on B1.

- Build phone-first door screen: three cover buttons, free entry, exit, occupancy, recent actions, undo.
- Show price labels, save feedback, pending/failed requests, stale state, and retry.
- Poll and refresh through the shared API adapter; use unique IDs per action and the same ID on retry.
- Prevent accidental double-submission of one action without dropping intentional quick repeated taps.
- Keep owner-only finance and configuration out of staff screens.

Done: narrow-phone browser check; four admissions and one exit work quickly; offline/unknown outcomes do not masquerade as saved actions. An isolated demo is labeled until B4 connects it.

## B3 — Owner setup and closeout

Suggested lead: Mike. Status: unstarted. Depends on B1.

- Build venue setup, cover presets, open-night form, and staff invite/revoke UI.
- Build owner summary: counts, peak occupancy, arrival buckets, cover totals by price.
- Build closeout form for counted cash including float, variance, and closing notes.
- Add read-only closed-night history and CSV download.

Done: the full acceptance scenario can be exercised against contract fixtures, prices are clear, variance has a neutral label, and close confirmation explains that later writes are blocked. Labeled demo until B4.

## B4 — Shared backend and permissions

Suggested lead: Ryan; integrate with B2/B3 owners. Status: unstarted. Depends on B1; completes after B2/B3.

- Implement server routes, real persistence, sessions, membership checks, assignments, and invite acceptance.
- Serialize writes and closing, enforce idempotency, and preserve the audit ledger.
- Replace fixture adapters with live endpoints; retain a separate synthetic demo.
- Add owner-only CSV export with formula escaping.
- Finish auth verification/recovery setup needed for the pilot, without committing provider credentials.

Done: two separately authenticated devices converge; events survive reload; retry/concurrency/close races are tested against PostgreSQL; wrong-venue and staff restrictions are enforced server-side.

## B5 — Pilot readiness

Suggested lead: all three. Status: unstarted. Depends on B4.

- Follow PILOT.md, including physical backup, dedicated cash pool, and permission checks.
- Record actual browser/device results, configured services, and any operational limitations.
- Verify backup/restore, auth recovery, logging redaction, and deployment environment separation.
- Ask one venue to try a real shift; do not imply it has agreed already.

Done: pilot gates pass, owner understands what the numbers mean, and known limitations are written down. If time runs out, ship a labeled demo rather than presenting unfinished access controls as pilot-ready.

## Copy/paste task prompt

Read AGENTS.md and all linked product docs. Inspect the repository and current PRs. Take task B[number] only if its dependencies are merged and nobody else has claimed it. Create a task branch, implement its acceptance criteria, and update the README if commands or setup change. Run relevant checks and open a focused PR. Report exactly what works, what is mocked, and what the next task needs. Do not add roadmap features.

## Weekend operating plan

Friday: agree on scope; one scaffold; establish contracts.
Saturday: door and owner screens in parallel; backend integration.
Sunday: two-device testing and a controlled rehearsal. Run a real pilot only if readiness gates pass.

If short on time, cut visual polish and custom charting first. Do not cut authorization, durable events, idempotency, or correct cash arithmetic.

## Decisions for founders to validate

- Which venue and actual door operator will test first?
- Can it use one entrance and a dedicated cash pool with no payouts during the shift?
- Are email accounts/invite links workable for staff?
- What does the owner currently record and how long does closeout take?
- Which outcome would justify using Encore a second night?
- What would the owner pay per venue, and how would future SMS costs affect pricing?

Record real answers in a later pilot note without adding private staff/patron data. The screenshot's subscription figures and forecasting claims remain hypotheses.
