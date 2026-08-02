param(
    [string]$BaseUrl = "https://memoryendpoints.com",
    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-contract.json"
}
elseif (-not [System.IO.Path]::IsPathRooted($ReportPath)) {
    $ReportPath = Join-Path $RepoRoot $ReportPath
}

$serviceBase = $BaseUrl.TrimEnd('/')
if ($serviceBase -notmatch '^https://') {
    if ($serviceBase -notmatch '^http://(?:127\.0\.0\.1|localhost)(?::\d+)?$') {
        throw "BaseUrl must use HTTPS, except explicit loopback HTTP for tests."
    }
}
$matmBase = if ($serviceBase.EndsWith('/api/matm', [StringComparison]::OrdinalIgnoreCase)) {
    $serviceBase
}
else {
    "$serviceBase/api/matm"
}
$origin = ([Uri]$serviceBase).GetLeftPart([UriPartial]::Authority)
$capabilitiesUrl = "$matmBase/sync/capabilities"
$openApiUrl = "$matmBase/openapi.json"
$versionUrl = "$origin/api/version"
$corsOrigin = "https://tinyrustlm.com"

$expectedRoutes = [ordered]@{
    registerDevice = [ordered]@{ route = "/api/matm/sync/devices"; method = "POST" }
    rotateDevice = [ordered]@{ route = "/api/matm/sync/devices/rotate"; method = "POST" }
    revokeDevice = [ordered]@{ route = "/api/matm/sync/devices/revoke"; method = "POST" }
    submitMutation = [ordered]@{ route = "/api/matm/sync/mutations"; method = "POST" }
    lookupReceipt = [ordered]@{ route = "/api/matm/sync/receipts"; method = "GET" }
    changes = [ordered]@{ route = "/api/matm/sync/changes"; method = "GET" }
    heads = [ordered]@{ route = "/api/matm/sync/heads"; method = "GET" }
    retention = [ordered]@{ route = "/api/matm/sync/retention"; method = "GET" }
}

function Test-ExactProperties {
    param($Value, [string[]]$Expected)
    if ($null -eq $Value) {
        return $false
    }
    $actual = @($Value.PSObject.Properties.Name)
    return $actual.Count -eq $Expected.Count -and
        @($Expected | Where-Object { $actual -notcontains $_ }).Count -eq 0
}

function Test-ExactArray {
    param($Value, [string[]]$Expected)
    $actual = @($Value)
    if ($actual.Count -ne $Expected.Count) {
        return $false
    }
    for ($index = 0; $index -lt $Expected.Count; $index++) {
        if ([string]$actual[$index] -cne $Expected[$index]) {
            return $false
        }
    }
    return $true
}

function Invoke-PublicRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$Body = "",
        [hashtable]$Headers = @{}
    )
    try {
        $parameters = @{
            UseBasicParsing = $true
            Method = $Method
            Uri = $Uri
            Headers = $Headers
            TimeoutSec = 30
        }
        if ($Method -eq "POST") {
            $parameters.ContentType = "application/json"
            $parameters.Body = if ($Body) { $Body } else { "{}" }
        }
        $response = Invoke-WebRequest @parameters
        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            Text = [string]$response.Content
            Headers = $response.Headers
        }
    }
    catch {
        if (-not $_.Exception.Response) {
            throw
        }
        $response = $_.Exception.Response
        $text = ""
        try {
            $stream = $response.GetResponseStream()
            if ($stream) {
                $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8)
                try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
            }
        }
        catch {
            $text = ""
        }
        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            Text = $text
            Headers = $response.Headers
        }
    }
}

function Get-Header {
    param($Headers, [string]$Name)
    if ($null -eq $Headers) {
        return ""
    }
    $value = $Headers[$Name]
    if ($null -eq $value) {
        return ""
    }
    return [string]$value
}

