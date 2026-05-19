$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".github/workflows/harness-validation.yml",
  ".claude-plugin/marketplace.json",
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
  ".claude-plugin/marketplace.json",
  ".claude/settings.json",
  "plugins/codex-harness/.claude-plugin/plugin.json",
  "plugins/codex-harness/settings.json"
)

foreach ($relativePath in $jsonFiles) {
  $path = Join-Path $root $relativePath
  Get-Content -LiteralPath $path -Raw | ConvertFrom-Json | Out-Null
}

$marketplace = Get-Content -LiteralPath (Join-Path $root ".claude-plugin/marketplace.json") -Raw | ConvertFrom-Json
if ($marketplace.name -ne "codex4claude") {
  Write-Error "Expected marketplace name to be codex4claude."
}
if (-not $marketplace.owner -or $marketplace.owner.name -ne "lcy2080") {
  Write-Error "Expected marketplace owner name to be lcy2080."
}
$marketplacePlugin = $marketplace.plugins | Where-Object { $_.name -eq "codex-harness" } | Select-Object -First 1
if (-not $marketplacePlugin) {
  Write-Error "Expected marketplace to include codex-harness plugin."
}
if ($marketplacePlugin.source -ne "./plugins/codex-harness") {
  Write-Error "Expected codex-harness source to be ./plugins/codex-harness."
}
if (-not (Test-Path -LiteralPath (Join-Path $root "plugins/codex-harness") -PathType Container)) {
  Write-Error "Marketplace codex-harness source directory is missing."
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

$effortFiles = @(
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
  "plugins/codex-harness/skills/handoff-note/SKILL.md"
)

foreach ($relativePath in $effortFiles) {
  $path = Join-Path $root $relativePath
  $content = Get-Content -LiteralPath $path -Raw
  if ($content -notmatch "(?m)^effort:\s+(low|medium|high|xhigh|max)\s*$") {
    Write-Error "Missing or unsupported effort assignment: $relativePath"
  }
}

$projectSettings = Get-Content -LiteralPath (Join-Path $root ".claude/settings.json") -Raw | ConvertFrom-Json
if ($projectSettings.model -ne "sonnet") {
  Write-Error "Expected .claude/settings.json model to be sonnet."
}
if ($projectSettings.effortLevel -ne "medium") {
  Write-Error "Expected .claude/settings.json effortLevel to be medium."
}
$allowList = @($projectSettings.permissions.allow)
$askList = @($projectSettings.permissions.ask)
if ($allowList -contains "Bash(rg:*)") {
  Write-Error "Bash(rg:*) must not be auto-allowed because it can bypass file-read deny rules."
}
if ($allowList -contains "Bash(pwsh -File scripts/verify-harness.ps1)") {
  Write-Error "Workspace verifier execution must not be auto-allowed."
}
if ($askList -notcontains "Bash(rg:*)") {
  Write-Error "Expected Bash(rg:*) to require approval."
}
if ($askList -notcontains "Bash(pwsh -File scripts/verify-harness.ps1)") {
  Write-Error "Expected verifier execution to require approval."
}

$workflowPath = Join-Path $root ".github/workflows/harness-validation.yml"
$workflowContent = Get-Content -LiteralPath $workflowPath -Raw
if ($workflowContent -notmatch "name:\s+Harness Validation") {
  Write-Error "Expected Harness Validation workflow name."
}
if ($workflowContent -notmatch "name:\s+Harness validation") {
  Write-Error "Expected Harness validation job name."
}
if ($workflowContent -notmatch "pwsh -File scripts/verify-harness\.ps1") {
  Write-Error "Expected workflow to run the harness verifier."
}
if ($workflowContent -notmatch "claude plugin validate \.") {
  Write-Error "Expected workflow to validate marketplace manifest."
}
if ($workflowContent -notmatch "claude plugin validate plugins/codex-harness") {
  Write-Error "Expected workflow to validate plugin manifest."
}

Write-Host "Harness verification passed."
Write-Host "Checked $($requiredFiles.Count) required files."
