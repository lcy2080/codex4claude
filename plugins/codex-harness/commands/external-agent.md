---
description: Run the Codex harness through an external SDK provider, Codex CLI backend, or Claude CLI fallback
argument-hint: [provider-backed task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Use the harness runner when the user explicitly wants this task to run through a configured Anthropic-compatible or OpenAI-compatible external provider, a local Codex CLI backend, or the configured Claude CLI fallback. Resolve the runner by checking `CODEX_HARNESS_RUNNER_PATH`, then `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, then the installed marketplace checkout at `%USERPROFILE%\.claude\plugins\marketplaces\codex4claude\scripts\run-agent-sdk.mjs` or `$HOME/.claude/plugins/marketplaces/codex4claude/scripts/run-agent-sdk.mjs`, then this workspace's `scripts/run-agent-sdk.mjs`. Run the first existing file with `node <runner> ... --cwd <current-workspace>`. The harness or marketplace directory must be available to Claude Code tool access; if probing that path is blocked, tell the user to relaunch with `claude --add-dir <harness-or-marketplace-checkout>` and continue in-session until then. Do not ask the user to paste API keys into chat. Require external provider credentials to already exist in shell environment variables and pass only variable names to the runner. Prefer an agent-specific mode env such as `CODEX_HARNESS_CODE_REVIEWER_MODE=openai`, `CODEX_HARNESS_CODE_REVIEWER_MODE=anthropic`, `CODEX_HARNESS_CODE_REVIEWER_MODE=codexCli`, or `CODEX_HARNESS_CODE_REVIEWER_MODE=claudeCli` next to the base URL/model/key env.

Prefer agent provider routing:

```bash
node <runner> --agent context-explorer --cwd <current-workspace> --prompt "$ARGUMENTS"
```

Use sequence routing when the task should pass through multiple agents:

```bash
node <runner> --agent-sequence context-explorer,implementation-worker,code-reviewer --cwd <current-workspace> --prompt "$ARGUMENTS"
```

Sequence routing applies role permission presets: `context-explorer`, `code-reviewer`, and `verification-auditor` are read-only by default, while `implementation-worker` keeps the requested `--permission-mode`. Override a role only when needed with `CODEX_HARNESS_CONTEXT_EXPLORER_PERMISSION_MODE`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_PERMISSION_MODE`, `CODEX_HARNESS_CODE_REVIEWER_PERMISSION_MODE`, or `CODEX_HARNESS_VERIFICATION_AUDITOR_PERMISSION_MODE`.

Use a manifest entry with `mode: "codexCli"` when the user wants local Codex CLI execution without API credentials:

```bash
node <runner> --agent implementation-worker --permission-mode acceptEdits --cwd <current-workspace> --prompt "$ARGUMENTS"
```

Use the agent-specific `modeEnv` values to switch backends without editing the manifest. `anthropic` and `openai` select external provider mode with the matching SDK; `codexCli` selects local `codex exec`; `claudeCli` selects the main Claude CLI fallback path.

For Codex CLI backend runs, `default` maps to `--sandbox read-only --ask-for-approval never`; `acceptEdits` and `bypassPermissions` map to `--sandbox workspace-write --ask-for-approval never`. The runner cannot service mid-run Codex approval UI. `--allowed-tools` and `--disallowed-tools` are not applied by the Codex CLI backend.

Use explicit API-key mode for one-off external provider runs:

```bash
node <runner> --base-url "$CODEX_HARNESS_BASE_URL" --api-key-env PROVIDER_API_KEY --cwd <current-workspace> --prompt "$ARGUMENTS"
```

Use OpenAI Agents SDK mode for OpenAI-compatible providers:

```bash
node <runner> --sdk openai --base-url "$CODEX_HARNESS_BASE_URL" --api-key-env OPENAI_COMPAT_API_KEY --model "$OPENAI_COMPAT_MODEL" --cwd <current-workspace> --prompt "$ARGUMENTS"
```

For OpenAI-compatible write runs, expose edit tools only when the task requires edits:

```bash
node <runner> --sdk openai --agent implementation-worker --permission-mode acceptEdits --cwd <current-workspace> --prompt "$ARGUMENTS"
```

Expose Bash only when it is explicitly needed:

```bash
node <runner> --sdk openai --agent implementation-worker --allowed-tools Bash --cwd <current-workspace> --prompt "$ARGUMENTS"
```

For all backends, Bash is not pre-approved unless `--allowed-tools Bash` or manifest `allowBash: true` is set. Claude CLI fallback uses non-interactive `claude -p`, so approval prompts and clarifying questions are not handled by the runner.

Use explicit bearer-token mode:

```bash
node <runner> --base-url "$CODEX_HARNESS_BASE_URL" --auth-token-env PROVIDER_TOKEN --cwd <current-workspace> --prompt "$ARGUMENTS"
```

If an agent has no external provider env configured, or the SDK/Codex CLI path fails, the runner falls back to `claude -p --agent codex-harness:codex-main` so Claude Code Max/Pro users keep using their normal Claude Code CLI subscription path. Report the selected agent, sdk, mode, model, fallback target, fallback reason when present, Codex sandbox/approval mapping or OpenAI tool exposure when relevant, and credential environment variable name, but never print credential values.
