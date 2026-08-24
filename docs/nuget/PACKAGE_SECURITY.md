# TinyRustLM Package Security

This document defines the release-security boundary for the TinyRustLM .NET
SDK. TinyRustLM is one prelaunch product. SLM2 and other numbered technical
contracts do not create a product-generation support obligation. Obsolete
package IDs, APIs, assets, scripts, and workflows are deleted rather than
retained as compatibility or migration paths.

## Authority And Package Allowlist

Rust is the sole authority for model formats, composition, prompt compilation,
sampling, generation, and fixed-piece artifact admission. Managed packages may
transport exact requests and reports but may not reinterpret, repair, or
replace Rust decisions.

The public package allowlist is closed:

1. `TinyRustLM.Abstractions`
2. `TinyRustLM.Core`
3. `TinyRustLM.P2P`

`TinyRustLM.MemoryEndpoints` is optional, unauthorized, and disconnected from
production. It is not part of the default publish set. Hosted records are
untrusted data and cannot become system instructions.

`TinyRustLM.Conversion` is private local-feed process tooling. It is never
accepted by the public publish command. Its converter executables remain
separate from the runtime native library.

Any extra or missing package, symbol package, dependency, RID asset, public API,
or archive entry is a release failure.

## Exact Dependency Graph

- `TinyRustLM.Abstractions` has no TinyRustLM package dependency.
- `TinyRustLM.Core` depends only on the same exact version of
  `TinyRustLM.Abstractions`.
- `TinyRustLM.P2P` depends only on the same exact versions of
  `TinyRustLM.Abstractions` and `TinyRustLM.Core`.
- Optional `TinyRustLM.MemoryEndpoints` depends only on
  `TinyRustLM.Abstractions`.
- Private `TinyRustLM.Conversion` depends only on `TinyRustLM.Core` and its
  transitive `TinyRustLM.Abstractions` dependency.

Protected references exclude build and analyzer assets from dependency
propagation. Cycles, floating versions, alias package IDs, and a standalone
memory facade are forbidden.

## Native Asset Boundary

Only `TinyRustLM.Core` may carry the runtime library:

| RID | Required package entry |
| --- | --- |
| `win-x64` | `runtimes/win-x64/native/tinyrustlm_native.dll` |
| `linux-x64` | `runtimes/linux-x64/native/libtinyrustlm_native.so` |
| `linux-arm64` | `runtimes/linux-arm64/native/libtinyrustlm_native.so` |

The package audit rejects native entries in `TinyRustLM.Abstractions`,
`TinyRustLM.P2P`, and `TinyRustLM.MemoryEndpoints`, unknown RIDs, unexpected
filenames, or native files outside the exact runtime placement.

The release workflow builds each library on matching target hardware and runs
the native contract tests there. The Linux ARM64 lane uses a real ARM64 runner.
Cross-compilation, QEMU smoke, or header inspection alone must be labeled as
such and cannot satisfy the real-hardware release gate.

Managed loading validates the exact native self-description and fifteen-symbol
ABI before creating a runtime. It does not probe old symbols, search arbitrary
fallback paths, or fall back to a managed inference engine.

## Private Converter Assets

When explicitly requested, `TinyRustLM.Conversion` may contain only the exact
`tinyrustlm-convert` executable for `win-x64`, `linux-x64`, and `linux-arm64`
under its reviewed `tools` and `contentFiles` locations. The package audit
requires the selected RID assets and rejects unrelated authoring or training
tools.

The wrapper invokes the executable directly with a closed argument contract.
It applies duration and output limits, bounds stdout and stderr, supports
cancellation, rejects reparse inputs, validates exact summaries, and rehashes
promoted SLM2 or Tokenizer2 output. Structural conversion is not model-quality
or browser evidence.

The Rust executable's complete `qwen3-composition` command is implemented but
not yet exposed by this managed wrapper. Until the wrapper validates its output
root, six artifacts, component receipts, terminal receipt, graph identity, and
nonzero failure semantics, managed conversion cannot claim a complete
composition.

## Public API Baselines

Each package has one sorted checked-in baseline under `eng/public-api`. The
package auditor compares the packaged XML documentation member set with that
baseline. Package tests also inspect managed metadata and package projects.

An intentional prelaunch API rewrite updates the current baseline only after
all producers, consumers, samples, docs, and tests are changed coherently. Old
members are removed. Type forwards, obsolete attributes, deprecated aliases,
and compatibility facades are not acceptable substitutes for deletion.

## Hostile Archive Inspection

Every `.nupkg` and `.snupkg` is treated as hostile ZIP input. Canonicalization
and audit reject:

- absolute paths, traversal, backslashes, reserved names, and unsafe portable
  path collisions;
- duplicate entries and case-insensitive collisions;
- signed archives that would be invalidated by canonicalization;
- unsupported extensions, oversized entry counts, and malformed ZIP data;
- noncanonical timestamps or extra archive content;
- source files, generated `bin`, `obj`, `target`, or `artifacts` paths;
- unexpected debug files in primary packages;
- local absolute source paths and private authoring surfaces;
- missing or unexpected managed DLL, XML, native, readme, license, or package
  documentation entries; and
