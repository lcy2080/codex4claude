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

- `/codex-harness:plan <task>` or `/plan <task>`: Prefer the runner with `context-explorer`, then build a scoped implementation plan in-session if the runner is unavailable. Uses `opus` with `xhigh` effort.
- `/codex-harness:implement <task>` or `/implement <task>`: Prefer the runner with `implementation-worker --permission-mode acceptEdits`, then make a focused change in-session if the runner is unavailable. Uses `sonnet` with `medium` effort.
- `/codex-harness:review <scope>` or `/review <scope>`: Prefer the runner with `code-reviewer`, then review in-session if the runner is unavailable. Uses `opus` with `xhigh` effort.
- `/codex-harness:verify <scope>` or `/verify <scope>`: Prefer the runner with `verification-auditor`, then audit in-session if the runner is unavailable. Uses `opus` with `xhigh` effort.
- `/codex-harness:handoff <scope>` or `/handoff <scope>`: Prefer the runner with `codex-main`, then write a continuation note in-session if the runner is unavailable. Uses `haiku` with `low` effort.
- `/codex-harness:external-agent <task>` or `/external-agent <task>`: Run the harness through the configured external SDK backend, Codex CLI backend, or Claude CLI fallback. Uses `sonnet` with `medium` effort.

## Run With Multi-Backend Agent Runner

The optional runner lets this harness use external APIs through either the Claude Agent SDK (`sdk: "anthropic"`) or OpenAI Agents SDK (`sdk: "openai"`), local Codex CLI through `mode: "codexCli"`, or Claude CLI fallback through `mode: "claudeCli"`. It is intentionally generic: use your provider's documentation for the exact base URL, credential type, SDK protocol, and model names. OpenAI mode uses the OpenAI Agents SDK with Chat Completions-compatible transport by default for broader provider compatibility.

Claude Code Max/Pro users should leave external provider settings empty. When provider settings are missing or the SDK path fails, the runner falls back to the installed `claude` CLI with `claude -p --agent codex-harness:codex-main`, which keeps using the normal Claude Code CLI subscription/auth path instead of calling Claude Code through Agent SDK.

All role slash commands prefer the harness runner first and let each agent's `modeEnv` select the backend. Commands resolve the runner from `CODEX_HARNESS_RUNNER_PATH`, `CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs`, the installed `codex4claude` marketplace checkout, or the current workspace's `scripts/run-agent-sdk.mjs`; when the runner is outside the target project, they pass `--cwd` for the current workspace. Claude Code must also be allowed to read the harness or marketplace checkout, so launch target-project sessions with `claude --add-dir <harness-or-marketplace-checkout>` when the runner lives outside the workspace. The checked-in manifest keeps every agent on `mode: "claudeCli"` by default for Max/Pro-compatible usage. Set a role mode env to `external`, `anthropic`, `openai`, or `codexCli` only when that role should leave the default Claude CLI path.

Command routing:

| Slash command | Runner agent | Extra runner option |
| --- | --- | --- |
| `/codex-harness:plan` or `/plan` | `context-explorer` | |
| `/codex-harness:implement` or `/implement` | `implementation-worker` | `--permission-mode acceptEdits` |
| `/codex-harness:review` or `/review` | `code-reviewer` | |
| `/codex-harness:verify` or `/verify` | `verification-auditor` | |
| `/codex-harness:handoff` or `/handoff` | `codex-main` | |

Codex CLI users can route an agent to local `codex exec` without provider credentials by setting that agent's mode env to `codexCli`.

### Dependency Requirements

Default Claude CLI fallback mode and Codex CLI mode do not require npm dependencies in the target project. A target workspace can contain only the files being worked on, such as `index.html` and `styles.css`; do not copy the runner dependencies into every work repo.

External SDK modes (`anthropic`, `openai`, or `external`) need the Node dependencies from this harness package at the location where `scripts/run-agent-sdk.mjs` is executed. Install them once from this repository or from the marketplace/bundled checkout that provides the runner:

```bash
npm install
```

