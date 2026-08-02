param(
    [string]$PackageSource = "",
    [string]$NuGetSource = "",
    [string]$PackageVersion = "",
    [string]$AuditReport = "",
    [string]$PublishPlanReport = "",
    [string]$LocalFeedCurrentReport = "",
    [string]$LocalFeedHashReport = "",
    [string]$RemoteFeedCurrentReport = "",
    [string]$RemoteFeedHashReport = "",
    [string]$ReportOutput = "",
    [string]$AuthMode = "",
    [string]$ApiKey = "",
    [switch]$FailOnBlocked
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not $PackageSource) {
    $PackageSource = Join-Path $RepoRoot "artifacts/packages"
}
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if (-not $AuditReport) {
    $AuditReport = if ($env:TINYRUSTLM_PACKAGE_AUDIT_REPORT) {
        $env:TINYRUSTLM_PACKAGE_AUDIT_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-package-audit.json"
    }
}
if (-not $PublishPlanReport) {
    $PublishPlanReport = if ($env:TINYRUSTLM_PUBLISH_PLAN_REPORT) {
        $env:TINYRUSTLM_PUBLISH_PLAN_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-publish-plan.json"
    }
}
if (-not $LocalFeedCurrentReport) {
    $LocalFeedCurrentReport = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-local-feed-current.json"
}
if (-not $LocalFeedHashReport) {
    $LocalFeedHashReport = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-local-feed-hashes.json"
}
if (-not $RemoteFeedCurrentReport) {
    $RemoteFeedCurrentReport = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-release-feed-current.json"
}
if (-not $RemoteFeedHashReport) {
    $RemoteFeedHashReport = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-release-feed-hashes.json"
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-release-readiness.json"
}
if (-not $ApiKey) {
    $ApiKey = $env:NUGET_API_KEY
}
if (-not $AuthMode) {
    $AuthMode = if ($env:TINYRUSTLM_NUGET_AUTH_MODE) {
        $env:TINYRUSTLM_NUGET_AUTH_MODE
    }
    elseif ($env:NUGET_AUTH_MODE) {
        $env:NUGET_AUTH_MODE
    }
    else {
        "api_key"
    }
}
$AuthMode = $AuthMode.Trim().ToLowerInvariant()
if ($AuthMode -notin @("api_key", "trusted_publishing")) {
    throw "AuthMode must be 'api_key' or 'trusted_publishing'."
}

function Test-NuGetOrgSource {
    param([string]$Source)

    $candidate = $Source.Trim().ToLowerInvariant()
    return $candidate -eq "nuget.org" `
        -or $candidate -match '(^|[./:-])nuget\.org($|[/:.-])' `
        -or $candidate -match '(^|[./:-])api\.nuget\.org($|[/:.-])'
}

function Read-ReportStatus {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ""
    }
    try {
        $report = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        return [string]$report.status
    }
    catch {
        return "invalid"
    }
}

