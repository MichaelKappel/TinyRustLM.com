# Exercise the actual reviewed cleanup's preview and rejection boundaries only.
Describe 'Reviewed numerical installer cleanup' {
    $cleanupScript = Join-Path $PSScriptRoot '..\tools\remove-reviewed-numerical-installer-output.ps1'
    . $cleanupScript -WhatIf | Out-Null

    It 'verifies the real inventory without deletion or a receipt' {
        Mock Remove-Item { throw 'Preview must not delete files.' }
        $result = & $cleanupScript -WhatIf
        $result.Status | Should Be 'verified-preview'
        $result.RegularFiles | Should Be 431
        $result.Links | Should Be 2
        $result.LogicalBytes | Should Be 296933889
        Test-Path -LiteralPath $receipt | Should Be $false
        Assert-MockCalled Remove-Item -Times 0 -Exactly -Scope It
    }

    It 'uses stable ordinal ordering and the reviewed LF encoding' {
        Get-InventoryDigest @("D`tb", "D`ta") |
            Should Be 'f4126d373a4fd2a0e94dd3c2372b6b9544a26624da0dcea71e8c1f9f4a7fabcc'
        Get-InventoryDigest @("D`ta", "D`tb") |
            Should Be 'f4126d373a4fd2a0e94dd3c2372b6b9544a26624da0dcea71e8c1f9f4a7fabcc'
        Get-InventoryDigest @("D`ta", "D`tc") |
            Should Not Be 'f4126d373a4fd2a0e94dd3c2372b6b9544a26624da0dcea71e8c1f9f4a7fabcc'
    }

    Context 'Substituted ownership marker' {
        It 'rejects the marker before inventory traversal' {
            Mock Get-FileHash { [pscustomobject]@{ Hash = ('0' * 64) } }
            { Assert-InstallerRoot } | Should Throw 'ownership marker changed'
        }
    }

    Context 'Unreviewed link' {
        It 'rejects the link instead of following it' {
            Mock Get-ChildItem {
                [pscustomobject]@{
                    FullName = (Join-Path $root 'unknown-link'); Attributes = [IO.FileAttributes]::ReparsePoint
                    LinkType = 'SymbolicLink'; PSIsContainer = $false; Target = @('E:\outside')
                }
            }
            { Get-InstallerInventory } | Should Throw 'Unreviewed installer link'
        }
    }

    Context 'Escaped entry' {
        It 'rejects the entry before hashing it' {
            Mock Get-ChildItem {
                [pscustomobject]@{ FullName = 'E:\outside'; Attributes = [IO.FileAttributes]::Normal }
            }
            { Get-InstallerInventory } | Should Throw 'inventory containment'
        }
    }
}
