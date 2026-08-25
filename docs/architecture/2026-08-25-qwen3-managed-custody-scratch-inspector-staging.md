# Qwen3 Managed Custody Scratch Inspector Staging

Date: 2026-08-25

Status: implemented and clean-gated at a remote-exact implementation source;
bounded evidence checkpoint required before output-free execution registration

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

## Verified Implementation Checkpoint

The implementation is commit
`fe4c78c0eb8c82f79377791bf7262687d21a2993`, tree
`e4ddd18e2e034a0ef9b17674ace61f61548cfffd`. It was pushed, freshly fetched,
and observed equal across local `HEAD`, its tracking reference, `FETCH_HEAD`,
and the direct remote branch before the clean gate began. The worktree was
clean.

The implemented source identities at that commit are:

- project: 1,415 bytes, SHA-256
  `f34b58e31473913aaf8f2fd99b1220cf6af94c6c8f943db0a853da8f35b3eddc`;
- dedicated test: 4,538 bytes, SHA-256
  `ad1e280ccdcac51bc1af12fe54affc108703caba1cce4a4cd7c8e24cc429cda7`;
- this architecture record before the bounded gate update: 6,512 bytes,
  SHA-256
  `92ee743b1e24b26931df862c743f18fda40a079f252e5ac23f27d053354abb83`;
- controller clean-cut architecture after its command update: SHA-256
  `b80a877ffafa7ff1a6b6e0a964b0e3cb76692a7c3543a513f0e158e6a81b79c2`;
  and
- vNext contract index: SHA-256
  `400a7976cbd9082e0e1dc85e7bc22eb0f1078a767a323f5e0783679c0f21d023`.

Focused verification passed as follows:

- dedicated staging tests: 3/3;
- combined custody, controller, and staging tests: 29/29;
- serialized managed release build with `--no-restore --no-incremental`: zero
  warnings and zero errors; and
- serialized managed tests with `--no-build`: 207/207.

The canonical clean repository gate then ran against the exact implementation
commit and tree. Its serialized standard partition passed 1,387, failed zero,
and retained exactly two declared skips across 1,389 tests in 430,990.3494 ms.
Release-surface run
`5fa8c5c4d8ea79aeb52de38d4e607bb172ea59765d75ea21523fd42c48533bbf`
passed 23/23 tests across ten serial shards. The maintained verifier reopened
the complete evidence graph and returned `pass`. Independent filesystem
hashing reproduced the canonical 3,995-byte aggregate receipt SHA-256
`cd4942f814d46452370a24c5ffe3c01ce85dcb1734856cdb3a3d8bef5edd7db8`;
all ten retained release stderr streams were empty.

This bounded record must itself be committed, pushed, freshly fetched, and
proved direct-remote exact. Only a later, separate output-free `/8`
registration may bind that new parent and wholly new absent private names.
No `/8` material may be created before that registration is remote exact.

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
