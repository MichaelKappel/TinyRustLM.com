# SLM2 Model Format

## Scope

`model.slm2` contains static model semantics, canonical tensor descriptors, and
tensor payload bytes. It is one member of a six-member executable composition;
it is not a self-contained chat package.

Tokenizer behavior, chat rendering, sampling, prompt authority, composition
order, provenance, licenses, qualification, signatures, P2P pieces, and
catalog metadata remain separate exact artifacts or receipts. The ACG2 member
binds the five executable dependencies by role, byte count, and SHA-256.

The normative authorities are:

- `contracts/vnext/slm2-format-profile.v1.json`
- `contracts/vnext/slm2-q8-weight-profile.v1.json`
- `docs/architecture/adr/ADR-013-slm2-format-profile.md`
- `docs/architecture/adr/ADR-006-quantization-profiles.md`
- `docs/architecture/vnext-slm2-format-implementation.md`
- `rust/crates/tinyrustlm-slm2`

This maintained overview intentionally does not duplicate every byte offset
from the machine-readable profiles.

## Exact Envelope

SLM2 uses an exact little-endian binary envelope with a fixed header, canonical
metadata, a canonical string table, fixed-width tensor descriptors, optional
profile-authorized quantization records, and aligned tensor payloads.

Readers validate input bytewise. They do not cast untrusted bytes to native
structures. Every count, offset, length, alignment, element product, and range
calculation uses checked arithmetic before allocation or access.

Canonicality is part of identity:

- the declared file size equals the actual file size;
- sections occur in the profile-defined order;
- required alignment padding is zero;
- string and tensor tables are uniquely ordered;
- tensor payload ranges are in bounds, nonoverlapping, and nonaliased;
- reserved fields and unsupported flags are zero;
- unknown metadata, profiles, tensors, or extensions reject;
- trailing bytes reject;
- whole-file identity is lowercase SHA-256 over the exact bytes.

Paths, URLs, aliases, timestamps, credentials, executable scripts, and embedded
self-authority are not SLM2 metadata.

## Model Semantics

The manifest declares one closed causal decoder-transformer architecture. Its
fields include dimensions, layer and head geometry, grouped-query attention,
RoPE, RMSNorm, gated feed-forward behavior, tied or untied output, optional
projection biases, and Q/K normalization.

The parser derives the required tensor registry from those flags and dimensions
and then requires exact set equality. A model rejects on any missing,
additional, duplicate, renamed, reshaped, overlapping, wrongly indexed, or
unsupported tensor. A structurally plausible tensor collection is not enough.

Qwen3 query projection width is represented independently from residual hidden
width. The implementation must not truncate, reshape, or force a historical
head-count identity that the pinned architecture does not satisfy.

## Tensor Profiles

The dense F32 profile is the numerical baseline. The current compressed profile
is one explicit mixed-Q8 contract:

- profile: `tinyrustlm.weight-q8-row-symmetric-f32-scale/1`;
- matrix roles selected by the profile use signed row-symmetric Q8 codes;
- each encoded row carries its exact F32 scale under the profile's layout;
- normalization, bias, and other explicitly listed roles remain F32;
- dequantization, tails, accumulation, rounding, and identities are fixed by
  the machine profile and scalar vectors;
- runtime repacking and inferred quantization are forbidden.

Q4, Q5, ternary, one-bit, sparse, vector-quantized, TurboQuant-like, and other
encodings are unsupported unless a new sole profile is preregistered and
implemented end to end. An unsupported encoding never maps to a nearby type or
falls back to an alternate runtime.

## Admission Order

Hostile metadata must not cause large allocation or hashing before cheap checks.
The bounded parser follows this order:

1. actual source length and policy ceiling;
2. fixed header, magic, format identity, exact profile, endianness, flags, and
   reserved bytes;
3. checked section arithmetic, canonical placement, alignment, and range
   nonoverlap;
4. canonical metadata grammar and exact field registry;
5. canonical string table;
6. tensor descriptors, ordering, shapes, and exact architecture-derived
   registry;
7. quantization records and role agreement;
8. streamed payload checks, finite required F32 values, descriptor identity,
   payload identity, and whole-file identity.

Validation returns a typed rejection. It does not repair bytes, ignore extras,
guess intent, or return a partially admitted model.

## Conversion Boundary

`rust/crates/tinyrustlm-convert` is the sole source converter. A conversion is
eligible only when it binds:

- an immutable public repository revision;
- exact source-file lengths and SHA-256 locks;
- the model, tokenizer, template, sampling, prompt, and composition profiles;
- the converter executable and source commit/tree;
- the quantization profile;
- bounded resource and terminal receipts;
- all six emitted member identities.

Independent inspection recomputes output facts and does not trust converter
digests or inventory. Conversion success is not numerical parity, behavioral
quality, browser proof, or release evidence.

The first public candidate source is `Qwen/Qwen3-0.6B` at immutable revision
`c1899de289a04d12100db370d81485cdf75e47ca`. Earlier failed operation bytes
remain immutable evidence and are ineligible for adoption.

## Composition And Browser Activation

The browser never opens `model.slm2` alone. Local import requires these exact
members plus one canonical browser admission:

```text
model.slm2
tokenizer.tokenizer2
template.template2
sampling.sampling2
prompt.prompt2
composition.acg2
*.browser-composition-admission.json
```

The admission binds the exact WASM and worker protocol, runtime memory and
sequence limits, qualification receipt, and all member identities. The worker
streams each role independently and commits only after the complete composition
passes the Rust/WASM boundary.

## Claims

A structural SLM2 pass permits only a structural claim about the exact bytes.
It does not prove:

- source-framework numerical agreement;
- scalar, optimized-native, or browser-WASM parity;
- tokenizer/template/prompt correctness outside their own gates;
- conversational usefulness or quantization noninferiority;
- direct P2P availability;
- clean-browser chat;
- MemoryEndpoints continuity;
- deployment or campaign completion.

Those claims require separate content-addressed evidence. Current campaign
counters remain zero.

## Change Policy

TinyRustLM is prelaunch. A format correction replaces the one current profile
and every production producer and consumer in one coherent clean cut. Do not
add a version range, compatibility reader, migration, alias, permissive parser,
or fallback. Historical bytes remain interpretable through immutable documents
or offline audit tooling, not through the shipping path.
