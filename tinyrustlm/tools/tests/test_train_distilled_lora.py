"""Contract tests for the sequence-distillation LoRA worker."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace


SCRIPT = Path(__file__).resolve().parents[1] / "train-distilled-lora.py"
SPEC = importlib.util.spec_from_file_location("tinyrustlm_train_distilled_lora", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DistilledLoraWorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-lora-worker-")
        self.root = Path(self._temporary.name)
        self.recipe = self._write_fixture()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_verify_recipe_binds_dataset_checkpoint_and_system_prompt(self) -> None:
        verified = MODULE.verify_recipe(self.recipe)
        summary = MODULE.verification_summary(verified)

        self.assertEqual(summary["status"], "pass")
        self.assertEqual(summary["record_count"], 1)
        self.assertEqual(verified.records[0].record_id, "privacy-one")
        self.assertEqual(verified.records[0].task_family, "uaix-memory-grounding")

    def test_verify_recipe_rejects_post_freeze_record_drift(self) -> None:
        response_path = self.root / "dataset" / "records" / "privacy.response.txt"
        original = response_path.read_bytes()
        response_path.write_bytes(b"X" + original[1:])

        with self.assertRaisesRegex(ValueError, "SHA-256 drift"):
            MODULE.verify_recipe(self.recipe)

    def test_verify_recipe_binds_and_hashes_structured_history(self) -> None:
        history_path = self._upgrade_fixture_to_structured_history()

        verified = MODULE.verify_recipe(self.recipe)

        self.assertEqual(
            [(message.role, message.content) for message in verified.records[0].history],
            [
                ("user", "The first note says the project uses metric units."),
                ("assistant", "I recorded metric units for the project."),
            ],
        )
        self.assertEqual(
            MODULE.verification_summary(verified)["structured_history_record_count"],
            1,
        )
        history_path.write_bytes(history_path.read_bytes().replace(b"metric", b"meters", 1))
        with self.assertRaisesRegex(ValueError, "history SHA-256 drift"):
            MODULE.verify_recipe(self.recipe)

    def test_verify_recipe_rejects_output_path_that_is_a_file(self) -> None:
        output = self.root / "output"
        output.write_text("not a directory", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "output_dir must be a directory"):
            MODULE.verify_recipe(self.recipe)

    def test_verify_recipe_rejects_unknown_control_keys(self) -> None:
        with self.recipe.open("a", encoding="utf-8") as stream:
            stream.write("hidden_override=true\n")

        with self.assertRaisesRegex(ValueError, "unknown keys"):
            MODULE.verify_recipe(self.recipe)

    def test_transformers_dtype_argument_tracks_public_api_version(self) -> None:
        self.assertEqual(MODULE.transformers_dtype_argument("4.57.1"), "torch_dtype")
        self.assertEqual(MODULE.transformers_dtype_argument("5.13.1"), "dtype")

    def test_training_arguments_avoid_removed_transformers_overwrite_flag(self) -> None:
        verified = MODULE.verify_recipe(self.recipe)
        values = MODULE.training_arguments_kwargs(
            verified.output_dir,
            verified.recipe,
            20260711,
            "cpu",
            "float32",
            len(verified.records),
        )

        self.assertNotIn("overwrite_output_dir", values)
        self.assertNotIn("warmup_ratio", values)
        self.assertEqual(values["warmup_steps"], 1)
        self.assertTrue(values["use_cpu"])
        self.assertFalse(values["fp16"])
        self.assertEqual(values["output_dir"], str(verified.output_dir))

    def test_preservation_engine_binds_a_frozen_source_partition(self) -> None:
        self._upgrade_fixture_to_preservation_engine()

        verified = MODULE.verify_recipe(self.recipe)

        self.assertEqual(
            MODULE.preservation_source_ids(verified.recipe),
            frozenset({"rehearsal-source"}),
        )
        self.assertEqual(
            [record.source_id for record in verified.records],
            ["target-source", "rehearsal-source"],
        )
        self.assertEqual(
            MODULE.verification_summary(verified)["preservation_record_count"], 1
        )

    def test_preservation_engine_rejects_an_unknown_source_partition(self) -> None:
        self._upgrade_fixture_to_preservation_engine()
        text = self.recipe.read_text(encoding="utf-8").replace(
            "preservation_source_ids=rehearsal-source",
            "preservation_source_ids=missing-source",
        )
        self.recipe.write_text(text, encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "does not select any frozen records"):
            MODULE.verify_recipe(self.recipe)

    def test_topk_engine_binds_a_same_tokenizer_teacher_cache(self) -> None:
        self._upgrade_fixture_to_topk_engine()

        verified = MODULE.verify_recipe(self.recipe)
        summary = MODULE.verification_summary(verified)

        self.assertIsNotNone(verified.topk_cache)
        self.assertEqual(summary["topk_teacher_record_count"], 1)
        self.assertEqual(summary["topk_teacher_target_count"], 1)
        self.assertEqual(verified.topk_cache.top_k, 2)
        self.assertEqual(verified.topk_cache.temperature, 2.0)

    def test_topk_engine_rejects_cross_tokenizer_cache_identity(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        text = manifest.read_text(encoding="utf-8").replace(
            "teacher_tokenizer_sha256="
            + MODULE.sha256_file(self.root / "base" / "tokenizer.json"),
            "teacher_tokenizer_sha256=sha256:" + "0" * 64,
        )
        manifest.write_text(text, encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "byte-identical teacher and student tokenizers"):
            MODULE.verify_recipe(self.recipe)

    def test_topk_engine_rejects_cache_file_drift(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        cache_file = manifest.parent / "topk-logits.jsonl"
        cache_file.write_bytes(cache_file.read_bytes() + b"\n")

        with self.assertRaisesRegex(ValueError, "cache file byte count drift"):
            MODULE.verify_recipe(self.recipe)

    def test_topk_engine_rejects_duplicate_topk_token_ids(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        cache_file = manifest.parent / "topk-logits.jsonl"
        row = MODULE.json.loads(cache_file.read_text(encoding="utf-8"))
        row["topk_token_ids"] = [[3, 3]]
        self._rewrite_topk_cache_row(manifest, row)

        with self.assertRaisesRegex(ValueError, "distinct top-k token ids"):
            MODULE.verify_recipe(self.recipe)

    def test_topk_engine_rejects_unsorted_teacher_probabilities(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        cache_file = manifest.parent / "topk-logits.jsonl"
        row = MODULE.json.loads(cache_file.read_text(encoding="utf-8"))
        row["topk_token_ids"] = [[4, 3]]
        row["topk_log_probabilities"] = [
            [MODULE.math.log(0.2), MODULE.math.log(0.6)]
        ]
        self._rewrite_topk_cache_row(manifest, row)

        with self.assertRaisesRegex(ValueError, "probabilities are not descending"):
            MODULE.verify_recipe(self.recipe)

    def test_topk_engine_rejects_wrong_distribution_width(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        cache_file = manifest.parent / "topk-logits.jsonl"
        row = MODULE.json.loads(cache_file.read_text(encoding="utf-8"))
        row["topk_token_ids"] = [[3]]
        row["topk_log_probabilities"] = [[MODULE.math.log(0.8)]]
        self._rewrite_topk_cache_row(manifest, row)

        with self.assertRaisesRegex(ValueError, "exactly top_k token ids"):
            MODULE.verify_recipe(self.recipe)

    def test_topk_engine_rejects_non_finite_json_numbers(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        cache_file = manifest.parent / "topk-logits.jsonl"
        row = MODULE.json.loads(cache_file.read_text(encoding="utf-8"))
        row["topk_log_probabilities"] = [[float("nan"), MODULE.math.log(0.2)]]
        cache_file.write_text(
            MODULE.json.dumps(
                row,
                allow_nan=True,
                separators=(",", ":"),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
            newline="\n",
        )
        self._refresh_topk_cache_manifest(manifest)

        with self.assertRaisesRegex(ValueError, "invalid JSON"):
            MODULE.verify_recipe(self.recipe)

    def test_attach_topk_cache_rejects_tokenization_drift(self) -> None:
        self._upgrade_fixture_to_topk_engine()
        verified = MODULE.verify_recipe(self.recipe)
        tokenized = [
            {
                "record_id": "privacy-one",
                "input_ids": [7, 8, 99],
                "attention_mask": [1, 1, 1],
                "labels": [-100, -100, 9],
            }
        ]

        with self.assertRaisesRegex(RuntimeError, "input token ids drift"):
            MODULE.attach_topk_cache(
                tokenized, verified.records, verified.topk_cache
            )

    def test_tokenize_records_marks_only_preservation_sources(self) -> None:
        class PrefixTokenizer:
            def apply_chat_template(
                self, messages, *, tokenize, add_generation_prompt, enable_thinking
            ):
                if tokenize or enable_thinking:
                    raise AssertionError("unexpected chat-template options")
                return "prompt" if len(messages) == 2 else "full"

            def __call__(self, text, **_kwargs):
                if text == "prompt":
                    return {"input_ids": [1, 2]}
                return {"input_ids": [1, 2, 3], "attention_mask": [1, 1, 1]}

        records = (
            MODULE.TrainingRecord("target", "test", "p", "r", "target-source"),
            MODULE.TrainingRecord(
                "rehearsal", "test", "p", "r", "rehearsal-source"
            ),
        )

        tokenized = MODULE.tokenize_records(
            PrefixTokenizer(),
            records,
            "system",
            max_tokens=32,
            preservation_sources=frozenset({"rehearsal-source"}),
        )

        self.assertEqual([record["preserve"] for record in tokenized], [0, 1])

    def test_tokenize_records_preserves_exact_role_order(self) -> None:
        class RecordingTokenizer:
            def __init__(self):
                self.calls = []

            def apply_chat_template(
                self, messages, *, tokenize, add_generation_prompt, enable_thinking
            ):
                if tokenize or enable_thinking:
                    raise AssertionError("unexpected chat-template options")
                self.calls.append([dict(message) for message in messages])
                return "prompt" if add_generation_prompt else "full"

            def __call__(self, text, **_kwargs):
                if text == "prompt":
                    return {"input_ids": [1, 2, 3, 4]}
                return {
                    "input_ids": [1, 2, 3, 4, 5],
                    "attention_mask": [1, 1, 1, 1, 1],
                }

        tokenizer = RecordingTokenizer()
        record = MODULE.TrainingRecord(
            "role-order",
            "multi-turn-state",
            "Which unit should I use now?",
            "Use inches for the current answer.",
            "reviewed-source",
            (
                MODULE.ChatMessage("user", "The old profile used metric units."),
                MODULE.ChatMessage("assistant", "I recorded metric units."),
            ),
        )

        MODULE.tokenize_records(tokenizer, (record,), "system", max_tokens=32)

        self.assertEqual(
            [message["role"] for message in tokenizer.calls[0]],
            ["system", "user", "assistant", "user"],
        )
        self.assertEqual(
            [message["role"] for message in tokenizer.calls[1]],
            ["system", "user", "assistant", "user", "assistant"],
        )
        self.assertEqual(
            tokenizer.calls[0][-1]["content"], "Which unit should I use now?"
        )

    @unittest.skipUnless(importlib.util.find_spec("torch"), "torch is not installed")
    def test_topk_aggregate_kl_matches_coarse_distribution_reference(self) -> None:
        import torch

        student_logits = torch.log(
            torch.tensor([[0.5, 0.3, 0.2]], dtype=torch.float64)
        )
        topk_ids = torch.tensor([[0, 1]], dtype=torch.long)
        teacher_topk_log_probabilities = torch.log(
            torch.tensor([[0.6, 0.2]], dtype=torch.float64)
        )
        teacher_tail_log_probabilities = torch.log(
            torch.tensor([0.2], dtype=torch.float64)
        )

        loss = MODULE.topk_aggregate_kl(
            torch,
            student_logits,
            topk_ids,
            teacher_topk_log_probabilities,
            teacher_tail_log_probabilities,
        )
        expected = (
            0.6 * MODULE.math.log(0.6 / 0.5)
            + 0.2 * MODULE.math.log(0.2 / 0.3)
            + 0.2 * MODULE.math.log(0.2 / 0.2)
        )

        self.assertAlmostEqual(loss.item(), expected, places=10)

    @unittest.skipUnless(importlib.util.find_spec("torch"), "torch is not installed")
    def test_topk_trainer_applies_only_cached_assistant_positions(self) -> None:
        import torch

        class BaseTrainer:
            def __init__(self, **_kwargs):
                pass

        class FakeModel(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.delta = torch.nn.Parameter(torch.tensor([0.0, 0.4, -0.2]))

            def forward(self, input_ids, attention_mask, labels=None):
                del attention_mask
                logits = self.delta.view(1, 1, 3).repeat(
                    input_ids.shape[0], input_ids.shape[1], 1
                )
                loss = self.delta.square().mean() + 0.25 if labels is not None else None
                return SimpleNamespace(loss=loss, logits=logits)

        trainer = MODULE.TopKDistillationTrainer(
            BaseTrainer,
            torch,
            kl_weight=0.5,
            temperature=1.0,
            trainer_options={},
        ).trainer
        inputs = {
            "input_ids": torch.tensor([[1, 2, 0]], dtype=torch.long),
            "attention_mask": torch.tensor([[1, 1, 1]], dtype=torch.long),
            "labels": torch.tensor([[-100, -100, 0]], dtype=torch.long),
            "teacher_positions": torch.tensor([[1]], dtype=torch.long),
            "teacher_position_mask": torch.tensor([[True]], dtype=torch.bool),
            "teacher_topk_token_ids": torch.tensor([[[0, 1]]], dtype=torch.long),
            "teacher_topk_log_probabilities": torch.log(
                torch.tensor([[[0.6, 0.2]]], dtype=torch.float32)
            ),
            "teacher_tail_log_probabilities": torch.log(
                torch.tensor([[0.2]], dtype=torch.float32)
            ),
        }

        loss = trainer.compute_loss(FakeModel(), inputs)

        self.assertGreater(loss.item(), 0.25)
        self.assertIs(trainer.model_accepts_loss_kwargs, False)
        self.assertEqual(trainer._tinyrustlm_topk_batch_count, 1)
        self.assertAlmostEqual(
            trainer._tinyrustlm_topk_sft_loss_sum,
            0.25 + (0.4**2 + 0.2**2) / 3,
            places=6,
        )
        self.assertGreater(trainer._tinyrustlm_topk_kl_loss_sum, 0.0)

    @unittest.skipUnless(importlib.util.find_spec("torch"), "torch is not installed")
    def test_preservation_loss_anchors_marked_assistant_tokens(self) -> None:
        import torch

        class BaseTrainer:
            def __init__(self, **_kwargs):
                pass

        class FakePeftModel(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.delta = torch.nn.Parameter(torch.tensor([0.0, 1.0]))
                self.adapter_enabled = True

            @contextmanager
            def disable_adapter(self):
                previous = self.adapter_enabled
                self.adapter_enabled = False
                try:
                    yield
                finally:
                    self.adapter_enabled = previous

            def forward(self, input_ids, attention_mask, labels=None):
                del attention_mask
                base = torch.tensor([2.0, 0.0]).view(1, 1, 2)
                logits = base.repeat(input_ids.shape[0], input_ids.shape[1], 1)
                if self.adapter_enabled:
                    logits = logits + self.delta.view(1, 1, 2)
                loss = self.delta.square().mean() + 0.25 if labels is not None else None
                return SimpleNamespace(loss=loss, logits=logits)

        model = FakePeftModel()
        trainer = MODULE.PreservationAwareTrainer(
            BaseTrainer,
            torch,
            kl_weight=0.5,
            kl_temperature=1.0,
            trainer_options={},
        ).trainer
        inputs = {
            "input_ids": torch.tensor([[1, 2, 3]], dtype=torch.long),
            "attention_mask": torch.tensor([[1, 1, 1]], dtype=torch.long),
            "labels": torch.tensor([[-100, -100, 1]], dtype=torch.long),
            "preserve_mask": torch.tensor([True]),
        }

        anchored_loss = trainer.compute_loss(model, inputs)

        self.assertGreater(anchored_loss.item(), 0.75)
        self.assertIs(trainer.model_accepts_loss_kwargs, False)
        anchored_loss.backward()
        self.assertIsNotNone(model.delta.grad)
        self.assertTrue(model.adapter_enabled)
        self.assertTrue(model.training)

    def test_tokenize_records_rejects_non_prefix_chat_template(self) -> None:
        class NonPrefixTokenizer:
            def apply_chat_template(
                self, messages, *, tokenize, add_generation_prompt, enable_thinking
            ):
                self.assert_template_options(
                    tokenize, add_generation_prompt, enable_thinking
                )
                return "prompt" if len(messages) == 2 else "full"

            @staticmethod
            def assert_template_options(tokenize, add_generation_prompt, enable_thinking):
                if tokenize:
                    raise AssertionError("worker must request rendered text")
                if enable_thinking:
                    raise AssertionError("worker must disable visible thinking targets")

            def __call__(self, text, **_kwargs):
                if text == "prompt":
                    return {"input_ids": [1, 2]}
                return {"input_ids": [1, 9, 3], "attention_mask": [1, 1, 1]}

        record = MODULE.TrainingRecord("boundary", "test", "prompt", "response")
        with self.assertRaisesRegex(RuntimeError, "does not preserve the prompt prefix"):
            MODULE.tokenize_records(
                NonPrefixTokenizer(), (record,), "system", max_tokens=32
            )

    def test_training_receipt_carries_export_authority_fields(self) -> None:
        verified = MODULE.verify_recipe(self.recipe)
        verified.output_dir.mkdir()
        (verified.output_dir / "adapter_model.safetensors").write_bytes(b"adapter")
        (verified.output_dir / "adapter_config.json").write_bytes(b'{"peft_type":"LORA"}')

        MODULE.write_training_receipt(verified, {"train_loss": 0.25})

        receipt = MODULE.json.loads(
            (verified.output_dir / "tinyrustlm-training-receipt.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(receipt["dataset_id"], "worker-test")
        self.assertEqual(
            receipt["training_engine"], "transformers-peft-sequence-lora-v1"
        )
        self.assertEqual(receipt["teacher_reasoning_policy"], "final-answer-only")
        self.assertEqual(
            receipt["eval_exclusion_policy"], "rust-frozen-manifest-bound"
        )
        self.assertEqual(
            receipt["system_prompt_sha256"],
            MODULE.require(verified.recipe, "system_prompt_sha256"),
        )

    def test_preservation_receipt_carries_the_exact_anchor_contract(self) -> None:
        self._upgrade_fixture_to_preservation_engine()
        verified = MODULE.verify_recipe(self.recipe)
        verified.output_dir.mkdir()
        (verified.output_dir / "adapter_model.safetensors").write_bytes(b"adapter")
        (verified.output_dir / "adapter_config.json").write_bytes(
            b'{"peft_type":"LORA"}'
        )

        MODULE.write_training_receipt(verified, {"train_loss": 0.5})

        receipt = MODULE.json.loads(
            (verified.output_dir / "tinyrustlm-training-receipt.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(
            receipt["preservation"],
            {
                "source_ids": ["rehearsal-source"],
                "record_count": 1,
                "kl_weight": 0.5,
                "kl_temperature": 1.0,
                "reference": "same-checkpoint-adapters-disabled",
                "mask": "assistant-target-tokens-only",
                "gradient_accumulation_contract": "trainer-normalized-custom-loss-v1",
            },
        )

    def test_topk_receipt_carries_exact_cache_provenance(self) -> None:
        manifest = self._upgrade_fixture_to_topk_engine()
        verified = MODULE.verify_recipe(self.recipe)
        verified.output_dir.mkdir()
        (verified.output_dir / "adapter_model.safetensors").write_bytes(b"adapter")
        (verified.output_dir / "adapter_config.json").write_bytes(
            b'{"peft_type":"LORA"}'
        )

        MODULE.write_training_receipt(verified, {"train_loss": 0.4})

        receipt = MODULE.json.loads(
            (verified.output_dir / "tinyrustlm-training-receipt.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(
            receipt["topk_teacher"]["cache_manifest_sha256"],
            MODULE.sha256_file(manifest),
        )
        self.assertEqual(receipt["topk_teacher"]["top_k"], 2)
        self.assertEqual(receipt["topk_teacher"]["temperature"], 2.0)
        self.assertEqual(receipt["topk_teacher"]["mask"], "assistant-target-tokens-only")

    def _write_fixture(self) -> Path:
        dataset = self.root / "dataset"
        records = dataset / "records"
        base = self.root / "base"
        records.mkdir(parents=True)
        base.mkdir()
        prompt = b"Explain one privacy benefit of local inference."
        response = b"Local inference can keep prompt text on the user's own device."
        prompt_path = records / "privacy.prompt.txt"
        response_path = records / "privacy.response.txt"
        prompt_path.write_bytes(prompt)
        response_path.write_bytes(response)
        source = b"tinyrustlm_distillation_dataset_source_version=1\n"
        (dataset / "distillation-dataset-source.manifest").write_bytes(source)
        weights = b"test model weights"
        tokenizer = b'{"version":"test"}'
        (base / "model.safetensors").write_bytes(weights)
        (base / "tokenizer.json").write_bytes(tokenizer)
        pair_hash = MODULE.sha256_bytes(prompt + b"\0" + response)
        frozen = dataset / "distillation-dataset.manifest"
        frozen.write_text(
            "\n".join(
                [
                    "tinyrustlm_distillation_dataset_version=1",
                    "dataset_status=frozen",
                    "dataset_split=train",
                    "dataset_id=worker-test",
                    "contamination_status=pass",
                    "contamination_exact_match_count=0",
                    "contamination_five_gram_match_count=0",
                    "hidden_reasoning_status=absent",
                    "likely_secret_status=absent",
                    "source_manifest_file=distillation-dataset-source.manifest",
                    f"source_manifest_bytes={len(source)}",
                    f"source_manifest_sha256={MODULE.sha256_bytes(source)}",
                    f"student_weight_sha256={MODULE.sha256_bytes(weights)}",
                    f"student_tokenizer_sha256={MODULE.sha256_bytes(tokenizer)}",
                    "record_count=1",
                    "record.0.id=privacy-one",
                    "record.0.task_family=uaix-memory-grounding",
                    "record.0.prompt_file=records/privacy.prompt.txt",
                    f"record.0.prompt_bytes={len(prompt)}",
                    f"record.0.prompt_sha256={MODULE.sha256_bytes(prompt)}",
                    "record.0.response_file=records/privacy.response.txt",
                    f"record.0.response_bytes={len(response)}",
                    f"record.0.response_sha256={MODULE.sha256_bytes(response)}",
                    f"record.0.training_pair_sha256={pair_hash}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        system_prompt = self.root / "system-prompt.txt"
        system_prompt.write_text(
            "You are TinyRustLM. Answer accurately and concisely.\n", encoding="utf-8"
        )
        output = self.root / "output"
        recipe = self.root / "recipe.manifest"
        recipe.write_text(
            "\n".join(
                [
                    "tinyrustlm_distillation_recipe_version=1",
                    "recipe_id=worker-test",
                    "training_engine=transformers-peft-sequence-lora-v1",
                    f"dataset_dir={dataset}",
                    f"frozen_dataset_manifest={frozen}",
                    f"base_model_dir={base}",
                    f"output_dir={output}",
                    f"system_prompt_file={system_prompt}",
                    f"system_prompt_sha256={MODULE.sha256_file(system_prompt)}",
                    "device=cpu",
                    "dtype=float32",
                    "seed=20260711",
                    "epochs=1",
                    "learning_rate=0.0002",
                    "weight_decay=0.01",
                    "warmup_ratio=0.03",
                    "max_sequence_tokens=256",
                    "micro_batch_size=1",
                    "gradient_accumulation_steps=1",
                    "lora_rank=8",
                    "lora_alpha=16",
                    "lora_dropout=0.05",
                    "target_modules=q_proj,k_proj,v_proj,o_proj",
                    "logging_steps=1",
                    "save_steps=10",
                    "gradient_checkpointing=true",
                    "teacher_reasoning_policy=final-answer-only",
                    "eval_exclusion_policy=rust-frozen-manifest-bound",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        return recipe

    def _upgrade_fixture_to_structured_history(self) -> Path:
        dataset = self.root / "dataset"
        records = dataset / "records"
        history_path = records / "privacy.history.json"
        history = {
            "schema": "tinyrustlm.role_history.v1",
            "messages": [
                {
                    "role": "user",
                    "content": "The first note says the project uses metric units.",
                },
                {
                    "role": "assistant",
                    "content": "I recorded metric units for the project.",
                },
            ],
        }
        history_payload = (
            json.dumps(history, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            + "\n"
        ).encode("utf-8")
        history_path.write_bytes(history_payload)

        source_path = dataset / "distillation-dataset-source.manifest"
        source_payload = source_path.read_bytes().replace(
            b"tinyrustlm_distillation_dataset_source_version=1",
            b"tinyrustlm_distillation_dataset_source_version=2",
        )
        source_path.write_bytes(source_payload)

        frozen_path = dataset / "distillation-dataset.manifest"
        frozen = frozen_path.read_text(encoding="utf-8")
        prompt = (records / "privacy.prompt.txt").read_bytes()
        response = (records / "privacy.response.txt").read_bytes()
        pair_hash = MODULE.sha256_bytes(
            history_payload + b"\0" + prompt + b"\0" + response
        )
        source_bytes_line = next(
            line for line in frozen.splitlines() if line.startswith("source_manifest_bytes=")
        )
        source_hash_line = next(
            line for line in frozen.splitlines() if line.startswith("source_manifest_sha256=")
        )
        pair_hash_line = next(
            line
            for line in frozen.splitlines()
            if line.startswith("record.0.training_pair_sha256=")
        )
        frozen = frozen.replace(
            "tinyrustlm_distillation_dataset_version=1",
            "tinyrustlm_distillation_dataset_version=2",
        ).replace(
            "record.0.task_family=uaix-memory-grounding\n",
            "record.0.task_family=uaix-memory-grounding\n"
            "record.0.history_file=records/privacy.history.json\n"
            "record.0.history_message_count=2\n"
            f"record.0.history_bytes={len(history_payload)}\n"
            f"record.0.history_sha256={MODULE.sha256_bytes(history_payload)}\n",
        ).replace(
            source_bytes_line, f"source_manifest_bytes={len(source_payload)}"
        ).replace(
            source_hash_line,
            f"source_manifest_sha256={MODULE.sha256_bytes(source_payload)}",
        ).replace(
            pair_hash_line,
            f"record.0.training_pair_sha256={pair_hash}",
        )
        frozen_path.write_text(frozen, encoding="utf-8")
        return history_path

    def _upgrade_fixture_to_preservation_engine(self) -> None:
        dataset = self.root / "dataset"
        records = dataset / "records"
        prompt = b"Give a concise greeting."
        response = b"Hello. How can I help?"
        prompt_path = records / "rehearsal.prompt.txt"
        response_path = records / "rehearsal.response.txt"
        prompt_path.write_bytes(prompt)
        response_path.write_bytes(response)

        frozen_path = dataset / "distillation-dataset.manifest"
        frozen = frozen_path.read_text(encoding="utf-8")
        frozen = frozen.replace("record_count=1", "record_count=2")
        frozen = frozen.replace(
            "record.0.task_family=uaix-memory-grounding",
            "record.0.task_family=uaix-memory-grounding\nrecord.0.source_id=target-source",
        )
        pair_hash = MODULE.sha256_bytes(prompt + b"\0" + response)
        frozen += "\n".join(
            [
                "record.1.id=rehearsal-one",
                "record.1.task_family=greeting-capability",
                "record.1.source_id=rehearsal-source",
                "record.1.prompt_file=records/rehearsal.prompt.txt",
                f"record.1.prompt_bytes={len(prompt)}",
                f"record.1.prompt_sha256={MODULE.sha256_bytes(prompt)}",
                "record.1.response_file=records/rehearsal.response.txt",
                f"record.1.response_bytes={len(response)}",
                f"record.1.response_sha256={MODULE.sha256_bytes(response)}",
                f"record.1.training_pair_sha256={pair_hash}",
                "",
            ]
        )
        frozen_path.write_text(frozen, encoding="utf-8")

        recipe = self.recipe.read_text(encoding="utf-8").replace(
            "training_engine=transformers-peft-sequence-lora-v1",
            "training_engine=transformers-peft-preservation-kl-lora-v2",
        )
        recipe += "\n".join(
            [
                "preservation_source_ids=rehearsal-source",
                "preservation_kl_weight=0.5",
                "preservation_kl_temperature=1.0",
                "",
            ]
        )
        self.recipe.write_text(recipe, encoding="utf-8")

    def _upgrade_fixture_to_topk_engine(self) -> Path:
        cache_dir = self.root / "topk-cache"
        cache_dir.mkdir()
        frozen = self.root / "dataset" / "distillation-dataset.manifest"
        tokenizer = self.root / "base" / "tokenizer.json"
        row = {
            "schema": "tinyrustlm.topk_logit_cache_record.v1",
            "record_id": "privacy-one",
            "input_ids": [7, 8, 9],
            "input_ids_sha256": MODULE.token_sequence_sha256([7, 8, 9]),
            "assistant_logit_positions": [1],
            "topk_token_ids": [[3, 4]],
            "topk_log_probabilities": [[MODULE.math.log(0.6), MODULE.math.log(0.2)]],
            "tail_log_probabilities": [MODULE.math.log(0.2)],
        }
        row["record_sha256"] = MODULE.topk_cache_record_sha256(row)
        cache_file = cache_dir / "topk-logits.jsonl"
        cache_file.write_text(
            MODULE.canonical_json(row) + "\n", encoding="utf-8", newline="\n"
        )
        identity = {
            "schema": "tinyrustlm.teacher_model_identity.v1",
            "model_id": "fixture-teacher",
            "revision": "fixture-revision-v1",
            "model_identity_sha256": "sha256:" + "1" * 64,
            "tokenizer_sha256": MODULE.sha256_file(tokenizer),
            "artifacts": [
                {
                    "relative_path": "model.safetensors",
                    "bytes": 15,
                    "sha256": "sha256:" + "2" * 64,
                }
            ],
        }
        identity["model_identity_sha256"] = MODULE.model_artifact_set_sha256(
            identity["artifacts"]
        )
        identity_file = cache_dir / "teacher-identity.json"
        identity_file.write_text(
            MODULE.json.dumps(identity, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        manifest = cache_dir / "topk-logit-cache.manifest"
        manifest.write_text(
            "\n".join(
                [
                    "tinyrustlm_topk_logit_cache_version=1",
                    "cache_status=complete",
                    "cache_id=worker-test-cache",
                    "dataset_id=worker-test",
                    f"frozen_dataset_manifest_sha256={MODULE.sha256_file(frozen)}",
                    f"system_prompt_sha256={MODULE.sha256_file(self.root / 'system-prompt.txt')}",
                    f"student_tokenizer_sha256={MODULE.sha256_file(tokenizer)}",
                    f"teacher_tokenizer_sha256={MODULE.sha256_file(tokenizer)}",
                    "tokenizer_alignment=same-tokenizer-token-and-sequence",
                    "teacher_model_id=fixture-teacher",
                    "teacher_revision=fixture-revision-v1",
                    f"teacher_model_identity_sha256={identity['model_identity_sha256']}",
                    "teacher_identity_file=teacher-identity.json",
                    f"teacher_identity_file_bytes={identity_file.stat().st_size}",
                    f"teacher_identity_file_sha256={MODULE.sha256_file(identity_file)}",
                    "probability_contract=teacher-topk-plus-aggregate-tail-v1",
                    "mask=assistant-target-tokens-only",
                    "numeric_format=float32-normalized-log-probabilities",
                    "max_sequence_tokens=256",
                    "vocab_size=16",
                    "top_k=2",
                    "temperature=2.0",
                    "record_count=1",
                    "target_position_count=1",
                    "cache_file=topk-logits.jsonl",
                    f"cache_file_bytes={cache_file.stat().st_size}",
                    f"cache_file_sha256={MODULE.sha256_file(cache_file)}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        recipe = self.recipe.read_text(encoding="utf-8").replace(
            "training_engine=transformers-peft-sequence-lora-v1",
            "training_engine=transformers-peft-topk-kd-lora-v1",
        )
        recipe += "\n".join(
            [
                f"teacher_logit_cache_manifest={manifest}",
                "teacher_kl_weight=0.5",
                "",
            ]
        )
        self.recipe.write_text(recipe, encoding="utf-8")
        return manifest

    def _rewrite_topk_cache_row(self, manifest: Path, row: dict) -> None:
        row.pop("record_sha256", None)
        row["record_sha256"] = MODULE.topk_cache_record_sha256(row)
        cache_file = manifest.parent / "topk-logits.jsonl"
        cache_file.write_text(
            MODULE.canonical_json(row) + "\n", encoding="utf-8", newline="\n"
        )
        self._refresh_topk_cache_manifest(manifest)

    def _refresh_topk_cache_manifest(self, manifest: Path) -> None:
        cache_file = manifest.parent / "topk-logits.jsonl"
        fields = MODULE.parse_manifest(
            manifest.read_text(encoding="utf-8"), "test cache manifest"
        )
        fields["cache_file_bytes"] = str(cache_file.stat().st_size)
        fields["cache_file_sha256"] = MODULE.sha256_file(cache_file)
        manifest.write_text(
            "".join(f"{key}={value}\n" for key, value in fields.items()),
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
