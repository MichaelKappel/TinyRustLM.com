# ADR-014: Exact Tokenizer2 2.0 Qwen ByteLevel BPE profile

## Status

Accepted

The profile is accepted as the sole clean-slate Tokenizer2 target. Its current
implementation is development-only and unpromoted until full source-oracle
parity, native and WASM replay, browser activation, and useful-model
qualification all pass. Exact pinned-source conversion now passes as a narrow
precondition rather than a promotion result. The exact 2,048-case
source-parity corpus, execution contract, and independent verification
contract were preregistered before comparative output. The v1 run completed
four repeat-stable outputs, but its verifier failed structurally before token
comparison because it treated JSON object member order as semantic. V1 has no
receipt or parity decision. An append-only corrected v2 verifier and fresh run
set were preregistered and pushed before observation. The one authorized v2
execution matched all 2,048 cases and 69,294 tokens exactly, with zero
mismatches and byte-stable repeated outputs. Native source-oracle parity now
passes. The production WASM interface, import-free module, two-run Chromium
execution, and independent verification are preregistered without producing
full-artifact browser output; real-browser replay and resource evidence remain
open.

## Decision Date

2026-08-20

## Scope

This decision defines the exact portable tokenizer artifact and execution
semantics used by the first SLM2 Qwen-family vertical slice.

It covers the binary envelope, token bytes, merge ranks, added tokens,
normalization, pretokenization, ByteLevel mapping, BPE, decoding, limits,
failure behavior, source admission, and implementation evidence.

It does not define chat-template composition, automatic special-token
insertion, sampling, transformer inference, provenance, model quality, P2P,
release authorization, deployment, publication, or campaign credit.

