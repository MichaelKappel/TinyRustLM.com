param(
    [Parameter(Mandatory = $true)]
    [string]$PackageDirectory,
    [string]$Version = "",
    [string]$DependencyFeed = "E:\Source\WP\UAIX-Publish\DOTNET-NUGET",
    [switch]$PublishedFeed,
    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PackageDirectory = (Resolve-Path -LiteralPath $PackageDirectory).Path
$NativeRoot = Join-Path $RepoRoot "artifacts/seed-host-native"
$LibraryProject = Join-Path $RepoRoot "dotnet/src/TinyRustLM.SeedHost/TinyRustLM.SeedHost.csproj"
$LibraryId = "UAIX.Browser.p2pRuntime.SeedHost"
$ToolId = "UAIX.Browser.p2pRuntime.SeedHost.Tool"
$DependencyVersion = "0.1.8"
$RepositoryUrl = "https://github.com/MichaelKappel/TinyRustLM.com.git"

Add-Type -AssemblyName System.IO.Compression.FileSystem

if ([string]::IsNullOrWhiteSpace($Version)) {
    [xml]$projectXml = Get-Content -LiteralPath $LibraryProject
    $Version = [string]$projectXml.Project.PropertyGroup.VersionPrefix
}
if ($Version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
    throw "Seed-host package version is invalid: $Version"
}
if (-not (Test-Path -LiteralPath $NativeRoot -PathType Container)) {
    throw "Staged seed-host native root is missing: $NativeRoot"
}

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ArchiveEntryBytes {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$EntryName
    )
    $entry = $Archive.Entries | Where-Object {
        [string]::Equals($_.FullName, $EntryName, [StringComparison]::Ordinal)
    }
    Assert-Condition ($null -ne $entry) "Package entry is missing: $EntryName"
    $memory = New-Object System.IO.MemoryStream
    $stream = $entry.Open()
    try {
        $stream.CopyTo($memory)
        return $memory.ToArray()
    }
    finally {
        $stream.Dispose()
        $memory.Dispose()
    }
}

function Get-ArchiveEntryText {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$EntryName
    )
    return [Text.Encoding]::UTF8.GetString((Get-ArchiveEntryBytes -Archive $Archive -EntryName $EntryName))
}

function Get-BytesSha256 {
    param([byte[]]$Bytes)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Assert-ZipSafety {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$PackageName
    )
    Assert-Condition ($Archive.Entries.Count -gt 0) "$PackageName is empty."
    Assert-Condition ($Archive.Entries.Count -le 256) "$PackageName contains too many entries."
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    [long]$totalLength = 0
    foreach ($entry in $Archive.Entries) {
        $name = $entry.FullName.Replace('\', '/')
        Assert-Condition (-not [string]::IsNullOrWhiteSpace($name)) "$PackageName contains an empty entry name."
        Assert-Condition ($name.Length -le 240) "$PackageName contains an overlong entry name: $name"
        Assert-Condition ($seen.Add($name)) "$PackageName contains a duplicate or case-colliding entry: $name"
        Assert-Condition (-not ($name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or $name.StartsWith('//'))) "$PackageName contains an absolute path: $name"
        $segments = $name.Split('/')
        Assert-Condition (-not ($segments -contains '..')) "$PackageName contains parent traversal: $name"
        Assert-Condition (-not ($segments -contains '.')) "$PackageName contains a dot path segment: $name"
        Assert-Condition ($entry.Length -le 64MB) "$PackageName entry exceeds the size budget: $name"
        $totalLength += $entry.Length
        $unixKind = (($entry.ExternalAttributes -shr 16) -band 0xF000)
        Assert-Condition ($unixKind -ne 0xA000) "$PackageName contains a symbolic-link entry: $name"
    }
    Assert-Condition ($totalLength -le 128MB) "$PackageName exceeds the uncompressed size budget."
}

function Assert-ExactEntries {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string[]]$Expected,
        [string]$PackageName
    )
    $actual = @($Archive.Entries | ForEach-Object {
        if ($_.FullName -match '^package/services/metadata/core-properties/[0-9a-f]{32}\.psmdcp$') {
            'package/services/metadata/core-properties/{id}.psmdcp'
        }
        else {
            $_.FullName.Replace('\', '/')
        }
    } | Sort-Object)
    $normalizedExpected = @($Expected | Sort-Object)
    $difference = @(Compare-Object -ReferenceObject $normalizedExpected -DifferenceObject $actual -CaseSensitive)
    if ($difference.Count -ne 0) {
        $detail = ($difference | ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" }) -join '; '
        throw "$PackageName content allowlist mismatch: $detail"
    }
}

function Get-NuspecMetadata {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$PackageName
    )
    $nuspecEntries = @($Archive.Entries | Where-Object { $_.FullName -like '*.nuspec' })
    Assert-Condition ($nuspecEntries.Count -eq 1) "$PackageName must contain exactly one nuspec."
    $nuspecText = Get-ArchiveEntryText -Archive $Archive -EntryName $nuspecEntries[0].FullName
    [xml]$xml = $nuspecText.TrimStart([char]0xFEFF)
    $namespace = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $namespace.AddNamespace('n', $xml.DocumentElement.NamespaceURI)
    $metadata = $xml.SelectSingleNode('/n:package/n:metadata', $namespace)
    Assert-Condition ($null -ne $metadata) "$PackageName nuspec metadata is missing."
    return @{
        Xml = $xml
        Namespace = $namespace
        Metadata = $metadata
        NuspecName = $nuspecEntries[0].FullName
    }
}

