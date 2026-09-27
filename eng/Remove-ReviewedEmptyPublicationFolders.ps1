# Removes only the reviewed empty directories after owner execution; defaults to preview.
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$repo = 'E:\Source\Rust\TinyRustLM.com'
$base = Join-Path $repo 'artifacts\verification\web-deployments'
$receipt = Join-Path $repo 'artifacts\ecosystem-cleanup-20260912\publication-checkpoint-review.json'
if ((Get-FileHash -LiteralPath $receipt -Algorithm SHA256).Hash.ToLowerInvariant() -ne
    '95659286fe9c93063ac46ee71f0e6515cf5961fe42cfc8b5ceb568b9c20b6a5f') {
    throw 'Reviewed directory list changed.'
}
$review = Get-Content -LiteralPath $receipt -Raw | ConvertFrom-Json
$paths = @($review.remainingEmptyDirectories | ForEach-Object {
    $resolved = [IO.Path]::GetFullPath((Join-Path $repo $_))
    if (-not $resolved.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Directory is outside the reviewed publication scratch.'
    }
    $resolved
})
if ($paths.Count -ne 32 -or @($paths | Sort-Object -Unique).Count -ne 32) {
    throw 'Reviewed directory count changed.'
}
# Preflight every path and its ancestry before any removal; never follow reparse points.
foreach ($path in $paths) {
    $cursor = $path
    while ($cursor -and $cursor.Length -ge $repo.Length) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw 'Reviewed directory or ancestor became a file or reparse point.'
            }
        }
        $cursor = Split-Path -Parent $cursor
    }
    if (Test-Path -LiteralPath $path) {
        foreach ($child in Get-ChildItem -LiteralPath $path -Force) {
            if (-not $child.PSIsContainer -or
                ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                $child.FullName -notin $paths) {
                throw 'Reviewed directory contains new or unreviewed content.'
            }
        }
    }
}
$removed = 0; $absent = 0
foreach ($path in ($paths | Sort-Object { $_.Length } -Descending)) {
    if (-not (Test-Path -LiteralPath $path)) { $absent++; continue }
    if ($Apply) {
        $item = Get-Item -LiteralPath $path -Force
        if (-not $item.FullName.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase) -or
            ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            @(Get-ChildItem -LiteralPath $path -Force).Count -ne 0) {
            throw 'Directory changed or is not empty.'
        }
        # Empty directories only: no recursive deletion, ACL changes, or file removal.
        Remove-Item -LiteralPath $path -Force
        if (Test-Path -LiteralPath $path) { throw 'Directory removal could not be verified.' }
        $removed++
    }
}
[pscustomobject]@{
    mode = if ($Apply) { 'apply' } else { 'preview' }
    reviewedDirectories = $paths.Count
    removedDirectories = $removed
    alreadyAbsent = $absent
    filesRemoved = 0
    published = $false
} | ConvertTo-Json
