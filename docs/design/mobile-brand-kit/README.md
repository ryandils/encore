# Encore mobile design kit

Independent design proposal, not production UI. Open [index.html](index.html) in a browser, or from the repository root run:

```text
node docs/design/mobile-brand-kit/preview.ts
```

Then visit `http://127.0.0.1:4173`. Stop with Ctrl+C. Requires Node 24 and the repository's pinned dependencies: run corepack pnpm install --frozen-lockfile once before starting. Startup compiles the TypeScript browser client into ignored .generated/discovery-preview output. No new dependencies, database, or sign-in are required. Preview pages make no external requests until the user taps a Maps address link. The server listens on loopback and serves only this review's explicit asset list. It does not serve the app or repository. If the port is occupied, stop the other preview first.

## Discovery exploration

Start the preview server with `node docs/design/mobile-brand-kit/preview.ts`, then open `http://127.0.0.1:4173/discover.html` for Discover, My Spots, Profile, Settings, and linked venue profiles, with a fixed fictional sample area and a top-header sample search. Do not open discover.html directly as a local file: the venue-profile routes require the server. This introduces a proposed patron audience beyond the current operator MVP; see section 10 of the guidelines for assumptions. Inputs and search results are fixed examples.

## Review

- Explore the mobile door composition; select Saved, Pending, Stale, Failed, and Closed to inspect state treatments. These are fixed examples, not simulated transactions.
- Scroll through owner opening, reconciliation, and close-confirmation compositions. The door and closeout use separate synthetic scenarios: 84 people for the staff visual; the canonical five-admission example for owner arithmetic.
- Inspect the complete requested palette, proposed E mark, typography, spacing, and voice.
- Read [GUIDELINES.md](GUIDELINES.md) for exact interaction states, limits, role separation, accessibility targets, and eventual integration gates.
- Read [VERIFICATION.md](VERIFICATION.md) for actual checks and remaining evidence gaps.

Transaction controls are intentionally inactive. Review navigation, state selection, the accessibility disclosure, and customer venue-profile links operate. Venue details and occupancy remain fixed examples. Only favorite venue IDs and recently viewed venue IDs are saved in browser-local storage; they survive refresh in the same browser and origin. No data is sent to a backend. The exact palette is black, white, electric `#0000FF`, sky `#00A1FF`, periwinkle `#5381E6`, violet `#5820C7`, and silver `#C0C0C0`. The mark is original vector geometry, not a licensed font logo. The wordmark is a system-font treatment; a final outlined logo remains a brand-review decision.

## Scope and integration

The original proposal is documented in the [design handoff](../../handoffs/design-mobile-brand-kit.md). The customer profile and My Spots extension stays under this directory, with a focused [customer-flow handoff](../../handoffs/local-customer-venue-profiles.md) and a capability note in CONTEXT.md. Ryan's #6, #7, and #8 remain untouched. No changes to shared manifests, application routes, auth/demo, schema, API, CI, or canonical product docs. This is not completion of #9 or #10; implementation must wait for merged prerequisites and fresh ownership checks.

The primary identity remains lowercase Encore and “Know your door. Account for your cover.” The new colors follow the explicit design request and supersede the old amber/navy seed only in this proposal. “After dark. In control.” is proposed editorial copy, not a promise of exact occupancy or loss prevention.

## Local customer venue-profile prototype

On the preview server, open `http://127.0.0.1:4173/discover.html` and tap any of the three venue cards. Each opens a dedicated customer profile with an illustrated photo placeholder, sample address, seven-day hours, and explicitly fictional occupancy/capacity. The North Room result in the top-header search opens the same profile. Native links support keyboard activation, browser Back/Forward, and direct reload. The All spots links return to the selected card.

These routes require the Node preview server; opening discover.html directly as a file does not serve the profile routes. After changing any preview TypeScript file, restart the preview server to compile/reload it; after HTML/CSS changes, refresh the page.

The shared illustration is a placeholder, not a photograph of a real venue. No owner editing, uploaded photos, verified hours, embedded map service, live count, or backend is connected. Fixture counts do not reflect changes in the separate door/owner rehearsals. This exploration does not change the operator MVP or complete B4.

Run focused checks with `node --test docs/design/mobile-brand-kit/venue-profiles.test.ts docs/design/mobile-brand-kit/spots-state.test.ts`.

Addresses on the sample profiles are tappable Apple Maps directions links, using Apple's [unified Maps URL format](https://developer.apple.com/documentation/mapkit/unified-map-urls). Only the URL-encoded fictional destination is included. The preview does not request device location or start navigation automatically. Tapping opens Maps or its website separately; Apple Maps may not resolve fictional addresses, and any routing or location choices happen there. Native iOS handoff has not been device-tested.

The top magnifying-glass control is a native, keyboard-operable disclosure. It opens the existing labeled sample search field and a fixed North Room result; tap it again to close. It is available from Discover, My Spots, Profile, and Settings. Search remains a read-only synthetic example, not live filtering. The bottom navigation and return guidance use the label Discover.

## My Spots (this browser only)

Open a bar profile, tap Add to favorites, then choose View My Spots. Favorites persist across refresh and can be removed from the profile or My Spots. Recently viewed bars are recorded when their profiles open, newest first with duplicates removed. Discover, My Spots, Profile, and Settings remain four distinct tabs. The direct My Spots address is `http://127.0.0.1:4173/discover.html#my-spots`.

The browser stores only fictional venue IDs under encore.discovery.spots.v1. This is not an account or synchronized history: another browser, device, hostname, or port has a different list. Clearing site data removes the list. If storage is blocked or full, the UI warns that selections last only on the current page. All venue data and occupancy remain synthetic. No browser or location permissions are requested.

The customer Discover screen does not include development location-state switches. The former Area set, Denied, and Manual search controls were design-review fixtures, not real permission or search settings. The sample-area label remains visible; future manual-entry and denied-permission accessibility requirements remain documented in the guidelines and Settings explanation.

## Persistent customer navigation

The bottom bar stays fixed on Discover, My Spots, Profile, Settings, and all three venue profiles. Venue profiles highlight Discover as their parent section and provide native keyboard-operable links to all four destinations. Content reserves space for the bar and mobile bottom safe area.

To keep another preview running, set ENCORE_PREVIEW_PORT to an unused port before starting preview.ts (for example, in PowerShell: $env:ENCORE_PREVIEW_PORT='4174'). The default remains 4173. A different port has separate browser-local favorites and recents. Existing server processes must be restarted to load TypeScript changes; alternatively use the new port.

## Picture cards and sample occupancy filter

Every Discover card uses the existing illustrated bar placeholder on the left and venue details on the right. Each image says Sample image; these are not actual venue photos. Replace the card image source with an approved venue photo when one is available.

Open the compact Filter control at the top right beside Around this area, then choose All occupancy levels, Under 50% full, 50% to under 80% full, or 80% full or more. The filter compares occupancy divided by capacity using the existing fictional venue data; it does not request live data. The result count is announced to screen readers without a visible count label, and All restores the full list. Selecting a range closes the menu and returns focus to Filter; a selected range highlights the control. JavaScript is required for filtering; without it all cards remain accessible and the select is disabled. Run the focused filter tests with node --test docs/design/mobile-brand-kit/occupancy-filter.test.ts.