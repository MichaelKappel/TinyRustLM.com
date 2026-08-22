# Template2 Format Implementation Checkpoint

## Status

This document records the development-only Template2 2.0 checkpoint on
2026-08-22. One exact declarative binary profile, independent Node vectors,
an unsafe-free Rust implementation, a pinned Qwen3 source lock, an output-free
1,024-case corpus, a locked Python/Jinja source oracle, a release Rust
candidate, a zero-retry observation runner, and an independent verifier are
implemented.

The pre-observation gates passed. Registration commit
`2693cec9eeff6af991c78d42a0eb9c9fe5716f60` was pushed and proven equal across
local HEAD, tracking ref, fresh `FETCH_HEAD`, and the actual remote branch.
The registered output root and both cache roots were absent, then the one
authorized five-process observation passed all 1,024 cases with zero retries
and zero mismatches.

This is exact Template2 source/native parity evidence for the frozen supported
Qwen3 branch. Template2 WASM, browser execution, sampling, composition, model
runtime, model quality, acquisition, chat, release, deployment, publication,
and campaign credit remain open.

## Exact Authorities

| Authority | Exact identity |
| --- | --- |
| Profile | `org.minimodel.template2/2.0`; 15,111 bytes; SHA-256 `14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa` |
| Vector document | 34,773 bytes; SHA-256 `b02d50f4f181bb3414a5b14e49544ff7c094f0c98f0f5def0c276bbbd1674160` |
| Canonical artifact | 1,403 bytes; SHA-256 `5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8` |
| Independent Node implementation | 35,530 bytes; SHA-256 `6489359b02cbe97692159ac4bd662b05a0804bf845552d0aa980aa304e17177e` |
| Accepted Tokenizer2 dependency | 7,038,773 bytes; SHA-256 `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b` |
| Pinned model source | `Qwen/Qwen3-0.6B@c1899de289a04d12100db370d81485cdf75e47ca` |
| Publisher template | 4,168 UTF-8 bytes; SHA-256 `a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8` |
| Model config | 726 bytes; SHA-256 `660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd` |
| Source lock | 1,580 bytes; SHA-256 `22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660` |
| Output-free parity corpus | 1,024 cases; 667,912 bytes; SHA-256 `59febbdbec44cfcf92e233626fd7fb3fb140fd43dddee64e684837a7e76df99b` |
| Corpus generator | 12,814 bytes; SHA-256 `25f50232373fcf91a73bb91db464bb53624cf8ad8b5600263cc71e10a44bd791` |
| Execution preregistration | 6,631 bytes; SHA-256 `c42f7dfb14b6861bd8db47dd1fbca590961ed573c69835556815cbe5cdef1051` |
| Verification preregistration | 5,030 bytes; SHA-256 `c61b9556b30fa3a82085d53a96b1e468fa1fa1a5cd81e7b92f961da1ad473095` |
| Publisher oracle | 44,624 bytes; SHA-256 `e4dc5da1da8380ca47254b928ef5d252c903f88d3e96760cae134de5b431177d` |
| Python environment lock | 9,213 bytes; SHA-256 `f803927a2e1747a7130233c5a5847514b71603e71fc8c63cfff5eeaf1ef5d6f9` |
| Python environment closure | 44 files; SHA-256 `0138606aefe81a2a6d1b19917ef0456f5dfc23b0bd4361d87b80638ed6801155` |
| Rust candidate source closure | 8 files; SHA-256 `9bd0dd9209a57d0d9f72698689f15ebc3b3bc76dd833afc818b372920ad31f47` |
| Rust release candidate | 387,584 bytes; SHA-256 `948d16894ffff63f39c4b5c31e61b7b6f8f004b8161f0bb4e29d40e6681ce51d` |
| Independent verifier | 47,408 bytes; SHA-256 `a278d2a1d787d9adba4af2bc4d3eb8a622723f5f0feda4c449763d10c2820954` |
| Observation runner | 14,268 bytes; SHA-256 `c1721bed07baadeee65b3f1e918b40d07ba4d28f22c07663662680fdf2cfc4e9` |
| Source/native parity receipt | 4,206 bytes; SHA-256 `d0a848a0827f536fb69b2d6f19ffb84102b1ff83ac2efed25e564fa9b2810cdb`; 1,024/1,024 exact |
| Public content-free result | 4,727 bytes; SHA-256 `c985f3c95e6554425de1743b723009cb92c17246eac4859c2f9feaa0aa5e3fa0` |

