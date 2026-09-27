param([Parameter(Mandatory = $true)][string]$OperationRoot)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Net.Http

if (-not ("TinyRustLMSyntheticPublicHandler" -as [type])) {
    Add-Type -ReferencedAssemblies ([Net.Http.HttpClient].Assembly.Location) -TypeDefinition @'
using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

public sealed class TinyRustLMSyntheticPublicHandler : HttpMessageHandler
{
    private readonly byte[] content;

    public TinyRustLMSyntheticPublicHandler(byte[] content)
    {
        this.content = content;
    }

    public string ObservedMethod { get; private set; }
    public string ObservedUri { get; private set; }
    public bool ObservedNoCache { get; private set; }
    public bool ObservedNoStore { get; private set; }
    public long ObservedMaxAgeTicks { get; private set; }
    public bool ObservedPragmaNoCache { get; private set; }
    public bool ObservedAuthorization { get; private set; }
    public bool ObservedCookie { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        this.ObservedMethod = request.Method.Method;
        this.ObservedUri = request.RequestUri.AbsoluteUri;
        CacheControlHeaderValue cacheControl = request.Headers.CacheControl;
        this.ObservedNoCache = cacheControl != null && cacheControl.NoCache;
        this.ObservedNoStore = cacheControl != null && cacheControl.NoStore;
        this.ObservedMaxAgeTicks = cacheControl != null && cacheControl.MaxAge.HasValue
            ? cacheControl.MaxAge.Value.Ticks
            : -1;
        foreach (NameValueHeaderValue value in request.Headers.Pragma)
        {
            if (String.Equals(value.Name, "no-cache", StringComparison.OrdinalIgnoreCase))
            {
                this.ObservedPragmaNoCache = true;
            }
        }
        this.ObservedAuthorization = request.Headers.Authorization != null;
        this.ObservedCookie = request.Headers.Contains("Cookie");

        HttpResponseMessage response = new HttpResponseMessage(HttpStatusCode.OK);
        response.Content = new ByteArrayContent(this.content);
        response.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        return Task.FromResult(response);
    }
}
'@
}

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
    "Get-DeploymentGitTopLevel"
    "Resolve-CanonicalDeploymentRepositoryRoot"
    "Get-YamlScalar"
    "Assert-NoReparsePointAncestry"
    "Get-BoundedWorkspaceMemoryLines"
    "Get-WorkspaceDeploymentTargetBinding"
    "Get-DeploymentCredentialProfile"
    "Get-WorkspaceDeploymentCredentialProfile"
    "Assert-DeploymentCredentialTarget"
    "Get-FileSha256"
    "Get-Utf8Sha256"
    "Get-ByteArraySha256"
    "Resolve-PinnedDeploymentExecutable"
    "Resolve-PinnedDeploymentHost"
    "Assert-PinnedDeploymentExecutable"
    "Assert-PinnedDeploymentHost"
    "ConvertTo-DeploymentProcessArgument"
    "New-SanitizedDeploymentProcessStartInfo"
    "Invoke-PinnedDeploymentProcess"
    "Assert-PinnedDeploymentToolVersions"
    "Get-DeploymentTransportCapability"
    "Assert-SafeDeploymentTransportCapability"
    "New-ExclusiveDeploymentLease"
    "Remove-ExclusiveDeploymentLease"
    "New-OwnedValidationMaterialization"
    "Remove-OwnedValidationMaterialization"
    "Remove-PublicPredecessorOracle"
    "Get-DeploymentPublicationPlan"
    "Resolve-DeploymentCustodyFilePath"
    "Get-DeploymentNodeToolClosure"
    "New-DeploymentSourceCustody"
    "Assert-DeploymentSourceCustody"
    "Invoke-CustodiedNodeTool"
    "Get-SafeExceptionIdentity"
    "Test-FtpFileUnavailable"
    "Test-RemoteFileAbsent"
    "Get-RemoteSize"
    "Test-RetryableFtpsReadFailure"
    "Test-RetryableFtpsCleanupFailure"
    "Assert-RemoteProtocolPath"
    "Get-RemoteFilePathParts"
    "Set-ArtifactOperationState"
    "Test-RemoteRenameCommitted"
    "Rename-RemoteFile"
    "ConvertFrom-FtpDirectoryEntry"
    "Remove-RemoteFile"
    "New-CurrentUserCredentialPipe"
    "Read-BoundedFtpsArtifact"
    "Get-BoundedDeploymentStreamIdentity"
    "Get-FtpsArtifactIdentity"
    "Assert-DeploymentTargetIdentity"
    "Read-BoundedPublicResponse"
    "Read-BoundedPublicArtifact"
    "ConvertFrom-StrictPublicJsonBytes"
    "Test-ExactByteArray"
    "Assert-PublicReleasePredecessor"
    "Assert-DeploymentInputEntry"
    "Assert-CanonicalDeploymentSourceRoot"
    "Assert-CanonicalDeploymentArtifactPath"
    "Write-StagedSmallArtifact"
    "Write-StagedArtifact"
    "Stage-VerifiedArtifact"
    "Publish-Artifact"
    "Invoke-PublicHostPolicyProbes"
    "Test-RetiredModelDirectoryClosure"
    "Remove-RetiredModelDirectory"
    "Remove-PublicArtifact"
    "Resolve-NewDeploymentReportPath"
    "Write-AtomicJson"
)

