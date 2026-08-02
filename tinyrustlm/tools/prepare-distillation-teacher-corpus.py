"""Collect and review local teacher drafts before distillation dataset import.

The draft bundle is deliberately not a training dataset. Only an explicit,
hash-bound review export can produce the JSONL accepted by
prepare-distillation-dataset.py.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import json
import os
import shutil
import sys
import tempfile
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit


CONTROL_SCHEMA = "tinyrustlm.teacher_draft_collection.v1"
DRAFT_MANIFEST_SCHEMA = "tinyrustlm.teacher_draft_manifest.v1"
REVIEW_RECEIPT_SCHEMA = "tinyrustlm.teacher_review_export_receipt.v1"
REVIEW_WORKBOOK_RECEIPT_SCHEMA = "tinyrustlm.teacher_review_workbook_receipt.v2"
REVIEW_CONTEXT_RECORD_SCHEMA = "tinyrustlm.teacher_review_context_record.v1"
COLLECTION_CHECKPOINT_SCHEMA = "tinyrustlm.teacher_collection_checkpoint.v1"
COLLECTION_CHECKPOINT_RECORD_SCHEMA = (
    "tinyrustlm.teacher_collection_checkpoint_record.v1"
)
MAX_CONTROL_BYTES = 16 * 1024 * 1024
MAX_PROMPT_PLAN_BYTES = 256 * 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024
MAX_TEACHER_BYTES = 64 * 1024 * 1024 * 1024
MAX_API_RESPONSE_BYTES = 16 * 1024 * 1024
MAX_CHECKPOINT_RECORD_BYTES = MAX_API_RESPONSE_BYTES * 2
NGRAM_WORD_COUNT = 5

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
    "campaign_id",
    "source_id",
    "source_license",
    "prompt_plan",
    "eval_exclusions",
    "teacher",
    "generation",
}
FILE_IDENTITY_KEYS = {"path", "sha256"}
TEACHER_KEYS = {
    "model_id",
    "revision",
    "weight_file",
    "weight_sha256",
    "tokenizer_identity_file",
    "tokenizer_identity_sha256",
    "license",
    "endpoint",
}
GENERATION_KEYS = {
    "system_prompt_file",
    "system_prompt_sha256",
    "temperature",
    "top_p",
    "top_k",
    "max_tokens",
    "seed",
    "timeout_seconds",
}
PROMPT_KEYS_V1 = {"id", "task_family", "prompt", "response_requirements", "max_tokens"}
PROMPT_KEYS_V2 = PROMPT_KEYS_V1 | {"history"}
MESSAGE_KEYS = {"role", "content"}
REVIEW_KEYS = {
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
APPROVAL_FIELDS = (
    "factuality",
    "instruction_following",
    "safety",
    "conciseness",
    "hidden_reasoning_absent",
)
PENDING_REVIEWER_ID = "pending-reviewer"
PENDING_REVIEW_NOTE = "Pending explicit review against the prompt and response contract."
HIDDEN_REASONING_MARKERS = (
    "<think>",
    "</think>",
    "<|thinking|>",
    "chain of thought:",
    "hidden reasoning:",
    "private scratchpad:",
)
SECRET_MARKERS = (
    "-----begin private key-----",
    "-----begin rsa private key-----",
    "authorization: bearer ",
    "nuget-api-key",
    "aws_secret_access_key",
    "client_secret=",
    "database_password=",
)

CHECKPOINT_KEYS = {
    "schema",
    "campaign_id",
    "control_sha256",
    "prompt_plan_sha256",
    "system_prompt_sha256",
    "teacher_model_id",
    "teacher_revision",
    "teacher_weight_sha256",
    "teacher_tokenizer_sha256",
    "request_plan_sha256",
    "record_count",
    "status",
}
CHECKPOINT_RECORD_KEYS = {
    "schema",
    "index",
    "id",
    "seed",
    "request_sha256",
    "raw_response_sha256",
    "raw_response_base64",
    "draft_response_sha256",
    "finish_reason",
    "status",
}


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class PromptRecord:
    record_id: str
    task_family: str
    prompt: str
    response_requirements: tuple[str, ...]
    max_tokens: int
    history: tuple[ChatMessage, ...] = ()


@dataclass(frozen=True)
class ExclusionIdentity:
    path: Path
    sha256: str
    prompt_count: int
    prompts: tuple[str, ...]


@dataclass(frozen=True)
class CollectionPlan:
    control_path: Path
    control: dict[str, Any]
    control_sha256: str
    prompt_plan_path: Path
    prompt_plan_sha256: str
    system_prompt_path: Path
    system_prompt_sha256: str
    system_prompt: str
    teacher_weight_path: Path
    teacher_weight_sha256: str
    teacher_tokenizer_path: Path
    teacher_tokenizer_sha256: str
    exclusions: tuple[ExclusionIdentity, ...]
    prompts: tuple[PromptRecord, ...]


Transport = Callable[[str, bytes, int], bytes]


def sha256_bytes(payload: bytes) -> str:
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")


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


def validate_evidence(value: str, label: str, minimum: int = 8) -> str:
    if (
        len(value) < minimum
        or len(value) > 512
        or value.strip() != value
        or any(char in value for char in "\r\n\0")
    ):
        raise ValueError(f"{label} is not a valid evidence value")
    return value


def require_sha256(value: str, label: str) -> str:
    if (
        not value.startswith("sha256:")
        or len(value) != 71
        or any(char not in "0123456789abcdefABCDEF" for char in value[7:])
    ):
        raise ValueError(f"{label} must be a sha256: value")
    return value.lower()


def resolve_path(control_path: Path, value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = control_path.parent / path
    return path.resolve()


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
    if result < minimum or result > maximum:
        raise ValueError(f"{label} must be in {minimum}..={maximum}")
    return result


def validate_loopback_endpoint(value: str) -> str:
    parsed = urlsplit(value)
    if (
        parsed.scheme != "http"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path != "/v1/chat/completions"
        or parsed.port is None
    ):
        raise ValueError("teacher.endpoint must be an unauthenticated loopback HTTP chat endpoint")
    host = parsed.hostname
    if host == "localhost":
        return value
    try:
        address = ipaddress.ip_address(host or "")
    except ValueError as error:
        raise ValueError("teacher.endpoint host must be loopback") from error
    if not address.is_loopback:
        raise ValueError("teacher.endpoint host must be loopback")
    return value


def parse_manifest_fields(payload: bytes, label: str) -> dict[str, str]:
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be valid UTF-8") from error
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


def read_exclusion(path: Path, expected_sha256: str) -> ExclusionIdentity:
    payload = read_regular_bytes(path, MAX_CONTROL_BYTES, "eval exclusion")
    actual_sha256 = sha256_bytes(payload)
    if actual_sha256 != expected_sha256:
        raise ValueError(f"eval exclusion SHA-256 does not match local bytes: {path}")
    fields = parse_manifest_fields(payload, "eval exclusion")
    if fields.get("tinyrustlm_eval_cases_version") != "1":
        raise ValueError("eval exclusion version is unsupported")
    try:
        holdout_count = int(fields.get("holdout_count", "0"))
        case_count = int(fields["case_count"])
    except (KeyError, ValueError) as error:
        raise ValueError("eval exclusion counts must be integers") from error
    if holdout_count != 0:
        raise ValueError("eval exclusion holdouts must be materialized before collection")
    if case_count <= 0:
        raise ValueError("eval exclusion must contain at least one case")
    prompts = []
    for index in range(case_count):
        prompt = fields.get(f"case.{index}.prompt", "")
        if not normalized_words(prompt):
            raise ValueError(f"eval exclusion case.{index}.prompt is missing or empty")
        prompts.append(prompt)
        history_count_value = fields.get(f"case.{index}.history_turn_count")
        if history_count_value is not None:
            try:
                history_turn_count = int(history_count_value)
            except ValueError as error:
                raise ValueError("eval exclusion history_turn_count must be an integer") from error
            if not 1 <= history_turn_count <= 6:
                raise ValueError("eval exclusion history_turn_count must be in 1..=6")
            messages = []
            for turn in range(history_turn_count):
                for role in ("user", "assistant"):
                    content = fields.get(f"case.{index}.history.{turn}.{role}", "")
                    if not normalized_words(content):
                        raise ValueError("eval exclusion role history is incomplete")
                    messages.append(ChatMessage(role, content))
            prompts.append(render_role_content(tuple(messages), prompt))
    return ExclusionIdentity(path, actual_sha256, len(prompts), tuple(prompts))


def normalized_words(text: str) -> tuple[str, ...]:
    words = []
    current = []
    for index, char in enumerate(text):
        if char.isalnum():
            current.append(char.lower())
        elif (
            char in {"'", "\u2019"}
            and current
            and index + 1 < len(text)
            and text[index + 1].isalnum()
        ):
            # Apostrophe spelling must not hide short eval leaks such as
            # `what's up` versus `whats up`.
            continue
        elif current:
            words.append("".join(current))
            current = []
    if current:
        words.append("".join(current))
    return tuple(words)


def word_ngrams(words: tuple[str, ...]) -> set[str]:
    return {
        " ".join(words[index : index + NGRAM_WORD_COUNT])
        for index in range(max(0, len(words) - NGRAM_WORD_COUNT + 1))
    }


def build_exclusion_index(
    exclusions: tuple[ExclusionIdentity, ...],
) -> tuple[dict[str, Path], dict[str, Path]]:
    exact: dict[str, Path] = {}
    ngrams: dict[str, Path] = {}
    for exclusion in exclusions:
        for prompt in exclusion.prompts:
            words = normalized_words(prompt)
            exact[" ".join(words)] = exclusion.path
            for ngram in word_ngrams(words):
                ngrams.setdefault(ngram, exclusion.path)
    return exact, ngrams


def reject_contamination(
    record_id: str,
    label: str,
    text: str,
    exclusion_index: tuple[dict[str, Path], dict[str, Path]],
) -> None:
    words = normalized_words(text)
    normalized = " ".join(words)
    exact, ngrams = exclusion_index
    if normalized in exact:
        raise ValueError(
            f"record {record_id} {label} exactly matches eval exclusion {exact[normalized]}"
        )
    for ngram in word_ngrams(words):
        if ngram in ngrams:
            raise ValueError(
                f"record {record_id} {label} shares eval five-gram `{ngram}` with {ngrams[ngram]}"
            )


def reject_hidden_reasoning_or_secret(text: str, record_id: str) -> None:
    lower = text.lower()
    if any(marker in lower for marker in HIDDEN_REASONING_MARKERS):
        raise ValueError(f"record {record_id} contains hidden reasoning material")
    if any(marker in lower for marker in SECRET_MARKERS):
        raise ValueError(f"record {record_id} contains likely secret material")


def validate_history(value: Any, source: str, record_id: str) -> tuple[ChatMessage, ...]:
    if not isinstance(value, list) or not 2 <= len(value) <= 12 or len(value) % 2 != 0:
        raise ValueError(f"prompt {record_id} history must contain 1..=6 complete turns")
    messages = []
    for index, message in enumerate(value):
        label = f"{source} prompt {record_id} history[{index}]"
        if not isinstance(message, dict):
            raise ValueError(f"{label} must be a JSON object")
        require_exact_keys(message, MESSAGE_KEYS, label)
        expected_role = "user" if index % 2 == 0 else "assistant"
        if message.get("role") != expected_role:
            raise ValueError(f"{label}.role must be {expected_role}")
        content = require_string(message, "content", label)
        if len(content.encode("utf-8")) > MAX_RECORD_BYTES or "\0" in content:
            raise ValueError(f"{label}.content is invalid")
        reject_hidden_reasoning_or_secret(content, record_id)
        messages.append(ChatMessage(expected_role, content))
    return tuple(messages)


def render_role_conversation(history: tuple[ChatMessage, ...], prompt: str) -> str:
    parts = [f"[{message.role}]\n{message.content}" for message in history]
    parts.append(f"[current user]\n{prompt}")
    return "\n\n".join(parts)


def render_role_content(history: tuple[ChatMessage, ...], prompt: str) -> str:
    return "\n\n".join([*(message.content for message in history), prompt])


def history_sha256(history: tuple[ChatMessage, ...]) -> str:
    return sha256_bytes(
        canonical_json_bytes(
            [{"role": message.role, "content": message.content} for message in history]
        )
    )


def parse_prompt_record(value: Any, source: str, line_number: int) -> PromptRecord:
    if not isinstance(value, dict):
        raise ValueError(f"{source} line {line_number} must be a JSON object")
    keys = frozenset(value)
    if keys not in {frozenset(PROMPT_KEYS_V1), frozenset(PROMPT_KEYS_V2)}:
        require_exact_keys(value, PROMPT_KEYS_V2, f"{source} line {line_number}")
    record_id = validate_slug(require_string(value, "id", source), "prompt id")
    task_family = require_string(value, "task_family", source)
    if task_family not in TASK_FAMILIES:
        raise ValueError(f"prompt {record_id} has an unknown task_family")
    prompt = require_string(value, "prompt", source)
    if len(prompt.encode("utf-8")) > MAX_RECORD_BYTES or "\0" in prompt:
        raise ValueError(f"prompt {record_id} is invalid")
    requirements = value.get("response_requirements")
    if (
        not isinstance(requirements, list)
        or not 1 <= len(requirements) <= 12
        or any(
            not isinstance(item, str)
            or not item
            or item.strip() != item
            or len(item.encode("utf-8")) > 2048
            for item in requirements
        )
    ):
        raise ValueError(f"prompt {record_id} response_requirements are invalid")
    max_tokens = require_integer(value.get("max_tokens"), "prompt.max_tokens", 16, 2048)
    history = validate_history(value["history"], source, record_id) if "history" in value else ()
    return PromptRecord(record_id, task_family, prompt, tuple(requirements), max_tokens, history)


def read_prompt_plan(path: Path) -> tuple[PromptRecord, ...]:
    payload = read_regular_bytes(path, MAX_PROMPT_PLAN_BYTES, "prompt plan")
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("prompt plan must be UTF-8") from error
    records = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid prompt-plan JSONL at line {line_number}") from error
        records.append(parse_prompt_record(value, str(path), line_number))
    if not records:
        raise ValueError("prompt plan has no records")
    records.sort(key=lambda record: record.record_id)
    ids = [record.record_id for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError("prompt plan contains duplicate ids")
    return tuple(records)


def build_collection_plan(control_path: Path) -> CollectionPlan:
    control_path = control_path.resolve()
    control = read_json_object(control_path, MAX_CONTROL_BYTES, "collection control")
    require_exact_keys(control, CONTROL_KEYS, "collection control")
    if control.get("schema") != CONTROL_SCHEMA:
        raise ValueError("collection control schema is unsupported")
    validate_slug(require_string(control, "campaign_id", "control"), "campaign_id")
    validate_evidence(require_string(control, "source_id", "control"), "source_id")
    validate_evidence(
        require_string(control, "source_license", "control"), "source_license"
    )

    prompt_identity = control.get("prompt_plan")
    if not isinstance(prompt_identity, dict):
        raise ValueError("prompt_plan must be a JSON object")
    require_exact_keys(prompt_identity, FILE_IDENTITY_KEYS, "prompt_plan")
    prompt_path = resolve_path(
        control_path, require_string(prompt_identity, "path", "prompt_plan")
    )
    prompt_sha256 = require_sha256(
        require_string(prompt_identity, "sha256", "prompt_plan"), "prompt_plan.sha256"
    )
    if sha256_file(prompt_path) != prompt_sha256:
        raise ValueError("prompt_plan SHA-256 does not match local bytes")

    teacher = control.get("teacher")
    generation = control.get("generation")
    if not isinstance(teacher, dict) or not isinstance(generation, dict):
        raise ValueError("teacher and generation must be JSON objects")
    require_exact_keys(teacher, TEACHER_KEYS, "teacher")
    require_exact_keys(generation, GENERATION_KEYS, "generation")
    validate_evidence(require_string(teacher, "model_id", "teacher"), "teacher.model_id", 3)
    validate_evidence(require_string(teacher, "revision", "teacher"), "teacher.revision")
    validate_evidence(require_string(teacher, "license", "teacher"), "teacher.license", 3)
    validate_loopback_endpoint(require_string(teacher, "endpoint", "teacher"))

    weight_path = resolve_path(
        control_path, require_string(teacher, "weight_file", "teacher")
    )
    tokenizer_path = resolve_path(
        control_path,
        require_string(teacher, "tokenizer_identity_file", "teacher"),
    )
    read_regular_bytes(weight_path, MAX_TEACHER_BYTES, "teacher weights")
    read_regular_bytes(tokenizer_path, MAX_TEACHER_BYTES, "teacher tokenizer identity")
    expected_weight = require_sha256(
        require_string(teacher, "weight_sha256", "teacher"), "teacher.weight_sha256"
    )
    expected_tokenizer = require_sha256(
        require_string(teacher, "tokenizer_identity_sha256", "teacher"),
        "teacher.tokenizer_identity_sha256",
    )
    actual_weight = sha256_file(weight_path)
    actual_tokenizer = actual_weight if tokenizer_path == weight_path else sha256_file(tokenizer_path)
    if actual_weight != expected_weight or actual_tokenizer != expected_tokenizer:
        raise ValueError("teacher artifact SHA-256 does not match local bytes")

    system_path = resolve_path(
        control_path,
        require_string(generation, "system_prompt_file", "generation"),
    )
    system_payload = read_regular_bytes(system_path, MAX_RECORD_BYTES, "system prompt")
    try:
        system_prompt = system_payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("system prompt must be UTF-8") from error
    if not system_prompt.strip() or "\0" in system_prompt:
        raise ValueError("system prompt is empty or invalid")
    expected_system = require_sha256(
        require_string(generation, "system_prompt_sha256", "generation"),
        "generation.system_prompt_sha256",
    )
    actual_system = sha256_bytes(system_payload)
    if actual_system != expected_system:
        raise ValueError("system prompt SHA-256 does not match local bytes")
    require_number(generation.get("temperature"), "generation.temperature", 0.0, 2.0)
    require_number(generation.get("top_p"), "generation.top_p", 0.01, 1.0)
    require_integer(generation.get("top_k"), "generation.top_k", 1, 100000)
    global_max = require_integer(
        generation.get("max_tokens"), "generation.max_tokens", 16, 2048
    )
    require_integer(generation.get("seed"), "generation.seed", 0, 2**31 - 1)
    require_integer(
        generation.get("timeout_seconds"), "generation.timeout_seconds", 1, 3600
    )

    raw_exclusions = control.get("eval_exclusions")
    if not isinstance(raw_exclusions, list) or not raw_exclusions:
        raise ValueError("eval_exclusions must be a non-empty list")
    exclusions = []
    seen_paths: set[Path] = set()
    for index, identity in enumerate(raw_exclusions):
        if not isinstance(identity, dict):
            raise ValueError(f"eval_exclusions[{index}] must be a JSON object")
        require_exact_keys(identity, FILE_IDENTITY_KEYS, f"eval_exclusions[{index}]")
        path = resolve_path(
            control_path,
            require_string(identity, "path", f"eval_exclusions[{index}]"),
        )
        if path in seen_paths:
            raise ValueError("eval exclusion paths must be unique")
        seen_paths.add(path)
        exclusions.append(
            read_exclusion(
                path,
                require_sha256(
                    require_string(identity, "sha256", f"eval_exclusions[{index}]"),
                    f"eval_exclusions[{index}].sha256",
                ),
            )
        )

    prompts = read_prompt_plan(prompt_path)
    exclusion_tuple = tuple(exclusions)
    exclusion_index = build_exclusion_index(exclusion_tuple)
    for prompt in prompts:
        if prompt.max_tokens > global_max:
            raise ValueError(
                f"prompt {prompt.record_id} max_tokens exceeds the generation limit"
            )
        reject_contamination(
            prompt.record_id, "prompt", prompt.prompt, exclusion_index
        )
        if prompt.history:
            reject_contamination(
                prompt.record_id,
                "role history",
                render_role_content(prompt.history, prompt.prompt),
                exclusion_index,
            )

    return CollectionPlan(
        control_path=control_path,
        control=control,
        control_sha256=sha256_file(control_path),
        prompt_plan_path=prompt_path,
        prompt_plan_sha256=prompt_sha256,
        system_prompt_path=system_path,
        system_prompt_sha256=actual_system,
        system_prompt=system_prompt,
        teacher_weight_path=weight_path,
        teacher_weight_sha256=actual_weight,
        teacher_tokenizer_path=tokenizer_path,
        teacher_tokenizer_sha256=actual_tokenizer,
        exclusions=exclusion_tuple,
        prompts=prompts,
    )


def post_json(endpoint: str, payload: bytes, timeout_seconds: int) -> bytes:
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            if response.status != 200:
                raise ValueError(f"teacher endpoint returned HTTP {response.status}")
            body = response.read(MAX_API_RESPONSE_BYTES + 1)
    except urllib.error.URLError as error:
        raise ValueError(f"teacher endpoint request failed: {error}") from error
    if not body or len(body) > MAX_API_RESPONSE_BYTES:
        raise ValueError("teacher endpoint response size is invalid")
    return body


def parse_teacher_response(payload: bytes, record_id: str) -> tuple[str, str]:
    if len(payload) > MAX_API_RESPONSE_BYTES:
        raise ValueError(f"teacher response for {record_id} is too large")
    try:
        response = json.loads(payload)
        choices = response["choices"]
        choice = choices[0]
        message = choice["message"]
        content = message["content"]
        finish_reason = choice["finish_reason"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, IndexError, TypeError) as error:
        raise ValueError(f"teacher response for {record_id} has an invalid chat schema") from error
    if not isinstance(content, str) or not content.strip() or "\0" in content:
        raise ValueError(f"teacher response for {record_id} has empty or invalid content")
    if len(content.encode("utf-8")) > MAX_RECORD_BYTES:
        raise ValueError(f"teacher response for {record_id} exceeds the record limit")
    if not isinstance(finish_reason, str) or not finish_reason:
        raise ValueError(f"teacher response for {record_id} has no finish_reason")
    reasoning = message.get("reasoning_content")
    if reasoning not in (None, ""):
        raise ValueError(f"teacher response for {record_id} contains reasoning_content")
    reject_hidden_reasoning_or_secret(content, record_id)
    return content, finish_reason


def build_teacher_request(
    plan: CollectionPlan, prompt: PromptRecord, index: int
) -> tuple[bytes, int]:
    teacher = plan.control["teacher"]
    generation = plan.control["generation"]
    seed = generation["seed"] + index
    response_contract = "\n".join(
        f"- {requirement}" for requirement in prompt.response_requirements
    )
    record_system_prompt = (
        f"{plan.system_prompt.rstrip()}\n\n"
        "Response contract for this record:\n"
        f"{response_contract}\n"
        "Satisfy this contract exactly and add nothing beyond it."
    )
    messages = [{"role": "system", "content": record_system_prompt}]
    messages.extend(
        {"role": message.role, "content": message.content} for message in prompt.history
    )
    messages.append({"role": "user", "content": prompt.prompt})
    request_value = {
        "model": teacher["model_id"],
        "messages": messages,
        "temperature": generation["temperature"],
        "top_p": generation["top_p"],
        "top_k": generation["top_k"],
        "max_tokens": prompt.max_tokens,
        "seed": seed,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    return canonical_json_bytes(request_value), seed


def checkpoint_record_filename(index: int, record_id: str) -> str:
    return f"{index:06d}-{record_id}.json"


def expected_checkpoint_header(plan: CollectionPlan) -> dict[str, Any]:
    request_identities = []
    for index, prompt in enumerate(plan.prompts):
        request_payload, seed = build_teacher_request(plan, prompt, index)
        request_identities.append(
            {
                "index": index,
                "id": prompt.record_id,
                "seed": seed,
                "request_sha256": sha256_bytes(request_payload),
            }
        )
    teacher = plan.control["teacher"]
    return {
        "schema": COLLECTION_CHECKPOINT_SCHEMA,
        "campaign_id": plan.control["campaign_id"],
        "control_sha256": plan.control_sha256,
        "prompt_plan_sha256": plan.prompt_plan_sha256,
        "system_prompt_sha256": plan.system_prompt_sha256,
        "teacher_model_id": teacher["model_id"],
        "teacher_revision": teacher["revision"],
        "teacher_weight_sha256": plan.teacher_weight_sha256,
        "teacher_tokenizer_sha256": plan.teacher_tokenizer_sha256,
        "request_plan_sha256": sha256_bytes(canonical_json_bytes(request_identities)),
        "record_count": len(plan.prompts),
        "status": "collection-checkpoint-not-training-approved",
    }


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.tmp-", dir=path.parent
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as destination:
            destination.write(payload)
            destination.flush()
            os.fsync(destination.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def initialize_collection_checkpoint(
    plan: CollectionPlan, checkpoint_dir: Path
) -> Path:
    checkpoint_dir = checkpoint_dir.resolve()
    if checkpoint_dir.exists():
        if not checkpoint_dir.is_dir() or checkpoint_dir.is_symlink():
            raise ValueError("collection checkpoint must be a non-symlink directory")
    else:
        checkpoint_dir.mkdir(parents=True)

    records_dir = checkpoint_dir / "records"
    if records_dir.exists():
        if not records_dir.is_dir() or records_dir.is_symlink():
            raise ValueError("collection checkpoint records must be a non-symlink directory")
    else:
        records_dir.mkdir()

    header_path = checkpoint_dir / "collection-checkpoint.json"
    expected = expected_checkpoint_header(plan)
    if header_path.exists():
        actual = read_json_object(
            header_path, MAX_CONTROL_BYTES, "collection checkpoint"
        )
        require_exact_keys(actual, CHECKPOINT_KEYS, "collection checkpoint")
        if actual != expected:
            raise ValueError("collection checkpoint does not match the collection plan")
    else:
        if any(records_dir.iterdir()):
            raise ValueError("collection checkpoint records exist without a header")
        atomic_write_bytes(
            header_path,
            json.dumps(
                expected, indent=2, ensure_ascii=False, sort_keys=True
            ).encode("utf-8")
            + b"\n",
        )
    return checkpoint_dir


def checkpoint_record_entries(
    records_dir: Path, expected_names: set[str]
) -> list[Path]:
    entries = []
    for path in records_dir.iterdir():
        name = path.name
        if not name.startswith(".") or ".tmp-" not in name:
            entries.append(path)
            continue
        target_name = name[1:].split(".tmp-", 1)[0]
        if target_name not in expected_names or not path.is_file() or path.is_symlink():
            raise ValueError(f"unknown collection checkpoint entry: {name}")
        # A validator may run while the collector is flushing this file. Ignore
        # only temp names produced by atomic_write_bytes inside this owned dir.
    return entries


def load_collection_checkpoint_records(
    plan: CollectionPlan, checkpoint_dir: Path
) -> dict[int, tuple[bytes, str, str]]:
    checkpoint_dir = initialize_collection_checkpoint(plan, checkpoint_dir)
    records_dir = checkpoint_dir / "records"
    expected_files = {
        checkpoint_record_filename(index, prompt.record_id): (index, prompt)
        for index, prompt in enumerate(plan.prompts)
    }
    entries = checkpoint_record_entries(records_dir, set(expected_files))
    unknown = sorted(path.name for path in entries if path.name not in expected_files)
    if unknown:
        raise ValueError(f"unknown collection checkpoint entries: {unknown}")

    loaded: dict[int, tuple[bytes, str, str]] = {}
    for path in sorted(entries, key=lambda candidate: candidate.name):
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"checkpoint record must be a regular file: {path.name}")
        index, prompt = expected_files[path.name]
        value = read_json_object(
            path, MAX_CHECKPOINT_RECORD_BYTES, "collection checkpoint record"
        )
        require_exact_keys(
            value, CHECKPOINT_RECORD_KEYS, "collection checkpoint record"
        )
        if value.get("schema") != COLLECTION_CHECKPOINT_RECORD_SCHEMA:
            raise ValueError("collection checkpoint record schema is unsupported")
        if value.get("index") != index or value.get("id") != prompt.record_id:
            raise ValueError("collection checkpoint record identity drift")
        request_payload, seed = build_teacher_request(plan, prompt, index)
        if value.get("seed") != seed:
            raise ValueError("collection checkpoint record seed drift")
        expected_request_sha256 = sha256_bytes(request_payload)
        if value.get("request_sha256") != expected_request_sha256:
            raise ValueError("collection checkpoint request SHA-256 drift")
        encoded_response = value.get("raw_response_base64")
        if not isinstance(encoded_response, str) or not encoded_response:
            raise ValueError("collection checkpoint raw response encoding is invalid")
        try:
            response_payload = base64.b64decode(encoded_response, validate=True)
        except (ValueError, TypeError) as error:
            raise ValueError(
                "collection checkpoint raw response encoding is invalid"
            ) from error
        if not response_payload or len(response_payload) > MAX_API_RESPONSE_BYTES:
            raise ValueError("collection checkpoint raw response size is invalid")
        if value.get("raw_response_sha256") != sha256_bytes(response_payload):
            raise ValueError("checkpoint raw response SHA-256 drift")
        content, finish_reason = parse_teacher_response(
            response_payload, prompt.record_id
        )
        if value.get("draft_response_sha256") != sha256_bytes(
            content.encode("utf-8")
        ):
            raise ValueError("checkpoint draft response SHA-256 drift")
        if value.get("finish_reason") != finish_reason:
            raise ValueError("collection checkpoint finish_reason drift")
        if value.get("status") != "teacher-draft-not-training-approved":
            raise ValueError("collection checkpoint record status is invalid")
        loaded[index] = (response_payload, content, finish_reason)

    indexes = sorted(loaded)
    if indexes != list(range(len(indexes))):
        raise ValueError("collection checkpoint records must form a contiguous prefix")
    return loaded


def validate_collection_checkpoint(
    plan: CollectionPlan, checkpoint_dir: Path
) -> dict[str, Any]:
    loaded = load_collection_checkpoint_records(plan, checkpoint_dir)
    return {
        "schema": COLLECTION_CHECKPOINT_SCHEMA,
        "campaign_id": plan.control["campaign_id"],
        "completed_record_count": len(loaded),
        "record_count": len(plan.prompts),
        "complete": len(loaded) == len(plan.prompts),
        "status": "checkpoint-validated-not-training-approved",
    }


def write_collection_checkpoint_record(
    checkpoint_dir: Path,
    index: int,
    prompt: PromptRecord,
    seed: int,
    request_payload: bytes,
    response_payload: bytes,
    content: str,
    finish_reason: str,
) -> None:
    record_path = checkpoint_dir / "records" / checkpoint_record_filename(
        index, prompt.record_id
    )
    if record_path.exists():
        raise ValueError(f"collection checkpoint record already exists: {record_path.name}")
    value = {
        "schema": COLLECTION_CHECKPOINT_RECORD_SCHEMA,
        "index": index,
        "id": prompt.record_id,
        "seed": seed,
        "request_sha256": sha256_bytes(request_payload),
        "raw_response_sha256": sha256_bytes(response_payload),
        "raw_response_base64": base64.b64encode(response_payload).decode("ascii"),
        "draft_response_sha256": sha256_bytes(content.encode("utf-8")),
        "finish_reason": finish_reason,
        "status": "teacher-draft-not-training-approved",
    }
    atomic_write_bytes(record_path, canonical_json_bytes(value) + b"\n")


def publish_new_directory(staging: Path, output_dir: Path) -> None:
    """Atomically publish a new bundle without accepting an ambiguous move."""
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    try:
        os.rename(staging, output_dir)
    except PermissionError:
        # Windows can report AccessDenied after a directory move has completed.
        if staging.exists() or not output_dir.is_dir() or output_dir.is_symlink():
            raise


def collect_drafts(
    plan: CollectionPlan,
    output_dir: Path,
    transport: Transport | None = None,
    *,
    checkpoint_dir: Path | None = None,
) -> None:
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    checkpoint_path = None
    checkpoint_records: dict[int, tuple[bytes, str, str]] = {}
    if checkpoint_dir is not None:
        checkpoint_path = initialize_collection_checkpoint(plan, checkpoint_dir)
        # Validate every durable record before issuing another teacher request.
        checkpoint_records = load_collection_checkpoint_records(plan, checkpoint_path)
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    sender = transport or post_json
    try:
        raw_dir = staging / "raw"
        draft_dir = staging / "drafts"
        raw_dir.mkdir()
        draft_dir.mkdir()
        teacher = plan.control["teacher"]
        generation = plan.control["generation"]
        records = []
        for index, prompt in enumerate(plan.prompts):
            request_payload, seed = build_teacher_request(plan, prompt, index)
            if index in checkpoint_records:
                response_payload, content, finish_reason = checkpoint_records[index]
                print(
                    f"teacher draft {index + 1}/{len(plan.prompts)} "
                    f"{prompt.record_id}: resumed",
                    file=sys.stderr,
                    flush=True,
                )
            else:
                response_payload = sender(
                    teacher["endpoint"], request_payload, generation["timeout_seconds"]
                )
                content, finish_reason = parse_teacher_response(
                    response_payload, prompt.record_id
                )
                if checkpoint_path is not None:
                    write_collection_checkpoint_record(
                        checkpoint_path,
                        index,
                        prompt,
                        seed,
                        request_payload,
                        response_payload,
                        content,
                        finish_reason,
                    )
                print(
                    f"teacher draft {index + 1}/{len(plan.prompts)} "
                    f"{prompt.record_id}: collected",
                    file=sys.stderr,
                    flush=True,
                )
            raw_relative = f"raw/{index:06d}-{prompt.record_id}.response.json"
            draft_relative = f"drafts/{index:06d}-{prompt.record_id}.txt"
            raw_path = staging / raw_relative
            draft_path = staging / draft_relative
            raw_path.write_bytes(response_payload)
            draft_path.write_bytes(content.encode("utf-8"))
            records.append(
                {
                    "id": prompt.record_id,
                    "task_family": prompt.task_family,
                    "prompt_sha256": sha256_bytes(prompt.prompt.encode("utf-8")),
                    "response_requirements": list(prompt.response_requirements),
                    "max_tokens": prompt.max_tokens,
                    "seed": seed,
                    "request_sha256": sha256_bytes(request_payload),
                    "raw_response_file": raw_relative,
                    "raw_response_sha256": sha256_bytes(response_payload),
                    "draft_file": draft_relative,
                    "draft_response_sha256": sha256_bytes(content.encode("utf-8")),
                    "finish_reason": finish_reason,
                    "review_status": "not-reviewed",
                    **(
                        {"history_sha256": history_sha256(prompt.history)}
                        if prompt.history
                        else {}
                    ),
                }
            )
        manifest = {
            "schema": DRAFT_MANIFEST_SCHEMA,
            "campaign_id": plan.control["campaign_id"],
            "status": "drafts-collected-not-training-approved",
            "control_path": str(plan.control_path),
            "control_sha256": plan.control_sha256,
            "prompt_plan_path": str(plan.prompt_plan_path),
            "prompt_plan_sha256": plan.prompt_plan_sha256,
            "system_prompt_path": str(plan.system_prompt_path),
            "system_prompt_sha256": plan.system_prompt_sha256,
            "source_id": plan.control["source_id"],
            "source_license": plan.control["source_license"],
            "teacher": {
                "model_id": teacher["model_id"],
                "revision": teacher["revision"],
                "license": teacher["license"],
                "weight_file": str(plan.teacher_weight_path),
                "weight_sha256": plan.teacher_weight_sha256,
                "tokenizer_identity_file": str(plan.teacher_tokenizer_path),
                "tokenizer_identity_sha256": plan.teacher_tokenizer_sha256,
                "endpoint": teacher["endpoint"],
            },
            "generation": {
                "temperature": generation["temperature"],
                "top_p": generation["top_p"],
                "top_k": generation["top_k"],
                "max_tokens": generation["max_tokens"],
                "seed": generation["seed"],
                "reasoning_policy": "disabled-final-answer-only",
                "response_contract_policy": "prompt-plan-system-suffix-v1",
                "one_call_per_record": True,
            },
            "eval_exclusions": [
                {
                    "path": str(exclusion.path),
                    "sha256": exclusion.sha256,
                    "prompt_count": exclusion.prompt_count,
                }
                for exclusion in plan.exclusions
            ],
            "record_count": len(records),
            "records": records,
            "required_next_gate": "explicit-hash-bound-record-review",
        }
        (staging / "teacher-draft-manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def safe_bundle_file(bundle_dir: Path, relative: str, label: str) -> Path:
    path_value = Path(relative)
    if path_value.is_absolute() or ".." in path_value.parts:
        raise ValueError(f"{label} must be a safe relative path")
    path = bundle_dir / path_value
    if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(bundle_dir):
        raise ValueError(f"{label} must stay inside the draft bundle")
    return path


def validate_draft_bundle(bundle_dir: Path) -> dict[str, Any]:
    bundle_dir = bundle_dir.resolve()
    manifest_path = bundle_dir / "teacher-draft-manifest.json"
    manifest = read_json_object(manifest_path, MAX_PROMPT_PLAN_BYTES, "draft manifest")
    if manifest.get("schema") != DRAFT_MANIFEST_SCHEMA:
        raise ValueError("draft manifest schema is unsupported")
    if manifest.get("status") != "drafts-collected-not-training-approved":
        raise ValueError("draft manifest status is not reviewable")
    records = manifest.get("records")
    if not isinstance(records, list) or not records or manifest.get("record_count") != len(records):
        raise ValueError("draft manifest record_count is invalid")
    prompt_plan_path = Path(require_string(manifest, "prompt_plan_path", "manifest"))
    if sha256_file(prompt_plan_path) != require_sha256(
        require_string(manifest, "prompt_plan_sha256", "manifest"),
        "manifest.prompt_plan_sha256",
    ):
        raise ValueError("draft prompt plan has drifted")
    prompt_by_id = {record.record_id: record for record in read_prompt_plan(prompt_plan_path)}
    seen = set()
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("draft manifest record must be a JSON object")
        record_id = validate_slug(require_string(record, "id", "record"), "record.id")
        if record_id in seen or record_id not in prompt_by_id:
            raise ValueError("draft manifest has duplicate or unknown record ids")
        seen.add(record_id)
        prompt = prompt_by_id[record_id]
        if (
            record.get("task_family") != prompt.task_family
            or record.get("prompt_sha256") != sha256_bytes(prompt.prompt.encode("utf-8"))
            or (
                bool(prompt.history)
                and record.get("history_sha256") != history_sha256(prompt.history)
            )
            or record.get("response_requirements") != list(prompt.response_requirements)
            or record.get("max_tokens") != prompt.max_tokens
            or record.get("review_status") != "not-reviewed"
        ):
            raise ValueError(f"draft metadata has drifted for {record_id}")
        raw_path = safe_bundle_file(
            bundle_dir,
            require_string(record, "raw_response_file", "record"),
            "raw_response_file",
        )
        draft_path = safe_bundle_file(
            bundle_dir,
            require_string(record, "draft_file", "record"),
            "draft_file",
        )
        raw_payload = read_regular_bytes(raw_path, MAX_API_RESPONSE_BYTES, "raw response")
        draft_payload = read_regular_bytes(draft_path, MAX_RECORD_BYTES, "draft response")
        if sha256_bytes(raw_payload) != record.get("raw_response_sha256"):
            raise ValueError(f"raw response has drifted for {record_id}")
        if sha256_bytes(draft_payload) != record.get("draft_response_sha256"):
            raise ValueError(f"draft response has drifted for {record_id}")
        content, finish_reason = parse_teacher_response(raw_payload, record_id)
        if content.encode("utf-8") != draft_payload or finish_reason != record.get("finish_reason"):
            raise ValueError(f"normalized teacher response has drifted for {record_id}")
    if set(prompt_by_id) != seen:
        raise ValueError("draft manifest does not cover the complete prompt plan")
    return manifest


def restore_derived_drafts(bundle_dir: Path) -> int:
    """Rebuild draft text bytes only when raw response and manifest agree."""
    bundle_dir = bundle_dir.resolve()
    manifest = read_json_object(
        bundle_dir / "teacher-draft-manifest.json",
        MAX_PROMPT_PLAN_BYTES,
        "draft manifest",
    )
    if (
        manifest.get("schema") != DRAFT_MANIFEST_SCHEMA
        or manifest.get("status") != "drafts-collected-not-training-approved"
    ):
        raise ValueError("draft manifest is not a restorable draft bundle")
    records = manifest.get("records")
    if not isinstance(records, list) or not records:
        raise ValueError("draft manifest has no restorable records")
    restored = 0
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("draft manifest record must be a JSON object")
        record_id = validate_slug(require_string(record, "id", "record"), "record.id")
        raw_path = safe_bundle_file(
            bundle_dir,
            require_string(record, "raw_response_file", "record"),
            "raw_response_file",
        )
        draft_path = safe_bundle_file(
            bundle_dir,
            require_string(record, "draft_file", "record"),
            "draft_file",
        )
        raw_payload = read_regular_bytes(raw_path, MAX_API_RESPONSE_BYTES, "raw response")
        if sha256_bytes(raw_payload) != record.get("raw_response_sha256"):
            raise ValueError(f"raw response has drifted for {record_id}")
        content, finish_reason = parse_teacher_response(raw_payload, record_id)
        content_payload = content.encode("utf-8")
        if (
            sha256_bytes(content_payload) != record.get("draft_response_sha256")
            or finish_reason != record.get("finish_reason")
        ):
            raise ValueError(f"raw response does not match manifest for {record_id}")
        if draft_path.read_bytes() != content_payload:
            draft_path.write_bytes(content_payload)
            restored += 1
    validate_draft_bundle(bundle_dir)
    return restored


def prepare_review_workbook(
    bundle_dir: Path, output_dir: Path
) -> dict[str, Any]:
    bundle_dir = bundle_dir.resolve()
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    manifest = validate_draft_bundle(bundle_dir)
    prompt_by_id = {
        prompt.record_id: prompt
        for prompt in read_prompt_plan(Path(manifest["prompt_plan_path"]))
    }
    decisions = []
    contexts = []
    for record in manifest["records"]:
        record_id = validate_slug(require_string(record, "id", "record"), "record.id")
        prompt = prompt_by_id[record_id]
        draft_path = safe_bundle_file(
            bundle_dir,
            require_string(record, "draft_file", "record"),
            "draft_file",
        )
        try:
            draft_response = draft_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"draft response for {record_id} is not UTF-8") from error
        decisions.append(
            {
                "id": record_id,
                "decision": "pending",
                "draft_response_sha256": record["draft_response_sha256"],
                "reviewed_response": draft_response,
                "reviewer_id": PENDING_REVIEWER_ID,
                "review_note": PENDING_REVIEW_NOTE,
                "factuality": "pending",
                "instruction_following": "pending",
                "safety": "pending",
                "conciseness": "pending",
                "hidden_reasoning_absent": "pending",
            }
        )
        contexts.append(
            {
                "schema": REVIEW_CONTEXT_RECORD_SCHEMA,
                "id": record_id,
                "task_family": prompt.task_family,
                "prompt": render_role_conversation(prompt.history, prompt.prompt)
                if prompt.history
                else prompt.prompt,
                "response_requirements": list(prompt.response_requirements),
                "max_tokens": prompt.max_tokens,
                "seed": record["seed"],
                "request_sha256": record["request_sha256"],
                "finish_reason": record["finish_reason"],
                "draft_response": draft_response,
                "draft_response_sha256": record["draft_response_sha256"],
            }
        )

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        decisions_path = staging / "review-decisions.jsonl"
        decisions_path.write_bytes(
            b"".join(canonical_json_bytes(value) + b"\n" for value in decisions)
        )
        context_path = staging / "review-context.jsonl"
        context_path.write_bytes(
            b"".join(canonical_json_bytes(value) + b"\n" for value in contexts)
        )
        receipt = {
            "schema": REVIEW_WORKBOOK_RECEIPT_SCHEMA,
            "campaign_id": manifest["campaign_id"],
            "draft_manifest_path": str(
                bundle_dir / "teacher-draft-manifest.json"
            ),
            "draft_manifest_sha256": sha256_file(
                bundle_dir / "teacher-draft-manifest.json"
            ),
            "review_decisions_file": "review-decisions.jsonl",
            "review_decisions_sha256": sha256_file(decisions_path),
            "review_context_file": "review-context.jsonl",
            "review_context_sha256": sha256_file(context_path),
            "record_count": len(decisions),
            "pending_count": len(decisions),
            "status": "pending-explicit-record-review-not-training-approved",
            "required_next_gate": "resolve-every-pending-review-decision",
        }
        (staging / "review-workbook-receipt.json").write_text(
            json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return receipt


def read_review_decisions(path: Path) -> dict[str, dict[str, Any]]:
    payload = read_regular_bytes(path, MAX_PROMPT_PLAN_BYTES, "review decisions")
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("review decisions must be UTF-8") from error
    decisions: dict[str, dict[str, Any]] = {}
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid review JSONL at line {line_number}") from error
        if not isinstance(value, dict):
            raise ValueError(f"review line {line_number} must be a JSON object")
        require_exact_keys(value, REVIEW_KEYS, f"review line {line_number}")
        record_id = validate_slug(require_string(value, "id", "review"), "review.id")
        if record_id in decisions:
            raise ValueError("review decisions contain duplicate ids")
        decision = require_string(value, "decision", "review")
        if decision not in {"approved", "rejected", "pending"}:
            raise ValueError(f"review decision for {record_id} is unsupported")
        require_sha256(
            require_string(value, "draft_response_sha256", "review"),
            "review.draft_response_sha256",
        )
        reviewer_id = validate_slug(
            require_string(value, "reviewer_id", "review"), "reviewer_id"
        )
        review_note = validate_evidence(
            require_string(value, "review_note", "review"), "review_note"
        )
        reviewed_response = value.get("reviewed_response")
        if not isinstance(reviewed_response, str) or "\0" in reviewed_response:
            raise ValueError(f"reviewed_response for {record_id} is invalid")
        if len(reviewed_response.encode("utf-8")) > MAX_RECORD_BYTES:
            raise ValueError(f"reviewed_response for {record_id} is too large")
        for field in APPROVAL_FIELDS:
            if value.get(field) not in {
                "pass",
                "fail",
                "not-applicable",
                "pending",
            }:
                raise ValueError(f"review {field} for {record_id} is invalid")
        if decision != "pending":
            pending_fields = [
                field for field in APPROVAL_FIELDS if value[field] == "pending"
            ]
            if pending_fields:
                raise ValueError(
                    f"resolved review {record_id} has pending checklist fields: "
                    f"{pending_fields}"
                )
            if reviewer_id == PENDING_REVIEWER_ID or review_note == PENDING_REVIEW_NOTE:
                raise ValueError(
                    f"resolved review {record_id} still has pending reviewer metadata"
                )
        if decision == "approved":
            if not reviewed_response.strip():
                raise ValueError(f"approved review {record_id} has no final response")
            if any(value[field] not in {"pass", "not-applicable"} for field in APPROVAL_FIELDS):
                raise ValueError(f"approved review {record_id} has a failed checklist item")
            if value["instruction_following"] != "pass" or value["safety"] != "pass":
                raise ValueError(f"approved review {record_id} must pass instruction and safety")
            if value["hidden_reasoning_absent"] != "pass":
                raise ValueError(f"approved review {record_id} must exclude hidden reasoning")
        elif decision == "rejected" and reviewed_response:
            raise ValueError(f"rejected review {record_id} must not carry a training response")
        decisions[record_id] = value
    if not decisions:
        raise ValueError("review decisions are empty")
    return decisions


def export_reviewed(
    bundle_dir: Path, decisions_path: Path, output_dir: Path
) -> dict[str, Any]:
    bundle_dir = bundle_dir.resolve()
    decisions_path = decisions_path.resolve()
    output_dir = output_dir.resolve()
    if output_dir.exists():
        raise ValueError(f"output_dir must not already exist: {output_dir}")
    manifest = validate_draft_bundle(bundle_dir)
    decisions = read_review_decisions(decisions_path)
    records = {record["id"]: record for record in manifest["records"]}
    if set(decisions) != set(records):
        missing = sorted(set(records) - set(decisions))
        unknown = sorted(set(decisions) - set(records))
        raise ValueError(f"review coverage mismatch; missing={missing}; unknown={unknown}")
    pending = sorted(
        record_id
        for record_id, decision in decisions.items()
        if decision["decision"] == "pending"
    )
    if pending:
        raise ValueError(f"pending review decisions must be resolved: {pending}")

    exclusions = []
    for identity in manifest.get("eval_exclusions", []):
        path = Path(require_string(identity, "path", "eval exclusion identity"))
        exclusions.append(
            read_exclusion(
                path,
                require_sha256(
                    require_string(identity, "sha256", "eval exclusion identity"),
                    "eval exclusion identity sha256",
                ),
            )
        )
    exclusion_index = build_exclusion_index(tuple(exclusions))
    prompt_by_id = {
        record.record_id: record
        for record in read_prompt_plan(Path(manifest["prompt_plan_path"]))
    }
    approved = []
    family_counts: Counter[str] = Counter()
    reviewers = set()
    for record_id in sorted(records):
        record = records[record_id]
        decision = decisions[record_id]
        if decision["draft_response_sha256"] != record["draft_response_sha256"]:
            raise ValueError(f"review decision for {record_id} targets stale draft bytes")
        reviewers.add(decision["reviewer_id"])
        if decision["decision"] == "rejected":
            continue
        if record["finish_reason"] != "stop":
            raise ValueError(f"approved review {record_id} came from a truncated teacher draft")
        response = decision["reviewed_response"]
        reject_hidden_reasoning_or_secret(response, record_id)
        prompt = prompt_by_id[record_id]
        reject_contamination(record_id, "prompt", prompt.prompt, exclusion_index)
        if prompt.history:
            reject_contamination(
                record_id,
                "role history",
                render_role_content(prompt.history, prompt.prompt),
                exclusion_index,
            )
        reject_contamination(record_id, "response", response, exclusion_index)
        family_counts[prompt.task_family] += 1
        approved_record = {
                "id": record_id,
                "task_family": prompt.task_family,
                "prompt": prompt.prompt,
                "response": response,
                "source_id": manifest["source_id"],
                "source_license": manifest["source_license"],
                "source_record_id": f"{manifest['campaign_id']}-{record_id}",
            }
        if prompt.history:
            approved_record["history"] = [
                {"role": message.role, "content": message.content}
                for message in prompt.history
            ]
        approved.append(approved_record)
    if not approved:
        raise ValueError("review export contains no approved records")

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )
    try:
        output_path = staging / "reviewed-teacher-output.jsonl"
        output_path.write_bytes(
            b"".join(canonical_json_bytes(record) + b"\n" for record in approved)
        )
        receipt = {
            "schema": REVIEW_RECEIPT_SCHEMA,
            "campaign_id": manifest["campaign_id"],
            "draft_manifest_path": str(bundle_dir / "teacher-draft-manifest.json"),
            "draft_manifest_sha256": sha256_file(
                bundle_dir / "teacher-draft-manifest.json"
            ),
            "review_decisions_path": str(decisions_path),
            "review_decisions_sha256": sha256_file(decisions_path),
            "reviewed_output_file": "reviewed-teacher-output.jsonl",
            "reviewed_output_sha256": sha256_file(output_path),
            "draft_count": len(records),
            "approved_count": len(approved),
            "rejected_count": len(records) - len(approved),
            "reviewer_ids": sorted(reviewers),
            "approved_task_family_counts": dict(sorted(family_counts.items())),
            "teacher_weight_sha256": manifest["teacher"]["weight_sha256"],
            "teacher_tokenizer_sha256": manifest["teacher"][
                "tokenizer_identity_sha256"
            ],
            "eval_exclusions": manifest["eval_exclusions"],
            "status": "reviewed-export-not-yet-frozen",
            "required_next_gate": "prepare-distillation-dataset-plus-rust-contamination-freeze",
        }
        (staging / "review-export-receipt.json").write_text(
            json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    collect = subparsers.add_parser("collect")
    collect.add_argument("control", type=Path)
    collect.add_argument("output_dir", type=Path)
    collect.add_argument("--checkpoint-dir", type=Path)
    collect.add_argument("--verify-only", action="store_true")

    validate = subparsers.add_parser("validate-drafts")
    validate.add_argument("draft_dir", type=Path)

    restore = subparsers.add_parser("restore-derived-drafts")
    restore.add_argument("draft_dir", type=Path)

    prepare_review = subparsers.add_parser("prepare-review")
    prepare_review.add_argument("draft_dir", type=Path)
    prepare_review.add_argument("output_dir", type=Path)

    export = subparsers.add_parser("export-reviewed")
    export.add_argument("draft_dir", type=Path)
    export.add_argument("review_decisions", type=Path)
    export.add_argument("output_dir", type=Path)

    args = parser.parse_args()
    if args.command == "collect":
        plan = build_collection_plan(args.control)
        if not args.verify_only:
            collect_drafts(
                plan, args.output_dir, checkpoint_dir=args.checkpoint_dir
            )
        result = {
            "status": "pass",
            "campaign_id": plan.control["campaign_id"],
            "record_count": len(plan.prompts),
            "task_family_count": len({record.task_family for record in plan.prompts}),
            "output_dir": str(args.output_dir.resolve()),
            "required_next_gate": "collect" if args.verify_only else "validate-drafts",
        }
        if args.checkpoint_dir is not None:
            if args.verify_only and not args.checkpoint_dir.exists():
                result["checkpoint_status"] = "not-created"
            else:
                checkpoint_result = validate_collection_checkpoint(
                    plan, args.checkpoint_dir
                )
                result["checkpoint_status"] = checkpoint_result["status"]
                result["checkpoint_completed_record_count"] = checkpoint_result[
                    "completed_record_count"
                ]
                if (
                    args.verify_only
                    and checkpoint_result["complete"]
                    and args.output_dir.is_dir()
                    and not args.output_dir.is_symlink()
                ):
                    result["required_next_gate"] = "validate-drafts"
    elif args.command == "validate-drafts":
        manifest = validate_draft_bundle(args.draft_dir)
        result = {
            "status": "pass",
            "campaign_id": manifest["campaign_id"],
            "record_count": manifest["record_count"],
            "required_next_gate": "export-reviewed",
        }
    elif args.command == "restore-derived-drafts":
        restored_count = restore_derived_drafts(args.draft_dir)
        manifest = validate_draft_bundle(args.draft_dir)
        result = {
            "status": "pass",
            "campaign_id": manifest["campaign_id"],
            "record_count": manifest["record_count"],
            "restored_count": restored_count,
            "required_next_gate": "export-reviewed",
        }
    elif args.command == "prepare-review":
        result = prepare_review_workbook(args.draft_dir, args.output_dir)
    else:
        result = export_reviewed(
            args.draft_dir, args.review_decisions, args.output_dir
        )
    print(json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
