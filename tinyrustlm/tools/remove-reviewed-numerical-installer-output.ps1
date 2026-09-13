#Requires -Version 5.1
# Owner-run cleanup after automatic approval review rejected these removals.
# -WhatIf verifies the complete inventory without deleting or writing a receipt.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = 'E:\Source\Rust\TinyRustLM.com'
$root = Join-Path $repository 'artifacts\verification\qwen3-environment-install\tinyrustlm-operation-C3ZUt9'
$expectedInventory = 'df225a1d0b64260e6d7cb5cbbd9068c46a8f674bbe8b4de6244738d53be97be0'
$expectedMarker = 'd00e2e7b22c64692521b97496a4c5b49bf35a2b3e63e062747aa22a8ed159472'
$receipt = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912\numerical-installer-cleanup-receipt.json'
$expectedLinks = @{
    'install-temp/TmP6xn2evdh-b' = (Join-Path $root 'install-temp\TmP6xn2evdh')
    'install-temp/TmPeq63_hr7-b' = (Join-Path $root 'install-temp\TmPeq63_hr7')
}

# Hash the exact sorted inventory encoding used by the reviewed Python observation.
function Get-InventoryDigest([string[]]$Lines) {
    $ordered = [string[]]$Lines.Clone()
    [Array]::Sort($ordered, [StringComparer]::Ordinal)
    $bytes = [Text.Encoding]::UTF8.GetBytes(([string]::Join("`n", $ordered) + "`n"))
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}

# Require ordinary ancestors and the original marked operation under canonical artifacts.
function Assert-InstallerRoot {
    if ($PSScriptRoot -cne (Join-Path $repository 'tinyrustlm\tools') -or
        [IO.Path]::GetFullPath($root) -cne $root -or
        (Resolve-Path -LiteralPath $root).Path -cne $root) { throw 'Cleanup location changed.' }
    $cursor = Get-Item -LiteralPath $root -Force
    while ($null -ne $cursor) {
        if ($cursor -isnot [IO.DirectoryInfo] -or ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Linked or non-directory cleanup ancestry.'
        }
        $cursor = $cursor.Parent
    }
    $marker = Get-Item -LiteralPath (Join-Path $root '.tinyrustlm-operation-owner.v1') -Force
    if ($marker.PSIsContainer -or $marker.Length -ne 65 -or
        ($marker.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        (Get-FileHash -LiteralPath $marker.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedMarker) {
        throw 'Installer ownership marker changed.'
    }
}

# Inventory every ordinary file and directory without following either reviewed link.
function Get-InstallerInventory {
    Assert-InstallerRoot
    $pending = New-Object 'System.Collections.Generic.Stack[string]'
    $pending.Push($root)
    $lines = New-Object 'System.Collections.Generic.List[string]'
    $files = 0
    $directories = 0
    $links = 0
    $bytes = 0L
    while ($pending.Count -gt 0) {
        foreach ($item in @(Get-ChildItem -LiteralPath $pending.Pop() -Force)) {
            if (-not $item.FullName.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or
                $lines.Count -ge 2048) { throw 'Installer inventory containment or count exceeded.' }
            $relative = $item.FullName.Substring($root.Length + 1).Replace('\', '/')
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                $targets = @($item.Target)
                if ($item.LinkType -ne 'SymbolicLink' -or $item.PSIsContainer -or
                    -not $expectedLinks.ContainsKey($relative) -or $targets.Count -ne 1) {
                    throw 'Unreviewed installer link.'
                }
                $target = [string]$targets[0]
                if ($target.StartsWith('\\?\') -or $target.StartsWith('\??\')) { $target = $target.Substring(4) }
                if ($target -cne $expectedLinks[$relative]) { throw 'Installer link target changed.' }
                $lines.Add("L`t$relative`t$target")
                $links++
            } elseif ($item.PSIsContainer) {
                $lines.Add("D`t$relative")
                $directories++
                $pending.Push($item.FullName)
            } else {
                $bytes += $item.Length
                if ($bytes -gt 512MB) { throw 'Installer inventory size exceeded.' }
                $hash = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
                $lines.Add("F`t$relative`t$($item.Length)`t$hash")
                $files++
            }
        }
    }
    return [pscustomobject]@{
        Lines = $lines.ToArray(); Sha256 = (Get-InventoryDigest $lines.ToArray())
        Files = $files; Directories = $directories; Links = $links; LogicalBytes = $bytes
    }
}

$before = Get-InstallerInventory
if ($before.Sha256 -cne $expectedInventory -or $before.Files -ne 431 -or
    $before.Directories -ne 93 -or $before.Links -ne 2 -or $before.LogicalBytes -ne 296933889) {
    throw 'Installer inventory changed; review the new state before removal.'
}
if (Test-Path -LiteralPath $receipt) { throw 'A cleanup receipt already exists.' }
if (-not $PSCmdlet.ShouldProcess($root, 'Remove 431 verified temporary files, 93 directories and two exact dangling links')) {
    [pscustomobject]@{ Status = 'verified-preview'; RegularFiles = $before.Files; Links = $before.Links; LogicalBytes = $before.LogicalBytes }
    return
}

# Remove only the link entries first, then prove the remaining tree has no links.
foreach ($relative in $expectedLinks.Keys) {
    Remove-Item -LiteralPath (Join-Path $root $relative.Replace('/', '\')) -Force
}
$afterLinks = Get-InstallerInventory
$ordinaryLines = [string[]]@($before.Lines | Where-Object { -not $_.StartsWith("L`t") })
if ($afterLinks.Links -ne 0 -or $afterLinks.Sha256 -cne (Get-InventoryDigest $ordinaryLines)) {
    throw 'Installer contents changed during link removal.'
}
Assert-InstallerRoot
Remove-Item -LiteralPath $root -Recurse -Force
if (@(Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($root)) -Force |
    Where-Object { $_.FullName -ceq $root }).Count -ne 0) { throw 'Installer removal is incomplete.' }

# Create a receipt only after independently observing that the exact root is absent.
$result = [ordered]@{
    schema = 'tinyrustlm.reviewed_numerical_installer_cleanup_result.v1'
    status = 'removed'; removedAtUtc = [DateTime]::UtcNow.ToString('o'); root = $root
    inventorySha256 = $expectedInventory; regularFiles = 431; symbolicLinks = 2
    logicalByteLength = 296933889; measuredStorageRecoveryBytes = $null
    canonicalReferenceRuntimeRemoved = $false
}
$output = [Text.Encoding]::UTF8.GetBytes((($result | ConvertTo-Json -Depth 4) + "`n"))
$stream = [IO.File]::Open($receipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $stream.Write($output, 0, $output.Length); $stream.Flush($true) }
finally { $stream.Dispose() }
$result
