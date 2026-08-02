"""Export a receipt-bound PEFT LoRA into TinyRustLM adapter-source v2."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import struct
import tempfile
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Any


MAX_JSON_BYTES = 16 * 1024 * 1024
MAX_SAFETENSORS_BYTES = 1024 * 1024 * 1024
MAX_FACTOR_RANK = 8
MAX_ABS_FACTOR = 64.0
MAX_ABS_RECONSTRUCTED_DELTA = 128.0
MASK_64 = (1 << 64) - 1
SOURCE_LAYOUT = "low-rank-f32-factor-files-v1"
SOURCE_FORMAT = "trained-low-rank-factors-v1"
RECEIPT_SCHEMA = "tinyrustlm.distillation_training_receipt.v1"
LORA_KEY = re.compile(
    r"(?:^|\.)layers\.(?P<layer>[0-9]+)\."
    r"(?P<section>self_attn|mlp)\."
    r"(?P<module>q_proj|k_proj|v_proj|o_proj|gate_proj|down_proj|up_proj)\."
    r"lora_(?P<side>A|B)(?:\.[A-Za-z0-9_-]+)?\.weight$"
)
MODULE_ORDER = (
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "down_proj",
    "up_proj",
)
MODULE_TARGETS = {
    ("self_attn", "q_proj"): "wq",
    ("self_attn", "k_proj"): "wk",
    ("self_attn", "v_proj"): "wv",
    ("self_attn", "o_proj"): "wo",
    ("mlp", "gate_proj"): "w1",
    ("mlp", "down_proj"): "w2",
    ("mlp", "up_proj"): "w3",
}


@dataclass(frozen=True)
class ModelShape:
    name: str
    vocab_size: int
    special_token_count: int
    hidden_size: int
    layer_count: int
    head_count: int
    kv_head_count: int
    head_dim: int
    ffn_size: int
    max_context: int
    rope_theta: float
    rms_norm_epsilon: float


MODEL_SHAPES = {
    "smollm2-135m-instruct-bpe": ModelShape(
        "smollm2-135m-instruct-bpe",
        49_152,
        17,
        576,
        30,
        9,
        3,
        64,
        1_536,
        8_192,
        100_000.0,
        1e-5,
    ),
    "smollm2-360m-instruct-bpe": ModelShape(
        "smollm2-360m-instruct-bpe",
        49_152,
        17,
        960,
        32,
        15,
        5,
        64,
        2_560,
        8_192,
        100_000.0,
        1e-5,
    ),
}


@dataclass(frozen=True)
class TensorPayload:
    name: str
    dtype: str
    shape: tuple[int, ...]
    payload: bytes


@dataclass(frozen=True)
class ExportTarget:
    name: str
    rows: int
    cols: int
    rank: int
    a_bytes: bytes
    b_bytes: bytes
    delta_l1_upper_bound_microunits: int


@dataclass(frozen=True)
class ExportPlan:
    shape: ModelShape
    receipt: dict[str, Any]
    receipt_path: Path
    adapter_model_sha256: str
    adapter_config_sha256: str
    scaling_label: str
    targets: tuple[ExportTarget, ...]


def sha256_bytes(payload: bytes) -> str:
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def read_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size <= 0 or size > maximum:
        raise ValueError(f"{label} byte length must be in 1..={maximum}: {path}")
    return path.read_bytes()


def read_json_object(path: Path, maximum: int, label: str) -> dict[str, Any]:
    payload = read_regular_bytes(path, maximum, label)
    try:
        value = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} must be valid UTF-8 JSON: {path}") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value


def require_string(fields: dict[str, Any], key: str) -> str:
    value = fields.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} must be a non-empty string")
    return value


def require_int(fields: dict[str, Any], key: str) -> int:
    value = fields.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{key} must be an integer")
    return value


def parse_safetensors(path: Path) -> dict[str, TensorPayload]:
    payload = read_regular_bytes(path, MAX_SAFETENSORS_BYTES, "PEFT adapter safetensors")
    if len(payload) < 10:
        raise ValueError("PEFT adapter safetensors is too short")
    header_length = struct.unpack_from("<Q", payload, 0)[0]
    if header_length <= 1 or header_length > MAX_JSON_BYTES:
        raise ValueError("PEFT adapter safetensors header length is invalid")
    data_start = 8 + header_length
    if data_start > len(payload):
        raise ValueError("PEFT adapter safetensors header escapes the file")
    try:
        header = json.loads(payload[8:data_start])
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("PEFT adapter safetensors header is invalid JSON") from error
    if not isinstance(header, dict):
        raise ValueError("PEFT adapter safetensors header must be an object")

    tensors: dict[str, TensorPayload] = {}
    ranges: list[tuple[int, int, str]] = []
    data_length = len(payload) - data_start
    for name, metadata in header.items():
        if name == "__metadata__":
            if not isinstance(metadata, dict):
                raise ValueError("safetensors __metadata__ must be an object")
            continue
        if not isinstance(name, str) or not name or not isinstance(metadata, dict):
            raise ValueError("safetensors tensor metadata is malformed")
        dtype = metadata.get("dtype")
        shape = metadata.get("shape")
        offsets = metadata.get("data_offsets")
        if dtype not in {"F32", "F16", "BF16"}:
            raise ValueError(f"unsupported PEFT tensor dtype {dtype!r} for {name}")
        if (
            not isinstance(shape, list)
            or not shape
            or any(isinstance(dim, bool) or not isinstance(dim, int) or dim <= 0 for dim in shape)
        ):
            raise ValueError(f"invalid PEFT tensor shape for {name}")
        if (
            not isinstance(offsets, list)
            or len(offsets) != 2
            or any(isinstance(item, bool) or not isinstance(item, int) for item in offsets)
        ):
            raise ValueError(f"invalid PEFT tensor offsets for {name}")
        start, end = offsets
        if start < 0 or end <= start or end > data_length:
            raise ValueError(f"PEFT tensor offsets escape the data section for {name}")
        element_count = math.prod(shape)
        item_size = {"F32": 4, "F16": 2, "BF16": 2}[dtype]
        if end - start != element_count * item_size:
            raise ValueError(f"PEFT tensor byte length does not match shape for {name}")
        ranges.append((start, end, name))
        tensors[name] = TensorPayload(
            name=name,
            dtype=dtype,
            shape=tuple(shape),
            payload=payload[data_start + start : data_start + end],
        )
    if not tensors:
        raise ValueError("PEFT adapter safetensors contains no tensors")
    previous_end = 0
    for start, end, name in sorted(ranges):
        if start != previous_end:
            raise ValueError(f"PEFT tensor data is overlapping or non-contiguous near {name}")
        previous_end = end
    if previous_end != data_length:
        raise ValueError("PEFT adapter safetensors has unclaimed trailing data")
    return tensors


def decode_floats(tensor: TensorPayload) -> list[float]:
    if tensor.dtype == "F32":
        values = array("f")
        values.frombytes(tensor.payload)
        if struct.pack("=I", 1) != struct.pack("<I", 1):
            values.byteswap()
        decoded = values.tolist()
    elif tensor.dtype == "F16":
        decoded = [value[0] for value in struct.iter_unpack("<e", tensor.payload)]
    else:
        decoded = []
        for (bits,) in struct.iter_unpack("<H", tensor.payload):
            decoded.append(struct.unpack("<f", struct.pack("<I", bits << 16))[0])
    if any(not math.isfinite(value) for value in decoded):
        raise ValueError(f"PEFT tensor contains a non-finite value: {tensor.name}")
    return decoded


def encode_f32(values: list[float], label: str) -> bytes:
    if not values or not any(value != 0.0 for value in values):
        raise ValueError(f"{label} must not be empty or entirely zero")
    if any(not math.isfinite(value) or abs(value) > MAX_ABS_FACTOR for value in values):
        raise ValueError(f"{label} contains a non-finite or out-of-range factor")
    encoded = array("f", values)
    if struct.pack("=I", 1) != struct.pack("<I", 1):
        encoded.byteswap()
    return encoded.tobytes()


def decode_encoded_f32(payload: bytes) -> list[float]:
    return [value[0] for value in struct.iter_unpack("<f", payload)]


def source_checksum(payload: bytes) -> int:
    accumulator = 0x6EED0E9DA4D94A4F
    for index, byte in enumerate(payload):
        accumulator ^= (byte + (index << 3)) & MASK_64
        accumulator = (
            ((accumulator << 11) | (accumulator >> (64 - 11)))
            * 0x100000001B3
        ) & MASK_64
    return accumulator


def name_hash(name: str) -> int:
    accumulator = 0xCBF29CE484222325
    for byte in name.encode("ascii"):
        accumulator ^= byte
        accumulator = (accumulator * 0x100000001B3) & MASK_64
    return accumulator


def delta_l1_upper_bound_microunits(
    a_values: list[float], b_values: list[float], rows: int, cols: int, rank: int
) -> int:
    l1_bound = 0.0
    max_abs_bound = 0.0
    for component in range(rank):
        a_component = [abs(a_values[row * rank + component]) for row in range(rows)]
        b_component = [abs(b_values[component * cols + col]) for col in range(cols)]
        a_l1 = 0.0
        b_l1 = 0.0
        for value in a_component:
            a_l1 += value
        for value in b_component:
            b_l1 += value
        l1_bound += a_l1 * b_l1
        max_abs_bound += max(a_component) * max(b_component)
    if not math.isfinite(l1_bound) or not math.isfinite(max_abs_bound):
        raise ValueError("LoRA reconstructed delta bound is not finite")
    if max_abs_bound > MAX_ABS_RECONSTRUCTED_DELTA:
        raise ValueError("LoRA reconstructed delta upper bound is out of range")
    scaled = math.ceil(l1_bound * 1_000_000.0)
    if scaled < 0 or scaled > (1 << 64) - 1:
        raise ValueError("LoRA delta L1 upper bound does not fit u64")
    return scaled


def expected_matrix_shape(shape: ModelShape, module: str) -> tuple[int, int]:
    kv_rows = shape.kv_head_count * shape.head_dim
    return {
        "q_proj": (shape.hidden_size, shape.hidden_size),
        "k_proj": (kv_rows, shape.hidden_size),
        "v_proj": (kv_rows, shape.hidden_size),
        "o_proj": (shape.hidden_size, shape.hidden_size),
        "gate_proj": (shape.ffn_size, shape.hidden_size),
        "down_proj": (shape.hidden_size, shape.ffn_size),
        "up_proj": (shape.ffn_size, shape.hidden_size),
    }[module]


def target_name(layer: int, section: str, module: str) -> str:
    suffix = MODULE_TARGETS.get((section, module))
    if suffix is None:
        raise ValueError(f"unsupported PEFT module path {section}.{module}")
    return f"layers.{layer}.{suffix}.weight"


def validate_base_config(base_model_dir: Path, shape: ModelShape) -> None:
    config = read_json_object(base_model_dir / "config.json", MAX_JSON_BYTES, "base config")
    expected_ints = {
        "vocab_size": shape.vocab_size,
        "hidden_size": shape.hidden_size,
        "num_hidden_layers": shape.layer_count,
        "num_attention_heads": shape.head_count,
        "num_key_value_heads": shape.kv_head_count,
        "intermediate_size": shape.ffn_size,
        "max_position_embeddings": shape.max_context,
    }
    for key, expected in expected_ints.items():
        if require_int(config, key) != expected:
            raise ValueError(f"base config {key} does not match {shape.name}")
    if config.get("model_type") != "llama":
        raise ValueError("base config model_type must be llama")
    if config.get("tie_word_embeddings") is not True:
        raise ValueError("base config must use tied word embeddings")
    if float(config.get("rope_theta", 0.0)) != shape.rope_theta:
        raise ValueError("base config rope_theta does not match the selected shape")
    if float(config.get("rms_norm_eps", 0.0)) != shape.rms_norm_epsilon:
        raise ValueError("base config rms_norm_eps does not match the selected shape")


def validate_receipt(
    receipt_path: Path, base_model_dir: Path, adapter_dir: Path
) -> tuple[dict[str, Any], str, str]:
    receipt = read_json_object(receipt_path, MAX_JSON_BYTES, "training receipt")
    if receipt.get("schema") != RECEIPT_SCHEMA:
        raise ValueError("training receipt schema is unsupported")
    if receipt.get("training_engine") != "transformers-peft-sequence-lora-v1":
        raise ValueError("training receipt does not name the approved training engine")
    if receipt.get("teacher_reasoning_policy") != "final-answer-only":
        raise ValueError("training receipt does not enforce final-answer-only targets")
    if receipt.get("eval_exclusion_policy") != "rust-frozen-manifest-bound":
        raise ValueError("training receipt does not bind the Rust eval exclusion policy")
    require_string(receipt, "dataset_id")
    require_string(receipt, "system_prompt_sha256")
    adapter_model = adapter_dir / "adapter_model.safetensors"
    adapter_config = adapter_dir / "adapter_config.json"
    adapter_model_sha256 = sha256_file(adapter_model)
    adapter_config_sha256 = sha256_file(adapter_config)
    checks = {
        "base_model_sha256": sha256_file(base_model_dir / "model.safetensors"),
        "base_tokenizer_sha256": sha256_file(base_model_dir / "tokenizer.json"),
        "adapter_model_sha256": adapter_model_sha256,
        "adapter_config_sha256": adapter_config_sha256,
    }
    for key, actual in checks.items():
        if receipt.get(key) != actual:
            raise ValueError(f"training receipt {key} does not match local bytes")
    return receipt, adapter_model_sha256, adapter_config_sha256


def validate_lora_config(config: dict[str, Any]) -> tuple[int, float, str, set[str]]:
    if config.get("peft_type") != "LORA" or config.get("task_type") != "CAUSAL_LM":
        raise ValueError("adapter config must be a causal-LM LoRA")
    rank = require_int(config, "r")
    if rank <= 0 or rank > MAX_FACTOR_RANK:
        raise ValueError(f"adapter LoRA rank must be in 1..={MAX_FACTOR_RANK}")
    alpha_value = config.get("lora_alpha")
    if isinstance(alpha_value, bool) or not isinstance(alpha_value, (int, float)):
        raise ValueError("adapter lora_alpha must be numeric")
    alpha = float(alpha_value)
    if not math.isfinite(alpha) or alpha <= 0.0:
        raise ValueError("adapter lora_alpha must be finite and positive")
    if config.get("bias", "none") != "none":
        raise ValueError("adapter config bias must be none")
    if config.get("fan_in_fan_out", False) is not False:
        raise ValueError("fan_in_fan_out LoRA is not supported")
    if config.get("use_dora", False) is not False:
        raise ValueError("DoRA adapters are not supported")
    for key in ("rank_pattern", "alpha_pattern"):
        if config.get(key) not in (None, {}):
            raise ValueError(f"adapter config {key} is not supported")
    if config.get("modules_to_save") not in (None, []):
        raise ValueError("adapter modules_to_save is not supported")
    if config.get("layers_to_transform") not in (None, []):
        raise ValueError("partial-layer LoRA configs are not supported")
    target_modules = config.get("target_modules")
    if not isinstance(target_modules, list) or not target_modules:
        raise ValueError("adapter target_modules must be a non-empty list")
    modules = set()
    for module in target_modules:
        if not isinstance(module, str) or module not in MODULE_ORDER:
            raise ValueError(f"unsupported adapter target module {module!r}")
        if module in modules:
            raise ValueError("adapter target_modules contains duplicates")
        modules.add(module)
    use_rslora = config.get("use_rslora", False)
    if not isinstance(use_rslora, bool):
        raise ValueError("adapter use_rslora must be a boolean")
    scaling = alpha / (math.sqrt(rank) if use_rslora else rank)
    label = "alpha-over-sqrt-rank" if use_rslora else "alpha-over-rank"
    return rank, scaling, label, modules


def build_export_plan(
    adapter_dir: Path,
    base_model_dir: Path,
    receipt_path: Path,
    model_shape: str,
) -> ExportPlan:
    adapter_dir = adapter_dir.resolve()
    base_model_dir = base_model_dir.resolve()
    receipt_path = receipt_path.resolve()
    if not adapter_dir.is_dir() or adapter_dir.is_symlink():
        raise ValueError(f"adapter_dir must be a non-symlink directory: {adapter_dir}")
    if not base_model_dir.is_dir() or base_model_dir.is_symlink():
        raise ValueError(f"base_model_dir must be a non-symlink directory: {base_model_dir}")
    try:
        shape = MODEL_SHAPES[model_shape]
    except KeyError as error:
        raise ValueError(f"unsupported TinyRustLM model shape {model_shape!r}") from error
    validate_base_config(base_model_dir, shape)
    receipt, adapter_model_sha256, adapter_config_sha256 = validate_receipt(
        receipt_path, base_model_dir, adapter_dir
    )
    adapter_config = read_json_object(
        adapter_dir / "adapter_config.json", MAX_JSON_BYTES, "PEFT adapter config"
    )
    rank, scaling, scaling_label, configured_modules = validate_lora_config(adapter_config)
    tensors = parse_safetensors(adapter_dir / "adapter_model.safetensors")
    pairs: dict[tuple[int, str], dict[str, TensorPayload]] = {}
    for tensor in tensors.values():
        match = LORA_KEY.search(tensor.name)
        if match is None:
            raise ValueError(f"unsupported tensor in PEFT adapter: {tensor.name}")
        layer = int(match.group("layer"))
        section = match.group("section")
        module = match.group("module")
        side = match.group("side")
        if layer >= shape.layer_count:
            raise ValueError(f"PEFT tensor layer is outside {shape.name}: {tensor.name}")
        target_name(layer, section, module)
        if module not in configured_modules:
            raise ValueError(f"PEFT tensor module is absent from target_modules: {tensor.name}")
        pair = pairs.setdefault((layer, module), {})
        if side in pair:
            raise ValueError(f"duplicate PEFT LoRA {side} tensor for layer {layer} {module}")
        pair[side] = tensor

    expected_keys = {
        (layer, module)
        for layer in range(shape.layer_count)
        for module in configured_modules
    }
    if set(pairs) != expected_keys:
        missing = sorted(expected_keys - set(pairs))
        extra = sorted(set(pairs) - expected_keys)
        raise ValueError(f"PEFT adapter layer/module coverage mismatch; missing={missing}; extra={extra}")

    targets: list[ExportTarget] = []
    for layer in range(shape.layer_count):
        for module in MODULE_ORDER:
            if module not in configured_modules:
                continue
            pair = pairs[(layer, module)]
            if set(pair) != {"A", "B"}:
                raise ValueError(f"PEFT LoRA pair is incomplete for layer {layer} {module}")
            rows, cols = expected_matrix_shape(shape, module)
            peft_a = pair["A"]
            peft_b = pair["B"]
            if peft_a.shape != (rank, cols) or peft_b.shape != (rows, rank):
                raise ValueError(
                    f"PEFT LoRA factor shape mismatch for layer {layer} {module}: "
                    f"A={peft_a.shape}, B={peft_b.shape}, expected A={(rank, cols)}, B={(rows, rank)}"
                )
            a_values = [value * scaling for value in decode_floats(peft_b)]
            b_values = decode_floats(peft_a)
            name = target_name(
                layer,
                "self_attn" if module in MODULE_ORDER[:4] else "mlp",
                module,
            )
            a_bytes = encode_f32(a_values, f"{name} A")
            b_bytes = encode_f32(b_values, f"{name} B")
            serialized_a_values = decode_encoded_f32(a_bytes)
            serialized_b_values = decode_encoded_f32(b_bytes)
            targets.append(
                ExportTarget(
                    name=name,
                    rows=rows,
                    cols=cols,
                    rank=rank,
                    a_bytes=a_bytes,
                    b_bytes=b_bytes,
                    delta_l1_upper_bound_microunits=delta_l1_upper_bound_microunits(
                        serialized_a_values,
                        serialized_b_values,
                        rows,
                        cols,
                        rank,
                    ),
                )
            )
    return ExportPlan(
        shape=shape,
        receipt=receipt,
        receipt_path=receipt_path,
        adapter_model_sha256=adapter_model_sha256,
        adapter_config_sha256=adapter_config_sha256,
        scaling_label=scaling_label,
        targets=tuple(targets),
    )


def evidence_value(value: str, label: str) -> str:
    if (
        len(value) < 8
        or len(value) > 512
        or "=" in value
        or any(ord(char) < 0x20 or ord(char) > 0x7E for char in value)
    ):
        raise ValueError(f"{label} must be 8..512 printable ASCII characters without '='")
    return value


def factor_stem(name: str) -> str:
    return "".join(char if char.isascii() and char.isalnum() else "_" for char in name)


def shape_lines(shape: ModelShape) -> list[tuple[str, str]]:
    return [
        ("vocab_size", str(shape.vocab_size)),
        ("special_token_count", str(shape.special_token_count)),
        ("hidden_size", str(shape.hidden_size)),
        ("layer_count", str(shape.layer_count)),
        ("head_count", str(shape.head_count)),
        ("kv_head_count", str(shape.kv_head_count)),
        ("head_dim", str(shape.head_dim)),
        ("ffn_size", str(shape.ffn_size)),
        ("max_context", str(shape.max_context)),
        ("rope_theta", format(shape.rope_theta, "g")),
        ("rms_norm_epsilon", format(shape.rms_norm_epsilon, "g")),
    ]


def write_export(
    plan: ExportPlan,
    output_dir: Path,
    source_id: str,
    source_license: str,
    training_summary: str,
) -> None:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    source_id = evidence_value(source_id, "adapter source id")
    source_license = evidence_value(source_license, "adapter source license")
    training_summary = evidence_value(training_summary, "adapter training summary")
    dataset_id = evidence_value(
        require_string(plan.receipt, "dataset_id"), "adapter source dataset"
    )
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        factors = staging / "factors"
        factors.mkdir()
        lines: list[tuple[str, str]] = [
            ("tinyrustlm_trained_adapter_source_version", "2"),
            ("model_family", "tinyrustlm"),
            ("adapter_source_layout", SOURCE_LAYOUT),
            ("adapter_format", SOURCE_FORMAT),
            ("model_shape", plan.shape.name),
            ("base_tied_output", "true"),
            ("base_tokenizer", "inherit-from-base-parent"),
            ("source_dtype", "f32"),
            ("adapter_source_kind", "trained-adapter-export"),
            ("adapter_source_id", source_id),
            ("adapter_source_license", source_license),
            ("adapter_source_dataset", dataset_id),
            ("adapter_training_summary", training_summary),
            ("training_receipt_sha256", sha256_file(plan.receipt_path)),
            ("base_model_sha256", require_string(plan.receipt, "base_model_sha256")),
            ("base_tokenizer_sha256", require_string(plan.receipt, "base_tokenizer_sha256")),
            ("peft_adapter_model_sha256", plan.adapter_model_sha256),
            ("peft_adapter_config_sha256", plan.adapter_config_sha256),
            ("system_prompt_sha256", require_string(plan.receipt, "system_prompt_sha256")),
            ("lora_scaling_policy", plan.scaling_label),
            *shape_lines(plan.shape),
            ("target_tensor_count", str(len(plan.targets))),
        ]
        for index, target in enumerate(plan.targets):
            stem = factor_stem(target.name)
            a_relative = f"factors/{stem}.A.f32"
            b_relative = f"factors/{stem}.B.f32"
            (staging / a_relative).write_bytes(target.a_bytes)
            (staging / b_relative).write_bytes(target.b_bytes)
            prefix = f"target.{index}"
            lines.extend(
                [
                    (f"{prefix}.name", target.name),
                    (f"{prefix}.name_hash", f"0x{name_hash(target.name):016x}"),
                    (f"{prefix}.rank", "2"),
                    (f"{prefix}.dims", f"{target.rows},{target.cols}"),
                    (f"{prefix}.factor_rank", str(target.rank)),
                    (f"{prefix}.a_shape", f"{target.rows},{target.rank}"),
                    (f"{prefix}.b_shape", f"{target.rank},{target.cols}"),
                    (f"{prefix}.a_file", a_relative),
                    (f"{prefix}.b_file", b_relative),
                    (f"{prefix}.a_bytes", str(len(target.a_bytes))),
                    (f"{prefix}.b_bytes", str(len(target.b_bytes))),
                    (f"{prefix}.a_checksum", f"0x{source_checksum(target.a_bytes):016x}"),
                    (f"{prefix}.b_checksum", f"0x{source_checksum(target.b_bytes):016x}"),
                    (
                        f"{prefix}.factor_parameter_count",
                        str(target.rank * (target.rows + target.cols)),
                    ),
                    (
                        f"{prefix}.delta_l1_upper_bound_microunits",
                        str(target.delta_l1_upper_bound_microunits),
                    ),
                ]
            )
        manifest = "".join(f"{key}={value}\n" for key, value in lines)
        (staging / "adapter-source.manifest").write_text(manifest, encoding="utf-8")
        os.replace(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def summary(plan: ExportPlan, output_dir: Path) -> dict[str, Any]:
    factor_bytes = sum(len(target.a_bytes) + len(target.b_bytes) for target in plan.targets)
    return {
        "status": "pass",
        "model_shape": plan.shape.name,
        "target_tensor_count": len(plan.targets),
        "factor_bytes": factor_bytes,
        "adapter_model_sha256": plan.adapter_model_sha256,
        "adapter_config_sha256": plan.adapter_config_sha256,
        "output_dir": str(output_dir.resolve()),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("adapter_dir", type=Path)
    parser.add_argument("base_model_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("model_shape", choices=sorted(MODEL_SHAPES))
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--source-license", required=True)
    parser.add_argument("--training-summary", required=True)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    receipt = args.receipt or args.adapter_dir / "tinyrustlm-training-receipt.json"
    plan = build_export_plan(
        args.adapter_dir, args.base_model_dir, receipt, args.model_shape
    )
    if not args.verify_only:
        write_export(
            plan,
            args.output_dir,
            args.source_id,
            args.source_license,
            args.training_summary,
        )
    print(json.dumps(summary(plan, args.output_dir), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
