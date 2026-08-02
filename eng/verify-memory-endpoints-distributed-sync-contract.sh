#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${MEMORYENDPOINTS_BASE_URL:-https://memoryendpoints.com}"
REPORT_PATH="${TINYRUSTLM_DISTRIBUTED_SYNC_CONTRACT_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-contract.json}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for distributed-sync contract verification." >&2
  exit 1
fi
mkdir -p "$(dirname "$REPORT_PATH")"

MEMORYENDPOINTS_BASE_URL="$BASE_URL" \
TINYRUSTLM_DISTRIBUTED_SYNC_CONTRACT_REPORT="$REPORT_PATH" \
python3 - <<'PY'
import json
import os
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

base = os.environ["MEMORYENDPOINTS_BASE_URL"].rstrip("/")
parsed = urllib.parse.urlparse(base)
if parsed.scheme != "https" and not (
    parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", "::1"}
):
    raise SystemExit("Base URL must use HTTPS, except explicit loopback HTTP for tests.")
matm = base if base.lower().endswith("/api/matm") else base + "/api/matm"
origin = f"{parsed.scheme}://{parsed.netloc}"
report_path = pathlib.Path(os.environ["TINYRUSTLM_DISTRIBUTED_SYNC_CONTRACT_REPORT"])
cors_origin = "https://tinyrustlm.com"

expected = {
    "registerDevice": ("/api/matm/sync/devices", "POST"),
    "rotateDevice": ("/api/matm/sync/devices/rotate", "POST"),
    "revokeDevice": ("/api/matm/sync/devices/revoke", "POST"),
    "submitMutation": ("/api/matm/sync/mutations", "POST"),
    "lookupReceipt": ("/api/matm/sync/receipts", "GET"),
    "changes": ("/api/matm/sync/changes", "GET"),
    "heads": ("/api/matm/sync/heads", "GET"),
    "retention": ("/api/matm/sync/retention", "GET"),
}

def request(method, url, body=None, headers=None):
    active = {"Accept": "application/json", **(headers or {})}
    payload = None
    if method == "POST":
        payload = (body or "{}").encode("utf-8")
        active["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=payload, headers=active, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, {
                key.lower(): value for key, value in response.headers.items()
            }, raw
    except urllib.error.HTTPError as error:
        return error.code, {
            key.lower(): value for key, value in error.headers.items()
        }, error.read()

def exact_keys(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)

def valid_capability(data):
    top = {
        "schemaVersion", "status", "protocol", "capabilityRoute", "routes",
        "mutationContract", "checkpointContract", "deviceContract", "retention",
        "publicSafeOnly", "rawCredentialExposed", "rawPayloadExposed", "valuesRedacted",
    }
    if not exact_keys(data, top) or not exact_keys(data.get("routes"), expected):
        return False
    mutation = data.get("mutationContract")
    checkpoint = data.get("checkpointContract")
    device = data.get("deviceContract")
    retention = data.get("retention")
    if not exact_keys(mutation, {
        "operations", "hardForgetSupported", "hardForgetBehavior", "idempotency",
        "revisionFields", "conflictSemantics", "tombstoneSemantics",
    }) or not exact_keys(checkpoint, {
        "changesQuery", "monotonicServerSequence", "indexedThroughWatermark",
        "paginationFields",
    }) or not exact_keys(device, {
        "authorityEpoch", "registerRotateRevoke", "revokedDeviceMutationBehavior",
        "secretMaterialStored",
    }) or not exact_keys(retention, {
        "tombstoneRetentionDays", "hardForgetSupported", "rawPrivatePayloadStored",
        "valuesRedacted",
    }):
        return False
    return (
        data["schemaVersion"] == "memoryendpoints.distributed_sync_capabilities.v1"
        and data["status"] == "live"
        and data["protocol"] == "memoryendpoints-distributed-sync-v1"
        and data["capabilityRoute"] == "/api/matm/sync/capabilities"
        and data["publicSafeOnly"] is True
        and data["valuesRedacted"] is True
        and data["rawCredentialExposed"] is False
        and data["rawPayloadExposed"] is False
        and all(data["routes"].get(name) == route for name, (route, _) in expected.items())
        and mutation["operations"] == ["upsert", "delete", "hard_forget"]
        and mutation["revisionFields"] == [
            "logicalMemoryId", "parentRevisionId", "syncRevisionId", "serverSequence",
            "bodyHash", "conflict", "conflictCode",
        ]
        and mutation["hardForgetSupported"] is False
        and mutation["hardForgetBehavior"] == "safe_rejected_receipt"
        and "Idempotency-Key" in mutation["idempotency"]
        and bool(mutation["conflictSemantics"].strip())
        and bool(mutation["tombstoneSemantics"].strip())
        and checkpoint["changesQuery"] == [
            "workspace_id", "after_sequence", "limit", "logical_memory_id",
        ]
        and checkpoint["paginationFields"] == [
            "items", "hasMore", "nextAfterSequence", "indexedThroughSequence", "checkpoint",
        ]
        and checkpoint["monotonicServerSequence"] is True
        and checkpoint["indexedThroughWatermark"] is True
        and device["authorityEpoch"] is True
        and device["registerRotateRevoke"] is True
        and device["revokedDeviceMutationBehavior"] == "safe_rejected_receipt"
        and device["secretMaterialStored"] is False
        and isinstance(retention["tombstoneRetentionDays"], int)
        and 1 <= retention["tombstoneRetentionDays"] <= 3650
        and retention["hardForgetSupported"] is False
        and retention["rawPrivatePayloadStored"] is False
        and retention["valuesRedacted"] is True
    )

