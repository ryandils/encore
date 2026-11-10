# Design verification

November 10, 2026 · Chromium on Linux · Synthetic data only

## Passed

- Browser review at 320, 360, 390, 430, 768, and 1440 CSS pixels: all five selectable states (30 combinations) showed exactly one status, retained the illustrative acknowledged count of 84, and had no document horizontal overflow.
- Closed specimen hides admission controls, Undo, and Undo eligibility guidance.
- Native radio group supports keyboard focus and ArrowRight selection.
- At 320 and 390 pixels, doubling each element's computed font size once produced no horizontal overflow after reflow fixes. This is a targeted enlarged-text check, not a substitute for real browser zoom or assistive technology testing.
- Preview server returned 200 for the review and guidelines; 404 for `.env`, traversal to `package.json`, `preview.ts`, and POST. No browser page exceptions observed.
- Visual inspection of [desktop](evidence/desktop.png), [mobile saved](evidence/mobile-saved.png), and [mobile stale](evidence/mobile-stale.png) captures. All depicted information is fabricated.
- `COREPACK_HOME=/tmp/encore-corepack corepack pnpm run doctor`: passed (as part of cloud setup), Node 24.22.1 and pnpm 12.18.0.
- `COREPACK_HOME=/tmp/encore-corepack corepack pnpm run check`: passed repository documentation/link/source/pin checks.
- `COREPACK_HOME=/tmp/encore-corepack corepack pnpm run lint`: passed existing configured scope (16 files); that configuration excludes design assets, so this is not an HTML/CSS lint claim.
- `COREPACK_HOME=/tmp/encore-corepack corepack pnpm run test`: 63 tests passed in 2 files. Existing baseline tests, not ledger or prototype interaction tests.
- `COREPACK_HOME=/tmp/encore-corepack corepack pnpm exec tsc --ignoreConfig --strict --noEmit --target es2023 --module nodenext --types node docs/design/mobile-brand-kit/preview.ts`: passed strict TypeScript 7.0.2 checking of the standalone preview server.

The temporary COREPACK_HOME addresses the environment's unavailable default Corepack cache path. It changes no repository configuration. The browser checks used the installed Python Playwright client with `/usr/bin/chromium` against the Node preview at `http://127.0.0.1:4173`; no browser package or repository dependency was added.

## Review fixes

Independent review identified enlarged-text overflow, mismatched wordmark color wording, lingering Undo help on the closed specimen, and a receipt headline that implied a matched drawer despite variance. Reflow, specification, closed-state guidance, and neutral “Compare the drawer.” copy were corrected. The final lead browser suite passed after these changes.

The staged `pnpm run context:check --base origin/main` passed the structured handoff gate. Independent review confirmed the final 320px enlarged-text fix; no substantive findings remain.

## Blocked / not claimed

- `COREPACK_HOME=/tmp/encore-corepack corepack pnpm run cloud:setup` installed frozen dependencies and passed doctor/compiler checks, then the required full `typecheck` failed when Prisma tried to fetch a checksum from `binaries.prisma.sh` (HTTP 403). That host is absent from the managed environment's allowed hosts. No checksum bypass or network-policy change was made.
- Full application build was not run: `scripts/build.ts` begins with the same blocked Prisma generation. There are no application changes in this design task. A future full check needs the environment owner to permit the documented Prisma download host.
- No real phone, iOS/Safari, VoiceOver/TalkBack, screen-reader, virtual-keyboard, or physical venue usability test was performed. No blanket WCAG AAA certification is claimed. Computed palette ratios are documented in the guidelines.
- This review has no real actions, persistence, auth, shared state, polling, or financial endpoint. It cannot prove transaction ordering, retries, permissions, concurrency, or two-device behavior. Those remain implementation gates after the relevant prerequisites merge.
