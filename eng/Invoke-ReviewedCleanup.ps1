[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Apply)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Reject drive roots, adjacent repositories, alternate streams, and linked ancestry.
function Assert-CleanupPath {
    param([string]$Path, [string[]]$Roots)
    if (-not [IO.Path]::IsPathRooted($Path) -or $Path.Substring(2).Contains(':')) {
        throw 'Cleanup requires an absolute ordinary filesystem path.'
    }
    $full = [IO.Path]::GetFullPath($Path)
    if ($full -cne $Path -or -not @($Roots | Where-Object {
        $full.StartsWith($_.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)
    }).Count) { throw "Outside approved cleanup roots: $Path" }
    for ($cursor = $full; $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        try { $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { continue }
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Linked cleanup path refused: $cursor"
        }
        if ([IO.Path]::GetDirectoryName($cursor) -eq $cursor) { break }
    }
    return $full
}

# Admit only an unchanged reviewed plain file; missing is separate from access denied.
function Get-ReviewedCleanupFile {
    param([object]$Entry, [string[]]$Roots)
    $full = Assert-CleanupPath -Path ([string]$Entry.path) -Roots $Roots
    try { $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop }
    catch [System.Management.Automation.ItemNotFoundException] { return $null }
    if ($item.PSIsContainer -or $item.Length -ne [long]$Entry.bytes -or
        [string]$Entry.sha256 -notmatch '^[0-9a-f]{64}$') { throw "File identity changed: $full" }
    if ((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Entry.sha256) {
        throw "File hash changed: $full"
    }
    return $item
}

# Revalidate immediately before one literal-path removal; never recurse or change ACLs.
function Remove-ReviewedCleanupFile {
    param([object]$Entry, [string[]]$Roots)
    $item = Get-ReviewedCleanupFile -Entry $Entry -Roots $Roots
    if ($null -eq $item) { return 'already-absent' }
    Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
    try {
        $remaining = Get-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
        throw "File still exists after removal: $($remaining.FullName)"
    } catch [System.Management.Automation.ItemNotFoundException] { return 'removed' }
}

# Prune only an explicitly listed, currently empty directory; unknown contents survive.
function Remove-ReviewedEmptyDirectory {
    param([string]$Path, [string[]]$Roots)
    $full = Assert-CleanupPath -Path $Path -Roots $Roots
    try { $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop }
    catch [System.Management.Automation.ItemNotFoundException] { return 'already-absent' }
    if (-not $item.PSIsContainer) { throw "Expected directory: $full" }
    if (@(Get-ChildItem -LiteralPath $full -Force -ErrorAction Stop).Count) {
        throw "Unreviewed contents remain; directory preserved: $full"
    }
    # Directory.Delete(false) is explicitly nonrecursive and also refuses raced new contents.
    [IO.Directory]::Delete($full, $false)
    return 'removed-empty-directory'
}

# Read metadata only; do not enter links or alter ownership/access permissions.
function Get-CleanupAccessObservation {
    param([string]$Path, [string[]]$Roots)
    try {
        $null = Assert-CleanupPath -Path $Path -Roots $Roots
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
        $entries = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop)
        return [ordered]@{ type = 'access'; path = $Path; status = 'readable';
            owner = [string]$acl.Owner; protectedAcl = $acl.AreAccessRulesProtected;
            childCount = $entries.Count;
            entries = @($entries | Select-Object -First 200 Name, Attributes) }
    } catch {
        return [ordered]@{ type = 'access'; path = $Path; status = 'unresolved';
            errorType = $_.Exception.GetType().Name; error = $_.Exception.Message }
    }
}

# Dot sourcing exposes bounded functions for fixture tests without running real cleanup.
if ($MyInvocation.InvocationName -eq '.') { return }

$canonical = 'E:\Source\Rust\TinyRustLM.com'
if ([IO.Path]::GetFullPath($PSScriptRoot) -cne "$canonical\eng") {
    throw 'Run the script from the existing canonical repository.'
}
$roots = @($canonical, 'E:\Source\Rust\Runtime.MiRust.com', 'E:\Source\Rust\LMComposer.com')
$manifestPath = Join-Path $PSScriptRoot 'reviewed-cleanup-manifest.json'
$manifestHash = '9e2ba9f5dbb93a4b2af9a648ff98e3222d034ef5b80bfb7236c6e227e0e1ab88'
$null = Assert-CleanupPath -Path $manifestPath -Roots $roots
if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifestHash) {
    throw 'Reviewed cleanup manifest changed; request a fresh review before applying it.'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.schema -cne 'tinyrustlm.reviewed-operator-cleanup.v1' -or
    @($manifest.files).Count -ne 241) { throw 'Unexpected cleanup manifest.' }
