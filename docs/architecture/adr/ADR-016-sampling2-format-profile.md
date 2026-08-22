# ADR-016: Exact Sampling2 2.0 deterministic token-selection profile

## Status

Accepted

Sampling2 2.0 is accepted as the sole clean-slate sampling artifact and token
selection algorithm for the first SLM2 vertical slice. The binary contract,
normative Q48 weight table, independent Node writer/parser/sampler, unsafe-free
Rust writer/parser/sampler, explicit generation controller, and cross-language
vectors are implemented and pass focused local tests.

The profile remains development-only and unpromoted. It has not yet been
composed with the accepted Template2 and Tokenizer2 artifacts, executed through
the production WASM boundary, measured in fresh Chromium, or used with a real
model. It grants no model-quality, browser-chat, release, deployment,
publication, or campaign claim.

## Decision Date

2026-08-22

## Scope

This decision defines deterministic admission and selection of one token from
one indexed sequence of exact IEEE-754 binary32 logits.

It covers the Sampling2 binary artifact, fixed-score conversion, negative
infinity masking, repetition penalty, stable ties, top-k, temperature weights,
top-p, SplitMix64 seed expansion, xoshiro256**, exact serialized PRNG state,
unbiased `u128` selection, stop-token consumption, maximum generation length,
context limit, cancellation, terminal states, limits, and stable errors.

It does not define transformer operators, tokenizer behavior, prompt
rendering, stop-token meaning, product sampling configuration, decoding,
response quality, answer repair, retry selection, acquisition, deployment, or
campaign promotion.

**Observed local fact**: the independent Node implementation and unsafe-free
Rust implementation reproduce the same 65,800 artifact bytes, fixed-score
vectors, PRNG sequences, sampled token IDs, post-sample state bytes, and
generation terminal states.

**Engineering decision**: production sampling performs no host transcendental
operation and no host floating-point arithmetic after exact binary32
admission. Every score transformation uses checked integer arithmetic.

**Local verification required**: native and production WASM composition must
still prove identical logits, configuration, state, token selection, stop
handling, cancellation, and recovery in two fresh real-Chromium profiles.

## Decision

The sole accepted profile identifier is `org.minimodel.sampling2/2.0`.

The artifact starts with `SMP2`, CRLF, SUB, LF and the fixed 16-byte format ID
`minimodel.smp2` followed by two zero bytes. It accepts exactly major 2,
minor 0, little-endian values, algorithm profile 1, and zero feature flags.

The header is exactly 256 bytes. The terminal weight table starts at byte 256
and contains exactly 8,193 little-endian `u64` records. Gaps, padding,
overlap, aliases, unknown values, nonzero reserved bytes, and trailing bytes
are fatal. The sole artifact is 65,800 bytes with SHA-256
`9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89`.

The normative 65,544-byte weight table has SHA-256
`fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677`.
Its explanatory generation formula is
`round-ties-to-even(exp(-index/256) * 2^48)` for indexes 0 through 8,192.
Production never evaluates that formula. It consumes only the hash-bound
table bytes. Record zero is `2^48`, the terminal record is `4`, every record
is positive, and the sequence is monotonically nonincreasing.

Runtime configuration is complete and explicit. It carries temperature,
top-k, top-p, repetition penalty, repetition window, and maximum new tokens.
There are no implicit defaults. Unknown or missing fields fail at serialized
boundaries. Greedy operation uses temperature zero and additionally requires
top-k one and top-p one million.

Logit sequence index is token ID. Vocabulary length is one through 151,936 and
must later equal the composed model vocabulary. NaN and positive infinity are
fatal. Exact negative infinity is the sole mask encoding. An all-masked
sequence is fatal.

Finite logits are converted from their exact binary32 fields into signed Q20
integers with round-to-nearest, ties-to-even. Both zero encodings become zero.
Values whose rounded magnitude exceeds `32768 * 2^20` fail. This conversion is
defined by integer shifts and division, not by a host float cast.

Repetition considers unique IDs in only the last configured generated
non-stop tokens, up to 64. Prompt tokens and sampled stop tokens are excluded.
Positive scores divide by the penalty; negative scores multiply by it. Both
operations use millionths and round-ties-to-even with checked `u128`
intermediates.

Candidates are ordered by adjusted score descending and token ID ascending.
Top-k takes the first bounded prefix. Greedy returns its first candidate and
does not consume PRNG state.

For sampled operation, each score gap from the maximum becomes a table index:
`round-ties-to-even(gapQ20 * 256 * 1000000 /
(temperatureMillionths * 2^20))`.
An index over 8,192 has zero weight. Weight sums use `u128`.

