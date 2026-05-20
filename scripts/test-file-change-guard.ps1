param()

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$scratch = Join-Path $root "tmp-nongit\file-change-guard-live"
$fakeCli = Join-Path $scratch "fake-claude.mjs"

New-Item -ItemType Directory -Force -Path $scratch | Out-Null

$fakeCliSource = @'
import fs from "node:fs";
import path from "node:path";

console.log(JSON.stringify({
  type: "system",
  subtype: "init",
  session_id: "fake-session",
  model: "fake",
  cwd: process.cwd()
}));

if (process.env.CODEX_FAKE_CLI_WRITE === "1") {
  fs.writeFileSync(path.join(process.cwd(), "file-change-guard.txt"), "file change guard ok\n");
}

console.log(JSON.stringify({
  type: "result",
  subtype: "success",
  result: "fake success",
  num_turns: 1,
  total_cost_usd: 0,
  session_id: "fake-session"
}));
'@

Set-Content -LiteralPath $fakeCli -Value $fakeCliSource -Encoding utf8

function Invoke-GuardCase {
  param(
    [string]$Name,
    [switch]$Write
  )

  $caseCwd = Join-Path $scratch $Name
  if (Test-Path -LiteralPath $caseCwd) {
    Remove-Item -LiteralPath $caseCwd -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $caseCwd | Out-Null

  $env:CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE = "claudeCli"
  $env:CODEX_HARNESS_CLAUDE_CLI = $fakeCli
  if ($Write) {
    $env:CODEX_FAKE_CLI_WRITE = "1"
  } else {
    Remove-Item Env:\CODEX_FAKE_CLI_WRITE -ErrorAction SilentlyContinue
  }

  $output = & node scripts/run-agent-sdk.mjs `
    --agent implementation-worker `
    --permission-mode acceptEdits `
    --require-file-changes `
    --overall-timeout-ms 30000 `
    --cwd $caseCwd `
    --prompt "fake guard test" 2>&1

  [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output = ($output -join "`n")
    Cwd = $caseCwd
  }
}

Push-Location $root
try {
  $noChange = Invoke-GuardCase -Name "no-change"
  if ($noChange.ExitCode -eq 0 -or $noChange.Output -notmatch "No workspace file changes detected") {
    Write-Error "Expected no-change run to fail with the file-change guard. ExitCode=$($noChange.ExitCode) Output=$($noChange.Output)"
  }
  Write-Host "No-change guard failure verified."

  $write = Invoke-GuardCase -Name "write" -Write
  $writtenFile = Join-Path $write.Cwd "file-change-guard.txt"
  if ($write.ExitCode -ne 0 -or $write.Output -notmatch "\[file-change-result\]" -or -not (Test-Path -LiteralPath $writtenFile)) {
    Write-Error "Expected write run to pass and emit [file-change-result]. ExitCode=$($write.ExitCode) Output=$($write.Output)"
  }
  Write-Host "Write guard success verified."
} finally {
  Pop-Location
  Remove-Item Env:\CODEX_FAKE_CLI_WRITE -ErrorAction SilentlyContinue
  Remove-Item Env:\CODEX_HARNESS_CLAUDE_CLI -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}
