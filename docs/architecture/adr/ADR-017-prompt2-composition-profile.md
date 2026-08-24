# ADR-017: Exact Prompt2 2.0 prompt-composition profile

## Status

Accepted

Prompt2 2.0 is accepted as the sole clean-slate composition boundary joining
the exact Tokenizer2, Template2, and Sampling2 authorities for the first SLM2
vertical slice.

The canonical artifact, three binary wires, independent Node implementation,
unsafe-free Rust implementation, and cross-language vectors pass focused local
tests. The runtime implementation exists, but full accepted-artifact native
composition and browser-WASM execution remain preregistered future work.

Prompt2 remains development-only and unpromoted. It grants no real-model,
quality, browser-chat, release, deployment, publication, MemoryEndpoints, or
campaign claim.

## Decision Date

2026-08-22

## Scope

This decision defines the exact boundary from one ordered message sequence,
complete Sampling2 configuration, and u64 seed to one rendered prompt, prompt
token sequence, mapped control-insertion sequence, ordered stop set, initial
Sampling2 state, and generation-controller status.

It covers the Prompt2 artifact, dependency binding, load bundle, request wire,
result wire, rendering ownership, tokenization ownership, rendered-token
recomposition, control mapping, controller construction, resource ceilings,
stable errors, and fail-empty behavior.

It does not define model tensor bytes, source conversion, transformer
operators, logits, decoding generated output, model quality, P2P acquisition,
MemoryEndpoints, catalog publication, site deployment, or campaign promotion.

**Observed local fact**: independent Node and unsafe-free Rust implementations
reproduce the exact Prompt2 artifact, request wires, result wires, boundary
status, and all registered rejection codes.

**Engineering decision**: no component outside Prompt2 may independently
assemble a production SLM2 prompt or choose an alternate control-token,
stop-token, seed, or initial-controller path.

**Local verification required**: the exact full Tokenizer2, Template2,
Sampling2, request corpus, native executable, and future WASM module must be
preregistered before any comparative full-composition output is produced.

## Decision

The sole accepted profile identifier is `org.minimodel.prompt2/2.0`.

The canonical artifact is exactly 512 bytes. It starts with `PRM2`, CRLF, SUB,
LF and the fixed 16-byte `minimodel.prm2` format identifier. It accepts only
major 2, minor 0, the little-endian marker, zero flags, and zero reserved
bytes.

The artifact binds exact Tokenizer2, Template2, Sampling2, sampling-table,
source-model-configuration, source-template, SLM2 format, and SLM2
runtime-Q8-vector hashes. It also freezes all dependency byte lengths, tokenizer
token count, model vocabulary, resource ceilings, explicit disabled-thinking
mode, no automatic BOS, no automatic EOS, and the ordered stop set.

The sole artifact is 512 bytes with SHA-256
`27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3`.
Alternate dependency hashes, sizes, field values, flags, versions, reserved
bytes, prefixes, and trailing bytes are fatal.
The prior dense-F32 SLM2 profile and scalar-runtime-vector digests are explicit
hostile vectors and have no executable fallback.

The load wire is `tinyrustlm.prompt2-load-bundle/1`. It contains one 128-byte
header followed by exactly Prompt2, Tokenizer2, Template2, and Sampling2 bytes
in that order, with no padding or trailing bytes. Its exact accepted full size
is 7,106,616 bytes.

Load geometry is not dependency validity. Runtime construction independently
hashes each section and invokes each dependency's canonical parser. A tiny
fixture, same-length fake, alias, URL, path, or prior profile cannot satisfy
the dependency gate.

The request wire is `tinyrustlm.prompt2-request/1`. It contains one to 256
closed-role UTF-8 messages, contiguous records, zero alignment padding, all
six Sampling2 configuration integers, and one u64 seed. Missing or unknown
configuration is impossible in the typed Rust API and fatal at the wire.

