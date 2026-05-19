#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$script_dir/.." && pwd)

required_files='
README.md
AGENTS.md
CLAUDE.md
.env.local.example
package.json
config/agent-providers.json
.github/workflows/harness-validation.yml
.claude-plugin/marketplace.json
.claude/settings.json
.claude/output-styles/codex-harness.md
.claude/commands/plan.md
.claude/commands/implement.md
.claude/commands/review.md
.claude/commands/verify.md
.claude/commands/handoff.md
.claude/commands/external-agent.md
.claude/agents/context-explorer.md
.claude/agents/implementation-worker.md
.claude/agents/code-reviewer.md
.claude/agents/verification-auditor.md
.claude/skills/completion-audit/SKILL.md
.claude/skills/surgical-editing/SKILL.md
.claude/skills/context-triage/SKILL.md
.claude/skills/handoff-note/SKILL.md
plugins/codex-harness/.claude-plugin/plugin.json
plugins/codex-harness/settings.json
plugins/codex-harness/output-styles/codex-harness.md
plugins/codex-harness/agents/codex-main.md
plugins/codex-harness/agents/context-explorer.md
plugins/codex-harness/agents/implementation-worker.md
plugins/codex-harness/agents/code-reviewer.md
plugins/codex-harness/agents/verification-auditor.md
plugins/codex-harness/commands/plan.md
plugins/codex-harness/commands/implement.md
plugins/codex-harness/commands/review.md
plugins/codex-harness/commands/verify.md
plugins/codex-harness/commands/handoff.md
plugins/codex-harness/commands/external-agent.md
plugins/codex-harness/skills/completion-audit/SKILL.md
plugins/codex-harness/skills/surgical-editing/SKILL.md
plugins/codex-harness/skills/context-triage/SKILL.md
plugins/codex-harness/skills/handoff-note/SKILL.md
scripts/verify-harness.ps1
scripts/verify-harness.sh
scripts/run-agent-sdk.mjs
'

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

count=0
for relative_path in $required_files; do
  count=$((count + 1))
  [ -f "$root/$relative_path" ] || fail "Missing required file: $relative_path"
done

python_cmd=
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import json, pathlib, re, sys' >/dev/null 2>&1; then
    python_cmd=$candidate
    break
  fi
done
[ -n "$python_cmd" ] || fail "Python 3 is required for JSON validation."

"$python_cmd" - "$root" <<'PY'
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])

def read(path):
    return (root / path).read_text(encoding="utf-8")

def fail(message):
    raise SystemExit(message)

json_files = [
    ".claude-plugin/marketplace.json",
    "package.json",
    "config/agent-providers.json",
    ".claude/settings.json",
    "plugins/codex-harness/.claude-plugin/plugin.json",
    "plugins/codex-harness/settings.json",
]
for path in json_files:
    json.loads(read(path))

marketplace = json.loads(read(".claude-plugin/marketplace.json"))
if marketplace.get("name") != "codex4claude":
    fail("Expected marketplace name to be codex4claude.")
if marketplace.get("owner", {}).get("name") != "lcy2080":
    fail("Expected marketplace owner name to be lcy2080.")
plugin = next((item for item in marketplace.get("plugins", []) if item.get("name") == "codex-harness"), None)
if not plugin:
    fail("Expected marketplace to include codex-harness plugin.")
if plugin.get("source") != "./plugins/codex-harness":
    fail("Expected codex-harness source to be ./plugins/codex-harness.")
if not (root / "plugins/codex-harness").is_dir():
    fail("Marketplace codex-harness source directory is missing.")

package = json.loads(read("package.json"))
if "@anthropic-ai/claude-agent-sdk" not in package.get("dependencies", {}):
    fail("Expected package.json to depend on @anthropic-ai/claude-agent-sdk.")
for dependency_name in ["@openai/agents", "openai", "zod"]:
    if dependency_name not in package.get("dependencies", {}):
        fail(f"Expected package.json to depend on {dependency_name}.")

