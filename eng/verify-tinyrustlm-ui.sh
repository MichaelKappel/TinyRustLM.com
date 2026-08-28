#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${TINYRUSTLM_ROOT:-$REPO_ROOT/tinyrustlm}"
REPORT_OUTPUT="${TINYRUSTLM_UI_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-ui-verification.json}"
RUN_BROWSER_SMOKE="${RUN_BROWSER_SMOKE:-0}"
RUN_DEEP_ACQUISITION="${RUN_DEEP_ACQUISITION:-0}"
RUN_VISUAL_LOCK="${RUN_VISUAL_LOCK:-0}"
VISUAL_LOCK_BASELINE="${VISUAL_LOCK_BASELINE:-$REPO_ROOT/tinyrustlm/artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(python3 -c 'import secrets; print(secrets.token_hex(6))')"
SYSTEM_TEMP="$(python3 -c 'import tempfile; print(tempfile.gettempdir())')"
EVIDENCE_ROOT="$SYSTEM_TEMP/tinyrustlm-ui-verification/$RUN_ID"
WEB_RELEASE_ROOT="$EVIDENCE_ROOT/web-release"
VISUAL_ROOT="$EVIDENCE_ROOT/visual-lock"

declare -A GATES=(
  [static_contract]="not_run"
  [javascript_syntax]="not_run"
  [browser_contracts]="skipped"
  [chromium_release]="skipped"
  [acquisition_browser_bridge]="skipped"
  [acquisition_companion]="skipped"
  [acquisition_converter]="skipped"
  [visual_lock]="skipped"
)
ERROR_MESSAGE=""
VISUAL_SERVER_PID=""

if [[ "$RUN_BROWSER_SMOKE" == "1" || "$RUN_DEEP_ACQUISITION" == "1" ]]; then
  GATES[browser_contracts]="not_run"
  GATES[chromium_release]="not_run"
fi
if [[ "$RUN_DEEP_ACQUISITION" == "1" ]]; then
  GATES[acquisition_browser_bridge]="not_run"
  GATES[acquisition_companion]="not_run"
  GATES[acquisition_converter]="not_run"
fi
if [[ "$RUN_VISUAL_LOCK" == "1" ]]; then
  GATES[visual_lock]="not_run"
fi

write_report() {
  local status="$1"
  local gates_json
  gates_json="$(python3 - "${GATES[static_contract]}" "${GATES[javascript_syntax]}" "${GATES[browser_contracts]}" "${GATES[chromium_release]}" "${GATES[acquisition_browser_bridge]}" "${GATES[acquisition_companion]}" "${GATES[acquisition_converter]}" "${GATES[visual_lock]}" <<'PY'
import json, sys
names = ["static_contract", "javascript_syntax", "browser_contracts", "chromium_release", "acquisition_browser_bridge", "acquisition_companion", "acquisition_converter", "visual_lock"]
print(json.dumps(dict(zip(names, sys.argv[1:]))))
PY
)"
  python3 - "$REPORT_OUTPUT" "$status" "$REPO_ROOT" "$ROOT" "$RUN_ID" "$RUN_BROWSER_SMOKE" "$RUN_DEEP_ACQUISITION" "$RUN_VISUAL_LOCK" "$EVIDENCE_ROOT" "$WEB_RELEASE_ROOT" "$VISUAL_ROOT" "$gates_json" "$ERROR_MESSAGE" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone
report_path, status, repo, root, run_id, browser, deep, visual, evidence, web, visual_root, gates, error = sys.argv[1:]
report = {
    "schema": "tinyrustlm.ui_verification.v1",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "run_id": run_id,
    "status": status,
    "repository_root": os.path.abspath(repo),
    "app_root": os.path.abspath(root),
    "browser_smoke_requested": browser == "1" or deep == "1",
    "deep_acquisition_requested": deep == "1",
    "visual_lock_requested": visual == "1",
    "gates": json.loads(gates),
    "evidence": {
        "root": os.path.abspath(evidence),
        "web_release": os.path.abspath(web) if browser == "1" or deep == "1" else "",
        "visual_lock": os.path.abspath(visual_root) if visual == "1" else "",
    },
    "error": error,
}
os.makedirs(os.path.dirname(report_path), exist_ok=True)
fd, temporary = tempfile.mkstemp(prefix=os.path.basename(report_path) + ".", suffix=".tmp", dir=os.path.dirname(report_path))
try:
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, report_path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY
}

