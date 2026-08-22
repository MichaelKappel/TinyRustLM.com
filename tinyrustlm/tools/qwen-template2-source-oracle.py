"""Isolated Jinja source oracle for preregistered Qwen3 Template2 parity cases."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
from typing import Any


MAXIMUM_JSON_BYTES = 32 * 1024 * 1024
HASH_BUFFER_BYTES = 1024 * 1024
RESULT_SCHEMA = "tinyrustlm.qwen3_template2_parity_result.v1"
EXPECTED_PROFILE_ID = "tinyrustlm.qwen3-template2-source-parity/1"
EXPECTED_REGISTERED_AT_UTC = "2026-08-22T10:30:00Z"
EXPECTED_REGISTRATION_PARENT_COMMIT = (
    "81a6d53844761d10c0eb1563b5420788c1772f8f"
)
EXPECTED_CORPUS_SCHEMA = "tinyrustlm.qwen3_template2_parity_cases.v1"
EXPECTED_CORPUS_ID = "qwen3-0.6b-template2-parity-1024-v1"
EXPECTED_SOURCE_LOCK_SCHEMA = "tinyrustlm.qwen3_template2_source_lock.v1"
EXPECTED_ENVIRONMENT_LOCK_SCHEMA = (
    "tinyrustlm.template2_source_oracle_environment_lock.v1"
)
EXPECTED_JINJA_VERSION = "3.1.6"
EXPECTED_MARKUPSAFE_VERSION = "3.0.3"
EXPECTED_SOURCE_LOCK_SHA256 = (
    "22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660"
)
EXPECTED_TOKENIZER_CONFIG_SHA256 = (
    "d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101"
)
EXPECTED_SOURCE_TEMPLATE_SHA256 = (
    "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8"
)
EXPECTED_MODEL_CONFIG_SHA256 = (
    "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd"
)
EXPECTED_FORMAT_PROFILE_SHA256 = (
    "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa"
)
EXPECTED_ARTIFACT_SHA256 = (
    "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8"
)
EXPECTED_TOKENIZER_ARTIFACT_SHA256 = (
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
)
EXPECTED_CATEGORY_COUNTS = {
    "bounded-long-content": 64,
    "empty-content": 32,
    "fixed-contract": 32,
    "multi-turn": 256,
    "multilingual-unicode": 128,
    "ordinary-single-turn": 224,
    "system-single-turn": 128,
    "template-syntax-data": 64,
    "whitespace-line-ending": 96,
}
FORBIDDEN_CONTROL_LITERALS = (
    "<|endoftext|>",
    "<|im_start|>",
    "<|im_end|>",
    "<|object_ref_start|>",
    "<|object_ref_end|>",
    "<|box_start|>",
    "<|box_end|>",
    "<|quad_start|>",
    "<|quad_end|>",
    "<|vision_start|>",
    "<|vision_end|>",
    "<|vision_pad|>",
    "<|image_pad|>",
    "<|video_pad|>",
    "<tool_call>",
    "</tool_call>",
    "<|fim_prefix|>",
    "<|fim_middle|>",
    "<|fim_suffix|>",
    "<|fim_pad|>",
    "<|repo_name|>",
    "<|file_sep|>",
    "<tool_response>",
    "</tool_response>",
    "<think>",
    "</think>",
)


class OracleFailure(Exception):
    """Stable fail-closed oracle error."""


def fail(code: str) -> None:
    """Raises one bounded stable error code."""
    raise OracleFailure(code)


def audit_hook(event: str, _arguments: tuple[Any, ...]) -> None:
    """Blocks network, process creation, and explicit ctypes loading after startup."""
    denied_prefixes = (
        "socket.",
        "subprocess.",
        "urllib.",
        "http.client.",
        "ctypes.",
    )
    denied_events = {
        "os.system",
        "os.posix_spawn",
        "os.spawn",
        "pty.spawn",
    }
    if event in denied_events or event.startswith(denied_prefixes):
        fail("template2-oracle-isolation-violation")


def duplicate_rejecting_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    """Builds an object while rejecting duplicate member names."""
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail("template2-oracle-json-duplicate")
        result[key] = value
    return result


def exact_keys(value: Any, expected: set[str], code: str) -> dict[str, Any]:
    """Requires one exact non-array JSON object shape."""
    if not isinstance(value, dict) or set(value) != expected:
        fail(code)
    return value


def bounded_regular_file(path: Path, maximum_bytes: int, code: str) -> int:
    """Returns one bounded regular non-link file length."""
    try:
        if not path.is_absolute() or path.is_symlink():
            fail(code)
        stat = path.stat()
        resolved = path.resolve(strict=True)
    except OSError:
        fail(code)
    if (
        not path.is_file()
        or stat.st_size > maximum_bytes
        or os.path.normcase(str(resolved)) != os.path.normcase(str(path))
    ):
        fail(code)
    return stat.st_size


def direct_directory(path: Path, code: str) -> None:
    """Requires one absolute direct non-link directory."""
    try:
        if not path.is_absolute() or path.is_symlink() or not path.is_dir():
            fail(code)
        resolved = path.resolve(strict=True)
    except OSError:
        fail(code)
    if os.path.normcase(str(resolved)) != os.path.normcase(str(path)):
        fail(code)


def sha256_file(path: Path) -> str:
    """Streams one file into lowercase SHA-256."""
    digest = hashlib.sha256()
    try:
        with path.open("rb") as source:
            while True:
                block = source.read(HASH_BUFFER_BYTES)
                if not block:
                    break
                digest.update(block)
    except OSError:
        fail("template2-oracle-file-read")
    return digest.hexdigest()


def read_json(path: Path, maximum_bytes: int, code: str) -> tuple[dict[str, Any], bytes]:
    """Reads bounded fatal UTF-8 JSON with duplicate-member rejection."""
    bounded_regular_file(path, maximum_bytes, code)
    try:
        data = path.read_bytes()
        text = data.decode("utf-8", errors="strict")
        value = json.loads(text, object_pairs_hook=duplicate_rejecting_object)
    except (OSError, UnicodeError, json.JSONDecodeError):
        fail(code)
    if not isinstance(value, dict):
        fail(code)
    return value, data


def canonical_relative_path(value: Any, code: str) -> str:
    """Requires one portable repository-relative path without traversal."""
    if (
        not isinstance(value, str)
        or not value
        or "\\" in value
        or Path(value).is_absolute()
        or any(part in {"", ".", ".."} for part in value.split("/"))
    ):
        fail(code)
    return value


def valid_sha256(value: Any) -> bool:
    """Returns true only for a nonzero lowercase SHA-256 string."""
    return (
        isinstance(value, str)
        and len(value) == 64
        and value != "0" * 64
        and all(character in "0123456789abcdef" for character in value)
    )


def closure_sha256(entries: list[dict[str, Any]], code: str) -> str:
    """Hashes one sorted source-closure identity sequence."""
    digest = hashlib.sha256()
    previous: str | None = None
    for entry in entries:
        exact_keys(entry, {"path", "byteLength", "sha256"}, code)
        relative = canonical_relative_path(entry["path"], code)
        if (
            (previous is not None and previous >= relative)
            or not isinstance(entry["byteLength"], int)
            or entry["byteLength"] < 0
            or not valid_sha256(entry["sha256"])
        ):
            fail(code)
        previous = relative
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(entry["byteLength"]).encode("ascii"))
        digest.update(b"\0")
        digest.update(entry["sha256"].encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def validate_repository_file(
    repository_root: Path,
    relative: Any,
    expected_length: Any,
    expected_sha256: Any,
    maximum_bytes: int,
    code: str,
) -> Path:
    """Validates one exact repository file and returns its direct path."""
    relative = canonical_relative_path(relative, code)
    if (
        not isinstance(expected_length, int)
        or expected_length <= 0
        or not valid_sha256(expected_sha256)
    ):
        fail(code)
    file_path = repository_root.joinpath(*relative.split("/"))
    if (
        bounded_regular_file(file_path, maximum_bytes, code) != expected_length
        or sha256_file(file_path) != expected_sha256
    ):
        fail(code)
    return file_path


def validate_candidate_source_closure(
    repository_root: Path, candidate: dict[str, Any]
) -> None:
    """Rehashes the complete candidate implementation source closure."""
    code = "template2-oracle-candidate-invalid"
    exact_keys(
        candidate,
        {
            "implementation",
            "version",
            "runnerPath",
            "runnerSha256",
            "sourceClosureSha256",
            "sourceClosure",
            "executableBasename",
            "executableByteLength",
            "executableSha256",
        },
        code,
    )
    required_paths = [
        "Cargo.lock",
        "Cargo.toml",
        "contracts/vnext/template2-format-profile.v1.json",
        "rust/crates/tinyrustlm-template2/Cargo.toml",
        "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs",
        "rust/crates/tinyrustlm-template2/src/format.rs",
        "rust/crates/tinyrustlm-template2/src/lib.rs",
        "rust/crates/tinyrustlm-template2/src/runtime.rs",
    ]
    entries = candidate["sourceClosure"]
    if (
        candidate["implementation"] != "tinyrustlm-template2"
        or candidate["version"] != "0.1.8"
        or candidate["runnerPath"]
        != "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs"
        or not valid_sha256(candidate["runnerSha256"])
        or not valid_sha256(candidate["sourceClosureSha256"])
        or not isinstance(entries, list)
        or [entry.get("path") if isinstance(entry, dict) else None for entry in entries]
        != required_paths
        or candidate["executableBasename"] != "qwen_template2_parity.exe"
        or not isinstance(candidate["executableByteLength"], int)
        or candidate["executableByteLength"] <= 0
        or not valid_sha256(candidate["executableSha256"])
    ):
        fail(code)
    for entry in entries:
        validate_repository_file(
            repository_root,
            entry["path"],
            entry["byteLength"],
            entry["sha256"],
            4 * 1024 * 1024,
            code,
        )
    runner_entry = next(
        entry for entry in entries if entry["path"] == candidate["runnerPath"]
    )
    if (
        runner_entry["sha256"] != candidate["runnerSha256"]
        or closure_sha256(entries, code) != candidate["sourceClosureSha256"]
    ):
        fail(code)


def validate_profile(
    profile_path: Path,
    script_path: Path,
    cases_path: Path,
    source_lock_path: Path,
    environment_lock_path: Path,
) -> tuple[dict[str, Any], str]:
    """Validates all source-oracle preregistration bindings."""
    profile, profile_bytes = read_json(
        profile_path, 1024 * 1024, "template2-oracle-profile-invalid"
    )
    exact_keys(
        profile,
        {
            "schema",
            "profileId",
            "status",
            "registeredAtUtc",
            "registrationParentCommit",
            "source",
            "artifact",
            "corpus",
            "oracle",
            "candidate",
            "execution",
            "acceptance",
            "claimBoundary",
        },
        "template2-oracle-profile-invalid",
    )
    if (
        profile["schema"]
        != "tinyrustlm.vnext.qwen-template2-parity-preregistration.v1"
        or profile["profileId"] != EXPECTED_PROFILE_ID
        or profile["status"] != "registered-before-comparative-output"
        or profile["registeredAtUtc"] != EXPECTED_REGISTERED_AT_UTC
        or profile["registrationParentCommit"]
        != EXPECTED_REGISTRATION_PARENT_COMMIT
    ):
        fail("template2-oracle-profile-invalid")
    source = exact_keys(
        profile["source"],
        {
            "modelId",
            "revision",
            "sourceLockPath",
            "sourceLockByteLength",
            "sourceLockSha256",
            "tokenizerConfigSha256",
            "sourceTemplateByteLength",
            "sourceTemplateSha256",
            "modelConfigSha256",
        },
        "template2-oracle-profile-invalid",
    )
    artifact = exact_keys(
        profile["artifact"],
        {
            "formatProfileId",
            "formatProfileSha256",
            "byteLength",
            "sha256",
            "tokenizerArtifactSha256",
        },
        "template2-oracle-profile-invalid",
    )
    corpus = exact_keys(
        profile["corpus"],
        {
            "path",
            "schema",
            "corpusId",
            "generatorPath",
            "generatorSha256",
            "byteLength",
            "sha256",
            "caseCount",
            "categoryCounts",
        },
        "template2-oracle-profile-invalid",
    )
    oracle = exact_keys(
        profile["oracle"],
        {
            "implementation",
            "pythonVersion",
            "jinjaVersion",
            "markupSafeVersion",
            "scriptPath",
            "scriptSha256",
            "environmentLockPath",
            "environmentLockByteLength",
            "environmentLockSha256",
            "launcherSha256",
            "baseInterpreterSha256",
            "sourceClosureSha256",
            "networkAllowed",
            "childProcessAllowed",
        },
        "template2-oracle-profile-invalid",
    )
    candidate = profile["candidate"]
    execution = exact_keys(
        profile["execution"],
        {
            "tools",
            "addGenerationPrompt",
            "enableThinking",
            "requiredOracleRuns",
            "requiredCandidateRuns",
            "maximumMessages",
            "maximumContentBytesPerMessage",
            "maximumTotalContentBytesPerCase",
            "maximumRenderedBytesPerCase",
            "maximumResultBytes",
            "comparison",
            "bestOfN",
            "repair",
            "outputLocation",
        },
        "template2-oracle-profile-invalid",
    )
    acceptance = exact_keys(
        profile["acceptance"],
        {
            "corpusCommittedBeforeObservation",
            "sourceLockRevalidated",
            "sourceRehashedAfterObservation",
            "environmentRehashedAfterObservation",
            "candidateExecutableRehashedAfterObservation",
            "artifactRecreatedAfterObservation",
            "exactCaseOrderRequired",
            "exactRenderedBytesRequired",
            "repeatedOracleBytesRequired",
            "repeatedCandidateBytesRequired",
            "everyCaseRequired",
            "mismatchIsFatal",
            "rawOutputsPreserved",
            "networkRequestMaximum",
            "childProcessMaximum",
        },
        "template2-oracle-profile-invalid",
    )
    claims = exact_keys(
        profile["claimBoundary"],
        {
            "templateSourceParityMayBeClaimedAfterPass",
            "browserWasmMayBeClaimed",
            "modelRuntimeMayBeClaimed",
            "modelQualityMayBeClaimed",
            "releaseMayBeClaimed",
            "campaignCreditMayBeClaimed",
            "requiredNextGate",
        },
        "template2-oracle-profile-invalid",
    )
    repository_root = script_path.parents[2]
    direct_directory(repository_root, "template2-oracle-profile-invalid")
    for relative in [
        source["sourceLockPath"],
        corpus["path"],
        corpus["generatorPath"],
        oracle["scriptPath"],
        oracle["environmentLockPath"],
    ]:
        canonical_relative_path(relative, "template2-oracle-profile-invalid")
    expected_paths = {
        "source": repository_root / source["sourceLockPath"],
        "corpus": repository_root / corpus["path"],
        "script": repository_root / oracle["scriptPath"],
        "environment": repository_root / oracle["environmentLockPath"],
    }
    supplied_paths = {
        "source": source_lock_path,
        "corpus": cases_path,
        "script": script_path,
        "environment": environment_lock_path,
    }
    for name in expected_paths:
        if os.path.normcase(str(expected_paths[name])) != os.path.normcase(
            str(supplied_paths[name])
        ):
            fail("template2-oracle-profile-invalid")
    identities = [
        (source_lock_path, source["sourceLockByteLength"], source["sourceLockSha256"]),
        (cases_path, corpus["byteLength"], corpus["sha256"]),
        (script_path, None, oracle["scriptSha256"]),
        (
            environment_lock_path,
            oracle["environmentLockByteLength"],
            oracle["environmentLockSha256"],
        ),
    ]
    for path, expected_length, expected_hash in identities:
        length = bounded_regular_file(
            path, MAXIMUM_JSON_BYTES, "template2-oracle-profile-invalid"
        )
        if (
            (expected_length is not None and length != expected_length)
            or sha256_file(path) != expected_hash
        ):
            fail("template2-oracle-profile-invalid")
    generator_path = repository_root / corpus["generatorPath"]
    format_profile_path = (
        repository_root / "contracts/vnext/template2-format-profile.v1.json"
    )
    if (
        sha256_file(generator_path) != corpus["generatorSha256"]
        or sha256_file(format_profile_path) != artifact["formatProfileSha256"]
    ):
        fail("template2-oracle-profile-invalid")
    if (
        source["modelId"] != "Qwen/Qwen3-0.6B"
        or source["revision"] != "c1899de289a04d12100db370d81485cdf75e47ca"
        or source["sourceLockPath"]
        != "contracts/vnext/qwen3-0.6b-template2-source-lock.v1.json"
        or source["sourceLockByteLength"] != 1_580
        or source["sourceLockSha256"] != EXPECTED_SOURCE_LOCK_SHA256
        or source["tokenizerConfigSha256"] != EXPECTED_TOKENIZER_CONFIG_SHA256
        or source["sourceTemplateByteLength"] != 4_168
        or source["sourceTemplateSha256"] != EXPECTED_SOURCE_TEMPLATE_SHA256
        or source["modelConfigSha256"] != EXPECTED_MODEL_CONFIG_SHA256
        or artifact["formatProfileId"] != "org.minimodel.template2/2.0"
        or artifact["formatProfileSha256"] != EXPECTED_FORMAT_PROFILE_SHA256
        or artifact["byteLength"] != 1_403
        or artifact["sha256"] != EXPECTED_ARTIFACT_SHA256
        or artifact["tokenizerArtifactSha256"]
        != EXPECTED_TOKENIZER_ARTIFACT_SHA256
        or corpus["path"]
        != "contracts/vnext/qwen-template2-parity-cases.v1.json"
        or corpus["schema"] != EXPECTED_CORPUS_SCHEMA
        or corpus["corpusId"] != EXPECTED_CORPUS_ID
        or corpus["generatorPath"]
        != "tinyrustlm/tools/qwen-template2-parity-corpus.js"
        or not valid_sha256(corpus["generatorSha256"])
        or not isinstance(corpus["byteLength"], int)
        or corpus["byteLength"] <= 0
        or not valid_sha256(corpus["sha256"])
        or corpus["caseCount"] != 1_024
        or corpus["categoryCounts"] != EXPECTED_CATEGORY_COUNTS
        or oracle["implementation"] != "jinja2-immutable-sandbox"
        or oracle["pythonVersion"] != "3.12.10"
        or oracle["jinjaVersion"] != EXPECTED_JINJA_VERSION
        or oracle["markupSafeVersion"] != EXPECTED_MARKUPSAFE_VERSION
        or oracle["scriptPath"]
        != "tinyrustlm/tools/qwen-template2-source-oracle.py"
        or not valid_sha256(oracle["scriptSha256"])
        or oracle["environmentLockPath"]
        != "contracts/vnext/template2-source-oracle-environment-lock.v1.json"
        or not isinstance(oracle["environmentLockByteLength"], int)
        or oracle["environmentLockByteLength"] <= 0
        or not valid_sha256(oracle["environmentLockSha256"])
        or not valid_sha256(oracle["launcherSha256"])
        or not valid_sha256(oracle["baseInterpreterSha256"])
        or not valid_sha256(oracle["sourceClosureSha256"])
        or oracle["networkAllowed"] is not False
        or oracle["childProcessAllowed"] is not False
        or execution
        != {
            "tools": None,
            "addGenerationPrompt": True,
            "enableThinking": False,
            "requiredOracleRuns": 2,
            "requiredCandidateRuns": 2,
            "maximumMessages": 16,
            "maximumContentBytesPerMessage": 32_768,
            "maximumTotalContentBytesPerCase": 65_536,
            "maximumRenderedBytesPerCase": 131_072,
            "maximumResultBytes": 16 * 1024 * 1024,
            "comparison": "exact-rendered-utf8-bytes-and-case-order",
            "bestOfN": False,
            "repair": False,
            "outputLocation": "private-external-create-only",
        }
        or acceptance
        != {
            "corpusCommittedBeforeObservation": True,
            "sourceLockRevalidated": True,
            "sourceRehashedAfterObservation": True,
            "environmentRehashedAfterObservation": True,
            "candidateExecutableRehashedAfterObservation": True,
            "artifactRecreatedAfterObservation": True,
            "exactCaseOrderRequired": True,
            "exactRenderedBytesRequired": True,
            "repeatedOracleBytesRequired": True,
            "repeatedCandidateBytesRequired": True,
            "everyCaseRequired": True,
            "mismatchIsFatal": True,
            "rawOutputsPreserved": True,
            "networkRequestMaximum": 0,
            "childProcessMaximum": 0,
        }
        or claims
        != {
            "templateSourceParityMayBeClaimedAfterPass": True,
            "browserWasmMayBeClaimed": False,
            "modelRuntimeMayBeClaimed": False,
            "modelQualityMayBeClaimed": False,
            "releaseMayBeClaimed": False,
            "campaignCreditMayBeClaimed": False,
            "requiredNextGate": (
                "deterministic-sampling-profile-and-template2-wasm-"
                "composition-conformance"
            ),
        }
    ):
        fail("template2-oracle-profile-invalid")
    validate_candidate_source_closure(repository_root, candidate)
    return profile, hashlib.sha256(profile_bytes).hexdigest()


def validate_environment(
    environment_lock_path: Path, profile: dict[str, Any], pycache_root: Path
) -> tuple[Path, dict[str, Any]]:
    """Rehashes the complete pinned Jinja execution closure."""
    document, _ = read_json(
        environment_lock_path,
        1024 * 1024,
        "template2-oracle-environment-invalid",
    )
    exact_keys(
        document,
        {
            "schema",
            "profileId",
            "platform",
            "pythonVersion",
            "launcher",
            "baseInterpreter",
            "packages",
            "packageRoots",
            "exclusions",
            "execution",
            "sourceClosureSha256",
            "fileCount",
            "files",
        },
        "template2-oracle-environment-invalid",
    )
    oracle = profile["oracle"]
    launcher_identity = exact_keys(
        document["launcher"],
        {"relativePath", "byteLength", "sha256"},
        "template2-oracle-environment-invalid",
    )
    base_identity = exact_keys(
        document["baseInterpreter"],
        {"basename", "byteLength", "sha256"},
        "template2-oracle-environment-invalid",
    )
    environment_execution = exact_keys(
        document["execution"],
        {
            "isolatedMode",
            "bytecodeWrites",
            "dedicatedEmptyPycachePrefix",
            "networkAllowed",
            "childProcessAllowed",
        },
        "template2-oracle-environment-invalid",
    )
    if (
        document["schema"] != EXPECTED_ENVIRONMENT_LOCK_SCHEMA
        or document["profileId"]
        != "tinyrustlm.template2-source-oracle-python/1"
        or document["platform"] != "win-x64"
        or document["pythonVersion"] != "3.12.10"
        or launcher_identity
        != {
            "relativePath": "Scripts/python.exe",
            "byteLength": 274_424,
            "sha256": oracle["launcherSha256"],
        }
        or base_identity
        != {
            "basename": "python.exe",
            "byteLength": 104_952,
            "sha256": oracle["baseInterpreterSha256"],
        }
        or document["sourceClosureSha256"] != oracle["sourceClosureSha256"]
        or document["fileCount"] != 44
        or document["packages"]
        != [
            {"name": "Jinja2", "version": EXPECTED_JINJA_VERSION},
            {"name": "MarkupSafe", "version": EXPECTED_MARKUPSAFE_VERSION},
        ]
        or document["packageRoots"]
        != [
            "Lib/site-packages/jinja2",
            "Lib/site-packages/jinja2-3.1.6.dist-info",
            "Lib/site-packages/markupsafe",
            "Lib/site-packages/markupsafe-3.0.3.dist-info",
        ]
        or document["exclusions"]
        != ["__pycache__-directories", "pyc-files"]
        or environment_execution
        != {
            "isolatedMode": True,
            "bytecodeWrites": False,
            "dedicatedEmptyPycachePrefix": True,
            "networkAllowed": False,
            "childProcessAllowed": False,
        }
        or not isinstance(document["files"], list)
        or len(document["files"]) != 44
        or closure_sha256(
            document["files"], "template2-oracle-environment-invalid"
        )
        != document["sourceClosureSha256"]
    ):
        fail("template2-oracle-environment-invalid")
    environment_root = Path(sys.prefix)
    direct_directory(environment_root, "template2-oracle-environment-invalid")
    launcher = environment_root / document["launcher"]["relativePath"]
    base_interpreter = Path(sys._base_executable)  # pylint: disable=protected-access
    if (
        bounded_regular_file(
            launcher, 16 * 1024 * 1024, "template2-oracle-environment-invalid"
        )
        != launcher_identity["byteLength"]
        or sha256_file(launcher) != launcher_identity["sha256"]
        or bounded_regular_file(
            base_interpreter,
            16 * 1024 * 1024,
            "template2-oracle-environment-invalid",
        )
        != base_identity["byteLength"]
        or sha256_file(base_interpreter) != base_identity["sha256"]
        or os.path.normcase(str(Path(sys.executable)))
        != os.path.normcase(str(launcher))
        or sys.version_info[:3] != (3, 12, 10)
        or sys.flags.isolated != 1
        or sys.dont_write_bytecode is not True
    ):
        fail("template2-oracle-environment-invalid")
    direct_directory(pycache_root, "template2-oracle-pycache-invalid")
    if any(pycache_root.iterdir()):
        fail("template2-oracle-pycache-invalid")
    if (
        sys.pycache_prefix is None
        or os.path.normcase(str(Path(sys.pycache_prefix)))
        != os.path.normcase(str(pycache_root))
    ):
        fail("template2-oracle-pycache-invalid")
    seen: set[str] = set()
    previous: str | None = None
    for entry in document["files"]:
        exact_keys(
            entry,
            {"path", "byteLength", "sha256"},
            "template2-oracle-environment-invalid",
        )
        relative = canonical_relative_path(
            entry["path"], "template2-oracle-environment-invalid"
        )
        if (
            relative in seen
            or (previous is not None and previous >= relative)
            or not isinstance(entry["byteLength"], int)
            or entry["byteLength"] < 0
            or not valid_sha256(entry["sha256"])
        ):
            fail("template2-oracle-environment-invalid")
        seen.add(relative)
        previous = relative
        file_path = environment_root.joinpath(*relative.split("/"))
        if (
            bounded_regular_file(
                file_path,
                32 * 1024 * 1024,
                "template2-oracle-environment-invalid",
            )
            != entry["byteLength"]
            or sha256_file(file_path) != entry["sha256"]
        ):
            fail("template2-oracle-environment-invalid")
    return environment_root, document


def validate_source(source_lock_path: Path, source_directory: Path, profile: dict[str, Any]) -> str:
    """Validates the source lock and extracts the exact publisher template."""
    lock, lock_bytes = read_json(
        source_lock_path, 1024 * 1024, "template2-oracle-source-lock-invalid"
    )
    exact_keys(
        lock,
        {
            "schema",
            "modelId",
            "revision",
            "sourceKind",
            "parentTokenizerSourceLock",
            "files",
            "chatTemplate",
            "supportedExecution",
            "unsupportedExecution",
            "runtimeSourceTemplateExecution",
        },
        "template2-oracle-source-lock-invalid",
    )
    if (
        lock["schema"] != EXPECTED_SOURCE_LOCK_SCHEMA
        or lock["modelId"] != profile["source"]["modelId"]
        or lock["revision"] != profile["source"]["revision"]
        or lock["sourceKind"] != "upstream-checkpoint"
        or len(lock_bytes) != profile["source"]["sourceLockByteLength"]
        or hashlib.sha256(lock_bytes).hexdigest()
        != profile["source"]["sourceLockSha256"]
        or lock["runtimeSourceTemplateExecution"] is not False
    ):
        fail("template2-oracle-source-lock-invalid")
    parent_lock = exact_keys(
        lock["parentTokenizerSourceLock"],
        {"path", "byteLength", "sha256"},
        "template2-oracle-source-lock-invalid",
    )
    if parent_lock != {
        "path": "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json",
        "byteLength": 1_108,
        "sha256": (
            "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"
        ),
    }:
        fail("template2-oracle-source-lock-invalid")
    repository_root = source_lock_path.parents[2]
    validate_repository_file(
        repository_root,
        parent_lock["path"],
        parent_lock["byteLength"],
        parent_lock["sha256"],
        1024 * 1024,
        "template2-oracle-source-lock-invalid",
    )
    direct_directory(source_directory, "template2-oracle-source-invalid")
    if source_directory.name != profile["source"]["revision"]:
        fail("template2-oracle-source-invalid")
    files = exact_keys(
        lock["files"], {"config", "tokenizerConfig"}, "template2-oracle-source-lock-invalid"
    )
    expected_files = {
        "config": {
            "path": "config.json",
            "byteLength": 726,
            "sha256": EXPECTED_MODEL_CONFIG_SHA256,
        },
        "tokenizerConfig": {
            "path": "tokenizer_config.json",
            "byteLength": 9_732,
            "sha256": EXPECTED_TOKENIZER_CONFIG_SHA256,
        },
    }
    for key, expected in expected_files.items():
        identity = exact_keys(
            files[key], {"path", "byteLength", "sha256"}, "template2-oracle-source-lock-invalid"
        )
        if identity != expected:
            fail("template2-oracle-source-lock-invalid")
        file_path = source_directory / expected["path"]
        if (
            bounded_regular_file(file_path, 1024 * 1024, "template2-oracle-source-invalid")
            != identity["byteLength"]
            or sha256_file(file_path) != identity["sha256"]
        ):
            fail("template2-oracle-source-invalid")
    tokenizer_config, _ = read_json(
        source_directory / "tokenizer_config.json",
        1024 * 1024,
        "template2-oracle-source-invalid",
    )
    template = tokenizer_config.get("chat_template")
    template_identity = exact_keys(
        lock["chatTemplate"],
        {"jsonMember", "valueType", "utf8ByteLength", "sha256"},
        "template2-oracle-source-lock-invalid",
    )
    supported = exact_keys(
        lock["supportedExecution"],
        {
            "tools",
            "addGenerationPrompt",
            "enableThinking",
            "roles",
            "content",
            "ordering",
        },
        "template2-oracle-source-lock-invalid",
    )
    if (
        not isinstance(template, str)
        or template_identity
        != {
            "jsonMember": "chat_template",
            "valueType": "string",
            "utf8ByteLength": 4_168,
            "sha256": EXPECTED_SOURCE_TEMPLATE_SHA256,
        }
        or len(template.encode("utf-8")) != template_identity["utf8ByteLength"]
        or hashlib.sha256(template.encode("utf-8")).hexdigest() != template_identity["sha256"]
        or template_identity["sha256"] != profile["source"]["sourceTemplateSha256"]
        or supported
        != {
            "tools": None,
            "addGenerationPrompt": True,
            "enableThinking": False,
            "roles": ["system", "user", "assistant"],
            "content": (
                "string-only-with-all-tokenizer-added-control-literals-forbidden"
            ),
            "ordering": (
                "optional-leading-system-then-strict-user-assistant-"
                "alternation-ending-user"
            ),
        }
        or lock["unsupportedExecution"]
        != [
            "tools",
            "tool-role-messages",
            "tool-calls",
            "reasoning-content-fields",
            "thinking-enabled-generation",
            "render-without-generation-prompt",
            "non-string-content",
        ]
    ):
        fail("template2-oracle-source-invalid")
    return template


def validate_cases(cases_path: Path, profile: dict[str, Any]) -> list[dict[str, Any]]:
    """Validates the ordered output-free parity corpus."""
    document, _ = read_json(
        cases_path, MAXIMUM_JSON_BYTES, "template2-oracle-corpus-invalid"
    )
    exact_keys(
        document,
        {
            "schema",
            "corpusId",
            "generatorProfileId",
            "generatorSha256",
            "seedHex",
            "sourceLockSha256",
            "template2ProfileSha256",
            "template2ArtifactSha256",
            "sourceTemplateSha256",
            "caseCount",
            "categoryCounts",
            "maximumMessagesPerCase",
            "maximumContentBytesPerMessage",
            "maximumTotalContentBytesPerCase",
            "expectedRenderedBytesPresent",
            "cases",
        },
        "template2-oracle-corpus-invalid",
    )
    corpus = profile["corpus"]
    if (
        document["schema"] != EXPECTED_CORPUS_SCHEMA
        or document["corpusId"] != EXPECTED_CORPUS_ID
        or document["corpusId"] != corpus["corpusId"]
        or document["generatorProfileId"]
        != "tinyrustlm.qwen3-template2-parity-corpus/1"
        or document["generatorSha256"] != corpus["generatorSha256"]
        or document["seedHex"]
        != "6115e5fc9bd68e4045529cb12f3088398fa91005572b6c92c9fe17c6627e4e99"
        or document["sourceLockSha256"] != EXPECTED_SOURCE_LOCK_SHA256
        or document["template2ProfileSha256"]
        != EXPECTED_FORMAT_PROFILE_SHA256
        or document["template2ArtifactSha256"] != EXPECTED_ARTIFACT_SHA256
        or document["sourceTemplateSha256"] != EXPECTED_SOURCE_TEMPLATE_SHA256
        or document["caseCount"] != 1_024
        or document["categoryCounts"] != EXPECTED_CATEGORY_COUNTS
        or document["categoryCounts"] != corpus["categoryCounts"]
        or document["maximumMessagesPerCase"]
        != profile["execution"]["maximumMessages"]
        or document["maximumContentBytesPerMessage"]
        != profile["execution"]["maximumContentBytesPerMessage"]
        or document["maximumTotalContentBytesPerCase"]
        != profile["execution"]["maximumTotalContentBytesPerCase"]
        or document["expectedRenderedBytesPresent"] is not False
        or not isinstance(document["cases"], list)
        or len(document["cases"]) != 1_024
    ):
        fail("template2-oracle-corpus-invalid")
    seen_ids: set[str] = set()
    seen_messages: set[str] = set()
    counts: dict[str, int] = {}
    for case in document["cases"]:
        exact_keys(
            case,
            {"caseId", "category", "messages"},
            "template2-oracle-corpus-invalid",
        )
        if (
            not isinstance(case["caseId"], str)
            or not case["caseId"]
            or case["caseId"] in seen_ids
            or not isinstance(case["category"], str)
            or case["category"] not in EXPECTED_CATEGORY_COUNTS
            or not isinstance(case["messages"], list)
        ):
            fail("template2-oracle-corpus-invalid")
        seen_ids.add(case["caseId"])
        message_identity = json.dumps(
            case["messages"],
            ensure_ascii=True,
            separators=(",", ":"),
            sort_keys=True,
        )
        if message_identity in seen_messages:
            fail("template2-oracle-corpus-invalid")
        seen_messages.add(message_identity)
        counts[case["category"]] = counts.get(case["category"], 0) + 1
        if not 1 <= len(case["messages"]) <= profile["execution"]["maximumMessages"]:
            fail("template2-oracle-corpus-invalid")
        conversational_index = 0
        total_content_bytes = 0
        for index, message in enumerate(case["messages"]):
            exact_keys(message, {"role", "content"}, "template2-oracle-corpus-invalid")
            if (
                not isinstance(message["role"], str)
                or not isinstance(message["content"], str)
            ):
                fail("template2-oracle-corpus-invalid")
            if index == 0 and message["role"] == "system":
                expected_role = "system"
            else:
                expected_role = (
                    "user" if conversational_index % 2 == 0 else "assistant"
                )
                conversational_index += 1
            content_bytes = message["content"].encode("utf-8")
            if (
                message["role"] != expected_role
                or len(content_bytes)
                > profile["execution"]["maximumContentBytesPerMessage"]
                or any(
                    literal in message["content"]
                    for literal in FORBIDDEN_CONTROL_LITERALS
                )
            ):
                fail("template2-oracle-corpus-invalid")
            total_content_bytes += len(content_bytes)
        if (
            case["messages"][-1]["role"] != "user"
            or total_content_bytes
            > profile["execution"]["maximumTotalContentBytesPerCase"]
        ):
            fail("template2-oracle-corpus-invalid")
    if counts != document["categoryCounts"]:
        fail("template2-oracle-corpus-invalid")
    return document["cases"]


def create_result(
    profile: dict[str, Any],
    profile_sha256: str,
    cases: list[dict[str, Any]],
    source_template: str,
) -> dict[str, Any]:
    """Renders every case once through the exact pinned source template."""
    sys.addaudithook(audit_hook)
    try:
        import jinja2  # pylint: disable=import-outside-toplevel
        import markupsafe  # pylint: disable=import-outside-toplevel
        from jinja2.sandbox import ImmutableSandboxedEnvironment  # pylint: disable=import-outside-toplevel
    except Exception:
        fail("template2-oracle-import-failed")
    if (
        importlib.metadata.version("Jinja2") != EXPECTED_JINJA_VERSION
        or importlib.metadata.version("MarkupSafe") != EXPECTED_MARKUPSAFE_VERSION
        or not Path(jinja2.__file__).is_file()
        or not Path(markupsafe.__file__).is_file()
    ):
        fail("template2-oracle-version-invalid")
    try:
        environment = ImmutableSandboxedEnvironment(
            trim_blocks=True,
            lstrip_blocks=True,
            autoescape=False,
        )
        compiled = environment.from_string(source_template)
    except Exception:
        fail("template2-oracle-compile-failed")
    results = []
    total_rendered_bytes = 0
    maximum_rendered_bytes = 0
    for case in cases:
        try:
            rendered = compiled.render(
                messages=case["messages"],
                tools=None,
                add_generation_prompt=True,
                enable_thinking=False,
            )
            rendered_bytes = rendered.encode("utf-8", errors="strict")
        except Exception:
            fail("template2-oracle-execution-failed")
        if len(rendered_bytes) > profile["execution"]["maximumRenderedBytesPerCase"]:
            fail("template2-oracle-output-limit")
        total_rendered_bytes += len(rendered_bytes)
        maximum_rendered_bytes = max(maximum_rendered_bytes, len(rendered_bytes))
        results.append(
            {
                "caseId": case["caseId"],
                "renderedByteLength": len(rendered_bytes),
                "renderedSha256": hashlib.sha256(rendered_bytes).hexdigest(),
                "renderedUtf8Hex": rendered_bytes.hex(),
            }
        )
    return {
        "schema": RESULT_SCHEMA,
        "implementation": {
            "kind": "source-oracle",
            "name": "jinja2-immutable-sandbox",
            "version": EXPECTED_JINJA_VERSION,
            "executableSha256": profile["oracle"]["launcherSha256"],
            "sourceIdentitySha256": profile["oracle"]["sourceClosureSha256"],
        },
        "preregistration": {
            "profileId": profile["profileId"],
            "profileSha256": profile_sha256,
        },
        "source": {
            "modelId": profile["source"]["modelId"],
            "revision": profile["source"]["revision"],
            "sourceTemplateSha256": profile["source"]["sourceTemplateSha256"],
        },
        "artifact": profile["artifact"],
        "corpus": {
            "corpusId": profile["corpus"]["corpusId"],
            "sha256": profile["corpus"]["sha256"],
            "caseCount": profile["corpus"]["caseCount"],
        },
        "summary": {
            "caseCount": len(results),
            "totalRenderedBytes": total_rendered_bytes,
            "maximumRenderedBytes": maximum_rendered_bytes,
        },
        "results": results,
    }


def write_create_only(path: Path, value: dict[str, Any], maximum_bytes: int) -> None:
    """Persists deterministic JSON without replacing prior evidence."""
    if (
        not path.is_absolute()
        or path.suffix != ".json"
        or not isinstance(maximum_bytes, int)
        or maximum_bytes <= 0
    ):
        fail("template2-oracle-output-invalid")
    parent = path.parent
    direct_directory(parent, "template2-oracle-output-invalid")
    if path != parent / path.name:
        fail("template2-oracle-output-invalid")
    data = (json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + "\n").encode("utf-8")
    if len(data) > maximum_bytes:
        fail("template2-oracle-output-limit")
    try:
        with path.open("xb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
    except OSError:
        fail("template2-oracle-output-create-failed")


def main(arguments: list[str]) -> None:
    """Runs one exact preregistered source-template observation."""
    if len(arguments) != 7:
        fail("template2-oracle-arguments-invalid")
    paths = [Path(argument) for argument in arguments]
    (
        profile_path,
        cases_path,
        source_lock_path,
        source_directory,
        environment_lock_path,
        pycache_root,
        output_path,
    ) = paths
    script_path = Path(__file__).resolve()
    profile, profile_sha256 = validate_profile(
        profile_path,
        script_path,
        cases_path,
        source_lock_path,
        environment_lock_path,
    )
    validate_environment(environment_lock_path, profile, pycache_root)
    source_template = validate_source(source_lock_path, source_directory, profile)
    cases = validate_cases(cases_path, profile)
    result = create_result(profile, profile_sha256, cases, source_template)
    if validate_source(source_lock_path, source_directory, profile) != source_template:
        fail("template2-oracle-source-drift")
    validate_environment(environment_lock_path, profile, pycache_root)
    write_create_only(output_path, result, profile["execution"]["maximumResultBytes"])
    print(
        json.dumps(
            {
                "schema": RESULT_SCHEMA,
                "status": "source-oracle-output-created",
                "caseCount": result["summary"]["caseCount"],
                "totalRenderedBytes": result["summary"]["totalRenderedBytes"],
                "maximumRenderedBytes": result["summary"]["maximumRenderedBytes"],
                "outputSha256": sha256_file(output_path),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except OracleFailure as error:
        print(f"Qwen Template2 source oracle failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None
