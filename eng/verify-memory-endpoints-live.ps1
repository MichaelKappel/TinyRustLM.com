param(
    [string]$BaseUrl = $env:MEMORYENDPOINTS_BASE_URL,
    [string]$WorkspaceId = $env:MEMORYENDPOINTS_WORKSPACE_ID,
    [string]$WorkspaceKey = $env:MEMORYENDPOINTS_WORKSPACE_KEY,
    [string]$AgentId = $(if ($env:MEMORYENDPOINTS_AGENT_ID) { $env:MEMORYENDPOINTS_AGENT_ID } else { "tinyrustlm-agent" }),
    [ValidateSet("authorization", "x-memoryendpoints-key")]
    [string]$AuthHeaderMode = $(if ($env:MEMORYENDPOINTS_AUTH_HEADER) { $env:MEMORYENDPOINTS_AUTH_HEADER } else { "authorization" }),
    [string]$Scope = "project",
    [string]$ScopeId = "tinyrustlm.com",
    [string]$MeetingScopeId = $(if ($env:MEMORYENDPOINTS_MEETING_SCOPE_ID) { $env:MEMORYENDPOINTS_MEETING_SCOPE_ID } else { "goal-tinyrustlm-hosted-memory" }),
    [string]$ReportOutput = "",
    [int]$SearchRetries = 4,
    [int]$RetryDelaySeconds = 2,
    [switch]$AllowMissingCredentials
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-memory-endpoints-live.json"
}
if (-not $BaseUrl) {
    $BaseUrl = "https://memoryendpoints.com"
}

function Write-JsonReport {
    param(
        [hashtable]$Report
    )

    $reportDirectory = Split-Path -Parent $ReportOutput
    if ($reportDirectory -and -not (Test-Path $reportDirectory)) {
        New-Item -ItemType Directory -Path $reportDirectory | Out-Null
    }
    $Report | ConvertTo-Json -Depth 12 | Set-Content -Path $ReportOutput -Encoding UTF8
}

function New-BaseApiUrl {
    param([string]$Value)

    if ($Value -match "(?i)bearer\s+|api[_-]?key|password|secret=") {
        throw "MemoryEndpoints base URL must not include credential material."
    }
    $withScheme = if ($Value -match "^[a-z][a-z0-9+.-]*://") { $Value } else { "https://$Value" }
    $uri = [Uri]$withScheme
    $loopbackHttp = $uri.Scheme -eq "http" -and ($uri.Host -in @("localhost", "127.0.0.1", "::1"))
    if ($uri.Scheme -ne "https" -and -not $loopbackHttp) {
        throw "MemoryEndpoints base URL must use HTTPS, except loopback HTTP for local tests."
    }
    if ($uri.UserInfo -or $uri.Query -or $uri.Fragment) {
        throw "MemoryEndpoints base URL must not include credentials, query strings, or fragments."
    }
    return $withScheme.TrimEnd("/")
}

function Get-AuthHeaders {
    if ($AuthHeaderMode -eq "x-memoryendpoints-key") {
        return @{ "X-MemoryEndpoints-Key" = $WorkspaceKey }
    }
    return @{ Authorization = "Bearer $WorkspaceKey" }
}

function Invoke-MemoryPost {
    param(
        [string]$Path,
        [hashtable]$Payload,
        [string]$IdempotencyPrefix
    )

    $headers = Get-AuthHeaders
    $headers["Content-Type"] = "application/json"
    $headers["Idempotency-Key"] = "$IdempotencyPrefix-$([Guid]::NewGuid().ToString("N"))"
    Invoke-RestMethod -Method Post -Uri "$script:ApiBase$Path" -Headers $headers -Body ($Payload | ConvertTo-Json -Depth 12)
}

function Invoke-MemoryGet {
    param(
        [string]$Path,
        [hashtable]$Query
    )

    $builder = [UriBuilder]"$script:ApiBase$Path"
    $pairs = New-Object System.Collections.Generic.List[string]
    foreach ($entry in $Query.GetEnumerator()) {
        if ($null -ne $entry.Value -and "$($entry.Value)" -ne "") {
            $pairs.Add("$([Uri]::EscapeDataString($entry.Key))=$([Uri]::EscapeDataString("$($entry.Value)"))")
        }
    }
    $builder.Query = $pairs -join "&"
    Invoke-RestMethod -Method Get -Uri $builder.Uri.AbsoluteUri -Headers (Get-AuthHeaders)
}

