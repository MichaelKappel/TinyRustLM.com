# Browser Converted-Trained All Route Memory - 2026-06-29

## Route

- Source route: `tinyrustlm-slm-pack browser-converted-trained-bundle`
- Browser route: `browser-smoke converted-trained-registry-file`
- Generated root: `target/browser-converted-trained-all-20260629/tinyrustlm`
- Primary files: `models/selector.registry`, `models/converted-trained-f32.slm`, `models/converted-trained-q8.slm`, `models/converted-trained-q4.slm`, matching `.slm.manifest` files, and `evidence/converted-trained-*/*`

## What Changed

`browser-converted-trained-bundle <root> <source-dir> [f32|q8_0|q4_0|all]` can now stage all converted trained-source quantizations into one runnable TinyRustLM root. The `all` path converts the reviewed trained-source directory to f32, q8_0, and q4_0 `.slm` artifacts, writes each provenance manifest, writes compatibility, lineage, candidate, promotion, runtime, eval, and admission sidecars per candidate, then writes and validates one `models/selector.registry` across all three admissions.

The selector registry keeps `selector_default_strategy=browser-frugal-quantized`, `selector_default_candidate_id=converted-trained-q4`, and `selector_default_quantization=q4_0`. The browser smoke harness now knows the converted-trained f32/q8/q4 model keys and validates the selected entry without requiring the registry to contain only one option.

## Verification

- `cargo fmt --all`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-slm-pack writes_all_browser_converted_trained_bundle_from_source`
- `cargo test -p tinyrustlm-slm-pack writes_browser_converted_trained_bundle_from_source`
- `cargo test -p tinyrustlm-slm-pack rejects_browser_converted_trained_bundle_unknown_quantization`
- `cargo run -p tinyrustlm-slm-pack -- browser-converted-trained-bundle .\target\browser-converted-trained-all-20260629\tinyrustlm .\tinyrustlm\tests\fixtures\trained-source-tiny all`
- `cargo run -p tinyrustlm-local-server -- .\target\browser-converted-trained-all-20260629\tinyrustlm 8099`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9291 converted-trained-q4 converted-trained-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9292 converted-trained-q8 converted-trained-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9293 converted-trained-f32 converted-trained-registry-file`
- `cargo test -p tinyrustlm-slm-pack`

## Result

The generated selector has three entries and defaults to `converted-trained-q4`. The q4, q8, and f32 browser smokes each generated `e`, reported the matching active quantization mode, fetched `/models/selector.registry`, fetched the selected converted-trained `.slm`, fetched the selected `.slm.manifest`, and rendered converted-trained provenance source, admission, quality, trained-claim, and next-gate fields.

This proves reviewed trained-source weights can now be served as a local q4/q8/f32 selector set through the same browser-local route used by generated selector roots. Product assistant-quality claims remain tied to future task evidence beyond this route proof.

## Open Next

- Add real trained source weights after a reviewed source manifest exists.
- Keep converted-trained all roots q4-defaulted when selector frugality is desired.
- Extend converted-trained browser proof toward richer module-plan or adapter-family routes only after those sidecars have typed evidence.
