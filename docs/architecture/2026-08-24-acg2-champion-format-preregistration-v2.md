# Corrected ACG2 Champion Format Preregistration

## Status

Registered output-free after the Prompt2 mixed-Q8 dependency replacement.
No ACG2 profile, vector, artifact, Node oracle, Rust crate, runtime activation,
model output, or browser output exists at this checkpoint.

The `v2` suffix on the preregistration schema is a technical evidence revision
only. TinyRustLM remains one prelaunch product. There is no second product
generation, supported old product, migration population, compatibility range,
alias, fallback, or deferred-cleanup authority.

## Why A Corrected Registration Is Required

The first ACG2 registration was committed before output and bound the current
mixed-Q8 SLM2 profile, but its Prompt2 member still bound the prior Prompt2
profile. That prior Prompt2 artifact required superseded dense-F32 SLM2
profile and scalar-runtime-vector hashes. A graph produced from those inputs
could never satisfy Prompt2-to-model dependency closure.

The dependency audit caught the defect before any ACG2 output. The first
registration remains immutable at commit
`39feda199eea782ff32f9ffb2b93f7c1a1b21d33`, 11,929 bytes with SHA-256
`afec4dccad2062728677b6987519ce2385a1bca3761fe8f0927ac80242d6403d`.
It is terminally superseded before output and may not be edited, implemented,
or reused.

Prompt2 was then replaced under output-free registration
`6684585964e79d7237bd05398dad4cafd455d1e2`. The implementation commit
`fb321d4ce9eec0510162a27e4527bc626a307755` was pushed and proven exact across
local HEAD, tracking, FETCH_HEAD, and the actual remote before this corrected
registration was authored.

## Registration Authority

The machine authority is
`contracts/vnext/acg2-champion-format-preregistration.v2.json`. It binds parent
commit `c4030d394c56b8eeb422900e74935703c048c703` and tree
`89cb3c8bb272c4c43fb9a1d5349877cf83c21032` on the sole authorized recovered
workspace and branch.

The corrected Prompt2 profile is 19,421 bytes at SHA-256
`f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c`.
Its canonical 512-byte artifact is
`27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3`.
It binds mixed-Q8 SLM2 profile
`5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8`
and runtime-Q8 vectors
`c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0`.

Accepted Tokenizer2, Template2, and Sampling2 evidence remains immutable and
was not rerun.

## Fixed Binary Contract

The useful design from the first registration is unchanged. One ACG2 graph is
exactly 896 bytes:

- one fixed 256-byte little-endian header;
- exactly five 128-byte member records;
- no embedded member bytes;
- no paths, URLs, aliases, credentials, names, extension maps, or trailing
  bytes.

The header contains fixed magic and format ID, technical version 2.0, closed
champion-chat artifact class, exact table geometry, checked total resolved
member bytes, a graph identity digest, and a member-table digest. All reserved
bytes are zero.

Each member record contains record version, closed role, closed format,
zero-based ordinal, positive role-bounded byte length, exact artifact SHA-256,
and exact format-profile SHA-256. All flags and reserved bytes are zero.

The order is exactly model, tokenizer, template, sampling, prompt. Missing,
additional, duplicate, reordered, optional, adapter, specialist, router, or
unknown records are fatal.

## Corrected Member Profiles

| Ordinal | Role | Format profile SHA-256 | Maximum bytes |
| ---: | --- | --- | ---: |
| 0 | mixed-Q8 SLM2 model | `5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8` | 68,719,476,736 |
| 1 | Tokenizer2 | `628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de` | 67,108,864 |
| 2 | Template2 | `14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa` | 1,048,576 |
| 3 | Sampling2 | `ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d` | 65,800 |
| 4 | Prompt2 | `f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c` | 512 |

The graph records an artifact hash and actual positive byte length for each
member at write time. The table above freezes profile ownership and ceilings;
it does not invent a qualified model artifact.

## Dependency Closure

Member identity is necessary but not sufficient. Before activation, the
Prompt2 artifact must be parsed by its canonical owner and its dependencies
must equal the graph members:

1. Prompt2's SLM2 format-profile digest equals the model member profile.
2. Prompt2's Tokenizer2 profile and artifact digests equal the tokenizer
   member.
