param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$IntakeRoot = 'agent-file-handoff',
    [string]$ManifestRoot = 'docs/report-intake',
    [string[]]$CurrentBatches = @(
        '2026-07-08',
        '2026-07-10',
        '2026-07-11',
        'small-model-research-batch-2',
        'dotnet-p2p-seed-host',
        'dogfood-quality-campaign',
        'liquid-edge-research',
        'deeper-small-model-research',
        'turbovec-turboquant-and-handoff-audit',
        'colibri-specialist-portfolio',
        'champion-specialist-submodel-research',
        'post-v10-native-browser-release'
    )
)

$ErrorActionPreference = 'Stop'

function Add-Failure {
    param(
        [System.Collections.Generic.List[string]]$Failures,
        [string]$Message
    )

    [void]$Failures.Add($Message)
}

function Normalize-RelativePath {
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
    return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($childUri).ToString()).Replace('/', '\')
}

function Get-TableCells {
    param([string]$Line)

    return @(($Line.Trim().Trim('|') -split '\|') | ForEach-Object { $_.Trim() })
}

function Normalize-Header {
    param([string]$Value)

    return (($Value.ToLowerInvariant().ToCharArray() | Where-Object { [char]::IsLetterOrDigit($_) }) -join '')
}

function Get-CellFileName {
    param([string]$Value)

    $result = $Value.Trim().Trim('`')
    if ($result.StartsWith('[')) {
        $close = $result.IndexOf(']')
        if ($close -gt 1) {
            $result = $result.Substring(1, $close - 1)
        }
    }

    return $result
}

function Get-LedgerEntries {
    param([string]$LedgerText)

    $entries = @{}
    $current = $null
    foreach ($line in ($LedgerText -split "`r?`n")) {
        $sourceMatch = [regex]::Match($line, '^\s{2}- source_path:\s*(?<value>.+?)\s*$')
        if ($sourceMatch.Success) {
            $current = [ordered]@{
                source_path = Normalize-RelativePath $sourceMatch.Groups['value'].Value
                raw_lines = New-Object System.Collections.Generic.List[string]
            }
            [void]$current.raw_lines.Add($line)
            $key = $current.source_path
            if (-not $entries.ContainsKey($key)) {
                $entries[$key] = New-Object System.Collections.Generic.List[object]
            }
            [void]$entries[$key].Add($current)
            continue
        }

        if ($null -eq $current) {
            continue
        }

        if ($line -match '^\S') {
            $current = $null
            continue
        }

        [void]$current.raw_lines.Add($line)
        $fieldMatch = [regex]::Match($line, '^\s{4}(?<key>[A-Za-z0-9_]+):\s*(?<value>.*?)\s*$')
        if ($fieldMatch.Success) {
            $current[$fieldMatch.Groups['key'].Value] = $fieldMatch.Groups['value'].Value
        }
    }

    return $entries
}

