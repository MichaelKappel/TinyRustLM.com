param(
    [string]$NuGetSource = "",
    [string]$PackageVersion = "",
    [string]$ModelPath = "",
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $ModelPath) {
    $ModelPath = Join-Path $RepoRoot "tinyrustlm/models/tiny-test-model.slm"
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-feed-smoke.json"
}

function Write-FeedSmokeReport {
    param(
        [string]$OutputPath,
        [string]$Status,
        [string]$ErrorMessage,
        [string]$ConsumerOutput = ""
    )

    $consumerExcerpt = (($ConsumerOutput -replace "\r", " " -replace "\n", " ") -replace "\s+", " ").Trim()
    if ($consumerExcerpt.Length -gt 1000) {
        $consumerExcerpt = $consumerExcerpt.Substring(0, 1000)
    }

    $report = [ordered]@{
        schema = "tinyrustlm.nuget.feed_smoke.v0"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        status = $Status
        nuget_source = $NuGetSource
        package_version = $PackageVersion
        model_path = $ModelPath
        secret_material_included = $false
        local_piece_assembly_verified = $ConsumerOutput.Contains("consumer-smoke-assembled.slm")
        consumer_output_sha256 = Get-Sha256Text $ConsumerOutput
        consumer_output_excerpt = $consumerExcerpt
        error_message = $ErrorMessage
    }

    $reportDirectory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Host "TinyRustLM NuGet feed smoke report written to $OutputPath"
}

function Get-Sha256Text {
    param([string]$Text)

    if (-not $Text) {
        return ""
    }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
        return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
    }
    finally {
        $sha256.Dispose()
    }
}

$consumerOutput = ""
try {
    $consumerOutputLines = & (Join-Path $PSScriptRoot "verify-consumer.ps1") `
        -PackageSource $NuGetSource `
        -PackageVersion $PackageVersion `
        -ModelPath $ModelPath `
        2>&1
    $consumerOutput = ($consumerOutputLines | Out-String).Trim()
    if ($consumerOutput) {
        Write-Host $consumerOutput
    }

    Write-FeedSmokeReport -OutputPath $ReportOutput -Status "pass" -ErrorMessage "" -ConsumerOutput $consumerOutput
    Write-Host "TinyRustLM published feed verification passed: $NuGetSource @ $PackageVersion"
}
catch {
    if ($consumerOutput) {
        Write-Host $consumerOutput
    }
    Write-FeedSmokeReport -OutputPath $ReportOutput -Status "fail" -ErrorMessage $_.Exception.Message -ConsumerOutput $consumerOutput
    throw
}
