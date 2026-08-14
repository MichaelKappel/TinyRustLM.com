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
  *) echo "Directory flush release helpers support Linux only in this script" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64) RID="linux-x64" ;;
  aarch64|arm64) RID="linux-arm64" ;;
  *) echo "Unsupported directory flush helper architecture: $(uname -m)" >&2; exit 1 ;;
esac
if [[ -z "$OUTPUT_DIRECTORY" ]]; then
  OUTPUT_DIRECTORY="$REPO_ROOT/artifacts/directory-flush-helper/$RID"
elif [[ "$OUTPUT_DIRECTORY" != /* ]]; then
  echo "Directory flush helper output must be an absolute path" >&2
  exit 1
fi
if [[ -e "$OUTPUT_DIRECTORY" ]]; then
  echo "Directory flush helper output already exists: $OUTPUT_DIRECTORY" >&2
  exit 1
fi

TARGET_DIRECTORY="${CARGO_TARGET_DIR:-$REPO_ROOT/target/directory-flush-helper/$RID}"
CARGO_ARGS=(
  build
  --manifest-path "$REPO_ROOT/Cargo.toml"
  -p tinyrustlm-durability
  --bin tinyrustlm-directory-flush
  --locked
)
if [[ "$CONFIGURATION" == "release" ]]; then CARGO_ARGS+=(--release); fi
CARGO_TARGET_DIR="$TARGET_DIRECTORY" cargo "${CARGO_ARGS[@]}"
EXECUTABLE_PATH="$TARGET_DIRECTORY/$CONFIGURATION/tinyrustlm-directory-flush"
if [[ ! -f "$EXECUTABLE_PATH" ]]; then
  echo "Directory flush helper build output is missing: $EXECUTABLE_PATH" >&2
  exit 1
fi
TRUST_CLASS="local-test-build"
if [[ "$CONFIGURATION" == "release" ]]; then TRUST_CLASS="release-package"; fi
node --preserve-symlinks --preserve-symlinks-main \
  "$REPO_ROOT/tinyrustlm/tools/directory-flush-helper-package.js" \
  "$EXECUTABLE_PATH" "$OUTPUT_DIRECTORY" "$CONFIGURATION" "$TRUST_CLASS"
echo "Directory flush helper package written for $RID"