function Get-ManifestRows {
    param(
        [string]$ManifestPath,
        [string]$RootPath,
        [System.Collections.Generic.List[string]]$Failures
    )

    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $lines = @([System.IO.File]::ReadAllLines($ManifestPath, $utf8))
    $headerIndex = -1
    $headers = @()
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if (-not $lines[$index].StartsWith('|')) {
            continue
        }

        $candidate = @(Get-TableCells $lines[$index] | ForEach-Object { Normalize-Header $_ })
        if ($candidate -contains 'sha256' -or $candidate -contains 'sourcesha256') {
            $headerIndex = $index
            $headers = $candidate
            break
        }
    }

    if ($headerIndex -lt 0) {
        return @()
    }

    $fileIndex = [array]::IndexOf($headers, 'file')
    if ($fileIndex -lt 0) {
        $fileIndex = [array]::IndexOf($headers, 'report')
    }
    $hashIndex = [array]::IndexOf($headers, 'sha256')
    if ($hashIndex -lt 0) {
        $hashIndex = [array]::IndexOf($headers, 'sourcesha256')
    }
    $bytesIndex = [array]::IndexOf($headers, 'bytes')
    $durableHashIndex = [array]::IndexOf($headers, 'durablesha256')
    $durableBytesIndex = [array]::IndexOf($headers, 'durablebytes')
    $categoryIndex = [array]::IndexOf($headers, 'category')
    $sourceIndex = [array]::IndexOf($headers, 'sourcepath')
    $durableIndex = [array]::IndexOf($headers, 'durablepath')

    if ($fileIndex -lt 0 -or $hashIndex -lt 0) {
        Add-Failure $Failures "Manifest has a SHA-256 table without a File/Report column: $ManifestPath"
        return @()
    }

    $rows = New-Object System.Collections.Generic.List[object]
    for ($index = $headerIndex + 1; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]
        if (-not $line.StartsWith('|')) {
            if ($rows.Count -gt 0) {
                break
            }
            continue
        }

        $cells = @(Get-TableCells $line)
        $separator = $true
        foreach ($cell in $cells) {
            if ($cell -notmatch '^\s*:?-+:?\s*$') {
                $separator = $false
                break
            }
        }
        if ($separator) {
            continue
        }

        if ($cells.Count -le [Math]::Max($fileIndex, $hashIndex)) {
            Add-Failure $Failures "Malformed manifest row in ${ManifestPath}: $line"
            continue
        }

        $sha = $cells[$hashIndex].Trim().Trim('`').ToLowerInvariant()
        if ($sha -notmatch '^[0-9a-f]{64}$') {
            Add-Failure $Failures "Invalid SHA-256 in ${ManifestPath}: $line"
            continue
        }

        $bytes = $null
        if ($bytesIndex -ge 0 -and $bytesIndex -lt $cells.Count) {
            [int64]$parsedBytes = 0
            if (-not [int64]::TryParse($cells[$bytesIndex].Replace(',', ''), [ref]$parsedBytes)) {
                Add-Failure $Failures "Invalid byte count in ${ManifestPath}: $line"
                continue
            }
            $bytes = $parsedBytes
        }

        $durableSha = $null
        if ($durableHashIndex -ge 0 -and $durableHashIndex -lt $cells.Count) {
            $durableSha = $cells[$durableHashIndex].Trim().Trim('`').ToLowerInvariant()
            if ($durableSha -notmatch '^[0-9a-f]{64}$') {
                Add-Failure $Failures "Invalid durable SHA-256 in ${ManifestPath}: $line"
                continue
            }
        }

        $durableBytes = $null
        if ($durableBytesIndex -ge 0 -and $durableBytesIndex -lt $cells.Count) {
            [int64]$parsedDurableBytes = 0
            if (-not [int64]::TryParse($cells[$durableBytesIndex].Replace(',', ''), [ref]$parsedDurableBytes)) {
                Add-Failure $Failures "Invalid durable byte count in ${ManifestPath}: $line"
                continue
            }
            $durableBytes = $parsedDurableBytes
        }

        $durablePath = $null
        if ($durableIndex -ge 0 -and $durableIndex -lt $cells.Count) {
            $durablePath = Normalize-RelativePath $cells[$durableIndex]
        }
        if ([string]::IsNullOrWhiteSpace($durablePath)) {
            $durablePath = (Get-RelativePath `
                -BasePath $RootPath `
                -ChildPath (Join-Path (Split-Path -Parent $ManifestPath) (Get-CellFileName $cells[$fileIndex]))
            ).Replace('\', '/')
        }

        $sourcePath = $null
        if ($sourceIndex -ge 0 -and $sourceIndex -lt $cells.Count) {
            $sourcePath = Normalize-RelativePath $cells[$sourceIndex]
        }

        [void]$rows.Add([pscustomobject]@{
            File = Get-CellFileName $cells[$fileIndex]
            Category = if ($categoryIndex -ge 0 -and $categoryIndex -lt $cells.Count) { $cells[$categoryIndex].Trim().Trim('`') } else { $null }
            Bytes = $bytes
            Sha256 = $sha
            DurableBytes = $durableBytes
            DurableSha256 = $durableSha
            SourcePath = $sourcePath
            DurablePath = $durablePath
            ManifestPath = $ManifestPath
        })
    }

    return $rows.ToArray()
}

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$intakePath = Join-Path $rootPath $IntakeRoot
$manifestRootPath = Join-Path $rootPath $ManifestRoot
$ledgerPath = Join-Path $rootPath '.uai/intake-outcome-ledger.uai'
$failures = New-Object System.Collections.Generic.List[string]
$validOutcomes = @(
    'incorporated',
    'rejected-with-reason',
    'preserved-to-durable-memory',
    'kept-active-with-reason'
)

foreach ($requiredPath in @($intakePath, $manifestRootPath, $ledgerPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required report-intake path not found: $requiredPath"
    }
}

