# H3 — pnpm baseline and cloud checkout bootstrap

## Task

[Issue #18](https://github.com/ryandils/encore/issues/18). The user requested the package-manager migration and a saved Encore cloud environment.

## Outcome

Use pnpm 12.18.0 with Node 24 and TypeScript 7.0.2. Run `corepack pnpm run cloud:setup` from the repository root to install the frozen lockfile and verify a cloud checkout. It does not create or publish a saved environment.

## Changes

Replaced package-lock.json with pnpm-lock.yaml, pinned the manager in package.json, and updated doctor/checks, live documentation, and CI. CI exercises the same cloud bootstrap on Linux, Windows and macOS. Bootstrap supports both native and Node-based pnpm entry points without shell-specific invocation.

## Verification

Locally on Linux, pnpm frozen install, doctor, compiler version (7.0.2), strict typecheck, harness check and context regression tests passed through the cloud bootstrap. A temporary manifest mismatch was rejected by frozen install, and doctor rejected an npm user-agent. The manifest was restored. Context check against origin/main and staged whitespace checks passed after adding this handoff. Supported-OS validation belongs to the PR's CI evidence.

## Context impact

Updated AGENTS.md, the context-upkeep skill, prompts, README, quickstart, architecture command references, build plan, workflow, learning path, and CONTEXT.md for pnpm. Added CLOUD_ENVIRONMENT.md with the exact proposed name, runtime/repo settings and bootstrap command. Historical handoffs remain unchanged as evidence of their own changes. Product behavior and database/API contracts are unchanged.

## Learning note

The exact package-manager version and frozen lockfile make installations repeatable. pnpm's dependency store can reuse downloads, while the environment name is only a saved configuration label. A passing bootstrap is different from a created/shared saved environment.

## Next step

Review the PR and use the updated baseline for B0.1 (#4). The current tool catalog cannot create/publish a saved Codex environment and browser control failed to initialize with a sandbox error. Creating **encore cloud env** in settings and confirming publication/access is still pending; it must not be reported as complete. No production secrets or database are required at this milestone.