provider_config = json.loads(read("config/agent-providers.json"))
for agent_name in ["codex-main", "context-explorer", "implementation-worker", "code-reviewer", "verification-auditor"]:
    entry = provider_config.get("agents", {}).get(agent_name)
    if not entry:
        fail(f"Expected provider config entry for {agent_name}.")
    if entry.get("mode") not in {"external", "claudeCli", "codexCli"}:
        fail(f"Unsupported provider mode for {agent_name}.")
    if entry.get("sdk") and entry.get("sdk") not in {"anthropic", "openai"}:
        fail(f"Unsupported provider sdk for {agent_name}.")
    if entry.get("sdkEnv") and not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", entry.get("sdkEnv")):
        fail(f"Invalid sdkEnv in provider config for {agent_name}.")
    if entry.get("mode") == "external":
        for env_name in [entry.get("sdkEnv"), entry.get("baseUrlEnv"), entry.get("credential", {}).get("env"), entry.get("modelEnv")]:
            if env_name and not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", env_name):
                fail(f"Invalid env var name in provider config for {agent_name}.")
        if entry.get("credential", {}).get("type") not in {"apiKey", "authToken"}:
            fail(f"Unsupported credential type for {agent_name}.")
codex_cli_provider = provider_config.get("agents", {}).get("codex-implementation-worker", {})
if codex_cli_provider.get("mode") != "codexCli":
    fail("Expected codex-implementation-worker provider to use codexCli mode.")
for env_name in [codex_cli_provider.get("modelEnv"), codex_cli_provider.get("codexModelEnv"), codex_cli_provider.get("codexProfileEnv")]:
    if env_name and not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", env_name):
        fail("Invalid Codex CLI env var name in provider config.")
codex_main_provider = provider_config.get("agents", {}).get("codex-main", {})
if codex_main_provider.get("model") != "sonnet" or codex_main_provider.get("effort") != "high":
    fail("Expected codex-main provider fallback to use sonnet with high effort.")
verification_auditor_provider = provider_config.get("agents", {}).get("verification-auditor", {})
if verification_auditor_provider.get("model") != "opus" or verification_auditor_provider.get("effort") != "max":
    fail("Expected verification-auditor provider fallback to use opus with max effort.")
for agent_name, fallback_model in {
    "context-explorer": "haiku",
    "implementation-worker": "sonnet",
    "code-reviewer": "sonnet",
    "verification-auditor": "opus",
}.items():
    if provider_config.get("agents", {}).get(agent_name, {}).get("fallbackModel") != fallback_model:
        fail(f"Expected {agent_name} provider fallbackModel to be {fallback_model}.")

sdk_runner = read("scripts/run-agent-sdk.mjs")
for expected in [
    "@anthropic-ai/claude-agent-sdk",
    "@openai/agents",
    "OpenAIProvider",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CODEX_HARNESS_BASE_URL",
    "CODEX_HARNESS_SDK",
    "CODEX_HARNESS_CODE_REVIEWER_SDK",
    "sdkEnv",
    "CODEX_HARNESS_AGENT_PROVIDER_CONFIG",
    "plugins/codex-harness",
    "--agent-provider-config",
    "--agent-sequence",
    "--sdk",
    "--dry-run",
    "--no-fallback",
    "--permission-mode",
    "--effort",
    "--overall-timeout-ms",
    "--max-budget-usd",
    "--allowed-tools",
    "--disallowed-tools",
    "--max-budget-usd",
    "--resume",
    "--continue",
    "--persist-session",
    "--output-format",
    "stream-json",
    "[fallback-progress]",
    "[openai-init]",
    "[openai-tool-",
    "[openai-progress]",
    "[openai-result]",
    "codexCli",
    "runCodexCli",
    "[codex-result]",
    "codex exec",
    "--ask-for-approval",
    "--sandbox",
    "[sequence-start]",
    "[sequence-result]",
    "MemorySession",
    "OPENAI_SESSION_DIR",
    "traceIncludeSensitiveData: false",
    "Read",
    "MultiEdit",
    "runOpenAiSdk",
    "-tool-input]",
    "-message-start]",
    "handleStreamEvent",
    "Claude CLI fallback",
    "codex-harness:codex-main",
    "fallbackAgent",
    "fallback-retry",
]:
    if expected not in sdk_runner:
        fail(f"Expected SDK runner to contain: {expected}")