fail() {
  ERROR_MESSAGE="$1"
  for gate in static_contract javascript_syntax browser_contracts chromium_release acquisition_browser_bridge acquisition_companion acquisition_converter visual_lock; do
    if [[ "${GATES[$gate]}" == "not_run" ]]; then
      GATES[$gate]="fail"
      break
    fi
  done
  write_report fail
  echo "$ERROR_MESSAGE" >&2
  exit 1
}

cleanup() {
  if [[ -n "$VISUAL_SERVER_PID" ]] && kill -0 "$VISUAL_SERVER_PID" >/dev/null 2>&1; then
    kill "$VISUAL_SERVER_PID" >/dev/null 2>&1 || true
    wait "$VISUAL_SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT
trap 'fail "TinyRustLM UI verification failed at line $LINENO"' ERR
mkdir -p "$EVIDENCE_ROOT"

node "$REPO_ROOT/tinyrustlm/tools/browser-runtime-web-artifact.js" check
node --test \
  "$REPO_ROOT/tinyrustlm/tests/browser-runtime-web-artifact.test.js" \
  "$REPO_ROOT/tinyrustlm/tests/model-runtime-worker.test.js" \
  "$REPO_ROOT/tinyrustlm/tests/static-shell-parity.test.js"
GATES[static_contract]="pass"
node --check "$ROOT/app/app.js"
node --check "$ROOT/app/companion-bridge.js"
node --check "$ROOT/app/model-runtime-worker.js"
node --check "$ROOT/app/model-runtime-client.js"
GATES[javascript_syntax]="pass"

if [[ "$RUN_BROWSER_SMOKE" == "1" || "$RUN_DEEP_ACQUISITION" == "1" ]]; then
  npm --prefix "$REPO_ROOT/tinyrustlm" run test:ui
  GATES[browser_contracts]="pass"
  node "$REPO_ROOT/tinyrustlm/tools/web-release-local-smoke.js" "$WEB_RELEASE_ROOT" "$ROOT"
  GATES[chromium_release]="pass"
fi

if [[ "$RUN_DEEP_ACQUISITION" == "1" ]]; then
  fail "Deep acquisition is unavailable until the clean TinyRustLM companion and complete-composition converter gates are registered."
fi

if [[ "$RUN_VISUAL_LOCK" == "1" ]]; then
  [[ -f "$VISUAL_LOCK_BASELINE" ]] || fail "Visual lock baseline was not found: $VISUAL_LOCK_BASELINE"
  visual_port="${TINYRUSTLM_VISUAL_PORT:-8484}"
  visual_debug_port="${TINYRUSTLM_VISUAL_DEBUG_PORT:-9484}"
  mkdir -p "$VISUAL_ROOT"
  cargo run -p tinyrustlm-local-server -- "$ROOT" "$visual_port" >"$VISUAL_ROOT/server.stdout.log" 2>"$VISUAL_ROOT/server.stderr.log" &
  VISUAL_SERVER_PID="$!"
  ready=0
  for _ in $(seq 1 80); do
    if python3 - "$visual_port" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/app/", timeout=2) as response:
    if response.status != 200:
        raise SystemExit(1)
PY
    then
      ready=1
      break
    fi
    sleep 0.25
  done
  [[ "$ready" == "1" ]] || fail "tinyrustlm-local-server did not become ready for visual verification"
  node "$REPO_ROOT/tinyrustlm/tools/capture-ui-lock.js" "http://127.0.0.1:$visual_port/app/" "$VISUAL_ROOT" "$visual_debug_port" "$VISUAL_LOCK_BASELINE"
  kill "$VISUAL_SERVER_PID" >/dev/null 2>&1 || true
  wait "$VISUAL_SERVER_PID" >/dev/null 2>&1 || true
  VISUAL_SERVER_PID=""
  GATES[visual_lock]="pass"
fi

trap - ERR
write_report pass
echo "TinyRustLM UI verification passed."
