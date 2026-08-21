"""Isolated Hugging Face tokenizers oracle for preregistered Qwen parity cases."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
from typing import Any


MAXIMUM_JSON_BYTES = 64 * 1024 * 1024
HASH_BUFFER_BYTES = 1024 * 1024
RESULT_SCHEMA = "tinyrustlm.qwen_tokenizer2_parity_result.v1"
EXPECTED_PROFILE_ID = "tinyrustlm.qwen-tokenizer2-source-parity/1"
EXPECTED_CORPUS_SCHEMA = "tinyrustlm.qwen_tokenizer2_parity_cases.v1"
EXPECTED_LOCK_SCHEMA = "tinyrustlm.qwen_tokenizer2_source_lock.v1"
EXPECTED_TOKENIZERS_VERSION = "0.22.2"
EXPECTED_PYTHON_SHA256 = (
    "4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a"
)
EXPECTED_WHEEL_SHA256 = (
    "c9ea31edff2968b44a88f97d784c2f16dc0729b8b143ed004699ebca91f05c48"
)
EXPECTED_ENVIRONMENT_LOCK_SHA256 = (
    "68c36c8492c59c0006e3bfa018b0d84dbc1832379733512c4e979b9a17ac49eb"
)
EXPECTED_SOURCE_LOCK_SHA256 = (
    "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"
)
EXPECTED_ARTIFACT_SHA256 = (
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
)
EXPECTED_FILES = frozenset(
    {
        "config.json",
        "merges.txt",
        "tokenizer.json",
        "tokenizer_config.json",
        "vocab.json",
    }
)


class OracleFailure(Exception):
    """Stable fail-closed oracle error."""


def fail(code: str) -> None:
    """Raises one bounded stable error code."""
    raise OracleFailure(code)


def audit_hook(event: str, _arguments: tuple[Any, ...]) -> None:
    """Blocks network and child-process activity before importing tokenizers."""
    denied_prefixes = (
        "socket.",
        "subprocess.",
        "urllib.",
        "http.client.",
    )
    denied_events = {
        "os.system",
        "os.posix_spawn",
        "os.spawn",
        "pty.spawn",
    }
    if event in denied_events or event.startswith(denied_prefixes):
        fail("qwen-tokenizer2-oracle-isolation-violation")


def duplicate_rejecting_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    """Builds one object while rejecting duplicate member names."""
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail("qwen-tokenizer2-oracle-json-duplicate")
        result[key] = value
    return result


def exact_keys(value: Any, expected: set[str], code: str) -> dict[str, Any]:
    """Requires one exact non-array JSON object shape."""
    if not isinstance(value, dict) or set(value) != expected:
        fail(code)
    return value


def bounded_regular_file(path: Path, maximum_bytes: int, code: str) -> int:
    """Returns a bounded regular non-link file length."""
    try:
        if not path.is_absolute() or path.is_symlink():
            fail(code)
        stat = path.stat()
    except OSError:
        fail(code)
    if not path.is_file() or stat.st_size <= 0 or stat.st_size > maximum_bytes:
        fail(code)
    return stat.st_size


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
        fail("qwen-tokenizer2-oracle-file-read")
    return digest.hexdigest()


def read_json(
    path: Path, maximum_bytes: int, code: str
) -> tuple[dict[str, Any], bytes]:
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


def validate_profile(
    profile_path: Path,
    script_path: Path,
    cases_path: Path,
    source_lock_path: Path,
    environment_lock_path: Path,
    wheel_path: Path,
) -> tuple[dict[str, Any], str]:
    """Validates every oracle-relevant preregistration binding."""
    profile, profile_bytes = read_json(
        profile_path, 1024 * 1024, "qwen-tokenizer2-oracle-profile-invalid"
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
        "qwen-tokenizer2-oracle-profile-invalid",
    )
    if (
        profile["schema"]
        != "tinyrustlm.vnext.qwen-tokenizer2-parity-preregistration.v1"
        or profile["profileId"] != EXPECTED_PROFILE_ID
        or profile["status"] != "registered-before-comparative-output"
        or profile["registrationParentCommit"]
        != "8210bda0614ef0b9237327d36d05e08f34c799df"
    ):
        fail("qwen-tokenizer2-oracle-profile-invalid")

    source = exact_keys(
        profile["source"],
        {
            "modelId",
            "revision",
            "sourceLockPath",
            "sourceLockSha256",
            "tokenizerPath",
            "tokenizerSha256",
        },
        "qwen-tokenizer2-oracle-profile-invalid",
    )
    artifact = exact_keys(
        profile["artifact"],
        {"formatProfileId", "byteLength", "sha256"},
        "qwen-tokenizer2-oracle-profile-invalid",
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
        "qwen-tokenizer2-oracle-profile-invalid",
    )
    oracle = exact_keys(
        profile["oracle"],
        {
            "implementation",
            "version",
            "sourceRevision",
            "scriptPath",
            "scriptSha256",
            "pythonVersion",
            "pythonExecutableSha256",
            "wheelFile",
            "wheelSha256",
            "environmentLockSha256",
            "networkAllowed",
            "childProcessAllowed",
        },
        "qwen-tokenizer2-oracle-profile-invalid",
    )
    exact_keys(
        profile["candidate"],
        {
            "implementation",
            "version",
            "runnerPath",
            "runnerSha256",
            "sourceClosureSha256",
            "sourceClosure",
        },
        "qwen-tokenizer2-oracle-profile-invalid",
    )
    execution = exact_keys(
        profile["execution"],
        {
            "addSpecialTokens",
            "decodeModes",
            "requiredOracleRuns",
            "requiredCandidateRuns",
            "maximumInputBytes",
            "maximumOutputTokens",
            "maximumDecodedBytes",
            "comparison",
            "bestOfN",
            "repair",
            "outputLocation",
        },
        "qwen-tokenizer2-oracle-profile-invalid",
    )

    if (
        source["sourceLockSha256"] != EXPECTED_SOURCE_LOCK_SHA256
        or artifact["sha256"] != EXPECTED_ARTIFACT_SHA256
        or artifact["byteLength"] != 7_038_773
        or corpus["schema"] != EXPECTED_CORPUS_SCHEMA
        or corpus["caseCount"] != 2048
        or oracle["implementation"] != "huggingface-tokenizers"
        or oracle["version"] != EXPECTED_TOKENIZERS_VERSION
        or oracle["pythonExecutableSha256"] != EXPECTED_PYTHON_SHA256
        or oracle["wheelSha256"] != EXPECTED_WHEEL_SHA256
        or oracle["environmentLockSha256"] != EXPECTED_ENVIRONMENT_LOCK_SHA256
        or wheel_path.name != oracle["wheelFile"]
        or oracle["networkAllowed"] is not False
        or oracle["childProcessAllowed"] is not False
        or execution["addSpecialTokens"] is not False
        or execution["decodeModes"] != ["include-all", "skip-special"]
        or execution["requiredOracleRuns"] != 2
        or execution["requiredCandidateRuns"] != 2
        or execution["comparison"] != "exact-token-ids-and-exact-decoded-unicode"
        or execution["bestOfN"] is not False
        or execution["repair"] is not False
        or execution["outputLocation"] != "private-external-create-only"
    ):
        fail("qwen-tokenizer2-oracle-profile-invalid")

    if (
        sha256_file(script_path) != oracle["scriptSha256"]
        or sha256_file(cases_path) != corpus["sha256"]
        or bounded_regular_file(
            cases_path, MAXIMUM_JSON_BYTES, "qwen-tokenizer2-oracle-corpus-invalid"
        )
        != corpus["byteLength"]
        or sha256_file(source_lock_path) != source["sourceLockSha256"]
        or sha256_file(environment_lock_path) != oracle["environmentLockSha256"]
        or sha256_file(wheel_path) != oracle["wheelSha256"]
        or sha256_file(Path(sys.executable)) != oracle["pythonExecutableSha256"]
    ):
        fail("qwen-tokenizer2-oracle-profile-binding-invalid")
    return profile, hashlib.sha256(profile_bytes).hexdigest()


def validate_source(source_lock_path: Path, source_directory: Path) -> Path:
    """Validates the exact locked five-file source without returning paths."""
    lock, _ = read_json(
        source_lock_path, 1024 * 1024, "qwen-tokenizer2-oracle-source-lock-invalid"
    )
    exact_keys(
        lock,
        {
            "schema",
            "modelId",
            "revision",
            "sourceKind",
            "architectureProfileId",
            "files",
        },
        "qwen-tokenizer2-oracle-source-lock-invalid",
    )
    if (
        lock["schema"] != EXPECTED_LOCK_SCHEMA
        or not source_directory.is_absolute()
        or source_directory.is_symlink()
        or not source_directory.is_dir()
    ):
        fail("qwen-tokenizer2-oracle-source-lock-invalid")
    try:
        entries = list(source_directory.iterdir())
    except OSError:
        fail("qwen-tokenizer2-oracle-source-inventory-invalid")
    if {entry.name for entry in entries} != EXPECTED_FILES:
        fail("qwen-tokenizer2-oracle-source-inventory-invalid")
    files = exact_keys(
        lock["files"],
        {"config", "merges", "tokenizer", "tokenizerConfig", "vocab"},
        "qwen-tokenizer2-oracle-source-lock-invalid",
    )
    tokenizer_path: Path | None = None
    for value in files.values():
        entry = exact_keys(
            value,
            {"path", "byteLength", "sha256"},
            "qwen-tokenizer2-oracle-source-lock-invalid",
        )
        if entry["path"] not in EXPECTED_FILES:
            fail("qwen-tokenizer2-oracle-source-lock-invalid")
        path = source_directory / entry["path"]
        if (
            bounded_regular_file(
                path, 64 * 1024 * 1024, "qwen-tokenizer2-oracle-source-invalid"
            )
            != entry["byteLength"]
            or sha256_file(path) != entry["sha256"]
        ):
            fail("qwen-tokenizer2-oracle-source-invalid")
        if entry["path"] == "tokenizer.json":
            tokenizer_path = path
    if tokenizer_path is None:
        fail("qwen-tokenizer2-oracle-source-lock-invalid")
    return tokenizer_path


def validate_cases(cases_path: Path, profile: dict[str, Any]) -> list[dict[str, Any]]:
    """Validates ordered preregistered cases and exact category counts."""
    document, _ = read_json(
        cases_path, MAXIMUM_JSON_BYTES, "qwen-tokenizer2-oracle-corpus-invalid"
    )
    exact_keys(
        document,
        {
            "schema",
            "corpusId",
            "generatorProfileId",
            "seedHex",
            "sourceLockSha256",
            "tokenizerArtifactSha256",
            "caseCount",
            "categoryCounts",
            "cases",
        },
        "qwen-tokenizer2-oracle-corpus-invalid",
    )
    corpus_profile = profile["corpus"]
    if (
        document["schema"] != corpus_profile["schema"]
        or document["corpusId"] != corpus_profile["corpusId"]
        or document["sourceLockSha256"] != EXPECTED_SOURCE_LOCK_SHA256
        or document["tokenizerArtifactSha256"] != EXPECTED_ARTIFACT_SHA256
        or document["caseCount"] != corpus_profile["caseCount"]
        or document["categoryCounts"] != corpus_profile["categoryCounts"]
        or not isinstance(document["cases"], list)
        or len(document["cases"]) != 2048
    ):
        fail("qwen-tokenizer2-oracle-corpus-invalid")
    seen_ids: set[str] = set()
    seen_text: set[str] = set()
    counts: dict[str, int] = {}
    maximum_input = profile["execution"]["maximumInputBytes"]
    for case in document["cases"]:
        exact_keys(
            case,
            {"caseId", "category", "text"},
            "qwen-tokenizer2-oracle-corpus-invalid",
        )
        if (
            not isinstance(case["caseId"], str)
            or not isinstance(case["category"], str)
            or not isinstance(case["text"], str)
            or case["caseId"] in seen_ids
            or case["text"] in seen_text
            or len(case["text"].encode("utf-8")) > maximum_input
        ):
            fail("qwen-tokenizer2-oracle-corpus-invalid")
        seen_ids.add(case["caseId"])
        seen_text.add(case["text"])
        counts[case["category"]] = counts.get(case["category"], 0) + 1
    if counts != document["categoryCounts"]:
        fail("qwen-tokenizer2-oracle-corpus-invalid")
    return document["cases"]


def create_result(
    profile: dict[str, Any],
    profile_sha256: str,
    cases: list[dict[str, Any]],
    tokenizer_path: Path,
) -> dict[str, Any]:
    """Executes every case once without retries or output repair."""
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    sys.addaudithook(audit_hook)
    try:
        import tokenizers  # pylint: disable=import-outside-toplevel
        from tokenizers import Tokenizer  # pylint: disable=import-outside-toplevel
    except Exception:
        fail("qwen-tokenizer2-oracle-import-failed")
    if tokenizers.__version__ != EXPECTED_TOKENIZERS_VERSION:
        fail("qwen-tokenizer2-oracle-version-invalid")
    try:
        tokenizer = Tokenizer.from_file(str(tokenizer_path))
    except Exception:
        fail("qwen-tokenizer2-oracle-load-failed")
    if tokenizer.get_vocab_size(with_added_tokens=True) != 151_669:
        fail("qwen-tokenizer2-oracle-vocabulary-invalid")

    results = []
    total_tokens = 0
    maximum_tokens = 0
    for case in cases:
        try:
            ids = tokenizer.encode(case["text"], add_special_tokens=False).ids
            include_all = tokenizer.decode(ids, skip_special_tokens=False)
            skip_special = tokenizer.decode(ids, skip_special_tokens=True)
        except Exception:
            fail("qwen-tokenizer2-oracle-execution-failed")
        if len(ids) > profile["execution"]["maximumOutputTokens"]:
            fail("qwen-tokenizer2-oracle-output-limit")
        total_tokens += len(ids)
        maximum_tokens = max(maximum_tokens, len(ids))
        results.append(
            {
                "caseId": case["caseId"],
                "tokenIds": ids,
                "decodeIncludeAll": include_all,
                "decodeSkipSpecial": skip_special,
            }
        )
    return {
        "schema": RESULT_SCHEMA,
        "implementation": {
            "kind": "source-oracle",
            "name": "huggingface-tokenizers",
            "version": EXPECTED_TOKENIZERS_VERSION,
            "executableSha256": EXPECTED_PYTHON_SHA256,
            "sourceIdentitySha256": EXPECTED_WHEEL_SHA256,
        },
        "preregistration": {
            "profileId": profile["profileId"],
            "profileSha256": profile_sha256,
        },
        "source": {
            "modelId": profile["source"]["modelId"],
            "revision": profile["source"]["revision"],
            "tokenizerSha256": profile["source"]["tokenizerSha256"],
        },
        "artifact": {
            "formatProfileId": profile["artifact"]["formatProfileId"],
            "byteLength": profile["artifact"]["byteLength"],
            "sha256": profile["artifact"]["sha256"],
        },
        "corpus": {
            "corpusId": profile["corpus"]["corpusId"],
            "sha256": profile["corpus"]["sha256"],
            "caseCount": profile["corpus"]["caseCount"],
        },
        "summary": {
            "caseCount": len(results),
            "totalTokenCount": total_tokens,
            "maximumTokenCount": maximum_tokens,
        },
        "results": results,
    }


def write_create_only(path: Path, value: dict[str, Any]) -> None:
    """Persists canonical deterministic JSON without replacing prior evidence."""
    if not path.is_absolute() or path.suffix != ".json":
        fail("qwen-tokenizer2-oracle-output-invalid")
    data = (
        json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    if len(data) > MAXIMUM_JSON_BYTES:
        fail("qwen-tokenizer2-oracle-output-limit")
    try:
        with path.open("xb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
    except OSError:
        fail("qwen-tokenizer2-oracle-output-create-failed")


def main(arguments: list[str]) -> None:
    """Runs one exact preregistered source-oracle observation."""
    if len(arguments) != 7:
        fail("qwen-tokenizer2-oracle-arguments-invalid")
    paths = [Path(argument) for argument in arguments]
    (
        profile_path,
        cases_path,
        source_lock_path,
        source_directory,
        environment_lock,
        wheel,
        output,
    ) = paths
    script_path = Path(__file__).resolve()
    profile, profile_sha256 = validate_profile(
        profile_path,
        script_path,
        cases_path,
        source_lock_path,
        environment_lock,
        wheel,
    )
    tokenizer_path = validate_source(source_lock_path, source_directory)
    if sha256_file(tokenizer_path) != profile["source"]["tokenizerSha256"]:
        fail("qwen-tokenizer2-oracle-source-invalid")
    cases = validate_cases(cases_path, profile)
    result = create_result(profile, profile_sha256, cases, tokenizer_path)
    write_create_only(output, result)
    public_summary = {
        "schema": RESULT_SCHEMA,
        "status": "source-oracle-output-created",
        "caseCount": result["summary"]["caseCount"],
        "totalTokenCount": result["summary"]["totalTokenCount"],
        "maximumTokenCount": result["summary"]["maximumTokenCount"],
        "outputSha256": sha256_file(output),
    }
    print(json.dumps(public_summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except OracleFailure as error:
        print(f"Qwen Tokenizer2 source oracle failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None
