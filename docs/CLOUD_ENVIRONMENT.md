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

The command performs a frozen install and runs doctor, compiler version, strict typechecking (including Prisma client generation), repository checks and context-gate regression tests. It stops on failures. It does not start PostgreSQL, need production secrets, or send messages. Enable network access for GitHub checkout, registry.npmjs.org (including redirected package downloads), `binaries.prisma.sh` for Prisma engines and their checksums, and any required runtime download host used by the selected image. A successful package download does not prove that the separate Prisma engine host is reachable. The package manifest is the source of truth for the manager pin; `pnpm-workspace.yaml` narrowly allows the Prisma and Prisma-engine dependency build scripts.

Select the saved environment for Encore tasks. Changes to its saved configuration or publication are separate authorized settings operations; this bootstrap does not create, rename, share, or publish an environment. Conomos needs his own authorized access to the repository and saved environment; access/sharing depends on the account/workspace configuration. Each cloud chat must have its own isolated checkout.

## Use Encore skills

Send a short request in the current Encore chat:

| Request | Result |
| --- | --- |
| `$encore-issues` | [Read-only inventory](../.agents/skills/encore-issues/SKILL.md) of all open and closed issues; add `open only` to narrow it. |
| `$encore-prioritize` | [Read-only ranked opinion](../.agents/skills/encore-prioritize/SKILL.md) based on current readiness, ownership, dependencies, and implementation evidence. |
| `$encore-orchestrator implement #5` | [Orchestrated implementation](../.agents/skills/encore-orchestrator/SKILL.md), only if a fresh check confirms the issue is ready and unclaimed. |
| `$encore-orchestrator investigate #6` | Parallel read-only investigation of that issue; no claim or implementation. |

Plain-language fallbacks include `Use encore-issues to list all issues`, `Use encore-prioritize to recommend what to work on next`, and `Use encore-orchestrator to implement #5`. AGENTS.md routes requests even when automatic discovery is unavailable. Listing or asking for an opinion remains read-only; it does not authorize the action workflow. Issue numbers are examples, not standing recommendations or claims.

Skills are available in checkouts containing their `.agents/skills` files. Update from `main` after the change merges to use them in another checkout. No global installation or skill-picker behavior has been verified. The [old orchestrator prompt location](../.codex/prompts/cloud-orchestrator.md) remains a short compatibility entry.

## Optional parallel chats

For separate independent scopes, explicitly open another Codex chat, select `ryandils/encore` and **encore cloud env**, and use the skill from a checkout containing it. After this change merges, use current `main`. Verify each chat has its own isolated checkout. Each lead coordinates parallel subagents inside that chat's shared checkout; use [the workflow](WORKFLOW.md) for GitHub claims and dependency boundaries.

The skill does not start chats, install a scheduler, or grant cross-chat messaging access. If the interface exposes chat-creation or messaging tools, an orchestrator may use them only within explicit user instructions and must report observed results. If unavailable, launch through the interface; do not claim unobserved creation or coordination.

An illustrative launch set is:

| Scope | Skill request | Boundary |
| --- | --- | --- |
| [B0.2 local database and seed, #5](https://github.com/ryandils/encore/issues/5) | `$encore-orchestrator implement #5` | Only after a fresh GitHub check confirms merged prerequisites and no active claim or overlapping PR. |
| [B0.3 authentication and demo roles, #6](https://github.com/ryandils/encore/issues/6) | `$encore-orchestrator investigate #6` | Read-only acceptance/dependency investigation; do not implement before #5 merges. |
| [B1 contracts and ledger, #8](https://github.com/ryandils/encore/issues/8) | `$encore-orchestrator investigate #8` | Read-only contract/acceptance investigation; do not edit canonical contracts or schemas before B0 merges. |

These examples assign distinct modes, not live issue statuses or standing claims. Check GitHub each time. An investigation returns findings and a proposed plan in its chat; it cannot silently become implementation when a dependency changes. No cloud chats are launched merely by adding or reading this guide.

## First task

Read AGENTS.md, docs/CONTEXT.md, and the task issue. Inspect GitHub ownership and merged prerequisites before taking a Ready task; B0.3 (#6) requires B0.2 (#5) to merge first. A new task should start from the current branch/commit, not a stale chat or cached uncommitted files.

Run `corepack pnpm run dev` to start the setup landing page, or `corepack pnpm run build` followed by `corepack pnpm run start` to serve an optimized local build. Neither requires database credentials.

For database implementation or integration checks, the cloud runtime additionally needs a running local Docker daemon, Docker Compose, access to the pinned PostgreSQL image registry, and free loopback port `54329`. The wrapper requires a local Unix socket (including rootless Docker) or Windows named pipe; remote/TCP Docker endpoints are rejected. Follow [local database setup](LOCAL_DATABASE.md): `db:init`, `db:up`, `db:generate`, `db:migrate`, `db:seed`, and `db:verify`. Use only the example's disposable local credentials. A cloud checkout may be discarded; its Docker volume is not durable hosting or a backup. If Docker is unavailable, report the missing database evidence; ordinary harness success does not replace it. For synthetic local sign-in, follow database setup with `auth:init`, `auth:seed`, and `pnpm run dev`. Generated secrets/passwords stay in ignored `.env` and are never printed. `auth:verify` runs separate HTTP/PostgreSQL session checks. All auth/demo routes reject production mode, including `pnpm run start`; real-user verification/recovery and production authentication remain unimplemented. The saved environment is a development tool, not production hosting.
