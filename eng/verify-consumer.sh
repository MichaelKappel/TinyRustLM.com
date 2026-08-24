#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-$REPO_ROOT/artifacts/packages}"
PACKAGE_VERSION="${2:-$("$REPO_ROOT/eng/get-package-version.sh")}"
CORE_PACKAGE_ID="${3:-${TINYRUSTLM_CONSUMER_CORE_PACKAGE_ID:-TinyRustLM.Core}}"
P2P_PACKAGE_ID="${4:-${TINYRUSTLM_CONSUMER_P2P_PACKAGE_ID:-TinyRustLM.P2P}}"
CONVERSION_PACKAGE_ID="${5:-${TINYRUSTLM_CONSUMER_CONVERSION_PACKAGE_ID:-}}"
SLM2_VECTORS="$REPO_ROOT/contracts/vnext/slm2-q8-weight-vectors.v1.json"
ACG2_VECTORS="$REPO_ROOT/contracts/vnext/acg2-format-vectors.v1.json"
PROGRAM_SOURCE="$REPO_ROOT/eng/consumer-smoke/Program.cs"

if ! command -v dotnet >/dev/null 2>&1; then
  echo "dotnet CLI is required." >&2
  exit 1
fi
if [[ -z "$PACKAGE_SOURCE" || -z "$PACKAGE_VERSION" ]]; then
  echo "Package source and exact package version are required." >&2
  exit 1
fi
for required in "$SLM2_VECTORS" "$ACG2_VECTORS" "$PROGRAM_SOURCE"; do
  if [[ ! -f "$required" ]]; then
    echo "Required consumer-smoke input is missing: $required" >&2
    exit 1
  fi
done

TMP_BASE="${TMPDIR:-/tmp}"
TEMP_ROOT="$(mktemp -d "$TMP_BASE/tinyrustlm-consumer-XXXXXXXX")"
PROJECT_DIR="$TEMP_ROOT/ConsumerSmoke"
WORK_DIR="$TEMP_ROOT/work"
MARKER_PATH="$TEMP_ROOT/.tinyrustlm-owned-temp"
mkdir -p "$PROJECT_DIR" "$WORK_DIR"
printf '%s\n' "tinyrustlm-consumer-owned-v1" > "$MARKER_PATH"

cleanup() {
  case "$TEMP_ROOT" in
    "$TMP_BASE"/tinyrustlm-consumer-*)
      if [[ -f "$MARKER_PATH" ]]; then
        rm -rf -- "$TEMP_ROOT"
      else
        printf 'Refusing to remove unmarked consumer temporary directory: %s\n' "$TEMP_ROOT" >&2
      fi
      ;;
    *)
      printf 'Refusing to remove consumer path outside the owned temporary root: %s\n' "$TEMP_ROOT" >&2
      ;;
  esac
}
trap cleanup EXIT

export NUGET_PACKAGES="$TEMP_ROOT/packages"
export NUGET_HTTP_CACHE_PATH="$TEMP_ROOT/http-cache"

dotnet new console --framework net8.0 --no-restore --output "$PROJECT_DIR"
cp "$PROGRAM_SOURCE" "$PROJECT_DIR/Program.cs"
cd "$PROJECT_DIR"
dotnet add package "$CORE_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE"
dotnet add package "$P2P_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE"
conversion_flag="absent"
if [[ -n "$CONVERSION_PACKAGE_ID" ]]; then
  dotnet add package "$CONVERSION_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE"
  conversion_flag="required"
fi
dotnet build --no-restore --configuration Release
dotnet run --no-build --no-restore --configuration Release -- \
  "$SLM2_VECTORS" "$ACG2_VECTORS" "$WORK_DIR" "$conversion_flag"
