param(
    [string]$PackageSource = "",
    [string]$NuGetSource = "",
    [string]$ApiKey = "",
    [string]$PackageVersion = "",
    [string]$AuditReport = "",
    [string]$ReportOutput = "",
    [switch]$SkipVerification,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$expectedPackageIds = @(
    "UAIX.Browser.Core.Abstractions",
    "UAIX.Browser.p2pLLM.Runtime",
    "UAIX.Browser.p2pRuntime.P2P",
    "UAIX.Browser.Memory",
    "UAIX.Browser.p2pLLM.Conversion"
)

function Invoke-DotNet {
    param([string[]]$Arguments)

    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $(Format-DotNetArgumentsForLog -Arguments $Arguments) failed with exit code $LASTEXITCODE"
    }
}

function Format-DotNetArgumentsForLog {
    param([string[]]$Arguments)

    $redacted = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Arguments.Count; $i++) {
        if ($i -gt 0 -and $Arguments[$i - 1] -eq "--api-key") {
            $redacted.Add("<redacted>")
        }
        else {
            $redacted.Add($Arguments[$i])
        }
    }
    return ($redacted -join " ")
}

function Get-FileSha256 {
    param([string]$Path)

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-PackageIdFromName {
    param(
        [string]$PackageName,
        [string]$Version,
        [string]$Extension
    )

    $suffix = ".$Version$Extension"
    if ($PackageName.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
        return $PackageName.Substring(0, $PackageName.Length - $suffix.Length)
    }
    return [System.IO.Path]::GetFileNameWithoutExtension($PackageName)
}

function Get-EnvironmentValue {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($value) {
        return $value
    }
    return ""
}

function Invoke-GitText {
    param([string[]]$Arguments)

    try {
        $output = & git -C $RepoRoot @Arguments 2>$null
        if ($LASTEXITCODE -eq 0) {
            return (($output -join "`n").Trim())
        }
    }
    catch {
        return ""
    }
    return ""
}

function Get-NonEmptyLineCount {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return 0
    }

    return @(($Value -split "\r?\n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
}

function Get-SourceProvenance {
    $resolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
    $gitRepositoryRoot = Invoke-GitText -Arguments @("rev-parse", "--show-toplevel")
    if (-not $gitRepositoryRoot) {
        $gitRepositoryRoot = $resolvedRepoRoot
    }

    $commit = Invoke-GitText -Arguments @("rev-parse", "HEAD")
    $branch = Invoke-GitText -Arguments @("branch", "--show-current")
    if (-not $branch) {
        $branch = Invoke-GitText -Arguments @("rev-parse", "--abbrev-ref", "HEAD")
    }

    $trackedChanges = Invoke-GitText -Arguments @("status", "--porcelain", "--untracked-files=no")
    $untrackedChanges = Invoke-GitText -Arguments @("ls-files", "--others", "--exclude-standard")
    $trackedChangeCount = Get-NonEmptyLineCount -Value $trackedChanges
    $untrackedChangeCount = Get-NonEmptyLineCount -Value $untrackedChanges
    $githubActions = (Get-EnvironmentValue -Name "GITHUB_ACTIONS").Equals("true", [StringComparison]::OrdinalIgnoreCase)
    $ci = (Get-EnvironmentValue -Name "CI").Equals("true", [StringComparison]::OrdinalIgnoreCase) -or $githubActions

    return [ordered]@{
        repository_root = $resolvedRepoRoot
        git_repository_root = $gitRepositoryRoot
        git_commit = $commit
        git_branch = $branch
        git_tree_dirty = ($trackedChangeCount -gt 0 -or $untrackedChangeCount -gt 0)
        git_tracked_change_count = $trackedChangeCount
        git_untracked_change_count = $untrackedChangeCount
        ci = $ci
        ci_provider = if ($githubActions) { "github_actions" } elseif ($ci) { "ci" } else { "local" }
        github_repository = Get-EnvironmentValue -Name "GITHUB_REPOSITORY"
        github_ref = Get-EnvironmentValue -Name "GITHUB_REF"
        github_sha = Get-EnvironmentValue -Name "GITHUB_SHA"
        github_run_id = Get-EnvironmentValue -Name "GITHUB_RUN_ID"
        github_workflow = Get-EnvironmentValue -Name "GITHUB_WORKFLOW"
        source_provenance_available = ($commit -match "^[0-9a-fA-F]{40}$")
    }
}

function Test-BrowserFeedAuditBinding {
    param(
        [System.IO.FileInfo[]]$Packages,
        [System.IO.FileInfo[]]$SymbolPackages,
        [string[]]$ExpectedNames,
        [string[]]$ExpectedSymbolNames,
        [string]$AuditReportPath
    )

    $evidence = [ordered]@{
        package_audit_report_path = $AuditReportPath
        package_audit_report_sha256 = ""
        package_audit_schema = ""
        package_audit_status = "missing"
        package_audit_match = $false
        package_audit_error = ""
    }

    if (-not (Test-Path -LiteralPath $AuditReportPath -PathType Leaf)) {
        $evidence.package_audit_error = "UAIX Browser feed audit report is required before publishing: $AuditReportPath"
        return $evidence
    }

    $resolvedAuditReport = (Resolve-Path -LiteralPath $AuditReportPath).Path
    $evidence.package_audit_report_path = $resolvedAuditReport
    $evidence.package_audit_report_sha256 = Get-FileSha256 -Path $resolvedAuditReport

    try {
        $audit = Get-Content -LiteralPath $resolvedAuditReport -Raw | ConvertFrom-Json
    }
    catch {
        $evidence.package_audit_status = "invalid"
        $evidence.package_audit_error = "UAIX Browser feed audit report is not valid JSON: $($_.Exception.Message)"
        return $evidence
    }

    $evidence.package_audit_schema = [string]$audit.schema
    $evidence.package_audit_status = [string]$audit.status
    if ($audit.schema -ne "uaix.browser.nuget.feed_audit.v0") {
        $evidence.package_audit_error = "UAIX Browser feed audit schema mismatch: $($audit.schema)"
        return $evidence
    }
    if ($audit.status -ne "pass") {
        $evidence.package_audit_error = "UAIX Browser feed audit status is not pass: $($audit.status)"
        return $evidence
    }

    $auditPackages = @($audit.packages)
    $auditSymbolPackages = @($audit.symbol_packages)
    $auditNames = @($auditPackages | ForEach-Object { [string]$_.name })
    $auditSymbolNames = @($auditSymbolPackages | ForEach-Object { [string]$_.name })
    foreach ($expectedName in $ExpectedNames) {
        if ($auditNames -notcontains $expectedName) {
            $evidence.package_audit_error = "UAIX Browser feed audit is missing expected package: $expectedName"
            return $evidence
        }
    }
    foreach ($expectedName in $ExpectedSymbolNames) {
        if ($auditSymbolNames -notcontains $expectedName) {
            $evidence.package_audit_error = "UAIX Browser feed audit is missing expected symbol package: $expectedName"
            return $evidence
        }
    }

    foreach ($package in $Packages) {
        $auditPackage = $auditPackages | Where-Object { $_.name -eq $package.Name } | Select-Object -First 1
        if (-not $auditPackage) {
            $evidence.package_audit_error = "Publish package was not present in UAIX Browser feed audit: $($package.Name)"
            return $evidence
        }
        if ($auditPackage.sha256 -ne (Get-FileSha256 -Path $package.FullName)) {
            $evidence.package_audit_error = "Package hash differs from UAIX Browser feed audit: $($package.Name)"
            return $evidence
        }
        if ([Int64]$auditPackage.byte_count -ne [Int64]$package.Length) {
            $evidence.package_audit_error = "Package size differs from UAIX Browser feed audit: $($package.Name)"
            return $evidence
        }
    }
    foreach ($symbolPackage in $SymbolPackages) {
        $auditPackage = $auditSymbolPackages | Where-Object { $_.name -eq $symbolPackage.Name } | Select-Object -First 1
        if (-not $auditPackage) {
            $evidence.package_audit_error = "Publish symbol package was not present in UAIX Browser feed audit: $($symbolPackage.Name)"
            return $evidence
        }
        if ($auditPackage.sha256 -ne (Get-FileSha256 -Path $symbolPackage.FullName)) {
            $evidence.package_audit_error = "Symbol package hash differs from UAIX Browser feed audit: $($symbolPackage.Name)"
            return $evidence
        }
        if ([Int64]$auditPackage.byte_count -ne [Int64]$symbolPackage.Length) {
            $evidence.package_audit_error = "Symbol package size differs from UAIX Browser feed audit: $($symbolPackage.Name)"
            return $evidence
        }
    }

    $evidence.package_audit_match = $true
    return $evidence
}

function Test-BrowserHashManifestBinding {
    param(
        [System.IO.FileInfo[]]$Packages,
        [System.IO.FileInfo[]]$SymbolPackages,
        [string[]]$ExpectedNames,
        [string[]]$ExpectedSymbolNames,
        [string]$PackageSourcePath,
        [string]$PackageVersion
    )

    $manifestName = "SHA256SUMS-UAIX.Browser-$PackageVersion.txt"
    $manifestPath = Join-Path $PackageSourcePath $manifestName
    $evidence = [ordered]@{
        package_hash_manifest_name = $manifestName
        package_hash_manifest_path = $manifestPath
        package_hash_manifest_sha256 = ""
        package_hash_manifest_status = "missing"
        package_hash_manifest_match = $false
        package_hash_manifest_error = ""
    }

    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        $evidence.package_hash_manifest_error = "UAIX Browser SHA-256 manifest is required before publishing: $manifestPath"
        return $evidence
    }

    $resolvedManifestPath = (Resolve-Path -LiteralPath $manifestPath).Path
    $evidence.package_hash_manifest_path = $resolvedManifestPath
    $evidence.package_hash_manifest_sha256 = Get-FileSha256 -Path $resolvedManifestPath

    $entries = @{}
    foreach ($line in (Get-Content -LiteralPath $resolvedManifestPath)) {
        $trimmed = $line.Trim()
        if (-not $trimmed) {
            continue
        }
        if ($trimmed -notmatch "^(?<hash>[0-9a-fA-F]{64})\s+(?<name>[^\\/:]+\.(?:nupkg|snupkg))$") {
            $evidence.package_hash_manifest_status = "invalid"
            $evidence.package_hash_manifest_error = "UAIX Browser SHA-256 manifest contains an invalid line: $line"
            return $evidence
        }
        $name = $Matches["name"]
        if ($entries.ContainsKey($name)) {
            $evidence.package_hash_manifest_status = "invalid"
            $evidence.package_hash_manifest_error = "UAIX Browser SHA-256 manifest contains a duplicate package entry: $name"
            return $evidence
        }
        $entries[$name] = $Matches["hash"].ToLowerInvariant()
    }

    $allExpectedNames = @($ExpectedNames) + @($ExpectedSymbolNames)
    foreach ($expectedName in $allExpectedNames) {
        if (-not $entries.ContainsKey($expectedName)) {
            $evidence.package_hash_manifest_status = "invalid"
            $evidence.package_hash_manifest_error = "UAIX Browser SHA-256 manifest is missing expected package: $expectedName"
            return $evidence
        }
    }
    foreach ($entryName in @($entries.Keys)) {
        if ($allExpectedNames -notcontains $entryName) {
            $evidence.package_hash_manifest_status = "invalid"
            $evidence.package_hash_manifest_error = "UAIX Browser SHA-256 manifest contains an unexpected package entry: $entryName"
            return $evidence
        }
    }
    foreach ($package in (@($Packages) + @($SymbolPackages))) {
        if ($entries[$package.Name] -ne (Get-FileSha256 -Path $package.FullName)) {
            $evidence.package_hash_manifest_status = "invalid"
            $evidence.package_hash_manifest_error = "UAIX Browser SHA-256 manifest hash differs from package bytes: $($package.Name)"
            return $evidence
        }
    }

    $evidence.package_hash_manifest_status = "pass"
    $evidence.package_hash_manifest_match = $true
    return $evidence
}

function Test-BrowserFeedReadmeBinding {
    param(
        [string[]]$ExpectedNames,
        [string[]]$ExpectedSymbolNames,
        [string]$PackageSourcePath,
        [string]$PackageVersion,
        [string]$AuditReportPath
    )

    $readmeName = "README-UAIX.Browser-$PackageVersion.txt"
    $readmePath = Join-Path $PackageSourcePath $readmeName
    $evidence = [ordered]@{
        feed_readme_name = $readmeName
        feed_readme_path = $readmePath
        feed_readme_sha256 = ""
        feed_readme_status = "missing"
        feed_readme_match = $false
        feed_readme_missing_term_count = 0
        feed_readme_error = ""
    }

    if (-not (Test-Path -LiteralPath $readmePath -PathType Leaf)) {
        $evidence.feed_readme_error = "UAIX Browser feed README is required before publishing: $readmePath"
        return $evidence
    }

    $resolvedReadmePath = (Resolve-Path -LiteralPath $readmePath).Path
    $evidence.feed_readme_path = $resolvedReadmePath
    $evidence.feed_readme_sha256 = Get-FileSha256 -Path $resolvedReadmePath

    $readmeText = Get-Content -LiteralPath $resolvedReadmePath -Raw
    $requiredTerms = @($ExpectedNames) + @($ExpectedSymbolNames) + @(
        "NuGet Package Manager",
        "debug-symbol sidecar",
        "SHA256SUMS-UAIX.Browser-$PackageVersion.txt",
        "SymbolsPackage/PDB evidence",
        "publish-plan hashes",
        "feed-hash reports"
    )
    $missingTerms = @($requiredTerms | Where-Object {
        $readmeText.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
    })
    if ($missingTerms.Count -gt 0) {
        $evidence.feed_readme_status = "invalid"
        $evidence.feed_readme_missing_term_count = $missingTerms.Count
        $evidence.feed_readme_error = "UAIX Browser feed README is missing required symbol visibility term(s): $($missingTerms -join ', ')"
        return $evidence
    }

    if (-not (Test-Path -LiteralPath $AuditReportPath -PathType Leaf)) {
        $evidence.feed_readme_status = "invalid"
        $evidence.feed_readme_error = "UAIX Browser feed README cannot be bound because the feed audit report is missing: $AuditReportPath"
        return $evidence
    }

    try {
        $audit = Get-Content -LiteralPath $AuditReportPath -Raw | ConvertFrom-Json
    }
    catch {
        $evidence.feed_readme_status = "invalid"
        $evidence.feed_readme_error = "UAIX Browser feed README cannot be bound because the feed audit report is invalid JSON: $($_.Exception.Message)"
        return $evidence
    }

    if ($audit.feed_readme_name -ne $readmeName) {
        $evidence.feed_readme_status = "invalid"
        $evidence.feed_readme_error = "UAIX Browser feed audit README name mismatch: $($audit.feed_readme_name)"
        return $evidence
    }
    if ($audit.feed_readme_missing -eq $true) {
        $evidence.feed_readme_status = "invalid"
        $evidence.feed_readme_error = "UAIX Browser feed audit reports the feed README as missing."
        return $evidence
    }
    if ([int]$audit.feed_readme_missing_term_count -ne 0) {
        $evidence.feed_readme_status = "invalid"
        $evidence.feed_readme_missing_term_count = [int]$audit.feed_readme_missing_term_count
        $evidence.feed_readme_error = "UAIX Browser feed audit reports missing feed README terms."
        return $evidence
    }

    $evidence.feed_readme_status = "pass"
    $evidence.feed_readme_match = $true
    return $evidence
}

function Write-BrowserPublishPlanReport {
    param(
        [string]$OutputPath,
        [string]$Status,
        [System.IO.FileInfo[]]$Packages,
        [System.IO.FileInfo[]]$SymbolPackages,
        [string[]]$ExpectedNames,
        [string[]]$ExpectedSymbolNames,
        [string[]]$ExpectedPackageIds,
        [string]$PackageSource,
        [string]$NuGetSource,
        [string]$PackageVersion,
        [bool]$DryRunValue,
        [bool]$SkipVerificationValue,
        $AuditEvidence,
        $HashManifestEvidence,
        $FeedReadmeEvidence,
        [string]$PublishError = ""
    )

    $packageReports = @($Packages | ForEach-Object {
        [ordered]@{
            name = $_.Name
            package_id = Get-PackageIdFromName -PackageName $_.Name -Version $PackageVersion -Extension ".nupkg"
            path = $_.FullName
            sha256 = Get-FileSha256 -Path $_.FullName
            byte_count = $_.Length
        }
    })
    $symbolPackageReports = @($SymbolPackages | ForEach-Object {
        [ordered]@{
            name = $_.Name
            package_id = Get-PackageIdFromName -PackageName $_.Name -Version $PackageVersion -Extension ".snupkg"
            path = $_.FullName
            sha256 = Get-FileSha256 -Path $_.FullName
            byte_count = $_.Length
        }
    })
    $sourceProvenance = Get-SourceProvenance
    $report = [ordered]@{
        schema = "uaix.browser.nuget.publish_plan.v0"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        status = $Status
        package_source = $PackageSource
        nuget_source = $NuGetSource
        package_version = $PackageVersion
        dry_run = $DryRunValue
        skip_verification = $SkipVerificationValue
        secret_material_included = $false
        source_provenance_available = $sourceProvenance.source_provenance_available
        source_provenance = $sourceProvenance
        package_audit_report_path = $AuditEvidence.package_audit_report_path
        package_audit_report_sha256 = $AuditEvidence.package_audit_report_sha256
        package_audit_schema = $AuditEvidence.package_audit_schema
        package_audit_status = $AuditEvidence.package_audit_status
        package_audit_match = $AuditEvidence.package_audit_match
        package_audit_error = $AuditEvidence.package_audit_error
        package_hash_manifest_name = $HashManifestEvidence.package_hash_manifest_name
        package_hash_manifest_path = $HashManifestEvidence.package_hash_manifest_path
        package_hash_manifest_sha256 = $HashManifestEvidence.package_hash_manifest_sha256
        package_hash_manifest_status = $HashManifestEvidence.package_hash_manifest_status
        package_hash_manifest_match = $HashManifestEvidence.package_hash_manifest_match
        package_hash_manifest_error = $HashManifestEvidence.package_hash_manifest_error
        feed_readme_name = $FeedReadmeEvidence.feed_readme_name
        feed_readme_path = $FeedReadmeEvidence.feed_readme_path
        feed_readme_sha256 = $FeedReadmeEvidence.feed_readme_sha256
        feed_readme_status = $FeedReadmeEvidence.feed_readme_status
        feed_readme_match = $FeedReadmeEvidence.feed_readme_match
        feed_readme_missing_term_count = $FeedReadmeEvidence.feed_readme_missing_term_count
        feed_readme_error = $FeedReadmeEvidence.feed_readme_error
        publish_error = $PublishError
        package_count = $packageReports.Count
        symbol_package_count = $symbolPackageReports.Count
        expected_package_ids = @($ExpectedPackageIds)
        expected_package_names = @($ExpectedNames)
        expected_symbol_package_names = @($ExpectedSymbolNames)
        symbol_publish_mode = "explicit_snupkg_push_after_primary_package"
        packages = @($packageReports)
        symbol_packages = @($symbolPackageReports)
    }

    $reportDirectory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Host "UAIX Browser NuGet publish plan written to $OutputPath"
}

if (-not $PackageSource) {
    $PackageSource = if ($env:UAIX_BROWSER_NUGET_FEED) { $env:UAIX_BROWSER_NUGET_FEED } else { Join-Path $RepoRoot "artifacts/browser-feed" }
}
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $ApiKey) {
    $ApiKey = $env:NUGET_API_KEY
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if (-not $AuditReport) {
    $AuditReport = Join-Path $RepoRoot "artifacts/reports/uaix-browser-nuget-feed-audit.json"
}
if (-not $ReportOutput) {
    $ReportOutput = if ($env:UAIX_BROWSER_PUBLISH_PLAN_REPORT) {
        $env:UAIX_BROWSER_PUBLISH_PLAN_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/uaix-browser-nuget-publish-plan.json"
    }
}

Push-Location $RepoRoot
try {
    if (-not $SkipVerification) {
        & (Join-Path $PSScriptRoot "verify-browser-feed.ps1") -PackageSource $PackageSource -PackageVersion $PackageVersion -ReportOutput $AuditReport
    }

    if (-not (Test-Path -LiteralPath $PackageSource -PathType Container)) {
        throw "UAIX Browser package source does not exist: $PackageSource"
    }
    $PackageSource = (Resolve-Path -LiteralPath $PackageSource).Path
    $packages = @(Get-ChildItem -Path $PackageSource -Filter "UAIX.Browser*.nupkg" -File | Sort-Object Name)
    $symbolPackages = @(Get-ChildItem -Path $PackageSource -Filter "UAIX.Browser*.snupkg" -File | Sort-Object Name)
    if ($packages.Count -eq 0) {
        throw "No UAIX Browser packages were found in $PackageSource"
    }

    $expectedNames = @($expectedPackageIds | ForEach-Object { "$_.$PackageVersion.nupkg" })
    $expectedSymbolNames = @($expectedPackageIds | ForEach-Object { "$_.$PackageVersion.snupkg" })
    foreach ($expectedName in $expectedNames) {
        if (-not ($packages | Where-Object { $_.Name -eq $expectedName })) {
            throw "Required UAIX Browser package is missing from publish set: $expectedName"
        }
    }
    foreach ($expectedName in $expectedSymbolNames) {
        if (-not ($symbolPackages | Where-Object { $_.Name -eq $expectedName })) {
            throw "Required UAIX Browser symbol package is missing from publish set: $expectedName"
        }
    }
    $unexpectedPackages = @($packages | Where-Object { $expectedNames -notcontains $_.Name })
    if ($unexpectedPackages.Count -gt 0) {
        throw "Publish set contains unexpected UAIX Browser package(s): $(($unexpectedPackages | ForEach-Object { $_.Name }) -join ', '). Expected exactly: $($expectedNames -join ', ')"
    }
    $unexpectedSymbolPackages = @($symbolPackages | Where-Object { $expectedSymbolNames -notcontains $_.Name })
    if ($unexpectedSymbolPackages.Count -gt 0) {
        throw "Publish set contains unexpected UAIX Browser symbol package(s): $(($unexpectedSymbolPackages | ForEach-Object { $_.Name }) -join ', '). Expected exactly: $($expectedSymbolNames -join ', ')"
    }

    $auditEvidence = Test-BrowserFeedAuditBinding -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -AuditReportPath $AuditReport
    $hashManifestEvidence = Test-BrowserHashManifestBinding -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -PackageSourcePath $PackageSource -PackageVersion $PackageVersion
    $feedReadmeEvidence = Test-BrowserFeedReadmeBinding -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -PackageSourcePath $PackageSource -PackageVersion $PackageVersion -AuditReportPath $AuditReport
    if (-not $auditEvidence.package_audit_match) {
        $blockedStatus = if ($auditEvidence.package_audit_status -eq "missing") { "blocked_missing_audit_report" } else { "blocked_audit_mismatch" }
        Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status $blockedStatus -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue ([bool]$DryRun) -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence
        throw $auditEvidence.package_audit_error
    }
    if (-not $hashManifestEvidence.package_hash_manifest_match) {
        $blockedStatus = if ($hashManifestEvidence.package_hash_manifest_status -eq "missing") { "blocked_missing_hash_manifest" } else { "blocked_hash_manifest_mismatch" }
        Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status $blockedStatus -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue ([bool]$DryRun) -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence
        throw $hashManifestEvidence.package_hash_manifest_error
    }
    if (-not $feedReadmeEvidence.feed_readme_match) {
        $blockedStatus = if ($feedReadmeEvidence.feed_readme_status -eq "missing") { "blocked_missing_feed_readme" } else { "blocked_feed_readme_mismatch" }
        Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status $blockedStatus -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue ([bool]$DryRun) -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence
        throw $feedReadmeEvidence.feed_readme_error
    }

    Write-Host "UAIX Browser NuGet publish set:"
    foreach ($package in $packages) {
        Write-Host " - $($package.Name)"
    }
    Write-Host "UAIX Browser NuGet symbol publish set:"
    foreach ($symbolPackage in $symbolPackages) {
        Write-Host " - $($symbolPackage.Name)"
    }
    Write-Host "NuGet source: $NuGetSource"
    Write-Host "Package version: $PackageVersion"

    if ($DryRun) {
        Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status "dry_run" -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue $true -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence
        Write-Host "Dry run requested; UAIX Browser packages were not pushed."
        return
    }
    if (-not $ApiKey) {
        Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status "blocked_missing_api_key" -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue $false -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence
        throw "NUGET_API_KEY or -ApiKey is required unless -DryRun is used."
    }

    Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status "ready_to_push" -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue $false -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence

    try {
        Push-Location $PackageSource
        try {
            foreach ($package in $packages) {
                Invoke-DotNet -Arguments @("nuget", "push", $package.Name, "--source", $NuGetSource, "--api-key", $ApiKey, "--no-symbols", "--skip-duplicate")
            }
            foreach ($symbolPackage in $symbolPackages) {
                Invoke-DotNet -Arguments @("nuget", "push", $symbolPackage.Name, "--source", $NuGetSource, "--api-key", $ApiKey, "--skip-duplicate")
            }
        }
        finally {
            Pop-Location
        }
    }
    catch {
        $publishError = $_.Exception.Message
        if ($ApiKey) {
            $publishError = $publishError.Replace($ApiKey, "<redacted>")
        }
        Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status "push_failed" -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue $false -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence -PublishError $publishError
        throw
    }

    Write-BrowserPublishPlanReport -OutputPath $ReportOutput -Status "pushed" -Packages $packages -SymbolPackages $symbolPackages -ExpectedNames $expectedNames -ExpectedSymbolNames $expectedSymbolNames -ExpectedPackageIds $expectedPackageIds -PackageSource $PackageSource -NuGetSource $NuGetSource -PackageVersion $PackageVersion -DryRunValue $false -SkipVerificationValue ([bool]$SkipVerification) -AuditEvidence $auditEvidence -HashManifestEvidence $hashManifestEvidence -FeedReadmeEvidence $feedReadmeEvidence
}
finally {
    Pop-Location
}
