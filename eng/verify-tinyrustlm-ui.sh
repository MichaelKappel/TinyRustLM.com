#!/usr/bin/env bash
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${1:-$REPO_ROOT/tinyrustlm}"
PORT="${2:-8184}"
DEBUG_PORT="${3:-9442}"
REPORT_OUTPUT="${4:-$REPO_ROOT/artifacts/reports/tinyrustlm-ui-verification.json}"
RUN_BROWSER_SMOKE="${RUN_BROWSER_SMOKE:-0}"
RUN_DEEP_BROWSER_SMOKE="${RUN_DEEP_BROWSER_SMOKE:-0}"
TINYRUSTLM_BROWSER_SMOKE_MODES="${TINYRUSTLM_BROWSER_SMOKE_MODES:-}"
BROWSER_SMOKE_TIMEOUT_SECONDS="${BROWSER_SMOKE_TIMEOUT_SECONDS:-1800}"
RUN_VISUAL_LOCK="${RUN_VISUAL_LOCK:-0}"
VISUAL_LOCK_BASELINE="${VISUAL_LOCK_BASELINE:-$REPO_ROOT/tinyrustlm/artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json}"
VISUAL_LOCK_OUTPUT_DIR="${VISUAL_LOCK_OUTPUT_DIR:-$REPO_ROOT/artifacts/reports/ui-lock-verification}"
VISUAL_LOCK_DEBUG_PORT="${VISUAL_LOCK_DEBUG_PORT:-$((DEBUG_PORT + 700))}"
STANDARD_BROWSER_SMOKE_MODES=(
  "source-options-ui"
  "assistant-quality"
  "multi-turn-context"
  "assistant-prompt-cards"
  "model-malformed"
  "local-memory-deck-ui"
  "hf-search-ui"
  "local-connect-approval-ui"
  "local-connect-endpoint-ui"
  "local-connect-rust-endpoint-ui"
  "memory-endpoints-outbox"
  "memory-endpoints-offline-ui"
  "memory-endpoints-reconnect-ui"
  "memory-endpoints-distributed"
  "memory-endpoints-ui"
  "memory-endpoints-adversarial-ui"
  "peer-status-live-ui"
)
LIVE_BROWSER_SMOKE_MODES=(
  "memory-endpoints-cors-ui"
  "memory-endpoints-relay-ui"
  "memory-endpoints-relay-live"
  "memory-endpoints-live"
)
DEFAULT_DEEP_BROWSER_SMOKE_MODES=(
  "hf-conversion-kit-safetensors-exec"
  "hf-conversion-kit-review-exec"
  "hf-conversion-kit-review-reject-exec"
  "hf-conversion-kit-gguf-exec"
  "hf-p2p-import-kit-exec"
)
DEEP_BROWSER_SMOKE_MODES=("${DEFAULT_DEEP_BROWSER_SMOKE_MODES[@]}")
KNOWN_BROWSER_SMOKE_MODES=("${STANDARD_BROWSER_SMOKE_MODES[@]}" "${DEEP_BROWSER_SMOKE_MODES[@]}" "${LIVE_BROWSER_SMOKE_MODES[@]}")
BROWSER_SMOKE_MODES=()
DEEP_BROWSER_SMOKE_SELECTED_MODES=()
BROWSER_SMOKE_REPORT="$REPO_ROOT/artifacts/reports/tinyrustlm-source-options-ui-smoke.json"
SERVER_STDOUT="$REPO_ROOT/artifacts/reports/tinyrustlm-ui-server-$PORT.out.log"
SERVER_STDERR="$REPO_ROOT/artifacts/reports/tinyrustlm-ui-server-$PORT.err.log"
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
NODE_UI_LOCK_SCRIPT="$REPO_ROOT/tinyrustlm/tools/capture-ui-lock.js"
VISUAL_LOCK_BASELINE_ARG="$VISUAL_LOCK_BASELINE"
VISUAL_LOCK_OUTPUT_DIR_ARG="$VISUAL_LOCK_OUTPUT_DIR"
if [[ "$NODE_BIN" == *".exe" ]] && command -v wslpath >/dev/null 2>&1; then
  NODE_BROWSER_SMOKE_SCRIPT="$(wslpath -w "$NODE_BROWSER_SMOKE_SCRIPT")"
  NODE_UI_LOCK_SCRIPT="$(wslpath -w "$NODE_UI_LOCK_SCRIPT")"
  VISUAL_LOCK_BASELINE_ARG="$(wslpath -w "$VISUAL_LOCK_BASELINE")"
  VISUAL_LOCK_OUTPUT_DIR_ARG="$(wslpath -w "$VISUAL_LOCK_OUTPUT_DIR")"
