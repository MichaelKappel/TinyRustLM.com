#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-Release}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_OUTPUT="${2:-$REPO_ROOT/artifacts/packages}"
PACKAGE_ID_PREFIX="${3:-TinyRustLM}"
ARCHIVE_OTHER_PACKAGES="${4:-0}"
ABSTRACTIONS_PACKAGE_ID="${TINYRUSTLM_ABSTRACTIONS_PACKAGE_ID:-$PACKAGE_ID_PREFIX.Abstractions}"
CORE_PACKAGE_ID="${TINYRUSTLM_CORE_PACKAGE_ID:-$PACKAGE_ID_PREFIX.Core}"
P2P_PACKAGE_ID="${TINYRUSTLM_P2P_PACKAGE_ID:-$PACKAGE_ID_PREFIX.P2P}"
MEMORY_ENDPOINTS_PACKAGE_ID="${TINYRUSTLM_MEMORY_ENDPOINTS_PACKAGE_ID:-$PACKAGE_ID_PREFIX.MemoryEndpoints}"
CONVERSION_PACKAGE_ID="${TINYRUSTLM_CONVERSION_PACKAGE_ID:-$PACKAGE_ID_PREFIX.Conversion}"
INCLUDE_OPTIONAL_MEMORY_ENDPOINTS="${TINYRUSTLM_INCLUDE_OPTIONAL_MEMORY_ENDPOINTS:-0}"
INCLUDE_PRIVATE_CONVERSION="${TINYRUSTLM_INCLUDE_PRIVATE_CONVERSION:-0}"

