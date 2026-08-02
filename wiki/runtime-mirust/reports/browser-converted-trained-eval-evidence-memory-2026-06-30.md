# Browser Converted Trained Eval Evidence Memory - 2026-06-30

## Route

Use this report when work touches selector-carried converted-trained eval routes, reviewed eval-case route binding, browser pre-model evidence verification, converted-trained browser smoke modes, or case-ledger checksum binding.

## Implementation

Converted-trained browser bundle admissions now append `runtime_smoke_path=../evidence/<candidate-id>/converted-trained.runtime` and `eval_path=../evidence/<candidate-id>/converted-trained.eval` after native eval passes. `selector.registry` preserves those routes as `entry.N.runtime_smoke_path` and `entry.N.eval_path` when each is scoped to the same candidate evidence folder.

The browser selector parser accepts the runtime-smoke route with `runtime_smoke_manifest_checksum`, and the eval route together with `eval_manifest_checksum` and `eval_case_evidence_checksum`. For converted-trained entries that also carry a reviewed source-manifest route, `app.js` fetches `converted-trained.source.manifest`, fetches `converted-trained.source.review`, fetches and checksum-verifies `converted-trained.runtime`, then fetches `converted-trained.eval`, verifies the sidecar text checksum, verifies pass-status and case totals, recomputes the eval-case evidence checksum from the fetched per-case ledger rows, requires the eval sidecar `eval_cases_route` to match the fetched source review's `eval_cases_route`, and only then requests converted `.slm` bytes.

`browser-smoke.js` now serves compact converted-trained runtime and eval sidecars for `converted-trained-registry`, asserts converted-trained roots request runtime evidence before eval evidence and model bytes, adds `converted-trained-runtime-evidence-drift` to prove changed runtime evidence stops before eval and selected q8 model bytes, keeps `converted-trained-eval-evidence-drift` to prove changed eval evidence stops before selected q8 model bytes, and keeps `converted-trained-source-review-eval-route-drift` to prove reviewed eval-route mismatch stops after eval evidence and before q8 bytes.

## Source Files

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`: appends converted-trained runtime-smoke and eval routes to generated admissions, appends the reviewed `eval_cases_route` into review-bound eval sidecars, and tests q8/all selector registry runtime/eval route/checksum fields.
- `tinyrustlm/tools/slm_pack/src/selector.rs`: preserves optional candidate-scoped `runtime_smoke_path` and `eval_path` fields in selector registries and rejects route drift.
- `tinyrustlm/app/app.js`: verifies converted-trained runtime-smoke sidecar text before eval evidence, then recomputes eval-case evidence checksums and compares sidecar `eval_cases_route` to the fetched source review before converted model bytes.
- `tinyrustlm/tools/browser-smoke.js`: serves compact runtime/eval evidence, asserts runtime-before-eval route ordering, and adds runtime-evidence, eval-evidence, and source-review eval-route drift smokes.
- `tinyrustlm/README.md`: documents eval evidence route verification and the new browser-smoke command.
- `tinyrustlm/docs/testing.md`: routes the eval-evidence drift smoke after converted-trained eval route changes.

## Verification

- `cargo test -p tinyrustlm-slm-pack selector --quiet`: 101 tests passed.
- `cargo test -p tinyrustlm-slm-pack browser_bundle --quiet`: 14 tests passed.
- Generated `target/browser-converted-trained-eval-evidence/tinyrustlm` with `browser-converted-trained-bundle ... all`.
- Served the root on `http://127.0.0.1:8097/app/`.
- `converted-trained-registry-file` passed for `converted-trained-q4`, `converted-trained-q8`, and `converted-trained-f32`, with eval evidence requested before selected model bytes.
- `converted-trained-eval-evidence-drift` passed for `converted-trained-q8`, stopping before q8 model bytes.
- `cargo test -p tinyrustlm-slm-pack --quiet`: 361 tests passed.
- `cargo test --workspace --quiet`: passed across all workspace crates.
- `cargo fmt --all -- --check`: passed.
- `node --check tinyrustlm/app/app.js`: passed.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed.
- `git diff --check`: passed with line-ending notices only.
- `node --check tinyrustlm/app/app.js`: passed after reviewed eval-route binding.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed after adding `converted-trained-source-review-eval-route-drift`.
- `cargo test -p tinyrustlm-slm-pack safetensors:: --quiet`: 55 tests passed with generated eval sidecar route assertions.
- `cargo test -p tinyrustlm-slm-pack browser_bundle:: --quiet`: 11 tests passed with reviewed eval-route sidecar binding.
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8097/app/ 9393 converted-trained-q8 converted-trained-registry`: passed with source manifest, source review, eval sidecar, then `.slm` bytes.
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8097/app/ 9394 converted-trained-q8 converted-trained-source-review-eval-route-drift`: passed and stopped at `eval evidence route field eval_cases_route` before q8 bytes.
- Final verification passed: `cargo fmt --all -- --check`, both JS syntax checks, 55 focused safetensors tests, 11 focused browser-bundle tests, full `tinyrustlm-slm-pack` with 402 tests, full workspace tests, static browser harness with 9 checks, the two port-8097 browser smokes, pointer audits 274/0/0 plus wiki 148/0 plus docs intake 11/0, and `git diff --check` with line-ending warnings only.
- Runtime-evidence continuation passed: `cargo fmt --all -- --check`, both JS syntax checks, selector focused tests with 102 passed, browser-bundle focused tests with 11 passed, safetensors focused tests with 55 passed, `converted-trained-registry` on port 8098 with runtime evidence before eval/model bytes, and `converted-trained-runtime-evidence-drift` on port 8098 stopping before eval/model bytes.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter-related coverage is carried by selector tests for candidate id plus runtime/eval path scoping, browser-bundle tests for output root, source directory, quantization selector, eval cases, q8/all route generation, reviewed eval-route sidecar binding, runtime-smoke sidecar route checks, and browser smokes for q4/q8/f32 route selection plus runtime-evidence, eval-evidence, and source-review eval-route drift.

## Next Useful Work

Run a real tiny safetensors checkpoint through `browser-safetensors-trained-bundle ... [eval-cases.txt]`, serve the generated root, and prove source manifest, source review, eval sidecar `eval_cases_route`, selector admission, and converted model bytes all bind to the same checkpoint route.
