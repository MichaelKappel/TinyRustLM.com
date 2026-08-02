param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",
    [string]$PackageOutput = "E:\Source\WP\UAIX-Publish\DOTNET-NUGET",
    [string]$DependencyFeed = "",
    [switch]$SkipNativeBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LibraryProject = Join-Path $RepoRoot "dotnet/src/TinyRustLM.SeedHost/TinyRustLM.SeedHost.csproj"
$ToolProject = Join-Path $RepoRoot "dotnet/tools/TinyRustLM.SeedHost.Tool/TinyRustLM.SeedHost.Tool.csproj"
$LibraryId = "UAIX.Browser.p2pRuntime.SeedHost"
$ToolId = "UAIX.Browser.p2pRuntime.SeedHost.Tool"
$DependencyVersion = "0.1.8"
[xml]$LibraryXml = Get-Content -LiteralPath $LibraryProject
$Version = [string]$LibraryXml.Project.PropertyGroup.VersionPrefix
if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Seed-host VersionPrefix is missing from $LibraryProject"
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

function Move-ToArchive {
    param(
        [System.IO.FileInfo]$File,
        [string]$Archive,
        [string]$NamePrefix = ""
    )

    $sourcePath = [IO.Path]::GetFullPath($File.FullName)
    $sourceHash = Get-Sha256 -Path $sourcePath
    $archivePrefix = $Archive.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $baseName = if ([string]::IsNullOrWhiteSpace($NamePrefix)) {
        $File.Name
    }
    else {
        "$NamePrefix-$($File.Name)"
    }
    $destination = Join-Path $Archive $baseName
    if (Test-Path -LiteralPath $destination) {
        $stamp = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmssfffffff")
        $destination = Join-Path $Archive ("{0}.{1}-{2}{3}" -f $File.BaseName, $stamp, [guid]::NewGuid().ToString("N"), $File.Extension)
    }
    $destination = [IO.Path]::GetFullPath($destination)
    if (-not $destination.StartsWith($archivePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Archive destination escaped the configured archive: $destination"
    }

    Move-Item -LiteralPath $sourcePath -Destination $destination
    if (Test-Path -LiteralPath $sourcePath) {
        throw "Archived source still exists after move: $sourcePath"
    }
    if ((Get-Sha256 -Path $destination) -ne $sourceHash) {
        throw "Archived file hash changed during move: $destination"
    }
    return $destination
}

function Invoke-SeedHostPackageVerifier {
    param(
        [string]$Directory,
        [string]$ReportPath,
        [switch]$PublishedFeed
    )

    $arguments = @{
        PackageDirectory = $Directory
        Version = $Version
        DependencyFeed = $DependencyFeed
        ReportPath = $ReportPath
    }
    if ($PublishedFeed) {
        $arguments.PublishedFeed = $true
    }
    & (Join-Path $PSScriptRoot "verify-seed-host-packages.ps1") @arguments
}

New-Item -ItemType Directory -Force -Path $PackageOutput | Out-Null
$PackageOutput = (Resolve-Path -LiteralPath $PackageOutput).Path
if ([string]::IsNullOrWhiteSpace($DependencyFeed)) {
    $DependencyFeed = $PackageOutput
}
$DependencyFeed = (Resolve-Path -LiteralPath $DependencyFeed).Path
foreach ($name in @(
    "UAIX.Browser.Core.Abstractions.$DependencyVersion.nupkg",
    "UAIX.Browser.p2pRuntime.P2P.$DependencyVersion.nupkg"
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $DependencyFeed $name) -PathType Leaf)) {
        throw "Required seed-host package dependency is missing from the local feed: $name"
    }
}

if (-not $SkipNativeBuild) {
    & (Join-Path $PSScriptRoot "build-seed-host-native.ps1") -Configuration release
}

