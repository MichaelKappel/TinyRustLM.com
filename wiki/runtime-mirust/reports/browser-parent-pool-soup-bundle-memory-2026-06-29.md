# Browser Parent-Pool Soup Bundle Memory - 2026-06-29

## Purpose

Route future agents to the first generated browser bundle path for a non-sign-merge parent-pool operator. This report covers the `soup` bundle lane that writes `multi-parent-soup-*` models, serves `soup.*` evidence files, and keeps selector, module-plan, assembly, and browser validators bound to the selected operator prefix.

## Implementation

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now has a `BundleOperator` descriptor for `sign-merge` and `soup`.
- `browser-multi-parent-bundle <root> [f32|q8_0|q4_0|all] [sign-merge|soup]` defaults to sign-merge and can generate soup bundles with ids such as `multi-parent-soup-q8`.
- Soup bundles call `soup::write_candidate_path`, then reuse the same multi-parent candidate manifest, promotion, runtime, eval, admission, adapter-family, assembly, and module-plan pipeline.
- Soup evidence files are named `soup.operator`, `soup.candidate`, `soup.promotion`, `soup.runtime`, `soup.eval`, and `soup.multi.admission`.
- Assembly receipts emit `assembly_strategy=multi-parent-weighted-soup` for soup and keep sign-merge receipts at `assembly_strategy=multi-parent-sign-merge`.
- `selector.rs` derives the module-plan evidence family from `module_plan_operator_receipt_path`, currently accepting `sign-merge` and `soup` operator prefixes.
- `tinyrustlm/app/app.js` derives browser assembly evidence route checks from the module-plan/assembly operator receipt path, then recomputes the route-set checksum using that prefix.
- `tinyrustlm/tools/browser-smoke.js` derives multi-parent evidence routes from `multi-parent-soup-*` ids when a soup model is explicitly supplied.
- `tinyrustlm/tools/browser-smoke.js` has a generated multi-parent helper so both `multi-parent-sign-merge-*` and `multi-parent-soup-*` file-backed bundles share eval-proof, parent-pool, selector-registry, module-plan route-set, and adapter-stack checks.
- `tinyrustlm/tools/browser-smoke.js` derives the combined selector family from the requested model key, so `multi-parent-soup-q4 combined-selector-assembly` expects the soup q4/q8/f32 sequence while the default remains sign-merge.

## Browser Smoke Continuation

The q8 soup generated-root smoke path was proven with:

```powershell
cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-soup-q8-check\tinyrustlm q8_0 soup
cargo run -p tinyrustlm-local-server -- target\browser-served-multi-parent-soup-q8-check\tinyrustlm 8097
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8097/app/ 9347 multi-parent-soup-q8 adapter-sidecar-registry-file
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8097/app/ 9349 multi-parent-soup-q8 multi-parent-registry-file
```

The adapter-sidecar smoke proved `multi-parent-soup-q8` model selection, `q8_0` diagnostics, `soup.*` assembly evidence routes, a matching module-plan route-set checksum, 21 generated self-assembly fetches, adapter-family receipt/manifests, and ADP1/ASP1/ALR1 validation before generation. The multi-parent-registry smoke proved the generated selector route requests the expected local q8 soup model, manifest, assembly, evidence, module-plan, and adapter-family files.

The all-quantization soup generated-root smoke path was proven with:

```powershell
cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-soup-all-check\tinyrustlm all soup
cargo run -p tinyrustlm-local-server -- target\browser-served-multi-parent-soup-all-check\tinyrustlm 8098
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8098/app/ 9358 multi-parent-soup-q4 combined-selector-assembly
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8098/app/ 9359 multi-parent-soup-q4 combined-selector-cycle 2
```

The combined-selector smoke proved q4-first frugal default selection with options `multi-parent-soup-f32`, `multi-parent-soup-q8`, and `multi-parent-soup-q4`, then walked q4, q8, and f32 soup entries in one browser session. Each entry reached Ready only after module-plan receipt verification, model/manifest acceptance, `soup.*` evidence verification, adapter-family receipt and manifest verification, ADP1/ASP1/ALR1 validation, three adapter applies, 21 generated self-assembly fetches, matching actual route-set checksum, matching actual module bytes, and matching actual module checksums.

The cycle smoke repeated the soup family twice in one page: q4, q8, f32, q4, q8, and f32. It proved the q4 default, release-before-reassembly after the initial pass, fresh module-plan/model/manifest/evidence/adapter-family/stack route fetches, three Rust validations and three applies per pass, 21 generated self-assembly fetches per pass, and matching actual route-set, module-byte, and module-checksum accounting per pass.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack writes_browser_multi_parent_soup_bundle -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack browser_bundle -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack module_plan -- --nocapture`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-slm-pack`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8097/app/ 9347 multi-parent-soup-q8 adapter-sidecar-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8097/app/ 9349 multi-parent-soup-q8 multi-parent-registry-file`
- `cargo test -p tinyrustlm-slm-pack writes_combined_browser_multi_parent_soup_bundle -- --nocapture`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9358 multi-parent-soup-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9359 multi-parent-soup-q4 combined-selector-cycle 2`

Observed full packer suite result: 291 passed, 0 failed.

## Routing

Open this report before changing:

- `browser-multi-parent-bundle` operator selection.
- Generated evidence filenames for parent-pool operators.
- `module_plan_operator_receipt_path` validation.
- Browser route-set checksum preimages for generated self-assembly.
- Browser assembly receipt validation for sign-merge or soup.

Related memory:

- `wiki/runtime-mirust/reports/weighted-soup-operator-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/multi-parent-soup-manifest-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/browser-module-plan-operator-receipt-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/browser-module-plan-route-set-memory-2026-06-29.md`
