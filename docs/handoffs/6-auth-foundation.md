# #6 — Local authentication foundation

## Task

[Issue #6 — B0.3 authentication and demo roles](https://github.com/ryandils/encore/issues/6). This change builds on merged B0.2 database storage. It does not claim a merge, issue closure, deployment, or B4 authorization completion.

## Outcome

Contributors can sign in as a clearly labeled synthetic owner or staff account, visit the corresponding protected local demo page, refresh a real server session, and sign out. After database setup, run `pnpm run auth:init`, `pnpm run auth:seed`, and `pnpm run dev`; open `/demo/sign-in` and read the matching generated password locally from ignored `.env`.

The demo records no admissions or cash. Authentication and demo routes are unavailable in production, including `pnpm run start`.

## Changes

- Pin Better Auth 1.7.20 and integrate its Prisma adapter with account/session/verification storage alongside existing identity fixtures. Its `bun:sqlite` public type reference is resolved through pinned `bun-types` 1.4.4 with only `bun-types/sqlite` included; Node remains the runtime and `skipLibCheck` stays false. pnpm generated exact-version release-age exceptions for the Better Auth 1.7.20 package family, with no blanket policy relaxation.
- Keep authentication construction lazy, require explicit loopback/database configuration and a generated secret, and reject production mode before database access. A shared pure database-target validator serves CLI and web code without bundling CLI filesystem/process helpers into Next.js.
- Preserve library password hashing, origin/CSRF protections and rate limiting; disable public signup and session cookie caching.
- Add local setup and idempotent credential seeding while keeping the existing database seed password-free. Existing credentials are preserved; conflicts are reported rather than silently rotated.
- Add protected synthetic owner/staff pages, sign-in/sign-out states, server-derived demo role navigation, and separate HTTP/PostgreSQL verification. Fixture roles do not grant venue membership or night assignments.

## Verification

The lead reported the pre-change `corepack pnpm run cloud:setup` baseline passed on Linux with Node 24.22.1, pnpm 12.18.0, and TypeScript 7.0.2. That result verifies the starting checkout only.

Implementation evidence reported by the lead on Linux:

- `corepack pnpm run typecheck`: passed strict TypeScript 7 checking with library checking retained.
- `corepack pnpm run lint`: passed for 33 files.
- `corepack pnpm run test`: all 94 tests passed, including 31 authentication tests and the prior 63 tests.
- `corepack pnpm run build`: optimized Next.js build passed.
- `db:migrate`, `db:seed`, `auth:init`, and `auth:seed`: passed against healthy local PostgreSQL.
- `corepack pnpm run auth:verify`: passed real HTTP/PostgreSQL checks for stable credential seeding, persisted sessions/cookies, both roles and protected navigation, ignored role spoofing, absent/forged/expired/revoked sessions, wrong passwords, disabled signup, origin enforcement, and sign-out. The verifier respects the enabled library rate limiter through bounded `X-Retry-After` waits.
- Production HTTP smoke: the public landing page returned 200; demo sign-in/owner/staff pages, demo session endpoint, auth session GET, and auth sign-in/sign-out POST returned 404 with deliberately invalid database/auth configuration, confirming the early production guard.
- `corepack pnpm run db:verify`: migrations, two seeds, exact preservation of both existing synthetic users, and PostgreSQL restart persistence passed. No reset was performed.
- System Chromium browser verification passed at 390px for owner and 320px for staff: incorrect-password feedback, real sign-in, refresh persistence, sign-out, anonymous protected-route redirect, keyboard focus, controls at least 44px, no horizontal overflow, and no page exceptions. Screenshots were visually inspected. The browser download CDN returned 403; the available system Chromium supplied the completed browser evidence.
- The generated signing secret and both demo passwords were absent from all 11 client JavaScript files inspected.
- Independent review reported no remaining substantive findings. The identified Unix file-permission issue is fixed: initialization explicitly sets existing `.env` permissions to `0600` before appending generated secrets.

Final `corepack pnpm run cloud:setup` passed frozen installation, doctor, compiler version, strict typecheck, repository check, and both context regression tests. Staged `corepack pnpm run context:check --base origin/main` and whitespace checks passed. Hosted CI remains pending. No native Windows/macOS Docker walkthrough is claimed.

## Context impact

README and QUICKSTART explain how to run the local sign-in demo and read generated credentials privately. LOCAL_DATABASE documents the separate credential setup, repeat behavior, production gate, and limitations. ARCHITECTURE records implemented auth storage/session boundaries separately from planned domain/venue authorization. CONTEXT, BUILD_PLAN, and the AGENTS repository-state paragraph describe the new capability without duplicating live issue status. HARNESS and CLOUD_ENVIRONMENT distinguish database-free checks, HTTP/PostgreSQL verification, development demo startup, and production rejection.

## Learning note

Authentication establishes which account holds a valid session. Authorization decides what that account may do. A synthetic staff label lets this demo select its staff screen; it does not prove the account belongs to a venue or is assigned to tonight's door. Those server-side permission checks remain B4 work.

## Next step

Confirm hosted CI results in the PR, then obtain human review and merge. Any issue closure remains a separate authorized action. After a confirmed merge, recheck ownership and prerequisites for #7's native Windows/macOS setup walkthrough. Real-user verification/recovery, production authentication, and full venue/night authorization remain unimplemented; this is not pilot readiness.
