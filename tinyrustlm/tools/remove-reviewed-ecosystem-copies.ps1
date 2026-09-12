# One owner-run entry point for reviewed, policy-blocked removals.
# -WhatIf performs every existing preflight without deleting or writing receipts.
[CmdletBinding(SupportsShouldProcess = $true)]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$expectedRoot = 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tools'
$scripts = @(
    [pscustomobject]@{
        Path = 'E:\Source\Rust\Runtime.MiRust.com\tools\remove-retired-docs.ps1'
        Sha256 = '63317ffd3495e105f405d507398c79b48c1ae81ff95daa4baea4d00d7f653214'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tools\remove-reviewed-retired-files.ps1'
        Sha256 = '108eb3e1f83935d9fae44a88ef5ea5b593fb5ff847862dcc33390a65cf4691b2'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\MiniModel.MiRust.com\tools\remove-reviewed-stage.ps1'
        Sha256 = '6455fde2b283472ee9fcc4218aa90b2764eb7c208fd9c944d84c8f1a1f691432'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tools\remove-reviewed-training-checkpoints.ps1'
        Sha256 = '5b077dac49532cc05c8facc3985e1e98c7f6814efb9e14951d386d9c3eef1d48'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tools\remove-reviewed-duplicate-qwen-source.ps1'
        Sha256 = 'ca04a99220c29050395daa982477661c18789ab185fe42c9deded9c5f89a5f4f'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\TinyRustLM.MiRust.com\tools\remove-reviewed-stage.ps1'
        Sha256 = '2d659d2af00e0da3b8713ae0731732920e2f180e7e9a961ec2c93e6bd6d9ceea'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\TinyRustLM.MiRust.com\tools\remove-reviewed-runtime-mirror.ps1'
        Sha256 = 'ca110d073ac868e2d7199093c5f3c25a0eda4219f412ce4188b0a128ccbdae67'
    }
    [pscustomobject]@{
        Path = 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tools\remove-reviewed-training-producers.ps1'
        Sha256 = '9038cc24701cabfec2b52b503c2a23462003078ec6f654e1c8676dc9bf6c7174'
    }
)

# Refuse linked script paths or a substituted cleanup implementation.
function Assert-ReviewedScript($Record) {
    $item = Get-Item -LiteralPath $Record.Path -Force
    if ($item.PSIsContainer) { throw 'Cleanup entry point is not a file.' }
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked cleanup path rejected.' }
        if ($item -is [IO.FileInfo]) { $item = $item.Directory }
        else { $item = $item.Parent }
    }
    if ((Get-FileHash -LiteralPath $Record.Path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Record.Sha256) {
        throw "Cleanup implementation changed; review it before proceeding: $($Record.Path)"
    }
}

# Retire only the two hashed files left by the interrupted browser test.
function Remove-ReviewedInterruptedSmoke {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([switch]$ValidateOnly)
    $reviewPath = 'E:\Source\Rust\TinyRustLM.com\artifacts\ecosystem-cleanup-20260912\interrupted-local-smoke-review.json'
    Assert-ReviewedScript ([pscustomobject]@{
        Path = $reviewPath
        Sha256 = 'd6afac41a1c54448b4fb7892ce4738215c1620562df64e9c68655aef1365faa5'
    })
    $review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
    $root = 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\artifacts\tests\tinyrustlm-local-web-smoke-ifOVpj'
    $evidence = Join-Path $root 'evidence'
    if ([IO.Path]::GetFullPath([string]$review.root) -cne $root -or $review.files.Count -ne 2) {
        throw 'Interrupted-test review scope changed.'
    }
    $cursor = Get-Item -LiteralPath ([IO.Path]::GetDirectoryName($root)) -Force
    while ($null -ne $cursor) {
        if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked residue ancestry.' }
        $cursor = $cursor.Parent
    }
    if (-not (Test-Path -LiteralPath $root)) { return }
    foreach ($directory in @($root, $evidence)) {
        $item = Get-Item -LiteralPath $directory -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Linked or invalid residue directory.'
        }
    }
    $children = @(Get-ChildItem -LiteralPath $root -Force)
    if ($children.Count -ne 1 -or $children[0].FullName -cne $evidence -or
        @(Get-ChildItem -LiteralPath $evidence -Force).Count -ne 2) { throw 'Residue inventory changed.' }
    $expected = @((Join-Path $evidence 'browser-smoke-report.json'), (Join-Path $evidence 'updates-mobile.png'))
    for ($index = 0; $index -lt 2; $index++) {
        $row = $review.files[$index]
        if ([IO.Path]::GetFullPath([string]$row.path) -cne $expected[$index]) { throw 'Escaped residue path.' }
        Assert-ReviewedScript ([pscustomobject]@{ Path = $expected[$index]; Sha256 = $row.sha256 })
        if ((Get-Item -LiteralPath $expected[$index]).Length -ne $row.byteLength) { throw 'Residue size changed.' }
    }
    if ($ValidateOnly -or -not $PSCmdlet.ShouldProcess($root, 'Remove the exact two interrupted-test artifacts')) { return }
    foreach ($file in $expected) { Remove-Item -LiteralPath $file -Force -ErrorAction Stop }
    Remove-Item -LiteralPath $evidence -ErrorAction Stop
    Remove-Item -LiteralPath $root -ErrorAction Stop
    if (Test-Path -LiteralPath $root) { throw 'Interrupted-test residue remains.' }
    $receipt = [ordered]@{ completedUtc = [DateTime]::UtcNow.ToString('o'); removedRoot = $root
        removedFiles = 2; logicalBytes = 310515; reviewSha256 = 'd6afac41a1c54448b4fb7892ce4738215c1620562df64e9c68655aef1365faa5' }
    $receiptPath = Join-Path ([IO.Path]::GetDirectoryName($reviewPath)) 'interrupted-local-smoke-retirement-receipt.json'
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($receipt | ConvertTo-Json) + "`n")
    $stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
}

if ([IO.Path]::GetFullPath($PSScriptRoot) -cne $expectedRoot) { throw 'Run the canonical cleanup entry point only.' }
foreach ($script in $scripts) { Assert-ReviewedScript $script }
Remove-ReviewedInterruptedSmoke -ValidateOnly

# Invoke each canonical script in place. Each owns its exact-path/data preflight.
foreach ($script in $scripts) {
    Assert-ReviewedScript $script
    & $script.Path -WhatIf:$WhatIfPreference
}
Remove-ReviewedInterruptedSmoke -WhatIf:$WhatIfPreference
