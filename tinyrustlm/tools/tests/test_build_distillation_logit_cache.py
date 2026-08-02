"""Contract tests for deterministic same-tokenizer teacher-logit caching."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "build-distillation-logit-cache.py"
SPEC = importlib.util.spec_from_file_location(
    "tinyrustlm_build_distillation_logit_cache", SCRIPT
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DistillationLogitCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-logit-cache-")
        self.root = Path(self._temporary.name)
        self.recipe, self.student = self._write_sequence_fixture()
        self.teacher = self.root / "teacher"
        self.teacher.mkdir()
        (self.teacher / "config.json").write_text(
            '{"model_type":"fixture","vocab_size":16}\n', encoding="utf-8"
        )
        (self.teacher / "model.safetensors").write_bytes(b"teacher weights")
        (self.teacher / "tokenizer.json").write_bytes(
            (self.student / "tokenizer.json").read_bytes()
        )
        self.control = self._write_control()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_verify_control_binds_teacher_recipe_and_identical_tokenizer(self) -> None:
        plan = MODULE.verify_control(self.control)

        self.assertEqual(plan.cache_id, "fixture-topk-cache")
        self.assertEqual(plan.top_k, 2)
        self.assertEqual(plan.temperature, 2.0)
        self.assertEqual(len(plan.teacher_identity.artifacts), 3)
        self.assertEqual(
            plan.teacher_identity.tokenizer_sha256,
            MODULE.TRAINER.sha256_file(self.student / "tokenizer.json"),
        )

    def test_verify_control_rejects_cross_tokenizer_teacher(self) -> None:
        (self.teacher / "tokenizer.json").write_bytes(b'{"different":true}')
        self.control = self._write_control()

        with self.assertRaisesRegex(ValueError, "byte-identical teacher and student tokenizers"):
            MODULE.verify_control(self.control)

    def test_verify_control_rejects_teacher_weight_drift(self) -> None:
        (self.teacher / "model.safetensors").write_bytes(b"drifted weights")

        with self.assertRaisesRegex(ValueError, "teacher model identity SHA-256 drift"):
            MODULE.verify_control(self.control)

    def test_verify_control_remains_reproducible_after_sequence_training(self) -> None:
        output = self.root / "unused-training-output"
        output.mkdir()
        (output / "adapter_model.safetensors").write_bytes(b"completed baseline")

        plan = MODULE.verify_control(self.control)

        self.assertEqual(plan.sequence_inputs.output_dir, output)

    def test_teacher_identity_is_stable_and_filename_sorted(self) -> None:
        (self.teacher / "model-00002-of-00002.safetensors").write_bytes(b"second")
        (self.teacher / "model-00001-of-00002.safetensors").write_bytes(b"first")

        first = MODULE.inspect_teacher_identity(self.teacher)
        second = MODULE.inspect_teacher_identity(self.teacher)

        self.assertEqual(first, second)
        self.assertEqual(
            [artifact.relative_path for artifact in first.artifacts],
            sorted(artifact.relative_path for artifact in first.artifacts),
        )

    @unittest.skipUnless(importlib.util.find_spec("torch"), "torch is not installed")
    def test_extract_distribution_uses_token_id_as_the_tie_breaker(self) -> None:
        import torch

        token_ids, log_probabilities, tail = MODULE.extract_topk_distribution(
            torch,
            torch.tensor([0.0, 2.0, 2.0, 1.0], dtype=torch.float32),
            top_k=2,
            temperature=1.0,
        )

        self.assertEqual(token_ids, [1, 2])
        mass = sum(MODULE.math.exp(value) for value in log_probabilities)
        mass += MODULE.math.exp(tail)
        self.assertAlmostEqual(mass, 1.0, places=6)

    def test_write_bundle_is_canonical_and_refuses_overwrite(self) -> None:
        plan = MODULE.verify_control(self.control)
        row = {
            "schema": "tinyrustlm.topk_logit_cache_record.v1",
            "record_id": "fixture-one",
            "input_ids": [7, 8, 9],
            "input_ids_sha256": MODULE.TRAINER.token_sequence_sha256([7, 8, 9]),
            "assistant_logit_positions": [1],
            "topk_token_ids": [[3, 4]],
            "topk_log_probabilities": [
                [MODULE.math.log(0.6), MODULE.math.log(0.2)]
            ],
            "tail_log_probabilities": [MODULE.math.log(0.2)],
        }
        row["record_sha256"] = MODULE.TRAINER.topk_cache_record_sha256(row)

        manifest = MODULE.write_cache_bundle(plan, [row], framework_versions={
            "torch": "fixture",
            "transformers": "fixture",
        })

        cache_line = (manifest.parent / "topk-logits.jsonl").read_bytes()
        self.assertEqual(cache_line, (MODULE.TRAINER.canonical_json(row) + "\n").encode("ascii"))
        repeated_plan = MODULE.verify_control(self.control)
        self.assertEqual(repeated_plan.output_dir, plan.output_dir)
        verified_cache = MODULE.verify_existing_cache(repeated_plan)
        self.assertEqual(verified_cache.target_position_count, 1)
        with self.assertRaisesRegex(ValueError, "output_dir must not already exist"):
            MODULE.write_cache_bundle(repeated_plan, [row], framework_versions={
                "torch": "fixture",
                "transformers": "fixture",
            })

    def _write_control(self) -> Path:
        identity = MODULE.inspect_teacher_identity(self.teacher)
        control = {
            "schema": "tinyrustlm.topk_logit_cache_control.v1",
            "cache_id": "fixture-topk-cache",
            "sequence_recipe": str(self.recipe),
            "teacher": {
                "model_id": "fixture-teacher",
                "revision": "fixture-revision-v1",
                "model_dir": str(self.teacher),
                "model_identity_sha256": identity.model_identity_sha256,
                "tokenizer_sha256": identity.tokenizer_sha256,
            },
            "output_dir": str(self.root / "cache-output"),
            "top_k": 2,
            "temperature": 2.0,
            "device": "cpu",
            "dtype": "float32",
        }
        path = self.root / "cache-control.json"
        path.write_text(json.dumps(control, indent=2) + "\n", encoding="utf-8")
        return path

    def _write_sequence_fixture(self) -> tuple[Path, Path]:
        dataset = self.root / "dataset"
        records = dataset / "records"
        student = self.root / "student"
        records.mkdir(parents=True)
        student.mkdir()
        prompt = b"Say hello."
        response = b"Hello."
        (records / "fixture.prompt.txt").write_bytes(prompt)
        (records / "fixture.response.txt").write_bytes(response)
        source = b"tinyrustlm_distillation_dataset_source_version=1\n"
        (dataset / "distillation-dataset-source.manifest").write_bytes(source)
        weights = b"student weights"
        tokenizer = b'{"version":"shared"}'
        (student / "model.safetensors").write_bytes(weights)
        (student / "tokenizer.json").write_bytes(tokenizer)
        frozen = dataset / "distillation-dataset.manifest"
        frozen.write_text(
            "\n".join(
                [
                    "tinyrustlm_distillation_dataset_version=1",
                    "dataset_status=frozen",
                    "dataset_split=train",
                    "dataset_id=fixture-dataset",
                    "contamination_status=pass",
                    "contamination_exact_match_count=0",
                    "contamination_five_gram_match_count=0",
                    "hidden_reasoning_status=absent",
                    "likely_secret_status=absent",
                    "source_manifest_file=distillation-dataset-source.manifest",
                    f"source_manifest_bytes={len(source)}",
                    f"source_manifest_sha256={MODULE.TRAINER.sha256_bytes(source)}",
                    f"student_weight_sha256={MODULE.TRAINER.sha256_bytes(weights)}",
                    f"student_tokenizer_sha256={MODULE.TRAINER.sha256_bytes(tokenizer)}",
                    "record_count=1",
                    "record.0.id=fixture-one",
                    "record.0.task_family=greeting-capability",
                    "record.0.prompt_file=records/fixture.prompt.txt",
                    f"record.0.prompt_bytes={len(prompt)}",
                    f"record.0.prompt_sha256={MODULE.TRAINER.sha256_bytes(prompt)}",
                    "record.0.response_file=records/fixture.response.txt",
                    f"record.0.response_bytes={len(response)}",
                    f"record.0.response_sha256={MODULE.TRAINER.sha256_bytes(response)}",
                    f"record.0.training_pair_sha256={MODULE.TRAINER.sha256_bytes(prompt + bytes([0]) + response)}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        system_prompt = self.root / "system.txt"
        system_prompt.write_text("You are TinyRustLM.\n", encoding="utf-8")
        recipe = self.root / "sequence-recipe.manifest"
        recipe.write_text(
            "\n".join(
                [
                    "tinyrustlm_distillation_recipe_version=1",
                    "recipe_id=fixture-sequence",
                    "training_engine=transformers-peft-sequence-lora-v1",
                    f"dataset_dir={dataset}",
                    f"frozen_dataset_manifest={frozen}",
                    f"base_model_dir={student}",
                    f"output_dir={self.root / 'unused-training-output'}",
                    f"system_prompt_file={system_prompt}",
                    f"system_prompt_sha256={MODULE.TRAINER.sha256_file(system_prompt)}",
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
        return recipe, student


if __name__ == "__main__":
    unittest.main()
