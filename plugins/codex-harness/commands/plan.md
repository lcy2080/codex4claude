---
description: Build a scoped implementation plan with verification gates
argument-hint: [task]
model: opus
effort: xhigh
---

Task: $ARGUMENTS

Use `node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "$ARGUMENTS"` first when the runner is available. The runner uses the backend selected by `CODEX_HARNESS_CONTEXT_EXPLORER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable. Read the relevant repository instructions and inspect the smallest useful set of files. Produce a short plan with assumptions, concrete steps, verification evidence for each step, and likely files to change. Do not edit files unless the user asks to continue into implementation.
