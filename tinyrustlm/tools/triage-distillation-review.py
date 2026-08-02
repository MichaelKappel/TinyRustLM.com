"""Prioritize pending teacher drafts without approving or rewriting records.

The triage output is review assistance only. It contains identities, hashes,
flags, and contract findings, but never response text or approval decisions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence


WORKBOOK_SCHEMA = "tinyrustlm.teacher_review_workbook_receipt.v2"
CONTEXT_SCHEMA = "tinyrustlm.teacher_review_context_record.v1"
TRIAGE_RECORD_SCHEMA = "tinyrustlm.teacher_review_triage_record.v1"
TRIAGE_REPORT_SCHEMA = "tinyrustlm.teacher_review_triage_report.v1"
SUGGESTION_SCHEMA = "tinyrustlm.teacher_review_suggestion.v1"
SUGGESTION_EVIDENCE_SCHEMA = "tinyrustlm.teacher_review_suggestion_evidence.v1"
SUGGESTED_REVIEW_RECEIPT_SCHEMA = "tinyrustlm.agent_assisted_review_workbook.v1"
SUGGESTED_REVIEW_RECEIPT_SCHEMA_V2 = "tinyrustlm.agent_assisted_review_workbook.v2"
PENDING_ANSWER_AUDIT_RECORD_SCHEMA = "tinyrustlm.pending_answer_audit_record.v1"
PENDING_ANSWER_AUDIT_REPORT_SCHEMA = "tinyrustlm.pending_answer_audit_report.v1"
SEMANTIC_NEIGHBOR_AUDIT_RECORD_SCHEMA = (
    "tinyrustlm.review_semantic_neighbor_audit_record.v1"
)
SEMANTIC_NEIGHBOR_AUDIT_REPORT_SCHEMA = (
    "tinyrustlm.review_semantic_neighbor_audit_report.v1"
)
HUMAN_REVIEW_HANDOFF_SCHEMA = "tinyrustlm.human_review_handoff_manifest.v1"
HUMAN_REVIEW_RECORD_SCHEMA = "tinyrustlm.human_review_record.v1"
HUMAN_REVIEW_DECISION_SCHEMA = "tinyrustlm.human_review_decision.v1"
HUMAN_REVIEW_PROGRESS_SCHEMA = "tinyrustlm.human_review_progress_report.v1"
HUMAN_REVIEW_COMPLETION_SCHEMA = "tinyrustlm.human_review_completion_receipt.v1"
MAX_RECEIPT_BYTES = 16 * 1024 * 1024
MAX_WORKBOOK_BYTES = 1024 * 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024
MAX_ENCODER_FILE_BYTES = 2 * 1024 * 1024 * 1024
MAX_REFUSAL_LANGUAGE_RATE = 0.02
MAX_APOLOGY_RATE = 0.03
MAX_DISCLAIMER_RATE = 0.03
MAX_FALSE_CAPABILITY_COUNT = 0
MAX_HIDDEN_REASONING_COUNT = 0

ENCODER_REQUIRED_FILES = (
    "config.json",
    "model.safetensors",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.txt",
)

RECEIPT_KEYS = {
    "schema",
    "campaign_id",
    "draft_manifest_path",
    "draft_manifest_sha256",
    "review_decisions_file",
    "review_decisions_sha256",
    "review_context_file",
    "review_context_sha256",
    "record_count",
    "pending_count",
    "status",
    "required_next_gate",
}
CONTEXT_KEYS = {
    "schema",
    "id",
    "task_family",
    "prompt",
    "response_requirements",
    "max_tokens",
    "seed",
    "request_sha256",
    "finish_reason",
    "draft_response",
    "draft_response_sha256",
}
DECISION_KEYS = {
    "id",
    "decision",
    "draft_response_sha256",
    "reviewed_response",
    "reviewer_id",
    "review_note",
    "factuality",
    "instruction_following",
    "safety",
    "conciseness",
    "hidden_reasoning_absent",
}
SUGGESTION_KEYS = {
    "schema",
    "id",
    "draft_response_sha256",
    "action",
    "proposed_response",
    "rationale",
    "evidence_tags",
    "agent_id",
    "confidence",
}
ASSISTED_RECEIPT_KEYS = {
    "schema",
    "campaign_id",
    "source_workbook_path",
    "source_workbook_receipt_sha256",
    "draft_manifest_path",
    "draft_manifest_sha256",
    "review_context_file",
    "review_context_sha256",
    "review_decisions_file",
    "review_decisions_sha256",
    "suggestion_source_path",
    "suggestion_source_sha256",
    "suggestion_evidence_file",
    "suggestion_evidence_sha256",
    "record_count",
    "suggestion_count",
    "rewrite_count",
    "reject_count",
    "untouched_count",
    "status",
    "required_next_gate",
}
ASSISTED_RECEIPT_KEYS_V2 = (
    ASSISTED_RECEIPT_KEYS - {"suggestion_source_path", "suggestion_source_sha256"}
) | {"suggestion_sources"}
SUGGESTION_SOURCE_IDENTITY_KEYS = {"path", "sha256", "suggestion_count"}
SUGGESTION_EVIDENCE_KEYS = {
    "schema",
    "id",
    "draft_response_sha256",
    "action",
    "proposed_response_sha256",
    "rationale",
    "evidence_tags",
    "agent_id",
    "confidence",
    "contract_findings",
    "status",
}
PENDING_FIELDS = (
    "factuality",
    "instruction_following",
    "safety",
    "conciseness",
    "hidden_reasoning_absent",
)
HUMAN_REVIEW_MANIFEST_KEYS = {
    "schema",
    "status",
    "input_workbooks",
    "semantic_audits",
    "record_count",
    "batch_size",
    "batch_count",
    "batches",
    "all_record_ids_sha256",
    "resolved_decision_count",
    "training_authority",
    "required_next_gate",
}
HUMAN_REVIEW_BATCH_KEYS = {
    "batch_id",
    "batch_index",
    "record_count",
    "record_ids_sha256",
    "review_file",
    "review_sha256",
    "decision_file",
    "initial_decision_sha256",
    "status",
}
HUMAN_REVIEW_RECORD_KEYS = {
    "schema",
    "batch_id",
    "batch_index",
    "record_index",
    "id",
    "campaign_id",
    "task_family",
    "source_workbook_receipt_sha256",
    "assisted_workbook_receipt_sha256",
    "context_sha256",
    "draft_response_sha256",
    "candidate_response_sha256",
    "priority",
    "priority_score",
    "risk_flags",
    "contract_findings",
    "prompt",
    "response_requirements",
    "max_tokens",
    "finish_reason",
    "original_draft_response",
    "candidate_action",
    "candidate_origin",
    "candidate_response",
    "agent_evidence",
    "semantic_clusters",
    "status",
}
HUMAN_REVIEW_DECISION_KEYS = {
    "schema",
    "batch_id",
    "id",
    "source_workbook_receipt_sha256",
    "assisted_workbook_receipt_sha256",
    "context_sha256",
    "draft_response_sha256",
    "candidate_response_sha256",
    "action",
    "reviewed_response",
    "reviewer_id",
    "review_note",
    *PENDING_FIELDS,
}
SEMANTIC_REPORT_KEYS = {
    "schema",
    "status",
    "input_workbooks",
    "record_count",
    "semantic_threshold",
    "semantic_pair_count",
    "semantic_neighbor_record_count",
    "normalized_exact_pair_count",
    "cluster_count",
    "clusters",
    "semantic_neighbor_origin_counts",
    "proposed_reject_neighbor_record_count",
    "clusters_with_proposed_rejects",
    "encoder",
    "audit_file",
    "audit_sha256",
    "contains_prompt_text",
    "contains_response_text",
    "contains_approval_decisions",
    "automatic_rejection_count",
    "training_authority",
    "required_next_gate",
}
SEMANTIC_RECORD_KEYS = {
    "schema",
    "pair_id",
    "left_id",
    "right_id",
    "cosine_similarity",
    "left_campaign_id",
    "right_campaign_id",
    "left_task_family",
    "right_task_family",
    "left_candidate_origin",
    "right_candidate_origin",
    "left_prompt_sha256",
    "right_prompt_sha256",
    "normalized_exact_match",
    "status",
}
SEMANTIC_CLUSTER_KEYS = {
    "cluster_id",
    "record_ids",
    "record_count",
    "pair_count",
    "max_cosine_similarity",
    "candidate_origin_counts",
    "proposed_reject_record_ids",
}
ASSISTED_IDENTITY_KEYS = {
    "campaign_id",
    "workbook_path",
    "receipt_sha256",
    "source_workbook_receipt_sha256",
    "draft_manifest_sha256",
    "review_context_sha256",
    "review_decisions_sha256",
    "suggestion_evidence_sha256",
    "record_count",
    "suggestion_count",
    "status",
}
SEMANTIC_IDENTITY_KEYS = {
    "path",
    "report_sha256",
    "audit_sha256",
    "semantic_threshold",
    "record_count",
    "semantic_pair_count",
    "cluster_count",
}
PLACEHOLDER_REVIEWER_IDS = {
    "pending-reviewer",
    "reviewer",
    "human-reviewer",
    "todo",
    "tbd",
    "unknown",
}

CURRENT_OR_RECOMMENDATION = re.compile(
    r"\b(?:current(?:ly)?|today|tonight|this week|latest|newest|popular|"
    r"recommend(?:ation|ations|ed|ing)?|best\s+(?:one|option|product|service|"
    r"show|channel|app|tool)|available now)\b",
    re.IGNORECASE,
)
MEDICAL_OR_HEALTH = re.compile(
    r"\b(?:health|medical|doctor|physician|symptom|diagnos\w*|treat(?:ment)?|"
    r"medication|supplement|vitamin|allerg\w*|sleep|insomnia|disease|pain|"
    r"injur\w*|diet|nutrition|heart|stress|veterinar\w*|pet health)\b",
    re.IGNORECASE,
)
LEGAL_OR_POLICY = re.compile(
    r"\b(?:law|legal|court|amendment|regulat\w*|licens\w*|policy|mandatory|"
    r"rights?|jurisdiction|contract|governance|constitutional|criminal)\b",
    re.IGNORECASE,
)
SECURITY_OR_DESTRUCTIVE = re.compile(
    r"\b(?:password|credential|authentication code|phish\w*|encrypt\w*|"
    r"ransom\w*|administrator|unauthorized|account recovery|secure wipe|"
    r"delete|deletion|track\w* location|doxx\w*|access token|private address|"
    r"penetration test|firearm)\b",
    re.IGNORECASE,
)
CULTURAL_OR_HISTORICAL = re.compile(
    r"\b(?:culture|cultural|tradition|histor\w*|religion|religious|ethnic|"
    r"ancient|heritage|ceremony|ritual)\b",
    re.IGNORECASE,
)
NUMERIC_CLAIM = re.compile(
    r"(?:\b\d+(?:\.\d+)?\s*(?:%|percent|mg|g|kg|ml|hours?|minutes?|seconds?|"
    r"degrees?|mph|km|miles?|years?)\b|\b\d{3,}\b)",
    re.IGNORECASE,
)
NAMED_RECOMMENDATION = re.compile(
    r"(?:[\"*][A-Z][^\"*\r\n]{1,80}[\"*]|@[A-Za-z0-9_]{2,}|"
    r"\b(?:YouTube|Instagram|TikTok|Netflix|Amazon|Google|Apple|Microsoft)\b)"
)
OVERCLAIM = re.compile(
    r"\b(?:will\s+(?:prevent|cure|eliminate|guarantee|ensure)|guaranteed to|"
    r"proven to cure|completely safe|zero risk)\b",
    re.IGNORECASE,
)
REFUSAL = re.compile(
    r"\bi (?:can(?:not|'t)|won't|will not) (?:help|assist|provide|comply|build|draft)\b|"
    r"\bi (?:must|have to) (?:decline|refuse)\b",
    re.IGNORECASE,
)
DISCLAIMER = re.compile(
    r"\b(?:as an ai|not (?:a|your) (?:lawyer|doctor|physician|financial advisor)|"
    r"not (?:legal|medical|financial) advice)\b",
    re.IGNORECASE,
)
APOLOGY = re.compile(
    r"\b(?:i(?:'m| am) sorry|i apologize|my apologies)\b",
    re.IGNORECASE,
)
FALSE_CAPABILITY = re.compile(
    r"\bi (?:browsed|searched|checked) (?:the )?(?:web|internet|online)\b|"
    r"\bi (?:opened|read|accessed) your (?:file|email|account|calendar|device)\b|"
    r"\bi (?:sent|posted|uploaded|downloaded|deleted) (?:the|your|that)\b|"
    r"\bi (?:called|emailed|messaged|contacted)\b",
    re.IGNORECASE,
)
HIDDEN_REASONING = re.compile(
    r"<think>|</think>|<\|thinking\|>|\bchain of thought:|\bhidden reasoning:|"
    r"\bprivate scratchpad:",
    re.IGNORECASE,
)
SECRET_MATERIAL = re.compile(
    r"-----begin (?:rsa )?private key-----|authorization:\s*bearer\s+|"
    r"\b(?:api[_-]?key|client_secret|database_password)\s*[:=]",
    re.IGNORECASE,
)
ROLE_PREFIX = re.compile(r"^\s*(?:assistant|user|system)\s*:", re.IGNORECASE)
TEMPLATE_MARKER = re.compile(
    r"<\|(?:assistant|user|system|im_start|im_end|endoftext)[^|]*\|>",
    re.IGNORECASE,
)
PLACEHOLDER_TEXT = re.compile(r"\b(?:todo|tbd|placeholder|lorem ipsum)\b", re.IGNORECASE)
MOJIBAKE = re.compile(
    r"(?:\u00c2[\u0080-\u00bf]|\u00c3[\u0080-\u00bf]|"
    r"\u00e2(?:[\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e"
    r"\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d"
    r"\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]){2})"
)

NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
}
SENTENCE_LIMIT_PATTERNS = (
    re.compile(
        r"(?:no more than|at most|use)\s+(one|two|three|four|five|six|\d+)\s+"
        r"(?:short\s+|concise\s+)?sentences?",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:answer|respond|reply|return|write)\b[^.]{0,40}\bin\s+"
        r"(one|two|three|four|five|six|\d+)\s+sentences?",
        re.IGNORECASE,
    ),
    re.compile(r"\buse\s+one\s+or\s+two\s+(?:short\s+)?sentences?", re.IGNORECASE),
)
BULLET_COUNT_PATTERN = re.compile(
    r"(?:exactly|use|return|write)\s+(one|two|three|four|five|six|\d+)\s+"
    r"(?:concise\s+)?bullet(?:\s+points?)?",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ReviewContext:
    campaign_id: str
    workbook_path: Path
    receipt_sha256: str
    value: dict[str, Any]

    @property
    def record_id(self) -> str:
        return self.value["id"]


@dataclass(frozen=True)
class PendingAnswer:
    context: ReviewContext
    decision: dict[str, Any]
    evidence: dict[str, Any] | None
    assisted_receipt_sha256: str

    @property
    def record_id(self) -> str:
        return self.context.record_id

    @property
    def origin(self) -> str:
        if self.evidence is None:
            return "original-draft"
        return "agent-reject" if self.evidence["action"] == "reject" else "agent-rewrite"


@dataclass(frozen=True)
class HumanReviewHandoffState:
    handoff: Path
    manifest_path: Path
    manifest: dict[str, Any]
    identities: tuple[dict[str, Any], ...]
    answers: tuple[PendingAnswer, ...]
    expected_batches: tuple[dict[str, Any], ...]
    decision_rows: tuple[tuple[dict[str, Any], ...], ...]
    decision_sha256s: tuple[str, ...]


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


def require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise ValueError(f"{label} key mismatch; missing={missing}; unknown={unknown}")


def require_string(value: dict[str, Any], key: str, label: str) -> str:
    result = value.get(key)
    if not isinstance(result, str) or not result or result.strip() != result or "\0" in result:
        raise ValueError(f"{label}.{key} must be a non-empty trimmed string")
    return result


def require_sha256(value: Any, label: str) -> str:
    if (
        not isinstance(value, str)
        or not value.startswith("sha256:")
        or len(value) != 71
        or any(char not in "0123456789abcdefABCDEF" for char in value[7:])
    ):
        raise ValueError(f"{label} must be a sha256: value")
    return value.lower()


def require_integer(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    if value < minimum or value > maximum:
        raise ValueError(f"{label} must be in {minimum}..={maximum}")
    return value


def read_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size <= 0 or size > maximum:
        raise ValueError(f"{label} byte length must be in 1..={maximum}: {path}")
    return path.read_bytes()


def read_json_object(path: Path, maximum: int, label: str) -> dict[str, Any]:
    try:
        value = json.loads(read_regular_bytes(path, maximum, label))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def read_jsonl(path: Path, label: str) -> list[dict[str, Any]]:
    try:
        text = read_regular_bytes(path, MAX_WORKBOOK_BYTES, label).decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be UTF-8") from error
    rows = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid {label} JSONL at line {line_number}") from error
        if not isinstance(value, dict):
            raise ValueError(f"{label} line {line_number} must be an object")
        rows.append(value)
    if not rows:
        raise ValueError(f"{label} is empty")
    return rows


def read_editable_jsonl(path: Path, label: str) -> list[dict[str, Any]]:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size > MAX_WORKBOOK_BYTES:
        raise ValueError(f"{label} exceeds the maximum byte length: {path}")
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be UTF-8") from error
    rows = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid {label} JSONL at line {line_number}") from error
        if not isinstance(value, dict):
            raise ValueError(f"{label} line {line_number} must be an object")
        rows.append(value)
    return rows


def safe_workbook_file(workbook: Path, name: str, label: str) -> Path:
    relative = Path(name)
    if relative.is_absolute() or len(relative.parts) != 1 or relative.name != name:
        raise ValueError(f"{label} must be a basename inside the workbook")
    path = workbook / relative
    if not path.resolve().is_relative_to(workbook):
        raise ValueError(f"{label} escapes the workbook")
    return path


def resolve_manifest(workbook: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = workbook / path
    return path.resolve()


def load_workbook(workbook_path: Path) -> tuple[dict[str, Any], tuple[ReviewContext, ...]]:
    workbook = workbook_path.resolve()
    if not workbook.is_dir() or workbook.is_symlink():
        raise ValueError(f"review workbook must be a non-symlink directory: {workbook}")
    receipt_path = workbook / "review-workbook-receipt.json"
    receipt = read_json_object(receipt_path, MAX_RECEIPT_BYTES, "review workbook receipt")
    require_exact_keys(receipt, RECEIPT_KEYS, "review workbook receipt")
    if receipt.get("schema") != WORKBOOK_SCHEMA:
        raise ValueError("review workbook schema is unsupported")
    campaign_id = require_string(receipt, "campaign_id", "receipt")
    if receipt.get("status") != "pending-explicit-record-review-not-training-approved":
        raise ValueError("review workbook is not in the pending-review state")
    if receipt.get("required_next_gate") != "resolve-every-pending-review-decision":
        raise ValueError("review workbook next gate is unsupported")
    record_count = require_integer(receipt.get("record_count"), "record_count", 1, 1_000_000)
    pending_count = require_integer(receipt.get("pending_count"), "pending_count", 1, 1_000_000)
    if pending_count != record_count:
        raise ValueError("review workbook must be completely pending before triage")

    manifest_path = resolve_manifest(
        workbook, require_string(receipt, "draft_manifest_path", "receipt")
    )
    read_regular_bytes(manifest_path, MAX_WORKBOOK_BYTES, "draft manifest")
    if sha256_file(manifest_path) != require_sha256(
        receipt.get("draft_manifest_sha256"), "draft_manifest_sha256"
    ):
        raise ValueError("draft manifest SHA-256 drift")

    context_path = safe_workbook_file(
        workbook,
        require_string(receipt, "review_context_file", "receipt"),
        "review_context_file",
    )
    decision_path = safe_workbook_file(
        workbook,
        require_string(receipt, "review_decisions_file", "receipt"),
        "review_decisions_file",
    )
    if sha256_file(context_path) != require_sha256(
        receipt.get("review_context_sha256"), "review_context_sha256"
    ):
        raise ValueError("review context SHA-256 drift")
    if sha256_file(decision_path) != require_sha256(
        receipt.get("review_decisions_sha256"), "review_decisions_sha256"
    ):
        raise ValueError("review decisions SHA-256 drift")

    contexts = read_jsonl(context_path, "review context")
    decisions = read_jsonl(decision_path, "review decisions")
    if len(contexts) != record_count or len(decisions) != record_count:
        raise ValueError("review workbook record count drift")
    receipt_sha256 = sha256_file(receipt_path)
    loaded = []
    seen = set()
    for index, (context, decision) in enumerate(zip(contexts, decisions)):
        context_label = f"review context[{index}]"
        decision_label = f"review decision[{index}]"
        require_exact_keys(context, CONTEXT_KEYS, context_label)
        require_exact_keys(decision, DECISION_KEYS, decision_label)
        if context.get("schema") != CONTEXT_SCHEMA:
            raise ValueError(f"{context_label} schema is unsupported")
        record_id = require_string(context, "id", context_label)
        if record_id in seen:
            raise ValueError(f"review workbook contains duplicate id {record_id}")
        seen.add(record_id)
        require_string(context, "task_family", context_label)
        require_string(context, "prompt", context_label)
        requirements = context.get("response_requirements")
        if (
            not isinstance(requirements, list)
            or not requirements
            or any(not isinstance(item, str) or not item.strip() for item in requirements)
        ):
            raise ValueError(f"{context_label}.response_requirements are invalid")
        require_integer(context.get("max_tokens"), f"{context_label}.max_tokens", 1, 4096)
        require_integer(context.get("seed"), f"{context_label}.seed", 0, 2**31 - 1)
        require_sha256(context.get("request_sha256"), f"{context_label}.request_sha256")
        require_string(context, "finish_reason", context_label)
        draft_response = require_string(context, "draft_response", context_label)
        if len(draft_response.encode("utf-8")) > MAX_RECORD_BYTES:
            raise ValueError(f"{context_label}.draft_response is too large")
        draft_sha256 = require_sha256(
            context.get("draft_response_sha256"),
            f"{context_label}.draft_response_sha256",
        )
        if sha256_bytes(draft_response.encode("utf-8")) != draft_sha256:
            raise ValueError(f"{context_label} draft response SHA-256 drift")

        if decision.get("id") != record_id:
            raise ValueError("review context and decision order/identity drift")
        if decision.get("decision") != "pending":
            raise ValueError(f"review decision {record_id} is no longer pending")
        if decision.get("draft_response_sha256") != draft_sha256:
            raise ValueError(f"review decision {record_id} draft hash drift")
        if decision.get("reviewed_response") != draft_response:
            raise ValueError(f"review decision {record_id} response drift")
        if decision.get("reviewer_id") != "pending-reviewer" or decision.get(
            "review_note"
        ) != "Pending explicit review against the prompt and response contract.":
            raise ValueError(f"review decision {record_id} metadata is not pristine")
        if any(decision.get(field) != "pending" for field in PENDING_FIELDS):
            raise ValueError(f"review decision {record_id} checklist is not pending")
        loaded.append(ReviewContext(campaign_id, workbook, receipt_sha256, context))

    identity = {
        "campaign_id": campaign_id,
        "workbook_path": str(workbook),
        "draft_manifest_path": str(manifest_path),
        "receipt_sha256": receipt_sha256,
        "draft_manifest_sha256": receipt["draft_manifest_sha256"],
        "review_context_sha256": receipt["review_context_sha256"],
        "review_decisions_sha256": receipt["review_decisions_sha256"],
        "record_count": record_count,
        "status": "pending-review-validated",
    }
    return identity, tuple(loaded)


def load_assisted_workbook(
    workbook_path: Path,
) -> tuple[dict[str, Any], tuple[PendingAnswer, ...]]:
    workbook = workbook_path.resolve()
    if not workbook.is_dir() or workbook.is_symlink():
        raise ValueError(
            f"assisted review workbook must be a non-symlink directory: {workbook}"
        )
    receipt_path = workbook / "agent-assisted-review-receipt.json"
    receipt = read_json_object(
        receipt_path, MAX_RECEIPT_BYTES, "agent-assisted review receipt"
    )
    receipt_schema = receipt.get("schema")
    if receipt_schema == SUGGESTED_REVIEW_RECEIPT_SCHEMA:
        require_exact_keys(
            receipt, ASSISTED_RECEIPT_KEYS, "agent-assisted review receipt"
        )
    elif receipt_schema == SUGGESTED_REVIEW_RECEIPT_SCHEMA_V2:
        require_exact_keys(
            receipt, ASSISTED_RECEIPT_KEYS_V2, "agent-assisted review receipt"
        )
    else:
        raise ValueError("agent-assisted review receipt schema is unsupported")
    if receipt.get("status") != "agent-suggestions-pending-human-review-not-training-approved":
        raise ValueError("agent-assisted review workbook is not pending human review")
    if receipt.get("required_next_gate") != "explicit-human-review-of-every-record":
        raise ValueError("agent-assisted review next gate is unsupported")

    campaign_id = require_string(receipt, "campaign_id", "assisted receipt")
    record_count = require_integer(
        receipt.get("record_count"), "assisted record_count", 1, 1_000_000
    )
    suggestion_count = require_integer(
        receipt.get("suggestion_count"), "suggestion_count", 1, record_count
    )
    rewrite_count = require_integer(
        receipt.get("rewrite_count"), "rewrite_count", 0, suggestion_count
    )
    reject_count = require_integer(
        receipt.get("reject_count"), "reject_count", 0, suggestion_count
    )
    untouched_count = require_integer(
        receipt.get("untouched_count"), "untouched_count", 0, record_count
    )
    if rewrite_count + reject_count != suggestion_count:
        raise ValueError("assisted suggestion action counts do not add up")
    if suggestion_count + untouched_count != record_count:
        raise ValueError("assisted record counts do not add up")

    source_workbook = Path(
        require_string(receipt, "source_workbook_path", "assisted receipt")
    ).resolve()
    source_identity, source_contexts = load_workbook(source_workbook)
    source_receipt_sha256 = require_sha256(
        receipt.get("source_workbook_receipt_sha256"),
        "source_workbook_receipt_sha256",
    )
    if source_identity["receipt_sha256"] != source_receipt_sha256:
        raise ValueError("source workbook receipt SHA-256 drift")
    if source_identity["campaign_id"] != campaign_id:
        raise ValueError("source and assisted campaign identity drift")
    if source_identity["record_count"] != record_count:
        raise ValueError("source and assisted record count drift")
    if source_identity["draft_manifest_sha256"] != require_sha256(
        receipt.get("draft_manifest_sha256"), "assisted draft_manifest_sha256"
    ):
        raise ValueError("source and assisted draft manifest SHA-256 drift")
    if Path(source_identity["draft_manifest_path"]) != resolve_manifest(
        workbook,
        require_string(receipt, "draft_manifest_path", "assisted receipt"),
    ):
        raise ValueError("source and assisted draft manifest path drift")

    context_path = safe_workbook_file(
        workbook,
        require_string(receipt, "review_context_file", "assisted receipt"),
        "assisted review_context_file",
    )
    decisions_path = safe_workbook_file(
        workbook,
        require_string(receipt, "review_decisions_file", "assisted receipt"),
        "assisted review_decisions_file",
    )
    evidence_path = safe_workbook_file(
        workbook,
        require_string(receipt, "suggestion_evidence_file", "assisted receipt"),
        "assisted suggestion_evidence_file",
    )
    for path, field, label in (
        (context_path, "review_context_sha256", "assisted review context"),
        (decisions_path, "review_decisions_sha256", "assisted review decisions"),
        (evidence_path, "suggestion_evidence_sha256", "suggestion evidence"),
    ):
        if sha256_file(path) != require_sha256(receipt.get(field), field):
            raise ValueError(f"{label} SHA-256 drift")

    if receipt_schema == SUGGESTED_REVIEW_RECEIPT_SCHEMA:
        suggestion_source_values = [
            {
                "path": require_string(
                    receipt, "suggestion_source_path", "assisted receipt"
                ),
                "sha256": require_sha256(
                    receipt.get("suggestion_source_sha256"),
                    "suggestion_source_sha256",
                ),
                "suggestion_count": suggestion_count,
            }
        ]
    else:
        raw_sources = receipt.get("suggestion_sources")
        if not isinstance(raw_sources, list) or len(raw_sources) < 2:
            raise ValueError("assisted suggestion_sources must contain at least two rows")
        suggestion_source_values = []
        for index, source in enumerate(raw_sources):
            label = f"suggestion_sources[{index}]"
            if not isinstance(source, dict):
                raise ValueError(f"{label} must be an object")
            require_exact_keys(source, SUGGESTION_SOURCE_IDENTITY_KEYS, label)
            suggestion_source_values.append(
                {
                    "path": require_string(source, "path", label),
                    "sha256": require_sha256(source.get("sha256"), f"{label}.sha256"),
                    "suggestion_count": require_integer(
                        source.get("suggestion_count"),
                        f"{label}.suggestion_count",
                        1,
                        suggestion_count,
                    ),
                }
            )
        if sum(source["suggestion_count"] for source in suggestion_source_values) != suggestion_count:
            raise ValueError("assisted suggestion source counts do not add up")
    seen_source_paths = set()
    for index, source in enumerate(suggestion_source_values):
        suggestion_source_path = resolve_manifest(workbook, source["path"])
        if suggestion_source_path in seen_source_paths:
            raise ValueError("assisted suggestion source path is duplicated")
        seen_source_paths.add(suggestion_source_path)
        source_rows = read_jsonl(
            suggestion_source_path, f"review suggestion source[{index}]"
        )
        if len(source_rows) != source["suggestion_count"]:
            raise ValueError("review suggestion source count drift")
        if sha256_file(suggestion_source_path) != source["sha256"]:
            raise ValueError("review suggestion source SHA-256 drift")

    context_rows = read_jsonl(context_path, "assisted review context")
    decision_rows = read_jsonl(decisions_path, "assisted review decisions")
    evidence_rows = read_jsonl(evidence_path, "agent suggestion evidence")
    if len(context_rows) != record_count or len(decision_rows) != record_count:
        raise ValueError("assisted review workbook record count drift")
    if len(evidence_rows) != suggestion_count:
        raise ValueError("assisted suggestion evidence count drift")
    if context_rows != [context.value for context in source_contexts]:
        raise ValueError("assisted review context differs from its source workbook")

    evidence_by_id: dict[str, dict[str, Any]] = {}
    observed_rewrites = 0
    observed_rejects = 0
    for index, evidence in enumerate(evidence_rows):
        label = f"suggestion evidence[{index}]"
        require_exact_keys(evidence, SUGGESTION_EVIDENCE_KEYS, label)
        if evidence.get("schema") != SUGGESTION_EVIDENCE_SCHEMA:
            raise ValueError(f"{label} schema is unsupported")
        record_id = require_string(evidence, "id", label)
        if record_id in evidence_by_id:
            raise ValueError(f"duplicate suggestion evidence id {record_id}")
        require_sha256(evidence.get("draft_response_sha256"), f"{label}.draft_response_sha256")
        require_sha256(
            evidence.get("proposed_response_sha256"),
            f"{label}.proposed_response_sha256",
        )
        action = require_string(evidence, "action", label)
        if action not in {"rewrite", "reject"}:
            raise ValueError(f"{label}.action is unsupported")
        if evidence.get("contract_findings") != []:
            raise ValueError(f"{label}.contract_findings must be empty")
        if evidence.get("status") != "pending-human-review-never-auto-approved":
            raise ValueError(f"{label}.status is unsupported")
        observed_rewrites += action == "rewrite"
        observed_rejects += action == "reject"
        evidence_by_id[record_id] = evidence
    if observed_rewrites != rewrite_count or observed_rejects != reject_count:
        raise ValueError("assisted suggestion evidence action count drift")

    receipt_sha256 = sha256_file(receipt_path)
    pending_answers = []
    for index, (context, decision) in enumerate(zip(source_contexts, decision_rows)):
        label = f"assisted review decision[{index}]"
        require_exact_keys(decision, DECISION_KEYS, label)
        record_id = context.record_id
        if decision.get("id") != record_id:
            raise ValueError("assisted review context and decision identity drift")
        if decision.get("decision") != "pending":
            raise ValueError(f"assisted review decision {record_id} is not pending")
        draft_sha256 = context.value["draft_response_sha256"]
        if decision.get("draft_response_sha256") != draft_sha256:
            raise ValueError(f"assisted review decision {record_id} draft hash drift")
        if decision.get("reviewer_id") != "pending-reviewer":
            raise ValueError(f"assisted review decision {record_id} reviewer is not pending")
        if any(decision.get(field) != "pending" for field in PENDING_FIELDS):
            raise ValueError(f"assisted review decision {record_id} checklist is not pending")
        response = decision.get("reviewed_response")
        if not isinstance(response, str) or "\0" in response:
            raise ValueError(f"assisted review decision {record_id} response is invalid")
        if len(response.encode("utf-8")) > MAX_RECORD_BYTES:
            raise ValueError(f"assisted review decision {record_id} response is too large")

        evidence = evidence_by_id.get(record_id)
        if evidence is None:
            if response != context.value["draft_response"]:
                raise ValueError(f"untouched assisted response {record_id} drift")
            if decision.get("review_note") != (
                "Pending explicit review against the prompt and response contract."
            ):
                raise ValueError(f"untouched assisted review note {record_id} drift")
        else:
            if evidence.get("draft_response_sha256") != draft_sha256:
                raise ValueError(f"suggestion evidence {record_id} draft hash drift")
            if not str(decision.get("review_note", "")).startswith(
                "Agent suggestion pending human review: "
            ):
                raise ValueError(f"suggested review note {record_id} drift")
            if evidence["action"] == "reject":
                if response:
                    raise ValueError(f"reject suggestion {record_id} has a response")
            else:
                if not response or response.strip() != response:
                    raise ValueError(f"rewrite suggestion {record_id} response is invalid")
            if sha256_bytes(response.encode("utf-8")) != evidence[
                "proposed_response_sha256"
            ]:
                raise ValueError(f"suggested response {record_id} SHA-256 drift")
        pending_answers.append(PendingAnswer(context, decision, evidence, receipt_sha256))

    if set(evidence_by_id) - {answer.record_id for answer in pending_answers}:
        raise ValueError("suggestion evidence references an unknown record")
    identity = {
        "campaign_id": campaign_id,
        "workbook_path": str(workbook),
        "receipt_sha256": receipt_sha256,
        "source_workbook_receipt_sha256": source_receipt_sha256,
        "draft_manifest_sha256": receipt["draft_manifest_sha256"],
        "review_context_sha256": receipt["review_context_sha256"],
        "review_decisions_sha256": receipt["review_decisions_sha256"],
        "suggestion_evidence_sha256": receipt["suggestion_evidence_sha256"],
        "record_count": record_count,
        "suggestion_count": suggestion_count,
        "status": "all-decisions-pending-audit-only",
    }
    return identity, tuple(pending_answers)


def _number(value: str) -> int:
    lower = value.lower()
    return NUMBER_WORDS.get(lower, int(lower) if lower.isdigit() else 0)


def sentence_count(text: str) -> int:
    protected = re.sub(
        r"\b(?:e\.g|i\.e|mr|mrs|ms|dr|v|vs)\.",
        lambda match: match.group(0).replace(".", "§"),
        text,
        flags=re.IGNORECASE,
    )
    protected = re.sub(
        r"\b(?:[A-Z]\.){2,}",
        lambda match: match.group(0).replace(".", "§"),
        protected,
    )
    protected = re.sub(r"(?<=\d)\.(?=\d)", "§", protected)
    parts = re.split(r"(?<=[.!?])[\"')\]]*\s+(?=[A-Z0-9\"'(])", protected.strip())
    return len([part for part in parts if part.strip()])


def sentence_limit(requirements: Sequence[str]) -> int | None:
    limits = []
    for requirement in requirements:
        for index, pattern in enumerate(SENTENCE_LIMIT_PATTERNS):
            match = pattern.search(requirement)
            if match:
                limits.append(2 if index == 2 else _number(match.group(1)))
    return min((limit for limit in limits if limit > 0), default=None)


def bullet_count(text: str) -> int:
    return sum(
        1
        for line in text.splitlines()
        if re.match(r"^\s*(?:[-*•]|\d+[.)])\s+\S", line)
    )


def requested_bullet_count(requirements: Sequence[str]) -> int | None:
    counts = []
    for requirement in requirements:
        match = BULLET_COUNT_PATTERN.search(requirement)
        if match:
            counts.append(_number(match.group(1)))
    return min((count for count in counts if count > 0), default=None)


def contract_findings(context: dict[str, Any]) -> tuple[str, ...]:
    response = context["draft_response"]
    requirements = context["response_requirements"]
    findings = []
    limit = sentence_limit(requirements)
    if limit is not None and sentence_count(response) > limit:
        findings.append("sentence_limit_exceeded")
    bullets = requested_bullet_count(requirements)
    if bullets is not None and bullet_count(response) != bullets:
        findings.append("bullet_count_mismatch")
    requires_json = context["task_family"] == "strict-json" or any(
        "valid json object" in requirement.lower() for requirement in requirements
    )
    if requires_json:
        try:
            value = json.loads(response)
        except json.JSONDecodeError:
            value = None
        if not isinstance(value, dict):
            findings.append("invalid_json_object")
    if context["finish_reason"] != "stop":
        findings.append("non_stop_finish_reason")
    return tuple(sorted(set(findings)))


def risk_flags(context: dict[str, Any]) -> tuple[str, ...]:
    prompt = context["prompt"]
    response = context["draft_response"]
    combined = f"{prompt}\n{response}"
    flags = []
    checks = (
        ("current_or_recommendation_verification", CURRENT_OR_RECOMMENDATION),
        ("medical_or_health_verification", MEDICAL_OR_HEALTH),
        ("legal_or_policy_verification", LEGAL_OR_POLICY),
        ("security_or_destructive_operational_review", SECURITY_OR_DESTRUCTIVE),
        ("cultural_or_historical_verification", CULTURAL_OR_HISTORICAL),
    )
    for name, pattern in checks:
        if pattern.search(combined):
            flags.append(name)
    if NUMERIC_CLAIM.search(response):
        flags.append("numeric_claim_verification")
    if NAMED_RECOMMENDATION.search(response):
        flags.append("named_entity_or_title_verification")
    if OVERCLAIM.search(response):
        flags.append("absolute_or_medical_overclaim")
    if REFUSAL.search(response):
        flags.append("refusal_language_review")
    if DISCLAIMER.search(response):
        flags.append("disclaimer_language_review")
    if FALSE_CAPABILITY.search(response):
        flags.append("false_external_capability_claim")
    if HIDDEN_REASONING.search(response):
        flags.append("hidden_reasoning_material")
    return tuple(sorted(set(flags)))


FLAG_WEIGHTS = {
    "current_or_recommendation_verification": 25,
    "medical_or_health_verification": 40,
    "legal_or_policy_verification": 35,
    "security_or_destructive_operational_review": 50,
    "cultural_or_historical_verification": 20,
    "numeric_claim_verification": 5,
    "named_entity_or_title_verification": 15,
    "absolute_or_medical_overclaim": 30,
    "refusal_language_review": 10,
    "disclaimer_language_review": 10,
    "false_external_capability_claim": 100,
    "hidden_reasoning_material": 100,
}


def triage_record(context: ReviewContext) -> dict[str, Any]:
    flags = risk_flags(context.value)
    findings = contract_findings(context.value)
    score = sum(FLAG_WEIGHTS[flag] for flag in flags) + (100 * len(findings))
    if findings or "false_external_capability_claim" in flags or "hidden_reasoning_material" in flags:
        priority = "critical"
    elif score >= 40:
        priority = "high"
    elif score >= 15:
        priority = "focused"
    else:
        priority = "routine"
    return {
        "schema": TRIAGE_RECORD_SCHEMA,
        "id": context.record_id,
        "campaign_id": context.campaign_id,
        "task_family": context.value["task_family"],
        "workbook_receipt_sha256": context.receipt_sha256,
        "context_sha256": sha256_bytes(canonical_json_bytes(context.value)),
        "draft_response_sha256": context.value["draft_response_sha256"],
        "priority": priority,
        "priority_score": score,
        "flags": list(flags),
        "contract_findings": list(findings),
        "status": "review-required-never-auto-approved",
    }


def publish_new_directory(staging: Path, output_dir: Path) -> None:
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    try:
        os.rename(staging, output_dir)
    except PermissionError:
        if staging.exists() or not output_dir.is_dir() or output_dir.is_symlink():
            raise


def write_triage(
    workbook_paths: Sequence[Path], output_dir: Path
) -> dict[str, Any]:
    if not workbook_paths:
        raise ValueError("at least one review workbook is required")
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")

    identities = []
    contexts = []
    seen = set()
    for workbook_path in workbook_paths:
        identity, records = load_workbook(workbook_path)
        identities.append(identity)
        for record in records:
            if record.record_id in seen:
                raise ValueError(f"duplicate review record id {record.record_id}")
            seen.add(record.record_id)
            contexts.append(record)
    rows = [triage_record(context) for context in contexts]
    rows.sort(key=lambda row: (-row["priority_score"], row["id"]))

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        triage_path = staging / "review-triage.jsonl"
        triage_path.write_bytes(
            b"".join(canonical_json_bytes(row) + b"\n" for row in rows)
        )
        priority_counts = Counter(row["priority"] for row in rows)
        flag_counts = Counter(flag for row in rows for flag in row["flags"])
        finding_counts = Counter(
            finding for row in rows for finding in row["contract_findings"]
        )
        report = {
            "schema": TRIAGE_REPORT_SCHEMA,
            "status": "review-prioritized-never-auto-approved",
            "input_workbooks": identities,
            "record_count": len(rows),
            "priority_counts": dict(sorted(priority_counts.items())),
            "flag_counts": dict(sorted(flag_counts.items())),
            "contract_finding_counts": dict(sorted(finding_counts.items())),
            "triage_file": "review-triage.jsonl",
            "triage_sha256": sha256_file(triage_path),
            "required_next_gate": "explicit-record-review-and-correction",
        }
        (staging / "review-triage-report.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return report


def validate_suggestions(
    contexts: Sequence[ReviewContext], suggestions_path: Path
) -> tuple[str, dict[str, dict[str, Any]]]:
    path = suggestions_path.resolve()
    suggestions_sha256 = sha256_file(path)
    rows = read_jsonl(path, "review suggestions")
    context_by_id = {context.record_id: context for context in contexts}
    suggestions: dict[str, dict[str, Any]] = {}
    for index, value in enumerate(rows):
        label = f"review suggestion[{index}]"
        require_exact_keys(value, SUGGESTION_KEYS, label)
        if value.get("schema") != SUGGESTION_SCHEMA:
            raise ValueError(f"{label} schema is unsupported")
        record_id = require_string(value, "id", label)
        if record_id in suggestions:
            raise ValueError(f"duplicate review suggestion id {record_id}")
        context = context_by_id.get(record_id)
        if context is None:
            raise ValueError(f"unknown review suggestion id {record_id}")
        draft_sha256 = require_sha256(
            value.get("draft_response_sha256"), f"{label}.draft_response_sha256"
        )
        if draft_sha256 != context.value["draft_response_sha256"]:
            raise ValueError(f"suggestion draft hash drift for {record_id}")
        action = require_string(value, "action", label)
        if action not in {"rewrite", "reject"}:
            raise ValueError(f"{label}.action is unsupported")
        proposed_response = value.get("proposed_response")
        if not isinstance(proposed_response, str) or "\0" in proposed_response:
            raise ValueError(f"{label}.proposed_response is invalid")
        if len(proposed_response.encode("utf-8")) > MAX_RECORD_BYTES:
            raise ValueError(f"{label}.proposed_response is too large")
        rationale = require_string(value, "rationale", label)
        if len(rationale) > 400 or any(char in rationale for char in "\r\n"):
            raise ValueError(f"{label}.rationale is invalid")
        tags = value.get("evidence_tags")
        if (
            not isinstance(tags, list)
            or not 1 <= len(tags) <= 12
            or any(
                not isinstance(tag, str)
                or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,63}", tag)
                for tag in tags
            )
            or len(tags) != len(set(tags))
        ):
            raise ValueError(f"{label}.evidence_tags are invalid")
        agent_id = require_string(value, "agent_id", label)
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{1,127}", agent_id):
            raise ValueError(f"{label}.agent_id is invalid")
        confidence = require_string(value, "confidence", label)
        if confidence not in {"high", "medium", "low"}:
            raise ValueError(f"{label}.confidence is unsupported")

        if action == "reject":
            if proposed_response:
                raise ValueError(f"rejection suggestion {record_id} must have no response")
        else:
            if not proposed_response.strip() or proposed_response.strip() != proposed_response:
                raise ValueError(f"rewrite suggestion {record_id} must be non-empty and trimmed")
            if HIDDEN_REASONING.search(proposed_response) or SECRET_MATERIAL.search(
                proposed_response
            ):
                raise ValueError(f"suggested response {record_id} contains forbidden material")
            if FALSE_CAPABILITY.search(proposed_response):
                raise ValueError(
                    f"suggested response {record_id} claims unsupported external action"
                )
            proposed_context = dict(context.value)
            proposed_context["draft_response"] = proposed_response
            findings = contract_findings(proposed_context)
            if findings:
                raise ValueError(
                    f"suggested response contract findings for {record_id}: {list(findings)}"
                )
        suggestions[record_id] = value
    return suggestions_sha256, suggestions


def pending_decision(
    context: ReviewContext, suggestion: dict[str, Any] | None
) -> dict[str, Any]:
    if suggestion is None:
        response = context.value["draft_response"]
        note = "Pending explicit review against the prompt and response contract."
    else:
        response = suggestion["proposed_response"]
        note = f"Agent suggestion pending human review: {suggestion['rationale']}"
    return {
        "id": context.record_id,
        "decision": "pending",
        "draft_response_sha256": context.value["draft_response_sha256"],
        "reviewed_response": response,
        "reviewer_id": "pending-reviewer",
        "review_note": note,
        "factuality": "pending",
        "instruction_following": "pending",
        "safety": "pending",
        "conciseness": "pending",
        "hidden_reasoning_absent": "pending",
    }


def suggestion_evidence(
    context: ReviewContext, suggestion: dict[str, Any]
) -> dict[str, Any]:
    proposed_response = suggestion["proposed_response"]
    return {
        "schema": SUGGESTION_EVIDENCE_SCHEMA,
        "id": context.record_id,
        "draft_response_sha256": context.value["draft_response_sha256"],
        "action": suggestion["action"],
        "proposed_response_sha256": sha256_bytes(proposed_response.encode("utf-8")),
        "rationale": suggestion["rationale"],
        "evidence_tags": suggestion["evidence_tags"],
        "agent_id": suggestion["agent_id"],
        "confidence": suggestion["confidence"],
        "contract_findings": [],
        "status": "pending-human-review-never-auto-approved",
    }


def write_suggested_review(
    workbook_path: Path,
    suggestions_path: Path | Sequence[Path],
    output_dir: Path,
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    identity, contexts = load_workbook(workbook_path)
    suggestion_paths = (
        (suggestions_path,)
        if isinstance(suggestions_path, Path)
        else tuple(suggestions_path)
    )
    if not suggestion_paths:
        raise ValueError("at least one review suggestion source is required")
    suggestion_sources = []
    suggestions: dict[str, dict[str, Any]] = {}
    for path in suggestion_paths:
        source_sha256, source_suggestions = validate_suggestions(contexts, path)
        duplicates = sorted(set(suggestions).intersection(source_suggestions))
        if duplicates:
            raise ValueError(f"duplicate suggestion ids across sources: {duplicates}")
        suggestions.update(source_suggestions)
        suggestion_sources.append(
            {
                "path": str(path.resolve()),
                "sha256": source_sha256,
                "suggestion_count": len(source_suggestions),
            }
        )
    decisions = [pending_decision(context, suggestions.get(context.record_id)) for context in contexts]
    evidence = [
        suggestion_evidence(context, suggestions[context.record_id])
        for context in contexts
        if context.record_id in suggestions
    ]

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        context_path = staging / "review-context.jsonl"
        context_path.write_bytes(
            b"".join(
                canonical_json_bytes(context.value) + b"\n" for context in contexts
            )
        )
        decisions_path = staging / "review-decisions.jsonl"
        decisions_path.write_bytes(
            b"".join(canonical_json_bytes(decision) + b"\n" for decision in decisions)
        )
        evidence_path = staging / "agent-suggestion-evidence.jsonl"
        evidence_path.write_bytes(
            b"".join(canonical_json_bytes(row) + b"\n" for row in evidence)
        )
        rewrite_count = sum(
            1 for suggestion in suggestions.values() if suggestion["action"] == "rewrite"
        )
        reject_count = len(suggestions) - rewrite_count
        receipt = {
            "schema": (
                SUGGESTED_REVIEW_RECEIPT_SCHEMA
                if len(suggestion_sources) == 1
                else SUGGESTED_REVIEW_RECEIPT_SCHEMA_V2
            ),
            "campaign_id": identity["campaign_id"],
            "source_workbook_path": identity["workbook_path"],
            "source_workbook_receipt_sha256": identity["receipt_sha256"],
            "draft_manifest_path": identity["draft_manifest_path"],
            "draft_manifest_sha256": identity["draft_manifest_sha256"],
            "review_context_file": context_path.name,
            "review_context_sha256": sha256_file(context_path),
            "review_decisions_file": decisions_path.name,
            "review_decisions_sha256": sha256_file(decisions_path),
            "suggestion_evidence_file": evidence_path.name,
            "suggestion_evidence_sha256": sha256_file(evidence_path),
            "record_count": len(contexts),
            "suggestion_count": len(suggestions),
            "rewrite_count": rewrite_count,
            "reject_count": reject_count,
            "untouched_count": len(contexts) - len(suggestions),
            "status": "agent-suggestions-pending-human-review-not-training-approved",
            "required_next_gate": "explicit-human-review-of-every-record",
        }
        if len(suggestion_sources) == 1:
            receipt["suggestion_source_path"] = suggestion_sources[0]["path"]
            receipt["suggestion_source_sha256"] = suggestion_sources[0]["sha256"]
        else:
            receipt["suggestion_sources"] = suggestion_sources
        (staging / "agent-assisted-review-receipt.json").write_text(
            json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return receipt


def normalized_answer_text(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", value.casefold()))


def has_consecutive_repeated_sequence(tokens: Sequence[str]) -> bool:
    for width in range(1, min(5, len(tokens) // 3) + 1):
        for start in range(0, len(tokens) - (width * 3) + 1):
            first = tokens[start : start + width]
            if not any(any(char.isalpha() for char in token) for token in first):
                continue
            if (
                first == tokens[start + width : start + (width * 2)]
                and first == tokens[start + (width * 2) : start + (width * 3)]
            ):
                return True
    return False


def response_quality_findings(
    task_family: str, prompt: str, response: str
) -> tuple[str, ...]:
    findings = []
    if not response:
        return ("agent_reject_suggestion",)
    if ROLE_PREFIX.search(response):
        findings.append("role_prefix_leakage")
    if TEMPLATE_MARKER.search(response):
        findings.append("chat_template_marker_leakage")
    if PLACEHOLDER_TEXT.search(response):
        findings.append("placeholder_text")
    if SECRET_MATERIAL.search(response):
        findings.append("secret_like_material")
    if "\ufffd" in response:
        findings.append("unicode_replacement_character")
    if MOJIBAKE.search(response):
        findings.append("mojibake_encoding_artifact")
    if any(ord(char) < 32 and char not in "\t\n" for char in response):
        findings.append("unexpected_control_character")

    words = re.findall(r"[A-Za-z0-9]+(?:['._-][A-Za-z0-9]+)*", response.casefold())
    if not words:
        findings.append("non_substantive_symbol_output")
    elif has_consecutive_repeated_sequence(words):
        findings.append("degenerate_repetition")
    normalized_prompt = normalized_answer_text(prompt)
    normalized_response = normalized_answer_text(response)
    if normalized_prompt and normalized_response == normalized_prompt:
        findings.append("prompt_echo")

    lines = [line.strip().casefold() for line in response.splitlines() if line.strip()]
    substantial_lines = [line for line in lines if len(line) >= 12]
    if len(substantial_lines) != len(set(substantial_lines)):
        findings.append("duplicate_response_line")
    return tuple(sorted(set(findings)))


def pending_answer_audit_row(answer: PendingAnswer) -> dict[str, Any]:
    response = answer.decision["reviewed_response"]
    context = dict(answer.context.value)
    context["draft_response"] = response
    contract = () if answer.origin == "agent-reject" else contract_findings(context)
    flags = list(() if answer.origin == "agent-reject" else risk_flags(context))
    if response and APOLOGY.search(response):
        flags.append("apology_language_review")
    quality = response_quality_findings(
        answer.context.value["task_family"], answer.context.value["prompt"], response
    )
    response_words = re.findall(
        r"[A-Za-z0-9]+(?:['._-][A-Za-z0-9]+)*", response.casefold()
    )
    return {
        "schema": PENDING_ANSWER_AUDIT_RECORD_SCHEMA,
        "id": answer.record_id,
        "campaign_id": answer.context.campaign_id,
        "task_family": answer.context.value["task_family"],
        "assisted_workbook_receipt_sha256": answer.assisted_receipt_sha256,
        "source_context_sha256": sha256_bytes(
            canonical_json_bytes(answer.context.value)
        ),
        "prompt_sha256": sha256_bytes(
            answer.context.value["prompt"].encode("utf-8")
        ),
        "draft_response_sha256": answer.context.value["draft_response_sha256"],
        "candidate_response_sha256": sha256_bytes(response.encode("utf-8")),
        "candidate_origin": answer.origin,
        "response_byte_count": len(response.encode("utf-8")),
        "response_word_count": len(response_words),
        "risk_flags": sorted(set(flags)),
        "contract_findings": list(contract),
        "quality_findings": list(quality),
        "status": "pending-review-audit-only-never-training-authority",
    }


def _audit_priority(row: dict[str, Any]) -> tuple[str, int]:
    flags = row["risk_flags"]
    contract = row["contract_findings"]
    quality = row["quality_findings"]
    critical_quality = {
        "chat_template_marker_leakage",
        "mojibake_encoding_artifact",
        "secret_like_material",
        "unicode_replacement_character",
        "unexpected_control_character",
    }
    score = sum(FLAG_WEIGHTS.get(flag, 10) for flag in flags)
    score += 100 * len(contract)
    score += 50 * len(quality)
    if (
        contract
        or critical_quality.intersection(quality)
        or "false_external_capability_claim" in flags
        or "hidden_reasoning_material" in flags
    ):
        return "critical", score
    if score >= 40:
        return "high", score
    if score >= 15:
        return "focused", score
    return "routine", score


def pending_linguistic_audit(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    record_count = len(rows)
    categories = {
        "refusal_language": "refusal_language_review",
        "apology": "apology_language_review",
        "disclaimer": "disclaimer_language_review",
        "false_capability": "false_external_capability_claim",
        "hidden_reasoning": "hidden_reasoning_material",
    }
    ids = {
        name: sorted(row["id"] for row in rows if flag in row["risk_flags"])
        for name, flag in categories.items()
    }

    def rate(name: str) -> float:
        return 0.0 if record_count == 0 else len(ids[name]) / record_count

    failures = []
    if rate("refusal_language") > MAX_REFUSAL_LANGUAGE_RATE:
        failures.append("refusal_language_rate")
    if rate("apology") > MAX_APOLOGY_RATE:
        failures.append("apology_rate")
    if rate("disclaimer") > MAX_DISCLAIMER_RATE:
        failures.append("disclaimer_rate")
    if len(ids["false_capability"]) > MAX_FALSE_CAPABILITY_COUNT:
        failures.append("false_capability_count")
    if len(ids["hidden_reasoning"]) > MAX_HIDDEN_REASONING_COUNT:
        failures.append("hidden_reasoning_count")
    return {
        "status": "pass" if not failures else "fail",
        "record_count": record_count,
        "policy": {
            "max_refusal_language_rate": MAX_REFUSAL_LANGUAGE_RATE,
            "max_apology_rate": MAX_APOLOGY_RATE,
            "max_disclaimer_rate": MAX_DISCLAIMER_RATE,
            "max_false_capability_count": MAX_FALSE_CAPABILITY_COUNT,
            "max_hidden_reasoning_count": MAX_HIDDEN_REASONING_COUNT,
        },
        "refusal_language_count": len(ids["refusal_language"]),
        "refusal_language_rate": round(rate("refusal_language"), 9),
        "refusal_language_ids": ids["refusal_language"],
        "apology_count": len(ids["apology"]),
        "apology_rate": round(rate("apology"), 9),
        "apology_ids": ids["apology"],
        "disclaimer_count": len(ids["disclaimer"]),
        "disclaimer_rate": round(rate("disclaimer"), 9),
        "disclaimer_ids": ids["disclaimer"],
        "false_capability_count": len(ids["false_capability"]),
        "false_capability_ids": ids["false_capability"],
        "hidden_reasoning_count": len(ids["hidden_reasoning"]),
        "hidden_reasoning_ids": ids["hidden_reasoning"],
        "failures": failures,
    }


def write_pending_answer_audit(
    workbook_paths: Sequence[Path], output_dir: Path
) -> dict[str, Any]:
    if not workbook_paths:
        raise ValueError("at least one assisted review workbook is required")
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")

    identities = []
    answers = []
    seen = set()
    for workbook_path in workbook_paths:
        identity, workbook_answers = load_assisted_workbook(workbook_path)
        identities.append(identity)
        for answer in workbook_answers:
            if answer.record_id in seen:
                raise ValueError(f"duplicate pending answer id {answer.record_id}")
            seen.add(answer.record_id)
            answers.append(answer)

    rows = [pending_answer_audit_row(answer) for answer in answers]
    exact_groups: dict[str, list[str]] = {}
    normalized_groups: dict[str, list[str]] = {}
    for answer, row in zip(answers, rows):
        if answer.origin == "agent-reject":
            continue
        response = answer.decision["reviewed_response"]
        exact_groups.setdefault(row["candidate_response_sha256"], []).append(
            answer.record_id
        )
        normalized = normalized_answer_text(response)
        normalized_sha256 = sha256_bytes(normalized.encode("utf-8"))
        normalized_groups.setdefault(normalized_sha256, []).append(answer.record_id)

    duplicate_exact = {
        key: tuple(sorted(value))
        for key, value in exact_groups.items()
        if len(value) > 1
    }
    duplicate_normalized = {
        key: tuple(sorted(value))
        for key, value in normalized_groups.items()
        if len(value) > 1
    }
    for row in rows:
        findings = set(row["quality_findings"])
        if row["candidate_response_sha256"] in duplicate_exact:
            findings.add("exact_response_duplicate")
        normalized_response = normalized_answer_text(
            next(
                answer.decision["reviewed_response"]
                for answer in answers
                if answer.record_id == row["id"]
            )
        )
        if (
            row["candidate_origin"] != "agent-reject"
            and sha256_bytes(normalized_response.encode("utf-8"))
            in duplicate_normalized
        ):
            findings.add("normalized_response_duplicate")
        row["quality_findings"] = sorted(findings)
        row["priority"], row["priority_score"] = _audit_priority(row)
    rows.sort(key=lambda row: (-row["priority_score"], row["id"]))

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        audit_path = staging / "pending-answer-audit.jsonl"
        audit_path.write_bytes(
            b"".join(canonical_json_bytes(row) + b"\n" for row in rows)
        )
        priority_counts = Counter(row["priority"] for row in rows)
        origin_counts = Counter(row["candidate_origin"] for row in rows)
        flag_counts = Counter(flag for row in rows for flag in row["risk_flags"])
        contract_counts = Counter(
            finding for row in rows for finding in row["contract_findings"]
        )
        quality_counts = Counter(
            finding for row in rows for finding in row["quality_findings"]
        )
        finding_record_count = sum(
            bool(row["contract_findings"] or row["quality_findings"])
            for row in rows
        )
        linguistic = pending_linguistic_audit(rows)
        has_findings = bool(finding_record_count or linguistic["failures"])
        report = {
            "schema": PENDING_ANSWER_AUDIT_REPORT_SCHEMA,
            "status": (
                "pending-review-findings-present-never-training-authority"
                if has_findings
                else "pending-review-audit-clear-never-training-authority"
            ),
            "input_workbooks": identities,
            "record_count": len(rows),
            "finding_record_count": finding_record_count,
            "priority_counts": dict(sorted(priority_counts.items())),
            "origin_counts": dict(sorted(origin_counts.items())),
            "risk_flag_counts": dict(sorted(flag_counts.items())),
            "contract_finding_counts": dict(sorted(contract_counts.items())),
            "quality_finding_counts": dict(sorted(quality_counts.items())),
            "linguistic_audit": linguistic,
            "exact_duplicate_groups": [
                {"response_sha256": key, "record_ids": list(value)}
                for key, value in sorted(duplicate_exact.items())
            ],
            "normalized_duplicate_groups": [
                {"normalized_response_sha256": key, "record_ids": list(value)}
                for key, value in sorted(duplicate_normalized.items())
            ],
            "audit_file": audit_path.name,
            "audit_sha256": sha256_file(audit_path),
            "contains_response_text": False,
            "contains_approval_decisions": False,
            "training_authority": False,
            "required_next_gate": "explicit-human-review-and-correction-of-every-record",
        }
        (staging / "pending-answer-audit-report.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return report


SemanticEncoder = Callable[
    [Sequence[str], Path, int, int], Sequence[Sequence[float]]
]


def encoder_identity(
    encoder_dir: Path, repo_id: str, revision: str, license_id: str
) -> tuple[Path, dict[str, Any]]:
    if encoder_dir.is_symlink():
        raise ValueError("encoder_dir must not be a symlink")
    root = encoder_dir.resolve()
    if not root.is_dir():
        raise ValueError(f"encoder_dir must be a directory: {root}")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo_id):
        raise ValueError("encoder_repo_id must be a pinned owner/repository id")
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        raise ValueError("encoder_revision must be 40 to 64 lowercase hex digits")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.+-]{1,63}", license_id):
        raise ValueError("encoder_license must be a normalized SPDX-like id")

    files = []
    for relative_name in ENCODER_REQUIRED_FILES:
        path = root / relative_name
        if not path.is_file() or path.is_symlink():
            raise ValueError(
                f"encoder file {relative_name} must be a regular non-symlink file"
            )
        size = path.stat().st_size
        if size <= 0 or size > MAX_ENCODER_FILE_BYTES:
            raise ValueError(
                f"encoder file {relative_name} byte length must be in "
                f"1..={MAX_ENCODER_FILE_BYTES}"
            )
        files.append(
            {
                "relative_path": relative_name,
                "bytes": size,
                "sha256": sha256_file(path),
            }
        )
    identity: dict[str, Any] = {
        "repo_id": repo_id,
        "revision": revision,
        "license": license_id,
        "model_dir": str(root),
        "files": files,
    }
    identity["identity_sha256"] = sha256_bytes(canonical_json_bytes(identity))
    return root, identity


def encode_prompts_with_transformers(
    texts: Sequence[str], encoder_dir: Path, max_length: int, batch_size: int
) -> Sequence[Sequence[float]]:
    try:
        import torch
        from transformers import AutoModel, AutoTokenizer
    except ImportError as error:
        raise ValueError(
            "semantic-neighbor audit requires local torch and transformers"
        ) from error

    tokenizer = AutoTokenizer.from_pretrained(
        encoder_dir, local_files_only=True, trust_remote_code=False
    )
    model = AutoModel.from_pretrained(
        encoder_dir, local_files_only=True, trust_remote_code=False
    )
    model.to("cpu")
    model.eval()
    encoded: list[tuple[float, ...]] = []
    with torch.inference_mode():
        for start in range(0, len(texts), batch_size):
            batch = list(texts[start : start + batch_size])
            tokens = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            output = model(**tokens).last_hidden_state
            mask = tokens["attention_mask"].unsqueeze(-1).to(output.dtype)
            pooled = (output * mask).sum(dim=1) / mask.sum(dim=1).clamp_min(1)
            pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
            encoded.extend(
                tuple(float(value) for value in row)
                for row in pooled.detach().cpu().tolist()
            )
    if len(encoded) != len(texts):
        raise ValueError("semantic encoder output count mismatch")
    return tuple(encoded)


def semantic_neighbor_pairs(
    record_ids: Sequence[str],
    embeddings: Sequence[Sequence[float]],
    threshold: float,
) -> tuple[dict[str, Any], ...]:
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)):
        raise ValueError("semantic threshold must be numeric")
    threshold = float(threshold)
    if not math.isfinite(threshold) or threshold <= 0.0 or threshold > 1.0:
        raise ValueError("semantic threshold must be in (0, 1]")
    if len(record_ids) != len(embeddings):
        raise ValueError("record and embedding counts differ")
    if len(set(record_ids)) != len(record_ids):
        raise ValueError("semantic audit record ids must be unique")
    if not embeddings:
        return ()

    dimension = len(embeddings[0])
    if dimension <= 0:
        raise ValueError("semantic embeddings must not be empty")
    vectors: list[tuple[float, ...]] = []
    norms: list[float] = []
    for index, raw_vector in enumerate(embeddings):
        if len(raw_vector) != dimension:
            raise ValueError("semantic embedding dimensions differ")
        vector = tuple(float(value) for value in raw_vector)
        if any(not math.isfinite(value) for value in vector):
            raise ValueError(f"semantic embedding {index} contains non-finite values")
        norm = math.sqrt(sum(value * value for value in vector))
        if norm <= 0.0 or not math.isfinite(norm):
            raise ValueError(f"semantic embedding {index} has zero or invalid norm")
        vectors.append(vector)
        norms.append(norm)

    candidates: list[tuple[float, str, str]] = []
    for left_index, left in enumerate(vectors):
        for right_index in range(left_index + 1, len(vectors)):
            right = vectors[right_index]
            score = sum(a * b for a, b in zip(left, right)) / (
                norms[left_index] * norms[right_index]
            )
            score = max(-1.0, min(1.0, score))
            if score >= threshold:
                left_id, right_id = sorted(
                    (record_ids[left_index], record_ids[right_index])
                )
                candidates.append((score, left_id, right_id))
    candidates.sort(key=lambda value: (-value[0], value[1], value[2]))
    return tuple(
        {
            "pair_id": sha256_bytes(
                canonical_json_bytes(
                    {"left_id": left_id, "right_id": right_id}
                )
            ),
            "left_id": left_id,
            "right_id": right_id,
            "cosine_similarity": round(score, 9),
        }
        for score, left_id, right_id in candidates
    )


def semantic_neighbor_clusters(
    pairs: Sequence[dict[str, Any]],
) -> tuple[dict[str, Any], ...]:
    parent: dict[str, str] = {}

    def find(record_id: str) -> str:
        parent.setdefault(record_id, record_id)
        while parent[record_id] != record_id:
            parent[record_id] = parent[parent[record_id]]
            record_id = parent[record_id]
        return record_id

    def union(left_id: str, right_id: str) -> None:
        left_root = find(left_id)
        right_root = find(right_id)
        if left_root == right_root:
            return
        first, second = sorted((left_root, right_root))
        parent[second] = first

    for pair in pairs:
        union(pair["left_id"], pair["right_id"])

    components: dict[str, list[str]] = {}
    for record_id in sorted(parent):
        components.setdefault(find(record_id), []).append(record_id)
    clusters = []
    for record_ids in sorted(components.values(), key=lambda value: tuple(value)):
        record_set = set(record_ids)
        cluster_pairs = [
            pair
            for pair in pairs
            if pair["left_id"] in record_set and pair["right_id"] in record_set
        ]
        cluster_identity = sha256_bytes(canonical_json_bytes(record_ids))
        clusters.append(
            {
                "cluster_id": f"semantic-neighbor-{cluster_identity[7:23]}",
                "record_ids": record_ids,
                "record_count": len(record_ids),
                "pair_count": len(cluster_pairs),
                "max_cosine_similarity": max(
                    pair["cosine_similarity"] for pair in cluster_pairs
                ),
            }
        )
    return tuple(clusters)


def write_semantic_neighbor_audit(
    workbook_paths: Sequence[Path],
    output_dir: Path,
    encoder_dir: Path,
    encoder_repo_id: str,
    encoder_revision: str,
    encoder_license: str,
    threshold: float,
    max_length: int,
    batch_size: int,
    encoder: SemanticEncoder = encode_prompts_with_transformers,
) -> dict[str, Any]:
    if not workbook_paths:
        raise ValueError("at least one assisted review workbook is required")
    max_length = require_integer(max_length, "encoder_max_length", 8, 512)
    batch_size = require_integer(batch_size, "encoder_batch_size", 1, 512)
    encoder_root, identity = encoder_identity(
        encoder_dir, encoder_repo_id, encoder_revision, encoder_license
    )
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")

    identities = []
    answers: list[PendingAnswer] = []
    by_id: dict[str, PendingAnswer] = {}
    for workbook_path in workbook_paths:
        workbook_identity, workbook_answers = load_assisted_workbook(workbook_path)
        identities.append(workbook_identity)
        for answer in workbook_answers:
            if answer.record_id in by_id:
                raise ValueError(f"duplicate pending answer id {answer.record_id}")
            by_id[answer.record_id] = answer
            answers.append(answer)

    prompts = [answer.context.value["prompt"] for answer in answers]
    embeddings = encoder(prompts, encoder_root, max_length, batch_size)
    raw_pairs = semantic_neighbor_pairs(
        [answer.record_id for answer in answers], embeddings, threshold
    )
    rows = []
    for pair in raw_pairs:
        left = by_id[pair["left_id"]]
        right = by_id[pair["right_id"]]
        left_prompt = left.context.value["prompt"]
        right_prompt = right.context.value["prompt"]
        rows.append(
            {
                "schema": SEMANTIC_NEIGHBOR_AUDIT_RECORD_SCHEMA,
                **pair,
                "left_campaign_id": left.context.campaign_id,
                "right_campaign_id": right.context.campaign_id,
                "left_task_family": left.context.value["task_family"],
                "right_task_family": right.context.value["task_family"],
                "left_candidate_origin": left.origin,
                "right_candidate_origin": right.origin,
                "left_prompt_sha256": sha256_bytes(left_prompt.encode("utf-8")),
                "right_prompt_sha256": sha256_bytes(right_prompt.encode("utf-8")),
                "normalized_exact_match": (
                    normalized_answer_text(left_prompt)
                    == normalized_answer_text(right_prompt)
                ),
                "status": "semantic-neighbor-review-required-never-auto-rejected",
            }
        )
    clusters = []
    for raw_cluster in semantic_neighbor_clusters(rows):
        cluster = dict(raw_cluster)
        cluster_answers = [by_id[record_id] for record_id in cluster["record_ids"]]
        cluster_origins = Counter(answer.origin for answer in cluster_answers)
        cluster["candidate_origin_counts"] = dict(sorted(cluster_origins.items()))
        cluster["proposed_reject_record_ids"] = sorted(
            answer.record_id
            for answer in cluster_answers
            if answer.origin == "agent-reject"
        )
        clusters.append(cluster)
    neighbor_ids = sorted(
        {row[side] for row in rows for side in ("left_id", "right_id")}
    )
    neighbor_origin_counts = Counter(by_id[record_id].origin for record_id in neighbor_ids)
    proposed_reject_neighbor_ids = sorted(
        record_id
        for record_id in neighbor_ids
        if by_id[record_id].origin == "agent-reject"
    )

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        audit_path = staging / "semantic-neighbor-audit.jsonl"
        audit_path.write_bytes(
            b"".join(canonical_json_bytes(row) + b"\n" for row in rows)
        )
        report = {
            "schema": SEMANTIC_NEIGHBOR_AUDIT_REPORT_SCHEMA,
            "status": (
                "semantic-neighbors-require-human-review-never-training-authority"
                if rows
                else "semantic-neighbor-audit-clear-never-training-authority"
            ),
            "input_workbooks": identities,
            "record_count": len(answers),
            "semantic_threshold": float(threshold),
            "semantic_pair_count": len(rows),
            "semantic_neighbor_record_count": len(neighbor_ids),
            "normalized_exact_pair_count": sum(
                row["normalized_exact_match"] for row in rows
            ),
            "cluster_count": len(clusters),
            "clusters": clusters,
            "semantic_neighbor_origin_counts": dict(
                sorted(neighbor_origin_counts.items())
            ),
            "proposed_reject_neighbor_record_count": len(
                proposed_reject_neighbor_ids
            ),
            "clusters_with_proposed_rejects": sum(
                bool(cluster["proposed_reject_record_ids"])
                for cluster in clusters
            ),
            "encoder": {
                **identity,
                "max_length": max_length,
                "batch_size": batch_size,
                "pooling": "attention-mask-mean-pooling-plus-l2-normalization",
                "device": "cpu",
            },
            "audit_file": audit_path.name,
            "audit_sha256": sha256_file(audit_path),
            "contains_prompt_text": False,
            "contains_response_text": False,
            "contains_approval_decisions": False,
            "automatic_rejection_count": 0,
            "training_authority": False,
            "required_next_gate": "explicit-human-review-of-each-semantic-neighbor-cluster",
        }
        (staging / "semantic-neighbor-audit-report.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return report


def load_unique_assisted_workbooks(
    workbook_paths: Sequence[Path],
) -> tuple[list[dict[str, Any]], tuple[PendingAnswer, ...]]:
    if not workbook_paths:
        raise ValueError("at least one assisted review workbook is required")
    loaded = [load_assisted_workbook(path) for path in workbook_paths]
    loaded.sort(
        key=lambda value: (
            value[0]["campaign_id"],
            value[0]["workbook_path"],
            value[0]["receipt_sha256"],
        )
    )
    identities: list[dict[str, Any]] = []
    answers: list[PendingAnswer] = []
    seen_ids: set[str] = set()
    seen_campaigns: set[str] = set()
    seen_receipts: set[str] = set()
    for identity, workbook_answers in loaded:
        campaign_id = identity["campaign_id"]
        if campaign_id in seen_campaigns:
            raise ValueError(f"duplicate assisted campaign id {campaign_id}")
        if identity["receipt_sha256"] in seen_receipts:
            raise ValueError("duplicate assisted workbook receipt SHA-256")
        seen_campaigns.add(campaign_id)
        seen_receipts.add(identity["receipt_sha256"])
        identities.append(identity)
        for answer in workbook_answers:
            if answer.record_id in seen_ids:
                raise ValueError(f"duplicate pending answer id {answer.record_id}")
            seen_ids.add(answer.record_id)
            answers.append(answer)
    return identities, tuple(answers)


def require_json_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{label} must be a JSON array")
    return value


def load_semantic_audit_for_handoff(
    audit_dir: Path,
    workbook_identities: Sequence[dict[str, Any]],
    answers: Sequence[PendingAnswer],
) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    root = audit_dir.resolve()
    if not root.is_dir() or root.is_symlink():
        raise ValueError(f"semantic audit must be a non-symlink directory: {root}")
    report_path = root / "semantic-neighbor-audit-report.json"
    report = read_json_object(report_path, MAX_RECEIPT_BYTES, "semantic audit report")
    require_exact_keys(report, SEMANTIC_REPORT_KEYS, "semantic audit report")
    if report.get("schema") != SEMANTIC_NEIGHBOR_AUDIT_REPORT_SCHEMA:
        raise ValueError("semantic audit report schema is unsupported")
    if report.get("training_authority") is not False:
        raise ValueError("semantic audit must not claim training authority")
    for field in (
        "contains_prompt_text",
        "contains_response_text",
        "contains_approval_decisions",
    ):
        if report.get(field) is not False:
            raise ValueError(f"semantic audit {field} must be false")
    if report.get("automatic_rejection_count") != 0:
        raise ValueError("semantic audit must not contain automatic rejections")
    if report.get("required_next_gate") != (
        "explicit-human-review-of-each-semantic-neighbor-cluster"
    ):
        raise ValueError("semantic audit next gate is unsupported")

    expected_workbooks = {
        identity["receipt_sha256"]: identity for identity in workbook_identities
    }
    observed_workbooks: dict[str, dict[str, Any]] = {}
    for index, value in enumerate(
        require_json_list(report.get("input_workbooks"), "semantic input_workbooks")
    ):
        label = f"semantic input_workbooks[{index}]"
        if not isinstance(value, dict):
            raise ValueError(f"{label} must be an object")
        require_exact_keys(value, ASSISTED_IDENTITY_KEYS, label)
        receipt_sha256 = require_sha256(value.get("receipt_sha256"), f"{label}.receipt_sha256")
        if receipt_sha256 in observed_workbooks:
            raise ValueError("semantic audit repeats an assisted workbook")
        observed_workbooks[receipt_sha256] = value
    if observed_workbooks != expected_workbooks:
        raise ValueError("semantic audit assisted workbook identities do not match")

    answer_by_id = {answer.record_id: answer for answer in answers}
    record_count = require_integer(
        report.get("record_count"), "semantic record_count", 1, 1_000_000
    )
    if record_count != len(answer_by_id):
        raise ValueError("semantic audit record count does not match the handoff")
    threshold = report.get("semantic_threshold")
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)):
        raise ValueError("semantic threshold must be numeric")
    threshold = float(threshold)
    if not math.isfinite(threshold) or threshold <= 0.0 or threshold > 1.0:
        raise ValueError("semantic threshold must be in (0, 1]")

    audit_path = safe_workbook_file(
        root,
        require_string(report, "audit_file", "semantic audit report"),
        "semantic audit_file",
    )
    audit_sha256 = require_sha256(report.get("audit_sha256"), "semantic audit_sha256")
    if sha256_file(audit_path) != audit_sha256:
        raise ValueError("semantic audit JSONL SHA-256 drift")
    rows = read_editable_jsonl(audit_path, "semantic neighbor audit")
    expected_pair_count = require_integer(
        report.get("semantic_pair_count"), "semantic_pair_count", 0, 10_000_000
    )
    if len(rows) != expected_pair_count:
        raise ValueError("semantic audit pair count drift")

    seen_pairs: set[str] = set()
    for index, row in enumerate(rows):
        label = f"semantic neighbor[{index}]"
        require_exact_keys(row, SEMANTIC_RECORD_KEYS, label)
        if row.get("schema") != SEMANTIC_NEIGHBOR_AUDIT_RECORD_SCHEMA:
            raise ValueError(f"{label} schema is unsupported")
        left_id = require_string(row, "left_id", label)
        right_id = require_string(row, "right_id", label)
        if left_id >= right_id or left_id not in answer_by_id or right_id not in answer_by_id:
            raise ValueError(f"{label} record identities are invalid")
        pair_id = require_sha256(row.get("pair_id"), f"{label}.pair_id")
        expected_pair_id = sha256_bytes(
            canonical_json_bytes({"left_id": left_id, "right_id": right_id})
        )
        if pair_id != expected_pair_id or pair_id in seen_pairs:
            raise ValueError(f"{label} pair identity drift")
        seen_pairs.add(pair_id)
        score = row.get("cosine_similarity")
        if isinstance(score, bool) or not isinstance(score, (int, float)):
            raise ValueError(f"{label}.cosine_similarity must be numeric")
        score = float(score)
        if not math.isfinite(score) or score < threshold - 1e-9 or score > 1.0:
            raise ValueError(f"{label}.cosine_similarity is outside the audit threshold")
        left = answer_by_id[left_id]
        right = answer_by_id[right_id]
        for side, answer in (("left", left), ("right", right)):
            prompt = answer.context.value["prompt"]
            expected = {
                f"{side}_campaign_id": answer.context.campaign_id,
                f"{side}_task_family": answer.context.value["task_family"],
                f"{side}_candidate_origin": answer.origin,
                f"{side}_prompt_sha256": sha256_bytes(prompt.encode("utf-8")),
            }
            for field, expected_value in expected.items():
                if row.get(field) != expected_value:
                    raise ValueError(f"{label}.{field} drift")
        normalized_match = (
            normalized_answer_text(left.context.value["prompt"])
            == normalized_answer_text(right.context.value["prompt"])
        )
        if row.get("normalized_exact_match") is not normalized_match:
            raise ValueError(f"{label}.normalized_exact_match drift")
        if row.get("status") != (
            "semantic-neighbor-review-required-never-auto-rejected"
        ):
            raise ValueError(f"{label}.status is unsupported")

    clusters = []
    for raw_cluster in semantic_neighbor_clusters(rows):
        cluster = dict(raw_cluster)
        cluster_answers = [answer_by_id[record_id] for record_id in cluster["record_ids"]]
        cluster["candidate_origin_counts"] = dict(
            sorted(Counter(answer.origin for answer in cluster_answers).items())
        )
        cluster["proposed_reject_record_ids"] = sorted(
            answer.record_id
            for answer in cluster_answers
            if answer.origin == "agent-reject"
        )
        clusters.append(cluster)
    observed_clusters = require_json_list(report.get("clusters"), "semantic clusters")
    for index, cluster in enumerate(observed_clusters):
        if not isinstance(cluster, dict):
            raise ValueError(f"semantic clusters[{index}] must be an object")
        require_exact_keys(cluster, SEMANTIC_CLUSTER_KEYS, f"semantic clusters[{index}]")
    if observed_clusters != clusters:
        raise ValueError("semantic audit cluster identities drift")
    if report.get("cluster_count") != len(clusters):
        raise ValueError("semantic audit cluster count drift")

    neighbor_ids = sorted(
        {row[side] for row in rows for side in ("left_id", "right_id")}
    )
    if report.get("semantic_neighbor_record_count") != len(neighbor_ids):
        raise ValueError("semantic neighbor record count drift")
    if report.get("normalized_exact_pair_count") != sum(
        bool(row["normalized_exact_match"]) for row in rows
    ):
        raise ValueError("semantic normalized-exact count drift")
    origin_counts = dict(
        sorted(Counter(answer_by_id[record_id].origin for record_id in neighbor_ids).items())
    )
    if report.get("semantic_neighbor_origin_counts") != origin_counts:
        raise ValueError("semantic neighbor origin counts drift")
    proposed_reject_ids = {
        record_id
        for record_id in neighbor_ids
        if answer_by_id[record_id].origin == "agent-reject"
    }
    if report.get("proposed_reject_neighbor_record_count") != len(proposed_reject_ids):
        raise ValueError("semantic proposed-reject count drift")
    if report.get("clusters_with_proposed_rejects") != sum(
        bool(cluster["proposed_reject_record_ids"]) for cluster in clusters
    ):
        raise ValueError("semantic proposed-reject cluster count drift")

    report_sha256 = sha256_file(report_path)
    identity = {
        "path": str(root),
        "report_sha256": report_sha256,
        "audit_sha256": audit_sha256,
        "semantic_threshold": threshold,
        "record_count": record_count,
        "semantic_pair_count": len(rows),
        "cluster_count": len(clusters),
    }
    references: dict[str, list[dict[str, Any]]] = {}
    for cluster in clusters:
        reference = {
            "audit_report_sha256": report_sha256,
            "cluster_id": cluster["cluster_id"],
            "record_ids": cluster["record_ids"],
            "pair_count": cluster["pair_count"],
            "max_cosine_similarity": cluster["max_cosine_similarity"],
            "semantic_threshold": threshold,
        }
        for record_id in cluster["record_ids"]:
            references.setdefault(record_id, []).append(reference)
    return identity, references


def human_review_base_records(
    answers: Sequence[PendingAnswer],
    semantic_references: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    rows = []
    for answer in answers:
        context = answer.context
        triage = triage_record(context)
        candidate_response = answer.decision["reviewed_response"]
        if answer.evidence is None:
            candidate_action = "retain-original"
        else:
            candidate_action = answer.evidence["action"]
        rows.append(
            {
                "id": answer.record_id,
                "campaign_id": context.campaign_id,
                "task_family": context.value["task_family"],
                "source_workbook_receipt_sha256": context.receipt_sha256,
                "assisted_workbook_receipt_sha256": answer.assisted_receipt_sha256,
                "context_sha256": sha256_bytes(canonical_json_bytes(context.value)),
                "draft_response_sha256": context.value["draft_response_sha256"],
                "candidate_response_sha256": sha256_bytes(
                    candidate_response.encode("utf-8")
                ),
                "priority": triage["priority"],
                "priority_score": triage["priority_score"],
                "risk_flags": triage["flags"],
                "contract_findings": triage["contract_findings"],
                "prompt": context.value["prompt"],
                "response_requirements": context.value["response_requirements"],
                "max_tokens": context.value["max_tokens"],
                "finish_reason": context.value["finish_reason"],
                "original_draft_response": context.value["draft_response"],
                "candidate_action": candidate_action,
                "candidate_origin": answer.origin,
                "candidate_response": candidate_response,
                "agent_evidence": answer.evidence,
                "semantic_clusters": sorted(
                    semantic_references.get(answer.record_id, []),
                    key=lambda value: (
                        value["audit_report_sha256"],
                        value["cluster_id"],
                    ),
                ),
            }
        )
    priority_order = {"critical": 0, "high": 1, "focused": 2, "routine": 3}
    rows.sort(
        key=lambda row: (
            priority_order[row["priority"]],
            -row["priority_score"],
            row["campaign_id"],
            row["id"],
        )
    )
    return rows


def jsonl_bytes(rows: Iterable[dict[str, Any]]) -> bytes:
    return b"".join(canonical_json_bytes(row) + b"\n" for row in rows)


def human_review_decision_template(review_row: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": HUMAN_REVIEW_DECISION_SCHEMA,
        "batch_id": review_row["batch_id"],
        "id": review_row["id"],
        "source_workbook_receipt_sha256": review_row[
            "source_workbook_receipt_sha256"
        ],
        "assisted_workbook_receipt_sha256": review_row[
            "assisted_workbook_receipt_sha256"
        ],
        "context_sha256": review_row["context_sha256"],
        "draft_response_sha256": review_row["draft_response_sha256"],
        "candidate_response_sha256": review_row["candidate_response_sha256"],
        "action": "pending",
        "reviewed_response": review_row["candidate_response"],
        "reviewer_id": "pending-reviewer",
        "review_note": (
            "Pending explicit human review; candidate text is editable material only."
        ),
        "factuality": "pending",
        "instruction_following": "pending",
        "safety": "pending",
        "conciseness": "pending",
        "hidden_reasoning_absent": "pending",
    }


def materialize_human_review_batches(
    base_rows: Sequence[dict[str, Any]], batch_size: int
) -> list[dict[str, Any]]:
    batch_size = require_integer(batch_size, "batch_size", 1, 250)
    batches = []
    for batch_offset in range(0, len(base_rows), batch_size):
        batch_index = (batch_offset // batch_size) + 1
        source_rows = base_rows[batch_offset : batch_offset + batch_size]
        record_ids = [row["id"] for row in source_rows]
        batch_identity = sha256_bytes(
            canonical_json_bytes(
                {
                    "batch_index": batch_index,
                    "record_ids": record_ids,
                    "bindings": [
                        {
                            "id": row["id"],
                            "context_sha256": row["context_sha256"],
                            "candidate_response_sha256": row[
                                "candidate_response_sha256"
                            ],
                            "assisted_workbook_receipt_sha256": row[
                                "assisted_workbook_receipt_sha256"
                            ],
                        }
                        for row in source_rows
                    ],
                }
            )
        )
        batch_id = f"human-review-{batch_index:04d}-{batch_identity[7:19]}"
        review_rows = []
        for record_offset, base_row in enumerate(source_rows, 1):
            review_rows.append(
                {
                    "schema": HUMAN_REVIEW_RECORD_SCHEMA,
                    "batch_id": batch_id,
                    "batch_index": batch_index,
                    "record_index": record_offset,
                    **base_row,
                    "status": "pending-explicit-human-review-never-auto-approved",
                }
            )
        decision_rows = [human_review_decision_template(row) for row in review_rows]
        review_payload = jsonl_bytes(review_rows)
        decision_payload = jsonl_bytes(decision_rows)
        batches.append(
            {
                "batch_id": batch_id,
                "batch_index": batch_index,
                "review_rows": review_rows,
                "review_payload": review_payload,
                "decision_rows": decision_rows,
                "decision_payload": decision_payload,
                "descriptor": {
                    "batch_id": batch_id,
                    "batch_index": batch_index,
                    "record_count": len(review_rows),
                    "record_ids_sha256": sha256_bytes(
                        canonical_json_bytes(record_ids)
                    ),
                    "review_file": f"review-batch-{batch_index:04d}.jsonl",
                    "review_sha256": sha256_bytes(review_payload),
                    "decision_file": f"decision-batch-{batch_index:04d}.jsonl",
                    "initial_decision_sha256": sha256_bytes(decision_payload),
                    "status": "pending-explicit-human-review",
                },
            }
        )
    return batches


def write_human_review_handoff(
    workbook_paths: Sequence[Path],
    output_dir: Path,
    batch_size: int = 25,
    semantic_audit_dirs: Sequence[Path] = (),
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    batch_size = require_integer(batch_size, "batch_size", 1, 250)
    identities, answers = load_unique_assisted_workbooks(workbook_paths)

    semantic_identities = []
    semantic_references: dict[str, list[dict[str, Any]]] = {}
    seen_semantic_reports: set[str] = set()
    for audit_dir in sorted((path.resolve() for path in semantic_audit_dirs), key=str):
        identity, references = load_semantic_audit_for_handoff(
            audit_dir, identities, answers
        )
        if identity["report_sha256"] in seen_semantic_reports:
            raise ValueError("duplicate semantic audit report SHA-256")
        seen_semantic_reports.add(identity["report_sha256"])
        semantic_identities.append(identity)
        for record_id, values in references.items():
            semantic_references.setdefault(record_id, []).extend(values)

    base_rows = human_review_base_records(answers, semantic_references)
    batches = materialize_human_review_batches(base_rows, batch_size)
    record_ids = [row["id"] for row in base_rows]
    manifest = {
        "schema": HUMAN_REVIEW_HANDOFF_SCHEMA,
        "status": (
            "human-review-batches-pending-explicit-decisions-not-training-approved"
        ),
        "input_workbooks": identities,
        "semantic_audits": semantic_identities,
        "record_count": len(base_rows),
        "batch_size": batch_size,
        "batch_count": len(batches),
        "batches": [batch["descriptor"] for batch in batches],
        "all_record_ids_sha256": sha256_bytes(canonical_json_bytes(record_ids)),
        "resolved_decision_count": 0,
        "training_authority": False,
        "required_next_gate": "explicit-human-review-of-every-batch-record",
    }

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        for batch in batches:
            descriptor = batch["descriptor"]
            (staging / descriptor["review_file"]).write_bytes(batch["review_payload"])
            (staging / descriptor["decision_file"]).write_bytes(
                batch["decision_payload"]
            )
        (staging / "human-review-handoff-manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return manifest


def validate_human_review_decision_binding(
    value: dict[str, Any], review_row: dict[str, Any]
) -> None:
    label = f"human review decision {review_row['id']}"
    require_exact_keys(value, HUMAN_REVIEW_DECISION_KEYS, label)
    if value.get("schema") != HUMAN_REVIEW_DECISION_SCHEMA:
        raise ValueError(f"{label} schema is unsupported")
    for field in (
        "batch_id",
        "id",
        "source_workbook_receipt_sha256",
        "assisted_workbook_receipt_sha256",
        "context_sha256",
        "draft_response_sha256",
    ):
        if value.get(field) != review_row[field]:
            raise ValueError(f"{label} {field} drift")
    candidate_sha256 = require_sha256(
        value.get("candidate_response_sha256"),
        f"{label}.candidate_response_sha256",
    )
    if candidate_sha256 != review_row["candidate_response_sha256"]:
        raise ValueError(f"{label} candidate response SHA-256 drift")


def validate_completed_human_review_decision(
    value: dict[str, Any],
    review_row: dict[str, Any],
    answer: PendingAnswer,
) -> tuple[str, dict[str, Any]]:
    validate_human_review_decision_binding(value, review_row)
    label = f"human review decision {review_row['id']}"

    action = require_string(value, "action", label)
    if action == "pending":
        raise ValueError(f"{label} must explicitly resolve action")
    if action not in {"approve", "rewrite", "reject"}:
        raise ValueError(f"{label} action is unsupported")
    reviewer_id = require_string(value, "reviewer_id", label)
    if (
        len(reviewer_id) > 128
        or any(
            not (char.isascii() and (char.isalnum() or char in "._-"))
            for char in reviewer_id
        )
    ):
        raise ValueError(f"{label}.reviewer_id must be a stable ASCII slug")
    if reviewer_id.casefold() in PLACEHOLDER_REVIEWER_IDS:
        raise ValueError(f"{label} reviewer_id is still a placeholder")
    review_note = require_string(value, "review_note", label)
    if (
        len(review_note) < 8
        or len(review_note) > 512
        or any(char in review_note for char in "\r\n\0")
        or review_note.startswith("Pending explicit human review")
    ):
        raise ValueError(f"{label}.review_note must contain explicit review evidence")

    checklist = {field: value.get(field) for field in PENDING_FIELDS}
    allowed_checklist = {"pass", "fail", "not-applicable"}
    invalid = sorted(
        field for field, state in checklist.items() if state not in allowed_checklist
    )
    if invalid:
        raise ValueError(f"{label} has unresolved or invalid checklist fields: {invalid}")
    if action in {"approve", "rewrite"} and any(
        state != "pass" for state in checklist.values()
    ):
        raise ValueError(f"{label} must pass every checklist field")
    if action == "reject" and "fail" not in checklist.values():
        raise ValueError(f"{label} rejection must identify at least one failed checklist field")

    reviewed_response = value.get("reviewed_response")
    if not isinstance(reviewed_response, str) or "\0" in reviewed_response:
        raise ValueError(f"{label}.reviewed_response is invalid")
    if len(reviewed_response.encode("utf-8")) > MAX_RECORD_BYTES:
        raise ValueError(f"{label}.reviewed_response is too large")
    candidate_response = review_row["candidate_response"]
    if action == "approve":
        if not reviewed_response or reviewed_response != candidate_response:
            raise ValueError(
                f"{label} approve must preserve the non-empty candidate response exactly"
            )
    elif action == "rewrite":
        if (
            not reviewed_response
            or reviewed_response.strip() != reviewed_response
            or reviewed_response == candidate_response
        ):
            raise ValueError(
                f"{label} rewrite must provide a distinct non-empty trimmed response"
            )
    elif reviewed_response:
        raise ValueError(f"{label} reject must not carry a training response")

    if action in {"approve", "rewrite"}:
        if HIDDEN_REASONING.search(reviewed_response) or SECRET_MATERIAL.search(
            reviewed_response
        ):
            raise ValueError(f"{label} response contains forbidden material")
        if FALSE_CAPABILITY.search(reviewed_response):
            raise ValueError(f"{label} response claims unsupported external action")
        proposed_context = dict(answer.context.value)
        proposed_context["draft_response"] = reviewed_response
        findings = contract_findings(proposed_context)
        if findings:
            raise ValueError(f"{label} response contract findings: {list(findings)}")

    downstream = {
        "id": review_row["id"],
        "decision": "rejected" if action == "reject" else "approved",
        "draft_response_sha256": review_row["draft_response_sha256"],
        "reviewed_response": reviewed_response,
        "reviewer_id": reviewer_id,
        "review_note": review_note,
        **checklist,
    }
    return action, downstream


def load_human_review_handoff_state(handoff_dir: Path) -> HumanReviewHandoffState:
    handoff = handoff_dir.resolve()
    if not handoff.is_dir() or handoff.is_symlink():
        raise ValueError(f"human review handoff must be a non-symlink directory: {handoff}")
    manifest_path = handoff / "human-review-handoff-manifest.json"
    manifest = read_json_object(
        manifest_path, MAX_RECEIPT_BYTES, "human review handoff manifest"
    )
    require_exact_keys(manifest, HUMAN_REVIEW_MANIFEST_KEYS, "human review handoff manifest")
    if manifest.get("schema") != HUMAN_REVIEW_HANDOFF_SCHEMA:
        raise ValueError("human review handoff schema is unsupported")
    if manifest.get("status") != (
        "human-review-batches-pending-explicit-decisions-not-training-approved"
    ):
        raise ValueError("human review handoff is not pending explicit decisions")
    if manifest.get("resolved_decision_count") != 0:
        raise ValueError("human review handoff must begin with zero resolved decisions")
    if manifest.get("training_authority") is not False:
        raise ValueError("human review handoff must not claim training authority")
    if manifest.get("required_next_gate") != (
        "explicit-human-review-of-every-batch-record"
    ):
        raise ValueError("human review handoff next gate is unsupported")

    raw_workbooks = require_json_list(
        manifest.get("input_workbooks"), "human review input_workbooks"
    )
    if not raw_workbooks:
        raise ValueError("human review input_workbooks must not be empty")
    workbook_paths = []
    for index, identity in enumerate(raw_workbooks):
        label = f"human review input_workbooks[{index}]"
        if not isinstance(identity, dict):
            raise ValueError(f"{label} must be an object")
        require_exact_keys(identity, ASSISTED_IDENTITY_KEYS, label)
        workbook_paths.append(Path(require_string(identity, "workbook_path", label)))
    identities, answers = load_unique_assisted_workbooks(workbook_paths)
    if identities != raw_workbooks:
        raise ValueError("human review assisted workbook identities drift")

    semantic_identities = []
    semantic_references: dict[str, list[dict[str, Any]]] = {}
    raw_semantic = require_json_list(
        manifest.get("semantic_audits"), "human review semantic_audits"
    )
    for index, stored_identity in enumerate(raw_semantic):
        label = f"human review semantic_audits[{index}]"
        if not isinstance(stored_identity, dict):
            raise ValueError(f"{label} must be an object")
        require_exact_keys(stored_identity, SEMANTIC_IDENTITY_KEYS, label)
        identity, references = load_semantic_audit_for_handoff(
            Path(require_string(stored_identity, "path", label)), identities, answers
        )
        semantic_identities.append(identity)
        for record_id, values in references.items():
            semantic_references.setdefault(record_id, []).extend(values)
    if semantic_identities != raw_semantic:
        raise ValueError("human review semantic audit identities drift")

    batch_size = require_integer(manifest.get("batch_size"), "batch_size", 1, 250)
    base_rows = human_review_base_records(answers, semantic_references)
    expected_batches = materialize_human_review_batches(base_rows, batch_size)
    record_count = require_integer(
        manifest.get("record_count"), "human review record_count", 1, 1_000_000
    )
    if record_count != len(base_rows):
        raise ValueError("human review record count drift")
    if manifest.get("batch_count") != len(expected_batches):
        raise ValueError("human review batch count drift")
    if manifest.get("all_record_ids_sha256") != sha256_bytes(
        canonical_json_bytes([row["id"] for row in base_rows])
    ):
        raise ValueError("human review all-record identity drift")
    raw_batches = require_json_list(manifest.get("batches"), "human review batches")
    expected_descriptors = [batch["descriptor"] for batch in expected_batches]
    for index, descriptor in enumerate(raw_batches):
        if not isinstance(descriptor, dict):
            raise ValueError(f"human review batches[{index}] must be an object")
        require_exact_keys(
            descriptor, HUMAN_REVIEW_BATCH_KEYS, f"human review batches[{index}]"
        )
    if raw_batches != expected_descriptors:
        raise ValueError("human review batch manifest drift")

    decision_rows_by_batch = []
    decision_sha256s = []
    for batch, descriptor in zip(expected_batches, raw_batches):
        review_path = safe_workbook_file(
            handoff, descriptor["review_file"], "human review batch file"
        )
        if sha256_file(review_path) != descriptor["review_sha256"]:
            raise ValueError("immutable review batch SHA-256 drift")
        observed_review_rows = read_jsonl(review_path, "human review batch")
        if observed_review_rows != batch["review_rows"]:
            raise ValueError("immutable review batch content drift")
        for index, row in enumerate(observed_review_rows):
            require_exact_keys(
                row, HUMAN_REVIEW_RECORD_KEYS, f"human review record[{index}]"
            )

        decision_path = safe_workbook_file(
            handoff, descriptor["decision_file"], "human review decision file"
        )
        if descriptor["initial_decision_sha256"] != sha256_bytes(
            batch["decision_payload"]
        ):
            raise ValueError("human review initial decision template identity drift")
        decision_rows = read_editable_jsonl(decision_path, "human review decisions")
        expected_ids = [row["id"] for row in batch["review_rows"]]
        observed_ids = [row.get("id") for row in decision_rows]
        invalid_id_rows = [
            index for index, record_id in enumerate(observed_ids) if not isinstance(record_id, str)
        ]
        if invalid_id_rows:
            raise ValueError(
                "review decision coverage mismatch; "
                f"invalid_id_rows={invalid_id_rows}"
            )
        duplicate_ids = sorted(
            record_id
            for record_id, count in Counter(observed_ids).items()
            if count > 1
        )
        missing = sorted(set(expected_ids) - set(observed_ids))
        unknown = sorted(set(observed_ids) - set(expected_ids))
        if missing or unknown or duplicate_ids:
            raise ValueError(
                "review decision coverage mismatch; "
                f"missing={missing}; unknown={unknown}; duplicates={duplicate_ids}"
            )
        if observed_ids != expected_ids:
            raise ValueError("review decision order mismatch")
        decision_rows_by_batch.append(tuple(decision_rows))
        decision_sha256s.append(sha256_file(decision_path))

    return HumanReviewHandoffState(
        handoff=handoff,
        manifest_path=manifest_path,
        manifest=manifest,
        identities=tuple(identities),
        answers=answers,
        expected_batches=tuple(expected_batches),
        decision_rows=tuple(decision_rows_by_batch),
        decision_sha256s=tuple(decision_sha256s),
    )


def human_review_progress_report(
    state: HumanReviewHandoffState,
) -> dict[str, Any]:
    """Build a text-free progress report from a fully validated handoff state."""
    answer_by_id = {answer.record_id: answer for answer in state.answers}
    action_counts: Counter[str] = Counter()
    reviewers: set[str] = set()
    batch_reports = []

    for batch, descriptor, decisions, decision_sha256 in zip(
        state.expected_batches,
        state.manifest["batches"],
        state.decision_rows,
        state.decision_sha256s,
    ):
        batch_counts: Counter[str] = Counter()
        for decision, review_row in zip(decisions, batch["review_rows"]):
            if decision.get("action") == "pending":
                validate_human_review_decision_binding(decision, review_row)
                if decision != human_review_decision_template(review_row):
                    raise ValueError(
                        f"human review decision {review_row['id']} is a partially "
                        "edited pending decision; restore the template or explicitly "
                        "resolve its action"
                    )
                action = "pending"
            else:
                action, downstream = validate_completed_human_review_decision(
                    decision, review_row, answer_by_id[review_row["id"]]
                )
                reviewers.add(downstream["reviewer_id"])
            batch_counts[action] += 1
            action_counts[action] += 1
        batch_resolved = sum(
            batch_counts[action] for action in ("approve", "rewrite", "reject")
        )
        batch_reports.append(
            {
                "batch_id": descriptor["batch_id"],
                "batch_index": descriptor["batch_index"],
                "record_count": descriptor["record_count"],
                "decision_file": descriptor["decision_file"],
                "initial_decision_sha256": descriptor["initial_decision_sha256"],
                "current_decision_sha256": decision_sha256,
                "pending_count": batch_counts["pending"],
                "approved_count": batch_counts["approve"],
                "rewritten_count": batch_counts["rewrite"],
                "rejected_count": batch_counts["reject"],
                "resolved_count": batch_resolved,
                "status": (
                    "explicit-review-complete-ready-for-merge"
                    if batch_counts["pending"] == 0
                    else "explicit-review-in-progress"
                ),
            }
        )

    resolved_count = sum(
        action_counts[action] for action in ("approve", "rewrite", "reject")
    )
    record_count = len(state.answers)
    ready_for_merge = action_counts["pending"] == 0
    report = {
        "schema": HUMAN_REVIEW_PROGRESS_SCHEMA,
        "status": (
            "explicit-human-review-complete-ready-for-fail-closed-merge"
            if ready_for_merge
            else "explicit-human-review-in-progress"
        ),
        "handoff_manifest_path": str(state.manifest_path),
        "handoff_manifest_sha256": sha256_file(state.manifest_path),
        "record_count": record_count,
        "batch_count": len(state.expected_batches),
        "source_workbook_count": len(state.identities),
        "semantic_audit_count": len(state.manifest["semantic_audits"]),
        "pending_count": action_counts["pending"],
        "approved_count": action_counts["approve"],
        "rewritten_count": action_counts["rewrite"],
        "rejected_count": action_counts["reject"],
        "resolved_count": resolved_count,
        "completion_ratio": round(resolved_count / record_count, 9),
        "reviewer_ids": sorted(reviewers),
        "current_decision_set_sha256": sha256_bytes(
            canonical_json_bytes(list(state.decision_sha256s))
        ),
        "batches": batch_reports,
        "ready_for_merge": ready_for_merge,
        "contains_record_ids": False,
        "contains_prompt_text": False,
        "contains_response_text": False,
        "contains_record_level_actions": False,
        "training_authority": False,
        "required_next_gate": (
            "run-fail-closed-human-review-merge"
            if ready_for_merge
            else "continue-explicit-human-review"
        ),
    }
    return report


def write_human_review_progress(
    handoff_dir: Path, output_dir: Path
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    state = load_human_review_handoff_state(handoff_dir)
    report = human_review_progress_report(state)

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        (staging / "human-review-progress-report.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return report


def merge_human_review_handoff(
    handoff_dir: Path, output_dir: Path
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    state = load_human_review_handoff_state(handoff_dir)
    manifest_path = state.manifest_path
    identities = state.identities
    answers = state.answers
    answer_by_id = {answer.record_id: answer for answer in answers}

    completed_by_id: dict[str, dict[str, Any]] = {}
    actions_by_id: dict[str, str] = {}
    reviewers: set[str] = set()
    for batch, decision_rows in zip(state.expected_batches, state.decision_rows):
        for decision, review_row in zip(decision_rows, batch["review_rows"]):
            answer = answer_by_id[review_row["id"]]
            action, downstream = validate_completed_human_review_decision(
                decision, review_row, answer
            )
            completed_by_id[review_row["id"]] = downstream
            actions_by_id[review_row["id"]] = action
            reviewers.add(downstream["reviewer_id"])

    if set(completed_by_id) != set(answer_by_id):
        raise ValueError("completed human review coverage does not match the corpus")

    campaign_outputs = []
    output_payloads = []
    for campaign_index, identity in enumerate(identities, 1):
        campaign_answers = sorted(
            (
                answer
                for answer in answers
                if answer.assisted_receipt_sha256 == identity["receipt_sha256"]
            ),
            key=lambda answer: answer.record_id,
        )
        decisions = [completed_by_id[answer.record_id] for answer in campaign_answers]
        payload = jsonl_bytes(decisions)
        file_name = f"review-decisions-{campaign_index:04d}.jsonl"
        action_counts = Counter(actions_by_id[answer.record_id] for answer in campaign_answers)
        source_workbook = campaign_answers[0].context.workbook_path
        source_receipt = read_json_object(
            source_workbook / "review-workbook-receipt.json",
            MAX_RECEIPT_BYTES,
            "source review workbook receipt",
        )
        campaign_outputs.append(
            {
                "campaign_id": identity["campaign_id"],
                "assisted_workbook_path": identity["workbook_path"],
                "assisted_workbook_receipt_sha256": identity["receipt_sha256"],
                "source_workbook_path": str(source_workbook),
                "source_workbook_receipt_sha256": identity[
                    "source_workbook_receipt_sha256"
                ],
                "draft_manifest_path": source_receipt["draft_manifest_path"],
                "draft_manifest_sha256": identity["draft_manifest_sha256"],
                "record_count": len(campaign_answers),
                "approved_count": action_counts["approve"],
                "rewritten_count": action_counts["rewrite"],
                "rejected_count": action_counts["reject"],
                "review_decisions_file": file_name,
                "review_decisions_sha256": sha256_bytes(payload),
            }
        )
        output_payloads.append((file_name, payload))

    action_counts = Counter(actions_by_id.values())
    receipt = {
        "schema": HUMAN_REVIEW_COMPLETION_SCHEMA,
        "status": "explicit-human-review-complete-ready-for-reviewed-export",
        "handoff_manifest_path": str(manifest_path),
        "handoff_manifest_sha256": sha256_file(manifest_path),
        "record_count": len(completed_by_id),
        "approved_count": action_counts["approve"],
        "rewritten_count": action_counts["rewrite"],
        "rejected_count": action_counts["reject"],
        "reviewer_ids": sorted(reviewers),
        "campaigns": campaign_outputs,
        "training_authority": False,
        "required_next_gate": (
            "export-reviewed-per-campaign-then-run-corpus-audit-and-freeze"
        ),
    }

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        for file_name, payload in output_payloads:
            (staging / file_name).write_bytes(payload)
        (staging / "human-review-completion-receipt.json").write_text(
            json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit and prepare hash-bound TinyRustLM review workbooks."
    )
    parser.add_argument("workbook_dirs", nargs="+", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--suggestions", type=Path, action="append")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--audit-pending-answers", action="store_true")
    mode.add_argument("--audit-semantic-neighbors", action="store_true")
    mode.add_argument("--prepare-human-review", action="store_true")
    mode.add_argument("--audit-human-review", action="store_true")
    mode.add_argument("--merge-human-review", action="store_true")
    parser.add_argument("--semantic-audit-dir", type=Path, action="append")
    parser.add_argument("--review-batch-size", type=int, default=25)
    parser.add_argument("--encoder-dir", type=Path)
    parser.add_argument("--encoder-repo-id")
    parser.add_argument("--encoder-revision")
    parser.add_argument("--encoder-license")
    parser.add_argument("--semantic-threshold", type=float, default=0.90)
    parser.add_argument("--encoder-max-length", type=int, default=128)
    parser.add_argument("--encoder-batch-size", type=int, default=32)
    args = parser.parse_args()
    if args.audit_human_review:
        if args.suggestions is not None or args.semantic_audit_dir is not None:
            parser.error(
                "--audit-human-review cannot be combined with suggestions or semantic audits"
            )
        if len(args.workbook_dirs) != 1:
            parser.error("--audit-human-review requires exactly one handoff directory")
        report = write_human_review_progress(
            args.workbook_dirs[0], args.output_dir
        )
    elif args.merge_human_review:
        if args.suggestions is not None or args.semantic_audit_dir is not None:
            parser.error(
                "--merge-human-review cannot be combined with suggestions or semantic audits"
            )
        if len(args.workbook_dirs) != 1:
            parser.error("--merge-human-review requires exactly one handoff directory")
        report = merge_human_review_handoff(
            args.workbook_dirs[0], args.output_dir
        )
    elif args.prepare_human_review:
        if args.suggestions is not None:
            parser.error("--prepare-human-review cannot be combined with --suggestions")
        report = write_human_review_handoff(
            args.workbook_dirs,
            args.output_dir,
            args.review_batch_size,
            tuple(args.semantic_audit_dir or ()),
        )
    elif args.audit_semantic_neighbors:
        if args.suggestions is not None:
            parser.error("--audit-semantic-neighbors cannot be combined with --suggestions")
        if args.semantic_audit_dir is not None:
            parser.error(
                "--audit-semantic-neighbors cannot consume an existing semantic audit"
            )
        missing = [
            name
            for name, value in (
                ("--encoder-dir", args.encoder_dir),
                ("--encoder-repo-id", args.encoder_repo_id),
                ("--encoder-revision", args.encoder_revision),
                ("--encoder-license", args.encoder_license),
            )
            if value is None
        ]
        if missing:
            parser.error(
                "--audit-semantic-neighbors requires " + ", ".join(missing)
            )
        report = write_semantic_neighbor_audit(
            args.workbook_dirs,
            args.output_dir,
            args.encoder_dir,
            args.encoder_repo_id,
            args.encoder_revision,
            args.encoder_license,
            args.semantic_threshold,
            args.encoder_max_length,
            args.encoder_batch_size,
        )
    elif args.audit_pending_answers:
        if args.suggestions is not None:
            parser.error("--audit-pending-answers cannot be combined with --suggestions")
        if args.semantic_audit_dir is not None:
            parser.error(
                "--audit-pending-answers cannot consume an existing semantic audit"
            )
        report = write_pending_answer_audit(args.workbook_dirs, args.output_dir)
    elif args.suggestions is not None:
        if args.semantic_audit_dir is not None:
            parser.error("--suggestions cannot be combined with --semantic-audit-dir")
        if len(args.workbook_dirs) != 1:
            parser.error("--suggestions requires exactly one review workbook")
        report = write_suggested_review(
            args.workbook_dirs[0], args.suggestions, args.output_dir
        )
    else:
        if args.semantic_audit_dir is not None:
            parser.error("--semantic-audit-dir requires --prepare-human-review")
        report = write_triage(tuple(args.workbook_dirs), args.output_dir)
    print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
