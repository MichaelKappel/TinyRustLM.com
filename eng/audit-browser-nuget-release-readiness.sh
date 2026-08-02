#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-${UAIX_BROWSER_PACKAGE_SOURCE:-$REPO_ROOT/artifacts/browser-packages}}"
NUGET_SOURCE="${2:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
REPORT_OUTPUT="${3:-${UAIX_BROWSER_RELEASE_READINESS_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-release-readiness.json}}"
PACKAGE_VERSION="${PACKAGE_VERSION:-$("$REPO_ROOT/eng/get-package-version.sh")}"
AUDIT_REPORT="${AUDIT_REPORT:-${UAIX_BROWSER_FEED_AUDIT_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-feed-audit.json}}"
PUBLISH_PLAN_REPORT="${UAIX_BROWSER_PUBLISH_PLAN_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-release-readiness-publish-plan-dry-run.json}"
LOCAL_FEED_CURRENT_REPORT="${UAIX_BROWSER_LOCAL_FEED_CURRENT_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-local-feed-current.json}"
LOCAL_FEED_HASH_REPORT="${UAIX_BROWSER_LOCAL_FEED_HASH_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-local-feed-hashes.json}"
REMOTE_FEED_CURRENT_REPORT="${UAIX_BROWSER_REMOTE_FEED_CURRENT_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-release-feed-current.json}"
REMOTE_FEED_HASH_REPORT="${UAIX_BROWSER_REMOTE_FEED_HASH_REPORT:-$REPO_ROOT/artifacts/reports/uaix-browser-nuget-release-feed-hashes.json}"
FAIL_ON_BLOCKED="${FAIL_ON_BLOCKED:-0}"
AUTH_MODE="${AUTH_MODE:-${UAIX_BROWSER_NUGET_AUTH_MODE:-${TINYRUSTLM_NUGET_AUTH_MODE:-${NUGET_AUTH_MODE:-api_key}}}}"
UAIX_BROWSER_PACKAGE_IDS="UAIX.Browser.Core.Abstractions,UAIX.Browser.p2pLLM.Runtime,UAIX.Browser.p2pRuntime.P2P,UAIX.Browser.Memory,UAIX.Browser.p2pLLM.Conversion"

case "$AUTH_MODE" in
  api_key|trusted_publishing)
    ;;
  *)
    echo "AUTH_MODE must be 'api_key' or 'trusted_publishing'." >&2
    exit 1
    ;;
esac

run_step() {
  local status_var="$1"
  local error_var="$2"
  local report_path="$3"
  shift 3
  local output
  rm -f -- "$report_path"
  if output="$("$@" 2>&1)"; then
    printf -v "$status_var" '%s' "pass"
    printf -v "$error_var" '%s' ""
  else
    printf -v "$status_var" '%s' "fail"
    printf -v "$error_var" '%s' "$output"
  fi
  if [[ -n "$output" ]]; then
    printf '%s\n' "$output"
  fi
}

read_report_status() {
  local report_path="$1"
  python3 - "$report_path" <<'PY'
import json
import os
import sys

path = sys.argv[1]
if not os.path.isfile(path):
    print("")
    raise SystemExit(0)
try:
    with open(path, "r", encoding="utf-8-sig") as handle:
        print(str(json.load(handle).get("status", "")))
except Exception:
    print("invalid")
PY
}

run_step PUBLISH_PLAN_STATUS PUBLISH_PLAN_ERROR "$PUBLISH_PLAN_REPORT" \
  env DRY_RUN=1 SKIP_VERIFICATION=1 PACKAGE_VERSION="$PACKAGE_VERSION" AUDIT_REPORT="$AUDIT_REPORT" \
    UAIX_BROWSER_PUBLISH_PLAN_REPORT="$PUBLISH_PLAN_REPORT" \
    "$REPO_ROOT/eng/publish-browser-nuget.sh" "$PACKAGE_SOURCE" "$NUGET_SOURCE" "$PUBLISH_PLAN_REPORT"

