[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('CodeExpert','Biggiraffe','Ljh728','Dsadd5018')]
    [string]$Candidate,
    [switch]$Apply
)

# Owner-operated retirement of one rejected checkpoint; default mode only verifies.
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($repo -ne 'E:\Source\Rust\TinyRustLM.com') { throw 'Unexpected source root' }
$targets = @{
    Dsadd5018 = @{
        Review = 'qwen3-json-dsadd5018-source-cleanup-review-20260928.json'
        Sha256 = '6e9f556e7d3502f90e7cad971ed97c6aa0e5780058112a2f063d2ebe7a12d261'
        Directory = 'source-88abce1ebbcd28729d69ab2b5d2b3dfb43889513d12dede28961caebc7a54929'
    }
    CodeExpert = @{
        Review = 'qwen3-code-expert-source-cleanup-review-20260927.json'
        Sha256 = '788dedf03a6ca85671771767bc5b6ed59eb7c5776d2342c7f0e9ef6a9ba8cedf'
        Directory = 'source-7a4326b580591db0f6bf2127509b3c4a46f08969d78c4a9952a43264180bca4a'
    }
    Biggiraffe = @{
        Review = 'qwen3-json-biggiraffe-source-cleanup-review-20260927.json'
        Sha256 = 'a40a66315139d5737b83445c63b298d52a85c2f4566a65f778f28044d9c8b4e2'
        Directory = 'source-c90e9dd369b4e3fa75139583aad7eda46eb564897277a02458b2434f84c4db14'
    }
    Ljh728 = @{
        Review = 'qwen3-json-ljh728-source-cleanup-review-20260927.json'
        Sha256 = 'caacce651158b75783e653bf0602f19d35f41dae6a9ab1ecf80b2449d1b11053'
        Directory = 'source-5d936e360f915555a1ff9be89f3293fef46def2dc6afb70dcf0360d36eda28f6'
    }
}
$selected = $targets[$Candidate]
$manifestPath = Join-Path (Join-Path $repo 'artifacts\ecosystem-cleanup-20260912') $selected.Review
if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $selected.Sha256) {
    throw 'Cleanup review changed'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($manifest.root)
$expectedTarget = Join-Path 'D:\LLMs\TinyRustLM\sources' $selected.Directory
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
