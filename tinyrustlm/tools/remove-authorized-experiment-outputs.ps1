#Requires -Version 5.1
#Requires -RunAsAdministrator
# Owner-authorized September 27: delete the ignored experiment outputs too.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = 'E:\Source\Rust\TinyRustLM.com'
$receipt = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912\ignored-experiment-cleanup-receipt.json'
$relativePaths = @(
    'artifacts/performance/qwen2.5-1.5b-reference-logits'
    'artifacts/training/quality-sequence-v1/adapter-source-cpu-pilot-v1'
    'artifacts/training/quality-sequence-v1/adapter-source-cpu-v1'
    'artifacts/training/quality-sequence-v1/dataset'
    'artifacts/training/quality-sequence-v1/qwen36-draft1'
    'artifacts/training/quality-sequence-v1/qwen36-draft2'
    'artifacts/training/quality-sequence-v1/qwen36-refusal-recovery'
    'artifacts/training/quality-sequence-v1/reviewed-draft2'
    'artifacts/training/quality-sequence-v1/reviewed-recovery'
    'artifacts/training/qwen2.5-0.5b-topk-pilot-v1/dataset'
    'artifacts/training/qwen2.5-cognitive-liberty-v1/dataset'
    'artifacts/training/qwen2.5-cognitive-liberty-v2/public-prompt-seeds-v1'
    'artifacts/training/qwen2.5-cognitive-liberty-v2/public-prompt-seeds-v2'
    'artifacts/training/qwen3-cognitive-liberty-v1/dataset'
    'artifacts/training/qwen3-cognitive-liberty-v1/reviewed-v2'
    'artifacts/training/qwen3-cognitive-liberty-v1/teacher-drafts-v1'
    'artifacts/training/qwen3-cognitive-liberty-v1/teacher-drafts-v2'
    'artifacts/training/qwen3-cognitive-liberty-v2/dataset'
    'artifacts/training/qwen3-cognitive-liberty-v3/dataset'
    'artifacts/training/role-history-quality-v1/assisted-review-v1'
    'artifacts/training/role-history-quality-v1/human-review-progress-v1'
    'artifacts/training/role-history-quality-v1/human-review-v1'
    'artifacts/training/role-history-quality-v1/review-workbook-v1'
    'artifacts/training/role-history-quality-v1/teacher-drafts-v1'
    'artifacts/training/role-history-quality-v1/triage-v1'
    'artifacts/training/smollm2-cognitive-liberty-v1/dataset'
)

