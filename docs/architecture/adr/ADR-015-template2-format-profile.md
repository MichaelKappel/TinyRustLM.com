# ADR-015: Exact Template2 2.0 Qwen chat-rendering profile

## Status

Accepted

Template2 2.0 is accepted as the sole clean-slate chat-template artifact for
the first Qwen3 vertical slice. The binary contract, independent Node vectors,
unsafe-free Rust parser/writer/renderer, exact source lock, output-free parity
corpus, isolated publisher oracle, native candidate, observation runner, and
independent verifier are implemented and preregistered.

The profile remains development-only and unpromoted. After registration commit
`2693cec9eeff6af991c78d42a0eb9c9fe5716f60` was pushed and proven equal across
local, tracking, fresh-fetch, and actual remote views, the one authorized
source/native observation passed all 1,024 cases with zero mismatches. No
browser-WASM Template2 result, model-runtime result, or product claim exists
at this checkpoint, and the completed registration must not be rerun.

## Decision Date

2026-08-22

## Scope

This decision defines the exact portable artifact and rendering behavior that
turns a supported sequence of chat messages into the next-assistant prompt for
`Qwen/Qwen3-0.6B` revision
`c1899de289a04d12100db370d81485cdf75e47ca`.

It covers binary layout, source-template and Tokenizer2 bindings, required
literals, message schema, role ordering, whitespace, thinking-disabled
generation syntax, control-token ownership, stop-token ownership, limits,
failure behavior, source admission, and composition requirements.

It does not define tokenization, transformer operators, sampling algorithms,
generation length, model conversion, model quality, P2P acquisition, browser
conversation UX, release authority, deployment, publication, or campaign
credit.

**Observed local fact**: the pinned publisher Jinja value is 4,168 UTF-8 bytes
with SHA-256
`a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8`.
Its supported product branch is tools absent, generation prompt present,
thinking disabled, string content, and a strict user-assistant alternation
with an optional first system message.

**Engineering decision**: the runtime compiles that one observed supported
branch into declarative Template2 bytes. The product never executes publisher
Jinja, stores executable template expressions, or ships a Jinja interpreter.

**Observed local fact**: the exact preregistered publisher oracle and Rust
candidate independently rendered all 1,024 frozen supported cases twice. Both
producer pairs are byte-stable and every one of the 483,375 rendered UTF-8
bytes matches in exact case order.

## Decision

The sole accepted profile identifier is `org.minimodel.template2/2.0`.

The artifact starts with `TPL2`, CRLF, SUB, LF and the fixed 16-byte format ID
`minimodel.tpl2` followed by two zero bytes. It accepts exactly major 2,
minor 0, little-endian values, renderer profile 1, and zero feature flags.

The header is exactly 256 bytes. The literal table begins at byte 256 and has
31 fixed 24-byte records. The terminal byte table begins at the unique
64-byte-aligned offset after the literal table. Only derived zero alignment
padding is allowed. Gaps, overlap, aliases, nonzero reserved bytes, unknown
flags, and trailing bytes are fatal.

The artifact binds these external authorities without embedding them:

- the 7,038,773-byte accepted Tokenizer2 artifact with SHA-256
  `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`;
- Tokenizer2 token count 151,669;
- model vocabulary size 151,936;
- exact publisher-template SHA-256;
- exact model-config SHA-256
  `660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd`.

Seven required renderer literals appear first in kind order: message start,
message end, system, user, assistant, line feed, and the thinking-disabled
generation prefix. The remaining 24 literals are every other tokenizer added
token in ascending token-ID order. Literal bytes are nonempty, tightly packed,
and unique. Unknown kinds, flags, duplicate bytes, duplicate token IDs, and
invalid token/flag relationships are fatal.

Accepted messages have exactly two fields: `role` and `content`. Roles are the
case-sensitive closed enum `system`, `user`, and `assistant`. Content is an
exact valid UTF-8 string. Unknown or duplicate fields, nested content,
non-string content, role aliases, and unknown roles are fatal.

An optional system message may occur exactly once at index zero. The first
conversational role is user. Conversational messages use strict
user-assistant alternation. A generation request must end in user. Empty
content is valid and remains empty. Content is not trimmed, normalized,
rewritten, line-ending-converted, repaired, or interpreted as template syntax.

All 26 exact tokenizer added-token literals are forbidden in message content.
This prevents untrusted message bytes from synthesizing control boundaries or
auxiliary model-token semantics. A match is fatal; it is not escaped or
silently transformed.

Each message renders as:

`message-start + role + LF + content + message-end + LF`.

The generation suffix renders exactly as:

`message-start + assistant + LF + <think> + LF + LF + </think> + LF + LF`.

The renderer always appends that suffix, explicitly disables thinking, and
does not append a generation stop token. There is no automatic BOS or EOS.
Template2 owns message-start, message-end, thinking-start, and thinking-end
insertions. The sampling runtime owns the ordered stop set `[151645, 151643]`.
Composition rejects double insertion or a mismatched stop set.