cap_url = matm + "/sync/capabilities"
cap_status, cap_headers, cap_raw = request("GET", cap_url)
capability = None
shape_valid = False
if cap_status == 200:
    try:
        envelope = json.loads(cap_raw.decode("utf-8"))
        shape_valid = exact_keys(envelope, {"ok", "data"}) and envelope["ok"] is True and valid_capability(envelope["data"])
        capability = envelope.get("data")
    except (ValueError, UnicodeDecodeError, KeyError, TypeError):
        pass
no_store = bool(re.search(r"(?:^|,)\s*no-store\s*(?:,|$)", cap_headers.get("cache-control", ""), re.I))

route_evidence = []
route_pass = True
for name, (route, method) in expected.items():
    status, _, _ = request(method, origin + route, headers={
        "Origin": cors_origin,
        "Idempotency-Key": "tinyrustlm-contract-route-probe",
    })
    exists = status not in {404, 405}
    route_pass = route_pass and exists
    route_evidence.append({
        "name": name,
        "route": route,
        "method": method,
        "unauthenticated_http_status": status,
        "route_exists": exists,
        "safe_auth_rejection": status in {400, 401, 403, 413, 422},
    })

cors_status, cors_headers, _ = request("OPTIONS", matm + "/sync/mutations", headers={
    "Origin": cors_origin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
})
allow_origin = cors_headers.get("access-control-allow-origin", "")
allow_headers = cors_headers.get("access-control-allow-headers", "")
cors_pass = (
    cors_status in {200, 204}
    and allow_origin in {"*", cors_origin}
    and re.search("authorization", allow_headers, re.I)
    and re.search("idempotency-key", allow_headers, re.I)
)

openapi_url = matm + "/openapi.json"
openapi_status, _, openapi_raw = request("GET", openapi_url)
openapi_available = openapi_status == 200
openapi_paths_pass = True
openapi_path_count = 0
if openapi_available:
    try:
        openapi = json.loads(openapi_raw.decode("utf-8"))
        paths = openapi.get("paths", {})
        openapi_path_count = len(paths)
        openapi_paths_pass = all(method.lower() in (paths.get(route) or {}) for route, method in expected.values())
    except (ValueError, UnicodeDecodeError, TypeError):
        openapi_paths_pass = False

version_status, _, version_raw = request("GET", origin + "/api/version")
version = {}
if version_status == 200:
    try:
        version = json.loads(version_raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        version = {}

status = "pass" if (
    shape_valid and no_store and route_pass and cors_pass
    and (not openapi_available or openapi_paths_pass)
) else "fail"
report = {
    "schema": "tinyrustlm.memory_endpoints.distributed_sync_contract_verification.v2",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "service_origin": origin,
    "capability": {
        "url": cap_url,
        "http_status": cap_status,
        "exact_shape_valid": shape_valid,
        "cache_control_no_store": no_store,
        "schema_version": (capability or {}).get("schemaVersion", ""),
        "protocol": (capability or {}).get("protocol", ""),
        "hard_forget_supported": bool((capability or {}).get("mutationContract", {}).get("hardForgetSupported")),
    },
    "protected_route_probes": route_evidence,
    "direct_cors": {
        "options_http_status": cors_status,
        "allow_origin": allow_origin,
        "authorization_allowed": bool(re.search("authorization", allow_headers, re.I)),
        "idempotency_key_allowed": bool(re.search("idempotency-key", allow_headers, re.I)),
        "passed": bool(cors_pass),
    },
    "openapi": {
        "url": openapi_url,
        "available": openapi_available,
        "http_status": openapi_status,
        "path_count": openapi_path_count,
        "sync_paths_match": openapi_paths_pass,
    },
    "deployed_authority": {
        "version_route_available": version_status == 200,
        "source_sha": version.get("build", {}).get("sourceSha", ""),
        "store_backend": version.get("storeBackend", ""),
        "store_backend_verified": version.get("storeBackendVerified") is True,
    },
    "values_redacted": True,
    "raw_credential_exposed": False,
    "raw_payload_exposed": False,
    "secret_material_included": False,
}
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Distributed-sync contract verification: {status}")
print(f"Report: {report_path}")
PY

status="$(python3 - "$REPORT_PATH" <<'PY'
import json, sys
print(json.load(open(sys.argv[1], encoding="utf-8-sig"))["status"])
PY
)"
if [[ "$status" != "pass" ]]; then
  echo "MemoryEndpoints distributed-sync v1 contract verification failed. See the redacted report." >&2
  exit 1
fi
