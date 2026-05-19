---
description: Run the Codex harness through an external SDK provider or Claude CLI fallback
argument-hint: [provider-backed task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Use `scripts/run-agent-sdk.mjs` when the user explicitly wants this task to run through a configured Anthropic-compatible or OpenAI-compatible external provider, or the configured Claude CLI fallback. Do not ask the user to paste API keys into chat. Require external provider credentials to already exist in shell environment variables and pass only variable names to the runner. Prefer an agent-specific SDK env such as `CODEX_HARNESS_CODE_REVIEWER_SDK=openai` or `CODEX_HARNESS_CODE_REVIEWER_SDK=anthropic` next to the base URL/model/key env.

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

Use OpenAI Agents SDK mode for OpenAI-compatible providers:

```bash
node scripts/run-agent-sdk.mjs --sdk openai --base-url "$CODEX_HARNESS_BASE_URL" --api-key-env OPENAI_COMPAT_API_KEY --model "$OPENAI_COMPAT_MODEL" --prompt "$ARGUMENTS"
```

For OpenAI-compatible write runs, expose edit tools only when the task requires edits:

```bash
node scripts/run-agent-sdk.mjs --sdk openai --agent implementation-worker --permission-mode acceptEdits --prompt "$ARGUMENTS"
```

Expose Bash only when it is explicitly needed:

```bash
node scripts/run-agent-sdk.mjs --sdk openai --agent implementation-worker --allowed-tools Bash --prompt "$ARGUMENTS"
```

Use explicit bearer-token mode:

```bash
node scripts/run-agent-sdk.mjs --base-url "$CODEX_HARNESS_BASE_URL" --auth-token-env PROVIDER_TOKEN --prompt "$ARGUMENTS"
```

If an agent has no external provider env configured, or the SDK path fails, the runner falls back to `claude -p --agent codex-harness:codex-main` so Claude Code Max/Pro users keep using their normal Claude Code CLI subscription path. Report the selected agent, sdk, mode, model, fallback target, fallback reason when present, OpenAI tool exposure when relevant, and credential environment variable name, but never print credential values.
