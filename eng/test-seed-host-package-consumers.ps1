param(
    [Parameter(Mandatory = $true)]
    [string]$PackageDirectory,
    [Parameter(Mandatory = $true)]
    [string]$DependencyFeed,
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$MiniModelSourceRoot = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PackageDirectory = (Resolve-Path -LiteralPath $PackageDirectory).Path
$DependencyFeed = (Resolve-Path -LiteralPath $DependencyFeed).Path
$LibraryId = "UAIX.Browser.p2pRuntime.SeedHost"
$ToolId = "UAIX.Browser.p2pRuntime.SeedHost.Tool"
$DependencyVersion = "0.1.8"
if ([string]::IsNullOrWhiteSpace($MiniModelSourceRoot)) {
    $MiniModelSourceRoot = $env:MINIMODEL_SOURCE_ROOT
}
if ([string]::IsNullOrWhiteSpace($MiniModelSourceRoot)) {
    $MiniModelSourceRoot = Join-Path (Split-Path $RepoRoot -Parent) 'MiniModel.org'
}
$MiniModelSourceRoot = (Resolve-Path -LiteralPath $MiniModelSourceRoot).Path
$runId = "usv-$Version-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
$WorkRoot = Join-Path ([IO.Path]::GetTempPath()) $runId
$IsWindowsHost = -not ($PSVersionTable.PSEdition -eq 'Core' -and ($IsLinux -or $IsMacOS))

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-Captured {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [int[]]$ExpectedExitCodes = @(0)
    )
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $lines = @(& $FilePath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $text = ($lines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    if ($ExpectedExitCodes -notcontains $exitCode) {
        $safeText = if ($text.Length -le 4000) { $text } else { $text.Substring(0, 4000) + "..." }
        throw "$FilePath exited with $exitCode. Output: $safeText"
    }
    return [pscustomobject]@{
        ExitCode = $exitCode
        Text = $text
    }
}

function Convert-ToolJson {
    param([string]$Text, [string]$Operation)
    try {
        $value = $Text | ConvertFrom-Json
    }
    catch {
        throw "$Operation returned invalid JSON."
    }
    Assert-Condition ($null -ne $value) "$Operation returned empty JSON."
    return $value
}

function Get-FreeLoopbackPort {
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try {
        return ([Net.IPEndPoint]$listener.LocalEndpoint).Port
    }
    finally {
        $listener.Stop()
    }
}

function Get-DistinctFreeLoopbackPorts {
    $first = Get-FreeLoopbackPort
    $second = Get-FreeLoopbackPort
    while ($second -eq $first) {
        $second = Get-FreeLoopbackPort
    }
    return @($first, $second)
}

function Install-SeedTool {
    param([string]$Destination, [string]$NuGetConfig)
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $result = Invoke-Captured -FilePath 'dotnet' -Arguments @(
        'tool', 'install', $ToolId,
        '--version', $Version,
        '--tool-path', $Destination,
        '--configfile', $NuGetConfig,
        '--ignore-failed-sources'
    )
    Assert-Condition ($result.Text.IndexOf('successfully installed', [StringComparison]::OrdinalIgnoreCase) -ge 0) "The seed-host tool did not report a successful isolated install."
    $toolName = if ($IsWindowsHost) { 'uaix-p2p-seed.exe' } else { 'uaix-p2p-seed' }
    $tool = Join-Path $Destination $toolName
    Assert-Condition (Test-Path -LiteralPath $tool -PathType Leaf) "Installed seed-host tool shim is missing."
    return $tool
}

New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
$Feed = Join-Path $WorkRoot 'feed'
$PackagesRoot = Join-Path $WorkRoot '.nuget/packages'
New-Item -ItemType Directory -Force -Path $Feed | Out-Null
New-Item -ItemType Directory -Force -Path $PackagesRoot | Out-Null

$seedPackages = @(
    "$LibraryId.$Version.nupkg",
    "$LibraryId.$Version.snupkg",
    "$ToolId.$Version.nupkg",
    "$ToolId.$Version.snupkg"
)
foreach ($name in $seedPackages) {
    $source = Join-Path $PackageDirectory $name
    Assert-Condition (Test-Path -LiteralPath $source -PathType Leaf) "Clean consumer source package is missing: $name"
    Copy-Item -LiteralPath $source -Destination (Join-Path $Feed $name)
}
$dependencyPackages = @(
    "UAIX.Browser.Core.Abstractions.$DependencyVersion.nupkg",
    "UAIX.Browser.p2pLLM.Runtime.$DependencyVersion.nupkg",
    "UAIX.Browser.p2pRuntime.P2P.$DependencyVersion.nupkg"
)
foreach ($name in $dependencyPackages) {
    $source = Join-Path $DependencyFeed $name
    Assert-Condition (Test-Path -LiteralPath $source -PathType Leaf) "Required local-feed dependency is missing: $name"
    Copy-Item -LiteralPath $source -Destination (Join-Path $Feed $name)
}

$escapedFeed = [Security.SecurityElement]::Escape($Feed)
$NuGetConfig = Join-Path $WorkRoot 'NuGet.Config'
@"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="uaix-isolated" value="$escapedFeed" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="uaix-isolated">
      <package pattern="UAIX.*" />
    </packageSource>
    <packageSource key="nuget.org">
      <package pattern="FSharp.*" />
      <package pattern="Microsoft.*" />
      <package pattern="System.*" />
      <package pattern="NETStandard.*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
"@ | Set-Content -LiteralPath $NuGetConfig -Encoding UTF8

$oldNuGetPackages = $env:NUGET_PACKAGES
$oldNativePath = $env:MINIMODEL_NATIVE_PATH
$oldCliPath = $env:MINIMODEL_CLI_PATH
$env:NUGET_PACKAGES = $PackagesRoot
$env:MINIMODEL_NATIVE_PATH = $null
$env:MINIMODEL_CLI_PATH = $null
$stage = 'consumer-csharp'
try {
    $CSharpRoot = Join-Path $WorkRoot 'consumer-csharp'
    New-Item -ItemType Directory -Force -Path $CSharpRoot | Out-Null
    @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="$LibraryId" Version="[$Version]" />
  </ItemGroup>
</Project>
"@ | Set-Content -LiteralPath (Join-Path $CSharpRoot 'Consumer.csproj') -Encoding UTF8
    @'
using System.Reflection;
using System.Text.Json;
using TinyRustLM.SeedHost;

var authority = new MiniModelAuthority();
if (authority.NativeAbiVersion != MiniModelAuthority.SupportedNativeAbiVersion)
{
    throw new InvalidOperationException("Native ABI mismatch.");
}

var prohibited = new[]
{
    "Authoring", "Breeding", "EncryptionKey", "LicenseServer", "PremiumOptimizer",
    "QuantizationAuthor", "SelectorRegistry", "TelemetryBackend", "TrainingRecipe"
};
var publicNames = typeof(MiniModelAuthority).Assembly
    .GetExportedTypes()
    .SelectMany(type => new[] { type.FullName ?? type.Name }.Concat(
        type.GetMembers(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
            .Select(member => $"{type.FullName}.{member.Name}")))
    .ToArray();
foreach (var forbidden in prohibited)
{
    if (publicNames.Any(name => name.Contains(forbidden, StringComparison.OrdinalIgnoreCase)))
    {
        throw new InvalidOperationException($"Prohibited public surface: {forbidden}");
    }
}

Console.WriteLine(JsonSerializer.Serialize(new
{
    ok = true,
    native_abi_version = authority.NativeAbiVersion,
    exported_type_count = typeof(MiniModelAuthority).Assembly.GetExportedTypes().Length
}));
'@ | Set-Content -LiteralPath (Join-Path $CSharpRoot 'Program.cs') -Encoding UTF8
    Invoke-Captured -FilePath 'dotnet' -Arguments @('restore', (Join-Path $CSharpRoot 'Consumer.csproj'), '--configfile', $NuGetConfig, '--packages', $PackagesRoot) | Out-Null
    Invoke-Captured -FilePath 'dotnet' -Arguments @('build', (Join-Path $CSharpRoot 'Consumer.csproj'), '-c', 'Release', '--no-restore', '--warnaserror') | Out-Null
    $csharpResult = Invoke-Captured -FilePath 'dotnet' -Arguments @('run', '--project', (Join-Path $CSharpRoot 'Consumer.csproj'), '-c', 'Release', '--no-build')
    $csharpJson = Convert-ToolJson -Text $csharpResult.Text -Operation 'C# package consumer'
    Assert-Condition ([bool]$csharpJson.ok -and [uint32]$csharpJson.native_abi_version -eq 2) "C# package consumer did not load ABI v2."

    $stage = 'consumer-fsharp'
    $FSharpRoot = Join-Path $WorkRoot 'consumer-fsharp'
    New-Item -ItemType Directory -Force -Path $FSharpRoot | Out-Null
    @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="Program.fs" />
    <PackageReference Include="$LibraryId" Version="[$Version]" />
  </ItemGroup>
</Project>
"@ | Set-Content -LiteralPath (Join-Path $FSharpRoot 'Consumer.fsproj') -Encoding UTF8
    @'
open TinyRustLM.SeedHost

[<EntryPoint>]
let main _ =
    let authority = MiniModelAuthority()
    if authority.NativeAbiVersion <> MiniModelAuthority.SupportedNativeAbiVersion then
        failwith "Native ABI mismatch."
    printfn "{\"ok\":true,\"native_abi_version\":%u}" authority.NativeAbiVersion
    0
'@ | Set-Content -LiteralPath (Join-Path $FSharpRoot 'Program.fs') -Encoding UTF8
    Invoke-Captured -FilePath 'dotnet' -Arguments @('restore', (Join-Path $FSharpRoot 'Consumer.fsproj'), '--configfile', $NuGetConfig, '--packages', $PackagesRoot) | Out-Null
    Invoke-Captured -FilePath 'dotnet' -Arguments @('build', (Join-Path $FSharpRoot 'Consumer.fsproj'), '-c', 'Release', '--no-restore', '--warnaserror') | Out-Null
    $fsharpResult = Invoke-Captured -FilePath 'dotnet' -Arguments @('run', '--project', (Join-Path $FSharpRoot 'Consumer.fsproj'), '-c', 'Release', '--no-build')
    $fsharpJson = Convert-ToolJson -Text $fsharpResult.Text -Operation 'F# package consumer'
    Assert-Condition ([bool]$fsharpJson.ok -and [uint32]$fsharpJson.native_abi_version -eq 2) "F# package consumer did not load ABI v2."

    $stage = 'tool-install-and-doctor'
    $ToolRoot = Join-Path $WorkRoot 'tool-positive'
    $tool = Install-SeedTool -Destination $ToolRoot -NuGetConfig $NuGetConfig
    $doctorResult = Invoke-Captured -FilePath $tool -Arguments @('doctor', '--json')
    $doctor = Convert-ToolJson -Text $doctorResult.Text -Operation 'installed tool doctor'
    Assert-Condition ([bool]$doctor.ok -and [bool]$doctor.value.ready) "Installed tool doctor did not report ready."
    Assert-Condition ([string]$doctor.value.runtime_identifier -ceq $(if ($IsWindowsHost) { 'win-x64' } else { 'linux-x64' })) "Installed tool selected the wrong native RID."
    Assert-Condition ([uint32]$doctor.value.native_abi_version -eq 2) "Installed tool loaded the wrong native ABI."
    Assert-Condition ([string]$doctor.value.mini_model_executable_sha256 -match '^sha256:[0-9a-f]{64}$') "Installed tool did not hash the packaged MiniModel executable."
    Assert-Condition ([string]$doctor.value.conversion_executable_sha256 -match '^sha256:[0-9a-f]{64}$') "Installed tool did not hash the packaged TinyRustLM converter."
    Assert-Condition ([IO.Path]::GetFileName([string]$doctor.value.conversion_executable_path) -ceq $(if ($IsWindowsHost) { 'tinyrustlm-slm-pack.exe' } else { 'tinyrustlm-slm-pack' })) "Installed tool selected the wrong TinyRustLM converter."

    $stage = 'fleet-init-and-inspect'
    $FleetRoot = Join-Path $WorkRoot 'fixture-fleet'
    $initResult = Invoke-Captured -FilePath $tool -Arguments @('init', '--fleet-id', 'package-fixture', '--root', $FleetRoot, '--json')
    $init = Convert-ToolJson -Text $initResult.Text -Operation 'installed tool init'
    Assert-Condition ([bool]$init.ok -and [int]$init.value.remaining_model_capacity -eq 20) "Installed tool did not initialize an empty 20-model fleet."
    $inspectResult = Invoke-Captured -FilePath $tool -Arguments @('inspect', '--root', $FleetRoot, '--json')
    $inspect = Convert-ToolJson -Text $inspectResult.Text -Operation 'installed tool inspect'
    Assert-Condition ([bool]$inspect.ok -and [int]$inspect.value.replica_lane_count -eq 2) "Installed tool did not inspect the required two-lane fleet."

    $stage = 'fixture-admission'
    $fixture = Join-Path $RepoRoot 'tinyrustlm/models/tiny-test-model-q8.slm'
    $requestTemplate = Join-Path $MiniModelSourceRoot 'examples/tiny-test-model-q8.minimodel-peer-import-request.json'
    Assert-Condition (Test-Path -LiteralPath $fixture -PathType Leaf) "Deterministic q8 package fixture is missing."
    Assert-Condition (Test-Path -LiteralPath $requestTemplate -PathType Leaf) "Deterministic peer import request template is missing."
    $ports = Get-DistinctFreeLoopbackPorts
    $laneAUrl = "http://127.0.0.1:$($ports[0])/"
    $laneBUrl = "http://127.0.0.1:$($ports[1])/"
    $addResult = Invoke-Captured -FilePath $tool -Arguments @(
        'add-model',
        '--model-id', 'tinyrustlm/tiny-test-model-q8',
        '--artifact', $fixture,
        '--lane-a-bind', "127.0.0.1:$($ports[0])",
        '--lane-a-url', $laneAUrl,
        '--lane-b-bind', "127.0.0.1:$($ports[1])",
        '--lane-b-url', $laneBUrl,
        '--root', $FleetRoot,
        '--json'
    )
    $added = Convert-ToolJson -Text $addResult.Text -Operation 'installed tool add-model'
    Assert-Condition ([bool]$added.ok -and [int]$added.value.fleet.admitted_model_count -eq 1) "Installed tool did not admit the fixture."
    $manifestPath = [string]$added.value.manifest_path
    Assert-Condition (Test-Path -LiteralPath $manifestPath -PathType Leaf) "Installed tool admission did not produce a manifest."

    $RequestPath = Join-Path $WorkRoot 'fixture-import-request.json'
    $requestText = (Get-Content -LiteralPath $requestTemplate -Raw).Replace('http://127.0.0.1:8123/', $laneAUrl)
    [IO.File]::WriteAllText($RequestPath, $requestText, (New-Object Text.UTF8Encoding($false)))
    $stage = 'fixture-serve-and-probe'
    $serveOut = Join-Path $WorkRoot 'serve.stdout.json'
    $serveErr = Join-Path $WorkRoot 'serve.stderr.txt'
    $serveArguments = @('serve', '--root', $FleetRoot, '--duration-seconds', '30', '--json')
    $serveProcess = Start-Process -FilePath $tool -ArgumentList $serveArguments -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -PassThru
    $probe = $null
    $probeDeadline = [Diagnostics.Stopwatch]::StartNew()
    while ($probeDeadline.Elapsed -lt [TimeSpan]::FromSeconds(15)) {
        Start-Sleep -Milliseconds 250
        if ($serveProcess.HasExited) {
            break
        }
        $probeAttempt = Invoke-Captured -FilePath $tool -Arguments @('probe-local', '--root', $FleetRoot, '--json') -ExpectedExitCodes @(0, 3)
        if ($probeAttempt.ExitCode -eq 0) {
            $probe = Convert-ToolJson -Text $probeAttempt.Text -Operation 'installed tool local probe'
            if ([bool]$probe.ok -and [bool]$probe.value.all_enabled_endpoints_reachable) {
                break
            }
        }
    }
    Assert-Condition ($null -ne $probe -and [bool]$probe.value.all_enabled_endpoints_reachable) "Installed tool lanes did not become locally reachable."
    Assert-Condition ([int]$probe.value.reachable_endpoint_count -eq 2) "Installed tool did not expose both independent fixture lanes."

    $stage = 'fixture-peer-import'
    $ImportRoot = Join-Path $WorkRoot 'fixture-imported'
    $importResult = Invoke-Captured -FilePath $tool -Arguments @(
        'import',
        '--request', $RequestPath,
        '--manifest', $manifestPath,
        '--output', $ImportRoot,
        '--timeout-seconds', '30',
        '--json'
    )
    $imported = Convert-ToolJson -Text $importResult.Text -Operation 'installed tool peer import'
    Assert-Condition ([bool]$imported.ok -and [int]$imported.value.piece_count -ge 1) "Installed tool peer import did not complete."
    Assert-Condition (([int]$imported.value.downloaded_piece_count + [int]$imported.value.reused_piece_count) -eq [int]$imported.value.piece_count) "Installed tool peer import did not account for every verified piece."
    $importedArtifact = [string]$imported.value.output_artifact_path
    Assert-Condition (Test-Path -LiteralPath $importedArtifact -PathType Leaf) "Installed tool import artifact is missing."
    Assert-Condition ((Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash -ceq (Get-FileHash -LiteralPath $importedArtifact -Algorithm SHA256).Hash) "Installed tool imported artifact differs from the source fixture."

    $stage = 'fixture-serve-shutdown'
    Assert-Condition ($serveProcess.WaitForExit(35000)) "Installed tool serve command did not stop after its bounded duration."
    $serve = Convert-ToolJson -Text (Get-Content -LiteralPath $serveOut -Raw) -Operation 'installed tool serve'
    Assert-Condition ([bool]$serve.ok) "Installed tool serve did not report success."
    Assert-Condition (@($serve.value.started).Count -eq 2) "Installed tool serve did not start exactly two lanes."
    Assert-Condition (@($serve.value.stopped).Count -eq 2) "Installed tool serve did not stop exactly two lanes."
    foreach ($stoppedLane in @($serve.value.stopped)) {
        Assert-Condition ([bool]$stoppedLane.graceful_shutdown) "Installed tool lane did not report graceful shutdown."
        Assert-Condition ([int]$stoppedLane.exit_code -eq 0) "Installed tool lane reported a nonzero exit code."
    }
    if ($null -ne $serveProcess.ExitCode) {
        Assert-Condition ($serveProcess.ExitCode -eq 0) "Installed tool serve command failed: $(Get-Content -LiteralPath $serveErr -Raw)"
    }

    $stage = 'missing-native-diagnostic'
    $MissingRoot = Join-Path $WorkRoot 'tool-missing-native'
    $missingTool = Install-SeedTool -Destination $MissingRoot -NuGetConfig $NuGetConfig
    $nativeFileName = if ($IsWindowsHost) { 'minimodel_native.dll' } else { 'libminimodel_native.so' }
    $missingCandidates = @(Get-ChildItem -LiteralPath $MissingRoot -Recurse -File -Filter $nativeFileName)
    Assert-Condition ($missingCandidates.Count -eq 1) "Missing-native test could not identify exactly one packaged native library."
    Rename-Item -LiteralPath $missingCandidates[0].FullName -NewName ($missingCandidates[0].Name + '.withheld')
    $missingResult = Invoke-Captured -FilePath $missingTool -Arguments @('doctor', '--json') -ExpectedExitCodes @(3)
    $missing = Convert-ToolJson -Text $missingResult.Text -Operation 'installed tool missing-native diagnostic'
    Assert-Condition (-not [bool]$missing.ok -and [string]$missing.error.code -ceq 'native_library_not_found') "Missing native library did not produce native_library_not_found."

    $stage = 'wrong-architecture-diagnostic'
    $WrongRoot = Join-Path $WorkRoot 'tool-wrong-native'
    $wrongTool = Install-SeedTool -Destination $WrongRoot -NuGetConfig $NuGetConfig
    $wrongCandidates = @(Get-ChildItem -LiteralPath $WrongRoot -Recurse -File -Filter $nativeFileName)
    Assert-Condition ($wrongCandidates.Count -eq 1) "Wrong-native test could not identify exactly one packaged native library."
    Rename-Item -LiteralPath $wrongCandidates[0].FullName -NewName ($wrongCandidates[0].Name + '.correct')
    $wrongSource = if ($IsWindowsHost) {
        Join-Path $RepoRoot 'artifacts/seed-host-native/linux-x64/libminimodel_native.so'
    }
    else {
        Join-Path $RepoRoot 'artifacts/seed-host-native/win-x64/minimodel_native.dll'
    }
    Assert-Condition (Test-Path -LiteralPath $wrongSource -PathType Leaf) "Wrong-architecture source library is missing."
    Copy-Item -LiteralPath $wrongSource -Destination $wrongCandidates[0].FullName
    $wrongResult = Invoke-Captured -FilePath $wrongTool -Arguments @('doctor', '--json') -ExpectedExitCodes @(3)
    $wrong = Convert-ToolJson -Text $wrongResult.Text -Operation 'installed tool wrong-native diagnostic'
    Assert-Condition (-not [bool]$wrong.ok -and [string]$wrong.error.code -ceq 'native_architecture_mismatch') "Wrong-architecture native library did not produce native_architecture_mismatch."

    [ordered]@{
        report_kind = 'uaix.seed_host.clean_consumer_verification.v0'
        report_version = 0
        generated_utc = [DateTimeOffset]::UtcNow.ToString('O')
        package_version = $Version
        csharp_consumer = 'passed'
        fsharp_consumer = 'passed'
        powershell_tool_invocation = 'passed'
        installed_tool_doctor_init_inspect = 'passed'
        installed_tool_converter = 'present-and-hashed'
        installed_tool_fixture_serve_import = 'passed'
        missing_native_diagnostic = 'native_library_not_found'
        wrong_architecture_diagnostic = 'native_architecture_mismatch'
        fixture_sha256 = "sha256:$((Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash.ToLowerInvariant())"
        status = 'passed'
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $WorkRoot 'CONSUMER-VERIFICATION.json') -Encoding UTF8
}
catch {
    $failure = [ordered]@{
        report_kind = 'uaix.seed_host.clean_consumer_failure.v0'
        report_version = 0
        generated_utc = [DateTimeOffset]::UtcNow.ToString('O')
        package_version = $Version
        stage = $stage
        error_type = $_.Exception.GetType().FullName
        error_message = $_.Exception.Message
        script_stack = $_.ScriptStackTrace
        secret_material_included = $false
        status = 'failed'
    } | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText(
        (Join-Path $WorkRoot 'CONSUMER-FAILURE.json'),
        $failure,
        (New-Object Text.UTF8Encoding($false)))
    throw
}
finally {
    $env:NUGET_PACKAGES = $oldNuGetPackages
    $env:MINIMODEL_NATIVE_PATH = $oldNativePath
    $env:MINIMODEL_CLI_PATH = $oldCliPath
}

Write-Host "Seed-host clean consumer verification passed."
Write-Host "Preserved consumer evidence: $WorkRoot"
