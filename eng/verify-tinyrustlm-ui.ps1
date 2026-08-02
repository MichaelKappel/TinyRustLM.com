param(
    [string]$Root = "",
    [int]$Port = 8184,
    [int]$DebugPort = 9442,
    [string]$ReportOutput = "",
    [switch]$RunBrowserSmoke,
    [switch]$RunDeepBrowserSmoke,
    [string[]]$BrowserSmokeModes = @(),
    [int]$BrowserSmokeTimeoutSeconds = 1800,
    [switch]$RunVisualLock,
    [string]$VisualLockBaseline = "",
    [string]$VisualLockOutputDir = "",
    [int]$VisualLockDebugPort = 0
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Root) {
    $Root = Join-Path $RepoRoot "tinyrustlm"
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-verification.json"
}
if (-not $VisualLockBaseline) {
    $VisualLockBaseline = Join-Path $RepoRoot "tinyrustlm/artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json"
}
if (-not $VisualLockOutputDir) {
    $VisualLockOutputDir = Join-Path $RepoRoot "artifacts/reports/ui-lock-verification"
}
if ($VisualLockDebugPort -le 0) {
    $VisualLockDebugPort = $DebugPort + 700
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$Label,
        [int]$TimeoutMilliseconds = 900000
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $startInfo.Arguments = ($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join " "

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        Stop-ProcessTree -ProcessId $process.Id
        try {
            [void]$process.WaitForExit(10000)
        }
        catch {
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
        throw "$Label timed out after $TimeoutMilliseconds milliseconds`n$output"
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode)`n$output"
    }
    return $output
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    try {
        & taskkill.exe /PID $ProcessId /T /F | Out-Null
    }
    catch {
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-BrowserSmoke {
    param(
        [string[]]$Arguments,
        [string]$Label,
        [string]$ReportPath,
        [int]$TimeoutSeconds
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = "node"
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $startInfo.Arguments = ($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join " "

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $timeoutMilliseconds = if ($TimeoutSeconds -gt 0) { [Math]::Max(1, $TimeoutSeconds * 1000) } else { -1 }
    if ($timeoutMilliseconds -gt 0 -and -not $process.WaitForExit($timeoutMilliseconds)) {
        Stop-ProcessTree -ProcessId $process.Id
        try {
            [void]$process.WaitForExit(5000)
        }
        catch {
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
        $timeoutMessage = "$Label timed out after $TimeoutSeconds seconds"
        ($output, $timeoutMessage | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine |
            Set-Content -LiteralPath $ReportPath -Encoding UTF8
        throw "$timeoutMessage; see $ReportPath"
    }

    if ($timeoutMilliseconds -le 0) {
        $process.WaitForExit()
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
    $output | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode)`n$output"
    }
    return $output
}

