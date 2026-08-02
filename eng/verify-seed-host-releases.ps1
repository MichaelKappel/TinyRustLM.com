param(
    [string]$ReleaseDirectory = "",
    [string]$Version = "",
    [string]$QemuAarch64Path = "",
    [string]$Arm64SysrootPath = "",
    [string]$ReportOutput = "",
    [switch]$SkipLinuxExecution
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Project = Join-Path $RepoRoot "dotnet/tools/TinyRustLM.SeedHost.Tool/TinyRustLM.SeedHost.Tool.csproj"
[xml]$ProjectXml = Get-Content -LiteralPath $Project
if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = [string]$ProjectXml.Project.PropertyGroup.VersionPrefix
}
if ([string]::IsNullOrWhiteSpace($ReleaseDirectory)) {
    $ReleaseDirectory = Join-Path $RepoRoot "artifacts/releases"
}
$ReleaseDirectory = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
if ([string]::IsNullOrWhiteSpace($ReportOutput)) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-seed-host-release-verification-$Version.json"
}
$ReportOutput = [IO.Path]::GetFullPath($ReportOutput)
$PackageId = "UAIX.Browser.p2pRuntime.SeedHost.Tool"
$Rids = @("win-x64", "linux-x64", "linux-arm64")
$ChecksumPath = Join-Path $ReleaseDirectory "SHA256SUMS-$PackageId-$Version.txt"
$executionRows = [Collections.Generic.List[object]]::new()

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ArchiveEntries {
    param([string]$Path)
    if ($Path.EndsWith(".zip", [StringComparison]::OrdinalIgnoreCase)) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [IO.Compression.ZipFile]::OpenRead($Path)
        try {
            return @($archive.Entries | ForEach-Object { $_.FullName })
        }
        finally {
            $archive.Dispose()
        }
    }
    $entries = @(& tar -tzf $Path)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to list release archive: $Path"
    }
    return $entries
}

