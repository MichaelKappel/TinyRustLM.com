param(
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release",
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$isWindowsHost = $env:OS -eq "Windows_NT" -or
    (Get-Variable -Name IsWindows -ValueOnly -ErrorAction SilentlyContinue) -eq $true
$isLinuxHost = (Get-Variable -Name IsLinux -ValueOnly -ErrorAction SilentlyContinue) -eq $true

function Test-FullyQualifiedOutputPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if ($isWindowsHost) {
        return $Path -match '^[A-Za-z]:[\\/]' -or
            $Path -match '^(?:\\\\|//)[^\\/]+[\\/][^\\/]+'
    }
    if ($isLinuxHost) {
        return $Path.StartsWith("/", [StringComparison]::Ordinal)
    }
    return $false
}

$architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($architecture -eq "x64") { $architecture = "x64" }
elseif ($architecture -eq "arm64") { $architecture = "arm64" }
else { throw "Unsupported archive scan helper architecture: $architecture" }

if ($isLinuxHost) { $rid = "linux-$architecture" }
elseif ($isWindowsHost) { $rid = "win-$architecture" }
else { throw "Archive scan release helpers support Windows and Linux only" }
if ($rid -notin @("win-x64", "linux-x64", "linux-arm64")) {
    throw "Unsupported archive scan helper RID: $rid"
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $RepoRoot "artifacts/archive-scan-helper/$rid"
}
elseif (-not (Test-FullyQualifiedOutputPath -Path $OutputDirectory)) {
    throw "Archive scan helper output must be an absolute path"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) {
    throw "Archive scan helper output already exists: $OutputDirectory"
}

$targetDirectory = if ($env:CARGO_TARGET_DIR) {
    [IO.Path]::GetFullPath($env:CARGO_TARGET_DIR)
}
else {
    Join-Path $RepoRoot "target/archive-scan-helper/$rid"
}
$cargoArguments = @(
    "build",
    "--manifest-path", (Join-Path $RepoRoot "Cargo.toml"),
    "-p", "tinyrustlm-archive",
    "--bin", "tinyrustlm-archive-scan",
    "--locked"
)
if ($Configuration -eq "release") { $cargoArguments += "--release" }
$previousTargetDirectory = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = $targetDirectory
    & cargo @cargoArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Archive scan helper Cargo build failed with exit code $LASTEXITCODE"
    }
}
finally {
    $env:CARGO_TARGET_DIR = $previousTargetDirectory
}

$executableName = if ($rid -eq "win-x64") {
    "tinyrustlm-archive-scan.exe"
}
else {
    "tinyrustlm-archive-scan"
}
$executablePath = Join-Path (Join-Path $targetDirectory $Configuration) $executableName
if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "Archive scan helper build output is missing: $executablePath"
}
$trustClass = if ($Configuration -eq "release") { "release-package" } else { "local-test-build" }
& node (Join-Path $RepoRoot "tinyrustlm/tools/archive-scan-helper-package.js") `
    $executablePath $OutputDirectory $Configuration $trustClass
if ($LASTEXITCODE -ne 0) {
    throw "Archive scan helper package materialization failed with exit code $LASTEXITCODE"
}
Write-Host "Archive scan helper package written for $rid"
