#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$script_dir/.." && pwd)

required_files='
README.md
AGENTS.md
CLAUDE.md
.github/workflows/harness-validation.yml
.claude-plugin/marketplace.json
.claude/settings.json
.claude/output-styles/codex-harness.md
.claude/commands/plan.md
.claude/commands/implement.md
.claude/commands/review.md
.claude/commands/verify.md
.claude/commands/handoff.md
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
plugins/codex-harness/skills/completion-audit/SKILL.md
plugins/codex-harness/skills/surgical-editing/SKILL.md
plugins/codex-harness/skills/context-triage/SKILL.md
plugins/codex-harness/skills/handoff-note/SKILL.md
scripts/verify-harness.ps1
scripts/verify-harness.sh
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
if command -v python3 >/dev/null 2>&1; then
  python_cmd=python3
elif command -v python >/dev/null 2>&1; then
  python_cmd=python
else
  fail "Python 3 is required for JSON validation."
fi

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

frontmatter_files = [
    ".claude/output-styles/codex-harness.md",
    ".claude/commands/plan.md",
    ".claude/commands/implement.md",
    ".claude/commands/review.md",
    ".claude/commands/verify.md",
    ".claude/commands/handoff.md",
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
]
for path in model_files:
    if not re.search(r"(?m)^model:\s+(haiku|sonnet|opus|inherit)\s*$", read(path)):
        fail(f"Missing or unsupported model assignment: {path}")

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
    "plugins/codex-harness/skills/completion-audit/SKILL.md",
    "plugins/codex-harness/skills/surgical-editing/SKILL.md",
    "plugins/codex-harness/skills/context-triage/SKILL.md",
    "plugins/codex-harness/skills/handoff-note/SKILL.md",
]
for path in effort_files:
    if not re.search(r"(?m)^effort:\s+(low|medium|high|xhigh|max)\s*$", read(path)):
        fail(f"Missing or unsupported effort assignment: {path}")

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
    "claude plugin validate .",
    "claude plugin validate plugins/codex-harness",
]:
    if expected not in workflow:
        fail(f"Expected workflow to contain: {expected}")
PY

printf 'Harness verification passed.\n'
printf 'Checked %s required files.\n' "$count"
