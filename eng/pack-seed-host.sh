#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_OUTPUT="${1:-$REPO_ROOT/artifacts/packages}"
DEPENDENCY_FEED="${2:-${UAIX_NUGET_FEED:-$PACKAGE_OUTPUT}}"
CONFIGURATION="${CONFIGURATION:-Release}"
VERSION="$(sed -n 's:.*<VersionPrefix>\([^<]*\)</VersionPrefix>.*:\1:p' "$REPO_ROOT/dotnet/src/TinyRustLM.SeedHost/TinyRustLM.SeedHost.csproj" | head -n 1)"
LIBRARY_ID="UAIX.Browser.p2pRuntime.SeedHost"
TOOL_ID="UAIX.Browser.p2pRuntime.SeedHost.Tool"
DEPENDENCY_VERSION="0.1.8"

if [[ -z "$VERSION" ]]; then
  echo "Seed-host VersionPrefix is missing" >&2
  exit 1
fi
command -v pwsh >/dev/null 2>&1 || { echo "pwsh is required for the shared package verifier" >&2; exit 1; }

mkdir -p "$PACKAGE_OUTPUT"
PACKAGE_OUTPUT="$(cd "$PACKAGE_OUTPUT" && pwd)"
DEPENDENCY_FEED="$(cd "$DEPENDENCY_FEED" && pwd)"
ARCHIVE="$PACKAGE_OUTPUT/Archive"
mkdir -p "$ARCHIVE"
for name in \
  "UAIX.Browser.Core.Abstractions.$DEPENDENCY_VERSION.nupkg" \
  "UAIX.Browser.p2pRuntime.P2P.$DEPENDENCY_VERSION.nupkg"; do
  [[ -f "$DEPENDENCY_FEED/$name" ]] || { echo "Missing local package dependency: $name" >&2; exit 1; }
done

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

move_to_archive() {
  local source="$1"
  local prefix="${2:-}"
  local name destination before after
  name="$(basename "$source")"
  if [[ -n "$prefix" ]]; then
    name="$prefix-$name"
  fi
  destination="$ARCHIVE/$name"
  if [[ -e "$destination" ]]; then
    destination="$ARCHIVE/$name.$(date -u +%Y%m%d-%H%M%S)-$$-$RANDOM"
  fi
  before="$(sha256_file "$source")"
  mv -- "$source" "$destination"
  [[ ! -e "$source" ]] || { echo "Archived source still exists: $source" >&2; return 1; }
  after="$(sha256_file "$destination")"
  [[ "$before" == "$after" ]] || { echo "Archived file hash changed: $destination" >&2; return 1; }
}

"$REPO_ROOT/eng/build-seed-host-native.sh" release
case "$(uname -m)" in
  x86_64|amd64) HOST_ARCH="x64" ;;
  aarch64|arm64) HOST_ARCH="arm64" ;;
  *) echo "Unsupported seed-host build architecture: $(uname -m)" >&2; exit 1 ;;
esac
HOST_RID="linux-$HOST_ARCH"
HOST_NATIVE_ROOT="$REPO_ROOT/artifacts/seed-host-native/$HOST_RID"
HOST_NATIVE_LIBRARY="$HOST_NATIVE_ROOT/libminimodel_native.so"
HOST_NATIVE_EXECUTABLE="$HOST_NATIVE_ROOT/minimodel"
for path in "$HOST_NATIVE_LIBRARY" "$HOST_NATIVE_EXECUTABLE" "$HOST_NATIVE_ROOT/SHA256SUMS.txt"; do
  [[ -f "$path" ]] || { echo "Missing staged native evidence: $path" >&2; exit 1; }
done

