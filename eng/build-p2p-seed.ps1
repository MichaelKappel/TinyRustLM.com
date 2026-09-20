param(
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release",
    [ValidateSet("", "win-x64", "linux-x64", "linux-arm64")]
    [string]$Rid = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Resolve-CargoTargetDirectory {
    if (-not $env:CARGO_TARGET_DIR) {
        return [IO.Path]::GetFullPath((Join-Path $RepoRoot "target"))
    }
    $configured = $env:CARGO_TARGET_DIR
    $isWindowsAbsolute = $configured -match '^[A-Za-z]:[\\/]'
    $isUncAbsolute = $configured -match '^(?:\\\\|//)[^\\/]+[\\/][^\\/]+'
    $isPosixAbsolute = $configured.StartsWith("/", [StringComparison]::Ordinal)
    if (-not ($isWindowsAbsolute -or $isUncAbsolute -or $isPosixAbsolute)) {
        throw "CARGO_TARGET_DIR must be an absolute path"
    }
    $resolved = [IO.Path]::GetFullPath($configured)
    $root = [IO.Path]::GetPathRoot($resolved)
    if ($resolved.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) -eq
        $root.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)) {
        throw "CARGO_TARGET_DIR must not be a filesystem root"
    }
    return $resolved
}

function Get-HostRid {
    $architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    $isWindows = [Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Windows)
    $isLinux = [Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Linux)
    if ($isWindows -and $architecture -eq [Runtime.InteropServices.Architecture]::X64) { return "win-x64" }
    if ($isLinux -and $architecture -eq [Runtime.InteropServices.Architecture]::X64) { return "linux-x64" }
    if ($isLinux -and $architecture -eq [Runtime.InteropServices.Architecture]::Arm64) { return "linux-arm64" }
    throw "This host is not one of the supported TinyRustLM P2P seed RIDs"
}

if ([string]::IsNullOrWhiteSpace($Rid)) {
    $Rid = Get-HostRid
}
$targetTriple = switch ($Rid) {
    "win-x64" { "x86_64-pc-windows-msvc" }
    "linux-x64" { "x86_64-unknown-linux-gnu" }
    "linux-arm64" { "aarch64-unknown-linux-gnu" }
    default { throw "Unsupported P2P seed RID: $Rid" }
}
$binaryName = if ($Rid -eq "win-x64") { "tinyrustlm-p2p-seed.exe" } else { "tinyrustlm-p2p-seed" }
$profileDirectory = if ($Configuration -eq "release") { "release" } else { "debug" }
$targetDirectory = Resolve-CargoTargetDirectory
$outputDirectory = Join-Path $RepoRoot "artifacts/p2p-seed/$Rid"
$cargoArguments = @(
    "build",
    "-p",
    "tinyrustlm-p2p",
    "--bin",
    "tinyrustlm-p2p-seed",
    "--target",
    $targetTriple
)
if ($Configuration -eq "release") {
    $cargoArguments += "--release"
}

Push-Location $RepoRoot
try {
    & cargo @cargoArguments
    if ($LASTEXITCODE -ne 0) {
        throw "cargo $($cargoArguments -join ' ') failed with exit code $LASTEXITCODE"
    }
    $source = Join-Path $targetDirectory "$targetTriple/$profileDirectory/$binaryName"
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "TinyRustLM P2P seed build output is missing: $source"
    }
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $outputDirectory $binaryName) -Force
    Write-Host "TinyRustLM P2P seed copied to $outputDirectory"
}
finally {
    Pop-Location
}