Top-p computes `ceil(totalWeight * topPMillionths / 1000000)` and retains the
shortest nonempty stable prefix meeting that target. There is no float
renormalization.

One `u64` seed expands into four words through the exact SplitMix64 profile.
Sampling uses xoshiro256** with wrapping `u64` arithmetic. State serialization
is exactly five little-endian `u64` values: `s0`, `s1`, `s2`, `s3`, and
consumed-word count. An all-zero state is fatal.

Weighted choice concatenates two consecutive PRNG words as a `u128`. It uses
the exact threshold `2^128 mod bound`, rejects candidates below the threshold,
and returns accepted candidate modulo bound. Algorithmic rejection is part of
one sample operation; it is not a product retry or best-of-N policy.

Template2 owns the ordered stop set. Sampling2 validates and consumes the set
but does not assign token meaning. A selected stop token is terminal metadata
and is not appended to generated history or decoded assistant content.

The controller has five states: active, stop-token, maximum-new-tokens,
context-limit, and cancelled. Cancellation precedes sampling and consumes no
random words. Stop precedes append. After one non-stop append, context limit
precedes maximum-new-tokens when both become true. Terminal controllers cannot
sample again.

Sampling2 returns no token on failure. Input state is copied, so a failed
operation cannot partially mutate caller-owned state. It does not retry for a
preferred token, repair output, choose best-of-N, or silently alter
configuration.

## Alternatives

Calling native or JavaScript `exp` for each candidate was rejected. Library,
optimization, and platform variation would enter token-selection identity.

Using raw `f32` arithmetic for temperature and repetition was rejected.
Cross-target rounding at branch boundaries would make exact replay fragile.

Using `f64` in JavaScript and `f32` in Rust was rejected. Sampling2 converts
the same binary32 fields into one integer domain first.

Using a cryptographic PRNG was not selected. Reproducible statistical
sampling needs a specified high-quality state transition, while cryptographic
secrecy is neither promised nor required. Seeds remain private run inputs.

Using modulo of one random word was rejected because retained sums can exceed
`u64` and naive modulo creates bias.

Applying repetition to prompt tokens was rejected for this profile. The exact
scope is generated non-stop history, which is bounded, replayable, and
separate from prompt composition.

Treating stop tokens as emitted assistant content was rejected. Template-owned
control semantics must not leak into decoded output.

Providing product defaults in the artifact was rejected. The selected exact
configuration is a separate composition input and must be hash-bound.

Wrapping the historical sampler was rejected. Sampling2 is a new incompatible
implementation with no legacy reader, shim, fallback, or dual execution.

## Authoritative Evidence

The normative machine profile is
`contracts/vnext/sampling2-format-profile.v1.json`, 19,333 bytes, SHA-256
`ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d`.

The normative Q48 table is
`contracts/vnext/sampling2-exp-q48-table.v1.bin`, 65,544 bytes, SHA-256
`fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677`.

The independent vector document is
`contracts/vnext/sampling2-format-vectors.v1.json`, 151,569 bytes, SHA-256
`4fe731f2e8714e9a6fe7689964a88a7fbe8150faf6af053cbf0be38390daaa9f`.

The independent Node-core implementation is
`tinyrustlm/tools/sampling2-reference.js`, 38,906 bytes, SHA-256
`bd7b4ed8cf1bdaef10f8b2041df476f842b08e0d65325d0b0e439cd0b8697b7b`.
It does not import Rust, invoke a subprocess, contact a network, or execute a
model.

The vector set owns one artifact, 12 artifact mutations, rejection of every
proper artifact prefix, 11 fixed-score cases, three eight-word PRNG cases, one
`u128` rejection case that consumes 16 PRNG words, seven token-selection
cases, five generation cases, and eight malformed-operation cases.

The product candidate is `rust/crates/tinyrustlm-sampling2`. It forbids unsafe
Rust and independently reproduces all registered bytes and semantic outputs.
It is a standalone Cargo workspace with its own exact lockfile because the
root workspace manifest and lockfile are immutable inputs to the completed
Template2 registration. Sampling2 isolation preserves those accepted bytes;
it is not a second product runtime or a compatibility path.

Focused local evidence currently includes nine passing Node tests, ten
passing Rust contract tests, and eight passing Rust vector tests. These are
local development results, not browser or production evidence.

## Threat Analysis

Malformed artifact lengths could allocate or index attacker-controlled
ranges. The parser requires exact fixed size and layout before reading table
records.

NaN could defeat ordering, and positive infinity could dominate a result.
Both are fatal. Negative infinity is the only explicit mask.