function ConvertTo-ProcessArgument {
    param([string]$Value)

    if ($null -eq $Value) {
        return '""'
    }
    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $backslashes++
            continue
        }
        if ($character -eq '"') {
            [void]$builder.Append('\', ($backslashes * 2) + 1)
            [void]$builder.Append('"')
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$builder.Append('\', $backslashes)
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        [void]$builder.Append('\', $backslashes * 2)
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Write-UiReport {
    param(
        [string]$Status,
        [string]$StaticHarnessStatus,
        [string]$HttpHarnessStatus,
        [string]$BrowserSmokeStatus,
        [string[]]$BrowserSmokeModes,
        [System.Collections.IDictionary]$BrowserSmokeStatuses,
        [bool]$BrowserSmokeRequested,
        [bool]$DeepBrowserSmokeRequested,
        [string[]]$DeepBrowserSmokeModes,
        [string]$StaticHarnessOutput,
        [string]$HttpHarnessOutput,
        [string]$ErrorMessage,
        [System.Collections.IDictionary]$BrowserSmokeReportPaths,
        [System.Collections.IDictionary]$BrowserDebugPorts,
        [bool]$VisualLockRequested,
        [string]$VisualLockStatus,
        [string]$VisualLockBaseline,
        [string]$VisualLockReportPath,
        [string]$VisualLockOutput,
        [int]$VisualLockDebugPort,
        [string]$ServerStdoutPath,
        [string]$ServerStderrPath
    )

    $reportDirectory = Split-Path -Parent $ReportOutput
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report = [ordered]@{
        schema = "tinyrustlm.ui_verification.v0"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        status = $Status
        repository_root = $RepoRoot
        app_root = (Resolve-Path $Root).Path
        local_server_url = "http://127.0.0.1:$Port/app/"
        static_harness_status = $StaticHarnessStatus
        http_harness_status = $HttpHarnessStatus
        browser_smoke_requested = $BrowserSmokeRequested
        browser_smoke_timeout_seconds = $BrowserSmokeTimeoutSeconds
        deep_browser_smoke_requested = $DeepBrowserSmokeRequested
        deep_browser_smoke_modes = if ($DeepBrowserSmokeRequested) { @($DeepBrowserSmokeModes) } else { @() }
        browser_smoke_status = $BrowserSmokeStatus
        browser_smoke_mode = if ($BrowserSmokeRequested) { ($BrowserSmokeModes -join ",") } else { "" }
        browser_smoke_modes = if ($BrowserSmokeRequested) { @($BrowserSmokeModes) } else { @() }
        browser_smoke_statuses = if ($BrowserSmokeRequested) { $BrowserSmokeStatuses } else { [ordered]@{} }
        browser_debug_port = $DebugPort
        browser_debug_ports = if ($BrowserSmokeRequested) { $BrowserDebugPorts } else { [ordered]@{} }
        static_harness_output = $StaticHarnessOutput
        http_harness_output = $HttpHarnessOutput
        browser_smoke_report_path = if ($BrowserSmokeRequested -and $BrowserSmokeModes.Count -gt 0) { [string]$BrowserSmokeReportPaths[$BrowserSmokeModes[0]] } else { "" }
        browser_smoke_report_paths = if ($BrowserSmokeRequested) { $BrowserSmokeReportPaths } else { [ordered]@{} }
        visual_lock_requested = $VisualLockRequested
        visual_lock_status = $VisualLockStatus
        visual_lock_baseline = if ($VisualLockRequested) { $VisualLockBaseline } else { "" }
        visual_lock_report_path = if ($VisualLockRequested) { $VisualLockReportPath } else { "" }
        visual_lock_debug_port = if ($VisualLockRequested) { $VisualLockDebugPort } else { 0 }
        visual_lock_output = $VisualLockOutput
        server_stdout_path = $ServerStdoutPath
        server_stderr_path = $ServerStderrPath
        error = $ErrorMessage
    }
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
    Write-Host "TinyRustLM UI verification report written to $ReportOutput"
}

function Wait-UiServer {
    param([System.Diagnostics.Process]$ServerProcess)

    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        if ($ServerProcess.HasExited) {
            throw "tinyrustlm-local-server exited early with code $($ServerProcess.ExitCode)"
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
    throw "tinyrustlm-local-server did not become ready on port $Port"
}

function Normalize-BrowserSmokeModeList {
    param([string[]]$Modes)

    $normalized = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $Modes) {
        if ([string]::IsNullOrWhiteSpace($entry)) {
            continue
        }
        foreach ($mode in ($entry -split ",")) {
            $trimmed = $mode.Trim()
            if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
                $normalized.Add($trimmed)
            }
        }
    }
    return @($normalized)
}

$staticHarnessStatus = "not_run"
$httpHarnessStatus = "not_run"
$staticHarnessOutput = ""
$httpHarnessOutput = ""
$visualLockStatus = if ($RunVisualLock) { "not_run" } else { "skipped" }
$visualLockOutput = ""
$visualLockReportPath = Join-Path $VisualLockOutputDir "tinyrustlm-ui-lock-report.json"
$standardBrowserSmokeModes = @(
    "source-options-ui",
    "assistant-quality",
    "multi-turn-context",
    "assistant-prompt-cards",
    "calculator-tool",
    "model-malformed",
    "local-memory-deck-ui",
    "hf-search-ui",
    "local-connect-approval-ui",
    "local-connect-endpoint-ui",
    "local-connect-rust-endpoint-ui",
    "memory-endpoints-outbox",
    "memory-endpoints-offline-ui",
    "memory-endpoints-reconnect-ui",
    "memory-endpoints-distributed",
    "memory-endpoints-ui",
    "memory-endpoints-adversarial-ui",
    "peer-status-live-ui"
)
$liveBrowserSmokeModes = @(
    "memory-endpoints-cors-ui",
    "memory-endpoints-relay-ui",
    "memory-endpoints-relay-live",
    "memory-endpoints-live"
)
$defaultDeepBrowserSmokeModes = @(
    "hf-conversion-kit-safetensors-exec",
    "hf-conversion-kit-review-exec",
    "hf-conversion-kit-review-reject-exec",
    "hf-conversion-kit-gguf-exec",
    "hf-p2p-import-kit-exec"
)
$deepBrowserSmokeModes = @($defaultDeepBrowserSmokeModes)
$knownBrowserSmokeModes = @($standardBrowserSmokeModes + $deepBrowserSmokeModes + $liveBrowserSmokeModes)
$explicitBrowserSmokeModes = Normalize-BrowserSmokeModeList -Modes $BrowserSmokeModes
if ($explicitBrowserSmokeModes.Count -gt 0) {
    $browserSmokeModes = @($explicitBrowserSmokeModes)
}
else {
    $browserSmokeModes = @()
    if ($RunBrowserSmoke -or $RunDeepBrowserSmoke) {
        $browserSmokeModes += $standardBrowserSmokeModes
    }
    if ($RunDeepBrowserSmoke) {
        $browserSmokeModes += $defaultDeepBrowserSmokeModes
    }
}
foreach ($mode in $browserSmokeModes) {
    if ($knownBrowserSmokeModes -notcontains $mode) {
        throw "Unknown TinyRustLM browser smoke mode '$mode'. Known modes: $($knownBrowserSmokeModes -join ', ')"
    }
}
if ($BrowserSmokeTimeoutSeconds -lt 0) {
    throw "BrowserSmokeTimeoutSeconds must be zero or greater."
}
$browserSmokeRequested = [bool]($browserSmokeModes.Count -gt 0)
$selectedDeepBrowserSmokeModes = @($browserSmokeModes | Where-Object { $deepBrowserSmokeModes -contains $_ })
$deepBrowserSmokeRequested = [bool]($selectedDeepBrowserSmokeModes.Count -gt 0)
$browserSmokeStatus = if ($browserSmokeRequested) { "not_run" } else { "skipped" }
$sourceOptionsSmokeReportName = "tinyrustlm-source-options-ui-smoke.json"
$browserSmokeReportPaths = [ordered]@{}
$browserSmokeStatuses = [ordered]@{}
$browserDebugPorts = [ordered]@{}
for ($index = 0; $index -lt $browserSmokeModes.Count; $index++) {
    $mode = $browserSmokeModes[$index]
    $reportName = if ($mode -eq "source-options-ui") { $sourceOptionsSmokeReportName } else { "tinyrustlm-$mode-smoke.json" }
    $browserSmokeReportPaths[$mode] = Join-Path $RepoRoot "artifacts/reports/$reportName"
    $browserSmokeStatuses[$mode] = if ($browserSmokeRequested) { "not_run" } else { "skipped" }
    $browserDebugPorts[$mode] = $DebugPort + $index
}
$serverStdout = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-server-$Port.out.log"
$serverStderr = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-server-$Port.err.log"
$server = $null

try {
    $resolvedRoot = (Resolve-Path $Root).Path
    $staticHarnessOutput = Invoke-Checked `
        -FilePath "cargo" `
        -Arguments @("run", "-p", "tinyrustlm-browser-harness", "--", $resolvedRoot) `
        -Label "TinyRustLM static browser harness"
    $staticHarnessStatus = "pass"

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $serverStdout) | Out-Null
    Remove-Item -LiteralPath $serverStdout, $serverStderr -Force -ErrorAction SilentlyContinue
    $server = Start-Process `
        -FilePath "cargo" `
        -ArgumentList @("run", "-p", "tinyrustlm-local-server", "--", $resolvedRoot, "$Port") `
        -WorkingDirectory $RepoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $serverStdout `
        -RedirectStandardError $serverStderr `
        -PassThru

    Wait-UiServer -ServerProcess $server
    $appUrl = "http://127.0.0.1:$Port/app/"
    $httpHarnessOutput = Invoke-Checked `
        -FilePath "cargo" `
        -Arguments @("run", "-p", "tinyrustlm-browser-harness", "--", $resolvedRoot, "--http", $appUrl) `
        -Label "TinyRustLM HTTP browser harness"
    $httpHarnessStatus = "pass"

    if ($RunVisualLock) {
        if (-not (Test-Path -LiteralPath $VisualLockBaseline)) {
            throw "TinyRustLM visual lock baseline was not found: $VisualLockBaseline"
        }
        Remove-Item -LiteralPath $VisualLockOutputDir -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Force -Path $VisualLockOutputDir | Out-Null
        $visualLockStatus = "running"
        $visualLockOutput = Invoke-Checked `
            -FilePath "node" `
            -Arguments @(
                (Join-Path $RepoRoot "tinyrustlm/tools/capture-ui-lock.js"),
                $appUrl,
                $VisualLockOutputDir,
                "$VisualLockDebugPort",
                $VisualLockBaseline
            ) `
            -Label "TinyRustLM visual lock"
        $visualLockStatus = "pass"
    }

    if ($browserSmokeRequested) {
        foreach ($mode in $browserSmokeModes) {
            $reportPath = [string]$browserSmokeReportPaths[$mode]
            $modeDebugPort = [string]$browserDebugPorts[$mode]
            $smokeModel = if ($mode -eq "assistant-quality" -or $mode -eq "multi-turn-context" -or $mode -eq "assistant-prompt-cards") {
                "smollm2q4"
            }
            elseif ($mode -eq "memory-endpoints-ui" -or $mode -eq "memory-endpoints-adversarial-ui") {
                "smollm2q8"
            }
            else {
                "tinylm16q8"
            }
            Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
            [void](Invoke-BrowserSmoke `
                -Arguments @((Join-Path $RepoRoot "tinyrustlm/tools/browser-smoke.js"), $appUrl, $modeDebugPort, $smokeModel, $mode) `
                -Label "$mode browser smoke" `
                -ReportPath $reportPath `
                -TimeoutSeconds $BrowserSmokeTimeoutSeconds)
            $browserSmokeStatuses[$mode] = "pass"
        }
        $browserSmokeStatus = "pass"
    }

    Write-UiReport `
        -Status "pass" `
        -StaticHarnessStatus $staticHarnessStatus `
        -HttpHarnessStatus $httpHarnessStatus `
        -BrowserSmokeStatus $browserSmokeStatus `
        -BrowserSmokeModes $browserSmokeModes `
        -BrowserSmokeStatuses $browserSmokeStatuses `
        -BrowserSmokeRequested $browserSmokeRequested `
        -DeepBrowserSmokeRequested $deepBrowserSmokeRequested `
        -DeepBrowserSmokeModes $selectedDeepBrowserSmokeModes `
        -StaticHarnessOutput $staticHarnessOutput `
        -HttpHarnessOutput $httpHarnessOutput `
        -ErrorMessage "" `
        -BrowserSmokeReportPaths $browserSmokeReportPaths `
        -BrowserDebugPorts $browserDebugPorts `
        -VisualLockRequested ([bool]$RunVisualLock) `
        -VisualLockStatus $visualLockStatus `
        -VisualLockBaseline $VisualLockBaseline `
        -VisualLockReportPath $visualLockReportPath `
        -VisualLockOutput $visualLockOutput `
        -VisualLockDebugPort $VisualLockDebugPort `
        -ServerStdoutPath $serverStdout `
        -ServerStderrPath $serverStderr
    Write-Host "TinyRustLM UI verification passed."
}
catch {
    $message = $_.Exception.Message
    if ($RunVisualLock -and $visualLockStatus -eq "running") {
        $visualLockStatus = "fail"
    }
    Write-UiReport `
        -Status "fail" `
        -StaticHarnessStatus $staticHarnessStatus `
        -HttpHarnessStatus $httpHarnessStatus `
        -BrowserSmokeStatus $browserSmokeStatus `
        -BrowserSmokeModes $browserSmokeModes `
        -BrowserSmokeStatuses $browserSmokeStatuses `
        -BrowserSmokeRequested $browserSmokeRequested `
        -DeepBrowserSmokeRequested $deepBrowserSmokeRequested `
        -DeepBrowserSmokeModes $selectedDeepBrowserSmokeModes `
        -StaticHarnessOutput $staticHarnessOutput `
        -HttpHarnessOutput $httpHarnessOutput `
        -ErrorMessage $message `
        -BrowserSmokeReportPaths $browserSmokeReportPaths `
        -BrowserDebugPorts $browserDebugPorts `
        -VisualLockRequested ([bool]$RunVisualLock) `
        -VisualLockStatus $visualLockStatus `
        -VisualLockBaseline $VisualLockBaseline `
        -VisualLockReportPath $visualLockReportPath `
        -VisualLockOutput $visualLockOutput `
        -VisualLockDebugPort $VisualLockDebugPort `
        -ServerStdoutPath $serverStdout `
        -ServerStderrPath $serverStderr
    throw
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
