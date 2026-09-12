# Removes only the eight completed checkpoint copies bound by the cleanup review.
# Run manually after reviewing -WhatIf. Final adapters and raw screens stay intact.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = 'E:\Source\Rust\TinyRustLM.com'
$modelRoot = 'D:\LLMs\TinyRustLM'
$inventoryPath = Join-Path $repo 'artifacts\ecosystem-cleanup-20260912\historical-training-review.json'
$inventorySha256 = '65145da24d5bdafb8eab22e4c81e0161bdaf1c651fbfa157d378056f8f12b5b5'
$receiptPath = Join-Path $repo 'artifacts\ecosystem-cleanup-20260912\historical-training-retirement-receipt.json'
$allowed = @(
    'qwen3-cognitive-liberty-v1\adapter-cpu-pilot-v1\checkpoint-12'
    'qwen3-cognitive-liberty-v2\adapter-cpu-pilot-v1\checkpoint-10'
    'qwen3-cognitive-liberty-v2\adapter-cpu-preservation-pilot-v2\checkpoint-10'
    'qwen3-cognitive-liberty-v2\adapter-cpu-preservation-pilot-v3\checkpoint-30'
    'qwen3-cognitive-liberty-v3\adapter-cpu-pilot-v1\checkpoint-25'
    'qwen3-cognitive-liberty-v3\adapter-cpu-pilot-v2\checkpoint-25'
    'smollm2-cognitive-liberty-v1\adapter-cpu-pilot-v1\checkpoint-25'
    'smollm2-cognitive-liberty-v1\adapter-cpu-pilot-v2\checkpoint-25'
)

# Reject links at every existing ancestor before reading or removing local data.
function Assert-OrdinaryPath([string] $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse path rejected: $($item.FullName)"
        }
        if ($item -is [IO.FileInfo]) { $item = $item.Directory }
        else { $item = $item.Parent }
    }
}

# Require the exact size and digest recorded before retirement was requested.
function Assert-FileIdentity($Record) {
    Assert-OrdinaryPath $Record.path
    $item = Get-Item -LiteralPath $Record.path -Force
    if ($item.PSIsContainer -or $item.Length -ne $Record.byteLength -or
        (Get-FileHash -LiteralPath $Record.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Record.sha256) {
        throw "Reviewed file changed: $($Record.path)"
    }
}

Assert-OrdinaryPath $PSScriptRoot
if ([IO.Path]::GetFullPath($PSScriptRoot) -cne (Join-Path $repo 'tinyrustlm\tools')) {
    throw 'Run the canonical script only.'
}
Assert-OrdinaryPath $inventoryPath
Assert-OrdinaryPath $modelRoot
if ((Get-FileHash -LiteralPath $inventoryPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $inventorySha256) {
    throw 'Cleanup inventory changed.'
}
$review = Get-Content -LiteralPath $inventoryPath -Raw | ConvertFrom-Json
if ($review.runs.Count -ne 8 -or $review.checkpointFileCount -ne 64 -or
    $review.checkpointLogicalBytes -ne 322367608) { throw 'Unexpected review scope.' }
$pending = [Collections.Generic.List[object]]::new()
$absent = [Collections.Generic.List[string]]::new()

# Preflight the complete batch before the first removal, including retained finals.
foreach ($run in $review.runs) {
    $target = [IO.Path]::GetFullPath($run.checkpoint.path)
    if (-not $target.StartsWith($modelRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
        $target.Substring($modelRoot.Length + 1) -cnotin $allowed) {
        throw 'Checkpoint is outside the exact reviewed scope.'
    }
    Assert-OrdinaryPath ([IO.Path]::GetDirectoryName($target))
    foreach ($file in @($run.finalWeights, $run.finalConfig, $run.trainingReceipt)) {
        Assert-FileIdentity $file
    }
    if (-not (Test-Path -LiteralPath $target)) { $absent.Add($target); continue }
    Assert-OrdinaryPath $target
    $actual = @(Get-ChildItem -LiteralPath $target -Force)
    if ($actual.Count -ne 8 -or @($actual | Where-Object PSIsContainer).Count -ne 0) {
        throw "Checkpoint inventory changed: $target"
    }
    foreach ($file in $run.checkpoint.files) {
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($file.path)) -cne $target) {
            throw 'Reviewed file escaped its checkpoint.'
        }
        Assert-FileIdentity $file
    }
    $pending.Add($run)
}

if ($pending.Count -eq 0) {
    Write-Output 'All eight reviewed checkpoint directories are already absent; final outputs verified.'
    return
}
if (-not $PSCmdlet.ShouldProcess(($pending | ForEach-Object { $_.checkpoint.path }) -join ', ',
    'Remove exact reviewed completed checkpoints, preserving final outputs')) { return }

# Remove direct files, then empty directories. Never recurse or follow a link.
$removedFiles = [Collections.Generic.List[string]]::new()
$removedDirectories = [Collections.Generic.List[string]]::new()
$removedBytes = [long] 0
foreach ($run in $pending) {
    foreach ($file in $run.checkpoint.files) {
        Assert-FileIdentity $file
        Remove-Item -LiteralPath $file.path -Force -ErrorAction Stop
        if (Test-Path -LiteralPath $file.path) { throw 'Reviewed file remains.' }
        $removedFiles.Add($file.path)
        $removedBytes += $file.byteLength
    }
    if (@(Get-ChildItem -LiteralPath $run.checkpoint.path -Force).Count -ne 0) {
        throw 'Checkpoint is not empty.'
    }
    Remove-Item -LiteralPath $run.checkpoint.path -Force -ErrorAction Stop
    $removedDirectories.Add($run.checkpoint.path)
}
foreach ($run in $review.runs) {
    if (Test-Path -LiteralPath $run.checkpoint.path) { throw 'Checkpoint remains.' }
    Assert-FileIdentity $run.finalWeights
    Assert-FileIdentity $run.finalConfig
}
$receipt = [ordered]@{
    schema = 'tinyrustlm.reviewed-checkpoint-retirement.v1'
    completedUtc = [DateTime]::UtcNow.ToString('o')
    inventorySha256 = $inventorySha256
    removedFileCount = $removedFiles.Count
    removedLogicalBytes = $removedBytes
    removedDirectories = @($removedDirectories.ToArray())
    alreadyAbsentDirectories = @($absent.ToArray())
    finalOutputsRetained = $true
    recoveredStorageMeasured = $false
}
Assert-OrdinaryPath ([IO.Path]::GetDirectoryName($receiptPath))
$receiptBytes = [Text.UTF8Encoding]::new($false).GetBytes(($receipt | ConvertTo-Json -Depth 6) + "`n")
$stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $stream.Write($receiptBytes, 0, $receiptBytes.Length); $stream.Flush($true) }
finally { $stream.Dispose() }
$receipt | ConvertTo-Json -Depth 6
