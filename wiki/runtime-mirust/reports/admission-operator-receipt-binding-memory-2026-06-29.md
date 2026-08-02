---
title: Admission Operator Receipt Binding Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/admission-operator-receipt-binding-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T09:05:00Z
---

# Admission Operator Receipt Binding Memory

TinyRustLM two-parent selector admission records can now carry the candidate's producer receipt binding through the final selector-admission gate.

## What Changed

- `tinyrustlm/tools/slm_pack/src/admission.rs` keeps existing unbound admission behavior while adding receipt-aware record and validation paths.
- `admission-record <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> <input.manifest> <input.runtime> <input.eval> <output.admission> [selector-id] [input.operator]` reads the optional operator receipt and requires it when candidate/promotion evidence is receipt-bound.
- `validate-admission <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> <input.manifest> <input.runtime> <input.eval> <input.admission> [input.operator]` recomputes candidate, promotion, runtime, eval, and admission evidence before accepting the selector-facing record.
- Receipt-bound admissions copy the promotion's `operator_receipt_*` fields, and admission summary validation now recognizes those fields for selector-facing intake.

## Admission Fields

- `operator_receipt_status=receipt-bound`
- `operator_receipt_path=<input.operator>`
- `operator_receipt_checksum=<text-checksum>`
- `operator_receipt_operator_id=<operator_id>`
- `operator_receipt_operator_kind=<operator_kind>`
- `operator_receipt_candidate_slm_checksum=<candidate_slm_checksum>`
- `operator_receipt_candidate_artifact_bytes=<candidate_artifact_bytes>`

## Validation Boundaries

- Admission validation recomputes the receipt-bound candidate manifest and promotion before runtime-smoke, eval, and selector-admission fields are accepted.
- Bound admission fields must exactly match the validated promotion's receipt fields.
- Bound evidence without the receipt input does not produce or validate an admission.
- Admission summary validation checks the receipt status, receipt checksum, candidate checksum, byte count, operator id, and operator kind when receipt fields are present.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml admission -- --nocapture` passed with 21 focused admission and neighboring selector/ledger tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` passed with 265 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe build --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` rebuilt the CLI.
- CLI smoke wrote and validated compatibility, lineage, mutation candidate, operator receipt, receipt-bound candidate manifest, receipt-bound promotion, provenance manifest, runtime-smoke sidecar, passing eval sidecar, receipt-bound admission record, and receipt-bound admission validation under `C:\Users\AI\AppData\Local\Temp\tinyrustlm-admission-cli-ce1a4e394bb948f5b0be53862c1d9dfc\`.
- CLI smoke inspected `candidate.admission` and found `operator_receipt_status=receipt-bound`, `operator_receipt_checksum=0x4c8ea6e30f7cf736`, and `operator_receipt_operator_kind=deterministic-bounded-parameter-mutation`.
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace` passed with browser harness, local server, runtime, slm_pack, and doc-test checks.
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check` passed.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is focused happy-path coverage, path-parameter coverage, missing receipt rejection, admission receipt drift rejection, summary validation coverage, full packer suite, workspace suite, build, formatting, and CLI write/validate smoke.

## Test Coverage Notes

- `operator_receipt: Option<&Path>` is covered by a path-level admission record write and validation test.
- `operator_receipt` text binding is covered by receipt-bound record and validation text tests.
- `operator_receipt_checksum` is covered by admission checksum drift rejection.
- Missing receipt input for bound evidence is covered by explicit rejection.
- Admission summary validation covers receipt-bound fields so selector-facing summary parsing has a local field-shape gate.
- Existing unbound admission tests continue to cover runtime-smoke drift, eval drift, selector id validation, overclaim rejection, and case-total validation.

## Routing

Open this report before changing `admission.rs`, `admission-record`, `validate-admission`, two-parent receipt-bound selector admission fields, or selector intake assumptions about admission provenance.
