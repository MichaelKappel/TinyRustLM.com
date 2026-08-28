[CmdletBinding()]
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [switch]$Clean,
    [switch]$CleanOnly,
    [switch]$RunTests,
    [switch]$RefreshBrowserRuntime
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path

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
$Rustup = Resolve-RequiredCommand "rustup"

Push-Location $Root
try {
    if ($Clean -or $CleanOnly) {
        Invoke-Checked $Cargo @("clean") "Cargo clean"
        if ($CleanOnly) {
            return
        }
    }

    $installedTargets = @(& $Rustup target list --installed)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect installed Rust targets."
    }
    if ($installedTargets -notcontains "wasm32-unknown-unknown") {
        throw "The wasm32-unknown-unknown Rust target is required. Install it explicitly before building."
    }

    $buildArguments = @("build", "--workspace", "--locked", "--offline")
    if ($Configuration -eq "Release") {
        $buildArguments += "--release"
    }
    Invoke-Checked $Cargo $buildArguments "Canonical Rust workspace build"

    $artifactMode = if ($RefreshBrowserRuntime) { "write" } else { "check" }
    Invoke-Checked $Node @(
        "tinyrustlm/tools/browser-runtime-web-artifact.js",
        $artifactMode
    ) "Canonical browser runtime artifact $artifactMode"

    if ($RunTests) {
        Invoke-Checked $Cargo @(
            "test", "--workspace", "--locked", "--offline"
        ) "Canonical Rust workspace tests"
        Invoke-Checked $Node @(
            "tinyrustlm/tools/run-vnext-unit-test-gate.js",
            "standard"
        ) "Standard Node test gate"
    }

    Write-Host "TinyRustLM $Configuration build passed."
}
finally {
    Pop-Location
}
