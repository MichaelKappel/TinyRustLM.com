param(
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release",
    [string]$MiniModelRoot = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($MiniModelRoot)) {
    $MiniModelRoot = Join-Path (Split-Path $RepoRoot -Parent) "MiniModel.org"
}
$MiniModelRoot = (Resolve-Path -LiteralPath $MiniModelRoot).Path
$manifest = Join-Path $MiniModelRoot "Cargo.toml"
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    throw "MiniModel Cargo workspace was not found at $MiniModelRoot"
}

$architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($architecture -eq "x64") { $architecture = "x64" }
elseif ($architecture -eq "arm64") { $architecture = "arm64" }
else { throw "Unsupported seed-host native architecture: $architecture" }

if ($IsLinux) {
    $rid = "linux-$architecture"
    $libraryName = "libminimodel_native.so"
    $executableName = "minimodel"
}
elseif ($IsMacOS) {
    $rid = "osx-$architecture"
    $libraryName = "libminimodel_native.dylib"
    $executableName = "minimodel"
}
else {
    $rid = "win-$architecture"
    $libraryName = "minimodel_native.dll"
    $executableName = "minimodel.exe"
}

$cargoArguments = @("build", "--manifest-path", $manifest, "-p", "minimodel-native", "-p", "minimodel")
if ($Configuration -eq "release") {
    $cargoArguments += "--release"
}
$targetDirectory = Join-Path $MiniModelRoot "target/seed-host/$rid"
$previousTargetDirectory = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = $targetDirectory
    & cargo @cargoArguments
    if ($LASTEXITCODE -ne 0) {
        throw "MiniModel native release build failed with exit code $LASTEXITCODE"
    }
}
finally {
    $env:CARGO_TARGET_DIR = $previousTargetDirectory
}

$profile = if ($Configuration -eq "release") { "release" } else { "debug" }
$sourceDirectory = Join-Path $targetDirectory $profile
$outputDirectory = Join-Path $RepoRoot "artifacts/seed-host-native/$rid"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
foreach ($name in @($libraryName, $executableName)) {
    $source = Join-Path $sourceDirectory $name
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Expected MiniModel build output is missing: $source"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $outputDirectory $name) -Force
}

$hashLines = foreach ($name in @($libraryName, $executableName) | Sort-Object) {
    $path = Join-Path $outputDirectory $name
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $name"
}
$hashLines | Set-Content -LiteralPath (Join-Path $outputDirectory "SHA256SUMS.txt") -Encoding ASCII
Write-Host "MiniModel seed-host native assets written to $outputDirectory"
