param(
    [string]$Root = "",
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Root) {
    $Root = Join-Path $RepoRoot "tinyrustlm"
}
$Root = (Resolve-Path -LiteralPath $Root).Path
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-root-verification.json"
}

$runId = "{0}-{1}" -f [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffffffZ"), ([Guid]::NewGuid().ToString("N").Substring(0, 12))
$childReport = Join-Path $RepoRoot "artifacts/reports/public-root-verification/$runId/ui-verification.json"
$status = "fail"
$errorMessage = ""

try {
    & (Join-Path $PSScriptRoot "verify-tinyrustlm-ui.ps1") `
        -Root $Root `
        -ReportOutput $childReport `
        -RunBrowserSmoke
    if ($LASTEXITCODE -ne 0) {
        throw "TinyRustLM UI verification failed with exit code $LASTEXITCODE"
    }
    $child = Get-Content -Raw -LiteralPath $childReport | ConvertFrom-Json
    if ($child.schema -ne "tinyrustlm.ui_verification.v1" -or $child.status -ne "pass") {
        throw "TinyRustLM UI verification did not produce a passing v1 report"
    }
    $status = "pass"
}
catch {
    $errorMessage = $_.Exception.Message
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$childSha256 = if (Test-Path -LiteralPath $childReport -PathType Leaf) {
    (Get-FileHash -Algorithm SHA256 -LiteralPath $childReport).Hash.ToLowerInvariant()
} else {
    ""
}
$report = [ordered]@{
    schema = "tinyrustlm.public_root_verification.v1"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    run_id = $runId
    status = $status
    repository_root = $RepoRoot
    app_root = $Root
    ui_verification_report = $childReport
    ui_verification_sha256 = $childSha256
    error = $errorMessage
}
$temporary = "$ReportOutput.$runId.tmp"
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $temporary -Encoding UTF8
Move-Item -LiteralPath $temporary -Destination $ReportOutput -Force
Write-Host "TinyRustLM public-root verification report written to $ReportOutput"

if ($status -ne "pass") {
    throw $errorMessage
}
Write-Host "TinyRustLM public-root verification passed."
