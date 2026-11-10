# Skills and prompt recipes

Use repository-local skills in the current chat:

- [encore-issues](../../.agents/skills/encore-issues/SKILL.md): `$encore-issues` lists all open and closed issues read-only; add `open only` to narrow it.
- [encore-prioritize](../../.agents/skills/encore-prioritize/SKILL.md): `$encore-prioritize` gives an evidence-backed ranked recommendation without starting work.
- [encore-orchestrator](../../.agents/skills/encore-orchestrator/SKILL.md): `$encore-orchestrator implement #5` requests action; `$encore-orchestrator investigate #6` requests read-only investigation.

Plain language such as `Use encore-prioritize to recommend what to work on next` works through AGENTS.md routing even without skill discovery. The checkout must contain the skills; this is not a global installation. Listing/recommendation questions never imply implementation. See [usage and availability](../../docs/CLOUD_ENVIRONMENT.md).

The remaining recipes are ordinary text files, not installed commands. Open a recipe and paste it into your Codex interface with the repository selected.

- [Orient and learn](orient.md): understand the repo without editing it.
- [Take one task](implement.md): implement an explicitly selected deliverable.
- [Review before shipping](review.md): inspect a diff and its evidence.
- [Cloud orchestrator compatibility entry](cloud-orchestrator.md): short examples and the link to the skill, preserving the former prompt location. See [cloud usage](../../docs/CLOUD_ENVIRONMENT.md) for checkout availability and optional separate chats.

Persistent rules live in [AGENTS.md](../../AGENTS.md); the workflow lives in [the harness guide](../../docs/HARNESS.md). Replace bracketed values before use. Never paste secrets or real patron data.
