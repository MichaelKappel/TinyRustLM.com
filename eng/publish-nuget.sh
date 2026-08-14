#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIGURATION="${CONFIGURATION:-Release}"
PACKAGE_SOURCE="${1:-$REPO_ROOT/artifacts/packages}"
NUGET_SOURCE="${2:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
REPORT_OUTPUT="${3:-${TINYRUSTLM_PUBLISH_PLAN_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-publish-plan.json}}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_VERIFICATION="${SKIP_VERIFICATION:-0}"
PACKAGE_VERSION="${PACKAGE_VERSION:-$("$REPO_ROOT/eng/get-package-version.sh")}"
AUDIT_REPORT="${AUDIT_REPORT:-${TINYRUSTLM_PACKAGE_AUDIT_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-package-audit.json}}"

write_publish_plan() {
  local status="$1"
  local dry_run_value="$2"
  python3 - "$REPORT_OUTPUT" "$status" "$dry_run_value" "$PACKAGE_SOURCE" "$NUGET_SOURCE" "$PACKAGE_VERSION" "$SKIP_VERIFICATION" "$AUDIT_REPORT" "$REPO_ROOT" "${EXPECTED_NAMES[@]}" -- "${PACKAGES[@]}" <<'PY'
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

report_output, status, dry_run_raw, package_source, nuget_source, package_version, skip_verification, audit_report, repo_root = sys.argv[1:10]
separator = sys.argv.index("--")
expected_names = sys.argv[10:separator]
package_paths = sys.argv[separator + 1:]
suffix = f".{package_version}.nupkg"
symbol_suffix = f".{package_version}.snupkg"
repo_root = os.path.abspath(repo_root)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_git(*args):
    try:
        result = subprocess.run(
            ["git", "-C", repo_root, *args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except Exception:
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def non_empty_line_count(value):
    return len([line for line in value.splitlines() if line.strip()])


def env(name):
    return os.environ.get(name, "")


def source_provenance():
    git_repository_root = run_git("rev-parse", "--show-toplevel") or repo_root
    commit = run_git("rev-parse", "HEAD")
    branch = run_git("branch", "--show-current") or run_git("rev-parse", "--abbrev-ref", "HEAD")
    tracked_change_count = non_empty_line_count(run_git("status", "--porcelain", "--untracked-files=no"))
    untracked_change_count = non_empty_line_count(run_git("ls-files", "--others", "--exclude-standard"))
    github_actions = env("GITHUB_ACTIONS").lower() == "true"
    ci = env("CI").lower() == "true" or github_actions
    ci_provider = "github_actions" if github_actions else "ci" if ci else "local"

    return {
        "repository_root": repo_root,
        "git_repository_root": git_repository_root,
        "git_commit": commit,
        "git_branch": branch,
        "git_tree_dirty": tracked_change_count > 0 or untracked_change_count > 0,
        "git_tracked_change_count": tracked_change_count,
        "git_untracked_change_count": untracked_change_count,
        "ci": ci,
        "ci_provider": ci_provider,
        "github_repository": env("GITHUB_REPOSITORY"),
        "github_ref": env("GITHUB_REF"),
        "github_sha": env("GITHUB_SHA"),
        "github_run_id": env("GITHUB_RUN_ID"),
        "github_workflow": env("GITHUB_WORKFLOW"),
        "source_provenance_available": re.fullmatch(r"[0-9a-fA-F]{40}", commit) is not None,
    }


packages = []
for path in package_paths:
    name = os.path.basename(path)
    package_id = name[:-len(suffix)] if name.lower().endswith(suffix.lower()) else os.path.splitext(name)[0]
    packages.append({
        "name": name,
        "package_id": package_id,
        "path": os.path.abspath(path),
        "sha256": sha256_file(path),
        "byte_count": os.path.getsize(path),
    })

expected_symbol_names = [
    name[:-len(".nupkg")] + ".snupkg"
    for name in expected_names
]
symbol_packages = []
for name in expected_symbol_names:
    path = os.path.join(package_source, name)
    package_id = name[:-len(symbol_suffix)] if name.lower().endswith(symbol_suffix.lower()) else os.path.splitext(name)[0]
    symbol_packages.append({
        "name": name,
        "package_id": package_id,
        "path": os.path.abspath(path),
        "sha256": sha256_file(path),
        "byte_count": os.path.getsize(path),
    })


def package_audit_evidence():
    evidence = {
        "package_audit_report_path": audit_report,
        "package_audit_report_sha256": "",
        "package_audit_status": "missing",
        "package_audit_match": False,
        "package_audit_error": "",
    }
    if not os.path.isfile(audit_report):
        evidence["package_audit_error"] = f"Package audit report is required before publishing: {audit_report}"
        return evidence

    evidence["package_audit_report_path"] = os.path.abspath(audit_report)
    evidence["package_audit_report_sha256"] = sha256_file(audit_report)
    try:
        with open(audit_report, "r", encoding="utf-8-sig") as handle:
            audit = json.load(handle)
    except Exception as exc:
        evidence["package_audit_status"] = "invalid"
        evidence["package_audit_error"] = f"Package audit report is not valid JSON: {exc}"
        return evidence

    evidence["package_audit_status"] = str(audit.get("status", ""))
    if audit.get("schema") != "tinyrustlm.nuget.package_audit.v1":
        evidence["package_audit_error"] = f"Package audit report schema mismatch: {audit.get('schema', '')}"
        return evidence
    if audit.get("status") != "pass":
        evidence["package_audit_error"] = f"Package audit report status is not pass: {audit.get('status', '')}"
        return evidence

    audit_packages = {str(package.get("name", "")): package for package in audit.get("packages", [])}
    audit_symbol_packages = {str(package.get("name", "")): package for package in audit.get("symbol_packages", [])}
    for expected_name in expected_names:
        if expected_name not in audit_packages:
            evidence["package_audit_error"] = f"Package audit report is missing expected package: {expected_name}"
            return evidence
    for expected_name in expected_symbol_names:
        if expected_name not in audit_symbol_packages:
            evidence["package_audit_error"] = f"Package audit report is missing expected symbol package: {expected_name}"
            return evidence
    for package in packages:
        audit_package = audit_packages.get(package["name"])
        if audit_package is None:
            evidence["package_audit_error"] = f"Publish package was not present in audit report: {package['name']}"
            return evidence
        if str(audit_package.get("sha256", "")).lower() != package["sha256"]:
            evidence["package_audit_error"] = f"Package hash differs from audit report: {package['name']}"
            return evidence
        if int(audit_package.get("byte_count", -1)) != int(package["byte_count"]):
            evidence["package_audit_error"] = f"Package size differs from audit report: {package['name']}"
            return evidence
    for package in symbol_packages:
        audit_package = audit_symbol_packages.get(package["name"])
        if audit_package is None:
            evidence["package_audit_error"] = f"Publish symbol package was not present in audit report: {package['name']}"
            return evidence
        if str(audit_package.get("sha256", "")).lower() != package["sha256"]:
            evidence["package_audit_error"] = f"Symbol package hash differs from audit report: {package['name']}"
            return evidence
        if int(audit_package.get("byte_count", -1)) != int(package["byte_count"]):
            evidence["package_audit_error"] = f"Symbol package size differs from audit report: {package['name']}"
            return evidence

    evidence["package_audit_match"] = True
    return evidence


def package_hash_manifest_evidence():
    manifest_name = f"SHA256SUMS-TinyRustLM-{package_version}.txt"
    manifest_path = os.path.join(package_source, manifest_name)
    evidence = {
        "package_hash_manifest_name": manifest_name,
        "package_hash_manifest_path": manifest_path,
        "package_hash_manifest_sha256": "",
        "package_hash_manifest_status": "missing",
        "package_hash_manifest_match": False,
        "package_hash_manifest_error": "",
    }
    if not os.path.isfile(manifest_path):
        evidence["package_hash_manifest_error"] = f"Package SHA-256 manifest is required before publishing: {manifest_path}"
        return evidence

    manifest_path = os.path.abspath(manifest_path)
    evidence["package_hash_manifest_path"] = manifest_path
    evidence["package_hash_manifest_sha256"] = sha256_file(manifest_path)
    entries = {}
    with open(manifest_path, "r", encoding="utf-8-sig") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue
            match = re.fullmatch(r"([0-9a-fA-F]{64})\s+([^\\/:]+\.(?:nupkg|snupkg))", line)
            if match is None:
                evidence["package_hash_manifest_status"] = "invalid"
                evidence["package_hash_manifest_error"] = f"Package SHA-256 manifest contains an invalid line: {raw_line.rstrip()}"
                return evidence
            digest, name = match.groups()
            if name in entries:
                evidence["package_hash_manifest_status"] = "invalid"
                evidence["package_hash_manifest_error"] = f"Package SHA-256 manifest contains a duplicate package entry: {name}"
                return evidence
            entries[name] = digest.lower()

    expected_all_names = expected_names + expected_symbol_names
    for expected_name in expected_all_names:
        if expected_name not in entries:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"Package SHA-256 manifest is missing expected package: {expected_name}"
            return evidence
    for entry_name in entries:
        if entry_name not in expected_all_names:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"Package SHA-256 manifest contains an unexpected package entry: {entry_name}"
            return evidence

    package_hashes = {
        package["name"]: package["sha256"]
        for package in packages + symbol_packages
    }
    for package_name, manifest_hash in entries.items():
        if package_hashes.get(package_name) != manifest_hash:
            evidence["package_hash_manifest_status"] = "invalid"
            evidence["package_hash_manifest_error"] = f"Package SHA-256 manifest hash differs from package bytes: {package_name}"
            return evidence

    evidence["package_hash_manifest_status"] = "pass"
    evidence["package_hash_manifest_match"] = True
    return evidence


audit_evidence = package_audit_evidence()
hash_manifest_evidence = package_hash_manifest_evidence()
source = source_provenance()
report = {
    "schema": "tinyrustlm.nuget.publish_plan.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "package_source": os.path.abspath(package_source),
    "nuget_source": nuget_source,
    "package_version": package_version,
    "dry_run": dry_run_raw == "1",
    "skip_verification": skip_verification == "1",
    "secret_material_included": False,
    "source_provenance_available": source["source_provenance_available"],
    "source_provenance": source,
    "package_audit_report_path": audit_evidence["package_audit_report_path"],
    "package_audit_report_sha256": audit_evidence["package_audit_report_sha256"],
    "package_audit_status": audit_evidence["package_audit_status"],
    "package_audit_match": audit_evidence["package_audit_match"],
    "package_audit_error": audit_evidence["package_audit_error"],
    "package_hash_manifest_name": hash_manifest_evidence["package_hash_manifest_name"],
    "package_hash_manifest_path": hash_manifest_evidence["package_hash_manifest_path"],
    "package_hash_manifest_sha256": hash_manifest_evidence["package_hash_manifest_sha256"],
    "package_hash_manifest_status": hash_manifest_evidence["package_hash_manifest_status"],
    "package_hash_manifest_match": hash_manifest_evidence["package_hash_manifest_match"],
    "package_hash_manifest_error": hash_manifest_evidence["package_hash_manifest_error"],
    "publish_error": os.environ.get("TINYRUSTLM_PUBLISH_ERROR", ""),
    "package_count": len(packages),
    "symbol_package_count": len(symbol_packages),
    "expected_package_names": expected_names,
    "expected_symbol_package_names": expected_symbol_names,
    "symbol_publish_mode": "explicit_snupkg_push_after_primary_package",
    "packages": packages,
    "symbol_packages": symbol_packages,
}

os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(f"TinyRustLM NuGet publish plan written to {report_output}")
PY
}

validate_package_audit_binding() {
  python3 - "$AUDIT_REPORT" "${EXPECTED_NAMES[@]}" -- "${PACKAGES[@]}" <<'PY'
import hashlib
import json
import os
import sys

audit_report = sys.argv[1]
separator = sys.argv.index("--")
expected_names = sys.argv[2:separator]
package_paths = sys.argv[separator + 1:]
package_source = os.path.dirname(os.path.abspath(package_paths[0])) if package_paths else os.getcwd()
expected_symbol_names = [
    name[:-len(".nupkg")] + ".snupkg"
    for name in expected_names
]
symbol_package_paths = [os.path.join(package_source, name) for name in expected_symbol_names]


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if not os.path.isfile(audit_report):
    raise SystemExit(f"Package audit report is required before publishing: {audit_report}")

with open(audit_report, "r", encoding="utf-8-sig") as handle:
    audit = json.load(handle)
if audit.get("schema") != "tinyrustlm.nuget.package_audit.v1":
    raise SystemExit(f"Package audit report schema mismatch: {audit.get('schema', '')}")
if audit.get("status") != "pass":
    raise SystemExit(f"Package audit report status is not pass: {audit.get('status', '')}")

audit_packages = {str(package.get("name", "")): package for package in audit.get("packages", [])}
audit_symbol_packages = {str(package.get("name", "")): package for package in audit.get("symbol_packages", [])}
for expected_name in expected_names:
    if expected_name not in audit_packages:
        raise SystemExit(f"Package audit report is missing expected package: {expected_name}")
for expected_name in expected_symbol_names:
    if expected_name not in audit_symbol_packages:
        raise SystemExit(f"Package audit report is missing expected symbol package: {expected_name}")

for path in package_paths:
    name = os.path.basename(path)
    audit_package = audit_packages.get(name)
    if audit_package is None:
        raise SystemExit(f"Publish package was not present in audit report: {name}")
    if str(audit_package.get("sha256", "")).lower() != sha256_file(path):
        raise SystemExit(f"Package hash differs from audit report: {name}")
    if int(audit_package.get("byte_count", -1)) != os.path.getsize(path):
        raise SystemExit(f"Package size differs from audit report: {name}")
for path in symbol_package_paths:
    name = os.path.basename(path)
    audit_package = audit_symbol_packages.get(name)
    if audit_package is None:
        raise SystemExit(f"Publish symbol package was not present in audit report: {name}")
    if str(audit_package.get("sha256", "")).lower() != sha256_file(path):
        raise SystemExit(f"Symbol package hash differs from audit report: {name}")
    if int(audit_package.get("byte_count", -1)) != os.path.getsize(path):
        raise SystemExit(f"Symbol package size differs from audit report: {name}")
PY
}

validate_package_hash_manifest_binding() {
  python3 - "$PACKAGE_SOURCE" "$PACKAGE_VERSION" "${EXPECTED_NAMES[@]}" "${EXPECTED_SYMBOL_NAMES[@]}" -- "${PACKAGES[@]}" "${SYMBOL_PACKAGES[@]}" <<'PY'
import hashlib
import os
import re
import sys

package_source = sys.argv[1]
package_version = sys.argv[2]
separator = sys.argv.index("--")
expected_names = sys.argv[3:separator]
package_paths = sys.argv[separator + 1:]
manifest_path = os.path.join(package_source, f"SHA256SUMS-TinyRustLM-{package_version}.txt")


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if not os.path.isfile(manifest_path):
    raise SystemExit(f"Package SHA-256 manifest is required before publishing: {manifest_path}")

entries = {}
with open(manifest_path, "r", encoding="utf-8-sig") as handle:
    for raw_line in handle:
        line = raw_line.strip()
        if not line:
            continue
        match = re.fullmatch(r"([0-9a-fA-F]{64})\s+([^\\/:]+\.(?:nupkg|snupkg))", line)
        if match is None:
            raise SystemExit(f"Package SHA-256 manifest contains an invalid line: {raw_line.rstrip()}")
        digest, name = match.groups()
        if name in entries:
            raise SystemExit(f"Package SHA-256 manifest contains a duplicate package entry: {name}")
        entries[name] = digest.lower()

for expected_name in expected_names:
    if expected_name not in entries:
        raise SystemExit(f"Package SHA-256 manifest is missing expected package: {expected_name}")
for entry_name in entries:
    if entry_name not in expected_names:
        raise SystemExit(f"Package SHA-256 manifest contains an unexpected package entry: {entry_name}")
for package_path in package_paths:
    package_name = os.path.basename(package_path)
    if entries.get(package_name) != sha256_file(package_path):
        raise SystemExit(f"Package SHA-256 manifest hash differs from package bytes: {package_name}")
PY
}

if [[ "$SKIP_VERIFICATION" != "1" ]]; then
  "$REPO_ROOT/eng/verify-package.sh" "$CONFIGURATION"
fi

if [[ ! -d "$PACKAGE_SOURCE" ]]; then
  echo "Package source does not exist: $PACKAGE_SOURCE" >&2
  exit 1
fi
PACKAGE_SOURCE="$(cd "$PACKAGE_SOURCE" && pwd)"

mapfile -t PACKAGES < <(find "$PACKAGE_SOURCE" -maxdepth 1 -type f -name 'TinyRustLM*.nupkg' | sort)
if [[ "${#PACKAGES[@]}" -eq 0 ]]; then
  echo "No TinyRustLM packages were found in $PACKAGE_SOURCE" >&2
  exit 1
fi
mapfile -t SYMBOL_PACKAGES < <(find "$PACKAGE_SOURCE" -maxdepth 1 -type f -name 'TinyRustLM*.snupkg' | sort)

EXPECTED_NAMES=(
  "TinyRustLM.Abstractions.${PACKAGE_VERSION}.nupkg"
  "TinyRustLM.Core.${PACKAGE_VERSION}.nupkg"
  "TinyRustLM.P2P.${PACKAGE_VERSION}.nupkg"
  "TinyRustLM.Memory.${PACKAGE_VERSION}.nupkg"
)
EXPECTED_SYMBOL_NAMES=(
  "TinyRustLM.Abstractions.${PACKAGE_VERSION}.snupkg"
  "TinyRustLM.Core.${PACKAGE_VERSION}.snupkg"
  "TinyRustLM.P2P.${PACKAGE_VERSION}.snupkg"
  "TinyRustLM.Memory.${PACKAGE_VERSION}.snupkg"
)

contains_expected_package() {
  local candidate="$1"
  local expected
  for expected in "${EXPECTED_NAMES[@]}"; do
    if [[ "$expected" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

contains_expected_symbol_package() {
  local candidate="$1"
  local expected
  for expected in "${EXPECTED_SYMBOL_NAMES[@]}"; do
    if [[ "$expected" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

for expected_name in "${EXPECTED_NAMES[@]}"; do
  if ! printf '%s\n' "${PACKAGES[@]##*/}" | grep -Fxq "$expected_name"; then
    echo "Required package is missing from publish set: $expected_name" >&2
    exit 1
  fi
done
for expected_name in "${EXPECTED_SYMBOL_NAMES[@]}"; do
  if ! printf '%s\n' "${SYMBOL_PACKAGES[@]##*/}" | grep -Fxq "$expected_name"; then
    echo "Required symbol package is missing from publish set: $expected_name" >&2
    exit 1
  fi
done

UNEXPECTED_NAMES=()
for package in "${PACKAGES[@]}"; do
  package_name="${package##*/}"
  if ! contains_expected_package "$package_name"; then
    UNEXPECTED_NAMES+=("$package_name")
  fi
done
if [[ "${#UNEXPECTED_NAMES[@]}" -gt 0 ]]; then
  echo "Publish set contains unexpected package(s): ${UNEXPECTED_NAMES[*]}. Expected exactly: ${EXPECTED_NAMES[*]}" >&2
  exit 1
fi
UNEXPECTED_SYMBOL_NAMES=()
for package in "${SYMBOL_PACKAGES[@]}"; do
  package_name="${package##*/}"
  if ! contains_expected_symbol_package "$package_name"; then
    UNEXPECTED_SYMBOL_NAMES+=("$package_name")
  fi
done
if [[ "${#UNEXPECTED_SYMBOL_NAMES[@]}" -gt 0 ]]; then
  echo "Publish set contains unexpected symbol package(s): ${UNEXPECTED_SYMBOL_NAMES[*]}. Expected exactly: ${EXPECTED_SYMBOL_NAMES[*]}" >&2
  exit 1
fi

if ! audit_error="$(validate_package_audit_binding 2>&1)"; then
  if [[ -f "$AUDIT_REPORT" ]]; then
    write_publish_plan "blocked_audit_mismatch" "$DRY_RUN"
  else
    write_publish_plan "blocked_missing_audit_report" "$DRY_RUN"
  fi
  printf '%s\n' "$audit_error" >&2
  exit 1
fi
if ! hash_manifest_error="$(validate_package_hash_manifest_binding 2>&1)"; then
  manifest_path="$PACKAGE_SOURCE/SHA256SUMS-TinyRustLM-$PACKAGE_VERSION.txt"
  if [[ -f "$manifest_path" ]]; then
    write_publish_plan "blocked_hash_manifest_mismatch" "$DRY_RUN"
  else
    write_publish_plan "blocked_missing_hash_manifest" "$DRY_RUN"
  fi
  printf '%s\n' "$hash_manifest_error" >&2
  exit 1
fi

echo "TinyRustLM NuGet publish set:"
printf ' - %s\n' "${PACKAGES[@]##*/}"
echo "TinyRustLM NuGet symbol publish set:"
printf ' - %s\n' "${SYMBOL_PACKAGES[@]##*/}"
echo "NuGet source: $NUGET_SOURCE"
echo "Package version: $PACKAGE_VERSION"

if [[ "$DRY_RUN" == "1" ]]; then
  write_publish_plan "dry_run" "1"
  echo "Dry run requested; packages were not pushed."
  exit 0
fi
if [[ -z "${NUGET_API_KEY:-}" ]]; then
  write_publish_plan "blocked_missing_api_key" "0"
  echo "NUGET_API_KEY is required unless DRY_RUN=1 is used." >&2
  exit 1
fi

write_publish_plan "ready_to_push" "0"
pushd "$PACKAGE_SOURCE" >/dev/null
for package in "${PACKAGES[@]}"; do
  package_name="${package##*/}"
  if ! push_output="$(dotnet nuget push "$package_name" \
    --source "$NUGET_SOURCE" \
    --api-key "$NUGET_API_KEY" \
    --no-symbols \
    --skip-duplicate 2>&1)"; then
    push_output="${push_output//$NUGET_API_KEY/<redacted>}"
    TINYRUSTLM_PUBLISH_ERROR="$push_output" write_publish_plan "push_failed" "0"
    printf '%s\n' "$push_output" >&2
    popd >/dev/null
    exit 1
  fi
  printf '%s\n' "$push_output"
done
for package in "${SYMBOL_PACKAGES[@]}"; do
  package_name="${package##*/}"
  if ! push_output="$(dotnet nuget push "$package_name" \
    --source "$NUGET_SOURCE" \
    --api-key "$NUGET_API_KEY" \
    --skip-duplicate 2>&1)"; then
    push_output="${push_output//$NUGET_API_KEY/<redacted>}"
    TINYRUSTLM_PUBLISH_ERROR="$push_output" write_publish_plan "push_failed" "0"
    printf '%s\n' "$push_output" >&2
    popd >/dev/null
    exit 1
  fi
  printf '%s\n' "$push_output"
done
popd >/dev/null
write_publish_plan "pushed" "0"
