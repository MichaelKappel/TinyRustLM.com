# ADR-014: Exact Tokenizer2 2.0 Qwen ByteLevel BPE profile

## Status

Accepted

The profile is accepted as the sole clean-slate Tokenizer2 target. Its current
implementation is development-only and unpromoted until pinned-source
conversion, full source-oracle parity, native and WASM replay, browser
activation, and useful-model qualification all pass.

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
vocabulary of 151,669. The source bytes and revision remain external inputs;
they have not yet been converted into a promoted Tokenizer2 artifact.

**Local verification required**: the complete pinned tokenizer must still be
converted twice and replayed against the exact upstream implementation over a
broad adversarial corpus.

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
6.9.10. These public identities are source facts, not evidence that the full
private conversion has passed.

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

The current evidence is correctness evidence over a 7,459-byte miniature
artifact. It does not claim production Qwen tokenizer load time, throughput,
memory, WASM speed, or browser responsiveness.

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
Tokenizer2 must be deleted when the exact source converter lands.

Any runtime tokenizer JSON parser, dynamically supplied regex, script-based
tokenization, duplicate tokenizer section, or SLM1 tokenizer reader in the
new product path must be removed rather than wrapped.

Tests and documentation that describe copied JSON as Tokenizer2 must be
replaced in the same coherent change. Historical receipts are not rewritten.

The Node oracle remains a development and conformance tool. It is not shipped
as a browser runtime fallback after Rust/WASM integration passes.

## Unknowns

The exact full-source conversion artifact identity is not yet established.

Full parity across every pinned vocabulary entry, merge, added token, ordinary
corpus item, adversarial Unicode case, and malformed source case is pending.

The source tokenizer's maximum observed token byte length and production
artifact size must be recorded by conversion evidence rather than inferred.

Tokenizer2 WASM load, encode, decode, cancellation, and repeated browser use
are pending.

Template2 linkage and thinking-mode semantics are pending.

The useful model, source-framework parity, P2P-or-convert acquisition, and
browser-local conversation are pending.

**Local verification required**: the exact pinned Qwen source files, hashes,
conversion tool identity, output identity, source-oracle corpus, and receipts
must all be revalidated in the owned worktree and external evidence root.

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
