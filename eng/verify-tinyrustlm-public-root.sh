#!/usr/bin/env bash
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ROOT="$REPO_ROOT/tinyrustlm"
DEFAULT_REPORT_OUTPUT="$REPO_ROOT/artifacts/reports/tinyrustlm-public-root-verification.json"
if [[ "$#" -eq 1 && "$1" == *.json ]]; then
  ROOT="$DEFAULT_ROOT"
  PORT="8186"
  DEBUG_PORT="9550"
  REPORT_OUTPUT="$1"
else
  ROOT="${1:-$DEFAULT_ROOT}"
  PORT="${2:-8186}"
  DEBUG_PORT="${3:-9550}"
  REPORT_OUTPUT="${4:-$DEFAULT_REPORT_OUTPUT}"
fi
PUBLIC_ROOT_SMOKE_MODES=(
  "public-local-only"
  "catalog-local-import"
  "local-import-ambiguous-selection"
  "peer-url-unsafe-ui"
  "local-memory-deck-ui"
  "local-connect-approval-ui"
  "local-connect-endpoint-ui"
  "local-connect-rust-endpoint-ui"
  "peer-status-live-ui"
)
SERVER_STDOUT="$REPO_ROOT/artifacts/reports/tinyrustlm-public-root-server-$PORT.out.log"
SERVER_STDERR="$REPO_ROOT/artifacts/reports/tinyrustlm-public-root-server-$PORT.err.log"
PUBLIC_ROOT_URL="http://tinyrustlm.com:$PORT/"

CARGO_BIN="${CARGO_BIN:-cargo}"
if ! command -v "$CARGO_BIN" >/dev/null 2>&1; then
  if command -v cargo.exe >/dev/null 2>&1; then
    CARGO_BIN="cargo.exe"
  else
    CARGO_BIN=""
  fi
fi
NODE_BIN="${NODE_BIN:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  if command -v node.exe >/dev/null 2>&1; then
    NODE_BIN="node.exe"
  else
    NODE_BIN=""
  fi
fi

CARGO_ROOT="$ROOT"
if [[ "$CARGO_BIN" == *".exe" ]] && command -v wslpath >/dev/null 2>&1; then
  CARGO_ROOT="$(wslpath -w "$ROOT")"
fi
NODE_BROWSER_SMOKE_SCRIPT="$REPO_ROOT/tinyrustlm/tools/browser-smoke.js"
if [[ "$NODE_BIN" == *".exe" ]] && command -v wslpath >/dev/null 2>&1; then
  NODE_BROWSER_SMOKE_SCRIPT="$(wslpath -w "$NODE_BROWSER_SMOKE_SCRIPT")"
fi

SERVER_PID=""
ERROR_MESSAGE=""
declare -A PUBLIC_ROOT_SMOKE_STATUS_BY_MODE
for mode in "${PUBLIC_ROOT_SMOKE_MODES[@]}"; do
  PUBLIC_ROOT_SMOKE_STATUS_BY_MODE["$mode"]="not_run"
done

join_smoke_modes() {
  local IFS=","
  printf '%s' "${PUBLIC_ROOT_SMOKE_MODES[*]}"
}

join_smoke_statuses() {
  local output=""
  local mode
  for mode in "${PUBLIC_ROOT_SMOKE_MODES[@]}"; do
    if [[ -n "$output" ]]; then
      output+=";"
    fi
    output+="$mode=${PUBLIC_ROOT_SMOKE_STATUS_BY_MODE[$mode]}"
  done
  printf '%s' "$output"
}

