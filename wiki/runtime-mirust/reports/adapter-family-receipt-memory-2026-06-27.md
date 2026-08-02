---
title: Adapter Family Receipt Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/adapter-family-receipt-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T16:25:00Z
---

# Adapter Family Receipt Memory

## Summary

TinyRustLM now gives compatible browser-local adapter families a recomputable receipt and served manifest checks that the browser completes before family options are enabled. `browser-multi-parent-bundle` writes runnable f32/q8_0/q4_0 TinyRustLM roots with app shell, WASM runtime, matching `.adapter-family.receipt` files, generated self ADP1, family ADP1, and sparse ASP1 adapter manifests, and selector metadata; the packer validates that all sidecars share the same adapter identity, including base quantization, and records a receipt path plus checksum in `selector.registry`. `app.js` fetches the served receipt, recomputes its text checksum, fetches each served adapter manifest, matches each member route, manifest route, route-derived format, label, apply status, artifact checksum, manifest checksum, manifest byte count, and shared identity field before showing the family sidecars, then recomputes the selected ADP1/ASP1 artifact checksum before WASM transfer.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` builds and validates format-neutral `browser-local-adapter-family` receipts from registry adapter routes plus adapter manifest files, while accepting the earlier ADP1-specific receipt kind for existing fixtures.
- The receipt requires two to sixteen members, local `../models/*.adp1` or `../models/*.asp1` routes, matching manifest checksums, f32/q8_0/q4_0 runtime apply status, and shared tensor count, parameter count, model shape, output contract, tokenizer checksum, tensor layout checksum, and adapter base contract.
- `tinyrustlm/tools/slm_pack/src/selector.rs` now accepts optional `entry.N.adapter_family_*` fields for f32/q8_0/q4_0 selector entries and validates receipt route, receipt checksum shape, family status, strategy, and adapter count against indexed ADP1/ASP1 routes.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes a runnable browser root by copying the app shell and WASM runtime, writes the served `.adapter-family.receipt`, validates it, then emits one selector-family route alongside generated self ADP1, family ADP1, and sparse ASP1 sidecars.
- `tinyrustlm/app/app.js` route-checks the receipt metadata from `selector.registry`, fetches and checksum-verifies the served receipt, fetches and verifies each served adapter manifest by route extension, matches family members against the registry routes, recomputes the selected artifact checksum before transfer, and still leaves byte parsing and mutation authority inside Rust.
- `tinyrustlm/tools/browser-smoke.js` requires the generated browser smoke network trace to include the matching `.adapter-family.receipt`, both generated `.adp1.manifest` routes, and the generated `.asp1.manifest` route before the registry-supplied family sidecar can pass, and the applied sidecar must match the artifact checksum embedded in the verified metadata.

## Validation Memory

- `cargo fmt --all -- --check` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo test -p tinyrustlm-slm-pack adapter_family` passed with 5 filtered tests.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 19 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed.
- `cargo test -p tinyrustlm-slm-pack` passed with 141 tests.
- `cargo test --workspace` passed with 219 tests.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18640/app/ 9241 tinyf32 adapter-sidecar` passed, applying the checked tiny f32 sidecar after artifact checksum verification.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9240 tinyq8 adapter-sidecar` passed after static q8_0 sidecar routing was added.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9241 tinyq4 adapter-sidecar` passed after static q4_0 sidecar routing was added.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18640/app/ 9242 tinyf32 adapter-sidecar-checksum-mismatch` passed, proving a corrupted sidecar is rejected before `apply_adapter_delta` and prior generation diagnostics remain intact.
- A self-contained generated-root `adapter-sidecar-registry-file` browser smoke passed against `http://127.0.0.1:18642/app/`, loading the real generated selector registry from a packer-written app root, fetching `multi-parent-sign-merge-f32.adapter-family.receipt`, fetching both generated `.adp1.manifest` files, and applying `multi-parent-sign-merge-f32-family.adp1`.
- A focused `adapter-sidecar-registry-q8` browser smoke passed against `http://127.0.0.1:8092/app/`, proving the browser accepts registry metadata for a q8_0 ADP1 route whose apply status matches the selected entry quantization.
- Generated q8_0 and q4_0 roots passed `adapter-sidecar-registry-file`, fetching the matching adapter-family receipt, both adapter manifests, and applying the matching family ADP1 route while preserving the selected quantization mode.
- A later generated-root `adapter-sidecar-registry-file` browser smoke passed after the bundle added sparse ASP1 family members, fetching all three adapter manifests and applying `multi-parent-sign-merge-f32-sparse.asp1`.

## Routing Notes

Use this report before changing `adapter_family.rs`, selector registry `entry.N.adapter_family_*` fields, generated browser bundle ADP1/ASP1 staging, browser registry receipt parsing, browser adapter manifest parsing, or browser adapter artifact checksum verification. The receipt and served manifests are selector assembly proof for compatible f32/q8_0/q4_0 sidecar choices, the selected artifact checksum must match before WASM transfer, and Rust runtime validation still owns package identity and tensor mutation.
