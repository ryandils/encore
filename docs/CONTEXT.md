# Encore: current project context

Read this first with AGENTS.md. Keep it concise and evidence-based; inspect current code if an older handoff disagrees.

## Implemented

- Contributor harness: Node 24/pnpm 12.18.0, TypeScript 7.0.2 pinned, strict .ts harness scripts/tests, JavaScript-source guard, portable setup/document checks, and Windows/macOS/Linux CI.
- Windows/macOS quick start, task/PR templates, and learning prompts. PRs #1 and #2 established this foundation.
- Repository-local context-upkeep skill and per-change handoff gate, merged in PR #15.
- One Next.js App Router/React/Tailwind scaffold with a phone-first landing page explicitly labeled as a demo/setup milestone; strict TypeScript 7 app checks and real lint/test/build commands alongside the harness.
- Local PostgreSQL through Docker Compose, Prisma migrations, guarded local database commands, and repeatable synthetic owner/staff identity fixtures. See [local setup](LOCAL_DATABASE.md); fixture roles grant no application access.
- Tested cloud checkout bootstrap: `pnpm run cloud:setup`. The saved **encore cloud env** configuration was observed ready/runnable for this repository on `main` on November 10, 2026; each new runtime still needs verification.
- Repository-local issue inventory, prioritization, and orchestration skills are explicitly routed by AGENTS.md in the current chat. Inventory/recommendations remain read-only; implementation requires an action request and current readiness evidence. [Cloud instructions](CLOUD_ENVIRONMENT.md) contain the invocation table. Skills are available in checkouts containing their files; no global installation, new chat launch, or scheduler is implied.

## Not implemented

No auth integration, door UI, owner dashboard, or deployed service exists yet. The landing page is not connected to the database and cannot record admissions or cash. Database fixtures contain no passwords or sessions. Harness, scaffold, and local database checks are not pilot readiness.

## Durable decisions

- Phone-first web MVP; all authored code is TypeScript 7 with strict harness and app configurations. Preserve Node 24/pnpm 12.18.0 and one shared scaffold.
- Target cash-cover venues: record admissions/exits and reconcile recorded cover against counted cash. USD integer cents; immutable prices; no silent duplicate events or cross-venue access.
- One entrance and one separate door cash pool for the first pilot. Anonymous counting requires no patron PII.
- Payments, SMS, QR discounts, digital re-entry, forecasting and native apps remain deferred.
- Public repo: synthetic data only, no chat screenshots or credentials. No ECC/Cursor integration is required.

## Where to continue

Live work/claims: [GitHub issues](https://github.com/ryandils/encore/issues). [B0.3 authentication and demo roles](https://github.com/ryandils/encore/issues/6) requires the merge of [B0.2 local database and seed](https://github.com/ryandils/encore/issues/5); confirm every prerequisite and current ownership before claiming it. Conomos has [L0](https://github.com/ryandils/encore/issues/13). These are pointers, not a live status snapshot.

Read [workflow](WORKFLOW.md), [build plan](BUILD_PLAN.md), and [harness](HARNESS.md). Use [handoffs](handoffs/README.md) for change-specific evidence. Don't infer current progress from this chat.
