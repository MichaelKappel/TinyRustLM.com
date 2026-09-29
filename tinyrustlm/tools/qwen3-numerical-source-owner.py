"""Create-only publisher-framework traces for registered Qwen3 numerical cases.

This is a private evidence producer, not a shipping inference backend. It loads
one exact local Qwen3 checkpoint with a pinned Transformers environment, captures
the trace stages consumed by the independent differential verifier, and never
accepts prompt text, downloads model bytes, retries, or repairs output.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import re
import socket
import sys
from typing import Any, Callable


REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_source_request.v2"
RESULT_SCHEMA = "tinyrustlm.numerical_trace_bundle.v1"
IMPLEMENTATION_ID = "tinyrustlm.qwen3-publisher-source-trace/2"
TRACE_PROFILE_ID = "tinyrustlm.scalar-full-stage-f32le/1"
SOURCE_LOCK_SCHEMA = "tinyrustlm.qwen3_source_lock.v1"
SOURCE_LOCK_PATH = "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json"
MODEL_ID = "Qwen/Qwen3-0.6B"
REVISION = "c1899de289a04d12100db370d81485cdf75e47ca"
MAXIMUM_REQUEST_BYTES = 1024 * 1024
MAXIMUM_JSON_BYTES = 32 * 1024 * 1024
HASH_BUFFER_BYTES = 1024 * 1024
MAXIMUM_CASES = 32
MAXIMUM_TOKENS_PER_CASE = 256
DIAGNOSTIC_MAXIMUM_SOURCE_FILE_BYTES = 1_600_000_000
IDENTIFIER = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
ENVIRONMENT_LOCK_RELATIVE_PATH = (
    "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json"
)
ENVIRONMENT_AUTHORITY_RELATIVE_PATH = (
    "tinyrustlm/tools/qwen3_numerical_environment_lock.py"
)

sys.dont_write_bytecode = True

EXPECTED_MODEL_SPEC = {
    "vocabularySize": 151936,
    "contextLength": 40960,
    "embeddingSize": 1024,
    "feedForwardSize": 3072,
    "layerCount": 28,
    "headCount": 16,
    "kvHeadCount": 8,
    "headDimension": 128,
    "ropeTheta": 1000000,
    "normalizationEpsilon": 0.000001,
    "tiedEmbeddings": True,
    "qkvBias": False,
    "qkNormalization": True,
}
EXPECTED_PYTHON_VERSION = "3.12.10"
EXPECTED_PACKAGE_VERSIONS = {
    "accelerate": "1.14.0",
    "psutil": "7.2.2",
    "torch": "2.7.0",
    "transformers": "4.51.0",
    "safetensors": "0.5.3",
    "tokenizers": "0.21.1",
    "numpy": "2.2.5",
}


class SourceOwnerFailure(Exception):
    """One stable fail-closed source owner error."""


def fail(code: str) -> None:
    raise SourceOwnerFailure(code)


def duplicate_rejecting_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail("source-trace-json-duplicate")
        result[key] = value
    return result


def exact_object(value: Any, keys: set[str], code: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        fail(code)
    return value


def canonical_json_bytes(value: Any) -> bytes:
    """Encode bounded numerical metadata in the JavaScript owner's wire format.

    The current request/result contracts contain safe integers and one admitted
    fractional value: normalization epsilon. This is not a general float codec.
    Reject new numeric shapes rather than silently changing their wire identity.
    """
    def render(item: Any, depth: int) -> str:
        """Render one JSON value; preserve strings instead of rewriting numeric text."""
        if item is None:
            return "null"
        if isinstance(item, bool):
            return "true" if item else "false"
        if isinstance(item, int):
            if abs(item) > 9007199254740991:
                raise ValueError("numerical-metadata-unsafe-integer")
            return str(item)
        if isinstance(item, float):
            if item != 0.000001:
                raise ValueError("numerical-metadata-unregistered-fraction")
            return "0.000001"
        if isinstance(item, str):
            if not item.isascii():
                raise ValueError("numerical-metadata-nonascii-string")
            return json.dumps(item, ensure_ascii=True)
        indent = "  " * depth
        child_indent = indent + "  "
        if isinstance(item, list):
            if not item:
                return "[]"
            return "[\n" + ",\n".join(child_indent + render(child, depth + 1)
                                     for child in item) + "\n" + indent + "]"
        if isinstance(item, dict):
            if not item:
                return "{}"
            if any(not isinstance(key, str) for key in item):
                raise ValueError("numerical-metadata-key-type")
            return "{\n" + ",\n".join(child_indent + render(key, depth + 1) + ": "
                                     + render(item[key], depth + 1)
                                     for key in sorted(item)) + "\n" + indent + "}"
        raise ValueError("numerical-metadata-value-type")

    return (render(value, 0) + "\n").encode("utf-8")


def content_identity(path: Path, maximum_bytes: int, code: str) -> dict[str, Any]:
    size = regular_file(path, maximum_bytes, code)
    digest = hashlib.sha256()
    observed = 0
    try:
        with path.open("rb", buffering=0) as source:
            while True:
                chunk = source.read(HASH_BUFFER_BYTES)
                if not chunk:
                    break
                observed += len(chunk)
                if observed > maximum_bytes:
                    fail(code)
                digest.update(chunk)
    except OSError:
        fail(code)
    if observed != size:
        fail(code)
    return {"byteLength": observed, "sha256": digest.hexdigest()}


def verify_environment(framework: dict[str, Any]) -> dict[str, Any]:
    """Verify the bound runtime and preserve only typed, path-free rejection codes."""
    repository_root = Path(__file__).resolve(strict=True).parents[2]
    authority_path = repository_root / ENVIRONMENT_AUTHORITY_RELATIVE_PATH
    lock_path = repository_root / ENVIRONMENT_LOCK_RELATIVE_PATH
    authority = framework["environmentAuthority"]
    lock = framework["environmentLock"]
    if content_identity(authority_path, MAXIMUM_JSON_BYTES, "source-trace-environment-authority") != {
        "byteLength": authority["byteLength"], "sha256": authority["sha256"]
    }:
        fail("source-trace-environment-authority")
    if content_identity(lock_path, MAXIMUM_JSON_BYTES, "source-trace-environment-lock") != {
        "byteLength": lock["byteLength"], "sha256": lock["sha256"]
    }:
        fail("source-trace-environment-lock")
    try:
        specification = importlib.util.spec_from_file_location(
            "tinyrustlm_qwen3_numerical_environment_authority", authority_path
        )
        if specification is None or specification.loader is None:
            fail("source-trace-environment-authority")
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        try:
            observed = module.verify_running_environment(
                lock_path, lock["byteLength"], lock["sha256"]
            )
        except module.EnvironmentLockError as error:
            code = error.code
            if (
                isinstance(code, str)
                and len(code) <= 128
                and re.fullmatch(r"qwen3-numerical-environment-[a-z0-9]+(?:-[a-z0-9]+)*", code)
            ):
                fail("source-trace-" + code.removeprefix("qwen3-numerical-"))
            fail("source-trace-environment-drift")
    except SourceOwnerFailure:
        raise
    except Exception:
        fail("source-trace-environment-drift")
    return {
        "authority": {
            "relativePath": ENVIRONMENT_AUTHORITY_RELATIVE_PATH,
            "byteLength": authority["byteLength"],
            "sha256": authority["sha256"],
        },
        "lock": {
            "relativePath": ENVIRONMENT_LOCK_RELATIVE_PATH,
            "byteLength": lock["byteLength"],
            "sha256": lock["sha256"],
            "profileId": observed["profileId"],
            "runtimeClosureSha256": observed["runtimeClosureSha256"],
        },
    }


def verify_current_environment() -> dict[str, Any]:
    repository_root = Path(__file__).resolve(strict=True).parents[2]
    authority_path = repository_root / ENVIRONMENT_AUTHORITY_RELATIVE_PATH
    lock_path = repository_root / ENVIRONMENT_LOCK_RELATIVE_PATH
    authority = content_identity(
        authority_path, MAXIMUM_JSON_BYTES, "source-trace-environment-authority"
    )
    lock = content_identity(
        lock_path, MAXIMUM_JSON_BYTES, "source-trace-environment-lock"
    )
    return verify_environment(
        {
            "environmentAuthority": authority,
            "environmentLock": lock,
        }
    )


def read_strict_json(path: Path, maximum_bytes: int, code: str) -> tuple[dict[str, Any], bytes]:
    size = regular_file(path, maximum_bytes, code)
    if size == 0:
        fail(code)
    try:
        data = path.read_bytes()
        text = data.decode("utf-8", errors="strict")
        value = json.loads(text, object_pairs_hook=duplicate_rejecting_object)
    except (OSError, UnicodeError, json.JSONDecodeError):
        fail(code)
    if not isinstance(value, dict):
        fail(code)
    return value, data


def regular_file(path: Path, maximum_bytes: int, code: str) -> int:
    try:
        if not path.is_absolute() or path.is_symlink():
            fail(code)
        stat = path.stat()
        if not path.is_file() or stat.st_size > maximum_bytes or path.resolve() != path:
            fail(code)
        return stat.st_size
    except OSError:
        fail(code)


def direct_directory(path: Path, code: str) -> Path:
    try:
        if not path.is_absolute() or path.is_symlink() or not path.is_dir():
            fail(code)
        resolved = path.resolve()
        if resolved != path:
            fail(code)
        return resolved
    except OSError:
        fail(code)


def ascii_absolute_path(value: Any, code: str) -> Path:
    if (
        not isinstance(value, str)
        or not value
        or len(value.encode("utf-8")) > 4096
        or not value.isascii()
        or "\0" in value
    ):
        fail(code)
    path = Path(value)
    if not path.is_absolute():
        fail(code)
    return path


def digest_file(path: Path, maximum_bytes: int, code: str) -> tuple[int, str]:
    size = regular_file(path, maximum_bytes, code)
    digest = hashlib.sha256()
    try:
        with path.open("rb") as source:
            while True:
                chunk = source.read(HASH_BUFFER_BYTES)
                if not chunk:
                    break
                digest.update(chunk)
    except OSError:
        fail(code)
    return size, digest.hexdigest()


def valid_sha256(value: Any) -> bool:
    return isinstance(value, str) and SHA256.fullmatch(value) is not None


def valid_identifier(value: Any, maximum: int = 160) -> bool:
    return (
        isinstance(value, str)
        and len(value) <= maximum
        and IDENTIFIER.fullmatch(value) is not None
    )


def token_digest(token_ids: list[int]) -> str:
    digest = hashlib.sha256()
    for token_id in token_ids:
        digest.update(token_id.to_bytes(4, "little", signed=False))
    return digest.hexdigest()


class IsolationPolicy:
    """Deny communication while admitting one pinned local capability probe."""

    maximum_loopback_capability_binds = 1
    denied_prefixes = ("subprocess.",)
    denied_events = frozenset(
        {
            "http.client.connect",
            "os.posix_spawn",
            "os.spawn",
            "os.system",
            "pty.spawn",
            "socket.bind",
            "socket.connect",
            "socket.connect_ex",
            "socket.getaddrinfo",
            "socket.gethostbyaddr",
            "socket.gethostbyname",
            "socket.getnameinfo",
            "socket.getservbyname",
            "socket.getservbyport",
            "socket.listen",
            "socket.sendmsg",
            "socket.sendto",
            "urllib.Request",
        }
    )

    def __init__(self) -> None:
        self.loopback_capability_bind_count = 0

    @staticmethod
    def _is_exact_loopback_capability_bind(
        arguments: tuple[Any, ...], caller_module: Any, caller_function: Any
    ) -> bool:
        if (
            len(arguments) != 2
            or caller_module != "urllib3.util.connection"
            or caller_function != "_has_ipv6"
        ):
            return False
        source_socket, address = arguments
        try:
            return (
                isinstance(source_socket, socket.socket)
                and int(source_socket.family) == int(socket.AF_INET6)
                and int(source_socket.type) == int(socket.SOCK_STREAM)
                and source_socket.proto == 0
                and isinstance(address, tuple)
                and len(address) == 2
                and address[0] == "::1"
                and type(address[1]) is int
                and address[1] == 0
            )
        except (AttributeError, OSError, TypeError, ValueError):
            return False

    def evaluate(
        self,
        event: str,
        arguments: tuple[Any, ...],
        caller_module: Any,
        caller_function: Any,
    ) -> None:
        if event == "socket.bind":
            if (
                self.loopback_capability_bind_count
                < self.maximum_loopback_capability_binds
                and self._is_exact_loopback_capability_bind(
                    arguments, caller_module, caller_function
                )
            ):
                self.loopback_capability_bind_count += 1
                return
            fail("source-trace-isolation-violation")
        if event in self.denied_events or event.startswith(self.denied_prefixes):
            fail("source-trace-isolation-violation")

    def audit(self, event: str, arguments: tuple[Any, ...]) -> None:
        if event != "socket.bind":
            self.evaluate(event, arguments, None, None)
            return
        try:
            caller = sys._getframe(1)  # pylint: disable=protected-access
            caller_module = caller.f_globals.get("__name__")
            caller_function = caller.f_code.co_name
        except (AttributeError, ValueError):
            caller_module = None
            caller_function = None
        self.evaluate(event, arguments, caller_module, caller_function)


def validate_request(request_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    request, request_bytes = read_strict_json(
        request_path, MAXIMUM_REQUEST_BYTES, "source-trace-request-invalid"
    )
    if request_bytes != canonical_json_bytes(request):
        fail("source-trace-request-canonical")
    exact_object(
        request,
        {
            "schema",
            "operationId",
            "differentialProfileSha256",
            "registrationSha256",
            "sourceLock",
            "sourceDirectory",
            "scratchRoot",
            "evidenceParent",
            "outputRoot",
            "traceProfileId",
            "framework",
            "policy",
            "cases",
        },
        "source-trace-request-shape",
    )
    if (
        request["schema"] != REQUEST_SCHEMA
        or not valid_identifier(request["operationId"])
        or not valid_sha256(request["differentialProfileSha256"])
        or not valid_sha256(request["registrationSha256"])
        or request["traceProfileId"] != TRACE_PROFILE_ID
    ):
        fail("source-trace-request-identity")

    source_lock = exact_object(
        request["sourceLock"], {"relativePath", "byteLength", "sha256"},
        "source-trace-source-lock",
    )
    if (
        source_lock["relativePath"] != SOURCE_LOCK_PATH
        or not isinstance(source_lock["byteLength"], int)
        or source_lock["byteLength"] <= 0
        or source_lock["byteLength"] > MAXIMUM_JSON_BYTES
        or not valid_sha256(source_lock["sha256"])
    ):
        fail("source-trace-source-lock")

    framework = exact_object(
        request["framework"],
        {
            "environmentAuthority",
            "environmentLock",
            "pythonVersion",
            "accelerateVersion",
            "psutilVersion",
            "torchVersion",
            "transformersVersion",
            "safetensorsVersion",
            "tokenizersVersion",
            "numpyVersion",
            "device",
            "dtype",
            "attentionImplementation",
            "intraopThreads",
            "interopThreads",
            "deterministicAlgorithms",
            "localFilesOnly",
            "networkAllowed",
        },
        "source-trace-framework",
    )
    environment_authority = exact_object(
        framework["environmentAuthority"],
        {"relativePath", "byteLength", "sha256"},
        "source-trace-environment-authority",
    )
    environment_lock = exact_object(
        framework["environmentLock"],
        {"relativePath", "byteLength", "sha256"},
        "source-trace-environment-lock",
    )
    if (
        environment_authority["relativePath"] != ENVIRONMENT_AUTHORITY_RELATIVE_PATH
        or not isinstance(environment_authority["byteLength"], int)
        or isinstance(environment_authority["byteLength"], bool)
        or not 1 <= environment_authority["byteLength"] <= MAXIMUM_JSON_BYTES
        or not valid_sha256(environment_authority["sha256"])
        or environment_lock["relativePath"] != ENVIRONMENT_LOCK_RELATIVE_PATH
        or not isinstance(environment_lock["byteLength"], int)
        or isinstance(environment_lock["byteLength"], bool)
        or not 1 <= environment_lock["byteLength"] <= MAXIMUM_JSON_BYTES
        or not valid_sha256(environment_lock["sha256"])
        or framework["pythonVersion"] != EXPECTED_PYTHON_VERSION
        or framework["accelerateVersion"] != EXPECTED_PACKAGE_VERSIONS["accelerate"]
        or framework["psutilVersion"] != EXPECTED_PACKAGE_VERSIONS["psutil"]
        or framework["torchVersion"] != EXPECTED_PACKAGE_VERSIONS["torch"]
        or framework["transformersVersion"] != EXPECTED_PACKAGE_VERSIONS["transformers"]
        or framework["safetensorsVersion"] != EXPECTED_PACKAGE_VERSIONS["safetensors"]
        or framework["tokenizersVersion"] != EXPECTED_PACKAGE_VERSIONS["tokenizers"]
        or framework["numpyVersion"] != EXPECTED_PACKAGE_VERSIONS["numpy"]
        or framework["device"] != "cpu"
        or framework["dtype"] != "float32"
        or framework["attentionImplementation"] != "eager"
        or framework["intraopThreads"] != 1
        or framework["interopThreads"] != 1
        or framework["deterministicAlgorithms"] is not True
        or framework["localFilesOnly"] is not True
        or framework["networkAllowed"] is not False
    ):
        fail("source-trace-framework")

    policy = exact_object(
        request["policy"],
        {
            "maximumSourceFileBytes",
            "maximumCases",
            "maximumTokensPerCase",
            "maximumTraceBytes",
            "maximumResultBytes",
        },
        "source-trace-policy",
    )
    limits = list(policy.values())
    if (
        any(not isinstance(value, int) or isinstance(value, bool) or value <= 0 for value in limits)
        or policy["maximumSourceFileBytes"] < 1_600_000_000
        or policy["maximumCases"] > MAXIMUM_CASES
        or policy["maximumTokensPerCase"] > MAXIMUM_TOKENS_PER_CASE
        or policy["maximumTraceBytes"] > 64 * 1024 * 1024 * 1024
        or policy["maximumResultBytes"] > MAXIMUM_JSON_BYTES
    ):
        fail("source-trace-policy")

    cases = request["cases"]
    if not isinstance(cases, list) or not 1 <= len(cases) <= policy["maximumCases"]:
        fail("source-trace-cases")
    seen: set[str] = set()
    for case in cases:
        exact_object(case, {"id", "tokenIds"}, "source-trace-case")
        tokens = case["tokenIds"]
        if (
            not valid_identifier(case["id"], 96)
            or case["id"] in seen
            or not isinstance(tokens, list)
            or not 1 <= len(tokens) <= policy["maximumTokensPerCase"]
            or any(
                not isinstance(token, int)
                or isinstance(token, bool)
                or token < 0
                or token >= EXPECTED_MODEL_SPEC["vocabularySize"]
                for token in tokens
            )
        ):
            fail("source-trace-case")
        seen.add(case["id"])

    source_directory = direct_directory(
        ascii_absolute_path(request["sourceDirectory"], "source-trace-source-directory"),
        "source-trace-source-directory",
    )
    scratch_root = direct_directory(
        ascii_absolute_path(request["scratchRoot"], "source-trace-scratch-root"),
        "source-trace-scratch-root",
    )
    try:
        if any(scratch_root.iterdir()):
            fail("source-trace-scratch-not-empty")
    except OSError:
        fail("source-trace-scratch-root")
    evidence_parent = direct_directory(
        ascii_absolute_path(request["evidenceParent"], "source-trace-evidence-parent"),
        "source-trace-evidence-parent",
    )
    output_root = ascii_absolute_path(request["outputRoot"], "source-trace-output-root")
    expected_name = f"{request['operationId']}-source"
    if (
        output_root.name != expected_name
        or output_root.parent.resolve() != evidence_parent
        or output_root.exists()
        or output_root.is_symlink()
        or scratch_root == source_directory
        or scratch_root == output_root
    ):
        fail("source-trace-output-root")

    repository_root = Path(__file__).resolve().parents[2]
    lock_path = repository_root.joinpath(*SOURCE_LOCK_PATH.split("/"))
    lock_size, lock_sha = digest_file(
        lock_path, MAXIMUM_JSON_BYTES, "source-trace-source-lock"
    )
    if lock_size != source_lock["byteLength"] or lock_sha != source_lock["sha256"]:
        fail("source-trace-source-lock")

    return request, {
        "request": {
            "byteLength": len(request_bytes),
            "sha256": hashlib.sha256(request_bytes).hexdigest(),
        },
        "sourceDirectory": source_directory,
        "scratchRoot": scratch_root,
        "outputRoot": output_root,
        "sourceLockPath": lock_path,
        "sourceLock": {"byteLength": lock_size, "sha256": lock_sha},
    }


def validate_source(lock_path: Path, source_directory: Path, maximum_bytes: int) -> dict[str, Any]:
    lock, _lock_bytes = read_strict_json(lock_path, MAXIMUM_JSON_BYTES, "source-trace-source-lock")
    exact_object(
        lock,
        {
            "schema",
            "modelId",
            "revision",
            "sourceKind",
            "artifactClass",
            "architectureProfileId",
            "licenseSpdx",
            "licenseDisposition",
            "files",
        },
        "source-trace-source-lock",
    )
    if (
        lock["schema"] != SOURCE_LOCK_SCHEMA
        or lock["modelId"] != MODEL_ID
        or lock["revision"] != REVISION
        or lock["sourceKind"] != "upstream-checkpoint"
        or lock["artifactClass"] != "base-model"
    ):
        fail("source-trace-source-lock")
    files = lock["files"]
    if not isinstance(files, dict) or len(files) != 9:
        fail("source-trace-source-lock")
    expected_names: set[str] = set()
    identities: dict[str, dict[str, Any]] = {}
    for logical_name, value in files.items():
        exact_object(value, {"path", "byteLength", "sha256"}, "source-trace-source-lock")
        name = value["path"]
        if (
            not isinstance(logical_name, str)
            or not isinstance(name, str)
            or name != Path(name).name
            or name in expected_names
            or not isinstance(value["byteLength"], int)
            or value["byteLength"] <= 0
            or value["byteLength"] > maximum_bytes
            or not valid_sha256(value["sha256"])
        ):
            fail("source-trace-source-lock")
        expected_names.add(name)
        file_path = source_directory / name
        size, digest = digest_file(file_path, maximum_bytes, "source-trace-source-drift")
        if size != value["byteLength"] or digest != value["sha256"]:
            fail("source-trace-source-drift")
        identities[logical_name] = {"fileName": name, "byteLength": size, "sha256": digest}
    try:
        actual_names = {entry.name for entry in source_directory.iterdir()}
    except OSError:
        fail("source-trace-source-drift")
    if actual_names != expected_names:
        fail("source-trace-source-drift")
    return identities


def validate_config(source_directory: Path) -> None:
    config, _ = read_strict_json(
        source_directory / "config.json", MAXIMUM_JSON_BYTES, "source-trace-config"
    )
    expected = {
        "vocab_size": EXPECTED_MODEL_SPEC["vocabularySize"],
        "max_position_embeddings": EXPECTED_MODEL_SPEC["contextLength"],
        "hidden_size": EXPECTED_MODEL_SPEC["embeddingSize"],
        "intermediate_size": EXPECTED_MODEL_SPEC["feedForwardSize"],
        "num_hidden_layers": EXPECTED_MODEL_SPEC["layerCount"],
        "num_attention_heads": EXPECTED_MODEL_SPEC["headCount"],
        "num_key_value_heads": EXPECTED_MODEL_SPEC["kvHeadCount"],
        "head_dim": EXPECTED_MODEL_SPEC["headDimension"],
        "rope_theta": EXPECTED_MODEL_SPEC["ropeTheta"],
        "rms_norm_eps": EXPECTED_MODEL_SPEC["normalizationEpsilon"],
        "tie_word_embeddings": True,
        "attention_bias": False,
    }
    if config.get("architectures") != ["Qwen3ForCausalLM"] or config.get("model_type") != "qwen3":
        fail("source-trace-config")
    for key, value in expected.items():
        if config.get(key) != value:
            fail("source-trace-config")


def expected_stage_keys(layer_count: int) -> list[tuple[str, int | None]]:
    keys: list[tuple[str, int | None]] = [("token-embedding", None)]
    per_layer = (
        "attention-normalized",
        "query-after-rope",
        "key-after-rope",
        "value",
        "attention",
        "post-attention-residual",
        "feed-forward-normalized",
        "feed-forward-activated",
        "post-feed-forward-residual",
    )
    for layer in range(layer_count):
        keys.extend((stage, layer) for stage in per_layer)
    keys.extend((("final-normalized", None), ("logits", None)))
    return keys


class FrameworkCapture:
    """Captures named tensors without changing the model's returned values."""

    def __init__(self, torch_module: Any, model: Any, qwen_module: Any) -> None:
        self.torch = torch_module
        self.model = model
        self.qwen_module = qwen_module
        self.records: dict[tuple[str, int | None], Any] = {}
        self.handles: list[Any] = []
        self.active_layer: int | None = None
        self.layer_count = len(model.model.layers)
        self.original_rope: Callable[..., Any] = qwen_module.apply_rotary_pos_emb
        self._install()

    def _store(self, stage: str, layer: int | None, tensor: Any) -> None:
        key = (stage, layer)
        if key in self.records:
            fail("source-trace-stage-duplicate")
        if not self.torch.is_tensor(tensor):
            fail("source-trace-stage-type")
        value = tensor.detach().to(device="cpu", dtype=self.torch.float32).contiguous().reshape(-1).clone()
        if value.numel() == 0 or not bool(self.torch.isfinite(value).all().item()):
            fail("source-trace-stage-nonfinite")
        self.records[key] = value

    @staticmethod
    def _first(value: Any) -> Any:
        return value[0] if isinstance(value, (tuple, list)) else value

    def _install(self) -> None:
        self.handles.append(
            self.model.model.embed_tokens.register_forward_hook(
                lambda _module, _inputs, output: self._store("token-embedding", None, output)
            )
        )
        for layer_index, layer in enumerate(self.model.model.layers):
            self.handles.append(
                layer.input_layernorm.register_forward_hook(
                    lambda _module, _inputs, output, index=layer_index: self._store(
                        "attention-normalized", index, output
                    )
                )
            )
            self.handles.append(
                layer.self_attn.register_forward_pre_hook(
                    lambda _module, _inputs, index=layer_index: setattr(self, "active_layer", index)
                )
            )
            self.handles.append(
                layer.self_attn.register_forward_hook(
                    lambda _module, _inputs, output: setattr(self, "active_layer", None)
                )
            )
            self.handles.append(
                layer.self_attn.v_proj.register_forward_hook(
                    lambda _module, _inputs, output, index=layer_index: self._store(
                        "value", index, output
                    )
                )
            )
            self.handles.append(
                layer.self_attn.o_proj.register_forward_pre_hook(
                    lambda _module, inputs, index=layer_index: self._store(
                        "attention", index, inputs[0]
                    )
                )
            )
            self.handles.append(
                layer.post_attention_layernorm.register_forward_pre_hook(
                    lambda _module, inputs, index=layer_index: self._store(
                        "post-attention-residual", index, inputs[0]
                    )
                )
            )
            self.handles.append(
                layer.post_attention_layernorm.register_forward_hook(
                    lambda _module, _inputs, output, index=layer_index: self._store(
                        "feed-forward-normalized", index, output
                    )
                )
            )
            self.handles.append(
                layer.mlp.down_proj.register_forward_pre_hook(
                    lambda _module, inputs, index=layer_index: self._store(
                        "feed-forward-activated", index, inputs[0]
                    )
                )
            )
            self.handles.append(
                layer.register_forward_hook(
                    lambda _module, _inputs, output, index=layer_index: self._store(
                        "post-feed-forward-residual", index, self._first(output)
                    )
                )
            )
        self.handles.append(
            self.model.model.norm.register_forward_hook(
                lambda _module, _inputs, output: self._store("final-normalized", None, output)
            )
        )
        self.handles.append(
            self.model.lm_head.register_forward_hook(
                lambda _module, _inputs, output: self._store("logits", None, output)
            )
        )

        def traced_rope(query: Any, key: Any, *args: Any, **kwargs: Any) -> Any:
            result = self.original_rope(query, key, *args, **kwargs)
            if self.active_layer is None:
                fail("source-trace-rope-layer")
            self._store("query-after-rope", self.active_layer, result[0])
            self._store("key-after-rope", self.active_layer, result[1])
            return result

        self.qwen_module.apply_rotary_pos_emb = traced_rope

    def begin_step(self) -> None:
        if self.records or self.active_layer is not None:
            fail("source-trace-capture-state")

    def finish_step(self) -> list[tuple[str, int | None, Any]]:
        expected = expected_stage_keys(self.layer_count)
        if self.active_layer is not None or set(self.records) != set(expected):
            fail("source-trace-stage-closure")
        ordered = [(stage, layer, self.records[(stage, layer)]) for stage, layer in expected]
        self.records = {}
        return ordered

    def close(self) -> None:
        self.qwen_module.apply_rotary_pos_emb = self.original_rope
        for handle in self.handles:
            handle.remove()
        self.handles = []
        self.active_layer = None