function Get-MetadataText {
    param([hashtable]$Nuspec, [string]$ElementName)
    $node = $Nuspec.Metadata.SelectSingleNode("n:$ElementName", $Nuspec.Namespace)
    Assert-Condition ($null -ne $node) "Nuspec metadata element is missing: $ElementName"
    return $node.InnerText
}

function Assert-CommonMetadata {
    param(
        [hashtable]$Nuspec,
        [string]$ExpectedId,
        [string]$ExpectedTitle,
        [bool]$ToolPackage,
        [string]$PackageName
    )
    $metadata = $Nuspec.Metadata
    Assert-Condition ((Get-MetadataText $Nuspec 'id') -ceq $ExpectedId) "$PackageName has the wrong package ID."
    Assert-Condition ((Get-MetadataText $Nuspec 'version') -ceq $Version) "$PackageName has the wrong version."
    Assert-Condition ((Get-MetadataText $Nuspec 'title') -ceq $ExpectedTitle) "$PackageName has the wrong title."
    Assert-Condition ((Get-MetadataText $Nuspec 'authors') -ceq 'UAIX.org,TinyRustLM.com,MiniModel.org') "$PackageName has the wrong authors."
    Assert-Condition ((Get-MetadataText $Nuspec 'requireLicenseAcceptance') -ceq 'true') "$PackageName must require license acceptance."
    $license = $metadata.SelectSingleNode('n:license', $Nuspec.Namespace)
    Assert-Condition ($null -ne $license -and $license.GetAttribute('type') -ceq 'file') "$PackageName must use its packaged license file."
    Assert-Condition ($license.InnerText -ceq 'LICENSE.txt') "$PackageName has the wrong license path."
    Assert-Condition ((Get-MetadataText $Nuspec 'readme') -ceq 'SEED_HOST.md') "$PackageName has the wrong README path."
    Assert-Condition ([Uri](Get-MetadataText $Nuspec 'projectUrl') -eq [Uri]'https://TinyRustLM.com/') "$PackageName has the wrong project URL."
    Assert-Condition (-not [string]::IsNullOrWhiteSpace((Get-MetadataText $Nuspec 'description'))) "$PackageName description is missing."
    Assert-Condition (-not [string]::IsNullOrWhiteSpace((Get-MetadataText $Nuspec 'releaseNotes'))) "$PackageName release notes are missing."
    $tagText = Get-MetadataText $Nuspec 'tags'
    foreach ($tag in @('UAIX', 'p2pRuntime', 'TinyRustLM', 'MiniModel', 'P2P', 'seed-host', 'SLM', 'Rust')) {
        Assert-Condition ($tagText.Split(' ') -contains $tag) "$PackageName is missing searchable tag '$tag'."
    }
    $repository = $metadata.SelectSingleNode('n:repository', $Nuspec.Namespace)
    Assert-Condition ($null -ne $repository) "$PackageName repository metadata is missing."
    Assert-Condition ($repository.GetAttribute('type') -ceq 'git') "$PackageName repository type must be git."
    Assert-Condition ($repository.GetAttribute('url') -ceq $RepositoryUrl) "$PackageName repository URL is wrong."
    Assert-Condition ($repository.GetAttribute('commit') -match '^[0-9a-f]{40}$') "$PackageName repository commit is missing or invalid."
    $head = (& git -C $RepoRoot rev-parse HEAD).Trim()
    Assert-Condition ($LASTEXITCODE -eq 0) "Unable to read the TinyRustLM source revision."
    Assert-Condition ($repository.GetAttribute('commit') -ceq $head) "$PackageName repository commit does not match the current source revision."
    $packageTypes = @($metadata.SelectNodes('n:packageTypes/n:packageType', $Nuspec.Namespace) | ForEach-Object { $_.GetAttribute('name') })
    if ($ToolPackage) {
        Assert-Condition ($packageTypes.Count -eq 1 -and $packageTypes[0] -ceq 'DotnetTool') "$PackageName must declare only the DotnetTool package type."
    }
    else {
        Assert-Condition ($packageTypes.Count -eq 0) "$PackageName must not declare a tool package type."
    }
}

