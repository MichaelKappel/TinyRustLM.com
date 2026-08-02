"""Provenance contract tests for source quality capture."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "reference-raw-quality.py"
SPEC = importlib.util.spec_from_file_location("tinyrustlm_reference_quality", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ReferenceRawQualityTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-reference-")
        self.root = Path(self._temporary.name)
        for name in MODULE.REQUIRED_PROVENANCE_FILES:
            (self.root / name).write_text("{}\n", encoding="utf-8")

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_direct_safetensors_checkpoint_is_hashed(self) -> None:
        weights = self.root / "model.safetensors"
        weights.write_bytes(b"direct weights")

        artifacts = MODULE.checkpoint_provenance(self.root)

        self.assertEqual(
            artifacts["model.safetensors"]["sha256"],
            MODULE.sha256_file(weights),
        )

    def test_standalone_chat_template_is_hashed(self) -> None:
        weights = self.root / "model.safetensors"
        weights.write_bytes(b"direct weights")
        template = self.root / "chat_template.jinja"
        template.write_text("{{ messages }}\n", encoding="utf-8")

        artifacts = MODULE.checkpoint_provenance(self.root)

        self.assertEqual(
            artifacts["chat_template.jinja"]["sha256"],
            MODULE.sha256_file(template),
        )

    def test_sentencepiece_model_is_hashed_when_present(self) -> None:
        weights = self.root / "model.safetensors"
        weights.write_bytes(b"direct weights")
        sentencepiece = self.root / "tokenizer.model"
        sentencepiece.write_bytes(b"sentencepiece model bytes")

        artifacts = MODULE.checkpoint_provenance(self.root)

        self.assertEqual(
            artifacts["tokenizer.model"]["sha256"],
            MODULE.sha256_file(sentencepiece),
        )

    def test_indexed_safetensors_checkpoint_hashes_every_declared_shard(self) -> None:
        shard = self.root / "model.safetensors-00001-of-00001.safetensors"
        shard.write_bytes(b"indexed weights")
        index = self.root / "model.safetensors.index.json"
        index.write_text(
            json.dumps({"weight_map": {"model.embed_tokens.weight": shard.name}}),
            encoding="utf-8",
        )

        artifacts = MODULE.checkpoint_provenance(self.root)

        self.assertIn(index.name, artifacts)
        self.assertEqual(artifacts[shard.name]["sha256"], MODULE.sha256_file(shard))

    def test_indexed_checkpoint_rejects_parent_traversal(self) -> None:
        (self.root / "model.safetensors.index.json").write_text(
            json.dumps({"weight_map": {"tensor": "../missing.safetensors"}}),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValueError, "safe relative path"):
            MODULE.checkpoint_provenance(self.root)

    def test_generation_config_is_optional_but_must_be_an_object(self) -> None:
        self.assertEqual(MODULE.source_generation_config(self.root), {})
        (self.root / "generation_config.json").write_text("[]", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "JSON object"):
            MODULE.source_generation_config(self.root)

    def test_greedy_generation_preserves_publisher_stop_token_list(self) -> None:
        parameters = MODULE.greedy_generation_parameters(
            {"eos_token_id": [11, 228]},
            11,
        )

        self.assertFalse(parameters["do_sample"])
        self.assertEqual(parameters["repetition_penalty"], 1.0)
        self.assertEqual(parameters["pad_token_id"], 11)
        self.assertEqual(parameters["eos_token_id"], [11, 228])
        self.assertIsNone(parameters["temperature"])
        self.assertIsNone(parameters["top_k"])
        self.assertIsNone(parameters["top_p"])

    def test_stop_token_contract_rejects_ambiguous_or_unbounded_values(self) -> None:
        invalid_values = (
            None,
            True,
            -1,
            [],
            [11, 11],
            [11, -1],
            list(range(MODULE.MAX_EOS_TOKEN_IDS + 1)),
        )

        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "eos_token_id"):
                    MODULE.resolve_eos_token_id({"eos_token_id": value}, 11)

    def test_publisher_eos_override_binds_checkpoint_authority(self) -> None:
        authority = self.root / "README.md"
        authority.write_text(
            "Use EOS token IDs 2 and 32000 for generation.\n",
            encoding="utf-8",
        )

        override = MODULE.publisher_generation_override(
            self.root,
            [2, 32000],
            "README.md",
        )

        self.assertIsNotNone(override)
        assert override is not None
        self.assertEqual(override["authority_file"], "README.md")
        self.assertEqual(override["authority_file_bytes"], authority.stat().st_size)
        self.assertEqual(override["authority_file_sha256"], MODULE.sha256_file(authority))
        self.assertEqual(override["eos_token_id"], [2, 32000])
        parameters = MODULE.greedy_generation_parameters(
            {"eos_token_id": 2},
            32000,
            override["eos_token_id"],
        )
        self.assertEqual(parameters["eos_token_id"], [2, 32000])

    def test_publisher_eos_override_requires_both_ids_and_authority(self) -> None:
        with self.assertRaisesRegex(ValueError, "require both"):
            MODULE.publisher_generation_override(self.root, [2], None)
        with self.assertRaisesRegex(ValueError, "require both"):
            MODULE.publisher_generation_override(self.root, None, "README.md")

    def test_publisher_eos_override_rejects_unsafe_or_drifting_inputs(self) -> None:
        (self.root / "README.md").write_text("EOS 2.\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "checkpoint root"):
            MODULE.publisher_generation_override(
                self.root,
                [2],
                "docs/README.md",
            )
        with self.assertRaisesRegex(ValueError, "eos_token_id"):
            MODULE.publisher_generation_override(
                self.root,
                [2, 2],
                "README.md",
            )

    def test_policy_examples_are_strict_and_build_alternating_messages(self) -> None:
        path = self.root / "policy.jsonl"
        path.write_text(
            "\n".join(
                (
                    json.dumps(
                        {
                            "id": "conflict-one",
                            "user": "Two records disagree. What should I do?",
                            "assistant": "State the conflict and ask which source is authoritative.",
                        }
                    ),
                    json.dumps(
                        {
                            "id": "latest-one",
                            "user": "An old note says tea, but I now prefer coffee.",
                            "assistant": "Use coffee because the latest explicit preference controls.",
                        }
                    ),
                    "",
                )
            ),
            encoding="utf-8",
        )

        examples = MODULE.parse_policy_examples(path)
        messages = MODULE.conversation_messages(
            "system", examples, "current", "Check constraints before answering."
        )

        self.assertEqual(len(examples), 2)
        self.assertEqual([message["role"] for message in messages], [
            "system",
            "user",
            "assistant",
            "user",
            "assistant",
            "user",
        ])
        self.assertEqual(
            messages[-1]["content"],
            "current\n\nCheck constraints before answering.",
        )

    def test_policy_examples_reject_duplicate_ids(self) -> None:
        path = self.root / "policy.jsonl"
        record = {
            "id": "duplicate",
            "user": "A useful user message.",
            "assistant": "A useful assistant response.",
        }
        path.write_text(
            json.dumps(record) + "\n" + json.dumps(record) + "\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValueError, "duplicate id"):
            MODULE.parse_policy_examples(path)

    def test_eval_cases_parse_bounded_complete_conversation_history(self) -> None:
        path = self.root / "multi-turn.txt"
        path.write_text(
            "\n".join(
                (
                    "tinyrustlm_eval_cases_version=1",
                    "quality_gate_policy=one-call-conversation-quality-v1",
                    "case_count=1",
                    "case.0.prompt=Which name should you use now?",
                    "case.0.max_new_tokens=24",
                    "case.0.required_answer_terms=Riley, current name",
                    "case.0.forbidden_answer_terms=Morgan",
                    "case.0.history_turn_count=2",
                    "case.0.history.0.user=A saved note calls me Morgan.",
                    "case.0.history.0.assistant=The note says Morgan.",
                    "case.0.history.1.user=I just told you my name is Riley.",
                    "case.0.history.1.assistant=Understood.",
                    "",
                )
            ),
            encoding="utf-8",
        )

        cases = MODULE.parse_eval_cases(path)

        self.assertEqual(len(cases), 1)
        self.assertEqual(len(cases[0]["history"]), 2)
        self.assertEqual(cases[0]["history"][1]["user"], "I just told you my name is Riley.")
        self.assertEqual(cases[0]["required_answer_terms"], ("riley", "current name"))
        self.assertEqual(cases[0]["forbidden_answer_terms"], ("morgan",))

    def test_eval_cases_reject_partial_or_excess_conversation_history(self) -> None:
        partial = self.root / "partial.txt"
        partial.write_text(
            "\n".join(
                (
                    "tinyrustlm_eval_cases_version=1",
                    "quality_gate_policy=one-call-conversation-quality-v1",
                    "case_count=1",
                    "case.0.prompt=Continue.",
                    "case.0.max_new_tokens=16",
                    "case.0.history_turn_count=1",
                    "case.0.history.0.user=Remember this.",
                    "",
                )
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "history.0.assistant"):
            MODULE.parse_eval_cases(partial)

        excessive = self.root / "excessive.txt"
        excessive.write_text(
            "\n".join(
                (
                    "tinyrustlm_eval_cases_version=1",
                    "quality_gate_policy=one-call-conversation-quality-v1",
                    "case_count=1",
                    "case.0.prompt=Continue.",
                    "case.0.max_new_tokens=16",
                    "case.0.history_turn_count=7",
                    "",
                )
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "at most 6"):
            MODULE.parse_eval_cases(excessive)

    def test_conversation_messages_place_eval_history_before_current_user(self) -> None:
        history = (
            {"user": "First user turn.", "assistant": "First assistant turn."},
            {"user": "Latest user turn.", "assistant": "Latest assistant turn."},
        )

        messages = MODULE.conversation_messages(
            "system",
            (),
            "current",
            history=history,
        )

        self.assertEqual(
            [message["role"] for message in messages],
            ["system", "user", "assistant", "user", "assistant", "user"],
        )
        self.assertEqual(messages[-1]["content"], "current")
        self.assertEqual(messages[-2]["content"], "Latest assistant turn.")

    def test_publisher_template_can_explicitly_omit_system_role(self) -> None:
        prompt = MODULE.resolve_system_prompt("omitted-publisher-template", None)
        messages = MODULE.conversation_messages(prompt, (), "current")

        self.assertEqual(prompt, "")
        self.assertEqual(messages, ({"role": "user", "content": "current"},))
        with self.assertRaisesRegex(ValueError, "cannot be supplied"):
            MODULE.resolve_system_prompt(
                "omitted-publisher-template", "Do not silently discard me."
            )

    def test_included_system_prompt_defaults_and_rejects_invalid_text(self) -> None:
        self.assertEqual(
            MODULE.resolve_system_prompt("included", None),
            MODULE.DEFAULT_SYSTEM_PROMPT,
        )
        with self.assertRaisesRegex(ValueError, "included system prompt"):
            MODULE.resolve_system_prompt("included", " padded ")

    def test_source_report_declares_one_call_unmodified_contract(self) -> None:
        self.assertEqual(
            MODULE.one_call_generation_contract(),
            {
                "generation_contract": "one-call-unmodified-v1",
                "generation_retries_allowed": False,
                "response_repairs_allowed": False,
                "field_assembly_allowed": False,
                "expected_answer_injection_allowed": False,
            },
        )

    def test_local_loader_contract_binds_regex_fix_and_prohibits_remote_code(self) -> None:
        self.assertEqual(
            MODULE.local_loader_contract(True),
            {
                "loader_contract": "local-files-no-remote-code-v1",
                "torch_compile_mode": "disabled-eager",
                "tokenizer_load_options": {
                    "local_files_only": True,
                    "trust_remote_code": False,
                    "fix_mistral_regex": True,
                },
                "model_load_options": {
                    "local_files_only": True,
                    "trust_remote_code": False,
                    "dtype": "float32",
                },
            },
        )
        self.assertFalse(
            MODULE.local_loader_contract(False)["tokenizer_load_options"][
                "fix_mistral_regex"
            ]
        )

    def test_finite_topk_excludes_sampling_warper_sentinels(self) -> None:
        import torch

        values, indexes = MODULE.finite_topk(
            torch.tensor([float("-inf"), 3.0, float("nan"), 2.0, 1.0]),
            torch,
        )

        self.assertEqual(values.tolist(), [3.0, 2.0, 1.0])
        self.assertEqual(indexes.tolist(), [1, 3, 4])

    def test_report_serialization_rejects_nonfinite_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "JSON compliant"):
            MODULE.serialize_report({"logit": float("-inf")})

    def test_thinking_template_argument_is_explicit_and_bounded(self) -> None:
        self.assertEqual(
            MODULE.thinking_template_options(True, "enable_thinking"),
            {"enable_thinking": False},
        )
        self.assertEqual(
            MODULE.thinking_template_options(True, "thinking"),
            {"thinking": False},
        )
        self.assertEqual(
            MODULE.thinking_template_options(False, "thinking"),
            {},
        )
        with self.assertRaisesRegex(ValueError, "unsupported thinking"):
            MODULE.thinking_template_options(True, "unknown")

    def test_answer_terms_are_assessed_without_entering_messages(self) -> None:
        assessment = MODULE.assess_answer_terms(
            "Use Riley as the current name.",
            ("riley", "current name"),
            ("morgan",),
        )
        failed = MODULE.assess_answer_terms(
            "Use Morgan.",
            ("riley",),
            ("morgan",),
        )
        messages = MODULE.conversation_messages("system", (), "Which name?")

        self.assertEqual(assessment["status"], "pass")
        self.assertEqual(failed["missing_required_terms"], ["riley"])
        self.assertEqual(failed["matched_forbidden_terms"], ["morgan"])
        self.assertNotIn("riley", json.dumps(messages).lower())


if __name__ == "__main__":
    unittest.main()
