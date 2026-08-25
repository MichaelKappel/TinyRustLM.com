# Junction-Qualified Windows X64 Build Custody

Date: 2026-08-25

Status: sole current prelaunch implementation; locally fault-tested on Windows
x64; not yet used by a newly preregistered real composition execution

## Decision

TinyRustLM has one maintained build-custody path. Profile `/3` cleanly replaces
profile `/2`; these numbers identify technical contracts, not product versions.
TinyRustLM remains one unversioned prelaunch product. The `/2` profile and
reader are absent from the maintained tree. Their exact bytes remain available
only through immutable Git history and the source commit bound by execution
`/7`. There is no compatibility reader, migration, alias, fallback, retry,
repair, resume, cleanup, or candidate-adoption path.

Execution `/7` remains terminal evidence. Its sole Rust child exited `0` and
created an x64 converter, but custody rejected the environment scratch because
the former blanket policy could not represent one Windows `Content.IE5`
directory junction. The converter remains unqualified and prohibited as an
input. This replacement does not reinterpret `/7`, change its result, or reuse
any of its private names.

The current source identities are:

- `contracts/vnext/build-custody-profile.v3.json`: 9,786 canonical ASCII/LF
  bytes, SHA-256
  `0bdc4227b1c7576bd844be1c0891c2b60868ddfdf0626efc96506c36adb24626`;
- `contracts/vnext/build-scratch-inspector-profile.v1.json`: 3,170 canonical
  ASCII/LF bytes, SHA-256
  `08a2c5cb57cff8b260972129efcdfbcd2e598b51a5d6660f3c11c83a0be05aef`;
- `tinyrustlm/tools/build-custody-owner.js`: 101,623 bytes, SHA-256
  `ae68f34b5a98d8f43aee8dd1b2733012a46d8d673e23f42567621b5c460c15e1`;
- `rust/crates/tinyrustlm-build-custody/src/lib.rs`: 60,260 bytes, SHA-256
  `657dd6cf7e8399ad1a9984b6ab81882736b08492a571d4b01a0b0cfaa75039b0`;
- `rust/crates/tinyrustlm-build-custody/src/bin/tinyrustlm-build-scratch-inspect.rs`:
  1,034 bytes, SHA-256
  `a6943b02eccd068aa04c301abd9aebb1b7a205a6f3945928c3cbd856cb6fe2ab`.

The separately materialized MSVC authority remains profile 6,510 bytes at
SHA-256
`76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607`
and owner 54,052 bytes at SHA-256
`48b550da9fa0a81735467d2af6dc733fa5ba2df4e9f815e505c37b57bfdb4ebf`.

## Custody Request

The owner accepts only canonical
`tinyrustlm.build-custody-request.v3` JSON with exact field order. Unknown,
missing, reordered, malformed, oversized, or noncanonical input fails before
any custody root is created. The request binds:

1. the exact `/3` profile and operation identity;
2. clean repository root, branch, commit, tree, Git executable, and owner;
3. exact Node runtime and Windows x64 host properties;
4. the six cross-bound MSVC authority artifacts;
5. the exact scratch-inspector profile and a distinct inspection operation ID;
6. one generated inspector relative path that must also be one sorted required
   output of kind `pe-x64`;
7. exact command, arguments, working directory, and sorted nonoverlapping
   environment supplement;
8. absent sibling control, target, and environment roots;
9. build timeout, stdout, stderr, and exact taskkill-tree authority;
10. target count/byte limits, scratch count/byte/junction limits, and every
    required output.

The source commit is the trust root for the Rust inspector implementation. The
inspector profile is independently read, rehashed, schema-checked, and proven
committed at that same source commit. The generated executable does not exist
before the build; after a zero exit it must be a direct regular `0x8664` PE
required output. Its exact resulting bytes are recorded before invocation and
must remain unchanged afterward.

## Root And Environment Authority

The control, target, and environment roots must be absent direct siblings under
one existing direct non-reparse parent and must not overlap source, working
directory, or private authority artifacts. The owner creates each root once.
The environment root starts with exactly direct `home` and `temp` directories.
`USERPROFILE` and `TEMP` bind to those children.

