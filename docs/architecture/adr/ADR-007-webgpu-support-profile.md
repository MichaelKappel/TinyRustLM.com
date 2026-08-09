# ADR-007: WebGPU Support Profile

## Status

Accepted as the target architecture. WebGPU is not implemented, promoted, or
required for TinyRustLM correctness.

## Decision Date

2026-08-08

## Scope

This ADR defines WebGPU ownership, capability admission, kernel profiles,
resource planning, failure recovery, and evidence needed for promotion.

## Decision

WebGPU is an optional acceleration backend. The Rust CPU/WASM path remains the
correctness owner for:

- artifact and composition validation;
- tokenizer and chat-template rendering;
- deterministic context assembly;
- sampler state, stop conditions, and grammar state;
- cancellation and generation IDs;
- user-visible token commitment and output ownership.

Only trusted, source-controlled, content-hashed static WGSL modules execute.
Model metadata, user text, memory, tool output, or catalog strings never
generate shader source.

The initial backend profiles are independently promoted in this order:

1. WGPU-CORE-F32-1 using core features and F32 accumulation;
2. WGPU-Q8-F32ACC-1;
3. WGPU-Q4-F32ACC-1.

Optional shader-f16, subgroup, timestamp-query, or other feature variants are
separate profiles with separate identities and evidence. The implementation
requests only limits and features required by the selected plan. It queries
the actual adapter/device limits and rejects a model before allocation if the
complete deterministic buffer/binding/workgroup plan does not fit.

Weights are uploaded in bounded chunks into immutable backend buffers.
Prefill and decode have distinct execution plans. Dynamic per-token allocation
is prohibited. Buffer pools, bind groups, staging buffers, dispatch counts,
readbacks, and in-flight generations are bounded.

Before admitting a device/profile pair, TinyRustLM runs content-hashed
numerical self-tests. A software, compatibility, fallback, or unknown adapter
may be useful to test error handling but cannot serve as physical accelerator
performance evidence.

Device loss is a typed transition. The backend stops dispatch, invalidates GPU
resources, preserves the last committed token and deterministic sampler state,
and may visibly resume on CPU only from that token-commit boundary. It never
duplicates or silently rewrites output.

## Alternatives

- **WebGPU as the only runtime** was rejected because availability and device
  behavior vary and GPU code must not own security validation.
- **Generate WGSL per model** was rejected because untrusted strings must not
  become executable shader source.
- **Request maximum adapter limits** was rejected because it reduces
  portability and requests capabilities the plan does not need.
- **Silent CPU fallback** was rejected because it can duplicate tokens,
  misreport performance, and hide device failure.
- **Promote from headless or software adapters alone** was rejected because
  those runs do not prove physical browser/OS/driver behavior.

## Authoritative Evidence

- **Observed local fact**: the current runtime has no promoted WebGPU backend.
- **Observed local fact**: Rust/WASM already owns model validation and
  generation semantics, which is the retained trust boundary.
- **Sourced public fact**: WebGPU exposes adapter-dependent features, limits,
  asynchronous errors, and device-loss behavior in the current Candidate
  Recommendation Draft at
  https://www.w3.org/TR/2026/CRD-webgpu-20260109/.
- **Engineering decision**: static shaders plus a narrow core profile provide
  the smallest auditable acceleration surface.
- **Local verification required**: real browser, OS, adapter, driver, and model
  combinations must pass before any support or speed claim.

## Threat Analysis

Threats include shader injection, oversized allocations, integer overflow in
buffer offsets, out-of-bounds access, adapter fingerprint leakage, stale
readback, unbounded in-flight work, device-loss duplication, numerical drift,
misleading fallback performance, and driver-specific hangs.

All dimensions and offsets are checked on CPU. WGSL has explicit bounds and
closed constants. Error scopes surround pipeline and resource creation.
Diagnostics expose only bounded device classes and hashed plan/kernel IDs,
never unnecessary stable hardware identifiers. Watchdogs and cancellation
bound page unresponsiveness.

## Performance Evidence

No performance claim exists yet. Promotion requires preregistered measurements
on each named physical target:

- cold pipeline creation and warm cache behavior;
- upload bytes/time and peak browser/driver memory;
- prefill and decode latency distributions;
- tokens per second at multiple context lengths;
- CPU/WASM baseline comparison;
- power/responsiveness where measurable;
- numerical and semantic deltas;
- device-loss and fallback recovery time.

Measurements bind browser build, OS, adapter class, driver, limits, feature
set, shader hash, pipeline identity, runtime hash, model identity, and sampling
profile. Compilation is not execution evidence.

## Compatibility Impact

WebGPU absence or rejection leaves the qualified CPU/WASM path available. This
is a product backend choice, not a legacy format fallback.

Profiles are exact. Unknown feature sets or shaders do not run under a nearby
profile. A device that cannot satisfy the complete plan is reported
unsupported for that model/profile.

## Clean Deletion Impact

Experimental WebGPU kernels, generic feature branches, unbound shader
variants, and benchmark-only shortcuts are deleted unless they become exact
promoted profiles. No dead fallback implementation remains after a profile is
replaced.

## Unknowns

- Physical adapter/browser matrix and useful minimum device classes.
- Optimal kernel tiling, fusion, upload, and readback strategy by profile.
- Whether F16 or subgroup variants justify their permanent test surface.
- Browser memory-pressure and device-loss behavior for target model sizes.
- Whether WebGPU improves small-model latency enough to outweigh startup cost
  on low-end devices.

## Acceptance Tests

1. Capability planning rejects absent features, insufficient limits, overflow,
   and impossible memory plans before allocation.
2. Static shader hashes and profile IDs bind every pipeline.
3. Golden operator, layer, logit, ranking, greedy, stochastic, and multi-turn
   conformance pass within preregistered tolerances.
4. Shader compilation failure, allocation failure, device loss, cancellation,
   stale readback, page backgrounding, and model switch leave one coherent
   output stream.
5. Long-context and repeated-generation tests prove bounded buffers and no
   resource leak.
6. Network/privacy tests prove no prompt, model, shader diagnostic, or device
   identity is uploaded.
7. Every support/performance claim is backed by physical browser/OS/adapter
   execution, not software adapters, emulation, or compilation.

## Rollback

Disable and remove the unpromoted WebGPU profile while preserving CPU/WASM
correctness and failure evidence. For a promoted regression, roll back the
entire web/runtime release and retract its profile claim. Do not silently map
the failed profile to different shaders or features.
