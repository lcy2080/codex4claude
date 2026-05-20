---
description: Review changes for bugs, regressions, security, and missing tests
argument-hint: [scope]
model: opus
effort: xhigh
---

Review scope: $ARGUMENTS

Use `scripts/run-agent-sdk.mjs --agent code-reviewer --prompt "$ARGUMENTS"` when the runner is available. The runner should use the backend selected by `CODEX_HARNESS_CODE_REVIEWER_MODE`; set it to `external`, `anthropic`, `openai`, or `codexCli` to leave the default Claude CLI path. If provider configuration is incomplete or execution fails, the runner should fall back to the main Claude CLI harness.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable. Use a code-review stance. Lead with findings ordered by severity. Include file and line references where possible. Focus on behavioral bugs, security issues, regressions, missing tests, and maintainability risks.
