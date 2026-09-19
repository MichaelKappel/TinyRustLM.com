param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$IntakeRoot = 'agent-file-handoff',
    [string]$ManifestRoot = 'docs/report-intake',
    [Alias('CurrentBatches')]
    [string[]]$CurrentManifestRoutes = @(
        'docs/report-intake/2026-09-19/working-product-research/MANIFEST.md'
    )
)

$ErrorActionPreference = 'Stop'

$canonicalMemoryRoute = 'wiki/runtime-mirust/reports/tinyrustlm-working-product-memory-2026-09-19.md'
$decisionIndexRoute = 'wiki/runtime-mirust/reports/tinyrustlm-report-intake-decision-index-2026-09-19.md'
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    [void]$failures.Add($Message)
}

function Normalize-Path {
    param([string]$Path)
    return $Path.Trim().Trim('`').Replace('\', '/')
}

function Get-RelativePath {
    param(
        [string]$BasePath,
        [string]$ChildPath
    )

    $baseFullPath = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\') + '\'
    $childFullPath = [System.IO.Path]::GetFullPath($ChildPath)
    $baseUri = [Uri]$baseFullPath
    $childUri = [Uri]$childFullPath
    return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($childUri).ToString())
}

function Get-TableCells {
    param([string]$Line)
    return @(($Line.Trim().Trim('|') -split '\|') | ForEach-Object { $_.Trim() })
}

function Normalize-Header {
    param([string]$Value)
    return (($Value.ToLowerInvariant().ToCharArray() | Where-Object { [char]::IsLetterOrDigit($_) }) -join '')
}

function Get-HeaderIndex {
    param(
        [string[]]$Headers,
        [string[]]$Candidates
    )

    for ($index = 0; $index -lt $Headers.Count; $index++) {
        if ($Candidates -contains $Headers[$index]) {
            return $index
        }
    }
    return -1
}

function Get-CellFileName {
    param([string]$Value)

    $result = $Value.Trim().Trim('`')
    if ($result.StartsWith('[')) {
        $close = $result.IndexOf(']')
        if ($close -le 1) {
            return $null
        }
        return $result.Substring(1, $close - 1)
    }
    return $result
}

function Get-OptionalCell {
    param(
        [object[]]$Cells,
        [int]$Index
    )

    if ($Index -lt 0 -or $Index -ge $Cells.Count) {
        return $null
    }
    $value = ([string]$Cells[$Index]).Trim().Trim('`')
    if ([string]::IsNullOrWhiteSpace($value) -or $value -eq '-') {
        return $null
    }
    return $value
}

function Get-OptionalBytes {
    param(
        [object[]]$Cells,
        [int]$Index,
        [string]$Context
    )

    $value = Get-OptionalCell -Cells $Cells -Index $Index
    if ($null -eq $value) {
        return $null
    }

    [int64]$parsed = 0
    if (-not [int64]::TryParse($value.Replace(',', ''), [ref]$parsed)) {
        Add-Failure "Invalid byte count in $Context`: $value"
        return $null
    }
    return $parsed
}

function Get-NormalizedSha256 {
    param(
        [string]$Value,
        [string]$Context
    )

    $hash = $Value.Trim().Trim('`').ToLowerInvariant()
    if ($hash -notmatch '^[0-9a-f]{64}$') {
        Add-Failure "Invalid SHA-256 in $Context`: $Value"
        return $null
    }
    return $hash
}

