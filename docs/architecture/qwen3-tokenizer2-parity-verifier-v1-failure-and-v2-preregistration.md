# Qwen3 Tokenizer2 Parity Verifier V1 Failure And V2 Preregistration

## Status

On 2026-08-21, the first frozen Qwen3 Tokenizer2 source-parity run completed
exactly two pinned Python source-oracle observations and exactly two native Rust
candidate observations. The registered v1 verifier was then invoked once. It
terminated during result-structure validation with the bounded failure
`source-oracle implementation is invalid`, before comparing any token IDs or
decoded text and before creating a receipt.

This is a terminal verifier-defect result for that attempt. It is not a
Tokenizer2 parity rejection, a parity pass, browser-WASM evidence, model-runtime
evidence, model-quality evidence, release authority, deployment evidence, or
campaign credit. The four raw outputs remain private, create-only, unchanged,
and excluded from the successor comparison.

## Frozen V1 Evidence

| Evidence | Byte length | SHA-256 |
| --- | ---: | --- |
| Execution preregistration | 5,792 | `bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466` |
| Verification preregistration | 2,064 | `cc1472a7531095323dc1fe2fc2bb878bedfff4cc2cc5b5651f129c4800b0ed05` |
| V1 verifier | 36,521 | `67791ba375cc8be2b84f1985eea42a810e4dca4edcc91fb0a9bd9e91ec979173` |
| Oracle run 1 | 1,827,322 | `6f0aaf3b021296554ebf2bd60882323931566e06f2f43400e46101a92228de52` |
| Oracle run 2 | 1,827,322 | `6f0aaf3b021296554ebf2bd60882323931566e06f2f43400e46101a92228de52` |
| Candidate run 1 | 1,697,228 | `ac571be6710b9064ee420e680deaf21a6a2d2e0d1099512c19767160f4aac290` |
| Candidate run 2 | 1,697,228 | `ac571be6710b9064ee420e680deaf21a6a2d2e0d1099512c19767160f4aac290` |

The two oracle outputs are byte-identical to each other. The two candidate
outputs are byte-identical to each other. Each reports 2,048 cases, 69,294
total tokens, and a 5,966-token maximum case. Those aggregate agreements do not
establish per-case parity because the registered verifier did not reach its
comparison stage.

Post-observation rehashing found the source `tokenizer.json` unchanged at
SHA-256
`aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4`
and the 7,038,773-byte Tokenizer2 artifact unchanged at SHA-256
`cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
No v1 verification receipt exists.

## Root Cause

V1's helper for exact JSON value validation compared
`JSON.stringify(actual)` with `JSON.stringify(expected)`. JSON object member
order is not semantic, but JavaScript preserves parse insertion order when it
serializes an object. The Python oracle intentionally emits canonical
alphabetically ordered members, while the verifier's expected object literal
uses declaration order. Identical names and values therefore compared unequal.

The pre-observation fixture constructed its JavaScript object in the same order
as the expected literal, masking the cross-language defect. Changing the Python
producer or reordering a captured result would have been output repair and is
forbidden. V1 and its outputs are therefore retained exactly as observed.

## V2 Correction

V2 uses deep strict JSON structural equality: object member order is ignored,
array order remains significant, and primitive type and value identity remain
strict. Its regression recursively reverses every object member order in both
oracle and candidate fixtures while preserving arrays, then proves that the
documents validate. Separate counterexamples prove that reordered result arrays
and changed primitive identities still fail.

V2 also binds all four result basenames and the receipt basename to one new
external run-directory identity, forbids reuse of the predecessor outputs,
requires create-only outputs, pins one candidate executable, and rehashes that
executable after observation. It retains the unchanged v1 execution profile,
corpus, Python oracle, Rust runner source closure, source lock, and Tokenizer2
artifact.

| V2 authority | Exact identity |
| --- | --- |
| Registration parent | `bd21df3e080085ea9ceedfb065ef51f0d1b09ac5` |
| Verification preregistration | 4,373 bytes; SHA-256 `c02523a654c95007b9169bcd4c835b4283f9c7459796d8a943cc4ed0381242b3` |
| Verifier | 42,844 bytes; SHA-256 `1fac2f476e04b5624fa7030791f5f40faa87d7269a5e215320e1dcab0925f1ad` |
| Candidate executable | 576,512 bytes; SHA-256 `1ee0339cecd32cf5651c295b3ead0ff9c612be42fa80bf42e43686804ac480fe` |
| New run directory identity | `qwen3-tokenizer2-parity-v2-20260821-v1` |
| Required runs | Two new oracle outputs, two new candidate outputs, one verifier invocation |

At this preregistration checkpoint the named v2 output directory does not
exist, no v2 comparative output exists, and no v2 parity claim is made. The v2
profile and implementation must be committed, pushed, and independently
revalidated before that directory is created.

## Next Gate

After the pushed v2 preregistration is revalidated, generate only the four
registered fresh outputs with the pinned producers and invoke v2 once. Preserve
either receipt without repair or selection. Exact native source parity, if
verified, authorizes only the next gate: full-artifact parity and bounded
resource evidence in real Chromium WASM. It does not authorize Template2,
model inference, model quality, publication, deployment, or campaign counts.