STAGING="$REPO_ROOT/artifacts/packages/seed-host-$VERSION-$(date +%s)-$$-$RANDOM"
mkdir -p "$STAGING"
ESCAPED_DEPENDENCY_FEED="$(printf '%s' "$DEPENDENCY_FEED" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')"
NUGET_CONFIG="$STAGING/NuGet.Config"
cat > "$NUGET_CONFIG" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="uaix-local" value="$ESCAPED_DEPENDENCY_FEED" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="uaix-local"><package pattern="UAIX.*" /></packageSource>
    <packageSource key="nuget.org"><package pattern="*" /></packageSource>
  </packageSourceMapping>
</configuration>
EOF

PROPERTIES=(
  /p:TinyRustLmAbstractionsPackageId=UAIX.Browser.Core.Abstractions
  /p:TinyRustLmP2PPackageId=UAIX.Browser.p2pRuntime.P2P
  /p:SeedHostDependencyVersion="$DEPENDENCY_VERSION"
  /p:SeedHostUsePackagedDependencies=true
)
export MINIMODEL_NATIVE_PATH="$HOST_NATIVE_LIBRARY"
export MINIMODEL_CLI_PATH="$HOST_NATIVE_EXECUTABLE"
dotnet restore "$REPO_ROOT/dotnet/TinyRustLM.sln" --configfile "$NUGET_CONFIG" "${PROPERTIES[@]}"
dotnet build "$REPO_ROOT/dotnet/TinyRustLM.sln" -c "$CONFIGURATION" --no-restore "${PROPERTIES[@]}"
dotnet test "$REPO_ROOT/dotnet/tests/TinyRustLM.SeedHost.Tests/TinyRustLM.SeedHost.Tests.csproj" -c "$CONFIGURATION" --no-build --no-restore "${PROPERTIES[@]}"
dotnet pack "$REPO_ROOT/dotnet/src/TinyRustLM.SeedHost/TinyRustLM.SeedHost.csproj" -c "$CONFIGURATION" --no-build --no-restore -o "$STAGING" "${PROPERTIES[@]}"
dotnet pack "$REPO_ROOT/dotnet/tools/TinyRustLM.SeedHost.Tool/TinyRustLM.SeedHost.Tool.csproj" -c "$CONFIGURATION" --no-build --no-restore -o "$STAGING" "${PROPERTIES[@]}"

EXPECTED=(
  "$LIBRARY_ID.$VERSION.nupkg"
  "$LIBRARY_ID.$VERSION.snupkg"
  "$TOOL_ID.$VERSION.nupkg"
  "$TOOL_ID.$VERSION.snupkg"
)
for name in "${EXPECTED[@]}"; do
  [[ -f "$STAGING/$name" ]] || { echo "Missing package $name" >&2; exit 1; }
done
while IFS= read -r unexpected; do
  [[ -z "$unexpected" ]] || { echo "Unexpected package file: $unexpected" >&2; exit 1; }
done < <(find "$STAGING" -maxdepth 1 -type f \( -name '*.nupkg' -o -name '*.snupkg' \) -printf '%f\n' | while read -r candidate; do
  found=0
  for expected in "${EXPECTED[@]}"; do [[ "$candidate" == "$expected" ]] && found=1; done
  [[ $found -eq 1 ]] || printf '%s\n' "$candidate"
done)

STAMP="$(date -u +%Y%m%d-%H%M%S)-$$"
PRE_REPORT="$REPO_ROOT/artifacts/reports/seed-host-package-prepublish-$VERSION-$STAMP.json"
pwsh -NoProfile -File "$REPO_ROOT/eng/verify-seed-host-packages.ps1" \
  -PackageDirectory "$STAGING" -DependencyFeed "$DEPENDENCY_FEED" -Version "$VERSION" -ReportPath "$PRE_REPORT"

HASH_NAME="SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost-$VERSION.txt"
HASH_PATH="$STAGING/$HASH_NAME"
: > "$HASH_PATH"
for name in $(printf '%s\n' "${EXPECTED[@]}" | sort); do
  printf '%s  %s\n' "$(sha256_file "$STAGING/$name")" "$name" >> "$HASH_PATH"