function Normalize-ArchiveEntries {
    param([string[]]$Entries)
    $normalizedEntries = [Collections.Generic.List[string]]::new()
    foreach ($entry in $Entries) {
        $normalized = $entry.Replace("\", "/")
        if ($normalized.StartsWith("/", [StringComparison]::Ordinal) -or $normalized -match "^[A-Za-z]:") {
            throw "Unsafe absolute archive path: $entry"
        }
        while ($normalized.StartsWith("./", [StringComparison]::Ordinal)) {
            $normalized = $normalized.Substring(2)
        }
        if ([string]::IsNullOrWhiteSpace($normalized)) {
            continue
        }
        if ($normalized.Split('/') -contains "..") {
            throw "Unsafe traversal archive path: $entry"
        }
        $normalizedEntries.Add($normalized)
    }
    $duplicates = @($normalizedEntries | Group-Object | Where-Object { $_.Count -ne 1 })
    if ($duplicates.Count -ne 0) {
        throw "Release archive contains duplicate paths: $($duplicates.Name -join ', ')"
    }
    return @($normalizedEntries)
}

function Assert-JsonEnvelope {
    param([object]$Envelope, [string]$Label)
    if ($null -eq $Envelope -or $Envelope.ok -ne $true -or $null -eq $Envelope.value) {
        throw "$Label did not return a successful JSON envelope"
    }
}

if (-not (Test-Path -LiteralPath $ChecksumPath -PathType Leaf)) {
    throw "Release checksum manifest is missing: $ChecksumPath"
}
$checksumLines = @(Get-Content -LiteralPath $ChecksumPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
if ($checksumLines.Count -ne 9) {
    throw "Release checksum manifest must contain exactly nine entries"
}
$expectedFiles = [Collections.Generic.Dictionary[string, string]]::new([StringComparer]::Ordinal)
foreach ($line in $checksumLines) {
    if ($line -notmatch "^([0-9a-f]{64})  ([^/\\]+)$") {
        throw "Invalid or unsafe release checksum entry: $line"
    }
    if ($expectedFiles.ContainsKey($Matches[2])) {
        throw "Duplicate release checksum entry: $($Matches[2])"
    }
    $expectedFiles.Add($Matches[2], $Matches[1])
}

$expectedNames = [Collections.Generic.List[string]]::new()
foreach ($rid in $Rids) {
    $archiveExtension = if ($rid -eq "win-x64") { ".zip" } else { ".tar.gz" }
    foreach ($suffix in @("$archiveExtension", ".spdx.json", ".release.json")) {
        $expectedNames.Add("$PackageId.$Version-$rid$suffix")
    }
}
if (@($expectedNames | Where-Object { -not $expectedFiles.ContainsKey($_) }).Count -ne 0 -or
    @($expectedFiles.Keys | Where-Object { -not $expectedNames.Contains($_) }).Count -ne 0) {
    throw "Release checksum manifest does not describe the exact three-RID artifact set"
}
foreach ($entry in $expectedFiles.GetEnumerator()) {
    $path = Join-Path $ReleaseDirectory $entry.Key
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Release artifact is missing: $path"
    }
    if ((Get-Sha256 -Path $path) -ne $entry.Value) {
        throw "Release checksum mismatch: $path"
    }
}

foreach ($rid in $Rids) {
    $archiveExtension = if ($rid -eq "win-x64") { ".zip" } else { ".tar.gz" }
    $baseName = "$PackageId.$Version-$rid"
    $archivePath = Join-Path $ReleaseDirectory "$baseName$archiveExtension"
    $receiptPath = Join-Path $ReleaseDirectory "$baseName.release.json"
    $sbomPath = Join-Path $ReleaseDirectory "$baseName.spdx.json"
    $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
    if ($receipt.schema -ne "uaix.seed_host.release.v0" -or
        $receipt.package_id -ne $PackageId -or
        $receipt.version -ne $Version -or
        $receipt.rid -ne $rid -or
        $receipt.self_contained -ne $true -or
        $receipt.native_abi_version -ne 2 -or
        $receipt.model_bytes_included -ne $false -or
        $receipt.project_server_serves_model_bytes -ne $false -or
        $receipt.project_server_runs_model_bytes -ne $false -or
        $receipt.project_server_proxies_model_bytes -ne $false) {
        throw "Release receipt contract mismatch for $rid"
    }
    if ($receipt.tiny_rust_lm_source.revision -notmatch "^[0-9a-f]{40}$" -or
        $receipt.mini_model_source.revision -notmatch "^[0-9a-f]{40}$") {
        throw "Release receipt source revisions are invalid for $rid"
    }
    $sbom = Get-Content -LiteralPath $sbomPath -Raw | ConvertFrom-Json
    if ($sbom.spdxVersion -ne "SPDX-2.2" -or $sbom.name -notmatch [regex]::Escape($PackageId)) {
        throw "External SPDX document is invalid for $rid"
    }

    $entries = @(Normalize-ArchiveEntries -Entries (Get-ArchiveEntries -Path $archivePath))
    foreach ($required in @("README.md", "LICENSE.txt", "RELEASE.json", "_manifest/spdx_2.2/manifest.spdx.json")) {
        if ($entries -notcontains $required) {
            throw "Release archive for $rid is missing $required"
        }
    }
    if (@($entries | Where-Object { $_ -match "\.(slm|safetensors|gguf|onnx)$" }).Count -ne 0) {
        throw "Release archive for $rid contains model weights"
    }
    $nativeNames = if ($rid -eq "win-x64") {
        @("minimodel.exe", "minimodel_native.dll")
    }
    else {
        @("minimodel", "libminimodel_native.so")
    }
    foreach ($name in $nativeNames) {
        if ($entries -notcontains "runtimes/$rid/native/$name") {
            throw "Release archive for $rid is missing native asset $name"
        }
    }
    $foreignNative = @($entries | Where-Object {
        $_ -match '^runtimes/([^/]+)/native/(minimodel(?:\.exe)?|(?:lib)?minimodel_native\.(?:dll|so|dylib))$' -and
        $Matches[1] -ne $rid
    })
    if ($foreignNative.Count -ne 0) {
        throw "Release archive for $rid contains foreign RID native assets"
    }
}

$verificationRoot = Join-Path ([IO.Path]::GetTempPath()) ("uaix-seed-host-win-release-{0}" -f [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $verificationRoot | Out-Null
$verificationResolved = (Resolve-Path -LiteralPath $verificationRoot).Path
$safeTemporaryPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + [IO.Path]::DirectorySeparatorChar
if (-not $verificationResolved.StartsWith($safeTemporaryPrefix, [StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path $verificationResolved -Leaf) -notmatch '^uaix-seed-host-win-release-[0-9a-f]{32}$') {
    throw "Windows verification directory is unsafe"
}
try {
    $winBaseName = "$PackageId.$Version-win-x64"
    $winArchive = Join-Path $ReleaseDirectory "$winBaseName.zip"
    Expand-Archive -LiteralPath $winArchive -DestinationPath $verificationResolved
    $internalReceiptPath = Join-Path $verificationResolved "RELEASE.json"
    $internalSbomPath = Join-Path $verificationResolved "_manifest/spdx_2.2/manifest.spdx.json"
    if ((Get-Sha256 -Path $internalReceiptPath) -ne (Get-Sha256 -Path (Join-Path $ReleaseDirectory "$winBaseName.release.json"))) {
        throw "Windows archive receipt differs from its external release receipt"
    }
    if ((Get-Sha256 -Path $internalSbomPath) -ne (Get-Sha256 -Path (Join-Path $ReleaseDirectory "$winBaseName.spdx.json"))) {
        throw "Windows archive SBOM differs from its external SPDX document"
    }
    $tool = Join-Path $verificationResolved "uaix-p2p-seed.exe"
    $doctorRaw = & $tool doctor --json
    if ($LASTEXITCODE -ne 0) { throw "Windows archive doctor failed" }
    $doctor = $doctorRaw | ConvertFrom-Json
    Assert-JsonEnvelope -Envelope $doctor -Label "Windows doctor"
    if ($doctor.value.runtime_identifier -ne "win-x64" -or
        $doctor.value.native_abi_version -ne 2 -or
        $doctor.value.ready -ne $true) {
        throw "Windows archive doctor contract mismatch"
    }
    $fleetRoot = Join-Path $verificationResolved "fleet"
    $initRaw = & $tool init --fleet-id archive-win-x64-smoke --root $fleetRoot --json
    if ($LASTEXITCODE -ne 0) { throw "Windows archive init failed" }
    $init = $initRaw | ConvertFrom-Json
    Assert-JsonEnvelope -Envelope $init -Label "Windows init"
    $inspectRaw = & $tool inspect --root $fleetRoot --json
    if ($LASTEXITCODE -ne 0) { throw "Windows archive inspect failed" }
    $inspect = $inspectRaw | ConvertFrom-Json
    Assert-JsonEnvelope -Envelope $inspect -Label "Windows inspect"
    if ($inspect.value.target_model_count -ne 20 -or
        $inspect.value.replica_lane_count -ne 2 -or
        $inspect.value.remaining_model_capacity -ne 20 -or
        $inspect.value.advertisement_status -ne "external-probe-required") {
        throw "Windows archive empty-fleet contract mismatch"
    }
    $executionRows.Add([ordered]@{
        rid = "win-x64"
        execution_environment = "native-windows-process"
        executed = $true
        emulated = $false
        physical_hardware = $true
        doctor_passed = $true
        native_abi_version = 2
        empty_fleet_lifecycle_passed = $true
    })
}
finally {
    if ((Test-Path -LiteralPath $verificationResolved -PathType Container) -and
        $verificationResolved.StartsWith($safeTemporaryPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path $verificationResolved -Leaf) -match '^uaix-seed-host-win-release-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $verificationResolved -Recurse -Force
    }
}

if (-not $SkipLinuxExecution) {
    $wsl = Get-Command wsl.exe -ErrorAction Stop
    $linuxScriptWindows = (Resolve-Path (Join-Path $PSScriptRoot "verify-seed-host-release.sh")).Path
    $linuxScript = (& $wsl.Source -e wslpath -a $linuxScriptWindows).Trim()
    $linuxReleaseDirectory = (& $wsl.Source -e wslpath -a $ReleaseDirectory).Trim()
    if ([string]::IsNullOrWhiteSpace($linuxScript) -or [string]::IsNullOrWhiteSpace($linuxReleaseDirectory)) {
        throw "Unable to map release verification paths into WSL"
    }
    & $wsl.Source -e bash $linuxScript --release-dir $linuxReleaseDirectory --version $Version --rid linux-x64
    if ($LASTEXITCODE -ne 0) {
        throw "linux-x64 archive execution verification failed"
    }
    $executionRows.Add([ordered]@{
        rid = "linux-x64"
        execution_environment = "wsl2-linux-process"
        executed = $true
        emulated = $false
        physical_hardware = $false
        doctor_passed = $true
        native_abi_version = 2
        empty_fleet_lifecycle_passed = $true
    })
    $armArguments = @(
        "-e", "bash", $linuxScript,
        "--release-dir", $linuxReleaseDirectory,
        "--version", $Version,
        "--rid", "linux-arm64"
    )
    if (-not [string]::IsNullOrWhiteSpace($QemuAarch64Path)) {
        $armArguments += @("--qemu-aarch64", $QemuAarch64Path)
    }
    if (-not [string]::IsNullOrWhiteSpace($Arm64SysrootPath)) {
        $armArguments += @("--arm64-sysroot", $Arm64SysrootPath)
    }
    & $wsl.Source @armArguments
    if ($LASTEXITCODE -ne 0) {
        throw "linux-arm64 archive execution verification failed"
    }
    $executionRows.Add([ordered]@{
        rid = "linux-arm64"
        execution_environment = "qemu-aarch64-under-wsl2"
        executed = $true
        emulated = $true
        physical_hardware = $false
        doctor_passed = $true
        native_abi_version = 2
        empty_fleet_lifecycle_passed = $true
    })
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
$report = [ordered]@{
    schema = "tinyrustlm.seed_host_release_verification.v1"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = "pass"
    package_id = $PackageId
    version = $Version
    checksum_manifest_sha256 = Get-Sha256 -Path $ChecksumPath
    checksum_entry_count = $checksumLines.Count
    archive_receipt_sbom_sets_verified = 3
    model_bytes_included = $false
    project_server_serves_model_bytes = $false
    project_server_runs_model_bytes = $false
    project_server_proxies_model_bytes = $false
    execution = @($executionRows)
    executed_rid_count = @($executionRows | Where-Object { $_.executed }).Count
    physical_linux_arm64_executed = @($executionRows | Where-Object {
        $_.rid -eq "linux-arm64" -and $_.executed -and $_.physical_hardware -and -not $_.emulated
    }).Count -eq 1
}
$temporaryReport = "$ReportOutput.$PID.$([guid]::NewGuid().ToString('N')).tmp"
try {
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporaryReport -Encoding UTF8
    Move-Item -LiteralPath $temporaryReport -Destination $ReportOutput -Force
}
finally {
    Remove-Item -LiteralPath $temporaryReport -Force -ErrorAction SilentlyContinue
}

Write-Host "Verified seed-host release $Version checksums, receipts, SBOMs, archive boundaries, and RID execution."
Write-Host "Seed-host release verification report written to $ReportOutput"
