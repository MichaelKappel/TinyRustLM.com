param(
    [string]$RepositoryRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$ManifestPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "deploy\web-deployment-manifest.v2.json"),
    [string]$WorkspaceMemory = $env:TINYRUSTLM_WORKSPACE_MEMORY,
    [string]$ReportDirectory = (Join-Path ([IO.Path]::GetTempPath()) "tinyrustlm-web-deployments"),
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

# Loads one bounded FileZilla site without enabling DTDs or exposing credential fields.
function Get-DeploymentCredentialProfile {
    param([string]$ProfilePath, [string]$SourceRoot)

    if ([string]::IsNullOrWhiteSpace($ProfilePath) -or
        -not [IO.Path]::IsPathRooted($ProfilePath)) {
        throw "The FileZilla profile path must be absolute."
    }
    try {
        $fullPath = [IO.Path]::GetFullPath($ProfilePath)
        $sourcePrefix = [IO.Path]::GetFullPath($SourceRoot).TrimEnd("\", "/") +
            [IO.Path]::DirectorySeparatorChar
    }
    catch {
        throw "The FileZilla profile path cannot be resolved."
    }
    if ($fullPath.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "The FileZilla profile must remain outside the source worktree."
    }
    try {
        $profileAvailable = Test-Path -LiteralPath $fullPath -PathType Leaf
    }
    catch {
        throw "The FileZilla profile cannot be inspected."
    }
    if (-not $profileAvailable) {
        throw "The FileZilla profile is unavailable."
    }
    try {
        $item = Get-Item -LiteralPath $fullPath
    }
    catch {
        throw "The FileZilla profile cannot be inspected."
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $item.Length -le 0 -or
        $item.Length -gt (4 * 1024 * 1024) -or
        -not [string]::Equals($item.Extension, ".xml", [StringComparison]::OrdinalIgnoreCase)) {
        throw "The FileZilla profile is not a bounded regular XML file."
    }
    Assert-NoReparsePointAncestry `
        -Path $item.FullName `
        -FailureMessage "The FileZilla profile ancestry is unsafe."

    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $settings.MaxCharactersInDocument = 4 * 1024 * 1024
    $reader = $null
    $document = [Xml.XmlDocument]::new()
    $document.XmlResolver = $null
    try {
        $reader = [Xml.XmlReader]::Create($fullPath, $settings)
        $document.Load($reader)
    }
    catch {
        throw "The FileZilla profile XML failed security validation."
    }
    finally {
        if ($reader) {
            $reader.Dispose()
        }
    }

    $matchingSites = @($document.SelectNodes("/FileZilla3/Servers/Server") | Where-Object {
        $nameNode = $_.SelectSingleNode("Name")
        $nameNode -and ([string]$nameNode.InnerText) -match "(?i)^TinyRustLM(?:\.com)?$"
    })
    if ($matchingSites.Count -ne 1) {
        throw "The FileZilla profile must contain exactly one TinyRustLM deployment site."
    }
    $site = $matchingSites[0]
    $requiredNode = {
        param([string]$Name)
        $node = $site.SelectSingleNode($Name)
        if (-not $node -or [string]::IsNullOrWhiteSpace([string]$node.InnerText)) {
            throw "The FileZilla TinyRustLM site is missing a required field."
        }
        return [string]$node.InnerText
    }
    $hostName = (& $requiredNode "Host").Trim()
    $portText = (& $requiredNode "Port").Trim()
    $userName = (& $requiredNode "User").Trim()
    $passwordNode = $site.SelectSingleNode("Pass")
    if (-not $passwordNode) {
        throw "The FileZilla TinyRustLM site is missing a required field."
    }
    $encodingAttribute = $passwordNode.Attributes["encoding"]
    $passwordEncoding = if ($encodingAttribute) {
        ([string]$encodingAttribute.Value).Trim()
    }
    else {
        ""
    }
    if ($passwordEncoding -and
        -not [string]::Equals($passwordEncoding, "base64", [StringComparison]::OrdinalIgnoreCase)) {
        throw "The FileZilla password encoding is unsupported."
    }
    try {
        $password = if ($passwordEncoding) {
            [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$passwordNode.InnerText))
        }
        else {
            [string]$passwordNode.InnerText
        }
    }
    catch {
        throw "The FileZilla password encoding is invalid."
    }

    $port = 0
    $hostNameType = [Uri]::CheckHostName($hostName)
    if ($hostNameType -eq [UriHostNameType]::Unknown -or
        $hostNameType -eq [UriHostNameType]::IPv6 -or
        $hostName.Length -gt 253 -or
        -not [int]::TryParse($portText, [ref]$port) -or
        $port -lt 1 -or $port -gt 65535 -or
        $userName.Length -gt 256 -or
        $userName -match "[\x00-\x1f\x7f]" -or
        [string]::IsNullOrEmpty($password) -or
        $password.Length -gt 4096 -or
        $password.Contains([char]0)) {
        $password = $null
        throw "The FileZilla TinyRustLM site contains an invalid bounded field."
    }
    return [pscustomobject]@{
        host = $hostName
        port = $port
        user = $userName
        password = $password
    }
}

