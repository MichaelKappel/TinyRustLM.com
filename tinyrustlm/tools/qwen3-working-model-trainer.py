"""Run the sole pinned Qwen3 CPU pilot after a complete training authorization."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib
import importlib.metadata
import io
import json
import math
import os
import platform
import random
import re
import shutil
import site
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from email.parser import Parser
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, Iterator, Mapping, Sequence


ENVIRONMENT_SPEC_SCHEMA = "tinyrustlm.qwen3_cpu_environment_spec.v1"
WHEELHOUSE_MANIFEST_SCHEMA = "tinyrustlm.python_wheelhouse_manifest.v1"
ENVIRONMENT_LOCK_SCHEMA = "tinyrustlm.qwen3_cpu_environment_lock.v1"
TRAINING_LOCK_SCHEMA = "tinyrustlm.cpu_pilot_training_lock.v1"
PROFILE_SCHEMA = "tinyrustlm.qwen3_working_model_profile.v1"
CURRICULUM_RECORD_SCHEMA = "tinyrustlm.behavioral_curriculum_record.v1"
ATTEMPT_OWNER_SCHEMA = "tinyrustlm.qwen3_cpu_training_attempt.v1"
CHECKPOINT_RECEIPT_SCHEMA = "tinyrustlm.qwen3_cpu_checkpoint_receipt.v1"
SEGMENT_RECEIPT_SCHEMA = "tinyrustlm.qwen3_cpu_training_segment.v1"
TRAINING_EVENT_SCHEMA = "tinyrustlm.qwen3_cpu_training_event.v1"
TRAINING_RECEIPT_SCHEMA = "tinyrustlm.qwen3_cpu_training_receipt.v1"
TERMINAL_REJECTION_SCHEMA = "tinyrustlm.qwen3_cpu_terminal_rejection.v1"
TERMINAL_ARTIFACT_RECEIPT_SCHEMA = "tinyrustlm.qwen3_cpu_terminal_artifact_receipt.v1"
INTERRUPTION_PLAN_SCHEMA = "tinyrustlm.qwen3_cpu_interruption_plan.v1"
INTERRUPTION_RECEIPT_SCHEMA = "tinyrustlm.qwen3_cpu_interruption_receipt.v1"

EXPECTED_PROFILE_ID = "qwen3-0.6b-working-model-v1"
EXPECTED_GOAL_SHA256 = (
    "sha256:92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0"
)
EXPECTED_SOURCE_REPO_ID = "Qwen/Qwen3-0.6B"
EXPECTED_SOURCE_REVISION = "c1899de289a04d12100db370d81485cdf75e47ca"
EXPECTED_SOURCE_STATUS = "terminally-rejected-as-product-model"
EXPECTED_ARCHITECTURE = "Qwen3ForCausalLM"
EXPECTED_TARGET_MODULES = {
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "up_proj",
    "down_proj",
}

MAX_JSON_BYTES = 64 * 1024 * 1024
MAX_PROFILE_BYTES = 4 * 1024 * 1024
MAX_CURRICULUM_BYTES = 4 * 1024 * 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024
MAX_WHEEL_BYTES = 2 * 1024 * 1024 * 1024
MAX_DISTRIBUTION_FILES = 1_000_000
MAX_PATH_TEXT = 32_768
MAX_PIP_OUTPUT_BYTES = 1024 * 1024
SHA256_PATTERN = re.compile(r"sha256:[0-9a-f]{64}\Z")
ID_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?\Z")
CHECKPOINT_NAME_PATTERN = re.compile(r"checkpoint-([0-9]{6})\Z")
CHECKPOINT_STAGING_PATTERN = re.compile(
    r"\.checkpoint-([0-9]{6})\.([0-9a-f]{32})\.staging\Z"
)
INTERRUPTED_CHECKPOINT_PATTERN = re.compile(
    r"checkpoint-([0-9]{6})\.([0-9a-f]{32})\.interrupted\Z"
)
CANDIDATE_STAGING_PATTERN = re.compile(r"\.candidate\.([0-9a-f]{32})\.staging\Z")
INTERRUPTED_CANDIDATE_PATTERN = re.compile(r"candidate\.([0-9a-f]{32})\.interrupted\Z")
TRAINING_EVENT_KEYS = {
    "schema",
    "global_update_step",
    "next_record_offset",
    "learning_rate",
    "sft_loss_mean",
    "preservation_kl_loss_mean",
    "total_loss_mean",
    "gradient_norm_before_clip",
    "consecutive_loss_increases",
    "peak_rss_bytes",
    "elapsed_wall_clock_seconds",
}
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_TRAINING_ISOLATION_AUDIT_INSTALLED = False

SPEC_KEYS = {
    "schema",
    "environment_id",
    "status",
    "python",
    "platform",
    "runtime",
    "training_algorithm",
    "required_environment",
    "required_distributions",
    "forbidden_distributions",
    "capture_policy",
}
SPEC_PYTHON_KEYS = {"implementation", "version", "cache_tag", "pointer_bits"}
SPEC_PLATFORM_KEYS = {"system", "machine"}
SPEC_RUNTIME_KEYS = {
    "device",
    "parameter_dtype",
    "compute_dtype",
    "intraop_threads",
    "interop_threads",
    "deterministic_algorithms",
    "deterministic_warn_only",
    "matmul_precision",
    "mkldnn_enabled",
    "network_access",
    "user_site_packages",
}
SPEC_ALGORITHM_KEYS = {
    "optimizer",
    "adam_beta1",
    "adam_beta2",
    "adam_epsilon",
    "scheduler",
    "preservation_kl_temperature",
    "sequence_overflow",
    "sequence_packing",
    "gradient_checkpointing",
    "checkpoint_state",
    "resume_policy",
}
SPEC_DISTRIBUTION_KEYS = {
    "name",
    "version",
    "wheel_filename",
    "wheel_bytes",
    "wheel_sha256",
}
SPEC_CAPTURE_KEYS = {
    "clean_virtual_environment_required",
    "system_site_packages",
    "editable_installs",
    "unowned_distributions",
    "distribution_file_hashes",
    "wheelhouse_manifest_required",
    "pip_check_required",
    "training_authority",
}
EXPECTED_RUNTIME = {
    "device": "cpu",
    "parameter_dtype": "float32",
    "compute_dtype": "float32",
    "intraop_threads": 8,
    "interop_threads": 1,
    "deterministic_algorithms": True,
    "deterministic_warn_only": False,
    "matmul_precision": "highest",
    "mkldnn_enabled": True,
    "network_access": "forbidden",
    "user_site_packages": "forbidden",
}
EXPECTED_ALGORITHM = {
    "optimizer": "torch-adamw-v1",
    "adam_beta1": 0.9,
    "adam_beta2": 0.999,
    "adam_epsilon": 1e-8,
    "scheduler": "linear-warmup-then-linear-decay-positive-final-update-v1",
    "preservation_kl_temperature": 1.0,
    "sequence_overflow": "reject-record-no-truncation",
    "sequence_packing": False,
    "gradient_checkpointing": False,
    "checkpoint_state": "safe-adapter-plus-weights-only-optimizer-state",
    "resume_policy": "explicit-complete-checkpoint-only",
}
EXPECTED_ENVIRONMENT = {
    "CUDA_VISIBLE_DEVICES": "",
    "HF_DATASETS_OFFLINE": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1",
    "HF_HUB_OFFLINE": "1",
    "MKL_NUM_THREADS": "8",
    "OMP_NUM_THREADS": "8",
    "PYTHONNOUSERSITE": "1",
    "TOKENIZERS_PARALLELISM": "false",
    "TRANSFORMERS_OFFLINE": "1",
    "WANDB_DISABLED": "true",
}
EXPECTED_CAPTURE_POLICY = {
    "clean_virtual_environment_required": True,
    "system_site_packages": False,
    "editable_installs": False,
    "unowned_distributions": False,
    "distribution_file_hashes": True,
    "wheelhouse_manifest_required": True,
    "pip_check_required": True,
    "training_authority": False,
}
EXPECTED_REQUIRED_ARTIFACTS = {
    "accelerate": {
        "version": "1.14.0",
        "wheel_filename": "accelerate-1.14.0-py3-none-any.whl",
        "wheel_bytes": 389246,
        "wheel_sha256": "sha256:e94390c2863b873be18f623f9df48a0d8fe5eff13ea7f1a00092b0a7904888c6",
    },
    "huggingface-hub": {
        "version": "1.28.0",
        "wheel_filename": "huggingface_hub-1.28.0-py3-none-any.whl",
        "wheel_bytes": 793202,
        "wheel_sha256": "sha256:58a8bacb03072edfc38067065e9dc24bbb34805410fcd36a1632de0b329660bb",
    },
    "numpy": {
        "version": "2.5.2",
        "wheel_filename": "numpy-2.5.2-cp312-cp312-win_amd64.whl",
        "wheel_bytes": 12464674,
        "wheel_sha256": "sha256:28ac63476ec7651484215ee7fa15a1f78b57c14621f01e392afe17b9a1390ce4",
    },
    "peft": {
        "version": "0.20.0",
        "wheel_filename": "peft-0.20.0-py3-none-any.whl",
        "wheel_bytes": 775777,
        "wheel_sha256": "sha256:0fbba16ffebfad3de96e06f2da6860fd860292324b85b6141909fa1e26ea9233",
    },
    "pip": {
        "version": "26.2.1",
        "wheel_filename": "pip-26.2.1-py3-none-any.whl",
        "wheel_bytes": 1816632,
        "wheel_sha256": "sha256:71138adf1f4ca900cdb7d289c21b7494329f2332b6d85f0e1c42108c0384ed3e",
    },
    "safetensors": {
        "version": "0.8.0",
        "wheel_filename": "safetensors-0.8.0-cp310-abi3-win_amd64.whl",
        "wheel_bytes": 355540,
        "wheel_sha256": "sha256:096ec1a98435df7beb08853bb5aa9081a84f23d0adc67ed1a0a10550f608373f",
    },
    "setuptools": {
        "version": "84.0.0",
        "wheel_filename": "setuptools-84.0.0-py3-none-any.whl",
        "wheel_bytes": 818216,
        "wheel_sha256": "sha256:51a52592b3b99e102b609654876bd65f19f999935166d1352678931132b0c670",
    },
    "tokenizers": {
        "version": "0.22.2",
        "wheel_filename": "tokenizers-0.22.2-cp39-abi3-win_amd64.whl",
        "wheel_bytes": 2747786,
        "wheel_sha256": "sha256:c9ea31edff2968b44a88f97d784c2f16dc0729b8b143ed004699ebca91f05c48",
    },
    "torch": {
        "version": "2.13.0",
        "wheel_filename": "torch-2.13.0-cp312-cp312-win_amd64.whl",
        "wheel_bytes": 122057313,
        "wheel_sha256": "sha256:024c6cc0c1b085f2f91f20a3dc27b0471d021c31ce84b81be3afdc39f791fd9d",
    },
    "transformers": {
        "version": "5.14.1",
        "wheel_filename": "transformers-5.14.1-py3-none-any.whl",
        "wheel_bytes": 11625234,
        "wheel_sha256": "sha256:9db974c4079ede2d1a3ea7ca5a240df33f2cc26fc2b36ba64c5f2a4f43b6e725",
    },
}
EXPECTED_REQUIRED_DISTRIBUTIONS = {
    name: value["version"] for name, value in EXPECTED_REQUIRED_ARTIFACTS.items()
}
EXPECTED_RUNTIME_VERSIONS = {
    **{
        name: version
        for name, version in EXPECTED_REQUIRED_DISTRIBUTIONS.items()
        if name
        in {
            "accelerate",
            "huggingface-hub",
            "numpy",
            "peft",
            "safetensors",
            "tokenizers",
            "transformers",
        }
    },
    "torch": "2.13.0+cpu",
}
EXPECTED_FORBIDDEN_DISTRIBUTIONS = {
    "bitsandbytes",
    "deepspeed",
    "tensorflow",
    "torchao",
    "torchvision",
    "wandb",
}

WHEELHOUSE_MANIFEST_KEYS = {
    "schema",
    "status",
    "environment_spec_sha256",
    "wheelhouse_root",
    "python_tag",
    "platform_tag",
    "artifact_count",
    "artifact_set_sha256",
    "artifacts",
    "contains_source_distributions",
    "training_authority",
}
WHEEL_ARTIFACT_KEYS = {
    "distribution_name",
    "version",
    "filename",
    "bytes",
    "sha256",
}
ENVIRONMENT_LOCK_KEYS = {
    "schema",
    "status",
    "environment_id",
    "profile_id",
    "profile_sha256",
    "training_program",
    "environment_spec",
    "wheelhouse_manifest",
    "wheelhouse_artifact_set_sha256",
    "python",
    "platform",
    "cpu",
    "required_environment",
    "distributions",
    "distribution_set_sha256",
    "runtime_probe",
    "pip_check_sha256",
    "created_utc",
    "contains_credentials",
    "training_authority",
}
ENVIRONMENT_PYTHON_KEYS = {
    "implementation",
    "version",
    "cache_tag",
    "pointer_bits",
    "executable",
    "prefix",
    "base_prefix",
    "pyvenv_config",
    "isolated_virtual_environment",
    "system_site_packages",
    "user_site_enabled",
}
ENVIRONMENT_PLATFORM_KEYS = {"system", "release", "version", "machine"}
ENVIRONMENT_CPU_KEYS = {"processor", "logical_processor_count"}
ENVIRONMENT_DISTRIBUTION_KEYS = {
    "name",
    "version",
    "installer",
    "file_count",
    "total_bytes",
    "file_set_sha256",
    "metadata_sha256",
    "direct_url_sha256",
}
RUNTIME_PROBE_KEYS = {
    "versions",
    "device",
    "torch_cuda_build",
    "cuda_available",
    "cuda_device_count",
    "default_dtype",
    "deterministic_algorithms",
    "deterministic_warn_only",
    "intraop_threads",
    "interop_threads",
    "matmul_precision",
    "mkldnn_enabled",
}
FILE_IDENTITY_KEYS = {"bytes", "sha256"}

TRAINING_LOCK_KEYS = {
    "schema",
    "status",
    "authorized_operation",
    "lock_id",
    "profile_id",
    "profile_sha256",
    "goal_sha256",
    "source_repo_id",
    "source_revision",
    "source_status",
    "source_artifacts",
    "curriculum",
    "curriculum_audit",
    "review_manifest",
    "review_evidence",
    "holdout_receipt",
    "exclusion_index",
    "semantic_receipt",
    "tombstone_lineage",
    "environment_lock",
    "training_program",
    "output_root",
    "training",
    "stop_rules",
    "checkpoint_selection",
    "raw_output_preservation_required",
    "retry_selection_forbidden",
    "response_repair_forbidden",
}
TRAINING_KEYS = {
    "method",
    "device",
    "parameter_dtype",
    "compute_dtype",
    "lora_rank",
    "lora_alpha",
    "lora_dropout",
    "target_modules",
    "learning_rate",
    "epochs",
    "maximum_sequence_tokens",
    "micro_batch_size",
    "gradient_accumulation_steps",
    "effective_batch_size",
    "warmup_steps",
    "weight_decay",
    "gradient_clip_norm",
    "preservation_kl_weight",
    "training_seed",
    "shuffle_seed",
    "checkpoint_interval_steps",
    "eligible_checkpoint",
}
STOP_RULE_KEYS = {
    "nonfinite_loss",
    "maximum_consecutive_loss_increases",
    "maximum_wall_clock_seconds",
    "maximum_peak_rss_bytes",
    "minimum_pilot_behavior_pass_rate",
    "minimum_preservation_pass_rate",
    "maximum_ordinary_helpfulness_regression_rate",
    "failed_adapter_disposition",
    "retry_requirement",
}
CURRICULUM_RECORD_KEYS = {
    "schema",
    "record_id",
    "task_family",
    "template_family_id",
    "scenario_factors",
    "entities",
    "messages",
    "response",
    "disposition",
    "source_provenance",
    "teacher_generation",
    "review",
}


@dataclass(frozen=True)
class FileIdentity:
    bytes: int
    sha256: str

    def json_value(self) -> dict[str, Any]:
        return {"bytes": self.bytes, "sha256": self.sha256}


@dataclass(frozen=True)
class EnvironmentSpecification:
    path: Path
    identity: FileIdentity
    raw: dict[str, Any]
    required_distributions: dict[str, dict[str, Any]]


@dataclass(frozen=True)
class CurriculumRecord:
    record_id: str
    task_family: str
    messages: tuple[dict[str, str], ...]
    response: str


@dataclass(frozen=True)
class VerifiedTrainingInputs:
    profile_path: Path
    profile_identity: FileIdentity
    profile: dict[str, Any]
    training_lock_path: Path
    training_lock_identity: FileIdentity
    training_lock: dict[str, Any]
    environment_lock_path: Path
    environment_lock_identity: FileIdentity
    environment_lock: dict[str, Any]
    environment_spec: EnvironmentSpecification
    wheelhouse_manifest_path: Path
    source_root: Path
    curriculum_path: Path
    curriculum_identity: FileIdentity
    records: tuple[CurriculumRecord, ...]
    record_order_sha256: str
    output_root: Path


@dataclass(frozen=True)
class CheckpointState:
    directory: Path
    receipt: dict[str, Any]
    receipt_identity: FileIdentity


class TerminalStop(RuntimeError):
    def __init__(self, reason_code: str, message: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=True,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("ascii")


def json_document_bytes(value: Any) -> bytes:
    return (
        json.dumps(
            value, ensure_ascii=True, allow_nan=False, sort_keys=True, indent=2
        ).encode("ascii")
        + b"\n"
    )


def sha256_bytes(payload: bytes) -> str:
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def sha256_stream(stream: BinaryIO) -> str:
    digest = hashlib.sha256()
    while chunk := stream.read(8 * 1024 * 1024):
        digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def sha256_file(path: Path) -> str:
    with path.open("rb") as stream:
        return sha256_stream(stream)


def file_identity(path: Path, maximum: int | None = None) -> FileIdentity:
    size = verify_regular_file(path, maximum, str(path))
    return FileIdentity(size, sha256_file(path))


def program_identity() -> FileIdentity:
    return file_identity(Path(__file__).resolve(), MAX_JSON_BYTES)


def require_exact_keys(
    value: Mapping[str, Any], expected: set[str], label: str
) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ValueError(
            f"{label} keys are not exact; missing={missing}; extra={extra}"
        )


def require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def require_array(value: Any, label: str, minimum: int, maximum: int) -> list[Any]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise ValueError(f"{label} must contain {minimum}..={maximum} values")
    return value


def require_string(
    value: Any,
    label: str,
    *,
    minimum: int = 1,
    maximum: int = MAX_PATH_TEXT,
    pattern: re.Pattern[str] | None = None,
) -> str:
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        raise ValueError(
            f"{label} must be a string with {minimum}..={maximum} characters"
        )
    if pattern is not None and pattern.fullmatch(value) is None:
        raise ValueError(f"{label} has an invalid format")
    return value


def require_bool(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{label} must be a boolean")
    return value


def require_integer(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    if not minimum <= value <= maximum:
        raise ValueError(f"{label} must be in {minimum}..={maximum}")
    return value


def require_number(value: Any, label: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be numeric")
    result = float(value)
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ValueError(f"{label} must be finite and in {minimum}..={maximum}")
    return result


def require_sha256(value: Any, label: str) -> str:
    return require_string(value, label, minimum=71, maximum=71, pattern=SHA256_PATTERN)


def require_id(value: Any, label: str) -> str:
    return require_string(value, label, maximum=128, pattern=ID_PATTERN)


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key {key!r}")
        result[key] = value
    return result


def read_json_object(path: Path, maximum: int, label: str) -> dict[str, Any]:
    payload = read_regular_bytes(path, maximum, label)
    try:
        value = json.loads(payload, object_pairs_hook=_reject_duplicate_keys)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is not canonical UTF-8 JSON") from error
    return require_object(value, label)


def iter_json_lines(path: Path, maximum: int, label: str) -> Iterator[dict[str, Any]]:
    size = verify_regular_file(path, maximum, label)
    consumed = 0
    with path.open("rb") as stream:
        for line_number, raw_line in enumerate(stream, 1):
            consumed += len(raw_line)
            if len(raw_line) > MAX_RECORD_BYTES:
                raise ValueError(f"{label} line {line_number} exceeds the record bound")
            if not raw_line.strip():
                raise ValueError(f"{label} line {line_number} is empty")
            try:
                value = json.loads(raw_line, object_pairs_hook=_reject_duplicate_keys)
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ValueError(
                    f"{label} line {line_number} is invalid JSON"
                ) from error
            yield require_object(value, f"{label} line {line_number}")
    if consumed != size:
        raise ValueError(f"{label} changed while it was read")


def read_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    size = verify_regular_file(path, maximum, label)
    payload = path.read_bytes()
    if len(payload) != size:
        raise ValueError(f"{label} changed while it was read")
    return payload


def _is_reparse(path: Path) -> bool:
    try:
        stat = path.lstat()
    except FileNotFoundError:
        return False
    attributes = getattr(stat, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return path.is_symlink() or bool(attributes & reparse_flag)


def reject_reparse_chain(path: Path, label: str, *, include_leaf: bool = True) -> None:
    absolute = path.absolute()
    parts = absolute.parts if include_leaf else absolute.parts[:-1]
    current = Path(parts[0])
    for part in parts[1:]:
        current /= part
        if current.exists() and _is_reparse(current):
            raise ValueError(f"{label} crosses a symlink or reparse point")


def verify_regular_file(
    path: Path, maximum: int | None, label: str, *, allow_empty: bool = False
) -> int:
    reject_reparse_chain(path, label)
    if not path.is_file():
        raise ValueError(f"{label} must be a regular file")
    size = path.stat().st_size
    if size < 0 or (size == 0 and not allow_empty):
        raise ValueError(f"{label} must not be empty")
    if maximum is not None and size > maximum:
        raise ValueError(f"{label} exceeds its byte bound")
    return size


def require_allowed_drive(path: Path, label: str) -> Path:
    if not path.is_absolute():
        raise ValueError(f"{label} must be absolute")
    drive = path.drive.upper()
    if drive not in {"C:", "E:"}:
        raise ValueError(f"{label} must be on C: or E:")
    return path


def require_external_path(path: Path, label: str, *, must_exist: bool = True) -> Path:
    require_allowed_drive(path, label)
    reject_reparse_chain(path, label, include_leaf=must_exist)
    resolved = path.resolve(strict=must_exist)
    try:
        resolved.relative_to(REPOSITORY_ROOT)
    except ValueError:
        return resolved
    raise ValueError(f"{label} must be outside the Git worktree")


def _fsync_directory(path: Path) -> None:
    try:
        descriptor = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    except OSError:
        pass
    finally:
        os.close(descriptor)


def write_new_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    reject_reparse_chain(path.parent, "atomic output parent")
    if path.exists():
        raise FileExistsError(f"refusing to overwrite {path}")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".staging", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.rename(temporary, path)
        _fsync_directory(path.parent)
    except BaseException:
        with contextlib.suppress(FileNotFoundError):
            temporary.unlink()
        raise


def normalize_distribution_name(value: str) -> str:
    normalized = re.sub(r"[-_.]+", "-", value).lower()
    if (
        not normalized
        or re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", normalized) is None
    ):
        raise ValueError(f"invalid distribution name {value!r}")
    return normalized


def load_environment_spec(path: Path) -> EnvironmentSpecification:
    path = path.resolve(strict=True)
    identity = file_identity(path, MAX_PROFILE_BYTES)
    raw = read_json_object(path, MAX_PROFILE_BYTES, "CPU environment specification")
    require_exact_keys(raw, SPEC_KEYS, "CPU environment specification")
    if raw["schema"] != ENVIRONMENT_SPEC_SCHEMA or raw["status"] != "locked":
        raise ValueError("CPU environment specification must be the locked v1 schema")
    if raw["environment_id"] != "qwen3-0.6b-cpu-pilot-win-amd64-v1":
        raise ValueError("CPU environment specification id drifted")

    python_value = require_object(raw["python"], "CPU environment specification python")
    require_exact_keys(
        python_value, SPEC_PYTHON_KEYS, "CPU environment specification python"
    )
    expected_python = {
        "implementation": "CPython",
        "version": "3.12.10",
        "cache_tag": "cpython-312",
        "pointer_bits": 64,
    }
    if python_value != expected_python:
        raise ValueError("CPU environment Python contract drifted")
    platform_value = require_object(
        raw["platform"], "CPU environment specification platform"
    )
    require_exact_keys(
        platform_value, SPEC_PLATFORM_KEYS, "CPU environment specification platform"
    )
    if platform_value != {"system": "Windows", "machine": "AMD64"}:
        raise ValueError("CPU environment platform contract drifted")
    runtime = require_object(raw["runtime"], "CPU environment specification runtime")
    require_exact_keys(
        runtime, SPEC_RUNTIME_KEYS, "CPU environment specification runtime"
    )
    if runtime != EXPECTED_RUNTIME:
        raise ValueError("CPU environment runtime contract drifted")
    algorithm = require_object(
        raw["training_algorithm"], "CPU environment specification training_algorithm"
    )
    require_exact_keys(
        algorithm,
        SPEC_ALGORITHM_KEYS,
        "CPU environment specification training_algorithm",
    )
    if algorithm != EXPECTED_ALGORITHM:
        raise ValueError("CPU training algorithm contract drifted")
    environment = require_object(
        raw["required_environment"],
        "CPU environment specification required_environment",
    )
    if environment != EXPECTED_ENVIRONMENT:
        raise ValueError("CPU environment variables drifted")
    if raw["capture_policy"] != EXPECTED_CAPTURE_POLICY:
        raise ValueError("CPU environment capture policy drifted")

    distribution_values = require_array(
        raw["required_distributions"],
        "CPU environment specification required_distributions",
        len(EXPECTED_REQUIRED_DISTRIBUTIONS),
        len(EXPECTED_REQUIRED_DISTRIBUTIONS),
    )
    required: dict[str, dict[str, Any]] = {}
    for index, item_value in enumerate(distribution_values):
        item = require_object(item_value, f"required_distributions[{index}]")
        require_exact_keys(
            item, SPEC_DISTRIBUTION_KEYS, f"required_distributions[{index}]"
        )
        name = normalize_distribution_name(
            require_string(item["name"], f"required_distributions[{index}].name")
        )
        version = require_string(
            item["version"], f"required_distributions[{index}].version", maximum=128
        )
        require_string(
            item["wheel_filename"],
            f"required_distributions[{index}].wheel_filename",
            maximum=512,
        )
        require_integer(
            item["wheel_bytes"],
            f"required_distributions[{index}].wheel_bytes",
            1,
            MAX_WHEEL_BYTES,
        )
        require_sha256(
            item["wheel_sha256"], f"required_distributions[{index}].wheel_sha256"
        )
        if name in required:
            raise ValueError("required distribution names must be unique")
        required[name] = item
        if EXPECTED_REQUIRED_ARTIFACTS.get(name) != {
            "version": version,
            "wheel_filename": item["wheel_filename"],
            "wheel_bytes": item["wheel_bytes"],
            "wheel_sha256": item["wheel_sha256"],
        }:
            raise ValueError(f"required distribution {name} artifact drifted")
    if set(required) != set(EXPECTED_REQUIRED_DISTRIBUTIONS):
        raise ValueError("required distribution set drifted")
    if [
        normalize_distribution_name(item["name"]) for item in distribution_values
    ] != sorted(required):
        raise ValueError("required distributions must be sorted by normalized name")
    forbidden_values = require_array(
        raw["forbidden_distributions"], "forbidden_distributions", 1, 128
    )
    forbidden = [
        normalize_distribution_name(require_string(value, "forbidden distribution"))
        for value in forbidden_values
    ]
    if forbidden != sorted(EXPECTED_FORBIDDEN_DISTRIBUTIONS):
        raise ValueError("forbidden distribution set or order drifted")
    return EnvironmentSpecification(path, identity, raw, required)


def _safe_wheel_entries(archive: zipfile.ZipFile, label: str) -> list[zipfile.ZipInfo]:
    entries = archive.infolist()
    if not entries or len(entries) > MAX_DISTRIBUTION_FILES:
        raise ValueError(f"{label} has an invalid entry count")
    for entry in entries:
        path = PurePosixPath(entry.filename)
        if path.is_absolute() or ".." in path.parts or "\\" in entry.filename:
            raise ValueError(f"{label} contains an unsafe archive path")
        if entry.file_size < 0 or entry.file_size > MAX_WHEEL_BYTES:
            raise ValueError(f"{label} contains an oversized entry")
    return entries


def read_wheel_identity(path: Path) -> dict[str, Any]:
    size = verify_regular_file(path, MAX_WHEEL_BYTES, f"wheel {path.name}")
    if path.suffix.lower() != ".whl" or path.name != Path(path.name).name:
        raise ValueError("wheel filename is invalid")
    try:
        with zipfile.ZipFile(path) as archive:
            entries = _safe_wheel_entries(archive, f"wheel {path.name}")
            metadata_entries = [
                entry
                for entry in entries
                if re.fullmatch(r"[^/]+\.dist-info/METADATA", entry.filename)
            ]
            if len(metadata_entries) != 1:
                raise ValueError(
                    "wheel must contain exactly one dist-info METADATA file"
                )
            metadata_bytes = archive.read(metadata_entries[0])
    except zipfile.BadZipFile as error:
        raise ValueError(f"wheel {path.name} is not a valid ZIP archive") from error
    if len(metadata_bytes) > MAX_JSON_BYTES:
        raise ValueError("wheel METADATA exceeds its byte bound")
    try:
        metadata = Parser().parsestr(metadata_bytes.decode("utf-8"))
    except UnicodeDecodeError as error:
        raise ValueError("wheel METADATA must be UTF-8") from error
    name = normalize_distribution_name(
        require_string(metadata.get("Name"), "wheel distribution name", maximum=256)
    )
    version = require_string(
        metadata.get("Version"), "wheel distribution version", maximum=128
    )
    return {
        "distribution_name": name,
        "version": version,
        "filename": path.name,
        "bytes": size,
        "sha256": sha256_file(path),
    }


def wheel_artifact_set_sha256(artifacts: Sequence[Mapping[str, Any]]) -> str:
    return sha256_bytes(canonical_json_bytes(list(artifacts)))


def seal_wheelhouse(
    specification: EnvironmentSpecification,
    wheelhouse_root: Path,
    output_path: Path,
) -> dict[str, Any]:
    wheelhouse_root = require_external_path(wheelhouse_root, "wheelhouse root")
    if not wheelhouse_root.is_dir():
        raise ValueError("wheelhouse root must be a directory")
    output_path = require_external_path(
        output_path, "wheelhouse manifest output", must_exist=False
    )
    if output_path.parent.resolve(strict=True) == wheelhouse_root:
        raise ValueError(
            "wheelhouse manifest must be outside the immutable wheel directory"
        )
    entries = list(wheelhouse_root.iterdir())
    if not entries:
        raise ValueError("wheelhouse is empty")
    if any(
        not entry.is_file() or _is_reparse(entry) or entry.suffix.lower() != ".whl"
        for entry in entries
    ):
        raise ValueError("wheelhouse must contain only direct regular .whl files")
    artifacts = sorted(
        (read_wheel_identity(entry) for entry in entries),
        key=lambda value: (
            value["distribution_name"],
            value["version"],
            value["filename"],
        ),
    )
    names: set[str] = set()
    for artifact in artifacts:
        name = artifact["distribution_name"]
        if name in names:
            raise ValueError(f"wheelhouse contains multiple artifacts for {name}")
        names.add(name)
    for name, expected in specification.required_distributions.items():
        matching = [
            artifact for artifact in artifacts if artifact["distribution_name"] == name
        ]
        if len(matching) != 1:
            raise ValueError(
                f"wheelhouse must contain exactly one required {name} wheel"
            )
        artifact = matching[0]
        if artifact != {
            "distribution_name": name,
            "version": expected["version"],
            "filename": expected["wheel_filename"],
            "bytes": expected["wheel_bytes"],
            "sha256": expected["wheel_sha256"],
        }:
            raise ValueError(
                f"wheelhouse required artifact {name} drifted from the specification"
            )
    if names & EXPECTED_FORBIDDEN_DISTRIBUTIONS:
        raise ValueError("wheelhouse contains a forbidden distribution")
    manifest = {
        "schema": WHEELHOUSE_MANIFEST_SCHEMA,
        "status": "sealed",
        "environment_spec_sha256": specification.identity.sha256,
        "wheelhouse_root": str(wheelhouse_root),
        "python_tag": "cp312",
        "platform_tag": "win_amd64",
        "artifact_count": len(artifacts),
        "artifact_set_sha256": wheel_artifact_set_sha256(artifacts),
        "artifacts": artifacts,
        "contains_source_distributions": False,
        "training_authority": False,
    }
    write_new_atomic(output_path, json_document_bytes(manifest))
    return manifest


def load_wheelhouse_manifest(
    specification: EnvironmentSpecification, path: Path, *, rehash_wheels: bool
) -> tuple[dict[str, Any], FileIdentity]:
    path = require_external_path(path, "wheelhouse manifest")
    identity = file_identity(path, MAX_JSON_BYTES)
    manifest = read_json_object(path, MAX_JSON_BYTES, "wheelhouse manifest")
    require_exact_keys(manifest, WHEELHOUSE_MANIFEST_KEYS, "wheelhouse manifest")
    if (
        manifest["schema"] != WHEELHOUSE_MANIFEST_SCHEMA
        or manifest["status"] != "sealed"
    ):
        raise ValueError("wheelhouse manifest must be sealed v1 evidence")
    if manifest["environment_spec_sha256"] != specification.identity.sha256:
        raise ValueError("wheelhouse manifest environment specification drifted")
    if manifest["python_tag"] != "cp312" or manifest["platform_tag"] != "win_amd64":
        raise ValueError("wheelhouse target tags drifted")
    if (
        manifest["contains_source_distributions"] is not False
        or manifest["training_authority"] is not False
    ):
        raise ValueError("wheelhouse manifest contains a forbidden claim")
    wheelhouse_root = require_external_path(
        Path(require_string(manifest["wheelhouse_root"], "wheelhouse root")),
        "wheelhouse root",
    )
    if not wheelhouse_root.is_dir():
        raise ValueError("wheelhouse root is not a directory")
    artifact_values = require_array(
        manifest["artifacts"], "wheelhouse artifacts", 1, 10_000
    )
    artifacts: list[dict[str, Any]] = []
    names: set[str] = set()
    for index, raw_artifact in enumerate(artifact_values):
        artifact = require_object(raw_artifact, f"wheelhouse artifacts[{index}]")
        require_exact_keys(
            artifact, WHEEL_ARTIFACT_KEYS, f"wheelhouse artifacts[{index}]"
        )
        name = normalize_distribution_name(
            require_string(artifact["distribution_name"], "wheel artifact name")
        )
        require_string(artifact["version"], "wheel artifact version", maximum=128)
        filename = require_string(
            artifact["filename"], "wheel artifact filename", maximum=512
        )
        if filename != Path(filename).name or not filename.endswith(".whl"):
            raise ValueError("wheel artifact filename is unsafe")
        require_integer(artifact["bytes"], "wheel artifact bytes", 1, MAX_WHEEL_BYTES)
        require_sha256(artifact["sha256"], "wheel artifact SHA-256")
        if name != artifact["distribution_name"] or name in names:
            raise ValueError("wheel artifact names must be normalized and unique")
        names.add(name)
        artifacts.append(dict(artifact))
        if rehash_wheels:
            actual = read_wheel_identity(wheelhouse_root / filename)
            if actual != artifact:
                raise ValueError(f"wheel artifact {filename} changed after sealing")
    expected_order = sorted(
        artifacts,
        key=lambda value: (
            value["distribution_name"],
            value["version"],
            value["filename"],
        ),
    )
    if artifacts != expected_order:
        raise ValueError("wheelhouse artifacts are not canonically ordered")
    if manifest["artifact_count"] != len(artifacts):
        raise ValueError("wheelhouse artifact count drifted")
    if manifest["artifact_set_sha256"] != wheel_artifact_set_sha256(artifacts):
        raise ValueError("wheelhouse artifact set SHA-256 drifted")
    for name, expected in specification.required_distributions.items():
        matching = [
            artifact for artifact in artifacts if artifact["distribution_name"] == name
        ]
        if len(matching) != 1 or matching[0]["version"] != expected["version"]:
            raise ValueError(f"wheelhouse does not bind required distribution {name}")
    if names & EXPECTED_FORBIDDEN_DISTRIBUTIONS:
        raise ValueError("wheelhouse contains a forbidden distribution")
    return manifest, identity


def _distribution_file_identity(
    distribution: importlib.metadata.Distribution,
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    environment_prefix = Path(sys.prefix).resolve(strict=True)
    for package_path in distribution.files or ():
        reported = str(package_path).replace("\\", "/")
        if reported.endswith(".pyc") or "/__pycache__/" in f"/{reported}":
            continue
        if PurePosixPath(reported).is_absolute():
            raise ValueError("installed distribution reports an absolute file path")
        absolute = Path(distribution.locate_file(package_path)).resolve(strict=True)
        try:
            relative = absolute.relative_to(environment_prefix).as_posix()
        except ValueError as error:
            raise ValueError(
                "installed distribution file resolves outside the virtual environment"
            ) from error
        if not absolute.exists():
            raise ValueError(f"installed distribution file {reported} is missing")
        if absolute.is_dir():
            continue
        size = verify_regular_file(
            absolute,
            None,
            f"installed distribution file {relative}",
            allow_empty=True,
        )
        entries.append(
            {"path": relative, "bytes": size, "sha256": sha256_file(absolute)}
        )
        if len(entries) > MAX_DISTRIBUTION_FILES:
            raise ValueError("installed distribution file count exceeds its bound")
    entries.sort(key=lambda item: item["path"])
    if not entries:
        raise ValueError("installed distribution has no verifiable files")
    metadata_text = distribution.read_text("METADATA")
    if metadata_text is None:
        raise ValueError("installed distribution has no METADATA")
    direct_url_text = distribution.read_text("direct_url.json")
    if direct_url_text is not None:
        try:
            direct_url = json.loads(
                direct_url_text, object_pairs_hook=_reject_duplicate_keys
            )
        except json.JSONDecodeError as error:
            raise ValueError("installed direct_url.json is invalid") from error
        if (
            require_object(direct_url, "installed direct_url")
            .get("dir_info", {})
            .get("editable")
            is True
        ):
            raise ValueError("editable distributions are forbidden")
        raise ValueError("direct URL, VCS, and local-path distributions are forbidden")
    installer = (distribution.read_text("INSTALLER") or "").strip()
    if installer != "pip":
        raise ValueError(
            "every installed distribution must record pip as its installer"
        )
    name = normalize_distribution_name(distribution.metadata["Name"])
    version = require_string(
        distribution.version, f"installed {name} version", maximum=128
    )
    return {
        "name": name,
        "version": version,
        "installer": installer,
        "file_count": len(entries),
        "total_bytes": sum(item["bytes"] for item in entries),
        "file_set_sha256": sha256_bytes(canonical_json_bytes(entries)),
        "metadata_sha256": sha256_bytes(metadata_text.encode("utf-8")),
        "direct_url_sha256": None,
    }


def installed_distribution_identities() -> list[dict[str, Any]]:
    values = [
        _distribution_file_identity(distribution)
        for distribution in importlib.metadata.distributions()
    ]
    values.sort(key=lambda item: item["name"])
    names = [item["name"] for item in values]
    if len(names) != len(set(names)):
        raise ValueError("active environment contains duplicate distribution names")
    if set(names) & EXPECTED_FORBIDDEN_DISTRIBUTIONS:
        raise ValueError("active environment contains a forbidden distribution")
    for name, version in EXPECTED_REQUIRED_DISTRIBUTIONS.items():
        matches = [item for item in values if item["name"] == name]
        if len(matches) != 1 or matches[0]["version"] != version:
            raise ValueError(
                f"active environment must contain exactly {name}=={version}"
            )
    return values


def distribution_set_sha256(distributions: Sequence[Mapping[str, Any]]) -> str:
    return sha256_bytes(canonical_json_bytes(list(distributions)))


def _venv_config_path() -> Path:
    candidate = Path(sys.prefix) / "pyvenv.cfg"
    verify_regular_file(candidate, MAX_JSON_BYTES, "pyvenv.cfg")
    return candidate.resolve()


def _parse_system_site_packages(path: Path) -> bool:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        values[key.strip().lower()] = value.strip().lower()
    if values.get("include-system-site-packages") not in {"true", "false"}:
        raise ValueError("pyvenv.cfg does not declare include-system-site-packages")
    return values["include-system-site-packages"] == "true"


def active_python_identity(specification: EnvironmentSpecification) -> dict[str, Any]:
    expected = specification.raw["python"]
    executable = Path(sys.executable).resolve(strict=True)
    require_allowed_drive(executable, "Python executable")
    pyvenv = _venv_config_path()
    isolated = Path(sys.prefix).resolve() != Path(sys.base_prefix).resolve()
    system_site = _parse_system_site_packages(pyvenv)
    value = {
        "implementation": platform.python_implementation(),
        "version": platform.python_version(),
        "cache_tag": sys.implementation.cache_tag,
        "pointer_bits": 64 if sys.maxsize > 2**32 else 32,
        "executable": {
            "path": str(executable),
            **file_identity(executable).json_value(),
        },
        "prefix": str(Path(sys.prefix).resolve()),
        "base_prefix": str(Path(sys.base_prefix).resolve()),
        "pyvenv_config": {
            "path": str(pyvenv),
            **file_identity(pyvenv, MAX_JSON_BYTES).json_value(),
        },
        "isolated_virtual_environment": isolated,
        "system_site_packages": system_site,
        "user_site_enabled": bool(site.ENABLE_USER_SITE),
    }
    for key in ("implementation", "version", "cache_tag", "pointer_bits"):
        if value[key] != expected[key]:
            raise ValueError(
                f"active Python {key} drifted from the environment specification"
            )
    if not isolated or system_site or value["user_site_enabled"]:
        raise ValueError(
            "training requires an isolated virtual environment without user or system packages"
        )
    return value


def active_platform_identity(
    specification: EnvironmentSpecification,
) -> tuple[dict[str, Any], dict[str, Any]]:
    value = {
        "system": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine(),
    }
    if (
        value["system"] != specification.raw["platform"]["system"]
        or value["machine"] != specification.raw["platform"]["machine"]
    ):
        raise ValueError(
            "active platform drifted from the CPU environment specification"
        )
    cpu = {
        "processor": platform.processor(),
        "logical_processor_count": os.cpu_count(),
    }
    require_string(cpu["processor"], "CPU processor", maximum=1024)
    require_integer(cpu["logical_processor_count"], "logical processor count", 1, 4096)
    return value, cpu


def apply_required_environment(specification: EnvironmentSpecification) -> None:
    for key, value in specification.raw["required_environment"].items():
        os.environ[key] = value


def _set_interop_threads(torch: Any, count: int) -> None:
    if torch.get_num_interop_threads() == count:
        return
    try:
        torch.set_num_interop_threads(count)
    except RuntimeError as error:
        if torch.get_num_interop_threads() != count:
            raise RuntimeError(
                "PyTorch interop threads were initialized before policy enforcement"
            ) from error


def probe_ml_runtime(specification: EnvironmentSpecification) -> dict[str, Any]:
    apply_required_environment(specification)
    modules = {
        name: importlib.import_module(import_name)
        for name, import_name in {
            "accelerate": "accelerate",
            "huggingface-hub": "huggingface_hub",
            "numpy": "numpy",
            "peft": "peft",
            "safetensors": "safetensors",
            "tokenizers": "tokenizers",
            "torch": "torch",
            "transformers": "transformers",
        }.items()
    }
    versions = {
        name: require_string(
            getattr(module, "__version__", None), f"{name} runtime version", maximum=128
        )
        for name, module in modules.items()
    }
    for name, expected in EXPECTED_RUNTIME_VERSIONS.items():
        if versions.get(name) != expected:
            raise RuntimeError(
                f"imported {name} version differs from its pinned distribution"
            )
    torch = modules["torch"]
    runtime = specification.raw["runtime"]
    torch.set_num_threads(runtime["intraop_threads"])
    _set_interop_threads(torch, runtime["interop_threads"])
    torch.set_default_dtype(torch.float32)
    torch.use_deterministic_algorithms(True, warn_only=False)
    torch.set_float32_matmul_precision(runtime["matmul_precision"])
    torch.backends.mkldnn.enabled = runtime["mkldnn_enabled"]
    result = {
        "versions": versions,
        "device": "cpu",
        "torch_cuda_build": torch.version.cuda,
        "cuda_available": bool(torch.cuda.is_available()),
        "cuda_device_count": int(torch.cuda.device_count()),
        "default_dtype": str(torch.get_default_dtype()).replace("torch.", ""),
        "deterministic_algorithms": bool(torch.are_deterministic_algorithms_enabled()),
        "deterministic_warn_only": bool(
            torch.is_deterministic_algorithms_warn_only_enabled()
        ),
        "intraop_threads": int(torch.get_num_threads()),
        "interop_threads": int(torch.get_num_interop_threads()),
        "matmul_precision": str(torch.get_float32_matmul_precision()),
        "mkldnn_enabled": bool(torch.backends.mkldnn.enabled),
    }
    expected_result = {
        "device": "cpu",
        "torch_cuda_build": None,
        "cuda_available": False,
        "cuda_device_count": 0,
        "default_dtype": "float32",
        "deterministic_algorithms": True,
        "deterministic_warn_only": False,
        "intraop_threads": runtime["intraop_threads"],
        "interop_threads": runtime["interop_threads"],
        "matmul_precision": runtime["matmul_precision"],
        "mkldnn_enabled": runtime["mkldnn_enabled"],
    }
    if {key: result[key] for key in expected_result} != expected_result:
        raise RuntimeError(
            "active ML runtime does not satisfy the CPU-only deterministic policy"
        )
    return result


def run_pip_check() -> str:
    environment = os.environ.copy()
    environment.update(EXPECTED_ENVIRONMENT)
    completed = subprocess.run(
        [sys.executable, "-m", "pip", "check", "--disable-pip-version-check"],
        check=False,
        capture_output=True,
        env=environment,
        timeout=120,
    )
    output = completed.stdout + completed.stderr
    if len(output) > MAX_PIP_OUTPUT_BYTES:
        raise RuntimeError("pip check output exceeded its byte bound")
    if completed.returncode != 0:
        raise RuntimeError("pip check rejected the active training environment")
    return sha256_bytes(output)


def _profile_identity(path: Path) -> tuple[dict[str, Any], FileIdentity]:
    path = path.resolve(strict=True)
    identity = file_identity(path, MAX_PROFILE_BYTES)
    profile = read_json_object(path, MAX_PROFILE_BYTES, "Qwen3 working-model profile")
    if (
        profile.get("schema") != PROFILE_SCHEMA
        or profile.get("profile_id") != EXPECTED_PROFILE_ID
    ):
        raise ValueError("Qwen3 working-model profile identity is not the sole v1 lane")
    if profile.get("goal_sha256") != EXPECTED_GOAL_SHA256:
        raise ValueError("Qwen3 working-model profile goal identity drifted")
    source = require_object(profile.get("source"), "working-model profile source")
    if (
        source.get("repo_id") != EXPECTED_SOURCE_REPO_ID
        or source.get("revision") != EXPECTED_SOURCE_REVISION
        or source.get("architecture") != EXPECTED_ARCHITECTURE
        or source.get("status") != EXPECTED_SOURCE_STATUS
    ):
        raise ValueError("Qwen3 working-model source contract drifted")
    validate_training_recipe(
        require_object(profile.get("training"), "profile training")
    )
    validate_stop_rules(require_object(profile.get("stop_rules"), "profile stop rules"))
    return profile, identity


def capture_environment_lock(
    specification: EnvironmentSpecification,
    profile_path: Path,
    wheelhouse_manifest_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    profile, profile_identity = _profile_identity(profile_path)
    manifest, manifest_identity = load_wheelhouse_manifest(
        specification, wheelhouse_manifest_path, rehash_wheels=True
    )
    output_path = require_external_path(
        output_path, "environment lock output", must_exist=False
    )
    python_value = active_python_identity(specification)
    platform_value, cpu_value = active_platform_identity(specification)
    distributions = installed_distribution_identities()
    wheel_versions = {
        item["distribution_name"]: item["version"] for item in manifest["artifacts"]
    }
    installed_versions = {item["name"]: item["version"] for item in distributions}
    if installed_versions != wheel_versions:
        missing = sorted(set(wheel_versions) - set(installed_versions))
        extra = sorted(set(installed_versions) - set(wheel_versions))
        raise ValueError(
            f"installed distributions do not exactly match the wheelhouse; missing={missing}; extra={extra}"
        )
    runtime_probe = probe_ml_runtime(specification)
    pip_check_sha256 = run_pip_check()
    lock = {
        "schema": ENVIRONMENT_LOCK_SCHEMA,
        "status": "captured",
        "environment_id": specification.raw["environment_id"],
        "profile_id": profile["profile_id"],
        "profile_sha256": profile_identity.sha256,
        "training_program": program_identity().json_value(),
        "environment_spec": specification.identity.json_value(),
        "wheelhouse_manifest": {
            "path": str(Path(wheelhouse_manifest_path).resolve()),
            **manifest_identity.json_value(),
        },
        "wheelhouse_artifact_set_sha256": manifest["artifact_set_sha256"],
        "python": python_value,
        "platform": platform_value,
        "cpu": cpu_value,
        "required_environment": specification.raw["required_environment"],
        "distributions": distributions,
        "distribution_set_sha256": distribution_set_sha256(distributions),
        "runtime_probe": runtime_probe,
        "pip_check_sha256": pip_check_sha256,
        "created_utc": utc_now(),
        "contains_credentials": False,
        "training_authority": False,
    }
    write_new_atomic(output_path, json_document_bytes(lock))
    return lock


def _validate_identity_value(value: Any, label: str) -> FileIdentity:
    identity = require_object(value, label)
    require_exact_keys(identity, FILE_IDENTITY_KEYS, label)
    return FileIdentity(
        require_integer(identity["bytes"], f"{label}.bytes", 1, 16 * 1024**3),
        require_sha256(identity["sha256"], f"{label}.sha256"),
    )


def verify_environment_lock(
    specification: EnvironmentSpecification,
    profile_path: Path,
    lock_path: Path,
    *,
    probe_runtime: bool,
) -> tuple[dict[str, Any], FileIdentity, Path]:
    profile, profile_identity = _profile_identity(profile_path)
    lock_path = require_external_path(lock_path, "environment lock")
    lock_identity = file_identity(lock_path, MAX_JSON_BYTES)
    lock = read_json_object(lock_path, MAX_JSON_BYTES, "environment lock")
    require_exact_keys(lock, ENVIRONMENT_LOCK_KEYS, "environment lock")
    if lock["schema"] != ENVIRONMENT_LOCK_SCHEMA or lock["status"] != "captured":
        raise ValueError("environment lock must be captured v1 evidence")
    if lock["environment_id"] != specification.raw["environment_id"]:
        raise ValueError("environment lock id drifted")
    if (
        lock["profile_id"] != profile["profile_id"]
        or lock["profile_sha256"] != profile_identity.sha256
    ):
        raise ValueError("environment lock profile identity drifted")
    if (
        _validate_identity_value(
            lock["training_program"], "environment lock training_program"
        )
        != program_identity()
    ):
        raise ValueError("environment lock training program identity drifted")
    if (
        _validate_identity_value(
            lock["environment_spec"], "environment lock environment_spec"
        )
        != specification.identity
    ):
        raise ValueError("environment lock specification identity drifted")
    manifest_value = require_object(
        lock["wheelhouse_manifest"], "environment lock wheelhouse_manifest"
    )
    require_exact_keys(
        manifest_value,
        {"path", "bytes", "sha256"},
        "environment lock wheelhouse_manifest",
    )
    manifest_path = require_external_path(
        Path(require_string(manifest_value["path"], "wheelhouse manifest path")),
        "wheelhouse manifest",
    )
    manifest_identity = file_identity(manifest_path, MAX_JSON_BYTES)
    expected_manifest_identity = FileIdentity(
        require_integer(
            manifest_value["bytes"], "wheelhouse manifest bytes", 1, MAX_JSON_BYTES
        ),
        require_sha256(manifest_value["sha256"], "wheelhouse manifest SHA-256"),
    )
    if manifest_identity != expected_manifest_identity:
        raise ValueError("wheelhouse manifest changed after environment capture")
    manifest, _ = load_wheelhouse_manifest(
        specification, manifest_path, rehash_wheels=True
    )
    if lock["wheelhouse_artifact_set_sha256"] != manifest["artifact_set_sha256"]:
        raise ValueError("environment lock wheelhouse artifact set drifted")
    expected_python = active_python_identity(specification)
    if lock["python"] != expected_python:
        raise ValueError("active Python identity changed after environment capture")
    expected_platform, expected_cpu = active_platform_identity(specification)
    if lock["platform"] != expected_platform or lock["cpu"] != expected_cpu:
        raise ValueError("active platform or CPU changed after environment capture")
    if lock["required_environment"] != specification.raw["required_environment"]:
        raise ValueError("environment lock offline variables drifted")
    distributions = installed_distribution_identities()
    if lock["distributions"] != distributions:
        raise ValueError(
            "installed distribution files changed after environment capture"
        )
    if lock["distribution_set_sha256"] != distribution_set_sha256(distributions):
        raise ValueError("environment lock distribution set SHA-256 drifted")
    require_string(lock["created_utc"], "environment lock created_utc", maximum=64)
    if (
        lock["contains_credentials"] is not False
        or lock["training_authority"] is not False
    ):
        raise ValueError("environment lock contains a forbidden claim")
    pip_check_sha256 = run_pip_check()
    if lock["pip_check_sha256"] != pip_check_sha256:
        raise ValueError("pip check evidence changed after environment capture")
    if probe_runtime:
        runtime = probe_ml_runtime(specification)
        if lock["runtime_probe"] != runtime:
            raise ValueError("ML runtime probe changed after environment capture")
    else:
        runtime = require_object(
            lock["runtime_probe"], "environment lock runtime_probe"
        )
        require_exact_keys(
            runtime, RUNTIME_PROBE_KEYS, "environment lock runtime_probe"
        )
    return lock, lock_identity, manifest_path


def validate_training_recipe(training: dict[str, Any]) -> None:
    require_exact_keys(training, TRAINING_KEYS, "training recipe")
    expected_literals = {
        "method": "assistant-only-sft-with-preservation-kl",
        "device": "cpu",
        "parameter_dtype": "float32",
        "compute_dtype": "float32",
        "epochs": 1,
        "micro_batch_size": 1,
        "eligible_checkpoint": "final-only",
    }
    for key, expected in expected_literals.items():
        if training[key] != expected:
            raise ValueError(f"training recipe {key} drifted from the sole CPU lane")
    if (
        set(training["target_modules"]) != EXPECTED_TARGET_MODULES
        or len(training["target_modules"]) != 7
    ):
        raise ValueError(
            "training recipe must target all and only seven Qwen3 projections"
        )
    if (
        training["lora_rank"] != 16
        or training["lora_alpha"] != 32
        or training["lora_dropout"] != 0.0
    ):
        raise ValueError("training recipe LoRA configuration drifted")
    if training["maximum_sequence_tokens"] != 1024:
        raise ValueError("training recipe sequence bound drifted")
    if (
        training["gradient_accumulation_steps"] != 8
        or training["effective_batch_size"] != 8
    ):
        raise ValueError("training recipe batch geometry drifted")
    if (
        training["effective_batch_size"]
        != training["micro_batch_size"] * training["gradient_accumulation_steps"]
    ):
        raise ValueError("training recipe effective batch size is inconsistent")
    for key, minimum, maximum in (
        ("learning_rate", 1e-8, 1e-2),
        ("weight_decay", 0.0, 1.0),
        ("gradient_clip_norm", 1e-6, 1000.0),
        ("preservation_kl_weight", 1e-6, 100.0),
    ):
        require_number(training[key], f"training recipe {key}", minimum, maximum)
    for key in ("training_seed", "shuffle_seed"):
        require_integer(training[key], f"training recipe {key}", 0, 2**63 - 1)
    require_integer(
        training["warmup_steps"], "training recipe warmup_steps", 0, 1_000_000
    )
    require_integer(
        training["checkpoint_interval_steps"],
        "training recipe checkpoint_interval_steps",
        1,
        10_000_000,
    )


def validate_stop_rules(rules: dict[str, Any]) -> None:
    require_exact_keys(rules, STOP_RULE_KEYS, "training stop rules")
    expected_literals = {
        "nonfinite_loss": "terminal-reject",
        "failed_adapter_disposition": "terminal-reject-exact-bytes",
        "retry_requirement": "new-preregistration-and-material-method-or-data-change",
    }
    for key, expected in expected_literals.items():
        if rules[key] != expected:
            raise ValueError(f"training stop rule {key} drifted")
    require_integer(
        rules["maximum_consecutive_loss_increases"],
        "maximum consecutive loss increases",
        1,
        1000,
    )
    require_integer(
        rules["maximum_wall_clock_seconds"], "maximum wall clock", 60, 30 * 24 * 3600
    )
    require_integer(
        rules["maximum_peak_rss_bytes"], "maximum peak RSS", 1024**3, 1024**5
    )
    for key in (
        "minimum_pilot_behavior_pass_rate",
        "minimum_preservation_pass_rate",
        "maximum_ordinary_helpfulness_regression_rate",
    ):
        require_number(rules[key], key, 0.0, 1.0)


def _source_file_map(profile: dict[str, Any]) -> dict[str, FileIdentity]:
    source = require_object(profile["source"], "profile source")
    values = require_array(source["files"], "profile source files", 2, 128)
    result: dict[str, FileIdentity] = {}
    for index, raw in enumerate(values):
        item = require_object(raw, f"profile source files[{index}]")
        require_exact_keys(
            item, {"name", "bytes", "sha256"}, f"profile source files[{index}]"
        )
        name = require_string(item["name"], "profile source filename", maximum=256)
        if name != Path(name).name or name in result:
            raise ValueError("profile source filenames must be unique direct children")
        result[name] = FileIdentity(
            require_integer(item["bytes"], "profile source bytes", 1, 16 * 1024**3),
            require_sha256(item["sha256"], "profile source SHA-256"),
        )
    return result


def verify_source_root(profile: dict[str, Any], source_root: Path) -> Path:
    source_root = require_external_path(source_root, "source root")
    if not source_root.is_dir():
        raise ValueError("source root must be a directory")
    expected = _source_file_map(profile)
    entries = list(source_root.iterdir())
    if any(not entry.is_file() or _is_reparse(entry) for entry in entries):
        raise ValueError("source root must contain only direct regular files")
    if {entry.name for entry in entries} != set(expected):
        raise ValueError(
            "source root file set differs from the pinned nine-file source"
        )
    for name, identity in expected.items():
        if file_identity(source_root / name) != identity:
            raise ValueError(f"source file {name} changed from the pinned revision")
    config = read_json_object(
        source_root / "config.json", MAX_JSON_BYTES, "source config"
    )
    if (
        config.get("architectures") != [EXPECTED_ARCHITECTURE]
        or config.get("model_type") != "qwen3"
    ):
        raise ValueError("source config is not the exact supported Qwen3 architecture")
    if "auto_map" in config or "_auto_class" in config:
        raise ValueError("source config requests remote or custom code")
    tokenizer_config = read_json_object(
        source_root / "tokenizer_config.json", MAX_JSON_BYTES, "source tokenizer config"
    )
    if "auto_map" in tokenizer_config or "_auto_class" in tokenizer_config:
        raise ValueError("source tokenizer requests remote or custom code")
    if not isinstance(tokenizer_config.get("chat_template"), str):
        raise ValueError(
            "source tokenizer config does not contain its pinned chat template"
        )
    return source_root


def _validate_curriculum_record(
    profile: dict[str, Any], raw: dict[str, Any], line_number: int
) -> CurriculumRecord:
    label = f"curriculum line {line_number}"
    require_exact_keys(raw, CURRICULUM_RECORD_KEYS, label)
    if raw["schema"] != CURRICULUM_RECORD_SCHEMA:
        raise ValueError(f"{label} schema drifted")
    record_id = require_id(raw["record_id"], f"{label}.record_id")
    task_family = require_id(raw["task_family"], f"{label}.task_family")
    categories = {item["id"]: item for item in profile["curriculum"]["categories"]}
    if task_family not in categories:
        raise ValueError(f"{label}.task_family is not preregistered")
    require_id(raw["template_family_id"], f"{label}.template_family_id")
    factors = require_object(raw["scenario_factors"], f"{label}.scenario_factors")
    if set(factors) != set(categories[task_family]["required_factors"]):
        raise ValueError(f"{label}.scenario_factors drifted")
    for key, value in factors.items():
        require_id(key, f"{label}.scenario factor key")
        require_string(
            value, f"{label}.scenario factor value", maximum=MAX_RECORD_BYTES
        )
    message_values = require_array(raw["messages"], f"{label}.messages", 1, 128)
    messages: list[dict[str, str]] = []
    for index, raw_message in enumerate(message_values):
        message = require_object(raw_message, f"{label}.messages[{index}]")
        require_exact_keys(message, {"role", "content"}, f"{label}.messages[{index}]")
        role = require_string(
            message["role"], f"{label}.messages[{index}].role", maximum=16
        )
        if role not in {"system", "user", "assistant"}:
            raise ValueError(f"{label} contains an invalid message role")
        content = require_string(
            message["content"],
            f"{label}.messages[{index}].content",
            maximum=MAX_RECORD_BYTES,
        )
        messages.append({"role": role, "content": content})
    if (
        not any(message["role"] == "user" for message in messages)
        or messages[-1]["role"] != "user"
    ):
        raise ValueError(f"{label}.messages must end in a user turn")
    response = require_string(
        raw["response"], f"{label}.response", maximum=MAX_RECORD_BYTES
    )
    if raw["disposition"] not in {"helpful-positive", "narrow-boundary"}:
        raise ValueError(f"{label}.disposition is invalid")
    teacher = require_object(raw["teacher_generation"], f"{label}.teacher_generation")
    if teacher.get("hidden_reasoning_included") is not False:
        raise ValueError(f"{label} contains hidden teacher reasoning")
    review = require_object(raw["review"], f"{label}.review")
    if review.get("decision") != "accept":
        raise ValueError(f"{label} was not accepted")
    for key in (
        "pii_scan_status",
        "license_review_status",
        "malicious_artifact_scan_status",
    ):
        if review.get(key) != "pass":
            raise ValueError(f"{label}.{key} did not pass")
    return CurriculumRecord(record_id, task_family, tuple(messages), response)


def load_curriculum(
    profile: dict[str, Any], path: Path, expected_order_sha256: str
) -> tuple[tuple[CurriculumRecord, ...], FileIdentity, str]:
    path = require_external_path(path, "training curriculum")
    identity = file_identity(path, MAX_CURRICULUM_BYTES)
    records = tuple(
        _validate_curriculum_record(profile, raw, index)
        for index, raw in enumerate(
            iter_json_lines(path, MAX_CURRICULUM_BYTES, "training curriculum"), 1
        )
    )
    expected_count = profile["curriculum"]["pilot_record_count"]
    if len(records) != expected_count:
        raise ValueError(
            "training curriculum record count drifted from the pilot profile"
        )
    ids = [record.record_id for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError("training curriculum record ids must be unique")
    order_sha256 = sha256_bytes(canonical_json_bytes(ids))
    if order_sha256 != expected_order_sha256:
        raise ValueError("training curriculum order changed after independent review")
    expected_categories = {
        item["id"]: item["pilot_count"] for item in profile["curriculum"]["categories"]
    }
    actual_categories = {name: 0 for name in expected_categories}
    for record in records:
        actual_categories[record.task_family] += 1
    if actual_categories != expected_categories:
        raise ValueError("training curriculum category counts drifted")
    return records, identity, order_sha256


def _identity_matches_path(
    value: Any, path: Path, label: str, maximum: int | None = None
) -> FileIdentity:
    expected = _validate_identity_value(value, label)
    actual = file_identity(path, maximum)
    if expected != actual:
        raise ValueError(f"{label} does not match the provided file")
    return actual


def verify_training_inputs(
    profile_path: Path,
    training_lock_path: Path,
    environment_spec_path: Path,
    environment_lock_path: Path,
    source_root: Path,
    curriculum_path: Path,
    *,
    probe_runtime: bool,
) -> VerifiedTrainingInputs:
    specification = load_environment_spec(environment_spec_path)
    profile, profile_identity = _profile_identity(profile_path)
    training_lock_path = require_external_path(training_lock_path, "training lock")
    training_lock_identity = file_identity(training_lock_path, MAX_JSON_BYTES)
    lock = read_json_object(training_lock_path, MAX_JSON_BYTES, "training lock")
    require_exact_keys(lock, TRAINING_LOCK_KEYS, "training lock")
    if (
        lock["schema"] != TRAINING_LOCK_SCHEMA
        or lock["status"] != "authorized"
        or lock["authorized_operation"] != "cpu-lora-pilot"
    ):
        raise ValueError("training lock is not an authorized CPU pilot lock")
    if (
        lock["profile_id"] != profile["profile_id"]
        or lock["profile_sha256"] != profile_identity.sha256
    ):
        raise ValueError("training lock profile identity drifted")
    if lock["goal_sha256"] != EXPECTED_GOAL_SHA256:
        raise ValueError("training lock goal identity drifted")
    if (
        lock["source_repo_id"] != EXPECTED_SOURCE_REPO_ID
        or lock["source_revision"] != EXPECTED_SOURCE_REVISION
        or lock["source_status"] != EXPECTED_SOURCE_STATUS
    ):
        raise ValueError("training lock source identity drifted")
    if (
        _validate_identity_value(
            lock["training_program"], "training lock training_program"
        )
        != program_identity()
    ):
        raise ValueError(
            "training program must verify its own exact bytes before importing ML packages"
        )
    environment_lock_path = require_external_path(
        environment_lock_path, "environment lock"
    )
    environment_lock_identity = _identity_matches_path(
        lock["environment_lock"],
        environment_lock_path,
        "training lock environment_lock",
        MAX_JSON_BYTES,
    )
    environment_lock, verified_environment_identity, wheelhouse_manifest_path = (
        verify_environment_lock(
            specification,
            profile_path,
            environment_lock_path,
            probe_runtime=False,
        )
    )
    if environment_lock_identity != verified_environment_identity:
        raise ValueError("environment lock identity changed during verification")
    if probe_runtime:
        apply_required_environment(specification)
        install_training_isolation_audit_hook()
        runtime = probe_ml_runtime(specification)
        if environment_lock["runtime_probe"] != runtime:
            raise ValueError("ML runtime probe changed after environment capture")
    source_root = verify_source_root(profile, source_root)
    expected_source = _source_file_map(profile)
    source_values = require_array(
        lock["source_artifacts"],
        "training lock source_artifacts",
        len(expected_source),
        len(expected_source),
    )
    locked_source: dict[str, FileIdentity] = {}
    for index, raw in enumerate(source_values):
        item = require_object(raw, f"training lock source_artifacts[{index}]")
        require_exact_keys(
            item,
            {"name", "bytes", "sha256"},
            f"training lock source_artifacts[{index}]",
        )
        name = require_string(
            item["name"], "training lock source artifact name", maximum=256
        )
        locked_source[name] = FileIdentity(
            require_integer(
                item["bytes"], "training lock source artifact bytes", 1, 16 * 1024**3
            ),
            require_sha256(item["sha256"], "training lock source artifact SHA-256"),
        )
    if locked_source != expected_source:
        raise ValueError("training lock source artifacts drifted from the profile")
    if (
        lock["training"] != profile["training"]
        or lock["stop_rules"] != profile["stop_rules"]
    ):
        raise ValueError("training lock recipe or stop rules drifted from the profile")
    validate_training_recipe(require_object(lock["training"], "training lock training"))
    validate_stop_rules(require_object(lock["stop_rules"], "training lock stop_rules"))
    if (
        lock["checkpoint_selection"] != "final-checkpoint-only-no-best-of-n"
        or lock["raw_output_preservation_required"] is not True
        or lock["retry_selection_forbidden"] is not True
        or lock["response_repair_forbidden"] is not True
    ):
        raise ValueError("training lock promotion-integrity claims drifted")
    review_evidence = require_object(
        lock["review_evidence"], "training lock review_evidence"
    )
    expected_order_sha256 = require_sha256(
        review_evidence.get("record_order_sha256"),
        "review evidence record order SHA-256",
    )
    records, curriculum_identity, record_order_sha256 = load_curriculum(
        profile, curriculum_path, expected_order_sha256
    )
    if curriculum_identity != _validate_identity_value(
        lock["curriculum"], "training lock curriculum"
    ):
        raise ValueError("training curriculum identity drifted from the lock")
    if review_evidence.get("record_count") != len(records):
        raise ValueError("review evidence record count drifted")
    output_root = require_external_path(
        Path(require_string(lock["output_root"], "training output root")),
        "training output root",
        must_exist=False,
    )
    return VerifiedTrainingInputs(
        Path(profile_path).resolve(),
        profile_identity,
        profile,
        training_lock_path,
        training_lock_identity,
        lock,
        environment_lock_path,
        environment_lock_identity,
        environment_lock,
        specification,
        wheelhouse_manifest_path,
        source_root,
        Path(curriculum_path).resolve(),
        curriculum_identity,
        records,
        record_order_sha256,
        output_root,
    )


def shuffled_record_indices(record_count: int, seed: int) -> tuple[int, ...]:
    values = list(range(record_count))
    random.Random(seed).shuffle(values)
    return tuple(values)


def linear_learning_rate(
    base_rate: float, update_step: int, total_updates: int, warmup_steps: int
) -> float:
    if not 1 <= update_step <= total_updates:
        raise ValueError("update step is outside the preregistered schedule")
    if warmup_steps < 0 or warmup_steps >= total_updates:
        raise ValueError("warmup steps must be less than total updates")
    if warmup_steps and update_step <= warmup_steps:
        return base_rate * update_step / warmup_steps
    decay_steps = total_updates - warmup_steps
    remaining_including_current = total_updates - update_step + 1
    return base_rate * remaining_including_current / decay_steps


def tokenize_record(
    tokenizer: Any, record: CurriculumRecord, maximum_tokens: int
) -> dict[str, Any]:
    prompt_messages = [dict(message) for message in record.messages]
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
    prompt = tokenizer(prompt_text, add_special_tokens=False, truncation=False)
    full = tokenizer(full_text, add_special_tokens=False, truncation=False)
    prompt_ids = list(prompt["input_ids"])
    input_ids = list(full["input_ids"])
    attention_mask = list(full["attention_mask"])
    if len(input_ids) > maximum_tokens:
        raise RuntimeError(
            f"record {record.record_id} exceeds the no-truncation token bound"
        )
    if not prompt_ids or len(prompt_ids) >= len(input_ids):
        raise RuntimeError(f"record {record.record_id} has no assistant target tokens")
    if input_ids[: len(prompt_ids)] != prompt_ids:
        raise RuntimeError(
            f"record {record.record_id} chat template does not preserve the prompt prefix"
        )
    if len(attention_mask) != len(input_ids) or any(
        value != 1 for value in attention_mask
    ):
        raise RuntimeError(
            f"record {record.record_id} has an invalid unpadded attention mask"
        )
    labels = input_ids.copy()
    labels[: len(prompt_ids)] = [-100] * len(prompt_ids)
    return {
        "record_id": record.record_id,
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "labels": labels,
        "assistant_target_tokens": len(input_ids) - len(prompt_ids),
    }


def install_training_isolation_audit_hook() -> None:
    global _TRAINING_ISOLATION_AUDIT_INSTALLED
    if _TRAINING_ISOLATION_AUDIT_INSTALLED:
        return

    def deny_external_io(event: str, args: tuple[Any, ...]) -> None:
        del args
        if event.startswith("subprocess.") or event in {
            "os.spawn",
            "os.system",
            "socket.__new__",
            "socket.bind",
            "socket.connect",
            "socket.connect_ex",
            "socket.getaddrinfo",
            "socket.gethostbyname",
            "socket.gethostbyaddr",
            "socket.sendto",
        }:
            raise RuntimeError(
                "network and child-process access are forbidden during CPU training"
            )

    sys.addaudithook(deny_external_io)
    _TRAINING_ISOLATION_AUDIT_INSTALLED = True


def current_rss_bytes(psutil_module: Any) -> int:
    return int(psutil_module.Process(os.getpid()).memory_info().rss)


def _tree_file_identities(
    root: Path, excluded: set[str] | None = None
) -> list[dict[str, Any]]:
    if not root.is_dir() or _is_reparse(root):
        raise ValueError("output tree root must be a regular directory")
    excluded = excluded or set()
    values: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if _is_reparse(path):
            raise ValueError("output tree contains a symlink or reparse point")
        if path.is_dir():
            continue
        relative = path.relative_to(root).as_posix()
        if relative in excluded:
            continue
        if not path.is_file():
            raise ValueError("output tree contains a non-file entry")
        identity = file_identity(path)
        values.append({"path": relative, **identity.json_value()})
    return values


def _attempt_binding(
    inputs: VerifiedTrainingInputs, order: Sequence[int]
) -> dict[str, Any]:
    source_set = [
        {"name": name, **identity.json_value()}
        for name, identity in sorted(_source_file_map(inputs.profile).items())
    ]
    return {
        "schema": ATTEMPT_OWNER_SCHEMA,
        "status": "owned",
        "lock_id": inputs.training_lock["lock_id"],
        "profile_sha256": inputs.profile_identity.sha256,
        "training_lock_sha256": inputs.training_lock_identity.sha256,
        "environment_lock_sha256": inputs.environment_lock_identity.sha256,
        "environment_spec_sha256": inputs.environment_spec.identity.sha256,
        "training_program_sha256": program_identity().sha256,
        "source_artifact_set_sha256": sha256_bytes(canonical_json_bytes(source_set)),
        "curriculum_sha256": inputs.curriculum_identity.sha256,
        "record_order_sha256": inputs.record_order_sha256,
        "shuffled_order_sha256": sha256_bytes(canonical_json_bytes(list(order))),
        "algorithm": inputs.environment_spec.raw["training_algorithm"],
        "contains_raw_curriculum": False,
        "training_authority": False,
    }


def initialize_attempt(
    inputs: VerifiedTrainingInputs,
    order: Sequence[int],
    *,
    resume: bool,
    allow_interrupted_staging: bool = False,
) -> dict[str, Any]:
    expected = _attempt_binding(inputs, order)
    owner_path = inputs.output_root / "attempt-owner.json"
    if not resume:
        if inputs.output_root.exists():
            raise FileExistsError(
                "training output root already exists; explicit verified resume is required"
            )
        inputs.output_root.parent.mkdir(parents=True, exist_ok=True)
        reject_reparse_chain(inputs.output_root.parent, "training output parent")
        inputs.output_root.mkdir()
        for name in ("checkpoints", "segments", "rejections", "interrupted"):
            (inputs.output_root / name).mkdir()
        write_new_atomic(owner_path, json_document_bytes(expected))
        return expected
    if not inputs.output_root.is_dir() or _is_reparse(inputs.output_root):
        raise ValueError("resume output root is not an owned regular directory")
    actual = read_json_object(owner_path, MAX_JSON_BYTES, "attempt owner")
    if actual != expected:
        raise ValueError(
            "resume attempt binding differs from the current authorization"
        )
    if (inputs.output_root / "training-receipt.json").exists():
        raise ValueError("completed training attempts cannot be resumed")
    if (inputs.output_root / "terminal-rejection.json").exists():
        raise ValueError("terminally rejected training attempts cannot be resumed")
    for name in ("checkpoints", "segments", "rejections", "interrupted"):
        path = inputs.output_root / name
        if not path.is_dir() or _is_reparse(path):
            raise ValueError("resume attempt directory structure drifted")
    root_entries = {path.name: path for path in inputs.output_root.iterdir()}
    allowed_entries = {
        "attempt-owner.json",
        "checkpoints",
        "segments",
        "rejections",
        "interrupted",
        "candidate",
    }
    candidate_staging = {
        name for name in root_entries if CANDIDATE_STAGING_PATTERN.fullmatch(name)
    }
    unexpected = set(root_entries) - allowed_entries - candidate_staging
    if unexpected:
        raise ValueError(
            f"resume attempt contains unknown entries: {sorted(unexpected)}"
        )
    if candidate_staging and not allow_interrupted_staging:
        raise ValueError(
            "interrupted candidate staging is preserved and requires operator review before resume"
        )
    for segment in (inputs.output_root / "segments").iterdir():
        if not segment.is_dir() or _is_reparse(segment):
            raise ValueError("training segment archive contains an invalid entry")
        receipt_path = segment / "segment-receipt.json"
        if not receipt_path.exists():
            continue
        receipt = read_json_object(
            receipt_path, MAX_JSON_BYTES, "training segment receipt"
        )
        if (
            receipt.get("schema") == SEGMENT_RECEIPT_SCHEMA
            and receipt.get("status") == "terminal-reject"
        ):
            raise ValueError("terminally rejected training segments cannot be resumed")
    return actual


def verify_checkpoint_directory(
    path: Path, expected_parent_sha256: str | None
) -> CheckpointState:
    match = CHECKPOINT_NAME_PATTERN.fullmatch(path.name)
    if match is None or not path.is_dir() or _is_reparse(path):
        raise ValueError("checkpoint directory name or type is invalid")
    receipt_path = path / "checkpoint-receipt.json"
    receipt = read_json_object(receipt_path, MAX_JSON_BYTES, "checkpoint receipt")
    expected_keys = {
        "schema",
        "status",
        "global_update_step",
        "next_record_offset",
        "elapsed_wall_clock_seconds",
        "peak_rss_bytes",
        "previous_update_loss",
        "consecutive_loss_increases",
        "loss_observation_count",
        "sft_loss_sum",
        "preservation_kl_loss_sum",
        "total_loss_sum",
        "assistant_target_token_count",
        "parent_checkpoint_receipt_sha256",
        "files",
        "file_set_sha256",
        "eligible_for_candidate_selection",
    }
    require_exact_keys(receipt, expected_keys, "checkpoint receipt")
    if (
        receipt["schema"] != CHECKPOINT_RECEIPT_SCHEMA
        or receipt["status"] != "complete"
    ):
        raise ValueError("checkpoint receipt is not complete v1 evidence")
    step = int(match.group(1))
    if receipt["global_update_step"] != step:
        raise ValueError("checkpoint step differs from its directory name")
    require_integer(
        receipt["global_update_step"], "checkpoint global_update_step", 1, 999_999
    )
    next_record_offset = require_integer(
        receipt["next_record_offset"],
        "checkpoint next_record_offset",
        1,
        2**63 - 1,
    )
    require_number(
        receipt["elapsed_wall_clock_seconds"],
        "checkpoint elapsed_wall_clock_seconds",
        0.0,
        float(2**63 - 1),
    )
    require_integer(
        receipt["peak_rss_bytes"], "checkpoint peak_rss_bytes", 1, 2**63 - 1
    )
    require_number(
        receipt["previous_update_loss"],
        "checkpoint previous_update_loss",
        0.0,
        float(2**63 - 1),
    )
    require_integer(
        receipt["consecutive_loss_increases"],
        "checkpoint consecutive_loss_increases",
        0,
        step,
    )
    loss_observation_count = require_integer(
        receipt["loss_observation_count"],
        "checkpoint loss_observation_count",
        1,
        2**63 - 1,
    )
    if loss_observation_count != next_record_offset:
        raise ValueError("checkpoint loss observations do not match record progress")
    for key in ("sft_loss_sum", "preservation_kl_loss_sum", "total_loss_sum"):
        require_number(
            receipt[key],
            f"checkpoint {key}",
            0.0,
            float(2**63 - 1),
        )
    assistant_target_token_count = require_integer(
        receipt["assistant_target_token_count"],
        "checkpoint assistant_target_token_count",
        1,
        2**63 - 1,
    )
    if assistant_target_token_count < loss_observation_count:
        raise ValueError("checkpoint assistant token count is below its record count")
    require_bool(
        receipt["eligible_for_candidate_selection"],
        "checkpoint eligible_for_candidate_selection",
    )
    parent_value = receipt["parent_checkpoint_receipt_sha256"]
    if parent_value is not None:
        require_sha256(parent_value, "checkpoint parent_checkpoint_receipt_sha256")
    if parent_value != expected_parent_sha256:
        raise ValueError("checkpoint parent chain drifted")
    files = _tree_file_identities(path, {"checkpoint-receipt.json"})
    if receipt["files"] != files or receipt["file_set_sha256"] != sha256_bytes(
        canonical_json_bytes(files)
    ):
        raise ValueError("checkpoint files changed after completion")
    if not any(item["path"] == "adapter_model.safetensors" for item in files):
        raise ValueError("checkpoint has no safe adapter weights")
    if not any(item["path"] == "adapter_config.json" for item in files):
        raise ValueError("checkpoint has no adapter configuration")
    if not any(item["path"] == "trainer_state.pt" for item in files):
        raise ValueError("checkpoint has no resumable optimizer state")
    identity = file_identity(receipt_path, MAX_JSON_BYTES)
    return CheckpointState(path, receipt, identity)


def completed_checkpoints(output_root: Path) -> tuple[CheckpointState, ...]:
    root = output_root / "checkpoints"
    states: list[CheckpointState] = []
    parent: str | None = None
    entries = sorted(root.iterdir(), key=lambda path: path.name)
    staging = [
        path for path in entries if CHECKPOINT_STAGING_PATTERN.fullmatch(path.name)
    ]
    if staging:
        raise ValueError(
            "interrupted checkpoint staging is preserved and requires operator review before resume"
        )
    for path in entries:
        state = verify_checkpoint_directory(path, parent)
        states.append(state)
        parent = state.receipt_identity.sha256
    return tuple(states)


def validate_checkpoint_schedule(
    checkpoints: Sequence[CheckpointState],
    *,
    total_updates: int,
    accumulation: int,
    checkpoint_interval: int,
) -> None:
    if total_updates <= 0 or accumulation <= 0 or checkpoint_interval <= 0:
        raise ValueError("checkpoint schedule dimensions must be positive")
    expected_steps = list(
        range(checkpoint_interval, total_updates, checkpoint_interval)
    )
    expected_steps.append(total_updates)
    actual_steps = [state.receipt["global_update_step"] for state in checkpoints]
    if actual_steps != expected_steps[: len(actual_steps)]:
        raise ValueError("checkpoint chain is not an exact schedule prefix")
    previous_elapsed = 0.0
    previous_peak_rss = 0
    previous_sft_sum = 0.0
    previous_kl_sum = 0.0
    previous_total_sum = 0.0
    previous_target_tokens = 0
    for state in checkpoints:
        step = state.receipt["global_update_step"]
        if state.receipt["next_record_offset"] != step * accumulation:
            raise ValueError(
                "checkpoint record offset drifted from the update schedule"
            )
        expected_eligibility = step == total_updates
        if (
            state.receipt["eligible_for_candidate_selection"]
            is not expected_eligibility
        ):
            raise ValueError("checkpoint candidate-selection eligibility drifted")
        cumulative = (
            ("elapsed_wall_clock_seconds", previous_elapsed),
            ("peak_rss_bytes", previous_peak_rss),
            ("sft_loss_sum", previous_sft_sum),
            ("preservation_kl_loss_sum", previous_kl_sum),
            ("total_loss_sum", previous_total_sum),
            ("assistant_target_token_count", previous_target_tokens),
        )
        if any(state.receipt[key] < previous for key, previous in cumulative):
            raise ValueError("checkpoint cumulative evidence moved backward")
        previous_elapsed = state.receipt["elapsed_wall_clock_seconds"]
        previous_peak_rss = state.receipt["peak_rss_bytes"]
        previous_sft_sum = state.receipt["sft_loss_sum"]
        previous_kl_sum = state.receipt["preservation_kl_loss_sum"]
        previous_total_sum = state.receipt["total_loss_sum"]
        previous_target_tokens = state.receipt["assistant_target_token_count"]


def _interruption_file_set(path: Path) -> list[dict[str, Any]]:
    return _tree_file_identities(
        path, {"interruption-plan.json", "interruption-receipt.json"}
    )


def _interruption_destination_name(source_relative_path: str) -> str:
    source = PurePosixPath(source_relative_path)
    if len(source.parts) == 2 and source.parts[0] == "checkpoints":
        match = CHECKPOINT_STAGING_PATTERN.fullmatch(source.parts[1])
        if match is not None:
            return f"checkpoint-{match.group(1)}.{match.group(2)}.interrupted"
    if len(source.parts) == 1:
        match = CANDIDATE_STAGING_PATTERN.fullmatch(source.parts[0])
        if match is not None:
            return f"candidate.{match.group(1)}.interrupted"
    raise ValueError("interrupted output staging path is invalid")


def _interruption_source_path(destination_name: str) -> str:
    match = INTERRUPTED_CHECKPOINT_PATTERN.fullmatch(destination_name)
    if match is not None:
        return f"checkpoints/.checkpoint-{match.group(1)}.{match.group(2)}.staging"
    match = INTERRUPTED_CANDIDATE_PATTERN.fullmatch(destination_name)
    if match is not None:
        return f".candidate.{match.group(1)}.staging"
    raise ValueError("interrupted output archive contains an unknown entry")


def _validate_interruption_plan(
    plan: dict[str, Any],
    source_relative_path: str,
    preserved_files: list[dict[str, Any]],
) -> None:
    expected_keys = {
        "schema",
        "status",
        "source_relative_path",
        "destination_relative_path",
        "preserved_files",
        "file_set_sha256",
        "raw_curriculum_storage_policy",
        "eligible_for_candidate_selection",
        "campaign_counters_incremented",
    }
    require_exact_keys(plan, expected_keys, "checkpoint interruption plan")
    destination_name = _interruption_destination_name(source_relative_path)
    if (
        plan["schema"] != INTERRUPTION_PLAN_SCHEMA
        or plan["status"] != "preservation-planned"
        or plan["source_relative_path"] != source_relative_path
        or plan["destination_relative_path"] != f"interrupted/{destination_name}"
        or plan["preserved_files"] != preserved_files
        or plan["file_set_sha256"]
        != sha256_bytes(canonical_json_bytes(preserved_files))
        or plan["raw_curriculum_storage_policy"] != "forbidden-payload-not-inspected"
        or plan["eligible_for_candidate_selection"] is not False
        or plan["campaign_counters_incremented"] is not False
    ):
        raise ValueError("checkpoint interruption plan drifted")


def _complete_interruption_receipt(
    interrupted: Path, source_relative_path: str
) -> dict[str, Any]:
    destination_name = _interruption_destination_name(source_relative_path)
    if interrupted.name != destination_name:
        raise ValueError("interrupted checkpoint destination name drifted")
    reject_reparse_chain(interrupted, "interrupted checkpoint")
    if not interrupted.is_dir() or _is_reparse(interrupted):
        raise ValueError("interrupted checkpoint is not a regular directory")
    preserved_files = _interruption_file_set(interrupted)
    plan_path = interrupted / "interruption-plan.json"
    plan = read_json_object(plan_path, MAX_JSON_BYTES, "checkpoint interruption plan")
    _validate_interruption_plan(plan, source_relative_path, preserved_files)
    plan_identity = file_identity(plan_path, MAX_JSON_BYTES)
    receipt = {
        "schema": INTERRUPTION_RECEIPT_SCHEMA,
        "status": "quarantined-incomplete-checkpoint",
        "plan": plan_identity.json_value(),
        "destination_relative_path": f"interrupted/{destination_name}",
        "preserved_files": preserved_files,
        "file_set_sha256": sha256_bytes(canonical_json_bytes(preserved_files)),
        "raw_curriculum_storage_policy": "forbidden-payload-not-inspected",
        "eligible_for_candidate_selection": False,
        "campaign_counters_incremented": False,
    }
    receipt_path = interrupted / "interruption-receipt.json"
    if receipt_path.exists():
        actual = read_json_object(
            receipt_path, MAX_JSON_BYTES, "checkpoint interruption receipt"
        )
        if actual != receipt:
            raise ValueError("checkpoint interruption receipt drifted")
    else:
        write_new_atomic(receipt_path, json_document_bytes(receipt))
    return {
        "directory": f"interrupted/{destination_name}",
        "receipt": file_identity(receipt_path, MAX_JSON_BYTES).json_value(),
    }


def _quarantine_interrupted_stage(
    stage: Path,
    source_relative_path: str,
    interrupted_root: Path,
) -> dict[str, Any]:
    reject_reparse_chain(stage, "interrupted output staging")
    if not stage.is_dir() or _is_reparse(stage):
        raise ValueError("interrupted output staging is not a regular directory")
    destination_name = _interruption_destination_name(source_relative_path)
    destination = interrupted_root / destination_name
    if destination.exists():
        raise FileExistsError("interrupted output destination already exists")
    preserved_files = _interruption_file_set(stage)
    plan = {
        "schema": INTERRUPTION_PLAN_SCHEMA,
        "status": "preservation-planned",
        "source_relative_path": source_relative_path,
        "destination_relative_path": f"interrupted/{destination_name}",
        "preserved_files": preserved_files,
        "file_set_sha256": sha256_bytes(canonical_json_bytes(preserved_files)),
        "raw_curriculum_storage_policy": "forbidden-payload-not-inspected",
        "eligible_for_candidate_selection": False,
        "campaign_counters_incremented": False,
    }
    plan_path = stage / "interruption-plan.json"
    if plan_path.exists():
        actual = read_json_object(
            plan_path, MAX_JSON_BYTES, "training output interruption plan"
        )
        if actual != plan:
            raise ValueError("training output interruption plan drifted")
    else:
        write_new_atomic(plan_path, json_document_bytes(plan))
    _fsync_directory(stage)
    os.rename(stage, destination)
    _fsync_directory(stage.parent)
    _fsync_directory(interrupted_root)
    return _complete_interruption_receipt(destination, source_relative_path)


def quarantine_interrupted_output(inputs: VerifiedTrainingInputs) -> dict[str, Any]:
    order = shuffled_record_indices(
        len(inputs.records), inputs.training_lock["training"]["shuffle_seed"]
    )
    initialize_attempt(inputs, order, resume=True, allow_interrupted_staging=True)
    checkpoint_root = inputs.output_root / "checkpoints"
    interrupted_root = inputs.output_root / "interrupted"
    entries = sorted(checkpoint_root.iterdir(), key=lambda path: path.name)
    staging = [
        path for path in entries if CHECKPOINT_STAGING_PATTERN.fullmatch(path.name)
    ]
    regular = [path for path in entries if path not in staging]
    parent: str | None = None
    for path in regular:
        state = verify_checkpoint_directory(path, parent)
        parent = state.receipt_identity.sha256

    results: list[dict[str, Any]] = []
    for stage in staging:
        results.append(
            _quarantine_interrupted_stage(
                stage, f"checkpoints/{stage.name}", interrupted_root
            )
        )

    candidate_staging = sorted(
        (
            path
            for path in inputs.output_root.iterdir()
            if CANDIDATE_STAGING_PATTERN.fullmatch(path.name)
        ),
        key=lambda path: path.name,
    )
    for stage in candidate_staging:
        results.append(
            _quarantine_interrupted_stage(stage, stage.name, interrupted_root)
        )

    for path in sorted(interrupted_root.iterdir(), key=lambda value: value.name):
        source_relative_path = _interruption_source_path(path.name)
        completed = _complete_interruption_receipt(path, source_relative_path)
        if completed not in results:
            results.append(completed)
    return {
        "status": "pass",
        "quarantined_output_count": len(results),
        "quarantined_outputs": results,
        "resume_permitted_after_reverification": True,
        "quality_claim": "none",
        "campaign_counters_incremented": False,
    }


def _write_checkpoint(
    model: Any,
    optimizer: Any,
    torch: Any,
    output_root: Path,
    state: dict[str, Any],
    parent_receipt_sha256: str | None,
    *,
    eligible_for_candidate_selection: bool,
) -> CheckpointState:
    step = state["global_update_step"]
    final_name = f"checkpoint-{step:06d}"
    checkpoint_root = output_root / "checkpoints"
    final = checkpoint_root / final_name
    if final.exists():
        raise FileExistsError("refusing to overwrite an existing checkpoint")
    stage = checkpoint_root / f".{final_name}.{uuid.uuid4().hex}.staging"
    stage.mkdir()
    try:
        model.save_pretrained(stage, safe_serialization=True)
        state_payload = {
            "global_update_step": step,
            "next_record_offset": state["next_record_offset"],
            "elapsed_wall_clock_seconds": state["elapsed_wall_clock_seconds"],
            "peak_rss_bytes": state["peak_rss_bytes"],
            "previous_update_loss": state["previous_update_loss"],
            "consecutive_loss_increases": state["consecutive_loss_increases"],
            "loss_observation_count": state["loss_observation_count"],
            "sft_loss_sum": state["sft_loss_sum"],
            "preservation_kl_loss_sum": state["preservation_kl_loss_sum"],
            "total_loss_sum": state["total_loss_sum"],
            "assistant_target_token_count": state["assistant_target_token_count"],
            "optimizer_state_dict": optimizer.state_dict(),
            "torch_rng_state": torch.get_rng_state(),
        }
        torch.save(state_payload, stage / "trainer_state.pt")
        for file_path in stage.iterdir():
            if file_path.is_file():
                with file_path.open("r+b") as stream:
                    os.fsync(stream.fileno())
        files = _tree_file_identities(stage)
        receipt = {
            "schema": CHECKPOINT_RECEIPT_SCHEMA,
            "status": "complete",
            "global_update_step": step,
            "next_record_offset": state["next_record_offset"],
            "elapsed_wall_clock_seconds": state["elapsed_wall_clock_seconds"],
            "peak_rss_bytes": state["peak_rss_bytes"],
            "previous_update_loss": state["previous_update_loss"],
            "consecutive_loss_increases": state["consecutive_loss_increases"],
            "loss_observation_count": state["loss_observation_count"],
            "sft_loss_sum": state["sft_loss_sum"],
            "preservation_kl_loss_sum": state["preservation_kl_loss_sum"],
            "total_loss_sum": state["total_loss_sum"],
            "assistant_target_token_count": state["assistant_target_token_count"],
            "parent_checkpoint_receipt_sha256": parent_receipt_sha256,
            "files": files,
            "file_set_sha256": sha256_bytes(canonical_json_bytes(files)),
            "eligible_for_candidate_selection": eligible_for_candidate_selection,
        }
        write_new_atomic(
            stage / "checkpoint-receipt.json", json_document_bytes(receipt)
        )
        _fsync_directory(stage)
        os.rename(stage, final)
        _fsync_directory(checkpoint_root)
        return verify_checkpoint_directory(final, parent_receipt_sha256)
    except BaseException:
        raise


def _load_resume_state(torch: Any, checkpoint: CheckpointState) -> dict[str, Any]:
    value = torch.load(
        checkpoint.directory / "trainer_state.pt",
        map_location="cpu",
        weights_only=True,
    )
    if not isinstance(value, dict):
        raise ValueError("checkpoint trainer state is not a dictionary")
    expected_keys = {
        "global_update_step",
        "next_record_offset",
        "elapsed_wall_clock_seconds",
        "peak_rss_bytes",
        "previous_update_loss",
        "consecutive_loss_increases",
        "loss_observation_count",
        "sft_loss_sum",
        "preservation_kl_loss_sum",
        "total_loss_sum",
        "assistant_target_token_count",
        "optimizer_state_dict",
        "torch_rng_state",
    }
    if set(value) != expected_keys:
        raise ValueError("checkpoint trainer state keys drifted")
    public_state_keys = expected_keys - {"optimizer_state_dict", "torch_rng_state"}
    if any(value[key] != checkpoint.receipt[key] for key in public_state_keys):
        raise ValueError("checkpoint trainer state drifted from its public receipt")
    if not isinstance(value["optimizer_state_dict"], dict):
        raise ValueError("checkpoint optimizer state is not a dictionary")
    if not torch.is_tensor(value["torch_rng_state"]):
        raise ValueError("checkpoint RNG state is not a tensor")
    return value


def _segment_stream(
    output_root: Path, checkpoint_sha256: str | None
) -> tuple[Path, io.TextIOWrapper]:
    segment = (
        output_root
        / "segments"
        / f"segment-{utc_now().replace(':', '')}-{uuid.uuid4().hex}"
    )
    segment.mkdir()
    metadata = {
        "schema": SEGMENT_RECEIPT_SCHEMA,
        "status": "running",
        "started_from_checkpoint_receipt_sha256": checkpoint_sha256,
        "contains_raw_curriculum": False,
    }
    write_new_atomic(segment / "segment-start.json", json_document_bytes(metadata))
    stream = (segment / "events.jsonl").open("x", encoding="ascii", newline="\n")
    return segment, stream


def _append_event(stream: io.TextIOWrapper, value: dict[str, Any]) -> None:
    stream.write(canonical_json_bytes(value).decode("ascii") + "\n")
    stream.flush()
    os.fsync(stream.fileno())


def _finish_segment(segment: Path, status: str, reason_code: str | None = None) -> None:
    events_path = segment / "events.jsonl"
    events_bytes = verify_regular_file(
        events_path, MAX_JSON_BYTES, "segment events", allow_empty=True
    )
    events = FileIdentity(events_bytes, sha256_file(events_path))
    receipt = {
        "schema": SEGMENT_RECEIPT_SCHEMA,
        "status": status,
        "reason_code": reason_code,
        "events": events.json_value(),
        "contains_raw_curriculum": False,
    }
    write_new_atomic(segment / "segment-receipt.json", json_document_bytes(receipt))


def observed_segment_elapsed_seconds(output_root: Path) -> float:
    maximum_elapsed = 0.0
    segment_root = output_root / "segments"
    for segment in segment_root.iterdir():
        if not segment.is_dir() or _is_reparse(segment):
            raise ValueError("training segment archive contains an invalid entry")
        events_path = segment / "events.jsonl"
        if not events_path.exists():
            continue
        size = verify_regular_file(
            events_path, MAX_JSON_BYTES, "training segment events", allow_empty=True
        )
        if size == 0:
            continue
        for line_number, event in enumerate(
            iter_json_lines(events_path, MAX_JSON_BYTES, "training segment events"), 1
        ):
            require_exact_keys(
                event, TRAINING_EVENT_KEYS, f"training event {line_number}"
            )
            if event["schema"] != TRAINING_EVENT_SCHEMA:
                raise ValueError("training event schema drifted")
            elapsed = require_number(
                event["elapsed_wall_clock_seconds"],
                f"training event {line_number} elapsed_wall_clock_seconds",
                0.0,
                float(2**63 - 1),
            )
            maximum_elapsed = max(maximum_elapsed, elapsed)
    return maximum_elapsed


def _configure_model(
    inputs: VerifiedTrainingInputs, checkpoint: CheckpointState | None
) -> tuple[Any, Any, Any, Any]:
    torch = importlib.import_module("torch")
    peft = importlib.import_module("peft")
    transformers = importlib.import_module("transformers")
    AutoModelForCausalLM = transformers.AutoModelForCausalLM
    AutoTokenizer = transformers.AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(
        inputs.source_root,
        local_files_only=True,
        trust_remote_code=False,
    )
    if tokenizer.pad_token_id is None or tokenizer.eos_token_id is None:
        raise RuntimeError(
            "pinned Qwen3 tokenizer must define both pad and EOS token ids"
        )
    if not getattr(tokenizer, "is_fast", False):
        raise RuntimeError("pinned Qwen3 training requires the bound fast tokenizer")
    model = AutoModelForCausalLM.from_pretrained(
        inputs.source_root,
        local_files_only=True,
        trust_remote_code=False,
        dtype=torch.float32,
        device_map=None,
        low_cpu_mem_usage=False,
    )
    if model.__class__.__name__ != EXPECTED_ARCHITECTURE:
        raise RuntimeError("loaded source model class differs from Qwen3ForCausalLM")
    model.to(device="cpu", dtype=torch.float32)
    model.config.use_cache = False
    if checkpoint is None:
        training = inputs.training_lock["training"]
        config = peft.LoraConfig(
            task_type=peft.TaskType.CAUSAL_LM,
            inference_mode=False,
            r=training["lora_rank"],
            lora_alpha=training["lora_alpha"],
            lora_dropout=training["lora_dropout"],
            target_modules=training["target_modules"],
            bias="none",
            use_rslora=False,
            use_dora=False,
            init_lora_weights=True,
        )
        model = peft.get_peft_model(model, config)
    else:
        model = peft.PeftModel.from_pretrained(
            model,
            checkpoint.directory,
            is_trainable=True,
        )
    trainable = [
        (name, parameter)
        for name, parameter in model.named_parameters()
        if parameter.requires_grad
    ]
    if not trainable or any("lora_" not in name for name, _ in trainable):
        raise RuntimeError("training must expose only nonempty LoRA parameters")
    actual_targets = {
        target
        for target in EXPECTED_TARGET_MODULES
        if any(f".{target}." in name for name, _ in trainable)
    }
    if actual_targets != EXPECTED_TARGET_MODULES:
        raise RuntimeError("loaded LoRA does not cover all seven Qwen3 projections")
    if any(
        parameter.device.type != "cpu" or parameter.dtype != torch.float32
        for _, parameter in model.named_parameters()
    ):
        raise RuntimeError("every source and adapter parameter must remain CPU float32")
    return torch, peft, tokenizer, model


def _preservation_loss(
    torch: Any, model: Any, batch: dict[str, Any], temperature: float
) -> tuple[Any, Any, Any]:
    outputs = model(**batch, use_cache=False)
    if outputs.loss is None or outputs.logits is None:
        raise RuntimeError("Qwen3 forward pass did not return loss and logits")
    labels = batch["labels"]
    disable_adapter = getattr(model, "disable_adapter", None)
    if not callable(disable_adapter):
        raise RuntimeError("PEFT model does not expose disable_adapter()")
    was_training = model.training
    try:
        model.eval()
        with torch.no_grad(), disable_adapter():
            base = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
                use_cache=False,
            )
    finally:
        if was_training:
            model.train()
    mask = labels[:, 1:].ne(-100)
    if int(mask.sum().item()) <= 0:
        raise RuntimeError("training batch has no assistant target tokens")
    student_logits = outputs.logits[:, :-1, :].float() / temperature
    base_logits = base.logits[:, :-1, :].float() / temperature
    token_kl = torch.nn.functional.kl_div(
        torch.nn.functional.log_softmax(student_logits, dim=-1),
        torch.nn.functional.softmax(base_logits, dim=-1),
        reduction="none",
    ).sum(dim=-1)
    kl_loss = token_kl.masked_select(mask).mean() * temperature * temperature
    return outputs.loss, kl_loss, outputs


def _terminal_rejection(
    inputs: VerifiedTrainingInputs,
    model: Any,
    reason_code: str,
    state: dict[str, Any],
) -> None:
    reason_code = require_id(reason_code, "terminal rejection reason code")
    final = (
        inputs.output_root
        / "rejections"
        / (f"rejection-{state['global_update_step']:06d}-{reason_code}")
    )
    if final.exists():
        raise FileExistsError("terminal rejection artifact already exists")
    decision = {
        "schema": TERMINAL_REJECTION_SCHEMA,
        "status": "terminal-reject",
        "reason_code": reason_code,
        "global_update_step": state["global_update_step"],
        "next_record_offset": state["next_record_offset"],
        "elapsed_wall_clock_seconds": state["elapsed_wall_clock_seconds"],
        "peak_rss_bytes": state["peak_rss_bytes"],
        "loss_observation_count": state["loss_observation_count"],
        "assistant_target_token_count": state["assistant_target_token_count"],
        "retry_requirement": inputs.training_lock["stop_rules"]["retry_requirement"],
        "training_lock_sha256": inputs.training_lock_identity.sha256,
        "adapter_preservation": "separate-create-only-receipt-if-save-completes",
        "quality_claim": "none",
        "campaign_counters_incremented": False,
    }
    decision_path = inputs.output_root / "terminal-rejection.json"
    write_new_atomic(decision_path, json_document_bytes(decision))
    decision_identity = file_identity(decision_path, MAX_JSON_BYTES)
    stage = (
        inputs.output_root
        / "rejections"
        / (
            f".rejection-{state['global_update_step']:06d}-{reason_code}."
            f"{uuid.uuid4().hex}.staging"
        )
    )
    stage.mkdir()
    model.save_pretrained(stage, safe_serialization=True)
    for file_path in stage.iterdir():
        if file_path.is_file():
            with file_path.open("r+b") as stream:
                os.fsync(stream.fileno())
    files = _tree_file_identities(stage)
    artifact_receipt = {
        "schema": TERMINAL_ARTIFACT_RECEIPT_SCHEMA,
        "status": "terminal-rejected-adapter-preserved",
        "terminal_decision": decision_identity.json_value(),
        "files": files,
        "file_set_sha256": sha256_bytes(canonical_json_bytes(files)),
        "eligible_for_candidate_selection": False,
        "quality_claim": "none",
        "campaign_counters_incremented": False,
    }
    write_new_atomic(
        stage / "terminal-artifact-receipt.json",
        json_document_bytes(artifact_receipt),
    )
    _fsync_directory(stage)
    os.rename(stage, final)
    _fsync_directory(final.parent)


def _training_receipt(
    inputs: VerifiedTrainingInputs,
    checkpoint: CheckpointState,
    metrics: dict[str, Any],
    files: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schema": TRAINING_RECEIPT_SCHEMA,
        "status": "candidate-produced-evaluation-required",
        "profile_id": inputs.profile["profile_id"],
        "profile_sha256": inputs.profile_identity.sha256,
        "training_lock_sha256": inputs.training_lock_identity.sha256,
        "environment_lock_sha256": inputs.environment_lock_identity.sha256,
        "training_program_sha256": program_identity().sha256,
        "source_repo_id": EXPECTED_SOURCE_REPO_ID,
        "source_revision": EXPECTED_SOURCE_REVISION,
        "curriculum_sha256": inputs.curriculum_identity.sha256,
        "record_count": len(inputs.records),
        "final_checkpoint_receipt_sha256": checkpoint.receipt_identity.sha256,
        "adapter_files": files,
        "adapter_file_set_sha256": sha256_bytes(canonical_json_bytes(files)),
        "metrics": metrics,
        "quality_claim": "none",
        "eligible_checkpoint": "final-only",
        "required_next_gate": "merge-distinct-checkpoint-then-untouched-source-screen",
        "campaign_counters_incremented": False,
    }


def _finalize_candidate(
    inputs: VerifiedTrainingInputs, checkpoint: CheckpointState, metrics: dict[str, Any]
) -> dict[str, Any]:
    candidate = inputs.output_root / "candidate"
    receipt_path = candidate / "training-receipt.json"
    if candidate.exists():
        reject_reparse_chain(candidate, "training candidate")
        if not candidate.is_dir() or _is_reparse(candidate):
            raise ValueError("training candidate is not a regular directory")
        files = _tree_file_identities(candidate, {"training-receipt.json"})
    else:
        stage = inputs.output_root / f".candidate.{uuid.uuid4().hex}.staging"
        stage.mkdir()
        for name in ("adapter_model.safetensors", "adapter_config.json"):
            target = stage / name
            shutil.copyfile(checkpoint.directory / name, target)
            with target.open("r+b") as stream:
                os.fsync(stream.fileno())
        files = _tree_file_identities(stage)
        receipt = _training_receipt(inputs, checkpoint, metrics, files)
        write_new_atomic(stage / "training-receipt.json", json_document_bytes(receipt))
        _fsync_directory(stage)
        os.rename(stage, candidate)
        _fsync_directory(inputs.output_root)

    if {item["path"] for item in files} != {
        "adapter_model.safetensors",
        "adapter_config.json",
    }:
        raise ValueError("training candidate adapter file set drifted")
    checkpoint_files = {item["path"]: item for item in checkpoint.receipt["files"]}
    if any(checkpoint_files.get(item["path"]) != item for item in files):
        raise ValueError("training candidate differs from its final checkpoint")
    receipt = _training_receipt(inputs, checkpoint, metrics, files)
    actual_receipt = read_json_object(
        receipt_path, MAX_JSON_BYTES, "candidate training receipt"
    )
    if actual_receipt != receipt:
        raise ValueError("candidate training receipt drifted")
    top_receipt_path = inputs.output_root / "training-receipt.json"
    if top_receipt_path.exists():
        top_receipt = read_json_object(
            top_receipt_path, MAX_JSON_BYTES, "top-level training receipt"
        )
        if top_receipt != receipt:
            raise ValueError("top-level training receipt drifted")
    else:
        write_new_atomic(top_receipt_path, json_document_bytes(receipt))
    return receipt


def run_training(inputs: VerifiedTrainingInputs, *, resume: bool) -> dict[str, Any]:
    training = inputs.training_lock["training"]
    stop_rules = inputs.training_lock["stop_rules"]
    order = shuffled_record_indices(len(inputs.records), training["shuffle_seed"])
    initialize_attempt(inputs, order, resume=resume)
    checkpoints = completed_checkpoints(inputs.output_root)
    latest = checkpoints[-1] if checkpoints else None
    accumulation = training["gradient_accumulation_steps"]
    if len(order) % accumulation != 0:
        raise RuntimeError(
            "pilot record count must divide exactly into accumulation windows"
        )
    total_updates = len(order) // accumulation
    if training["warmup_steps"] >= total_updates:
        raise RuntimeError("warmup steps must be less than total pilot updates")
    validate_checkpoint_schedule(
        checkpoints,
        total_updates=total_updates,
        accumulation=accumulation,
        checkpoint_interval=training["checkpoint_interval_steps"],
    )
    apply_required_environment(inputs.environment_spec)
    install_training_isolation_audit_hook()
    runtime_probe = probe_ml_runtime(inputs.environment_spec)
    if runtime_probe != inputs.environment_lock["runtime_probe"]:
        raise RuntimeError(
            "runtime changed between authorization verification and model load"
        )
    torch = importlib.import_module("torch")
    random.seed(training["training_seed"])
    torch.manual_seed(training["training_seed"])
    torch, _peft, tokenizer, model = _configure_model(inputs, latest)
    psutil = importlib.import_module("psutil")
    trainable_parameters = [
        parameter for parameter in model.parameters() if parameter.requires_grad
    ]
    optimizer = torch.optim.AdamW(
        trainable_parameters,
        lr=training["learning_rate"],
        betas=(EXPECTED_ALGORITHM["adam_beta1"], EXPECTED_ALGORITHM["adam_beta2"]),
        eps=EXPECTED_ALGORITHM["adam_epsilon"],
        weight_decay=training["weight_decay"],
    )
    if latest is None:
        state = {
            "global_update_step": 0,
            "next_record_offset": 0,
            "elapsed_wall_clock_seconds": 0.0,
            "peak_rss_bytes": current_rss_bytes(psutil),
            "previous_update_loss": None,
            "consecutive_loss_increases": 0,
            "loss_observation_count": 0,
            "sft_loss_sum": 0.0,
            "preservation_kl_loss_sum": 0.0,
            "total_loss_sum": 0.0,
            "assistant_target_token_count": 0,
        }
    else:
        resumed = _load_resume_state(torch, latest)
        optimizer.load_state_dict(resumed.pop("optimizer_state_dict"))
        torch.set_rng_state(resumed.pop("torch_rng_state"))
        state = resumed
    state["elapsed_wall_clock_seconds"] = max(
        state["elapsed_wall_clock_seconds"],
        observed_segment_elapsed_seconds(inputs.output_root),
    )
    expected_offset = state["global_update_step"] * accumulation
    if state["next_record_offset"] != expected_offset:
        raise RuntimeError("checkpoint offset is not an optimizer-step boundary")
    if expected_offset > len(order):
        raise RuntimeError("checkpoint progress exceeds the curriculum")
    segment, event_stream = _segment_stream(
        inputs.output_root, latest.receipt_identity.sha256 if latest else None
    )
    parent_sha256 = latest.receipt_identity.sha256 if latest else None
    segment_start = time.monotonic()
    optimizer.zero_grad(set_to_none=True)
    try:
        for window_start in range(expected_offset, len(order), accumulation):
            micro_totals: list[float] = []
            micro_sft: list[float] = []
            micro_kl: list[float] = []
            micro_assistant_tokens = 0
            for offset in range(window_start, window_start + accumulation):
                elapsed = state["elapsed_wall_clock_seconds"] + (
                    time.monotonic() - segment_start
                )
                rss = current_rss_bytes(psutil)
                state["peak_rss_bytes"] = max(state["peak_rss_bytes"], rss)
                if elapsed > stop_rules["maximum_wall_clock_seconds"]:
                    raise TerminalStop(
                        "wall-clock-limit",
                        "training exceeded its preregistered wall-clock limit",
                    )
                if state["peak_rss_bytes"] > stop_rules["maximum_peak_rss_bytes"]:
                    raise TerminalStop(
                        "peak-rss-limit",
                        "training exceeded its preregistered RSS limit",
                    )
                record = inputs.records[order[offset]]
                item = tokenize_record(
                    tokenizer, record, training["maximum_sequence_tokens"]
                )
                micro_assistant_tokens += item["assistant_target_tokens"]
                batch = {
                    key: torch.tensor([item[key]], dtype=torch.long, device="cpu")
                    for key in ("input_ids", "attention_mask", "labels")
                }
                model.train()
                sft_loss, kl_loss, _outputs = _preservation_loss(
                    torch,
                    model,
                    batch,
                    EXPECTED_ALGORITHM["preservation_kl_temperature"],
                )
                total_loss = sft_loss + training["preservation_kl_weight"] * kl_loss
                values = (
                    float(sft_loss.detach().item()),
                    float(kl_loss.detach().item()),
                    float(total_loss.detach().item()),
                )
                if not all(math.isfinite(value) for value in values):
                    raise TerminalStop(
                        "nonfinite-loss", "training produced a non-finite loss"
                    )
                (total_loss / accumulation).backward()
                micro_sft.append(values[0])
                micro_kl.append(values[1])
                micro_totals.append(values[2])
            update_step = state["global_update_step"] + 1
            learning_rate = linear_learning_rate(
                training["learning_rate"],
                update_step,
                total_updates,
                training["warmup_steps"],
            )
            for group in optimizer.param_groups:
                group["lr"] = learning_rate
            gradient_norm = float(
                torch.nn.utils.clip_grad_norm_(
                    trainable_parameters, training["gradient_clip_norm"]
                ).item()
            )
            if not math.isfinite(gradient_norm):
                raise TerminalStop(
                    "nonfinite-gradient", "training produced a non-finite gradient norm"
                )
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            update_loss = sum(micro_totals) / len(micro_totals)
            if (
                state["previous_update_loss"] is not None
                and update_loss > state["previous_update_loss"]
            ):
                state["consecutive_loss_increases"] += 1
            else:
                state["consecutive_loss_increases"] = 0
            state["previous_update_loss"] = update_loss
            state["global_update_step"] = update_step
            state["next_record_offset"] = window_start + accumulation
            state["loss_observation_count"] += len(micro_totals)
            state["sft_loss_sum"] += sum(micro_sft)
            state["preservation_kl_loss_sum"] += sum(micro_kl)
            state["total_loss_sum"] += sum(micro_totals)
            state["assistant_target_token_count"] += micro_assistant_tokens
            state["elapsed_wall_clock_seconds"] += time.monotonic() - segment_start
            segment_start = time.monotonic()
            state["peak_rss_bytes"] = max(
                state["peak_rss_bytes"], current_rss_bytes(psutil)
            )
            event = {
                "schema": TRAINING_EVENT_SCHEMA,
                "global_update_step": update_step,
                "next_record_offset": state["next_record_offset"],
                "learning_rate": learning_rate,
                "sft_loss_mean": sum(micro_sft) / len(micro_sft),
                "preservation_kl_loss_mean": sum(micro_kl) / len(micro_kl),
                "total_loss_mean": update_loss,
                "gradient_norm_before_clip": gradient_norm,
                "consecutive_loss_increases": state["consecutive_loss_increases"],
                "peak_rss_bytes": state["peak_rss_bytes"],
                "elapsed_wall_clock_seconds": state["elapsed_wall_clock_seconds"],
            }
            _append_event(event_stream, event)
            if (
                state["consecutive_loss_increases"]
                >= stop_rules["maximum_consecutive_loss_increases"]
            ):
                raise TerminalStop(
                    "consecutive-loss-increases",
                    "training reached its preregistered consecutive-loss-increase stop",
                )
            final_step = update_step == total_updates
            if final_step or update_step % training["checkpoint_interval_steps"] == 0:
                checkpoint = _write_checkpoint(
                    model,
                    optimizer,
                    torch,
                    inputs.output_root,
                    state,
                    parent_sha256,
                    eligible_for_candidate_selection=final_step,
                )
                parent_sha256 = checkpoint.receipt_identity.sha256
                latest = checkpoint
        event_stream.close()
        _finish_segment(segment, "complete")
        if latest is None or latest.receipt["global_update_step"] != total_updates:
            raise RuntimeError("training ended without a complete final checkpoint")
        if state["loss_observation_count"] != len(inputs.records):
            raise RuntimeError(
                "final checkpoint does not account for every curriculum record"
            )
        if state["assistant_target_token_count"] <= 0:
            raise RuntimeError("final checkpoint has no assistant target tokens")
        metrics = {
            "global_update_steps": total_updates,
            "loss_observation_count": state["loss_observation_count"],
            "assistant_target_tokens": state["assistant_target_token_count"],
            "total_loss_mean": state["total_loss_sum"]
            / state["loss_observation_count"],
            "sft_loss_mean": state["sft_loss_sum"] / state["loss_observation_count"],
            "preservation_kl_loss_mean": state["preservation_kl_loss_sum"]
            / state["loss_observation_count"],
            "elapsed_wall_clock_seconds": state["elapsed_wall_clock_seconds"],
            "peak_rss_bytes": state["peak_rss_bytes"],
            "post_training_behavior_floor_pending": True,
            "post_training_preservation_floor_pending": True,
        }
        return _finalize_candidate(inputs, latest, metrics)
    except TerminalStop as error:
        state["elapsed_wall_clock_seconds"] += time.monotonic() - segment_start
        state["peak_rss_bytes"] = max(
            state["peak_rss_bytes"], current_rss_bytes(psutil)
        )
        event_stream.close()
        _finish_segment(segment, "terminal-reject", error.reason_code)
        _terminal_rejection(inputs, model, error.reason_code, state)
        raise
    except KeyboardInterrupt:
        event_stream.close()
        _finish_segment(segment, "interrupted", "operator-cancelled")
        raise
    except BaseException:
        event_stream.close()
        with contextlib.suppress(Exception):
            _finish_segment(segment, "interrupted", "infrastructure-or-program-error")
        raise


def verification_summary(inputs: VerifiedTrainingInputs) -> dict[str, Any]:
    return {
        "status": "pass",
        "profile_id": inputs.profile["profile_id"],
        "profile_sha256": inputs.profile_identity.sha256,
        "training_lock_sha256": inputs.training_lock_identity.sha256,
        "environment_lock_sha256": inputs.environment_lock_identity.sha256,
        "source_repo_id": EXPECTED_SOURCE_REPO_ID,
        "source_revision": EXPECTED_SOURCE_REVISION,
        "curriculum_sha256": inputs.curriculum_identity.sha256,
        "record_count": len(inputs.records),
        "record_order_sha256": inputs.record_order_sha256,
        "output_root_binding_sha256": sha256_bytes(
            canonical_json_bytes(str(inputs.output_root))
        ),
        "training_authorized": True,
        "training_executed": False,
        "quality_claim": "none",
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    seal = subparsers.add_parser(
        "seal-wheelhouse", help="seal an immutable all-wheel environment source"
    )
    seal.add_argument("environment_spec", type=Path)
    seal.add_argument("wheelhouse_root", type=Path)
    seal.add_argument("output_manifest", type=Path)
    capture = subparsers.add_parser(
        "capture-environment", help="capture a non-authorizing active environment lock"
    )
    capture.add_argument("environment_spec", type=Path)
    capture.add_argument("profile", type=Path)
    capture.add_argument("wheelhouse_manifest", type=Path)
    capture.add_argument("output_lock", type=Path)
    verify_env = subparsers.add_parser(
        "verify-environment", help="rehash and probe an environment lock"
    )
    verify_env.add_argument("environment_spec", type=Path)
    verify_env.add_argument("profile", type=Path)
    verify_env.add_argument("environment_lock", type=Path)
    verify = subparsers.add_parser(
        "verify-training-lock", help="verify all inputs without training"
    )
    quarantine = subparsers.add_parser(
        "quarantine-interrupted-output",
        help="preserve incomplete checkpoint or candidate staging before resume",
    )
    for command in (verify, quarantine):
        command.add_argument("profile", type=Path)
        command.add_argument("training_lock", type=Path)
        command.add_argument("environment_spec", type=Path)
        command.add_argument("environment_lock", type=Path)
        command.add_argument("source_root", type=Path)
        command.add_argument("curriculum", type=Path)
    train = subparsers.add_parser("train", help="run the sole authorized CPU pilot")
    train.add_argument("profile", type=Path)
    train.add_argument("training_lock", type=Path)
    train.add_argument("environment_spec", type=Path)
    train.add_argument("environment_lock", type=Path)
    train.add_argument("source_root", type=Path)
    train.add_argument("curriculum", type=Path)
    train.add_argument("--resume", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "seal-wheelhouse":
        specification = load_environment_spec(args.environment_spec)
        result = seal_wheelhouse(
            specification, args.wheelhouse_root, args.output_manifest
        )
    elif args.command == "capture-environment":
        specification = load_environment_spec(args.environment_spec)
        result = capture_environment_lock(
            specification, args.profile, args.wheelhouse_manifest, args.output_lock
        )
    elif args.command == "verify-environment":
        specification = load_environment_spec(args.environment_spec)
        lock, identity, manifest_path = verify_environment_lock(
            specification, args.profile, args.environment_lock, probe_runtime=True
        )
        result = {
            "status": "pass",
            "environment_id": lock["environment_id"],
            "environment_lock_sha256": identity.sha256,
            "wheelhouse_manifest": str(manifest_path),
            "training_authority": False,
        }
    else:
        inputs = verify_training_inputs(
            args.profile,
            args.training_lock,
            args.environment_spec,
            args.environment_lock,
            args.source_root,
            args.curriculum,
            probe_runtime=args.command != "quarantine-interrupted-output",
        )
        if args.command == "verify-training-lock":
            result = verification_summary(inputs)
        elif args.command == "quarantine-interrupted-output":
            result = quarantine_interrupted_output(inputs)
        else:
            result = run_training(inputs, resume=args.resume)
    print(json.dumps(result, ensure_ascii=True, allow_nan=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
