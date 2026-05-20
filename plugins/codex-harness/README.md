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

- `plan`: prefers `node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "$ARGUMENTS"`.
- `implement`: prefers `node scripts/run-agent-sdk.mjs --agent implementation-worker --permission-mode acceptEdits --prompt "$ARGUMENTS"`.
- `review`: prefers `node scripts/run-agent-sdk.mjs --agent code-reviewer --prompt "$ARGUMENTS"`.
- `verify`: prefers `node scripts/run-agent-sdk.mjs --agent verification-auditor --prompt "$ARGUMENTS"`.
- `handoff`: prefers `node scripts/run-agent-sdk.mjs --agent codex-main --prompt "$ARGUMENTS"`.

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
