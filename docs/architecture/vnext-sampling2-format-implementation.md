# Sampling2 Format Implementation Checkpoint

## Status

This document records the development-only Sampling2 2.0 native checkpoint on
2026-08-22. One exact binary profile, one normative exponential-weight table,
an independent Node-core implementation, an unsafe-free Rust implementation,
and language-neutral vectors are implemented and pass focused local gates.

This is not native/WASM composition evidence. No real model, production worker,
fresh browser profile, browser deletion, performance benchmark, quality gate,
release, deployment, publication, or campaign counter is established.

## Exact Authorities

| Authority | Exact identity |
| --- | --- |
| Profile | `org.minimodel.sampling2/2.0`; 19,333 bytes; SHA-256 `ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d` |
| Normative Q48 table | 65,544 bytes; SHA-256 `fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677` |
| Vector document | 151,569 bytes; SHA-256 `4fe731f2e8714e9a6fe7689964a88a7fbe8150faf6af053cbf0be38390daaa9f` |
| Canonical artifact | 65,800 bytes; SHA-256 `9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89` |
| Independent Node implementation | 38,906 bytes; SHA-256 `bd7b4ed8cf1bdaef10f8b2041df476f842b08e0d65325d0b0e439cd0b8697b7b` |
| Rust implementation | `rust/crates/tinyrustlm-sampling2`; unsafe forbidden |

The profile is normative. The generated table bytes are normative. The
exponential formula documents their independent derivation and is not a
runtime operation. `.gitattributes` classifies every vNext `.bin` authority as
binary, and the Node contract verifies that Git's filtered and unfiltered blob
identities are equal for this table.

The Rust crate is intentionally a standalone Cargo workspace with an exact
lockfile. The completed Template2 registration binds the root `Cargo.toml` and
`Cargo.lock` byte-for-byte, so adding Sampling2 to that workspace would
invalidate accepted evidence. Standalone isolation preserves the frozen
closure and does not create a second product sampler, fallback, or legacy path.

## Binary Boundary

The artifact has one exact 256-byte header followed by one terminal table of
8,193 little-endian `u64` weights. There is no padding or optional section.

The header freezes version, byte order, algorithm profiles, table geometry,
weight and logit scales, vocabulary and resource ceilings, accepted scaled
configuration ranges, and the exact table SHA-256.

The parser rejects wrong size, location, count, width, profile number, flags,
limits, table hash, table values, reserved bytes, and trailing data. It then
requires the canonical whole-artifact SHA-256.

The writer has no caller-supplied table or feature flags. It writes only the
sole accepted artifact after rehashing the profile and embedded table.

## Logit Boundary

Sampling consumes exact binary32 bit patterns indexed by token ID. This avoids
an unstated cast between Rust `f32`, JavaScript `Number`, and WebAssembly.

NaN and positive infinity fail. Negative infinity is the one mask value.
Finite values become signed Q20 integers by decomposing sign, exponent, and
fraction fields and applying exact round-to-nearest, ties-to-even.

Both zero encodings become zero. Values outside the frozen magnitude fail.
All later operations remain in checked integer arithmetic.

## Candidate Boundary

Repetition applies once per unique token found in the configured tail of
generated non-stop history. It excludes the prompt and sampled stop tokens.

Positive scores divide by penalty; negative scores multiply by penalty. Score
ties resolve by lower token ID. Top-k takes the first exact prefix.

Greedy operation requires temperature zero, top-k one, and top-p one million.
It consumes no random state.

Sampled operation converts fixed score gaps to one of the normative Q48
weights. A gap beyond the table has zero weight. Top-p takes the shortest
prefix meeting the exact integer ceiling target.

## PRNG Boundary

One `u64` seed expands through four SplitMix64 words. Token selection uses the
exact xoshiro256** transition. State is exactly 40 bytes: four little-endian
words and a consumed-word counter.

Weighted choice draws a `u128` from two successive words. Rejection against
`2^128 mod bound` removes modulo bias. A registered vector forces seven
rejected two-word candidates before acceptance, proving that rejection and
state accounting are part of conformance.

