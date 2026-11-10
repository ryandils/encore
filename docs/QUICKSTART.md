# Quick start: Windows and macOS

Goal: Conomos and Ryan can clone the same commit, run the same checks, and submit a small reviewed change. No previous programming experience is required. Budget roughly 30–60 minutes for the first setup, with time for downloads.

**Current milestone: contributor setup, not a running bar app.** There is no app server, database, or web preview yet. B0 in [the build plan](BUILD_PLAN.md) adds those. You do not need Docker, PostgreSQL, API keys, or paid services for this guide.

## 1. Install the tools

| Tool | Windows | macOS |
| --- | --- | --- |
| Git | Install [Git for Windows](https://git-scm.com/downloads/win); allow Git from the command line | Install [Git](https://git-scm.com/downloads/mac), or run `git --version` and complete Apple's command-line-tools installer if prompted |
| Node.js | Install **24.x LTS** from [Node downloads](https://nodejs.org/en/download); the installer includes npm | Install **24.x LTS** from the same page; existing version-manager users can run `nvm install` in this repo |
| Editor | Install [VS Code](https://code.visualstudio.com/) | Install VS Code, or use your existing editor/Codex app |

Use Node 24.x and npm 11.x on both machines; this is the shared supported baseline, not a requirement for the identical patch version. The lockfile controls project dependencies. Do not install a different major simply because a download page labels it "latest."

Close and reopen the terminal after installation.

Windows: open **PowerShell** (no administrator privileges needed for project commands). macOS: open **Terminal**. Run one line at a time:

```text
git --version
node --version
npm --version
```

Expected: Git version output, Node `v24...`, npm `11...`. If PowerShell says `npm.ps1 cannot be loaded`, use `npm.cmd` instead of `npm` throughout this guide. Do not disable your machine's execution policy.

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
npm ci
npm run doctor
npm run check
git status
git rev-parse HEAD
```

- `npm ci` installs exactly what the lockfile describes; the harness currently has no third-party dependencies.
- `doctor` checks Node/npm/Git and repository prerequisites. Every required line should say `OK`.
- `check` validates the starter harness and local document links. Look for `PASS harness`.
- `git status` should show a clean working tree before your first edit.
- `git rev-parse HEAD` prints the commit fingerprint. Send Ryan that fingerprint and your check results to confirm you're on the same baseline. Don't send environment files or tokens.

Passing these checks does **not** mean Encore is implemented or ready for customers.

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

## 6. Make your first contribution

Follow [the learning path](LEARNING_PATH.md). Start with L0, a small documentation PR; it does not depend on the app scaffold. The goal is to understand a change and its evidence, not to have AI generate a whole application.

## Common problems

| Symptom | Next step |
| --- | --- |
| `git`/`node` not recognized | Reopen the terminal. If still missing, rerun the official installer with command-line/PATH support. |
| npm has the wrong major | Check `node --version`; install Node 24 with its bundled npm. Avoid stacking multiple installers. |
| Command says package.json is missing | Run `pwd` (both shells support it) and `git status`; change into the cloned `encore` folder. |
| npm.ps1 is blocked | Use `npm.cmd ci`, `npm.cmd run doctor`, and `npm.cmd run check`. |
| GitHub push denied | Confirm the invitation was accepted as `conomos`, and authenticate Git's browser prompt as that account. Never put a token in the remote URL. |
| Checks don't exist after cloning | This harness PR may not be merged yet; ask Ryan which branch to use. Do not create a second package manifest. |
| Port 3000 has nothing on it | Expected at this milestone; there is no app dev server yet. |
| Git reports conflicts or existing edits | Stop and ask Codex to explain `git status`; preserve those edits. Do not use `reset --hard` as a setup step. |

If stuck, share the command, its error text, OS, and commit fingerprint. Redact secrets and personal paths. Ask for one next diagnostic step rather than reinstalling everything.
