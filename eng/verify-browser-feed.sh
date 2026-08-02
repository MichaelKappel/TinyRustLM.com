#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-${UAIX_BROWSER_NUGET_FEED:-$REPO_ROOT/artifacts/browser-feed}}"
PACKAGE_VERSION_DEFAULT="$("$REPO_ROOT/eng/get-package-version.sh")"
if [[ "${2:-}" == *.json && -z "${3:-}" ]]; then
  PACKAGE_VERSION="$PACKAGE_VERSION_DEFAULT"
  REPORT_OUTPUT="$2"
else
  PACKAGE_VERSION="${2:-$PACKAGE_VERSION_DEFAULT}"
  REPORT_OUTPUT="${3:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-feed-audit.json}"
fi

python3 - "$PACKAGE_SOURCE" "$PACKAGE_VERSION" "$REPORT_OUTPUT" <<'PY'
import hashlib
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

package_source = Path(sys.argv[1])
package_version = sys.argv[2]
report_output = Path(sys.argv[3])

if not package_source.is_dir():
    raise SystemExit(f"Browser package source does not exist: {package_source}")


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_name(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def find_first(root, name):
    for node in root.iter():
        if local_name(node.tag) == name:
            return node
    return None


def xml_text(root, name):
    node = find_first(root, name)
    return (node.text or "").strip() if node is not None else ""


def parse_nuspec(text):
    if not text:
        return None
    try:
        return ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return None


def nuspec_metadata(text):
    root = parse_nuspec(text)
    if root is None:
        return {}
    repository = find_first(root, "repository")
    license_node = find_first(root, "license")
    return {
        "id": xml_text(root, "id"),
        "version": xml_text(root, "version"),
        "title": xml_text(root, "title"),
        "description": xml_text(root, "description"),
        "authors": xml_text(root, "authors"),
        "project_url": xml_text(root, "projectUrl"),
        "repository_url": repository.attrib.get("url", "") if repository is not None else "",
        "repository_type": repository.attrib.get("type", "") if repository is not None else "",
        "license": (license_node.text or "").strip() if license_node is not None else "",
        "license_type": license_node.attrib.get("type", "") if license_node is not None else "",
        "readme": xml_text(root, "readme"),
        "tags": xml_text(root, "tags"),
        "release_notes": xml_text(root, "releaseNotes"),
        "require_license_acceptance": xml_text(root, "requireLicenseAcceptance"),
    }


def nuspec_dependencies(text):
    root = parse_nuspec(text)
    if root is None:
        return []
    dependencies = []
    for node in root.iter():
        if local_name(node.tag) == "dependency":
            dependencies.append({
                "id": node.attrib.get("id", ""),
                "version": node.attrib.get("version", ""),
                "exclude": node.attrib.get("exclude", ""),
            })
    return dependencies


def has_symbols_package_type(text):
    root = parse_nuspec(text)
    if root is None:
        return False
    for node in root.iter():
        if local_name(node.tag) == "packageType" and node.attrib.get("name", "") == "SymbolsPackage":
            return True
    return False


def symbol_package_entry_allowed(entry_name):
    if entry_name in ("[Content_Types].xml", "_rels/.rels"):
        return True
    if re.fullmatch(r"[^/]+\.nuspec", entry_name):
        return True
    if re.fullmatch(r"package/services/metadata/core-properties/[^/]+\.psmdcp", entry_name):
        return True
    if re.fullmatch(r"lib/[^/]+/TinyRustLM\.[^/]+\.pdb", entry_name):
        return True
    return False


def unexpected_symbol_package_entries(entry_names):
    return [name for name in entry_names if not symbol_package_entry_allowed(name)]


def expected_packages(version):
    return [
        {
            "id": "UAIX.Browser.Core.Abstractions",
            "name": f"UAIX.Browser.Core.Abstractions.{version}.nupkg",
            "dependencies": [],
            "terms": ["TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pRuntime", "p2pRuntime.com", "p2pLLM", "p2pLLM.com", "MiniModel", ".slm", ".uai", "memory", "persona"],
        },
        {
            "id": "UAIX.Browser.p2pLLM.Runtime",
            "name": f"UAIX.Browser.p2pLLM.Runtime.{version}.nupkg",
            "dependencies": ["UAIX.Browser.Core.Abstractions"],
            "terms": ["TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pLLM", "p2pLLM.com", ".slm", "runtime", "harness", "diagnostics"],
        },
        {
            "id": "UAIX.Browser.p2pRuntime.P2P",
            "name": f"UAIX.Browser.p2pRuntime.P2P.{version}.nupkg",
            "dependencies": ["UAIX.Browser.Core.Abstractions", "UAIX.Browser.p2pLLM.Runtime"],
            "terms": ["TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pRuntime", "p2pRuntime.com", "P2P", "MiniModel", "manifest", "announcement", "catalog", "receipt", ".slm"],
        },
        {
            "id": "UAIX.Browser.Memory",
            "name": f"UAIX.Browser.Memory.{version}.nupkg",
            "dependencies": ["UAIX.Browser.Core.Abstractions", "UAIX.Browser.p2pLLM.Runtime"],
            "terms": ["TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "memory", "ai-memory", ".uai", ".uaix", "persona", "AI Memory Package Wizard", "ai-digest", "point-agent-urls", "canonical-starter-zip", "safe-structured-output", "agent-pickup", "session-log", "manifest-overlay", "package-model", "knowledge-graph", "personality-pack", "persona-deck", "triggered-style-axes"],
        },
        {
            "id": "UAIX.Browser.p2pLLM.Conversion",
            "name": f"UAIX.Browser.p2pLLM.Conversion.{version}.nupkg",
            "dependencies": ["UAIX.Browser.p2pLLM.Runtime"],
            "terms": ["TinyRustLM", "UAIX", "UAIX.org", "UAIX.Browser", "p2pLLM", "p2pLLM.com", ".slm", "conversion", "local-feed"],
        },
    ]


def missing_metadata_fields(metadata):
    required = (
        "id",
        "version",
        "title",
        "description",
        "authors",
        "project_url",
        "repository_url",
        "repository_type",
        "license",
        "license_type",
        "readme",
        "tags",
        "release_notes",
    )
    missing = [field for field in required if not str(metadata.get(field, "")).strip()]
    if metadata.get("require_license_acceptance") != "true":
        missing.append("require_license_acceptance")
    if metadata.get("license_type") != "file":
        missing.append("license_type:file")
    if metadata.get("readme") != "README.md":
        missing.append("readme:README.md")
    return missing


def normalize_metadata_url(value):
    normalized = str(value or "").strip()
    if not normalized:
        return ""
    if not normalized.endswith("/"):
        normalized += "/"
    return normalized.lower()


def metadata_policy_violations(package_id, metadata):
    violations = []
    if normalize_metadata_url(metadata.get("project_url", "")) != "https://tinyrustlm.com/":
        violations.append("project_url:https://tinyrustlm.com/")
    if metadata.get("repository_type") != "git":
        violations.append("repository_type:git")
    if metadata.get("license_type") != "file" or metadata.get("license") != "LICENSE.txt":
        violations.append("license_file:LICENSE.txt")
    if metadata.get("readme") != "README.md":
        violations.append("readme:README.md")
    if metadata.get("require_license_acceptance") != "true":
        violations.append("require_license_acceptance:true")
    if "tinyrustlm" not in str(metadata.get("authors", "")).lower():
        violations.append("authors:TinyRustLM")
    title = str(metadata.get("title", "")).lower()
    if "tinyrustlm" not in title or "uaix browser" not in title:
        violations.append("title:TinyRustLM-UAIX-Browser")
    if len(str(metadata.get("description", ""))) < 120:
        violations.append("description:min-120")
    if package_id.lower() not in str(metadata.get("tags", "")).lower():
        violations.append("tags:package-id")
    return violations


def missing_search_terms(terms, metadata):
    haystack = " ".join((
        str(metadata.get("id", "")),
        str(metadata.get("title", "")),
        str(metadata.get("description", "")),
        str(metadata.get("tags", "")),
        str(metadata.get("release_notes", "")),
        str(metadata.get("project_url", "")),
        str(metadata.get("repository_url", "")),
    )).lower()
    return [term for term in terms if term.lower() not in haystack]


def dependency_mismatches(expected_ids, dependencies, version):
    mismatches = []
    for expected_id in expected_ids:
        matches = [
            dependency for dependency in dependencies
            if dependency.get("id") == expected_id
            and dependency.get("version") == version
            and dependency.get("exclude") == "Build,Analyzers"
        ]
        if len(matches) != 1:
            mismatches.append(f"missing:{expected_id}@{version} exclude=Build,Analyzers")
    for dependency in dependencies:
        if dependency.get("id") not in expected_ids:
            mismatches.append(f"unexpected:{dependency.get('id')}@{dependency.get('version')}")
    return mismatches


absolute_path_pattern = re.compile(r"\b[A-Z]:\\(?:Users|Source|repos|work|workspace|agent|actions-runner|a)\\", re.IGNORECASE)
text_entry_pattern = re.compile(r"\.(nuspec|md|txt|json|xml)$", re.IGNORECASE)


def absolute_path_matches(archive, infos):
    matches = []
    for info in infos:
        if info.file_size > 1024 * 1024 or not text_entry_pattern.search(info.filename):
            continue
        text = archive.read(info).decode("utf-8", errors="ignore")
        if absolute_path_pattern.search(text):
            matches.append(info.filename)
    return matches


expected = expected_packages(package_version)
expected_names = [package["name"] for package in expected]
expected_symbol_names = [name[:-len(".nupkg")] + ".snupkg" for name in expected_names]
actual_names = sorted(path.name for path in package_source.glob("UAIX.Browser*.nupkg"))
actual_symbol_names = sorted(path.name for path in package_source.glob("UAIX.Browser*.snupkg"))
missing_packages = [name for name in expected_names if name not in actual_names]
unexpected_packages = [name for name in actual_names if name not in expected_names]
missing_symbol_packages = [name for name in expected_symbol_names if name not in actual_symbol_names]
unexpected_symbol_packages = [name for name in actual_symbol_names if name not in expected_symbol_names]

hash_manifest_name = f"SHA256SUMS-UAIX.Browser-{package_version}.txt"
hash_manifest_path = package_source / hash_manifest_name
hash_manifest_missing = not hash_manifest_path.is_file()
hash_manifest_lines = hash_manifest_path.read_text(encoding="ascii", errors="ignore").splitlines() if not hash_manifest_missing else []
feed_readme_name = f"README-UAIX.Browser-{package_version}.txt"
feed_readme_path = package_source / feed_readme_name
feed_readme_missing = not feed_readme_path.is_file()
feed_readme_text = feed_readme_path.read_text(encoding="utf-8", errors="ignore") if not feed_readme_missing else ""
feed_readme_required_terms = (
    expected_names
    + expected_symbol_names
    + [
        "NuGet Package Manager",
        "debug-symbol sidecar",
        hash_manifest_name,
        "SymbolsPackage/PDB evidence",
        "publish-plan hashes",
        "feed-hash reports",
    ]
)
feed_readme_missing_terms = [
    term for term in feed_readme_required_terms
    if term.lower() not in feed_readme_text.lower()
]

package_reports = []
for package in expected:
    path = package_source / package["name"]
    present = path.is_file()
    metadata = {}
    dependencies = []
    entry_names = []
    identity_mismatches = []
    missing_metadata = []
    policy_violations = []
    missing_terms = []
    dependency_errors = []
    path_matches = []
    sha256 = ""
    byte_count = 0
    hash_manifest_match = False

    if present:
        sha256 = sha256_file(path)
        byte_count = path.stat().st_size
        hash_manifest_match = f"{sha256}  {package['name']}" in hash_manifest_lines
        with zipfile.ZipFile(path, "r") as archive:
            infos = sorted(archive.infolist(), key=lambda item: item.filename)
            entry_names = [info.filename for info in infos]
            nuspec_info = next((info for info in infos if info.filename.lower().endswith(".nuspec")), None)
            nuspec_text = archive.read(nuspec_info).decode("utf-8", errors="ignore") if nuspec_info is not None else ""
            metadata = nuspec_metadata(nuspec_text)
            dependencies = nuspec_dependencies(nuspec_text)
            if metadata.get("id") != package["id"]:
                identity_mismatches.append(f"id:{metadata.get('id')}")
            if metadata.get("version") != package_version:
                identity_mismatches.append(f"version:{metadata.get('version')}")
            missing_metadata = missing_metadata_fields(metadata)
            policy_violations = metadata_policy_violations(package["id"], metadata)
            missing_terms = missing_search_terms(package["terms"], metadata)
            dependency_errors = dependency_mismatches(package["dependencies"], dependencies, package_version)
            path_matches = absolute_path_matches(archive, infos)

    package_reports.append({
        "name": package["name"],
        "package_id": package["id"],
        "present": present,
        "path": str(path),
        "sha256": sha256,
        "byte_count": byte_count,
        "hash_manifest_match": hash_manifest_match,
        "metadata": metadata,
        "dependencies": dependencies,
        "required_search_terms": package["terms"],
        "missing_search_terms": missing_terms,
        "identity_mismatches": identity_mismatches,
        "missing_metadata_fields": missing_metadata,
        "metadata_policy_violations": policy_violations,
        "dependency_mismatches": dependency_errors,
        "absolute_path_matches": path_matches,
        "package_entry_names": entry_names,
    })

symbol_package_reports = []
for package in expected:
    symbol_name = package["name"][:-len(".nupkg")] + ".snupkg"
    path = package_source / symbol_name
    present = path.is_file()
    entry_names = []
    pdb_entries = []
    identity_mismatches = []
    unexpected_symbol_entries = []
    symbols_type = False
    sha256 = ""
    byte_count = 0
    hash_manifest_match = False

    if present:
        sha256 = sha256_file(path)
        byte_count = path.stat().st_size
        hash_manifest_match = f"{sha256}  {symbol_name}" in hash_manifest_lines
        with zipfile.ZipFile(path, "r") as archive:
            infos = sorted(archive.infolist(), key=lambda item: item.filename)
            entry_names = [info.filename for info in infos]
            pdb_entries = [
                name for name in entry_names
                if re.fullmatch(r"lib/[^/]+/TinyRustLM\.[^/]+\.pdb", name)
            ]
            unexpected_symbol_entries = unexpected_symbol_package_entries(entry_names)
            nuspec_info = next((info for info in infos if info.filename.lower().endswith(".nuspec")), None)
            nuspec_text = archive.read(nuspec_info).decode("utf-8", errors="ignore") if nuspec_info is not None else ""
            metadata = nuspec_metadata(nuspec_text)
            symbols_type = has_symbols_package_type(nuspec_text)
            if metadata.get("id") != package["id"]:
                identity_mismatches.append(f"id:{metadata.get('id')}")
            if metadata.get("version") != package_version:
                identity_mismatches.append(f"version:{metadata.get('version')}")
            if not symbols_type:
                identity_mismatches.append("packageType:SymbolsPackage")
            if not pdb_entries:
                identity_mismatches.append("pdb:missing")

    symbol_package_reports.append({
        "name": symbol_name,
        "package_id": package["id"],
        "present": present,
        "path": str(path),
        "sha256": sha256,
        "byte_count": byte_count,
        "hash_manifest_match": hash_manifest_match,
        "has_symbols_package_type": symbols_type,
        "pdb_entries": pdb_entries,
        "identity_mismatches": identity_mismatches,
        "unexpected_symbol_package_entries": unexpected_symbol_entries,
        "package_entry_names": entry_names,
    })

all_identity_mismatches = [item for package in package_reports for item in package["identity_mismatches"]]
all_missing_metadata = [item for package in package_reports for item in package["missing_metadata_fields"]]
all_metadata_policy_violations = [item for package in package_reports for item in package["metadata_policy_violations"]]
all_missing_search_terms = [item for package in package_reports for item in package["missing_search_terms"]]
all_dependency_mismatches = [item for package in package_reports for item in package["dependency_mismatches"]]
all_absolute_path_matches = [item for package in package_reports for item in package["absolute_path_matches"]]
hash_mismatches = [package for package in package_reports if package["present"] and not package["hash_manifest_match"]]
symbol_hash_mismatches = [package for package in symbol_package_reports if package["present"] and not package["hash_manifest_match"]]
all_symbol_identity_mismatches = [
    item for package in symbol_package_reports
    for item in package["identity_mismatches"]
]
all_unexpected_symbol_package_entries = [
    item for package in symbol_package_reports
    for item in package["unexpected_symbol_package_entries"]
]

status = "pass" if not any((
    missing_packages,
    unexpected_packages,
    missing_symbol_packages,
    unexpected_symbol_packages,
    hash_manifest_missing,
    hash_mismatches,
    symbol_hash_mismatches,
    all_identity_mismatches,
    all_symbol_identity_mismatches,
    all_unexpected_symbol_package_entries,
    all_missing_metadata,
    all_metadata_policy_violations,
    all_missing_search_terms,
    all_dependency_mismatches,
    all_absolute_path_matches,
    feed_readme_missing,
    feed_readme_missing_terms,
)) else "fail"

report = {
    "schema": "uaix.browser.nuget.feed_audit.v0",
    "generated_utc": utc_now(),
    "package_source": str(package_source.resolve()),
    "package_version": package_version,
    "status": status,
    "expected_package_names": expected_names,
    "expected_symbol_package_names": expected_symbol_names,
    "actual_package_names": actual_names,
    "actual_symbol_package_names": actual_symbol_names,
    "missing_package_entries": missing_packages,
    "unexpected_package_entries": unexpected_packages,
    "missing_symbol_package_entries": missing_symbol_packages,
    "unexpected_symbol_package_entries": unexpected_symbol_packages,
    "hash_manifest_name": hash_manifest_name,
    "hash_manifest_missing": hash_manifest_missing,
    "feed_readme_name": feed_readme_name,
    "feed_readme_missing": feed_readme_missing,
    "feed_readme_missing_terms": feed_readme_missing_terms,
    "feed_readme_missing_term_count": len(feed_readme_missing_terms),
    "hash_mismatch_count": len(hash_mismatches),
    "symbol_hash_mismatch_count": len(symbol_hash_mismatches),
    "identity_mismatch_count": len(all_identity_mismatches),
    "symbol_identity_mismatch_count": len(all_symbol_identity_mismatches),
    "unexpected_symbol_package_entry_count": len(all_unexpected_symbol_package_entries),
    "missing_metadata_count": len(all_missing_metadata),
    "metadata_policy_violation_count": len(all_metadata_policy_violations),
    "missing_search_term_count": len(all_missing_search_terms),
    "dependency_mismatch_count": len(all_dependency_mismatches),
    "absolute_path_match_count": len(all_absolute_path_matches),
    "package_count": len(package_reports),
    "symbol_package_count": len(symbol_package_reports),
    "packages": package_reports,
    "symbol_packages": symbol_package_reports,
}

report_output.parent.mkdir(parents=True, exist_ok=True)
with report_output.open("w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(f"UAIX Browser NuGet feed audit written to {report_output}")
if status != "pass":
    raise SystemExit(f"UAIX Browser NuGet feed audit failed. See {report_output}")
print(f"UAIX Browser NuGet feed audit passed: {package_source.resolve()} @ {package_version}")
PY
