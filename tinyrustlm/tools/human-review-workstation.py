"""Loopback-only workstation for explicit TinyRustLM corpus review.

This tool edits only the decision JSONL files in a prepared human-review
handoff. Immutable prompts, responses, hashes, and agent evidence continue to
be validated by ``triage-distillation-review.py`` before every read and write.
"""

from __future__ import annotations

import argparse
import importlib.util
import ipaddress
import json
import os
import secrets
import sys
import tempfile
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import unquote, urlsplit


MAX_REQUEST_BYTES = 1024 * 1024 + 64 * 1024
SESSION_HEADER = "X-TinyRustLM-Review-Session"
DECISION_PAYLOAD_KEYS = {
    "action",
    "reviewedResponse",
    "reviewerId",
    "reviewNote",
    "checklist",
}


class ReviewConflictError(RuntimeError):
    """Raised when a decision file changed after the browser loaded it."""


class ReviewRecordNotFoundError(LookupError):
    """Raised when a handoff does not contain the requested record."""


def load_triage_module() -> ModuleType:
    script = Path(__file__).with_name("triage-distillation-review.py")
    name = "tinyrustlm_review_triage_workstation_runtime"
    spec = importlib.util.spec_from_file_location(name, script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load review validator: {script}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ReviewStore:
    """Validated, conflict-safe access to one human-review handoff."""

    def __init__(self, handoff: Path, triage: ModuleType) -> None:
        self._handoff = handoff.resolve()
        self._triage = triage
        self._lock = threading.RLock()
        self._load_state()

    def summary(self) -> dict[str, Any]:
        with self._lock:
            state = self._load_state()
            progress = self._progress(state)
            records = []
            for batch, decisions in zip(state.expected_batches, state.decision_rows):
                for review, decision in zip(batch["review_rows"], decisions):
                    records.append(
                        {
                            "id": review["id"],
                            "batchId": review["batch_id"],
                            "batchIndex": review["batch_index"],
                            "recordIndex": review["record_index"],
                            "campaignId": review["campaign_id"],
                            "taskFamily": review["task_family"],
                            "priority": review["priority"],
                            "priorityScore": review["priority_score"],
                            "candidateAction": review["candidate_action"],
                            "candidateOrigin": review["candidate_origin"],
                            "action": decision["action"],
                            "riskFlagCount": len(review["risk_flags"]),
                            "contractFindingCount": len(review["contract_findings"]),
                            "semanticClusterCount": len(review["semantic_clusters"]),
                        }
                    )
            return {"progress": progress, "records": records}

    def get_record(self, record_id: str) -> dict[str, Any]:
        with self._lock:
            state = self._load_state()
            return self._record_payload(state, record_id)

    def save_decision(
        self,
        record_id: str,
        expected_decision_file_sha256: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock:
            state = self._load_state()
            batch_index, row_index, review, _decision, answer = self._locate(
                state, record_id
            )
            self._require_expected_sha256(
                state, batch_index, expected_decision_file_sha256
            )
            decision = self._completed_decision(review, answer, payload)
            self._replace_row(
                state,
                batch_index,
                row_index,
                expected_decision_file_sha256,
                decision,
            )
            updated = self._load_state()
            return self._record_payload(updated, record_id)

    def reset_decision(
        self, record_id: str, expected_decision_file_sha256: str
    ) -> dict[str, Any]:
        with self._lock:
            state = self._load_state()
            batch_index, row_index, review, _decision, _answer = self._locate(
                state, record_id
            )
            self._require_expected_sha256(
                state, batch_index, expected_decision_file_sha256
            )
            pending = self._triage.human_review_decision_template(review)
            self._triage.validate_human_review_decision_binding(pending, review)
            self._replace_row(
                state,
                batch_index,
                row_index,
                expected_decision_file_sha256,
                pending,
            )
            updated = self._load_state()
            return self._record_payload(updated, record_id)

    def _load_state(self) -> Any:
        state = self._triage.load_human_review_handoff_state(self._handoff)
        # The loader verifies immutable bindings and coverage; the progress
        # projection additionally rejects malformed completed or half-edited
        # pending rows. Every operation therefore starts from a valid corpus.
        self._triage.human_review_progress_report(state)
        return state

    def _progress(self, state: Any) -> dict[str, Any]:
        report = self._triage.human_review_progress_report(state)
        return {
            "status": report["status"],
            "record_count": report["record_count"],
            "batch_count": report["batch_count"],
            "pending_count": report["pending_count"],
            "approved_count": report["approved_count"],
            "rewritten_count": report["rewritten_count"],
            "rejected_count": report["rejected_count"],
            "resolved_count": report["resolved_count"],
            "completion_ratio": report["completion_ratio"],
            "ready_for_merge": report["ready_for_merge"],
            "current_decision_set_sha256": report[
                "current_decision_set_sha256"
            ],
        }

    def _record_payload(self, state: Any, record_id: str) -> dict[str, Any]:
        batch_index, row_index, review, decision, _answer = self._locate(
            state, record_id
        )
        descriptor = state.manifest["batches"][batch_index]
        absolute_index = sum(
            len(batch["review_rows"])
            for batch in state.expected_batches[:batch_index]
        ) + row_index
        return {
            "review": review,
            "decision": decision,
            "batch": {
                "batchId": descriptor["batch_id"],
                "batchIndex": descriptor["batch_index"],
                "recordCount": descriptor["record_count"],
                "reviewFile": descriptor["review_file"],
                "decisionFile": descriptor["decision_file"],
            },
            "position": absolute_index + 1,
            "decisionFileSha256": state.decision_sha256s[batch_index],
            "progress": self._progress(state),
        }

    def _locate(
        self, state: Any, record_id: str
    ) -> tuple[int, int, dict[str, Any], dict[str, Any], Any]:
        if not isinstance(record_id, str) or not record_id or "\0" in record_id:
            raise ReviewRecordNotFoundError("review record was not found")
        answer_by_id = {answer.record_id: answer for answer in state.answers}
        for batch_index, (batch, decisions) in enumerate(
            zip(state.expected_batches, state.decision_rows)
        ):
            for row_index, (review, decision) in enumerate(
                zip(batch["review_rows"], decisions)
            ):
                if review["id"] == record_id:
                    return (
                        batch_index,
                        row_index,
                        review,
                        decision,
                        answer_by_id[record_id],
                    )
        raise ReviewRecordNotFoundError("review record was not found")

    def _completed_decision(
        self, review: dict[str, Any], answer: Any, payload: dict[str, Any]
    ) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ValueError("decision payload must be an object")
        missing = sorted(DECISION_PAYLOAD_KEYS - set(payload))
        unknown = sorted(set(payload) - DECISION_PAYLOAD_KEYS)
        if missing or unknown:
            raise ValueError(
                f"decision payload key mismatch; missing={missing}; unknown={unknown}"
            )
        checklist = payload["checklist"]
        if not isinstance(checklist, dict):
            raise ValueError("decision checklist must be an object")
        checklist_keys = set(self._triage.PENDING_FIELDS)
        missing = sorted(checklist_keys - set(checklist))
        unknown = sorted(set(checklist) - checklist_keys)
        if missing or unknown:
            raise ValueError(
                f"decision checklist key mismatch; missing={missing}; unknown={unknown}"
            )

        decision = self._triage.human_review_decision_template(review)
        decision.update(
            {
                "action": payload["action"],
                "reviewed_response": payload["reviewedResponse"],
                "reviewer_id": payload["reviewerId"],
                "review_note": payload["reviewNote"],
                **{field: checklist[field] for field in self._triage.PENDING_FIELDS},
            }
        )
        self._triage.validate_completed_human_review_decision(
            decision, review, answer
        )
        return decision

    def _require_expected_sha256(
        self, state: Any, batch_index: int, expected_sha256: str
    ) -> None:
        if expected_sha256 != state.decision_sha256s[batch_index]:
            raise ReviewConflictError(
                "decision file changed; reload this record before saving"
            )

    def _replace_row(
        self,
        state: Any,
        batch_index: int,
        row_index: int,
        expected_sha256: str,
        replacement: dict[str, Any],
    ) -> None:
        descriptor = state.manifest["batches"][batch_index]
        decision_path = self._triage.safe_workbook_file(
            state.handoff,
            descriptor["decision_file"],
            "human review decision file",
        )
        if not decision_path.is_file() or decision_path.is_symlink():
            raise ValueError("human review decision file must remain a regular file")
        original_mode = decision_path.stat().st_mode
        if self._triage.sha256_file(decision_path) != expected_sha256:
            raise ReviewConflictError(
                "decision file changed; reload this record before saving"
            )

        rows = [dict(row) for row in state.decision_rows[batch_index]]
        rows[row_index] = replacement
        serialized = self._triage.jsonl_bytes(rows)
        descriptor_handle, temporary_name = tempfile.mkstemp(
            prefix=f".{decision_path.name}.tmp-", dir=decision_path.parent
        )
        temporary_path = Path(temporary_name)
        try:
            with os.fdopen(descriptor_handle, "wb") as stream:
                stream.write(serialized)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temporary_path, original_mode)
            if not decision_path.is_file() or decision_path.is_symlink():
                raise ReviewConflictError(
                    "decision file changed; reload this record before saving"
                )
            if self._triage.sha256_file(decision_path) != expected_sha256:
                raise ReviewConflictError(
                    "decision file changed; reload this record before saving"
                )
            os.replace(temporary_path, decision_path)
            self._sync_directory(decision_path.parent)
        finally:
            if temporary_path.exists():
                temporary_path.unlink()

    @staticmethod
    def _sync_directory(directory: Path) -> None:
        if os.name == "nt":
            return
        descriptor = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def _is_loopback_host(raw_host: str | None) -> bool:
    if not raw_host:
        return False
    try:
        parsed = urlsplit(f"//{raw_host}")
        hostname = parsed.hostname
        if hostname is None:
            return False
        if hostname.casefold() == "localhost":
            return True
        return ipaddress.ip_address(hostname).is_loopback
    except (ValueError, ipaddress.AddressValueError):
        return False


def make_review_handler(
    store: ReviewStore, session_token: str, asset_dir: Path
) -> type[BaseHTTPRequestHandler]:
    """Create an isolated HTTP handler bound to one store and session token."""

    assets = asset_dir.resolve()
    if not assets.is_dir() or assets.is_symlink():
        raise ValueError(f"workstation asset directory is invalid: {assets}")
    token_prefix = f"/s/{session_token}"

    class ReviewHandler(BaseHTTPRequestHandler):
        server_version = "TinyRustLMReview/1.0"
        sys_version = ""

        def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            if not self._valid_host():
                self._json(400, {"error": "invalid_host"})
                return
            path = urlsplit(self.path).path
            if path == token_prefix:
                self.send_response(307)
                self._defensive_headers()
                self.send_header("Location", token_prefix + "/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if path == token_prefix + "/":
                self._asset("index.html", "text/html; charset=utf-8")
                return
            if path == token_prefix + "/app.js":
                self._asset("app.js", "text/javascript; charset=utf-8")
                return
            if path == token_prefix + "/styles.css":
                self._asset("styles.css", "text/css; charset=utf-8")
                return
            if not path.startswith(token_prefix + "/api/"):
                self._json(404, {"error": "not_found"})
                return
            if not self._authorized():
                self._json(404, {"error": "not_found"})
                return
            try:
                if path == token_prefix + "/api/state":
                    self._json(200, store.summary())
                    return
                record_id = self._record_id(path, suffix="")
                self._json(200, store.get_record(record_id))
            except ReviewRecordNotFoundError:
                self._json(404, {"error": "record_not_found"})
            except ValueError:
                self._json(409, {"error": "handoff_validation_failed"})
            except Exception:
                self._json(500, {"error": "internal_error"})

        def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            if not self._valid_host() or not self._valid_origin():
                self._json(400, {"error": "invalid_request_origin"})
                return
            path = urlsplit(self.path).path
            if not path.startswith(token_prefix + "/api/") or not self._authorized():
                self._json(404, {"error": "not_found"})
                return
            try:
                body = self._request_json()
                if path.endswith("/decision"):
                    self._require_keys(
                        body,
                        {"expectedDecisionFileSha256", "decision"},
                        "save request",
                    )
                    record_id = self._record_id(path, suffix="/decision")
                    result = store.save_decision(
                        record_id,
                        body["expectedDecisionFileSha256"],
                        body["decision"],
                    )
                elif path.endswith("/reset"):
                    self._require_keys(
                        body, {"expectedDecisionFileSha256"}, "reset request"
                    )
                    record_id = self._record_id(path, suffix="/reset")
                    result = store.reset_decision(
                        record_id, body["expectedDecisionFileSha256"]
                    )
                else:
                    self._json(404, {"error": "not_found"})
                    return
                self._json(200, result)
            except ReviewConflictError as error:
                self._json(409, {"error": "conflict", "message": str(error)})
            except ReviewRecordNotFoundError:
                self._json(404, {"error": "record_not_found"})
            except (ValueError, json.JSONDecodeError) as error:
                self._json(400, {"error": "invalid_decision", "message": str(error)})
            except Exception:
                self._json(500, {"error": "internal_error"})

        def do_HEAD(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            self._json(405, {"error": "method_not_allowed"}, include_body=False)

        def log_message(self, _format: str, *args: Any) -> None:
            # URLs contain a local session capability and review IDs; never log them.
            return

        def _valid_host(self) -> bool:
            return _is_loopback_host(self.headers.get("Host"))

        def _valid_origin(self) -> bool:
            raw_origin = self.headers.get("Origin")
            if raw_origin is None:
                return True
            try:
                origin = urlsplit(raw_origin)
            except ValueError:
                return False
            return (
                origin.scheme == "http"
                and _is_loopback_host(origin.netloc)
                and origin.netloc.casefold()
                == (self.headers.get("Host") or "").casefold()
            )

        def _authorized(self) -> bool:
            supplied = self.headers.get(SESSION_HEADER, "")
            return secrets.compare_digest(supplied, session_token)

        def _record_id(self, path: str, suffix: str) -> str:
            prefix = token_prefix + "/api/records/"
            if not path.startswith(prefix):
                raise ReviewRecordNotFoundError("review record was not found")
            encoded = path[len(prefix) :]
            if suffix:
                if not encoded.endswith(suffix):
                    raise ReviewRecordNotFoundError("review record was not found")
                encoded = encoded[: -len(suffix)]
            if not encoded or "/" in encoded:
                raise ReviewRecordNotFoundError("review record was not found")
            record_id = unquote(encoded)
            if not record_id or len(record_id) > 1024 or "\0" in record_id:
                raise ReviewRecordNotFoundError("review record was not found")
            return record_id

        def _request_json(self) -> dict[str, Any]:
            if self.headers.get("Transfer-Encoding"):
                raise ValueError("chunked request bodies are unsupported")
            if self.headers.get_content_type() != "application/json":
                raise ValueError("request content type must be application/json")
            raw_length = self.headers.get("Content-Length")
            if raw_length is None:
                raise ValueError("request content length is required")
            try:
                length = int(raw_length)
            except ValueError as error:
                raise ValueError("request content length is invalid") from error
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("request body exceeds the allowed length")
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(value, dict):
                raise ValueError("request body must be a JSON object")
            return value

        @staticmethod
        def _require_keys(
            value: dict[str, Any], expected: set[str], label: str
        ) -> None:
            missing = sorted(expected - set(value))
            unknown = sorted(set(value) - expected)
            if missing or unknown:
                raise ValueError(
                    f"{label} key mismatch; missing={missing}; unknown={unknown}"
                )

        def _asset(self, name: str, content_type: str) -> None:
            path = assets / name
            if path.parent != assets or not path.is_file() or path.is_symlink():
                self._json(404, {"error": "not_found"})
                return
            self._bytes(200, path.read_bytes(), content_type)

        def _json(
            self, status: int, value: dict[str, Any], include_body: bool = True
        ) -> None:
            payload = json.dumps(
                value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            ).encode("utf-8")
            self._bytes(
                status,
                payload,
                "application/json; charset=utf-8",
                include_body=include_body,
            )

        def _bytes(
            self,
            status: int,
            payload: bytes,
            content_type: str,
            include_body: bool = True,
        ) -> None:
            self.send_response(status)
            self._defensive_headers()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if include_body:
                self.wfile.write(payload)

        def _defensive_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            self.send_header("Pragma", "no-cache")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header(
                "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
            )
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "img-src 'self' data:; connect-src 'self'; font-src 'none'; "
                "object-src 'none'; base-uri 'none'; form-action 'none'; "
                "frame-ancestors 'none'",
            )

    return ReviewHandler


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the loopback-only TinyRustLM human-review workstation."
    )
    parser.add_argument(
        "handoff", type=Path, help="Prepared human-review handoff directory"
    )
    parser.add_argument(
        "--port", type=int, default=0, help="Loopback port; 0 selects an open port"
    )
    parser.add_argument(
        "--no-open", action="store_true", help="Do not open the default browser"
    )
    args = parser.parse_args(argv)
    if args.port < 0 or args.port > 65535:
        parser.error("--port must be between 0 and 65535")
    return args


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    triage = load_triage_module()
    store = ReviewStore(args.handoff, triage)
    session_token = secrets.token_urlsafe(32)
    assets = Path(__file__).with_name("human-review-workstation")
    handler = make_review_handler(store, session_token, assets)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    server.daemon_threads = True
    url = f"http://127.0.0.1:{server.server_port}/s/{session_token}/"
    print("TinyRustLM explicit human-review workstation")
    print(f"Review URL: {url}")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        webbrowser.open(url, new=2)
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