def write_trace(path: Path, records: list[tuple[str, int | None, Any]], maximum: int) -> dict[str, Any]:
    file_digest = hashlib.sha256()
    stages: list[dict[str, Any]] = []
    offset = 0
    try:
        with path.open("xb") as output:
            for stage, layer, tensor in records:
                data = tensor.numpy().astype("<f4", copy=False).tobytes(order="C")
                if offset + len(data) > maximum:
                    fail("source-trace-budget")
                output.write(data)
                file_digest.update(data)
                stages.append(
                    {
                        "stage": stage,
                        "layer": layer,
                        "offsetBytes": offset,
                        "elementCount": len(data) // 4,
                        "byteLength": len(data),
                        "f32leSha256": hashlib.sha256(data).hexdigest(),
                    }
                )
                offset += len(data)
            output.flush()
            os.fsync(output.fileno())
    except OSError:
        fail("source-trace-write")
    return {"traceByteLength": offset, "traceSha256": file_digest.hexdigest(), "stages": stages}


def package_versions() -> dict[str, str]:
    names = ("accelerate", "psutil", "torch", "transformers", "safetensors", "tokenizers", "numpy")
    try:
        return {name: importlib.metadata.version(name) for name in names}
    except importlib.metadata.PackageNotFoundError:
        fail("source-trace-environment")


