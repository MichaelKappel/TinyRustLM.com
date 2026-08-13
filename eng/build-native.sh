#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-release}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${CARGO_TARGET_DIR:-$REPO_ROOT/target}"
if [[ "$TARGET_DIR" != /* ]]; then
  echo "CARGO_TARGET_DIR must be an absolute path" >&2
  exit 1
fi
if [[ "$TARGET_DIR" == "/" ]]; then
  echo "CARGO_TARGET_DIR must not be a filesystem root" >&2
  exit 1
fi
case "$(uname -s)" in
  Darwin*) RID="osx-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" ; NATIVE_NAME="libtinyrustlm_native.dylib" ;;
  Linux*) RID="linux-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" ; NATIVE_NAME="libtinyrustlm_native.so" ;;
  *) RID="win-x64" ; NATIVE_NAME="tinyrustlm_native.dll" ;;
esac

cd "$REPO_ROOT"
if [[ "$CONFIGURATION" == "release" ]]; then
  cargo build -p tinyrustlm-native --release
  PROFILE_DIR="release"
else
  cargo build -p tinyrustlm-native
  PROFILE_DIR="debug"
fi

mkdir -p "artifacts/native/$RID"
NATIVE_SOURCE="$TARGET_DIR/$PROFILE_DIR/$NATIVE_NAME"
if [[ ! -f "$NATIVE_SOURCE" ]]; then
  echo "TinyRustLM native build output is missing" >&2
  exit 1
fi
cp "$NATIVE_SOURCE" "artifacts/native/$RID/$NATIVE_NAME"
echo "TinyRustLM native library copied to artifacts/native/$RID"
