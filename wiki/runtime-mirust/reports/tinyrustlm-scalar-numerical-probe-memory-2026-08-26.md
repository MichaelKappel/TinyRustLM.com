# TinyRustLM Scalar Numerical Probe Memory

Date: 2026-08-26
Status: implementation checkpoint; full standard gate green; clean release gate pending; real-model execution not registered or performed

## Purpose

This is the durable resume node for the first numerical work after the closed
Qwen3 composition execution `/12`. It records what was implemented, what the
returned post-`/10` research changed, the exact claim boundary, and the next
ordered work. It is not a numerical-parity receipt, model-quality receipt,
browser receipt, release receipt, or campaign receipt.

TinyRustLM remains one unversioned prelaunch product. SLM2, Tokenizer2, and
operation suffixes such as `/12` are technical identities, not product
generations. No legacy reader, compatibility path, migration, alias, shim,
fallback runtime, hidden retry, response repair, best-of-N selection, or known
code debt is authorized.

## Authoritative Inputs

The numerical probe is downstream of the immutable structural result:

- `contracts/vnext/qwen3-real-composition-execution-result.v12.json`
  - 18,441 bytes
  - SHA-256 `0c3e84ad9ce6e22d9a164357c9a900d31825d0639f4f11077dab305f9cf3ef0e`
- `wiki/runtime-mirust/reports/tinyrustlm-qwen3-composition-v12-structural-pass-memory-2026-08-26.md`
  - 11,584 bytes
  - SHA-256 `2a1c2882b9368d0ebd45fe96b9689406d5fcbfd941b4b2a5b39868da5cb3e1cf`
- `/12` composition identity
  - ten files totaling 605,429,565 bytes
  - `model.slm2` is 598,308,416 bytes
  - `model.slm2` SHA-256 is
    `a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7`
  - structural pass proves no numerical, browser, behavioral, P2P, catalog,
    package, deployment, or campaign result

The reviewed returned-report intake is advisory design input:

- `docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md`
  - 6,217 bytes
  - SHA-256 `1ac4c18cf017b14112663d2f05d8b06f5c381d3503aa9415b22866a442b3f6c0`
- `docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md`
  - 22,182 bytes
  - SHA-256 `bb538fa12ca2ea623732570d2ec175eb4287223d80c31c05c71b018c41e7b7a0`
- `docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md`
  - 19,012 bytes
  - SHA-256 `298dad938ee508ca57aa0beede3e462a68ef82dafa8fa258181e4402b6c55cb2`
- `wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md`
  - 9,545 bytes
  - SHA-256 `f9e604aaf9f247f0773574d26ec024123c25512ecccd5feacc752ddb53f7bdd3`

Raw reports remain research, not project facts or execution evidence. The
manifest establishes custody; the corrected synthesis records accepted,
modified, deferred, and rejected conclusions; the TDD delta maps accepted
conclusions to tests and ordered implementation. Continuations should enter
through those reviewed nodes rather than treating a report assertion as an
implemented contract.

## Implemented Checkpoint

One non-shipping leaf executable now creates bounded private scalar traces:

- profile: `contracts/vnext/scalar-numerical-probe-profile.v1.json`
  - 9,660 bytes
  - SHA-256 `34b1bd8f45dcd764b4b78850fa0a54b740ca143bde14a201a7c7f2ef0b46f000`
- design: `docs/architecture/2026-08-26-scalar-numerical-probe.md`
  - 6,059 bytes
  - SHA-256 `f0f2340a2da008db972575ea28ea24f5d267dbbc5b9654268466300f08e7c3ac`
- crate manifest:
  `rust/crates/tinyrustlm-numerical-probe/Cargo.toml`
  - 446 bytes
  - SHA-256 `ec1a57603862296427c5be71d196b1a45af358f4bf87eb165f9d279dc224a125`
- owner: `rust/crates/tinyrustlm-numerical-probe/src/main.rs`
  - 32,262 bytes
  - SHA-256 `6a0b8ba79f885af82fcf04a9f6657acb30ce384abe53f31ab125ca9b286f3446`
- contract test: `tinyrustlm/tests/scalar-numerical-probe-profile.test.js`
  - 4,548 bytes
  - SHA-256 `533189f6f5656f4ae0aad233f5a2e24d9988a5743636fe614576e296e0a059a7`

The executable imports `tinyrustlm-runtime` and calls the existing
`ScalarSession::forward_token_traced` path. It does not define a second model
reader, quantization interpretation, sampler, shipping runtime, or production
fallback. Production code cannot dispatch to it.

## Enforced Probe Contract

The request is strict canonical pretty UTF-8 JSON with one final LF. Unknown
fields, duplicate fields, explicit nulls, alternate formatting or field order,
and trailing bytes fail before output creation. It binds the operation ID,
public `/12` result identity, exact composition root, exact model length and
streamed SHA-256, existing evidence parent, absent output root, trace profile,
hard resource ceilings, and private token-ID cases.

Before output creation the probe verifies:

1. request type, byte ceiling, strict schema, and canonical bytes;
2. profile, identifier, policy, case, and token closure;
3. source, evidence-parent, and direct-child output boundaries;
4. output-root absence;
5. model regular-file type, length, and streamed SHA-256;
6. complete independent SLM2 validation; and
7. scalar model, KV-cache, scratch, and trace admission.

