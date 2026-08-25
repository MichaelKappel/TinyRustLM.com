# TinyRustLM Prelaunch Contract Family

## Authority

`contract-family.v1.json` is the machine-readable Phase 2 contract registry.
It freezes the nine top-level schema names, exact root and nested record
fields, field kinds, enum values, limits, visibility, identity domains,
redaction policy, and named semantic invariants.

This registry is a clean-slate technical contract for one prelaunch product.
`vnext`, SLM2, and numbered schemas identify exact source or bytes; they do not
name a second product generation. The current implementation does not map,
alias, upgrade, or fall back to a superseded TinyRustLM schema. Prior records
remain non-executable audit evidence.

## SLM2 Model Format Checkpoint

The model-byte format is a separate exact binary contract referenced by the
artifact family rather than another JSON schema in the nine-member registry.
The current profile is `slm2-format-profile.v1.json`, 21,924 bytes with SHA-256
`5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8`.
Its sole stored model encoding is defined by
`slm2-q8-weight-profile.v1.json`, 9,900 bytes with SHA-256
`7e931fd23fa8f6a90c53e4c14c5630eef8ce87e0f0902acd5a5e2df03c60733a`.
Exact rank-2 embedding and projection roles use row-wise signed int8 codes and
one finite F32 scale per row. Normalization and optional QKV-bias roles remain
F32. The role partition, 128-byte quantization record, arithmetic, descriptor
fields, section layout, hashes, and rejection vocabulary are closed.

`slm2-q8-weight-vectors.v1.json` is the independent language-neutral byte
contract. It is 42,623 bytes with SHA-256
`f81d30bd0646efa4a267ffed8c697c2b7a5c84a67ded9d498aa3ffb10007ca2d`.
Its 8,704-byte, 17-tensor canonical artifact has SHA-256
`4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502`.
A Node-builtins-only oracle and unsafe-free Rust independently reproduce the
artifact, seven quantization rows, four ordered scalar matrix-vector cases,
every proper-prefix rejection, and 17 hostile mutations.

The bounded raw parser-fuzz profile is `slm2-q8-fuzz-profile.v1.json`, 3,314
bytes with SHA-256
`27c4ca3a2c5b4642010f7ca854aa83c76dd10bbe7e114a78489958f3e1c2f0ce`.
Its 20-seed stable corpus contains one exact admission, explicit truncated and
SLM1 rejection envelopes, and every registered Q8 hostile mutation. The closed
Rust harness and stable replay verify exact membership, hashes, verdicts,
errors, resource limits, paths, and no-activation behavior. This is local
parser evidence, not a long-running sanitizer result, model qualification,
deployment, publication, or campaign evidence. See
`docs/architecture/vnext-slm2-format-implementation.md`.

## SLM2 Scalar Runtime Conformance Checkpoint

`slm2-runtime-q8-vectors.v1.json` is a 50,801-byte language-neutral scalar
execution contract with SHA-256
`c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0`.
An independent Node implementation executes directly from the canonical mixed
Q8/F32 artifact and freezes six forward steps, every operator boundary, QKV
biases, Q/K normalization, final logits, token decisions, positions, F32 KV
growth, and two generation cases. The unsafe-free Rust scalar runtime reads the
same Q8 rows directly without runtime repacking or an F32 weight shadow. The
conformance-only WASM module calls that same Rust core.

This is bounded canonical-fixture conformance. It does not establish a
production model-transfer ABI, source-framework parity, tokenizer/template
behavior, useful-model qualification, SIMD, threaded WASM, WebGPU, deployment,
or live campaign evidence. See
`docs/architecture/vnext-slm2-scalar-wasm-conformance.md`.

## Canonical Runtime Integration Registration

`canonical-runtime-integration-preregistration.v1.json` is the output-free
registration for moving scalar correctness into the sole host-facing runtime
and integrating Composition2, Prompt2, Sampling2, and composition-bound KV
without duplicate owners. It is 10,764 bytes with SHA-256
`dbc2c686c2e276062e3d96c37002a6aa310d96231c3bdcf66655c611d9cb10ea`.

The registration permits only three owner-preserving API additions: a shared
borrow of the active prepared composition, a stale-checked generation-state
reset, and generated-token decoding through Prompt2's already-owned
Tokenizer2. It requires moving rather than copying the scalar implementation,
deleting the displaced scalar crate, and retargeting the conformance fixture
to `tinyrustlm-runtime`. It creates no runtime output, model evidence, browser
claim, release, or campaign credit. See
`docs/architecture/2026-08-24-canonical-runtime-integration-preregistration.md`.

## Qwen3 Model Conversion

`qwen3-0.6b-base-source-lock.v1.json` is the sole current content authority for
the reviewed upstream `Qwen/Qwen3-0.6B` base checkpoint at immutable revision
`c1899de289a04d12100db370d81485cdf75e47ca`. It is 1,901 bytes at SHA-256
`e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d`
and binds one exact nine-file, 1,519,207,688-byte source closure without a
machine-local path. Its five tokenizer-related members are byte-identical to
the accepted Tokenizer2 source lock, and its selected base identities match the
converter registration. The unchanged base remains terminally rejected as a
product model; this lock is source identity only. See
`docs/architecture/2026-08-25-qwen3-0.6b-base-source-lock.md`.

`qwen3-safetensors-conversion-profile.v1.json` froze the sole production-bound
source-model conversion contract before converter code or Qwen3 SLM2 output
changed. It is 14,419 bytes at SHA-256
`313069152daa70a2c2b5070f9d1350379a5800f647d5c3ac8d23a75ff9ead968`.
It selects dense Qwen3 grouped-query attention with paired Q/K
normalization, one exact nine-file source closure, strict single-file
Safetensors validation, bounded BF16/F32 streaming, and exact mixed-Q8 SLM2
output. Conversion publishes the independently reparsed model first and its
content-addressed receipt last through create-only same-directory durability.

The implemented converter does not regenerate Tokenizer2 or Template2,
promote model quality, run a runtime, or create campaign credit. It replaced
and deleted the Qwen2/F32 model converter and retains no fallback,
compatibility, migration, alias, alternate quantization, or dense model path.
The selected unchanged Qwen3-0.6B base remains terminally rejected as a
product model. See the immutable before-output decision in
`docs/architecture/qwen3-slm2-converter-preregistration.md` and the current
implementation record in
`docs/architecture/qwen3-slm2-converter-implementation.md`.

`qwen3-composition-conversion-profile.v2.json` is the registered sole complete
source-to-composition transaction. It is 8,835 bytes at SHA-256
`d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718`.
It requires equal model and tokenizer source identity and revision, the exact
compatible model and tokenizer architecture-profile pair, and equality of all
five shared file records. It binds six ordered SLM2/Tokenizer2/Template2/
Sampling2/Prompt2/ACG2 artifacts, bounded one-at-a-time dependency resolution,
create-only terminal pass or rejection evidence, and explicit nonclaims for
quality, runtime, browser, P2P, and publication. Technical `/2` is a contract
identity, not a second product generation.

The `/1` profile incorrectly required the semantically different model and
tokenizer architecture-profile IDs to be equal. Preflight found the defect
before any real complete-composition output. `/1` is terminally invalidated and
will have no current reader, migration, alias, or fallback. See
`docs/architecture/2026-08-25-qwen3-composition-source-relationship-correction-preregistration.md`.

