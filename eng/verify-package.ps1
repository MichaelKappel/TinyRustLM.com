param(
    [string]$Configuration = "Release",
    [string[]]$RequiredNativeRids = @(),
    [switch]$IncludeOptionalMemoryEndpoints
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PackageOutput = Join-Path $RepoRoot "artifacts/packages"
$ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-package-audit.json"
$PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Invoke-Cargo {
    param(
        [string[]]$Arguments
    )

    & cargo @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "cargo $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Invoke-DotNet {
    param(
        [string[]]$Arguments
    )

    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Invoke-Node {
    param(
        [string[]]$Arguments
    )

    & node @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "node $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-CurrentRuntimeRid {
    if ($IsLinux) {
        return "linux-x64"
    }
    if ($IsMacOS) {
        return "osx-x64"
    }
    return "win-x64"
}

function Get-NativePackageEntry {
    param(
        [string]$Rid
    )

    switch -Regex ($Rid) {
        "^win-" { return "runtimes/$Rid/native/tinyrustlm_native.dll" }
        "^linux-" { return "runtimes/$Rid/native/libtinyrustlm_native.so" }
        "^osx-" { return "runtimes/$Rid/native/libtinyrustlm_native.dylib" }
        default { throw "Unsupported native RID: $Rid" }
    }
}

if (-not $RequiredNativeRids -or $RequiredNativeRids.Count -eq 0) {
    $RequiredNativeRids = @(Get-CurrentRuntimeRid)
}

Push-Location $RepoRoot
try {
    Invoke-Cargo -Arguments @("fmt", "--all", "--check")
    Invoke-Cargo -Arguments @("clippy", "--workspace", "--all-targets", "--", "-D", "warnings")
    Invoke-Cargo -Arguments @("test", "-p", "tinyrustlm-slm", "-p", "tinyrustlm-runtime-sdk", "-p", "tinyrustlm-p2p", "-p", "tinyrustlm-native", "-p", "tinyrustlm-memory-endpoints")
    Invoke-Node -Arguments @(
        "--test",
        "tinyrustlm/tests/active-conversation.test.js",
        "tinyrustlm/tests/calculator-tool.test.js",
        "tinyrustlm/tests/companion-bridge.test.js",
        "tinyrustlm/tests/minimodel-announcement.test.js",
        "tinyrustlm/tests/memory-endpoints-sync.test.js",
        "tinyrustlm/tests/memory-endpoints-distributed-sync-authority.test.js"
    )
    $packArguments = @{
        Configuration = $Configuration
        PackageOutput = $PackageOutput
        ArchiveOtherPackages = $true
    }
    if ($IncludeOptionalMemoryEndpoints) {
        $packArguments.IncludeOptionalMemoryEndpoints = $true
    }
    & (Join-Path $PSScriptRoot "pack.ps1") @packArguments

    $packages = Get-ChildItem -Path $PackageOutput -Filter "TinyRustLM*.nupkg"
    if (-not $packages) {
        throw "No TinyRustLM packages were produced."
    }
    foreach ($package in $packages) {
        $entries = [System.IO.Compression.ZipFile]::OpenRead($package.FullName)
        try {
            $names = $entries.Entries | ForEach-Object { $_.FullName }
            if ($package.Name -like "TinyRustLM.Core*") {
                foreach ($rid in $RequiredNativeRids) {
                    $requiredEntry = Get-NativePackageEntry -Rid $rid
                    if (-not ($names -contains $requiredEntry)) {
                        throw "TinyRustLM.Core package is missing native asset: $requiredEntry"
                    }
                }
            }
            if ($names | Where-Object { $_ -match "slm_pack|selector|adapter_family|trained_source|breeding" }) {
                throw "Package $($package.Name) contains private authoring surface."
            }
        }
        finally {
            $entries.Dispose()
        }
    }
    & (Join-Path $PSScriptRoot "write-package-audit.ps1") -PackageSource $PackageOutput -ReportOutput $ReportOutput -RequiredNativeRids $RequiredNativeRids

    $env:TINYRUSTLM_REPO_ROOT = $RepoRoot
    $env:TINYRUSTLM_PACKAGE_DIR = $PackageOutput
    $env:TINYRUSTLM_PACKAGE_AUDIT_REPORT = $ReportOutput
    Invoke-DotNet -Arguments @("test", "dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj", "-c", $Configuration, "--no-build")
    & (Join-Path $PSScriptRoot "verify-consumer.ps1") -PackageSource $PackageOutput -PackageVersion $PackageVersion
    Write-Host "TinyRustLM NuGet package verification passed."
}
finally {
    Pop-Location
}