$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$ledgerText = [System.IO.File]::ReadAllText($ledgerPath, $utf8Strict)
$ledgerEntries = Get-LedgerEntries $ledgerText
$activeFiles = New-Object System.Collections.Generic.List[object]

foreach ($bucketName in @('Content', 'Improvement')) {
    $bucketPath = Join-Path $intakePath $bucketName
    if (-not (Test-Path -LiteralPath $bucketPath -PathType Container)) {
        Add-Failure $failures "Missing active intake bucket: $bucketPath"
        continue
    }

    foreach ($entry in @(Get-ChildItem -LiteralPath $bucketPath -Force)) {
        if ($entry.Name -eq '.gitkeep') {
            continue
        }

        $relativePath = (Get-RelativePath -BasePath $rootPath -ChildPath $entry.FullName).Replace('\', '/')
        [void]$activeFiles.Add([pscustomobject]@{ Bucket = $bucketName; Path = $relativePath; Name = $entry.Name })

        if ($entry.PSIsContainer) {
            Add-Failure $failures "Active intake contains a subdirectory: $relativePath"
            continue
        }

        if ($entry.Name -match '^(?i:README\.md|STATUS(?:[-_].*)?\.[^.]+|INDEX(?:[-_].*)?\.[^.]+)$') {
            Add-Failure $failures "Active intake contains forbidden bucket-local guidance/status/index file: $relativePath"
            continue
        }

        if (-not $ledgerEntries.ContainsKey($relativePath)) {
            Add-Failure $failures "Active intake file has no ledger entry: $relativePath"
            continue
        }

        $entryCandidates = $ledgerEntries[$relativePath].ToArray()
        $latestEntry = $entryCandidates[$entryCandidates.Count - 1]
        if ($latestEntry.processed_outcome -ne 'kept-active-with-reason') {
            Add-Failure $failures "Active intake file is not an explicit kept-active blocker: $relativePath"
            continue
        }

        $reason = $latestEntry.keep_active_reason
        if ([string]::IsNullOrWhiteSpace($reason) -or $reason -match '^(?i:none|none_current|human review)$') {
            Add-Failure $failures "Active intake file has no concrete keep-active reason: $relativePath"
        }
    }
}

$manifestFiles = @(Get-ChildItem -LiteralPath $manifestRootPath -Recurse -Filter 'MANIFEST.md' -File | Sort-Object FullName)
if ($manifestFiles.Count -eq 0) {
    Add-Failure $failures 'No durable report-intake manifests were found.'
}

$allRows = New-Object System.Collections.Generic.List[object]
$rowsByBatch = @{}
foreach ($manifestFile in $manifestFiles) {
    $rows = @(Get-ManifestRows -ManifestPath $manifestFile.FullName -RootPath $rootPath -Failures $failures)
    $batch = Split-Path -Leaf (Split-Path -Parent $manifestFile.FullName)
    $rowsByBatch[$batch] = $rows

    foreach ($row in $rows) {
        [void]$allRows.Add($row)
        $durableFullPath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $row.DurablePath))
        $rootPrefix = $rootPath.TrimEnd('\') + '\'
        if (-not $durableFullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Add-Failure $failures "Durable path escapes repository root: $($row.DurablePath)"
            continue
        }
        if (-not (Test-Path -LiteralPath $durableFullPath -PathType Leaf)) {
            Add-Failure $failures "Missing durable manifest file: $($row.DurablePath)"
            continue
        }

        $actualHash = (Get-FileHash -LiteralPath $durableFullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $expectedDurableHash = if ($null -ne $row.DurableSha256) { $row.DurableSha256 } else { $row.Sha256 }
        if ($actualHash -ne $expectedDurableHash) {
            Add-Failure $failures "Durable SHA-256 mismatch for $($row.DurablePath): manifest=$expectedDurableHash actual=$actualHash"
        }
        $expectedDurableBytes = if ($null -ne $row.DurableBytes) { $row.DurableBytes } else { $row.Bytes }
        if ($null -ne $expectedDurableBytes -and (Get-Item -LiteralPath $durableFullPath).Length -ne $expectedDurableBytes) {
            Add-Failure $failures "Durable byte count mismatch for $($row.DurablePath)."
        }
    }
}

foreach ($batch in $CurrentBatches) {
    if (-not $rowsByBatch.ContainsKey($batch) -or @($rowsByBatch[$batch]).Count -eq 0) {
        Add-Failure $failures "Current report batch has no hashed manifest rows: $batch"
        continue
    }

    foreach ($row in @($rowsByBatch[$batch])) {
        if ([string]::IsNullOrWhiteSpace($row.SourcePath)) {
            Add-Failure $failures "Current batch row has no source path: $batch/$($row.File)"
            continue
        }
        if (-not $ledgerEntries.ContainsKey($row.SourcePath)) {
            Add-Failure $failures "Ledger entry missing for current source: $($row.SourcePath)"
            continue
        }

        $matches = $ledgerEntries[$row.SourcePath].ToArray()
        if ($matches.Count -ne 1) {
            Add-Failure $failures "Current source must have exactly one ledger entry: $($row.SourcePath) count=$($matches.Count)"
        }
        $ledgerEntry = $matches[$matches.Count - 1]
        if ((Normalize-RelativePath $ledgerEntry.docs_evidence_path) -ne $row.DurablePath) {
            Add-Failure $failures "Ledger durable path mismatch for $($row.SourcePath)."
        }
        if ($ledgerEntry.sha256.ToLowerInvariant() -ne $row.Sha256) {
            Add-Failure $failures "Ledger SHA-256 mismatch for $($row.SourcePath)."
        }
        if ($validOutcomes -notcontains $ledgerEntry.processed_outcome) {
            Add-Failure $failures "Invalid or missing processed outcome for $($row.SourcePath): $($ledgerEntry.processed_outcome)"
        }

        $sourceFullPath = Join-Path $rootPath $row.SourcePath
        if ($ledgerEntry.processed_outcome -eq 'kept-active-with-reason') {
            if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Leaf)) {
                Add-Failure $failures "Kept-active source is not active: $($row.SourcePath)"
            }
            if ([string]::IsNullOrWhiteSpace($ledgerEntry.keep_active_reason)) {
                Add-Failure $failures "Kept-active source has no reason: $($row.SourcePath)"
            }
        } else {
            if ($ledgerEntry.source_removed -ne 'true') {
                Add-Failure $failures "Completed source is not marked source_removed=true: $($row.SourcePath)"
            }
            if (Test-Path -LiteralPath $sourceFullPath) {
                Add-Failure $failures "Completed source still exists in active intake: $($row.SourcePath)"
            }
        }
    }
}