def verify_pinned_package_versions() -> dict[str, str]:
    versions = package_versions()
    observed_python = (
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    )
    if versions != EXPECTED_PACKAGE_VERSIONS or observed_python != EXPECTED_PYTHON_VERSION:
        fail("source-trace-environment")
    return versions


def load_pinned_framework_model(
    source_directory: Path, scratch_root: Path
) -> tuple[Any, Any, Any, IsolationPolicy]:
    os.environ["HF_HOME"] = str(scratch_root)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    isolation_policy = IsolationPolicy()
    sys.addaudithook(isolation_policy.audit)
    try:
        import torch  # pylint: disable=import-outside-toplevel
        from transformers import Qwen3ForCausalLM  # pylint: disable=import-outside-toplevel
        from transformers.models.qwen3 import modeling_qwen3  # pylint: disable=import-outside-toplevel
    except SourceOwnerFailure:
        raise
    except Exception:
        fail("source-trace-environment")

    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    torch.use_deterministic_algorithms(True)
    if hasattr(torch, "set_flush_denormal") and torch.set_flush_denormal(False) is not True:
        fail("source-trace-floating-environment")

    try:
        model = Qwen3ForCausalLM.from_pretrained(
            source_directory,
            local_files_only=True,
            trust_remote_code=False,
            torch_dtype=torch.float32,
            attn_implementation="eager",
        )
        model.eval()
        model.requires_grad_(False)
        model.to(device="cpu", dtype=torch.float32)
    except SourceOwnerFailure:
        raise
    except Exception:
        fail("source-trace-model-load")
    if isolation_policy.loopback_capability_bind_count != 1:
        fail("source-trace-isolation-capability-probe")
    return torch, modeling_qwen3, model, isolation_policy


