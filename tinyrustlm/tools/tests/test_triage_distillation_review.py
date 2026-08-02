"""Contract tests for deterministic pending-review triage."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "triage-distillation-review.py"


def load_script():
    spec = importlib.util.spec_from_file_location("tinyrustlm_review_triage", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ReviewTriageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_script()

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-review-triage-")
        self.root = Path(self._temporary.name)

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_flags_risk_and_contract_drift_without_approval_fields(self) -> None:
        workbook = self._write_workbook(
            "fixture-review-v1",
            [
                self._context(
                    "current-health",
                    "practical-judgment",
                    "What is the current safest supplement for sleep?",
                    "This supplement will prevent insomnia. Take it nightly. Ask a doctor first.",
                    ["Use no more than two sentences.", "Do not invent current facts."],
                ),
                self._context(
                    "simple-choice",
                    "practical-judgment",
                    "How should I choose between two plain notebooks?",
                    "Compare page count, binding durability, paper feel, and price for your actual use.",
                    ["Answer directly in one sentence."],
                ),
                self._context(
                    "strict-object",
                    "strict-json",
                    "Return a JSON object with string keys state and detail.",
                    "state=queued, detail=stored",
                    ["Return one valid JSON object and no surrounding prose."],
                ),
            ],
        )
        output = self.root / "triage"

        report = self.module.write_triage((workbook,), output)

        self.assertEqual(report["record_count"], 3)
        rows = self._read_jsonl(output / "review-triage.jsonl")
        by_id = {row["id"]: row for row in rows}
        self.assertIn("current_or_recommendation_verification", by_id["current-health"]["flags"])
        self.assertIn("medical_or_health_verification", by_id["current-health"]["flags"])
        self.assertIn("sentence_limit_exceeded", by_id["current-health"]["contract_findings"])
        self.assertEqual(by_id["current-health"]["priority"], "critical")
        self.assertIn("invalid_json_object", by_id["strict-object"]["contract_findings"])
        self.assertEqual(by_id["simple-choice"]["priority"], "routine")
        for row in rows:
            self.assertEqual(row["status"], "review-required-never-auto-approved")
            self.assertNotIn("decision", row)
            self.assertNotIn("approved", row)
            self.assertNotIn("reviewed_response", row)
            self.assertNotIn("draft_response", row)
        self.assertEqual(
            self.module.sha256_file(output / "review-triage.jsonl"),
            report["triage_sha256"],
        )

    def test_rejects_workbook_hash_drift_before_output(self) -> None:
        workbook = self._write_workbook(
            "fixture-review-v1",
            [
                self._context(
                    "simple-choice",
                    "practical-judgment",
                    "How should I choose?",
                    "Compare the options against your actual constraint.",
                    ["Answer directly."],
                )
            ],
        )
        decisions = workbook / "review-decisions.jsonl"
        decisions.write_text(decisions.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        output = self.root / "triage"

        with self.assertRaisesRegex(ValueError, "review decisions SHA-256 drift"):
            self.module.write_triage((workbook,), output)

        self.assertFalse(output.exists())

    def test_rejects_duplicate_record_ids_across_workbooks(self) -> None:
        context = self._context(
            "duplicate-id",
            "practical-judgment",
            "How should I choose?",
            "Compare the options against your actual constraint.",
            ["Answer directly."],
        )
        first = self._write_workbook("first", [context])
        second = self._write_workbook("second", [context])

        with self.assertRaisesRegex(ValueError, "duplicate review record id"):
            self.module.write_triage((first, second), self.root / "triage")

    def test_sentence_count_does_not_split_legal_citation_abbreviations(self) -> None:
        context = self._context(
            "legal-citation",
            "adult-lawful-inquiry",
            "Compare two legal arguments.",
            (
                "One argument follows McIntyre v. Ohio Elections Commission. "
                "The competing argument follows another line of cases. "
                "The policies protect different interests. "
                "The result depends on jurisdiction."
            ),
            ["Use no more than four concise sentences."],
        )

        self.assertEqual(self.module.contract_findings(context), ())

    def test_applies_hash_bound_suggestions_but_keeps_every_decision_pending(self) -> None:
        contexts = [
            self._context(
                "rewrite-me",
                "greeting-capability",
                "Reply briefly.",
                "This draft is too long. It has a second sentence.",
                ["Use one short sentence."],
            ),
            self._context(
                "reject-me",
                "practical-judgment",
                "Give practical advice.",
                "Invent an answer.",
                ["Answer directly."],
            ),
            self._context(
                "untouched",
                "practical-judgment",
                "Give practical advice.",
                "Compare the available options.",
                ["Answer directly."],
            ),
        ]
        workbook = self._write_workbook("suggestions", contexts)
        suggestions = self.root / "suggestions.jsonl"
        suggestions.write_text(
            "".join(
                json.dumps(value, sort_keys=True) + "\n"
                for value in [
                    self._suggestion(
                        contexts[0],
                        "rewrite",
                        "I will keep it brief.",
                        "The original exceeded the one-sentence contract.",
                    ),
                    self._suggestion(
                        contexts[1],
                        "reject",
                        "",
                        "The draft invents unsupported advice and should be rejected.",
                    ),
                ]
            ),
            encoding="utf-8",
        )
        output = self.root / "suggested-review"

        receipt = self.module.write_suggested_review(workbook, suggestions, output)

        self.assertEqual(receipt["suggestion_count"], 2)
        self.assertEqual(receipt["rewrite_count"], 1)
        self.assertEqual(receipt["reject_count"], 1)
        decisions = self._read_jsonl(output / "review-decisions.jsonl")
        by_id = {value["id"]: value for value in decisions}
        self.assertEqual(by_id["rewrite-me"]["reviewed_response"], "I will keep it brief.")
        self.assertEqual(by_id["reject-me"]["reviewed_response"], "")
        self.assertEqual(
            by_id["untouched"]["reviewed_response"], "Compare the available options."
        )
        self.assertTrue(all(value["decision"] == "pending" for value in decisions))
        self.assertTrue(all(value["reviewer_id"] == "pending-reviewer" for value in decisions))
        self.assertTrue(all(value["factuality"] == "pending" for value in decisions))

    def test_rejects_stale_or_contract_breaking_suggestions_before_output(self) -> None:
        context = self._context(
            "rewrite-me",
            "greeting-capability",
            "Reply briefly.",
            "This draft is too long. It has a second sentence.",
            ["Use one short sentence."],
        )
        workbook = self._write_workbook("suggestions", [context])
        stale = self._suggestion(
            context,
            "rewrite",
            "I will keep it brief.",
            "The original exceeded the one-sentence contract.",
        )
        stale["draft_response_sha256"] = "sha256:" + "0" * 64
        stale_path = self.root / "stale.jsonl"
        stale_path.write_text(json.dumps(stale) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "suggestion draft hash drift"):
            self.module.write_suggested_review(
                workbook, stale_path, self.root / "stale-output"
            )
        self.assertFalse((self.root / "stale-output").exists())

        broken = self._suggestion(
            context,
            "rewrite",
            "Still too long. This is a second sentence.",
            "This deliberately violates the response contract.",
        )
        broken_path = self.root / "broken.jsonl"
        broken_path.write_text(json.dumps(broken) + "\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "suggested response contract findings"):
            self.module.write_suggested_review(
                workbook, broken_path, self.root / "broken-output"
            )
        self.assertFalse((self.root / "broken-output").exists())

    def test_merges_hash_bound_suggestion_sources_with_v2_receipt(self) -> None:
        contexts = [
            self._context(
                "first",
                "practical-judgment",
                "Give the first action.",
                "Use the first draft.",
                ["Answer directly."],
            ),
            self._context(
                "second",
                "practical-judgment",
                "Give the second action.",
                "Use the second draft.",
                ["Answer directly."],
            ),
        ]
        workbook = self._write_workbook("multi-source", contexts)
        first_source = self.root / "first-suggestions.jsonl"
        second_source = self.root / "second-suggestions.jsonl"
        first_source.write_text(
            json.dumps(
                self._suggestion(
                    contexts[0], "rewrite", "Use the verified first action.", "First fix."
                )
            )
            + "\n",
            encoding="utf-8",
        )
        second_source.write_text(
            json.dumps(
                self._suggestion(
                    contexts[1],
                    "rewrite",
                    "Use the verified second action.",
                    "Second fix.",
                )
            )
            + "\n",
            encoding="utf-8",
        )
        output = self.root / "multi-source-assisted"

        receipt = self.module.write_suggested_review(
            workbook, (first_source, second_source), output
        )

        self.assertEqual(receipt["schema"], "tinyrustlm.agent_assisted_review_workbook.v2")
        self.assertEqual(receipt["suggestion_count"], 2)
        self.assertEqual(len(receipt["suggestion_sources"]), 2)
        identity, answers = self.module.load_assisted_workbook(output)
        self.assertEqual(identity["suggestion_count"], 2)
        self.assertEqual([answer.origin for answer in answers], ["agent-rewrite"] * 2)

    def test_rejects_duplicate_ids_across_suggestion_sources(self) -> None:
        context = self._context(
            "duplicate-source-id",
            "practical-judgment",
            "Give one action.",
            "Use the draft action.",
            ["Answer directly."],
        )
        workbook = self._write_workbook("duplicate-sources", [context])
        first_source = self.root / "duplicate-first.jsonl"
        second_source = self.root / "duplicate-second.jsonl"
        suggestion = self._suggestion(
            context, "rewrite", "Use the verified action.", "Correct the answer."
        )
        first_source.write_text(json.dumps(suggestion) + "\n", encoding="utf-8")
        second_source.write_text(json.dumps(suggestion) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "duplicate suggestion ids across sources"):
            self.module.write_suggested_review(
                workbook,
                (first_source, second_source),
                self.root / "duplicate-source-output",
            )
        self.assertFalse((self.root / "duplicate-source-output").exists())

    def test_audits_pending_answers_without_emitting_text_or_approval(self) -> None:
        contexts = [
            self._context(
                "role-leak",
                "practical-judgment",
                "Give one direct action.",
                "Use the verified copy.",
                ["Answer directly in one sentence."],
            ),
            self._context(
                "reject-me",
                "practical-judgment",
                "Give practical advice.",
                "Invent an answer.",
                ["Answer directly."],
            ),
            self._context(
                "duplicate-one",
                "practical-judgment",
                "Compare these options.",
                "Compare the available options.",
                ["Answer directly."],
            ),
            self._context(
                "duplicate-two",
                "practical-judgment",
                "How should I decide?",
                "Compare the available options.",
                ["Answer directly."],
            ),
        ]
        source = self._write_workbook("pending-audit", contexts)
        suggestions = self.root / "pending-audit-suggestions.jsonl"
        suggestions.write_text(
            "".join(
                json.dumps(value, sort_keys=True) + "\n"
                for value in (
                    self._suggestion(
                        contexts[0],
                        "rewrite",
                        "Assistant: Use the verified copy.",
                        "A concise replacement for explicit review.",
                    ),
                    self._suggestion(
                        contexts[1],
                        "reject",
                        "",
                        "The source answer invents unsupported advice.",
                    ),
                )
            ),
            encoding="utf-8",
        )
        assisted = self.root / "assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        output = self.root / "pending-answer-audit"

        report = self.module.write_pending_answer_audit((assisted,), output)

        self.assertEqual(report["record_count"], 4)
        self.assertFalse(report["training_authority"])
        self.assertFalse(report["contains_response_text"])
        self.assertFalse(report["contains_approval_decisions"])
        self.assertEqual(report["origin_counts"]["agent-reject"], 1)
        self.assertEqual(report["linguistic_audit"]["status"], "pass")
        self.assertEqual(report["linguistic_audit"]["false_capability_count"], 0)
        rows = self._read_jsonl(output / "pending-answer-audit.jsonl")
        by_id = {row["id"]: row for row in rows}
        self.assertIn("role_prefix_leakage", by_id["role-leak"]["quality_findings"])
        self.assertIn(
            "agent_reject_suggestion", by_id["reject-me"]["quality_findings"]
        )
        self.assertIn(
            "exact_response_duplicate", by_id["duplicate-one"]["quality_findings"]
        )
        self.assertIn(
            "normalized_response_duplicate",
            by_id["duplicate-two"]["quality_findings"],
        )
        for row in rows:
            self.assertNotIn("prompt", row)
            self.assertNotIn("reviewed_response", row)
            self.assertNotIn("decision", row)
        audit_bytes = (output / "pending-answer-audit.jsonl").read_text(
            encoding="utf-8"
        )
        for context in contexts:
            self.assertNotIn(str(context["prompt"]), audit_bytes)
            self.assertNotIn(str(context["draft_response"]), audit_bytes)
        self.assertNotIn("Assistant: Use the verified copy.", audit_bytes)

    def test_pending_answer_audit_rejects_assisted_decision_drift(self) -> None:
        context = self._context(
            "rewrite-me",
            "practical-judgment",
            "Give one direct action.",
            "Use the verified copy.",
            ["Answer directly."],
        )
        source = self._write_workbook("pending-audit-drift", [context])
        suggestions = self.root / "drift-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    context,
                    "rewrite",
                    "Check the verified copy first.",
                    "Makes the next action explicit.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "drift-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        decisions = assisted / "review-decisions.jsonl"
        decisions.write_text(
            decisions.read_text(encoding="utf-8") + "\n", encoding="utf-8"
        )

        with self.assertRaisesRegex(ValueError, "assisted review decisions SHA-256 drift"):
            self.module.write_pending_answer_audit(
                (assisted,), self.root / "drift-audit"
            )
        self.assertFalse((self.root / "drift-audit").exists())

    def test_quality_audit_accepts_direct_labels_and_numeric_notation(self) -> None:
        self.assertEqual(
            self.module.response_quality_findings(
                "multi-turn-state", "Which color is current?", "Teal"
            ),
            (),
        )
        self.assertEqual(
            self.module.response_quality_findings(
                "multi-turn-state", "Which filename is current?", "findings.md"
            ),
            (),
        )
        self.assertNotIn(
            "degenerate_repetition",
            self.module.response_quality_findings(
                "factual-qa",
                "What is a billion?",
                (
                    "A billion is 1,000,000,000, or one followed by nine zeros. "
                    "It is also one thousand million."
                ),
            ),
        )
        self.assertIn(
            "degenerate_repetition",
            self.module.response_quality_findings(
                "factual-qa", "What happened?", "echo echo echo"
            ),
        )

    def test_quality_audit_flags_mojibake_without_rejecting_valid_unicode(self) -> None:
        for response in (
            "The cat\u00e2\u20ac\u2122s carrier is ready.",
            "The angle is 90\u00c2\u00b0.",
            "Try the caf\u00c3\u00a9 nearby.",
        ):
            self.assertIn(
                "mojibake_encoding_artifact",
                self.module.response_quality_findings(
                    "practical-judgment", "Give a clean answer.", response
                ),
            )

        self.assertNotIn(
            "mojibake_encoding_artifact",
            self.module.response_quality_findings(
                "practical-judgment",
                "Give a clean answer.",
                "The caf\u00e9 serves cr\u00e8me br\u00fbl\u00e9e at 90\u00b0F.",
            ),
        )

    def test_pending_linguistic_audit_applies_cognitive_liberty_rates(self) -> None:
        rows = [
            {"id": "narrow-boundary", "risk_flags": ["refusal_language_review"]},
            {"id": "direct-help", "risk_flags": []},
        ]

        audit = self.module.pending_linguistic_audit(rows)

        self.assertEqual(audit["status"], "fail")
        self.assertEqual(audit["refusal_language_count"], 1)
        self.assertEqual(audit["refusal_language_rate"], 0.5)
        self.assertEqual(audit["failures"], ["refusal_language_rate"])

    def test_semantic_neighbor_pairs_are_stable_and_clustered(self) -> None:
        pairs = self.module.semantic_neighbor_pairs(
            ("alpha", "alpha-paraphrase", "beta", "beta-paraphrase"),
            ((1.0, 0.0), (0.999, 0.01), (0.0, 1.0), (0.01, 0.999)),
            0.95,
        )

        self.assertEqual(len(pairs), 2)
        self.assertEqual(
            {(pair["left_id"], pair["right_id"]) for pair in pairs},
            {("alpha", "alpha-paraphrase"), ("beta", "beta-paraphrase")},
        )
        self.assertTrue(all(pair["cosine_similarity"] > 0.99 for pair in pairs))
        clusters = self.module.semantic_neighbor_clusters(pairs)
        self.assertEqual(len(clusters), 2)
        self.assertEqual(
            {tuple(cluster["record_ids"]) for cluster in clusters},
            {
                ("alpha", "alpha-paraphrase"),
                ("beta", "beta-paraphrase"),
            },
        )
        self.assertTrue(
            all(cluster["cluster_id"].startswith("semantic-neighbor-") for cluster in clusters)
        )

    def test_semantic_neighbor_pairs_reject_invalid_embeddings(self) -> None:
        with self.assertRaisesRegex(ValueError, "dimensions differ"):
            self.module.semantic_neighbor_pairs(
                ("left", "right"), ((1.0, 0.0), (1.0,)), 0.9
            )
        with self.assertRaisesRegex(ValueError, "non-finite"):
            self.module.semantic_neighbor_pairs(
                ("left", "right"), ((1.0, 0.0), (float("nan"), 1.0)), 0.9
            )
        with self.assertRaisesRegex(ValueError, "zero or invalid norm"):
            self.module.semantic_neighbor_pairs(
                ("left", "right"), ((1.0, 0.0), (0.0, 0.0)), 0.9
            )

    def test_semantic_neighbor_audit_omits_text_and_never_rejects(self) -> None:
        contexts = [
            self._context(
                "first-question",
                "practical-judgment",
                "How should I choose a plain notebook?",
                "Compare paper, binding, page count, and price.",
                ["Answer directly."],
            ),
            self._context(
                "paraphrased-question",
                "practical-judgment",
                "How do I pick a basic notebook?",
                "Compare the paper, binding, pages, and total cost.",
                ["Answer directly."],
            ),
            self._context(
                "unrelated-question",
                "factual-qa",
                "What is a lunar eclipse?",
                "Earth blocks sunlight that would otherwise reach the Moon.",
                ["Answer directly."],
            ),
        ]
        source = self._write_workbook("semantic-source", contexts)
        suggestions = self.root / "semantic-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    contexts[0],
                    "rewrite",
                    "Compare paper, binding, page count, and total price.",
                    "Makes the comparison criteria explicit.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "semantic-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        encoder_dir = self._write_encoder_fixture()

        def fixture_encoder(_texts, _encoder_dir, _max_length, _batch_size):
            return ((1.0, 0.0), (0.999, 0.01), (0.0, 1.0))

        output = self.root / "semantic-audit"
        report = self.module.write_semantic_neighbor_audit(
            (assisted,),
            output,
            encoder_dir,
            "sentence-transformers/all-MiniLM-L6-v2",
            "1" * 40,
            "apache-2.0",
            0.95,
            128,
            16,
            fixture_encoder,
        )

        self.assertEqual(report["record_count"], 3)
        self.assertEqual(report["semantic_pair_count"], 1)
        self.assertEqual(report["cluster_count"], 1)
        self.assertEqual(
            report["semantic_neighbor_origin_counts"],
            {"agent-rewrite": 1, "original-draft": 1},
        )
        self.assertEqual(report["proposed_reject_neighbor_record_count"], 0)
        self.assertEqual(report["clusters_with_proposed_rejects"], 0)
        self.assertEqual(
            report["clusters"][0]["candidate_origin_counts"],
            {"agent-rewrite": 1, "original-draft": 1},
        )
        self.assertEqual(report["clusters"][0]["proposed_reject_record_ids"], [])
        self.assertEqual(report["automatic_rejection_count"], 0)
        self.assertFalse(report["contains_prompt_text"])
        self.assertFalse(report["contains_response_text"])
        self.assertFalse(report["contains_approval_decisions"])
        self.assertFalse(report["training_authority"])
        rows = self._read_jsonl(output / "semantic-neighbor-audit.jsonl")
        self.assertEqual(rows[0]["left_id"], "first-question")
        self.assertEqual(rows[0]["right_id"], "paraphrased-question")
        self.assertEqual(
            rows[0]["status"],
            "semantic-neighbor-review-required-never-auto-rejected",
        )
        serialized = (output / "semantic-neighbor-audit.jsonl").read_text(
            encoding="utf-8"
        )
        for forbidden in (
            "How should I choose",
            "How do I pick",
            "Compare paper",
            "Earth blocks sunlight",
            '"decision"',
        ):
            self.assertNotIn(forbidden, serialized)
        self.assertEqual(
            self.module.sha256_file(output / "semantic-neighbor-audit.jsonl"),
            report["audit_sha256"],
        )

    def test_prepares_deterministic_hash_bound_human_review_batches(self) -> None:
        contexts = [
            self._context(
                "strict-object",
                "strict-json",
                "Return a JSON object with string keys state and detail.",
                "state=queued, detail=stored",
                ["Return one valid JSON object and no surrounding prose."],
            ),
            self._context(
                "simple-choice",
                "practical-judgment",
                "How should I choose between two plain notebooks?",
                "Compare page count, binding durability, paper feel, and price.",
                ["Answer directly in one sentence."],
            ),
            self._context(
                "reject-me",
                "practical-judgment",
                "Give one grounded action.",
                "Invent an answer.",
                ["Answer directly."],
            ),
        ]
        source = self._write_workbook("human-review-source", contexts)
        suggestions = self.root / "human-review-suggestions.jsonl"
        suggestions.write_text(
            "".join(
                json.dumps(value, sort_keys=True) + "\n"
                for value in (
                    self._suggestion(
                        contexts[0],
                        "rewrite",
                        '{"detail":"stored","state":"queued"}',
                        "Replace invalid pseudo-JSON with the requested object.",
                    ),
                    self._suggestion(
                        contexts[2],
                        "reject",
                        "",
                        "The draft does not contain a grounded answer.",
                    ),
                )
            ),
            encoding="utf-8",
        )
        assisted = self.root / "human-review-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)

        encoder_dir = self._write_encoder_fixture()

        def fixture_encoder(_texts, _encoder_dir, _max_length, _batch_size):
            return ((1.0, 0.0), (0.999, 0.01), (0.0, 1.0))

        semantic = self.root / "human-review-semantic"
        self.module.write_semantic_neighbor_audit(
            (assisted,),
            semantic,
            encoder_dir,
            "sentence-transformers/all-MiniLM-L6-v2",
            "1" * 40,
            "apache-2.0",
            0.95,
            128,
            16,
            fixture_encoder,
        )

        first = self.root / "human-review-handoff-first"
        second = self.root / "human-review-handoff-second"
        first_manifest = self.module.write_human_review_handoff(
            (assisted,), first, 2, (semantic,)
        )
        second_manifest = self.module.write_human_review_handoff(
            (assisted,), second, 2, (semantic,)
        )

        self.assertEqual(first_manifest, second_manifest)
        self.assertEqual(first_manifest["record_count"], 3)
        self.assertEqual(first_manifest["batch_count"], 2)
        self.assertFalse(first_manifest["training_authority"])
        self.assertEqual(first_manifest["resolved_decision_count"], 0)
        self.assertEqual(
            first_manifest["status"],
            "human-review-batches-pending-explicit-decisions-not-training-approved",
        )
        self.assertEqual(
            (first / "human-review-handoff-manifest.json").read_bytes(),
            (second / "human-review-handoff-manifest.json").read_bytes(),
        )

        review_rows = []
        decision_rows = []
        for batch in first_manifest["batches"]:
            review_path = first / batch["review_file"]
            decision_path = first / batch["decision_file"]
            self.assertEqual(self.module.sha256_file(review_path), batch["review_sha256"])
            self.assertEqual(
                self.module.sha256_file(decision_path),
                batch["initial_decision_sha256"],
            )
            review_rows.extend(self._read_jsonl(review_path))
            decision_rows.extend(self._read_jsonl(decision_path))

        self.assertEqual(review_rows[0]["id"], "strict-object")
        self.assertEqual({row["id"] for row in review_rows}, {row["id"] for row in decision_rows})
        strict = next(row for row in review_rows if row["id"] == "strict-object")
        self.assertEqual(strict["candidate_action"], "rewrite")
        self.assertEqual(strict["candidate_response"], '{"detail":"stored","state":"queued"}')
        self.assertEqual(strict["original_draft_response"], "state=queued, detail=stored")
        self.assertTrue(strict["semantic_clusters"])
        self.assertIn("context_sha256", strict)
        self.assertIn("assisted_workbook_receipt_sha256", strict)
        self.assertIn("candidate_response_sha256", strict)
        self.assertTrue(all(row["action"] == "pending" for row in decision_rows))
        self.assertTrue(all(row["reviewer_id"] == "pending-reviewer" for row in decision_rows))
        self.assertTrue(all(row["factuality"] == "pending" for row in decision_rows))
        by_id = {row["id"]: row for row in decision_rows}
        self.assertEqual(
            by_id["strict-object"]["reviewed_response"],
            strict["candidate_response"],
        )

    def test_audits_incremental_human_review_without_exposing_text(self) -> None:
        contexts = [
            self._context(
                "approve-me",
                "practical-judgment",
                "Give one grounded action.",
                "Use the grounded action.",
                ["Answer directly."],
            ),
            self._context(
                "rewrite-me",
                "practical-judgment",
                "Give one independently checked action.",
                "Use the draft action.",
                ["Answer directly."],
            ),
            self._context(
                "pending-me",
                "practical-judgment",
                "Give one action that still needs review.",
                "Use the pending action.",
                ["Answer directly."],
            ),
        ]
        source = self._write_workbook("progress-source", contexts)
        suggestions = self.root / "progress-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    contexts[0],
                    "rewrite",
                    "Use the independently grounded action.",
                    "Make the evidence boundary explicit.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "progress-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        handoff = self.root / "progress-handoff"
        manifest = self.module.write_human_review_handoff((assisted,), handoff, 2)

        for batch in manifest["batches"]:
            decision_path = handoff / batch["decision_file"]
            rows = self._read_jsonl(decision_path)
            for row in rows:
                if row["id"] == "pending-me":
                    continue
                row["action"] = "approve" if row["id"] == "approve-me" else "rewrite"
                if row["action"] == "rewrite":
                    row["reviewed_response"] = "Use the independently checked action."
                row["reviewer_id"] = "alice-reviewer"
                row["review_note"] = f"Explicitly reviewed {row['id']} against its contract."
                for field in self.module.PENDING_FIELDS:
                    row[field] = "pass"
            decision_path.write_text(
                "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows),
                encoding="utf-8",
            )

        first_output = self.root / "progress-audit-first"
        second_output = self.root / "progress-audit-second"
        first = self.module.write_human_review_progress(handoff, first_output)
        second = self.module.write_human_review_progress(handoff, second_output)

        self.assertEqual(first, second)
        self.assertEqual(first["record_count"], 3)
        self.assertEqual(first["pending_count"], 1)
        self.assertEqual(first["approved_count"], 1)
        self.assertEqual(first["rewritten_count"], 1)
        self.assertEqual(first["rejected_count"], 0)
        self.assertEqual(first["resolved_count"], 2)
        self.assertFalse(first["ready_for_merge"])
        self.assertFalse(first["training_authority"])
        self.assertFalse(first["contains_prompt_text"])
        self.assertFalse(first["contains_response_text"])
        self.assertEqual(
            sum(batch["pending_count"] for batch in first["batches"]), 1
        )
        self.assertEqual(
            (first_output / "human-review-progress-report.json").read_bytes(),
            (second_output / "human-review-progress-report.json").read_bytes(),
        )
        serialized = (first_output / "human-review-progress-report.json").read_text(
            encoding="utf-8"
        )
        for context in contexts:
            self.assertNotIn(str(context["prompt"]), serialized)
            self.assertNotIn(str(context["draft_response"]), serialized)

        for batch in manifest["batches"]:
            decision_path = handoff / batch["decision_file"]
            rows = self._read_jsonl(decision_path)
            for row in rows:
                if row["id"] != "pending-me":
                    continue
                row["action"] = "reject"
                row["reviewed_response"] = ""
                row["reviewer_id"] = "alice-reviewer"
                row["review_note"] = "Explicitly rejected after review against the contract."
                for field in self.module.PENDING_FIELDS:
                    row[field] = "not-applicable"
                row["instruction_following"] = "fail"
            decision_path.write_text(
                "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows),
                encoding="utf-8",
            )

        complete = self.module.write_human_review_progress(
            handoff, self.root / "progress-audit-complete"
        )
        self.assertEqual(complete["pending_count"], 0)
        self.assertEqual(complete["resolved_count"], 3)
        self.assertEqual(complete["rejected_count"], 1)
        self.assertTrue(complete["ready_for_merge"])
        self.assertEqual(
            complete["required_next_gate"], "run-fail-closed-human-review-merge"
        )

    def test_progress_audit_rejects_ambiguous_partially_edited_pending_row(self) -> None:
        context = self._context(
            "ambiguous-pending",
            "practical-judgment",
            "Give one direct action.",
            "Use the direct action.",
            ["Answer directly."],
        )
        source = self._write_workbook("ambiguous-progress-source", [context])
        suggestions = self.root / "ambiguous-progress-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    context,
                    "rewrite",
                    "Use the independently checked action.",
                    "Make the evidence boundary explicit.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "ambiguous-progress-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        handoff = self.root / "ambiguous-progress-handoff"
        manifest = self.module.write_human_review_handoff((assisted,), handoff, 25)
        decision_path = handoff / manifest["batches"][0]["decision_file"]
        rows = self._read_jsonl(decision_path)
        rows[0]["reviewer_id"] = "alice-reviewer"
        decision_path.write_text(
            json.dumps(rows[0], sort_keys=True) + "\n", encoding="utf-8"
        )

        output = self.root / "ambiguous-progress-output"
        with self.assertRaisesRegex(ValueError, "partially edited pending decision"):
            self.module.write_human_review_progress(handoff, output)
        self.assertFalse(output.exists())

    def test_merges_complete_human_review_into_downstream_decision_files(self) -> None:
        contexts = [
            self._context(
                "approve-candidate",
                "practical-judgment",
                "Give one direct action.",
                "Use the original action.",
                ["Answer directly."],
            ),
            self._context(
                "rewrite-candidate",
                "practical-judgment",
                "Give one direct action.",
                "Use the draft action.",
                ["Answer directly."],
            ),
            self._context(
                "reject-candidate",
                "practical-judgment",
                "Give one direct action.",
                "Invent an action.",
                ["Answer directly."],
            ),
        ]
        source = self._write_workbook("merge-review-source", contexts)
        suggestions = self.root / "merge-review-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    contexts[2],
                    "reject",
                    "",
                    "The draft is unsupported and should not enter training.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "merge-review-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        handoff = self.root / "merge-review-handoff"
        manifest = self.module.write_human_review_handoff((assisted,), handoff, 2)

        actions = {
            "approve-candidate": ("approve", "Use the original action."),
            "rewrite-candidate": ("rewrite", "Use the independently verified action."),
            "reject-candidate": ("reject", ""),
        }
        for batch in manifest["batches"]:
            path = handoff / batch["decision_file"]
            rows = self._read_jsonl(path)
            for row in rows:
                action, response = actions[row["id"]]
                row["action"] = action
                row["reviewed_response"] = response
                row["reviewer_id"] = "alice-reviewer"
                row["review_note"] = f"Explicitly reviewed {row['id']} against its contract."
                for field in self.module.PENDING_FIELDS:
                    row[field] = "pass"
                if action == "reject":
                    row["instruction_following"] = "fail"
            path.write_text(
                "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows),
                encoding="utf-8",
            )

        output = self.root / "merged-human-review"
        receipt = self.module.merge_human_review_handoff(handoff, output)

        self.assertEqual(receipt["approved_count"], 1)
        self.assertEqual(receipt["rewritten_count"], 1)
        self.assertEqual(receipt["rejected_count"], 1)
        self.assertFalse(receipt["training_authority"])
        campaign = receipt["campaigns"][0]
        decisions_path = output / campaign["review_decisions_file"]
        decision_rows = self._read_jsonl(decisions_path)
        self.assertTrue(
            all(set(row) == self.module.DECISION_KEYS for row in decision_rows)
        )
        decisions = {row["id"]: row for row in decision_rows}
        self.assertEqual(decisions["approve-candidate"]["decision"], "approved")
        self.assertEqual(decisions["rewrite-candidate"]["decision"], "approved")
        self.assertEqual(decisions["reject-candidate"]["decision"], "rejected")
        self.assertEqual(
            decisions["rewrite-candidate"]["reviewed_response"],
            "Use the independently verified action.",
        )
        self.assertEqual(decisions["reject-candidate"]["reviewed_response"], "")

    def test_human_review_merge_fails_closed_on_incomplete_or_stale_input(self) -> None:
        contexts = [
            self._context(
                "review-me",
                "practical-judgment",
                "Give one direct action.",
                "Use the verified action.",
                ["Answer directly."],
            ),
            self._context(
                "review-other",
                "practical-judgment",
                "Give one other direct action.",
                "Use the other verified action.",
                ["Answer directly."],
            ),
        ]
        source = self._write_workbook("fail-closed-source", contexts)
        suggestions = self.root / "fail-closed-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    contexts[0],
                    "rewrite",
                    "Use the independently verified action.",
                    "Make the evidence boundary explicit.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "fail-closed-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)

        cases = (
            ("missing", "review decision coverage mismatch"),
            ("duplicate", "review decision coverage mismatch"),
            ("unknown", "review decision coverage mismatch"),
            ("reordered", "review decision order mismatch"),
            ("stale", "candidate response SHA-256 drift"),
            ("placeholder", "reviewer_id is still a placeholder"),
            ("pending", "must explicitly resolve action"),
            ("partial-checklist", "must pass every checklist field"),
            ("changed-approve", "approve must preserve"),
            ("reject-response", "reject must not carry a training response"),
        )
        for case, message in cases:
            with self.subTest(case=case):
                handoff = self.root / f"fail-closed-handoff-{case}"
                manifest = self.module.write_human_review_handoff((assisted,), handoff, 25)
                decision_path = handoff / manifest["batches"][0]["decision_file"]
                rows = self._read_jsonl(decision_path)
                for row in rows:
                    row["action"] = "approve"
                    row["reviewer_id"] = "alice-reviewer"
                    row["review_note"] = "Explicit review completed against the contract."
                    for field in self.module.PENDING_FIELDS:
                        row[field] = "pass"
                row = rows[0]
                if case == "missing":
                    rows = rows[1:]
                elif case == "duplicate":
                    rows.append(dict(row))
                elif case == "unknown":
                    row["id"] = "unknown-review-id"
                elif case == "reordered":
                    rows.reverse()
                elif case == "stale":
                    row["candidate_response_sha256"] = "sha256:" + "0" * 64
                elif case == "placeholder":
                    row["reviewer_id"] = "pending-reviewer"
                elif case == "pending":
                    row["action"] = "pending"
                elif case == "partial-checklist":
                    row["factuality"] = "not-applicable"
                elif case == "changed-approve":
                    row["reviewed_response"] = "Use a changed response."
                elif case == "reject-response":
                    row["action"] = "reject"
                    row["instruction_following"] = "fail"
                decision_path.write_text(
                    "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows),
                    encoding="utf-8",
                )
                output = self.root / f"fail-closed-output-{case}"
                with self.assertRaisesRegex(ValueError, message):
                    self.module.merge_human_review_handoff(handoff, output)
                self.assertFalse(output.exists())

    def test_human_review_merge_rejects_altered_immutable_evidence(self) -> None:
        context = self._context(
            "immutable-review",
            "practical-judgment",
            "Give one direct action.",
            "Use the verified action.",
            ["Answer directly."],
        )
        source = self._write_workbook("immutable-source", [context])
        suggestions = self.root / "immutable-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                self._suggestion(
                    context,
                    "rewrite",
                    "Use the independently verified action.",
                    "Make the evidence boundary explicit.",
                ),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "immutable-assisted"
        self.module.write_suggested_review(source, suggestions, assisted)
        handoff = self.root / "immutable-handoff"
        manifest = self.module.write_human_review_handoff((assisted,), handoff, 25)
        review_path = handoff / manifest["batches"][0]["review_file"]
        review_path.write_text(
            review_path.read_text(encoding="utf-8") + "\n", encoding="utf-8"
        )

        output = self.root / "immutable-output"
        with self.assertRaisesRegex(ValueError, "immutable review batch SHA-256 drift"):
            self.module.merge_human_review_handoff(handoff, output)
        self.assertFalse(output.exists())

    def _context(
        self,
        record_id: str,
        task_family: str,
        prompt: str,
        response: str,
        requirements: list[str],
    ) -> dict[str, object]:
        return {
            "schema": "tinyrustlm.teacher_review_context_record.v1",
            "id": record_id,
            "task_family": task_family,
            "prompt": prompt,
            "response_requirements": requirements,
            "max_tokens": 128,
            "seed": 42,
            "request_sha256": "sha256:" + "1" * 64,
            "finish_reason": "stop",
            "draft_response": response,
            "draft_response_sha256": self.module.sha256_bytes(response.encode("utf-8")),
        }

    def _write_workbook(
        self, campaign_id: str, contexts: list[dict[str, object]]
    ) -> Path:
        workbook = self.root / campaign_id
        workbook.mkdir()
        manifest = workbook / "teacher-draft-manifest.json"
        manifest.write_text(
            json.dumps({"campaign_id": campaign_id, "record_count": len(contexts)}) + "\n",
            encoding="utf-8",
        )
        context_path = workbook / "review-context.jsonl"
        context_path.write_text(
            "".join(json.dumps(value, sort_keys=True) + "\n" for value in contexts),
            encoding="utf-8",
        )
        decisions = []
        for context in contexts:
            decisions.append(
                {
                    "id": context["id"],
                    "decision": "pending",
                    "draft_response_sha256": context["draft_response_sha256"],
                    "reviewed_response": context["draft_response"],
                    "reviewer_id": "pending-reviewer",
                    "review_note": "Pending explicit review against the prompt and response contract.",
                    "factuality": "pending",
                    "instruction_following": "pending",
                    "safety": "pending",
                    "conciseness": "pending",
                    "hidden_reasoning_absent": "pending",
                }
            )
        decisions_path = workbook / "review-decisions.jsonl"
        decisions_path.write_text(
            "".join(json.dumps(value, sort_keys=True) + "\n" for value in decisions),
            encoding="utf-8",
        )
        receipt = {
            "schema": "tinyrustlm.teacher_review_workbook_receipt.v2",
            "campaign_id": campaign_id,
            "draft_manifest_path": str(manifest),
            "draft_manifest_sha256": self.module.sha256_file(manifest),
            "review_decisions_file": decisions_path.name,
            "review_decisions_sha256": self.module.sha256_file(decisions_path),
            "review_context_file": context_path.name,
            "review_context_sha256": self.module.sha256_file(context_path),
            "record_count": len(contexts),
            "pending_count": len(contexts),
            "status": "pending-explicit-record-review-not-training-approved",
            "required_next_gate": "resolve-every-pending-review-decision",
        }
        (workbook / "review-workbook-receipt.json").write_text(
            json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        return workbook

    def _write_encoder_fixture(self) -> Path:
        encoder = self.root / "encoder"
        encoder.mkdir()
        for name in self.module.ENCODER_REQUIRED_FILES:
            (encoder / name).write_bytes(f"fixture {name}".encode("ascii"))
        return encoder

    @staticmethod
    def _suggestion(
        context: dict[str, object],
        action: str,
        proposed_response: str,
        rationale: str,
    ) -> dict[str, object]:
        return {
            "schema": "tinyrustlm.teacher_review_suggestion.v1",
            "id": context["id"],
            "draft_response_sha256": context["draft_response_sha256"],
            "action": action,
            "proposed_response": proposed_response,
            "rationale": rationale,
            "evidence_tags": ["prompt-contract", "agent-review"],
            "agent_id": "tinyrustlm-agent",
            "confidence": "high",
        }

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict[str, object]]:
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


if __name__ == "__main__":
    unittest.main()