# Resolve one listed relative directory inside the repository; reject traversal and linked ancestors.
function Resolve-ExperimentCleanupPath {
    param([string]$RepositoryRoot, [string]$RelativePath)
    if (-not [IO.Path]::IsPathRooted($RepositoryRoot) -or
        $RelativePath -notmatch '^artifacts/(training|performance)/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$' -or
        ($RelativePath.Split('/') | Where-Object { $_ -eq '.' -or $_ -eq '..' })) {
        throw 'Invalid experiment cleanup path.'
    }
    $base = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    $target = [IO.Path]::GetFullPath((Join-Path $base $RelativePath))
    if (-not $target.StartsWith($base + '\artifacts\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Experiment cleanup containment failed.'
    }
    $cursor = $target
    while ($cursor) {
        $item = $null
        try { $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { }
        if ($item -and (-not $item.PSIsContainer -or
            ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
            throw 'Experiment cleanup ancestry is not an ordinary directory.'
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
    return $target
}

# Enumerate ordinary contents without reading payloads or traversing links; bind metadata for a recheck.
function Get-ExperimentCleanupInventory {
    param([string]$Path)
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($Path)
    $rows = [Collections.Generic.List[string]]::new()
    [long]$bytes = 0
    [long]$files = 0
    while ($pending.Count -gt 0) {
        foreach ($item in Get-ChildItem -LiteralPath $pending.Pop() -Force -ErrorAction Stop) {
            if (-not $item.FullName.StartsWith($Path + '\', [StringComparison]::OrdinalIgnoreCase) -or
                ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.Name -eq '.git') {
                throw 'Experiment cleanup found an escaped path, link or nested repository.'
            }
            $relative = $item.FullName.Substring($Path.Length + 1)
            if ($item.PSIsContainer) { $rows.Add('D|' + $relative); $pending.Push($item.FullName) }
            else {
                $rows.Add(('F|{0}|{1}|{2}' -f $relative, $item.Length, $item.LastWriteTimeUtc.Ticks))
                $files++; $bytes += $item.Length
            }
        }
    }
    $ordered = $rows.ToArray()
    [Array]::Sort($ordered, [StringComparer]::Ordinal)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($ordered -join "`n")))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    return [pscustomobject]@{ Files = $files; LogicalBytes = $bytes; MetadataSha256 = $digest }
}

# Refuse tracked or non-ignored paths using the canonical repository's current index and ignore policy.
function Assert-ExperimentCleanupUntracked {
    param([string]$RelativePath)
    $tracked = @(& git -c safe.directory=E:/Source/Rust/TinyRustLM.com -C $repository ls-files -- ($RelativePath + '/'))
    if ($LASTEXITCODE -ne 0 -or $tracked.Count -ne 0) { throw 'Cleanup target contains tracked files.' }
    & git -c safe.directory=E:/Source/Rust/TinyRustLM.com -C $repository check-ignore --quiet -- ($RelativePath + '/')
    if ($LASTEXITCODE -ne 0) { throw 'Cleanup target is not ignored.' }
}

if ($PSScriptRoot -cne (Join-Path $repository 'tinyrustlm\tools')) { throw 'Wrong cleanup script location.' }
if (Test-Path -LiteralPath $receipt) { throw 'Cleanup receipt already exists; review it before another run.' }
$plans = @()
foreach ($relative in $relativePaths) {
    $target = Resolve-ExperimentCleanupPath -RepositoryRoot $repository -RelativePath $relative
    Assert-ExperimentCleanupUntracked -RelativePath $relative
    $exists = Test-Path -LiteralPath $target -PathType Container
    $inventory = if ($exists) { Get-ExperimentCleanupInventory -Path $target } else { $null }
    $plans += [pscustomobject]@{ RelativePath = $relative; Path = $target; Existed = $exists; Inventory = $inventory }
}

# Complete all read-only checks before any removal. No ACL changes, Git reset or model-store operation.
if (-not $PSCmdlet.ShouldProcess('26 explicitly listed ignored experiment directories', 'Permanently delete owner-authorized outputs')) {
    [pscustomobject]@{ Status = 'verified-preview'; Targets = $plans.Count }
    return
}
$removed = 0
[long]$logicalBytes = 0
foreach ($plan in $plans) {
    if (-not $plan.Existed) { continue }
    $target = Resolve-ExperimentCleanupPath -RepositoryRoot $repository -RelativePath $plan.RelativePath
    Assert-ExperimentCleanupUntracked -RelativePath $plan.RelativePath
    $current = Get-ExperimentCleanupInventory -Path $target
    if ($current.MetadataSha256 -cne $plan.Inventory.MetadataSha256) { throw 'Experiment contents changed during cleanup.' }
    Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $target) { throw 'Experiment removal is incomplete.' }
    $removed++; $logicalBytes += $current.LogicalBytes
}
$result = [ordered]@{
    schema = 'tinyrustlm.authorized_experiment_cleanup_result.v1'
    removedAtUtc = [DateTime]::UtcNow.ToString('o'); status = 'removed'
    removedDirectories = $removed; alreadyAbsent = $plans.Count - $removed
    logicalBytesRemoved = $logicalBytes; measuredStorageRecoveryBytes = $null
    paths = $relativePaths; published = $false
}
$output = [Text.Encoding]::UTF8.GetBytes(($result | ConvertTo-Json -Depth 4) + "`n")
$stream = [IO.File]::Open($receipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $stream.Write($output, 0, $output.Length); $stream.Flush($true) } finally { $stream.Dispose() }
$result