$architecture = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($architecture -notin @("x64", "arm64")) {
    throw "Unsupported seed-host package build architecture: $architecture"
}
if ([Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Windows)) {
    $hostRid = "win-$architecture"
    $nativeLibraryName = "minimodel_native.dll"
    $nativeExecutableName = "minimodel.exe"
}
elseif ([Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Linux)) {
    $hostRid = "linux-$architecture"
    $nativeLibraryName = "libminimodel_native.so"
    $nativeExecutableName = "minimodel"
}
else {
    throw "Seed-host package publishing is supported on Windows and Linux."
}
$hostNativeRoot = Join-Path $RepoRoot "artifacts/seed-host-native/$hostRid"
$hostNativeLibrary = Join-Path $hostNativeRoot $nativeLibraryName
$hostNativeExecutable = Join-Path $hostNativeRoot $nativeExecutableName
foreach ($path in @($hostNativeLibrary, $hostNativeExecutable, (Join-Path $hostNativeRoot "SHA256SUMS.txt"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required staged native evidence is missing: $path"
    }
}

$staging = Join-Path $RepoRoot "artifacts/packages/seed-host-$Version-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$escapedDependencyFeed = [Security.SecurityElement]::Escape($DependencyFeed)
$nugetConfig = Join-Path $staging "NuGet.Config"
$nugetConfigText = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="uaix-local" value="$escapedDependencyFeed" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="uaix-local"><package pattern="UAIX.*" /></packageSource>
    <packageSource key="nuget.org"><package pattern="*" /></packageSource>
  </packageSourceMapping>
</configuration>
"@
[IO.File]::WriteAllText($nugetConfig, $nugetConfigText, (New-Object Text.UTF8Encoding($false)))

$packageProperties = @(
    "/p:TinyRustLmAbstractionsPackageId=UAIX.Browser.Core.Abstractions",
    "/p:TinyRustLmP2PPackageId=UAIX.Browser.p2pRuntime.P2P",
    "/p:SeedHostDependencyVersion=$DependencyVersion",
    "/p:SeedHostUsePackagedDependencies=true"
)
$oldNativePath = $env:MINIMODEL_NATIVE_PATH
$oldCliPath = $env:MINIMODEL_CLI_PATH
try {
    $env:MINIMODEL_NATIVE_PATH = $hostNativeLibrary
    $env:MINIMODEL_CLI_PATH = $hostNativeExecutable
    Invoke-DotNet -Arguments (@("restore", "dotnet/TinyRustLM.sln", "--configfile", $nugetConfig) + $packageProperties)
    Invoke-DotNet -Arguments (@("build", "dotnet/TinyRustLM.sln", "-c", $Configuration, "--no-restore") + $packageProperties)
    Invoke-DotNet -Arguments (@(
        "test",
        "dotnet/tests/TinyRustLM.SeedHost.Tests/TinyRustLM.SeedHost.Tests.csproj",
        "-c",
        $Configuration,
        "--no-build",
        "--no-restore"
    ) + $packageProperties)
    Invoke-DotNet -Arguments (@("pack", $LibraryProject, "-c", $Configuration, "--no-build", "--no-restore", "-o", $staging) + $packageProperties)
    Invoke-DotNet -Arguments (@("pack", $ToolProject, "-c", $Configuration, "--no-build", "--no-restore", "-o", $staging) + $packageProperties)
}
finally {
    $env:MINIMODEL_NATIVE_PATH = $oldNativePath
    $env:MINIMODEL_CLI_PATH = $oldCliPath
}

$expected = @(
    "$LibraryId.$Version.nupkg",
    "$LibraryId.$Version.snupkg",
    "$ToolId.$Version.nupkg",
    "$ToolId.$Version.snupkg"
)
foreach ($name in $expected) {
    if (-not (Test-Path -LiteralPath (Join-Path $staging $name) -PathType Leaf)) {
        throw "Expected seed-host package is missing: $name"
    }
}
$unexpected = @(Get-ChildItem -LiteralPath $staging -File |
    Where-Object { $_.Extension -in ".nupkg", ".snupkg" -and $expected -notcontains $_.Name })
if ($unexpected.Count -ne 0) {
    throw "Unexpected package files were produced: $($unexpected.Name -join ', ')"
}

$verificationStamp = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmssfffffff")
$prePublishReport = Join-Path $RepoRoot "artifacts/reports/seed-host-package-prepublish-$Version-$verificationStamp.json"
Invoke-SeedHostPackageVerifier -Directory $staging -ReportPath $prePublishReport

$hashName = "SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost-$Version.txt"
$hashLines = foreach ($name in $expected | Sort-Object) {
    "$(Get-Sha256 -Path (Join-Path $staging $name))  $name"
}
$hashLines | Set-Content -LiteralPath (Join-Path $staging $hashName) -Encoding ASCII
$readmeName = "README-UAIX.Browser.p2pRuntime.SeedHost-$Version.txt"
@(
    "UAIX Browser p2pRuntime Seed Host local NuGet release",
    "",
    "Version: $Version",
    "Library: $LibraryId",
    "Tool: $ToolId (command: uaix-p2p-seed)",
    "Target framework: net8.0",
    "Native RIDs packaged when verified: win-x64, linux-x64, linux-arm64",
    "Dependencies: UAIX.Browser.Core.Abstractions $DependencyVersion; UAIX.Browser.p2pRuntime.P2P $DependencyVersion",
    "",
    "Install library:",
    "  dotnet add package $LibraryId --version $Version --source `"$PackageOutput`"",
    "Install tool:",
    "  dotnet tool install $ToolId --version $Version --add-source `"$PackageOutput`"",
    "",
    "Security boundary: model bytes are served only by user-run seed hosts. TinyRustLM.com, MiniModel.org, UAIX.org, and MemoryEndpoints.com do not host, run, or proxy these model bytes.",
    "Announcements require a current matching outside-network reachability receipt.",
    "Hashes: $hashName",
    "Generated UTC: $([DateTimeOffset]::UtcNow.ToString('O'))"
) | Set-Content -LiteralPath (Join-Path $staging $readmeName) -Encoding ASCII

$publishNames = @($expected + $hashName + $readmeName)
foreach ($name in $publishNames) {
    if (Test-Path -LiteralPath (Join-Path $PackageOutput $name)) {
        throw "Refusing to overwrite existing package release file: $name"
    }
}
$Archive = Join-Path $PackageOutput "Archive"
New-Item -ItemType Directory -Force -Path $Archive | Out-Null
$Archive = (Resolve-Path -LiteralPath $Archive).Path
if (-not $Archive.StartsWith($PackageOutput + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Archive must remain inside the local package feed."
}
$incoming = Join-Path $PackageOutput (".incoming-seed-host-{0}-{1}" -f $Version, [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $incoming | Out-Null
foreach ($name in $publishNames) {
    $source = Join-Path $staging $name
    $destination = Join-Path $incoming $name
    Copy-Item -LiteralPath $source -Destination $destination
    if ((Get-Sha256 -Path $source) -ne (Get-Sha256 -Path $destination)) {
        throw "Incoming feed copy failed hash verification: $name"
    }
}

$promoted = New-Object System.Collections.Generic.List[string]
try {
    foreach ($name in $publishNames) {
        $destination = Join-Path $PackageOutput $name
        Move-Item -LiteralPath (Join-Path $incoming $name) -Destination $destination
        [void]$promoted.Add($destination)
    }
    $postPublishReport = Join-Path $RepoRoot "artifacts/reports/seed-host-package-published-$Version-$verificationStamp.json"
    Invoke-SeedHostPackageVerifier -Directory $PackageOutput -ReportPath $postPublishReport -PublishedFeed
}
catch {
    foreach ($path in $promoted.ToArray()) {
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            Move-ToArchive -File (Get-Item -LiteralPath $path) -Archive $Archive -NamePrefix "failed-promotion-$Version" | Out-Null
        }
    }
    throw
}

$olderPackages = @(Get-ChildItem -LiteralPath $PackageOutput -File | Where-Object {
    ($_.Extension -in ".nupkg", ".snupkg") -and
    $expected -notcontains $_.Name -and
    ($_.Name.StartsWith($LibraryId + ".", [StringComparison]::OrdinalIgnoreCase) -or
        $_.Name.StartsWith($ToolId + ".", [StringComparison]::OrdinalIgnoreCase))
})
$olderMetadata = @(Get-ChildItem -LiteralPath $PackageOutput -File | Where-Object {
    $_.Name -ne $hashName -and $_.Name -ne $readmeName -and
    ($_.Name -like "SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost-*" -or
        $_.Name -like "README-UAIX.Browser.p2pRuntime.SeedHost-*")
})
foreach ($file in @($olderPackages + $olderMetadata)) {
    Move-ToArchive -File $file -Archive $Archive | Out-Null
}

foreach ($name in $publishNames) {
    $published = Join-Path $PackageOutput $name
    if ((Get-Sha256 -Path $published) -ne (Get-Sha256 -Path (Join-Path $staging $name))) {
        throw "Published feed file differs from the verified staging file: $name"
    }
}
if (@(Get-ChildItem -LiteralPath $incoming -Force).Count -eq 0) {
    Remove-Item -LiteralPath $incoming -Force
}

Write-Host "Seed-host packages $Version verified and written to $PackageOutput"
Write-Host "Pre-publish audit: $prePublishReport"
Write-Host "Published-feed audit: $postPublishReport"