3. Prompt2's Template2 profile and artifact digests equal the template
   member.
4. Prompt2's Sampling2 profile and artifact digests equal the sampling
   member.
5. Prompt2's runtime-Q8-vector digest equals the sole current runtime
   authority.

Any mismatch is fatal before resource preflight or state mutation. There is no
hash alias, old-profile reader, compatibility map, or best-effort binding.

## Identity Domains

The member table digest is plain SHA-256 over all 640 record bytes. The graph
identity uses domain `tinyrustlm.acg2.champion-graph.v1` plus a zero byte,
technical version, artifact class, member count, resolved member-byte total,
and the complete table bytes. The whole composition identity is plain SHA-256
over all 896 graph bytes.

These three digests are not interchangeable. Changing any member role, format,
ordinal, length, artifact hash, or profile hash changes table, graph, and whole
identities.

## Bounded Resolution

The runtime may open only one member stream at a time and hash it with one
fixed 1 MiB buffer. It requires the exact declared length and artifact digest
before canonical parsing. The complete checked resolved-member ceiling is
68,787,700,488 bytes. Integer overflow, early EOF, surplus bytes, same-length
substitution, parser disagreement, or member drift is fatal.

The graph contains no locator. A caller supplies already resolved immutable
member handles through the bounded artifact store. Acquisition policy, paths,
P2P endpoints, and credentials remain outside graph bytes.

## Transactional Activation

Candidate validation is isolated from active state. It hashes and parses every
member, cross-checks all dependencies, and accepts the complete memory and
resource plan before mutation. It creates no F32 model-weight shadow.

A successful activation performs one immutable swap and clears incompatible
KV and generation state before another token. A failed or stale operation
preserves the active composition, KV, generation, operation, and transcript
state exactly. Partial activation and in-place mutation are forbidden.

## Implementation Outputs

After this registration is committed, pushed, fresh-fetched, and proven equal
to the actual remote, implementation may create exactly:

- `contracts/vnext/acg2-format-profile.v1.json`;
- `contracts/vnext/acg2-format-vectors.v1.json`;
- `tinyrustlm/tools/acg2-reference.js`;
- `tinyrustlm/tests/acg2-format-vectors.test.js`;
- `rust/crates/tinyrustlm-composition2`;
- the updated ADR-019 implementation evidence.

The Node authority uses built-ins only and may not invoke Rust, subprocesses,
network, or generated Rust output. Rust must independently reproduce the Node
bytes and stable hostile verdicts.

## Required Verification

Implementation must prove every proper prefix rejects; every header and member
field mutation has an exact stable verdict; role/order/format/profile/length/
hash/table/graph/trailing drift rejects; missing, extra, duplicate, and
reordered members reject; large-model streaming stays within the fixed buffer;
and both superseded Prompt2 identities reject.

Activation tests must prove failure preserves all active state, success clears
KV and generation, stale operation identity cannot mutate state, and repeated
switching remains bounded. Native and browser-WASM consumers must eventually
consume the same graph and exact members.

## Clean-Slate Rule

No ACG1 reader or writer, compatibility alias, migration, format negotiation,
optional-member fallback, path or URL locator, mutable alias, adapter or router
record, partial activation, hidden retry, or second product path may be added.
Once the complete new consumer closure passes, superseded executable ACG1 and
SLM1 paths must be deleted in the same major replacement. Historical evidence
remains non-executable audit truth only.

## Claim Boundary

This registration proves only that a corrected graph contract was frozen
before output. It does not prove ACG2 implementation, activation, model
conversion, model quality, browser chat, P2P availability, package publication,
site deployment, or MemoryEndpoints operation.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain 0/20 qualified models, 0/50 deletion-backed browser rounds, 0/25
authorized live memory rounds, 0/40 current outside-network lane proofs, and
0/20 live catalog announcements.

## Rollback

Before implementation output, rollback means removing this unpromoted
registration commit. After output, a defect requires a new output-free
technical identity and complete descendant invalidation. Rollback never means
implementing the first registration, accepting old Prompt2 bytes, adding a
compatibility path, weakening dependency checks, or translating local format
tests into product claims.
