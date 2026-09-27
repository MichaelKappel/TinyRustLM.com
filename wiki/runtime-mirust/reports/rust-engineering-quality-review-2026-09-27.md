# Rust engineering quality report review — September 27, 2026

The owner supplied `Enterprise Rust Best Practices for High-Quality, Efficient, Reusable Code.md`. All sections were read. It is general engineering advice, not a TinyRustLM code audit or model-quality evaluation. Exported citation tokens have no resolving bibliography. Named primary sources below were checked separately; other references and company performance figures remain report-supplied claims, not project evidence. No report code was executed.

Raw identity: 61,152 bytes; SHA-256 `a556a15b1f75b041cd5a20d9d0e6261d05e50a13e1e4c203b931787119fa7b56`. Custody: `docs/report-intake/2026-09-27/rust-engineering-quality/MANIFEST.md`.

## Applied decisions

| Topic | Disposition and proof of use |
| --- | --- |
| Ownership, newtypes, small traits, typed errors | Applied in `.uai/coding-standards.uai`: borrow observed inputs, own retained inputs, validate invariants and preserve actionable errors. Existing handwritten errors need no new dependency. |
| Allocation and performance | Applied with correction: checked sizes, explicit ceilings and fallible reservation for hostile lengths. The report's `saturating_mul` plus `Vec::with_capacity` example is not a resource-admission policy. Measure native/browser phase costs before changing dispatch, allocation, LTO, SIMD or parallelism. |
| Concurrency and cancellation | Applied with correction: offloading work does not establish bounded concurrency, cancellation or shutdown. Keep admission, ownership and settlement explicit. No Tokio/Rayon addition follows. |
| Testing and documentation | Applied in `.uai/test-plan.uai`: local formatting, Clippy, affected unit/integration/doctests, supported feature/target combinations, independent vectors and hostile rejection. Fuzz/Miri/Loom/benchmarks need a specific defect class, bounded execution and retained results; listing tools is not coverage. |
| Dependency governance | Applied: reuse workspace/lockfile/lints; inspect necessity, features, maintenance, license and toolchain impact before additions. No automatic dependencies, edition, resolver or toolchain upgrade. |
| FFI and unsafe | Preserve explicit approval for new unsafe code. The example wrapper is not a proof of foreign behavior, lifetime, thread safety, reentrancy or unwind handling. Review actual boundaries; do not impose blanket changes on existing FFI. |
| Tracing | Apply privacy before instrumentation: explicitly allowed fields only, excluding prompts, model text, credentials and memory payloads. No telemetry service/exporter installed. |
| Migration and CI | Generic adoption advice does not override prelaunch current-only/no-legacy policy. Local checks, ordinary Git and FTP/FTPS remain controlling; no GitHub Actions or charged services. |

## Local source observations

Read-only checkpoint `7ff9ee04456be3d8ab0776a6f0f7dffff6e41cb6`, branch `codex/model-acquisition-v2`: local, tracking and direct remote agreed before edits; root was a direct directory. Only the supplied report was initially untracked.

- Root `Cargo.toml` already has 23 members, shared dependencies/package metadata/lints, resolver 2 and edition 2021. The report's resolver 3 example is not an upgrade instruction.
- `tinyrustlm-runtime` and `tinyrustlm-native` inherit workspace lints. Workspace `unsafe_code = "warn"` is not a prohibition; `rust/crates/tinyrustlm-runtime/src/lib.rs` independently has `forbid(unsafe_code)`. This is not a whole-workspace unsafe audit.
- `rust/crates/tinyrustlm-runtime/src/conversation.rs` checks logit/scratch arithmetic and policy limits, then uses `try_reserve_exact` and explicit allocation errors. The report reinforces an existing pattern; this review establishes no new defect there.
- Release profile uses `opt-level = "z"`, LTO, one codegen unit and abort-on-panic, with runtime optimization level 3. No measured local evidence justifies replacing it with the report's profile.
- Root manifest/lockfile search found no `bincode`, `proptest` or `criterion` dependency entry. Bincode maintenance is not an observed dependency defect here.
- No root `rust-toolchain.toml` exists. Disabled workflow definitions use stable and a dated nightly for a specialized job. Review actual local build scripts/environment locks before selecting a consistent toolchain/MSRV policy; no new pin or claimed MSRV follows.

The source-authority command stopped at `source_authority_ecosystem_direct_child_unexpected` for `E:\Source\Rust\.vs`. Read-only direct listing found Visual Studio cache/settings names, without recursive audit or deletion. This is the current first failure, not proof that earlier access/link issues are resolved. Intake guidance/custody proceeds under the existing memory-review exception; no build, runtime test, source-admission pass or release claim follows.

## Verified primary references and corrections

- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/type-safety.html): use typed validation for actual invariants rather than indiscriminate abstractions.
- [Cargo workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html): shared policy requires member inheritance; a root lint table alone does not apply everywhere.
- [Cargo features](https://doc.rust-lang.org/cargo/reference/features.html): favor additive features and test supported combinations, not blind `--all-features`.
- [Cargo profiles](https://doc.rust-lang.org/cargo/reference/profiles.html): optimization choices are workload dependent.
- [Tokio spawn_blocking](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html): started work cannot be aborted. Bound concurrency and provide cooperative termination or the existing contained-process boundary. A timeout on waiting does not prove work stopped.
- [Tracing instrument](https://docs.rs/tracing/latest/tracing/attr.instrument.html): arguments are recorded by default; skip arguments and explicitly allow safe fields when instrumentation is needed.
- [Bincode 3.0.0](https://docs.rs/crate/bincode/3.0.0): confirms maintenance cessation and the deliberate compile-error release. Version-specific external evidence is no reason to replace TinyRustLM's formats.
- [Miri](https://github.com/rust-lang/miri): detects problems in exercised executions, not a general soundness proof. State platform/FFI/toolchain limits.

## Bounded follow-up routes

After source admission, use existing local formatting/Clippy and affected Rust tests with the locked graph and recorded compiler/target/features; cover doctests separately if a runner excludes them. Inventory parser/FFI/concurrency tests against actual hostile-input and lifecycle invariants. Pair round trips with independent known-answer and rejection cases because producer and consumer can share a defect. Review local reproducibility and dependency-audit coverage before selecting additional tools or compiler pins.

These are verification routes, not asserted defects or authorization to rewrite the runtime. Only internal guidance and retained advisory evidence change. Website/runtime files are untouched. Cleanup completion, model qualification, publication and owner acceptance are not established by this intake.

## Intake validation

`eng/verify-report-intake-memory.ps1` passed: 25 manifests, 273 checksum-bound rows, zero failures and no active non-placeholder intake. Its dated current-batch check still covers the original sixteen reports. A separate supplemental assertion checked this report's original length/hash, manifest, ledger, exactly one raw-report index route, four applied guidance routes and both empty intake buckets. This is documentation/custody validation, not Rust test coverage. The source-authority failure above remains an independent release limitation.
