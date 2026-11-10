# Encore: current project context

Read this first with AGENTS.md. Keep it concise and evidence-based; inspect current code if an older handoff disagrees.

## Implemented

- Contributor harness: Node 24/pnpm 12.18.0, TypeScript 7.0.2 pinned, strict .ts harness scripts/tests, JavaScript-source guard, portable setup/document checks, and Windows/macOS/Linux CI.
- Windows/macOS quick start, task/PR templates, and learning prompts. PRs #1 and #2 established this foundation.
- Repository-local context-upkeep skill and per-change handoff gate, merged in PR #15.

- Tested cloud checkout bootstrap: `pnpm run cloud:setup`; saved environment creation/publication remains a settings step, not a confirmed resource.

## Not implemented

No Next.js app, database, auth integration, door UI, owner dashboard, deployed service, or app typecheck exists yet. Harness success is not application or pilot readiness.

## Durable decisions

- Phone-first web MVP; All authored code is TypeScript 7; B0 extends the existing strict harness checks to application code. Preserve Node 24/pnpm 12.18.0 and one shared scaffold.
- Target cash-cover venues: record admissions/exits and reconcile recorded cover against counted cash. USD integer cents; immutable prices; no silent duplicate events or cross-venue access.
- One entrance and one separate door cash pool for the first pilot. Anonymous counting requires no patron PII.
- Payments, SMS, QR discounts, digital re-entry, forecasting and native apps remain deferred.
- Public repo: synthetic data only, no chat screenshots or credentials. No ECC/Cursor integration is required.

## Where to continue

Live work/claims: [GitHub issues](https://github.com/ryandils/encore/issues). Start with [B0.1](https://github.com/ryandils/encore/issues/4) if still Ready and unclaimed; Conomos has [L0](https://github.com/ryandils/encore/issues/13). These are pointers, not a live status snapshot.

Read [workflow](WORKFLOW.md), [build plan](BUILD_PLAN.md), and [harness](HARNESS.md). Use [handoffs](handoffs/README.md) for change-specific evidence. Don't infer current progress from this chat.
