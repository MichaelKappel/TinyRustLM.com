[CmdletBinding()]
param([switch]$Apply)

# Owner-operated retirement of one rejected checkpoint; default mode only verifies.
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($repo -ne 'E:\Source\Rust\TinyRustLM.com') { throw 'Unexpected source root' }
$manifestPath = Join-Path $repo 'artifacts\ecosystem-cleanup-20260912\qwen3-code-expert-source-cleanup-review-20260927.json'
if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne '788dedf03a6ca85671771767bc5b6ed59eb7c5776d2342c7f0e9ef6a9ba8cedf') {
    throw 'Cleanup review changed'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($manifest.root)
$expectedTarget = 'D:\LLMs\TinyRustLM\sources\source-7a4326b580591db0f6bf2127509b3c4a46f08969d78c4a9952a43264180bca4a'
if ($target -ne $expectedTarget -or [IO.Path]::GetDirectoryName($target) -ne 'D:\LLMs\TinyRustLM\sources') {
    throw 'Unexpected cleanup target'
}
for ($ancestor = $target; $ancestor; $ancestor = [IO.Path]::GetDirectoryName($ancestor)) {
    $entry = Get-Item -LiteralPath $ancestor -Force -ErrorAction SilentlyContinue
    if ($entry -and (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $entry.PSIsContainer)) {
        throw 'Cleanup ancestry is not an ordinary directory'
    }
}
$present = @(if (Test-Path -LiteralPath $target) { Get-ChildItem -LiteralPath $target -Force })
$verified = @()
foreach ($entry in $present) {
    $binding = @($manifest.files | Where-Object name -eq $entry.Name)
    if ($binding.Count -ne 1 -or $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Unexpected cleanup entry'
    }
    if ([IO.Path]::GetDirectoryName($entry.FullName) -ne $target -or $entry.Length -ne $binding[0].bytes -or
        (Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256).Hash -ne $binding[0].sha256) {
        throw 'Cleanup entry identity changed'
    }
    $verified += $entry
}
[long]$removedBytes = 0
$removed = 0
if ($Apply) {
    foreach ($entry in $verified) {
        $binding = $manifest.files | Where-Object name -eq $entry.Name
        $current = Get-Item -LiteralPath $entry.FullName -Force
        if ($current.PSIsContainer -or ($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            (Get-FileHash -LiteralPath $current.FullName -Algorithm SHA256).Hash -ne $binding.sha256) {
            throw 'Cleanup entry changed after verification'
        }
        Remove-Item -LiteralPath $current.FullName -Force -ErrorAction Stop
        $removedBytes += $current.Length
        $removed++
    }
    if (Test-Path -LiteralPath $target) {
        if (@(Get-ChildItem -LiteralPath $target -Force).Count -ne 0) { throw 'Cleanup target is not empty' }
        Remove-Item -LiteralPath $target -Force -ErrorAction Stop
    }
    if (Test-Path -LiteralPath $target) { throw 'Cleanup target remains' }
}
[ordered]@{
    schema = 'tinyrustlm.rejected_source_cleanup_result.v1'
    mode = $(if ($Apply) { 'apply' } else { 'preview' })
    root = $target
    verifiedFiles = $verified.Count
    alreadyAbsentFiles = $manifest.files.Count - $verified.Count
    removedFiles = $removed
    logicalBytesRemoved = $removedBytes
    measuredStorageRecoveryBytes = $null
    sourceRootAbsent = -not (Test-Path -LiteralPath $target)
    published = $false
} | ConvertTo-Json
