#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${MEMORYENDPOINTS_BASE_URL:-https://memoryendpoints.com}"
WORKSPACE_ID="${MEMORYENDPOINTS_WORKSPACE_ID:-}"
WORKSPACE_KEY="${MEMORYENDPOINTS_WORKSPACE_KEY:-}"
AGENT_ID="${MEMORYENDPOINTS_AGENT_ID:-tinyrustlm-agent}"
AUTH_HEADER_MODE="${MEMORYENDPOINTS_AUTH_HEADER:-authorization}"
SCOPE="${MEMORYENDPOINTS_SCOPE:-project}"
SCOPE_ID="${MEMORYENDPOINTS_SCOPE_ID:-tinyrustlm.com}"
MEETING_SCOPE_ID="${MEMORYENDPOINTS_MEETING_SCOPE_ID:-goal-tinyrustlm-hosted-memory}"
REPORT_OUTPUT="${TINYRUSTLM_MEMORY_ENDPOINTS_LIVE_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-memory-endpoints-live.json}"
ALLOW_MISSING="${TINYRUSTLM_MEMORY_ENDPOINTS_ALLOW_MISSING:-0}"
SEARCH_RETRIES="${TINYRUSTLM_MEMORY_ENDPOINTS_SEARCH_RETRIES:-4}"
RETRY_DELAY_SECONDS="${TINYRUSTLM_MEMORY_ENDPOINTS_RETRY_DELAY_SECONDS:-2}"
SCHEMA="tinyrustlm.memory_endpoints.live_verification.v0"
NODE_BIN="$(command -v node || command -v node.exe || true)"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --workspace-id)
      WORKSPACE_ID="$2"
      shift 2
      ;;
    --workspace-key)
      WORKSPACE_KEY="$2"
      shift 2
      ;;
    --agent-id)
      AGENT_ID="$2"
      shift 2
      ;;
    --auth-header)
      AUTH_HEADER_MODE="$2"
      shift 2
      ;;
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    --scope-id)
      SCOPE_ID="$2"
      shift 2
      ;;
    --meeting-scope-id)
      MEETING_SCOPE_ID="$2"
      shift 2
      ;;
    --report-output)
      REPORT_OUTPUT="$2"
      shift 2
      ;;
    --allow-missing-credentials)
      ALLOW_MISSING="1"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

mkdir -p "$(dirname "$REPORT_OUTPUT")"

write_report() {
  local status="$1"
  shift || true
  if [[ -z "$NODE_BIN" || "$status" == "skipped_missing_credentials" || "$status" == "blocked_missing_credentials" ]]; then
    cat > "$REPORT_OUTPUT" <<JSON
{
  "schema": "$SCHEMA",
  "status": "$status",
  "generated_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "base_url": "<redacted-hosted-memory-url>",
  "workspace_id_present": $([[ -n "$WORKSPACE_ID" ]] && echo true || echo false),
  "workspace_key_present": $([[ -n "$WORKSPACE_KEY" ]] && echo true || echo false),
  "agent_id": "$AGENT_ID",
  "scope": "$SCOPE",
  "scope_id": "$SCOPE_ID",
  "meeting_scope_id": "$MEETING_SCOPE_ID",
  "auth_header_mode": "$AUTH_HEADER_MODE",
  "secret_material_included": false,
  "short_term_memory_type": "status",
  "long_term_memory_type": "handoff",
  "report_path": "$REPORT_OUTPUT",
  "tooling": "node_missing"
}
JSON
    return
  fi
  "$NODE_BIN" - "$REPORT_OUTPUT" "$SCHEMA" "$status" "$AGENT_ID" "$SCOPE" "$SCOPE_ID" "$MEETING_SCOPE_ID" "$AUTH_HEADER_MODE" "$@" <<'JS'
const fs = require("fs");
const [path, schema, status, agentId, scope, scopeId, meetingScopeId, authHeaderMode, ...rest] = process.argv.slice(2);
const extra = {};
for (const item of rest) {
  const at = item.indexOf("=");
  if (at < 0) continue;
  const key = item.slice(0, at);
  const value = item.slice(at + 1);
  if (value.toLowerCase() === "true") extra[key] = true;
  else if (value.toLowerCase() === "false") extra[key] = false;
  else if (/^\d+$/.test(value)) extra[key] = Number(value);
  else extra[key] = value;
}
const report = {
  schema,
  status,
  generated_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  base_url: "<redacted-hosted-memory-url>",
  workspace_id_present: Boolean(extra.workspace_id_present),
  workspace_key_present: Boolean(extra.workspace_key_present),
  agent_id: agentId,
  scope,
  scope_id: scopeId,
  meeting_scope_id: meetingScopeId,
  auth_header_mode: authHeaderMode,
  secret_material_included: false,
  short_term_memory_type: "status",
  long_term_memory_type: "handoff",
  report_path: path,
  ...extra
};
fs.writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
JS
}

