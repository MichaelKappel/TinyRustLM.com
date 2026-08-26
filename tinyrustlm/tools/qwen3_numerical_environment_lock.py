"""Seal and verify the offline Python closure for Qwen3 numerical diagnostics.

The public lock is an observation of exact wheel, bootstrap, interpreter, and
installed-file identities. It is not an installation receipt and grants no
model, numerical, browser, quality, P2P, or release claim.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from typing import Any, Iterable
import zipfile


SCHEMA = "tinyrustlm.qwen3_numerical_environment_lock.v1"
PROFILE_ID = "tinyrustlm.qwen3-numerical-oracle-python-win-x64/2"
OUTPUT_RELATIVE_PATH = Path(
    "contracts/vnext/qwen3-numerical-oracle-environment-lock.v1.json"
)
MAXIMUM_JSON_BYTES = 4 * 1024 * 1024
MAXIMUM_FILE_BYTES = 1024 * 1024 * 1024
MAXIMUM_TOTAL_BYTES = 4 * 1024 * 1024 * 1024
MAXIMUM_FILES = 100_000
MAXIMUM_WHEEL_ENTRIES = 100_000
MAXIMUM_WHEEL_EXPANDED_BYTES = 4 * 1024 * 1024 * 1024
HASH_CHUNK_BYTES = 4 * 1024 * 1024
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
WHEEL_HASH_RE = re.compile(r"^sha256=([A-Za-z0-9_-]{43})$")


RUNTIME_DISTRIBUTIONS = {
    "accelerate": "1.14.0",
    "certifi": "2025.4.26",
    "charset-normalizer": "3.4.2",
    "colorama": "0.4.6",
    "filelock": "3.18.0",
    "fsspec": "2025.3.2",
    "huggingface-hub": "0.30.2",
    "idna": "3.10",
    "jinja2": "3.1.6",
    "markupsafe": "3.0.2",
    "mpmath": "1.3.0",
    "networkx": "3.4.2",
    "numpy": "2.2.5",
    "packaging": "25.0",
    "pip": "25.0.1",
    "psutil": "7.2.2",
    "pyyaml": "6.0.2",
    "regex": "2024.11.6",
    "requests": "2.32.3",
    "safetensors": "0.5.3",
    "setuptools": "80.3.1",
    "sympy": "1.14.0",
    "tokenizers": "0.21.1",
    "torch": "2.7.0",
    "tqdm": "4.67.1",
    "transformers": "4.51.0",
    "typing-extensions": "4.13.2",
    "urllib3": "2.4.0",
}

BOOTSTRAP_DISTRIBUTIONS = {
    "distlib": "0.3.9",
    "filelock": "3.18.0",
    "platformdirs": "4.3.8",
    "virtualenv": "20.31.2",
}


class EnvironmentLockError(RuntimeError):
    """A typed fail-closed environment-lock rejection."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def fail(code: str) -> None:
    raise EnvironmentLockError(code)


def canonical_name(value: str) -> str:
    return re.sub(r"[-_.]+", "-", value).lower()


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(
        value,
        ensure_ascii=True,
        allow_nan=False,
        indent=2,
        sort_keys=True,
        separators=(",", ": "),
    ) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def reparse_point(file_stat: os.stat_result) -> bool:
    attributes = getattr(file_stat, "st_file_attributes", 0)
    marker = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return bool(attributes & marker)


def direct_directory(value: Path, code: str) -> Path:
    try:
        absolute = Path(os.path.abspath(value))
        file_stat = absolute.lstat()
        resolved = absolute.resolve(strict=True)
    except OSError:
        fail(code)
    if (
        not stat.S_ISDIR(file_stat.st_mode)
        or stat.S_ISLNK(file_stat.st_mode)
        or reparse_point(file_stat)
        or os.path.normcase(str(resolved)) != os.path.normcase(str(absolute))
    ):
        fail(code)
    return absolute


