#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-${UAIX_BROWSER_NUGET_FEED:-$REPO_ROOT/artifacts/browser-feed}}"
NUGET_SOURCE="${2:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
REPORT_OUTPUT="${3:-${UAIX_BROWSER_PUBLISH_PLAN_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-publish-plan.json}}"
PACKAGE_VERSION="${PACKAGE_VERSION:-$("$REPO_ROOT/eng/get-package-version.sh")}"
AUDIT_REPORT="${AUDIT_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-feed-audit.json}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_VERIFICATION="${SKIP_VERIFICATION:-0}"

if [[ "$SKIP_VERIFICATION" != "1" ]]; then
  "$REPO_ROOT/eng/verify-browser-feed.sh" "$PACKAGE_SOURCE" "$PACKAGE_VERSION" "$AUDIT_REPORT"
fi

python3 - "$REPO_ROOT" "$PACKAGE_SOURCE" "$NUGET_SOURCE" "$REPORT_OUTPUT" "$PACKAGE_VERSION" "$AUDIT_REPORT" "$DRY_RUN" "$SKIP_VERIFICATION" <<'PY'
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

repo_root = Path(sys.argv[1]).resolve()
package_source = Path(sys.argv[2]).resolve()
nuget_source = sys.argv[3]
report_output = Path(sys.argv[4])
package_version = sys.argv[5]
audit_report = Path(sys.argv[6])
dry_run = sys.argv[7] == "1"
skip_verification = sys.argv[8] == "1"
api_key = os.environ.get("NUGET_API_KEY", "")
expected_package_ids = [
    "UAIX.Browser.Core.Abstractions",
    "UAIX.Browser.p2pLLM.Runtime",
    "UAIX.Browser.p2pRuntime.P2P",
    "UAIX.Browser.Memory",
    "UAIX.Browser.p2pLLM.Conversion",
]


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_id_from_name(name, extension):
    suffix = f".{package_version}{extension}"
    return name[:-len(suffix)] if name.lower().endswith(suffix.lower()) else Path(name).stem


def run_git(*args):
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), *args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except Exception:
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def non_empty_line_count(value):
    return len([line for line in value.splitlines() if line.strip()])


def source_provenance():
    git_repository_root = run_git("rev-parse", "--show-toplevel") or str(repo_root)
    commit = run_git("rev-parse", "HEAD")
    branch = run_git("branch", "--show-current") or run_git("rev-parse", "--abbrev-ref", "HEAD")
    tracked_change_count = non_empty_line_count(run_git("status", "--porcelain", "--untracked-files=no"))
    untracked_change_count = non_empty_line_count(run_git("ls-files", "--others", "--exclude-standard"))
    github_actions = os.environ.get("GITHUB_ACTIONS", "").lower() == "true"
    ci = os.environ.get("CI", "").lower() == "true" or github_actions
    return {
        "repository_root": str(repo_root),
        "git_repository_root": git_repository_root,
        "git_commit": commit,
        "git_branch": branch,
        "git_tree_dirty": tracked_change_count > 0 or untracked_change_count > 0,
        "git_tracked_change_count": tracked_change_count,
        "git_untracked_change_count": untracked_change_count,
        "ci": ci,
        "ci_provider": "github_actions" if github_actions else "ci" if ci else "local",
        "github_repository": os.environ.get("GITHUB_REPOSITORY", ""),
        "github_ref": os.environ.get("GITHUB_REF", ""),
        "github_sha": os.environ.get("GITHUB_SHA", ""),
        "github_run_id": os.environ.get("GITHUB_RUN_ID", ""),
        "github_workflow": os.environ.get("GITHUB_WORKFLOW", ""),
        "source_provenance_available": re.fullmatch(r"[0-9a-fA-F]{40}", commit or "") is not None,
    }


def blank_audit_evidence(error=""):
    return {
        "package_audit_report_path": str(audit_report),
        "package_audit_report_sha256": "",
        "package_audit_schema": "",
        "package_audit_status": "missing",
        "package_audit_match": False,
        "package_audit_error": error,
    }


def blank_hash_evidence(error=""):
    manifest_name = f"SHA256SUMS-UAIX.Browser-{package_version}.txt"
    return {
        "package_hash_manifest_name": manifest_name,
        "package_hash_manifest_path": str(package_source / manifest_name),
        "package_hash_manifest_sha256": "",
        "package_hash_manifest_status": "missing",
        "package_hash_manifest_match": False,
        "package_hash_manifest_error": error,
    }