function Assert-LibraryDependencies {
    param([hashtable]$Nuspec, [string]$PackageName)
    $groups = @($Nuspec.Metadata.SelectNodes('n:dependencies/n:group', $Nuspec.Namespace))
    Assert-Condition ($groups.Count -eq 1) "$PackageName must contain one dependency group."
    Assert-Condition ($groups[0].GetAttribute('targetFramework') -ceq 'net8.0') "$PackageName dependency group must target net8.0."
    $actual = @{}
    foreach ($dependency in @($groups[0].SelectNodes('n:dependency', $Nuspec.Namespace))) {
        $actual[$dependency.GetAttribute('id')] = $dependency.GetAttribute('version')
    }
    $expected = @{
        'UAIX.Browser.Core.Abstractions' = "[$DependencyVersion]"
        'UAIX.Browser.p2pRuntime.P2P' = "[$DependencyVersion]"
        'Microsoft.Extensions.DependencyInjection.Abstractions' = '[8.0.2]'
        'Microsoft.Extensions.Logging.Abstractions' = '[8.0.2]'
    }
    Assert-Condition ($actual.Count -eq $expected.Count) "$PackageName has an unexpected dependency count."
    foreach ($id in $expected.Keys) {
        Assert-Condition ($actual.ContainsKey($id)) "$PackageName is missing dependency '$id'."
        Assert-Condition ($actual[$id] -ceq $expected[$id]) "$PackageName dependency '$id' must be exactly $($expected[$id]); observed $($actual[$id])."
    }
}

function Assert-NoDependencies {
    param([hashtable]$Nuspec, [string]$PackageName)
    $dependencies = @($Nuspec.Metadata.SelectNodes('n:dependencies/n:group/n:dependency', $Nuspec.Namespace))
    Assert-Condition ($dependencies.Count -eq 0) "$PackageName must be a self-contained .NET tool package without NuGet dependencies."
}

