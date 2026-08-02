"""Contract tests for reviewed distillation dataset materialization."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-distillation-dataset.py"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("tinyrustlm_prepare_dataset", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DistillationDatasetPreparationTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-dataset-")
        self.root = Path(self._temporary.name)
        self.teacher = self.root / "teacher"
        self.student = self.root / "student"
        self.output = self.root / "dataset"
        self.teacher.mkdir()
        self.student.mkdir()
        self._write_checkpoint(self.teacher, b"teacher weights", b"shared tokenizer")
        self._write_checkpoint(self.student, b"student weights", b"shared tokenizer")
        self.source = self.root / "reviewed.jsonl"
        self._write_source()
        self.control = self._write_control()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_materializes_deterministic_source_and_receipt(self) -> None:
        plan = MODULE.build_dataset_plan(self.control)
        MODULE.write_dataset(plan, self.output)

        manifest = (self.output / "distillation-dataset-source.manifest").read_text(
            encoding="utf-8"
        )
        receipt = json.loads(
            (self.output / "dataset-import-receipt.json").read_text(encoding="utf-8")
        )
        self.assertIn("dataset_id=quality-sequence-v1\n", manifest)
        self.assertIn("tokenizer_alignment=same-tokenizer-token-and-sequence\n", manifest)
        self.assertIn("record.0.id=privacy-local-one\n", manifest)
        self.assertIn("record.0.teacher_reasoning_included=false\n", manifest)
        self.assertEqual(receipt["record_count"], 1)
        self.assertEqual(
            (self.output / "records" / "000000-privacy-local-one.prompt.txt").read_text(
                encoding="utf-8"
            ),
            "Describe a privacy advantage of processing a personal note locally.",
        )
        for path in self.output.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"\r", path.read_bytes(), str(path))

    def test_materialized_dataset_passes_rust_freeze_and_revalidation(self) -> None:
        MODULE.write_dataset(MODULE.build_dataset_plan(self.control), self.output)
        exclusion = self.root / "public-eval.txt"
        exclusion.write_text(
            "\n".join(
                [
                    "tinyrustlm_eval_cases_version=1",
                    "holdout_count=0",
                    "case_count=1",
                    "case.0.prompt=List two colors that can appear in a rainbow.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        frozen = self.output / "distillation-dataset.manifest"
        freeze = self._cargo(
            "freeze-distillation-dataset",
            str(self.output),
            str(frozen),
            str(exclusion),
        )
        self.assertEqual(freeze.returncode, 0, freeze.stderr)
        validate = self._cargo(
            "validate-distillation-dataset",
            str(self.output),
            str(frozen),
            str(exclusion),
        )
        self.assertEqual(validate.returncode, 0, validate.stderr)
        self.assertIn("validation: PASS", validate.stdout)

    def test_rejects_teacher_source_drift(self) -> None:
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["sources"][0]["sha256"] = "sha256:" + "0" * 64
        self.control.write_text(json.dumps(control), encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "SHA-256"):
            MODULE.build_dataset_plan(self.control)

    def test_rejects_false_same_tokenizer_claim(self) -> None:
        (self.student / "tokenizer.json").write_bytes(b"different tokenizer")

        with self.assertRaisesRegex(ValueError, "identical tokenizer"):
            MODULE.build_dataset_plan(self.control)

    def test_rejects_duplicate_record_identity(self) -> None:
        line = self.source.read_text(encoding="utf-8").strip()
        self.source.write_text(f"{line}\n{line}\n", encoding="utf-8")
        self.control = self._write_control()

        with self.assertRaisesRegex(ValueError, "duplicate ids"):
            MODULE.build_dataset_plan(self.control)

    def test_supports_hash_bound_gguf_teacher_identity(self) -> None:
        control = json.loads(self.control.read_text(encoding="utf-8"))
        teacher_artifact = self.root / "teacher.gguf"
        teacher_artifact.write_bytes(b"GGUF fixture with embedded tokenizer identity")
        control["teacher"].pop("model_dir")
        control["teacher"]["weight_file"] = str(teacher_artifact)
        control["teacher"]["tokenizer_identity_file"] = str(teacher_artifact)
        control["tokenizer_alignment"] = "cross-tokenizer-sequence-only"
        self.control.write_text(json.dumps(control), encoding="utf-8")

        plan = MODULE.build_dataset_plan(self.control)

        self.assertEqual(plan.teacher_weight_sha256, MODULE.sha256_file(teacher_artifact))
        self.assertEqual(
            plan.teacher_tokenizer_sha256, MODULE.sha256_file(teacher_artifact)
        )

    def test_materializes_and_freezes_structured_role_history(self) -> None:
        self._upgrade_source_to_structured_history()

        MODULE.write_dataset(MODULE.build_dataset_plan(self.control), self.output)

        manifest = (self.output / "distillation-dataset-source.manifest").read_text(
            encoding="utf-8"
        )
        history_path = (
            self.output
            / "records"
            / "000000-privacy-local-one.history.json"
        )
        history = json.loads(history_path.read_text(encoding="utf-8"))
        self.assertIn("tinyrustlm_distillation_dataset_source_version=2\n", manifest)
        self.assertIn(
            "record.0.history_file=records/000000-privacy-local-one.history.json\n",
            manifest,
        )
        self.assertIn("record.0.history_message_count=2\n", manifest)
        self.assertEqual(
            history,
            {
                "schema": "tinyrustlm.role_history.v1",
                "messages": [
                    {"role": "user", "content": "My note contains private details."},
                    {
                        "role": "assistant",
                        "content": "I will keep the note local while helping with it.",
                    },
                ],
            },
        )

        exclusion = self.root / "public-eval.txt"
        exclusion.write_text(
            "tinyrustlm_eval_cases_version=1\ncase_count=1\n"
            "case.0.prompt=Name two primary colors.\n",
            encoding="utf-8",
        )
        frozen = self.output / "distillation-dataset.manifest"
        freeze = self._cargo(
            "freeze-distillation-dataset",
            str(self.output),
            str(frozen),
            str(exclusion),
        )
        self.assertEqual(freeze.returncode, 0, freeze.stderr)
        frozen_text = frozen.read_text(encoding="utf-8")
        self.assertIn("tinyrustlm_distillation_dataset_version=2\n", frozen_text)
        self.assertIn("record.0.history_sha256=sha256:", frozen_text)

    def test_rejects_non_alternating_structured_history(self) -> None:
        self._upgrade_source_to_structured_history()
        record = json.loads(self.source.read_text(encoding="utf-8"))
        record["history"][1]["role"] = "user"
        self.source.write_text(json.dumps(record) + "\n", encoding="utf-8")
        self.control = self._write_control()
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["schema"] = "tinyrustlm.distillation_dataset_import.v2"
        self.control.write_text(json.dumps(control), encoding="utf-8")

        with self.assertRaisesRegex(ValueError, r"history\[1\]\.role must be assistant"):
            MODULE.build_dataset_plan(self.control)

    def _write_checkpoint(self, directory: Path, weights: bytes, tokenizer: bytes) -> None:
        (directory / "model.safetensors").write_bytes(weights)
        (directory / "tokenizer.json").write_bytes(tokenizer)

    def _write_source(self) -> None:
        record = {
            "id": "privacy-local-one",
            "task_family": "uaix-memory-grounding",
            "prompt": "Describe a privacy advantage of processing a personal note locally.",
            "response": "Local processing can keep the note on the user's device instead of transmitting its contents to a remote inference service.",
            "source_id": "reviewed-teacher-batch-v1",
            "source_license": "UAIX-reviewed-training-output-v1",
            "source_record_id": "teacher-batch-v1-record-0001",
        }
        self.source.write_text(json.dumps(record) + "\n", encoding="utf-8")

    def _upgrade_source_to_structured_history(self) -> None:
        record = json.loads(self.source.read_text(encoding="utf-8"))
        record["history"] = [
            {"role": "user", "content": "My note contains private details."},
            {
                "role": "assistant",
                "content": "I will keep the note local while helping with it.",
            },
        ]
        self.source.write_text(json.dumps(record) + "\n", encoding="utf-8")
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["schema"] = "tinyrustlm.distillation_dataset_import.v2"
        control["sources"][0]["sha256"] = MODULE.sha256_file(self.source)
        self.control.write_text(json.dumps(control, indent=2), encoding="utf-8")

    def _write_control(self) -> Path:
        control = {
            "schema": "tinyrustlm.distillation_dataset_import.v1",
            "dataset_id": "quality-sequence-v1",
            "dataset_license_route": "local-reviewed-license-ledger-v1",
            "dataset_purpose": "TinyRustLM sequence-level assistant quality distillation",
            "tokenizer_alignment": "same-tokenizer-token-and-sequence",
            "teacher": {
                "model_id": "fixture-teacher",
                "revision": "fixture-teacher-revision-v1",
                "model_dir": str(self.teacher),
                "generation_profile": "reviewed-final-answer-greedy-v1",
            },
            "student": {
                "model_id": "fixture-student",
                "revision": "fixture-student-revision-v1",
                "model_dir": str(self.student),
            },
            "sources": [
                {"path": str(self.source), "sha256": MODULE.sha256_file(self.source)}
            ],
        }
        path = self.root / "control.json"
        path.write_text(json.dumps(control, indent=2), encoding="utf-8")
        return path

    def _cargo(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["cargo", "run", "--quiet", "-p", "tinyrustlm-slm-pack", "--", *arguments],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )


if __name__ == "__main__":
    unittest.main()
