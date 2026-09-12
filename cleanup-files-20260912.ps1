param([ValidateSet('preserve','delete','delete-tools')][string]$Phase = 'preserve', [ValidateSet('file-plan.json','model-store-plan.json','loose-plan.json','generated-package-plan.json')][string]$PlanFile = 'file-plan.json')
$ErrorActionPreference = 'Stop'
$canonical = 'E:\Source\Rust\TinyRustLM.com'
$modelRoot = 'D:\LLMs\TinyRustLM'
$audit = Join-Path $canonical 'artifacts\cleanup-20260912'
$plan = Get-Content -LiteralPath (Join-Path $audit $PlanFile) -Raw -Encoding UTF8 | ConvertFrom-Json
$roots = Get-Content -LiteralPath (Join-Path $audit 'retirement-roots.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$receipts = Join-Path $audit ("file-receipts-$PlanFile-$Phase.jsonl")

# Require direct physical parents so deletion never crosses a junction boundary.
function Assert-DirectPath([string]$FilePath) {
    $parent = Split-Path -Parent $FilePath
    while ($parent -and $parent.Length -gt 3) {
        $item = Get-Item -LiteralPath $parent -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse parent: $parent" }
        $parent = Split-Path -Parent $parent
    }
}

# Write a durable result for each individually checked file operation.
function Write-Receipt($Entry, [string]$Result, [string]$Hash, [string]$Destination) {
    [pscustomobject]@{source=$Entry.source;action=$Entry.action;result=$Result;bytes=$Entry.bytes;sha256=$Hash;destination=$Destination;reason=$Entry.reason;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress | Add-Content -LiteralPath $receipts -Encoding UTF8
}

if ($Phase -eq 'delete' -and -not (Test-Path -LiteralPath (Join-Path $audit 'preservation-complete.json'))) { throw 'Preservation must complete before deleting disposable files' }
if ($Phase -eq 'delete-tools') {
    $recovery = Get-Content -LiteralPath (Join-Path $audit 'recovered-code.json') -Raw | ConvertFrom-Json
    git -c safe.directory=E:/Source/Rust/TinyRustLM.com -C $canonical cat-file -e $recovery.commit
    if ($LASTEXITCODE -ne 0) { throw 'Unique tools source has not been preserved in Git' }
    $active = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like 'E:\TinyRustLM-vnext-tools\*' }
    if ($active) { throw 'A process is running from the tools directory' }
}
$done = 0
foreach ($entry in $plan) {
    if ($Phase -eq 'delete-tools' -and ($entry.action -ne 'delete' -or -not $entry.source.StartsWith('E:\TinyRustLM-vnext-tools\', [StringComparison]::OrdinalIgnoreCase))) { continue }
    if ($Phase -eq 'delete' -and $entry.source.StartsWith('E:\TinyRustLM-vnext-tools\', [StringComparison]::OrdinalIgnoreCase)) { continue }
    if (($Phase -eq 'preserve' -and $entry.action -eq 'delete') -or ($Phase -eq 'delete' -and $entry.action -ne 'delete')) { continue }
    $source = [IO.Path]::GetFullPath($entry.source)
    $allowed = $false
    foreach ($bound in $roots) { if ($source.StartsWith($bound + '\', [StringComparison]::OrdinalIgnoreCase)) { $allowed = $true; break } }
    if ($source.StartsWith($canonical + '\artifacts\', [StringComparison]::OrdinalIgnoreCase) -and ($entry.action -eq 'model' -or $entry.reason -like 'Superseded model/*' -or $entry.reason -like 'Reproducible raw tensor*')) { $allowed = $true }
    if ($PlanFile -eq 'model-store-plan.json' -and $entry.action -eq 'model' -and $source.StartsWith('C:\Users\AI\External\TinyRustLM-models\', [StringComparison]::OrdinalIgnoreCase)) { $allowed = $true }
    if ($PlanFile -eq 'loose-plan.json' -and (Split-Path -Parent $source) -in @('E:\Source\.codex-tmp','E:\Source\_audit-local-screens') -and [IO.Path]::GetFileName($source).StartsWith('tinyrustlm', [StringComparison]::OrdinalIgnoreCase)) { $allowed = $true }
    if ($PlanFile -eq 'generated-package-plan.json' -and $entry.action -eq 'delete' -and $source.StartsWith($canonical + '\artifacts\', [StringComparison]::OrdinalIgnoreCase) -and $source -match '\.(zip|tar|gz|tgz|nupkg|snupkg|7z)$') { $allowed = $true }
    if (-not $allowed) { throw "Unapproved source: $source" }
    if (-not (Test-Path -LiteralPath $source)) {
        if ($entry.action -ne 'delete') {
            if (-not (Test-Path -LiteralPath $entry.destination) -or (Get-Item -LiteralPath $entry.destination).Length -ne $entry.bytes) { throw "Missing preserved destination: $($entry.destination)" }
            Write-Receipt $entry 'previously-preserved-destination-rechecked' (Get-FileHash -LiteralPath $entry.destination -Algorithm SHA256).Hash.ToLowerInvariant() $entry.destination
        }
        continue
    }
    Assert-DirectPath $source
    $item = Get-Item -LiteralPath $source -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not an ordinary file: $source" }
    if ($item.Length -ne $entry.bytes) { throw "File changed since inventory: $source" }
    if ($entry.action -eq 'delete') {
        # No recursive deletion; only the reviewed ordinary file can be removed.
        Remove-Item -LiteralPath $source -Force
        Write-Receipt $entry 'deleted-reviewed-disposable-file' '' ''
    } else {
        $destination = [IO.Path]::GetFullPath($entry.destination)
        $boundary = if ($entry.action -eq 'model') { $modelRoot } else { Join-Path $canonical 'artifacts\retained-evidence' }
        if (-not $destination.StartsWith($boundary + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Destination outside assigned root: $destination" }
        $null = New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force
        Assert-DirectPath $destination
        $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
        if (Test-Path -LiteralPath $destination) {
            if ((Get-Item -LiteralPath $destination).Length -ne $item.Length -or (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw "Conflicting destination: $destination" }
        } else {
            Copy-Item -LiteralPath $source -Destination $destination
            if ((Get-Item -LiteralPath $destination).Length -ne $item.Length -or (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw "Preservation verification failed: $destination" }
        }
        # Removal follows independent SHA-256 and byte-count verification.
        Remove-Item -LiteralPath $source -Force
        Write-Receipt $entry 'preserved-and-source-removed' $hash $destination
    }
    $done++
    if ($done % 500 -eq 0) { Write-Output "$Phase processed $done files" }
}
if ($Phase -eq 'preserve') { [pscustomobject]@{phase=$Phase;processed=$done;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $audit 'preservation-complete.json') }
Write-Output "$Phase completed: $done files"
