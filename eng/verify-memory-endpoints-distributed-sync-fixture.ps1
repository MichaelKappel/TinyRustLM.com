param(
    [string]$ReportPath = "artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-contract-fixture-powershell.json"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not [IO.Path]::IsPathRooted($ReportPath)) {
    $ReportPath = Join-Path $RepoRoot $ReportPath
}
$reportDirectory = Split-Path -Parent $ReportPath
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$stdoutPath = Join-Path $reportDirectory "distributed-sync-fixture-server.out"
$stderrPath = Join-Path $reportDirectory "distributed-sync-fixture-server.err"
Set-Content -LiteralPath $stdoutPath -Value ""
Set-Content -LiteralPath $stderrPath -Value ""

$process = Start-Process `
    -FilePath "node" `
    -ArgumentList "tinyrustlm/tools/memory-endpoints-distributed-sync-fixture-server.js" `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
try {
    $line = ""
    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        Start-Sleep -Milliseconds 100
        $line = [string](Get-Content -LiteralPath $stdoutPath -ErrorAction SilentlyContinue |
            Select-Object -First 1)
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            break
        }
        if ($process.HasExited) {
            throw "Distributed-sync fixture exited before reporting its loopback URL."
        }
    }
    if ([string]::IsNullOrWhiteSpace($line)) {
        throw "Distributed-sync fixture did not report its loopback URL."
    }
    $baseUrl = ($line | ConvertFrom-Json).baseUrl
    if ([string]$baseUrl -notmatch '^http://127\.0\.0\.1:\d+$') {
        throw "Distributed-sync fixture returned an unsafe base URL."
    }
    & (Join-Path $PSScriptRoot "verify-memory-endpoints-distributed-sync-contract.ps1") `
        -BaseUrl $baseUrl `
        -ReportPath $ReportPath
}
finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    $process.WaitForExit()
}

$report = Get-Content -Raw -LiteralPath $ReportPath | ConvertFrom-Json
if ($report.status -ne "pass" -or $report.secret_material_included -ne $false) {
    throw "Distributed-sync fixture contract report did not pass its redacted boundary."
}
Write-Host "Distributed-sync fixture verification passed: $ReportPath"
