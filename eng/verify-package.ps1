param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",
    [string]$PackageOutput = "",
    [string[]]$RequiredNativeRids = @(),
    [switch]$IncludeOptionalMemoryEndpoints,
    [switch]$IncludePrivateConversion
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$CanonicalRustPackages = @(
    "tinyrustlm-slm2",
    "tinyrustlm-composition2",
    "tinyrustlm-tokenizer2",
    "tinyrustlm-template2",
    "tinyrustlm-sampling2",
    "tinyrustlm-prompt2",
    "tinyrustlm-runtime",
    "tinyrustlm-p2p",
    "tinyrustlm-native",
    "tinyrustlm-convert"
)

function Invoke-Cargo {
    param([string[]]$Arguments)
    & cargo @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "cargo $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

if ([string]::IsNullOrWhiteSpace($PackageOutput)) {
    $PackageOutput = Join-Path $RepoRoot "artifacts/packages"
}

Push-Location $RepoRoot
try {
    Invoke-Cargo -Arguments @("fmt", "--all", "--check")
    $packageArguments = @()
    foreach ($package in $CanonicalRustPackages) {
        $packageArguments += @("-p", $package)
    }
    Invoke-Cargo -Arguments (@("clippy") + $packageArguments + @("--all-targets", "--", "-D", "warnings"))
    Invoke-Cargo -Arguments (@("test") + $packageArguments)

    $packArguments = @{
        Configuration = $Configuration
        PackageOutput = $PackageOutput
        RequiredNativeRids = $RequiredNativeRids
    }
    if ($IncludeOptionalMemoryEndpoints) {
        $packArguments.IncludeOptionalMemoryEndpoints = $true
    }
    if ($IncludePrivateConversion) {
        $packArguments.IncludePrivateConversion = $true
    }
    & (Join-Path $PSScriptRoot "pack.ps1") @packArguments
    Write-Host "TinyRustLM NuGet package verification passed: $PackageOutput"
}
finally {
    Pop-Location
}
