# vNext Rust Campaign-Plan Parity

## Status And Non-Claims

This checkpoint independently implements the exact vNext campaign-plan
finalization boundary in Rust. It proves deterministic parity with the frozen
Node plan bytes and makes the same code compilable for native and browser WASM
targets. A later checkpoint now invokes the same crate through one generated
real-browser WASM boundary; see
`docs/architecture/vnext-campaign-plan-wasm-boundary.md`. Neither checkpoint
implements the evidence currentness classifier, signature authority graph,
Rust campaign projection, production campaign-runner integration, release
authorization, or any live campaign operation.

No fixture in this checkpoint is production evidence. All campaign counters
remain 0/20 qualified models, 0/50 clean-browser rounds, 0/25 live memory
rounds, 0/40 outside-proven lanes, and 0/20 announcements.

## Ownership Boundary

The implementation lives in `rust/crates/tinyrustlm-evidence`. Campaign
evidence is deliberately separate from runtime model-byte identity and from
the superseded JavaScript evidence store. The crate owns these operations:

1. parse one bounded JSON draft into closed typed structures;
2. validate every exact plan invariant;
3. serialize the canonical draft bytes for this schema;
4. derive the domain-separated plan ID;
5. serialize the exact final plan bytes;
6. derive the final raw-byte SHA-256; and
7. validate a final wire by independently rebuilding and comparing it.

The public API accepts caller-supplied bytes. It performs no filesystem
discovery, process launch, network request, environment lookup, clock lookup,
or evidence mutation. Returned bytes are owned and may be copied without
aliasing the verifier's internal state.

## Frozen Cross-Language Vectors

`tinyrustlm/tools/vnext-campaign-plan-vector-generator.js` deterministically
creates the draft, invokes the current Node finalizer, validates the result,
and writes two repository vectors:

| Vector | Bytes | SHA-256 |
| --- | ---: | --- |
| `campaign-plan-draft-parity-fixture.v1.json` | 22,929 | `95898b68686b2dcc9dc8700c58a5bff37114ef719e3c281c45303d011d11a23e` |
| `campaign-plan-parity-fixture.v1.json` | 23,012 | `89c487682ff69f7982d7cb24eda9fcff10702164c8ccb3608e748cf145339b19` |

The final plan ID is
`sha256:0207e508652790aa158bdb0c13c10c2aefe401e9cfc48b98bc9dc05dcdb63a7e`.
Regeneration is a verification operation: changing either checked-in vector
requires an intentional contract review, not routine fixture churn.

## Exact Validation Contract

The Rust implementation freezes the following profile values and verifies
them against `campaign-projection-profile.v1.json`:

- schema `tinyrustlm.vnext.campaign_plan.v1`;
- profile `tinyrustlm.vnext.campaign-projection.v1`;
- identity domain `tinyrustlm.campaign-plan.identity.v1`;
- maximum wire size 1,048,576 bytes; and
- exact targets 20/50/25/40/20.

Typed `serde` structures use `deny_unknown_fields`. Duplicate object members,
unknown members, missing members, incorrect JSON types, empty input, and
oversized input fail closed. Value validation additionally requires:

- one canonical HTTPS origin with no credentials, path, query, or fragment;
- one exact UTC timestamp grammar representing a real calendar instant;
- lowercase bounded safe identifiers and lowercase SHA-256 values;
- 20 sorted model slots with distinct artifact bytes and qualification
  operations;
- 50 sorted browser rounds, exactly 25 memory-designated rounds, globally
  distinct round, operation, and restart IDs, and two independent restarts per
  model;
- 25 sorted memory rounds in a one-to-one binding with the designated browser
  rounds, including distinct redacted company hashes;
- 40 sorted lane identities, exactly two per model, with globally distinct
  process identities;
- 20 sorted announcements, exactly one per model; and
- global uniqueness across every objective operation ID.

The crate uses the pinned `url = 2.5.8` parser for origin semantics. It does
not hand-roll URL parsing. Dependencies are captured by `Cargo.lock`, and the
crate forbids unsafe Rust.

## Canonicalization Scope

Node generates the reference bytes with the repository's bounded vNext JCS
implementation. Rust writes the exact known member order for this one closed
schema and delegates JSON string escaping to `serde_json`. Every admitted plan
value is either a boolean or an ASCII-constrained string; there are no numeric
or arbitrary Unicode values in this wire.

This narrow serializer avoids claiming unsupported generic JCS behavior. A
future schema that introduces numbers, unconstrained Unicode, optional
members, or additional types must receive a new version and new parity vectors
before Rust may accept it.

## Hostile And Parity Tests

`campaign_plan_contract.rs` proves:

- byte-for-byte Node/Rust draft finalization parity;
- exact plan ID and final SHA-256 parity;
- defensive owned-byte output;
- constants matching the frozen profile;
- rejection of invalid profiles, origins, timestamps, unknown fields, and
  duplicate fields;
- rejection of cardinality, artifact, global-operation, restart, memory,
  process, and announcement drift; and
- rejection of a changed plan ID, pretty-printed wire, and trailing bytes.

The Node parity tests independently regenerate both vectors, compare them to
the repository bytes, validate the final wire, and reject transport
decoration. The affected Rust gate is:

```text
cargo fmt --all -- --check
cargo test -p tinyrustlm-evidence
cargo clippy -p tinyrustlm-evidence --all-targets -- -D warnings
cargo check -p tinyrustlm-evidence --target wasm32-unknown-unknown
```

Workspace and complete Node gates remain required before this checkpoint is
eligible for check-in.

## Historical Build-Evidence Regression

Adding the crate changed the current workspace `Cargo.lock` and exposed a
separate verifier defect: retained affine-vector build evidence was compared
with the mutable checkout lockfile instead of the `Cargo.lock` input captured
by that evidence at its recorded source revision. The correction makes the
expected lock identity an explicit validator argument. Current observations
take it from their validated current input closure; archived attempts take it
from their validated archived input closure.

The historical attempt and its result bytes were not edited or retried. A new
counterexample changes only the retained build-side lock identity and proves
that the cross-field mismatch rejects. This is immutable evidence validation,
not a compatibility reader: there is one current validator rule, and every
build receipt must bind to the lockfile in its own authenticated input set.

## Current Integration Boundary

Node now has create-only durable persistence for canonical plan and projection
bytes, interruption-safe staging, bounded reconstruction, parent-plan
revalidation, and resume by authoritative reprojection. The persisted
projection remains immutable history rather than self-authenticating current
truth. See `docs/architecture/vnext-campaign-artifact-persistence.md`.

`tinyrustlm-evidence-wasm` now exposes this verifier through one generated,
bounded, zero-import browser ABI. Node and two independent real Chromium
profiles reproduce the exact frozen final bytes and stable failures without a
handwritten JavaScript plan implementation. Full Rust currentness, authority,
and projection parity remain separate required work before Rust or browser
code can make a campaign-completion claim.