# Resolves the sole external deployment profile referenced by bounded workspace memory.
function Get-WorkspaceDeploymentCredentialProfile {
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
    $profilePath = Get-YamlScalar -Lines $lines -Key "filezilla_profile"
    return Get-DeploymentCredentialProfile `
        -ProfilePath $profilePath `
        -SourceRoot $SourceRoot
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

# Returns true only for an FTP response that explicitly reports an unavailable object.
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

# Records one bounded publication substep without retaining exception messages or credentials.
function Set-ArtifactOperationState {
    param(
        [ValidateSet(
            "local-validation",
            "current-artifact-readback",
            "current-temporary-cleanup",
            "stage-write",
            "stage-authenticated-readback",
            "stage-reset",
            "stage-verification-exhausted",
            "predecessor-state-read",
            "predecessor-backup-cleanup",
            "predecessor-backup",
            "stage-promotion",
            "promoted-readback",
            "public-host-policy",
            "temporary-cleanup",
            "rollback-target-removal",
            "rollback-restore",
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
            return $true
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
                if ($reportedSize -lt 0 -or
                    (Test-RemoteFileAbsent -RemotePath $RemotePath)) {
                    return [int64]-1
                }
                return $reportedSize
            }
            catch {
                if ((Test-FtpFileUnavailable -Exception $_.Exception) -and
                    (Test-RemoteFileAbsent -RemotePath $RemotePath)) {
                    return [int64]-1
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
            return $false
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
        if ((Test-FtpFileUnavailable -Exception $_.Exception) -and
            -not (Test-RemoteDirectory -RemotePath $RemotePath)) {
            return @()
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

# Deletes an optional remote object; absence is a valid cleanup state.
function Remove-RemoteFile {
    param([string]$RemotePath)

    try {
        $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::DeleteFile)
        $response = $request.GetResponse()
        $response.Dispose()
    }
    catch {
        if ((Test-FtpFileUnavailable -Exception $_.Exception) -and
            (Test-RemoteFileAbsent -RemotePath $RemotePath)) {
            return
        }
        throw
    }
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
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = (Get-Command curl.exe -ErrorAction Stop).Source
        $start.Arguments = '--config "{0}" --ssl-reqd --ftp-method nocwd --ftp-skip-pasv-ip --fail --silent --show-error --connect-timeout 30 --max-time 180 --output "{1}" "{2}"' -f $pipePath, $temporaryPath, $uri.AbsoluteUri
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardError = $true
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

        $stderrRead = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(190000)) {
            $process.Kill()
            return $false
        }
        $stderrRead.GetAwaiter().GetResult() | Out-Null
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
    param([string]$LocalPath, [string]$StagePath, [int64]$ExpectedBytes)

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
    $file = [IO.File]::OpenRead($LocalPath)
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
    param([string]$LocalPath, [string]$StagePath, [int64]$ExpectedBytes)

    if ($ExpectedBytes -le (8 * 1024 * 1024)) {
        Write-StagedSmallArtifact -LocalPath $LocalPath -StagePath $StagePath -ExpectedBytes $ExpectedBytes
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
        $file = [IO.File]::OpenRead($LocalPath)
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
        [string]$LocalPath,
        [string]$StagePath,
        [int64]$ExpectedBytes,
        [string]$ExpectedSha256
    )

    for ($cycle = 1; $cycle -le 2; $cycle += 1) {
        Set-ArtifactOperationState -Step "stage-write" -Attempt $cycle
        Write-StagedArtifact -LocalPath $LocalPath -StagePath $StagePath -ExpectedBytes $ExpectedBytes
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

# Atomically promotes one verified local artifact and restores its predecessor on any failure.
function Publish-Artifact {
    param(
        [string]$Source,
        [string]$LocalRelativePath,
        [string]$RemoteRelativePath
    )

    $script:activeArtifactLocal = $LocalRelativePath
    $script:activeArtifactRemote = $RemoteRelativePath
    $script:artifactPrimaryFailureStep = $null
    $script:artifactRollbackStatus = "not-started"
    Set-ArtifactOperationState -Step "local-validation"
    $sourceRoot = if ($Source -eq "source") {
        Join-Path $RepositoryRoot "tinyrustlm"
    }
    elseif ($Source -eq "generated-release") {
        $script:generatedReleaseRoot
    }
    else {
        throw "Deployment artifact source class is invalid."
    }
    if ([string]::IsNullOrWhiteSpace($sourceRoot)) {
        throw "Deployment artifact source root is unavailable."
    }
    $localPath = Join-Path $sourceRoot ($LocalRelativePath.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
        throw "Required deployment artifact is missing: $LocalRelativePath"
    }
    $item = Get-Item -LiteralPath $localPath
    $bytes = [int64]$item.Length
    $sha256 = Get-FileSha256 -Path $localPath
    $validated = $script:validatedArtifacts[$LocalRelativePath]
    if (-not $validated -or
        [int64]$validated.byteCount -ne $bytes -or
        [string]$validated.sha256 -ne $sha256) {
        throw "Deployment artifact changed after release validation: $LocalRelativePath"
    }
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
    $stageLeaf = "deploy-{0}-stage.slm" -f $sha256.Substring(0, 12)
    $backupLeaf = "backup-{0}.slm" -f $sha256.Substring(0, 12)
    $stagePath = if ($directory) { "$directory/$stageLeaf" } else { $stageLeaf }
    $backupPath = if ($directory) { "$directory/$backupLeaf" } else { $backupLeaf }

    Set-ArtifactOperationState -Step "current-artifact-readback"
    $currentSize = Get-RemoteSize -RemotePath $RemoteRelativePath
    if ($currentSize -eq $bytes -and
        (Test-RemoteArtifact -RemotePath $RemoteRelativePath -ExpectedBytes $bytes -ExpectedSha256 $sha256)) {
        if ($isHostPolicy) {
            Set-ArtifactOperationState -Step "public-host-policy"
            $script:publicHostPolicyEvidence = Test-PublicHostPolicy
        }
        Set-ArtifactOperationState -Step "current-temporary-cleanup"
        foreach ($obsoleteTemporaryPath in @($stagePath, $backupPath)) {
            Remove-RemoteFile -RemotePath $obsoleteTemporaryPath
            if ((Get-RemoteSize -RemotePath $obsoleteTemporaryPath) -ge 0) {
                throw "Current artifact retains an obsolete deployment temporary object."
            }
        }
        Write-Host "verified existing $RemoteRelativePath"
        Set-ArtifactOperationState -Step "complete"
        return [pscustomobject]@{
            source = $Source
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

    Stage-VerifiedArtifact `
        -LocalPath $localPath `
        -StagePath $stagePath `
        -ExpectedBytes $bytes `
        -ExpectedSha256 $sha256

    Set-ArtifactOperationState -Step "predecessor-state-read"
    $targetExisted = (Get-RemoteSize -RemotePath $RemoteRelativePath) -ge 0
    $rollbackAvailable = (Get-RemoteSize -RemotePath $backupPath) -ge 0
    if ($targetExisted) {
        if ($rollbackAvailable) {
            Set-ArtifactOperationState -Step "predecessor-backup-cleanup"
            Remove-RemoteFile -RemotePath $backupPath
            if ((Get-RemoteSize -RemotePath $backupPath) -ge 0) {
                throw "Stale deployment backup could not be removed before promotion."
            }
        }
        Set-ArtifactOperationState -Step "predecessor-backup"
        Rename-RemoteFile -RemotePath $RemoteRelativePath -NewLeafName $backupLeaf
        $rollbackAvailable = $true
    }
    try {
        Set-ArtifactOperationState -Step "stage-promotion"
        Rename-RemoteFile -RemotePath $stagePath -NewLeafName $leaf
        Start-Sleep -Milliseconds 750
        Set-ArtifactOperationState -Step "promoted-readback"
        if (-not (Test-RemoteArtifact -RemotePath $RemoteRelativePath -ExpectedBytes $bytes -ExpectedSha256 $sha256)) {
            throw "Remote SHA-256 verification failed after promoting $RemoteRelativePath."
        }
        if ($isHostPolicy) {
            Set-ArtifactOperationState -Step "public-host-policy"
            $script:publicHostPolicyEvidence = Test-PublicHostPolicy
        }
        Set-ArtifactOperationState -Step "temporary-cleanup"
        Remove-RemoteFile -RemotePath $backupPath
        if ((Get-RemoteSize -RemotePath $backupPath) -ge 0 -or
            (Get-RemoteSize -RemotePath $stagePath) -ge 0) {
            throw "Deployment temporary cleanup could not be verified."
        }
    }
    catch {
        $promotionFailure = $_
        $script:artifactPrimaryFailureStep = $script:artifactOperationStep
        $script:artifactRollbackStatus = "running"
        try {
            Set-ArtifactOperationState -Step "rollback-target-removal"
            Remove-RemoteFile -RemotePath $RemoteRelativePath
            if ($rollbackAvailable -and (Get-RemoteSize -RemotePath $backupPath) -ge 0) {
                Set-ArtifactOperationState -Step "rollback-restore"
                Rename-RemoteFile -RemotePath $backupPath -NewLeafName $leaf
                if ((Get-RemoteSize -RemotePath $RemoteRelativePath) -lt 0) {
                    throw "Rollback target remained absent."
                }
                $script:artifactRollbackStatus = "restored"
            }
            else {
                $script:artifactRollbackStatus = "target-absent"
            }
        }
        catch {
            $script:artifactRollbackStatus = "failed"
            Set-ArtifactOperationState -Step "rollback-failed"
            throw "Deployment promotion failed and rollback could not be verified."
        }
        Set-ArtifactOperationState -Step $script:artifactPrimaryFailureStep
        throw $promotionFailure
    }

    Write-Host "published $RemoteRelativePath"
    Set-ArtifactOperationState -Step "complete"
    return [pscustomobject]@{
        source = $Source
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

# Resolves one new external JSON receipt path and rejects reparse-point parents.
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
    $target = [IO.Path]::GetFullPath($Path)
    if (-not [string]::Equals(
        [IO.Path]::GetExtension($target),
        ".json",
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Deployment report path must name a JSON file."
    }
    $source = [IO.Path]::GetFullPath($SourceRoot).TrimEnd("\", "/")
    $sourcePrefix = $source + [IO.Path]::DirectorySeparatorChar
    if ([string]::Equals($target, $source, [StringComparison]::OrdinalIgnoreCase) -or
        $target.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Deployment reports must remain outside the source worktree."
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
    if (Test-Path -LiteralPath $target) {
        throw "Immutable deployment report path already exists."
    }
    $temporary = Join-Path $directory (".{0}.{1}.tmp" -f ([IO.Path]::GetFileName($target)), [Guid]::NewGuid().ToString("N"))
    $utf8 = [Text.UTF8Encoding]::new($false, $true)
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
            [IO.FileShare]::None
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
        $expectedBytes = [int64](Get-Item -LiteralPath $temporary).Length
        $expectedSha256 = Get-FileSha256 -Path $temporary
        if (Test-Path -LiteralPath $target) {
            throw "Immutable deployment report path was claimed concurrently."
        }
        [IO.File]::Move($temporary, $target)

        $committedBytes = [int64](Get-Item -LiteralPath $target).Length
        $committedSha256 = Get-FileSha256 -Path $target
        $committedText = [IO.File]::ReadAllText($target, $utf8)
        $committedText | ConvertFrom-Json | Out-Null
        if ($committedBytes -ne $expectedBytes -or
            $committedSha256 -ne $expectedSha256) {
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
                Remove-Item -LiteralPath $temporary -Force
            }
        }
        catch {
            throw "Immutable deployment report temporary cleanup failed."
        }
    }
}

$RepositoryRoot = [IO.Path]::GetFullPath($RepositoryRoot)
$siteRoot = Join-Path $RepositoryRoot "tinyrustlm"
$expectedManifestPath = Join-Path $siteRoot "deploy\web-deployment-manifest.v2.json"
$ManifestPath = [IO.Path]::GetFullPath($ManifestPath)
if (-not [string]::Equals(
    $ManifestPath,
    [IO.Path]::GetFullPath($expectedManifestPath),
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw "Deployment requires the source-controlled TinyRustLM web manifest."
}
if (-not (Test-Path -LiteralPath $siteRoot -PathType Container)) {
    throw "TinyRustLM site root was not found."
}
try {
    $deploymentManifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
}
catch {
    throw "Unable to read the validated TinyRustLM deployment manifest."
}
$script:publicOrigin = ([string]$deploymentManifest.publicOrigin).TrimEnd("/")
$validatorPath = Join-Path $siteRoot "tools\web-deployment-manifest.js"
$releaseMaterializerPath = Join-Path $siteRoot "tools\site-release-contract.js"
$releaseLedgerPath = Join-Path $siteRoot "release\site-release-ledger.v1.json"

if ($ValidateCredentialProfileOnly) {
    $validatedCredentialProfile = Get-WorkspaceDeploymentCredentialProfile `
        -MemoryPath $WorkspaceMemory `
        -SourceRoot $RepositoryRoot
    $validatedCredentialProfile.password = $null
    $validatedCredentialProfile = $null
    Write-Host "TinyRustLM external deployment credential profile validation passed."
    return
}
if ($ValidateOnly) {
    $validationReleaseRoot = Join-Path ([IO.Path]::GetTempPath()) (
        "tinyrustlm-web-validation-release-{0}" -f [Guid]::NewGuid().ToString("N")
    )
    try {
        $validationPublishedAt = [DateTime]::UtcNow.ToString(
            "yyyy-MM-ddTHH:mm:ss.fffZ",
            [Globalization.CultureInfo]::InvariantCulture
        )
        $materializationOutput = @(
            & node $releaseMaterializerPath `
                materialize `
                $releaseLedgerPath `
                $validationReleaseRoot `
                ("0" * 40) `
                $validationPublishedAt
        )
        if ($LASTEXITCODE -ne 0 -or $materializationOutput.Count -ne 1) {
            throw "TinyRustLM release metadata materialization failed."
        }
        $validationOutput = @(
            & node $validatorPath `
                $siteRoot `
                $ManifestPath `
                $validationReleaseRoot `
                --json
        )
        if ($LASTEXITCODE -ne 0 -or $validationOutput.Count -ne 1) {
            throw "TinyRustLM web deployment closure validation failed."
        }
        $validation = $validationOutput[0] | ConvertFrom-Json
        if ([string]$validation.status -ne "pass") {
            throw "TinyRustLM web deployment closure did not pass."
        }
        Write-Host "TinyRustLM web deployment validation passed for $($validation.fileCount) files."
    }
    finally {
        $resolvedValidationRoot = [IO.Path]::GetFullPath($validationReleaseRoot)
        $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
        if (-not $resolvedValidationRoot.StartsWith(
            $temporaryRoot + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
            [IO.Path]::GetFileName($resolvedValidationRoot) -notmatch
                "^tinyrustlm-web-validation-release-[0-9a-f]{32}$") {
            throw "TinyRustLM validation release cleanup target is unsafe."
        }
        if (Test-Path -LiteralPath $resolvedValidationRoot) {
            Remove-Item -LiteralPath $resolvedValidationRoot -Recurse -Force
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
$script:generatedReleaseRoot = Join-Path $reportDirectory (
    "tinyrustlm-web-release-assets-{0}" -f $attemptId
)
$secretScanReportPath = Join-Path $reportDirectory ("tinyrustlm-web-secret-scan-{0}.json" -f $attemptId)
$secretScanEvidenceRoot = Join-Path $reportDirectory ("tinyrustlm-web-secret-scan-evidence-{0}" -f $attemptId)
$finalizedLedgerCandidatePath = Join-Path $reportDirectory (
    "tinyrustlm-site-release-ledger-finalized-{0}.json" -f $attemptId
)
if ((Test-Path -LiteralPath $secretScanReportPath) -or
    (Test-Path -LiteralPath $secretScanEvidenceRoot) -or
    (Test-Path -LiteralPath $script:generatedReleaseRoot) -or
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
$script:predeploymentTemporaryRouteEvidence = $null
$script:publicHostPolicyEvidence = $null
$legacyModelDirectoryPreflight = $null
$retiredModelDirectory = $null
$reportReceipt = $null
try {
    $repositoryStatus = @(
        & git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>$null
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect the TinyRustLM Git worktree."
    }
    $sourceTreeClean = $repositoryStatus.Count -eq 0
    if (-not $sourceTreeClean) {
        throw "TinyRustLM deployment requires a clean committed Git worktree."
    }
    $currentSourceCommit = (& git -C $RepositoryRoot rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or $currentSourceCommit -notmatch "^[0-9a-f]{40}$") {
        throw "Unable to bind the deployment to a Git commit."
    }
    $trackedPaths = @(
        "tinyrustlm/deploy/web-deployment-manifest.v2.json"
        "tinyrustlm/release/site-release-ledger.v1.json"
        @($deploymentManifest.publish |
            Where-Object { [string]$_.source -eq "source" } |
            ForEach-Object { "tinyrustlm/{0}" -f [string]$_.local })
    ) | Sort-Object -Unique
    foreach ($trackedPath in $trackedPaths) {
        & git -C $RepositoryRoot ls-files --error-unmatch -- $trackedPath 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Deployment artifact is not tracked by Git: $trackedPath"
        }
    }

    $operationPhase = "release-metadata-materialization"
    $releasePublishedAt = $startedUtc.ToString(
        "yyyy-MM-ddTHH:mm:ss.fffZ",
        [Globalization.CultureInfo]::InvariantCulture
    )
    $materializationOutput = @(
        & node $releaseMaterializerPath `
            materialize `
            $releaseLedgerPath `
            $script:generatedReleaseRoot `
            $currentSourceCommit `
            $releasePublishedAt
    )
    if ($LASTEXITCODE -ne 0 -or $materializationOutput.Count -ne 1) {
        throw "TinyRustLM release metadata materialization failed."
    }
    $materialization = $materializationOutput[0] | ConvertFrom-Json
    if ([string]$materialization.status -ne "pass") {
        throw "TinyRustLM release metadata materialization did not pass."
    }

    $operationPhase = "deployment-closure-validation"
    $validationOutput = @(
        & node $validatorPath `
            $siteRoot `
            $ManifestPath `
            $script:generatedReleaseRoot `
            --json
    )
    if ($LASTEXITCODE -ne 0 -or $validationOutput.Count -ne 1) {
        throw "TinyRustLM web deployment closure validation failed."
    }
    $validation = $validationOutput[0] | ConvertFrom-Json
    if ([string]$validation.status -ne "pass") {
        throw "TinyRustLM web deployment closure did not pass."
    }
    $script:validatedArtifacts = @{}
    foreach ($validatedFile in @($validation.files)) {
        $script:validatedArtifacts[[string]$validatedFile.local] = $validatedFile
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
    $secretScanTool = Join-Path $siteRoot "tools\web-release-secret-scan.js"
    $secretScanOutput = @(
        & node $secretScanTool `
            $siteRoot `
            $ManifestPath `
            $secretScanReportPath `
            $secretScanEvidenceRoot `
            $currentSourceCommit `
            $script:generatedReleaseRoot
    )
    if ($LASTEXITCODE -ne 0 -or $secretScanOutput.Count -ne 1) {
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

    $operationPhase = "credential-profile"
    $credentialProfile = Get-WorkspaceDeploymentCredentialProfile `
        -MemoryPath $WorkspaceMemory `
        -SourceRoot $RepositoryRoot
    $script:ftpHost = [string]$credentialProfile.host
    $script:ftpPort = [int]$credentialProfile.port
    $script:credential = [Net.NetworkCredential]::new(
        [string]$credentialProfile.user,
        [string]$credentialProfile.password
    )
    $credentialProfile.password = $null
    $script:httpHandler = [Net.Http.HttpClientHandler]::new()
    $script:httpHandler.AllowAutoRedirect = $false
    $script:httpHandler.UseCookies = $false
    $script:httpHandler.UseDefaultCredentials = $false
    $script:httpHandler.MaxResponseHeadersLength = 32
    $script:httpClient = [Net.Http.HttpClient]::new($script:httpHandler, $true)
    $script:httpClient.Timeout = [TimeSpan]::FromMinutes(60)
    $operationPhase = "legacy-model-directory-preflight"
    $legacyModelDirectoryPreflight = Test-RetiredModelDirectoryClosure `
        -RetireEntries @($deploymentManifest.retire)
    $operationPhase = "host-policy-predeployment"
    $script:predeploymentTemporaryRouteEvidence = Test-PredeploymentTemporaryRoutePolicy

    $operationPhase = "remote-directory-preparation"
    $remoteDirectories = @($deploymentManifest.publish |
        ForEach-Object {
            (Get-RemoteFilePathParts -RemotePath ([string]$_.remote)).parent
        } |
        Where-Object { $_ } |
        Sort-Object -Unique)
    foreach ($remoteDirectory in $remoteDirectories) {
        Ensure-RemoteDirectory -RemotePath $remoteDirectory
    }
    $operationPhase = "artifact-publication"
    foreach ($entry in @($deploymentManifest.publish)) {
        $rows += Publish-Artifact `
            -Source ([string]$entry.source) `
            -LocalRelativePath ([string]$entry.local) `
            -RemoteRelativePath ([string]$entry.remote)
        $script:activeArtifactLocal = $null
        $script:activeArtifactRemote = $null
        $script:artifactOperationStep = $null
        $script:artifactOperationAttempt = $null
        $script:artifactPrimaryFailureStep = $null
        $script:artifactRollbackStatus = $null
    }
    $operationPhase = "retirement"
    foreach ($entry in @($deploymentManifest.retire)) {
        $removedPublicArtifacts += Remove-PublicArtifact -RemotePath ([string]$entry.remote)
    }
    $retiredModelDirectory = Remove-RetiredModelDirectory
    $operationPhase = "final-verification"
    if ($rows.Count -ne @($deploymentManifest.publish).Count -or
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
    $operationPhase = "release-ledger-finalization"
    $finalizationOutput = @(
        & node $releaseMaterializerPath `
            finalize `
            $releaseLedgerPath `
            $script:generatedReleaseRoot `
            $finalizedLedgerCandidatePath
    )
    if ($LASTEXITCODE -ne 0 -or $finalizationOutput.Count -ne 1) {
        throw "TinyRustLM release ledger finalization failed."
    }
    $finalization = $finalizationOutput[0] | ConvertFrom-Json
    if ([string]$finalization.status -ne "pass" -or
        [string]$finalization.publicationId -ne $releasePublicationId -or
        [string]$finalization.sha256 -ne (Get-FileSha256 -Path $finalizedLedgerCandidatePath)) {
        throw "TinyRustLM release ledger finalization did not pass identity verification."
    }
    $finalizedLedgerCandidateSha256 = [string]$finalization.sha256
    $finalizedLedgerCandidateByteCount = [int64]$finalization.byteCount
    $status = "pass"
    $operationPhase = "complete"
}
catch {
    $status = "fail"
    $failureIdentity = Get-SafeExceptionIdentity -Exception $_.Exception
    $failureStep = if ($operationPhase -eq "artifact-publication" -and
        $script:artifactPrimaryFailureStep) {
        $script:artifactPrimaryFailureStep
    }
    elseif ($operationPhase -eq "artifact-publication" -and
        $script:artifactOperationStep) {
        $script:artifactOperationStep
    }
    else {
        $operationPhase
    }
}
finally {
    if ($script:httpClient) {
        $script:httpClient.Dispose()
    }
    $script:httpHandler = $null
    $script:credential = $null
    $credentialProfile = $null

    $expectedFileCount = @($deploymentManifest.publish).Count
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
        schema = "tinyrustlm.atomic_ftps_deployment.v7"
        attempt_id = $attemptId
        deployment_scope = [string]$deploymentManifest.deploymentScope
        public_origin = $script:publicOrigin
        started_utc = $startedUtc.ToString("o")
        completed_utc = [DateTime]::UtcNow.ToString("o")
        status = $status
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
            }
        }
        else {
            $null
        }
        source_commit = $currentSourceCommit
        source_tree_clean = $sourceTreeClean
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
        release_metadata_generated_outside_source = $true
        release_metadata_https_readback_verified = (
            $status -eq "pass" -and
            @($rows | Where-Object {
                $_.source -eq "generated-release" -and $_.readback_verified -eq $true
            }).Count -eq 2
        )
        deployment_manifest_sha256 = [string]$validation.manifestSha256
        secret_scan_report_sha256 = $secretScanReportSha256
        secret_scan_scope_manifest_sha256 = $secretScanScopeManifestSha256
        secret_scan_receipt_id = $secretScanReceiptId
        secret_finding_count = $secretFindingCount
        secret_material_included = $false
        published_release_model_bytes_present = $false
        publication_transaction_scope = "per-artifact"
        per_artifact_atomic_promotion = $true
        whole_site_atomic_promotion = $false
        dependency_ordered_publication = $true
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
    $reportReceipt = Write-AtomicJson -Path $ReportPath -Value $report
}

if ($status -ne "pass") {
    throw "TinyRustLM deployment attempt failed; inspect immutable receipt $([IO.Path]::GetFileName($ReportPath))."
}
Write-Host "TinyRustLM $($deploymentManifest.deploymentScope) deployment passed for $($rows.Count) files with $($removedPublicArtifacts.Count) retired model routes verified absent."
Write-Host "Immutable deployment report: $([IO.Path]::GetFileName($ReportPath)) ($($reportReceipt.sha256))"