Those dependencies are declared in `package.json`: `@anthropic-ai/claude-agent-sdk`, `@openai/agents`, `openai`, and `zod`. If the SDK dependencies are missing, or if required provider environment variables are incomplete, the runner keeps the existing policy and falls back to the Claude CLI path.

Run the harness-installed runner against another workspace with `--cwd`:

```powershell
node scripts/run-agent-sdk.mjs --agent implementation-worker --cwd C:\tmp\codex4claude-acacia-site-test --prompt "Create the requested files"
```

Plugin marketplace installs follow the same rule: run the runner from the harness, marketplace checkout, or bundled runner location. The target project is the `--cwd` workspace, not the place where runner npm dependencies should be installed.

When using a plugin command from a target project, add the harness or marketplace checkout as an allowed directory if it is outside the workspace:

```powershell
claude --add-dir C:\Users\you\.claude\plugins\marketplaces\codex4claude
```

Use `.env.local.example` as a key-free template for local provider settings. The runner loads ignored `.env.local` files from the harness/marketplace checkout and the selected `--cwd` workspace, without overriding variables already present in the shell. Keep real provider URLs and credentials in your shell or ignored `.env.local` files only.

Anthropic-compatible API-key mode on Linux and macOS:

```bash
export CODEX_HARNESS_BASE_URL="https://provider.example/anthropic"
export CODEX_HARNESS_SDK="anthropic"
export PROVIDER_API_KEY="set-in-your-shell"
node scripts/run-agent-sdk.mjs --sdk anthropic --api-key-env PROVIDER_API_KEY --model provider-model --prompt "Plan a small change"
```

OpenAI-compatible API-key mode on Linux and macOS:

