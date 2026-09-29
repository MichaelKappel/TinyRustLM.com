# Sole FTP-export reader for the canonical TinyRustLM and MiniModel publishers.
# Import only after source admission and exact module-byte verification; importing performs no I/O.
Set-StrictMode -Version Latest

# Rejects credential paths reached through links or reparse-point ancestors.
function Assert-DeploymentCredentialAncestry {
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

# Selects one bounded external UTF-8 FTP export record; never logs fields or changes remote state.
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
    Assert-DeploymentCredentialAncestry `
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

Export-ModuleMember -Function Get-DeploymentCredentialProfile
