param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",
    [string]$OutputDirectory = "",
    [string]$SbomToolPath = "",
    [string]$MiniModelSourceRoot = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($MiniModelSourceRoot)) {
    $MiniModelSourceRoot = $env:MINIMODEL_SOURCE_ROOT
}
if ([string]::IsNullOrWhiteSpace($MiniModelSourceRoot)) {
    $MiniModelSourceRoot = Join-Path (Split-Path $RepoRoot -Parent) "MiniModel.org"
}
$MiniModelSourceRoot = (Resolve-Path -LiteralPath $MiniModelSourceRoot).Path
$Project = Join-Path $RepoRoot "dotnet/tools/TinyRustLM.SeedHost.Tool/TinyRustLM.SeedHost.Tool.csproj"
[xml]$ProjectXml = Get-Content -LiteralPath $Project
$Version = [string]$ProjectXml.Project.PropertyGroup.VersionPrefix
if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Seed-host tool VersionPrefix is missing from $Project"
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $RepoRoot "artifacts/releases"
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path

$PackageName = "UAIX.Browser.p2pRuntime.SeedHost.Tool"
$Rids = @("win-x64", "linux-x64", "linux-arm64")
$SbomToolVersion = "4.1.5"
$SbomToolSha256 = "625767b371b7fdd58f40f618b8a86da0247a33c89e419039c86b4edba1dad4b5"
$SbomToolUrl = "https://github.com/microsoft/sbom-tool/releases/download/v$SbomToolVersion/sbom-tool-win-x64.exe"
$PackageProperties = @(
    "/p:TinyRustLmAbstractionsPackageId=UAIX.Browser.Core.Abstractions",
    "/p:TinyRustLmP2PPackageId=UAIX.Browser.p2pRuntime.P2P"
)

$SourceDateEpoch = (& git -C $RepoRoot show -s --format=%ct HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $SourceDateEpoch -notmatch "^[0-9]{10,}$") {
    throw "Unable to determine a release timestamp from the TinyRustLM source revision"
}

function Invoke-DotNet {
    param([string[]]$Arguments)
    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RequiredNativeNames {
    param([string]$Rid)
    if ($Rid -eq "win-x64") {
        return @("minimodel.exe", "minimodel_native.dll", "tinyrustlm-slm-pack.exe")
    }
    return @("libminimodel_native.so", "minimodel", "tinyrustlm-slm-pack")
}

function Resolve-GnuReleaseTools {
    $gitCommand = Get-Command git.exe -ErrorAction Stop
    $gitRoot = Split-Path (Split-Path $gitCommand.Source -Parent) -Parent
    $tools = [ordered]@{
        Tar = Join-Path $gitRoot "usr/bin/tar.exe"
        Gzip = Join-Path $gitRoot "usr/bin/gzip.exe"
        Cygpath = Join-Path $gitRoot "usr/bin/cygpath.exe"
    }
    foreach ($entry in $tools.GetEnumerator()) {
        if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) {
            throw "Git for Windows GNU $($entry.Key) is required to build Linux release archives: $($entry.Value)"
        }
    }
    $version = @(& $tools.Tar --version)
    if ($LASTEXITCODE -ne 0 -or $version.Count -eq 0 -or $version[0] -notmatch "GNU tar") {
        throw "The Linux release builder requires GNU tar from Git for Windows"
    }
    return $tools
}

function Convert-ToGitUnixPath {
    param([string]$Path)
    $converted = (& $script:GnuReleaseTools.Cygpath -u $Path).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($converted)) {
        throw "Unable to convert a release path for GNU tools: $Path"
    }
    return $converted
}

