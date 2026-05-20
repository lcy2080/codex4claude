# Codex Harness Plugin

Load locally with:

```bash
claude --plugin-dir ./plugins/codex-harness
```

The plugin provides:

- `commands/`: plan, implement, review, verify, and handoff prompts.
- `skills/`: completion audit, context triage, surgical editing, and handoff workflows.
- `agents/`: context explorer, implementation worker, code reviewer, and verification auditor.
- `output-styles/`: `Codex Harness` system-prompt overlay.
- `settings.json`: default main-thread agent activation.

Slash command routing:

Commands resolve the runner from `CODEX_HARNESS_RUNNER_PATH`, `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, the installed `codex4claude` marketplace checkout, or the current workspace's `scripts/run-agent-sdk.mjs`. When the runner is outside the target workspace, commands pass `--cwd <current-workspace>` so the agent works on the opened project instead of the harness checkout. Claude Code must be launched with `--add-dir <harness-or-marketplace-checkout>` when that runner directory is outside the workspace.

- `plan`: prefers `node <runner> --agent context-explorer --cwd <current-workspace> --prompt "$ARGUMENTS"`.
- `implement`: prefers `node <runner> --agent implementation-worker --permission-mode acceptEdits --require-file-changes --cwd <current-workspace> --prompt "$ARGUMENTS"`.
- `review`: prefers `node <runner> --agent code-reviewer --cwd <current-workspace> --prompt "$ARGUMENTS"`.
- `verify`: prefers `node <runner> --agent verification-auditor --cwd <current-workspace> --prompt "$ARGUMENTS"`.
- `handoff`: prefers `node <runner> --agent codex-main --permission-mode acceptEdits --require-file-changes --cwd <current-workspace> --prompt "Write or update continue.md for this handoff. Include objective, completed artifacts, verification results, remaining tasks, known risks, assumptions, and first files to inspect. Scope: $ARGUMENTS"`.

The default agent provider mode remains `claudeCli`. Set a role-specific mode env such as `CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE=codexCli`, `CODEX_HARNESS_CODE_REVIEWER_MODE=external`, `CODEX_HARNESS_CODE_REVIEWER_MODE=anthropic`, or `CODEX_HARNESS_CODE_REVIEWER_MODE=openai` only when that role should leave the default Claude CLI path. If the runner is unavailable, each command continues in the current Claude Code session and says so.

Model and effort policy:

- `haiku` + `low`: context lookup and handoff notes.
- `sonnet` + `medium`: bounded implementation and default project work.
- `sonnet` + `high`: default main-thread harness behavior when no external provider is configured.
- `opus` + `xhigh`: complex planning, review, and verification commands.
- `opus` + `max`: completion auditor surfaces.
- `ultrathink`: explicit one-off deep reasoning only after usage credits or a compatible model are selected.

The default `codex-main` agent remains `sonnet` with `high` effort; complex commands intentionally use Opus.

After loading, run `/reload-plugins`, `/help`, and `/agents` to confirm the components are visible.