The profile is normative. Vectors and source observations narrow the exact
selected behavior; they do not add unsupported publisher capabilities.

## Binary Boundary

Template2 has a fixed 256-byte header, one 31-record literal table, derived
zero alignment padding, and one terminal byte table. The header binds the
Tokenizer2 artifact, publisher template, model configuration, token counts,
control IDs, stop IDs, limits, role policy, thinking mode, generation policy,
and source profile.

The literal table carries seven renderer literals followed by all remaining
Tokenizer2 added-token literals. Each record has a byte-table offset, byte
length, closed kind, closed flags, optional token ID, and zero reserved field.
The byte table is tightly packed in record order.

The parser requires exact canonical placement and exact source-dependent
literal bytes. It rejects unknown versions, profiles, flags, kinds, padding,
gaps, overlap, aliases, duplicate bytes, duplicate token IDs, malformed token
relationships, source binding drift, and trailing data.

Whole-artifact identity is plain SHA-256 over exact bytes. The artifact does
not embed its own hash, source template text, executable expressions, loops,
or arbitrary field access.

## Rendering Boundary

The renderer accepts one nonempty message list. It permits an optional system
message only at index zero, then strict user/assistant alternation beginning
with user and ending with user for generation.

Message content remains exact UTF-8 bytes. There is no trimming,
normalization, line-ending conversion, escaping, repair, interpolation, or
evaluation. Jinja-looking text in ordinary content is ordinary data.

Every exact Tokenizer2 added-token literal is forbidden in content. This
check happens before output allocation. Empty content is valid.

For each message, Rust emits exact start marker, role, LF, content, end
marker, and LF bytes. It then emits the exact assistant generation prefix with
thinking represented as an empty `<think>...</think>` block and two final line
feeds.

The operation returns exact rendered bytes plus ordered control-insertion
records. Template2 does not tokenize content and does not append a generation
stop token. Composition must consume the insertion records and the ordered
stop IDs without double insertion.

## Independent Vectors

`tinyrustlm/tools/template2-reference.js` owns the canonical vector bytes. It
uses Node core only and does not import or invoke the Rust implementation.

The vectors freeze:

- one exact 1,403-byte artifact;
- 31 literal records and exact bytes;
- eight successful rendering conversations;
- exact insertion kinds, token IDs, message indices, and byte offsets;
- 11 malformed-message rejections;
- one rejection for each of the 26 forbidden added-token literals;
- eight boundary cases;
- 15 single-fault artifact mutations;
- rejection of every proper artifact prefix.

The Rust writer must reproduce the Node-authored artifact byte-for-byte. The
Rust parser and renderer must reproduce every accepted value and stable error
without using the Node implementation at runtime.

## Rust Boundary

`rust/crates/tinyrustlm-template2` forbids unsafe Rust. It exposes closed
artifact data, a deterministic writer, a bounded parser, exact rendering,
control insertion records, immutable identities, and caller-provided resource
limits.

The writer validates all source bindings, layout, literal ordering, flags,
token relationships, and limits before returning bytes. The parser validates
complete canonical structure before exposing a runtime.

Rendering validates the complete request and computes exact output size with
checked arithmetic before allocating. Every error clears output. No caller can
obtain a partially rendered prompt or partial insertion list.

The parity example is a strict typed executable. It rejects duplicate and
unknown JSON members, rehashes the complete preregistration closure, validates
the release executable identity, reads only bounded local inputs, and writes
one create-only result. It has no network dependency.

## Source Oracle Boundary

The source oracle is development-only Python 3.12.10 with Jinja2 3.1.6 and
MarkupSafe 3.0.3. Its 44-file package closure, launcher, base interpreter, and
environment behavior are pinned by exact byte identities.

