param(
    [string]$RelayBaseUrl = $(if ($env:TINYRUSTLM_MEMORY_ENDPOINTS_RELAY_URL) { $env:TINYRUSTLM_MEMORY_ENDPOINTS_RELAY_URL } else { "https://tinyrustlm.com/api/memoryendpoints" }),
    [string]$WorkspaceId = $env:MEMORYENDPOINTS_WORKSPACE_ID,
    [string]$WorkspaceKey = $env:MEMORYENDPOINTS_WORKSPACE_KEY,
    [string]$AgentId = $(if ($env:MEMORYENDPOINTS_AGENT_ID) { $env:MEMORYENDPOINTS_AGENT_ID } else { "tinyrustlm-agent" }),
    [ValidateSet("authorization", "x-memoryendpoints-key")]
    [string]$AuthHeaderMode = $(if ($env:MEMORYENDPOINTS_AUTH_HEADER) { $env:MEMORYENDPOINTS_AUTH_HEADER } else { "authorization" }),
    [string]$Scope = "project",
    [string]$ScopeId = "tinyrustlm.com",
    [string]$ReportOutput = "",
    [int]$SearchRetries = 6,
    [int]$RetryDelaySeconds = 2,
    [switch]$AllowMissingCredentials
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-memory-endpoints-production-relay.json"
}

function Write-JsonReport {
    param([hashtable]$Report)

    $reportDirectory = Split-Path -Parent $ReportOutput
    if ($reportDirectory -and -not (Test-Path $reportDirectory)) {
        New-Item -ItemType Directory -Path $reportDirectory | Out-Null
    }
    $Report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
}

function New-RelayBaseUrl {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "TinyRustLM MemoryEndpoints relay URL is required."
    }
    if ($Value -match "(?i)bearer\s+|api[_-]?key|password|secret=") {
        throw "TinyRustLM MemoryEndpoints relay URL must not include credential material."
    }
    $uri = [Uri]$Value
    $loopbackHttp = $uri.Scheme -eq "http" -and ($uri.Host -in @("localhost", "127.0.0.1", "::1"))
    if ($uri.Scheme -ne "https" -and -not $loopbackHttp) {
        throw "TinyRustLM MemoryEndpoints relay URL must use HTTPS, except loopback HTTP for local tests."
    }
    if ($uri.UserInfo -or $uri.Query -or $uri.Fragment) {
        throw "TinyRustLM MemoryEndpoints relay URL must not include credentials, query strings, or fragments."
    }
    $normalizedPath = $uri.AbsolutePath.TrimEnd("/")
    if ($normalizedPath -ne "/api/memoryendpoints") {
        throw "TinyRustLM MemoryEndpoints relay URL must end at /api/memoryendpoints."
    }
    return $Value.TrimEnd("/")
}

function Join-RelayUrl {
    param(
        [string]$Base,
        [string]$Path
    )

    return "$($Base.TrimEnd("/"))$Path"
}

function Get-AuthHeaders {
    if ($AuthHeaderMode -eq "x-memoryendpoints-key") {
        return @{ "X-MemoryEndpoints-Key" = $WorkspaceKey }
    }
    return @{ Authorization = "Bearer $WorkspaceKey" }
}

function Invoke-RelayWebRequest {
    param(
        [ValidateSet("GET", "POST", "OPTIONS")]
        [string]$Method,
        [string]$Path,
        [hashtable]$Payload = $null,
        [hashtable]$Query = $null,
        [string]$IdempotencyPrefix = ""
    )

    $uri = [UriBuilder](Join-RelayUrl -Base $script:RelayBase -Path $Path)
    if ($Query) {
        $pairs = New-Object System.Collections.Generic.List[string]
        foreach ($entry in $Query.GetEnumerator()) {
            if ($null -ne $entry.Value -and "$($entry.Value)" -ne "") {
                $pairs.Add("$([Uri]::EscapeDataString($entry.Key))=$([Uri]::EscapeDataString("$($entry.Value)"))")
            }
        }
        $uri.Query = $pairs -join "&"
    }

    $headers = @{}
    if ($Method -ne "OPTIONS") {
        $headers = Get-AuthHeaders
        $headers["Accept"] = "application/json"
    }
    $body = $null
    if ($Method -eq "POST") {
        $headers["Content-Type"] = "application/json"
        $headers["Idempotency-Key"] = "$IdempotencyPrefix-$([Guid]::NewGuid().ToString("N"))"
        $body = $Payload | ConvertTo-Json -Depth 12
    }

    try {
        Invoke-WebRequest -Method $Method -Uri $uri.Uri.AbsoluteUri -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 30
    }
    catch {
        if ($_.Exception.Response) {
            return $_.Exception.Response
        }
        throw
    }
}