done
README_NAME="README-UAIX.Browser.p2pRuntime.SeedHost-$VERSION.txt"
cat > "$STAGING/$README_NAME" <<EOF
UAIX Browser p2pRuntime Seed Host local NuGet release

Version: $VERSION
Library: $LIBRARY_ID
Tool: $TOOL_ID (command: uaix-p2p-seed)
Target framework: net8.0
Native RIDs packaged when verified: win-x64, linux-x64, linux-arm64
Dependencies: UAIX.Browser.Core.Abstractions $DEPENDENCY_VERSION; UAIX.Browser.p2pRuntime.P2P $DEPENDENCY_VERSION

Security boundary: model bytes are served only by user-run seed hosts. Project websites do not host, run, or proxy model bytes.
Announcements require a current matching outside-network reachability receipt.
Hashes: $HASH_NAME
EOF

PUBLISH_NAMES=("${EXPECTED[@]}" "$HASH_NAME" "$README_NAME")
for name in "${PUBLISH_NAMES[@]}"; do
  [[ ! -e "$PACKAGE_OUTPUT/$name" ]] || { echo "Refusing to overwrite existing release file: $name" >&2; exit 1; }
done
INCOMING="$PACKAGE_OUTPUT/.incoming-seed-host-$VERSION-$$-$RANDOM"
mkdir "$INCOMING"
for name in "${PUBLISH_NAMES[@]}"; do
  cp -- "$STAGING/$name" "$INCOMING/$name"
  [[ "$(sha256_file "$STAGING/$name")" == "$(sha256_file "$INCOMING/$name")" ]] || { echo "Incoming hash mismatch: $name" >&2; exit 1; }
done

PROMOTED=()
rollback_promotion() {
  local status=$?
  trap - ERR
  for path in "${PROMOTED[@]}"; do
    [[ -f "$path" ]] && move_to_archive "$path" "failed-promotion-$VERSION"
  done
  exit "$status"
}
trap rollback_promotion ERR
for name in "${PUBLISH_NAMES[@]}"; do
  mv -- "$INCOMING/$name" "$PACKAGE_OUTPUT/$name"
  PROMOTED+=("$PACKAGE_OUTPUT/$name")
done
POST_REPORT="$REPO_ROOT/artifacts/reports/seed-host-package-published-$VERSION-$STAMP.json"
pwsh -NoProfile -File "$REPO_ROOT/eng/verify-seed-host-packages.ps1" \
  -PackageDirectory "$PACKAGE_OUTPUT" -DependencyFeed "$DEPENDENCY_FEED" -Version "$VERSION" -ReportPath "$POST_REPORT" -PublishedFeed
trap - ERR

is_expected_package() {
  local candidate="$1"
  for expected in "${EXPECTED[@]}"; do [[ "$candidate" == "$expected" ]] && return 0; done
  return 1
}
shopt -s nullglob
for package in "$PACKAGE_OUTPUT/$LIBRARY_ID."*.nupkg "$PACKAGE_OUTPUT/$LIBRARY_ID."*.snupkg; do
  name="$(basename "$package")"
  is_expected_package "$name" || move_to_archive "$package"
done
for metadata in "$PACKAGE_OUTPUT/SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost-"*.txt "$PACKAGE_OUTPUT/README-UAIX.Browser.p2pRuntime.SeedHost-"*.txt; do
  name="$(basename "$metadata")"
  [[ "$name" == "$HASH_NAME" || "$name" == "$README_NAME" ]] || move_to_archive "$metadata"
done
shopt -u nullglob

for name in "${PUBLISH_NAMES[@]}"; do
  [[ "$(sha256_file "$STAGING/$name")" == "$(sha256_file "$PACKAGE_OUTPUT/$name")" ]] || { echo "Published feed hash mismatch: $name" >&2; exit 1; }
done
rmdir "$INCOMING"

echo "Seed-host packages $VERSION verified and written to $PACKAGE_OUTPUT"
echo "Pre-publish audit: $PRE_REPORT"
echo "Published-feed audit: $POST_REPORT"
