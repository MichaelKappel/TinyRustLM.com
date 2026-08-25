# Source-Controlled Build Custody Owner

Date: 2026-08-25

Status: historical implementation record for build-custody profile `/1`.
Current source has cleanly replaced this authority with profile `/2`; no
current reader, alias, migration, fallback, or compatibility path consumes
profile `/1`. This document remains only to explain immutable executions `/5`
and `/6`. See
`2026-08-25-environment-bound-build-custody-owner.md` for current authority.

## Decision

TinyRustLM now has one source-controlled Windows x64 build-custody owner for
irreversible prelaunch build attempts. It replaces operator-local process
wrappers for future registered composition builds. It does not reinterpret or
repair execution `/4`, whose unknown child exit status remains terminal.

The sole profile is
`contracts/vnext/build-custody-profile.v1.json`, 3,407 canonical LF bytes at
SHA-256
`589883f42c1e047dfa6e132c8c4937c05d23b936ae1a6f62fe41c91b672a82fa`.
The implementation is `tinyrustlm/tools/build-custody-owner.js`, 51,785 bytes
at SHA-256
`ed2e4d8dddee8914456aa52a59b18a2cc6febec3a9258b18df7868604af56ef9`.

This is the only current prelaunch contract. It has no legacy reader,
compatibility mode, migration, alias, fallback, retry, resume, cleanup,
candidate adoption, or stale-output selection path.

## Defect Closed

Execution `/4` launched one registered Cargo build, then its external
PowerShell observer queried unavailable exit-time metadata before saving the
child exit code. Cargo's final text and one x64 PE candidate could not replace
the missing process result. The build therefore became terminal evidence, not
a reusable candidate.

The new owner makes the process result the first post-process durable fact.
It listens to the child `exit` event and writes a create-only, fsynced
`build.process-terminal.json` before it closes log files, queries optional
metadata, inventories outputs, checks PE headers, hashes artifacts, or emits an
overall decision. Optional diagnostics can fail without erasing or changing
the captured process exit.

## Canonical Request

The owner accepts exactly one canonical JSON request schema,
`tinyrustlm.build-custody-request.v1`. Unknown, missing, reordered, extended,
noncanonical, oversized, or malformed material fails before a root or child
process is created. The request binds:

1. operation ID and sole custody profile identity;
2. exact clean source repository, branch, commit, and tree;
3. exact hashed Git executable used for source verification;
4. exact committed custody-owner and profile files;
5. exact Node path, bytes, version, platform, and architecture;
6. exact command path, bytes, arguments, working directory, and environment;
7. two absent direct sibling roots outside the source tree;
8. bounded duration and separate stdout/stderr byte ceilings;
9. exact system `taskkill.exe` identity and tree-termination strategy; and
10. bounded target entry and aggregate-byte limits plus sorted required-output
    paths, kinds, and individual byte ceilings.

The request is path-bearing private control material and must remain outside
Git. Public evidence may bind its hash but must not disclose private paths.

## Process And Persistence Order

One successful preflight is read-only. Execution then follows this order:

1. revalidate every request, source, runtime, command, and root invariant;
2. create the absent control root directly;
3. write and fsync `build.binding.json` create-only;
4. create the absent target root directly;
5. write and fsync `build.start.json` create-only with launch ordinal `1`;
6. open separate create-only bounded binary stdout and stderr files;
7. create exactly one child with `shell: false`, ignored stdin, and the exact
   registered environment;
8. on overflow or timeout, invoke the exact hashed system `taskkill.exe` with
   `/PID`, `/T`, and `/F`, then attempt a direct parent kill;
9. on child exit, immediately write and fsync the immutable process-terminal
   record;
10. on stream close, fsync and hash both bounded raw logs and reconcile final
    overflow, timeout, stream, exit, and close state;
11. only after a clean zero exit, collect optional diagnostics, revalidate all
    identities, traverse the bounded direct target tree, stream-hash required
    files, and validate required x64 PE headers; and
12. write one create-only `build.terminal.json` as `pass`,
    `terminal-build-failure`, or `terminal-custody-failure`.

