#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-$REPO_ROOT/artifacts/packages}"
REPORT_OUTPUT="${2:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-package-audit.json}"

REQUIRED_NATIVE_RIDS=()
if [[ "$#" -gt 2 ]]; then
  for rid_arg in "${@:3}"; do
    IFS=',' read -r -a rid_parts <<< "$rid_arg"
    for rid in "${rid_parts[@]}"; do
      rid="${rid//[$'\t\r\n ']}"
      if [[ -n "$rid" ]]; then
        REQUIRED_NATIVE_RIDS+=("$rid")
      fi
    done
  done
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to write the TinyRustLM NuGet package audit report." >&2
  exit 127
fi

TINYRUSTLM_REPO_ROOT="$REPO_ROOT" python3 - "$PACKAGE_SOURCE" "$REPORT_OUTPUT" "${REQUIRED_NATIVE_RIDS[@]}" <<'PY'
import hashlib
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

package_source = Path(sys.argv[1])
report_output = Path(sys.argv[2])
required_native_rids = [rid for rid in sys.argv[3:] if rid]
repo_root = Path(os.environ["TINYRUSTLM_REPO_ROOT"])

if not package_source.exists():
    raise SystemExit(f"Package source does not exist: {package_source}")
if not package_source.is_dir():
    raise SystemExit(f"Package source is not a directory: {package_source}")

package_files = sorted(package_source.glob("TinyRustLM*.nupkg"), key=lambda path: path.name)
if not package_files:
    raise SystemExit(f"No TinyRustLM packages were found in {package_source}")
symbol_package_files = sorted(package_source.glob("TinyRustLM*.snupkg"), key=lambda path: path.name)

text_extensions = (
    ".nuspec",
    ".props",
    ".targets",
    ".md",
    ".txt",
    ".json",
    ".xml",
    ".ps1",
    ".psm1",
    ".sh",
    ".csproj",
    ".fsproj",
    ".vbproj",
)
absolute_path_rules = (
    (
        "windows_user_or_workspace_path",
        re.compile(r"\b[A-Z]:\\(?:Users|Source|repos|work|workspace|agent|actions-runner|a)\\", re.IGNORECASE),
    ),
    (
        "unix_user_or_workspace_path",
        re.compile(r"/(?:home|Users|mnt|workspace|work|agent|actions-runner|__w|private/var/folders)/", re.IGNORECASE),
    ),
)
private_surface_pattern = re.compile(r"slm_pack|selector|adapter_family|trained_source|breeding", re.IGNORECASE)
source_file_pattern = re.compile(
    r"\.(cs|fs|vb|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|m|mm|swift|kt|kts|java|go|py|ts|tsx|js|jsx|ps1|psm1|psd1|sh|bash)$",
    re.IGNORECASE,
)
debug_symbol_pattern = re.compile(r"\.(pdb|mdb|dbg)$|\.dSYM(?:/|$)", re.IGNORECASE)
generated_output_pattern = re.compile(r"(^|/)(bin|obj|target|artifacts)/", re.IGNORECASE)
native_entry_pattern = re.compile(r"^runtimes/([^/]+)/native/")
xml_documentation_pattern = re.compile(r"^lib/[^/]+/TinyRustLM\.[^/]+\.xml$")


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_zip_entry(archive, entry_name):
    digest = hashlib.sha256()
    with archive.open(entry_name, "r") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_text_package_entry(entry_name):
    lower = entry_name.lower()
    return lower.endswith(text_extensions)


def read_zip_entry_text(archive, entry):
    if entry.file_size > 1024 * 1024:
        return ""
    with archive.open(entry, "r") as handle:
        return handle.read().decode("utf-8", errors="ignore")


