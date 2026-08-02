# Browser Module Plan Context Token Memory - 2026-06-28

status: current
public_route: /runtime-mirust/reports/browser-module-plan-context-token-memory-2026-06-28/
source_authority: local source, generated bundle, focused Rust tests, and browser smoke

## Route Summary

Generated selector entries and served `.module-plan.receipt` files now bind each model's validated context token limit before generated model bytes load.

## Implemented Shape

- `ValidationReport::context_token_limit()` exposes the validated `.slm` header `max_context`.
- `module_plan_context_token_limit` is emitted in generated selector registries and `.module-plan.receipt` files.
- Selector validation requires the context token limit to be positive, no more than `4096`, and equal to the admitted model shape's `context=` or `ctx=` field.
- Browser registry intake parses the model shape context, carries it on the selected model entry, and requires the selector module plan to match it.
- Browser receipt validation rechecks the served receipt against selector metadata, the model entry, and `max_tokens`.
- The Module Plan panel renders `Context` as `16 tokens`.
- `module-plan-context-token-drift` mutates only the receipt context field while refreshing the selector checksum, then proves browser validation stops before generated `.slm`, manifest, assembly, adapter-family, or stack routes.

## Verified Evidence

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack selector::tests::rejects_module_plan_context_token_limit_drift`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::tests::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-context-token\tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8103/app/ 19590 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8103/app/ 19591 multi-parent-sign-merge-q4 module-plan-context-token-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8103/app/ 19592 multi-parent-sign-merge-q4 module-plan-kv-cache-drift`

## Current Generated Values

- Context: `16 tokens` for generated q4_0, q8_0, and f32 entries.
- q4_0 Total Budget: `103784 bytes`
- q8_0 Total Budget: `106024 bytes`
- f32 Total Budget: `117558 bytes`
- q4_0 Module Checksums: `0: 0x1a6808e3098d1ce0, 1: 0x054f22afda830bf2, 2: 0xe7f7464613e7d1fb, 3: 0x6aa2cfa5d379a3ff, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`

## Next Route

Use this report before changing context-window sizing, tokenizer context limits, selector shape parsing, Module Plan panel resource rows, or browser receipt validation for generated self-assembly.