function Assert-SymbolMetadata {
    param(
        [hashtable]$Nuspec,
        [string]$ExpectedId,
        [string]$ExpectedTitle,
        [bool]$ToolPackage,
        [string]$PackageName
    )
    Assert-Condition ((Get-MetadataText $Nuspec 'id') -ceq $ExpectedId) "$PackageName has the wrong symbol package ID."
    Assert-Condition ((Get-MetadataText $Nuspec 'version') -ceq $Version) "$PackageName has the wrong symbol package version."
    Assert-Condition ((Get-MetadataText $Nuspec 'title') -ceq $ExpectedTitle) "$PackageName has the wrong symbol package title."
    Assert-Condition ([Uri](Get-MetadataText $Nuspec 'projectUrl') -eq [Uri]'https://TinyRustLM.com/') "$PackageName has the wrong project URL."
    Assert-Condition (-not [string]::IsNullOrWhiteSpace((Get-MetadataText $Nuspec 'description'))) "$PackageName description is missing."
    $types = @($Nuspec.Metadata.SelectNodes('n:packageTypes/n:packageType', $Nuspec.Namespace) | ForEach-Object { $_.GetAttribute('name') })
    Assert-Condition ($types.Count -eq 1 -and $types[0] -ceq 'SymbolsPackage') "$PackageName must declare only the SymbolsPackage type."
    $repository = $Nuspec.Metadata.SelectSingleNode('n:repository', $Nuspec.Namespace)
    Assert-Condition ($null -ne $repository) "$PackageName repository metadata is missing."
    Assert-Condition ($repository.GetAttribute('type') -ceq 'git' -and $repository.GetAttribute('url') -ceq $RepositoryUrl) "$PackageName repository metadata is invalid."
    $head = (& git -C $RepoRoot rev-parse HEAD).Trim()
    Assert-Condition ($LASTEXITCODE -eq 0 -and $repository.GetAttribute('commit') -ceq $head) "$PackageName repository commit does not match the current source revision."
    if ($ToolPackage) {
        Assert-NoDependencies -Nuspec $Nuspec -PackageName $PackageName
    }
    else {
        Assert-LibraryDependencies -Nuspec $Nuspec -PackageName $PackageName
    }
}

function Assert-PackageTextSafety {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$PackageName
    )
    $textExtensions = @('.json', '.md', '.nuspec', '.psmdcp', '.txt', '.xml')
    $forbiddenPatterns = @(
        '(?i)(?:authorization\s*:\s*bearer|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',
        '(?i)\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\b\s*[:=]\s*["'']?[A-Za-z0-9_./+\-=]{12,}',
        '(?i)https?://[^\s/:@]+:[^\s/@]+@',
        '(?i)(?:[A-Z]:\\(?:Source|Users)\\|/home/[^/]+/|/Users/[^/]+/|\.codex[\\/])',
        '(?i)(?:codex_internal_context|external-agent-codex-handoff|nuget-api-key)'
    )
    foreach ($entry in $Archive.Entries) {
        $name = $entry.FullName.Replace('\', '/')
        Assert-Condition ($name -notmatch '(?i)\.(?:slm|gguf|safetensors|onnx|pt|pth)$') "$PackageName contains model weights: $name"
        Assert-Condition ($name -notmatch '(?i)(?:slm[_-]?pack|selector[_-]?registry|breeding|training[_-]?recipe|premium[_-]?optimizer|license[_-]?server|encryption[_-]?key)') "$PackageName contains a prohibited private implementation entry: $name"
        if ($textExtensions -notcontains [IO.Path]::GetExtension($name).ToLowerInvariant()) {
            continue
        }
        Assert-Condition ($entry.Length -le 2MB) "$PackageName text entry exceeds the scan budget: $name"
        $text = Get-ArchiveEntryText -Archive $Archive -EntryName $entry.FullName
        foreach ($pattern in $forbiddenPatterns) {
            Assert-Condition ($text -notmatch $pattern) "$PackageName contains secret-like or machine-local text in $name."
        }
    }
}

