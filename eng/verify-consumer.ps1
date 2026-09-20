param(
    [string]$PackageSource = "",
    [string]$PackageVersion = ""
)

$ErrorActionPreference = "Stop"
if (-not $PackageSource) { $PackageSource = Join-Path $PSScriptRoot "../artifacts/packages" }
if (-not $PackageVersion) { $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim() }
# One owner runs canonical source; this wrapper preserves the caller's relative feed path.
& node (Join-Path $PSScriptRoot "verify-consumer.js") $PackageSource $PackageVersion
if ($LASTEXITCODE -ne 0) { throw "TinyRustLM package consumer verification failed." }
