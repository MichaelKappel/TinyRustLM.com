"""Contract tests for the loopback-only TinyRustLM review workstation."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path


TOOLS = Path(__file__).resolve().parents[1]
TRIAGE_SCRIPT = TOOLS / "triage-distillation-review.py"
WORKSTATION_SCRIPT = TOOLS / "human-review-workstation.py"
ASSET_DIR = TOOLS / "human-review-workstation"


def load_script(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class HumanReviewWorkstationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.triage = load_script("tinyrustlm_review_triage_workstation_tests", TRIAGE_SCRIPT)
        cls.workstation = load_script("tinyrustlm_human_review_workstation_tests", WORKSTATION_SCRIPT)

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="tinyrustlm-review-workstation-")
        self.root = Path(self._temporary.name)
        self.handoff = self._write_handoff()
        self.store = self.workstation.ReviewStore(self.handoff, self.triage)

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_store_saves_one_explicit_decision_and_preserves_evidence(self) -> None:
        summary = self.store.summary()
        self.assertEqual(summary["progress"]["pending_count"], 3)
        self.assertEqual(summary["progress"]["resolved_count"], 0)
        self.assertEqual(len(summary["records"]), 3)

        current = self.store.get_record("approve-me")
        batch = current["batch"]
        review_path = self.handoff / batch["reviewFile"]
        evidence_sha256 = self.triage.sha256_file(review_path)
        payload = self._valid_payload(
            "approve", current["review"]["candidate_response"]
        )

        saved = self.store.save_decision(
            "approve-me", current["decisionFileSha256"], payload
        )

        self.assertEqual(saved["decision"]["action"], "approve")
        self.assertEqual(saved["progress"]["resolved_count"], 1)
        self.assertEqual(saved["progress"]["approved_count"], 1)
        self.assertEqual(saved["progress"]["pending_count"], 2)
        self.assertEqual(self.triage.sha256_file(review_path), evidence_sha256)
        self.assertFalse(list(self.handoff.glob(".decision-batch-*.tmp-*")))

        reloaded = self.workstation.ReviewStore(self.handoff, self.triage)
        self.assertEqual(reloaded.get_record("approve-me")["decision"]["action"], "approve")

    def test_store_rejects_stale_or_invalid_writes_without_mutation(self) -> None:
        current = self.store.get_record("approve-me")
        decision_path = self.handoff / current["batch"]["decisionFile"]
        before = decision_path.read_bytes()
        payload = self._valid_payload(
            "approve", current["review"]["candidate_response"]
        )

        with self.assertRaisesRegex(
            self.workstation.ReviewConflictError, "decision file changed"
        ):
            self.store.save_decision(
                "approve-me", "sha256:" + "0" * 64, payload
            )
        self.assertEqual(decision_path.read_bytes(), before)

        payload["checklist"]["factuality"] = "not-applicable"
        with self.assertRaisesRegex(ValueError, "must pass every checklist field"):
            self.store.save_decision(
                "approve-me", current["decisionFileSha256"], payload
            )
        self.assertEqual(decision_path.read_bytes(), before)

    def test_store_can_explicitly_reset_a_resolved_row_to_pristine_pending(self) -> None:
        current = self.store.get_record("rewrite-me")
        payload = self._valid_payload(
            "rewrite", "Use the independently checked action."
        )
        saved = self.store.save_decision(
            "rewrite-me", current["decisionFileSha256"], payload
        )
        self.assertEqual(saved["progress"]["resolved_count"], 1)

        reset = self.store.reset_decision(
            "rewrite-me", saved["decisionFileSha256"]
        )

        self.assertEqual(reset["decision"]["action"], "pending")
        self.assertEqual(reset["decision"]["reviewer_id"], "pending-reviewer")
        self.assertEqual(reset["progress"]["resolved_count"], 0)
        self.assertEqual(reset["progress"]["pending_count"], 3)

    def test_http_surface_requires_session_and_sets_defensive_headers(self) -> None:
        token = "test-session-token-1234567890"
        handler = self.workstation.make_review_handler(self.store, token, ASSET_DIR)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with self.assertRaises(urllib.error.HTTPError) as missing:
                urllib.request.urlopen(f"{base}/s/not-the-token/api/state", timeout=5)
            self.assertEqual(missing.exception.code, 404)

            request = urllib.request.Request(
                f"{base}/s/{token}/api/state",
                headers={"X-TinyRustLM-Review-Session": token},
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                payload = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["Cache-Control"], "no-store")
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
            self.assertEqual(payload["progress"]["record_count"], 3)

            with urllib.request.urlopen(f"{base}/s/{token}/", timeout=5) as response:
                page = response.read().decode("utf-8")
                self.assertEqual(response.status, 200)
            self.assertIn("TinyRustLM Review", page)
            self.assertNotIn("http://", page)
            self.assertNotIn("https://", page)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_http_save_is_session_bound_and_rejects_a_stale_replay(self) -> None:
        token = "test-save-session-token-1234567890"
        handler = self.workstation.make_review_handler(self.store, token, ASSET_DIR)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}/s/{token}"
        current = self.store.get_record("approve-me")
        request_body = json.dumps(
            {
                "expectedDecisionFileSha256": current["decisionFileSha256"],
                "decision": self._valid_payload(
                    "approve", current["review"]["candidate_response"]
                ),
            }
        ).encode("utf-8")
        try:
            unauthorized = urllib.request.Request(
                f"{base}/api/records/approve-me/decision",
                data=request_body,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with self.assertRaises(urllib.error.HTTPError) as missing:
                urllib.request.urlopen(unauthorized, timeout=5)
            self.assertEqual(missing.exception.code, 404)
            self.assertEqual(
                self.store.get_record("approve-me")["decision"]["action"],
                "pending",
            )

            authorized = urllib.request.Request(
                f"{base}/api/records/approve-me/decision",
                data=request_body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-TinyRustLM-Review-Session": token,
                },
            )
            with urllib.request.urlopen(authorized, timeout=5) as response:
                saved = json.loads(response.read())
            self.assertEqual(saved["decision"]["action"], "approve")
            self.assertEqual(saved["progress"]["resolved_count"], 1)

            stale = urllib.request.Request(
                f"{base}/api/records/approve-me/decision",
                data=request_body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-TinyRustLM-Review-Session": token,
                },
            )
            with self.assertRaises(urllib.error.HTTPError) as conflict:
                urllib.request.urlopen(stale, timeout=5)
            self.assertEqual(conflict.exception.code, 409)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_static_assets_are_local_and_offer_no_bulk_approval(self) -> None:
        for name in ("index.html", "app.js", "styles.css"):
            text = (ASSET_DIR / name).read_text(encoding="utf-8")
            self.assertNotIn("https://", text)
            self.assertNotIn("http://", text)
            self.assertNotIn("approve all", text.casefold())
            self.assertNotIn("bulk approve", text.casefold())
        html = (ASSET_DIR / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="app.js"', html)
        self.assertIn('href="styles.css"', html)
        self.assertNotIn("<script>", html)
        self.assertNotIn("style=", html)

    def _write_handoff(self) -> Path:
        contexts = [
            self._context(
                "approve-me",
                "Give one grounded action.",
                "Use the grounded action.",
            ),
            self._context(
                "rewrite-me",
                "Give one independently checked action.",
                "Use the draft action.",
            ),
            self._context(
                "pending-me",
                "Give one action that still needs review.",
                "Use the pending action.",
            ),
        ]
        source = self._write_workbook("workstation-source", contexts)
        suggestions = self.root / "workstation-suggestions.jsonl"
        suggestions.write_text(
            json.dumps(
                {
                    "schema": "tinyrustlm.teacher_review_suggestion.v1",
                    "id": "approve-me",
                    "draft_response_sha256": contexts[0]["draft_response_sha256"],
                    "action": "rewrite",
                    "proposed_response": "Use the independently grounded action.",
                    "rationale": "Make the evidence boundary explicit.",
                    "evidence_tags": ["prompt-contract", "agent-review"],
                    "agent_id": "tinyrustlm-agent",
                    "confidence": "high",
                },
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        assisted = self.root / "workstation-assisted"
        self.triage.write_suggested_review(source, suggestions, assisted)
        handoff = self.root / "workstation-handoff"
        self.triage.write_human_review_handoff((assisted,), handoff, 2)
        return handoff

    def _context(self, record_id: str, prompt: str, response: str) -> dict[str, object]:
        return {
            "schema": "tinyrustlm.teacher_review_context_record.v1",
            "id": record_id,
            "task_family": "practical-judgment",
            "prompt": prompt,
            "response_requirements": ["Answer directly."],
            "max_tokens": 128,
            "seed": 42,
            "request_sha256": "sha256:" + "1" * 64,
            "finish_reason": "stop",
            "draft_response": response,
            "draft_response_sha256": self.triage.sha256_bytes(response.encode("utf-8")),
        }

    def _write_workbook(
        self, campaign_id: str, contexts: list[dict[str, object]]
    ) -> Path:
        workbook = self.root / campaign_id
        workbook.mkdir()
        manifest = workbook / "teacher-draft-manifest.json"
        manifest.write_text(
            json.dumps({"campaign_id": campaign_id, "record_count": len(contexts)})
            + "\n",
            encoding="utf-8",
        )
        context_path = workbook / "review-context.jsonl"
        context_path.write_text(
            "".join(json.dumps(value, sort_keys=True) + "\n" for value in contexts),
            encoding="utf-8",
        )
        decisions = [
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
            for context in contexts
        ]
        decisions_path = workbook / "review-decisions.jsonl"
        decisions_path.write_text(
            "".join(json.dumps(value, sort_keys=True) + "\n" for value in decisions),
            encoding="utf-8",
        )
        receipt = {
            "schema": "tinyrustlm.teacher_review_workbook_receipt.v2",
            "campaign_id": campaign_id,
            "draft_manifest_path": str(manifest),
            "draft_manifest_sha256": self.triage.sha256_file(manifest),
            "review_decisions_file": decisions_path.name,
            "review_decisions_sha256": self.triage.sha256_file(decisions_path),
            "review_context_file": context_path.name,
            "review_context_sha256": self.triage.sha256_file(context_path),
            "record_count": len(contexts),
            "pending_count": len(contexts),
            "status": "pending-explicit-record-review-not-training-approved",
            "required_next_gate": "resolve-every-pending-review-decision",
        }
        (workbook / "review-workbook-receipt.json").write_text(
            json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        return workbook

    @staticmethod
    def _valid_payload(action: str, reviewed_response: str) -> dict[str, object]:
        return {
            "action": action,
            "reviewedResponse": reviewed_response,
            "reviewerId": "alice-reviewer",
            "reviewNote": "Explicit review completed against the response contract.",
            "checklist": {
                "factuality": "pass",
                "instruction_following": "pass",
                "safety": "pass",
                "conciseness": "pass",
                "hidden_reasoning_absent": "pass",
            },
        }


if __name__ == "__main__":
    unittest.main()
