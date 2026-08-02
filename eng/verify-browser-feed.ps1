param(
    [string]$PackageSource = "",
    [string]$PackageVersion = "",
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $PackageSource) {
    $PackageSource = if ($env:UAIX_BROWSER_NUGET_FEED) { $env:UAIX_BROWSER_NUGET_FEED } else { Join-Path $RepoRoot "artifacts/browser-feed" }
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/uaix-browser-nuget-feed-audit.json"
}
if (-not (Test-Path -LiteralPath $PackageSource -PathType Container)) {
    throw "Browser package source does not exist: $PackageSource"
}
$PackageSource = (Resolve-Path -LiteralPath $PackageSource).Path

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Read-ZipEntryText {
    param($Entry)

    $stream = $Entry.Open()
    try {
        $reader = [System.IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-XmlText {
    param(
        [xml]$Document,
        [string]$ElementName
    )

    $node = $Document.SelectSingleNode("//*[local-name()='$ElementName']")
    if ($node) {
        return $node.InnerText.Trim()
    }
    return ""
}

function Read-NuspecMetadata {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return [ordered]@{}
    }

    [xml]$nuspec = $NuspecText
    $repository = $nuspec.SelectSingleNode("//*[local-name()='repository']")
    $license = $nuspec.SelectSingleNode("//*[local-name()='license']")
    return [ordered]@{
        id = Get-XmlText -Document $nuspec -ElementName "id"
        version = Get-XmlText -Document $nuspec -ElementName "version"
        title = Get-XmlText -Document $nuspec -ElementName "title"
        description = Get-XmlText -Document $nuspec -ElementName "description"
        authors = Get-XmlText -Document $nuspec -ElementName "authors"
        project_url = Get-XmlText -Document $nuspec -ElementName "projectUrl"
        repository_url = if ($repository) { $repository.GetAttribute("url") } else { "" }
        repository_type = if ($repository) { $repository.GetAttribute("type") } else { "" }
        license = if ($license) { $license.InnerText.Trim() } else { "" }
        license_type = if ($license) { $license.GetAttribute("type") } else { "" }
        readme = Get-XmlText -Document $nuspec -ElementName "readme"
        tags = Get-XmlText -Document $nuspec -ElementName "tags"
        release_notes = Get-XmlText -Document $nuspec -ElementName "releaseNotes"
        require_license_acceptance = Get-XmlText -Document $nuspec -ElementName "requireLicenseAcceptance"
    }
}

function Read-NuspecDependencies {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return @()
    }

    [xml]$nuspec = $NuspecText
    $dependencies = @()
    foreach ($node in $nuspec.SelectNodes("//*[local-name()='dependency']")) {
        $dependencies += [ordered]@{
            id = $node.GetAttribute("id")
            version = $node.GetAttribute("version")
            exclude = $node.GetAttribute("exclude")
        }
    }
    return $dependencies
}

function Test-SymbolsPackageType {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return $false
    }

    [xml]$nuspec = $NuspecText
    foreach ($node in $nuspec.SelectNodes("//*[local-name()='packageType']")) {
        if ($node.GetAttribute("name") -eq "SymbolsPackage") {
            return $true
        }
    }
    return $false
}

function Test-SymbolPackageEntryAllowed {
    param([string]$EntryName)

    if ($EntryName -eq "[Content_Types].xml" -or $EntryName -eq "_rels/.rels") {
        return $true
    }
    if ($EntryName -match "^[^/]+\.nuspec$") {
        return $true
    }
    if ($EntryName -match "^package/services/metadata/core-properties/[^/]+\.psmdcp$") {
        return $true
    }
    if ($EntryName -match "^lib/[^/]+/TinyRustLM\.[^/]+\.pdb$") {
        return $true
    }
    return $false
}

function Get-SymbolPackageUnexpectedEntries {
    param([string[]]$EntryNames)

    return @($EntryNames | Where-Object { -not (Test-SymbolPackageEntryAllowed -EntryName $_) })
}

