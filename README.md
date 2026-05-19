# Claude Code Codex Harness

This repository packages a Claude Code harness that makes Claude behave more like a disciplined coding agent: read relevant context first, plan briefly, edit surgically, verify with concrete evidence, and audit completion before claiming work is done.

The repository can be used in three ways:

1. As a GitHub-hosted Claude Code plugin marketplace.
2. As a local plugin directory.
3. As a project-local `.claude` configuration.

## Install From GitHub Marketplace

Add this GitHub repository as a Claude Code marketplace:

```text
/plugin marketplace add lcy2080/codex4claude
```

Install the harness plugin:

```text
/plugin install codex-harness@codex4claude
```

Restart Claude Code after installation so the plugin components are loaded.

Confirm the installation:

```text
/plugin list
/agents
/help
```

The plugin components are namespaced as `codex-harness`. Plugin slash commands and skills use this form:

```text
/codex-harness:plan <task>
/codex-harness:implement <task>
/codex-harness:review <scope>
/codex-harness:verify <completion criteria>
/codex-harness:handoff <current state>
/codex-harness:completion-audit
```

To update later:

```text
/plugin marketplace update codex4claude
/plugin update codex-harness@codex4claude
```

## Install As A Local Plugin

Clone the repository:

```bash
git clone https://github.com/lcy2080/codex4claude.git
```

Start Claude Code with the plugin directory:

```bash
claude --plugin-dir ./codex4claude/plugins/codex-harness
```

Use the plugin's main agent as the session default:

```bash
claude --plugin-dir ./codex4claude/plugins/codex-harness --agent codex-harness:codex-main
```

## Use As Project Configuration

You can also run Claude Code directly from this repository and use the checked-in `.claude` configuration:

```bash
git clone https://github.com/lcy2080/codex4claude.git
cd codex4claude
claude
```

Select the output style:

```text
/config
```

Choose `Codex Harness` under `Output style`, then restart Claude Code. Output styles are applied when a session starts.

## Daily Workflow

Use these slash commands for typical coding work. If you installed the harness as a plugin, use the namespaced command form:

```text
/codex-harness:plan <task>
/codex-harness:implement <task>
/codex-harness:review <scope>
/codex-harness:verify <completion criteria>
/codex-harness:handoff <current state>
```

If you are running this repository directly as a project-local `.claude` configuration, the same commands are also available without the namespace:

```text
/plan <task>
/implement <task>
/review <scope>
/verify <completion criteria>
/handoff <current state>
```

Recommended flow:

1. Start with `/plan` for scope, assumptions, likely files, and verification gates.
2. Use `/implement` for a bounded change.
3. Use `/review` to look for bugs, regressions, security issues, and missing tests.
4. Use `/verify` before claiming the task is complete.
5. Use `/handoff` when pausing or transferring work.

## Slash Commands

- `/codex-harness:plan <task>` or `/plan <task>`: Build a scoped implementation plan. Uses `opus` with `xhigh` effort.
- `/codex-harness:implement <task>` or `/implement <task>`: Make a focused change and verify it. Uses `sonnet` with `medium` effort.
- `/codex-harness:review <scope>` or `/review <scope>`: Review changes in a findings-first style. Uses `opus` with `high` effort.
- `/codex-harness:verify <scope>` or `/verify <scope>`: Map explicit requirements to actual evidence. Uses `opus` with `xhigh` effort.
- `/codex-harness:handoff <scope>` or `/handoff <scope>`: Write a concise continuation note. Uses `haiku` with `low` effort.

## Agents

The harness defines these Claude Code agents:

- `context-explorer`: Read-only repository exploration for specific questions. Uses `haiku` with `low` effort.
- `implementation-worker`: Bounded implementation with clear file ownership. Uses `sonnet` with `medium` effort.
- `code-reviewer`: Bug, regression, security, and test-gap review. Uses `sonnet` with `high` effort.
- `verification-auditor`: Completion audit against concrete evidence. Uses `opus` with `xhigh` effort.
- `codex-main`: Plugin main-thread agent for the full harness behavior. Uses `opus` with `high` effort.

You can ask Claude to use one explicitly:

```text
Use the verification-auditor agent to audit this task before completion.
```

## Skills

The harness includes reusable workflows:

- `context-triage`: Gather just enough context before planning or editing.
- `surgical-editing`: Enforce read-before-write, minimal diffs, local style matching, and preservation of unrelated user changes.
- `completion-audit`: Check every explicit requirement against real evidence before completion claims.
- `handoff-note`: Produce a concise continuation note for future sessions.

## Model And Effort Policy

The harness assigns model and thinking effort by task complexity:

- `haiku` + `low`: simple lookup, summary, and handoff work.
- `sonnet` + `medium`: ordinary implementation and bounded worker tasks.
- `sonnet` or `opus` + `high`: reviews, architecture-sensitive edits, and difficult debugging.
- `opus` + `xhigh`: complex planning and completion audits.
- `max` or `ultrathink`: reserved for explicit one-off deep reasoning requests.

Environment override notes:

- `CLAUDE_CODE_SUBAGENT_MODEL` overrides subagent `model` frontmatter.
- `CLAUDE_CODE_EFFORT_LEVEL` overrides component `effort` frontmatter.

## Repository Layout

- `.claude-plugin/marketplace.json`: GitHub marketplace catalog for Claude Code.
- `plugins/codex-harness`: Portable plugin package.
- `.claude`: Project-local Claude Code configuration.
- `CLAUDE.md`: Project memory for local use.
- `AGENTS.md`: Editing instructions for agents working on this repository.
- `scripts/verify-harness.ps1`: Structural verifier for the harness.

## Verify The Harness

Run the verifier after editing the harness:

```powershell
pwsh -File scripts/verify-harness.ps1
```

The verifier checks:

- Required file presence.
- JSON parseability.
- Marketplace name, owner, plugin entry, and relative source path.
- Markdown frontmatter presence.
- Model assignments for commands and agents.
- Effort assignments for commands, agents, and skills.
- Project default model and effort settings.

Expected success output:

```text
Harness verification passed.
Checked 36 required files.
```

## Security Notes

When using the project-local `.claude` configuration, shell searches and workspace verifier execution are approval-gated. This avoids bypassing file-read deny rules with shell output and avoids automatically executing a verifier script that may have been modified in the workspace.

For the GitHub marketplace repository, protect `main` before accepting external contributions. Recommended rules:

- Require pull requests before merging.
- Restrict direct pushes to `main`.
- Require status checks for `claude plugin validate .`, `claude plugin validate plugins/codex-harness`, and `pwsh -File scripts/verify-harness.ps1`.
- Require signed commits if that fits your release process.

## Release Notes

The plugin currently uses an explicit `version` in both the marketplace entry and plugin manifest. Claude Code uses that version as part of update resolution, so bump the plugin version when publishing changes that installed users should receive.