Every created root remains immutable history. A collision is terminal and is
never overwritten. A failed operation cannot be retried, resumed, cleaned,
repaired, or used as a candidate source.

## Exact Windows Environment

Node/libuv copies selected Windows variables from the ambient parent when
they are absent from a supplied environment block. That behavior would make a
nominal two-entry allowlist larger than the registered request.

The custody owner is a dedicated process, so it closes this boundary during
process creation: it snapshots its ambient environment, clears it, installs
only the exact requested entries, synchronously creates the child with that
same environment object, and immediately restores the owner in a `finally`
block. The same mechanism isolates the exact Git verifier, termination helper,
and detached worker launch. A hostile test proves that an unrequested parent
sentinel does not reach the build child.

The detached worker itself receives only `SystemRoot`, derived from the exact
registered system `taskkill.exe` path. It runs the same committed owner bytes
under the same exact Node runtime. The CLI observer may be killed without
killing or invalidating that worker.

## Evidence Family

Every started operation owns these six create-only files:

- `build.binding.json`
- `build.start.json`
- `build.stdout.bin`
- `build.stderr.bin`
- `build.process-terminal.json`
- `build.terminal.json`

The binding embeds the canonical request and its hash but is private because
the request contains paths. The public summary contains only bounded IDs,
status, typed code, process-start observation, exit code, log byte counts,
required-output count, retry prohibition, and campaign-credit prohibition.

An overall `pass` requires all of the following: a durable process-terminal
record, one observed process start, exact `exit`/`close` agreement, exit code
zero, no signal, timeout, overflow, spawn error, stream error, or capture-close
error, unchanged source/tool identities, a bounded non-reparse target tree,
and every required output present with its exact streamed hash and required PE
machine where applicable.

## Fault Evidence

`tinyrustlm/tests/build-custody-owner.test.js`, 22,357 bytes at SHA-256
`f527a7715b62499fa25a0c0a8cf4ea51ee86e9724800a6b0072336b002abd3ca`,
uses the committed helper
`tinyrustlm/tests/helpers/build-custody-child-fixture.js`, 2,172 bytes at
SHA-256
`416d35db9c0e5ffd42b4f0b0038151616a6d71f6306c60d98c3ed1cb6420f4fb`.
The focused Windows x64 gate passes 14 of 14 tests and covers:

- frozen profile identity and clean-slate authority;
- canonical shape, field order, unknown fields, and byte representation;
- read-only exact Git/source/Node/command/taskkill preflight;
- zero exit captured before diagnostics and exact output inventory;
- nonzero terminal build failure;
- stdout overflow discovered after the early exit record;
- timeout plus real Windows descendant-tree termination;
- spawn failure without invented exit data;
- missing optional exit-time-style metadata after durable zero exit;
- missing output and total target-entry overflow;
- exact child-environment isolation;
- real x64 PE machine and hash validation;
- existing-root and final-terminal collision refusal; and
- detached completion after forced CLI-observer termination.

The fixture and all temporary Git/control/target roots are test-only and do
not authorize real composition or campaign evidence.

## Use For A Future Composition Attempt

A fifth composition attempt may be designed only after this owner, profile,
tests, and record are committed, pushed, freshly fetched, and proven exact.
That future registration must bind the resulting source commit/tree and exact
owner bytes, bind execution `/4` as immutable predecessor evidence, and name
six wholly new roots proven absent before registration: separate custody
control and target roots for the Rust build, separate custody control and
target roots for the managed build, one controller-evidence root, and one
composition-output root. A custody control root becomes immutable when its
build terminal is written and therefore cannot double as later controller
evidence. No `/4` root or candidate executable may be adopted.

The future private request must then be materialized canonically outside Git,
preflighted without creating roots, and executed once. A custody `pass` proves
only the registered build and required binary output. It does not authorize a
converter launch until the composition registration's subsequent gates also
pass.

## Claim Boundary

This implementation proves a tested build-evidence mechanism. It does not
prove that a real Rust or managed build has passed under it, that composition
has run, that an SLM2 artifact is structurally valid, that native or browser
WASM inference is correct, that a model is useful, that P2P acquisition works,
that a website or package is published, or that any MemoryEndpoints or
campaign requirement is satisfied.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