if [[ -z "$WORKSPACE_ID" || -z "$WORKSPACE_KEY" ]]; then
  if [[ "$ALLOW_MISSING" == "1" || "$ALLOW_MISSING" == "true" ]]; then
    write_report "skipped_missing_credentials" "workspace_id_present=$([[ -n "$WORKSPACE_ID" ]] && echo true || echo false)" "workspace_key_present=$([[ -n "$WORKSPACE_KEY" ]] && echo true || echo false)"
    echo "MemoryEndpoints live verification skipped: missing credentials. Report: $REPORT_OUTPUT"
    exit 0
  fi
  write_report "blocked_missing_credentials" "workspace_id_present=$([[ -n "$WORKSPACE_ID" ]] && echo true || echo false)" "workspace_key_present=$([[ -n "$WORKSPACE_KEY" ]] && echo true || echo false)"
  echo "MEMORYENDPOINTS_WORKSPACE_ID and MEMORYENDPOINTS_WORKSPACE_KEY are required." >&2
  exit 1
fi

if [[ -z "$NODE_BIN" ]]; then
  write_report "fail" "workspace_id_present=true" "workspace_key_present=true" "error=node_missing"
  echo "Node.js is required for credentialed Bash live verification. Use the PowerShell verifier on Windows or add node to PATH." >&2
  exit 1
fi

case "$BASE_URL" in
  *"bearer "*|*"Bearer "*|*"api_key"*|*"apikey"*|*"password"*|*"secret="*)
    write_report "fail" "workspace_id_present=true" "workspace_key_present=true" "error=base_url_contains_secret_marker"
    echo "MemoryEndpoints base URL must not include credential material." >&2
    exit 1
    ;;
esac

if [[ "$BASE_URL" != https://* && "$BASE_URL" != http://127.0.0.1* && "$BASE_URL" != http://localhost* ]]; then
  write_report "fail" "workspace_id_present=true" "workspace_key_present=true" "error=base_url_must_be_https_or_loopback"
  echo "MemoryEndpoints base URL must use HTTPS, except loopback HTTP for local tests." >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"

curl_auth_args() {
  if [[ "$AUTH_HEADER_MODE" == "x-memoryendpoints-key" ]]; then
    printf '%s\0%s\0' -H "X-MemoryEndpoints-Key: $WORKSPACE_KEY"
  else
    printf '%s\0%s\0' -H "Authorization: Bearer $WORKSPACE_KEY"
  fi
}

curl_json() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local response
  local -a auth
  mapfile -d '' -t auth < <(curl_auth_args)
  if [[ "$method" == "GET" ]]; then
    response="$(curl -fsS --no-progress-meter "${auth[@]}" "$BASE_URL$path")"
  else
    response="$(curl -fsS --no-progress-meter "${auth[@]}" -H "Content-Type: application/json" -H "Idempotency-Key: tinyrustlm-live-$(date +%s)-$RANDOM" -X "$method" --data "$data" "$BASE_URL$path")"
  fi
  printf '%s' "$response"
}

MARKER="tinyrustlm-live-verify-$(date -u +%Y%m%dT%H%M%SZ)-$("$NODE_BIN" -e "console.log(require('crypto').randomUUID().replace(/-/g, '').slice(0, 12))")"
SHORT_MARKER="$MARKER short_term_probe"
LONG_MARKER="$MARKER long_term_probe"
MEETING_MARKER="$MARKER meeting_transcript_probe"

registration_payload="$("$NODE_BIN" - "$WORKSPACE_ID" "$AGENT_ID" <<'JS'
const [workspaceId, agentId] = process.argv.slice(2);
console.log(JSON.stringify({
  workspaceId,
  agentId,
  displayName: "TinyRustLM Live Verifier",
  safeSummary: "TinyRustLM live verifier checking optional public-safe hosted memory sync."
}));
JS
)"
curl_json POST "/api/matm/agents/register" "$registration_payload" >/dev/null