function Get-ExpectedPackages {
    param([string]$Version)

    return @(
        [ordered]@{
            id = "UAIX.Browser.Core.Abstractions"
            name = "UAIX.Browser.Core.Abstractions.$Version.nupkg"
            dependencies = @()
            terms = @("TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pRuntime", "p2pRuntime.com", "p2pLLM", "p2pLLM.com", "MiniModel", ".slm", ".uai", "memory", "persona")
        },
        [ordered]@{
            id = "UAIX.Browser.p2pLLM.Runtime"
            name = "UAIX.Browser.p2pLLM.Runtime.$Version.nupkg"
            dependencies = @("UAIX.Browser.Core.Abstractions")
            terms = @("TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pLLM", "p2pLLM.com", ".slm", "runtime", "harness", "diagnostics")
        },
        [ordered]@{
            id = "UAIX.Browser.p2pRuntime.P2P"
            name = "UAIX.Browser.p2pRuntime.P2P.$Version.nupkg"
            dependencies = @("UAIX.Browser.Core.Abstractions", "UAIX.Browser.p2pLLM.Runtime")
            terms = @("TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pRuntime", "p2pRuntime.com", "P2P", "MiniModel", "manifest", "announcement", "catalog", "receipt", ".slm")
        },
        [ordered]@{
            id = "UAIX.Browser.Memory"
            name = "UAIX.Browser.Memory.$Version.nupkg"
            dependencies = @("UAIX.Browser.Core.Abstractions", "UAIX.Browser.p2pLLM.Runtime")
            terms = @("TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "memory", "ai-memory", ".uai", ".uaix", "persona", "AI Memory Package Wizard", "ai-digest", "point-agent-urls", "canonical-starter-zip", "safe-structured-output", "agent-pickup", "session-log", "manifest-overlay", "package-model", "knowledge-graph", "personality-pack", "persona-deck", "triggered-style-axes")
        },
        [ordered]@{
            id = "UAIX.Browser.p2pLLM.Conversion"
            name = "UAIX.Browser.p2pLLM.Conversion.$Version.nupkg"
            dependencies = @("UAIX.Browser.p2pLLM.Runtime")
            terms = @("TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pLLM", "p2pLLM.com", ".slm", "conversion", "local-feed")
        }
    )
}

function Get-MissingMetadataFields {
    param($Metadata)

    $required = @("id", "version", "title", "description", "authors", "project_url", "repository_url", "repository_type", "license", "license_type", "readme", "tags", "release_notes")
    $missing = @()
    foreach ($field in $required) {
        if ([string]::IsNullOrWhiteSpace([string]$Metadata[$field])) {
            $missing += $field
        }
    }
    if ($Metadata.require_license_acceptance -ne "true") {
        $missing += "require_license_acceptance"
    }
    if ($Metadata.license_type -ne "file") {
        $missing += "license_type:file"
    }
    if ($Metadata.readme -ne "README.md") {
        $missing += "readme:README.md"
    }
    return $missing
}

function Normalize-MetadataUrl {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    $normalized = $Value.Trim()
    if (-not $normalized.EndsWith("/", [StringComparison]::Ordinal)) {
        $normalized = "$normalized/"
    }
    return $normalized.ToLowerInvariant()
}

function Get-MetadataPolicyViolations {
    param(
        [string]$PackageId,
        $Metadata
    )

    $violations = @()
    if ((Normalize-MetadataUrl -Value ([string]$Metadata.project_url)) -ne "https://tinyrustlm.com/") {
        $violations += "project_url:https://tinyrustlm.com/"
    }
    if ([string]$Metadata.repository_type -ne "git") {
        $violations += "repository_type:git"
    }
    if ([string]$Metadata.license_type -ne "file" -or [string]$Metadata.license -ne "LICENSE.txt") {
        $violations += "license_file:LICENSE.txt"
    }
    if ([string]$Metadata.readme -ne "README.md") {
        $violations += "readme:README.md"
    }
    if ([string]$Metadata.require_license_acceptance -ne "true") {
        $violations += "require_license_acceptance:true"
    }
    if (([string]$Metadata.authors).IndexOf("TinyRustLM", [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        $violations += "authors:TinyRustLM"
    }
    if (([string]$Metadata.title).IndexOf("TinyRustLM", [StringComparison]::OrdinalIgnoreCase) -lt 0 `
        -or ([string]$Metadata.title).IndexOf("UAIX Browser", [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        $violations += "title:TinyRustLM-UAIX-Browser"
    }
    if (([string]$Metadata.description).Length -lt 120) {
        $violations += "description:min-120"
    }
    if (([string]$Metadata.tags).IndexOf($PackageId, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        $violations += "tags:package-id"
    }
    return $violations
}

function Get-MissingSearchTerms {
    param(
        [string[]]$Terms,
        $Metadata
    )

    $haystack = @(
        [string]$Metadata.id,
        [string]$Metadata.title,
        [string]$Metadata.description,
        [string]$Metadata.tags,
        [string]$Metadata.release_notes,
        [string]$Metadata.project_url,
        [string]$Metadata.repository_url
    ) -join " "
    $haystack = $haystack.ToLowerInvariant()
    $missing = @()
    foreach ($term in $Terms) {
        if (-not $haystack.Contains($term.ToLowerInvariant())) {
            $missing += $term
        }
    }
    return $missing
}

function Get-DependencyMismatches {
    param(
        [string[]]$ExpectedIds,
        $ActualDependencies,
        [string]$Version
    )

    $mismatches = @()
    foreach ($expectedId in $ExpectedIds) {
        $match = @($ActualDependencies | Where-Object {
            $_.id -eq $expectedId -and $_.version -eq $Version -and $_.exclude -eq "Build,Analyzers"
        })
        if ($match.Count -ne 1) {
            $mismatches += "missing:$expectedId@$Version exclude=Build,Analyzers"
        }
    }
    foreach ($actual in $ActualDependencies) {
        if ($ExpectedIds -notcontains $actual.id) {
            $mismatches += "unexpected:$($actual.id)@$($actual.version)"
        }
    }
    return $mismatches
}

function Get-AbsolutePathMatches {
    param($Entries)

    $pathMatches = @()
    foreach ($entry in $Entries) {
        if ($entry.Length -gt 1048576 -or $entry.FullName -notmatch "\.(nuspec|md|txt|json|xml)$") {
            continue
        }
        $text = Read-ZipEntryText -Entry $entry
        if ($text -match "(?i)\b[A-Z]:\\(?:Users|Source|repos|work|workspace|agent|actions-runner|a)\\") {
            $pathMatches += $entry.FullName
        }
    }
    return $pathMatches
}

$expectedPackages = @(Get-ExpectedPackages -Version $PackageVersion)
$expectedNames = @($expectedPackages | ForEach-Object { $_.name })
$expectedSymbolNames = @($expectedNames | ForEach-Object { $_ -replace "\.nupkg$", ".snupkg" })
$actualNames = @(Get-ChildItem -LiteralPath $PackageSource -Filter "UAIX.Browser*.nupkg" -File | Select-Object -ExpandProperty Name | Sort-Object)
$actualSymbolNames = @(Get-ChildItem -LiteralPath $PackageSource -Filter "UAIX.Browser*.snupkg" -File | Select-Object -ExpandProperty Name | Sort-Object)
$missingPackages = @($expectedNames | Where-Object { $actualNames -notcontains $_ })
$unexpectedPackages = @($actualNames | Where-Object { $expectedNames -notcontains $_ })
$missingSymbolPackages = @($expectedSymbolNames | Where-Object { $actualSymbolNames -notcontains $_ })
$unexpectedSymbolPackages = @($actualSymbolNames | Where-Object { $expectedSymbolNames -notcontains $_ })

$hashManifestName = "SHA256SUMS-UAIX.Browser-$PackageVersion.txt"
$hashManifestPath = Join-Path $PackageSource $hashManifestName
$hashManifestLines = if (Test-Path -LiteralPath $hashManifestPath -PathType Leaf) {
    Get-Content -LiteralPath $hashManifestPath
} else {
    @()
}
$hashManifestMissing = -not (Test-Path -LiteralPath $hashManifestPath -PathType Leaf)

$feedReadmeName = "README-UAIX.Browser-$PackageVersion.txt"
$feedReadmePath = Join-Path $PackageSource $feedReadmeName
$feedReadmeMissing = -not (Test-Path -LiteralPath $feedReadmePath -PathType Leaf)
$feedReadmeText = if (-not $feedReadmeMissing) { Get-Content -LiteralPath $feedReadmePath -Raw } else { "" }
$feedReadmeRequiredTerms = @(
    @($expectedNames),
    @($expectedSymbolNames),
    @(
        "NuGet Package Manager",
        "debug-symbol sidecar",
        $hashManifestName,
        "SymbolsPackage/PDB evidence",
        "publish-plan hashes",
        "feed-hash reports"
    )
) | ForEach-Object { $_ }
$feedReadmeMissingTerms = @($feedReadmeRequiredTerms | Where-Object {
    $feedReadmeText.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
})

$packageReports = @()
foreach ($expected in $expectedPackages) {
    $path = Join-Path $PackageSource $expected.name
    $present = Test-Path -LiteralPath $path -PathType Leaf
    $metadata = [ordered]@{}
    $dependencies = @()
    $entryNames = @()
    $identityMismatches = @()
    $missingMetadata = @()
    $metadataPolicyViolations = @()
    $missingSearchTerms = @()
    $dependencyMismatches = @()
    $absolutePathMatches = @()
    $hashManifestMatches = $false
    $sha256 = ""
    $byteCount = 0

    if ($present) {
        $sha256 = Get-FileSha256 -Path $path
        $byteCount = (Get-Item -LiteralPath $path).Length
        $hashManifestMatches = @($hashManifestLines | Where-Object {
            $_ -eq "$sha256  $($expected.name)"
        }).Count -eq 1

        $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
        try {
            $entries = @($zip.Entries | Sort-Object FullName)
            $entryNames = @($entries | ForEach-Object { $_.FullName })
            $nuspecEntry = $entries | Where-Object { $_.FullName -like "*.nuspec" } | Select-Object -First 1
            $nuspecText = if ($nuspecEntry) { Read-ZipEntryText -Entry $nuspecEntry } else { "" }
            $metadata = Read-NuspecMetadata -NuspecText $nuspecText
            $dependencies = @(Read-NuspecDependencies -NuspecText $nuspecText)
            if ($metadata.id -ne $expected.id) {
                $identityMismatches += "id:$($metadata.id)"
            }
            if ($metadata.version -ne $PackageVersion) {
                $identityMismatches += "version:$($metadata.version)"
            }
            $missingMetadata = @(Get-MissingMetadataFields -Metadata $metadata)
            $metadataPolicyViolations = @(Get-MetadataPolicyViolations -PackageId $expected.id -Metadata $metadata)
            $missingSearchTerms = @(Get-MissingSearchTerms -Terms $expected.terms -Metadata $metadata)
            $dependencyMismatches = @(Get-DependencyMismatches -ExpectedIds $expected.dependencies -ActualDependencies $dependencies -Version $PackageVersion)
            $absolutePathMatches = @(Get-AbsolutePathMatches -Entries $entries)
        }
        finally {
            $zip.Dispose()
        }
    }

    $packageReports += [ordered]@{
        name = $expected.name
        package_id = $expected.id
        present = $present
        path = $path
        sha256 = $sha256
        byte_count = $byteCount
        hash_manifest_match = $hashManifestMatches
        metadata = $metadata
        dependencies = $dependencies
        required_search_terms = @($expected.terms)
        missing_search_terms = $missingSearchTerms
        identity_mismatches = $identityMismatches
        missing_metadata_fields = $missingMetadata
        metadata_policy_violations = $metadataPolicyViolations
        dependency_mismatches = $dependencyMismatches
        absolute_path_matches = $absolutePathMatches
        package_entry_names = $entryNames
    }
}

$symbolPackageReports = @()
foreach ($expected in $expectedPackages) {
    $symbolName = $expected.name -replace "\.nupkg$", ".snupkg"
    $path = Join-Path $PackageSource $symbolName
    $present = Test-Path -LiteralPath $path -PathType Leaf
    $entryNames = @()
    $pdbEntries = @()
    $identityMismatches = @()
    $unexpectedEntries = @()
    $hasSymbolsPackageType = $false
    $sha256 = ""
    $byteCount = 0
    $hashManifestMatches = $false

    if ($present) {
        $sha256 = Get-FileSha256 -Path $path
        $byteCount = (Get-Item -LiteralPath $path).Length
        $hashManifestMatches = @($hashManifestLines | Where-Object {
            $_ -eq "$sha256  $symbolName"
        }).Count -eq 1
        $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
        try {
            $entries = @($zip.Entries | Sort-Object FullName)
            $entryNames = @($entries | ForEach-Object { $_.FullName })
            $pdbEntries = @($entryNames | Where-Object { $_ -match "^lib/[^/]+/TinyRustLM\.[^/]+\.pdb$" })
            $unexpectedEntries = @(Get-SymbolPackageUnexpectedEntries -EntryNames $entryNames)
            $nuspecEntry = $entries | Where-Object { $_.FullName -like "*.nuspec" } | Select-Object -First 1
            $nuspecText = if ($nuspecEntry) { Read-ZipEntryText -Entry $nuspecEntry } else { "" }
            $metadata = Read-NuspecMetadata -NuspecText $nuspecText
            $hasSymbolsPackageType = Test-SymbolsPackageType -NuspecText $nuspecText
            if ($metadata.id -ne $expected.id) {
                $identityMismatches += "id:$($metadata.id)"
            }
            if ($metadata.version -ne $PackageVersion) {
                $identityMismatches += "version:$($metadata.version)"
            }
            if (-not $hasSymbolsPackageType) {
                $identityMismatches += "packageType:SymbolsPackage"
            }
            if ($pdbEntries.Count -eq 0) {
                $identityMismatches += "pdb:missing"
            }
        }
        finally {
            $zip.Dispose()
        }
    }

    $symbolPackageReports += [ordered]@{
        name = $symbolName
        package_id = $expected.id
        present = $present
        path = $path
        sha256 = $sha256
        byte_count = $byteCount
        hash_manifest_match = $hashManifestMatches
        has_symbols_package_type = $hasSymbolsPackageType
        pdb_entries = $pdbEntries
        identity_mismatches = $identityMismatches
        unexpected_symbol_package_entries = $unexpectedEntries
        package_entry_names = $entryNames
    }
}

$allIdentityMismatches = @($packageReports | ForEach-Object { $_.identity_mismatches } | Where-Object { $_ })
$allMissingMetadata = @($packageReports | ForEach-Object { $_.missing_metadata_fields } | Where-Object { $_ })
$allMetadataPolicyViolations = @($packageReports | ForEach-Object { $_.metadata_policy_violations } | Where-Object { $_ })
$allMissingSearchTerms = @($packageReports | ForEach-Object { $_.missing_search_terms } | Where-Object { $_ })
$allDependencyMismatches = @($packageReports | ForEach-Object { $_.dependency_mismatches } | Where-Object { $_ })
$allAbsolutePathMatches = @($packageReports | ForEach-Object { $_.absolute_path_matches } | Where-Object { $_ })
$hashMismatches = @($packageReports | Where-Object { $_.present -and -not $_.hash_manifest_match })
$symbolHashMismatches = @($symbolPackageReports | Where-Object { $_.present -and -not $_.hash_manifest_match })
$allSymbolIdentityMismatches = @($symbolPackageReports | ForEach-Object { $_.identity_mismatches } | Where-Object { $_ })
$allUnexpectedSymbolPackageEntries = @($symbolPackageReports | ForEach-Object { $_.unexpected_symbol_package_entries } | Where-Object { $_ })

$status = if (
    $missingPackages.Count -eq 0 -and
    $unexpectedPackages.Count -eq 0 -and
    $missingSymbolPackages.Count -eq 0 -and
    $unexpectedSymbolPackages.Count -eq 0 -and
    -not $hashManifestMissing -and
    $hashMismatches.Count -eq 0 -and
    $symbolHashMismatches.Count -eq 0 -and
    $allIdentityMismatches.Count -eq 0 -and
    $allSymbolIdentityMismatches.Count -eq 0 -and
    $allUnexpectedSymbolPackageEntries.Count -eq 0 -and
    $allMissingMetadata.Count -eq 0 -and
    $allMetadataPolicyViolations.Count -eq 0 -and
    $allMissingSearchTerms.Count -eq 0 -and
    $allDependencyMismatches.Count -eq 0 -and
    $allAbsolutePathMatches.Count -eq 0 -and
    -not $feedReadmeMissing -and
    $feedReadmeMissingTerms.Count -eq 0
) { "pass" } else { "fail" }

$report = [ordered]@{
    schema = "uaix.browser.nuget.feed_audit.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    package_source = $PackageSource
    package_version = $PackageVersion
    status = $status
    expected_package_names = $expectedNames
    expected_symbol_package_names = $expectedSymbolNames
    actual_package_names = $actualNames
    actual_symbol_package_names = $actualSymbolNames
    missing_package_entries = $missingPackages
    unexpected_package_entries = $unexpectedPackages
    missing_symbol_package_entries = $missingSymbolPackages
    unexpected_symbol_package_entries = $unexpectedSymbolPackages
    hash_manifest_name = $hashManifestName
    hash_manifest_missing = $hashManifestMissing
    feed_readme_name = $feedReadmeName
    feed_readme_missing = $feedReadmeMissing
    feed_readme_missing_terms = $feedReadmeMissingTerms
    feed_readme_missing_term_count = $feedReadmeMissingTerms.Count
    hash_mismatch_count = $hashMismatches.Count
    symbol_hash_mismatch_count = $symbolHashMismatches.Count
    identity_mismatch_count = $allIdentityMismatches.Count
    symbol_identity_mismatch_count = $allSymbolIdentityMismatches.Count
    unexpected_symbol_package_entry_count = $allUnexpectedSymbolPackageEntries.Count
    missing_metadata_count = $allMissingMetadata.Count
    metadata_policy_violation_count = $allMetadataPolicyViolations.Count
    missing_search_term_count = $allMissingSearchTerms.Count
    dependency_mismatch_count = $allDependencyMismatches.Count
    absolute_path_match_count = $allAbsolutePathMatches.Count
    package_count = $packageReports.Count
    symbol_package_count = $symbolPackageReports.Count
    packages = $packageReports
    symbol_packages = $symbolPackageReports
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "UAIX Browser NuGet feed audit written to $ReportOutput"

if ($status -ne "pass") {
    throw "UAIX Browser NuGet feed audit failed. See $ReportOutput"
}
Write-Host "UAIX Browser NuGet feed audit passed: $PackageSource @ $PackageVersion"