def blank_readme_evidence(error=""):
    readme_name = f"README-UAIX.Browser-{package_version}.txt"
    return {
        "feed_readme_name": readme_name,
        "feed_readme_path": str(package_source / readme_name),
        "feed_readme_sha256": "",
        "feed_readme_status": "missing",
        "feed_readme_match": False,
        "feed_readme_missing_term_count": 0,
        "feed_readme_error": error,
    }


def package_report(path, extension):
    return {
        "name": path.name,
        "package_id": package_id_from_name(path.name, extension),
        "path": str(path),
        "sha256": sha256_file(path),
        "byte_count": path.stat().st_size,
    }


expected_names = [f"{package_id}.{package_version}.nupkg" for package_id in expected_package_ids]
expected_symbol_names = [f"{package_id}.{package_version}.snupkg" for package_id in expected_package_ids]
packages = sorted(package_source.glob("UAIX.Browser*.nupkg"), key=lambda path: path.name) if package_source.is_dir() else []
symbol_packages = sorted(package_source.glob("UAIX.Browser*.snupkg"), key=lambda path: path.name) if package_source.is_dir() else []
package_names = [path.name for path in packages]
symbol_package_names = [path.name for path in symbol_packages]
package_reports = [package_report(path, ".nupkg") for path in packages]
symbol_package_reports = [package_report(path, ".snupkg") for path in symbol_packages]


def write_plan(status, audit_evidence, hash_evidence, readme_evidence, publish_error=""):
    provenance = source_provenance()
    report = {
        "schema": "uaix.browser.nuget.publish_plan.v0",
        "generated_utc": utc_now(),
        "status": status,
        "package_source": str(package_source),
        "nuget_source": nuget_source,
        "package_version": package_version,
        "dry_run": dry_run,
        "skip_verification": skip_verification,
        "secret_material_included": False,
        "source_provenance_available": provenance["source_provenance_available"],
        "source_provenance": provenance,
        **audit_evidence,
        **hash_evidence,
        **readme_evidence,
        "publish_error": publish_error,
        "package_count": len(package_reports),
        "symbol_package_count": len(symbol_package_reports),
        "expected_package_ids": expected_package_ids,
        "expected_package_names": expected_names,
        "expected_symbol_package_names": expected_symbol_names,
        "symbol_publish_mode": "explicit_snupkg_push_after_primary_package",
        "packages": package_reports,
        "symbol_packages": symbol_package_reports,
    }
    report_output.parent.mkdir(parents=True, exist_ok=True)
    with report_output.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(f"UAIX Browser NuGet publish plan written to {report_output}")


