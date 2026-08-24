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
$PackageIds = @("TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P")
if ($IncludeOptionalMemoryEndpoints) {
    $PackageIds += "TinyRustLM.MemoryEndpoints"
}
if ($IncludePrivateConversion) {
    $PackageIds += "TinyRustLM.Conversion"
}

function Invoke-DotNet {
    param([string[]]$Arguments)
    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-HostRid {
    $architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    $isWindows = [Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Windows)
    $isLinux = [Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Linux)
    if ($isWindows -and $architecture -eq [Runtime.InteropServices.Architecture]::X64) { return "win-x64" }
    if ($isLinux -and $architecture -eq [Runtime.InteropServices.Architecture]::X64) { return "linux-x64" }
    if ($isLinux -and $architecture -eq [Runtime.InteropServices.Architecture]::Arm64) { return "linux-arm64" }
    throw "This host is not one of the supported TinyRustLM package RIDs"
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

if ([string]::IsNullOrWhiteSpace($PackageOutput)) {
    $PackageOutput = Join-Path $RepoRoot "artifacts/packages"
}
$PackageOutput = [IO.Path]::GetFullPath($PackageOutput)
$outputRoot = [IO.Path]::GetPathRoot($PackageOutput)
if ($PackageOutput.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) -eq
    $outputRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)) {
    throw "PackageOutput must not be a filesystem root"
}
if (Test-Path -LiteralPath $PackageOutput) {
    if (-not (Test-Path -LiteralPath $PackageOutput -PathType Container)) {
        throw "PackageOutput exists and is not a directory: $PackageOutput"
    }
    if (Get-ChildItem -LiteralPath $PackageOutput -Force | Select-Object -First 1) {
        throw "PackageOutput must be empty so current and prior package bytes cannot be mixed: $PackageOutput"
    }
}
else {
    New-Item -ItemType Directory -Path $PackageOutput | Out-Null
}
$PackageOutput = (Resolve-Path -LiteralPath $PackageOutput).Path

if (-not $RequiredNativeRids -or $RequiredNativeRids.Count -eq 0) {
    $RequiredNativeRids = @(Get-HostRid)
}
$supportedRids = @("win-x64", "linux-x64", "linux-arm64")
foreach ($rid in $RequiredNativeRids) {
    if ($supportedRids -notcontains $rid) {
        throw "Unsupported required native RID: $rid"
    }
}

$packageProperties = @()
if ($IncludeOptionalMemoryEndpoints) {
    $packageProperties += "/p:TinyRustLmPackOptionalMemoryEndpoints=true"
}
if ($IncludePrivateConversion) {
    $packageProperties += "/p:TinyRustLmPackPrivateConversion=true"
}
$projects = @(
    "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj",
    "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj",
    "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj",
    "dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj",
    "dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj",
    "dotnet/samples/TinyRustLM.ConsoleSample/TinyRustLM.ConsoleSample.csproj",
    "dotnet/samples/TinyRustLM.P2PShareSample/TinyRustLM.P2PShareSample.csproj"
)
if ($IncludeOptionalMemoryEndpoints) {
    $projects += "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj"
}
if ($IncludePrivateConversion) {
    $projects += "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj"
}

Push-Location $RepoRoot
try {
    & (Join-Path $PSScriptRoot "build-native.ps1") -Configuration release
    if ($IncludePrivateConversion) {
        & (Join-Path $PSScriptRoot "build-converter.ps1") -Configuration release
    }

    foreach ($project in $projects | Select-Object -Unique) {
        Invoke-DotNet -Arguments (@("restore", $project, "--nologo") + $packageProperties)
        Invoke-DotNet -Arguments (@("build", $project, "-c", $Configuration, "--no-restore", "--nologo") + $packageProperties)
    }
    Invoke-DotNet -Arguments (@("test", "dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj", "-c", $Configuration, "--no-build", "--nologo") + $packageProperties)
    Invoke-DotNet -Arguments (@("test", "dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj", "-c", $Configuration, "--no-build", "--nologo") + $packageProperties)

    foreach ($packageId in $PackageIds) {
        $project = "dotnet/src/$packageId/$packageId.csproj"
        Invoke-DotNet -Arguments (@("pack", $project, "-c", $Configuration, "--no-build", "--nologo", "-o", $PackageOutput) + $packageProperties)
    }

    $packageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
    if ([string]::IsNullOrWhiteSpace($packageVersion)) {
        throw "Package version could not be resolved"
    }
    $packagePaths = @()
    foreach ($packageId in $PackageIds) {
        foreach ($extension in @("nupkg", "snupkg")) {
            $path = Join-Path $PackageOutput "$packageId.$packageVersion.$extension"
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
                throw "Expected package is missing before canonicalization: $path"
            }
            $packagePaths += $path
        }
    }
    Invoke-DotNet -Arguments (@(
        "run", "--project", "dotnet/tools/TinyRustLM.PackageCanonicalizer/TinyRustLM.PackageCanonicalizer.csproj",
        "-c", $Configuration, "--no-build", "--no-restore", "--", "canonicalize"
    ) + $packagePaths)

    $auditPath = Join-Path $PackageOutput "tinyrustlm-nuget-package-audit.json"
    & (Join-Path $PSScriptRoot "write-package-audit.ps1") `
        -PackageSource $PackageOutput `
        -ReportOutput $auditPath `
        -RequiredNativeRids $RequiredNativeRids

    & (Join-Path $PSScriptRoot "verify-consumer.ps1") `
        -PackageSource $PackageOutput `
        -PackageVersion $packageVersion

    $manifestPath = Join-Path $PackageOutput "SHA256SUMS-TinyRustLM-$packageVersion.txt"
    $hashLines = foreach ($path in $packagePaths | Sort-Object) {
        "$(Get-Sha256 -Path $path)  $([IO.Path]::GetFileName($path))"
    }
    $hashLines | Set-Content -LiteralPath $manifestPath -Encoding ASCII

    $readmePath = Join-Path $PackageOutput "README-TinyRustLM-$packageVersion.txt"
    $lines = @(
        "TinyRustLM NuGet folder feed",
        "",
        "Package version: $packageVersion",
        "Audit: $([IO.Path]::GetFileName($auditPath))",
        "Manifest: $([IO.Path]::GetFileName($manifestPath))",
        "",
        "Primary packages (.nupkg and matching .snupkg):"
    ) + ($PackageIds | ForEach-Object { "- $_" }) + @(
        "",
        "Generated UTC: $([DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ'))"
    )
    $lines | Set-Content -LiteralPath $readmePath -Encoding ASCII
    Write-Host "$($PackageIds -join ', ') packages passed audit and isolated consumer verification in $PackageOutput"
}
finally {
    Pop-Location
}