function Read-JsonReport {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Get-JsonStringValue {
    param(
        $Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return ""
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) {
        return ""
    }
    return [string]$property.Value
}

function Get-JsonIntValue {
    param(
        $Object,
        [string]$Name
    )

    $value = Get-JsonStringValue -Object $Object -Name $Name
    if ([string]::IsNullOrWhiteSpace($value)) {
        return 0
    }
    return [int]$value
}

function Get-JsonBoolValue {
    param(
        $Object,
        [string]$Name
    )

    $value = Get-JsonStringValue -Object $Object -Name $Name
    return $value.Equals("true", [StringComparison]::OrdinalIgnoreCase)
}

function Invoke-ReadinessStep {
    param(
        [string]$Name,
        [string]$ReportPath,
        [scriptblock]$ScriptBlock
    )

    if (Test-Path -LiteralPath $ReportPath) {
        Remove-Item -LiteralPath $ReportPath -Force
    }

    $errorMessage = ""
    $exitStatus = "pass"
    try {
        & $ScriptBlock
    }
    catch {
        $exitStatus = "fail"
        $errorMessage = $_.Exception.Message
    }

    [ordered]@{
        name = $Name
        status = $exitStatus
        report_path = $ReportPath
        report_written = Test-Path -LiteralPath $ReportPath -PathType Leaf
        report_status = Read-ReportStatus -Path $ReportPath
        error_message = $errorMessage
    }
}

$steps = New-Object System.Collections.Generic.List[object]
$steps.Add((Invoke-ReadinessStep -Name "publish_plan_dry_run" -ReportPath $PublishPlanReport -ScriptBlock {
    & (Join-Path $PSScriptRoot "publish-nuget.ps1") `
        -SkipVerification `
        -DryRun `
        -PackageSource $PackageSource `
        -NuGetSource $NuGetSource `
        -PackageVersion $PackageVersion `
        -AuditReport $AuditReport `
        -ReportOutput $PublishPlanReport
}))

$steps.Add((Invoke-ReadinessStep -Name "local_feed_current" -ReportPath $LocalFeedCurrentReport -ScriptBlock {
    & (Join-Path $PSScriptRoot "verify-feed-current.ps1") `
        -NuGetSource $PackageSource `
        -PackageVersion $PackageVersion `
        -ReportOutput $LocalFeedCurrentReport
}))

$steps.Add((Invoke-ReadinessStep -Name "local_feed_hashes" -ReportPath $LocalFeedHashReport -ScriptBlock {
    & (Join-Path $PSScriptRoot "verify-feed-package-hashes.ps1") `
        -NuGetSource $PackageSource `
        -PublishPlanReport $PublishPlanReport `
        -ReportOutput $LocalFeedHashReport
}))

$steps.Add((Invoke-ReadinessStep -Name "remote_feed_current" -ReportPath $RemoteFeedCurrentReport -ScriptBlock {
    & (Join-Path $PSScriptRoot "verify-feed-current.ps1") `
        -NuGetSource $NuGetSource `
        -PackageVersion $PackageVersion `
        -ReportOutput $RemoteFeedCurrentReport
}))

$remoteFeedCurrent = $steps | Where-Object { $_.name -eq "remote_feed_current" } | Select-Object -First 1
if ($remoteFeedCurrent.report_status -eq "pass") {
    $steps.Add((Invoke-ReadinessStep -Name "remote_feed_hashes" -ReportPath $RemoteFeedHashReport -ScriptBlock {
        & (Join-Path $PSScriptRoot "verify-feed-package-hashes.ps1") `
            -NuGetSource $NuGetSource `
            -PublishPlanReport $PublishPlanReport `
            -ReportOutput $RemoteFeedHashReport
    }))
}
else {
    if (Test-Path -LiteralPath $RemoteFeedHashReport) {
        Remove-Item -LiteralPath $RemoteFeedHashReport -Force
    }
    $steps.Add([ordered]@{
        name = "remote_feed_hashes"
        status = "skipped"
        report_path = $RemoteFeedHashReport
        report_written = $false
        report_status = ""
        error_message = "Skipped because the remote feed does not expose the declared package version yet."
    })
}

$localStepFailures = @($steps | Where-Object {
    if ($_.name -notin @("publish_plan_dry_run", "local_feed_current", "local_feed_hashes")) {
        return $false
    }
    if ($_.status -ne "pass") {
        return $true
    }
    if ($_.name -eq "publish_plan_dry_run") {
        return $_.report_status -ne "dry_run"
    }
    return $_.report_status -ne "pass"
})
$remoteCurrentStep = $steps | Where-Object { $_.name -eq "remote_feed_current" } | Select-Object -First 1
$remoteHashStep = $steps | Where-Object { $_.name -eq "remote_feed_hashes" } | Select-Object -First 1
$apiKeyPresent = -not [string]::IsNullOrWhiteSpace($ApiKey)
$trustedPublishingRequested = $AuthMode -eq "trusted_publishing"
$trustedPublishingSupported = $trustedPublishingRequested -and (Test-NuGetOrgSource -Source $NuGetSource)
$blockers = New-Object System.Collections.Generic.List[string]
$nextActions = New-Object System.Collections.Generic.List[string]

if ($localStepFailures.Count -gt 0) {
    $status = "blocked_local_verification"
    $blockers.Add("Local package, audit, publish-plan, or package-folder feed verification failed.")
    $nextActions.Add("Run eng\verify-package.ps1, then rerun this readiness audit.")
}
elseif ($remoteCurrentStep.status -ne "pass" -and [string]::IsNullOrWhiteSpace($remoteCurrentStep.report_status)) {
    $status = "blocked_feed_status_unknown"
    $blockers.Add("The configured NuGet feed could not be queried for current package versions.")
    $nextActions.Add("Check NuGet feed connectivity and rerun the readiness audit.")
}
elseif ($trustedPublishingRequested -and -not $trustedPublishingSupported) {
    $status = "blocked_trusted_publishing_unsupported"
    $blockers.Add("Trusted Publishing auth mode is only supported for NuGet.org sources.")
    $nextActions.Add("Use -AuthMode api_key for private feeds, or change -NuGetSource to a NuGet.org v3 source with a configured Trusted Publishing policy.")
}
elseif ($remoteCurrentStep.report_status -eq "pass") {
    if ($remoteHashStep.status -eq "pass" -and $remoteHashStep.report_status -eq "pass") {
        $status = "published_current"
        $nextActions.Add("Keep scheduled feed-current monitoring enabled for the authoritative feed.")
    }
    else {
        $status = "blocked_remote_hash_mismatch"
        $blockers.Add("The feed exposes the declared version but package bytes do not match the audited publish plan.")
        $nextActions.Add("Investigate feed immutability and package provenance before claiming the feed is current.")
        $nextActions.Add("If the published version is already immutable on NuGet.org, bump dotnet/Directory.Build.props VersionPrefix before publishing corrected packages.")
    }
}
elseif ($trustedPublishingSupported) {
    $status = "ready_to_publish"
    $nextActions.Add("Configure a NuGet.org Trusted Publishing policy for workflow release-nuget.yml and environment nuget-release, then run the release workflow with auth_mode=trusted_publishing.")
}
elseif (-not $apiKeyPresent) {
    $status = "blocked_missing_api_key"
    $blockers.Add("NUGET_API_KEY is not present, so this environment cannot perform the authenticated push.")
    $nextActions.Add("Run the release workflow or eng\publish-nuget.ps1 in an environment with a scoped NuGet API key.")
}
else {
    $status = "ready_to_publish"
    $nextActions.Add("Run eng\publish-nuget.ps1 without -DryRun, then wait for indexing and rerun feed-current/feed-hash verification.")
}

$resolvedPackageSource = $PackageSource
if (Test-Path -LiteralPath $PackageSource) {
    $resolvedPackageSource = (Resolve-Path -LiteralPath $PackageSource).Path
}

$publishPlanSummary = Read-JsonReport -Path $PublishPlanReport
$localFeedHashSummary = Read-JsonReport -Path $LocalFeedHashReport

$report = [ordered]@{
    schema = "tinyrustlm.nuget.release_readiness.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = $status
    package_version = $PackageVersion
    package_source = $resolvedPackageSource
    nuget_source = $NuGetSource
    secret_material_included = $false
    auth_mode = $AuthMode
    api_key_present = $apiKeyPresent
    trusted_publishing_requested = $trustedPublishingRequested
    trusted_publishing_supported = $trustedPublishingSupported
    fail_on_blocked = [bool]$FailOnBlocked
    publish_plan_report_path = $PublishPlanReport
    publish_plan_status = Get-JsonStringValue -Object $publishPlanSummary -Name "status"
    publish_plan_package_count = Get-JsonIntValue -Object $publishPlanSummary -Name "package_count"
    publish_plan_symbol_package_count = Get-JsonIntValue -Object $publishPlanSummary -Name "symbol_package_count"
    symbol_publish_mode = Get-JsonStringValue -Object $publishPlanSummary -Name "symbol_publish_mode"
    package_hash_manifest_name = Get-JsonStringValue -Object $publishPlanSummary -Name "package_hash_manifest_name"
    package_hash_manifest_sha256 = Get-JsonStringValue -Object $publishPlanSummary -Name "package_hash_manifest_sha256"
    package_hash_manifest_match = Get-JsonBoolValue -Object $publishPlanSummary -Name "package_hash_manifest_match"
    local_feed_current_report_path = $LocalFeedCurrentReport
    local_feed_hash_report_path = $LocalFeedHashReport
    local_feed_hash_status = Get-JsonStringValue -Object $localFeedHashSummary -Name "status"
    local_feed_hash_package_count = Get-JsonIntValue -Object $localFeedHashSummary -Name "package_count"
    local_feed_hash_symbol_package_count = Get-JsonIntValue -Object $localFeedHashSummary -Name "symbol_package_count"
    local_feed_hash_symbol_verification_mode = Get-JsonStringValue -Object $localFeedHashSummary -Name "symbol_package_verification_mode"
    local_feed_hash_mismatch_count = Get-JsonIntValue -Object $localFeedHashSummary -Name "hash_mismatch_count"
    local_feed_hash_symbol_mismatch_count = Get-JsonIntValue -Object $localFeedHashSummary -Name "symbol_hash_mismatch_count"
    local_feed_hash_symbol_byte_count_mismatch_count = Get-JsonIntValue -Object $localFeedHashSummary -Name "symbol_byte_count_mismatch_count"
    remote_feed_current_report_path = $RemoteFeedCurrentReport
    remote_feed_hash_report_path = $RemoteFeedHashReport
    blockers = $blockers.ToArray()
    next_actions = $nextActions.ToArray()
    steps = $steps.ToArray()
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "TinyRustLM NuGet release-readiness report written to $ReportOutput"
Write-Host "TinyRustLM NuGet release-readiness status: $status"

if ($FailOnBlocked -and $status.StartsWith("blocked_", [StringComparison]::Ordinal)) {
    throw "TinyRustLM NuGet release readiness is blocked: $status"
}