def validate_loaded_model(model: Any) -> dict[str, Any]:
    config = model.config
    observed_spec = {
        "vocabularySize": config.vocab_size,
        "contextLength": config.max_position_embeddings,
        "embeddingSize": config.hidden_size,
        "feedForwardSize": config.intermediate_size,
        "layerCount": config.num_hidden_layers,
        "headCount": config.num_attention_heads,
        "kvHeadCount": config.num_key_value_heads,
        "headDimension": config.head_dim,
        "ropeTheta": config.rope_theta,
        "normalizationEpsilon": config.rms_norm_eps,
        "tiedEmbeddings": config.tie_word_embeddings,
        "qkvBias": config.attention_bias,
        "qkNormalization": True,
    }
    if observed_spec != EXPECTED_MODEL_SPEC or config._attn_implementation != "eager":
        fail("source-trace-model-spec")
    return observed_spec


def execute(request_path: Path) -> dict[str, Any]:
    request, state = validate_request(request_path)
    environment_before = verify_environment(request["framework"])
    identities_before = validate_source(
        state["sourceLockPath"],
        state["sourceDirectory"],
        request["policy"]["maximumSourceFileBytes"],
    )
    validate_config(state["sourceDirectory"])
    versions = verify_pinned_package_versions()
    expected_versions = {
        "accelerate": request["framework"]["accelerateVersion"],
        "psutil": request["framework"]["psutilVersion"],
        "torch": request["framework"]["torchVersion"],
        "transformers": request["framework"]["transformersVersion"],
        "safetensors": request["framework"]["safetensorsVersion"],
        "tokenizers": request["framework"]["tokenizersVersion"],
        "numpy": request["framework"]["numpyVersion"],
    }
    if versions != expected_versions or EXPECTED_PYTHON_VERSION != request["framework"]["pythonVersion"]:
        fail("source-trace-environment")

    torch, modeling_qwen3, model, _isolation_policy = load_pinned_framework_model(
        state["sourceDirectory"], state["scratchRoot"]
    )
    observed_spec = validate_loaded_model(model)

    capture = FrameworkCapture(torch, model, modeling_qwen3)
    output_root = state["outputRoot"]
    try:
        output_root.mkdir()
    except OSError:
        capture.close()
        fail("source-trace-output-create")

    cases_output: list[dict[str, Any]] = []
    trace_bytes = 0
    trace_files = 0
    try:
        with torch.inference_mode():
            for case_index, case in enumerate(request["cases"]):
                past_key_values = None
                steps: list[dict[str, Any]] = []
                for step_index, token_id in enumerate(case["tokenIds"]):
                    capture.begin_step()
                    input_ids = torch.tensor([[token_id]], dtype=torch.long, device="cpu")
                    output = model(
                        input_ids=input_ids,
                        past_key_values=past_key_values,
                        use_cache=True,
                        output_attentions=False,
                        output_hidden_states=False,
                        logits_to_keep=1,
                        return_dict=True,
                    )
                    past_key_values = output.past_key_values
                    records = capture.finish_step()
                    remaining = request["policy"]["maximumTraceBytes"] - trace_bytes
                    if remaining <= 0:
                        fail("source-trace-budget")
                    trace_file = f"case-{case_index:03d}-step-{step_index:03d}.f32le"
                    trace_result = write_trace(output_root / trace_file, records, remaining)
                    trace_bytes += trace_result["traceByteLength"]
                    trace_files += 1
                    logits = records[-1][2]
                    greedy = int(torch.argmax(logits).item())
                    kv_bytes = (
                        EXPECTED_MODEL_SPEC["layerCount"]
                        * (step_index + 1)
                        * EXPECTED_MODEL_SPEC["kvHeadCount"]
                        * EXPECTED_MODEL_SPEC["headDimension"]
                        * 2
                        * 4
                    )
                    steps.append(
                        {
                            "step": step_index,
                            "positionBefore": step_index,
                            "positionAfter": step_index + 1,
                            "committedKvBytes": kv_bytes,
                            "greedyTokenId": greedy,
                            "traceFile": trace_file,
                            **trace_result,
                        }
                    )
                cases_output.append(
                    {
                        "id": case["id"],
                        "tokenCount": len(case["tokenIds"]),
                        "tokenIdsLeU32Sha256": token_digest(case["tokenIds"]),
                        "steps": steps,
                    }
                )
    finally:
        capture.close()

    identities_after = validate_source(
        state["sourceLockPath"],
        state["sourceDirectory"],
        request["policy"]["maximumSourceFileBytes"],
    )
    if identities_after != identities_before:
        fail("source-trace-source-drift")
    try:
        if any(state["scratchRoot"].iterdir()):
            fail("source-trace-unexpected-cache-write")
    except OSError:
        fail("source-trace-scratch-root")
    environment_after = verify_environment(request["framework"])
    if environment_after != environment_before:
        fail("source-trace-environment-drift")

    result = {
        "schema": RESULT_SCHEMA,
        "operationId": request["operationId"],
        "status": "completed",
        "claim": "private-publisher-source-traces-created-not-numerical-parity",
        "implementation": {
            "kind": "publisher-source-framework",
            "profileId": IMPLEMENTATION_ID,
            "pythonVersion": request["framework"]["pythonVersion"],
            "packages": versions,
            "device": "cpu",
            "dtype": "float32",
            "attentionImplementation": "eager",
            "threads": 1,
            "environment": environment_before,
        },
        "request": state["request"],
        "differentialProfileSha256": request["differentialProfileSha256"],
        "registrationSha256": request["registrationSha256"],
        "traceProfileId": TRACE_PROFILE_ID,
        "source": {
            "modelId": MODEL_ID,
            "revision": REVISION,
            "sourceLock": state["sourceLock"],
            "model": identities_before["model"],
        },
        "modelSpec": observed_spec,
        "caseCount": len(cases_output),
        "traceFileCount": trace_files,
        "traceByteLength": trace_bytes,
        "cases": cases_output,
        "durability": {
            "traceFilesSynced": True,
            "resultFileSynced": True,
            "directorySyncClaimed": False,
        },
        "requiredNextGate": "independent-source-reconstructed-scalar-trace-verification",
    }
    result_bytes = canonical_json_bytes(result)
    if len(result_bytes) > request["policy"]["maximumResultBytes"]:
        fail("source-trace-result-limit")
    result_path = output_root / "probe.json"
    try:
        with result_path.open("xb") as output:
            output.write(result_bytes)
            output.flush()
            os.fsync(output.fileno())
    except OSError:
        fail("source-trace-result-write")
    return result


