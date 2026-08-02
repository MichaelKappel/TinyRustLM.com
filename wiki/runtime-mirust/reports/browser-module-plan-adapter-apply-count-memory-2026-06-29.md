# Browser Module Plan Adapter Apply Count Memory - 2026-06-29

status: reviewed_current
authority: generated from current implementation and verification evidence

## Summary

Generated module-plan selector entries and served `.module-plan.receipt` files now bind `module_plan_adapter_apply_count=3` for the ADP1/ASP1/ALR1 auto-assembly stack. The browser verifies selector, receipt, adapter-family stack count, and runtime diagnostics agreement, renders the Module Plan `Apply Count` row, and rejects count drift before generated model bytes or stack artifacts are fetched.

## Implementation Route

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, checksums, and validates `entry.N.module_plan_adapter_apply_count`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` derives `module_plan_adapter_apply_count` from the generated auto-apply stack and writes it into generated `.module-plan.receipt` files and selector route records.
- `tinyrustlm/app/index.html` adds the Module Plan `Apply Count` row.
- `tinyrustlm/app/app.js` validates selector and receipt agreement, requires the count to match the adapter-family auto-apply stack, and compares runtime `adapter_apply_count` diagnostics after generated stack assembly.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-adapter-apply-count-drift`, asserts generated roots render `3`, asserts source roots render `unavailable`, and refreshes q4_0/q8_0/f32 module-plan byte/checksum summaries after the new receipt field.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the new row id in the static UI contract.

## Verified Behavior

- `cargo test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml module_plan_adapter -- --nocapture` passed, including `rejects_module_plan_adapter_apply_count_drift`.
- `cargo test --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml` passed with 6 tests.
- `cargo test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml browser_bundle::tests:: -- --nocapture` passed with 4 tests.
- `node --check tinyrustlm/app/app.js` and `node --check tinyrustlm/tools/browser-smoke.js` passed.
- Generated q4_0, q8_0, and f32 roots refreshed module-plan expected totals and module checksums after adding the receipt line.
- Generated-root `module-plan-adapter-apply-count-drift` passed on `http://127.0.0.1:8242/app/`, returning `Module plan adapter apply count mismatch` after selector plus module-plan receipt requests and before generated model routes.
- Fresh generated all-root `combined-selector-assembly` passed on `http://127.0.0.1:8252/app/` with q4_0 default, q8_0 switch, and f32 switch; each entry rendered Apply Count `3`, reported runtime `adapter_apply_count=3`, carried nonzero adapter and assembly checksums, and generated after ADP1 plus ASP1 plus ALR1 stack apply.
- `cargo test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` passed with 223 tests.

## Current Positive Proof

The positive generated browser assembly proof is current as of `2026-06-29T02:30:52Z`: `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8252/app/ 9353 multi-parent-sign-merge-q4 combined-selector-assembly` exited 0 against `target/goal-combined-assembly-proof/tinyrustlm`.

## Routing Notes

Open this report before changing generated adapter-stack cardinality, selector registry module-plan count metadata, Module Plan `Apply Count` display, runtime `adapter_apply_count` diagnostics checks, or `module-plan-adapter-apply-count-drift` smoke assertions. Keep this field separate from `adapter_auto_apply_stack_count`: the family receipt says what stack is preferred, while the module plan says how many adapter mutations the generated assembly must complete before generation.