function Test-CapabilityData {
    param($Data)
    if (-not (Test-ExactProperties $Data @(
        "schemaVersion", "status", "protocol", "capabilityRoute", "routes",
        "mutationContract", "checkpointContract", "deviceContract", "retention",
        "publicSafeOnly", "rawCredentialExposed", "rawPayloadExposed", "valuesRedacted"
    )) -or
        -not (Test-ExactProperties $Data.routes @($expectedRoutes.Keys)) -or
        -not (Test-ExactProperties $Data.mutationContract @(
            "operations", "hardForgetSupported", "hardForgetBehavior", "idempotency",
            "revisionFields", "conflictSemantics", "tombstoneSemantics"
        )) -or
        -not (Test-ExactProperties $Data.checkpointContract @(
            "changesQuery", "monotonicServerSequence", "indexedThroughWatermark",
            "paginationFields"
        )) -or
        -not (Test-ExactProperties $Data.deviceContract @(
            "authorityEpoch", "registerRotateRevoke", "revokedDeviceMutationBehavior",
            "secretMaterialStored"
        )) -or
        -not (Test-ExactProperties $Data.retention @(
            "tombstoneRetentionDays", "hardForgetSupported", "rawPrivatePayloadStored",
            "valuesRedacted"
        ))) {
        return $false
    }
    if ($Data.schemaVersion -cne "memoryendpoints.distributed_sync_capabilities.v1" -or
        $Data.status -cne "live" -or
        $Data.protocol -cne "memoryendpoints-distributed-sync-v1" -or
        $Data.capabilityRoute -cne "/api/matm/sync/capabilities" -or
        $Data.publicSafeOnly -ne $true -or $Data.valuesRedacted -ne $true -or
        $Data.rawCredentialExposed -ne $false -or $Data.rawPayloadExposed -ne $false) {
        return $false
    }
    foreach ($entry in $expectedRoutes.GetEnumerator()) {
        if ([string]$Data.routes.($entry.Key) -cne $entry.Value.route) {
            return $false
        }
    }
    if (-not (Test-ExactArray $Data.mutationContract.operations @("upsert", "delete", "hard_forget")) -or
        -not (Test-ExactArray $Data.mutationContract.revisionFields @(
            "logicalMemoryId", "parentRevisionId", "syncRevisionId", "serverSequence",
            "bodyHash", "conflict", "conflictCode"
        )) -or
        $Data.mutationContract.hardForgetSupported -ne $false -or
        $Data.mutationContract.hardForgetBehavior -cne "safe_rejected_receipt" -or
        [string]$Data.mutationContract.idempotency -notmatch 'Idempotency-Key' -or
        [string]::IsNullOrWhiteSpace([string]$Data.mutationContract.conflictSemantics) -or
        [string]::IsNullOrWhiteSpace([string]$Data.mutationContract.tombstoneSemantics)) {
        return $false
    }
    if (-not (Test-ExactArray $Data.checkpointContract.changesQuery @(
            "workspace_id", "after_sequence", "limit", "logical_memory_id"
        )) -or
        -not (Test-ExactArray $Data.checkpointContract.paginationFields @(
            "items", "hasMore", "nextAfterSequence", "indexedThroughSequence", "checkpoint"
        )) -or
        $Data.checkpointContract.monotonicServerSequence -ne $true -or
        $Data.checkpointContract.indexedThroughWatermark -ne $true -or
        $Data.deviceContract.authorityEpoch -ne $true -or
        $Data.deviceContract.registerRotateRevoke -ne $true -or
        $Data.deviceContract.revokedDeviceMutationBehavior -cne "safe_rejected_receipt" -or
        $Data.deviceContract.secretMaterialStored -ne $false -or
        $Data.retention.tombstoneRetentionDays -lt 1 -or
        $Data.retention.tombstoneRetentionDays -gt 3650 -or
        $Data.retention.hardForgetSupported -ne $false -or
        $Data.retention.rawPrivatePayloadStored -ne $false -or
        $Data.retention.valuesRedacted -ne $true) {
        return $false
    }
    return $true
}

$capabilityResponse = Invoke-PublicRequest -Method "GET" -Uri $capabilitiesUrl
$capabilityJson = $null
$capabilityShapeValid = $false
if ($capabilityResponse.StatusCode -eq 200) {
    try {
        $capabilityJson = $capabilityResponse.Text | ConvertFrom-Json
        $capabilityShapeValid =
            (Test-ExactProperties $capabilityJson @("ok", "data")) -and
            $capabilityJson.ok -eq $true -and
            (Test-CapabilityData $capabilityJson.data)
    }
    catch {
        $capabilityShapeValid = $false
    }
}
$capabilityNoStore = (Get-Header $capabilityResponse.Headers "Cache-Control") -match '(?i)(?:^|,)\s*no-store\s*(?:,|$)'