```bash
export CODEX_HARNESS_BASE_URL="https://provider.example/v1"
export CODEX_HARNESS_SDK="openai"
export OPENAI_COMPAT_API_KEY="set-in-your-shell"
node scripts/run-agent-sdk.mjs --sdk openai --api-key-env OPENAI_COMPAT_API_KEY --model provider-model --prompt "Map the files involved"
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

For non-interactive runs that need to write files, pass a Claude Agent SDK permission mode explicitly:

```bash
node scripts/run-agent-sdk.mjs --agent implementation-worker --permission-mode acceptEdits --prompt "Create the requested files"
```

For production-style or provider compatibility tests, cap both agentic turns and wall-clock time:

```bash
node scripts/run-agent-sdk.mjs --agent implementation-worker --permission-mode acceptEdits --allowed-tools Read,Write,Edit,Glob,Grep --max-turns 10 --overall-timeout-ms 180000 --prompt "Create the requested files"
```

Runner option notes:

- `--effort low|medium|high|xhigh|max` maps to the SDK `effort` option for reasoning depth. It is also recorded for Codex CLI dry-runs and used for Claude CLI fallback.
- `--max-turns` limits SDK agentic turns/API round trips, not elapsed time. Omit it, set `CODEX_HARNESS_MAX_TURNS=none`, or pass `--max-turns none` for no runner-imposed turn cap. Use `--overall-timeout-ms` when a wall-clock stop is required.
- `--overall-timeout-ms` also bounds Codex CLI and Claude CLI fallback runs. Fallback streams assistant text and emits progress markers such as `[fallback-init]`, `[fallback-message-start]`, `[fallback-tool-start]`, `[fallback-tool-input]`, `[fallback-tool-result]`, `[fallback-progress]`, and `[fallback-result]`.
- Agent SDK runs emit the same style of stream summaries with the `sdk-` prefix when `--include-partial-messages` is enabled.
- Claude Agent SDK runs handle tool approval through `canUseTool` and `PermissionRequest`/`PreToolUse` hooks. Read tools plus safe workflow/subagent tools (`TodoWrite`, `ExitPlanMode`, `Task`, `Agent`) are allowed by default; `AskUserQuestion` is denied with a non-interactive message instead of waiting for input.
- OpenAI Agents SDK runs emit `[openai-init]`, `[openai-tool-start]`, `[openai-tool-result]`, `[openai-approval-request]`, `[openai-approval-result]`, `[openai-progress]`, and `[openai-result]`. Tool approval interruptions are automatically approved or rejected by runner policy and then resumed.
- Codex CLI runs spawn `codex exec` and emit `[codex-init]`, `[codex-progress]`, `[codex-tool-start]`, `[codex-tool-result]`, and `[codex-result]`.
- OpenAI mode exposes `Read`, `LS`, `Glob`, `Grep`, `TodoWrite`, and `ExitPlanMode` by default. `TodoWrite` and `ExitPlanMode` are runner workflow tools; OpenAI mode does not expose Claude `Task`/`Agent` subagent preset tools. `Edit`, `MultiEdit`, and `Write` require `--permission-mode acceptEdits`, `--permission-mode bypassPermissions`, or a manifest `allowWrite: true`. `Bash` requires `--allowed-tools Bash` or manifest `allowBash: true`, and still runs through timeout, cwd, output-cap, and destructive-command checks.
- Codex CLI mode maps `--permission-mode default` to `--sandbox read-only --ask-for-approval never`; `acceptEdits` and `bypassPermissions` map to `--sandbox workspace-write --ask-for-approval never`. The runner cannot service mid-run Codex approval UI and does not automatically use `danger-full-access`.
- In sequence runs, role presets keep `context-explorer`, `code-reviewer`, and `verification-auditor` on `permissionMode=default`; `implementation-worker` keeps the requested `--permission-mode`. Override a role with `CODEX_HARNESS_CONTEXT_EXPLORER_PERMISSION_MODE`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_PERMISSION_MODE`, `CODEX_HARNESS_CODE_REVIEWER_PERMISSION_MODE`, or `CODEX_HARNESS_VERIFICATION_AUDITOR_PERMISSION_MODE`.
- `--allowed-tools` and `--disallowed-tools` have no direct Codex CLI equivalent and are not applied by the Codex CLI backend.
- Read-only review runs that inspect multiple files can need more turns than small probes. Use `--max-turns 12` to `--max-turns 20` for provider smoke tests that require `LS`, `Glob`, `Read`, and final synthesis.
- Thinking stream events are only marked as `[sdk-thinking]` or `[fallback-thinking]`; hidden reasoning text is not printed.
- `--allowed-tools` pre-approves listed tools and is required for Bash, `WebFetch`, and `WebSearch` unless manifest `allowBash: true` applies to Bash. `--disallowed-tools` always wins over allowed/default policy.
- `--max-budget-usd` stops a query if the SDK reports that the cost budget has been exceeded.
- Claude CLI fallback receives the same permission, tool pre-approval/block, and budget options where the installed `claude` CLI supports them. Because `claude -p` is non-interactive here, the runner passes pre-approved read/workflow/subagent/edit tools and relies on policies that avoid mid-run prompts; interactive approval and clarifying-question handling are not supported in this fallback.
- `--persist-session` keeps SDK session history. In OpenAI mode, history is stored under `.codex-harness/openai-sessions/` inside the selected workspace and `[openai-result]` reports the session id. Codex CLI mode lets `codex exec` keep its own session history; `--resume <session-id>` maps to `codex exec resume <session-id>` and `--continue` maps to `codex exec resume --last`. `--resume-session-at` is not supported by Codex CLI mode.
- OpenAI tracing is opt-in with `CODEX_HARNESS_OPENAI_TRACING=1`; trace export is configured with `traceIncludeSensitiveData: false` so tool inputs, prompts, and secrets are not intentionally exported.

Claude SDK options follow the Claude Agent SDK behavior documented in the official overview and TypeScript SDK reference: https://code.claude.com/docs/en/agent-sdk/overview

Backend approval and input handling:

| Backend | Approval Handling | User Input Handling |
| --- | --- | --- |
| Claude Agent SDK | Uses `canUseTool` plus `PermissionRequest`/`PreToolUse` hooks to allow read/workflow/subagent tools, allow edit tools only under edit-capable policy, and deny Bash/Web tools unless explicitly allowed. | `AskUserQuestion` is denied with a recoverable non-interactive message. |
| OpenAI Agents SDK | Uses runner-implemented tools. Read tools plus `TodoWrite`/`ExitPlanMode` are exposed by default; write/Bash tools use `needsApproval`, `streamed.interruptions`, `state.approve()`, and `state.reject()`. Claude `Task`/`Agent` subagent preset parity is not exposed by this backend. | Long-lived human approval storage and later resume are out of scope for this runner. |
| Codex CLI | Uses `codex exec --ask-for-approval never` with `read-only` or `workspace-write` sandbox based on permission mode. Codex CLI uses its own tool/runtime policy, so Claude preset workflow/subagent allow-list parity is not injected. | Mid-run approval UI and clarifying prompts are not handled by the external runner. |
| Claude CLI | Uses `claude -p` with permission mode plus explicit allowed/disallowed tools so normal workflow, subagent, and write runs do not ask. | Mid-run interactive input is not handled in non-interactive `-p` mode. |

The runner only receives the environment variable name, not the credential value. Do not put provider keys in prompts, command history examples, README edits, or plugin manifests.

## Agent-Specific Provider Routing

Agent routing is controlled by the env-only provider manifest. The checked-in manifest names environment variables only; it does not store provider URLs or credentials. The default path is `config/agent-providers.json`; `config/agent-provider.json` is also accepted as a compatibility fallback when the plural file is absent. Each entry can name a `modeEnv` so `.env.local` files can select the backend per agent without editing JSON. Supported mode env values are `claudeCli`, `codexCli`, `anthropic`, `openai`, and `external`. `anthropic` and `openai` are aliases for `mode: "external"` plus the matching SDK. By default, checked-in agents use the Claude CLI fallback path for Max/Pro-compatible usage. Set an agent's mode env to `external`, `anthropic`, `openai`, or `codexCli` when that agent should leave the default Claude CLI path. If external provider env is incomplete or execution fails, the runner falls back to the main Claude CLI harness. External entries can also name an optional `sdkEnv` so `.env.local` files can declare the protocol next to the base URL/model/key. SDK selection priority is `--sdk`, then an `anthropic`/`openai` mode env alias, then agent-specific `sdkEnv`, then `CODEX_HARNESS_SDK`, then manifest `sdk`, then `anthropic`. Codex CLI entries use `mode: "codexCli"` and do not require a base URL or credential.

Default routing:

| Agent | Default SDK/mode | Backend selector env | Required env vars for external mode |
| --- | --- | --- | --- |
| `codex-main` | Anthropic / Claude CLI fallback with `sonnet`/`high` | `CODEX_HARNESS_CODEX_MAIN_MODE` | Provider env only when mode env selects external routing |
| `context-explorer` | Anthropic / external when configured, otherwise main Claude CLI fallback with `haiku`/`low` | `CODEX_HARNESS_CONTEXT_EXPLORER_MODE` | `CODEX_HARNESS_CONTEXT_EXPLORER_SDK`, `CODEX_HARNESS_CONTEXT_EXPLORER_BASE_URL`, `CODEX_HARNESS_CONTEXT_EXPLORER_API_KEY`, `CODEX_HARNESS_CONTEXT_EXPLORER_MODEL` |
| `implementation-worker` | Anthropic / Claude CLI fallback with `sonnet`/`medium` | `CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE` | `CODEX_HARNESS_IMPLEMENTATION_WORKER_SDK`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_BASE_URL`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_API_KEY`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_MODEL`; for Codex CLI use optional `CODEX_HARNESS_IMPLEMENTATION_WORKER_CODEX_MODEL`, `CODEX_HARNESS_IMPLEMENTATION_WORKER_CODEX_PROFILE` |
| `code-reviewer` | Anthropic / external when configured, otherwise main Claude CLI fallback with `sonnet`/`high` | `CODEX_HARNESS_CODE_REVIEWER_MODE` | `CODEX_HARNESS_CODE_REVIEWER_SDK`, `CODEX_HARNESS_CODE_REVIEWER_BASE_URL`, `CODEX_HARNESS_CODE_REVIEWER_API_KEY`, `CODEX_HARNESS_CODE_REVIEWER_MODEL` |
| `verification-auditor` | Anthropic / external when configured, otherwise main Claude CLI fallback with `opus`/`max` | `CODEX_HARNESS_VERIFICATION_AUDITOR_MODE` | `CODEX_HARNESS_VERIFICATION_AUDITOR_SDK`, `CODEX_HARNESS_VERIFICATION_AUDITOR_BASE_URL`, `CODEX_HARNESS_VERIFICATION_AUDITOR_API_KEY`, `CODEX_HARNESS_VERIFICATION_AUDITOR_MODEL` |

For Max/Pro-compatible usage, leave those mode env vars unset or set the agent's mode env to `claudeCli`. Dry-run output should show `mode` as `claudeCli`, `fallbackAgent` as `codex-harness:codex-main`, and `fallbackReason` as `agent configured for Claude CLI`. To try an external provider for a specific agent, set that agent's mode env to `external`, `anthropic`, or `openai` and provide the matching provider env vars.

Dry-run a single agent without calling any API:

```bash
node scripts/run-agent-sdk.mjs --agent context-explorer --dry-run --prompt "probe"
```

Configure one agent on Linux or macOS. If all required provider env vars are set, this uses the external Anthropic-compatible provider for that agent:

```bash
export CODEX_HARNESS_CONTEXT_EXPLORER_BASE_URL="https://provider.example/anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_MODE="anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_SDK="anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_CONTEXT_EXPLORER_MODEL="provider-small"
node scripts/run-agent-sdk.mjs --agent context-explorer --prompt "Map the files involved"
```

Configure one agent on PowerShell:

```powershell
$env:CODEX_HARNESS_CODE_REVIEWER_BASE_URL = "https://provider.example/anthropic"
$env:CODEX_HARNESS_CODE_REVIEWER_MODE = "anthropic"
$env:CODEX_HARNESS_CODE_REVIEWER_SDK = "anthropic"
$env:CODEX_HARNESS_CODE_REVIEWER_API_KEY = "set-in-your-shell"
$env:CODEX_HARNESS_CODE_REVIEWER_MODEL = "provider-review-model"
node scripts/run-agent-sdk.mjs --agent code-reviewer --prompt "Review the current change"
```

Select the OpenAI SDK backend for a one-off OpenAI-compatible provider run:

```bash
export CODEX_HARNESS_BASE_URL="https://provider.example/v1"
export CODEX_HARNESS_SDK="openai"
export OPENAI_COMPAT_API_KEY="set-in-your-shell"
node scripts/run-agent-sdk.mjs --sdk openai --api-key-env OPENAI_COMPAT_API_KEY --model provider-coder --agent context-explorer --prompt "Map the files involved"
```

Or configure it per agent in `config/agent-providers.json`:

```json
{
  "sdk": "openai",
  "sdkEnv": "OPENAI_COMPAT_SDK",
  "modeEnv": "OPENAI_COMPAT_MODE",
  "mode": "external",
  "baseUrlEnv": "OPENAI_COMPAT_BASE_URL",
  "credential": { "type": "apiKey", "env": "OPENAI_COMPAT_API_KEY" },
  "modelEnv": "OPENAI_COMPAT_CODER_MODEL",
  "fallbackModel": "sonnet",
  "effort": "medium"
}
```

Configure a Codex CLI backend per agent without API credentials:

```json
{
  "mode": "codexCli",
  "model": "gpt-5.2",
  "codexProfileEnv": "CODEX_HARNESS_IMPLEMENTATION_WORKER_CODEX_PROFILE",
  "codexModelEnv": "CODEX_HARNESS_IMPLEMENTATION_WORKER_CODEX_MODEL",
  "fallbackModel": "sonnet",
  "effort": "medium"
}
```

Or switch an existing manifest entry at runtime with only an environment variable:

```bash
export CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE="codexCli"
export CODEX_HARNESS_CODE_REVIEWER_MODE="openai"
export CODEX_HARNESS_VERIFICATION_AUDITOR_MODE="claudeCli"
```

Configure different providers per agent by setting different env var groups:

```bash
export CODEX_HARNESS_CONTEXT_EXPLORER_BASE_URL="https://provider-a.example/anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_MODE="anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_SDK="anthropic"
export CODEX_HARNESS_CONTEXT_EXPLORER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_CONTEXT_EXPLORER_MODEL="provider-a-small"