It runs in isolated mode with bytecode writes disabled and a dedicated empty
pycache prefix. An audit hook rejects network, child-process, ctypes, and other
unregistered effects. The template executes in an immutable sandbox with
`tools=None`, `add_generation_prompt=True`, and `enable_thinking=False`.

The source lock requires exact tokenizer and model configuration identities
and exact publisher-template identity. The source directory is rehashed before
and after observation. The source template is never copied into Template2 and
is never accepted by the product runtime.

## Preregistered Corpus

The corpus is deterministic from seed
`6115e5fc9bd68e4045529cb12f3088398fa91005572b6c92c9fe17c6627e4e99`.
It contains no expected rendered bytes, hashes, answer fragments, or candidate
output.

Its 1,024 cases cover system/no-system branches, empty and Unicode content,
whitespace and line-ending preservation, template-looking data, long bounded
content, conversation length, role-state evolution, and varied deterministic
combinations. Every case has a unique ID and unique message sequence.

The parity-run limits are narrower than production artifact limits: at most
16 messages, 32,768 content bytes per message, and 65,536 total content bytes
per case. This keeps the evidence bounded without changing rendering
semantics.

## Observation And Verification

The registered output directory name is
`qwen3-template2-parity-20260822-v1`. It must not exist before execution.

The observation runner creates one owned output root and invokes exactly five
child processes in this order:

1. source oracle run 1;
2. source oracle run 2;
3. Rust candidate run 1;
4. Rust candidate run 2;
5. independent verifier run 1.

There are zero retries. Each producer uses a unique create-only output path.
A producer or verifier failure is terminal and preserves every raw file. A
valid pass receipt and terminal-failure receipt cannot coexist.

The verifier requires byte-identical repeated oracle outputs and byte-identical
repeated candidate outputs. It then compares every case, rendered byte length,
rendered SHA-256, and exact rendered UTF-8 hex. JSON object member order is
nonsemantic; array order and primitive identity remain semantic.

The bounded receipt excludes message content, rendered text, rendered hex,
private paths, and mismatches. A mismatch creates no pass receipt.

## Current Verification

The following focused gates pass before comparative execution:

- 11 Rust contract tests;
- five Rust language-neutral vector tests;
- 10 independent Node vector tests;
- deterministic vector and corpus read-only checks;
- Rust check, format, and all-target warnings-denied Clippy;
- six parity-preregistration tests covering all implementation identities,
  deterministic output-free corpus reproduction, isolation, no repair,
  malformed invocation, semantic comparison, profile drift, and typed
  malformed closure rejection;
- Python validation-only preflight over all 1,024 cases and every registered
  source, environment, and candidate identity;
- empty preflight pycache and zero comparative output files.

The final complete standard Node partition additionally passed 1,030 executed
tests with zero failures and retained one truthful conditional package test
skip because independently built MiniModel sibling package inputs were absent.

After those gates, the one authorized observation produced two byte-identical
1,181,169-byte source-oracle results and two byte-identical 1,181,161-byte
candidate results. The independent verifier accepted exact case order, all
483,375 rendered bytes, repeated producer stability, post-observation source,
environment, executable, and artifact rehashes, and zero mismatches.

## Remaining Gate B Work

1. Preserve the completed registration, four raw results, receipt, and public
   result without rerun or overwrite.
2. Build and preregister the Template2 WASM/browser boundary against the
   accepted native result before any browser output.
3. Prove exact Template2-plus-Tokenizer2 composition in native Rust and two
   fresh real-Chromium workers, including no double control insertion,
   cancellation, recovery, zero network, deletion, and resource bounds.
4. Bind accepted Template2 and Tokenizer2 into deterministic sampling only
   after that browser composition gate passes.

## Claim Boundary

This checkpoint grants exact source/native Template2 parity for the frozen
supported branch. It grants no browser-WASM, model-runtime, model-quality,
browser-round, memory-round, P2P-lane, catalog, release, deployment, or
publication claim.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain 0/20 models, 0/50 browser rounds, 0/25 live memory rounds, 0/40
outside-proven lanes, and 0/20 announcements.
