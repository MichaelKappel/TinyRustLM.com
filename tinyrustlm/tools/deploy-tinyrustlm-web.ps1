param(
    [string]$RepositoryRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$ManifestPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "deploy\web-deployment-manifest.v2.json"),
    [string]$WorkspaceMemory = $env:TINYRUSTLM_WORKSPACE_MEMORY,
    [string]$ReportDirectory = "E:\Source\Rust\TinyRustLM.com\artifacts\web-deployments",
    [string]$ReportPath = "",
    [switch]$ValidateCredentialProfileOnly,
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
if ($ValidateOnly -and $ValidateCredentialProfileOnly) {
    throw "Choose one deployment validation mode."
}

# Reads one required scalar without exposing the surrounding memory document.
function Get-YamlScalar {
    param([string[]]$Lines, [string]$Key)

    $matches = @($Lines |
        Where-Object { $_ -match ("^\s*" + [regex]::Escape($Key) + "\s*:") })
    if ($matches.Count -ne 1) {
        throw "Required workspace field '$Key' must occur exactly once."
    }
    $value = (($matches[0] -replace "^\s*[^:]+:\s*", "").Trim().Trim('"').Trim("'"))
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required workspace field '$Key' is empty."
    }
    return $value
}

# Rejects files or directories reached through a junction, symbolic link, or other reparse point.
function Assert-NoReparsePointAncestry {
    param([string]$Path, [string]$FailureMessage)

    try {
        $cursor = Get-Item -LiteralPath $Path -Force
        while ($cursor) {
            if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw $FailureMessage
            }
            $cursor = if ($cursor -is [IO.FileInfo]) {
                $cursor.Directory
            }
            else {
                $cursor.Parent
            }
        }
    }
    catch {
        if ($_.Exception.Message -eq $FailureMessage) {
            throw
        }
        throw $FailureMessage
    }
}