Every case starts with a new scalar session. Every registered token is
executed once. Output is create-only. Failure after output-root creation leaves
partial bytes intact and never writes `probe.json`. There is no overwrite,
resume, cleanup-on-failure, sampling, retry, response repair, or best-of-N.

Each token creates one `.f32le` trace pack. Its ordered stages are the token
embedding; nine stages per transformer layer; final normalized state; and
vocabulary logits. The exact count is `3 + 9 * layer_count`. Each stage and
pack is length- and SHA-256-bound. Nonfinite values and any trace-budget
overrun are terminal typed failures. The result is written last after every
trace file is flushed and synchronized. Directory durability is explicitly
not claimed by the leaf probe; the future one-shot owner must supply stronger
custody and terminal evidence.

The only allowed successful result claim is
`private-scalar-traces-created-not-numerical-parity`.

## Verification At This Checkpoint

Focused verification completed before this memory update:

- `cargo test -p tinyrustlm-numerical-probe`: 5 passed, 0 failed
- `cargo clippy -p tinyrustlm-numerical-probe --all-targets -- -D warnings`:
  passed
- `cargo fmt --all -- --check`: passed
- `node --test tests/scalar-numerical-probe-profile.test.js`: 5 passed,
  0 failed

The tests use the canonical 8,704-byte mixed-Q8 fixture and establish:

- a complete two-token trace and self-consistent result;
- pre-output rejection of noncanonical and unknown request forms;
- pre-output rejection of model drift;
- create-only refusal to overwrite an existing root while preserving bytes;
  and
- preservation of partial evidence with no result after a registered trace
  budget failure.

These fixture tests do not count as real Qwen3 execution or numerical parity.

The maintained all-source command was then run with an explicit existing
outside-Git evidence parent. Its standard partition completed in 458,310 ms:

- 1,517 tests discovered
- 1,515 passed
- 0 failed
- 2 explicitly skipped by their own infrastructure-only contracts
- 0 cancelled
- 0 todo

After the standard partition passed, the release-surface layer returned the
expected typed refusal `release_gate_source_not_clean`. That is honest dirty
worktree behavior, not a test failure and not release evidence. The source
change must now be committed, pushed, and freshly verified before the clean
release-surface gate is run against exact committed source.

## Report-Driven Numerical Proof Boundary

The reviewed reports materially sharpened the next gate into three explicit
and independently evidenced comparisons:

1. pinned BF16 source-framework execution versus reconstructed/dequantized
   SLM2 weights, isolating conversion and quantization effects;
2. reconstructed/dequantized SLM2 framework execution versus the Rust scalar
   runtime, isolating packed-byte interpretation and scalar mathematics; and
3. after scalar acceptance, Rust scalar versus each optimized native and
   browser-WASM implementation, isolating kernel and dispatch behavior.

No arrow may be inferred transitively. Final generated text is not a numerical
oracle. One global tolerance chosen after observing a preferred result is
forbidden. The independent verifier must preregister tensor-class metrics,
thresholds, escalation rules, and first-divergence ordering before any private
real-model output is materialized.

Input custody must be layered and exact: raw conversation, rendered template
bytes, token IDs and position IDs, then tensor inputs. Tokenizer, Template2,
Prompt2, Sampling2, composition, source lock, and execution identities must be
bound so a framing mismatch cannot be mislabeled as a kernel defect.

## Exact Next Ordered Work

Do not invoke the probe on `/12` yet. The next coherent change is:

1. pin an offline Python 3.12, PyTorch, Transformers, Safetensors, Tokenizers,
   and NumPy source-framework closure with exact package hashes and licenses;
2. implement a non-shipping source owner that emits bounded create-only
   observations for the exact same private token-ID cases;
3. implement the reconstructed/dequantized diagnostic arm required to split
   quantization from runtime error;
4. implement an independent verifier that consumes source and scalar evidence,
   recomputes identities, applies preregistered tensor-class metrics, and
   reports the first divergence without rewriting either side;
5. test malformed, stale, conflicting, partial, nonfinite, oversized, and
   identity-drift evidence before any real run;
6. choose wholly new request, source-output, scalar-output, verifier-output,
   evidence, process, and terminal identities and prove every future root
   absent; and
7. commit, push, freshly fetch, and prove remote equality for an output-free
   registration before materializing any registered private output.

Only the future sole owner may launch each registered material process at its
registered cardinality. Any launch, timeout, crash, ambiguity, output-bound
failure, or verifier rejection closes that operation; it cannot be repaired,
resumed, adopted, or relabeled.

## Hard Claim Boundary

At this checkpoint:

- scalar probe implementation: present
- canonical fixture verification: passed
- `/12` scalar probe execution: not performed
- pinned source-framework observation: not performed
- source-to-reconstructed quantization comparison: unproven
- reconstructed-to-Rust-scalar parity: unproven
- optimized native parity: unproven
- browser-WASM parity: unproven
- conversational quality: unproven
- P2P availability or outside proof: unproven
- package/site release: unproven
- MemoryEndpoints: unauthorized

Campaign counters remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
No implementation, fixture test, structural pass, or private trace may advance
one of those counters.
