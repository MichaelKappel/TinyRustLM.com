# Qwen3 Tokenizer2 Conversion Memory

## Status

This report records the deterministic full-tokenizer conversion checkpoint for
the pinned `Qwen/Qwen3-0.6B` source revision on 2026-08-20. One closed Rust
source parser, one canonical Tokenizer2 writer, and one independently invoked
Tokenizer2 parser now replace the prior copied-JSON behavior.

This checkpoint proves exact source admission and deterministic Tokenizer2
format conversion. It does not prove broad source-oracle encoding parity,
browser-WASM execution, Template2, model conversion, model inference, model
quality, acquisition, browser chat, release, deployment, publication, or
campaign progress.

## Authorities

| Authority | Exact identity |
| --- | --- |
| Frozen enterprise goal | SHA-256 `92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0` |
| Current release goal | 30,243 bytes; 659 lines; SHA-256 `115ae434bf9dee0b4f27767f126d951989c5ec684241e2e3a6238de094e65d33` |
| Tokenizer2 profile | `org.minimodel.tokenizer2/2.0`; SHA-256 `628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de` |
| Qwen conversion profile | `tinyrustlm.qwen-bytelevel-to-tokenizer2/1`; 3,501 bytes; SHA-256 `f70465a08b41599fe59f41b850912d0d408f0ec67e84ebeb7591524d1b14e12b` |
| Pinned source lock | 1,108 bytes; SHA-256 `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70` |
| Source model revision | `Qwen/Qwen3-0.6B` at `c1899de289a04d12100db370d81485cdf75e47ca` |
| Converted Tokenizer2 | 7,038,773 bytes; SHA-256 `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b` |

The model-weight files were neither copied into the conversion workspace nor
read for this tokenizer-only checkpoint.

## Pinned Source Closure

The source lock admits exactly five regular files and rejects every additional,
missing, changed, nonregular, or differently identified member:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `config.json` | 726 | `660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd` |
| `merges.txt` | 1,671,853 | `8831e4f1a044471340f7c0a83d7bd71306a5b867e95fd870f74d0c5308a904d5` |
| `tokenizer.json` | 11,422,654 | `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4` |
| `tokenizer_config.json` | 9,732 | `d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101` |
| `vocab.json` | 2,776,833 | `ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910` |

All five external copies were independently rehashed after conversion and
matched both byte length and SHA-256 in the checked-in source lock.

## Closed Source Parser

`tinyrustlm-convert` now owns one exact Qwen ByteLevel source parser. It uses
closed `deny_unknown_fields` records and duplicate-member-rejecting maps. It
requires:

- tokenizer JSON version 1.0;
- NFC normalization;
- the exact Qwen ordered split expression;
- the exact Sequence, Split, and ByteLevel pretokenizer graph;
- ByteLevel postprocessing and decoding with required options disabled;
- BPE without dropout, unknown token, continuation prefix, end suffix, byte
  fallback, fuse-unknown, or ignored merges;
- exact agreement between the BPE model vocabulary and `vocab.json`;
- exact agreement between the BPE model merges and LF-only
  `#version: 0.2` `merges.txt`;
- a contiguous 256-entry GPT-2 byte alphabet;
- merge rank/output closure at token ID `256 + rank`;
- exact concatenation of each merge's left and right token bytes;
- contiguous added-token IDs and exact special-token declarations;
- exact EOS, padding, BOS, and vocabulary agreement with the pinned model
  configuration.

Unsupported processors, options, unknown fields, duplicate JSON members,
duplicate vocabulary members, malformed merges, source drift, and redundant
file disagreement all fail before a promoted output is accepted.

## Conversion Boundary

The public operation `convert_locked_qwen_tokenizer2_source` performs this
sequence:

1. Validate the exact conversion-profile identity.
2. Parse the source lock with duplicate-member rejection.
3. Validate the exact five-member source inventory.
4. Stream and verify every source hash before inspection.
5. Parse and cross-check the complete tokenizer source declaratively.
6. Stream and verify every source hash again after inspection.
7. Write one create-only, same-directory staged Tokenizer2 artifact.
8. Flush and independently reparse the complete staged artifact with the
   product Tokenizer2 parser.
