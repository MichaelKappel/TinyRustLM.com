[CmdletBinding()]
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [switch]$Clean,
    [switch]$CleanOnly,
    [switch]$RunTests,
    [switch]$RegenerateModels
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Resolve-CommandPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string[]]$PreferredPaths = @()
    )

    foreach ($candidate in $PreferredPaths) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    throw "Required command '$Name' was not found. Install Rust and Node, then reopen Visual Studio."
}

$Cargo = Resolve-CommandPath "cargo.exe" @(
    (Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"),
    "C:\Users\AI\.cargo\bin\cargo.exe"
)
$Rustup = Resolve-CommandPath "rustup.exe" @(
    (Join-Path $env:USERPROFILE ".cargo\bin\rustup.exe"),
    "C:\Users\AI\.cargo\bin\rustup.exe"
)

Push-Location $Root
try {
    if ($Clean -or $CleanOnly) {
        & $Cargo clean
        if ($LASTEXITCODE -ne 0) {
            throw "cargo clean failed with exit code $LASTEXITCODE"
        }
        if ($CleanOnly) {
            exit 0
        }
    }

    $installedTargets = & $Rustup target list --installed
    if ($LASTEXITCODE -ne 0) {
        throw "rustup target list failed with exit code $LASTEXITCODE"
    }
    if ($installedTargets -notcontains "wasm32-unknown-unknown") {
        & $Rustup target add wasm32-unknown-unknown
        if ($LASTEXITCODE -ne 0) {
            throw "rustup target add wasm32-unknown-unknown failed with exit code $LASTEXITCODE"
        }
    }

    & $Cargo build --workspace
    if ($LASTEXITCODE -ne 0) {
        throw "cargo build --workspace failed with exit code $LASTEXITCODE"
    }

    if ($RunTests) {
        & $Cargo test --workspace
        if ($LASTEXITCODE -ne 0) {
            throw "cargo test --workspace failed with exit code $LASTEXITCODE"
        }
    }

    & $Cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown
    if ($LASTEXITCODE -ne 0) {
        throw "cargo wasm build failed with exit code $LASTEXITCODE"
    }

    Copy-Item -LiteralPath "target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm" -Destination "tinyrustlm\runtime\tinyrustlm.wasm" -Force
    & $Cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest "tinyrustlm\runtime\tinyrustlm.wasm" "tinyrustlm\runtime\tinyrustlm.wasm.manifest"
    if ($LASTEXITCODE -ne 0) {
        throw "runtime WASM manifest generation failed with exit code $LASTEXITCODE"
    }

    & $Cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown --features wasm-simd
    if ($LASTEXITCODE -ne 0) {
        throw "cargo SIMD WASM build failed with exit code $LASTEXITCODE"
    }

    Copy-Item -LiteralPath "target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm" -Destination "tinyrustlm\runtime\tinyrustlm-simd.wasm" -Force
    & $Cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest "tinyrustlm\runtime\tinyrustlm-simd.wasm" "tinyrustlm\runtime\tinyrustlm-simd.wasm.manifest"
    if ($LASTEXITCODE -ne 0) {
        throw "SIMD runtime WASM manifest generation failed with exit code $LASTEXITCODE"
    }

    $models = @(
        @{ Path = "tinyrustlm\models\tiny-test-model.slm"; Mode = "tiny-fixture" },
        @{ Path = "tinyrustlm\models\tiny-test-model-tied.slm"; Mode = "tiny-fixture-tied" },
        @{ Path = "tinyrustlm\models\tiny-test-model-q8.slm"; Mode = "tiny-fixture-q8" },
        @{ Path = "tinyrustlm\models\tiny-test-model-q4.slm"; Mode = "tiny-fixture-q4" },
        @{ Path = "tinyrustlm\models\tiny-test-model-bpe.slm"; Mode = "tiny-fixture-bpe" },
        @{ Path = "tinyrustlm\models\tinylm16-f32.slm"; Mode = "tinylm16-f32" },
        @{ Path = "tinyrustlm\models\tinylm16-q8.slm"; Mode = "tinylm16-q8" },
        @{ Path = "tinyrustlm\models\tinylm16-q4.slm"; Mode = "tinylm16-q4" }
    )

    foreach ($model in $models) {
        if ($RegenerateModels -or -not (Test-Path -LiteralPath $model.Path)) {
            & $Cargo run -p tinyrustlm-slm-pack -- $model.Path $model.Mode
            if ($LASTEXITCODE -ne 0) {
                throw "model pack failed for $($model.Path) with exit code $LASTEXITCODE"
            }
        }
        $manifestPath = "$($model.Path).manifest"
        if ($RegenerateModels -or -not (Test-Path -LiteralPath $manifestPath)) {
            & $Cargo run -p tinyrustlm-slm-pack -- manifest $model.Path $manifestPath deterministic-smoke
            if ($LASTEXITCODE -ne 0) {
                throw "model manifest generation failed for $($model.Path) with exit code $LASTEXITCODE"
            }
        }
    }

    Write-Host "TinyRustLM $Configuration build complete."
    Write-Host "Run from Visual Studio with Debug > Start Debugging, or open http://127.0.0.1:8080/app/ after starting the server."
}
finally {
    Pop-Location
}
