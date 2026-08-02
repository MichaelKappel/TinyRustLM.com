"""Audit distillation inputs for semantic eval leakage and language drift.

The audit is an offline development gate. Its sentence encoder is never part of
the TinyRustLM browser runtime or a published `.slm` artifact. Every model and
input byte used by a production audit is hash-bound by the control file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence


CONTROL_SCHEMA = "tinyrustlm.distillation_corpus_audit.v1"
REPORT_SCHEMA = "tinyrustlm.distillation_corpus_audit_report.v1"
MAX_CONTROL_BYTES = 16 * 1024 * 1024
MAX_PLAN_BYTES = 256 * 1024 * 1024
MAX_REVIEWED_SOURCE_BYTES = 1024 * 1024 * 1024
MAX_EXCLUSION_BYTES = 16 * 1024 * 1024
MAX_ENCODER_FILE_BYTES = 2 * 1024 * 1024 * 1024
MAX_TEXT_BYTES = 1024 * 1024

CONTROL_KEYS = {
    "schema",
    "audit_id",
    "encoder",
    "prompt_plans",
    "eval_exclusions",
    "reviewed_sources",
    "semantic_threshold",
    "linguistic_policy",
}
ENCODER_KEYS = {
    "repo_id",
    "revision",
    "license",
    "model_dir",
    "files",
    "max_length",
    "batch_size",
}
FILE_IDENTITY_KEYS = {"path", "sha256"}
LINGUISTIC_POLICY_KEYS = {
    "max_refusal_language_rate",
    "max_apology_rate",
    "max_disclaimer_rate",
    "max_false_capability_count",
}
PROMPT_KEYS = {"id", "task_family", "prompt", "response_requirements", "max_tokens"}
REVIEWED_KEYS = {
    "id",
    "task_family",
    "prompt",
    "response",
    "source_id",
    "source_license",
    "source_record_id",
}

REFUSAL_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bi (?:can(?:not|'t)|won't|will not) (?:help|assist|provide|comply)",
        r"\bi (?:must|have to) (?:decline|refuse)",
        r"\bi am unable to (?:help|assist|provide|comply)",
        r"\b(?:cannot|can't) assist with (?:that|this)",
    )
)
APOLOGY_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bi(?:'m| am) sorry\b",
        r"\bi apologize\b",
        r"\bmy apologies\b",
    )
)
DISCLAIMER_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bas an ai\b",
        r"\bi am (?:just )?an ai\b",
        r"\bnot (?:a|your) (?:lawyer|doctor|physician|financial advisor)\b",
        r"\bnot (?:legal|medical|financial) advice\b",
        r"\bconsult (?:a|an|your) (?:qualified )?(?:professional|lawyer|doctor|physician|financial advisor)\b",
    )
)
FALSE_CAPABILITY_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bi (?:browsed|searched|checked) (?:the )?(?:web|internet|online)\b",
        r"\bi (?:opened|read|accessed) your (?:file|email|account|calendar|device)\b",
        r"\bi (?:sent|posted|uploaded|downloaded|deleted) (?:the|your|that) ",
        r"\bi (?:called|emailed|messaged|contacted) ",
    )
)


@dataclass(frozen=True)
class PromptRecord:
    record_id: str
    task_family: str
    prompt: str
    source_path: str


@dataclass(frozen=True)
class ExclusionPrompt:
    source_path: str
    index: int
    prompt: str


@dataclass(frozen=True)
class ReviewedRecord:
    record_id: str
    task_family: str
    prompt: str
    response: str


@dataclass(frozen=True)
class SemanticFinding:
    pair_id: str
    score: float
    prompt: PromptRecord
    exclusion: ExclusionPrompt


@dataclass(frozen=True)
class LinguisticPolicy:
    max_refusal_language_rate: float
    max_apology_rate: float
    max_disclaimer_rate: float
    max_false_capability_count: int


@dataclass(frozen=True)
class LinguisticAudit:
    record_count: int
    refusal_language_ids: tuple[str, ...]
    apology_ids: tuple[str, ...]
    disclaimer_ids: tuple[str, ...]
    false_capability_ids: tuple[str, ...]
    failures: tuple[str, ...]

    @property
    def refusal_language_rate(self) -> float:
        return _rate(len(self.refusal_language_ids), self.record_count)

    @property
    def apology_rate(self) -> float:
        return _rate(len(self.apology_ids), self.record_count)

    @property
    def disclaimer_rate(self) -> float:
        return _rate(len(self.disclaimer_ids), self.record_count)


@dataclass(frozen=True)
class EncoderIdentity:
    repo_id: str
    revision: str
    license: str
    model_dir: Path
    files: tuple[dict[str, Any], ...]
    max_length: int
    batch_size: int


@dataclass(frozen=True)
class AuditPlan:
    control_path: Path
    control_sha256: str
    audit_id: str
    encoder: EncoderIdentity
    prompt_identities: tuple[dict[str, Any], ...]
    exclusion_identities: tuple[dict[str, Any], ...]
    reviewed_identities: tuple[dict[str, Any], ...]
    prompts: tuple[PromptRecord, ...]
    exclusions: tuple[ExclusionPrompt, ...]
    reviewed_records: tuple[ReviewedRecord, ...]
    semantic_threshold: float
    linguistic_policy: LinguisticPolicy


Encoder = Callable[[Sequence[str], EncoderIdentity], Sequence[Sequence[float]]]


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")


def sha256_bytes(payload: bytes) -> str:
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def read_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    verify_regular_file(path, maximum, label)
    return path.read_bytes()


def verify_regular_file(path: Path, maximum: int, label: str) -> int:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size <= 0 or size > maximum:
        raise ValueError(f"{label} byte length must be in 1..={maximum}: {path}")
    return size


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
    if not isinstance(result, str) or not result or result.strip() != result:
        raise ValueError(f"{label}.{key} must be a non-empty trimmed string")
    if any(character in result for character in "\r\n\0"):
        raise ValueError(f"{label}.{key} contains a forbidden character")
    return result


def require_sha256(value: str, label: str) -> str:
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", value):
        raise ValueError(f"{label} must be a lowercase sha256 identity")
    return value


def require_integer(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    if value < minimum or value > maximum:
        raise ValueError(f"{label} must be in {minimum}..={maximum}")
    return value


def require_number(value: Any, label: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a number")
    result = float(value)
    if not math.isfinite(result) or result < minimum or result > maximum:
        raise ValueError(f"{label} must be finite and in {minimum}..={maximum}")
    return result


def resolve_path(control_path: Path, value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = control_path.parent / path
    return path.resolve()


def normalized_text(text: str) -> str:
    words: list[str] = []
    current: list[str] = []
    for index, character in enumerate(text):
        if character.isalnum():
            current.append(character.lower())
        elif (
            character in {"'", "\u2019"}
            and current
            and index + 1 < len(text)
            and text[index + 1].isalnum()
        ):
            continue
        elif current:
            words.append("".join(current))
            current = []
    if current:
        words.append("".join(current))
    return " ".join(words)


def validate_unique_prompts(records: Sequence[PromptRecord]) -> None:
    ids: dict[str, str] = {}
    normalized: dict[str, str] = {}
    for record in records:
        if record.record_id in ids:
            raise ValueError(
                f"duplicate prompt id {record.record_id} in {ids[record.record_id]} and {record.source_path}"
            )
        ids[record.record_id] = record.source_path
        key = normalized_text(record.prompt)
        if not key:
            raise ValueError(f"prompt {record.record_id} normalizes to empty text")
        if key in normalized:
            raise ValueError(
                "duplicate normalized prompts: "
                f"{normalized[key]} and {record.record_id}"
            )
        normalized[key] = record.record_id


def deduplicate_exclusions(
    records: Sequence[ExclusionPrompt],
) -> tuple[ExclusionPrompt, ...]:
    result: list[ExclusionPrompt] = []
    seen: set[str] = set()
    for record in records:
        key = normalized_text(record.prompt)
        if key in seen:
            continue
        seen.add(key)
        result.append(record)
    return tuple(result)


def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
    if not left or len(left) != len(right):
        raise ValueError("embedding dimension mismatch")
    if any(not math.isfinite(float(value)) for value in (*left, *right)):
        raise ValueError("embeddings must contain only finite values")
    left_norm = math.sqrt(math.fsum(float(value) ** 2 for value in left))
    right_norm = math.sqrt(math.fsum(float(value) ** 2 for value in right))
    if left_norm == 0.0 or right_norm == 0.0:
        raise ValueError("embeddings must have nonzero norm")
    dot = math.fsum(float(a) * float(b) for a, b in zip(left, right))
    return max(-1.0, min(1.0, dot / (left_norm * right_norm)))


def _pair_id(prompt: PromptRecord, exclusion: ExclusionPrompt) -> str:
    payload = canonical_json_bytes(
        {
            "prompt_id": prompt.record_id,
            "prompt_source": prompt.source_path,
            "prompt": prompt.prompt,
            "exclusion_source": exclusion.source_path,
            "exclusion_index": exclusion.index,
            "exclusion_prompt": exclusion.prompt,
        }
    )
    return hashlib.sha256(payload).hexdigest()


def semantic_findings(
    prompts: Sequence[PromptRecord],
    exclusions: Sequence[ExclusionPrompt],
    prompt_embeddings: Sequence[Sequence[float]],
    exclusion_embeddings: Sequence[Sequence[float]],
    threshold: float,
) -> tuple[SemanticFinding, ...]:
    if not 0.0 < threshold <= 1.0:
        raise ValueError("semantic threshold must be in (0, 1]")
    if len(prompts) != len(prompt_embeddings):
        raise ValueError("prompt embedding count mismatch")
    if len(exclusions) != len(exclusion_embeddings):
        raise ValueError("exclusion embedding count mismatch")
    findings: list[SemanticFinding] = []
    for prompt, prompt_embedding in zip(prompts, prompt_embeddings):
        for exclusion, exclusion_embedding in zip(exclusions, exclusion_embeddings):
            score = _cosine(prompt_embedding, exclusion_embedding)
            if score + 1e-12 < threshold:
                continue
            findings.append(
                SemanticFinding(
                    _pair_id(prompt, exclusion),
                    round(score, 9),
                    prompt,
                    exclusion,
                )
            )
    findings.sort(
        key=lambda finding: (
            -finding.score,
            finding.prompt.record_id,
            finding.exclusion.source_path,
            finding.exclusion.index,
        )
    )
    return tuple(findings)


def _matching_ids(
    records: Sequence[ReviewedRecord], patterns: Sequence[re.Pattern[str]]
) -> tuple[str, ...]:
    return tuple(
        sorted(
            record.record_id
            for record in records
            if any(pattern.search(record.response) for pattern in patterns)
        )
    )


def _rate(count: int, total: int) -> float:
    return 0.0 if total == 0 else count / total


def linguistic_audit(
    records: Sequence[ReviewedRecord], policy: LinguisticPolicy
) -> LinguisticAudit:
    refusal_ids = _matching_ids(records, REFUSAL_PATTERNS)
    apology_ids = _matching_ids(records, APOLOGY_PATTERNS)
    disclaimer_ids = _matching_ids(records, DISCLAIMER_PATTERNS)
    false_capability_ids = _matching_ids(records, FALSE_CAPABILITY_PATTERNS)
    total = len(records)
    failures = []
    if _rate(len(refusal_ids), total) > policy.max_refusal_language_rate:
        failures.append("refusal_language_rate")
    if _rate(len(apology_ids), total) > policy.max_apology_rate:
        failures.append("apology_rate")
    if _rate(len(disclaimer_ids), total) > policy.max_disclaimer_rate:
        failures.append("disclaimer_rate")
    if len(false_capability_ids) > policy.max_false_capability_count:
        failures.append("false_capability_count")
    return LinguisticAudit(
        total,
        refusal_ids,
        apology_ids,
        disclaimer_ids,
        false_capability_ids,
        tuple(failures),
    )


def _parse_file_identities(
    control_path: Path,
    value: Any,
    label: str,
    maximum: int,
) -> tuple[tuple[dict[str, Any], ...], tuple[Path, ...]]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{label} must be a non-empty list")
    identities = []
    paths = []
    seen: set[Path] = set()
    for index, item in enumerate(value):
        item_label = f"{label}[{index}]"
        if not isinstance(item, dict):
            raise ValueError(f"{item_label} must be a JSON object")
        require_exact_keys(item, FILE_IDENTITY_KEYS, item_label)
        path = resolve_path(control_path, require_string(item, "path", item_label))
        if path in seen:
            raise ValueError(f"{label} contains a duplicate path")
        seen.add(path)
        size = verify_regular_file(path, maximum, item_label)
        expected = require_sha256(require_string(item, "sha256", item_label), item_label)
        actual = sha256_file(path)
        if actual != expected:
            raise ValueError(f"{item_label} SHA-256 does not match local bytes")
        identities.append({"path": str(path), "sha256": actual, "bytes": size})
        paths.append(path)
    return tuple(identities), tuple(paths)


def _read_prompt_plans(
    identities: Sequence[dict[str, Any]], paths: Sequence[Path]
) -> tuple[PromptRecord, ...]:
    records: list[PromptRecord] = []
    for identity, path in zip(identities, paths):
        payload = read_regular_bytes(path, MAX_PLAN_BYTES, "prompt plan")
        try:
            text = payload.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"prompt plan must be UTF-8: {path}") from error
        count = 0
        for line_number, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"invalid prompt JSONL at {path}:{line_number}") from error
            if not isinstance(value, dict):
                raise ValueError(f"prompt record must be an object at {path}:{line_number}")
            require_exact_keys(value, PROMPT_KEYS, f"prompt {path}:{line_number}")
            record_id = require_string(value, "id", f"prompt {path}:{line_number}")
            task_family = require_string(
                value, "task_family", f"prompt {path}:{line_number}"
            )
            prompt = require_string(value, "prompt", f"prompt {path}:{line_number}")
            if len(prompt.encode("utf-8")) > MAX_TEXT_BYTES:
                raise ValueError(f"prompt is too large at {path}:{line_number}")
            records.append(PromptRecord(record_id, task_family, prompt, str(path)))
            count += 1
        if count == 0:
            raise ValueError(f"prompt plan has no records: {path}")
        identity["record_count"] = count
    validate_unique_prompts(records)
    records.sort(key=lambda record: (record.record_id, record.source_path))
    return tuple(records)


def _parse_manifest_fields(payload: bytes, label: str) -> dict[str, str]:
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be UTF-8") from error
    fields: dict[str, str] = {}
    for line_number, raw_line in enumerate(text.splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"{label} line {line_number} is missing '='")
        key, raw_value = line.split("=", 1)
        key = key.strip()
        field_value = raw_value.strip()
        if not key or not field_value or key in fields:
            raise ValueError(f"{label} line {line_number} is invalid or duplicated")
        fields[key] = field_value
    return fields


def _read_exclusions(
    identities: Sequence[dict[str, Any]], paths: Sequence[Path]
) -> tuple[ExclusionPrompt, ...]:
    records: list[ExclusionPrompt] = []
    for identity, path in zip(identities, paths):
        fields = _parse_manifest_fields(
            read_regular_bytes(path, MAX_EXCLUSION_BYTES, "eval exclusion"),
            f"eval exclusion {path}",
        )
        if fields.get("tinyrustlm_eval_cases_version") != "1":
            raise ValueError(f"eval exclusion version is unsupported: {path}")
        try:
            case_count = int(fields["case_count"])
            holdout_count = int(fields.get("holdout_count", "0"))
        except (KeyError, ValueError) as error:
            raise ValueError(f"eval exclusion counts are invalid: {path}") from error
        if case_count <= 0 or holdout_count != 0:
            raise ValueError(f"eval exclusion must be materialized and nonempty: {path}")
        for index in range(case_count):
            prompt = fields.get(f"case.{index}.prompt", "")
            if not normalized_text(prompt):
                raise ValueError(f"eval exclusion case.{index}.prompt is missing: {path}")
            records.append(ExclusionPrompt(str(path), index, prompt))
        identity["record_count"] = case_count
    return deduplicate_exclusions(records)


def _read_reviewed_sources(
    identities: Sequence[dict[str, Any]], paths: Sequence[Path]
) -> tuple[ReviewedRecord, ...]:
    records: list[ReviewedRecord] = []
    seen_ids: set[str] = set()
    for identity, path in zip(identities, paths):
        payload = read_regular_bytes(path, MAX_REVIEWED_SOURCE_BYTES, "reviewed source")
        try:
            text = payload.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"reviewed source must be UTF-8: {path}") from error
        count = 0
        for line_number, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"invalid reviewed JSONL at {path}:{line_number}") from error
            if not isinstance(value, dict):
                raise ValueError(f"reviewed record must be an object at {path}:{line_number}")
            require_exact_keys(value, REVIEWED_KEYS, f"reviewed {path}:{line_number}")
            record_id = require_string(value, "id", f"reviewed {path}:{line_number}")
            if record_id in seen_ids:
                raise ValueError(f"reviewed sources contain duplicate id {record_id}")
            seen_ids.add(record_id)
            task_family = require_string(
                value, "task_family", f"reviewed {path}:{line_number}"
            )
            prompt = require_string(value, "prompt", f"reviewed {path}:{line_number}")
            response = require_string(value, "response", f"reviewed {path}:{line_number}")
            if max(len(prompt.encode("utf-8")), len(response.encode("utf-8"))) > MAX_TEXT_BYTES:
                raise ValueError(f"reviewed record is too large at {path}:{line_number}")
            records.append(ReviewedRecord(record_id, task_family, prompt, response))
            count += 1
        if count == 0:
            raise ValueError(f"reviewed source has no records: {path}")
        identity["record_count"] = count
    records.sort(key=lambda record: record.record_id)
    return tuple(records)


def _optional_file_identities(
    control_path: Path, value: Any
) -> tuple[tuple[dict[str, Any], ...], tuple[Path, ...]]:
    if value == []:
        return (), ()
    return _parse_file_identities(
        control_path, value, "reviewed_sources", MAX_REVIEWED_SOURCE_BYTES
    )


def build_audit_plan(control_path: Path) -> AuditPlan:
    control_path = control_path.resolve()
    control = read_json_object(control_path, MAX_CONTROL_BYTES, "audit control")
    require_exact_keys(control, CONTROL_KEYS, "audit control")
    if control.get("schema") != CONTROL_SCHEMA:
        raise ValueError("audit control schema is unsupported")
    audit_id = require_string(control, "audit_id", "control")

    prompt_identities, prompt_paths = _parse_file_identities(
        control_path, control.get("prompt_plans"), "prompt_plans", MAX_PLAN_BYTES
    )
    exclusion_identities, exclusion_paths = _parse_file_identities(
        control_path,
        control.get("eval_exclusions"),
        "eval_exclusions",
        MAX_EXCLUSION_BYTES,
    )
    reviewed_identities, reviewed_paths = _optional_file_identities(
        control_path, control.get("reviewed_sources")
    )

    encoder_value = control.get("encoder")
    if not isinstance(encoder_value, dict):
        raise ValueError("encoder must be a JSON object")
    require_exact_keys(encoder_value, ENCODER_KEYS, "encoder")
    model_dir = resolve_path(
        control_path, require_string(encoder_value, "model_dir", "encoder")
    )
    if not model_dir.is_dir() or model_dir.is_symlink():
        raise ValueError("encoder.model_dir must be a non-symlink directory")
    encoder_files, encoder_paths = _parse_file_identities(
        control_path, encoder_value.get("files"), "encoder.files", MAX_ENCODER_FILE_BYTES
    )
    model_prefix = str(model_dir).rstrip("\\/") + os.sep
    if any(
        not str(path).startswith(model_prefix) for path in encoder_paths
    ):
        raise ValueError("every encoder file must be inside encoder.model_dir")
    encoder = EncoderIdentity(
        require_string(encoder_value, "repo_id", "encoder"),
        require_string(encoder_value, "revision", "encoder"),
        require_string(encoder_value, "license", "encoder"),
        model_dir,
        encoder_files,
        require_integer(encoder_value.get("max_length"), "encoder.max_length", 8, 512),
        require_integer(encoder_value.get("batch_size"), "encoder.batch_size", 1, 512),
    )

    policy_value = control.get("linguistic_policy")
    if not isinstance(policy_value, dict):
        raise ValueError("linguistic_policy must be a JSON object")
    require_exact_keys(policy_value, LINGUISTIC_POLICY_KEYS, "linguistic_policy")
    policy = LinguisticPolicy(
        require_number(
            policy_value.get("max_refusal_language_rate"),
            "linguistic_policy.max_refusal_language_rate",
            0.0,
            1.0,
        ),
        require_number(
            policy_value.get("max_apology_rate"),
            "linguistic_policy.max_apology_rate",
            0.0,
            1.0,
        ),
        require_number(
            policy_value.get("max_disclaimer_rate"),
            "linguistic_policy.max_disclaimer_rate",
            0.0,
            1.0,
        ),
        require_integer(
            policy_value.get("max_false_capability_count"),
            "linguistic_policy.max_false_capability_count",
            0,
            1_000_000,
        ),
    )

    return AuditPlan(
        control_path,
        sha256_file(control_path),
        audit_id,
        encoder,
        prompt_identities,
        exclusion_identities,
        reviewed_identities,
        _read_prompt_plans(prompt_identities, prompt_paths),
        _read_exclusions(exclusion_identities, exclusion_paths),
        _read_reviewed_sources(reviewed_identities, reviewed_paths),
        require_number(control.get("semantic_threshold"), "semantic_threshold", 0.01, 1.0),
        policy,
    )


def encode_with_transformers(
    texts: Sequence[str], identity: EncoderIdentity
) -> tuple[tuple[float, ...], ...]:
    try:
        import torch
        from transformers import AutoModel, AutoTokenizer
    except ImportError as error:
        raise ValueError("semantic audit requires local torch and transformers") from error

    tokenizer = AutoTokenizer.from_pretrained(identity.model_dir, local_files_only=True)
    model = AutoModel.from_pretrained(identity.model_dir, local_files_only=True)
    model.eval()
    rows: list[tuple[float, ...]] = []
    for start in range(0, len(texts), identity.batch_size):
        batch_texts = list(texts[start : start + identity.batch_size])
        encoded = tokenizer(
            batch_texts,
            padding=True,
            truncation=True,
            max_length=identity.max_length,
            return_tensors="pt",
        )
        with torch.inference_mode():
            hidden = model(**encoded).last_hidden_state
        mask = encoded["attention_mask"].unsqueeze(-1).to(hidden.dtype)
        pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
        normalized = torch.nn.functional.normalize(pooled, p=2, dim=1)
        if not torch.isfinite(normalized).all():
            raise ValueError("semantic encoder produced a non-finite embedding")
        rows.extend(tuple(float(value) for value in row) for row in normalized.tolist())
    if len(rows) != len(texts):
        raise ValueError("semantic encoder output count mismatch")
    return tuple(rows)


def _finding_json(finding: SemanticFinding) -> dict[str, Any]:
    return {
        "pair_id": finding.pair_id,
        "cosine_similarity": finding.score,
        "prompt_id": finding.prompt.record_id,
        "prompt_family": finding.prompt.task_family,
        "prompt_source": finding.prompt.source_path,
        "prompt": finding.prompt.prompt,
        "eval_source": finding.exclusion.source_path,
        "eval_index": finding.exclusion.index,
        "eval_prompt": finding.exclusion.prompt,
    }


def _linguistic_json(audit: LinguisticAudit) -> dict[str, Any]:
    return {
        "status": "not-run-no-reviewed-sources"
        if audit.record_count == 0
        else ("pass" if not audit.failures else "fail"),
        "record_count": audit.record_count,
        "refusal_language_count": len(audit.refusal_language_ids),
        "refusal_language_rate": round(audit.refusal_language_rate, 9),
        "refusal_language_ids": list(audit.refusal_language_ids),
        "apology_count": len(audit.apology_ids),
        "apology_rate": round(audit.apology_rate, 9),
        "apology_ids": list(audit.apology_ids),
        "disclaimer_count": len(audit.disclaimer_ids),
        "disclaimer_rate": round(audit.disclaimer_rate, 9),
        "disclaimer_ids": list(audit.disclaimer_ids),
        "false_capability_count": len(audit.false_capability_ids),
        "false_capability_ids": list(audit.false_capability_ids),
        "failures": list(audit.failures),
    }


def run_audit(plan: AuditPlan, encoder: Encoder = encode_with_transformers) -> dict[str, Any]:
    prompt_texts = [record.prompt for record in plan.prompts]
    exclusion_texts = [record.prompt for record in plan.exclusions]
    embeddings = encoder(prompt_texts + exclusion_texts, plan.encoder)
    prompt_embeddings = embeddings[: len(prompt_texts)]
    exclusion_embeddings = embeddings[len(prompt_texts) :]
    findings = semantic_findings(
        plan.prompts,
        plan.exclusions,
        prompt_embeddings,
        exclusion_embeddings,
        plan.semantic_threshold,
    )
    language = linguistic_audit(plan.reviewed_records, plan.linguistic_policy)
    failures = []
    if findings:
        failures.append("semantic_eval_neighbors")
    failures.extend(f"linguistic:{failure}" for failure in language.failures)
    return {
        "schema": REPORT_SCHEMA,
        "audit_id": plan.audit_id,
        "status": "pass" if not failures else "fail",
        "failures": failures,
        "control_path": str(plan.control_path),
        "control_sha256": plan.control_sha256,
        "encoder": {
            "repo_id": plan.encoder.repo_id,
            "revision": plan.encoder.revision,
            "license": plan.encoder.license,
            "model_dir": str(plan.encoder.model_dir),
            "files": list(plan.encoder.files),
            "max_length": plan.encoder.max_length,
            "batch_size": plan.encoder.batch_size,
        },
        "prompt_plans": list(plan.prompt_identities),
        "eval_exclusions": list(plan.exclusion_identities),
        "reviewed_sources": list(plan.reviewed_identities),
        "prompt_count": len(plan.prompts),
        "eval_prompt_count": len(plan.exclusions),
        "semantic_threshold": plan.semantic_threshold,
        "semantic_finding_count": len(findings),
        "semantic_findings": [_finding_json(finding) for finding in findings],
        "linguistic_policy": {
            "max_refusal_language_rate": plan.linguistic_policy.max_refusal_language_rate,
            "max_apology_rate": plan.linguistic_policy.max_apology_rate,
            "max_disclaimer_rate": plan.linguistic_policy.max_disclaimer_rate,
            "max_false_capability_count": plan.linguistic_policy.max_false_capability_count,
        },
        "linguistic_audit": _linguistic_json(language),
        "required_next_gate": "remove-or-rewrite-findings-and-rerun"
        if failures
        else (
            "collect-and-review-teacher-drafts"
            if not plan.reviewed_records
            else "freeze-distillation-dataset"
        ),
    }


def write_new_report(path: Path, report: dict[str, Any]) -> None:
    path = path.resolve()
    if path.exists():
        raise ValueError(f"output report already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(report, stream, indent=2, ensure_ascii=False, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("control", type=Path)
    parser.add_argument("output_report", type=Path)
    args = parser.parse_args()
    try:
        plan = build_audit_plan(args.control)
        report = run_audit(plan)
        write_new_report(args.output_report, report)
    except ValueError as error:
        print(json.dumps({"status": "error", "error": str(error)}), file=sys.stderr)
        raise SystemExit(2) from error
    summary = {
        "status": report["status"],
        "audit_id": report["audit_id"],
        "prompt_count": report["prompt_count"],
        "eval_prompt_count": report["eval_prompt_count"],
        "semantic_finding_count": report["semantic_finding_count"],
        "linguistic_status": report["linguistic_audit"]["status"],
        "output_report": str(args.output_report.resolve()),
        "required_next_gate": report["required_next_gate"],
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    if report["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