def direct_file(value: Path, maximum_bytes: int, code: str) -> os.stat_result:
    try:
        absolute = Path(os.path.abspath(value))
        file_stat = absolute.lstat()
        resolved = absolute.resolve(strict=True)
    except OSError:
        fail(code)
    if (
        not stat.S_ISREG(file_stat.st_mode)
        or stat.S_ISLNK(file_stat.st_mode)
        or reparse_point(file_stat)
        or file_stat.st_size < 0
        or file_stat.st_size > maximum_bytes
        or os.path.normcase(str(resolved)) != os.path.normcase(str(absolute))
    ):
        fail(code)
    return file_stat


def contained(root: Path, value: Path, code: str) -> Path:
    try:
        absolute = Path(os.path.abspath(value))
        common = os.path.commonpath((str(root), str(absolute)))
    except (OSError, ValueError):
        fail(code)
    if os.path.normcase(common) != os.path.normcase(str(root)):
        fail(code)
    return absolute


def stream_identity(value: Path, maximum_bytes: int, code: str) -> dict[str, Any]:
    file_stat = direct_file(value, maximum_bytes, code)
    digest = hashlib.sha256()
    observed = 0
    try:
        with value.open("rb", buffering=0) as source:
            while True:
                chunk = source.read(HASH_CHUNK_BYTES)
                if not chunk:
                    break
                observed += len(chunk)
                if observed > maximum_bytes:
                    fail(code)
                digest.update(chunk)
    except OSError:
        fail(code)
    if observed != file_stat.st_size:
        fail(code)
    return {"byteLength": observed, "sha256": digest.hexdigest()}


def compare_utf8(value: str) -> bytes:
    return value.encode("utf-8")


def excluded_cache(relative: PurePosixPath) -> bool:
    return "__pycache__" in relative.parts or relative.suffix.lower() == ".pyc"


