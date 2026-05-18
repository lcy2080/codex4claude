$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/settings.json",
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
  "plugins/codex-harness/.claude-plugin/plugin.json",
  "plugins/codex-harness/settings.json",
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
  "plugins/codex-harness/skills/handoff-note/SKILL.md"
)

$missing = @()
foreach ($relativePath in $requiredFiles) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    $missing += $relativePath
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing required files:`n" + ($missing -join "`n"))
}

$jsonFiles = @(
  ".claude/settings.json",
  "plugins/codex-harness/.claude-plugin/plugin.json",
  "plugins/codex-harness/settings.json"
)

foreach ($relativePath in $jsonFiles) {
  $path = Join-Path $root $relativePath
  Get-Content -LiteralPath $path -Raw | ConvertFrom-Json | Out-Null
}

$frontmatterFiles = $requiredFiles | Where-Object { $_ -like "*.md" -and $_ -ne "README.md" -and $_ -ne "AGENTS.md" -and $_ -ne "CLAUDE.md" -and $_ -ne "plugins/codex-harness/README.md" }
foreach ($relativePath in $frontmatterFiles) {
  $path = Join-Path $root $relativePath
  $content = Get-Content -LiteralPath $path -Raw
  if ($content -notmatch "(?s)^---\s+.+?\s+---") {
    Write-Error "Missing frontmatter: $relativePath"
  }
}

$modelFiles = @(
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
  "plugins/codex-harness/commands/handoff.md"
)

foreach ($relativePath in $modelFiles) {
  $path = Join-Path $root $relativePath
  $content = Get-Content -LiteralPath $path -Raw
  if ($content -notmatch "(?m)^model:\s+(haiku|sonnet|opus|inherit)\s*$") {
    Write-Error "Missing or unsupported model assignment: $relativePath"
  }
}

$projectSettings = Get-Content -LiteralPath (Join-Path $root ".claude/settings.json") -Raw | ConvertFrom-Json
if ($projectSettings.model -ne "sonnet") {
  Write-Error "Expected .claude/settings.json model to be sonnet."
}

Write-Host "Harness verification passed."
Write-Host "Checked $($requiredFiles.Count) required files."
