param(
    [string]$PackageSource = "",
    [string]$PackageVersion = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Invoke-DotNet {
    param([string[]]$Arguments)

    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

if (-not $PackageSource) {
    $PackageSource = Join-Path $RepoRoot "artifacts/packages"
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if ([string]::IsNullOrWhiteSpace($PackageSource) -or [string]::IsNullOrWhiteSpace($PackageVersion)) {
    throw "Package source and exact package version are required."
}
$isFolderSource = Test-Path -LiteralPath $PackageSource -PathType Container
if (Test-Path -LiteralPath $PackageSource) {
    $PackageSource = (Resolve-Path -LiteralPath $PackageSource).Path
}
$includeMemoryEndpoints = $isFolderSource -and
    (Test-Path -LiteralPath (Join-Path $PackageSource "TinyRustLM.MemoryEndpoints.$PackageVersion.nupkg") -PathType Leaf)
$includeConversion = $isFolderSource -and
    (Test-Path -LiteralPath (Join-Path $PackageSource "TinyRustLM.Conversion.$PackageVersion.nupkg") -PathType Leaf)

$Slm2Vectors = (Resolve-Path -LiteralPath (Join-Path $RepoRoot "contracts/vnext/slm2-q8-weight-vectors.v1.json")).Path
$Acg2Vectors = (Resolve-Path -LiteralPath (Join-Path $RepoRoot "contracts/vnext/acg2-format-vectors.v1.json")).Path
$ProgramSource = (Resolve-Path -LiteralPath (Join-Path $RepoRoot "eng/consumer-smoke/Program.cs")).Path
$TempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
$TempRoot = Join-Path $TempBase ("tinyrustlm-consumer-" + [Guid]::NewGuid().ToString("N"))
$ProjectDir = Join-Path $TempRoot "ConsumerSmoke"
$WorkDir = Join-Path $TempRoot "work"
$MarkerPath = Join-Path $TempRoot ".tinyrustlm-owned-temp"
$OldNuGetPackages = $env:NUGET_PACKAGES
$OldNuGetHttpCachePath = $env:NUGET_HTTP_CACHE_PATH

New-Item -ItemType Directory -Path $ProjectDir | Out-Null
New-Item -ItemType Directory -Path $WorkDir | Out-Null
Set-Content -LiteralPath $MarkerPath -Value "tinyrustlm-consumer-owned-v1" -Encoding ASCII
$env:NUGET_PACKAGES = Join-Path $TempRoot "packages"
$env:NUGET_HTTP_CACHE_PATH = Join-Path $TempRoot "http-cache"

try {
    Invoke-DotNet -Arguments @("new", "console", "--framework", "net8.0", "--no-restore", "--output", $ProjectDir)
    Copy-Item -LiteralPath $ProgramSource -Destination (Join-Path $ProjectDir "Program.cs") -Force
    Push-Location $ProjectDir
    try {
        Invoke-DotNet -Arguments @("add", "package", "TinyRustLM.Abstractions", "--version", $PackageVersion, "--source", $PackageSource)
        Invoke-DotNet -Arguments @("add", "package", "TinyRustLM.Core", "--version", $PackageVersion, "--source", $PackageSource)
        Invoke-DotNet -Arguments @("add", "package", "TinyRustLM.P2P", "--version", $PackageVersion, "--source", $PackageSource)
        if ($includeMemoryEndpoints) {
            Invoke-DotNet -Arguments @("add", "package", "TinyRustLM.MemoryEndpoints", "--version", $PackageVersion, "--source", $PackageSource)
        }
        if ($includeConversion) {
            Invoke-DotNet -Arguments @("add", "package", "TinyRustLM.Conversion", "--version", $PackageVersion, "--source", $PackageSource)
        }
        Invoke-DotNet -Arguments @("build", "--no-restore", "--configuration", "Release")
        $memoryEndpointsFlag = if ($includeMemoryEndpoints) { "required" } else { "absent" }
        $conversionFlag = if ($includeConversion) { "required" } else { "absent" }
        Invoke-DotNet -Arguments @(
            "run", "--no-build", "--no-restore", "--configuration", "Release", "--",
            $Slm2Vectors, $Acg2Vectors, $WorkDir, $memoryEndpointsFlag, $conversionFlag)
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:NUGET_PACKAGES = $OldNuGetPackages
    $env:NUGET_HTTP_CACHE_PATH = $OldNuGetHttpCachePath
    $resolvedTempRoot = [System.IO.Path]::GetFullPath($TempRoot)
    $requiredPrefix = $TempBase + [System.IO.Path]::DirectorySeparatorChar + "tinyrustlm-consumer-"
    if ($resolvedTempRoot.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $MarkerPath -PathType Leaf)) {
        Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
    }
    elseif (Test-Path -LiteralPath $resolvedTempRoot) {
        Write-Warning "Refusing to remove an unowned consumer temporary directory: $resolvedTempRoot"
    }
}
