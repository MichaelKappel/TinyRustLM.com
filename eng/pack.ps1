param(
    [string]$Configuration = "Release",
    [string]$PackageOutput = "",
    [string]$PackageIdPrefix = "TinyRustLM",
    [string]$AbstractionsPackageId = "",
    [string]$CorePackageId = "",
    [string]$P2PPackageId = "",
    [string]$MemoryEndpointsPackageId = "",
    [string]$ConversionPackageId = "",
    [switch]$IncludeOptionalMemoryEndpoints,
    [switch]$IncludePrivateConversion,
    [switch]$ArchiveOtherPackages
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
function Invoke-DotNet {
    param(
        [string[]]$Arguments
    )

    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
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

function Assert-PackageId {
    param(
        [string]$Value,
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch "^[A-Za-z0-9][A-Za-z0-9_.-]*(\.[A-Za-z0-9][A-Za-z0-9_.-]*)*$") {
        throw "$Name must be a NuGet-compatible package ID such as TinyRustLM.Core or UAIX.Browser.p2pLLM.Runtime."
    }
}

function Write-PackageHashManifest {
    param(
        [string]$OutputPath,
        [string]$ManifestPrefix,
        [string[]]$PackageIds
    )

    $packageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
    if ([string]::IsNullOrWhiteSpace($packageVersion)) {
        throw "Package version could not be resolved from dotnet/Directory.Build.props."
    }

    Get-ChildItem -LiteralPath $OutputPath -Filter "SHA256SUMS-$ManifestPrefix-*.txt" -File |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

    $expectedPackageNames = @()
    foreach ($packageId in $PackageIds) {
        $expectedPackageNames += "$packageId.$packageVersion.nupkg"
        $expectedPackageNames += "$packageId.$packageVersion.snupkg"
    }
    $packageFiles = @(Get-ChildItem -LiteralPath $OutputPath -File |
        Where-Object { $expectedPackageNames -contains $_.Name } |
        Sort-Object Name)

    if ($packageFiles.Count -ne $expectedPackageNames.Count) {
        $actualPackageNames = @($packageFiles | ForEach-Object { $_.Name })
        $missingPackageNames = @($expectedPackageNames | Where-Object { $actualPackageNames -notcontains $_ })
        throw "Cannot write SHA-256 manifest; missing expected packages: $($missingPackageNames -join ', ')"
    }

    $hashLines = @()
    foreach ($packageFile in $packageFiles) {
        $hash = (Get-FileHash -LiteralPath $packageFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $hashLines += "$hash  $($packageFile.Name)"
    }

    $manifestPath = Join-Path $OutputPath "SHA256SUMS-$ManifestPrefix-$packageVersion.txt"
    $hashLines | Set-Content -LiteralPath $manifestPath -Encoding ASCII
    Write-Host "SHA-256 manifest written to $manifestPath"
}

function Write-PackageFeedReadme {
    param(
        [string]$OutputPath,
        [string]$ManifestPrefix,
        [string[]]$PackageIds
    )

    $packageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
    if ([string]::IsNullOrWhiteSpace($packageVersion)) {
        throw "Package version could not be resolved from dotnet/Directory.Build.props."
    }

    Get-ChildItem -LiteralPath $OutputPath -Filter "README-$ManifestPrefix-*.txt" -File |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

    $readmePath = Join-Path $OutputPath "README-$ManifestPrefix-$packageVersion.txt"
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("$ManifestPrefix NuGet folder feed")
    $lines.Add("")
    $lines.Add("Package version: $packageVersion")
    $lines.Add("Primary packages (.nupkg):")
    foreach ($packageId in $PackageIds) {
        $lines.Add("- $packageId.$packageVersion.nupkg")
    }
    $lines.Add("")
    $lines.Add("Symbol sidecars (.snupkg):")
    foreach ($packageId in $PackageIds) {
        $lines.Add("- $packageId.$packageVersion.snupkg")
    }
    $lines.Add("")
    $lines.Add("NuGet Package Manager generally lists installable .nupkg packages. Each .snupkg is a debug-symbol sidecar for the matching installable package.")
    $lines.Add("Verify this feed with SHA256SUMS-$ManifestPrefix-$packageVersion.txt, the feed audit report, SymbolsPackage/PDB evidence, publish-plan hashes, and feed-hash reports.")
    $lines.Add("")
    $lines.Add("Generated UTC: $([DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ'))")
    $lines | Set-Content -LiteralPath $readmePath -Encoding ASCII
    Write-Host "Feed README written to $readmePath"
}

if (-not $PackageOutput) {
    $PackageOutput = Join-Path $RepoRoot "artifacts/packages"
}
Assert-PackageId -Value $PackageIdPrefix -Name "PackageIdPrefix"
if ([string]::IsNullOrWhiteSpace($AbstractionsPackageId)) {
    $AbstractionsPackageId = "$PackageIdPrefix.Abstractions"
}
if ([string]::IsNullOrWhiteSpace($CorePackageId)) {
    $CorePackageId = "$PackageIdPrefix.Core"
}
if ([string]::IsNullOrWhiteSpace($P2PPackageId)) {
    $P2PPackageId = "$PackageIdPrefix.P2P"
}
if ([string]::IsNullOrWhiteSpace($MemoryEndpointsPackageId)) {
    $MemoryEndpointsPackageId = "$PackageIdPrefix.MemoryEndpoints"
}
if ([string]::IsNullOrWhiteSpace($ConversionPackageId)) {
    $ConversionPackageId = "$PackageIdPrefix.Conversion"
}
Assert-PackageId -Value $AbstractionsPackageId -Name "AbstractionsPackageId"
Assert-PackageId -Value $CorePackageId -Name "CorePackageId"
Assert-PackageId -Value $P2PPackageId -Name "P2PPackageId"
Assert-PackageId -Value $MemoryEndpointsPackageId -Name "MemoryEndpointsPackageId"
Assert-PackageId -Value $ConversionPackageId -Name "ConversionPackageId"
$writtenPackageIds = @($AbstractionsPackageId, $CorePackageId, $P2PPackageId)
if ($IncludeOptionalMemoryEndpoints) {
    $writtenPackageIds += $MemoryEndpointsPackageId
}
if ($IncludePrivateConversion) {
    $writtenPackageIds += $ConversionPackageId
}
New-Item -ItemType Directory -Force -Path $PackageOutput | Out-Null
$PackageOutput = (Resolve-Path -LiteralPath $PackageOutput).Path
$archiveOutput = ""
function Move-ToArchive {
    param(
        [System.IO.FileInfo]$File,
        [string]$ArchivePath
    )

    $destination = Join-Path $ArchivePath $File.Name
    if (Test-Path -LiteralPath $destination) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $destination = Join-Path $ArchivePath ("{0}.{1}{2}" -f [System.IO.Path]::GetFileNameWithoutExtension($File.Name), $stamp, $File.Extension)
    }
    Move-Item -LiteralPath $File.FullName -Destination $destination
}
if ($ArchiveOtherPackages) {
    $archiveOutput = Join-Path $PackageOutput "Archive"
    New-Item -ItemType Directory -Force -Path $archiveOutput | Out-Null
    $archiveOutput = (Resolve-Path -LiteralPath $archiveOutput).Path
    if (-not $archiveOutput.StartsWith($PackageOutput, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Archive output must stay inside package output. PackageOutput=$PackageOutput Archive=$archiveOutput"
    }

    Get-ChildItem -LiteralPath $PackageOutput -File |
        Where-Object {
            $packageName = $_.Name
            ($_.Extension -in ".nupkg", ".snupkg") -and
            -not ($writtenPackageIds | Where-Object {
                $packageName -like "$_.*.nupkg" -or $packageName -like "$_.*.snupkg"
            })
        } |
        ForEach-Object { Move-ToArchive -File $_ -ArchivePath $archiveOutput }

    Get-ChildItem -LiteralPath $PackageOutput -Filter "SHA256SUMS-$PackageIdPrefix-*.txt" -File |
        ForEach-Object { Move-ToArchive -File $_ -ArchivePath $archiveOutput }

    Get-ChildItem -LiteralPath $PackageOutput -Filter "README-$PackageIdPrefix-*.txt" -File |
        ForEach-Object { Move-ToArchive -File $_ -ArchivePath $archiveOutput }
}
foreach ($packageId in $writtenPackageIds) {
    foreach ($stalePackagePattern in @("$packageId.*.nupkg", "$packageId.*.snupkg")) {
        Get-ChildItem -LiteralPath $PackageOutput -Filter $stalePackagePattern -File |
            ForEach-Object {
                if ($ArchiveOtherPackages) {
                    Move-ToArchive -File $_ -ArchivePath $archiveOutput
                }
                else {
                    Remove-Item -LiteralPath $_.FullName -Force
                }
            }
    }
}

& (Join-Path $PSScriptRoot "build-native.ps1") -Configuration release

Push-Location $RepoRoot
try {
    if ($IncludePrivateConversion) {
        Invoke-Cargo -Arguments @("build", "-p", "tinyrustlm-convert", "--release")
    }
    $packageProperties = @(
        "/p:TinyRustLmPackageIdPrefix=$PackageIdPrefix",
        "/p:TinyRustLmAbstractionsPackageId=$AbstractionsPackageId",
        "/p:TinyRustLmCorePackageId=$CorePackageId",
        "/p:TinyRustLmP2PPackageId=$P2PPackageId",
        "/p:TinyRustLmMemoryEndpointsPackageId=$MemoryEndpointsPackageId",
        "/p:TinyRustLmConversionPackageId=$ConversionPackageId"
    )
    if ($IncludeOptionalMemoryEndpoints) {
        $packageProperties += "/p:TinyRustLmPackOptionalMemoryEndpoints=true"
    }
    if ($IncludePrivateConversion) {
        $packageProperties += "/p:TinyRustLmPackPrivateConversion=true"
    }
    Invoke-DotNet -Arguments (@("restore", "dotnet/TinyRustLM.sln") + $packageProperties)
    Invoke-DotNet -Arguments (@("build", "dotnet/TinyRustLM.sln", "-c", $Configuration, "--no-restore") + $packageProperties)
    $env:TINYRUSTLM_REPO_ROOT = $RepoRoot
    Invoke-DotNet -Arguments (@("test", "dotnet/TinyRustLM.sln", "-c", $Configuration, "--no-build") + $packageProperties)
    Invoke-DotNet -Arguments (@("pack", "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput) + $packageProperties)
    Invoke-DotNet -Arguments (@("pack", "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput) + $packageProperties)
    Invoke-DotNet -Arguments (@("pack", "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput) + $packageProperties)
    if ($IncludeOptionalMemoryEndpoints) {
        Invoke-DotNet -Arguments (@("pack", "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput) + $packageProperties)
    }
    if ($IncludePrivateConversion) {
        Invoke-DotNet -Arguments (@("pack", "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput) + $packageProperties)
    }
    $packageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
    if ([string]::IsNullOrWhiteSpace($packageVersion)) {
        throw "Package version could not be resolved from dotnet/Directory.Build.props."
    }
    $canonicalPackagePaths = @()
    foreach ($packageId in $writtenPackageIds) {
        foreach ($extension in @("nupkg", "snupkg")) {
            $packagePath = Join-Path $PackageOutput "$packageId.$packageVersion.$extension"
            if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
                throw "Expected package is missing before canonicalization: $packageId.$packageVersion.$extension"
            }
            $canonicalPackagePaths += (Resolve-Path -LiteralPath $packagePath).Path
        }
    }
    Invoke-DotNet -Arguments (@(
        "run",
        "--project",
        "dotnet/tools/TinyRustLM.PackageCanonicalizer/TinyRustLM.PackageCanonicalizer.csproj",
        "-c",
        $Configuration,
        "--no-build",
        "--no-restore",
        "--",
        "canonicalize"
    ) + $canonicalPackagePaths)
    $env:TINYRUSTLM_PACKAGE_DIR = $PackageOutput
    Invoke-DotNet -Arguments (@(
        "test",
        "dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj",
        "-c",
        $Configuration,
        "--no-build"
    ) + $packageProperties)
    Write-PackageHashManifest -OutputPath $PackageOutput -ManifestPrefix $PackageIdPrefix -PackageIds $writtenPackageIds
    Write-PackageFeedReadme -OutputPath $PackageOutput -ManifestPrefix $PackageIdPrefix -PackageIds $writtenPackageIds
    Write-Host "$($writtenPackageIds -join ', ') packages written to $PackageOutput"
}
finally {
    Pop-Location
}
