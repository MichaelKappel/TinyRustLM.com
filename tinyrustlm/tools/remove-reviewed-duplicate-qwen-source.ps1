# Remove only the byte-identical seven-file source copy reviewed on 2026-09-12.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = 'E:\Source\Rust\TinyRustLM.com'
$reviewPath = Join-Path $repo 'artifacts\ecosystem-cleanup-20260912\duplicate-qwen-source-review.json'
$reviewHash = '11737534adab9869d9cd3295e34f1b367d0d5843b36f4ea51d0b27a6e8f06094'
$removeRoot = 'D:\LLMs\TinyRustLM\experiments\TinyRustLM-vnext-private\qwen3-source-c1899de-20260825-v1'
$retainRoot = 'D:\LLMs\TinyRustLM\sources\Qwen\Qwen3-0.6B\c1899de289a04d12100db370d81485cdf75e47ca'
$receiptPath = Join-Path $repo 'artifacts\ecosystem-cleanup-20260912\duplicate-qwen-source-retirement-receipt.json'

# Reject reparse points at the target and each ancestor before accessing data.
function Assert-Ordinary([string] $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked source rejected.' }
        if ($item -is [IO.FileInfo]) { $item = $item.Directory }
        else { $item = $item.Parent }
    }
}

# Require one direct regular file inside the explicitly named retained/retired root.
function Assert-SourceFile([string] $Root, $Record) {
    if ($Root -cnotin @($removeRoot, $retainRoot)) { throw 'Undeclared model directory.' }
    $path = [IO.Path]::GetFullPath((Join-Path $Root $Record.relativePath))
    if ([IO.Path]::GetDirectoryName($path) -cne $Root -or
        -not $path.StartsWith('D:\LLMs\TinyRustLM\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'File escaped its reviewed model directory.'
    }
    Assert-Ordinary $path
    $item = Get-Item -LiteralPath $path -Force
    if ($item.PSIsContainer -or $item.Length -ne $Record.byteLength -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Record.sha256) {
        throw "Reviewed source bytes changed: $path"
    }
}

Assert-Ordinary $PSScriptRoot
if ([IO.Path]::GetFullPath($PSScriptRoot) -cne (Join-Path $repo 'tinyrustlm\tools')) { throw 'Run the canonical script only.' }
Assert-Ordinary $reviewPath
if ((Get-FileHash -LiteralPath $reviewPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $reviewHash) { throw 'Review changed.' }
$review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
if ($review.files.Count -ne 7 -or $review.logicalBytes -ne 1519182365) { throw 'Unexpected review scope.' }
foreach ($file in $review.files) { Assert-SourceFile $retainRoot $file }
Assert-Ordinary ([IO.Path]::GetDirectoryName($removeRoot))
if (-not (Test-Path -LiteralPath $removeRoot)) {
    Write-Output 'Reviewed duplicate source is already absent; retained source verified.'
    return
}
Assert-Ordinary $removeRoot
$entries = @(Get-ChildItem -LiteralPath $removeRoot -Force)
if ($entries.Count -ne 7 -or @($entries | Where-Object PSIsContainer).Count -ne 0) { throw 'Duplicate source inventory changed.' }
foreach ($file in $review.files) { Assert-SourceFile $removeRoot $file }
if (-not $PSCmdlet.ShouldProcess($removeRoot, 'Remove exact seven-file duplicate; preserve canonical source')) { return }

# Delete direct verified files and the empty directory; never recursively follow data.
$before = [IO.DriveInfo]::new('D:\').AvailableFreeSpace
foreach ($file in $review.files) {
    Assert-SourceFile $removeRoot $file
    Remove-Item -LiteralPath (Join-Path $removeRoot $file.relativePath) -Force -ErrorAction Stop
}
if (@(Get-ChildItem -LiteralPath $removeRoot -Force).Count -ne 0) { throw 'Duplicate source is not empty.' }
Remove-Item -LiteralPath $removeRoot -Force -ErrorAction Stop
if (Test-Path -LiteralPath $removeRoot) { throw 'Duplicate remains.' }
$after = [IO.DriveInfo]::new('D:\').AvailableFreeSpace
foreach ($file in $review.files) { Assert-SourceFile $retainRoot $file }
$receipt = [ordered]@{
    schema = 'tinyrustlm.duplicate-source-retirement-receipt.v1'
    completedUtc = [DateTime]::UtcNow.ToString('o')
    reviewSha256 = $reviewHash
    removedRoot = $removeRoot
    retainedRoot = $retainRoot
    removedFiles = 7
    logicalBytes = $review.logicalBytes
    observedDriveFreeSpaceDelta = $after - $before
    freeSpaceDeltaMayIncludeConcurrentActivity = $true
}
Assert-Ordinary ([IO.Path]::GetDirectoryName($receiptPath))
$bytes = [Text.UTF8Encoding]::new($false).GetBytes(($receipt | ConvertTo-Json -Depth 4) + "`n")
$stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
finally { $stream.Dispose() }
$receipt | ConvertTo-Json -Depth 4
