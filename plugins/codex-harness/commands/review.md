---
description: Review changes for bugs, regressions, security, and missing tests
argument-hint: [scope]
model: opus
effort: xhigh
---

Review scope: $ARGUMENTS

Resolve the runner before using it. Check `CODEX_HARNESS_RUNNER_PATH`, then `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, then the installed marketplace checkout at `%USERPROFILE%\.claude\plugins\marketplaces\codex4claude\scripts\run-agent-sdk.mjs` or `$HOME/.claude/plugins/marketplaces/codex4claude/scripts/run-agent-sdk.mjs`, then this workspace's `scripts/run-agent-sdk.mjs`. Use the first existing file with `node <runner> --agent code-reviewer --cwd <current-workspace> --prompt "$ARGUMENTS"`. The harness or marketplace directory must be available to Claude Code tool access; if probing that path is blocked, tell the user to relaunch with `claude --add-dir <harness-or-marketplace-checkout>` and continue in-session until then. The runner uses the backend selected by `CODEX_HARNESS_CODE_REVIEWER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If no runner file is found in those locations, continue in the current Claude Code session and state that the runner was unavailable. Use a code-review stance. Lead with findings ordered by severity. Include file and line references where possible. Focus on behavioral bugs, security issues, regressions, missing tests, and maintainability risks.
