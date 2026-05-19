---
description: Run the Codex harness through Claude Agent SDK against an Anthropic-compatible external provider
argument-hint: [provider-backed task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Use `scripts/run-agent-sdk.mjs` when the user explicitly wants this task to run through an Anthropic-compatible external provider or the configured Claude CLI fallback. Do not ask the user to paste API keys into chat. Require external provider credentials to already exist in shell environment variables and pass only variable names to the runner.

Prefer agent provider routing:

```bash
node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "$ARGUMENTS"
```

Use sequence routing when the task should pass through multiple agents:

```bash
node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,implementation-worker,code-reviewer --prompt "$ARGUMENTS"
```

Use explicit API-key mode for one-off external provider runs:

```bash
node scripts/run-agent-sdk.mjs --base-url "$CODEX_HARNESS_BASE_URL" --api-key-env PROVIDER_API_KEY --prompt "$ARGUMENTS"
```

Use explicit bearer-token mode:

```bash
node scripts/run-agent-sdk.mjs --base-url "$CODEX_HARNESS_BASE_URL" --auth-token-env PROVIDER_TOKEN --prompt "$ARGUMENTS"
```

If an agent has no external provider env configured, or the SDK path fails, the runner falls back to `claude -p --agent codex-harness:codex-main` so Claude Code Max/Pro users keep using their normal Claude Code CLI subscription path. Report the selected agent, mode, model, fallback target, fallback reason when present, and credential environment variable name, but never print credential values.