Template2 remains the sole authority for message role ordering and forbidden
control strings. Prompt2 does not duplicate or relax that algorithm. A wire
can be structurally parsed before compilation; compilation invokes Template2
and maps any rejection to a stable Prompt2 boundary error.

Prompt2 renders the complete request through Template2 exactly once. The
result must report explicit disabled thinking, no automatic BOS or EOS, and
ordered stops `[151645, 151643]`.

Prompt2 encodes the complete rendered UTF-8 through Tokenizer2 exactly once.
It then independently performs rendered-token recomposition: every
non-control span is encoded, every Template2-declared control token is inserted
once, and the resulting full token array must equal the whole-prompt encoding.

Every insertion records kind, optional source message index, token ID,
rendered byte offset, and token index. The sequence is exactly message start
and end for every source message, then generation start, thinking start, and
thinking end. Duplicate, missing, reordered, or unmapped controls are fatal.

The prompt token count may not exceed 40,960. Prompt2 does not truncate,
summarize, drop, or repair a request to fit. A prompt of exactly 40,960 tokens
creates a terminal context-limit controller and performs no sampling. A
shorter prompt creates an active controller.

Prompt2 expands the caller's exact u64 seed through Sampling2 and constructs
one controller using model vocabulary 151,936, the complete caller-supplied
configuration, and stops `[151645, 151643]`. It does not select a product
default, reseed, retry, or choose best-of-N.

The result wire is `tinyrustlm.prompt2-result/1`. It contains exact rendered
UTF-8, all prompt tokens, all insertions, stops, one valid 40-byte Sampling2
state, and active or context-limit status. All sections are 64-byte aligned
where declared, all padding is zero, and trailing bytes are fatal.

Result parsing checks semantic closure as well as geometry. Token IDs must be
within the bound Tokenizer2 token count. Control bytes and token indexes must
agree. Every declared control-token occurrence must have exactly one
insertion. State must be a valid nonzero xoshiro256** state. Status must agree
with prompt-token count.

Every failure returns no Prompt2 result and no selected token. There is no
response repair, compatibility parser, fallback, dual composition, or legacy
template path.

The Prompt2 artifact intentionally does not bind a model artifact. A later
composition graph must bind one exact qualified SLM2 model, conversion receipt,
Prompt2 artifact, selected configuration, and runtime identities.

## Alternatives

Letting each browser or native caller concatenate template strings was
rejected. It would create multiple whitespace, control, and BOS/EOS
authorities.

Trusting only whole-prompt Tokenizer2 output was rejected. Independent
non-control-span recomposition catches omitted, duplicated, or split control
markers at the ownership boundary.

Trusting only recomposed output was rejected. Whole-prompt encoding remains
the actual Tokenizer2 operation and must match independently.

Embedding the full Tokenizer2 artifact inside Prompt2 was rejected. Artifact
identity and algorithm ownership remain separate, while the exact load bundle
binds their execution together without duplicating bytes in source control.

Binding a model artifact before one qualifies was rejected. Prompt2 can close
prompt semantics without falsely implying that a real model exists.

Using JSON for large runtime wires was rejected. Fixed little-endian binaries
provide closed fields, bounded parsing, exact offsets, and inexpensive
transfer to WASM.

Adding optional request defaults was rejected. Every Sampling2 parameter and
seed must be explicit and evidence-bound.

Automatically truncating old turns was rejected. Context compilation and
memory authority require a later explicit contract; Prompt2 cannot silently
change user input.

Accepting a one-token result marked context-limit was rejected after review.
The status is now coupled to exactly 40,960 prompt tokens.

Weakening strict JSON to store one oversized vector string was rejected. The
exact result wire is split into deterministic 32 KiB chunks in the vector
document while strict parser limits remain unchanged.

Wrapping a historical prompt builder was rejected. Prompt2 is one new
incompatible implementation with no shim, alias, migration, legacy reader, or
fallback.

## Authoritative Evidence

The normative machine profile is
`contracts/vnext/prompt2-format-profile.v1.json`, 19,421 bytes with SHA-256
`f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c`.

