param(
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release"
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

function Invoke-Cargo {
    param(
        [string[]]$Arguments
    )

    & cargo @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "cargo $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

$ProfileArg = if ($Configuration -eq "release") { "--release" } else { "" }
$TargetDir = Resolve-CargoTargetDirectory
$Rid = if ($IsLinux) { "linux-x64" } elseif ($IsMacOS) { "osx-x64" } else { "win-x64" }
$NativeName = if ($IsLinux) { "libtinyrustlm_native.so" } elseif ($IsMacOS) { "libtinyrustlm_native.dylib" } else { "tinyrustlm_native.dll" }
$ProfileDir = if ($Configuration -eq "release") { "release" } else { "debug" }
$OutputDir = Join-Path $RepoRoot "artifacts/native/$Rid"

Push-Location $RepoRoot
try {
    if ($ProfileArg) {
        Invoke-Cargo -Arguments @("build", "-p", "tinyrustlm-native", "--release")
    } else {
        Invoke-Cargo -Arguments @("build", "-p", "tinyrustlm-native")
    }
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $NativeSource = Join-Path (Join-Path $TargetDir $ProfileDir) $NativeName
    if (-not (Test-Path -LiteralPath $NativeSource -PathType Leaf)) {
        throw "TinyRustLM native build output is missing"
    }
    Copy-Item -LiteralPath $NativeSource -Destination (Join-Path $OutputDir $NativeName) -Force
    Write-Host "TinyRustLM native library copied to $OutputDir"
}
finally {
    Pop-Location
}
