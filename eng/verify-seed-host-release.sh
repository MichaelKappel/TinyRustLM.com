#!/usr/bin/env bash
set -euo pipefail

release_directory=""
version=""
rid=""
qemu_aarch64=""
arm64_sysroot=""

while (($#)); do
  case "$1" in
    --release-dir)
      release_directory=${2:?missing value for --release-dir}
      shift 2
      ;;
    --version)
      version=${2:?missing value for --version}
      shift 2
      ;;
    --rid)
      rid=${2:?missing value for --rid}
      shift 2
      ;;
    --qemu-aarch64)
      qemu_aarch64=${2:?missing value for --qemu-aarch64}
      shift 2
      ;;
    --arm64-sysroot)
      arm64_sysroot=${2:?missing value for --arm64-sysroot}
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 64
      ;;
  esac
done

case "$rid" in
  linux-x64|linux-arm64) ;;
  *)
    printf 'Expected --rid linux-x64 or linux-arm64\n' >&2
    exit 64
    ;;
esac
test -n "$version" || { printf 'Expected --version\n' >&2; exit 64; }
test -d "$release_directory" || { printf 'Release directory does not exist\n' >&2; exit 66; }
release_directory=$(readlink -f "$release_directory")

package_id=UAIX.Browser.p2pRuntime.SeedHost.Tool
archive_name="$package_id.$version-$rid.tar.gz"
archive_path="$release_directory/$archive_name"
checksum_path="$release_directory/SHA256SUMS-$package_id-$version.txt"
test -f "$archive_path" || { printf 'Archive is missing: %s\n' "$archive_path" >&2; exit 66; }
test -f "$checksum_path" || { printf 'Checksum manifest is missing\n' >&2; exit 66; }

expected_sha=$(tr -d '\r' < "$checksum_path" | awk -v name="$archive_name" '$2 == name { print $1 }')
[[ $expected_sha =~ ^[0-9a-f]{64}$ ]] || { printf 'Archive checksum entry is invalid\n' >&2; exit 65; }
actual_sha=$(sha256sum "$archive_path" | awk '{ print $1 }')
test "$actual_sha" = "$expected_sha" || { printf 'Archive checksum mismatch\n' >&2; exit 65; }

entry_list=$(mktemp /tmp/uaix-seed-host-entries.XXXXXX)
normalized_list=$(mktemp /tmp/uaix-seed-host-normalized.XXXXXX)
extraction_root=$(mktemp -d /tmp/uaix-seed-host-release-verify.XXXXXX)
cleanup() {
  rm -f -- "$entry_list" "$normalized_list"
  local resolved
  resolved=$(readlink -f "$extraction_root")
  case "$resolved" in
    /tmp/uaix-seed-host-release-verify.*) rm -rf -- "$resolved" ;;
    *) printf 'Refusing unsafe verification cleanup: %s\n' "$resolved" >&2 ;;
  esac
}
trap cleanup EXIT

