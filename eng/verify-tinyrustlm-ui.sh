#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
args=("$REPO_ROOT/tinyrustlm/tools/verify-ui.js")
[[ -z "${TINYRUSTLM_ROOT:-}" ]] || args+=(--root "$TINYRUSTLM_ROOT")
[[ -z "${TINYRUSTLM_UI_REPORT:-}" ]] || args+=(--report "$TINYRUSTLM_UI_REPORT")
[[ -z "${VISUAL_LOCK_BASELINE:-}" ]] || args+=(--visual-baseline "$VISUAL_LOCK_BASELINE")
# Reject misspelled switch values instead of silently skipping a requested gate.
for name in RUN_BROWSER_SMOKE RUN_DEEP_ACQUISITION RUN_VISUAL_LOCK; do
  value="${!name:-0}"
  [[ "$value" == 0 || "$value" == 1 ]] || { echo "Invalid UI verification switch." >&2; exit 1; }
done
[[ "${RUN_BROWSER_SMOKE:-0}" != 1 ]] || args+=(--browser)
[[ "${RUN_DEEP_ACQUISITION:-0}" != 1 ]] || args+=(--deep)
[[ "${RUN_VISUAL_LOCK:-0}" != 1 ]] || args+=(--visual)
exec node "${args[@]}"
