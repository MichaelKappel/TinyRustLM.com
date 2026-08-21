#!/usr/bin/env python3
"""Fail-closed controls for the first Qwen3 working-model training lane.

This tool deliberately stops before training. It freezes a sole, auditable path
from a rejected-but-provenance-clean base checkpoint to a new derivative:

* validate the checked-in behavioral and training profile;
* initialize distinct-custody holdout authoring outside Git;
* assemble complete development and independent-audit contributions;
* deterministically seal only the custody-bound private holdouts;
* audit a curriculum against hash-only exclusions and a separately executed,
  hash-bound semantic review; and
* issue a CPU pilot authorization only when every input and stop rule is exact.

Raw holdout text never enters a public receipt. The tool has no compatibility
reader, migration path, repair mode, best-of-N selector, or training fallback.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import stat
import sys
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import zip_longest
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


PROFILE_SCHEMA = "tinyrustlm.qwen3_working_model_profile.v1"
HOLDOUT_CUSTODY_PLAN_SCHEMA = "tinyrustlm.holdout_custody_plan.v1"
HOLDOUT_CONTRIBUTION_SCHEMA = "tinyrustlm.holdout_contribution.v1"
HOLDOUT_CUSTODY_RECEIPT_SCHEMA = "tinyrustlm.holdout_custody_receipt.v1"
FACTOR_PACK_SCHEMA = "tinyrustlm.sealed_holdout_factor_pack.v1"
PRIVATE_HOLDOUT_SCHEMA = "tinyrustlm.sealed_holdout_case.v1"
PRIVATE_INDEX_SCHEMA = "tinyrustlm.contamination_exclusion_index.v1"
PUBLIC_RECEIPT_SCHEMA = "tinyrustlm.sealed_holdout_receipt.v1"
CURRICULUM_RECORD_SCHEMA = "tinyrustlm.behavioral_curriculum_record.v1"
CURRICULUM_REVIEW_RUBRIC_SCHEMA = "tinyrustlm.curriculum_review_rubric.v1"
CURRICULUM_REVIEW_MANIFEST_SCHEMA = "tinyrustlm.curriculum_review_manifest.v1"
CURRICULUM_REVIEW_DECISION_SCHEMA = "tinyrustlm.curriculum_review_decision.v1"
CURRICULUM_REVIEW_ADJUDICATION_SCHEMA = "tinyrustlm.curriculum_review_adjudication.v1"
CURRICULUM_REVIEW_CLOSURE_SCHEMA = "tinyrustlm.curriculum_review_closure.v1"
SEMANTIC_RECEIPT_SCHEMA = "tinyrustlm.semantic_contamination_receipt.v1"
TOMBSTONE_SCHEMA = "tinyrustlm.curriculum_tombstone.v1"
CURRICULUM_AUDIT_SCHEMA = "tinyrustlm.curriculum_contamination_audit.v1"
TRAINING_LOCK_REQUEST_SCHEMA = "tinyrustlm.cpu_pilot_training_lock_request.v1"
TRAINING_LOCK_SCHEMA = "tinyrustlm.cpu_pilot_training_lock.v1"

PRIVATE_HOLDOUT_FILENAME = "materialized-holdouts.private.jsonl"
PRIVATE_INDEX_FILENAME = "exclusion-index.private.json"
PUBLIC_RECEIPT_FILENAME = "holdout-seal-receipt.public.json"
HOLDOUT_CUSTODY_PLAN_FILENAME = "holdout-custody-plan.public.json"
DEVELOPMENT_CONTRIBUTION_FILENAME = "development-contribution.private.json"
INDEPENDENT_AUDIT_CONTRIBUTION_FILENAME = "independent-audit-contribution.private.json"
HOLDOUT_SEED_FILENAME = "holdout-seed.private.bin"
ASSEMBLED_FACTOR_PACK_FILENAME = "factor-pack.private.json"
HOLDOUT_CUSTODY_RECEIPT_FILENAME = "holdout-custody-receipt.public.json"

MAX_PROFILE_BYTES = 4 * 1024 * 1024
MAX_FACTOR_PACK_BYTES = 64 * 1024 * 1024
MAX_PRIVATE_INDEX_BYTES = 256 * 1024 * 1024
MAX_CURRICULUM_BYTES = 4 * 1024 * 1024 * 1024
MAX_REVIEW_MANIFEST_BYTES = 16 * 1024 * 1024
MAX_REVIEW_LEDGER_BYTES = 4 * 1024 * 1024 * 1024
MAX_SEMANTIC_RECEIPT_BYTES = 4 * 1024 * 1024
MAX_TOMBSTONE_BYTES = 256 * 1024 * 1024
MAX_TRAINING_REQUEST_BYTES = 16 * 1024 * 1024
MAX_IDENTITY_FILE_BYTES = 16 * 1024 * 1024 * 1024
MAX_TEXT_BYTES = 1024 * 1024
MAX_REPORTED_FINDINGS = 10000

SHA256_PATTERN = re.compile(r"sha256:[0-9a-f]{64}\Z")
REVISION_PATTERN = re.compile(r"[0-9a-f]{40,64}\Z")
ID_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?\Z")
REPO_ID_PATTERN = re.compile(r"[A-Za-z0-9._-]+/[A-Za-z0-9._-]+\Z")
TOKEN_PATTERN = re.compile(r"<[^<>\s]+>|[\w]+", re.UNICODE)

PROFILE_KEYS = {
    "schema",
    "profile_id",
    "goal_sha256",
    "status",
    "source",
    "evaluation_exclusions",
    "curriculum",
    "holdouts",
    "contamination",
    "training",
    "stop_rules",
}
SOURCE_KEYS = {
    "repo_id",
    "revision",
    "license_id",
    "architecture",
    "status",
    "permitted_use",
    "files",
}
SOURCE_FILE_KEYS = {"name", "bytes", "sha256"}
EVALUATION_EXCLUSION_KEYS = {"path", "bytes", "case_count", "sha256"}
CURRICULUM_KEYS = {
    "pilot_record_count",
    "scale_record_count",
    "minimum_helpful_positive_rate",
    "maximum_narrow_boundary_rate",
    "maximum_record_bytes",
    "allowed_provenance_classes",
    "allowed_license_ids",
    "review_policy",
    "categories",
}
REVIEW_POLICY_KEYS = {
    "rubric",
    "candidate_projection",
    "primary_reviewer_count",
    "distinct_reviewer_identities_required",
    "distinct_custody_domains_required",
    "disagreement_policy",
    "unnecessary_adjudication_forbidden",
    "response_rewrite_forbidden",
    "hidden_reasoning_forbidden",
}
PROFILE_RUBRIC_IDENTITY_KEYS = {"path", "bytes", "sha256"}
REVIEW_RUBRIC_KEYS = {
    "schema",
    "rubric_id",
    "status_values",
    "decision_values",
    "checklist",
    "acceptance",
}
REVIEW_RUBRIC_CHECKLIST_KEYS = {"id", "applicability"}
REVIEW_RUBRIC_ACCEPTANCE_KEYS = {
    "always_pass",
    "no_fail",
    "response_rewrite_forbidden",
    "hidden_reasoning_forbidden",
}
CATEGORY_KEYS = {
    "id",
    "pilot_count",
    "scale_count",
    "required_factors",
    "minimum_distinct_values_per_factor",
}
HOLDOUT_KEYS = {
    "case_count",
    "development_count",
    "independent_audit_count",
    "cases_per_category",
    "secret_seed_bytes",
    "minimum_prompt_variants",
    "minimum_anchor_variants",
}
CONTAMINATION_KEYS = {
    "character_ngram_size",
    "character_containment_threshold",
    "token_ngram_size",
    "token_containment_threshold",
    "entity_token_ngram_size",
    "entity_containment_threshold",
    "answer_token_ngram_size",
    "answer_containment_threshold",
    "semantic_cosine_threshold",
    "semantic_review_floor",
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
FACTOR_PACK_KEYS = {"schema", "pack_id", "cases"}
HOLDOUT_CUSTODY_PLAN_KEYS = {
    "schema",
    "status",
    "plan_id",
    "profile_id",
    "profile_sha256",
    "control_program_sha256",
    "case_count",
    "split_counts",
    "slot_set_sha256",
    "seed_commitment",
    "slots",
    "development_template_sha256",
    "independent_audit_template_sha256",
    "contains_raw_prompts",
    "contains_answer_anchors",
    "contains_seed",
}
HOLDOUT_SLOT_KEYS = {"case_id", "split", "task_family", "required_factors"}
HOLDOUT_CONTRIBUTION_KEYS = {
    "schema",
    "status",
    "contribution_id",
    "plan_id",
    "profile_id",
    "profile_sha256",
    "slot_set_sha256",
    "split",
    "author_identity_sha256",
    "custody_domain_sha256",
    "cases",
}
HOLDOUT_CUSTODY_RECEIPT_KEYS = {
    "schema",
    "status",
    "plan_id",
    "profile_id",
    "profile_sha256",
    "control_program_sha256",
    "plan_sha256",
    "slot_set_sha256",
    "seed_commitment",
    "development_contribution_sha256",
    "independent_audit_contribution_sha256",
    "development_author_identity_sha256",
    "independent_audit_author_identity_sha256",
    "development_custody_domain_sha256",
    "independent_audit_custody_domain_sha256",
    "case_count",
    "split_counts",
    "category_count",
    "factor_pack_sha256",
    "contains_raw_prompts",
    "contains_answer_anchors",
    "contains_seed",
    "training_authority",
}
FACTOR_CASE_KEYS = {
    "case_id",
    "split",
    "task_family",
    "template_family_id",
    "prompt_variants",
    "answer_anchor_variants",
    "entities",
    "scenario_factors",
}
ENTITY_KEYS = {"kind", "value"}
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
MESSAGE_KEYS = {"role", "content"}
PROVENANCE_KEYS = {
    "provenance_class",
    "license_id",
    "source_id",
    "source_record_id",
    "source_content_sha256",
}
TEACHER_KEYS = {
    "teacher_id",
    "teacher_revision",
    "sampling_profile_sha256",
    "seed",
    "raw_output_sha256",
    "hidden_reasoning_included",
}
REVIEW_KEYS = {
    "decision",
    "rubric_sha256",
    "factual_verification",
    "reviewer_count",
    "disagreement_status",
    "decision_sha256",
    "pii_scan_status",
    "license_review_status",
    "malicious_artifact_scan_status",
}
REVIEW_MANIFEST_KEYS = {
    "schema",
    "status",
    "review_id",
    "profile_id",
    "profile_sha256",
    "control_program_sha256",
    "curriculum_sha256",
    "rubric_sha256",
    "candidate_projection",
    "record_count",
    "record_order_sha256",
    "primary_reviewer_ledgers",
    "adjudication_ledger",
    "contains_raw_curriculum",
    "training_authority",
}
PRIMARY_REVIEW_LEDGER_IDENTITY_KEYS = {
    "path",
    "bytes",
    "sha256",
    "reviewer_identity_sha256",
    "custody_domain_sha256",
}
ADJUDICATION_LEDGER_IDENTITY_KEYS = {
    "path",
    "bytes",
    "sha256",
    "adjudicator_identity_sha256",
    "custody_domain_sha256",
}
REVIEW_DECISION_KEYS = {
    "schema",
    "review_id",
    "record_id",
    "candidate_sha256",
    "messages_sha256",
    "response_sha256",
    "rubric_sha256",
    "reviewer_identity_sha256",
    "custody_domain_sha256",
    "decision",
    "factual_verification",
    "checklist",
    "pii_scan_status",
    "license_review_status",
    "malicious_artifact_scan_status",
    "comment_sha256",
}
REVIEW_ADJUDICATION_KEYS = {
    "schema",
    "review_id",
    "record_id",
    "candidate_sha256",
    "messages_sha256",
    "response_sha256",
    "rubric_sha256",
    "primary_decision_sha256s",
    "adjudicator_identity_sha256",
    "custody_domain_sha256",
    "decision",
    "factual_verification",
    "checklist",
    "pii_scan_status",
    "license_review_status",
    "malicious_artifact_scan_status",
    "reason_code",
    "comment_sha256",
}
REVIEW_CHECKLIST_ITEM_KEYS = {"id", "status"}
SEMANTIC_RECEIPT_KEYS = {
    "schema",
    "audit_id",
    "status",
    "curriculum_sha256",
    "exclusion_index_sha256",
    "encoder",
    "cosine_threshold",
    "review_floor",
    "maximum_similarity",
    "record_count",
    "exclusion_case_count",
    "comparison_count",
    "reviewed_pair_count",
    "finding_count",
    "auditor_identity_sha256",
    "development_team_blinded",
    "transcript_sha256",
}
ENCODER_KEYS = {"repo_id", "revision", "license_id", "artifact_set_sha256"}
TOMBSTONE_KEYS = {
    "schema",
    "tombstone_id",
    "record_id",
    "record_sha256",
    "reason_code",
    "decision_sha256",
}
TRAINING_REQUEST_KEYS = {
    "schema",
    "lock_id",
    "source_root",
    "source_files",
    "curriculum",
    "curriculum_audit",
    "review_manifest",
    "holdout_receipt",
    "exclusion_index",
    "semantic_receipt",
    "tombstone_lineage",
    "environment_lock",
    "training_program",
    "output_root",
    "training",
    "stop_rules",
}
FILE_IDENTITY_KEYS = {"path", "bytes", "sha256"}


@dataclass(frozen=True)
class CategoryPolicy:
    category_id: str
    pilot_count: int
    scale_count: int
    required_factors: tuple[str, ...]
    minimum_distinct_values_per_factor: int


@dataclass(frozen=True)
class ValidatedFactorCase:
    case_id: str
    split: str
    task_family: str
    category: CategoryPolicy
    template_family_id: str
    prompt_variants: tuple[str, ...]
    answer_anchor_variants: tuple[tuple[str, ...], ...]
    entities: tuple[tuple[str, str], ...]
    scenario_factors: dict[str, str]


@dataclass(frozen=True)
class WorkingModelProfile:
    path: Path
    profile_sha256: str
    raw: dict[str, Any]
    profile_id: str
    goal_sha256: str
    source_repo_id: str
    source_revision: str
    source_status: str
    source_files: tuple[dict[str, Any], ...]
    evaluation_exclusions: tuple[dict[str, Any], ...]
    evaluation_case_count: int
    pilot_record_count: int
    scale_record_count: int
    minimum_helpful_positive_rate: float
    maximum_narrow_boundary_rate: float
    maximum_record_bytes: int
    allowed_provenance_classes: frozenset[str]
    allowed_license_ids: frozenset[str]
    review_rubric_path: Path
    review_rubric_bytes: int
    review_rubric_sha256: str
    review_rubric_id: str
    review_checklist: tuple[tuple[str, str], ...]
    review_always_pass: frozenset[str]
    categories: tuple[CategoryPolicy, ...]
    holdout_case_count: int
    development_holdout_count: int
    independent_audit_holdout_count: int
    cases_per_category: int
    secret_seed_bytes: int
    minimum_prompt_variants: int
    minimum_anchor_variants: int
    character_ngram_size: int
    character_containment_threshold: float
    token_ngram_size: int
    token_containment_threshold: float
    entity_token_ngram_size: int
    entity_containment_threshold: float
    answer_token_ngram_size: int
    answer_containment_threshold: float
    semantic_cosine_threshold: float
    semantic_review_floor: float

    @property
    def categories_by_id(self) -> dict[str, CategoryPolicy]:
        return {category.category_id: category for category in self.categories}


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")


def sha256_bytes(payload: bytes) -> str:
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def control_program_sha256() -> str:
    return sha256_file(Path(__file__).resolve())


def _is_symlink_or_reparse(path: Path) -> bool:
    if path.is_symlink():
        return True
    try:
        attributes = path.stat(follow_symlinks=False).st_file_attributes
    except (AttributeError, OSError):
        return False
    return bool(attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)


def _reject_reparse_chain(path: Path, label: str, *, include_leaf: bool = True) -> None:
    candidate = path.absolute()
    parts = (candidate, *candidate.parents) if include_leaf else candidate.parents
    for part in parts:
        if part.exists() and _is_symlink_or_reparse(part):
            raise ValueError(
                f"{label} path must not cross a symlink or reparse point: {part}"
            )


def verify_regular_file(path: Path, maximum: int, label: str) -> int:
    _reject_reparse_chain(path, label)
    if not path.is_file():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size <= 0 or size > maximum:
        raise ValueError(f"{label} byte length must be in 1..={maximum}: {path}")
    return size


def read_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    verify_regular_file(path, maximum, label)
    return path.read_bytes()


def read_json_object(path: Path, maximum: int, label: str) -> dict[str, Any]:
    payload = read_regular_bytes(path, maximum, label)
    try:
        value = json.loads(payload, object_pairs_hook=_reject_duplicate_json_keys)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def read_json_lines(path: Path, maximum: int, label: str) -> list[dict[str, Any]]:
    records = list(iter_json_lines(path, maximum, label))
    if not records:
        raise ValueError(f"{label} must contain at least one record")
    return records


def _reject_duplicate_json_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON key: {key}")
        value[key] = item
    return value


def iter_json_lines(path: Path, maximum: int, label: str) -> Iterable[dict[str, Any]]:
    verify_regular_file(path, maximum, label)
    record_count = 0
    try:
        with path.open("r", encoding="utf-8", newline="") as stream:
            for line_number, line in enumerate(stream, 1):
                if not line.strip():
                    raise ValueError(f"{label} line {line_number} must not be blank")
                if len(line.encode("utf-8")) > MAX_TEXT_BYTES:
                    raise ValueError(
                        f"{label} line {line_number} exceeds the line bound"
                    )
                try:
                    value = json.loads(
                        line, object_pairs_hook=_reject_duplicate_json_keys
                    )
                except (json.JSONDecodeError, ValueError) as error:
                    raise ValueError(
                        f"{label} line {line_number} must be valid JSON"
                    ) from error
                if not isinstance(value, dict):
                    raise ValueError(
                        f"{label} line {line_number} must be a JSON object"
                    )
                record_count += 1
                yield value
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be valid UTF-8 JSON Lines") from error
    if record_count == 0:
        raise ValueError(f"{label} must contain at least one record")


def require_exact_keys(
    value: Mapping[str, Any], expected: set[str], label: str
) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        unknown = sorted(actual - expected)
        raise ValueError(f"{label} keys mismatch; missing={missing}, unknown={unknown}")


def require_string(
    value: Any,
    label: str,
    *,
    minimum: int = 1,
    maximum: int = 4096,
    pattern: re.Pattern[str] | None = None,
) -> str:
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        raise ValueError(f"{label} must be a string of length {minimum}..={maximum}")
    if "\x00" in value or "\r" in value:
        raise ValueError(f"{label} contains a forbidden control character")
    if pattern is not None and pattern.fullmatch(value) is None:
        raise ValueError(f"{label} has an invalid format")
    return value


def require_id(value: Any, label: str) -> str:
    return require_string(value, label, pattern=ID_PATTERN)


def require_sha256(value: Any, label: str) -> str:
    return require_string(value, label, minimum=71, maximum=71, pattern=SHA256_PATTERN)


def require_integer(value: Any, label: str, minimum: int, maximum: int) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or not minimum <= value <= maximum
    ):
        raise ValueError(f"{label} must be an integer in {minimum}..={maximum}")
    return value


def require_number(value: Any, label: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number")
    number = float(value)
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise ValueError(f"{label} must be a finite number in {minimum}..={maximum}")
    return number


def require_bool(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{label} must be a boolean")
    return value


def require_string_list(
    value: Any, label: str, minimum: int, maximum: int, *, unique: bool = True
) -> tuple[str, ...]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise ValueError(f"{label} must be an array with {minimum}..={maximum} strings")
    result = tuple(
        require_string(item, f"{label}[{index}]") for index, item in enumerate(value)
    )
    if unique and len(set(result)) != len(result):
        raise ValueError(f"{label} values must be unique")
    return result


def normalize_text(text: str) -> str:
    if (
        not isinstance(text, str)
        or not text
        or len(text.encode("utf-8")) > MAX_TEXT_BYTES
    ):
        raise ValueError("text must be non-empty and bounded")
    normalized = unicodedata.normalize("NFKC", text).casefold()
    normalized = normalized.replace("\u2019", "'").replace("\u2018", "'")
    normalized = normalized.replace("'", "")
    characters = [
        character
        if character.isalnum() or character == "_" or character.isspace()
        else " "
        for character in normalized
    ]
    return " ".join("".join(characters).split())


def tokenize_normalized(text: str) -> tuple[str, ...]:
    return tuple(TOKEN_PATTERN.findall(normalize_text(text)))


def entity_normalize(text: str, entities: Sequence[tuple[str, str]]) -> str:
    working = unicodedata.normalize("NFKC", text)
    replacements: dict[str, str] = {}
    ordered = sorted(entities, key=lambda item: len(item[1]), reverse=True)
    for index, (kind, surface) in enumerate(ordered):
        normalized_kind = require_id(kind, f"entities[{index}].kind")
        require_string(surface, f"entities[{index}].value", maximum=4096)
        marker = f"entityplaceholder{index}token"
        working = re.sub(re.escape(surface), marker, working, flags=re.IGNORECASE)
        replacements[marker] = f"<{normalized_kind}>"
    result = normalize_text(working)
    for marker, replacement in replacements.items():
        result = result.replace(marker, replacement)
    return result


def _windows(tokens: Sequence[str], size: int) -> tuple[str, ...]:
    if len(tokens) < size:
        return ()
    return tuple(
        "\x1f".join(tokens[index : index + size])
        for index in range(len(tokens) - size + 1)
    )


def character_ngram_hashes(text: str, size: int) -> tuple[str, ...]:
    normalized = normalize_text(text)
    if len(normalized) < size:
        return ()
    return tuple(
        sorted(
            {
                sha256_bytes(normalized[index : index + size].encode("utf-8"))
                for index in range(len(normalized) - size + 1)
            }
        )
    )


def token_ngram_hashes(text: str, size: int) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                sha256_bytes(value.encode("utf-8"))
                for value in _windows(tokenize_normalized(text), size)
            }
        )
    )


def entity_token_ngram_hashes(
    text: str, entities: Sequence[tuple[str, str]], size: int
) -> tuple[str, ...]:
    normalized = entity_normalize(text, entities)
    tokens = tuple(TOKEN_PATTERN.findall(normalized))
    return tuple(
        sorted(
            {sha256_bytes(value.encode("utf-8")) for value in _windows(tokens, size)}
        )
    )


def template_signature(text: str, entities: Sequence[tuple[str, str]]) -> str:
    """Derive a surface-resistant template fingerprint without model inference."""
    normalized = entity_normalize(text, entities)
    tokens = TOKEN_PATTERN.findall(normalized)
    generalized = [
        "<number>" if any(character.isdigit() for character in token) else token
        for token in tokens
    ]
    return " ".join(generalized)


def _require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def _require_object_list(
    value: Any, label: str, minimum: int, maximum: int
) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise ValueError(f"{label} must be an array with {minimum}..={maximum} objects")
    return [
        _require_object(item, f"{label}[{index}]") for index, item in enumerate(value)
    ]


def _validate_training(value: Any) -> dict[str, Any]:
    training = _require_object(value, "training")
    require_exact_keys(training, TRAINING_KEYS, "training")
    if (
        require_string(training["method"], "training.method")
        != "assistant-only-sft-with-preservation-kl"
    ):
        raise ValueError(
            "training.method must be assistant-only-sft-with-preservation-kl"
        )
    if require_string(training["device"], "training.device") != "cpu":
        raise ValueError("the preregistered pilot must run on CPU")
    for key in ("parameter_dtype", "compute_dtype"):
        if require_string(training[key], f"training.{key}") != "float32":
            raise ValueError(f"training.{key} must be float32")
    rank = require_integer(training["lora_rank"], "training.lora_rank", 1, 256)
    alpha = require_integer(training["lora_alpha"], "training.lora_alpha", 1, 1024)
    if alpha < rank:
        raise ValueError("training.lora_alpha must be at least lora_rank")
    require_number(training["lora_dropout"], "training.lora_dropout", 0.0, 0.5)
    targets = require_string_list(
        training["target_modules"], "training.target_modules", 1, 64
    )
    required_targets = {
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    }
    if set(targets) != required_targets:
        raise ValueError(
            "training.target_modules must contain all and only the seven Qwen3 projection modules"
        )
    require_number(training["learning_rate"], "training.learning_rate", 1e-8, 1e-2)
    require_integer(training["epochs"], "training.epochs", 1, 20)
    require_integer(
        training["maximum_sequence_tokens"],
        "training.maximum_sequence_tokens",
        128,
        32768,
    )
    micro = require_integer(
        training["micro_batch_size"], "training.micro_batch_size", 1, 1024
    )
    accumulation = require_integer(
        training["gradient_accumulation_steps"],
        "training.gradient_accumulation_steps",
        1,
        65536,
    )
    effective = require_integer(
        training["effective_batch_size"], "training.effective_batch_size", 1, 65536
    )
    if micro * accumulation != effective:
        raise ValueError(
            "training.effective_batch_size must equal micro_batch_size * gradient_accumulation_steps"
        )
    require_integer(training["warmup_steps"], "training.warmup_steps", 0, 1000000)
    require_number(training["weight_decay"], "training.weight_decay", 0.0, 1.0)
    require_number(
        training["gradient_clip_norm"], "training.gradient_clip_norm", 0.0001, 1000.0
    )
    require_number(
        training["preservation_kl_weight"],
        "training.preservation_kl_weight",
        0.0001,
        100.0,
    )
    require_integer(training["training_seed"], "training.training_seed", 0, 2**63 - 1)
    require_integer(training["shuffle_seed"], "training.shuffle_seed", 0, 2**63 - 1)
    require_integer(
        training["checkpoint_interval_steps"],
        "training.checkpoint_interval_steps",
        1,
        10000000,
    )
    if training["eligible_checkpoint"] != "final-only":
        raise ValueError("training.eligible_checkpoint must be final-only")
    return training


def _validate_stop_rules(value: Any) -> dict[str, Any]:
    rules = _require_object(value, "stop_rules")
    require_exact_keys(rules, STOP_RULE_KEYS, "stop_rules")
    if rules["nonfinite_loss"] != "terminal-reject":
        raise ValueError("stop_rules.nonfinite_loss must be terminal-reject")
    require_integer(
        rules["maximum_consecutive_loss_increases"],
        "stop_rules.maximum_consecutive_loss_increases",
        1,
        1000,
    )
    require_integer(
        rules["maximum_wall_clock_seconds"],
        "stop_rules.maximum_wall_clock_seconds",
        60,
        30 * 24 * 3600,
    )
    require_integer(
        rules["maximum_peak_rss_bytes"],
        "stop_rules.maximum_peak_rss_bytes",
        1024**3,
        1024**5,
    )
    require_number(
        rules["minimum_pilot_behavior_pass_rate"],
        "stop_rules.minimum_pilot_behavior_pass_rate",
        0.0,
        1.0,
    )
    require_number(
        rules["minimum_preservation_pass_rate"],
        "stop_rules.minimum_preservation_pass_rate",
        0.0,
        1.0,
    )
    require_number(
        rules["maximum_ordinary_helpfulness_regression_rate"],
        "stop_rules.maximum_ordinary_helpfulness_regression_rate",
        0.0,
        1.0,
    )
    if rules["failed_adapter_disposition"] != "terminal-reject-exact-bytes":
        raise ValueError("failed adapter bytes must be terminally rejected")
    if (
        rules["retry_requirement"]
        != "new-preregistration-and-material-method-or-data-change"
    ):
        raise ValueError(
            "a retry must require new preregistration and a material change"
        )
    return rules


def _parse_eval_fixture(
    path: Path, expected_case_count: int
) -> tuple[dict[str, Any], ...]:
    payload = read_regular_bytes(path, 64 * 1024 * 1024, "evaluation exclusion fixture")
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("evaluation exclusion fixture must be UTF-8") from error
    values: dict[str, str] = {}
    for line_number, raw_line in enumerate(text.splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(
                f"evaluation exclusion fixture line {line_number} is not key=value"
            )
        key, value = line.split("=", 1)
        if not key or key in values:
            raise ValueError(
                f"evaluation exclusion fixture has an invalid or duplicate key: {key}"
            )
        values[key] = value
    if values.get("tinyrustlm_eval_cases_version") != "1":
        raise ValueError("evaluation exclusion fixture version must be 1")
    try:
        declared_count = int(values.get("case_count", ""))
    except ValueError as error:
        raise ValueError(
            "evaluation exclusion fixture case_count must be an integer"
        ) from error
    if declared_count != expected_case_count:
        raise ValueError(
            "evaluation exclusion fixture case_count does not match the profile"
        )
    scope = require_id(values.get("scope"), "evaluation exclusion fixture scope")
    cases: list[dict[str, Any]] = []
    for case_index in range(declared_count):
        prefix = f"case.{case_index}."
        prompt = require_string(
            values.get(prefix + "prompt"),
            f"evaluation case {case_index} prompt",
            maximum=MAX_TEXT_BYTES,
        )
        try:
            history_count = int(values.get(prefix + "history_turn_count", "0"))
        except ValueError as error:
            raise ValueError(
                f"evaluation case {case_index} history_turn_count must be an integer"
            ) from error
        if not 0 <= history_count <= 128:
            raise ValueError(
                f"evaluation case {case_index} history_turn_count is out of bounds"
            )
        context: list[str] = []
        for turn_index in range(history_count):
            for role in ("user", "assistant"):
                key = f"{prefix}history.{turn_index}.{role}"
                context.append(
                    require_string(
                        values.get(key),
                        f"evaluation case {case_index} {key}",
                        maximum=MAX_TEXT_BYTES,
                    )
                )
        context.append(prompt)
        anchors: list[str] = []
        for key in ("required_answer_terms", "required_json_keys", "expected_text"):
            raw_value = values.get(prefix + key)
            if raw_value:
                anchors.extend(
                    part.strip() for part in raw_value.split(",") if part.strip()
                )
        cases.append(
            {
                "case_index": case_index,
                "scope": scope,
                "prompt": "\n".join(context),
                "answer_anchors": tuple(anchors),
            }
        )
    case_prefixes = {
        int(match.group(1))
        for key in values
        if (match := re.match(r"case\.(\d+)\.", key)) is not None
    }
    if case_prefixes != set(range(declared_count)):
        raise ValueError("evaluation exclusion fixture case indices are not contiguous")
    return tuple(cases)


def _load_review_rubric(
    path: Path, expected_bytes: int, expected_sha256: str
) -> tuple[str, tuple[tuple[str, str], ...], frozenset[str]]:
    actual_bytes = verify_regular_file(path, MAX_PROFILE_BYTES, "review rubric")
    if actual_bytes != expected_bytes:
        raise ValueError("review rubric byte length does not match the profile")
    if sha256_file(path) != expected_sha256:
        raise ValueError("review rubric SHA-256 does not match the profile")
    rubric = read_json_object(path, MAX_PROFILE_BYTES, "review rubric")
    require_exact_keys(rubric, REVIEW_RUBRIC_KEYS, "review rubric")
    if rubric["schema"] != CURRICULUM_REVIEW_RUBRIC_SCHEMA:
        raise ValueError(
            f"review rubric schema must be {CURRICULUM_REVIEW_RUBRIC_SCHEMA}"
        )
    rubric_id = require_id(rubric["rubric_id"], "review rubric rubric_id")
    if require_string_list(
        rubric["status_values"], "review rubric status_values", 3, 3
    ) != ("pass", "fail", "not-applicable"):
        raise ValueError("review rubric status_values drifted")
    if require_string_list(
        rubric["decision_values"], "review rubric decision_values", 2, 2
    ) != ("accept", "reject"):
        raise ValueError("review rubric decision_values drifted")

    checklist_values = _require_object_list(
        rubric["checklist"], "review rubric checklist", 1, 128
    )
    checklist: list[tuple[str, str]] = []
    for index, item in enumerate(checklist_values):
        label = f"review rubric checklist[{index}]"
        require_exact_keys(item, REVIEW_RUBRIC_CHECKLIST_KEYS, label)
        check_id = require_id(item["id"], f"{label}.id")
        applicability = require_string(item["applicability"], f"{label}.applicability")
        if applicability not in {"always", "task-specific"}:
            raise ValueError(f"{label}.applicability is invalid")
        checklist.append((check_id, applicability))
    if len({check_id for check_id, _ in checklist}) != len(checklist):
        raise ValueError("review rubric checklist ids must be unique")

    acceptance = _require_object(rubric["acceptance"], "review rubric acceptance")
    require_exact_keys(
        acceptance, REVIEW_RUBRIC_ACCEPTANCE_KEYS, "review rubric acceptance"
    )
    always_pass = frozenset(
        require_string_list(
            acceptance["always_pass"], "review rubric acceptance.always_pass", 1, 128
        )
    )
    declared_always = {
        check_id for check_id, applicability in checklist if applicability == "always"
    }
    if always_pass != declared_always:
        raise ValueError(
            "review rubric acceptance.always_pass must equal all always-applicable checks"
        )
    for key in (
        "no_fail",
        "response_rewrite_forbidden",
        "hidden_reasoning_forbidden",
    ):
        if require_bool(acceptance[key], f"review rubric acceptance.{key}") is not True:
            raise ValueError(f"review rubric acceptance.{key} must be true")
    return rubric_id, tuple(checklist), always_pass


def load_profile(path: Path) -> WorkingModelProfile:
    value = read_json_object(path, MAX_PROFILE_BYTES, "working-model profile")
    require_exact_keys(value, PROFILE_KEYS, "working-model profile")
    if value["schema"] != PROFILE_SCHEMA:
        raise ValueError(f"working-model profile schema must be {PROFILE_SCHEMA}")
    profile_id = require_id(value["profile_id"], "profile_id")
    goal_sha256 = require_sha256(value["goal_sha256"], "goal_sha256")
    if value["status"] != "preregistered":
        raise ValueError("working-model profile status must be preregistered")

    source = _require_object(value["source"], "source")
    require_exact_keys(source, SOURCE_KEYS, "source")
    source_repo_id = require_string(
        source["repo_id"], "source.repo_id", pattern=REPO_ID_PATTERN
    )
    source_revision = require_string(
        source["revision"],
        "source.revision",
        minimum=40,
        maximum=64,
        pattern=REVISION_PATTERN,
    )
    require_string(source["license_id"], "source.license_id")
    if source["architecture"] != "Qwen3ForCausalLM":
        raise ValueError("source.architecture must be Qwen3ForCausalLM")
    source_status = require_string(source["status"], "source.status")
    if source_status != "terminally-rejected-as-product-model":
        raise ValueError(
            "the unchanged base must remain terminally rejected as a product model"
        )
    if source["permitted_use"] != "base-ancestor-for-new-derivative-only":
        raise ValueError(
            "source.permitted_use must prohibit promotion of unchanged base bytes"
        )
    source_files_value = _require_object_list(source["files"], "source.files", 2, 128)
    source_files: list[dict[str, Any]] = []
    source_names: set[str] = set()
    for index, file_value in enumerate(source_files_value):
        label = f"source.files[{index}]"
        require_exact_keys(file_value, SOURCE_FILE_KEYS, label)
        name = require_string(file_value["name"], f"{label}.name", maximum=255)
        if Path(name).name != name or name in source_names:
            raise ValueError("source file names must be unique base names")
        source_names.add(name)
        source_files.append(
            {
                "name": name,
                "bytes": require_integer(
                    file_value["bytes"], f"{label}.bytes", 1, MAX_IDENTITY_FILE_BYTES
                ),
                "sha256": require_sha256(file_value["sha256"], f"{label}.sha256"),
            }
        )
    if "model.safetensors" not in source_names or "tokenizer.json" not in source_names:
        raise ValueError("source.files must bind model.safetensors and tokenizer.json")

    evaluation_values = _require_object_list(
        value["evaluation_exclusions"], "evaluation_exclusions", 1, 256
    )
    repository_root = Path(__file__).resolve().parents[2]
    evaluation_exclusions: list[dict[str, Any]] = []
    evaluation_case_count = 0
    evaluation_paths: set[Path] = set()
    for index, evaluation_value in enumerate(evaluation_values):
        label = f"evaluation_exclusions[{index}]"
        require_exact_keys(evaluation_value, EVALUATION_EXCLUSION_KEYS, label)
        raw_path = Path(
            require_string(evaluation_value["path"], f"{label}.path", maximum=32768)
        )
        resolved = (
            raw_path.resolve()
            if raw_path.is_absolute()
            else (repository_root / raw_path).resolve()
        )
        if resolved in evaluation_paths:
            raise ValueError("evaluation exclusion paths must be unique")
        evaluation_paths.add(resolved)
        expected_bytes = require_integer(
            evaluation_value["bytes"], f"{label}.bytes", 1, 64 * 1024 * 1024
        )
        actual_bytes = verify_regular_file(resolved, 64 * 1024 * 1024, label)
        if actual_bytes != expected_bytes:
            raise ValueError(f"{label} byte length does not match")
        expected_sha256 = require_sha256(evaluation_value["sha256"], f"{label}.sha256")
        if sha256_file(resolved) != expected_sha256:
            raise ValueError(f"{label} SHA-256 does not match")
        case_count = require_integer(
            evaluation_value["case_count"], f"{label}.case_count", 1, 100000
        )
        parsed_cases = _parse_eval_fixture(resolved, case_count)
        evaluation_exclusions.append(
            {
                "path": resolved,
                "public_path": str(raw_path).replace("\\", "/"),
                "bytes": actual_bytes,
                "case_count": case_count,
                "sha256": expected_sha256,
                "cases": parsed_cases,
            }
        )
        evaluation_case_count += case_count

    curriculum = _require_object(value["curriculum"], "curriculum")
    require_exact_keys(curriculum, CURRICULUM_KEYS, "curriculum")
    pilot_count = require_integer(
        curriculum["pilot_record_count"], "curriculum.pilot_record_count", 1, 1000000
    )
    scale_count = require_integer(
        curriculum["scale_record_count"],
        "curriculum.scale_record_count",
        pilot_count,
        10000000,
    )
    positive_rate = require_number(
        curriculum["minimum_helpful_positive_rate"],
        "curriculum.minimum_helpful_positive_rate",
        0.5,
        1.0,
    )
    boundary_rate = require_number(
        curriculum["maximum_narrow_boundary_rate"],
        "curriculum.maximum_narrow_boundary_rate",
        0.0,
        0.5,
    )
    if positive_rate + boundary_rate < 1.0:
        raise ValueError("curriculum disposition rates leave an unclassified gap")
    maximum_record_bytes = require_integer(
        curriculum["maximum_record_bytes"],
        "curriculum.maximum_record_bytes",
        1024,
        MAX_TEXT_BYTES,
    )
    provenance_classes = frozenset(
        require_string_list(
            curriculum["allowed_provenance_classes"],
            "curriculum.allowed_provenance_classes",
            1,
            32,
        )
    )
    license_ids = frozenset(
        require_string_list(
            curriculum["allowed_license_ids"], "curriculum.allowed_license_ids", 1, 64
        )
    )
    review_policy = _require_object(
        curriculum["review_policy"], "curriculum.review_policy"
    )
    require_exact_keys(review_policy, REVIEW_POLICY_KEYS, "curriculum.review_policy")
    rubric_identity = _require_object(
        review_policy["rubric"], "curriculum.review_policy.rubric"
    )
    require_exact_keys(
        rubric_identity,
        PROFILE_RUBRIC_IDENTITY_KEYS,
        "curriculum.review_policy.rubric",
    )
    raw_rubric_path = Path(
        require_string(
            rubric_identity["path"],
            "curriculum.review_policy.rubric.path",
            maximum=32768,
        )
    )
    rubric_path = (
        raw_rubric_path.resolve()
        if raw_rubric_path.is_absolute()
        else (repository_root / raw_rubric_path).resolve()
    )
    rubric_bytes = require_integer(
        rubric_identity["bytes"],
        "curriculum.review_policy.rubric.bytes",
        1,
        MAX_PROFILE_BYTES,
    )
    rubric_sha256 = require_sha256(
        rubric_identity["sha256"], "curriculum.review_policy.rubric.sha256"
    )
    rubric_id, review_checklist, review_always_pass = _load_review_rubric(
        rubric_path, rubric_bytes, rubric_sha256
    )
    exact_review_policy = {
        "candidate_projection": "curriculum-record-without-review-v1",
        "primary_reviewer_count": 2,
        "distinct_reviewer_identities_required": True,
        "distinct_custody_domains_required": True,
        "disagreement_policy": "third-distinct-reviewer-required",
        "unnecessary_adjudication_forbidden": True,
        "response_rewrite_forbidden": True,
        "hidden_reasoning_forbidden": True,
    }
    for key, expected in exact_review_policy.items():
        if review_policy[key] != expected:
            raise ValueError(f"curriculum.review_policy.{key} drifted")
    category_values = _require_object_list(
        curriculum["categories"], "curriculum.categories", 1, 128
    )
    categories: list[CategoryPolicy] = []
    for index, category_value in enumerate(category_values):
        label = f"curriculum.categories[{index}]"
        require_exact_keys(category_value, CATEGORY_KEYS, label)
        categories.append(
            CategoryPolicy(
                require_id(category_value["id"], f"{label}.id"),
                require_integer(
                    category_value["pilot_count"],
                    f"{label}.pilot_count",
                    1,
                    pilot_count,
                ),
                require_integer(
                    category_value["scale_count"],
                    f"{label}.scale_count",
                    1,
                    scale_count,
                ),
                tuple(
                    require_id(item, f"{label}.required_factors")
                    for item in require_string_list(
                        category_value["required_factors"],
                        f"{label}.required_factors",
                        1,
                        64,
                    )
                ),
                require_integer(
                    category_value["minimum_distinct_values_per_factor"],
                    f"{label}.minimum_distinct_values_per_factor",
                    1,
                    1000,
                ),
            )
        )
    if len({category.category_id for category in categories}) != len(categories):
        raise ValueError("curriculum category ids must be unique")
    if sum(category.pilot_count for category in categories) != pilot_count:
        raise ValueError(
            "curriculum category pilot counts must equal pilot_record_count"
        )
    if sum(category.scale_count for category in categories) != scale_count:
        raise ValueError(
            "curriculum category scale counts must equal scale_record_count"
        )

    holdouts = _require_object(value["holdouts"], "holdouts")
    require_exact_keys(holdouts, HOLDOUT_KEYS, "holdouts")
    holdout_count = require_integer(
        holdouts["case_count"], "holdouts.case_count", 1, 100000
    )
    development_count = require_integer(
        holdouts["development_count"], "holdouts.development_count", 1, holdout_count
    )
    independent_count = require_integer(
        holdouts["independent_audit_count"],
        "holdouts.independent_audit_count",
        1,
        holdout_count,
    )
    if development_count + independent_count != holdout_count:
        raise ValueError("holdout split counts must equal case_count")
    cases_per_category = require_integer(
        holdouts["cases_per_category"], "holdouts.cases_per_category", 1, holdout_count
    )
    if cases_per_category * len(categories) != holdout_count:
        raise ValueError(
            "cases_per_category * category count must equal holdouts.case_count"
        )
    seed_bytes = require_integer(
        holdouts["secret_seed_bytes"], "holdouts.secret_seed_bytes", 32, 64
    )
    minimum_prompt_variants = require_integer(
        holdouts["minimum_prompt_variants"], "holdouts.minimum_prompt_variants", 2, 1000
    )
    minimum_anchor_variants = require_integer(
        holdouts["minimum_anchor_variants"], "holdouts.minimum_anchor_variants", 2, 1000
    )

    contamination = _require_object(value["contamination"], "contamination")
    require_exact_keys(contamination, CONTAMINATION_KEYS, "contamination")
    character_ngram_size = require_integer(
        contamination["character_ngram_size"],
        "contamination.character_ngram_size",
        3,
        128,
    )
    character_threshold = require_number(
        contamination["character_containment_threshold"],
        "contamination.character_containment_threshold",
        0.1,
        1.0,
    )
    token_ngram_size = require_integer(
        contamination["token_ngram_size"], "contamination.token_ngram_size", 2, 64
    )
    token_threshold = require_number(
        contamination["token_containment_threshold"],
        "contamination.token_containment_threshold",
        0.1,
        1.0,
    )
    entity_ngram_size = require_integer(
        contamination["entity_token_ngram_size"],
        "contamination.entity_token_ngram_size",
        2,
        64,
    )
    entity_threshold = require_number(
        contamination["entity_containment_threshold"],
        "contamination.entity_containment_threshold",
        0.1,
        1.0,
    )
    answer_ngram_size = require_integer(
        contamination["answer_token_ngram_size"],
        "contamination.answer_token_ngram_size",
        2,
        64,
    )
    answer_threshold = require_number(
        contamination["answer_containment_threshold"],
        "contamination.answer_containment_threshold",
        0.1,
        1.0,
    )
    semantic_threshold = require_number(
        contamination["semantic_cosine_threshold"],
        "contamination.semantic_cosine_threshold",
        0.1,
        1.0,
    )
    semantic_floor = require_number(
        contamination["semantic_review_floor"],
        "contamination.semantic_review_floor",
        0.0,
        semantic_threshold,
    )

    _validate_training(value["training"])
    _validate_stop_rules(value["stop_rules"])

    return WorkingModelProfile(
        path.resolve(),
        sha256_file(path),
        value,
        profile_id,
        goal_sha256,
        source_repo_id,
        source_revision,
        source_status,
        tuple(source_files),
        tuple(evaluation_exclusions),
        evaluation_case_count,
        pilot_count,
        scale_count,
        positive_rate,
        boundary_rate,
        maximum_record_bytes,
        provenance_classes,
        license_ids,
        rubric_path,
        rubric_bytes,
        rubric_sha256,
        rubric_id,
        review_checklist,
        review_always_pass,
        tuple(categories),
        holdout_count,
        development_count,
        independent_count,
        cases_per_category,
        seed_bytes,
        minimum_prompt_variants,
        minimum_anchor_variants,
        character_ngram_size,
        character_threshold,
        token_ngram_size,
        token_threshold,
        entity_ngram_size,
        entity_threshold,
        answer_ngram_size,
        answer_threshold,
        semantic_threshold,
        semantic_floor,
    )


def _hmac_index(seed: bytes, purpose: str, case_id: str, count: int) -> int:
    digest = hmac.new(
        seed, f"{purpose}\x00{case_id}".encode("utf-8"), hashlib.sha256
    ).digest()
    return int.from_bytes(digest, "big") % count


def _entity_pairs(value: Any, label: str) -> tuple[tuple[str, str], ...]:
    entities = _require_object_list(value, label, 0, 128)
    pairs: list[tuple[str, str]] = []
    for index, entity in enumerate(entities):
        item_label = f"{label}[{index}]"
        require_exact_keys(entity, ENTITY_KEYS, item_label)
        pairs.append(
            (
                require_id(entity["kind"], f"{item_label}.kind"),
                require_string(entity["value"], f"{item_label}.value", maximum=4096),
            )
        )
    if len(set(pairs)) != len(pairs):
        raise ValueError(f"{label} values must be unique")
    return tuple(pairs)


def _validate_factor_case(
    profile: WorkingModelProfile,
    case: dict[str, Any],
    label: str,
) -> ValidatedFactorCase:
    require_exact_keys(case, FACTOR_CASE_KEYS, label)
    case_id = require_id(case["case_id"], f"{label}.case_id")
    split = require_string(case["split"], f"{label}.split")
    if split not in {"development", "independent-audit"}:
        raise ValueError(f"{label}.split must be development or independent-audit")
    task_family = require_id(case["task_family"], f"{label}.task_family")
    category = profile.categories_by_id.get(task_family)
    if category is None:
        raise ValueError(f"{label}.task_family is not declared by the profile")
    template_family_id = require_id(
        case["template_family_id"], f"{label}.template_family_id"
    )
    prompt_variants = require_string_list(
        case["prompt_variants"],
        f"{label}.prompt_variants",
        profile.minimum_prompt_variants,
        1000,
    )
    normalized_prompts = tuple(normalize_text(prompt) for prompt in prompt_variants)
    if len(set(normalized_prompts)) != len(normalized_prompts):
        raise ValueError(
            f"{label}.prompt_variants must be distinct after normalization"
        )
    anchor_variant_values = case["answer_anchor_variants"]
    if (
        not isinstance(anchor_variant_values, list)
        or not profile.minimum_anchor_variants <= len(anchor_variant_values) <= 1000
    ):
        raise ValueError(
            f"{label}.answer_anchor_variants must contain at least "
            f"{profile.minimum_anchor_variants} variants"
        )
    anchor_variants = tuple(
        require_string_list(
            value,
            f"{label}.answer_anchor_variants[{anchor_index}]",
            1,
            64,
        )
        for anchor_index, value in enumerate(anchor_variant_values)
    )
    normalized_anchor_variants = {
        tuple(sorted(normalize_text(anchor) for anchor in anchors))
        for anchors in anchor_variants
    }
    if len(normalized_anchor_variants) != len(anchor_variants):
        raise ValueError(
            f"{label}.answer_anchor_variants must be distinct after normalization"
        )
    entities = _entity_pairs(case["entities"], f"{label}.entities")
    factors = _require_object(case["scenario_factors"], f"{label}.scenario_factors")
    if set(factors) != set(category.required_factors):
        raise ValueError(
            f"{label}.scenario_factors must exactly match category required factors"
        )
    normalized_factors = {
        require_id(key, f"{label}.scenario_factors key"): require_string(
            value, f"{label}.scenario_factors.{key}"
        )
        for key, value in sorted(factors.items())
    }
    return ValidatedFactorCase(
        case_id=case_id,
        split=split,
        task_family=task_family,
        category=category,
        template_family_id=template_family_id,
        prompt_variants=prompt_variants,
        answer_anchor_variants=anchor_variants,
        entities=entities,
        scenario_factors=normalized_factors,
    )


def _holdout_slots(profile: WorkingModelProfile) -> tuple[dict[str, Any], ...]:
    category_count = len(profile.categories)
    total = profile.cases_per_category * category_count
    exact_development = (
        profile.cases_per_category * profile.development_holdout_count / total
    )
    base_development = math.floor(exact_development)
    development_by_category = {
        category.category_id: base_development for category in profile.categories
    }
    remaining = profile.development_holdout_count - (base_development * category_count)
    ranked_categories = sorted(
        profile.categories,
        key=lambda category: (
            -(exact_development - base_development),
            category.category_id,
        ),
    )
    for category in ranked_categories[:remaining]:
        development_by_category[category.category_id] += 1

    slots: list[dict[str, Any]] = []
    for category in profile.categories:
        development_count = development_by_category[category.category_id]
        selected_development_indices = {
            index
            for index in range(profile.cases_per_category)
            if math.floor((index + 1) * development_count / profile.cases_per_category)
            > math.floor(index * development_count / profile.cases_per_category)
        }
        split_ordinals: Counter[str] = Counter()
        for case_index in range(profile.cases_per_category):
            split = (
                "development"
                if case_index in selected_development_indices
                else "independent-audit"
            )
            split_ordinals[split] += 1
            split_label = "dev" if split == "development" else "audit"
            slots.append(
                {
                    "case_id": (
                        f"{category.category_id}-{split_label}-"
                        f"{split_ordinals[split]:03d}"
                    ),
                    "split": split,
                    "task_family": category.category_id,
                    "required_factors": list(category.required_factors),
                }
            )

    split_counts = Counter(slot["split"] for slot in slots)
    if split_counts != Counter(
        {
            "development": profile.development_holdout_count,
            "independent-audit": profile.independent_audit_holdout_count,
        }
    ):
        raise ValueError("profile holdout split cannot be allocated deterministically")
    return tuple(sorted(slots, key=lambda item: item["case_id"]))


def _holdout_contribution_template(
    profile: WorkingModelProfile,
    plan_id: str,
    slot_set_sha256: str,
    split: str,
    slots: Sequence[dict[str, Any]],
) -> dict[str, Any]:
    cases = []
    for slot in slots:
        if slot["split"] != split:
            continue
        cases.append(
            {
                "case_id": slot["case_id"],
                "split": split,
                "task_family": slot["task_family"],
                "template_family_id": "",
                "prompt_variants": [],
                "answer_anchor_variants": [],
                "entities": [],
                "scenario_factors": {factor: "" for factor in slot["required_factors"]},
            }
        )
    return {
        "schema": HOLDOUT_CONTRIBUTION_SCHEMA,
        "status": "authoring-required",
        "contribution_id": "",
        "plan_id": plan_id,
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "slot_set_sha256": slot_set_sha256,
        "split": split,
        "author_identity_sha256": "",
        "custody_domain_sha256": "",
        "cases": cases,
    }


def initialize_holdout_custody(
    profile: WorkingModelProfile,
    plan_id: str,
    output_root: Path,
) -> dict[str, Any]:
    plan_id = require_id(plan_id, "holdout custody plan_id")
    output_root = _validate_external_output_root(output_root)
    slots = _holdout_slots(profile)
    slot_set_sha256 = sha256_bytes(canonical_json_bytes(slots))
    development_template = _holdout_contribution_template(
        profile, plan_id, slot_set_sha256, "development", slots
    )
    independent_template = _holdout_contribution_template(
        profile, plan_id, slot_set_sha256, "independent-audit", slots
    )
    development_payload = _json_document_bytes(development_template)
    independent_payload = _json_document_bytes(independent_template)
    seed = secrets.token_bytes(profile.secret_seed_bytes)
    split_counts = dict(sorted(Counter(slot["split"] for slot in slots).items()))
    plan = {
        "schema": HOLDOUT_CUSTODY_PLAN_SCHEMA,
        "status": "awaiting-distinct-contributions",
        "plan_id": plan_id,
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "control_program_sha256": control_program_sha256(),
        "case_count": len(slots),
        "split_counts": split_counts,
        "slot_set_sha256": slot_set_sha256,
        "seed_commitment": sha256_bytes(b"tinyrustlm-holdout-seed-v1\x00" + seed),
        "slots": list(slots),
        "development_template_sha256": sha256_bytes(development_payload),
        "independent_audit_template_sha256": sha256_bytes(independent_payload),
        "contains_raw_prompts": False,
        "contains_answer_anchors": False,
        "contains_seed": False,
    }
    output_root.mkdir()
    _write_new_atomic(
        output_root / DEVELOPMENT_CONTRIBUTION_FILENAME, development_payload
    )
    _write_new_atomic(
        output_root / INDEPENDENT_AUDIT_CONTRIBUTION_FILENAME,
        independent_payload,
    )
    _write_new_atomic(output_root / HOLDOUT_SEED_FILENAME, seed)
    _write_new_atomic(
        output_root / HOLDOUT_CUSTODY_PLAN_FILENAME, _json_document_bytes(plan)
    )
    return plan


def _validate_holdout_custody_plan(
    profile: WorkingModelProfile, path: Path
) -> tuple[dict[str, Any], tuple[dict[str, Any], ...]]:
    plan = read_json_object(path, MAX_FACTOR_PACK_BYTES, "holdout custody plan")
    require_exact_keys(plan, HOLDOUT_CUSTODY_PLAN_KEYS, "holdout custody plan")
    if plan["schema"] != HOLDOUT_CUSTODY_PLAN_SCHEMA:
        raise ValueError(
            f"holdout custody plan schema must be {HOLDOUT_CUSTODY_PLAN_SCHEMA}"
        )
    if plan["status"] != "awaiting-distinct-contributions":
        raise ValueError("holdout custody plan status is not authoring-ready")
    require_id(plan["plan_id"], "holdout custody plan plan_id")
    if plan["profile_id"] != profile.profile_id:
        raise ValueError("holdout custody plan profile id mismatch")
    if plan["profile_sha256"] != profile.profile_sha256:
        raise ValueError("holdout custody plan profile SHA-256 mismatch")
    require_sha256(
        plan["control_program_sha256"],
        "holdout custody plan control_program_sha256",
    )
    if plan["control_program_sha256"] != control_program_sha256():
        raise ValueError("holdout custody plan was created by another control program")
    case_count = require_integer(
        plan["case_count"],
        "holdout custody plan case_count",
        profile.holdout_case_count,
        profile.holdout_case_count,
    )
    slots = _require_object_list(
        plan["slots"], "holdout custody plan slots", case_count, case_count
    )
    expected_slots = _holdout_slots(profile)
    for index, slot in enumerate(slots):
        require_exact_keys(
            slot, HOLDOUT_SLOT_KEYS, f"holdout custody plan slots[{index}]"
        )
    if canonical_json_bytes(slots) != canonical_json_bytes(expected_slots):
        raise ValueError("holdout custody plan slots drifted from the profile")
    expected_split_counts = dict(
        sorted(Counter(slot["split"] for slot in expected_slots).items())
    )
    if plan["split_counts"] != expected_split_counts:
        raise ValueError("holdout custody plan split counts mismatch")
    expected_slot_hash = sha256_bytes(canonical_json_bytes(expected_slots))
    if plan["slot_set_sha256"] != expected_slot_hash:
        raise ValueError("holdout custody plan slot-set identity mismatch")
    require_sha256(plan["seed_commitment"], "holdout custody plan seed_commitment")
    require_sha256(
        plan["development_template_sha256"],
        "holdout custody plan development_template_sha256",
    )
    require_sha256(
        plan["independent_audit_template_sha256"],
        "holdout custody plan independent_audit_template_sha256",
    )
    expected_development_template = _holdout_contribution_template(
        profile,
        plan["plan_id"],
        expected_slot_hash,
        "development",
        expected_slots,
    )
    expected_independent_template = _holdout_contribution_template(
        profile,
        plan["plan_id"],
        expected_slot_hash,
        "independent-audit",
        expected_slots,
    )
    if plan["development_template_sha256"] != sha256_bytes(
        _json_document_bytes(expected_development_template)
    ):
        raise ValueError("holdout custody plan development template identity mismatch")
    if plan["independent_audit_template_sha256"] != sha256_bytes(
        _json_document_bytes(expected_independent_template)
    ):
        raise ValueError(
            "holdout custody plan independent-audit template identity mismatch"
        )
    for key in ("contains_raw_prompts", "contains_answer_anchors", "contains_seed"):
        if require_bool(plan[key], f"holdout custody plan {key}"):
            raise ValueError(f"holdout custody plan {key} must be false")
    return plan, expected_slots


def _validate_holdout_contribution(
    profile: WorkingModelProfile,
    plan: dict[str, Any],
    slots: Sequence[dict[str, Any]],
    path: Path,
    expected_split: str,
) -> tuple[dict[str, Any], tuple[ValidatedFactorCase, ...]]:
    contribution = read_json_object(
        path, MAX_FACTOR_PACK_BYTES, f"{expected_split} holdout contribution"
    )
    require_exact_keys(
        contribution,
        HOLDOUT_CONTRIBUTION_KEYS,
        f"{expected_split} holdout contribution",
    )
    label = f"{expected_split} holdout contribution"
    if contribution["schema"] != HOLDOUT_CONTRIBUTION_SCHEMA:
        raise ValueError(f"{label} schema must be {HOLDOUT_CONTRIBUTION_SCHEMA}")
    if contribution["status"] != "complete":
        raise ValueError(f"{label} status must be complete")
    require_id(contribution["contribution_id"], f"{label}.contribution_id")
    if contribution["plan_id"] != plan["plan_id"]:
        raise ValueError(f"{label} plan id mismatch")
    if contribution["profile_id"] != profile.profile_id:
        raise ValueError(f"{label} profile id mismatch")
    if contribution["profile_sha256"] != profile.profile_sha256:
        raise ValueError(f"{label} profile SHA-256 mismatch")
    if contribution["slot_set_sha256"] != plan["slot_set_sha256"]:
        raise ValueError(f"{label} slot-set identity mismatch")
    if contribution["split"] != expected_split:
        raise ValueError(f"{label} split mismatch")
    require_sha256(
        contribution["author_identity_sha256"], f"{label}.author_identity_sha256"
    )
    require_sha256(
        contribution["custody_domain_sha256"], f"{label}.custody_domain_sha256"
    )
    expected_slots = tuple(slot for slot in slots if slot["split"] == expected_split)
    case_values = _require_object_list(
        contribution["cases"],
        f"{label}.cases",
        len(expected_slots),
        len(expected_slots),
    )
    validated_cases: list[ValidatedFactorCase] = []
    for index, (case, slot) in enumerate(zip(case_values, expected_slots, strict=True)):
        validated = _validate_factor_case(profile, case, f"{label}.cases[{index}]")
        if validated.case_id != slot["case_id"]:
            raise ValueError(f"{label} case order or identity drifted")
        if validated.split != expected_split:
            raise ValueError(f"{label} contains a case assigned to another split")
        if validated.task_family != slot["task_family"]:
            raise ValueError(f"{label} case task family drifted from its slot")
        validated_cases.append(validated)
    return contribution, tuple(validated_cases)


def assemble_holdout_contributions(
    profile: WorkingModelProfile,
    plan_path: Path,
    development_path: Path,
    independent_audit_path: Path,
    output_root: Path,
) -> dict[str, Any]:
    output_root = _validate_external_output_root(output_root)
    plan, slots = _validate_holdout_custody_plan(profile, plan_path)
    development, development_cases = _validate_holdout_contribution(
        profile, plan, slots, development_path, "development"
    )
    independent, independent_cases = _validate_holdout_contribution(
        profile, plan, slots, independent_audit_path, "independent-audit"
    )
    if development["author_identity_sha256"] == independent["author_identity_sha256"]:
        raise ValueError("holdout contributions require distinct author identities")
    if development["custody_domain_sha256"] == independent["custody_domain_sha256"]:
        raise ValueError("holdout contributions require distinct custody domains")

    all_validated = development_cases + independent_cases
    template_ids: set[str] = set()
    normalized_prompts: set[str] = set()
    factor_values: defaultdict[tuple[str, str, str], set[str]] = defaultdict(set)
    for validated in all_validated:
        if validated.template_family_id in template_ids:
            raise ValueError("holdout template family ids must be globally unique")
        template_ids.add(validated.template_family_id)
        for prompt in validated.prompt_variants:
            normalized = normalize_text(prompt)
            if normalized in normalized_prompts:
                raise ValueError("holdout prompt variants must be globally distinct")
            normalized_prompts.add(normalized)
        for factor, value in validated.scenario_factors.items():
            factor_values[(validated.task_family, "all", factor)].add(value)
            factor_values[(validated.task_family, validated.split, factor)].add(value)

    for category in profile.categories:
        category_cases = [
            case for case in all_validated if case.task_family == category.category_id
        ]
        if len(category_cases) != profile.cases_per_category:
            raise ValueError("holdout category coverage drifted during assembly")
        for factor in category.required_factors:
            values = factor_values[(category.category_id, "all", factor)]
            if len(values) < category.minimum_distinct_values_per_factor:
                raise ValueError(
                    f"holdout factor {category.category_id}.{factor} lacks diversity"
                )
            for split in ("development", "independent-audit"):
                split_case_count = sum(
                    1 for case in category_cases if case.split == split
                )
                required = min(
                    category.minimum_distinct_values_per_factor, split_case_count
                )
                if len(factor_values[(category.category_id, split, factor)]) < required:
                    raise ValueError(
                        f"holdout factor {category.category_id}.{factor} lacks "
                        f"{split} diversity"
                    )

    case_by_id = {
        case["case_id"]: case
        for contribution in (development, independent)
        for case in contribution["cases"]
    }
    factor_pack = {
        "schema": FACTOR_PACK_SCHEMA,
        "pack_id": plan["plan_id"],
        "cases": [case_by_id[slot["case_id"]] for slot in slots],
    }
    factor_pack_payload = _json_document_bytes(factor_pack)
    receipt = {
        "schema": HOLDOUT_CUSTODY_RECEIPT_SCHEMA,
        "status": "assembled-awaiting-holdout-seal",
        "plan_id": plan["plan_id"],
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "control_program_sha256": control_program_sha256(),
        "plan_sha256": sha256_file(plan_path),
        "slot_set_sha256": plan["slot_set_sha256"],
        "seed_commitment": plan["seed_commitment"],
        "development_contribution_sha256": sha256_file(development_path),
        "independent_audit_contribution_sha256": sha256_file(independent_audit_path),
        "development_author_identity_sha256": development["author_identity_sha256"],
        "independent_audit_author_identity_sha256": independent[
            "author_identity_sha256"
        ],
        "development_custody_domain_sha256": development["custody_domain_sha256"],
        "independent_audit_custody_domain_sha256": independent["custody_domain_sha256"],
        "case_count": len(all_validated),
        "split_counts": dict(
            sorted(Counter(case.split for case in all_validated).items())
        ),
        "category_count": len(profile.categories),
        "factor_pack_sha256": sha256_bytes(factor_pack_payload),
        "contains_raw_prompts": False,
        "contains_answer_anchors": False,
        "contains_seed": False,
        "training_authority": False,
    }
    output_root.mkdir()
    _write_new_atomic(output_root / ASSEMBLED_FACTOR_PACK_FILENAME, factor_pack_payload)
    _write_new_atomic(
        output_root / HOLDOUT_CUSTODY_RECEIPT_FILENAME,
        _json_document_bytes(receipt),
    )
    return receipt


def _validate_holdout_custody_receipt(
    profile: WorkingModelProfile,
    path: Path,
    factor_pack_path: Path,
    seed: bytes,
) -> dict[str, Any]:
    receipt = read_json_object(
        path, MAX_SEMANTIC_RECEIPT_BYTES, "holdout custody receipt"
    )
    require_exact_keys(receipt, HOLDOUT_CUSTODY_RECEIPT_KEYS, "holdout custody receipt")
    if receipt["schema"] != HOLDOUT_CUSTODY_RECEIPT_SCHEMA:
        raise ValueError(
            f"holdout custody receipt schema must be {HOLDOUT_CUSTODY_RECEIPT_SCHEMA}"
        )
    if receipt["status"] != "assembled-awaiting-holdout-seal":
        raise ValueError("holdout custody receipt status is not seal-ready")
    require_id(receipt["plan_id"], "holdout custody receipt plan_id")
    if receipt["profile_id"] != profile.profile_id:
        raise ValueError("holdout custody receipt profile id mismatch")
    if receipt["profile_sha256"] != profile.profile_sha256:
        raise ValueError("holdout custody receipt profile SHA-256 mismatch")
    for key in (
        "control_program_sha256",
        "plan_sha256",
        "slot_set_sha256",
        "seed_commitment",
        "development_contribution_sha256",
        "independent_audit_contribution_sha256",
        "development_author_identity_sha256",
        "independent_audit_author_identity_sha256",
        "development_custody_domain_sha256",
        "independent_audit_custody_domain_sha256",
        "factor_pack_sha256",
    ):
        require_sha256(receipt[key], f"holdout custody receipt {key}")
    if receipt["control_program_sha256"] != control_program_sha256():
        raise ValueError("holdout custody receipt came from another control program")
    if (
        receipt["development_author_identity_sha256"]
        == receipt["independent_audit_author_identity_sha256"]
    ):
        raise ValueError("holdout custody receipt author identities are not distinct")
    if (
        receipt["development_custody_domain_sha256"]
        == receipt["independent_audit_custody_domain_sha256"]
    ):
        raise ValueError("holdout custody receipt domains are not distinct")
    if receipt["seed_commitment"] != sha256_bytes(
        b"tinyrustlm-holdout-seed-v1\x00" + seed
    ):
        raise ValueError("holdout custody receipt seed commitment mismatch")
    if receipt["factor_pack_sha256"] != sha256_file(factor_pack_path):
        raise ValueError("holdout custody receipt factor-pack identity mismatch")
    if (
        require_integer(
            receipt["case_count"],
            "holdout custody receipt case_count",
            profile.holdout_case_count,
            profile.holdout_case_count,
        )
        != profile.holdout_case_count
    ):
        raise AssertionError("unreachable holdout custody case-count drift")
    expected_splits = {
        "development": profile.development_holdout_count,
        "independent-audit": profile.independent_audit_holdout_count,
    }
    if receipt["split_counts"] != expected_splits:
        raise ValueError("holdout custody receipt split counts mismatch")
    if require_integer(
        receipt["category_count"],
        "holdout custody receipt category_count",
        len(profile.categories),
        len(profile.categories),
    ) != len(profile.categories):
        raise AssertionError("unreachable holdout custody category-count drift")
    for key in ("contains_raw_prompts", "contains_answer_anchors", "contains_seed"):
        if require_bool(receipt[key], f"holdout custody receipt {key}"):
            raise ValueError(f"holdout custody receipt {key} must be false")
    if require_bool(
        receipt["training_authority"], "holdout custody receipt training_authority"
    ):
        raise ValueError("holdout custody receipt cannot grant training authority")
    return receipt


def _validate_external_output_root(output_root: Path) -> Path:
    if not output_root.is_absolute():
        raise ValueError("output root must be absolute")
    drive = output_root.drive.upper()
    if drive and drive not in {"C:", "E:"}:
        raise ValueError(
            "output root must be on C: or E:; D: and other drives are forbidden"
        )
    repository_root = Path(__file__).resolve().parents[2]
    candidate = output_root.resolve(strict=False)
    try:
        candidate.relative_to(repository_root)
    except ValueError:
        pass
    else:
        raise ValueError(
            "private or large evidence output must be outside the Git worktree"
        )
    if output_root.exists() or output_root.is_symlink():
        raise ValueError(f"output root already exists: {output_root}")
    parent = output_root.parent
    _reject_reparse_chain(parent, "output root parent")
    if not parent.is_dir():
        raise ValueError("output root parent must be an existing non-symlink directory")
    return output_root


def _require_allowed_storage_drive(path: Path, label: str) -> None:
    drive = path.drive.upper()
    if drive and drive not in {"C:", "E:"}:
        raise ValueError(
            f"{label} must be on C: or E:; D: and other drives are forbidden"
        )


def _require_external_evidence_location(path: Path, label: str) -> Path:
    if not path.is_absolute():
        raise ValueError(f"{label} must use an absolute path")
    _require_allowed_storage_drive(path, label)
    _reject_reparse_chain(path, label)
    resolved = path.resolve()
    repository_root = Path(__file__).resolve().parents[2]
    try:
        resolved.relative_to(repository_root)
    except ValueError:
        return resolved
    raise ValueError(f"{label} must remain outside the Git worktree")


def _write_new_atomic(path: Path, payload: bytes) -> None:
    if path.exists() or path.is_symlink():
        raise ValueError(f"evidence file already exists: {path}")
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.partial")
    try:
        with temporary.open("xb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _json_document_bytes(value: Any) -> bytes:
    return canonical_json_bytes(value) + b"\n"


def _json_lines_bytes(values: Iterable[dict[str, Any]]) -> bytes:
    return b"".join(canonical_json_bytes(value) + b"\n" for value in values)


def _answer_anchor_token_hashes(anchors: Sequence[str]) -> list[dict[str, Any]]:
    identities: set[tuple[int, str]] = set()
    for anchor in anchors:
        tokens = tokenize_normalized(anchor)
        if tokens:
            identities.add(
                (len(tokens), sha256_bytes("\x1f".join(tokens).encode("utf-8")))
            )
    return [
        {"token_count": token_count, "sha256": digest}
        for token_count, digest in sorted(identities)
    ]


def seal_holdouts(
    profile: WorkingModelProfile,
    factor_pack_path: Path,
    seed_path: Path,
    custody_receipt_path: Path,
    output_root: Path,
) -> dict[str, Any]:
    output_root = _validate_external_output_root(output_root)
    factor_pack = read_json_object(
        factor_pack_path, MAX_FACTOR_PACK_BYTES, "private factor pack"
    )
    require_exact_keys(factor_pack, FACTOR_PACK_KEYS, "private factor pack")
    if factor_pack["schema"] != FACTOR_PACK_SCHEMA:
        raise ValueError(f"private factor pack schema must be {FACTOR_PACK_SCHEMA}")
    pack_id = require_id(factor_pack["pack_id"], "private factor pack pack_id")
    case_values = _require_object_list(
        factor_pack["cases"],
        "private factor pack cases",
        profile.holdout_case_count,
        profile.holdout_case_count,
    )
    seed = read_regular_bytes(seed_path, 1024, "private holdout seed")
    if len(seed) != profile.secret_seed_bytes:
        raise ValueError(
            f"private holdout seed must be exactly {profile.secret_seed_bytes} bytes"
        )
    custody_receipt = _validate_holdout_custody_receipt(
        profile, custody_receipt_path, factor_pack_path, seed
    )
    if factor_pack["pack_id"] != custody_receipt["plan_id"]:
        raise ValueError("factor pack id does not match the custody plan id")

    materialized: list[dict[str, Any]] = []
    indexed_cases: list[dict[str, Any]] = []
    case_ids: set[str] = set()
    split_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    for index, case in enumerate(case_values):
        label = f"private factor pack cases[{index}]"
        validated = _validate_factor_case(profile, case, label)
        case_id = validated.case_id
        if case_id in case_ids:
            raise ValueError("private factor pack case ids must be unique")
        case_ids.add(case_id)
        prompt = validated.prompt_variants[
            _hmac_index(seed, "prompt", case_id, len(validated.prompt_variants))
        ]
        anchors = validated.answer_anchor_variants[
            _hmac_index(seed, "anchors", case_id, len(validated.answer_anchor_variants))
        ]
        case_commitment = (
            "sha256:"
            + hmac.new(
                seed, f"case\x00{case_id}".encode("utf-8"), hashlib.sha256
            ).hexdigest()
        )
        entity_values = validated.entities
        materialized.append(
            {
                "schema": PRIVATE_HOLDOUT_SCHEMA,
                "case_id": case_id,
                "case_commitment": case_commitment,
                "split": validated.split,
                "task_family": validated.task_family,
                "template_family_id": validated.template_family_id,
                "prompt": prompt,
                "answer_anchors": list(anchors),
                "entities": [
                    {"kind": kind, "value": surface}
                    for kind, surface in validated.entities
                ],
                "scenario_factors": validated.scenario_factors,
            }
        )
        answer_hashes = tuple(
            sorted(
                {
                    sha256_bytes(normalize_text(anchor).encode("utf-8"))
                    for anchor in anchors
                }
            )
        )
        answer_ngrams = tuple(
            sorted(
                {
                    item
                    for anchor in anchors
                    for item in token_ngram_hashes(
                        anchor, profile.answer_token_ngram_size
                    )
                }
            )
        )
        indexed_cases.append(
            {
                "case_commitment": case_commitment,
                "source_class": "sealed-holdout",
                "split": validated.split,
                "task_family_sha256": sha256_bytes(
                    validated.task_family.encode("utf-8")
                ),
                "template_family_sha256": sha256_bytes(
                    validated.template_family_id.encode("utf-8")
                ),
                "derived_template_signature_sha256": sha256_bytes(
                    template_signature(prompt, entity_values).encode("utf-8")
                ),
                "normalized_prompt_sha256": sha256_bytes(
                    normalize_text(prompt).encode("utf-8")
                ),
                "character_ngram_hashes": list(
                    character_ngram_hashes(prompt, profile.character_ngram_size)
                ),
                "token_ngram_hashes": list(
                    token_ngram_hashes(prompt, profile.token_ngram_size)
                ),
                "entity_token_ngram_hashes": list(
                    entity_token_ngram_hashes(
                        prompt, entity_values, profile.entity_token_ngram_size
                    )
                ),
                "exact_answer_anchor_hashes": list(answer_hashes),
                "answer_anchor_token_hashes": _answer_anchor_token_hashes(anchors),
                "answer_token_ngram_hashes": list(answer_ngrams),
            }
        )
        split_counts[validated.split] += 1
        category_counts[validated.task_family] += 1

    expected_splits = {
        "development": profile.development_holdout_count,
        "independent-audit": profile.independent_audit_holdout_count,
    }
    if dict(sorted(split_counts.items())) != expected_splits:
        raise ValueError("private factor pack split counts do not match the profile")
    expected_categories = {
        category.category_id: profile.cases_per_category
        for category in profile.categories
    }
    if dict(sorted(category_counts.items())) != dict(
        sorted(expected_categories.items())
    ):
        raise ValueError("private factor pack category counts do not match the profile")

    evaluation_artifact_identities: list[dict[str, Any]] = []
    for source in profile.evaluation_exclusions:
        evaluation_artifact_identities.append(
            {
                "public_path": source["public_path"],
                "bytes": source["bytes"],
                "case_count": source["case_count"],
                "sha256": source["sha256"],
            }
        )
        for evaluation_case in source["cases"]:
            prompt = evaluation_case["prompt"]
            anchors = evaluation_case["answer_anchors"]
            case_commitment = sha256_bytes(
                canonical_json_bytes(
                    {
                        "source_sha256": source["sha256"],
                        "case_index": evaluation_case["case_index"],
                    }
                )
            )
            answer_hashes = tuple(
                sorted(
                    {
                        sha256_bytes(normalize_text(anchor).encode("utf-8"))
                        for anchor in anchors
                    }
                )
            )
            answer_ngrams = tuple(
                sorted(
                    {
                        item
                        for anchor in anchors
                        for item in token_ngram_hashes(
                            anchor, profile.answer_token_ngram_size
                        )
                    }
                )
            )
            template_id = (
                f"{evaluation_case['scope']}-case-{evaluation_case['case_index']}"
            )
            indexed_cases.append(
                {
                    "case_commitment": case_commitment,
                    "source_class": "public-evaluation",
                    "split": "public-evaluation",
                    "task_family_sha256": sha256_bytes(
                        evaluation_case["scope"].encode("utf-8")
                    ),
                    "template_family_sha256": sha256_bytes(template_id.encode("utf-8")),
                    "derived_template_signature_sha256": sha256_bytes(
                        template_signature(prompt, ()).encode("utf-8")
                    ),
                    "normalized_prompt_sha256": sha256_bytes(
                        normalize_text(prompt).encode("utf-8")
                    ),
                    "character_ngram_hashes": list(
                        character_ngram_hashes(prompt, profile.character_ngram_size)
                    ),
                    "token_ngram_hashes": list(
                        token_ngram_hashes(prompt, profile.token_ngram_size)
                    ),
                    "entity_token_ngram_hashes": list(
                        entity_token_ngram_hashes(
                            prompt, (), profile.entity_token_ngram_size
                        )
                    ),
                    "exact_answer_anchor_hashes": list(answer_hashes),
                    "answer_anchor_token_hashes": _answer_anchor_token_hashes(anchors),
                    "answer_token_ngram_hashes": list(answer_ngrams),
                }
            )

    materialized.sort(key=lambda item: item["case_id"])
    indexed_cases.sort(key=lambda item: item["case_commitment"])
    holdout_payload = _json_lines_bytes(materialized)
    index_value = {
        "schema": PRIVATE_INDEX_SCHEMA,
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "factor_pack_sha256": sha256_file(factor_pack_path),
        "seed_commitment": sha256_bytes(b"tinyrustlm-holdout-seed-v1\x00" + seed),
        "normalization_algorithm": "unicode-nfkc-casefold-apostrophe-fold-punctuation-space-v1",
        "case_count": len(indexed_cases),
        "sealed_holdout_case_count": len(materialized),
        "public_evaluation_case_count": profile.evaluation_case_count,
        "evaluation_artifact_set_sha256": sha256_bytes(
            canonical_json_bytes(evaluation_artifact_identities)
        ),
        "evaluation_artifacts": evaluation_artifact_identities,
        "contamination_policy": profile.raw["contamination"],
        "cases": indexed_cases,
    }
    index_payload = _json_document_bytes(index_value)
    receipt = {
        "schema": PUBLIC_RECEIPT_SCHEMA,
        "status": "sealed",
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "control_program_sha256": control_program_sha256(),
        "factor_pack_id_sha256": sha256_bytes(pack_id.encode("utf-8")),
        "factor_pack_sha256": sha256_file(factor_pack_path),
        "custody_receipt_sha256": sha256_file(custody_receipt_path),
        "seed_commitment": index_value["seed_commitment"],
        "algorithm_id": "hmac-sha256-variant-selection-and-sha256-exclusion-index-v1",
        "case_count": len(materialized),
        "public_evaluation_case_count": profile.evaluation_case_count,
        "total_exclusion_case_count": len(indexed_cases),
        "evaluation_artifact_set_sha256": index_value["evaluation_artifact_set_sha256"],
        "split_counts": dict(sorted(split_counts.items())),
        "category_count": len(category_counts),
        "materialized_holdouts_sha256": sha256_bytes(holdout_payload),
        "exclusion_index_sha256": sha256_bytes(index_payload),
        "contains_raw_prompts": False,
        "contains_answer_anchors": False,
        "contains_seed": False,
    }
    receipt_payload = _json_document_bytes(receipt)

    output_root.mkdir()
    _write_new_atomic(output_root / PRIVATE_HOLDOUT_FILENAME, holdout_payload)
    _write_new_atomic(output_root / PRIVATE_INDEX_FILENAME, index_payload)
    _write_new_atomic(output_root / PUBLIC_RECEIPT_FILENAME, receipt_payload)
    return receipt


def _validate_index(profile: WorkingModelProfile, path: Path) -> dict[str, Any]:
    index = read_json_object(path, MAX_PRIVATE_INDEX_BYTES, "exclusion index")
    expected_keys = {
        "schema",
        "profile_id",
        "profile_sha256",
        "factor_pack_sha256",
        "seed_commitment",
        "normalization_algorithm",
        "case_count",
        "sealed_holdout_case_count",
        "public_evaluation_case_count",
        "evaluation_artifact_set_sha256",
        "evaluation_artifacts",
        "contamination_policy",
        "cases",
    }
    require_exact_keys(index, expected_keys, "exclusion index")
    if index["schema"] != PRIVATE_INDEX_SCHEMA:
        raise ValueError(f"exclusion index schema must be {PRIVATE_INDEX_SCHEMA}")
    if (
        index["profile_id"] != profile.profile_id
        or index["profile_sha256"] != profile.profile_sha256
    ):
        raise ValueError(
            "exclusion index is not bound to the exact working-model profile"
        )
    if index["contamination_policy"] != profile.raw["contamination"]:
        raise ValueError(
            "exclusion index contamination policy drifted from the profile"
        )
    if (
        index["normalization_algorithm"]
        != "unicode-nfkc-casefold-apostrophe-fold-punctuation-space-v1"
    ):
        raise ValueError("exclusion index normalization algorithm is unsupported")
    expected_case_count = profile.holdout_case_count + profile.evaluation_case_count
    cases = _require_object_list(
        index["cases"],
        "exclusion index cases",
        expected_case_count,
        expected_case_count,
    )
    if index["case_count"] != len(cases):
        raise ValueError("exclusion index case_count mismatch")
    if index["sealed_holdout_case_count"] != profile.holdout_case_count:
        raise ValueError("exclusion index sealed holdout count mismatch")
    if index["public_evaluation_case_count"] != profile.evaluation_case_count:
        raise ValueError("exclusion index public evaluation count mismatch")
    require_sha256(
        index["evaluation_artifact_set_sha256"],
        "exclusion index evaluation_artifact_set_sha256",
    )
    artifact_values = _require_object_list(
        index["evaluation_artifacts"],
        "exclusion index evaluation_artifacts",
        len(profile.evaluation_exclusions),
        len(profile.evaluation_exclusions),
    )
    expected_artifacts = [
        {
            "public_path": source["public_path"],
            "bytes": source["bytes"],
            "case_count": source["case_count"],
            "sha256": source["sha256"],
        }
        for source in profile.evaluation_exclusions
    ]
    if artifact_values != expected_artifacts:
        raise ValueError(
            "exclusion index evaluation artifacts drifted from the profile"
        )
    if index["evaluation_artifact_set_sha256"] != sha256_bytes(
        canonical_json_bytes(expected_artifacts)
    ):
        raise ValueError("exclusion index evaluation artifact set identity mismatch")
    case_keys = {
        "case_commitment",
        "source_class",
        "split",
        "task_family_sha256",
        "template_family_sha256",
        "derived_template_signature_sha256",
        "normalized_prompt_sha256",
        "character_ngram_hashes",
        "token_ngram_hashes",
        "entity_token_ngram_hashes",
        "exact_answer_anchor_hashes",
        "answer_anchor_token_hashes",
        "answer_token_ngram_hashes",
    }
    commitments: set[str] = set()
    for case_index, case in enumerate(cases):
        label = f"exclusion index cases[{case_index}]"
        require_exact_keys(case, case_keys, label)
        commitment = require_sha256(case["case_commitment"], f"{label}.case_commitment")
        if commitment in commitments:
            raise ValueError("exclusion index case commitments must be unique")
        commitments.add(commitment)
        if case["source_class"] not in {"sealed-holdout", "public-evaluation"}:
            raise ValueError(f"{label}.source_class is invalid")
        if case["split"] not in {
            "development",
            "independent-audit",
            "public-evaluation",
        }:
            raise ValueError(f"{label}.split is invalid")
        if (case["source_class"] == "public-evaluation") != (
            case["split"] == "public-evaluation"
        ):
            raise ValueError(f"{label} source class and split disagree")
        for key in (
            "task_family_sha256",
            "template_family_sha256",
            "derived_template_signature_sha256",
            "normalized_prompt_sha256",
        ):
            require_sha256(case[key], f"{label}.{key}")
        for key in (
            "character_ngram_hashes",
            "token_ngram_hashes",
            "entity_token_ngram_hashes",
            "exact_answer_anchor_hashes",
            "answer_token_ngram_hashes",
        ):
            hashes = require_string_list(case[key], f"{label}.{key}", 0, 1000000)
            if tuple(sorted(set(hashes))) != hashes:
                raise ValueError(f"{label}.{key} must be sorted and unique")
            for hash_index, hash_value in enumerate(hashes):
                require_sha256(hash_value, f"{label}.{key}[{hash_index}]")
        anchor_token_values = _require_object_list(
            case["answer_anchor_token_hashes"],
            f"{label}.answer_anchor_token_hashes",
            0,
            1000000,
        )
        normalized_anchor_tokens: list[tuple[int, str]] = []
        for anchor_index, anchor_value in enumerate(anchor_token_values):
            anchor_label = f"{label}.answer_anchor_token_hashes[{anchor_index}]"
            require_exact_keys(anchor_value, {"token_count", "sha256"}, anchor_label)
            normalized_anchor_tokens.append(
                (
                    require_integer(
                        anchor_value["token_count"],
                        f"{anchor_label}.token_count",
                        1,
                        1000000,
                    ),
                    require_sha256(anchor_value["sha256"], f"{anchor_label}.sha256"),
                )
            )
        if normalized_anchor_tokens != sorted(set(normalized_anchor_tokens)):
            raise ValueError(
                f"{label}.answer_anchor_token_hashes must be sorted and unique"
            )
    return index


def _validate_semantic_receipt(
    profile: WorkingModelProfile,
    path: Path,
    curriculum_sha256: str,
    index_sha256: str,
    record_count: int,
    exclusion_case_count: int,
) -> dict[str, Any]:
    receipt = read_json_object(path, MAX_SEMANTIC_RECEIPT_BYTES, "semantic receipt")
    require_exact_keys(receipt, SEMANTIC_RECEIPT_KEYS, "semantic receipt")
    if receipt["schema"] != SEMANTIC_RECEIPT_SCHEMA:
        raise ValueError(f"semantic receipt schema must be {SEMANTIC_RECEIPT_SCHEMA}")
    require_id(receipt["audit_id"], "semantic receipt audit_id")
    if receipt["status"] != "pass":
        raise ValueError("semantic receipt must pass")
    if receipt["curriculum_sha256"] != curriculum_sha256:
        raise ValueError("semantic receipt curriculum SHA-256 does not match")
    if receipt["exclusion_index_sha256"] != index_sha256:
        raise ValueError("semantic receipt exclusion index SHA-256 does not match")
    encoder = _require_object(receipt["encoder"], "semantic receipt encoder")
    require_exact_keys(encoder, ENCODER_KEYS, "semantic receipt encoder")
    require_string(
        encoder["repo_id"], "semantic receipt encoder.repo_id", pattern=REPO_ID_PATTERN
    )
    require_string(
        encoder["revision"],
        "semantic receipt encoder.revision",
        minimum=40,
        maximum=64,
        pattern=REVISION_PATTERN,
    )
    require_string(encoder["license_id"], "semantic receipt encoder.license_id")
    require_sha256(
        encoder["artifact_set_sha256"], "semantic receipt encoder.artifact_set_sha256"
    )
    threshold = require_number(
        receipt["cosine_threshold"], "semantic receipt cosine_threshold", 0.1, 1.0
    )
    floor = require_number(
        receipt["review_floor"], "semantic receipt review_floor", 0.0, threshold
    )
    if (
        threshold != profile.semantic_cosine_threshold
        or floor != profile.semantic_review_floor
    ):
        raise ValueError("semantic receipt thresholds drifted from the profile")
    maximum = require_number(
        receipt["maximum_similarity"], "semantic receipt maximum_similarity", -1.0, 1.0
    )
    if (
        require_integer(
            receipt["record_count"], "semantic receipt record_count", 1, 10000000
        )
        != record_count
    ):
        raise ValueError("semantic receipt record count does not match")
    if (
        require_integer(
            receipt["exclusion_case_count"],
            "semantic receipt exclusion_case_count",
            1,
            1000000,
        )
        != exclusion_case_count
    ):
        raise ValueError("semantic receipt exclusion case count does not match")
    if (
        require_integer(
            receipt["comparison_count"],
            "semantic receipt comparison_count",
            1,
            2**63 - 1,
        )
        != record_count * exclusion_case_count
    ):
        raise ValueError("semantic receipt comparison count is incomplete")
    reviewed = require_integer(
        receipt["reviewed_pair_count"],
        "semantic receipt reviewed_pair_count",
        0,
        2**63 - 1,
    )
    findings = require_integer(
        receipt["finding_count"], "semantic receipt finding_count", 0, 2**63 - 1
    )
    if findings != 0:
        raise ValueError("semantic receipt cannot pass with findings")
    if maximum >= threshold:
        raise ValueError(
            "semantic receipt maximum similarity reaches the rejection threshold"
        )
    if maximum >= floor and reviewed == 0:
        raise ValueError(
            "semantic-neighbor review is required at or above the review floor"
        )
    require_sha256(
        receipt["auditor_identity_sha256"],
        "semantic receipt auditor_identity_sha256",
    )
    if not require_bool(
        receipt["development_team_blinded"],
        "semantic receipt development_team_blinded",
    ):
        raise ValueError(
            "semantic receipt must attest that the development team was blinded"
        )
    require_sha256(receipt["transcript_sha256"], "semantic receipt transcript_sha256")
    return receipt


def _validate_record(
    record: dict[str, Any], profile: WorkingModelProfile, line_number: int
) -> tuple[str, str, str, tuple[tuple[str, str], ...], str, str, str, dict[str, str]]:
    label = f"curriculum line {line_number}"
    require_exact_keys(record, CURRICULUM_RECORD_KEYS, label)
    if record["schema"] != CURRICULUM_RECORD_SCHEMA:
        raise ValueError(f"{label} schema must be {CURRICULUM_RECORD_SCHEMA}")
    if len(canonical_json_bytes(record)) > profile.maximum_record_bytes:
        raise ValueError(f"{label} exceeds curriculum.maximum_record_bytes")
    record_id = require_id(record["record_id"], f"{label}.record_id")
    task_family = require_id(record["task_family"], f"{label}.task_family")
    category = profile.categories_by_id.get(task_family)
    if category is None:
        raise ValueError(f"{label}.task_family is not declared by the profile")
    template_family = require_id(
        record["template_family_id"], f"{label}.template_family_id"
    )
    factors = _require_object(record["scenario_factors"], f"{label}.scenario_factors")
    if set(factors) != set(category.required_factors):
        raise ValueError(
            f"{label}.scenario_factors must exactly match category required factors"
        )
    normalized_factors = {
        require_id(key, f"{label}.scenario_factors key"): require_string(
            value, f"{label}.scenario_factors.{key}"
        )
        for key, value in factors.items()
    }
    entities = _entity_pairs(record["entities"], f"{label}.entities")
    message_values = _require_object_list(
        record["messages"], f"{label}.messages", 1, 128
    )
    messages: list[tuple[str, str]] = []
    for message_index, message in enumerate(message_values):
        message_label = f"{label}.messages[{message_index}]"
        require_exact_keys(message, MESSAGE_KEYS, message_label)
        role = require_string(message["role"], f"{message_label}.role")
        if role not in {"system", "user", "assistant"}:
            raise ValueError(f"{message_label}.role is invalid")
        content = require_string(
            message["content"], f"{message_label}.content", maximum=MAX_TEXT_BYTES
        )
        messages.append((role, content))
    if not any(role == "user" for role, _ in messages) or messages[-1][0] != "user":
        raise ValueError(f"{label}.messages must end with a user turn")
    # Role order is validated separately. Exclusion comparison uses content only
    # so a role label cannot hide an otherwise exact evaluation prompt.
    prompt = "\n".join(content for _, content in messages)
    response = require_string(
        record["response"], f"{label}.response", maximum=MAX_TEXT_BYTES
    )
    disposition = require_string(record["disposition"], f"{label}.disposition")
    if disposition not in {"helpful-positive", "narrow-boundary"}:
        raise ValueError(f"{label}.disposition is invalid")

    provenance = _require_object(
        record["source_provenance"], f"{label}.source_provenance"
    )
    require_exact_keys(provenance, PROVENANCE_KEYS, f"{label}.source_provenance")
    if provenance["provenance_class"] not in profile.allowed_provenance_classes:
        raise ValueError(f"{label} provenance class is not allowed")
    if provenance["license_id"] not in profile.allowed_license_ids:
        raise ValueError(f"{label} source license is not allowed")
    require_id(provenance["source_id"], f"{label}.source_provenance.source_id")
    require_id(
        provenance["source_record_id"], f"{label}.source_provenance.source_record_id"
    )
    require_sha256(
        provenance["source_content_sha256"],
        f"{label}.source_provenance.source_content_sha256",
    )

    teacher = _require_object(
        record["teacher_generation"], f"{label}.teacher_generation"
    )
    require_exact_keys(teacher, TEACHER_KEYS, f"{label}.teacher_generation")
    require_string(
        teacher["teacher_id"],
        f"{label}.teacher_generation.teacher_id",
        pattern=REPO_ID_PATTERN,
    )
    require_string(
        teacher["teacher_revision"],
        f"{label}.teacher_generation.teacher_revision",
        minimum=40,
        maximum=64,
        pattern=REVISION_PATTERN,
    )
    require_sha256(
        teacher["sampling_profile_sha256"],
        f"{label}.teacher_generation.sampling_profile_sha256",
    )
    require_integer(teacher["seed"], f"{label}.teacher_generation.seed", 0, 2**63 - 1)
    require_sha256(
        teacher["raw_output_sha256"], f"{label}.teacher_generation.raw_output_sha256"
    )
    if require_bool(
        teacher["hidden_reasoning_included"],
        f"{label}.teacher_generation.hidden_reasoning_included",
    ):
        raise ValueError(f"{label} must not include hidden teacher reasoning")

    review = _require_object(record["review"], f"{label}.review")
    require_exact_keys(review, REVIEW_KEYS, f"{label}.review")
    if review["decision"] != "accept":
        raise ValueError(f"{label} review decision must be accept")
    if (
        require_sha256(review["rubric_sha256"], f"{label}.review.rubric_sha256")
        != profile.review_rubric_sha256
    ):
        raise ValueError(f"{label}.review.rubric_sha256 drifted from the profile")
    if review["factual_verification"] not in {"verified", "not-applicable"}:
        raise ValueError(f"{label}.review.factual_verification is invalid")
    reviewer_count = require_integer(
        review["reviewer_count"], f"{label}.review.reviewer_count", 2, 3
    )
    if review["disagreement_status"] not in {"none", "adjudicated"}:
        raise ValueError(f"{label}.review.disagreement_status is invalid")
    if (reviewer_count, review["disagreement_status"]) not in {
        (2, "none"),
        (3, "adjudicated"),
    }:
        raise ValueError(f"{label}.review reviewer count and disagreement drifted")
    require_sha256(review["decision_sha256"], f"{label}.review.decision_sha256")
    for scan_key in (
        "pii_scan_status",
        "license_review_status",
        "malicious_artifact_scan_status",
    ):
        if review[scan_key] != "pass":
            raise ValueError(f"{label}.review.{scan_key} must pass")
    return (
        record_id,
        task_family,
        template_family,
        entities,
        prompt,
        response,
        disposition,
        normalized_factors,
    )


def curriculum_candidate_projection(record: Mapping[str, Any]) -> dict[str, Any]:
    """Return the immutable review candidate without its derived review summary."""
    if set(record) != CURRICULUM_RECORD_KEYS:
        raise ValueError("curriculum record keys must be exact before projection")
    return {key: record[key] for key in sorted(CURRICULUM_RECORD_KEYS - {"review"})}


def _review_candidate_identities(record: Mapping[str, Any]) -> dict[str, str]:
    return {
        "candidate_sha256": sha256_bytes(
            canonical_json_bytes(curriculum_candidate_projection(record))
        ),
        "messages_sha256": sha256_bytes(canonical_json_bytes(record["messages"])),
        "response_sha256": sha256_bytes(
            require_string(
                record["response"], "review candidate response", maximum=MAX_TEXT_BYTES
            ).encode("utf-8")
        ),
    }


def _validate_review_checklist(
    profile: WorkingModelProfile, value: Any, label: str
) -> tuple[tuple[str, str], ...]:
    items = _require_object_list(
        value, label, len(profile.review_checklist), len(profile.review_checklist)
    )
    result: list[tuple[str, str]] = []
    for index, (item, expected) in enumerate(zip(items, profile.review_checklist)):
        item_label = f"{label}[{index}]"
        require_exact_keys(item, REVIEW_CHECKLIST_ITEM_KEYS, item_label)
        check_id = require_id(item["id"], f"{item_label}.id")
        status = require_string(item["status"], f"{item_label}.status")
        expected_id, applicability = expected
        if check_id != expected_id:
            raise ValueError(f"{label} order or ids drifted from the rubric")
        if status not in {"pass", "fail", "not-applicable"}:
            raise ValueError(f"{item_label}.status is invalid")
        if applicability == "always" and status == "not-applicable":
            raise ValueError(f"{item_label} is always applicable")
        result.append((check_id, status))
    return tuple(result)


def _validate_review_assessment(
    profile: WorkingModelProfile, value: Mapping[str, Any], label: str
) -> dict[str, Any]:
    decision = require_string(value["decision"], f"{label}.decision")
    if decision not in {"accept", "reject"}:
        raise ValueError(f"{label}.decision is invalid")
    factual = require_string(
        value["factual_verification"], f"{label}.factual_verification"
    )
    if factual not in {"verified", "not-applicable", "failed"}:
        raise ValueError(f"{label}.factual_verification is invalid")
    checklist = _validate_review_checklist(
        profile, value["checklist"], f"{label}.checklist"
    )
    scan_values: dict[str, str] = {}
    for scan_key in (
        "pii_scan_status",
        "license_review_status",
        "malicious_artifact_scan_status",
    ):
        scan = require_string(value[scan_key], f"{label}.{scan_key}")
        if scan not in {"pass", "fail"}:
            raise ValueError(f"{label}.{scan_key} is invalid")
        scan_values[scan_key] = scan
    require_sha256(value["comment_sha256"], f"{label}.comment_sha256")

    checklist_failures = {
        check_id for check_id, status in checklist if status == "fail"
    }
    always_statuses = dict(checklist)
    failed = (
        factual == "failed"
        or bool(checklist_failures)
        or any(scan == "fail" for scan in scan_values.values())
    )
    if decision == "accept":
        if failed:
            raise ValueError(f"{label} cannot accept a failed assessment")
        if any(
            always_statuses[check_id] != "pass"
            for check_id in profile.review_always_pass
        ):
            raise ValueError(f"{label} must pass every always-required rubric check")
    elif not failed:
        raise ValueError(f"{label} rejection must identify at least one failed control")
    return {
        "decision": decision,
        "factual_verification": factual,
        "checklist": checklist,
        **scan_values,
    }


def _validate_primary_review_decision(
    profile: WorkingModelProfile,
    value: dict[str, Any],
    label: str,
    *,
    review_id: str,
    record_id: str,
    candidate_identities: Mapping[str, str],
    reviewer_identity_sha256: str,
    custody_domain_sha256: str,
) -> dict[str, Any]:
    require_exact_keys(value, REVIEW_DECISION_KEYS, label)
    if value["schema"] != CURRICULUM_REVIEW_DECISION_SCHEMA:
        raise ValueError(f"{label}.schema must be {CURRICULUM_REVIEW_DECISION_SCHEMA}")
    if value["review_id"] != review_id:
        raise ValueError(f"{label}.review_id does not match the manifest")
    if require_id(value["record_id"], f"{label}.record_id") != record_id:
        raise ValueError(f"{label}.record_id does not match the curriculum order")
    for key, expected in candidate_identities.items():
        if require_sha256(value[key], f"{label}.{key}") != expected:
            raise ValueError(f"{label}.{key} does not match the immutable candidate")
    if (
        require_sha256(value["rubric_sha256"], f"{label}.rubric_sha256")
        != profile.review_rubric_sha256
    ):
        raise ValueError(f"{label}.rubric_sha256 drifted from the profile")
    if (
        require_sha256(
            value["reviewer_identity_sha256"], f"{label}.reviewer_identity_sha256"
        )
        != reviewer_identity_sha256
    ):
        raise ValueError(f"{label} reviewer identity does not match its ledger")
    if (
        require_sha256(value["custody_domain_sha256"], f"{label}.custody_domain_sha256")
        != custody_domain_sha256
    ):
        raise ValueError(f"{label} custody domain does not match its ledger")
    assessment = _validate_review_assessment(profile, value, label)
    return {**assessment, "sha256": sha256_bytes(canonical_json_bytes(value))}


def _validate_review_adjudication(
    profile: WorkingModelProfile,
    value: dict[str, Any],
    label: str,
    *,
    review_id: str,
    record_id: str,
    candidate_identities: Mapping[str, str],
    primary_decision_sha256s: Sequence[str],
    adjudicator_identity_sha256: str,
    custody_domain_sha256: str,
) -> dict[str, Any]:
    require_exact_keys(value, REVIEW_ADJUDICATION_KEYS, label)
    if value["schema"] != CURRICULUM_REVIEW_ADJUDICATION_SCHEMA:
        raise ValueError(
            f"{label}.schema must be {CURRICULUM_REVIEW_ADJUDICATION_SCHEMA}"
        )
    if value["review_id"] != review_id:
        raise ValueError(f"{label}.review_id does not match the manifest")
    if require_id(value["record_id"], f"{label}.record_id") != record_id:
        raise ValueError(f"{label}.record_id does not match the disagreement order")
    for key, expected in candidate_identities.items():
        if require_sha256(value[key], f"{label}.{key}") != expected:
            raise ValueError(f"{label}.{key} does not match the immutable candidate")
    if (
        require_sha256(value["rubric_sha256"], f"{label}.rubric_sha256")
        != profile.review_rubric_sha256
    ):
        raise ValueError(f"{label}.rubric_sha256 drifted from the profile")
    primary_hashes = require_string_list(
        value["primary_decision_sha256s"],
        f"{label}.primary_decision_sha256s",
        2,
        2,
    )
    for index, digest in enumerate(primary_hashes):
        require_sha256(digest, f"{label}.primary_decision_sha256s[{index}]")
    if primary_hashes != tuple(primary_decision_sha256s):
        raise ValueError(f"{label} primary decision identities do not match")
    if (
        require_sha256(
            value["adjudicator_identity_sha256"],
            f"{label}.adjudicator_identity_sha256",
        )
        != adjudicator_identity_sha256
    ):
        raise ValueError(f"{label} adjudicator identity does not match its ledger")
    if (
        require_sha256(value["custody_domain_sha256"], f"{label}.custody_domain_sha256")
        != custody_domain_sha256
    ):
        raise ValueError(f"{label} custody domain does not match its ledger")
    require_id(value["reason_code"], f"{label}.reason_code")
    assessment = _validate_review_assessment(profile, value, label)
    return {**assessment, "sha256": sha256_bytes(canonical_json_bytes(value))}


def _derived_review_summary(
    profile: WorkingModelProfile,
    review_id: str,
    record_id: str,
    candidate_sha256: str,
    primary_decisions: Sequence[Mapping[str, Any]],
    adjudication: Mapping[str, Any] | None,
) -> dict[str, Any]:
    primary_hashes = [decision["sha256"] for decision in primary_decisions]
    final_assessments = (
        list(primary_decisions) if adjudication is None else [adjudication]
    )
    factual = (
        "verified"
        if any(item["factual_verification"] == "verified" for item in final_assessments)
        else "not-applicable"
    )
    closure = {
        "schema": CURRICULUM_REVIEW_CLOSURE_SCHEMA,
        "review_id": review_id,
        "record_id": record_id,
        "candidate_sha256": candidate_sha256,
        "rubric_sha256": profile.review_rubric_sha256,
        "primary_decision_sha256s": primary_hashes,
        "adjudication_sha256": adjudication["sha256"] if adjudication else None,
        "final_decision": "accept",
    }
    return {
        "decision": "accept",
        "rubric_sha256": profile.review_rubric_sha256,
        "factual_verification": factual,
        "reviewer_count": 3 if adjudication else 2,
        "disagreement_status": "adjudicated" if adjudication else "none",
        "decision_sha256": sha256_bytes(canonical_json_bytes(closure)),
        "pii_scan_status": "pass",
        "license_review_status": "pass",
        "malicious_artifact_scan_status": "pass",
    }


def _resolve_review_ledger_descriptor(
    value: Any,
    label: str,
    *,
    expected_keys: set[str],
    actor_key: str,
) -> tuple[Path, dict[str, Any], str, str]:
    descriptor = _require_object(value, label)
    require_exact_keys(descriptor, expected_keys, label)
    actor_sha256 = require_sha256(descriptor[actor_key], f"{label}.{actor_key}")
    custody_sha256 = require_sha256(
        descriptor["custody_domain_sha256"], f"{label}.custody_domain_sha256"
    )
    path, identity = _resolve_identity(
        {key: descriptor[key] for key in FILE_IDENTITY_KEYS}, label
    )
    _require_external_evidence_location(path, label)
    if identity["bytes"] > MAX_REVIEW_LEDGER_BYTES:
        raise ValueError(f"{label} exceeds the review-ledger byte bound")
    return path, identity, actor_sha256, custody_sha256


def _validate_review_evidence(
    profile: WorkingModelProfile,
    curriculum_path: Path,
    review_manifest_path: Path,
) -> dict[str, Any]:
    _require_external_evidence_location(review_manifest_path, "review manifest")
    curriculum_sha256 = sha256_file(curriculum_path)
    manifest = read_json_object(
        review_manifest_path, MAX_REVIEW_MANIFEST_BYTES, "review manifest"
    )
    require_exact_keys(manifest, REVIEW_MANIFEST_KEYS, "review manifest")
    if manifest["schema"] != CURRICULUM_REVIEW_MANIFEST_SCHEMA:
        raise ValueError(
            f"review manifest schema must be {CURRICULUM_REVIEW_MANIFEST_SCHEMA}"
        )
    if manifest["status"] != "complete":
        raise ValueError("review manifest status must be complete")
    review_id = require_id(manifest["review_id"], "review manifest review_id")
    if (
        manifest["profile_id"] != profile.profile_id
        or manifest["profile_sha256"] != profile.profile_sha256
    ):
        raise ValueError("review manifest is not bound to the exact profile")
    if (
        require_sha256(
            manifest["control_program_sha256"],
            "review manifest control_program_sha256",
        )
        != control_program_sha256()
    ):
        raise ValueError("review manifest control program identity does not match")
    if manifest["curriculum_sha256"] != curriculum_sha256:
        raise ValueError("review manifest curriculum SHA-256 does not match")
    if manifest["rubric_sha256"] != profile.review_rubric_sha256:
        raise ValueError("review manifest rubric SHA-256 drifted from the profile")
    if manifest["candidate_projection"] != "curriculum-record-without-review-v1":
        raise ValueError("review manifest candidate projection drifted")
    record_count = require_integer(
        manifest["record_count"], "review manifest record_count", 1, 10000000
    )
    require_sha256(
        manifest["record_order_sha256"], "review manifest record_order_sha256"
    )
    if require_bool(
        manifest["contains_raw_curriculum"], "review manifest contains_raw_curriculum"
    ):
        raise ValueError("review manifest must not contain raw curriculum")
    if require_bool(
        manifest["training_authority"], "review manifest training_authority"
    ):
        raise ValueError("review manifest must not grant training authority")

    primary_values = _require_object_list(
        manifest["primary_reviewer_ledgers"],
        "review manifest primary_reviewer_ledgers",
        2,
        2,
    )
    primary_ledgers = [
        _resolve_review_ledger_descriptor(
            value,
            f"review manifest primary_reviewer_ledgers[{index}]",
            expected_keys=PRIMARY_REVIEW_LEDGER_IDENTITY_KEYS,
            actor_key="reviewer_identity_sha256",
        )
        for index, value in enumerate(primary_values)
    ]
    if len({item[2] for item in primary_ledgers}) != 2:
        raise ValueError("primary reviewer identities must be distinct")
    if len({item[3] for item in primary_ledgers}) != 2:
        raise ValueError("primary reviewer custody domains must be distinct")
    if len({item[0] for item in primary_ledgers}) != 2:
        raise ValueError("primary review ledgers must be separate files")
    if len({item[1]["sha256"] for item in primary_ledgers}) != 2:
        raise ValueError("primary review ledger bytes must be distinct")

    adjudication_descriptor = manifest["adjudication_ledger"]
    adjudication_ledger: tuple[Path, dict[str, Any], str, str] | None = None
    if adjudication_descriptor is not None:
        adjudication_ledger = _resolve_review_ledger_descriptor(
            adjudication_descriptor,
            "review manifest adjudication_ledger",
            expected_keys=ADJUDICATION_LEDGER_IDENTITY_KEYS,
            actor_key="adjudicator_identity_sha256",
        )
        if adjudication_ledger[2] in {item[2] for item in primary_ledgers}:
            raise ValueError(
                "adjudicator identity must be distinct from both reviewers"
            )
        if adjudication_ledger[3] in {item[3] for item in primary_ledgers}:
            raise ValueError("adjudicator custody must be distinct from both reviewers")
        if adjudication_ledger[0] in {item[0] for item in primary_ledgers}:
            raise ValueError("adjudication must use a separate ledger file")

    sentinel = object()
    curriculum_records = iter_json_lines(
        curriculum_path, MAX_CURRICULUM_BYTES, "curriculum"
    )
    primary_records = [
        iter_json_lines(
            item[0], MAX_REVIEW_LEDGER_BYTES, f"primary review ledger {index + 1}"
        )
        for index, item in enumerate(primary_ledgers)
    ]
    record_ids: list[str] = []
    unique_record_ids: set[str] = set()
    disagreements: list[dict[str, Any]] = []
    for line_number, values in enumerate(
        zip_longest(curriculum_records, *primary_records, fillvalue=sentinel), 1
    ):
        if any(value is sentinel for value in values):
            raise ValueError("primary review ledgers must exactly cover the curriculum")
        record = values[0]
        assert isinstance(record, dict)
        validated = _validate_record(record, profile, line_number)
        current_record_id = validated[0]
        if current_record_id in unique_record_ids:
            raise ValueError("curriculum record ids must be unique")
        record_ids.append(current_record_id)
        unique_record_ids.add(current_record_id)
        candidate_identities = _review_candidate_identities(record)
        decisions = [
            _validate_primary_review_decision(
                profile,
                values[index + 1],
                f"primary review ledger {index + 1} line {line_number}",
                review_id=review_id,
                record_id=current_record_id,
                candidate_identities=candidate_identities,
                reviewer_identity_sha256=primary_ledgers[index][2],
                custody_domain_sha256=primary_ledgers[index][3],
            )
            for index in range(2)
        ]
        decision_values = {decision["decision"] for decision in decisions}
        if len(decision_values) == 1:
            if decision_values != {"accept"}:
                raise ValueError(
                    f"curriculum record {current_record_id} was rejected by both reviewers"
                )
            expected_review = _derived_review_summary(
                profile,
                review_id,
                current_record_id,
                candidate_identities["candidate_sha256"],
                decisions,
                None,
            )
            if record["review"] != expected_review:
                raise ValueError(
                    f"curriculum record {current_record_id} review summary is not derived"
                )
        else:
            disagreements.append(
                {
                    "record_id": current_record_id,
                    "candidate_identities": candidate_identities,
                    "primary_decisions": decisions,
                    "review_summary": record["review"],
                }
            )

    if len(record_ids) != record_count:
        raise ValueError("review manifest record count does not match the curriculum")
    record_order_sha256 = sha256_bytes(canonical_json_bytes(record_ids))
    if manifest["record_order_sha256"] != record_order_sha256:
        raise ValueError("review manifest record order SHA-256 does not match")

    adjudicated_count = 0
    if disagreements:
        if adjudication_ledger is None:
            raise ValueError(
                "review disagreements require a third-party adjudication ledger"
            )
        adjudication_records = iter_json_lines(
            adjudication_ledger[0], MAX_REVIEW_LEDGER_BYTES, "adjudication ledger"
        )
        for index, values in enumerate(
            zip_longest(disagreements, adjudication_records, fillvalue=sentinel), 1
        ):
            if any(value is sentinel for value in values):
                raise ValueError(
                    "adjudication ledger must exactly cover primary-review disagreements"
                )
            disagreement, raw_adjudication = values
            assert isinstance(disagreement, dict) and isinstance(raw_adjudication, dict)
            primary_decision_sha256s = [
                decision["sha256"] for decision in disagreement["primary_decisions"]
            ]
            adjudication = _validate_review_adjudication(
                profile,
                raw_adjudication,
                f"adjudication ledger line {index}",
                review_id=review_id,
                record_id=disagreement["record_id"],
                candidate_identities=disagreement["candidate_identities"],
                primary_decision_sha256s=primary_decision_sha256s,
                adjudicator_identity_sha256=adjudication_ledger[2],
                custody_domain_sha256=adjudication_ledger[3],
            )
            if adjudication["decision"] != "accept":
                raise ValueError(
                    f"curriculum record {disagreement['record_id']} was rejected by adjudication"
                )
            expected_review = _derived_review_summary(
                profile,
                review_id,
                disagreement["record_id"],
                disagreement["candidate_identities"]["candidate_sha256"],
                disagreement["primary_decisions"],
                adjudication,
            )
            if disagreement["review_summary"] != expected_review:
                raise ValueError(
                    f"curriculum record {disagreement['record_id']} adjudicated summary is not derived"
                )
            adjudicated_count += 1
    elif adjudication_ledger is not None:
        raise ValueError(
            "adjudication ledger is forbidden when primary reviewers agree"
        )

    return {
        "review_id": review_id,
        "manifest_sha256": sha256_file(review_manifest_path),
        "control_program_sha256": manifest["control_program_sha256"],
        "rubric_sha256": profile.review_rubric_sha256,
        "record_count": record_count,
        "record_order_sha256": record_order_sha256,
        "primary_ledger_sha256s": [item[1]["sha256"] for item in primary_ledgers],
        "adjudication_ledger_sha256": (
            adjudication_ledger[1]["sha256"] if adjudication_ledger else None
        ),
        "adjudicated_record_count": adjudicated_count,
    }


def _build_exclusion_lookups(cases: Sequence[dict[str, Any]]) -> dict[str, Any]:
    scalar_fields = (
        "normalized_prompt_sha256",
        "template_family_sha256",
        "derived_template_signature_sha256",
        "exact_answer_anchor_hashes",
    )
    ngram_fields = (
        "character_ngram_hashes",
        "token_ngram_hashes",
        "entity_token_ngram_hashes",
        "answer_token_ngram_hashes",
    )
    scalar: dict[str, dict[str, list[int]]] = {
        field: defaultdict(list) for field in scalar_fields
    }
    inverted: dict[str, dict[str, list[int]]] = {
        field: defaultdict(list) for field in ngram_fields
    }
    sizes: dict[str, list[int]] = {field: [] for field in ngram_fields}
    anchor_terms: dict[int, dict[str, list[int]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for case_index, case in enumerate(cases):
        for field in scalar_fields:
            values = case[field] if isinstance(case[field], list) else [case[field]]
            for value in values:
                scalar[field][value].append(case_index)
        for field in ngram_fields:
            values = case[field]
            sizes[field].append(len(values))
            for value in values:
                inverted[field][value].append(case_index)
        for anchor in case["answer_anchor_token_hashes"]:
            anchor_terms[anchor["token_count"]][anchor["sha256"]].append(case_index)
    return {
        "scalar": scalar,
        "inverted": inverted,
        "sizes": sizes,
        "anchor_terms": anchor_terms,
        "anchor_lengths": tuple(sorted(anchor_terms)),
    }


def _overlap_case_indices(
    record_hashes: Sequence[str],
    field: str,
    threshold: float,
    lookups: Mapping[str, Any],
) -> tuple[int, ...]:
    unique_record_hashes = set(record_hashes)
    if not unique_record_hashes:
        return ()
    counts: Counter[int] = Counter()
    inverted = lookups["inverted"][field]
    for digest in unique_record_hashes:
        counts.update(inverted.get(digest, ()))
    sizes = lookups["sizes"][field]
    return tuple(
        sorted(
            case_index
            for case_index, overlap in counts.items()
            if overlap / min(len(unique_record_hashes), sizes[case_index]) >= threshold
        )
    )


def _finding(
    kind: str, record_id: str, case_commitment: str | None = None
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "kind": kind,
        "record_id_sha256": sha256_bytes(record_id.encode("utf-8")),
    }
    if case_commitment is not None:
        value["case_commitment"] = case_commitment
    value["finding_id"] = sha256_bytes(canonical_json_bytes(value))
    return value


class FindingAccumulator:
    def __init__(self) -> None:
        self.items: list[dict[str, Any]] = []
        self.total = 0
        self.kind_counts: Counter[str] = Counter()

    def add(self, finding: dict[str, Any]) -> None:
        self.total += 1
        self.kind_counts[finding["kind"]] += 1
        if len(self.items) < MAX_REPORTED_FINDINGS:
            self.items.append(finding)


def _load_tombstones(path: Path | None) -> tuple[dict[str, Any], ...]:
    if path is None:
        return ()
    records = read_json_lines(path, MAX_TOMBSTONE_BYTES, "tombstone lineage")
    result: list[dict[str, Any]] = []
    ids: set[str] = set()
    for index, record in enumerate(records):
        label = f"tombstone lineage line {index + 1}"
        require_exact_keys(record, TOMBSTONE_KEYS, label)
        if record["schema"] != TOMBSTONE_SCHEMA:
            raise ValueError(f"{label} schema must be {TOMBSTONE_SCHEMA}")
        tombstone_id = require_id(record["tombstone_id"], f"{label}.tombstone_id")
        if tombstone_id in ids:
            raise ValueError("tombstone ids must be unique")
        ids.add(tombstone_id)
        require_id(record["record_id"], f"{label}.record_id")
        require_sha256(record["record_sha256"], f"{label}.record_sha256")
        require_id(record["reason_code"], f"{label}.reason_code")
        require_sha256(record["decision_sha256"], f"{label}.decision_sha256")
        result.append(record)
    return tuple(result)


def audit_curriculum(
    profile: WorkingModelProfile,
    curriculum_path: Path,
    review_manifest_path: Path,
    exclusion_index_path: Path,
    semantic_receipt_path: Path,
    tombstone_path: Path | None,
    output_path: Path,
) -> dict[str, Any]:
    record_count = sum(
        1 for _ in iter_json_lines(curriculum_path, MAX_CURRICULUM_BYTES, "curriculum")
    )
    index = _validate_index(profile, exclusion_index_path)
    curriculum_sha256 = sha256_file(curriculum_path)
    review_evidence = _validate_review_evidence(
        profile, curriculum_path, review_manifest_path
    )
    if review_evidence["record_count"] != record_count:
        raise ValueError("review evidence record count does not match the curriculum")
    index_sha256 = sha256_file(exclusion_index_path)
    semantic_receipt = _validate_semantic_receipt(
        profile,
        semantic_receipt_path,
        curriculum_sha256,
        index_sha256,
        record_count,
        len(index["cases"]),
    )
    tombstones = _load_tombstones(tombstone_path)
    tombstones_by_record = {record["record_id"]: record for record in tombstones}

    findings = FindingAccumulator()
    record_ids: set[str] = set()
    normalized_prompt_hashes: set[str] = set()
    category_counts: Counter[str] = Counter()
    disposition_counts: Counter[str] = Counter()
    factor_values: dict[tuple[str, str], set[str]] = defaultdict(set)
    cases = index["cases"]
    lookups = _build_exclusion_lookups(cases)
    for line_number, record in enumerate(
        iter_json_lines(curriculum_path, MAX_CURRICULUM_BYTES, "curriculum"), 1
    ):
        (
            record_id,
            task_family,
            template_family,
            entities,
            prompt,
            response,
            disposition,
            factors,
        ) = _validate_record(record, profile, line_number)
        if record_id in record_ids:
            raise ValueError("curriculum record ids must be unique")
        record_ids.add(record_id)
        record_sha256 = sha256_bytes(canonical_json_bytes(record))
        tombstone = tombstones_by_record.get(record_id)
        if tombstone is not None and tombstone["record_sha256"] == record_sha256:
            findings.add(_finding("active-tombstone", record_id))
        normalized_prompt_sha256 = sha256_bytes(normalize_text(prompt).encode("utf-8"))
        if normalized_prompt_sha256 in normalized_prompt_hashes:
            findings.add(_finding("duplicate-normalized-curriculum-prompt", record_id))
        normalized_prompt_hashes.add(normalized_prompt_sha256)
        template_hash = sha256_bytes(template_family.encode("utf-8"))
        derived_template_hash = sha256_bytes(
            template_signature(prompt, entities).encode("utf-8")
        )
        character_hashes = character_ngram_hashes(prompt, profile.character_ngram_size)
        token_hashes = token_ngram_hashes(prompt, profile.token_ngram_size)
        entity_hashes = entity_token_ngram_hashes(
            prompt, entities, profile.entity_token_ngram_size
        )
        response_exact_hash = sha256_bytes(normalize_text(response).encode("utf-8"))
        response_ngram_hashes = token_ngram_hashes(
            response, profile.answer_token_ngram_size
        )
        scalar_checks = (
            (
                "exact-normalized-prompt",
                "normalized_prompt_sha256",
                normalized_prompt_sha256,
            ),
            ("template-family", "template_family_sha256", template_hash),
            (
                "derived-template-signature",
                "derived_template_signature_sha256",
                derived_template_hash,
            ),
            (
                "exact-answer-anchor",
                "exact_answer_anchor_hashes",
                response_exact_hash,
            ),
        )
        for finding_kind, field, digest in scalar_checks:
            for case_index in lookups["scalar"][field].get(digest, ()):
                findings.add(
                    _finding(
                        finding_kind,
                        record_id,
                        cases[case_index]["case_commitment"],
                    )
                )
        overlap_checks = (
            (
                "character-ngram",
                "character_ngram_hashes",
                character_hashes,
                profile.character_containment_threshold,
            ),
            (
                "token-ngram",
                "token_ngram_hashes",
                token_hashes,
                profile.token_containment_threshold,
            ),
            (
                "entity-substituted-token-ngram",
                "entity_token_ngram_hashes",
                entity_hashes,
                profile.entity_containment_threshold,
            ),
            (
                "answer-token-ngram",
                "answer_token_ngram_hashes",
                response_ngram_hashes,
                profile.answer_containment_threshold,
            ),
        )
        for finding_kind, field, digests, threshold in overlap_checks:
            for case_index in _overlap_case_indices(digests, field, threshold, lookups):
                findings.add(
                    _finding(
                        finding_kind,
                        record_id,
                        cases[case_index]["case_commitment"],
                    )
                )
        response_tokens = tokenize_normalized(response)
        anchor_term_case_indices: set[int] = set()
        for token_count in lookups["anchor_lengths"]:
            for window in _windows(response_tokens, token_count):
                digest = sha256_bytes(window.encode("utf-8"))
                anchor_term_case_indices.update(
                    lookups["anchor_terms"][token_count].get(digest, ())
                )
        for case_index in sorted(anchor_term_case_indices):
            findings.add(
                _finding(
                    "answer-anchor-term",
                    record_id,
                    cases[case_index]["case_commitment"],
                )
            )
        category_counts[task_family] += 1
        disposition_counts[disposition] += 1
        for factor, factor_value in factors.items():
            factor_values[(task_family, factor)].add(factor_value)

    if record_count != profile.pilot_record_count:
        findings.add(_finding("pilot-record-count", profile.profile_id))
    for category in profile.categories:
        if category_counts[category.category_id] != category.pilot_count:
            findings.add(_finding("category-count", category.category_id))
        for factor in category.required_factors:
            if (
                len(factor_values[(category.category_id, factor)])
                < category.minimum_distinct_values_per_factor
            ):
                findings.add(
                    _finding("factor-diversity", f"{category.category_id}.{factor}")
                )
    helpful_rate = disposition_counts["helpful-positive"] / record_count
    boundary_rate = disposition_counts["narrow-boundary"] / record_count
    if helpful_rate < profile.minimum_helpful_positive_rate:
        findings.add(_finding("helpful-positive-rate", profile.profile_id))
    if boundary_rate > profile.maximum_narrow_boundary_rate:
        findings.add(_finding("narrow-boundary-rate", profile.profile_id))

    findings.items.sort(key=lambda finding: finding["finding_id"])
    finding_kinds = sorted(findings.kind_counts)
    report = {
        "schema": CURRICULUM_AUDIT_SCHEMA,
        "status": "pass" if findings.total == 0 else "fail",
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "curriculum_sha256": curriculum_sha256,
        "review_manifest_sha256": review_evidence["manifest_sha256"],
        "control_program_sha256": review_evidence["control_program_sha256"],
        "review_id": review_evidence["review_id"],
        "review_rubric_sha256": review_evidence["rubric_sha256"],
        "review_record_order_sha256": review_evidence["record_order_sha256"],
        "primary_review_ledger_sha256s": review_evidence["primary_ledger_sha256s"],
        "adjudication_ledger_sha256": review_evidence["adjudication_ledger_sha256"],
        "adjudicated_record_count": review_evidence["adjudicated_record_count"],
        "exclusion_index_sha256": index_sha256,
        "semantic_receipt_sha256": sha256_file(semantic_receipt_path),
        "tombstone_lineage_sha256": sha256_file(tombstone_path)
        if tombstone_path
        else None,
        "record_count": record_count,
        "category_counts": dict(sorted(category_counts.items())),
        "disposition_counts": dict(sorted(disposition_counts.items())),
        "helpful_positive_rate": helpful_rate,
        "narrow_boundary_rate": boundary_rate,
        "semantic_encoder_artifact_set_sha256": semantic_receipt["encoder"][
            "artifact_set_sha256"
        ],
        "semantic_maximum_similarity": semantic_receipt["maximum_similarity"],
        "finding_count": findings.total,
        "reported_finding_count": len(findings.items),
        "omitted_finding_count": findings.total - len(findings.items),
        "finding_kinds": finding_kinds,
        "finding_kind_counts": dict(sorted(findings.kind_counts.items())),
        "findings": findings.items,
        "contains_raw_curriculum": False,
        "contains_raw_holdouts": False,
    }
    _write_new_atomic(output_path, _json_document_bytes(report))
    return report


def _resolve_identity(value: Any, label: str) -> tuple[Path, dict[str, Any]]:
    identity = _require_object(value, label)
    require_exact_keys(identity, FILE_IDENTITY_KEYS, label)
    path = Path(require_string(identity["path"], f"{label}.path", maximum=32768))
    if not path.is_absolute():
        raise ValueError(f"{label}.path must be absolute")
    _require_allowed_storage_drive(path, f"{label}.path")
    expected_bytes = require_integer(
        identity["bytes"], f"{label}.bytes", 1, MAX_IDENTITY_FILE_BYTES
    )
    expected_sha256 = require_sha256(identity["sha256"], f"{label}.sha256")
    actual_bytes = verify_regular_file(path, MAX_IDENTITY_FILE_BYTES, label)
    if actual_bytes != expected_bytes:
        raise ValueError(f"{label} byte length does not match")
    if sha256_file(path) != expected_sha256:
        raise ValueError(f"{label} SHA-256 does not match")
    return path.resolve(), {"bytes": actual_bytes, "sha256": expected_sha256}


def _validate_public_holdout_receipt(
    profile: WorkingModelProfile, path: Path, expected_index_sha256: str
) -> dict[str, Any]:
    receipt = read_json_object(path, MAX_SEMANTIC_RECEIPT_BYTES, "holdout receipt")
    expected_keys = {
        "schema",
        "status",
        "profile_id",
        "profile_sha256",
        "control_program_sha256",
        "factor_pack_id_sha256",
        "factor_pack_sha256",
        "custody_receipt_sha256",
        "seed_commitment",
        "algorithm_id",
        "case_count",
        "public_evaluation_case_count",
        "total_exclusion_case_count",
        "evaluation_artifact_set_sha256",
        "split_counts",
        "category_count",
        "materialized_holdouts_sha256",
        "exclusion_index_sha256",
        "contains_raw_prompts",
        "contains_answer_anchors",
        "contains_seed",
    }
    require_exact_keys(receipt, expected_keys, "holdout receipt")
    if receipt["schema"] != PUBLIC_RECEIPT_SCHEMA or receipt["status"] != "sealed":
        raise ValueError("holdout receipt must be a sealed v1 receipt")
    if (
        receipt["profile_id"] != profile.profile_id
        or receipt["profile_sha256"] != profile.profile_sha256
    ):
        raise ValueError("holdout receipt is not bound to the exact profile")
    if receipt["exclusion_index_sha256"] != expected_index_sha256:
        raise ValueError("holdout receipt exclusion index identity does not match")
    require_sha256(
        receipt["control_program_sha256"],
        "holdout receipt control_program_sha256",
    )
    if receipt["case_count"] != profile.holdout_case_count:
        raise ValueError("holdout receipt case count drifted")
    if receipt["public_evaluation_case_count"] != profile.evaluation_case_count:
        raise ValueError("holdout receipt public evaluation case count drifted")
    if receipt["total_exclusion_case_count"] != (
        profile.holdout_case_count + profile.evaluation_case_count
    ):
        raise ValueError("holdout receipt total exclusion case count drifted")
    require_sha256(
        receipt["evaluation_artifact_set_sha256"],
        "holdout receipt evaluation_artifact_set_sha256",
    )
    require_sha256(
        receipt["custody_receipt_sha256"],
        "holdout receipt custody_receipt_sha256",
    )
    if any(
        receipt[key] is not False
        for key in ("contains_raw_prompts", "contains_answer_anchors", "contains_seed")
    ):
        raise ValueError("public holdout receipt claims private material")
    return receipt


def freeze_training_lock(
    profile: WorkingModelProfile, request_path: Path, output_path: Path
) -> dict[str, Any]:
    request = read_json_object(
        request_path, MAX_TRAINING_REQUEST_BYTES, "training lock request"
    )
    require_exact_keys(request, TRAINING_REQUEST_KEYS, "training lock request")
    if request["schema"] != TRAINING_LOCK_REQUEST_SCHEMA:
        raise ValueError(
            f"training lock request schema must be {TRAINING_LOCK_REQUEST_SCHEMA}"
        )
    lock_id = require_id(request["lock_id"], "training lock request lock_id")
    if request["training"] != profile.raw["training"]:
        raise ValueError(
            "training lock request training configuration drifted from the profile"
        )
    if request["stop_rules"] != profile.raw["stop_rules"]:
        raise ValueError("training lock request stop rules drifted from the profile")
    _validate_training(request["training"])
    _validate_stop_rules(request["stop_rules"])

    source_root = Path(
        require_string(
            request["source_root"], "training lock request source_root", maximum=32768
        )
    )
    _require_allowed_storage_drive(source_root, "training lock request source_root")
    _reject_reparse_chain(source_root, "training lock request source_root")
    if not source_root.is_absolute() or not source_root.is_dir():
        raise ValueError(
            "training lock request source_root must be an absolute non-symlink directory"
        )
    source_root_resolved = source_root.resolve()
    source_values = _require_object_list(
        request["source_files"], "training lock request source_files", 2, 128
    )
    source_identities: dict[str, dict[str, Any]] = {}
    for index, source_value in enumerate(source_values):
        source_path, identity = _resolve_identity(
            source_value, f"training lock request source_files[{index}]"
        )
        try:
            relative = source_path.relative_to(source_root_resolved)
        except ValueError as error:
            raise ValueError("every source file must be inside source_root") from error
        if len(relative.parts) != 1:
            raise ValueError("source files must be direct children of source_root")
        if relative.name in source_identities:
            raise ValueError("training lock request source file names must be unique")
        source_identities[relative.name] = identity
    expected_source = {
        item["name"]: {"bytes": item["bytes"], "sha256": item["sha256"]}
        for item in profile.source_files
    }
    if source_identities != expected_source:
        raise ValueError(
            "training lock request source artifacts do not match the profile"
        )

    curriculum_path, curriculum_identity = _resolve_identity(
        request["curriculum"], "training lock request curriculum"
    )
    audit_path, audit_identity = _resolve_identity(
        request["curriculum_audit"], "training lock request curriculum_audit"
    )
    review_manifest_path, review_manifest_identity = _resolve_identity(
        request["review_manifest"], "training lock request review_manifest"
    )
    holdout_receipt_path, holdout_identity = _resolve_identity(
        request["holdout_receipt"], "training lock request holdout_receipt"
    )
    index_path, index_identity = _resolve_identity(
        request["exclusion_index"], "training lock request exclusion_index"
    )
    semantic_path, semantic_identity = _resolve_identity(
        request["semantic_receipt"], "training lock request semantic_receipt"
    )
    _, tombstone_identity = _resolve_identity(
        request["tombstone_lineage"], "training lock request tombstone_lineage"
    )
    _, environment_identity = _resolve_identity(
        request["environment_lock"], "training lock request environment_lock"
    )
    _, training_program_identity = _resolve_identity(
        request["training_program"], "training lock request training_program"
    )

    audit = read_json_object(audit_path, MAX_SEMANTIC_RECEIPT_BYTES, "curriculum audit")
    if audit.get("schema") != CURRICULUM_AUDIT_SCHEMA or audit.get("status") != "pass":
        raise ValueError("curriculum audit must pass")
    if audit.get("profile_sha256") != profile.profile_sha256:
        raise ValueError("curriculum audit profile identity does not match")
    if audit.get("control_program_sha256") != control_program_sha256():
        raise ValueError("curriculum audit control program identity does not match")
    if audit.get("curriculum_sha256") != curriculum_identity["sha256"]:
        raise ValueError("curriculum audit does not bind the requested curriculum")
    if audit.get("review_manifest_sha256") != review_manifest_identity["sha256"]:
        raise ValueError("curriculum audit does not bind the requested review manifest")
    if audit.get("exclusion_index_sha256") != index_identity["sha256"]:
        raise ValueError("curriculum audit does not bind the requested exclusion index")
    if audit.get("semantic_receipt_sha256") != semantic_identity["sha256"]:
        raise ValueError(
            "curriculum audit does not bind the requested semantic receipt"
        )
    if audit.get("tombstone_lineage_sha256") != tombstone_identity["sha256"]:
        raise ValueError(
            "curriculum audit does not bind the requested tombstone lineage"
        )
    _validate_index(profile, index_path)
    review_evidence = _validate_review_evidence(
        profile, curriculum_path, review_manifest_path
    )
    if review_evidence["manifest_sha256"] != audit["review_manifest_sha256"]:
        raise ValueError("review evidence changed after the curriculum audit")
    if review_evidence["record_count"] != audit["record_count"]:
        raise ValueError(
            "review evidence record count changed after the curriculum audit"
        )
    _validate_semantic_receipt(
        profile,
        semantic_path,
        curriculum_identity["sha256"],
        index_identity["sha256"],
        audit["record_count"],
        profile.holdout_case_count + profile.evaluation_case_count,
    )
    _validate_public_holdout_receipt(
        profile, holdout_receipt_path, index_identity["sha256"]
    )

    output_root = Path(
        require_string(
            request["output_root"], "training lock request output_root", maximum=32768
        )
    )
    _validate_external_output_root(output_root)
    lock = {
        "schema": TRAINING_LOCK_SCHEMA,
        "status": "authorized",
        "authorized_operation": "cpu-lora-pilot",
        "lock_id": lock_id,
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "goal_sha256": profile.goal_sha256,
        "source_repo_id": profile.source_repo_id,
        "source_revision": profile.source_revision,
        "source_status": profile.source_status,
        "source_artifacts": [
            {"name": name, **identity}
            for name, identity in sorted(source_identities.items())
        ],
        "curriculum": curriculum_identity,
        "curriculum_audit": audit_identity,
        "review_manifest": review_manifest_identity,
        "review_evidence": review_evidence,
        "holdout_receipt": holdout_identity,
        "exclusion_index": index_identity,
        "semantic_receipt": semantic_identity,
        "tombstone_lineage": tombstone_identity,
        "environment_lock": environment_identity,
        "training_program": training_program_identity,
        "output_root": str(output_root),
        "training": profile.raw["training"],
        "stop_rules": profile.raw["stop_rules"],
        "checkpoint_selection": "final-checkpoint-only-no-best-of-n",
        "raw_output_preservation_required": True,
        "retry_selection_forbidden": True,
        "response_repair_forbidden": True,
    }
    _write_new_atomic(output_path, _json_document_bytes(lock))
    return lock


def _command_verify_profile(args: argparse.Namespace) -> dict[str, Any]:
    profile = load_profile(args.profile)
    return {
        "status": "pass",
        "profile_id": profile.profile_id,
        "profile_sha256": profile.profile_sha256,
        "pilot_record_count": profile.pilot_record_count,
        "scale_record_count": profile.scale_record_count,
        "holdout_case_count": profile.holdout_case_count,
    }


def _custody_plan_cli_summary(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        key: plan[key]
        for key in (
            "schema",
            "status",
            "plan_id",
            "profile_id",
            "profile_sha256",
            "control_program_sha256",
            "case_count",
            "split_counts",
            "slot_set_sha256",
            "seed_commitment",
            "development_template_sha256",
            "independent_audit_template_sha256",
            "contains_raw_prompts",
            "contains_answer_anchors",
            "contains_seed",
        )
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify = subparsers.add_parser(
        "verify-profile", help="verify the exact checked-in profile and fixtures"
    )
    verify.add_argument("profile", type=Path)

    initialize = subparsers.add_parser(
        "initialize-holdout-custody",
        help="create a private seed and two incomplete custody templates",
    )
    initialize.add_argument("profile", type=Path)
    initialize.add_argument("plan_id")
    initialize.add_argument("output_root", type=Path)

    assemble = subparsers.add_parser(
        "assemble-holdout-contributions",
        help="validate distinct completed contributions and assemble a factor pack",
    )
    assemble.add_argument("profile", type=Path)
    assemble.add_argument("plan", type=Path)
    assemble.add_argument("development_contribution", type=Path)
    assemble.add_argument("independent_audit_contribution", type=Path)
    assemble.add_argument("output_root", type=Path)

    seal = subparsers.add_parser(
        "seal-holdouts", help="seal only a factor pack bound by its custody receipt"
    )
    seal.add_argument("profile", type=Path)
    seal.add_argument("factor_pack", type=Path)
    seal.add_argument("seed", type=Path)
    seal.add_argument("custody_receipt", type=Path)
    seal.add_argument("output_root", type=Path)

    audit = subparsers.add_parser(
        "audit-curriculum", help="audit a reviewed curriculum against exclusions"
    )
    audit.add_argument("profile", type=Path)
    audit.add_argument("curriculum", type=Path)
    audit.add_argument("review_manifest", type=Path)
    audit.add_argument("exclusion_index", type=Path)
    audit.add_argument("semantic_receipt", type=Path)
    audit.add_argument("output", type=Path)
    audit.add_argument("--tombstones", type=Path)

    freeze = subparsers.add_parser(
        "freeze-training-lock", help="issue a hash-bound CPU pilot authorization"
    )
    freeze.add_argument("profile", type=Path)
    freeze.add_argument("request", type=Path)
    freeze.add_argument("output", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "verify-profile":
            result = _command_verify_profile(args)
        elif args.command == "initialize-holdout-custody":
            plan = initialize_holdout_custody(
                load_profile(args.profile), args.plan_id, args.output_root
            )
            result = _custody_plan_cli_summary(plan)
        elif args.command == "assemble-holdout-contributions":
            result = assemble_holdout_contributions(
                load_profile(args.profile),
                args.plan,
                args.development_contribution,
                args.independent_audit_contribution,
                args.output_root,
            )
        elif args.command == "seal-holdouts":
            result = seal_holdouts(
                load_profile(args.profile),
                args.factor_pack,
                args.seed,
                args.custody_receipt,
                args.output_root,
            )
        elif args.command == "audit-curriculum":
            result = audit_curriculum(
                load_profile(args.profile),
                args.curriculum,
                args.review_manifest,
                args.exclusion_index,
                args.semantic_receipt,
                args.tombstones,
                args.output,
            )
        elif args.command == "freeze-training-lock":
            result = freeze_training_lock(
                load_profile(args.profile), args.request, args.output
            )
        else:  # pragma: no cover - argparse makes this unreachable.
            raise AssertionError(f"unsupported command: {args.command}")
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    print(canonical_json_bytes(result).decode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
