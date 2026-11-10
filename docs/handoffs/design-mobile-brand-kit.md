# Design — mobile UI and electric brand kit

## Task

Explicitly requested independent UI/brand design work on branch `design/mobile-brand-kit`, based on merged main `e6844a8`. Not an implementation claim for #9 or #10. Ryan retains #6, #7, and #8. Current GitHub reads confirmed #7 and #8 are blocked and auth PR #24 remains open/unmerged at orientation. No issue ownership/status was changed.

## Outcome

A polished responsive review with a mobile staff door specimen, five selectable save/connectivity/closed states, owner opening/closeout specimens, a proposed vector E mark, the complete requested black/white/blue/violet/silver palette, and brand/interaction guidelines. All data is synthetic; illustrative product controls cannot record or close anything.

Run `node docs/design/mobile-brand-kit/preview.ts`, then open `http://127.0.0.1:4173`. The [kit README](../design/mobile-brand-kit/README.md) explains review controls and limitations.

## Changes

Additive files under `docs/design/mobile-brand-kit/` only, plus this handoff. Native HTML radio selection and disclosure controls allow review without a runtime framework. The small strict TypeScript preview server uses a read-only asset allowlist and loopback binding. The palette supersedes amber/navy only within the requested proposal; production branding is untouched.

## Verification

See [verification evidence](../design/mobile-brand-kit/VERIFICATION.md). Browser checks passed 30 viewport/state combinations, keyboard radio navigation, 320/390-pixel 200% text checks, and server allowlist checks. Existing doctor/check/lint and 63 baseline tests passed; standalone server strict TypeScript 7 check passed. Full typecheck was blocked by HTTP 403 for the Prisma engine checksum host; application build was not run because it starts with the same blocked prerequisite. No production or real two-device behavior is claimed.

Independent review findings were addressed: enlarged-text wrapping, wordmark color documentation, closed-state guidance, and neutral variance copy. Context gate and final diff checks are recorded with the final review result.

## Context impact

No canonical documents changed: this is a proposal and review tool, not new app behavior, contracts, contributor requirements, setup baseline, or completed milestone. Existing product/architecture documents remain authoritative. Shared manifests/lockfile, app routes, auth/demo, schema/API, CI, and Ryan's canonical-document scope were untouched.

## Learning note

A design specimen lets the team agree on hierarchy and error states before implementing shared contracts. Disabled sample buttons are intentional: a convincing screenshot must not be mistaken for a saved transaction. Native review controls work, while product behavior remains deferred.

## Next step

Review brand direction and mobile composition. After B1 and other prerequisites merge, the assigned #9/#10 implementers can map accepted design decisions onto the shared app and verify real money, permission, retry, and concurrency behavior. Physical-phone and assistive-technology testing remains necessary. The environment must allow the documented Prisma download host before full repository typecheck/build evidence can be collected. Human review/merge is required; no deployment or issue closure is authorized or performed.
