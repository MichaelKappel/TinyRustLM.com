"""Contract tests for local teacher draft collection and review export."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-distillation-teacher-corpus.py"
DATASET_SCRIPT = Path(__file__).resolve().parents[1] / "prepare-distillation-dataset.py"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def load_script(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


MODULE = load_script("tinyrustlm_teacher_corpus", SCRIPT)
DATASET_MODULE = load_script("tinyrustlm_prepare_dataset_for_teacher_test", DATASET_SCRIPT)


class TeacherCorpusPreparationTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-teacher-corpus-")
        self.root = Path(self._temporary.name)
        self.teacher = self.root / "teacher.gguf"
        self.teacher.write_bytes(b"GGUF local teacher fixture with tokenizer")
        self.system_prompt = self.root / "system-prompt.txt"
        self.system_prompt.write_text(
            "Write a direct final answer. Never emit hidden reasoning.", encoding="utf-8"
        )
        self.exclusion = self.root / "public-eval.txt"
        self.exclusion.write_text(
            "\n".join(
                [
                    "tinyrustlm_eval_cases_version=1",
                    "holdout_count=0",
                    "case_count=1",
                    "case.0.prompt=Name two colors visible in a daytime rainbow.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        self.prompt_plan = self.root / "prompt-plan.jsonl"
        self._write_prompt_plan()
        self.control = self._write_control()
        self.draft_dir = self.root / "drafts"

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_collects_raw_responses_and_revalidates_every_hash(self) -> None:
        requests = []

        def transport(endpoint: str, payload: bytes, timeout: int) -> bytes:
            requests.append((endpoint, json.loads(payload), timeout))
            return self._response(
                "Hello. I can help with writing and analysis.\n"
                "I can also explain local-model tasks."
            )

        plan = MODULE.build_collection_plan(self.control)
        MODULE.collect_drafts(plan, self.draft_dir, transport)
        manifest = MODULE.validate_draft_bundle(self.draft_dir)

        self.assertEqual(manifest["record_count"], 2)
        self.assertEqual(len(requests), 2)
        self.assertEqual(requests[0][0], "http://127.0.0.1:1235/v1/chat/completions")
        self.assertFalse(requests[0][1]["stream"])
        self.assertEqual(
            requests[0][1]["chat_template_kwargs"], {"enable_thinking": False}
        )
        self.assertIn(
            "Answer naturally in no more than two sentences.",
            requests[0][1]["messages"][0]["content"],
        )
        self.assertIn(
            "Satisfy this contract exactly and add nothing beyond it.",
            requests[0][1]["messages"][0]["content"],
        )
        self.assertNotIn("authorization", json.dumps(requests[0][1]).lower())
        self.assertTrue((self.draft_dir / manifest["records"][0]["raw_response_file"]).is_file())
        draft_bytes = (
            self.draft_dir / manifest["records"][0]["draft_file"]
        ).read_bytes()
        self.assertIn(b"analysis.\nI can", draft_bytes)
        self.assertNotIn(b"\r\n", draft_bytes)

    def test_structured_history_reaches_teacher_review_and_export(self) -> None:
        records = [
            json.loads(line)
            for line in self.prompt_plan.read_text(encoding="utf-8").splitlines()
        ]
        records[0]["history"] = [
            {"role": "user", "content": "The old project label was Cedar."},
            {"role": "assistant", "content": "I recorded Cedar as the old label."},
        ]
        self.prompt_plan.write_text(
            "".join(json.dumps(record) + "\n" for record in records),
            encoding="utf-8",
        )
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["prompt_plan"]["sha256"] = MODULE.sha256_file(self.prompt_plan)
        self.control.write_text(json.dumps(control, indent=2), encoding="utf-8")
        observed_messages = []

        def transport(_endpoint: str, payload: bytes, _timeout: int) -> bytes:
            request = json.loads(payload)
            observed_messages.append(request["messages"])
            active_prompt = request["messages"][-1]["content"]
            content = (
                '{"state":"queued","detail":"stored locally"}'
                if "JSON object" in active_prompt
                else "I can help with the text task using the latest conversation context."
            )
            return self._response(content)

        MODULE.collect_drafts(
            MODULE.build_collection_plan(self.control), self.draft_dir, transport
        )
        self.assertEqual(
            [message["role"] for message in observed_messages[0]],
            ["system", "user", "assistant", "user"],
        )
        workbook = self.root / "workbook"
        MODULE.prepare_review_workbook(self.draft_dir, workbook)
        context = json.loads(
            (workbook / "review-context.jsonl").read_text(encoding="utf-8").splitlines()[0]
        )
        self.assertIn("[user]\nThe old project label was Cedar.", context["prompt"])
        self.assertIn("[current user]", context["prompt"])

        reviewed = self.root / "reviewed"
        MODULE.export_reviewed(self.draft_dir, self._write_decisions(), reviewed)
        exported = json.loads(
            (reviewed / "reviewed-teacher-output.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()[0]
        )
        self.assertEqual(
            [message["role"] for message in exported["history"]],
            ["user", "assistant"],
        )

    def test_checkpointed_collection_resumes_without_reissuing_completed_records(self) -> None:
        plan = MODULE.build_collection_plan(self.control)
        checkpoint = self.root / "collection-checkpoint"
        first_attempt_prompts = []

        def interrupted_transport(_endpoint: str, payload: bytes, _timeout: int) -> bytes:
            prompt = json.loads(payload)["messages"][1]["content"]
            first_attempt_prompts.append(prompt)
            if len(first_attempt_prompts) == 2:
                raise ValueError("simulated teacher interruption")
            return self._response("First durable teacher answer.")

        with self.assertRaisesRegex(ValueError, "simulated teacher interruption"):
            MODULE.collect_drafts(
                plan,
                self.draft_dir,
                interrupted_transport,
                checkpoint_dir=checkpoint,
            )

        self.assertFalse(self.draft_dir.exists())
        partial = MODULE.validate_collection_checkpoint(plan, checkpoint)
        self.assertEqual(partial["completed_record_count"], 1)
        resumed_prompts = []

        def resumed_transport(_endpoint: str, payload: bytes, _timeout: int) -> bytes:
            prompt = json.loads(payload)["messages"][1]["content"]
            resumed_prompts.append(prompt)
            return self._response('{"state":"queued","detail":"stored locally"}')

        MODULE.collect_drafts(
            plan,
            self.draft_dir,
            resumed_transport,
            checkpoint_dir=checkpoint,
        )

        manifest = MODULE.validate_draft_bundle(self.draft_dir)
        complete = MODULE.validate_collection_checkpoint(plan, checkpoint)
        self.assertEqual(manifest["record_count"], 2)
        self.assertEqual(complete["completed_record_count"], 2)
        self.assertEqual(len(resumed_prompts), 1)
        self.assertIn("JSON object", resumed_prompts[0])

    def test_checkpoint_drift_fails_before_another_teacher_call(self) -> None:
        plan = MODULE.build_collection_plan(self.control)
        checkpoint = self.root / "collection-checkpoint"

        def interrupted_transport(_endpoint: str, _payload: bytes, _timeout: int) -> bytes:
            if (checkpoint / "records").exists() and any(
                (checkpoint / "records").iterdir()
            ):
                raise ValueError("stop after first checkpoint")
            return self._response("First durable teacher answer.")

        with self.assertRaisesRegex(ValueError, "stop after first checkpoint"):
            MODULE.collect_drafts(
                plan,
                self.draft_dir,
                interrupted_transport,
                checkpoint_dir=checkpoint,
            )
        record_file = next((checkpoint / "records").glob("*.json"))
        record = json.loads(record_file.read_text(encoding="utf-8"))
        record["raw_response_sha256"] = "sha256:" + "0" * 64
        record_file.write_text(json.dumps(record), encoding="utf-8")
        calls = 0

        def forbidden_transport(_endpoint: str, _payload: bytes, _timeout: int) -> bytes:
            nonlocal calls
            calls += 1
            return self._response("must not be called")

        with self.assertRaisesRegex(ValueError, "checkpoint raw response SHA-256 drift"):
            MODULE.collect_drafts(
                plan,
                self.draft_dir,
                forbidden_transport,
                checkpoint_dir=checkpoint,
            )
        self.assertEqual(calls, 0)

    def test_complete_checkpoint_rebuilds_bundle_without_teacher_calls(self) -> None:
        plan = MODULE.build_collection_plan(self.control)
        checkpoint = self.root / "collection-checkpoint"
        first_bundle = self.root / "first-draft-bundle"
        second_bundle = self.root / "rebuilt-draft-bundle"

        responses = iter(
            [
                self._response("First durable teacher answer."),
                self._response('{"state":"queued","detail":"stored locally"}'),
            ]
        )
        MODULE.collect_drafts(
            plan,
            first_bundle,
            lambda _endpoint, _payload, _timeout: next(responses),
            checkpoint_dir=checkpoint,
        )
        calls = 0

        def forbidden_transport(_endpoint: str, _payload: bytes, _timeout: int) -> bytes:
            nonlocal calls
            calls += 1
            raise AssertionError("a complete checkpoint must not call the teacher")

        MODULE.collect_drafts(
            plan,
            second_bundle,
            forbidden_transport,
            checkpoint_dir=checkpoint,
        )

        first = MODULE.validate_draft_bundle(first_bundle)
        second = MODULE.validate_draft_bundle(second_bundle)
        self.assertEqual(calls, 0)
        self.assertEqual(first["records"], second["records"])

        verify = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "collect",
                str(self.control),
                str(first_bundle),
                "--verify-only",
                "--checkpoint-dir",
                str(checkpoint),
            ],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(verify.returncode, 0, verify.stderr)
        self.assertEqual(
            json.loads(verify.stdout)["required_next_gate"], "validate-drafts"
        )

    def test_checkpoint_validation_ignores_only_owned_atomic_temp_files(self) -> None:
        plan = MODULE.build_collection_plan(self.control)
        checkpoint = self.root / "collection-checkpoint"

        def interrupted_transport(_endpoint: str, _payload: bytes, _timeout: int) -> bytes:
            if any((checkpoint / "records").glob("*.json")):
                raise ValueError("stop after first checkpoint")
            return self._response("First durable teacher answer.")

        with self.assertRaisesRegex(ValueError, "stop after first checkpoint"):
            MODULE.collect_drafts(
                plan,
                self.draft_dir,
                interrupted_transport,
                checkpoint_dir=checkpoint,
            )
        record_file = next((checkpoint / "records").glob("*.json"))
        owned_temp = record_file.with_name(f".{record_file.name}.tmp-interrupted")
        owned_temp.write_bytes(b"partial")

        result = MODULE.validate_collection_checkpoint(plan, checkpoint)

        self.assertEqual(result["completed_record_count"], 1)
        self.assertTrue(owned_temp.exists())

        unknown_temp = checkpoint / "records" / ".unknown.json.tmp-interrupted"
        unknown_temp.write_bytes(b"partial")
        with self.assertRaisesRegex(ValueError, "unknown collection checkpoint entry"):
            MODULE.validate_collection_checkpoint(plan, checkpoint)

    def test_publish_accepts_windows_access_denied_after_completed_move(self) -> None:
        staging = self.root / "publish-staging"
        output = self.root / "published"
        staging.mkdir()
        (staging / "receipt.json").write_text("{}\n", encoding="utf-8")
        real_rename = MODULE.os.rename

        def move_then_report_access_denied(source: Path, destination: Path) -> None:
            real_rename(source, destination)
            raise PermissionError(5, "Access is denied", str(source), str(destination))

        with mock.patch.object(
            MODULE.os, "rename", side_effect=move_then_report_access_denied
        ):
            MODULE.publish_new_directory(staging, output)

        self.assertFalse(staging.exists())
        self.assertEqual((output / "receipt.json").read_text(encoding="utf-8"), "{}\n")

    def test_rejects_non_loopback_teacher_endpoint(self) -> None:
        control = json.loads(self.control.read_text(encoding="utf-8"))
        control["teacher"]["endpoint"] = "https://example.com/v1/chat/completions"
        self.control.write_text(json.dumps(control), encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "loopback"):
            MODULE.build_collection_plan(self.control)

    def test_rejects_prompt_plan_eval_contamination_before_collection(self) -> None:
        record = {
            "id": "leaked-eval-case",
            "task_family": "factual-qa",
            "prompt": "Name two colors visible in a daytime rainbow.",
            "response_requirements": ["Return exactly two color names."],
            "max_tokens": 32,
        }
        self.prompt_plan.write_text(json.dumps(record) + "\n", encoding="utf-8")
        self.control = self._write_control()

        with self.assertRaisesRegex(ValueError, "eval exclusion"):
            MODULE.build_collection_plan(self.control)

    def test_rejects_short_eval_leak_hidden_by_apostrophe_spelling(self) -> None:
        exclusion = MODULE.ExclusionIdentity(
            self.exclusion,
            MODULE.sha256_file(self.exclusion),
            1,
            ("what's up?",),
        )
        index = MODULE.build_exclusion_index((exclusion,))

        with self.assertRaisesRegex(ValueError, "exactly matches eval exclusion"):
            MODULE.reject_contamination(
                "casual-greeting",
                "prompt",
                "whats up?",
                index,
            )

    def test_rejects_draft_file_drift(self) -> None:
        self._collect()
        manifest = json.loads(
            (self.draft_dir / "teacher-draft-manifest.json").read_text(encoding="utf-8")
        )
        draft = self.draft_dir / manifest["records"][0]["draft_file"]
        draft.write_text("Changed after collection.", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "draft response has drifted"):
            MODULE.validate_draft_bundle(self.draft_dir)

        self.assertEqual(MODULE.restore_derived_drafts(self.draft_dir), 1)
        MODULE.validate_draft_bundle(self.draft_dir)

    def test_prepares_pending_review_workbook_that_cannot_export(self) -> None:
        self._collect()
        workbook_dir = self.root / "review-workbook"

        receipt = MODULE.prepare_review_workbook(self.draft_dir, workbook_dir)

        self.assertEqual(receipt["record_count"], 2)
        self.assertEqual(receipt["pending_count"], 2)
        decisions_path = workbook_dir / "review-decisions.jsonl"
        decisions = [
            json.loads(line)
            for line in decisions_path.read_text(encoding="utf-8").splitlines()
            if line
        ]
        self.assertEqual(
            [decision["id"] for decision in decisions],
            ["friendly-capability", "strict-object"],
        )
        self.assertTrue(all(decision["decision"] == "pending" for decision in decisions))
        self.assertTrue(
            all(decision["instruction_following"] == "pending" for decision in decisions)
        )
        self.assertIn("analyze", decisions[0]["reviewed_response"])
        self.assertEqual(
            MODULE.sha256_file(decisions_path), receipt["review_decisions_sha256"]
        )
        context_path = workbook_dir / "review-context.jsonl"
        context = [
            json.loads(line)
            for line in context_path.read_text(encoding="utf-8").splitlines()
            if line
        ]
        self.assertEqual(len(context), 2)
        self.assertEqual(context[0]["id"], "friendly-capability")
        self.assertIn("Hello there", context[0]["prompt"])
        self.assertIn("no more than two sentences", context[0]["response_requirements"][0])
        self.assertEqual(
            context[0]["draft_response_sha256"],
            decisions[0]["draft_response_sha256"],
        )
        self.assertEqual(
            MODULE.sha256_file(context_path), receipt["review_context_sha256"]
        )

        with self.assertRaisesRegex(ValueError, "pending review decisions"):
            MODULE.export_reviewed(
                self.draft_dir, decisions_path, self.root / "reviewed"
            )

        for decision in decisions:
            decision["decision"] = "rejected"
            decision["reviewed_response"] = ""
            decision["reviewer_id"] = "human-reviewer"
            decision["review_note"] = "Reviewed and rejected for this fixture."
        decisions_path.write_text(
            "".join(json.dumps(decision) + "\n" for decision in decisions),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "pending checklist"):
            MODULE.export_reviewed(
                self.draft_dir, decisions_path, self.root / "reviewed"
            )

    def test_rejects_missing_review_decision(self) -> None:
        self._collect()
        decisions = self.root / "review.jsonl"
        decisions.write_text(
            json.dumps(self._decision("friendly-capability", "approved")) + "\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValueError, "review coverage mismatch"):
            MODULE.export_reviewed(self.draft_dir, decisions, self.root / "reviewed")

    def test_rejects_approval_of_truncated_draft(self) -> None:
        self._collect(finish_reason="length")
        decisions = self._write_decisions()

        with self.assertRaisesRegex(ValueError, "truncated teacher draft"):
            MODULE.export_reviewed(self.draft_dir, decisions, self.root / "reviewed")

    def test_rejects_hidden_reasoning_in_reviewed_response(self) -> None:
        self._collect()
        decisions = self.root / "review.jsonl"
        values = [
            self._decision(
                "friendly-capability",
                "approved",
                reviewed_response="<think>private work</think> Hello.",
            ),
            self._decision("strict-object", "rejected"),
        ]
        decisions.write_text(
            "".join(json.dumps(value) + "\n" for value in values), encoding="utf-8"
        )

        with self.assertRaisesRegex(ValueError, "hidden reasoning"):
            MODULE.export_reviewed(self.draft_dir, decisions, self.root / "reviewed")

    def test_reviewed_export_imports_and_passes_rust_freeze(self) -> None:
        self._collect()
        decisions = self._write_decisions()
        reviewed_dir = self.root / "reviewed"
        receipt = MODULE.export_reviewed(self.draft_dir, decisions, reviewed_dir)
        self.assertEqual(receipt["approved_count"], 2)
        self.assertEqual(receipt["rejected_count"], 0)

        student = self.root / "student"
        student.mkdir()
        (student / "model.safetensors").write_bytes(b"student fixture weights")
        (student / "tokenizer.json").write_bytes(b"student fixture tokenizer")
        source = reviewed_dir / "reviewed-teacher-output.jsonl"
        import_control = {
            "schema": "tinyrustlm.distillation_dataset_import.v1",
            "dataset_id": "reviewed-sequence-v1",
            "dataset_license_route": "local-reviewed-license-route-v1",
            "dataset_purpose": "Cross-language reviewed teacher contract test",
            "tokenizer_alignment": "cross-tokenizer-sequence-only",
            "teacher": {
                "model_id": "fixture-local-teacher",
                "revision": "fixture-revision-v1",
                "weight_file": str(self.teacher),
                "tokenizer_identity_file": str(self.teacher),
                "generation_profile": "reviewed-final-answer-v1",
            },
            "student": {
                "model_id": "fixture-student",
                "revision": "fixture-student-revision-v1",
                "model_dir": str(student),
            },
            "sources": [{"path": str(source), "sha256": MODULE.sha256_file(source)}],
        }
        import_control_path = self.root / "import-control.json"
        import_control_path.write_text(json.dumps(import_control), encoding="utf-8")
        dataset_dir = self.root / "dataset"
        DATASET_MODULE.write_dataset(
            DATASET_MODULE.build_dataset_plan(import_control_path), dataset_dir
        )
        frozen = dataset_dir / "distillation-dataset.manifest"
        freeze = subprocess.run(
            [
                "cargo",
                "run",
                "--quiet",
                "-p",
                "tinyrustlm-slm-pack",
                "--",
                "freeze-distillation-dataset",
                str(dataset_dir),
                str(frozen),
                str(self.exclusion),
            ],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        self.assertEqual(freeze.returncode, 0, freeze.stderr)

    def _write_prompt_plan(self) -> None:
        records = [
            {
                "id": "friendly-capability",
                "task_family": "greeting-capability",
                "prompt": "Hello there. Briefly tell me what text work you can assist with.",
                "response_requirements": [
                    "Answer naturally in no more than two sentences.",
                    "Do not claim tools, browsing, or device control.",
                ],
                "max_tokens": 64,
            },
            {
                "id": "strict-object",
                "task_family": "strict-json",
                "prompt": "Return a JSON object describing a queued local note with string keys state and detail.",
                "response_requirements": [
                    "Return one valid JSON object and no surrounding prose.",
                    "Include exactly the requested keys.",
                ],
                "max_tokens": 64,
            },
        ]
        self.prompt_plan.write_text(
            "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
        )

    def _write_control(self) -> Path:
        control = {
            "schema": "tinyrustlm.teacher_draft_collection.v1",
            "campaign_id": "quality-sequence-campaign-v1",
            "source_id": "reviewed-local-teacher-batch-v1",
            "source_license": "UAIX-reviewed-training-output-v1",
            "prompt_plan": {
                "path": str(self.prompt_plan),
                "sha256": MODULE.sha256_file(self.prompt_plan),
            },
            "eval_exclusions": [
                {"path": str(self.exclusion), "sha256": MODULE.sha256_file(self.exclusion)}
            ],
            "teacher": {
                "model_id": "fixture-local-teacher",
                "revision": "fixture-revision-v1",
                "weight_file": str(self.teacher),
                "weight_sha256": MODULE.sha256_file(self.teacher),
                "tokenizer_identity_file": str(self.teacher),
                "tokenizer_identity_sha256": MODULE.sha256_file(self.teacher),
                "license": "Apache-2.0",
                "endpoint": "http://127.0.0.1:1235/v1/chat/completions",
            },
            "generation": {
                "system_prompt_file": str(self.system_prompt),
                "system_prompt_sha256": MODULE.sha256_file(self.system_prompt),
                "temperature": 0.0,
                "top_p": 1.0,
                "top_k": 20,
                "max_tokens": 128,
                "seed": 20260711,
                "timeout_seconds": 30,
            },
        }
        path = self.root / "control.json"
        path.write_text(json.dumps(control, indent=2), encoding="utf-8")
        return path

    def _response(self, content: str, finish_reason: str = "stop") -> bytes:
        return json.dumps(
            {
                "id": "fixture-response",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": finish_reason,
                        "message": {
                            "role": "assistant",
                            "content": content,
                            "reasoning_content": None,
                        },
                    }
                ],
            }
        ).encode("utf-8")

    def _collect(self, finish_reason: str = "stop") -> None:
        def transport(_endpoint: str, payload: bytes, _timeout: int) -> bytes:
            request = json.loads(payload)
            prompt = request["messages"][1]["content"]
            if "JSON object" in prompt:
                content = '{"state":"queued","detail":"stored locally"}'
            else:
                content = "Hello. I can help analyze, explain, summarize, and rewrite text you provide."
            return self._response(content, finish_reason)

        MODULE.collect_drafts(
            MODULE.build_collection_plan(self.control), self.draft_dir, transport
        )

    def _decision(
        self,
        record_id: str,
        decision: str,
        reviewed_response: str | None = None,
    ) -> dict[str, str]:
        manifest = json.loads(
            (self.draft_dir / "teacher-draft-manifest.json").read_text(encoding="utf-8")
        )
        record = next(record for record in manifest["records"] if record["id"] == record_id)
        if decision == "approved" and reviewed_response is None:
            reviewed_response = (self.draft_dir / record["draft_file"]).read_text(
                encoding="utf-8"
            )
        if reviewed_response is None:
            reviewed_response = ""
        status = "pass" if decision == "approved" else "not-applicable"
        return {
            "id": record_id,
            "decision": decision,
            "draft_response_sha256": record["draft_response_sha256"],
            "reviewed_response": reviewed_response,
            "reviewer_id": "tinyrustlm-agent-reviewer",
            "review_note": "Checked against the prompt requirements and local-assistant boundary.",
            "factuality": status,
            "instruction_following": status,
            "safety": status,
            "conciseness": status,
            "hidden_reasoning_absent": status,
        }

    def _write_decisions(self) -> Path:
        decisions = self.root / "review.jsonl"
        values = [
            self._decision("friendly-capability", "approved"),
            self._decision("strict-object", "approved"),
        ]
        decisions.write_text(
            "".join(json.dumps(value) + "\n" for value in values), encoding="utf-8"
        )
        return decisions


if __name__ == "__main__":
    unittest.main()
