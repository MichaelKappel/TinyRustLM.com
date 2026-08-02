"""Build a provenance-bound teacher prompt plan from a pinned public dataset.

Public responses never enter the distillation dataset through this stage. The
output contains user prompts only and must still pass local teacher generation,
hash-bound review, dataset freezing, and excluded-evaluation checks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CONTROL_SCHEMA = "tinyrustlm.public_prompt_import.v1"
RECEIPT_SCHEMA = "tinyrustlm.public_prompt_import_receipt.v1"
MAX_CONTROL_BYTES = 16 * 1024 * 1024
MAX_DATASET_BYTES = 4 * 1024 * 1024 * 1024
MAX_PROMPT_BYTES = 64 * 1024
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
CONTROL_KEYS = {"schema", "campaign_id", "dataset", "selection", "eval_exclusions"}
DATASET_KEYS = {
    "repo_id",
    "revision",
    "split",
    "parquet_file",
    "parquet_sha256",
    "readme_file",
    "readme_sha256",
    "license",
    "dataset_url",
}
SELECTION_KEYS = {
    "seed",
    "groups",
    "max_prompt_bytes",
    "max_tokens",
    "near_duplicate_threshold",
}
GROUP_KEYS = {"id", "topics", "records_per_topic", "task_family"}
FILE_IDENTITY_KEYS = {"path", "sha256"}
PROMPT_KEYS = {"id", "task_family", "prompt", "response_requirements", "max_tokens"}
PROMPT_REQUIREMENTS = (
    "Answer the substantive user request directly and in no more than four concise sentences.",
    "Respect every explicit constraint in the user message.",
    "Do not claim to perform reminders, alerts, purchases, bookings, monitoring, or other external actions.",
    "State uncertainty instead of inventing current, personal, or location-specific facts.",
    "Return only the final answer with no hidden reasoning.",
)
GREETING_WORDS = {
    "hello",
    "hi",
    "hey",
    "hi there",
    "hello there",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
}


@dataclass(frozen=True)
class Exclusion:
    path: Path
    sha256: str
    prompts: tuple[str, ...]


@dataclass(frozen=True)
class SelectionGroup:
    group_id: str
    topics: tuple[str, ...]
    records_per_topic: int
    task_family: str


@dataclass(frozen=True)
class Candidate:
    row_index: int
    topic: str
    full_topic: str
    prompt: str
    selection_sha256: str


@dataclass(frozen=True)
class SelectedPrompt:
    record_id: str
    group_id: str
    task_family: str
    row_index: int
    topic: str
    full_topic: str
    prompt: str
    prompt_sha256: str
    selection_sha256: str
    max_tokens: int


@dataclass(frozen=True)
class ImportPlan:
    control_path: Path
    control_sha256: str
    dataset: dict[str, Any]
    parquet_path: Path
    parquet_sha256: str
    readme_path: Path
    readme_sha256: str
    pyarrow_version: str
    groups: tuple[SelectionGroup, ...]
    exclusions: tuple[Exclusion, ...]
    selected: tuple[SelectedPrompt, ...]
    rejection_counts: dict[str, int]


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


def validate_slug(value: str, label: str) -> str:
    if (
        not value
        or len(value) > 128
        or any(
            not (character.isascii() and (character.isalnum() or character in "._-"))
            for character in value
        )
    ):
        raise ValueError(f"{label} must be a stable ASCII slug")
    return value


def require_sha256(value: str, label: str) -> str:
    if (
        not value.startswith("sha256:")
        or len(value) != 71
        or any(character not in "0123456789abcdefABCDEF" for character in value[7:])
    ):
        raise ValueError(f"{label} must be a sha256: value")
    return value.lower()


def resolve_path(control_path: Path, value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = control_path.parent / path
    return path.resolve()


def normalized_words(text: str) -> tuple[str, ...]:
    words: list[str] = []
    current: list[str] = []
    for character in text:
        if character.isalnum():
            current.append(character.lower())
        elif current:
            words.append("".join(current))
            current = []
    if current:
        words.append("".join(current))
    return tuple(words)


def word_ngrams(words: tuple[str, ...]) -> frozenset[str]:
    return frozenset(
        " ".join(words[index : index + NGRAM_WORD_COUNT])
        for index in range(max(0, len(words) - NGRAM_WORD_COUNT + 1))
    )


def parse_manifest_fields(payload: bytes, label: str) -> dict[str, str]:
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
        key, value = line.split("=", 1)
        if not key or not value or key in fields:
            raise ValueError(f"{label} line {line_number} is invalid or duplicated")
        fields[key] = value
    return fields


def read_exclusion(path: Path, expected_sha256: str) -> Exclusion:
    payload = read_regular_bytes(path, MAX_CONTROL_BYTES, "eval exclusion")
    actual_sha256 = sha256_bytes(payload)
    if actual_sha256 != expected_sha256:
        raise ValueError(f"eval exclusion SHA-256 drift: {path}")
    fields = parse_manifest_fields(payload, "eval exclusion")
    if fields.get("tinyrustlm_eval_cases_version") != "1":
        raise ValueError(f"eval exclusion has an unsupported version: {path}")
    try:
        holdout_count = int(fields.get("holdout_count", "0"))
        case_count = int(fields["case_count"])
    except (KeyError, ValueError) as error:
        raise ValueError("eval exclusion counts must be integers") from error
    if holdout_count != 0 or case_count <= 0:
        raise ValueError("eval exclusions must be materialized and non-empty")
    prompts = tuple(fields[f"case.{index}.prompt"] for index in range(case_count))
    return Exclusion(path, actual_sha256, prompts)


def exclusion_index(
    exclusions: tuple[Exclusion, ...],
) -> tuple[frozenset[str], frozenset[str]]:
    exact: set[str] = set()
    ngrams: set[str] = set()
    for exclusion in exclusions:
        for prompt in exclusion.prompts:
            words = normalized_words(prompt)
            exact.add(" ".join(words))
            ngrams.update(word_ngrams(words))
    return frozenset(exact), frozenset(ngrams)


def substantive_user_prompt(messages: Any) -> str | None:
    if not isinstance(messages, list) or len(messages) < 2:
        return None
    for index, message in enumerate(messages):
        if not isinstance(message, dict):
            return None
        expected_role = "user" if index % 2 == 0 else "assistant"
        if message.get("role") != expected_role:
            return None
        content = message.get("content")
        if not isinstance(content, str) or not content.strip() or "\0" in content:
            return None
    for index in range(0, len(messages) - 1, 2):
        content = messages[index]["content"].strip()
        words = normalized_words(content)
        normalized = " ".join(words)
        if normalized in GREETING_WORDS or len(words) < 4:
            continue
        return content
    return None


def stable_slug(value: str) -> str:
    result: list[str] = []
    pending_separator = False
    for character in value.lower():
        if character.isascii() and character.isalnum():
            if pending_separator and result:
                result.append("-")
            result.append(character)
            pending_separator = False
        else:
            pending_separator = True
    return "".join(result).strip("-") or "topic"


def near_duplicate(
    candidate_ngrams: frozenset[str],
    selected_ngrams: list[frozenset[str]],
    threshold: float,
) -> bool:
    if not candidate_ngrams:
        return False
    for existing in selected_ngrams:
        union = candidate_ngrams | existing
        if union and len(candidate_ngrams & existing) / len(union) >= threshold:
            return True
    return False


def parse_groups(value: Any) -> tuple[SelectionGroup, ...]:
    if not isinstance(value, list) or not value:
        raise ValueError("selection.groups must be a non-empty list")
    groups: list[SelectionGroup] = []
    seen_ids: set[str] = set()
    seen_topics: set[str] = set()
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ValueError(f"selection.groups[{index}] must be an object")
        require_exact_keys(item, GROUP_KEYS, f"selection.groups[{index}]")
        group_id = validate_slug(
            require_string(item, "id", f"selection.groups[{index}]"), "group id"
        )
        if group_id in seen_ids:
            raise ValueError("selection group ids must be unique")
        seen_ids.add(group_id)
        raw_topics = item.get("topics")
        if (
            not isinstance(raw_topics, list)
            or not raw_topics
            or any(
                not isinstance(topic, str)
                or not topic
                or topic.strip() != topic
                or "\0" in topic
                for topic in raw_topics
            )
        ):
            raise ValueError(f"selection.groups[{index}].topics is invalid")
        topics = tuple(raw_topics)
        if len(set(topics)) != len(topics) or seen_topics.intersection(topics):
            raise ValueError("selection topics must be globally unique")
        seen_topics.update(topics)
        task_family = require_string(
            item, "task_family", f"selection.groups[{index}]"
        )
        if task_family not in TASK_FAMILIES:
            raise ValueError(f"selection group {group_id} has an unknown task family")
        groups.append(
            SelectionGroup(
                group_id,
                topics,
                require_integer(
                    item.get("records_per_topic"),
                    f"selection.groups[{index}].records_per_topic",
                    1,
                    10_000,
                ),
                task_family,
            )
        )
    return tuple(groups)


def build_import_plan(control_path: Path) -> ImportPlan:
    control_path = control_path.resolve()
    control = read_json_object(control_path, MAX_CONTROL_BYTES, "import control")
    require_exact_keys(control, CONTROL_KEYS, "import control")
    if control.get("schema") != CONTROL_SCHEMA:
        raise ValueError("import control schema is unsupported")
    validate_slug(require_string(control, "campaign_id", "control"), "campaign_id")

    dataset = control.get("dataset")
    selection = control.get("selection")
    if not isinstance(dataset, dict) or not isinstance(selection, dict):
        raise ValueError("dataset and selection must be JSON objects")
    require_exact_keys(dataset, DATASET_KEYS, "dataset")
    require_exact_keys(selection, SELECTION_KEYS, "selection")
    repo_id = require_string(dataset, "repo_id", "dataset")
    repo_parts = repo_id.split("/")
    if len(repo_parts) != 2 or any(
        not part
        or any(
            not (character.isascii() and (character.isalnum() or character in "._-"))
            for character in part
        )
        for part in repo_parts
    ):
        raise ValueError("dataset.repo_id must be an owner/name Hugging Face identifier")
    revision = require_string(dataset, "revision", "dataset")
    if len(revision) != 40 or any(character not in "0123456789abcdef" for character in revision):
        raise ValueError("dataset.revision must be a lowercase immutable commit SHA")
    license_id = require_string(dataset, "license", "dataset")
    if license_id != "apache-2.0":
        raise ValueError("this importer currently permits only apache-2.0 prompt sources")
    require_string(dataset, "split", "dataset")
    dataset_url = require_string(dataset, "dataset_url", "dataset")
    expected_url = f"https://huggingface.co/datasets/{repo_id}/tree/{revision}"
    if dataset_url != expected_url:
        raise ValueError(f"dataset.dataset_url must equal {expected_url}")

    parquet_path = resolve_path(
        control_path, require_string(dataset, "parquet_file", "dataset")
    )
    readme_path = resolve_path(
        control_path, require_string(dataset, "readme_file", "dataset")
    )
    verify_regular_file(parquet_path, MAX_DATASET_BYTES, "parquet")
    readme_payload = read_regular_bytes(readme_path, MAX_CONTROL_BYTES, "dataset readme")
    parquet_sha256 = sha256_file(parquet_path)
    readme_sha256 = sha256_bytes(readme_payload)
    if parquet_sha256 != require_sha256(
        require_string(dataset, "parquet_sha256", "dataset"), "dataset.parquet_sha256"
    ):
        raise ValueError("dataset parquet SHA-256 drift")
    if readme_sha256 != require_sha256(
        require_string(dataset, "readme_sha256", "dataset"), "dataset.readme_sha256"
    ):
        raise ValueError("dataset README SHA-256 drift")
    readme = readme_payload.decode("utf-8")
    if "license: apache-2.0" not in readme.lower():
        raise ValueError("dataset README does not declare license: apache-2.0")

    groups = parse_groups(selection.get("groups"))
    seed = require_integer(selection.get("seed"), "selection.seed", 0, 2**31 - 1)
    max_prompt_bytes = require_integer(
        selection.get("max_prompt_bytes"),
        "selection.max_prompt_bytes",
        32,
        MAX_PROMPT_BYTES,
    )
    max_tokens = require_integer(
        selection.get("max_tokens"), "selection.max_tokens", 16, 2048
    )
    duplicate_threshold = require_number(
        selection.get("near_duplicate_threshold"),
        "selection.near_duplicate_threshold",
        0.5,
        1.0,
    )

    raw_exclusions = control.get("eval_exclusions")
    if not isinstance(raw_exclusions, list) or not raw_exclusions:
        raise ValueError("eval_exclusions must be a non-empty list")
    exclusions: list[Exclusion] = []
    seen_exclusion_paths: set[Path] = set()
    for index, item in enumerate(raw_exclusions):
        if not isinstance(item, dict):
            raise ValueError(f"eval_exclusions[{index}] must be an object")
        require_exact_keys(item, FILE_IDENTITY_KEYS, f"eval_exclusions[{index}]")
        path = resolve_path(
            control_path, require_string(item, "path", f"eval_exclusions[{index}]")
        )
        if path in seen_exclusion_paths:
            raise ValueError("eval exclusion paths must be unique")
        seen_exclusion_paths.add(path)
        exclusions.append(
            read_exclusion(
                path,
                require_sha256(
                    require_string(item, "sha256", f"eval_exclusions[{index}]"),
                    f"eval_exclusions[{index}].sha256",
                ),
            )
        )
    exclusion_tuple = tuple(exclusions)
    blocked_exact, blocked_ngrams = exclusion_index(exclusion_tuple)

    try:
        import pyarrow
        import pyarrow.parquet as parquet
    except ImportError as error:
        raise RuntimeError("public prompt import requires pyarrow") from error
    parquet_file = parquet.ParquetFile(parquet_path)
    try:
        if (
            parquet_file.metadata.num_rows <= 0
            or parquet_file.metadata.num_rows > 10_000_000
        ):
            raise ValueError("dataset parquet row count must be in 1..=10000000")
        if (
            parquet_file.metadata.num_row_groups <= 0
            or parquet_file.metadata.num_row_groups > 100_000
        ):
            raise ValueError("dataset parquet row-group count must be in 1..=100000")
        table = parquet_file.read(
            columns=["topic", "full_topic", "messages"], use_threads=False
        )
        required_columns = {"topic", "full_topic", "messages"}
        if not required_columns.issubset(table.column_names):
            raise ValueError(
                "dataset schema is missing columns: "
                f"{sorted(required_columns - set(table.column_names))}"
            )
        rows = table.select(sorted(required_columns)).to_pylist()
    finally:
        parquet_file.close()
    candidates_by_topic: dict[str, list[Candidate]] = defaultdict(list)
    rejection_counts: Counter[str] = Counter()
    allowed_topics = {topic for group in groups for topic in group.topics}
    for row_index, row in enumerate(rows):
        topic = row.get("topic")
        full_topic = row.get("full_topic")
        if topic not in allowed_topics:
            continue
        if not isinstance(full_topic, str) or not full_topic.strip():
            rejection_counts["invalid_topic"] += 1
            continue
        prompt = substantive_user_prompt(row.get("messages"))
        if prompt is None:
            rejection_counts["no_substantive_user_turn"] += 1
            continue
        prompt_payload = prompt.encode("utf-8")
        if len(prompt_payload) > max_prompt_bytes:
            rejection_counts["prompt_too_large"] += 1
            continue
        words = normalized_words(prompt)
        normalized = " ".join(words)
        if normalized in blocked_exact:
            rejection_counts["eval_exact_overlap"] += 1
            continue
        ngrams = word_ngrams(words)
        if ngrams.intersection(blocked_ngrams):
            rejection_counts["eval_five_gram_overlap"] += 1
            continue
        selection_sha256 = sha256_bytes(
            str(seed).encode("ascii")
            + b"\0"
            + str(row_index).encode("ascii")
            + b"\0"
            + full_topic.encode("utf-8")
            + b"\0"
            + prompt_payload
        )
        candidates_by_topic[topic].append(
            Candidate(row_index, topic, full_topic, prompt, selection_sha256)
        )

    selected: list[SelectedPrompt] = []
    selected_normalized: set[str] = set()
    selected_ngrams: list[frozenset[str]] = []
    for group in groups:
        for topic in group.topics:
            topic_selected = 0
            for candidate in sorted(
                candidates_by_topic.get(topic, ()), key=lambda item: item.selection_sha256
            ):
                words = normalized_words(candidate.prompt)
                normalized = " ".join(words)
                ngrams = word_ngrams(words)
                if normalized in selected_normalized:
                    rejection_counts["exact_duplicate"] += 1
                    continue
                if near_duplicate(ngrams, selected_ngrams, duplicate_threshold):
                    rejection_counts["near_duplicate"] += 1
                    continue
                digest = hashlib.sha256(
                    (
                        f"{repo_id}\0{revision}\0{candidate.row_index}\0{candidate.prompt}"
                    ).encode("utf-8")
                ).hexdigest()
                record_id = validate_slug(
                    f"public-{group.group_id}-{stable_slug(topic)[:40]}-{digest[:16]}",
                    "generated record id",
                )
                selected.append(
                    SelectedPrompt(
                        record_id,
                        group.group_id,
                        group.task_family,
                        candidate.row_index,
                        topic,
                        candidate.full_topic,
                        candidate.prompt,
                        sha256_bytes(candidate.prompt.encode("utf-8")),
                        candidate.selection_sha256,
                        max_tokens,
                    )
                )
                selected_normalized.add(normalized)
                selected_ngrams.append(ngrams)
                topic_selected += 1
                if topic_selected == group.records_per_topic:
                    break
            if topic_selected != group.records_per_topic:
                raise ValueError(
                    f"topic {topic!r} selected {topic_selected} records, expected {group.records_per_topic}"
                )
    selected.sort(key=lambda record: record.record_id)
    if len({record.record_id for record in selected}) != len(selected):
        raise RuntimeError("generated prompt ids are not unique")

    return ImportPlan(
        control_path,
        sha256_file(control_path),
        dataset,
        parquet_path,
        parquet_sha256,
        readme_path,
        readme_sha256,
        pyarrow.__version__,
        groups,
        exclusion_tuple,
        tuple(selected),
        dict(sorted(rejection_counts.items())),
    )


def prompt_plan_payload(plan: ImportPlan) -> bytes:
    lines = []
    for record in plan.selected:
        lines.append(
            canonical_json_bytes(
                {
                    "id": record.record_id,
                    "task_family": record.task_family,
                    "prompt": record.prompt,
                    "response_requirements": list(PROMPT_REQUIREMENTS),
                    "max_tokens": record.max_tokens,
                }
            )
        )
    return b"\n".join(lines) + b"\n"


def publish_new_directory(staging: Path, output_dir: Path) -> None:
    if output_dir.exists():
        raise ValueError(f"output directory already exists: {output_dir}")
    try:
        os.replace(staging, output_dir)
    except PermissionError:
        shutil.copytree(staging, output_dir, copy_function=shutil.copy2)
        shutil.rmtree(staging)


def write_import_bundle(plan: ImportPlan, output_dir: Path) -> None:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.", dir=output_dir.parent))
    try:
        prompt_payload = prompt_plan_payload(plan)
        prompt_path = staging / "prompt-plan.jsonl"
        prompt_path.write_bytes(prompt_payload)
        group_counts = Counter(record.group_id for record in plan.selected)
        family_counts = Counter(record.task_family for record in plan.selected)
        receipt = {
            "schema": RECEIPT_SCHEMA,
            "status": "public-prompts-selected-not-training-approved",
            "control_path": str(plan.control_path),
            "control_sha256": plan.control_sha256,
            "dataset": {
                "repo_id": plan.dataset["repo_id"],
                "revision": plan.dataset["revision"],
                "split": plan.dataset["split"],
                "license": plan.dataset["license"],
                "dataset_url": plan.dataset["dataset_url"],
                "parquet_path": str(plan.parquet_path),
                "parquet_bytes": plan.parquet_path.stat().st_size,
                "parquet_sha256": plan.parquet_sha256,
                "readme_path": str(plan.readme_path),
                "readme_bytes": plan.readme_path.stat().st_size,
                "readme_sha256": plan.readme_sha256,
            },
            "reader": {"name": "pyarrow", "version": plan.pyarrow_version},
            "eval_exclusions": [
                {
                    "path": str(exclusion.path),
                    "sha256": exclusion.sha256,
                    "prompt_count": len(exclusion.prompts),
                }
                for exclusion in plan.exclusions
            ],
            "record_count": len(plan.selected),
            "group_counts": dict(sorted(group_counts.items())),
            "task_family_counts": dict(sorted(family_counts.items())),
            "rejection_counts": plan.rejection_counts,
            "prompt_plan_file": "prompt-plan.jsonl",
            "prompt_plan_bytes": len(prompt_payload),
            "prompt_plan_sha256": sha256_bytes(prompt_payload),
            "records": [
                {
                    "id": record.record_id,
                    "group_id": record.group_id,
                    "task_family": record.task_family,
                    "dataset_row_index": record.row_index,
                    "topic": record.topic,
                    "full_topic": record.full_topic,
                    "prompt_sha256": record.prompt_sha256,
                    "selection_sha256": record.selection_sha256,
                }
                for record in plan.selected
            ],
            "required_next_gate": "pinned-local-teacher-generation-and-hash-bound-review",
        }
        (staging / "public-prompt-import-receipt.json").write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        publish_new_directory(staging, output_dir)
    except Exception:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        raise


def verification_summary(plan: ImportPlan) -> dict[str, Any]:
    return {
        "status": "pass",
        "dataset_repo_id": plan.dataset["repo_id"],
        "dataset_revision": plan.dataset["revision"],
        "record_count": len(plan.selected),
        "group_counts": dict(sorted(Counter(record.group_id for record in plan.selected).items())),
        "task_family_counts": dict(
            sorted(Counter(record.task_family for record in plan.selected).items())
        ),
        "prompt_plan_sha256": sha256_bytes(prompt_plan_payload(plan)),
        "required_next_gate": "write-bundle" if plan.selected else "blocked",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("control", type=Path)
    parser.add_argument("output_dir", type=Path, nargs="?")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    plan = build_import_plan(args.control)
    if args.verify_only:
        print(json.dumps(verification_summary(plan), indent=2, sort_keys=True))
        return
    if args.output_dir is None:
        parser.error("output_dir is required unless --verify-only is used")
    write_import_bundle(plan, args.output_dir)
    print(json.dumps(verification_summary(plan), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
