param(
    [string[]]$SiteRoots = @(),
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SourceRoot = (Resolve-Path (Join-Path $RepoRoot "..")).Path
$MaximumDocumentBytes = 8MB
$CheckedAtUtc = [DateTime]::UtcNow.ToString("o")
$RunId = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffffffZ")

if ([string]::IsNullOrWhiteSpace($ReportOutput)) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-doc-sites-audit-$RunId.json"
}
$ReportOutput = [IO.Path]::GetFullPath($ReportOutput)
if (Test-Path -LiteralPath $ReportOutput) {
    throw "ReportOutput is create-only and already exists: $ReportOutput"
}

function Get-Sha256Text {
    param([string]$Text)
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha256.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Resolve-DefaultSiteRoot {
    param([string]$SiteName)

    $canonicalRoot = Join-Path $SourceRoot $SiteName
    if (Test-Path -LiteralPath $canonicalRoot -PathType Container) {
        return (Resolve-Path -LiteralPath $canonicalRoot).Path
    }
    return [IO.Path]::GetFullPath($canonicalRoot)
}

function New-DocumentCheck {
    param(
        [string]$SiteName,
        [string]$SiteRoot,
        [string]$RelativePath,
        [string[]]$RequiredTerms,
        [string[]]$ForbiddenPatterns
    )

    $path = Join-Path $SiteRoot $RelativePath
    $exists = Test-Path -LiteralPath $path -PathType Leaf
    $byteLength = if ($exists) { (Get-Item -LiteralPath $path).Length } else { 0 }
    $bounded = $exists -and $byteLength -le $MaximumDocumentBytes
    $text = ""
    $decodeError = ""
    if ($bounded) {
        try {
            $strictUtf8 = [Text.UTF8Encoding]::new($false, $true)
            $text = $strictUtf8.GetString([IO.File]::ReadAllBytes($path))
        }
        catch [Text.DecoderFallbackException] {
            $decodeError = "invalid_utf8"
        }
    }
    $missingTerms = @($RequiredTerms | Where-Object {
        $text.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
    })
    $forbiddenMatches = New-Object System.Collections.Generic.List[string]
    foreach ($pattern in $ForbiddenPatterns) {
        if ([regex]::IsMatch($text, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $forbiddenMatches.Add($pattern)
        }
    }
    $status = if ($bounded -and -not $decodeError -and $missingTerms.Count -eq 0 -and $forbiddenMatches.Count -eq 0) {
        "pass"
    }
    else {
        "fail"
    }

    return [ordered]@{
        site = $SiteName
        relative_path = $RelativePath.Replace('\', '/')
        exists = $exists
        bounded = $bounded
        byte_length = $byteLength
        sha256 = if ($exists) { Get-FileSha256 -Path $path } else { "" }
        decode_error = $decodeError
        status = $status
        required_terms = @($RequiredTerms)
        missing_terms = @($missingTerms)
        forbidden_pattern_count = $ForbiddenPatterns.Count
        forbidden_matches = @($forbiddenMatches)
    }
}

$siteNames = @(
    "TinyRustLM.com",
    "TinyRustLM.MiRust.com",
    "MiniModel.org",
    "MiniModel.MiRust.com"
)

$resolvedSites = [ordered]@{}
if ($SiteRoots.Count -gt 0) {
    foreach ($root in $SiteRoots) {
        $full = [IO.Path]::GetFullPath($root)
        $name = Split-Path -Leaf $full
        if ($siteNames -notcontains $name) {
            throw "Unsupported site root '$root'. Expected one of: $($siteNames -join ', ')"
        }
        if ($resolvedSites.Contains($name)) {
            throw "Duplicate site root for $name"
        }
        $resolvedSites[$name] = $full
    }
}
foreach ($siteName in $siteNames) {
    if (-not $resolvedSites.Contains($siteName)) {
        $resolvedSites[$siteName] = Resolve-DefaultSiteRoot -SiteName $siteName
    }
}

$oldBrowserPrefix = "UAIX" + ".Browser"
$oldCompositionName = "ACG" + "1"
$forbiddenPatterns = @(
    [regex]::Escape($oldBrowserPrefix),
    'TinyRustLM\.Memory(?!Endpoints)',
    [regex]::Escape("tinyrustlm" + "-slm-pack"),
    ([regex]::Escape("." + $oldCompositionName.ToLowerInvariant()) + '(?:\b|`)'),
    ('\b' + [regex]::Escape($oldCompositionName) + '\b'),
    '\bproduct\s+V2\b',
    'download(?:ing)?\s+(?:a\s+)?(?:conversion\s+)?(?:request|script|text\s+file)',
    'download(?:ing)?\s+(?:a\s+)?\.txt'
)

$publicationTerms = @(
    "Last published",
    "Release date",
    "Update"
)
$packageTerms = @(
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P",
    "SLM2",
    "public readback"
)
$tinyRustLmTerms = @(
    "browser-local",
    "P2P-first",
    "local conversion",
    "no prompts",
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P",
    "SLM2"
)
$miniModelTerms = @(
    "direct P2P",
    "does not proxy model bytes",
    "cryptographic",
    "SLM2"
)

$siteRules = [ordered]@{
    "TinyRustLM.com" = @(
        [ordered]@{ path = "README.md"; terms = @($tinyRustLmTerms + $publicationTerms) }
    )
    "TinyRustLM.MiRust.com" = @(
        [ordered]@{ path = "README.md"; terms = @($packageTerms + $publicationTerms) },
        [ordered]@{ path = "llms.txt"; terms = @($packageTerms + $publicationTerms) },
        [ordered]@{ path = "llms-full.txt"; terms = @($packageTerms + $publicationTerms) },
        [ordered]@{ path = "docs/long-term-memory.md"; terms = @($packageTerms) }
    )
    "MiniModel.org" = @(
        [ordered]@{ path = "docs/catalog-boundary.md"; terms = @($miniModelTerms + $publicationTerms) }
    )
    "MiniModel.MiRust.com" = @(
        [ordered]@{ path = "README.md"; terms = @($miniModelTerms + $publicationTerms) },
        [ordered]@{ path = "llms.txt"; terms = @($miniModelTerms + $publicationTerms) },
        [ordered]@{ path = "llms-full.txt"; terms = @($miniModelTerms + $publicationTerms) },
        [ordered]@{ path = "docs/catalog-boundary.md"; terms = @($miniModelTerms) }
    )
}

$checks = New-Object System.Collections.Generic.List[object]
$sites = New-Object System.Collections.Generic.List[object]
foreach ($siteName in $siteNames) {
    $siteRoot = [string]$resolvedSites[$siteName]
    $rootExists = Test-Path -LiteralPath $siteRoot -PathType Container
    $sites.Add([ordered]@{
        name = $siteName
        configured_root_sha256 = Get-Sha256Text -Text $siteRoot
        exists = $rootExists
        required_document_count = $siteRules[$siteName].Count
    })
    foreach ($rule in $siteRules[$siteName]) {
        $checks.Add((New-DocumentCheck `
            -SiteName $siteName `
            -SiteRoot $siteRoot `
            -RelativePath $rule.path `
            -RequiredTerms $rule.terms `
            -ForbiddenPatterns $forbiddenPatterns))
    }
}

$failedChecks = @($checks | Where-Object { $_.status -ne "pass" })
$missingSites = @($sites | Where-Object { -not $_.exists })
$report = [ordered]@{
    schema = "tinyrustlm.public_doc_sites_audit.v1"
    checked_at_utc = $CheckedAtUtc
    status = if ($failedChecks.Count -eq 0 -and $missingSites.Count -eq 0) { "pass" } else { "fail" }
    product_lifecycle = "prelaunch-single-product"
    package_graph = @("TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P")
    portable_memory_backbone_package = "TinyRustLM.MemoryEndpoints"
    portable_memory_service = "https://memoryendpoints.com"
    portable_memory_recommendation = "strongly-recommended"
    memory_endpoints_uses = @("ecosystem-agent-coordination", "tinyrustlm-connect-user-plugin")
    memory_endpoints_lane_isolation = "required"
    prelaunch_redundant_memory = "allowed-if-synchronized"
    local_file_memory = "supported"
    private_package = "TinyRustLM.Conversion"
    current_model_format = "SLM2"
    model_flow = "verified-p2p-first-otherwise-reviewed-local-conversion"
    maximum_document_bytes = $MaximumDocumentBytes
    site_count = $sites.Count
    missing_site_count = $missingSites.Count
    check_count = $checks.Count
    failed_check_count = $failedChecks.Count
    sites = $sites.ToArray()
    checks = $checks.ToArray()
    secret_material_included = $false
    absolute_site_paths_included = $false
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
$temporaryPath = "$ReportOutput.tmp-$([Guid]::NewGuid().ToString('N'))"
try {
    $json = $report | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($temporaryPath, $json, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $ReportOutput
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}

Write-Host "TinyRustLM public documentation audit written to $ReportOutput"
if ($report.status -ne "pass") {
    throw "Public documentation audit failed: $($failedChecks.Count) document checks failed and $($missingSites.Count) site roots are missing."
}
