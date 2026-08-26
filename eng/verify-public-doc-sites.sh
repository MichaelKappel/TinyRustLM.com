#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "$script_dir/.." && pwd -P)"
report_output=""
site_roots=()

while (($# > 0)); do
  case "$1" in
    --report-output)
      if (($# < 2)); then
        printf '%s\n' 'Missing value for --report-output.' >&2
        exit 2
      fi
      report_output="$2"
      shift 2
      ;;
    --)
      shift
      while (($# > 0)); do
        site_roots+=("$1")
        shift
      done
      ;;
    -* )
      printf 'Unknown option: %s\n' "$1" >&2
      exit 2
      ;;
    *)
      site_roots+=("$1")
      shift
      ;;
  esac
done

python3 - "$repo_root" "$report_output" "${site_roots[@]}" <<'PY'
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile

repo_root = Path(sys.argv[1]).resolve(strict=True)
source_root = repo_root.parent
requested_report = sys.argv[2]
requested_roots = [Path(value).resolve(strict=False) for value in sys.argv[3:]]
maximum_document_bytes = 8 * 1024 * 1024
now = dt.datetime.now(dt.timezone.utc)
checked_at_utc = now.isoformat().replace("+00:00", "Z")
run_id = now.strftime("%Y%m%dT%H%M%S%fZ")
report_output = (
    Path(requested_report).resolve(strict=False)
    if requested_report
    else repo_root / "artifacts" / "reports" / f"tinyrustlm-public-doc-sites-audit-{run_id}.json"
)

if report_output.exists():
    raise SystemExit(f"ReportOutput is create-only and already exists: {report_output}")

site_names = (
    "TinyRustLM.com",
    "TinyRustLM.MiRust.com",
    "MiniModel.org",
    "MiniModel.MiRust.com",
)


def default_site_root(site_name: str) -> Path:
    candidates = (source_root / "Rust" / site_name, source_root / site_name)
    return next((path.resolve() for path in candidates if path.is_dir()), candidates[0].resolve(strict=False))


resolved_sites: dict[str, Path] = {}
for root in requested_roots:
    site_name = root.name
    if site_name not in site_names:
        expected = ", ".join(site_names)
        raise SystemExit(f"Unsupported site root '{root}'. Expected one of: {expected}")
    if site_name in resolved_sites:
        raise SystemExit(f"Duplicate site root for {site_name}")
    resolved_sites[site_name] = root
for site_name in site_names:
    resolved_sites.setdefault(site_name, default_site_root(site_name))

old_browser_prefix = "UAIX" + ".Browser"
old_converter_name = "tinyrustlm" + "-slm-pack"
old_composition_name = "ACG" + "1"
forbidden_patterns = (
    re.escape(old_browser_prefix),
    r"TinyRustLM\.Memory(?!Endpoints)",
    re.escape(old_converter_name),
    re.escape("." + old_composition_name.casefold()) + r"(?:\b|`)",
    r"\b" + re.escape(old_composition_name) + r"\b",
    r"\bproduct\s+V2\b",
    r"download(?:ing)?\s+(?:a\s+)?(?:conversion\s+)?(?:request|script|text\s+file)",
    r"download(?:ing)?\s+(?:a\s+)?\.txt",
)

publication_terms = ("Last published", "Release date", "Update")
package_terms = (
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P",
    "SLM2",
    "public readback",
)
tinyrustlm_terms = (
    "browser-local",
    "P2P-first",
    "local conversion",
    "no prompts",
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P",
    "SLM2",
)
minimodel_terms = (
    "direct P2P",
    "does not proxy model bytes",
    "cryptographic",
    "SLM2",
)

site_rules: dict[str, tuple[tuple[str, tuple[str, ...]], ...]] = {
    "TinyRustLM.com": (
        ("README.md", tinyrustlm_terms + publication_terms),
    ),
    "TinyRustLM.MiRust.com": (
        ("README.md", package_terms + publication_terms),
        ("llms.txt", package_terms + publication_terms),
        ("llms-full.txt", package_terms + publication_terms),
        ("docs/long-term-memory.md", package_terms),
    ),
    "MiniModel.org": (
        ("docs/catalog-boundary.md", minimodel_terms + publication_terms),
    ),
    "MiniModel.MiRust.com": (
        ("README.md", minimodel_terms + publication_terms),
        ("llms.txt", minimodel_terms + publication_terms),
        ("llms-full.txt", minimodel_terms + publication_terms),
        ("docs/catalog-boundary.md", minimodel_terms),
    ),
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def document_check(site_name: str, site_root: Path, relative_path: str, required_terms: tuple[str, ...]) -> dict:
    path = site_root / relative_path
    exists = path.is_file()
    byte_length = path.stat().st_size if exists else 0
    bounded = exists and byte_length <= maximum_document_bytes
    decode_error = ""
    text = ""
    if bounded:
        try:
            text = path.read_text(encoding="utf-8", errors="strict")
        except UnicodeDecodeError as error:
            decode_error = f"invalid_utf8_at_byte_{error.start}"
    missing_terms = [term for term in required_terms if term.casefold() not in text.casefold()]
    forbidden_matches = [
        pattern
        for pattern in forbidden_patterns
        if re.search(pattern, text, flags=re.IGNORECASE)
    ]
    status = (
        "pass"
        if bounded and not decode_error and not missing_terms and not forbidden_matches
        else "fail"
    )
    return {
        "site": site_name,
        "relative_path": relative_path.replace("\\", "/"),
        "exists": exists,
        "bounded": bounded,
        "byte_length": byte_length,
        "sha256": sha256_file(path) if exists else "",
        "decode_error": decode_error,
        "status": status,
        "required_terms": list(required_terms),
        "missing_terms": missing_terms,
        "forbidden_pattern_count": len(forbidden_patterns),
        "forbidden_matches": forbidden_matches,
    }


sites: list[dict] = []
checks: list[dict] = []
for site_name in site_names:
    site_root = resolved_sites[site_name]
    sites.append(
        {
            "name": site_name,
            "configured_root_sha256": hashlib.sha256(str(site_root).encode("utf-8")).hexdigest(),
            "exists": site_root.is_dir(),
            "required_document_count": len(site_rules[site_name]),
        }
    )
    for relative_path, required_terms in site_rules[site_name]:
        checks.append(document_check(site_name, site_root, relative_path, required_terms))

failed_checks = [check for check in checks if check["status"] != "pass"]
missing_sites = [site for site in sites if not site["exists"]]
report = {
    "schema": "tinyrustlm.public_doc_sites_audit.v1",
    "checked_at_utc": checked_at_utc,
    "status": "pass" if not failed_checks and not missing_sites else "fail",
    "product_lifecycle": "prelaunch-single-product",
    "package_graph": ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"],
    "portable_memory_backbone_package": "TinyRustLM.MemoryEndpoints",
    "portable_memory_service": "https://memoryendpoints.com",
    "portable_memory_recommendation": "strongly-recommended",
    "local_file_memory": "supported",
    "private_package": "TinyRustLM.Conversion",
    "current_model_format": "SLM2",
    "model_flow": "verified-p2p-first-otherwise-reviewed-local-conversion",
    "maximum_document_bytes": maximum_document_bytes,
    "site_count": len(sites),
    "missing_site_count": len(missing_sites),
    "check_count": len(checks),
    "failed_check_count": len(failed_checks),
    "sites": sites,
    "checks": checks,
    "secret_material_included": False,
    "absolute_site_paths_included": False,
}

report_output.parent.mkdir(parents=True, exist_ok=True)
payload = (json.dumps(report, indent=2, ensure_ascii=True) + "\n").encode("utf-8")
temporary_fd, temporary_name = tempfile.mkstemp(
    prefix=f".{report_output.name}.",
    suffix=".tmp",
    dir=report_output.parent,
)
temporary_path = Path(temporary_name)
try:
    with os.fdopen(temporary_fd, "wb", closefd=True) as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    os.link(temporary_path, report_output)
    temporary_path.unlink()
    directory_fd = os.open(report_output.parent, os.O_RDONLY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
finally:
    temporary_path.unlink(missing_ok=True)

print(f"TinyRustLM public documentation audit written to {report_output}")
if report["status"] != "pass":
    raise SystemExit(
        f"Public documentation audit failed: {len(failed_checks)} document checks failed "
        f"and {len(missing_sites)} site roots are missing."
    )
PY
