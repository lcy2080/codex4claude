---
description: Review changes for bugs, regressions, security, and missing tests
argument-hint: [scope]
model: opus
effort: xhigh
---

Review scope: $ARGUMENTS

Use `node scripts/run-agent-sdk.mjs --agent code-reviewer --prompt "$ARGUMENTS"` first when the runner is available. The runner uses the backend selected by `CODEX_HARNESS_CODE_REVIEWER_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable.

Use a code-review stance. Lead with findings ordered by severity. Include file and line references where possible. Focus on behavioral bugs, security issues, regressions, missing tests, and maintainability risks. Keep summaries secondary. If no issues are found, say so and mention remaining test gaps.
