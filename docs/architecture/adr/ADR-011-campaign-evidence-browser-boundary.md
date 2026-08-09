# ADR-011: Campaign Evidence Browser Boundary

## Status

Accepted and implemented at the current source checkpoint. The generated
replacement passes the bounded Rust, Node, and two-profile Chromium
conformance gate, and the superseded plan-only profile is deleted. This status
does not grant production-runner, release, deployment, or live-campaign
authority.

## Decision Date

2026-08-09

## Scope

This ADR defines the sole browser and Node WebAssembly boundary for campaign
plan finalization, semantic-currentness classification, truthful campaign
projection, and projection-result validation. It does not define receipt or
subject persistence, trusted production time, key custody, campaign
orchestration, release authorization, public deployment, or any live campaign
operation.

## Decision

Replace the unpublished plan-only interface with one generated,
`wasm32-unknown-unknown`, zero-import campaign-evidence ABI. The new profile
retains plan finalization and validation as current operations and adds:

- staged phase-receipt classification;
- staged campaign projection over an exact plan, canonical receipts, canonical
  identity-bearing subjects, caller pins, and caller-supplied verification
  time; and
- independent validation of one projection-result wire against one exact
  campaign plan.

All plan, currentness, identity, Ed25519, authority-graph, objective-counting,
and result-validation semantics remain in `tinyrustlm-evidence`. Generated
JavaScript validates the module shape, copies bounded bytes, sequences the
frozen staging protocol, copies the result, and releases allocations. It does
not parse receipts or subjects, select evidence, evaluate currentness, inspect
authority, count objectives, repair output, retry a failed verdict, or provide
a fallback implementation.

The staging protocol is instance-local and single-operation. Every begin
replaces and clears prior stage, result, and error state. Every protocol or
resource failure destroys the stage. Execute consumes the stage whether it
succeeds or fails. Explicit reset clears stage, result, and error state without
stealing caller-owned transfer allocations. Receipt and subject counts are
declared at begin and must match exactly at execute. Per-member and aggregate
limits are enforced before an append commits.

Projection metadata is one exact canonical UTF-8 JSON transport record with a
closed six-field shape. It carries only caller pins already required by
`CampaignProjectionInput`; it is not an evidence receipt and has no identity of
its own. Projection independently revalidates exact plan, receipt, subject,
currentness, and authority inputs. An offline-bundle verdict is deliberately
not accepted as projection input because closed membership and objective
projection are separate decisions.

## Alternatives

- Extending the old plan-only profile in place was rejected because a material
  ABI change requires a new identity and leaves ambiguous stale modules.
- Keeping plan and evidence modules side by side was rejected because it
  creates two browser ABIs and a permanent selection problem.
- A single Base64 JSON envelope containing every receipt and subject was
  rejected because it adds avoidable encoding, parsing, and peak-memory cost.
- Handwritten JavaScript currentness, authority, or projection logic was
  rejected because it creates a second semantic implementation outside Rust.
- Host imports for network, filesystem, clock, random, environment, or logging
  were rejected because all material inputs must be explicit and replayable.
- Returning borrowed Rust pointers was rejected because caller-visible result
  lifetime and memory growth would become ambiguous.

## Authoritative Evidence

- **Observed local fact**: strict Rust APIs independently implement exact plan,
  semantic-currentness, Ed25519, authority-graph, offline-bundle, projection,
  and projection-result validation behavior with frozen public corpora.
- **Observed local fact**: the generated replacement module has zero imports,
  the exact frozen exports, exact allocation identity, destructive staged
  state, stable errors, and real Chromium parity.
- **Engineering decision**: reuse those verified Rust semantics through one
  clean generated transport rather than create browser-side decisions.
- **Observed local fact**: the replacement module shape, finite resources,
  state destruction, exact corpus parity, and physical profile deletion passed
  before the old interface was removed.
- **Local verification required**: production-runner integration, maximum-size
  authorized evidence measurements, worker cancellation, and release binding
  remain unproved and must pass their own gates.
