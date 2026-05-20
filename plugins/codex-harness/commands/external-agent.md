---
description: Run the Codex harness through an external SDK provider, Codex CLI backend, or Claude CLI fallback
argument-hint: [provider-backed task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Use `scripts/run-agent-sdk.mjs` when the user explicitly wants this task to run through a configured Anthropic-compatible or OpenAI-compatible external provider, a local Codex CLI backend, or the configured Claude CLI fallback. Do not ask the user to paste API keys into chat. Require external provider credentials to already exist in shell environment variables and pass only variable names to the runner. Prefer an agent-specific mode env such as `CODEX_HARNESS_CODE_REVIEWER_MODE=openai`, `CODEX_HARNESS_CODE_REVIEWER_MODE=anthropic`, `CODEX_HARNESS_CODE_REVIEWER_MODE=codexCli`, or `CODEX_HARNESS_CODE_REVIEWER_MODE=claudeCli` next to the base URL/model/key env.

Prefer agent provider routing:

```bash
node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "$ARGUMENTS"
```

Use sequence routing when the task should pass through multiple agents:

```bash
node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,implementation-worker,code-reviewer --prompt "$ARGUMENTS"
```

Sequence routing applies role permission presets: `context-explorer`, `code-reviewer`, and `verification-auditor` are read-only by default, while `implementation-worker` keeps the requested `--permission-mode`. Override a role only when needed with `CODEX_HARNESS_CONTEXT_EXPLORER_PERMISSION_MODE`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_PERMISSION_MODE`, `CODEX_HARNESS_CODE_REVIEWER_PERMISSION_MODE`, or `CODEX_HARNESS_VERIFICATION_AUDITOR_PERMISSION_MODE`.

Use a manifest entry with `mode: "codexCli"` when the user wants local Codex CLI execution without API credentials:

```bash
node scripts/run-agent-sdk.mjs --agent implementation-worker --permission-mode acceptEdits --prompt "$ARGUMENTS"
```

Use the agent-specific `modeEnv` values to switch backends without editing the manifest. `anthropic` and `openai` select external provider mode with the matching SDK; `codexCli` selects local `codex exec`; `claudeCli` selects the main Claude CLI fallback path.

For Codex CLI backend runs, `default` maps to `--sandbox read-only --ask-for-approval on-request`, `acceptEdits` maps to `--sandbox workspace-write --ask-for-approval on-request`, and `bypassPermissions` maps to `--sandbox workspace-write --ask-for-approval never`. `--allowed-tools` and `--disallowed-tools` are not applied by the Codex CLI backend.

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

If an agent has no external provider env configured, or the SDK/Codex CLI path fails, the runner falls back to `claude -p --agent codex-harness:codex-main` so Claude Code Max/Pro users keep using their normal Claude Code CLI subscription path. Report the selected agent, sdk, mode, model, fallback target, fallback reason when present, Codex sandbox/approval mapping or OpenAI tool exposure when relevant, and credential environment variable name, but never print credential values.
