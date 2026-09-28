param([switch]$Apply)

$ErrorActionPreference = 'Stop'
# Owner-run cleanup for two empty folders whose agent removal was policy-rejected.
# No caller-supplied paths, recursive removal, ACL changes, or content deletion.
$reviewedTargets = @(
    'E:\Temp\TinyRustLM-Test-Custody',
    'E:\Source\Rust\TinyRustLM.com\artifacts\verification\playwright-install-20260928'
)

function Assert-EmptyDirectDirectory {
    param([Parameter(Mandatory = $true)][string]$Target)
    if ($Target -notin $reviewedTargets) { throw 'Unreviewed cleanup target' }
    $directory = Get-Item -LiteralPath $Target -Force -ErrorAction Stop
    if (-not $directory.PSIsContainer -or $directory.FullName -cne $Target) {
        throw 'Cleanup target identity mismatch'
    }
    for ($ancestor = $directory; $null -ne $ancestor; $ancestor = $ancestor.Parent) {
        if (($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Linked cleanup ancestry is not allowed'
        }
    }
    if (@(Get-ChildItem -LiteralPath $Target -Force -ErrorAction Stop).Count -ne 0) {
        throw "Reviewed folder is no longer empty: $Target"
    }
}

$present = @()
$absent = 0
foreach ($target in $reviewedTargets) {
    if (Test-Path -LiteralPath $target) {
        Assert-EmptyDirectDirectory -Target $target
        $present += $target
    } else {
        $absent += 1
    }
}

$removed = 0
if ($Apply) {
    foreach ($target in $present) {
        Assert-EmptyDirectDirectory -Target $target
        Remove-Item -LiteralPath $target -ErrorAction Stop
        if (Test-Path -LiteralPath $target) { throw "Cleanup target remains: $target" }
        $removed += 1
    }
}
[ordered]@{
    schema = 'tinyrustlm.reviewed_empty_test_folder_cleanup.v1'
    mode = $(if ($Apply) { 'apply' } else { 'preview' })
    verifiedEmptyDirectories = $present.Count
    alreadyAbsent = $absent
    removedDirectories = $removed
    paths = $reviewedTargets
    published = $false
} | ConvertTo-Json -Depth 3
