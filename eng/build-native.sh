#!/usr/bin/env bash
set -euo pipefail

configuration="${1:-release}"
requested_rid="${2:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_dir="${CARGO_TARGET_DIR:-$repo_root/target}"

case "$configuration" in
  debug|release) ;;
  *) printf 'Configuration must be debug or release\n' >&2; exit 64 ;;
esac
if [[ "$target_dir" != /* || "$target_dir" == / ]]; then
  printf 'CARGO_TARGET_DIR must be an absolute non-root path\n' >&2
  exit 64
fi

if [[ -z "$requested_rid" ]]; then
  case "$(uname -s):$(uname -m)" in
    Linux:x86_64) requested_rid=linux-x64 ;;
    Linux:aarch64|Linux:arm64) requested_rid=linux-arm64 ;;
    MINGW*:x86_64|MSYS*:x86_64|CYGWIN*:x86_64) requested_rid=win-x64 ;;
    *) printf 'This host is not one of the supported TinyRustLM native RIDs\n' >&2; exit 69 ;;
  esac
fi

case "$requested_rid" in
  win-x64) target_triple=x86_64-pc-windows-msvc; native_name=tinyrustlm_native.dll ;;
  linux-x64) target_triple=x86_64-unknown-linux-gnu; native_name=libtinyrustlm_native.so ;;
  linux-arm64) target_triple=aarch64-unknown-linux-gnu; native_name=libtinyrustlm_native.so ;;
  *) printf 'Unsupported native RID: %s\n' "$requested_rid" >&2; exit 64 ;;
esac

cargo_args=(build -p tinyrustlm-native --target "$target_triple")
if [[ "$configuration" == release ]]; then
  cargo_args+=(--release)
fi

cd "$repo_root"
cargo "${cargo_args[@]}"
profile_dir="$configuration"
source_path="$target_dir/$target_triple/$profile_dir/$native_name"
test -f "$source_path" || { printf 'TinyRustLM native build output is missing: %s\n' "$source_path" >&2; exit 1; }
output_dir="$repo_root/artifacts/native/$requested_rid"
mkdir -p "$output_dir"
cp "$source_path" "$output_dir/$native_name"
printf 'TinyRustLM native library copied to %s\n' "$output_dir"