Host float differences could select different tokens. Binary32 conversion,
penalty, temperature, top-p, and choice are all specified integer operations.

Unstable sort behavior could resolve ties differently. Token ID is the exact
secondary total-order key.

Modulo bias could favor tokens. Two-word `u128` rejection removes that bias.

PRNG state could partially advance on later failure. Sampling works on a copy
and commits state only with a selected token.

Duplicate stop IDs or out-of-vocabulary history could create ambiguous state.
Both fail before sampling.

Cancellation could race after a draw. The synchronous semantic boundary checks
cancellation before each sample; production worker termination and event
ordering still require browser evidence.

An implementation could choose an attractive retry. Best-of-N, answer repair,
and retry-for-preference are absent from the contract and prohibited.

A public receipt could expose a private seed or state. Public evidence must
bind configuration and implementation identities without prompt-derived seed
or state payloads.

## Performance Evidence

No production performance claim is made. Focused local tests establish exact
behavior only.

The artifact table removes per-candidate transcendental calls. Candidate
storage is bounded by 151,936 entries, stable sorting is bounded by vocabulary,
and top-k retains at most 1,024 entries. These are implementation properties,
not measured browser performance.

Promotion requires measured native and real-Chromium parse time, selection
latency, throughput, peak linear memory, state serialization, long-generation
growth, cancellation latency, worker termination, and fresh-worker recovery.
Correctness cannot be relaxed to meet a timing target.

## Compatibility Impact

Sampling2 2.0 is intentionally incompatible with the historical runtime
sampler and every unstated host sampling behavior.

There is no legacy sampler adapter, SLM1 sampling section, version range,
alias, migration, compatibility shim, dual reader, response repair, fallback,
or automatic configuration default.

An artifact with another identity, version, profile, table, limit, flag, or
reserved value fails closed. A composition with another stop set or runtime
configuration receives another composition identity.

TinyRustLM is pre-public, so clean replacement is the supported policy.

## Clean Deletion Impact

When Sampling2 is integrated, the historical sampler must leave the SLM2
production path. Its tests cannot remain as an alternate behavioral authority.

The standalone development workspace may join a future production workspace
only through a newly preregistered composition closure. Editing the frozen
Template2 closure in place is forbidden.

Any duplicate JavaScript selection loop, host-`exp` path, implicit default,
unseeded random source, modulo shortcut, stop-token append, response repair, or
best-of-N path must be deleted rather than wrapped.

The independent Node implementation remains a development vector oracle. It
is not shipped as a browser fallback.

## Unknowns

Exact Template2-plus-Tokenizer2 prompt composition is still pending.

The production native/WASM interface for Sampling2 is not yet registered.

Real Chromium execution, cancellation by worker termination, fresh-worker
recovery, profile deletion, zero-network observation, and resource evidence
remain open.

The exact production sampling configuration for the first model remains a
future composition input. It cannot be inferred from the artifact.

Real-model logits may reveal unsupported magnitude, quality, or latency
behavior. Such evidence changes the profile only through a new identity; it
does not justify repair or fallback.

## Acceptance Tests

The canonical Node generator must reproduce the table, artifact, vectors, and
all identities byte-for-byte.

The Rust writer must reproduce the Node artifact exactly. The Rust parser must
reject all 12 mutations and all 65,800 proper prefixes.

Rust must reproduce every fixed-score result, SplitMix64/xoshiro256** sequence,
rejection draw, selected token, post-sample state, stop outcome, context limit,
maximum-new-token outcome, and cancellation outcome.

Denied-warning Clippy, formatting, documentation, secret scanning, and the
complete affected Node and Rust suites must pass before check-in.

Before browser output, native/WASM composition inputs and an independent
verification plan must be preregistered, committed, pushed, fresh-fetched, and
proven remote-exact. The comparative output root must be absent.

Two fresh real-Chromium profiles must reproduce exact registered native
outputs with zero network, no retries, no repair, true worker termination,
fresh-worker recovery, process closure, and owned-profile deletion.

Model promotion additionally requires accepted Tokenizer2, Template2, SLM2,
real model, exact config, stop set, and runtime identities in one immutable
composition receipt.

## Rollback

Before promotion, rollback means delete the unpublished Sampling2 integration
and return to the prior clean source commit. It does not mean reactivate a
legacy sampler inside the SLM2 path.

After evidence registration, raw evidence and bounded results remain immutable
history. A defect creates a new profile, artifact, vectors, and ADR update.
Prior bytes are rejected by the new composition and are not silently reissued.

No rollback can convert local tests into browser evidence, a failed model into
a pass, or zero campaign counters into progress.
