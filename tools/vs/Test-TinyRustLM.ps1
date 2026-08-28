[CmdletBinding()]
param(
    [switch]$BrowserSmoke,
    [string]$BrowserEvidenceRoot = ""
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$BuildScript = Join-Path $PSScriptRoot "Build-TinyRustLM.ps1"

function Resolve-RequiredCommand {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "Required command '$Name' was not found."
    }
    return $command.Source
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

$Cargo = Resolve-RequiredCommand "cargo"
$Node = Resolve-RequiredCommand "node"

Push-Location $Root
try {
    & $BuildScript -Configuration Debug -RunTests

    Invoke-Checked $Cargo @("fmt", "--all", "--", "--check") "Rust formatting gate"
    Invoke-Checked $Cargo @(
        "clippy", "--workspace", "--all-targets", "--locked", "--offline", "--", "-D", "warnings"
    ) "Rust Clippy gate"
    Invoke-Checked $Cargo @(
        "doc", "--workspace", "--no-deps", "--locked", "--offline"
    ) "Rust documentation build"

    foreach ($script in @(
        "tinyrustlm/app/app.js",
        "tinyrustlm/app/browser-runtime-loader.js",
        "tinyrustlm/app/model-runtime-client.js",
        "tinyrustlm/app/model-runtime-worker.js"
    )) {
        Invoke-Checked $Node @("--check", $script) "JavaScript syntax gate for $script"
    }

    if ($BrowserSmoke) {
        if (-not $BrowserEvidenceRoot) {
            $BrowserEvidenceRoot = Join-Path ([IO.Path]::GetTempPath()) (
                "tinyrustlm-browser-smoke-" + [Guid]::NewGuid().ToString("N")
            )
        }
        $absoluteEvidenceRoot = [IO.Path]::GetFullPath($BrowserEvidenceRoot)
        if (Test-Path -LiteralPath $absoluteEvidenceRoot) {
            throw "Browser evidence root must not already exist."
        }
        Invoke-Checked $Node @(
            "tinyrustlm/tools/web-release-local-smoke.js",
            $absoluteEvidenceRoot,
            "tinyrustlm"
        ) "Real Chromium web release smoke"
        Write-Host "Browser evidence: $absoluteEvidenceRoot"
    }

    Write-Host "TinyRustLM tests passed."
}
finally {
    Pop-Location
}
