"""Contract tests for preference-provenance auditing."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = (
    Path(__file__).resolve().parents[1]
    / "audit-distillation-preference-provenance.py"
)
SPEC = importlib.util.spec_from_file_location(
    "tinyrustlm_preference_provenance_audit", SCRIPT
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class PreferenceProvenanceAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(
            prefix="tinyrustlm-preference-audit-"
        )
        self.root = Path(self._temporary.name)
        self.control_dir = self.root / "tinyrustlm" / "training" / "fixture"
        self.control_dir.mkdir(parents=True)
        self.dataset_dir = self.root / "artifacts" / "training" / "dataset"
        self.dataset_dir.mkdir(parents=True)
        self.bundle_dir = self.root / "artifacts" / "training" / "bundle"
        self.recovery_dir = self.root / "artifacts" / "training" / "recovery"
        self._write_bundle(
            self.bundle_dir,
            "campaign-main",
            "source-main",
            [
                {
                    "id": "same",
                    "prompt_sha256": MODULE.sha256_bytes(b"prompt same"),
                    "requirements": ["Answer directly."],
                    "draft": "A useful unchanged answer.",
                    "decision": "approved",
                    "reviewed": "A useful unchanged answer.",
                    "finish_reason": "stop",
                },
                {
                    "id": "edited",
                    "prompt_sha256": MODULE.sha256_bytes(b"prompt edited"),
                    "requirements": ["Answer directly."],
                    "draft": "A draft that needs correction.",
                    "decision": "approved",
                    "reviewed": "A corrected\nfinal answer.",
                    "finish_reason": "stop",
                },
                {
                    "id": "recovered",
                    "prompt_sha256": MODULE.sha256_bytes(b"prompt recovered"),
                    "requirements": ["Give useful guidance."],
                    "draft": "An unfinished and private rejected draft",
                    "decision": "rejected",
                    "reviewed": "",
                    "finish_reason": "length",
                },
            ],
        )
        self._write_bundle(
            self.recovery_dir,
            "campaign-recovery",
            "source-recovery",
            [
                {
                    "id": "recovered",
                    "prompt_sha256": MODULE.sha256_bytes(b"prompt recovered"),
                    "requirements": ["Answer in exactly two sentences."],
                    "draft": "A complete safe response.",
                    "decision": "approved",
                    "reviewed": "A complete safe response.",
                    "finish_reason": "stop",
                }
            ],
        )
        self.dataset_manifest = self._write_dataset()
        self.control = self._write_control()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_audit_refuses_to_infer_preference_authority(self) -> None:
        report = MODULE.audit(self.control)

        self.assertEqual(report["status"], "not-authorized-for-preference-training")
        self.assertEqual(report["frozenDataset"]["recordCount"], 2)
        self.assertEqual(
            report["selectedRecords"]["draftRelationCounts"],
            [
                {"relation": "edited-approved-target", "count": 1},
                {"relation": "unchanged-approved-target", "count": 1},
            ],
        )
        self.assertEqual(
            report["selectedRecords"]["explicitPairwisePreferenceDecisionCount"], 0
        )
        self.assertEqual(report["selectedRecords"]["eligiblePreferencePairCount"], 0)
        self.assertEqual(
            report["selectedRecords"]["reviewedResponseMatchCounts"],
            [{"matchMode": "exact-reviewed-bytes", "count": 2}],
        )
        comparison = report["rejectedRecoveryComparison"]
        self.assertEqual(comparison["matchedPairCount"], 1)
        self.assertEqual(comparison["sameResponseRequirementsPairCount"], 0)
        self.assertEqual(comparison["changedResponseRequirementsPairCount"], 1)
        self.assertFalse(report["authority"]["trainingAuthority"])
        MODULE.validate_report_hash(report)

        serialized = json.dumps(report)
        self.assertNotIn("A corrected final answer", serialized)
        self.assertNotIn("private rejected draft", serialized)
        self.assertNotIn(str(self.root), serialized)

    def test_audit_rejects_dataset_response_drift(self) -> None:
        response = self.dataset_dir / "records" / "same.response.txt"
        response.write_text("Altered after freeze.", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "response SHA-256 drift"):
            MODULE.audit(self.control)

    def test_audit_records_explicit_crlf_normalization(self) -> None:
        response = self.dataset_dir / "records" / "edited.response.txt"
        response.write_bytes(b"A corrected\r\nfinal answer.")
        self._refresh_dataset_record_hash(1, response)

        report = MODULE.audit(self.control)

        self.assertEqual(
            report["selectedRecords"]["reviewedResponseMatchCounts"],
            [
                {"matchMode": "exact-reviewed-bytes", "count": 1},
                {"matchMode": "explicit-crlf-to-lf-reviewed-match", "count": 1},
            ],
        )

    def test_audit_rejects_lone_carriage_return(self) -> None:
        response = self.dataset_dir / "records" / "edited.response.txt"
        response.write_bytes(b"A corrected\rfinal answer.")
        self._refresh_dataset_record_hash(1, response)

        with self.assertRaisesRegex(ValueError, "differs from reviewed response"):
            MODULE.audit(self.control)

    def test_audit_rejects_review_decision_draft_hash_drift(self) -> None:
        decisions = self.bundle_dir / "review-decisions.jsonl"
        rows = [json.loads(line) for line in decisions.read_text().splitlines()]
        rows[0]["draft_response_sha256"] = MODULE.sha256_bytes(b"wrong draft")
        decisions.write_text(
            "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in rows),
            encoding="utf-8",
        )
        self._refresh_control_identity(
            "source-main", "review_decisions", decisions
        )

        with self.assertRaisesRegex(ValueError, "decision draft SHA-256 mismatch"):
            MODULE.audit(self.control)

    def test_audit_rejects_unmapped_frozen_source(self) -> None:
        text = self.dataset_manifest.read_text(encoding="utf-8")
        self.dataset_manifest.write_text(
            text.replace(
                "record.0.source_record_id=campaign-main-same",
                "record.0.source_record_id=campaign-main-unknown",
            ),
            encoding="utf-8",
        )
        self._refresh_dataset_identity()

        with self.assertRaisesRegex(ValueError, "not an approved reviewed export"):
            MODULE.audit(self.control)

    def test_atomic_output_revalidates_content_hash(self) -> None:
        report = MODULE.audit(self.control)
        output = self.root / "output" / "audit.json"

        MODULE.write_atomic_json(output, report)

        observed = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(observed, report)
        MODULE.validate_report_hash(observed)
        self.assertEqual(list(output.parent.glob(".*.tmp")), [])

    def _write_bundle(
        self,
        directory: Path,
        campaign_id: str,
        source_id: str,
        definitions: list[dict[str, object]],
    ) -> None:
        drafts = directory / "drafts"
        drafts.mkdir(parents=True)
        manifest_records = []
        decision_rows = []
        reviewed_rows = []
        for index, definition in enumerate(definitions):
            record_id = str(definition["id"])
            draft_text = str(definition["draft"])
            draft_path = drafts / f"{index:06d}-{record_id}.txt"
            draft_path.write_text(draft_text, encoding="utf-8")
            draft_sha256 = MODULE.sha256_file(draft_path)
            manifest_records.append(
                {
                    "id": record_id,
                    "draft_file": f"drafts/{draft_path.name}",
                    "draft_response_sha256": draft_sha256,
                    "prompt_sha256": definition["prompt_sha256"],
                    "response_requirements": definition["requirements"],
                    "finish_reason": definition["finish_reason"],
                }
            )
            action = str(definition["decision"])
            reviewed = str(definition["reviewed"])
            decision_rows.append(
                {
                    "id": record_id,
                    "decision": action,
                    "draft_response_sha256": draft_sha256,
                    "reviewed_response": reviewed,
                    "reviewer_id": "fixture-agent-reviewer",
                }
            )
            if action == "approved":
                reviewed_rows.append(
                    {
                        "id": record_id,
                        "prompt": "private fixture prompt",
                        "response": reviewed,
                        "source_id": source_id,
                        "source_license": "fixture",
                        "source_record_id": f"{campaign_id}-{record_id}",
                        "task_family": "factual-qa",
                    }
                )
        manifest = {
            "schema": "tinyrustlm.teacher_draft_manifest.v1",
            "campaign_id": campaign_id,
            "record_count": len(manifest_records),
            "records": manifest_records,
        }
        (directory / "teacher-draft-manifest.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8"
        )
        (directory / "review-decisions.jsonl").write_text(
            "".join(
                json.dumps(row, separators=(",", ":")) + "\n"
                for row in decision_rows
            ),
            encoding="utf-8",
        )
        (directory / "reviewed-output.jsonl").write_text(
            "".join(
                json.dumps(row, separators=(",", ":")) + "\n"
                for row in reviewed_rows
            ),
            encoding="utf-8",
        )

    def _write_dataset(self) -> Path:
        records_dir = self.dataset_dir / "records"
        records_dir.mkdir()
        definitions = [
            ("same", "A useful unchanged answer."),
            ("edited", "A corrected\nfinal answer."),
        ]
        lines = [
            "tinyrustlm_distillation_dataset_version=1",
            "dataset_status=frozen",
            f"record_count={len(definitions)}",
        ]
        for index, (record_id, response) in enumerate(definitions):
            path = records_dir / f"{record_id}.response.txt"
            path.write_bytes(response.encode("utf-8"))
            lines.extend(
                [
                    f"record.{index}.id={record_id}",
                    f"record.{index}.source_id=source-main",
                    f"record.{index}.source_record_id=campaign-main-{record_id}",
                    f"record.{index}.response_file=records/{path.name}",
                    f"record.{index}.response_sha256={MODULE.sha256_file(path)}",
                ]
            )
        manifest = self.dataset_dir / "distillation-dataset.manifest"
        manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return manifest

    def _identity(self, path: Path) -> dict[str, str]:
        return {
            "path": path.relative_to(self.root).as_posix(),
            "sha256": MODULE.sha256_file(path),
        }

    def _bundle_control(
        self, bundle_id: str, source_id: str, directory: Path
    ) -> dict[str, object]:
        return {
            "bundle_id": bundle_id,
            "source_id": source_id,
            "draft_manifest": self._identity(
                directory / "teacher-draft-manifest.json"
            ),
            "review_decisions": self._identity(
                directory / "review-decisions.jsonl"
            ),
            "reviewed_output": self._identity(directory / "reviewed-output.jsonl"),
        }

    def _write_control(self) -> Path:
        control = {
            "schema": MODULE.CONTROL_SCHEMA,
            "audit_id": "fixture-preference-audit-v1",
            "repository_root": "../../..",
            "frozen_dataset": self._identity(self.dataset_manifest),
            "bundles": [
                self._bundle_control("main", "source-main", self.bundle_dir),
                self._bundle_control(
                    "recovery", "source-recovery", self.recovery_dir
                ),
            ],
        }
        path = self.control_dir / "control.json"
        path.write_text(json.dumps(control, indent=2), encoding="utf-8")
        return path

    def _refresh_dataset_identity(self) -> None:
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["frozen_dataset"] = self._identity(self.dataset_manifest)
        self.control.write_text(json.dumps(control, indent=2), encoding="utf-8")

    def _refresh_dataset_record_hash(self, index: int, response: Path) -> None:
        prefix = f"record.{index}.response_sha256="
        lines = self.dataset_manifest.read_text(encoding="utf-8").splitlines()
        replacement = prefix + MODULE.sha256_file(response)
        lines = [replacement if line.startswith(prefix) else line for line in lines]
        self.dataset_manifest.write_bytes(("\n".join(lines) + "\n").encode("utf-8"))
        self._refresh_dataset_identity()

    def _refresh_control_identity(
        self, source_id: str, key: str, path: Path
    ) -> None:
        control = json.loads(self.control.read_text(encoding="utf-8"))
        bundle = next(
            item for item in control["bundles"] if item["source_id"] == source_id
        )
        bundle[key] = self._identity(path)
        self.control.write_text(json.dumps(control, indent=2), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
