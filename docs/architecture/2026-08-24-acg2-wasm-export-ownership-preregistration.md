# ACG2 WASM Export Ownership Preregistration

## Status

This is an output-free technical registration. It authorizes one narrow source
change after the registration is committed and remotely verified. It does not
accept implementation output, authorize a release, or change any campaign
counter.

The machine authority is
`contracts/vnext/acg2-wasm-export-ownership-preregistration.v1.json`.

## Defect

`tinyrustlm-composition2` owns an eleven-function raw WASM ABI used only to test
the ACG2 writer and parser. Its module is currently selected by
`target_arch = "wasm32"` alone. The production scalar runtime depends on
`tinyrustlm-composition2`, so a WASM build of the otherwise independent SLM2
runtime conformance crate also links and exports all eleven ACG2 test functions.

That produces twenty-two function exports where the SLM2 test contract requires
exactly eleven. Accepting the larger surface would silently turn two independent
test ABIs into one accidental ABI, increase the attack surface, and make future
dependency changes capable of broadening production modules without review.

## Prior Development Observation

Commit `db7cc1c03b09b89a5fff7f127f0bd437c0d33d17` contains an early feature-gate
implementation and local builds made before this registration. Those builds
are retained in Git history as a process failure and diagnostic observation.
They are not accepted as implementation, release, browser, or campaign
evidence. Commit `8c45d6855984e132f4e3404251a6194b514456cb` restores the exact registered
baseline before this profile is added.

## Registered Design

The owning crate will declare one feature named `wasm-conformance` with an empty
default feature set. Its `wasm` module will compile only when both conditions
are true:

1. the target architecture is `wasm32`; and
2. the owning build explicitly enables `wasm-conformance`.

The ACG2 vector test will enable that feature explicitly. The canonical runtime
dependency and the SLM2 runtime-conformance build will not enable it. There is
no runtime negotiation, export probing, compatibility alias, combined ABI, or
fallback.

Cargo feature unification is handled by building the two conformance roots in
separate Cargo invocations and separate target roots. The ACG2 invocation is
the only graph that enables the feature. The SLM2 invocation must demonstrate
that its transitive `tinyrustlm-composition2` dependency retains the empty
default set.

## Exact Surfaces

Each module must have no imports and exactly one exported memory named
`memory`. The ACG2 module must expose exactly the eleven
`trlm_acg2_conformance_*` functions registered in the machine profile. The
SLM2 module must expose exactly the eleven `trlm_slm2_conformance_*` functions
registered there. Any omitted, additional, renamed, or cross-owned function is
a failure.

The ACG2 module remains bounded to 2 MiB and the SLM2 module to 1 MiB. Both
retain locked offline release compilation, no executable unsafe Rust, Node
vector replay, fresh-Chromium replay, and zero browser network requests.

## Invalidation

The ACG2 binary module identity and its prior Node/Chromium replay are
invalidated because the crate feature surface changes. The SLM2 module identity
and prior replay are invalidated because the exported function closure changes.
Both must be rebuilt and replayed after implementation.

The ACG2 format profile, artifact bytes, writer/parser semantics, hostile
vectors, and graph identities do not change. Tokenizer2, Template2, Sampling2,
and Prompt2 accepted evidence is not rerun or reinterpreted. No real-model
evidence exists to invalidate.

## Implementation Closure

Only these files may change for the implementation:

- `rust/crates/tinyrustlm-composition2/Cargo.toml`;
- `rust/crates/tinyrustlm-composition2/src/lib.rs`;
- `tinyrustlm/tests/acg2-format-vectors.test.js`; and
- `docs/architecture/vnext-slm2-scalar-wasm-conformance.md`.

The implementation gate requires Rust formatting, warnings-denied Clippy,
exact Node and Chromium replay for both modules, the registered-tree test, and
the complete serial Node inventory. A source change outside this closure needs
separate review rather than being folded into this correction.

## Claim Boundary

This registration creates no WASM output and launches no browser. The eventual
implementation can prove only isolated conformance-ABI ownership and bounded
fixture replay. It cannot prove a real model, model quality, production browser
chat, P2P availability, package publication, deployment, MemoryEndpoints
operation, or campaign progress. Counters remain exactly `0/20`, `0/50`,
`0/25`, `0/40`, and `0/20`.