The independent vector document is
`contracts/vnext/prompt2-format-vectors.v1.json`, 347,532 bytes with SHA-256
`4b4a4497245ee371e4f3e2b930e3413caa0f8bb70b04c3385880b11de83c487e`.

The independent Node implementation is
`tinyrustlm/tools/prompt2-reference.js`, 58,803 bytes with SHA-256
`7beb1edec00d0f24f8c308419a0b00e30abee090c331a5d563a6783f4e9f04ef`.
It imports only accepted local JavaScript contract authorities and Node core
crypto, filesystem, and path modules. It invokes no Rust, subprocess, network,
template engine, or model.

The unsafe-free product candidate is
`rust/crates/tinyrustlm-prompt2`. It owns an exact standalone lockfile with
SHA-256
`48dca83e7e45403cc012835e593db612003ed49c5fd9024473f1f52a9af21b29`.
This preserves immutable root Cargo inputs; it is not a compatibility runtime.

The vector corpus owns one artifact, all 512 proper artifact prefixes, 15
artifact mutations, three requests, nine request mutations, one active result,
one structural 40,960-token context-limit result, and 18 result mutations.
The two additional artifact mutations install the exact superseded SLM2
dependency digests and require stable fail-closed rejection.

Focused local evidence includes 11 passing Node tests, four passing Rust
contract tests, and three passing Rust cross-language vector tests. Rust
formatting and all-target Clippy with warnings denied pass.

The first strict JSON test rejected an oversized result-hex string. No
accepted or committed vector existed. The generator was corrected to emit
bounded chunks, and the strict parser then passed. This is preserved as a
failure-driven contract improvement, not hidden as a pass.

## Threat Analysis

An attacker could forge dependency lengths while substituting bytes. Runtime
construction validates both exact length and whole-artifact hash before use.

Overlapping or gapped load sections could reinterpret bytes. Sections must be
exactly contiguous in one fixed order and consume the entire bounded input.

Malformed request offsets could expose unrelated memory or allocate excessive
buffers. Counts and offsets use checked arithmetic, exact alignment, contiguous
relative ranges, and hard total ceilings.

Invalid UTF-8 could create byte/string disagreement. Every wire string is
strict UTF-8 and Rust-owned strings preserve exact bytes without normalization.

Quoted content could inject template control tokens. Template2's complete
forbidden-content set remains authoritative during compilation.

A caller could duplicate a special token after tokenization. Whole encoding,
span recomposition, byte offsets, token indexes, and control occurrence closure
must all agree.

A result could claim context limit early or remain active at the ceiling.
Status is coupled to the exact token count.

An all-zero PRNG state could create an invalid xoshiro cycle. Sampling2 state
parsing rejects it before a result is admitted.

An implementation could insert BOS or EOS because tokenizer metadata names
them. Prompt2 requires both automatic insertion flags false and compares exact
whole output.

An implementation could silently use another stop order. The Prompt2 artifact,
Template2 result, generation controller, and result wire all require the same
ordered pair.

A browser boundary could retry after cancellation or select an attractive
output. Prompt2 contains no retry or selection mechanism; true worker
termination and fresh-worker recovery remain required browser evidence.

A public report could expose prompts or seeds. Future bounded evidence will
carry hashes, counts, versions, statuses, and resource measurements, not raw
private prompts, request wires, states, or credentials.

## Performance Evidence

No production performance claim is made. Focused tests establish format and
native-core correctness only.

The load bundle is 7,106,616 bytes, dominated by the accepted Tokenizer2
artifact. Its maximum is explicit. The current Rust constructor owns validated
dependency instances and performs no network or model load.

Prompt compilation performs one whole render, one whole encode, and one
bounded recomposition pass. Recomposed span encoding is deliberate independent
evidence, not an optimized product claim.

Result storage is bounded by 1,310,720 bytes. Request storage is bounded by
1,054,848 bytes. Control insertions are bounded by 515.

