# TinyRustLM Tokenizer2 Format Foundation Memory

Date: 2026-08-20

## Purpose

This report is the durable routing record for the clean-slate Tokenizer2 2.0
format, independent oracle, and unsafe-free Rust implementation milestone. It
records exactly what implementation commit
`5321f1409cb1c77ddf2090b0b864114dbe9f3d64` proves, what it does not prove,
and the remaining work required to close Gate A of the production SLM2
acquisition and browser-release goal.

The enterprise goal remains active and incomplete.

## Source Control

- Authoritative worktree:
  `E:\Source\.tinyrustlm-model-acquisition-recovered-20260819`
- Branch: `codex/model-acquisition-v2`
- Implementation and architecture commit:
  `5321f1409cb1c77ddf2090b0b864114dbe9f3d64`
- Remote: `origin/codex/model-acquisition-v2`
- The implementation commit was pushed successfully before this report was
  written.
- Protected `E:\Source\Rust\TinyRustLM.com` was read only for pinned source
  evidence and was not modified.
- No files were written to `D:`.

The frozen enterprise goal remains
`docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md`
at SHA256
`92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`.

## Implemented Boundary

`org.minimodel.tokenizer2/2.0` is one closed binary tokenizer profile. Its
canonical artifact has a fixed 192-byte header, 64-byte-aligned token and merge
tables, and one terminal packed byte table. Token IDs and merge ranks are
implicit and contiguous. The first 256 IDs must be a complete single-byte
bijection, every merge output is ID `256 + rank`, and every merge token must
equal the exact concatenation of its left and right inputs.

The Rust crate `rust/crates/tinyrustlm-tokenizer2` supplies the sole product
candidate writer, bounded parser, encoder, and decoder. The writer validates
the complete graph before emitting its first byte. The parser validates exact
envelope, profile, version, Unicode authorities, flags, section arithmetic,
zero padding, token closure, byte alphabet, added-token UTF-8, merge closure,
merge bytes, and terminal file closure before returning a runtime.

Encoding clears caller output before work, matches exact added tokens before
normalization, applies Unicode 9 NFC to unmatched spans, executes the frozen
Qwen split using pinned Unicode 16 categories and whitespace behavior, maps
bytes through the required alphabet, and performs ranked BPE inside each
pretoken. Decoding clears output, validates every ID and byte limit, optionally
skips only tokens carrying the special bit, concatenates exact token bytes,
and rejects invalid final UTF-8 without replacement.

There is no tokenizer JSON runtime reader, dynamic artifact regex, automatic
BOS or EOS insertion, Unicode version range, SLM1 path, dual reader, alias,
migration, compatibility shim, permissive repair, or fallback.

## Independent Oracle

`tinyrustlm/tools/tokenizer2-reference.js` is a separately written Node-core
writer, parser, pretokenizer, encoder, decoder, and vector generator. It does
not import or invoke Rust, Cargo, a native executable, a child process, or the
network.

The Node implementation owns the checked-in canonical artifact bytes. Rust
must reproduce those Node-authored bytes exactly. Node uses a full adjacent
pair rescan for ranked BPE while Rust uses a ranked candidate heap, providing
useful algorithmic independence.

The vector set freezes only Unicode cases whose normalization and property
behavior is stable across the declared source and host authorities. Host Node
Unicode behavior is not promoted into a general Tokenizer2 authority.

## Exact Identities

- Profile: `contracts/vnext/tokenizer2-format-profile.v1.json`
  - 12,442 bytes
  - SHA256 `628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de`
- Vector document: `contracts/vnext/tokenizer2-format-vectors.v1.json`
  - 25,552 bytes
  - SHA256 `9fef7d6c8576d971d72fd248dcedce2888ca0fe2a944fbbb914fed8e07f218aa`
- Canonical miniature Tokenizer2 artifact:
  - 7,459 bytes
  - SHA256 `2b2c3c5f58baacd7af68e2ccffa1cb03e113fa281b1832224d684f9ac03eaff1`
- Independent Node generator/oracle:
  `tinyrustlm/tools/tokenizer2-reference.js`
  - 36,833 bytes
  - SHA256 `bf63b1d985a9af9d42707ec54976d9a78c5d85ac7d87d33ca0818ec030008715`
- Architecture decision:
  `docs/architecture/adr/ADR-014-tokenizer2-format-profile.md`
- Implementation checkpoint:
  `docs/architecture/vnext-tokenizer2-format-implementation.md`

## Pinned Source Evidence

The protected Qwen source was observed at immutable repository revision
`c1899de289a04d12100db370d81485cdf75e47ca`.

