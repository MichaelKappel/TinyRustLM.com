---
title: Candidate Operator Receipt Binding Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/candidate-operator-receipt-binding-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T07:40:00Z
---

# Candidate Operator Receipt Binding Memory

TinyRustLM two-parent candidate manifests can now optionally bind the exact operator receipt that produced the candidate `.slm`.

## What Changed

- `tinyrustlm/tools/slm_pack/src/candidate.rs` keeps existing unbound `candidate-manifest` behavior while adding optional producer receipt binding.
- `candidate-manifest <input.compat> <input.lineage> <candidate.slm> <output.candidate> [input.operator]` reads the receipt, validates its identity fields against lineage and candidate bytes, and writes recomputable receipt fields into the candidate manifest.
- `validate-candidate <input.compat> <input.lineage> <candidate.slm> <input.candidate> [input.operator]` recomputes the receipt binding when the optional receipt is supplied.
- Bound manifests do not validate without the referenced receipt input; unbound manifests remain valid on the existing path.

## Manifest Fields

- `operator_receipt_status=receipt-bound`
- `operator_receipt_path=<input.operator>`
- `operator_receipt_checksum=<text-checksum>`
- `operator_receipt_operator_id=<operator_id>`
- `operator_receipt_operator_kind=<operator_kind>`
- `operator_receipt_candidate_slm_checksum=<candidate_slm_checksum>`
- `operator_receipt_candidate_artifact_bytes=<candidate_artifact_bytes>`

## Validation Boundaries

- The receipt `candidate_id` must match lineage `candidate_id`.
- The receipt `operator_id` must match lineage `operator_id`.
- The receipt `candidate_slm_checksum` must match the validated candidate `.slm`.
- The receipt `candidate_artifact_bytes` must match the validated candidate byte count.
- The manifest receipt checksum must match the supplied receipt text, including comment-preserving drift.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml candidate -- --nocapture` passed with 50 focused candidate and neighboring operator tests.
- CLI smoke wrote `target/candidate-operator-binding/parents.compat`.
- CLI smoke wrote `target/candidate-operator-binding/candidate.lineage`.
- CLI smoke wrote `target/candidate-operator-binding/candidate.slm` and `target/candidate-operator-binding/candidate.operator` through `mutation-candidate`.
- CLI smoke validated the mutation receipt with `validate-mutation-candidate`.
- CLI smoke wrote `target/candidate-operator-binding/candidate.candidate` through receipt-bound `candidate-manifest`.
- CLI smoke validated the receipt-bound candidate manifest with `validate-candidate`.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml -- --nocapture` passed with 257 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace` passed with browser harness, local server, runtime, and slm_pack tests.
- `git diff --check` exited 0 with line-ending notices only.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused receipt-binding happy path, path-parameter coverage, drift rejection tests, full packer suite, workspace suite, formatting, and CLI write/validate smoke.

## Test Coverage Notes

- `operator_receipt: Option<&Path>` is covered by path-level unbound and bound write/validate tests.
- `operator_receipt.path` is covered by manifest field assertions and CLI emitted path inspection.
- `operator_receipt.text` is covered by checksum drift rejection.
- Candidate checksum and byte-count receipt fields are covered by build-time rejection tests.
- Bound-manifest validation without the receipt input is covered by an explicit rejection test.

## Routing

Open this report before changing `candidate.rs`, `candidate-manifest`, `validate-candidate`, two-parent operator receipt fields, or downstream promotion assumptions about two-parent candidate provenance.