function Get-ManifestRows {
    param([string]$ManifestPath)

    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $lines = @([System.IO.File]::ReadAllLines($ManifestPath, $utf8))
    $headerIndex = -1
    $headers = @()

    for ($index = 0; $index -lt $lines.Count; $index++) {
        if (-not $lines[$index].StartsWith('|')) {
            continue
        }

        $candidate = @(Get-TableCells -Line $lines[$index] | ForEach-Object { Normalize-Header $_ })
        if (($candidate -contains 'file') -and
            (($candidate -contains 'sha256') -or ($candidate -contains 'sourcesha256'))) {
            $headerIndex = $index
            $headers = $candidate
            break
        }
    }

    if ($headerIndex -lt 0) {
        return
    }

    $fileIndex = Get-HeaderIndex -Headers $headers -Candidates @('file')
    $sourceHashIndex = Get-HeaderIndex -Headers $headers -Candidates @('sourcesha256')
    if ($sourceHashIndex -lt 0) {
        $sourceHashIndex = Get-HeaderIndex -Headers $headers -Candidates @('sha256')
    }
    $sourceBytesIndex = Get-HeaderIndex -Headers $headers -Candidates @('bytes')
    $durablePathIndex = Get-HeaderIndex -Headers $headers -Candidates @('durablepath', 'durabledocscopy')
    $durableHashIndex = Get-HeaderIndex -Headers $headers -Candidates @('durablesha256')
    $durableBytesIndex = Get-HeaderIndex -Headers $headers -Candidates @('durablebytes')
    $rowCount = 0

    for ($index = $headerIndex + 1; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]
        if (-not $line.StartsWith('|')) {
            if ($rowCount -gt 0) {
                break
            }
            continue
        }

        $cells = @(Get-TableCells -Line $line)
        $isDivider = $true
        foreach ($cell in $cells) {
            if ($cell -notmatch '^[\s:-]+$') {
                $isDivider = $false
                break
            }
        }
        if ($isDivider) {
            continue
        }

        if ($cells.Count -le [Math]::Max($fileIndex, $sourceHashIndex)) {
            Add-Failure "Malformed manifest row in $ManifestPath`: $line"
            continue
        }

        $fileName = Get-CellFileName -Value $cells[$fileIndex]
        $sourceHash = Get-NormalizedSha256 -Value $cells[$sourceHashIndex] -Context $ManifestPath
        if ([string]::IsNullOrWhiteSpace($fileName) -or $null -eq $sourceHash) {
            continue
        }

        $durablePath = Get-OptionalCell -Cells $cells -Index $durablePathIndex
        if ($null -ne $durablePath -and $durablePath.StartsWith('[')) {
            $durablePath = $null
        }
        $durableHash = Get-OptionalCell -Cells $cells -Index $durableHashIndex
        if ($null -ne $durableHash) {
            $durableHash = Get-NormalizedSha256 -Value $durableHash -Context $ManifestPath
        }

        [pscustomobject]@{
            ManifestPath = $ManifestPath
            File = $fileName
            SourceSha256 = $sourceHash
            SourceBytes = Get-OptionalBytes -Cells $cells -Index $sourceBytesIndex -Context $ManifestPath
            DurablePath = $durablePath
            DurableSha256 = $durableHash
            DurableBytes = Get-OptionalBytes -Cells $cells -Index $durableBytesIndex -Context $ManifestPath
        }
        $rowCount++
    }

    if ($rowCount -eq 0) {
        Add-Failure "Checksum table contains no report rows: $ManifestPath"
    }
}

function Resolve-DurablePath {
    param(
        [string]$RootPath,
        [object]$Row
    )

    if (-not [string]::IsNullOrWhiteSpace($Row.DurablePath)) {
        return [System.IO.Path]::GetFullPath((Join-Path $RootPath $Row.DurablePath))
    }
    return [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $Row.ManifestPath) $Row.File))
}

