# Prompt2 2.0 Exact Composition Contract

## Status

Prompt2 2.0 is an implemented, development-only format, wire, and native
composition boundary. Its canonical profile, independent Node implementation,
cross-language vectors, unsafe-free Rust implementation, request/result wire
formats, and load-bundle geometry pass focused local tests.
Its mixed-Q8 SLM2 dependency replacement was frozen before output at
remote-exact commit `6684585964e79d7237bd05398dad4cafd455d1e2`.

The exact accepted full Tokenizer2 artifact has not yet been executed through
this new composition runtime. Native comparative output, browser WASM,
fresh-Chromium evidence, model inference, quality, product activation,
release, deployment, publication, and campaign evidence remain open.

## Purpose

Tokenizer2, Template2, and Sampling2 each own one narrow deterministic
algorithm. Prompt2 owns the one place where those accepted algorithms are
combined for a generation request. It prevents browser, native, converter, or
model code from quietly choosing different prompt bytes, control-token
insertion, token IDs, stop order, sampling configuration, seed expansion, or
initial controller state.

Prompt2 does not bind model bytes. A later composition graph must bind the
exact SLM2 artifact and conversion receipt in addition to the Prompt2 family.

## Frozen Identities

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Prompt2 profile | 19,421 | `f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c` |
| Prompt2 vectors | 347,532 | `4b4a4497245ee371e4f3e2b930e3413caa0f8bb70b04c3385880b11de83c487e` |
| Node reference | 58,803 | `7beb1edec00d0f24f8c308419a0b00e30abee090c331a5d563a6783f4e9f04ef` |
| Canonical Prompt2 artifact | 512 | `27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3` |
| Standalone Rust lockfile | 5,928 | `48dca83e7e45403cc012835e593db612003ed49c5fd9024473f1f52a9af21b29` |

The Prompt2 artifact binds these already accepted inputs:

- Tokenizer2 profile `628427bf...69b8de` and exact 7,038,773-byte Qwen
  artifact `cbbf907e...5b8f7b`;
- Template2 profile `14ff1df8...ea7bfa` and exact 1,403-byte artifact
  `5300b0b4...9c9c8`;
- Sampling2 profile `ec65e8f1...429d` and exact 65,800-byte artifact
  `9e02fcfb...2f89`;
- Sampling2 Q48 table `fce2345b...c677`;
- pinned Qwen source model configuration `660db3b7...7dd`;
- pinned publisher template `a55ee1b1...d8`;
- mixed-Q8 SLM2 format profile `5ac819cb...738d8`; and
- accepted runtime-Q8 vectors `c437ebb5...733a0`.

The superseded dense-F32 profile and scalar-runtime-vector digests are
registered hostile inputs. They fail the dependency-identity check and are not
accepted through a compatibility path.

The root `Cargo.toml` and `Cargo.lock` remain byte-identical to their accepted
pre-Prompt2 state. Prompt2 is a standalone exact-lock workspace because those
root files are immutable evidence inputs, not because a second product path is
supported.

## Artifact Contract

The sole profile identifier is `org.minimodel.prompt2/2.0`. The artifact is
exactly 512 little-endian bytes and starts with `PRM2`, CRLF, SUB, LF and the
fixed `minimodel.prm2` format identifier.

The header freezes dependency lengths and hashes, tokenizer token count
151,669, model logit vocabulary 151,936, maximum context 40,960, maximum new
tokens 4,096, explicit disabled-thinking mode, no automatic BOS or EOS, and
ordered stop IDs `[151645, 151643]`. Unknown flags, versions, fields, reserved
bytes, surplus bytes, and alternate identities fail closed.

## Request Wire

`tinyrustlm.prompt2-request/1` is one bounded little-endian request. It carries
one to 256 exact UTF-8 messages, closed role IDs, contiguous message records,
zero alignment padding, the complete Sampling2 configuration, and one u64
seed. It has no optional defaults or extension map.

The wire parser validates bytes and geometry. Template2 remains authoritative
for optional-system placement, strict user-assistant alternation, final-user
state, and forbidden control strings during compilation.

The maximum request is 1,054,848 bytes. A request that exceeds any content or
count ceiling fails before rendering.

## Load Bundle

`tinyrustlm.prompt2-load-bundle/1` contains exactly four contiguous sections:
Prompt2, Tokenizer2, Template2, and Sampling2. Its complete length is
7,106,616 bytes. It has no section padding, optional member, trailing data,
path, URL, alias, or compatibility field.

