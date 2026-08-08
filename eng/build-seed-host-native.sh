#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-release}"
RUST_TARGET="${2:-}"
REQUESTED_RID="${3:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MINIMODEL_SOURCE_ROOT="${MINIMODEL_SOURCE_ROOT:-$(cd "$REPO_ROOT/.." && pwd)/MiniModel.org}"
if [[ ! -f "$MINIMODEL_SOURCE_ROOT/Cargo.toml" ]]; then
  echo "MiniModel Cargo workspace was not found at $MINIMODEL_SOURCE_ROOT" >&2
  exit 1
fi

case "$(uname -s)" in
  Linux*) OS_NAME="linux"; LIBRARY_NAME="libminimodel_native.so" ;;
  Darwin*) OS_NAME="osx"; LIBRARY_NAME="libminimodel_native.dylib" ;;
  *) echo "Unsupported seed-host native operating system" >&2; exit 1 ;;
esac
CONVERTER_NAME="tinyrustlm-slm-pack"
case "$(uname -m)" in
  x86_64) ARCHITECTURE="x64" ;;
  aarch64|arm64) ARCHITECTURE="arm64" ;;
  *) echo "Unsupported seed-host native architecture: $(uname -m)" >&2; exit 1 ;;
esac
RID="${REQUESTED_RID:-$OS_NAME-$ARCHITECTURE}"
case "$RID" in
  linux-x64|linux-arm64|osx-x64|osx-arm64) ;;
  *) echo "Unsupported seed-host RID: $RID" >&2; exit 1 ;;
esac
if [[ "$RID" != "$OS_NAME-"* ]]; then
  echo "Seed-host RID $RID does not match the current operating system $OS_NAME" >&2
  exit 1
fi

CARGO_ARGS=(build --manifest-path "$MINIMODEL_SOURCE_ROOT/Cargo.toml" -p minimodel-native -p minimodel)
PROFILE="debug"
if [[ "$CONFIGURATION" == "release" ]]; then
  CARGO_ARGS+=(--release)
  PROFILE="release"
elif [[ "$CONFIGURATION" != "debug" ]]; then
  echo "Configuration must be debug or release" >&2
  exit 1
fi
if [[ -n "$RUST_TARGET" ]]; then
  CARGO_ARGS+=(--target "$RUST_TARGET")
fi
CARGO_TARGET_DIR="$MINIMODEL_SOURCE_ROOT/target/seed-host/$RID" cargo "${CARGO_ARGS[@]}"

CONVERTER_ARGS=(build --manifest-path "$REPO_ROOT/Cargo.toml" -p tinyrustlm-slm-pack)
if [[ "$CONFIGURATION" == "release" ]]; then
  CONVERTER_ARGS+=(--release)
fi
if [[ -n "$RUST_TARGET" ]]; then
  CONVERTER_ARGS+=(--target "$RUST_TARGET")
fi
CONVERTER_TARGET_DIRECTORY="$REPO_ROOT/target/seed-host-converter/$RID"
CARGO_TARGET_DIR="$CONVERTER_TARGET_DIRECTORY" cargo "${CONVERTER_ARGS[@]}"

OUTPUT_DIRECTORY="$REPO_ROOT/artifacts/seed-host-native/$RID"
mkdir -p "$OUTPUT_DIRECTORY"
SOURCE_DIRECTORY="$MINIMODEL_SOURCE_ROOT/target/seed-host/$RID"
if [[ -n "$RUST_TARGET" ]]; then
  SOURCE_DIRECTORY="$SOURCE_DIRECTORY/$RUST_TARGET"
fi
SOURCE_DIRECTORY="$SOURCE_DIRECTORY/$PROFILE"
cp "$SOURCE_DIRECTORY/$LIBRARY_NAME" "$OUTPUT_DIRECTORY/$LIBRARY_NAME"
cp "$SOURCE_DIRECTORY/minimodel" "$OUTPUT_DIRECTORY/minimodel"
CONVERTER_SOURCE_DIRECTORY="$CONVERTER_TARGET_DIRECTORY"
if [[ -n "$RUST_TARGET" ]]; then
  CONVERTER_SOURCE_DIRECTORY="$CONVERTER_SOURCE_DIRECTORY/$RUST_TARGET"
fi
CONVERTER_SOURCE_DIRECTORY="$CONVERTER_SOURCE_DIRECTORY/$PROFILE"
cp "$CONVERTER_SOURCE_DIRECTORY/$CONVERTER_NAME" "$OUTPUT_DIRECTORY/$CONVERTER_NAME"
(
  cd "$OUTPUT_DIRECTORY"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$LIBRARY_NAME" minimodel "$CONVERTER_NAME" > SHA256SUMS.txt
  else
    shasum -a 256 "$LIBRARY_NAME" minimodel "$CONVERTER_NAME" > SHA256SUMS.txt
  fi
)
echo "MiniModel and TinyRustLM conversion assets written to $OUTPUT_DIRECTORY"
