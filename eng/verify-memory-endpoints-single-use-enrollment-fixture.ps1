[CmdletBinding()]
param(
    [string]$ReportOutput = "artifacts/reports/tinyrustlm-memory-endpoints-single-use-enrollment-fixture.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$verifier = Join-Path $PSScriptRoot "verify-memory-endpoints-single-use-enrollment-live.ps1"

function Get-FreeLoopbackPort {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try {
        $probe.Start()
        return ([Net.IPEndPoint]$probe.LocalEndpoint).Port
    }
    finally {
        $probe.Stop()
    }
}

function Start-EnrollmentFixtureServer {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][ValidateSet("pass", "replay-succeeds")][string]$Scenario
    )

    return Start-Job -ArgumentList $Port, $Scenario -ScriptBlock {
        param($Port, $Scenario)

        $ErrorActionPreference = "Stop"
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
        $calls = [System.Collections.Generic.List[string]]::new()
        $workspaceId = "workspace-fixture"
        $canonicalAgentName = "TinyRustLM-fixture"
        $workspaceKey = "wsk_" + ("a" * 48)
        $agentToken = "agt_" + ("b" * 48)
        $invitationUrl = "https://fixture.invalid/enroll/" + ("c" * 48)
        $deadline = [DateTime]::UtcNow.AddSeconds(20)
        $deleted = $false

        function Send-JsonResponse {
            param(
                [Parameter(Mandatory = $true)][IO.Stream]$Stream,
                [Parameter(Mandatory = $true)][int]$StatusCode,
                [Parameter(Mandatory = $true)][object]$Payload
            )

            $json = $Payload | ConvertTo-Json -Depth 12 -Compress
            $bytes = [Text.Encoding]::UTF8.GetBytes($json)
            $reason = switch ($StatusCode) {
                200 { "OK" }
                201 { "Created" }
                410 { "Gone" }
                default { "Error" }
            }
            $header = "HTTP/1.1 $StatusCode $reason`r`nContent-Type: application/json`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
            $Stream.Write($headerBytes, 0, $headerBytes.Length)
            $Stream.Write($bytes, 0, $bytes.Length)
            $Stream.Flush()
        }

        try {
            $listener.Start()
            while (-not $deleted -and [DateTime]::UtcNow -lt $deadline) {
                if (-not $listener.Pending()) {
                    Start-Sleep -Milliseconds 20
                    continue
                }

                $client = $listener.AcceptTcpClient()
                try {
                    $stream = $client.GetStream()
                    $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $false, 4096, $true)
                    try {
                        $requestLine = $reader.ReadLine()
                        if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
                        $parts = $requestLine.Split(" ")
                        $method = $parts[0]
                        $path = $parts[1].Split("?")[0]
                        $headers = @{}
                        while ($true) {
                            $line = $reader.ReadLine()
                            if ([string]::IsNullOrEmpty($line)) { break }
                            $separator = $line.IndexOf(":")
                            if ($separator -gt 0) {
                                $headers[$line.Substring(0, $separator).Trim()] = $line.Substring($separator + 1).Trim()
                            }
                        }
                        if ($headers.ContainsKey("Content-Length")) {
                            $contentLength = [int]$headers["Content-Length"]
                            if ($contentLength -gt 0) {
                                $body = New-Object char[] $contentLength
                                $read = 0
                                while ($read -lt $contentLength) {
                                    $count = $reader.Read($body, $read, $contentLength - $read)
                                    if ($count -le 0) { break }
                                    $read += $count
                                }
                            }
                        }
                        $calls.Add("$method $path")

                        switch ("$method $path") {
                            "GET /api/matm/connector-contract" {
                                Send-JsonResponse $stream 200 @{
                                    ok = $true
                                    data = @{
                                        singleAgentEnrollment = @{
                                            schemaVersion = "memoryendpoints.single_agent_enrollment_contract.v1"
                                            status = "live"
                                            singleUseUrl = $true
                                            postClaimOnly = $true
                                            atomicOneWinner = $true
                                            lostResponseIdempotentRecovery = $true
                                            agentScopedToken = $true
                                            workspaceHiddenOnReconnect = $true
                                            virtualUaiStartupRestore = $true
                                            shortTermRestore = $true
                                            longTermRestore = $true
                                            routes = @{
                                                createCompany = "/api/matm/test/companies/create"
                                                issueInvitation = "/api/matm/test/enrollment/invitations"
                                                claimInvitation = "/api/matm/test/enrollment/claim"
                                                reconnect = "/api/matm/test/enrollment/reconnect"
                                                closeCompany = "/api/matm/test/companies/close"
                                                deleteCompany = "/api/matm/test/companies/delete"
                                            }
                                        }
                                    }
                                }
                            }
                            "POST /api/matm/test/companies/create" {
                                Send-JsonResponse $stream 201 @{ workspaceId = $workspaceId; workspaceKey = $workspaceKey }
                            }
                            "POST /api/matm/test/enrollment/invitations" {
                                Send-JsonResponse $stream 201 @{ invitationUrl = $invitationUrl; persisted = $true }
                            }
                            "POST /api/matm/test/enrollment/claim" {
                                $idempotencyKey = [string]$headers["Idempotency-Key"]
                                if ($idempotencyKey.Contains("claim-replay")) {
                                    if ($Scenario -eq "replay-succeeds") {
                                        Send-JsonResponse $stream 200 @{
                                            ok = $true
                                            persisted = $true
                                            urlConsumed = $false
                                            canonicalAgentName = $canonicalAgentName
                                            agentToken = $agentToken
                                        }
                                    }
                                    else {
                                        Send-JsonResponse $stream 410 @{
                                            ok = $false
                                            safeNoOp = $true
                                            error = @{ code = "enrollment_url_consumed" }
                                        }
                                    }
                                }
                                else {
                                    Send-JsonResponse $stream 201 @{
                                        ok = $true
                                        persisted = $true
                                        urlConsumed = $true
                                        canonicalAgentName = $canonicalAgentName
                                        agentToken = $agentToken
                                    }
                                }
                            }
                            "POST /api/matm/test/enrollment/reconnect" {
                                Send-JsonResponse $stream 200 @{
                                    canonicalAgentName = $canonicalAgentName
                                    workspaceId = $workspaceId
                                    readyForStartup = $true
                                }
                            }
                            "POST /api/matm/test/companies/close" {
                                Send-JsonResponse $stream 200 @{ closed = $true }
                            }
                            "DELETE /api/matm/test/companies/delete" {
                                Send-JsonResponse $stream 200 @{ deleted = $true }
                                $deleted = $true
                            }
                            default {
                                Send-JsonResponse $stream 404 @{ ok = $false; error = @{ code = "not_found" } }
                            }
                        }
                    }
                    finally {
                        $reader.Dispose()
                    }
                }
                finally {
                    $client.Dispose()
                }
            }
        }
        finally {
            $listener.Stop()
        }

        [pscustomobject]@{
            deleted = $deleted
            calls = @($calls)
        }
    }
}