$requiredRouteRefs = @(
    'docs/report-intake/2026-07-10/MANIFEST.md',
    'docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-synthesis-2026-07-10.md',
    'docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-tdd-plan-2026-07-10.md',
    'wiki/runtime-mirust/reports/tinyrustlm-memory-endpoints-intake-memory-2026-07-10.md',
    'docs/report-intake/2026-07-10/MEMORYENDPOINTS-DISTRIBUTION.md',
    'docs/report-intake/2026-07-11/MANIFEST.md',
    'docs/report-intake/2026-07-11/tinyrustlm-response-quality-footprint-synthesis-2026-07-11.md',
    'docs/report-intake/2026-07-11/tinyrustlm-response-quality-footprint-tdd-plan-2026-07-11.md',
    'wiki/runtime-mirust/reports/tinyrustlm-response-quality-footprint-memory-2026-07-11.md',
    'docs/report-intake/2026-07-11/small-model-research-batch-2/MANIFEST.md',
    'docs/report-intake/2026-07-11/small-model-research-batch-2/tinyrustlm-small-model-research-synthesis-2026-07-11.md',
    'docs/report-intake/2026-07-11/small-model-research-batch-2/tinyrustlm-small-model-research-tdd-delta-2026-07-11.md',
    'wiki/runtime-mirust/reports/tinyrustlm-small-model-research-batch-2-memory-2026-07-11.md',
    'docs/report-intake/2026-07-13/dotnet-p2p-seed-host/MANIFEST.md',
    'docs/report-intake/2026-07-13/dotnet-p2p-seed-host/tinyrustlm-dotnet-p2p-seed-host-intake-synthesis-2026-07-13.md',
    'docs/report-intake/2026-07-13/dotnet-p2p-seed-host/tinyrustlm-dotnet-p2p-seed-host-intake-tdd-plan-2026-07-13.md',
    'wiki/runtime-mirust/reports/tinyrustlm-dotnet-p2p-seed-host-intake-memory-2026-07-13.md',
    'docs/report-intake/2026-07-14/dogfood-quality-campaign/MANIFEST.md',
    'docs/report-intake/2026-07-14/dogfood-quality-campaign/tinyrustlm-dogfood-quality-campaign-intake-synthesis-2026-07-14.md',
    'docs/report-intake/2026-07-14/dogfood-quality-campaign/tinyrustlm-dogfood-quality-campaign-tdd-plan-2026-07-14.md',
    'wiki/runtime-mirust/reports/tinyrustlm-dogfood-quality-campaign-intake-memory-2026-07-14.md',
    'docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/MANIFEST.md',
    'docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/tinyrustlm-turbovec-turboquant-intake-synthesis-2026-07-18.md',
    'docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/tinyrustlm-turbovec-turboquant-intake-tdd-delta-2026-07-18.md',
    'wiki/runtime-mirust/reports/tinyrustlm-turbovec-turboquant-intake-memory-2026-07-18.md',
    'docs/report-intake/2026-07-21/colibri-specialist-portfolio/MANIFEST.md',
    'docs/report-intake/2026-07-21/colibri-specialist-portfolio/tinyrustlm-colibri-specialist-portfolio-intake-synthesis-2026-07-21.md',
    'docs/report-intake/2026-07-21/colibri-specialist-portfolio/tinyrustlm-colibri-specialist-portfolio-tdd-delta-2026-07-21.md',
    'wiki/runtime-mirust/reports/tinyrustlm-colibri-specialist-portfolio-intake-memory-2026-07-21.md',
    'docs/report-intake/2026-07-21/champion-specialist-submodel-research/MANIFEST.md',
    'docs/report-intake/2026-07-21/champion-specialist-submodel-research/tinyrustlm-champion-specialist-submodel-research-intake-synthesis-2026-07-21.md',
    'docs/report-intake/2026-07-21/champion-specialist-submodel-research/tinyrustlm-champion-specialist-submodel-research-tdd-delta-2026-07-21.md',
    'wiki/runtime-mirust/reports/tinyrustlm-champion-specialist-submodel-research-intake-memory-2026-07-21.md',
    'docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md',
    'docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md',
    'docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md',
    'wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md'
)

