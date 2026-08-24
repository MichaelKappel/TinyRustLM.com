#!/usr/bin/env bash
set -euo pipefail

configuration="${1:-Release}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_output="${2:-$repo_root/artifacts/packages}"
required_native_rids="${3:-${TINYRUSTLM_REQUIRED_NATIVE_RIDS:-}}"
canonical_packages=(
  tinyrustlm-slm2
  tinyrustlm-composition2
  tinyrustlm-tokenizer2
  tinyrustlm-template2
  tinyrustlm-sampling2
  tinyrustlm-prompt2
  tinyrustlm-runtime
  tinyrustlm-p2p
  tinyrustlm-native
  tinyrustlm-convert
)
package_args=()
for package in "${canonical_packages[@]}"; do
  package_args+=(-p "$package")
done

cd "$repo_root"
cargo fmt --all --check
cargo clippy "${package_args[@]}" --all-targets -- -D warnings
cargo test "${package_args[@]}"
if [[ -n "$required_native_rids" ]]; then
  TINYRUSTLM_REQUIRED_NATIVE_RIDS="$required_native_rids" \
    "$repo_root/eng/pack.sh" "$configuration" "$package_output"
else
  "$repo_root/eng/pack.sh" "$configuration" "$package_output"
fi
printf 'TinyRustLM NuGet package verification passed: %s\n' "$package_output"
