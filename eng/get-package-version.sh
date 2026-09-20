#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROPS_PATH="${1:-$REPO_ROOT/dotnet/Directory.Build.props}"

if [[ ! -f "$PROPS_PATH" ]]; then
  echo "Version props file does not exist: $PROPS_PATH" >&2
  exit 1
fi

extract_property() {
  local name="$1"
  sed -n "s:.*<$name>\\(.*\\)</$name>.*:\\1:p" "$PROPS_PATH" | head -n 1 | tr -d '\r' | xargs
}

VERSION="$(extract_property Version)"
if [[ -n "$VERSION" ]]; then
  echo "$VERSION"
  exit 0
fi

VERSION_PREFIX="$(extract_property VersionPrefix)"
if [[ -z "$VERSION_PREFIX" ]]; then
  echo "VersionPrefix is missing from $PROPS_PATH" >&2
  exit 1
fi

VERSION_SUFFIX="$(extract_property VersionSuffix)"
if [[ -n "$VERSION_SUFFIX" ]]; then
  echo "$VERSION_PREFIX-$VERSION_SUFFIX"
else
  echo "$VERSION_PREFIX"
fi