frontmatter_files = [
    ".claude/output-styles/codex-harness.md",
    ".claude/commands/plan.md",
    ".claude/commands/implement.md",
    ".claude/commands/review.md",
    ".claude/commands/verify.md",
    ".claude/commands/handoff.md",
    ".claude/commands/external-agent.md",
    ".claude/agents/context-explorer.md",
    ".claude/agents/implementation-worker.md",
    ".claude/agents/code-reviewer.md",
    ".claude/agents/verification-auditor.md",
    ".claude/skills/completion-audit/SKILL.md",
    ".claude/skills/surgical-editing/SKILL.md",
    ".claude/skills/context-triage/SKILL.md",
    ".claude/skills/handoff-note/SKILL.md",
    "plugins/codex-harness/output-styles/codex-harness.md",
    "plugins/codex-harness/agents/codex-main.md",
    "plugins/codex-harness/agents/context-explorer.md",
    "plugins/codex-harness/agents/implementation-worker.md",
    "plugins/codex-harness/agents/code-reviewer.md",
    "plugins/codex-harness/agents/verification-auditor.md",
    "plugins/codex-harness/commands/plan.md",
    "plugins/codex-harness/commands/implement.md",
    "plugins/codex-harness/commands/review.md",
    "plugins/codex-harness/commands/verify.md",
    "plugins/codex-harness/commands/handoff.md",
    "plugins/codex-harness/commands/external-agent.md",
    "plugins/codex-harness/skills/completion-audit/SKILL.md",
    "plugins/codex-harness/skills/surgical-editing/SKILL.md",
    "plugins/codex-harness/skills/context-triage/SKILL.md",
    "plugins/codex-harness/skills/handoff-note/SKILL.md",
]
for path in frontmatter_files:
    if not re.search(r"(?s)^---\s+.+?\s+---", read(path)):
        fail(f"Missing frontmatter: {path}")

model_files = [
    ".claude/agents/context-explorer.md",
    ".claude/agents/implementation-worker.md",
    ".claude/agents/code-reviewer.md",
    ".claude/agents/verification-auditor.md",
    ".claude/commands/plan.md",
    ".claude/commands/implement.md",
    ".claude/commands/review.md",
    ".claude/commands/verify.md",
    ".claude/commands/handoff.md",
    ".claude/commands/external-agent.md",
    "plugins/codex-harness/agents/codex-main.md",
    "plugins/codex-harness/agents/context-explorer.md",
    "plugins/codex-harness/agents/implementation-worker.md",
    "plugins/codex-harness/agents/code-reviewer.md",
    "plugins/codex-harness/agents/verification-auditor.md",
    "plugins/codex-harness/commands/plan.md",
    "plugins/codex-harness/commands/implement.md",
    "plugins/codex-harness/commands/review.md",
    "plugins/codex-harness/commands/verify.md",
    "plugins/codex-harness/commands/handoff.md",
    "plugins/codex-harness/commands/external-agent.md",
]
for path in model_files:
    if not re.search(r"(?m)^model:\s+(haiku|sonnet|opus|inherit)\s*$", read(path)):
        fail(f"Missing or unsupported model assignment: {path}")

codex_main = read("plugins/codex-harness/agents/codex-main.md")
if not re.search(r"(?m)^model:\s+sonnet\s*$", codex_main) or not re.search(r"(?m)^effort:\s+high\s*$", codex_main):
    fail("Expected plugin codex-main to use sonnet with high effort for standard context compatibility.")

effort_files = [
    ".claude/agents/context-explorer.md",
    ".claude/agents/implementation-worker.md",
    ".claude/agents/code-reviewer.md",
    ".claude/agents/verification-auditor.md",
    ".claude/commands/plan.md",
    ".claude/commands/implement.md",
    ".claude/commands/review.md",
    ".claude/commands/verify.md",
    ".claude/commands/handoff.md",
    ".claude/commands/external-agent.md",
    ".claude/skills/completion-audit/SKILL.md",
    ".claude/skills/surgical-editing/SKILL.md",
    ".claude/skills/context-triage/SKILL.md",
    ".claude/skills/handoff-note/SKILL.md",
    "plugins/codex-harness/agents/codex-main.md",
    "plugins/codex-harness/agents/context-explorer.md",
    "plugins/codex-harness/agents/implementation-worker.md",
    "plugins/codex-harness/agents/code-reviewer.md",
    "plugins/codex-harness/agents/verification-auditor.md",
    "plugins/codex-harness/commands/plan.md",
    "plugins/codex-harness/commands/implement.md",
    "plugins/codex-harness/commands/review.md",
    "plugins/codex-harness/commands/verify.md",
    "plugins/codex-harness/commands/handoff.md",
    "plugins/codex-harness/commands/external-agent.md",
    "plugins/codex-harness/skills/completion-audit/SKILL.md",
    "plugins/codex-harness/skills/surgical-editing/SKILL.md",
    "plugins/codex-harness/skills/context-triage/SKILL.md",
    "plugins/codex-harness/skills/handoff-note/SKILL.md",
]
for path in effort_files:
    if not re.search(r"(?m)^effort:\s+(low|medium|high|xhigh|max)\s*$", read(path)):
        fail(f"Missing or unsupported effort assignment: {path}")

