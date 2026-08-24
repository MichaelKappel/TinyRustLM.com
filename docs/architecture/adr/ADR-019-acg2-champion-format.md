# ADR-019: Exact ACG2 Champion Composition Format

## Status

Accepted for implementation after the output-free preregistration is committed
and proven equal to the actual remote branch. No ACG2 output exists at the time
of this decision.

## Decision Date

2026-08-24

## Scope

This ADR defines the first and sole production-bound composition graph for
TinyRustLM's one prelaunch product. It binds the complete artifact set needed
for deterministic browser-local chat.

The decision covers graph bytes, member identities, resolution, validation,
and transactional activation. It does not define an adapter format, specialist
router, model quality gate, P2P protocol, or release receipt.

## Decision

The composition format identity is `org.minimodel.acg2/2.0`. The initial graph
profile is `tinyrustlm.champion-composition-five-member/1`.

The graph contains exactly five members in this order:

1. mixed-Q8 SLM2 model;
2. Tokenizer2;
3. Template2;
4. Sampling2;
5. Prompt2.

Each member record binds its closed role, closed format, ordinal, exact byte
length, plain artifact SHA-256, and exact format-profile SHA-256. The graph
contains no member bytes, paths, URLs, display names, catalog aliases, source
labels, credentials, or mutable store keys.

The artifact is exactly 896 bytes: one 256-byte header followed by five
128-byte records. There is no record padding or trailing data.

The header uses magic `ACG2\r\n\x1a\n`, a padded `minimodel.acg2` identifier,
version 2.0, little-endian byte order, champion-chat class, and zero flags. It
binds exact file/table dimensions, checked resolved-member byte sum, member
table SHA-256, and domain-separated graph identity. Reserved bytes are zero.

The member table hash is plain SHA-256 over all 640 record bytes.

The graph identity is SHA-256 over ASCII domain
`tinyrustlm.acg2.champion-graph.v1`, a zero byte, version fields, artifact
class, member count, resolved-member byte sum, and the complete member table.

The whole composition identity is plain SHA-256 over all 896 bytes. Any member
or header identity change therefore creates another graph or is rejected.

Role and format are redundant on purpose. A model role encoded as Tokenizer2,
an incorrect profile hash, a correct hash in the wrong ordinal, or a duplicated
record fails closed.

The member limits are inherited exactly from their current profiles. Their
checked maximum total is 68,787,700,488 bytes. Graph parsing itself is fixed and
does not allocate in proportion to untrusted member counts.

Resolution opens at most one member at a time and hashes through a fixed 1 MiB
buffer. It requires exact observed length and SHA-256 before invoking the
member's canonical parser.

Prompt2's embedded dependency identities must match the selected Tokenizer2,
Template2, Sampling2, and model contract. Passing five individually valid but
inconsistent artifacts is a composition failure.

Runtime activation validates and parses all members, checks cross-dependencies,
and accepts the complete resource plan before state mutation. The candidate is
then installed as one immutable graph.

Failure leaves the active composition, KV cache, generation state, operation
identity, and visible transcript unchanged. Success clears old KV and
generation state before the next token.

The first profile contains no adapters, overlays, extension records, optional
members, router policy, or arbitrary metadata. Future specialist support
requires a separate exact decision and evidence. The current parser does not
reserve dormant compatibility behavior for it.

There is no ACG1 reader, writer, migration, alias, negotiation, or fallback.
ACG2 is a technical byte identity, not a V2 product.

## Alternatives

- Embedding all member bytes was rejected because it duplicates large model
  storage and blocks piece-level P2P reuse.
- JSON was rejected because a flexible text grammar adds duplicate-key,
  normalization, number, and unknown-field surface without product value.
- A path or URL manifest was rejected because mutable locations are not
  artifact identities and may expose private machine information.
- Optional records were rejected because the first product graph is known and
  a generic extension surface would become speculative debt.
- A single aggregate hash without member records was rejected because it
  prevents bounded independent acquisition and precise failure evidence.
- Inferring roles from artifact magic was rejected because reordered but valid
  components must fail explicitly.
- Carrying old composition bytes through a wrapper was rejected because it
  would create migration and dual-parser obligations before launch.
- Adding low-rank adapters now was rejected because no exact LoRA2 artifact and
  portable runtime profile has passed independent qualification.

## Authoritative Evidence

- **Observed local fact**: SLM2, Tokenizer2, Template2, Sampling2, and Prompt2
  each have exact technical identities and local conformance evidence.
- **Observed local fact**: no current production ACG2 parser, writer, or atomic
  activation owner exists.
