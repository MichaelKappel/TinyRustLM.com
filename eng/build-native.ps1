param(
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
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
$TargetDir = Join-Path $RepoRoot "target"
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
    Copy-Item -LiteralPath (Join-Path $TargetDir "$ProfileDir/$NativeName") -Destination (Join-Path $OutputDir $NativeName) -Force
    Write-Host "TinyRustLM native library copied to $OutputDir"
}
finally {
    Pop-Location
}