function New-LinuxReleaseArchive {
    param(
        [string]$Payload,
        [string]$ArchivePath,
        [string]$Rid
    )
    if (-not $ArchivePath.EndsWith(".tar.gz", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Linux release archives must use the .tar.gz extension"
    }
    $payloadResolved = (Resolve-Path -LiteralPath $Payload).Path
    $archiveParent = Split-Path $ArchivePath -Parent
    $archiveName = Split-Path $ArchivePath -Leaf
    $tarName = $archiveName.Substring(0, $archiveName.Length - 3)
    $tarPath = Join-Path $archiveParent $tarName
    $regularList = Join-Path $archiveParent "$Rid-regular-files.txt"
    $executableList = Join-Path $archiveParent "$Rid-executable-files.txt"
    $executableFiles = @(
        "uaix-p2p-seed",
        "runtimes/$Rid/native/minimodel",
        "runtimes/$Rid/native/tinyrustlm-slm-pack"
    )
    $allFiles = @(Get-ChildItem -LiteralPath $payloadResolved -Recurse -File |
        ForEach-Object {
            $_.FullName.Substring($payloadResolved.Length + 1).Replace("\", "/")
        } |
        Sort-Object)
    if ($allFiles.Count -eq 0) {
        throw "Linux release payload is empty for $Rid"
    }
    foreach ($path in $allFiles) {
        if ($path -match "[\r\n]") {
            throw "Release payload paths cannot contain line breaks: $path"
        }
    }
    foreach ($path in $executableFiles) {
        if ($allFiles -notcontains $path) {
            throw "Linux release payload is missing required executable: $path"
        }
    }
    $regularFiles = @($allFiles | Where-Object { $_ -notin $executableFiles })
    $utf8WithoutBom = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($regularList, (($regularFiles -join "`n") + "`n"), $utf8WithoutBom)
    [IO.File]::WriteAllText($executableList, (($executableFiles -join "`n") + "`n"), $utf8WithoutBom)

    $payloadUnix = Convert-ToGitUnixPath -Path $payloadResolved
    $tarUnix = Convert-ToGitUnixPath -Path $tarPath
    $regularListUnix = Convert-ToGitUnixPath -Path $regularList
    $executableListUnix = Convert-ToGitUnixPath -Path $executableList
    $commonArguments = @(
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "--format=posix",
        "--mtime=@$SourceDateEpoch",
        "--no-recursion"
    )
    & $script:GnuReleaseTools.Tar --create "--file=$tarUnix" "--directory=$payloadUnix" `
        @commonArguments --mode=0644 "--files-from=$regularListUnix"
    if ($LASTEXITCODE -ne 0) {
        throw "GNU tar failed while adding regular files for $Rid"
    }
    & $script:GnuReleaseTools.Tar --append "--file=$tarUnix" "--directory=$payloadUnix" `
        @commonArguments --mode=0755 "--files-from=$executableListUnix"
    if ($LASTEXITCODE -ne 0) {
        throw "GNU tar failed while adding executable files for $Rid"
    }
    & $script:GnuReleaseTools.Gzip -n -9 $tarUnix
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
        throw "GNU gzip failed while creating $ArchivePath"
    }
}

function Assert-NativeAssets {
    param([string]$Rid)
    $directory = Join-Path $RepoRoot "artifacts/seed-host-native/$Rid"
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        throw "Verified native asset directory is missing for $Rid"
    }
    $required = @(Get-RequiredNativeNames -Rid $Rid)
    foreach ($name in $required) {
        $path = Join-Path $directory $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Verified native asset is missing for ${Rid}: $name"
        }
        $information = Get-Item -LiteralPath $path -Force
        if (($information.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Native asset cannot be a link or reparse point: $path"
        }
    }
    $manifestPath = Join-Path $directory "SHA256SUMS.txt"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Native SHA-256 manifest is missing for $Rid"
    }
    $lines = @(Get-Content -LiteralPath $manifestPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($lines.Count -ne $required.Count) {
        throw "Native SHA-256 manifest for $Rid must contain exactly $($required.Count) entries"
    }
    foreach ($name in $required) {
        $expectedLine = $lines | Where-Object { $_ -match "^[0-9a-f]{64}  $([regex]::Escape($name))$" }
        if (@($expectedLine).Count -ne 1) {
            throw "Native SHA-256 manifest for $Rid does not contain exactly one entry for $name"
        }
        $expected = ($expectedLine -split "  ", 2)[0]
        $actual = Get-Sha256 -Path (Join-Path $directory $name)
        if ($actual -ne $expected) {
            throw "Native SHA-256 mismatch for ${Rid}: $name"
        }
    }
}