def walk_closure(root: Path, code: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    root = direct_directory(root, code)
    pending = [root]
    files: list[dict[str, Any]] = []
    total_bytes = 0
    while pending:
        current = pending.pop()
        try:
            entries = sorted(current.iterdir(), key=lambda item: compare_utf8(item.name))
        except OSError:
            fail(code)
        for entry in entries:
            relative = PurePosixPath(entry.relative_to(root).as_posix())
            try:
                entry_stat = entry.lstat()
            except OSError:
                fail(code)
            if stat.S_ISLNK(entry_stat.st_mode) or reparse_point(entry_stat):
                fail(f"{code}-link")
            if stat.S_ISDIR(entry_stat.st_mode):
                if relative.name != "__pycache__":
                    direct_directory(entry, code)
                    pending.append(entry)
                continue
            if not stat.S_ISREG(entry_stat.st_mode):
                fail(code)
            if excluded_cache(relative):
                continue
            contained(root, entry, code)
            identity = stream_identity(entry, MAXIMUM_FILE_BYTES, code)
            total_bytes += identity["byteLength"]
            if total_bytes > MAXIMUM_TOTAL_BYTES or len(files) >= MAXIMUM_FILES:
                fail(f"{code}-limit")
            files.append({"path": relative.as_posix(), **identity})
    files.sort(key=lambda item: compare_utf8(item["path"]))
    digest = hashlib.sha256()
    for item in files:
        digest.update(item["path"].encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(item["byteLength"]).encode("ascii"))
        digest.update(b"\0")
        digest.update(item["sha256"].encode("ascii"))
        digest.update(b"\n")
    return {
        "fileCount": len(files),
        "byteLength": total_bytes,
        "closureSha256": digest.hexdigest(),
        "exclusions": ["__pycache__-directories", "pyc-files"],
    }, files


def metadata_headers(value: bytes, code: str) -> tuple[str, str]:
    try:
        text = value.decode("utf-8")
    except UnicodeDecodeError:
        fail(code)
    names = []
    versions = []
    for line in text.splitlines():
        if line.startswith("Name: "):
            names.append(line[6:])
        elif line.startswith("Version: "):
            versions.append(line[9:])
        if line == "":
            break
    if len(names) != 1 or len(versions) != 1 or not names[0] or not versions[0]:
        fail(code)
    return canonical_name(names[0]), versions[0]


def wheel_metadata(value: Path) -> tuple[str, str]:
    code = "qwen3-numerical-environment-wheel-invalid"
    direct_file(value, 512 * 1024 * 1024, code)
    try:
        with zipfile.ZipFile(value, "r") as archive:
            infos = archive.infolist()
            if not infos or len(infos) > MAXIMUM_WHEEL_ENTRIES:
                fail(code)
            names: set[str] = set()
            expanded = 0
            metadata: list[zipfile.ZipInfo] = []
            for info in infos:
                pure = PurePosixPath(info.filename)
                if (
                    info.filename in names
                    or "\\" in info.filename
                    or pure.is_absolute()
                    or ".." in pure.parts
                    or "" in pure.parts
                    or info.file_size < 0
                    or info.file_size > MAXIMUM_FILE_BYTES
                ):
                    fail(code)
                names.add(info.filename)
                expanded += info.file_size
                if expanded > MAXIMUM_WHEEL_EXPANDED_BYTES:
                    fail(code)
                if len(pure.parts) == 2 and pure.parts[0].endswith(".dist-info") \
                        and pure.parts[1] == "METADATA":
                    metadata.append(info)
            if len(metadata) != 1:
                fail(code)
            raw = archive.read(metadata[0])
    except (OSError, zipfile.BadZipFile, RuntimeError, KeyError):
        fail(code)
    return metadata_headers(raw, code)


def distribution_records(root: Path, expected: dict[str, str], code: str) -> list[dict[str, Any]]:
    site_packages = root / "Lib" / "site-packages" if (root / "Lib").exists() else root
    site_packages = direct_directory(site_packages, code)
    try:
        dist_infos = sorted(
            (item for item in site_packages.iterdir() if item.name.endswith(".dist-info")),
            key=lambda item: compare_utf8(item.name),
        )
    except OSError:
        fail(code)
    records: list[dict[str, Any]] = []
    observed_names: set[str] = set()
    for dist_info in dist_infos:
        direct_directory(dist_info, code)
        metadata_path = dist_info / "METADATA"
        metadata_identity = stream_identity(metadata_path, 8 * 1024 * 1024, code)
        try:
            metadata_bytes = metadata_path.read_bytes()
        except OSError:
            fail(code)
        name, version = metadata_headers(metadata_bytes, code)
        if name in observed_names:
            fail(f"{code}-duplicate")
        observed_names.add(name)
        if expected.get(name) != version:
            fail(f"{code}-version")
        record_path = dist_info / "RECORD"
        record_identity = stream_identity(record_path, 64 * 1024 * 1024, code)
        try:
            record_text = record_path.read_text(encoding="utf-8", errors="strict")
            rows = list(csv.reader(io.StringIO(record_text, newline="")))
        except (OSError, UnicodeError, csv.Error):
            fail(f"{code}-record")
        if not rows or len(rows) > MAXIMUM_FILES:
            fail(f"{code}-record")
        closure_items: list[dict[str, Any]] = []
        seen_paths: set[str] = set()
        record_self_seen = False
        for row in rows:
            if len(row) != 3 or not row[0] or "\0" in row[0] or "\\" in row[0]:
                fail(f"{code}-record")
            pure = PurePosixPath(row[0])
            if pure.is_absolute() or not pure.parts:
                fail(f"{code}-record")
            target = contained(root, site_packages.joinpath(*pure.parts), f"{code}-record")
            normalized = target.relative_to(root).as_posix()
            if normalized in seen_paths:
                fail(f"{code}-record-duplicate")
            seen_paths.add(normalized)
            if excluded_cache(PurePosixPath(normalized)):
                continue
            if os.path.normcase(str(target)) == os.path.normcase(str(record_path)):
                if row[1] or row[2]:
                    fail(f"{code}-record-self")
                record_self_seen = True
                continue
            match = WHEEL_HASH_RE.fullmatch(row[1])
            if match is None or not row[2].isdigit():
                fail(f"{code}-record-hash")
            identity = stream_identity(target, MAXIMUM_FILE_BYTES, f"{code}-record-file")
            expected_digest = base64.urlsafe_b64decode(match.group(1) + "=").hex()
            if identity["sha256"] != expected_digest or identity["byteLength"] != int(row[2]):
                fail(f"{code}-record-drift")
            closure_items.append({"path": normalized, **identity})
        if not record_self_seen:
            fail(f"{code}-record-self")
        closure_items.sort(key=lambda item: compare_utf8(item["path"]))
        digest = hashlib.sha256()
        total = 0
        for item in closure_items:
            total += item["byteLength"]
            digest.update(item["path"].encode("utf-8"))
            digest.update(b"\0")
            digest.update(str(item["byteLength"]).encode("ascii"))
            digest.update(b"\0")
            digest.update(item["sha256"].encode("ascii"))
            digest.update(b"\n")
        records.append({
            "name": name,
            "version": version,
            "distInfo": dist_info.relative_to(root).as_posix(),
            "metadata": metadata_identity,
            "record": record_identity,
            "recordedFileCount": len(closure_items),
            "recordedByteLength": total,
            "recordedClosureSha256": digest.hexdigest(),
        })
    if observed_names != set(expected):
        fail(f"{code}-inventory")
    records.sort(key=lambda item: compare_utf8(item["name"]))
    return records


def parse_pyvenv(environment_root: Path) -> tuple[dict[str, str], bytes]:
    config_path = environment_root / "pyvenv.cfg"
    direct_file(config_path, 64 * 1024, "qwen3-numerical-environment-config")
    try:
        raw = config_path.read_bytes()
        text = raw.decode("utf-8")
    except (OSError, UnicodeDecodeError):
        fail("qwen3-numerical-environment-config")
    values: dict[str, str] = {}
    for line in text.splitlines():
        if not line.strip():
            continue
        key, separator, value = line.partition("=")
        key = key.strip().lower()
        value = value.strip()
        if separator != "=" or not key or not value or key in values:
            fail("qwen3-numerical-environment-config")
        values[key] = value
    required = {"home", "implementation", "version_info", "include-system-site-packages"}
    if not required.issubset(values) or values["include-system-site-packages"].lower() != "false":
        fail("qwen3-numerical-environment-config")
    return values, raw


def runtime_environment(environment_root: Path) -> dict[str, Any]:
    environment_root = direct_directory(environment_root, "qwen3-numerical-environment-root")
    config, config_bytes = parse_pyvenv(environment_root)
    launcher_path = environment_root / "Scripts" / "python.exe"
    launcher = stream_identity(
        launcher_path, 32 * 1024 * 1024, "qwen3-numerical-environment-launcher"
    )
    base_path = Path(config.get("base-executable", Path(config["home"]) / "python.exe"))
    if not base_path.is_absolute():
        fail("qwen3-numerical-environment-base")
    base = stream_identity(base_path, 32 * 1024 * 1024, "qwen3-numerical-environment-base")
    closure, _files = walk_closure(environment_root, "qwen3-numerical-environment-closure")
    distributions = distribution_records(
        environment_root,
        RUNTIME_DISTRIBUTIONS,
        "qwen3-numerical-environment-distribution",
    )
    version = config["version_info"].removesuffix(".final.0")
    if version != "3.12.10" or config["implementation"] != "CPython":
        fail("qwen3-numerical-environment-python")
    return {
        "platform": "win-x64",
        "pythonImplementation": "CPython",
        "pythonVersion": version,
        "launcher": {"relativePath": "Scripts/python.exe", **launcher},
        "baseInterpreter": {"basename": base_path.name, **base},
        "pyvenvConfig": {
            "byteLength": len(config_bytes),
            "sha256": sha256_bytes(config_bytes),
            "includeSystemSitePackages": False,
        },
        "distributions": distributions,
        "closure": closure,
    }


def bootstrap_environment(bootstrap_root: Path) -> dict[str, Any]:
    bootstrap_root = direct_directory(
        bootstrap_root, "qwen3-numerical-bootstrap-environment-root"
    )
    closure, _files = walk_closure(
        bootstrap_root, "qwen3-numerical-bootstrap-environment-closure"
    )
    distributions = distribution_records(
        bootstrap_root,
        BOOTSTRAP_DISTRIBUTIONS,
        "qwen3-numerical-bootstrap-environment-distribution",
    )
    return {"distributions": distributions, "closure": closure}


def wheelhouse(wheelhouse_root: Path) -> dict[str, Any]:
    wheelhouse_root = direct_directory(
        wheelhouse_root, "qwen3-numerical-environment-wheelhouse-root"
    )
    expected = dict(RUNTIME_DISTRIBUTIONS)
    expected.update(BOOTSTRAP_DISTRIBUTIONS)
    try:
        entries = sorted(wheelhouse_root.iterdir(), key=lambda item: compare_utf8(item.name))
    except OSError:
        fail("qwen3-numerical-environment-wheelhouse")
    if len(entries) != len(expected):
        fail("qwen3-numerical-environment-wheelhouse-inventory")
    wheels: list[dict[str, Any]] = []
    observed: set[str] = set()
    total = 0
    digest = hashlib.sha256()
    for entry in entries:
        if entry.suffix.lower() != ".whl":
            fail("qwen3-numerical-environment-wheelhouse-inventory")
        name, version = wheel_metadata(entry)
        if name in observed or expected.get(name) != version:
            fail("qwen3-numerical-environment-wheelhouse-inventory")
        observed.add(name)
        identity = stream_identity(entry, 512 * 1024 * 1024, "qwen3-numerical-environment-wheel")
        roles = []
        if name in BOOTSTRAP_DISTRIBUTIONS:
            roles.append("bootstrap")
        if name in RUNTIME_DISTRIBUTIONS:
            roles.append("runtime")
        record = {
            "fileName": entry.name,
            "name": name,
            "version": version,
            "roles": roles,
            **identity,
        }
        wheels.append(record)
        total += identity["byteLength"]
        digest.update(entry.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(identity["byteLength"]).encode("ascii"))
        digest.update(b"\0")
        digest.update(identity["sha256"].encode("ascii"))
        digest.update(b"\n")
    if observed != set(expected):
        fail("qwen3-numerical-environment-wheelhouse-inventory")
    return {
        "wheelCount": len(wheels),
        "byteLength": total,
        "closureSha256": digest.hexdigest(),
        "wheels": wheels,
    }


def render_lock(
    environment_root: Path, wheelhouse_root: Path, bootstrap_root: Path
) -> bytes:
    document = {
        "authority": {
            "claim": "exact-observed-offline-closure-not-original-installation-receipt",
            "modelExecution": False,
            "numericalParity": False,
            "browserProof": False,
            "qualityQualification": False,
            "shippingRuntime": False,
        },
        "bootstrapEnvironment": bootstrap_environment(bootstrap_root),
        "execution": {
            "bytecodeWrites": False,
            "childProcessAllowed": False,
            "isolatedMode": True,
            "networkAllowed": False,
            "packageMutationAllowed": False,
            "runtimeEnvironmentRevalidation": "before-and-after-each-owner",
        },
        "profileId": PROFILE_ID,
        "runtimeEnvironment": runtime_environment(environment_root),
        "schema": SCHEMA,
        "wheelhouse": wheelhouse(wheelhouse_root),
    }
    return canonical_json_bytes(document)


def read_lock(
    lock_path: Path, expected_byte_length: int | None = None,
    expected_sha256: str | None = None,
) -> dict[str, Any]:
    identity = stream_identity(lock_path, MAXIMUM_JSON_BYTES, "qwen3-numerical-environment-lock")
    if expected_byte_length is not None and identity["byteLength"] != expected_byte_length:
        fail("qwen3-numerical-environment-lock-identity")
    if expected_sha256 is not None and identity["sha256"] != expected_sha256:
        fail("qwen3-numerical-environment-lock-identity")
    try:
        raw = lock_path.read_bytes()
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_reject_duplicate_pairs)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        fail("qwen3-numerical-environment-lock-json")
    if raw != canonical_json_bytes(value) or not isinstance(value, dict):
        fail("qwen3-numerical-environment-lock-canonical")
    if value.get("schema") != SCHEMA or value.get("profileId") != PROFILE_ID:
        fail("qwen3-numerical-environment-lock-schema")
    return value


