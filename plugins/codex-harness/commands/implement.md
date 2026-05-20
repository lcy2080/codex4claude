---
description: Implement a scoped change using the Codex-style loop
argument-hint: [task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Resolve the runner before using it. Check `CODEX_HARNESS_RUNNER_PATH`, then `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, then the installed marketplace checkout at `%USERPROFILE%\.claude\plugins\marketplaces\codex4claude\scripts\run-agent-sdk.mjs` or `$HOME/.claude/plugins/marketplaces/codex4claude/scripts/run-agent-sdk.mjs`, then this workspace's `scripts/run-agent-sdk.mjs`. Use the first existing file with `node <runner> --agent implementation-worker --permission-mode acceptEdits --require-file-changes --cwd <current-workspace> --prompt "$ARGUMENTS"`. The harness or marketplace directory must be available to Claude Code tool access; if probing that path is blocked, tell the user to relaunch with `claude --add-dir <harness-or-marketplace-checkout>` and continue in-session until then. The runner uses the backend selected by `CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. Non-interactive runner backends auto-handle approval by policy; safe workflow tools are allowed by default where the backend supports them, and Bash is not approved unless the invocation includes `--allowed-tools Bash` or the manifest sets `allowBash: true`. If the agent reports success without changing workspace files, treat the runner failure as evidence that the backend answered without applying edits. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If no runner file is found in those locations, continue in the current Claude Code session and state that the runner was unavailable. Execute end to end: read instructions and relevant files, keep edits narrowly scoped, preserve unrelated user changes, run meaningful verification, and finish with changed files, evidence, and residual risk.