# Requires canonical artifact containment and inspects even missing or dangling path components.
function Assert-CanonicalDeploymentArtifactPath {
    param([string]$Path, [string]$SourceRoot = "E:\Source\Rust\TinyRustLM.com")

    if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path) -or
        [string]::IsNullOrWhiteSpace($SourceRoot) -or -not [IO.Path]::IsPathRooted($SourceRoot)) {
        throw "Deployment output must be an absolute child of canonical project artifacts."
    }
    $source = [IO.Path]::GetFullPath($SourceRoot).TrimEnd("\", "/")
    if (-not [string]::Equals($source, "E:\Source\Rust\TinyRustLM.com",
        [StringComparison]::OrdinalIgnoreCase)) {
        throw "Deployment output requires the canonical TinyRustLM repository."
    }
    $target = [IO.Path]::GetFullPath($Path)
    $contained = $false
    foreach ($root in @((Join-Path $source "artifacts"), (Join-Path $source "tinyrustlm\artifacts"))) {
        if ($target.StartsWith(($root + [IO.Path]::DirectorySeparatorChar),
            [StringComparison]::OrdinalIgnoreCase)) { $contained = $true }
    }
    if (-not $contained) {
        throw "Deployment output must be an absolute child of canonical project artifacts."
    }
    $cursor = $target
    while (-not [string]::IsNullOrEmpty($cursor)) {
        $item = Get-Item -Force -LiteralPath $cursor -ErrorAction SilentlyContinue
        if ($item -and (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            ($cursor -ne $target -and -not ($item -is [IO.DirectoryInfo])))) {
            throw "Deployment output ancestry must contain ordinary directories."
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
    return $target
}

# Reads the exact Git top-level for the repository selected by release custody.
function Get-DeploymentGitTopLevel {
    param([string]$RepositoryRoot)

    $result = Invoke-PinnedDeploymentProcess `
        -Executable $script:gitExecutable `
        -Arguments @("-C", $RepositoryRoot, "rev-parse", "--show-toplevel") `
        -WorkingDirectory $RepositoryRoot
    $output = @($result.stdout_lines)
    if ($result.exit_code -ne 0 -or $output.Count -ne 1 -or
        [string]::IsNullOrWhiteSpace([string]$output[0])) {
        throw "The canonical deployment repository is not an exact Git worktree."
    }
    try {
        return [IO.Path]::GetFullPath(([string]$output[0]).Trim())
    }
    catch {
        throw "The canonical deployment repository is not an exact Git worktree."
    }
}

# Confines every custody reader to the single ordinary source repository.
function Assert-CanonicalDeploymentSourceRoot {
    param([string]$RepositoryRoot)

    if ([string]::IsNullOrWhiteSpace($RepositoryRoot) -or
        -not [IO.Path]::IsPathRooted($RepositoryRoot)) {
        throw "TinyRustLM release requires the canonical repository root."
    }
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd("\", "/")
    if (-not [string]::Equals($root, "E:\Source\Rust\TinyRustLM.com",
        [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath (Join-Path $root ".git") -PathType Container)) {
        throw "TinyRustLM release requires the canonical repository root."
    }
    Assert-NoReparsePointAncestry -Path (Join-Path $root ".git") -FailureMessage "TinyRustLM release requires a canonical non-reparse repository root."
    return $root
}

# Binds release execution to the sole non-reparse Git root derived from this script.
function Resolve-CanonicalDeploymentRepositoryRoot {
    param([string]$ScriptRoot, [string]$RequestedRepositoryRoot)

    if ([string]::IsNullOrWhiteSpace($ScriptRoot) -or
        [string]::IsNullOrWhiteSpace($RequestedRepositoryRoot) -or
        -not [IO.Path]::IsPathRooted($ScriptRoot) -or
        -not [IO.Path]::IsPathRooted($RequestedRepositoryRoot)) {
        throw "TinyRustLM release requires the canonical repository root."
    }
    try {
        $resolvedScriptRoot = [IO.Path]::GetFullPath($ScriptRoot)
        $canonicalRoot = [IO.Path]::GetFullPath(
            (Join-Path $resolvedScriptRoot "..\..")
        )
        $requestedRoot = [IO.Path]::GetFullPath($RequestedRepositoryRoot)
        $expectedScriptRoot = [IO.Path]::GetFullPath(
            (Join-Path $canonicalRoot "tinyrustlm\tools")
        )
    }
    catch {
        throw "TinyRustLM release requires the canonical repository root."
    }
    if (-not [string]::Equals(
        $resolvedScriptRoot,
        $expectedScriptRoot,
        [StringComparison]::OrdinalIgnoreCase
    ) -or -not [string]::Equals(
        $requestedRoot,
        $canonicalRoot,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "TinyRustLM release requires the canonical repository root."
    }
    if (-not (Test-Path -LiteralPath $resolvedScriptRoot -PathType Container) -or
        -not (Test-Path -LiteralPath $canonicalRoot -PathType Container) -or
        -not (Test-Path -LiteralPath (Join-Path $canonicalRoot ".git") -PathType Container)) {
        throw "TinyRustLM release requires the canonical repository root."
    }
    Assert-NoReparsePointAncestry `
        -Path $resolvedScriptRoot `
        -FailureMessage "TinyRustLM release requires a canonical non-reparse repository root."
    Assert-NoReparsePointAncestry `
        -Path (Join-Path $canonicalRoot ".git") `
        -FailureMessage "TinyRustLM release requires a canonical non-reparse repository root."
    $gitTopLevel = Get-DeploymentGitTopLevel -RepositoryRoot $canonicalRoot
    if (-not [string]::Equals(
        $gitTopLevel,
        $canonicalRoot,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "TinyRustLM release requires the canonical repository root."
    }
    return (Assert-CanonicalDeploymentSourceRoot -RepositoryRoot $canonicalRoot)
}

# Reads one exact site from the owner's bounded external FTP account export; never logs fields.
function Get-DeploymentCredentialProfile {
    param(
        [string]$ProfilePath,
        [string]$SourceRoot,
        [string]$ExpectedProfileName
    )

    if ([string]::IsNullOrWhiteSpace($ProfilePath) -or
        -not [IO.Path]::IsPathRooted($ProfilePath) -or
        [string]::IsNullOrWhiteSpace($ExpectedProfileName) -or
        [Uri]::CheckHostName($ExpectedProfileName) -ne [UriHostNameType]::Dns) {
        throw "The FTP credential path must be absolute and the site must be a DNS name."
    }
    try {
        $fullPath = [IO.Path]::GetFullPath($ProfilePath)
        $sourcePrefix = [IO.Path]::GetFullPath($SourceRoot).TrimEnd("\", "/") +
            [IO.Path]::DirectorySeparatorChar
    }
    catch {
        throw "The FTP credential path cannot be resolved."
    }
    if ($fullPath.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "The FTP credentials must remain outside the source worktree."
    }
    try {
        $profileAvailable = Test-Path -LiteralPath $fullPath -PathType Leaf
    }
    catch {
        throw "The FTP credentials cannot be inspected."
    }
    if (-not $profileAvailable) {
        throw "The FTP credentials are unavailable."
    }
    try {
        $item = Get-Item -LiteralPath $fullPath
    }
    catch {
        throw "The FTP credentials cannot be inspected."
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $item.Length -le 0 -or
        $item.Length -gt 65536) {
        throw "The FTP credentials are not a bounded regular file."
    }
    Assert-NoReparsePointAncestry `
        -Path $item.FullName `
        -FailureMessage "The FTP credential ancestry is unsafe."

    $stream = $null
    $bytes = [byte[]]::new(65537)
    try {
        $stream = [IO.File]::Open($fullPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        $count = 0
        while ($count -lt $bytes.Length) {
            $read = $stream.Read($bytes, $count, $bytes.Length - $count)
            if ($read -eq 0) { break }
            $count += $read
        }
        if ($count -eq 0 -or $count -gt 65536) { throw "Invalid credential size." }
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes, 0, $count)
        if ($text.StartsWith([string][char]0xfeff, [StringComparison]::Ordinal)) {
            $text = $text.Substring(1)
        }
    }
    catch {
        throw "The bounded FTP credentials cannot be read as UTF-8."
    }
    finally {
        if ($stream) { $stream.Dispose() }
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
    $accounts = [Collections.Generic.List[object]]::new()
    $account = $null
    $keys = @("FTP Username", "FTP server", "FTP & explicit FTPS port", "Username", "Password")
    foreach ($line in ($text -split "\r?\n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $separator = $line.IndexOf(':')
        if ($separator -lt 1) { throw "The FTP credential record is malformed." }
        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        if ($keys -cnotcontains $key -or [string]::IsNullOrEmpty($value)) {
            throw "The FTP credential record contains an unknown or empty field."
        }
        if ($key -ceq "FTP Username") {
            if ($accounts.Count -ge 128) { throw "Too many FTP credential records." }
            $account = @{}
            $accounts.Add($account)
        }
        if ($null -eq $account -or $account.ContainsKey($key)) {
            throw "The FTP credential record has missing or duplicate fields."
        }
        $account[$key] = $value
    }
    $text = $null
    $matchingSites = @($accounts | Where-Object {
        $identity = [string]$_['FTP Username']
        $at = $identity.IndexOf('@')
        $at -gt 0 -and $at -eq $identity.LastIndexOf('@') -and
            [string]::Equals($identity.Substring($at + 1), $ExpectedProfileName, [StringComparison]::OrdinalIgnoreCase)
    })
    if ($matchingSites.Count -ne 1) {
        throw "The FTP credentials must contain exactly one configured deployment site."
    }
    $site = $matchingSites[0]
    if ($site.Count -ne $keys.Count) { throw "The FTP site is missing a required field." }
    $hostName = [string]$site['FTP server']
    $portText = [string]$site['FTP & explicit FTPS port']
    $userName = [string]$site['FTP Username']
    $password = [string]$site['Password']

    $port = 0
    $hostNameType = [Uri]::CheckHostName($hostName)
    if ($hostNameType -eq [UriHostNameType]::Unknown -or
        $hostNameType -eq [UriHostNameType]::IPv6 -or
        $hostName.Length -gt 253 -or
        $portText -notmatch "^[1-9][0-9]{0,4}$" -or
        -not [int]::TryParse($portText, [ref]$port) -or
        $port -lt 1 -or $port -gt 65535 -or
        $userName.Length -gt 256 -or
        $userName -match "[\x00-\x1f\x7f]" -or
        -not [string]::Equals([string]$site['Username'], $userName.Split('@')[0], [StringComparison]::Ordinal) -or
        [string]::IsNullOrEmpty($password) -or
        $password.Length -gt 4096 -or
        $password -match "[\x00-\x1f\x7f]") {
        $password = $null
        throw "The FTP site contains an invalid bounded field."
    }
    return [pscustomobject]@{
        profile = $ExpectedProfileName
        host = $hostName
        port = $port
        user = $userName
        password = $password
    }
}

# Reads the bounded external workspace configuration without exposing its contents.
function Get-BoundedWorkspaceMemoryLines {
    param([string]$MemoryPath, [string]$SourceRoot)

    if ([string]::IsNullOrWhiteSpace($MemoryPath) -or
        -not [IO.Path]::IsPathRooted($MemoryPath)) {
        throw "Workspace memory containing the deployment profile reference is unavailable."
    }
    try {
        $memoryAvailable = Test-Path -LiteralPath $MemoryPath -PathType Leaf
    }
    catch {
        throw "Workspace memory containing the deployment profile reference cannot be inspected."
    }
    if (-not $memoryAvailable) {
        throw "Workspace memory containing the deployment profile reference is unavailable."
    }
    try {
        $memoryItem = Get-Item -LiteralPath ([IO.Path]::GetFullPath($MemoryPath))
    }
    catch {
        throw "Workspace memory containing the deployment profile reference cannot be inspected."
    }
    if (($memoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $memoryItem.Length -le 0 -or
        $memoryItem.Length -gt (4 * 1024 * 1024)) {
        throw "Workspace memory containing the deployment profile reference is unsafe."
    }
    Assert-NoReparsePointAncestry `
        -Path $memoryItem.FullName `
        -FailureMessage "Workspace memory containing the deployment profile reference is unsafe."
    try {
        $lines = [IO.File]::ReadAllLines($memoryItem.FullName)
    }
    catch {
        throw "Workspace memory containing the deployment profile reference cannot be read."
    }
    return [string[]]$lines
}

# Loads the exact nonsecret target identity independently from the credential profile.
function Get-WorkspaceDeploymentTargetBinding {
    param([string]$MemoryPath, [string]$SourceRoot)

    $lines = Get-BoundedWorkspaceMemoryLines `
        -MemoryPath $MemoryPath `
        -SourceRoot $SourceRoot
    $hostName = (Get-YamlScalar -Lines $lines -Key "deployment_ftps_host").Trim()
    $portText = (Get-YamlScalar -Lines $lines -Key "deployment_ftps_port").Trim()
    $userName = (Get-YamlScalar -Lines $lines -Key "deployment_ftps_user").Trim()
    $profileName = Get-YamlScalar -Lines $lines -Key "deployment_ftps_profile"
    $siteIdentity = Get-YamlScalar -Lines $lines -Key "deployment_site_identity"
    $sentinelPath = Get-YamlScalar `
        -Lines $lines `
        -Key "deployment_root_sentinel_path"
    $sentinelSha256 = Get-YamlScalar `
        -Lines $lines `
        -Key "deployment_root_sentinel_sha256"
    $port = 0
    $hostNameType = [Uri]::CheckHostName($hostName)
    if ($hostNameType -eq [UriHostNameType]::Unknown -or
        $hostNameType -eq [UriHostNameType]::IPv6 -or
        $hostName.Length -gt 253 -or
        $portText -notmatch "^[1-9][0-9]{0,4}$" -or
        -not [int]::TryParse($portText, [ref]$port) -or
        $port -lt 1 -or $port -gt 65535 -or
        [string]::IsNullOrWhiteSpace($userName) -or
        $userName.Length -gt 256 -or
        $userName -match "[\x00-\x1f\x7f]" -or
        -not [string]::Equals(
            $profileName,
            "TinyRustLM.com",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            $siteIdentity,
            "tinyrustlm.com",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            $sentinelPath,
            ".well-known/tinyrustlm-deployment-target.v1.json",
            [StringComparison]::Ordinal
        ) -or
        $sentinelSha256 -notmatch "^[0-9a-f]{64}$") {
        throw "The configured TinyRustLM deployment target is invalid."
    }
    return [pscustomobject]@{
        profile = $profileName
        host = $hostName
        port = $port
        user = $userName
        site_identity = $siteIdentity
        sentinel_path = $sentinelPath
        sentinel_sha256 = $sentinelSha256
    }
}

# Resolves the sole external credential profile and selects only the configured site.
function Get-WorkspaceDeploymentCredentialProfile {
    param(
        [string]$MemoryPath,
        [string]$SourceRoot,
        [object]$TargetBinding
    )

    if (-not $TargetBinding -or
        [string]::IsNullOrWhiteSpace([string]$TargetBinding.profile)) {
        throw "The configured TinyRustLM deployment target is unavailable."
    }
    $lines = Get-BoundedWorkspaceMemoryLines `
        -MemoryPath $MemoryPath `
        -SourceRoot $SourceRoot
    $profilePath = Get-YamlScalar -Lines $lines -Key "deployment_ftp_credentials_file"
    return Get-DeploymentCredentialProfile `
        -ProfilePath $profilePath `
        -SourceRoot $SourceRoot `
        -ExpectedProfileName $TargetBinding.profile
}

# Rejects a credential profile that differs from any configured nonsecret target field.
function Assert-DeploymentCredentialTarget {
    param([object]$CredentialProfile, [object]$TargetBinding)

    if (-not $CredentialProfile -or -not $TargetBinding -or
        -not [string]::Equals(
            [string]$CredentialProfile.profile,
            [string]$TargetBinding.profile,
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$CredentialProfile.host,
            [string]$TargetBinding.host,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        [int]$CredentialProfile.port -ne [int]$TargetBinding.port -or
        -not [string]::Equals(
            [string]$CredentialProfile.user,
            [string]$TargetBinding.user,
            [StringComparison]::Ordinal
        )) {
        if ($CredentialProfile) {
            $CredentialProfile.password = $null
        }
        throw "The credential profile does not match the configured deployment target."
    }
}

# Computes a file hash as a stream so published artifacts are never duplicated in memory.
function Get-FileSha256 {
    param([string]$Path)

    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

# Computes a stable SHA-256 identity for one bounded UTF-8 value.
function Get-Utf8Sha256 {
    param([string]$Value)

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($Value)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

# Computes the SHA-256 identity of one bounded byte array without text conversion.
function Get-ByteArraySha256 {
    param([byte[]]$Bytes)

    if ($null -eq $Bytes -or $Bytes.Length -eq 0) {
        throw "Cannot hash an empty byte array."
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString(
            $sha.ComputeHash($Bytes)
        )).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

# Resolves one application once and binds every later launch to its exact bytes.
function Resolve-PinnedDeploymentExecutable {
    param(
        [string]$CommandName,
        [string]$ExpectedLeafName,
        [ValidateRange(1, 1073741824)]
        [int64]$MaximumBytes = (512 * 1024 * 1024)
    )

    $commands = @(
        Get-Command `
            $CommandName `
            -CommandType Application `
            -All `
            -ErrorAction Stop
    )
    if ($commands.Count -ne 1 -or
        [string]::IsNullOrWhiteSpace([string]$commands[0].Source)) {
        throw "Deployment executable resolution is ambiguous."
    }
    $path = [IO.Path]::GetFullPath([string]$commands[0].Source)
    if (-not [string]::Equals(
            [IO.Path]::GetFileName($path),
            $ExpectedLeafName,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Deployment executable identity is invalid."
    }
    Assert-NoReparsePointAncestry `
        -Path $path `
        -FailureMessage "Deployment executable traverses a reparse point."
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$item.Length -le 0 -or
        [int64]$item.Length -gt $MaximumBytes) {
        throw "Deployment executable is not a bounded regular file."
    }
    return [pscustomobject]@{
        schema = "tinyrustlm.pinned_deployment_executable.v1"
        command = $CommandName
        leaf_name = $ExpectedLeafName
        path = $path
        byte_count = [int64]$item.Length
        sha256 = Get-FileSha256 -Path $path
    }
}

# Binds the already-running PowerShell host to one executable and runtime identity.
function Resolve-PinnedDeploymentHost {
    try {
        $processPath = [IO.Path]::GetFullPath(
            [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
        )
    }
    catch {
        throw "The deployment PowerShell host identity is unavailable."
    }
    $leafName = [IO.Path]::GetFileName($processPath)
    if ($leafName -notin @("powershell.exe", "pwsh.exe") -or
        -not (Test-Path -LiteralPath $processPath -PathType Leaf)) {
        throw "The deployment PowerShell host identity is invalid."
    }
    Assert-NoReparsePointAncestry `
        -Path $processPath `
        -FailureMessage "Deployment PowerShell host traverses a reparse point."
    $item = Get-Item -LiteralPath $processPath -Force
    $version = [string]$PSVersionTable.PSVersion
    $edition = [string]$PSVersionTable.PSEdition
    $languageMode = [string]$ExecutionContext.SessionState.LanguageMode
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$item.Length -le 0 -or
        [int64]$item.Length -gt (512 * 1024 * 1024) -or
        $version -notmatch "^[0-9]+\.[0-9]+(?:\.[0-9]+){0,2}$" -or
        $edition -notin @("Desktop", "Core") -or
        $languageMode -ne "FullLanguage") {
        throw "The deployment PowerShell host does not satisfy the runtime contract."
    }
    return [pscustomobject]@{
        schema = "tinyrustlm.pinned_deployment_host.v1"
        command = "powershell-host"
        leaf_name = $leafName
        path = $processPath
        byte_count = [int64]$item.Length
        sha256 = Get-FileSha256 -Path $processPath
        version = $version
        edition = $edition
        language_mode = $languageMode
        process_architecture = if ([Environment]::Is64BitProcess) { "x64" } else { "x86" }
    }
}

# Reopens the PowerShell host and rejects executable or runtime drift.
function Assert-PinnedDeploymentHost {
    param([object]$HostIdentity)

    if (-not $HostIdentity -or
        [string]$HostIdentity.schema -ne "tinyrustlm.pinned_deployment_host.v1" -or
        [string]$HostIdentity.sha256 -notmatch "^[0-9a-f]{64}$" -or
        [int64]$HostIdentity.byte_count -le 0 -or
        [string]$HostIdentity.leaf_name -notin @("powershell.exe", "pwsh.exe") -or
        [string]$HostIdentity.version -ne [string]$PSVersionTable.PSVersion -or
        [string]$HostIdentity.edition -ne [string]$PSVersionTable.PSEdition -or
        [string]$HostIdentity.language_mode -ne
            [string]$ExecutionContext.SessionState.LanguageMode -or
        [string]$HostIdentity.process_architecture -ne
            $(if ([Environment]::Is64BitProcess) { "x64" } else { "x86" })) {
        throw "Pinned deployment PowerShell host identity changed."
    }
    $executableIdentity = [pscustomobject]@{
        schema = "tinyrustlm.pinned_deployment_executable.v1"
        command = [string]$HostIdentity.command
        leaf_name = [string]$HostIdentity.leaf_name
        path = [string]$HostIdentity.path
        byte_count = [int64]$HostIdentity.byte_count
        sha256 = [string]$HostIdentity.sha256
    }
    Assert-PinnedDeploymentExecutable -Executable $executableIdentity | Out-Null
    return $HostIdentity
}

# Reopens a pinned executable immediately around every child process launch.
function Assert-PinnedDeploymentExecutable {
    param([object]$Executable)

    if (-not $Executable -or
        [string]$Executable.schema -ne
            "tinyrustlm.pinned_deployment_executable.v1" -or
        [string]$Executable.sha256 -notmatch "^[0-9a-f]{64}$" -or
        [int64]$Executable.byte_count -le 0 -or
        -not [IO.Path]::IsPathRooted([string]$Executable.path)) {
        throw "Pinned deployment executable identity is invalid."
    }
    $path = [IO.Path]::GetFullPath([string]$Executable.path)
    if (-not [string]::Equals(
            [IO.Path]::GetFileName($path),
            [string]$Executable.leaf_name,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Pinned deployment executable is unavailable."
    }
    Assert-NoReparsePointAncestry `
        -Path $path `
        -FailureMessage "Pinned deployment executable traverses a reparse point."
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$item.Length -ne [int64]$Executable.byte_count -or
        (Get-FileSha256 -Path $path) -ne [string]$Executable.sha256) {
        throw "Pinned deployment executable bytes changed."
    }
    return $path
}

# Quotes one Windows process argument without allowing shell re-interpretation.
function ConvertTo-DeploymentProcessArgument {
    param([AllowEmptyString()][string]$Value)

    if ($null -eq $Value -or $Value.Contains([char]0) -or
        $Value.Contains("`r") -or $Value.Contains("`n")) {
        throw "Deployment subprocess argument is invalid."
    }
    if ($Value.Length -gt 32760) {
        throw "Deployment subprocess argument exceeds its bound."
    }
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') {
        return $Value
    }
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $backslashes += 1
            continue
        }
        if ($character -eq '"') {
            [void]$builder.Append(
                [string]::new([char]'\', (($backslashes * 2) + 1))
            )
            [void]$builder.Append('"')
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$builder.Append([string]::new([char]'\', $backslashes))
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        [void]$builder.Append(
            [string]::new([char]'\', ($backslashes * 2))
        )
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

# Creates a child process with an explicit executable and minimal inherited state.
function New-SanitizedDeploymentProcessStartInfo {
    param(
        [object]$Executable,
        [string[]]$Arguments,
        [string]$WorkingDirectory = ""
    )

    $path = Assert-PinnedDeploymentExecutable -Executable $Executable
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $path
    $start.Arguments = [string]::Join(" ", @($Arguments | ForEach-Object {
        ConvertTo-DeploymentProcessArgument -Value ([string]$_)
    }))
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    # Git and the source verifier's nested Git processes must work when the
    # canonical checkouts belong to the provisioning account. Synthesize only
    # these exact roots, resetting any system trust list first; never inherit
    # ambient Git configuration, trust a wildcard, or write persistent config.
    if ([string]::Equals($path, [string]$script:gitExecutable.path, [StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($path, [string]$script:nodeExecutable.path, [StringComparison]::OrdinalIgnoreCase)) {
        $gitTrustRoots = @(
            "E:/Source/Rust/LMComposer.com",
            "E:/Source/Rust/MiniModel.MiRust.com",
            "E:/Source/Rust/MiniModel.org",
            "E:/Source/Rust/MiRust.com",
            "E:/Source/Rust/Runtime.MiRust.com",
            "E:/Source/Rust/TinyRustLM.com",
            "E:/Source/Rust/TinyRustLM.MiRust.com"
        )
        $start.EnvironmentVariables["GIT_CONFIG_COUNT"] = [string]($gitTrustRoots.Count + 1)
        $start.EnvironmentVariables["GIT_CONFIG_KEY_0"] = "safe.directory"
        $start.EnvironmentVariables["GIT_CONFIG_VALUE_0"] = ""
        for ($index = 1; $index -le $gitTrustRoots.Count; $index++) {
            $start.EnvironmentVariables["GIT_CONFIG_KEY_$index"] = "safe.directory"
            $start.EnvironmentVariables["GIT_CONFIG_VALUE_$index"] = $gitTrustRoots[$index - 1]
        }
    }
    foreach ($name in @("SystemRoot", "WINDIR", "ComSpec", "TEMP", "TMP")) {
        $value = [Environment]::GetEnvironmentVariable($name, "Process")
        if ([string]::IsNullOrWhiteSpace($value) -or
            $value.Contains([char]0) -or
            -not [IO.Path]::IsPathRooted($value)) {
            throw "Deployment subprocess environment is unavailable or unsafe."
        }
        $resolvedValue = [IO.Path]::GetFullPath($value)
        $expectedPathType = if ($name -eq "ComSpec") { "Leaf" } else { "Container" }
        if (-not (Test-Path -LiteralPath $resolvedValue -PathType $expectedPathType)) {
            throw "Deployment subprocess environment is unavailable or unsafe."
        }
        Assert-NoReparsePointAncestry `
            -Path $resolvedValue `
            -FailureMessage "Deployment subprocess environment traverses a reparse point."
        $start.EnvironmentVariables[$name] = $resolvedValue
    }
    $executableDirectories = @(
        $script:powershellHost,
        $script:nodeExecutable,
        $script:curlExecutable,
        $script:gitExecutable
    ) | Where-Object { $_ } | ForEach-Object {
        Split-Path -Parent ([string]$_.path)
    } | Sort-Object -Unique
    if ($executableDirectories.Count -gt 0) {
        $start.EnvironmentVariables["PATH"] = [string]::Join(
            [IO.Path]::PathSeparator,
            [string[]]$executableDirectories
        )
    }
    if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        $resolvedWorkingDirectory = [IO.Path]::GetFullPath($WorkingDirectory)
        if (-not (Test-Path -LiteralPath $resolvedWorkingDirectory -PathType Container)) {
            throw "Deployment subprocess working directory is unavailable."
        }
        Assert-NoReparsePointAncestry `
            -Path $resolvedWorkingDirectory `
            -FailureMessage "Deployment subprocess working directory traverses a reparse point."
        $start.WorkingDirectory = $resolvedWorkingDirectory
    }
    return $start
}

# Runs one pinned local process and captures bounded text without ambient options.
function Invoke-PinnedDeploymentProcess {
    param(
        [object]$Executable,
        [string[]]$Arguments,
        [string]$WorkingDirectory = "",
        [ValidateRange(1000, 600000)]
        [int]$TimeoutMilliseconds = 300000,
        [ValidateRange(1024, 16777216)]
        [int]$MaximumOutputCharacters = (4 * 1024 * 1024)
    )

    $start = New-SanitizedDeploymentProcessStartInfo `
        -Executable $Executable `
        -Arguments $Arguments `
        -WorkingDirectory $WorkingDirectory
    $process = $null
    try {
        $process = [Diagnostics.Process]::Start($start)
        $stdoutRead = $process.StandardOutput.ReadToEndAsync()
        $stderrRead = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutMilliseconds)) {
            try { $process.Kill() } catch { }
            throw "Pinned deployment subprocess timed out."
        }
        $stdout = [string]$stdoutRead.GetAwaiter().GetResult()
        $stderr = [string]$stderrRead.GetAwaiter().GetResult()
        if (($stdout.Length + $stderr.Length) -gt $MaximumOutputCharacters) {
            throw "Pinned deployment subprocess output exceeds its bound."
        }
        Assert-PinnedDeploymentExecutable -Executable $Executable | Out-Null
        $normalized = $stdout.Replace("`r`n", "`n").Replace("`r", "`n")
        $lines = if ($normalized.Length -eq 0) {
            @()
        }
        else {
            @($normalized.TrimEnd("`n").Split([char]"`n"))
        }
        return [pscustomobject]@{
            exit_code = [int]$process.ExitCode
            stdout_lines = $lines
            stderr_present = -not [string]::IsNullOrEmpty($stderr)
        }
    }
    finally {
        if ($process) {
            $process.Dispose()
        }
    }
}

# Validates tool versions only after their executable bytes have been pinned.
function Assert-PinnedDeploymentToolVersions {
    param(
        [object]$PowerShellHost,
        [object]$NodeExecutable,
        [object]$CurlExecutable,
        [object]$GitExecutable
    )

    Assert-PinnedDeploymentHost -HostIdentity $PowerShellHost | Out-Null

    $nodeVersion = Invoke-PinnedDeploymentProcess `
        -Executable $NodeExecutable `
        -Arguments @("--version")
    $nodeVersionLines = @($nodeVersion.stdout_lines)
    $nodeVersionText = if ($nodeVersionLines.Count -eq 1) {
        ([string]$nodeVersionLines[0]).Trim()
    }
    else {
        ""
    }
    $nodeVersionParts = @($nodeVersionText.TrimStart([char]"v").Split("."))
    [int]$nodeMajor = 0
    if ($nodeVersion.exit_code -ne 0 -or
        $nodeVersionLines.Count -ne 1 -or
        $nodeVersionText -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$' -or
        $nodeVersionParts.Count -ne 3 -or
        -not [int]::TryParse($nodeVersionParts[0], [ref]$nodeMajor) -or
        $nodeMajor -lt 24) {
        throw "Pinned Node executable does not satisfy the deployment version contract."
    }
    $curlVersion = Invoke-PinnedDeploymentProcess `
        -Executable $CurlExecutable `
        -Arguments @("--version")
    $curlVersionLines = @($curlVersion.stdout_lines)
    $curlHeader = if ($curlVersionLines.Count -gt 0) {
        [string]$curlVersionLines[0]
    }
    else {
        ""
    }
    if ($curlVersion.exit_code -ne 0 -or
        $curlVersionLines.Count -lt 1 -or
        $curlHeader -notmatch '^curl [0-9]+\.[0-9]+\.[0-9]+ ' -or
        -not ($curlVersionLines -match '^Protocols:.*\bftps\b.*\bhttps\b')) {
        throw "Pinned curl executable does not satisfy the deployment version contract."
    }
    $curlVersionText = $curlHeader.Split(" ")[1]
    $gitVersion = Invoke-PinnedDeploymentProcess `
        -Executable $GitExecutable `
        -Arguments @("--version")
    $gitVersionLines = @($gitVersion.stdout_lines)
    if ($gitVersion.exit_code -ne 0 -or
        $gitVersionLines.Count -ne 1 -or
        [string]$gitVersionLines[0] -notmatch
            '^git version (?<git>[0-9]+\.[0-9]+\.[0-9]+)(?:\.windows\.[0-9]+)?$') {
        throw "Pinned Git executable does not satisfy the deployment version contract."
    }
    return [pscustomobject]@{
        powershell_version = [string]$PowerShellHost.version
        powershell_edition = [string]$PowerShellHost.edition
        powershell_language_mode = [string]$PowerShellHost.language_mode
        node_version = $nodeVersionText
        curl_version = $curlVersionText
        git_version = (([string]$gitVersionLines[0]) -replace
            '^git version ', '') -replace '\.windows\.[0-9]+$', ''
        environment_allowlisted = $true
        node_options_inherited = $false
        inherited_environment_names = @(
            "ComSpec",
            "PATH",
            "SystemRoot",
            "TEMP",
            "TMP",
            "WINDIR"
        )
    }
}

# Describes sequential FTPS limits; this contract alone never admits publication.
function Get-DeploymentTransportCapability {
    return [pscustomobject]@{
        schema = "tinyrustlm.deployment_transport_capability.v2"
        transport = "ftps-sequential"
        status = "bounded-sequential"
        coordination_scope = "single-host-canonical-artifacts"
        per_artifact_recovery = "verified-predecessor-best-effort"
        marker_ordering = "last-final-path-promotion-before-owned-cleanup"
        mixed_publication_possible = $true
        remote_global_compare_and_swap_lease = $false
        release_wide_atomic_rollback = $false
        final_marker_can_be_last_remote_mutation = $false
    }
}

# Rejects obsolete or overstated guarantees without manufacturing remote capabilities.
function Assert-SafeDeploymentTransportCapability {
    param([object]$Capability)

    $expected = Get-DeploymentTransportCapability
    if (-not $Capability -or @($Capability.PSObject.Properties).Count -ne
        @($expected.PSObject.Properties).Count) {
        throw "Deployment transport capability evidence is invalid."
    }
    foreach ($property in $expected.PSObject.Properties) {
        $observed = $Capability.PSObject.Properties[$property.Name]
        if (-not $observed -or $null -eq $observed.Value -or
            $observed.Value.GetType() -ne $property.Value.GetType() -or
            $observed.Value -cne $property.Value) {
            throw "Deployment transport capability evidence is invalid."
        }
    }
}

# Creates a same-host create-only guard. It never proves remote/global exclusion.
function New-ExclusiveDeploymentLease {
    param(
        [string]$LeasePath,
        [string]$AttemptId,
        [string]$ReleaseId,
        [string]$SourceCommit,
        [string]$ToolClosureSha256
    )

    if ([string]::IsNullOrWhiteSpace($LeasePath) -or
        -not [IO.Path]::IsPathRooted($LeasePath) -or
        [IO.Path]::GetFileName($LeasePath) -ne
            "tinyrustlm.com.deployment-lease.v1.json" -or
        $AttemptId -notmatch "^[0-9]{8}T[0-9]{13}Z-[0-9a-f]{12}$" -or
        $ReleaseId -ne "tinyrustlm.com@0.5.0" -or
        $SourceCommit -notmatch "^[0-9a-f]{40}$" -or
        $ToolClosureSha256 -notmatch "^[0-9a-f]{64}$") {
        throw "Exclusive deployment lease identity is invalid."
    }
    $path = Assert-CanonicalDeploymentArtifactPath -Path $LeasePath
    $parent = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Exclusive deployment lease parent is unavailable."
    }
    Assert-NoReparsePointAncestry `
        -Path $parent `
        -FailureMessage "Exclusive deployment lease parent is unsafe."
    $leaseId = [Guid]::NewGuid().ToString("N")
    $text = '{"attempt_id":"' + $AttemptId +
        '","lease_id":"' + $leaseId +
        '","release_id":"' + $ReleaseId +
        '","schema":"tinyrustlm.exclusive_deployment_lease.v1"' +
        ',"source_commit":"' + $SourceCommit +
        '","tool_closure_sha256":"' + $ToolClosureSha256 + '"}' + "`n"
    $bytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($text)
    $stream = $null
    try {
        $stream = [IO.FileStream]::new(
            $path,
            [IO.FileMode]::CreateNew,
            [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::None,
            4096,
            [IO.FileOptions]::WriteThrough
        )
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
        return [pscustomobject]@{
            schema = "tinyrustlm.exclusive_deployment_lease.v1"
            path = $path
            attempt_id = $AttemptId
            lease_id = $leaseId
            release_id = $ReleaseId
            source_commit = $SourceCommit
            tool_closure_sha256 = $ToolClosureSha256
            coordination_scope = "single-host-canonical-artifacts"
            remote_global_exclusion_proven = $false
            byte_count = [int64]$bytes.Length
            sha256 = Get-ByteArraySha256 -Bytes $bytes
            bytes = $bytes
            handle = $stream
        }
    }
    catch {
        if ($stream) {
            $stream.Dispose()
        }
        throw "Exclusive deployment lease is active or crash residue exists."
    }
}

# Removes only the exact lease held by this process; mismatched residue remains blocking.
function Remove-ExclusiveDeploymentLease {
    param([object]$Lease)

    if (-not $Lease -or
        [string]$Lease.schema -ne "tinyrustlm.exclusive_deployment_lease.v1" -or
        [string]$Lease.lease_id -notmatch "^[0-9a-f]{32}$" -or
        [string]$Lease.sha256 -notmatch "^[0-9a-f]{64}$" -or
        [int64]$Lease.byte_count -le 0 -or
        [string]$Lease.coordination_scope -ne "single-host-canonical-artifacts" -or
        $Lease.remote_global_exclusion_proven -ne $false -or
        -not $Lease.handle -or
        -not $Lease.bytes) {
        throw "Exclusive deployment lease cleanup identity is invalid."
    }
    $path = Assert-CanonicalDeploymentArtifactPath -Path ([string]$Lease.path)
    try {
        $Lease.handle.Flush($true)
        $Lease.handle.Position = 0
        $observed = New-Object byte[] ([int]$Lease.byte_count)
        $offset = 0
        while ($offset -lt $observed.Length) {
            $count = $Lease.handle.Read(
                $observed,
                $offset,
                $observed.Length - $offset
            )
            if ($count -le 0) {
                throw "Exclusive deployment lease bytes are truncated."
            }
            $offset += $count
        }
        if ($Lease.handle.ReadByte() -ne -1 -or
            -not (Test-ExactByteArray -Left $observed -Right ([byte[]]$Lease.bytes)) -or
            (Get-ByteArraySha256 -Bytes $observed) -ne [string]$Lease.sha256) {
            throw "Exclusive deployment lease identity changed."
        }
    }
    finally {
        $Lease.handle.Dispose()
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Exclusive deployment lease disappeared before cleanup."
    }
    Assert-NoReparsePointAncestry `
        -Path $path `
        -FailureMessage "Exclusive deployment lease cleanup target is unsafe."
    $diskBytes = [IO.File]::ReadAllBytes($path)
    if (-not (Test-ExactByteArray -Left $diskBytes -Right ([byte[]]$Lease.bytes)) -or
        (Get-ByteArraySha256 -Bytes $diskBytes) -ne [string]$Lease.sha256) {
        throw "Exclusive deployment lease cleanup identity changed."
    }
    [IO.File]::Delete($path)
    if (Test-Path -LiteralPath $path) {
        throw "Exclusive deployment lease cleanup could not be verified."
    }
    return [pscustomobject]@{
        lease_id = [string]$Lease.lease_id
        cleanup_verified = $true
    }
}

# Creates one marker-bound, non-reparse ValidateOnly materialization root.
function New-OwnedValidationMaterialization {
    param([string]$OperationRoot, [string]$SourceRoot, [string]$OperationId)

    if ([string]::IsNullOrWhiteSpace($OperationRoot) -or
        -not [IO.Path]::IsPathRooted($OperationRoot) -or
        [string]::IsNullOrWhiteSpace($SourceRoot) -or
        -not [IO.Path]::IsPathRooted($SourceRoot) -or
        $OperationId -notmatch "^[0-9a-f]{32}$") {
        throw "Owned validation materialization identity is invalid."
    }
    $root = Assert-CanonicalDeploymentArtifactPath -Path $OperationRoot -SourceRoot $SourceRoot
    if ([IO.Path]::GetFileName($root) -ne
        ("tinyrustlm-web-validation-{0}" -f $OperationId)) {
        throw "Owned validation materialization identity is invalid."
    }
    if (Test-Path -LiteralPath $root) {
        throw "Owned validation materialization root is unavailable."
    }
    $parent = Split-Path -Parent $root
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Owned validation materialization parent is unavailable."
    }
    Assert-NoReparsePointAncestry `
        -Path $parent `
        -FailureMessage "Owned validation materialization parent is unsafe."
    [IO.Directory]::CreateDirectory($root) | Out-Null
    Assert-NoReparsePointAncestry `
        -Path $root `
        -FailureMessage "Owned validation materialization root is unsafe."
    $releaseRoot = Join-Path $root "release"
    [IO.Directory]::CreateDirectory($releaseRoot) | Out-Null
    $ownerText = '{"operation_id":"' + $OperationId +
        '","schema":"tinyrustlm.validation_materialization_owner.v1"}' + "`n"
    $ownerBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($ownerText)
    $ownerPath = Join-Path $root "owner.v1.json"
    $descriptor = [IO.FileStream]::new(
        $ownerPath,
        [IO.FileMode]::CreateNew,
        [IO.FileAccess]::Write,
        [IO.FileShare]::None,
        4096,
        [IO.FileOptions]::WriteThrough
    )
    try {
        $descriptor.Write($ownerBytes, 0, $ownerBytes.Length)
        $descriptor.Flush($true)
    }
    finally {
        $descriptor.Dispose()
    }
    return [pscustomobject]@{
        schema = "tinyrustlm.validation_materialization_owner.v1"
        operation_id = $OperationId
        operation_root = $root
        release_root = $releaseRoot
        owner_path = $ownerPath
        owner_bytes = $ownerBytes
        owner_sha256 = Get-ByteArraySha256 -Bytes $ownerBytes
    }
}

# Deletes a ValidateOnly tree only after a marker and exact bounded inventory agree.
function Remove-OwnedValidationMaterialization {
    param([object]$Materialization)

    if (-not $Materialization -or
        [string]$Materialization.schema -ne
            "tinyrustlm.validation_materialization_owner.v1" -or
        [string]$Materialization.operation_id -notmatch "^[0-9a-f]{32}$" -or
        [string]$Materialization.owner_sha256 -notmatch "^[0-9a-f]{64}$") {
        throw "Owned validation materialization cleanup identity is invalid."
    }
    $root = Assert-CanonicalDeploymentArtifactPath -Path ([string]$Materialization.operation_root)
    $releaseRoot = [IO.Path]::GetFullPath([string]$Materialization.release_root)
    $ownerPath = [IO.Path]::GetFullPath([string]$Materialization.owner_path)
    if ([IO.Path]::GetFileName($root) -ne
        ("tinyrustlm-web-validation-{0}" -f
            [string]$Materialization.operation_id) -or
        $releaseRoot -ne [IO.Path]::GetFullPath((Join-Path $root "release")) -or
        $ownerPath -ne [IO.Path]::GetFullPath((Join-Path $root "owner.v1.json")) -or
        -not (Test-Path -LiteralPath $root -PathType Container) -or
        -not (Test-Path -LiteralPath $releaseRoot -PathType Container) -or
        -not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) {
        throw "Owned validation materialization cleanup identity is invalid."
    }
    foreach ($path in @($root, $releaseRoot, $ownerPath)) {
        Assert-NoReparsePointAncestry `
            -Path $path `
            -FailureMessage "Owned validation materialization cleanup target is unsafe."
    }
    $ownerBytes = [IO.File]::ReadAllBytes($ownerPath)
    if (-not (Test-ExactByteArray `
            -Left $ownerBytes `
            -Right ([byte[]]$Materialization.owner_bytes)) -or
        (Get-ByteArraySha256 -Bytes $ownerBytes) -ne
            [string]$Materialization.owner_sha256) {
        throw "Owned validation materialization marker changed."
    }
    $rootEntries = @(Get-ChildItem -LiteralPath $root -Force)
    if ($rootEntries.Count -ne 2 -or
        @($rootEntries | Where-Object {
            $_.Name -ne "owner.v1.json" -and $_.Name -ne "release"
        }).Count -ne 0) {
        throw "Owned validation materialization inventory is unexpected."
    }
    $releaseEntries = @(Get-ChildItem -LiteralPath $releaseRoot -Force)
    if ($releaseEntries.Count -gt 1 -or
        @($releaseEntries | Where-Object {
            $_.Name -ne ".well-known" -or -not $_.PSIsContainer
        }).Count -ne 0) {
        throw "Owned validation materialization inventory is unexpected."
    }
    $knownRoot = Join-Path $releaseRoot ".well-known"
    $generatedFiles = @()
    if (Test-Path -LiteralPath $knownRoot) {
        Assert-NoReparsePointAncestry `
            -Path $knownRoot `
            -FailureMessage "Owned validation materialization cleanup target is unsafe."
        $knownEntries = @(Get-ChildItem -LiteralPath $knownRoot -Force)
        foreach ($entry in $knownEntries) {
            if ($entry.PSIsContainer -or
                ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
                $entry.Name -notin @(
                    "site-release-history.json",
                    "site-release.json"
                )) {
                throw "Owned validation materialization inventory is unexpected."
            }
            $generatedFiles += $entry.FullName
        }
    }
    foreach ($filePath in $generatedFiles) {
        [IO.File]::Delete($filePath)
    }
    if (Test-Path -LiteralPath $knownRoot) {
        [IO.Directory]::Delete($knownRoot)
    }
    [IO.Directory]::Delete($releaseRoot)
    [IO.File]::Delete($ownerPath)
    [IO.Directory]::Delete($root)
    if (Test-Path -LiteralPath $root) {
        throw "Owned validation materialization cleanup could not be verified."
    }
    return [pscustomobject]@{
        cleanup_verified = $true
        removed_generated_file_count = $generatedFiles.Count
    }
}

# Creates an immediately marked root for one finalized-ledger candidate.
function New-OwnedFinalizedLedgerCandidate {
    param([string]$OperationRoot, [string]$SourceRoot, [string]$OperationId)

    if ([string]::IsNullOrWhiteSpace($OperationRoot) -or
        -not [IO.Path]::IsPathRooted($OperationRoot) -or
        [string]::IsNullOrWhiteSpace($SourceRoot) -or
        -not [IO.Path]::IsPathRooted($SourceRoot) -or
        $OperationId -notmatch "^[0-9a-f]{32}$") {
        throw "Finalized-ledger candidate custody identity is invalid."
    }
    $root = Assert-CanonicalDeploymentArtifactPath -Path $OperationRoot -SourceRoot $SourceRoot
    if ([IO.Path]::GetFileName($root) -ne
            ("tinyrustlm-finalized-ledger-candidate-{0}" -f $OperationId) -or
        (Test-Path -LiteralPath $root)) {
        throw "Finalized-ledger candidate custody root is unavailable."
    }
    $parent = Split-Path -Parent $root
    Assert-NoReparsePointAncestry `
        -Path $parent `
        -FailureMessage "Finalized-ledger candidate custody parent is unsafe."
    [IO.Directory]::CreateDirectory($root) | Out-Null
    $ownerText = '{"operation_id":"' + $OperationId +
        '","schema":"tinyrustlm.finalized_ledger_candidate_owner.v1"}' + "`n"
    $ownerBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($ownerText)
    $ownerPath = Join-Path $root "owner.v1.json"
    $stream = $null
    try {
        Assert-NoReparsePointAncestry `
            -Path $root `
            -FailureMessage "Finalized-ledger candidate custody root is unsafe."
        $stream = [IO.FileStream]::new(
            $ownerPath,
            [IO.FileMode]::CreateNew,
            [IO.FileAccess]::Write,
            [IO.FileShare]::None,
            4096,
            [IO.FileOptions]::WriteThrough
        )
        $stream.Write($ownerBytes, 0, $ownerBytes.Length)
        $stream.Flush($true)
    }
    catch {
        if ($stream) {
            $stream.Dispose()
            $stream = $null
        }
        if (Test-Path -LiteralPath $ownerPath -PathType Leaf) {
            [IO.File]::Delete($ownerPath)
        }
        if ((Test-Path -LiteralPath $root -PathType Container) -and
            @(Get-ChildItem -LiteralPath $root -Force).Count -eq 0) {
            [IO.Directory]::Delete($root)
        }
        throw "Finalized-ledger candidate owner creation failed."
    }
    finally {
        if ($stream) {
            $stream.Dispose()
        }
    }
    return [pscustomobject]@{
        schema = "tinyrustlm.finalized_ledger_candidate_owner.v1"
        operation_id = $OperationId
        operation_root = $root
        owner_path = $ownerPath
        owner_bytes = $ownerBytes
        owner_sha256 = Get-ByteArraySha256 -Bytes $ownerBytes
        candidate_path = Join-Path $root "site-release-ledger.finalized.v1.json"
    }
}

# Removes an uncommitted candidate root after exact inventory and identity checks.
function Remove-OwnedFinalizedLedgerCandidate {
    param(
        [object]$Candidate,
        [AllowNull()][Nullable[int64]]$ExpectedByteCount,
        [AllowEmptyString()][string]$ExpectedSha256 = ""
    )

    if (-not $Candidate -or
        [string]$Candidate.schema -ne
            "tinyrustlm.finalized_ledger_candidate_owner.v1" -or
        [string]$Candidate.operation_id -notmatch "^[0-9a-f]{32}$" -or
        [string]$Candidate.owner_sha256 -notmatch "^[0-9a-f]{64}$") {
        throw "Finalized-ledger candidate cleanup identity is invalid."
    }
    $root = Assert-CanonicalDeploymentArtifactPath -Path ([string]$Candidate.operation_root)
    $ownerPath = [IO.Path]::GetFullPath([string]$Candidate.owner_path)
    $candidatePath = [IO.Path]::GetFullPath([string]$Candidate.candidate_path)
    if ([IO.Path]::GetFileName($root) -ne
            ("tinyrustlm-finalized-ledger-candidate-{0}" -f
                [string]$Candidate.operation_id) -or
        $ownerPath -ne [IO.Path]::GetFullPath((Join-Path $root "owner.v1.json")) -or
        $candidatePath -ne [IO.Path]::GetFullPath(
            (Join-Path $root "site-release-ledger.finalized.v1.json")
        ) -or
        -not (Test-Path -LiteralPath $root -PathType Container) -or
        -not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) {
        throw "Finalized-ledger candidate cleanup target is invalid."
    }
    foreach ($path in @($root, $ownerPath)) {
        Assert-NoReparsePointAncestry `
            -Path $path `
            -FailureMessage "Finalized-ledger candidate cleanup target is unsafe."
    }
    [byte[]]$ownerBytes = [IO.File]::ReadAllBytes($ownerPath)
    if (-not (Test-ExactByteArray `
            -Left $ownerBytes `
            -Right ([byte[]]$Candidate.owner_bytes)) -or
        (Get-ByteArraySha256 -Bytes $ownerBytes) -ne
            [string]$Candidate.owner_sha256) {
        throw "Finalized-ledger candidate owner marker changed."
    }
    $entries = @(Get-ChildItem -LiteralPath $root -Force)
    if ($entries.Count -lt 1 -or $entries.Count -gt 2 -or
        @($entries | Where-Object {
            $_.Name -ne "owner.v1.json" -and
            $_.Name -ne "site-release-ledger.finalized.v1.json"
        }).Count -ne 0) {
        throw "Finalized-ledger candidate cleanup inventory is unexpected."
    }
    $removedCandidate = $false
    if (Test-Path -LiteralPath $candidatePath) {
        Assert-NoReparsePointAncestry `
            -Path $candidatePath `
            -FailureMessage "Finalized-ledger candidate cleanup target is unsafe."
        $item = Get-Item -LiteralPath $candidatePath -Force
        if ($item.PSIsContainer -or
            ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            [int64]$item.Length -le 0 -or
            [int64]$item.Length -gt (1024 * 1024)) {
            throw "Finalized-ledger candidate cleanup file is unsafe."
        }
        $digest = Get-FileSha256 -Path $candidatePath
        if ($null -ne $ExpectedByteCount -and
            [int64]$ExpectedByteCount -ne [int64]$item.Length) {
            throw "Finalized-ledger candidate byte count changed before cleanup."
        }
        if (-not [string]::IsNullOrEmpty($ExpectedSha256) -and
            $ExpectedSha256 -ne $digest) {
            throw "Finalized-ledger candidate hash changed before cleanup."
        }
        Assert-NoReparsePointAncestry `
            -Path $candidatePath `
            -FailureMessage "Finalized-ledger candidate cleanup target is unsafe."
        $deletionItem = Get-Item -LiteralPath $candidatePath -Force
        if ($deletionItem.PSIsContainer -or
            ($deletionItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            [int64]$deletionItem.Length -ne [int64]$item.Length -or
            (Get-FileSha256 -Path $candidatePath) -ne $digest) {
            throw "Finalized-ledger candidate changed at deletion time."
        }
        [IO.File]::Delete($candidatePath)
        $removedCandidate = $true
    }
    [byte[]]$deletionOwnerBytes = [IO.File]::ReadAllBytes($ownerPath)
    if (-not (Test-ExactByteArray `
            -Left $deletionOwnerBytes `
            -Right ([byte[]]$Candidate.owner_bytes)) -or
        @(Get-ChildItem -LiteralPath $root -Force).Count -ne 1) {
        throw "Finalized-ledger candidate owner changed at deletion time."
    }
    [IO.File]::Delete($ownerPath)
    Assert-NoReparsePointAncestry `
        -Path $root `
        -FailureMessage "Finalized-ledger candidate cleanup root is unsafe."
    if (@(Get-ChildItem -LiteralPath $root -Force).Count -ne 0) {
        throw "Finalized-ledger candidate cleanup root is not empty."
    }
    [IO.Directory]::Delete($root)
    if (Test-Path -LiteralPath $root) {
        throw "Finalized-ledger candidate cleanup could not be verified."
    }
    return [pscustomobject]@{
        cleanup_verified = $true
        candidate_removed = $removedCandidate
    }
}

# Splits the exact final current-release marker from all preceding publication bytes.
function Get-DeploymentPublicationPlan {
    param([object[]]$Entries)

    if (-not $Entries -or $Entries.Count -lt 2) {
        throw "Deployment publication plan is invalid."
    }
    $markerPath = ".well-known/site-release.json"
    $markers = @($Entries | Where-Object {
        [string]$_.remote -eq $markerPath
    })
    if ($markers.Count -ne 1 -or
        [string]$Entries[$Entries.Count - 1].remote -ne $markerPath) {
        throw "Deployment commit marker must be the final publication entry."
    }
    $regular = @($Entries | Select-Object -First ($Entries.Count - 1))
    if (@($regular | Where-Object {
        [string]$_.remote -eq $markerPath
    }).Count -ne 0 -or
        @($regular | Where-Object {
            [string]$_.remote -eq ".well-known/site-release-history.json"
        }).Count -ne 1) {
        throw "Deployment publication plan is invalid."
    }
    return [pscustomobject]@{
        regular = $regular
        commit_marker = $markers[0]
    }
}

# Resolves only current publisher code and storage policy data within the canonical source.
function Resolve-DeploymentCustodyFilePath {
    param([string]$RepositoryRoot, [string]$RelativePath)

    $root = Assert-CanonicalDeploymentSourceRoot -RepositoryRoot $RepositoryRoot
    if ($RelativePath -cnotmatch
        "^(?:tinyrustlm/tools/[A-Za-z0-9._/-]+\.js|tinyrustlm/tools/deploy-tinyrustlm-web\.ps1|contracts/storage/[A-Za-z0-9._/-]+\.json)$" -or
        $RelativePath -match "(^|/)(\.{1,2}|)(/|$)") {
        throw "Deployment source custody path is invalid."
    }
    $path = [IO.Path]::GetFullPath((Join-Path $root $RelativePath.Replace("/", "\")))
    $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
    if (-not $path.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Deployment source custody path is invalid."
    }
    return $path
}

# Follows literal relative CommonJS imports; JSON policy leaves are hashed, never scanned as code.
function Get-DeploymentNodeToolClosure {
    param([string]$RepositoryRoot, [string[]]$EntryPaths)

    $root = Assert-CanonicalDeploymentSourceRoot -RepositoryRoot $RepositoryRoot
    $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
    $queue = [Collections.Generic.Queue[string]]::new()
    foreach ($entryPath in $EntryPaths) {
        $queue.Enqueue([IO.Path]::GetFullPath($entryPath))
    }
    $observed = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    $files = @()
    $dependencyPattern = 'require\s*\(\s*["''](?<path>\.\.?/[^"'']+)["'']\s*\)'
    while ($queue.Count -gt 0) {
        $path = $queue.Dequeue()
        if (-not $observed.Add($path)) {
            continue
        }
        if ($observed.Count -gt 128 -or
            -not $path.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or
            -not (Test-Path -LiteralPath $path -PathType Leaf) -or
            [IO.Path]::GetExtension($path) -cnotin @(".js", ".json")) {
            throw "Deployment Node tool closure is invalid."
        }
        $relative = $path.Substring($root.Length + 1).Replace("\", "/")
        Resolve-DeploymentCustodyFilePath -RepositoryRoot $root -RelativePath $relative | Out-Null
        Assert-NoReparsePointAncestry `
            -Path $path `
            -FailureMessage "Deployment Node tool closure traverses a reparse point."
        $item = Get-Item -LiteralPath $path -Force
        if ([int64]$item.Length -le 0 -or [int64]$item.Length -gt (8 * 1024 * 1024)) {
            throw "Deployment Node tool closure contains an oversized file."
        }
        $files += [pscustomobject]@{
            relative_path = $relative
            byte_count = [int64]$item.Length
            sha256 = Get-FileSha256 -Path $path
        }
        if ([IO.Path]::GetExtension($path) -ceq ".json") {
            continue
        }
        $text = [IO.File]::ReadAllText(
            $path,
            [Text.UTF8Encoding]::new($false, $true)
        )
        foreach ($match in [regex]::Matches($text, $dependencyPattern)) {
            $dependency = [IO.Path]::GetFullPath(
                (Join-Path (Split-Path -Parent $path) $match.Groups["path"].Value)
            )
            if ([string]::IsNullOrEmpty([IO.Path]::GetExtension($dependency))) {
                $dependency += ".js"
            }
            $queue.Enqueue($dependency)
        }
    }
    return @($files | Sort-Object -Property relative_path)
}

# Seals HEAD, clean status, publisher bytes, and the recursively loaded Node tool closure.
function New-DeploymentSourceCustody {
    param(
        [string]$RepositoryRoot,
        [string]$PublisherPath,
        [string[]]$NodeToolPaths
    )

    $root = Assert-CanonicalDeploymentSourceRoot -RepositoryRoot $RepositoryRoot
    $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
    $statusResult = Invoke-PinnedDeploymentProcess `
        -Executable $script:gitExecutable `
        -Arguments @("-C", $root, "status", "--porcelain=v1", "--untracked-files=all") `
        -WorkingDirectory $root
    $status = @($statusResult.stdout_lines)
    if ($statusResult.exit_code -ne 0 -or $status.Count -ne 0) {
        throw "Deployment source custody requires a clean Git worktree."
    }
    $commitResult = Invoke-PinnedDeploymentProcess `
        -Executable $script:gitExecutable `
        -Arguments @("-C", $root, "rev-parse", "HEAD") `
        -WorkingDirectory $root
    $commitOutput = @($commitResult.stdout_lines)
    if ($commitResult.exit_code -ne 0 -or $commitOutput.Count -ne 1 -or
        [string]$commitOutput[0] -notmatch "^[0-9a-f]{40}$") {
        throw "Deployment source custody could not bind HEAD."
    }
    $publisher = [IO.Path]::GetFullPath($PublisherPath)
    if (-not $publisher.StartsWith(
            $rootPrefix,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        -not (Test-Path -LiteralPath $publisher -PathType Leaf)) {
        throw "Deployment publisher source is unavailable."
    }
    Assert-NoReparsePointAncestry `
        -Path $publisher `
        -FailureMessage "Deployment publisher source traverses a reparse point."
    $publisherItem = Get-Item -LiteralPath $publisher -Force
    $publisherRelative = $publisher.Substring(
        $root.Length + 1
    ).Replace("\", "/")
    Resolve-DeploymentCustodyFilePath -RepositoryRoot $root -RelativePath $publisherRelative | Out-Null
    $files = @([pscustomobject]@{
        relative_path = $publisherRelative
        byte_count = [int64]$publisherItem.Length
        sha256 = Get-FileSha256 -Path $publisher
    }) + @(Get-DeploymentNodeToolClosure `
        -RepositoryRoot $root `
        -EntryPaths $NodeToolPaths)
    $relativePaths = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::Ordinal
    )
    foreach ($file in $files) {
        if (-not $relativePaths.Add([string]$file.relative_path)) {
            throw "Deployment source custody contains duplicate tools."
        }
        $trackedResult = Invoke-PinnedDeploymentProcess `
            -Executable $script:gitExecutable `
            -Arguments @(
                "-C",
                $root,
                "ls-files",
                "--error-unmatch",
                "--",
                [string]$file.relative_path
            ) `
            -WorkingDirectory $root
        if ($trackedResult.exit_code -ne 0) {
            throw "Deployment source custody contains an untracked tool."
        }
    }
    $files = @($files | Sort-Object -Property relative_path)
    $identityText = [string]::Join("`n", @($files | ForEach-Object {
        "{0}|{1}|{2}" -f $_.relative_path, $_.byte_count, $_.sha256
    })) + "`n"
    return [pscustomobject]@{
        schema = "tinyrustlm.deployment_source_custody.v1"
        source_commit = ([string]$commitOutput[0]).Trim()
        source_tree_clean = $true
        tool_file_count = $files.Count
        tool_closure_sha256 = Get-Utf8Sha256 -Value $identityText
        files = $files
    }
}

# Recomputes the sealed source/tool identity immediately around every mutable tool process.
function Assert-DeploymentSourceCustody {
    param([string]$RepositoryRoot, [object]$Custody)

    if (-not $Custody -or
        [string]$Custody.schema -ne "tinyrustlm.deployment_source_custody.v1" -or
        [string]$Custody.source_commit -notmatch "^[0-9a-f]{40}$" -or
        [string]$Custody.tool_closure_sha256 -notmatch "^[0-9a-f]{64}$" -or
        [int]$Custody.tool_file_count -le 0 -or
        @($Custody.files).Count -ne [int]$Custody.tool_file_count) {
        throw "Deployment source custody identity is invalid."
    }
    $root = Assert-CanonicalDeploymentSourceRoot -RepositoryRoot $RepositoryRoot
    $statusResult = Invoke-PinnedDeploymentProcess `
        -Executable $script:gitExecutable `
        -Arguments @("-C", $root, "status", "--porcelain=v1", "--untracked-files=all") `
        -WorkingDirectory $root
    $status = @($statusResult.stdout_lines)
    $commitResult = Invoke-PinnedDeploymentProcess `
        -Executable $script:gitExecutable `
        -Arguments @("-C", $root, "rev-parse", "HEAD") `
        -WorkingDirectory $root
    $commitOutput = @($commitResult.stdout_lines)
    if ($statusResult.exit_code -ne 0 -or $commitResult.exit_code -ne 0 -or
        $status.Count -ne 0 -or
        $commitOutput.Count -ne 1 -or
        ([string]$commitOutput[0]).Trim() -ne [string]$Custody.source_commit) {
        throw "Deployment source custody changed."
    }
    $identityRows = @()
    foreach ($file in @($Custody.files)) {
        $path = Resolve-DeploymentCustodyFilePath `
            -RepositoryRoot $root -RelativePath ([string]$file.relative_path)
        if ([string]$file.sha256 -notmatch "^[0-9a-f]{64}$" -or
            [int64]$file.byte_count -le 0 -or [int64]$file.byte_count -gt (8 * 1024 * 1024)) {
            throw "Deployment source custody path is invalid."
        }
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Deployment source custody tool is unavailable."
        }
        Assert-NoReparsePointAncestry `
            -Path $path `
            -FailureMessage "Deployment source custody tool traverses a reparse point."
        $item = Get-Item -LiteralPath $path -Force
        $digest = Get-FileSha256 -Path $path
        if ([int64]$item.Length -ne [int64]$file.byte_count -or
            $digest -ne [string]$file.sha256) {
            throw "Deployment source custody tool hash changed."
        }
        $identityRows += "{0}|{1}|{2}" -f `
            $file.relative_path,
            $file.byte_count,
            $file.sha256
    }
    $identityText = [string]::Join("`n", $identityRows) + "`n"
    if ((Get-Utf8Sha256 -Value $identityText) -ne
        [string]$Custody.tool_closure_sha256) {
        throw "Deployment source custody closure changed."
    }
    return [pscustomobject]@{
        status = "pass"
        source_commit = [string]$Custody.source_commit
        source_tree_clean = $true
        tool_file_count = [int]$Custody.tool_file_count
        tool_closure_sha256 = [string]$Custody.tool_closure_sha256
    }
}

# Executes one sealed Node entry point with source checks immediately before and after it.
function Invoke-CustodiedNodeTool {
    param(
        [string]$RepositoryRoot,
        [object]$Custody,
        [string]$ToolPath,
        [string[]]$Arguments
    )

    $root = Assert-CanonicalDeploymentSourceRoot -RepositoryRoot $RepositoryRoot
    $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
    $tool = [IO.Path]::GetFullPath($ToolPath)
    if (-not $tool.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Node tool is outside deployment source custody."
    }
    $relative = $tool.Substring($root.Length + 1).Replace("\", "/")
    Resolve-DeploymentCustodyFilePath -RepositoryRoot $root -RelativePath $relative | Out-Null
    if (-not $relative.StartsWith("tinyrustlm/tools/", [StringComparison]::Ordinal) -or
        -not $relative.EndsWith(".js", [StringComparison]::Ordinal)) {
        throw "Node tool is outside deployment source custody."
    }
    if (@($Custody.files | Where-Object {
        [string]$_.relative_path -eq $relative
    }).Count -ne 1) {
        throw "Node tool is outside deployment source custody."
    }
    Assert-DeploymentSourceCustody `
        -RepositoryRoot $root `
        -Custody $Custody | Out-Null
    $nodeResult = Invoke-PinnedDeploymentProcess `
        -Executable $script:nodeExecutable `
        -Arguments (@($tool) + @($Arguments)) `
        -WorkingDirectory $root
    $output = @($nodeResult.stdout_lines)
    $exitCode = [int]$nodeResult.exit_code
    Assert-DeploymentSourceCustody `
        -RepositoryRoot $root `
        -Custody $Custody | Out-Null
    if ($exitCode -ne 0) {
        throw "Custodied Node tool failed."
    }
    return $output
}

# Reduces a nested transport failure to nonsecret exception and protocol status identifiers.
function Get-SafeExceptionIdentity {
    param([Exception]$Exception)

    $current = $Exception
    while ($current.InnerException) {
        $current = $current.InnerException
    }
    $identity = $current.GetType().FullName
    if ($current -is [Net.WebException]) {
        $identity += "/" + [string]$current.Status
        if ($current.Response -is [Net.FtpWebResponse]) {
            $identity += "/" + [int]$current.Response.StatusCode
        }
    }
    return $identity
}

# Classifies FTP 550 without treating it as proof that an object is absent.
function Test-FtpFileUnavailable {
    param([Exception]$Exception)

    $current = $Exception
    while ($current.InnerException) {
        $current = $current.InnerException
    }
    if ($current -isnot [Net.WebException] -or
        $current.Response -isnot [Net.FtpWebResponse]) {
        return $false
    }
    return $current.Response.StatusCode -eq [Net.FtpStatusCode]::ActionNotTakenFileUnavailable
}

# Classifies only transport-level FTPS read failures that are safe to retry.
function Test-RetryableFtpsReadFailure {
    param([Exception]$Exception)

    $current = $Exception
    while ($current.InnerException) {
        $current = $current.InnerException
    }
    if ($current -isnot [Net.WebException]) {
        return $false
    }
    return $current.Status -in @(
        [Net.WebExceptionStatus]::ConnectFailure
        [Net.WebExceptionStatus]::ConnectionClosed
        [Net.WebExceptionStatus]::KeepAliveFailure
        [Net.WebExceptionStatus]::NameResolutionFailure
        [Net.WebExceptionStatus]::PipelineFailure
        [Net.WebExceptionStatus]::ReceiveFailure
        [Net.WebExceptionStatus]::RequestCanceled
        [Net.WebExceptionStatus]::SendFailure
        [Net.WebExceptionStatus]::ServerProtocolViolation
        [Net.WebExceptionStatus]::Timeout
    )
}

# Extends bounded cleanup retries to the internal FtpWebRequest failure observed after a committed delete.
function Test-RetryableFtpsCleanupFailure {
    param([Exception]$Exception)

    if (Test-RetryableFtpsReadFailure -Exception $Exception) {
        return $true
    }
    $current = $Exception
    while ($current.InnerException) {
        $current = $current.InnerException
    }
    return [string]::Equals(
        $current.GetType().FullName,
        "System.Net.InternalException",
        [StringComparison]::Ordinal
    )
}

# Records one bounded publication substep without retaining exception messages or credentials.
function Set-ArtifactOperationState {
    param(
        [ValidateSet(
            "local-validation",
            "current-artifact-readback",
            "current-temporary-admission",
            "temporary-admission",
            "stage-write",
            "stage-authenticated-readback",
            "stage-reset",
            "stage-verification-exhausted",
            "predecessor-state-read",
            "predecessor-backup",
            "stage-promotion",
            "promoted-readback",
            "public-host-policy",
            "temporary-cleanup",
            "rollback-target-removal",
            "rollback-restore",
            "rollback-temporary-cleanup",
            "rollback-failed",
            "complete"
        )]
        [string]$Step,
        [ValidateRange(0, 2)]
        [int]$Attempt = 0
    )

    $script:artifactOperationStep = $Step
    $script:artifactOperationAttempt = if ($Attempt -gt 0) { $Attempt } else { $null }
}

# Validates one FTP/HTTPS protocol-relative path without local filesystem semantics.
function Assert-RemoteProtocolPath {
    param([string]$RemotePath, [switch]$AllowEmpty)

    if ([string]::IsNullOrEmpty($RemotePath)) {
        if ($AllowEmpty) {
            return ""
        }
        throw "Remote protocol path is empty."
    }
    if ($RemotePath.Length -gt 1024 -or
        $RemotePath.StartsWith("/", [StringComparison]::Ordinal) -or
        $RemotePath.EndsWith("/", [StringComparison]::Ordinal) -or
        $RemotePath.Contains("//") -or
        $RemotePath.Contains("\")) {
        throw "Remote protocol path is invalid."
    }
    $segments = @($RemotePath.Split([char]"/"))
    if ($segments.Count -eq 0) {
        throw "Remote protocol path has no segments."
    }
    foreach ($segment in $segments) {
        if ($segment.Length -eq 0 -or $segment.Length -gt 255 -or
            $segment -eq "." -or $segment -eq ".." -or
            $segment -notmatch "^[A-Za-z0-9._-]+$") {
            throw "Remote protocol path contains an invalid segment."
        }
    }
    return $RemotePath
}

# Splits one validated remote file path on forward slashes only.
function Get-RemoteFilePathParts {
    param([string]$RemotePath)

    $validated = Assert-RemoteProtocolPath -RemotePath $RemotePath
    $separator = $validated.LastIndexOf("/", [StringComparison]::Ordinal)
    return [pscustomobject]@{
        parent = if ($separator -ge 0) { $validated.Substring(0, $separator) } else { "" }
        leaf = if ($separator -ge 0) { $validated.Substring($separator + 1) } else { $validated }
    }
}

# Normalizes one bounded FTP LIST child without applying local filesystem path semantics.
function ConvertFrom-FtpDirectoryEntry {
    param([string]$Entry, [string]$RemotePath)

    if ([string]::IsNullOrEmpty($Entry) -or
        $Entry.Length -gt 512 -or
        $Entry -match "[\x00-\x1f\x7f]" -or
        $Entry.Contains("\")) {
        throw "Remote directory inventory contains an invalid bounded entry."
    }
    $directory = ([string]$RemotePath).Trim("/")
    if ($directory.Length -gt 512 -or
        $directory.Contains("\") -or
        $directory -match "(^|/)\.{1,2}(/|$)" -or
        $directory.Contains("//")) {
        throw "Remote directory inventory scope is invalid."
    }
    $directoryLeaf = ""
    if ($directory) {
        $lastSeparator = $directory.LastIndexOf("/")
        $directoryLeaf = if ($lastSeparator -ge 0) {
            $directory.Substring($lastSeparator + 1)
        }
        else {
            $directory
        }
    }
    $candidate = $Entry
    if ($candidate.Contains("/")) {
        if (-not $directory) {
            throw "Remote directory inventory escaped its requested scope."
        }
        $fullPrefix = $directory + "/"
        $leafPrefix = $directoryLeaf + "/"
        if ($candidate.StartsWith($fullPrefix, [StringComparison]::Ordinal)) {
            $candidate = $candidate.Substring($fullPrefix.Length)
        }
        elseif ($candidate.StartsWith($leafPrefix, [StringComparison]::Ordinal)) {
            $candidate = $candidate.Substring($leafPrefix.Length)
        }
        else {
            throw "Remote directory inventory escaped its requested scope."
        }
    }
    if ([string]::Equals($candidate, ".", [StringComparison]::Ordinal) -or
        [string]::Equals($candidate, "..", [StringComparison]::Ordinal)) {
        return $null
    }
    if ([string]::IsNullOrEmpty($candidate) -or
        $candidate.Length -gt 255 -or
        $candidate.Contains("/") -or
        $candidate.Contains("\") -or
        $candidate -match "[\x00-\x1f\x7f]") {
        throw "Remote directory inventory contains a non-child entry."
    }
    return $candidate
}

# Builds an authenticated FTPS request from credentials held only in process memory.
function New-FtpRequest {
    param([string]$RemotePath, [string]$Method)

    $validatedRemotePath = Assert-RemoteProtocolPath -RemotePath $RemotePath -AllowEmpty
    $uri = [Uri]("ftp://{0}:{1}/{2}" -f $script:ftpHost, $script:ftpPort, $validatedRemotePath)
    $request = [Net.FtpWebRequest]::Create($uri)
    $request.Method = $Method
    $request.EnableSsl = $true
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $request.Timeout = 300000
    $request.ReadWriteTimeout = 300000
    $request.Credentials = $script:credential
    return $request
}

# Proves exact remote-file absence by listing its authenticated parent directory.
function Test-RemoteFileAbsent {
    param([string]$RemotePath)

    $parts = Get-RemoteFilePathParts -RemotePath $RemotePath
    $directory = $parts.parent
    $leaf = $parts.leaf
    try {
        $request = New-FtpRequest `
            -RemotePath $directory `
            -Method ([Net.WebRequestMethods+Ftp]::ListDirectory)
        $response = $request.GetResponse()
        try {
            $stream = $response.GetResponseStream()
            $reader = [IO.StreamReader]::new($stream)
            try {
                while (-not $reader.EndOfStream) {
                    $entry = ConvertFrom-FtpDirectoryEntry `
                        -Entry ([string]$reader.ReadLine()) `
                        -RemotePath $directory
                    if ($null -ne $entry -and
                        [string]::Equals($entry, $leaf, [StringComparison]::Ordinal)) {
                        return $false
                    }
                }
                return $true
            }
            finally {
                $reader.Dispose()
                $stream.Dispose()
            }
        }
        finally {
            $response.Dispose()
        }
    }
    catch {
        if (Test-FtpFileUnavailable -Exception $_.Exception) {
            throw "FTP 550 cannot prove remote-file absence; the parent inventory is ambiguous or inaccessible."
        }
        throw
    }
}

# Returns the authoritative FTPS object size, or -1 when the object does not exist.
function Get-RemoteSize {
    param([string]$RemotePath)

    $maximumAttempts = 4
    for ($attempt = 1; $attempt -le $maximumAttempts; $attempt += 1) {
        try {
            # A LIST omission is not accepted on its own. Bind it to a SIZE
            # result and require the parent inventory to remain stable around
            # that result so a hidden, stale, or racing object cannot become
            # an apparently absent path.
            $absentBeforeSize = Test-RemoteFileAbsent -RemotePath $RemotePath
            try {
                $request = New-FtpRequest `
                    -RemotePath $RemotePath `
                    -Method ([Net.WebRequestMethods+Ftp]::GetFileSize)
                $response = $request.GetResponse()
                try {
                    $reportedSize = [int64]$response.ContentLength
                }
                finally {
                    $response.Dispose()
                }
                if ($reportedSize -lt 0) {
                    throw "Remote SIZE returned an ambiguous negative value."
                }
                $absentAfterSize = Test-RemoteFileAbsent -RemotePath $RemotePath
                if ($absentBeforeSize -or $absentAfterSize) {
                    throw "Remote positive SIZE contradicted the parent LIST inventory."
                }
                return $reportedSize
            }
            catch {
                if (Test-FtpFileUnavailable -Exception $_.Exception) {
                    $absentAfterSize = Test-RemoteFileAbsent -RemotePath $RemotePath
                    if ($absentBeforeSize -and $absentAfterSize) {
                        return [int64]-1
                    }
                    throw "FTP 550 cannot prove remote-file absence; LIST and SIZE state is ambiguous."
                }
                throw
            }
        }
        catch {
            if ($attempt -ge $maximumAttempts -or
                -not (Test-RetryableFtpsReadFailure -Exception $_.Exception)) {
                throw
            }
            $failureIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
            Write-Host (
                "retrying authoritative FTPS read {0}/{1} after {2}" -f
                    $attempt,
                    $maximumAttempts,
                    $failureIdentity
            )
            Start-Sleep -Milliseconds (250 * $attempt)
        }
    }
    throw "Authoritative FTPS read exhausted without a result."
}

# Tests whether a remote directory is reachable through the authenticated site root.
function Test-RemoteDirectory {
    param([string]$RemotePath)

    try {
        $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::ListDirectory)
        $response = $request.GetResponse()
        $response.Dispose()
        return $true
    }
    catch {
        if (Test-FtpFileUnavailable -Exception $_.Exception) {
            throw "FTP 550 cannot prove remote-directory absence; remote state is ambiguous or inaccessible."
        }
        throw
    }
}

# Lists an authenticated remote directory without writing entry names to operator output.
function Get-RemoteDirectoryEntries {
    param([string]$RemotePath)

    if (-not (Test-RemoteDirectory -RemotePath $RemotePath)) {
        return @()
    }
    try {
        $request = New-FtpRequest `
            -RemotePath $RemotePath `
            -Method ([Net.WebRequestMethods+Ftp]::ListDirectory)
        $response = $request.GetResponse()
        try {
            $stream = $response.GetResponseStream()
            $reader = [IO.StreamReader]::new($stream)
            try {
                $entries = @()
                $rawEntryCount = 0
                while (-not $reader.EndOfStream) {
                    if ($rawEntryCount -ge 64) {
                        throw "Remote directory inventory exceeds its bounded contract."
                    }
                    $rawEntryCount += 1
                    $entry = ConvertFrom-FtpDirectoryEntry `
                        -Entry ([string]$reader.ReadLine()) `
                        -RemotePath $RemotePath
                    if ($null -ne $entry) {
                        $entries += $entry
                    }
                }
                return @($entries)
            }
            finally {
                $reader.Dispose()
                $stream.Dispose()
            }
        }
        finally {
            $response.Dispose()
        }
    }
    catch {
        if (Test-FtpFileUnavailable -Exception $_.Exception) {
            throw "FTP 550 cannot prove an empty or absent remote directory."
        }
        throw
    }
}

# Creates one required public asset directory and verifies the resulting FTPS boundary.
function Ensure-RemoteDirectory {
    param([string]$RemotePath)

    if (Test-RemoteDirectory -RemotePath $RemotePath) {
        return
    }
    $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::MakeDirectory)
    $response = $request.GetResponse()
    $response.Dispose()
    if (-not (Test-RemoteDirectory -RemotePath $RemotePath)) {
        throw "Remote asset directory preflight failed for $RemotePath."
    }
    Write-Host "created remote asset directory $RemotePath"
}

# Deletes an optional remote object and proves absence after every response outcome.
function Remove-RemoteFile {
    param([string]$RemotePath)

    $maximumAttempts = 4
    for ($attempt = 1; $attempt -le $maximumAttempts; $attempt += 1) {
        $deleteFailure = $null
        try {
            $request = New-FtpRequest `
                -RemotePath $RemotePath `
                -Method ([Net.WebRequestMethods+Ftp]::DeleteFile)
            $response = $request.GetResponse()
            $response.Dispose()
        }
        catch {
            $deleteFailure = $_.Exception
        }

        $absenceFailure = $null
        try {
            if (Test-RemoteFileAbsent -RemotePath $RemotePath) {
                return
            }
        }
        catch {
            $absenceFailure = $_.Exception
        }

        if ($null -ne $deleteFailure) {
            if ($attempt -ge $maximumAttempts -or
                -not (Test-RetryableFtpsCleanupFailure -Exception $deleteFailure)) {
                throw $deleteFailure
            }
            $failureIdentity = Get-SafeExceptionIdentity -Exception $deleteFailure
        }
        elseif ($null -ne $absenceFailure) {
            if ($attempt -ge $maximumAttempts -or
                -not (Test-RetryableFtpsCleanupFailure -Exception $absenceFailure)) {
                throw $absenceFailure
            }
            $failureIdentity = Get-SafeExceptionIdentity -Exception $absenceFailure
        }
        else {
            if ($attempt -ge $maximumAttempts) {
                throw "Remote cleanup exhausted without authoritative absence proof."
            }
            $failureIdentity = "remote-object-still-present"
        }

        Write-Host (
            "retrying authoritative FTPS cleanup {0}/{1} after {2}" -f
                $attempt,
                $maximumAttempts,
                $failureIdentity
        )
        Start-Sleep -Milliseconds (250 * $attempt)
    }
    throw "Authoritative FTPS cleanup exhausted without a result."
}

# Removes one empty owned remote directory and proves it is no longer listable.
function Remove-RemoteDirectory {
    param([string]$RemotePath)

    if (-not (Test-RemoteDirectory -RemotePath $RemotePath)) {
        return "already-absent"
    }
    try {
        $request = New-FtpRequest `
            -RemotePath $RemotePath `
            -Method ([Net.WebRequestMethods+Ftp]::RemoveDirectory)
        $response = $request.GetResponse()
        $response.Dispose()
    }
    catch {
        if (-not (Test-RemoteDirectory -RemotePath $RemotePath)) {
            return "removed"
        }
        throw
    }
    if (Test-RemoteDirectory -RemotePath $RemotePath) {
        throw "Remote owned directory removal could not be verified."
    }
    return "removed"
}
# Reconciles an FTPS rename whose command response and authoritative directory state may converge
# at different times. This performs observations only; it never repeats the mutation.
function Test-RemoteRenameCommitted {
    param(
        [string]$RemotePath,
        [string]$DestinationPath,
        [ValidateRange(1, 12)]
        [int]$MaximumAttempts = 8
    )

    for ($attempt = 1; $attempt -le $MaximumAttempts; $attempt += 1) {
        $sourceSize = Get-RemoteSize -RemotePath $RemotePath
        $destinationSize = Get-RemoteSize -RemotePath $DestinationPath
        if ($sourceSize -lt 0 -and $destinationSize -ge 0) {
            return $true
        }
        if ($attempt -lt $MaximumAttempts) {
            Start-Sleep -Milliseconds ([Math]::Min(2000, 250 * $attempt))
        }
    }
    return $false
}

# Renames one object within its existing remote directory and reconciles ambiguous responses.
function Rename-RemoteFile {
    param([string]$RemotePath, [string]$NewLeafName)

    $parts = Get-RemoteFilePathParts -RemotePath $RemotePath
    $newLeafParts = Get-RemoteFilePathParts -RemotePath $NewLeafName
    if ($newLeafParts.parent) {
        throw "Remote rename destination must be one leaf."
    }
    $directory = $parts.parent
    $destinationPath = if ($directory) { "$directory/$NewLeafName" } else { $NewLeafName }
    try {
        $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::Rename)
        $request.RenameTo = $NewLeafName
        $response = $request.GetResponse()
        $response.Dispose()
    }
    catch {
        $renameFailure = $_
        if (Test-RemoteRenameCommitted `
            -RemotePath $RemotePath `
            -DestinationPath $destinationPath) {
            return
        }
        throw $renameFailure
    }
    if (-not (Test-RemoteRenameCommitted `
        -RemotePath $RemotePath `
        -DestinationPath $destinationPath)) {
        throw "Remote rename could not be verified."
    }
}

# Uploads one immutable chunk, allowing the caller to verify ambiguous server responses by size.
function Write-RemoteChunk {
    param([string]$RemotePath, [byte[]]$Bytes, [bool]$Append)

    $script:lastFtpWriteError = $null
    try {
        $method = if ($Append) {
            [Net.WebRequestMethods+Ftp]::AppendFile
        }
        else {
            [Net.WebRequestMethods+Ftp]::UploadFile
        }
        $request = New-FtpRequest -RemotePath $RemotePath -Method $method
        $request.ContentLength = $Bytes.LongLength
        $stream = $request.GetRequestStream()
        try {
            $stream.Write($Bytes, 0, $Bytes.Length)
        }
        finally {
            try { $stream.Dispose() } catch { }
        }
        try {
            $response = $request.GetResponse()
            $response.Dispose()
        }
        catch {
            # This host can return 451 after committing bytes; the caller verifies remote size.
            $script:lastFtpWriteError = Get-SafeExceptionIdentity -Exception $_.Exception
        }
    }
    catch {
        # Network failures are retried only after the caller proves the offset did not advance.
        $script:lastFtpWriteError = Get-SafeExceptionIdentity -Exception $_.Exception
    }
}

# Verifies public bytes through a cache-bypassed streaming HTTPS readback.
function Test-HttpsArtifact {
    param([string]$RemotePath, [int64]$ExpectedBytes, [string]$ExpectedSha256)

    try {
        $nonce = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $uri = "{0}/{1}?deploy_readback={2}" -f $script:publicOrigin, $RemotePath, $nonce
        $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $uri)
        $request.Headers.CacheControl = [Net.Http.Headers.CacheControlHeaderValue]::new()
        $request.Headers.CacheControl.NoCache = $true
        $response = $script:httpClient.SendAsync(
            $request,
            [Net.Http.HttpCompletionOption]::ResponseHeadersRead
        ).GetAwaiter().GetResult()
        try {
            if (-not $response.IsSuccessStatusCode) {
                return $false
            }
            if ($response.Content.Headers.ContentLength.HasValue -and
                $response.Content.Headers.ContentLength.Value -ne $ExpectedBytes) {
                return $false
            }

            $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $sha = [Security.Cryptography.SHA256]::Create()
            $buffer = New-Object byte[] (8 * 1024 * 1024)
            $received = [int64]0
            try {
                while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $sha.TransformBlock($buffer, 0, $count, $buffer, 0) | Out-Null
                    $received += $count
                }
                $sha.TransformFinalBlock([byte[]]::new(0), 0, 0) | Out-Null
                $actualSha256 = ([BitConverter]::ToString($sha.Hash)).Replace("-", "").ToLowerInvariant()
                return $received -eq $ExpectedBytes -and $actualSha256 -eq $ExpectedSha256
            }
            finally {
                $sha.Dispose()
                $stream.Dispose()
            }
        }
        finally {
            $response.Dispose()
        }
    }
    catch {
        return $false
    }
}

# Reads one bounded public JSON response and rejects redirects or non-200 outcomes.
function Read-BoundedPublicResponse {
    param(
        [Net.Http.HttpResponseMessage]$Response,
        [ValidateRange(1, 1048576)]
        [int]$MaximumBytes
    )

    if (-not $Response -or $Response.StatusCode -ne [Net.HttpStatusCode]::OK) {
        if ($Response -and [int]$Response.StatusCode -ge 300 -and
            [int]$Response.StatusCode -lt 400) {
            throw "Public predecessor readback rejected an HTTP redirect."
        }
        throw "Public predecessor readback requires exact HTTP 200."
    }
    $mediaType = if ($Response.Content.Headers.ContentType) {
        [string]$Response.Content.Headers.ContentType.MediaType
    }
    else {
        ""
    }
    if (-not [string]::Equals(
        $mediaType,
        "application/json",
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Public predecessor readback media type is invalid."
    }
    $contentLength = $Response.Content.Headers.ContentLength
    if ($null -ne $contentLength -and
        ([int64]$contentLength -le 0 -or
            [int64]$contentLength -gt $MaximumBytes)) {
        throw "Public predecessor readback exceeds its byte limit."
    }
    $stream = $Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $memory = [IO.MemoryStream]::new()
    $buffer = [byte[]]::new(8192)
    $total = 0
    try {
        while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $total += $count
            if ($total -gt $MaximumBytes) {
                throw "Public predecessor readback exceeds its byte limit."
            }
            $memory.Write($buffer, 0, $count)
        }
        if ($total -le 0) {
            throw "Public predecessor readback is empty."
        }
        return ,$memory.ToArray()
    }
    finally {
        $memory.Dispose()
        $stream.Dispose()
    }
}

# Fetches one public release record without credentials, cookies, redirects, or cache reuse.
function Read-BoundedPublicArtifact {
    param(
        [string]$RemotePath,
        [ValidateRange(1, 1048576)]
        [int]$MaximumBytes
    )

    if (-not $script:httpClient) {
        throw "Public predecessor HTTP custody is unavailable."
    }
    $validatedPath = Assert-RemoteProtocolPath -RemotePath $RemotePath
    $nonce = [Guid]::NewGuid().ToString("N")
    $uri = "{0}/{1}?predecessor_readback={2}" -f `
        $script:publicOrigin,
        $validatedPath,
        $nonce
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $uri)
    $request.Headers.CacheControl = [Net.Http.Headers.CacheControlHeaderValue]::new()
    $request.Headers.CacheControl.NoCache = $true
    $request.Headers.CacheControl.NoStore = $true
    $request.Headers.CacheControl.MaxAge = [TimeSpan]::Zero
    $request.Headers.Pragma.ParseAdd("no-cache")
    $response = $null
    try {
        $response = $script:httpClient.SendAsync(
            $request,
            [Net.Http.HttpCompletionOption]::ResponseHeadersRead
        ).GetAwaiter().GetResult()
        return ,(Read-BoundedPublicResponse `
            -Response $response `
            -MaximumBytes $MaximumBytes)
    }
    finally {
        if ($response) {
            $response.Dispose()
        }
        $request.Dispose()
    }
}

# Parses strict bounded UTF-8 JSON while preserving the raw bytes as the authority.
function ConvertFrom-StrictPublicJsonBytes {
    param([byte[]]$Bytes, [string]$Label)

    if (-not $Bytes -or $Bytes.Length -le 0 -or $Bytes.Length -gt (1024 * 1024)) {
        throw "$Label exceeds its byte limit."
    }
    try {
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
    }
    catch {
        throw "$Label contains malformed UTF-8."
    }
    if (($text.Length -gt 0 -and [int][char]$text[0] -eq 0xfeff) -or
        $text.Contains("`r") -or
        -not $text.EndsWith("`n", [StringComparison]::Ordinal)) {
        throw "$Label has a noncanonical encoding."
    }
    try {
        return $text | ConvertFrom-Json
    }
    catch {
        throw "$Label contains malformed JSON."
    }
}

# Compares two bounded byte arrays without replacing byte identity with parsed semantics.
function Test-ExactByteArray {
    param([byte[]]$Left, [byte[]]$Right)

    if ($null -eq $Left -or $null -eq $Right -or $Left.Length -eq 0 -or
        $Left.Length -ne $Right.Length) {
        return $false
    }
    for ($index = 0; $index -lt $Left.Length; $index += 1) {
        if ($Left[$index] -ne $Right[$index]) {
            return $false
        }
    }
    return $true
}

# Requires live public release bytes to be the exact 0.4.1 prefix before pending 0.5.0.
function Assert-PublicReleasePredecessor {
    param([object]$Expected, [string]$PublicOrigin)

    if (-not $Expected -or
        -not [string]::Equals(
            $PublicOrigin,
            "https://tinyrustlm.com",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$Expected.predecessor_release_id,
            "tinyrustlm.com@0.4.1",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$Expected.predecessor_version,
            "0.4.1",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$Expected.pending_release_id,
            "tinyrustlm.com@0.5.0",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$Expected.pending_version,
            "0.5.0",
            [StringComparison]::Ordinal
        ) -or
        -not $Expected.current -or
        -not $Expected.history -or
        [string]$Expected.predecessor_publication_id -notmatch "^[0-9a-f]{64}$" -or
        [string]$Expected.predecessor_ledger_sha256 -notmatch "^[0-9a-f]{64}$" -or
        -not [string]::Equals(
            [string]$Expected.current.relative_path,
            ".well-known/site-release.json",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$Expected.history.relative_path,
            ".well-known/site-release-history.json",
            [StringComparison]::Ordinal
        )) {
        throw "Public predecessor expectation is invalid."
    }
    foreach ($record in @($Expected.current, $Expected.history)) {
        if (-not $record -or
            [int64]$record.byte_count -le 0 -or
            [int64]$record.byte_count -gt (1024 * 1024) -or
            [string]$record.sha256 -notmatch "^[0-9a-f]{64}$" -or
            -not $record.bytes -or
            ([byte[]]$record.bytes).Length -ne [int64]$record.byte_count -or
            (Get-ByteArraySha256 -Bytes ([byte[]]$record.bytes)) -ne
                [string]$record.sha256) {
            throw "Public predecessor expected bytes are invalid."
        }
    }
    [byte[]]$currentBytes = Read-BoundedPublicArtifact `
        -RemotePath ([string]$Expected.current.relative_path) `
        -MaximumBytes (1024 * 1024)
    [byte[]]$historyBytes = Read-BoundedPublicArtifact `
        -RemotePath ([string]$Expected.history.relative_path) `
        -MaximumBytes (1024 * 1024)
    $current = ConvertFrom-StrictPublicJsonBytes `
        -Bytes $currentBytes `
        -Label "Public current-release record"
    $history = ConvertFrom-StrictPublicJsonBytes `
        -Bytes $historyBytes `
        -Label "Public release-history record"
    if ([string]$current.releaseId -eq [string]$Expected.pending_release_id -or
        [string]$current.version -eq [string]$Expected.pending_version) {
        throw "Public release state is already newer than the required predecessor."
    }
    if ([string]$current.schema -ne "uaix.site_release.v1" -or
        [string]$current.siteId -ne "tinyrustlm.com" -or
        [string]$current.canonicalOrigin -ne "https://tinyrustlm.com" -or
        [string]$current.releaseId -ne [string]$Expected.predecessor_release_id -or
        [string]$current.version -ne [string]$Expected.predecessor_version -or
        [string]$current.publicationId -ne [string]$Expected.predecessor_publication_id) {
        throw "Public current-release record diverges from the required predecessor."
    }
    $historyReleases = @($history.releases)
    if ([string]$history.schema -ne "uaix.site_release_history.v1" -or
        [string]$history.siteId -ne "tinyrustlm.com" -or
        [string]$history.canonicalOrigin -ne "https://tinyrustlm.com" -or
        $historyReleases.Count -le 0) {
        throw "Public release-history record is malformed."
    }
    $historyCurrent = $historyReleases[$historyReleases.Count - 1]
    if ([string]$historyCurrent.releaseId -ne [string]$current.releaseId -or
        [string]$historyCurrent.version -ne [string]$current.version -or
        [string]$historyCurrent.publicationId -ne [string]$current.publicationId -or
        @($historyReleases | Where-Object {
            [string]$_.releaseId -eq [string]$Expected.pending_release_id -or
            [string]$_.version -eq [string]$Expected.pending_version
        }).Count -ne 0) {
        throw "Public release history is inconsistent with its current predecessor."
    }
    if (-not (Test-ExactByteArray `
            -Left $currentBytes `
            -Right ([byte[]]$Expected.current.bytes)) -or
        -not (Test-ExactByteArray `
            -Left $historyBytes `
            -Right ([byte[]]$Expected.history.bytes))) {
        throw "Public release bytes diverge from the exact predecessor ledger prefix."
    }
    return [pscustomobject]@{
        status = "pass"
        predecessor_release_id = [string]$current.releaseId
        predecessor_version = [string]$current.version
        predecessor_publication_id = [string]$current.publicationId
        predecessor_ledger_sha256 = [string]$Expected.predecessor_ledger_sha256
        pending_release_id = [string]$Expected.pending_release_id
        pending_version = [string]$Expected.pending_version
        current_byte_count = $currentBytes.Length
        current_sha256 = Get-ByteArraySha256 -Bytes $currentBytes
        history_byte_count = $historyBytes.Length
        history_sha256 = Get-ByteArraySha256 -Bytes $historyBytes
        cache_bypassed = $true
        read_only = $true
    }
}

# Creates a one-client credential pipe whose discretionary ACL admits only the current user.
function New-CurrentUserCredentialPipe {
    param([string]$Name)

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $pipeSecurity = [IO.Pipes.PipeSecurity]::new()
        $pipeSecurity.SetAccessRuleProtection($true, $false)
        $pipeSecurity.AddAccessRule([IO.Pipes.PipeAccessRule]::new(
            $identity.User,
            [IO.Pipes.PipeAccessRights]::ReadWrite,
            [Security.AccessControl.AccessControlType]::Allow
        ))
    }
    finally {
        $identity.Dispose()
    }
    return [IO.Pipes.NamedPipeServerStream]::new(
        $Name,
        [IO.Pipes.PipeDirection]::Out,
        1,
        [IO.Pipes.PipeTransmissionMode]::Byte,
        [IO.Pipes.PipeOptions]::Asynchronous,
        0,
        0,
        $pipeSecurity
    )
}

# Verifies a non-public control file through authenticated FTPS readback.
function Test-FtpsArtifact {
    param([string]$RemotePath, [int64]$ExpectedBytes, [string]$ExpectedSha256)

    $temporaryPath = [IO.Path]::GetTempFileName()
    $pipeName = "tinyrustlm-curl-{0}" -f [Guid]::NewGuid().ToString("N")
    $pipePath = "\\.\pipe\{0}" -f $pipeName
    $pipeServer = $null
    $pipeWriter = $null
    $process = $null
    try {
        $escapeConfig = {
            param([string]$Value)
            return $Value.Replace("\", "\\").Replace('"', '\"').Replace("`r", "\r").Replace("`n", "\n").Replace("`t", "\t")
        }
        $user = & $escapeConfig ([string]$script:credential.UserName)
        $passwordValue = & $escapeConfig ([string]$script:credential.Password)
        $configLine = 'user = "{0}:{1}"' -f $user, $passwordValue

        $pipeServer = New-CurrentUserCredentialPipe -Name $pipeName
        $pipeConnection = $pipeServer.WaitForConnectionAsync()

        $uri = [Uri]("ftp://{0}:{1}/{2}" -f $script:ftpHost, $script:ftpPort, $RemotePath)
        $start = New-SanitizedDeploymentProcessStartInfo `
            -Executable $script:curlExecutable `
            -Arguments @(
                "--config", $pipePath,
                "--ssl-reqd",
                "--ftp-method", "nocwd",
                "--ftp-skip-pasv-ip",
                "--fail",
                "--silent",
                "--show-error",
                "--connect-timeout", "30",
                "--max-time", "180",
                "--output", $temporaryPath,
                $uri.AbsoluteUri
            )
        $process = [Diagnostics.Process]::Start($start)
        if (-not $pipeConnection.Wait(5000)) {
            $process.Kill()
            return $false
        }
        $pipeWriter = [IO.StreamWriter]::new(
            $pipeServer,
            [Text.UTF8Encoding]::new($false),
            1024,
            $true
        )
        $pipeWriter.WriteLine($configLine)
        $pipeWriter.Flush()
        $pipeWriter.Dispose()
        $pipeWriter = $null
        $pipeServer.Dispose()
        $pipeServer = $null
        $configLine = $null
        $passwordValue = $null
        $user = $null

        $stdoutRead = $process.StandardOutput.ReadToEndAsync()
        $stderrRead = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(190000)) {
            $process.Kill()
            return $false
        }
        $stdoutRead.GetAwaiter().GetResult() | Out-Null
        $stderrRead.GetAwaiter().GetResult() | Out-Null
        Assert-PinnedDeploymentExecutable `
            -Executable $script:curlExecutable | Out-Null
        if ($process.ExitCode -ne 0) {
            Write-Host "FTPS readback failed with curl exit code $($process.ExitCode)."
            return $false
        }
        $item = Get-Item -LiteralPath $temporaryPath
        return [int64]$item.Length -eq $ExpectedBytes -and (Get-FileSha256 -Path $temporaryPath) -eq $ExpectedSha256
    }
    catch {
        return $false
    }
    finally {
        if ($process) {
            $process.Dispose()
        }
        if ($pipeWriter) {
            $pipeWriter.Dispose()
        }
        if ($pipeServer) {
            $pipeServer.Dispose()
        }
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

# Reads one small FTPS control artifact without creating or changing remote state.
function Read-BoundedFtpsArtifact {
    param(
        [string]$RemotePath,
        [ValidateRange(1, 65536)]
        [int]$MaximumBytes
    )

    $validatedPath = Assert-RemoteProtocolPath -RemotePath $RemotePath
    $request = New-FtpRequest `
        -RemotePath $validatedPath `
        -Method ([Net.WebRequestMethods+Ftp]::DownloadFile)
    $response = $request.GetResponse()
    try {
        if ($response.ContentLength -gt $MaximumBytes) {
            throw "The deployment root sentinel exceeds its byte limit."
        }
        $stream = $response.GetResponseStream()
        $memory = [IO.MemoryStream]::new()
        $buffer = [byte[]]::new(1024)
        $total = 0
        try {
            while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $total += $count
                if ($total -gt $MaximumBytes) {
                    throw "The deployment root sentinel exceeds its byte limit."
                }
                $memory.Write($buffer, 0, $count)
            }
            return ,$memory.ToArray()
        }
        finally {
            $memory.Dispose()
            $stream.Dispose()
        }
    }
    finally {
        $response.Dispose()
    }
}

# Hashes an exact bounded predecessor stream without retaining its payload.
function Get-BoundedDeploymentStreamIdentity {
    param(
        [IO.Stream]$Stream,
        [ValidateRange(0, 268435456)][int64]$ExpectedBytes
    )

    $hasher = [Security.Cryptography.SHA256]::Create()
    $buffer = [byte[]]::new(32768)
    [int64]$total = 0
    try {
        while ($total -lt $ExpectedBytes) {
            $wanted = [int][Math]::Min($buffer.Length, $ExpectedBytes - $total)
            $count = $Stream.Read($buffer, 0, $wanted)
            if ($count -le 0) { throw "FTPS predecessor was truncated." }
            $hasher.TransformBlock($buffer, 0, $count, $buffer, 0) | Out-Null
            $total += $count
        }
        if ($Stream.ReadByte() -ne -1) { throw "FTPS predecessor exceeded its admitted length." }
        $hasher.TransformFinalBlock([byte[]]@(), 0, 0) | Out-Null
        return [pscustomobject]@{
            bytes = $total
            sha256 = [BitConverter]::ToString($hasher.Hash).Replace("-", "").ToLowerInvariant()
        }
    }
    finally { $hasher.Dispose() }
}

# Captures predecessor identity over authenticated FTPS, independent of public caches.
function Get-FtpsArtifactIdentity {
    param(
        [string]$RemotePath,
        [ValidateRange(0, 268435456)][int64]$ExpectedBytes
    )

    $validatedPath = Assert-RemoteProtocolPath -RemotePath $RemotePath
    $request = New-FtpRequest -RemotePath $validatedPath `
        -Method ([Net.WebRequestMethods+Ftp]::DownloadFile)
    $response = $request.GetResponse()
    try {
        if ($response.ContentLength -ge 0 -and $response.ContentLength -ne $ExpectedBytes) {
            throw "FTPS predecessor length changed before readback."
        }
        $stream = $response.GetResponseStream()
        try { return Get-BoundedDeploymentStreamIdentity -Stream $stream -ExpectedBytes $ExpectedBytes }
        finally { $stream.Dispose() }
    }
    finally { $response.Dispose() }
}

# Proves the authenticated FTPS root has the preregistered TinyRustLM site identity.
function Assert-DeploymentTargetIdentity {
    param([object]$TargetBinding, [string]$PublicOrigin)

    if (-not $TargetBinding -or
        -not [string]::Equals(
            $PublicOrigin,
            "https://tinyrustlm.com",
            [StringComparison]::Ordinal
        )) {
        throw "The deployment root sentinel identity is invalid."
    }
    [byte[]]$bytes = @(
        Read-BoundedFtpsArtifact `
            -RemotePath ([string]$TargetBinding.sentinel_path) `
            -MaximumBytes 4096
    )
    if ($bytes.Length -le 1) {
        throw "The deployment root sentinel identity is invalid."
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $actualSha256 = ([BitConverter]::ToString(
            $sha.ComputeHash($bytes)
        )).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
    if (-not [string]::Equals(
        $actualSha256,
        [string]$TargetBinding.sentinel_sha256,
        [StringComparison]::Ordinal
    )) {
        throw "The deployment root sentinel hash does not match the configured identity."
    }
    try {
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
    }
    catch {
        throw "The deployment root sentinel identity is invalid."
    }
    if (($text.Length -gt 0 -and [int][char]$text[0] -eq 0xfeff) -or
        $text.Contains("`r") -or
        -not $text.EndsWith("`n", [StringComparison]::Ordinal) -or
        $text.Substring(0, $text.Length - 1).Contains("`n")) {
        throw "The deployment root sentinel encoding is invalid."
    }
    try {
        $sentinel = $text | ConvertFrom-Json
    }
    catch {
        throw "The deployment root sentinel JSON is invalid."
    }
    $fieldNames = [string[]]@($sentinel.PSObject.Properties.Name)
    [Array]::Sort($fieldNames, [StringComparer]::Ordinal)
    if ([string]::Join("`n", $fieldNames) -ne
            "public_origin`nschema`nsite_identity" -or
        -not [string]::Equals(
            [string]$sentinel.schema,
            "tinyrustlm.deployment_root_identity.v1",
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$sentinel.site_identity,
            [string]$TargetBinding.site_identity,
            [StringComparison]::Ordinal
        ) -or
        -not [string]::Equals(
            [string]$sentinel.public_origin,
            $PublicOrigin,
            [StringComparison]::Ordinal
        )) {
        throw "The deployment root sentinel site identity is invalid."
    }
    return [pscustomobject]@{
        status = "pass"
        site_identity = [string]$sentinel.site_identity
        sentinel_path = [string]$TargetBinding.sentinel_path
        sentinel_bytes = $bytes.Length
        sentinel_sha256 = $actualSha256
        read_only = $true
    }
}

# Selects authenticated or public readback without treating hidden stages as public files.
function Test-RemoteArtifact {
    param(
        [string]$RemotePath,
        [int64]$ExpectedBytes,
        [string]$ExpectedSha256,
        [switch]$AuthenticatedOnly
    )

    if ($AuthenticatedOnly -or
        $RemotePath.EndsWith(".htaccess", [StringComparison]::OrdinalIgnoreCase)) {
        return Test-FtpsArtifact -RemotePath $RemotePath -ExpectedBytes $ExpectedBytes -ExpectedSha256 $ExpectedSha256
    }
    return Test-HttpsArtifact -RemotePath $RemotePath -ExpectedBytes $ExpectedBytes -ExpectedSha256 $ExpectedSha256
}

# Requires a retired public route to be absent without downloading a response body.
function Test-HttpsMissing {
    param([string]$RemotePath)

    $script:lastHttpsMissingObservation = [pscustomobject]@{
        request_succeeded = $false
        status_code = $null
        error_identity = $null
    }
    try {
        $nonce = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $uri = "{0}/{1}?deploy_readback={2}" -f $script:publicOrigin, $RemotePath, $nonce
        $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $uri)
        $request.Headers.CacheControl = [Net.Http.Headers.CacheControlHeaderValue]::new()
        $request.Headers.CacheControl.NoCache = $true
        $response = $script:httpClient.SendAsync(
            $request,
            [Net.Http.HttpCompletionOption]::ResponseHeadersRead
        ).GetAwaiter().GetResult()
        try {
            $statusCode = [int]$response.StatusCode
            $script:lastHttpsMissingObservation = [pscustomobject]@{
                request_succeeded = $true
                status_code = $statusCode
                error_identity = $null
            }
            return $statusCode -eq 404
        }
        finally {
            $response.Dispose()
            $request.Dispose()
        }
    }
    catch {
        $script:lastHttpsMissingObservation = [pscustomobject]@{
            request_succeeded = $false
            status_code = $null
            error_identity = Get-SafeExceptionIdentity -Exception $_.Exception
        }
        return $false
    }
}

# Probes selected public-policy route classes with harmless authenticated marker bytes.
function Invoke-PublicHostPolicyProbes {
    param(
        [ValidateSet("stage", "backup", "model", "model-directory")]
        [string[]]$Kinds
    )

    if (-not $Kinds -or $Kinds.Count -eq 0 -or
        @($Kinds | Sort-Object -Unique).Count -ne $Kinds.Count) {
        throw "Public host policy probe kinds are invalid."
    }
    $nonce = [Guid]::NewGuid().ToString("N").Substring(0, 12)
    $probeBytes = [Text.Encoding]::UTF8.GetBytes("TinyRustLM public host policy probe`n")
    $probeHasher = [Security.Cryptography.SHA256]::Create()
    try {
        $probeSha256 = [BitConverter]::ToString(
            $probeHasher.ComputeHash($probeBytes)
        ).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $probeHasher.Dispose()
    }
    $probes = @($Kinds | ForEach-Object {
        $probePath = switch ($_) {
            "stage" { "app/deploy-$nonce-stage.txt" }
            "backup" { "runtime/backup-$nonce.tmp" }
            "model" { "app/model-policy-$nonce.slm" }
            "model-directory" { "app/models/policy-$nonce.json" }
        }
        [pscustomobject]@{ path = $probePath; kind = $_ }
    })
    $created = @()
    $createdDirectories = @()
    $observations = @()
    $successfulKinds = @()
    $failedKind = $null
    $failedStep = $null
    $failedOperationErrorIdentity = $null
    $activeProbeKind = $null
    $activeProbeStep = $null
    $cleanupVerified = $false
    $buildEvidence = {
        param([string]$Status)

        $failureObservation = @($observations | Where-Object {
            $_.kind -eq $failedKind
        } | Select-Object -Last 1)
        return [pscustomobject]@{
            status = $Status
            planned_probe_count = $probes.Count
            completed_probe_count = $successfulKinds.Count
            failed_probe_kind = $failedKind
            failed_probe_step = $failedStep
            failed_http_status = if ($failureObservation.Count -eq 1) {
                $failureObservation[0].https_status
            }
            else {
                $null
            }
            failed_request_error_identity = if ($failureObservation.Count -eq 1) {
                $failureObservation[0].request_error_identity
            }
            else {
                $null
            }
            failed_operation_error_identity = $failedOperationErrorIdentity
            stage_route_hidden = $successfulKinds -contains "stage"
            backup_route_hidden = $successfulKinds -contains "backup"
            model_route_hidden = $successfulKinds -contains "model"
            model_directory_route_hidden = $successfulKinds -contains "model-directory"
            authenticated_cleanup_verified = $cleanupVerified
            owned_directory_cleanup_verified = $cleanupVerified
            observations = @($observations)
        }
    }
    $script:lastPublicHostPolicyProbeEvidence = & $buildEvidence "running"
    try {
        foreach ($probe in $probes) {
            $activeProbeKind = $probe.kind
            $activeProbeStep = "directory-presence"
            $probeDirectory = (Get-RemoteFilePathParts -RemotePath $probe.path).parent
            if ($probeDirectory) {
                $directoryExisted = Test-RemoteDirectory -RemotePath $probeDirectory
                if (-not $directoryExisted) {
                    $createdDirectories += $probeDirectory
                }
                $activeProbeStep = "directory-ensure"
                Ensure-RemoteDirectory -RemotePath $probeDirectory
            }
            $activeProbeStep = "collision-check"
            if ((Get-RemoteSize -RemotePath $probe.path) -ge 0) {
                throw "Public host policy probe path already exists."
            }
            $activeProbeStep = "marker-write"
            Write-RemoteChunk -RemotePath $probe.path -Bytes $probeBytes -Append $false
            $created += $probe
            $activeProbeStep = "remote-size-verification"
            if ((Get-RemoteSize -RemotePath $probe.path) -ne $probeBytes.LongLength) {
                throw "Public host policy probe upload did not reach its exact size."
            }
            $activeProbeStep = "authenticated-readback"
            if (-not (Test-RemoteArtifact `
                -RemotePath $probe.path `
                -ExpectedBytes $probeBytes.LongLength `
                -ExpectedSha256 $probeSha256 `
                -AuthenticatedOnly)) {
                throw "Public host policy probe failed authenticated readback."
            }
            $activeProbeStep = "https-policy"
            $hidden = Test-HttpsMissing -RemotePath $probe.path
            $observations += [pscustomobject]@{
                kind = $probe.kind
                request_succeeded = $script:lastHttpsMissingObservation.request_succeeded
                https_status = $script:lastHttpsMissingObservation.status_code
                request_error_identity = $script:lastHttpsMissingObservation.error_identity
            }
            if (-not $hidden) {
                $failedKind = $probe.kind
                $failedStep = $activeProbeStep
                $script:lastPublicHostPolicyProbeEvidence = & $buildEvidence "fail"
                throw "Public host policy did not conceal a $($probe.kind) route."
            }
            $successfulKinds += $probe.kind
            $activeProbeStep = "complete"
            $script:lastPublicHostPolicyProbeEvidence = & $buildEvidence "running"
        }
    }
    catch {
        if (-not $failedKind) {
            $failedKind = $activeProbeKind
            $failedStep = $activeProbeStep
            $failedOperationErrorIdentity =
                Get-SafeExceptionIdentity -Exception $_.Exception
        }
        $script:lastPublicHostPolicyProbeEvidence = & $buildEvidence "fail"
        throw
    }
    finally {
        $cleanupFailed = $false
        foreach ($probe in $created) {
            try {
                Remove-RemoteFile -RemotePath $probe.path
                if ((Get-RemoteSize -RemotePath $probe.path) -ge 0) {
                    $cleanupFailed = $true
                }
            }
            catch {
                $cleanupFailed = $true
            }
        }
        foreach ($createdDirectory in @(
            $createdDirectories |
                Sort-Object { ([string]$_).Length } -Descending -Unique
        )) {
            try {
                Remove-RemoteDirectory -RemotePath ([string]$createdDirectory) | Out-Null
                if (Test-RemoteDirectory -RemotePath ([string]$createdDirectory)) {
                    $cleanupFailed = $true
                }
            }
            catch {
                $cleanupFailed = $true
            }
        }
        $cleanupVerified = -not $cleanupFailed
        $finalStatus = if ($failedKind -or $cleanupFailed) { "fail" } else { "pass" }
        $script:lastPublicHostPolicyProbeEvidence = & $buildEvidence $finalStatus
        if ($cleanupFailed) {
            throw "Public host policy probe cleanup could not prove authenticated absence."
        }
    }
    return $script:lastPublicHostPolicyProbeEvidence
}

# Proves the existing host will conceal every real hash-named staging object.
function Test-PredeploymentTemporaryRoutePolicy {
    try {
        return Invoke-PublicHostPolicyProbes -Kinds @("model")
    }
    catch {
        $script:predeploymentTemporaryRouteEvidence =
            $script:lastPublicHostPolicyProbeEvidence
        throw
    }
}

# Proves the newly active host policy conceals temporary publication objects and model-byte routes.
function Test-PublicHostPolicy {
    try {
        return Invoke-PublicHostPolicyProbes -Kinds @(
            "stage"
            "backup"
            "model"
            "model-directory"
        )
    }
    catch {
        $script:publicHostPolicyEvidence =
            $script:lastPublicHostPolicyProbeEvidence
        throw
    }
}

# Rejects undeclared content in the owned legacy model directory before any mutation.
function Test-RetiredModelDirectoryClosure {
    param([object[]]$RetireEntries)

    $remoteDirectory = "app/models"
    if (-not $RetireEntries -or $RetireEntries.Count -eq 0) {
        throw "Legacy model retirement closure is empty."
    }
    $expectedLeaves = @($RetireEntries | ForEach-Object {
        $remote = [string]$_.remote
        $parts = Get-RemoteFilePathParts -RemotePath $remote
        if (-not [string]::Equals(
            $parts.parent,
            $remoteDirectory,
            [StringComparison]::Ordinal
        )) {
            throw "Legacy model retirement closure contains an unexpected directory."
        }
        $parts.leaf
    })
    $expectedSet = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::Ordinal
    )
    foreach ($expectedLeaf in $expectedLeaves) {
        if (-not $expectedSet.Add([string]$expectedLeaf)) {
            throw "Legacy model retirement closure contains duplicate entries."
        }
    }

    $actualEntries = @(Get-RemoteDirectoryEntries -RemotePath $remoteDirectory)
    $actualSet = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::Ordinal
    )
    foreach ($actualEntry in $actualEntries) {
        $entry = [string]$actualEntry
        if ([string]::IsNullOrWhiteSpace($entry) -or
            $entry -match "[/\\]" -or
            -not $actualSet.Add($entry) -or
            -not $expectedSet.Contains($entry)) {
            throw "Legacy model directory contains undeclared entries."
        }
    }
    $sortedEntries = [string[]]@($actualEntries)
    [Array]::Sort($sortedEntries, [StringComparer]::Ordinal)
    $canonicalEntries = [string]::Join("`n", $sortedEntries)
    return [pscustomobject]@{
        status = "pass"
        remote_directory = $remoteDirectory
        expected_entry_count = $expectedLeaves.Count
        observed_entry_count = $actualEntries.Count
        observed_entry_set_sha256 = Get-Utf8Sha256 -Value $canonicalEntries
        undeclared_entry_count = 0
    }
}

# Removes the owned legacy model directory after its allowlisted files are retired.
function Remove-RetiredModelDirectory {
    $remoteDirectory = "app/models"
    $removalStatus = Remove-RemoteDirectory -RemotePath $remoteDirectory
    if (Test-RemoteDirectory -RemotePath $remoteDirectory) {
        throw "Legacy model directory remains after retirement."
    }
    return [pscustomobject]@{
        remote_directory = $remoteDirectory
        status = $removalStatus
        ftps_absent = $true
    }
}

# Deletes a legacy hosted artifact and proves both FTPS absence and public HTTP 404.
function Remove-PublicArtifact {
    param([string]$RemotePath)

    $previousBytes = Get-RemoteSize -RemotePath $RemotePath
    if ($previousBytes -ge 0) {
        Remove-RemoteFile -RemotePath $RemotePath
    }
    if ((Get-RemoteSize -RemotePath $RemotePath) -ge 0) {
        throw "Retired public artifact is still present through FTPS: $RemotePath"
    }
    Start-Sleep -Milliseconds 750
    if (-not (Test-HttpsMissing -RemotePath $RemotePath)) {
        throw "Retired public artifact did not return HTTP 404: $RemotePath"
    }
    return [pscustomobject]@{
        relative_path = $RemotePath
        previous_bytes = $previousBytes
        ftps_absent = $true
        https_status = 404
        status = if ($previousBytes -ge 0) { "removed" } else { "already-absent" }
    }
}

# Resumes a small stage through conservative fixed chunks accepted by this FTPS host.
function Write-StagedSmallArtifact {
    param([byte[]]$Payload, [string]$StagePath, [int64]$ExpectedBytes)

    if ($null -eq $Payload -or $ExpectedBytes -le 0 -or
        $Payload.LongLength -ne $ExpectedBytes -or $ExpectedBytes -gt (8 * 1024 * 1024)) {
        throw "Small staged payload identity is invalid."
    }

    $offset = Get-RemoteSize -RemotePath $StagePath
    if ($offset -lt 0 -or $offset -gt $ExpectedBytes) {
        Remove-RemoteFile -RemotePath $StagePath
        $offset = 0
    }
    if ($offset -eq $ExpectedBytes) {
        return
    }
    $stageLeaf = (Get-RemoteFilePathParts -RemotePath $StagePath).leaf
    Write-Host "resuming $stageLeaf at $offset of $ExpectedBytes bytes"
    $file = [IO.MemoryStream]::new($Payload, $false)
    try {
        $file.Position = $offset
        while ($offset -lt $ExpectedBytes) {
            $count = [int][Math]::Min([int64]8192, $ExpectedBytes - $offset)
            $part = New-Object byte[] $count
            $read = $file.Read($part, 0, $count)
            if ($read -ne $count) {
                throw "Unexpected end of local artifact while staging $StagePath."
            }
            $expectedRemoteSize = $offset + $count
            $committed = $false
            for ($attempt = 1; $attempt -le 6; $attempt += 1) {
                Write-RemoteChunk -RemotePath $StagePath -Bytes $part -Append ($offset -gt 0)
                Start-Sleep -Milliseconds 250
                $actualRemoteSize = Get-RemoteSize -RemotePath $StagePath
                if ($actualRemoteSize -eq $expectedRemoteSize) {
                    $committed = $true
                    break
                }
                if ($actualRemoteSize -ne $offset) {
                    throw "Unexpected small-stage size for ${StagePath}: actual=$actualRemoteSize offset=$offset intended=$expectedRemoteSize."
                }
                Start-Sleep -Milliseconds (250 * $attempt)
            }
            if (-not $committed) {
                throw "Unable to commit small staged bytes for $StagePath; error type=$script:lastFtpWriteError."
            }
            $offset = $expectedRemoteSize
        }
    }
    finally {
        $file.Dispose()
    }
    Write-Host "verified remote small-stage offset $offset of $ExpectedBytes bytes"
}

# Resumes a large hash-named stage through continuous FTPS streams and verified offsets.
function Write-StagedArtifact {
    param([byte[]]$Payload, [string]$StagePath, [int64]$ExpectedBytes)

    if ($null -eq $Payload -or $ExpectedBytes -le 0 -or
        $Payload.LongLength -ne $ExpectedBytes -or $ExpectedBytes -gt (256 * 1024 * 1024)) {
        throw "Staged payload identity is invalid."
    }

    if ($ExpectedBytes -le (8 * 1024 * 1024)) {
        Write-StagedSmallArtifact -Payload $Payload -StagePath $StagePath -ExpectedBytes $ExpectedBytes
        return
    }

    $offset = Get-RemoteSize -RemotePath $StagePath
    if ($offset -lt 0 -or $offset -gt $ExpectedBytes) {
        Remove-RemoteFile -RemotePath $StagePath
        $offset = 0
    }
    if ($offset -eq $ExpectedBytes) {
        return
    }
    $stageLeaf = (Get-RemoteFilePathParts -RemotePath $StagePath).leaf
    Write-Host "resuming $stageLeaf at $offset of $ExpectedBytes bytes"
    $buffer = New-Object byte[] (1 * 1024 * 1024)
    $progressInterval = 64 * 1024 * 1024
    $nextProgress = ([Math]::Floor($offset / $progressInterval) + 1) * $progressInterval
    $stalledAttempts = 0

    while ($offset -lt $ExpectedBytes) {
        $transferError = $null
        if ($offset -gt 0) {
            $method = [Net.WebRequestMethods+Ftp]::AppendFile
        }
        else {
            $method = [Net.WebRequestMethods+Ftp]::UploadFile
        }
        $request = New-FtpRequest -RemotePath $StagePath -Method $method
        $request.ContentLength = $ExpectedBytes - $offset
        $file = [IO.MemoryStream]::new($Payload, $false)
        $file.Position = $offset
        try {
            $upload = $request.GetRequestStream()
            try {
                $sent = $offset
                while (($count = $file.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $upload.Write($buffer, 0, $count)
                    $sent += $count
                    if ($sent -ge $nextProgress -or $sent -eq $ExpectedBytes) {
                        $percent = [Math]::Round(($sent * 100.0) / $ExpectedBytes, 1)
                        Write-Host ("streamed {0}: {1}%" -f $stageLeaf, $percent)
                        while ($nextProgress -le $sent) {
                            $nextProgress += $progressInterval
                        }
                    }
                }
                $upload.Flush()
            }
            finally {
                try { $upload.Dispose() } catch { }
            }
            try {
                $response = $request.GetResponse()
                $response.Dispose()
            }
            catch {
                # This host can return 451 after committing bytes; remote size remains authoritative.
                $transferError = Get-SafeExceptionIdentity -Exception $_.Exception
            }
        }
        catch {
            $transferError = Get-SafeExceptionIdentity -Exception $_.Exception
        }
        finally {
            $file.Dispose()
        }

        Start-Sleep -Milliseconds 750
        $actualRemoteSize = [int64]-1
        for ($probe = 1; $probe -le 5; $probe += 1) {
            $actualRemoteSize = Get-RemoteSize -RemotePath $StagePath
            if ($actualRemoteSize -ge 0) {
                break
            }
            Start-Sleep -Milliseconds (500 * $probe)
        }
        if ($actualRemoteSize -lt $offset -or $actualRemoteSize -gt $ExpectedBytes) {
            throw "Unexpected staged size for ${StagePath}: actual=$actualRemoteSize offset=$offset."
        }
        if ($actualRemoteSize -eq $offset) {
            $stalledAttempts += 1
            if ($stalledAttempts -ge 3) {
                throw "Continuous FTPS staging made no progress for $StagePath; error type=$transferError."
            }
            Start-Sleep -Seconds $stalledAttempts
            continue
        }

        $offset = $actualRemoteSize
        $stalledAttempts = 0
        $nextProgress = ([Math]::Floor($offset / $progressInterval) + 1) * $progressInterval
        Write-Host "verified remote stage offset $offset of $ExpectedBytes bytes"
    }
}

# Stages an artifact and retries once from byte zero if authenticated verification fails.
function Stage-VerifiedArtifact {
    param(
        [byte[]]$Payload,
        [string]$StagePath,
        [int64]$ExpectedBytes,
        [string]$ExpectedSha256
    )

    if ($null -eq $Payload -or $ExpectedBytes -le 0 -or $Payload.LongLength -ne $ExpectedBytes -or
        $ExpectedBytes -gt (256 * 1024 * 1024) -or $ExpectedSha256 -notmatch "^[0-9a-f]{64}$" -or
        (Get-ByteArraySha256 -Bytes $Payload) -ne $ExpectedSha256) {
        throw "Staged payload failed verification before remote mutation."
    }
    for ($cycle = 1; $cycle -le 2; $cycle += 1) {
        Set-ArtifactOperationState -Step "stage-write" -Attempt $cycle
        Write-StagedArtifact -Payload $Payload -StagePath $StagePath -ExpectedBytes $ExpectedBytes
        $stageLeaf = (Get-RemoteFilePathParts -RemotePath $StagePath).leaf
        Write-Host "verifying staged $stageLeaf"
        Set-ArtifactOperationState -Step "stage-authenticated-readback" -Attempt $cycle
        if (Test-RemoteArtifact `
            -RemotePath $StagePath `
            -ExpectedBytes $ExpectedBytes `
            -ExpectedSha256 $ExpectedSha256 `
            -AuthenticatedOnly) {
            return
        }
        Set-ArtifactOperationState -Step "stage-reset" -Attempt $cycle
        Remove-RemoteFile -RemotePath $StagePath
    }
    Set-ArtifactOperationState -Step "stage-verification-exhausted" -Attempt 2
    throw "Remote SHA-256 verification failed for staged artifact $StagePath."
}

# Reads and verifies canonical bytes into bounded memory before any remote mutation.
function Assert-DeploymentInputEntry {
    param([object]$DeploymentInputEntry)

    if (-not $DeploymentInputEntry) {
        throw "The deployment input is unavailable."
    }
    $source = [string]$DeploymentInputEntry.source
    $local = Assert-RemoteProtocolPath `
        -RemotePath ([string]$DeploymentInputEntry.local)
    $remote = Assert-RemoteProtocolPath `
        -RemotePath ([string]$DeploymentInputEntry.remote)
    if (($source -ne "source" -and $source -ne "generated-release") -or
        -not [string]::Equals($local, $remote, [StringComparison]::Ordinal) -or
        $remote -match "(?i)(^|/)(\.git|\.uai)(/|$)" -or
        $remote -match "(?i)(^|/)(workspace|taboo)\.uai$" -or
        $remote -match "(?i)(^|/)verify-single-source-authority\.(js|ps1|sh)$" -or
        [int64]$DeploymentInputEntry.byteCount -le 0 -or
        [int64]$DeploymentInputEntry.byteCount -gt (256 * 1024 * 1024) -or
        [string]$DeploymentInputEntry.sha256 -notmatch "^[0-9a-f]{64}$") {
        throw "The canonical deployment input entry is invalid."
    }
    $payloadRoot = if ($source -eq "source") { "E:\Source\Rust\TinyRustLM.com\tinyrustlm" }
        else { Assert-CanonicalDeploymentArtifactPath -Path $script:generatedReleaseRoot }
    $localPath = [IO.Path]::GetFullPath(
        (Join-Path $payloadRoot ($remote.Replace("/", "\")))
    )
    $payloadPrefix = $payloadRoot.TrimEnd("\", "/") +
        [IO.Path]::DirectorySeparatorChar
    if (-not $localPath.StartsWith(
        $payloadPrefix,
        [StringComparison]::OrdinalIgnoreCase
    ) -or -not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
        throw "The canonical deployment input entry is missing or escaped custody."
    }
    Assert-NoReparsePointAncestry `
        -Path $localPath `
        -FailureMessage "The canonical deployment input entry traverses a reparse point."
    $item = Get-Item -LiteralPath $localPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$item.Length -ne [int64]$DeploymentInputEntry.byteCount -or
        $item -isnot [IO.FileInfo]) {
        throw "The canonical deployment input entry failed byte verification."
    }
    $payload = New-Object byte[] ([int]$DeploymentInputEntry.byteCount)
    $stream = [IO.File]::Open($localPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        if ($stream.Length -ne $payload.LongLength) { throw "Deployment input length changed." }
        $offset = 0
        while ($offset -lt $payload.Length) {
            $count = $stream.Read($payload, $offset, $payload.Length - $offset)
            if ($count -le 0) { throw "Deployment input was truncated." }
            $offset += $count
        }
        if ($stream.ReadByte() -ne -1 -or
            (Get-ByteArraySha256 -Bytes $payload) -ne [string]$DeploymentInputEntry.sha256) {
            throw "Deployment input bytes changed before publication."
        }
    }
    finally { $stream.Dispose() }
    return [pscustomobject]@{
        source = $source
        local = $local
        remote = $remote
        payload = $payload
        byte_count = [int64]$DeploymentInputEntry.byteCount
        sha256 = [string]$DeploymentInputEntry.sha256
    }
}

# Promotes verified memory bytes with bounded per-file recovery after transport admission.
function Publish-Artifact {
    param([object]$DeploymentInputEntry, [switch]$CommitMarker)

    if ($script:artifactPublicationAdmitted -ne $true) {
        throw "Sequential FTPS publication has not been admitted."
    }
    if ([string]$script:deploymentLeaseId -notmatch "^[0-9a-f]{32}$") {
        throw "An exclusive deployment lease is required before publication."
    }
    $inputEntry = Assert-DeploymentInputEntry `
        -DeploymentInputEntry $DeploymentInputEntry
    $Source = [string]$inputEntry.source
    $LocalRelativePath = [string]$inputEntry.local
    $RemoteRelativePath = [string]$inputEntry.remote
    $isCommitMarker = [string]::Equals(
        $RemoteRelativePath,
        ".well-known/site-release.json",
        [StringComparison]::Ordinal
    )
    if ($isCommitMarker -and -not $CommitMarker) {
        throw "Per-artifact publication cannot mutate the release commit marker."
    }
    if ($CommitMarker -and (-not $isCommitMarker -or $script:regularArtifactsVerifiedForCommit -ne $true)) {
        throw "The release commit marker requires verified regular publication first."
    }

    $script:activeArtifactLocal = $LocalRelativePath
    $script:activeArtifactRemote = $RemoteRelativePath
    $script:artifactPrimaryFailureStep = $null
    $script:artifactRollbackStatus = "not-started"
    $script:artifactPredecessorIdentity = $null
    $script:artifactPromotedReadbackVerified = $false
    Set-ArtifactOperationState -Step "local-validation"
    $payload = [byte[]]$inputEntry.payload
    $bytes = [int64]$inputEntry.byte_count
    $sha256 = [string]$inputEntry.sha256
    $isHostPolicy = $RemoteRelativePath.EndsWith(".htaccess", [StringComparison]::OrdinalIgnoreCase)
    $readbackKind = if ($isHostPolicy) {
        "authenticated-ftps"
    }
    else {
        "public-https"
    }
    $remoteParts = Get-RemoteFilePathParts -RemotePath $RemoteRelativePath
    $directory = $remoteParts.parent
    $leaf = $remoteParts.leaf
    $artifactIdentity = ([string]$inputEntry.sha256).Substring(0, 12)
    $leaseRouteIdentity = $script:deploymentLeaseId.Substring(0, 12)
    $leaseRouteRemainder = $script:deploymentLeaseId.Substring(12)
    $stageLeaf = "deploy-{0}-stage-{1}-{2}.slm" -f `
        $leaseRouteIdentity,
        $leaseRouteRemainder,
        $artifactIdentity
    $backupLeaf = "backup-{0}.slm" -f $leaseRouteIdentity
    $stagePath = if ($directory) { "$directory/$stageLeaf" } else { $stageLeaf }
    $backupPath = if ($directory) { "$directory/$backupLeaf" } else { $backupLeaf }

    Set-ArtifactOperationState -Step "current-artifact-readback"
    $currentSize = Get-RemoteSize -RemotePath $RemoteRelativePath
    if ($currentSize -eq $bytes -and
        (Test-RemoteArtifact -RemotePath $RemoteRelativePath -ExpectedBytes $bytes -ExpectedSha256 $sha256)) {
        if ($isCommitMarker) { $script:releaseMarkerFinalPathReadbackObserved = $true }
        if ($isHostPolicy) {
            Set-ArtifactOperationState -Step "public-host-policy"
            $script:publicHostPolicyEvidence = Test-PublicHostPolicy
        }
        Set-ArtifactOperationState -Step "current-temporary-admission"
        $script:deploymentLeaseReleasable = $false
        if ((Get-RemoteSize -RemotePath $stagePath) -ge 0 -or
            (Get-RemoteSize -RemotePath $backupPath) -ge 0) {
            throw "Operation-owned deployment temporary state already exists."
        }
        $script:deploymentLeaseReleasable = $true
        Write-Host "verified existing $RemoteRelativePath"
        Assert-DeploymentInputEntry `
            -DeploymentInputEntry $DeploymentInputEntry | Out-Null
        Set-ArtifactOperationState -Step "complete"
        return [pscustomobject]@{
            source = $Source
            custody = "canonical-deployment-input"
            local_relative_path = $LocalRelativePath
            relative_path = $RemoteRelativePath
            bytes = $bytes
            sha256 = $sha256
            readback = $readbackKind
            readback_verified = $true
            public_host_policy_verified = $isHostPolicy
            temporary_cleanup_verified = $true
            status = "already-current"
        }
    }

    $script:deploymentLeaseReleasable = $false
    Set-ArtifactOperationState -Step "temporary-admission"
    if ((Get-RemoteSize -RemotePath $stagePath) -ge 0 -or
        (Get-RemoteSize -RemotePath $backupPath) -ge 0) {
        throw "Operation-owned deployment temporary state already exists."
    }
    Stage-VerifiedArtifact `
        -Payload $payload `
        -StagePath $stagePath `
        -ExpectedBytes $bytes `
        -ExpectedSha256 $sha256

    Set-ArtifactOperationState -Step "predecessor-state-read"
    $predecessorSize = Get-RemoteSize -RemotePath $RemoteRelativePath
    $targetExisted = $predecessorSize -ge 0
    $predecessor = $null
    if ($targetExisted) {
        $predecessor = Get-FtpsArtifactIdentity -RemotePath $RemoteRelativePath -ExpectedBytes $predecessorSize
        $script:artifactPredecessorIdentity = $predecessor
        Set-ArtifactOperationState -Step "predecessor-backup"
        $script:publicArtifactMutationAttempted = $true
        Rename-RemoteFile -RemotePath $RemoteRelativePath -NewLeafName $backupLeaf
        if (-not (Test-RemoteArtifact -RemotePath $backupPath -ExpectedBytes $predecessor.bytes `
            -ExpectedSha256 $predecessor.sha256 -AuthenticatedOnly)) {
            throw "The predecessor backup identity changed; recovery state was preserved."
        }
    }
    try {
        Set-ArtifactOperationState -Step "stage-promotion"
        if ((Get-RemoteSize -RemotePath $RemoteRelativePath) -ge 0) {
            throw "The publication target changed before promotion."
        }
        $script:publicArtifactMutationAttempted = $true
        Rename-RemoteFile -RemotePath $stagePath -NewLeafName $leaf
        Start-Sleep -Milliseconds 750
        Set-ArtifactOperationState -Step "promoted-readback"
        if (-not (Test-RemoteArtifact -RemotePath $RemoteRelativePath -ExpectedBytes $bytes -ExpectedSha256 $sha256)) {
            throw "Remote SHA-256 verification failed after promoting $RemoteRelativePath."
        }
        $script:artifactPromotedReadbackVerified = $true
        if ($isCommitMarker) { $script:releaseMarkerFinalPathReadbackObserved = $true }
        if ($isHostPolicy) {
            Set-ArtifactOperationState -Step "public-host-policy"
            $script:publicHostPolicyEvidence = Test-PublicHostPolicy
        }
    }
    catch {
        $promotionFailure = $_
        $script:artifactPrimaryFailureStep = $script:artifactOperationStep
        $script:artifactRollbackStatus = "running"
        try {
            # Check the exact predecessor before removing any candidate. There is
            # no remote/global lease: a foreign target must remain untouched.
            if ($targetExisted -and -not (Test-RemoteArtifact -RemotePath $backupPath `
                -ExpectedBytes $predecessor.bytes -ExpectedSha256 $predecessor.sha256 -AuthenticatedOnly)) {
                throw "The predecessor backup identity cannot be verified."
            }
            Set-ArtifactOperationState -Step "rollback-target-removal"
            if ((Get-RemoteSize -RemotePath $RemoteRelativePath) -ge 0) {
                if (-not (Test-RemoteArtifact -RemotePath $RemoteRelativePath -ExpectedBytes $bytes `
                    -ExpectedSha256 $sha256 -AuthenticatedOnly)) {
                    throw "An unowned target prevents rollback."
                }
                Remove-RemoteFile -RemotePath $RemoteRelativePath
            }
            if ((Get-RemoteSize -RemotePath $RemoteRelativePath) -ge 0) {
                throw "Rollback target removal cannot be verified."
            }
            if ($isCommitMarker) { $script:releaseMarkerFinalPathReadbackObserved = $false }
            $script:artifactPromotedReadbackVerified = $false
            if ($targetExisted) {
                Set-ArtifactOperationState -Step "rollback-restore"
                Rename-RemoteFile -RemotePath $backupPath -NewLeafName $leaf
                if (-not (Test-RemoteArtifact -RemotePath $RemoteRelativePath `
                    -ExpectedBytes $predecessor.bytes -ExpectedSha256 $predecessor.sha256 -AuthenticatedOnly)) {
                    throw "Rollback predecessor identity could not be verified."
                }
                $script:artifactRollbackStatus = "restored"
            }
            else {
                $script:artifactRollbackStatus = "target-absent"
            }
            Set-ArtifactOperationState -Step "rollback-temporary-cleanup"
            Remove-RemoteFile -RemotePath $stagePath
            if ((Get-RemoteSize -RemotePath $stagePath) -ge 0 -or
                (Get-RemoteSize -RemotePath $backupPath) -ge 0) {
                throw "Rollback temporary cleanup could not be verified."
            }
            $script:deploymentLeaseReleasable = $true
        }
        catch {
            $script:artifactRollbackStatus = "failed"
            Set-ArtifactOperationState -Step "rollback-failed"
            throw "Deployment promotion failed and rollback could not be verified."
        }
        Set-ArtifactOperationState -Step $script:artifactPrimaryFailureStep
        throw $promotionFailure
    }

    # Cleanup is deliberately outside rollback. A failed delete acknowledgement
    # may mean the only predecessor is gone; preserve the verified replacement.
    Set-ArtifactOperationState -Step "temporary-cleanup"
    try {
        if (-not (Test-RemoteArtifact -RemotePath $RemoteRelativePath -ExpectedBytes $bytes `
            -ExpectedSha256 $sha256 -AuthenticatedOnly)) {
            throw "The promoted target changed before cleanup."
        }
        if ($targetExisted) {
            if (-not (Test-RemoteArtifact -RemotePath $backupPath -ExpectedBytes $predecessor.bytes `
                -ExpectedSha256 $predecessor.sha256 -AuthenticatedOnly)) {
                throw "The predecessor backup changed before cleanup."
            }
            Remove-RemoteFile -RemotePath $backupPath
        }
        if ((Get-RemoteSize -RemotePath $backupPath) -ge 0 -or
            (Get-RemoteSize -RemotePath $stagePath) -ge 0) {
            throw "Deployment temporary cleanup could not be verified."
        }
    }
    catch {
        $script:artifactPrimaryFailureStep = "temporary-cleanup"
        $script:artifactRollbackStatus = "not-attempted-after-verified-promotion"
        throw
    }
    Assert-DeploymentInputEntry `
        -DeploymentInputEntry $DeploymentInputEntry | Out-Null
    $script:deploymentLeaseReleasable = $true
    Write-Host "published $RemoteRelativePath"
    Set-ArtifactOperationState -Step "complete"
    return [pscustomobject]@{
        source = $Source
        custody = "canonical-deployment-input"
        local_relative_path = $LocalRelativePath
        relative_path = $RemoteRelativePath
        bytes = $bytes
        sha256 = $sha256
        readback = $readbackKind
        readback_verified = $true
        public_host_policy_verified = $isHostPolicy
        temporary_cleanup_verified = $true
        status = "published"
    }
}

# Loads the two exact predecessor-oracle files without retaining a source-ledger copy.
function Get-PublicPredecessorExpectation {
    param([object]$Oracle, [string]$OracleRoot)

    if (-not $Oracle -or
        [string]$Oracle.status -ne "pass" -or
        [string]$Oracle.predecessorReleaseId -ne "tinyrustlm.com@0.4.1" -or
        [string]$Oracle.predecessorVersion -ne "0.4.1" -or
        [string]$Oracle.pendingReleaseId -ne "tinyrustlm.com@0.5.0" -or
        [string]$Oracle.pendingVersion -ne "0.5.0" -or
        @($Oracle.files).Count -ne 2) {
        throw "Public predecessor oracle output is invalid."
    }
    $root = [IO.Path]::GetFullPath($OracleRoot)
    $publicRoot = [IO.Path]::GetFullPath((Join-Path $root "public"))
    $expected = @{}
    foreach ($entry in @($Oracle.files)) {
        $relativePath = Assert-RemoteProtocolPath `
            -RemotePath ([string]$entry.relativePath)
        if ($relativePath -ne ".well-known/site-release.json" -and
            $relativePath -ne ".well-known/site-release-history.json") {
            throw "Public predecessor oracle path closure is invalid."
        }
        $path = [IO.Path]::GetFullPath(
            (Join-Path $publicRoot ($relativePath.Replace("/", "\")))
        )
        $publicPrefix = $publicRoot.TrimEnd("\", "/") +
            [IO.Path]::DirectorySeparatorChar
        if (-not $path.StartsWith(
            $publicPrefix,
            [StringComparison]::OrdinalIgnoreCase
        ) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Public predecessor oracle file escaped custody."
        }
        Assert-NoReparsePointAncestry `
            -Path $path `
            -FailureMessage "Public predecessor oracle traverses a reparse point."
        $item = Get-Item -LiteralPath $path -Force
        if ([int64]$item.Length -le 0 -or
            [int64]$item.Length -gt (1024 * 1024) -or
            [int64]$item.Length -ne [int64]$entry.byteCount -or
            [string]$entry.sha256 -notmatch "^[0-9a-f]{64}$" -or
            (Get-FileSha256 -Path $path) -ne [string]$entry.sha256) {
            throw "Public predecessor oracle file identity is invalid."
        }
        if ($expected.ContainsKey($relativePath)) {
            throw "Public predecessor oracle path is duplicated."
        }
        $expected[$relativePath] = [pscustomobject]@{
            relative_path = $relativePath
            byte_count = [int64]$item.Length
            sha256 = [string]$entry.sha256
            bytes = [IO.File]::ReadAllBytes($path)
            local_path = $path
        }
    }
    if ($expected.Count -ne 2 -or
        -not $expected.ContainsKey(".well-known/site-release.json") -or
        -not $expected.ContainsKey(".well-known/site-release-history.json")) {
        throw "Public predecessor oracle closure is incomplete."
    }
    return [pscustomobject]@{
        predecessor_release_id = [string]$Oracle.predecessorReleaseId
        predecessor_version = [string]$Oracle.predecessorVersion
        predecessor_publication_id = [string]$Oracle.predecessorPublicationId
        pending_release_id = [string]$Oracle.pendingReleaseId
        pending_version = [string]$Oracle.pendingVersion
        predecessor_ledger_sha256 = [string]$Oracle.predecessorLedgerSha256
        current = $expected[".well-known/site-release.json"]
        history = $expected[".well-known/site-release-history.json"]
    }
}

# Delegates predecessor cleanup to the custodied exact-inventory remover.
function Remove-PublicPredecessorOracle {
    param(
        [object]$Expected,
        [string]$OracleRoot,
        [string]$RepositoryRoot,
        [string]$ToolPath,
        [object]$SourceCustody
    )

    if (-not (Test-Path -LiteralPath $OracleRoot)) {
        if ($Expected) {
            throw "Public predecessor oracle disappeared before verified cleanup."
        }
        return [pscustomobject]@{ cleanup_verified = $true; status = "already-absent" }
    }
    $root = [IO.Path]::GetFullPath($OracleRoot)
    $repository = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd("\", "/")
    $repositoryPrefix = $repository + [IO.Path]::DirectorySeparatorChar
    if ($root.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($root) -notmatch
            "^tinyrustlm-web-predecessor-[0-9a-f]{32}$" -or
        -not $Expected -or
        -not $Expected.current -or
        -not $Expected.history -or
        [string]::IsNullOrWhiteSpace($ToolPath) -or
        -not $SourceCustody) {
        throw "Public predecessor oracle cleanup target is unsafe."
    }
    $output = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $SourceCustody `
        -ToolPath $ToolPath `
        -Arguments @(
            "remove-predecessor",
            $RepositoryRoot,
            $root,
            [string]$Expected.current.byte_count,
            [string]$Expected.current.sha256,
            [string]$Expected.history.byte_count,
            [string]$Expected.history.sha256,
            "--json"
        ))
    if ($output.Count -ne 1) {
        throw "Public predecessor oracle cleanup failed."
    }
    $result = $output[0] | ConvertFrom-Json
    if ([string]$result.status -ne "pass" -or
        $result.cleanupVerified -ne $true -or
        [int]$result.fileCount -ne 2 -or
        (Test-Path -LiteralPath $root)) {
        throw "Public predecessor oracle cleanup could not be verified."
    }
    return [pscustomobject]@{
        cleanup_verified = $true
        status = "removed"
        file_count = 2
    }
}

# Deletes one operation-owned evidence file only after deletion-time identity checks.
function Remove-VerifiedDeploymentEvidenceFile {
    param(
        [string]$Path,
        [string]$OwnedDirectory,
        [int64]$ExpectedByteCount,
        [string]$ExpectedSha256
    )

    if ([string]::IsNullOrWhiteSpace($Path) -or
        [string]::IsNullOrWhiteSpace($OwnedDirectory) -or
        -not [IO.Path]::IsPathRooted($Path) -or
        -not [IO.Path]::IsPathRooted($OwnedDirectory) -or
        $ExpectedByteCount -le 0 -or
        $ExpectedByteCount -gt (4 * 1024 * 1024) -or
        $ExpectedSha256 -notmatch "^[0-9a-f]{64}$") {
        throw "Deployment evidence cleanup identity is invalid."
    }
    $target = [IO.Path]::GetFullPath($Path)
    $directory = [IO.Path]::GetFullPath($OwnedDirectory).TrimEnd("\", "/")
    $directoryPrefix = $directory + [IO.Path]::DirectorySeparatorChar
    if (-not $target.StartsWith(
            $directoryPrefix,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        -not [string]::Equals(
            (Split-Path -Parent $target),
            $directory,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        -not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw "Deployment evidence cleanup escaped its owned directory."
    }
    foreach ($candidate in @($directory, $target)) {
        Assert-NoReparsePointAncestry `
            -Path $candidate `
            -FailureMessage "Deployment evidence cleanup target is unsafe."
    }
    $item = Get-Item -LiteralPath $target -Force
    $creationTime = $item.CreationTimeUtc.Ticks
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$item.Length -ne $ExpectedByteCount -or
        (Get-FileSha256 -Path $target) -ne $ExpectedSha256) {
        throw "Deployment evidence changed before cleanup."
    }
    Assert-NoReparsePointAncestry `
        -Path $target `
        -FailureMessage "Deployment evidence cleanup target is unsafe."
    $deletionItem = Get-Item -LiteralPath $target -Force
    if (($deletionItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$deletionItem.Length -ne $ExpectedByteCount -or
        $deletionItem.CreationTimeUtc.Ticks -ne $creationTime -or
        (Get-FileSha256 -Path $target) -ne $ExpectedSha256) {
        throw "Deployment evidence identity changed at deletion time."
    }
    [IO.File]::Delete($target)
    if (Test-Path -LiteralPath $target) {
        throw "Deployment evidence cleanup could not be verified."
    }
    return [pscustomobject]@{
        cleanup_verified = $true
        byte_count = $ExpectedByteCount
        sha256 = $ExpectedSha256
    }
}

# Resolves one new canonical artifact receipt path and rejects reparse-point parents.
function Resolve-NewDeploymentReportPath {
    param([string]$Path, [string]$SourceRoot)

    if ([string]::IsNullOrWhiteSpace($Path) -or
        -not [IO.Path]::IsPathRooted($Path)) {
        throw "Deployment report path must be absolute."
    }
    if ([string]::IsNullOrWhiteSpace($SourceRoot) -or
        -not [IO.Path]::IsPathRooted($SourceRoot)) {
        throw "Deployment source root must be absolute."
    }
    $target = Assert-CanonicalDeploymentArtifactPath -Path $Path -SourceRoot $SourceRoot
    if (-not [string]::Equals(
        [IO.Path]::GetExtension($target),
        ".json",
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Deployment report path must name a JSON file."
    }
    if (Test-Path -LiteralPath $target) {
        throw "Deployment report path must be new and immutable."
    }
    $directory = Split-Path -Parent $target
    if ([string]::IsNullOrWhiteSpace($directory)) {
        throw "Deployment report directory is invalid."
    }
    $existingDirectory = $directory
    while (-not (Test-Path -LiteralPath $existingDirectory -PathType Container)) {
        $parent = Split-Path -Parent $existingDirectory
        if ([string]::IsNullOrWhiteSpace($parent) -or
            [string]::Equals(
                $parent,
                $existingDirectory,
                [StringComparison]::OrdinalIgnoreCase
            )) {
            throw "Deployment report directory has no safe existing ancestor."
        }
        $existingDirectory = $parent
    }
    $cursor = Get-Item -LiteralPath $existingDirectory -Force
    while ($cursor) {
        if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Deployment report directory cannot traverse a reparse point."
        }
        $cursor = $cursor.Parent
    }
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $cursor = Get-Item -LiteralPath $directory -Force
    while ($cursor) {
        if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Deployment report directory cannot traverse a reparse point."
        }
        $cursor = $cursor.Parent
    }
    return $target
}

# Creates one bounded immutable JSON receipt and reopens it after atomic publication.
function Write-AtomicJson {
    param([string]$Path, [object]$Value)

    $target = [IO.Path]::GetFullPath($Path)
    $directory = Split-Path -Parent $target
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    Assert-NoReparsePointAncestry `
        -Path $directory `
        -FailureMessage "Immutable deployment report directory is unsafe."
    if (Test-Path -LiteralPath $target) {
        throw "Immutable deployment report path already exists."
    }
    $temporary = Join-Path $directory (".{0}.{1}.tmp" -f ([IO.Path]::GetFileName($target)), [Guid]::NewGuid().ToString("N"))
    $utf8 = [Text.UTF8Encoding]::new($false, $true)
    $temporaryCreationTicks = $null
    $temporaryExpectedBytes = $null
    $temporaryExpectedSha256 = $null
    try {
        $json = ($Value | ConvertTo-Json -Depth 8) + [Environment]::NewLine
        $jsonBytes = $utf8.GetBytes($json)
        if ($jsonBytes.LongLength -gt (4 * 1024 * 1024)) {
            throw "Deployment report exceeds the bounded JSON size."
        }
        $stream = [IO.FileStream]::new(
            $temporary,
            [IO.FileMode]::CreateNew,
            [IO.FileAccess]::Write,
            [IO.FileShare]::None,
            4096,
            [IO.FileOptions]::WriteThrough
        )
        try {
            $stream.Write($jsonBytes, 0, $jsonBytes.Length)
            $stream.Flush($true)
        }
        finally {
            $stream.Dispose()
        }

        $temporaryText = [IO.File]::ReadAllText($temporary, $utf8)
        $temporaryText | ConvertFrom-Json | Out-Null
        Assert-NoReparsePointAncestry `
            -Path $temporary `
            -FailureMessage "Immutable deployment report temporary file is unsafe."
        $temporaryItem = Get-Item -LiteralPath $temporary -Force
        if (($temporaryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Immutable deployment report temporary file is unsafe."
        }
        $temporaryCreationTicks = $temporaryItem.CreationTimeUtc.Ticks
        $temporaryExpectedBytes = [int64]$temporaryItem.Length
        $temporaryExpectedSha256 = Get-FileSha256 -Path $temporary
        if (Test-Path -LiteralPath $target) {
            throw "Immutable deployment report path was claimed concurrently."
        }
        Assert-NoReparsePointAncestry `
            -Path $temporary `
            -FailureMessage "Immutable deployment report temporary file is unsafe."
        $moveItem = Get-Item -LiteralPath $temporary -Force
        if (($moveItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            $moveItem.CreationTimeUtc.Ticks -ne $temporaryCreationTicks -or
            [int64]$moveItem.Length -ne $temporaryExpectedBytes -or
            (Get-FileSha256 -Path $temporary) -ne $temporaryExpectedSha256) {
            throw "Immutable deployment report temporary identity changed."
        }
        [IO.File]::Move($temporary, $target)

        Assert-NoReparsePointAncestry `
            -Path $target `
            -FailureMessage "Committed deployment report is unsafe."
        $committedItem = Get-Item -LiteralPath $target -Force
        if (($committedItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            $committedItem.CreationTimeUtc.Ticks -ne $temporaryCreationTicks) {
            throw "Committed deployment report identity changed."
        }
        $committedBytes = [int64]$committedItem.Length
        $committedSha256 = Get-FileSha256 -Path $target
        $committedText = [IO.File]::ReadAllText($target, $utf8)
        $committedText | ConvertFrom-Json | Out-Null
        if ($committedBytes -ne $temporaryExpectedBytes -or
            $committedSha256 -ne $temporaryExpectedSha256) {
            throw "Committed deployment report failed reopen validation."
        }
        return [pscustomobject]@{
            bytes = $committedBytes
            sha256 = $committedSha256
        }
    }
    catch [IO.IOException] {
        throw "Immutable deployment report filesystem operation failed."
    }
    catch [UnauthorizedAccessException] {
        throw "Immutable deployment report filesystem operation failed."
    }
    finally {
        try {
            if (Test-Path -LiteralPath $temporary) {
                if ($null -eq $temporaryCreationTicks -or
                    $null -eq $temporaryExpectedBytes -or
                    $null -eq $temporaryExpectedSha256) {
                    throw "Immutable deployment report temporary identity is unavailable."
                }
                Assert-NoReparsePointAncestry `
                    -Path $temporary `
                    -FailureMessage "Immutable deployment report temporary cleanup is unsafe."
                $cleanupItem = Get-Item -LiteralPath $temporary -Force
                if (($cleanupItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
                    $cleanupItem.CreationTimeUtc.Ticks -ne $temporaryCreationTicks -or
                    [int64]$cleanupItem.Length -ne $temporaryExpectedBytes -or
                    (Get-FileSha256 -Path $temporary) -ne $temporaryExpectedSha256) {
                    throw "Immutable deployment report temporary cleanup identity changed."
                }
                [IO.File]::Delete($temporary)
                if (Test-Path -LiteralPath $temporary) {
                    throw "Immutable deployment report temporary cleanup is incomplete."
                }
            }
        }
        catch {
            throw "Immutable deployment report temporary cleanup failed."
        }
    }
}

$script:powershellHost = Resolve-PinnedDeploymentHost
$script:nodeExecutable = Resolve-PinnedDeploymentExecutable `
    -CommandName "node.exe" `
    -ExpectedLeafName "node.exe"
$script:curlExecutable = Resolve-PinnedDeploymentExecutable `
    -CommandName "curl.exe" `
    -ExpectedLeafName "curl.exe"
$script:gitExecutable = Resolve-PinnedDeploymentExecutable `
    -CommandName "git.exe" `
    -ExpectedLeafName "git.exe"
$deploymentToolVersions = Assert-PinnedDeploymentToolVersions `
    -PowerShellHost $script:powershellHost `
    -NodeExecutable $script:nodeExecutable `
    -CurlExecutable $script:curlExecutable `
    -GitExecutable $script:gitExecutable
$RepositoryRoot = Resolve-CanonicalDeploymentRepositoryRoot `
    -ScriptRoot $PSScriptRoot `
    -RequestedRepositoryRoot $RepositoryRoot
$siteRoot = Join-Path $RepositoryRoot "tinyrustlm"
if (-not (Test-Path -LiteralPath $siteRoot -PathType Container)) {
    throw "TinyRustLM site root was not found."
}
$sourceAuthorityVerifier = [IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "verify-single-source-authority.js")
)
$validatorPath = Join-Path $siteRoot "tools\web-deployment-manifest.js"
$releaseMaterializerPath = Join-Path $siteRoot "tools\site-release-contract.js"
$secretScanTool = Join-Path $siteRoot "tools\web-release-secret-scan.js"
$releaseLedgerPath = Join-Path $siteRoot "release\site-release-ledger.v1.json"
$expectedManifestPath = Join-Path $siteRoot "deploy\web-deployment-manifest.v2.json"
$ManifestPath = [IO.Path]::GetFullPath($ManifestPath)
if (-not [string]::Equals(
    $ManifestPath,
    [IO.Path]::GetFullPath($expectedManifestPath),
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw "Deployment requires the source-controlled TinyRustLM web manifest."
}
# Seal the verifier itself and its CommonJS closure before trusting its result.
$script:deploymentSourceCustody = New-DeploymentSourceCustody `
    -RepositoryRoot $RepositoryRoot `
    -PublisherPath $PSCommandPath `
    -NodeToolPaths @(
        $sourceAuthorityVerifier,
        $validatorPath,
        $releaseMaterializerPath,
        $secretScanTool
    )
Assert-DeploymentSourceCustody `
    -RepositoryRoot $RepositoryRoot `
    -Custody $script:deploymentSourceCustody | Out-Null
$sourceAuthorityOutput = @(Invoke-CustodiedNodeTool `
    -RepositoryRoot $RepositoryRoot `
    -Custody $script:deploymentSourceCustody `
    -ToolPath $sourceAuthorityVerifier `
    -Arguments @(
        "--require-clean",
        "--require-remote-exact"
    ))
if ($sourceAuthorityOutput.Count -ne 1) {
    throw "TinyRustLM deployment requires one clean remote-exact canonical source root."
}
try {
    $sourceAuthorityResult = $sourceAuthorityOutput[0] | ConvertFrom-Json
}
catch {
    throw "TinyRustLM source-authority verifier returned malformed output."
}
if ([string]$sourceAuthorityResult.verdict -ne "pass" -or
    $sourceAuthorityResult.canonicalLayoutAvailable -ne $true -or
    $sourceAuthorityResult.localScanPerformed -ne $true) {
    throw "TinyRustLM deployment requires one clean remote-exact canonical source root."
}
try {
    $deploymentManifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
}
catch {
    throw "Unable to read the validated TinyRustLM deployment manifest."
}
$script:publicOrigin = ([string]$deploymentManifest.publicOrigin).TrimEnd("/")

if ($ValidateCredentialProfileOnly) {
    $validatedDeploymentTarget = Get-WorkspaceDeploymentTargetBinding `
        -MemoryPath $WorkspaceMemory `
        -SourceRoot $RepositoryRoot
    $validatedCredentialProfile = Get-WorkspaceDeploymentCredentialProfile `
        -MemoryPath $WorkspaceMemory `
        -SourceRoot $RepositoryRoot `
        -TargetBinding $validatedDeploymentTarget
    Assert-DeploymentCredentialTarget `
        -CredentialProfile $validatedCredentialProfile `
        -TargetBinding $validatedDeploymentTarget
    $validatedCredentialProfile.password = $null
    $validatedCredentialProfile = $null
    $validatedDeploymentTarget = $null
    Write-Host "TinyRustLM external deployment credential profile validation passed."
    return
}
if ($ValidateOnly) {
    $validationOperationId = [Guid]::NewGuid().ToString("N")
    $validationParent = Assert-CanonicalDeploymentArtifactPath `
        -Path (Join-Path $RepositoryRoot "artifacts\verification\web-deployments") -SourceRoot $RepositoryRoot
    [IO.Directory]::CreateDirectory($validationParent) | Out-Null
    $validationOperationRoot = Join-Path $validationParent (
        "tinyrustlm-web-validation-{0}" -f $validationOperationId
    )
    $validationMaterialization = $null
    try {
        $validationMaterialization = New-OwnedValidationMaterialization `
            -OperationRoot $validationOperationRoot `
            -SourceRoot $RepositoryRoot `
            -OperationId $validationOperationId
        $validationReleaseRoot = [string]$validationMaterialization.release_root
        $ledgerValidationOutput = @(Invoke-CustodiedNodeTool `
            -RepositoryRoot $RepositoryRoot `
            -Custody $script:deploymentSourceCustody `
            -ToolPath $releaseMaterializerPath `
            -Arguments @("validate", $releaseLedgerPath))
        if ($ledgerValidationOutput.Count -ne 1) {
            throw "TinyRustLM release ledger validation failed."
        }
        $ledgerValidation = $ledgerValidationOutput[0] | ConvertFrom-Json
        if ([string]$ledgerValidation.status -ne "pass") {
            throw "TinyRustLM release ledger did not pass."
        }
        if ([string]::IsNullOrEmpty([string]$ledgerValidation.pendingReleaseId)) {
            $materializationOutput = @(Invoke-CustodiedNodeTool `
                -RepositoryRoot $RepositoryRoot `
                -Custody $script:deploymentSourceCustody `
                -ToolPath $releaseMaterializerPath `
                -Arguments @(
                    "materialize-finalized",
                    $releaseLedgerPath,
                    $validationReleaseRoot
                ))
        }
        else {
            $validationPublishedAt = [DateTime]::UtcNow.ToString(
                "yyyy-MM-ddTHH:mm:ss.fffZ",
                [Globalization.CultureInfo]::InvariantCulture
            )
            $materializationOutput = @(Invoke-CustodiedNodeTool `
                -RepositoryRoot $RepositoryRoot `
                -Custody $script:deploymentSourceCustody `
                -ToolPath $releaseMaterializerPath `
                -Arguments @(
                    "materialize",
                    $releaseLedgerPath,
                    $validationReleaseRoot,
                    ("0" * 40),
                    $validationPublishedAt
                ))
        }
        if ($materializationOutput.Count -ne 1) {
            throw "TinyRustLM release metadata materialization failed."
        }
        $validationOutput = @(Invoke-CustodiedNodeTool `
            -RepositoryRoot $RepositoryRoot `
            -Custody $script:deploymentSourceCustody `
            -ToolPath $validatorPath `
            -Arguments @(
                $siteRoot,
                $ManifestPath,
                $validationReleaseRoot,
                "--json"
            ))
        if ($validationOutput.Count -ne 1) {
            throw "TinyRustLM web deployment closure validation failed."
        }
        $validation = $validationOutput[0] | ConvertFrom-Json
        if ([string]$validation.status -ne "pass") {
            throw "TinyRustLM web deployment closure did not pass."
        }
        Write-Host "TinyRustLM web deployment validation passed for $($validation.fileCount) files."
    }
    finally {
        if ($validationMaterialization) {
            $validationCleanup = Remove-OwnedValidationMaterialization `
                -Materialization $validationMaterialization
            if ($validationCleanup.cleanup_verified -ne $true) {
                throw "TinyRustLM validation materialization cleanup did not pass."
            }
        }
    }
    return
}

$attemptId = "{0}-{1}" -f `
    [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffffffZ", [Globalization.CultureInfo]::InvariantCulture), `
    [Guid]::NewGuid().ToString("N").Substring(0, 12)
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    if ([string]::IsNullOrWhiteSpace($ReportDirectory)) {
        throw "Deployment report directory is required."
    }
    if (-not [IO.Path]::IsPathRooted($ReportDirectory)) {
        throw "Deployment report directory must be absolute."
    }
    $ReportDirectory = [IO.Path]::GetFullPath($ReportDirectory)
    $ReportPath = Join-Path $ReportDirectory ("tinyrustlm-web-deployment-{0}.json" -f $attemptId)
}
$ReportPath = Resolve-NewDeploymentReportPath -Path $ReportPath -SourceRoot $RepositoryRoot
$reportDirectory = Split-Path -Parent $ReportPath
# Operational output must not dirty the sealed source while the publisher runs.
# Final attempt/terminal receipts stay visible in reportDirectory for review and Git.
$deploymentScratchDirectory = Assert-CanonicalDeploymentArtifactPath `
    -Path (Join-Path $RepositoryRoot "artifacts\verification\web-deployments") -SourceRoot $RepositoryRoot
[IO.Directory]::CreateDirectory($deploymentScratchDirectory) | Out-Null
$script:generatedReleaseRoot = Join-Path $deploymentScratchDirectory (
    "tinyrustlm-web-release-assets-{0}" -f $attemptId
)
$predecessorOperationId = (Get-Utf8Sha256 -Value (
    "tinyrustlm-web-predecessor|{0}" -f $attemptId
)).Substring(0, 32)
$publicPredecessorRoot = Join-Path $deploymentScratchDirectory (
    "tinyrustlm-web-predecessor-{0}" -f $predecessorOperationId
)
$secretScanReportPath = Join-Path $deploymentScratchDirectory ("tinyrustlm-web-secret-scan-{0}.json" -f $attemptId)
$secretScanEvidenceRoot = Join-Path $deploymentScratchDirectory ("tinyrustlm-web-secret-scan-evidence-{0}" -f $attemptId)
$finalizedLedgerCandidatePath = Join-Path $deploymentScratchDirectory (
    "tinyrustlm-site-release-ledger-finalized-{0}.json" -f $attemptId
)
$terminalDecisionPath = Join-Path $reportDirectory (
    "tinyrustlm-web-deployment-terminal-decision-{0}.json" -f $attemptId
)
$deploymentLeaseDirectory = $deploymentScratchDirectory
[IO.Directory]::CreateDirectory($deploymentLeaseDirectory) | Out-Null
$deploymentLeasePath = Join-Path $deploymentLeaseDirectory "tinyrustlm.com.deployment-lease.v1.json"
$script:regularArtifactsVerifiedForCommit = $false
if ((Test-Path -LiteralPath $secretScanReportPath) -or
    (Test-Path -LiteralPath $secretScanEvidenceRoot) -or
    (Test-Path -LiteralPath $script:generatedReleaseRoot) -or
    (Test-Path -LiteralPath $publicPredecessorRoot) -or
    (Test-Path -LiteralPath $terminalDecisionPath) -or
    (Test-Path -LiteralPath $finalizedLedgerCandidatePath)) {
    throw "Unique deployment evidence output path already exists."
}

$rows = @()
$removedPublicArtifacts = @()
$status = "fail"
$failureIdentity = $null
$failureStep = $null
$startedUtc = [DateTime]::UtcNow
$operationPhase = "preflight-git"
$currentSourceCommit = $null
$sourceTreeClean = $null
$validation = $null
$secretScan = $null
$secretScanReportSha256 = $null
$secretScanScopeManifestSha256 = $null
$secretScanReceiptId = $null
$secretFindingCount = $null
$releaseId = $null
$releaseVersion = $null
$releaseDate = $null
$releasePublishedAt = $null
$releasePublicationId = $null
$releaseLedgerSha256 = $null
$finalizedLedgerCandidateSha256 = $null
$finalizedLedgerCandidateByteCount = $null
$deploymentTarget = $null
$deploymentTargetEvidence = $null
$deploymentInput = $null
$deploymentInputVerification = $null
$inputTerminal = $null
$script:deploymentInputEntries = @{}
$publicationPlan = $null
$deploymentLease = $null
$deploymentLeaseCleanup = $null
$script:deploymentLeaseId = $null
$script:deploymentLeaseReleasable = $false
$script:artifactPublicationAdmitted = $false
$remoteMutationAttempted = $false
$script:publicArtifactMutationAttempted = $false
$transportCapabilityEvidence = Get-DeploymentTransportCapability
$releaseCommitMarkerPublished = $false
$script:releaseMarkerFinalPathReadbackObserved = $false
$postCommitMaintenanceFailures = @()
$sourceCustodyEvidence = $null
$terminalSourceCustodyEvidence = $null
$publicPredecessorOracle = $null
$publicPredecessorExpected = $null
$publicPredecessorEvidence = $null
$publicPredecessorCleanup = $null
$credentialProfile = $null
$script:httpClient = $null
$script:httpHandler = $null
$script:credential = $null
$script:activeArtifactLocal = $null
$script:activeArtifactRemote = $null
$script:artifactOperationStep = $null
$script:artifactOperationAttempt = $null
$script:artifactPrimaryFailureStep = $null
$script:artifactRollbackStatus = $null
$script:artifactPredecessorIdentity = $null
$script:artifactPromotedReadbackVerified = $false
$script:predeploymentTemporaryRouteEvidence = $null
$script:publicHostPolicyEvidence = $null
$legacyModelDirectoryPreflight = $null
$retiredModelDirectory = $null
$reportReceipt = $null
$reportWriteFailureIdentity = $null
$terminalDecisionReceipt = $null
try {
    $sourceCustodyEvidence = Assert-DeploymentSourceCustody `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody
    $sourceTreeClean = $sourceCustodyEvidence.source_tree_clean -eq $true
    $currentSourceCommit = [string]$sourceCustodyEvidence.source_commit
    $trackedPaths = @(
        "tinyrustlm/deploy/web-deployment-manifest.v2.json"
        "tinyrustlm/release/site-release-ledger.v1.json"
        @($deploymentManifest.publish |
            Where-Object { [string]$_.source -eq "source" } |
            ForEach-Object { "tinyrustlm/{0}" -f [string]$_.local })
    ) | Sort-Object -Unique
    foreach ($trackedPath in $trackedPaths) {
        $trackedResult = Invoke-PinnedDeploymentProcess `
            -Executable $script:gitExecutable `
            -Arguments @(
                "-C",
                $RepositoryRoot,
                "ls-files",
                "--error-unmatch",
                "--",
                $trackedPath
            ) `
            -WorkingDirectory $RepositoryRoot
        if ($trackedResult.exit_code -ne 0) {
            throw "Deployment artifact is not tracked by Git: $trackedPath"
        }
    }

    $operationPhase = "release-metadata-materialization"
    $releasePublishedAt = $startedUtc.ToString(
        "yyyy-MM-ddTHH:mm:ss.fffZ",
        [Globalization.CultureInfo]::InvariantCulture
    )
    $materializationOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $releaseMaterializerPath `
        -Arguments @(
            "materialize",
            $releaseLedgerPath,
            $script:generatedReleaseRoot,
            $currentSourceCommit,
            $releasePublishedAt
        ))
    if ($materializationOutput.Count -ne 1) {
        throw "TinyRustLM release metadata materialization failed."
    }
    $materialization = $materializationOutput[0] | ConvertFrom-Json
    if ([string]$materialization.status -ne "pass") {
        throw "TinyRustLM release metadata materialization did not pass."
    }

    $operationPhase = "deployment-closure-validation"
    $validationOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $validatorPath `
        -Arguments @(
            $siteRoot,
            $ManifestPath,
            $script:generatedReleaseRoot,
            "--json"
        ))
    if ($validationOutput.Count -ne 1) {
        throw "TinyRustLM web deployment closure validation failed."
    }
    $validation = $validationOutput[0] | ConvertFrom-Json
    if ([string]$validation.status -ne "pass") {
        throw "TinyRustLM web deployment closure did not pass."
    }
    $currentReleasePath = Join-Path `
        $script:generatedReleaseRoot `
        ".well-known\site-release.json"
    $currentRelease = Get-Content -Raw -LiteralPath $currentReleasePath | ConvertFrom-Json
    $releaseId = [string]$currentRelease.releaseId
    $releaseVersion = [string]$currentRelease.version
    $releaseDate = [string]$currentRelease.releaseDate
    $releasePublicationId = [string]$currentRelease.publicationId
    $releaseLedgerSha256 = [string]$currentRelease.sourceLedgerSha256
    if ($releaseId -ne [string]$validation.releaseId -or
        $releasePublicationId -ne [string]$validation.publicationId -or
        $releaseId -ne [string]$materialization.releaseId -or
        $releasePublicationId -ne [string]$materialization.publicationId -or
        $releaseLedgerSha256 -ne [string]$materialization.ledgerSha256) {
        throw "TinyRustLM release identities disagree after materialization."
    }

    $operationPhase = "preflight-secret-scan"
    $secretScanOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $secretScanTool `
        -Arguments @(
            $siteRoot,
            $ManifestPath,
            $secretScanReportPath,
            $secretScanEvidenceRoot,
            $currentSourceCommit,
            $script:generatedReleaseRoot
        ))
    if ($secretScanOutput.Count -ne 1) {
        throw "TinyRustLM web release secret scan failed."
    }
    $secretScan = $secretScanOutput[0] | ConvertFrom-Json
    if ([string]$secretScan.status -ne "pass" -or [int]$secretScan.secretFindingCount -ne 0) {
        throw "TinyRustLM web release secret scan did not pass."
    }
    $secretScanReportSha256 = [string]$secretScan.reportSha256
    $secretScanScopeManifestSha256 = [string]$secretScan.scopeManifestSha256
    $secretScanReceiptId = [string]$secretScan.receiptId
    $secretFindingCount = [int]$secretScan.secretFindingCount
    if ((Get-FileSha256 -Path $ManifestPath) -ne [string]$validation.manifestSha256) {
        throw "Deployment manifest changed after release validation."
    }

    $operationPhase = "deployment-input"
    $inputOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $validatorPath `
        -Arguments @(
            "bind-input",
            $siteRoot,
            $ManifestPath,
            $script:generatedReleaseRoot,
            "--json"
        ))
    if ($inputOutput.Count -ne 1) {
        throw "Canonical deployment input binding failed."
    }
    $deploymentInput = $inputOutput[0] | ConvertFrom-Json
    if ([string]$deploymentInput.status -ne "pass" -or
        [string]$deploymentInput.schema -ne "tinyrustlm.web_deployment_input.v1" -or
        [string]$deploymentInput.manifestSha256 -ne [string]$validation.manifestSha256 -or
        [string]$deploymentInput.releaseId -ne $releaseId -or
        [string]$deploymentInput.publicationId -ne $releasePublicationId -or
        [string]$deploymentInput.inputId -notmatch "^[0-9a-f]{64}$" -or
        [int]$deploymentInput.fileCount -ne @($deploymentManifest.publish).Count -or
        @($deploymentInput.files).Count -ne [int]$deploymentInput.fileCount) {
        throw "Canonical deployment input identity is invalid."
    }
    foreach ($inputFile in @($deploymentInput.files)) {
        $remote = [string]$inputFile.remote
        if ($script:deploymentInputEntries.ContainsKey($remote)) {
            throw "Canonical deployment input contains a duplicate publication path."
        }
        $script:deploymentInputEntries[$remote] = $inputFile
    }
    $publicationPlan = Get-DeploymentPublicationPlan `
        -Entries @($deploymentInput.files)
    $operationPhase = "deployment-input-verification"
    $inputVerificationOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $validatorPath `
        -Arguments @(
            "verify-input",
            $siteRoot,
            $ManifestPath,
            $script:generatedReleaseRoot,
            [string]$deploymentInput.inputId,
            "--json"
        ))
    if ($inputVerificationOutput.Count -ne 1) {
        throw "Canonical deployment input verification failed."
    }
    $deploymentInputVerification = $inputVerificationOutput[0] | ConvertFrom-Json
    if ([string]$deploymentInputVerification.status -ne "pass" -or
        [string]$deploymentInputVerification.inputId -ne
            [string]$deploymentInput.inputId -or
        [int]$deploymentInputVerification.fileCount -ne
            [int]$deploymentInput.fileCount -or
        [int64]$deploymentInputVerification.totalByteCount -ne
            [int64]$deploymentInput.totalByteCount) {
        throw "Canonical deployment input verification identity disagrees."
    }

    $operationPhase = "public-predecessor-oracle"
    $predecessorOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $validatorPath `
        -Arguments @(
            "predecessor",
            $RepositoryRoot,
            $releaseLedgerPath,
            $publicPredecessorRoot,
            "--json"
        ))
    if ($predecessorOutput.Count -ne 1) {
        throw "Public predecessor oracle materialization failed."
    }
    $publicPredecessorOracle = $predecessorOutput[0] | ConvertFrom-Json
    $publicPredecessorExpected = Get-PublicPredecessorExpectation `
        -Oracle $publicPredecessorOracle `
        -OracleRoot $publicPredecessorRoot
    $operationPhase = "deployment-input-terminal-verification"
    $inputTerminalOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $validatorPath `
        -Arguments @(
            "verify-input",
            $siteRoot,
            $ManifestPath,
            $script:generatedReleaseRoot,
            [string]$deploymentInput.inputId,
            "--json"
        ))
    if ($inputTerminalOutput.Count -ne 1) {
        throw "Canonical deployment input terminal verification failed."
    }
    $inputTerminal = $inputTerminalOutput[0] | ConvertFrom-Json
    if ([string]$inputTerminal.status -ne "pass" -or
        [string]$inputTerminal.inputId -ne [string]$deploymentInput.inputId -or
        [int]$inputTerminal.fileCount -ne [int]$deploymentInput.fileCount -or
        [int64]$inputTerminal.totalByteCount -ne
            [int64]$deploymentInput.totalByteCount) {
        throw "Canonical deployment input changed before transport admission."
    }
    $operationPhase = "release-ledger-candidate-validation"
    $boundReleaseRoot = $script:generatedReleaseRoot
    $finalizationOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $releaseMaterializerPath `
        -Arguments @(
            "finalize",
            $releaseLedgerPath,
            $boundReleaseRoot,
            $finalizedLedgerCandidatePath
        ))
    if ($finalizationOutput.Count -ne 1) {
        throw "TinyRustLM release ledger candidate creation failed."
    }
    $finalization = $finalizationOutput[0] | ConvertFrom-Json
    if ([string]$finalization.status -ne "pass" -or
        [string]$finalization.publicationId -ne $releasePublicationId -or
        [string]$finalization.sha256 -notmatch "^[0-9a-f]{64}$" -or
        [int64]$finalization.byteCount -le 0 -or
        [int64]$finalization.byteCount -gt (1024 * 1024) -or
        -not (Test-Path -LiteralPath $finalizedLedgerCandidatePath -PathType Leaf)) {
        throw "TinyRustLM release ledger candidate identity is invalid."
    }
    Assert-NoReparsePointAncestry `
        -Path $finalizedLedgerCandidatePath `
        -FailureMessage "TinyRustLM release ledger candidate is unsafe."
    $candidateItem = Get-Item -LiteralPath $finalizedLedgerCandidatePath -Force
    if (($candidateItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        [int64]$candidateItem.Length -ne [int64]$finalization.byteCount -or
        (Get-FileSha256 -Path $finalizedLedgerCandidatePath) -ne
            [string]$finalization.sha256) {
        throw "TinyRustLM release ledger candidate failed byte verification."
    }
    $candidateValidationOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody `
        -ToolPath $releaseMaterializerPath `
        -Arguments @("validate", $finalizedLedgerCandidatePath))
    if ($candidateValidationOutput.Count -ne 1) {
        throw "TinyRustLM finalized release ledger candidate validation failed."
    }
    $candidateValidation = $candidateValidationOutput[0] | ConvertFrom-Json
    if ([string]$candidateValidation.status -ne "pass" -or
        $null -ne $candidateValidation.pendingReleaseId -or
        [string]$candidateValidation.ledgerSha256 -ne
            [string]$finalization.sha256) {
        throw "TinyRustLM finalized release ledger candidate did not close pending 0.5.0."
    }
    $finalizedLedgerCandidateSha256 = [string]$finalization.sha256
    $finalizedLedgerCandidateByteCount = [int64]$finalization.byteCount
    $operationPhase = "terminal-source-custody"
    $terminalSourceCustodyEvidence = Assert-DeploymentSourceCustody `
        -RepositoryRoot $RepositoryRoot `
        -Custody $script:deploymentSourceCustody
    $operationPhase = "transport-contract-admission"
    Assert-SafeDeploymentTransportCapability `
        -Capability $transportCapabilityEvidence

    $script:httpHandler = [Net.Http.HttpClientHandler]::new()
    $script:httpHandler.AllowAutoRedirect = $false
    $script:httpHandler.UseCookies = $false
    $script:httpHandler.UseDefaultCredentials = $false
    $script:httpHandler.MaxResponseHeadersLength = 32
    $script:httpClient = [Net.Http.HttpClient]::new($script:httpHandler, $true)
    $script:httpClient.Timeout = [TimeSpan]::FromMinutes(5)
    $operationPhase = "public-predecessor-gate"
    $publicPredecessorEvidence = Assert-PublicReleasePredecessor `
        -Expected $publicPredecessorExpected `
        -PublicOrigin $script:publicOrigin
    if ([string]$publicPredecessorEvidence.status -ne "pass" -or
        $publicPredecessorEvidence.read_only -ne $true -or
        $publicPredecessorEvidence.cache_bypassed -ne $true) {
        throw "Public predecessor gate did not pass."
    }
    $publicPredecessorCleanup = Remove-PublicPredecessorOracle `
        -Expected $publicPredecessorExpected `
        -OracleRoot $publicPredecessorRoot `
        -RepositoryRoot $RepositoryRoot `
        -ToolPath $validatorPath `
        -SourceCustody $script:deploymentSourceCustody
    $publicPredecessorExpected = $null
    if ($publicPredecessorCleanup.cleanup_verified -ne $true) {
        throw "Public predecessor oracle cleanup did not pass."
    }

    $operationPhase = "deployment-target-configuration"
    $deploymentTarget = Get-WorkspaceDeploymentTargetBinding `
        -MemoryPath $WorkspaceMemory `
        -SourceRoot $RepositoryRoot
    $operationPhase = "credential-profile"
    $credentialProfile = Get-WorkspaceDeploymentCredentialProfile `
        -MemoryPath $WorkspaceMemory `
        -SourceRoot $RepositoryRoot `
        -TargetBinding $deploymentTarget
    Assert-DeploymentCredentialTarget `
        -CredentialProfile $credentialProfile `
        -TargetBinding $deploymentTarget
    $script:ftpHost = [string]$credentialProfile.host
    $script:ftpPort = [int]$credentialProfile.port
    $script:credential = [Net.NetworkCredential]::new(
        [string]$credentialProfile.user,
        [string]$credentialProfile.password
    )
    $credentialProfile.password = $null
    $operationPhase = "deployment-target-readonly-identity"
    $deploymentTargetEvidence = Assert-DeploymentTargetIdentity `
        -TargetBinding $deploymentTarget `
        -PublicOrigin $script:publicOrigin
    if ([string]$deploymentTargetEvidence.status -ne "pass" -or
        $deploymentTargetEvidence.read_only -ne $true) {
        throw "The deployment root sentinel identity did not pass."
    }
    $script:httpClient.Timeout = [TimeSpan]::FromMinutes(60)
    $operationPhase = "legacy-model-directory-preflight"
    $legacyModelRetireEntries = @($deploymentManifest.retire | Where-Object {
        ([string]$_.remote).StartsWith(
            "app/models/",
            [StringComparison]::Ordinal
        )
    })
    $legacyModelDirectoryPreflight = Test-RetiredModelDirectoryClosure `
        -RetireEntries $legacyModelRetireEntries
    $operationPhase = "host-policy-predeployment"
    # These bounded probes write temporary objects after exact target admission.
    # Regular artifact publication is still disabled until their cleanup passes.
    $remoteMutationAttempted = $true
    $script:predeploymentTemporaryRouteEvidence = Test-PredeploymentTemporaryRoutePolicy
    if ([string]$script:predeploymentTemporaryRouteEvidence.status -ne "pass" -or
        $script:predeploymentTemporaryRouteEvidence.authenticated_cleanup_verified -ne $true -or
        $script:predeploymentTemporaryRouteEvidence.owned_directory_cleanup_verified -ne $true) {
        throw "Predeployment host policy admission did not pass."
    }
    if (-not $deploymentLease -or -not $deploymentLease.handle.CanRead -or
        -not $deploymentLease.handle.CanWrite -or
        [string]$deploymentLease.lease_id -cne $script:deploymentLeaseId) {
        throw "The same-host deployment lease is not held."
    }
    $script:artifactPublicationAdmitted = $true

    $operationPhase = "remote-directory-preparation"
    $remoteDirectories = @($deploymentInput.files |
        ForEach-Object {
            (Get-RemoteFilePathParts -RemotePath ([string]$_.remote)).parent
        } |
        Where-Object { $_ } |
        Sort-Object -Unique)
    foreach ($remoteDirectory in $remoteDirectories) {
        Ensure-RemoteDirectory -RemotePath $remoteDirectory
    }
    $operationPhase = "artifact-publication"
    foreach ($inputEntry in @($publicationPlan.regular)) {
        $rows += Publish-Artifact `
            -DeploymentInputEntry $inputEntry
        $script:activeArtifactLocal = $null
        $script:activeArtifactRemote = $null
        $script:artifactOperationStep = $null
        $script:artifactOperationAttempt = $null
        $script:artifactPrimaryFailureStep = $null
        $script:artifactRollbackStatus = $null
        $script:artifactPredecessorIdentity = $null
        $script:artifactPromotedReadbackVerified = $false
    }
    $operationPhase = "retirement"
    foreach ($entry in @($deploymentManifest.retire)) {
        $script:publicArtifactMutationAttempted = $true
        $removedPublicArtifacts += Remove-PublicArtifact -RemotePath ([string]$entry.remote)
    }
    $script:publicArtifactMutationAttempted = $true
    $retiredModelDirectory = Remove-RetiredModelDirectory
    $operationPhase = "final-precommit-verification"
    if ($rows.Count -ne @($publicationPlan.regular).Count -or
        @($rows | Where-Object {
            $_.readback_verified -ne $true -or
            $_.temporary_cleanup_verified -ne $true
        }).Count -ne 0) {
        throw "Deployment did not retain complete artifact readback evidence."
    }
    if ($removedPublicArtifacts.Count -ne @($deploymentManifest.retire).Count -or
        @($removedPublicArtifacts | Where-Object {
            $_.ftps_absent -ne $true -or [int]$_.https_status -ne 404
        }).Count -ne 0) {
        throw "Deployment did not retain complete retirement evidence."
    }
    if (-not $legacyModelDirectoryPreflight -or
        [string]$legacyModelDirectoryPreflight.status -ne "pass" -or
        [int]$legacyModelDirectoryPreflight.undeclared_entry_count -ne 0 -or
        -not $retiredModelDirectory -or
        $retiredModelDirectory.ftps_absent -ne $true) {
        throw "Deployment did not prove the legacy model directory closure."
    }
    if (-not $script:predeploymentTemporaryRouteEvidence -or
        [string]$script:predeploymentTemporaryRouteEvidence.status -ne "pass" -or
        -not $script:publicHostPolicyEvidence -or
        [string]$script:publicHostPolicyEvidence.status -ne "pass") {
        throw "Deployment did not retain complete public host-policy evidence."
    }
    foreach ($publishedRow in @($rows)) {
        $inputEntry = $script:deploymentInputEntries[
            [string]$publishedRow.relative_path
        ]
        $authenticatedOnly = [string]$publishedRow.readback -eq "authenticated-ftps"
        if (-not (Test-RemoteArtifact `
            -RemotePath ([string]$publishedRow.relative_path) `
            -ExpectedBytes ([int64]$inputEntry.byteCount) `
            -ExpectedSha256 ([string]$inputEntry.sha256) `
            -AuthenticatedOnly:$authenticatedOnly)) {
            throw "A regular deployment artifact changed before the release commit marker."
        }
    }
    $operationPhase = "canonical-input-before-release-marker"
    $beforeMarkerOutput = @(Invoke-CustodiedNodeTool `
        -RepositoryRoot $RepositoryRoot -Custody $script:deploymentSourceCustody -ToolPath $validatorPath `
        -Arguments @("verify-input", $siteRoot, $ManifestPath, $script:generatedReleaseRoot,
            [string]$deploymentInput.inputId, "--json"))
    if ($beforeMarkerOutput.Count -ne 1) { throw "Canonical input verification before commit failed." }
    $beforeMarkerInput = $beforeMarkerOutput[0] | ConvertFrom-Json
    if ([string]$beforeMarkerInput.status -ne "pass" -or
        [string]$beforeMarkerInput.inputId -ne [string]$deploymentInput.inputId) {
        throw "Canonical inputs changed before the release commit marker."
    }
    $operationPhase = "release-commit-marker"
    $script:regularArtifactsVerifiedForCommit = $true
    try {
        $markerRow = Publish-Artifact -DeploymentInputEntry $publicationPlan.commit_marker -CommitMarker
    }
    finally { $script:regularArtifactsVerifiedForCommit = $false }
    # Publish-Artifact returns only after marker readback and temporary cleanup pass.
    # Latch the public terminal state before any later local accounting can fail.
    $releaseCommitMarkerPublished = $true
    $status = "pass"
    $operationPhase = "post-commit-local-accounting"
    $rows += $markerRow
    $script:activeArtifactLocal = $null
    $script:activeArtifactRemote = $null
    $script:artifactOperationStep = $null
    $script:artifactOperationAttempt = $null
    $script:artifactPrimaryFailureStep = $null
    $script:artifactRollbackStatus = $null
    if ([string]$markerRow.relative_path -ne ".well-known/site-release.json" -or
        $markerRow.readback_verified -ne $true -or
        $markerRow.temporary_cleanup_verified -ne $true -or
        $rows.Count -ne [int]$deploymentInput.fileCount) {
        throw "The final release commit marker did not pass publication verification."
    }
    $operationPhase = "complete"
}
catch {
    if (-not $releaseCommitMarkerPublished) {
        $status = "fail"
        $failureIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
        $failureStep = if ($operationPhase -in @(
                "artifact-publication",
                "release-commit-marker"
            ) -and $script:artifactPrimaryFailureStep) {
            $script:artifactPrimaryFailureStep
        }
        elseif ($operationPhase -in @(
                "artifact-publication",
                "release-commit-marker"
            ) -and $script:artifactOperationStep) {
            $script:artifactOperationStep
        }
        else {
            $operationPhase
        }
    }
    else {
        $postCommitMaintenanceFailures += [pscustomobject]@{
            step = "post-commit-control-flow"
            failure_identity = Get-SafeExceptionIdentity -Exception $_.Exception
        }
    }
}
finally {
    try {
    if ($script:httpClient) {
        $script:httpClient.Dispose()
    }
    $script:httpHandler = $null
    $script:credential = $null
    $credentialProfile = $null

    if (Test-Path -LiteralPath $publicPredecessorRoot) {
        try {
            if (-not $publicPredecessorExpected -and $publicPredecessorOracle) {
                $publicPredecessorExpected = Get-PublicPredecessorExpectation `
                    -Oracle $publicPredecessorOracle `
                    -OracleRoot $publicPredecessorRoot
            }
            $publicPredecessorCleanup = Remove-PublicPredecessorOracle `
                -Expected $publicPredecessorExpected `
                -OracleRoot $publicPredecessorRoot `
                -RepositoryRoot $RepositoryRoot `
                -ToolPath $validatorPath `
                -SourceCustody $script:deploymentSourceCustody
            $publicPredecessorExpected = $null
        }
        catch {
            $cleanupIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
            if ($releaseCommitMarkerPublished) {
                $postCommitMaintenanceFailures += [pscustomobject]@{
                    step = "public-predecessor-oracle-cleanup"
                    failure_identity = $cleanupIdentity
                }
            }
            elseif (-not $failureIdentity) {
                $status = "fail"
                $operationPhase = "public-predecessor-oracle-cleanup"
                $failureStep = $operationPhase
                $failureIdentity = $cleanupIdentity
            }
        }
    }

    # Persist the immutable deployment decision while all local coordination
    # guards are still held. Cleanup gets a separate closure record below.
    $terminalDecision = [pscustomobject]@{
        schema = "tinyrustlm.deployment_terminal_decision.v1"
        attempt_id = $attemptId
        terminal_scope = "deployment-attempt-before-local-cleanup"
        deployment_attempt_terminal = $true
        deployment_status = $status
        local_cleanup_pending = $true
        release_commit_marker_published = $script:releaseMarkerFinalPathReadbackObserved
        release_commit_marker_readback_observed = $script:releaseMarkerFinalPathReadbackObserved
        release_commit_marker_publication_completed = $releaseCommitMarkerPublished
        failure_identity = $failureIdentity
        failure_step = $failureStep
        source_commit = $currentSourceCommit
        release_id = $releaseId
        release_publication_id = $releasePublicationId
        deployment_manifest_sha256 = if ($validation) {
            [string]$validation.manifestSha256
        }
        else {
            $null
        }
        deployment_input = if ($deploymentInput) {
            [pscustomobject]@{
                schema = [string]$deploymentInput.schema
                input_id = [string]$deploymentInput.inputId
                file_count = [int]$deploymentInput.fileCount
                total_byte_count = [int64]$deploymentInput.totalByteCount
                files = @($deploymentInput.files | ForEach-Object {
                    [pscustomobject]@{
                        source = [string]$_.source
                        remote_relative_path = [string]$_.remote
                        byte_count = [int64]$_.byteCount
                        sha256 = [string]$_.sha256
                    }
                })
                verified_before_credentials = (
                    $deploymentInputVerification -and
                    [string]$deploymentInputVerification.status -eq "pass"
                )
                verified_before_transport_admission = (
                    $inputTerminal -and
                    [string]$inputTerminal.status -eq "pass"
                )
                source_copy_created = $false
                local_input_cleanup_required = $false
            }
        }
        else {
            $null
        }
        public_predecessor_gate = $publicPredecessorEvidence
        publication_summary = [pscustomobject]@{
            transaction_scope = "bounded-sequential-per-artifact"
            public_artifact_mutation_attempted = $script:publicArtifactMutationAttempted
            partial_publication_possible = ($script:publicArtifactMutationAttempted -and -not $releaseCommitMarkerPublished)
            active_artifact = if ($script:activeArtifactRemote) {
                [pscustomobject]@{
                    remote_relative_path = $script:activeArtifactRemote
                    operation_step = $script:artifactOperationStep
                    rollback_status = $script:artifactRollbackStatus
                    predecessor_identity = $script:artifactPredecessorIdentity
                    promoted_readback_verified = $script:artifactPromotedReadbackVerified
                }
            } else { $null }
            completed_file_count = $rows.Count
            readback_verified_file_count = @($rows | Where-Object {
                $_.readback_verified -eq $true
            }).Count
            temporary_cleanup_verified_file_count = @($rows | Where-Object {
                $_.temporary_cleanup_verified -eq $true
            }).Count
        }
        retirement_summary = [pscustomobject]@{
            completed_artifact_count = $removedPublicArtifacts.Count
            verified_absent_artifact_count = @($removedPublicArtifacts | Where-Object {
                $_.ftps_absent -eq $true -and [int]$_.https_status -eq 404
            }).Count
        }
        finalized_release_ledger_candidate_sha256 = $finalizedLedgerCandidateSha256
        finalized_release_ledger_candidate_byte_count = $finalizedLedgerCandidateByteCount
        raw_source_bytes_included = $false
        local_paths_included = $false
        credentials_included = $false
    }
    try {
        Assert-PinnedDeploymentHost -HostIdentity $script:powershellHost | Out-Null
        Assert-PinnedDeploymentExecutable -Executable $script:nodeExecutable | Out-Null
        Assert-PinnedDeploymentExecutable -Executable $script:curlExecutable | Out-Null
        Assert-PinnedDeploymentExecutable -Executable $script:gitExecutable | Out-Null
        $terminalDecisionReceipt = Write-AtomicJson `
            -Path $terminalDecisionPath `
            -Value $terminalDecision
    }
    catch {
        $cleanupIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
        if ($releaseCommitMarkerPublished) {
            $postCommitMaintenanceFailures += [pscustomobject]@{
                step = "terminal-decision-receipt"
                failure_identity = $cleanupIdentity
            }
        }
        elseif (-not $failureIdentity) {
            $status = "fail"
            $operationPhase = "terminal-decision-receipt"
            $failureStep = $operationPhase
            $failureIdentity = $cleanupIdentity
        }
    }

    if ($deploymentLease) {
        try {
            if ($script:deploymentLeaseReleasable -and $terminalDecisionReceipt) {
                $deploymentLeaseCleanup = Remove-ExclusiveDeploymentLease `
                    -Lease $deploymentLease
                if ($deploymentLeaseCleanup.cleanup_verified -ne $true -or
                    [string]$deploymentLeaseCleanup.lease_id -ne
                        [string]$deploymentLease.lease_id) {
                    throw "Exclusive deployment lease cleanup did not pass."
                }
            }
            else {
                $deploymentLease.handle.Flush($true)
                $deploymentLease.handle.Dispose()
                $deploymentLeaseCleanup = [pscustomobject]@{
                    lease_id = [string]$deploymentLease.lease_id
                    cleanup_verified = $false
                    blocking_residue_preserved = $true
                }
            }
        }
        catch {
            $cleanupIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
            if ($releaseCommitMarkerPublished) {
                $postCommitMaintenanceFailures += [pscustomobject]@{
                    step = "deployment-lease-cleanup"
                    failure_identity = $cleanupIdentity
                }
            }
            elseif (-not $failureIdentity) {
                $status = "fail"
                $operationPhase = "deployment-lease-cleanup"
                $failureStep = $operationPhase
                $failureIdentity = $cleanupIdentity
            }
        }
    }

    $expectedFileCount = if ($deploymentInput) {
        [int]$deploymentInput.fileCount
    }
    else {
        0
    }
    $expectedRetirementCount = @($deploymentManifest.retire).Count
    $publishedReadbackVerified = (
        $status -eq "pass" -and
        $rows.Count -eq $expectedFileCount -and
        @($rows | Where-Object { $_.readback_verified -ne $true }).Count -eq 0
    )
    $temporaryCleanupVerified = (
        $status -eq "pass" -and
        $rows.Count -eq $expectedFileCount -and
        @($rows | Where-Object { $_.temporary_cleanup_verified -ne $true }).Count -eq 0
    )
    $retirementVerified = (
        $status -eq "pass" -and
        $removedPublicArtifacts.Count -eq $expectedRetirementCount -and
        @($removedPublicArtifacts | Where-Object {
            $_.ftps_absent -ne $true -or [int]$_.https_status -ne 404
        }).Count -eq 0
    )
    $report = [pscustomobject]@{
        schema = "tinyrustlm.ftps_deployment.v11"
        attempt_id = $attemptId
        terminal = $true
        deployment_scope = [string]$deploymentManifest.deploymentScope
        public_origin = $script:publicOrigin
        started_utc = $startedUtc.ToString("o")
        completed_utc = [DateTime]::UtcNow.ToString("o")
        status = $status
        release_commit_marker_published = $script:releaseMarkerFinalPathReadbackObserved
        release_commit_marker_readback_observed = $script:releaseMarkerFinalPathReadbackObserved
        release_commit_marker_publication_completed = $releaseCommitMarkerPublished
        failure_identity = $failureIdentity
        failure_step = $failureStep
        failure_code = if ($status -eq "fail") {
            "deployment_{0}_failed" -f $operationPhase.Replace("-", "_")
        } else {
            $null
        }
        last_operation = $operationPhase
        active_artifact = if ($script:activeArtifactRemote) {
            [pscustomobject]@{
                local_relative_path = $script:activeArtifactLocal
                remote_relative_path = $script:activeArtifactRemote
                operation_step = $script:artifactOperationStep
                operation_attempt = $script:artifactOperationAttempt
                primary_failure_step = $script:artifactPrimaryFailureStep
                rollback_status = $script:artifactRollbackStatus
                predecessor_identity = $script:artifactPredecessorIdentity
                promoted_readback_verified = $script:artifactPromotedReadbackVerified
            }
        }
        else {
            $null
        }
        source_commit = $currentSourceCommit
        source_tree_clean = $sourceTreeClean
        deployment_tool_custody = [pscustomobject]@{
            powershell = [pscustomobject]@{
                version = [string]$deploymentToolVersions.powershell_version
                edition = [string]$deploymentToolVersions.powershell_edition
                language_mode = [string]$deploymentToolVersions.powershell_language_mode
                byte_count = [int64]$script:powershellHost.byte_count
                sha256 = [string]$script:powershellHost.sha256
            }
            node = [pscustomobject]@{
                version = [string]$deploymentToolVersions.node_version
                byte_count = [int64]$script:nodeExecutable.byte_count
                sha256 = [string]$script:nodeExecutable.sha256
            }
            curl = [pscustomobject]@{
                version = [string]$deploymentToolVersions.curl_version
                byte_count = [int64]$script:curlExecutable.byte_count
                sha256 = [string]$script:curlExecutable.sha256
            }
            git = [pscustomobject]@{
                version = [string]$deploymentToolVersions.git_version
                byte_count = [int64]$script:gitExecutable.byte_count
                sha256 = [string]$script:gitExecutable.sha256
            }
            child_environment_allowlisted =
                $deploymentToolVersions.environment_allowlisted
            inherited_environment_names =
                @($deploymentToolVersions.inherited_environment_names)
            local_paths_included = $false
        }
        source_custody = if ($script:deploymentSourceCustody) {
            [pscustomobject]@{
                schema = [string]$script:deploymentSourceCustody.schema
                source_commit = [string]$script:deploymentSourceCustody.source_commit
                source_tree_clean = $script:deploymentSourceCustody.source_tree_clean
                tool_file_count = [int]$script:deploymentSourceCustody.tool_file_count
                tool_closure_sha256 = [string]$script:deploymentSourceCustody.tool_closure_sha256
                initial_recheck_passed = (
                    $sourceCustodyEvidence -and
                    [string]$sourceCustodyEvidence.status -eq "pass"
                )
                terminal_recheck_passed = (
                    $terminalSourceCustodyEvidence -and
                    [string]$terminalSourceCustodyEvidence.status -eq "pass"
                )
            }
        }
        else {
            $null
        }
        deployment_lease = if ($deploymentLease) {
            [pscustomobject]@{
                schema = [string]$deploymentLease.schema
                lease_id = [string]$deploymentLease.lease_id
                sha256 = [string]$deploymentLease.sha256
                source_commit = [string]$deploymentLease.source_commit
                tool_closure_sha256 = [string]$deploymentLease.tool_closure_sha256
                coordination_scope = [string]$deploymentLease.coordination_scope
                remote_global_exclusion_proven =
                    $deploymentLease.remote_global_exclusion_proven
                cleanup_verified = (
                    $deploymentLeaseCleanup -and
                    $deploymentLeaseCleanup.cleanup_verified -eq $true
                )
                blocking_residue_preserved = (
                    $deploymentLeaseCleanup -and
                    $deploymentLeaseCleanup.blocking_residue_preserved -eq $true
                )
            }
        }
        else {
            $null
        }
        release_id = $releaseId
        release_version = $releaseVersion
        release_date = $releaseDate
        release_published_at = $releasePublishedAt
        release_publication_id = $releasePublicationId
        release_ledger_sha256 = $releaseLedgerSha256
        finalized_release_ledger_candidate_file = if ($finalizedLedgerCandidateSha256) {
            [IO.Path]::GetFileName($finalizedLedgerCandidatePath)
        } else {
            $null
        }
        finalized_release_ledger_candidate_sha256 = $finalizedLedgerCandidateSha256
        finalized_release_ledger_candidate_byte_count = $finalizedLedgerCandidateByteCount
        finalized_release_ledger_candidate_requires_source_review_and_commit = (
            $status -eq "pass"
        )
        release_metadata_confined_to_canonical_artifacts = $true
        release_metadata_https_readback_verified = (
            $status -eq "pass" -and
            @($rows | Where-Object {
                $_.source -eq "generated-release" -and $_.readback_verified -eq $true
            }).Count -eq 2
        )
        deployment_manifest_sha256 = [string]$validation.manifestSha256
        terminal_decision_receipt = if ($terminalDecisionReceipt) {
            [pscustomobject]@{
                schema = "tinyrustlm.deployment_terminal_decision.v1"
                file = [IO.Path]::GetFileName($terminalDecisionPath)
                sha256 = [string]$terminalDecisionReceipt.sha256
                byte_count = [int64]$terminalDecisionReceipt.bytes
                deployment_attempt_terminal = $true
                recorded_before_local_cleanup = $true
            }
        }
        else {
            $null
        }
        deployment_input = if ($deploymentInput) {
            [pscustomobject]@{
                schema = [string]$deploymentInput.schema
                input_id = [string]$deploymentInput.inputId
                file_count = [int]$deploymentInput.fileCount
                total_byte_count = [int64]$deploymentInput.totalByteCount
                fully_verified_before_credentials = (
                    $deploymentInputVerification -and
                    [string]$deploymentInputVerification.status -eq "pass"
                )
                source_paths_included = $false
                git_metadata_included = $false
                authority_markers_included = $false
                source_copy_created = $false
                local_input_cleanup_required = $false
            }
        }
        else {
            $null
        }
        public_predecessor_gate = $publicPredecessorEvidence
        secret_scan_report_sha256 = $secretScanReportSha256
        secret_scan_scope_manifest_sha256 = $secretScanScopeManifestSha256
        secret_scan_receipt_id = $secretScanReceiptId
        secret_finding_count = $secretFindingCount
        secret_material_included = $false
        published_release_model_bytes_present = $false
        transport_capability = $transportCapabilityEvidence
        publication_transaction_scope = if (
            $script:artifactPublicationAdmitted -eq $true
        ) { "bounded-sequential-per-artifact" } else { "no-publication-admission" }
        per_artifact_atomic_promotion = $false
        whole_site_atomic_promotion = $false
        release_wide_rollback_available =
            $transportCapabilityEvidence.release_wide_atomic_rollback
        remote_global_lease_available =
            $transportCapabilityEvidence.remote_global_compare_and_swap_lease
        artifact_publication_admitted = $script:artifactPublicationAdmitted
        remote_mutation_attempted = $remoteMutationAttempted
        public_artifact_mutation_attempted = $script:publicArtifactMutationAttempted
        partial_publication_possible = ($script:publicArtifactMutationAttempted -and -not $releaseCommitMarkerPublished)
        earlier_artifacts_rolled_back = $false
        dependency_ordered_publication = $true
        final_remote_commit_marker = ".well-known/site-release.json"
        marker_final_path_verified_after_regular_readback = $script:releaseMarkerFinalPathReadbackObserved
        marker_was_last_remote_mutation = $false
        marker_cleanup_follows_promotion = $true
        post_commit_maintenance = [pscustomobject]@{
            status = if ($postCommitMaintenanceFailures.Count -eq 0) {
                "pass"
            }
            else {
                "attention-required"
            }
            affects_committed_public_release_status = $false
            failures = $postCommitMaintenanceFailures
        }
        immutable_attempt_report = $true
        fresh_artifact_readback_required = $true
        predeployment_temporary_route_policy = $script:predeploymentTemporaryRouteEvidence
        public_host_policy = $script:publicHostPolicyEvidence
        expected_file_count = $expectedFileCount
        published_artifact_readback_verified = $publishedReadbackVerified
        publication_temporary_cleanup_verified = $temporaryCleanupVerified
        file_count = $rows.Count
        files = $rows
        expected_retired_artifact_count = $expectedRetirementCount
        retired_artifact_absence_verified = $retirementVerified
        removed_public_artifacts = $removedPublicArtifacts
        legacy_model_directory_preflight = $legacyModelDirectoryPreflight
        retired_model_directory_absence_verified = (
            $status -eq "pass" -and
            $retiredModelDirectory -and
            $retiredModelDirectory.ftps_absent -eq $true
        )
        retired_model_directory = $retiredModelDirectory
    }
    try {
        $reportReceipt = Write-AtomicJson -Path $ReportPath -Value $report
    }
    catch {
        $reportWriteFailureIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
    }
    }
    catch {
        $maintenanceIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
        if ($releaseCommitMarkerPublished) {
            $status = "pass"
            $postCommitMaintenanceFailures += [pscustomobject]@{
                step = "post-commit-local-finalization"
                failure_identity = $maintenanceIdentity
            }
            if (-not $reportWriteFailureIdentity) {
                $reportWriteFailureIdentity = $maintenanceIdentity
            }
        }
        elseif (-not $failureIdentity) {
            $status = "fail"
            $operationPhase = "local-finalization"
            $failureStep = $operationPhase
            $failureIdentity = $maintenanceIdentity
        }
    }
}

if ($status -ne "pass") {
    if (-not $reportReceipt) {
        throw "TinyRustLM deployment failed before the public release commit marker, and its local receipt could not be persisted."
    }
    throw "TinyRustLM deployment attempt failed; inspect immutable receipt $([IO.Path]::GetFileName($ReportPath))."
}
Write-Host "TinyRustLM $($deploymentManifest.deploymentScope) deployment passed for $($rows.Count) files with $($removedPublicArtifacts.Count) retired model routes verified absent."
if ($reportReceipt) {
    Write-Host "Immutable deployment report: $([IO.Path]::GetFileName($ReportPath)) ($($reportReceipt.sha256))"
}
else {
    Write-Warning "The public release commit marker passed, but local deployment receipt persistence requires attention ($reportWriteFailureIdentity)."
}