function Get-ResponseItems {
    param($Payload)

    if ($Payload -is [array]) {
        return @($Payload)
    }
    if ($null -eq $Payload) {
        return @()
    }
    foreach ($property in @("items", "results", "matches", "memories", "data")) {
        if ($Payload.PSObject.Properties.Name -contains $property) {
            $value = $Payload.$property
            if ($value -is [array]) {
                return @($value)
            }
            if ($null -ne $value -and $value.PSObject.Properties.Name -contains "items") {
                return @($value.items)
            }
        }
    }
    return @()
}

function Test-ItemsContain {
    param(
        [array]$Items,
        [string]$Needle
    )

    foreach ($item in $Items) {
        $json = $item | ConvertTo-Json -Depth 12 -Compress
        if ($json.Contains($Needle)) {
            return $true
        }
    }
    return $false
}

function Test-ResponseExposureFlagsClear {
    param($Payload)

    $json = $Payload | ConvertTo-Json -Depth 32 -Compress
    return $json -notmatch '"rawCredentialExposed"\s*:\s*true' -and
        $json -notmatch '"rawPayloadExposed"\s*:\s*true'
}

function Get-FirstRoomId {
    param($Payload)

    foreach ($path in @(
        @("roomId"),
        @("canonicalRoomId"),
        @("id"),
        @("room", "roomId"),
        @("room", "id")
    )) {
        $value = $Payload
        foreach ($part in $path) {
            if ($null -ne $value -and $value.PSObject.Properties.Name -contains $part) {
                $value = $value.$part
            }
            else {
                $value = $null
                break
            }
        }
        if (-not [string]::IsNullOrWhiteSpace("$value")) {
            return "$value"
        }
    }
    return ""
}

function Get-MeetingRoomId {
    param(
        $WorkspacePayload,
        [string]$WantedScopeId
    )

    $rooms = @()
    if ($WorkspacePayload.PSObject.Properties.Name -contains "workspace" -and
        $WorkspacePayload.workspace.PSObject.Properties.Name -contains "meetingRooms") {
        $rooms = @($WorkspacePayload.workspace.meetingRooms)
    }
    elseif ($WorkspacePayload.PSObject.Properties.Name -contains "meetingRooms") {
        $rooms = @($WorkspacePayload.meetingRooms)
    }
    foreach ($room in $rooms) {
        if ($room.scope -eq "goal" -and $room.scopeId -eq $WantedScopeId) {
            return Get-FirstRoomId -Payload $room
        }
    }
    return ""
}

