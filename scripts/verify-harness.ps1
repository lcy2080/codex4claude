$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "config/agent-providers.json",
  ".github/workflows/harness-validation.yml",
  "scripts/verify-harness.ps1",
  "scripts/verify-harness.sh",
  "scripts/run-agent-sdk.mjs",
  ".claude-plugin/marketplace.json",
  ".claude/settings.json",
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
  "plugins/codex-harness/commands/external-agent.md",
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
  "package.json",
  "config/agent-providers.json",
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

$package = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw | ConvertFrom-Json
if (-not $package.dependencies -or -not $package.dependencies.PSObject.Properties.Name.Contains("@anthropic-ai/claude-agent-sdk")) {
  Write-Error "Expected package.json to depend on @anthropic-ai/claude-agent-sdk."
}

$providerConfig = Get-Content -LiteralPath (Join-Path $root "config/agent-providers.json") -Raw | ConvertFrom-Json
$requiredProviderAgents = @("codex-main", "context-explorer", "implementation-worker", "code-reviewer", "verification-auditor")
foreach ($agentName in $requiredProviderAgents) {
  $entry = $providerConfig.agents.PSObject.Properties[$agentName].Value
  if (-not $entry) {
    Write-Error "Expected provider config entry for $agentName."
  }
  if ($entry.mode -notin @("external", "claudeCli")) {
    Write-Error "Unsupported provider mode for $agentName."
  }
  if ($entry.mode -eq "external") {
    $envFields = @($entry.baseUrlEnv, $entry.credential.env, $entry.modelEnv) | Where-Object { $_ }
    foreach ($envName in $envFields) {
      if ($envName -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
        Write-Error "Invalid env var name in provider config for $agentName."
      }
    }
    if ($entry.credential.type -notin @("apiKey", "authToken")) {
      Write-Error "Unsupported credential type for $agentName."
    }
  }
}

$sdkRunnerContent = Get-Content -LiteralPath (Join-Path $root "scripts/run-agent-sdk.mjs") -Raw
$sdkRunnerExpected = @(
  "@anthropic-ai/claude-agent-sdk",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CODEX_HARNESS_BASE_URL",
  "CODEX_HARNESS_AGENT_PROVIDER_CONFIG",
  "plugins/codex-harness",
  "--agent-provider-config",
  "--agent-sequence",
  "--dry-run",
  "Claude CLI fallback"
)
foreach ($expected in $sdkRunnerExpected) {
  if ($sdkRunnerContent -notmatch [regex]::Escape($expected)) {
    Write-Error "Expected SDK runner to contain: $expected"
  }
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
  "plugins/codex-harness/commands/external-agent.md"
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
if ($workflowContent -notmatch "sh scripts/verify-harness\.sh") {
  Write-Error "Expected workflow to run the POSIX shell verifier."
}
if ($workflowContent -notmatch "pwsh -File scripts/verify-harness\.ps1") {
  Write-Error "Expected workflow to run the harness verifier."
}
if ($workflowContent -notmatch "npm install") {
  Write-Error "Expected workflow to install npm dependencies."
}
if ($workflowContent -notmatch "node scripts/run-agent-sdk\.mjs --help") {
  Write-Error "Expected workflow to validate SDK runner help."
}
if ($workflowContent -notmatch "node scripts/run-agent-sdk\.mjs --agent context-explorer --dry-run") {
  Write-Error "Expected workflow to validate single-agent provider dry-run."
}
if ($workflowContent -notmatch "node scripts/run-agent-sdk\.mjs --agent-sequence context-explorer,code-reviewer --dry-run") {
  Write-Error "Expected workflow to validate provider sequence dry-run."
}
if ($workflowContent -notmatch "claude plugin validate \.") {
  Write-Error "Expected workflow to validate marketplace manifest."
}
if ($workflowContent -notmatch "claude plugin validate plugins/codex-harness") {
  Write-Error "Expected workflow to validate plugin manifest."
}

$secretScanFiles = $requiredFiles | Where-Object { $_ -match "\.(md|mjs|json|yml|yaml|ps1|sh)$" -and $_ -notlike "scripts/verify-harness.*" }
$secretPatterns = @(
  "sk-[A-Za-z0-9_-]{12,}",
  "your_real_api_key",
  "paste_your_api_key"
)
foreach ($relativePath in $secretScanFiles) {
  $content = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
  foreach ($pattern in $secretPatterns) {
    if ($content -match $pattern) {
      Write-Error "Potential hardcoded secret example in $relativePath matching $pattern"
    }
  }
}

Write-Host "Harness verification passed."
Write-Host "Checked $($requiredFiles.Count) required files."