9. Verify the reparsed identity and all declared counts.
10. Promote create-only and perform a real Windows directory flush.
11. Persist a create-only receipt that binds source, profiles, converter
    executable, output identity, counts, special IDs, and durability evidence.

The converter emits no source-oracle, WASM, model-runtime, model-quality, or
release claim. Raw publisher Jinja is retained only as unpromoted source
evidence; it is no longer mislabeled as Template2.

## Deterministic Production Conversion

Two independent output directories under the private external evidence root
were populated from the same independently copied five-file source closure.
Both runs produced exactly:

- artifact length: 7,038,773 bytes;
- artifact SHA-256:
  `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`;
- token count: 151,669;
- base-token count: 151,643;
- merge count: 151,387;
- added-token count: 26;
- special-token count: 14;
- BOS token ID: absent;
- EOS token ID: 151,645;
- padding token ID: 151,643.

Both final receipts bind converter executable SHA-256
`dcef607d38f90bc7170bc16cf0cab701aa5c1e6f2745ed715f1ee1b3f27b7cb8`.
Their durability-directory identities intentionally differ because the two
runs own different output directories. Their artifact identities and all
semantic conversion fields agree.

## Verification

At source state immediately before this documentation checkpoint:

- `cargo fmt --all --check` passed;
- `cargo test --workspace --all-targets` passed 1,062 tests across 54 suites,
  with zero failures and zero ignored tests;
- `cargo clippy --workspace --all-targets -- -D warnings` passed;
- the Qwen2 integrated conversion suite passed 11 of 11 tests;
- the standalone pinned-tokenizer conversion suite passed 8 of 8 tests;
- all three changed or added JSON contracts parsed successfully;
- `git diff --check` passed;
- both frozen goal hashes matched;
- local branch, upstream, and the independently read remote branch agreed at
  the pre-change head.

Hostile coverage includes duplicate tokenizer members, unknown fields,
unsupported ByteLevel options, independent vocabulary disagreement,
independent merge disagreement, extra source members, source hash drift,
duplicate source-lock members, model/tokenizer special-ID drift, and
create-only output enforcement.

## Claim Boundary

This checkpoint closes only the first four implementation items previously
listed under Tokenizer2 Gate A: exact source parsing, strict field admission,
duplicate deterministic conversion, and a source/converter/output-bound
receipt.

It does not establish that the product encoder and decoder match Hugging Face
tokenizers 0.22.2 over a preregistered broad corpus. It does not execute the
full artifact through browser WASM, measure production resource behavior, bind
Template2, convert model weights, or produce a useful model response.

No site bytes changed and no deployment was attempted. Campaign counters
remain 0/20 qualified models, 0/50 browser rounds, 0/25 live memory rounds,
0/40 outside-proven lanes, and 0/20 catalog announcements.

MemoryEndpoints remains unauthorized and disconnected. Two genuinely separate
holdout authors, the exact 1,024-record curriculum and teacher lineage, and two
genuinely separate complete record-bound curriculum reviewers remain external
requirements. This agent did not impersonate any author or reviewer.

## Exact Resume

1. Commit and push this deterministic conversion checkpoint, then verify the
   actual remote head independently.
2. Preregister a deterministic source-oracle corpus and generator before
   observing comparative outputs.
3. Execute Hugging Face tokenizers 0.22.2 from the pinned offline environment
   and compare exact token IDs and decoded bytes against the full Tokenizer2
   artifact natively.
4. Preserve every mismatch and convert general causes into hostile regression
   tests without editing expected output after observation.
5. Expose the same full Tokenizer2 artifact through the product Rust WASM
   boundary and prove encode, decode, cancellation, repeated use, zero prompt
   upload, and bounded resource behavior in real Chromium.
6. Only after those gates pass may Template2 bind this tokenizer identity.
