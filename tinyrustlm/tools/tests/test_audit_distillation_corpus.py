"""Contract tests for semantic-neighbor and linguistic corpus auditing."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "audit-distillation-corpus.py"
SPEC = importlib.util.spec_from_file_location("tinyrustlm_corpus_audit", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DistillationCorpusAuditTests(unittest.TestCase):
    def test_semantic_findings_use_cosine_threshold_and_stable_pair_ids(self) -> None:
        prompts = (
            MODULE.PromptRecord("first", "factual-qa", "first prompt", "plan-a"),
            MODULE.PromptRecord("second", "factual-qa", "second prompt", "plan-a"),
        )
        exclusions = (
            MODULE.ExclusionPrompt("eval-a", 0, "held out prompt"),
        )

        findings = MODULE.semantic_findings(
            prompts,
            exclusions,
            ((1.0, 0.0), (0.0, 1.0)),
            ((0.8, 0.6),),
            0.75,
        )

        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].prompt.record_id, "first")
        self.assertAlmostEqual(findings[0].score, 0.8)
        self.assertRegex(findings[0].pair_id, r"^[0-9a-f]{64}$")
        self.assertEqual(
            findings,
            MODULE.semantic_findings(
                prompts,
                exclusions,
                ((1.0, 0.0), (0.0, 1.0)),
                ((0.8, 0.6),),
                0.75,
            ),
        )

    def test_semantic_findings_reject_mismatched_embedding_dimensions(self) -> None:
        prompts = (MODULE.PromptRecord("first", "factual-qa", "prompt", "plan"),)
        exclusions = (MODULE.ExclusionPrompt("eval", 0, "held out"),)

        with self.assertRaisesRegex(ValueError, "embedding dimension"):
            MODULE.semantic_findings(
                prompts,
                exclusions,
                ((1.0, 0.0),),
                ((1.0, 0.0, 0.0),),
                0.6,
            )

    def test_normalized_duplicate_detection_ignores_apostrophe_spelling(self) -> None:
        records = (
            MODULE.PromptRecord("one", "greeting-capability", "what's up?", "a"),
            MODULE.PromptRecord("two", "greeting-capability", "whats up?", "b"),
        )

        with self.assertRaisesRegex(ValueError, "duplicate normalized prompts"):
            MODULE.validate_unique_prompts(records)

    def test_duplicate_eval_text_is_counted_once_for_semantic_findings(self) -> None:
        records = (
            MODULE.ExclusionPrompt("eval-a", 1, "Why does ice float?"),
            MODULE.ExclusionPrompt("eval-b", 4, "Why does ice float?"),
            MODULE.ExclusionPrompt("eval-c", 2, "How do tides work?"),
        )

        deduplicated = MODULE.deduplicate_exclusions(records)

        self.assertEqual(len(deduplicated), 2)
        self.assertEqual(deduplicated[0], records[0])
        self.assertEqual(deduplicated[1], records[2])

    def test_linguistic_audit_counts_leakage_and_applies_policy(self) -> None:
        records = (
            MODULE.ReviewedRecord(
                "boundary",
                "refusal-boundary",
                "Steal credentials.",
                "I can't help steal credentials. I can explain defensive testing.",
            ),
            MODULE.ReviewedRecord(
                "disclaimer",
                "practical-judgment",
                "Help with a contract choice.",
                "As an AI, this is not legal advice. Consult a professional.",
            ),
            MODULE.ReviewedRecord(
                "capability",
                "factual-qa",
                "What happened today?",
                "I browsed the web and confirmed today's report.",
            ),
            MODULE.ReviewedRecord(
                "clean",
                "greeting-capability",
                "Hello.",
                "Hello. What would you like to work through?",
            ),
        )
        policy = MODULE.LinguisticPolicy(
            max_refusal_language_rate=0.30,
            max_apology_rate=0.20,
            max_disclaimer_rate=0.20,
            max_false_capability_count=0,
        )

        audit = MODULE.linguistic_audit(records, policy)

        self.assertEqual(audit.record_count, 4)
        self.assertEqual(audit.refusal_language_ids, ("boundary",))
        self.assertEqual(audit.disclaimer_ids, ("disclaimer",))
        self.assertEqual(audit.false_capability_ids, ("capability",))
        self.assertEqual(
            set(audit.failures),
            {"disclaimer_rate", "false_capability_count"},
        )

    def test_negative_capability_statement_is_not_a_false_capability_claim(self) -> None:
        records = (
            MODULE.ReviewedRecord(
                "honest",
                "greeting-capability",
                "Can you browse?",
                "I cannot browse the web, but I can analyze text you provide.",
            ),
        )
        policy = MODULE.LinguisticPolicy(1.0, 1.0, 1.0, 0)

        audit = MODULE.linguistic_audit(records, policy)

        self.assertEqual(audit.false_capability_ids, ())
        self.assertEqual(audit.failures, ())


class DistillationCorpusAuditControlTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-corpus-audit-")
        self.root = Path(self._temporary.name)
        self.encoder_dir = self.root / "encoder"
        self.encoder_dir.mkdir()
        self.encoder_file = self.encoder_dir / "model.safetensors"
        self.encoder_file.write_bytes(b"fixture encoder")
        self.plan_file = self.root / "prompt-plan.jsonl"
        self.plan_file.write_text(
            json.dumps(
                {
                    "id": "prompt-one",
                    "task_family": "factual-qa",
                    "prompt": "Explain why a test object floats.",
                    "response_requirements": ["Answer directly."],
                    "max_tokens": 64,
                }
            )
            + "\n",
            encoding="utf-8",
        )
        self.exclusion = self.root / "eval.txt"
        self.exclusion.write_text(
            "\n".join(
                [
                    "tinyrustlm_eval_cases_version=1",
                    "holdout_count=0",
                    "case_count=1",
                    "case.0.prompt=Explain why ice floats.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        self.control = self._write_control()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_hash_bound_plan_runs_with_injected_encoder(self) -> None:
        plan = MODULE.build_audit_plan(self.control)
        encoded_batch_sizes = []

        def encoder(texts, _identity):
            encoded_batch_sizes.append(len(texts))
            return tuple((1.0, 0.0) for _ in texts)

        report = MODULE.run_audit(plan, encoder)

        self.assertEqual(encoded_batch_sizes, [2])
        self.assertEqual(report["status"], "fail")
        self.assertEqual(report["prompt_count"], 1)
        self.assertEqual(report["eval_prompt_count"], 1)
        self.assertEqual(report["semantic_finding_count"], 1)
        self.assertEqual(report["linguistic_audit"]["status"], "not-run-no-reviewed-sources")

    def test_prompt_hash_drift_is_rejected_before_encoder_load(self) -> None:
        self.plan_file.write_text("changed\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "SHA-256"):
            MODULE.build_audit_plan(self.control)

    def test_report_writer_refuses_to_overwrite_evidence(self) -> None:
        output = self.root / "report.json"
        MODULE.write_new_report(output, {"status": "first"})

        with self.assertRaisesRegex(ValueError, "already exists"):
            MODULE.write_new_report(output, {"status": "second"})

    def _write_control(self) -> Path:
        control = self.root / "control.json"
        control.write_text(
            json.dumps(
                {
                    "schema": MODULE.CONTROL_SCHEMA,
                    "audit_id": "fixture-audit-v1",
                    "encoder": {
                        "repo_id": "fixture/encoder",
                        "revision": "fixture-revision",
                        "license": "Apache-2.0",
                        "model_dir": str(self.encoder_dir),
                        "files": [
                            {
                                "path": str(self.encoder_file),
                                "sha256": MODULE.sha256_file(self.encoder_file),
                            }
                        ],
                        "max_length": 64,
                        "batch_size": 8,
                    },
                    "prompt_plans": [
                        {
                            "path": str(self.plan_file),
                            "sha256": MODULE.sha256_file(self.plan_file),
                        }
                    ],
                    "eval_exclusions": [
                        {
                            "path": str(self.exclusion),
                            "sha256": MODULE.sha256_file(self.exclusion),
                        }
                    ],
                    "reviewed_sources": [],
                    "semantic_threshold": 0.6,
                    "linguistic_policy": {
                        "max_refusal_language_rate": 0.02,
                        "max_apology_rate": 0.03,
                        "max_disclaimer_rate": 0.03,
                        "max_false_capability_count": 0,
                    },
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return control


if __name__ == "__main__":
    unittest.main()