The MSVC authority still exclusively owns `PATH`, `LIB`, `LIBPATH`, and
`CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER`. The build request cannot override
an authority name under case folding. Fresh exact-process validation occurs
before roots, immediately before child launch, after every child outcome, and
again after scratch inspection before a pass. Environment or source drift has
custody-failure precedence.

## Rust Inspection Protocol

The owner writes one compact canonical
`tinyrustlm.build-scratch-inspection-request.v1` document before invoking the
generated helper. It binds the absolute owned environment root, exact profile,
inspection operation, count/byte/path/junction limits, and exact root entries
`home:directory` plus `temp:directory`.

The helper is a Windows-only, x64-compatible, bounded Rust process. It reads at
most 262,144 request bytes from stdin, emits one compact canonical observation
or typed failure on stdout, keeps stderr empty, launches no child, uses no
network, and mutates no filesystem state. It performs these checks:

1. Verify request byte canonicality, exact schemas/profile identity, operation
   syntax, absolute ASCII path, and bounded values.
2. Canonicalize the root while rejecting UNC, drive-relative, non-ASCII,
   reserved separators, trailing spaces/dots, empty components, and excessive
   depth or component length.
3. Open every root component and the root itself with
   `FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS`; require direct
   directories and retain the root identity handle for the inventory.
4. Enumerate bounded direct entries. Open every entry no-follow, stream-hash
   regular files through a heap buffer, and compare file identity before and
   after reading. Hold and recheck each direct directory identity around its
   enumeration.
5. For a reparse entry, require directory attributes and read its raw buffer
   through `FSCTL_GET_REPARSE_POINT`. Accept only
   `IO_REPARSE_TAG_MOUNT_POINT` (`0xa0000003`) with structurally valid UTF-16
   offsets and lengths.
6. Normalize only `\??\<drive>:\...` substitute names. Require a strict
   descendant of the same canonical root and the root volume. Resolve each
   target component no-follow and require one direct directory target.
7. Reject link/target ancestor relationships, self identity, external or
   cross-volume targets, target chains, dangling or file targets, duplicate
   target paths or identities, case-fold collisions, symbolic-link tags,
   unknown tags, malformed buffers, and inventory drift.
8. Require every target to appear in the independently inventoried direct
   directory map with the same hashed volume/file identity.
9. Require exact root entries and produce a sorted relative-path-only junction
   list. Absolute roots, raw reparse targets, and host errors never enter the
   observation.
10. Repeat the complete inventory and require exact equality before emitting a
    pass.

The helper never enumerates through a junction. A contained junction is not
accepted merely because its textual target begins with the root; the no-follow
component, volume, direct-target, identity, independent-inventory, relationship,
duplicate, and double-snapshot checks must all pass.

## Owner Invocation And Evidence

Only a fully reconciled build exit `0` reaches target inspection. The owner
first inventories the direct non-reparse target tree and validates all required
outputs. It then writes and fsyncs these inspector records create-only:

- `build.scratch-inspection.request.json`
- `build.scratch-inspection.stdout.bin`
- `build.scratch-inspection.stderr.bin`
- `build.scratch-inspection.process-terminal.json`

The helper is invoked exactly once with `shell: false`, no arguments, canonical
stdin, a minimal `SystemRoot` environment, target-root cwd, a bounded timeout,
and bounded binary pipes. The process terminal is durable before the owner
interprets the observation. Exit `2` must carry an exact typed helper failure;
all other nonzero, timeout, signal, spawn, overflow, nonempty-stderr, malformed,
noncanonical, count-inconsistent, path-unsafe, or contract-inconsistent results
fail custody.

On a candidate pass, the owner verifies observation field order, schemas,
profile and operation identity, counts, SHA-256 syntax, junction order,
relative paths, accepted tag, no ancestor relation, and no duplicate target.
It then rehashes and PE-checks the inspector executable and revalidates all
source, tool, profile, environment, and repository identities. Only then can
`build.terminal.json` be `pass`.

