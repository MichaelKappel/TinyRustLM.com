$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-True {
    param([bool]$Condition, [string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Pattern)

    $threw = $false
    try {
        & $Action
    }
    catch {
        $threw = $true
        if ($_.Exception.Message -notmatch $Pattern) {
            throw "Unexpected failure: $($_.Exception.Message)"
        }
    }
    if (-not $threw) {
        throw "Expected operation to fail: $Pattern"
    }
}

# Loads only named function definitions so the deployment entry point cannot execute.
function Import-DeploymentFunctions {
    param([string]$ScriptPath, [string[]]$Names)

    $tokens = $null
    $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile(
        $ScriptPath,
        [ref]$tokens,
        [ref]$errors
    )
    if ($errors.Count -ne 0) {
        throw "Deployment script has PowerShell parser errors."
    }
    $definitions = @($ast.FindAll({
        param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst]
    }, $true))
    foreach ($name in $Names) {
        $definition = @($definitions | Where-Object {
            [string]::Equals($_.Name, $name, [StringComparison]::OrdinalIgnoreCase)
        })
        if ($definition.Count -ne 1) {
            throw "Expected one deployment function named $name."
        }
        $bodyText = $definition[0].Body.Extent.Text
        $bodyText = $bodyText.Substring(1, $bodyText.Length - 2)
        Set-Item `
            -Path ("Function:\global:{0}" -f $name) `
            -Value ([scriptblock]::Create($bodyText))
    }
}

$deploymentScript = [IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\tools\deploy-tinyrustlm-web.ps1")
)
Import-DeploymentFunctions -ScriptPath $deploymentScript -Names @(
    "Get-YamlScalar"
    "Assert-NoReparsePointAncestry"
    "Get-DeploymentCredentialProfile"
    "Get-WorkspaceDeploymentCredentialProfile"
    "Get-FileSha256"
    "Get-Utf8Sha256"
    "Get-SafeExceptionIdentity"
    "Test-FtpFileUnavailable"
    "Get-RemoteSize"
    "Test-RetryableFtpsReadFailure"
    "Assert-RemoteProtocolPath"
    "Get-RemoteFilePathParts"
    "Set-ArtifactOperationState"
    "ConvertFrom-FtpDirectoryEntry"
    "New-CurrentUserCredentialPipe"
    "Publish-Artifact"
    "Invoke-PublicHostPolicyProbes"
    "Test-RetiredModelDirectoryClosure"
    "Remove-RetiredModelDirectory"
    "Resolve-NewDeploymentReportPath"
    "Write-AtomicJson"
)

