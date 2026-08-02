"""Contract tests for provenance-bound public prompt selection."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-public-prompt-source.py"
SPEC = importlib.util.spec_from_file_location("tinyrustlm_public_prompt_source", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


@unittest.skipUnless(importlib.util.find_spec("pyarrow"), "pyarrow is not installed")
class PublicPromptSourceTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-public-prompts-")
        self.root = Path(self._temporary.name)
        self.control = self._write_fixture()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_build_plan_is_balanced_and_extracts_substantive_turns(self) -> None:
        plan = MODULE.build_import_plan(self.control)

        self.assertEqual(len(plan.selected), 2)
        self.assertEqual(
            {record.task_family for record in plan.selected},
            {"practical-judgment", "factual-qa"},
        )
        self.assertNotIn("Hi", {record.prompt for record in plan.selected})
        self.assertEqual(MODULE.verification_summary(plan)["record_count"], 2)

    def test_build_plan_releases_parquet_handle(self) -> None:
        MODULE.build_import_plan(self.control)

        parquet = self.root / "dataset.parquet"
        moved = self.root / "dataset-moved.parquet"
        parquet.replace(moved)
        moved.replace(parquet)

    def test_bundle_carries_row_provenance_and_is_teacher_plan_compatible(self) -> None:
        plan = MODULE.build_import_plan(self.control)
        output = self.root / "output"

        MODULE.write_import_bundle(plan, output)

        receipt = json.loads(
            (output / "public-prompt-import-receipt.json").read_text(encoding="utf-8")
        )
        prompt_lines = (output / "prompt-plan.jsonl").read_text(
            encoding="utf-8"
        ).splitlines()
        self.assertEqual(receipt["record_count"], 2)
        self.assertEqual(len(receipt["records"]), 2)
        self.assertEqual(len(prompt_lines), 2)
        self.assertEqual(
            MODULE.sha256_file(output / "prompt-plan.jsonl"),
            receipt["prompt_plan_sha256"],
        )
        for line in prompt_lines:
            record = json.loads(line)
            self.assertEqual(set(record), MODULE.PROMPT_KEYS)
            self.assertIn("external actions", " ".join(record["response_requirements"]))

    def test_source_hash_drift_is_rejected_before_parquet_parsing(self) -> None:
        parquet = self.root / "dataset.parquet"
        with parquet.open("ab") as stream:
            stream.write(b"drift")

        with self.assertRaisesRegex(ValueError, "parquet SHA-256 drift"):
            MODULE.build_import_plan(self.control)

    def test_eval_five_gram_overlap_prevents_topic_quota_admission(self) -> None:
        exclusion = self.root / "eval.manifest"
        exclusion.write_text(
            "\n".join(
                [
                    "tinyrustlm_eval_cases_version=1",
                    "holdout_count=0",
                    "case_count=1",
                    "case.0.prompt=How should I plan a weekly grocery budget?",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["eval_exclusions"][0]["sha256"] = MODULE.sha256_file(exclusion)
        self.control.write_text(json.dumps(control, indent=2) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "Shopping.*selected 0"):
            MODULE.build_import_plan(self.control)

    def _write_fixture(self) -> Path:
        import pyarrow as pa
        import pyarrow.parquet as pq

        rows = [
            {
                "topic": "Shopping",
                "full_topic": "Shopping/Budgeting/Groceries",
                "messages": [
                    {"role": "user", "content": "Hi"},
                    {"role": "assistant", "content": "Hello. How can I help?"},
                    {
                        "role": "user",
                        "content": "How should I plan a weekly grocery budget?",
                    },
                    {
                        "role": "assistant",
                        "content": "Start with a spending limit and a meal list.",
                    },
                ],
            },
            {
                "topic": "astronomy",
                "full_topic": "astronomy/solar system/orbits",
                "messages": [
                    {"role": "user", "content": "Hello!"},
                    {"role": "assistant", "content": "Hello. How can I help?"},
                    {
                        "role": "user",
                        "content": "Why do planets remain in orbit around the Sun?",
                    },
                    {
                        "role": "assistant",
                        "content": "Gravity bends their forward motion into an orbit.",
                    },
                ],
            },
        ]
        parquet = self.root / "dataset.parquet"
        pq.write_table(pa.Table.from_pylist(rows), parquet)
        readme = self.root / "README.md"
        readme.write_text("---\nlicense: apache-2.0\n---\n", encoding="utf-8")
        exclusion = self.root / "eval.manifest"
        exclusion.write_text(
            "\n".join(
                [
                    "tinyrustlm_eval_cases_version=1",
                    "holdout_count=0",
                    "case_count=1",
                    "case.0.prompt=Explain an unrelated ceramic glazing process.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        control = self.root / "control.json"
        control.write_text(
            json.dumps(
                {
                    "schema": MODULE.CONTROL_SCHEMA,
                    "campaign_id": "worker-test",
                    "dataset": {
                        "repo_id": "owner/dataset",
                        "revision": "1" * 40,
                        "split": "train_sft",
                        "parquet_file": str(parquet),
                        "parquet_sha256": MODULE.sha256_file(parquet),
                        "readme_file": str(readme),
                        "readme_sha256": MODULE.sha256_file(readme),
                        "license": "apache-2.0",
                        "dataset_url": "https://huggingface.co/datasets/owner/dataset/tree/"
                        + "1" * 40,
                    },
                    "selection": {
                        "seed": 20260711,
                        "groups": [
                            {
                                "id": "everyday",
                                "topics": ["Shopping"],
                                "records_per_topic": 1,
                                "task_family": "practical-judgment",
                            },
                            {
                                "id": "science",
                                "topics": ["astronomy"],
                                "records_per_topic": 1,
                                "task_family": "factual-qa",
                            },
                        ],
                        "max_prompt_bytes": 1024,
                        "max_tokens": 128,
                        "near_duplicate_threshold": 0.8,
                    },
                    "eval_exclusions": [
                        {
                            "path": str(exclusion),
                            "sha256": MODULE.sha256_file(exclusion),
                        }
                    ],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return control


if __name__ == "__main__":
    unittest.main()