The PRNG is deterministic and statistical. It is not a cryptographic random
generator and does not make a seed secret. Product evidence nevertheless
keeps private run seeds and prompt-derived state out of public receipts.

## Generation Boundary

The controller accepts an explicit config, prompt-token count, model
vocabulary, ordered unique stop set, and seed state. No field has a default.

Before generation, a host that reserves a smaller KV context calls
`GenerationController::restrict_context` with that admitted token ceiling.
`ConversationRuntime::begin_request` applies this restriction before prefill or
activation mutation. Zero, expansion, a ceiling below the prompt count, or a
change after sampling/cancellation fails without changing controller state.
A prompt exactly at the runtime ceiling is already terminal. Otherwise the last
admitted token remains in the output and ends with `ContextLimit`, before another
scalar forward could exceed the cache. This resource restriction changes neither
the Sampling2 artifact nor the Prompt2 model-wide wire contract.

Its states are active, stop-token, maximum-new-tokens, context-limit, and
cancelled. Cancellation precedes model sampling and consumes no state. A stop
token terminates without entering generated history. Context limit wins when
context and maximum-new-token limits become true on the same appended token.

Every terminal state is immutable. A second step fails with a stable code.
There is no output repair, retry for preference, or best-of-N selection.

## Independent Vectors

`tinyrustlm/tools/sampling2-reference.js` uses Node core only. It does not call
Rust, a model, a child process, or a network.

The vector document freezes:

- one exact artifact and table;
- 12 targeted artifact mutations;
- rejection of every proper artifact prefix;
- 11 binary32-to-Q20 cases;
- three eight-word seed and PRNG cases;
- one forced `u128` rejection case consuming 16 words;
- seven greedy, repetition, mask, top-k, temperature, and top-p cases;
- five stop, generation-length, context, cancellation, and initial-terminal cases;
- eight malformed-operation outcomes.

The Rust integration tests parse the independent JSON and replay exact values.
The Rust implementation does not parse JSON or invoke Node at runtime.

## Historical Format Verification

The focused checkpoint passes:

- nine Node generator/parser/semantic and binary-preservation tests;
- ten Rust format and terminal-state contract tests;
- eight Rust cross-language vector tests;
- byte-identical table and vector regeneration;
- all 65,800 proper-prefix rejections;
- locked Rust dependency resolution.

The complete affected source, denied-warning Clippy, hygiene, documentation,
and source-control gates remain required before this checkpoint is pushed.

The September 20 runtime-context correction adds four parameter-sensitive
Sampling2 cases and a real scalar/controller integration regression. All 76
affected Rust tests and denied-warning Clippy pass. The local WASM is rebuilt
from the corrected source and reproduced by two fresh offline builds. See
`artifacts/ecosystem-cleanup-20260912/runtime-context-limit-review.json` for
identities, browser boundary checks and limits; a small synthetic scalar model
does not establish full-composition conversation quality.

## Next Composition Gate

1. Bind the accepted Template2 and Tokenizer2 artifact identities without
   changing either accepted implementation or evidence set.
2. Tokenize Template2 ordinary spans and inject each template-owned control ID
   exactly once.
3. Independently encode the complete rendered prompt and require exact token
   sequence equality to detect missed or double insertions.
4. Bind the exact Sampling2 artifact, selected config, ordered stop set, model
   vocabulary, runtime binary, native interface, and WASM interface.
5. Preregister execution and independent verification before comparative
   native/browser output exists.
6. Run two fresh real-Chromium profiles with zero network, exact repeated
   output, true worker termination, fresh-worker recovery, process closure,
   and owned-profile deletion.

## Claim Boundary

This checkpoint proves a local deterministic Sampling2 contract and two
independent implementations. It does not prove production composition,
browser execution, real-model behavior, answer quality, P2P acquisition,
deployment, publication, or campaign progress.

MemoryEndpoints is authorized for direct agent coordination and the separate
opt-in Connect user-memory lane. This Sampling2 verification executes neither
lane. Campaign counters remain 0/20 models, 0/50 browser rounds, 0/25 live memory
rounds, 0/40 outside-proven lanes, and 0/20 announcements.
