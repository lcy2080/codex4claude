param(
  [switch]$DryRun,
  [switch]$AllowFallback
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env.local"
$testCwd = $env:CODEX_HARNESS_ACACIA_TEST_CWD
if (-not $testCwd) {
  $testCwd = "C:\tmp\codex4claude-acacia-site-test"
}

if (Test-Path -LiteralPath $envFile) {
  foreach ($line in Get-Content -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }
    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -ne 2 -or $parts[0] -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      continue
    }
    [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

New-Item -ItemType Directory -Force -Path $testCwd | Out-Null

$prompt = @"
Create a polished single-page static homepage about acacia tree ecology.
Use only local files in this workspace. Create or update index.html and styles.css.
The page should be useful as a quick ecology overview: habitat, nitrogen fixation,
pollinators, drought adaptations, invasive-risk note, and a small seasonal lifecycle section.
Keep it lightweight, accessible, responsive, and suitable to open directly in a browser.
"@

$runnerArgs = @(
  "scripts/run-agent-sdk.mjs",
  "--agent", "implementation-worker",
  "--permission-mode", "acceptEdits",
  "--require-file-changes",
  "--overall-timeout-ms", "180000",
  "--cwd", $testCwd,
  "--prompt", $prompt
)

if ($DryRun) {
  $runnerArgs += "--dry-run"
}
if (-not $AllowFallback) {
  $runnerArgs += "--no-fallback"
}

Push-Location $root
try {
  node @runnerArgs
} finally {
  Pop-Location
}
