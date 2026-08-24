# Prompt2 Mixed-Q8 Dependency Rebind Preregistration

## Decision Summary

Prompt2 must be replaced at its exact SLM2 dependency boundary before ACG2
can be implemented. The current Prompt2 artifact still binds the superseded
dense-F32 SLM2 profile and scalar-runtime vector. The sole current SLM2
contract is the mixed Q8-row plus F32 role profile, so the old Prompt2 bytes
cannot participate in a closed five-member composition graph.

This record freezes the correction before replacement profile, artifact,
vector, Rust, ACG2, model, or browser output. It does not create a second
product generation. TinyRustLM is prelaunch and has one current product path.
SLM2 and Prompt2 are exact technical identities, not product-version labels or
permission to preserve obsolete behavior.

The correction is intentionally narrow:

1. Bind Prompt2 to SLM2 format profile SHA-256
   `5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8`.
2. Bind Prompt2 to mixed-Q8 runtime vectors SHA-256
   `c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0`.
3. Rename the stale profile label from `scalarRuntimeVectorSha256` to
   `runtimeQ8VectorSha256` and the corresponding binary-field description,
   without moving or resizing the 32-byte digest at offset 464.
4. Regenerate the one Prompt2 artifact and vector authority, reproduce it in
   unsafe-free Rust, update exact identities, and delete the old executable
   Prompt2 identity from the current path.

No compatibility reader, alias, migration, fallback, dual composer, response
repair, runtime repacking, dense-F32 model path, or deferred cleanup is
allowed.

## Registration Authority

The machine registration is
`contracts/vnext/prompt2-q8-dependency-rebind-preregistration.v1.json`.
It is based on parent commit
`14ebe90cc74238783927420c49e893507b829d21` and parent tree
`529fc818431ae176359c7d383b008b847017b78f` on
`codex/model-acquisition-v2` in the sole authorized recovered workspace.

At registration time no replacement Prompt2 profile, artifact, vector, Rust
output, ACG2 artifact, ACG2 vector, converted model, inference output, browser
output, or publication output existed. The existing Prompt2 files remained at
their old exact identities. This commit is evidence registration only.

MemoryEndpoints is unauthorized. No operation against it is implied or
permitted. No write to drive D is permitted.

## Observed Defect

The dependency audit was performed before generating ACG2 output. It found
that all three active Prompt2 authorities still carry these superseded values:

- SLM2 profile SHA-256
  `387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625`;
- scalar-runtime vector SHA-256
  `c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1`.

Those values appear in the Prompt2 machine profile, independent Node
authority, generated canonical artifact, vector document, and Rust format
implementation. The binary artifact stores them at offsets 432 and 464.

The ACG2 preregistration correctly binds the current Q8 SLM2 profile but binds
the old Prompt2 profile hash. Its proposed runtime would therefore face an
unsatisfiable dependency graph: the model member would identify current Q8
SLM2 while the prompt member would require the prior F32 SLM2 authority.
Weakening either check would turn an exact graph into an alias mechanism and
would conceal the defect.

The defect was caught before output. There is no ACG2 artifact, vector,
parser, writer, runtime activation, model execution, or browser result to
repair or discard.

## Registered Input Identities

The superseded Prompt2 input snapshot is preserved as audit history:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| Prompt2 profile | 19,423 | `b317ae0207522399e63125c57daf91d97432f95b26bd8fb71db746934ff05c8c` |
| Prompt2 vectors | 347,026 | `9d3354785614ff60edc679b6fea6797164ffac368edaa9d3d50912b525048cc0` |
| Prompt2 canonical artifact | 512 | `d3a123f327e7c4c3eb53d642c4b8d98c39a0b30bac2cc1970922612ae502f142` |
| Prompt2 Node authority | 57,959 | `e993bde73b69422197e50b968869f19cfd9093cfc3aec4472205a67d47efdedd` |
| Prompt2 Rust format source | 16,647 | `c36f1fd4f737617a9717acda91ee97a16e967814c1fccbfcb0f5d94242b0737f` |
| Prompt2 standalone lock | 5,928 | `48dca83e7e45403cc012835e593db612003ed49c5fd9024473f1f52a9af21b29` |

The replacement authorities are already accepted mixed-Q8 contract evidence:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| SLM2 format profile | 21,924 | `5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8` |
| SLM2 Q8 weight profile | 9,900 | `7e931fd23fa8f6a90c53e4c14c5630eef8ce87e0f0902acd5a5e2df03c60733a` |
| SLM2 runtime-Q8 vectors | 50,801 | `c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0` |
| Canonical mixed-Q8 SLM2 artifact | 8,704 | `4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502` |