validate_package_id() {
  local value="$1"
  local name="$2"
  if [[ ! "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*(\.[A-Za-z0-9][A-Za-z0-9_.-]*)*$ ]]; then
    echo "$name must be a NuGet-compatible package ID such as TinyRustLM.Core or UAIX.Browser.p2pLLM.Runtime." >&2
    exit 1
  fi
}

validate_package_id "$PACKAGE_ID_PREFIX" "PACKAGE_ID_PREFIX"
validate_package_id "$ABSTRACTIONS_PACKAGE_ID" "TINYRUSTLM_ABSTRACTIONS_PACKAGE_ID"
validate_package_id "$CORE_PACKAGE_ID" "TINYRUSTLM_CORE_PACKAGE_ID"
validate_package_id "$P2P_PACKAGE_ID" "TINYRUSTLM_P2P_PACKAGE_ID"
validate_package_id "$MEMORY_ENDPOINTS_PACKAGE_ID" "TINYRUSTLM_MEMORY_ENDPOINTS_PACKAGE_ID"
validate_package_id "$CONVERSION_PACKAGE_ID" "TINYRUSTLM_CONVERSION_PACKAGE_ID"
PACKAGE_IDS=("$ABSTRACTIONS_PACKAGE_ID" "$CORE_PACKAGE_ID" "$P2P_PACKAGE_ID")
if [[ "$INCLUDE_OPTIONAL_MEMORY_ENDPOINTS" == "1" || "$INCLUDE_OPTIONAL_MEMORY_ENDPOINTS" == "true" ]]; then
  PACKAGE_IDS+=("$MEMORY_ENDPOINTS_PACKAGE_ID")
fi
if [[ "$INCLUDE_PRIVATE_CONVERSION" == "1" || "$INCLUDE_PRIVATE_CONVERSION" == "true" ]]; then
  PACKAGE_IDS+=("$CONVERSION_PACKAGE_ID")
fi

sha256_file() {
  local package_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$package_path" | awk '{print tolower($1)}'
  else
    shasum -a 256 "$package_path" | awk '{print tolower($1)}'
  fi
}

write_package_hash_manifest() {
  local package_version
  package_version="$("$REPO_ROOT/eng/get-package-version.sh")"
  if [[ -z "$package_version" ]]; then
    echo "Package version could not be resolved from dotnet/Directory.Build.props." >&2
    exit 1
  fi

  rm -f "$PACKAGE_OUTPUT"/"SHA256SUMS-$PACKAGE_ID_PREFIX-"*.txt

  local manifest_path="$PACKAGE_OUTPUT/SHA256SUMS-$PACKAGE_ID_PREFIX-$package_version.txt"
  local expected_names=()
  local package_id
  for package_id in "${PACKAGE_IDS[@]}"; do
    expected_names+=("$package_id.$package_version.nupkg")
    expected_names+=("$package_id.$package_version.snupkg")
  done

  : > "$manifest_path"
  while IFS= read -r package_name; do
    [[ -z "$package_name" ]] && continue
    local package_path="$PACKAGE_OUTPUT/$package_name"
    if [[ ! -f "$package_path" ]]; then
      echo "Cannot write SHA-256 manifest; missing expected package: $package_name" >&2
      exit 1
    fi
    printf '%s  %s\n' "$(sha256_file "$package_path")" "$package_name" >> "$manifest_path"
  done < <(printf '%s\n' "${expected_names[@]}" | sort)

  echo "SHA-256 manifest written to $manifest_path"
}

write_package_feed_readme() {
  local package_version
  package_version="$("$REPO_ROOT/eng/get-package-version.sh")"
  if [[ -z "$package_version" ]]; then
    echo "Package version could not be resolved from dotnet/Directory.Build.props." >&2
    exit 1
  fi

  rm -f "$PACKAGE_OUTPUT"/"README-$PACKAGE_ID_PREFIX-"*.txt

  local readme_path="$PACKAGE_OUTPUT/README-$PACKAGE_ID_PREFIX-$package_version.txt"
  {
    printf '%s NuGet folder feed\n\n' "$PACKAGE_ID_PREFIX"
    printf 'Package version: %s\n' "$package_version"
    printf 'Primary packages (.nupkg):\n'
    local package_id
    for package_id in "${PACKAGE_IDS[@]}"; do
      printf -- '- %s.%s.nupkg\n' "$package_id" "$package_version"
    done
    printf '\nSymbol sidecars (.snupkg):\n'
    for package_id in "${PACKAGE_IDS[@]}"; do
      printf -- '- %s.%s.snupkg\n' "$package_id" "$package_version"
    done
    printf '\nNuGet Package Manager generally lists installable .nupkg packages. Each .snupkg is a debug-symbol sidecar for the matching installable package.\n'
    printf 'Verify this feed with SHA256SUMS-%s-%s.txt, the feed audit report, SymbolsPackage/PDB evidence, publish-plan hashes, and feed-hash reports.\n\n' "$PACKAGE_ID_PREFIX" "$package_version"
    printf 'Generated UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$readme_path"

  echo "Feed README written to $readme_path"
}

"$REPO_ROOT/eng/build-native.sh" release
mkdir -p "$PACKAGE_OUTPUT"
PACKAGE_OUTPUT="$(cd "$PACKAGE_OUTPUT" && pwd -P)"
move_to_archive() {
  local package="$1"
  local package_name
  package_name="$(basename "$package")"
  local destination="$ARCHIVE_OUTPUT/$package_name"
  if [[ -e "$destination" ]]; then
    local stamp extension base_name
    stamp="$(date +%Y%m%d-%H%M%S)"
    extension="${package_name##*.}"
    base_name="${package_name%.*}"
    destination="$ARCHIVE_OUTPUT/$base_name.$stamp.$extension"
  fi
  mv "$package" "$destination"
}
if [[ "$ARCHIVE_OTHER_PACKAGES" == "1" || "$ARCHIVE_OTHER_PACKAGES" == "true" ]]; then
  ARCHIVE_OUTPUT="$PACKAGE_OUTPUT/Archive"
  mkdir -p "$ARCHIVE_OUTPUT"
  shopt -s nullglob
  for package in "$PACKAGE_OUTPUT"/*.nupkg "$PACKAGE_OUTPUT"/*.snupkg; do
    package_name="$(basename "$package")"
    keep_package=0
    for package_id in "${PACKAGE_IDS[@]}"; do
      case "$package_name" in
        "$package_id".*.nupkg|"$package_id".*.snupkg) keep_package=1 ;;
      esac
    done
    if [[ "$keep_package" == "1" ]]; then
      continue
    fi
    move_to_archive "$package"
  done
  for package in "$PACKAGE_OUTPUT"/"SHA256SUMS-$PACKAGE_ID_PREFIX-"*.txt; do
    [[ -f "$package" ]] || continue
    move_to_archive "$package"
  done
  for package in "$PACKAGE_OUTPUT"/"README-$PACKAGE_ID_PREFIX-"*.txt; do
    [[ -f "$package" ]] || continue
    move_to_archive "$package"
  done
  shopt -u nullglob
fi
for package_id in "${PACKAGE_IDS[@]}"; do
  if [[ "$ARCHIVE_OTHER_PACKAGES" == "1" || "$ARCHIVE_OTHER_PACKAGES" == "true" ]]; then
    shopt -s nullglob
    for package in "$PACKAGE_OUTPUT"/"$package_id".*.nupkg "$PACKAGE_OUTPUT"/"$package_id".*.snupkg; do
      [[ -f "$package" ]] || continue
      move_to_archive "$package"
    done
    shopt -u nullglob
  else
    find "$PACKAGE_OUTPUT" -maxdepth 1 -type f \( -name "$package_id.*.nupkg" -o -name "$package_id.*.snupkg" \) -delete
  fi
done
cd "$REPO_ROOT"
PACKAGE_PROPERTIES=(
  "/p:TinyRustLmPackageIdPrefix=$PACKAGE_ID_PREFIX"
  "/p:TinyRustLmAbstractionsPackageId=$ABSTRACTIONS_PACKAGE_ID"
  "/p:TinyRustLmCorePackageId=$CORE_PACKAGE_ID"
  "/p:TinyRustLmP2PPackageId=$P2P_PACKAGE_ID"
  "/p:TinyRustLmMemoryEndpointsPackageId=$MEMORY_ENDPOINTS_PACKAGE_ID"
  "/p:TinyRustLmConversionPackageId=$CONVERSION_PACKAGE_ID"
)
if [[ "$INCLUDE_OPTIONAL_MEMORY_ENDPOINTS" == "1" || "$INCLUDE_OPTIONAL_MEMORY_ENDPOINTS" == "true" ]]; then
  PACKAGE_PROPERTIES+=("/p:TinyRustLmPackOptionalMemoryEndpoints=true")
fi
if [[ "$INCLUDE_PRIVATE_CONVERSION" == "1" || "$INCLUDE_PRIVATE_CONVERSION" == "true" ]]; then
  cargo build -p tinyrustlm-convert --release
  PACKAGE_PROPERTIES+=("/p:TinyRustLmPackPrivateConversion=true")
fi
dotnet restore dotnet/TinyRustLM.sln "${PACKAGE_PROPERTIES[@]}"
dotnet build dotnet/TinyRustLM.sln -c "$CONFIGURATION" --no-restore "${PACKAGE_PROPERTIES[@]}"
TINYRUSTLM_REPO_ROOT="$REPO_ROOT" TINYRUSTLM_PACKAGE_DIR="$PACKAGE_OUTPUT" dotnet test dotnet/TinyRustLM.sln -c "$CONFIGURATION" --no-build "${PACKAGE_PROPERTIES[@]}"
dotnet pack dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT" "${PACKAGE_PROPERTIES[@]}"
dotnet pack dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT" "${PACKAGE_PROPERTIES[@]}"
dotnet pack dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT" "${PACKAGE_PROPERTIES[@]}"
if [[ "$INCLUDE_OPTIONAL_MEMORY_ENDPOINTS" == "1" || "$INCLUDE_OPTIONAL_MEMORY_ENDPOINTS" == "true" ]]; then
  dotnet pack dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT" "${PACKAGE_PROPERTIES[@]}"
fi
if [[ "$INCLUDE_PRIVATE_CONVERSION" == "1" || "$INCLUDE_PRIVATE_CONVERSION" == "true" ]]; then
  dotnet pack dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT" "${PACKAGE_PROPERTIES[@]}"
fi
PACKAGE_VERSION="$("$REPO_ROOT/eng/get-package-version.sh")"
if [[ -z "$PACKAGE_VERSION" ]]; then
  echo "Package version could not be resolved from dotnet/Directory.Build.props." >&2
  exit 1
fi
CANONICAL_PACKAGE_PATHS=()
for package_id in "${PACKAGE_IDS[@]}"; do
  for extension in nupkg snupkg; do
    package_path="$PACKAGE_OUTPUT/$package_id.$PACKAGE_VERSION.$extension"
    if [[ ! -f "$package_path" ]]; then
      echo "Expected package is missing before canonicalization: $package_id.$PACKAGE_VERSION.$extension" >&2
      exit 1
    fi
    CANONICAL_PACKAGE_PATHS+=("$package_path")
  done
done
dotnet run \
  --project dotnet/tools/TinyRustLM.PackageCanonicalizer/TinyRustLM.PackageCanonicalizer.csproj \
  -c "$CONFIGURATION" --no-build --no-restore -- canonicalize \
  "${CANONICAL_PACKAGE_PATHS[@]}"
TINYRUSTLM_REPO_ROOT="$REPO_ROOT" TINYRUSTLM_PACKAGE_DIR="$PACKAGE_OUTPUT" dotnet test \
  dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj \
  -c "$CONFIGURATION" --no-build "${PACKAGE_PROPERTIES[@]}"
write_package_hash_manifest
write_package_feed_readme
echo "${PACKAGE_IDS[*]} packages written to $PACKAGE_OUTPUT"