- `tokenizer.json`: 11,422,654 bytes; SHA256
  `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4`
- `tokenizer_config.json`: 9,732 bytes; SHA256
  `d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101`
- `config.json`: 726 bytes; SHA256
  `660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd`
- Upstream tokenizer implementation: Hugging Face tokenizers 0.22.2 at
  revision `f383101a26663708484cac0727792aad74f78234`.
- Normalization authority: `unicode-normalization-alignments` 0.1.12,
  Unicode 9.0.0.
- Category authority: `unicode-general-category` 1.1.0, Unicode 16.0.0.
- Source regex authority: Oniguruma 6.9.10, Unicode 16.0.0.

Observed source shape is tokenizer JSON 1.0, NFC normalization, the frozen Qwen
split expression, ByteLevel pretokenizer/postprocessor/decoder options false,
BPE without dropout or fallback features, 151,643 contiguous base IDs,
151,387 ordered merges, and 26 contiguous added-token IDs. EOS is
`<|im_end|>`, pad is `<|endoftext|>`, and no BOS or unknown token is declared.

These observations informed the profile. They are not a complete source
conversion receipt or parity result.

## Verification

The following checks passed against implementation commit
`5321f1409cb1c77ddf2090b0b864114dbe9f3d64`:

- `cargo test --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --all --check`
- 13 focused Rust contract tests
- four Rust cross-language vector tests
- 24/24 direct Node architecture and Tokenizer2 oracle tests
- deterministic Node vector generation check
- independent parser rejection of every one of the 7,459 proper artifact
  prefixes
- exact Rust reproduction of the Node-authored canonical artifact
- canonical JSON parsing
- staged diff hygiene
- focused sensitive-pattern scanning
- frozen enterprise-goal identity revalidation

The miniature corpus contains 277 tokens: the complete 256-byte alphabet, 15
merge outputs, and six added tokens including special, overlapping, and
pre-NFC cases. Vectors cover 11 source-observed split boundaries, 12 encodes,
four decode modes, 13 targeted corruptions, and exhaustive truncation.

## Strict Claim Boundary

This checkpoint proves the exact miniature Tokenizer2 contract and two
independent implementations. It does not prove:

- complete conversion of the pinned Qwen tokenizer;
- broad or adversarial source-oracle token parity;
- the full artifact's deterministic identity, load cost, memory, or speed;
- publisher chat-template behavior;
- deterministic or stochastic sampling;
- SLM2 composition with a real model;
- production native or browser-WASM model inference;
- P2P-or-local-conversion acquisition;
- useful model quality or a genuine browser conversation;
- release, deployment, publication, MemoryEndpoints state, or campaign
  progress.

The 7,459-byte fixture is not a production tokenizer or model artifact and may
not satisfy any model, browser, release, or campaign gate.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain 0/20 qualified models, 0/50 clean browser rounds, 0/25 live memory
rounds, 0/40 externally proven lanes, and 0/20 catalog announcements.

## External Human Gates

The exact 280-slot `holdout-custody-v6` plan still requires two genuinely
separate 140-slot authoring contributions. The exact 1,024-record pilot
curriculum and teacher lineage do not exist, and two genuinely separate,
complete, record-bound curriculum review ledgers do not exist. This agent must
not impersonate an author, reviewer, or independent auditor.

## Exact Resume

Do not repeat the valid miniature profile, vector, or runtime checkpoint unless
a bound identity changes. Close the rest of Tokenizer2 Gate A before beginning
Template2 as the dependent product contract:

1. Replace copied-tokenizer-JSON behavior with one bounded, duplicate-member-
   rejecting source parser for the exact pinned Qwen files.
2. Reject every unknown or nonexact source field and option.
3. Convert the full pinned source twice outside Git and prove byte identity.
4. Persist a receipt binding source revision and hashes, converter identity and
   configuration, profile identity, output bytes, and output SHA256.
5. Run broad ordinary, multilingual, punctuation, whitespace, added-token,
   Unicode-boundary, and adversarial parity against tokenizers 0.22.2.
6. Replay the full artifact through native Rust and browser WASM with bounded
   malformed-input tests.
7. Measure load time, resident memory, peak allocation, encode/decode
   throughput, and rejection behavior.
8. Bind only the accepted full Tokenizer2 identity into Template2 and the
   immutable composition graph.

After Gate A closes, continue Template2, deterministic seeded sampling, real
SLM2 conversion and source/native/WASM parity, production P2P-or-convert
acquisition, browser activation, untouched quality qualification, and one
deletion-backed genuine multi-turn browser conversation in the frozen goal's
dependency order.
