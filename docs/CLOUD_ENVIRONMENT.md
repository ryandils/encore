# encore cloud env

This is the reproducible configuration for the proposed saved Codex Cloud environment. The repository bootstrap is tested independently from saved-environment creation. No saved environment is claimed by this document.

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

Review/save/publish the environment through Codex settings after the setup succeeds. Then select the saved environment for future Encore tasks. This bootstrap does not create, rename, share, or publish an environment through an API. Conomos needs his own authorized access to the repository and saved environment; access/sharing depends on the account/workspace configuration. Each task should have its own checkout, not a shared live working directory.

## First task

Read AGENTS.md, docs/CONTEXT.md, and the task issue. Inspect GitHub ownership and merged prerequisites before taking a Ready task; B0.3 (#6) requires B0.2 (#5) to merge first. A new task should start from the current branch/commit, not a stale chat or cached uncommitted files.

Run `corepack pnpm run dev` to start the setup landing page, or `corepack pnpm run build` followed by `corepack pnpm run start` to serve an optimized local build. Neither requires database credentials.

For database implementation or integration checks, the cloud runtime additionally needs a running local Docker daemon, Docker Compose, access to the pinned PostgreSQL image registry, and free loopback port `54329`. The wrapper requires a local Unix socket (including rootless Docker) or Windows named pipe; remote/TCP Docker endpoints are rejected. Follow [local database setup](LOCAL_DATABASE.md): `db:init`, `db:up`, `db:generate`, `db:migrate`, `db:seed`, and `db:verify`. Use only the example's disposable local credentials. A cloud checkout may be discarded; its Docker volume is not durable hosting or a backup. If Docker is unavailable, report the missing database evidence; ordinary harness success does not replace it. Authentication and deployment are not implemented. The saved environment is a development tool, not production hosting.