$hotMemoryFiles = @(
    '.uai/short-term-memory.uai',
    '.uai/report-synthesis.uai',
    '.uai/test-plan.uai',
    '.uai/long-term-memory.uai',
    '.uai/intake-outcome-ledger.uai',
    '.uai/index.uai',
    '.uai/file-handoff.uai'
)

foreach ($relativePath in $hotMemoryFiles) {
    $fullPath = Join-Path $rootPath $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Add-Failure $failures "Missing hot-memory file: $relativePath"
        continue
    }

    $text = Get-Content -LiteralPath $fullPath -Raw
    foreach ($requiredRef in $requiredRouteRefs) {
        if (-not $text.Contains($requiredRef)) {
            Add-Failure $failures "$relativePath does not route to $requiredRef"
        }
    }
}

$postV10RouteRefs = @(
    'docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md',
    'docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md',
    'docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md',
    'wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md'
)
$postV10AdditionalHotMemoryFiles = @(
    'workspace.uai',
    '.uai/architecture.uai',
    '.uai/next-recursive-prompt.uai',
    '.uai/totem.uai',
    '.uai/taboo.uai',
    '.uai/operations.uai'
)
foreach ($relativePath in $postV10AdditionalHotMemoryFiles) {
    $fullPath = Join-Path $rootPath $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Add-Failure $failures "Missing post-/10 hot-memory file: $relativePath"
        continue
    }

    $text = Get-Content -LiteralPath $fullPath -Raw
    foreach ($requiredRef in $postV10RouteRefs) {
        if (-not $text.Contains($requiredRef)) {
            Add-Failure $failures "$relativePath does not route to $requiredRef"
        }
    }
}

