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

## Follow-up: left exit / right entry

Swapped the secondary action document order: Exit (−), No refund on the left; Free entry (+), $0 cover on the right. Refreshed both mobile evidence images. Chromium checks at 320/390/430 pixels passed label, left-to-right position, disabled illustrative-control, five-state selection, closed-state hiding, and no-overflow assertions. Doctor and repository checks passed again. Full typecheck was attempted again; the existing Prisma host limitation remains separately reported.

## Follow-up: discovery and bottom navigation

Main feed/Profile/Settings and area/denied/manual-search design states passed Chromium checks at 320/390/430/768px, including keyboard radio selection and no horizontal overflow. A 320px computed-text doubling check passed. Preview server still rejects `.env`; no page exceptions were observed. Independent review found no substantive issues. Refreshed evidence: [feed](evidence/discovery-feed.png), [denied](evidence/discovery-denied.png), [manual search](evidence/discovery-search.png), [settings](evidence/discovery-settings.png). These screenshots contain fictional data only.

Doctor, repository check, and standalone preview strict TypeScript 7 check passed. Full typecheck was attempted and again blocked by the existing Prisma checksum host HTTP 403; no checksum bypass was used. Actual device location, filtering/geocoding, accounts, real bar data, and physical-phone usability remain unimplemented/unverified.

## Follow-up: customer profiles and My Spots (November 11, 2026)

The earlier discovery screenshots and browser checks describe the previous three-tab review. The current local prototype has Discover, My Spots, Profile, and Settings, linked fictional venue profiles, tappable Apple Maps destinations, browser-local favorites/recents, and a top-header search disclosure. Location-state review switches have been removed. The existing evidence images have not been regenerated and must not be presented as screenshots of this revision.

On Windows with Node 24.14.1 and pinned pnpm 12.18.0 / TypeScript 7.0.2:

- Focused Node tests cover profile data and links, explicit sample labels, Maps encoding, header control targets, search disclosure, favorite add/remove, normalized stored IDs, reload persistence via a test storage adapter, recent ordering, unavailable storage, all four tabs, empty-hash return to Discover, inset saved-card focus, and removal of location-state toggles.
- Live loopback HTTP checks cover discovery, all three venue profiles, styles and local modules. Private source and environment routes remain unavailable.
- Doctor, repository check, full strict typecheck, lint (60 configured files), all 186 existing tests (one skipped), optimized application build, and production HTTP verification pass. Lint's configured scope excludes these design files, so it is not HTML/CSS lint evidence. The focused prototype tests and standalone strict TypeScript checks are run separately, outside the default app test/typecheck scope.
- Automated browser interaction was unavailable for this local revision. Current mobile layout, actual focus/history/storage behavior, and native Apple Maps handoff are not device-verified. Source and HTTP checks are not a substitute for that acceptance.

All venue data remains fictional and occupancy is not live. No production backend, account, shared history, or geolocation capability is added.