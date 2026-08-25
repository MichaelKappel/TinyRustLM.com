# Environment-Bound Windows X64 Build Custody

Date: 2026-08-25

Status: current prelaunch implementation, fault-tested on Windows x64, not yet
used by a new real Qwen3 composition execution

## Decision

TinyRustLM has one current source-controlled owner for irreversible Windows x64
build attempts. Build custody now consumes the separately materialized,
content-bound MSVC environment authority instead of accepting a caller-defined
full environment. This is a clean prelaunch replacement of build-custody
profile `/1`, not a compatibility revision and not a second product version.
The deleted `/1` source bytes remain available only through Git and immutable
attempt evidence. No current parser, selector, alias, migration, fallback,
retry, repair, cleanup, resume, or candidate-adoption path accepts them.

The sole current profile is
`contracts/vnext/build-custody-profile.v2.json`, 7,153 canonical LF bytes at
SHA-256
`7d8b82ac9bb7cab6d5373f60d3c8f78874e86e3540f788ac018e0f5f22d90916`.
The owner is `tinyrustlm/tools/build-custody-owner.js`, 80,293 bytes at SHA-256
`2000ff2c355d744c9fb4e8d2cc4765858a10184f4b7cf60b6f61960daaa3d637`.

The environment inputs are frozen independently:

- `contracts/vnext/windows-x64-msvc-environment-profile.v1.json`, 6,510 bytes,
  SHA-256
  `76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607`;
- `tinyrustlm/tools/windows-x64-msvc-environment.js`, 54,052 bytes, SHA-256
  `48b550da9fa0a81735467d2af6dc733fa5ba2df4e9f815e505c37b57bfdb4ebf`.

This authority closes the defect exposed by immutable execution `/6`: the
registered Rust command omitted every parent containing `link.exe`, so Cargo
exited 101 before a converter could exist. The new mechanism does not repair,
retry, clean, adopt, or reinterpret `/6`. It prevents the same class of future
request defect by deriving and validating the build environment from an exact
toolchain closure before authorizing a new child.

## Canonical Request

The owner accepts exactly one canonical JSON document with schema
`tinyrustlm.build-custody-request.v2`. Unknown, missing, reordered, extended,
noncanonical, oversized, or malformed input fails before any custody root or
child process is created. The request binds:

1. one operation ID and the exact current custody profile;
2. one clean repository root, branch, commit, tree, and exact Git executable;
3. the committed custody owner and profile at that same source commit;
4. exact Node executable bytes, version, platform, and x64 architecture;
5. six exact environment-authority artifacts: owner, profile, request, private
   binding, public-safe lock, and terminal;
6. one exact build executable, ordered arguments, working directory, and
   sorted supplemental environment;
7. absent sibling control, target, and environment-scratch roots outside the
   source tree and every bound input;
8. bounded duration and independent binary stdout/stderr ceilings;
9. exact `taskkill.exe` identity and Windows tree-termination strategy; and
10. bounded target and environment-scratch inventories plus sorted required
    outputs and their file or x64 PE kinds.

