# Local PostgreSQL and synthetic identities

This setup is for disposable development data on your own machine. It supplies PostgreSQL, versioned Prisma migrations, two labeled synthetic identities, and optional local sign-in through Better Auth. B1 adds domain tables and constraints; it does not implement venue/night permissions or live ledger endpoints. The public setup landing page still runs without a database or environment file.

## Install Docker on Windows or macOS

Complete the Node 24/pnpm 12.18.0 [quick start](QUICKSTART.md) first. Use [common demo baseline verification](BASELINE_VERIFICATION.md) to rehearse the complete setup and record separate native Windows/macOS results.

| Platform | Setup |
| --- | --- |
| Windows | Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Follow its supported Windows/WSL 2 prerequisites and restart if its installer requests it. Start Docker Desktop and use Linux containers. Run Encore commands from native PowerShell in your existing clone; Docker's WSL backend does not require moving Node or the repository into WSL. |
| macOS | Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) for your Apple silicon or Intel processor. Open Docker Desktop and wait until its engine is running, then use Terminal in the repository root. |

Docker Desktop includes the Docker Compose plugin. In either terminal, run:

```text
docker version
docker compose version
pnpm run doctor
```

`docker version` must show a working server as well as a client. Doctor checks the contributor baseline; it does not establish database connectivity. You do not need a separate PostgreSQL installer, a cloud database account, production credentials, or an email provider.

Use your local Docker Desktop context (or a local rootless Docker socket in a Linux/cloud checkout). The wrapper requires a local Unix socket or Windows named-pipe endpoint, pins that endpoint for Compose, and rejects remote/TCP Docker endpoints. This prevents a remote Docker context from redirecting startup, restart, or shutdown to another machine.

Installation/client generation needs access to the npm registry and `binaries.prisma.sh` for Prisma engines and their checksums. Starting PostgreSQL also needs access to the container image registry on first use. If a corporate proxy or cloud allowlist blocks one of these hosts, correct that network setting; do not bypass engine checksum verification.

## Create, migrate, and seed

From the repository root, run one line at a time on either operating system:

```text
pnpm install --frozen-lockfile
pnpm run db:init
pnpm run db:up
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run db:seed
pnpm run db:verify
```

Use `corepack pnpm` in place of `pnpm` if that is how you installed the pinned manager. If PowerShell blocks a `.ps1` launcher, use `pnpm.cmd`; do not disable execution policy.

What each command does:

| Command | Behavior |
| --- | --- |
| `db:init` | Creates ignored `.env` from `.env.example` without overwriting an existing file. |
| `db:up` | Starts the Compose `db` service and waits for PostgreSQL to become healthy. The first run downloads its pinned image. |
| `db:generate` | Generates the Prisma client from the checked-in schema; it does not connect to PostgreSQL. |
| `db:migrate` | Applies checked-in migrations using Prisma migrate deploy. Running it again does not recreate the schema. |
| `db:seed` | Inserts the two predictable synthetic identities transactionally, leaving existing fixtures unchanged. Repeated runs preserve their IDs and creation timestamps and do not add duplicates. Conflicting reserved IDs/emails fail instead of overwriting records. |
| `db:verify` | Exercises migration/seeding and checks that the same identities survive another seed and a PostgreSQL restart. It requires Docker and temporarily interrupts this local database. |
| `db:status` | Shows the local database service status. |
| `db:down` | Stops/removes the service container while keeping its persistent named volume. |

The checked-in Compose configuration pins PostgreSQL 17.7 Alpine by image digest. It and `.env.example` agree on this dedicated target:

| Setting | Local value |
| --- | --- |
| Compose project / service | `encore-local` / `db` |
| Host / published port | `127.0.0.1:54329` |
| Database / user | `encore_local` / `encore_local` |
| Schema | `public` |
| Password placeholder | `encore_local_only` |

The password is a public, disposable local placeholder, not a secret or a production credential. Leave the example values unchanged for this setup. Do not reuse them elsewhere or expose the service on a network interface. `.env` is ignored by Git; never paste it into a PR, screenshot, or issue. Commands load `.env`, while an already-set process environment value takes precedence. If a terminal contains an old `DATABASE_URL`, remove that override before following this guide.

