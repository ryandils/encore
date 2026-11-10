# H2 — strict TypeScript 7 throughout authored source

## Task

[Issue #16](https://github.com/ryandils/encore/issues/16). PR #15 is confirmed merged; this separate change converts the executable harness.

## Outcome

All authored scripts and tests now use .ts and are checked by TypeScript 7.0.2. Run `npm ci`, `npm run typecheck`, `npm run check`, and `npm run context:test`. Existing command names are preserved.

## Changes

Converted all four .mjs files to typed .ts files; Node 24 runs erasable TypeScript directly. Added strict tsconfig.harness.json, pinned Node 24 type definitions, and CI typechecking. The harness rejects authored .js/.jsx/.mjs/.cjs files outside dependencies and generated-output folders. No application scaffold was built.

## Verification

On Linux, clean `npm ci --ignore-scripts`, doctor, compiler:version (7.0.2), typecheck, check, context:test, context:check against origin/main, and staged whitespace checks passed. The existing Git-diff regression tests pass unchanged in behavior. Temporary probes confirmed a JavaScript source is rejected and an incompatible TypeScript assignment fails typechecking; probes were removed.

Cross-platform execution is delegated to this PR's CI; do not infer a Windows interactive walkthrough from a CI pass. The new context handoff is staged with the code so the gate can find it.

## Context impact

Updated AGENTS.md, architecture, README, quickstart, harness, build plan, and CONTEXT.md for TypeScript-only authored source and strict harness checking. Historical handoffs remain evidence of their original changes. No product behavior or API contract changed, so MVP.md is unchanged.

## Learning note

Running a .ts file on Node 24 strips type annotations; it does not verify the types. The separate pinned TypeScript 7 compiler command is what catches type errors before execution. Compiled output and third-party packages may still contain JavaScript.

## Next step

Merge this PR after supported-OS CI passes, as authorized by the user. Update #16 to Done only after confirmation. B0.1 (#4) remains the next product task and must preserve the typed harness while adding application typecheck coverage; Conomos's independent L0 issue remains available.