$canonicalRepositoryRoot = "E:\Source\Rust\TinyRustLM.com"
$root = Assert-CanonicalDeploymentArtifactPath -Path $OperationRoot -SourceRoot $canonicalRepositoryRoot
if (-not (Test-Path -LiteralPath ($root + ".owner.v2") -PathType Leaf)) {
    throw "Run this suite through its Node launcher, which owns and cleans the test output."
}
try {
    $script:powershellHost = Resolve-PinnedDeploymentHost
    # The PowerShell boundary must admit owned canonical artifacts and delegate
    # to the Node remover that independently checks exact bytes and ownership.
    $oracleBoundaryRoot = Join-Path $root ("tinyrustlm-web-predecessor-" + ("a" * 32))
    [IO.Directory]::CreateDirectory($oracleBoundaryRoot) | Out-Null
    $originalCustodiedTool = (Get-Item Function:\Invoke-CustodiedNodeTool).ScriptBlock
    try {
        Set-Item Function:\global:Invoke-CustodiedNodeTool -Value {
            throw "reached predecessor inventory verifier"
        }
        $oracleBoundaryExpected = [pscustomobject]@{
            current = [pscustomobject]@{ byte_count = 1; sha256 = ("a" * 64) }
            history = [pscustomobject]@{ byte_count = 2; sha256 = ("b" * 64) }
        }
        Assert-Throws -Pattern "reached predecessor inventory verifier" -Action {
            Remove-PublicPredecessorOracle -Expected $oracleBoundaryExpected `
                -OracleRoot $oracleBoundaryRoot -RepositoryRoot $canonicalRepositoryRoot `
                -ToolPath "bound-tool" -SourceCustody ([pscustomobject]@{ bound = $true })
        }
        Assert-Throws -Pattern "absolute child of canonical project artifacts" -Action {
            Remove-PublicPredecessorOracle -Expected $oracleBoundaryExpected `
                -OracleRoot $canonicalRepositoryRoot -RepositoryRoot $canonicalRepositoryRoot `
                -ToolPath "bound-tool" -SourceCustody ([pscustomobject]@{ bound = $true })
        }
    }
    finally {
        Set-Item Function:\global:Invoke-CustodiedNodeTool -Value $originalCustodiedTool
    }
    $script:nodeExecutable = Resolve-PinnedDeploymentExecutable `
        -CommandName "node.exe" `
        -ExpectedLeafName "node.exe"
    $script:curlExecutable = Resolve-PinnedDeploymentExecutable `
        -CommandName "curl.exe" `
        -ExpectedLeafName "curl.exe"
    $script:gitExecutable = Resolve-PinnedDeploymentExecutable `
        -CommandName "git.exe" `
        -ExpectedLeafName "git.exe"
    $toolVersions = Assert-PinnedDeploymentToolVersions `
        -PowerShellHost $script:powershellHost `
        -NodeExecutable $script:nodeExecutable `
        -CurlExecutable $script:curlExecutable `
        -GitExecutable $script:gitExecutable
    Assert-True (
        $toolVersions.environment_allowlisted -and
        -not $toolVersions.node_options_inherited -and
        [string]$toolVersions.node_version -match "^v24\." -and
        [string]$toolVersions.curl_version -match "^[0-9]+\." -and
        [string]$toolVersions.git_version -match "^[0-9]+\."
    ) "Pinned deployment tool custody did not pass."
    # Execute the real pinned Git child: this checkout may belong to another
    # account, so sanitization must preserve only explicit canonical trust.
    $realTopLevel = Get-DeploymentGitTopLevel -RepositoryRoot $canonicalRepositoryRoot
    Assert-True ([string]::Equals($realTopLevel, $canonicalRepositoryRoot,
        [StringComparison]::OrdinalIgnoreCase)) "Pinned Git did not admit the exact canonical checkout."
    $priorNodeOptions = $env:NODE_OPTIONS
    $priorGitEnvironment = @{}
    foreach ($name in @("GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0",
        "GIT_CONFIG_KEY_99", "GIT_CONFIG_VALUE_99", "GIT_CONFIG_PARAMETERS")) {
        $priorGitEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    }
    try {
        $env:NODE_OPTIONS = "--require=untrusted-deployment-hook.js"
        $env:GIT_CONFIG_COUNT = "100"
        $env:GIT_CONFIG_KEY_0 = "safe.directory"
        $env:GIT_CONFIG_VALUE_0 = "*"
        $env:GIT_CONFIG_KEY_99 = "core.hooksPath"
        $env:GIT_CONFIG_VALUE_99 = "untrusted-hooks"
        $env:GIT_CONFIG_PARAMETERS = "untrusted configuration"
        $sanitizedStart = New-SanitizedDeploymentProcessStartInfo `
            -Executable $script:nodeExecutable `
            -Arguments @("--version")
        Assert-True (
            -not $sanitizedStart.EnvironmentVariables.ContainsKey("NODE_OPTIONS") -and
            -not $sanitizedStart.EnvironmentVariables.ContainsKey("GIT_CONFIG_GLOBAL") -and
            -not $sanitizedStart.EnvironmentVariables.ContainsKey("HTTP_PROXY") -and
            $sanitizedStart.EnvironmentVariables.ContainsKey("PATH")
        ) "Deployment subprocess inherited ambient execution configuration."
        $expectedGitRoots = @("E:/Source/Rust/LMComposer.com", "E:/Source/Rust/MiniModel.MiRust.com",
            "E:/Source/Rust/MiniModel.org", "E:/Source/Rust/MiRust.com", "E:/Source/Rust/Runtime.MiRust.com",
            "E:/Source/Rust/TinyRustLM.com", "E:/Source/Rust/TinyRustLM.MiRust.com")
        foreach ($executable in @($script:gitExecutable, $script:nodeExecutable)) {
            $gitStart = New-SanitizedDeploymentProcessStartInfo -Executable $executable -Arguments @("--version")
            $gitEnvironment = $gitStart.EnvironmentVariables
            Assert-True ($gitEnvironment["GIT_CONFIG_COUNT"] -eq "8" -and
                $gitEnvironment["GIT_CONFIG_KEY_0"] -eq "safe.directory" -and
                $gitEnvironment["GIT_CONFIG_VALUE_0"] -ceq "" -and
                -not $gitEnvironment.ContainsKey("GIT_CONFIG_KEY_99") -and
                -not $gitEnvironment.ContainsKey("GIT_CONFIG_PARAMETERS")) `
                "Child Git trust inherited ambient configuration or failed to reset trust."
            for ($index = 1; $index -le $expectedGitRoots.Count; $index++) {
                Assert-True ($gitEnvironment["GIT_CONFIG_KEY_$index"] -ceq "safe.directory" -and
                    $gitEnvironment["GIT_CONFIG_VALUE_$index"] -ceq $expectedGitRoots[$index - 1]) `
                    "Child Git trust escaped the exact canonical ecosystem roots."
            }
        }
        $curlStart = New-SanitizedDeploymentProcessStartInfo -Executable $script:curlExecutable -Arguments @("--version")
        Assert-True (-not $curlStart.EnvironmentVariables.ContainsKey("GIT_CONFIG_COUNT")) `
            "Unrelated child received Git trust configuration."
        $nestedGit = Invoke-PinnedDeploymentProcess -Executable $script:nodeExecutable `
            -WorkingDirectory $canonicalRepositoryRoot -Arguments @("-e",
            'const p=require("node:child_process").spawnSync("git",["-C",process.cwd(),"rev-parse","--show-toplevel"],{encoding:"utf8"}); if(p.error)process.exit(2); process.stdout.write(p.stdout); process.exit(p.status);')
        Assert-True ($nestedGit.exit_code -eq 0 -and @($nestedGit.stdout_lines).Count -eq 1 -and
            [string]::Equals([IO.Path]::GetFullPath([string]@($nestedGit.stdout_lines)[0]),
                $canonicalRepositoryRoot, [StringComparison]::OrdinalIgnoreCase)) `
                "Nested Node-to-Git lost canonical ownership admission."
    }
    finally {
        foreach ($name in $priorGitEnvironment.Keys) {
            [Environment]::SetEnvironmentVariable($name, $priorGitEnvironment[$name], "Process")
        }
        if ($null -eq $priorNodeOptions) {
            Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
        }
        else {
            $env:NODE_OPTIONS = $priorNodeOptions
        }
    }
    $transportCapability = Get-DeploymentTransportCapability
    Assert-True (
        [string]$transportCapability.schema -eq "tinyrustlm.deployment_transport_capability.v2" -and
        [string]$transportCapability.status -eq "bounded-sequential" -and
        $transportCapability.remote_global_compare_and_swap_lease -eq $false -and
        $transportCapability.release_wide_atomic_rollback -eq $false -and
        $transportCapability.final_marker_can_be_last_remote_mutation -eq $false -and
        $transportCapability.mixed_publication_possible -eq $true
    ) "FTPS transport capability was overstated."
    Assert-SafeDeploymentTransportCapability -Capability $transportCapability
    foreach ($field in @("remote_global_compare_and_swap_lease", "release_wide_atomic_rollback",
        "final_marker_can_be_last_remote_mutation", "mixed_publication_possible")) {
        $forged = $transportCapability | ConvertTo-Json | ConvertFrom-Json
        $forged.$field = -not $forged.$field
        Assert-Throws { Assert-SafeDeploymentTransportCapability -Capability $forged } "evidence is invalid"
    }
    foreach ($invalidSchema in @("tinyrustlm.deployment_transport_capability.v1", "unexpected")) {
        $forged = $transportCapability | ConvertTo-Json | ConvertFrom-Json
        $forged.schema = $invalidSchema
        Assert-Throws { Assert-SafeDeploymentTransportCapability -Capability $forged } "evidence is invalid"
    }
    $forged = $transportCapability | ConvertTo-Json | ConvertFrom-Json
    $forged.release_wide_atomic_rollback = "False"
    Assert-Throws { Assert-SafeDeploymentTransportCapability -Capability $forged } "evidence is invalid"

    foreach ($streamCase in @(
        @{ bytes = [byte[]]@(1, 2, 3); admitted = 3; valid = $true },
        @{ bytes = [byte[]]@(); admitted = 0; valid = $true },
        @{ bytes = [byte[]]@(1, 2); admitted = 3; valid = $false },
        @{ bytes = [byte[]]@(1, 2, 3, 4); admitted = 3; valid = $false },
        @{ bytes = [byte[]]@(1); admitted = 0; valid = $false }
    )) {
        $stream = [IO.MemoryStream]::new($streamCase.bytes)
        try {
            if ($streamCase.valid) {
                $identity = Get-BoundedDeploymentStreamIdentity -Stream $stream -ExpectedBytes $streamCase.admitted
                $expectedHash = if ($streamCase.admitted -eq 0) {
                    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                } else { Get-ByteArraySha256 -Bytes $streamCase.bytes }
                Assert-True ($identity.bytes -eq $streamCase.admitted -and
                    $identity.sha256 -eq $expectedHash) `
                    "Authenticated predecessor identity did not match its exact bytes."
            }
            else {
                Assert-Throws { Get-BoundedDeploymentStreamIdentity -Stream $stream `
                    -ExpectedBytes $streamCase.admitted | Out-Null } "truncated|admitted length"
            }
        }
        finally { $stream.Dispose() }
    }
    Assert-Throws { Get-BoundedDeploymentStreamIdentity -Stream $null -ExpectedBytes 268435457 } "range|greater|validat"
    $closedStream = [IO.MemoryStream]::new([byte[]]@(1))
    $closedStream.Dispose()
    Assert-Throws { Get-BoundedDeploymentStreamIdentity -Stream $closedStream -ExpectedBytes 1 } "closed|disposed"

    # Exercise the real FTPS identity wrapper with a synthetic response only.
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        Assert-True ($RemotePath -eq "app/predecessor.js" -and $Method -eq "RETR") `
            "Predecessor identity did not use an authenticated read-only file request."
        $request = [pscustomobject]@{ Response = $global:SyntheticIdentityResponse }
        $request | Add-Member ScriptMethod GetResponse { return $this.Response }
        return $request
    }
    try {
        foreach ($advertisedLength in @(3, -1, 4)) {
            $global:IdentityResponseDisposed = $false
            $global:SyntheticIdentityResponse = [pscustomobject]@{
                ContentLength = $advertisedLength
                Stream = [IO.MemoryStream]::new([byte[]]@(1, 2, 3))
            }
            $global:SyntheticIdentityResponse | Add-Member ScriptMethod GetResponseStream { return $this.Stream }
            $global:SyntheticIdentityResponse | Add-Member ScriptMethod Dispose {
                $this.Stream.Dispose()
                $global:IdentityResponseDisposed = $true
            }
            if ($advertisedLength -eq 4) {
                Assert-Throws { Get-FtpsArtifactIdentity -RemotePath "app/predecessor.js" -ExpectedBytes 3 } "length changed"
            } else {
                $identity = Get-FtpsArtifactIdentity -RemotePath "app/predecessor.js" -ExpectedBytes 3
                Assert-True ($identity.bytes -eq 3 -and $identity.sha256 -eq
                    (Get-ByteArraySha256 -Bytes ([byte[]]@(1, 2, 3)))) "FTPS wrapper identity changed."
            }
            Assert-True ($global:IdentityResponseDisposed -and -not $global:SyntheticIdentityResponse.Stream.CanRead) `
                "FTPS identity response was not disposed."
        }
    }
    finally {
        Remove-Item Function:\global:New-FtpRequest
        Remove-Variable -Scope Global -Name SyntheticIdentityResponse, IdentityResponseDisposed
    }

    $sourceRoot = Join-Path $root "source"
    $profileRoot = Join-Path $root "external-profile"
    [IO.Directory]::CreateDirectory($sourceRoot) | Out-Null
    [IO.Directory]::CreateDirectory($profileRoot) | Out-Null
    $utf8 = [Text.UTF8Encoding]::new($false)

    $validProfile = Join-Path $profileRoot "ftp.txt"
    $validText = @'
FTP Username: deployment-test@TinyRustLM.com
FTP server: example.com
FTP & explicit FTPS port: 21
Username: deployment-test
Password: test:password=value
'@
    [IO.File]::WriteAllText($validProfile, $validText, $utf8)
    $sentinelText = [IO.File]::ReadAllText(
        (Join-Path $canonicalRepositoryRoot 'tinyrustlm\deploy\deployment-root-sentinel.v1.json'),
        [Text.UTF8Encoding]::new($false, $true)
    )
    $sentinelBytes = $utf8.GetBytes($sentinelText)
    $sentinelSha256 = Get-Utf8Sha256 -Value $sentinelText

    $predecessorCurrentText = '{"canonicalOrigin":"https://tinyrustlm.com",' +
        '"publicationId":"' + ("5" * 64) + '",' +
        '"releaseId":"tinyrustlm.com@0.4.1",' +
        '"schema":"uaix.site_release.v1",' +
        '"siteId":"tinyrustlm.com","version":"0.4.1"}' + "`n"
    $predecessorHistoryText = '{"canonicalOrigin":"https://tinyrustlm.com",' +
        '"releases":[' + $predecessorCurrentText.TrimEnd("`n") + '],' +
        '"schema":"uaix.site_release_history.v1",' +
        '"siteId":"tinyrustlm.com"}' + "`n"
    $predecessorCurrentBytes = $utf8.GetBytes($predecessorCurrentText)
    $predecessorHistoryBytes = $utf8.GetBytes($predecessorHistoryText)
    $predecessorExpected = [pscustomobject]@{
        predecessor_release_id = "tinyrustlm.com@0.4.1"
        predecessor_version = "0.4.1"
        predecessor_publication_id = "5" * 64
        predecessor_ledger_sha256 = "4" * 64
        pending_release_id = "tinyrustlm.com@0.5.0"
        pending_version = "0.5.0"
        current = [pscustomobject]@{
            relative_path = ".well-known/site-release.json"
            byte_count = $predecessorCurrentBytes.Length
            sha256 = Get-Utf8Sha256 -Value $predecessorCurrentText
            bytes = $predecessorCurrentBytes
        }
        history = [pscustomobject]@{
            relative_path = ".well-known/site-release-history.json"
            byte_count = $predecessorHistoryBytes.Length
            sha256 = Get-Utf8Sha256 -Value $predecessorHistoryText
            bytes = $predecessorHistoryBytes
        }
    }
    $syntheticHandler = [TinyRustLMSyntheticPublicHandler]::new(
        $predecessorCurrentBytes
    )
    $script:httpClient = [Net.Http.HttpClient]::new($syntheticHandler, $true)
    $script:publicOrigin = "https://tinyrustlm.com"
    try {
        [byte[]]$syntheticRead = Read-BoundedPublicArtifact `
            -RemotePath ".well-known/site-release.json" `
            -MaximumBytes 1024
        Assert-True (
            Test-ExactByteArray -Left $syntheticRead -Right $predecessorCurrentBytes
        ) "Synthetic cache-bypassed public bytes changed."
        Assert-True (
            $syntheticHandler.ObservedMethod -eq "GET" -and
            $syntheticHandler.ObservedUri -match
                '^https://tinyrustlm\.com/\.well-known/site-release\.json\?predecessor_readback=[0-9a-f]{32}$' -and
            $syntheticHandler.ObservedNoCache -and
            $syntheticHandler.ObservedNoStore -and
            $syntheticHandler.ObservedMaxAgeTicks -eq 0 -and
            $syntheticHandler.ObservedPragmaNoCache -and
            -not $syntheticHandler.ObservedAuthorization -and
            -not $syntheticHandler.ObservedCookie
        ) "Public predecessor request lost read-only cache-bypass custody."
    }
    finally {
        $script:httpClient.Dispose()
        $script:httpClient = $null
        $script:publicOrigin = $null
    }
    $global:SyntheticPublicArtifacts = @{
        ".well-known/site-release.json" = $predecessorCurrentBytes
        ".well-known/site-release-history.json" = $predecessorHistoryBytes
    }
    function global:Read-BoundedPublicArtifact {
        param([string]$RemotePath, [int]$MaximumBytes)
        [byte[]]$value = $global:SyntheticPublicArtifacts[$RemotePath]
        if (-not $value) {
            throw "Synthetic public artifact is unavailable."
        }
        return ,$value
    }
    try {
        $predecessorEvidence = Assert-PublicReleasePredecessor `
            -Expected $predecessorExpected `
            -PublicOrigin "https://tinyrustlm.com"
        Assert-True (
            $predecessorEvidence.status -eq "pass" -and
            $predecessorEvidence.predecessor_version -eq "0.4.1" -and
            $predecessorEvidence.predecessor_ledger_sha256 -eq ("4" * 64) -and
            $predecessorEvidence.pending_version -eq "0.5.0"
        ) "Public predecessor evidence changed."

        $global:SyntheticPublicArtifacts[".well-known/site-release.json"] =
            $utf8.GetBytes($predecessorCurrentText.Replace("0.4.1", "0.5.0"))
        Assert-Throws {
            Assert-PublicReleasePredecessor `
                -Expected $predecessorExpected `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "newer|predecessor"

        $global:SyntheticPublicArtifacts[".well-known/site-release.json"] =
            $utf8.GetBytes($predecessorCurrentText.Replace("tinyrustlm.com@0.4.1", "tinyrustlm.com@0.4.0"))
        Assert-Throws {
            Assert-PublicReleasePredecessor `
                -Expected $predecessorExpected `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "divergent|predecessor"

        $global:SyntheticPublicArtifacts[".well-known/site-release.json"] =
            $utf8.GetBytes("{not-json}`n")
        Assert-Throws {
            Assert-PublicReleasePredecessor `
                -Expected $predecessorExpected `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "JSON|malformed"

        $global:SyntheticPublicArtifacts[".well-known/site-release.json"] =
            [byte[]]::new((1024 * 1024) + 1)
        Assert-Throws {
            Assert-PublicReleasePredecessor `
                -Expected $predecessorExpected `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "byte limit|oversized"

        $global:SyntheticPublicArtifacts[".well-known/site-release.json"] =
            $predecessorCurrentBytes
        $global:SyntheticPublicArtifacts[".well-known/site-release-history.json"] =
            $utf8.GetBytes($predecessorHistoryText.Replace(("5" * 64), ("6" * 64)))
        Assert-Throws {
            Assert-PublicReleasePredecessor `
                -Expected $predecessorExpected `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "inconsistent|divergent|predecessor"

        $global:SyntheticPublicArtifacts[".well-known/site-release-history.json"] =
            $predecessorHistoryBytes
        $global:SyntheticPublicArtifacts[".well-known/site-release.json"] =
            $utf8.GetBytes($predecessorCurrentText.Replace("{", "{ "))
        Assert-Throws {
            Assert-PublicReleasePredecessor `
                -Expected $predecessorExpected `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "exact predecessor|diverge"
    }
    finally {
        Remove-Item `
            -LiteralPath Function:\global:Read-BoundedPublicArtifact `
            -Force
        Remove-Variable `
            -Name SyntheticPublicArtifacts `
            -Scope Global `
            -ErrorAction SilentlyContinue
    }

    $redirectResponse = [Net.Http.HttpResponseMessage]::new(
        [Net.HttpStatusCode]::Found
    )
    try {
        $redirectResponse.Headers.Location = [Uri]"https://example.invalid/newer"
        Assert-Throws {
            Read-BoundedPublicResponse `
                -Response $redirectResponse `
                -MaximumBytes 1024 | Out-Null
        } "HTTP 200|redirect"
    }
    finally {
        $redirectResponse.Dispose()
    }
    $workspaceMemory = Join-Path $root "deployment-memory-fixture.txt"
    [IO.File]::WriteAllText(
        $workspaceMemory,
        "deployment_ftp_credentials_file: $validProfile`n" +
            "deployment_ftps_host: example.com`n" +
            "deployment_ftps_port: 21`n" +
            "deployment_ftps_user: deployment-test@TinyRustLM.com`n" +
            "deployment_ftps_profile: TinyRustLM.com`n" +
            "deployment_site_identity: tinyrustlm.com`n" +
            "deployment_root_sentinel_path: " +
                ".well-known/tinyrustlm-deployment-target.v1.json`n" +
            "deployment_root_sentinel_sha256: $sentinelSha256`n",
        $utf8
    )

    $targetBinding = Get-WorkspaceDeploymentTargetBinding `
        -MemoryPath $workspaceMemory `
        -SourceRoot $sourceRoot
    $credentialProfile = Get-WorkspaceDeploymentCredentialProfile `
        -MemoryPath $workspaceMemory `
        -SourceRoot $sourceRoot `
        -TargetBinding $targetBinding
    Assert-DeploymentCredentialTarget `
        -CredentialProfile $credentialProfile `
        -TargetBinding $targetBinding
    Assert-True ($credentialProfile.host -eq "example.com") "Credential host changed."
    Assert-True ($credentialProfile.port -eq 21) "Credential port changed."
    Assert-True ($credentialProfile.user -ceq "deployment-test@TinyRustLM.com") "Full credential user changed."
    Assert-True ($credentialProfile.profile -eq "TinyRustLM.com") "Credential profile changed."
    Assert-True ($credentialProfile.password -ceq "test:password=value") "Credential password separators changed."
    $credentialProfile.password = $null

    $canonicalFixture = $canonicalRepositoryRoot
    $canonicalScriptRoot = Join-Path $canonicalFixture "tinyrustlm\tools"
    $wrongRepository = Join-Path $root "wrong-repository"
    [IO.Directory]::CreateDirectory($wrongRepository) | Out-Null
    $global:SyntheticGitTopLevel = $canonicalFixture
    function global:Get-DeploymentGitTopLevel {
        param([string]$RepositoryRoot)
        return $global:SyntheticGitTopLevel
    }
    try {
        $resolvedCanonical = Resolve-CanonicalDeploymentRepositoryRoot `
            -ScriptRoot $canonicalScriptRoot `
            -RequestedRepositoryRoot $canonicalFixture
        Assert-True (
            $resolvedCanonical -eq [IO.Path]::GetFullPath($canonicalFixture)
        ) "Canonical deployment repository identity changed."
        Assert-Throws {
            Resolve-CanonicalDeploymentRepositoryRoot `
                -ScriptRoot $canonicalScriptRoot `
                -RequestedRepositoryRoot $wrongRepository | Out-Null
        } "canonical repository root"

        $global:SyntheticGitTopLevel = $wrongRepository
        Assert-Throws {
            Resolve-CanonicalDeploymentRepositoryRoot `
                -ScriptRoot $canonicalScriptRoot `
                -RequestedRepositoryRoot $canonicalFixture | Out-Null
        } "canonical repository root"

        $canonicalJunction = Join-Path $root "canonical-repository-junction"
        try {
            New-Item `
                -ItemType Junction `
                -Path $canonicalJunction `
                -Target $canonicalFixture `
                -ErrorAction Stop | Out-Null
            $junctionScriptRoot = Join-Path $canonicalJunction "tinyrustlm\tools"
            $global:SyntheticGitTopLevel = $canonicalJunction
            Assert-Throws {
                Resolve-CanonicalDeploymentRepositoryRoot `
                    -ScriptRoot $junctionScriptRoot `
                    -RequestedRepositoryRoot $canonicalJunction | Out-Null
            } "non-reparse"
        }
        finally {
            if (Test-Path -LiteralPath $canonicalJunction) {
                [IO.Directory]::Delete($canonicalJunction)
            }
        }
    }
    finally {
        Remove-Item `
            -LiteralPath Function:\global:Get-DeploymentGitTopLevel `
            -Force
        Remove-Variable `
            -Name SyntheticGitTopLevel `
            -Scope Global `
            -ErrorAction SilentlyContinue
    }

    foreach ($field in @("host", "port", "user", "profile")) {
        $wrongCredential = [pscustomobject]@{
            host = $credentialProfile.host
            port = $credentialProfile.port
            user = $credentialProfile.user
            profile = $credentialProfile.profile
            password = "synthetic-password"
        }
        $wrongCredential.$field = switch ($field) {
            "host" { "wrong.example" }
            "port" { 22 }
            "user" { "wrong-user" }
            "profile" { "Wrong profile" }
        }
        Assert-Throws {
            Assert-DeploymentCredentialTarget `
                -CredentialProfile $wrongCredential `
                -TargetBinding $targetBinding
        } "configured deployment target"
        $wrongCredential.password = $null
    }

    $global:SyntheticSentinelBytes = $sentinelBytes
    $global:SyntheticSentinelReads = 0
    function global:Read-BoundedFtpsArtifact {
        param([string]$RemotePath, [int]$MaximumBytes)
        $global:SyntheticSentinelReads += 1
        return [byte[]]$global:SyntheticSentinelBytes
    }
    try {
        $targetEvidence = Assert-DeploymentTargetIdentity `
            -TargetBinding $targetBinding `
            -PublicOrigin "https://tinyrustlm.com"
        Assert-True (
            $targetEvidence.status -eq "pass" -and
            $targetEvidence.site_identity -eq "tinyrustlm.com" -and
            $targetEvidence.sentinel_sha256 -eq $sentinelSha256 -and
            $global:SyntheticSentinelReads -eq 1
        ) "Read-only deployment root identity changed."

        $global:SyntheticSentinelBytes = $utf8.GetBytes(
            $sentinelText.Replace("tinyrustlm.com", "wrong.example")
        )
        Assert-Throws {
            Assert-DeploymentTargetIdentity `
                -TargetBinding $targetBinding `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "sentinel"

        $wrongSentinelText = $sentinelText.Replace(
            '"site_identity":"tinyrustlm.com"',
            '"site_identity":"wrong.example"'
        )
        $global:SyntheticSentinelBytes = $utf8.GetBytes($wrongSentinelText)
        $wrongIdentityBinding = [pscustomobject]@{
            profile = $targetBinding.profile
            host = $targetBinding.host
            port = $targetBinding.port
            user = $targetBinding.user
            site_identity = $targetBinding.site_identity
            sentinel_path = $targetBinding.sentinel_path
            sentinel_sha256 = Get-Utf8Sha256 -Value $wrongSentinelText
        }
        Assert-Throws {
            Assert-DeploymentTargetIdentity `
                -TargetBinding $wrongIdentityBinding `
                -PublicOrigin "https://tinyrustlm.com" | Out-Null
        } "site identity"
    }
    finally {
        Remove-Item `
            -LiteralPath Function:\global:Read-BoundedFtpsArtifact `
            -Force
        Remove-Variable `
            -Name SyntheticSentinelBytes `
            -Scope Global `
            -ErrorAction SilentlyContinue
        Remove-Variable `
            -Name SyntheticSentinelReads `
            -Scope Global `
            -ErrorAction SilentlyContinue
    }

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

    $leasePath = Join-Path $root "tinyrustlm.com.deployment-lease.v1.json"
    $lease = New-ExclusiveDeploymentLease `
        -LeasePath $leasePath `
        -AttemptId "20260831T1200000000000Z-0123456789ab" `
        -ReleaseId "tinyrustlm.com@0.5.0" `
        -SourceCommit ("1" * 40) `
        -ToolClosureSha256 ("2" * 64)
    Assert-True (
        (Test-Path -LiteralPath $leasePath -PathType Leaf) -and
        [string]$lease.lease_id -match "^[0-9a-f]{32}$" -and
        [string]$lease.coordination_scope -eq "single-host-canonical-artifacts" -and
        $lease.remote_global_exclusion_proven -eq $false
    ) "Local deployment guard was not created with an exact bounded identity."
    Assert-Throws {
        New-ExclusiveDeploymentLease `
            -LeasePath $leasePath `
            -AttemptId "20260831T1200000000000Z-fedcba987654" `
            -ReleaseId "tinyrustlm.com@0.5.0" `
            -SourceCommit ("1" * 40) `
            -ToolClosureSha256 ("2" * 64) | Out-Null
    } "lease.*(?:active|residue|exists)|exclusive"
    Assert-True (
        (Test-Path -LiteralPath $leasePath -PathType Leaf)
    ) "A concurrent lease attempt removed the active lease."
    $leaseCleanup = Remove-ExclusiveDeploymentLease -Lease $lease
    Assert-True (
        $leaseCleanup.cleanup_verified -and
        -not (Test-Path -LiteralPath $leasePath)
    ) "Identity-bound lease cleanup did not complete."
    [IO.File]::WriteAllText($leasePath, "crash-residue`n", $utf8)
    Assert-Throws {
        New-ExclusiveDeploymentLease `
            -LeasePath $leasePath `
            -AttemptId "20260831T1200000000000Z-aaaaaaaaaaaa" `
            -ReleaseId "tinyrustlm.com@0.5.0" `
            -SourceCommit ("1" * 40) `
            -ToolClosureSha256 ("2" * 64) | Out-Null
    } "lease.*(?:active|residue|exists)|exclusive"
    Assert-True (
        [IO.File]::ReadAllText($leasePath, $utf8) -eq "crash-residue`n"
    ) "Crash residue was guessed stale or rewritten."
    [IO.File]::Delete($leasePath)

    $publicationPlan = Get-DeploymentPublicationPlan -Entries @(
        [pscustomobject]@{ remote = "app/app.js" }
        [pscustomobject]@{ remote = ".well-known/site-release-history.json" }
        [pscustomobject]@{ remote = ".well-known/site-release.json" }
    )
    Assert-True (
        @($publicationPlan.regular).Count -eq 2 -and
        [string]$publicationPlan.commit_marker.remote -eq
            ".well-known/site-release.json"
    ) "Publication plan did not isolate one final commit marker."
    Assert-Throws {
        Get-DeploymentPublicationPlan -Entries @(
            [pscustomobject]@{ remote = ".well-known/site-release.json" }
            [pscustomobject]@{ remote = "app/app.js" }
        ) | Out-Null
    } "commit marker.*final|publication plan"

    $validationOperationRoot = Join-Path $root (
        "tinyrustlm-web-validation-{0}" -f ("3" * 32)
    )
    $validationMaterialization = New-OwnedValidationMaterialization `
        -OperationRoot $validationOperationRoot `
        -SourceRoot $canonicalRepositoryRoot `
        -OperationId ("3" * 32)
    $validationWellKnown = Join-Path $validationMaterialization.release_root ".well-known"
    [IO.Directory]::CreateDirectory($validationWellKnown) | Out-Null
    [IO.File]::WriteAllText(
        (Join-Path $validationWellKnown "site-release-history.json"),
        "{}`n",
        $utf8
    )
    [IO.File]::WriteAllText(
        (Join-Path $validationWellKnown "site-release.json"),
        "{}`n",
        $utf8
    )
    $validationCleanup = Remove-OwnedValidationMaterialization `
        -Materialization $validationMaterialization
    Assert-True (
        $validationCleanup.cleanup_verified -and
        -not (Test-Path -LiteralPath $validationOperationRoot)
    ) "Owned validation materialization cleanup did not complete."

    $hostileValidationRoot = Join-Path $root (
        "tinyrustlm-web-validation-{0}" -f ("4" * 32)
    )
    $hostileValidation = New-OwnedValidationMaterialization `
        -OperationRoot $hostileValidationRoot `
        -SourceRoot $canonicalRepositoryRoot `
        -OperationId ("4" * 32)
    [IO.File]::WriteAllText(
        (Join-Path $hostileValidation.release_root "unexpected.txt"),
        "unexpected`n",
        $utf8
    )
    Assert-Throws {
        Remove-OwnedValidationMaterialization `
            -Materialization $hostileValidation | Out-Null
    } "inventory|unexpected|undeclared"
    Assert-True (
        (Test-Path -LiteralPath (
            (Join-Path $hostileValidation.release_root "unexpected.txt")
        ))
    ) "Hostile validation cleanup mutated an unverified inventory."

    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
        $reparseValidationRoot = Join-Path $root (
            "tinyrustlm-web-validation-{0}" -f ("5" * 32)
        )
        $reparseValidation = New-OwnedValidationMaterialization `
            -OperationRoot $reparseValidationRoot `
            -SourceRoot $canonicalRepositoryRoot `
            -OperationId ("5" * 32)
        $reparseTarget = Join-Path $root "validation-reparse-target"
        [IO.Directory]::CreateDirectory($reparseTarget) | Out-Null
        $reparseSentinel = Join-Path $reparseTarget "sentinel.txt"
        [IO.File]::WriteAllText($reparseSentinel, "do-not-delete`n", $utf8)
        $validationJunction = Join-Path $reparseValidation.release_root ".well-known"
        New-Item `
            -ItemType Junction `
            -Path $validationJunction `
            -Target $reparseTarget | Out-Null
        Assert-Throws {
            Remove-OwnedValidationMaterialization `
                -Materialization $reparseValidation | Out-Null
        } "reparse|unsafe"
        Assert-True (
            (Test-Path -LiteralPath $reparseSentinel -PathType Leaf)
        ) "Reparse-hostile cleanup mutated an external target."
        [IO.Directory]::Delete($validationJunction)
        $reparseCleanup = Remove-OwnedValidationMaterialization `
            -Materialization $reparseValidation
        Assert-True (
            $reparseCleanup.cleanup_verified -and
            (Test-Path -LiteralPath $reparseSentinel -PathType Leaf)
        ) "Owned validation cleanup did not recover after safe junction removal."
    }

    # Read the real tool closure; Git/child-process observations are synthetic in memory.
    $custodyRepository = $canonicalRepositoryRoot
    $custodyPublisher = $deploymentScript
    $custodyEntry = Join-Path $canonicalRepositoryRoot "tinyrustlm\tools\web-deployment-manifest.js"
    $custodyVerifier = Join-Path $canonicalRepositoryRoot "tinyrustlm\tools\verify-single-source-authority.js"
    $custodyEntries = @(
        $custodyEntry,
        $custodyVerifier,
        (Join-Path $canonicalRepositoryRoot "tinyrustlm\tools\site-release-contract.js"),
        (Join-Path $canonicalRepositoryRoot "tinyrustlm\tools\web-release-secret-scan.js")
    )
    $custodyPolicyRelative = "contracts/storage/retired-storage-roots-2026-09-12.json"
    $custodyPolicyPath = Join-Path $canonicalRepositoryRoot $custodyPolicyRelative
    $realProcess = (Get-Item Function:\Invoke-PinnedDeploymentProcess).ScriptBlock
    $global:CustodyStatus = @()
    $global:CustodyHead = "1" * 40
    $global:CustodyDriftAfterNode = $false
    $global:CustodyNodeExit = 0
    function global:Invoke-PinnedDeploymentProcess {
        param([object]$Executable, [string[]]$Arguments, [string]$WorkingDirectory)
        if ($Arguments -contains "status") {
            return [pscustomobject]@{ exit_code = 0; stdout_lines = @($global:CustodyStatus) }
        }
        if ($Arguments -contains "rev-parse") {
            return [pscustomobject]@{ exit_code = 0; stdout_lines = @($global:CustodyHead) }
        }
        if ($Arguments -contains "ls-files") {
            return [pscustomobject]@{ exit_code = 0; stdout_lines = @($Arguments[-1]) }
        }
        if ($global:CustodyDriftAfterNode) { $global:CustodyStatus = @("?? observed-drift") }
        return [pscustomobject]@{ exit_code = $global:CustodyNodeExit; stdout_lines = @('{"status":"pass"}') }
    }
    try {
        $custody = New-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
            -PublisherPath $custodyPublisher -NodeToolPaths $custodyEntries
        Assert-True ([int]$custody.tool_file_count -gt 3 -and
            @($custody.files | Where-Object { $_.relative_path -eq
                "tinyrustlm/tools/canonical-operation-scratch.js" }).Count -eq 1
        ) "Source custody did not seal the real transitive Node closure."
        $custodyPolicyRows = @($custody.files | Where-Object {
            [string]$_.relative_path -ceq $custodyPolicyRelative
        })
        Assert-True (
            $custodyPolicyRows.Count -eq 1 -and
            [int64]$custodyPolicyRows[0].byte_count -eq
                [int64](Get-Item -LiteralPath $custodyPolicyPath -Force).Length -and
            [string]$custodyPolicyRows[0].sha256 -ceq
                (Get-FileSha256 -Path $custodyPolicyPath)
        ) "Source custody omitted the verifier's exact storage policy JSON dependency."
        Assert-Throws { Get-DeploymentNodeToolClosure -RepositoryRoot $custodyRepository `
            -EntryPaths @((Join-Path $custodyRepository `
                "contracts\vnext\template2-format-profile.v1.json")) | Out-Null
        } "custody path is invalid"
        Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository -Custody $custody | Out-Null
        foreach ($badRoot in @($root, "E:\TinyRustLM-vnext-tools", "relative")) {
            Assert-Throws { New-DeploymentSourceCustody -RepositoryRoot $badRoot `
                -PublisherPath $custodyPublisher -NodeToolPaths $custodyEntries | Out-Null
            } "canonical repository root"
            Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $badRoot `
                -Custody $custody | Out-Null } "canonical repository root"
        }
        foreach ($badPath in @("tinyrustlm/tools/../app/release.js",
            "tinyrustlm/tools/../../../outside.js", "tinyrustlm/tools//entry.js")) {
            $changed = $custody | ConvertTo-Json -Depth 10 | ConvertFrom-Json
            $changed.files[0].relative_path = $badPath
            Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
                -Custody $changed | Out-Null } "custody path is invalid"
        }
        $changed = $custody | ConvertTo-Json -Depth 10 | ConvertFrom-Json
        $changed.files[0].sha256 = "0" * 64
        Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
            -Custody $changed | Out-Null } "tool hash changed"
        foreach ($identityField in @("byte_count", "sha256")) {
            $changed = $custody | ConvertTo-Json -Depth 10 | ConvertFrom-Json
            $changedPolicy = @($changed.files | Where-Object {
                [string]$_.relative_path -ceq $custodyPolicyRelative
            })[0]
            if ($identityField -eq "byte_count") {
                $changedPolicy.byte_count = [int64]$changedPolicy.byte_count + 1
            }
            else {
                $changedPolicy.sha256 = "0" * 64
            }
            Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
                -Custody $changed | Out-Null } "tool hash changed"
        }
        foreach ($badPolicyPath in @(
            "contracts/vnext/template2-format-profile.v1.json",
            "contracts/storage/../vnext/template2-format-profile.v1.json",
            "contracts/storage/retired-storage-roots-2026-09-12.js",
            "tinyrustlm/tools/retired-storage-roots-2026-09-12.json"
        )) {
            $changed = $custody | ConvertTo-Json -Depth 10 | ConvertFrom-Json
            $changedPolicy = @($changed.files | Where-Object {
                [string]$_.relative_path -ceq $custodyPolicyRelative
            })[0]
            $changedPolicy.relative_path = $badPolicyPath
            Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
                -Custody $changed | Out-Null } "custody path is invalid"
        }
        $changed = $custody | ConvertTo-Json -Depth 10 | ConvertFrom-Json
        $changed.tool_closure_sha256 = "0" * 64
        Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
            -Custody $changed | Out-Null } "closure changed"
        $global:CustodyStatus = @("?? observed-untracked-input")
        Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
            -Custody $custody | Out-Null } "source custody changed"
        $global:CustodyStatus = @()
        $global:CustodyHead = "2" * 40
        Assert-Throws { Assert-DeploymentSourceCustody -RepositoryRoot $custodyRepository `
            -Custody $custody | Out-Null } "source custody changed"
        $global:CustodyHead = "1" * 40
        $output = @(Invoke-CustodiedNodeTool -RepositoryRoot $custodyRepository `
            -Custody $custody -ToolPath $custodyEntry -Arguments @())
        Assert-True ($output.Count -eq 1 -and $output[0] -eq '{"status":"pass"}'
        ) "Custodied invocation lost its observed output."
        Assert-Throws { Invoke-CustodiedNodeTool -RepositoryRoot $custodyRepository `
            -Custody $custody -ToolPath (Join-Path $custodyRepository `
                "contracts\storage\retired-storage-roots-2026-09-12.json") -Arguments @() | Out-Null
        } "outside deployment source custody"
        $global:CustodyNodeExit = 1
        Assert-Throws { Invoke-CustodiedNodeTool -RepositoryRoot $custodyRepository `
            -Custody $custody -ToolPath $custodyEntry -Arguments @() | Out-Null
        } "Custodied Node tool failed"
        $global:CustodyNodeExit = 0
        $global:CustodyDriftAfterNode = $true
        Assert-Throws { Invoke-CustodiedNodeTool -RepositoryRoot $custodyRepository `
            -Custody $custody -ToolPath $custodyEntry -Arguments @() | Out-Null
        } "source custody changed"
    }
    finally {
        Set-Item Function:\global:Invoke-PinnedDeploymentProcess -Value $realProcess
        foreach ($name in @("CustodyStatus", "CustodyHead", "CustodyDriftAfterNode", "CustodyNodeExit")) {
            Remove-Variable -Name $name -Scope Global -ErrorAction SilentlyContinue
        }
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
    $global:FalsePositiveListObservation = 0
    $originalTestRemoteFileAbsent = (Get-Command Test-RemoteFileAbsent).ScriptBlock
    function global:Test-RemoteFileAbsent {
        param([string]$RemotePath)
        $global:FalsePositiveListObservation += 1
        return $global:FalsePositiveListObservation -gt 1
    }
    try {
        Assert-Throws {
            Get-RemoteSize -RemotePath "app/models/fresh-nonce.json" | Out-Null
        } "positive SIZE contradicted the parent LIST inventory|ambiguous"
        Set-Item `
            -Path Function:\global:Test-RemoteFileAbsent `
            -Value {
                param([string]$RemotePath)
                return $true
            }
        Assert-Throws {
            Get-RemoteSize -RemotePath "app/models/list-omission.json" | Out-Null
        } "positive SIZE contradicted the parent LIST inventory|ambiguous"
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Set-Item `
            -Path Function:\global:Test-RemoteFileAbsent `
            -Value $originalTestRemoteFileAbsent
        Remove-Variable -Name FalsePositiveListObservation -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name FalsePositiveSizeResponse -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name FalsePositiveSizeRequest -Scope Global -ErrorAction SilentlyContinue
    }

    $global:UnavailableSizeRequest = [pscustomobject]@{}
    $global:UnavailableSizeRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
        throw "synthetic FTP 550"
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        return $global:UnavailableSizeRequest
    }
    $originalTestRemoteFileAbsent = (Get-Command Test-RemoteFileAbsent).ScriptBlock
    $originalTestFtpFileUnavailable = (Get-Command Test-FtpFileUnavailable).ScriptBlock
    function global:Test-RemoteFileAbsent {
        param([string]$RemotePath)
        return $false
    }
    function global:Test-FtpFileUnavailable {
        param([Exception]$Exception)
        return $true
    }
    try {
        Assert-Throws {
            Get-RemoteSize -RemotePath "app/ftp-550.js" | Out-Null
        } "FTP 550 cannot prove remote-file absence|ambiguous"
        Set-Item `
            -Path Function:\global:Test-RemoteFileAbsent `
            -Value {
                param([string]$RemotePath)
                return $true
            }
        $verifiedAbsentSize = Get-RemoteSize -RemotePath "app/verified-absent.js"
        Assert-True (
            $verifiedAbsentSize -eq -1
        ) "Stable LIST omission plus SIZE 550 did not produce bounded absence."
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Set-Item `
            -Path Function:\global:Test-RemoteFileAbsent `
            -Value $originalTestRemoteFileAbsent
        Set-Item `
            -Path Function:\global:Test-FtpFileUnavailable `
            -Value $originalTestFtpFileUnavailable
        Remove-Variable -Name UnavailableSizeRequest -Scope Global -ErrorAction SilentlyContinue
    }

    $global:UnavailableListRequest = [pscustomobject]@{}
    $global:UnavailableListRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
        throw "synthetic inaccessible parent listing"
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        return $global:UnavailableListRequest
    }
    $originalTestFtpFileUnavailable = (Get-Command Test-FtpFileUnavailable).ScriptBlock
    function global:Test-FtpFileUnavailable {
        param([Exception]$Exception)
        return $true
    }
    try {
        Assert-Throws {
            Test-RemoteFileAbsent -RemotePath "app/inaccessible.js" | Out-Null
        } "FTP 550 cannot prove remote-file absence|ambiguous|inaccessible"
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Set-Item `
            -Path Function:\global:Test-FtpFileUnavailable `
            -Value $originalTestFtpFileUnavailable
        Remove-Variable -Name UnavailableListRequest -Scope Global -ErrorAction SilentlyContinue
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

    if (-not ("System.Net.InternalException" -as [type])) {
        Add-Type -TypeDefinition @'
namespace System.Net {
    public sealed class InternalException : System.Exception {
        public InternalException(string message) : base(message) {}
    }
}
'@
    }
    $global:TransientDeleteAttempt = 0
    $global:TransientDeleteAbsent = $false
    $global:TransientDeleteResponse = [pscustomobject]@{}
    $global:TransientDeleteResponse | Add-Member -MemberType ScriptMethod -Name Dispose -Value {}
    $global:TransientDeleteRequest = [pscustomobject]@{}
    $global:TransientDeleteRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
        $global:TransientDeleteAttempt += 1
        if ($global:TransientDeleteAttempt -le 2) {
            throw [System.Net.InternalException]::new("simulated internal FTPS cleanup failure")
        }
        $global:TransientDeleteAbsent = $true
        return $global:TransientDeleteResponse
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        return $global:TransientDeleteRequest
    }
    function global:Test-RemoteFileAbsent {
        param([string]$RemotePath)
        return $global:TransientDeleteAbsent
    }
    function global:Start-Sleep {
        param([int]$Milliseconds)
    }
    try {
        Remove-RemoteFile -RemotePath "app/deploy-retry-stage.slm"
        Assert-True (
            $global:TransientDeleteAttempt -eq 3 -and
            $global:TransientDeleteAbsent
        ) "An internal FTPS cleanup failure was not reconciled within the bound."

        $global:TransientDeleteAttempt = 0
        $global:TransientDeleteAbsent = $false
        $global:TransientDeleteRequest.PSObject.Members.Remove("GetResponse")
        $global:TransientDeleteRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
            $global:TransientDeleteAttempt += 1
            throw [Net.WebException]::new(
                "simulated cleanup trust failure",
                [Net.WebExceptionStatus]::TrustFailure
            )
        }
        Assert-Throws {
            Remove-RemoteFile -RemotePath "app/deploy-trust-stage.slm"
        } "simulated cleanup trust failure"
        Assert-True (
            $global:TransientDeleteAttempt -eq 1
        ) "A nonretryable FTPS cleanup failure was retried."

        $global:TransientDeleteAttempt = 0
        $global:TransientDeleteRequest.PSObject.Members.Remove("GetResponse")
        $global:TransientDeleteRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
            $global:TransientDeleteAttempt += 1
            throw [Net.WebException]::new(
                "simulated exhausted cleanup failure",
                [Net.WebExceptionStatus]::ServerProtocolViolation
            )
        }
        Assert-Throws {
            Remove-RemoteFile -RemotePath "app/deploy-exhausted-stage.slm"
        } "simulated exhausted cleanup failure"
        Assert-True (
            $global:TransientDeleteAttempt -eq 4
        ) "A transient FTPS cleanup escaped its four-attempt bound."

        $global:TransientDeleteAttempt = 0
        $global:TransientDeleteAbsent = $true
        $global:TransientDeleteRequest.PSObject.Members.Remove("GetResponse")
        $global:TransientDeleteRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
            $global:TransientDeleteAttempt += 1
            throw [Net.WebException]::new(
                "simulated ambiguous committed cleanup",
                [Net.WebExceptionStatus]::TrustFailure
            )
        }
        Remove-RemoteFile -RemotePath "app/deploy-committed-stage.slm"
        Assert-True (
            $global:TransientDeleteAttempt -eq 1
        ) "A committed cleanup was not accepted from authoritative absence proof."
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Remove-Item -LiteralPath Function:\global:Test-RemoteFileAbsent -Force
        Remove-Item -LiteralPath Function:\global:Start-Sleep -Force
        Remove-Variable -Name TransientDeleteAttempt -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name TransientDeleteAbsent -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name TransientDeleteResponse -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name TransientDeleteRequest -Scope Global -ErrorAction SilentlyContinue
    }

    $global:RenameObservation = 0
    $global:RenameRequest = [pscustomobject]@{ RenameTo = $null }
    $global:RenameRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
        throw [Net.WebException]::new(
            "simulated ambiguous rename response",
            [Net.WebExceptionStatus]::ServerProtocolViolation
        )
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        return $global:RenameRequest
    }
    function global:Get-RemoteSize {
        param([string]$RemotePath)
        if ($RemotePath -eq "app/deploy-late-stage.slm") {
            $global:RenameObservation += 1
            if ($global:RenameObservation -lt 3) { return [int64]41 }
            return [int64]-1
        }
        if ($RemotePath -eq "app/release.js") {
            if ($global:RenameObservation -lt 3) { return [int64]-1 }
            return [int64]41
        }
        return [int64]-1
    }
    function global:Get-FtpsArtifactIdentity {
        param([string]$RemotePath, [int64]$ExpectedBytes)
        $object = $global:FakeRemoteObjects[$RemotePath]
        if (-not $object -or $object.bytes -ne $ExpectedBytes) { throw "synthetic predecessor length mismatch" }
        return [pscustomobject]@{ bytes = $object.bytes; sha256 = $object.sha256 }
    }
    function global:Start-Sleep {
        param([int]$Milliseconds)
    }
    try {
        Rename-RemoteFile `
            -RemotePath "app/deploy-late-stage.slm" `
            -NewLeafName "release.js"
        Assert-True (
            $global:RenameObservation -eq 3 -and
            $global:RenameRequest.RenameTo -eq "release.js"
        ) "An ambiguous committed rename was not reconciled without repeating the mutation."

        $global:RenameObservation = 0
        function global:Get-RemoteSize {
            param([string]$RemotePath)
            if ($RemotePath -eq "app/deploy-late-stage.slm") {
                $global:RenameObservation += 1
                return [int64]41
            }
            return [int64]-1
        }
        Assert-Throws {
            Rename-RemoteFile `
                -RemotePath "app/deploy-late-stage.slm" `
                -NewLeafName "release.js"
        } "simulated ambiguous rename response"
        Assert-True (
            $global:RenameObservation -eq 8
        ) "An uncommitted rename escaped its bounded reconciliation window."
    }
    finally {
        Remove-Item -LiteralPath Function:\global:New-FtpRequest -Force
        Remove-Item -LiteralPath Function:\global:Get-RemoteSize -Force
        Remove-Item -LiteralPath Function:\global:Start-Sleep -Force
        Remove-Variable -Name RenameObservation -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name RenameRequest -Scope Global -ErrorAction SilentlyContinue
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

    $duplicateProfile = Join-Path $profileRoot "duplicate.txt"
    [IO.File]::WriteAllText(
        $duplicateProfile,
        ($validText + "`n" + $validText),
        $utf8
    )
    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath $duplicateProfile `
            -SourceRoot $sourceRoot `
            -ExpectedProfileName "TinyRustLM.com" | Out-Null
    } "exactly one configured deployment site"

    $malformedProfile = Join-Path $profileRoot "malformed.txt"
    foreach ($badText in @(
        '<FileZilla3><Servers /></FileZilla3>',
        ($validText + "`nPassword: duplicate"),
        $validText.Replace('FTP server: example.com', 'Unexpected: example.com'),
        $validText.Replace('FTP server: example.com', ''),
        ($validText -replace '(?m)^Username: deployment-test\r?$', 'Username: other'),
        $validText.Replace('port: 21', 'port: 65536'),
        $validText.Replace('port: 21', 'port: -1'),
        $validText.Replace('example.com', 'https://example.com'),
        $validText.Replace('TinyRustLM.com', 'TinyRustLM.com.evil.invalid'),
        $validText.Replace('test:password=value', ''),
        $validText.Replace('test:password=value', ('x' * 4097)),
        $validText.Replace('test:password=value', ("secret" + [char]0)),
        ('x' * 65537)
    )) {
        [IO.File]::WriteAllText($malformedProfile, $badText, $utf8)
        Assert-Throws {
            Get-DeploymentCredentialProfile -ProfilePath $malformedProfile `
                -SourceRoot $sourceRoot -ExpectedProfileName 'TinyRustLM.com' | Out-Null
        } 'FTP'
    }
    [IO.File]::WriteAllBytes($malformedProfile, [byte[]]@(0xff, 0xfe, 0xff))
    Assert-Throws {
        Get-DeploymentCredentialProfile -ProfilePath $malformedProfile `
            -SourceRoot $sourceRoot -ExpectedProfileName 'TinyRustLM.com' | Out-Null
    } 'UTF-8'
    [IO.File]::WriteAllText($malformedProfile, '', $utf8)
    Assert-Throws {
        Get-DeploymentCredentialProfile -ProfilePath $malformedProfile `
            -SourceRoot $sourceRoot -ExpectedProfileName 'TinyRustLM.com' | Out-Null
    } 'bounded regular file'
    foreach ($newline in @("`n", "`r`n")) {
        $multiSite = $validText.Replace('TinyRustLM.com', 'MiniModel.org') + "`n`n" + $validText
        $multiSite = ($multiSite -replace "`r?`n", $newline)
        [IO.File]::WriteAllText($malformedProfile, $multiSite, [Text.UTF8Encoding]::new($true))
        $selected = Get-DeploymentCredentialProfile -ProfilePath $malformedProfile `
            -SourceRoot $sourceRoot -ExpectedProfileName 'tinyrustlm.com'
        Assert-True ($selected.user -ceq 'deployment-test@TinyRustLM.com') 'Selected wrong account.'
        Assert-True ($selected.password -ceq 'test:password=value') 'Password changed.'
        $selected.password = $null
    }
    Assert-Throws {
        Get-DeploymentCredentialProfile -ProfilePath $validProfile `
            -SourceRoot $sourceRoot -ExpectedProfileName 'absent.example' | Out-Null
    } 'exactly one'
    Assert-Throws {
        Get-DeploymentCredentialProfile -ProfilePath $validProfile `
            -SourceRoot $sourceRoot -ExpectedProfileName 'https://tinyrustlm.com' | Out-Null
    } 'DNS name'

    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath "relative-profile.txt" `
            -SourceRoot $sourceRoot `
            -ExpectedProfileName "TinyRustLM.com" | Out-Null
    } "must be absolute"

    $insideSourceProfile = Join-Path $sourceRoot "ftp.txt"
    [IO.File]::WriteAllText($insideSourceProfile, $validText, $utf8)
    Assert-Throws {
        Get-DeploymentCredentialProfile `
            -ProfilePath $insideSourceProfile `
            -SourceRoot $sourceRoot `
            -ExpectedProfileName "TinyRustLM.com" | Out-Null
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
                -ProfilePath (Join-Path $profileJunction "ftp.txt") `
                -SourceRoot $sourceRoot `
                -ExpectedProfileName "TinyRustLM.com" | Out-Null
        } "ancestry is unsafe"
    }
    finally {
        if (Test-Path -LiteralPath $profileJunction) {
            [IO.Directory]::Delete($profileJunction)
        }
    }

    $resolvedReportPath = Resolve-NewDeploymentReportPath `
        -Path (Join-Path $profileRoot "deployment-report.json") `
        -SourceRoot $canonicalRepositoryRoot
    Assert-True (
        $resolvedReportPath -eq (Join-Path $profileRoot "deployment-report.json")
    ) "Canonical deployment report path changed."
    Assert-Throws {
        Resolve-NewDeploymentReportPath `
            -Path "relative-report.json" `
            -SourceRoot $canonicalRepositoryRoot | Out-Null
    } "must be absolute"
    Assert-Throws {
        Resolve-NewDeploymentReportPath `
            -Path (Join-Path $canonicalRepositoryRoot "deployment-report.json") `
            -SourceRoot $canonicalRepositoryRoot | Out-Null
    } "canonical project artifacts"
    Assert-Throws {
        Resolve-NewDeploymentReportPath `
            -Path (Join-Path $profileRoot "deployment-report.txt") `
            -SourceRoot $canonicalRepositoryRoot | Out-Null
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
                -SourceRoot $canonicalRepositoryRoot | Out-Null
        } "Deployment output ancestry must contain ordinary directories"
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

    $global:RetiredBridgePresent = $true
    $global:RetiredBridgeHttpsStatus = 404
    $global:RetiredBridgeSizeReads = 0
    function global:Get-RemoteSize {
        param([string]$RemotePath)
        if ($RemotePath -ne "app/companion-bridge.js") {
            throw "unexpected retirement path"
        }
        $global:RetiredBridgeSizeReads += 1
        if ($global:RetiredBridgePresent) {
            return [int64]31
        }
        return [int64]-1
    }
    function global:Remove-RemoteFile {
        param([string]$RemotePath)
        if ($RemotePath -ne "app/companion-bridge.js") {
            throw "unexpected retirement path"
        }
        $global:RetiredBridgePresent = $false
    }
    function global:Test-HttpsMissing {
        param([string]$RemotePath)
        $script:lastHttpsMissingObservation = [pscustomobject]@{
            request_succeeded = $true
            status_code = $global:RetiredBridgeHttpsStatus
            error_identity = $null
        }
        return $global:RetiredBridgeHttpsStatus -eq 404
    }
    function global:Start-Sleep {
        param([int]$Milliseconds)
    }
    try {
        $retiredBridge = Remove-PublicArtifact `
            -RemotePath "app/companion-bridge.js"
        Assert-True (
            $retiredBridge.status -eq "removed" -and
            $retiredBridge.ftps_absent -and
            $retiredBridge.https_status -eq 404 -and
            $global:RetiredBridgeSizeReads -eq 2
        ) "Retired companion bridge did not prove authenticated absence and HTTPS 404."

        $global:RetiredBridgePresent = $false
        $global:RetiredBridgeHttpsStatus = 200
        Assert-Throws {
            Remove-PublicArtifact `
                -RemotePath "app/companion-bridge.js" | Out-Null
        } "did not return HTTP 404"
    }
    finally {
        foreach ($functionName in @(
            "Get-RemoteSize"
            "Remove-RemoteFile"
            "Test-HttpsMissing"
            "Start-Sleep"
        )) {
            Remove-Item -LiteralPath ("Function:\global:{0}" -f $functionName) -Force
        }
        foreach ($variableName in @(
            "RetiredBridgePresent"
            "RetiredBridgeHttpsStatus"
            "RetiredBridgeSizeReads"
        )) {
            Remove-Variable `
                -Name $variableName `
                -Scope Global `
                -ErrorAction SilentlyContinue
        }
    }

    # Exercise real staging functions against memory-only transport observations.
    $global:StagingStream = [IO.MemoryStream]::new()
    $global:StagingCalls = [Collections.Generic.List[string]]::new()
    $global:StagingVerificationFailures = 0
    $global:StagingRequest = $null
    function global:Get-RemoteSize {
        param([string]$RemotePath)
        $global:StagingCalls.Add("size:$RemotePath")
        return [int64]$global:StagingStream.ToArray().LongLength
    }
    function global:Remove-RemoteFile {
        param([string]$RemotePath)
        $global:StagingCalls.Add("remove:$RemotePath")
        $global:StagingStream.Dispose()
        $global:StagingStream = [IO.MemoryStream]::new()
    }
    function global:Write-RemoteChunk {
        param([string]$RemotePath, [byte[]]$Bytes, [bool]$Append)
        $global:StagingCalls.Add("chunk:$RemotePath")
        if (-not $Append) { $global:StagingStream.SetLength(0) }
        $global:StagingStream.Position = $global:StagingStream.Length
        $global:StagingStream.Write($Bytes, 0, $Bytes.Length)
    }
    function global:New-FtpRequest {
        param([string]$RemotePath, [string]$Method)
        $global:StagingCalls.Add("request:$RemotePath")
        $global:StagingRequest = [pscustomobject]@{ ContentLength = [int64]0; Method = $Method }
        $global:StagingRequest | Add-Member -MemberType ScriptMethod -Name GetRequestStream -Value {
            return $global:StagingStream
        }
        $global:StagingRequest | Add-Member -MemberType ScriptMethod -Name GetResponse -Value {
            return [IO.MemoryStream]::new()
        }
        return $global:StagingRequest
    }
    function global:Test-RemoteArtifact {
        param([string]$RemotePath, [int64]$ExpectedBytes, [string]$ExpectedSha256,
            [switch]$AuthenticatedOnly)
        $global:StagingCalls.Add("verify:$RemotePath")
        Assert-True $AuthenticatedOnly.IsPresent "Stage verification used the public route."
        if ($global:StagingVerificationFailures -gt 0) {
            $global:StagingVerificationFailures -= 1
            return $false
        }
        $observed = $global:StagingStream.ToArray()
        return $observed.LongLength -eq $ExpectedBytes -and
            (Get-ByteArraySha256 -Bytes $observed) -eq $ExpectedSha256
    }
    function global:Start-Sleep {
        param([int]$Milliseconds, [int]$Seconds)
    }
    try {
        $smallPayload = [byte[]]::new(16411)
        [Random]::new(20260919).NextBytes($smallPayload)
        $stagePath = "app/deploy-synthetic-stage.slm"
        $smallSha256 = Get-ByteArraySha256 -Bytes $smallPayload
        foreach ($invalid in @(
            @{ Payload = $smallPayload; ExpectedBytes = 1; ExpectedSha256 = $smallSha256 },
            @{ Payload = $smallPayload; ExpectedBytes = $smallPayload.Length; ExpectedSha256 = ("0" * 64) },
            @{ Payload = [byte[]]::new(0); ExpectedBytes = 0; ExpectedSha256 = ("0" * 64) },
            @{ Payload = $null; ExpectedBytes = 1; ExpectedSha256 = ("0" * 64) }
        )) {
            $global:StagingCalls.Clear()
            Assert-Throws { Stage-VerifiedArtifact @invalid -StagePath $stagePath } "before remote mutation"
            Assert-True ($global:StagingCalls.Count -eq 0) "Invalid memory payload reached transport."
        }
        foreach ($writer in @("Write-StagedSmallArtifact", "Write-StagedArtifact")) {
            $global:StagingCalls.Clear()
            Assert-Throws { & $writer -Payload $smallPayload -StagePath $stagePath -ExpectedBytes 1 } "payload identity"
            Assert-True ($global:StagingCalls.Count -eq 0) "Invalid staging length reached transport."
        }

        # A one-byte zero is valid binary data, although PowerShell treats it as false.
        $zeroPayload = [byte[]]@(0)
        Stage-VerifiedArtifact -Payload $zeroPayload -StagePath $stagePath -ExpectedBytes 1 `
            -ExpectedSha256 (Get-ByteArraySha256 -Bytes $zeroPayload)
        Assert-True (Test-ExactByteArray -Left $global:StagingStream.ToArray() -Right $zeroPayload) `
            "A one-byte zero payload was lost."

        Remove-RemoteFile -RemotePath $stagePath
        $global:StagingStream.Write($smallPayload, 0, 13)
        $global:StagingCalls.Clear()
        Stage-VerifiedArtifact -Payload $smallPayload -StagePath $stagePath `
            -ExpectedBytes $smallPayload.Length -ExpectedSha256 $smallSha256
        Assert-True (Test-ExactByteArray -Left $global:StagingStream.ToArray() -Right $smallPayload) `
            "Small in-memory resumption changed bytes."
        Assert-True (@($global:StagingCalls | Where-Object { $_ -like 'chunk:*' }).Count -eq 3) `
            "Small resumption did not preserve bounded chunks."
        $global:StagingCalls.Clear()
        Stage-VerifiedArtifact -Payload $smallPayload -StagePath $stagePath `
            -ExpectedBytes $smallPayload.Length -ExpectedSha256 $smallSha256
        Assert-True (@($global:StagingCalls | Where-Object { $_ -like 'chunk:*' }).Count -eq 0) `
            "Complete verified stage was retransmitted."

        $global:StagingCalls.Clear()
        $global:StagingVerificationFailures = 1
        Stage-VerifiedArtifact -Payload $smallPayload -StagePath $stagePath `
            -ExpectedBytes $smallPayload.Length -ExpectedSha256 $smallSha256
        Assert-True (@($global:StagingCalls | Where-Object { $_ -like 'remove:*' }).Count -eq 1 -and
            (Test-ExactByteArray -Left $global:StagingStream.ToArray() -Right $smallPayload)) `
            "Failed stage readback did not reset and retransmit the same verified bytes."
        $global:StagingVerificationFailures = 2
        Assert-Throws { Stage-VerifiedArtifact -Payload $smallPayload -StagePath $stagePath `
            -ExpectedBytes $smallPayload.Length -ExpectedSha256 $smallSha256 } "verification failed"
        Assert-True ($script:artifactOperationAttempt -eq 2 -and $global:StagingStream.Length -eq 0) `
            "Stage verification did not stop after its bounded attempts."

        $largePayload = [byte[]]::new((8 * 1024 * 1024) + 3)
        [Random]::new(20260920).NextBytes($largePayload)
        $global:StagingStream.Write($largePayload, 0, 17)
        $global:StagingCalls.Clear()
        Stage-VerifiedArtifact -Payload $largePayload -StagePath $stagePath `
            -ExpectedBytes $largePayload.Length -ExpectedSha256 (Get-ByteArraySha256 -Bytes $largePayload)
        Assert-True ($global:StagingRequest.Method -eq [Net.WebRequestMethods+Ftp]::AppendFile -and
            $global:StagingRequest.ContentLength -eq ($largePayload.Length - 17) -and
            (Get-ByteArraySha256 -Bytes $global:StagingStream.ToArray()) -eq
                (Get-ByteArraySha256 -Bytes $largePayload)) "Large memory stream resumption changed bytes or offsets."
    }
    finally {
        $global:StagingStream.Dispose()
        foreach ($name in @("Get-RemoteSize", "Remove-RemoteFile", "Write-RemoteChunk",
            "New-FtpRequest", "Test-RemoteArtifact", "Start-Sleep")) {
            Remove-Item -LiteralPath ("Function:\global:{0}" -f $name) -Force
        }
        foreach ($name in @("StagingStream", "StagingCalls", "StagingVerificationFailures", "StagingRequest")) {
            Remove-Variable -Name $name -Scope Global
        }
        $largePayload = $null
    }

    # Use canonical source bytes directly, with only bounded generated JSON on disk.
    $fakeLocalPath = Join-Path $canonicalRepositoryRoot "tinyrustlm\app\site-release.js"
    $fakeHostPolicyPath = Join-Path $canonicalRepositoryRoot "tinyrustlm\.htaccess"
    $fakeBytes = [int64](Get-Item -LiteralPath $fakeLocalPath).Length
    $fakeHash = Get-FileSha256 -Path $fakeLocalPath
    $fakeHostPolicyBytes = [int64](Get-Item -LiteralPath $fakeHostPolicyPath).Length
    $fakeHostPolicyHash = Get-FileSha256 -Path $fakeHostPolicyPath
    $fakeRemotePath = "app/site-release.js"
    $script:deploymentLeaseId = "6" * 32
    $fakeStagePath = "app/deploy-{0}-stage-{1}-{2}.slm" -f `
        $script:deploymentLeaseId.Substring(0, 12),
        $script:deploymentLeaseId.Substring(12),
        $fakeHash.Substring(0, 12)
    $fakeBackupPath = "app/backup-{0}.slm" -f `
        $script:deploymentLeaseId.Substring(0, 12)
    Assert-True (
        $fakeStagePath -match "(^|/)deploy-[0-9a-f]{12}-stage[^/]*$" -and
        $fakeBackupPath -match "(^|/)backup-[0-9a-f]{12}\.slm$"
    ) "Lease-owned temporary paths escaped the deployed host-policy deny rules."

    $script:generatedReleaseRoot = Join-Path $root "generated-release"
    $fakeMarkerDirectory = Join-Path $script:generatedReleaseRoot ".well-known"
    [IO.Directory]::CreateDirectory($fakeMarkerDirectory) | Out-Null
    $fakeMarkerPath = Join-Path $fakeMarkerDirectory "site-release.json"
    [IO.File]::WriteAllText($fakeMarkerPath, "{}`n", $utf8)
    $script:regularArtifactsVerifiedForCommit = $false
    $fakeReleaseInputEntry = [pscustomobject]@{
        source = "source"
        local = "app/site-release.js"
        remote = "app/site-release.js"
        byteCount = $fakeBytes
        sha256 = $fakeHash
    }
    $fakeHostPolicyInputEntry = [pscustomobject]@{
        source = "source"
        local = ".htaccess"
        remote = ".htaccess"
        byteCount = $fakeHostPolicyBytes
        sha256 = $fakeHostPolicyHash
    }
    $fakeMarkerInputEntry = [pscustomobject]@{
        source = "generated-release"
        local = ".well-known/site-release.json"
        remote = ".well-known/site-release.json"
        byteCount = [int64](Get-Item -LiteralPath $fakeMarkerPath).Length
        sha256 = Get-FileSha256 -Path $fakeMarkerPath
    }
    $canonicalBytes = Assert-DeploymentInputEntry -DeploymentInputEntry $fakeReleaseInputEntry
    Assert-True ((Get-ByteArraySha256 -Bytes $canonicalBytes.payload) -eq $fakeHash) `
        "Canonical reader did not return the bound source bytes."
    $changedEntry = $fakeMarkerInputEntry | ConvertTo-Json | ConvertFrom-Json
    [IO.File]::WriteAllText($fakeMarkerPath, "[]`n", $utf8)
    Assert-Throws { Assert-DeploymentInputEntry -DeploymentInputEntry $changedEntry | Out-Null } "bytes changed"
    [IO.File]::WriteAllText($fakeMarkerPath, "{}`n", $utf8)
    $global:FakeRemoteObjects = @{}
    $global:EnsuredRemoteDirectories = [Collections.Generic.List[string]]::new()
    $global:FailPromotionRename = $false
    $global:FailPublicHostPolicy = $false
    $global:FailStageWrite = $false
    $global:FailBackupCleanupAfterDelete = $false
    $global:CorruptRestoredPredecessor = $false
    $global:ForeignTargetDuringPromotion = $false
    $global:RemoteMutationEvents = [Collections.Generic.List[string]]::new()
    function global:Get-RemoteSize {
        param([string]$RemotePath)
        if ($global:FakeRemoteObjects.ContainsKey($RemotePath)) {
            return [int64]$global:FakeRemoteObjects[$RemotePath].bytes
        }
        return [int64]-1
    }
    function global:Remove-RemoteFile {
        param([string]$RemotePath)
        $global:RemoteMutationEvents.Add("delete:$RemotePath")
        $global:FakeRemoteObjects.Remove($RemotePath)
        if ($global:FailBackupCleanupAfterDelete -and $RemotePath -match "(^|/)backup-") {
            throw "simulated cleanup acknowledgement failure"
        }
    }
    function global:Rename-RemoteFile {
        param([string]$RemotePath, [string]$NewLeafName)
        if ($global:FailPromotionRename -and
            $RemotePath -match "(^|/)deploy-[0-9a-f]{12}-stage-") {
            if ($global:ForeignTargetDuringPromotion) {
                $global:FakeRemoteObjects["app/site-release.js"] = [pscustomobject]@{
                    bytes = 7; sha256 = "foreign"
                }
            }
            throw "simulated promotion failure"
        }
        if (-not $global:FakeRemoteObjects.ContainsKey($RemotePath)) {
            throw "simulated source absence"
        }
        $directory = Split-Path -Parent $RemotePath
        $destination = if ($directory) { "$directory/$NewLeafName" } else { $NewLeafName }
        $global:FakeRemoteObjects[$destination] = $global:FakeRemoteObjects[$RemotePath]
        $global:FakeRemoteObjects.Remove($RemotePath)
        $global:RemoteMutationEvents.Add("rename:$RemotePath=>$destination")
        if ($global:CorruptRestoredPredecessor -and $RemotePath -match "(^|/)backup-") {
            $global:FakeRemoteObjects[$destination] = [pscustomobject]@{
                bytes = $global:FakeRemoteObjects[$destination].bytes; sha256 = "wrong-same-size"
            }
        }
    }
    function global:Stage-VerifiedArtifact {
        param(
            [byte[]]$Payload,
            [string]$StagePath,
            [int64]$ExpectedBytes,
            [string]$ExpectedSha256
        )
        $global:FakeRemoteObjects[$StagePath] = [pscustomobject]@{
            bytes = $ExpectedBytes
            sha256 = $ExpectedSha256
        }
        if ($global:FailStageWrite) {
            throw "simulated partial stage failure"
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
    $script:artifactPublicationAdmitted = $false
    Assert-Throws {
        Publish-Artifact `
            -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null
    } "Sequential FTPS publication has not been admitted"
    Assert-True (
        $global:FakeRemoteObjects.Count -eq 0
    ) "Blocked transport admission performed a remote mutation."

    # Fixture admission follows the same primitive gate; production additionally
    # requires canonical custody, the held lease, sentinel and host-policy probes.
    $script:artifactPublicationAdmitted = $true
    try {
        $badEntry = $fakeReleaseInputEntry | ConvertTo-Json | ConvertFrom-Json
        $badEntry.sha256 = "0" * 64
        Assert-Throws { Publish-Artifact -DeploymentInputEntry $badEntry | Out-Null } "bytes changed"
        Assert-True ($global:FakeRemoteObjects.Count -eq 0) "Changed canonical bytes reached publication."
        Assert-Throws {
            Publish-Artifact `
                -DeploymentInputEntry $fakeMarkerInputEntry | Out-Null
        } "Per-artifact publication cannot mutate the release commit marker"
        Assert-True (
            $global:FakeRemoteObjects.Count -eq 0
        ) "Per-artifact marker rejection performed a remote mutation."
        Assert-Throws {
            Publish-Artifact -DeploymentInputEntry $fakeMarkerInputEntry -CommitMarker | Out-Null
        } "requires verified regular publication"
        $script:regularArtifactsVerifiedForCommit = $true
        Assert-Throws {
            Publish-Artifact -DeploymentInputEntry $fakeReleaseInputEntry -CommitMarker | Out-Null
        } "requires verified regular publication"
        Assert-True ($global:FakeRemoteObjects.Count -eq 0) "Invalid marker admission mutated transport."
        try {
            $marker = Publish-Artifact -DeploymentInputEntry $fakeMarkerInputEntry -CommitMarker
            Assert-True ($marker.status -eq "published" -and $marker.readback_verified -and
                $marker.temporary_cleanup_verified -and $global:FakeRemoteObjects.Count -eq 1 -and
                $global:FakeRemoteObjects[$fakeMarkerInputEntry.remote].sha256 -eq $fakeMarkerInputEntry.sha256) `
                "The explicitly admitted marker did not publish exact bytes."
        }
        finally { $script:regularArtifactsVerifiedForCommit = $false }
        $global:FakeRemoteObjects.Clear()

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

        $global:FailStageWrite = $true
        $script:deploymentLeaseReleasable = $true
        Assert-Throws {
            Publish-Artifact `
                -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null
        } "simulated partial stage failure"
        Assert-True (
            -not $script:deploymentLeaseReleasable -and
            $global:FakeRemoteObjects.ContainsKey($fakeStagePath)
        ) "Ambiguous stage residue did not preserve the blocking lease disposition."
        $global:FakeRemoteObjects.Clear()
        $global:FailStageWrite = $false

        $oldRemote = [pscustomobject]@{ bytes = 7; sha256 = "old" }
        $global:FakeRemoteObjects[$fakeRemotePath] = $oldRemote
        $global:FailPromotionRename = $true
        Assert-Throws {
            Publish-Artifact `
                -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null
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
            $script:deploymentLeaseReleasable -and
            -not $global:FakeRemoteObjects.ContainsKey($fakeStagePath) -and
            -not $global:FakeRemoteObjects.ContainsKey($fakeBackupPath)
        ) "Verified rollback did not restore a releasable lease disposition."
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
                -DeploymentInputEntry $fakeHostPolicyInputEntry | Out-Null
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
        Assert-Throws {
            Publish-Artifact `
                -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null
        } "Operation-owned deployment temporary state already exists"
        Assert-True (
            $global:FakeRemoteObjects.ContainsKey($fakeStagePath) -and
            $global:FakeRemoteObjects.ContainsKey($fakeBackupPath) -and
            -not $script:deploymentLeaseReleasable
        ) "A blocked operation deleted pre-existing deployment objects."
        $global:FakeRemoteObjects.Remove($fakeStagePath)
        $global:FakeRemoteObjects.Remove($fakeBackupPath)
        $current = Publish-Artifact `
            -DeploymentInputEntry $fakeReleaseInputEntry
        Assert-True ($current.status -eq "already-current") "Current artifact status changed."
        Assert-True (
            $current.temporary_cleanup_verified -and
            $script:deploymentLeaseReleasable
        ) "Current artifact cleanup was not verified."

        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeRemotePath] = $oldRemote
        $published = Publish-Artifact `
            -DeploymentInputEntry $fakeReleaseInputEntry
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

        # A cleanup acknowledgement can fail after deleting the only backup.
        # The verified replacement must survive this failure without rollback.
        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeRemotePath] = $oldRemote
        $global:FailBackupCleanupAfterDelete = $true
        Assert-Throws { Publish-Artifact -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null } `
            "simulated cleanup acknowledgement failure"
        Assert-True ($global:FakeRemoteObjects.ContainsKey($fakeRemotePath) -and
            $global:FakeRemoteObjects[$fakeRemotePath].sha256 -eq $fakeHash -and
            -not $script:deploymentLeaseReleasable) `
            "Cleanup failure destroyed the verified replacement or released uncertain ownership."
        $global:FailBackupCleanupAfterDelete = $false

        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeRemotePath] = $oldRemote
        $global:FailPromotionRename = $true
        $global:CorruptRestoredPredecessor = $true
        Assert-Throws { Publish-Artifact -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null } `
            "rollback could not be verified"
        Assert-True ($script:artifactRollbackStatus -eq "failed" -and
            -not $script:deploymentLeaseReleasable -and
            $global:FakeRemoteObjects[$fakeRemotePath].sha256 -eq "wrong-same-size") `
            "Same-size corrupt restoration was accepted as the predecessor."
        $global:CorruptRestoredPredecessor = $false

        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeRemotePath] = $oldRemote
        $global:ForeignTargetDuringPromotion = $true
        Assert-Throws { Publish-Artifact -DeploymentInputEntry $fakeReleaseInputEntry | Out-Null } `
            "rollback could not be verified"
        Assert-True ($global:FakeRemoteObjects[$fakeRemotePath].sha256 -eq "foreign" -and
            $global:FakeRemoteObjects[$fakeBackupPath].sha256 -eq "old" -and
            -not $script:deploymentLeaseReleasable) `
            "Recovery removed another publisher's target or its own recovery evidence."
        $global:ForeignTargetDuringPromotion = $false
        $global:FailPromotionRename = $false

        # A later artifact failure leaves the prior successful artifact active;
        # the real orchestration must never advance its marker on this path.
        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeMarkerInputEntry.remote] = $oldRemote
        $global:FakeRemoteObjects[".htaccess"] = $oldHostPolicy
        $first = Publish-Artifact -DeploymentInputEntry $fakeReleaseInputEntry
        $global:FailPublicHostPolicy = $true
        Assert-Throws { Publish-Artifact -DeploymentInputEntry $fakeHostPolicyInputEntry | Out-Null } `
            "simulated public host policy failure"
        Assert-True ($first.status -eq "published" -and
            $global:FakeRemoteObjects[$fakeRemotePath].sha256 -eq $fakeHash -and
            $global:FakeRemoteObjects[$fakeMarkerInputEntry.remote].sha256 -eq "old" -and
            $script:artifactRollbackStatus -eq "restored") `
            "Partial publication evidence implied release-wide rollback or marker success."
        $global:FailPublicHostPolicy = $false

        $global:RemoteMutationEvents.Clear()
        $script:regularArtifactsVerifiedForCommit = $true
        try { $marker = Publish-Artifact -DeploymentInputEntry $fakeMarkerInputEntry -CommitMarker }
        finally { $script:regularArtifactsVerifiedForCommit = $false }
        $promotions = @($global:RemoteMutationEvents | Where-Object { $_ -match "^rename:.*-stage-" })
        Assert-True ($marker.status -eq "published" -and $promotions.Count -eq 1 -and
            $promotions[0].EndsWith("=>.well-known/site-release.json") -and
            $global:RemoteMutationEvents[$global:RemoteMutationEvents.Count - 1] -match "^delete:.*backup-") `
            "Marker ordering confused the final-path promotion with later owned cleanup."

        # A marker is publicly observable before cleanup finishes. Keep that
        # evidence even when the caller cannot latch a completed publication.
        $global:FakeRemoteObjects.Clear()
        $global:FakeRemoteObjects[$fakeMarkerInputEntry.remote] = $oldRemote
        $script:releaseMarkerFinalPathReadbackObserved = $false
        $releaseCommitMarkerPublished = $false
        $global:FailBackupCleanupAfterDelete = $true
        $script:regularArtifactsVerifiedForCommit = $true
        try {
            Assert-Throws {
                $marker = Publish-Artifact -DeploymentInputEntry $fakeMarkerInputEntry -CommitMarker
                $releaseCommitMarkerPublished = $true
            } "simulated cleanup acknowledgement failure"
        }
        finally {
            $script:regularArtifactsVerifiedForCommit = $false
            $global:FailBackupCleanupAfterDelete = $false
        }
        Assert-True ($global:FakeRemoteObjects[$fakeMarkerInputEntry.remote].sha256 -eq $fakeMarkerInputEntry.sha256 -and
            $script:releaseMarkerFinalPathReadbackObserved -and -not $releaseCommitMarkerPublished -and
            $script:artifactPrimaryFailureStep -eq "temporary-cleanup" -and
            $script:artifactRollbackStatus -eq "not-attempted-after-verified-promotion" -and
            -not $script:deploymentLeaseReleasable) `
            "Marker cleanup failure lost public readback evidence or claimed completed publication."

        $script:releaseMarkerFinalPathReadbackObserved = $false
        $script:regularArtifactsVerifiedForCommit = $true
        try { $marker = Publish-Artifact -DeploymentInputEntry $fakeMarkerInputEntry -CommitMarker }
        finally { $script:regularArtifactsVerifiedForCommit = $false }
        Assert-True ($marker.status -eq "already-current" -and
            $script:releaseMarkerFinalPathReadbackObserved -and -not $script:artifactPromotedReadbackVerified) `
            "Existing marker readback was confused with a new promotion."
    }
    finally {
        foreach ($functionName in @(
            "Get-RemoteSize"
            "Get-FtpsArtifactIdentity"
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
        foreach ($variableName in @("FailBackupCleanupAfterDelete", "CorruptRestoredPredecessor",
            "ForeignTargetDuringPromotion", "RemoteMutationEvents")) {
            Remove-Variable -Name $variableName -Scope Global -ErrorAction SilentlyContinue
        }
        Remove-Variable -Name FailPublicHostPolicy -Scope Global -ErrorAction SilentlyContinue
        Remove-Variable -Name FailStageWrite -Scope Global -ErrorAction SilentlyContinue
        $script:generatedReleaseRoot = $null
        $script:activeArtifactLocal = $null
        $script:activeArtifactRemote = $null
        $script:artifactOperationStep = $null
        $script:artifactOperationAttempt = $null
        $script:artifactPrimaryFailureStep = $null
        $script:artifactRollbackStatus = $null
        $script:deploymentLeaseId = $null
        $script:deploymentLeaseReleasable = $false
        $script:artifactPublicationAdmitted = $false
    }
}
finally {
    # The Node parent verifies the exact owner marker, inventories, and removes this tree.
    Assert-CanonicalDeploymentArtifactPath -Path $root -SourceRoot $canonicalRepositoryRoot | Out-Null
}

Write-Host "TinyRustLM deployment persistence and credential-profile tests passed."
