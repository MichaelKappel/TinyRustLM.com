#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_source="${1:-$repo_root/artifacts/packages}"
package_version="${2:-$("$repo_root/eng/get-package-version.sh")}"
# One owner runs canonical source without changing the caller's feed-path base.
exec node "$repo_root/eng/verify-consumer.js" "$package_source" "$package_version"
