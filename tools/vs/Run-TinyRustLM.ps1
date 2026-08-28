[CmdletBinding()]
param(
    [int]$Port = 8080,
    [int]$PortSearchLimit = 20,
    [switch]$NoBuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Get-AppUrl {
    param([int]$CandidatePort)
    return "http://127.0.0.1:$CandidatePort/app/"
}

function Resolve-ServerExecutable {
    $server = Join-Path $Root "target\debug\tinyrustlm-local-server.exe"
    if (-not (Test-Path -LiteralPath $server)) {
        throw "TinyRustLM Rust local server was not found at $server. Run the build first or remove -NoBuild."
    }
    return (Resolve-Path -LiteralPath $server).Path
}

function Get-BrowserRuntimeUrl {
    param([int]$CandidatePort)
    return "http://127.0.0.1:$CandidatePort/browser-runtime/tinyrustlm-browser-runtime.wasm"
}

function Test-LocalPortOpen {
    param([int]$CandidatePort)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connect = $client.ConnectAsync("127.0.0.1", $CandidatePort)
        if (-not $connect.Wait(300)) {
            return $false
        }
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Test-TinyRustLMServer {
    param([int]$CandidatePort)

    $appUrl = Get-AppUrl $CandidatePort
    $wasmUrl = Get-BrowserRuntimeUrl $CandidatePort

    try {
        $page = Invoke-WebRequest -Uri $appUrl -Method Get -UseBasicParsing -TimeoutSec 2
        if ($page.StatusCode -lt 200 -or $page.StatusCode -ge 300) {
            return $false
        }
        $content = [string]$page.Content
        if (-not $content.Contains("<title>TinyRustLM</title>")) {
            return $false
        }

        $wasm = Invoke-WebRequest -Uri $wasmUrl -Method Head -UseBasicParsing -TimeoutSec 2
        if ($wasm.StatusCode -lt 200 -or $wasm.StatusCode -ge 300) {
            return $false
        }
        return $true
    }
    catch {
        return $false
    }
}

function Resolve-RunTarget {
    param(
        [int]$PreferredPort,
        [int]$SearchLimit
    )

    if ($SearchLimit -lt 0) {
        throw "PortSearchLimit must be zero or greater."
    }

    for ($offset = 0; $offset -le $SearchLimit; $offset++) {
        $candidate = $PreferredPort + $offset
        if ($candidate -gt 65535) {
            break
        }

        if (Test-TinyRustLMServer $candidate) {
            return [pscustomobject]@{
                Port = $candidate
                Url = Get-AppUrl $candidate
                Reuse = $true
            }
        }

        if (-not (Test-LocalPortOpen $candidate)) {
            return [pscustomobject]@{
                Port = $candidate
                Url = Get-AppUrl $candidate
                Reuse = $false
            }
        }

        Write-Host "Port $candidate is in use by another local service; checking next port."
    }

    throw "No available local port found from $PreferredPort through $($PreferredPort + $SearchLimit)."
}

Push-Location $Root
try {
    if (-not $NoBuild) {
        & (Join-Path $PSScriptRoot "Build-TinyRustLM.ps1") -Configuration Debug
        if ($LASTEXITCODE -ne 0) {
            throw "Visual Studio pre-run build failed with exit code $LASTEXITCODE"
        }
    }

    $target = Resolve-RunTarget -PreferredPort $Port -SearchLimit $PortSearchLimit

    if ($target.Reuse) {
        Write-Host "TinyRustLM is already running at $($target.Url)"
        if (-not $NoBrowser) {
            Start-Process $target.Url
        }
        exit 0
    }

    $Server = Resolve-ServerExecutable
    if (-not $NoBrowser) {
        Start-Job -ScriptBlock {
            param($OpenUrl)
            Start-Sleep -Milliseconds 900
            Start-Process $OpenUrl
        } -ArgumentList $target.Url | Out-Null
    }

    Write-Host "Starting TinyRustLM static server at $($target.Url)"
    Write-Host "Stop debugging in Visual Studio to stop this foreground server."
    & $Server "tinyrustlm" $target.Port
    if ($LASTEXITCODE -ne 0) {
        throw "static server exited with code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