def self_test() -> None:
    keys = expected_stage_keys(1)
    if len(keys) != 12 or keys[0] != ("token-embedding", None) or keys[-1] != ("logits", None):
        fail("source-trace-self-test")
    if token_digest([1, 2]) != hashlib.sha256(b"\x01\0\0\0\x02\0\0\0").hexdigest():
        fail("source-trace-self-test")


def isolation_self_test() -> None:
    def expect_denied(
        policy: IsolationPolicy,
        event: str,
        arguments: tuple[Any, ...],
        caller_module: str,
        caller_function: str,
    ) -> None:
        try:
            policy.evaluate(event, arguments, caller_module, caller_function)
        except SourceOwnerFailure as error:
            if str(error) == "source-trace-isolation-violation":
                return
        fail("source-trace-isolation-self-test")

    sockets: list[socket.socket] = []
    try:
        ipv6_stream = socket.socket(socket.AF_INET6, socket.SOCK_STREAM, 0)
        ipv4_stream = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
        ipv6_datagram = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM, 0)
        ipv6_tcp = socket.socket(socket.AF_INET6, socket.SOCK_STREAM, socket.IPPROTO_TCP)
        sockets.extend((ipv6_stream, ipv4_stream, ipv6_datagram, ipv6_tcp))

        exact_arguments = (ipv6_stream, ("::1", 0))
        policy = IsolationPolicy()
        policy.evaluate(
            "socket.bind",
            exact_arguments,
            "urllib3.util.connection",
            "_has_ipv6",
        )
        if policy.loopback_capability_bind_count != 1:
            fail("source-trace-isolation-self-test")
        expect_denied(
            policy,
            "socket.bind",
            exact_arguments,
            "urllib3.util.connection",
            "_has_ipv6",
        )

        invalid_binds = (
            ((ipv4_stream, ("::1", 0)), "urllib3.util.connection", "_has_ipv6"),
            ((ipv6_datagram, ("::1", 0)), "urllib3.util.connection", "_has_ipv6"),
            ((ipv6_tcp, ("::1", 0)), "urllib3.util.connection", "_has_ipv6"),
            ((ipv6_stream, ("127.0.0.1", 0)), "urllib3.util.connection", "_has_ipv6"),
            ((ipv6_stream, ("::1", 1)), "urllib3.util.connection", "_has_ipv6"),
            ((ipv6_stream, ("::1", 0)), "unexpected.module", "_has_ipv6"),
            ((ipv6_stream, ("::1", 0)), "urllib3.util.connection", "unexpected"),
        )
        for arguments, caller_module, caller_function in invalid_binds:
            candidate = IsolationPolicy()
            expect_denied(
                candidate,
                "socket.bind",
                arguments,
                caller_module,
                caller_function,
            )
            if candidate.loopback_capability_bind_count != 0:
                fail("source-trace-isolation-self-test")

        for event in (
            "socket.connect",
            "socket.getaddrinfo",
            "socket.listen",
            "socket.sendto",
            "subprocess.Popen",
        ):
            expect_denied(IsolationPolicy(), event, (), "self-test", "self-test")
        IsolationPolicy().evaluate("open", (), "self-test", "self-test")

        installed_policy = IsolationPolicy()
        sys.addaudithook(installed_policy.audit)
        sys._getframe()  # pylint: disable=protected-access
        if installed_policy.loopback_capability_bind_count != 0:
            fail("source-trace-isolation-self-test")
    except OSError:
        fail("source-trace-isolation-self-test")
    finally:
        for source_socket in sockets:
            source_socket.close()


