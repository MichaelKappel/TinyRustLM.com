# Qwen3 Managed Custody Scratch Inspector Staging

Date: 2026-08-25

Status: implemented prerequisite; complete source gate and remote-exact
checkpoint required before output-free execution registration

## Decision

The one managed composition-inspector build may stage the exact Rust scratch
inspector that already passed the preceding Rust build-custody operation. The
managed project exposes one build property:

```text
TinyRustLmCustodyScratchInspectorSource
```

When and only when that property is present, it must be an absolute existing
file. The build copies its bytes to the fixed managed target-relative name:

```text
tinyrustlm-build-scratch-inspect.exe
```

The copy is performed by one `AfterTargets="Build"` MSBuild target. Hard links
and symbolic links are disabled. There is no alternate destination, source
discovery, default path, compatibility property, fallback, retry, repair, or
post-build mutation outside the registered child.

## Why This Is Required

Current build-custody profile `/3` classifies the owned environment scratch by
launching a source-controlled Rust Win32 inspector from the custody target.
The registered inspector must therefore be one exact required x64 PE output of
every custody child.

The corrected Rust command naturally builds both:

```text
cargo build --locked --release -p tinyrustlm-build-custody -p tinyrustlm-convert --target x86_64-pc-windows-msvc
```

The managed child builds only the read-only .NET composition inspector and its
conversion assembly. Without explicit staging, a managed custody request under
profile `/3` would be impossible: the scratch inspector required to validate
the managed child's environment root would not exist in that child's target.
Preregistering such a request would be dishonest, while weakening custody or
using the earlier blanket-reparse profile would reintroduce a proven defect.

## Custody Chain

The later execution registration must require this order:

1. materialize one immutable Windows x64 MSVC environment authority;
2. execute one Rust custody request under profile `/3`;
3. require the Rust target to contain both the x64 converter and the x64
   scratch inspector;
4. accept the Rust target only after its custody terminal passes;
5. bind the exact Rust scratch-inspector byte length and SHA-256 into the
   managed custody command property;
6. execute one managed custody request into a wholly new target;
7. require the managed target's staged scratch inspector to equal the qualified
   Rust bytes exactly and to be `PE32+ x86-64`;
8. run that staged helper once to inspect the managed environment scratch;
9. accept the managed build only when custody profile `/3` emits a passing
   terminal; and
10. allow composition execution only after both custody terminals pass.

The staging target does not qualify the source bytes. Qualification comes from
the first custody terminal, exact registered identity binding, byte-for-byte
copy verification, x64 PE inspection, the second custody terminal, and the
final execution verification record together.

## Build Contract

The managed custody command is exactly one direct `dotnet` build with:

- the composition-inspector project;
- `Release` configuration;
- `--no-restore`;
- `--no-incremental`;
- one new managed target root supplied through `--output`; and
- one absolute `TinyRustLmCustodyScratchInspectorSource` property pointing at
  the exact qualified Rust-target helper.

The private custody request binds that entire argument vector, all absolute
paths, the exact .NET host, source commit and tree, environment authority,
bounded supplement, roots, stream limits, required outputs, helper profile,
and helper operation identity. No path or identity is inferred from ambient
state.

The required managed output set becomes the four existing .NET files plus the
fixed scratch-inspector executable. Output paths are sorted and bounded. The
custody owner inventories the full target, hashes every required output,
validates the helper's x64 PE machine, invokes it once with canonical stdin,
requires empty stderr and one canonical passing observation, rehashes it after
invocation, and revalidates source and environment authority before pass.

## Failure Semantics

An absent, relative, unreadable, changed, non-x64, oversized, linked, or
otherwise invalid helper cannot produce a passing managed custody terminal.
An MSBuild failure, copy failure, nonzero process exit, output mismatch,
scratch-inspection rejection, malformed observation, stream overflow,
environment drift, or source drift closes the registration.

Every created request, root, stream, process terminal, scratch-inspection
record, and final terminal remains create-only evidence. A failure permits no
retry, resume, cleanup, overwrite, replacement, path substitution, output
adoption, or attractive-result selection. A later attempt requires a new
output-free registration and wholly new logical names.

## Verification

The dedicated Windows integration test performs a real offline,
nonincremental release build into a fresh temporary output. It uses an existing
x64 PE as deterministic test-only source bytes, then verifies:

- the build exits zero;
- the staged file exists at the one fixed name;
- staged byte length and SHA-256 exactly equal the source;
- the four managed inspector outputs also exist; and
- the project contains one staging target and no alternate path.

Two additional real builds supply a relative source and an absent absolute
source. Both must exit nonzero with the registered bounded error and must not
create the staged target file.

These test bytes are not the registered Rust helper and can never be adopted
by a production execution. The complete repository standard and release gates
must pass at an exact committed source before `/8` registration.

## Claim Boundary

This change makes the current two-custody build graph representable. It does
not register or execute `/8`, qualify a Rust or managed build, invoke the real
converter, create SLM2, establish source parity, run native inference, run a
browser, qualify model behavior, make a P2P announcement, publish a package or
site, authorize MemoryEndpoints, or advance any campaign counter.

TinyRustLM remains one unversioned prelaunch product. The `/3` and `/8`
identifiers are technical evidence identities, not product generations. No
legacy support, compatibility reader, migration, alias, fallback, temporary
adapter, retry, response repair, or accepted debt is introduced.