Geometry parsing alone does not claim dependency validity. Runtime
construction independently checks every byte length and whole-artifact hash,
then invokes each accepted parser under exact profile ceilings.

## Composition Algorithm

1. Parse one canonical request or accept one already validated typed request.
2. Render the full message sequence through Template2 exactly once.
3. Require disabled thinking, no automatic BOS/EOS, and the exact ordered stop
   set.
4. Encode the complete rendered UTF-8 through Tokenizer2 exactly once.
5. Reject a prompt over 40,960 tokens; no truncation or repair is permitted.
6. Independently encode every non-control span, insert each Template2-owned
   control token once, and require complete token-array equality with step 4.
7. Bind every control insertion to kind, message index, token ID, UTF-8 byte
   offset, and token index.
8. Expand the caller's u64 seed through Sampling2 and construct one controller
   with model vocabulary 151,936 and stop IDs `[151645, 151643]`.
9. A prompt of exactly 40,960 tokens yields a terminal context-limit
   controller without sampling. A shorter prompt yields active.
10. Serialize only the canonical result after all checks pass.

The runtime returns a `Prompt2Plan` containing the immutable result and its
live controller. Failures return no partial result and no selected token.

## Result Wire

`tinyrustlm.prompt2-result/1` carries the exact rendered UTF-8, all prompt token
IDs, every mapped control insertion, the ordered stop set, the initial 40-byte
Sampling2 state, and active or context-limit status.

The parser rejects token IDs outside the accepted Tokenizer2 token count,
invalid insertion count/order, wrong message indexes, mismatched control
bytes, mismatched token positions, duplicate or unmapped control tokens,
invalid Sampling2 states, status/count disagreement, nonzero padding, malformed
offsets, and trailing bytes.

The vector corpus includes a 12-token active result and a structural
40,960-token context-limit result. Large exact result bytes are represented as
32 KiB chunks so the repository's strict JSON per-string limit remains
authoritative. The binary result itself is not changed by chunking.

## Independent Implementations

`tinyrustlm/tools/prompt2-reference.js` independently writes and parses the
artifact and all three wires. It composes the accepted Node Tokenizer2,
Template2, and Sampling2 authorities but imports no Rust, subprocess, network,
template engine, or model runtime.

`rust/crates/tinyrustlm-prompt2` independently reproduces all artifact,
request, and result bytes. It forbids unsafe Rust and consumes the accepted
typed dependency crates. The Rust runtime is implemented but intentionally
has not produced full-artifact composition output before preregistration.

## Local Verification

Focused Node verification passes 11 tests. It covers generator equality,
profile/artifact identities, all 512 proper prefixes, 15 artifact mutations,
three request cases, nine request mutations, two result cases, 18 result
mutations, strict JSON limits, load geometry, dependency rejection, source
isolation, and the claim boundary.

Focused locked Rust verification passes four contract tests and three
cross-language vector tests. Rust reproduces every Node byte sequence and
stable mutation error. `cargo fmt --check` passes, and Clippy passes for all
targets with warnings denied.

These are local format and native-core facts. They are not full Qwen
composition evidence because the accepted 7,038,773-byte Tokenizer2 artifact
has not yet been supplied to Prompt2 in a registered execution.

## Preserved Failure

The first generated vector represented the 40,960-token result in one
328 KiB hex string. The repository strict JSON parser correctly rejected that
string at its security ceiling. The parser limit was not weakened. The
uncommitted pre-freeze vector was replaced by deterministic 32 KiB chunks, and
the strict-parser test now passes.

## Open Gates

- freeze an output-free Prompt2 composition corpus and exact execution plan;
- implement the raw import-free WASM boundary and adapter;
- commit, push, fresh-fetch, and prove preregistration remote-exact;
- run one native registration and two fresh-Chromium profiles with zero
  network, worker termination, fresh-worker recovery, process closure, and
  profile deletion;
- verify byte-identical rendered bytes, token IDs, insertion maps, stops,
  state, and status;
- bind a real SLM2 model and conversion receipt in a later composition graph;
- execute and qualify a real browser-local multi-turn conversation; and
- complete release, deployment, HTTPS readback, and publication gates.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
MemoryEndpoints remains unauthorized and disconnected.