function Get-ResponseText {
    param($Response)

    if ($null -eq $Response) {
        return ""
    }
    if ($Response.PSObject.Properties.Name -contains "Content") {
        return [string]$Response.Content
    }
    try {
        $stream = $Response.GetResponseStream()
        if ($null -eq $stream) {
            return ""
        }
        $reader = [System.IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    catch {
        return ""
    }
}

function Get-ResponseStatus {
    param($Response)

    if ($Response.PSObject.Properties.Name -contains "StatusCode") {
        return [int]$Response.StatusCode
    }
    if ($Response.PSObject.Properties.Name -contains "Status") {
        return [int]$Response.Status
    }
    return 0
}

function Test-NoStoreHeader {
    param($Response)

    $headers = $Response.Headers
    if ($null -eq $headers) {
        return $false
    }
    $value = ""
    try {
        $value = [string]$headers["Cache-Control"]
    }
    catch {
        $value = ""
    }
    return $value.ToLowerInvariant().Contains("no-store")
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
        $text = ($item | ConvertTo-Json -Depth 12 -Compress)
        if ($text.Contains($Needle)) {
            return $true
        }
    }
    return $false
}

function Search-MemoryType {
    param(
        [string]$Marker,
        [string]$MemoryType
    )

    for ($attempt = 1; $attempt -le [Math]::Max(1, $SearchRetries); $attempt++) {
        $response = Invoke-RelayWebRequest -Method GET -Path "/api/matm/search" -Query @{
            workspaceId = $WorkspaceId
            agentId = $AgentId
            actor_agent_id = $AgentId
            query = $Marker
            scope = $Scope
            scopeId = $ScopeId
            memory_type = $MemoryType
            limit = 10
        }
        $status = Get-ResponseStatus -Response $response
        if ($status -ge 200 -and $status -lt 300) {
            $payload = Get-ResponseText -Response $response | ConvertFrom-Json
            $items = Get-ResponseItems -Payload $payload
            if (Test-ItemsContain -Items $items -Needle $Marker) {
                return $items
            }
        }
        if ($attempt -lt $SearchRetries) {
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
    return @()
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

$report = @{
    schema = "tinyrustlm.memory_endpoints.production_relay_verification.v0"
    status = "not_started"
    generated_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    relay_base_url = "<redacted-or-public-relay-url>"
    relay_url_present = -not [string]::IsNullOrWhiteSpace($RelayBaseUrl)
    workspace_id_present = -not [string]::IsNullOrWhiteSpace($WorkspaceId)
    workspace_key_present = -not [string]::IsNullOrWhiteSpace($WorkspaceKey)
    agent_id = $AgentId
    scope = $Scope
    scope_id = $ScopeId
    auth_header_mode = $AuthHeaderMode
    secret_material_included = $false
    report_path = $ReportOutput
}

try {
    $script:RelayBase = New-RelayBaseUrl -Value $RelayBaseUrl
    $report.relay_base_url = $script:RelayBase

    $preflight = Invoke-RelayWebRequest -Method OPTIONS -Path "/api/matm/agents/register"
    $report.preflight_status = Get-ResponseStatus -Response $preflight
    $report.preflight_no_store = Test-NoStoreHeader -Response $preflight

    $modelRoute = Invoke-RelayWebRequest -Method GET -Path "/models/probe.slm"
    $modelRouteStatus = Get-ResponseStatus -Response $modelRoute
    $report.model_route_status = $modelRouteStatus
    $report.model_route_rejected = $modelRouteStatus -ge 400

    $routeFailures = @()
    if ($report.preflight_status -ne 204) { $routeFailures += "preflight_status=$($report.preflight_status)" }
    if (-not $report.model_route_rejected) { $routeFailures += "model route was not rejected" }
    if ($routeFailures.Count -gt 0) {
        $report.status = "fail_route_contract"
        $report.failures = $routeFailures
        Write-JsonReport -Report $report
        throw "TinyRustLM MemoryEndpoints production relay route contract failed: $($routeFailures -join '; ')"
    }

    if ([string]::IsNullOrWhiteSpace($WorkspaceId) -or [string]::IsNullOrWhiteSpace($WorkspaceKey)) {
        $report.status = if ($AllowMissingCredentials) { "skipped_missing_credentials" } else { "blocked_missing_credentials" }
        $report.required_environment = @("MEMORYENDPOINTS_WORKSPACE_ID", "MEMORYENDPOINTS_WORKSPACE_KEY")
        Write-JsonReport -Report $report
        if ($AllowMissingCredentials) {
            Write-Host "TinyRustLM MemoryEndpoints production relay verification skipped: missing credentials. Report: $ReportOutput"
            exit 0
        }
        throw "MEMORYENDPOINTS_WORKSPACE_ID and MEMORYENDPOINTS_WORKSPACE_KEY are required."
    }

    $marker = "tinyrustlm-production-relay-$((Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))-$([Guid]::NewGuid().ToString("N").Substring(0, 12))"
    $shortMarker = "$marker short_term_status_probe"
    $longMarker = "$marker long_term_handoff_probe"
    $report.marker_sha256 = Get-Sha256Hex -Value $marker

    $register = Invoke-RelayWebRequest -Method POST -Path "/api/matm/agents/register" -IdempotencyPrefix "tinyrustlm-production-relay-register" -Payload @{
        workspaceId = $WorkspaceId
        agentId = $AgentId
        displayName = "TinyRustLM Production Relay Verifier"
        safeSummary = "TinyRustLM production same-origin MemoryEndpoints relay verifier."
    }
    $report.register_status = Get-ResponseStatus -Response $register
    $report.register_no_store = Test-NoStoreHeader -Response $register

    $shortSave = Invoke-RelayWebRequest -Method POST -Path "/api/matm/memory-events/submit" -IdempotencyPrefix "tinyrustlm-production-relay-short" -Payload @{
        workspaceId = $WorkspaceId
        actorAgentId = $AgentId
        kind = "tinyrustlm.memory_endpoints.memory_record.v1"
        version = 1
        scope = $Scope
        scopeId = $ScopeId
        memoryType = "status"
        subject = "TinyRustLM production relay short-term verifier"
        title = "TinyRustLM production relay short-term verifier"
        summary = "Public-safe TinyRustLM production relay short-term memory probe $shortMarker."
        source = "eng/verify-memory-endpoints-relay-production.ps1"
        confidence = 0.8
        uaiReferences = @(".uai/short-term-memory.uai", "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md")
        tags = @("tinyrustlm", "memoryendpoints", "production-relay", "short-term", "scope:$ScopeId", $marker)
        tinyrustlmMemoryTier = "short_term"
    }
    $report.short_save_status = Get-ResponseStatus -Response $shortSave
    $report.short_save_no_store = Test-NoStoreHeader -Response $shortSave

    $longSave = Invoke-RelayWebRequest -Method POST -Path "/api/matm/memory-events/submit" -IdempotencyPrefix "tinyrustlm-production-relay-long" -Payload @{
        workspaceId = $WorkspaceId
        actorAgentId = $AgentId
        kind = "tinyrustlm.memory_endpoints.memory_record.v1"
        version = 1
        scope = $Scope
        scopeId = $ScopeId
        memoryType = "handoff"
        subject = "TinyRustLM production relay long-term verifier"
        title = "TinyRustLM production relay long-term verifier"
        summary = "Public-safe TinyRustLM production relay long-term memory probe $longMarker."
        source = "eng/verify-memory-endpoints-relay-production.ps1"
        confidence = 0.8
        uaiReferences = @(".uai/long-term-memory.uai", "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md")
        tags = @("tinyrustlm", "memoryendpoints", "production-relay", "long-term", "scope:$ScopeId", $marker)
        tinyrustlmMemoryTier = "long_term"
    }
    $report.long_save_status = Get-ResponseStatus -Response $longSave
    $report.long_save_no_store = Test-NoStoreHeader -Response $longSave

    $statusItems = @(Search-MemoryType -Marker $marker -MemoryType "status")
    $handoffItems = @(Search-MemoryType -Marker $marker -MemoryType "handoff")
    $report.status_search_result_count = $statusItems.Count
    $report.handoff_search_result_count = $handoffItems.Count
    $report.short_term_found = Test-ItemsContain -Items $statusItems -Needle $shortMarker
    $report.long_term_found = Test-ItemsContain -Items $handoffItems -Needle $longMarker
    $report.status_search_excluded_long = -not (Test-ItemsContain -Items $statusItems -Needle $longMarker)
    $report.handoff_search_excluded_short = -not (Test-ItemsContain -Items $handoffItems -Needle $shortMarker)

    $failures = @()
    if ($report.register_status -lt 200 -or $report.register_status -ge 300) { $failures += "register_status=$($report.register_status)" }
    if ($report.short_save_status -lt 200 -or $report.short_save_status -ge 300) { $failures += "short_save_status=$($report.short_save_status)" }
    if ($report.long_save_status -lt 200 -or $report.long_save_status -ge 300) { $failures += "long_save_status=$($report.long_save_status)" }
    if (-not $report.short_term_found) { $failures += "short-term status memory not found" }
    if (-not $report.long_term_found) { $failures += "long-term handoff memory not found" }
    if (-not $report.status_search_excluded_long) { $failures += "status search included long-term marker" }
    if (-not $report.handoff_search_excluded_short) { $failures += "handoff search included short-term marker" }
    if (-not ($report.register_no_store -and $report.short_save_no_store -and $report.long_save_no_store)) { $failures += "relay responses did not consistently return no-store" }

    $report.failures = $failures
    $report.status = if ($failures.Count -eq 0) { "pass" } else { "fail" }
    Write-JsonReport -Report $report
    if ($failures.Count -gt 0) {
        throw "TinyRustLM MemoryEndpoints production relay verification failed: $($failures -join '; ')"
    }
    Write-Host "TinyRustLM MemoryEndpoints production relay verification passed. Report: $ReportOutput"
}
catch {
    if ($report.status -eq "not_started") {
        $report.status = "fail"
        $report.error = $_.Exception.Message
        Write-JsonReport -Report $report
    }
    throw
}