The Rust transaction and managed companion boundary now consume only `/2`.
They require the exact compatible profile pair and have no `/1` reader,
version switch, migration, alias, or fallback. The complete transaction creates
and independently verifies
all six artifacts, exact cross-member vocabulary/context relationships, bounded
resource preflight, component receipts, and mutually exclusive terminal
evidence. The component converter commands remain private exact compiler
primitives; only `tinyrustlm-convert qwen3-composition` can establish the
complete conversion boundary consumed by the product. The private managed
wrapper and Companion source branch now consume only that boundary and require
all six rehashed identities before availability. No complete command has yet
run against real model source. See the immutable output-free registration in
`docs/architecture/2026-08-24-complete-qwen3-composition-conversion-preregistration.md`
and the implementation record in
`docs/architecture/2026-08-24-complete-qwen3-composition-conversion-implementation.md`,
plus the managed integration record in
`docs/architecture/2026-08-24-managed-complete-composition-source-integration.md`
and the clean-cut correction record in
`docs/architecture/2026-08-25-qwen3-composition-source-relationship-correction-implementation.md`.

`qwen3-real-composition-execution-preregistration.v1.json` was the output-free
registration for exactly one real Qwen3 complete-composition execution. It is
16,006 bytes at SHA-256
`46a9da74eb6b811257d2cc3a433055d4859fb7bbdfeef22e1c6ee8c2bd978a6a`.
It binds the current remote-exact source anchor, exact model/tokenizer locks,
corrected composition profile `/2`, offline Windows x64 release build,
future executable capture, three absent public-safe logical roots, one private
path-bearing intent, one converter launch, separate bounded stream custody,
and mutually exclusive pass/rejection/ambiguous terminal rules. Its build
succeeded, but private evidence-root population stopped before the binding;
no converter process or output root exists. Registration `/1` is closed and
will not be retried, repaired, cleaned, overwritten, or relabeled.
`qwen3-real-composition-execution-result.v1.json`, 4,076 bytes at SHA-256
`dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce`,
records that bounded pre-launch result. No private path or raw output enters
Git. See
`docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration.md`
and
`docs/architecture/2026-08-25-qwen3-real-composition-execution-controller-and-v1-result.md`.

The tested `qwen3-composition-execution-controller.js` now owns the private
evidence envelope for a newly registered attempt. It validates every expensive
input before creating the evidence root, writes the immutable binding first,
then authorizes and captures exactly one bounded child process. A controller
candidate pass still requires the independent managed durable inspector and
does not establish runtime, browser, quality, P2P, publication, or campaign
evidence.

## Tokenizer2 Format Checkpoint

`tokenizer2-format-profile.v1.json` is the sole development-only Tokenizer2
2.0 byte and algorithm contract. It is 12,442 bytes with SHA-256
`628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de`.
It freezes a 192-byte header, implicit-ID token table, implicit-rank merge
table, tightly packed byte table, exact base and added-token closure, Unicode
9 NFC, Unicode 16 Qwen split semantics, ByteLevel mapping, ranked BPE, and
explicit decoding modes. Unknown fields, flags, profiles, versions, gaps,
duplicates, malformed UTF-8, and trailing bytes fail closed.

`tokenizer2-format-vectors.v1.json` is a 25,552-byte independent
language-neutral contract with SHA-256
`9fef7d6c8576d971d72fd248dcedce2888ca0fe2a944fbbb914fed8e07f218aa`.
Its Node-core writer owns one 7,459-byte canonical artifact with SHA-256
`2b2c3c5f58baacd7af68e2ccffa1cb03e113fa281b1832224d684f9ac03eaff1`.
The unsafe-free Rust writer reproduces those independently authored bytes.
Both implementations replay 11 frozen pretoken boundaries, 12 encodings,
four decodings, 13 single-fault mutations, and rejection of every proper
artifact prefix. The Node oracle invokes no Rust, subprocess, or network
operation.

