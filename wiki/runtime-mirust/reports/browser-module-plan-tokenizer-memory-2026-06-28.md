# Browser Module Plan Tokenizer Memory - 2026-06-28

status: current
public_route: /runtime-mirust/reports/browser-module-plan-tokenizer-memory-2026-06-28/
source_authority: local source, generated bundle, focused Rust tests, and browser smoke

## Route Summary

Generated selector entries and served `.module-plan.receipt` files now bind tokenizer checksum identity before generated model bytes load.

## Implemented Shape

- `module_plan_tokenizer_checksum` is emitted in generated selector registries and `.module-plan.receipt` files.
- Selector validation requires the module-plan tokenizer checksum to match the admitted model tokenizer checksum.
- Browser registry intake carries the selector tokenizer checksum on each generated entry.
- Browser receipt validation rechecks the served receipt tokenizer checksum against selector metadata before generated `.slm` fetch.
- Genome, species-fit, and species checksum generation include tokenizer identity where the candidate route needs it.
- The Module Plan panel renders `Tokenizer` as the verified checksum value for generated roots and keeps source-root fallback as `unavailable`.
- `module-plan-tokenizer-drift` mutates only the receipt tokenizer checksum while refreshing the selector checksum, then proves browser validation stops before generated `.slm`, manifest, assembly, adapter-family, or stack routes.

## Verified Evidence

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack selector::tests::rejects_module_plan_tokenizer_checksum_drift`
- `cargo test -p tinyrustlm-slm-pack selector::tests::writes_and_validates_selector_registry_with_module_plan_receipt`
- `cargo test -p tinyrustlm-slm-pack selector::tests::`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::tests::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-tokenizer\tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8104/app/ 19584 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8104/app/ 19586 multi-parent-sign-merge-q4 module-plan-tokenizer-drift`

## Current Generated Values

- Tokenizer checksum: `0x288f65d94c26743e` for generated q4_0, q8_0, and f32 entries.
- q4_0 Total Budget: `103780 bytes`
- q8_0 Total Budget: `106020 bytes`
- f32 Total Budget: `117554 bytes`
- q4_0 Module Checksums: `0: 0x1a6808e3098d1ce0, 1: 0xd1b3d62daec1c2a3, 2: 0x3431b665f2a7ba7e, 3: 0x51845f58d5fa3279, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`

## Coverage Note

No coverage tool is active in the no-third-party workspace; focused parameter tests, Rust tests, static harness checks, generated-root proof, and browser-smoke evidence were recorded against the 75% target.

## Next Route

Use this report before changing tokenizer identity, selector tokenizer fields, generated genome/species checksum ingredients, Module Plan panel tokenizer rows, or browser receipt validation for generated self-assembly.