function Resolve-SbomTool {
    if (-not [string]::IsNullOrWhiteSpace($SbomToolPath)) {
        $resolved = (Resolve-Path -LiteralPath $SbomToolPath).Path
        if ((Get-Sha256 -Path $resolved) -ne $SbomToolSha256) {
            throw "Configured Microsoft SBOM Tool does not match the pinned v$SbomToolVersion SHA-256"
        }
        return $resolved
    }
    $cacheRoot = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "UAIX/release-tools"
    New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
    $cached = Join-Path $cacheRoot "sbom-tool-v$SbomToolVersion-win-x64.exe"
    if (Test-Path -LiteralPath $cached -PathType Leaf) {
        if ((Get-Sha256 -Path $cached) -ne $SbomToolSha256) {
            throw "Cached Microsoft SBOM Tool failed its pinned SHA-256 check: $cached"
        }
        return $cached
    }
    $temporary = Join-Path $cacheRoot (".incoming-sbom-tool-{0}.exe" -f [guid]::NewGuid().ToString("N"))
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $SbomToolUrl -OutFile $temporary
        if ((Get-Sha256 -Path $temporary) -ne $SbomToolSha256) {
            throw "Downloaded Microsoft SBOM Tool failed its pinned SHA-256 check"
        }
        Move-Item -LiteralPath $temporary -Destination $cached
    }
    finally {
        if (Test-Path -LiteralPath $temporary -PathType Leaf) {
            Remove-Item -LiteralPath $temporary -Force
        }
    }
    return $cached
}

function Invoke-SbomTool {
    param([string[]]$Arguments)
    & $script:ResolvedSbomTool @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Microsoft SBOM Tool failed with exit code $LASTEXITCODE"
    }
}

function Get-GitEvidence {
    param([string]$Root)
    $revision = (& git -C $Root rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $revision -notmatch "^[0-9a-f]{40}$") {
        throw "Unable to read source revision from $Root"
    }
    $status = @(& git -C $Root status --porcelain=v1)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read source status from $Root"
    }
    return [ordered]@{
        revision = $revision
        dirty = $status.Count -ne 0
    }
}

function Assert-SafeArchiveEntries {
    param([string]$ArchivePath, [string]$Rid)
    if ($ArchivePath.EndsWith(".zip", [StringComparison]::OrdinalIgnoreCase)) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
        try {
            $entries = @($archive.Entries | ForEach-Object { $_.FullName })
        }
        finally {
            $archive.Dispose()
        }
    }
    else {
        $entries = @(& tar -tzf $ArchivePath)
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to list release archive: $ArchivePath"
        }
    }
    if ($entries.Count -eq 0) {
        throw "Release archive is empty: $ArchivePath"
    }
    $normalizedEntries = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $entries) {
        $normalized = $entry.Replace("\", "/")
        if ($normalized.StartsWith("/", [StringComparison]::Ordinal) -or
            $normalized -match "^[A-Za-z]:") {
            throw "Unsafe absolute path in release archive: $entry"
        }
        while ($normalized.StartsWith("./", [StringComparison]::Ordinal)) {
            $normalized = $normalized.Substring(2)
        }
        if ([string]::IsNullOrWhiteSpace($normalized)) {
            continue
        }
        if ($normalized.Split('/') -contains "..") {
            throw "Unsafe path in release archive: $entry"
        }
        $normalizedEntries.Add($normalized)
    }
    $duplicateEntries = @($normalizedEntries |
        Group-Object |
        Where-Object { $_.Count -ne 1 })
    if ($duplicateEntries.Count -ne 0) {
        throw "Release archive contains duplicate paths: $($duplicateEntries.Name -join ', ')"
    }
    $foreignNative = @($normalizedEntries | Where-Object {
        $_ -match '^runtimes/([^/]+)/native/(minimodel(?:\.exe)?|tinyrustlm-slm-pack(?:\.exe)?|(?:lib)?minimodel_native\.(?:dll|so|dylib))$' -and
        $Matches[1] -ne $Rid
    })
    if ($foreignNative.Count -ne 0) {
        throw "Release archive $ArchivePath contains foreign RID native assets"
    }
    foreach ($name in Get-RequiredNativeNames -Rid $Rid) {
        if (-not $normalizedEntries.Contains("runtimes/$Rid/native/$name")) {
            throw "Release archive $ArchivePath is missing native asset $name"
        }
    }
    if ($Rid.StartsWith("linux-", [StringComparison]::Ordinal)) {
        $verboseEntries = @(& tar -tvzf $ArchivePath)
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to inspect Linux archive modes: $ArchivePath"
        }
        foreach ($path in @(
            "uaix-p2p-seed",
            "runtimes/$Rid/native/minimodel",
            "runtimes/$Rid/native/tinyrustlm-slm-pack"
        )) {
            $matchingLine = @($verboseEntries | Where-Object { $_.EndsWith(" $path", [StringComparison]::Ordinal) })
            if ($matchingLine.Count -ne 1 -or -not $matchingLine[0].StartsWith("-rwxr-xr-x", [StringComparison]::Ordinal)) {
                throw "Linux release executable must have mode 0755: $path"
            }
        }
        foreach ($path in @("README.md", "RELEASE.json")) {
            $matchingLine = @($verboseEntries | Where-Object { $_.EndsWith(" $path", [StringComparison]::Ordinal) })
            if ($matchingLine.Count -ne 1 -or -not $matchingLine[0].StartsWith("-rw-r--r--", [StringComparison]::Ordinal)) {
                throw "Linux release regular file must have mode 0644: $path"
            }
        }
    }
}

