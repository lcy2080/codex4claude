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
/codex-harness:external-agent <provider-backed task>
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
cd codex4claude
```

Start Claude Code with the plugin directory:

```bash
claude --plugin-dir ./plugins/codex-harness
```

Use the plugin's main agent as the session default:

```bash
claude --plugin-dir ./plugins/codex-harness --agent codex-harness:codex-main
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
/external-agent <provider-backed task>
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
- `/codex-harness:external-agent <task>` or `/external-agent <task>`: Run the harness through Claude Agent SDK against a configured Anthropic-compatible provider. Uses `sonnet` with `medium` effort.

## Run With Anthropic-Compatible Providers

The optional runner lets this harness use external APIs that expose an Anthropic-compatible endpoint. It is intentionally generic: use your provider's documentation for the exact base URL, credential type, and model names. This applies to MiniMax, Z.ai, and similar providers when they expose an Anthropic-compatible API, but this repository does not hardcode provider profiles.

Claude Code Max/Pro users should leave external provider settings empty. When provider settings are missing or the SDK path fails, the runner falls back to the installed `claude` CLI with `claude -p`, which keeps using the normal Claude Code CLI subscription/auth path instead of calling Claude Code through Agent SDK.

Install the Node dependency once:

```bash
npm install
```

API-key mode on Linux and macOS:

```bash
export CODEX_HARNESS_BASE_URL="https://provider.example/anthropic"
export PROVIDER_API_KEY="set-in-your-shell"
node scripts/run-agent-sdk.mjs --api-key-env PROVIDER_API_KEY --model provider-model --prompt "Plan a small change"
```

Bearer-token mode on Linux and macOS:

```bash
export CODEX_HARNESS_BASE_URL="https://provider.example/api/anthropic"
export PROVIDER_TOKEN="set-in-your-shell"
node scripts/run-agent-sdk.mjs --auth-token-env PROVIDER_TOKEN --model provider-model --prompt "Review recent changes"
```

PowerShell API-key mode:

```powershell
$env:CODEX_HARNESS_BASE_URL = "https://provider.example/anthropic"
$env:PROVIDER_API_KEY = "set-in-your-shell"
node scripts/run-agent-sdk.mjs --api-key-env PROVIDER_API_KEY --model provider-model --prompt "Plan a small change"
```

If your provider does not accept Claude model aliases, map the aliases for a single run:

```bash
node scripts/run-agent-sdk.mjs --api-key-env PROVIDER_API_KEY --model provider-sonnet --haiku-model provider-small --sonnet-model provider-medium --opus-model provider-large --prompt "Verify this patch"
```

The runner only receives the environment variable name, not the credential value. Do not put provider keys in prompts, command history examples, README edits, or plugin manifests.

## Agent-Specific Provider Routing

Agent routing is controlled by the env-only provider manifest. The checked-in manifest names environment variables only; it does not store provider URLs or credentials.

Default routing:

| Agent | Default mode | Required env vars for external mode |
| --- | --- | --- |
| `codex-main` | Claude CLI | None |
| `context-explorer` | External when configured, otherwise Claude CLI fallback | `CODEX_HARNESS_CONTEXT_EXPLORER_BASE_URL`, `CODEX_HARNESS_CONTEXT_EXPLORER_API_KEY`, `CODEX_HARNESS_CONTEXT_EXPLORER_MODEL` |
| `implementation-worker` | External when configured, otherwise Claude CLI fallback | `CODEX_HARNESS_IMPLEMENTATION_WORKER_BASE_URL`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_API_KEY`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_MODEL` |
| `code-reviewer` | External when configured, otherwise Claude CLI fallback | `CODEX_HARNESS_CODE_REVIEWER_BASE_URL`, `CODEX_HARNESS_CODE_REVIEWER_API_KEY`, `CODEX_HARNESS_CODE_REVIEWER_MODEL` |
| `verification-auditor` | External when configured, otherwise Claude CLI fallback | `CODEX_HARNESS_VERIFICATION_AUDITOR_BASE_URL`, `CODEX_HARNESS_VERIFICATION_AUDITOR_API_KEY`, `CODEX_HARNESS_VERIFICATION_AUDITOR_MODEL` |

For Max/Pro-compatible usage, leave those provider env vars unset. The dry-run output should show `mode` as `claudeCli` and include `fallbackReason`.

Dry-run a single agent without calling any API:

```bash
node scripts/run-agent-sdk.mjs --agent context-explorer --dry-run --prompt "probe"
```

Configure one agent on Linux or macOS. If all required provider env vars are set, this uses the external Anthropic-compatible provider for that agent:

```bash
export CODEX_HARNESS_CONTEXT_EXPLORER_BASE_URL="https://provider.example/anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_CONTEXT_EXPLORER_MODEL="provider-small"
node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "Map the files involved"
```

Configure one agent on PowerShell:

```powershell
$env:CODEX_HARNESS_CODE_REVIEWER_BASE_URL = "https://provider.example/anthropic"
$env:CODEX_HARNESS_CODE_REVIEWER_API_KEY = "set-in-your-shell"
$env:CODEX_HARNESS_CODE_REVIEWER_MODEL = "provider-review-model"
node scripts/run-agent-sdk.mjs --agent code-reviewer --prompt "Review the current change"
```

Configure different providers per agent by setting different env var groups:

```bash
export CODEX_HARNESS_CONTEXT_EXPLORER_BASE_URL="https://provider-a.example/anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_CONTEXT_EXPLORER_MODEL="provider-a-small"

export CODEX_HARNESS_IMPLEMENTATION_WORKER_BASE_URL="https://provider-b.example/anthropic"
export CODEX_HARNESS_IMPLEMENTATION_WORKER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_IMPLEMENTATION_WORKER_MODEL="provider-b-coder"

export CODEX_HARNESS_CODE_REVIEWER_BASE_URL="https://provider-c.example/anthropic"
export CODEX_HARNESS_CODE_REVIEWER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_CODE_REVIEWER_MODEL="provider-c-review"
```

Run multiple agents in sequence, allowing each agent to choose its own external provider or Claude CLI fallback:

```bash
node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,implementation-worker,code-reviewer --prompt "Implement and review this change"
```

Check routing before a real run:

```bash
node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,implementation-worker,code-reviewer --dry-run --prompt "probe"
```

Each dry-run line is sanitized. It shows the selected `agent`, `mode`, `model`, `effort`, configured env var names, and fallback reason when one applies. It never prints credential values.

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
- `package.json`: Node dependency and npm script entry points for the optional SDK runner.
- `config/agent-providers.json`: Env-only agent provider routing manifest.
- `scripts/run-agent-sdk.mjs`: Generic Claude Agent SDK runner for Anthropic-compatible providers.
- `scripts/verify-harness.ps1`: Structural verifier for the harness.
- `scripts/verify-harness.sh`: POSIX shell verifier for Linux and macOS.

## Verify The Harness

Run the verifier after editing the harness. On Linux and macOS, use the POSIX shell verifier:

```bash
sh scripts/verify-harness.sh
```

On Windows, use the PowerShell verifier:

```powershell
pwsh -File scripts/verify-harness.ps1
```

The verifier checks:

- Required file presence.
- GitHub Actions harness validation workflow presence.
- POSIX shell and PowerShell verifier coverage.
- Optional Claude Agent SDK runner and npm dependency coverage.
- Agent-specific provider routing manifest coverage.
- JSON parseability.
- Marketplace name, owner, plugin entry, and relative source path.
- Markdown frontmatter presence.
- Model assignments for commands and agents.
- Effort assignments for commands, agents, and skills.
- Project default model and effort settings.
- Obvious hardcoded secret examples in harness docs and scripts.

Expected success output:

```text
Harness verification passed.
Checked 44 required files.
```

## Security Notes

When using the project-local `.claude` configuration, shell searches and workspace verifier execution are approval-gated. This avoids bypassing file-read deny rules with shell output and avoids automatically executing a verifier script that may have been modified in the workspace.

For external providers, keep credentials outside the repository and pass only credential environment variable names to the runner. The verifier rejects common secret-looking examples, but it is not a substitute for secret scanning before publishing.

Do not use external Agent SDK routing as a workaround for Claude Code Max/Pro access. Leave provider env vars empty so the runner uses the installed Claude Code CLI directly.

For the GitHub marketplace repository, protect `main` before accepting external contributions. Recommended rules:

- Require pull requests before merging.
- Restrict direct pushes to `main`.
- Require status checks for `claude plugin validate .`, `claude plugin validate plugins/codex-harness`, `sh scripts/verify-harness.sh`, and `pwsh -File scripts/verify-harness.ps1`.
- Require signed commits if that fits your release process.

This repository includes a `Harness Validation` GitHub Actions workflow with a `Harness validation` check that runs those validations on pushes and pull requests targeting `main`.

## Release Notes

The plugin currently uses an explicit `version` in both the marketplace entry and plugin manifest. Claude Code uses that version as part of update resolution, so bump the plugin version when publishing changes that installed users should receive.
