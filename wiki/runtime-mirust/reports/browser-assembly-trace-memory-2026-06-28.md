---
title: Browser Assembly Trace Memory
public_route: /runtime-mirust/reports/browser-assembly-trace-memory-2026-06-28/
reviewed_utc: 2026-06-28T01:07:16Z
source_authority: local verified TinyRustLM implementation
status: reviewed_current
---

# Browser Assembly Trace Memory

TinyRustLM now renders a live Module Plan Trace row for generated browser roots. The row is written by browser-side assembly checkpoints, not by parsing model or adapter bytes, and records the actual verified sequence from module-plan receipt acceptance through model load, manifest verification, assembly evidence verification, adapter-family verification, auto-applied adapter stack, and ready state.

The generated-root trace asserted by browser smoke is:

`0: plan verified, 1: model accepted, 2: manifest verified, 3: assembly evidence verified, 4: adapter family verified, 5: adapter stack applied, 6: ready`

This makes self-assembly more inspectable in the constrained browser surface. A future change that skips a stage, leaves stale state after a selector switch, or reaches Ready before the generated adapter stack has applied will break the generated-root smoke assertion.

## Implementation Route

- `tinyrustlm/app/index.html` adds `modulePlanTrace` inside the Module Plan panel.
- `tinyrustlm/app/app.js` resets trace state on each model-load sequence and records checkpoints only after the corresponding verified step completes.
- `tinyrustlm/tools/browser_harness/src/main.rs` treats `modulePlanTrace` as a required static UI id.
- `tinyrustlm/tools/browser-smoke.js` captures and asserts the generated trace in `adapter-sidecar-registry-file` and `combined-selector-assembly`; source-root UI audit expects `unavailable`.
- `tinyrustlm/docs/browser-runtime.md` and `tinyrustlm/docs/testing.md` document the trace as a live browser assembly proof field.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 checks.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-assembly-trace/tinyrustlm all` staged a generated all root.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18744/app/ 19596 multi-parent-sign-merge-q4 combined-selector-assembly` passed and proved q4_0, q8_0, and f32 each render the trace before one-token local generation.

The regenerated all-root receipts produced current module-plan summaries:

- q4_0 bytes: `0: 6592 bytes, 1: 585 bytes, 2: 1849 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`
- q8_0 bytes: `0: 8832 bytes, 1: 585 bytes, 2: 1849 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`
- f32 bytes: `0: 20352 bytes, 1: 586 bytes, 2: 1862 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0xb3f89bf19fb0895a, 2: 0x10c2f412e7751fbd, 3: 0x0571c8fd7c145691, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6`
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0x8f297c2ea011d241, 2: 0x3b94db808395e594, 3: 0x125729a41dd119bd, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb`
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0xd944f90f17c6d61c, 2: 0xcf7cb192a48b5ed3, 3: 0x8ccb2722ee499c66, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c`

## Next Route

Use this report before changing the browser model-load sequence, generated module-plan display, generated auto-assembly stack, or combined-selector assembly smoke. Keep the trace as browser-owned proof of completed checkpoints, while Rust remains the authority for `.slm`, ADP1, and ASP1 validation.
