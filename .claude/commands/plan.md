---
description: Build a scoped implementation plan with verification gates
argument-hint: [task]
model: opus
effort: xhigh
---

Task: $ARGUMENTS

Use `node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "$ARGUMENTS"` first when the runner is available. The runner uses the backend selected by `CODEX_HARNESS_CONTEXT_EXPLORER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable.

Read the relevant repository instructions and inspect the smallest useful set of files. Produce a short plan that includes:

1. Assumptions and open decisions.
2. Concrete steps.
3. Verification command or evidence for each step.
4. Files or directories likely to change.

Do not edit files in this command unless the user explicitly asks you to continue into implementation.