- **Externally blocked**: no local browser conformance test proves production
  key custody, independent observers, public announcements, or a live campaign.

## Threat Analysis

Threats include stale staged evidence, cross-operation contamination,
pointer-length substitution, arbitrary pointer dereference, allocation
exhaustion, count or aggregate overflow, receipt/subject type confusion,
metadata field drift, noncanonical inputs, caller mutation, shared memory,
module substitution, import or export expansion, raw host errors, result reuse,
and JavaScript semantic drift.

The boundary tracks exact pointer-length allocations, limits live allocations
and their total bytes, copies before semantic use, rejects unknown module
surfaces, exposes no borrowed pointer, uses only stable public-safe errors, and
destroys staged state on every begin, failure, execute, and reset. Rust repeats
all semantic validation; JavaScript preflight is never authority. Each
WebAssembly instance owns independent state. No raw receipt, subject, prompt,
credential, private key, or hosted-memory payload enters logs or diagnostics.

## Performance Evidence

The interface streams one receipt or subject per append and retains only the
bounded Rust evidence closure required by currentness and authority
verification. It does not materialize a second Base64 envelope. Transfer
allocations are capped separately from aggregate staged evidence and are
released after every call.

Promotion still requires measurement of module bytes, compilation latency,
projection latency, peak WASM memory, memory growth, and cleanup for honest
zero, partial evidence, and complete 20/50/25/40/20 synthetic capacity. Local
measurements describe only the measured machine and browser build.

## Compatibility Impact

`tinyrustlm.vnext.campaign-evidence-wasm.v1` is the only accepted browser
evidence profile. The old campaign-plan WASM profile, global, generator,
adapter, test, and documentation are deleted after replacement verification.
There is no alias, old global, dual module, compatibility reader, migration
adapter, or runtime fallback.

## Clean Deletion Impact

Delete `campaign-plan-wasm-interface.v1.json`, the plan-only code generator and
generated adapter, its test, and its boundary documentation in the same
verified change. Update every source, package script, architecture surface,
contract inventory, and handoff to the replacement identity. Immutable Git
history remains evidence and is not shipped compatibility support.

## Unknowns

- Peak WASM memory for a full maximum-size authorized evidence closure.
- Physical Firefox and WebKit support if those browsers are later promoted.
- Whether production runner throughput requires chunk scheduling between
  appends without changing the ABI.
- Final worker ownership and cancellation policy when the campaign runner is
  connected.

## Acceptance Tests

1. The profile and generator reproduce exact checked-in Rust and JavaScript
   outputs and reject accessors, symbols, cycles, unknown fields, and drift.
2. The release WASM has zero imports and exactly the frozen exports.
3. Unowned, mismatched, oversized, excessive, or over-aggregate buffers reject
   without a trap and destroy staged state.
4. Begin replacement, append failure, count mismatch, execute success, execute
   failure, and reset cannot leak evidence into a later operation.
5. Plan finalize and validate remain byte-identical to the frozen plan corpus.
6. Phase classification and campaign projection match exact frozen Rust/Node
   results and stable rejection codes.
7. Projection-result validation rejects noncanonical, inconsistent, or
   wrong-plan bytes without repair.
8. Returned values are defensive owned copies; caller mutation cannot alter a
   later result.
9. Two fresh persistent Chromium profiles execute plan, currentness, honest
   zero, and one nonzero accepted projection with zero requests or errors, then
   close and are physically deleted with distinct deletion identities.
10. The superseded plan-only contract and all current references are absent
    before commit.

The focused acceptance suite passes all ten requirements. The locally built
release module is 1,450,024 bytes with SHA-256
`8f5bc4c025c6403865d5f3e93c50a824b44d110c9e4c3004cf03de6f755472ef`.
That module observation is not a reproducible-build or publication receipt.

## Rollback

Before publication, rollback reverts the complete source commit and generated
artifacts together. It does not restore the superseded profile as a supported
runtime path. After publication, rollback selects a previously signed complete
site release whose one current evidence ABI and assets remain mutually bound;
it never mixes adapters and modules from different releases.