`db:seed` uses reserved `.invalid` email addresses and visible synthetic labels. It creates no password, session, or verified email. `DemoIdentity.role` describes a fixture; it grants no venue membership or staff assignment. There are no customer records or outbound messages.

## Verify B1 domain storage

After `db:up` and `db:migrate`, run:

```text
pnpm run ledger:verify
```

This separate integration command uses the same guarded local database URL. It does not migrate, seed, restart, or reset the database. It creates uniquely named synthetic records inside one transaction, checks actual PostgreSQL constraint failures with savepoints, then rolls back its writes and checks cleanup. It also rolls back on a failed assertion. Existing authentication users, sessions, and fixtures are preserved.

The checks cover membership/preset uniqueness, one open night per venue, tenant/night relations, event sequence/request/reversal uniqueness, event shapes and money ranges, original admission prices after preset changes, restricted deletion of referenced audit data, and reconciliation arithmetic. Raw database errors are withheld because they can contain record or credential data.

The domain migration creates empty venue/night/ledger tables; the identity and credential seeds still create only the existing synthetic authentication fixtures. `createLedgerFixtures()` supplies in-memory B2/B3 examples, not database records or access grants. Schema constraints alone do not implement command authorization. The local server kernel and HTTP services now enforce membership/assignment, transactional retries and occupancy rules; physical two-device and production behavior remain unverified. Pure ledger replay and contract cases run separately with `pnpm run test`.

## Set up local demo sign-in

After migrating and seeding the database, run:

```text
pnpm run auth:init
pnpm run auth:seed
pnpm run dev
```

`auth:init` requires the existing local `.env`. It appends only absent authentication settings: `BETTER_AUTH_URL` defaults to `http://localhost:3000`, `BETTER_AUTH_SECRET` is randomly generated, and separate random passwords are generated as `DEMO_OWNER_PASSWORD` and `DEMO_STAFF_PASSWORD`. Existing settings are validated and preserved. On Unix, the file is restricted to owner read/write permissions before secrets are appended. Values are never printed. Keep this ignored file private; open it locally in your editor to read the passwords.

`auth:seed` uses the maintained library's password hashing and creates credential accounts for the two synthetic identities. Running it again preserves existing hashes and timestamps. Conflicting identities, accounts, or passwords fail instead of overwriting existing records. Editing a password in `.env` does not rotate a stored password; preserve the existing local values. After an intentionally authorized disposable database reset, run `db:seed` and `auth:seed` again to recreate the accounts.

