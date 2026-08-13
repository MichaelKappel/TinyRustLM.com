#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-release}"
OUTPUT_DIRECTORY="${2:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$CONFIGURATION" in
  debug|release) ;;
  *) echo "Configuration must be debug or release" >&2; exit 1 ;;
esac
case "$(uname -s)" in
  Linux*) ;;
  *) echo "Archive scan release helpers support Linux only in this script" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64) RID="linux-x64" ;;
  aarch64|arm64) RID="linux-arm64" ;;
  *) echo "Unsupported archive scan helper architecture: $(uname -m)" >&2; exit 1 ;;
esac
if [[ -z "$OUTPUT_DIRECTORY" ]]; then
  OUTPUT_DIRECTORY="$REPO_ROOT/artifacts/archive-scan-helper/$RID"
elif [[ "$OUTPUT_DIRECTORY" != /* ]]; then
  echo "Archive scan helper output must be an absolute path" >&2
  exit 1
fi
if [[ -e "$OUTPUT_DIRECTORY" ]]; then
  echo "Archive scan helper output already exists: $OUTPUT_DIRECTORY" >&2
  exit 1
fi

TARGET_DIRECTORY="${CARGO_TARGET_DIR:-$REPO_ROOT/target/archive-scan-helper/$RID}"
CARGO_ARGS=(
  build
  --manifest-path "$REPO_ROOT/Cargo.toml"
  -p tinyrustlm-archive
  --bin tinyrustlm-archive-scan
  --locked
)
if [[ "$CONFIGURATION" == "release" ]]; then CARGO_ARGS+=(--release); fi
CARGO_TARGET_DIR="$TARGET_DIRECTORY" cargo "${CARGO_ARGS[@]}"
EXECUTABLE_PATH="$TARGET_DIRECTORY/$CONFIGURATION/tinyrustlm-archive-scan"
if [[ ! -f "$EXECUTABLE_PATH" ]]; then
  echo "Archive scan helper build output is missing: $EXECUTABLE_PATH" >&2
  exit 1
fi
TRUST_CLASS="local-test-build"
if [[ "$CONFIGURATION" == "release" ]]; then TRUST_CLASS="release-package"; fi
node "$REPO_ROOT/tinyrustlm/tools/archive-scan-helper-package.js" \
  "$EXECUTABLE_PATH" "$OUTPUT_DIRECTORY" "$CONFIGURATION" "$TRUST_CLASS"
echo "Archive scan helper package written for $RID"