Promotion requires native and fresh-Chromium measurements for load time,
compile time, peak linear memory, allocation growth, result serialization,
worker cancellation, termination, fresh-worker recovery, process closure, and
profile deletion. Correctness gates cannot be relaxed to meet timing goals.

## Compatibility Impact

Prompt2 2.0 is intentionally incompatible with every historical prompt
builder, SLM1 path, unspecified chat template, sampler default, and ad hoc
worker request.

There is no version range, alias, migration reader, dual writer, compatibility
shim, response repair, implicit default, template fallback, or legacy support.

An artifact or wire with another magic, version, identity, field, order, flag,
padding byte, dependency, or trailing byte fails closed.

TinyRustLM is pre-public, so clean replacement is the supported policy.

## Clean Deletion Impact

When Prompt2 enters the production SLM2 path, every duplicate prompt
concatenation, BOS/EOS insertion, stop-token default, JavaScript-only
composition loop, and historical sampler bridge must be deleted.

The Node implementation remains a development oracle and vector generator. It
must not ship as a browser fallback.

The standalone Rust workspace may join a later production closure only through
a preregistered composition update that does not mutate completed dependency
evidence.

Any obsolete unpublished Prompt2 profile is deleted after its replacement
passes. Immutable registered failure evidence remains history but never becomes
an accepted alternate path.

## Unknowns

Full accepted-artifact native composition output has not yet been generated.

The exact output-free composition corpus and verification preregistration are
not yet frozen.

The production raw WASM interface, adapter, worker, and browser runner are not
yet implemented.

Real Chromium execution, zero-network observation, worker termination,
fresh-worker recovery, process closure, profile deletion, and resource
measurements remain open.

No real SLM2 model artifact is bound. Source-framework parity, inference,
quality, and multi-turn behavior remain open.

The final product sampling configuration is a later immutable composition
input. It cannot be inferred from this artifact.

MemoryEndpoints is unauthorized and disconnected. No account, company,
credential, continuity, or cleanup operation is implied.

## Acceptance Tests

The Node generator must reproduce the profile-bound artifact and all vectors
byte-for-byte under the strict JSON parser.

The Rust writer must reproduce the Node artifact exactly. Both parsers must
reject all registered artifact, request, and result mutations with exact
stable errors.

Every proper 512-byte artifact prefix must reject. Surplus bytes must reject.

The active and 40,960-token context-limit result wires must round-trip exactly,
including token-array hash, control mapping, stop order, state, and status.

Load geometry must reproduce the exact 7,106,616-byte layout, and same-length
fake dependencies must fail identity validation.

Formatting, denied-warning Clippy, locked tests, documentation inventory,
strict JSON, secret/path scanning, and affected standard tests must pass before
check-in.

Before comparative composition output, corpus, artifacts, executable, WASM,
browser, resource ceilings, output paths, and verifier must be preregistered,
committed, pushed, fresh-fetched, and remote-exact. Output roots must be absent.

Two fresh Chromium profiles must reproduce exact registered native results
with zero network, no retries or repair, true worker termination, fresh-worker
recovery, process closure, and owned-profile deletion.

Model promotion additionally requires one exact real SLM2 artifact,
conversion receipt, native scalar parity, browser-WASM inference parity,
untouched behavioral quality evidence, and a complete composition graph.

## Rollback

Before promotion, rollback means delete the unpublished Prompt2 integration
and return to the prior clean commit. It does not mean activate a historical
prompt builder or add a compatibility mode.

After evidence registration, raw outputs and bounded results remain immutable.
A defect requires a new profile identity, vectors, implementation, ADR update,
and rerun of only invalidated Prompt2 descendants.

Accepted Tokenizer2, Template2, and Sampling2 evidence is not rerun when its
bytes and tools remain unchanged.

No rollback can convert local tests into browser evidence, a missing model into
a quality pass, an unauthorized MemoryEndpoints operation into continuity, or
zero campaign counters into progress.