function Get-ExpectedNativeHashes {
    $result = @{}
    $ridFiles = @{
        'win-x64' = @('minimodel.exe', 'minimodel_native.dll')
        'linux-x64' = @('libminimodel_native.so', 'minimodel')
        'linux-arm64' = @('libminimodel_native.so', 'minimodel')
    }
    foreach ($rid in $ridFiles.Keys) {
        $ridRoot = Join-Path $NativeRoot $rid
        $manifest = Join-Path $ridRoot 'SHA256SUMS.txt'
        Assert-Condition (Test-Path -LiteralPath $manifest -PathType Leaf) "Native hash manifest is missing for $rid."
        $observed = @{}
        foreach ($line in @(Get-Content -LiteralPath $manifest)) {
            Assert-Condition ($line -match '^([0-9a-f]{64})  ([A-Za-z0-9_.-]+)$') "Native hash manifest has an invalid line for $rid."
            $observed[$Matches[2]] = $Matches[1]
        }
        Assert-Condition ($observed.Count -eq $ridFiles[$rid].Count) "Native hash manifest has the wrong file count for $rid."
        foreach ($file in $ridFiles[$rid]) {
            Assert-Condition ($observed.ContainsKey($file)) "Native hash manifest for $rid is missing $file."
            $path = Join-Path $ridRoot $file
            Assert-Condition (Test-Path -LiteralPath $path -PathType Leaf) "Staged native file is missing: $rid/$file"
            Assert-Condition ((Get-Sha256 $path) -ceq $observed[$file]) "Staged native hash does not match its manifest: $rid/$file"
            $result["$rid/$file"] = $observed[$file]
        }
    }
    return $result
}

function Assert-NativeMachine {
    param([byte[]]$Bytes, [string]$Rid, [string]$EntryName)
    if ($Rid -eq 'win-x64') {
        Assert-Condition ($Bytes.Length -ge 256 -and $Bytes[0] -eq 0x4D -and $Bytes[1] -eq 0x5A) "$EntryName is not a PE binary."
        $peOffset = [BitConverter]::ToInt32($Bytes, 0x3C)
        Assert-Condition ($peOffset -gt 0 -and $peOffset + 6 -le $Bytes.Length) "$EntryName has an invalid PE header."
        Assert-Condition ($Bytes[$peOffset] -eq 0x50 -and $Bytes[$peOffset + 1] -eq 0x45) "$EntryName has an invalid PE signature."
        Assert-Condition ([BitConverter]::ToUInt16($Bytes, $peOffset + 4) -eq 0x8664) "$EntryName is not x64 PE."
        return
    }
    Assert-Condition ($Bytes.Length -ge 20 -and $Bytes[0] -eq 0x7F -and $Bytes[1] -eq 0x45 -and $Bytes[2] -eq 0x4C -and $Bytes[3] -eq 0x46) "$EntryName is not ELF."
    Assert-Condition ($Bytes[4] -eq 2 -and $Bytes[5] -eq 1) "$EntryName must be little-endian ELF64."
    $expectedMachine = if ($Rid -eq 'linux-x64') { 62 } else { 183 }
    Assert-Condition ([BitConverter]::ToUInt16($Bytes, 18) -eq $expectedMachine) "$EntryName has the wrong ELF architecture for $Rid."
}

function Assert-NativePackageEntries {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$Prefix,
        [hashtable]$ExpectedHashes,
        [string]$PackageName
    )
    foreach ($identity in $ExpectedHashes.Keys) {
        $parts = $identity.Split('/')
        $rid = $parts[0]
        $file = $parts[1]
        $entryName = "$Prefix$rid/native/$file"
        $bytes = Get-ArchiveEntryBytes -Archive $Archive -EntryName $entryName
        Assert-Condition ((Get-BytesSha256 $bytes) -ceq $ExpectedHashes[$identity]) "$PackageName native hash mismatch: $entryName"
        Assert-NativeMachine -Bytes $bytes -Rid $rid -EntryName $entryName
    }
}

