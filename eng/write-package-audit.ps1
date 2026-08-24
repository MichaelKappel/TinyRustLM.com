param(
    [string]$PackageSource = "",
    [string]$ReportOutput = "",
    [string[]]$RequiredNativeRids = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $PackageSource) {
    $PackageSource = Join-Path $RepoRoot "artifacts/packages"
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-package-audit.json"
}

if (-not (Test-Path -LiteralPath $PackageSource)) {
    throw "Package source does not exist: $PackageSource"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-NativeRidFromEntry {
    param([string]$EntryName)

    if ($EntryName -match "^runtimes/([^/]+)/native/") {
        return $Matches[1]
    }
    return $null
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

function Write-JsonReport {
    param(
        $Value,
        [string]$Path
    )

    if ($PSVersionTable.PSEdition -eq "Desktop") {
        Add-Type -AssemblyName System.Web.Extensions
        $serializer = [System.Web.Script.Serialization.JavaScriptSerializer]::new()
        $serializer.MaxJsonLength = [int]::MaxValue
        $serializer.RecursionLimit = 100
        $json = $serializer.Serialize((ConvertTo-JsonCompatibleValue -Value $Value))
        [System.IO.File]::WriteAllText(
            $Path,
            $json,
            [System.Text.UTF8Encoding]::new($false))
        return
    }

    $Value | ConvertTo-Json -Depth 20 -Compress | Set-Content -LiteralPath $Path -Encoding UTF8
}

function ConvertTo-JsonCompatibleValue {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $baseValue = $Value.PSObject.BaseObject
    if ($baseValue -is [string] -or
        $baseValue -is [bool] -or
        $baseValue -is [byte] -or
        $baseValue -is [sbyte] -or
        $baseValue -is [int16] -or
        $baseValue -is [uint16] -or
        $baseValue -is [int32] -or
        $baseValue -is [uint32] -or
        $baseValue -is [int64] -or
        $baseValue -is [uint64] -or
        $baseValue -is [single] -or
        $baseValue -is [double] -or
        $baseValue -is [decimal]) {
        return $baseValue
    }
    if ($baseValue -is [System.Collections.IDictionary]) {
        $dictionary = [ordered]@{}
        foreach ($key in $baseValue.Keys) {
            $dictionary[[string]$key] = ConvertTo-JsonCompatibleValue -Value $baseValue[$key]
        }
        return $dictionary
    }
    if ($baseValue -is [System.Collections.IEnumerable]) {
        $items = @()
        foreach ($item in $baseValue) {
            $items += ,(ConvertTo-JsonCompatibleValue -Value $item)
        }
        return ,$items
    }

    throw "Package audit report contains unsupported JSON value type: $($baseValue.GetType().FullName)"
}

function Get-ZipEntrySha256 {
    param($Entry)

    $stream = $Entry.Open()
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hashBytes = $sha256.ComputeHash($stream)
            return ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Read-NuspecDependencies {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return @()
    }

    [xml]$nuspec = $NuspecText
    $dependencyNodes = $nuspec.SelectNodes("//*[local-name()='dependency']")
    $dependencies = @()
    foreach ($node in $dependencyNodes) {
        $dependencies += [ordered]@{
            id = $node.GetAttribute("id")
            version = $node.GetAttribute("version")
            exclude = $node.GetAttribute("exclude")
        }
    }
    return $dependencies
}

function Test-TextPackageEntry {
    param([string]$EntryName)

    $lower = $EntryName.ToLowerInvariant()
    $textExtensions = @(
        ".nuspec",
        ".props",
        ".targets",
        ".md",
        ".txt",
        ".json",
        ".xml",
        ".ps1",
        ".psm1",
        ".sh",
        ".csproj",
        ".fsproj",
        ".vbproj"
    )
    foreach ($extension in $textExtensions) {
        if ($lower.EndsWith($extension)) {
            return $true
        }
    }
    return $false
}

function Get-AbsolutePathMatches {
    param($Entries)

    $rules = @(
        [ordered]@{
            kind = "windows_user_or_workspace_path"
            pattern = "(?i)\b[A-Z]:\\(?:Users|Source|repos|work|workspace|agent|actions-runner|a)\\"
        },
        [ordered]@{
            kind = "unix_user_or_workspace_path"
            pattern = "(?i)/(?:home|Users|mnt|workspace|work|agent|actions-runner|__w|private/var/folders)/"
        }
    )

    $pathMatches = @()
    foreach ($entry in $Entries) {
        if (-not (Test-TextPackageEntry -EntryName $entry.FullName)) {
            continue
        }
        if ($entry.Length -gt 1048576) {
            continue
        }

        $text = Read-ZipEntryText -Entry $entry
        foreach ($rule in $rules) {
            $matches = [regex]::Matches($text, $rule.pattern)
            foreach ($match in $matches) {
                $pathMatches += [ordered]@{
                    entry = $entry.FullName
                    kind = $rule.kind
                    index = $match.Index
                }
            }
        }
    }
    return $pathMatches
}

function Get-XmlText {
    param(
        [xml]$Document,
        [string]$ElementName
    )

    $node = $Document.SelectSingleNode("//*[local-name()='$ElementName']")
    if ($node) {
        return $node.InnerText
    }
    return ""
}

function Get-SourcePackageVersion {
    $propsPath = Join-Path $RepoRoot "dotnet/Directory.Build.props"
    [xml]$props = Get-Content -LiteralPath $propsPath -Raw
    $version = Get-XmlText -Document $props -ElementName "Version"
    if (-not [string]::IsNullOrWhiteSpace($version)) {
        return $version
    }

    $prefix = Get-XmlText -Document $props -ElementName "VersionPrefix"
    if ([string]::IsNullOrWhiteSpace($prefix)) {
        throw "VersionPrefix is required in $propsPath"
    }

    $suffix = Get-XmlText -Document $props -ElementName "VersionSuffix"
    if ([string]::IsNullOrWhiteSpace($suffix)) {
        return $prefix
    }
    return "$prefix-$suffix"
}

function Get-ExpectedPackageNames {
    param([string]$PackageVersion)

    return @(
        "TinyRustLM.Abstractions.$PackageVersion.nupkg",
        "TinyRustLM.Core.$PackageVersion.nupkg",
        "TinyRustLM.P2P.$PackageVersion.nupkg"
    )
}

function Get-ExpectedSymbolPackageNames {
    param([string]$PackageVersion)

    return @(
        "TinyRustLM.Abstractions.$PackageVersion.snupkg",
        "TinyRustLM.Core.$PackageVersion.snupkg",
        "TinyRustLM.P2P.$PackageVersion.snupkg"
    )
}

function Get-ExpectedPackageIdForName {
    param(
        [string]$PackageName,
        [string]$PackageVersion
    )

    $suffix = ".$PackageVersion.nupkg"
    if ($PackageName.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
        return $PackageName.Substring(0, $PackageName.Length - $suffix.Length)
    }
    return ""
}

function Get-ExpectedSymbolPackageIdForName {
    param(
        [string]$PackageName,
        [string]$PackageVersion
    )

    $suffix = ".$PackageVersion.snupkg"
    if ($PackageName.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
        return $PackageName.Substring(0, $PackageName.Length - $suffix.Length)
    }
    return ""
}

function Read-NuspecMetadata {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return [ordered]@{
            id = ""
            version = ""
            title = ""
            authors = ""
            description = ""
            project_url = ""
            repository_url = ""
            repository_type = ""
            license = ""
            license_type = ""
            readme = ""
            tags = ""
            release_notes = ""
            require_license_acceptance = ""
        }
    }

    [xml]$nuspec = $NuspecText
    $repository = $nuspec.SelectSingleNode("//*[local-name()='repository']")
    $license = $nuspec.SelectSingleNode("//*[local-name()='license']")
    return [ordered]@{
        id = Get-XmlText -Document $nuspec -ElementName "id"
        version = Get-XmlText -Document $nuspec -ElementName "version"
        title = Get-XmlText -Document $nuspec -ElementName "title"
        authors = Get-XmlText -Document $nuspec -ElementName "authors"
        description = Get-XmlText -Document $nuspec -ElementName "description"
        project_url = Get-XmlText -Document $nuspec -ElementName "projectUrl"
        repository_url = if ($repository) { $repository.GetAttribute("url") } else { "" }
        repository_type = if ($repository) { $repository.GetAttribute("type") } else { "" }
        license = if ($license) { $license.InnerText } else { "" }
        license_type = if ($license) { $license.GetAttribute("type") } else { "" }
        readme = Get-XmlText -Document $nuspec -ElementName "readme"
        tags = Get-XmlText -Document $nuspec -ElementName "tags"
        release_notes = Get-XmlText -Document $nuspec -ElementName "releaseNotes"
        require_license_acceptance = Get-XmlText -Document $nuspec -ElementName "requireLicenseAcceptance"
    }
}

function Get-MissingMetadataFields {
    param($Metadata)

    $required = @(
        "id",
        "version",
        "title",
        "authors",
        "description",
        "project_url",
        "repository_url",
        "repository_type",
        "license",
        "license_type",
        "readme",
        "tags",
        "release_notes"
    )
    $missing = @()
    foreach ($field in $required) {
        if ([string]::IsNullOrWhiteSpace([string]$Metadata[$field])) {
            $missing += $field
        }
    }
    if ($Metadata.require_license_acceptance -ne "true") {
        $missing += "require_license_acceptance"
    }
    if ($Metadata.license_type -and $Metadata.license_type -ne "file") {
        $missing += "license_type:file"
    }
    if ($Metadata.readme -and $Metadata.readme -ne "README.md") {
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
    $expectedTitles = @{
        "TinyRustLM.Abstractions" = "TinyRustLM SDK Abstractions"
        "TinyRustLM.Core" = "TinyRustLM p2pLLM Runtime SDK"
        "TinyRustLM.P2P" = "TinyRustLM p2pRuntime P2P SDK"
        "TinyRustLM.MemoryEndpoints" = "TinyRustLM MemoryEndpoints Optional Connector"
        "TinyRustLM.Conversion" = "TinyRustLM SLM2 Conversion Process Owner"
    }
    $expectedTitle = $expectedTitles[$PackageId]
    if (-not $expectedTitle -or -not ([string]$Metadata.title).Equals($expectedTitle, [StringComparison]::Ordinal)) {
        $violations += "title:exact-package-contract"
    }
    if (([string]$Metadata.description).Length -lt 120) {
        $violations += "description:min-120"
    }
    if (([string]$Metadata.tags).IndexOf($PackageId, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        $violations += "tags:package-id"
    }
    return $violations
}

function Get-RequiredSearchTerms {
    param([string]$PackageId)

    $terms = @("TinyRustLM", "UAIX", "UAIX.org", "Rust", "AI", "browser-local")
    switch ($PackageId) {
        "TinyRustLM.Abstractions" {
            $terms += @("abstractions", "SDK", "p2pRuntime", "p2pRuntime.com", "p2pLLM", "p2pLLM.com", "MiniModel", "SLM2", "ACG2", "Prompt2", "Tokenizer2", "Template2", "Sampling2")
        }
        "TinyRustLM.Core" {
            $terms += @("p2pLLM", "p2pLLM.com", "SLM2", "ACG2", "Prompt2", "Tokenizer2", "Template2", "Sampling2", "runtime", "native", "model-validation", "bounded-generation")
        }
        "TinyRustLM.P2P" {
            $terms += @("p2pRuntime", "p2pRuntime.com", "P2P", "peer-to-peer", "direct-transport", "fixed-piece", "model-sharing", "MiniModel", "manifest", "share-kit", "SLM2", "ACG2")
        }
        "TinyRustLM.MemoryEndpoints" {
            $terms += @("MemoryEndpoints", "MemoryEndpoints.com", ".uai", "memory", "offline-first", "outbox", "idempotency", "multi-device", "conflict-safe", "tombstone", "device-revocation", "checkpoint", "stale-index", "prompt-injection-defense")
        }
        "TinyRustLM.Conversion" {
            $terms += @("p2pLLM", "p2pLLM.com", "SLM2", "Tokenizer2", "Qwen3", "conversion", "tinyrustlm-convert", "local-feed")
        }
    }
    return @($terms | Sort-Object -Unique)
}

function Get-MissingSearchTerms {
    param(
        [string]$PackageId,
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
    $haystackLower = $haystack.ToLowerInvariant()

    $missing = @()
    foreach ($term in Get-RequiredSearchTerms -PackageId $PackageId) {
        if (-not $haystackLower.Contains($term.ToLowerInvariant())) {
            $missing += $term
        }
    }
    return $missing
}

function Get-DeclaredPackageFileEntries {
    param($Metadata)

    $declared = @()
    if (-not [string]::IsNullOrWhiteSpace([string]$Metadata.readme)) {
        $declared += [string]$Metadata.readme
    }
    if ($Metadata.license_type -eq "file" -and -not [string]::IsNullOrWhiteSpace([string]$Metadata.license)) {
        $declared += [string]$Metadata.license
    }
    return @($declared | Sort-Object -Unique)
}

function Get-PackageDocumentationEntries {
    param([string[]]$EntryNames)

    return @($EntryNames | Where-Object {
        $_ -eq "README.md" -or
        $_ -eq "LICENSE.txt" -or
        $_ -like "docs/*.md"
    })
}

function New-ExpectedPackageDocumentationEntry {
    param(
        [string]$Entry,
        [string]$Source
    )

    return [ordered]@{
        entry = $Entry
        source = $Source
    }
}

function Get-ExpectedPackageDocumentationEntries {
    param([string]$PackageId)

    $entries = @(
        (New-ExpectedPackageDocumentationEntry -Entry "README.md" -Source "docs/nuget/README.md"),
        (New-ExpectedPackageDocumentationEntry -Entry "LICENSE.txt" -Source "docs/nuget/LICENSE.txt")
    )

    if ($PackageId -eq "TinyRustLM.Core") {
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/PACKAGE_SECURITY.md" -Source "docs/nuget/PACKAGE_SECURITY.md"
    }
    elseif ($PackageId -eq "TinyRustLM.P2P") {
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/API_BOUNDARY.md" -Source "docs/nuget/API_BOUNDARY.md"
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/P2P_SHARE_FLOW.md" -Source "docs/nuget/P2P_SHARE_FLOW.md"
    }
    elseif ($PackageId -eq "TinyRustLM.MemoryEndpoints") {
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/API_BOUNDARY.md" -Source "docs/nuget/API_BOUNDARY.md"
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/MEMORY_ENDPOINTS_CONNECTOR.md" -Source "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md" -Source "docs/nuget/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md"
    }
    elseif ($PackageId -eq "TinyRustLM.Conversion") {
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/PACKAGE_SECURITY.md" -Source "docs/nuget/PACKAGE_SECURITY.md"
    }

    return $entries
}

function Get-PackageDocumentationVerification {
    param(
        [string]$PackageId,
        $Entries
    )

    $verification = @()
    foreach ($expected in (Get-ExpectedPackageDocumentationEntries -PackageId $PackageId)) {
        $sourcePath = Join-Path $RepoRoot $expected.source
        $sourceExists = Test-Path -LiteralPath $sourcePath
        $packageEntry = $Entries | Where-Object { $_.FullName -eq $expected.entry } | Select-Object -First 1
        $packageEntryExists = $null -ne $packageEntry
        $sourceSha256 = if ($sourceExists) { (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant() } else { "" }
        $packageSha256 = if ($packageEntryExists) { Get-ZipEntrySha256 -Entry $packageEntry } else { "" }

        $verification += [ordered]@{
            entry = $expected.entry
            source = $expected.source
            source_exists = $sourceExists
            package_entry_exists = $packageEntryExists
            source_sha256 = $sourceSha256
            package_sha256 = $packageSha256
            sha256_match = ($sourceExists -and $packageEntryExists -and $sourceSha256 -eq $packageSha256)
        }
    }
    return $verification
}

function Get-AllowedPackageEntryPatterns {
    param([string]$PackageId)

    $patterns = @(
        "[Content_Types].xml",
        "_rels/.rels",
        "$PackageId.nuspec",
        "README.md",
        "LICENSE.txt",
        "package/services/metadata/core-properties/*.psmdcp",
        "lib/net8.0/$PackageId.dll",
        "lib/net8.0/$PackageId.xml"
    )

    foreach ($expected in (Get-ExpectedPackageDocumentationEntries -PackageId $PackageId)) {
        if ($patterns -notcontains $expected.entry) {
            $patterns += $expected.entry
        }
    }

    foreach ($entry in (Get-AllowedNativeEntriesForPackage -PackageId $PackageId)) {
        $patterns += $entry
    }

    return @($patterns)
}

function Test-PackageEntryAllowed {
    param(
        [string]$PackageId,
        [string]$EntryName,
        [string[]]$AllowedNativeEntries
    )

    $literalEntries = @(
        "[Content_Types].xml",
        "_rels/.rels",
        "$PackageId.nuspec",
        "README.md",
        "LICENSE.txt",
        "lib/net8.0/$PackageId.dll",
        "lib/net8.0/$PackageId.xml"
    )
    if ($literalEntries -contains $EntryName) {
        return $true
    }

    if ($EntryName -match "^package/services/metadata/core-properties/[^/]+\.psmdcp$") {
        return $true
    }

    $expectedDocumentationEntries = @(Get-ExpectedPackageDocumentationEntries -PackageId $PackageId |
        ForEach-Object { $_.entry })
    if ($expectedDocumentationEntries -contains $EntryName) {
        return $true
    }

    if ($AllowedNativeEntries -contains $EntryName) {
        return $true
    }

    return $false
}

function Get-UnexpectedPackageContentEntries {
    param(
        [string]$PackageId,
        [string[]]$EntryNames,
        [string[]]$AllowedNativeEntries
    )

    return @($EntryNames | Where-Object {
        -not (Test-PackageEntryAllowed `
            -PackageId $PackageId `
            -EntryName $_ `
            -AllowedNativeEntries $AllowedNativeEntries)
    })
}

function Read-XmlDocumentationMemberNames {
    param($Entry)

    if (-not $Entry) {
        return @()
    }

    $text = Read-ZipEntryText -Entry $Entry
    if ([string]::IsNullOrWhiteSpace($text)) {
        return @()
    }

    [xml]$xml = $text
    $members = $xml.SelectNodes("//*[local-name()='member']")
    $names = @()
    foreach ($member in $members) {
        $name = $member.GetAttribute("name")
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            $names += $name
        }
    }
    return @($names | Sort-Object -Unique)
}

function Get-ExpectedPublicApiEntries {
    param([string]$PackageId)

    $supportedPackageIds = @(
        "TinyRustLM.Abstractions",
        "TinyRustLM.Core",
        "TinyRustLM.P2P",
        "TinyRustLM.MemoryEndpoints",
        "TinyRustLM.Conversion"
    )
    if ($supportedPackageIds -notcontains $PackageId) {
        return @()
    }

    $baselinePath = Join-Path $RepoRoot "eng/public-api/$PackageId.txt"
    if (-not (Test-Path -LiteralPath $baselinePath -PathType Leaf)) {
        throw "Missing approved public API baseline for ${PackageId}: $baselinePath"
    }
    return @(Get-Content -LiteralPath $baselinePath |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and -not $_.StartsWith('#') } |
        Sort-Object -Unique)
}

function Get-MissingPublicApiEntries {
    param(
        [string[]]$Expected,
        [string[]]$Actual
    )

    return @($Expected | Where-Object { $Actual -notcontains $_ })
}

function Get-UnexpectedPublicApiEntries {
    param(
        [string[]]$Expected,
        [string[]]$Actual
    )

    return @($Actual | Where-Object { $Expected -notcontains $_ })
}

function New-ExpectedDependencyEntry {
    param(
        [string]$Id,
        [string]$Version,
        [string]$Exclude = "Build,Analyzers"
    )

    return [ordered]@{
        id = $Id
        version = $Version
        exclude = $Exclude
    }
}

function Get-ExpectedDependencies {
    param(
        [string]$PackageId,
        [string]$PackageVersion
    )

    if ($PackageId -eq "TinyRustLM.Core") {
        return @(
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Abstractions" -Version $PackageVersion)
        )
    }
    if ($PackageId -eq "TinyRustLM.P2P") {
        return @(
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Abstractions" -Version $PackageVersion),
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Core" -Version $PackageVersion)
        )
    }
    if ($PackageId -eq "TinyRustLM.MemoryEndpoints") {
        return @(
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Abstractions" -Version $PackageVersion)
        )
    }
    if ($PackageId -eq "TinyRustLM.Conversion") {
        return @(
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Core" -Version $PackageVersion)
        )
    }
    return @()
}

function Get-MissingDependencyEntries {
    param(
        $ExpectedDependencies,
        $ActualDependencies
    )

    $missing = @()
    foreach ($expected in $ExpectedDependencies) {
        $match = $ActualDependencies | Where-Object {
            $_.id -eq $expected.id -and
            $_.version -eq $expected.version -and
            $_.exclude -eq $expected.exclude
        } | Select-Object -First 1
        if (-not $match) {
            $missing += $expected
        }
    }
    return $missing
}

function Get-UnexpectedDependencyEntries {
    param(
        $ExpectedDependencies,
        $ActualDependencies
    )

    $unexpected = @()
    foreach ($actual in $ActualDependencies) {
        $match = $ExpectedDependencies | Where-Object {
            $_.id -eq $actual.id -and
            $_.version -eq $actual.version -and
            $_.exclude -eq $actual.exclude
        } | Select-Object -First 1
        if (-not $match) {
            $unexpected += $actual
        }
    }
    return $unexpected
}

function Get-UnexpectedNativeEntries {
    param(
        [string]$PackageId,
        [string[]]$NativeEntries
    )

    if ($PackageId -ne "TinyRustLM.Core") {
        return @($NativeEntries)
    }

    $allowedNativeEntries = @(Get-AllowedNativeEntries)
    return @($NativeEntries | Where-Object { $allowedNativeEntries -notcontains $_ })
}

function Get-AllowedNativeEntries {
    return @(
        "runtimes/win-x64/native/tinyrustlm_native.dll",
        "runtimes/linux-x64/native/libtinyrustlm_native.so",
        "runtimes/linux-arm64/native/libtinyrustlm_native.so"
    )
}

function Get-AllowedNativeEntriesForPackage {
    param([string]$PackageId)

    if ($PackageId -eq "TinyRustLM.Core") {
        return @(Get-AllowedNativeEntries)
    }
    if ($PackageId -eq "TinyRustLM.Conversion") {
        return @(
            "tools/win-x64/tinyrustlm-convert.exe",
            "contentFiles/any/any/tinyrustlm/tools/win-x64/tinyrustlm-convert.exe",
            "tools/linux-x64/tinyrustlm-convert",
            "contentFiles/any/any/tinyrustlm/tools/linux-x64/tinyrustlm-convert",
            "tools/linux-arm64/tinyrustlm-convert",
            "contentFiles/any/any/tinyrustlm/tools/linux-arm64/tinyrustlm-convert"
        )
    }
    return @()
}

function Get-PackageIdentityMismatches {
    param(
        [string]$PackageName,
        [string]$ExpectedPackageId,
        [string]$ExpectedPackageVersion,
        $Metadata
    )

    $mismatches = @()
    if ([string]::IsNullOrWhiteSpace($ExpectedPackageId)) {
        return $mismatches
    }

    $actualId = [string]$Metadata.id
    $actualVersion = [string]$Metadata.version
    if ($actualId -ne $ExpectedPackageId -or $actualVersion -ne $ExpectedPackageVersion) {
        $mismatches += [ordered]@{
            name = $PackageName
            expected_id = $ExpectedPackageId
            actual_id = $actualId
            expected_version = $ExpectedPackageVersion
            actual_version = $actualVersion
        }
    }
    return $mismatches
}

function Get-SymbolPackageIdentityMismatches {
    param(
        [string]$PackageName,
        [string]$ExpectedPackageId,
        [string]$ExpectedPackageVersion,
        $Metadata,
        [bool]$HasSymbolsPackageType
    )

    $mismatches = @(Get-PackageIdentityMismatches `
        -PackageName $PackageName `
        -ExpectedPackageId $ExpectedPackageId `
        -ExpectedPackageVersion $ExpectedPackageVersion `
        -Metadata $Metadata)
    if (-not $HasSymbolsPackageType) {
        $mismatches += "package_type:SymbolsPackage"
    }
    return $mismatches
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

function Get-NoncanonicalTimestampEntries {
    param([System.IO.Compression.ZipArchiveEntry[]]$Entries)

    return @($Entries | Where-Object {
        $_.LastWriteTime.Year -ne 1980 -or
        $_.LastWriteTime.Month -ne 1 -or
        $_.LastWriteTime.Day -ne 1 -or
        $_.LastWriteTime.Hour -ne 0 -or
        $_.LastWriteTime.Minute -ne 0 -or
        $_.LastWriteTime.Second -ne 0
    } | ForEach-Object { $_.FullName })
}

function Test-SymbolsPackageType {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return $false
    }

    [xml]$nuspec = $NuspecText
    $packageTypeNodes = $nuspec.SelectNodes("//*[local-name()='packageType']")
    foreach ($node in $packageTypeNodes) {
        if ($node.GetAttribute("name") -eq "SymbolsPackage") {
            return $true
        }
    }
    return $false
}

$packageFiles = Get-ChildItem -Path $PackageSource -Filter "TinyRustLM*.nupkg" -File | Sort-Object Name
if (-not $packageFiles) {
    throw "No TinyRustLM packages were found in $PackageSource"
}
$symbolPackageFiles = Get-ChildItem -Path $PackageSource -Filter "TinyRustLM*.snupkg" -File | Sort-Object Name

$sourcePackageVersion = Get-SourcePackageVersion
$expectedPackageNames = @(Get-ExpectedPackageNames -PackageVersion $sourcePackageVersion)
$expectedSymbolPackageNames = @(Get-ExpectedSymbolPackageNames -PackageVersion $sourcePackageVersion)
$packageNames = @($packageFiles | ForEach-Object { $_.Name })
$symbolPackageNames = @($symbolPackageFiles | ForEach-Object { $_.Name })
$optionalMemoryEndpointsName = "TinyRustLM.MemoryEndpoints.$sourcePackageVersion.nupkg"
if ($packageNames -contains $optionalMemoryEndpointsName) {
    $expectedPackageNames += $optionalMemoryEndpointsName
    $expectedSymbolPackageNames += "TinyRustLM.MemoryEndpoints.$sourcePackageVersion.snupkg"
}
$optionalConversionName = "TinyRustLM.Conversion.$sourcePackageVersion.nupkg"
if ($packageNames -contains $optionalConversionName) {
    $expectedPackageNames += $optionalConversionName
    $expectedSymbolPackageNames += "TinyRustLM.Conversion.$sourcePackageVersion.snupkg"
}
$missingPackageEntries = @($expectedPackageNames | Where-Object { $packageNames -notcontains $_ })
$unexpectedPackageEntries = @($packageNames | Where-Object { $expectedPackageNames -notcontains $_ })
$missingSymbolPackageEntries = @($expectedSymbolPackageNames | Where-Object { $symbolPackageNames -notcontains $_ })
$unexpectedSymbolPackageEntries = @($symbolPackageNames | Where-Object { $expectedSymbolPackageNames -notcontains $_ })

$privateSurfacePattern = "slm_pack|selector|adapter_family|trained_source|breeding"
$sourceFilePattern = "\.(cs|fs|vb|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|m|mm|swift|kt|kts|java|go|py|ts|tsx|js|jsx|ps1|psm1|psd1|sh|bash)$"
$debugSymbolPattern = "\.(pdb|mdb|dbg)$|\.dSYM(?:/|$)"
$generatedOutputPattern = "(^|/)(bin|obj|target|artifacts)/"
$packageReports = @()
foreach ($package in $packageFiles) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($package.FullName)
    try {
        $entries = $zip.Entries | Sort-Object FullName
        $entryNames = $entries | ForEach-Object { $_.FullName }
        $privateMatches = @($entryNames | Where-Object { $_ -match $privateSurfacePattern })
        $sourceFileEntries = @($entryNames | Where-Object { $_ -match $sourceFilePattern })
        $debugSymbolEntries = @($entryNames | Where-Object { $_ -match $debugSymbolPattern })
        $generatedOutputEntries = @($entryNames | Where-Object { $_ -match $generatedOutputPattern })
        $absolutePathMatches = @(Get-AbsolutePathMatches -Entries $entries)
        $nativeEntries = @($entryNames | Where-Object { $_ -match "^runtimes/[^/]+/native/" })
        $xmlDocumentationEntries = @($entryNames | Where-Object { $_ -match "^lib/[^/]+/TinyRustLM\.[^/]+\.xml$" })
        $xmlDocumentationEntry = $entries | Where-Object { $_.FullName -match "^lib/[^/]+/TinyRustLM\.[^/]+\.xml$" } | Select-Object -First 1
        $nativeRids = @($nativeEntries | ForEach-Object { Get-NativeRidFromEntry -EntryName $_ } | Where-Object { $_ } | Sort-Object -Unique)
        $nuspecEntry = $entries | Where-Object { $_.FullName -like "*.nuspec" } | Select-Object -First 1
        $nuspecText = if ($nuspecEntry) { Read-ZipEntryText -Entry $nuspecEntry } else { "" }
        $metadata = Read-NuspecMetadata -NuspecText $nuspecText
        $expectedPackageId = Get-ExpectedPackageIdForName -PackageName $package.Name -PackageVersion $sourcePackageVersion
        $expectedPackageVersion = if ($expectedPackageId) { $sourcePackageVersion } else { "" }
        $packageIdentityMismatches = @(Get-PackageIdentityMismatches `
            -PackageName $package.Name `
            -ExpectedPackageId $expectedPackageId `
            -ExpectedPackageVersion $expectedPackageVersion `
            -Metadata $metadata)
        $packageId = $package.BaseName -replace "\.\d+(\.\d+){1,3}.*$", ""
        $packageVersion = [string]$metadata.version
        $dependencies = @(Read-NuspecDependencies -NuspecText $nuspecText)
        $expectedDependencyEntries = @(Get-ExpectedDependencies -PackageId $packageId -PackageVersion $packageVersion)
        $missingDependencyEntries = @(Get-MissingDependencyEntries -ExpectedDependencies $expectedDependencyEntries -ActualDependencies $dependencies)
        $unexpectedDependencyEntries = @(Get-UnexpectedDependencyEntries -ExpectedDependencies $expectedDependencyEntries -ActualDependencies $dependencies)
        $allowedNativeEntries = @(Get-AllowedNativeEntriesForPackage -PackageId $packageId)
        $unexpectedNativeEntries = @(Get-UnexpectedNativeEntries -PackageId $packageId -NativeEntries $nativeEntries)
        $allowedPackageEntryPatterns = @(Get-AllowedPackageEntryPatterns -PackageId $packageId)
        $unexpectedPackageContentEntries = @(Get-UnexpectedPackageContentEntries `
            -PackageId $packageId `
            -EntryNames $entryNames `
            -AllowedNativeEntries $allowedNativeEntries)
        $publicApiEntries = @(Read-XmlDocumentationMemberNames -Entry $xmlDocumentationEntry)
        $expectedPublicApiEntries = @(Get-ExpectedPublicApiEntries -PackageId $packageId)
        $missingPublicApiEntries = @(Get-MissingPublicApiEntries `
            -Expected $expectedPublicApiEntries `
            -Actual $publicApiEntries)
        $unexpectedPublicApiEntries = @(Get-UnexpectedPublicApiEntries `
            -Expected $expectedPublicApiEntries `
            -Actual $publicApiEntries)
        $expectedDocumentationEntry = "lib/net8.0/$packageId.xml"
        $missingDocumentationEntries = @()
        if ($xmlDocumentationEntries -notcontains $expectedDocumentationEntry) {
            $missingDocumentationEntries += $expectedDocumentationEntry
        }
        $declaredPackageFileEntries = @(Get-DeclaredPackageFileEntries -Metadata $metadata)
        $missingPackageFileEntries = @($declaredPackageFileEntries | Where-Object {
            $entryNames -notcontains $_
        })
        $packageDocumentationEntries = @(Get-PackageDocumentationEntries -EntryNames $entryNames)
        $expectedPackageDocumentationEntries = @(Get-PackageDocumentationVerification -PackageId $packageId -Entries $entries)
        $packageDocumentationMismatches = @($expectedPackageDocumentationEntries | Where-Object { -not $_.sha256_match })
        $requiredSearchTerms = @(Get-RequiredSearchTerms -PackageId $packageId)
        $missingSearchTerms = @(Get-MissingSearchTerms -PackageId $packageId -Metadata $metadata)
        $metadataPolicyViolations = @(Get-MetadataPolicyViolations -PackageId $packageId -Metadata $metadata)
        $noncanonicalTimestampEntries = @(Get-NoncanonicalTimestampEntries -Entries $entries)

        $packageReports += [ordered]@{
            name = $package.Name
            package_id = $packageId
            expected_package_id = $expectedPackageId
            expected_package_version = $expectedPackageVersion
            path = $package.FullName
            sha256 = (Get-FileHash -LiteralPath $package.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            byte_count = $package.Length
            entry_count = $entries.Count
            noncanonical_timestamp_entries = $noncanonicalTimestampEntries
            package_entry_names = $entryNames
            allowed_package_entry_patterns = $allowedPackageEntryPatterns
            unexpected_package_content_entries = $unexpectedPackageContentEntries
            public_api_entries = $publicApiEntries
            expected_public_api_entries = $expectedPublicApiEntries
            missing_public_api_entries = $missingPublicApiEntries
            unexpected_public_api_entries = $unexpectedPublicApiEntries
            native_rids = $nativeRids
            native_entries = $nativeEntries
            allowed_native_entries = $allowedNativeEntries
            unexpected_native_entries = $unexpectedNativeEntries
            metadata = $metadata
            package_identity_mismatches = $packageIdentityMismatches
            missing_metadata_fields = @(Get-MissingMetadataFields -Metadata $metadata)
            metadata_policy_violations = $metadataPolicyViolations
            required_search_terms = $requiredSearchTerms
            missing_search_terms = $missingSearchTerms
            declared_package_file_entries = $declaredPackageFileEntries
            missing_package_file_entries = $missingPackageFileEntries
            package_documentation_entries = $packageDocumentationEntries
            expected_package_documentation_entries = $expectedPackageDocumentationEntries
            package_documentation_mismatches = $packageDocumentationMismatches
            xml_documentation_entries = $xmlDocumentationEntries
            missing_documentation_entries = $missingDocumentationEntries
            dependencies = $dependencies
            expected_dependency_entries = $expectedDependencyEntries
            missing_dependency_entries = $missingDependencyEntries
            unexpected_dependency_entries = $unexpectedDependencyEntries
            private_surface_matches = $privateMatches
            source_file_entries = $sourceFileEntries
            debug_symbol_entries = $debugSymbolEntries
            generated_output_entries = $generatedOutputEntries
            absolute_path_matches = $absolutePathMatches
        }
    }
    finally {
        $zip.Dispose()
    }
}

$symbolPackageReports = @()
foreach ($symbolPackage in $symbolPackageFiles) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($symbolPackage.FullName)
    try {
        $entries = $zip.Entries | Sort-Object FullName
        $entryNames = $entries | ForEach-Object { $_.FullName }
        $sourceFileEntries = @($entryNames | Where-Object { $_ -match $sourceFilePattern })
        $generatedOutputEntries = @($entryNames | Where-Object { $_ -match $generatedOutputPattern })
        $absolutePathMatches = @(Get-AbsolutePathMatches -Entries $entries)
        $pdbEntries = @($entryNames | Where-Object { $_ -match "^lib/[^/]+/TinyRustLM\.[^/]+\.pdb$" })
        $unexpectedSymbolPackageEntriesForPackage = @(Get-SymbolPackageUnexpectedEntries -EntryNames $entryNames)
        $nuspecEntry = $entries | Where-Object { $_.FullName -like "*.nuspec" } | Select-Object -First 1
        $nuspecText = if ($nuspecEntry) { Read-ZipEntryText -Entry $nuspecEntry } else { "" }
        $metadata = Read-NuspecMetadata -NuspecText $nuspecText
        $expectedPackageId = Get-ExpectedSymbolPackageIdForName -PackageName $symbolPackage.Name -PackageVersion $sourcePackageVersion
        $expectedPackageVersion = if ($expectedPackageId) { $sourcePackageVersion } else { "" }
        $hasSymbolsPackageType = Test-SymbolsPackageType -NuspecText $nuspecText
        $symbolIdentityMismatches = @(Get-SymbolPackageIdentityMismatches `
            -PackageName $symbolPackage.Name `
            -ExpectedPackageId $expectedPackageId `
            -ExpectedPackageVersion $expectedPackageVersion `
            -Metadata $metadata `
            -HasSymbolsPackageType $hasSymbolsPackageType)
        $noncanonicalTimestampEntries = @(Get-NoncanonicalTimestampEntries -Entries $entries)

        $symbolPackageReports += [ordered]@{
            name = $symbolPackage.Name
            package_id = $expectedPackageId
            expected_package_id = $expectedPackageId
            expected_package_version = $expectedPackageVersion
            path = $symbolPackage.FullName
            sha256 = (Get-FileHash -LiteralPath $symbolPackage.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            byte_count = $symbolPackage.Length
            entry_count = $entries.Count
            noncanonical_timestamp_entries = $noncanonicalTimestampEntries
            package_entry_names = $entryNames
            pdb_entries = $pdbEntries
            has_symbols_package_type = $hasSymbolsPackageType
            package_identity_mismatches = $symbolIdentityMismatches
            unexpected_symbol_package_entries = $unexpectedSymbolPackageEntriesForPackage
            source_file_entries = $sourceFileEntries
            generated_output_entries = $generatedOutputEntries
            absolute_path_matches = $absolutePathMatches
        }
    }
    finally {
        $zip.Dispose()
    }
}

$corePackage = $packageReports | Where-Object { $_.name -like "TinyRustLM.Core.*.nupkg" } | Select-Object -First 1
$missingNativeRids = @()
if ($corePackage) {
    foreach ($rid in $RequiredNativeRids) {
        if ($corePackage.native_rids -notcontains $rid) {
            $missingNativeRids += $rid
        }
    }
}
elseif ($RequiredNativeRids.Count -gt 0) {
    $missingNativeRids = $RequiredNativeRids
}

$allPrivateMatches = @($packageReports | ForEach-Object { $_.private_surface_matches } | Where-Object { $_ })
$allPackageIdentityMismatches = @($packageReports | ForEach-Object { $_.package_identity_mismatches } | Where-Object { $_ })
$allMissingMetadata = @($packageReports | ForEach-Object { $_.missing_metadata_fields } | Where-Object { $_ })
$allMetadataPolicyViolations = @($packageReports | ForEach-Object { $_.metadata_policy_violations } | Where-Object { $_ })
$allMissingSearchTerms = @($packageReports | ForEach-Object { $_.missing_search_terms } | Where-Object { $_ })
$allMissingPackageFiles = @($packageReports | ForEach-Object { $_.missing_package_file_entries } | Where-Object { $_ })
$allPackageDocumentationMismatches = @($packageReports | ForEach-Object { $_.package_documentation_mismatches } | Where-Object { $_ })
$allMissingDependencies = @($packageReports | ForEach-Object { $_.missing_dependency_entries } | Where-Object { $_ })
$allUnexpectedDependencies = @($packageReports | ForEach-Object { $_.unexpected_dependency_entries } | Where-Object { $_ })
$allUnexpectedNativeEntries = @($packageReports | ForEach-Object { $_.unexpected_native_entries } | Where-Object { $_ })
$allUnexpectedPackageContentEntries = @($packageReports | ForEach-Object { $_.unexpected_package_content_entries } | Where-Object { $_ })
$allMissingPublicApiEntries = @($packageReports | ForEach-Object { $_.missing_public_api_entries } | Where-Object { $_ })
$allUnexpectedPublicApiEntries = @($packageReports | ForEach-Object { $_.unexpected_public_api_entries } | Where-Object { $_ })
$allMissingDocumentation = @($packageReports | ForEach-Object { $_.missing_documentation_entries } | Where-Object { $_ })
$allSourceFileEntries = @($packageReports | ForEach-Object { $_.source_file_entries } | Where-Object { $_ })
$allDebugSymbolEntries = @($packageReports | ForEach-Object { $_.debug_symbol_entries } | Where-Object { $_ })
$allGeneratedOutputEntries = @($packageReports | ForEach-Object { $_.generated_output_entries } | Where-Object { $_ })
$allAbsolutePathMatches = @($packageReports | ForEach-Object { $_.absolute_path_matches } | Where-Object { $_ })
$allNoncanonicalPackageTimestampEntries = @($packageReports | ForEach-Object {
    $packageReport = $_
    @($packageReport.noncanonical_timestamp_entries) | ForEach-Object {
        [ordered]@{ package = $packageReport.name; entry = $_ }
    }
})
$allSymbolPackageIdentityMismatches = @($symbolPackageReports | ForEach-Object { $_.package_identity_mismatches } | Where-Object { $_ })
$allSymbolPackageUnexpectedEntries = @($symbolPackageReports | ForEach-Object { $_.unexpected_symbol_package_entries } | Where-Object { $_ })
$allSymbolPackageMissingPdbEntries = @($symbolPackageReports | Where-Object { @($_.pdb_entries).Count -eq 0 } | ForEach-Object { $_.name })
$allSymbolPackageSourceFileEntries = @($symbolPackageReports | ForEach-Object { $_.source_file_entries } | Where-Object { $_ })
$allSymbolPackageGeneratedOutputEntries = @($symbolPackageReports | ForEach-Object { $_.generated_output_entries } | Where-Object { $_ })
$allSymbolPackageAbsolutePathMatches = @($symbolPackageReports | ForEach-Object { $_.absolute_path_matches } | Where-Object { $_ })
$allNoncanonicalSymbolPackageTimestampEntries = @($symbolPackageReports | ForEach-Object {
    $packageReport = $_
    @($packageReport.noncanonical_timestamp_entries) | ForEach-Object {
        [ordered]@{ package = $packageReport.name; entry = $_ }
    }
})
$checksPassed = @(
    $missingPackageEntries.Count -eq 0
    $unexpectedPackageEntries.Count -eq 0
    $missingSymbolPackageEntries.Count -eq 0
    $unexpectedSymbolPackageEntries.Count -eq 0
    $allPackageIdentityMismatches.Count -eq 0
    $allSymbolPackageIdentityMismatches.Count -eq 0
    $missingNativeRids.Count -eq 0
    $allPrivateMatches.Count -eq 0
    $allMissingMetadata.Count -eq 0
    $allMetadataPolicyViolations.Count -eq 0
    $allMissingSearchTerms.Count -eq 0
    $allMissingPackageFiles.Count -eq 0
    $allPackageDocumentationMismatches.Count -eq 0
    $allMissingDependencies.Count -eq 0
    $allUnexpectedDependencies.Count -eq 0
    $allUnexpectedNativeEntries.Count -eq 0
    $allUnexpectedPackageContentEntries.Count -eq 0
    $allMissingPublicApiEntries.Count -eq 0
    $allUnexpectedPublicApiEntries.Count -eq 0
    $allMissingDocumentation.Count -eq 0
    $allSourceFileEntries.Count -eq 0
    $allDebugSymbolEntries.Count -eq 0
    $allGeneratedOutputEntries.Count -eq 0
    $allAbsolutePathMatches.Count -eq 0
    $allNoncanonicalPackageTimestampEntries.Count -eq 0
    $allSymbolPackageUnexpectedEntries.Count -eq 0
    $allSymbolPackageMissingPdbEntries.Count -eq 0
    $allSymbolPackageSourceFileEntries.Count -eq 0
    $allSymbolPackageGeneratedOutputEntries.Count -eq 0
    $allSymbolPackageAbsolutePathMatches.Count -eq 0
    $allNoncanonicalSymbolPackageTimestampEntries.Count -eq 0
) -notcontains $false
$status = if ($checksPassed) { "pass" } else { "fail" }
$report = [ordered]@{
    schema = "tinyrustlm.nuget.package_audit.v1"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    canonical_entry_timestamp_utc = "1980-01-01T00:00:00Z"
    package_source = (Resolve-Path -LiteralPath $PackageSource).Path
    package_version = $sourcePackageVersion
    expected_package_names = $expectedPackageNames
    expected_symbol_package_names = $expectedSymbolPackageNames
    required_native_rids = $RequiredNativeRids
    status = $status
    missing_package_entries = $missingPackageEntries
    unexpected_package_entries = $unexpectedPackageEntries
    missing_symbol_package_entries = $missingSymbolPackageEntries
    unexpected_symbol_package_entries = $unexpectedSymbolPackageEntries
    missing_native_rids = $missingNativeRids
    noncanonical_package_timestamp_entries = $allNoncanonicalPackageTimestampEntries
    noncanonical_symbol_package_timestamp_entries = $allNoncanonicalSymbolPackageTimestampEntries
    missing_package_count = $missingPackageEntries.Count
    unexpected_package_count = $unexpectedPackageEntries.Count
    missing_symbol_package_count = $missingSymbolPackageEntries.Count
    unexpected_symbol_package_count = $unexpectedSymbolPackageEntries.Count
    package_identity_mismatch_count = $allPackageIdentityMismatches.Count
    symbol_package_identity_mismatch_count = $allSymbolPackageIdentityMismatches.Count
    missing_metadata_count = $allMissingMetadata.Count
    metadata_policy_violation_count = $allMetadataPolicyViolations.Count
    missing_search_term_count = $allMissingSearchTerms.Count
    missing_package_file_count = $allMissingPackageFiles.Count
    package_documentation_mismatch_count = $allPackageDocumentationMismatches.Count
    missing_dependency_count = $allMissingDependencies.Count
    unexpected_dependency_count = $allUnexpectedDependencies.Count
    unexpected_native_entry_count = $allUnexpectedNativeEntries.Count
    unexpected_package_content_entry_count = $allUnexpectedPackageContentEntries.Count
    missing_public_api_entry_count = $allMissingPublicApiEntries.Count
    unexpected_public_api_entry_count = $allUnexpectedPublicApiEntries.Count
    missing_documentation_count = $allMissingDocumentation.Count
    source_file_count = $allSourceFileEntries.Count
    debug_symbol_count = $allDebugSymbolEntries.Count
    generated_output_count = $allGeneratedOutputEntries.Count
    absolute_path_match_count = $allAbsolutePathMatches.Count
    noncanonical_package_timestamp_entry_count = $allNoncanonicalPackageTimestampEntries.Count
    symbol_package_unexpected_entry_count = $allSymbolPackageUnexpectedEntries.Count
    symbol_package_missing_pdb_count = $allSymbolPackageMissingPdbEntries.Count
    symbol_package_source_file_count = $allSymbolPackageSourceFileEntries.Count
    symbol_package_generated_output_count = $allSymbolPackageGeneratedOutputEntries.Count
    symbol_package_absolute_path_match_count = $allSymbolPackageAbsolutePathMatches.Count
    noncanonical_symbol_package_timestamp_entry_count = $allNoncanonicalSymbolPackageTimestampEntries.Count
    package_count = $packageReports.Count
    symbol_package_count = $symbolPackageReports.Count
    packages = $packageReports
    symbol_packages = $symbolPackageReports
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
Write-JsonReport -Value $report -Path $ReportOutput
Write-Host "TinyRustLM NuGet package audit written to $ReportOutput"

if ($status -ne "pass") {
    throw "TinyRustLM NuGet package audit failed. See $ReportOutput"
}
