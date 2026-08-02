param(
    [string]$Root = "",
    [int]$Port = 8186,
    [int]$DebugPort = 9550,
    [string]$ReportOutput = "",
    [string[]]$SmokeModes = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Root) {
    $Root = Join-Path $RepoRoot "tinyrustlm"
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-root-verification.json"
}
if ($SmokeModes.Count -eq 0) {
    $SmokeModes = @(
        "public-local-only",
        "catalog-local-import",
        "local-import-ambiguous-selection",
        "peer-url-unsafe-ui",
        "local-memory-deck-ui",
        "local-connect-approval-ui",
        "local-connect-endpoint-ui",
        "local-connect-rust-endpoint-ui",
        "peer-status-live-ui"
    )
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
        $allProcesses = Get-CimInstance Win32_Process
        $ownedProcessDepths = @{}
        $ownedProcessDepths[$process.Id] = 0
        $changed = $true
        while ($changed) {
            $changed = $false
            foreach ($candidate in $allProcesses) {
                $parentId = [int]$candidate.ParentProcessId
                $candidateId = [int]$candidate.ProcessId
                if ($ownedProcessDepths.ContainsKey($parentId) -and
                    -not $ownedProcessDepths.ContainsKey($candidateId)) {
                    $ownedProcessDepths[$candidateId] = [int]$ownedProcessDepths[$parentId] + 1
                    $changed = $true
                }
            }
        }
        $ownedProcessDepths.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
            Stop-Process -Id ([int]$_.Key) -Force -ErrorAction SilentlyContinue
        }
        [void]$process.WaitForExit(10000)
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
        throw "$Label timed out after $TimeoutMilliseconds ms`n$output"
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode)`n$output"
    }
    return $output
}

function Wait-PublicRootServer {
    param([System.Diagnostics.Process]$ServerProcess)

    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        if ($ServerProcess.HasExited) {
            throw "tinyrustlm-local-server exited early with code $($ServerProcess.ExitCode)"
        }
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
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

function Write-PublicRootReport {
    param(
        [string]$Status,
        [System.Collections.IDictionary]$SmokeStatuses,
        [System.Collections.IDictionary]$SmokeReportPaths,
        [System.Collections.IDictionary]$BrowserDebugPorts,
        [string]$ErrorMessage,
        [string]$ServerStdoutPath,
        [string]$ServerStderrPath
    )

    $reportDirectory = Split-Path -Parent $ReportOutput
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report = [ordered]@{
        schema = "tinyrustlm.public_root_verification.v0"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        status = $Status
        repository_root = $RepoRoot
        app_root = (Resolve-Path $Root).Path
        local_server_url = "http://127.0.0.1:$Port/"
        public_root_url = "http://tinyrustlm.com:$Port/"
        public_host_mapping = "tinyrustlm.com-loopback-browser-smoke"
        smoke_modes = @($SmokeModes)
        smoke_statuses = $SmokeStatuses
        smoke_report_paths = $SmokeReportPaths
        browser_debug_ports = $BrowserDebugPorts
        server_stdout_path = $ServerStdoutPath
        server_stderr_path = $ServerStderrPath
        error = $ErrorMessage
    }
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
    Write-Host "TinyRustLM public-root verification report written to $ReportOutput"
}

$smokeStatuses = [ordered]@{}
$smokeReportPaths = [ordered]@{}
$browserDebugPorts = [ordered]@{}
for ($index = 0; $index -lt $SmokeModes.Count; $index++) {
    $mode = $SmokeModes[$index]
    $smokeStatuses[$mode] = "not_run"
    $smokeReportPaths[$mode] = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-root-$mode-smoke.json"
    $browserDebugPorts[$mode] = $DebugPort + $index
}

$serverStdout = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-root-server-$Port.out.log"
$serverStderr = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-root-server-$Port.err.log"
$server = $null

try {
    $resolvedRoot = (Resolve-Path $Root).Path
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

    Wait-PublicRootServer -ServerProcess $server
    $publicRootUrl = "http://tinyrustlm.com:$Port/"
    foreach ($mode in $SmokeModes) {
        $reportPath = [string]$smokeReportPaths[$mode]
        $modeDebugPort = [string]$browserDebugPorts[$mode]
        Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
        $smokeOutput = Invoke-Checked `
            -FilePath "node" `
            -Arguments @((Join-Path $RepoRoot "tinyrustlm/tools/browser-smoke.js"), $publicRootUrl, $modeDebugPort, "tinylm16q8", $mode) `
            -Label "public-root $mode browser smoke"
        $smokeOutput | Set-Content -LiteralPath $reportPath -Encoding UTF8
        $smokeStatuses[$mode] = "pass"
    }

    Write-PublicRootReport `
        -Status "pass" `
        -SmokeStatuses $smokeStatuses `
        -SmokeReportPaths $smokeReportPaths `
        -BrowserDebugPorts $browserDebugPorts `
        -ErrorMessage "" `
        -ServerStdoutPath $serverStdout `
        -ServerStderrPath $serverStderr
    Write-Host "TinyRustLM public-root verification passed."
}
catch {
    $message = $_.Exception.Message
    Write-PublicRootReport `
        -Status "fail" `
        -SmokeStatuses $smokeStatuses `
        -SmokeReportPaths $smokeReportPaths `
        -BrowserDebugPorts $browserDebugPorts `
        -ErrorMessage $message `
        -ServerStdoutPath $serverStdout `
        -ServerStderrPath $serverStderr
    throw
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
