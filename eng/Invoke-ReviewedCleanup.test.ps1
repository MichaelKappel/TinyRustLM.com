param([Parameter(Mandatory = $true)][string]$FixtureRoot)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Invoke-ReviewedCleanup.ps1')
$passed = 0

# Require an expected failure rather than silently accepting a changed cleanup target.
function Expect-Refusal {
    param([scriptblock]$Action)
    $refused = $false
    try { & $Action | Out-Null } catch { $refused = $true }
    if (-not $refused) { throw 'Expected cleanup refusal did not occur.' }
}

if (-not $FixtureRoot.StartsWith('E:\Source\Rust\TinyRustLM.com\artifacts\tests\operator-cleanup\tinyrustlm-operation-',
    [StringComparison]::OrdinalIgnoreCase)) { throw 'Tests require newly owned canonical fixture scratch.' }
$roots = @($FixtureRoot)
$file = Join-Path $FixtureRoot 'obsolete.txt'
[IO.File]::WriteAllText($file, 'fixture')
$entry = [pscustomobject]@{ path = $file; bytes = 7;
    sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
if ((Get-ReviewedCleanupFile $entry $roots).Length -ne 7) { throw 'Exact fixture did not admit.' }
$passed++
Expect-Refusal { Assert-CleanupPath -Path $FixtureRoot -Roots $roots }
$passed++
Expect-Refusal { Assert-CleanupPath -Path ($FixtureRoot + '-adjacent\file.txt') -Roots $roots }
$passed++
Expect-Refusal { Assert-CleanupPath -Path ($file + ':stream') -Roots $roots }
$passed++
[IO.File]::WriteAllText($file, 'changed')
Expect-Refusal { Remove-ReviewedCleanupFile $entry $roots }
if ([IO.File]::ReadAllText($file) -cne 'changed') { throw 'Changed content was removed.' }
$passed++
[IO.File]::WriteAllText($file, 'fixture')
if ((Remove-ReviewedCleanupFile $entry $roots) -ne 'removed' -or (Test-Path -LiteralPath $file)) {
    throw 'Exact fixture removal failed.'
}
$passed++
if ((Remove-ReviewedCleanupFile $entry $roots) -ne 'already-absent') { throw 'Absent result was incorrect.' }
$passed++
$directory = Join-Path $FixtureRoot 'container'
$null = New-Item -ItemType Directory -Path $directory
[IO.File]::WriteAllText((Join-Path $directory 'unknown.txt'), 'preserve')
Expect-Refusal { Remove-ReviewedEmptyDirectory $directory $roots }
if (-not (Test-Path -LiteralPath (Join-Path $directory 'unknown.txt'))) { throw 'Unknown file was removed.' }
$passed++
$empty = Join-Path $FixtureRoot 'empty'
$null = New-Item -ItemType Directory -Path $empty
if ((Remove-ReviewedEmptyDirectory $empty $roots) -ne 'removed-empty-directory') { throw 'Empty prune failed.' }
$passed++
$observation = Get-CleanupAccessObservation $directory $roots
if ($observation.status -ne 'readable' -or $observation.childCount -ne 1) { throw 'Read-only observation failed.' }
$passed++
$observation = Get-CleanupAccessObservation (Join-Path $FixtureRoot 'missing') $roots
if ($observation.status -ne 'unresolved') { throw 'Missing observation was hidden.' }
$passed++
$link = Join-Path $FixtureRoot 'linked'
$null = New-Item -ItemType Junction -Path $link -Target $directory
try { Expect-Refusal { Assert-CleanupPath -Path (Join-Path $link 'unknown.txt') -Roots $roots }; $passed++ }
finally { [IO.Directory]::Delete($link, $false) }
"PASS: $passed cleanup checks; only newly created fixture targets exercised."
