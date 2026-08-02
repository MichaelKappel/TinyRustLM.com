# TinyRustLM Explicit Human Review Workstation

Updated UTC: 2026-07-12T14:25:56Z

## Decision

The 668-record Qwen3.6 teacher corpus remains outside training authority until a
human explicitly resolves every record. Raw JSONL is retained as the canonical
portable format, but it is no longer the normal review interface. Reviewers use
a separate loopback-only workstation that places immutable evidence and one
strict decision form side by side. The locked public TinyRustLM interface is not
changed or reused for this operational workflow.

## Implementation

- `tinyrustlm/tools/human-review-workstation.py` is a Python-standard-library
  server bound only to `127.0.0.1` with an unpredictable per-process session
  capability in both the URL and API header.
- `tinyrustlm/tools/human-review-workstation/` contains self-hosted HTML, CSS,
  and JavaScript. It makes no remote request and loads no third-party asset.
- The browser presents the prompt, response contract, original draft, candidate,
  agent rationale and tags, automated findings, semantic references, and exact
  source hashes. Queue search, pending/resolved filters, previous/next movement,
  and save-and-next keep the 668-record pass practical.
- The decision form requires an explicit `approve`, `rewrite`, or `reject`, all
  five checklist outcomes, a stable reviewer slug, and a bounded evidence note.
  There is no bulk approval, pass-all control, inferred action, or inferred
  checklist result.
- Approval preserves the candidate exactly. Rewrite requires distinct trimmed
  text. Rejection stores no training response and requires at least one failed
  checklist field.
- Each save changes one row only. It validates the whole handoff, validates the
  proposed row with the merger's exact contract, compares the current batch
  decision-file SHA-256 with the browser's expected value, flushes a temporary
  file in the same directory, preserves file mode, atomically replaces the
  decision file, and validates the resulting handoff again.
- Stale tabs receive HTTP 409 and cannot silently overwrite a newer decision.
  Immutable review batches are never written.
- Defensive HTTP controls include loopback Host and Origin checks, bounded JSON
  bodies, no CORS, no request logging, `no-store`, `nosniff`, frame denial,
  same-origin isolation, a self-only content security policy, and no persisted
  credential. Reviewer ID convenience uses only `sessionStorage`.
- `human_review_progress_report` is now a reusable in-memory projection shared
  by the workstation and durable progress writer. It rejects malformed resolved
  rows and partially edited pending rows before every workstation operation.

## Test Evidence

- Six workstation contract tests pass. They cover explicit single-row save,
  immutable evidence preservation, atomic temp cleanup, stale-write rejection,
  invalid-checklist rejection, exact pending reset, session-protected HTTP,
  defensive headers, authorized save, stale HTTP replay, local-only assets, and
  absence of bulk approval.
- The complete Python tool suite passes 107 of 107 tests in the pinned Python
  3.12 training environment.
- Python bytecode compilation and `node --check` pass.
- A 1440 by 1000 Chromium run loaded all three columns from the real handoff and
  was visually inspected after the loading-state correction.
- Chromium device metrics at 390 by 844 report `innerWidth=390`, document and
  body scroll widths of 390, zero horizontally overflowing elements, hidden
  loading state, visible evidence, and three enabled action controls.
- A second 390 by 844 interaction probe selected Rewrite, enabled the response
  and all checklist fields, completed a valid local form, enabled Save and
  Reset, and still reported zero horizontal overflow. The probe did not submit
  a request.

## Current Corpus State

Validated workstation startup against
`D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-handoff-v1-668`
took 0.718 seconds on the current machine. The read-only check returned:

- records: 668
- batches: 27
- pending: 668
- resolved: 0
- ready for merge: false
- decision-set SHA-256:
  `60200e1fa19eda367a0cf0690d60706693f419b75f7c70d783642623d176d716`

This matches the pristine pre-workstation decision identity. Browser and HTTP
verification changed no production review row.

## Operating Route

```powershell
$python = 'D:/LLMs/TinyRustLM/training-env-py312/Scripts/python.exe'
& $python tinyrustlm/tools/human-review-workstation.py `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-handoff-v1-668
```

Stop with `Ctrl+C`. After each real review session, run
`triage-distillation-review.py --audit-human-review` into a new versioned output
directory. The live workstation progress display is not a durable receipt and
has `training_authority=false`. Final merge still fails closed until pending is
zero; merge output must then pass per-campaign export, corpus, contamination,
provenance, duplication, semantic, training, conversion, and browser gates.

## Next Gate

The workstation removes the mechanical review bottleneck; it does not replace
human judgment. The next work is the actual explicit review of all 668 records,
with versioned text-free checkpoints. Only after that may the approved corpus be
merged, exported, frozen, trained, and compared against the footprint-aware
quality gates.
