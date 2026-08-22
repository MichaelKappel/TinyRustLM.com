# Tokenizer2 Format Implementation Checkpoint

## Status

This document records the development-only Tokenizer2 2.0 checkpoint on
2026-08-20. The exact miniature contract, independent vectors, Node oracle,
unsafe-free Rust implementation, strict pinned-Qwen source parser, and two
byte-identical external full-tokenizer conversions pass their applicable
local gates. A deterministic output-free 2,048-case source-parity corpus plus
separate execution and verification preregistrations passed their hostile
pre-observation gates. The v1 four-output run was repeat-stable, but its frozen
verifier failed before token comparison because it treated JSON object member
order as semantic; no v1 receipt or parity decision exists. An append-only v2
verifier and fresh run set were preregistered and pushed before observation.
The one authorized v2 execution then matched all 2,048 cases and 69,294 tokens
exactly, with zero token-ID or decoded-Unicode mismatches and byte-identical
repeated outputs.

This is complete pinned-Qwen tokenizer format conversion, native source-oracle
parity, and full-artifact real-Chromium WASM parity evidence. The registered
browser execution replayed all 2,048 cases and 69,294 tokens twice, exercised
true worker termination and fresh-worker recovery, and passed privacy,
deletion, and resource gates with zero mismatches. This is not Template2
parity, model conversion, model qualification, release evidence, deployment
evidence, or campaign credit.

## Exact Authorities

| Authority | Exact identity |
| --- | --- |
| Profile | `org.minimodel.tokenizer2/2.0`; 12,442 bytes; SHA-256 `628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de` |
| Vector document | 25,552 bytes; SHA-256 `9fef7d6c8576d971d72fd248dcedce2888ca0fe2a944fbbb914fed8e07f218aa` |
| Canonical miniature artifact | 7,459 bytes; SHA-256 `2b2c3c5f58baacd7af68e2ccffa1cb03e113fa281b1832224d684f9ac03eaff1` |
| Independent Node generator/oracle | 36,833 bytes; SHA-256 `bf63b1d985a9af9d42707ec54976d9a78c5d85ac7d87d33ca0818ec030008715` |
| Upstream source oracle | Hugging Face tokenizers 0.22.2; revision `f383101a26663708484cac0727792aad74f78234` |
| Normalization authority | `unicode-normalization-alignments` 0.1.12; Unicode 9.0.0 |
| Category authority | `unicode-general-category` 1.1.0; Unicode 16.0.0 |
| Regex authority | Oniguruma 6.9.10; Unicode 16.0.0 |
| Qwen conversion profile | 3,501 bytes; SHA-256 `f70465a08b41599fe59f41b850912d0d408f0ec67e84ebeb7591524d1b14e12b` |
| Pinned source lock | 1,108 bytes; SHA-256 `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70` |
| Full converted tokenizer | 7,038,773 bytes; SHA-256 `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b` |
| Source-parity corpus | 2,048 cases; 464,043 bytes; SHA-256 `9503fd6df325f1a46dec56674d2aa72ce225d6bf1c9477abd56bb4542ef99caa` |
| Source-parity execution preregistration | 5,792 bytes; SHA-256 `bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466` |
| Source-parity v1 verification preregistration | 2,064 bytes; SHA-256 `cc1472a7531095323dc1fe2fc2bb878bedfff4cc2cc5b5651f129c4800b0ed05`; terminal verifier defect, no decision |
| V1 source-parity verifier | 36,521 bytes; SHA-256 `67791ba375cc8be2b84f1985eea42a810e4dca4edcc91fb0a9bd9e91ec979173`; retained unchanged |
| Source-parity v2 verification preregistration | 4,373 bytes; SHA-256 `c02523a654c95007b9169bcd4c835b4283f9c7459796d8a943cc4ed0381242b3` |
| V2 source-parity verifier | 42,844 bytes; SHA-256 `1fac2f476e04b5624fa7030791f5f40faa87d7269a5e215320e1dcab0925f1ad` |
| V2 source-parity receipt | 3,974 bytes; SHA-256 `4ebbfa2bc59d43bdbcd5b3b2528bed66035ff2a3165f554ac6867e7cc7fe0ea6`; 2,048/2,048 exact, zero mismatches |
| Tokenizer2 WASM interface | 4,030 bytes; SHA-256 `375c270b6836968eddd53bca6523dd1461dd5d77dc537be11f1fd78be9ad4d99` |
| Import-free Tokenizer2 WASM module | 320,996 bytes; SHA-256 `058c6ffb494e90b101409951ba78b4fc7d8098a868c861a276ef3f415ede27cc` |
| Full-artifact browser execution preregistration | 9,343 bytes; SHA-256 `8734360e7fc2e0d4cb4f6ace87e2b5ec2922f983eededa7f5b246fad928050f3`; completed exactly once |
| Browser verification preregistration | 2,453 bytes; SHA-256 `560347bb1db2f1299bc3f54d5e2a8a5d6adbb26e1a55b908c4bb754d72f540a2`; completed exactly once |
| Full-artifact browser result | 3,909 bytes; SHA-256 `f828190b2ff5d3c1e794cb50f3b0dd8c41367ed09fca758eeb513fb1ec2c964e`; zero mismatches |