**Observed local fact**: the pinned Qwen3-0.6B tokenizer has 151,643 base
tokens, 151,387 ordered merges, and 26 contiguous added tokens, for a total
vocabulary of 151,669. Two exact external conversions from the locked source
closure produced the same 7,038,773-byte Tokenizer2 artifact with SHA-256
`cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
The artifact remains unpromoted pending real-browser WASM parity and bounded
resource evidence.

**Observed local fact**: the frozen production WASM interface is 4,030 bytes
with SHA-256
`375c270b6836968eddd53bca6523dd1461dd5d77dc537be11f1fd78be9ad4d99`,
and the zero-import release module is 320,996 bytes with SHA-256
`058c6ffb494e90b101409951ba78b4fc7d8098a868c861a276ef3f415ede27cc`.
Native, Node-WASM, and fresh real-Chromium miniature replay pass. The
full-artifact execution preregistration is 9,343 bytes with SHA-256
`8734360e7fc2e0d4cb4f6ace87e2b5ec2922f983eededa7f5b246fad928050f3`;
the independent verification preregistration is 2,453 bytes with SHA-256
`560347bb1db2f1299bc3f54d5e2a8a5d6adbb26e1a55b908c4bb754d72f540a2`.
No full-artifact browser output exists at this checkpoint.

**Local verification required**: native replay against the exact upstream
implementation now passes over the preregistered broad adversarial corpus. The
registered runner and verifier must still consume the same accepted artifact
and frozen cases in real Chromium with repeated-use, true worker termination,
fresh-worker recovery, privacy, deletion, and resource evidence.

## Decision

Tokenizer2 2.0 is a bounded declarative binary artifact identified by
`org.minimodel.tokenizer2/2.0`.

The exact profile is
`contracts/vnext/tokenizer2-format-profile.v1.json`, 12,442 bytes, SHA-256
`628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de`.

The artifact begins with `TOK2`, CRLF, SUB, LF and the fixed 16-byte format ID
`minimodel.tok2` followed by two zero bytes. It accepts exactly major 2,
minor 0, little-endian integers, one algorithm profile, and no feature flags.

The header is exactly 192 bytes. Token records are exactly 24 bytes. Merge
records are exactly 16 bytes. Sections are ordered token table, merge table,
and byte table. Derived alignment padding is zero. Gaps, aliases, overlap,
unknown flags, and trailing bytes are fatal.

Token IDs are implicit record indices. Token bytes are nonempty and tightly
packed in ID order. IDs zero through 255 are an exact one-token-per-byte
bijection. Base tokens have no flags. Added tokens form one contiguous suffix,
must carry the added bit, and may carry the special bit.

Merge rank is the zero-based record index. Every merge output ID is exactly
`256 + rank`. Its bytes must equal the exact concatenation of its left and
right token bytes. Duplicate token bytes, merge pairs, outputs, ranks, or
nonclosed base vocabularies are fatal.

Algorithm profile 1 is Qwen ByteLevel BPE with:

- Unicode NFC normalization frozen to Unicode 9.0.0;
- Qwen's exact ordered split expression with Unicode 16.0.0 letter, number,
  whitespace, and case-folding semantics;
- ByteLevel without prefix-space insertion, offset trimming, or regex;
- ranked BPE with no dropout, unknown token, byte fallback, prefix, suffix,
  merge bypass, or repair;
- added-token matching before normalization by earliest position, longest
  bytes, and then lowest token ID;
- exact byte concatenation for decoding and fatal invalid final UTF-8.

The runtime does not insert BOS or EOS. Template2 owns message composition and
generation markers. Sampling owns stop behavior. Padding is metadata only.
The unknown token ID must be absent.

The runtime accepts Tokenizer2 bytes only. It does not accept tokenizer JSON,
publisher programs, regex supplied by an artifact, SLM1 tokenizer sections,
legacy aliases, migrations, version ranges, or fallback tokenization.

**Engineering decision**: normalization Unicode 9.0.0 and category/regex
Unicode 16.0.0 are separate frozen dependencies because those are the
observed semantics of the pinned upstream tokenizer stack. Upgrading either
Unicode authority is a new profile, not a transparent dependency update.

## Alternatives

Retaining upstream `tokenizer.json` at runtime was rejected. It is too large,
admits a broad executable pipeline grammar, makes browser parsing expensive,
and leaves unknown source fields vulnerable to permissive interpretation.

Embedding a JavaScript tokenizer was rejected. It would make publisher code
part of the trusted runtime, weaken CSP and offline boundaries, and create a
second product behavior outside Rust and WASM.

Using a generic regex engine in the product runtime was rejected. Regex
engine and Unicode drift could change token boundaries without changing the
artifact identity.

Using current-platform Unicode data was rejected. Browser, Node, Rust, and OS
Unicode versions move independently and would make tokenization dependent on
the execution host.

Accepting multiple tokenizer formats was rejected. TinyRustLM is pre-public;
there is no user contract that justifies compatibility debt.

Embedding tokenizer bytes inside SLM2 was rejected. Model, tokenizer,
template, runtime, and composition identities remain independent and are
bound by an external composition graph and receipts.

## Authoritative Evidence

The normative machine profile is the 12,442-byte artifact identified above.

The language-neutral vector document is
`contracts/vnext/tokenizer2-format-vectors.v1.json`, 25,552 bytes, SHA-256
`9fef7d6c8576d971d72fd248dcedce2888ca0fe2a944fbbb914fed8e07f218aa`.
Its canonical miniature Tokenizer2 artifact is 7,459 bytes with SHA-256
`2b2c3c5f58baacd7af68e2ccffa1cb03e113fa281b1832224d684f9ac03eaff1`.

The independent vector writer, parser, encoder, and decoder is
`tinyrustlm/tools/tokenizer2-reference.js`, 36,833 bytes, SHA-256
`bf63b1d985a9af9d42707ec54976d9a78c5d85ac7d87d33ca0818ec030008715`.
It uses Node core only and invokes no Rust, subprocess, or network operation.

The production candidate implementation is
`rust/crates/tinyrustlm-tokenizer2`. It forbids unsafe Rust and independently
reproduces the Node-authored artifact byte-for-byte.

The vectors contain 11 source-observed pretoken boundaries, 12 exact encoding
cases, four decoding cases, 13 single-fault artifact mutations, and an
exhaustive requirement that every proper artifact prefix reject.

The source oracle is Hugging Face tokenizers 0.22.2 at source revision
`f383101a26663708484cac0727792aad74f78234`. Its normalization dependency is
`unicode-normalization-alignments` 0.1.12 and its regex path is Oniguruma
6.9.10.

The exact conversion profile is
`contracts/vnext/qwen-tokenizer2-conversion-profile.v1.json`, 3,501 bytes,
SHA-256
`f70465a08b41599fe59f41b850912d0d408f0ec67e84ebeb7591524d1b14e12b`.
The source lock is
`contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json`, 1,108 bytes,
SHA-256
`1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70`.
Two conversions reproduce the exact artifact identity stated above and issue
separate create-only durability receipts. This is conversion evidence, not
source-oracle parity evidence.

The output-free source-parity corpus is
`contracts/vnext/qwen-tokenizer2-parity-cases.v1.json`, 464,043 bytes,
SHA-256
`9503fd6df325f1a46dec56674d2aa72ce225d6bf1c9477abd56bb4542ef99caa`.
The execution preregistration is
`contracts/vnext/qwen-tokenizer2-parity-preregistration.v1.json`, 5,792 bytes,
SHA-256
`bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466`.
The original independent verification preregistration is
`contracts/vnext/qwen-tokenizer2-parity-verification-preregistration.v1.json`,
2,064 bytes, SHA-256
`cc1472a7531095323dc1fe2fc2bb878bedfff4cc2cc5b5651f129c4800b0ed05`.
It binds the verifier at SHA-256
`67791ba375cc8be2b84f1985eea42a810e4dca4edcc91fb0a9bd9e91ec979173`.
That run produced its two byte-identical oracle outputs and two byte-identical
candidate outputs, then terminated with a verifier defect before comparison and
without a receipt. Its evidence remains immutable and excluded.

The successor verification preregistration is
`contracts/vnext/qwen-tokenizer2-parity-verification-preregistration.v2.json`,
4,373 bytes, SHA-256
`c02523a654c95007b9169bcd4c835b4283f9c7459796d8a943cc4ed0381242b3`.
It binds a fresh four-output run set and verifier SHA-256
`1fac2f476e04b5624fa7030791f5f40faa87d7269a5e215320e1dcab0925f1ad`.
V2 ignores object member order as nonsemantic, preserves array order, requires
strict primitive identity, pins the candidate executable, rehashes source,
artifact, and executable after observation, and writes one create-only pass or
rejection receipt. The one authorized run produced two byte-identical oracle
outputs and two byte-identical candidate outputs, then compared all 2,048 cases
and 69,294 tokens with zero mismatches. Its 3,974-byte receipt has SHA-256
`4ebbfa2bc59d43bdbcd5b3b2528bed66035ff2a3165f554ac6867e7cc7fe0ea6`.

## Threat Analysis

Unbounded counts or lengths could allocate attacker-selected memory. The
header is checked against policy and format ceilings before table allocation.

Arithmetic overflow could turn nonoverlapping sections into aliases. Every
derived offset, length, and output bound uses checked arithmetic and canonical
layout equality.

Duplicate token bytes could make encoding ambiguous. Duplicate token byte
strings are fatal even when IDs differ.

Duplicate merge pairs or malformed rank closure could make implementations
select different outputs. Rank and output are implicit and exact; duplicates
are fatal.

Unknown flags could silently acquire future meaning. Every unknown header or
token flag is fatal.

Unicode drift could change boundaries and therefore model behavior. Both
Unicode authorities are frozen in the profile and checked by the Rust build.

Added-token normalization could corrupt chat markers. Added tokens are valid
UTF-8, matched exactly before normalization, and never pretokenized or merged.

Malformed UTF-8 could create replacement characters and hidden prompt bytes.
Added-token and decoded UTF-8 validation is fatal; no replacement occurs.

Partial output could be mistaken for a valid result. Encode and decode clear
caller output before work and leave it empty after every error.

Vector self-confirmation could hide a shared Rust defect. The vectors and
artifact are generated by a separate Node writer. Rust must reproduce those
bytes and all results without the Node oracle calling Rust.

Tokenizer JSON could smuggle unsupported processors. Conversion must use a
closed duplicate-key-rejecting source parser and reject every unknown or
nonexact field before writing any output.

## Performance Evidence

The current browser evidence is correctness evidence over a 7,459-byte
miniature artifact through the production-shaped WASM boundary. It does not
claim production Qwen tokenizer load time, throughput, memory, WASM speed, or
browser responsiveness. Those full-artifact measurements are registered but
have not been observed.

The Rust parser reads the complete in-memory tokenizer artifact once, uses
bounded tables, and builds explicit token, byte, added-token, and merge
indices. BPE uses a ranked candidate heap rather than repeated full rescans.

The independent Node oracle intentionally uses a simpler repeated-scan BPE
algorithm because its role is differential correctness over bounded vectors,
not production performance.

Promotion requires measurements on the full pinned vocabulary for parse time,
resident bytes, peak allocation, encode/decode throughput, long-input bounds,
and native versus browser-WASM behavior. No performance threshold is lowered
to admit a preferred model.

## Compatibility Impact

Tokenizer2 2.0 is intentionally incompatible with every prior tokenizer
representation.

There is no tokenizer JSON runtime path, SLM1 reader, compatibility reader,
dual reader, alias, migration, fallback, implicit Unicode upgrade, or
automatic version negotiation.

An artifact with another major, minor, algorithm profile, flag, layout, or
Unicode authority fails closed.

Because TinyRustLM is not public, clean replacement is the only supported
policy. Historical evidence remains immutable history but does not remain an
executable product contract.

## Clean Deletion Impact

The old converter behavior that copied `tokenizer.json` and labeled it
Tokenizer2 has been deleted. The converter now emits canonical `.tok2` bytes,
reparses them before promotion, and records raw publisher Jinja only as
unpromoted source evidence rather than falsely labeling it Template2.

Any runtime tokenizer JSON parser, dynamically supplied regex, script-based
tokenization, duplicate tokenizer section, or SLM1 tokenizer reader in the
new product path must be removed rather than wrapped.

Tests and documentation that describe copied JSON as Tokenizer2 must be
replaced in the same coherent change. Historical receipts are not rewritten.

The Node oracle remains a development and conformance tool. It is not shipped
as a browser runtime fallback after Rust/WASM integration passes.

## Unknowns

Native execution of the preregistered behavioral parity experiment now passes
across ordinary text, multilingual text, adversarial Unicode, whitespace,
punctuation, added-token interactions, and decoding. Its 2,048 exact cases,
two-run-per-implementation policy, result schema, comparison rule, evidence
privacy policy, and fatal mismatch rule remain frozen. Structural parity for
every pinned vocabulary entry, merge, and added token is enforced during
conversion.

The source tokenizer's maximum observed token byte length and production
artifact size must be recorded by conversion evidence rather than inferred.

The production Tokenizer2 WASM boundary is implemented and its miniature
native, Node, and real-Chromium gates pass. Full-artifact load, encode, decode,
true worker cancellation, fresh-worker recovery, repeated browser use, and
bounded resource evidence are preregistered but unexecuted.

Template2 linkage and thinking-mode semantics are pending.

The useful model, source-framework parity, P2P-or-convert acquisition, and
browser-local conversation are pending.

**Local verification required**: the four registered v2 source/native outputs
and exact parity receipt now exist and revalidate outside Git. The
full-artifact real-Chromium WASM execution and independent verifier are frozen
under a new no-output preregistration, but neither has run. The registration
must first be committed, pushed, and verified from the fresh remote; the
native corpus and contracts must not change after observation.

## Acceptance Tests

The profile bytes must hash to the exact accepted identity.

The independent Node writer must reproduce the checked-in vector document in
read-only `--check` mode.

The Rust writer must reproduce the Node-authored artifact byte-for-byte.

Rust and Node must agree on the complete header, token table, merge table,
byte table, added tokens, identities, 12 encoding cases, and four decoding
cases.

Both parsers must reject all 13 frozen mutations with the declared stable
error code.

Both parsers must reject every one of the 7,459 proper prefixes.

Rust formatting, all-target tests, and warnings-denied Clippy must pass.

The full pinned tokenizer converter must reject duplicate JSON members,
unknown fields, unsupported processors, noncontiguous IDs, malformed merges,
ambiguous added tokens, drifted special IDs, and source identity drift.

The full converted artifact must match the pinned source oracle over the
preregistered corpus natively and in browser WASM before promotion.

No acceptance test may repair output, retry for a preferred answer, preserve
a legacy reader, or convert a failure into a skip.

## Rollback

Before production, rollback means deleting the unpromoted Tokenizer2 profile,
crate, vectors, oracle, ADR, and all dependent unpublished work as one
coherent source change.

Rollback does not restore tokenizer JSON, SLM1, aliases, compatibility
readers, or any older unpublished runtime path.

If a source-oracle mismatch reveals a profile defect, preserve the raw
failure, add a general regression, replace the profile and vectors together,
delete the invalid implementation, and rerun every affected descendant gate.

If implementation code is defective but the profile remains correct, replace
the implementation, retain the immutable failed evidence, and rerun only the
invalidated implementation and descendant phases.

No rollback changes campaign counters. They remain zero until independent
live campaign evidence exists.