make_memory_payload() {
  local memory_type="$1"
  local tier="$2"
  local marker_text="$3"
  local ref="$4"
  "$NODE_BIN" - "$WORKSPACE_ID" "$AGENT_ID" "$SCOPE" "$SCOPE_ID" "$memory_type" "$tier" "$marker_text" "$ref" "$MARKER" <<'JS'
const [workspaceId, agentId, scope, scopeId, memoryType, tier, markerText, ref, marker] = process.argv.slice(2);
const title = `TinyRustLM live ${tier} memory verifier`;
const summary = `Public-safe TinyRustLM ${tier} hosted memory probe ${markerText}.`;
console.log(JSON.stringify({
  workspaceId,
  actorAgentId: agentId,
  kind: "tinyrustlm.memory_endpoints.memory_record.v1",
  version: 1,
  scope,
  scopeId,
  memoryType,
  subject: title,
  title,
  summary,
  source: "eng/verify-memory-endpoints-live.sh",
  confidence: 0.8,
  uaiReferences: [ref, "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"],
  tags: ["tinyrustlm", "memoryendpoints", tier.replace("_", "-"), "live-verifier", `scope:${scopeId}`, marker],
  tinyrustlmMemoryTier: tier,
}));
JS
}

curl_json POST "/api/matm/memory-events/submit" "$(make_memory_payload "status" "short_term" "$SHORT_MARKER" ".uai/short-term-memory.uai")" >/dev/null
curl_json POST "/api/matm/memory-events/submit" "$(make_memory_payload "handoff" "long_term" "$LONG_MARKER" ".uai/long-term-memory.uai")" >/dev/null

WORKSPACE_RESPONSE="$(curl_json GET "/api/matm/workspace")"
ROOM_ID="$("$NODE_BIN" - "$WORKSPACE_RESPONSE" "$MEETING_SCOPE_ID" <<'JS'
const [json, meetingScopeId] = process.argv.slice(2);
const payload = JSON.parse(json);
const rooms = payload?.workspace?.meetingRooms || payload?.meetingRooms || [];
const room = rooms.find((item) => item && item.scope === "goal" && item.scopeId === meetingScopeId);
const id = room?.roomId || room?.id || "";
process.stdout.write(id);
JS
)"
meeting_room_found=false
meeting_room_created=false
if [[ -n "$ROOM_ID" ]]; then
  meeting_room_found=true
else
  create_room_payload="$("$NODE_BIN" - "$WORKSPACE_ID" "$AGENT_ID" "$MEETING_SCOPE_ID" <<'JS'
const [workspaceId, agentId, meetingScopeId] = process.argv.slice(2);
console.log(JSON.stringify({
  workspaceId,
  scope: "goal",
  scopeId: meetingScopeId,
  name: "TinyRustLM Hosted Memory Connector",
  label: "TinyRustLM Hosted Memory Connector",
  purpose: "Public-safe live verifier room for TinyRustLM optional hosted memory coordination.",
  creatorAgentId: agentId,
  agentId
}));
JS
)"
  CREATE_ROOM_RESPONSE="$(curl_json POST "/api/matm/meeting-rooms" "$create_room_payload")"
  ROOM_ID="$("$NODE_BIN" - "$CREATE_ROOM_RESPONSE" <<'JS'
const payload = JSON.parse(process.argv[2]);
const id = payload.roomId || payload.canonicalRoomId || payload.id || payload?.room?.roomId || payload?.room?.id || "";
process.stdout.write(id);
JS
)"
  if [[ -n "$ROOM_ID" ]]; then
    meeting_room_created=true
  fi
fi

if [[ -z "$ROOM_ID" ]]; then
  write_report "fail" "workspace_id_present=true" "workspace_key_present=true" "error=meeting_room_not_found"
  echo "MemoryEndpoints live verification failed: meeting room id was not resolved. Report: $REPORT_OUTPUT" >&2
  exit 1
fi

meeting_message_payload="$("$NODE_BIN" - "$WORKSPACE_ID" "$ROOM_ID" "$AGENT_ID" "$MEETING_MARKER" <<'JS'
const [workspaceId, roomId, agentId, marker] = process.argv.slice(2);
console.log(JSON.stringify({
  workspaceId,
  roomId,
  senderAgentId: agentId,
  safeSummary: `TinyRustLM public-safe meeting transcript probe ${marker}.`
}));
JS
)"
curl_json POST "/api/matm/meeting-messages" "$meeting_message_payload" >/dev/null

urlencode() {
  "$NODE_BIN" -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"
}