function Assert-SymbolPackage {
    param(
        [string]$Path,
        [string]$ExpectedId,
        [string[]]$ExpectedEntries,
        [string[]]$PdbEntries,
        [bool]$ToolPackage
    )
    $packageName = [IO.Path]::GetFileName($Path)
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        Assert-ZipSafety -Archive $archive -PackageName $packageName
        Assert-ExactEntries -Archive $archive -Expected $ExpectedEntries -PackageName $packageName
        $nuspec = Get-NuspecMetadata -Archive $archive -PackageName $packageName
        $title = if ($ToolPackage) { 'UAIX Browser p2pRuntime Seed Host Tool' } else { 'UAIX Browser p2pRuntime Seed Host' }
        Assert-SymbolMetadata -Nuspec $nuspec -ExpectedId $ExpectedId -ExpectedTitle $title -ToolPackage $ToolPackage -PackageName $packageName
        foreach ($entryName in $PdbEntries) {
            $bytes = Get-ArchiveEntryBytes -Archive $archive -EntryName $entryName
            Assert-Condition ($bytes.Length -gt 4 -and $bytes[0] -eq 0x42 -and $bytes[1] -eq 0x53 -and $bytes[2] -eq 0x4A -and $bytes[3] -eq 0x42) "$packageName contains a non-portable PDB: $entryName"
            $text = [Text.Encoding]::UTF8.GetString($bytes)
            Assert-Condition ($text.IndexOf('raw.githubusercontent.com', [StringComparison]::OrdinalIgnoreCase) -ge 0) "$packageName PDB lacks SourceLink evidence: $entryName"
            $repository = $nuspec.Metadata.SelectSingleNode('n:repository', $nuspec.Namespace)
            Assert-Condition ($text.IndexOf($repository.GetAttribute('commit'), [StringComparison]::Ordinal) -ge 0) "$packageName PDB is not bound to its repository commit: $entryName"
        }
    }
    finally {
        $archive.Dispose()
    }
}

$expectedFiles = @(
    "$LibraryId.$Version.nupkg",
    "$LibraryId.$Version.snupkg",
    "$ToolId.$Version.nupkg",
    "$ToolId.$Version.snupkg"
)
foreach ($name in $expectedFiles) {
    $path = Join-Path $PackageDirectory $name
    Assert-Condition (Test-Path -LiteralPath $path -PathType Leaf) "Required seed-host package is missing: $name"
    Assert-Condition ((Get-Item -LiteralPath $path).Length -gt 0) "Required seed-host package is empty: $name"
}
$sameVersionFamily = @(Get-ChildItem -LiteralPath $PackageDirectory -File | Where-Object {
    $_.Name -like "$LibraryId*$Version.nupkg" -or $_.Name -like "$LibraryId*$Version.snupkg"
})
Assert-Condition ($sameVersionFamily.Count -eq 4) "The package directory contains an unexpected seed-host file for version $Version."

$nativeHashes = Get-ExpectedNativeHashes
$libraryEntries = @(
    '[Content_Types].xml',
    '_rels/.rels',
    'lib/net8.0/TinyRustLM.SeedHost.dll',
    'lib/net8.0/TinyRustLM.SeedHost.xml',
    'LICENSE.txt',
    'package/services/metadata/core-properties/{id}.psmdcp',
    'runtimes/linux-arm64/native/libminimodel_native.so',
    'runtimes/linux-arm64/native/minimodel',
    'runtimes/linux-x64/native/libminimodel_native.so',
    'runtimes/linux-x64/native/minimodel',
    'runtimes/win-x64/native/minimodel.exe',
    'runtimes/win-x64/native/minimodel_native.dll',
    'SEED_HOST.md',
    "$LibraryId.nuspec"
)
$toolEntries = @(
    '[Content_Types].xml',
    '_rels/.rels',
    'LICENSE.txt',
    'package/services/metadata/core-properties/{id}.psmdcp',
    'SEED_HOST.md',
    'tools/net8.0/any/DotnetToolSettings.xml',
    'tools/net8.0/any/Microsoft.Extensions.DependencyInjection.Abstractions.dll',
    'tools/net8.0/any/Microsoft.Extensions.Logging.Abstractions.dll',
    'tools/net8.0/any/runtimes/linux-arm64/native/libminimodel_native.so',
    'tools/net8.0/any/runtimes/linux-arm64/native/minimodel',
    'tools/net8.0/any/runtimes/linux-x64/native/libminimodel_native.so',
    'tools/net8.0/any/runtimes/linux-x64/native/minimodel',
    'tools/net8.0/any/runtimes/win-x64/native/minimodel.exe',
    'tools/net8.0/any/runtimes/win-x64/native/minimodel_native.dll',
    'tools/net8.0/any/TinyRustLM.Abstractions.dll',
    'tools/net8.0/any/TinyRustLM.Core.dll',
    'tools/net8.0/any/TinyRustLM.P2P.dll',
    'tools/net8.0/any/TinyRustLM.SeedHost.dll',
    'tools/net8.0/any/TinyRustLM.SeedHost.pdb',
    'tools/net8.0/any/TinyRustLM.SeedHost.xml',
    'tools/net8.0/any/uaix-p2p-seed.deps.json',
    'tools/net8.0/any/uaix-p2p-seed.dll',
    'tools/net8.0/any/uaix-p2p-seed.pdb',
    'tools/net8.0/any/uaix-p2p-seed.runtimeconfig.json',
    'tools/net8.0/any/uaix-p2p-seed.xml',
    "$ToolId.nuspec"
)