`qwen-tokenizer2-conversion-profile.v1.json` is the sole exact source-to-
Tokenizer2 conversion profile. It is 3,501 bytes with SHA-256
`f70465a08b41599fe59f41b850912d0d408f0ec67e84ebeb7591524d1b14e12b`.
The exact five-file `Qwen/Qwen3-0.6B` source closure is bound by
`qwen3-0.6b-tokenizer2-source-lock.v1.json`, 1,108 bytes with SHA-256
`1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70`.
Two external conversions produce one byte-identical 7,038,773-byte Tokenizer2
artifact with SHA-256
`cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
The converter rejects duplicate or unknown source members, nonexact pipeline
options, redundant vocabulary or merge disagreement, source drift, and
non-create-only output. It independently reparses the complete staged artifact
before promotion and binds the source, profiles, executable, output, counts,
special IDs, and directory durability in a receipt.

`qwen-tokenizer2-parity-cases.v1.json` freezes the output-free 2,048-case
source-parity corpus before either implementation is observed. It is 464,043
bytes with SHA-256
`9503fd6df325f1a46dec56674d2aa72ce225d6bf1c9477abd56bb4542ef99caa`.
The 5,792-byte execution preregistration has SHA-256
`bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466`;
the original 2,064-byte verification preregistration has SHA-256
`cc1472a7531095323dc1fe2fc2bb878bedfff4cc2cc5b5651f129c4800b0ed05`.
They bind two offline Hugging Face tokenizers 0.22.2 runs, two native Rust
runs, exact token-ID and decoded-Unicode equality, raw repeat-byte equality,
post-observation source and artifact rehashing, create-only receipts, fatal
mismatch handling, and a verifier with SHA-256
`67791ba375cc8be2b84f1985eea42a810e4dca4edcc91fb0a9bd9e91ec979173`.
The four v1 outputs were created exactly once, but that verifier failed before
comparison because it incorrectly treated JSON object member order as semantic.
No receipt or parity decision exists for v1, and its immutable raw outputs are
excluded from all successor comparisons.

The append-only 4,373-byte v2 verification preregistration has SHA-256
`c02523a654c95007b9169bcd4c835b4283f9c7459796d8a943cc4ed0381242b3`.
It binds the terminal v1 failure, a fresh four-output run set, one pinned native
executable, and a 42,844-byte verifier with SHA-256
`1fac2f476e04b5624fa7030791f5f40faa87d7269a5e215320e1dcab0925f1ad`.
V2 ignores nonsemantic JSON object member order while preserving array order
and strict primitive identity. After its implementation and UAI checkpoint
were pushed and fresh-remote exact, one registered v2 execution produced two
fresh byte-stable oracle outputs and two fresh byte-stable native outputs. All
2,048 cases and 69,294 tokens matched exactly. The 3,974-byte create-only
verification receipt has SHA-256
`4ebbfa2bc59d43bdbcd5b3b2528bed66035ff2a3165f554ac6867e7cc7fe0ea6`.

This checkpoint is complete pinned-Qwen tokenizer format conversion plus exact
native source-oracle encoding and decoding parity. The separately registered
full-artifact browser-WASM gate also passes. This is not Template2 parity,
model conversion, model qualification, release, deployment, or campaign
evidence. See
`docs/architecture/vnext-tokenizer2-format-implementation.md`, ADR-014, and
`wiki/runtime-mirust/reports/tinyrustlm-qwen3-tokenizer2-conversion-memory-2026-08-20.md`.
The immutable v1 verifier failure and successful append-only v2 successor are
recorded in
`docs/architecture/qwen3-tokenizer2-parity-verifier-v1-failure-and-v2-preregistration.md`.

The production-shaped Tokenizer2 WASM interface is now frozen in
`tokenizer2-wasm-interface.v1.json`, 4,030 bytes with SHA-256
`375c270b6836968eddd53bca6523dd1461dd5d77dc537be11f1fd78be9ad4d99`.
Its import-free 320,996-byte release module has SHA-256
`058c6ffb494e90b101409951ba78b4fc7d8098a868c861a276ef3f415ede27cc`.
The miniature artifact passes the same Rust core through native tests, Node
WASM, and a fresh real-Chromium profile with zero requests and proven profile
deletion.

The full-artifact browser execution completed exactly once after its source
checkpoint was pushed and fresh-remote exact.
`qwen-tokenizer2-browser-wasm-preregistration.v1.json` is 9,343 bytes with
SHA-256
`8734360e7fc2e0d4cb4f6ace87e2b5ec2922f983eededa7f5b246fad928050f3`.
Its independent 2,453-byte verification preregistration has SHA-256
`560347bb1db2f1299bc3f54d5e2a8a5d6adbb26e1a55b908c4bb754d72f540a2`.
Together they bind the 151,669-token artifact shape, immutable native result,
2,048-case corpus, source closure, WASM module, browser binaries, two owned
profiles, worker termination and recovery, resource ceilings, raw outputs, and
one verifier invocation. Two fresh Chromium runs matched all 2,048 cases and
69,294 tokens with zero mismatches, zero network requests, process closure,
profile deletion, and bounded resource evidence. The 3,909-byte bounded result
has SHA-256
`f828190b2ff5d3c1e794cb50f3b0dd8c41367ed09fca758eeb513fb1ec2c964e`.
The registration is complete and must not be rerun. See
`docs/architecture/qwen3-tokenizer2-browser-wasm-preregistration.md`.

## Template2 Format Checkpoint

`template2-format-profile.v1.json` is the sole development-only Template2 2.0
byte and rendering contract. It is 15,111 bytes with SHA-256
`14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa`.
It freezes one 256-byte header, 31 fixed literal records, exact source and
Tokenizer2 bindings, strict role/content messages, optional leading system,
strict user-assistant alternation ending in user, exact whitespace,
thinking-disabled generation prefix, 26 forbidden control literals, ordered
stop IDs, and bounded fail-empty rendering.

`template2-format-vectors.v1.json` is a 34,773-byte independent contract with
SHA-256
`b02d50f4f181bb3414a5b14e49544ff7c094f0c98f0f5def0c276bbbd1674160`.
Its Node-core writer owns one 1,403-byte canonical artifact with SHA-256
`5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8`.
The unsafe-free Rust implementation reproduces those bytes and all rendering,
insertion, malformed-message, forbidden-content, boundary, mutation, and
proper-prefix behavior independently.

`qwen3-0.6b-template2-source-lock.v1.json` binds the exact publisher template,
model configuration, Tokenizer2 source parent, supported source branch, and
unsupported capabilities. It is 1,580 bytes with SHA-256
`22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660`.
Publisher Jinja remains a pinned development oracle and is never stored or
executed by the product runtime.

The output-free source-parity corpus is 667,912 bytes with 1,024 cases and
SHA-256
`59febbdbec44cfcf92e233626fd7fb3fb140fd43dddee64e684837a7e76df99b`.
The 6,631-byte execution preregistration has SHA-256
`c42f7dfb14b6861bd8db47dd1fbca590961ed573c69835556815cbe5cdef1051`.
The 5,030-byte independent verification preregistration has SHA-256
`c61b9556b30fa3a82085d53a96b1e468fa1fa1a5cd81e7b92f961da1ad473095`.

A validation-only preflight rehashed all source, environment, corpus,
candidate, artifact, executable, and profile identities and accepted all 1,024
cases without rendering publisher or candidate comparative output. After
registration commit `2693cec9eeff6af991c78d42a0eb9c9fe5716f60` was pushed and
fresh-remote exact, one zero-retry observation matched all 1,024 cases and
483,375 rendered bytes exactly. Its 4,206-byte receipt has SHA-256
`d0a848a0827f536fb69b2d6f19ffb84102b1ff83ac2efed25e564fa9b2810cdb`;
the 4,727-byte public-safe result has SHA-256
`c985f3c95e6554425de1743b723009cb92c17246eac4859c2f9feaa0aa5e3fa0`.
This registration is complete and must not be rerun. See ADR-015,
`docs/architecture/vnext-template2-format-implementation.md`, and
`docs/architecture/qwen3-template2-source-parity-preregistration.md`.

## Sampling2 Format Checkpoint

`sampling2-format-profile.v1.json` is the sole development-only Sampling2 2.0
artifact and deterministic token-selection contract. It is 19,333 bytes with
SHA-256
`ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d`.
It freezes exact binary32 admission, Q20 conversion, generated-token repetition,
stable ties, top-k, table-backed temperature weights, top-p, SplitMix64,
xoshiro256**, unbiased `u128` selection, exact 40-byte state, stop handling,
context and generation limits, cancellation, and fail-atomic output.

`sampling2-exp-q48-table.v1.bin` is the normative 65,544-byte table with
SHA-256
`fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677`.
Production runtimes consume those bytes and do not call a host exponential
function.

`sampling2-format-vectors.v1.json` is a 151,569-byte independent contract with
SHA-256
`4fe731f2e8714e9a6fe7689964a88a7fbe8150faf6af053cbf0be38390daaa9f`.
Its Node-core writer owns one 65,800-byte canonical artifact with SHA-256
`9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89`.
The unsafe-free `tinyrustlm-sampling2` crate independently reproduces the
artifact, fixed scores, PRNG sequences, a forced 16-word rejection path,
selected tokens, state bytes, terminal outcomes, mutations, and every proper
prefix rejection. It has one standalone pinned Cargo workspace so the root
manifest and lockfile remain byte-identical to the completed Template2
registration; this is evidence isolation, not a product fallback.

Sampling2 contains no implicit product defaults and assigns no meaning to stop
tokens. Final composition must bind the exact selected config and the exact
ordered stop set supplied by Template2. This checkpoint is local native
contract evidence only; native/WASM composition, real Chromium, real model,
quality, release, deployment, publication, and campaign gates remain open.
See ADR-016 and
`docs/architecture/vnext-sampling2-format-implementation.md`.

## Prompt2 Composition Checkpoint

`prompt2-format-profile.v1.json` is the sole implemented, unpromoted Prompt2
2.0 composition profile. It is 19,421 bytes with SHA-256
`f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c`.
Its exact 512-byte artifact has SHA-256
`27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3`
and binds the accepted Tokenizer2, Template2, Sampling2, Q48 table, pinned Qwen
source configuration and template, current mixed-Q8 SLM2 format, and
runtime-Q8-vector identities. It does not bind model tensor bytes or grant a
model claim.

`prompt2-format-vectors.v1.json` is a 347,532-byte independent contract with
SHA-256
`4b4a4497245ee371e4f3e2b930e3413caa0f8bb70b04c3385880b11de83c487e`.
It freezes the exact artifact, load bundle, three requests, active and
40,960-token context-limit results, all proper artifact prefixes, and 42
registered mutations. Large result bytes use deterministic 32 KiB JSON chunks
so the repository strict JSON string ceiling remains unchanged.
The artifact mutation set explicitly rejects both superseded dense-F32 SLM2
dependency digests.

The independent Node implementation and unsafe-free `tinyrustlm-prompt2` Rust
crate reproduce every wire and stable rejection. Composition renders once,
tokenizes the complete rendered UTF-8 once, independently recomposes each
non-control span plus Template2-owned control token, requires exact token-array
equality, maps every control insertion, and constructs one Sampling2 controller
from the complete caller-supplied configuration and seed. There are no defaults,
truncation, repair, retries, best-of-N selection, aliases, legacy readers, or
fallback paths.

This checkpoint is exact format and local native composition evidence only.
The mixed-Q8 dependency replacement was preregistered at remote-exact commit
`6684585964e79d7237bd05398dad4cafd455d1e2`; the earlier ACG2 registration is
terminally superseded before output and cannot be used for implementation.
The accepted full Tokenizer2 artifact has not yet been executed through Prompt2
under a frozen output-free registration. Native comparative output, browser
WASM, fresh Chromium, a real SLM2 model, quality, release, deployment,
publication, MemoryEndpoints, and campaign gates remain open. See ADR-017 and
`docs/architecture/vnext-prompt2-format-implementation.md`.

## ACG2 Champion Composition Checkpoint

`acg2-format-profile.v1.json` is the sole implemented, unpromoted ACG2
champion graph profile. It is 13,793 bytes with SHA-256
`944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be`.
One graph is exactly 896 little-endian bytes: a 256-byte header and exactly
five 128-byte records in model, tokenizer, template, sampling, and prompt
order. It embeds identities only. Paths, URLs, aliases, optional members,
extensions, credentials, and member payload bytes are forbidden.

`acg2-format-vectors.v1.json` is 74,373 bytes with SHA-256
`d7f0f956ccbc909b242d24410ff9f2f60216d8ff8537a108bff0f698c7b6a441`.
It freezes one canonical mixed-Q8 graph, one cryptographically distinct valid
model graph, all 896 proper-prefix rejections, and 32 exact hostile verdicts.
The canonical graph SHA-256 is
`2f45314ae3617c348beff2617927d08dbe0058dd947d01b4f89aa77e0f57e9ff`.

The built-ins-only Node oracle and unsafe-free `tinyrustlm-composition2` Rust
crate independently reproduce the graph bytes and stable errors. Rust also
implements one-open-source resolution, one fixed 1 MiB streaming hash buffer,
canonical member parsing, exact Prompt2 dependency closure, complete resource
preflight, stale-operation rejection, and one ownership-swap activation that
clears KV and generation state while preserving the transcript. An import-free
WASM conformance ABI replays the corpus in Node WebAssembly and fresh Chromium
with zero network.

`acg2-wasm-export-ownership-preregistration.v1.json` is the output-free
registration for isolating that eleven-function test ABI from transitive SLM2
WASM consumers. It is 8,994 bytes with SHA-256
`a14a74778ac366a8b7a051dac005e074caa610aa786dce3e93267be96aa33057`.
The registered implementation uses one default-disabled compile-time feature,
separate Cargo roots, and exact disjoint export sets; it provides no runtime
negotiation or combined ABI. Earlier feature-gate builds at `db7cc1c` are
preserved as non-evidence development history. No implementation output exists
under this registration yet.

This remains technical format evidence. No real model has been converted,
qualified, or executed through the product browser path. The standalone crate
is an exact-lock staging boundary while registered root evidence stays
immutable; it is not a supported parallel runtime. Product integration must
replace all consumers and delete superseded executable ACG1/SLM1 paths in one
clean cut. See ADR-019 and
`docs/architecture/vnext-acg2-format-implementation.md`.

ACG2 technical version 2.0 and this directory's `vnext` name do not designate
a product V2. TinyRustLM has one prelaunch product, no legacy population, no
compatibility obligation, and no authority for migration, alias, fallback, or
dual-runtime code.

## Parsing

Every JSON input is first consumed as bounded bytes. Before schema validation,
the parser rejects:

- empty or oversized input;
- UTF-8, UTF-16, or UTF-32 BOMs;
- invalid UTF-8;
- literal or escaped-equivalent duplicate member names;
- lone surrogates and invalid escapes;
- non-JSON whitespace or grammar;
- negative zero, unsafe integers, overflow, and underflow;
- excessive depth, entries, members, arrays, strings, or number characters;
- trailing non-whitespace data.

The schema validator then rejects every unknown or missing field at every
record depth. It never drops unknown fields, applies defaults, coerces values,
normalizes identifiers, repairs JSON, or chooses a nearby schema version.

The canonical output profile is RFC 8785 JCS over the accepted in-memory JSON
value. Promotion still requires the shared RFC 8785 corpus across Rust, Node,
and browser implementations; naming the profile is not conformance evidence.

## Primitive Semantics

- `safe-id`: 3 to 160 printable ASCII characters matching
  `[a-z0-9][a-z0-9._:-]*` unless a literal or enum narrows it.
- `sha256`: exactly 64 lowercase hexadecimal characters.
- `content-id`: `sha256:` plus a `sha256` value.
- `utc`: an actual UTC instant ending in `Z`, with seconds and optional one to
  nine fractional digits; leap-second acceptance is not implied.
- `date`: a real `YYYY-MM-DD` UTC calendar date.
- `semver`: SemVer 2.0.0 without surrounding whitespace.
- `source-revision`: `git-sha1:` plus 40 lowercase hexadecimal characters or
  `sha256:` plus 64 lowercase hexadecimal characters.
- `https-url`: absolute HTTPS, ASCII host, no user information, query, or
  fragment, and no localhost, loopback, private, link-local, unspecified, or
  multicast address in public-safe contracts.
- `public-path`: an absolute URL path beginning with one `/`, without a
  scheme, authority, backslash, dot segment, encoded path separator, query,
  fragment, C0/C1 control, or non-ASCII byte.
- `ed25519-public-key`: canonical padded base64 for exactly 32 decoded bytes.
- `ed25519-signature`: canonical padded base64 for exactly 64 decoded bytes.
- `integer`: a JavaScript/RFC 8785 safe integer within the field bounds.
- `bounded-string`: valid Unicode scalar values within the declared code-unit
  bounds and without C0/C1 controls.
- `bounded-text`: the same scalar and code-unit bounds, but permits tab, LF,
  and CR. Only private content fields may use this primitive.
- `nullable`: exactly null or the declared value type.
- `record`: exactly the named closed record.
- `array`: exact item type and declared cardinality; `unique`, `uniqueBy`,
  `sorted`, and `sortedBy` are mandatory semantics when present.

No generic map, arbitrary extension object, untyped JSON value, float, or
open payload appears in the family. Decimal measurements that cannot be safe
integers are represented as bounded strings with an explicit unit.

## Identity

SHA-256 is the only mandatory hash. A domain-separated identity is:

```text
SHA-256(UTF8(identityDomain) || 0x00 || JCS(identityContent))
```

Each contract declares its derivation, identity field, canonical-hash field,
and exact excluded fields. Domain-separated contracts exclude their identity
and canonical-hash fields, then store the result as lowercase hex in
`canonicalContentSha256` and as `sha256:<digest>` in the identity field.
Artifact identity is instead the SHA-256 of complete artifact bytes. Its
manifest canonical hash excludes only `canonicalContentSha256`, so the
manifest hash still binds `artifactId` and every other manifest field.

Worker and companion messages intentionally have no public content identity.
Their IDs are correlation/replay identifiers scoped to a private session.

Signature envelopes are `tinyrustlm.vnext.receipt.v1` records with
`receiptType=signature-envelope`. A signature never changes the signed content
receipt and never elevates local, fixture, or emulated evidence into another
evidence class.

The sole proof contract is `tinyrustlm.vnext.outside_proof.v2`. The proof has
no signature-envelope field because mutually embedding proof and signature
receipt identities would create an unresolvable content-addressed cycle. The
proof is finalized first. A signature-envelope receipt then names the proof ID,
schema, canonical-content hash input, authority registry, role, scope, nonce,
and times as a one-way descendant. Outside-proof v1 is rejected and has no
alias or compatibility reader.

## Public Safety

The default visibility is private. Only artifact metadata, receipts, P2P
manifests, outside proofs, release manifests, and claims can become
public-safe. Context, worker, and companion records are private even when they
contain only hashes.

Every public-safe record names the exact redaction profile and requires a
separate current redaction/secret-scan receipt in its evidence graph. The scan
receipt binds the target's already-final canonical hash; the target never
points back to the scan, so content addressing remains acyclic. A
`redaction-scan` receipt is structurally public-safe and does not recursively
require another scan of itself. Public records reject the forbidden key names
and value classes in the registry. Public URLs are HTTPS without user
information, query, or fragment. Errors contain a registered code, failure
step, retry status, and rollback status only. Raw exceptions, prompts,
outputs, hosted memory, model bytes, credentials, invitation material,
private paths, and stable unnecessary user/hardware identifiers are never
public evidence.

The same profile admits release text only through the separate
`tinyrustlm.vnext.public_text.v1` scanner. Those bytes must be fatal UTF-8 with
no BOM, CR, disallowed controls, or missing terminal LF. The scanner derives a
domain-separated text identity, applies known-secret, contextual pattern, and
entropy rules, returns unchanged bytes only on pass, and requires an explicit
`public-text` target kind when its receipt is replayed.

Hashing a secret does not automatically make it public-safe. A hashed value is
allowed only where the schema explicitly names that hash, its disclosure has a
defined purpose, and the redaction scan accepts it.

## Contract Roles

- **Artifact** binds complete bytes, metadata, dependencies, source evidence,
  qualification, pieces, and license. It does not contain model bytes or byte
  locations.
- **Receipt** is the sole phase-evidence envelope. Phase meaning is selected by
  a closed `receiptType`, not a new top-level schema. Signature envelopes,
  authority registries, key revocations, and offline verification bundles use
  closed typed payload records; generic public parameters cannot substitute
  for those security bindings.
- **Context** is the sole private compiled inference context. Segment order,
  role, source kind, trust, current authority, content hashes, provenance,
  supersession, conflicts, token budget, and cache identities are explicit.
- **Worker** is a small private control envelope. Private and large payloads
  move as separately transferred bytes bound by length and SHA-256.
- **Companion** is a small private loopback envelope. Pairing/capability
  secrets remain in protected headers and never enter JSON bodies.
- **P2P** is the complete fixed-piece manifest for one exact artifact and its
  qualification/provenance parents. It contains no endpoint.
- **Proof** is one expiring outside observer's complete-transfer observation
  for one lane and endpoint. Its signature is a separate receipt.
- **Release** is the acyclic prepublication predicate. It binds the exact
  campaign plan/projection, passing campaign attestation, artifacts, packages,
  approved claims, SBOM, provenance, changelog, and explicit remaining risks.
  Authorization, deployment, HTTPS readback, and published claim descendants
  point forward to the already-finalized release.
- **Claim** is the only machine-readable public wording authority. Site,
  route, component, wording class, evidence tier, source revision, release,
  owner, review time, blockers, and exact wording are explicit. Draft, local,
  external, approved-for-publication, published, stale, blocked, and retracted
  states are distinct. Approved claims have no release ID; published
  descendants reference and supersede the approved claim after readback.

## Change Rules

Before the first authorized production record exists, changing a required
field, field meaning, enum, limit, identity domain, visibility, parser profile,
redaction rule, or invariant replaces the current clean-slate registry. The
family ID, bound profiles, vectors, generated corpus, validators,
documentation, and complete test closure must change together. No reader for
the replaced registry remains in the product path.

After the first authorized production record exists, the same material change
requires a new registry and affected schema identifier. A new schema is
accepted only after both validators and the shared hostile corpus pass. There
is no permissive minor-version range, dual reader, or automatic upgrade.

Limits may be lowered before production only through a new frozen registry;
they are never changed after seeing which value allows a preferred artifact or
model to pass. Raising a limit requires measured memory/time evidence and a
threat review.

## Validation Checkpoint

Phase 2 has two intentionally different Node validators:

- `tinyrustlm.vnext.registry-schema-validator.v1` interprets this frozen
  registry and then applies class-specific local invariants.
- `tinyrustlm.vnext.independent-schema-validator.v1` carries a separately
  written exact schema and local-invariant implementation. It does not import
  the registry validator, read this registry, or access the filesystem.

Both consume the same checked-in language-neutral corpus of exact base64 raw
JSON bytes. The corpus is deterministic and binds its registry and normalized
generator-source hashes. It currently contains 70 cases: 14 accepted and 56
rejected. Tests require both validators to match every expected verdict, accept
object-key permutations, reject every missing root field, and reject an unknown
field at every reachable object depth. The registry interpreter additionally
partitions every declared invariant into checked, not applicable, or deferred;
the independent validator remains a separately sourced verdict oracle rather
than consuming that registry-owned invariant list.

`docs/architecture/vnext-contract-threat-review.md` is the authoritative
security review for this checkpoint. Its PASS is limited to schema and local
invariants. It does not prove canonical identity, signatures, authority or
revocation chains, receipt-DAG closure, redaction execution, Rust/browser
parity, production cutover, or any campaign result.

## Node Phase 3 Checkpoint

`tinyrustlm/tools/vnext-content-identity.js` finalizes and validates every
identity-bearing vNext document through both validators and exact canonical
bytes. `tinyrustlm/tools/vnext-signature-payload.js` implements the frozen
public-key Ed25519 primitive over role-specific domain-separated JCS bytes.
`tinyrustlm/tools/vnext-signature-authority.js` consumes bounded canonical
receipt and subject byte arrays, requires out-of-band root and terminal
registry pins, authenticates successor registries and revocations through the
predecessor release-authorizer key, rejects stale-registry signing and nonce
replay, and evaluates compromise and currentness without network access.
`tinyrustlm/tools/vnext-offline-bundle.js` adds one canonical closed manifest
and a separate acyclic verification receipt. It binds all member bytes, all
nine schema descriptors, the contract, campaign-projection,
phase-invalidation, protected equality-custody, redaction, signature, store,
and bundle profiles, target
signatures, campaign/environment, and registry pins; rejects
missing, extra, duplicate, unlinked, stale, interrupted, resource-exceeding,
or drifted input; and invokes the authority verifier only with supplied member
bytes.

`tinyrustlm/tools/vnext-public-safe-redaction.js` accepts finalized canonical
public-contract bytes only, rejects every private class, requires one
module-issued signed custody revision, scans seven bounded known-secret
encoding families plus schema-contextual forbidden value classes, returns
the unchanged bytes only on zero findings, and emits a separate deterministic
result containing identities, counts, and classes rather than values. Its
receipt builder and replay verifier bind target wire/content identity, exact
profile and scanner, result hash, status, custody identity/revision/generation,
public-key fingerprint, and protected equality-list count without publishing a
secret hash or list commitment. Callers cannot supply or change a raw list per
operation. The offline manifest binds both custody and redaction profiles among
eight installed profile or registry bindings. See
`docs/architecture/vnext-protected-equality-custody.md` and
`docs/architecture/vnext-public-safe-redaction.md`.

`tinyrustlm/tools/vnext-protected-equality-private-loader.js` is the single
current local private ingress for that custody. Its frozen 3,323-byte profile
has SHA-256
`c786ee4bf66810eb3c7cbe4db2be9ad15f24b26096988df7f819c400822e43a9`,
and its exact ten-member source closure has SHA-256
`96d170e0eee5d1dbfad57504268dc3eecb1eeb6c779f6dab076ad07a4474c2b8`.
It accepts canonical public trust bytes, reads the private signed bundle only
from inherited non-file pipe descriptor 3, closes that descriptor on every
attempt, and zeros owned delivery buffers. It accepts no private path,
environment, argument, standard-input, network, clock, retry, compatibility,
or unsigned mode. See
`docs/architecture/vnext-protected-equality-private-loader.md`. The release
bootstrap now opens exactly one custody revision through descriptor 3 and the
public custody facade exposes no constructor. The production issuer,
authorized launcher, revocation source, trusted-time provider, and OS isolation
remain incomplete.

`tinyrustlm/tools/vnext-phase-invalidation.js` classifies immutable phase
history through explicit same-operation supersession and dependency-only
staleness. `tinyrustlm/tools/vnext-campaign-projection.js` finalizes the exact
20/50/25/40/20 schedule and counts only planned, current-pass,
authority-eligible evidence whose required earlier objectives are current.
`rust/crates/tinyrustlm-evidence` independently finalizes and validates that
exact closed campaign-plan wire for native and `wasm32-unknown-unknown`
targets. The Node generator and two checked-in parity vectors bind both
implementations to identical draft bytes, plan ID, final bytes, and SHA-256.
`campaign-evidence-wasm-interface.v1.json` freezes the sole typed raw browser
evidence ABI. One generator emits both the Rust export facade and
byte-transport-only browser adapter; Node and two independent real Chromium
profiles reproduce exact plan, currentness, projection, result-validation, and
stable rejection bytes through the zero-import WASM module.
See `docs/architecture/vnext-campaign-evidence-wasm-boundary.md` for the exact
ABI, ownership, destructive-state, browser, and non-claim boundary.
The same Rust evidence crate now independently implements exact receipt
validation and semantic currentness. A deterministic 74,756-byte corpus with
SHA-256
`c583f55f0c81da4db08543b0a8e28ad4ee178a1a1a1169b6aeb3329bf67f7ee4`
freezes four accepted histories and nine hostile rejections. Node and Rust
must emit byte-identical canonical currentness results and the same stable
rejection codes. This API has no filesystem, network, clock, process, or
compatibility behavior and is exposed through the generated campaign-evidence
browser ABI without handwritten JavaScript semantics.
The complete synthetic capacity fixture verifies a 271-receipt offline bundle
with 155 target signatures and 40 proof subjects; it changes no live campaign
counter. See `docs/architecture/vnext-phase-invalidation.md` and
`docs/architecture/vnext-campaign-plan-projection.md`. The Rust boundary and
its non-claims are documented in
`docs/architecture/vnext-rust-campaign-plan-parity.md`.
The Rust currentness boundary is documented in
`docs/architecture/vnext-rust-phase-invalidation-parity.md`.
The Rust Ed25519 primitive independently reproduces canonical payload,
domain-separated signing bytes, strict public-key verification, canonical
result bytes, and 17 exact hostile rejection codes. Its 27,988-byte public-only
vector corpus has SHA-256
`22c0c0976209afdfc934939903d455a44d63312260881d0fe983cccadd20e413`.
This is cryptographic primitive parity, not authority-graph, revocation,
nonce-replay, offline-bundle, release, or campaign parity. See
`docs/architecture/vnext-rust-signature-primitive-parity.md`.
The same crate independently verifies the complete bounded authority graph,
including every signable non-receipt subject family. Its public-only
434,761-byte corpus has SHA-256
`7340f17c34b2f86dcd4c2431d1de7ed8d36429badd51866c8abbff3b0f0fa89a`
and freezes nine accepted results plus 26 exact hostile rejection codes. See
`docs/architecture/vnext-rust-authority-graph-parity.md`.
The same crate now independently verifies exact offline manifest and member
binding, the separate verification receipt, authority composition, closed
receipt and subject membership, terminal currentness, and target current
eligibility. Its public-only 668,506-byte corpus has SHA-256
`3bfa7509169461a55e8d0b9fab6a624fe1049e3c956fd7d3308ef9bfa8cfff6c`
and freezes three accepted bundles plus 31 exact hostile rejection codes. See
`docs/architecture/vnext-rust-offline-bundle-parity.md`.
The same crate now independently produces and validates the exact truthful
campaign projection. Its public-only 1,494,464-byte corpus has SHA-256
`8a72ac1b2e4abd944e41c1c53a7d475e350d961e7b627127404b0508cf654734`
and freezes 11 accepted projections, 22 exact input rejections, and 8 exact
result-wire rejections. See
`docs/architecture/vnext-rust-campaign-projection-parity.md`.

`tinyrustlm/tools/vnext-campaign-artifact-store.js` persists only exact
campaign-plan and projection-result wires under raw-byte SHA-256 paths. Its
4,555-byte frozen profile has SHA-256
`5736c06bedc41ebda83f51bc80405050ec1a466bc14248b12381e9d6fb95a784`.
It shares bounded no-follow validation and marker-backed durable publication
with the receipt store but retains separate result-to-plan semantics. Stored
results are immutable history; a missing or mismatched durability marker is
inactive, and `resumeProjection` reruns the projector from supplied current
evidence rather than selecting a mutable current pointer. See
`docs/architecture/vnext-campaign-artifact-persistence.md`.

`tinyrustlm/tools/vnext-subject-store.js` completes the other host-side input
store needed by the campaign runner. Its 4,518-byte frozen profile has SHA-256
`63cd21ef8dda687f06c486c373840ed101fe2534d7b769d943064571416f94e5`.
It admits only the five public-safe, non-receipt identity schemas, publishes
exact canonical bytes under the validated subject ID, and explicitly rejects
private context and receipt records. Its sole `putMany` implementation fully
preflights one to 1,024 unique subjects, orders them by subject ID, publishes
the complete set through one durable batch, and activates no in-memory member
until every target and durability receipt verifies. The size-one `put` method
is only a wrapper over that path. Bounded reconstruction, no-follow reads,
same-directory receipt-backed durable publication, exact target/receipt
readback, total-byte limits, interruption handling, and quarantine are shared
with the receipt and campaign artifact stores. It exposes no mutable current
pointer and grants no evidence currentness by itself. See
`docs/architecture/vnext-subject-store.md`.

`tinyrustlm/tools/vnext-receipt-store.js` uses the same single prelaunch access
model. Its 4,236-byte frozen profile has SHA-256
`1721e8d26cfd93617ce570a744796c8d95d5fc1fd628ac3ee94f1a484832ade5`.
Each store open performs one complete validated rebuild. Same-open immutable
membership and document snapshots perform no filesystem scans; physical reads
reopen target and durability-receipt bytes twice and revalidate exact receipt
identity, while batch reads share one parent-closure traversal. Cached document
reads are active-member-only orchestration copies, not a replacement for
physical restart proof. Cross-instance state retains only a monotonic
same-process generation number and forces stale instances to rebuild before
access; no global registry retains evidence bytes. The sole `putMany` path
publishes a complete sorted DAG
batch and activates it only after all external parents and durable bytes
revalidate.

`rust/crates/tinyrustlm-archive` owns the sole bounded ZIP and tar-gzip
admission authority. Non-Rust consumers invoke only its framed
`tinyrustlm-archive-scan` process through a create-only per-RID package. The
client/package profile has SHA-256
`08bb532cd88273f5633a8693040c2108fd7fef0935f9705f34b98cb1ab405441`
and binds the two Rust archive profiles, exact helper and package-builder
source closures, source revision and clean-worktree observation, Cargo and
rustc versions, RID/platform, build profile, trust class, executable, canonical
manifest, and canonical provenance. There is no direct-executable, `PATH`,
system-archive-tool, JavaScript-parser, compatibility, or best-effort path.
The native-package replay profile
`tinyrustlm.vnext.archive-scan-helper-verification.v1` has SHA-256
`825c2b76c7a1a2bc53cd79db778018b1efcb963d3e95bd16f21a7f029f4edd42`.
It admits exactly one ZIP and one tar-gzip vector through a packaged native
helper, removes its unique scratch child, and writes one create-only canonical
receipt only after exact member and package identity readback. One local clean
`win-x64` release package from source revision
`5db9e943ecdbcef83e27be1782d9bcb5ec4109fe` passed its 20/20 consumer
suite and produced replay receipt
`dde3309fa52fcc87925757f85335970d4f7807855debcae0dd405ad0ce5cddd8`.
This does not prove hosted CI, another RID, signing, publication, production
readback, or observation time. See
`docs/architecture/vnext-archive-admission.md`.

The separate hosted-fuzz execution profile
`tinyrustlm.vnext.archive-fuzz-hosted-verification.v1` has SHA-256
`0943bba8ceba94c6f925cd5cb33d163c33d654e4e59266c00ca3ef6346bfc415`.
Its sole runner requires a clean matching GitHub-hosted Linux checkout, exact
run and job identities, `nightly-2026-08-01`, `cargo-fuzz 0.13.2`,
`libfuzzer-sys 0.4.13`, explicit AddressSanitizer, the frozen 29-seed corpus,
and an offline child-process environment that excludes workflow credentials.
It records exact bounded stdout/stderr identities and retained crash inputs,
removes only its owned scratch child, then creates one canonical path-free
pass or fail record. The strict verifier rejects drift, tampering, unexpected
files, noncanonical JSON, incomplete pass records, and local attempts to
manufacture a hosted run. CI source uploads this record on both success and
failure. No hosted artifact has yet been independently retrieved and verified,
so this source milestone is not a sanitizer-execution result.

`rust/crates/tinyrustlm-durability` now owns the sole Rust directory-flush
boundary. Its 7,021-byte frozen profile has SHA-256
`bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb`.
The helper accepts one canonical 1-to-1,024-member stdin batch, requires strict
operation-ID ordering and unique IDs, and flushes each exact relative
directory under caller-held stable path-topology ownership. It rejects link
and Windows reparse paths, opens each Win32 directory handle with exact
access/share/flag semantics, and emits only one canonical path-redacted batch
observation or one bounded failure with no partial success document. The sole
Node package/process client has a 5,845-byte
frozen profile with SHA-256
`0d5fe88e8abb371a99db58f1ce3fabce180dc00f77287b6f44ea40d268d709a1`
and source-closure SHA-256
`b265141e0749422bcdadefab7777c97d154f442ac18397f69664dd1af24447f3`.
Its `flushMany` method verifies package, executable, source, profile, platform,
batch request, process, and observation identities before returning one
independently bound result per operation from exactly one child process; its
size-one `flush` method is a wrapper. There is no inherited child environment
or shell. The current Windows host executes this boundary successfully, and
every current vNext store now requires it. A successful batch is not an atomic
filesystem transaction. OS network isolation, release-package provenance,
and real physical power-loss evidence remain incomplete. See
`docs/architecture/vnext-directory-durability.md`.

`tinyrustlm.vnext.controlled-power-loss-verification.v1` is the sole current
source verifier for a controlled physical attempt. Its frozen 7,665-byte
profile has SHA-256
`00f4f787d62ca6f388ae06acb4c23134144ad25668d749aac9cd91dca9decfd1`;
its exact six-member source closure has SHA-256
`de8a707cd97f20806f84f76afd07ea974c3cbef1f701ed33dcae5935ec1434ac`.
It verifies three canonical Ed25519 witness records against one exact helper
package and helper receipt, protected caller trust and time, exact state,
machine/volume/boot identities, filesystem/cache/interruption classes, and
bounded chronology. Its public replay operation regenerates verification from
all source evidence and requires byte-identical receipt output; there is no
public standalone receipt parser that can promote a self-described receipt.
Local helper tests can emit only `fixture-only`, and every receipt keeps broad
durability, release, and campaign authorization false. No real physical
attempt or production witness evidence exists. See
`docs/architecture/vnext-controlled-power-loss-verification.md`.

`tinyrustlm/tools/vnext-durable-publication.js` now composes file fsync,
hard-link create-if-absent publication, verified helper batches, exact target
readback, and one forward-only content-addressed activation receipt per target.
Its sole `publishMany` path fully preflights one to 1,024 targets, flushes all
target directories in one helper batch and all receipt directories in another,
and returns no partial API result. The size-one `publishBytes` method is only a
wrapper. Its 7,469-byte frozen profile has SHA-256
`4c1006a986ced8359346cb856ea698c03cc187ae7a0b77b8108719a043becc35`;
its six-member source closure has SHA-256
`845acd1da5aa060ad7eb15dee0fdb866d9ac13ea20a699fe13f4ea6b0592b2d9`.
The receipt is the explicit non-recursive persistence trust anchor: it excludes
its own publication observation to avoid a self-hash cycle, while creation and
restart both require helper-backed directory flushes and exact readbacks before
activation. A failed batch may leave preserved inactive files, so no atomic
all-or-nothing filesystem claim is made. No caller can inject filesystem or
helper success into this boundary. Receipt and subject ingestion use their
sole batch paths; campaign-artifact, campaign-operation, and append-only
runner-lock paths use the same durable primitive. Missing or mismatched
receipts are inactive. This closes the batch integration slice, not the
remaining archive, fuzz, physical durability, or campaign
gates. See
`docs/architecture/adr/ADR-012-durable-publication-bootstrap.md`.

`tinyrustlm/tools/vnext-campaign-runner.js` now composes those stores through
one exact runner boundary. Its frozen 7,703-byte profile has SHA-256
`c7e85b52c34fac59b65edee68d048c51fcdb5580321eb538dccc07c1164f68c3`.
The runner performs one full rebuild per opened receipt/subject store, then
observes every active receipt and subject twice through immutable membership
and exact physical readback. It rejects any membership, marker, or wire change,
binds caller pins, marker identities, and
trusted verification time in a create-only start record, invokes only the generated Rust campaign-evidence
ABI, validates the returned result again through Rust, and persists immutable
projection and terminal history. It exposes no evidence-subset, caller-verdict,
best-of-N, mutable-currentness, or stored-result promotion path. See
`docs/architecture/vnext-campaign-runner.md`.

`tinyrustlm/tools/vnext-campaign-release-surface.js` now consumes that runner
only by creating a never-before-used operation and receiving its exact result
inside the same call. Its frozen profile has SHA-256
`a7d82d79e28ee6fded64a47ad0be4a47003fe498a1de835824d2ff2b425f57ee`.
The surface independently validates the returned projection against the exact
stored plan and runner operation records, finalizes a content-addressed
complete-or-blocked attestation, scans the final canonical bytes against the
one signed custody revision pinned when the surface opens, and derives a canonical operator
status with no `done` state. Its `prepareRelease` operation additionally
requires complete 20/50/25/40/20 campaign truth; all 20 qualified artifact
hashes; dependency closure; one CycloneDX 1.6 SBOM; current artifact,
qualification, package, provenance, and claim evidence from the same runner
snapshots; every current approved claim for the source revision; sorted risks;
and a canonical scanned changelog. It derives release time from trusted
verification time, scans every selected document and the final manifest,
persists redaction evidence before the create-only manifest, and returns
`not-authorized`. Its `authorizeRelease` operation then reconstructs the exact
runner start/terminal records, complete stored projection, original receipt and
subject snapshots, selected release evidence, and all three preparation scan
receipts before it admits an authorization. It accepts only one canonical
`signature-envelope` child whose role is `release-authorizer`, scope is
`release-authorization`, signed subject and `releaseId` are the exact prepared
manifest, source revision and campaign match, lifetime is finite, and current
vNext authority-graph result is fully eligible under caller-pinned root and
terminal registries. The authorization receipt is scanned before create-only
persistence; a restarted surface can repeat the exact operation idempotently.
Its `admitDeploymentAttempt` operation then replays the complete authorized
lineage and current authority graph before accepting one canonical
`deployment` receipt. That receipt is closed to the exact manifest, static
inventory, control documents, authorization receipt reference, current
web-build phase parent, campaign attestation reference, origin, byte count,
and deployment-class executor. Its frozen scope is
`deployment-attempt-only`; it cannot assert deployment success. The receipt is
secret-scanned and persisted only after its deterministic redaction receipt,
with byte-identical crash recovery and replay.
Its `verifyPublicReadback` operation then reconstructs the exact prepared,
authorized, and deployment-admitted closure, reruns current Ed25519 authority,
and invokes the sole production HTTPS verifier itself. The caller cannot
supply DNS, transport, response, body, result, retry, or success state. The
surface independently validates the canonical verifier result against the
manifest and frozen verifier/source identities, scans the result and finalized
receipt, and create-only persists the deterministic redaction receipt before
the `public-readback` receipt. Only exact dependency prefixes and byte-identical
replay are accepted. Its result is explicitly
`public-readback-verified-awaiting-publication` and `not-published`.
`prepareSitePublication` then reconstructs that exact closure, creates and
scans deterministic plan material, and create-only persists the scans before
one `site-synchronization` plan receipt. `authorizeSitePublication` requires
one exact, finite, current-evidence-eligible `site-publisher` signature over
that plan under the caller-pinned authority graph, invokes the pure
materializer, and scans the signature plus every pointer, history, and direct
published-claim candidate. It persists only signature and scan evidence and
returns no published claim. `admitGeneratedDeploymentAttempt` then reconstructs
that entire lineage and accepts only one externally produced canonical
attempt-only receipt bound to the exact two-file generated inventory.
`verifyGeneratedPublicationReadback` invokes the sole production verifier over
the sorted static-plus-generated closure, independently revalidates its result,
and persists only the readback scan and receipt. `finalizeSitePublication`
reruns current publisher authority, reconstructs all candidates byte-for-byte,
reverifies every parent and scan, persists a lexicographic create-only claim
prefix, and writes the scanned final commit receipt last. Partial prefixes are
inert and exact-restart resumable. No local operation grants campaign credit.
Stored projection bytes, caller counters, caller verdicts or authorization
decisions, reused/interrupted/failed preparation operations, omitted or stale
release parents, authority drift, unsafe bytes, mutable pointers, and
compatibility inputs are rejected. See
`docs/architecture/vnext-campaign-release-surface.md`.

`tinyrustlm/tools/vnext-public-https-readback.js` defines the sole
production-network verifier invoked by the release-surface readback operation.
Its frozen profile has SHA-256
`a5d5fd2bcc08e1444f82c474e1c829ba8e108c53a0e52b0651cab1843d8edb73`.
It accepts no caller resolver, transport, response, body, verdict, retry
policy, or alternate profile. It requires one canonical public HTTPS root,
rejects any nonpublic DNS result, pins one address for the complete inventory,
uses normal system trust and hostname verification, forbids redirects and
encoded or transferred variants, verifies exact status, length, media type,
cache and security headers, and streams every body to the manifest byte count
and SHA-256. It also rejects model-byte routes, stable immutable paths, and
invalid bootstrap or worker policy before DNS. Its canonical result discloses
only bounded observation metadata
and domain-separated DNS, pinned-address, and certificate identities. The
module writes no receipt and does not establish deployment success,
outside-network independence, publication, or campaign credit. See
`docs/architecture/vnext-public-https-readback.md`.

`tinyrustlm/tools/vnext-site-publication.js` is the pure forward-only
materializer after static readback. Its frozen profile SHA-256 is
`d959ce557e8b18a71514e2388a8eda7162182e38f5febf2e1a39b063fa5ba4bc`.
It requires the exact release, all approved claims, exact static-readback
receipt, bound generator, and either no history or canonical history from this
one current profile. One structurally exact `site-synchronization` plan receipt
and one release-bound `site-publisher` signature deterministically produce
canonical pointer/history candidates and direct `published` claim descendants.
It rejects the superseded ledger schema rather than reading or upgrading it.
The module has no network, clock, persistence, signing, or mutation capability;
all outputs remain explicitly unpersisted and `not-published` until the sole
release surface admits an exact generated-deployment attempt, performs complete
production readback, and admits final descendants. The surface owns plan
persistence, current site-publisher authority, candidate redaction, generated
deployment/readback admission, restart-safe claim persistence, and the final
publication commit. See
`docs/architecture/vnext-site-publication.md`.

The authority result deliberately separates `signatureVerified`,
`authorityAtIssue`, `temporalCurrent`, and `currentEvidenceEligible`. A valid
historical Ed25519 signature is not current evidence when its envelope is
expired, its terminal key is retired or revoked, its registry is not current,
or compromise history makes it stale. `authorityGraphVerified` means the
provided bounded graph was reconstructed and its signatures were processed;
callers must use `currentEvidenceEligible` for current evidence admission.
The offline verifier additionally requires a current terminal registry and
current eligibility for every declared target signature. Expired governance
envelopes may authenticate immutable history but cannot become target-current
evidence.

The frozen offline profile is 3,625 bytes with SHA-256
`2b14f8e2d4d176e020d2c3e89d05dda07acc933bc76df6044ddd5b4e7d751756`.
The manifest excludes its verification receipt to avoid a manifest/receipt
hash cycle; the receipt is finalized afterward and binds the manifest hash and
complete member set. `docs/architecture/vnext-offline-verification-bundle.md`
defines the exact boundary.

This remains an incomplete campaign implementation checkpoint. Exact
campaign-plan finalization, semantic currentness, the Ed25519 primitive, the
complete signature authority graph, offline-bundle closure, truthful
projection, and projection-result validation have independent Rust parity.
Exact plan/projection-result persistence is implemented, and one generated
real-browser WASM boundary exposes plan, currentness, projection, and result
validation with exact frozen-corpus parity. One bounded local runner now
performs exact cross-store snapshots, Rust-backed projection, immutable
operation history, interruption recovery, and concurrent-operation exclusion.
The superseded mutable runner and its test are deleted without an alias or
compatibility entry point. One fresh-runner-bound immutable final-attestation
and operator-status surface now also prepares a create-only, public-safe,
explicitly unauthorized `release_manifest.v3` from complete fresh campaign
truth and exact current snapshot inputs. It requires one current-pass web-build
receipt over the public origin, changelog, deployment manifest,
security-header profile, publication generator, and exact static inventory.
The manifest binds closed path/hash/size/type/cache/header metadata, excludes
model-byte routes, and permits `immutable` caching only when the path contains
the full content SHA-256. Generated pointer and history bytes are forward-only
site-publisher descendants because embedding bytes that name the manifest
inside that same manifest would be self-referential. The same surface now
verifies and
create-only persists a current Ed25519 release-authorizer signature as the
manifest's forward-only child without mutating the manifest. It now also
admits a create-only, explicitly non-success deployment-attempt descendant.
The standalone production-only exact HTTPS verifier is now integrated through
one immutable release-surface receipt operation. Its tests include only
fixture-labeled orchestration evidence; no production invocation is claimed.
Deterministic pointer/history and published-claim candidate materialization is
implemented as a pure module and integrated behind create-only plan evidence
and current site-publisher authority. Generated-file deployment admission,
complete readback, restart-safe descendant persistence, and final publication
admission are integrated into that same surface. The incompatible source
cutover deletes the superseded mutable publication implementation, dedicated
tests, aliases, snapshots, schemas, and maintained documentation without a
compatibility path. This remains local conformance evidence, not a production
readback, outside-network observation, or live campaign result.
Runtime tests generate ephemeral private keys only in process memory.
Checked-in profiles and vectors contain public material only.

## Completion Boundary

The registry freezes design and is not itself implementation evidence. The
separately identified SLM2 checkpoints prove bounded format conformance and
canonical-fixture scalar native/browser-WASM conformance. They do not prove
source conversion, tokenizer/template correctness, real-model runtime parity,
model quality, product browser activation, or production admission.
The browser worker, companion, P2P fleet, observer, release system, and claim
renderer still require their corresponding phase tests and objective receipts.
No campaign counter is earned by this registry or the local SLM2 checkpoint.
