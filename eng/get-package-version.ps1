param(
    [string]$PropsPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $PropsPath) {
    $PropsPath = Join-Path $RepoRoot "dotnet/Directory.Build.props"
}
if (-not (Test-Path -LiteralPath $PropsPath)) {
    throw "Version props file does not exist: $PropsPath"
}

function Get-PropertyText {
    param(
        [xml]$Document,
        [string]$Name
    )

    $node = $Document.SelectSingleNode("//*[local-name()='$Name']")
    if ($node) {
        return $node.InnerText.Trim()
    }
    return ""
}

[xml]$props = Get-Content -LiteralPath $PropsPath
$version = Get-PropertyText -Document $props -Name "Version"
if ($version) {
    Write-Output $version
    return
}

$versionPrefix = Get-PropertyText -Document $props -Name "VersionPrefix"
if (-not $versionPrefix) {
    throw "VersionPrefix is missing from $PropsPath"
}

$versionSuffix = Get-PropertyText -Document $props -Name "VersionSuffix"
if ($versionSuffix) {
    Write-Output "$versionPrefix-$versionSuffix"
}
else {
    Write-Output $versionPrefix
}
