# Browser Converted Trained Source Identity Memory - 2026-06-30

## Route

Use this report when work touches converted-trained source-manifest snapshots, safetensors browser bundle provenance, selector-carried source identity fields, browser pre-model source verification, heritable artifact identity, or converted-trained source drift browser smokes.

## Implementation

Converted-trained browser bundle staging now parses the copied reviewed `source.manifest` snapshot and appends `source_manifest_source_kind`, `source_manifest_source_id`, and `source_manifest_model_shape` to each selector admission beside the existing source manifest route and checksum fields.

`selector.registry` preserves those source identity fields for converted-trained entries, validates the source kind as `trained-source-fixture` or `trained-export`, validates the source id and source model shape as registry-safe slugs, and folds the identity into the heritable artifact id digest. Registry validation rebuilds the expected selector text from the admission, so source identity drift in the registry is detected like other selector field drift.

`app.js` now parses the selector-carried source identity and, after fetching and checksum-verifying `converted-trained.source.manifest`, verifies that the fetched `source_kind`, `source_id`, and `model_shape` match the selector entry before fetching converted `.slm` bytes. This binds safetensors-generated converted models to the reviewed checkpoint-derived source route rather than only to a source manifest checksum.

`browser-smoke.js` adds `converted-trained-source-identity-drift`, which serves source manifest bytes whose checksum matches the selector while the fetched `source_id` differs from selector metadata. The smoke proves the browser stops at the source manifest route and does not request the selected converted model bytes.

## Source Files

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`: extracts source identity from copied source snapshots and appends source identity fields to converted-trained admissions.
- `tinyrustlm/tools/slm_pack/src/selector.rs`: preserves and validates source identity fields, rejects source identity drift, and includes source identity in heritable artifact ids.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs`: asserts safetensors browser bundles carry `trained-export`, `safetensors-tensor-directory-0x...`, and `tiny-fixture` source identity fields.
- `tinyrustlm/app/app.js`: verifies fetched source snapshot identity before converted model bytes.
- `tinyrustlm/tools/browser-smoke.js`: adds the checksum-matched source identity drift browser smoke.
- `tinyrustlm/README.md` and `tinyrustlm/docs/testing.md`: document source identity fields and the new smoke route.

## Verification

- `cargo fmt --all`: passed.
- `node --check tinyrustlm/app/app.js`: passed.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed.
- `cargo test -p tinyrustlm-slm-pack selector --quiet`: 102 tests passed.
- `cargo test -p tinyrustlm-slm-pack browser_bundle --quiet`: 14 tests passed.
- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`: 24 tests passed.
- Local server on `http://127.0.0.1:8098/app/`.
- `converted-trained-registry` passed for `converted-trained-q8`.
- `converted-trained-source-identity-drift` passed for `converted-trained-q8`, with `source manifest identity field source_id was tinyrustlm-local-source-drift` and no converted model byte request.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter-related coverage is carried by selector tests for candidate id, source path, source checksum, source id, and eval path fields; browser-bundle tests for output root, source directory, quantization selector, eval cases, q8/all route generation, and source identity fields; safetensors tests for input path, target shape, output source directory, browser root, quantization selector, and safetensors source identity fields; and browser smokes for positive converted-trained q8 routing plus checksum-matched source identity drift before model bytes.

## Next Useful Work

Run a real tiny safetensors checkpoint through `browser-safetensors-trained-bundle ... [eval-cases.txt]`, serve the generated root, and prove source manifest identity, eval sidecar, selector admission, and converted model bytes all bind to the same checkpoint route across q4_0, q8_0, and f32 selector entries.
