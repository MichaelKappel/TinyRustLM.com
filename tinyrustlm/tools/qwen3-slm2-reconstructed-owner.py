"""Create-only independent reconstructed-weight traces for one SLM2 Qwen3 model.

This private diagnostic owner does not share the Rust runtime implementation. It
parses the immutable SLM2 artifact, validates its exact Qwen3 tensor registry and
payload identities, reconstructs Q8 rows in bounded chunks, and records the same
semantic stages as the scalar probe. It is not a shipping backend or a fallback.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import mmap
import os
from pathlib import Path
import re
import struct
import sys
from typing import Any


REQUEST_SCHEMA = "tinyrustlm.qwen3_slm2_reconstructed_request.v1"
RESULT_SCHEMA = "tinyrustlm.numerical_trace_bundle.v1"
IMPLEMENTATION_ID = "tinyrustlm.qwen3-slm2-reconstructed-trace/1"
TRACE_PROFILE_ID = "tinyrustlm.scalar-full-stage-f32le/1"
COMPOSITION_RESULT_SHA256 = "0c3e84ad9ce6e22d9a164357c9a900d31825d0639f4f11077dab305f9cf3ef0e"
MODEL_BYTE_LENGTH = 598308416
MODEL_SHA256 = "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
MAGIC = b"SLM2\r\n\x1a\n"
FORMAT_ID = b"minimodel.slm2\0\0"
HEADER_BYTES = 224
QUANT_RECORD_BYTES = 128
TENSOR_RECORD_BYTES = 192
SECTION_ALIGNMENT = 64
MAXIMUM_REQUEST_BYTES = 1024 * 1024
MAXIMUM_JSON_BYTES = 32 * 1024 * 1024
HASH_BUFFER_BYTES = 1024 * 1024
MAXIMUM_CASES = 32
MAXIMUM_TOKENS_PER_CASE = 256
IDENTIFIER = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
ARTIFACT_IDENTIFIER = re.compile(r"^[a-z0-9][a-z0-9._/-]*$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
PAYLOAD_DOMAIN = b"tinyrustlm.slm2.tensor-payload.mixed-q8-row.v1\0"
ENVIRONMENT_LOCK_RELATIVE_PATH = (
    "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json"
)
ENVIRONMENT_AUTHORITY_RELATIVE_PATH = (
    "tinyrustlm/tools/qwen3_numerical_environment_lock.py"
)

sys.dont_write_bytecode = True

MODEL_SPEC = {
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

Q8_ROLES = {
    "model.token-embedding.weight",
    "model.output-projection.weight",
    "layer.attention.query-projection.weight",
    "layer.attention.key-projection.weight",
    "layer.attention.value-projection.weight",
    "layer.attention.output-projection.weight",
    "layer.feed-forward.gate-projection.weight",
    "layer.feed-forward.down-projection.weight",
    "layer.feed-forward.up-projection.weight",
}
F32_ROLES = {
    "model.final-normalization.weight",
    "layer.attention-normalization.weight",
    "layer.feed-forward-normalization.weight",
    "layer.attention.query-normalization.weight",
    "layer.attention.key-normalization.weight",
}


class ReconstructedOwnerFailure(Exception):
    """One stable fail-closed reconstructed owner error."""


def fail(code: str) -> None:
    raise ReconstructedOwnerFailure(code)


def duplicate_rejecting_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail("reconstructed-trace-json-duplicate")
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


def verify_environment(implementation: dict[str, Any]) -> dict[str, Any]:
    repository_root = Path(__file__).resolve(strict=True).parents[2]
    authority_path = repository_root / ENVIRONMENT_AUTHORITY_RELATIVE_PATH
    lock_path = repository_root / ENVIRONMENT_LOCK_RELATIVE_PATH
    authority = implementation["environmentAuthority"]
    lock = implementation["environmentLock"]
    if content_identity(
        authority_path, MAXIMUM_JSON_BYTES, "reconstructed-trace-environment-authority"
    ) != {"byteLength": authority["byteLength"], "sha256": authority["sha256"]}:
        fail("reconstructed-trace-environment-authority")
    if content_identity(
        lock_path, MAXIMUM_JSON_BYTES, "reconstructed-trace-environment-lock"
    ) != {"byteLength": lock["byteLength"], "sha256": lock["sha256"]}:
        fail("reconstructed-trace-environment-lock")
    try:
        specification = importlib.util.spec_from_file_location(
            "tinyrustlm_qwen3_numerical_environment_authority", authority_path
        )
        if specification is None or specification.loader is None:
            fail("reconstructed-trace-environment-authority")
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        observed = module.verify_running_environment(
            lock_path, lock["byteLength"], lock["sha256"]
        )
    except ReconstructedOwnerFailure:
        raise
    except Exception:
        fail("reconstructed-trace-environment-drift")
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


def read_strict_json(path: Path, maximum: int, code: str) -> tuple[dict[str, Any], bytes]:
    if regular_file(path, maximum, code) == 0:
        fail(code)
    try:
        data = path.read_bytes()
        value = json.loads(
            data.decode("utf-8", errors="strict"),
            object_pairs_hook=duplicate_rejecting_object,
        )
    except (OSError, UnicodeError, json.JSONDecodeError):
        fail(code)
    if not isinstance(value, dict):
        fail(code)
    return value, data


def digest_file(path: Path, maximum: int, code: str) -> tuple[int, str]:
    size = regular_file(path, maximum, code)
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
        digest.update(struct.pack("<I", token_id))
    return digest.hexdigest()


def audit_hook(event: str, _arguments: tuple[Any, ...]) -> None:
    denied_prefixes = ("subprocess.",)
    denied_events = {
        "os.system", "os.posix_spawn", "os.spawn", "pty.spawn",
        "socket.bind", "socket.connect", "socket.connect_ex", "socket.getaddrinfo",
        "socket.gethostbyaddr", "socket.gethostbyname", "urllib.Request",
        "http.client.connect",
    }
    if event in denied_events or event.startswith(denied_prefixes):
        fail("reconstructed-trace-isolation-violation")


def align_up(value: int, alignment: int = SECTION_ALIGNMENT) -> int:
    if value < 0 or alignment <= 0 or alignment & (alignment - 1):
        fail("reconstructed-trace-overflow")
    return (value + alignment - 1) & ~(alignment - 1)


def checked_product(values: list[int], code: str = "reconstructed-trace-overflow") -> int:
    result = 1
    for value in values:
        if not isinstance(value, int) or value <= 0:
            fail(code)
        result *= value
        if result > (1 << 63) - 1:
            fail(code)
    return result


def expected_stage_keys(layer_count: int) -> list[tuple[str, int | None]]:
    output: list[tuple[str, int | None]] = [("token-embedding", None)]
    stages = (
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
        output.extend((stage, layer) for stage in stages)
    output.extend((("final-normalized", None), ("logits", None)))
    return output


@dataclass(frozen=True)
class TensorRecord:
    semantic_role: str
    canonical_name: str
    layer: int
    shape: tuple[int, ...]
    shape8: tuple[int, ...]
    logical_elements: int
    element_type: int
    quant_profile_index: int
    stored_bytes: int
    payload_offset: int
    payload_length: int
    payload_alignment: int
    block_elements: int
    block_bytes: int
    scale_type: int
    zero_point_type: int
    packing_order: int
    accumulator_type: int
    tail_rule: int
    flags: int
    flags2: int
    auxiliary_first: int
    auxiliary_count: int
    payload_sha256: bytes


def required_tensors() -> list[dict[str, Any]]:
    query_width = MODEL_SPEC["headCount"] * MODEL_SPEC["headDimension"]
    kv_width = MODEL_SPEC["kvHeadCount"] * MODEL_SPEC["headDimension"]
    entries: list[dict[str, Any]] = [
        {
            "role": "model.token-embedding.weight",
            "name": "model.token-embedding.weight",
            "layer": -1,
            "shape": (MODEL_SPEC["vocabularySize"], MODEL_SPEC["embeddingSize"]),
        },
        {
            "role": "model.final-normalization.weight",
            "name": "model.final-normalization.weight",
            "layer": -1,
            "shape": (MODEL_SPEC["embeddingSize"],),
        },
    ]
    for layer in range(MODEL_SPEC["layerCount"]):
        prefix = f"model.layers.{layer}"
        entries.extend(
            [
                {"role": "layer.attention-normalization.weight", "name": f"{prefix}.attention-normalization.weight", "layer": layer, "shape": (MODEL_SPEC["embeddingSize"],)},
                {"role": "layer.feed-forward-normalization.weight", "name": f"{prefix}.feed-forward-normalization.weight", "layer": layer, "shape": (MODEL_SPEC["embeddingSize"],)},
                {"role": "layer.attention.query-projection.weight", "name": f"{prefix}.attention.query-projection.weight", "layer": layer, "shape": (query_width, MODEL_SPEC["embeddingSize"])},
                {"role": "layer.attention.key-projection.weight", "name": f"{prefix}.attention.key-projection.weight", "layer": layer, "shape": (kv_width, MODEL_SPEC["embeddingSize"])},
                {"role": "layer.attention.value-projection.weight", "name": f"{prefix}.attention.value-projection.weight", "layer": layer, "shape": (kv_width, MODEL_SPEC["embeddingSize"])},
                {"role": "layer.attention.output-projection.weight", "name": f"{prefix}.attention.output-projection.weight", "layer": layer, "shape": (MODEL_SPEC["embeddingSize"], query_width)},
                {"role": "layer.feed-forward.gate-projection.weight", "name": f"{prefix}.feed-forward.gate-projection.weight", "layer": layer, "shape": (MODEL_SPEC["feedForwardSize"], MODEL_SPEC["embeddingSize"])},
                {"role": "layer.feed-forward.down-projection.weight", "name": f"{prefix}.feed-forward.down-projection.weight", "layer": layer, "shape": (MODEL_SPEC["embeddingSize"], MODEL_SPEC["feedForwardSize"])},
                {"role": "layer.feed-forward.up-projection.weight", "name": f"{prefix}.feed-forward.up-projection.weight", "layer": layer, "shape": (MODEL_SPEC["feedForwardSize"], MODEL_SPEC["embeddingSize"])},
                {"role": "layer.attention.query-normalization.weight", "name": f"{prefix}.attention.query-normalization.weight", "layer": layer, "shape": (MODEL_SPEC["headDimension"],)},
                {"role": "layer.attention.key-normalization.weight", "name": f"{prefix}.attention.key-normalization.weight", "layer": layer, "shape": (MODEL_SPEC["headDimension"],)},
            ]
        )
    entries.sort(key=lambda item: (item["role"].encode("ascii"), item["layer"], item["name"].encode("ascii")))
    return entries


def update_identifier(digest: Any, value: str) -> None:
    encoded = value.encode("ascii")
    digest.update(struct.pack("<I", len(encoded)))
    digest.update(encoded)


def update_descriptor(digest: Any, tensor: TensorRecord) -> None:
    update_identifier(digest, tensor.semantic_role)
    update_identifier(digest, tensor.canonical_name)
    digest.update(struct.pack("<iiiI", tensor.layer, -1, -1, len(tensor.shape)))
    digest.update(struct.pack("<8Q", *tensor.shape8))
    digest.update(struct.pack("<QHHQ", tensor.logical_elements, tensor.element_type, tensor.quant_profile_index, tensor.stored_bytes))
    digest.update(struct.pack("<III", tensor.payload_alignment, tensor.block_elements, tensor.block_bytes))
    digest.update(struct.pack("<HHHHHBHII", tensor.scale_type, tensor.zero_point_type, tensor.packing_order, tensor.accumulator_type, tensor.tail_rule, tensor.flags, tensor.flags2, tensor.auxiliary_first, tensor.auxiliary_count))


class Slm2Model:
    """Independent read-only SLM2 mapping and tensor registry."""

    def __init__(self, path: Path, expected_sha256: str, maximum_bytes: int, np_module: Any) -> None:
        self.path = path
        self.np = np_module
        size, digest = digest_file(path, maximum_bytes, "reconstructed-trace-model-read")
        if digest != expected_sha256:
            fail("reconstructed-trace-model-drift")
        self.size = size
        try:
            self.file = path.open("rb")
            self.mapping = mmap.mmap(self.file.fileno(), 0, access=mmap.ACCESS_READ)
        except OSError:
            fail("reconstructed-trace-model-map")
        self.artifact_class = 0
        self.tensors: list[TensorRecord] = []
        self.by_role_layer: dict[tuple[str, int], TensorRecord] = {}
        self._parse()

    def close(self) -> None:
        try:
            self.mapping.close()
            self.file.close()
        except OSError:
            fail("reconstructed-trace-model-close")

    def _range(self, offset: int, length: int, code: str) -> None:
        if offset < 0 or length < 0 or offset + length > self.size:
            fail(code)

    def _unpack(self, fmt: str, offset: int, code: str) -> tuple[Any, ...]:
        length = struct.calcsize(fmt)
        self._range(offset, length, code)
        return struct.unpack_from(fmt, self.mapping, offset)

    def _zero(self, start: int, end: int) -> None:
        self._range(start, end - start, "reconstructed-trace-model-layout")
        view = memoryview(self.mapping)[start:end]
        try:
            if any(view):
                fail("reconstructed-trace-model-padding")
        finally:
            view.release()

    def _strings(self, offset: int, length: int) -> list[str]:
        self._range(offset, length, "reconstructed-trace-string-table")
        if length < 12:
            fail("reconstructed-trace-string-table")
        count, pool_length = self._unpack("<II", offset, "reconstructed-trace-string-table")
        if count <= 0 or count > 262144:
            fail("reconstructed-trace-string-table")
        prefix_length = 8 + (count + 1) * 4
        if prefix_length + pool_length != length:
            fail("reconstructed-trace-string-table")
        offsets = self._unpack(f"<{count + 1}I", offset + 8, "reconstructed-trace-string-table")
        if offsets[0] != 0 or offsets[-1] != pool_length:
            fail("reconstructed-trace-string-table")
        output: list[str] = []
        pool = offset + prefix_length
        for index in range(count):
            start, end = offsets[index], offsets[index + 1]
            if start >= end or end > pool_length:
                fail("reconstructed-trace-string-table")
            try:
                value = bytes(self.mapping[pool + start : pool + end]).decode("ascii", errors="strict")
            except UnicodeError:
                fail("reconstructed-trace-string-table")
            if (
                len(value) > 255
                or ARTIFACT_IDENTIFIER.fullmatch(value) is None
                or value.startswith("/")
                or value.endswith("/")
                or any(part in {"", ".", ".."} for part in value.split("/"))
                or (output and output[-1].encode("ascii") >= value.encode("ascii"))
            ):
                fail("reconstructed-trace-string-table")
            output.append(value)
        return output

    def _tensor(self, offset: int, strings: list[str], payload_base: int) -> TensorRecord:
        record = memoryview(self.mapping)[offset : offset + TENSOR_RECORD_BYTES]
        try:
            version = struct.unpack_from("<H", record, 0)[0]
            rank = record[2]
            flags = record[3]
            element_type, quant_index = struct.unpack_from("<HH", record, 4)
            role_id, name_id = struct.unpack_from("<II", record, 8)
            layer, subindex0, subindex1 = struct.unpack_from("<iii", record, 16)
            shape8 = struct.unpack_from("<8Q", record, 32)
            logical_elements = struct.unpack_from("<Q", record, 96)[0]
            stored_bytes = struct.unpack_from("<Q", record, 104)[0]
            relative_offset = struct.unpack_from("<Q", record, 112)[0]
            payload_length = struct.unpack_from("<Q", record, 120)[0]
            payload_alignment, block_elements, block_bytes = struct.unpack_from("<III", record, 128)
            scale_type, zero_point_type, packing_order, accumulator_type, tail_rule, flags2 = struct.unpack_from("<HHHHHH", record, 140)
            auxiliary_first, auxiliary_count = struct.unpack_from("<II", record, 152)
            payload_sha = bytes(record[160:192])
        finally:
            record.release()
        if (
            version != 1
            or rank <= 0
            or rank > 8
            or flags != 0
            or role_id >= len(strings)
            or name_id >= len(strings)
            or layer < -1
            or subindex0 != -1
            or subindex1 != -1
            or any(value <= 0 or value > 0xFFFFFFFF for value in shape8[:rank])
            or any(value != 0 for value in shape8[rank:])
            or not any(payload_sha)
        ):
            fail("reconstructed-trace-tensor-record")
        shape = tuple(int(value) for value in shape8[:rank])
        if checked_product(list(shape)) != logical_elements:
            fail("reconstructed-trace-tensor-record")
        return TensorRecord(
            semantic_role=strings[role_id],
            canonical_name=strings[name_id],
            layer=layer,
            shape=shape,
            shape8=tuple(int(value) for value in shape8),
            logical_elements=logical_elements,
            element_type=element_type,
            quant_profile_index=quant_index,
            stored_bytes=stored_bytes,
            payload_offset=payload_base + relative_offset,
            payload_length=payload_length,
            payload_alignment=payload_alignment,
            block_elements=block_elements,
            block_bytes=block_bytes,
            scale_type=scale_type,
            zero_point_type=zero_point_type,
            packing_order=packing_order,
            accumulator_type=accumulator_type,
            tail_rule=tail_rule,
            flags=flags,
            flags2=flags2,
            auxiliary_first=auxiliary_first,
            auxiliary_count=auxiliary_count,
            payload_sha256=payload_sha,
        )

    def _validate_encoding(self, tensor: TensorRecord) -> None:
        if tensor.payload_alignment < 64 or tensor.payload_alignment > 4096 or tensor.payload_alignment & (tensor.payload_alignment - 1):
            fail("reconstructed-trace-tensor-encoding")
        if tensor.semantic_role in Q8_ROLES:
            if (
                len(tensor.shape) != 2
                or tensor.element_type != 2
                or tensor.quant_profile_index != 0
                or tensor.stored_bytes != tensor.shape[0] * (tensor.shape[1] + 4)
                or tensor.payload_length != tensor.stored_bytes
                or tensor.block_elements != tensor.shape[1]
                or tensor.block_bytes != tensor.shape[1] + 4
                or tensor.scale_type != 1
                or tensor.zero_point_type != 0
                or tensor.packing_order != 1
                or tensor.accumulator_type != 1
                or tensor.tail_rule != 1
                or tensor.flags2 != 0
                or tensor.auxiliary_first != 0
                or tensor.auxiliary_count != 0
            ):
                fail("reconstructed-trace-tensor-encoding")
        elif tensor.semantic_role in F32_ROLES:
            if (
                tensor.element_type != 1
                or tensor.quant_profile_index != 0xFFFF
                or tensor.stored_bytes != tensor.logical_elements * 4
                or tensor.payload_length != tensor.stored_bytes
                or any(
                    value != 0
                    for value in (
                        tensor.block_elements,
                        tensor.block_bytes,
                        tensor.scale_type,
                        tensor.zero_point_type,
                        tensor.packing_order,
                        tensor.accumulator_type,
                        tensor.tail_rule,
                        tensor.flags2,
                        tensor.auxiliary_first,
                        tensor.auxiliary_count,
                    )
                )
            ):
                fail("reconstructed-trace-tensor-encoding")
        else:
            fail("reconstructed-trace-tensor-registry")

    def _payload_digest(self, tensor: TensorRecord) -> bytes:
        digest = hashlib.sha256()
        digest.update(PAYLOAD_DOMAIN)
        digest.update(struct.pack("<H", self.artifact_class))
        update_descriptor(digest, tensor)
        digest.update(struct.pack("<Q", tensor.payload_length))
        cursor = tensor.payload_offset
        end = cursor + tensor.payload_length
        while cursor < end:
            next_cursor = min(end, cursor + HASH_BUFFER_BYTES)
            view = memoryview(self.mapping)[cursor:next_cursor]
            try:
                digest.update(view)
            finally:
                view.release()
            cursor = next_cursor
        return digest.digest()

    def _validate_payload(self, tensor: TensorRecord) -> None:
        np = self.np
        if self._payload_digest(tensor) != tensor.payload_sha256:
            fail("reconstructed-trace-payload-hash")
        if tensor.element_type == 1:
            values = np.ndarray(
                (tensor.logical_elements,), dtype="<f4", buffer=self.mapping,
                offset=tensor.payload_offset,
            )
            if not bool(np.isfinite(values).all()):
                fail("reconstructed-trace-payload-nonfinite")
            return
        rows, columns = tensor.shape
        row_bytes = columns + 4
        scales = np.ndarray(
            (rows,), dtype="<f4", buffer=self.mapping, offset=tensor.payload_offset,
            strides=(row_bytes,),
        )
        codes = np.ndarray(
            (rows, columns), dtype=np.int8, buffer=self.mapping,
            offset=tensor.payload_offset + 4, strides=(row_bytes, 1),
        )
        if not bool((np.isfinite(scales) & (scales > 0)).all()) or bool((codes == -128).any()):
            fail("reconstructed-trace-payload-invalid")
        zero_rows = np.all(codes == 0, axis=1)
        if bool(zero_rows.any()):
            bits = np.ndarray(
                (rows,), dtype="<u4", buffer=self.mapping, offset=tensor.payload_offset,
                strides=(row_bytes,),
            )
            if not bool((bits[zero_rows] == 0x3F800000).all()):
                fail("reconstructed-trace-payload-invalid")

    def _validate_quant_record(self, offset: int, strings: list[str]) -> None:
        record = memoryview(self.mapping)[offset : offset + QUANT_RECORD_BYTES]
        try:
            if (
                struct.unpack_from("<H", record, 0)[0] != 1
                or struct.unpack_from("<H", record, 2)[0] != 0
                or struct.unpack_from("<H", record, 20)[0] != 1
                or struct.unpack_from("<H", record, 22)[0] != 2
                or struct.unpack_from("<H", record, 24)[0] != 8
                or struct.unpack_from("<H", record, 26)[0] != 1
                or struct.unpack_from("<h", record, 28)[0] != -127
                or struct.unpack_from("<h", record, 30)[0] != 127
                or tuple(struct.unpack_from("<8H", record, 32))
                != (1, 0, 1, 1, 1, 1, 0, 0)
                or struct.unpack_from("<I", record, 48)[0] != 0x42FE0000
                or struct.unpack_from("<I", record, 52)[0] != 0x3F800000
                or any(record[56:])
            ):
                fail("reconstructed-trace-quantization")
            expected = (
                "tinyrustlm.weight-q8-row-symmetric-f32-scale/1",
                "tinyrustlm.quantize-q8-row-symmetric-f32/1",
                "tinyrustlm.matmul-q8-row-f32-scalar/1",
                "tinyrustlm.decoder-matrix-q8-normalization-bias-f32-roles/1",
            )
            ids = struct.unpack_from("<4I", record, 4)
            if (
                any(index >= len(strings) for index in ids)
                or tuple(strings[index] for index in ids) != expected
            ):
                fail("reconstructed-trace-quantization")
        finally:
            record.release()

    def _parse(self) -> None:
        if self.size < HEADER_BYTES or self.mapping[:8] != MAGIC or self.mapping[8:24] != FORMAT_ID:
            fail("reconstructed-trace-model-header")
        header_size, major, minor, byte_order, artifact_class, flags = self._unpack(
            "<IHHIHH", 24, "reconstructed-trace-model-header"
        )
        file_size = self._unpack("<Q", 40, "reconstructed-trace-model-header")[0]
        manifest_offset, manifest_length, strings_offset, strings_length = self._unpack(
            "<QQQQ", 48, "reconstructed-trace-model-header"
        )
        quant_offset = self._unpack("<Q", 80, "reconstructed-trace-model-header")[0]
        quant_count, quant_record_bytes = self._unpack("<II", 88, "reconstructed-trace-model-header")
        tensor_offset = self._unpack("<Q", 96, "reconstructed-trace-model-header")[0]
        tensor_count, tensor_record_bytes = self._unpack("<II", 104, "reconstructed-trace-model-header")
        payload_offset, payload_length = self._unpack("<QQ", 144, "reconstructed-trace-model-header")
        if (
            header_size != HEADER_BYTES
            or (major, minor) != (2, 0)
            or byte_order != 0x01020304
            or artifact_class != 1
            or flags != 0
            or file_size != self.size
            or quant_count != 1
            or quant_record_bytes != QUANT_RECORD_BYTES
            or tensor_count != len(required_tensors())
            or tensor_record_bytes != TENSOR_RECORD_BYTES
            or manifest_length <= 0
            or manifest_length > 4 * 1024 * 1024
            or strings_length <= 0
            or strings_length > 16 * 1024 * 1024
            or manifest_offset != align_up(HEADER_BYTES)
            or strings_offset != align_up(manifest_offset + manifest_length)
            or quant_offset != align_up(strings_offset + strings_length)
            or tensor_offset != align_up(quant_offset + QUANT_RECORD_BYTES)
            or payload_offset != align_up(tensor_offset + tensor_count * TENSOR_RECORD_BYTES)
            or payload_length <= 0
            or payload_offset + payload_length != self.size
            or any(self.mapping[112:144])
            or any(self.mapping[160:224])
        ):
            fail("reconstructed-trace-model-header")
        self.artifact_class = artifact_class
        self._zero(HEADER_BYTES, manifest_offset)
        self._zero(manifest_offset + manifest_length, strings_offset)
        self._zero(strings_offset + strings_length, quant_offset)
        self._zero(quant_offset + QUANT_RECORD_BYTES, tensor_offset)
        self._zero(tensor_offset + tensor_count * TENSOR_RECORD_BYTES, payload_offset)
        strings = self._strings(strings_offset, strings_length)
        self._validate_quant_record(quant_offset, strings)
        tensors = [
            self._tensor(tensor_offset + index * TENSOR_RECORD_BYTES, strings, payload_offset)
            for index in range(tensor_count)
        ]
        expected = required_tensors()
        cursor = payload_offset
        for tensor, expected_tensor in zip(tensors, expected, strict=True):
            if (
                tensor.semantic_role != expected_tensor["role"]
                or tensor.canonical_name != expected_tensor["name"]
                or tensor.layer != expected_tensor["layer"]
                or tensor.shape != expected_tensor["shape"]
            ):
                fail("reconstructed-trace-tensor-registry")
            self._validate_encoding(tensor)
            expected_offset = align_up(cursor, tensor.payload_alignment)
            if tensor.payload_offset != expected_offset:
                fail("reconstructed-trace-payload-layout")
            self._zero(cursor, tensor.payload_offset)
            self._range(tensor.payload_offset, tensor.payload_length, "reconstructed-trace-payload-layout")
            self._validate_payload(tensor)
            cursor = tensor.payload_offset + tensor.payload_length
            key = (tensor.semantic_role, tensor.layer)
            if key in self.by_role_layer:
                fail("reconstructed-trace-tensor-registry")
            self.by_role_layer[key] = tensor
        if cursor != self.size:
            fail("reconstructed-trace-model-trailing")
        self.tensors = tensors

    def tensor(self, role: str, layer: int = -1) -> TensorRecord:
        try:
            return self.by_role_layer[(role, layer)]
        except KeyError:
            fail("reconstructed-trace-tensor-missing")

    def f32_vector(self, role: str, layer: int = -1) -> Any:
        tensor = self.tensor(role, layer)
        if tensor.element_type != 1 or len(tensor.shape) != 1:
            fail("reconstructed-trace-tensor-shape")
        return self.np.ndarray(
            tensor.shape, dtype="<f4", buffer=self.mapping, offset=tensor.payload_offset
        )

    def q8_row(self, role: str, row: int, layer: int = -1) -> Any:
        tensor = self.tensor(role, layer)
        rows, columns = tensor.shape
        if tensor.element_type != 2 or row < 0 or row >= rows:
            fail("reconstructed-trace-tensor-shape")
        offset = tensor.payload_offset + row * (columns + 4)
        scale = struct.unpack_from("<f", self.mapping, offset)[0]
        codes = self.np.ndarray(
            (columns,), dtype=self.np.int8, buffer=self.mapping, offset=offset + 4
        )
        return self.np.multiply(codes.astype(self.np.float32), self.np.float32(scale), dtype=self.np.float32)

    def q8_matvec(self, role: str, vector: Any, chunk_rows: int, layer: int = -1) -> Any:
        np = self.np
        tensor = self.tensor(role, layer)
        rows, columns = tensor.shape
        source = np.asarray(vector, dtype=np.float32)
        if tensor.element_type != 2 or source.shape != (columns,):
            fail("reconstructed-trace-tensor-shape")
        output = np.empty((rows,), dtype=np.float32)
        row_bytes = columns + 4
        for start in range(0, rows, chunk_rows):
            count = min(chunk_rows, rows - start)
            offset = tensor.payload_offset + start * row_bytes
            scales = np.ndarray(
                (count,), dtype="<f4", buffer=self.mapping, offset=offset,
                strides=(row_bytes,),
            ).astype(np.float32, copy=True)
            codes = np.ndarray(
                (count, columns), dtype=np.int8, buffer=self.mapping,
                offset=offset + 4, strides=(row_bytes, 1),
            )
            weights = codes.astype(np.float32)
            np.multiply(weights, scales[:, None], out=weights)
            output[start : start + count] = np.matmul(weights, source).astype(np.float32, copy=False)
        if not bool(np.isfinite(output).all()):
            fail("reconstructed-trace-nonfinite")
        return output


class ReconstructedEngine:
    def __init__(self, model: Slm2Model, chunk_rows: int) -> None:
        self.model = model
        self.np = model.np
        self.chunk_rows = chunk_rows
        self.key_cache: list[list[Any]] = [[] for _ in range(MODEL_SPEC["layerCount"])]
        self.value_cache: list[list[Any]] = [[] for _ in range(MODEL_SPEC["layerCount"])]

    def reset(self) -> None:
        self.key_cache = [[] for _ in range(MODEL_SPEC["layerCount"])]
        self.value_cache = [[] for _ in range(MODEL_SPEC["layerCount"])]

    def rms_norm(self, value: Any, weight: Any) -> Any:
        np = self.np
        source = np.asarray(value, dtype=np.float32)
        squares = np.multiply(source, source, dtype=np.float32)
        total = np.sum(squares, dtype=np.float32)
        mean = np.float32(total / np.float32(source.size))
        scale = np.float32(1.0) / np.sqrt(
            np.float32(mean + np.float32(MODEL_SPEC["normalizationEpsilon"])),
            dtype=np.float32,
        )
        output = np.multiply(source, scale, dtype=np.float32)
        output = np.multiply(output, np.asarray(weight, dtype=np.float32), dtype=np.float32)
        if not bool(np.isfinite(output).all()):
            fail("reconstructed-trace-nonfinite")
        return output

    def head_norm(self, value: Any, weight: Any, heads: int) -> Any:
        np = self.np
        shaped = np.asarray(value, dtype=np.float32).reshape(heads, MODEL_SPEC["headDimension"])
        output = np.empty_like(shaped)
        for head in range(heads):
            output[head] = self.rms_norm(shaped[head], weight)
        return output.reshape(-1)

    def rope(self, value: Any, heads: int, position: int) -> Any:
        np = self.np
        dimension = MODEL_SPEC["headDimension"]
        half = dimension // 2
        shaped = np.asarray(value, dtype=np.float32).reshape(heads, dimension).copy()
        for index in range(half):
            exponent = np.float32(2 * index) / np.float32(dimension)
            denominator = np.float32(
                np.power(np.float32(MODEL_SPEC["ropeTheta"]), exponent)
            )
            angle = np.float32(position) / denominator
            sine = np.float32(np.sin(angle))
            cosine = np.float32(np.cos(angle))
            first = shaped[:, index].copy()
            second = shaped[:, index + half].copy()
            shaped[:, index] = np.subtract(
                np.multiply(first, cosine, dtype=np.float32),
                np.multiply(second, sine, dtype=np.float32),
                dtype=np.float32,
            )
            shaped[:, index + half] = np.add(
                np.multiply(second, cosine, dtype=np.float32),
                np.multiply(first, sine, dtype=np.float32),
                dtype=np.float32,
            )
        if not bool(np.isfinite(shaped).all()):
            fail("reconstructed-trace-nonfinite")
        return shaped.reshape(-1)

    def attention(self, query: Any, layer: int) -> Any:
        np = self.np
        heads = MODEL_SPEC["headCount"]
        kv_heads = MODEL_SPEC["kvHeadCount"]
        dimension = MODEL_SPEC["headDimension"]
        group = heads // kv_heads
        queries = np.asarray(query, dtype=np.float32).reshape(heads, dimension)
        keys = np.stack(self.key_cache[layer], axis=0)
        values = np.stack(self.value_cache[layer], axis=0)
        output = np.zeros((heads, dimension), dtype=np.float32)
        scale = np.float32(1.0 / math.sqrt(dimension))
        for query_head in range(heads):
            kv_head = query_head // group
            products = np.multiply(keys[:, kv_head, :], queries[query_head][None, :], dtype=np.float32)
            scores = np.sum(products, axis=1, dtype=np.float32)
            scores = np.multiply(scores, scale, dtype=np.float32)
            maximum = np.max(scores)
            exponentials = np.exp(np.subtract(scores, maximum, dtype=np.float32), dtype=np.float32)
            denominator = np.sum(exponentials, dtype=np.float32)
            probabilities = np.divide(exponentials, denominator, dtype=np.float32)
            weighted = np.multiply(values[:, kv_head, :], probabilities[:, None], dtype=np.float32)
            output[query_head] = np.sum(weighted, axis=0, dtype=np.float32)
        if not bool(np.isfinite(output).all()):
            fail("reconstructed-trace-nonfinite")
        return output.reshape(-1)

    def silu(self, value: Any) -> Any:
        """Evaluate x * sigmoid(x) without a positive exponential for finite float32 x."""
        np = self.np
        decay = np.exp(np.negative(np.abs(value)), dtype=np.float32)
        denominator = np.add(np.float32(1.0), decay, dtype=np.float32)
        sigmoid = np.where(
            value >= np.float32(0.0),
            np.divide(np.float32(1.0), denominator, dtype=np.float32),
            np.divide(decay, denominator, dtype=np.float32),
        )
        return np.multiply(value, sigmoid, dtype=np.float32)

    def forward_token(self, token_id: int, position: int) -> tuple[list[tuple[str, int | None, Any]], int]:
        np = self.np
        hidden = self.model.q8_row("model.token-embedding.weight", token_id)
        records: list[tuple[str, int | None, Any]] = [("token-embedding", None, hidden.copy())]
        for layer in range(MODEL_SPEC["layerCount"]):
            normalized = self.rms_norm(
                hidden, self.model.f32_vector("layer.attention-normalization.weight", layer)
            )
            records.append(("attention-normalized", layer, normalized.copy()))
            query = self.model.q8_matvec(
                "layer.attention.query-projection.weight", normalized, self.chunk_rows, layer
            )
            key = self.model.q8_matvec(
                "layer.attention.key-projection.weight", normalized, self.chunk_rows, layer
            )
            value = self.model.q8_matvec(
                "layer.attention.value-projection.weight", normalized, self.chunk_rows, layer
            )
            query = self.head_norm(
                query,
                self.model.f32_vector("layer.attention.query-normalization.weight", layer),
                MODEL_SPEC["headCount"],
            )
            key = self.head_norm(
                key,
                self.model.f32_vector("layer.attention.key-normalization.weight", layer),
                MODEL_SPEC["kvHeadCount"],
            )
            query = self.rope(query, MODEL_SPEC["headCount"], position)
            key = self.rope(key, MODEL_SPEC["kvHeadCount"], position)
            records.extend(
                (
                    ("query-after-rope", layer, query.copy()),
                    ("key-after-rope", layer, key.copy()),
                    ("value", layer, value.copy()),
                )
            )
            self.key_cache[layer].append(key.reshape(MODEL_SPEC["kvHeadCount"], MODEL_SPEC["headDimension"]).copy())
            self.value_cache[layer].append(value.reshape(MODEL_SPEC["kvHeadCount"], MODEL_SPEC["headDimension"]).copy())
            attention = self.attention(query, layer)
            records.append(("attention", layer, attention.copy()))
            projected = self.model.q8_matvec(
                "layer.attention.output-projection.weight", attention, self.chunk_rows, layer
            )
            hidden = np.add(hidden, projected, dtype=np.float32)
            records.append(("post-attention-residual", layer, hidden.copy()))
            feed_normalized = self.rms_norm(
                hidden, self.model.f32_vector("layer.feed-forward-normalization.weight", layer)
            )
            records.append(("feed-forward-normalized", layer, feed_normalized.copy()))
            gate = self.model.q8_matvec(
                "layer.feed-forward.gate-projection.weight", feed_normalized, self.chunk_rows, layer
            )
            up = self.model.q8_matvec(
                "layer.feed-forward.up-projection.weight", feed_normalized, self.chunk_rows, layer
            )
            activated = np.multiply(self.silu(gate), up, dtype=np.float32)
            if not bool(np.isfinite(activated).all()):
                fail("reconstructed-trace-nonfinite")
            records.append(("feed-forward-activated", layer, activated.copy()))
            down = self.model.q8_matvec(
                "layer.feed-forward.down-projection.weight", activated, self.chunk_rows, layer
            )
            hidden = np.add(hidden, down, dtype=np.float32)
            records.append(("post-feed-forward-residual", layer, hidden.copy()))
        final = self.rms_norm(hidden, self.model.f32_vector("model.final-normalization.weight"))
        records.append(("final-normalized", None, final.copy()))
        logits = self.model.q8_matvec(
            "model.token-embedding.weight", final, self.chunk_rows
        )
        records.append(("logits", None, logits.copy()))
        expected = expected_stage_keys(MODEL_SPEC["layerCount"])
        if [(stage, layer) for stage, layer, _value in records] != expected:
            fail("reconstructed-trace-stage-closure")
        return records, int(np.argmax(logits))


def validate_request(request_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    request, request_bytes = read_strict_json(
        request_path, MAXIMUM_REQUEST_BYTES, "reconstructed-trace-request-invalid"
    )
    if request_bytes != canonical_json_bytes(request):
        fail("reconstructed-trace-request-canonical")
    exact_object(
        request,
        {
            "schema",
            "operationId",
            "differentialProfileSha256",
            "registrationSha256",
            "compositionResultSha256",
            "compositionRoot",
            "model",
            "evidenceParent",
            "outputRoot",
            "traceProfileId",
            "implementation",
            "modelSpec",
            "policy",
            "cases",
        },
        "reconstructed-trace-request-shape",
    )
    if (
        request["schema"] != REQUEST_SCHEMA
        or not valid_identifier(request["operationId"])
        or not valid_sha256(request["differentialProfileSha256"])
        or not valid_sha256(request["registrationSha256"])
        or request["compositionResultSha256"] != COMPOSITION_RESULT_SHA256
        or request["traceProfileId"] != TRACE_PROFILE_ID
        or request["modelSpec"] != MODEL_SPEC
    ):
        fail("reconstructed-trace-request-identity")
    model = exact_object(request["model"], {"fileName", "byteLength", "sha256"}, "reconstructed-trace-model")
    if (
        model["fileName"] != "model.slm2"
        or not isinstance(model["byteLength"], int)
        or model["byteLength"] != MODEL_BYTE_LENGTH
        or model["sha256"] != MODEL_SHA256
    ):
        fail("reconstructed-trace-model")
    implementation = exact_object(
        request["implementation"],
        {
            "environmentAuthority",
            "environmentLock",
            "pythonVersion",
            "numpyVersion",
            "matrixChunkRows",
            "blasThreads",
            "networkAllowed",
        },
        "reconstructed-trace-implementation",
    )
    environment_authority = exact_object(
        implementation["environmentAuthority"],
        {"relativePath", "byteLength", "sha256"},
        "reconstructed-trace-environment-authority",
    )
    environment_lock = exact_object(
        implementation["environmentLock"],
        {"relativePath", "byteLength", "sha256"},
        "reconstructed-trace-environment-lock",
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
        or implementation["pythonVersion"] != "3.12.10"
        or implementation["numpyVersion"] != "2.2.5"
        or not isinstance(implementation["matrixChunkRows"], int)
        or not 1 <= implementation["matrixChunkRows"] <= 4096
        or implementation["blasThreads"] != 1
        or implementation["networkAllowed"] is not False
    ):
        fail("reconstructed-trace-implementation")
    policy = exact_object(
        request["policy"],
        {"maximumModelBytes", "maximumCases", "maximumTokensPerCase", "maximumTraceBytes", "maximumResultBytes"},
        "reconstructed-trace-policy",
    )
    if (
        any(not isinstance(value, int) or isinstance(value, bool) or value <= 0 for value in policy.values())
        or model["byteLength"] > policy["maximumModelBytes"]
        or policy["maximumCases"] > MAXIMUM_CASES
        or policy["maximumTokensPerCase"] > MAXIMUM_TOKENS_PER_CASE
        or policy["maximumTraceBytes"] > 64 * 1024 * 1024 * 1024
        or policy["maximumResultBytes"] > MAXIMUM_JSON_BYTES
    ):
        fail("reconstructed-trace-policy")
    cases = request["cases"]
    if not isinstance(cases, list) or not 1 <= len(cases) <= policy["maximumCases"]:
        fail("reconstructed-trace-cases")
    seen: set[str] = set()
    for case in cases:
        exact_object(case, {"id", "tokenIds"}, "reconstructed-trace-case")
        tokens = case["tokenIds"]
        if (
            not valid_identifier(case["id"], 96)
            or case["id"] in seen
            or not isinstance(tokens, list)
            or not 1 <= len(tokens) <= policy["maximumTokensPerCase"]
            or any(not isinstance(token, int) or isinstance(token, bool) or token < 0 or token >= MODEL_SPEC["vocabularySize"] for token in tokens)
        ):
            fail("reconstructed-trace-case")
        seen.add(case["id"])
    composition_root = direct_directory(
        ascii_absolute_path(request["compositionRoot"], "reconstructed-trace-composition-root"),
        "reconstructed-trace-composition-root",
    )
    model_path = composition_root / model["fileName"]
    if model_path.parent.resolve() != composition_root:
        fail("reconstructed-trace-model-path")
    evidence_parent = direct_directory(
        ascii_absolute_path(request["evidenceParent"], "reconstructed-trace-evidence-parent"),
        "reconstructed-trace-evidence-parent",
    )
    output_root = ascii_absolute_path(request["outputRoot"], "reconstructed-trace-output-root")
    if (
        output_root.name != f"{request['operationId']}-reconstructed"
        or output_root.parent.resolve() != evidence_parent
        or output_root.exists()
        or output_root.is_symlink()
    ):
        fail("reconstructed-trace-output-root")
    size, digest = digest_file(model_path, policy["maximumModelBytes"], "reconstructed-trace-model-read")
    if size != model["byteLength"] or digest != model["sha256"]:
        fail("reconstructed-trace-model-drift")
    return request, {
        "request": {"byteLength": len(request_bytes), "sha256": hashlib.sha256(request_bytes).hexdigest()},
        "modelPath": model_path,
        "outputRoot": output_root,
    }


def write_trace(path: Path, records: list[tuple[str, int | None, Any]], maximum: int) -> dict[str, Any]:
    digest = hashlib.sha256()
    stages: list[dict[str, Any]] = []
    offset = 0
    try:
        with path.open("xb") as output:
            for stage, layer, values in records:
                data = values.astype("<f4", copy=False).tobytes(order="C")
                if not data or offset + len(data) > maximum:
                    fail("reconstructed-trace-budget")
                output.write(data)
                digest.update(data)
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
        fail("reconstructed-trace-write")
    return {"traceByteLength": offset, "traceSha256": digest.hexdigest(), "stages": stages}


def execute(request_path: Path) -> dict[str, Any]:
    request, state = validate_request(request_path)
    environment_before = verify_environment(request["implementation"])
    for variable in (
        "OMP_NUM_THREADS",
        "MKL_NUM_THREADS",
        "OPENBLAS_NUM_THREADS",
        "NUMEXPR_NUM_THREADS",
        "VECLIB_MAXIMUM_THREADS",
    ):
        os.environ[variable] = "1"
    sys.addaudithook(audit_hook)
    try:
        import numpy as np  # pylint: disable=import-outside-toplevel
    except Exception:
        fail("reconstructed-trace-environment")
    if (
        importlib.metadata.version("numpy") != request["implementation"]["numpyVersion"]
        or f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}" != request["implementation"]["pythonVersion"]
    ):
        fail("reconstructed-trace-environment")
    model = Slm2Model(
        state["modelPath"], request["model"]["sha256"],
        request["policy"]["maximumModelBytes"], np,
    )
    output_root = state["outputRoot"]
    try:
        output_root.mkdir()
    except OSError:
        model.close()
        fail("reconstructed-trace-output-create")
    cases_output: list[dict[str, Any]] = []
    trace_bytes = 0
    trace_files = 0
    engine = None
    try:
        engine = ReconstructedEngine(model, request["implementation"]["matrixChunkRows"])
        for case_index, case in enumerate(request["cases"]):
            engine.reset()
            steps: list[dict[str, Any]] = []
            for step_index, token_id in enumerate(case["tokenIds"]):
                records, greedy = engine.forward_token(token_id, step_index)
                remaining = request["policy"]["maximumTraceBytes"] - trace_bytes
                if remaining <= 0:
                    fail("reconstructed-trace-budget")
                trace_file = f"case-{case_index:03d}-step-{step_index:03d}.f32le"
                trace_result = write_trace(output_root / trace_file, records, remaining)
                trace_bytes += trace_result["traceByteLength"]
                trace_files += 1
                kv_bytes = (
                    MODEL_SPEC["layerCount"]
                    * (step_index + 1)
                    * MODEL_SPEC["kvHeadCount"]
                    * MODEL_SPEC["headDimension"]
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
        if engine is not None:
            del engine
        model.close()
    size_after, digest_after = digest_file(
        state["modelPath"], request["policy"]["maximumModelBytes"],
        "reconstructed-trace-model-read",
    )
    if size_after != request["model"]["byteLength"] or digest_after != request["model"]["sha256"]:
        fail("reconstructed-trace-model-drift")
    environment_after = verify_environment(request["implementation"])
    if environment_after != environment_before:
        fail("reconstructed-trace-environment-drift")
    result = {
        "schema": RESULT_SCHEMA,
        "operationId": request["operationId"],
        "status": "completed",
        "claim": "private-reconstructed-slm2-traces-created-not-numerical-parity",
        "implementation": {
            "kind": "slm2-reconstructed-weight-diagnostic",
            "profileId": IMPLEMENTATION_ID,
            "pythonVersion": request["implementation"]["pythonVersion"],
            "packages": {"numpy": request["implementation"]["numpyVersion"]},
            "matrixChunkRows": request["implementation"]["matrixChunkRows"],
            "wholeModelF32Shadow": False,
            "environment": environment_before,
        },
        "request": state["request"],
        "differentialProfileSha256": request["differentialProfileSha256"],
        "registrationSha256": request["registrationSha256"],
        "traceProfileId": TRACE_PROFILE_ID,
        "source": {
            "compositionResultSha256": request["compositionResultSha256"],
            "model": request["model"],
        },
        "modelSpec": MODEL_SPEC,
        "caseCount": len(cases_output),
        "traceFileCount": trace_files,
        "traceByteLength": trace_bytes,
        "cases": cases_output,
        "durability": {"traceFilesSynced": True, "resultFileSynced": True, "directorySyncClaimed": False},
        "requiredNextGate": "independent-source-reconstructed-scalar-trace-verification",
    }
    result_bytes = canonical_json_bytes(result)
    if len(result_bytes) > request["policy"]["maximumResultBytes"]:
        fail("reconstructed-trace-result-limit")
    try:
        with (output_root / "probe.json").open("xb") as output:
            output.write(result_bytes)
            output.flush()
            os.fsync(output.fileno())
    except OSError:
        fail("reconstructed-trace-result-write")
    return result


def self_test() -> None:
    tensors = required_tensors()
    if len(tensors) != 310 or len(expected_stage_keys(28)) != 255:
        fail("reconstructed-trace-self-test")
    if tensors[0]["role"].encode("ascii") > tensors[-1]["role"].encode("ascii"):
        fail("reconstructed-trace-self-test")
    if token_digest([1, 2]) != hashlib.sha256(b"\x01\0\0\0\x02\0\0\0").hexdigest():
        fail("reconstructed-trace-self-test")


def numpy_self_test() -> None:
    for variable in (
        "OMP_NUM_THREADS",
        "MKL_NUM_THREADS",
        "OPENBLAS_NUM_THREADS",
        "NUMEXPR_NUM_THREADS",
        "VECLIB_MAXIMUM_THREADS",
    ):
        os.environ[variable] = "1"
    if (
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}" != "3.12.10"
        or importlib.metadata.version("numpy") != "2.2.5"
    ):
        fail("reconstructed-trace-numpy-self-test-environment")
    sys.addaudithook(audit_hook)
    try:
        import numpy as np  # pylint: disable=import-outside-toplevel
    except Exception:
        fail("reconstructed-trace-numpy-self-test-environment")
    engine = ReconstructedEngine.__new__(ReconstructedEngine)
    engine.np = np
    engine.model = None
    engine.chunk_rows = 4
    engine.key_cache = [[] for _ in range(MODEL_SPEC["layerCount"])]
    engine.value_cache = [[] for _ in range(MODEL_SPEC["layerCount"])]
    activation_input = np.asarray([
        -np.finfo(np.float32).max, -1000.0, -100.0, -90.0, -20.0, -2.0,
        -0.0, 0.0, 2.0, 20.0, 90.0, 100.0, 1000.0, np.finfo(np.float32).max,
    ], dtype=np.float32)
    # Overflow and invalid arithmetic must fail; do not silence the production warning gate.
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        activated = engine.silu(activation_input)
    expected = np.asarray([
        float(value) / (1.0 + math.exp(-float(value))) if value >= 0.0
        else float(value) * math.exp(float(value)) / (1.0 + math.exp(float(value)))
        for value in activation_input
    ], dtype=np.float32)
    if (activated.dtype != np.float32 or not bool(np.isfinite(activated).all())
            or not np.allclose(activated, expected, rtol=0.000001, atol=0.0000001)
            or not bool(np.signbit(activated[6])) or bool(np.signbit(activated[7]))):
        fail("reconstructed-trace-numpy-self-test-silu")
    value = np.asarray([1.0, -2.0, 3.0, -4.0], dtype=np.float32)
    normalized = engine.rms_norm(value, np.ones(4, dtype=np.float32))
    expected_scale = np.float32(1.0) / np.sqrt(
        np.float32(np.mean(np.multiply(value, value), dtype=np.float32)
                   + np.float32(MODEL_SPEC["normalizationEpsilon"])),
        dtype=np.float32,
    )
    if not np.array_equal(normalized, np.multiply(value, expected_scale, dtype=np.float32)):
        fail("reconstructed-trace-numpy-self-test-rmsnorm")
    rope_input = np.arange(MODEL_SPEC["headDimension"], dtype=np.float32)
    if not np.array_equal(engine.rope(rope_input, 1, 0), rope_input):
        fail("reconstructed-trace-numpy-self-test-rope")
    keys = np.zeros(
        (MODEL_SPEC["kvHeadCount"], MODEL_SPEC["headDimension"]), dtype=np.float32
    )
    values = np.stack([
        np.full(MODEL_SPEC["headDimension"], index + 1, dtype=np.float32)
        for index in range(MODEL_SPEC["kvHeadCount"])
    ])
    engine.key_cache[0].append(keys)
    engine.value_cache[0].append(values)
    attended = engine.attention(
        np.zeros(MODEL_SPEC["headCount"] * MODEL_SPEC["headDimension"], dtype=np.float32),
        0,
    ).reshape(MODEL_SPEC["headCount"], MODEL_SPEC["headDimension"])
    group = MODEL_SPEC["headCount"] // MODEL_SPEC["kvHeadCount"]
    for head in range(MODEL_SPEC["headCount"]):
        if not np.array_equal(
            attended[head], np.full(MODEL_SPEC["headDimension"], head // group + 1, dtype=np.float32)
        ):
            fail("reconstructed-trace-numpy-self-test-gqa")


def main(arguments: list[str]) -> None:
    if arguments == ["--self-test"]:
        self_test()
        print(json.dumps({"status": "pass", "claim": "reconstructed-owner-stdlib-self-test-only"}))
        return
    if arguments == ["--numpy-self-test"]:
        numpy_self_test()
        print(json.dumps({"status": "pass", "claim": "synthetic-numpy-kernel-test-only"}))
        return
    if len(arguments) != 1:
        fail("reconstructed-trace-arguments")
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
    except ReconstructedOwnerFailure as error:
        print(f"qwen3-reconstructed-trace-error:{error}", file=sys.stderr)
        raise SystemExit(1) from None
