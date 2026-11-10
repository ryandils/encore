# Learn by shipping small changes

Use this with Conomos, Mike, or anyone new to Git and AI coding. Suggested exercises are not assigned tasks. Treat mistakes as things to inspect together; success means you can explain and verify a change.

## L0 — First reviewed PR (available now)

Deliverable: a short, public-safe note at `docs/learning/conomos-first-deliverable.md` explaining one Encore workflow.

Acceptance criteria:

- Describe paid admission, free admission, and exit in your own words.
- Give the expected occupancy and cover for four $10 entries and one exit: 3 people and $40.
- Name one thing the MVP does not do, and one question you'd ask a door operator.
- No personal details or actual venue data. `npm run doctor` and `npm run check` pass.
- Conomos can explain branch, commit, push, and PR to Ryan using this change as the example.

Start from a clean checkout. If `git status` shows unfinished work, do not run the branch-changing steps until you understand it.

```text
git switch main
git pull --ff-only
git switch -c docs/conomos-first-deliverable
```

Ask Codex to explain the exercise and help draft the file; read it and edit at least one sentence yourself. Use the editor to create missing directories. Then:

```text
npm run doctor
npm run check
git status
git diff
git add docs/learning/conomos-first-deliverable.md
git diff --staged
git commit -m "docs: explain the Encore door workflow"
git push -u origin docs/conomos-first-deliverable
```

`git diff` doesn't show new untracked file contents; open the new file in your editor, and inspect `git diff --staged` after staging. Stop before committing if that staged diff includes something unexpected.

The first push may open a GitHub sign-in window. Use your own account; no token belongs in chat. In GitHub, open Encore → Pull requests → New pull request. Base: `main`; compare: `docs/conomos-first-deliverable`. Fill in the PR template and ask Ryan to review. The public clone alone doesn't grant push permission; the invitation must be accepted.

If you use Codex cloud for this task, let that task manage its own branch/PR instead of creating a second copy locally. Check the actual PR diff yourself.

After Ryan merges, return to your local clone:

```text
git switch main
git pull --ff-only
npm ci
npm run check
```

Don't delete the learning branch until its PR is merged. If a pull fails, inspect why; don't use a force/reset shortcut.

## L1 — Define an implementable task (available now)

Use the [task template](tasks/TEMPLATE.md) to propose one small slice of B2: a labeled paid-entry control against synthetic fixtures. Include starting state, action, result, error state, and how you would test it. No application implementation until B0/B1 are ready. Ryan reviews the boundaries before someone claims the implementation.

Learning: "build the door app" is too broad; "one $10 tap produces one $10 admission and shows failure if it isn't saved" is observable.

## L2 — Implement and verify one slice (after B0/B1)

Take the approved B2 slice with shared types and fixtures. Ask Codex to name affected files and explain the data flow. Read the diff and run the exact app checks B0 introduced. Show the narrow-phone result, including failed save state, to Ryan. Clearly label fixtures; don't claim the shared backend works until B4.

Learning: UI state, backend persistence, and test evidence are different things.

## L3 — Debug a real failure

Use a failing check or bug you actually encountered. Ask the agent to explain the error, offer one hypothesis, and run the smallest diagnostic before changing code. Don't invent a production outage or disable a check to get green.

Learning: a helpful AI suggestion still needs evidence.

## Vocabulary for the first session

| Word | Meaning here |
| --- | --- |
| Repository | Project files plus their recorded history |
| Clone | Your local copy linked to GitHub |
| Branch | A named line of work so your task can be reviewed separately |
| Diff | The exact lines that changed |
| Stage | Select the changes for the next commit |
| Commit | A recorded snapshot with a message |
| Push / pull | Send commits to GitHub / bring remote commits into your local branch |
| Pull request | A proposal to review and merge one branch into another |
| Acceptance criteria | Observable conditions that define when this task is done |
| CI | Automated checks run on GitHub, separate from your laptop |
| Fixture | Synthetic input for development; not a real integration |

## Five-minute review with Ryan

Ask Conomos to show the diff and explain what the user does, what changes, how he verified it, and what is still missing. Ask which AI suggestion he changed or rejected and why. Choose the next task together; don't make progress depend on memorizing every command first.