$libraryPath = Join-Path $PackageDirectory "$LibraryId.$Version.nupkg"
$libraryArchive = [IO.Compression.ZipFile]::OpenRead($libraryPath)
try {
    Assert-ZipSafety -Archive $libraryArchive -PackageName ([IO.Path]::GetFileName($libraryPath))
    Assert-ExactEntries -Archive $libraryArchive -Expected $libraryEntries -PackageName ([IO.Path]::GetFileName($libraryPath))
    $libraryNuspec = Get-NuspecMetadata -Archive $libraryArchive -PackageName ([IO.Path]::GetFileName($libraryPath))
    Assert-CommonMetadata -Nuspec $libraryNuspec -ExpectedId $LibraryId -ExpectedTitle 'UAIX Browser p2pRuntime Seed Host' -ToolPackage $false -PackageName ([IO.Path]::GetFileName($libraryPath))
    Assert-LibraryDependencies -Nuspec $libraryNuspec -PackageName ([IO.Path]::GetFileName($libraryPath))
    Assert-NativePackageEntries -Archive $libraryArchive -Prefix 'runtimes/' -ExpectedHashes $nativeHashes -PackageName ([IO.Path]::GetFileName($libraryPath))
    Assert-PackageTextSafety -Archive $libraryArchive -PackageName ([IO.Path]::GetFileName($libraryPath))
}
finally {
    $libraryArchive.Dispose()
}

$toolPath = Join-Path $PackageDirectory "$ToolId.$Version.nupkg"
$toolArchive = [IO.Compression.ZipFile]::OpenRead($toolPath)
try {
    Assert-ZipSafety -Archive $toolArchive -PackageName ([IO.Path]::GetFileName($toolPath))
    Assert-ExactEntries -Archive $toolArchive -Expected $toolEntries -PackageName ([IO.Path]::GetFileName($toolPath))
    $toolNuspec = Get-NuspecMetadata -Archive $toolArchive -PackageName ([IO.Path]::GetFileName($toolPath))
    Assert-CommonMetadata -Nuspec $toolNuspec -ExpectedId $ToolId -ExpectedTitle 'UAIX Browser p2pRuntime Seed Host Tool' -ToolPackage $true -PackageName ([IO.Path]::GetFileName($toolPath))
    Assert-NoDependencies -Nuspec $toolNuspec -PackageName ([IO.Path]::GetFileName($toolPath))
    Assert-NativePackageEntries -Archive $toolArchive -Prefix 'tools/net8.0/any/runtimes/' -ExpectedHashes $nativeHashes -PackageName ([IO.Path]::GetFileName($toolPath))
    Assert-PackageTextSafety -Archive $toolArchive -PackageName ([IO.Path]::GetFileName($toolPath))
}
finally {
    $toolArchive.Dispose()
}

$librarySymbolEntries = @(
    '[Content_Types].xml',
    '_rels/.rels',
    'lib/net8.0/TinyRustLM.SeedHost.pdb',
    'package/services/metadata/core-properties/{id}.psmdcp',
    "$LibraryId.nuspec"
)
$toolPdbEntries = @(
    'tools/net8.0/any/TinyRustLM.SeedHost.pdb',
    'tools/net8.0/any/uaix-p2p-seed.pdb'
)
$toolSymbolEntries = @(
    '[Content_Types].xml',
    '_rels/.rels',
    'package/services/metadata/core-properties/{id}.psmdcp',
    "$ToolId.nuspec"
) + $toolPdbEntries
Assert-SymbolPackage -Path (Join-Path $PackageDirectory "$LibraryId.$Version.snupkg") -ExpectedId $LibraryId -ExpectedEntries $librarySymbolEntries -PdbEntries @('lib/net8.0/TinyRustLM.SeedHost.pdb') -ToolPackage $false
Assert-SymbolPackage -Path (Join-Path $PackageDirectory "$ToolId.$Version.snupkg") -ExpectedId $ToolId -ExpectedEntries $toolSymbolEntries -PdbEntries $toolPdbEntries -ToolPackage $true