The environment request and all materialized environment outputs must be
regular direct files outside the source, working directory, custody roots, and
prohibited `D:\` tree. Their paths must be distinct. The environment owner and
profile must be committed at the requested source commit and must match their
frozen byte identities.

## Environment Authority

The six bound artifacts are accepted only when all cross-record identities,
schemas, operation IDs, target triples, selected toolchain records, and
terminal status agree. The terminal must be `pass` with code
`msvc-environment-materialized`. The private binding supplies the exact sorted
environment entries; callers cannot supply or replace those entries.

Production validation launches the exact request-bound Node binary in a fresh
process and invokes the exact request-bound environment owner with `validate`.
That owner re-discovers the installed Visual Studio and Windows SDK selection,
re-inventories and rehashes every selected tool and library root, validates PE
and archive structure, reconstructs command resolution, and requires byte-
exact equality with the materialized private binding, public lock, and
terminal. Validation output must be canonical, bounded, stderr-free pass JSON.

Fresh-process validation is deliberate. Windows process creation may inject a
small OS baseline when an explicit environment omits it, while destructive
mutation of the current Node process environment interferes with Visual Studio
discovery. The production owner therefore never mutates global `process.env`.
It starts every verifier and build child with an explicit environment and uses
no ambient worker values for custody decisions.

The full closure is validated at three mandatory points:

1. preflight and again inside the worker before the control root exists;
2. immediately before the one build child is launched; and
3. after every child outcome, including nonzero exit, timeout, overflow,
   process error, or spawn failure.

Environment drift is a custody failure and takes precedence over the child
outcome. A nonzero process result cannot hide a changed compiler, linker, SDK,
library, owner, profile, or environment record.

## Exact Build Environment

The authority exclusively owns `PATH`, `LIB`, `LIBPATH`, and
`CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER`. A request entry that overlaps any
authority name case-insensitively is rejected. The request may add a bounded,
sorted set of nonoverlapping build controls, such as exact offline Cargo and
target-directory settings. Every request must also include these ten Windows
baseline names:

- `HOMEDRIVE`
- `HOMEPATH`
- `LOGONSERVER`
- `SYSTEMDRIVE`
- `SystemRoot`
- `TEMP`
- `USERDOMAIN`
- `USERNAME`
- `USERPROFILE`
- `WINDIR`

`SystemRoot` and `WINDIR` must equal the system root independently bound by the
environment authority and the registered `taskkill.exe` path.
`SYSTEMDRIVE`, `HOMEDRIVE`, and `HOMEPATH` are cross-validated from their
absolute targets. `LOGONSERVER`, `USERDOMAIN`, and `USERNAME` must be nonempty.
`USERPROFILE` must be exactly `<environmentRoot>\home`; `TEMP` must be exactly
`<environmentRoot>\temp`. All authority and supplemental entries are merged in
uppercase-name order, bounded, canonically hashed, and supplied directly to the
build child. This admits no caller-provided full ambient environment.

The detached worker receives only the fixed Windows-injected name set measured
for this boundary: the ten names above plus `PATH`. Custody records their
sorted names and hash but never consumes their ambient values. The worker
reconstructs the build child environment solely from the request-bound
authority evidence and supplemental values. A caller-only sentinel is proven
absent from the child.

In-process dependency injection exists only in `runWorkerForTest`. Its terminal
is marked `testOnlyInProcess: true`, its ambient names are redacted from the
binding, and the profile explicitly forbids treating it as campaign evidence.
The production `runWorker` accepts no dependency argument and requires the
constrained detached-worker environment.

## Root And Process Custody

The control, target, and environment roots must be absent direct siblings under
an existing non-reparse parent. They must not overlap one another, source,
working directory, environment evidence, executable inputs, or `D:\`. After
the immutable binding is written, the owner creates the target root and the
environment root with exactly `home` and `temp` children. All writes are
create-only.

The one authorized build has `shell: false`, ignored stdin, explicit cwd and
environment, and independent bounded binary stdout/stderr files. On timeout or
overflow, the owner invokes the exact hashed `taskkill.exe` for the process
tree and then directly kills the child. It records the child exit event before
optional ExitTime-style diagnostics and fsyncs
`build.process-terminal.json` before inspecting outputs. Stream-close state,
late overflow, timeout, signal, process error, spawn error, and termination
outcome are reconciled without manufacturing an exit code.

Only a clean zero exit can reach output inspection. The owner then rehashes the
source, Git, owner, profile, environment owner/profile, Node, command, and
termination executable; proves the source tree is still clean and exact;
walks bounded non-reparse target and scratch trees; stream-hashes each required
output; and validates `0x8664` for required x64 PE files. The scratch root must
retain exactly its two top-level directories. One create-only
`build.terminal.json` records `pass`, `terminal-build-failure`, or
`terminal-custody-failure`.

Every created root is immutable attempt history. A collision, interruption,
failure, or obsolete attempt cannot be overwritten, retried, resumed, cleaned,
repaired, selected, or adopted.

## Evidence And Privacy

The private control root contains exactly these evidence roles:

- `build.binding.json`
- `build.start.json`
- `build.stdout.bin`
- `build.stderr.bin`
- `build.process-terminal.json`
- `build.terminal.json`

The records preserve exact paths and environment values because they are
private custody evidence. The public summary exposes only bounded status,
error code, request and terminal identities, process facts, stream sizes,
required-output count, scratch counts, environment-validation truth, and the
public-lock hash. It does not expose private paths, environment values, raw
logs, prompts, credentials, or model bytes.

## Fault Evidence

`tinyrustlm/tests/build-custody-owner.test.js` is 44,900 bytes at SHA-256
`39437a04162dcecfba38616c20e9985f91386b51848ec35726a3abdc96ee7069`.
Its committed child fixture is
`tinyrustlm/tests/helpers/build-custody-child-fixture.js`, 2,366 bytes at
SHA-256
`3fa831458e87515fbdb9a9cc9bd2ddf05a5d9bb196d1ed887ca3ade0f5f4361b`.
The focused Windows x64 gate passes 17/17 tests and covers:

- frozen clean-slate profile identity;
- canonical request shape, field order, and byte representation;
- read-only preflight and exact source/tool binding;
- environment-record cross-binding and authority-name overlap rejection;
- zero-exit durability and required-output inventory;
- immutable nonzero process failure;
- late stdout overflow;
- timeout with descendant-tree termination;
- spawn failure without an invented exit;
- prelaunch environment drift before child launch;
- post-child drift precedence over a nonzero exit;
- optional diagnostic failure after durable zero exit;
- missing outputs and target entry overflow;
- absence of an unrequested caller environment variable in the child;
- exact x64 PE validation after zero exit;
- existing-root and final-terminal collision rejection; and
- a real installed Visual Studio 2022 closure, a directly constrained worker,
  detached owner completion after forced observer termination, and public-safe
  observation.

The standalone environment authority also passes its 8/8 synthetic suite and
its explicit 1/1 installed-toolchain observation. These tests establish the
mechanism and current-machine closure only. They create no registered build,
composition, browser, quality, P2P, publication, or campaign evidence.

## Next Registered Attempt

A new technical execution `/7` may be preregistered only after this profile,
owner, tests, documentation, and UAI state are committed, pushed, freshly
fetched, and proven byte-identical across local `HEAD`, tracking ref,
`FETCH_HEAD`, and remote ref. The registration must bind that exact clean
source commit and all final owner/profile/environment identities, use wholly
new absent roots and request filenames, and materialize a new canonical private
request outside Git.

The attempt may invoke each registered custody operation once. A custody
`pass` proves only that exact build and its required outputs. It does not prove
conversion, SLM2 structure, runtime behavior, browser inference, model quality,
P2P availability, deployment, publication, or any campaign counter. Historical
`/6` requests, roots, partial target, or candidate files cannot be reused.

## Claim Boundary

This checkpoint proves one current, deterministic, environment-bound custody
mechanism and its Windows x64 fault behavior. It does not authorize
MemoryEndpoints, and it leaves campaign progress at qualified models `0/20`,
clean browser rounds `0/50`, live memory rounds `0/25`, externally proven P2P
lanes `0/40`, and catalog announcements `0/20`.
