param(
    [string]$Root = "",
    [string]$ReportOutput = "",
    [switch]$RunBrowserSmoke,
    [switch]$RunDeepAcquisition,
    [switch]$RunVisualLock,
    [string]$VisualLockBaseline = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Root) {
    $Root = Join-Path $RepoRoot "tinyrustlm"
}
$Root = (Resolve-Path -LiteralPath $Root).Path
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-verification.json"
}
if (-not $VisualLockBaseline) {
    $VisualLockBaseline = Join-Path $RepoRoot "tinyrustlm/artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json"
}

$runId = "{0}-{1}" -f [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffffffZ"), ([Guid]::NewGuid().ToString("N").Substring(0, 12))
$evidenceRoot = Join-Path ([System.IO.Path]::GetTempPath()) "tinyrustlm-ui-verification/$runId"
$browserEvidenceRoot = Join-Path $evidenceRoot "web-release"
$visualEvidenceRoot = Join-Path $evidenceRoot "visual-lock"
$visualServer = $null
$gates = [ordered]@{
    static_contract = "not_run"
    javascript_syntax = "not_run"
    browser_contracts = if ($RunBrowserSmoke -or $RunDeepAcquisition) { "not_run" } else { "skipped" }
    chromium_release = if ($RunBrowserSmoke -or $RunDeepAcquisition) { "not_run" } else { "skipped" }
    acquisition_browser_bridge = if ($RunDeepAcquisition) { "not_run" } else { "skipped" }
    acquisition_companion = if ($RunDeepAcquisition) { "not_run" } else { "skipped" }
    acquisition_converter = if ($RunDeepAcquisition) { "not_run" } else { "skipped" }
    visual_lock = if ($RunVisualLock) { "not_run" } else { "skipped" }
}
$outputs = [ordered]@{}

function Invoke-NativeGate {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments
    )

    $priorErrorActionPreference = $ErrorActionPreference
    try {
        # Native tools routinely use stderr for progress. Capture it as evidence
        # and let the process exit code, rather than PowerShell stream typing,
        # decide whether the gate passed.
        $ErrorActionPreference = "Continue"
        $captured = & $FilePath @Arguments 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $priorErrorActionPreference
    }
    $outputs[$Name] = $captured.Trim()
    if ($exitCode -ne 0) {
        throw "$Name failed with exit code $exitCode`n$captured"
    }
}

function Write-VerificationReport {
    param([string]$Status, [string]$ErrorMessage)

    $reportDirectory = Split-Path -Parent $ReportOutput
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report = [ordered]@{
        schema = "tinyrustlm.ui_verification.v1"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        run_id = $runId
        status = $Status
        repository_root = $RepoRoot
        app_root = $Root
        browser_smoke_requested = [bool]($RunBrowserSmoke -or $RunDeepAcquisition)
        deep_acquisition_requested = [bool]$RunDeepAcquisition
        visual_lock_requested = [bool]$RunVisualLock
        gates = $gates
        evidence = [ordered]@{
            root = $evidenceRoot
            web_release = if ($RunBrowserSmoke -or $RunDeepAcquisition) { $browserEvidenceRoot } else { "" }
            visual_lock = if ($RunVisualLock) { $visualEvidenceRoot } else { "" }
        }
        outputs = $outputs
        error = $ErrorMessage
    }
    $temporary = "$ReportOutput.$runId.tmp"
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $ReportOutput -Force
    Write-Host "TinyRustLM UI verification report written to $ReportOutput"
}

function Wait-LoopbackServer {
    param([System.Diagnostics.Process]$Process, [int]$Port)

    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        if ($Process.HasExited) {
            throw "tinyrustlm-local-server exited before visual verification"
        }
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/app/" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                return
            }
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }
    throw "tinyrustlm-local-server did not become ready for visual verification"
}

try {
    New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null

    Invoke-NativeGate "static_contract" "cargo" @(
        "run", "-p", "tinyrustlm-browser-harness", "--", $Root
    )
    $gates.static_contract = "pass"

    Invoke-NativeGate "javascript_syntax_app" "node" @("--check", (Join-Path $Root "app/app.js"))
    Invoke-NativeGate "javascript_syntax_bridge" "node" @("--check", (Join-Path $Root "app/companion-bridge.js"))
    $gates.javascript_syntax = "pass"

    if ($RunBrowserSmoke -or $RunDeepAcquisition) {
        Invoke-NativeGate "browser_contracts" "npm" @("--prefix", (Join-Path $RepoRoot "tinyrustlm"), "run", "test:ui")
        $gates.browser_contracts = "pass"

        Invoke-NativeGate "chromium_release" "node" @(
            (Join-Path $RepoRoot "tinyrustlm/tools/web-release-local-smoke.js"),
            $browserEvidenceRoot,
            $Root
        )
        $gates.chromium_release = "pass"
    }

    if ($RunDeepAcquisition) {
        throw "Deep acquisition is unavailable until the clean TinyRustLM companion and complete-composition converter gates are registered."
    }

    if ($RunVisualLock) {
        if (-not (Test-Path -LiteralPath $VisualLockBaseline -PathType Leaf)) {
            throw "Visual lock baseline was not found: $VisualLockBaseline"
        }
        $visualPort = Get-Random -Minimum 8400 -Maximum 9000
        $visualDebugPort = Get-Random -Minimum 9400 -Maximum 9900
        $visualStdout = Join-Path $visualEvidenceRoot "server.stdout.log"
        $visualStderr = Join-Path $visualEvidenceRoot "server.stderr.log"
        New-Item -ItemType Directory -Force -Path $visualEvidenceRoot | Out-Null
        $visualServer = Start-Process `
            -FilePath "cargo" `
            -ArgumentList @("run", "-p", "tinyrustlm-local-server", "--", $Root, "$visualPort") `
            -WorkingDirectory $RepoRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $visualStdout `
            -RedirectStandardError $visualStderr `
            -PassThru
        Wait-LoopbackServer -Process $visualServer -Port $visualPort
        Invoke-NativeGate "visual_lock" "node" @(
            (Join-Path $RepoRoot "tinyrustlm/tools/capture-ui-lock.js"),
            "http://127.0.0.1:$visualPort/app/",
            $visualEvidenceRoot,
            "$visualDebugPort",
            $VisualLockBaseline
        )
        $gates.visual_lock = "pass"
    }

    Write-VerificationReport -Status "pass" -ErrorMessage ""
    Write-Host "TinyRustLM UI verification passed."
}
catch {
    foreach ($name in @($gates.Keys)) {
        if ($gates[$name] -eq "not_run") {
            $gates[$name] = "fail"
            break
        }
    }
    Write-VerificationReport -Status "fail" -ErrorMessage $_.Exception.Message
    throw
}
finally {
    if ($visualServer -and -not $visualServer.HasExited) {
        Stop-Process -Id $visualServer.Id -Force -ErrorAction SilentlyContinue
    }
}
