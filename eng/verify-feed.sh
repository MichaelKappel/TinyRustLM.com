#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NUGET_SOURCE="${1:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
PACKAGE_VERSION="${2:-$("$REPO_ROOT/eng/get-package-version.sh")}"
MODEL_PATH="${3:-$REPO_ROOT/tinyrustlm/models/tiny-test-model.slm}"
REPORT_OUTPUT="${4:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-feed-smoke.json}"

write_feed_smoke_report() {
  local status="$1"
  local error_message="$2"
  local consumer_output="${3:-}"
  python3 - "$REPORT_OUTPUT" "$status" "$error_message" "$NUGET_SOURCE" "$PACKAGE_VERSION" "$MODEL_PATH" "$consumer_output" <<'PY'
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

report_output, status, error_message, nuget_source, package_version, model_path, consumer_output = sys.argv[1:8]
consumer_excerpt = " ".join(consumer_output.split())[:1000]
report = {
    "schema": "tinyrustlm.nuget.feed_smoke.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "nuget_source": nuget_source,
    "package_version": package_version,
    "model_path": model_path,
    "secret_material_included": False,
    "local_piece_assembly_verified": "consumer-smoke-assembled.slm" in consumer_output,
    "consumer_output_sha256": hashlib.sha256(consumer_output.encode("utf-8")).hexdigest() if consumer_output else "",
    "consumer_output_excerpt": consumer_excerpt,
    "error_message": error_message,
}

os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(f"TinyRustLM NuGet feed smoke report written to {report_output}")
PY
}

consumer_output=""
if consumer_output="$("$REPO_ROOT/eng/verify-consumer.sh" "$NUGET_SOURCE" "$MODEL_PATH" "$PACKAGE_VERSION" 2>&1)"; then
  printf '%s\n' "$consumer_output"
  write_feed_smoke_report "pass" "" "$consumer_output"
  echo "TinyRustLM published feed verification passed: $NUGET_SOURCE @ $PACKAGE_VERSION"
else
  exit_code=$?
  printf '%s\n' "$consumer_output" >&2
  error_message="$(printf '%s' "$consumer_output" | tr '\r\n' ' ' | sed -E 's/[[:space:]]+/ /g' | cut -c 1-1000)"
  if [[ -z "$error_message" ]]; then
    error_message="verify-consumer.sh failed with exit code $exit_code"
  else
    error_message="verify-consumer.sh failed with exit code $exit_code: $error_message"
  fi
  write_feed_smoke_report "fail" "$error_message" "$consumer_output"
  exit "$exit_code"
fi