def _reject_duplicate_pairs(pairs: Iterable[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail("qwen3-numerical-environment-lock-duplicate-key")
        result[key] = value
    return result


def verify_running_environment(
    lock_path: Path, expected_byte_length: int, expected_sha256: str,
) -> dict[str, Any]:
    if (
        not isinstance(expected_byte_length, int)
        or isinstance(expected_byte_length, bool)
        or expected_byte_length <= 0
        or expected_byte_length > MAXIMUM_JSON_BYTES
        or not isinstance(expected_sha256, str)
        or SHA256_RE.fullmatch(expected_sha256) is None
    ):
        fail("qwen3-numerical-environment-lock-identity")
    lock = read_lock(lock_path, expected_byte_length, expected_sha256)
    environment_root = Path(sys.executable).absolute().parent.parent
    observed = runtime_environment(environment_root)
    if observed != lock.get("runtimeEnvironment"):
        fail("qwen3-numerical-environment-runtime-drift")
    return {
        "byteLength": expected_byte_length,
        "sha256": expected_sha256,
        "profileId": PROFILE_ID,
        "runtimeClosureSha256": observed["closure"]["closureSha256"],
    }


def write_atomic(output_path: Path, value: bytes) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    staging = output_path.with_name(f".{output_path.name}.{os.getpid()}.tmp")
    try:
        with staging.open("xb", buffering=0) as target:
            target.write(value)
            target.flush()
            os.fsync(target.fileno())
        os.replace(staging, output_path)
    except OSError:
        try:
            staging.unlink(missing_ok=True)
        except OSError:
            pass
        fail("qwen3-numerical-environment-lock-write")


def self_test() -> None:
    sample = {"z": 1, "a": {"b": False, "a": "value"}}
    expected = b'{\n  "a": {\n    "a": "value",\n    "b": false\n  },\n  "z": 1\n}\n'
    if canonical_json_bytes(sample) != expected:
        fail("qwen3-numerical-environment-self-test-canonical")
    if canonical_name("Typing_Extensions") != "typing-extensions":
        fail("qwen3-numerical-environment-self-test-name")
    digest = base64.urlsafe_b64encode(hashlib.sha256(b"abc").digest()).rstrip(b"=").decode("ascii")
    if WHEEL_HASH_RE.fullmatch(f"sha256={digest}") is None:
        fail("qwen3-numerical-environment-self-test-record")


def repository_root() -> Path:
    return Path(__file__).resolve(strict=True).parents[2]


def main() -> None:
    arguments = sys.argv[1:]
    if not arguments or arguments[0] not in {
        "--write", "--check", "--verify-runtime", "--self-test"
    }:
        fail("qwen3-numerical-environment-arguments")
    operation, *operands = arguments
    if operation == "--self-test":
        if operands:
            fail("qwen3-numerical-environment-arguments")
        self_test()
        print(json.dumps({"status": "pass", "claim": "helper-self-test-only"}, sort_keys=True))
        return
    if operation == "--verify-runtime":
        if len(operands) != 1:
            fail("qwen3-numerical-environment-arguments")
        lock_path = Path(operands[0])
        identity = stream_identity(lock_path, MAXIMUM_JSON_BYTES, "qwen3-numerical-environment-lock")
        result = verify_running_environment(lock_path, identity["byteLength"], identity["sha256"])
        print(json.dumps({"status": "pass", **result}, separators=(",", ":")))
        return
    if len(operands) != 3:
        fail("qwen3-numerical-environment-arguments")
    environment_root, wheelhouse_root, bootstrap_root = map(Path, operands)
    rendered = render_lock(environment_root, wheelhouse_root, bootstrap_root)
    output_path = repository_root() / OUTPUT_RELATIVE_PATH
    if operation == "--write":
        write_atomic(output_path, rendered)
        status = "written"
    else:
        try:
            current = output_path.read_bytes()
        except OSError:
            fail("qwen3-numerical-environment-lock-missing")
        if current != rendered:
            fail("qwen3-numerical-environment-lock-drift")
        status = "pass"
    print(json.dumps({
        "status": status,
        "byteLength": len(rendered),
        "sha256": sha256_bytes(rendered),
        "claim": "exact-observed-offline-closure-not-execution-evidence",
    }, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except EnvironmentLockError as error:
        print(error.code, file=sys.stderr)
        raise SystemExit(1) from None