- **Observed local fact**: obsolete executable composition paths remain a
  registered release blocker and must be deleted in the clean cut.
- **Engineering decision**: a fixed identity-only graph is the smallest
  complete composition contract for the first champion.
- **Engineering decision**: all member bytes are independently verified and
  parsed before one transactional activation.
- **Local verification required**: independent Node and Rust implementations
  must reproduce bytes, identities, and rejection codes.
- **Local verification required**: the production runtime and browser worker
  must prove failure atomicity and successful cache invalidation.

## Threat Analysis

Threats include member substitution, profile substitution, role confusion,
record reordering, duplicate roles, length overflow, all-zero hashes, graph
hash drift, member-table drift, trailing bytes, nonzero reserved fields,
mutable aliases, path traversal, URL credential exposure, partial activation,
stale operation completion, cache reuse, and inconsistent Prompt2 dependencies.

Fixed counts and sizes are checked before allocation. Every arithmetic step is
checked. Every enum is closed. Every reserved byte is zero. Every role-specific
maximum is enforced before member acquisition.

Member bytes are streamed and hashed before parsing. Parsing does not trust a
filename or MIME type. A verified SHA never implies license, quality, or
publication authority; those remain separate gates.

Candidate state is isolated from active state. Cancellation and every typed
failure discard the candidate without a partial swap. Operation and graph
identities reject stale worker messages.

## Performance Evidence

No runtime performance claim follows from this output-free decision.

The graph itself has a fixed 896-byte parsing cost. Member hashing uses one
fixed 1 MiB buffer and one open member stream. These are design limits, not
measured real-model results.

Promotion must record cold resolution time, hashing throughput, parse time,
peak resident bytes, model mapping behavior, activation scratch, KV reset cost,
repeated switching, cancellation latency, and browser worker recovery using a
provenance-bound real model.

The implementation must not create an unreported second model copy or F32
weight shadow. Physical and browser memory measurements remain required.

## Compatibility Impact

There is no released composition contract to preserve. The prelaunch product
accepts only the exact ACG2 champion profile.

Unknown versions, artifact classes, member counts, roles, formats, flags,
profile hashes, padding, or trailing bytes fail closed. No negotiation or
nearest-profile selection occurs.

A future material change uses a newly preregistered identity and replaces the
unpublished current path cleanly. It does not add a compatibility branch.

## Clean Deletion Impact

The completed production cut deletes ACG1 executable tooling, tests, fixtures,
manifests, browser logic, runtime branches, package surfaces, and current
documentation that treats it as usable.

Historical content-addressed receipts may retain original ACG1 facts as inert
evidence. They are never runtime input or support authority.

No unused adapter fields, extension records, old-format aliases, or temporary
dual activation APIs remain after the cutover.

## Unknowns

- Exact real-model member hashes for the first qualifying composition.
- Production hashing and activation timings for a large browser-local model.
- Whether browser file APIs permit a single-copy mapped model view on all
  supported targets.
- The eventual separately trained low-rank artifact profile, if any.
- Which specialist routing evidence could justify expanding the closed graph.
- Physical memory behavior during repeated graph replacement under pressure.

## Acceptance Tests

1. A Node-builtins-only oracle and Rust emit identical canonical bytes.
2. The independent implementations derive identical table, graph, and whole
   artifact SHA-256 values.
3. Every proper prefix and every trailing-byte artifact is rejected.
4. Every header field and reserved range has a hostile mutation test.
5. Every member field, role, format, ordinal, length, and profile mismatch has
   an exact rejection test.
6. Missing, additional, duplicate, and reordered members fail.
7. Large sparse member hashing stays within the fixed buffer and open-file
   limits without a second model allocation.
8. Resolved byte drift and hash drift fail before member parser invocation.
9. Prompt2 dependency drift fails after member parsing and before activation.
10. Every failure preserves active graph, KV, generation, and transcript state.
11. Success swaps once and clears incompatible KV and generation state.
12. Repeated switching is bounded and produces no duplicate assistant output.
13. Native and real-browser WASM paths consume the same graph and members.
14. Source scans reject ACG1, migration, alias, fallback, paths, URLs, hidden
    retries, and speculative extension parsing in current executable code.

## Rollback

Before promotion, rollback removes the unpromoted ACG2 implementation while
preserving immutable failure evidence. It does not reactivate or retain an old
composition parser.

After promotion, a defective build is removed from release metadata and the
last independently qualified build of this same exact profile is restored.
A byte-contract change requires new preregistration, complete dependent
invalidation, clean replacement, and deletion before publication.
