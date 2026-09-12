"""Contract tests for the Qwen3 working-model training control plane."""

from __future__ import annotations

import importlib.util
import json
import sys
from tinyrustlm.tools.tests.canonical_test_scratch import CanonicalTestScratch

import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "qwen3-working-model-controls.py"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
PROFILE = (
    REPOSITORY_ROOT
    / "tinyrustlm"
    / "training"
    / "qwen3-0.6b-working-model-v1"
    / "profile.v1.json"
)
SPEC = importlib.util.spec_from_file_location(
    "tinyrustlm_working_model_controls", SCRIPT
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def sha(value: str) -> str:
    return "sha256:" + value * 64


class WorkingModelProfileTests(unittest.TestCase):
    def test_repository_profile_is_complete_and_exact(self) -> None:
        profile = MODULE.load_profile(PROFILE)

        self.assertEqual(profile.profile_id, "qwen3-0.6b-working-model-v1")
        self.assertEqual(profile.pilot_record_count, 1024)
        self.assertEqual(profile.scale_record_count, 200000)
        self.assertEqual(len(profile.categories), 14)
        self.assertEqual(profile.holdout_case_count, 280)
        self.assertEqual(profile.evaluation_case_count, 52)
        self.assertEqual(
            profile.review_rubric_id, "qwen3-working-model-pilot-review-v1"
        )
        self.assertEqual(len(profile.review_checklist), 14)
        self.assertEqual(
            profile.source_revision, "c1899de289a04d12100db370d81485cdf75e47ca"
        )
        self.assertEqual(profile.source_status, "terminally-rejected-as-product-model")

    def test_normalization_is_unicode_and_apostrophe_stable(self) -> None:
        self.assertEqual(
            MODULE.normalize_text("  What\u2019s\tAVAILABLE?  "),
            MODULE.normalize_text("whats available"),
        )

    def test_entity_normalization_removes_substitutable_surface_forms(self) -> None:
        normalized = MODULE.entity_normalize(
            "Avery has 17.5 kilograms in Project Cedar.",
            (
                ("person", "Avery"),
                ("quantity", "17.5 kilograms"),
                ("project", "Project Cedar"),
            ),
        )

        self.assertEqual(normalized, "<person> has <quantity> in <project>")


class WorkingModelControlFixture:
    def setUp(self) -> None:
        self._temporary = CanonicalTestScratch(prefix="tinyrustlm-working-model-")
        self.addCleanup(self._temporary.cleanup)
        self.root = Path(self._temporary.name)
        # Synthetic fixture storage stands in for the model volume; no model is built.
        self.enterContext(mock.patch.object(MODULE, "MODEL_STORAGE_ROOT", self.root))
        self.enterContext(
            mock.patch.object(
                MODULE, "PROTECTED_SOURCE_ROOT", self.root / "source-authority"
            )
        )
        self.source_dir = self.root / "source"
        self.source_dir.mkdir()
        self.source_model = self.source_dir / "model.safetensors"
        self.source_tokenizer = self.source_dir / "tokenizer.json"
        self.source_model.write_bytes(b"model bytes")
        self.source_tokenizer.write_bytes(b"token bytes!")
        self.evaluation_fixture = self.root / "behavior-eval-cases.txt"
        self.evaluation_fixture.write_text(
            "\n".join(
                [
                    "tinyrustlm_eval_cases_version=1",
                    "scope=fixture-behavior-gate",
                    "case_count=1",
                    "case.0.prompt=Compare the two lighthouse schedules before choosing one.",
                    "case.0.required_result=quality",
                    "case.0.required_answer_terms=acknowledge the conflict,compare authority",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        self.review_rubric = self.root / "review-rubric.json"
        self.review_rubric.write_text(
            json.dumps(self._review_rubric_value(), indent=2) + "\n",
            encoding="utf-8",
        )
        self.profile = self.root / "profile.json"
        self.profile.write_text(
            json.dumps(self._profile_value(), indent=2) + "\n", encoding="utf-8"
        )
        self.factor_pack = self.root / "factor-pack.private.json"
        self.factor_pack.write_text(
            json.dumps(self._factor_pack_value(), indent=2) + "\n", encoding="utf-8"
        )
        self.seed = self.root / "holdout-seed.private.bin"
        self.seed.write_bytes(bytes(range(32)))
        self.tombstones = self.root / "tombstones.jsonl"
        self.tombstones.write_text(
            json.dumps(
                {
                    "schema": MODULE.TOMBSTONE_SCHEMA,
                    "tombstone_id": "none-v1",
                    "record_id": "absent-record",
                    "record_sha256": sha("7"),
                    "reason_code": "fixture-no-op-control",
                    "decision_sha256": sha("8"),
                }
            )
            + "\n",
            encoding="utf-8",
        )

    def _review_rubric_value(self) -> dict[str, object]:
        return {
            "schema": MODULE.CURRICULUM_REVIEW_RUBRIC_SCHEMA,
            "rubric_id": "fixture-curriculum-review-v1",
            "status_values": ["pass", "fail", "not-applicable"],
            "decision_values": ["accept", "reject"],
            "checklist": [
                {"id": "substantive-help", "applicability": "always"},
                {"id": "instruction-following", "applicability": "always"},
                {"id": "factual-accuracy", "applicability": "task-specific"},
                {"id": "no-hidden-reasoning", "applicability": "always"},
                {"id": "no-malicious-artifact", "applicability": "always"},
            ],
            "acceptance": {
                "always_pass": [
                    "substantive-help",
                    "instruction-following",
                    "no-hidden-reasoning",
                    "no-malicious-artifact",
                ],
                "no_fail": True,
                "response_rewrite_forbidden": True,
                "hidden_reasoning_forbidden": True,
            },
        }

    def _profile_value(self) -> dict[str, object]:
        return {
            "schema": MODULE.PROFILE_SCHEMA,
            "profile_id": "fixture-working-model-v1",
            "goal_sha256": sha("a"),
            "status": "preregistered",
            "source": {
                "repo_id": "fixture/source",
                "revision": "1" * 40,
                "license_id": "Apache-2.0",
                "architecture": "Qwen3ForCausalLM",
                "status": "terminally-rejected-as-product-model",
                "permitted_use": "base-ancestor-for-new-derivative-only",
                "files": [
                    {
                        "name": "model.safetensors",
                        "bytes": self.source_model.stat().st_size,
                        "sha256": MODULE.sha256_file(self.source_model),
                    },
                    {
                        "name": "tokenizer.json",
                        "bytes": self.source_tokenizer.stat().st_size,
                        "sha256": MODULE.sha256_file(self.source_tokenizer),
                    },
                ],
            },
            "evaluation_exclusions": [
                {
                    "path": str(self.evaluation_fixture),
                    "bytes": self.evaluation_fixture.stat().st_size,
                    "case_count": 1,
                    "sha256": MODULE.sha256_file(self.evaluation_fixture),
                }
            ],
            "curriculum": {
                "pilot_record_count": 2,
                "scale_record_count": 20,
                "minimum_helpful_positive_rate": 0.5,
                "maximum_narrow_boundary_rate": 0.5,
                "maximum_record_bytes": 65536,
                "allowed_provenance_classes": [
                    "human-authored",
                    "public-licensed",
                    "synthetic-reviewed",
                ],
                "allowed_license_ids": ["Apache-2.0", "CC0-1.0"],
                "review_policy": {
                    "rubric": {
                        "path": str(self.review_rubric),
                        "bytes": self.review_rubric.stat().st_size,
                        "sha256": MODULE.sha256_file(self.review_rubric),
                    },
                    "candidate_projection": "curriculum-record-without-review-v1",
                    "primary_reviewer_count": 2,
                    "distinct_reviewer_identities_required": True,
                    "distinct_custody_domains_required": True,
                    "disagreement_policy": "third-distinct-reviewer-required",
                    "unnecessary_adjudication_forbidden": True,
                    "response_rewrite_forbidden": True,
                    "hidden_reasoning_forbidden": True,
                },
                "categories": [
                    {
                        "id": "ordinary-conversation",
                        "pilot_count": 1,
                        "scale_count": 10,
                        "required_factors": ["discourse_form", "entity_set"],
                        "minimum_distinct_values_per_factor": 1,
                    },
                    {
                        "id": "practical-constraints",
                        "pilot_count": 1,
                        "scale_count": 10,
                        "required_factors": ["resource_state", "fallback_kind"],
                        "minimum_distinct_values_per_factor": 1,
                    },
                ],
            },
            "holdouts": {
                "case_count": 2,
                "development_count": 1,
                "independent_audit_count": 1,
                "cases_per_category": 1,
                "secret_seed_bytes": 32,
                "minimum_prompt_variants": 2,
                "minimum_anchor_variants": 2,
            },
            "contamination": {
                "character_ngram_size": 7,
                "character_containment_threshold": 0.8,
                "token_ngram_size": 3,
                "token_containment_threshold": 0.8,
                "entity_token_ngram_size": 2,
                "entity_containment_threshold": 0.8,
                "answer_token_ngram_size": 2,
                "answer_containment_threshold": 0.8,
                "semantic_cosine_threshold": 0.82,
                "semantic_review_floor": 0.72,
            },
            "training": {
                "method": "assistant-only-sft-with-preservation-kl",
                "device": "cpu",
                "parameter_dtype": "float32",
                "compute_dtype": "float32",
                "lora_rank": 16,
                "lora_alpha": 32,
                "lora_dropout": 0.0,
                "target_modules": [
                    "q_proj",
                    "k_proj",
                    "v_proj",
                    "o_proj",
                    "gate_proj",
                    "up_proj",
                    "down_proj",
                ],
                "learning_rate": 0.00003,
                "epochs": 1,
                "maximum_sequence_tokens": 1024,
                "micro_batch_size": 1,
                "gradient_accumulation_steps": 8,
                "effective_batch_size": 8,
                "warmup_steps": 8,
                "weight_decay": 0.01,
                "gradient_clip_norm": 1.0,
                "preservation_kl_weight": 0.1,
                "training_seed": 20260820,
                "shuffle_seed": 20260821,
                "checkpoint_interval_steps": 32,
                "eligible_checkpoint": "final-only",
            },
            "stop_rules": {
                "nonfinite_loss": "terminal-reject",
                "maximum_consecutive_loss_increases": 8,
                "maximum_wall_clock_seconds": 86400,
                "maximum_peak_rss_bytes": 68719476736,
                "minimum_pilot_behavior_pass_rate": 0.8,
                "minimum_preservation_pass_rate": 0.95,
                "maximum_ordinary_helpfulness_regression_rate": 0.02,
                "failed_adapter_disposition": "terminal-reject-exact-bytes",
                "retry_requirement": "new-preregistration-and-material-method-or-data-change",
            },
        }

    def _factor_pack_value(self) -> dict[str, object]:
        return {
            "schema": MODULE.FACTOR_PACK_SCHEMA,
            "pack_id": "fixture-holdouts-v1",
            "cases": [
                {
                    "case_id": "ordinary-01",
                    "split": "development",
                    "task_family": "ordinary-conversation",
                    "template_family_id": "ordinary-weather-followup-v1",
                    "prompt_variants": [
                        "Avery asks for a concise weekend idea near Cedar Bay.",
                        "Suggest one brief weekend activity for Avery near Cedar Bay.",
                    ],
                    "answer_anchor_variants": [
                        ["ask what weather Avery prefers", "offer an indoor fallback"],
                        [
                            "clarify the preferred weather",
                            "include an indoor alternative",
                        ],
                    ],
                    "entities": [
                        {"kind": "person", "value": "Avery"},
                        {"kind": "place", "value": "Cedar Bay"},
                    ],
                    "scenario_factors": {
                        "discourse_form": "request",
                        "entity_set": "ordinary-01",
                    },
                },
                {
                    "case_id": "constraints-01",
                    "split": "independent-audit",
                    "task_family": "practical-constraints",
                    "template_family_id": "unavailable-resource-fallback-v1",
                    "prompt_variants": [
                        "Plan a hot lunch, but the office has no stove or microwave.",
                        "The office cannot heat food; propose a practical lunch.",
                    ],
                    "answer_anchor_variants": [
                        ["respect that heating is unavailable", "offer a cold meal"],
                        ["do not recommend heating", "give a no-cook fallback"],
                    ],
                    "entities": [
                        {"kind": "resource", "value": "stove"},
                        {"kind": "resource", "value": "microwave"},
                    ],
                    "scenario_factors": {
                        "resource_state": "unavailable",
                        "fallback_kind": "no-cook",
                    },
                },
            ],
        }

    def _seal(self, name: str = "sealed") -> tuple[Path, dict[str, object]]:
        custody, assembled = self._assembled_holdout_custody()
        output = self.root / name
        receipt = MODULE.seal_holdouts(
            MODULE.load_profile(self.profile),
            assembled / MODULE.ASSEMBLED_FACTOR_PACK_FILENAME,
            custody / MODULE.HOLDOUT_SEED_FILENAME,
            assembled / MODULE.HOLDOUT_CUSTODY_RECEIPT_FILENAME,
            output,
        )
        return output, receipt

    def _assembled_holdout_custody(self) -> tuple[Path, Path]:
        cached = getattr(self, "_assembled_custody_paths", None)
        if cached is not None:
            return cached
        custody, _ = self._initialize_custody("sealing-custody")
        development, independent = self._complete_holdout_contributions(custody)
        assembled = self.root / "sealing-assembled"
        MODULE.assemble_holdout_contributions(
            MODULE.load_profile(self.profile),
            custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME,
            development,
            independent,
            assembled,
        )
        self._assembled_custody_paths = (custody, assembled)
        return custody, assembled

    def _initialize_custody(
        self, name: str = "holdout-custody"
    ) -> tuple[Path, dict[str, object]]:
        output = self.root / name
        plan = MODULE.initialize_holdout_custody(
            MODULE.load_profile(self.profile), "fixture-custody-v1", output
        )
        return output, plan

    def _complete_holdout_contributions(self, custody: Path) -> tuple[Path, Path]:
        source_cases = {
            case["task_family"]: case for case in self._factor_pack_value()["cases"]
        }
        outputs = []
        for filename, identity_value, custody_value in (
            (
                MODULE.DEVELOPMENT_CONTRIBUTION_FILENAME,
                sha("a"),
                sha("c"),
            ),
            (
                MODULE.INDEPENDENT_AUDIT_CONTRIBUTION_FILENAME,
                sha("b"),
                sha("d"),
            ),
        ):
            template = json.loads((custody / filename).read_text(encoding="utf-8"))
            template["status"] = "complete"
            template["contribution_id"] = filename.removesuffix(".private.json")
            template["author_identity_sha256"] = identity_value
            template["custody_domain_sha256"] = custody_value
            for case in template["cases"]:
                source = source_cases[case["task_family"]]
                case["template_family_id"] = source["template_family_id"]
                case["prompt_variants"] = source["prompt_variants"]
                case["answer_anchor_variants"] = source["answer_anchor_variants"]
                case["entities"] = source["entities"]
                case["scenario_factors"] = source["scenario_factors"]
            completed = self.root / f"completed-{filename}"
            completed.write_text(
                json.dumps(template, indent=2) + "\n", encoding="utf-8"
            )
            outputs.append(completed)
        return outputs[0], outputs[1]

    def _record(
        self,
        record_id: str,
        task_family: str,
        template_family_id: str,
        prompt: str,
        response: str,
        scenario_factors: dict[str, str],
        entities: list[dict[str, str]] | None = None,
        disposition: str = "helpful-positive",
    ) -> dict[str, object]:
        return {
            "schema": MODULE.CURRICULUM_RECORD_SCHEMA,
            "record_id": record_id,
            "task_family": task_family,
            "template_family_id": template_family_id,
            "scenario_factors": scenario_factors,
            "entities": entities or [],
            "messages": [{"role": "user", "content": prompt}],
            "response": response,
            "disposition": disposition,
            "source_provenance": {
                "provenance_class": "synthetic-reviewed",
                "license_id": "CC0-1.0",
                "source_id": "fixture-teacher-corpus-v1",
                "source_record_id": record_id,
                "source_content_sha256": sha("d"),
            },
            "teacher_generation": {
                "teacher_id": "fixture/teacher",
                "teacher_revision": "2" * 40,
                "sampling_profile_sha256": sha("e"),
                "seed": 7,
                "raw_output_sha256": sha("f"),
                "hidden_reasoning_included": False,
            },
            "review": {
                "decision": "accept",
                "rubric_sha256": MODULE.sha256_file(self.review_rubric),
                "factual_verification": "not-applicable",
                "reviewer_count": 2,
                "disagreement_status": "none",
                "decision_sha256": sha("2"),
                "pii_scan_status": "pass",
                "license_review_status": "pass",
                "malicious_artifact_scan_status": "pass",
            },
        }

    def _write_curriculum(
        self,
        records: list[dict[str, object]],
        *,
        primary_outcomes: dict[str, tuple[str, str]] | None = None,
        adjudication_outcomes: dict[str, str] | None = None,
        name: str = "curriculum",
    ) -> Path:
        profile = MODULE.load_profile(self.profile)
        review_id = f"fixture-{name}-review-v1"
        primary_outcomes = primary_outcomes or {}
        adjudication_outcomes = adjudication_outcomes or {}
        reviewer_identities = (sha("a"), sha("b"))
        custody_domains = (sha("c"), sha("d"))
        primary_decisions: list[list[dict[str, object]]] = [[], []]
        adjudications: list[dict[str, object]] = []

        def checklist(decision: str) -> list[dict[str, str]]:
            result = []
            for check_id, applicability in profile.review_checklist:
                status = "pass" if applicability == "always" else "not-applicable"
                if decision == "reject" and check_id == "substantive-help":
                    status = "fail"
                result.append({"id": check_id, "status": status})
            return result

        for record in records:
            record_id = str(record["record_id"])
            candidates = MODULE._review_candidate_identities(record)
            outcomes = primary_outcomes.get(record_id, ("accept", "accept"))
            decisions_for_record: list[dict[str, object]] = []
            for reviewer_index, outcome in enumerate(outcomes):
                decision = {
                    "schema": MODULE.CURRICULUM_REVIEW_DECISION_SCHEMA,
                    "review_id": review_id,
                    "record_id": record_id,
                    **candidates,
                    "rubric_sha256": profile.review_rubric_sha256,
                    "reviewer_identity_sha256": reviewer_identities[reviewer_index],
                    "custody_domain_sha256": custody_domains[reviewer_index],
                    "decision": outcome,
                    "factual_verification": "not-applicable",
                    "checklist": checklist(outcome),
                    "pii_scan_status": "pass",
                    "license_review_status": "pass",
                    "malicious_artifact_scan_status": "pass",
                    "comment_sha256": sha(str(reviewer_index + 1)),
                }
                primary_decisions[reviewer_index].append(decision)
                decisions_for_record.append(
                    {
                        "decision": outcome,
                        "factual_verification": "not-applicable",
                        "sha256": MODULE.sha256_bytes(
                            MODULE.canonical_json_bytes(decision)
                        ),
                    }
                )

            if outcomes == ("accept", "accept"):
                record["review"] = MODULE._derived_review_summary(
                    profile,
                    review_id,
                    record_id,
                    candidates["candidate_sha256"],
                    decisions_for_record,
                    None,
                )
            elif outcomes[0] != outcomes[1] and record_id in adjudication_outcomes:
                adjudication_outcome = adjudication_outcomes[record_id]
                adjudication = {
                    "schema": MODULE.CURRICULUM_REVIEW_ADJUDICATION_SCHEMA,
                    "review_id": review_id,
                    "record_id": record_id,
                    **candidates,
                    "rubric_sha256": profile.review_rubric_sha256,
                    "primary_decision_sha256s": [
                        decision["sha256"] for decision in decisions_for_record
                    ],
                    "adjudicator_identity_sha256": sha("5"),
                    "custody_domain_sha256": sha("6"),
                    "decision": adjudication_outcome,
                    "factual_verification": "not-applicable",
                    "checklist": checklist(adjudication_outcome),
                    "pii_scan_status": "pass",
                    "license_review_status": "pass",
                    "malicious_artifact_scan_status": "pass",
                    "reason_code": "primary-review-disagreement",
                    "comment_sha256": sha("7"),
                }
                adjudications.append(adjudication)
                if adjudication_outcome == "accept":
                    record["review"] = MODULE._derived_review_summary(
                        profile,
                        review_id,
                        record_id,
                        candidates["candidate_sha256"],
                        decisions_for_record,
                        {
                            "decision": "accept",
                            "factual_verification": "not-applicable",
                            "sha256": MODULE.sha256_bytes(
                                MODULE.canonical_json_bytes(adjudication)
                            ),
                        },
                    )

        self.primary_review_ledgers = []
        for index, decisions in enumerate(primary_decisions, 1):
            ledger = self.root / f"{name}-primary-review-{index}.jsonl"
            ledger.write_text(
                "".join(json.dumps(item, sort_keys=True) + "\n" for item in decisions),
                encoding="utf-8",
            )
            self.primary_review_ledgers.append(ledger)

        self.adjudication_ledger = None
        if adjudications:
            self.adjudication_ledger = self.root / f"{name}-adjudication.jsonl"
            self.adjudication_ledger.write_text(
                "".join(
                    json.dumps(item, sort_keys=True) + "\n" for item in adjudications
                ),
                encoding="utf-8",
            )

        path = self.root / f"{name}.jsonl"
        path.write_text(
            "".join(json.dumps(record, sort_keys=True) + "\n" for record in records),
            encoding="utf-8",
        )

        def identity(file_path: Path) -> dict[str, object]:
            return {
                "path": str(file_path),
                "bytes": file_path.stat().st_size,
                "sha256": MODULE.sha256_file(file_path),
            }

        primary_descriptors = []
        for index, ledger in enumerate(self.primary_review_ledgers):
            primary_descriptors.append(
                {
                    **identity(ledger),
                    "reviewer_identity_sha256": reviewer_identities[index],
                    "custody_domain_sha256": custody_domains[index],
                }
            )
        adjudication_descriptor = None
        if self.adjudication_ledger is not None:
            adjudication_descriptor = {
                **identity(self.adjudication_ledger),
                "adjudicator_identity_sha256": sha("5"),
                "custody_domain_sha256": sha("6"),
            }
        manifest = {
            "schema": MODULE.CURRICULUM_REVIEW_MANIFEST_SCHEMA,
            "status": "complete",
            "review_id": review_id,
            "profile_id": profile.profile_id,
            "profile_sha256": profile.profile_sha256,
            "control_program_sha256": MODULE.control_program_sha256(),
            "curriculum_sha256": MODULE.sha256_file(path),
            "rubric_sha256": profile.review_rubric_sha256,
            "candidate_projection": "curriculum-record-without-review-v1",
            "record_count": len(records),
            "record_order_sha256": MODULE.sha256_bytes(
                MODULE.canonical_json_bytes([record["record_id"] for record in records])
            ),
            "primary_reviewer_ledgers": primary_descriptors,
            "adjudication_ledger": adjudication_descriptor,
            "contains_raw_curriculum": False,
            "training_authority": False,
        }
        self.review_manifest = self.root / f"{name}-review-manifest.json"
        self.review_manifest.write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
        return path

    def _clean_records(self) -> list[dict[str, object]]:
        return [
            self._record(
                "ordinary-clean",
                "ordinary-conversation",
                "ordinary-book-discussion-v2",
                "I enjoyed a long mystery novel yesterday. What genre might I try next?",
                "Try a character-driven thriller if you liked the mystery and want more pace.",
                {"discourse_form": "follow-up", "entity_set": "books-02"},
            ),
            self._record(
                "constraints-clean",
                "practical-constraints",
                "limited-water-cleanup-v2",
                "I have very little water available for cleanup after painting. What is feasible?",
                "Wipe excess paint first, seal used materials, and save the available water for a final rinse.",
                {"resource_state": "scarce", "fallback_kind": "dry-wipe"},
            ),
        ]

    def _semantic_receipt(self, curriculum: Path, index: Path) -> Path:
        path = self.root / "semantic-receipt.json"
        path.write_text(
            json.dumps(
                {
                    "schema": MODULE.SEMANTIC_RECEIPT_SCHEMA,
                    "audit_id": "fixture-semantic-audit-v1",
                    "status": "pass",
                    "curriculum_sha256": MODULE.sha256_file(curriculum),
                    "exclusion_index_sha256": MODULE.sha256_file(index),
                    "encoder": {
                        "repo_id": "sentence-transformers/all-MiniLM-L6-v2",
                        "revision": "3" * 40,
                        "license_id": "Apache-2.0",
                        "artifact_set_sha256": sha("4"),
                    },
                    "cosine_threshold": 0.82,
                    "review_floor": 0.72,
                    "maximum_similarity": 0.71,
                    "record_count": 2,
                    "exclusion_case_count": 3,
                    "comparison_count": 6,
                    "reviewed_pair_count": 0,
                    "finding_count": 0,
                    "auditor_identity_sha256": sha("9"),
                    "development_team_blinded": True,
                    "transcript_sha256": sha("5"),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return path


class ControlInputValidationTests(WorkingModelControlFixture, unittest.TestCase):
    def test_profile_rejects_evaluation_fixture_drift(self) -> None:
        self.evaluation_fixture.write_text("changed\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "byte length|SHA-256"):
            MODULE.load_profile(self.profile)

    def test_json_reader_rejects_duplicate_keys(self) -> None:
        duplicate = self.root / "duplicate.json"
        duplicate.write_text('{"status":"first","status":"second"}\n', encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "valid UTF-8 JSON"):
            MODULE.read_json_object(duplicate, 1024, "duplicate fixture")

    def test_profile_rejects_review_rubric_drift(self) -> None:
        self.review_rubric.write_text("{}\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "review rubric byte length|SHA-256"):
            MODULE.load_profile(self.profile)


class HoldoutCustodyTests(WorkingModelControlFixture, unittest.TestCase):
    def test_initialize_creates_private_templates_seed_and_public_safe_plan(
        self,
    ) -> None:
        custody, plan = self._initialize_custody()

        self.assertEqual(plan["status"], "awaiting-distinct-contributions")
        self.assertEqual(plan["case_count"], 2)
        self.assertEqual(
            plan["split_counts"], {"development": 1, "independent-audit": 1}
        )
        self.assertEqual(len((custody / MODULE.HOLDOUT_SEED_FILENAME).read_bytes()), 32)
        for filename in (
            MODULE.DEVELOPMENT_CONTRIBUTION_FILENAME,
            MODULE.INDEPENDENT_AUDIT_CONTRIBUTION_FILENAME,
        ):
            template = json.loads((custody / filename).read_text(encoding="utf-8"))
            self.assertEqual(template["status"], "authoring-required")
            self.assertEqual(len(template["cases"]), 1)
            self.assertEqual(template["cases"][0]["prompt_variants"], [])
        public_bytes = (custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME).read_bytes()
        self.assertNotIn(bytes(range(32)), public_bytes)
        self.assertNotIn(b"Avery", public_bytes)
        summary = MODULE._custody_plan_cli_summary(plan)
        self.assertNotIn("slots", summary)
        self.assertEqual(summary["case_count"], 2)

    def test_initialize_refuses_existing_output_root(self) -> None:
        custody, _ = self._initialize_custody()

        with self.assertRaisesRegex(ValueError, "already exists"):
            MODULE.initialize_holdout_custody(
                MODULE.load_profile(self.profile), "fixture-custody-v1", custody
            )

    def test_distinct_completed_contributions_assemble_and_seal(self) -> None:
        custody, _ = self._initialize_custody()
        development, independent = self._complete_holdout_contributions(custody)
        assembled = self.root / "assembled-holdouts"

        receipt = MODULE.assemble_holdout_contributions(
            MODULE.load_profile(self.profile),
            custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME,
            development,
            independent,
            assembled,
        )

        self.assertEqual(receipt["status"], "assembled-awaiting-holdout-seal")
        self.assertFalse(receipt["training_authority"])
        self.assertEqual(
            receipt["control_program_sha256"], MODULE.control_program_sha256()
        )
        public_bytes = (
            assembled / MODULE.HOLDOUT_CUSTODY_RECEIPT_FILENAME
        ).read_bytes()
        self.assertNotIn(b"Avery", public_bytes)
        sealed = self.root / "custody-sealed"
        sealed_receipt = MODULE.seal_holdouts(
            MODULE.load_profile(self.profile),
            assembled / MODULE.ASSEMBLED_FACTOR_PACK_FILENAME,
            custody / MODULE.HOLDOUT_SEED_FILENAME,
            assembled / MODULE.HOLDOUT_CUSTODY_RECEIPT_FILENAME,
            sealed,
        )
        self.assertEqual(sealed_receipt["case_count"], 2)
        self.assertEqual(
            sealed_receipt["control_program_sha256"],
            MODULE.control_program_sha256(),
        )

    def test_plan_from_another_control_program_is_rejected(self) -> None:
        custody, _ = self._initialize_custody()
        development, independent = self._complete_holdout_contributions(custody)
        source_plan = custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME
        plan = json.loads(source_plan.read_text(encoding="utf-8"))
        plan["control_program_sha256"] = sha("f")
        plan_path = self.root / "foreign-control-plan.json"
        plan_path.write_text(json.dumps(plan) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "another control program"):
            MODULE.assemble_holdout_contributions(
                MODULE.load_profile(self.profile),
                plan_path,
                development,
                independent,
                self.root / "foreign-control-output",
            )

    def test_tampered_authoring_template_identity_is_rejected(self) -> None:
        custody, _ = self._initialize_custody()
        development, independent = self._complete_holdout_contributions(custody)
        source_plan = custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME
        plan = json.loads(source_plan.read_text(encoding="utf-8"))
        plan["development_template_sha256"] = sha("e")
        plan_path = self.root / "tampered-template-plan.json"
        plan_path.write_text(json.dumps(plan) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "template identity mismatch"):
            MODULE.assemble_holdout_contributions(
                MODULE.load_profile(self.profile),
                plan_path,
                development,
                independent,
                self.root / "tampered-template-output",
            )

    def test_same_author_identity_is_rejected(self) -> None:
        custody, _ = self._initialize_custody()
        development, independent = self._complete_holdout_contributions(custody)
        value = json.loads(independent.read_text(encoding="utf-8"))
        value["author_identity_sha256"] = sha("a")
        independent.write_text(json.dumps(value) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "distinct author identities"):
            MODULE.assemble_holdout_contributions(
                MODULE.load_profile(self.profile),
                custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME,
                development,
                independent,
                self.root / "same-author-output",
            )

    def test_same_custody_domain_is_rejected(self) -> None:
        custody, _ = self._initialize_custody()
        development, independent = self._complete_holdout_contributions(custody)
        value = json.loads(independent.read_text(encoding="utf-8"))
        value["custody_domain_sha256"] = sha("c")
        independent.write_text(json.dumps(value) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "distinct custody domains"):
            MODULE.assemble_holdout_contributions(
                MODULE.load_profile(self.profile),
                custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME,
                development,
                independent,
                self.root / "same-custody-output",
            )

    def test_unfinished_authoring_template_is_rejected(self) -> None:
        custody, _ = self._initialize_custody()
        development, _ = self._complete_holdout_contributions(custody)

        with self.assertRaisesRegex(ValueError, "status must be complete"):
            MODULE.assemble_holdout_contributions(
                MODULE.load_profile(self.profile),
                custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME,
                development,
                custody / MODULE.INDEPENDENT_AUDIT_CONTRIBUTION_FILENAME,
                self.root / "unfinished-output",
            )

    def test_cross_custody_prompt_reuse_is_rejected(self) -> None:
        custody, _ = self._initialize_custody()
        development, independent = self._complete_holdout_contributions(custody)
        development_value = json.loads(development.read_text(encoding="utf-8"))
        independent_value = json.loads(independent.read_text(encoding="utf-8"))
        independent_value["cases"][0]["prompt_variants"][0] = development_value[
            "cases"
        ][0]["prompt_variants"][0]
        independent.write_text(json.dumps(independent_value) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "globally distinct"):
            MODULE.assemble_holdout_contributions(
                MODULE.load_profile(self.profile),
                custody / MODULE.HOLDOUT_CUSTODY_PLAN_FILENAME,
                development,
                independent,
                self.root / "overlap-output",
            )


class HoldoutSealingTests(WorkingModelControlFixture, unittest.TestCase):
    def test_seal_is_deterministic_and_public_receipt_contains_no_private_text(
        self,
    ) -> None:
        first, first_receipt = self._seal("first")
        second, second_receipt = self._seal("second")

        self.assertEqual(first_receipt, second_receipt)
        for filename in (
            MODULE.PRIVATE_HOLDOUT_FILENAME,
            MODULE.PRIVATE_INDEX_FILENAME,
            MODULE.PUBLIC_RECEIPT_FILENAME,
        ):
            self.assertEqual(
                (first / filename).read_bytes(), (second / filename).read_bytes()
            )
        public_bytes = (first / MODULE.PUBLIC_RECEIPT_FILENAME).read_bytes()
        self.assertNotIn(b"Avery", public_bytes)
        self.assertNotIn(b"microwave", public_bytes)
        self.assertEqual(first_receipt["case_count"], 2)
        self.assertEqual(first_receipt["public_evaluation_case_count"], 1)
        self.assertEqual(
            first_receipt["split_counts"], {"development": 1, "independent-audit": 1}
        )

    def test_seal_refuses_existing_output_root(self) -> None:
        output, _ = self._seal()
        custody, assembled = self._assembled_holdout_custody()

        with self.assertRaisesRegex(ValueError, "already exists"):
            MODULE.seal_holdouts(
                MODULE.load_profile(self.profile),
                assembled / MODULE.ASSEMBLED_FACTOR_PACK_FILENAME,
                custody / MODULE.HOLDOUT_SEED_FILENAME,
                assembled / MODULE.HOLDOUT_CUSTODY_RECEIPT_FILENAME,
                output,
            )

    def test_seal_rejects_wrong_seed_length(self) -> None:
        custody, _ = self._assembled_holdout_custody()
        (custody / MODULE.HOLDOUT_SEED_FILENAME).write_bytes(b"too short")

        with self.assertRaisesRegex(ValueError, "exactly 32 bytes"):
            self._seal()

    def test_seal_rejects_correct_length_seed_outside_custody(self) -> None:
        custody, _ = self._assembled_holdout_custody()
        (custody / MODULE.HOLDOUT_SEED_FILENAME).write_bytes(b"x" * 32)

        with self.assertRaisesRegex(ValueError, "seed commitment mismatch"):
            self._seal()

    def test_seal_rejects_factor_pack_changed_after_custody_assembly(self) -> None:
        _, assembled = self._assembled_holdout_custody()
        factor_pack = assembled / MODULE.ASSEMBLED_FACTOR_PACK_FILENAME
        value = json.loads(factor_pack.read_text(encoding="utf-8"))
        value["cases"][0]["prompt_variants"][0] += " Additional detail."
        factor_pack.write_text(json.dumps(value) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "factor-pack identity mismatch"):
            self._seal()


class CurriculumAuditTests(WorkingModelControlFixture, unittest.TestCase):
    def test_clean_curriculum_passes_every_bound_layer(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        output = self.root / "audit.json"

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            index,
            semantic,
            None,
            output,
        )

        self.assertEqual(report["status"], "pass")
        self.assertEqual(report["record_count"], 2)
        self.assertEqual(report["finding_count"], 0)
        self.assertEqual(report["adjudicated_record_count"], 0)
        self.assertEqual(
            report["review_manifest_sha256"], MODULE.sha256_file(self.review_manifest)
        )
        self.assertEqual(MODULE.read_json_object(output, 1024 * 1024, "audit"), report)

    def test_review_manifest_is_required(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)

        with self.assertRaisesRegex(ValueError, "review manifest.*regular"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.root / "missing-review-manifest.json",
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_review_manifest_binds_the_exact_control_program(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["control_program_sha256"] = sha("0")
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "control program identity"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_primary_reviewer_identities_and_custody_must_be_distinct(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["primary_reviewer_ledgers"][1]["reviewer_identity_sha256"] = manifest[
            "primary_reviewer_ledgers"
        ][0]["reviewer_identity_sha256"]
        manifest["primary_reviewer_ledgers"][1]["custody_domain_sha256"] = manifest[
            "primary_reviewer_ledgers"
        ][0]["custody_domain_sha256"]
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "reviewer identities must be distinct"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_primary_reviewer_custody_domains_must_be_distinct(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["primary_reviewer_ledgers"][1]["custody_domain_sha256"] = manifest[
            "primary_reviewer_ledgers"
        ][0]["custody_domain_sha256"]
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "custody domains must be distinct"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_primary_review_ledger_must_cover_every_record(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        ledger = self.primary_review_ledgers[1]
        first_line = ledger.read_text(encoding="utf-8").splitlines()[0]
        ledger.write_text(first_line + "\n", encoding="utf-8")
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["primary_reviewer_ledgers"][1]["bytes"] = ledger.stat().st_size
        manifest["primary_reviewer_ledgers"][1]["sha256"] = MODULE.sha256_file(ledger)
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "exactly cover the curriculum"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_review_decision_cannot_drift_from_candidate(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        ledger = self.primary_review_ledgers[0]
        decisions = [
            json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines()
        ]
        decisions[0]["candidate_sha256"] = sha("0")
        ledger.write_text(
            "".join(json.dumps(item) + "\n" for item in decisions), encoding="utf-8"
        )
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["primary_reviewer_ledgers"][0]["bytes"] = ledger.stat().st_size
        manifest["primary_reviewer_ledgers"][0]["sha256"] = MODULE.sha256_file(ledger)
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "immutable candidate"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_review_disagreement_requires_adjudication(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(
            self._clean_records(),
            primary_outcomes={"ordinary-clean": ("accept", "reject")},
        )
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)

        with self.assertRaisesRegex(ValueError, "require.*adjudication"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_distinct_adjudicator_can_resolve_a_disagreement(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(
            self._clean_records(),
            primary_outcomes={"ordinary-clean": ("accept", "reject")},
            adjudication_outcomes={"ordinary-clean": "accept"},
        )
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            index,
            semantic,
            None,
            self.root / "audit.json",
        )

        self.assertEqual(report["status"], "pass")
        self.assertEqual(report["adjudicated_record_count"], 1)

    def test_adjudicator_must_be_distinct_from_primary_reviewers(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(
            self._clean_records(),
            primary_outcomes={"ordinary-clean": ("accept", "reject")},
            adjudication_outcomes={"ordinary-clean": "accept"},
        )
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["adjudication_ledger"]["adjudicator_identity_sha256"] = manifest[
            "primary_reviewer_ledgers"
        ][0]["reviewer_identity_sha256"]
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(
            ValueError, "adjudicator identity must be distinct"
        ):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_adjudication_is_forbidden_when_primary_reviewers_agree(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)
        unnecessary = self.root / "unnecessary-adjudication.jsonl"
        unnecessary.write_text("{}\n", encoding="utf-8")
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["adjudication_ledger"] = {
            "path": str(unnecessary),
            "bytes": unnecessary.stat().st_size,
            "sha256": MODULE.sha256_file(unnecessary),
            "adjudicator_identity_sha256": sha("5"),
            "custody_domain_sha256": sha("6"),
        }
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(
            ValueError, "forbidden when primary reviewers agree"
        ):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_forged_review_summary_is_rejected_even_when_manifest_is_rehashed(
        self,
    ) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        records = [
            json.loads(line)
            for line in curriculum.read_text(encoding="utf-8").splitlines()
        ]
        records[0]["review"]["decision_sha256"] = sha("0")
        curriculum.write_text(
            "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
        )
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["curriculum_sha256"] = MODULE.sha256_file(curriculum)
        self.review_manifest.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
        index = sealed / MODULE.PRIVATE_INDEX_FILENAME
        semantic = self._semantic_receipt(curriculum, index)

        with self.assertRaisesRegex(ValueError, "summary is not derived"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                index,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_exact_normalized_holdout_prompt_is_rejected(self) -> None:
        sealed, _ = self._seal()
        materialized = MODULE.read_json_lines(
            sealed / MODULE.PRIVATE_HOLDOUT_FILENAME, 1024 * 1024, "holdouts"
        )
        records = self._clean_records()
        records[0]["messages"] = [
            {"role": "user", "content": materialized[0]["prompt"].upper() + "!"}
        ]
        curriculum = self._write_curriculum(records)
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            None,
            self.root / "audit.json",
        )

        self.assertEqual(report["status"], "fail")
        self.assertIn("exact-normalized-prompt", report["finding_kinds"])

    def test_template_and_answer_anchor_leakage_are_rejected(self) -> None:
        sealed, _ = self._seal()
        records = self._clean_records()
        records[0]["template_family_id"] = "ordinary-weather-followup-v1"
        materialized = MODULE.read_json_lines(
            sealed / MODULE.PRIVATE_HOLDOUT_FILENAME, 1024 * 1024, "holdouts"
        )
        records[1]["response"] = materialized[1]["answer_anchors"][0]
        curriculum = self._write_curriculum(records)
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            None,
            self.root / "audit.json",
        )

        self.assertEqual(report["status"], "fail")
        self.assertIn("template-family", report["finding_kinds"])
        self.assertIn("exact-answer-anchor", report["finding_kinds"])

    def test_public_evaluation_prompt_and_expected_term_are_excluded(self) -> None:
        sealed, _ = self._seal()
        records = self._clean_records()
        records[0]["messages"] = [
            {
                "role": "user",
                "content": "Compare the two lighthouse schedules before choosing one.",
            }
        ]
        records[1]["response"] = (
            "First acknowledge the conflict, then inspect which schedule has authority."
        )
        curriculum = self._write_curriculum(records)
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            None,
            self.root / "audit.json",
        )

        self.assertEqual(report["status"], "fail")
        self.assertIn("exact-normalized-prompt", report["finding_kinds"])
        self.assertIn("answer-anchor-term", report["finding_kinds"])

    def test_entity_substitution_cannot_hide_a_holdout_template(self) -> None:
        sealed, _ = self._seal()
        materialized = MODULE.read_json_lines(
            sealed / MODULE.PRIVATE_HOLDOUT_FILENAME, 1024 * 1024, "holdouts"
        )
        source_prompt = next(
            case["prompt"]
            for case in materialized
            if case["task_family"] == "ordinary-conversation"
        )
        substituted = source_prompt.replace("Avery", "Blake").replace(
            "Cedar Bay", "Harbor Point"
        )
        records = self._clean_records()
        records[0]["messages"] = [{"role": "user", "content": substituted}]
        records[0]["entities"] = [
            {"kind": "person", "value": "Blake"},
            {"kind": "place", "value": "Harbor Point"},
        ]
        curriculum = self._write_curriculum(records)
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            None,
            self.root / "audit.json",
        )

        self.assertEqual(report["status"], "fail")
        self.assertTrue(
            {"derived-template-signature", "entity-substituted-token-ngram"}
            & set(report["finding_kinds"])
        )

    def test_semantic_receipt_drift_is_rejected(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )
        value = json.loads(semantic.read_text(encoding="utf-8"))
        value["curriculum_sha256"] = sha("0")
        semantic.write_text(json.dumps(value), encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "semantic receipt curriculum"):
            MODULE.audit_curriculum(
                MODULE.load_profile(self.profile),
                curriculum,
                self.review_manifest,
                sealed / MODULE.PRIVATE_INDEX_FILENAME,
                semantic,
                None,
                self.root / "audit.json",
            )

    def test_tombstoned_record_cannot_remain_in_curriculum(self) -> None:
        sealed, _ = self._seal()
        records = self._clean_records()
        curriculum = self._write_curriculum(records)
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )
        tombstones = self.root / "tombstones.jsonl"
        tombstones.write_text(
            json.dumps(
                {
                    "schema": MODULE.TOMBSTONE_SCHEMA,
                    "tombstone_id": "remove-ordinary-clean-v1",
                    "record_id": "ordinary-clean",
                    "record_sha256": MODULE.sha256_bytes(
                        MODULE.canonical_json_bytes(records[0])
                    ),
                    "reason_code": "review-withdrawn",
                    "decision_sha256": sha("6"),
                }
            )
            + "\n",
            encoding="utf-8",
        )

        report = MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            tombstones,
            self.root / "audit.json",
        )

        self.assertEqual(report["status"], "fail")
        self.assertIn("active-tombstone", report["finding_kinds"])


class TrainingLockTests(WorkingModelControlFixture, unittest.TestCase):
    def _identity(self, path: Path) -> dict[str, object]:
        return {
            "path": str(path),
            "bytes": path.stat().st_size,
            "sha256": MODULE.sha256_file(path),
        }

    def _request(
        self,
        sealed: Path,
        curriculum: Path,
        semantic: Path,
        audit: Path,
    ) -> Path:
        environment_lock = self.root / "environment-lock.json"
        environment_lock.write_text('{"locked":true}\n', encoding="utf-8")
        trainer = self.root / "trainer.py"
        trainer.write_text("raise SystemExit('fixture only')\n", encoding="utf-8")
        request = self.root / "training-lock-request.json"
        request.write_text(
            json.dumps(
                {
                    "schema": MODULE.TRAINING_LOCK_REQUEST_SCHEMA,
                    "lock_id": "fixture-cpu-pilot-v1",
                    "source_root": str(self.source_dir),
                    "source_files": [
                        self._identity(self.source_model),
                        self._identity(self.source_tokenizer),
                    ],
                    "curriculum": self._identity(curriculum),
                    "curriculum_audit": self._identity(audit),
                    "review_manifest": self._identity(self.review_manifest),
                    "holdout_receipt": self._identity(
                        sealed / MODULE.PUBLIC_RECEIPT_FILENAME
                    ),
                    "exclusion_index": self._identity(
                        sealed / MODULE.PRIVATE_INDEX_FILENAME
                    ),
                    "semantic_receipt": self._identity(semantic),
                    "tombstone_lineage": self._identity(self.tombstones),
                    "environment_lock": self._identity(environment_lock),
                    "training_program": self._identity(trainer),
                    "output_root": str(self.root / "training-output"),
                    "training": json.loads(self.profile.read_text(encoding="utf-8"))[
                        "training"
                    ],
                    "stop_rules": json.loads(self.profile.read_text(encoding="utf-8"))[
                        "stop_rules"
                    ],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return request

    def test_training_lock_is_issued_only_from_passing_bound_evidence(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )
        audit = self.root / "audit.json"
        MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            self.tombstones,
            audit,
        )
        request = self._request(sealed, curriculum, semantic, audit)
        output = self.root / "training-lock.json"

        lock = MODULE.freeze_training_lock(
            MODULE.load_profile(self.profile), request, output
        )

        self.assertEqual(lock["status"], "authorized")
        self.assertEqual(lock["authorized_operation"], "cpu-lora-pilot")
        self.assertFalse((self.root / "training-output").exists())

        # Passing audits cannot authorize a model output outside its storage root.
        value = json.loads(request.read_text(encoding="utf-8"))
        value["output_root"] = "E:/TinyRustLM-vnext-private/old-training-output"
        request.write_text(json.dumps(value), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "output_root.*inside"):
            MODULE.freeze_training_lock(
                MODULE.load_profile(self.profile),
                request,
                self.root / "misplaced-lock.json",
            )

    def test_training_lock_refuses_failed_curriculum_audit(self) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )
        audit = self.root / "audit.json"
        audit.write_text(
            json.dumps({"schema": MODULE.CURRICULUM_AUDIT_SCHEMA, "status": "fail"})
            + "\n",
            encoding="utf-8",
        )
        request = self._request(sealed, curriculum, semantic, audit)

        with self.assertRaisesRegex(ValueError, "curriculum audit must pass"):
            MODULE.freeze_training_lock(
                MODULE.load_profile(self.profile), request, self.root / "lock.json"
            )

    def test_training_lock_reopens_review_evidence_and_rejects_manifest_drift(
        self,
    ) -> None:
        sealed, _ = self._seal()
        curriculum = self._write_curriculum(self._clean_records())
        semantic = self._semantic_receipt(
            curriculum, sealed / MODULE.PRIVATE_INDEX_FILENAME
        )
        audit = self.root / "audit.json"
        MODULE.audit_curriculum(
            MODULE.load_profile(self.profile),
            curriculum,
            self.review_manifest,
            sealed / MODULE.PRIVATE_INDEX_FILENAME,
            semantic,
            self.tombstones,
            audit,
        )
        manifest = json.loads(self.review_manifest.read_text(encoding="utf-8"))
        manifest["status"] = "complete"
        self.review_manifest.write_text(
            json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8"
        )
        request = self._request(sealed, curriculum, semantic, audit)

        with self.assertRaisesRegex(ValueError, "does not bind.*review manifest"):
            MODULE.freeze_training_lock(
                MODULE.load_profile(self.profile), request, self.root / "lock.json"
            )


class ModelStorageLocationTests(unittest.TestCase):
    """Check the actual model-volume boundary without creating model files."""

    def test_model_inputs_and_new_outputs_require_canonical_children(self) -> None:
        """Accept the owner's exact subtree and reject older drives and aliases."""
        for value in (
            "D:/LLMs/TinyRustLM/sources/new-model",
            "d:/llms/tinyrustlm/models/new-model",
        ):
            with self.subTest(path=value):
                self.assertEqual(
                    MODULE._require_model_location(Path(value), "model fixture"),
                    Path(value),
                )
                MODULE._require_allowed_storage_drive(Path(value), "model fixture")
        for value in (
            "E:/TinyRustLM",
            "E:/Source/Rust/TinyRustLM.com/artifacts/model",
            "C:/models/new",
            "D:/LLMs/TinyRustLM-other/model",
            "D:/LLMs/TinyRustLM",
            "D:/LLMs/TinyRustLM/a/../model",
            "X:/LLMS/model",
            "relative/model",
        ):
            with self.subTest(path=value):
                with self.assertRaisesRegex(ValueError, "model fixture"):
                    MODULE._require_model_location(Path(value), "model fixture")
        with self.assertRaisesRegex(ValueError, "model fixture"):
            MODULE._require_allowed_storage_drive(
                Path("D:/misplaced/model"), "model fixture"
            )

    def test_model_paths_reject_reparse_ancestors_and_dangling_new_leaf(self) -> None:
        """A nonexistent target never permits an unchecked linked parent or leaf."""
        target = Path("D:/LLMs/TinyRustLM/unused-fixture/model")
        for linked in (target.parent, target):
            with (
                self.subTest(linked=linked),
                mock.patch.object(
                    MODULE,
                    "_is_symlink_or_reparse",
                    side_effect=lambda candidate: candidate == linked,
                ),
            ):
                with self.assertRaisesRegex(ValueError, "model fixture.*reparse"):
                    MODULE._require_model_location(target, "model fixture")


if __name__ == "__main__":
    unittest.main()
