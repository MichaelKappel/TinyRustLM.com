"""Build a deterministic, hash-bound top-k teacher-logit cache.

This worker is intentionally limited to byte-identical teacher/student tokenizers.
Cross-tokenizer teachers remain sequence-distillation sources and cannot enter this
token-level path.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import random
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CONTROL_SCHEMA = "tinyrustlm.topk_logit_cache_control.v1"
CONTROL_KEYS = {
    "schema",
    "cache_id",
    "sequence_recipe",
    "teacher",
    "output_dir",
    "top_k",
    "temperature",
    "device",
    "dtype",
}
TEACHER_KEYS = {
    "model_id",
    "revision",
    "model_dir",
    "model_identity_sha256",
    "tokenizer_sha256",
}
MAX_CONTROL_BYTES = 1024 * 1024
MAX_IDENTITY_FILE_BYTES = 1024 * 1024
MAX_MODEL_ARTIFACT_BYTES = 64 * 1024 * 1024 * 1024


def load_trainer_contract() -> Any:
    module_name = "tinyrustlm_train_distilled_lora_for_topk_cache"
    existing = sys.modules.get(module_name)
    if existing is not None:
        return existing
    path = Path(__file__).with_name("train-distilled-lora.py")
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load the TinyRustLM distillation contract")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


TRAINER = load_trainer_contract()


@dataclass(frozen=True)
class ModelArtifact:
    relative_path: str
    byte_count: int
    sha256: str


@dataclass(frozen=True)
class TeacherIdentity:
    model_dir: Path
    artifacts: tuple[ModelArtifact, ...]
    model_identity_sha256: str
    tokenizer_sha256: str
    vocab_size: int


@dataclass(frozen=True)
class CachePlan:
    control_path: Path
    cache_id: str
    sequence_recipe_path: Path
    sequence_inputs: Any
    teacher_model_id: str
    teacher_revision: str
    teacher_identity: TeacherIdentity
    output_dir: Path
    top_k: int
    temperature: float
    device: str
    dtype: str


def require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    unknown = sorted(set(value) - expected)
    missing = sorted(expected - set(value))
    if unknown:
        raise ValueError(f"{label} has unknown keys: {', '.join(unknown)}")
    if missing:
        raise ValueError(f"{label} is missing keys: {', '.join(missing)}")


def read_json_object(path: Path, maximum: int, label: str) -> dict[str, Any]:
    payload = TRAINER.read_bounded_bytes(path, maximum, label)
    try:
        value = json.loads(
            payload,
            parse_constant=lambda constant: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {constant}")
            ),
        )
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def resolve_control_path(control_path: Path, value: Any, label: str) -> Path:
    if not isinstance(value, str) or not value or "\0" in value:
        raise ValueError(f"{label} must be a non-empty path string")
    path = Path(value)
    if not path.is_absolute():
        path = control_path.parent / path
    return path.resolve()


def require_text(value: Any, label: str, maximum: int = 512) -> str:
    if (
        not isinstance(value, str)
        or not value
        or len(value) > maximum
        or any(ord(character) < 32 for character in value)
    ):
        raise ValueError(f"{label} must be a non-empty printable string")
    return value


def inspect_teacher_identity(model_dir: Path) -> TeacherIdentity:
    model_dir = model_dir.resolve()
    if not model_dir.is_dir() or model_dir.is_symlink():
        raise ValueError("teacher model_dir must be a non-symlink directory")
    required = [model_dir / "config.json", model_dir / "tokenizer.json"]
    weight_files = sorted(model_dir.glob("*.safetensors"), key=lambda path: path.name)
    if not weight_files:
        raise ValueError("teacher model_dir contains no safetensors weights")
    index_file = model_dir / "model.safetensors.index.json"
    candidates = required + weight_files + ([index_file] if index_file.exists() else [])
    artifacts: list[ModelArtifact] = []
    for path in sorted(set(candidates), key=lambda item: item.relative_to(model_dir).as_posix()):
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"teacher artifact must be a regular non-symlink file: {path}")
        byte_count = path.stat().st_size
        if not 1 <= byte_count <= MAX_MODEL_ARTIFACT_BYTES:
            raise ValueError(f"teacher artifact byte length is invalid: {path}")
        artifacts.append(
            ModelArtifact(
                relative_path=path.relative_to(model_dir).as_posix(),
                byte_count=byte_count,
                sha256=TRAINER.sha256_file(path),
            )
        )
    artifact_payload = [
        {
            "relative_path": artifact.relative_path,
            "bytes": artifact.byte_count,
            "sha256": artifact.sha256,
        }
        for artifact in artifacts
    ]
    config = read_json_object(model_dir / "config.json", MAX_IDENTITY_FILE_BYTES, "teacher config")
    vocab_size = config.get("vocab_size")
    if isinstance(vocab_size, bool) or not isinstance(vocab_size, int) or vocab_size < 2:
        raise ValueError("teacher config vocab_size must be an integer of at least two")
    return TeacherIdentity(
        model_dir=model_dir,
        artifacts=tuple(artifacts),
        model_identity_sha256=TRAINER.model_artifact_set_sha256(artifact_payload),
        tokenizer_sha256=TRAINER.sha256_file(model_dir / "tokenizer.json"),
        vocab_size=vocab_size,
    )


def verify_control(control_path: Path) -> CachePlan:
    control_path = control_path.resolve()
    control = read_json_object(control_path, MAX_CONTROL_BYTES, "top-k cache control")
    require_exact_keys(control, CONTROL_KEYS, "top-k cache control")
    if control["schema"] != CONTROL_SCHEMA:
        raise ValueError("top-k cache control schema is unsupported")
    cache_id = require_text(control["cache_id"], "cache_id", 256)
    if any(
        not (character.isascii() and (character.isalnum() or character in "._-"))
        for character in cache_id
    ):
        raise ValueError("cache_id must be a stable ASCII identifier")

    sequence_recipe_path = resolve_control_path(
        control_path, control["sequence_recipe"], "sequence_recipe"
    )
    sequence_inputs = TRAINER.verify_recipe(
        sequence_recipe_path, allow_populated_output=True
    )
    if TRAINER.require(sequence_inputs.recipe, "training_engine") != TRAINER.TRAINING_ENGINE:
        raise ValueError("sequence_recipe must use the sequence-only training engine")

    teacher = control["teacher"]
    if not isinstance(teacher, dict):
        raise ValueError("teacher must be a JSON object")
    require_exact_keys(teacher, TEACHER_KEYS, "teacher")
    teacher_model_id = require_text(teacher["model_id"], "teacher.model_id")
    teacher_revision = require_text(teacher["revision"], "teacher.revision")
    teacher_dir = resolve_control_path(control_path, teacher["model_dir"], "teacher.model_dir")
    identity = inspect_teacher_identity(teacher_dir)
    expected_identity = teacher["model_identity_sha256"]
    if not isinstance(expected_identity, str):
        raise ValueError("teacher.model_identity_sha256 must be a string")
    TRAINER.require_sha256(expected_identity, "teacher.model_identity_sha256")
    if identity.model_identity_sha256 != expected_identity:
        raise ValueError("teacher model identity SHA-256 drift")
    expected_tokenizer = teacher["tokenizer_sha256"]
    if not isinstance(expected_tokenizer, str):
        raise ValueError("teacher.tokenizer_sha256 must be a string")
    TRAINER.require_sha256(expected_tokenizer, "teacher.tokenizer_sha256")
    if identity.tokenizer_sha256 != expected_tokenizer:
        raise ValueError("teacher tokenizer SHA-256 drift")
    student_tokenizer = TRAINER.sha256_file(
        sequence_inputs.base_model_dir / "tokenizer.json"
    )
    if identity.tokenizer_sha256 != student_tokenizer:
        raise ValueError(
            "top-k caching requires byte-identical teacher and student tokenizers"
        )

    top_k = control["top_k"]
    if (
        isinstance(top_k, bool)
        or not isinstance(top_k, int)
        or not 1 <= top_k < identity.vocab_size
    ):
        raise ValueError("top_k must be an integer smaller than teacher vocab_size")
    temperature_value = control["temperature"]
    if isinstance(temperature_value, bool) or not isinstance(
        temperature_value, (int, float)
    ):
        raise ValueError("temperature must be a finite number in [0.1, 10.0]")
    temperature = float(temperature_value)
    if not math.isfinite(temperature) or not 0.1 <= temperature <= 10.0:
        raise ValueError("temperature must be a finite number in [0.1, 10.0]")
    device = control["device"]
    dtype = control["dtype"]
    if device not in {"cpu", "cuda"}:
        raise ValueError("device must be cpu or cuda")
    if dtype not in {"float32", "float16", "bfloat16"}:
        raise ValueError("dtype must be float32, float16, or bfloat16")
    if device == "cpu" and dtype != "float32":
        raise ValueError("CPU cache generation is restricted to float32")
    output_dir = resolve_control_path(control_path, control["output_dir"], "output_dir")
    return CachePlan(
        control_path=control_path,
        cache_id=cache_id,
        sequence_recipe_path=sequence_recipe_path,
        sequence_inputs=sequence_inputs,
        teacher_model_id=teacher_model_id,
        teacher_revision=teacher_revision,
        teacher_identity=identity,
        output_dir=output_dir,
        top_k=top_k,
        temperature=temperature,
        device=device,
        dtype=dtype,
    )


def extract_topk_distribution(
    torch_module: Any,
    logits: Any,
    *,
    top_k: int,
    temperature: float,
) -> tuple[list[int], list[float], float]:
    torch = torch_module
    if logits.ndim != 1 or not 1 <= top_k < logits.numel():
        raise RuntimeError("teacher logits or top_k have an invalid shape")
    scaled = logits.detach().float() / temperature
    if not bool(torch.isfinite(scaled).all().item()):
        raise RuntimeError("teacher produced non-finite logits")
    top_values, _ = torch.topk(scaled, top_k, sorted=True)
    threshold = top_values[-1]
    strict_ids = torch.nonzero(scaled > threshold, as_tuple=False).flatten()
    remaining = top_k - int(strict_ids.numel())
    tied_ids = torch.nonzero(scaled == threshold, as_tuple=False).flatten()[:remaining]
    selected_ids = torch.cat((strict_ids, tied_ids))
    if int(selected_ids.numel()) != top_k:
        raise RuntimeError("could not resolve a deterministic top-k teacher set")
    pairs = sorted(
        (
            (int(token_id), float(scaled[token_id].item()))
            for token_id in selected_ids.tolist()
        ),
        key=lambda pair: (-pair[1], pair[0]),
    )
    canonical_ids = [token_id for token_id, _ in pairs]
    index = torch.tensor(canonical_ids, dtype=torch.long, device=scaled.device)
    full_log_normalizer = torch.logsumexp(scaled.double(), dim=0)
    selected_values = scaled[index].double()
    tail_mask = torch.ones(scaled.numel(), dtype=torch.bool, device=scaled.device)
    tail_mask[index] = False
    tail_log_probability = float(
        (torch.logsumexp(scaled[tail_mask].double(), dim=0) - full_log_normalizer).item()
    )
    log_probabilities = [
        float((value - full_log_normalizer).item()) for value in selected_values
    ]
    mass = math.fsum(math.exp(value) for value in log_probabilities) + math.exp(
        tail_log_probability
    )
    if not math.isclose(mass, 1.0, rel_tol=0.0, abs_tol=5e-7):
        raise RuntimeError("top-k plus tail teacher probability mass is not normalized")
    return canonical_ids, log_probabilities, tail_log_probability


def collect_cache_rows(plan: CachePlan) -> tuple[list[dict[str, Any]], dict[str, str]]:
    try:
        import torch
        import transformers
        from transformers import AutoModelForCausalLM, AutoTokenizer, set_seed
    except ImportError as error:
        raise RuntimeError(
            "cache generation requires torch, transformers, and safetensors"
        ) from error
    if plan.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("cache control requires CUDA, but torch reports no usable device")
    dtype = {
        "float32": torch.float32,
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
    }[plan.dtype]
    if plan.device == "cuda" and dtype == torch.bfloat16 and not torch.cuda.is_bf16_supported():
        raise RuntimeError("cache control requests bfloat16 on unsupported CUDA hardware")

    seed = 20260711
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.use_deterministic_algorithms(True)
    set_seed(seed)
    tokenizer = AutoTokenizer.from_pretrained(
        plan.sequence_inputs.base_model_dir, local_files_only=True
    )
    tokenized = TRAINER.tokenize_records(
        tokenizer,
        plan.sequence_inputs.records,
        plan.sequence_inputs.system_prompt,
        TRAINER.parse_int(
            plan.sequence_inputs.recipe, "max_sequence_tokens", 16, 131_072
        ),
    )
    model_options: dict[str, Any] = {"local_files_only": True}
    model_options[TRAINER.transformers_dtype_argument(transformers.__version__)] = dtype
    model = AutoModelForCausalLM.from_pretrained(
        plan.teacher_identity.model_dir, **model_options
    )
    model.to(plan.device)
    model.eval()
    model.config.use_cache = False
    if int(model.config.vocab_size) != plan.teacher_identity.vocab_size:
        raise RuntimeError("loaded teacher vocab_size drifted from its pinned config")

    rows: list[dict[str, Any]] = []
    with torch.inference_mode():
        for record, item in zip(
            plan.sequence_inputs.records, tokenized, strict=True
        ):
            input_ids = torch.tensor(
                [item["input_ids"]], dtype=torch.long, device=plan.device
            )
            attention_mask = torch.tensor(
                [item["attention_mask"]], dtype=torch.long, device=plan.device
            )
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs.logits[0]
            positions = [
                position - 1
                for position in range(1, len(item["labels"]))
                if item["labels"][position] != -100
            ]
            topk_ids: list[list[int]] = []
            topk_probabilities: list[list[float]] = []
            tails: list[float] = []
            for position in positions:
                ids, probabilities, tail = extract_topk_distribution(
                    torch,
                    logits[position],
                    top_k=plan.top_k,
                    temperature=plan.temperature,
                )
                topk_ids.append(ids)
                topk_probabilities.append(probabilities)
                tails.append(tail)
            row = {
                "schema": "tinyrustlm.topk_logit_cache_record.v1",
                "record_id": record.record_id,
                "input_ids": item["input_ids"],
                "input_ids_sha256": TRAINER.token_sequence_sha256(item["input_ids"]),
                "assistant_logit_positions": positions,
                "topk_token_ids": topk_ids,
                "topk_log_probabilities": topk_probabilities,
                "tail_log_probabilities": tails,
            }
            row["record_sha256"] = TRAINER.topk_cache_record_sha256(row)
            rows.append(row)
    return rows, {
        "torch": torch.__version__,
        "transformers": transformers.__version__,
    }


def teacher_identity_payload(plan: CachePlan) -> dict[str, Any]:
    return {
        "schema": "tinyrustlm.teacher_model_identity.v1",
        "model_id": plan.teacher_model_id,
        "revision": plan.teacher_revision,
        "model_identity_sha256": plan.teacher_identity.model_identity_sha256,
        "tokenizer_sha256": plan.teacher_identity.tokenizer_sha256,
        "artifacts": [
            {
                "relative_path": artifact.relative_path,
                "bytes": artifact.byte_count,
                "sha256": artifact.sha256,
            }
            for artifact in plan.teacher_identity.artifacts
        ],
    }


def verify_cache_directory(plan: CachePlan, cache_dir: Path) -> Any:
    cache_dir = cache_dir.resolve()
    if not cache_dir.is_dir() or cache_dir.is_symlink():
        raise ValueError(f"cache directory must be a non-symlink directory: {cache_dir}")
    manifest = cache_dir / "topk-logit-cache.manifest"
    cache_recipe = dict(plan.sequence_inputs.recipe)
    cache_recipe["teacher_logit_cache_manifest"] = str(manifest)
    cache_recipe["teacher_kl_weight"] = "1.0"
    return TRAINER.verify_topk_cache(
        recipe_path=plan.sequence_recipe_path,
        recipe=cache_recipe,
        frozen_manifest_path=plan.sequence_inputs.frozen_manifest_path,
        frozen=plan.sequence_inputs.frozen_manifest,
        records=list(plan.sequence_inputs.records),
    )


def verify_existing_cache(plan: CachePlan) -> Any:
    return verify_cache_directory(plan, plan.output_dir)


def write_cache_bundle(
    plan: CachePlan,
    rows: list[dict[str, Any]],
    *,
    framework_versions: dict[str, str],
) -> Path:
    if plan.output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {plan.output_dir}")
    if len(rows) != len(plan.sequence_inputs.records):
        raise ValueError("cache rows do not cover every frozen record")
    for index, (row, record) in enumerate(
        zip(rows, plan.sequence_inputs.records, strict=True), 1
    ):
        TRAINER.parse_topk_cache_record(
            row,
            expected_record=record,
            max_sequence_tokens=TRAINER.parse_int(
                plan.sequence_inputs.recipe, "max_sequence_tokens", 16, 131_072
            ),
            vocab_size=plan.teacher_identity.vocab_size,
            top_k=plan.top_k,
            line_number=index,
        )
    target_count = sum(len(row["assistant_logit_positions"]) for row in rows)
    plan.output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(
            prefix=f".{plan.output_dir.name}.tmp-", dir=plan.output_dir.parent
        )
    )
    try:
        cache_file = staging / "topk-logits.jsonl"
        with cache_file.open("wb") as stream:
            for row in rows:
                stream.write((TRAINER.canonical_json(row) + "\n").encode("ascii"))
        identity_file = staging / "teacher-identity.json"
        identity_file.write_text(
            json.dumps(teacher_identity_payload(plan), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        manifest_fields = [
            ("tinyrustlm_topk_logit_cache_version", "1"),
            ("cache_status", "complete"),
            ("cache_id", plan.cache_id),
            ("dataset_id", TRAINER.require(plan.sequence_inputs.frozen_manifest, "dataset_id")),
            (
                "frozen_dataset_manifest_sha256",
                TRAINER.sha256_file(plan.sequence_inputs.frozen_manifest_path),
            ),
            ("system_prompt_sha256", TRAINER.require(plan.sequence_inputs.recipe, "system_prompt_sha256")),
            (
                "student_tokenizer_sha256",
                TRAINER.sha256_file(plan.sequence_inputs.base_model_dir / "tokenizer.json"),
            ),
            ("teacher_tokenizer_sha256", plan.teacher_identity.tokenizer_sha256),
            ("tokenizer_alignment", "same-tokenizer-token-and-sequence"),
            ("teacher_model_id", plan.teacher_model_id),
            ("teacher_revision", plan.teacher_revision),
            (
                "teacher_model_identity_sha256",
                plan.teacher_identity.model_identity_sha256,
            ),
            ("teacher_identity_file", identity_file.name),
            ("teacher_identity_file_bytes", str(identity_file.stat().st_size)),
            ("teacher_identity_file_sha256", TRAINER.sha256_file(identity_file)),
            ("probability_contract", "teacher-topk-plus-aggregate-tail-v1"),
            ("mask", "assistant-target-tokens-only"),
            ("numeric_format", "float32-normalized-log-probabilities"),
            (
                "max_sequence_tokens",
                TRAINER.require(plan.sequence_inputs.recipe, "max_sequence_tokens"),
            ),
            ("vocab_size", str(plan.teacher_identity.vocab_size)),
            ("top_k", str(plan.top_k)),
            ("temperature", format(plan.temperature, ".17g")),
            ("record_count", str(len(rows))),
            ("target_position_count", str(target_count)),
            ("cache_file", cache_file.name),
            ("cache_file_bytes", str(cache_file.stat().st_size)),
            ("cache_file_sha256", TRAINER.sha256_file(cache_file)),
        ]
        manifest = staging / "topk-logit-cache.manifest"
        manifest.write_text(
            "".join(f"{key}={value}\n" for key, value in manifest_fields),
            encoding="utf-8",
            newline="\n",
        )
        receipt = {
            "schema": "tinyrustlm.topk_logit_cache_build_receipt.v1",
            "control_path": str(plan.control_path),
            "control_sha256": TRAINER.sha256_file(plan.control_path),
            "sequence_recipe": str(plan.sequence_recipe_path),
            "sequence_recipe_sha256": TRAINER.sha256_file(plan.sequence_recipe_path),
            "cache_manifest_sha256": TRAINER.sha256_file(manifest),
            "cache_file_sha256": TRAINER.sha256_file(cache_file),
            "teacher_model_identity_sha256": plan.teacher_identity.model_identity_sha256,
            "framework_versions": dict(sorted(framework_versions.items())),
            "determinism": {
                "seed": 20260711,
                "deterministic_algorithms": True,
                "canonical_topk_tie_break": "descending-logit-then-ascending-token-id",
            },
            "record_count": len(rows),
            "target_position_count": target_count,
            "required_next_gate": "topk-cache-bound-training-and-held-out-quality-evaluation",
        }
        (staging / "topk-logit-cache-build-receipt.json").write_text(
            json.dumps(receipt, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        verify_cache_directory(plan, staging)
        os.replace(staging, plan.output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return plan.output_dir / "topk-logit-cache.manifest"


def build_cache(plan: CachePlan) -> Path:
    rows, versions = collect_cache_rows(plan)
    return write_cache_bundle(plan, rows, framework_versions=versions)


def summary(plan: CachePlan) -> dict[str, Any]:
    return {
        "status": "pass",
        "cache_id": plan.cache_id,
        "record_count": len(plan.sequence_inputs.records),
        "teacher_model_id": plan.teacher_model_id,
        "teacher_revision": plan.teacher_revision,
        "teacher_model_identity_sha256": plan.teacher_identity.model_identity_sha256,
        "tokenizer_sha256": plan.teacher_identity.tokenizer_sha256,
        "top_k": plan.top_k,
        "temperature": plan.temperature,
        "device": plan.device,
        "dtype": plan.dtype,
        "output_dir": str(plan.output_dir),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("control", type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    plan = verify_control(args.control)
    result = summary(plan)
    if args.verify_only and plan.output_dir.exists():
        cache = verify_existing_cache(plan)
        result["cache_manifest"] = str(cache.manifest_path)
        result["cache_manifest_sha256"] = TRAINER.sha256_file(cache.manifest_path)
        result["target_position_count"] = cache.target_position_count
    elif not args.verify_only:
        manifest = build_cache(plan)
        result["cache_manifest"] = str(manifest)
        result["cache_manifest_sha256"] = TRAINER.sha256_file(manifest)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