function Invoke-FixtureScenario {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("pass", "replay-succeeds")][string]$Scenario,
        [Parameter(Mandatory = $true)][bool]$ExpectVerifierFailure
    )

    $port = Get-FreeLoopbackPort
    $baseUrl = "http://127.0.0.1:$port"
    $tempRelativeReport = "artifacts/reports/.tinyrustlm-enrollment-$Scenario-$([Guid]::NewGuid().ToString('N')).json"
    $tempReport = Join-Path $repoRoot $tempRelativeReport
    $job = Start-EnrollmentFixtureServer -Port $port -Scenario $Scenario
    $verifierFailed = $false
    $verifierError = "none"
    try {
        Start-Sleep -Milliseconds 350
        try {
            & $verifier -BaseUrl $baseUrl -CoordinatorWorkspaceId "" -CoordinatorWorkspaceKey "" `
                -ReportOutput $tempRelativeReport *> $null
        }
        catch {
            $verifierFailed = $true
            $verifierError = $_.Exception.Message
        }

        $completed = Wait-Job -Job $job -Timeout 25
        if ($null -eq $completed) {
            throw "Fixture server timed out for scenario $Scenario."
        }
        $serverResult = Receive-Job -Job $job
        if (-not (Test-Path -LiteralPath $tempReport)) {
            throw "Verifier did not write a report for scenario $Scenario. Error: $verifierError"
        }
        $scenarioReport = Get-Content -LiteralPath $tempReport -Raw | ConvertFrom-Json
        if ($verifierFailed -ne $ExpectVerifierFailure) {
            throw "Verifier outcome did not match scenario $Scenario. Error: $verifierError Calls: $(@($serverResult.calls) -join ', ')"
        }
        if ($scenarioReport.cleanupStatus -ne "pass" -or
            $scenarioReport.companyClosed -ne $true -or
            $scenarioReport.companyDeleted -ne $true -or
            $serverResult.deleted -ne $true -or
            @($serverResult.calls) -notcontains "POST /api/matm/test/companies/close" -or
            @($serverResult.calls) -notcontains "DELETE /api/matm/test/companies/delete") {
            throw "Disposable company cleanup did not complete for scenario $Scenario."
        }
        if ($Scenario -eq "pass" -and $scenarioReport.status -ne "pass") {
            throw "Passing fixture scenario did not pass."
        }
        if ($Scenario -eq "replay-succeeds" -and
            ($scenarioReport.status -ne "fail" -or $scenarioReport.secondClaimRejected -ne $false)) {
            throw "Replay-success fixture did not fail closed before cleanup."
        }

        return [ordered]@{
            verifierFailureExpected = $ExpectVerifierFailure
            verifierFailed = $verifierFailed
            replayRejected = [bool]$scenarioReport.secondClaimRejected
            cleanupStatus = [string]$scenarioReport.cleanupStatus
            companyClosed = [bool]$scenarioReport.companyClosed
            companyDeleted = [bool]$scenarioReport.companyDeleted
        }
    }
    finally {
        if ($job.State -eq "Running") { Stop-Job -Job $job }
        Remove-Job -Job $job -Force
        if (Test-Path -LiteralPath $tempReport) { [IO.File]::Delete($tempReport) }
    }
}

Push-Location $repoRoot
try {
    $pass = Invoke-FixtureScenario -Scenario "pass" -ExpectVerifierFailure $false
    $replay = Invoke-FixtureScenario -Scenario "replay-succeeds" -ExpectVerifierFailure $true
    $report = [ordered]@{
        schema = "tinyrustlm.memory_endpoints.single_use_enrollment_fixture.v1"
        generatedUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        status = "pass"
        passScenario = $pass
        replaySuccessScenario = $replay
        rawCredentialExposed = $false
        rawPayloadExposed = $false
    }
    $target = [IO.Path]::GetFullPath((Join-Path $repoRoot $ReportOutput))
    [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
    [IO.File]::WriteAllText($target, "$(($report | ConvertTo-Json -Depth 8))`n", [Text.UTF8Encoding]::new($false))
    Write-Host "MemoryEndpoints single-use enrollment fixture verification passed. Report: $ReportOutput"
}
finally {
    Pop-Location
}
