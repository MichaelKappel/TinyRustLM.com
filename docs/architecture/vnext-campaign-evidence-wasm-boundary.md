# vNext Campaign-Evidence Browser WASM Boundary

## Status And Authority

The sole current campaign-evidence browser ABI is implemented, generated, and
cross-runtime test-bound. It retains exact campaign-plan finalization and
validation and exposes Rust semantic-currentness classification, truthful
campaign projection, and projection-result validation to Node and browser
callers.

The generated JavaScript is byte transport and stage sequencing only. All
campaign-plan, receipt, subject, currentness, Ed25519, authority-graph,
objective-counting, blocker, and result-validation semantics remain in
`rust/crates/tinyrustlm-evidence`. The browser adapter cannot produce a pass by
parsing or repairing evidence itself.

The sole exact campaign runner and release-manifest preparation surface now
consume this ABI; the ABI itself does not own filesystem orchestration or
publication policy. Neither integration is release authorization, site
deployment, model qualification, a live browser round, an authorized
MemoryEndpoints operation, outside-network proof, or catalog announcement.
Campaign counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.

This source checkpoint changes no production deployment-manifest member.
Publishing unchanged site bytes would fabricate a release, so it requires a
commit and push but no site version, Updates entry, deployment receipt, or
public readback claim.

## Clean Contract

`contracts/vnext/campaign-evidence-wasm-interface.v1.json` is 6,043 bytes with
SHA-256
`ef29b69eb2ca4eecf914e6f312e28c8af603e375e19e4db5f658d5217f88ef28`.
It freezes:

- schema `tinyrustlm.vnext.campaign_evidence_wasm_interface.v1`;
- profile `tinyrustlm.vnext.campaign-evidence-wasm.v1`;
- ABI version 1 and target `wasm32-unknown-unknown`;
- exact plan, phase-currentness, campaign-projection, and projection-result
  profile identities;
- the closed six-field canonical projection-metadata transport record;
- zero imports and one exact export descriptor sequence;
- finite transfer, result, module, allocation, plan, metadata, receipt,
  subject, count, and aggregate limits;
- exact status, ownership, staging, and result-lifetime rules; and
- no network, filesystem, clock, environment, random, repair, best-of-N,
  raw-host-error, JavaScript-semantic, or offline-verdict shortcut capability.

ADR-011 records the material replacement decision. The unpublished plan-only
profile, generator, adapter, test, browser global, package scripts, and
documentation are deleted. There is no alias, second module, old global, dual
reader, fallback, or compatibility adapter.

## Generated Surfaces

One generator owns both sides of the raw transport:

- `tinyrustlm/tools/vnext-campaign-evidence-wasm-codegen.js`;
- `rust/crates/tinyrustlm-evidence-wasm/src/generated_exports.rs`; and
- `tinyrustlm/tools/generated/vnext-campaign-evidence-wasm.js`.

The profile parser uses bounded strict JSON, requires ordinary acyclic data
properties, rejects symbols and unknown fields, freezes the full result, and
requires every constant and descriptor exactly. Tests regenerate both outputs
in memory and compare bytes. Generated files are not edited by hand.

The browser installs only `TinyRustLMCampaignEvidence` outside CommonJS. It
exports the profile identity, ABI version, frozen limits, two stable error
classes, the verifier class, and `instantiateCampaignEvidence`. No retired
global is installed.

## Typed Raw ABI

The module exports one memory, seventeen functions, and the two standard Rust
linker globals. Material operations are:

| Operation | Inputs | Result |
| --- | --- | --- |
| Finalize plan | one exact draft wire | canonical final plan |
| Validate plan | one exact final wire | same canonical plan |
| Begin currentness | campaign ID bytes and receipt count | active empty receipt stage |
| Begin projection | canonical metadata, exact plan, receipt and subject counts | active empty projection stage |
| Append receipt | one exact receipt wire | committed owned stage copy |
| Append subject | one exact identity-subject wire | committed owned projection-stage copy |
| Execute | active complete stage | canonical currentness or projection result |
| Validate projection result | result wire and exact plan | same canonical result |
| Reset | none | cleared stage, result, and error state |

Allocation, release, result length/copy, error length/copy, ABI version, and
maximum transfer size complete the transport surface. Status 0 is success, 1
is a resource, ownership, or staging boundary failure, 2 is a strict Rust
verification rejection, and 3 is a bounded internal-state failure.

## Resource Bounds

One transfer allocation is at most 4 MiB. At most four transfer allocations
and 8 MiB aggregate transfer bytes may be live. The plan is at most 1 MiB,
projection metadata 64 KiB, one receipt 256 KiB, one subject 2 MiB, and one
result 4 MiB. A stage accepts at most 2,048 receipts and 2,048 subjects, with
64 MiB aggregate for each collection.

Transfer allocations and staged evidence are separate owners. The adapter
holds only the buffers needed for the current call and releases each in a
finally-equivalent cleanup path. Rust copies one receipt or subject into the
stage before the transfer allocation is released. The adapter does not create
one Base64 or JSON envelope containing the full evidence closure.

The release WASM built locally under the current Rust toolchain is 1,450,024
bytes with SHA-256
`8f5bc4c025c6403865d5f3e93c50a824b44d110c9e4c3004cf03de6f755472ef`.
That is a local bounded observation, not a reproducible-build receipt,
published web asset, release, or device-wide performance claim.

## Ownership And Destructive State

Rust tracks every live transfer by its exact pointer and length before copying
or releasing it. An arbitrary pointer is never dereferenced. Result and error
bytes remain Rust-owned and are copied into a second exact caller allocation;
no borrowed Rust pointer crosses the ABI.