opus_files = [
    ".claude/commands/plan.md",
    ".claude/commands/review.md",
    ".claude/commands/verify.md",
    ".claude/agents/verification-auditor.md",
    "plugins/codex-harness/commands/plan.md",
    "plugins/codex-harness/commands/review.md",
    "plugins/codex-harness/commands/verify.md",
    "plugins/codex-harness/agents/verification-auditor.md",
]
for path in opus_files:
    if not re.search(r"(?m)^model:\s+opus\s*$", read(path)):
        fail(f"Expected complex/deep surface to use opus: {path}")

max_effort_files = [
    ".claude/agents/verification-auditor.md",
    ".claude/skills/completion-audit/SKILL.md",
    "plugins/codex-harness/agents/verification-auditor.md",
    "plugins/codex-harness/skills/completion-audit/SKILL.md",
]
for path in max_effort_files:
    if not re.search(r"(?m)^effort:\s+max\s*$", read(path)):
        fail(f"Expected opus auditor surface to use max effort: {path}")

xhigh_effort_files = [
    ".claude/commands/plan.md",
    ".claude/commands/review.md",
    ".claude/commands/verify.md",
    "plugins/codex-harness/commands/plan.md",
    "plugins/codex-harness/commands/review.md",
    "plugins/codex-harness/commands/verify.md",
]
for path in xhigh_effort_files:
    if not re.search(r"(?m)^effort:\s+xhigh\s*$", read(path)):
        fail(f"Expected complex command to use xhigh effort: {path}")


settings = json.loads(read(".claude/settings.json"))
if settings.get("model") != "sonnet":
    fail("Expected .claude/settings.json model to be sonnet.")
if settings.get("effortLevel") != "medium":
    fail("Expected .claude/settings.json effortLevel to be medium.")
allow = settings.get("permissions", {}).get("allow", [])
ask = settings.get("permissions", {}).get("ask", [])
if "Bash(rg:*)" in allow:
    fail("Bash(rg:*) must not be auto-allowed because it can bypass file-read deny rules.")
if "Bash(pwsh -File scripts/verify-harness.ps1)" in allow:
    fail("Workspace verifier execution must not be auto-allowed.")
if "Bash(rg:*)" not in ask:
    fail("Expected Bash(rg:*) to require approval.")
if "Bash(pwsh -File scripts/verify-harness.ps1)" not in ask:
    fail("Expected verifier execution to require approval.")

workflow = read(".github/workflows/harness-validation.yml")
for expected in [
    "name: Harness Validation",
    "name: Harness validation",
    "sh scripts/verify-harness.sh",
    "pwsh -File scripts/verify-harness.ps1",
    "npm install",
    "node scripts/run-agent-sdk.mjs --help",
    "node scripts/run-agent-sdk.mjs --agent context-explorer --dry-run",
    "node scripts/run-agent-sdk.mjs --agent-sequence context-explorer,code-reviewer --dry-run",
    "claude plugin validate .",
    "claude plugin validate plugins/codex-harness",
]:
    if expected not in workflow:
        fail(f"Expected workflow to contain: {expected}")

secret_patterns = [
    re.compile(r"(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"your_real_api_key"),
    re.compile(r"paste_your_api_key"),
]
for scan_root in [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "package.json",
    "config/agent-providers.json",
    ".github",
    ".claude-plugin",
    ".claude",
    "plugins/codex-harness",
    "scripts",
]:
    candidate = root / scan_root
    paths = [candidate] if candidate.is_file() else candidate.rglob("*")
    for path in paths:
        if not path.is_file() or not re.search(r"\.(md|mjs|json|yml|yaml|ps1|sh)$", path.name):
            continue
        if path.name in {"verify-harness.ps1", "verify-harness.sh"}:
            continue
        content = path.read_text(encoding="utf-8")
        for pattern in secret_patterns:
            if pattern.search(content):
                fail(f"Potential hardcoded secret example in {path.relative_to(root)} matching {pattern.pattern}")
PY

printf 'Harness verification passed.\n'
printf 'Checked %s required files.\n' "$count"
