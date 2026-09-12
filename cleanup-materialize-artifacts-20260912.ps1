$ErrorActionPreference = 'Stop'
$canonical = 'E:\Source\Rust\TinyRustLM.com'
$evidence = 'E:\Source\.tinyrustlm-evidence\'
$audit = Join-Path $canonical 'artifacts\cleanup-20260912'
$moves = Get-Content -LiteralPath (Join-Path $audit 'junction-moves.json') -Raw | ConvertFrom-Json
# Validate every source and destination before replacing any junction.
foreach ($move in $moves) {
    $source = [IO.Path]::GetFullPath($move.source)
    $destination = [IO.Path]::GetFullPath($move.destination)
    if (-not $source.StartsWith($evidence, [StringComparison]::OrdinalIgnoreCase)) { throw "Source outside reviewed evidence: $source" }
    if (-not $destination.StartsWith($canonical + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Destination outside canonical root: $destination" }
    $item = Get-Item -LiteralPath $destination -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Expected junction: $destination" }
    if ([IO.Path]::GetFullPath($item.Target[0]) -ne $source) { throw "Junction target changed: $destination" }
    $sourceItem = Get-Item -LiteralPath $source -Force
    if ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Source itself is a junction: $source" }
}
foreach ($move in $moves) {
    # Nonrecursive Directory.Delete removes the junction itself, never its target.
    [IO.Directory]::Delete($move.destination)
    Move-Item -LiteralPath $move.source -Destination $move.destination
    if ((Get-Item -LiteralPath $move.destination -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Materialization failed' }
    [pscustomobject]@{ action='materialized'; source=$move.source; destination=$move.destination; utc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $audit 'mutation-receipts.jsonl')
}
Write-Output "Materialized $($moves.Count) artifact directories within the canonical repository."