search_memory_type() {
  local memory_type="$1"
  local query
  query="?workspaceId=$(urlencode "$WORKSPACE_ID")&agentId=$(urlencode "$AGENT_ID")&actor_agent_id=$(urlencode "$AGENT_ID")&query=$(urlencode "$MARKER")&scope=$(urlencode "$SCOPE")&scopeId=$(urlencode "$SCOPE_ID")&memory_type=$(urlencode "$memory_type")&limit=10"
  for ((attempt=1; attempt<=SEARCH_RETRIES; attempt++)); do
    local response
    response="$(curl_json GET "/api/matm/search$query")"
    if [[ "$response" == *"$MARKER"* ]]; then
      printf '%s' "$response"
      return 0
    fi
    if [[ "$attempt" -lt "$SEARCH_RETRIES" ]]; then
      sleep "$RETRY_DELAY_SECONDS"
    fi
  done
  printf '[]'
}

STATUS_RESPONSE="$(search_memory_type status)"
HANDOFF_RESPONSE="$(search_memory_type handoff)"
TRANSCRIPT_QUERY="?roomId=$(urlencode "$ROOM_ID")&limit=10&agent_id=$(urlencode "$AGENT_ID")"
TRANSCRIPT_RESPONSE="$(curl_json GET "/api/matm/meeting-messages$TRANSCRIPT_QUERY")"

status_found=false
handoff_found=false
status_excluded_long=true
handoff_excluded_short=true
[[ "$STATUS_RESPONSE" == *"$SHORT_MARKER"* ]] && status_found=true
[[ "$HANDOFF_RESPONSE" == *"$LONG_MARKER"* ]] && handoff_found=true
[[ "$STATUS_RESPONSE" == *"$LONG_MARKER"* ]] && status_excluded_long=false
[[ "$HANDOFF_RESPONSE" == *"$SHORT_MARKER"* ]] && handoff_excluded_short=false

TRANSCRIPT_RESULT="$("$NODE_BIN" - "$TRANSCRIPT_RESPONSE" "$MEETING_MARKER" <<'JS'
const [json, marker] = process.argv.slice(2);
const payload = JSON.parse(json);
const items = Array.isArray(payload?.items) ? payload.items : [];
const text = JSON.stringify(payload);
const found = text.includes(marker);
const exposureClear = !/"rawCredentialExposed"\s*:\s*true/.test(text) && !/"rawPayloadExposed"\s*:\s*true/.test(text);
const liveShape = items.some((item) => item && item.meetingMessageId && item.safeSummary && item.senderAgentId);
console.log(JSON.stringify({ count: items.length, found, exposureClear, liveShape }));
JS
)"
transcript_count="$("$NODE_BIN" -e 'const v=JSON.parse(process.argv[1]); console.log(v.count)' "$TRANSCRIPT_RESULT")"
transcript_found="$("$NODE_BIN" -e 'const v=JSON.parse(process.argv[1]); console.log(v.found ? "true" : "false")' "$TRANSCRIPT_RESULT")"
transcript_exposure_clear="$("$NODE_BIN" -e 'const v=JSON.parse(process.argv[1]); console.log(v.exposureClear ? "true" : "false")' "$TRANSCRIPT_RESULT")"
transcript_live_shape="$("$NODE_BIN" -e 'const v=JSON.parse(process.argv[1]); console.log(v.liveShape ? "true" : "false")' "$TRANSCRIPT_RESULT")"

status="fail"
if [[ "$status_found" == true && "$handoff_found" == true && "$status_excluded_long" == true && "$handoff_excluded_short" == true && "$transcript_found" == true && "$transcript_exposure_clear" == true && "$transcript_live_shape" == true ]]; then
  status="pass"
fi

write_report "$status" \
  "workspace_id_present=true" \
  "workspace_key_present=true" \
  "registered_agent=true" \
  "short_term_saved=true" \
  "long_term_saved=true" \
  "meeting_room_found=$meeting_room_found" \
  "meeting_room_created=$meeting_room_created" \
  "meeting_message_posted=true" \
  "transcript_result_count=$transcript_count" \
  "transcript_probe_found=$transcript_found" \
  "transcript_items_shape=$([[ "$transcript_live_shape" == true ]] && echo items || echo unknown)" \
  "transcript_exposure_flags_clear=$transcript_exposure_clear" \
  "status_search_found_short_term=$status_found" \
  "handoff_search_found_long_term=$handoff_found" \
  "status_search_excluded_long_term_marker=$status_excluded_long" \
  "handoff_search_excluded_short_term_marker=$handoff_excluded_short"

if [[ "$status" != "pass" ]]; then
  echo "MemoryEndpoints live verification failed. Report: $REPORT_OUTPUT" >&2
  exit 1
fi

echo "MemoryEndpoints live verification passed. Report: $REPORT_OUTPUT"