The artifact policy allows at most 256 messages, 262,144 content bytes per
message, 1,048,576 total content bytes, 1,114,112 rendered bytes, and 40,960
prompt tokens. All size arithmetic is checked before allocation. Every failure
returns no partial rendered output or insertion list.

The runtime accepts Template2 bytes only. It does not accept raw Jinja,
JavaScript templates, publisher programs, SLM1 template sections, aliases,
version ranges, migrations, compatibility readers, repair, or fallback.

## Alternatives

Executing the publisher Jinja template at runtime was rejected. It makes
publisher code part of the product trust boundary, expands the browser attack
surface, and permits source behavior to drift independently of artifact
identity.

Shipping Jinja in Rust, JavaScript, or WASM was rejected. TinyRustLM needs one
closed rendering behavior, not a general template language or three engines
whose edge semantics can diverge.

Accepting the full publisher feature surface was rejected. Tools, tool-role
messages, tool calls, reasoning fields, thinking-enabled generation,
non-string content, and render-without-generation-prompt are not required by
the first product path and would add unqualified semantics.

Escaping control literals in content was rejected. Escaping would alter user
bytes and create tokenizer-dependent repair behavior. The request fails
clearly before allocation instead.

Implicitly using the model vocabulary size as Tokenizer2 token count was
rejected. The authorities are distinct and are independently bound.

Embedding Template2 into SLM2 or Tokenizer2 was rejected. Model, tokenizer,
template, sampling, and composition identities remain independently
replaceable and explicitly bound.

## Authoritative Evidence

The normative machine profile is
`contracts/vnext/template2-format-profile.v1.json`, 15,111 bytes, SHA-256
`14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa`.

The independent vector contract is
`contracts/vnext/template2-format-vectors.v1.json`, 34,773 bytes, SHA-256
`b02d50f4f181bb3414a5b14e49544ff7c094f0c98f0f5def0c276bbbd1674160`.
It owns one 1,403-byte canonical artifact with SHA-256
`5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8`.

The independent Node-core writer/parser/renderer is
`tinyrustlm/tools/template2-reference.js`, 35,530 bytes, SHA-256
`6489359b02cbe97692159ac4bd662b05a0804bf845552d0aa980aa304e17177e`.
It does not invoke Rust, a subprocess, a network operation, or publisher code.

The vector set contains eight successful render cases, 11 malformed-message
cases, all 26 forbidden added-token cases, eight boundary cases, 15 targeted
artifact mutations, and rejection of every one of the 1,403 proper prefixes.

The product candidate is the unsafe-free
`rust/crates/tinyrustlm-template2` crate. It independently reproduces the
Node-authored artifact and rendering vectors.

The exact source lock is
`contracts/vnext/qwen3-0.6b-template2-source-lock.v1.json`, 1,580 bytes,
SHA-256
`22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660`.

The output-free source-parity corpus is 667,912 bytes with 1,024 unique cases
and SHA-256
`59febbdbec44cfcf92e233626fd7fb3fb140fd43dddee64e684837a7e76df99b`.

The execution preregistration is 6,631 bytes with SHA-256
`c42f7dfb14b6861bd8db47dd1fbca590961ed573c69835556815cbe5cdef1051`.
The independent verification preregistration is 5,030 bytes with SHA-256
`c61b9556b30fa3a82085d53a96b1e468fa1fa1a5cd81e7b92f961da1ad473095`.

A validation-only preflight rehashed the profiles, complete candidate closure,
Python/Jinja closure, source lock, pinned source files, and all 1,024 cases.
It passed without calling source rendering or creating comparative output.

The one registered observation then invoked exactly two source runs, two
candidate runs, and one verifier with zero retries. Its 4,206-byte bounded
receipt has SHA-256
`d0a848a0827f536fb69b2d6f19ffb84102b1ff83ac2efed25e564fa9b2810cdb`.
The 4,727-byte public content-free result has SHA-256
`c985f3c95e6554425de1743b723009cb92c17246eac4859c2f9feaa0aa5e3fa0`.
It records 1,024 exact cases, 483,375 total rendered bytes, a 7,204-byte
maximum, exact repeated producer bytes, exact source/native bytes, and zero
mismatches without message content, rendered text, rendered hex, or private
paths.

## Threat Analysis

Executable publisher expressions could reach runtime. Template2 stores only a
fixed declarative profile and literals; expressions and loops are
unrepresentable.

Message content could inject control tokens. Every bound added-token literal
is rejected before rendering, including tokens unrelated to the supported
text-only branch.

Role ambiguity could change prompt authority. Roles are a closed exact enum,
system is position-bound, and alternation is mandatory.

Whitespace drift could change tokenization. Every line feed and the exact two
line feeds after `</think>` are normative bytes.

Source drift could preserve a friendly model name while changing behavior.
Source template, tokenizer configuration, model configuration, revision, and
complete execution closures are hashed before and after observation.