$durableMemoryPath = Join-Path $rootPath 'wiki/runtime-mirust/reports/tinyrustlm-memory-endpoints-intake-memory-2026-07-10.md'
$longTermPath = Join-Path $rootPath '.uai/long-term-memory.uai'
if (Test-Path -LiteralPath $durableMemoryPath -PathType Leaf) {
    $durableMemoryHash = (Get-FileHash -LiteralPath $durableMemoryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $longTermText = Get-Content -LiteralPath $longTermPath -Raw
    foreach ($requiredText in @(
        'stable_id: tinyrustlm_memory_endpoints_intake_current',
        "sha256: $durableMemoryHash",
        'truth_boundary:'
    )) {
        if (-not $longTermText.Contains($requiredText)) {
            Add-Failure $failures ".uai/long-term-memory.uai is missing current pointer evidence: $requiredText"
        }
    }
}

$seedHostMemoryPath = Join-Path $rootPath 'wiki/runtime-mirust/reports/tinyrustlm-dotnet-p2p-seed-host-intake-memory-2026-07-13.md'
if (Test-Path -LiteralPath $seedHostMemoryPath -PathType Leaf) {
    $seedHostMemoryHash = (Get-FileHash -LiteralPath $seedHostMemoryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $longTermText = Get-Content -LiteralPath $longTermPath -Raw
    foreach ($requiredText in @(
        'stable_id: tinyrustlm_dotnet_p2p_seed_host_intake_current',
        "sha256: $seedHostMemoryHash",
        'truth_boundary:'
    )) {
        if (-not $longTermText.Contains($requiredText)) {
            Add-Failure $failures ".uai/long-term-memory.uai is missing seed-host intake pointer evidence: $requiredText"
        }
    }
}

$dogfoodMemoryPath = Join-Path $rootPath 'wiki/runtime-mirust/reports/tinyrustlm-dogfood-quality-campaign-intake-memory-2026-07-14.md'
if (Test-Path -LiteralPath $dogfoodMemoryPath -PathType Leaf) {
    $dogfoodMemoryHash = (Get-FileHash -LiteralPath $dogfoodMemoryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $longTermText = Get-Content -LiteralPath $longTermPath -Raw
    foreach ($requiredText in @(
        'stable_id: tinyrustlm_dogfood_quality_campaign_intake_current',
        "sha256: $dogfoodMemoryHash",
        'truth_boundary:'
    )) {
        if (-not $longTermText.Contains($requiredText)) {
            Add-Failure $failures ".uai/long-term-memory.uai is missing dogfood campaign intake pointer evidence: $requiredText"
        }
    }
}

$colibriMemoryPath = Join-Path $rootPath 'wiki/runtime-mirust/reports/tinyrustlm-colibri-specialist-portfolio-intake-memory-2026-07-21.md'
if (Test-Path -LiteralPath $colibriMemoryPath -PathType Leaf) {
    $colibriMemoryHash = (Get-FileHash -LiteralPath $colibriMemoryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $longTermText = Get-Content -LiteralPath $longTermPath -Raw
    foreach ($requiredText in @(
        'stable_id: tinyrustlm_colibri_specialist_portfolio_intake_current',
        "sha256: $colibriMemoryHash",
        'truth_boundary:'
    )) {
        if (-not $longTermText.Contains($requiredText)) {
            Add-Failure $failures ".uai/long-term-memory.uai is missing Colibri specialist portfolio pointer evidence: $requiredText"
        }
    }
}

$championSpecialistMemoryPath = Join-Path $rootPath 'wiki/runtime-mirust/reports/tinyrustlm-champion-specialist-submodel-research-intake-memory-2026-07-21.md'
if (Test-Path -LiteralPath $championSpecialistMemoryPath -PathType Leaf) {
    $championSpecialistMemoryHash = (Get-FileHash -LiteralPath $championSpecialistMemoryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $longTermText = Get-Content -LiteralPath $longTermPath -Raw
    foreach ($requiredText in @(
        'stable_id: tinyrustlm_champion_specialist_submodel_research_intake_current',
        "sha256: $championSpecialistMemoryHash",
        'truth_boundary:'
    )) {
        if (-not $longTermText.Contains($requiredText)) {
            Add-Failure $failures ".uai/long-term-memory.uai is missing champion-specialist intake pointer evidence: $requiredText"
        }
    }
}

$postV10MemoryPath = Join-Path $rootPath 'wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md'
if (Test-Path -LiteralPath $postV10MemoryPath -PathType Leaf) {
    $postV10MemoryHash = (Get-FileHash -LiteralPath $postV10MemoryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $longTermText = Get-Content -LiteralPath $longTermPath -Raw
    foreach ($requiredText in @(
        'stable_id: tinyrustlm_post_v10_native_browser_release_intake_current',
        "sha256: $postV10MemoryHash",
        'truth_boundary:'
    )) {
        if (-not $longTermText.Contains($requiredText)) {
            Add-Failure $failures ".uai/long-term-memory.uai is missing post-/10 intake pointer evidence: $requiredText"
        }
    }
} else {
    Add-Failure $failures 'Missing post-/10 native browser release durable memory.'
}

if ($rowsByBatch.ContainsKey('post-v10-native-browser-release')) {
    $postV10Rows = @($rowsByBatch['post-v10-native-browser-release'] | Sort-Object File)
    if ($postV10Rows.Count -ne 12) {
        Add-Failure $failures "Post-/10 intake must contain exactly 12 reports: actual=$($postV10Rows.Count)"
    }

    [int64]$postV10ByteCount = 0
    $postV10InventoryLines = New-Object System.Collections.Generic.List[string]
    foreach ($row in $postV10Rows) {
        if ($null -eq $row.Bytes) {
            Add-Failure $failures "Post-/10 manifest row has no byte count: $($row.File)"
            continue
        }
        $postV10ByteCount += $row.Bytes
        [void]$postV10InventoryLines.Add("$($row.Sha256)  $($row.Bytes)  $($row.File)")
    }
    if ($postV10ByteCount -ne 907733) {
        Add-Failure $failures "Post-/10 report byte total mismatch: expected=907733 actual=$postV10ByteCount"
    }

    $postV10InventoryText = ($postV10InventoryLines.ToArray() -join "`n") + "`n"
    $postV10InventoryUtf8 = New-Object System.Text.UTF8Encoding($false)
    $postV10InventoryBytes = $postV10InventoryUtf8.GetBytes($postV10InventoryText)
    $postV10Sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $postV10InventoryHash = ([System.BitConverter]::ToString(
            $postV10Sha256.ComputeHash($postV10InventoryBytes)
        )).Replace('-', '').ToLowerInvariant()
    } finally {
        $postV10Sha256.Dispose()
    }
    if ($postV10InventoryHash -ne '4f065f1d6594e9bdbd3bfb9ccdaf8d7f9c63e8d9c2ea7ff59e79caba2ba63f4b') {
        Add-Failure $failures "Post-/10 report inventory mismatch: $postV10InventoryHash"
    }
}

$postV10SynthesisPath = Join-Path $rootPath 'docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md'
if (Test-Path -LiteralPath $postV10SynthesisPath -PathType Leaf) {
    $postV10Synthesis = Get-Content -LiteralPath $postV10SynthesisPath -Raw
    foreach ($requiredText in @(
        'The Rust producer emitted',
        '28 layers',
        '16 query heads',
        '8 key/value heads',
        '151,936 model vocabulary capacity',
        '151,669 tokenizer entries',
        'Independent chunk digests do not equal one whole-file digest',
        'one explicit deterministic decision'
    )) {
        if (-not $postV10Synthesis.Contains($requiredText)) {
            Add-Failure $failures "Post-/10 synthesis is missing correction guardrail: $requiredText"
        }
    }
}

$hostedEvidencePath = Join-Path $rootPath 'docs/report-intake/2026-07-10/MEMORYENDPOINTS-DISTRIBUTION.md'
if (-not (Test-Path -LiteralPath $hostedEvidencePath -PathType Leaf)) {
    Add-Failure $failures 'Missing hosted MemoryEndpoints distribution evidence.'
} else {
    $hostedEvidence = Get-Content -LiteralPath $hostedEvidencePath -Raw
    foreach ($requiredText in @('memoryType=status', 'memoryType=handoff', 'visibleInSearch=true', 'tier isolation')) {
        if (-not $hostedEvidence.Contains($requiredText)) {
            Add-Failure $failures "Hosted distribution evidence is missing: $requiredText"
        }
    }
    if ($hostedEvidence -match '(?i)workspace\s+key|authorization:\s*bearer|x-memoryendpoints-key\s*:') {
        Add-Failure $failures 'Hosted distribution evidence contains a forbidden credential label/value surface.'
    }
}

$result = [ordered]@{
    root = $rootPath
    manifest_count = $manifestFiles.Count
    hashed_durable_row_count = $allRows.Count
    current_batches = $CurrentBatches
    active_non_placeholder_count = $activeFiles.Count
    active_entries = @($activeFiles | ForEach-Object { $_.Path })
    missing_or_mismatched_count = $failures.Count
    failures = $failures.ToArray()
}

$result | ConvertTo-Json -Depth 5

if ($failures.Count -gt 0) {
    exit 1
}
