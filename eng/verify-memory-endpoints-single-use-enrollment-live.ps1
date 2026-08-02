[CmdletBinding()]
param(
    [string]$BaseUrl = "https://memoryendpoints.com",
    [string]$CoordinatorWorkspaceId = $env:MEMORYENDPOINTS_WORKSPACE_ID,
    [string]$CoordinatorWorkspaceKey = $env:MEMORYENDPOINTS_WORKSPACE_KEY,
    [string]$CoordinatorAgentId = "tinyrustlm-agent",
    [string]$BackendAgentId = "MemoryEndpoints-Backend-Agent",
    [string]$TaskRoomId = "room-094574c6f1df9e75c1ce",
    [string]$ReportOutput = "artifacts/reports/tinyrustlm-memory-endpoints-single-use-enrollment-live.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$contractSchema = "memoryendpoints.single_agent_enrollment_contract.v1"
$connectorContractPath = "/api/matm/connector-contract"
$maximumResponseBytes = 1024 * 1024
$runId = "tinyrustlm-enrollment-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))-$([Guid]::NewGuid().ToString('N').Substring(0, 12))"

function Get-Sha256Hex {
    param([Parameter(Mandatory = $true)][string]$Value)

    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    try {
        $digest = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
        return ([BitConverter]::ToString($digest)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

function Normalize-ServiceBaseUrl {
    param([Parameter(Mandatory = $true)][string]$Value)

    $uri = $null
    if (-not [Uri]::TryCreate($Value.Trim(), [UriKind]::Absolute, [ref]$uri)) {
        throw "MemoryEndpoints base URL must be absolute."
    }
    $loopbackHttp = $uri.Scheme -eq "http" -and $uri.IsLoopback
    if ($uri.Scheme -ne "https" -and -not $loopbackHttp) {
        throw "MemoryEndpoints base URL must use HTTPS, except loopback HTTP for tests."
    }
    if (-not [string]::IsNullOrEmpty($uri.UserInfo) -or
        -not [string]::IsNullOrEmpty($uri.Query) -or
        -not [string]::IsNullOrEmpty($uri.Fragment)) {
        throw "MemoryEndpoints base URL must not contain credentials, query, or fragment data."
    }
    return $uri.GetLeftPart([UriPartial]::Authority).TrimEnd("/")
}

function Resolve-AdvertisedRoute {
    param(
        [Parameter(Mandatory = $true)][string]$ServiceBase,
        [Parameter(Mandatory = $true)][string]$Route,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not $Route.StartsWith("/api/matm/", [StringComparison]::Ordinal) -or
        $Route.Contains("\\") -or
        $Route.Contains("?") -or
        $Route.Contains("#") -or
        $Route.Split("/").Contains("..")) {
        throw "$Label is not a safe MemoryEndpoints MATM route."
    }
    return "$ServiceBase$Route"
}

function ConvertTo-BoundedJson {
    param(
        [Parameter(Mandatory = $true)][byte[]]$Bytes,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ($Bytes.Length -eq 0 -or $Bytes.Length -gt $maximumResponseBytes) {
        throw "$Label response length is outside the supported boundary."
    }
    try {
        $text = [Text.Encoding]::UTF8.GetString($Bytes)
        return $text | ConvertFrom-Json
    }
    catch {
        throw "$Label response is not valid bounded UTF-8 JSON."
    }
}

function Invoke-JsonRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [hashtable]$Headers = @{},
        [object]$Payload = $null,
        [int[]]$AllowedStatusCodes = @(200)
    )

    $body = $null
    if ($null -ne $Payload) {
        $body = $Payload | ConvertTo-Json -Depth 12 -Compress
    }
    try {
        $response = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers `
            -ContentType "application/json" -Body $body -UseBasicParsing
        $status = [int]$response.StatusCode
        $bytes = [Text.Encoding]::UTF8.GetBytes([string]$response.Content)
    }
    catch [Net.WebException] {
        if ($null -eq $_.Exception.Response) {
            throw
        }
        $raw = $_.Exception.Response
        $status = [int]$raw.StatusCode
        $stream = $raw.GetResponseStream()
        $memory = [IO.MemoryStream]::new()
        try {
            $stream.CopyTo($memory)
            $bytes = $memory.ToArray()
        }
        finally {
            $memory.Dispose()
            $stream.Dispose()
        }
        if ($bytes.Length -eq 0 -and -not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
            $bytes = [Text.Encoding]::UTF8.GetBytes([string]$_.ErrorDetails.Message)
        }
    }
    if ($status -notin $AllowedStatusCodes) {
        throw "Unexpected HTTP status $status for $Method request."
    }
    return [pscustomobject]@{
        StatusCode = $status
        Json = ConvertTo-BoundedJson -Bytes $bytes -Label "$Method $Uri"
    }
}

function Assert-RedactedEnvelope {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $names = @($Value.PSObject.Properties.Name)
    $credentialExposed = $names -contains "rawCredentialExposed" -and $Value.rawCredentialExposed -eq $true
    $payloadExposed = $names -contains "rawPayloadExposed" -and $Value.rawPayloadExposed -eq $true
    if ($credentialExposed -or $payloadExposed) {
        throw "$Label exposed protected values."
    }
}

function Require-Property {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ($Value.PSObject.Properties.Name -notcontains $Name -or $null -eq $Value.$Name) {
        throw "$Label is missing $Name."
    }
    return $Value.$Name
}

function Get-SecretText {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $secret = [string](Require-Property -Value $Value -Name $Name -Label $Label)
    if ([string]::IsNullOrWhiteSpace($secret) -or $secret.Length -lt 24) {
        throw "$Label returned an invalid protected value."
    }
    return $secret
}

function Get-CanonicalId {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $id = [string](Require-Property -Value $Value -Name $Name -Label $Label)
    if ($id -notmatch "^[A-Za-z0-9._-]{1,128}$") {
        throw "$Label returned an invalid $Name."
    }
    return $id
}

function Get-AuthHeaders {
    param([Parameter(Mandatory = $true)][string]$Token)

    return @{ Authorization = "Bearer $Token" }
}

function Send-BackendDefect {
    param(
        [Parameter(Mandatory = $true)][string]$Code,
        [Parameter(Mandatory = $true)][string]$Summary
    )

    if ([string]::IsNullOrWhiteSpace($CoordinatorWorkspaceId) -or
        [string]::IsNullOrWhiteSpace($CoordinatorWorkspaceKey)) {
        return [pscustomobject]@{ AgentMessageId = "not-sent"; MeetingMessageId = "not-sent" }
    }
    $safeSummary = "TinyRustLM single-use enrollment live test defect [$Code]. $Summary Run marker hash: $(Get-Sha256Hex $runId). No invitation URL, agent token, workspace key, or private memory body is included."
    if ($safeSummary.Length -gt 1000) {
        $safeSummary = $safeSummary.Substring(0, 1000)
    }
    $headers = Get-AuthHeaders -Token $CoordinatorWorkspaceKey
    $headers["Idempotency-Key"] = "tinyrustlm-enrollment-defect-$Code-$(Get-Sha256Hex $runId)"
    $agentResponse = Invoke-JsonRequest -Method "POST" -Uri "$script:ServiceBase/api/matm/agent-messages" `
        -Headers $headers -Payload @{
            workspaceId = $CoordinatorWorkspaceId
            senderAgentId = $CoordinatorAgentId
            targetAgentId = $BackendAgentId
            safeSummary = $safeSummary
            responseRequired = $true
        } -AllowedStatusCodes @(200, 202)
    Assert-RedactedEnvelope -Value $agentResponse.Json -Label "backend defect message"

    $headers["Idempotency-Key"] = "tinyrustlm-enrollment-room-defect-$Code-$(Get-Sha256Hex $runId)"
    $roomResponse = Invoke-JsonRequest -Method "POST" -Uri "$script:ServiceBase/api/matm/meeting-messages" `
        -Headers $headers -Payload @{
            workspaceId = $CoordinatorWorkspaceId
            roomId = $TaskRoomId
            senderAgentId = $CoordinatorAgentId
            safeSummary = $safeSummary
        } -AllowedStatusCodes @(200, 201)
    Assert-RedactedEnvelope -Value $roomResponse.Json -Label "task-room defect message"
    return [pscustomobject]@{
        AgentMessageId = [string]$agentResponse.Json.messageId
        MeetingMessageId = [string]$roomResponse.Json.messageId
    }
}

function Write-RedactedReport {
    param([Parameter(Mandatory = $true)][hashtable]$Report)

    $target = [IO.Path]::GetFullPath((Join-Path (Get-Location) $ReportOutput))
    $directory = Split-Path -Parent $target
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $temporary = "$target.$([Guid]::NewGuid().ToString('N')).tmp"
    try {
        $json = $Report | ConvertTo-Json -Depth 14
        [IO.File]::WriteAllText($temporary, "$json`n", [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $target -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporary) {
            Remove-Item -LiteralPath $temporary -Force
        }
    }
}

$script:ServiceBase = Normalize-ServiceBaseUrl -Value $BaseUrl
$report = [ordered]@{
    schema = "tinyrustlm.memory_endpoints.single_use_enrollment_live.v2"
    generatedUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    status = "not_started"
    baseOrigin = ([Uri]$script:ServiceBase).Host
    runMarkerSha256 = Get-Sha256Hex $runId
    contractSchema = $contractSchema
    contractAdvertised = $false
    freshCompanyCreated = $false
    invitationIssued = $false
    firstClaimSucceeded = $false
    secondClaimRejected = $false
    secondClaimStatus = 0
    secondClaimErrorCode = "not-run"
    canonicalAgentStable = $false
    reconnectSucceeded = $false
    startupRestored = $false
    companyCloseAttempted = $false
    companyClosed = $false
    companyDeleteAttempted = $false
    companyDeleted = $false
    cleanupStatus = "not_required"
    invitationUrlPersisted = $false
    rawCredentialExposed = $false
    rawPayloadExposed = $false
    defect = [ordered]@{ posted = $false; code = "none"; agentMessageId = "none"; meetingMessageId = "none" }
    cleanupDefect = [ordered]@{ posted = $false; code = "none"; agentMessageId = "none"; meetingMessageId = "none" }
}

$capturedError = $null
$cleanupError = $null
$workspaceId = $null
$workspaceKey = $null
$closeCompanyUri = $null
$deleteCompanyUri = $null

try {
    $contractResponse = Invoke-JsonRequest -Method "GET" `
        -Uri "$script:ServiceBase$connectorContractPath" -AllowedStatusCodes @(200)
    Assert-RedactedEnvelope -Value $contractResponse.Json -Label "connector contract"
    $data = Require-Property -Value $contractResponse.Json -Name "data" -Label "connector contract"
    if ($data.PSObject.Properties.Name -notcontains "singleAgentEnrollment") {
        $report.status = "blocked_contract_missing"
        $defect = Send-BackendDefect -Code "contract_missing" `
            -Summary "Production connector_contract does not advertise singleAgentEnrollment, so the required fresh-company issue/claim/replay test cannot execute."
        $report.defect = [ordered]@{
            posted = $defect.AgentMessageId -ne "not-sent"
            code = "contract_missing"
            agentMessageId = $defect.AgentMessageId
            meetingMessageId = $defect.MeetingMessageId
        }
        Write-RedactedReport -Report $report
        throw "MemoryEndpoints single-use enrollment contract is not advertised."
    }

    $contract = $data.singleAgentEnrollment
    if ($contract.schemaVersion -ne $contractSchema -or $contract.status -ne "live") {
        throw "MemoryEndpoints single-use enrollment contract is unsupported or not live."
    }
    foreach ($flag in @(
        "singleUseUrl",
        "postClaimOnly",
        "atomicOneWinner",
        "lostResponseIdempotentRecovery",
        "agentScopedToken",
        "workspaceHiddenOnReconnect",
        "virtualUaiStartupRestore",
        "shortTermRestore",
        "longTermRestore"
    )) {
        if ($contract.$flag -ne $true) {
            throw "MemoryEndpoints enrollment contract is missing required behavior $flag."
        }
    }
    $routes = Require-Property -Value $contract -Name "routes" -Label "enrollment contract"
    $createCompanyUri = Resolve-AdvertisedRoute $script:ServiceBase $routes.createCompany "createCompany route"
    $issueInvitationUri = Resolve-AdvertisedRoute $script:ServiceBase $routes.issueInvitation "issueInvitation route"
    $claimInvitationUri = Resolve-AdvertisedRoute $script:ServiceBase $routes.claimInvitation "claimInvitation route"
    $reconnectUri = Resolve-AdvertisedRoute $script:ServiceBase $routes.reconnect "reconnect route"
    $closeCompanyUri = Resolve-AdvertisedRoute $script:ServiceBase $routes.closeCompany "closeCompany route"
    $deleteCompanyUri = Resolve-AdvertisedRoute $script:ServiceBase $routes.deleteCompany "deleteCompany route"
    $report.contractAdvertised = $true

    $companyLabel = "TinyRustLM Enrollment Test $((Get-Sha256Hex $runId).Substring(0, 12))"
    $companyResponse = Invoke-JsonRequest -Method "POST" -Uri $createCompanyUri `
        -Payload @{ companyLabel = $companyLabel; testRunId = $runId } -AllowedStatusCodes @(200, 201)
    Assert-RedactedEnvelope $companyResponse.Json "fresh company setup"
    $workspaceId = Get-CanonicalId $companyResponse.Json "workspaceId" "fresh company setup"
    $workspaceKey = Get-SecretText $companyResponse.Json "workspaceKey" "fresh company setup"
    $report.freshCompanyCreated = $true

    $issueHeaders = Get-AuthHeaders $workspaceKey
    $issueHeaders["Idempotency-Key"] = "tinyrustlm-enrollment-issue-$(Get-Sha256Hex $runId)"
    $requestedAgentName = "TinyRustLM-$([Guid]::NewGuid().ToString('N').Substring(0, 10))"
    $issueResponse = Invoke-JsonRequest -Method "POST" -Uri $issueInvitationUri `
        -Headers $issueHeaders -Payload @{
            workspaceId = $workspaceId
            requestedAgentName = $requestedAgentName
            client = "TinyRustLM.com"
        } -AllowedStatusCodes @(200, 201)
    Assert-RedactedEnvelope $issueResponse.Json "issue invitation"
    $invitationUrl = Get-SecretText $issueResponse.Json "invitationUrl" "issue invitation"
    $invitationUrlHash = Get-Sha256Hex $invitationUrl
    $report.invitationIssued = $true
    $report.invitationUrlSha256 = $invitationUrlHash

    $claimHeaders = @{ "Idempotency-Key" = "tinyrustlm-enrollment-claim-first-$(Get-Sha256Hex $runId)" }
    $claimPayload = @{ invitationUrl = $invitationUrl; agreedAgentName = $requestedAgentName }
    $firstClaim = Invoke-JsonRequest -Method "POST" -Uri $claimInvitationUri `
        -Headers $claimHeaders -Payload $claimPayload -AllowedStatusCodes @(200, 201)
    Assert-RedactedEnvelope $firstClaim.Json "first invitation claim"
    if ($firstClaim.Json.urlConsumed -ne $true -or $firstClaim.Json.persisted -ne $true) {
        throw "First invitation claim did not prove atomic URL consumption."
    }
    $canonicalAgentName = Get-CanonicalId $firstClaim.Json "canonicalAgentName" "first invitation claim"
    $agentToken = Get-SecretText $firstClaim.Json "agentToken" "first invitation claim"
    $report.firstClaimSucceeded = $true

    $secondHeaders = @{ "Idempotency-Key" = "tinyrustlm-enrollment-claim-replay-$(Get-Sha256Hex $runId)" }
    $secondClaim = Invoke-JsonRequest -Method "POST" -Uri $claimInvitationUri `
        -Headers $secondHeaders -Payload $claimPayload -AllowedStatusCodes @(409, 410)
    Assert-RedactedEnvelope $secondClaim.Json "second invitation claim"
    $secondCode = [string]$secondClaim.Json.error.code
    $report.secondClaimStatus = $secondClaim.StatusCode
    $report.secondClaimErrorCode = $secondCode
    if ($secondClaim.Json.ok -ne $false -or
        $secondClaim.Json.safeNoOp -ne $true -or
        $secondCode -notin @("enrollment_url_consumed", "invitation_consumed")) {
        throw "Second invitation claim did not return the required consumed safe no-op."
    }
    $report.secondClaimRejected = $true

    $reconnectHeaders = Get-AuthHeaders $agentToken
    $reconnect = Invoke-JsonRequest -Method "POST" -Uri $reconnectUri `
        -Headers $reconnectHeaders -Payload @{ agentName = $canonicalAgentName } -AllowedStatusCodes @(200)
    Assert-RedactedEnvelope $reconnect.Json "agent reconnect"
    if ($reconnect.Json.canonicalAgentName -ne $canonicalAgentName -or
        $reconnect.Json.workspaceId -ne $workspaceId) {
        throw "Reconnect did not preserve the canonical agent/workspace binding."
    }
    $report.canonicalAgentStable = $true
    $report.reconnectSucceeded = $true
    $report.startupRestored = $reconnect.Json.readyForStartup -eq $true
    if (-not $report.startupRestored) {
        throw "Reconnect did not restore a ready virtual-UAIX startup package."
    }
    $report.status = "pass"
}
catch {
    $capturedError = $_
    if ($report.status -eq "not_started") {
        $report.status = "fail"
    }
    if ($report.status -eq "fail" -and -not $report.secondClaimRejected) {
        $defect = Send-BackendDefect -Code "single_use_replay_failed" `
            -Summary "The fresh-company enrollment lifecycle did not prove that a second distinct-idempotency claim of the identical invitation URL is dead."
        $report.defect = [ordered]@{
            posted = $defect.AgentMessageId -ne "not-sent"
            code = "single_use_replay_failed"
            agentMessageId = $defect.AgentMessageId
            meetingMessageId = $defect.MeetingMessageId
        }
    }
    $report.failureCode = if ($report.status -eq "blocked_contract_missing") { "contract_missing" } else { "live_verification_failed" }
}
finally {
    if ($report.freshCompanyCreated) {
        $report.cleanupStatus = "running"
        if ([string]::IsNullOrWhiteSpace($workspaceId) -or
            [string]::IsNullOrWhiteSpace($workspaceKey) -or
            [string]::IsNullOrWhiteSpace($closeCompanyUri) -or
            [string]::IsNullOrWhiteSpace($deleteCompanyUri)) {
            $cleanupError = [InvalidOperationException]::new("Fresh-company cleanup authority is incomplete.")
        }
        else {
            $cleanupHeaders = Get-AuthHeaders -Token $workspaceKey
            $cleanupPayload = @{ workspaceId = $workspaceId; testRunId = $runId }

            $report.companyCloseAttempted = $true
            try {
                $cleanupHeaders["Idempotency-Key"] = "tinyrustlm-enrollment-close-$(Get-Sha256Hex $runId)"
                $closeResponse = Invoke-JsonRequest -Method "POST" -Uri $closeCompanyUri `
                    -Headers $cleanupHeaders -Payload $cleanupPayload -AllowedStatusCodes @(200, 202)
                Assert-RedactedEnvelope $closeResponse.Json "close test company"
                if ($closeResponse.Json.closed -ne $true) {
                    throw "Close-company response did not confirm closure."
                }
                $report.companyClosed = $true
            }
            catch {
                if ($null -eq $cleanupError) { $cleanupError = $_.Exception }
            }

            $report.companyDeleteAttempted = $true
            try {
                $cleanupHeaders["Idempotency-Key"] = "tinyrustlm-enrollment-delete-$(Get-Sha256Hex $runId)"
                $deleteResponse = Invoke-JsonRequest -Method "DELETE" -Uri $deleteCompanyUri `
                    -Headers $cleanupHeaders -Payload $cleanupPayload -AllowedStatusCodes @(200, 202)
                Assert-RedactedEnvelope $deleteResponse.Json "delete test company"
                if ($deleteResponse.Json.deleted -ne $true) {
                    throw "Delete-company response did not confirm deletion."
                }
                $report.companyDeleted = $true
            }
            catch {
                if ($null -eq $cleanupError) { $cleanupError = $_.Exception }
            }
        }

        if ($report.companyClosed -and $report.companyDeleted) {
            $report.cleanupStatus = "pass"
        }
        else {
            $report.cleanupStatus = "fail"
            if ($report.status -eq "pass") {
                $report.status = "fail_cleanup"
                $report.failureCode = "test_company_cleanup_failed"
            }
            elseif ($report.failureCode) {
                $report.failureCode = "$($report.failureCode)_and_cleanup_failed"
            }
            else {
                $report.failureCode = "test_company_cleanup_failed"
            }
            try {
                $cleanupDefect = Send-BackendDefect -Code "test_company_cleanup_failed" `
                    -Summary "The disposable company created for the enrollment replay test could not be both closed and deleted. Manual backend cleanup is required."
                $report.cleanupDefect = [ordered]@{
                    posted = $cleanupDefect.AgentMessageId -ne "not-sent"
                    code = "test_company_cleanup_failed"
                    agentMessageId = $cleanupDefect.AgentMessageId
                    meetingMessageId = $cleanupDefect.MeetingMessageId
                }
            }
            catch {
                if ($null -eq $cleanupError) { $cleanupError = $_.Exception }
                $report.cleanupDefect.code = "test_company_cleanup_failed"
            }
        }
    }

    if (Get-Variable -Name invitationUrl -ErrorAction SilentlyContinue) { $invitationUrl = $null }
    if (Get-Variable -Name workspaceKey -ErrorAction SilentlyContinue) { $workspaceKey = $null }
    if (Get-Variable -Name agentToken -ErrorAction SilentlyContinue) { $agentToken = $null }
    Write-RedactedReport -Report $report
}

if ($null -ne $capturedError) {
    throw $capturedError
}
if ($null -ne $cleanupError) {
    throw $cleanupError
}
Write-Host "MemoryEndpoints single-use enrollment live verification passed. Report: $ReportOutput"
