# Encore orchestrator

The reusable workflow is now the repository-local [encore-orchestrator skill](../../.agents/skills/encore-orchestrator/SKILL.md). In your current Encore chat, send one of:

```text
$encore-orchestrator implement #5
$encore-orchestrator investigate #6
```

Plain-language fallback: `Use encore-orchestrator to implement #5`. [AGENTS.md](../../AGENTS.md) explicitly routes these requests even when automatic skill discovery is unavailable. No chat switch or full prompt copy is required.

The checkout must contain the skill; `main` receives it after [PR #21](https://github.com/ryandils/encore/pull/21) merges. This is not a global installation or a tested skill-picker integration. See [cloud usage](../../docs/CLOUD_ENVIRONMENT.md) and [coordination policy](../../docs/WORKFLOW.md). The skill does not launch chats or bypass issue readiness checks.