run_step LOCAL_CURRENT_STATUS LOCAL_CURRENT_ERROR "$LOCAL_FEED_CURRENT_REPORT" \
  env TINYRUSTLM_FEED_PACKAGE_IDS="$UAIX_BROWSER_PACKAGE_IDS" \
    "$REPO_ROOT/eng/verify-feed-current.sh" "$PACKAGE_SOURCE" "$PACKAGE_VERSION" "$LOCAL_FEED_CURRENT_REPORT"

run_step LOCAL_HASH_STATUS LOCAL_HASH_ERROR "$LOCAL_FEED_HASH_REPORT" \
  "$REPO_ROOT/eng/verify-feed-package-hashes.sh" "$PACKAGE_SOURCE" "$PUBLISH_PLAN_REPORT" "$LOCAL_FEED_HASH_REPORT"

run_step REMOTE_CURRENT_STATUS REMOTE_CURRENT_ERROR "$REMOTE_FEED_CURRENT_REPORT" \
  env TINYRUSTLM_FEED_PACKAGE_IDS="$UAIX_BROWSER_PACKAGE_IDS" \
    "$REPO_ROOT/eng/verify-feed-current.sh" "$NUGET_SOURCE" "$PACKAGE_VERSION" "$REMOTE_FEED_CURRENT_REPORT"

REMOTE_CURRENT_REPORT_STATUS="$(read_report_status "$REMOTE_FEED_CURRENT_REPORT")"
if [[ "$REMOTE_CURRENT_REPORT_STATUS" == "pass" ]]; then
  run_step REMOTE_HASH_STATUS REMOTE_HASH_ERROR "$REMOTE_FEED_HASH_REPORT" \
    "$REPO_ROOT/eng/verify-feed-package-hashes.sh" "$NUGET_SOURCE" "$PUBLISH_PLAN_REPORT" "$REMOTE_FEED_HASH_REPORT"
else
  rm -f -- "$REMOTE_FEED_HASH_REPORT"
  REMOTE_HASH_STATUS="skipped"
  REMOTE_HASH_ERROR="Skipped because the remote feed does not expose the declared UAIX Browser package version yet."
fi

API_KEY_PRESENT="false"
if [[ -n "${NUGET_API_KEY:-}" ]]; then
  API_KEY_PRESENT="true"
fi

export PACKAGE_SOURCE NUGET_SOURCE REPORT_OUTPUT PACKAGE_VERSION AUDIT_REPORT PUBLISH_PLAN_REPORT
export LOCAL_FEED_CURRENT_REPORT LOCAL_FEED_HASH_REPORT REMOTE_FEED_CURRENT_REPORT REMOTE_FEED_HASH_REPORT
export FAIL_ON_BLOCKED AUTH_MODE API_KEY_PRESENT UAIX_BROWSER_PACKAGE_IDS
export PUBLISH_PLAN_STATUS PUBLISH_PLAN_ERROR LOCAL_CURRENT_STATUS LOCAL_CURRENT_ERROR LOCAL_HASH_STATUS LOCAL_HASH_ERROR
export REMOTE_CURRENT_STATUS REMOTE_CURRENT_ERROR REMOTE_HASH_STATUS REMOTE_HASH_ERROR

READINESS_STATUS="$(python3 <<'PY'
import json
import os
import re
from datetime import datetime, timezone


def read_report_status(path):
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            return str(json.load(handle).get("status", ""))
    except Exception:
        return "invalid"


def read_report(path):
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            value = json.load(handle)
            return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def step(name, status, report_path, error):
    return {
        "name": name,
        "status": status,
        "report_path": report_path,
        "report_written": os.path.isfile(report_path),
        "report_status": read_report_status(report_path),
        "error_message": error,
    }


def is_nuget_org_source(source):
    candidate = source.strip().lower()
    return (
        candidate == "nuget.org"
        or re.search(r"(^|[./:-])nuget\.org($|[/:.-])", candidate) is not None
        or re.search(r"(^|[./:-])api\.nuget\.org($|[/:.-])", candidate) is not None
    )


