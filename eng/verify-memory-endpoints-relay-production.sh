#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELAY_BASE_URL="${TINYRUSTLM_MEMORY_ENDPOINTS_RELAY_URL:-https://tinyrustlm.com/api/memoryendpoints}"
WORKSPACE_ID="${MEMORYENDPOINTS_WORKSPACE_ID:-}"
WORKSPACE_KEY="${MEMORYENDPOINTS_WORKSPACE_KEY:-}"
AGENT_ID="${MEMORYENDPOINTS_AGENT_ID:-tinyrustlm-agent}"
AUTH_HEADER_MODE="${MEMORYENDPOINTS_AUTH_HEADER:-authorization}"
REPORT_OUTPUT="${1:-$REPO_ROOT/artifacts/reports/tinyrustlm-memory-endpoints-production-relay.json}"
ALLOW_MISSING="${TINYRUSTLM_MEMORY_ENDPOINTS_ALLOW_MISSING:-0}"

if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)' >/dev/null 2>&1; then
  PYTHON_COMMAND=(python3)
elif command -v python >/dev/null 2>&1 && python -c 'import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)' >/dev/null 2>&1; then
  PYTHON_COMMAND=(python)
elif command -v py >/dev/null 2>&1 && py -3 -c 'import sys' >/dev/null 2>&1; then
  PYTHON_COMMAND=(py -3)
else
  echo "Python 3 is required to verify the TinyRustLM MemoryEndpoints production relay." >&2
  exit 127
fi

"${PYTHON_COMMAND[@]}" - "$RELAY_BASE_URL" "$WORKSPACE_ID" "$WORKSPACE_KEY" "$AGENT_ID" "$AUTH_HEADER_MODE" "$REPORT_OUTPUT" "$ALLOW_MISSING" <<'PY'
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

(
    relay_base_url,
    workspace_id,
    workspace_key,
    agent_id,
    auth_header_mode,
    report_output,
    allow_missing,
) = sys.argv[1:8]

scope = "project"
scope_id = "tinyrustlm.com"
search_retries = 6
retry_delay_seconds = 2


def now_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_report(report):
    os.makedirs(os.path.dirname(os.path.abspath(report_output)), exist_ok=True)
    with open(report_output, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=False)
        handle.write("\n")