The profile is normative. Vectors narrow implementations to exact examples
and hostile inputs; they do not add semantics to the profile.

## Binary Contract

The artifact has one fixed 192-byte header and three canonical sections:

1. An implicit-ID token table with fixed 24-byte records.
2. An implicit-rank merge table with fixed 16-byte records.
3. One tightly packed terminal byte table.

Every section position is derived with 64-byte alignment. Only zero alignment
padding may appear. Unknown flags, gaps, overlap, aliases, and trailing bytes
are fatal.

The first 256 token IDs form an exact single-byte bijection. The base
vocabulary closes at `256 + merge_count`. Added tokens occupy the remaining
contiguous IDs. Every merge output is exactly `256 + rank` and its token bytes
are exactly the left and right input bytes concatenated.

Whole-artifact identity is plain SHA-256 over all bytes. Source tokenizer,
converter, template, model, and composition identities remain external
receipt and graph dependencies, avoiding circular self-identification.

## Rust Boundary

`rust/crates/tinyrustlm-tokenizer2` is the sole product candidate
implementation. It forbids unsafe Rust and exports:

- a closed declarative `TokenizerSpec`;
- exact token and merge definitions;
- a deterministic `write_tokenizer` operation;
- a bounded `Tokenizer2::from_bytes` parser;
- explicit encode and decode operations;
- immutable whole-artifact identity;
- a caller-provided nonzero resource policy.

The writer validates every relationship before emitting the first byte. A
caller requiring durable fail-atomic persistence must write into a new owned
same-directory staging file, reparse it, sync it, and promote it atomically.

The parser checks file policy, exact envelope, profile, Unicode authority,
counts, layout, padding, token closure, byte alphabet, added UTF-8, merge
closure, and exact merge bytes before returning a runtime.

Encoding clears output first, splits exact added tokens before normalization,
normalizes unmatched spans with Unicode 9 NFC, applies the frozen Qwen split,
maps each pretoken byte through the required byte alphabet, and executes
ranked BPE inside each pretoken only.

Decoding clears output first, validates every ID and byte limit, optionally
skips only special-bit records, concatenates exact token bytes, and rejects
invalid final UTF-8 without replacement.

There is no tokenizer JSON reader, regex supplied by an artifact, executable
pipeline, automatic BOS/EOS insertion, SLM1 reader, alias, migration, version
range, or fallback.

## Independent Oracle

`tinyrustlm/tools/tokenizer2-reference.js` is a separately written Node-core
writer, parser, pretokenizer, encoder, and decoder. It does not import or invoke
Rust, Cargo, a subprocess, or the network.

The Node writer owns the checked-in language-neutral vector bytes. The Rust
writer must reproduce the Node-authored artifact byte-for-byte. This direction
prevents vectors from being generated by the Rust implementation under test.

The independent BPE implementation intentionally rescans adjacent pairs after
each merge. The Rust implementation uses a ranked candidate heap. Their
algorithmic independence is useful differential evidence.

Node's host Unicode database is not treated as a general Tokenizer2 authority.
The vector document explicitly limits its Node normalization and property
claim to frozen code points whose behavior is stable across Unicode 9 through
17. Full Unicode authority remains the pinned source-oracle and Rust-profile
gate.

## Current Corpus

The canonical miniature has 277 tokens:

- 256 single-byte base tokens in GPT-2 byte order;
- 15 merge outputs covering ranked words, punctuation, whitespace, composed
  UTF-8, and one deliberately unreachable cross-digit merge;
- six added tokens, including three special tokens, one overlapping prefix,
  and one decomposed Unicode token matched before NFC.

The document freezes:

- 11 pretoken boundary cases observed against the pinned source pipeline;
- 12 exact encoding cases;
- four decode cases for include-all, skip-special, invalid UTF-8, and unknown
  IDs;
- 13 targeted corruptions across envelope, profile, padding, flags, duplicate
  tokens, added UTF-8, merge records, merge closure, special IDs, unknown ID,
  and trailing bytes;
- rejection of all 7,459 proper artifact prefixes.

The miniature proves contract behavior only. It is not a model tokenizer and
cannot be used to qualify or chat with a production model.

## Current Verification

Current local gates pass:

- 13 Rust contract tests;
- four Rust cross-language vector tests;
- eight independent Node vector tests;
- deterministic Node vector `--check`;
- exhaustive prefix truncation replay in both implementations;
- warnings-denied Clippy for every crate target;
- workspace rustfmt for current Rust changes.
- 11 of 11 integrated Qwen2 converter tests;
- 8 of 8 standalone pinned-tokenizer conversion tests;
- the complete Rust workspace: 1,062 tests across 54 suites, with zero
  failures and zero ignored tests;
- two external full-tokenizer conversions with identical artifact bytes.
- two fresh pinned Python oracle outputs that are byte-identical;
- two fresh native Rust outputs that are byte-identical;
- exact v2 comparison of 2,048 cases and 69,294 tokens with zero mismatches;
- post-observation source, artifact, and candidate-executable rehashing.

The vector artifact is 7,459 bytes with SHA-256
`2b2c3c5f58baacd7af68e2ccffa1cb03e113fa281b1832224d684f9ac03eaff1`
in both implementations.

## Pinned Source Observations

The protected source checkout was read but not modified. The exact source
tokenizer is pinned by repository revision and external file hashes.

Observed source structure:

- tokenizer JSON version 1.0;
- NFC normalizer;
- the frozen Qwen split expression;
- ByteLevel pretokenizer, postprocessor, and decoder with all three relevant
  Boolean options false;
- BPE without dropout, unknown token, prefixes, suffixes, byte fallback, or
  ignored merges;
- 151,643 contiguous base IDs;
- 151,387 ordered merges whose output IDs close at `256 + rank`;
- 26 contiguous added-token IDs;
- EOS `<|im_end|>`, pad `<|endoftext|>`, and no BOS or unknown token.

These observations now feed one closed duplicate-member-rejecting source
parser. The exact five-file source lock is rehashed before and after source
inspection. The converter requires exact redundant vocabulary and merge
agreement, exact pipeline options, contiguous IDs, byte alphabet, merge
closure, added tokens, and model/tokenizer special IDs.

Two create-only conversions independently produce a 7,038,773-byte artifact
with SHA-256
`cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
Each receipt binds the source lock, all five source files, conversion and
format profiles, converter executable, output counts and identity, special
IDs, and an actual Windows directory flush. These receipts authorize only the
deterministic format-conversion claim.

## Completed Gate A And Next Dependency

1. Preserve the completed browser implementation, registrations, two raw runs,
   and bounded result without rerun or overwrite.
2. Bind the browser-accepted Tokenizer2 identity into Template2 and the
   composition graph without embedding or aliasing it.
3. Complete the separately preregistered Template2 source/native and browser
   gates before deterministic sampling.
4. Reuse Tokenizer2 evidence only while every bound artifact, runtime, corpus,
   and browser identity remains exact.

The source parser, exact rejection surface, duplicate conversion, receipt
binding, native source-oracle parity, production WASM boundary, and registered
browser/resource steps are complete. Gate A now authorizes dependent
Template2 work only; it is not model or product evidence.

Historical Tokenizer2 test replay resolves each canonical preregistration to
the one Git commit that introduced those exact bytes, requires its sole parent
to equal `registrationParentCommit`, and materializes only registered files
from that tree. This preserves hostile mutation, canonical JSON, semantic
ordering, closure, receipt, browser, and claim-boundary tests while allowing
clean-slate descendants to add unrelated crates. Current descendant aggregate
manifests are never substituted for the registered source tree, and frozen
profiles, verifiers, results, and raw evidence remain byte-immutable.

## Claim Boundary

This checkpoint earns no model qualification, browser round, memory round,
outside-lane proof, catalog announcement, release, deployment, or publication
credit.

Campaign counters remain 0/20 models, 0/50 browser rounds, 0/25 live memory
rounds, 0/40 outside-proven lanes, and 0/20 announcements.