- package metadata, dependencies, API members, or RID entries outside the
  closed package-specific allowlist.

Canonical package archives use one deterministic entry order and timestamp
identity before hashes are recorded. A later repository signature is a distinct
phase and may not be silently removed or rewritten.

## Symbol Packages And SourceLink

Every public `.nupkg` has one matching `.snupkg` at the same package ID and
version. The symbol package must declare `SymbolsPackage`, contain the expected
portable PDB, and remain within its narrow allowlist. Source files, generated
output trees, and private absolute paths are rejected.

Repository URL/type, source revision, portable PDB identity, and SourceLink
behavior are reviewed as one supply-chain claim. Creating an `.snupkg` is not
proof that a registry accepted or serves it.

## Create-Only Package Transaction

Every transaction uses a new absent or empty output directory. Reusing a
nonempty folder fails before packing. The scripts do not recursively clean an
unknown path or overwrite prior evidence.

The transaction runs current Rust formatting, warnings-denied lint and tests,
explicit managed restores/builds/tests, exact package creation, package
canonicalization, package audit, isolated consumer execution, package and
symbol hashing, and bounded manifest creation.

The audit report schema is `tinyrustlm.nuget.package_audit.v1`. A passing report
binds:

- exact package and symbol names, IDs, versions, sizes, and SHA-256 values;
- package metadata, dependencies, API baselines, documentation, and ZIP entry
  inventories;
- native RID coverage and exact allowed native entries;
- portable PDB and symbol-package evidence;
- private/source/debug/generated/local-path scan results; and
- missing, unexpected, mismatch, and terminal status counts.

The package transaction then installs only the packed bytes into a fresh
temporary project with isolated global and HTTP NuGet caches. It proves SLM2
inspection, exact native contract loading, runtime handle ownership, ACG2 and
SLM2 piece assembly, byte identity, create-only collision rejection, and
manifest-tamper rejection. Host build outputs and globally cached packages may
not satisfy this gate.

## Hash Manifest And Publish Binding

`SHA256SUMS-TinyRustLM-<version>.txt` contains the package and symbol package
hashes from the completed transaction. The publish command requires:

- exactly the three public package files and three symbol packages;
- a passing package-audit report containing the same names, sizes, and hashes;
- the matching SHA-256 manifest with no missing, extra, duplicate, or malformed
  rows; and
- the source-declared package version.

`TinyRustLM.MemoryEndpoints`, `TinyRustLM.Conversion`, an unknown TinyRustLM
package, stale version, changed byte, or extra archive blocks publication before
the first push.

The publish report uses schema `tinyrustlm.nuget.publish_plan.v0`, records
`secret_material_included=false`, and includes only bounded source-control/CI
provenance. It preserves `push_failed` evidence when any primary or symbol push
fails so a partial attempt cannot be presented as success.

## Credential Boundary

API keys and short-lived Trusted Publishing credentials enter only through
explicit process parameters or environment variables. They must not appear in
Git, command-formatting output, JSON reports, package metadata, manifests,
exception text, screenshots, or retained logs.

The PowerShell publisher redacts the argument following `--api-key`. The Bash
publisher must provide equivalent redaction. Publication uses the configured
feed only; Trusted Publishing is accepted only for NuGet.org with the reviewed
workflow/environment policy.

## Release Readiness And Public Readback

The readiness audit proves the local package folder before evaluating remote
state. It creates a dry-run publish plan, verifies the local feed version and
exact hashes, queries the remote feed, and reports one of the explicit states
such as blocked local verification, blocked authentication, ready to publish,
published current, or remote hash mismatch.

After an authorized push, public readback is mandatory:

1. all three package IDs expose the source-declared version;
2. no undeclared newer-version condition is hidden;
3. flat-container package bytes match the retained publish plan;
4. symbol publication evidence is retained and reviewed;
5. an isolated clean consumer restores and executes the public packages when
   that smoke is requested; and
6. reports remain free of credentials and private paths.

Upload logs, package creation, and registry version visibility alone are not a
publication claim. A version that exists remotely with different immutable
bytes is a blocker; the same package version is never overwritten.

## Failure And Incident Handling

Failed and obsolete receipts are preserved. A changed package, API baseline,
native binary, auditor, publish plan, or feed observation invalidates only its
dependent phases, but no prior evidence is overwritten.

When a gate finds an obsolete API, package, workflow, asset, documentation
instruction, source leak, wrong RID, hash mismatch, or consumer failure:

1. preserve the exact failure;
2. add a general regression test;
3. fix the sole current owner;
4. delete the superseded executable or documentation path;
5. rerun the invalidated package transaction in a new output directory; and
6. publish only after every applicable gate and public readback passes.

Package security proves distribution integrity for the tested SDK bytes. It
does not prove model provenance, conversational quality, browser-WASM parity,
public P2P reachability, site deployment, or live MemoryEndpoints operation.