def model_load_isolation_diagnostic(
    source_value: str, scratch_value: str
) -> dict[str, Any]:
    source_directory = direct_directory(
        ascii_absolute_path(source_value, "source-trace-source-directory"),
        "source-trace-source-directory",
    )
    scratch_root = direct_directory(
        ascii_absolute_path(scratch_value, "source-trace-scratch-root"),
        "source-trace-scratch-root",
    )
    try:
        if source_directory == scratch_root or any(scratch_root.iterdir()):
            fail("source-trace-scratch-not-empty")
    except OSError:
        fail("source-trace-scratch-root")

    repository_root = Path(__file__).resolve(strict=True).parents[2]
    source_lock_path = repository_root.joinpath(*SOURCE_LOCK_PATH.split("/"))
    identities = validate_source(
        source_lock_path,
        source_directory,
        DIAGNOSTIC_MAXIMUM_SOURCE_FILE_BYTES,
    )
    validate_config(source_directory)
    environment = verify_current_environment()
    versions = verify_pinned_package_versions()
    _torch, _modeling_qwen3, model, isolation_policy = load_pinned_framework_model(
        source_directory, scratch_root
    )
    observed_spec = validate_loaded_model(model)
    del model
    return {
        "status": "pass",
        "claim": "pinned-local-model-load-and-one-ipv6-loopback-capability-bind-only",
        "modelId": MODEL_ID,
        "revision": REVISION,
        "sourceFileCount": len(identities),
        "sourceByteLength": sum(value["byteLength"] for value in identities.values()),
        "pythonVersion": EXPECTED_PYTHON_VERSION,
        "packageVersions": versions,
        "environmentProfileId": environment["lock"]["profileId"],
        "environmentLockSha256": environment["lock"]["sha256"],
        "runtimeClosureSha256": environment["lock"]["runtimeClosureSha256"],
        "modelSpec": observed_spec,
        "capabilityProbeCount": isolation_policy.loopback_capability_bind_count,
        "traceOutputCreated": False,
    }


