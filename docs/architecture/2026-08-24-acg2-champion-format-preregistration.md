# ACG2 Champion Composition Format Preregistration

## Status

This is an output-free preregistration for the sole TinyRustLM prelaunch
composition format. It freezes the byte layout, identity framing, member set,
activation rules, hostile cases, implementation owners, and claim boundary
before an ACG2 profile, vector, artifact, parser, writer, or runtime output is
created.

Registration is bound to parent commit
`21a291d360213c6214eec7c146b3b2f249339a09` and tree
`d498e6a25cc1a3f1b8b85bd9dda58782e65bf5df`.

TinyRustLM has one prelaunch product. `ACG2`, `SLM2`, `Tokenizer2`,
`Template2`, `Sampling2`, and `Prompt2` are exact technical byte identities,
not product generations and not compatibility authorities.

## Why This Boundary Exists

A browser conversation is not defined by model weights alone. It also depends
on the exact tokenizer, chat renderer, sampling controller, and prompt
composition contract. Passing those components separately is insufficient if
the product may accidentally combine bytes from different revisions.

The composition artifact therefore binds the complete executable chat graph
without embedding model bytes or mutable locations. The companion and browser
may acquire members from a local store or verified direct peer, but activation
uses only exact byte lengths and SHA-256 identities.

The current ACG1-era implementation is not a migration source and grants no
format authority. It remains a release blocker until every consumer moves to
ACG2 and its executable source is deleted in the registered clean cut.

## Closed Champion Graph

The first profile contains exactly five ordered members:

1. one mixed-Q8 SLM2 model;
2. one Tokenizer2 artifact;
3. one Template2 artifact;
4. one Sampling2 artifact;
5. one Prompt2 artifact.

There are no optional members, adapters, overlays, router policies, external
paths, URLs, mutable aliases, embedded artifacts, extension records, or unknown
fields. A standalone specialist is represented by another independently
qualified five-member champion-shaped composition. Low-rank specialists need
a later independently preregistered profile; they are not smuggled into this
one as ignored or optional data.

## Exact Binary Layout

The artifact is exactly 896 bytes:

- one 256-byte header;
- five 128-byte member records;
- no padding between records;
- no trailing bytes.

The header starts with magic bytes `ACG2\r\n\x1a\n` and the padded 16-byte
format identifier `minimodel.acg2`. It declares version 2.0, little-endian byte
order, champion-chat artifact class, zero flags, exact header and record sizes,
exact file and table extents, the checked sum of resolved member bytes, a graph
identity SHA-256, and a member-table SHA-256. Every reserved byte is zero.

Each record stores only:

- record version;
- closed role and format enums;
- zero flags;
- exact zero-based ordinal;
- positive role-bounded artifact byte length;
- plain artifact SHA-256;
- exact format-profile SHA-256;
- zero reserved bytes.

The model may be at most 68,719,476,736 bytes. Tokenizer2 is bounded to
67,108,864 bytes, Template2 to 1,048,576 bytes, Sampling2 to 65,800 bytes, and
Prompt2 to 512 bytes. The maximum checked resolved total is 68,787,700,488
bytes. The graph itself remains fixed at 896 bytes.

## Identity Model

The member table identity is plain SHA-256 over the exact 640 record bytes.

The graph identity is SHA-256 over:

1. ASCII domain `tinyrustlm.acg2.champion-graph.v1` and one zero byte;
2. major and minor versions as little-endian u16 values;
3. artifact class as u8;
4. member count as little-endian u32;
5. checked resolved-member byte sum as little-endian u64;
6. all member-table bytes in order.

The whole artifact identity is plain SHA-256 over all 896 bytes. Changing a
member role, order, format, length, artifact hash, profile hash, or any header
identity changes the graph identity or makes the artifact invalid.

No filename, display name, catalog alias, filesystem path, URL, source label,
or mutable store key participates in resolution.

## Exact Profile Bindings

The five records bind these current profile hashes:

- SLM2: `5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8`;
- Tokenizer2: `628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de`;
- Template2: `14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa`;
- Sampling2: `ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d`;
- Prompt2: `b317ae0207522399e63125c57daf91d97432f95b26bd8fb71db746934ff05c8c`.

A profile hash is not inferred from an artifact filename. Runtime code admits
only the compiled current profile and parses every resolved member with its
canonical owner.

## Resolution And Activation

The parser first validates the complete 896-byte graph without reading member
files. Resolution then streams one member at a time through a fixed 1 MiB hash
buffer, requiring exact length and SHA-256 before format parsing. At most one
input file is open concurrently and one candidate activation is pending.

After all five member bytes are independently validated and parsed, Prompt2's
bound dependencies must match the selected tokenizer, template, sampler, and
model contract. The canonical runtime computes a complete resource plan before
allocating active session state.

Candidate validation never mutates the active graph. A wrong member, missing
member, malformed artifact, dependency mismatch, budget failure, stale
operation identity, cancellation, or allocation failure leaves the active
composition, KV cache, generation state, and visible transcript unchanged.

A successful activation is one transactional swap. It installs the complete immutable
composition and clears all prior KV and generation state before another token
can run. No member may become visible early.

## Independent Oracle

`tinyrustlm/tools/acg2-reference.js` will be a Node-builtins-only writer,
parser, identity oracle, and hostile mutation generator. It may not invoke
Rust, Cargo, a subprocess, or the network and may not consume generated Rust
output.

Rust must independently reproduce every byte and verdict. The checked-in
language-neutral vectors will bind canonical bytes, all header and record
fields, identities, proper-prefix rejection, and one mutation for every
security-relevant field class.

## Clean Product Rules

The implementation may contain no ACG1 reader or writer, format negotiation,
alias, migration, optional-member fallback, path/URL locator, embedded secret,
mutable member identity, partial activation, in-place adapter mutation, hidden
retry, output selection, or fixture-based quality claim.

The graph profile is base-only by design. Adding adapters later requires a new
exact format decision and a clean replacement if it becomes production. It
does not justify dormant extension bytes or speculative parser branches now.

## Required Tests

The implementation gate requires:

- independent Node/Rust byte equality;
- every proper prefix rejected;
- every header and member field mutation rejected with an exact code;
- missing, extra, reordered, duplicate, role/format/profile drift rejected;
- member length/hash, table hash, graph hash, and trailing-byte drift rejected;
- bounded streaming of a sparse large member fixture without a second copy;
- Prompt2 cross-dependency mismatch rejected;
- failure preserving all active state;
- success invalidating KV and generation state;
- repeated switching with bounded memory;
- native and browser-WASM conformance;
- source isolation and forbidden-contract scans.

## Output Boundary

This registration creates no ACG2 machine profile, vectors, composition bytes,
Rust crate, runtime output, browser output, model bytes, package, or campaign
evidence. The expected output paths must remain absent until this registration
is committed, pushed, fetched, and proven equal to the actual remote branch.

No model, conversion, assistant quality, browser chat, package publication,
site deployment, P2P availability, MemoryEndpoints operation, or campaign
counter follows from accepting this design.

## Next Action

Commit and remote-verify the preregistration. Then generate the independent
profile and vectors, implement `tinyrustlm-composition2`, integrate atomic
activation into the sole runtime, and continue the complete all-consumer cut.
Delete ACG1 executable tooling and assumptions before committing the completed
production replacement; do not add a compatibility bridge.
