$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".env.local.example",
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
foreach ($dependencyName in @("@openai/agents", "openai", "zod")) {
  if (-not $package.dependencies.PSObject.Properties.Name.Contains($dependencyName)) {
    Write-Error "Expected package.json to depend on $dependencyName."
  }
}

$providerConfig = Get-Content -LiteralPath (Join-Path $root "config/agent-providers.json") -Raw | ConvertFrom-Json
$requiredProviderAgents = @("codex-main", "context-explorer", "implementation-worker", "code-reviewer", "verification-auditor")
foreach ($agentName in $requiredProviderAgents) {
  $entry = $providerConfig.agents.PSObject.Properties[$agentName].Value
  if (-not $entry) {
    Write-Error "Expected provider config entry for $agentName."
  }
  if ($entry.mode -notin @("external", "claudeCli", "codexCli")) {
    Write-Error "Unsupported provider mode for $agentName."
  }
  if ($entry.sdk -and $entry.sdk -notin @("anthropic", "openai")) {
    Write-Error "Unsupported provider sdk for $agentName."
  }
  if ($entry.sdkEnv -and $entry.sdkEnv -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    Write-Error "Invalid sdkEnv in provider config for $agentName."
  }
  if ($entry.modeEnv -and $entry.modeEnv -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    Write-Error "Invalid modeEnv in provider config for $agentName."
  }
  if ($entry.modelEnv -and -not $entry.model) {
    Write-Error "Expected provider config entry for $agentName to include model when modelEnv is set."
  }
  if ($entry.mode -eq "external") {
    $envFields = @($entry.sdkEnv, $entry.modeEnv, $entry.baseUrlEnv, $entry.credential.env, $entry.modelEnv) | Where-Object { $_ }
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
$codexCliProvider = $providerConfig.agents."implementation-worker"
if (-not $codexCliProvider -or -not $codexCliProvider.codexModelEnv -or -not $codexCliProvider.codexProfileEnv) {
  Write-Error "Expected implementation-worker provider to expose Codex CLI model/profile envs."
}
$codexCliEnvFields = @($codexCliProvider.modeEnv, $codexCliProvider.modelEnv, $codexCliProvider.codexModelEnv, $codexCliProvider.codexProfileEnv) | Where-Object { $_ }
foreach ($envName in $codexCliEnvFields) {
  if ($envName -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    Write-Error "Invalid Codex CLI env var name in provider config."
  }
}
if ($providerConfig.agents."codex-main".model -ne "sonnet" -or $providerConfig.agents."codex-main".effort -ne "high") {
  Write-Error "Expected codex-main provider fallback to use sonnet with high effort."
}
if ($providerConfig.agents."verification-auditor".model -ne "opus" -or $providerConfig.agents."verification-auditor".effort -ne "max") {
  Write-Error "Expected verification-auditor provider fallback to use opus with max effort."
}
$expectedFallbackModels = @{
  "context-explorer" = "haiku"
  "implementation-worker" = "sonnet"
  "code-reviewer" = "sonnet"
  "verification-auditor" = "opus"
}
foreach ($agentName in $expectedFallbackModels.Keys) {
  if ($providerConfig.agents.$agentName.fallbackModel -ne $expectedFallbackModels[$agentName]) {
    Write-Error "Expected $agentName provider fallbackModel to be $($expectedFallbackModels[$agentName])."
  }
}

$sdkRunnerContent = Get-Content -LiteralPath (Join-Path $root "scripts/run-agent-sdk.mjs") -Raw
$sdkRunnerExpected = @(
  "@anthropic-ai/claude-agent-sdk",
  "@openai/agents",
  "OpenAIProvider",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CODEX_HARNESS_BASE_URL",
  "CODEX_HARNESS_SDK",
  "CODEX_HARNESS_CODE_REVIEWER_SDK",
  "CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE",
  "CODEX_HARNESS_CONTEXT_EXPLORER_PERMISSION_MODE",
  "CODEX_HARNESS_IMPLEMENTATION_WORKER_PERMISSION_MODE",
  "CODEX_HARNESS_CODE_REVIEWER_PERMISSION_MODE",
  "CODEX_HARNESS_VERIFICATION_AUDITOR_PERMISSION_MODE",
  "SEQUENCE_ROLE_PERMISSION_PRESETS",
  "effectivePermissionMode",
  "cleanupCodexProcessTree",
  "[codex-cleanup-warning]",
  "modeEnv",
  "sdkEnv",
  "loadLocalEnvFiles",
  ".env.local",
  "CODEX_HARNESS_AGENT_PROVIDER_CONFIG",
  "CODEX_HARNESS_MAX_TURNS",
  "--max-turns <number|none>",
  "config/agent-provider.json",
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
  "[openai-approval-request]",
  "[openai-approval-result]",
  "[openai-progress]",
  "[openai-result]",
  "[sdk-permission-request]",
  "[sdk-permission-result]",
  "[sdk-user-input-denied]",
  "codexCli",
  "runCodexCli",
  "agent_message",
  "command_execution",
  "[codex-result]",
  "codex exec",
  "--ask-for-approval",
  "--sandbox",
  "[sequence-start]",
  "[sequence-result]",
  "MemorySession",
  "OPENAI_SESSION_DIR",
  "needsApproval",
  "streamed.interruptions",
  "state.approve",
  "state.reject",
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
  "fallback-retry"
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

$runnerCommandFiles = @(
  ".claude/commands/plan.md",
  ".claude/commands/implement.md",
  ".claude/commands/review.md",
  ".claude/commands/verify.md",
  ".claude/commands/handoff.md",
  ".claude/commands/external-agent.md",
  "plugins/codex-harness/commands/plan.md",
  "plugins/codex-harness/commands/implement.md",
  "plugins/codex-harness/commands/review.md",
  "plugins/codex-harness/commands/verify.md",
  "plugins/codex-harness/commands/handoff.md",
  "plugins/codex-harness/commands/external-agent.md"
)
$runnerResolutionExpected = @(
  "CODEX_HARNESS_RUNNER_PATH",
  "CODEX_HARNESS_HOME/scripts/run-agent-sdk.mjs",
  "marketplaces\codex4claude\scripts\run-agent-sdk.mjs",
  "marketplaces/codex4claude/scripts/run-agent-sdk.mjs",
  "--cwd <current-workspace>",
  "claude --add-dir <harness-or-marketplace-checkout>"
)
foreach ($relativePath in $runnerCommandFiles) {
  $content = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
  foreach ($expected in $runnerResolutionExpected) {
    if ($content -notmatch [regex]::Escape($expected)) {
      Write-Error "Expected $relativePath to include runner resolution text: $expected"
    }
  }
  if ($content -match "If the runner is unavailable in this workspace") {
    Write-Error "Expected $relativePath to avoid target-workspace-only runner wording."
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

$codexMainContent = Get-Content -LiteralPath (Join-Path $root "plugins/codex-harness/agents/codex-main.md") -Raw
if ($codexMainContent -notmatch "(?m)^model:\s+sonnet\s*$" -or $codexMainContent -notmatch "(?m)^effort:\s+high\s*$") {
  Write-Error "Expected plugin codex-main to use sonnet with high effort for standard context compatibility."
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

$opusFiles = @(
  ".claude/commands/plan.md",
  ".claude/commands/review.md",
  ".claude/commands/verify.md",
  ".claude/agents/verification-auditor.md",
  "plugins/codex-harness/commands/plan.md",
  "plugins/codex-harness/commands/review.md",
  "plugins/codex-harness/commands/verify.md",
  "plugins/codex-harness/agents/verification-auditor.md"
)
foreach ($relativePath in $opusFiles) {
  $content = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
  if ($content -notmatch "(?m)^model:\s+opus\s*$") {
    Write-Error "Expected complex/deep surface to use opus: $relativePath"
  }
}

$maxEffortFiles = @(
  ".claude/agents/verification-auditor.md",
  ".claude/skills/completion-audit/SKILL.md",
  "plugins/codex-harness/agents/verification-auditor.md",
  "plugins/codex-harness/skills/completion-audit/SKILL.md"
)
foreach ($relativePath in $maxEffortFiles) {
  $content = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
  if ($content -notmatch "(?m)^effort:\s+max\s*$") {
    Write-Error "Expected opus auditor surface to use max effort: $relativePath"
  }
}

$xhighEffortFiles = @(
  ".claude/commands/plan.md",
  ".claude/commands/review.md",
  ".claude/commands/verify.md",
  "plugins/codex-harness/commands/plan.md",
  "plugins/codex-harness/commands/review.md",
  "plugins/codex-harness/commands/verify.md"
)
foreach ($relativePath in $xhighEffortFiles) {
  $content = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
  if ($content -notmatch "(?m)^effort:\s+xhigh\s*$") {
    Write-Error "Expected complex command to use xhigh effort: $relativePath"
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
  "(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{12,}",
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
