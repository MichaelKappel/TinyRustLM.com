"""Materialize reviewed teacher records for the Rust distillation freeze gate."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CONTROL_SCHEMA_V1 = "tinyrustlm.distillation_dataset_import.v1"
CONTROL_SCHEMA_V2 = "tinyrustlm.distillation_dataset_import.v2"
CONTROL_SCHEMAS = {CONTROL_SCHEMA_V1, CONTROL_SCHEMA_V2}
ROLE_HISTORY_SCHEMA = "tinyrustlm.role_history.v1"
MAX_CONTROL_BYTES = 16 * 1024 * 1024
MAX_SOURCE_BYTES = 1024 * 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024
TASK_FAMILIES = {
    "greeting-capability",
    "ambiguous-clarification",
    "factual-qa",
    "arithmetic-logic",
    "practical-judgment",
    "adult-lawful-inquiry",
    "summarization",
    "extraction",
    "rewrite",
    "code-explanation",
    "strict-json",
    "instruction-conflict",
    "multi-turn-state",
    "prompt-injection",
    "refusal-boundary",
    "repetition-truncation",
    "unseen-domain-uncertainty",
    "uaix-memory-grounding",
}
CONTROL_KEYS = {
    "schema",
    "dataset_id",
    "dataset_license_route",
    "dataset_purpose",
    "tokenizer_alignment",
    "teacher",
    "student",
    "sources",
}
TEACHER_DIRECTORY_KEYS = {
    "model_id",
    "revision",
    "model_dir",
    "generation_profile",
}
TEACHER_ARTIFACT_KEYS = {
    "model_id",
    "revision",
    "weight_file",
    "tokenizer_identity_file",
    "generation_profile",
}
STUDENT_KEYS = {"model_id", "revision", "model_dir"}
SOURCE_KEYS = {"path", "sha256"}
RECORD_KEYS_V1 = {
    "id",
    "task_family",
    "prompt",
    "response",
    "source_id",
    "source_license",
    "source_record_id",
}
RECORD_KEYS_V2 = RECORD_KEYS_V1 | {"history"}
MESSAGE_KEYS = {"role", "content"}


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class ReviewedRecord:
    record_id: str
    task_family: str
    prompt: str
    response: str
    history: tuple[ChatMessage, ...]
    source_id: str
    source_license: str
    source_record_id: str


@dataclass(frozen=True)
class DatasetPlan:
    control_path: Path
    control: dict[str, Any]
    teacher_dir: Path
    student_dir: Path
    teacher_weight_sha256: str
    teacher_tokenizer_sha256: str
    student_weight_sha256: str
    student_tokenizer_sha256: str
    source_receipts: tuple[dict[str, Any], ...]
    records: tuple[ReviewedRecord, ...]


def sha256_bytes(payload: bytes) -> str:
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def write_utf8_bytes(path: Path, text: str) -> None:
    """Write exact UTF-8 bytes without platform newline translation."""
    path.write_bytes(text.encode("utf-8"))


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
        raise ValueError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise ValueError(f"{label} key mismatch; missing={missing}; unknown={unknown}")


def require_string(value: dict[str, Any], key: str, label: str) -> str:
    result = value.get(key)
    if not isinstance(result, str) or not result:
        raise ValueError(f"{label}.{key} must be a non-empty string")
    return result


def validate_evidence(value: str, label: str, minimum: int = 1) -> str:
    if (
        len(value) < minimum
        or len(value) > 512
        or value.strip() != value
        or any(char in value for char in "\r\n\0")
    ):
        raise ValueError(f"{label} is not a valid manifest evidence value")
    return value


def validate_slug(value: str, label: str) -> str:
    if (
        not value
        or len(value) > 128
        or any(
            not (char.isascii() and (char.isalnum() or char in "._-"))
            for char in value
        )
    ):
        raise ValueError(f"{label} must be a stable ASCII slug")
    return value


def require_sha256(value: str, label: str) -> str:
    prefix = "sha256:"
    if (
        not value.startswith(prefix)
        or len(value) != len(prefix) + 64
        or any(char not in "0123456789abcdefABCDEF" for char in value[len(prefix) :])
    ):
        raise ValueError(f"{label} must be a sha256: value")
    return value.lower()


def resolve_control_path(control_path: Path, value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = control_path.parent / path
    return path.resolve()


def validate_checkpoint_dir(path: Path, label: str) -> tuple[str, str]:
    if not path.is_dir() or path.is_symlink():
        raise ValueError(f"{label} model_dir must be a non-symlink directory: {path}")
    weight = path / "model.safetensors"
    tokenizer = path / "tokenizer.json"
    read_regular_bytes(weight, 64 * 1024 * 1024 * 1024, f"{label} weights")
    read_regular_bytes(tokenizer, MAX_CONTROL_BYTES, f"{label} tokenizer")
    return sha256_file(weight), sha256_file(tokenizer)


def validate_teacher_identity(
    control_path: Path, teacher: dict[str, Any]
) -> tuple[Path, str, str]:
    keys = set(teacher)
    if keys == TEACHER_DIRECTORY_KEYS:
        directory = resolve_control_path(
            control_path, require_string(teacher, "model_dir", "teacher")
        )
        weight_sha256, tokenizer_sha256 = validate_checkpoint_dir(directory, "teacher")
        return directory, weight_sha256, tokenizer_sha256
    if keys == TEACHER_ARTIFACT_KEYS:
        weight = resolve_control_path(
            control_path, require_string(teacher, "weight_file", "teacher")
        )
        tokenizer = resolve_control_path(
            control_path,
            require_string(teacher, "tokenizer_identity_file", "teacher"),
        )
        read_regular_bytes(weight, 64 * 1024 * 1024 * 1024, "teacher weights")
        read_regular_bytes(tokenizer, 64 * 1024 * 1024 * 1024, "teacher tokenizer identity")
        return weight.parent, sha256_file(weight), sha256_file(tokenizer)
    raise ValueError(
        "teacher must provide either model_dir or weight_file plus tokenizer_identity_file"
    )


def validate_record_text(text: str, source_label: str, record_id: str, label: str) -> str:
    encoded = text.encode("utf-8")
    if not text.strip() or len(encoded) > MAX_RECORD_BYTES or "\0" in text:
        raise ValueError(f"{source_label} record {record_id} {label} is invalid")
    return text


def parse_history(
    value: Any, source_label: str, record_id: str
) -> tuple[ChatMessage, ...]:
    if not isinstance(value, list) or not 2 <= len(value) <= 12 or len(value) % 2 != 0:
        raise ValueError(
            f"{source_label} record {record_id} history must contain 1..=6 complete turns"
        )
    messages: list[ChatMessage] = []
    for index, message in enumerate(value):
        label = f"{source_label} record {record_id} history[{index}]"
        if not isinstance(message, dict):
            raise ValueError(f"{label} must be a JSON object")
        require_exact_keys(message, MESSAGE_KEYS, label)
        expected_role = "user" if index % 2 == 0 else "assistant"
        role = require_string(message, "role", label)
        if role != expected_role:
            raise ValueError(f"{label}.role must be {expected_role}")
        content = validate_record_text(
            require_string(message, "content", label), source_label, record_id, f"history[{index}]"
        )
        messages.append(ChatMessage(role, content))
    return tuple(messages)


def parse_record(
    value: Any, source_label: str, line_number: int, structured_history: bool
) -> ReviewedRecord:
    if not isinstance(value, dict):
        raise ValueError(f"{source_label} line {line_number} must be a JSON object")
    require_exact_keys(
        value,
        RECORD_KEYS_V2 if structured_history else RECORD_KEYS_V1,
        f"{source_label} line {line_number}",
    )
    record_id = validate_slug(
        require_string(value, "id", source_label), f"{source_label} record id"
    )
    task_family = require_string(value, "task_family", source_label)
    if task_family not in TASK_FAMILIES:
        raise ValueError(f"{source_label} record {record_id} has an unknown task_family")
    prompt = validate_record_text(
        require_string(value, "prompt", source_label), source_label, record_id, "prompt"
    )
    response = validate_record_text(
        require_string(value, "response", source_label), source_label, record_id, "response"
    )
    history = (
        parse_history(value.get("history"), source_label, record_id)
        if structured_history
        else ()
    )
    return ReviewedRecord(
        record_id=record_id,
        task_family=task_family,
        prompt=prompt,
        response=response,
        history=history,
        source_id=validate_evidence(
            require_string(value, "source_id", source_label), "source_id", 8
        ),
        source_license=validate_evidence(
            require_string(value, "source_license", source_label), "source_license", 8
        ),
        source_record_id=validate_evidence(
            require_string(value, "source_record_id", source_label),
            "source_record_id",
            8,
        ),
    )


def read_jsonl_records(path: Path, structured_history: bool) -> list[ReviewedRecord]:
    payload = read_regular_bytes(path, MAX_SOURCE_BYTES, "reviewed teacher JSONL")
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"reviewed teacher JSONL must be UTF-8: {path}") from error
    records = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid JSONL at {path}:{line_number}") from error
        records.append(parse_record(value, str(path), line_number, structured_history))
    if not records:
        raise ValueError(f"reviewed teacher JSONL has no records: {path}")
    return records


def build_dataset_plan(control_path: Path) -> DatasetPlan:
    control_path = control_path.resolve()
    control = read_json_object(control_path, MAX_CONTROL_BYTES, "dataset import control")
    require_exact_keys(control, CONTROL_KEYS, "dataset import control")
    schema = control.get("schema")
    if schema not in CONTROL_SCHEMAS:
        raise ValueError("dataset import control schema is unsupported")
    structured_history = schema == CONTROL_SCHEMA_V2
    validate_slug(require_string(control, "dataset_id", "control"), "dataset_id")
    validate_evidence(
        require_string(control, "dataset_license_route", "control"),
        "dataset_license_route",
        8,
    )
    validate_evidence(
        require_string(control, "dataset_purpose", "control"), "dataset_purpose", 8
    )
    alignment = require_string(control, "tokenizer_alignment", "control")
    if alignment not in {
        "same-tokenizer-token-and-sequence",
        "cross-tokenizer-sequence-only",
    }:
        raise ValueError("tokenizer_alignment is unsupported")

    teacher = control.get("teacher")
    student = control.get("student")
    if not isinstance(teacher, dict) or not isinstance(student, dict):
        raise ValueError("teacher and student must be JSON objects")
    require_exact_keys(student, STUDENT_KEYS, "student")
    for identity, label in ((teacher, "teacher"), (student, "student")):
        validate_evidence(require_string(identity, "model_id", label), f"{label}.model_id", 3)
        validate_evidence(require_string(identity, "revision", label), f"{label}.revision", 8)
    validate_evidence(
        require_string(teacher, "generation_profile", "teacher"),
        "teacher.generation_profile",
        8,
    )
    teacher_dir, teacher_weight, teacher_tokenizer = validate_teacher_identity(
        control_path, teacher
    )
    student_dir = resolve_control_path(
        control_path, require_string(student, "model_dir", "student")
    )
    student_weight, student_tokenizer = validate_checkpoint_dir(student_dir, "student")
    if alignment == "same-tokenizer-token-and-sequence" and teacher_tokenizer != student_tokenizer:
        raise ValueError("same-tokenizer alignment requires identical tokenizer.json bytes")

    sources = control.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("sources must be a non-empty list")
    records: list[ReviewedRecord] = []
    receipts: list[dict[str, Any]] = []
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ValueError(f"sources[{index}] must be a JSON object")
        require_exact_keys(source, SOURCE_KEYS, f"sources[{index}]")
        path = resolve_control_path(
            control_path, require_string(source, "path", f"sources[{index}]")
        )
        actual_sha256 = sha256_file(path)
        expected_sha256 = require_sha256(
            require_string(source, "sha256", f"sources[{index}]"),
            f"sources[{index}].sha256",
        )
        if actual_sha256 != expected_sha256:
            raise ValueError(f"sources[{index}] SHA-256 does not match local bytes")
        source_records = read_jsonl_records(path, structured_history)
        records.extend(source_records)
        receipts.append(
            {
                "path": str(path),
                "sha256": actual_sha256,
                "record_count": len(source_records),
            }
        )
    records.sort(key=lambda record: record.record_id)
    ids = [record.record_id for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError("reviewed teacher records contain duplicate ids")
    source_record_ids = [record.source_record_id for record in records]
    if len(source_record_ids) != len(set(source_record_ids)):
        raise ValueError("reviewed teacher records contain duplicate source_record_id values")
    return DatasetPlan(
        control_path=control_path,
        control=control,
        teacher_dir=teacher_dir,
        student_dir=student_dir,
        teacher_weight_sha256=teacher_weight,
        teacher_tokenizer_sha256=teacher_tokenizer,
        student_weight_sha256=student_weight,
        student_tokenizer_sha256=student_tokenizer,
        source_receipts=tuple(receipts),
        records=tuple(records),
    )


def write_dataset(plan: DatasetPlan, output_dir: Path) -> None:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        records_dir = staging / "records"
        records_dir.mkdir()
        teacher = plan.control["teacher"]
        student = plan.control["student"]
        lines = [
            (
                "tinyrustlm_distillation_dataset_source_version",
                "2" if plan.control["schema"] == CONTROL_SCHEMA_V2 else "1",
            ),
            ("dataset_id", plan.control["dataset_id"]),
            ("dataset_split", "train"),
            ("dataset_license_route", plan.control["dataset_license_route"]),
            ("dataset_purpose", plan.control["dataset_purpose"]),
            ("teacher_model_id", teacher["model_id"]),
            ("teacher_revision", teacher["revision"]),
            ("teacher_weight_sha256", plan.teacher_weight_sha256),
            ("teacher_tokenizer_sha256", plan.teacher_tokenizer_sha256),
            ("teacher_generation_profile", teacher["generation_profile"]),
            ("student_model_id", student["model_id"]),
            ("student_revision", student["revision"]),
            ("student_weight_sha256", plan.student_weight_sha256),
            ("student_tokenizer_sha256", plan.student_tokenizer_sha256),
            ("tokenizer_alignment", plan.control["tokenizer_alignment"]),
            ("record_count", str(len(plan.records))),
        ]
        for index, record in enumerate(plan.records):
            stem = f"{index:06d}-{record.record_id}"
            prompt_file = f"records/{stem}.prompt.txt"
            response_file = f"records/{stem}.response.txt"
            history_file = f"records/{stem}.history.json"
            write_utf8_bytes(staging / prompt_file, record.prompt)
            write_utf8_bytes(staging / response_file, record.response)
            if record.history:
                history_payload = {
                    "schema": ROLE_HISTORY_SCHEMA,
                    "messages": [
                        {"role": message.role, "content": message.content}
                        for message in record.history
                    ],
                }
                write_utf8_bytes(
                    staging / history_file,
                    json.dumps(
                        history_payload,
                        ensure_ascii=False,
                        separators=(",", ":"),
                        sort_keys=True,
                    )
                    + "\n",
                )
            prefix = f"record.{index}"
            record_lines = [
                (f"{prefix}.id", record.record_id),
                (f"{prefix}.task_family", record.task_family),
            ]
            if record.history:
                record_lines.extend(
                    [
                        (f"{prefix}.history_file", history_file),
                        (f"{prefix}.history_message_count", str(len(record.history))),
                    ]
                )
            record_lines.extend(
                [
                    (f"{prefix}.prompt_file", prompt_file),
                    (f"{prefix}.response_file", response_file),
                    (f"{prefix}.source_id", record.source_id),
                    (f"{prefix}.source_license", record.source_license),
                    (f"{prefix}.source_record_id", record.source_record_id),
                    (f"{prefix}.target_kind", "teacher-final-answer"),
                    (f"{prefix}.teacher_reasoning_included", "false"),
                ]
            )
            lines.extend(record_lines)
        manifest = "".join(f"{key}={value}\n" for key, value in lines)
        manifest_path = staging / "distillation-dataset-source.manifest"
        write_utf8_bytes(manifest_path, manifest)
        receipt = {
            "schema": "tinyrustlm.distillation_dataset_import_receipt.v1",
            "control_path": str(plan.control_path),
            "control_sha256": sha256_file(plan.control_path),
            "source_manifest_sha256": sha256_file(manifest_path),
            "teacher_weight_sha256": plan.teacher_weight_sha256,
            "teacher_tokenizer_sha256": plan.teacher_tokenizer_sha256,
            "student_weight_sha256": plan.student_weight_sha256,
            "student_tokenizer_sha256": plan.student_tokenizer_sha256,
            "record_count": len(plan.records),
            "structured_history_record_count": sum(
                1 for record in plan.records if record.history
            ),
            "sources": list(plan.source_receipts),
            "required_next_gate": "rust-freeze-with-materialized-public-shadow-and-sealed-exclusions",
        }
        write_utf8_bytes(
            staging / "dataset-import-receipt.json",
            json.dumps(receipt, indent=2, sort_keys=True) + "\n",
        )
        os.replace(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def summary(plan: DatasetPlan, output_dir: Path) -> dict[str, Any]:
    return {
        "status": "pass",
        "dataset_id": plan.control["dataset_id"],
        "record_count": len(plan.records),
        "structured_history_record_count": sum(
            1 for record in plan.records if record.history
        ),
        "source_count": len(plan.source_receipts),
        "tokenizer_alignment": plan.control["tokenizer_alignment"],
        "output_dir": str(output_dir.resolve()),
        "required_next_gate": "freeze-distillation-dataset",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("control", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    plan = build_dataset_plan(args.control)
    if not args.verify_only:
        write_dataset(plan, args.output_dir)
    print(json.dumps(summary(plan, args.output_dir), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
