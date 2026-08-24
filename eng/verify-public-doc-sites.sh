#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
REPORT_OUTPUT="${1:-$REPO_ROOT/artifacts/reports/tinyrustlm-public-doc-sites-audit.json}"
shift || true

if [[ "$#" -gt 0 ]]; then
  SITE_ROOTS=("$@")
else
  SITE_ROOTS=(
    "$SOURCE_ROOT/TinyRustLM.com"
    "$SOURCE_ROOT/TinyRustLM.MiRust.com"
    "$SOURCE_ROOT/MiniModel.org"
    "$SOURCE_ROOT/MiniModel.MiRust.com"
  )
fi

python3 - "$REPO_ROOT" "$SOURCE_ROOT" "$REPORT_OUTPUT" "${SITE_ROOTS[@]}" <<'PY'
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

repo_root = Path(sys.argv[1]).resolve()
source_root = Path(sys.argv[2]).resolve()
report_output = Path(sys.argv[3])
site_roots = [Path(path).resolve() if Path(path).is_dir() else Path(path) for path in sys.argv[4:]]

site_map = {
    "TinyRustLM.com": ["README.md"],
    "TinyRustLM.MiRust.com": ["README.md", "llms.txt", "llms-full.txt", "docs/long-term-memory.md", "data/pages.php"],
    "MiniModel.org": ["docs/catalog-boundary.md"],
    "MiniModel.MiRust.com": ["README.md", "llms.txt", "llms-full.txt", "docs/catalog-boundary.md"],
}
common_required_terms = [
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P",
    "TinyRustLM.Memory",
    ".snupkg",
    "symbol package",
    "symbol-hash-bound",
]
canonical_tinyrustlm_required_terms = [
    "Canonical Rust source root",
    "https://TinyRustLM.com/",
    "UAIX.Browser.p2pRuntime.SeedHost",
    "UAIX.Browser.p2pRuntime.SeedHost.Tool",
    "uaix-p2p-seed",
    "0.3.0",
    ".snupkg",
    "MiniModel.org",
]
browser_feed_required_terms = ["SymbolsPackage", "PDB evidence", "NuGet Package Manager", "debug-symbol sidecar"]
browser_feed_current_required_terms = [
    "TINYRUSTLM_FEED_PACKAGE_IDS",
    "UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT",
    "uaix-browser-nuget-feed-current.json",
]
browser_publish_required_terms = [
    "release-browser-nuget.yml",
    "audit-browser-nuget-release-readiness.ps1",
    "uaix.browser.nuget.release_readiness.v0",
    "uaix-browser-nuget-release-readiness.json",
    "uaix-browser-nuget-release-readiness-publish-plan-dry-run.json",
    "published_current",
    "blocked_remote_hash_mismatch",
    "VersionPrefix",
    "publish-browser-nuget.ps1",
    "uaix.browser.nuget.publish_plan.v0",
    "uaix-browser-nuget-publish-plan.json",
    "uaix-browser-nuget-feed-hashes.json",
    "UAIX.Browser.p2pLLM.Runtime",
]
browser_nuget_published_required_terms = [
    "UAIX.Browser.Core.Abstractions",
    "UAIX.Browser.p2pLLM.Runtime",
    "UAIX.Browser.p2pRuntime.P2P",
    "UAIX.Browser.Memory",
    "UAIX.Browser.p2pLLM.Conversion",
    "0.1.8",
    "post-publish verified",
]
ui_verification_required_terms = [
    "tinyrustlm.ui_verification.v1",
    "verify-tinyrustlm-ui.ps1",
    "web-release-local-smoke.js",
    "RunDeepAcquisition",
    "model-acquisition.test.js",
    "Local .slm",
    "Hugging Face",
    "Get model",
    "Advanced tools",
    ".acg1",
]
public_root_verification_required_terms = [
    "tinyrustlm.public_root_verification.v1",
    "verify-tinyrustlm-public-root.ps1",
    "verify-tinyrustlm-public-root.sh",
    "tinyrustlm-public-root-verification.json",
    "ui_verification_sha256",
]
browser_memory_filedeck_required_terms = [
    "FileDeck",
    "FileDeck 62 required",
    "UAIX memory active",
    "UAIX exports verified",
    "persona source evidence bound",
    "uaix_memory=advanced_persona_profile",
]
local_connect_category_binding_required_terms = [
    "unknown endpoint-listed app",
    "row-selected category",
    "known app category drift",
    "typed-action-dry-run-default-execution-consent-v1",
    "x-tinyrustlm-execution-consent",
    "native-opener-v1",
]
huggingface_top_compatible_required_terms = [
    "top 100",
    "top 500",
    "TinyRustLM-ready",
    "Popular",
    "New releases",
    "Get model",
]
browser_companion_boundary_required_terms = [
    "public-local-only",
    "one-time pairing",
    "P2P-first",
    "canonical companion",
    "conversion-kit",
    "e2e/companion.spec.js",
    "969,648,576",
    "Prompts and responses never",
]
minimodel_peer_metadata_cors_required_terms = [
    "CORS/PNA",
    "Check Peer",
    "non-CORS",
]
stale_literal_patterns = [
    "authenticated publish plus feed-current and feed-hash verification",
    "feed-current and feed-hash verification passes",
    "feed-current plus feed-hash verification",
    "NuGet.org has zero listed versions",
    "NuGet.org reports zero listed versions",
    "blocked_missing_api_key",
    "version `0.1.1` with SHA256SUMS-bound package-hash evidence",
    "version `0.1.2` and passed clean consumer",
    "typed-action-dry-run-default-v1",
    "TinyRustLM.Abstractions, TinyRustLM.Core, and TinyRustLM.P2P",
    "TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P",
]


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_text(path):
    return path.read_text(encoding="utf-8-sig", errors="replace")