function Test-Contains {
    param(
        [string]$Text,
        [string]$Value
    )
    return $Text.IndexOf($Value, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

$rootPath = [System.IO.Path]::GetFullPath($Root)
$rootPrefix = $rootPath.TrimEnd('\') + '\'
$manifestRootPath = Join-Path $rootPath $ManifestRoot
$intakeRootPath = Join-Path $rootPath $IntakeRoot
$activeEntryCount = 0

foreach ($bucketName in @('Content', 'Improvement')) {
    $bucketPath = Join-Path $intakeRootPath $bucketName
    if (-not (Test-Path -LiteralPath $bucketPath -PathType Container)) {
        Add-Failure "Missing active intake bucket: $bucketPath"
        continue
    }

    $activeEntries = @(Get-ChildItem -LiteralPath $bucketPath -Force |
        Where-Object { $_.Name -ne '.gitkeep' })
    foreach ($entry in $activeEntries) {
        $activeEntryCount++
        Add-Failure "Active intake bucket is not empty: $($entry.FullName)"
    }
}

$manifestFiles = @(Get-ChildItem -LiteralPath $manifestRootPath -Recurse -Filter 'MANIFEST.md' -File |
    Sort-Object FullName)
if ($manifestFiles.Count -eq 0) {
    Add-Failure 'No durable report-intake manifests were found.'
}

$allRows = New-Object System.Collections.Generic.List[object]
foreach ($manifest in $manifestFiles) {
    foreach ($row in @(Get-ManifestRows -ManifestPath $manifest.FullName)) {
        [void]$allRows.Add($row)
    }
}
if ($allRows.Count -lt 80) {
    Add-Failure "Expected at least 80 checksum-bound durable rows; found $($allRows.Count)."
}

foreach ($row in $allRows) {
    $durablePath = Resolve-DurablePath -RootPath $rootPath -Row $row
    if (-not $durablePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        Add-Failure "Manifest path escapes the repository: $durablePath"
        continue
    }
    if (-not (Test-Path -LiteralPath $durablePath -PathType Leaf)) {
        Add-Failure "Missing durable report: $durablePath"
        continue
    }

    $expectedHash = if ($null -ne $row.DurableSha256) { $row.DurableSha256 } else { $row.SourceSha256 }
    $actualHash = (Get-FileHash -LiteralPath $durablePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        Add-Failure "Durable report hash mismatch: $durablePath expected=$expectedHash actual=$actualHash"
    }

    $expectedBytes = if ($null -ne $row.DurableBytes) { $row.DurableBytes } else { $row.SourceBytes }
    if ($null -ne $expectedBytes) {
        $actualBytes = (Get-Item -LiteralPath $durablePath).Length
        if ($actualBytes -ne $expectedBytes) {
            Add-Failure "Durable report byte mismatch: $durablePath expected=$expectedBytes actual=$actualBytes"
        }
    }
}

$ledgerPath = Join-Path $rootPath '.uai/intake-outcome-ledger.uai'
$canonicalPath = Join-Path $rootPath $canonicalMemoryRoute
$decisionIndexPath = Join-Path $rootPath $decisionIndexRoute
foreach ($requiredPath in @($ledgerPath, $canonicalPath, $decisionIndexPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        Add-Failure "Missing required current-memory path: $requiredPath"
    }
}

$ledgerText = if (Test-Path -LiteralPath $ledgerPath -PathType Leaf) {
    Get-Content -LiteralPath $ledgerPath -Raw
} else { '' }

$currentRows = New-Object System.Collections.Generic.List[object]
foreach ($manifestRoute in $CurrentManifestRoutes) {
    $manifestPath = Join-Path $rootPath $manifestRoute
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Add-Failure "Missing current report manifest: $manifestRoute"
        continue
    }
    foreach ($row in @(Get-ManifestRows -ManifestPath $manifestPath)) {
        [void]$currentRows.Add($row)
    }
}
if ($currentRows.Count -ne 16) {
    Add-Failure "Current reviewed report inventory must contain 16 reports; found $($currentRows.Count)."
}

if (-not (Test-Contains -Text $ledgerText -Value $canonicalMemoryRoute)) {
    Add-Failure 'Outcome ledger does not route to canonical enterprise memory.'
}
if (-not (Test-Contains -Text $ledgerText -Value $decisionIndexRoute)) {
    Add-Failure 'Outcome ledger does not route to the report decision index.'
}
foreach ($row in $currentRows) {
    $durablePath = Resolve-DurablePath -RootPath $rootPath -Row $row
    $route = Normalize-Path (Get-RelativePath -BasePath $rootPath -ChildPath $durablePath)
    if (-not (Test-Contains -Text $ledgerText -Value $route)) {
        Add-Failure "Outcome ledger does not route current report: $route"
    }
    if (-not (Test-Contains -Text $ledgerText -Value $row.SourceSha256)) {
        Add-Failure "Outcome ledger does not retain current report identity: $($row.SourceSha256)"
    }
}

$decisionText = if (Test-Path -LiteralPath $decisionIndexPath -PathType Leaf) {
    Get-Content -LiteralPath $decisionIndexPath -Raw
} else { '' }
foreach ($row in $currentRows) {
    $route = Normalize-Path (Get-RelativePath -BasePath $rootPath -ChildPath (
        Resolve-DurablePath -RootPath $rootPath -Row $row))
    $count = [regex]::Matches($decisionText, [regex]::Escape($route)).Count
    if ($count -ne 1) {
        Add-Failure "Decision index must route current report exactly once: route=$route count=$count"
    }
}
foreach ($requiredText in @(
    'Adopted production invariants',
    'Research-only backlog',
    'Rejected directions',
    'Corrections that override report prose',
    'Facts requiring local or authorized verification',
    'Agents working across every ecosystem site use MemoryEndpoints.com directly',
    'TinyRustLM.com Connect plugin lets a user sign in to',
    'important memory may also be duplicated in current `.uai`'
)) {
    if (-not (Test-Contains -Text $decisionText -Value $requiredText)) {
        Add-Failure "Decision index is missing current policy: $requiredText"
    }
}

$uaiFiles = @(
    Get-ChildItem -LiteralPath (Join-Path $rootPath '.uai') -Filter '*.uai' -File
    Get-Item -LiteralPath (Join-Path $rootPath 'workspace.uai')
    Get-Item -LiteralPath (Join-Path $rootPath 'tinyrustlm/authority/ecosystem-workspace.uai')
)
if ($uaiFiles.Count -ne 24) {
    Add-Failure "Expected 24 UAI files including two historical receipts; found $($uaiFiles.Count)."
}

[int64]$uaiBytes = 0
foreach ($file in $uaiFiles) {
    $route = Normalize-Path (Get-RelativePath -BasePath $rootPath -ChildPath $file.FullName)
    $uaiBytes += $file.Length
    $ceiling = if ($route -eq '.uai/intake-outcome-ledger.uai') { 400000 } else { 48000 }
    if ($file.Length -gt $ceiling) {
        Add-Failure "Current UAI file exceeds its byte ceiling: $route bytes=$($file.Length) ceiling=$ceiling"
    }

    $text = Get-Content -LiteralPath $file.FullName -Raw
    # Dated receipts preserve past identities, not current routing authority.
    if ($route -in @('.uai/source-authority-relocation-2026-08-30.uai', '.uai/storage-consolidation-2026-09-12.uai')) {
        continue
    }
    foreach ($requiredRoute in @($canonicalMemoryRoute, $decisionIndexRoute)) {
        if (-not (Test-Contains -Text $text -Value $requiredRoute)) {
            Add-Failure "Current UAI file is missing a durable route: file=$route route=$requiredRoute"
        }
    }
    if ($text -match '(?i)MemoryEndpoints\s+(?:is|remains)\s+unauthori[sz]ed|MemoryEndpoints\s+unauthori[sz]ed|unauthori[sz]ed(?:\s+and)?\s+disconnected\s+MemoryEndpoints') {
        Add-Failure "Current UAI file contains stale MemoryEndpoints policy: $route"
    }
}
if ($uaiBytes -gt 600000) {
    Add-Failure "Current UAI memory exceeds its total byte ceiling: $uaiBytes"
}

$totemText = Get-Content -LiteralPath (Join-Path $rootPath '.uai/totem.uai') -Raw
$tabooText = Get-Content -LiteralPath (Join-Path $rootPath '.uai/taboo.uai') -Raw
foreach ($requiredText in @(
    'Agents on all ecosystem sites use it directly for agent-to-agent long-term memory, meetings, handoffs, and coordination.',
    'TinyRustLM.com Connect plugin lets users sign in to MemoryEndpoints.com',
    'Prelaunch memory may be duplicated',
    'Keep agent coordination and user plugin identities, credentials, consent, scopes, provenance, and receipts separate.'
)) {
    if (-not (Test-Contains -Text $totemText -Value $requiredText)) {
        Add-Failure "totem.uai is missing the two-lane MemoryEndpoints authority: $requiredText"
    }
}
foreach ($requiredText in @(
    'authorized two-lane role',
    'direct agent coordination',
    'TinyRustLM.com Connect user plugin',
    'redundant prelaunch memory copies drift'
)) {
    if (-not (Test-Contains -Text $tabooText -Value $requiredText)) {
        Add-Failure "taboo.uai is missing a MemoryEndpoints prohibition: $requiredText"
    }
}

$canonicalText = if (Test-Path -LiteralPath $canonicalPath -PathType Leaf) {
    Get-Content -LiteralPath $canonicalPath -Raw
} else { '' }
foreach ($requiredText in @(
    $decisionIndexRoute,
    'MemoryEndpoints.com is authorized and strongly recommended with two distinct',
    'early alpha and has never had a working release',
    'browser client is loaded',
    'no material v3 registration',
    '0/20',
    '0/50',
    '0/25',
    '0/40'
)) {
    if (-not (Test-Contains -Text $canonicalText -Value $requiredText)) {
        Add-Failure "Canonical enterprise memory is missing current truth: $requiredText"
    }
}

$result = [ordered]@{
    root = $rootPath
    manifest_count = $manifestFiles.Count
    checksum_bound_report_count = $allRows.Count
    current_reviewed_report_count = $currentRows.Count
    active_non_placeholder_count = $activeEntryCount
    current_uai_count = $uaiFiles.Count
    current_uai_bytes = $uaiBytes
    failure_count = $failures.Count
    failures = $failures.ToArray()
}

$result | ConvertTo-Json -Depth 4
if ($failures.Count -gt 0) {
    exit 1
}
