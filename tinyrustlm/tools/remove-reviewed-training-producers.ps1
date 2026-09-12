#Requires -Version 5.1
# Owner-run retirement of 26 exact source/control files whose tool deletion was blocked.
# -WhatIf verifies remaining bytes and retained Git identities without any mutation.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = 'E:\Source\Rust\TinyRustLM.com'
$reviewPath = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912\retired-training-producers-review.json'
$reviewHash = '34dfbc3a7523ceeeecea5e96eec4b454f9daa074ad25d3e6e27dfb4826589efa'
$receiptPath = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912\retired-training-producers-receipt.json'

# Inspect the leaf even when it is a dangling link, and reject all linked ancestors.
function Get-DirectItem([string]$LiteralPath) {
    $absolute = [IO.Path]::GetFullPath($LiteralPath)
    $cursor = $absolute
    $leaf = $null
    while (-not [string]::IsNullOrEmpty($cursor)) {
        try {
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Retirement path crosses a link or reparse point.'
            }
            if ($cursor -ceq $absolute) { $leaf = $item }
        }
        catch [System.Management.Automation.ItemNotFoundException] {
            # An absent ordinary component is permitted only for idempotent verification.
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    return $leaf
}

# Return a remaining exact file only after containment, ancestry, size and hash checks.
function Get-ReviewedTarget([object]$Row) {
    $relative = [string]$Row.path
    if ($relative -notmatch '^tinyrustlm/(tools|training)/[A-Za-z0-9._/-]+$' -or
        @($relative.Split('/') | Where-Object { $_ -in @('', '.', '..') }).Count -ne 0) {
        throw 'Invalid reviewed relative path.'
    }
    $absolute = [IO.Path]::GetFullPath((Join-Path $repository $relative))
    if (-not $absolute.StartsWith($repository + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Retirement target escaped the canonical repository.'
    }
    $item = Get-DirectItem $absolute
    if ($null -eq $item) { return $null }
    if ($item -isnot [IO.FileInfo] -or $item.Length -ne [long]$Row.bytes -or
        (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.sha256) {
        throw "Reviewed file changed: $relative"
    }
    return $absolute
}

if ($PSScriptRoot -cne (Join-Path $repository 'tinyrustlm\tools')) { throw 'Run the canonical script only.' }
$reviewItem = Get-DirectItem $reviewPath
if ($reviewItem -isnot [IO.FileInfo] -or $reviewItem.Length -gt 131072 -or
    (Get-FileHash -LiteralPath $reviewPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $reviewHash) {
    throw 'Retirement review identity changed.'
}
$review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
if ($review.schema -cne 'tinyrustlm.retired-training-producers-review.v1' -or
    $review.canonicalRoot -cne $repository -or $review.fileCount -ne 26 -or $review.files.Count -ne 26 -or
    $review.retainedCommit -cne '33483be8ebdfb98b8f0ab58ed7e168da970fe523') { throw 'Unexpected reviewed scope.' }
$pending = [Collections.Generic.List[object]]::new()
$names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($row in $review.files) {
    if (-not $names.Add([string]$row.path)) { throw 'Duplicate retirement target.' }
    $target = Get-ReviewedTarget $row
    $objectName = $review.retainedCommit + ':' + $row.path
    $blob = & git -c safe.directory=E:/Source/Rust/TinyRustLM.com -C $repository rev-parse --verify $objectName
    if ($LASTEXITCODE -ne 0 -or [string]$blob -cne $row.retainedGitBlob) { throw 'Retained Git object is unavailable.' }
    if ($null -ne $target) { $pending.Add($row) }
}

$deleted = [Collections.Generic.List[string]]::new()
foreach ($row in $pending) {
    if ($PSCmdlet.ShouldProcess([string]$row.path, 'Remove reviewed obsolete training source/control')) {
        $target = Get-ReviewedTarget $row
        if ($null -eq $target) { continue }
        Remove-Item -LiteralPath $target -Force -ErrorAction Stop
        if ($null -ne (Get-DirectItem $target)) { throw 'Retired file remains.' }
        $deleted.Add([string]$row.path)
    }
}
if ($WhatIfPreference) {
    Write-Output "Validated $($pending.Count) remaining training source/control files; no changes made."
    return
}
foreach ($row in $review.files) {
    if ($null -ne (Get-ReviewedTarget $row)) { throw 'Training producer retirement is incomplete.' }
}
$null = Get-DirectItem $receiptPath
$receipt = [ordered]@{
    schema = 'tinyrustlm.retired-training-producers-receipt.v1'
    observedUtc = [DateTime]::UtcNow.ToString('o')
    reviewSha256 = $reviewHash
    deletedThisRun = $deleted.Count
    alreadyAbsent = 26 - $pending.Count
    remaining = 0
    deletedPaths = @($deleted)
    measuredStorageRecovery = $null
}
$bytes = [Text.UTF8Encoding]::new($false).GetBytes((($receipt | ConvertTo-Json -Depth 4) -replace "`r`n", "`n") + "`n")
$stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
finally { $stream.Dispose() }
Write-Output "All 26 reviewed training source/control files are absent. Receipt: $receiptPath"