def new_check(name, path, required_terms):
    exists = path.is_file()
    text = read_text(path) if exists else ""
    missing_terms = [term for term in required_terms if term.lower() not in text.lower()]
    status = "pass" if exists and not missing_terms else "fail"
    return {
        "name": name,
        "path": str(path),
        "exists": exists,
        "status": status,
        "sha256": sha256_file(path) if exists else "",
        "required_terms": required_terms,
        "missing_terms": missing_terms,
        "forbidden_terms": [],
        "forbidden_matches": [],
    }


site_root_reports = [{"path": str(root), "exists": root.is_dir()} for root in site_roots]
checks = []
for site_root in site_roots:
    site_name = site_root.name
    for relative_path in site_map.get(site_name, []):
        required_terms = (
            list(canonical_tinyrustlm_required_terms)
            if site_name == "TinyRustLM.com"
            else list(common_required_terms)
        )
        if site_name in {"TinyRustLM.MiRust.com", "MiniModel.org", "MiniModel.MiRust.com"}:
            required_terms.append("SHA256SUMS")
            required_terms.append("symbol_publish_mode")
            required_terms.append("explicit_snupkg_push_after_primary_package")
            required_terms.extend(browser_nuget_published_required_terms)
        if site_name == "TinyRustLM.MiRust.com":
            required_terms.extend(browser_feed_required_terms)
            required_terms.extend(browser_feed_current_required_terms)
            required_terms.extend(browser_publish_required_terms)
            required_terms.extend(ui_verification_required_terms)
            required_terms.extend(public_root_verification_required_terms)
            required_terms.extend(browser_memory_filedeck_required_terms)
            required_terms.extend(local_connect_category_binding_required_terms)
            required_terms.extend(huggingface_top_compatible_required_terms)
        if site_name == "TinyRustLM.com" and relative_path == "README.md":
            required_terms.extend(browser_companion_boundary_required_terms)
        elif relative_path == "docs/catalog-boundary.md":
            required_terms.append("SHA256SUMS-bound")
            required_terms.extend(minimodel_peer_metadata_cors_required_terms)
        checks.append(new_check(f"{site_name}/{relative_path}", site_root / relative_path, required_terms))

stale_matches = []
for path in [Path(check["path"]) for check in checks if check["exists"]]:
    for line_number, line in enumerate(read_text(path).splitlines(), start=1):
        if "TinyRustLM.Abstractions" in line and "TinyRustLM.P2P" in line and "TinyRustLM.Memory" not in line:
            stale_matches.append({
                "path": str(path),
                "line": line_number,
                "pattern": "three_package_without_memory",
                "text": line,
            })
        for pattern in stale_literal_patterns:
            if pattern.lower() in line.lower():
                stale_matches.append({
                    "path": str(path),
                    "line": line_number,
                    "pattern": pattern,
                    "text": line,
                })

missing_roots = [root for root in site_root_reports if not root["exists"]]
missing_files = [check for check in checks if not check["exists"]]
failed_checks = [check for check in checks if check["status"] != "pass"]
status = "pass" if not missing_roots and not failed_checks and not stale_matches else "fail"

report = {
    "schema": "tinyrustlm.docs.public_site_audit.v0",
    "generated_utc": utc_now(),
    "status": status,
    "repository_root": str(repo_root),
    "source_root": str(source_root),
    "secret_material_included": False,
    "site_roots": site_root_reports,
    "missing_site_root_count": len(missing_roots),
    "missing_file_count": len(missing_files),
    "failed_check_count": len(failed_checks),
    "stale_match_count": len(stale_matches),
    "checks": checks,
    "stale_matches": stale_matches,
}

report_output.parent.mkdir(parents=True, exist_ok=True)
with report_output.open("w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(f"TinyRustLM public doc-sites audit written to {report_output}")
if status != "pass":
    raise SystemExit(f"TinyRustLM public doc-sites audit failed. See {report_output}")
print("TinyRustLM public doc-sites audit passed.")
PY
