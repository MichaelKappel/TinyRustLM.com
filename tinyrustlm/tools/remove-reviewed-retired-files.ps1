#Requires -Version 5.1
<#
.SYNOPSIS
Remove ten exact reviewed obsolete files after automatic tool deletion was blocked.
.DESCRIPTION
Validates every remaining path, ancestor, length and hash before deleting anything.
Scope: eight closed LMComposer stage files and TinyRustLM's disconnected old
announcement reader/test. Does not touch Runtime docs, models, or other files.
Use -WhatIf to inspect the complete preflight without writing or deleting anything.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = 'E:\Source\Rust\TinyRustLM.com'
$evidence = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912'
$manifestPath = Join-Path $evidence 'pending-file-retirements.json'
$receiptPath = Join-Path $evidence 'pending-file-retirements-receipt.json'
$manifestHash = '1A1205236BA881F2C25D2964876540CE3F0653F86A3579E5C791EEB1F9CE0922'
$stage = 'E:\Source\Rust\LMComposer.com\deploy\staging\1.0.0'
$exactTinyRustFiles = @(
    'E:\Source\Rust\TinyRustLM.com\tinyrustlm\app\minimodel-announcement.js',
    'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tests\minimodel-announcement.test.js'
)

# Check every existing ancestor, including when a prior run removed the leaf.
function Assert-DirectAncestry([string]$LiteralPath) {
    $current = [IO.Path]::GetFullPath($LiteralPath)
    while (-not (Test-Path -LiteralPath $current)) {
        $current = [IO.Path]::GetDirectoryName($current)
        if ([string]::IsNullOrEmpty($current)) { throw 'Path ancestry is unavailable.' }
    }
    $item = Get-Item -LiteralPath $current -Force
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Linked ancestry is outside the reviewed cleanup scope.'
        }
        if ($item -is [IO.DirectoryInfo]) { $item = $item.Parent }
        else { $item = $item.Directory }
    }
}

# Return whether one exact reviewed file remains; changed files always stop the run.
function Test-ReviewedFile([object]$Row) {
    $absolute = [IO.Path]::GetFullPath([string]$Row.path)
    if ($absolute -cne [string]$Row.path -or
        (-not $absolute.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase) -and
         $exactTinyRustFiles -cnotcontains $absolute)) { throw 'Target is outside the reviewed scope.' }
    Assert-DirectAncestry $absolute
    if (-not (Test-Path -LiteralPath $absolute)) { return $false }
    $item = Get-Item -LiteralPath $absolute -Force
    if ($item.PSIsContainer -or $item.Length -ne [long]$Row.bytes -or
        (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash -ine $Row.sha256) {
        throw "Reviewed bytes changed; no permission to delete them: $absolute"
    }
    return $true
}

if ($PSScriptRoot -cne (Join-Path $repository 'tinyrustlm\tools')) { throw 'Run the canonical script.' }
Assert-DirectAncestry $manifestPath
if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -cne $manifestHash) {
    throw 'Reviewed inventory identity changed.'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schema -cne 'tinyrustlm.reviewed-file-retirements/1' -or
    $manifest.reviewedCount -ne 10 -or $manifest.files.Count -ne 10) { throw 'Unexpected review inventory.' }
$named = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$pending = [Collections.Generic.List[object]]::new()
foreach ($row in $manifest.files) {
    if (-not $named.Add([string]$row.path)) { throw 'Duplicate reviewed target.' }
    if (Test-ReviewedFile $row) { $pending.Add($row) }
}

$freeBefore = (Get-PSDrive -Name E).Free
$deleted = [Collections.Generic.List[string]]::new()
$logicalBytes = [long]0
foreach ($row in $pending) {
    if ($PSCmdlet.ShouldProcess([string]$row.path, [string]$row.reason)) {
        if (-not (Test-ReviewedFile $row)) { continue }
        Remove-Item -LiteralPath ([string]$row.path) -Force -ErrorAction Stop
        if (Test-Path -LiteralPath ([string]$row.path)) { throw 'A deleted file remains.' }
        $deleted.Add([string]$row.path)
        $logicalBytes += [long]$row.bytes
    }
}
if ($WhatIfPreference) {
    Write-Output "Validated $($pending.Count) remaining reviewed files. No changes made."
    return
}
# Remove only these two explicitly named stage directories if completely empty.
foreach ($directory in @((Join-Path $stage '.well-known'), $stage)) {
    Assert-DirectAncestry $directory
    if ((Test-Path -LiteralPath $directory) -and @(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) {
        [IO.Directory]::Delete($directory)
    }
}
$remaining = @($manifest.files | Where-Object { Test-Path -LiteralPath ([string]$_.path) })
Assert-DirectAncestry $receiptPath
$freeAfter = (Get-PSDrive -Name E).Free
$receipt = [ordered]@{
    schema = 'tinyrustlm.reviewed-file-retirement-receipt/1'
    verified_utc = [DateTime]::UtcNow.ToString('o')
    inventory_sha256 = $manifestHash.ToLowerInvariant()
    deleted_this_run = $deleted.Count
    already_absent_before_run = 10 - $pending.Count
    remaining = $remaining.Count
    deleted_paths = @($deleted)
    logical_bytes_deleted = $logicalBytes
    volume_free_bytes_before = $freeBefore
    volume_free_bytes_after = $freeAfter
    observed_volume_free_byte_change = $freeAfter - $freeBefore
    observation_note = 'Volume free-space change is an observation; concurrent activity can affect it.'
}
[IO.File]::WriteAllText($receiptPath, (($receipt | ConvertTo-Json -Depth 4) + "`n"), [Text.UTF8Encoding]::new($false))
if ($remaining.Count -ne 0) { throw 'Some reviewed files remain; see the receipt.' }
Write-Output "Removed $($deleted.Count) reviewed files; all ten targets are absent. Receipt: $receiptPath"