package_ids = [
    item.strip()
    for item in os.environ["UAIX_BROWSER_PACKAGE_IDS"].split(",")
    if item.strip()
]
steps = [
    step("publish_plan_dry_run", os.environ["PUBLISH_PLAN_STATUS"], os.environ["PUBLISH_PLAN_REPORT"], os.environ["PUBLISH_PLAN_ERROR"]),
    step("local_feed_current", os.environ["LOCAL_CURRENT_STATUS"], os.environ["LOCAL_FEED_CURRENT_REPORT"], os.environ["LOCAL_CURRENT_ERROR"]),
    step("local_feed_hashes", os.environ["LOCAL_HASH_STATUS"], os.environ["LOCAL_FEED_HASH_REPORT"], os.environ["LOCAL_HASH_ERROR"]),
    step("remote_feed_current", os.environ["REMOTE_CURRENT_STATUS"], os.environ["REMOTE_FEED_CURRENT_REPORT"], os.environ["REMOTE_CURRENT_ERROR"]),
    step("remote_feed_hashes", os.environ["REMOTE_HASH_STATUS"], os.environ["REMOTE_FEED_HASH_REPORT"], os.environ["REMOTE_HASH_ERROR"]),
]
local_names = {"publish_plan_dry_run", "local_feed_current", "local_feed_hashes"}
local_failures = []
for item in steps:
    if item["name"] not in local_names:
        continue
    if item["status"] != "pass":
        local_failures.append(item)
        continue
    expected_report_status = "dry_run" if item["name"] == "publish_plan_dry_run" else "pass"
    if item["report_status"] != expected_report_status:
        local_failures.append(item)
remote_current = next(item for item in steps if item["name"] == "remote_feed_current")
remote_hash = next(item for item in steps if item["name"] == "remote_feed_hashes")
api_key_present = os.environ["API_KEY_PRESENT"] == "true"
auth_mode = os.environ["AUTH_MODE"]
trusted_publishing_requested = auth_mode == "trusted_publishing"
trusted_publishing_supported = trusted_publishing_requested and is_nuget_org_source(os.environ["NUGET_SOURCE"])
blockers = []
next_actions = []

if local_failures:
    status = "blocked_local_verification"
    blockers.append("Local UAIX Browser package, audit, publish-plan, or package-folder feed verification failed.")
    next_actions.append("Run eng/pack.ps1 for the UAIX Browser package IDs, eng/verify-browser-feed.ps1, then rerun this readiness audit.")
elif remote_current["status"] != "pass" and not remote_current["report_status"]:
    status = "blocked_feed_status_unknown"
    blockers.append("The configured NuGet feed could not be queried for current UAIX Browser package versions.")
    next_actions.append("Check NuGet feed connectivity and rerun the Browser readiness audit.")
elif trusted_publishing_requested and not trusted_publishing_supported:
    status = "blocked_trusted_publishing_unsupported"
    blockers.append("Trusted Publishing auth mode is only supported for NuGet.org sources.")
    next_actions.append("Use AUTH_MODE=api_key for private feeds, or change NUGET_SOURCE to a NuGet.org v3 source with a configured Trusted Publishing policy.")
elif remote_current["report_status"] == "pass":
    if remote_hash["status"] == "pass" and remote_hash["report_status"] == "pass":
        status = "published_current"
        next_actions.append("Keep UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT enabled for the authoritative feed.")
    else:
        status = "blocked_remote_hash_mismatch"
        blockers.append("The feed exposes the declared UAIX Browser version but package bytes do not match the audited publish plan.")
        next_actions.append("Investigate feed immutability and UAIX Browser package provenance before claiming the feed is current.")
        next_actions.append("If the published version is already immutable on NuGet.org, bump dotnet/Directory.Build.props VersionPrefix before publishing corrected UAIX Browser packages.")
elif trusted_publishing_supported:
    status = "ready_to_publish"
    next_actions.append("Configure a NuGet.org Trusted Publishing policy for workflow release-browser-nuget.yml and environment nuget-release, then run the Browser release workflow with auth_mode=trusted_publishing.")
elif not api_key_present:
    status = "blocked_missing_api_key"
    blockers.append("NUGET_API_KEY is not present, so this environment cannot perform the authenticated UAIX Browser push.")
    next_actions.append("Run the Browser release workflow or eng/publish-browser-nuget.sh in an environment with a scoped NuGet API key.")
