"""Contract tests for the PEFT-to-TinyRustLM adapter-source exporter."""

from __future__ import annotations

import importlib.util
import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "export-peft-adapter-source.py"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("tinyrustlm_export_peft_adapter", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class PeftAdapterSourceExporterTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-peft-export-")
        self.root = Path(self._temporary.name)
        self.base = self.root / "base"
        self.adapter = self.root / "adapter"
        self.output = self.root / "exported"
        self.base.mkdir()
        self.adapter.mkdir()
        self._write_base()
        self._write_adapter()
        self.receipt = self._write_receipt()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_exports_complete_scaled_lora_as_bounded_v2_source(self) -> None:
        plan = self._plan()

        self.assertEqual(len(plan.targets), 30)
        first = plan.targets[0]
        self.assertEqual(first.name, "layers.0.wq.weight")
        self.assertEqual((first.rows, first.cols, first.rank), (576, 576, 1))
        self.assertEqual(struct.unpack_from("<f", first.a_bytes, 0)[0], 1.5)
        self.assertEqual(struct.unpack_from("<f", first.b_bytes, 0)[0], 0.25)

        MODULE.write_export(
            plan,
            self.output,
            "smollm2-135m-quality-lora-v1",
            "Apache-2.0-compatible-training-output",
            "Sequence LoRA trained from the frozen TinyRustLM quality dataset",
        )
        manifest = (self.output / "adapter-source.manifest").read_text(encoding="utf-8")
        self.assertIn("tinyrustlm_trained_adapter_source_version=2\n", manifest)
        self.assertIn("base_tokenizer=inherit-from-base-parent\n", manifest)
        self.assertIn("target_tensor_count=30\n", manifest)
        self.assertIn("target.0.a_shape=576,1\n", manifest)
        self.assertIn("target.0.b_shape=1,576\n", manifest)
        self.assertIn("target.0.delta_l1_upper_bound_microunits=", manifest)
        self.assertNotIn("target.0.delta_l1_microunits=", manifest)

    def test_rejects_adapter_bytes_that_drift_from_training_receipt(self) -> None:
        path = self.adapter / "adapter_model.safetensors"
        path.write_bytes(path.read_bytes() + b"drift")

        with self.assertRaisesRegex(ValueError, "adapter_model_sha256"):
            self._plan()

    def test_rejects_incomplete_layer_coverage(self) -> None:
        self._write_adapter(layer_count=29)
        self._write_receipt()

        with self.assertRaisesRegex(ValueError, "coverage mismatch"):
            self._plan()

    def test_rejects_runtime_incompatible_rank(self) -> None:
        config_path = self.adapter / "adapter_config.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        config["r"] = 9
        config_path.write_text(json.dumps(config), encoding="utf-8")
        self._write_receipt()

        with self.assertRaisesRegex(ValueError, "rank must be in"):
            self._plan()

    def test_decodes_bfloat16_without_external_tensor_packages(self) -> None:
        one = MODULE.TensorPayload("one", "BF16", (1,), struct.pack("<H", 0x3F80))
        minus_two = MODULE.TensorPayload(
            "minus-two", "BF16", (1,), struct.pack("<H", 0xC000)
        )

        self.assertEqual(MODULE.decode_floats(one), [1.0])
        self.assertEqual(MODULE.decode_floats(minus_two), [-2.0])

    def test_rejects_existing_export_directory(self) -> None:
        self.output.mkdir()

        with self.assertRaisesRegex(ValueError, "must not already exist"):
            MODULE.write_export(
                self._plan(),
                self.output,
                "smollm2-135m-quality-lora-v1",
                "Apache-2.0-compatible-training-output",
                "Sequence LoRA trained from the frozen TinyRustLM quality dataset",
            )

    def test_python_export_passes_real_rust_source_validator(self) -> None:
        MODULE.write_export(
            self._plan(),
            self.output,
            "smollm2-135m-quality-lora-v1",
            "Apache-2.0-compatible-training-output",
            "Sequence LoRA trained from the frozen TinyRustLM quality dataset",
        )

        result = subprocess.run(
            [
                "cargo",
                "run",
                "--quiet",
                "-p",
                "tinyrustlm-slm-pack",
                "--",
                "validate-adapter-source",
                str(self.output),
            ],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        self.assertEqual(
            result.returncode,
            0,
            msg=f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}",
        )
        self.assertIn("validation: PASS", result.stdout)

    def _plan(self):
        return MODULE.build_export_plan(
            self.adapter,
            self.base,
            self.receipt,
            "smollm2-135m-instruct-bpe",
        )

    def _write_base(self) -> None:
        config = {
            "model_type": "llama",
            "vocab_size": 49152,
            "hidden_size": 576,
            "num_hidden_layers": 30,
            "num_attention_heads": 9,
            "num_key_value_heads": 3,
            "intermediate_size": 1536,
            "max_position_embeddings": 8192,
            "rope_theta": 100000.0,
            "rms_norm_eps": 1e-5,
            "tie_word_embeddings": True,
        }
        (self.base / "config.json").write_text(json.dumps(config), encoding="utf-8")
        (self.base / "model.safetensors").write_bytes(b"fixture base model")
        (self.base / "tokenizer.json").write_bytes(b'{"fixture":"tokenizer"}')

    def _write_adapter(self, layer_count: int = 30) -> None:
        config = {
            "peft_type": "LORA",
            "task_type": "CAUSAL_LM",
            "r": 1,
            "lora_alpha": 3,
            "bias": "none",
            "fan_in_fan_out": False,
            "use_dora": False,
            "use_rslora": False,
            "rank_pattern": {},
            "alpha_pattern": {},
            "modules_to_save": None,
            "layers_to_transform": None,
            "target_modules": ["q_proj"],
        }
        (self.adapter / "adapter_config.json").write_text(
            json.dumps(config), encoding="utf-8"
        )
        tensors = []
        for layer in range(layer_count):
            prefix = f"base_model.model.model.layers.{layer}.self_attn.q_proj"
            tensors.append((f"{prefix}.lora_A.weight", (1, 576), 0.25))
            tensors.append((f"{prefix}.lora_B.weight", (576, 1), 0.5))
        write_f32_safetensors(self.adapter / "adapter_model.safetensors", tensors)

    def _write_receipt(self) -> Path:
        receipt = {
            "schema": "tinyrustlm.distillation_training_receipt.v1",
            "training_engine": "transformers-peft-sequence-lora-v1",
            "teacher_reasoning_policy": "final-answer-only",
            "eval_exclusion_policy": "rust-frozen-manifest-bound",
            "dataset_id": "quality-dataset-v1",
            "system_prompt_sha256": MODULE.sha256_bytes(b"system prompt"),
            "base_model_sha256": MODULE.sha256_file(self.base / "model.safetensors"),
            "base_tokenizer_sha256": MODULE.sha256_file(self.base / "tokenizer.json"),
            "adapter_model_sha256": MODULE.sha256_file(
                self.adapter / "adapter_model.safetensors"
            ),
            "adapter_config_sha256": MODULE.sha256_file(
                self.adapter / "adapter_config.json"
            ),
        }
        path = self.adapter / "tinyrustlm-training-receipt.json"
        path.write_text(json.dumps(receipt, sort_keys=True), encoding="utf-8")
        return path


def write_f32_safetensors(
    path: Path, tensors: list[tuple[str, tuple[int, int], float]]
) -> None:
    header = {}
    data = bytearray()
    for name, shape, value in tensors:
        start = len(data)
        for index in range(shape[0] * shape[1]):
            data.extend(struct.pack("<f", value + (index % 7) * 0.000001))
        header[name] = {
            "dtype": "F32",
            "shape": list(shape),
            "data_offsets": [start, len(data)],
        }
    header_bytes = json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    path.write_bytes(struct.pack("<Q", len(header_bytes)) + header_bytes + data)


if __name__ == "__main__":
    unittest.main()