Open [http://localhost:3000/demo/sign-in](http://localhost:3000/demo/sign-in):

| Synthetic email | Password setting in your local `.env` |
| --- | --- |
| `owner@encore-demo.invalid` | `DEMO_OWNER_PASSWORD` |
| `staff@encore-demo.invalid` | `DEMO_STAFF_PASSWORD` |

Successful login creates a database-backed session and opens the matching protected demo page. Refresh retains the session; sign-out invalidates it. The server derives the demo role from the authenticated fixture. The pages do not grant real venue access or record admissions/cash. Public signup is unavailable.

Use the exact origin configured in `BETTER_AUTH_URL`; `localhost` and `127.0.0.1` are different browser origins. If port 3000 is occupied, stop the other server or configure a matching explicit HTTP loopback origin and development-server port. Restart the server after changing authentication settings.

All authentication and demo routes reject `NODE_ENV=production`, including an optimized `pnpm run start` server. Use `pnpm run dev` for this local demo. Production authentication, real-user email verification and password recovery, provider configuration and production venue/night access remain unimplemented; local API authorization is separately enforced. No email is sent by these commands.

With the local database and demo credentials ready, stop any `pnpm run dev` server in this checkout with Ctrl+C, then run `pnpm run auth:verify` for separate HTTP/PostgreSQL regression checks. It starts its own development server, exercises sessions and rejection cases, and stops that test server afterward. Ordinary `pnpm run test` remains database-free. Native Windows/macOS Docker walkthroughs must be recorded separately from hosted application CI.

## Stop and resume without losing data

```text
pnpm run db:down
pnpm run db:up
pnpm run db:verify
```

The named volume persists independently of the container. Stopping PostgreSQL or restarting Docker Desktop does not intentionally erase it. Removing the volume through Docker Desktop or a raw Docker command does erase it; those actions are not ordinary shutdown steps. A local Docker volume is not a backup or a production persistence plan.

## Explicit local reset

Reset drops the database schema and all data in it, then reapplies the checked-in migrations. Run it only when you intend to discard this development database:

```text
pnpm run db:reset --confirm-local-reset
pnpm run db:seed
pnpm run db:verify
```

If you use the synthetic sign-in demo, run `pnpm run auth:seed` afterward as well, retaining your existing ignored `.env`. The identity seed alone does not recreate credential accounts. No reset is needed for the ordinary baseline rehearsal.

Without `--confirm-local-reset`, reset fails before doing the destructive work. Database commands reject `NODE_ENV=production`, remote hosts, a different database/user/port, and connection options that could redirect the target or schema. The accepted URL uses a loopback hostname, port `54329`, database/user `encore_local`, and only the supported `public` schema setting.

These checks prevent common configuration mistakes; a loopback address cannot prove where a manually configured tunnel forwards traffic. Do not tunnel a production or shared database onto this address, and do not point this local workflow at valuable data. Direct Prisma, SQL, and Docker commands can bypass the wrapper guards; use the documented commands for routine setup and reset.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Docker is missing or its daemon cannot be reached | Install/start Docker Desktop, wait for the engine, and retry `docker version`. A client-only result is insufficient. |
| Compose is unavailable | Use a current Docker Desktop with the Compose plugin; verify `docker compose version`. |
| A remote/TCP Docker endpoint is rejected | Select your local Docker Desktop/rootless context and remove stale remote Docker overrides. This workflow supports local Unix sockets and Windows named pipes, not TCP/remote Docker hosts. |
| Prisma generation fails with a proxy/HTTP 403 or engine-download error | Allow `binaries.prisma.sh` and its checksum downloads in your proxy/cloud network settings, then retry installation or `db:generate`. A successful npm install alone does not prove engine downloads work; keep checksum verification enabled. |
| Port `54329` is already in use | Stop your other local process/container using that port, then retry `db:up`. Keep the fixed port and guard configuration aligned rather than editing only the URL. |
| Missing or invalid `DATABASE_URL` | Run `db:init`. If `.env` already exists, compare it locally with `.env.example` and remove stale terminal overrides. Do not print or share a real connection string. |
| A guard rejects the environment or target | Use the documented local values in a development terminal. Do not weaken the guard or replace its URL with production credentials. |
| PostgreSQL is unavailable | Run `db:up`, then `db:status`. Wait for its healthcheck before migration or seed; check whether Docker Desktop stopped. |
| PostgreSQL authentication fails | Check the local-only `.env` values against the example. PostgreSQL initializes credentials only when its volume is first created; editing credentials does not update an existing volume. Preserve any needed local data before deliberately rebuilding it. |
| Demo sign-in is unavailable or fails | Confirm `auth:init` and `auth:seed` completed, use the matching email/password from ignored `.env`, and open the configured origin through `pnpm run dev`. Production servers deliberately reject demo access. Never share a password or session cookie to diagnose this. |
| A table is missing or seed fails before initialization | Run `db:generate`, then `db:migrate`, then `db:seed`. Generation creates client code; migration creates database tables. |
| A migration fails | Check service health and the current branch, then inspect the checked-in migration. The wrapper withholds raw child-process output because it can include credentials; share only its safe failure summary. Do not mark a failed migration applied or delete shared migration history to hide the failure. |
| Reset is refused | Supply the explicit acknowledgement only if this is the dedicated disposable local database. Other target/environment refusals must be corrected, not bypassed. |
| Seed/verification detects unexpected data | Preserve the database and inspect the discrepancy before resetting. Seed verification is not permission to delete unrelated records. |

Report the command, operating system, commit, and safe error text. Redact connection strings, passwords, and personal paths. `db:verify` establishes the tested local persistence behavior; it does not validate authentication, permissions, two-device ledger behavior, or readiness for a real venue.

## Internal B4 kernel verification

After `db:up` and `db:migrate`, run `pnpm run ledger:service:verify`. It uses the existing local-only connection guard, creates unique synthetic venue/night/users, exercises real concurrent transactions, then deletes only those records in foreign-key order. It does not reset your database or seed a live venue. A failed connection or process interruption can leave synthetic verification records; use a disposable development database. This checks the internal service, not HTTP sessions, production auth or two-device operation.
