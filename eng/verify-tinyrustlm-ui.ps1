param(
    [string]$Root = "",
    [string]$ReportOutput = "",
    [switch]$RunBrowserSmoke,
    [switch]$RunDeepAcquisition,
    [switch]$RunVisualLock,
    [string]$VisualLockBaseline = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$arguments = @((Join-Path $RepoRoot "tinyrustlm/tools/verify-ui.js"))
if ($Root) { $arguments += @("--root", $Root) }
if ($ReportOutput) { $arguments += @("--report", $ReportOutput) }
if ($VisualLockBaseline) { $arguments += @("--visual-baseline", $VisualLockBaseline) }
if ($RunBrowserSmoke) { $arguments += "--browser" }
if ($RunDeepAcquisition) { $arguments += "--deep" }
if ($RunVisualLock) { $arguments += "--visual" }
& node @arguments
if ($LASTEXITCODE -ne 0) { throw "TinyRustLM UI verification failed with exit code $LASTEXITCODE" }
