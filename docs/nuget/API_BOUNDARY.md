# TinyRustLM .NET API Boundary

TinyRustLM is one prelaunch product. Numbered identifiers such as SLM2, ACG2,
Tokenizer2, Template2, Prompt2, and Sampling2 name exact technical contracts;
they are not product generations. The package surface exposes only the sole
current implementation. It has no compatibility API, migration reader, alias,
fallback runtime, response repair, or parallel model path.

## Package Set

The default package set contains exactly three packages:

- `TinyRustLM.Abstractions` contains immutable public records, enums, and
  interfaces.
- `TinyRustLM.Core` owns the managed wrapper over the exact native contract.
- `TinyRustLM.P2P` owns composition-bound fixed-piece preparation, inspection,
  and create-only assembly.

Two packages are explicitly optional and excluded by default:

- `TinyRustLM.MemoryEndpoints` contains the connector contract. Its presence
  does not prove that the service is authorized, connected, or production
  ready.
- `TinyRustLM.Conversion` is private local-feed tooling around the exact
  `tinyrustlm-convert` process. It is not a model-selection or training API.

There is no local `TinyRustLM.Memory` package or memory facade.

## Native Contract

`TinyRustLM.Core` validates the native contract before creating a runtime. The
contract contains exactly these fifteen symbols:

1. `tinyrustlm_native_contract_json`
2. `tinyrustlm_string_free`
3. `tinyrustlm_slm2_inspect_json`
4. `tinyrustlm_runtime_create_json`
5. `tinyrustlm_runtime_destroy_json`
6. `tinyrustlm_runtime_state_json`
7. `tinyrustlm_runtime_activate_json`
8. `tinyrustlm_runtime_advance_operation_json`
9. `tinyrustlm_runtime_set_transcript_json`
10. `tinyrustlm_runtime_begin_request_json`
11. `tinyrustlm_runtime_step_json`
12. `tinyrustlm_runtime_finish_json`
13. `tinyrustlm_p2p_prepare_share_kit_json`
14. `tinyrustlm_p2p_inspect_manifest_json`
15. `tinyrustlm_p2p_assemble_json`

Native-owned UTF-8 JSON results are released only through
`tinyrustlm_string_free`. Managed code rejects embedded NUL characters,
validates request and response bounds, requires exact schema identities, and
does not normalize or repair native reports. Runtime handles are represented by
`SafeHandle` ownership and are destroyed once.

## Runtime Surface

`TinyRustLmRuntimeFactory.GetNativeContract` returns the validated exact
contract. `CreateRuntime` creates an empty runtime with an immutable operation
identity and bounded policy.

`ITinyRustLmRuntime` exposes only the canonical state machine:

- inspect SLM2 through `TinyRustLmSlm2Inspector`;
- activate a complete five-member ACG2 composition fail-atomically;
- advance the immutable operation identity;
- set the transcript revision;
- begin one Prompt2 request;
- step deterministic Sampling2 generation, including explicit cancellation;
- finish and return the unmodified terminal output; and
- inspect bounded state and dispose the runtime.

Activation binds exact SLM2, Tokenizer2, Template2, Sampling2, and Prompt2
members. A failed preflight cannot partially replace active state. Advancing an
operation clears generation and KV state while retaining only state explicitly
allowed by the native contract. Managed callers cannot provide alternate host
sampling knobs or invoke a second runtime.

## Fixed-Piece P2P Surface

`TinyRustLmP2PClient` exposes three operations:

- `PrepareShareKit` creates immutable four-MiB pieces and one canonical
  `tinyrustlm.vnext.p2p_manifest.v1` manifest.
- `InspectManifest` validates bounded canonical manifest bytes without network
  access or repair.
- `AssembleArtifact` reads manifest-declared pieces and create-only assembles
  one exact SLM2 or ACG2 artifact after piece, Merkle, whole-artifact, and
  semantic admission.

The Merkle profile is `tinyrustlm.merkle.sha256-4mib.v1`. SLM2 admission also
binds the exact ACG2 composition path supplied by
`TinyRustLmP2PAdmission.ForSlm2Model`. ACG2 admission uses
`TinyRustLmP2PAdmission.ForAcg2Composition`.

This package is direct transport, not a discovery or catalog control plane. It
does not expose peer discovery, announcements, catalogs, signatures, receipt
sidecars, public reachability claims, network fallback, model-byte proxying, or
model authoring.

## Conversion Boundary

`TinyRustLM.Conversion` invokes only the locked `tinyrustlm-convert`
transactions for Qwen3 safetensors to mixed-Q8 SLM2 and Qwen tokenizer data to
Tokenizer2. The wrapper enforces create-only outputs, bounded stdout/stderr,
duration and cancellation limits, exact structured summaries, expected output
and receipt existence, and streamed output-hash revalidation.

The Rust executable now implements the separately registered
`qwen3-composition` transaction over all six artifacts. The managed wrapper has
not yet adopted that command at this checkpoint. Component conversion through
the wrapper is therefore not complete composition availability.

Conversion is structural and provenance evidence. It is not model quality,
native inference, browser WASM parity, browser conversation, P2P availability,
or publication evidence.

## MemoryEndpoints Boundary

`TinyRustLM.MemoryEndpoints` remains an optional connector and deterministic
contract library. Credentials are supplied only to an in-memory client and are
not serializable DTO fields. Received memory remains untrusted data.

Production MemoryEndpoints operation is unauthorized and disconnected. Unit
and fixture behavior cannot be reported as live account, continuity,
enrollment, cleanup, or readiness evidence.

## Package And Consumer Gates

Release verification must:

1. build the Rust workspace and managed solution with warnings denied;
2. verify the exact fifteen native symbols and packaged native asset hashes;
3. create isolated consumer projects and NuGet caches;
4. install only the built package files at the exact package version;
5. materialize the canonical SLM2 and ACG2 vectors;
6. inspect SLM2, create/advance/dispose an empty runtime, prepare/inspect/
   assemble ACG2 and SLM2, and compare exact bytes;
7. prove create-only collision and manifest-tamper rejection;
8. reject unexpected package IDs, files, dependencies, exported APIs, symbols,
   stale documentation, and private authoring code; and
9. distinguish local package success from registry publication and public
   readback.

The public API baseline is derived from checked-in approved member lists and
freshly packaged assemblies. Intentional prelaunch rewrites update the current
baseline and delete superseded APIs; they do not retain type forwards,
deprecated members, or facade packages.
