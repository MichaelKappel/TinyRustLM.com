# Qwen3 Execution /2 Result And Tied-Output Profile Defect

Date: 2026-08-25

Status: preserved terminal native rejection; source-profile correction required

## Executive Result

The preregistered `/2` operation performed both registered builds and invoked
the exact Rust converter once. The controller wrote binding and start evidence
before launch, captured separate bounded streams, preserved the native attempt
and rejection records, and wrote a terminal record. The converter rejected the
immutable source with `qwen3-tensor-inventory-mismatch`.

The public minimized result is
`contracts/vnext/qwen3-real-composition-execution-result.v2.json`, 8,275
canonical bytes at SHA-256
`4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c`.
The private create-only verification record is 9,512 bytes at SHA-256
`95cb01c7f989f25db62fae8719e4389fc75d00b26dcf6c80ca4a17ccb116ed20`.

This is a successful no-cheat failure observation. It is not a structural
conversion pass and does not advance any campaign counter.

## Exact Execution Facts

The registration commit and tree were remote-exact before either build and
before execution. The Rust release build ran once and exited zero. Its x64 PE
converter is 836,096 bytes at SHA-256
`c14b03a67bc1c8775b8c60816b3faf52b0842ebf7c76c690b368fb59c2064ba4`.
The independent managed inspector also built once with exit zero and empty
stderr; its assembly is 7,680 bytes at SHA-256
`41f16a303223b6effab8dbeb6b99432f97d99feabe25f60e9e58196acfce90f5`.

The controller was invoked once and exited zero after recording the child
terminal result. The converter child:

- started once;
- ran for 4,360 milliseconds;
- exited `1` without timeout, signal, spawn error, or stream overflow;
- emitted zero stdout bytes;
- emitted 62 stderr bytes at SHA-256
  `f51daef5da930c335ac00c5368e2edd55be771c484ada0ea002c92e34a2572a7`;
- preserved one 711-byte attempt record; and
- preserved one 436-byte nonretryable rejection record.

The attempt and rejection bind the same operation ID, source locks,
composition profile, converter version, and executable hash. The partial
output contains only those two files and remains immutable.

The managed inspector was deliberately not invoked. The controller did not
produce a candidate pass, and the registration forbids using managed
inspection to repair, retry, or launder a controller failure.

## Root Cause Observation

The exact locked `model.safetensors` file is 1,503,300,328 bytes at SHA-256
`f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b`.
Its 35,552-byte header declares 311 tensors. The registered converter profile
expected 310 and had no missing expected names. The sole additional name is
`lm_head.weight`.

The relevant source records are:

| Tensor | Dtype | Shape | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `model.embed_tokens.weight` | `BF16` | `[151936, 1024]` | 311,164,928 | `8f29acf519434862d95613b2b4f6b9d14933a5e4d16baebf8ac0b33b410acfb6` |
| `lm_head.weight` | `BF16` | `[151936, 1024]` | 311,164,928 | `8f29acf519434862d95613b2b4f6b9d14933a5e4d16baebf8ac0b33b410acfb6` |

The payloads are byte-identical. The locked configuration declares
`tie_word_embeddings: true`. Therefore this observation does not establish a
source defect. It establishes that conversion profile
`tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/1` is incompatible with the
immutable source it names: the profile explicitly says `lm_head.weight` is
forbidden when embeddings are tied.

## Correct General Rule

The correction must remain exact and fail closed. It must not simply ignore
unknown tensors or special-case one hash after conversion. For this current
Qwen3 source contract:

1. the source inventory must equal the complete canonical logical registry
   plus exactly `lm_head.weight`;
2. the configuration must declare tied embeddings;
3. `lm_head.weight` and `model.embed_tokens.weight` must have the same source
   dtype, exact shape, byte length, and streamed payload bytes;
4. a missing tied output, changed shape, changed dtype, changed byte, second
   surplus tensor, or any other inventory difference must fail with a stable
   typed error;
5. the redundant tied source payload must not become a second SLM2 tensor;
6. the canonical SLM2 output remains a 310-tensor tied-embedding model; and
7. receipts must distinguish 311 physical source tensors from 310 logical
   output tensors and bind the equality proof.

This is source normalization at the conversion boundary, not a product alias,
legacy reader, compatibility mode, fallback, migration, or response repair.
Only the sole corrected profile may be executable after the clean cut.

## Failure-To-Regression Requirements

Before another real attempt, add fixture coverage for:

- an exact redundant tied output payload that passes;
- missing `lm_head.weight`;
- mismatched tied-output dtype;
- mismatched tied-output shape;
- same shape but one changed payload byte;
- an unrelated additional tensor;
- untied configuration with a tied-source layout;
- stable source tensor and logical tensor counts in the receipt; and
- deterministic repeated conversion whose output omits the redundant tensor.

The correction requires a new immutable source-conversion profile and a new
complete-composition profile because the current composition profile binds the
invalid producer identity. The old profiles remain immutable rejected history
and receive no reader, selector, migration, alias, or fallback.

## Preservation And Claims

Execution `/2` is closed. Its control, build, managed-build, evidence, and
partial-output roots may not be deleted, overwritten, repaired, resumed, or
reused. A future execution needs a new registration and all-new logical roots.

No structural composition, source-framework parity, native inference,
browser-WASM inference, browser chat, model quality, P2P availability, catalog
announcement, package publication, site deployment, or MemoryEndpoints result
exists. MemoryEndpoints remains unauthorized and disconnected. Campaign
counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