tar -tzf "$archive_path" > "$entry_list"
test -s "$entry_list" || { printf 'Archive is empty\n' >&2; exit 65; }
while IFS= read -r entry; do
  normalized=${entry#./}
  case "$normalized" in
    "") continue ;;
    /*|[A-Za-z]:*) printf 'Unsafe absolute archive path: %s\n' "$entry" >&2; exit 65 ;;
  esac
  IFS='/' read -r -a segments <<< "$normalized"
  for segment in "${segments[@]}"; do
    test "$segment" != ".." || { printf 'Unsafe archive traversal path: %s\n' "$entry" >&2; exit 65; }
  done
  printf '%s\n' "$normalized" >> "$normalized_list"
done < "$entry_list"
duplicate=$(LC_ALL=C sort "$normalized_list" | uniq -d | head -n 1 || true)
test -z "$duplicate" || { printf 'Duplicate archive path: %s\n' "$duplicate" >&2; exit 65; }

expected_app=uaix-p2p-seed
expected_server="runtimes/$rid/native/minimodel"
expected_library="runtimes/$rid/native/libminimodel_native.so"
expected_converter="runtimes/$rid/native/tinyrustlm-slm-pack"
for required in "$expected_app" "$expected_server" "$expected_library" "$expected_converter" README.md LICENSE.txt RELEASE.json; do
  grep -Fqx "$required" "$normalized_list" || { printf 'Required archive file is missing: %s\n' "$required" >&2; exit 65; }
done
if grep -E '^runtimes/(win-x64|linux-(x64|arm64))/native/' "$normalized_list" |
    grep -Fv "runtimes/$rid/native/" >/dev/null; then
  printf 'Archive contains native assets for another RID\n' >&2
  exit 65
fi
if grep -Ei '\.(slm|safetensors|gguf|onnx)$' "$normalized_list" >/dev/null; then
  printf 'Release archive must not contain model weights\n' >&2
  exit 65
fi

while IFS= read -r verbose_entry; do
  mode=${verbose_entry%% *}
  path=${verbose_entry##* }
  case "$path" in
    "$expected_app"|"$expected_server"|"$expected_converter") expected_mode=-rwxr-xr-x ;;
    *) expected_mode=-rw-r--r-- ;;
  esac
  test "$mode" = "$expected_mode" || {
    printf 'Unexpected archive mode %s for %s; expected %s\n' "$mode" "$path" "$expected_mode" >&2
    exit 65
  }
done < <(tar -tvzf "$archive_path")

tar -xzf "$archive_path" -C "$extraction_root"
test -x "$extraction_root/$expected_app" || { printf 'Extracted apphost is not executable\n' >&2; exit 65; }
test -x "$extraction_root/$expected_server" || { printf 'Extracted MiniModel server is not executable\n' >&2; exit 65; }
test -x "$extraction_root/$expected_converter" || { printf 'Extracted TinyRustLM converter is not executable\n' >&2; exit 65; }

runner=()
invariant_environment=()
if [[ $rid == linux-x64 ]]; then
  test "$(uname -m)" = x86_64 || { printf 'linux-x64 verification requires an x86_64 host\n' >&2; exit 69; }
else
  if [[ $(uname -m) != aarch64 ]]; then
    test -x "$qemu_aarch64" || { printf 'linux-arm64 verification requires --qemu-aarch64\n' >&2; exit 69; }
    test -d "$arm64_sysroot" || { printf 'linux-arm64 verification requires --arm64-sysroot\n' >&2; exit 69; }
    runner=("$qemu_aarch64" -L "$arm64_sysroot")
    invariant_environment=(env DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1)
  fi
fi

run_app() {
  "${invariant_environment[@]}" "${runner[@]}" "$extraction_root/$expected_app" "$@"
}
run_server() {
  "${runner[@]}" "$extraction_root/$expected_server" "$@"
}

doctor_json=$(run_app doctor --json)
grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' <<< "$doctor_json"
grep -Eq "\"runtime_identifier\"[[:space:]]*:[[:space:]]*\"$rid\"" <<< "$doctor_json"
grep -Eq '"native_abi_version"[[:space:]]*:[[:space:]]*2' <<< "$doctor_json"
grep -Eq '"ready"[[:space:]]*:[[:space:]]*true' <<< "$doctor_json"

fleet_root="$extraction_root/fleet"
init_json=$(run_app init --fleet-id "archive-$rid-smoke" --root "$fleet_root" --json)
grep -Eq '"target_model_count"[[:space:]]*:[[:space:]]*20' <<< "$init_json"
grep -Eq '"replica_lane_count"[[:space:]]*:[[:space:]]*2' <<< "$init_json"
server_json=$(run_server inspect-seed-fleet "$fleet_root/seed-fleet.v0.json")
grep -Fqx 'MiniModel seed fleet inspection: PASS' <<< "$server_json"
grep -Fqx 'target_model_count: 20' <<< "$server_json"
grep -Fqx 'replica_lane_count: 2' <<< "$server_json"
inspect_json=$(run_app inspect --root "$fleet_root" --json)
grep -Eq '"remaining_model_capacity"[[:space:]]*:[[:space:]]*20' <<< "$inspect_json"
grep -Eq '"advertisement_status"[[:space:]]*:[[:space:]]*"external-probe-required"' <<< "$inspect_json"

printf 'Verified %s archive execution, ABI v2, and empty two-lane fleet lifecycle.\n' "$rid"