def local_name(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def find_first(root, name):
    if root is None:
        return None
    for node in root.iter():
        if local_name(node.tag) == name:
            return node
    return None


def get_xml_text(root, name):
    node = find_first(root, name)
    if node is None or node.text is None:
        return ""
    return node.text.strip()


def source_package_version():
    props_path = repo_root / "dotnet" / "Directory.Build.props"
    try:
        root = ElementTree.parse(props_path).getroot()
    except ElementTree.ParseError as exc:
        raise SystemExit(f"Could not parse {props_path}: {exc}") from exc

    version = get_xml_text(root, "Version")
    if version:
        return version
    prefix = get_xml_text(root, "VersionPrefix")
    if not prefix:
        raise SystemExit(f"VersionPrefix is required in {props_path}")
    suffix = get_xml_text(root, "VersionSuffix")
    return f"{prefix}-{suffix}" if suffix else prefix


def expected_package_names(package_version):
    return [
        f"TinyRustLM.Abstractions.{package_version}.nupkg",
        f"TinyRustLM.Core.{package_version}.nupkg",
        f"TinyRustLM.P2P.{package_version}.nupkg",
        f"TinyRustLM.Memory.{package_version}.nupkg",
    ]


def expected_symbol_package_names(package_version):
    return [
        f"TinyRustLM.Abstractions.{package_version}.snupkg",
        f"TinyRustLM.Core.{package_version}.snupkg",
        f"TinyRustLM.P2P.{package_version}.snupkg",
        f"TinyRustLM.Memory.{package_version}.snupkg",
    ]


def expected_package_id_for_name(package_name, package_version):
    suffix = f".{package_version}.nupkg"
    if package_name.lower().endswith(suffix.lower()):
        return package_name[:-len(suffix)]
    return ""


def expected_symbol_package_id_for_name(package_name, package_version):
    suffix = f".{package_version}.snupkg"
    if package_name.lower().endswith(suffix.lower()):
        return package_name[:-len(suffix)]
    return ""


def parse_nuspec(nuspec_text):
    if not nuspec_text:
        return None
    try:
        return ElementTree.fromstring(nuspec_text)
    except ElementTree.ParseError:
        return None


def read_nuspec_metadata(nuspec_text):
    root = parse_nuspec(nuspec_text)
    if root is None:
        return empty_metadata()

    repository = find_first(root, "repository")
    license_node = find_first(root, "license")
    return {
        "id": get_xml_text(root, "id"),
        "version": get_xml_text(root, "version"),
        "title": get_xml_text(root, "title"),
        "authors": get_xml_text(root, "authors"),
        "description": get_xml_text(root, "description"),
        "project_url": get_xml_text(root, "projectUrl"),
        "repository_url": repository.attrib.get("url", "") if repository is not None else "",
        "repository_type": repository.attrib.get("type", "") if repository is not None else "",
        "license": (license_node.text or "").strip() if license_node is not None else "",
        "license_type": license_node.attrib.get("type", "") if license_node is not None else "",
        "readme": get_xml_text(root, "readme"),
        "tags": get_xml_text(root, "tags"),
        "release_notes": get_xml_text(root, "releaseNotes"),
        "require_license_acceptance": get_xml_text(root, "requireLicenseAcceptance"),
    }


def empty_metadata():
    return {
        "id": "",
        "version": "",
        "title": "",
        "authors": "",
        "description": "",
        "project_url": "",
        "repository_url": "",
        "repository_type": "",
        "license": "",
        "license_type": "",
        "readme": "",
        "tags": "",
        "release_notes": "",
        "require_license_acceptance": "",
    }


def read_nuspec_dependencies(nuspec_text):
    root = parse_nuspec(nuspec_text)
    if root is None:
        return []

    dependencies = []
    for node in root.iter():
        if local_name(node.tag) == "dependency":
            dependencies.append({
                "id": node.attrib.get("id", ""),
                "version": node.attrib.get("version", ""),
                "exclude": node.attrib.get("exclude", ""),
            })
    return dependencies


def missing_metadata_fields(metadata):
    required = (
        "id",
        "version",
        "title",
        "authors",
        "description",
        "project_url",
        "repository_url",
        "repository_type",
        "license",
        "license_type",
        "readme",
        "tags",
        "release_notes",
    )
    missing = [field for field in required if not str(metadata.get(field, "")).strip()]
    if metadata.get("require_license_acceptance") != "true":
        missing.append("require_license_acceptance")
    if metadata.get("license_type") and metadata["license_type"] != "file":
        missing.append("license_type:file")
    if metadata.get("readme") and metadata["readme"] != "README.md":
        missing.append("readme:README.md")
    return missing


def normalize_metadata_url(value):
    normalized = str(value or "").strip()
    if not normalized:
        return ""
    if not normalized.endswith("/"):
        normalized += "/"
    return normalized.lower()


def metadata_policy_violations(package_id, metadata):
    violations = []
    if normalize_metadata_url(metadata.get("project_url", "")) != "https://tinyrustlm.com/":
        violations.append("project_url:https://tinyrustlm.com/")
    if metadata.get("repository_type") != "git":
        violations.append("repository_type:git")
    if metadata.get("license_type") != "file" or metadata.get("license") != "LICENSE.txt":
        violations.append("license_file:LICENSE.txt")
    if metadata.get("readme") != "README.md":
        violations.append("readme:README.md")
    if metadata.get("require_license_acceptance") != "true":
        violations.append("require_license_acceptance:true")
    if "tinyrustlm" not in str(metadata.get("authors", "")).lower():
        violations.append("authors:TinyRustLM")
    title = str(metadata.get("title", "")).lower()
    if "tinyrustlm" not in title or "uaix browser" not in title:
        violations.append("title:TinyRustLM-UAIX-Browser")
    if len(str(metadata.get("description", ""))) < 120:
        violations.append("description:min-120")
    if package_id.lower() not in str(metadata.get("tags", "")).lower():
        violations.append("tags:package-id")
    return violations


def required_search_terms(package_id):
    terms = {
        "TinyRustLM",
        "UAIX",
        "UAIX.org",
        "Rust",
        "AI",
        "UAIX.Browser",
    }
    if package_id == "TinyRustLM.Abstractions":
        terms.update({
            "abstractions",
            "SDK",
            "p2pRuntime",
            "p2pRuntime.com",
            "p2pLLM",
            "p2pLLM.com",
            "MiniModel",
            ".slm",
            ".uai",
            "memory",
            "persona",
        })
    elif package_id == "TinyRustLM.Core":
        terms.update({
            "p2pLLM",
            "p2pLLM.com",
            ".slm",
            "runtime",
            "harness",
            "native",
            "safe",
            "generate",
            "diagnostics",
        })
    elif package_id == "TinyRustLM.P2P":
        terms.update({
            "p2pRuntime",
            "p2pRuntime.com",
            "P2P",
            "peer-to-peer",
            "model-sharing",
            "MiniModel",
            "manifest",
            "announcement",
            "catalog",
            "receipt",
        })
    elif package_id == "TinyRustLM.Memory":
        terms.update({
            "memory",
            "ai-memory",
            ".uai",
            ".uaix",
            "persona",
            "AI Memory Package Wizard",
            "ai-digest",
            "point-agent-urls",
            "canonical-starter-zip",
            "safe-structured-output",
            "agent-pickup",
            "session-log",
            "manifest-overlay",
            "package-model",
            "knowledge-graph",
            "personality-pack",
            "persona-deck",
            "triggered-style-axes",
            "LLM Wiki",
            "file-handoff",
        })
    elif package_id == "TinyRustLM.MemoryEndpoints":
        terms.update({
            "MemoryEndpoints",
            "MemoryEndpoints.com",
            ".uai",
            "memory",
            "offline-first",
            "outbox",
            "idempotency",
            "multi-device",
            "conflict-safe",
            "tombstone",
            "device-revocation",
            "checkpoint",
            "stale-index",
            "prompt-injection-defense",
        })
    return sorted(terms)


def missing_search_terms(package_id, metadata):
    haystack = " ".join((
        str(metadata.get("id", "")),
        str(metadata.get("title", "")),
        str(metadata.get("description", "")),
        str(metadata.get("tags", "")),
        str(metadata.get("release_notes", "")),
        str(metadata.get("project_url", "")),
        str(metadata.get("repository_url", "")),
    )).lower()
    return [
        term for term in required_search_terms(package_id)
        if term.lower() not in haystack
    ]


def declared_package_file_entries(metadata):
    declared = []
    if metadata.get("readme", "").strip():
        declared.append(metadata["readme"].strip())
    if metadata.get("license_type") == "file" and metadata.get("license", "").strip():
        declared.append(metadata["license"].strip())
    return sorted(set(declared))


def package_documentation_entries(entry_names):
    return [
        name for name in entry_names
        if name == "README.md" or name == "LICENSE.txt" or (name.startswith("docs/") and name.endswith(".md"))
    ]


def expected_package_documentation_entries(package_id):
    entries = [
        {"entry": "README.md", "source": "docs/nuget/README.md"},
        {"entry": "LICENSE.txt", "source": "docs/nuget/LICENSE.txt"},
    ]
    if package_id == "TinyRustLM.Core":
        entries.append({"entry": "docs/PACKAGE_SECURITY.md", "source": "docs/nuget/PACKAGE_SECURITY.md"})
    elif package_id == "TinyRustLM.P2P":
        entries.append({"entry": "docs/API_BOUNDARY.md", "source": "docs/nuget/API_BOUNDARY.md"})
        entries.append({"entry": "docs/P2P_SHARE_FLOW.md", "source": "docs/nuget/P2P_SHARE_FLOW.md"})
    elif package_id == "TinyRustLM.Memory":
        entries.append({"entry": "docs/API_BOUNDARY.md", "source": "docs/nuget/API_BOUNDARY.md"})
        entries.append({"entry": "docs/MEMORY_HARNESS.md", "source": "docs/nuget/MEMORY_HARNESS.md"})
    elif package_id == "TinyRustLM.MemoryEndpoints":
        entries.append({"entry": "docs/API_BOUNDARY.md", "source": "docs/nuget/API_BOUNDARY.md"})
        entries.append({"entry": "docs/MEMORY_HARNESS.md", "source": "docs/nuget/MEMORY_HARNESS.md"})
        entries.append({"entry": "docs/MEMORY_ENDPOINTS_CONNECTOR.md", "source": "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"})
        entries.append({"entry": "docs/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md", "source": "docs/nuget/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md"})
    return entries


def package_documentation_verification(archive, entry_names, package_id):
    verification = []
    for expected in expected_package_documentation_entries(package_id):
        source_path = repo_root / expected["source"]
        source_exists = source_path.exists()
        package_entry_exists = expected["entry"] in entry_names
        source_sha256 = sha256_file(source_path) if source_exists else ""
        package_sha256 = sha256_zip_entry(archive, expected["entry"]) if package_entry_exists else ""
        verification.append({
            "entry": expected["entry"],
            "source": expected["source"],
            "source_exists": source_exists,
            "package_entry_exists": package_entry_exists,
            "source_sha256": source_sha256,
            "package_sha256": package_sha256,
            "sha256_match": source_exists and package_entry_exists and source_sha256 == package_sha256,
        })
    return verification


def xml_documentation_member_names(archive, entry_name):
    if not entry_name:
        return []
    try:
        entry = archive.getinfo(entry_name)
    except KeyError:
        return []
    text = read_zip_entry_text(archive, entry)
    if not text.strip():
        return []
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return []
    names = sorted({
        node.attrib.get("name", "")
        for node in root.iter()
        if local_name(node.tag) == "member" and node.attrib.get("name", "").strip()
    })
    return names


def expected_public_api_entries(package_id):
    if package_id == "TinyRustLM.MemoryEndpoints":
        baseline = repo_root / "eng" / "public-api" / "TinyRustLM.MemoryEndpoints.txt"
        if not baseline.is_file():
            raise SystemExit(f"Missing approved MemoryEndpoints public API baseline: {baseline}")
        return sorted({
            line.strip()
            for line in baseline.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        })
    entries = {
        "TinyRustLM.Abstractions": [
            "M:TinyRustLM.ISlmInspector.Inspect(System.String)",
            "M:TinyRustLM.ITinyRustLmMemoryClient.GetRequiredFiles(TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.ITinyRustLmMemoryClient.GetRequiredFilesJson(TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.ITinyRustLmMemoryClient.GetSupportedSetups",
            "M:TinyRustLM.ITinyRustLmMemoryClient.GetSupportedSetupsJson",
            "M:TinyRustLM.ITinyRustLmMemoryClient.InspectManifest(System.String)",
            "M:TinyRustLM.ITinyRustLmMemoryClient.InspectPackage(System.String,TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.ITinyRustLmMemoryClient.ValidatePackage(System.String,TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ApplyReceivedAnnouncement(System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ApplyReceivedAnnouncementJson(System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ExportShareMetadata(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ExportShareMetadataJson(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ImportFromManifest(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ImportFromManifest(System.String,System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.InspectAnnouncementCatalog(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.InspectAnnouncementCatalogJson(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.InspectLocalImportReceipt(System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.InspectManifest(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.PrepareLocalShareKit(TinyRustLM.PrepareShareKitRequest)",
            "M:TinyRustLM.ITinyRustLmP2PClient.PrepareLocalShareKitJson(TinyRustLM.PrepareShareKitRequest)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ValidateAnnouncement(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.ValidateAnnouncementJson(System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.VerifySignedManifest(System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmP2PClient.VerifySignedManifestJson(System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmRuntime.Generate(System.String,TinyRustLM.TinyRustLmGenerationOptions)",
            "M:TinyRustLM.ITinyRustLmRuntime.GetDiagnostics",
            "M:TinyRustLM.ITinyRustLmRuntime.LoadModel(System.String,System.String)",
            "M:TinyRustLM.ITinyRustLmRuntime.Reset",
            "M:TinyRustLM.ITinyRustLmRuntime.Step",
            "M:TinyRustLM.ITinyRustLmRuntime.UnloadModel",
            "M:TinyRustLM.ITinyRustLmRuntimeFactory.CreateRuntime",
            "M:TinyRustLM.ITinyRustLmRuntimeFactory.GetCapabilities",
            "M:TinyRustLM.ITinyRustLmRuntimeFactory.GetVersion",
            "M:TinyRustLM.P2PAnnouncement.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.String,System.Int64,System.Boolean,System.Int64)",
            "M:TinyRustLM.P2PAnnouncementCatalog.#ctor(System.String,System.Int32,System.Collections.Generic.IReadOnlyList{TinyRustLM.P2PAnnouncement})",
            "M:TinyRustLM.P2PAnnouncementCatalogInspection.#ctor(System.String,System.Int32,System.String,System.Int32,System.Int32,System.Int32,System.Int32,System.Int64,System.Boolean)",
            "M:TinyRustLM.P2PImportPlan.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Collections.Generic.IReadOnlyList{TinyRustLM.P2PPiece},System.String)",
            "M:TinyRustLM.P2PLocalImportBoundary.#ctor(System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean)",
            "M:TinyRustLM.P2PLocalImportReceipt.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Int64,System.String,System.String,System.String,System.Int64,System.Int32,System.Int32,System.Int64,TinyRustLM.P2PLocalImportBoundary)",
            "M:TinyRustLM.P2PLocalImportReceiptInspection.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.Int64,System.String,System.String,System.String,System.Int64,System.Int32,System.Int32,System.Boolean,TinyRustLM.P2PLocalImportBoundary)",
            "M:TinyRustLM.P2PManifest.#ctor(System.String,System.Int32,System.String,System.String,TinyRustLM.SlmInspection,System.String,System.Int64,System.Int64,System.Int32,System.Collections.Generic.IReadOnlyList{TinyRustLM.P2PPiece},System.Int64,TinyRustLM.P2PManifestBoundary)",
            "M:TinyRustLM.P2PManifestBoundary.#ctor(System.Boolean,System.Boolean,System.Boolean,System.Boolean)",
            "M:TinyRustLM.P2PManifestInspection.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Int64,System.Int32,System.Int64,System.Boolean)",
            "M:TinyRustLM.P2PManifestSignature.#ctor(System.String,System.String,System.String,System.String,System.String,System.String)",
            "M:TinyRustLM.P2PPiece.#ctor(System.Int32,System.String,System.Int64,System.String)",
            "M:TinyRustLM.P2PPublicKeyDocument.#ctor(System.String,System.String,System.String,System.String,System.String,System.String,System.String,System.String,System.String,System.Boolean)",
            "M:TinyRustLM.P2PShareKitReport.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.String,System.String,TinyRustLM.P2PManifest)",
            "M:TinyRustLM.P2PShareMetadata.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Int64,System.Int32,System.Int64,TinyRustLM.P2PManifestBoundary)",
            "M:TinyRustLM.P2PSignedManifest.#ctor(System.String,System.Int32,TinyRustLM.P2PManifest,TinyRustLM.P2PManifestSignature)",
            "M:TinyRustLM.P2PSignedManifestVerification.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.String,System.String,System.String,System.String,System.Boolean)",
            "M:TinyRustLM.PrepareShareKitRequest.#ctor(System.String,System.String,System.String,System.String,System.String,System.String,System.Nullable{System.Int64})",
            "M:TinyRustLM.SlmInspection.#ctor(System.String,System.Int32,System.String,System.Int64,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int64,System.Int32,System.Int32,System.Int32,System.Int32,System.String,System.UInt64)",
            "M:TinyRustLM.TinyRustLmCapabilities.#ctor(System.String,System.Int32,System.String,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Collections.Generic.IReadOnlyList{System.String})",
            "M:TinyRustLM.TinyRustLmGenerationOptions.#ctor(System.Int32,System.Single,System.Int32,System.Single,System.UInt32)",
            "M:TinyRustLM.TinyRustLmGenerationResult.#ctor(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmLoadReport.#ctor(TinyRustLM.SlmInspection,System.String)",
            "M:TinyRustLM.TinyRustLmSdkVersion.#ctor(System.String,System.Int32,System.String)",
            "M:TinyRustLM.UaixAdvancedPersonaOptions.#ctor(System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Byte,System.Byte,System.Byte,System.Byte,System.Byte,System.Byte)",
            "M:TinyRustLM.UaixMemoryBoundary.#ctor(System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean)",
            "M:TinyRustLM.UaixMemoryFileStatus.#ctor(System.String,System.String,System.String,System.Boolean,System.Int64,System.String)",
            "M:TinyRustLM.UaixMemoryManifestInspection.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.Boolean,System.Int32,System.Collections.Generic.IReadOnlyList{System.String},System.Boolean,System.Collections.Generic.IReadOnlyList{System.String})",
            "M:TinyRustLM.UaixMemoryFileDeckSummary.#ctor(System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean)",
            "M:TinyRustLM.UaixMemoryPackageInspection.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.Collections.Generic.IReadOnlyList{TinyRustLM.UaixMemoryFileStatus},TinyRustLM.UaixMemoryFileDeckSummary,System.Collections.Generic.IReadOnlyList{TinyRustLM.UaixPersonaDimensionInspection},System.Boolean,System.Int32,System.Collections.Generic.IReadOnlyList{System.String},System.Collections.Generic.IReadOnlyList{System.String},System.Boolean,System.Int32,System.Boolean,TinyRustLM.UaixMemoryManifestInspection,TinyRustLM.UaixMemoryBoundary)",
            "M:TinyRustLM.UaixMemoryPackagePlan.#ctor(System.String,System.Int32,System.String,System.Collections.Generic.IReadOnlyList{TinyRustLM.UaixMemoryRequiredFile},TinyRustLM.UaixMemoryFileDeckSummary,System.Int32,System.Collections.Generic.IReadOnlyList{System.String},TinyRustLM.UaixMemoryBoundary)",
            "M:TinyRustLM.UaixMemoryPackageRequest.#ctor(System.String,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,TinyRustLM.UaixAdvancedPersonaOptions)",
            "M:TinyRustLM.UaixMemoryRequiredFile.#ctor(System.String,System.String,System.String,System.String)",
            "M:TinyRustLM.UaixMemorySetupCatalog.#ctor(System.String,System.Int32,System.Collections.Generic.IReadOnlyList{TinyRustLM.UaixMemorySetupDescriptor},System.Int32,System.Collections.Generic.IReadOnlyList{System.String},TinyRustLM.UaixMemoryBoundary)",
            "M:TinyRustLM.UaixMemorySetupDescriptor.#ctor(System.String,System.String,System.String,System.String,System.Collections.Generic.IReadOnlyList{System.String},System.Collections.Generic.IReadOnlyList{System.String},System.Collections.Generic.IReadOnlyList{System.String})",
            "M:TinyRustLM.UaixPersonaDimensionInspection.#ctor(System.String,System.String,System.Boolean,System.Int64,System.String,System.Boolean,System.Nullable{System.Byte},System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Collections.Generic.IReadOnlyList{System.String})",
            "P:TinyRustLM.TinyRustLmGenerationOptions.MaxNewTokens",
            "P:TinyRustLM.TinyRustLmGenerationOptions.Seed",
            "P:TinyRustLM.TinyRustLmGenerationOptions.Temperature",
            "P:TinyRustLM.TinyRustLmGenerationOptions.TopK",
            "P:TinyRustLM.TinyRustLmGenerationOptions.TopP",
            "T:TinyRustLM.ISlmInspector",
            "T:TinyRustLM.ITinyRustLmMemoryClient",
            "T:TinyRustLM.ITinyRustLmP2PClient",
            "T:TinyRustLM.ITinyRustLmRuntime",
            "T:TinyRustLM.ITinyRustLmRuntimeFactory",
            "T:TinyRustLM.P2PAnnouncement",
            "T:TinyRustLM.P2PAnnouncementCatalog",
            "T:TinyRustLM.P2PAnnouncementCatalogInspection",
            "T:TinyRustLM.P2PImportPlan",
            "T:TinyRustLM.P2PLocalImportBoundary",
            "T:TinyRustLM.P2PLocalImportReceipt",
            "T:TinyRustLM.P2PLocalImportReceiptInspection",
            "T:TinyRustLM.P2PManifest",
            "T:TinyRustLM.P2PManifestBoundary",
            "T:TinyRustLM.P2PManifestInspection",
            "T:TinyRustLM.P2PManifestSignature",
            "T:TinyRustLM.P2PPiece",
            "T:TinyRustLM.P2PPublicKeyDocument",
            "T:TinyRustLM.P2PShareKitReport",
            "T:TinyRustLM.P2PShareMetadata",
            "T:TinyRustLM.P2PSignedManifest",
            "T:TinyRustLM.P2PSignedManifestVerification",
            "T:TinyRustLM.PrepareShareKitRequest",
            "T:TinyRustLM.SlmInspection",
            "T:TinyRustLM.TinyRustLmCapabilities",
            "T:TinyRustLM.TinyRustLmGenerationOptions",
            "T:TinyRustLM.TinyRustLmGenerationResult",
            "T:TinyRustLM.TinyRustLmLoadReport",
            "T:TinyRustLM.TinyRustLmSdkVersion",
            "T:TinyRustLM.UaixAdvancedPersonaOptions",
            "T:TinyRustLM.UaixMemoryBoundary",
            "T:TinyRustLM.UaixMemoryFileStatus",
            "T:TinyRustLM.UaixMemoryFileDeckSummary",
            "T:TinyRustLM.UaixMemoryManifestInspection",
            "T:TinyRustLM.UaixMemoryPackageInspection",
            "T:TinyRustLM.UaixMemoryPackagePlan",
            "T:TinyRustLM.UaixMemoryPackageRequest",
            "T:TinyRustLM.UaixMemoryRequiredFile",
            "T:TinyRustLM.UaixMemorySetupCatalog",
            "T:TinyRustLM.UaixMemorySetupDescriptor",
            "T:TinyRustLM.UaixPersonaDimensionInspection",
        ],
        "TinyRustLM.Core": [
            "M:TinyRustLM.TinyRustLmException.#ctor(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmRuntime.Dispose",
            "M:TinyRustLM.TinyRustLmRuntime.Generate(System.String,TinyRustLM.TinyRustLmGenerationOptions)",
            "M:TinyRustLM.TinyRustLmRuntime.GetDiagnostics",
            "M:TinyRustLM.TinyRustLmRuntime.LoadModel(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmRuntime.Reset",
            "M:TinyRustLM.TinyRustLmRuntime.Step",
            "M:TinyRustLM.TinyRustLmRuntime.UnloadModel",
            "M:TinyRustLM.TinyRustLmRuntimeFactory.CreateRuntime",
            "M:TinyRustLM.TinyRustLmRuntimeFactory.GetCapabilities",
            "M:TinyRustLM.TinyRustLmRuntimeFactory.GetVersion",
            "M:TinyRustLM.TinySlmInspector.Inspect(System.String)",
            "P:TinyRustLM.TinyRustLmException.Code",
            "T:TinyRustLM.TinyRustLmException",
            "T:TinyRustLM.TinyRustLmRuntime",
            "T:TinyRustLM.TinyRustLmRuntimeFactory",
            "T:TinyRustLM.TinySlmInspector",
        ],
        "TinyRustLM.P2P": [
            "M:TinyRustLM.TinyRustLmP2PClient.ApplyReceivedAnnouncement(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.ApplyReceivedAnnouncementJson(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.ExportShareMetadata(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.ExportShareMetadataJson(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.ImportFromManifest(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.ImportFromManifest(System.String,System.String,System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.InspectAnnouncementCatalog(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.InspectAnnouncementCatalogJson(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.InspectLocalImportReceipt(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.InspectManifest(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.PrepareLocalShareKit(TinyRustLM.PrepareShareKitRequest)",
            "M:TinyRustLM.TinyRustLmP2PClient.PrepareLocalShareKitJson(TinyRustLM.PrepareShareKitRequest)",
            "M:TinyRustLM.TinyRustLmP2PClient.ValidateAnnouncement(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.ValidateAnnouncementJson(System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.VerifySignedManifest(System.String,System.String)",
            "M:TinyRustLM.TinyRustLmP2PClient.VerifySignedManifestJson(System.String,System.String)",
            "T:TinyRustLM.TinyRustLmP2PClient",
        ],
        "TinyRustLM.Memory": [
            "M:TinyRustLM.TinyRustLmMemoryClient.GetRequiredFiles(TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.TinyRustLmMemoryClient.GetRequiredFilesJson(TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.TinyRustLmMemoryClient.GetSupportedSetups",
            "M:TinyRustLM.TinyRustLmMemoryClient.GetSupportedSetupsJson",
            "M:TinyRustLM.TinyRustLmMemoryClient.InspectManifest(System.String)",
            "M:TinyRustLM.TinyRustLmMemoryClient.InspectPackage(System.String,TinyRustLM.UaixMemoryPackageRequest)",
            "M:TinyRustLM.TinyRustLmMemoryClient.ValidatePackage(System.String,TinyRustLM.UaixMemoryPackageRequest)",
            "T:TinyRustLM.TinyRustLmMemoryClient",
        ],
    }
    return entries.get(package_id, [])


def missing_public_api_entries(expected, actual):
    actual_set = set(actual)
    return [entry for entry in expected if entry not in actual_set]


def unexpected_public_api_entries(expected, actual):
    expected_set = set(expected)
    return [entry for entry in actual if entry not in expected_set]


def allowed_package_entry_patterns(package_id):
    patterns = [
        "[Content_Types].xml",
        "_rels/.rels",
        f"{package_id}.nuspec",
        "README.md",
        "LICENSE.txt",
        "package/services/metadata/core-properties/*.psmdcp",
        f"lib/net8.0/{package_id}.dll",
        f"lib/net8.0/{package_id}.xml",
    ]
    for expected in expected_package_documentation_entries(package_id):
        if expected["entry"] not in patterns:
            patterns.append(expected["entry"])
    patterns.extend(allowed_native_entries(package_id))
    return patterns


def package_entry_allowed(package_id, entry_name, allowed_native):
    literal_entries = {
        "[Content_Types].xml",
        "_rels/.rels",
        f"{package_id}.nuspec",
        "README.md",
        "LICENSE.txt",
        f"lib/net8.0/{package_id}.dll",
        f"lib/net8.0/{package_id}.xml",
    }
    if entry_name in literal_entries:
        return True
    if re.fullmatch(r"package/services/metadata/core-properties/[^/]+\.psmdcp", entry_name):
        return True
    if entry_name in {entry["entry"] for entry in expected_package_documentation_entries(package_id)}:
        return True
    return entry_name in allowed_native


def unexpected_package_content_entries(package_id, entry_names, allowed_native):
    return [
        entry_name for entry_name in entry_names
        if not package_entry_allowed(package_id, entry_name, allowed_native)
    ]


def expected_dependencies(package_id, package_version):
    if package_id == "TinyRustLM.Core":
        return [{
            "id": "TinyRustLM.Abstractions",
            "version": package_version,
            "exclude": "Build,Analyzers",
        }]
    if package_id == "TinyRustLM.P2P":
        return [
            {
                "id": "TinyRustLM.Abstractions",
                "version": package_version,
                "exclude": "Build,Analyzers",
            },
            {
                "id": "TinyRustLM.Core",
                "version": package_version,
                "exclude": "Build,Analyzers",
            },
        ]
    if package_id == "TinyRustLM.Memory":
        return [
            {
                "id": "TinyRustLM.Abstractions",
                "version": package_version,
                "exclude": "Build,Analyzers",
            },
            {
                "id": "TinyRustLM.Core",
                "version": package_version,
                "exclude": "Build,Analyzers",
            },
        ]
    if package_id == "TinyRustLM.MemoryEndpoints":
        return [
            {
                "id": "TinyRustLM.Abstractions",
                "version": package_version,
                "exclude": "Build,Analyzers",
            },
            {
                "id": "TinyRustLM.Memory",
                "version": package_version,
                "exclude": "Build,Analyzers",
            },
        ]
    return []


def missing_dependency_entries(expected, actual):
    return [
        dependency for dependency in expected
        if not any(
            item.get("id") == dependency["id"]
            and item.get("version") == dependency["version"]
            and item.get("exclude") == dependency["exclude"]
            for item in actual
        )
    ]


def unexpected_dependency_entries(expected, actual):
    return [
        dependency for dependency in actual
        if not any(
            item.get("id") == dependency.get("id")
            and item.get("version") == dependency.get("version")
            and item.get("exclude") == dependency.get("exclude")
            for item in expected
        )
    ]


def unexpected_native_entries(package_id, native_entries):
    if package_id != "TinyRustLM.Core":
        return list(native_entries)
    allowed = set(allowed_native_entries(package_id))
    return [entry for entry in native_entries if entry not in allowed]


def allowed_native_entries(package_id):
    if package_id != "TinyRustLM.Core":
        return []
    return [
        "runtimes/win-x64/native/tinyrustlm_native.dll",
        "runtimes/linux-x64/native/libtinyrustlm_native.so",
        "runtimes/osx-x64/native/libtinyrustlm_native.dylib",
        "runtimes/osx-arm64/native/libtinyrustlm_native.dylib",
    ]


def package_identity_mismatches(package_name, expected_id, expected_version, metadata):
    if not expected_id:
        return []
    actual_id = metadata.get("id", "")
    actual_version = metadata.get("version", "")
    if actual_id == expected_id and actual_version == expected_version:
        return []
    return [{
        "name": package_name,
        "expected_id": expected_id,
        "actual_id": actual_id,
        "expected_version": expected_version,
        "actual_version": actual_version,
    }]


def has_symbols_package_type(nuspec_text):
    root = parse_nuspec(nuspec_text)
    if root is None:
        return False
    for node in root.iter():
        if local_name(node.tag) == "packageType" and node.attrib.get("name", "") == "SymbolsPackage":
            return True
    return False


def symbol_package_identity_mismatches(
    package_name,
    expected_id,
    expected_version,
    metadata,
    has_symbols_type,
):
    mismatches = package_identity_mismatches(
        package_name,
        expected_id,
        expected_version,
        metadata,
    )
    if not has_symbols_type:
        mismatches.append({
            "name": package_name,
            "expected_package_type": "SymbolsPackage",
            "actual_package_type": "",
        })
    return mismatches


def symbol_package_entry_allowed(entry_name):
    if entry_name in ("[Content_Types].xml", "_rels/.rels"):
        return True
    if re.fullmatch(r"[^/]+\.nuspec", entry_name):
        return True
    if re.fullmatch(r"package/services/metadata/core-properties/[^/]+\.psmdcp", entry_name):
        return True
    if re.fullmatch(r"lib/[^/]+/TinyRustLM\.[^/]+\.pdb", entry_name):
        return True
    return False


def unexpected_symbol_package_entries(entry_names):
    return [name for name in entry_names if not symbol_package_entry_allowed(name)]


def absolute_path_matches(archive, entries):
    matches = []
    for entry in entries:
        if not is_text_package_entry(entry.filename):
            continue
        text = read_zip_entry_text(archive, entry)
        if not text:
            continue
        for kind, pattern in absolute_path_rules:
            for match in pattern.finditer(text):
                matches.append({
                    "entry": entry.filename,
                    "kind": kind,
                    "index": match.start(),
                })
    return matches


def infer_package_id(package_path, metadata):
    package_id = metadata.get("id", "")
    if package_id:
        return package_id

    stem = package_path.name[:-len(".nupkg")]
    version = metadata.get("version", "")
    if version and stem.endswith(f".{version}"):
        return stem[:-(len(version) + 1)]
    return stem


def native_rid(entry_name):
    match = native_entry_pattern.match(entry_name)
    return match.group(1) if match else ""


source_version = source_package_version()
expected_names = expected_package_names(source_version)
expected_symbol_names = expected_symbol_package_names(source_version)
package_names = [path.name for path in package_files]
symbol_package_names = [path.name for path in symbol_package_files]
optional_memory_endpoints_name = f"TinyRustLM.MemoryEndpoints.{source_version}.nupkg"
if optional_memory_endpoints_name in package_names:
    expected_names.append(optional_memory_endpoints_name)
    expected_symbol_names.append(f"TinyRustLM.MemoryEndpoints.{source_version}.snupkg")
missing_package_entries = [name for name in expected_names if name not in package_names]
unexpected_package_entries = [name for name in package_names if name not in expected_names]
missing_symbol_package_entries = [name for name in expected_symbol_names if name not in symbol_package_names]
unexpected_symbol_package_entries_for_set = [
    name for name in symbol_package_names
    if name not in expected_symbol_names
]

package_reports = []
for package_path in package_files:
    with zipfile.ZipFile(package_path, "r") as archive:
        infos = sorted(archive.infolist(), key=lambda item: item.filename)
        entry_names = [entry.filename for entry in infos]
        private_matches = [name for name in entry_names if private_surface_pattern.search(name)]
        source_file_entries = [name for name in entry_names if source_file_pattern.search(name)]
        debug_symbol_entries = [name for name in entry_names if debug_symbol_pattern.search(name)]
        generated_output_entries = [name for name in entry_names if generated_output_pattern.search(name)]
        path_matches = absolute_path_matches(archive, infos)
        native_entries = [name for name in entry_names if native_entry_pattern.match(name)]
        native_rids = sorted({native_rid(name) for name in native_entries if native_rid(name)})
        xml_documentation_entries = [name for name in entry_names if xml_documentation_pattern.match(name)]
        xml_documentation_entry = next((name for name in xml_documentation_entries), "")
        nuspec_entry = next((entry for entry in infos if entry.filename.lower().endswith(".nuspec")), None)
        nuspec_text = read_zip_entry_text(archive, nuspec_entry) if nuspec_entry is not None else ""
        metadata = read_nuspec_metadata(nuspec_text)
        expected_package_id = expected_package_id_for_name(package_path.name, source_version)
        expected_package_version = source_version if expected_package_id else ""
        identity_mismatches = package_identity_mismatches(
            package_path.name,
            expected_package_id,
            expected_package_version,
            metadata,
        )
        package_id = infer_package_id(package_path, metadata)
        package_version = metadata.get("version", "")
        dependencies = read_nuspec_dependencies(nuspec_text)
        expected_dependency_entries = expected_dependencies(package_id, package_version)
        missing_dependencies = missing_dependency_entries(expected_dependency_entries, dependencies)
        unexpected_dependencies = unexpected_dependency_entries(expected_dependency_entries, dependencies)
        allowed_native = allowed_native_entries(package_id)
        unexpected_native = unexpected_native_entries(package_id, native_entries)
        allowed_entry_patterns = allowed_package_entry_patterns(package_id)
        unexpected_package_entries = unexpected_package_content_entries(package_id, entry_names, allowed_native)
        public_api_entries = xml_documentation_member_names(archive, xml_documentation_entry)
        expected_api_entries = expected_public_api_entries(package_id)
        missing_api_entries = missing_public_api_entries(expected_api_entries, public_api_entries)
        unexpected_api_entries = unexpected_public_api_entries(expected_api_entries, public_api_entries)
        expected_documentation_entry = f"lib/net8.0/{package_id}.xml"
        missing_documentation_entries = []
        if expected_documentation_entry not in xml_documentation_entries:
            missing_documentation_entries.append(expected_documentation_entry)
        declared_file_entries = declared_package_file_entries(metadata)
        missing_package_file_entries = [
            name for name in declared_file_entries
            if name not in entry_names
        ]
        documentation_entries = package_documentation_entries(entry_names)
        expected_documentation_entries = package_documentation_verification(archive, entry_names, package_id)
        documentation_mismatches = [
            entry for entry in expected_documentation_entries
            if not entry["sha256_match"]
        ]
        package_required_search_terms = required_search_terms(package_id)
        package_missing_search_terms = missing_search_terms(package_id, metadata)
        package_metadata_policy_violations = metadata_policy_violations(package_id, metadata)

    package_reports.append({
        "name": package_path.name,
        "package_id": package_id,
        "expected_package_id": expected_package_id,
        "expected_package_version": expected_package_version,
        "path": str(package_path.resolve()),
        "sha256": sha256_file(package_path),
        "byte_count": package_path.stat().st_size,
        "entry_count": len(entry_names),
        "package_entry_names": entry_names,
        "allowed_package_entry_patterns": allowed_entry_patterns,
        "unexpected_package_content_entries": unexpected_package_entries,
        "public_api_entries": public_api_entries,
        "expected_public_api_entries": expected_api_entries,
        "missing_public_api_entries": missing_api_entries,
        "unexpected_public_api_entries": unexpected_api_entries,
        "native_rids": native_rids,
        "native_entries": native_entries,
        "allowed_native_entries": allowed_native,
        "unexpected_native_entries": unexpected_native,
        "metadata": metadata,
        "package_identity_mismatches": identity_mismatches,
        "missing_metadata_fields": missing_metadata_fields(metadata),
        "metadata_policy_violations": package_metadata_policy_violations,
        "required_search_terms": package_required_search_terms,
        "missing_search_terms": package_missing_search_terms,
        "declared_package_file_entries": declared_file_entries,
        "missing_package_file_entries": missing_package_file_entries,
        "package_documentation_entries": documentation_entries,
        "expected_package_documentation_entries": expected_documentation_entries,
        "package_documentation_mismatches": documentation_mismatches,
        "xml_documentation_entries": xml_documentation_entries,
        "missing_documentation_entries": missing_documentation_entries,
        "dependencies": dependencies,
        "expected_dependency_entries": expected_dependency_entries,
        "missing_dependency_entries": missing_dependencies,
        "unexpected_dependency_entries": unexpected_dependencies,
        "private_surface_matches": private_matches,
        "source_file_entries": source_file_entries,
        "debug_symbol_entries": debug_symbol_entries,
        "generated_output_entries": generated_output_entries,
        "absolute_path_matches": path_matches,
    })

symbol_package_reports = []
for symbol_package_path in symbol_package_files:
    with zipfile.ZipFile(symbol_package_path, "r") as archive:
        infos = sorted(archive.infolist(), key=lambda item: item.filename)
        entry_names = [entry.filename for entry in infos]
        symbol_source_file_entries = [name for name in entry_names if source_file_pattern.search(name)]
        symbol_generated_output_entries = [name for name in entry_names if generated_output_pattern.search(name)]
        symbol_path_matches = absolute_path_matches(archive, infos)
        pdb_entries = [
            name for name in entry_names
            if re.fullmatch(r"lib/[^/]+/TinyRustLM\.[^/]+\.pdb", name)
        ]
        unexpected_symbol_entries = unexpected_symbol_package_entries(entry_names)
        nuspec_entry = next((entry for entry in infos if entry.filename.lower().endswith(".nuspec")), None)
        nuspec_text = read_zip_entry_text(archive, nuspec_entry) if nuspec_entry is not None else ""
        metadata = read_nuspec_metadata(nuspec_text)
        expected_package_id = expected_symbol_package_id_for_name(symbol_package_path.name, source_version)
        expected_package_version = source_version if expected_package_id else ""
        symbols_type = has_symbols_package_type(nuspec_text)
        identity_mismatches = symbol_package_identity_mismatches(
            symbol_package_path.name,
            expected_package_id,
            expected_package_version,
            metadata,
            symbols_type,
        )

    symbol_package_reports.append({
        "name": symbol_package_path.name,
        "package_id": expected_package_id,
        "expected_package_id": expected_package_id,
        "expected_package_version": expected_package_version,
        "path": str(symbol_package_path.resolve()),
        "sha256": sha256_file(symbol_package_path),
        "byte_count": symbol_package_path.stat().st_size,
        "entry_count": len(entry_names),
        "package_entry_names": entry_names,
        "pdb_entries": pdb_entries,
        "has_symbols_package_type": symbols_type,
        "package_identity_mismatches": identity_mismatches,
        "unexpected_symbol_package_entries": unexpected_symbol_entries,
        "source_file_entries": symbol_source_file_entries,
        "generated_output_entries": symbol_generated_output_entries,
        "absolute_path_matches": symbol_path_matches,
    })

core_package = next((package for package in package_reports if package["name"].startswith("TinyRustLM.Core.")), None)
if core_package is not None:
    missing_native_rids = [rid for rid in required_native_rids if rid not in core_package["native_rids"]]
elif required_native_rids:
    missing_native_rids = list(required_native_rids)
else:
    missing_native_rids = []

all_private_matches = [item for package in package_reports for item in package["private_surface_matches"]]
all_package_identity_mismatches = [item for package in package_reports for item in package["package_identity_mismatches"]]
all_missing_metadata = [item for package in package_reports for item in package["missing_metadata_fields"]]
all_metadata_policy_violations = [item for package in package_reports for item in package["metadata_policy_violations"]]
all_missing_search_terms = [item for package in package_reports for item in package["missing_search_terms"]]
all_missing_package_files = [item for package in package_reports for item in package["missing_package_file_entries"]]
all_package_documentation_mismatches = [item for package in package_reports for item in package["package_documentation_mismatches"]]
all_missing_dependencies = [item for package in package_reports for item in package["missing_dependency_entries"]]
all_unexpected_dependencies = [item for package in package_reports for item in package["unexpected_dependency_entries"]]
all_unexpected_native_entries = [item for package in package_reports for item in package["unexpected_native_entries"]]
all_unexpected_package_content_entries = [item for package in package_reports for item in package["unexpected_package_content_entries"]]
all_missing_public_api_entries = [item for package in package_reports for item in package["missing_public_api_entries"]]
all_unexpected_public_api_entries = [item for package in package_reports for item in package["unexpected_public_api_entries"]]
all_missing_documentation = [item for package in package_reports for item in package["missing_documentation_entries"]]
all_source_file_entries = [item for package in package_reports for item in package["source_file_entries"]]
all_debug_symbol_entries = [item for package in package_reports for item in package["debug_symbol_entries"]]
all_generated_output_entries = [item for package in package_reports for item in package["generated_output_entries"]]
all_absolute_path_matches = [item for package in package_reports for item in package["absolute_path_matches"]]
all_symbol_package_identity_mismatches = [
    item for package in symbol_package_reports
    for item in package["package_identity_mismatches"]
]
all_symbol_package_unexpected_entries = [
    item for package in symbol_package_reports
    for item in package["unexpected_symbol_package_entries"]
]
all_symbol_package_missing_pdb_entries = [
    package["name"] for package in symbol_package_reports
    if not package["pdb_entries"]
]
all_symbol_package_source_file_entries = [
    item for package in symbol_package_reports
    for item in package["source_file_entries"]
]
all_symbol_package_generated_output_entries = [
    item for package in symbol_package_reports
    for item in package["generated_output_entries"]
]
all_symbol_package_absolute_path_matches = [
    item for package in symbol_package_reports
    for item in package["absolute_path_matches"]
]

checks_passed = not any((
    missing_package_entries,
    unexpected_package_entries,
    missing_symbol_package_entries,
    unexpected_symbol_package_entries_for_set,
    all_package_identity_mismatches,
    all_symbol_package_identity_mismatches,
    missing_native_rids,
    all_private_matches,
    all_missing_metadata,
    all_metadata_policy_violations,
    all_missing_search_terms,
    all_missing_package_files,
    all_package_documentation_mismatches,
    all_missing_dependencies,
    all_unexpected_dependencies,
    all_unexpected_native_entries,
    all_unexpected_package_content_entries,
    all_missing_public_api_entries,
    all_unexpected_public_api_entries,
    all_missing_documentation,
    all_source_file_entries,
    all_debug_symbol_entries,
    all_generated_output_entries,
    all_absolute_path_matches,
    all_symbol_package_unexpected_entries,
    all_symbol_package_missing_pdb_entries,
    all_symbol_package_source_file_entries,
    all_symbol_package_generated_output_entries,
    all_symbol_package_absolute_path_matches,
))
status = "pass" if checks_passed else "fail"
report = {
    "schema": "tinyrustlm.nuget.package_audit.v0",
    "generated_utc": utc_now(),
    "package_source": str(package_source.resolve()),
    "package_version": source_version,
    "expected_package_names": expected_names,
    "expected_symbol_package_names": expected_symbol_names,
    "required_native_rids": required_native_rids,
    "status": status,
    "missing_package_entries": missing_package_entries,
    "unexpected_package_entries": unexpected_package_entries,
    "missing_symbol_package_entries": missing_symbol_package_entries,
    "unexpected_symbol_package_entries": unexpected_symbol_package_entries_for_set,
    "missing_native_rids": missing_native_rids,
    "missing_package_count": len(missing_package_entries),
    "unexpected_package_count": len(unexpected_package_entries),
    "missing_symbol_package_count": len(missing_symbol_package_entries),
    "unexpected_symbol_package_count": len(unexpected_symbol_package_entries_for_set),
    "package_identity_mismatch_count": len(all_package_identity_mismatches),
    "symbol_package_identity_mismatch_count": len(all_symbol_package_identity_mismatches),
    "missing_metadata_count": len(all_missing_metadata),
    "metadata_policy_violation_count": len(all_metadata_policy_violations),
    "missing_search_term_count": len(all_missing_search_terms),
    "missing_package_file_count": len(all_missing_package_files),
    "package_documentation_mismatch_count": len(all_package_documentation_mismatches),
    "missing_dependency_count": len(all_missing_dependencies),
    "unexpected_dependency_count": len(all_unexpected_dependencies),
    "unexpected_native_entry_count": len(all_unexpected_native_entries),
    "unexpected_package_content_entry_count": len(all_unexpected_package_content_entries),
    "missing_public_api_entry_count": len(all_missing_public_api_entries),
    "unexpected_public_api_entry_count": len(all_unexpected_public_api_entries),
    "missing_documentation_count": len(all_missing_documentation),
    "source_file_count": len(all_source_file_entries),
    "debug_symbol_count": len(all_debug_symbol_entries),
    "generated_output_count": len(all_generated_output_entries),
    "absolute_path_match_count": len(all_absolute_path_matches),
    "symbol_package_unexpected_entry_count": len(all_symbol_package_unexpected_entries),
    "symbol_package_missing_pdb_count": len(all_symbol_package_missing_pdb_entries),
    "symbol_package_source_file_count": len(all_symbol_package_source_file_entries),
    "symbol_package_generated_output_count": len(all_symbol_package_generated_output_entries),
    "symbol_package_absolute_path_match_count": len(all_symbol_package_absolute_path_matches),
    "package_count": len(package_reports),
    "symbol_package_count": len(symbol_package_reports),
    "packages": package_reports,
    "symbol_packages": symbol_package_reports,
}

report_output.parent.mkdir(parents=True, exist_ok=True)
with report_output.open("w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(f"TinyRustLM NuGet package audit written to {report_output}")
if status != "pass":
    raise SystemExit(f"TinyRustLM NuGet package audit failed. See {report_output}")
PY