The private control root has these ten roles:

- `build.binding.json`
- `build.start.json`
- `build.stdout.bin`
- `build.stderr.bin`
- `build.process-terminal.json`
- `build.scratch-inspection.request.json`
- `build.scratch-inspection.stdout.bin`
- `build.scratch-inspection.stderr.bin`
- `build.scratch-inspection.process-terminal.json`
- `build.terminal.json`

The public summary exposes bounded counts, hashes, process status, inspection
status, and environment-validation truth. It excludes absolute paths,
environment values, raw logs, reparse targets, prompts, credentials, model
bytes, and private authority material.

## Tests

The Rust crate passes 11 library tests plus 2 real executable-boundary tests in
debug mode, warning-free Clippy, and both executable-boundary tests in optimized
release mode. Tests create real Windows mount-point junctions and cover one
same-root sibling target plus external, duplicate, chained, ancestor/cycle,
dangling, wrong-tag, malformed-range, noncanonical, unknown-field, and
over-limit rejection. The process test exposed and permanently covers a former
Windows main-thread stack overflow by requiring the one-megabyte hash buffer to
remain heap allocated.

The Node custody gate passes 20/20 tests. It includes the exact known-folder
shape `home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5` targeting the
direct sibling `IE`, a real external-target rejection with typed helper
failure, malformed helper output, post-invocation executable mutation, source
and environment drift, bounded streams, timeout/tree kill, spawn failure,
missing and malformed outputs, exact PE checks, collision refusal, explicit
environment isolation, and detached owner completion after observer death.

The complete clean-source wrapper ran from remote-exact source commit
`7a70834120238ff6bf3ce32439b4064ea9223230`, tree
`9781960efc6ca48eb5d335c764682e6957a6cb45`. Its serialized standard
partition completed 1,386 tests: 1,384 passed, zero failed, and exactly two
declared skips. The skips are the external generated-package-input lane and
the opt-in observation of an installed Visual Studio instance; neither grants
package, toolchain, build, or release evidence. Duration was 430,076.0838 ms.

The same wrapper then completed all ten serial release-surface shards with
23/23 tests passing. Run identity
`6441867358a44736261f1b0e20a651520b405a249566b5a1f198c0ef3c80f1b2`
has a 3,995-byte aggregate receipt at SHA256
`f727cb46b1afe71ecec900385b6a194b17b8d59d4819d7a46b6a2118e0d03ea0`.
The aggregate binds the exact source commit and tree, profile, partition,
runner, test file, Node executable and version, environment, implementation
closure, tool identities, ten shard receipts, 23 tests, and `pass` verdict.
All logs and receipts remain outside source control in immutable private
evidence storage.

These are mechanism tests. Test-only in-process dependency injection remains
marked and cannot authorize campaign evidence.

## Next Attempt

The implementation cut is committed and exact across local `HEAD`, tracking,
and the direct remote ref at
`7a70834120238ff6bf3ce32439b4064ea9223230`; the complete clean-source gate
above passed from that exact revision. Commit, push, freshly fetch, and prove
the documentation/UAI evidence checkpoint exact before proceeding.

Execution `/8` must then begin with a new output-free preregistration that
binds the exact descendant source revision and wholly new absent private
request, control, target, environment, managed, composition, evidence, and
output names. Its Rust command must build both the converter and
`tinyrustlm-build-scratch-inspect` in its one custody child. No `/8` request or
root may exist before that registration is remote exact.

## Claim Boundary

This checkpoint proves only the current junction-qualified custody mechanism.
It does not prove a new real build, converter, composition, SLM2 artifact,
native runtime, browser WASM parity, conversation quality, P2P availability,
deployment, publication, or catalog admission. MemoryEndpoints remains
unauthorized and disconnected. Campaign counters remain qualified models
`0/20`, clean browser rounds `0/50`, live memory rounds `0/25`, externally
proven lanes `0/40`, and announced models `0/20`.
