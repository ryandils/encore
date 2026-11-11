# Encore: current project context

Read this first with AGENTS.md. Keep it concise and evidence-based; inspect current code if an older handoff disagrees.

## Implemented

- Contributor harness: Node 24/pnpm 12.18.0, TypeScript 7.0.2 pinned, strict .ts harness scripts/tests, JavaScript-source guard, portable setup/document checks, and Windows/macOS/Linux CI.
- A [common demo baseline rehearsal](BASELINE_VERIFICATION.md) connects contributor checks, local database/auth setup, and browser steps with a safe platform evidence template. Production HTTP smoke checks complement builds in the three-OS CI matrix. A dedicated hosted Windows job uses native PostgreSQL and Chromium to automate the real demo forms and phone layout; native Docker Desktop, automated browser, and physical interactive evidence remain separately identified.
- B0 platform acceptance includes the accepted native/hosted Windows evidence and [native macOS installation, database/authentication, browser, and stop/resume verification](https://github.com/ryandils/encore/issues/7#issuecomment-6780430790) at merged `a555c69`. This is baseline acceptance, not a physical-phone walkthrough or pilot evidence.
- Windows/macOS quick start, task/PR templates, and learning prompts. PRs #1 and #2 established this foundation.
- Repository-local context-upkeep skill and per-change handoff gate, merged in PR #15.
- One Next.js App Router/React/Tailwind scaffold with a phone-first landing page explicitly labeled as a demo/setup milestone; strict TypeScript 7 app checks and real lint/test/build commands alongside the harness.
- Local PostgreSQL through Docker Compose, Prisma migrations, guarded local database commands, and repeatable synthetic owner/staff identity fixtures. See [local setup](LOCAL_DATABASE.md).
- B1 pure ledger projections and reconciliation math, shared API contracts and labeled synthetic fixtures for B2/B3, and domain Prisma models with database constraints. These are shared building blocks; the demo still cannot record live admissions or cash.
- Independent [mobile brand and discovery design prototypes](design/mobile-brand-kit/README.md), merged in PR #26. They are review artifacts; patron discovery and location functionality are not implemented MVP features. The local customer-profile exploration adds linked fictional venue pages with an illustrated photo placeholder, sample hours/address, and explicitly non-live occupancy; no backend or owner editing is connected. Its My Spots tab keeps favorites and recent fictional venue views in browser-local storage only; Profile and Settings remain separate.
- Better Auth email/password sessions for a synthetic local demo, with protected owner/staff navigation and sign-out. Separate `auth:init`/`auth:seed` commands generate local secrets and create credential accounts; fixture roles select demo pages only and grant no venue membership or night assignment. All auth/demo entry points reject production mode.
- Tested cloud checkout bootstrap: `pnpm run cloud:setup`. The saved **encore cloud env** configuration was observed ready/runnable for this repository on `main` on November 10, 2026; each new runtime still needs verification.
- Repository-local issue inventory, prioritization, and orchestration skills are explicitly routed by AGENTS.md in the current chat. Inventory/recommendations remain read-only; implementation requires an action request and current readiness evidence. [Cloud instructions](CLOUD_ENVIRONMENT.md) contain the invocation table. Skills are available in checkouts containing their files; no global installation, new chat launch, or scheduler is implied.

- An isolated owner fixture rehearsal at `/demo/owner-rehearsal` covers venue/night setup, price changes, simulated staff access, traffic summary, cash closeout, session-only history and CSV. It is disabled in production and clears on refresh; no real invitations or shared backend are involved.
- B2 synthetic door console at `/demo/door`: phone-sized paid/free entry, exit, eligible undo, recent actions, acknowledged occupancy and explicit pending/rejected/unknown/stale feedback. An in-memory adapter consumes B1 contracts; reload resets it and production rejects the route. No database or login is required for these fake records.

- Shared pure CSV formatting is reused by the synthetic owner rehearsal; spreadsheet-safe formatting is separate from the still-unimplemented protected export endpoint.

- First B4 server kernel: internal PostgreSQL event/close transactions, membership/assignment checks, durable retry receipts, scoped door reads and owner summaries. The standalone kernel has no routes itself; local HTTP integration is described below. Live UI integration remains outstanding; see the B4 boundary in [architecture](ARCHITECTURE.md).

- Local session-authenticated ledger HTTP routes expose the internal kernel for scoped reads, event commands and closing. They are unavailable in production and do not connect the fixture screens.

- Local authenticated venue/night setup, preset changes and staff invitation/assignment APIs persist through PostgreSQL. Invites require a verified intended account, store token hashes and support pending cancellation; no invitation email or acceptance page is provided.

- A separate `/nights/[nightId]/door` local persisted rehearsal uses authenticated ledger APIs, validates acknowledgements and gates refresh recovery of unresolved request IDs through per-tab storage. The fixture demo remains separate; production and physical-device acceptance are not provided.

## Not implemented

No production ledger endpoints, production owner dashboard, or production authentication exists yet. Local HTTP routes enforce venue/night authorization but do not establish an operational service. Real-user email verification and recovery require future provider configuration. Both fixtures record simulated actions only; neither can record live admissions or cash. Harness, scaffold, local database, and authentication checks are not pilot readiness.

## Durable decisions

- Phone-first web MVP; all authored code is TypeScript 7 with strict harness and app configurations. Preserve Node 24/pnpm 12.18.0 and one shared scaffold.
- Target cash-cover venues: record admissions/exits and reconcile recorded cover against counted cash. USD integer cents; immutable prices; no silent duplicate events or cross-venue access.
- One entrance and one separate door cash pool for the first pilot. Anonymous counting requires no patron PII.
- Payments, SMS, QR discounts, digital re-entry, forecasting and native apps remain deferred.
- Public repo: synthetic data only, no chat screenshots or credentials. No ECC/Cursor integration is required.

## Where to continue

Live work/claims: [GitHub issues](https://github.com/ryandils/encore/issues). For the next implementation milestone, inspect [B4 shared backend integration](https://github.com/ryandils/encore/issues/11) and its prerequisite acceptance and ownership records. The [B2 door](https://github.com/ryandils/encore/issues/9) and [B3 owner](https://github.com/ryandils/encore/issues/10) records provide screen-fixture evidence; merged screens alone do not prove backend readiness. Confirm merges and current ownership before claiming work. Issue-body Status fields own the live record; manually maintained `status:*` labels mirror them for filtering. These are pointers, not a live status snapshot.

Read [workflow](WORKFLOW.md), [build plan](BUILD_PLAN.md), and [harness](HARNESS.md). Use [handoffs](handoffs/README.md) for change-specific evidence. Don't infer current progress from this chat.
