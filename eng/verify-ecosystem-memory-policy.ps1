param(
    [string]$SiteWorkspaceRoot = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SourceRoot = (Resolve-Path (Join-Path $RepoRoot "..")).Path

if ([string]::IsNullOrWhiteSpace($SiteWorkspaceRoot)) {
    $SiteWorkspaceRoot = $SourceRoot
}
$SiteWorkspaceRoot = [IO.Path]::GetFullPath($SiteWorkspaceRoot)

$sites = [ordered]@{
    "TinyRustLM.com" = $RepoRoot
    "LMComposer.com" = Join-Path $SiteWorkspaceRoot "LMComposer.com"
    "MiniModel.MiRust.com" = Join-Path $SiteWorkspaceRoot "MiniModel.MiRust.com"
    "MiniModel.org" = Join-Path $SiteWorkspaceRoot "MiniModel.org"
    "MiRust.com" = Join-Path $SiteWorkspaceRoot "MiRust.com"
    "Runtime.MiRust.com" = Join-Path $SiteWorkspaceRoot "Runtime.MiRust.com"
    "TinyRustLM.MiRust.com" = Join-Path $SiteWorkspaceRoot "TinyRustLM.MiRust.com"
}

$relativePaths = @(
    ".uai/totem.uai",
    ".uai/taboo.uai",
    "workspace.uai"
)

$requiredPatterns = [ordered]@{
    service = 'MemoryEndpoints\.com'
    direct_agent_identity = 'agent-to-agent'
    long_term_memory = 'long-term memory'
    meetings = '\bmeetings\b'
    handoffs = '\bhandoffs\b'
    coordination = '\bcoordination\b'
    user_plugin_identity = 'TinyRustLM\.com Connect'
    explicit_sign_in = '\bsigns?\s+in\b'
    lane_separation = '\bseparat(?:e|ely|ion)\w*\b'
    credentials = '\bcredentials\b'
    consent = '\bconsent\b'
    scopes = '\bscopes?\b'
    provenance = '\bprovenance\b'
    receipts = '\breceipts?\b'
    current_copy = '\bcurrent\b'
    secret_safety = 'secret-safe|credential-safe'
    contradiction_control = 'noncontradictory|contradict|\bdrift\b'
}

$forbiddenPatterns = [ordered]@{
    wrong_connect_product = 'LocalEndpoints\.com\s+connect'
    superseded_memory_package = 'TinyRustLM\.Memory(?!Endpoints)'
    superseded_browser_package = 'UAIX\.Browser'
    superseded_model_suffix = '(?:^|[^a-z0-9])\.slm(?:\b|`)'
}

$checks = @()
$failures = @()
foreach ($siteName in $sites.Keys) {
    $siteRoot = [string]$sites[$siteName]
    foreach ($relativePath in $relativePaths) {
        $path = Join-Path $siteRoot $relativePath
        $exists = Test-Path -LiteralPath $path -PathType Leaf
        $missing = @()
        $forbidden = @()
        $text = ""
        if ($exists) {
            $strictUtf8 = New-Object Text.UTF8Encoding($false, $true)
            try {
                $text = $strictUtf8.GetString([IO.File]::ReadAllBytes($path))
            }
            catch [Text.DecoderFallbackException] {
                $missing += "valid_utf8"
            }
            foreach ($entry in $requiredPatterns.GetEnumerator()) {
                if (-not [regex]::IsMatch($text, $entry.Value,
                        [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                    $missing += [string]$entry.Key
                }
            }
            foreach ($entry in $forbiddenPatterns.GetEnumerator()) {
                if ([regex]::IsMatch($text, $entry.Value,
                        [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                    $forbidden += [string]$entry.Key
                }
            }
        }
        else {
            $missing += "file"
        }

        $status = if ($missing.Count -eq 0 -and $forbidden.Count -eq 0) {
            "pass"
        }
        else {
            "fail"
        }
        $check = [ordered]@{
            site = $siteName
            relative_path = $relativePath
            exists = $exists
            byte_length = if ($exists) { (Get-Item -LiteralPath $path).Length } else { 0 }
            sha256 = if ($exists) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() } else { "" }
            status = $status
            missing_rules = @($missing)
            forbidden_rules = @($forbidden)
        }
        $checks += $check
        if ($status -ne "pass") {
            $failures += $check
        }
    }
}

$report = [ordered]@{
    schema = "tinyrustlm.ecosystem_memory_policy_audit.v1"
    checked_at_utc = [DateTime]::UtcNow.ToString("o")
    status = if ($failures.Count -eq 0) { "pass" } else { "fail" }
    site_count = $sites.Count
    file_count = $checks.Count
    failure_count = $failures.Count
    memory_endpoints_uses = @(
        "ecosystem-agent-coordination",
        "tinyrustlm-connect-user-plugin"
    )
    lane_isolation = "required"
    prelaunch_redundancy = "allowed-if-synchronized"
    checks = @($checks)
}

$report | ConvertTo-Json -Depth 8
if ($failures.Count -gt 0) {
    throw "Ecosystem memory policy audit failed for $($failures.Count) of $($checks.Count) files."
}