def framework_self_test() -> None:
    for variable in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
        os.environ[variable] = "1"
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    if (
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        != EXPECTED_PYTHON_VERSION
        or package_versions() != EXPECTED_PACKAGE_VERSIONS
    ):
        fail("source-trace-framework-self-test-environment")
    isolation_policy = IsolationPolicy()
    sys.addaudithook(isolation_policy.audit)
    try:
        import torch  # pylint: disable=import-outside-toplevel
        from transformers import (  # pylint: disable=import-outside-toplevel
            Qwen3Config,
            Qwen3ForCausalLM,
        )
        from transformers.models.qwen3 import modeling_qwen3  # pylint: disable=import-outside-toplevel
    except SourceOwnerFailure:
        raise
    except Exception:
        fail("source-trace-framework-self-test-environment")
    if isolation_policy.loopback_capability_bind_count != 1:
        fail("source-trace-framework-self-test-isolation")
    torch.manual_seed(7)
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    torch.use_deterministic_algorithms(True)
    config = Qwen3Config(
        vocab_size=32,
        hidden_size=16,
        intermediate_size=32,
        num_hidden_layers=1,
        num_attention_heads=2,
        num_key_value_heads=1,
        head_dim=8,
        max_position_embeddings=32,
        tie_word_embeddings=True,
        attention_bias=False,
        use_sliding_window=False,
    )
    config._attn_implementation = "eager"  # pylint: disable=protected-access
    model = Qwen3ForCausalLM(config).eval()
    capture = FrameworkCapture(torch, model, modeling_qwen3)
    try:
        capture.begin_step()
        with torch.inference_mode():
            model(
                input_ids=torch.tensor([[3]], dtype=torch.long),
                use_cache=True,
                output_attentions=False,
                output_hidden_states=False,
                logits_to_keep=1,
                return_dict=True,
            )
        records = capture.finish_step()
    finally:
        capture.close()
    expected_sizes = {
        "token-embedding": 16,
        "attention-normalized": 16,
        "query-after-rope": 16,
        "key-after-rope": 8,
        "value": 8,
        "attention": 16,
        "post-attention-residual": 16,
        "feed-forward-normalized": 16,
        "feed-forward-activated": 32,
        "post-feed-forward-residual": 16,
        "final-normalized": 16,
        "logits": 32,
    }
    if [(stage, layer) for stage, layer, _value in records] != expected_stage_keys(1):
        fail("source-trace-framework-self-test-stage")
    for stage, _layer, value in records:
        if value.numel() != expected_sizes[stage] or not bool(torch.isfinite(value).all().item()):
            fail("source-trace-framework-self-test-shape")


