#!/usr/bin/env bash
set -euo pipefail

configuration="${1:-Release}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_output="${2:-$repo_root/artifacts/packages}"
include_memory="${TINYRUSTLM_INCLUDE_OPTIONAL_MEMORY_ENDPOINTS:-0}"
include_conversion="${TINYRUSTLM_INCLUDE_PRIVATE_CONVERSION:-0}"
required_rids_csv="${TINYRUSTLM_REQUIRED_NATIVE_RIDS:-}"

case "$configuration" in
  Debug|Release) ;;
  *) printf 'Configuration must be Debug or Release\n' >&2; exit 64 ;;
esac
case "$include_memory" in 0|1|false|true) ;; *) printf 'Invalid MemoryEndpoints inclusion value\n' >&2; exit 64 ;; esac
case "$include_conversion" in 0|1|false|true) ;; *) printf 'Invalid Conversion inclusion value\n' >&2; exit 64 ;; esac

if [[ -e "$package_output" && ! -d "$package_output" ]]; then
  printf 'Package output exists and is not a directory: %s\n' "$package_output" >&2
  exit 64
fi
mkdir -p "$package_output"
package_output="$(cd "$package_output" && pwd -P)"
if [[ "$package_output" == / ]]; then
  printf 'Package output must not be a filesystem root\n' >&2
  exit 64
fi
if find "$package_output" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  printf 'Package output must be empty so current and prior bytes cannot be mixed: %s\n' "$package_output" >&2
  exit 64
fi

host_rid() {
  case "$(uname -s):$(uname -m)" in
    Linux:x86_64) printf 'linux-x64\n' ;;
    Linux:aarch64|Linux:arm64) printf 'linux-arm64\n' ;;
    MINGW*:x86_64|MSYS*:x86_64|CYGWIN*:x86_64) printf 'win-x64\n' ;;
    *) printf 'This host is not one of the supported TinyRustLM package RIDs\n' >&2; return 69 ;;
  esac
}

required_rids=()
if [[ -n "$required_rids_csv" ]]; then
  IFS=',' read -r -a required_rids <<< "$required_rids_csv"
else
  required_rids=("$(host_rid)")
fi
for rid in "${required_rids[@]}"; do
  case "$rid" in win-x64|linux-x64|linux-arm64) ;; *) printf 'Unsupported required native RID: %s\n' "$rid" >&2; exit 64 ;; esac
done

package_ids=(TinyRustLM.Abstractions TinyRustLM.Core TinyRustLM.P2P)
package_properties=()
if [[ "$include_memory" == 1 || "$include_memory" == true ]]; then
  package_ids+=(TinyRustLM.MemoryEndpoints)
  package_properties+=(/p:TinyRustLmPackOptionalMemoryEndpoints=true)
fi
if [[ "$include_conversion" == 1 || "$include_conversion" == true ]]; then
  package_ids+=(TinyRustLM.Conversion)
  package_properties+=(/p:TinyRustLmPackPrivateConversion=true)
fi

cd "$repo_root"
"$repo_root/eng/build-native.sh" release
if [[ "$include_conversion" == 1 || "$include_conversion" == true ]]; then
  "$repo_root/eng/build-converter.sh" release
fi

projects=(
  dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj
  dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj
  dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj
  dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj
  dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj
  dotnet/samples/TinyRustLM.ConsoleSample/TinyRustLM.ConsoleSample.csproj
  dotnet/samples/TinyRustLM.P2PShareSample/TinyRustLM.P2PShareSample.csproj
)
if [[ "$include_memory" == 1 || "$include_memory" == true ]]; then
  projects+=(dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj)
fi
if [[ "$include_conversion" == 1 || "$include_conversion" == true ]]; then
  projects+=(dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj)
fi
for project in "${projects[@]}"; do
  dotnet restore "$project" --nologo "${package_properties[@]}"
  dotnet build "$project" -c "$configuration" --no-restore --nologo "${package_properties[@]}"
done
dotnet test dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj -c "$configuration" --no-build --nologo "${package_properties[@]}"
dotnet test dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj -c "$configuration" --no-build --nologo "${package_properties[@]}"

for package_id in "${package_ids[@]}"; do
  dotnet pack "dotnet/src/$package_id/$package_id.csproj" -c "$configuration" --no-build --nologo -o "$package_output" "${package_properties[@]}"
done
package_version="$("$repo_root/eng/get-package-version.sh")"
package_paths=()
for package_id in "${package_ids[@]}"; do
  for extension in nupkg snupkg; do
    path="$package_output/$package_id.$package_version.$extension"
    test -f "$path" || { printf 'Expected package is missing before canonicalization: %s\n' "$path" >&2; exit 1; }
    package_paths+=("$path")
  done
done
dotnet run --project dotnet/tools/TinyRustLM.PackageCanonicalizer/TinyRustLM.PackageCanonicalizer.csproj \
  -c "$configuration" --no-build --no-restore -- canonicalize "${package_paths[@]}"

audit_path="$package_output/tinyrustlm-nuget-package-audit.json"
"$repo_root/eng/write-package-audit.sh" "$package_output" "$audit_path" "${required_rids[@]}"
"$repo_root/eng/verify-consumer.sh" "$package_output" "$package_version"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print tolower($1)}'; else shasum -a 256 "$1" | awk '{print tolower($1)}'; fi
}
manifest_path="$package_output/SHA256SUMS-TinyRustLM-$package_version.txt"
while IFS= read -r path; do
  printf '%s  %s\n' "$(sha256_file "$path")" "$(basename "$path")"
done < <(printf '%s\n' "${package_paths[@]}" | sort) > "$manifest_path"

readme_path="$package_output/README-TinyRustLM-$package_version.txt"
{
  printf 'TinyRustLM NuGet folder feed\n\n'
  printf 'Package version: %s\n' "$package_version"
  printf 'Audit: %s\n' "$(basename "$audit_path")"
  printf 'Manifest: %s\n\n' "$(basename "$manifest_path")"
  printf 'Primary packages (.nupkg and matching .snupkg):\n'
  printf -- '- %s\n' "${package_ids[@]}"
  printf '\nGenerated UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$readme_path"
printf '%s packages passed audit and isolated consumer verification in %s\n' "${package_ids[*]}" "$package_output"
