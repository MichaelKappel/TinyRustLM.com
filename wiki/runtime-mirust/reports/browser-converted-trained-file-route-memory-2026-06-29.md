# Browser Converted-Trained File Route Memory - 2026-06-29

## Route

- Source route: `tinyrustlm-slm-pack browser-converted-trained-bundle`
- Browser route: `browser-smoke converted-trained-registry-file`
- Generated root: `target/browser-converted-trained-file-20260629/tinyrustlm`
- Primary files: `models/selector.registry`, `models/converted-trained-q8.slm`, `models/converted-trained-q8.slm.manifest`, and `evidence/converted-trained-q8/*`

## What Changed

The converted-trained browser path now has a file-backed route. `browser-converted-trained-bundle <root> <source-dir> [f32|q8_0|q4_0]` copies the app shell and WASM runtime, converts a reviewed trained-source directory into a served `.slm`, validates its provenance manifest, writes compatibility, lineage, candidate, promotion, runtime, eval, and admission sidecars, then writes and validates `models/selector.registry`.

The browser smoke tool now accepts `converted-trained-registry-file`. That mode selects `converted-trained-q8` from a real served registry and verifies the browser fetches the registry, converted `.slm`, and converted `.slm.manifest` routes while rendering converted-trained source, admission, quality boundary, and pending trained-claim fields.

## Verification

- `cargo fmt --all`
- `cargo fmt --all -- --check`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::tests::writes_browser_converted_trained_bundle_from_source`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::tests::rejects_browser_converted_trained_bundle_unknown_quantization`
- `cargo test -p tinyrustlm-slm-pack selector::tests::display_name_labels_converted_trained_source_entries`
- `cargo run -p tinyrustlm-slm-pack -- browser-converted-trained-bundle .\target\browser-converted-trained-file-20260629\tinyrustlm .\tinyrustlm\tests\fixtures\trained-source-tiny q8_0`
- `cargo run -p tinyrustlm-local-server -- .\target\browser-converted-trained-file-20260629\tinyrustlm 8096`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8096/app/ 9290 converted-trained-q8 converted-trained-registry-file`
- `cargo test -p tinyrustlm-slm-pack`
- `git diff --check`

## Result

The file-backed smoke selected `converted-trained-q8`, generated `e`, and fetched `/models/selector.registry`, `/models/converted-trained-q8.slm`, and `/models/converted-trained-q8.slm.manifest` from the served root. The Model Provenance panel showed source `converted-trained`, selector admission `structure-accepted-quality-pending`, quality `runtime-compatible-not-quality-verified`, trained claim `pending-evaluation`, and model option label `Converted trained-source q8_0`.

This proves the converted trained-source artifact can move through the same local selector, model, manifest, and browser provenance path as other served candidates. Broader assistant-quality claims remain bound to later task evidence beyond this file-route proof.

## Open Next

- Add real trained source weights after a reviewed source manifest exists.
- Repeat this file-backed route for f32 and q4_0 when those served converted roots are ready.
- Keep converted-trained selector entries on local `../models/*.slm` routes with matching manifests and admission sidecars.
