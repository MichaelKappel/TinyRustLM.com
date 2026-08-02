param(
    [string]$BaseUrl = "https://memoryendpoints.com",
    [string]$WorkspaceId = $env:MEMORYENDPOINTS_WORKSPACE_ID,
    [string]$AgentId = "tinyrustlm-agent",
    [string]$ScopeId = "goal-tinyrustlm-hosted-memory",
    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-live.json"
}
elseif (-not [IO.Path]::IsPathRooted($ReportPath)) {
    $ReportPath = Join-Path $RepoRoot $ReportPath
}
$workspaceKey = $env:MEMORYENDPOINTS_WORKSPACE_KEY
if ([string]::IsNullOrWhiteSpace($workspaceKey) -or [string]::IsNullOrWhiteSpace($WorkspaceId)) {
    throw "MEMORYENDPOINTS_WORKSPACE_ID and MEMORYENDPOINTS_WORKSPACE_KEY are required in the current process environment."
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
$runId = ([DateTimeOffset]::UtcNow.ToString("yyyyMMddHHmmss") + "-" + [Guid]::NewGuid().ToString("N").Substring(0, 12)).ToLowerInvariant()
$deviceA = "tinyrustlm-live-a-$runId"
$deviceB = "tinyrustlm-live-b-$runId"
$logicalMemoryId = "tinyrustlm-live-memory-$runId"
$responseTexts = New-Object System.Collections.Generic.List[string]

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Get-Sha256 {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return (([BitConverter]::ToString(
            $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function ConvertTo-CompactJson {
    param($Value)
    return $Value | ConvertTo-Json -Depth 20 -Compress
}

function Get-Header {
    param($Headers, [string]$Name)
    if ($null -eq $Headers -or $null -eq $Headers[$Name]) {
        return ""
    }
    return [string]$Headers[$Name]
}

function Invoke-SyncRequest {
    param(
        [string]$Method,
        [string]$Route,
        [object]$Body = $null,
        [string]$IdempotencyKey = "",
        [int[]]$ExpectedStatus = @(200),
        [switch]$Public
    )
    $headers = @{ Accept = "application/json"; Origin = "https://tinyrustlm.com" }
    if (-not $Public) {
        $headers.Authorization = "Bearer $workspaceKey"
    }
    if ($IdempotencyKey) {
        $headers["Idempotency-Key"] = $IdempotencyKey
    }
    $parameters = @{
        UseBasicParsing = $true
        Method = $Method
        Uri = "$origin$Route"
        Headers = $headers
        TimeoutSec = 45
    }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = ConvertTo-CompactJson $Body
    }
    try {
        $response = Invoke-WebRequest @parameters
        $statusCode = [int]$response.StatusCode
        $text = [string]$response.Content
        $responseHeaders = $response.Headers
    }
    catch {
        if (-not $_.Exception.Response) {
            throw "MemoryEndpoints live request failed before an HTTP response."
        }
        $response = $_.Exception.Response
        $statusCode = [int]$response.StatusCode
        $responseHeaders = $response.Headers
        $text = [string]$_.ErrorDetails.Message
        if ([string]::IsNullOrWhiteSpace($text)) {
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
        }
    }
    Assert-True ($ExpectedStatus -contains $statusCode) "Unexpected live distributed-sync HTTP status $statusCode."
    Assert-True ((Get-Header $responseHeaders "Cache-Control") -match '(?i)(?:^|,)\s*no-store\s*(?:,|$)') "Live distributed-sync response omitted Cache-Control: no-store."
    Assert-True (-not [string]::IsNullOrWhiteSpace($text)) "Live distributed-sync response body is empty for $Method $Route ($statusCode)."
    Assert-True ([Text.Encoding]::UTF8.GetByteCount($text) -le 256 * 1024) "Live distributed-sync response exceeds 256 KiB."
    Assert-True ($text.IndexOf($workspaceKey, [StringComparison]::Ordinal) -lt 0) "Live response exposed protected authentication material."
    $responseTexts.Add($text)
    try {
        $json = $text | ConvertFrom-Json
    }
    catch {
        throw "Live distributed-sync response was not valid JSON."
    }
    return [pscustomobject]@{ StatusCode = $statusCode; Json = $json; Text = $text }
}

function Test-Redacted {
    param($Value)
    return $null -ne $Value -and
        $Value.valuesRedacted -eq $true -and
        $Value.rawCredentialExposed -eq $false -and
        $Value.rawPayloadExposed -eq $false
}

function New-DeviceBody {
    param([string]$DeviceId, [switch]$IncludeLabel)
    $body = [ordered]@{
        workspaceId = $WorkspaceId
        agentId = $AgentId
        deviceId = $DeviceId
    }
    if ($IncludeLabel) {
        $body.label = "TinyRustLM live verification device"
    }
    return $body
}

function New-MutationBody {
    param(
        [string]$DeviceId,
        [uint64]$DeviceEpoch,
        [string]$LogicalId,
        [string]$Operation,
        [string]$Summary,
        [string]$ParentRevisionId = ""
    )
    $title = "TinyRustLM distributed sync live verification"
    $source = "tinyrustlm://distributed-sync/live-verification"
    $projection = [ordered]@{
        logicalMemoryId = $LogicalId
        operation = $Operation
        parentRevisionId = $ParentRevisionId
        source = $source
        summary = $Summary
        title = $title
    }
    $bodyHash = Get-Sha256 (ConvertTo-CompactJson $projection)
    $body = [ordered]@{
        workspaceId = $WorkspaceId
        actorAgentId = $AgentId
        deviceId = $DeviceId
        deviceEpoch = $DeviceEpoch
        logicalMemoryId = $LogicalId
        operation = $Operation
    }
    if ($ParentRevisionId) {
        $body.parentRevisionId = $ParentRevisionId
    }
    $body.title = $title
    $body.summary = $Summary
    $body.sourceRef = $source
    $body.scope = "goal"
    $body.scopeId = $ScopeId
    $body.memoryType = "handoff"
    $body.bodyHash = $bodyHash
    return $body
}

function Assert-DeviceResponse {
    param($Response, [string]$DeviceId, [string]$Status)
    Assert-True (Test-Redacted $Response) "Device response violated redaction boundary."
    Assert-True ($Response.ok -eq $true -and $Response.persisted -eq $true -and
        $Response.deviceAuthorityPersisted -eq $true) "Device authority was not persisted."
    Assert-True ($Response.device.deviceId -ceq $DeviceId -and
        $Response.device.status -ceq $Status -and
        $Response.device.authorityEpoch -gt 0) "Device authority identity was inconsistent."
}

function Assert-MutationResponse {
    param($Response, [string]$Status, [string]$LogicalId, [string]$BodyHash)
    Assert-True (Test-Redacted $Response) "Mutation response violated redaction boundary."
    Assert-True ($Response.persisted -eq $true -and $Response.confirmation.persisted -eq $true -and
        $Response.confirmation.receiptVisible -eq $true) "Mutation response lacked authoritative confirmation."
    Assert-True ($Response.status -ceq $Status -and $Response.receipt.status -ceq $Status -and
        $Response.receipt.logicalMemoryId -ceq $LogicalId -and
        $Response.receipt.bodyHash -ceq $BodyHash) "Mutation receipt identity was inconsistent."
    Assert-True ($Response.receipt.idempotencyKeyExposed -eq $false) "Mutation response exposed its idempotency key."
}

$capability = Invoke-SyncRequest -Method "GET" -Route "/api/matm/sync/capabilities" -Public
Assert-True ($capability.Json.ok -eq $true -and $capability.Json.data.status -ceq "live") "Live capability contract is not active."
$version = Invoke-SyncRequest -Method "GET" -Route "/api/version" -Public
Assert-True ($version.Json.storeBackendVerified -eq $true -and
    [string]$version.Json.storeBackend -match '^(mysql|mariadb)$') "Live authority is not verified against MySQL/MariaDB."

$registerA = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/devices" `
    -Body (New-DeviceBody $deviceA -IncludeLabel) -IdempotencyKey "device-register-a-$runId" -ExpectedStatus @(201)
Assert-DeviceResponse $registerA.Json $deviceA "active"
$registerB = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/devices" `
    -Body (New-DeviceBody $deviceB -IncludeLabel) -IdempotencyKey "device-register-b-$runId" -ExpectedStatus @(201)
Assert-DeviceResponse $registerB.Json $deviceB "active"

$rootBody = New-MutationBody $deviceA 1 $logicalMemoryId "upsert" "Public-safe root memory for TinyRustLM live synchronization verification."
$rootKey = "mutation-root-$runId"
$root = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $rootBody -IdempotencyKey $rootKey -ExpectedStatus @(202)
Assert-MutationResponse $root.Json "applied" $logicalMemoryId $rootBody.bodyHash
Assert-True ($root.Json.confirmation.revisionVisibleInChanges -eq $true -and
    $root.Json.confirmation.headVisible -eq $true) "Root mutation was not visible in changes and heads."
$rootRevisionId = [string]$root.Json.revision.syncRevisionId

$replay = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $rootBody -IdempotencyKey $rootKey -ExpectedStatus @(202)
Assert-MutationResponse $replay.Json "applied" $logicalMemoryId $rootBody.bodyHash
Assert-True ($replay.Json.idempotentReplay -eq $true -and
    $replay.Json.receipt.receiptId -ceq $root.Json.receipt.receiptId) "Exact replay did not preserve the original receipt."

$receiptRoute = "/api/matm/sync/receipts?workspace_id=$([Uri]::EscapeDataString($WorkspaceId))"
$receipt = Invoke-SyncRequest -Method "GET" -Route $receiptRoute -IdempotencyKey $rootKey
Assert-True ($receipt.Json.receipt.receiptId -ceq $root.Json.receipt.receiptId -and
    $receipt.Json.receipt.bodyHash -ceq $rootBody.bodyHash -and
    $receipt.Text.IndexOf($rootKey, [StringComparison]::Ordinal) -lt 0) "Receipt lookup failed identity or key-redaction checks."

$rootSequence = [uint64]$root.Json.serverSequence
$changesRoute = "/api/matm/sync/changes?workspace_id=$([Uri]::EscapeDataString($WorkspaceId))&after_sequence=$($rootSequence - 1)&limit=50&logical_memory_id=$([Uri]::EscapeDataString($logicalMemoryId))"
$rootChanges = Invoke-SyncRequest -Method "GET" -Route $changesRoute
Assert-True ($rootChanges.Json.changes.count -ge 1 -and
    @($rootChanges.Json.changes.items).syncRevisionId -contains $rootRevisionId -and
    $rootChanges.Json.changes.nextAfterSequence -ge $rootSequence -and
    $rootChanges.Json.changes.indexedThroughSequence -ge $rootSequence) "Incremental pull did not return the root revision and checkpoint."

$headsRoute = "/api/matm/sync/heads?workspace_id=$([Uri]::EscapeDataString($WorkspaceId))&logical_memory_id=$([Uri]::EscapeDataString($logicalMemoryId))"
$rootHead = Invoke-SyncRequest -Method "GET" -Route $headsRoute
Assert-True ($rootHead.Json.count -eq 1 -and
    $rootHead.Json.items[0].headRevisionId -ceq $rootRevisionId) "Root head readback failed."

$editABody = New-MutationBody $deviceA 1 $logicalMemoryId "upsert" "Public-safe device A edit for concurrent synchronization verification." $rootRevisionId
$editA = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $editABody -IdempotencyKey "mutation-edit-a-$runId" -ExpectedStatus @(202)
Assert-MutationResponse $editA.Json "applied" $logicalMemoryId $editABody.bodyHash
$editARevisionId = [string]$editA.Json.revision.syncRevisionId

$editBBody = New-MutationBody $deviceB 1 $logicalMemoryId "upsert" "Public-safe device B concurrent edit for conflict verification." $rootRevisionId
$conflict = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $editBBody -IdempotencyKey "mutation-edit-b-$runId" -ExpectedStatus @(409)
Assert-MutationResponse $conflict.Json "conflict" $logicalMemoryId $editBBody.bodyHash
Assert-True ($conflict.Json.receipt.conflictCode -ceq "parent_revision_mismatch") "Stale-parent conflict code was not explicit."
$headAfterConflict = Invoke-SyncRequest -Method "GET" -Route $headsRoute
Assert-True ($headAfterConflict.Json.items[0].headRevisionId -ceq $editARevisionId) "Stale conflict silently overwrote the authoritative head."

$deleteBody = New-MutationBody $deviceA 1 $logicalMemoryId "delete" "Public-safe tombstone for TinyRustLM live synchronization verification." $editARevisionId
$deleted = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $deleteBody -IdempotencyKey "mutation-delete-$runId" -ExpectedStatus @(202)
Assert-MutationResponse $deleted.Json "applied" $logicalMemoryId $deleteBody.bodyHash
Assert-True ($deleted.Json.head.status -ceq "tombstoned") "Delete did not create a tombstoned head."

$resurrectBody = New-MutationBody $deviceB 1 $logicalMemoryId "upsert" "Public-safe blocked resurrection verification." $deleted.Json.revision.syncRevisionId
$resurrection = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $resurrectBody -IdempotencyKey "mutation-resurrect-$runId" -ExpectedStatus @(409)
Assert-MutationResponse $resurrection.Json "conflict" $logicalMemoryId $resurrectBody.bodyHash
Assert-True ($resurrection.Json.receipt.conflictCode -ceq "tombstone_resurrection_blocked") "Tombstone resurrection was not explicitly blocked."

$rotateA = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/devices/rotate" `
    -Body (New-DeviceBody $deviceA) -IdempotencyKey "device-rotate-a-$runId"
Assert-DeviceResponse $rotateA.Json $deviceA "active"
Assert-True ($rotateA.Json.device.authorityEpoch -eq 2) "Device rotation did not advance the authority epoch."

$staleEpochBody = New-MutationBody $deviceA 1 "tinyrustlm-live-stale-epoch-$runId" "upsert" "Public-safe stale authority epoch verification."
$staleEpoch = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $staleEpochBody -IdempotencyKey "mutation-stale-epoch-$runId" -ExpectedStatus @(409)
Assert-MutationResponse $staleEpoch.Json "rejected" $staleEpochBody.logicalMemoryId $staleEpochBody.bodyHash
Assert-True ($staleEpoch.Json.receipt.conflictCode -ceq "device_epoch_mismatch") "Stale device epoch was not rejected."

$revokeB = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/devices/revoke" `
    -Body (New-DeviceBody $deviceB) -IdempotencyKey "device-revoke-b-$runId"
Assert-DeviceResponse $revokeB.Json $deviceB "revoked"
$revokedBody = New-MutationBody $deviceB 1 "tinyrustlm-live-revoked-$runId" "upsert" "Public-safe revoked device write verification."
$revokedMutation = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $revokedBody -IdempotencyKey "mutation-revoked-$runId" -ExpectedStatus @(409)
Assert-MutationResponse $revokedMutation.Json "rejected" $revokedBody.logicalMemoryId $revokedBody.bodyHash
Assert-True ($revokedMutation.Json.receipt.conflictCode -ceq "device_revoked") "Revoked device write was not rejected."

$hardForgetBody = New-MutationBody $deviceA 2 $logicalMemoryId "hard_forget" "Public-safe unsupported hard-forget verification." $deleted.Json.revision.syncRevisionId
$hardForget = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/mutations" `
    -Body $hardForgetBody -IdempotencyKey "mutation-hard-forget-$runId" -ExpectedStatus @(409)
Assert-MutationResponse $hardForget.Json "rejected" $logicalMemoryId $hardForgetBody.bodyHash
Assert-True ($hardForget.Json.receipt.conflictCode -ceq "hard_forget_not_supported") "Unsupported hard forget did not return a durable rejected receipt."

$retentionRoute = "/api/matm/sync/retention?workspace_id=$([Uri]::EscapeDataString($WorkspaceId))"
$retention = Invoke-SyncRequest -Method "GET" -Route $retentionRoute
Assert-True ($retention.Json.policy.tombstoneRetentionDays -gt 0 -and
    $retention.Json.policy.hardForgetSupported -eq $false -and
    $retention.Json.policy.rawPrivatePayloadStored -eq $false) "Retention policy was incomplete or unsafe."

$revokeA = Invoke-SyncRequest -Method "POST" -Route "/api/matm/sync/devices/revoke" `
    -Body (New-DeviceBody $deviceA) -IdempotencyKey "device-revoke-a-$runId"
Assert-DeviceResponse $revokeA.Json $deviceA "revoked"

$responseSecretFree = @($responseTexts | Where-Object {
    $_.IndexOf($workspaceKey, [StringComparison]::Ordinal) -ge 0
}).Count -eq 0
Assert-True $responseSecretFree "Protected authentication material appeared in live response evidence."

$report = [ordered]@{
    schema = "tinyrustlm.memory_endpoints.distributed_sync_live_verification.v1"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = "pass"
    service_origin = $origin
    workspace_id_sha256 = Get-Sha256 $WorkspaceId
    run_id = $runId
    deployed_authority = [ordered]@{
        source_sha = [string]$version.Json.build.sourceSha
        store_backend = [string]$version.Json.storeBackend
        store_backend_verified = $version.Json.storeBackendVerified -eq $true
    }
    capability_live = $capability.Json.data.status -ceq "live"
    device_a_registered = $registerA.Json.persisted -eq $true
    device_b_registered = $registerB.Json.persisted -eq $true
    mutation_applied = $root.Json.status -ceq "applied"
    confirmation_persisted = $root.Json.confirmation.persisted -eq $true
    replay_same_receipt = $replay.Json.receipt.receiptId -ceq $root.Json.receipt.receiptId
    receipt_lookup_verified = $receipt.Json.receipt.receiptId -ceq $root.Json.receipt.receiptId
    incremental_pull_verified = $rootChanges.Json.changes.count -ge 1
    checkpoint_next_sequence = [uint64]$rootChanges.Json.changes.nextAfterSequence
    indexed_through_sequence = [uint64]$rootChanges.Json.changes.indexedThroughSequence
    stale_parent_conflict_verified = $conflict.Json.receipt.conflictCode -ceq "parent_revision_mismatch"
    conflict_preserved_head = $headAfterConflict.Json.items[0].headRevisionId -ceq $editARevisionId
    tombstone_verified = $deleted.Json.head.status -ceq "tombstoned"
    resurrection_blocked = $resurrection.Json.receipt.conflictCode -ceq "tombstone_resurrection_blocked"
    authority_epoch_rotated = $rotateA.Json.device.authorityEpoch -eq 2
    stale_epoch_rejected = $staleEpoch.Json.receipt.conflictCode -ceq "device_epoch_mismatch"
    revoked_device_rejected = $revokedMutation.Json.receipt.conflictCode -ceq "device_revoked"
    hard_forget_rejected_with_receipt = $hardForget.Json.receipt.conflictCode -ceq "hard_forget_not_supported"
    retention_days = [int]$retention.Json.policy.tombstoneRetentionDays
    devices_revoked_after_test = $revokeA.Json.device.status -ceq "revoked" -and $revokeB.Json.device.status -ceq "revoked"
    response_secret_scan_passed = $responseSecretFree
    idempotency_key_exposed = $false
    token_in_request_body = $false
    values_redacted = $true
    raw_credential_exposed = $false
    raw_payload_exposed = $false
    secret_material_included = $false
}

$reportDirectory = Split-Path -Parent $ReportPath
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host "Distributed-sync live lifecycle verification: pass"
Write-Host "Report: $ReportPath"
