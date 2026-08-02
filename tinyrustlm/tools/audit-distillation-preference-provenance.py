"""Audit whether a frozen distillation corpus authorizes preference training.

An approved or rewritten SFT target is not automatically a pairwise preference
label. This tool revalidates the frozen dataset, draft bundles, review decisions,
and reviewed exports, then emits a text-free report describing what evidence is
and is not present. It never promotes edited drafts into DPO/ORPO pairs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


CONTROL_SCHEMA = "tinyrustlm.preference_provenance_audit_control.v1"
REPORT_SCHEMA = "tinyrustlm.preference_provenance_audit_report.v1"
TOOL_VERSION = "1"
MAX_CONTROL_BYTES = 16 * 1024 * 1024
MAX_MANIFEST_BYTES = 256 * 1024 * 1024
MAX_JSONL_BYTES = 1024 * 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024

CONTROL_KEYS = {
    "schema",
    "audit_id",
    "repository_root",
    "frozen_dataset",
    "bundles",
}
FILE_IDENTITY_KEYS = {"path", "sha256"}
BUNDLE_KEYS = {
    "bundle_id",
    "source_id",
    "draft_manifest",
    "review_decisions",
    "reviewed_output",
}


@dataclass(frozen=True)
class DatasetRecord:
    record_id: str
    source_id: str
    source_record_id: str
    response_sha256: str
    response_bytes: bytes


@dataclass(frozen=True)
class BundleRecord:
    bundle_id: str
    source_id: str
    record_id: str
    source_record_id: str | None
    prompt_sha256: str
    response_requirements: tuple[str, ...]
    finish_reason: str
    draft_response_sha256: str
    draft_bytes: bytes
    decision: str
    reviewer_id: str
    reviewed_response: str

    @property
    def changed(self) -> bool:
        return (
            self.decision == "approved"
            and self.draft_bytes != self.reviewed_response.encode("utf-8")
        )


@dataclass(frozen=True)
class Bundle:
    bundle_id: str
    source_id: str
    campaign_id: str
    records: tuple[BundleRecord, ...]
    identities: dict[str, dict[str, str]]


@dataclass(frozen=True)
class AuditPlan:
    control_path: Path
    control_sha256: str
    audit_id: str
    repository_root: Path
    dataset_identity: dict[str, str]
    bundle_controls: tuple[dict[str, Any], ...]


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
    if not isinstance(result, str) or not result or result.strip() != result:
        raise ValueError(f"{label}.{key} must be a non-empty trimmed string")
    if any(character in result for character in "\r\n\0"):
        raise ValueError(f"{label}.{key} contains a forbidden character")
    return result


def require_stable_id(value: str, label: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", value):
        raise ValueError(f"{label} must be a stable ASCII identifier")
    return value


def require_sha256(value: str, label: str) -> str:
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", value):
        raise ValueError(f"{label} must be a lowercase sha256 identity")
    return value


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


def resolve_repository_path(root: Path, path_text: str, label: str) -> Path:
    pure = PurePosixPath(path_text)
    if pure.is_absolute() or not pure.parts or any(part in {"", ".", ".."} for part in pure.parts):
        raise ValueError(f"{label} must be a normalized repository-relative path")
    if "\\" in path_text:
        raise ValueError(f"{label} must use forward slashes")
    candidate = root.joinpath(*pure.parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"{label} escapes repository_root") from error
    return candidate


def verify_file_identity(
    root: Path, value: Any, maximum: int, label: str
) -> tuple[dict[str, str], Path]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    require_exact_keys(value, FILE_IDENTITY_KEYS, label)
    path_text = require_string(value, "path", label)
    expected_sha256 = require_sha256(
        require_string(value, "sha256", label), f"{label}.sha256"
    )
    path = resolve_repository_path(root, path_text, f"{label}.path")
    read_regular_bytes(path, maximum, label)
    actual_sha256 = sha256_file(path)
    if actual_sha256 != expected_sha256:
        raise ValueError(
            f"{label} SHA-256 drift: expected {expected_sha256}, got {actual_sha256}"
        )
    return {"path": path_text, "sha256": actual_sha256}, path


def load_control(control_path: Path) -> AuditPlan:
    control_path = control_path.resolve()
    value = read_json_object(control_path, MAX_CONTROL_BYTES, "control")
    require_exact_keys(value, CONTROL_KEYS, "control")
    if require_string(value, "schema", "control") != CONTROL_SCHEMA:
        raise ValueError(f"control.schema must be {CONTROL_SCHEMA}")
    audit_id = require_stable_id(
        require_string(value, "audit_id", "control"), "control.audit_id"
    )
    root_text = require_string(value, "repository_root", "control")
    root_path = (control_path.parent / root_text).resolve()
    if not root_path.is_dir() or root_path.is_symlink():
        raise ValueError("control.repository_root must resolve to a non-symlink directory")

    dataset_identity, _ = verify_file_identity(
        root_path,
        value["frozen_dataset"],
        MAX_MANIFEST_BYTES,
        "control.frozen_dataset",
    )
    bundles = value["bundles"]
    if not isinstance(bundles, list) or not bundles:
        raise ValueError("control.bundles must be a non-empty array")
    normalized_bundles: list[dict[str, Any]] = []
    seen_bundle_ids: set[str] = set()
    seen_source_ids: set[str] = set()
    for index, bundle in enumerate(bundles):
        label = f"control.bundles[{index}]"
        if not isinstance(bundle, dict):
            raise ValueError(f"{label} must be an object")
        require_exact_keys(bundle, BUNDLE_KEYS, label)
        bundle_id = require_stable_id(
            require_string(bundle, "bundle_id", label), f"{label}.bundle_id"
        )
        source_id = require_stable_id(
            require_string(bundle, "source_id", label), f"{label}.source_id"
        )
        if bundle_id in seen_bundle_ids:
            raise ValueError(f"duplicate bundle_id: {bundle_id}")
        if source_id in seen_source_ids:
            raise ValueError(f"duplicate source_id: {source_id}")
        seen_bundle_ids.add(bundle_id)
        seen_source_ids.add(source_id)
        identities: dict[str, dict[str, str]] = {}
        for key, maximum in (
            ("draft_manifest", MAX_MANIFEST_BYTES),
            ("review_decisions", MAX_JSONL_BYTES),
            ("reviewed_output", MAX_JSONL_BYTES),
        ):
            identities[key], _ = verify_file_identity(
                root_path, bundle[key], maximum, f"{label}.{key}"
            )
        normalized_bundles.append(
            {
                "bundle_id": bundle_id,
                "source_id": source_id,
                **identities,
            }
        )
    return AuditPlan(
        control_path=control_path,
        control_sha256=sha256_file(control_path),
        audit_id=audit_id,
        repository_root=root_path,
        dataset_identity=dataset_identity,
        bundle_controls=tuple(normalized_bundles),
    )


def read_jsonl(path: Path, maximum: int, label: str) -> list[dict[str, Any]]:
    payload = read_regular_bytes(path, maximum, label)
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} must be UTF-8") from error
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            raise ValueError(f"{label} contains a blank line at {line_number}")
        if len(line.encode("utf-8")) > MAX_RECORD_BYTES:
            raise ValueError(f"{label} line {line_number} is too large")
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"{label} line {line_number} is invalid JSON") from error
        if not isinstance(value, dict):
            raise ValueError(f"{label} line {line_number} must be an object")
        rows.append(value)
    if not rows:
        raise ValueError(f"{label} must contain at least one row")
    return rows


def require_string_list(value: Any, label: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{label} must be a non-empty string array")
    result: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item or item.strip() != item or "\0" in item:
            raise ValueError(f"{label}[{index}] must be a non-empty trimmed string")
        result.append(item)
    return tuple(result)


def safe_bundle_child(bundle_dir: Path, relative_text: str, label: str) -> Path:
    pure = PurePosixPath(relative_text)
    if pure.is_absolute() or not pure.parts or any(part in {"", ".", ".."} for part in pure.parts):
        raise ValueError(f"{label} must be a normalized bundle-relative path")
    if "\\" in relative_text:
        raise ValueError(f"{label} must use forward slashes")
    path = bundle_dir.joinpath(*pure.parts).resolve()
    try:
        path.relative_to(bundle_dir.resolve())
    except ValueError as error:
        raise ValueError(f"{label} escapes its bundle") from error
    return path


def rows_by_id(rows: Iterable[dict[str, Any]], label: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows):
        record_id = require_stable_id(
            require_string(row, "id", f"{label}[{index}]"), f"{label}[{index}].id"
        )
        if record_id in result:
            raise ValueError(f"duplicate {label} id: {record_id}")
        result[record_id] = row
    return result


def load_bundle(plan: AuditPlan, control: dict[str, Any]) -> Bundle:
    bundle_id = control["bundle_id"]
    source_id = control["source_id"]
    manifest_path = resolve_repository_path(
        plan.repository_root, control["draft_manifest"]["path"], "draft_manifest.path"
    )
    decisions_path = resolve_repository_path(
        plan.repository_root,
        control["review_decisions"]["path"],
        "review_decisions.path",
    )
    reviewed_path = resolve_repository_path(
        plan.repository_root,
        control["reviewed_output"]["path"],
        "reviewed_output.path",
    )
    manifest = read_json_object(manifest_path, MAX_MANIFEST_BYTES, "draft manifest")
    if manifest.get("schema") != "tinyrustlm.teacher_draft_manifest.v1":
        raise ValueError(f"{bundle_id} has an unsupported draft manifest schema")
    campaign_id = require_stable_id(
        require_string(manifest, "campaign_id", "draft manifest"),
        f"{bundle_id}.campaign_id",
    )
    manifest_records = manifest.get("records")
    if not isinstance(manifest_records, list) or not manifest_records:
        raise ValueError(f"{bundle_id} draft manifest records must be non-empty")
    if manifest.get("record_count") != len(manifest_records):
        raise ValueError(f"{bundle_id} draft manifest record_count mismatch")

    decisions = rows_by_id(
        read_jsonl(decisions_path, MAX_JSONL_BYTES, f"{bundle_id} decisions"),
        f"{bundle_id} decisions",
    )
    reviewed = rows_by_id(
        read_jsonl(reviewed_path, MAX_JSONL_BYTES, f"{bundle_id} reviewed output"),
        f"{bundle_id} reviewed output",
    )
    manifest_ids: set[str] = set()
    approved_ids: set[str] = set()
    source_record_ids: set[str] = set()
    records: list[BundleRecord] = []
    for index, record in enumerate(manifest_records):
        if not isinstance(record, dict):
            raise ValueError(f"{bundle_id} draft record {index} must be an object")
        label = f"{bundle_id} draft record {index}"
        record_id = require_stable_id(
            require_string(record, "id", label), f"{label}.id"
        )
        if record_id in manifest_ids:
            raise ValueError(f"duplicate {bundle_id} draft id: {record_id}")
        manifest_ids.add(record_id)
        draft_sha256 = require_sha256(
            require_string(record, "draft_response_sha256", label),
            f"{label}.draft_response_sha256",
        )
        prompt_sha256 = require_sha256(
            require_string(record, "prompt_sha256", label), f"{label}.prompt_sha256"
        )
        requirements = require_string_list(
            record.get("response_requirements"), f"{label}.response_requirements"
        )
        finish_reason = require_string(record, "finish_reason", label)
        draft_file = require_string(record, "draft_file", label)
        draft_path = safe_bundle_child(manifest_path.parent, draft_file, f"{label}.draft_file")
        draft_bytes = read_regular_bytes(draft_path, MAX_RECORD_BYTES, f"{label} draft")
        actual_draft_sha256 = sha256_bytes(draft_bytes)
        if actual_draft_sha256 != draft_sha256:
            raise ValueError(
                f"{bundle_id}/{record_id} draft response SHA-256 drift"
            )
        decision = decisions.get(record_id)
        if decision is None:
            raise ValueError(f"{bundle_id}/{record_id} is missing a review decision")
        if decision.get("draft_response_sha256") != draft_sha256:
            raise ValueError(
                f"{bundle_id}/{record_id} review decision draft SHA-256 mismatch"
            )
        action = decision.get("decision")
        if action not in {"approved", "rejected", "pending"}:
            raise ValueError(f"{bundle_id}/{record_id} has an invalid review decision")
        reviewer_id = require_string(decision, "reviewer_id", f"{bundle_id} decision")
        reviewed_response = decision.get("reviewed_response")
        if not isinstance(reviewed_response, str) or "\0" in reviewed_response:
            raise ValueError(f"{bundle_id}/{record_id} reviewed_response is invalid")
        source_record_id: str | None = None
        if action == "approved":
            if not reviewed_response.strip():
                raise ValueError(f"{bundle_id}/{record_id} approved an empty response")
            output = reviewed.get(record_id)
            if output is None:
                raise ValueError(f"{bundle_id}/{record_id} is missing reviewed output")
            if output.get("source_id") != source_id:
                raise ValueError(f"{bundle_id}/{record_id} reviewed source_id mismatch")
            if output.get("response") != reviewed_response:
                raise ValueError(f"{bundle_id}/{record_id} reviewed output drift")
            source_record_id = require_stable_id(
                require_string(output, "source_record_id", "reviewed output"),
                f"{bundle_id}/{record_id}.source_record_id",
            )
            if source_record_id in source_record_ids:
                raise ValueError(f"duplicate source_record_id in {bundle_id}")
            source_record_ids.add(source_record_id)
            approved_ids.add(record_id)
        else:
            if reviewed_response:
                raise ValueError(
                    f"{bundle_id}/{record_id} non-approved decision carries a response"
                )
            if record_id in reviewed:
                raise ValueError(
                    f"{bundle_id}/{record_id} non-approved decision was exported"
                )
        records.append(
            BundleRecord(
                bundle_id=bundle_id,
                source_id=source_id,
                record_id=record_id,
                source_record_id=source_record_id,
                prompt_sha256=prompt_sha256,
                response_requirements=requirements,
                finish_reason=finish_reason,
                draft_response_sha256=draft_sha256,
                draft_bytes=draft_bytes,
                decision=action,
                reviewer_id=reviewer_id,
                reviewed_response=reviewed_response,
            )
        )
    if set(decisions) != manifest_ids:
        raise ValueError(f"{bundle_id} decision ids do not match its draft manifest")
    if set(reviewed) != approved_ids:
        raise ValueError(f"{bundle_id} reviewed output ids do not match approvals")
    return Bundle(
        bundle_id=bundle_id,
        source_id=source_id,
        campaign_id=campaign_id,
        records=tuple(records),
        identities={
            key: dict(control[key])
            for key in ("draft_manifest", "review_decisions", "reviewed_output")
        },
    )


def parse_key_value_manifest(path: Path) -> dict[str, str]:
    payload = read_regular_bytes(path, MAX_MANIFEST_BYTES, "frozen dataset manifest")
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("frozen dataset manifest must be UTF-8") from error
    values: dict[str, str] = {}
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line:
            continue
        if "=" not in line:
            raise ValueError(f"frozen dataset manifest line {line_number} lacks '='")
        key, value = line.split("=", 1)
        if not key or key in values:
            raise ValueError(f"invalid or duplicate dataset manifest key at {line_number}")
        values[key] = value
    return values


def parse_positive_integer(value: str | None, label: str) -> int:
    if value is None or not re.fullmatch(r"[1-9][0-9]*", value):
        raise ValueError(f"{label} must be a positive integer")
    return int(value)


def load_dataset(plan: AuditPlan) -> tuple[DatasetRecord, ...]:
    path = resolve_repository_path(
        plan.repository_root, plan.dataset_identity["path"], "frozen_dataset.path"
    )
    values = parse_key_value_manifest(path)
    if values.get("tinyrustlm_distillation_dataset_version") != "1":
        raise ValueError("unsupported frozen dataset manifest version")
    if values.get("dataset_status") != "frozen":
        raise ValueError("dataset_status must be frozen")
    count = parse_positive_integer(values.get("record_count"), "record_count")
    records: list[DatasetRecord] = []
    seen_ids: set[str] = set()
    seen_source_records: set[tuple[str, str]] = set()
    for index in range(count):
        prefix = f"record.{index}."
        record_id = require_stable_id(values.get(prefix + "id", ""), prefix + "id")
        source_id = require_stable_id(
            values.get(prefix + "source_id", ""), prefix + "source_id"
        )
        source_record_id = require_stable_id(
            values.get(prefix + "source_record_id", ""), prefix + "source_record_id"
        )
        response_sha256 = require_sha256(
            values.get(prefix + "response_sha256", ""), prefix + "response_sha256"
        )
        response_file = values.get(prefix + "response_file", "")
        response_path = safe_bundle_child(path.parent, response_file, prefix + "response_file")
        response_bytes = read_regular_bytes(
            response_path, MAX_RECORD_BYTES, prefix + "response"
        )
        if sha256_bytes(response_bytes) != response_sha256:
            raise ValueError(f"{prefix}response SHA-256 drift")
        if record_id in seen_ids:
            raise ValueError(f"duplicate frozen dataset id: {record_id}")
        source_key = (source_id, source_record_id)
        if source_key in seen_source_records:
            raise ValueError("duplicate frozen dataset source record")
        seen_ids.add(record_id)
        seen_source_records.add(source_key)
        records.append(
            DatasetRecord(
                record_id=record_id,
                source_id=source_id,
                source_record_id=source_record_id,
                response_sha256=response_sha256,
                response_bytes=response_bytes,
            )
        )
    return tuple(records)


def counter_rows(counter: Counter[str], key: str) -> list[dict[str, Any]]:
    return [{key: name, "count": counter[name]} for name in sorted(counter)]


def reviewed_response_match_mode(dataset_bytes: bytes, reviewed_response: str) -> str:
    expected = reviewed_response.encode("utf-8")
    if dataset_bytes == expected:
        return "exact-reviewed-bytes"
    for index, value in enumerate(dataset_bytes):
        if value == 13 and (
            index + 1 >= len(dataset_bytes) or dataset_bytes[index + 1] != 10
        ):
            raise ValueError("frozen dataset response contains a non-CRLF carriage return")
    if b"\r\n" in dataset_bytes and dataset_bytes.replace(b"\r\n", b"\n") == expected:
        return "explicit-crlf-to-lf-reviewed-match"
    raise ValueError("frozen dataset response differs from reviewed response")


def build_report(plan: AuditPlan) -> dict[str, Any]:
    bundles = tuple(load_bundle(plan, control) for control in plan.bundle_controls)
    dataset = load_dataset(plan)
    approved_by_source: dict[tuple[str, str], BundleRecord] = {}
    for bundle in bundles:
        for record in bundle.records:
            if record.decision != "approved":
                continue
            assert record.source_record_id is not None
            key = (record.source_id, record.source_record_id)
            if key in approved_by_source:
                raise ValueError("duplicate approved source record across bundles")
            approved_by_source[key] = record

    bundle_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    relation_counts: Counter[str] = Counter()
    response_match_counts: Counter[str] = Counter()
    reviewer_counts: Counter[str] = Counter()
    for dataset_record in dataset:
        key = (dataset_record.source_id, dataset_record.source_record_id)
        source_record = approved_by_source.get(key)
        if source_record is None:
            raise ValueError(
                "frozen dataset source record is not an approved reviewed export: "
                f"{dataset_record.record_id}"
            )
        try:
            response_match_mode = reviewed_response_match_mode(
                dataset_record.response_bytes, source_record.reviewed_response
            )
        except ValueError as error:
            raise ValueError(
                "frozen dataset response differs from reviewed response: "
                f"{dataset_record.record_id} from {source_record.bundle_id}"
            ) from error
        bundle_counts[source_record.bundle_id] += 1
        source_counts[source_record.source_id] += 1
        relation_counts["edited-approved-target" if source_record.changed else "unchanged-approved-target"] += 1
        response_match_counts[response_match_mode] += 1
        reviewer_counts[source_record.reviewer_id] += 1

    rejected = [
        record
        for bundle in bundles
        for record in bundle.records
        if record.decision == "rejected"
    ]
    approved = [
        record
        for bundle in bundles
        for record in bundle.records
        if record.decision == "approved"
    ]
    matched_rejected: set[tuple[str, str]] = set()
    matched_pair_count = 0
    same_requirements_count = 0
    changed_requirements_count = 0
    for rejected_record in rejected:
        for approved_record in approved:
            if rejected_record.bundle_id == approved_record.bundle_id:
                continue
            if (
                rejected_record.record_id == approved_record.record_id
                and rejected_record.prompt_sha256 == approved_record.prompt_sha256
            ):
                matched_rejected.add(
                    (rejected_record.bundle_id, rejected_record.record_id)
                )
                matched_pair_count += 1
                if (
                    rejected_record.response_requirements
                    == approved_record.response_requirements
                ):
                    same_requirements_count += 1
                else:
                    changed_requirements_count += 1

    edited_count = relation_counts["edited-approved-target"]
    report: dict[str, Any] = {
        "schema": REPORT_SCHEMA,
        "auditId": plan.audit_id,
        "status": "not-authorized-for-preference-training",
        "controlSha256": plan.control_sha256,
        "tool": {
            "path": "tinyrustlm/tools/audit-distillation-preference-provenance.py",
            "version": TOOL_VERSION,
            "sha256": sha256_file(Path(__file__).resolve()),
        },
        "frozenDataset": {
            **plan.dataset_identity,
            "recordCount": len(dataset),
        },
        "sourceBundles": [
            {
                "bundleId": bundle.bundle_id,
                "sourceId": bundle.source_id,
                "recordCount": len(bundle.records),
                "approvedCount": sum(
                    record.decision == "approved" for record in bundle.records
                ),
                "rejectedCount": sum(
                    record.decision == "rejected" for record in bundle.records
                ),
                "pendingCount": sum(
                    record.decision == "pending" for record in bundle.records
                ),
                "identities": bundle.identities,
            }
            for bundle in sorted(bundles, key=lambda item: item.bundle_id)
        ],
        "selectedRecords": {
            "recordCount": len(dataset),
            "bundleCounts": counter_rows(bundle_counts, "bundleId"),
            "sourceCounts": counter_rows(source_counts, "sourceId"),
            "draftRelationCounts": counter_rows(relation_counts, "relation"),
            "reviewedResponseMatchCounts": counter_rows(
                response_match_counts, "matchMode"
            ),
            "reviewerCounts": counter_rows(reviewer_counts, "reviewerId"),
            "approvedDecisionCount": len(dataset),
            "explicitPairwisePreferenceDecisionCount": 0,
            "editedDraftDifferenceCount": edited_count,
            "eligiblePreferencePairCount": 0,
        },
        "rejectedRecoveryComparison": {
            "rejectedRecordCount": len(rejected),
            "matchedRejectedRecordCount": len(matched_rejected),
            "matchedPairCount": matched_pair_count,
            "samePromptHashPairCount": matched_pair_count,
            "sameResponseRequirementsPairCount": same_requirements_count,
            "changedResponseRequirementsPairCount": changed_requirements_count,
            "rejectedFinishReasonCounts": counter_rows(
                Counter(record.finish_reason for record in rejected), "finishReason"
            ),
            "eligiblePreferencePairCount": 0,
        },
        "authority": {
            "trainingAuthority": False,
            "sftReviewImpliesPairwisePreference": False,
            "editedTargetImpliesDraftRejection": False,
            "recollectedResponseImpliesMatchedPreference": False,
            "reasonCodes": [
                "no-explicit-pairwise-preference-schema",
                "approved-final-does-not-label-draft-as-rejected",
                "recovery-contract-drift",
                "insufficient-authoritative-preference-pairs",
            ],
            "requiredNextGate": (
                "explicit-hash-bound-human-pairwise-review-before-dpo-or-orpo"
            ),
        },
        "privacy": {
            "containsPromptText": False,
            "containsResponseText": False,
            "containsRawModelOutput": False,
            "containsCredentials": False,
            "containsPrivateAbsolutePaths": False,
        },
    }
    report["auditContentSha256"] = sha256_bytes(canonical_json_bytes(report))
    return report


def validate_report_hash(report: dict[str, Any]) -> None:
    expected = report.get("auditContentSha256")
    if not isinstance(expected, str):
        raise ValueError("report is missing auditContentSha256")
    unsigned = dict(report)
    del unsigned["auditContentSha256"]
    actual = sha256_bytes(canonical_json_bytes(unsigned))
    if actual != expected:
        raise ValueError("report auditContentSha256 mismatch")


def write_atomic_json(path: Path, value: dict[str, Any]) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True).encode(
        "utf-8"
    ) + b"\n"
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
        persisted = read_json_object(path, len(payload), "persisted report")
        if persisted != value:
            raise ValueError("persisted report bytes do not reconstruct the report")
        validate_report_hash(persisted)
    finally:
        temporary_path.unlink(missing_ok=True)


def audit(control_path: Path) -> dict[str, Any]:
    return build_report(load_control(control_path))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("control", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = audit(args.control)
    write_atomic_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
