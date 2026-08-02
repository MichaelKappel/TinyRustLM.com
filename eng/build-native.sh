#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-release}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
cp "target/$PROFILE_DIR/$NATIVE_NAME" "artifacts/native/$RID/$NATIVE_NAME"
echo "TinyRustLM native library copied to artifacts/native/$RID"
