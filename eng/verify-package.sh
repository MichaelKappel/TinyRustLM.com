#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_OUTPUT="$REPO_ROOT/artifacts/packages"
REPORT_OUTPUT="$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-package-audit.json"

if [[ "$#" -gt 0 ]]; then
  CONFIGURATION="$1"
  shift
else
  CONFIGURATION="Release"
fi

current_runtime_rid() {
  local kernel
  local machine
  kernel="$(uname -s)"
  machine="$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')"
  case "$kernel" in
    Darwin*) echo "osx-$machine" ;;
    Linux*) echo "linux-$machine" ;;
    *) echo "win-x64" ;;
  esac
}

REQUIRED_NATIVE_RIDS=()
if [[ "$#" -gt 0 ]]; then
  for rid_arg in "$@"; do
    IFS=',' read -r -a rid_parts <<< "$rid_arg"
    for rid in "${rid_parts[@]}"; do
      rid="${rid//[$'\t\r\n ']}"
      if [[ -n "$rid" ]]; then
        REQUIRED_NATIVE_RIDS+=("$rid")
      fi
    done
  done
else
  REQUIRED_NATIVE_RIDS=("$(current_runtime_rid)")
fi

PACKAGE_VERSION="$("$REPO_ROOT/eng/get-package-version.sh")"

cd "$REPO_ROOT"
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p tinyrustlm-slm -p tinyrustlm-runtime-sdk -p tinyrustlm-p2p -p tinyrustlm-native -p tinyrustlm-memory-endpoints
node --test \
  tinyrustlm/tests/active-conversation.test.js \
  tinyrustlm/tests/calculator-tool.test.js \
  tinyrustlm/tests/companion-bridge.test.js \
  tinyrustlm/tests/minimodel-announcement.test.js \
  tinyrustlm/tests/memory-endpoints-sync.test.js \
  tinyrustlm/tests/memory-endpoints-distributed-sync-authority.test.js
"$REPO_ROOT/eng/pack.sh" "$CONFIGURATION" "$PACKAGE_OUTPUT"
"$REPO_ROOT/eng/write-package-audit.sh" "$PACKAGE_OUTPUT" "$REPORT_OUTPUT" "${REQUIRED_NATIVE_RIDS[@]}"
TINYRUSTLM_REPO_ROOT="$REPO_ROOT" TINYRUSTLM_PACKAGE_DIR="$PACKAGE_OUTPUT" TINYRUSTLM_PACKAGE_AUDIT_REPORT="$REPORT_OUTPUT" dotnet test dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj -c "$CONFIGURATION" --no-build
"$REPO_ROOT/eng/verify-consumer.sh" "$PACKAGE_OUTPUT" "$PACKAGE_VERSION"
echo "TinyRustLM NuGet package verification passed."
