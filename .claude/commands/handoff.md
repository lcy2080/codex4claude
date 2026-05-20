---
description: Prepare a concise handoff for unfinished work
argument-hint: [scope]
model: haiku
effort: low
---

Handoff scope: $ARGUMENTS

Resolve the runner before using it. Check `CODEX_HARNESS_RUNNER_PATH`, then `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, then the installed marketplace checkout at `%USERPROFILE%\.claude\plugins\marketplaces\codex4claude\scripts\run-agent-sdk.mjs` or `$HOME/.claude/plugins/marketplaces/codex4claude/scripts/run-agent-sdk.mjs`, then this workspace's `scripts/run-agent-sdk.mjs`. Use the first existing file with `node <runner> --agent codex-main --permission-mode acceptEdits --require-file-changes --cwd <current-workspace> --prompt "Write or update continue.md for this handoff. Include objective, completed artifacts, verification results, remaining tasks, known risks, assumptions, and first files to inspect. Scope: $ARGUMENTS"`. The harness or marketplace directory must be available to Claude Code tool access; if probing that path is blocked, tell the user to relaunch with `claude --add-dir <harness-or-marketplace-checkout>` and continue in-session until then. The runner uses the backend selected by `CODEX_HARNESS_CODEX_MAIN_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If no runner file is found in those locations, continue in the current Claude Code session and state that the runner was unavailable.

Write or update `continue.md` with:

1. Current objective.
2. Completed artifacts with paths.
3. Commands already run and results.
4. Remaining tasks in priority order.
5. Known risks, assumptions, and files to inspect first.

Keep it concise enough for a fresh agent to resume without replaying the full conversation.
