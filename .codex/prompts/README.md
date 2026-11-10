# Skills and prompt recipes

For Encore orchestration, use the repository-local [encore-orchestrator skill](../../.agents/skills/encore-orchestrator/SKILL.md) in the current chat: `$encore-orchestrator implement #5` or `$encore-orchestrator investigate #6`. Plain-language fallback: `Use encore-orchestrator to implement #5`. AGENTS.md routes these requests explicitly even when skill discovery is unavailable. The checkout must contain the skill; this is not a global installation.

The remaining recipes are ordinary text files, not installed commands. Open a recipe and paste it into your Codex interface with the repository selected.

- [Orient and learn](orient.md): understand the repo without editing it.
- [Take one task](implement.md): implement an explicitly selected deliverable.
- [Review before shipping](review.md): inspect a diff and its evidence.
- [Cloud orchestrator compatibility entry](cloud-orchestrator.md): short examples and the link to the skill, preserving the former prompt location. See [cloud usage](../../docs/CLOUD_ENVIRONMENT.md) for checkout availability and optional separate chats.

Persistent rules live in [AGENTS.md](../../AGENTS.md); the workflow lives in [the harness guide](../../docs/HARNESS.md). Replace bracketed values before use. Never paste secrets or real patron data.
