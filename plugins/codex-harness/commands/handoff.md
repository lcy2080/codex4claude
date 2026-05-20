---
description: Prepare a concise handoff for unfinished work
argument-hint: [scope]
model: haiku
effort: low
---

Handoff scope: $ARGUMENTS

Use `node scripts/run-agent-sdk.mjs --agent codex-main --prompt "$ARGUMENTS"` first when the runner is available. The runner uses the backend selected by `CODEX_HARNESS_CODEX_MAIN_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable. Write or update `continue.md` with objective, completed artifacts, verification results, remaining tasks, known risks, assumptions, and first files to inspect.
