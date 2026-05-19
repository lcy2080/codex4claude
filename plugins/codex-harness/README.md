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

Model and effort policy:

- `haiku` + `low`: context lookup and handoff notes.
- `sonnet` + `medium`: bounded implementation and default project work.
- `sonnet` + `high`: default main-thread harness behavior when no external provider is configured.
- `opus` + `xhigh`: complex planning, review, and verification commands.
- `opus` + `max`: completion auditor surfaces.
- `ultrathink`: explicit one-off deep reasoning only after usage credits or a compatible model are selected.

The default `codex-main` agent remains `sonnet` with `high` effort; complex commands intentionally use Opus.

After loading, run `/reload-plugins`, `/help`, and `/agents` to confirm the components are visible.
