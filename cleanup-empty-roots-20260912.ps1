$ErrorActionPreference = 'Stop'
$canonical = 'E:\Source\Rust\TinyRustLM.com'
$audit = Join-Path $canonical 'artifacts\cleanup-20260912'
$roots = Get-Content -LiteralPath (Join-Path $audit 'retirement-roots.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$receipts = Join-Path $audit 'directory-receipts.jsonl'

# Remove only junction entries and directories independently confirmed empty.
function Remove-ReviewedEmptyTree([string]$Directory, [string]$Boundary) {
    $absolute = [IO.Path]::GetFullPath($Directory)
    if ($absolute -ne $Boundary -and -not $absolute.StartsWith($Boundary + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Directory escaped reviewed boundary' }
    $item = Get-Item -LiteralPath $absolute -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        if ($item.PSIsContainer) { [IO.Directory]::Delete($absolute) } else { Remove-Item -LiteralPath $absolute -Force }
        [pscustomobject]@{action='removed-link-only';path=$absolute;target=$item.Target} | ConvertTo-Json -Compress | Add-Content -LiteralPath $receipts -Encoding UTF8
        return
    }
    foreach ($child in @(Get-ChildItem -LiteralPath $absolute -Force)) {
        if ($child.PSIsContainer -or ($child.Attributes -band [IO.FileAttributes]::ReparsePoint)) { Remove-ReviewedEmptyTree $child.FullName $Boundary }
    }
    if (@(Get-ChildItem -LiteralPath $absolute -Force).Count -eq 0) {
        [IO.Directory]::Delete($absolute)
        [pscustomobject]@{action='removed-empty-directory';path=$absolute} | ConvertTo-Json -Compress | Add-Content -LiteralPath $receipts -Encoding UTF8
    }
}

foreach ($root in $roots) {
    $absolute = [IO.Path]::GetFullPath($root)
    if (-not $absolute.StartsWith('E:\', [StringComparison]::OrdinalIgnoreCase) -or $absolute -eq $canonical -or $absolute -eq 'E:\Source\Rust\TinyRustLM.MiRust.com' -or -not ([IO.Path]::GetFileName($absolute) -match '(?i)tinyrustlm')) { throw "Invalid reviewed root: $absolute" }
    if (Test-Path -LiteralPath $absolute) { Remove-ReviewedEmptyTree $absolute $absolute }
}
$link = 'E:\Source\.generated-junction-quarantine\tinyrustlm-target-20260812'
if (Test-Path -LiteralPath $link) {
    $item = Get-Item -LiteralPath $link -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Expected old build junction' }
    [IO.Directory]::Delete($link)
}
$remaining = @($roots | Where-Object { Test-Path -LiteralPath $_ })
$oldModelStore = 'C:\Users\AI\External\TinyRustLM-models'
if (Test-Path -LiteralPath $oldModelStore) { Remove-ReviewedEmptyTree $oldModelStore $oldModelStore }
Write-Output "Reviewed roots still present: $($remaining.Count)"
$remaining | Write-Output