$mutate = $Apply -and -not $WhatIfPreference
$checks = @()
foreach ($entry in $manifest.files) {
    try {
        $item = Get-ReviewedCleanupFile -Entry $entry -Roots $roots
        $checks += [ordered]@{ type = 'preflight'; path = $entry.path;
            status = $(if ($null -eq $item) { 'already-absent' } else { 'verified' }) }
    } catch {
        $checks += [ordered]@{ type = 'preflight'; path = $entry.path;
            status = 'refused'; error = $_.Exception.Message }
    }
}
# A changed or uninspectable reviewed file prevents all file mutations in this invocation.
$refused = @($checks | Where-Object { $_.status -eq 'refused' })
if ($refused.Count) {
    $refused | ConvertTo-Json -Depth 5
    throw 'Cleanup preflight refused. No target file was removed.'
}
$journal = $null
$reportPath = $null
$removed = 0
$logicalBytes = 0L
$failures = 0
$unresolved = 0
try {
    if ($mutate) {
        $reportPath = Join-Path $canonical ('artifacts\ecosystem-cleanup-20260912\operator-cleanup-' +
            [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N') + '.jsonl')
        $null = Assert-CleanupPath -Path $reportPath -Roots $roots
        $stream = [IO.File]::Open($reportPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
        $journal = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
        $journal.AutoFlush = $true
        $journal.WriteLine((@{ type = 'start'; at = [DateTime]::UtcNow.ToString('o');
            manifestSha256 = $manifestHash; reviewedFiles = 241 } | ConvertTo-Json -Compress))
    }
    foreach ($entry in $manifest.files) {
        $row = [ordered]@{ type = 'file'; path = $entry.path; status = 'preview'; bytes = $entry.bytes }
        if ($mutate -and $PSCmdlet.ShouldProcess($entry.path, 'Delete exact reviewed obsolete file')) {
            try {
                $row.status = Remove-ReviewedCleanupFile -Entry $entry -Roots $roots
                if ($row.status -eq 'removed') { $removed++; $logicalBytes += [long]$entry.bytes }
            } catch { $row.status = 'failed'; $row.error = $_.Exception.Message; $failures++ }
        }
        if ($journal) { $journal.WriteLine(($row | ConvertTo-Json -Compress)) }
    }
    if ($mutate) {
        foreach ($directory in $manifest.pruneDirectories) {
            $row = [ordered]@{ type = 'directory'; path = $directory; status = 'declined' }
            if ($PSCmdlet.ShouldProcess($directory, 'Remove only if empty')) {
                try { $row.status = Remove-ReviewedEmptyDirectory -Path $directory -Roots $roots }
                catch { $row.status = 'preserved'; $row.error = $_.Exception.Message; $failures++ }
            }
            $journal.WriteLine(($row | ConvertTo-Json -Compress))
        }
    }
    foreach ($directory in $manifest.inspectPaths) {
        $row = Get-CleanupAccessObservation -Path $directory -Roots $roots
        if ($row.status -eq 'unresolved') { $unresolved++ }
        if ($journal) { $journal.WriteLine(($row | ConvertTo-Json -Depth 5 -Compress)) }
    }
    $summary = [ordered]@{ type = 'summary'; mode = $(if ($mutate) { 'apply' } else { 'preview' });
        verifiedFiles = @($checks | Where-Object { $_.status -eq 'verified' }).Count;
        alreadyAbsent = @($checks | Where-Object { $_.status -eq 'already-absent' }).Count;
        removedFiles = $removed; logicalBytesRemoved = $logicalBytes; physicalBytesRecovered = $null;
        cleanupFailures = $failures; unresolvedAccessPaths = $unresolved; reportPath = $reportPath;
        manifestPath = $manifestPath; published = $false }
    if ($journal) { $journal.WriteLine(($summary | ConvertTo-Json -Compress)) }
    $summary | ConvertTo-Json
} finally { if ($journal) { $journal.Dispose() } }
if ($failures) { exit 1 }