$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$root = Join-Path $temporaryBase (
    "tinyrustlm-web-deployment-test-{0}" -f [Guid]::NewGuid().ToString("N")
)
[IO.Directory]::CreateDirectory($root) | Out-Null
try {
    $sourceRoot = Join-Path $root "source"
    $profileRoot = Join-Path $root "external-profile"
    [IO.Directory]::CreateDirectory($sourceRoot) | Out-Null
    [IO.Directory]::CreateDirectory($profileRoot) | Out-Null
    $utf8 = [Text.UTF8Encoding]::new($false)

    $validProfile = Join-Path $profileRoot "sitemanager.xml"
    $validXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<FileZilla3><Servers><Server>
<Host>example.com</Host><Port>21</Port><User>deployment-test</User>
<Pass encoding="base64">dGVzdC1wYXNzd29yZA==</Pass><Name>TinyRustLM.com</Name>
</Server></Servers></FileZilla3>
'@
    [IO.File]::WriteAllText($validProfile, $validXml, $utf8)
    $workspaceMemory = Join-Path $root "workspace.uai"
    [IO.File]::WriteAllText(
        $workspaceMemory,
        "filezilla_profile: $validProfile`n",
        $utf8
    )

    $credentialProfile = Get-WorkspaceDeploymentCredentialProfile `
        -MemoryPath $workspaceMemory `
        -SourceRoot $sourceRoot
    Assert-True ($credentialProfile.host -eq "example.com") "Credential host changed."
    Assert-True ($credentialProfile.port -eq 21) "Credential port changed."
    Assert-True ($credentialProfile.user -eq "deployment-test") "Credential user changed."
    Assert-True ($credentialProfile.password.Length -gt 0) "Credential password was not decoded."
    $credentialProfile.password = $null

    $rootParts = Get-RemoteFilePathParts -RemotePath ".htaccess"
    Assert-True (
        $rootParts.parent -eq "" -and $rootParts.leaf -eq ".htaccess"
    ) "Root remote path splitting changed."
    $nestedParts = Get-RemoteFilePathParts `
        -RemotePath "app/models/policy-0123456789ab.json"
    Assert-True (
        $nestedParts.parent -eq "app/models" -and
        $nestedParts.leaf -eq "policy-0123456789ab.json" -and
        -not $nestedParts.parent.Contains("\")
    ) "Model-directory probe path acquired an extra subtree or local separators."
    foreach ($invalidRemotePath in @(
        ""
        "/absolute.txt"
        "app\models\marker.json"
        "app//marker.json"
        "app/../marker.json"
        "app/model?.slm"
    )) {
        Assert-Throws {
            Get-RemoteFilePathParts -RemotePath $invalidRemotePath | Out-Null
        } "Remote protocol path"
    }

    $global:FalsePositiveSizeResponse = [pscustomobject]@{
        ContentLength = [int64]37
    }
    $global:FalsePositiveSizeResponse | Add-Member -MemberType ScriptMethod -Name Dispose -Value {}
    $global:FalsePositiveSizeRequest = [pscustomobject]@{}
    $global:FalsePositiveSizeRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
        return $global:FalsePositiveSizeResponse
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        return $global:FalsePositiveSizeRequest
    }
    function global:Test-RemoteFileAbsent {
        param([string]$RemotePath)
        return $true
    }
    try {
        Assert-True (
            (Get-RemoteSize -RemotePath "app/models/fresh-nonce.json") -eq -1
        ) "A false-positive SIZE response bypassed exact parent-listing absence."
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Remove-Item -LiteralPath Function:\global:Test-RemoteFileAbsent -Force
        Remove-Variable -Name FalsePositiveSizeResponse -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name FalsePositiveSizeRequest -Scope Global -ErrorAction SilentlyContinue
    }

    $global:TransientSizeAttempt = 0
    $global:TransientSizeResponse = [pscustomobject]@{
        ContentLength = [int64]41
    }
    $global:TransientSizeResponse | Add-Member -MemberType ScriptMethod -Name Dispose -Value {}
    $global:TransientSizeRequest = [pscustomobject]@{}
    $global:TransientSizeRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
        $global:TransientSizeAttempt += 1
        if ($global:TransientSizeAttempt -le 2) {
            throw [Net.WebException]::new(
                "simulated transient protocol response",
                [Net.WebExceptionStatus]::ServerProtocolViolation
            )
        }
        return $global:TransientSizeResponse
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        return $global:TransientSizeRequest
    }
    function global:Test-RemoteFileAbsent {
        param([string]$RemotePath)
        return $false
    }
    function global:Start-Sleep {
        param([int]$Milliseconds)
    }
    try {
        Assert-True (
            (Get-RemoteSize -RemotePath "app/retryable.js") -eq 41 -and
            $global:TransientSizeAttempt -eq 3
        ) "A transient FTPS protocol read was not recovered within the bound."

        $global:TransientSizeAttempt = 0
        $global:TransientSizeRequest.PSObject.Members.Remove("GetResponse")
        $global:TransientSizeRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
            $global:TransientSizeAttempt += 1
            throw [Net.WebException]::new(
                "simulated trust failure",
                [Net.WebExceptionStatus]::TrustFailure
            )
        }
        Assert-Throws {
            Get-RemoteSize -RemotePath "app/nonretryable.js" | Out-Null
        } "simulated trust failure"
        Assert-True (
            $global:TransientSizeAttempt -eq 1
        ) "A nonretryable FTPS trust failure was retried."

        $global:TransientSizeAttempt = 0
        $global:TransientSizeRequest.PSObject.Members.Remove("GetResponse")
        $global:TransientSizeRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
            $global:TransientSizeAttempt += 1
            throw [Net.WebException]::new(
                "simulated exhausted protocol response",
                [Net.WebExceptionStatus]::ServerProtocolViolation
            )
        }
        Assert-Throws {
            Get-RemoteSize -RemotePath "app/exhausted.js" | Out-Null
        } "simulated exhausted protocol response"
        Assert-True (
            $global:TransientSizeAttempt -eq 4
        ) "A transient FTPS read escaped its four-attempt bound."
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Remove-Item -LiteralPath Function:\global:Test-RemoteFileAbsent -Force
        Remove-Item -LiteralPath Function:\global:Start-Sleep -Force
        Remove-Variable -Name TransientSizeAttempt -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name TransientSizeResponse -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name TransientSizeRequest -Scope Global -ErrorAction SilentlyContinue
    }

    $pipe = New-CurrentUserCredentialPipe -Name (
        "tinyrustlm-deployment-test-{0}" -f [Guid]::NewGuid().ToString("N")
    )
    try {
        $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
        try {
            $currentSid = $currentIdentity.User.Value
        }
        finally {
            $currentIdentity.Dispose()
        }
        $pipeRules = @($pipe.GetAccessControl().GetAccessRules(
            $true,
            $false,
            [Security.Principal.SecurityIdentifier]
        ))
        Assert-True ($pipeRules.Count -eq 1) "Credential pipe ACL is not single-principal."
        Assert-True (
            $pipeRules[0].IdentityReference.Value -eq $currentSid -and
            $pipeRules[0].AccessControlType -eq
                [Security.AccessControl.AccessControlType]::Allow
        ) "Credential pipe ACL is not bound to the current user."
    }
    finally {
        $pipe.Dispose()
    }

    $duplicateProfile = Join-Path $profileRoot "duplicate.xml"
    [IO.File]::WriteAllText(
        $duplicateProfile,
        $validXml.Replace(
            "</Servers>",
            "<Server><Host>example.org</Host><Port>21</Port><User>second</User>" +
                "<Pass>second</Pass><Name>TinyRustLM</Name></Server></Servers>"
        ),
        $utf8
    )
    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath $duplicateProfile `
            -SourceRoot $sourceRoot | Out-Null
    } "exactly one TinyRustLM"

    $dtdProfile = Join-Path $profileRoot "dtd.xml"
    [IO.File]::WriteAllText(
        $dtdProfile,
        "<!DOCTYPE FileZilla3 [<!ENTITY blocked 'value'>]>" +
            $validXml.Substring($validXml.IndexOf("<FileZilla3>")),
        $utf8
    )
    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath $dtdProfile `
            -SourceRoot $sourceRoot | Out-Null
    } "DTD|prohibited|security"

    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath "relative-profile.xml" `
            -SourceRoot $sourceRoot | Out-Null
    } "must be absolute"

    $insideSourceProfile = Join-Path $sourceRoot "sitemanager.xml"
    [IO.File]::WriteAllText($insideSourceProfile, $validXml, $utf8)
    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath $insideSourceProfile `
            -SourceRoot $sourceRoot | Out-Null
    } "outside the source worktree"

    $profileJunction = Join-Path $root "profile-junction"
    try {
        New-Item `
            -ItemType Junction `
            -Path $profileJunction `
            -Target $profileRoot `
            -ErrorAction Stop | Out-Null
        Assert-Throws {
            Get-DeploymentCredentialProfile `
                -ProfilePath (Join-Path $profileJunction "sitemanager.xml") `
                -SourceRoot $sourceRoot | Out-Null
        } "ancestry is unsafe"
    }
    finally {
        if (Test-Path -LiteralPath $profileJunction) {
            [IO.Directory]::Delete($profileJunction)
        }
    }

    $resolvedReportPath = Resolve-NewDeploymentReportPath `
        -Path (Join-Path $profileRoot "deployment-report.json") `
        -SourceRoot $sourceRoot
    Assert-True (
        $resolvedReportPath -eq (Join-Path $profileRoot "deployment-report.json")
    ) "External deployment report path changed."
    Assert-Throws {
        Resolve-NewDeploymentReportPath `
            -Path "relative-report.json" `
            -SourceRoot $sourceRoot | Out-Null
    } "must be absolute"
    Assert-Throws {
        Resolve-NewDeploymentReportPath `
            -Path (Join-Path $sourceRoot "deployment-report.json") `
            -SourceRoot $sourceRoot | Out-Null
    } "outside the source worktree"
    Assert-Throws {
        Resolve-NewDeploymentReportPath `
            -Path (Join-Path $profileRoot "deployment-report.txt") `
            -SourceRoot $sourceRoot | Out-Null
    } "must name a JSON file"
    $junctionTarget = Join-Path $root "junction-target"
    $junctionPath = Join-Path $root "junction-output"
    [IO.Directory]::CreateDirectory($junctionTarget) | Out-Null
    try {
        New-Item `
            -ItemType Junction `
            -Path $junctionPath `
            -Target $junctionTarget `
            -ErrorAction Stop | Out-Null
        Assert-Throws {
            Resolve-NewDeploymentReportPath `
                -Path (Join-Path $junctionPath "nested\deployment-report.json") `
                -SourceRoot $sourceRoot | Out-Null
        } "cannot traverse a reparse point"
        Assert-True (
            -not (Test-Path -LiteralPath (Join-Path $junctionTarget "nested"))
        ) "Unsafe report validation created a directory through a junction."
    }
    finally {
        if (Test-Path -LiteralPath $junctionPath) {
            [IO.Directory]::Delete($junctionPath)
        }
    }

    $receiptPath = Join-Path $root "receipt.json"
    $receipt = Write-AtomicJson -Path $receiptPath -Value ([pscustomobject]@{
        schema = "tinyrustlm.deployment.persistence.test.v1"
        status = "pass"
    })
    Assert-True (Test-Path -LiteralPath $receiptPath -PathType Leaf) "Receipt is missing."
    Assert-True ($receipt.bytes -gt 0) "Receipt byte count is invalid."
    Assert-True ($receipt.sha256 -eq (Get-FileSha256 -Path $receiptPath)) "Receipt hash drifted."
    $originalReceiptHash = Get-FileSha256 -Path $receiptPath
    Assert-Throws {
        Write-AtomicJson -Path $receiptPath -Value ([pscustomobject]@{
            schema = "tinyrustlm.deployment.persistence.test.v1"
            status = "pass"
        }) | Out-Null
    } "already exists"
    Assert-True (
        (Get-FileSha256 -Path $receiptPath) -eq $originalReceiptHash
    ) "Immutable receipt changed after rejected overwrite."

    $oversizedPath = Join-Path $root "oversized.json"
    Assert-Throws {
        Write-AtomicJson -Path $oversizedPath -Value ([pscustomobject]@{
            payload = "x" * ((4 * 1024 * 1024) + 1)
        }) | Out-Null
    } "bounded JSON size"
    Assert-True (-not (Test-Path -LiteralPath $oversizedPath)) "Oversized receipt was created."
    Assert-True (
        @(Get-ChildItem -LiteralPath $root -Recurse -File |
            Where-Object { $_.Name.EndsWith(".tmp", [StringComparison]::OrdinalIgnoreCase) }).Count -eq 0
    ) "Temporary receipt files remain."

    Assert-True (
        (ConvertFrom-FtpDirectoryEntry `
            -Entry "model-a.slm" `
            -RemotePath "app/models") -eq "model-a.slm"
    ) "FTP leaf entry normalization changed."
    Assert-True (
        (ConvertFrom-FtpDirectoryEntry `
            -Entry ".htaccess" `
            -RemotePath "") -eq ".htaccess"
    ) "FTP root leaf entry normalization changed."
    Assert-True (
        (ConvertFrom-FtpDirectoryEntry `
            -Entry "models/model-a.slm" `
            -RemotePath "app/models") -eq "model-a.slm"
    ) "FTP virtual-root entry normalization changed."
    Assert-True (
        (ConvertFrom-FtpDirectoryEntry `
            -Entry "app/models/model-a.slm" `
            -RemotePath "app/models") -eq "model-a.slm"
    ) "FTP full-scope entry normalization changed."
    Assert-True (
        $null -eq (ConvertFrom-FtpDirectoryEntry `
            -Entry "models/." `
            -RemotePath "app/models")
    ) "FTP scoped dot entry was not omitted."
    Assert-True (
        $null -eq (ConvertFrom-FtpDirectoryEntry `
            -Entry "models/.." `
            -RemotePath "app/models")
    ) "FTP scoped dot-dot entry was not omitted."
    Assert-True (
        $null -eq (ConvertFrom-FtpDirectoryEntry `
            -Entry "." `
            -RemotePath "")
    ) "FTP root dot entry was not omitted."
    Assert-True (
        $null -eq (ConvertFrom-FtpDirectoryEntry `
            -Entry ".." `
            -RemotePath "")
    ) "FTP root dot-dot entry was not omitted."
    Assert-Throws {
        ConvertFrom-FtpDirectoryEntry `
            -Entry "scope/model-a.slm" `
            -RemotePath "" | Out-Null
    } "escaped its requested scope"
    Assert-Throws {
        ConvertFrom-FtpDirectoryEntry `
            -Entry "other/model-a.slm" `
            -RemotePath "app/models" | Out-Null
    } "escaped its requested scope"
    Assert-Throws {
        ConvertFrom-FtpDirectoryEntry `
            -Entry "models/nested/model-a.slm" `
            -RemotePath "app/models" | Out-Null
    } "non-child entry"
    Assert-Throws {
        ConvertFrom-FtpDirectoryEntry `
            -Entry "models\model-a.slm" `
            -RemotePath "app/models" | Out-Null
    } "invalid bounded entry"
    Assert-Throws {
        ConvertFrom-FtpDirectoryEntry `
            -Entry "model-a`n.slm" `
            -RemotePath "app/models" | Out-Null
    } "invalid bounded entry"

    $legacyRetireEntries = @(
        [pscustomobject]@{ remote = "app/models/model-a.slm" }
        [pscustomobject]@{ remote = "app/models/model-a.slm.manifest" }
    )
    $global:FakeRemoteDirectoryEntries = @("model-a.slm")
    function global:Get-RemoteDirectoryEntries {
        param([string]$RemotePath)
        return @($global:FakeRemoteDirectoryEntries)
    }
    function global:Remove-RemoteDirectory {
        param([string]$RemotePath)
        return "removed"
    }
    function global:Test-RemoteDirectory {
        param([string]$RemotePath)
        return $false
    }
    try {
        $legacyClosure = Test-RetiredModelDirectoryClosure `
            -RetireEntries $legacyRetireEntries
        Assert-True ($legacyClosure.status -eq "pass") "Legacy model closure did not pass."
        Assert-True (
            $legacyClosure.observed_entry_count -eq 1 -and
            $legacyClosure.undeclared_entry_count -eq 0
        ) "Legacy model closure counts changed."
        Assert-True (
            $legacyClosure.observed_entry_set_sha256 -eq
                (Get-Utf8Sha256 -Value "model-a.slm")
        ) "Legacy model closure identity changed."

        $global:FakeRemoteDirectoryEntries = @("model-a.slm", "undeclared.bin")
        Assert-Throws {
            Test-RetiredModelDirectoryClosure `
                -RetireEntries $legacyRetireEntries | Out-Null
        } "undeclared entries"

        $global:FakeRemoteDirectoryEntries = @("MODEL-A.SLM")
        Assert-Throws {
            Test-RetiredModelDirectoryClosure `
                -RetireEntries $legacyRetireEntries | Out-Null
        } "undeclared entries"

        $retiredDirectory = Remove-RetiredModelDirectory
        Assert-True (
            $retiredDirectory.status -eq "removed" -and
            $retiredDirectory.ftps_absent
        ) "Legacy model directory removal was not verified."
    }
    finally {
        foreach ($functionName in @(
            "Get-RemoteDirectoryEntries"
            "Remove-RemoteDirectory"
            "Test-RemoteDirectory"
        )) {
            Remove-Item -LiteralPath ("Function:\global:{0}" -f $functionName) -Force
        }
        Remove-Variable `
            -Name FakeRemoteDirectoryEntries `
            -Scope Global `
            -ErrorAction SilentlyContinue
    }

    $fakeRepository = Join-Path $root "fake-repository"
    $fakeSite = Join-Path $fakeRepository "tinyrustlm"
    $fakeApp = Join-Path $fakeSite "app"
    [IO.Directory]::CreateDirectory($fakeApp) | Out-Null
    $fakeLocalPath = Join-Path $fakeApp "release.js"
    [IO.File]::WriteAllText($fakeLocalPath, "release-bytes`n", $utf8)
    $fakeHostPolicyPath = Join-Path $fakeSite ".htaccess"
    [IO.File]::WriteAllText($fakeHostPolicyPath, "host-policy`n", $utf8)
    $fakeBytes = [int64](Get-Item -LiteralPath $fakeLocalPath).Length
    $fakeHash = Get-FileSha256 -Path $fakeLocalPath
    $fakeHostPolicyBytes = [int64](Get-Item -LiteralPath $fakeHostPolicyPath).Length
    $fakeHostPolicyHash = Get-FileSha256 -Path $fakeHostPolicyPath
    $fakeRemotePath = "app/release.js"
    $fakeStagePath = "app/deploy-$($fakeHash.Substring(0, 12))-stage.slm"
    $fakeBackupPath = "app/backup-$($fakeHash.Substring(0, 12)).slm"

    $global:RepositoryRoot = $fakeRepository
    $script:validatedArtifacts = @{
        "app/release.js" = [pscustomobject]@{
            byteCount = $fakeBytes
            sha256 = $fakeHash
        }
        ".htaccess" = [pscustomobject]@{
            byteCount = $fakeHostPolicyBytes
            sha256 = $fakeHostPolicyHash
        }
    }
    $global:FakeRemoteObjects = @{}
    $global:EnsuredRemoteDirectories = [Collections.Generic.List[string]]::new()
    $global:FailPromotionRename = $false
    $global:FailPublicHostPolicy = $false
    function global:Get-RemoteSize {
        param([string]$RemotePath)
        if ($global:FakeRemoteObjects.ContainsKey($RemotePath)) {
            return [int64]$global:FakeRemoteObjects[$RemotePath].bytes
        }
        return [int64]-1
    }
    function global:Remove-RemoteFile {
        param([string]$RemotePath)
        $global:FakeRemoteObjects.Remove($RemotePath)
    }
    function global:Rename-RemoteFile {
        param([string]$RemotePath, [string]$NewLeafName)
        if ($global:FailPromotionRename -and
            $RemotePath.EndsWith("-stage.slm", [StringComparison]::Ordinal)) {
            throw "simulated promotion failure"
        }
        if (-not $global:FakeRemoteObjects.ContainsKey($RemotePath)) {
            throw "simulated source absence"
        }
        $directory = Split-Path -Parent $RemotePath
        $destination = if ($directory) { "$directory/$NewLeafName" } else { $NewLeafName }
        $global:FakeRemoteObjects[$destination] = $global:FakeRemoteObjects[$RemotePath]
        $global:FakeRemoteObjects.Remove($RemotePath)
    }
    function global:Stage-VerifiedArtifact {
        param(
            [string]$LocalPath,
            [string]$StagePath,
            [int64]$ExpectedBytes,
            [string]$ExpectedSha256
        )
        $global:FakeRemoteObjects[$StagePath] = [pscustomobject]@{
            bytes = $ExpectedBytes
            sha256 = $ExpectedSha256
        }
    }
    function global:Test-RemoteArtifact {
        param(
            [string]$RemotePath,
            [int64]$ExpectedBytes,
            [string]$ExpectedSha256,
            [switch]$AuthenticatedOnly
        )
        if (-not $global:FakeRemoteObjects.ContainsKey($RemotePath)) {
            return $false
        }
        $remote = $global:FakeRemoteObjects[$RemotePath]
        return [int64]$remote.bytes -eq $ExpectedBytes -and
            [string]$remote.sha256 -eq $ExpectedSha256
    }
    function global:Test-PublicHostPolicy {
        if ($global:FailPublicHostPolicy) {
            $script:publicHostPolicyEvidence = [pscustomobject]@{
                status = "fail"
                failed_probe_kind = "stage"
                failed_http_status = 200
                failed_request_error_identity = $null
                authenticated_cleanup_verified = $true
                owned_directory_cleanup_verified = $true
                observations = @([pscustomobject]@{
                    kind = "stage"
                    request_succeeded = $true
                    https_status = 200
                    request_error_identity = $null
                })
            }
            throw "simulated public host policy failure"
        }
        return [pscustomobject]@{ status = "pass" }
    }
    function global:Start-Sleep {
        param([int]$Milliseconds, [int]$Seconds)
    }
    function global:Test-RemoteDirectory {
        param([string]$RemotePath)
        return $true
    }
    function global:Ensure-RemoteDirectory {
        param([string]$RemotePath)
        $global:EnsuredRemoteDirectories.Add($RemotePath)
    }
    function global:Remove-RemoteDirectory {
        param([string]$RemotePath)
        return $true
    }
    function global:Write-RemoteChunk {
        param([string]$RemotePath, [byte[]]$Bytes, [bool]$Append)
        if ($RemotePath.StartsWith("app/models/", [StringComparison]::Ordinal)) {
            throw "simulated nested policy write failure"
        }
        $hasher = [Security.Cryptography.SHA256]::Create()
        try {
            $hash = [BitConverter]::ToString(
                $hasher.ComputeHash($Bytes)
            ).Replace("-", "").ToLowerInvariant()
        }
        finally {
            $hasher.Dispose()
        }
        $global:FakeRemoteObjects[$RemotePath] = [pscustomobject]@{
            bytes = [int64]$Bytes.LongLength
            sha256 = $hash
        }
    }
    function global:Test-HttpsMissing {
        param([string]$RemotePath)
        $script:lastHttpsMissingObservation = [pscustomobject]@{
            request_succeeded = $true
            status_code = 404
            error_identity = $null
        }
        return $true
    }
    try {
        Assert-Throws {
            Invoke-PublicHostPolicyProbes -Kinds @(
                "stage"
                "model-directory"
            ) | Out-Null
        } "simulated nested policy write failure"
        Assert-True (
            $script:lastPublicHostPolicyProbeEvidence.status -eq "fail" -and
            $script:lastPublicHostPolicyProbeEvidence.completed_probe_count -eq 1 -and
            $script:lastPublicHostPolicyProbeEvidence.failed_probe_kind -eq "model-directory" -and
            $script:lastPublicHostPolicyProbeEvidence.failed_probe_step -eq "marker-write" -and
            $script:lastPublicHostPolicyProbeEvidence.failed_operation_error_identity -eq
                "System.Management.Automation.RuntimeException" -and
            $script:lastPublicHostPolicyProbeEvidence.authenticated_cleanup_verified
        ) "Pre-HTTP policy failure was not retained as a bounded failed probe."
        Assert-True (
            @($global:EnsuredRemoteDirectories | Where-Object {
                $_.StartsWith("app/models/", [StringComparison]::Ordinal)
            }).Count -eq 0 -and
            $global:EnsuredRemoteDirectories.Contains("app/models")
        ) "Model-directory policy proof attempted to create an unrelated deeper subtree."
        Assert-True (
            $global:FakeRemoteObjects.Count -eq 0
        ) "Policy failure regression left a probe object behind."

        $oldRemote = [pscustomobject]@{ bytes = 7; sha256 = "old" }
        $global:FakeRemoteObjects[$fakeBackupPath] = $oldRemote
        $global:FailPromotionRename = $true
        Assert-Throws {
            Publish-Artifact `
                -Source "source" `
                -LocalRelativePath "app/release.js" `
                -RemoteRelativePath $fakeRemotePath | Out-Null
        } "simulated promotion failure"
        Assert-True (
            $global:FakeRemoteObjects.ContainsKey($fakeRemotePath) -and
            $global:FakeRemoteObjects[$fakeRemotePath].sha256 -eq "old"
        ) "Interrupted promotion did not restore its preexisting rollback copy."
        Assert-True (
            -not $global:FakeRemoteObjects.ContainsKey($fakeBackupPath)
        ) "Rollback copy remained after restoration."
        Assert-True (
            $script:artifactPrimaryFailureStep -eq "stage-promotion"
        ) "Primary publication failure step was not preserved through rollback."
        Assert-True (
            $script:artifactOperationStep -eq "stage-promotion"
        ) "Publication state did not return to the primary failure step."
        Assert-True (
            $script:artifactRollbackStatus -eq "restored"
        ) "Successful rollback status was not retained."
        Assert-True (
            $script:activeArtifactRemote -eq $fakeRemotePath
        ) "Active artifact identity was not retained for failure evidence."

        $global:FailPromotionRename = $false
        $global:FailPublicHostPolicy = $true
        $global:FakeRemoteObjects.Clear()
        $oldHostPolicy = [pscustomobject]@{ bytes = 17; sha256 = "old-host-policy" }
        $global:FakeRemoteObjects[".htaccess"] = $oldHostPolicy
        Assert-Throws {
            Publish-Artifact `
                -Source "source" `
                -LocalRelativePath ".htaccess" `
                -RemoteRelativePath ".htaccess" | Out-Null
        } "simulated public host policy failure"
        Assert-True (
            $global:FakeRemoteObjects.ContainsKey(".htaccess") -and
            $global:FakeRemoteObjects[".htaccess"].sha256 -eq "old-host-policy"
        ) "Host-policy failure did not restore its predecessor."
        Assert-True (
            $script:artifactPrimaryFailureStep -eq "public-host-policy" -and
            $script:artifactRollbackStatus -eq "restored"
        ) "Host-policy failure lost its exact rollback substep."
        Assert-True (
            $script:publicHostPolicyEvidence.status -eq "fail" -and
            $script:publicHostPolicyEvidence.failed_probe_kind -eq "stage" -and
            $script:publicHostPolicyEvidence.failed_http_status -eq 200 -and
            $script:publicHostPolicyEvidence.authenticated_cleanup_verified
        ) "Host-policy failure lost bounded HTTP and cleanup evidence."

        $global:FailPromotionRename = $false
        $global:FailPublicHostPolicy = $false
        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeRemotePath] = [pscustomobject]@{
            bytes = $fakeBytes
            sha256 = $fakeHash
        }
        $global:FakeRemoteObjects[$fakeStagePath] = [pscustomobject]@{
            bytes = $fakeBytes
            sha256 = $fakeHash
        }
        $global:FakeRemoteObjects[$fakeBackupPath] = $oldRemote
        $current = Publish-Artifact `
            -Source "source" `
            -LocalRelativePath "app/release.js" `
            -RemoteRelativePath $fakeRemotePath
        Assert-True ($current.status -eq "already-current") "Current artifact status changed."
        Assert-True ($current.temporary_cleanup_verified) "Current artifact cleanup was not verified."
        Assert-True (
            -not $global:FakeRemoteObjects.ContainsKey($fakeStagePath) -and
            -not $global:FakeRemoteObjects.ContainsKey($fakeBackupPath)
        ) "Current artifact retained stale deployment objects."

        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeRemotePath] = $oldRemote
        $published = Publish-Artifact `
            -Source "source" `
            -LocalRelativePath "app/release.js" `
            -RemoteRelativePath $fakeRemotePath
        Assert-True ($published.status -eq "published") "Artifact was not promoted."
        Assert-True ($published.temporary_cleanup_verified) "Published cleanup was not verified."
        Assert-True (
            $global:FakeRemoteObjects[$fakeRemotePath].sha256 -eq $fakeHash
        ) "Published artifact identity changed."
        Assert-True (
            -not $global:FakeRemoteObjects.ContainsKey($fakeStagePath) -and
            -not $global:FakeRemoteObjects.ContainsKey($fakeBackupPath)
        ) "Published artifact retained deployment objects."
        Assert-True (
            $script:artifactOperationStep -eq "complete"
        ) "Successful publication did not reach the complete substep."
    }
    finally {
        foreach ($functionName in @(
            "Get-RemoteSize"
            "Remove-RemoteFile"
            "Rename-RemoteFile"
            "Stage-VerifiedArtifact"
            "Test-RemoteArtifact"
            "Test-PublicHostPolicy"
            "Test-RemoteDirectory"
            "Ensure-RemoteDirectory"
            "Remove-RemoteDirectory"
            "Write-RemoteChunk"
            "Test-HttpsMissing"
            "Start-Sleep"
        )) {
            Remove-Item -LiteralPath ("Function:\global:{0}" -f $functionName) -Force
        }
        Remove-Variable -Name FakeRemoteObjects -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name EnsuredRemoteDirectories -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name FailPromotionRename -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name FailPublicHostPolicy -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name RepositoryRoot -Scope Global -ErrorAction SilentlyContinue
        $script:validatedArtifacts = $null
        $script:activeArtifactLocal = $null
        $script:activeArtifactRemote = $null
        $script:artifactOperationStep = $null
        $script:artifactOperationAttempt = $null
        $script:artifactPrimaryFailureStep = $null
        $script:artifactRollbackStatus = $null
    }
}
finally {
    $resolvedRoot = [IO.Path]::GetFullPath($root)
    $expectedPrefix = $temporaryBase + [IO.Path]::DirectorySeparatorChar +
        "tinyrustlm-web-deployment-test-"
    if (-not $resolvedRoot.StartsWith(
        $expectedPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Refusing to clean an unexpected deployment-test path."
    }
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
}

Write-Host "TinyRustLM deployment persistence and credential-profile tests passed."