def main(arguments: list[str]) -> None:
    if arguments == ["--self-test"]:
        self_test()
        print(json.dumps({"status": "pass", "claim": "source-owner-stdlib-self-test-only"}))
        return
    if arguments == ["--isolation-self-test"]:
        isolation_self_test()
        print(json.dumps({"status": "pass", "claim": "one-ipv6-loopback-capability-bind-only"}))
        return
    if len(arguments) == 3 and arguments[0] == "--model-load-isolation-diagnostic":
        print(
            json.dumps(
                model_load_isolation_diagnostic(arguments[1], arguments[2]),
                sort_keys=True,
            )
        )
        return
    if arguments == ["--framework-self-test"]:
        framework_self_test()
        print(json.dumps({"status": "pass", "claim": "synthetic-framework-hook-test-only"}))
        return
    if len(arguments) != 1:
        fail("source-trace-arguments")
    result = execute(Path(arguments[0]))
    print(
        json.dumps(
            {
                "schema": result["schema"],
                "status": result["status"],
                "operationId": result["operationId"],
                "caseCount": result["caseCount"],
                "traceFileCount": result["traceFileCount"],
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except SourceOwnerFailure as error:
        print(f"qwen3-source-trace-error:{error}", file=sys.stderr)
        raise SystemExit(1) from None