Stage state is instance-local and has one operation kind. The state machine is:

1. begin clears any previous stage, result, and error;
2. each append checks operation kind, declared count, member bytes, aggregate
   bytes, and exact allocation identity before committing;
3. any begin, append, allocation, release, count, ownership, or resource
   failure destroys the stage;
4. execute takes and consumes the stage before invoking semantic code;
5. success stores one result and failure stores one stable error; and
6. reset clears stage, result, and error without stealing still-owned transfer
   allocations.

A failed or successful execution cannot be executed again. A count mismatch,
wrong-stage subject, invalid pointer, or new begin cannot reuse prior evidence.
Each WebAssembly instance has independent linear memory and Rust state.

## Projection Metadata

Projection begin accepts one canonical transport record with exactly:

- `expectedCampaignId`;
- `expectedCampaignPlanSha256`;
- `expectedEnvironment`;
- `expectedTerminalRegistryReceiptId`;
- `trustedRootRegistryReceiptId`; and
- `verificationTimeUtc`.

Rust rejects malformed, duplicate, unknown, reordered, or otherwise
noncanonical metadata. These fields are explicit caller pins, not trusted
verdicts. `project_campaign` still hashes and validates the plan, validates
every receipt and subject, recomputes semantic currentness, verifies the
authority graph, and counts exact planned objectives itself.

Offline-bundle verification remains a separate closed-membership operation.
The browser projection API does not accept an offline-bundle result or boolean
and cannot substitute one for raw evidence verification.

## JavaScript Boundary

The adapter accepts only one-byte non-shared typed-array views. It calls
captured typed-array and ArrayBuffer intrinsics before copying, rejects
multi-byte views and shared memory, snapshots dense data-property arrays, and
passes each exact copy to WASM. Caller mutation after return cannot change the
owned result or a later invocation.

Before instantiation it bounds and copies module bytes, compiles without host
imports, compares exact import and export descriptors, instantiates with an
empty import object, and verifies the ABI and transfer limit reported by the
module. Compile and instantiation diagnostics are reduced to stable boundary
codes rather than exposing raw host errors.

The adapter performs no JSON parsing of evidence, objective selection,
authority interpretation, currentness classification, retry, response repair,
best-of-N choice, network request, filesystem operation, time lookup, or
environment lookup.

## Cross-Runtime Conformance

`tinyrustlm/tests/vnext-campaign-evidence-wasm.test.js` proves:

- exact profile SHA-256 and generator output;
- absence of every superseded plan-only artifact;
- zero imports and the exact export descriptors;
- finite allocation count and bytes;
- unowned and mismatched pointer rejection without a WASM trap;
- destructive stage behavior after wrong type, count mismatch, failure,
  execute, and reset;
- exact plan finalization and validation;
- exact phase-currentness output from the frozen cross-language corpus;
- exact honest-zero and complete-capacity projection output;
- exact projection-result validation;
- stable semantic rejection for missing phase closure and result drift;
- defensive output ownership and unrelated-module rejection; and
- exact plan, currentness, honest-zero, and nonzero partial projection in two
  independently created real Chromium persistent profiles.

Both Chromium contexts close, both owned profiles are physically deleted with
distinct deletion identities, and both runs make zero requests and emit zero
console or page errors. These are verifier-conformance profiles, not campaign
browser rounds.

## Build And Verification

```text
node tinyrustlm/tools/vnext-campaign-evidence-wasm-codegen.js --write
cargo fmt --all -- --check
cargo test -p tinyrustlm-evidence-wasm --locked --offline
cargo clippy -p tinyrustlm-evidence-wasm --all-targets --locked --offline -- -D warnings
cargo build -p tinyrustlm-evidence-wasm --release --target wasm32-unknown-unknown --locked --offline
cd tinyrustlm
node --test tests/vnext-campaign-evidence-wasm.test.js tests/vnext-campaign-projection-rust-vectors.test.js tests/vnext-phase-invalidation-rust-vectors.test.js tests/vnext-campaign-plan-parity.test.js
```

Any profile change requires a new identity, regenerated outputs, hostile tests,
accepted ADR treatment, full affected gates, and clean deletion of the replaced
unpublished path. Generated and handwritten semantic implementations may not
coexist.

At the current checkpoint, the focused campaign-evidence and linked parity set
passes 14/14; the complete locked/offline Rust workspace passes with zero
failures; denied-warning all-target workspace Clippy and repository rustfmt
pass; the locked/offline release WASM build passes; and `npm run test:unit`
passes 816/816 with zero failures and zero skipped in 67.822 seconds. An earlier
complete run passed 815/816 and preserved a line-wrap-sensitive documentation
assertion failure; the assertion was corrected to test semantic whitespace,
the focused set was rerun, and only then did the complete rerun pass.

## Remaining Work

- The local runner in `docs/architecture/vnext-campaign-runner.md` now connects
  bounded receipt and subject stores to this ABI, persists exact immutable
  operation and projection history, and reprojects exact current inputs on
  every new operation or byte-identical interruption resume.
- The superseded mutable runner is deleted without aliases or compatibility
  behavior. Cut final-attestation, release, dashboard/operator, and public
  readback entry points over to fresh sole-runner results.
- Bind only the reprojected result into final attestation, release
  authorization, operator rendering, synchronized documentation, and public
  readback.
- Complete Rust/Win32 directory-flush evidence, archive-member scanning, and
  protected equality-list custody before production durability or release
  claims.
- Replace fixtures only with authorized raw objective receipts from real
  phases. No local conformance test increments a live campaign counter.