def audit_evidence():
    if not audit_report.is_file():
        return blank_audit_evidence(f"UAIX Browser feed audit report is required before publishing: {audit_report}")
    evidence = blank_audit_evidence()
    evidence["package_audit_report_path"] = str(audit_report.resolve())
    evidence["package_audit_report_sha256"] = sha256_file(audit_report)
    try:
        audit = json.loads(audit_report.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        evidence["package_audit_status"] = "invalid"
        evidence["package_audit_error"] = f"UAIX Browser feed audit report is not valid JSON: {exc}"
        return evidence
    evidence["package_audit_schema"] = str(audit.get("schema", ""))
    evidence["package_audit_status"] = str(audit.get("status", ""))
    if audit.get("schema") != "uaix.browser.nuget.feed_audit.v0":
        evidence["package_audit_error"] = f"UAIX Browser feed audit schema mismatch: {audit.get('schema', '')}"
        return evidence
    if audit.get("status") != "pass":
        evidence["package_audit_error"] = f"UAIX Browser feed audit status is not pass: {audit.get('status', '')}"
        return evidence
    audit_packages = {str(package.get("name", "")): package for package in audit.get("packages", [])}
    audit_symbols = {str(package.get("name", "")): package for package in audit.get("symbol_packages", [])}
    for name in expected_names:
        if name not in audit_packages:
            evidence["package_audit_error"] = f"UAIX Browser feed audit is missing expected package: {name}"
            return evidence
    for name in expected_symbol_names:
        if name not in audit_symbols:
            evidence["package_audit_error"] = f"UAIX Browser feed audit is missing expected symbol package: {name}"
            return evidence
    for report in package_reports:
        audited = audit_packages.get(report["name"])
        if audited is None:
            evidence["package_audit_error"] = f"Publish package was not present in UAIX Browser feed audit: {report['name']}"
            return evidence
        if str(audited.get("sha256", "")).lower() != report["sha256"]:
            evidence["package_audit_error"] = f"Package hash differs from UAIX Browser feed audit: {report['name']}"
            return evidence
        if int(audited.get("byte_count", -1)) != int(report["byte_count"]):
            evidence["package_audit_error"] = f"Package size differs from UAIX Browser feed audit: {report['name']}"
            return evidence
    for report in symbol_package_reports:
        audited = audit_symbols.get(report["name"])
        if audited is None:
            evidence["package_audit_error"] = f"Publish symbol package was not present in UAIX Browser feed audit: {report['name']}"
            return evidence
        if str(audited.get("sha256", "")).lower() != report["sha256"]:
            evidence["package_audit_error"] = f"Symbol package hash differs from UAIX Browser feed audit: {report['name']}"
            return evidence
        if int(audited.get("byte_count", -1)) != int(report["byte_count"]):
            evidence["package_audit_error"] = f"Symbol package size differs from UAIX Browser feed audit: {report['name']}"
            return evidence
    evidence["package_audit_match"] = True
    return evidence


def hash_evidence():
    manifest_name = f"SHA256SUMS-UAIX.Browser-{package_version}.txt"
    manifest_path = package_source / manifest_name
    if not manifest_path.is_file():
        return blank_hash_evidence(f"UAIX Browser SHA-256 manifest is required before publishing: {manifest_path}")
    evidence = blank_hash_evidence()
    evidence["package_hash_manifest_path"] = str(manifest_path.resolve())
    evidence["package_hash_manifest_sha256"] = sha256_file(manifest_path)
    entries = {}
    for raw_line in manifest_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = re.fullmatch(r"([0-9a-fA-F]{64})\s+([^\\/:]+\.(?:nupkg|snupkg))", line)
        if match is None:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"UAIX Browser SHA-256 manifest contains an invalid line: {raw_line}"
            return evidence
        digest, name = match.groups()
        if name in entries:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"UAIX Browser SHA-256 manifest contains a duplicate package entry: {name}"
            return evidence
        entries[name] = digest.lower()
    all_expected_names = expected_names + expected_symbol_names
    for name in all_expected_names:
        if name not in entries:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"UAIX Browser SHA-256 manifest is missing expected package: {name}"
            return evidence
    for name in entries:
        if name not in all_expected_names:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"UAIX Browser SHA-256 manifest contains an unexpected package entry: {name}"
            return evidence
    hashes = {report["name"]: report["sha256"] for report in package_reports + symbol_package_reports}
    for name, digest in entries.items():
        if hashes.get(name) != digest:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"UAIX Browser SHA-256 manifest hash differs from package bytes: {name}"
            return evidence
    evidence["package_hash_manifest_status"] = "pass"
    evidence["package_hash_manifest_match"] = True
    return evidence


def readme_evidence():
    readme_name = f"README-UAIX.Browser-{package_version}.txt"
    readme_path = package_source / readme_name
    if not readme_path.is_file():
        return blank_readme_evidence(f"UAIX Browser feed README is required before publishing: {readme_path}")
    evidence = blank_readme_evidence()
    evidence["feed_readme_path"] = str(readme_path.resolve())
    evidence["feed_readme_sha256"] = sha256_file(readme_path)
    readme_text = readme_path.read_text(encoding="utf-8-sig")
    required_terms = (
        expected_names
        + expected_symbol_names
        + [
            "NuGet Package Manager",
            "debug-symbol sidecar",
            f"SHA256SUMS-UAIX.Browser-{package_version}.txt",
            "SymbolsPackage/PDB evidence",
            "publish-plan hashes",
            "feed-hash reports",
        ]
    )
    missing_terms = [term for term in required_terms if term.lower() not in readme_text.lower()]
    if missing_terms:
        evidence["feed_readme_status"] = "invalid"
        evidence["feed_readme_missing_term_count"] = len(missing_terms)
        evidence["feed_readme_error"] = (
            "UAIX Browser feed README is missing required symbol visibility term(s): "
            + ", ".join(missing_terms)
        )
        return evidence
    if not audit_report.is_file():
        evidence["feed_readme_status"] = "invalid"
        evidence["feed_readme_error"] = (
            f"UAIX Browser feed README cannot be bound because the feed audit report is missing: {audit_report}"
        )
        return evidence
    try:
        audit = json.loads(audit_report.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        evidence["feed_readme_status"] = "invalid"
        evidence["feed_readme_error"] = (
            f"UAIX Browser feed README cannot be bound because the feed audit report is invalid JSON: {exc}"
        )
        return evidence
    if audit.get("feed_readme_name") != readme_name:
        evidence["feed_readme_status"] = "invalid"
        evidence["feed_readme_error"] = f"UAIX Browser feed audit README name mismatch: {audit.get('feed_readme_name', '')}"
        return evidence
    if bool(audit.get("feed_readme_missing", False)):
        evidence["feed_readme_status"] = "invalid"
        evidence["feed_readme_error"] = "UAIX Browser feed audit reports the feed README as missing."
        return evidence
    if int(audit.get("feed_readme_missing_term_count") or 0) != 0:
        evidence["feed_readme_status"] = "invalid"
        evidence["feed_readme_missing_term_count"] = int(audit.get("feed_readme_missing_term_count") or 0)
        evidence["feed_readme_error"] = "UAIX Browser feed audit reports missing feed README terms."
        return evidence
    evidence["feed_readme_status"] = "pass"
    evidence["feed_readme_match"] = True
    return evidence


def fail_publish_set(message):
    audit = blank_audit_evidence()
    hashes = blank_hash_evidence()
    readme = blank_readme_evidence()
    write_plan("blocked_publish_set_mismatch", audit, hashes, readme, message)
    raise SystemExit(message)


if not package_source.is_dir():
    fail_publish_set(f"UAIX Browser package source does not exist: {package_source}")
if not package_names:
    fail_publish_set(f"No UAIX Browser packages were found in {package_source}")
missing = [name for name in expected_names if name not in package_names]
missing_symbols = [name for name in expected_symbol_names if name not in symbol_package_names]
unexpected = [name for name in package_names if name not in expected_names]
unexpected_symbols = [name for name in symbol_package_names if name not in expected_symbol_names]
if missing:
    fail_publish_set(f"Required UAIX Browser package is missing from publish set: {', '.join(missing)}")
if missing_symbols:
    fail_publish_set(f"Required UAIX Browser symbol package is missing from publish set: {', '.join(missing_symbols)}")
if unexpected:
    fail_publish_set(f"Publish set contains unexpected UAIX Browser package(s): {', '.join(unexpected)}. Expected exactly: {', '.join(expected_names)}")
if unexpected_symbols:
    fail_publish_set(f"Publish set contains unexpected UAIX Browser symbol package(s): {', '.join(unexpected_symbols)}. Expected exactly: {', '.join(expected_symbol_names)}")

audit = audit_evidence()
hashes = hash_evidence()
readme = readme_evidence()
if not audit["package_audit_match"]:
    status = "blocked_missing_audit_report" if audit["package_audit_status"] == "missing" else "blocked_audit_mismatch"
    write_plan(status, audit, hashes, readme)
    raise SystemExit(audit["package_audit_error"])
if not hashes["package_hash_manifest_match"]:
    status = "blocked_missing_hash_manifest" if hashes["package_hash_manifest_status"] == "missing" else "blocked_hash_manifest_mismatch"
    write_plan(status, audit, hashes, readme)
    raise SystemExit(hashes["package_hash_manifest_error"])
if not readme["feed_readme_match"]:
    status = "blocked_missing_feed_readme" if readme["feed_readme_status"] == "missing" else "blocked_feed_readme_mismatch"
    write_plan(status, audit, hashes, readme)
    raise SystemExit(readme["feed_readme_error"])

print("UAIX Browser NuGet publish set:")
for path in packages:
    print(f" - {path.name}")
print("UAIX Browser NuGet symbol publish set:")
for path in symbol_packages:
    print(f" - {path.name}")
print(f"NuGet source: {nuget_source}")
print(f"Package version: {package_version}")

if dry_run:
    write_plan("dry_run", audit, hashes, readme)
    print("Dry run requested; UAIX Browser packages were not pushed.")
    raise SystemExit(0)
if not api_key:
    write_plan("blocked_missing_api_key", audit, hashes, readme)
    raise SystemExit("NUGET_API_KEY is required unless DRY_RUN=1 is used.")

write_plan("ready_to_push", audit, hashes, readme)
for path in packages:
    command = [
        "dotnet",
        "nuget",
        "push",
        path.name,
        "--source",
        nuget_source,
        "--api-key",
        api_key,
        "--no-symbols",
        "--skip-duplicate",
    ]
    result = subprocess.run(command, cwd=str(package_source), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(result.stdout, end="")
    if result.returncode != 0:
        output = result.stdout.replace(api_key, "<redacted>")
        write_plan("push_failed", audit, hashes, readme, output)
        raise SystemExit(result.returncode)
for path in symbol_packages:
    command = [
        "dotnet",
        "nuget",
        "push",
        path.name,
        "--source",
        nuget_source,
        "--api-key",
        api_key,
        "--skip-duplicate",
    ]
    result = subprocess.run(command, cwd=str(package_source), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(result.stdout, end="")
    if result.returncode != 0:
        output = result.stdout.replace(api_key, "<redacted>")
        write_plan("push_failed", audit, hashes, readme, output)
        raise SystemExit(result.returncode)
write_plan("pushed", audit, hashes, readme)
PY