$routeEvidence = @()
$routeProbesPass = $true
foreach ($entry in $expectedRoutes.GetEnumerator()) {
    $route = $entry.Value.route
    $method = $entry.Value.method
    $probeUri = "$origin$route"
    $probe = Invoke-PublicRequest -Method $method -Uri $probeUri -Headers @{
        Origin = $corsOrigin
        "Idempotency-Key" = "tinyrustlm-contract-route-probe"
    }
    $exists = $probe.StatusCode -notin @(404, 405)
    if (-not $exists) {
        $routeProbesPass = $false
    }
    $routeEvidence += [ordered]@{
        name = $entry.Key
        route = $route
        method = $method
        unauthenticated_http_status = $probe.StatusCode
        route_exists = $exists
        safe_auth_rejection = $probe.StatusCode -in @(400, 401, 403, 413, 422)
    }
}

$corsProbe = Invoke-PublicRequest -Method "OPTIONS" -Uri "$matmBase/sync/mutations" -Headers @{
    Origin = $corsOrigin
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "authorization,content-type,idempotency-key"
}
$allowOrigin = Get-Header $corsProbe.Headers "Access-Control-Allow-Origin"
$allowHeaders = Get-Header $corsProbe.Headers "Access-Control-Allow-Headers"
$corsPass = $corsProbe.StatusCode -in @(200, 204) -and
    $allowOrigin -in @("*", $corsOrigin) -and
    $allowHeaders -match '(?i)authorization' -and
    $allowHeaders -match '(?i)idempotency-key'

$openApiResponse = Invoke-PublicRequest -Method "GET" -Uri $openApiUrl
$openApiAvailable = $openApiResponse.StatusCode -eq 200
$openApiPathsPass = $true
$openApiPathCount = 0
if ($openApiAvailable) {
    try {
        $openApi = $openApiResponse.Text | ConvertFrom-Json
        $openApiPathCount = @($openApi.paths.PSObject.Properties.Name).Count
        foreach ($entry in $expectedRoutes.GetEnumerator()) {
            $property = $openApi.paths.PSObject.Properties[$entry.Value.route]
            if ($null -eq $property -or
                $null -eq $property.Value.PSObject.Properties[$entry.Value.method.ToLowerInvariant()]) {
                $openApiPathsPass = $false
            }
        }
    }
    catch {
        $openApiPathsPass = $false
    }
}

$versionResponse = Invoke-PublicRequest -Method "GET" -Uri $versionUrl
$version = $null
if ($versionResponse.StatusCode -eq 200) {
    try { $version = $versionResponse.Text | ConvertFrom-Json } catch { $version = $null }
}

$status = if ($capabilityShapeValid -and $capabilityNoStore -and $routeProbesPass -and
    $corsPass -and (-not $openApiAvailable -or $openApiPathsPass)) {
    "pass"
}
else {
    "fail"
}

$report = [ordered]@{
    schema = "tinyrustlm.memory_endpoints.distributed_sync_contract_verification.v2"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = $status
    service_origin = $origin
    capability = [ordered]@{
        url = $capabilitiesUrl
        http_status = $capabilityResponse.StatusCode
        exact_shape_valid = $capabilityShapeValid
        cache_control_no_store = $capabilityNoStore
        schema_version = if ($capabilityJson) { $capabilityJson.data.schemaVersion } else { "" }
        protocol = if ($capabilityJson) { $capabilityJson.data.protocol } else { "" }
        hard_forget_supported = if ($capabilityJson) {
            $capabilityJson.data.mutationContract.hardForgetSupported -eq $true
        } else { $false }
    }
    protected_route_probes = $routeEvidence
    direct_cors = [ordered]@{
        options_http_status = $corsProbe.StatusCode
        allow_origin = $allowOrigin
        authorization_allowed = $allowHeaders -match '(?i)authorization'
        idempotency_key_allowed = $allowHeaders -match '(?i)idempotency-key'
        passed = $corsPass
    }
    openapi = [ordered]@{
        url = $openApiUrl
        available = $openApiAvailable
        http_status = $openApiResponse.StatusCode
        path_count = $openApiPathCount
        sync_paths_match = $openApiPathsPass
    }
    deployed_authority = [ordered]@{
        version_route_available = $versionResponse.StatusCode -eq 200
        source_sha = if ($version) { [string]$version.build.sourceSha } else { "" }
        store_backend = if ($version) { [string]$version.storeBackend } else { "" }
        store_backend_verified = if ($version) { $version.storeBackendVerified -eq $true } else { $false }
    }
    values_redacted = $true
    raw_credential_exposed = $false
    raw_payload_exposed = $false
    secret_material_included = $false
}

$reportDirectory = Split-Path -Parent $ReportPath
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host "Distributed-sync contract verification: $status"
Write-Host "Report: $ReportPath"
if ($status -ne "pass") {
    throw "MemoryEndpoints distributed-sync v1 contract verification failed. See the redacted report."
}
