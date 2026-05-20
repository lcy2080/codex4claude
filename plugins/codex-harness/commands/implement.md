---
description: Implement a scoped change using the Codex-style loop
argument-hint: [task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Use `node scripts/run-agent-sdk.mjs --agent implementation-worker --permission-mode acceptEdits --prompt "$ARGUMENTS"` first when the runner is available. The runner uses the backend selected by `CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable. Execute end to end: read instructions and relevant files, keep edits narrowly scoped, preserve unrelated user changes, run meaningful verification, and finish with changed files, evidence, and residual risk.