if ($PublishedFeed) {
    $hashName = "SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost-$Version.txt"
    $hashPath = Join-Path $PackageDirectory $hashName
    $readmePath = Join-Path $PackageDirectory "README-UAIX.Browser.p2pRuntime.SeedHost-$Version.txt"
    Assert-Condition (Test-Path -LiteralPath $hashPath -PathType Leaf) "Published feed hash manifest is missing: $hashName"
    Assert-Condition (Test-Path -LiteralPath $readmePath -PathType Leaf) "Published feed README is missing."
    $observedHashes = @{}
    foreach ($line in @(Get-Content -LiteralPath $hashPath)) {
        Assert-Condition ($line -match '^([0-9a-f]{64})  (.+\.(?:nupkg|snupkg))$') "Published feed hash manifest contains an invalid line."
        $observedHashes[$Matches[2]] = $Matches[1]
    }
    Assert-Condition ($observedHashes.Count -eq 4) "Published feed hash manifest must contain exactly four entries."
    foreach ($name in $expectedFiles) {
        Assert-Condition ($observedHashes.ContainsKey($name)) "Published feed hash manifest is missing $name."
        Assert-Condition ($observedHashes[$name] -ceq (Get-Sha256 (Join-Path $PackageDirectory $name))) "Published feed hash mismatch: $name"
    }
    $readme = Get-Content -LiteralPath $readmePath -Raw
    foreach ($requiredText in @($Version, $LibraryId, $ToolId, 'uaix-p2p-seed', 'net8.0', 'win-x64', 'linux-x64', 'linux-arm64', $hashName)) {
        Assert-Condition ($readme.IndexOf($requiredText, [StringComparison]::OrdinalIgnoreCase) -ge 0) "Published feed README is missing '$requiredText'."
    }
}

& (Join-Path $PSScriptRoot 'test-seed-host-package-consumers.ps1') `
    -PackageDirectory $PackageDirectory `
    -DependencyFeed $DependencyFeed `
    -Version $Version
# The child handles expected nonzero native diagnostics itself. Any real failure
# throws; LASTEXITCODE may intentionally remain 3 after its final negative test.

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $stamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmssfffffff')
    $ReportPath = Join-Path $RepoRoot "artifacts/reports/seed-host-package-audit-$Version-$stamp.json"
}
$reportDirectory = Split-Path -Parent $ReportPath
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$packageHashes = @()
foreach ($name in $expectedFiles | Sort-Object) {
    $packageHashes += [ordered]@{
        name = $name
        sha256 = "sha256:$(Get-Sha256 (Join-Path $PackageDirectory $name))"
    }
}
[ordered]@{
    report_kind = 'uaix.seed_host.package_audit.v0'
    report_version = 0
    generated_utc = [DateTimeOffset]::UtcNow.ToString('O')
    package_version = $Version
    package_directory = $PackageDirectory
    source_revision = (& git -C $RepoRoot rev-parse HEAD).Trim()
    packages = $packageHashes
    native_rids = @('win-x64', 'linux-x64', 'linux-arm64')
    exact_dependency_bounds = $true
    symbols_and_sourcelink_verified = $true
    clean_consumers_verified = $true
    installed_tool_fixture_round_trip_verified = $true
    missing_and_wrong_architecture_diagnostics_verified = $true
    model_weights_included = $false
    private_authoring_surface_included = $false
    secret_material_included = $false
    published_feed_layout_verified = [bool]$PublishedFeed
    status = 'passed'
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host "Seed-host NuGet package verification passed for $Version."
Write-Host "Audit report: $ReportPath"