These are format and fixture identities. They do not prove a real converted
model, assistant quality, browser chat, P2P availability, release, or
deployment.

## Immutable Dependency Boundary

Tokenizer2, Template2, and Sampling2 bytes and accepted evidence are not
invalidated. Their exact hashes remain unchanged. The rebind must not rerun
the accepted Tokenizer2 native or browser observations, Template2 source or
native observations, or Sampling2 accepted evidence.

Prompt rendering, full rendered-text tokenization, independent span
recomposition, control insertion mapping, stop order, seed expansion,
Sampling2 controller construction, request and result wires, load-bundle
layout, resource ceilings, and failure behavior remain unchanged.

The Prompt2 profile ID remains `org.minimodel.prompt2/2.0` because it names
the sole technical binary format. Exact profile bytes and SHA-256 identify the
accepted dependency composition. The prior hash ceases to be executable; it
does not become a supported older profile.

## Exact Replacement Boundary

The 512-byte artifact layout remains fixed. Offset 432 binds the current SLM2
format-profile digest. Offset 464 binds the current runtime-Q8 vector digest.
No other field, offset, size, stop token, limit, flag, version, message rule,
or wire geometry changes.

The profile label at offset 464 is corrected because the old term falsely
describes a dense-F32 authority. This is a semantic label correction for the
same fixed 32-byte field, not a second binary format.

The independent Node implementation remains Node-builtins-only. It may not
invoke Rust, a subprocess, the network, or generated Rust output. It must
derive the new artifact and vector bytes independently. Rust must reproduce
the Node bytes and all stable hostile verdicts.

The generated vector document uses create-only output. The superseded
generated file is removed only after this registration is remote-exact, and
the generator creates one replacement. There is no in-place best-effort
rewrite and no second vector path.

## Invalidated ACG2 Registration

The ACG2 preregistration at commit
`39feda199eea782ff32f9ffb2b93f7c1a1b21d33`, 11,929 bytes with SHA-256
`afec4dccad2062728677b6987519ce2385a1bca3761fe8f0927ac80242d6403d`,
is terminally superseded before output. Its files remain immutable evidence
that the proposed graph was frozen and then rejected by dependency audit.
They are not implementation authority and may not be edited into a pass.

After the replacement Prompt2 implementation is committed, pushed,
fresh-fetched, and proven remote-exact, ACG2 requires a new output-free
technical registration identity. That registration must bind the new exact
Prompt2 profile hash. Only then may ACG2 artifact or vector output begin.
This technical registration succession is not a second product generation.

## Verification Order

1. Commit this registration, architecture record, and invariant test alone.
2. Push, fetch, and prove equality of local HEAD, tracking ref, FETCH_HEAD,
   and the actual remote branch.
3. Replace only the two SLM2 dependency digests and stale labels in Prompt2.
4. Create the replacement vectors once with the independent Node authority.
5. Reproduce the canonical artifact and vectors in unsafe-free Rust.
6. Prove old digests reject and all existing prefix, mutation, wire, and
   composition checks remain closed.
7. Preserve the standalone Cargo lock exactly and run formatting, tests, and
   Clippy with warnings denied.
8. Run strict JSON, ASCII, NUL, secret, diff, documentation, and affected
   contract gates.
9. Commit and prove the replacement Prompt2 identity remote-exact.
10. Register corrected ACG2 dependency closure before any ACG2 output.

## Clean-Slate Requirements

The implementation must end with one current Prompt2 profile, writer, parser,
vector authority, and Rust implementation. It must not retain a reader for the
superseded artifact, compare a version range, accept either digest, negotiate
profiles, translate old bytes, retry with old dependencies, or hide rejection
behind a fallback.

Historical commits and this registration preserve the prior identities as
audit truth. Current source and documentation must describe only the sole
accepted replacement after verification.

## Claim Boundary

This registration proves only that the defect and exact correction were
frozen before output. It does not prove that replacement Prompt2 exists, that
ACG2 exists, that a real source model converts, that inference works, that a
model is useful, that browser chat works, that P2P acquisition works, or that
any site or package is releasable.

Campaign counters remain exactly 0/20 qualified models, 0/50 deletion-backed
browser rounds, 0/25 authorized live memory rounds, 0/40 current external lane
proofs, and 0/20 live catalog announcements.

## Rollback

Before replacement output, rollback means removing this unpromoted
registration commit. After replacement output, a defect requires another
output-free incompatible identity and descendant invalidation. Rollback never
means restoring the old Prompt2 dependency as an executable fallback,
weakening ACG2 checks, rerunning immutable evidence, or converting local
format tests into a model or browser claim.
