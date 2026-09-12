$ErrorActionPreference = 'Stop'
$modelRoot = 'D:\LLMs\TinyRustLM'
$audit = 'E:\Source\Rust\TinyRustLM.com\artifacts\cleanup-20260912'
$plan = Get-Content -LiteralPath (Join-Path $audit 'duplicate-model-plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$verified = @{}

# Verify ordinary model files beneath the physical model store before deduplicating.
function Assert-ModelFile([string]$FilePath, [long]$Bytes, [string]$Hash) {
    $absolute = [IO.Path]::GetFullPath($FilePath)
    if (-not $absolute.StartsWith($modelRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Model path escaped designated store' }
    $item = Get-Item -LiteralPath $absolute -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $Bytes) { throw 'Model identity changed' }
    $parent = $item.Directory
    while ($parent -and $parent.FullName.Length -gt 3) {
        if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Model parent is a reparse point' }
        $parent = $parent.Parent
    }
    $key = $absolute + ':' + $item.LastWriteTimeUtc.Ticks
    if (-not $verified.ContainsKey($key)) {
        if ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash) { throw 'Model content hash changed' }
        $verified[$key] = $Hash
    }
}

foreach ($entry in $plan) {
    if ($entry.source -eq $entry.retained) { throw 'Self-deduplication forbidden' }
    Assert-ModelFile $entry.source $entry.bytes $entry.sha256
    Assert-ModelFile $entry.retained $entry.bytes $entry.sha256
    # Keep complete checkpoint filenames usable while retaining one physical payload.
    Remove-Item -LiteralPath $entry.source -Force
    $null = New-Item -ItemType HardLink -Path $entry.source -Target $entry.retained
    if ((Get-Item -LiteralPath $entry.source).Length -ne $entry.bytes) { throw 'Hardlink creation failed' }
    $entry | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $audit 'duplicate-model-receipts.jsonl') -Encoding UTF8
    Write-Output "Deduplicated $($entry.bytes) model bytes"
}
