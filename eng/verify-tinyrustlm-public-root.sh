#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${TINYRUSTLM_ROOT:-$REPO_ROOT/tinyrustlm}"
REPORT_OUTPUT="${TINYRUSTLM_PUBLIC_ROOT_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-public-root-verification.json}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(python3 -c 'import secrets; print(secrets.token_hex(6))')"
CHILD_REPORT="$REPO_ROOT/artifacts/reports/public-root-verification/$RUN_ID/ui-verification.json"
STATUS="fail"
ERROR_MESSAGE=""

if TINYRUSTLM_ROOT="$ROOT" TINYRUSTLM_UI_REPORT="$CHILD_REPORT" RUN_BROWSER_SMOKE=1 "$REPO_ROOT/eng/verify-tinyrustlm-ui.sh" &&
   node "$REPO_ROOT/eng/verify-release-report.js" ui "$CHILD_REPORT"; then
  STATUS="pass"
else
  ERROR_MESSAGE="TinyRustLM UI verification failed"
fi

python3 - "$REPORT_OUTPUT" "$STATUS" "$REPO_ROOT" "$ROOT" "$RUN_ID" "$CHILD_REPORT" "$ERROR_MESSAGE" <<'PY'
import hashlib, json, os, sys, tempfile
from datetime import datetime, timezone
report_path, status, repo, root, run_id, child_path, error = sys.argv[1:]
child_sha = ""
if os.path.isfile(child_path):
    with open(child_path, "rb") as handle:
        child_bytes = handle.read()
    child_sha = hashlib.sha256(child_bytes).hexdigest()
    child = json.loads(child_bytes)
    if child.get("schema") != "tinyrustlm.ui_verification.v2" or child.get("status") != "pass":
        status = "fail"
        error = "TinyRustLM UI verification did not produce a passing v2 report"
report = {
    "schema": "tinyrustlm.public_root_verification.v1",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "run_id": run_id,
    "status": status,
    "repository_root": os.path.abspath(repo),
    "app_root": os.path.abspath(root),
    "ui_verification_report": os.path.abspath(child_path),
    "ui_verification_sha256": child_sha,
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

echo "TinyRustLM public-root verification report written to $REPORT_OUTPUT"
if [[ "$STATUS" != "pass" ]]; then
  echo "$ERROR_MESSAGE" >&2
  exit 1
fi
echo "TinyRustLM public-root verification passed."
