param([Parameter(Mandatory = $true)][string]$OperationRoot)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null; $errors = $null
$path = Join-Path $PSScriptRoot '..\tools\remove-authorized-experiment-outputs.ps1'
$ast = [Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Cleanup script parse failure.' }
# Import validation functions only; never execute the deletion entry point.
foreach ($name in @('Resolve-ExperimentCleanupPath', 'Get-ExperimentCleanupInventory')) {
    $definition = $ast.Find({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $true)
    Invoke-Expression $definition.Extent.Text
}
function Assert-Throws {
    param([scriptblock]$Action)
    $threw = $false
    try { & $Action | Out-Null } catch { $threw = $true }
    if (-not $threw) { throw 'Expected validation rejection.' }
}
$root = [IO.Path]::GetFullPath($OperationRoot)
if (-not $root.StartsWith('E:\Source\Rust\TinyRustLM.com\artifacts\tests\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test fixture must remain under canonical artifacts.'
}
$fixture = Join-Path $root 'artifacts\training\fixture\dataset'
[IO.Directory]::CreateDirectory($fixture) | Out-Null
[IO.File]::WriteAllText((Join-Path $fixture 'sample.txt'), 'sample')
$resolved = Resolve-ExperimentCleanupPath -RepositoryRoot $root -RelativePath 'artifacts/training/fixture/dataset'
if ($resolved -cne $fixture) { throw 'Valid target changed.' }
$missing = Resolve-ExperimentCleanupPath -RepositoryRoot $root -RelativePath 'artifacts/training/missing/dataset'
if (Test-Path -LiteralPath $missing) { throw 'Path validation created output.' }
foreach ($relative in @('../outside', 'artifacts/training/../../outside', 'artifacts/training/..',
    'artifacts/training', 'artifacts/external/environment', 'C:\outside', 'artifacts/training/fixture:stream')) {
    Assert-Throws { Resolve-ExperimentCleanupPath -RepositoryRoot $root -RelativePath $relative }
}
Assert-Throws { Resolve-ExperimentCleanupPath -RepositoryRoot 'relative-root' -RelativePath 'artifacts/training/fixture' }
$first = Get-ExperimentCleanupInventory -Path $fixture
if ($first.Files -ne 1 -or $first.LogicalBytes -ne 6) { throw 'Inventory count mismatch.' }
$again = Get-ExperimentCleanupInventory -Path $fixture
if ($first.MetadataSha256 -cne $again.MetadataSha256) { throw 'Inventory is nondeterministic.' }
[IO.File]::WriteAllText((Join-Path $fixture 'second.txt'), 'more')
$second = Get-ExperimentCleanupInventory -Path $fixture
if ($second.Files -ne 2 -or $second.LogicalBytes -ne 10 -or $second.MetadataSha256 -ceq $first.MetadataSha256) {
    throw 'Inventory failed to detect changed contents.'
}
$outside = Join-Path $root 'outside'
[IO.Directory]::CreateDirectory($outside) | Out-Null
$junction = Join-Path $fixture 'linked'
New-Item -ItemType Junction -Path $junction -Target $outside | Out-Null
try {
    Assert-Throws { Get-ExperimentCleanupInventory -Path $fixture }
    Assert-Throws { Resolve-ExperimentCleanupPath -RepositoryRoot $root -RelativePath 'artifacts/training/fixture/dataset/linked' }
} finally { [IO.Directory]::Delete($junction) }
[IO.Directory]::CreateDirectory((Join-Path $fixture '.git')) | Out-Null
Assert-Throws { Get-ExperimentCleanupInventory -Path $fixture }
if (-not (Test-Path -LiteralPath (Join-Path $fixture 'sample.txt'))) { throw 'Validation removed data.' }
Write-Output 'Authorized experiment cleanup validation tests passed; no real cleanup invoked.'
