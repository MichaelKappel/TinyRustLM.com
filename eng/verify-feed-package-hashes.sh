#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NUGET_SOURCE="${1:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
PUBLISH_PLAN_REPORT="${2:-${TINYRUSTLM_PUBLISH_PLAN_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-publish-plan.json}}"
REPORT_OUTPUT="${3:-${TINYRUSTLM_FEED_HASH_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-feed-hashes.json}}"

python3 - "$NUGET_SOURCE" "$PUBLISH_PLAN_REPORT" "$REPORT_OUTPUT" <<'PY'
import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone

source, publish_plan_report, report_output = sys.argv[1:4]


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json_file(path):
    with open(path, "r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def read_json_url(url):
    request = urllib.request.Request(url, headers={"User-Agent": "TinyRustLM-NuGet-Hash/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def flat_container_base_url(index_url):
    index = read_json_url(index_url)
    for resource in index.get("resources", []):
        resource_type = resource.get("@type", "")
        resource_types = resource_type if isinstance(resource_type, list) else [resource_type]
        if any("PackageBaseAddress/3.0.0" in str(item) for item in resource_types):
            base = resource.get("@id", "")
            return base if base.endswith("/") else f"{base}/"
    raise RuntimeError(f"NuGet source does not expose PackageBaseAddress/3.0.0: {index_url}")


def remote_package_url(base_url, package_id, package_version):
    lower_id = package_id.lower()
    lower_version = package_version.lower()
    return f"{base_url}{lower_id}/{lower_version}/{lower_id}.{lower_version}.nupkg"


def resolve_local_publish_path(path):
    if not path:
        return ""
    if os.path.isfile(path):
        return path
    match = re.fullmatch(r"([A-Za-z]):[\\/](.*)", path)
    if match:
        drive = match.group(1).lower()
        rest = match.group(2).replace("\\", "/")
        candidate = f"/mnt/{drive}/{rest}"
        if os.path.isfile(candidate):
            return candidate
    return path


def download_file(url, path):
    request = urllib.request.Request(url, headers={"User-Agent": "TinyRustLM-NuGet-Hash/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response, open(path, "wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)


def zip_entry_hash_manifest(path):
    entries = {}
    with zipfile.ZipFile(path, "r") as archive:
        for info in sorted(archive.infolist(), key=lambda item: item.filename):
            if info.is_dir():
                continue
            data = archive.read(info.filename)
            entries[info.filename] = {
                "entry_name": info.filename,
                "byte_count": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
    return entries


def repository_signed_payload_verification(expected_package_path, actual_package_path):
    allowed_extra_entries = [".signature.p7s"]
    resolved_expected_package_path = resolve_local_publish_path(expected_package_path)
    if not resolved_expected_package_path or not os.path.isfile(resolved_expected_package_path):
        return {
            "mode": "unavailable",
            "match": False,
            "repository_signature_accepted": False,
            "expected_package_path": expected_package_path,
            "resolved_expected_package_path": resolved_expected_package_path,
            "allowed_extra_entries": allowed_extra_entries,
            "extra_allowed_entries": [],
            "missing_entry_count": 0,
            "unexpected_entry_count": 0,
            "changed_entry_count": 0,
            "missing_entries": [],
            "unexpected_entries": [],
            "changed_entries": [],
            "error_message": "Expected local package path from the publish plan is unavailable.",
        }

    try:
        expected_entries = zip_entry_hash_manifest(resolved_expected_package_path)
        actual_entries = zip_entry_hash_manifest(actual_package_path)
        missing_entries = []
        changed_entries = []
        for name, expected in sorted(expected_entries.items()):
            actual = actual_entries.get(name)
            if actual is None:
                missing_entries.append(name)
            elif (
                int(actual["byte_count"]) != int(expected["byte_count"])
                or actual["sha256"] != expected["sha256"]
            ):
                changed_entries.append(name)

        unexpected_entries = []
        extra_allowed_entries = []
        for name in sorted(actual_entries):
            if name in expected_entries:
                continue
            if name in allowed_extra_entries:
                extra_allowed_entries.append(name)
            else:
                unexpected_entries.append(name)

        matches = (
            not missing_entries
            and not changed_entries
            and not unexpected_entries
            and bool(extra_allowed_entries)
        )
        return {
            "mode": "zip_payload_allow_repository_signature",
            "match": matches,
            "repository_signature_accepted": matches,
            "expected_package_path": expected_package_path,
            "resolved_expected_package_path": resolved_expected_package_path,
            "allowed_extra_entries": allowed_extra_entries,
            "extra_allowed_entries": extra_allowed_entries,
            "missing_entry_count": len(missing_entries),
            "unexpected_entry_count": len(unexpected_entries),
            "changed_entry_count": len(changed_entries),
            "missing_entries": missing_entries,
            "unexpected_entries": unexpected_entries,
            "changed_entries": changed_entries,
            "error_message": "",
        }
    except Exception as exc:
        return {
            "mode": "zip_payload_allow_repository_signature",
            "match": False,
            "repository_signature_accepted": False,
            "expected_package_path": expected_package_path,
            "resolved_expected_package_path": resolved_expected_package_path,
            "allowed_extra_entries": allowed_extra_entries,
            "extra_allowed_entries": [],
            "missing_entry_count": 0,
            "unexpected_entry_count": 0,
            "changed_entry_count": 0,
            "missing_entries": [],
            "unexpected_entries": [],
            "changed_entries": [],
            "error_message": str(exc),
        }


if not os.path.isfile(publish_plan_report):
    raise SystemExit(f"Publish plan report does not exist: {publish_plan_report}")

publish_plan_report = os.path.abspath(publish_plan_report)
publish_plan = read_json_file(publish_plan_report)
if publish_plan.get("schema") != "tinyrustlm.nuget.publish_plan.v0":
    raise SystemExit(f"Publish plan report schema mismatch: {publish_plan.get('schema', '')}")
if not publish_plan.get("package_audit_match"):
    raise SystemExit(f"Publish plan report is not bound to a passing package audit: {publish_plan_report}")
if not publish_plan.get("package_hash_manifest_match"):
    raise SystemExit(f"Publish plan report is not bound to a passing package SHA-256 manifest: {publish_plan_report}")
if re.fullmatch(r"[0-9a-f]{64}", str(publish_plan.get("package_hash_manifest_sha256", ""))) is None:
    raise SystemExit(f"Publish plan report is missing a valid package SHA-256 manifest hash: {publish_plan_report}")
expected_package_ids = ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"]
publish_package_ids = sorted(str(item.get("package_id", "")) for item in publish_plan.get("packages", []))
publish_symbol_package_ids = sorted(str(item.get("package_id", "")) for item in publish_plan.get("symbol_packages", []))
if publish_package_ids != sorted(expected_package_ids):
    raise SystemExit("Publish plan package IDs are not the exact current public package set.")
if publish_symbol_package_ids != sorted(expected_package_ids):
    raise SystemExit("Publish plan symbol package IDs are not the exact current public package set.")

source_kind = "folder" if os.path.isdir(source) else "nuget-v3"
resolved_source = os.path.abspath(source) if source_kind == "folder" else source
base_url = "" if source_kind == "folder" else flat_container_base_url(source)
package_version = str(publish_plan.get("package_version", ""))
symbol_package_verification_mode = (
    "folder"
    if source_kind == "folder"
    else "nuget_v3_package_feed_does_not_expose_snupkg_symbols"
)

package_reports = []
symbol_package_reports = []
with tempfile.TemporaryDirectory(prefix="tinyrustlm-feed-hashes-") as temp_root:
    for package in publish_plan.get("packages", []):
        name = str(package.get("name", ""))
        package_id = str(package.get("package_id", ""))
        expected_sha256 = str(package.get("sha256", "")).lower()
        expected_byte_count = int(package.get("byte_count", -1))
        feed_location = ""
        source_path = ""
        present = False
        actual_sha256 = ""
        actual_byte_count = 0
        error_message = ""
        payload_verification = {
            "mode": "exact_package_bytes",
            "match": False,
            "repository_signature_accepted": False,
            "expected_package_path": "",
            "allowed_extra_entries": [],
            "extra_allowed_entries": [],
            "missing_entry_count": 0,
            "unexpected_entry_count": 0,
            "changed_entry_count": 0,
            "missing_entries": [],
            "unexpected_entries": [],
            "changed_entries": [],
            "error_message": "",
        }
        try:
            if source_kind == "folder":
                source_path = os.path.join(resolved_source, name)
                feed_location = source_path
                if not os.path.isfile(source_path):
                    raise FileNotFoundError(f"Package file does not exist in feed folder: {source_path}")
            else:
                feed_location = remote_package_url(base_url, package_id, package_version)
                source_path = os.path.join(temp_root, name)
                download_file(feed_location, source_path)

            present = True
            actual_sha256 = sha256_file(source_path)
            actual_byte_count = os.path.getsize(source_path)
            exact_match = actual_sha256 == expected_sha256 and actual_byte_count == expected_byte_count
            if exact_match:
                payload_verification["match"] = True
            elif source_kind == "nuget-v3":
                payload_verification = repository_signed_payload_verification(
                    str(package.get("path", "")),
                    source_path,
                )
        except Exception as exc:
            error_message = str(exc)

        sha256_match = present and actual_sha256 == expected_sha256
        byte_count_match = present and actual_byte_count == expected_byte_count
        package_reports.append({
            "package_id": package_id,
            "name": name,
            "feed_location": feed_location or source_path,
            "present": present,
            "expected_sha256": expected_sha256,
            "actual_sha256": actual_sha256,
            "sha256_match": sha256_match,
            "expected_byte_count": expected_byte_count,
            "actual_byte_count": actual_byte_count,
            "byte_count_match": byte_count_match,
            "package_integrity_match": present and ((sha256_match and byte_count_match) or bool(payload_verification.get("match"))),
            "repository_signature_accepted": bool(payload_verification.get("repository_signature_accepted")),
            "payload_verification": payload_verification,
            "error_message": error_message,
        })

    if source_kind == "folder":
        for symbol_package in publish_plan.get("symbol_packages", []):
            name = str(symbol_package.get("name", ""))
            package_id = str(symbol_package.get("package_id", ""))
            expected_sha256 = str(symbol_package.get("sha256", "")).lower()
            expected_byte_count = int(symbol_package.get("byte_count", -1))
            source_path = os.path.join(resolved_source, name)
            present = False
            actual_sha256 = ""
            actual_byte_count = 0
            error_message = ""
            try:
                if not os.path.isfile(source_path):
                    raise FileNotFoundError(f"Symbol package file does not exist in feed folder: {source_path}")

                present = True
                actual_sha256 = sha256_file(source_path)
                actual_byte_count = os.path.getsize(source_path)
            except Exception as exc:
                error_message = str(exc)

            symbol_package_reports.append({
                "package_id": package_id,
                "name": name,
                "feed_location": source_path,
                "present": present,
                "expected_sha256": expected_sha256,
                "actual_sha256": actual_sha256,
                "sha256_match": present and actual_sha256 == expected_sha256,
                "expected_byte_count": expected_byte_count,
                "actual_byte_count": actual_byte_count,
                "byte_count_match": present and actual_byte_count == expected_byte_count,
                "error_message": error_message,
            })

missing_packages = [package for package in package_reports if not package["present"]]
hash_mismatches = [package for package in package_reports if package["present"] and not package["sha256_match"]]
byte_count_mismatches = [package for package in package_reports if package["present"] and not package["byte_count_match"]]
integrity_mismatches = [package for package in package_reports if not package["package_integrity_match"]]
repository_signature_accepted = [
    package for package in package_reports
    if package.get("repository_signature_accepted")
]
missing_symbol_packages = [package for package in symbol_package_reports if not package["present"]]
symbol_hash_mismatches = [
    package for package in symbol_package_reports
    if package["present"] and not package["sha256_match"]
]
symbol_byte_count_mismatches = [
    package for package in symbol_package_reports
    if package["present"] and not package["byte_count_match"]
]
status = (
    "pass"
    if (
        not missing_packages
        and not integrity_mismatches
        and not missing_symbol_packages
        and not symbol_hash_mismatches
        and not symbol_byte_count_mismatches
    )
    else "fail"
)
report = {
    "schema": "tinyrustlm.nuget.feed_hashes.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "source": resolved_source,
    "source_kind": source_kind,
    "package_version": package_version,
    "publish_plan_schema": str(publish_plan.get("schema", "")),
    "publish_plan_report_path": publish_plan_report,
    "publish_plan_report_sha256": sha256_file(publish_plan_report),
    "package_audit_report_sha256": str(publish_plan.get("package_audit_report_sha256", "")),
    "package_hash_manifest_sha256": str(publish_plan.get("package_hash_manifest_sha256", "")),
    "package_hash_manifest_match": bool(publish_plan.get("package_hash_manifest_match", False)),
    "secret_material_included": False,
    "package_count": len(package_reports),
    "missing_package_count": len(missing_packages),
    "hash_mismatch_count": len(hash_mismatches),
    "byte_count_mismatch_count": len(byte_count_mismatches),
    "package_integrity_mismatch_count": len(integrity_mismatches),
    "repository_signature_accepted_count": len(repository_signature_accepted),
    "packages": package_reports,
    "symbol_package_verification_mode": symbol_package_verification_mode,
    "symbol_package_expected_count": len(publish_plan.get("symbol_packages", [])),
    "symbol_package_count": len(symbol_package_reports),
    "missing_symbol_package_count": len(missing_symbol_packages),
    "symbol_hash_mismatch_count": len(symbol_hash_mismatches),
    "symbol_byte_count_mismatch_count": len(symbol_byte_count_mismatches),
    "symbol_packages": symbol_package_reports,
}

os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(f"TinyRustLM NuGet feed-hashes report written to {report_output}")
if status != "pass":
    raise SystemExit(f"TinyRustLM NuGet feed hash verification failed. See {report_output}")
print(f"TinyRustLM NuGet feed package hashes match publish plan: {resolved_source}")
PY
