"""Contract tests for source-bound full-logit golden generation."""

from __future__ import annotations

import importlib.util
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path


TOOLS = Path(__file__).resolve().parents[1]
SCRIPT = TOOLS / "build-source-logit-golden.py"


def load_script(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeRunner:
    metadata = {
        "framework": "fake-source-forward",
        "torch_version": "test",
        "transformers_version": "test",
        "dtype": "float32",
        "device": "cpu",
    }

    def __init__(self, cases: dict[str, tuple[list[int], list[float]]]) -> None:
        self._cases = cases

    def compute(self, rendered_prompt: str) -> tuple[list[int], list[float]]:
        return self._cases[rendered_prompt]


class SourceLogitGoldenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_script("tinyrustlm_source_logit_golden_tests", SCRIPT)

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(
            prefix="tinyrustlm-source-logit-golden-"
        )
        self.root = Path(self._temporary.name)
        self.checkpoint = self.root / "checkpoint"
        self.checkpoint.mkdir()
        self._write_checkpoint()
        self.eval_path = self.root / "eval-cases.txt"
        self.eval_path.write_text(
            "tinyrustlm_eval_cases_version=1\ncase_count=2\n",
            encoding="utf-8",
        )
        self.logits = {
            "<chat>first</chat>": ([1, 2], [0.1, 4.0, 3.0, 2.0, 1.0, -1.0]),
            "<chat>second</chat>": ([3, 4, 5], [2.5, 1.5, 4.5, 0.5, -1.0, 3.5]),
        }
        self.baseline = self.root / "source-baseline.json"
        self._write_baseline()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_builds_deterministic_atomic_golden_from_exact_rendered_prompts(self) -> None:
        first = self.root / "golden-one"
        second = self.root / "golden-two"

        report = self.module.build_source_logit_golden(
            self.baseline,
            self.checkpoint,
            first,
            runner_factory=lambda _checkpoint: FakeRunner(self.logits),
        )
        self.module.build_source_logit_golden(
            self.baseline,
            self.checkpoint,
            second,
            runner_factory=lambda _checkpoint: FakeRunner(self.logits),
        )

        self.assertEqual(report["schema"], "tinyrustlm.reference_logit_golden.v1")
        self.assertEqual(report["case_count"], 2)
        self.assertEqual(
            report["tokenizer_load_options"]["fix_mistral_regex"], True
        )
        self.assertEqual(report["torch_compile_mode"], "disabled-eager")
        self.assertEqual(report["system_prompt_mode"], "included")
        self.assertFalse(report["model_load_options"]["trust_remote_code"])
        self.assertFalse(report["training_authority"])
        self.assertEqual(
            (first / "case-0.rendered-prompt.txt").read_text(encoding="utf-8"),
            "<chat>first</chat>",
        )
        observed = struct.unpack(
            "<6f", (first / "case-0.logits.f32le").read_bytes()
        )
        self.assertAlmostEqual(observed[1], 4.0)
        self.assertEqual(
            (first / "reference-golden.json").read_bytes(),
            (second / "reference-golden.json").read_bytes(),
        )
        self.assertEqual(
            sorted(path.name for path in first.iterdir()),
            sorted(path.name for path in second.iterdir()),
        )
        self.assertFalse(list(self.root.glob(".golden-*.tmp-*")))

    def test_rejects_checkpoint_drift_before_loading_the_model(self) -> None:
        (self.checkpoint / "config.json").write_text("drift", encoding="utf-8")
        runner_loaded = False

        def runner_factory(_checkpoint: Path):
            nonlocal runner_loaded
            runner_loaded = True
            return FakeRunner(self.logits)

        with self.assertRaisesRegex(ValueError, "byte length drift|SHA-256 drift"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "drift-output",
                runner_factory=runner_factory,
            )
        self.assertFalse(runner_loaded)

    def test_revalidates_publisher_generation_authority(self) -> None:
        authority = self.checkpoint / "README.md"
        authority.write_text("Stop on token IDs 2 and 32000.\n", encoding="utf-8")
        baseline = json.loads(self.baseline.read_text(encoding="utf-8"))
        baseline["publisher_generation_override"] = {
            "authority_file": "README.md",
            "authority_file_bytes": authority.stat().st_size,
            "authority_file_sha256": self.module.sha256_file(authority),
            "eos_token_id": [2, 32000],
        }
        self.baseline.write_text(
            json.dumps(baseline, indent=2) + "\n",
            encoding="utf-8",
        )

        self.module.build_source_logit_golden(
            self.baseline,
            self.checkpoint,
            self.root / "authority-output",
            runner_factory=lambda _checkpoint: FakeRunner(self.logits),
        )
        authority.write_text("Stop on token ID 2.\n", encoding="utf-8")

        with self.assertRaisesRegex(
            ValueError,
            "publisher generation authority byte length changed|SHA-256 changed",
        ):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "authority-drift-output",
                runner_factory=lambda _checkpoint: FakeRunner(self.logits),
            )
        self.assertFalse((self.root / "drift-output").exists())

    def test_rejects_prompt_token_or_prior_top5_drift_without_output(self) -> None:
        bad_tokens = dict(self.logits)
        bad_tokens["<chat>first</chat>"] = ([9, 2], self.logits["<chat>first</chat>"][1])
        with self.assertRaisesRegex(ValueError, "prompt token IDs drift"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "token-drift-output",
                runner_factory=lambda _checkpoint: FakeRunner(bad_tokens),
            )
        self.assertFalse((self.root / "token-drift-output").exists())

        bad_top = dict(self.logits)
        bad_top["<chat>first</chat>"] = ([1, 2], [9.0, 4.0, 3.0, 2.0, 1.0, -1.0])
        with self.assertRaisesRegex(ValueError, "top-five token IDs drift"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "top-drift-output",
                runner_factory=lambda _checkpoint: FakeRunner(bad_top),
            )
        self.assertFalse((self.root / "top-drift-output").exists())

    def test_runner_failure_leaves_no_partial_output(self) -> None:
        class FailingRunner(FakeRunner):
            def compute(self, rendered_prompt: str):
                if rendered_prompt == "<chat>second</chat>":
                    raise RuntimeError("injected source failure")
                return super().compute(rendered_prompt)

        with self.assertRaisesRegex(RuntimeError, "injected source failure"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "failed-output",
                runner_factory=lambda _checkpoint: FailingRunner(self.logits),
            )
        self.assertFalse((self.root / "failed-output").exists())
        self.assertFalse(list(self.root.glob(".failed-output.tmp-*")))

    def test_rejects_adapter_baseline_and_existing_output(self) -> None:
        value = json.loads(self.baseline.read_text(encoding="utf-8"))
        value["adapter"] = {"path": "not-source-only"}
        self.baseline.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValueError, "must not be built from an adapter"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "adapter-output",
                runner_factory=lambda _checkpoint: FakeRunner(self.logits),
            )

        existing = self.root / "existing"
        existing.mkdir()
        with self.assertRaisesRegex(ValueError, "must not already exist"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                existing,
                runner_factory=lambda _checkpoint: FakeRunner(self.logits),
            )

    def test_rejects_remote_code_loader_drift_before_loading_the_model(self) -> None:
        value = json.loads(self.baseline.read_text(encoding="utf-8"))
        value["model_load_options"]["trust_remote_code"] = True
        self.baseline.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        runner_loaded = False

        def runner_factory(_checkpoint: Path):
            nonlocal runner_loaded
            runner_loaded = True
            return FakeRunner(self.logits)

        with self.assertRaisesRegex(ValueError, "model load options changed"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "remote-code-output",
                runner_factory=runner_factory,
            )
        self.assertFalse(runner_loaded)

    def test_accepts_optional_generation_config_and_whitespace_token_text(self) -> None:
        value = json.loads(self.baseline.read_text(encoding="utf-8"))
        del value["checkpoint_artifacts"]["generation_config.json"]
        value["cases"][0]["first_step_top5"][0]["token_text"] = " "
        self.baseline.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        (self.checkpoint / "generation_config.json").unlink()

        report = self.module.build_source_logit_golden(
            self.baseline,
            self.checkpoint,
            self.root / "optional-generation-config-output",
            runner_factory=lambda _checkpoint: FakeRunner(self.logits),
        )

        self.assertEqual(report["case_count"], 2)

    def test_binds_omitted_publisher_template_system_role(self) -> None:
        value = json.loads(self.baseline.read_text(encoding="utf-8"))
        value["system_prompt_mode"] = "omitted-publisher-template"
        value["system_prompt"] = ""
        self.baseline.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

        report = self.module.build_source_logit_golden(
            self.baseline,
            self.checkpoint,
            self.root / "omitted-system-output",
            runner_factory=lambda _checkpoint: FakeRunner(self.logits),
        )

        self.assertEqual(report["system_prompt_mode"], "omitted-publisher-template")
        self.assertEqual(report["system_prompt"], "")

    def test_rejects_nonempty_omitted_system_prompt(self) -> None:
        value = json.loads(self.baseline.read_text(encoding="utf-8"))
        value["system_prompt_mode"] = "omitted-publisher-template"
        self.baseline.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

        with self.assertRaisesRegex(ValueError, "must be empty"):
            self.module.build_source_logit_golden(
                self.baseline,
                self.checkpoint,
                self.root / "invalid-omitted-system-output",
                runner_factory=lambda _checkpoint: FakeRunner(self.logits),
            )

    def _write_checkpoint(self) -> None:
        files = {
            "config.json": b'{"model_type":"fixture"}\n',
            "tokenizer.json": b'{"version":"1.0"}\n',
            "tokenizer_config.json": b"{}\n",
            "generation_config.json": b"{}\n",
            "model.safetensors": b"fixture-weights",
        }
        for name, payload in files.items():
            (self.checkpoint / name).write_bytes(payload)

    def _write_baseline(self) -> None:
        artifacts = {
            path.name: {
                "bytes": path.stat().st_size,
                "sha256": self.module.sha256_file(path),
            }
            for path in sorted(self.checkpoint.iterdir())
        }
        cases = []
        for index, (rendered, (token_ids, logits)) in enumerate(self.logits.items()):
            output_ids = [index + 10]
            top5 = self.module.ranked_logits(logits, 5)
            cases.append(
                {
                    "index": index,
                    "prompt": f"prompt {index}",
                    "history": [],
                    "max_new_tokens": 16,
                    "required_answer_terms": [],
                    "forbidden_answer_terms": [],
                    "declarative_term_assessment": {
                        "status": "pass",
                        "missing_required_terms": [],
                        "matched_forbidden_terms": [],
                    },
                    "generation_call_count": 1,
                    "output_transform": "none",
                    "seed": 100 + index,
                    "rendered_prompt": rendered,
                    "rendered_prompt_sha256": self.module.sha256_bytes(
                        rendered.encode("utf-8")
                    ),
                    "prompt_token_ids": token_ids,
                    "prompt_token_sha256_le_u32": self.module.token_sha256(token_ids),
                    "output_token_ids": output_ids,
                    "output_token_sha256_le_u32": self.module.token_sha256(output_ids),
                    "raw_output_text": f"output {index}",
                    "first_step_top5": [
                        {
                            "token_id": token_id,
                            "logit": logit,
                            "token_text": f"token-{token_id}",
                        }
                        for token_id, logit in top5
                    ],
                    "elapsed_seconds": 0.1,
                }
            )
        value = {
            "schema": "tinyrustlm.reference_raw_quality.v4",
            "source_model_id": "fixture/source",
            "source_revision": "a" * 40,
            "checkpoint": str(self.checkpoint.resolve()),
            "checkpoint_artifacts": artifacts,
            "adapter": None,
            "eval_cases": str(self.eval_path.resolve()),
            "eval_cases_sha256": self.module.sha256_file(self.eval_path),
            "system_prompt_mode": "included",
            "system_prompt": "Fixture system prompt.",
            "policy_examples": None,
            "user_suffix": "",
            "chat_template_options": {"enable_thinking": False},
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
            "generation_contract": "one-call-unmodified-v1",
            "generation_retries_allowed": False,
            "response_repairs_allowed": False,
            "field_assembly_allowed": False,
            "expected_answer_injection_allowed": False,
            "generation_profile": "greedy",
            "generation_seed_base": 100,
            "generation": {"do_sample": False},
            "source_generation_config": {},
            "publisher_generation_override": None,
            "reference_framework": "fixture-framework",
            "torch_version": "test",
            "transformers_version": "test",
            "dtype": "float32",
            "device": "cpu",
            "load_seconds": 0.1,
            "case_count": len(cases),
            "cases": cases,
        }
        self.baseline.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    unittest.main()
