# Tokenizer2

## Responsibility

Tokenizer2 is the sole portable tokenizer artifact for the current TinyRustLM
composition. It owns deterministic text-to-token and token-to-text semantics.
It does not own chat roles, system policy, generation markers, sampling, stop
conditions, memory authority, or model weights.

The normative authorities are:

- `contracts/vnext/tokenizer2-format-profile.v1.json`
- `contracts/vnext/tokenizer2-format-vectors.v1.json`
- `docs/architecture/adr/ADR-014-tokenizer2-format-profile.md`
- `docs/architecture/vnext-tokenizer2-format-implementation.md`
- `rust/crates/tinyrustlm-tokenizer2`

The canonical composition member is `tokenizer.tokenizer2` with format identity
`org.minimodel.tokenizer2/2.0`.

## Current Profile

The current profile is the bounded Qwen ByteLevel BPE behavior required by the
pinned `Qwen/Qwen3-0.6B` source revision. The artifact contains exact token
bytes, ordered merge records, added-token flags, special-token flags, and the
closed algorithm/profile metadata needed for portable execution.

Token IDs are stable record indices. Merge rank is explicit and deterministic.
Duplicate token bytes, token IDs, merge pairs, ranks, or outputs reject. Every
merge output must equal the exact concatenation of its left and right token
bytes. Added tokens occupy the profile-defined suffix and use deterministic
earliest-position, longest-byte, then lowest-ID matching.

The runtime uses frozen normalization, Unicode-category, split, ByteLevel, BPE,
and decode semantics. It does not use the host locale, browser locale-sensitive
APIs, ambient Unicode data, or a generic artifact-supplied regular expression.
Changing a behavior-relevant Unicode or tokenizer dependency requires a new
sole profile and complete differential evidence.

## Trust Boundary

Tokenizer2 is declarative data. The browser and native runtime do not execute
publisher Python, JavaScript, Jinja, tokenizer JSON programs, arbitrary regex,
or plugin code.

Literal user or retrieved-memory text that resembles a special token remains
untrusted payload. Only the trusted Template2 renderer may create role framing
and generation markers. The tokenizer does not silently interpret user text as
an authorized role transition.

The runtime does not insert BOS, EOS, role separators, or generation markers
by ambient convention. Template2 and Sampling2 own those explicit decisions.

## Unicode And Host Strings

Cross-runtime callers must distinguish bytes, Unicode scalar values, and host
UTF-16 strings. JavaScript and .NET unpaired surrogates are not silently treated
as UTF-8. Invalid input receives a typed rejection under the current profile.

Tests cover NUL, line endings, tabs, nonbreaking space, combining sequences,
normalization lookalikes, variation selectors, emoji sequences, right-to-left
controls, embedded special-token text, maximum lengths, and malformed host
input. Locale-sensitive case conversion, sorting, and segmentation are
forbidden.

## Parser Order

The Tokenizer2 reader validates cheap structure before allocating tables:

1. actual byte length and policy ceiling;
2. fixed magic, format identity, exact version, byte order, flags, and reserved
   bytes;
3. checked section arithmetic, canonical order, alignment, and zero padding;
4. bounded token, merge, added-token, and byte counts;
5. canonical token records and tightly packed byte ranges;
6. canonical merge records and closure over token bytes;
7. exact special-token and algorithm-profile invariants;
8. complete artifact identity.

Truncation, overlap, duplicate rows, empty tokens, invalid references, unknown
fields, unsupported behavior, nonzero padding, and trailing bytes reject. The
reader never repairs or remaps token IDs.

## Evidence

The pinned Qwen tokenizer conversion, exact native source-oracle corpus, Node
reference vectors, WASM replay, and two clean Chromium executions are recorded
in ADR-014 and their content-addressed receipts. Those proofs bind exact bytes
and exact cases; they do not establish model inference, model quality, browser
chat, P2P, or release.

Every downstream numerical or behavioral comparison must bind the exact
Tokenizer2 identity. A token mismatch is diagnosed before blaming a matrix
kernel. Rendered chat bytes, token IDs, attention/position inputs, logits, and
sampled output are separate comparison layers.

## Browser Use

The top window does not tokenize. It creates a canonical Prompt2 request and
streams the exact Tokenizer2 member to the dedicated worker. Rust/WASM parses
and executes Tokenizer2 as part of the active composition. The worker owns
tokenizer state and returns typed token IDs and raw decoded output through the
closed protocol.

There is no JavaScript tokenizer fallback and no second tokenizer embedded in
the model file.

## Change Policy

TinyRustLM has no released tokenizer compatibility population. A correction
replaces the sole profile, converter, native implementation, WASM behavior,
vectors, fixtures, docs, and all composition identities together. Do not retain
an older reader, accept a profile range, alias token IDs, or translate obsolete
artifacts at runtime.