function Get-Sha256Hex {
    param([string]$Value)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        return [BitConverter]::ToString($sha256.ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Search-MemoryType {
    param(
        [string]$Marker,
        [string]$MemoryType
    )

    for ($attempt = 1; $attempt -le [Math]::Max(1, $SearchRetries); $attempt++) {
        $payload = Invoke-MemoryGet -Path "/api/matm/search" -Query @{
            workspaceId = $WorkspaceId
            agentId = $AgentId
            actor_agent_id = $AgentId
            query = $Marker
            scope = $Scope
            scopeId = $ScopeId
            memory_type = $MemoryType
            limit = 10
        }
        $items = Get-ResponseItems -Payload $payload
        if (Test-ItemsContain -Items $items -Needle $Marker) {
            return $items
        }
        if ($attempt -lt $SearchRetries) {
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
    return @()
}

$utcNow = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$report = @{
    schema = "tinyrustlm.memory_endpoints.live_verification.v0"
    status = "not_started"
    generated_at_utc = $utcNow
    base_url = "<redacted-hosted-memory-url>"
    workspace_id_present = -not [string]::IsNullOrWhiteSpace($WorkspaceId)
    workspace_key_present = -not [string]::IsNullOrWhiteSpace($WorkspaceKey)
    agent_id = $AgentId
    scope = $Scope
    scope_id = $ScopeId
    meeting_scope_id = $MeetingScopeId
    auth_header_mode = $AuthHeaderMode
    secret_material_included = $false
    short_term_memory_type = "status"
    long_term_memory_type = "handoff"
    report_path = $ReportOutput
}

try {
    if ([string]::IsNullOrWhiteSpace($WorkspaceId) -or [string]::IsNullOrWhiteSpace($WorkspaceKey)) {
        $report.status = if ($AllowMissingCredentials) { "skipped_missing_credentials" } else { "blocked_missing_credentials" }
        $report.required_environment = @("MEMORYENDPOINTS_WORKSPACE_ID", "MEMORYENDPOINTS_WORKSPACE_KEY")
        Write-JsonReport -Report $report
        if ($AllowMissingCredentials) {
            Write-Host "MemoryEndpoints live verification skipped: missing credentials. Report: $ReportOutput"
            exit 0
        }
        throw "MEMORYENDPOINTS_WORKSPACE_ID and MEMORYENDPOINTS_WORKSPACE_KEY are required."
    }

    $script:ApiBase = New-BaseApiUrl -Value $BaseUrl
    $marker = "tinyrustlm-live-verify-$((Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))-$([Guid]::NewGuid().ToString("N").Substring(0, 12))"
    $shortMarker = "$marker short_term_probe"
    $longMarker = "$marker long_term_probe"
    $meetingMarker = "$marker meeting_transcript_probe"

    Invoke-MemoryPost -Path "/api/matm/agents/register" -IdempotencyPrefix "tinyrustlm-live-register" -Payload @{
        workspaceId = $WorkspaceId
        agentId = $AgentId
        displayName = "TinyRustLM Live Verifier"
        safeSummary = "TinyRustLM live verifier checking optional public-safe hosted memory sync."
    } | Out-Null

    Invoke-MemoryPost -Path "/api/matm/memory-events/submit" -IdempotencyPrefix "tinyrustlm-live-short" -Payload @{
        workspaceId = $WorkspaceId
        actorAgentId = $AgentId
        agentId = $AgentId
        kind = "tinyrustlm.memory_endpoints.memory_record.v0"
        version = 1
        scope = $Scope
        scopeId = $ScopeId
        memoryType = "status"
        subject = "TinyRustLM live short-term memory verifier"
        title = "TinyRustLM live short-term memory verifier"
        summary = "Public-safe TinyRustLM short-term hosted memory probe $shortMarker."
        safeSummary = "Public-safe TinyRustLM short-term hosted memory probe $shortMarker."
        source = "eng/verify-memory-endpoints-live.ps1"
        confidence = 0.8
        uaiReferences = @(".uai/short-term-memory.uai", "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md")
        tags = @("tinyrustlm", "memoryendpoints", "short-term", "live-verifier", "scope:$ScopeId", $marker)
        tinyrustlmMemoryTier = "short_term"
    } | Out-Null

    Invoke-MemoryPost -Path "/api/matm/memory-events/submit" -IdempotencyPrefix "tinyrustlm-live-long" -Payload @{
        workspaceId = $WorkspaceId
        actorAgentId = $AgentId
        agentId = $AgentId
        kind = "tinyrustlm.memory_endpoints.memory_record.v0"
        version = 1
        scope = $Scope
        scopeId = $ScopeId
        memoryType = "handoff"
        subject = "TinyRustLM live long-term memory verifier"
        title = "TinyRustLM live long-term memory verifier"
        summary = "Public-safe TinyRustLM long-term hosted memory probe $longMarker."
        safeSummary = "Public-safe TinyRustLM long-term hosted memory probe $longMarker."
        source = "eng/verify-memory-endpoints-live.ps1"
        confidence = 0.8
        uaiReferences = @(".uai/long-term-memory.uai", "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md")
        tags = @("tinyrustlm", "memoryendpoints", "long-term", "live-verifier", "scope:$ScopeId", $marker)
        tinyrustlmMemoryTier = "long_term"
    } | Out-Null

    $statusItems = @(Search-MemoryType -Marker $marker -MemoryType "status")
    $handoffItems = @(Search-MemoryType -Marker $marker -MemoryType "handoff")
    $statusFound = Test-ItemsContain -Items $statusItems -Needle $shortMarker
    $handoffFound = Test-ItemsContain -Items $handoffItems -Needle $longMarker
    $statusIncludesLong = Test-ItemsContain -Items $statusItems -Needle $longMarker
    $handoffIncludesShort = Test-ItemsContain -Items $handoffItems -Needle $shortMarker

    $workspacePayload = Invoke-RestMethod -Method Get -Uri "$script:ApiBase/api/matm/workspace" -Headers (Get-AuthHeaders)
    $roomId = Get-MeetingRoomId -WorkspacePayload $workspacePayload -WantedScopeId $MeetingScopeId
    $meetingRoomFound = -not [string]::IsNullOrWhiteSpace($roomId)
    $meetingRoomCreated = $false
    if (-not $meetingRoomFound) {
        $roomResponse = Invoke-MemoryPost -Path "/api/matm/meeting-rooms" -IdempotencyPrefix "tinyrustlm-live-room" -Payload @{
            workspaceId = $WorkspaceId
            scope = "goal"
            scopeId = $MeetingScopeId
            name = "TinyRustLM Hosted Memory Connector"
            label = "TinyRustLM Hosted Memory Connector"
            purpose = "Public-safe live verifier room for TinyRustLM optional hosted memory coordination."
            creatorAgentId = $AgentId
            agentId = $AgentId
        }
        $roomId = Get-FirstRoomId -Payload $roomResponse
        $meetingRoomCreated = -not [string]::IsNullOrWhiteSpace($roomId)
    }

    if ([string]::IsNullOrWhiteSpace($roomId)) {
        throw "MemoryEndpoints live verification could not resolve a meeting room id."
    }

    Invoke-MemoryPost -Path "/api/matm/meeting-messages" -IdempotencyPrefix "tinyrustlm-live-meeting" -Payload @{
        workspaceId = $WorkspaceId
        roomId = $roomId
        senderAgentId = $AgentId
        safeSummary = "TinyRustLM public-safe meeting transcript probe $meetingMarker."
    } | Out-Null

    $transcriptPayload = Invoke-MemoryGet -Path "/api/matm/meeting-messages" -Query @{
        roomId = $roomId
        limit = 10
        agent_id = $AgentId
    }
    $transcriptItems = @(Get-ResponseItems -Payload $transcriptPayload)
    $transcriptFound = Test-ItemsContain -Items $transcriptItems -Needle $meetingMarker
    $transcriptHasLiveItemShape = $false
    foreach ($item in $transcriptItems) {
        if ($item.PSObject.Properties.Name -contains "meetingMessageId" -and
            $item.PSObject.Properties.Name -contains "safeSummary" -and
            $item.PSObject.Properties.Name -contains "senderAgentId") {
            $transcriptHasLiveItemShape = $true
            break
        }
    }
    $transcriptExposureFlagsClear = Test-ResponseExposureFlagsClear -Payload $transcriptPayload

    $report.marker_sha256 = Get-Sha256Hex -Value $marker
    $report.registered_agent = $true
    $report.short_term_saved = $true
    $report.long_term_saved = $true
    $report.meeting_room_found = $meetingRoomFound
    $report.meeting_room_created = $meetingRoomCreated
    $report.meeting_message_posted = $true
    $report.transcript_result_count = $transcriptItems.Count
    $report.transcript_probe_found = $transcriptFound
    $report.transcript_items_shape = if ($transcriptHasLiveItemShape) { "items" } else { "unknown" }
    $report.transcript_exposure_flags_clear = $transcriptExposureFlagsClear
    $report.status_search_result_count = $statusItems.Count
    $report.handoff_search_result_count = $handoffItems.Count
    $report.status_search_found_short_term = $statusFound
    $report.handoff_search_found_long_term = $handoffFound
    $report.status_search_excluded_long_term_marker = -not $statusIncludesLong
    $report.handoff_search_excluded_short_term_marker = -not $handoffIncludesShort
    $report.status = if ($statusFound -and $handoffFound -and -not $statusIncludesLong -and -not $handoffIncludesShort -and $transcriptFound -and $transcriptHasLiveItemShape -and $transcriptExposureFlagsClear) { "pass" } else { "fail" }
    Write-JsonReport -Report $report

    if ($report.status -ne "pass") {
        throw "MemoryEndpoints live verification failed. Report: $ReportOutput"
    }
    Write-Host "MemoryEndpoints live verification passed. Report: $ReportOutput"
}
catch {
    if ($report.status -eq "not_started") {
        $report.status = "fail"
    }
    $report.error = $_.Exception.Message
    $report.secret_material_included = $false
    Write-JsonReport -Report $report
    throw
}