fi

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

contains_mode() {
  local needle="$1"
  shift
  local candidate
  for candidate in "$@"; do
    if [[ "$candidate" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

if [[ -n "$TINYRUSTLM_BROWSER_SMOKE_MODES" ]]; then
  IFS=',' read -r -a requested_modes <<< "$TINYRUSTLM_BROWSER_SMOKE_MODES"
  for raw_mode in "${requested_modes[@]}"; do
    mode="$(trim "$raw_mode")"
    if [[ -n "$mode" ]]; then
      BROWSER_SMOKE_MODES+=("$mode")
    fi
  done
else
  if [[ "$RUN_BROWSER_SMOKE" == "1" || "$RUN_DEEP_BROWSER_SMOKE" == "1" ]]; then
    BROWSER_SMOKE_MODES+=("${STANDARD_BROWSER_SMOKE_MODES[@]}")
  fi
  if [[ "$RUN_DEEP_BROWSER_SMOKE" == "1" ]]; then
    BROWSER_SMOKE_MODES+=("${DEFAULT_DEEP_BROWSER_SMOKE_MODES[@]}")
  fi
fi
for mode in "${BROWSER_SMOKE_MODES[@]}"; do
  if ! contains_mode "$mode" "${KNOWN_BROWSER_SMOKE_MODES[@]}"; then
    echo "Unknown TinyRustLM browser smoke mode '$mode'. Known modes: ${KNOWN_BROWSER_SMOKE_MODES[*]}" >&2
    exit 1
  fi
  if contains_mode "$mode" "${DEEP_BROWSER_SMOKE_MODES[@]}"; then
    DEEP_BROWSER_SMOKE_SELECTED_MODES+=("$mode")
  fi
done
BROWSER_SMOKE_REQUESTED="0"
if [[ "${#BROWSER_SMOKE_MODES[@]}" -gt 0 ]]; then
  BROWSER_SMOKE_REQUESTED="1"
fi
DEEP_BROWSER_SMOKE_REQUESTED="0"
if [[ "${#DEEP_BROWSER_SMOKE_SELECTED_MODES[@]}" -gt 0 ]]; then
  DEEP_BROWSER_SMOKE_REQUESTED="1"
fi

STATIC_STATUS="not_run"
HTTP_STATUS="not_run"
BROWSER_STATUS="skipped"
if [[ "$BROWSER_SMOKE_REQUESTED" == "1" ]]; then
  BROWSER_STATUS="not_run"
fi
VISUAL_LOCK_STATUS="skipped"
if [[ "$RUN_VISUAL_LOCK" == "1" ]]; then
  VISUAL_LOCK_STATUS="not_run"
fi
STATIC_OUTPUT=""
HTTP_OUTPUT=""
VISUAL_LOCK_OUTPUT=""
ERROR_MESSAGE=""
SERVER_PID=""
VISUAL_LOCK_REPORT="$VISUAL_LOCK_OUTPUT_DIR/tinyrustlm-ui-lock-report.json"
declare -A BROWSER_SMOKE_STATUS_BY_MODE
for mode in "${BROWSER_SMOKE_MODES[@]}"; do
  if [[ "$BROWSER_SMOKE_REQUESTED" == "1" ]]; then
    BROWSER_SMOKE_STATUS_BY_MODE["$mode"]="not_run"
  else
    BROWSER_SMOKE_STATUS_BY_MODE["$mode"]="skipped"
  fi
done

join_browser_smoke_modes() {
  local IFS=","
  printf '%s' "${BROWSER_SMOKE_MODES[*]}"
}

join_deep_browser_smoke_modes() {
  local IFS=","
  printf '%s' "${DEEP_BROWSER_SMOKE_SELECTED_MODES[*]}"
}

join_browser_smoke_statuses() {
  local output=""
  local mode
  for mode in "${BROWSER_SMOKE_MODES[@]}"; do
    if [[ -n "$output" ]]; then
      output+=";"
    fi
    output+="$mode=${BROWSER_SMOKE_STATUS_BY_MODE[$mode]}"
  done
  printf '%s' "$output"
}

write_report() {
  local status="$1"
  python3 - "$REPORT_OUTPUT" "$status" "$REPO_ROOT" "$ROOT" "$PORT" "$DEBUG_PORT" "$BROWSER_SMOKE_REQUESTED" "$BROWSER_SMOKE_TIMEOUT_SECONDS" "$DEEP_BROWSER_SMOKE_REQUESTED" "$STATIC_STATUS" "$HTTP_STATUS" "$BROWSER_STATUS" "$(join_browser_smoke_modes)" "$(join_deep_browser_smoke_modes)" "$(join_browser_smoke_statuses)" "$BROWSER_SMOKE_REPORT" "$VISUAL_LOCK_STATUS" "$RUN_VISUAL_LOCK" "$VISUAL_LOCK_BASELINE" "$VISUAL_LOCK_REPORT" "$VISUAL_LOCK_DEBUG_PORT" "$VISUAL_LOCK_OUTPUT" "$SERVER_STDOUT" "$SERVER_STDERR" "$ERROR_MESSAGE" "$STATIC_OUTPUT" "$HTTP_OUTPUT" <<'PY'
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
    browser_smoke_requested,
    browser_smoke_timeout_seconds,
    deep_browser_smoke_requested,
    static_status,
    http_status,
    browser_status,
    browser_modes_csv,
    deep_browser_modes_csv,
    browser_statuses_csv,
    browser_report,
    visual_lock_status,
    run_visual_lock,
    visual_lock_baseline,
    visual_lock_report,
    visual_lock_debug_port,
    visual_lock_output,
    server_stdout,
    server_stderr,
    error_message,
    static_output,
    http_output,
) = sys.argv[1:28]

browser_modes = [mode for mode in browser_modes_csv.split(",") if mode] if browser_smoke_requested == "1" else []
deep_browser_modes = [mode for mode in deep_browser_modes_csv.split(",") if mode] if deep_browser_smoke_requested == "1" else []
browser_statuses = {}
for entry in [part for part in browser_statuses_csv.split(";") if part]:
    mode, _, mode_status = entry.partition("=")
    if mode:
        browser_statuses[mode] = mode_status
browser_report_paths = {
    mode: os.path.abspath(os.path.join(repo_root, "artifacts", "reports", f"tinyrustlm-{mode}-smoke.json"))
    for mode in browser_modes
}
browser_debug_ports = {
    mode: int(debug_port) + index
    for index, mode in enumerate(browser_modes)
}

report = {
    "schema": "tinyrustlm.ui_verification.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "repository_root": os.path.abspath(repo_root),
    "app_root": os.path.abspath(root),
    "local_server_url": f"http://127.0.0.1:{port}/app/",
    "static_harness_status": static_status,
    "http_harness_status": http_status,
    "browser_smoke_requested": browser_smoke_requested == "1",
    "browser_smoke_timeout_seconds": int(browser_smoke_timeout_seconds),
    "deep_browser_smoke_requested": deep_browser_smoke_requested == "1",
    "deep_browser_smoke_modes": deep_browser_modes,
    "browser_smoke_status": browser_status,
    "browser_smoke_mode": ",".join(browser_modes),
    "browser_smoke_modes": browser_modes,
    "browser_smoke_statuses": browser_statuses if browser_smoke_requested == "1" else {},
    "browser_debug_port": int(debug_port),
    "browser_debug_ports": browser_debug_ports if browser_smoke_requested == "1" else {},
    "static_harness_output": static_output,
    "http_harness_output": http_output,
    "browser_smoke_report_path": browser_report_paths.get(browser_modes[0], "") if browser_modes else "",
    "browser_smoke_report_paths": browser_report_paths if browser_smoke_requested == "1" else {},
    "visual_lock_requested": run_visual_lock == "1",
    "visual_lock_status": visual_lock_status,
    "visual_lock_baseline": os.path.abspath(visual_lock_baseline) if run_visual_lock == "1" else "",
    "visual_lock_report_path": os.path.abspath(visual_lock_report) if run_visual_lock == "1" else "",
    "visual_lock_debug_port": int(visual_lock_debug_port) if run_visual_lock == "1" else 0,
    "visual_lock_output": visual_lock_output,
    "server_stdout_path": os.path.abspath(server_stdout),
    "server_stderr_path": os.path.abspath(server_stderr),
    "error": error_message,
}
os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(f"TinyRustLM UI verification report written to {report_output}")
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
  if [[ "$VISUAL_LOCK_STATUS" == "running" ]]; then
    VISUAL_LOCK_STATUS="fail"
  fi
  write_report "fail"
  echo "$ERROR_MESSAGE" >&2
  exit 1
}

run_checked() {
  local label="$1"
  shift
  local output
  if ! output="$("$@" 2>&1)"; then
    fail "$label failed: $output"
  fi
  printf '%s' "$output"
}

mkdir -p "$(dirname "$REPORT_OUTPUT")"

if [[ -z "$CARGO_BIN" ]]; then
  fail "cargo was not found on PATH"
fi
if [[ "$BROWSER_SMOKE_REQUESTED" == "1" && -z "$NODE_BIN" ]]; then
  fail "node was not found on PATH"
fi
if [[ "$RUN_VISUAL_LOCK" == "1" && -z "$NODE_BIN" ]]; then
  fail "node was not found on PATH"
fi
if ! [[ "$BROWSER_SMOKE_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]]; then
  fail "BROWSER_SMOKE_TIMEOUT_SECONDS must be zero or greater"
fi
if [[ "$RUN_VISUAL_LOCK" == "1" && ! -f "$VISUAL_LOCK_BASELINE" ]]; then
  fail "TinyRustLM visual lock baseline was not found: $VISUAL_LOCK_BASELINE"
fi

STATIC_OUTPUT="$(run_checked "TinyRustLM static browser harness" "$CARGO_BIN" run -p tinyrustlm-browser-harness -- "$CARGO_ROOT")"
STATIC_STATUS="pass"

rm -f "$SERVER_STDOUT" "$SERVER_STDERR"
"$CARGO_BIN" run -p tinyrustlm-local-server -- "$CARGO_ROOT" "$PORT" >"$SERVER_STDOUT" 2>"$SERVER_STDERR" &
SERVER_PID="$!"

READY="0"
for _ in $(seq 1 80); do
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    fail "tinyrustlm-local-server exited early"
  fi
  if [[ "$CARGO_BIN" == *".exe" ]] && command -v powershell.exe >/dev/null 2>&1; then
    if powershell.exe -NoProfile -Command "try { \$response = Invoke-WebRequest -Uri 'http://127.0.0.1:$PORT/app/' -UseBasicParsing -TimeoutSec 2; if (\$response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >/dev/null 2>&1; then
      READY="1"
      break
    fi
  elif python3 - "$PORT" <<'PY' >/dev/null 2>&1
import sys
import urllib.request
with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/app/", timeout=2) as response:
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

HTTP_OUTPUT="$(run_checked "TinyRustLM HTTP browser harness" "$CARGO_BIN" run -p tinyrustlm-browser-harness -- "$CARGO_ROOT" --http "http://127.0.0.1:$PORT/app/")"
HTTP_STATUS="pass"

if [[ "$RUN_VISUAL_LOCK" == "1" ]]; then
  rm -rf "$VISUAL_LOCK_OUTPUT_DIR"
  mkdir -p "$VISUAL_LOCK_OUTPUT_DIR"
  VISUAL_LOCK_STATUS="running"
  VISUAL_LOCK_OUTPUT="$(run_checked "TinyRustLM visual lock" "$NODE_BIN" "$NODE_UI_LOCK_SCRIPT" "http://127.0.0.1:$PORT/app/" "$VISUAL_LOCK_OUTPUT_DIR_ARG" "$VISUAL_LOCK_DEBUG_PORT" "$VISUAL_LOCK_BASELINE_ARG")"
  VISUAL_LOCK_STATUS="pass"
fi

if [[ "$BROWSER_SMOKE_REQUESTED" == "1" ]]; then
  BROWSER_STATUS="not_run"
  for index in "${!BROWSER_SMOKE_MODES[@]}"; do
    mode="${BROWSER_SMOKE_MODES[$index]}"
    mode_debug_port=$((DEBUG_PORT + index))
    mode_report="$REPO_ROOT/artifacts/reports/tinyrustlm-$mode-smoke.json"
    smoke_model="tinylm16q8"
    if [[ "$mode" == "assistant-quality" || "$mode" == "multi-turn-context" || "$mode" == "assistant-prompt-cards" ]]; then
      smoke_model="smollm2q4"
    elif [[ "$mode" == "memory-endpoints-ui" || "$mode" == "memory-endpoints-adversarial-ui" ]]; then
      smoke_model="smollm2q8"
    fi
    rm -f "$mode_report"
    if [[ "$BROWSER_SMOKE_TIMEOUT_SECONDS" != "0" ]] && command -v timeout >/dev/null 2>&1; then
      timeout "$BROWSER_SMOKE_TIMEOUT_SECONDS" "$NODE_BIN" "$NODE_BROWSER_SMOKE_SCRIPT" "http://127.0.0.1:$PORT/app/" "$mode_debug_port" "$smoke_model" "$mode" >"$mode_report" 2>&1
      smoke_exit=$?
    else
      "$NODE_BIN" "$NODE_BROWSER_SMOKE_SCRIPT" "http://127.0.0.1:$PORT/app/" "$mode_debug_port" "$smoke_model" "$mode" >"$mode_report" 2>&1
      smoke_exit=$?
    fi
    if [[ "$smoke_exit" -ne 0 ]]; then
      BROWSER_STATUS="fail"
      BROWSER_SMOKE_STATUS_BY_MODE["$mode"]="fail"
      if [[ "$smoke_exit" -eq 124 ]]; then
        echo "$mode browser smoke timed out after $BROWSER_SMOKE_TIMEOUT_SECONDS seconds" >>"$mode_report"
        ERROR_MESSAGE="$mode browser smoke timed out after $BROWSER_SMOKE_TIMEOUT_SECONDS seconds; see $mode_report"
      else
        ERROR_MESSAGE="$mode browser smoke failed; see $mode_report"
      fi
      write_report "fail"
      cat "$mode_report" >&2
      exit 1
    fi
    BROWSER_SMOKE_STATUS_BY_MODE["$mode"]="pass"
  done
  BROWSER_STATUS="pass"
fi

write_report "pass"
echo "TinyRustLM UI verification passed."
