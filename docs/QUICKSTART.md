# Quick start: Windows and macOS

Goal: Conomos and Ryan can clone the same commit, run the same checks, and submit a small reviewed change. No previous programming experience is required. Budget roughly 30–60 minutes for the first setup, with time for downloads.

**Current milestone: a demo/setup landing page and local database fixtures.** You can run the web preview and contributor checks without Docker or credentials. To migrate and seed PostgreSQL, follow the [local database guide](LOCAL_DATABASE.md), which adds Docker Desktop on Windows/macOS. Authentication and door operations remain later work in [the build plan](BUILD_PLAN.md); no paid service or production key is needed.

## 1. Install the tools

| Tool | Windows | macOS |
| --- | --- | --- |
| Git | Install [Git for Windows](https://git-scm.com/downloads/win); allow Git from the command line | Install [Git](https://git-scm.com/downloads/mac), or run `git --version` and complete Apple's command-line-tools installer if prompted |
| Node.js | Install **24.x LTS** from [Node downloads](https://nodejs.org/en/download); the installer includes npm | Install **24.x LTS** from the same page; existing version-manager users can run `nvm install` in this repo |
| Editor | Install [VS Code](https://code.visualstudio.com/) | Install VS Code, or use your existing editor/Codex app |

Use Node 24.x and pnpm 12.18.0 on both machines; this is the shared supported baseline, not a requirement for the identical patch version. The lockfile controls project dependencies. Do not install a different major simply because a download page labels it "latest."

Close and reopen the terminal after installation.

Windows: open **PowerShell** (no administrator privileges needed for project commands). macOS: open **Terminal**. Run one line at a time:

```text
git --version
node --version
npm --version
```

Expected: Git version output and Node `v24...`. npm is bundled with Node and is used only to install pnpm:

```text
npm install --global pnpm@12.18.0
pnpm --version
```

Expected pnpm: `12.18.0`. If PowerShell blocks npm.ps1 or pnpm.ps1, use `npm.cmd` or `pnpm.cmd` instead; don't disable execution policy. If global installation needs administrator access, skip it and use `corepack pnpm` in place of `pnpm` from the cloned repository root. Corepack reads the exact packageManager pin and does not require enabling global shims. If Corepack is missing too, use the official [pnpm installation instructions](https://pnpm.io/installation) for a user-owned installation.

## 2. Clone the repository

Create a folder called `Projects` in your home folder using Explorer/Finder. Keep the working copy outside OneDrive/iCloud/Dropbox synced folders when possible.

Windows PowerShell:

```powershell
cd "$HOME\Projects"
git clone https://github.com/ryandils/encore.git
cd encore
```

macOS Terminal:

```sh
cd ~/Projects
git clone https://github.com/ryandils/encore.git
cd encore
```

Cloning means making a local working copy that remembers its GitHub source. The repository is public, so reading it needs no token; pushing changes still needs your authorized GitHub account. Do not download a ZIP: it lacks Git history.

Open VS Code → File → Open Folder → select this `encore` folder. Use Terminal → New Terminal for subsequent commands. `code .` is an optional shortcut if the editor's command-line launcher is installed.

## 3. Set your commit identity locally

Replace the sample name/email with your own. Use the exact no-reply address shown in [GitHub email settings](https://github.com/settings/emails) if you want to keep your personal address out of public commit history.

```text
git config user.name "Your Name"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
```

These commands configure this clone, not every project. This identity attributes your commits; it does not log you in to GitHub.

## 4. Run the common baseline

From the `encore` folder:

```text
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run check
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
git status
git rev-parse HEAD
```

- `pnpm install --frozen-lockfile` installs exactly what the lockfile describes, including the app dependencies, TypeScript 7.0.2 compiler, and Node 24 type definitions.
- `doctor` checks Node/pnpm/Git and repository prerequisites. Every required line should say `OK`.
- `check` validates the starter harness and local document links. Look for `PASS harness`.
- `typecheck` verifies the harness and application with strict TypeScript 7. Node 24 runs erasable .ts harness files directly; the app tooling handles React's TSX.
- `lint`, `test`, and `build` check source conventions, exercise the landing page and database-command guards, and create the optimized Next.js build. They do not start PostgreSQL.
- `git status` should show a clean working tree before your first edit.
- `git rev-parse HEAD` prints the commit fingerprint. Send Ryan that fingerprint and your check results to confirm you're on the same baseline. Don't send environment files or tokens.

Run `pnpm run compiler:version` to confirm `Version 7.0.2`. Printing the compiler version alone does not typecheck the application.

To preview the landing page, run `pnpm run dev`, then open [http://localhost:3000](http://localhost:3000). Keep that terminal running while using the page; Ctrl+C stops the server. For the optimized build, run `pnpm run build` and then `pnpm run start` instead. Use one server at a time on port 3000.

Passing these checks does **not** mean the door ledger is implemented or ready for customers. No environment file or account is needed for this setup page.

For database work, continue with [local PostgreSQL setup](LOCAL_DATABASE.md). Its `db:init`, `db:up`, `db:generate`, `db:migrate`, `db:seed`, and `db:verify` commands work the same way in native PowerShell and macOS Terminal. Keep `.env` private and use only the supplied synthetic records in this development database.

## 5. Connect your AI coding tool

Each person uses their own account. No OpenAI API key is required by this repository's harness.

Windows option: use OpenAI's official Codex extension in VS Code, following the current [Codex IDE setup](https://developers.openai.com/codex/ide/). Verify the publisher is OpenAI and sign in through the tool. If your installed version requires WSL, follow its official Windows instructions; don't mix Windows Node/Git with a WSL checkout. WSL would need its own tools and clone. The harness itself supports native PowerShell.

Alternative: use Codex cloud with this repository selected. Authorize GitHub access for your own account. Cloud edits live in that task's checkout; they do not automatically appear in the folder on your laptop. Review/merge the PR, then pull locally. Ryan can use the macOS Codex app with this same repository and AGENTS.md. You do not need identical AI interfaces to use the same workflow.

First prompt (orientation only, no changes):

```text
Read AGENTS.md and docs/HARNESS.md. I'm learning. Explain Encore's first
deliverable, what is actually implemented, and the difference between my
local clone and GitHub. Show the current branch and commit, run the harness
checks if this environment supports them, and explain their results.
Do not edit files or start B0 yet. Never claim a check ran if it did not.
```

## Staying current

Read [current context](CONTEXT.md), then your issue and its linked handoff/PR. Agents follow the [context workflow](WORKFLOW.md) to keep those records current. For code/tooling changes, add and stage a handoff and run `pnpm run context:check --base origin/main`. A documentation-only L0 exercise does not require an additional handoff file.

## 6. Make your first contribution

Follow [the learning path](LEARNING_PATH.md). Start with L0, a small documentation PR; it does not depend on the app scaffold. The goal is to understand a change and its evidence, not to have AI generate a whole application.

## Common problems

| Symptom | Next step |
| --- | --- |
| `git`/`node` not recognized | Reopen the terminal. If still missing, rerun the official installer with command-line/PATH support. |
| pnpm version differs | Use 12.18.0 or run `corepack pnpm` from the repository root. The project pin must match. |
| Command says package.json is missing | Run `pwd` (both shells support it) and `git status`; change into the cloned `encore` folder. |
| PowerShell blocks a .ps1 launcher | Use `npm.cmd` only for bootstrap, then `pnpm.cmd install --frozen-lockfile` and `pnpm.cmd run doctor`. |
| GitHub push denied | Confirm the invitation was accepted as `conomos`, and authenticate Git's browser prompt as that account. Never put a token in the remote URL. |
| Checks don't exist after cloning | This harness PR may not be merged yet; ask Ryan which branch to use. Do not create a second package manifest. |
| Port 3000 has nothing on it | Run `pnpm run dev` from the repository root and leave the terminal open. Check its output for errors or a different port if 3000 was already busy. |
| Git reports conflicts or existing edits | Stop and ask Codex to explain `git status`; preserve those edits. Do not use `reset --hard` as a setup step. |

If stuck, share the command, its error text, OS, and commit fingerprint. Redact secrets and personal paths. Ask for one next diagnostic step rather than reinstalling everything.
