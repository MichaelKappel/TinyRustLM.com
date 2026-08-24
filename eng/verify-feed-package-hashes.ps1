param(
    [string]$NuGetSource = "",
    [string]$PublishPlanReport = "",
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $PublishPlanReport) {
    $PublishPlanReport = if ($env:TINYRUSTLM_PUBLISH_PLAN_REPORT) {
        $env:TINYRUSTLM_PUBLISH_PLAN_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-publish-plan.json"
    }
}
if (-not $ReportOutput) {
    $ReportOutput = if ($env:TINYRUSTLM_FEED_HASH_REPORT) {
        $env:TINYRUSTLM_FEED_HASH_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-feed-hashes.json"
    }
}

function Get-FileSha256 {
    param([string]$Path)

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-NuGetFlatContainerBaseUrl {
    param([string]$Source)

    $index = Invoke-RestMethod -Uri $Source -Headers @{ "User-Agent" = "TinyRustLM-NuGet-Hash/1.0" }
    $resource = $index.resources | Where-Object {
        $resourceTypes = @($_."@type")
        @($resourceTypes | Where-Object { [string]$_ -like "*PackageBaseAddress/3.0.0*" }).Count -gt 0
    } | Select-Object -First 1
    if (-not $resource -or -not $resource."@id") {
        throw "NuGet source does not expose PackageBaseAddress/3.0.0: $Source"
    }
    $baseUrl = [string]$resource."@id"
    if (-not $baseUrl.EndsWith("/")) {
        $baseUrl += "/"
    }
    return $baseUrl
}

function Get-RemotePackageUrl {
    param(
        [string]$FlatContainerBaseUrl,
        [string]$PackageId,
        [string]$PackageVersion
    )

    $lowerId = $PackageId.ToLowerInvariant()
    $lowerVersion = $PackageVersion.ToLowerInvariant()
    return "$FlatContainerBaseUrl$lowerId/$lowerVersion/$lowerId.$lowerVersion.nupkg"
}

if (-not (Test-Path -LiteralPath $PublishPlanReport)) {
    throw "Publish plan report does not exist: $PublishPlanReport"
}
$PublishPlanReport = (Resolve-Path -LiteralPath $PublishPlanReport).Path
$publishPlan = Get-Content -LiteralPath $PublishPlanReport -Raw | ConvertFrom-Json
if ([string]$publishPlan.schema -ne "tinyrustlm.nuget.publish_plan.v0") {
    throw "Publish plan report schema mismatch: $($publishPlan.schema)"
}
if (-not $publishPlan.package_audit_match) {
    throw "Publish plan report is not bound to a passing package audit: $PublishPlanReport"
}
if (-not $publishPlan.package_hash_manifest_match) {
    throw "Publish plan report is not bound to a passing package SHA-256 manifest: $PublishPlanReport"
}
if ([string]::IsNullOrWhiteSpace([string]$publishPlan.package_hash_manifest_sha256) -or [string]$publishPlan.package_hash_manifest_sha256 -notmatch "^[0-9a-f]{64}$") {
    throw "Publish plan report is missing a valid package SHA-256 manifest hash: $PublishPlanReport"
}
$expectedPackageIds = @(
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P"
)
$publishPackageIds = @($publishPlan.packages | ForEach-Object { [string]$_.package_id } | Sort-Object)
$publishSymbolPackageIds = @($publishPlan.symbol_packages | ForEach-Object { [string]$_.package_id } | Sort-Object)
$expectedSortedPackageIds = @($expectedPackageIds | Sort-Object)
if (($publishPackageIds -join "`n") -cne ($expectedSortedPackageIds -join "`n")) {
    throw "Publish plan package IDs are not the exact current public package set."
}
if (($publishSymbolPackageIds -join "`n") -cne ($expectedSortedPackageIds -join "`n")) {
    throw "Publish plan symbol package IDs are not the exact current public package set."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipEntryHashManifest {
    param([string]$Path)

    $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entries = @()
        foreach ($entry in @($archive.Entries | Sort-Object FullName)) {
            if ([string]::IsNullOrEmpty($entry.Name)) {
                continue
            }

            $stream = $entry.Open()
            try {
                $sha = [System.Security.Cryptography.SHA256]::Create()
                try {
                    $hashBytes = $sha.ComputeHash($stream)
                }
                finally {
                    $sha.Dispose()
                }
            }
            finally {
                $stream.Dispose()
            }

            $entries += [pscustomobject]@{
                entry_name = $entry.FullName
                byte_count = [int64]$entry.Length
                sha256 = (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
            }
        }
        return @($entries)
    }
    finally {
        $archive.Dispose()
    }
}

function Test-RepositorySignedPackagePayload {
    param(
        [string]$ExpectedPackagePath,
        [string]$ActualPackagePath
    )

    if ([string]::IsNullOrWhiteSpace($ExpectedPackagePath) -or -not (Test-Path -LiteralPath $ExpectedPackagePath -PathType Leaf)) {
        return [ordered]@{
            mode = "unavailable"
            match = $false
            repository_signature_accepted = $false
            expected_package_path = $ExpectedPackagePath
            allowed_extra_entries = @(".signature.p7s")
            extra_allowed_entries = @()
            missing_entry_count = 0
            unexpected_entry_count = 0
            changed_entry_count = 0
            missing_entries = @()
            unexpected_entries = @()
            changed_entries = @()
            error_message = "Expected local package path from the publish plan is unavailable."
        }
    }

    try {
        $expectedEntries = @(Get-ZipEntryHashManifest -Path $ExpectedPackagePath)
        $actualEntries = @(Get-ZipEntryHashManifest -Path $ActualPackagePath)
        $expectedByName = @{}
        foreach ($entry in $expectedEntries) {
            $expectedByName[[string]$entry.entry_name] = $entry
        }
        $actualByName = @{}
        foreach ($entry in $actualEntries) {
            $actualByName[[string]$entry.entry_name] = $entry
        }

        $allowedExtraEntries = @(".signature.p7s")
        $missing = @()
        $changed = @()
        foreach ($name in @($expectedByName.Keys | Sort-Object)) {
            if (-not $actualByName.ContainsKey($name)) {
                $missing += $name
                continue
            }
            $expected = $expectedByName[$name]
            $actual = $actualByName[$name]
            if ([int64]$expected.byte_count -ne [int64]$actual.byte_count -or [string]$expected.sha256 -ne [string]$actual.sha256) {
                $changed += $name
            }
        }

        $unexpected = @()
        $extraAllowed = @()
        foreach ($name in @($actualByName.Keys | Sort-Object)) {
            if ($expectedByName.ContainsKey($name)) {
                continue
            }
            if ($allowedExtraEntries -contains $name) {
                $extraAllowed += $name
            }
            else {
                $unexpected += $name
            }
        }

        $matches = $missing.Count -eq 0 -and $changed.Count -eq 0 -and $unexpected.Count -eq 0 -and $extraAllowed.Count -gt 0
        return [ordered]@{
            mode = "zip_payload_allow_repository_signature"
            match = $matches
            repository_signature_accepted = $matches
            expected_package_path = $ExpectedPackagePath
            allowed_extra_entries = $allowedExtraEntries
            extra_allowed_entries = @($extraAllowed)
            missing_entry_count = $missing.Count
            unexpected_entry_count = $unexpected.Count
            changed_entry_count = $changed.Count
            missing_entries = @($missing)
            unexpected_entries = @($unexpected)
            changed_entries = @($changed)
            error_message = ""
        }
    }
    catch {
        return [ordered]@{
            mode = "zip_payload_allow_repository_signature"
            match = $false
            repository_signature_accepted = $false
            expected_package_path = $ExpectedPackagePath
            allowed_extra_entries = @(".signature.p7s")
            extra_allowed_entries = @()
            missing_entry_count = 0
            unexpected_entry_count = 0
            changed_entry_count = 0
            missing_entries = @()
            unexpected_entries = @()
            changed_entries = @()
            error_message = $_.Exception.Message
        }
    }
}

$sourceKind = if (Test-Path -LiteralPath $NuGetSource -PathType Container) { "folder" } else { "nuget-v3" }
$resolvedSource = if ($sourceKind -eq "folder") { (Resolve-Path -LiteralPath $NuGetSource).Path } else { $NuGetSource }
$flatContainerBaseUrl = if ($sourceKind -eq "nuget-v3") { Get-NuGetFlatContainerBaseUrl -Source $NuGetSource } else { "" }
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "tinyrustlm-feed-hashes-$([Guid]::NewGuid().ToString('N'))"

$packageReports = @()
$symbolPackageReports = @()
$symbolPackageVerificationMode = if ($sourceKind -eq "folder") { "folder" } else { "nuget_v3_package_feed_does_not_expose_snupkg_symbols" }
try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    foreach ($package in @($publishPlan.packages)) {
        $name = [string]$package.name
        $packageId = [string]$package.package_id
        $expectedSha256 = ([string]$package.sha256).ToLowerInvariant()
        $expectedByteCount = [int64]$package.byte_count
        $sourcePath = ""
        $actualSha256 = ""
        $actualByteCount = 0
        $present = $false
        $errorMessage = ""
        $payloadVerification = [ordered]@{
            mode = "exact_package_bytes"
            match = $false
            repository_signature_accepted = $false
            expected_package_path = ""
            allowed_extra_entries = @()
            extra_allowed_entries = @()
            missing_entry_count = 0
            unexpected_entry_count = 0
            changed_entry_count = 0
            missing_entries = @()
            unexpected_entries = @()
            changed_entries = @()
            error_message = ""
        }

        try {
            if ($sourceKind -eq "folder") {
                $sourcePath = Join-Path $resolvedSource $name
                if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
                    throw "Package file does not exist in feed folder: $sourcePath"
                }
            }
            else {
                $sourcePath = Get-RemotePackageUrl -FlatContainerBaseUrl $flatContainerBaseUrl -PackageId $packageId -PackageVersion ([string]$publishPlan.package_version)
                $downloadPath = Join-Path $tempRoot $name
                Invoke-WebRequest -Uri $sourcePath -OutFile $downloadPath -Headers @{ "User-Agent" = "TinyRustLM-NuGet-Hash/1.0" } | Out-Null
                $sourcePath = $downloadPath
            }

            $present = $true
            $actualSha256 = Get-FileSha256 -Path $sourcePath
            $actualByteCount = (Get-Item -LiteralPath $sourcePath).Length
            $exactMatch = $actualSha256 -eq $expectedSha256 -and [int64]$actualByteCount -eq $expectedByteCount
            if ($exactMatch) {
                $payloadVerification.match = $true
            }
            elseif ($sourceKind -eq "nuget-v3") {
                $payloadVerification = Test-RepositorySignedPackagePayload `
                    -ExpectedPackagePath ([string]$package.path) `
                    -ActualPackagePath $sourcePath
            }
        }
        catch {
            $errorMessage = $_.Exception.Message
        }

        $exactShaMatch = $present -and ($actualSha256 -eq $expectedSha256)
        $exactByteMatch = $present -and ([int64]$actualByteCount -eq $expectedByteCount)
        $packageReports += [ordered]@{
            package_id = $packageId
            name = $name
            feed_location = if ($sourceKind -eq "nuget-v3" -and $present) {
                Get-RemotePackageUrl -FlatContainerBaseUrl $flatContainerBaseUrl -PackageId $packageId -PackageVersion ([string]$publishPlan.package_version)
            } else {
                $sourcePath
            }
            present = $present
            expected_sha256 = $expectedSha256
            actual_sha256 = $actualSha256
            sha256_match = $exactShaMatch
            expected_byte_count = $expectedByteCount
            actual_byte_count = $actualByteCount
            byte_count_match = $exactByteMatch
            package_integrity_match = $present -and ($exactShaMatch -and $exactByteMatch -or [bool]$payloadVerification.match)
            repository_signature_accepted = [bool]$payloadVerification.repository_signature_accepted
            payload_verification = $payloadVerification
            error_message = $errorMessage
        }
    }

    if ($sourceKind -eq "folder") {
        foreach ($symbolPackage in @($publishPlan.symbol_packages)) {
            $name = [string]$symbolPackage.name
            $packageId = [string]$symbolPackage.package_id
            $expectedSha256 = ([string]$symbolPackage.sha256).ToLowerInvariant()
            $expectedByteCount = [int64]$symbolPackage.byte_count
            $sourcePath = Join-Path $resolvedSource $name
            $actualSha256 = ""
            $actualByteCount = 0
            $present = $false
            $errorMessage = ""

            try {
                if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
                    throw "Symbol package file does not exist in feed folder: $sourcePath"
                }

                $present = $true
                $actualSha256 = Get-FileSha256 -Path $sourcePath
                $actualByteCount = (Get-Item -LiteralPath $sourcePath).Length
            }
            catch {
                $errorMessage = $_.Exception.Message
            }

            $symbolPackageReports += [ordered]@{
                package_id = $packageId
                name = $name
                feed_location = $sourcePath
                present = $present
                expected_sha256 = $expectedSha256
                actual_sha256 = $actualSha256
                sha256_match = $present -and ($actualSha256 -eq $expectedSha256)
                expected_byte_count = $expectedByteCount
                actual_byte_count = $actualByteCount
                byte_count_match = $present -and ([int64]$actualByteCount -eq $expectedByteCount)
                error_message = $errorMessage
            }
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

$missingPackages = @($packageReports | Where-Object { -not $_.present })
$hashMismatches = @($packageReports | Where-Object { $_.present -and -not $_.sha256_match })
$sizeMismatches = @($packageReports | Where-Object { $_.present -and -not $_.byte_count_match })
$integrityMismatches = @($packageReports | Where-Object { -not $_.package_integrity_match })
$repositorySignatureAccepted = @($packageReports | Where-Object { $_.repository_signature_accepted })
$missingSymbolPackages = @($symbolPackageReports | Where-Object { -not $_.present })
$symbolHashMismatches = @($symbolPackageReports | Where-Object { $_.present -and -not $_.sha256_match })
$symbolSizeMismatches = @($symbolPackageReports | Where-Object { $_.present -and -not $_.byte_count_match })
$status = if (
    $missingPackages.Count -eq 0 `
        -and $integrityMismatches.Count -eq 0 `
        -and $missingSymbolPackages.Count -eq 0 `
        -and $symbolHashMismatches.Count -eq 0 `
        -and $symbolSizeMismatches.Count -eq 0
) { "pass" } else { "fail" }
$report = [ordered]@{
    schema = "tinyrustlm.nuget.feed_hashes.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = $status
    source = $resolvedSource
    source_kind = $sourceKind
    package_version = [string]$publishPlan.package_version
    publish_plan_schema = [string]$publishPlan.schema
    publish_plan_report_path = $PublishPlanReport
    publish_plan_report_sha256 = Get-FileSha256 -Path $PublishPlanReport
    package_audit_report_sha256 = [string]$publishPlan.package_audit_report_sha256
    package_hash_manifest_sha256 = [string]$publishPlan.package_hash_manifest_sha256
    package_hash_manifest_match = [bool]$publishPlan.package_hash_manifest_match
    secret_material_included = $false
    package_count = $packageReports.Count
    missing_package_count = $missingPackages.Count
    hash_mismatch_count = $hashMismatches.Count
    byte_count_mismatch_count = $sizeMismatches.Count
    package_integrity_mismatch_count = $integrityMismatches.Count
    repository_signature_accepted_count = $repositorySignatureAccepted.Count
    packages = @($packageReports)
    symbol_package_verification_mode = $symbolPackageVerificationMode
    symbol_package_expected_count = @($publishPlan.symbol_packages).Count
    symbol_package_count = $symbolPackageReports.Count
    missing_symbol_package_count = $missingSymbolPackages.Count
    symbol_hash_mismatch_count = $symbolHashMismatches.Count
    symbol_byte_count_mismatch_count = $symbolSizeMismatches.Count
    symbol_packages = @($symbolPackageReports)
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "TinyRustLM NuGet feed-hashes report written to $ReportOutput"

if ($status -ne "pass") {
    throw "TinyRustLM NuGet feed hash verification failed. See $ReportOutput"
}
Write-Host "TinyRustLM NuGet feed package hashes match publish plan: $resolvedSource"
