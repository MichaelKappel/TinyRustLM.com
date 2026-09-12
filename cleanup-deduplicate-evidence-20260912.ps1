$ErrorActionPreference = 'Stop'
$root = 'E:\Source\Rust\TinyRustLM.com'
$audit = Join-Path $root 'artifacts\cleanup-20260912'
$plan = Get-Content -LiteralPath (Join-Path $audit 'duplicate-evidence-plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
# Delete only byte-identical receipts whose surviving counterpart is verified now.
foreach ($entry in $plan) {
    $source = [IO.Path]::GetFullPath($entry.source)
    $retained = [IO.Path]::GetFullPath($entry.retained)
    if (-not $source.StartsWith($root + '\artifacts\retained-evidence\', [StringComparison]::OrdinalIgnoreCase) -or -not $retained.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or $source -eq $retained) { throw 'Invalid evidence deduplication boundary' }
    if (-not (Test-Path -LiteralPath $source)) { continue }
    foreach ($file in @($source,$retained)) {
        $item = Get-Item -LiteralPath $file -Force
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $entry.bytes) { throw "Evidence identity changed: $file" }
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Evidence hash changed: $file" }
    }
    Remove-Item -LiteralPath $source -Force
    $entry | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $audit 'duplicate-evidence-receipts.jsonl') -Encoding UTF8
}
Write-Output "Verified and removed $($plan.Count) duplicate evidence files."