foreach ($rid in $Rids) {
    Assert-NativeAssets -Rid $rid
}
$ResolvedSbomTool = Resolve-SbomTool
$GnuReleaseTools = Resolve-GnuReleaseTools
$TinyEvidence = Get-GitEvidence -Root $RepoRoot
$MiniEvidence = Get-GitEvidence -Root $MiniModelSourceRoot
$staging = Join-Path $OutputDirectory (".staging-seed-host-$Version-{0}" -f [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging | Out-Null
$stagingResolved = (Resolve-Path -LiteralPath $staging).Path
if (-not $stagingResolved.StartsWith($OutputDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Release staging directory escaped the requested output directory"
}

$releaseFiles = [System.Collections.Generic.List[object]]::new()
try {
    foreach ($rid in $Rids) {
        $extension = if ($rid -eq "win-x64") { ".zip" } else { ".tar.gz" }
        $baseName = "$PackageName.$Version-$rid"
        $archiveOutput = Join-Path $OutputDirectory "$baseName$extension"
        $sbomOutput = Join-Path $OutputDirectory "$baseName.spdx.json"
        $receiptOutput = Join-Path $OutputDirectory "$baseName.release.json"
        foreach ($path in @($archiveOutput, $sbomOutput, $receiptOutput)) {
            if (Test-Path -LiteralPath $path) {
                throw "Refusing to overwrite existing release artifact: $path"
            }
        }
        $archivePath = Join-Path $staging "$baseName$extension"
        $sbomStaged = Join-Path $staging "$baseName.spdx.json"
        $receiptStaged = Join-Path $staging "$baseName.release.json"

        $payload = Join-Path $staging $rid
        Invoke-DotNet -Arguments (@(
            "publish", $Project,
            "-c", $Configuration,
            "-r", $rid,
            "--self-contained", "true",
            "-o", $payload
        ) + $PackageProperties)

        $runtimeNative = Join-Path $payload "runtimes/$rid/native"
        foreach ($name in Get-RequiredNativeNames -Rid $rid) {
            if (-not (Test-Path -LiteralPath (Join-Path $runtimeNative $name) -PathType Leaf)) {
                throw "Published $rid payload is missing native asset $name"
            }
        }
        $foreignRuntimeDirectories = @(Get-ChildItem -LiteralPath (Join-Path $payload "runtimes") -Directory |
            Where-Object { $_.Name -ne $rid })
        if ($foreignRuntimeDirectories.Count -ne 0) {
            throw "Published $rid payload contains foreign RID directories"
        }

        Copy-Item -LiteralPath (Join-Path $RepoRoot "docs/nuget/SEED_HOST.md") -Destination (Join-Path $payload "README.md")
        Copy-Item -LiteralPath (Join-Path $RepoRoot "docs/nuget/LICENSE.txt") -Destination (Join-Path $payload "LICENSE.txt")
        $nativeHashes = [ordered]@{}
        foreach ($name in Get-RequiredNativeNames -Rid $rid) {
            $nativeHashes[$name] = "sha256:$(Get-Sha256 -Path (Join-Path $runtimeNative $name))"
        }
        $releaseReceipt = [ordered]@{
            schema = "uaix.seed_host.release.v0"
            package_id = $PackageName
            version = $Version
            rid = $rid
            self_contained = $true
            native_abi_version = 2
            tiny_rust_lm_source = $TinyEvidence
            mini_model_source = $MiniEvidence
            native_files = $nativeHashes
            model_bytes_included = $false
            project_server_serves_model_bytes = $false
            project_server_runs_model_bytes = $false
            project_server_proxies_model_bytes = $false
            generated_utc = [DateTimeOffset]::UtcNow.ToString("O")
        }
        $releaseReceipt | ConvertTo-Json -Depth 8 |
            Set-Content -LiteralPath (Join-Path $payload "RELEASE.json") -Encoding UTF8

        Invoke-SbomTool -Arguments @(
            "generate",
            "-b", $payload,
            "-bc", (Join-Path $RepoRoot "dotnet"),
            "-pn", $PackageName,
            "-pv", $Version,
            "-ps", "Organization: UAIX.org",
            "-nsb", "https://uaix.org/sbom/tinyrustlm-seed-host",
            "-mi", "SPDX:2.2"
        )
        $sbomPath = Join-Path $payload "_manifest/spdx_2.2/manifest.spdx.json"
        if (-not (Test-Path -LiteralPath $sbomPath -PathType Leaf)) {
            throw "Microsoft SBOM Tool did not produce the expected SPDX 2.2 manifest for $rid"
        }
        $validationPath = Join-Path $staging "$rid-sbom-validation.json"
        Invoke-SbomTool -Arguments @(
            "validate",
            "-b", $payload,
            "-o", $validationPath,
            "-mi", "SPDX:2.2"
        )
        Copy-Item -LiteralPath $sbomPath -Destination $sbomStaged
        Copy-Item -LiteralPath (Join-Path $payload "RELEASE.json") -Destination $receiptStaged

        if ($rid -eq "win-x64") {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [IO.Compression.ZipFile]::CreateFromDirectory(
                $payload,
                $archivePath,
                [IO.Compression.CompressionLevel]::Optimal,
                $false)
        }
        else {
            New-LinuxReleaseArchive -Payload $payload -ArchivePath $archivePath -Rid $rid
        }
        Assert-SafeArchiveEntries -ArchivePath $archivePath -Rid $rid
        $releaseFiles.Add([pscustomobject]@{ Staged = $archivePath; Final = $archiveOutput })
        $releaseFiles.Add([pscustomobject]@{ Staged = $sbomStaged; Final = $sbomOutput })
        $releaseFiles.Add([pscustomobject]@{ Staged = $receiptStaged; Final = $receiptOutput })
    }

    $hashName = "SHA256SUMS-$PackageName-$Version.txt"
    $hashOutput = Join-Path $OutputDirectory $hashName
    $hashStaged = Join-Path $staging $hashName
    if (Test-Path -LiteralPath $hashOutput) {
        throw "Refusing to overwrite existing release hash manifest: $hashOutput"
    }
    $hashLines = foreach ($file in $releaseFiles | Sort-Object { Split-Path $_.Final -Leaf }) {
        "$(Get-Sha256 -Path $file.Staged)  $(Split-Path $file.Final -Leaf)"
    }
    $hashLines | Set-Content -LiteralPath $hashStaged -Encoding ASCII
    $releaseFiles.Add([pscustomobject]@{ Staged = $hashStaged; Final = $hashOutput })

    foreach ($file in $releaseFiles) {
        if (Test-Path -LiteralPath $file.Final) {
            throw "Refusing to overwrite release artifact during promotion: $($file.Final)"
        }
    }
    foreach ($file in $releaseFiles) {
        $incoming = Join-Path $OutputDirectory (".incoming-{0}-{1}" -f [guid]::NewGuid().ToString("N"), (Split-Path $file.Final -Leaf))
        Copy-Item -LiteralPath $file.Staged -Destination $incoming
        Move-Item -LiteralPath $incoming -Destination $file.Final
    }
    Write-Host "Seed-host self-contained releases $Version written to $OutputDirectory"
}
finally {
    if ((Test-Path -LiteralPath $stagingResolved -PathType Container) -and
        $stagingResolved.StartsWith($OutputDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $stagingResolved -Recurse -Force
    }
}
