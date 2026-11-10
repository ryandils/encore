# encore cloud env

The saved Codex Cloud environment **encore cloud env** was listed as ready and runnable for `ryandils/encore` on `main` on November 10, 2026. That observation confirms the saved configuration was available then; it does not prove a new chat has started or its runtime checks have passed. Recheck availability when launching. The repository bootstrap is verified separately in each checkout.

## Configuration

| Setting | Value |
| --- | --- |
| Name | encore cloud env |
| Repository | ryandils/encore |
| Branch | main |
| Runtime | Node 24.x |
| Package manager | pnpm 12.18.0, pinned in package.json |
| Compiler | TypeScript 7.0.2, installed from pnpm-lock.yaml |
| Secrets / outbound email / production services | None for the harness and setup landing page |

Select the repository and Node 24 in Codex's saved-environment setup. Run the setup command **from its checked-out repository root**:

```sh
corepack pnpm run cloud:setup
```

Corepack reads packageManager and obtains the pinned pnpm version without requiring global pnpm shims. If Corepack is absent, use a Node image that provides it, or install the pinned manager with `npm install --global pnpm@12.18.0` and run `pnpm run cloud:setup` instead. npm is only a bootstrap option, not the project's dependency manager.

The command performs a frozen install and runs doctor, compiler version, strict typechecking, repository checks and context-gate regression tests. It stops on failures. It does not need production secrets or send messages. Enable network access for GitHub checkout, registry.npmjs.org (including redirected package downloads), and any required runtime download host used by the selected image. The package manifest is the source of truth for the manager pin.

Select the saved environment for Encore tasks. Changes to its saved configuration or publication are separate authorized settings operations; this bootstrap does not create, rename, share, or publish an environment. Conomos needs his own authorized access to the repository and saved environment; access/sharing depends on the account/workspace configuration. Each cloud chat must have its own isolated checkout.

## Launch parallel chats

1. Open a new Codex chat, select `ryandils/encore`, choose **encore cloud env**, and start from current `main`.
2. Copy [the cloud orchestrator prompt](../.codex/prompts/cloud-orchestrator.md). Fill in one existing issue and either `implement` or `read-only investigation` mode.
3. Give that chat one independent scope. Its lead orchestrator coordinates multiple parallel subagents inside its checkout; agents in that chat share files and Git state.
4. Repeat in a separate cloud chat for another independent scope. Verify each chat has its own checkout. Use GitHub claims and PRs to coordinate across chats, following [the workflow](WORKFLOW.md); local isolation does not remove dependency or contract conflicts.

The prompt is a reusable manual launch recipe. It does not install a scheduler, start chats, or grant cross-chat messaging access. If the current Codex interface exposes authorized chat-creation or messaging tools, an orchestrator may use them only within the user's explicit instructions and must report observed results. If those tools are unavailable, launch through the interface; do not report chats as created or coordinated without evidence.

An illustrative launch set is:

| Chat scope | Mode | Boundary |
| --- | --- | --- |
| [B0.2 local database and seed, #5](https://github.com/ryandils/encore/issues/5) | `implement` | Only after a fresh GitHub check confirms merged prerequisites and no active claim or overlapping PR. |
| [B0.3 authentication and demo roles, #6](https://github.com/ryandils/encore/issues/6) | `read-only investigation` | Inspect authentication dependencies and acceptance; do not implement before #5 merges. |
| [B1 contracts and ledger, #8](https://github.com/ryandils/encore/issues/8) | `read-only investigation` | Examine acceptance and proposed contracts; do not edit canonical contracts or schemas before B0 merges. |

These examples assign distinct modes, not live issue statuses or standing claims. Check GitHub each time. An investigation returns findings and a proposed plan in its chat; it cannot silently become implementation when a dependency changes. No cloud chats are launched merely by adding or reading this guide.

## First task

Read AGENTS.md, docs/CONTEXT.md, and the task issue. Inspect GitHub ownership and merged prerequisites before taking a Ready task; B0.2 (#5) requires B0.1 (#4) to merge first. A new task should start from the current branch/commit, not a stale chat or cached uncommitted files.

Run `corepack pnpm run dev` to start the setup landing page, or `corepack pnpm run build` followed by `corepack pnpm run start` to serve an optimized local build. Add PostgreSQL during B0.2 when the local/database setup is defined. There is no database, auth provider, or deployment yet. The saved environment is a development tool, not production hosting.
