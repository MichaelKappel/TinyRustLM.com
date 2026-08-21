"""Contract tests for the sole Qwen3 CPU pilot trainer."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import types
import unittest
import zipfile
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "qwen3-working-model-trainer.py"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
PROFILE = (
    REPOSITORY_ROOT
    / "tinyrustlm"
    / "training"
    / "qwen3-0.6b-working-model-v1"
    / "profile.v1.json"
)
ENVIRONMENT_SPEC = PROFILE.parent / "cpu-environment.v1.json"
SPEC = importlib.util.spec_from_file_location("tinyrustlm_qwen3_trainer", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def identity(path: Path) -> dict[str, object]:
    return MODULE.file_identity(path).json_value()


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="ascii"
    )


class FakeTokenizer:
    def __init__(self, *, overflow: bool = False, prefix_drift: bool = False) -> None:
        self.overflow = overflow
        self.prefix_drift = prefix_drift
        self.calls: list[dict[str, object]] = []

    def apply_chat_template(
        self, messages: list[dict[str, str]], **kwargs: object
    ) -> str:
        self.calls.append({"messages": messages, **kwargs})
        return "full" if messages[-1]["role"] == "assistant" else "prompt"

    def __call__(self, text: str, **kwargs: object) -> dict[str, list[int]]:
        del kwargs
        if text == "prompt":
            values = [10, 11]
        elif self.prefix_drift:
            values = [99, 11, 12]
        elif self.overflow:
            values = list(range(20))
        else:
            values = [10, 11, 12, 13]
        return {"input_ids": values, "attention_mask": [1] * len(values)}


class EnvironmentSpecificationTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="qwen3-trainer-test-")
        self.root = Path(self._temporary.name)

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_repository_environment_specification_is_exact(self) -> None:
        specification = MODULE.load_environment_spec(ENVIRONMENT_SPEC)

        self.assertEqual(
            specification.raw["environment_id"],
            "qwen3-0.6b-cpu-pilot-win-amd64-v1",
        )
        self.assertEqual(
            {
                name: value["version"]
                for name, value in specification.required_distributions.items()
            },
            MODULE.EXPECTED_REQUIRED_DISTRIBUTIONS,
        )
        self.assertEqual(specification.raw["runtime"], MODULE.EXPECTED_RUNTIME)
        self.assertFalse(specification.raw["capture_policy"]["training_authority"])

    def test_environment_specification_rejects_runtime_drift(self) -> None:
        value = json.loads(ENVIRONMENT_SPEC.read_text(encoding="utf-8"))
        value["runtime"]["intraop_threads"] = 16
        path = self.root / "drifted.json"
        write_json(path, value)

        with self.assertRaisesRegex(ValueError, "runtime contract drifted"):
            MODULE.load_environment_spec(path)

    def test_environment_specification_rejects_wheel_hash_drift(self) -> None:
        value = json.loads(ENVIRONMENT_SPEC.read_text(encoding="utf-8"))
        value["required_distributions"][0]["wheel_sha256"] = "sha256:" + "0" * 64
        path = self.root / "drifted.json"
        write_json(path, value)

        with self.assertRaisesRegex(ValueError, "artifact drifted"):
            MODULE.load_environment_spec(path)

    def test_duplicate_json_keys_are_rejected(self) -> None:
        path = self.root / "duplicate.json"
        path.write_text('{"schema":"one","schema":"two"}\n', encoding="ascii")

        with self.assertRaisesRegex(ValueError, "duplicate JSON key"):
            MODULE.read_json_object(path, 1024, "duplicate fixture")

    def test_distribution_name_normalization_is_pep503_stable(self) -> None:
        self.assertEqual(
            MODULE.normalize_distribution_name("HuggingFace_Hub"), "huggingface-hub"
        )
        self.assertEqual(
            MODULE.normalize_distribution_name("zope.interface"), "zope-interface"
        )

    def test_invalid_distribution_name_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "invalid distribution name"):
            MODULE.normalize_distribution_name("../torch")


class WheelContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="qwen3-wheel-test-")
        self.root = Path(self._temporary.name)

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def _wheel(self, name: str = "demo", version: str = "1.2.3") -> Path:
        path = self.root / f"{name}-{version}-py3-none-any.whl"
        metadata = f"Metadata-Version: 2.4\nName: {name}\nVersion: {version}\n\n"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(f"{name}-{version}.dist-info/METADATA", metadata)
            archive.writestr(
                f"{name}-{version}.dist-info/WHEEL", "Wheel-Version: 1.0\n"
            )
            archive.writestr(f"{name}/__init__.py", "__version__ = '1.2.3'\n")
        return path

    def test_wheel_identity_binds_metadata_and_container_bytes(self) -> None:
        path = self._wheel()

        value = MODULE.read_wheel_identity(path)

        self.assertEqual(value["distribution_name"], "demo")
        self.assertEqual(value["version"], "1.2.3")
        self.assertEqual(value["bytes"], path.stat().st_size)
        self.assertEqual(value["sha256"], MODULE.sha256_file(path))

    def test_wheel_rejects_archive_traversal(self) -> None:
        path = self.root / "demo-1.0-py3-none-any.whl"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "demo-1.0.dist-info/METADATA", "Name: demo\nVersion: 1.0\n"
            )
            archive.writestr("../escape.py", "pass\n")

        with self.assertRaisesRegex(ValueError, "unsafe archive path"):
            MODULE.read_wheel_identity(path)

    def test_wheel_rejects_two_metadata_owners(self) -> None:
        path = self.root / "demo-1.0-py3-none-any.whl"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "demo-1.0.dist-info/METADATA", "Name: demo\nVersion: 1.0\n"
            )
            archive.writestr(
                "other-1.0.dist-info/METADATA", "Name: other\nVersion: 1.0\n"
            )

        with self.assertRaisesRegex(ValueError, "exactly one"):
            MODULE.read_wheel_identity(path)

    def test_wheel_artifact_set_hash_is_order_sensitive(self) -> None:
        one = {
            "distribution_name": "a",
            "version": "1",
            "filename": "a.whl",
            "bytes": 1,
            "sha256": "sha256:" + "1" * 64,
        }
        two = {**one, "distribution_name": "b", "filename": "b.whl"}

        self.assertNotEqual(
            MODULE.wheel_artifact_set_sha256([one, two]),
            MODULE.wheel_artifact_set_sha256([two, one]),
        )


class InstalledDistributionContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="qwen3-distribution-test-")
        self.root = Path(self._temporary.name)
        self.site_packages = self.root / "Lib" / "site-packages"
        self.scripts = self.root / "Scripts"
        self.site_packages.mkdir(parents=True)
        self.scripts.mkdir()

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def _distribution(self, reported: str, resolved: Path) -> object:
        class Distribution:
            files = [Path(reported)]
            metadata = {"Name": "demo"}
            version = "1.0"

            def locate_file(inner_self, package_path: Path) -> Path:
                del inner_self, package_path
                return resolved

            def read_text(inner_self, name: str) -> str | None:
                del inner_self
                return {
                    "METADATA": "Metadata-Version: 2.4\nName: demo\nVersion: 1.0\n",
                    "INSTALLER": "pip\n",
                    "direct_url.json": None,
                }[name]

        return Distribution()

    def test_console_script_parent_segments_resolve_inside_environment(self) -> None:
        script = self.scripts / "demo.exe"
        script.write_bytes(b"console script")
        distribution = self._distribution("../../Scripts/demo.exe", script)

        with mock.patch.object(MODULE.sys, "prefix", str(self.root)):
            value = MODULE._distribution_file_identity(distribution)

        self.assertEqual(value["file_count"], 1)
        self.assertEqual(value["total_bytes"], len(b"console script"))

    def test_distribution_file_resolving_outside_environment_is_rejected(self) -> None:
        escaped = self.root.parent / "escaped-demo.exe"
        escaped.write_bytes(b"escape")
        self.addCleanup(escaped.unlink)
        distribution = self._distribution("../../../escaped-demo.exe", escaped)

        with mock.patch.object(MODULE.sys, "prefix", str(self.root)):
            with self.assertRaisesRegex(ValueError, "outside the virtual environment"):
                MODULE._distribution_file_identity(distribution)

    def test_empty_owned_metadata_marker_is_hashed(self) -> None:
        marker = self.site_packages / "demo-1.0.dist-info" / "REQUESTED"
        marker.parent.mkdir()
        marker.write_bytes(b"")
        distribution = self._distribution("demo-1.0.dist-info/REQUESTED", marker)

        with mock.patch.object(MODULE.sys, "prefix", str(self.root)):
            value = MODULE._distribution_file_identity(distribution)

        self.assertEqual(value["file_count"], 1)
        self.assertEqual(value["total_bytes"], 0)


class TrainingAlgorithmTests(unittest.TestCase):
    def test_training_isolation_blocks_sockets_and_child_processes(self) -> None:
        source = f"""
