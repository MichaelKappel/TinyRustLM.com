# Read-only checks for the owner cleanup command; never invoke its deletion branch.
Describe 'Reviewed training producer retirement' {
    $repository = 'E:\Source\Rust\TinyRustLM.com'
    $scriptPath = Join-Path $repository 'tinyrustlm\tools\remove-reviewed-training-producers.ps1'
    $receiptPath = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912\retired-training-producers-receipt.json'
    $receiptBefore = if (Test-Path -LiteralPath $receiptPath) { (Get-FileHash -LiteralPath $receiptPath -Algorithm SHA256).Hash } else { $null }
    . $scriptPath -WhatIf

    It 'validates every remaining reviewed file without creating a deletion receipt' {
        foreach ($row in $review.files) {
            $target = Get-ReviewedTarget $row
            if (Test-Path -LiteralPath (Join-Path $repository $row.path)) {
                ($null -ne $target) | Should Be $true
            }
        }
        if ($null -eq $receiptBefore) {
            (Test-Path -LiteralPath $receiptPath) | Should Be $false
        }
        else {
            (Get-FileHash -LiteralPath $receiptPath -Algorithm SHA256).Hash | Should Be $receiptBefore
        }
    }

    It 'rejects escaped, aliased, wildcard and non-tool targets' {
        foreach ($path in @('../outside', 'C:/outside', 'tinyrustlm/tools/../outside',
            'tinyrustlm/tools//file.py', 'tinyrustlm/tools/*.py', 'tinyrustlm/tools/a:stream',
            'tinyrustlm/tools/./file.py', 'tinyrustlm/app/current.js')) {
            { Get-ReviewedTarget ([pscustomobject]@{path=$path;bytes=1;sha256=('0'*64)}) } | Should Throw
        }
    }

    It 'rejects changed file lengths and hashes independently of retirement completion' {
        $relative = 'tinyrustlm/tools/qwen3-working-model-trainer.py'
        $source = Join-Path $repository $relative
        $row = [pscustomobject]@{path=$relative;bytes=(Get-Item -LiteralPath $source).Length;
            sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()}
        (Get-ReviewedTarget $row) | Should Be $source
        $row.bytes++
        { Get-ReviewedTarget $row } | Should Throw
        $row.bytes--
        $row.sha256 = '0'*64
        { Get-ReviewedTarget $row } | Should Throw
    }

    It 'recognizes an absent ordinary leaf without creating it' {
        $missing = Join-Path $repository 'artifacts/ecosystem-cleanup-20260912/nonexistent-training-retirement-fixture'
        ($null -eq (Get-DirectItem $missing)) | Should Be $true
        (Test-Path -LiteralPath $missing) | Should Be $false
    }

    It 'rejects linked metadata before following the target' {
        Mock Get-Item { [pscustomobject]@{Attributes=[IO.FileAttributes]::ReparsePoint} }
        { Get-DirectItem (Join-Path $repository 'artifacts/nonexistent-linked-fixture') } | Should Throw
    }
}
