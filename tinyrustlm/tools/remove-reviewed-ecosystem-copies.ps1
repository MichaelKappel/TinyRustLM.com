# One owner-run entry point for the five already reviewed, policy-blocked removals.
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

if ([IO.Path]::GetFullPath($PSScriptRoot) -cne $expectedRoot) { throw 'Run the canonical cleanup entry point only.' }
foreach ($script in $scripts) { Assert-ReviewedScript $script }

# Invoke each canonical script in place. Each owns its exact-path/data preflight.
foreach ($script in $scripts) {
    Assert-ReviewedScript $script
    & $script.Path -WhatIf:$WhatIfPreference
}
