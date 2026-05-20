---
description: Build a scoped implementation plan with verification gates
argument-hint: [task]
model: opus
effort: xhigh
---

Task: $ARGUMENTS

Resolve the runner before using it. Check `CODEX_HARNESS_RUNNER_PATH`, then `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, then the installed marketplace checkout at `%USERPROFILE%\.claude\plugins\marketplaces\codex4claude\scripts\run-agent-sdk.mjs` or `$HOME/.claude/plugins/marketplaces/codex4claude/scripts/run-agent-sdk.mjs`, then this workspace's `scripts/run-agent-sdk.mjs`. Use the first existing file with `node <runner> --agent context-explorer --cwd <current-workspace> --prompt "$ARGUMENTS"`. The harness or marketplace directory must be available to Claude Code tool access; if probing that path is blocked, tell the user to relaunch with `claude --add-dir <harness-or-marketplace-checkout>` and continue in-session until then. The runner uses the backend selected by `CODEX_HARNESS_CONTEXT_EXPLORER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If no runner file is found in those locations, continue in the current Claude Code session and state that the runner was unavailable.

Read the relevant repository instructions and inspect the smallest useful set of files. Produce a short plan that includes:

1. Assumptions and open decisions.
2. Concrete steps.
3. Verification command or evidence for each step.
4. Files or directories likely to change.

Do not edit files in this command unless the user explicitly asks you to continue into implementation.