import importlib.util
import socket
import subprocess
import sys

spec = importlib.util.spec_from_file_location('isolated_trainer', {str(SCRIPT)!r})
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
module.install_training_isolation_audit_hook()

blocked = 0
for operation in (
    lambda: socket.socket(),
    lambda: subprocess.run([sys.executable, '-c', 'pass'], check=True),
):
    try:
        operation()
    except RuntimeError:
        blocked += 1
if blocked != 2:
    raise SystemExit(f'blocked={{blocked}}')
"""

        completed = subprocess.run(
            [sys.executable, "-c", source],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_shuffle_is_seeded_and_auditable(self) -> None:
        first = MODULE.shuffled_record_indices(32, 20260821)
        second = MODULE.shuffled_record_indices(32, 20260821)
        different = MODULE.shuffled_record_indices(32, 20260822)

        self.assertEqual(first, second)
        self.assertNotEqual(first, different)
        self.assertEqual(set(first), set(range(32)))

    def test_linear_schedule_has_explicit_warmup_and_positive_final_update(
        self,
    ) -> None:
        self.assertEqual(MODULE.linear_learning_rate(3e-5, 1, 128, 16), 3e-5 / 16)
        self.assertEqual(MODULE.linear_learning_rate(3e-5, 16, 128, 16), 3e-5)
        self.assertEqual(MODULE.linear_learning_rate(3e-5, 128, 128, 16), 3e-5 / 112)

    def test_linear_schedule_rejects_invalid_step(self) -> None:
        with self.assertRaisesRegex(ValueError, "outside"):
            MODULE.linear_learning_rate(3e-5, 0, 128, 16)

    def test_linear_schedule_rejects_warmup_without_decay(self) -> None:
        with self.assertRaisesRegex(ValueError, "less than"):
            MODULE.linear_learning_rate(3e-5, 1, 16, 16)

    def test_tokenization_masks_only_the_prompt(self) -> None:
        tokenizer = FakeTokenizer()
        record = MODULE.CurriculumRecord(
            "record-one",
            "ordinary-conversation",
            ({"role": "user", "content": "Hello"},),
            "Hello back",
        )

        value = MODULE.tokenize_record(tokenizer, record, 8)

        self.assertEqual(value["input_ids"], [10, 11, 12, 13])
        self.assertEqual(value["labels"], [-100, -100, 12, 13])
        self.assertEqual(value["assistant_target_tokens"], 2)
        self.assertTrue(
            all(call["enable_thinking"] is False for call in tokenizer.calls)
        )
        self.assertEqual(tokenizer.calls[0]["add_generation_prompt"], True)
        self.assertEqual(tokenizer.calls[1]["add_generation_prompt"], False)

    def test_tokenization_rejects_overflow_instead_of_truncating(self) -> None:
        tokenizer = FakeTokenizer(overflow=True)
        record = MODULE.CurriculumRecord(
            "record-one",
            "ordinary-conversation",
            ({"role": "user", "content": "Hello"},),
            "Hello back",
        )

        with self.assertRaisesRegex(RuntimeError, "no-truncation"):
            MODULE.tokenize_record(tokenizer, record, 8)

    def test_tokenization_rejects_chat_template_prefix_drift(self) -> None:
        tokenizer = FakeTokenizer(prefix_drift=True)
        record = MODULE.CurriculumRecord(
            "record-one",
            "ordinary-conversation",
            ({"role": "user", "content": "Hello"},),
            "Hello back",
        )

        with self.assertRaisesRegex(RuntimeError, "prompt prefix"):
            MODULE.tokenize_record(tokenizer, record, 8)

    def test_training_recipe_rejects_partial_projection_set(self) -> None:
        profile = json.loads(PROFILE.read_text(encoding="utf-8"))
        training = profile["training"]
        training["target_modules"] = training["target_modules"][:-1]

        with self.assertRaisesRegex(ValueError, "seven Qwen3"):
            MODULE.validate_training_recipe(training)

    def test_stop_rules_reject_best_effort_retry_language(self) -> None:
        profile = json.loads(PROFILE.read_text(encoding="utf-8"))
        rules = profile["stop_rules"]
        rules["retry_requirement"] = "retry-same-run"

        with self.assertRaisesRegex(ValueError, "retry_requirement"):
            MODULE.validate_stop_rules(rules)


class TrainerAuthorizationFixture(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="qwen3-auth-test-")
        self.root = Path(self._temporary.name)
        self.environment_lock = self.root / "environment-lock.json"
        self.environment_lock.write_text('{"fixture":true}\n', encoding="ascii")
        self.wheelhouse_manifest = self.root / "wheelhouse-manifest.json"
        self.wheelhouse_manifest.write_text('{"fixture":true}\n', encoding="ascii")
        self.source_root = self.root / "source"
        self.source_root.mkdir()
        self._write_source()
        self.profile_path = self.root / "profile.json"
        self.profile_value = self._profile_value()
        write_json(self.profile_path, self.profile_value)
        self.curriculum = self.root / "curriculum.jsonl"
        record = self._curriculum_record()
        self.curriculum.write_text(
            json.dumps(record, sort_keys=True) + "\n", encoding="ascii"
        )
        record_order = MODULE.sha256_bytes(
            MODULE.canonical_json_bytes([record["record_id"]])
        )
        self.training_lock = self.root / "training-lock.json"
        write_json(self.training_lock, self._training_lock_value(record_order))

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def _write_source(self) -> None:
        values = {
            "LICENSE": "Apache-2.0\n",
            "README.md": "fixture\n",
            "config.json": json.dumps(
                {"architectures": [MODULE.EXPECTED_ARCHITECTURE], "model_type": "qwen3"}
            )
            + "\n",
            "generation_config.json": "{}\n",
            "merges.txt": "a b\n",
            "model.safetensors": "fixture model\n",
            "tokenizer.json": "{}\n",
            "tokenizer_config.json": json.dumps(
                {
                    "chat_template": "{{ messages }}",
                    "tokenizer_class": "Qwen2TokenizerFast",
                }
            )
            + "\n",
            "vocab.json": "{}\n",
        }
        for name, value in values.items():
            (self.source_root / name).write_text(value, encoding="ascii")

    def _profile_value(self) -> dict[str, object]:
        repository = json.loads(PROFILE.read_text(encoding="utf-8"))
        source_files = [
            {"name": path.name, **identity(path)}
            for path in sorted(self.source_root.iterdir(), key=lambda value: value.name)
        ]
        repository["source"]["files"] = source_files
        repository["curriculum"]["pilot_record_count"] = 1
        repository["curriculum"]["categories"] = [
            {
                "id": "ordinary-conversation",
                "pilot_count": 1,
                "scale_count": 1,
                "required_factors": ["discourse_form"],
                "minimum_distinct_values_per_factor": 1,
            }
        ]
        return repository

    def _curriculum_record(self) -> dict[str, object]:
        return {
            "schema": MODULE.CURRICULUM_RECORD_SCHEMA,
            "record_id": "ordinary-one",
            "task_family": "ordinary-conversation",
            "template_family_id": "greeting-v1",
            "scenario_factors": {"discourse_form": "casual"},
            "entities": [],
            "messages": [{"role": "user", "content": "Hello there"}],
            "response": "Hello. How can I help?",
            "disposition": "helpful-positive",
            "source_provenance": {},
            "teacher_generation": {"hidden_reasoning_included": False},
            "review": {
                "decision": "accept",
                "pii_scan_status": "pass",
                "license_review_status": "pass",
                "malicious_artifact_scan_status": "pass",
            },
        }

    def _training_lock_value(self, record_order_sha256: str) -> dict[str, object]:
        profile_identity = identity(self.profile_path)
        return {
            "schema": MODULE.TRAINING_LOCK_SCHEMA,
            "status": "authorized",
            "authorized_operation": "cpu-lora-pilot",
            "lock_id": "fixture-lock-v1",
            "profile_id": MODULE.EXPECTED_PROFILE_ID,
            "profile_sha256": profile_identity["sha256"],
            "goal_sha256": MODULE.EXPECTED_GOAL_SHA256,
            "source_repo_id": MODULE.EXPECTED_SOURCE_REPO_ID,
            "source_revision": MODULE.EXPECTED_SOURCE_REVISION,
            "source_status": MODULE.EXPECTED_SOURCE_STATUS,
            "source_artifacts": self.profile_value["source"]["files"],
            "curriculum": identity(self.curriculum),
            "curriculum_audit": {"bytes": 1, "sha256": "sha256:" + "1" * 64},
            "review_manifest": {"bytes": 1, "sha256": "sha256:" + "2" * 64},
            "review_evidence": {
                "record_count": 1,
                "record_order_sha256": record_order_sha256,
            },
            "holdout_receipt": {"bytes": 1, "sha256": "sha256:" + "3" * 64},
            "exclusion_index": {"bytes": 1, "sha256": "sha256:" + "4" * 64},
            "semantic_receipt": {"bytes": 1, "sha256": "sha256:" + "5" * 64},
            "tombstone_lineage": {"bytes": 1, "sha256": "sha256:" + "6" * 64},
            "environment_lock": identity(self.environment_lock),
            "training_program": MODULE.program_identity().json_value(),
            "output_root": str(self.root / "attempt-output"),
            "training": self.profile_value["training"],
            "stop_rules": self.profile_value["stop_rules"],
            "checkpoint_selection": "final-checkpoint-only-no-best-of-n",
            "raw_output_preservation_required": True,
            "retry_selection_forbidden": True,
            "response_repair_forbidden": True,
        }

    def _verify(self) -> MODULE.VerifiedTrainingInputs:
        fake_environment = {"runtime_probe": {}}
        with mock.patch.object(
            MODULE,
            "verify_environment_lock",
            return_value=(
                fake_environment,
                MODULE.file_identity(self.environment_lock),
                self.wheelhouse_manifest,
            ),
        ):
            return MODULE.verify_training_inputs(
                self.profile_path,
                self.training_lock,
                ENVIRONMENT_SPEC,
                self.environment_lock,
                self.source_root,
                self.curriculum,
                probe_runtime=False,
            )

    def test_training_authorization_binds_program_source_and_curriculum(self) -> None:
        inputs = self._verify()

        summary = MODULE.verification_summary(inputs)

        self.assertTrue(summary["training_authorized"])
        self.assertFalse(summary["training_executed"])
        self.assertEqual(summary["quality_claim"], "none")
        self.assertEqual(summary["record_count"], 1)

    def test_training_authorization_rejects_program_identity_drift_before_environment_probe(
        self,
    ) -> None:
        value = json.loads(self.training_lock.read_text(encoding="utf-8"))
        value["training_program"]["sha256"] = "sha256:" + "0" * 64
        write_json(self.training_lock, value)

        with mock.patch.object(MODULE, "verify_environment_lock") as environment_probe:
            with self.assertRaisesRegex(ValueError, "own exact bytes"):
                MODULE.verify_training_inputs(
                    self.profile_path,
                    self.training_lock,
                    ENVIRONMENT_SPEC,
                    self.environment_lock,
                    self.source_root,
                    self.curriculum,
                    probe_runtime=False,
                )
        environment_probe.assert_not_called()

    def test_training_authorization_installs_isolation_before_ml_probe(
        self,
    ) -> None:
        events: list[str] = []
        fake_environment = {"runtime_probe": {}}

        with (
            mock.patch.object(
                MODULE,
                "apply_required_environment",
                side_effect=lambda _spec: events.append("environment"),
            ),
            mock.patch.object(
                MODULE,
                "install_training_isolation_audit_hook",
                side_effect=lambda: events.append("training-isolation"),
            ),
            mock.patch.object(
                MODULE,
                "verify_environment_lock",
                side_effect=lambda *_args, **_kwargs: (
                    events.append("environment-lock")
                    or (
                        fake_environment,
                        MODULE.file_identity(self.environment_lock),
                        self.wheelhouse_manifest,
                    )
                ),
            ),
            mock.patch.object(
                MODULE,
                "probe_ml_runtime",
                side_effect=lambda _spec: events.append("runtime-probe") or {},
            ),
        ):
            MODULE.verify_training_inputs(
                self.profile_path,
                self.training_lock,
                ENVIRONMENT_SPEC,
                self.environment_lock,
                self.source_root,
                self.curriculum,
                probe_runtime=True,
            )

        self.assertEqual(
            events,
            [
                "environment-lock",
                "environment",
                "training-isolation",
                "runtime-probe",
            ],
        )

    def test_training_authorization_rejects_curriculum_drift(self) -> None:
        self.curriculum.write_bytes(
            self.curriculum.read_bytes().replace(b"Hello there", b"Hello drift")
        )

        with self.assertRaisesRegex(ValueError, "curriculum identity drifted"):
            self._verify()

    def test_training_authorization_rejects_extra_source_file(self) -> None:
        (self.source_root / "modeling_qwen3.py").write_text("pass\n", encoding="ascii")

        with self.assertRaisesRegex(ValueError, "file set"):
            self._verify()

    def test_training_authorization_rejects_remote_code_config(self) -> None:
        path = self.source_root / "config.json"
        value = json.loads(path.read_text(encoding="utf-8"))
        value["auto_map"] = {"AutoModel": "modeling.Custom"}
        write_json(path, value)
        self.profile_value["source"]["files"] = [
            {"name": item.name, **identity(item)}
            for item in sorted(self.source_root.iterdir(), key=lambda item: item.name)
        ]

        with self.assertRaisesRegex(ValueError, "remote or custom code"):
            MODULE.verify_source_root(self.profile_value, self.source_root)

    def test_curriculum_rejects_hidden_reasoning(self) -> None:
        raw = self._curriculum_record()
        raw["teacher_generation"]["hidden_reasoning_included"] = True

        with self.assertRaisesRegex(ValueError, "hidden teacher reasoning"):
            MODULE._validate_curriculum_record(self.profile_value, raw, 1)


class AttemptAndCheckpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="qwen3-checkpoint-test-")
        self.root = Path(self._temporary.name)

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def _checkpoint(self, name: str, parent: str | None = None) -> Path:
        path = self.root / "checkpoints" / name
        path.mkdir(parents=True)
        (path / "adapter_model.safetensors").write_bytes(b"adapter")
        (path / "adapter_config.json").write_text("{}\n", encoding="ascii")
        (path / "trainer_state.pt").write_bytes(b"state")
        files = MODULE._tree_file_identities(path)
        step = int(name.split("-")[1])
        record_offset = step * 8
        receipt = {
            "schema": MODULE.CHECKPOINT_RECEIPT_SCHEMA,
            "status": "complete",
            "global_update_step": step,
            "next_record_offset": record_offset,
            "elapsed_wall_clock_seconds": 12.5,
            "peak_rss_bytes": 1024,
            "previous_update_loss": 1.0,
            "consecutive_loss_increases": 0,
            "loss_observation_count": record_offset,
            "sft_loss_sum": float(record_offset),
            "preservation_kl_loss_sum": float(record_offset) / 2,
            "total_loss_sum": float(record_offset) * 1.05,
            "assistant_target_token_count": record_offset * 2,
            "parent_checkpoint_receipt_sha256": parent,
            "files": files,
            "file_set_sha256": MODULE.sha256_bytes(MODULE.canonical_json_bytes(files)),
            "eligible_for_candidate_selection": False,
        }
        write_json(path / "checkpoint-receipt.json", receipt)
        return path

    def test_checkpoint_verification_binds_all_files(self) -> None:
        path = self._checkpoint("checkpoint-000032")

        state = MODULE.verify_checkpoint_directory(path, None)

        self.assertEqual(state.receipt["global_update_step"], 32)
        self.assertEqual(
            state.receipt_identity.sha256,
            MODULE.sha256_file(path / "checkpoint-receipt.json"),
        )

    def test_checkpoint_verification_rejects_post_receipt_drift(self) -> None:
        path = self._checkpoint("checkpoint-000032")
        (path / "adapter_model.safetensors").write_bytes(b"changed")

        with self.assertRaisesRegex(ValueError, "changed after completion"):
            MODULE.verify_checkpoint_directory(path, None)

    def test_checkpoint_verification_rejects_parent_chain_drift(self) -> None:
        path = self._checkpoint("checkpoint-000032", "sha256:" + "1" * 64)

        with self.assertRaisesRegex(ValueError, "parent chain"):
            MODULE.verify_checkpoint_directory(path, None)

    def test_checkpoint_verification_rejects_cumulative_progress_drift(self) -> None:
        path = self._checkpoint("checkpoint-000032")
        receipt_path = path / "checkpoint-receipt.json"
        receipt = json.loads(receipt_path.read_text(encoding="ascii"))
        receipt["loss_observation_count"] -= 1
        write_json(receipt_path, receipt)

        with self.assertRaisesRegex(ValueError, "loss observations"):
            MODULE.verify_checkpoint_directory(path, None)

    def test_checkpoint_schedule_requires_an_exact_prefix(self) -> None:
        checkpoint = MODULE.verify_checkpoint_directory(
            self._checkpoint("checkpoint-000064"), None
        )

        with self.assertRaisesRegex(ValueError, "exact schedule prefix"):
            MODULE.validate_checkpoint_schedule(
                (checkpoint,),
                total_updates=128,
                accumulation=8,
                checkpoint_interval=32,
            )

    def test_checkpoint_schedule_rejects_early_candidate_eligibility(self) -> None:
        path = self._checkpoint("checkpoint-000032")
        receipt_path = path / "checkpoint-receipt.json"
        receipt = json.loads(receipt_path.read_text(encoding="ascii"))
        receipt["eligible_for_candidate_selection"] = True
        write_json(receipt_path, receipt)
        checkpoint = MODULE.verify_checkpoint_directory(path, None)

        with self.assertRaisesRegex(ValueError, "eligibility"):
            MODULE.validate_checkpoint_schedule(
                (checkpoint,),
                total_updates=128,
                accumulation=8,
                checkpoint_interval=32,
            )

    def test_checkpoint_schedule_rejects_backward_cumulative_evidence(self) -> None:
        first = MODULE.verify_checkpoint_directory(
            self._checkpoint("checkpoint-000032"), None
        )
        second_path = self._checkpoint(
            "checkpoint-000064", first.receipt_identity.sha256
        )
        receipt_path = second_path / "checkpoint-receipt.json"
        receipt = json.loads(receipt_path.read_text(encoding="ascii"))
        receipt["elapsed_wall_clock_seconds"] = 1.0
        write_json(receipt_path, receipt)
        second = MODULE.verify_checkpoint_directory(
            second_path, first.receipt_identity.sha256
        )

        with self.assertRaisesRegex(ValueError, "moved backward"):
            MODULE.validate_checkpoint_schedule(
                (first, second),
                total_updates=128,
                accumulation=8,
                checkpoint_interval=32,
            )

    def test_resume_state_binds_every_public_cumulative_field(self) -> None:
        path = self._checkpoint("checkpoint-000032")
        checkpoint = MODULE.verify_checkpoint_directory(path, None)
        state = {
            key: checkpoint.receipt[key]
            for key in {
                "global_update_step",
                "next_record_offset",
                "elapsed_wall_clock_seconds",
                "peak_rss_bytes",
                "previous_update_loss",
                "consecutive_loss_increases",
                "loss_observation_count",
                "sft_loss_sum",
                "preservation_kl_loss_sum",
                "total_loss_sum",
                "assistant_target_token_count",
            }
        }
        state["total_loss_sum"] += 1.0
        state["optimizer_state_dict"] = {}
        state["torch_rng_state"] = object()
        torch = mock.Mock()
        torch.load.return_value = state
        torch.is_tensor.return_value = True

        with self.assertRaisesRegex(ValueError, "public receipt"):
            MODULE._load_resume_state(torch, checkpoint)

    def test_resume_rejects_interrupted_staging_directory(self) -> None:
        checkpoint_root = self.root / "checkpoints"
        checkpoint_root.mkdir()
        (checkpoint_root / f".checkpoint-000032.{'a' * 32}.staging").mkdir()

        with self.assertRaisesRegex(ValueError, "operator review"):
            MODULE.completed_checkpoints(self.root)

    def test_interrupted_staging_is_preserved_with_create_only_receipt(self) -> None:
        checkpoint_root = self.root / "checkpoints"
        interrupted_root = self.root / "interrupted"
        checkpoint_root.mkdir()
        interrupted_root.mkdir()
        staging_name = f".checkpoint-000032.{'a' * 32}.staging"
        stage = checkpoint_root / staging_name
        stage.mkdir()
        (stage / "partial-state.bin").write_bytes(b"partial checkpoint")
        inputs = types.SimpleNamespace(
            output_root=self.root,
            records=(object(),),
            training_lock={"training": {"shuffle_seed": 7}},
        )

        with mock.patch.object(MODULE, "initialize_attempt"):
            first = MODULE.quarantine_interrupted_output(inputs)
            second = MODULE.quarantine_interrupted_output(inputs)

        destination = interrupted_root / f"checkpoint-000032.{'a' * 32}.interrupted"
        self.assertFalse(stage.exists())
        self.assertEqual(
            (destination / "partial-state.bin").read_bytes(), b"partial checkpoint"
        )
        self.assertTrue((destination / "interruption-plan.json").is_file())
        self.assertTrue((destination / "interruption-receipt.json").is_file())
        self.assertEqual(first["quarantined_output_count"], 1)
        self.assertEqual(second, first)

    def test_interrupted_candidate_is_preserved_before_resume(self) -> None:
        checkpoint_root = self.root / "checkpoints"
        interrupted_root = self.root / "interrupted"
        checkpoint_root.mkdir()
        interrupted_root.mkdir()
        stage = self.root / f".candidate.{'b' * 32}.staging"
        stage.mkdir()
        (stage / "adapter_model.safetensors").write_bytes(b"partial adapter")
        inputs = types.SimpleNamespace(
            output_root=self.root,
            records=(object(),),
            training_lock={"training": {"shuffle_seed": 7}},
        )

        with mock.patch.object(MODULE, "initialize_attempt"):
            result = MODULE.quarantine_interrupted_output(inputs)

        destination = interrupted_root / f"candidate.{'b' * 32}.interrupted"
        self.assertFalse(stage.exists())
        self.assertEqual(
            (destination / "adapter_model.safetensors").read_bytes(),
            b"partial adapter",
        )
        self.assertEqual(result["quarantined_output_count"], 1)

    def test_completed_candidate_recovers_missing_top_level_receipt(self) -> None:
        checkpoint = MODULE.verify_checkpoint_directory(
            self._checkpoint("checkpoint-000032"), None
        )
        inputs = types.SimpleNamespace(
            output_root=self.root,
            profile={"profile_id": MODULE.EXPECTED_PROFILE_ID},
            profile_identity=MODULE.FileIdentity(1, "sha256:" + "1" * 64),
            training_lock_identity=MODULE.FileIdentity(1, "sha256:" + "2" * 64),
            environment_lock_identity=MODULE.FileIdentity(1, "sha256:" + "3" * 64),
            curriculum_identity=MODULE.FileIdentity(1, "sha256:" + "4" * 64),
            records=(object(),),
        )
        metrics = {"loss_observation_count": 1}

        first = MODULE._finalize_candidate(inputs, checkpoint, metrics)
        (self.root / "training-receipt.json").unlink()
        second = MODULE._finalize_candidate(inputs, checkpoint, metrics)

        self.assertEqual(second, first)
        self.assertEqual(
            json.loads(
                (self.root / "training-receipt.json").read_text(encoding="ascii")
            ),
            first,
        )

    def test_terminal_decision_precedes_rejected_adapter_preservation(self) -> None:
        (self.root / "rejections").mkdir()
        inputs = types.SimpleNamespace(
            output_root=self.root,
            training_lock={
                "stop_rules": {
                    "retry_requirement": "new-preregistration-and-material-method-or-data-change"
                }
            },
            training_lock_identity=MODULE.FileIdentity(1, "sha256:" + "5" * 64),
        )
        state = {
            "global_update_step": 3,
            "next_record_offset": 24,
            "elapsed_wall_clock_seconds": 10.0,
            "peak_rss_bytes": 4096,
            "loss_observation_count": 24,
            "assistant_target_token_count": 48,
        }
        model = mock.Mock()
        model.save_pretrained.side_effect = OSError("simulated disk failure")

        with self.assertRaisesRegex(OSError, "simulated"):
            MODULE._terminal_rejection(inputs, model, "wall-clock-limit", state)

        decision = json.loads(
            (self.root / "terminal-rejection.json").read_text(encoding="ascii")
        )
        self.assertEqual(decision["status"], "terminal-reject")
        self.assertEqual(decision["quality_claim"], "none")

    def test_empty_segment_event_stream_gets_a_complete_receipt(self) -> None:
        segment = self.root / "segment"
        segment.mkdir()
        (segment / "events.jsonl").write_bytes(b"")

        MODULE._finish_segment(segment, "interrupted", "operator-cancelled")

        receipt = json.loads(
            (segment / "segment-receipt.json").read_text(encoding="ascii")
        )
        self.assertEqual(receipt["events"]["bytes"], 0)
        self.assertEqual(receipt["events"]["sha256"], MODULE.sha256_bytes(b""))

    def test_resume_wall_clock_includes_events_after_last_checkpoint(self) -> None:
        segment = self.root / "segments" / "segment-one"
        segment.mkdir(parents=True)
        event = {
            "schema": MODULE.TRAINING_EVENT_SCHEMA,
            "global_update_step": 40,
            "next_record_offset": 320,
            "learning_rate": 0.00001,
            "sft_loss_mean": 1.0,
            "preservation_kl_loss_mean": 0.1,
            "total_loss_mean": 1.01,
            "gradient_norm_before_clip": 0.5,
            "consecutive_loss_increases": 0,
            "peak_rss_bytes": 4096,
            "elapsed_wall_clock_seconds": 987.5,
        }
        (segment / "events.jsonl").write_text(
            json.dumps(event, sort_keys=True) + "\n", encoding="ascii"
        )

        self.assertEqual(MODULE.observed_segment_elapsed_seconds(self.root), 987.5)

    def test_resume_wall_clock_rejects_event_schema_drift(self) -> None:
        segment = self.root / "segments" / "segment-one"
        segment.mkdir(parents=True)
        (segment / "events.jsonl").write_text('{"schema":"wrong"}\n', encoding="ascii")

        with self.assertRaisesRegex(ValueError, "keys are not exact"):
            MODULE.observed_segment_elapsed_seconds(self.root)

    def test_atomic_writer_refuses_overwrite(self) -> None:
        path = self.root / "receipt.json"
        MODULE.write_new_atomic(path, b"one\n")

        with self.assertRaisesRegex(FileExistsError, "overwrite"):
            MODULE.write_new_atomic(path, b"two\n")
        self.assertEqual(path.read_bytes(), b"one\n")


if __name__ == "__main__":
    unittest.main()
