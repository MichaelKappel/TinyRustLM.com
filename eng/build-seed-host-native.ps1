param(
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release",
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
$manifest = Join-Path $MiniModelSourceRoot "Cargo.toml"
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    throw "MiniModel Cargo workspace was not found at $MiniModelSourceRoot"
}

$architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($architecture -eq "x64") { $architecture = "x64" }
elseif ($architecture -eq "arm64") { $architecture = "arm64" }
else { throw "Unsupported seed-host native architecture: $architecture" }

if ($IsLinux) {
    $rid = "linux-$architecture"
    $libraryName = "libminimodel_native.so"
    $executableName = "minimodel"
    $converterName = "tinyrustlm-slm-pack"
}
elseif ($IsMacOS) {
    $rid = "osx-$architecture"
    $libraryName = "libminimodel_native.dylib"
    $executableName = "minimodel"
    $converterName = "tinyrustlm-slm-pack"
}
else {
    $rid = "win-$architecture"
    $libraryName = "minimodel_native.dll"
    $executableName = "minimodel.exe"
    $converterName = "tinyrustlm-slm-pack.exe"
}

$cargoArguments = @("build", "--manifest-path", $manifest, "-p", "minimodel-native", "-p", "minimodel")
if ($Configuration -eq "release") {
    $cargoArguments += "--release"
}
$targetDirectory = Join-Path $MiniModelSourceRoot "target/seed-host/$rid"
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
$converterTargetDirectory = Join-Path $RepoRoot "target/seed-host-converter/$rid"
$converterArguments = @(
    "build",
    "--manifest-path", (Join-Path $RepoRoot "Cargo.toml"),
    "-p", "tinyrustlm-slm-pack"
)
if ($Configuration -eq "release") {
    $converterArguments += "--release"
}
$previousTargetDirectory = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = $converterTargetDirectory
    & cargo @converterArguments
    if ($LASTEXITCODE -ne 0) {
        throw "TinyRustLM converter release build failed with exit code $LASTEXITCODE"
    }
}
finally {
    $env:CARGO_TARGET_DIR = $previousTargetDirectory
}
$converterSource = Join-Path (Join-Path $converterTargetDirectory $profile) $converterName
$outputDirectory = Join-Path $RepoRoot "artifacts/seed-host-native/$rid"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
foreach ($name in @($libraryName, $executableName)) {
    $source = Join-Path $sourceDirectory $name
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Expected MiniModel build output is missing: $source"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $outputDirectory $name) -Force
}
if (-not (Test-Path -LiteralPath $converterSource -PathType Leaf)) {
    throw "Expected TinyRustLM converter output is missing: $converterSource"
}
Copy-Item -LiteralPath $converterSource -Destination (Join-Path $outputDirectory $converterName) -Force

$hashLines = foreach ($name in @($libraryName, $executableName, $converterName) | Sort-Object) {
    $path = Join-Path $outputDirectory $name
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $name"
}
$hashLines | Set-Content -LiteralPath (Join-Path $outputDirectory "SHA256SUMS.txt") -Encoding ASCII
Write-Host "MiniModel and TinyRustLM conversion assets written to $outputDirectory"
