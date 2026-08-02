# Selector Operator Receipt Binding Memory 2026-06-29

## Summary

TinyRustLM selector registries now preserve the full two-parent operator receipt family when a selector admission record carries `operator_receipt_status=receipt-bound`. This keeps candidate and promotion receipt identity visible after the admission-to-registry handoff.

## Implemented Boundary

- `tinyrustlm/tools/slm_pack/src/selector.rs` copies receipt-bound admission fields into selector entries as `entry.N.operator_receipt_*`.
- The copied fields include status, path, checksum, operator id, operator kind, candidate `.slm` checksum, and candidate artifact byte count.
- Registry validation recomputes the expected entry from the admission text and rejects drift in any copied receipt field.
- Multi-parent admissions now also emit the full receipt-bound field family, so generated sign-merge and soup entries can render the same browser Operator row as two-parent receipt-bound admissions.
- `entry.N.mate_selection_checksum` now includes the copied operator receipt family when present.
- `tinyrustlm/app/app.js` parses optional selector receipt metadata, validates candidate checksum and byte equality, stores it on the selected model, and renders a compact Model Provenance Operator row.
- `tinyrustlm/app/index.html` adds the Operator row, and the Rust browser harness checks the new DOM id.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm\tools\slm_pack\Cargo.toml selector::tests::writes_and_validates_selector_registry_from_operator_receipt_bound_admission -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm\tools\slm_pack\Cargo.toml selector::tests::rejects_selector_registry_operator_receipt_field_drift -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm\tools\slm_pack\Cargo.toml selector::tests:: -- --nocapture` passed with 82 selector tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm\tools\slm_pack\Cargo.toml` passed with 267 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe build --manifest-path tinyrustlm\tools\slm_pack\Cargo.toml` passed.
- `node --check tinyrustlm\app\app.js` passed.
- `node --check tinyrustlm\tools\browser-smoke.js` passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm\tools\browser_harness\Cargo.toml -- --nocapture` passed with 6 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe run --manifest-path tinyrustlm\tools\browser_harness\Cargo.toml -- tinyrustlm` passed with 9 checks.
- Receipt-bound q8 CLI smoke passed through compatibility, lineage, mutation, candidate manifest, promotion, manifest, runtime smoke, assistant-quality eval, admission, selector-registry, and validate-selector-registry under `C:\Users\AI\AppData\Local\Temp\tinyrustlm-selector-receipt-4acd025a5de0418dbc54c0ffe6c91350`.

## Test Coverage Notes

No coverage tool is active in this no-third-party workspace. Focused selector tests cover the receipt-bound admission input, copied selector fields, candidate checksum equality, candidate byte equality, registry validation, and copied-field drift rejection against the 75% coverage target.

## Routing

Load this report before changing `selector-registry`, `validate-selector-registry`, selector provenance fields, Model Provenance Operator rendering, mate-selection checksum inputs, or assumptions about receipt-bound admissions reaching browser selector entries. For generated multi-parent browser proof, also load `browser-multi-parent-operator-provenance-memory-2026-06-29.md`.
