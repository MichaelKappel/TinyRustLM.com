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
$ExpectedPackageIds = @(
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P"
)

function Test-NuGetOrgSource {
    param([string]$Source)

    # Trusted Publishing belongs to the official v3 feed, not a matching substring.
    $candidate = $Source.Trim().ToLowerInvariant()
    return $candidate -in @("nuget.org", "https://api.nuget.org/v3/index.json")
}

function Get-RemoteFeedState {
    param($Report, [string]$StepStatus, [string]$Version, [string[]]$PackageIds)

    # Admit complete current-format observations before distinguishing absence from stale versions.
    try {
        if ($null -eq $Report -or $Report.schema -cne "tinyrustlm.nuget.feed_current.v0" -or
            $Report.package_version -cne $Version -or $Report.allow_newer -isnot [bool] -or $Report.allow_newer) { return "unknown" }
        $rows = @($Report.packages)
        $expected = @($PackageIds | Sort-Object) -join "`n"
        if ((@($Report.package_ids | Sort-Object) -join "`n") -cne $expected -or
            (@($rows | ForEach-Object { $_.package_id } | Sort-Object) -join "`n") -cne $expected -or
            $Report.package_count -ne $PackageIds.Count) { return "unknown" }
        $missing = 0
        $stale = 0
        foreach ($row in $rows) {
            if ($row.declared_version -cne $Version -or $row.declared_version_present -isnot [bool] -or
                $row.declared_version_is_latest_reported -isnot [bool]) { return "unknown" }
            if (-not $row.declared_version_present) {
                if ($row.declared_version_is_latest_reported) { return "unknown" }
                $missing++
            }
            elseif (-not $row.declared_version_is_latest_reported) { $stale++ }
        }
        $expectedStatus = if ($missing -eq 0 -and $stale -eq 0) { "pass" } else { "fail" }
        if ($Report.status -cne $expectedStatus -or $StepStatus -cne $expectedStatus -or
            $Report.missing_declared_version_count -ne $missing -or $Report.not_latest_count -ne ($missing + $stale)) { return "unknown" }
        if ($stale -gt 0) { return "newer_version" }
        if ($missing -gt 0) { return "missing" }
        return "current"
    }
    catch { return "unknown" }
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
$publishPlanSummary = Read-JsonReport -Path $PublishPlanReport
$localFeedHashSummary = Read-JsonReport -Path $LocalFeedHashReport
$publishPlanPackageIds = @($publishPlanSummary.packages | ForEach-Object { [string]$_.package_id } | Sort-Object)
$publishPlanSymbolPackageIds = @($publishPlanSummary.symbol_packages | ForEach-Object { [string]$_.package_id } | Sort-Object)
$expectedSortedPackageIds = @($ExpectedPackageIds | Sort-Object)
$packageGraphMatch = (($publishPlanPackageIds -join "`n") -ceq ($expectedSortedPackageIds -join "`n")) `
    -and (($publishPlanSymbolPackageIds -join "`n") -ceq ($expectedSortedPackageIds -join "`n"))
if (-not $packageGraphMatch) {
    $localStepFailures += [ordered]@{
        name = "current_public_package_graph"
        status = "fail"
        report_path = $PublishPlanReport
        report_written = Test-Path -LiteralPath $PublishPlanReport -PathType Leaf
        report_status = Get-JsonStringValue -Object $publishPlanSummary -Name "status"
        error_message = "Publish plan is not the exact three-package public TinyRustLM graph."
    }
}
$remoteCurrentStep = $steps | Where-Object { $_.name -eq "remote_feed_current" } | Select-Object -First 1
$remoteHashStep = $steps | Where-Object { $_.name -eq "remote_feed_hashes" } | Select-Object -First 1
$remoteFeedState = Get-RemoteFeedState -Report (Read-JsonReport -Path $RemoteFeedCurrentReport) `
    -StepStatus $remoteCurrentStep.status -Version $PackageVersion -PackageIds $ExpectedPackageIds
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
elseif ($remoteFeedState -eq "unknown") {
    $status = "blocked_feed_status_unknown"
    $blockers.Add("The configured NuGet feed could not be queried for current package versions.")
    $nextActions.Add("Check NuGet feed connectivity and rerun the readiness audit.")
}
elseif ($trustedPublishingRequested -and -not $trustedPublishingSupported) {
    $status = "blocked_trusted_publishing_unsupported"
    $blockers.Add("Trusted Publishing auth mode is only supported for NuGet.org sources.")
    $nextActions.Add("Use -AuthMode api_key for private feeds, or change -NuGetSource to a NuGet.org v3 source with a configured Trusted Publishing policy.")
}
elseif ($remoteFeedState -eq "newer_version") {
    $status = "blocked_remote_newer_version"
    $blockers.Add("The declared version is already published and a newer version exists for at least one package.")
    $nextActions.Add("Reconcile the source version with the published feed before preparing a new release; duplicate pushes cannot make an older version current.")
}
elseif ($remoteFeedState -eq "current") {
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

$report = [ordered]@{
    schema = "tinyrustlm.nuget.release_readiness.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = $status
    package_version = $PackageVersion
    expected_package_ids = @($ExpectedPackageIds)
    package_graph_match = $packageGraphMatch
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
    remote_feed_state = $remoteFeedState
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
