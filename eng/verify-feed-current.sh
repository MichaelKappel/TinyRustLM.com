#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NUGET_SOURCE="${1:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
PACKAGE_VERSION="${2:-$("$REPO_ROOT/eng/get-package-version.sh")}"
REPORT_OUTPUT="${3:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-feed-current.json}"
ALLOW_NEWER="${ALLOW_NEWER:-0}"

python3 - "$NUGET_SOURCE" "$PACKAGE_VERSION" "$REPORT_OUTPUT" "$ALLOW_NEWER" <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

source, package_version, report_output, allow_newer_raw = sys.argv[1:5]
allow_newer = allow_newer_raw == "1"
package_ids = ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"]


def semver_key(version):
    without_build = version.split("+", 1)[0]
    core, sep, prerelease = without_build.partition("-")
    numbers = []
    for part in core.split(".")[:3]:
        try:
            numbers.append(int(part))
        except ValueError:
            numbers.append(0)
    while len(numbers) < 3:
        numbers.append(0)
    prerelease_key = []
    if prerelease:
        for part in prerelease.split("."):
            if part.isdigit():
                prerelease_key.append((0, int(part)))
            else:
                prerelease_key.append((1, part.lower()))
    return (*numbers, 0 if prerelease else 1, prerelease_key)


def latest_version(versions):
    return sorted(versions, key=semver_key)[-1] if versions else ""


def read_json_url(url):
    request = urllib.request.Request(url, headers={"User-Agent": "TinyRustLM-NuGet-Freshness/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def local_versions(directory, package_id):
    prefix = f"{package_id}."
    suffix = ".nupkg"
    versions = []
    for name in os.listdir(directory):
        if name.lower().startswith(prefix.lower()) and name.lower().endswith(suffix):
            versions.append(name[len(prefix):-len(suffix)])
    return sorted(set(versions), key=semver_key)


def flat_container_base_url(index_url):
    index = read_json_url(index_url)
    for resource in index.get("resources", []):
        resource_type = resource.get("@type", "")
        resource_types = resource_type if isinstance(resource_type, list) else [resource_type]
        if any("PackageBaseAddress/3.0.0" in str(item) for item in resource_types):
            base = resource.get("@id", "")
            return base if base.endswith("/") else f"{base}/"
    raise RuntimeError(f"NuGet source does not expose PackageBaseAddress/3.0.0: {index_url}")


def remote_versions(base_url, package_id):
    url = f"{base_url}{package_id.lower()}/index.json"
    try:
        index = read_json_url(url)
    except urllib.error.HTTPError as error:
        # Only an actual package-index 404 establishes absence; an outage is unknown.
        if error.code == 404:
            return []
        raise RuntimeError(f"NuGet package version lookup failed for {package_id}.") from None
    except Exception:
        raise RuntimeError(f"NuGet package version lookup failed for {package_id}.") from None
    # Keep malformed successful responses out of publication-readiness decisions.
    versions = index.get("versions") if isinstance(index, dict) else None
    if not isinstance(versions, list) or not versions or any(not isinstance(v, str) or not v.strip() for v in versions):
        raise RuntimeError(f"NuGet package version index is invalid for {package_id}.")
    return versions


source_kind = "folder" if os.path.isdir(source) else "nuget-v3"
resolved_source = os.path.abspath(source) if source_kind == "folder" else source
base_url = "" if source_kind == "folder" else flat_container_base_url(source)

package_reports = []
for package_id in package_ids:
    versions = local_versions(resolved_source, package_id) if source_kind == "folder" else remote_versions(base_url, package_id)
    latest = latest_version(versions)
    declared_present = any(version.lower() == package_version.lower() for version in versions)
    declared_latest = bool(latest) and latest.lower() == package_version.lower()
    package_reports.append({
        "package_id": package_id,
        "declared_version": package_version,
        "declared_version_present": declared_present,
        "latest_reported_version": latest,
        "declared_version_is_latest_reported": declared_latest,
        "version_count": len(versions),
        "listed_versions": versions,
    })

missing_declared = [package for package in package_reports if not package["declared_version_present"]]
not_latest = [package for package in package_reports if not package["declared_version_is_latest_reported"]]
status = "pass" if not missing_declared and (allow_newer or not not_latest) else "fail"
report = {
    "schema": "tinyrustlm.nuget.feed_current.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "source": resolved_source,
    "source_kind": source_kind,
    "package_version": package_version,
    "package_ids": package_ids,
    "allow_newer": allow_newer,
    "status": status,
    "package_count": len(package_reports),
    "missing_declared_version_count": len(missing_declared),
    "not_latest_count": 0 if allow_newer else len(not_latest),
    "packages": package_reports,
}

os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(f"TinyRustLM NuGet feed-current report written to {report_output}")
if status != "pass":
    raise SystemExit(f"TinyRustLM NuGet feed-current verification failed. See {report_output}")
print(f"TinyRustLM NuGet feed is current: {resolved_source} @ {package_version}")
PY