export CODEX_HARNESS_IMPLEMENTATION_WORKER_BASE_URL="https://provider-b.example/anthropic"
export CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE="anthropic"
export CODEX_HARNESS_IMPLEMENTATION_WORKER_SDK="anthropic"
export CODEX_HARNESS_IMPLEMENTATION_WORKER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_IMPLEMENTATION_WORKER_MODEL="provider-b-coder"

export CODEX_HARNESS_CODE_REVIEWER_BASE_URL="https://provider-c.example/anthropic"
export CODEX_HARNESS_CODE_REVIEWER_MODE="anthropic"
export CODEX_HARNESS_CODE_REVIEWER_SDK="anthropic"
export CODEX_HARNESS_CODE_REVIEWER_API_KEY="set-in-your-shell"
export CODEX_HARNESS_CODE_REVIEWER_MODEL="provider-c-review"
```

Run multiple agents in sequence, allowing each agent to choose its own external provider, Codex CLI backend, or main Claude CLI fallback:

```bash
node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,implementation-worker,code-reviewer --prompt "Implement and review this change"
```

Real sequence runs emit `[sequence-start]` and `[sequence-result]` around each agent. The agent's own backend still emits its normal `[openai-*]`, `[sdk-*]`, `[codex-*]`, or `[fallback-*]` markers inside that step.

Check routing before a real run:

```bash
node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,implementation-worker,code-reviewer --dry-run --prompt "probe"
```

Each dry-run line is sanitized. It shows the selected `agent`, `sdk`, `mode`, `model`, `effort`, main CLI fallback target, configured env var names including `sdkEnv`, Codex profile/model env names, approval/user-input handling flags, Codex sandbox/approval mapping, write/Bash tool exposure, and fallback reason when one applies. It never prints credential values.

In sequence dry-runs, the printed `permissionMode`, `handlesApprovals`, `handlesUserInput`, `nonInteractiveApproval`, `writeTools`, `bashTool`, `sandbox`, and `approvalPolicy` are the effective per-agent values after role presets and agent-specific permission env overrides.

The fallback prompt is sent back through the main harness agent, not through an external subagent. It includes the requested agent name, the sanitized fallback reason, and the original task so the main Claude Code CLI session can apply the same role and complexity policy. If an Opus fallback run fails because the account needs usage credits for 1M context, the runner retries once with `sonnet` and `high` effort for standard-context compatibility.

## Agents

The harness defines these Claude Code agents:

- `context-explorer`: Read-only repository exploration for specific questions. Uses `haiku` with `low` effort.
- `implementation-worker`: Bounded implementation with clear file ownership. Uses `sonnet` with `medium` effort.
- `code-reviewer`: Bug, regression, security, and test-gap review. Uses `sonnet` with `high` effort.
- `verification-auditor`: Completion audit against concrete evidence. Uses `opus` with `max` effort.
- `codex-main`: Plugin main-thread agent for the full harness behavior. Uses `sonnet` with `high` effort when no external provider is configured.

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
- `sonnet` + `high`: default main-thread harness behavior and difficult bounded implementation when no external provider is configured.
- `opus` + `xhigh`: complex planning, review, and verification commands.
- `opus` + `max`: completion auditor surfaces that previously used Opus and now get the highest thinking level.
- `ultrathink`: reserved for explicit one-off deep reasoning requests after the user has enabled the required Claude Code usage credits or selected a compatible model.

The checked-in `codex-main` default stays on `sonnet` with `high` effort for Claude Code Max/Pro users when no external provider is configured. Complex commands intentionally use Opus; if your account cannot run those settings, switch models manually with `/model`, enable usage credits, or use `/codex-harness:implement` for standard-context implementation work.

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
- `scripts/run-agent-sdk.mjs`: Generic multi-SDK runner for Anthropic-compatible and OpenAI-compatible providers.
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
Checked 45 required files.
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