write_report() {
  local status="$1"
  python3 - "$REPORT_OUTPUT" "$status" "$REPO_ROOT" "$ROOT" "$PORT" "$DEBUG_PORT" "$PUBLIC_ROOT_URL" "$(join_smoke_modes)" "$(join_smoke_statuses)" "$SERVER_STDOUT" "$SERVER_STDERR" "$ERROR_MESSAGE" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

(
    report_output,
    status,
    repo_root,
    root,
    port,
    debug_port,
    public_root_url,
    smoke_modes_csv,
    smoke_statuses_csv,
    server_stdout,
    server_stderr,
    error_message,
) = sys.argv[1:13]

smoke_modes = [mode for mode in smoke_modes_csv.split(",") if mode]
smoke_statuses = {}
for entry in [part for part in smoke_statuses_csv.split(";") if part]:
    mode, _, mode_status = entry.partition("=")
    if mode:
        smoke_statuses[mode] = mode_status
smoke_report_paths = {
    mode: os.path.abspath(os.path.join(repo_root, "artifacts", "reports", f"tinyrustlm-public-root-{mode}-smoke.json"))
    for mode in smoke_modes
}
browser_debug_ports = {
    mode: int(debug_port) + index
    for index, mode in enumerate(smoke_modes)
}

report = {
    "schema": "tinyrustlm.public_root_verification.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "repository_root": os.path.abspath(repo_root),
    "app_root": os.path.abspath(root),
    "local_server_url": f"http://127.0.0.1:{port}/",
    "public_root_url": public_root_url,
    "public_host_mapping": "tinyrustlm.com-loopback-browser-smoke",
    "smoke_modes": smoke_modes,
    "smoke_statuses": smoke_statuses,
    "smoke_report_paths": smoke_report_paths,
    "browser_debug_ports": browser_debug_ports,
    "server_stdout_path": os.path.abspath(server_stdout),
    "server_stderr_path": os.path.abspath(server_stderr),
    "error": error_message,
}
os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(f"TinyRustLM public-root verification report written to {report_output}")
PY
}

finish() {
  local exit_code=$?
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}
trap finish EXIT

fail() {
  ERROR_MESSAGE="$1"
  write_report "fail"
  echo "$ERROR_MESSAGE" >&2
  exit 1
}

if [[ -z "$CARGO_BIN" ]]; then
  fail "cargo was not found on PATH"
fi
if [[ -z "$NODE_BIN" ]]; then
  fail "node was not found on PATH"
fi

mkdir -p "$(dirname "$REPORT_OUTPUT")"
rm -f "$SERVER_STDOUT" "$SERVER_STDERR"
"$CARGO_BIN" run -p tinyrustlm-local-server -- "$CARGO_ROOT" "$PORT" >"$SERVER_STDOUT" 2>"$SERVER_STDERR" &
SERVER_PID="$!"

READY="0"
for _ in $(seq 1 80); do
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    fail "tinyrustlm-local-server exited early"
  fi
  if [[ "$CARGO_BIN" == *".exe" ]] && command -v powershell.exe >/dev/null 2>&1; then
    if powershell.exe -NoProfile -Command "try { \$response = Invoke-WebRequest -Uri 'http://127.0.0.1:$PORT/' -UseBasicParsing -TimeoutSec 2; if (\$response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >/dev/null 2>&1; then
      READY="1"
      break
    fi
  elif python3 - "$PORT" <<'PY' >/dev/null 2>&1
import sys
import urllib.request
with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/", timeout=2) as response:
    if response.status != 200:
        raise SystemExit(1)
PY
  then
    READY="1"
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  fail "tinyrustlm-local-server did not become ready on port $PORT"
fi

for index in "${!PUBLIC_ROOT_SMOKE_MODES[@]}"; do
  mode="${PUBLIC_ROOT_SMOKE_MODES[$index]}"
  mode_debug_port=$((DEBUG_PORT + index))
  mode_report="$REPO_ROOT/artifacts/reports/tinyrustlm-public-root-$mode-smoke.json"
  rm -f "$mode_report"
  if ! "$NODE_BIN" "$NODE_BROWSER_SMOKE_SCRIPT" "$PUBLIC_ROOT_URL" "$mode_debug_port" tinylm16q8 "$mode" >"$mode_report" 2>&1; then
    PUBLIC_ROOT_SMOKE_STATUS_BY_MODE["$mode"]="fail"
    ERROR_MESSAGE="public-root $mode browser smoke failed; see $mode_report"
    write_report "fail"
    cat "$mode_report" >&2
    exit 1
  fi
  PUBLIC_ROOT_SMOKE_STATUS_BY_MODE["$mode"]="pass"
done

write_report "pass"
echo "TinyRustLM public-root verification passed."
