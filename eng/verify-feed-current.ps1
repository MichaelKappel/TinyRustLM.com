param(
    [string]$NuGetSource = "",
    [string]$PackageVersion = "",
    [string]$ReportOutput = "",
    [string[]]$PackageIds = @(),
    [switch]$AllowNewer
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-feed-current.json"
}

if ($PackageIds.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($env:TINYRUSTLM_FEED_PACKAGE_IDS)) {
    $PackageIds = @($env:TINYRUSTLM_FEED_PACKAGE_IDS -split "[,;]" |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

$requiredPackages = if ($PackageIds.Count -gt 0) {
    @($PackageIds | Sort-Object -Unique)
}
else {
    @(
        "TinyRustLM.Abstractions",
        "TinyRustLM.Core",
        "TinyRustLM.P2P",
        "TinyRustLM.Memory"
    )
}

function ConvertTo-SemVerRecord {
    param([string]$Version)

    $withoutBuild = ($Version -split "\+", 2)[0]
    $parts = $withoutBuild -split "-", 2
    $core = $parts[0] -split "\."
    $major = 0
    $minor = 0
    $patch = 0
    if ($core.Count -gt 0) { [void][int]::TryParse($core[0], [ref]$major) }
    if ($core.Count -gt 1) { [void][int]::TryParse($core[1], [ref]$minor) }
    if ($core.Count -gt 2) { [void][int]::TryParse($core[2], [ref]$patch) }
    $preRelease = if ($parts.Count -gt 1) { $parts[1].ToLowerInvariant() } else { "" }
    $preReleaseKey = if ($preRelease) {
        (($preRelease -split "\.") | ForEach-Object {
            if ($_ -match "^\d+$") {
                "0:{0:D20}" -f [int64]$_
            }
            else {
                "1:$($_.ToLowerInvariant())"
            }
        }) -join "|"
    }
    else {
        ""
    }

    [pscustomobject]@{
        version = $Version
        major = $major
        minor = $minor
        patch = $patch
        release_weight = if ($preRelease) { 0 } else { 1 }
        pre_release = $preRelease
        pre_release_key = $preReleaseKey
    }
}

function Get-LatestVersion {
    param([string[]]$Versions)

    if (-not $Versions -or $Versions.Count -eq 0) {
        return ""
    }

    return @($Versions | ForEach-Object { ConvertTo-SemVerRecord -Version $_ } |
        Sort-Object major, minor, patch, release_weight, pre_release_key |
        Select-Object -Last 1).version
}

function Get-LocalPackageVersions {
    param(
        [string]$PackageDirectory,
        [string]$PackageId
    )

    $prefix = "$PackageId."
    $suffix = ".nupkg"
    $versions = @()
    foreach ($package in Get-ChildItem -LiteralPath $PackageDirectory -Filter "$PackageId.*.nupkg" -File) {
        if ($package.Name.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -and
            $package.Name.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
            $versions += $package.Name.Substring($prefix.Length, $package.Name.Length - $prefix.Length - $suffix.Length)
        }
    }
    return @($versions | Sort-Object -Unique)
}

function Get-NuGetFlatContainerBaseUrl {
    param([string]$Source)

    $index = Invoke-RestMethod -Uri $Source -Headers @{ "User-Agent" = "TinyRustLM-NuGet-Freshness/1.0" }
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

function Get-RemotePackageVersions {
    param(
        [string]$FlatContainerBaseUrl,
        [string]$PackageId
    )

    $packageIndexUrl = "$FlatContainerBaseUrl$($PackageId.ToLowerInvariant())/index.json"
    try {
        $packageIndex = Invoke-RestMethod -Uri $packageIndexUrl -Headers @{ "User-Agent" = "TinyRustLM-NuGet-Freshness/1.0" }
    }
    catch {
        return @()
    }
    if (-not $packageIndex.versions) {
        return @()
    }
    return @($packageIndex.versions | ForEach-Object { [string]$_ })
}

$sourceKind = if (Test-Path -LiteralPath $NuGetSource -PathType Container) { "folder" } else { "nuget-v3" }
$resolvedSource = if ($sourceKind -eq "folder") { (Resolve-Path -LiteralPath $NuGetSource).Path } else { $NuGetSource }
$flatContainerBaseUrl = if ($sourceKind -eq "nuget-v3") { Get-NuGetFlatContainerBaseUrl -Source $NuGetSource } else { "" }

$packageReports = @()
foreach ($packageId in $requiredPackages) {
    if ($sourceKind -eq "folder") {
        $versions = @(Get-LocalPackageVersions -PackageDirectory $resolvedSource -PackageId $packageId)
    }
    else {
        $versions = @(Get-RemotePackageVersions -FlatContainerBaseUrl $flatContainerBaseUrl -PackageId $packageId)
    }
    $latest = Get-LatestVersion -Versions $versions
    $declaredPresent = @($versions | Where-Object { $_ -ieq $PackageVersion }).Count -gt 0
    $declaredLatest = $latest -and ($latest -ieq $PackageVersion)
    $packageReports += [ordered]@{
        package_id = $packageId
        declared_version = $PackageVersion
        declared_version_present = $declaredPresent
        latest_reported_version = $latest
        declared_version_is_latest_reported = $declaredLatest
        version_count = $versions.Count
        listed_versions = @($versions)
    }
}

$missingDeclared = @($packageReports | Where-Object { -not $_.declared_version_present })
$notLatest = @($packageReports | Where-Object { -not $_.declared_version_is_latest_reported })
$status = if ($missingDeclared.Count -eq 0 -and ($AllowNewer -or $notLatest.Count -eq 0)) { "pass" } else { "fail" }
$report = [ordered]@{
    schema = "tinyrustlm.nuget.feed_current.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    source = $resolvedSource
    source_kind = $sourceKind
    package_version = $PackageVersion
    package_ids = @($requiredPackages)
    allow_newer = [bool]$AllowNewer
    status = $status
    package_count = $packageReports.Count
    missing_declared_version_count = $missingDeclared.Count
    not_latest_count = if ($AllowNewer) { 0 } else { $notLatest.Count }
    packages = @($packageReports)
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "TinyRustLM NuGet feed-current report written to $ReportOutput"

if ($status -ne "pass") {
    throw "TinyRustLM NuGet feed-current verification failed. See $ReportOutput"
}
Write-Host "TinyRustLM NuGet feed is current: $resolvedSource @ $PackageVersion"
