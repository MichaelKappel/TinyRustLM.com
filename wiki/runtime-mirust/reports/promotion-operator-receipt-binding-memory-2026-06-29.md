---
title: Promotion Operator Receipt Binding Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/promotion-operator-receipt-binding-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T08:15:00Z
---

# Promotion Operator Receipt Binding Memory

TinyRustLM two-parent promotion templates can now carry the candidate manifest's producer receipt binding forward into the promotion record.

## What Changed

- `tinyrustlm/tools/slm_pack/src/promotion.rs` keeps existing unbound promotion behavior while adding receipt-aware template and validation paths.
- `promotion-template <input.compat> <input.lineage> <candidate.slm> <input.candidate> <output.promotion> [promoter-id] [promotion-scope] [input.operator]` reads the optional receipt and requires it when the candidate manifest is receipt-bound.
- `validate-promotion <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> [input.operator]` recomputes candidate and receipt binding before accepting the promotion record.
- Receipt-bound candidate manifests without the receipt input do not validate through promotion; unbound candidate manifests and unbound promotions keep the existing path.

## Promotion Fields

- `operator_receipt_status=receipt-bound`
- `operator_receipt_path=<input.operator>`
- `operator_receipt_checksum=<text-checksum>`
- `operator_receipt_operator_id=<operator_id>`
- `operator_receipt_operator_kind=<operator_kind>`
- `operator_receipt_candidate_slm_checksum=<candidate_slm_checksum>`
- `operator_receipt_candidate_artifact_bytes=<candidate_artifact_bytes>`

## Validation Boundaries

- Promotion validation first recomputes the candidate manifest binding against compatibility, lineage, candidate bytes, and optional operator receipt text.
- Bound promotion fields must exactly match the candidate manifest's receipt fields.
- Unbound candidate manifests cannot be paired with stray `operator_receipt_*` promotion fields.
- Receipt checksum drift, missing receipt input, and candidate artifact drift are rejected before promotion can advance to runtime smoke and eval sidecars.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml candidate -- --nocapture` passed with 50 focused candidate and neighboring operator tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml promotion -- --nocapture` passed with 15 focused promotion and neighboring ledger tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` passed with 261 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe build --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` rebuilt the CLI binary.
- CLI smoke wrote and validated compatibility, lineage, mutation candidate, operator receipt, receipt-bound candidate manifest, receipt-bound promotion template, and receipt-bound promotion validation under `C:\Users\AI\AppData\Local\Temp\tinyrustlm-promotion-cli-7b5f19ad0c7848139d9c7cbcfd0a5b69\`.
- CLI smoke inspected `candidate.promotion` and found `operator_receipt_status=receipt-bound`, `operator_receipt_checksum=0x8164c5a20346a815`, and `operator_receipt_operator_kind=deterministic-bounded-parameter-mutation`.
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace` passed with browser harness, local server, runtime, slm_pack, and doc-test checks.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused happy path, path-parameter coverage, receipt drift rejection, missing receipt rejection, full packer suite, workspace suite, build, formatting, and CLI write/validate smoke.

## Test Coverage Notes

- `operator_receipt: Option<&Path>` is covered by a path-level promotion template write and validation test.
- `operator_receipt` text binding is covered by receipt-bound template and validation text tests.
- `operator_receipt_checksum` is covered by promotion checksum drift rejection.
- Missing receipt input for a bound candidate and promotion is covered by explicit rejection.
- Existing unbound promotion tests continue to cover default promoter id, promotion scope, candidate drift, manifest drift, and promotion overclaim behavior.

## Routing

Open this report before changing `promotion.rs`, `promotion-template`, `validate-promotion`, candidate receipt carry-forward, promotion gate behavior, or downstream admission assumptions about two-parent candidate provenance.