def normalize_relay_base(value):
    if not value.strip():
        raise ValueError("TinyRustLM MemoryEndpoints relay URL is required.")
    if re.search(r"(?i)bearer\s+|api[_-]?key|password|secret=", value):
        raise ValueError("TinyRustLM MemoryEndpoints relay URL must not include credential material.")
    parsed = urllib.parse.urlparse(value)
    loopback_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not loopback_http:
        raise ValueError("TinyRustLM MemoryEndpoints relay URL must use HTTPS, except loopback HTTP for local tests.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("TinyRustLM MemoryEndpoints relay URL must not include credentials, query strings, or fragments.")
    if parsed.path.rstrip("/") != "/api/memoryendpoints":
        raise ValueError("TinyRustLM MemoryEndpoints relay URL must end at /api/memoryendpoints.")
    return value.rstrip("/")


def relay_url(path, query=None):
    url = f"{relay_base}{path}"
    if query:
        clean = {key: value for key, value in query.items() if value is not None and str(value) != ""}
        encoded = urllib.parse.urlencode(clean)
        if encoded:
            url = f"{url}?{encoded}"
    return url


def auth_headers():
    if auth_header_mode == "x-memoryendpoints-key":
        return {"X-MemoryEndpoints-Key": workspace_key}
    return {"Authorization": f"Bearer {workspace_key}"}


def request(method, path, payload=None, query=None, idempotency_prefix=""):
    headers = {}
    data = None
    if method != "OPTIONS":
        headers.update(auth_headers())
        headers["Accept"] = "application/json"
    if method == "POST":
        headers["Content-Type"] = "application/json"
        headers["Idempotency-Key"] = f"{idempotency_prefix}-{uuid.uuid4().hex}"
        data = json.dumps(payload or {}, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(relay_url(path, query), data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, dict(response.headers), body
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return error.code, dict(error.headers), body


def no_store(headers):
    return "no-store" in str(headers.get("Cache-Control", "")).lower()


def response_items(payload):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("items", "results", "matches", "memories", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict) and isinstance(value.get("items"), list):
            return value["items"]
    return []


def items_contain(items, needle):
    for item in items:
        if needle in json.dumps(item, separators=(",", ":"), sort_keys=True):
            return True
    return False


def search_memory_type(marker, memory_type):
    for attempt in range(max(1, search_retries)):
        status, _headers, body = request(
            "GET",
            "/api/matm/search",
            query={
                "workspaceId": workspace_id,
                "agentId": agent_id,
                "actor_agent_id": agent_id,
                "query": marker,
                "scope": scope,
                "scopeId": scope_id,
                "memory_type": memory_type,
                "limit": "10",
            },
        )
        if 200 <= status < 300:
            payload = json.loads(body or "{}")
            items = response_items(payload)
            if items_contain(items, marker):
                return items
        if attempt + 1 < search_retries:
            time.sleep(retry_delay_seconds)
    return []


report = {
    "schema": "tinyrustlm.memory_endpoints.production_relay_verification.v0",
    "status": "not_started",
    "generated_at_utc": now_utc(),
    "relay_base_url": "<redacted-or-public-relay-url>",
    "relay_url_present": bool(relay_base_url.strip()),
    "workspace_id_present": bool(workspace_id.strip()),
    "workspace_key_present": bool(workspace_key.strip()),
    "agent_id": agent_id,
    "scope": scope,
    "scope_id": scope_id,
    "auth_header_mode": auth_header_mode,
    "secret_material_included": False,
    "report_path": report_output,
}

try:
    if auth_header_mode not in {"authorization", "x-memoryendpoints-key"}:
        raise ValueError("MEMORYENDPOINTS_AUTH_HEADER must be authorization or x-memoryendpoints-key.")
    relay_base = normalize_relay_base(relay_base_url)
    report["relay_base_url"] = relay_base

    preflight_status, preflight_headers, _ = request("OPTIONS", "/api/matm/agents/register")
    report["preflight_status"] = preflight_status
    report["preflight_no_store"] = no_store(preflight_headers)

    model_status, _model_headers, _ = request("GET", "/models/probe.slm")
    report["model_route_status"] = model_status
    report["model_route_rejected"] = model_status >= 400

    route_failures = []
    if report["preflight_status"] != 204:
        route_failures.append(f"preflight_status={report['preflight_status']}")
    if not report["model_route_rejected"]:
        route_failures.append("model route was not rejected")
    if route_failures:
        report["status"] = "fail_route_contract"
        report["failures"] = route_failures
        write_report(report)
        raise ValueError(
            "TinyRustLM MemoryEndpoints production relay route contract failed: "
            + "; ".join(route_failures)
        )

    if not workspace_id.strip() or not workspace_key.strip():
        report["status"] = "skipped_missing_credentials" if allow_missing == "1" else "blocked_missing_credentials"
        report["required_environment"] = ["MEMORYENDPOINTS_WORKSPACE_ID", "MEMORYENDPOINTS_WORKSPACE_KEY"]
        write_report(report)
        if allow_missing == "1":
            print(f"TinyRustLM MemoryEndpoints production relay verification skipped: missing credentials. Report: {report_output}")
            raise SystemExit(0)
        raise ValueError("MEMORYENDPOINTS_WORKSPACE_ID and MEMORYENDPOINTS_WORKSPACE_KEY are required.")

    marker = f"tinyrustlm-production-relay-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:12]}"
    short_marker = f"{marker} short_term_status_probe"
    long_marker = f"{marker} long_term_handoff_probe"
    report["marker_sha256"] = hashlib.sha256(marker.encode("utf-8")).hexdigest()

    register_status, register_headers, _ = request(
        "POST",
        "/api/matm/agents/register",
        payload={
            "workspaceId": workspace_id,
            "agentId": agent_id,
            "displayName": "TinyRustLM Production Relay Verifier",
            "safeSummary": "TinyRustLM production same-origin MemoryEndpoints relay verifier.",
        },
        idempotency_prefix="tinyrustlm-production-relay-register",
    )
    report["register_status"] = register_status
    report["register_no_store"] = no_store(register_headers)

    short_status, short_headers, _ = request(
        "POST",
        "/api/matm/memory-events/submit",
        payload={
            "workspaceId": workspace_id,
            "actorAgentId": agent_id,
            "kind": "tinyrustlm.memory_endpoints.memory_record.v1",
            "version": 1,
            "scope": scope,
            "scopeId": scope_id,
            "memoryType": "status",
            "subject": "TinyRustLM production relay short-term verifier",
            "title": "TinyRustLM production relay short-term verifier",
            "summary": f"Public-safe TinyRustLM production relay short-term memory probe {short_marker}.",
            "source": "eng/verify-memory-endpoints-relay-production.sh",
            "confidence": 0.8,
            "uaiReferences": [".uai/short-term-memory.uai", "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"],
            "tags": ["tinyrustlm", "memoryendpoints", "production-relay", "short-term", f"scope:{scope_id}", marker],
            "tinyrustlmMemoryTier": "short_term",
        },
        idempotency_prefix="tinyrustlm-production-relay-short",
    )
    report["short_save_status"] = short_status
    report["short_save_no_store"] = no_store(short_headers)

    long_status, long_headers, _ = request(
        "POST",
        "/api/matm/memory-events/submit",
        payload={
            "workspaceId": workspace_id,
            "actorAgentId": agent_id,
            "kind": "tinyrustlm.memory_endpoints.memory_record.v1",
            "version": 1,
            "scope": scope,
            "scopeId": scope_id,
            "memoryType": "handoff",
            "subject": "TinyRustLM production relay long-term verifier",
            "title": "TinyRustLM production relay long-term verifier",
            "summary": f"Public-safe TinyRustLM production relay long-term memory probe {long_marker}.",
            "source": "eng/verify-memory-endpoints-relay-production.sh",
            "confidence": 0.8,
            "uaiReferences": [".uai/long-term-memory.uai", "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"],
            "tags": ["tinyrustlm", "memoryendpoints", "production-relay", "long-term", f"scope:{scope_id}", marker],
            "tinyrustlmMemoryTier": "long_term",
        },
        idempotency_prefix="tinyrustlm-production-relay-long",
    )
    report["long_save_status"] = long_status
    report["long_save_no_store"] = no_store(long_headers)

    status_items = search_memory_type(marker, "status")
    handoff_items = search_memory_type(marker, "handoff")
    report["status_search_result_count"] = len(status_items)
    report["handoff_search_result_count"] = len(handoff_items)
    report["short_term_found"] = items_contain(status_items, short_marker)
    report["long_term_found"] = items_contain(handoff_items, long_marker)
    report["status_search_excluded_long"] = not items_contain(status_items, long_marker)
    report["handoff_search_excluded_short"] = not items_contain(handoff_items, short_marker)

    failures = []
    if not (200 <= register_status < 300):
        failures.append(f"register_status={register_status}")
    if not (200 <= short_status < 300):
        failures.append(f"short_save_status={short_status}")
    if not (200 <= long_status < 300):
        failures.append(f"long_save_status={long_status}")
    if not report["short_term_found"]:
        failures.append("short-term status memory not found")
    if not report["long_term_found"]:
        failures.append("long-term handoff memory not found")
    if not report["status_search_excluded_long"]:
        failures.append("status search included long-term marker")
    if not report["handoff_search_excluded_short"]:
        failures.append("handoff search included short-term marker")
    if not (report["register_no_store"] and report["short_save_no_store"] and report["long_save_no_store"]):
        failures.append("relay responses did not consistently return no-store")

    report["failures"] = failures
    report["status"] = "pass" if not failures else "fail"
    write_report(report)
    if failures:
        raise ValueError("TinyRustLM MemoryEndpoints production relay verification failed: " + "; ".join(failures))
    print(f"TinyRustLM MemoryEndpoints production relay verification passed. Report: {report_output}")
except Exception as error:
    if report["status"] == "not_started":
        report["status"] = "fail"
        report["error"] = str(error)
        write_report(report)
    raise
PY