else:
    status = "ready_to_publish"
    next_actions.append("Run eng/publish-browser-nuget.sh without DRY_RUN=1, then wait for indexing and rerun Browser feed-current/feed-hash verification.")

package_source = os.environ["PACKAGE_SOURCE"]
if os.path.isdir(package_source):
    package_source = os.path.abspath(package_source)

publish_plan = read_report(os.environ["PUBLISH_PLAN_REPORT"])
local_feed_hashes = read_report(os.environ["LOCAL_FEED_HASH_REPORT"])

report = {
    "schema": "uaix.browser.nuget.release_readiness.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "package_version": os.environ["PACKAGE_VERSION"],
    "package_ids": package_ids,
    "package_id_count": len(package_ids),
    "package_source": package_source,
    "nuget_source": os.environ["NUGET_SOURCE"],
    "secret_material_included": False,
    "auth_mode": auth_mode,
    "api_key_present": api_key_present,
    "trusted_publishing_requested": trusted_publishing_requested,
    "trusted_publishing_supported": trusted_publishing_supported,
    "fail_on_blocked": os.environ["FAIL_ON_BLOCKED"] == "1",
    "publish_plan_report_path": os.environ["PUBLISH_PLAN_REPORT"],
    "publish_plan_schema": str(publish_plan.get("schema", "")),
    "publish_plan_status": str(publish_plan.get("status", "")),
    "publish_plan_package_count": int(publish_plan.get("package_count") or 0),
    "publish_plan_symbol_package_count": int(publish_plan.get("symbol_package_count") or 0),
    "symbol_publish_mode": str(publish_plan.get("symbol_publish_mode", "")),
    "package_hash_manifest_name": str(publish_plan.get("package_hash_manifest_name", "")),
    "package_hash_manifest_sha256": str(publish_plan.get("package_hash_manifest_sha256", "")),
    "package_hash_manifest_match": bool(publish_plan.get("package_hash_manifest_match", False)),
    "feed_readme_name": str(publish_plan.get("feed_readme_name", "")),
    "feed_readme_sha256": str(publish_plan.get("feed_readme_sha256", "")),
    "feed_readme_status": str(publish_plan.get("feed_readme_status", "")),
    "feed_readme_match": bool(publish_plan.get("feed_readme_match", False)),
    "feed_readme_missing_term_count": int(publish_plan.get("feed_readme_missing_term_count") or 0),
    "local_feed_current_report_path": os.environ["LOCAL_FEED_CURRENT_REPORT"],
    "local_feed_hash_report_path": os.environ["LOCAL_FEED_HASH_REPORT"],
    "local_feed_hash_status": str(local_feed_hashes.get("status", "")),
    "local_feed_hash_package_count": int(local_feed_hashes.get("package_count") or 0),
    "local_feed_hash_symbol_package_count": int(local_feed_hashes.get("symbol_package_count") or 0),
    "local_feed_hash_symbol_verification_mode": str(local_feed_hashes.get("symbol_package_verification_mode", "")),
    "local_feed_hash_mismatch_count": int(local_feed_hashes.get("hash_mismatch_count") or 0),
    "local_feed_hash_symbol_mismatch_count": int(local_feed_hashes.get("symbol_hash_mismatch_count") or 0),
    "local_feed_hash_symbol_byte_count_mismatch_count": int(local_feed_hashes.get("symbol_byte_count_mismatch_count") or 0),
    "remote_feed_current_report_path": os.environ["REMOTE_FEED_CURRENT_REPORT"],
    "remote_feed_hash_report_path": os.environ["REMOTE_FEED_HASH_REPORT"],
    "blockers": blockers,
    "next_actions": next_actions,
    "steps": steps,
}

report_output = os.environ["REPORT_OUTPUT"]
os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(status)
PY
)"

echo "UAIX Browser NuGet release-readiness report written to $REPORT_OUTPUT"
echo "UAIX Browser NuGet release-readiness status: $READINESS_STATUS"

if [[ "$FAIL_ON_BLOCKED" == "1" && "$READINESS_STATUS" == blocked_* ]]; then
  echo "UAIX Browser NuGet release readiness is blocked: $READINESS_STATUS" >&2
  exit 1
fi
