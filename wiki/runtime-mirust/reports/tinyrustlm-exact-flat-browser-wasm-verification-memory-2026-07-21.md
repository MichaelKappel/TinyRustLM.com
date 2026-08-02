# TinyRustLM Exact Flat Browser WASM Verification Memory

Date: 2026-07-21 (Pacific); observation recorded 2026-07-22 UTC

## Disposition

The unchanged dependency-free exact f32 retrieval experiment has now executed
inside two real headless Chromium processes, each using a separately created
campaign-owned persistent profile that was closed and physically deleted. This
closes the prior real-browser WASM execution gap for the checked experiment
modules only.

This evidence does not measure browser or native performance, prove
representative retrieval quality, prove crash-recovered durable deletion,
verify a compressed method, establish TurboVec parity, integrate retrieval
into the product, or authorize training or release.

## Preregistered Chain

The rejected v1 preregistration remains immutable at
`tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-preregistration.v1.json`,
SHA-256
`e9ed2d13d975689184d53e4a55cd774fed449cca99372d1e9afc40284569b330`.
It was committed at `a012b9003dc4cc9040733609a2616440d188af9c` and superseded
before browser results because its proposed raw symbol-export boundary
conflicted with the repository's unsafe-symbol prohibition. No v1 browser
result was observed.

The safe v2 preregistration is
`tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-preregistration.v2.json`,
SHA-256
`695f902a12b94024a744ae9bb770a93b5576c0be5a9bf39540a0a9e957f119cd`.
It was committed at `ea27a2d` before execution and binds the existing Rust test
harnesses directly: exactly three import-free WASM modules, 49 expected tests
per run, two independently created persistent profiles, deny-all page-network
policy, `about:blank`, return code zero, exact exports, process closure, and
verified profile deletion.

Its immutable parent remains receipt
`exact-flat-retrieval-75f95baa316315ea`, file SHA-256
`893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c`.

## Implemented Evidence Runner

Commit `cbf1c10bf6a0b6e04b4caacfba73d1dd3b473aba` freezes the
runner and tests before observation. The runner:

- binds all Rust source, workspace manifests, lockfile, preregistrations,
  parent receipt, JavaScript helpers, and tests by SHA-256;
- rejects tracked, unstaged, staged, or source-closure drift;
- hashes the actual Node, Cargo, Rust compiler, Playwright manifest, Chromium
  executable, and generated WASM modules;
- reruns 31 evidence/profile/preregistration tests, 49 native Rust tests,
  strict Clippy, rustdoc, and the WASM test build;
- requires exact `memory`, `main`, `__data_end`, and `__heap_base` exports and
  zero imports;
- applies the preregistered 120-second timeout and deny-all route;
- requires both Chromium process handles to disconnect before deletion counts;
- deletes each owned profile and profile root with marker-bound path checks;
  and
- writes canonical immutable success or redacted failure attempts through
  same-directory atomic creation.

## Observed Facts

The observation at
`tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-observation-v1.json`
was recorded at `2026-07-22T03:01:49.988Z` and committed separately at
`cffd295`. Its identity is
`exact-flat-browser-wasm-0361d72f245abbd3`; its canonical file SHA-256 is
`d28c921ec1df7db538417aaed8803fce88bc6d37b3cbc5fcf5d291b0a91a6f9a`.

The content-addressed pass attempt is
`exact-flat-browser-wasm-attempt-407443d2dd935818`, file SHA-256
`576a71a76a00e6861d3d7bb631cf813a0b860224718603b03b299db7482788bf`.

The observed environment was `win32-x64`, Playwright `1.61.1`, and Chromium
`149.0.7827.55`. The exact modules were:

- unit harness: 40 expected tests, 5,850,272 bytes, SHA-256
  `a7d5de550ade0d409815d1e8a80477a8957dab60246e6a037d77449c8f553d7f`;
- exact-flat black-box harness: eight expected tests, 6,160,796 bytes,
  SHA-256
  `270baf9cd60ea4c83618d69faa5de34748fec971f1dfe40818d18a9b302520cb`;
  and
- clean-room conformance harness: one expected test, 5,393,294 bytes,
  SHA-256
  `3da1004c131641c8a3d67648865a6fd00f3ca6c35cb828ad1fb8f7787c4232d0`.

Across two runs, all six module entry-point calls returned zero. Both browser
processes closed. Both unique profile roots and both unique profiles were
deleted. The runner observed zero page-network requests, zero console errors,
and zero page errors. These are page/runtime observations; they are not an
OS-level packet-capture claim.

## Child Verification Receipt

Commit `0db9268bf27991f45ac7c5106d5ae51061a7ba0b` freezes the child
receipt validator after the immutable observation. The canonical receipt is
`tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json`,
receipt `exact-flat-browser-wasm-verification-8fcdeb0b93534ca4`, file SHA-256
`5c52a2287390f79e6a4971da6a6455a69c4ebd52ac6473bcce5408fd62560157`.

The child reopens and rehashes the preregistration, parent receipt,
observation, sole matching pass attempt, verifier inputs, and Node executable.
Its adversarial tests reject authority inflation, hidden gaps, count drift,
source or file drift, attempt ambiguity, path escape, unknown fields, and
mutation without a new content identity.

## Truth Boundary

The only newly earned authority is
`realBrowserWasmExecutionVerified: true` for these exact experiment bytes and
test harnesses. The receipt explicitly keeps all of the following false:

- native or browser performance measured;
- compressed retrieval verified;
- TurboVec parity verified;
- product integration authorized;
- training authorized; and
- release authorized.

The remaining promotion gaps are:

1. named physical-target latency, throughput, peak memory, and energy;
2. sealed representative-corpus recall, MRR, NDCG, and usefulness; and
3. crash-recovered on-disk deletion and compaction proof.

No model, clean-browser dogfood, MemoryEndpoints, external P2P, catalog,
package, hardware, or release campaign counter advances from this experiment.

## Next Gate

Preregister the named physical target and representative corpus before seeing
their results. Measure the unchanged exact-flat baseline, preserve raw outputs,
and prove durable crash/restart deletion. Only after those baseline gates pass
may a source-pinned compressed comparison arm be preregistered at equal
effective bytes. The experiment remains publish-disabled and removable without
legacy support under the standing pre-release no-debt rule.
