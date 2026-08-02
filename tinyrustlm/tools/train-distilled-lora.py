"""Train a sequence-distilled LoRA from a Rust-frozen TinyRustLM dataset."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any


RECIPE_VERSION = "1"
TRAINING_ENGINE = "transformers-peft-sequence-lora-v1"
PRESERVATION_TRAINING_ENGINE = "transformers-peft-preservation-kl-lora-v2"
TOPK_DISTILLATION_ENGINE = "transformers-peft-topk-kd-lora-v1"
SUPPORTED_TRAINING_ENGINES = {
    TRAINING_ENGINE,
    PRESERVATION_TRAINING_ENGINE,
    TOPK_DISTILLATION_ENGINE,
}
MAX_CONTROL_FILE_BYTES = 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024
MAX_LOGIT_CACHE_BYTES = 64 * 1024 * 1024 * 1024
MAX_LOGIT_CACHE_LINE_BYTES = 64 * 1024 * 1024
ROLE_HISTORY_SCHEMA = "tinyrustlm.role_history.v1"
COMMON_RECIPE_KEYS = {
    "tinyrustlm_distillation_recipe_version",
    "recipe_id",
    "training_engine",
    "dataset_dir",
    "frozen_dataset_manifest",
    "base_model_dir",
    "output_dir",
    "system_prompt_file",
    "system_prompt_sha256",
    "device",
    "dtype",
    "seed",
    "epochs",
    "learning_rate",
    "weight_decay",
    "warmup_ratio",
    "max_sequence_tokens",
    "micro_batch_size",
    "gradient_accumulation_steps",
    "lora_rank",
    "lora_alpha",
    "lora_dropout",
    "target_modules",
    "logging_steps",
    "save_steps",
    "gradient_checkpointing",
    "teacher_reasoning_policy",
    "eval_exclusion_policy",
}
PRESERVATION_RECIPE_KEYS = {
    "preservation_source_ids",
    "preservation_kl_weight",
    "preservation_kl_temperature",
}
TOPK_RECIPE_KEYS = {
    "teacher_logit_cache_manifest",
    "teacher_kl_weight",
}
TOPK_CACHE_MANIFEST_KEYS = {
    "tinyrustlm_topk_logit_cache_version",
    "cache_status",
    "cache_id",
    "dataset_id",
    "frozen_dataset_manifest_sha256",
    "system_prompt_sha256",
    "student_tokenizer_sha256",
    "teacher_tokenizer_sha256",
    "tokenizer_alignment",
    "teacher_model_id",
    "teacher_revision",
    "teacher_model_identity_sha256",
    "teacher_identity_file",
    "teacher_identity_file_bytes",
    "teacher_identity_file_sha256",
    "probability_contract",
    "mask",
    "numeric_format",
    "max_sequence_tokens",
    "vocab_size",
    "top_k",
    "temperature",
    "record_count",
    "target_position_count",
    "cache_file",
    "cache_file_bytes",
    "cache_file_sha256",
}
TOPK_CACHE_RECORD_KEYS = {
    "schema",
    "record_id",
    "input_ids",
    "input_ids_sha256",
    "assistant_logit_positions",
    "topk_token_ids",
    "topk_log_probabilities",
    "tail_log_probabilities",
    "record_sha256",
}
TEACHER_IDENTITY_KEYS = {
    "schema",
    "model_id",
    "revision",
    "model_identity_sha256",
    "tokenizer_sha256",
    "artifacts",
}
TEACHER_IDENTITY_ARTIFACT_KEYS = {"relative_path", "bytes", "sha256"}


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class TrainingRecord:
    record_id: str
    task_family: str
    prompt: str
    response: str
    source_id: str = ""
    history: tuple[ChatMessage, ...] = ()


@dataclass(frozen=True)
class TopKCacheRecord:
    record_id: str
    input_ids: tuple[int, ...]
    assistant_logit_positions: tuple[int, ...]
    topk_token_ids: tuple[tuple[int, ...], ...]
    topk_log_probabilities: tuple[tuple[float, ...], ...]
    tail_log_probabilities: tuple[float, ...]
    record_sha256: str


@dataclass(frozen=True)
class VerifiedTopKCache:
    manifest_path: Path
    manifest: dict[str, str]
    cache_file_path: Path
    records: tuple[TopKCacheRecord, ...]
    top_k: int
    temperature: float
    target_position_count: int


@dataclass(frozen=True)
class VerifiedInputs:
    recipe_path: Path
    recipe: dict[str, str]
    dataset_dir: Path
    frozen_manifest_path: Path
    frozen_manifest: dict[str, str]
    base_model_dir: Path
    output_dir: Path
    system_prompt: str
    records: tuple[TrainingRecord, ...]
    topk_cache: VerifiedTopKCache | None = None


def sha256_bytes(payload: bytes) -> str:
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=True,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def token_sequence_sha256(input_ids: list[int] | tuple[int, ...]) -> str:
    return sha256_bytes(canonical_json(list(input_ids)).encode("ascii"))


def topk_cache_record_sha256(record: dict[str, Any]) -> str:
    content = {key: value for key, value in record.items() if key != "record_sha256"}
    return sha256_bytes(canonical_json(content).encode("ascii"))


def model_artifact_set_sha256(artifacts: list[dict[str, Any]]) -> str:
    return sha256_bytes(canonical_json({"artifacts": artifacts}).encode("ascii"))


def read_bounded_bytes(path: Path, limit: int, label: str) -> bytes:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size <= 0 or size > limit:
        raise ValueError(f"{label} byte length must be in 1..={limit}: {path}")
    return path.read_bytes()


def read_bounded_text(path: Path, limit: int, label: str) -> str:
    payload = read_bounded_bytes(path, limit, label)
    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be UTF-8: {path}") from error


def parse_manifest(text: str, label: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line_number, raw_line in enumerate(text.splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"{label} line {line_number} is missing '='")
        key, value = line.split("=", 1)
        if not key or not value or key.strip() != key or value.strip() != value:
            raise ValueError(f"{label} line {line_number} has an invalid key or value")
        if key in fields:
            raise ValueError(f"{label} line {line_number} duplicates {key!r}")
        fields[key] = value
    return fields


def require(fields: dict[str, str], key: str) -> str:
    try:
        return fields[key]
    except KeyError as error:
        raise ValueError(f"manifest is missing required key {key!r}") from error


def require_equal(fields: dict[str, str], key: str, expected: str) -> None:
    actual = require(fields, key)
    if actual != expected:
        raise ValueError(f"{key} was {actual!r}, expected {expected!r}")


def parse_int(fields: dict[str, str], key: str, minimum: int, maximum: int) -> int:
    try:
        value = int(require(fields, key))
    except ValueError as error:
        raise ValueError(f"{key} must be an integer") from error
    if not minimum <= value <= maximum:
        raise ValueError(f"{key} must be in [{minimum}, {maximum}]")
    return value


def parse_float(
    fields: dict[str, str], key: str, minimum: float, maximum: float
) -> float:
    try:
        value = float(require(fields, key))
    except ValueError as error:
        raise ValueError(f"{key} must be a number") from error
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f"{key} must be finite and in [{minimum}, {maximum}]")
    return value


def parse_bool(fields: dict[str, str], key: str) -> bool:
    value = require(fields, key)
    if value == "true":
        return True
    if value == "false":
        return False
    raise ValueError(f"{key} must be true or false")


def resolve_control_path(recipe_path: Path, value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = recipe_path.parent / path
    return path.resolve()


def resolve_dataset_file(dataset_dir: Path, relative: str, label: str) -> Path:
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"{label} must be a safe relative path")
    resolved = (dataset_dir / path).resolve()
    if dataset_dir != resolved and dataset_dir not in resolved.parents:
        raise ValueError(f"{label} escaped the dataset directory")
    return resolved


def verify_recipe(
    recipe_path: Path, *, allow_populated_output: bool = False
) -> VerifiedInputs:
    recipe_path = recipe_path.resolve()
    recipe_text = read_bounded_text(recipe_path, MAX_CONTROL_FILE_BYTES, "recipe")
    recipe = parse_manifest(recipe_text, "recipe")
    engine = require(recipe, "training_engine")
    if engine not in SUPPORTED_TRAINING_ENGINES:
        raise ValueError(f"training_engine {engine!r} is unsupported")
    expected_keys = set(COMMON_RECIPE_KEYS)
    if engine == PRESERVATION_TRAINING_ENGINE:
        expected_keys.update(PRESERVATION_RECIPE_KEYS)
    if engine == TOPK_DISTILLATION_ENGINE:
        expected_keys.update(TOPK_RECIPE_KEYS)
    unknown = sorted(set(recipe) - expected_keys)
    missing = sorted(expected_keys - set(recipe))
    if unknown:
        raise ValueError(f"recipe has unknown keys: {', '.join(unknown)}")
    if missing:
        raise ValueError(f"recipe is missing keys: {', '.join(missing)}")
    require_equal(recipe, "tinyrustlm_distillation_recipe_version", RECIPE_VERSION)
    require_equal(recipe, "teacher_reasoning_policy", "final-answer-only")
    require_equal(recipe, "eval_exclusion_policy", "rust-frozen-manifest-bound")

    dataset_dir = resolve_control_path(recipe_path, require(recipe, "dataset_dir"))
    frozen_manifest_path = resolve_control_path(
        recipe_path, require(recipe, "frozen_dataset_manifest")
    )
    base_model_dir = resolve_control_path(recipe_path, require(recipe, "base_model_dir"))
    output_dir = resolve_control_path(recipe_path, require(recipe, "output_dir"))
    system_prompt_path = resolve_control_path(
        recipe_path, require(recipe, "system_prompt_file")
    )
    if not dataset_dir.is_dir():
        raise ValueError(f"dataset_dir is not a directory: {dataset_dir}")
    if not base_model_dir.is_dir():
        raise ValueError(f"base_model_dir is not a directory: {base_model_dir}")
    if output_dir.exists():
        if not output_dir.is_dir():
            raise ValueError(f"output_dir must be a directory: {output_dir}")
        if any(output_dir.iterdir()) and not allow_populated_output:
            raise ValueError(f"output_dir must not already contain files: {output_dir}")

    frozen_text = read_bounded_text(
        frozen_manifest_path, MAX_CONTROL_FILE_BYTES, "frozen dataset manifest"
    )
    frozen = parse_manifest(frozen_text, "frozen dataset manifest")
    frozen_version = require(frozen, "tinyrustlm_distillation_dataset_version")
    if frozen_version not in {"1", "2"}:
        raise ValueError("frozen dataset version is unsupported")
    require_equal(frozen, "dataset_status", "frozen")
    require_equal(frozen, "dataset_split", "train")
    require_equal(frozen, "contamination_status", "pass")
    require_equal(frozen, "contamination_exact_match_count", "0")
    require_equal(frozen, "contamination_five_gram_match_count", "0")
    require_equal(frozen, "hidden_reasoning_status", "absent")
    require_equal(frozen, "likely_secret_status", "absent")

    source_manifest_path = resolve_dataset_file(
        dataset_dir, require(frozen, "source_manifest_file"), "source_manifest_file"
    )
    source_payload = read_bounded_bytes(
        source_manifest_path, MAX_CONTROL_FILE_BYTES, "dataset source manifest"
    )
    if len(source_payload) != parse_int(
        frozen, "source_manifest_bytes", 1, MAX_CONTROL_FILE_BYTES
    ):
        raise ValueError("dataset source manifest byte count drift")
    if sha256_bytes(source_payload) != require(frozen, "source_manifest_sha256"):
        raise ValueError("dataset source manifest SHA-256 drift")

    verify_base_checkpoint(base_model_dir, frozen)
    system_prompt_payload = read_bounded_bytes(
        system_prompt_path, MAX_CONTROL_FILE_BYTES, "system prompt"
    )
    if sha256_bytes(system_prompt_payload) != require(recipe, "system_prompt_sha256"):
        raise ValueError("system prompt SHA-256 drift")
    system_prompt = system_prompt_payload.decode("utf-8").strip()
    if not system_prompt:
        raise ValueError("system prompt must not be empty")

    records = verify_records(dataset_dir, frozen)
    validate_hyperparameters(recipe)
    validate_preservation_partition(recipe, records)
    topk_cache = None
    if engine == TOPK_DISTILLATION_ENGINE:
        topk_cache = verify_topk_cache(
            recipe_path=recipe_path,
            recipe=recipe,
            frozen_manifest_path=frozen_manifest_path,
            frozen=frozen,
            records=records,
        )
    return VerifiedInputs(
        recipe_path=recipe_path,
        recipe=recipe,
        dataset_dir=dataset_dir,
        frozen_manifest_path=frozen_manifest_path,
        frozen_manifest=frozen,
        base_model_dir=base_model_dir,
        output_dir=output_dir,
        system_prompt=system_prompt,
        records=tuple(records),
        topk_cache=topk_cache,
    )


def verify_base_checkpoint(base_model_dir: Path, frozen: dict[str, str]) -> None:
    weight_path = base_model_dir / "model.safetensors"
    tokenizer_path = base_model_dir / "tokenizer.json"
    if sha256_file(weight_path) != require(frozen, "student_weight_sha256"):
        raise ValueError("base model weight SHA-256 does not match frozen student identity")
    if sha256_file(tokenizer_path) != require(frozen, "student_tokenizer_sha256"):
        raise ValueError("base tokenizer SHA-256 does not match frozen student identity")


def verify_records(
    dataset_dir: Path, frozen: dict[str, str]
) -> list[TrainingRecord]:
    frozen_version = require(frozen, "tinyrustlm_distillation_dataset_version")
    count = parse_int(frozen, "record_count", 1, 100_000_000)
    records: list[TrainingRecord] = []
    seen: set[str] = set()
    for index in range(count):
        prefix = f"record.{index}"
        record_id = require(frozen, f"{prefix}.id")
        if record_id in seen:
            raise ValueError(f"duplicate frozen record id {record_id!r}")
        seen.add(record_id)
        prompt_path = resolve_dataset_file(
            dataset_dir, require(frozen, f"{prefix}.prompt_file"), "prompt_file"
        )
        response_path = resolve_dataset_file(
            dataset_dir, require(frozen, f"{prefix}.response_file"), "response_file"
        )
        prompt_payload = verify_record_payload(prompt_path, frozen, prefix, "prompt")
        response_payload = verify_record_payload(response_path, frozen, prefix, "response")
        history: tuple[ChatMessage, ...] = ()
        history_payload = b""
        if frozen_version == "2":
            history_path = resolve_dataset_file(
                dataset_dir, require(frozen, f"{prefix}.history_file"), "history_file"
            )
            if history_path.suffix != ".json":
                raise ValueError("history_file must have a .json suffix")
            history_payload = verify_record_payload(
                history_path, frozen, prefix, "history"
            )
            history = verify_role_history(
                history_payload,
                parse_int(frozen, f"{prefix}.history_message_count", 2, 12),
                record_id,
            )
        pair_payload = (
            history_payload + b"\0" + prompt_payload + b"\0" + response_payload
            if history
            else prompt_payload + b"\0" + response_payload
        )
        pair_sha256 = sha256_bytes(pair_payload)
        if pair_sha256 != require(frozen, f"{prefix}.training_pair_sha256"):
            raise ValueError(f"training pair SHA-256 drift for record {record_id}")
        records.append(
            TrainingRecord(
                record_id=record_id,
                task_family=require(frozen, f"{prefix}.task_family"),
                prompt=prompt_payload.decode("utf-8"),
                response=response_payload.decode("utf-8"),
                source_id=frozen.get(f"{prefix}.source_id", ""),
                history=history,
            )
        )
    return records


def verify_role_history(
    payload: bytes, expected_message_count: int, record_id: str
) -> tuple[ChatMessage, ...]:
    try:
        value = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"record {record_id} history must be valid UTF-8 JSON") from error
    if not isinstance(value, dict) or set(value) != {"schema", "messages"}:
        raise ValueError(f"record {record_id} history must have exact schema and messages keys")
    if value["schema"] != ROLE_HISTORY_SCHEMA:
        raise ValueError(f"record {record_id} history schema is unsupported")
    messages = value["messages"]
    if (
        not isinstance(messages, list)
        or len(messages) != expected_message_count
        or not 2 <= len(messages) <= 12
        or len(messages) % 2 != 0
    ):
        raise ValueError(f"record {record_id} history must contain 1..=6 complete turns")
    result: list[ChatMessage] = []
    for index, message in enumerate(messages):
        if not isinstance(message, dict) or set(message) != {"role", "content"}:
            raise ValueError(f"record {record_id} history message {index} has unknown keys")
        expected_role = "user" if index % 2 == 0 else "assistant"
        if message.get("role") != expected_role:
            raise ValueError(
                f"record {record_id} history message {index} must have role {expected_role}"
            )
        content = message.get("content")
        if (
            not isinstance(content, str)
            or not content.strip()
            or "\0" in content
            or len(content.encode("utf-8")) > MAX_RECORD_BYTES
        ):
            raise ValueError(f"record {record_id} history message {index} is invalid")
        result.append(ChatMessage(expected_role, content))
    return tuple(result)


def verify_record_payload(
    path: Path, frozen: dict[str, str], prefix: str, kind: str
) -> bytes:
    payload = read_bounded_bytes(path, MAX_RECORD_BYTES, f"record {kind}")
    expected_bytes = parse_int(frozen, f"{prefix}.{kind}_bytes", 1, MAX_RECORD_BYTES)
    if len(payload) != expected_bytes:
        raise ValueError(f"record {kind} byte count drift: {path}")
    if sha256_bytes(payload) != require(frozen, f"{prefix}.{kind}_sha256"):
        raise ValueError(f"record {kind} SHA-256 drift: {path}")
    try:
        payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"record {kind} is not UTF-8: {path}") from error
    return payload


def require_sha256(value: str, label: str) -> str:
    if (
        len(value) != 71
        or not value.startswith("sha256:")
        or any(character not in "0123456789abcdef" for character in value[7:])
    ):
        raise ValueError(f"{label} must be a lowercase sha256: digest")
    return value


def verify_topk_cache(
    *,
    recipe_path: Path,
    recipe: dict[str, str],
    frozen_manifest_path: Path,
    frozen: dict[str, str],
    records: list[TrainingRecord],
) -> VerifiedTopKCache:
    manifest_path = resolve_control_path(
        recipe_path, require(recipe, "teacher_logit_cache_manifest")
    )
    manifest = parse_manifest(
        read_bounded_text(
            manifest_path, MAX_CONTROL_FILE_BYTES, "teacher top-k cache manifest"
        ),
        "teacher top-k cache manifest",
    )
    unknown = sorted(set(manifest) - TOPK_CACHE_MANIFEST_KEYS)
    missing = sorted(TOPK_CACHE_MANIFEST_KEYS - set(manifest))
    if unknown:
        raise ValueError(f"teacher top-k cache manifest has unknown keys: {', '.join(unknown)}")
    if missing:
        raise ValueError(f"teacher top-k cache manifest is missing keys: {', '.join(missing)}")

    require_equal(manifest, "tinyrustlm_topk_logit_cache_version", "1")
    require_equal(manifest, "cache_status", "complete")
    require_equal(
        manifest, "tokenizer_alignment", "same-tokenizer-token-and-sequence"
    )
    require_equal(
        manifest,
        "probability_contract",
        "teacher-topk-plus-aggregate-tail-v1",
    )
    require_equal(manifest, "mask", "assistant-target-tokens-only")
    require_equal(
        manifest,
        "numeric_format",
        "float32-normalized-log-probabilities",
    )
    if require(manifest, "dataset_id") != require(frozen, "dataset_id"):
        raise ValueError("teacher top-k cache dataset_id does not match the frozen dataset")
    if require_sha256(
        require(manifest, "frozen_dataset_manifest_sha256"),
        "frozen_dataset_manifest_sha256",
    ) != sha256_file(frozen_manifest_path):
        raise ValueError("teacher top-k cache is bound to a different frozen manifest")
    if require_sha256(
        require(manifest, "system_prompt_sha256"), "system_prompt_sha256"
    ) != require(recipe, "system_prompt_sha256"):
        raise ValueError("teacher top-k cache is bound to a different system prompt")

    student_tokenizer = require_sha256(
        require(manifest, "student_tokenizer_sha256"), "student_tokenizer_sha256"
    )
    teacher_tokenizer = require_sha256(
        require(manifest, "teacher_tokenizer_sha256"), "teacher_tokenizer_sha256"
    )
    frozen_tokenizer = require_sha256(
        require(frozen, "student_tokenizer_sha256"), "frozen student tokenizer"
    )
    if student_tokenizer != frozen_tokenizer:
        raise ValueError("teacher top-k cache student tokenizer does not match frozen bytes")
    if teacher_tokenizer != student_tokenizer:
        raise ValueError(
            "top-k distillation requires byte-identical teacher and student tokenizers"
        )
    teacher_model_identity = require_sha256(
        require(manifest, "teacher_model_identity_sha256"),
        "teacher_model_identity_sha256",
    )
    for key in ("cache_id", "teacher_model_id", "teacher_revision"):
        value = require(manifest, key)
        if len(value) > 512 or any(ord(character) < 32 for character in value):
            raise ValueError(f"{key} is invalid")
    verify_teacher_identity_file(
        manifest_path=manifest_path,
        manifest=manifest,
        teacher_model_identity=teacher_model_identity,
        teacher_tokenizer=teacher_tokenizer,
    )

    max_sequence_tokens = parse_int(
        manifest, "max_sequence_tokens", 16, 131_072
    )
    if max_sequence_tokens != parse_int(
        recipe, "max_sequence_tokens", 16, 131_072
    ):
        raise ValueError("teacher top-k cache max_sequence_tokens does not match recipe")
    vocab_size = parse_int(manifest, "vocab_size", 2, 10_000_000)
    top_k = parse_int(manifest, "top_k", 1, vocab_size - 1)
    temperature = parse_float(manifest, "temperature", 0.1, 10.0)
    record_count = parse_int(manifest, "record_count", 1, 100_000_000)
    if record_count != len(records):
        raise ValueError("teacher top-k cache record_count does not match frozen records")
    target_position_count = parse_int(
        manifest, "target_position_count", record_count, 100_000_000_000
    )

    cache_file_path = resolve_dataset_file(
        manifest_path.parent.resolve(), require(manifest, "cache_file"), "cache_file"
    )
    if not cache_file_path.is_file() or cache_file_path.is_symlink():
        raise ValueError("teacher top-k cache file must be a regular non-symlink file")
    expected_bytes = parse_int(
        manifest, "cache_file_bytes", 1, MAX_LOGIT_CACHE_BYTES
    )
    if cache_file_path.stat().st_size != expected_bytes:
        raise ValueError("teacher top-k cache file byte count drift")
    expected_cache_sha = require_sha256(
        require(manifest, "cache_file_sha256"), "cache_file_sha256"
    )
    if sha256_file(cache_file_path) != expected_cache_sha:
        raise ValueError("teacher top-k cache file SHA-256 drift")

    cache_records = read_topk_cache_records(
        cache_file_path,
        expected_records=records,
        max_sequence_tokens=max_sequence_tokens,
        vocab_size=vocab_size,
        top_k=top_k,
    )
    actual_target_count = sum(
        len(record.assistant_logit_positions) for record in cache_records
    )
    if actual_target_count != target_position_count:
        raise ValueError("teacher top-k cache target_position_count drift")
    return VerifiedTopKCache(
        manifest_path=manifest_path,
        manifest=manifest,
        cache_file_path=cache_file_path,
        records=tuple(cache_records),
        top_k=top_k,
        temperature=temperature,
        target_position_count=target_position_count,
    )


def verify_teacher_identity_file(
    *,
    manifest_path: Path,
    manifest: dict[str, str],
    teacher_model_identity: str,
    teacher_tokenizer: str,
) -> None:
    identity_path = resolve_dataset_file(
        manifest_path.parent.resolve(),
        require(manifest, "teacher_identity_file"),
        "teacher_identity_file",
    )
    expected_bytes = parse_int(
        manifest, "teacher_identity_file_bytes", 1, MAX_CONTROL_FILE_BYTES
    )
    payload = read_bounded_bytes(
        identity_path, MAX_CONTROL_FILE_BYTES, "teacher identity file"
    )
    if len(payload) != expected_bytes:
        raise ValueError("teacher identity file byte count drift")
    if sha256_bytes(payload) != require_sha256(
        require(manifest, "teacher_identity_file_sha256"),
        "teacher_identity_file_sha256",
    ):
        raise ValueError("teacher identity file SHA-256 drift")
    try:
        identity = json.loads(
            payload,
            parse_constant=lambda constant: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {constant}")
            ),
        )
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise ValueError("teacher identity file must be valid UTF-8 JSON") from error
    if not isinstance(identity, dict) or set(identity) != TEACHER_IDENTITY_KEYS:
        raise ValueError("teacher identity file has an invalid object shape")
    if identity["schema"] != "tinyrustlm.teacher_model_identity.v1":
        raise ValueError("teacher identity file schema is unsupported")
    for identity_key, manifest_key in (
        ("model_id", "teacher_model_id"),
        ("revision", "teacher_revision"),
    ):
        if identity[identity_key] != require(manifest, manifest_key):
            raise ValueError(f"teacher identity {identity_key} does not match manifest")
    if identity["model_identity_sha256"] != teacher_model_identity:
        raise ValueError("teacher identity model digest does not match manifest")
    if identity["tokenizer_sha256"] != teacher_tokenizer:
        raise ValueError("teacher identity tokenizer digest does not match manifest")
    artifacts = identity["artifacts"]
    if not isinstance(artifacts, list) or not artifacts:
        raise ValueError("teacher identity artifacts must be a non-empty array")
    previous_path = ""
    for index, artifact in enumerate(artifacts):
        if not isinstance(artifact, dict) or set(artifact) != TEACHER_IDENTITY_ARTIFACT_KEYS:
            raise ValueError(f"teacher identity artifact {index} has an invalid shape")
        relative_path = artifact["relative_path"]
        if (
            not isinstance(relative_path, str)
            or not relative_path
            or Path(relative_path).is_absolute()
            or ".." in Path(relative_path).parts
            or relative_path <= previous_path
        ):
            raise ValueError("teacher identity artifact paths must be unique and sorted")
        previous_path = relative_path
        byte_count = artifact["bytes"]
        if isinstance(byte_count, bool) or not isinstance(byte_count, int) or byte_count <= 0:
            raise ValueError("teacher identity artifact byte count is invalid")
        digest = artifact["sha256"]
        if not isinstance(digest, str):
            raise ValueError("teacher identity artifact SHA-256 is invalid")
        require_sha256(digest, "teacher identity artifact SHA-256")
    if model_artifact_set_sha256(artifacts) != teacher_model_identity:
        raise ValueError("teacher identity artifact set digest drift")


def read_topk_cache_records(
    path: Path,
    *,
    expected_records: list[TrainingRecord],
    max_sequence_tokens: int,
    vocab_size: int,
    top_k: int,
) -> list[TopKCacheRecord]:
    parsed: list[TopKCacheRecord] = []
    with path.open("rb") as source:
        line_number = 0
        while raw_line := source.readline(MAX_LOGIT_CACHE_LINE_BYTES + 1):
            line_number += 1
            if len(raw_line) > MAX_LOGIT_CACHE_LINE_BYTES:
                raise ValueError(f"teacher top-k cache line {line_number} is too large")
            if not raw_line.endswith(b"\n") or raw_line.endswith(b"\r\n"):
                raise ValueError("teacher top-k cache must use canonical LF-terminated JSONL")
            payload = raw_line[:-1]
            if not payload:
                raise ValueError(f"teacher top-k cache line {line_number} is empty")
            try:
                value = json.loads(
                    payload,
                    parse_constant=lambda constant: (_ for _ in ()).throw(
                        ValueError(f"non-finite JSON number {constant}")
                    ),
                )
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
                raise ValueError(
                    f"teacher top-k cache line {line_number} is invalid JSON"
                ) from error
            if len(parsed) >= len(expected_records):
                raise ValueError("teacher top-k cache has more rows than frozen records")
            parsed.append(
                parse_topk_cache_record(
                    value,
                    expected_record=expected_records[len(parsed)],
                    max_sequence_tokens=max_sequence_tokens,
                    vocab_size=vocab_size,
                    top_k=top_k,
                    line_number=line_number,
                )
            )
    if len(parsed) != len(expected_records):
        raise ValueError("teacher top-k cache rows do not cover every frozen record")
    return parsed


def parse_topk_cache_record(
    value: Any,
    *,
    expected_record: TrainingRecord,
    max_sequence_tokens: int,
    vocab_size: int,
    top_k: int,
    line_number: int,
) -> TopKCacheRecord:
    label = f"teacher top-k cache line {line_number}"
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    unknown = sorted(set(value) - TOPK_CACHE_RECORD_KEYS)
    missing = sorted(TOPK_CACHE_RECORD_KEYS - set(value))
    if unknown or missing:
        detail = "unknown keys" if unknown else "missing keys"
        keys = unknown if unknown else missing
        raise ValueError(f"{label} has {detail}: {', '.join(keys)}")
    if value["schema"] != "tinyrustlm.topk_logit_cache_record.v1":
        raise ValueError(f"{label} has an unsupported schema")
    if value["record_id"] != expected_record.record_id:
        raise ValueError(f"{label} does not match frozen record order")

    input_ids = require_json_int_list(
        value["input_ids"], f"{label}.input_ids", minimum=0, maximum=vocab_size - 1
    )
    if not 2 <= len(input_ids) <= max_sequence_tokens:
        raise ValueError(f"{label}.input_ids length is invalid")
    if value["input_ids_sha256"] != token_sequence_sha256(input_ids):
        raise ValueError(f"{label} input token sequence SHA-256 drift")

    positions = require_json_int_list(
        value["assistant_logit_positions"],
        f"{label}.assistant_logit_positions",
        minimum=0,
        maximum=len(input_ids) - 2,
    )
    if not positions or positions != list(range(positions[0], len(input_ids) - 1)):
        raise ValueError(
            f"{label} assistant logit positions must be a contiguous response suffix"
        )
    token_rows = value["topk_token_ids"]
    probability_rows = value["topk_log_probabilities"]
    tails = value["tail_log_probabilities"]
    if not all(isinstance(rows, list) for rows in (token_rows, probability_rows, tails)):
        raise ValueError(f"{label} distribution fields must be JSON arrays")
    if not len(token_rows) == len(probability_rows) == len(tails) == len(positions):
        raise ValueError(f"{label} distribution row counts do not match positions")

    parsed_token_rows: list[tuple[int, ...]] = []
    parsed_probability_rows: list[tuple[float, ...]] = []
    parsed_tails: list[float] = []
    for index, (token_row, probability_row, tail) in enumerate(
        zip(token_rows, probability_rows, tails, strict=True)
    ):
        row_label = f"{label} distribution {index}"
        tokens = require_json_int_list(
            token_row, f"{row_label}.topk_token_ids", minimum=0, maximum=vocab_size - 1
        )
        if len(tokens) != top_k:
            raise ValueError(f"{row_label} must contain exactly top_k token ids")
        if len(tokens) != len(set(tokens)):
            raise ValueError(f"{row_label} must contain distinct top-k token ids")
        probabilities = require_json_float_list(
            probability_row, f"{row_label}.topk_log_probabilities"
        )
        if len(probabilities) != top_k:
            raise ValueError(f"{row_label} must contain exactly top_k log probabilities")
        tail_probability = require_json_float(tail, f"{row_label}.tail_log_probability")
        if any(log_probability > 0.0 for log_probability in probabilities):
            raise ValueError(f"{row_label} top-k log probabilities must be non-positive")
        if tail_probability > 0.0:
            raise ValueError(f"{row_label} tail log probability must be non-positive")
        for offset in range(1, top_k):
            if probabilities[offset] > probabilities[offset - 1]:
                raise ValueError(f"{row_label} top-k probabilities are not descending")
            if (
                probabilities[offset] == probabilities[offset - 1]
                and tokens[offset] < tokens[offset - 1]
            ):
                raise ValueError(f"{row_label} equal probabilities must use token-id order")
        mass = math.fsum(math.exp(item) for item in probabilities) + math.exp(
            tail_probability
        )
        if not math.isclose(mass, 1.0, rel_tol=0.0, abs_tol=5e-6):
            raise ValueError(f"{row_label} probability mass does not sum to one")
        parsed_token_rows.append(tuple(tokens))
        parsed_probability_rows.append(tuple(probabilities))
        parsed_tails.append(tail_probability)

    record_sha = value["record_sha256"]
    if not isinstance(record_sha, str):
        raise ValueError(f"{label}.record_sha256 must be a string")
    require_sha256(record_sha, f"{label}.record_sha256")
    if record_sha != topk_cache_record_sha256(value):
        raise ValueError(f"{label} record SHA-256 drift")
    return TopKCacheRecord(
        record_id=expected_record.record_id,
        input_ids=tuple(input_ids),
        assistant_logit_positions=tuple(positions),
        topk_token_ids=tuple(parsed_token_rows),
        topk_log_probabilities=tuple(parsed_probability_rows),
        tail_log_probabilities=tuple(parsed_tails),
        record_sha256=record_sha,
    )


def require_json_int_list(
    value: Any, label: str, *, minimum: int, maximum: int
) -> list[int]:
    if not isinstance(value, list) or any(
        isinstance(item, bool)
        or not isinstance(item, int)
        or not minimum <= item <= maximum
        for item in value
    ):
        raise ValueError(f"{label} must be an integer array in [{minimum}, {maximum}]")
    return value


def require_json_float(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number")
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError(f"{label} must be a finite number")
    return parsed


def require_json_float_list(value: Any, label: str) -> list[float]:
    if not isinstance(value, list):
        raise ValueError(f"{label} must be a finite-number array")
    return [require_json_float(item, label) for item in value]


def validate_hyperparameters(recipe: dict[str, str]) -> None:
    parse_int(recipe, "seed", 0, 2**31 - 1)
    parse_float(recipe, "epochs", 0.01, 100.0)
    parse_float(recipe, "learning_rate", 1e-8, 1.0)
    parse_float(recipe, "weight_decay", 0.0, 1.0)
    parse_float(recipe, "warmup_ratio", 0.0, 1.0)
    parse_int(recipe, "max_sequence_tokens", 16, 131_072)
    parse_int(recipe, "micro_batch_size", 1, 1024)
    parse_int(recipe, "gradient_accumulation_steps", 1, 65_536)
    parse_int(recipe, "lora_rank", 1, 256)
    parse_int(recipe, "lora_alpha", 1, 4096)
    parse_float(recipe, "lora_dropout", 0.0, 0.95)
    parse_int(recipe, "logging_steps", 1, 10_000_000)
    parse_int(recipe, "save_steps", 1, 10_000_000)
    parse_bool(recipe, "gradient_checkpointing")
    if require(recipe, "device") not in {"cuda", "cpu"}:
        raise ValueError("device must be cuda or cpu")
    if require(recipe, "dtype") not in {"float32", "float16", "bfloat16"}:
        raise ValueError("dtype must be float32, float16, or bfloat16")
    modules = require(recipe, "target_modules").split(",")
    if not modules or any(
        not module
        or not all(ch.isascii() and (ch.isalnum() or ch == "_") for ch in module)
        for module in modules
    ):
        raise ValueError("target_modules must be a comma-separated ASCII identifier list")
    if len(set(modules)) != len(modules):
        raise ValueError("target_modules must not contain duplicates")
    if require(recipe, "training_engine") == PRESERVATION_TRAINING_ENGINE:
        preservation_source_ids(recipe)
        parse_float(recipe, "preservation_kl_weight", 1e-6, 100.0)
        parse_float(recipe, "preservation_kl_temperature", 0.1, 10.0)
    if require(recipe, "training_engine") == TOPK_DISTILLATION_ENGINE:
        parse_float(recipe, "teacher_kl_weight", 1e-6, 100.0)


def preservation_source_ids(recipe: dict[str, str]) -> frozenset[str]:
    if require(recipe, "training_engine") != PRESERVATION_TRAINING_ENGINE:
        return frozenset()
    values = require(recipe, "preservation_source_ids").split(",")
    if not values or any(
        not value
        or len(value) > 256
        or any(
            not (character.isascii() and (character.isalnum() or character in "._-"))
            for character in value
        )
        for value in values
    ):
        raise ValueError(
            "preservation_source_ids must be a comma-separated stable ASCII identifier list"
        )
    if len(set(values)) != len(values):
        raise ValueError("preservation_source_ids must not contain duplicates")
    return frozenset(values)


def validate_preservation_partition(
    recipe: dict[str, str], records: list[TrainingRecord]
) -> None:
    sources = preservation_source_ids(recipe)
    if not sources:
        return
    selected = [record for record in records if record.source_id in sources]
    if not selected:
        raise ValueError("preservation_source_ids does not select any frozen records")
    if len(selected) == len(records):
        raise ValueError(
            "preservation_source_ids must leave at least one correction record unanchored"
        )
    missing_source = [record.record_id for record in records if not record.source_id]
    if missing_source:
        raise ValueError(
            "preservation training requires source_id on every frozen record; "
            f"missing on {missing_source[0]}"
        )


def transformers_dtype_argument(version: str) -> str:
    major_text = version.split(".", 1)[0]
    try:
        major = int(major_text)
    except ValueError as error:
        raise RuntimeError(f"could not parse transformers version {version!r}") from error
    if major < 4:
        raise RuntimeError(f"unsupported transformers version {version!r}")
    return "dtype" if major >= 5 else "torch_dtype"


def training_arguments_kwargs(
    output_dir: Path,
    recipe: dict[str, str],
    seed: int,
    device: str,
    dtype_name: str,
    record_count: int,
) -> dict[str, Any]:
    """Build arguments shared by supported Transformers 4 and 5 releases."""
    micro_batch_size = parse_int(recipe, "micro_batch_size", 1, 1024)
    accumulation_steps = parse_int(
        recipe, "gradient_accumulation_steps", 1, 65_536
    )
    batches_per_epoch = math.ceil(record_count / micro_batch_size)
    updates_per_epoch = math.ceil(batches_per_epoch / accumulation_steps)
    total_updates = math.ceil(
        updates_per_epoch * parse_float(recipe, "epochs", 0.01, 100.0)
    )
    warmup_steps = math.ceil(
        total_updates * parse_float(recipe, "warmup_ratio", 0.0, 1.0)
    )
    return {
        "output_dir": str(output_dir),
        "num_train_epochs": parse_float(recipe, "epochs", 0.01, 100.0),
        "per_device_train_batch_size": micro_batch_size,
        "gradient_accumulation_steps": accumulation_steps,
        "learning_rate": parse_float(recipe, "learning_rate", 1e-8, 1.0),
        "weight_decay": parse_float(recipe, "weight_decay", 0.0, 1.0),
        "warmup_steps": warmup_steps,
        "logging_steps": parse_int(recipe, "logging_steps", 1, 10_000_000),
        "save_steps": parse_int(recipe, "save_steps", 1, 10_000_000),
        "save_strategy": "steps",
        "report_to": [],
        "seed": seed,
        "data_seed": seed,
        "fp16": dtype_name == "float16",
        "bf16": dtype_name == "bfloat16",
        "use_cpu": device == "cpu",
        "remove_unused_columns": False,
        "gradient_checkpointing": parse_bool(recipe, "gradient_checkpointing"),
    }


def train(inputs: VerifiedInputs) -> None:
    try:
        import torch
        import transformers
        from peft import LoraConfig, TaskType, get_peft_model
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            Trainer,
            TrainingArguments,
            set_seed,
        )
    except ImportError as error:
        raise RuntimeError(
            "training requires torch, transformers, accelerate, and peft in the active environment"
        ) from error

    recipe = inputs.recipe
    device = require(recipe, "device")
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("recipe requires CUDA, but torch reports no usable CUDA device")
    dtype_name = require(recipe, "dtype")
    dtype = {
        "float32": torch.float32,
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
    }[dtype_name]
    if device == "cpu" and dtype != torch.float32:
        raise RuntimeError("CPU training is restricted to float32 for deterministic support")
    if device == "cuda" and dtype == torch.bfloat16 and not torch.cuda.is_bf16_supported():
        raise RuntimeError("recipe requests bfloat16 on a CUDA device without bfloat16 support")

    seed = parse_int(recipe, "seed", 0, 2**31 - 1)
    random.seed(seed)
    set_seed(seed)
    tokenizer = AutoTokenizer.from_pretrained(
        inputs.base_model_dir, local_files_only=True
    )
    if tokenizer.pad_token_id is None:
        if tokenizer.eos_token_id is None:
            raise RuntimeError("base tokenizer defines neither pad_token_id nor eos_token_id")
        tokenizer.pad_token_id = tokenizer.eos_token_id
    model_options: dict[str, Any] = {"local_files_only": True}
    model_options[transformers_dtype_argument(transformers.__version__)] = dtype
    model = AutoModelForCausalLM.from_pretrained(inputs.base_model_dir, **model_options)
    model.config.use_cache = False
    if parse_bool(recipe, "gradient_checkpointing"):
        model.gradient_checkpointing_enable()
        model.enable_input_require_grads()

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=parse_int(recipe, "lora_rank", 1, 256),
        lora_alpha=parse_int(recipe, "lora_alpha", 1, 4096),
        lora_dropout=parse_float(recipe, "lora_dropout", 0.0, 0.95),
        target_modules=require(recipe, "target_modules").split(","),
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    preservation_sources = preservation_source_ids(recipe)
    tokenized = tokenize_records(
        tokenizer,
        inputs.records,
        inputs.system_prompt,
        parse_int(recipe, "max_sequence_tokens", 16, 131_072),
        preservation_sources=preservation_sources,
    )
    if inputs.topk_cache is not None:
        attach_topk_cache(tokenized, inputs.records, inputs.topk_cache)
    dataset = ListDataset(tokenized)
    collator = CausalLmCollator(tokenizer.pad_token_id)

    inputs.output_dir.mkdir(parents=True, exist_ok=True)
    arguments = TrainingArguments(
        **training_arguments_kwargs(
            inputs.output_dir,
            recipe,
            seed,
            device,
            dtype_name,
            len(tokenized),
        )
    )
    trainer_options: dict[str, Any] = {
        "model": model,
        "args": arguments,
        "train_dataset": dataset,
        "data_collator": collator,
    }
    engine = require(recipe, "training_engine")
    if engine == PRESERVATION_TRAINING_ENGINE:
        trainer = PreservationAwareTrainer(
            Trainer,
            torch,
            kl_weight=parse_float(recipe, "preservation_kl_weight", 1e-6, 100.0),
            kl_temperature=parse_float(
                recipe, "preservation_kl_temperature", 0.1, 10.0
            ),
            trainer_options=trainer_options,
        ).trainer
    elif engine == TOPK_DISTILLATION_ENGINE:
        if inputs.topk_cache is None:
            raise RuntimeError("top-k training engine has no verified teacher cache")
        trainer = TopKDistillationTrainer(
            Trainer,
            torch,
            kl_weight=parse_float(recipe, "teacher_kl_weight", 1e-6, 100.0),
            temperature=inputs.topk_cache.temperature,
            trainer_options=trainer_options,
        ).trainer
    else:
        trainer = Trainer(**trainer_options)
    metrics = dict(trainer.train().metrics)
    if engine == TOPK_DISTILLATION_ENGINE:
        component_count = getattr(trainer, "_tinyrustlm_topk_batch_count", 0)
        if component_count <= 0:
            raise RuntimeError("top-k trainer produced no component-loss evidence")
        metrics["tinyrustlm_sft_loss_mean"] = (
            trainer._tinyrustlm_topk_sft_loss_sum / component_count
        )
        metrics["tinyrustlm_topk_kl_loss_mean"] = (
            trainer._tinyrustlm_topk_kl_loss_sum / component_count
        )
        metrics["tinyrustlm_component_batch_count"] = component_count
    trainer.save_model(str(inputs.output_dir))
    tokenizer.save_pretrained(inputs.output_dir / "tokenizer")
    write_training_receipt(inputs, metrics)


def tokenize_records(
    tokenizer: Any,
    records: tuple[TrainingRecord, ...],
    system_prompt: str,
    max_tokens: int,
    preservation_sources: frozenset[str] = frozenset(),
) -> list[dict[str, Any]]:
    tokenized: list[dict[str, Any]] = []
    for record in records:
        prompt_messages = [
            {"role": "system", "content": system_prompt},
        ]
        prompt_messages.extend(
            {"role": message.role, "content": message.content}
            for message in record.history
        )
        prompt_messages.append({"role": "user", "content": record.prompt})
        full_messages = prompt_messages + [
            {"role": "assistant", "content": record.response}
        ]
        prompt_text = tokenizer.apply_chat_template(
            prompt_messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
        full_text = tokenizer.apply_chat_template(
            full_messages,
            tokenize=False,
            add_generation_prompt=False,
            enable_thinking=False,
        )
        prompt_ids = list(
            tokenizer(prompt_text, add_special_tokens=False, truncation=False)[
                "input_ids"
            ]
        )
        full = tokenizer(
            full_text,
            add_special_tokens=False,
            truncation=True,
            max_length=max_tokens,
        )
        input_ids = list(full["input_ids"])
        if len(prompt_ids) >= len(input_ids):
            raise RuntimeError(
                f"record {record.record_id} has no untruncated assistant target tokens"
            )
        if input_ids[: len(prompt_ids)] != prompt_ids:
            raise RuntimeError(
                f"record {record.record_id} chat template does not preserve the prompt prefix"
            )
        labels = input_ids.copy()
        labels[: len(prompt_ids)] = [-100] * len(prompt_ids)
        item: dict[str, Any] = {
            "record_id": record.record_id,
            "input_ids": input_ids,
            "attention_mask": list(full["attention_mask"]),
            "labels": labels,
        }
        if preservation_sources:
            item["preserve"] = int(record.source_id in preservation_sources)
        tokenized.append(item)
    return tokenized


def attach_topk_cache(
    tokenized: list[dict[str, Any]],
    records: tuple[TrainingRecord, ...],
    cache: VerifiedTopKCache | None,
) -> None:
    if cache is None:
        raise RuntimeError("top-k teacher cache is not verified")
    if not len(tokenized) == len(records) == len(cache.records):
        raise RuntimeError("top-k cache and tokenized record counts differ")
    for item, record, cached in zip(tokenized, records, cache.records, strict=True):
        if item.get("record_id") != record.record_id or cached.record_id != record.record_id:
            raise RuntimeError("top-k cache record order drift")
        if list(cached.input_ids) != item["input_ids"]:
            raise RuntimeError(
                f"record {record.record_id} input token ids drift from the teacher cache"
            )
        labels = item["labels"]
        expected_positions = [
            position - 1
            for position in range(1, len(labels))
            if labels[position] != -100
        ]
        if list(cached.assistant_logit_positions) != expected_positions:
            raise RuntimeError(
                f"record {record.record_id} assistant target positions drift from the teacher cache"
            )
        item["teacher_positions"] = list(cached.assistant_logit_positions)
        item["teacher_topk_token_ids"] = [list(row) for row in cached.topk_token_ids]
        item["teacher_topk_log_probabilities"] = [
            list(row) for row in cached.topk_log_probabilities
        ]
        item["teacher_tail_log_probabilities"] = list(
            cached.tail_log_probabilities
        )


class PreservationAwareTrainer:
    """Own a Trainer subclass without importing the ML stack during verification."""

    def __init__(
        self,
        trainer_base: Any,
        torch_module: Any,
        *,
        kl_weight: float,
        kl_temperature: float,
        trainer_options: dict[str, Any],
    ) -> None:
        torch = torch_module
        weight = kl_weight
        temperature = kl_temperature

        class _Trainer(trainer_base):
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                super().__init__(*args, **kwargs)
                self.model_accepts_loss_kwargs = False

            def compute_loss(
                self,
                model: Any,
                inputs: dict[str, Any],
                return_outputs: bool = False,
                num_items_in_batch: Any = None,
            ) -> Any:
                del num_items_in_batch
                model_inputs = dict(inputs)
                preserve_mask = model_inputs.pop("preserve_mask", None)
                if preserve_mask is None:
                    raise RuntimeError(
                        "preservation-aware training requires preserve_mask in every batch"
                    )
                outputs = model(**model_inputs)
                sft_loss = outputs.loss
                if sft_loss is None:
                    raise RuntimeError("causal language model did not return a training loss")

                if not bool(preserve_mask.any().item()):
                    return (sft_loss, outputs) if return_outputs else sft_loss
                labels = model_inputs.get("labels")
                if labels is None or labels.ndim != 2:
                    raise RuntimeError(
                        "preservation-aware training requires two-dimensional labels"
                    )
                disable_adapter = getattr(model, "disable_adapter", None)
                if not callable(disable_adapter):
                    raise RuntimeError("PEFT model does not expose disable_adapter()")

                was_training = model.training
                try:
                    model.eval()
                    base_inputs = {
                        key: value
                        for key, value in model_inputs.items()
                        if key != "labels"
                    }
                    with torch.no_grad(), disable_adapter():
                        base_outputs = model(**base_inputs)
                finally:
                    if was_training:
                        model.train()

                token_mask = labels[:, 1:].ne(-100) & preserve_mask.to(
                    dtype=torch.bool, device=labels.device
                ).unsqueeze(1)
                token_count = token_mask.sum()
                if int(token_count.item()) == 0:
                    raise RuntimeError(
                        "preservation batch contains no unmasked assistant target tokens"
                    )
                student_logits = outputs.logits[:, :-1, :].float() / temperature
                base_logits = base_outputs.logits[:, :-1, :].float() / temperature
                token_kl = torch.nn.functional.kl_div(
                    torch.nn.functional.log_softmax(student_logits, dim=-1),
                    torch.nn.functional.softmax(base_logits, dim=-1),
                    reduction="none",
                ).sum(dim=-1)
                kl_loss = (
                    token_kl.masked_select(token_mask).mean()
                    * temperature
                    * temperature
                )
                loss = sft_loss + weight * kl_loss
                return (loss, outputs) if return_outputs else loss

        self.trainer = _Trainer(**trainer_options)


def topk_aggregate_kl(
    torch_module: Any,
    student_logits: Any,
    topk_token_ids: Any,
    teacher_topk_log_probabilities: Any,
    teacher_tail_log_probabilities: Any,
) -> Any:
    """KL over teacher top-k tokens plus one aggregate residual-tail bucket."""
    torch = torch_module
    if student_logits.ndim != 2 or topk_token_ids.ndim != 2:
        raise RuntimeError("top-k KL expects two-dimensional student logits and token ids")
    if teacher_topk_log_probabilities.shape != topk_token_ids.shape:
        raise RuntimeError("top-k teacher token and probability shapes differ")
    if student_logits.shape[0] != topk_token_ids.shape[0]:
        raise RuntimeError("top-k teacher and student target counts differ")
    if teacher_tail_log_probabilities.shape != (student_logits.shape[0],):
        raise RuntimeError("top-k teacher tail shape differs from target count")

    student_log_normalizer = torch.logsumexp(student_logits, dim=-1, keepdim=True)
    student_topk_log_probabilities = torch.gather(
        student_logits, dim=-1, index=topk_token_ids
    ) - student_log_normalizer
    student_topk_log_mass = torch.logsumexp(
        student_topk_log_probabilities, dim=-1
    )
    epsilon = torch.finfo(student_logits.dtype).eps
    student_topk_log_mass = torch.clamp(student_topk_log_mass, max=-epsilon)
    cutoff = -math.log(2.0)
    student_tail_log_probability = torch.where(
        student_topk_log_mass < cutoff,
        torch.log1p(-torch.exp(student_topk_log_mass)),
        torch.log(-torch.expm1(student_topk_log_mass)),
    )

    teacher_topk_log_probabilities = teacher_topk_log_probabilities.to(
        dtype=student_logits.dtype, device=student_logits.device
    )
    teacher_tail_log_probabilities = teacher_tail_log_probabilities.to(
        dtype=student_logits.dtype, device=student_logits.device
    )
    topk_terms = torch.exp(teacher_topk_log_probabilities) * (
        teacher_topk_log_probabilities - student_topk_log_probabilities
    )
    tail_terms = torch.exp(teacher_tail_log_probabilities) * (
        teacher_tail_log_probabilities - student_tail_log_probability
    )
    return (topk_terms.sum(dim=-1) + tail_terms).mean()


class TopKDistillationTrainer:
    """Own a cache-backed Trainer subclass without importing ML at verify time."""

    def __init__(
        self,
        trainer_base: Any,
        torch_module: Any,
        *,
        kl_weight: float,
        temperature: float,
        trainer_options: dict[str, Any],
    ) -> None:
        torch = torch_module
        weight = kl_weight
        distillation_temperature = temperature

        class _Trainer(trainer_base):
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                super().__init__(*args, **kwargs)
                self.model_accepts_loss_kwargs = False
                self._tinyrustlm_topk_batch_count = 0
                self._tinyrustlm_topk_sft_loss_sum = 0.0
                self._tinyrustlm_topk_kl_loss_sum = 0.0

            def compute_loss(
                self,
                model: Any,
                inputs: dict[str, Any],
                return_outputs: bool = False,
                num_items_in_batch: Any = None,
            ) -> Any:
                del num_items_in_batch
                model_inputs = dict(inputs)
                positions = model_inputs.pop("teacher_positions", None)
                position_mask = model_inputs.pop("teacher_position_mask", None)
                topk_ids = model_inputs.pop("teacher_topk_token_ids", None)
                topk_probabilities = model_inputs.pop(
                    "teacher_topk_log_probabilities", None
                )
                tail_probabilities = model_inputs.pop(
                    "teacher_tail_log_probabilities", None
                )
                if any(
                    value is None
                    for value in (
                        positions,
                        position_mask,
                        topk_ids,
                        topk_probabilities,
                        tail_probabilities,
                    )
                ):
                    raise RuntimeError(
                        "top-k distillation requires verified teacher tensors in every batch"
                    )
                outputs = model(**model_inputs)
                sft_loss = outputs.loss
                if sft_loss is None:
                    raise RuntimeError("causal language model did not return a training loss")
                active = position_mask.to(dtype=torch.bool)
                if not bool(active.any().item()):
                    raise RuntimeError("top-k distillation batch has no teacher target positions")
                batch_indices, row_indices = active.nonzero(as_tuple=True)
                active_positions = positions[batch_indices, row_indices]
                labels = model_inputs.get("labels")
                if labels is None or labels.ndim != 2:
                    raise RuntimeError("top-k distillation requires two-dimensional labels")
                if bool((labels[batch_indices, active_positions + 1] == -100).any().item()):
                    raise RuntimeError("top-k cache selected a non-assistant target position")

                student_logits = outputs.logits[
                    batch_indices, active_positions, :
                ].float() / distillation_temperature
                active_topk_ids = topk_ids[batch_indices, row_indices, :]
                active_topk_probabilities = topk_probabilities[
                    batch_indices, row_indices, :
                ]
                active_tail_probabilities = tail_probabilities[
                    batch_indices, row_indices
                ]
                kl_loss = topk_aggregate_kl(
                    torch,
                    student_logits,
                    active_topk_ids,
                    active_topk_probabilities,
                    active_tail_probabilities,
                ) * distillation_temperature * distillation_temperature
                self._tinyrustlm_topk_batch_count += 1
                self._tinyrustlm_topk_sft_loss_sum += float(
                    sft_loss.detach().float().item()
                )
                self._tinyrustlm_topk_kl_loss_sum += float(
                    kl_loss.detach().float().item()
                )
                loss = sft_loss + weight * kl_loss
                return (loss, outputs) if return_outputs else loss

        self.trainer = _Trainer(**trainer_options)


class ListDataset:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._records = records

    def __len__(self) -> int:
        return len(self._records)

    def __getitem__(self, index: int) -> dict[str, Any]:
        return self._records[index]


class CausalLmCollator:
    def __init__(self, pad_token_id: int) -> None:
        self._pad_token_id = pad_token_id

    def __call__(self, features: list[dict[str, Any]]) -> dict[str, Any]:
        import torch

        width = max(len(feature["input_ids"]) for feature in features)
        input_ids: list[list[int]] = []
        attention_masks: list[list[int]] = []
        labels: list[list[int]] = []
        for feature in features:
            padding = width - len(feature["input_ids"])
            input_ids.append(feature["input_ids"] + [self._pad_token_id] * padding)
            attention_masks.append(feature["attention_mask"] + [0] * padding)
            labels.append(feature["labels"] + [-100] * padding)
        batch = {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_masks, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }
        preservation_flags = [feature.get("preserve") for feature in features]
        if any(flag is not None for flag in preservation_flags):
            if any(flag not in {0, 1} for flag in preservation_flags):
                raise RuntimeError(
                    "preservation marker must be present and binary for every record"
                )
            batch["preserve_mask"] = torch.tensor(
                preservation_flags, dtype=torch.bool
            )
        teacher_positions = [feature.get("teacher_positions") for feature in features]
        if any(value is not None for value in teacher_positions):
            if any(value is None or not value for value in teacher_positions):
                raise RuntimeError(
                    "top-k teacher fields must be present and non-empty for every record"
                )
            topk_ids = [feature.get("teacher_topk_token_ids") for feature in features]
            topk_probabilities = [
                feature.get("teacher_topk_log_probabilities") for feature in features
            ]
            tail_probabilities = [
                feature.get("teacher_tail_log_probabilities") for feature in features
            ]
            if any(
                value is None
                for values in (topk_ids, topk_probabilities, tail_probabilities)
                for value in values
            ):
                raise RuntimeError("top-k teacher distribution fields are incomplete")
            position_width = max(len(value) for value in teacher_positions)
            top_k = len(topk_ids[0][0])
            padded_positions: list[list[int]] = []
            position_masks: list[list[bool]] = []
            padded_ids: list[list[list[int]]] = []
            padded_probabilities: list[list[list[float]]] = []
            padded_tails: list[list[float]] = []
            for positions, ids, probabilities, tails in zip(
                teacher_positions,
                topk_ids,
                topk_probabilities,
                tail_probabilities,
                strict=True,
            ):
                if not len(positions) == len(ids) == len(probabilities) == len(tails):
                    raise RuntimeError("top-k teacher distribution row counts differ")
                if any(len(row) != top_k for row in ids) or any(
                    len(row) != top_k for row in probabilities
                ):
                    raise RuntimeError("top-k teacher distribution widths differ")
                padding = position_width - len(positions)
                padded_positions.append(positions + [0] * padding)
                position_masks.append([True] * len(positions) + [False] * padding)
                padded_ids.append(ids + [[0] * top_k for _ in range(padding)])
                padded_probabilities.append(
                    probabilities + [[0.0] * top_k for _ in range(padding)]
                )
                padded_tails.append(tails + [0.0] * padding)
            batch["teacher_positions"] = torch.tensor(
                padded_positions, dtype=torch.long
            )
            batch["teacher_position_mask"] = torch.tensor(
                position_masks, dtype=torch.bool
            )
            batch["teacher_topk_token_ids"] = torch.tensor(
                padded_ids, dtype=torch.long
            )
            batch["teacher_topk_log_probabilities"] = torch.tensor(
                padded_probabilities, dtype=torch.float32
            )
            batch["teacher_tail_log_probabilities"] = torch.tensor(
                padded_tails, dtype=torch.float32
            )
        return batch


def write_training_receipt(inputs: VerifiedInputs, metrics: dict[str, Any]) -> None:
    adapter_path = inputs.output_dir / "adapter_model.safetensors"
    config_path = inputs.output_dir / "adapter_config.json"
    if not adapter_path.is_file() or not config_path.is_file():
        raise RuntimeError("PEFT training did not write adapter_model.safetensors and adapter_config.json")
    serializable_metrics = {
        key: value
        for key, value in sorted(metrics.items())
        if isinstance(value, (int, float, str, bool)) or value is None
    }
    receipt = {
        "schema": "tinyrustlm.distillation_training_receipt.v1",
        "recipe": str(inputs.recipe_path),
        "recipe_sha256": sha256_file(inputs.recipe_path),
        "frozen_dataset_manifest": str(inputs.frozen_manifest_path),
        "frozen_dataset_manifest_sha256": sha256_file(inputs.frozen_manifest_path),
        "base_model_dir": str(inputs.base_model_dir),
        "base_model_sha256": sha256_file(inputs.base_model_dir / "model.safetensors"),
        "base_tokenizer_sha256": sha256_file(inputs.base_model_dir / "tokenizer.json"),
        "dataset_id": require(inputs.frozen_manifest, "dataset_id"),
        "system_prompt_sha256": require(inputs.recipe, "system_prompt_sha256"),
        "training_engine": require(inputs.recipe, "training_engine"),
        "teacher_reasoning_policy": require(inputs.recipe, "teacher_reasoning_policy"),
        "eval_exclusion_policy": require(inputs.recipe, "eval_exclusion_policy"),
        "adapter_model_sha256": sha256_file(adapter_path),
        "adapter_config_sha256": sha256_file(config_path),
        "record_count": len(inputs.records),
        "structured_history_record_count": sum(
            bool(record.history) for record in inputs.records
        ),
        "metrics": serializable_metrics,
        "required_next_gate": "peft-to-trained-adapter-source-conversion-plus-raw-eval",
    }
    sources = preservation_source_ids(inputs.recipe)
    if sources:
        receipt["preservation"] = {
            "source_ids": sorted(sources),
            "record_count": sum(
                record.source_id in sources for record in inputs.records
            ),
            "kl_weight": parse_float(
                inputs.recipe, "preservation_kl_weight", 1e-6, 100.0
            ),
            "kl_temperature": parse_float(
                inputs.recipe, "preservation_kl_temperature", 0.1, 10.0
            ),
            "reference": "same-checkpoint-adapters-disabled",
            "mask": "assistant-target-tokens-only",
            "gradient_accumulation_contract": "trainer-normalized-custom-loss-v1",
        }
    if inputs.topk_cache is not None:
        cache = inputs.topk_cache
        receipt["topk_teacher"] = {
            "cache_manifest": str(cache.manifest_path),
            "cache_manifest_sha256": sha256_file(cache.manifest_path),
            "cache_file_sha256": require(cache.manifest, "cache_file_sha256"),
            "teacher_model_id": require(cache.manifest, "teacher_model_id"),
            "teacher_revision": require(cache.manifest, "teacher_revision"),
            "teacher_model_identity_sha256": require(
                cache.manifest, "teacher_model_identity_sha256"
            ),
            "teacher_tokenizer_sha256": require(
                cache.manifest, "teacher_tokenizer_sha256"
            ),
            "student_tokenizer_sha256": require(
                cache.manifest, "student_tokenizer_sha256"
            ),
            "top_k": cache.top_k,
            "temperature": cache.temperature,
            "kl_weight": parse_float(
                inputs.recipe, "teacher_kl_weight", 1e-6, 100.0
            ),
            "record_count": len(cache.records),
            "target_position_count": cache.target_position_count,
            "probability_contract": require(
                cache.manifest, "probability_contract"
            ),
            "mask": require(cache.manifest, "mask"),
            "gradient_accumulation_contract": "trainer-normalized-custom-loss-v1",
        }
    (inputs.output_dir / "tinyrustlm-training-receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def verification_summary(inputs: VerifiedInputs) -> dict[str, Any]:
    sources = preservation_source_ids(inputs.recipe)
    summary = {
        "status": "pass",
        "recipe_id": require(inputs.recipe, "recipe_id"),
        "record_count": len(inputs.records),
        "structured_history_record_count": sum(
            bool(record.history) for record in inputs.records
        ),
        "dataset_id": require(inputs.frozen_manifest, "dataset_id"),
        "base_model_dir": str(inputs.base_model_dir),
        "device": require(inputs.recipe, "device"),
        "dtype": require(inputs.recipe, "dtype"),
        "output_dir": str(inputs.output_dir),
        "preservation_record_count": sum(
            record.source_id in sources for record in inputs.records
        ),
    }
    if inputs.topk_cache is not None:
        summary["topk_teacher_record_count"] = len(inputs.topk_cache.records)
        summary["topk_teacher_target_count"] = inputs.topk_cache.target_position_count
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("recipe", type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    inputs = verify_recipe(
        args.recipe, allow_populated_output=args.verify_only
    )
    if args.verify_only:
        print(json.dumps(verification_summary(inputs), indent=2, sort_keys=True))
        return
    train(inputs)


if __name__ == "__main__":
    main()