Partial output could be mistaken for a prompt. Length and policy validation
complete before allocation; every error leaves all outputs empty.

Large messages could overflow derived lengths. Counts and byte totals are
bounded, checked arithmetically, and validated before allocation.

An oracle and candidate could share one implementation defect. The publisher
oracle executes pinned Jinja in an isolated immutable sandbox; the candidate
is separately written Rust; the verifier is independent Node.

An easy corpus could be selected after seeing output. The deterministic seed,
generator, case order, categories, and output-free corpus are registered
before comparative execution.

JSON object ordering could create a false mismatch. The verifier ignores only
object-member order and treats array order, primitive type, and primitive
value as semantic.

## Performance Evidence

Current correctness evidence includes the full preregistered 1,024-case native
source comparison. The registration did not define a publishable timing or
memory benchmark, so no native performance, browser-WASM memory, or throughput
claim is made from its short wall-clock duration.

The Rust renderer computes exact output size with checked arithmetic, reserves
once, and writes deterministic bytes plus bounded insertion records. This is
an implementation property, not a production benchmark.

Promotion requires measured native and real-browser WASM parse time, repeated
render throughput, memory growth, maximum-bound behavior, cancellation, and
fresh-worker recovery against the accepted artifact and frozen cases. A
performance failure remains a failure and cannot lower correctness gates.

## Compatibility Impact

Template2 2.0 is intentionally incompatible with every prior or ad hoc chat
template representation.

There is no raw publisher Jinja runtime, SLM1 template reader, JavaScript
template path, alias, migration, compatibility shim, dual reader, repair,
fallback, or automatic version negotiation.

An artifact with another version, renderer profile, flag, literal inventory,
source identity, Tokenizer2 identity, role policy, or stop set fails closed.

TinyRustLM is pre-public, so clean replacement is the supported policy.
Historical evidence remains immutable but does not remain executable.

## Clean Deletion Impact

Any prior code that downloads, stores, or executes publisher template text in
the product path must be deleted when Template2 is integrated.

Any duplicate JavaScript renderer, permissive message coercion, role alias,
automatic control-token insertion, content repair, or fallback path must be
deleted rather than wrapped.

Tests and documentation that call raw publisher Jinja a product template must
be replaced in the same coherent change. The isolated Python oracle remains a
development-only conformance authority outside shipped runtime assets.

## Unknowns

Exact source/native parity is complete for the frozen supported publisher
branch. Its four raw files and bounded receipt remain private evidence outside
Git and must be preserved without rerun or overwrite.

The production Template2 WASM boundary, repeated browser execution,
cancellation/recovery, profile deletion, and resource evidence are pending.

The exact composition step from rendered bytes and insertion records through
Tokenizer2 must prove no duplicate control insertion and must bind prompt
token count to the model context and generation budget.

Deterministic sampling, source-framework real-model parity, useful-model
quality, acquisition, chat UX, release, deployment, and publication remain
pending.

**Local verification required**: build a separately preregistered production
Template2 WASM boundary and prove native-to-real-Chromium composition against
this accepted identity before any browser output or deterministic sampling
claim.

## Acceptance Tests

The profile and vector bytes must match their exact accepted identities.

The Node writer must reproduce the vector document and canonical artifact in
read-only check mode.

The Rust writer must reproduce the Node-authored artifact byte-for-byte.

Node and Rust must agree on all successful renders, insertion offsets,
rejections, mutations, limits, and every proper-prefix rejection.

Both parsers must reject unknown fields, flags, versions, roles, malformed
layout, duplicate literals, source drift, forbidden content, and partial
artifacts with stable typed errors.

Rust tests, rustfmt, and all-target warnings-denied Clippy must pass.

The output-free 1,024-case corpus must reproduce exactly from its registered
generator and seed.

The isolated source oracle, native candidate, observation runner, and verifier
must rehash every bound input before comparative execution.

After commit, push, and fresh-remote equality, exactly two source runs and two
candidate runs were byte-stable. The independent verifier compared all cases
once and wrote one create-only bounded receipt because every rendered byte
matched.

No test may execute comparative output before registration, retry, select,
repair, normalize, reorder, hand-edit, overwrite, hide a mismatch, preserve a
legacy path, or turn terminal failure into a skip.

## Rollback

Before production, rollback means deleting the unpromoted Template2 profile,
crate, vectors, source lock, corpus, oracle, preregistrations, ADR, and every
unpublished dependent path as one reviewed source change.

Rollback does not restore raw Jinja execution, JavaScript templates, SLM1,
aliases, migrations, compatibility readers, repair, or fallback.

If source parity exposes a profile defect, preserve the failed raw evidence,
write a general regression, create a new profile and fresh output root, and
invalidate every dependent phase. Do not alter or retry this registration.

If only an implementation is defective, preserve the failure, replace the
implementation, issue a new preregistration, and rerun only invalidated
descendants.

No rollback changes campaign counters. They remain 0/20, 0/50, 0/25, 0/40,
and 0/20 until matching live evidence exists.
