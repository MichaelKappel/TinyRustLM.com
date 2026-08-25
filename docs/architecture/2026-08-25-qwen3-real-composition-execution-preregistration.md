# Qwen3 Real Composition Execution Preregistration

Date: 2026-08-25

## Decision

TinyRustLM will perform one real complete-composition conversion under an
output-free, zero-retry execution registration. The registration is
`contracts/vnext/qwen3-real-composition-execution-preregistration.v1.json`.
It is 16,006 canonical bytes at SHA-256
`46a9da74eb6b811257d2cc3a433055d4859fb7bbdfeef22e1c6ee8c2bd978a6a`.

The registration parent is remote-exact source commit
`104873f0e69d495eb05a56c2c4bcdf694daabc8e`, tree
`f77ca3dc5765d5f6b7394dc6eb0ebba766cc6ede`, on
`codex/model-acquisition-v2`. The worktree was clean. The registered build,
private-evidence, and output logical roots were absent. No Cargo build, private
binding, converter process, composition member, pass, rejection, runtime
output, browser output, quality result, P2P result, or publication result
existed when the profile was written.

The profile, this decision, its executable contract test, and the contract
index update must be committed, pushed, fetched, and proven remote-exact before
the build starts. The registration commit is allowed to change only those four
paths. The eventual build source commit and tree are captured after that
remote-exact registration, which avoids placing a circular future commit hash
inside the registration itself.

## Product Boundary

TinyRustLM remains one prelaunch product. SLM2, Tokenizer2, Template2,
Sampling2, Prompt2, ACG2, profile revisions, and this execution profile are
technical identities, not product generations.

There is no legacy reader, compatibility path, migration writer, alias,
fallback, response repair, automatic retry, manual retry under this
registration, best-of-N selection, or failed-output cleanup. If the build or
execution cannot reach its registered terminal state, a later attempt requires
a new registration and new logical roots. Existing evidence is never deleted,
overwritten, repaired, resumed, or relabeled.

## Exact Inputs

The execution binds three public content authorities:

1. `qwen3-0.6b-base-source-lock.v1.json`, 1,901 bytes, SHA-256
   `e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d`;
2. `qwen3-0.6b-tokenizer2-source-lock.v1.json`, 1,108 bytes, SHA-256
   `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70`;
   and
3. `qwen3-composition-conversion-profile.v2.json`, 8,835 bytes, SHA-256
   `d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718`.

The source is `Qwen/Qwen3-0.6B` revision
`c1899de289a04d12100db370d81485cdf75e47ca`. The model closure contains
exactly nine direct regular files and 1,519,207,688 aggregate bytes. The
tokenizer closure contains exactly five direct regular files. The roots are
distinct because their converters own different exact inventories. Both locks
must agree on model ID, immutable revision, and all five shared file records;
their architecture profiles are intentionally distinct and must equal the
registered compatible pair.

The public registration includes no machine-local source or output path. Those
paths belong only in the later private binding. The unchanged upstream base
remains terminally rejected as a product model. This execution is permitted
only for conversion/runtime parity and derivative ancestry.

Accepted Tokenizer2 and Template2 observations are not rerun. The complete
transaction may reconstruct their already bound bytes through the canonical
owners as part of creating one new complete composition; it may not replace or
overwrite prior private evidence.

## One Release Build

The sole build command is:

```text
cargo build --locked --release -p tinyrustlm-convert --target x86_64-pc-windows-msvc
```

The build runs from the repository root with exact environment values
`CARGO_INCREMENTAL=0`, `CARGO_NET_OFFLINE=true`, and `CARGO_TARGET_DIR` set to
the private absolute build root. That root must be absent under an existing
direct non-reparse parent before Cargo starts. Build stdout and stderr are
separate bounded create-only private evidence.

The toolchain is rustc 1.96.0 commit
`ac68faa20c58cbccd01ee7208bf3b6e93a7d7f96`, Cargo 1.96.0 commit
`30a34c682`, host and target `x86_64-pc-windows-msvc`, and LLVM 22.1.2.
`Cargo.lock` is 25,336 bytes at SHA-256
`8e8eabd73ac02275235576743a19b84bee0250ef4ce24986e4bcce7a3704c8a6`.
The profile also freezes ten material Rust, managed-inspector, manifest, and
lockfile sentinels from the parent tree.

The build attempt limit is one. A failed build creates no conversion attempt
and closes this registration. It is not silently retried.

## Future Executable Capture

The expected build member is
`x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe` under the private Cargo
target root. After the build succeeds and before any launch, the controller
must prove that it is a direct regular non-reparse PE x86-64 file, record its
length and streamed SHA-256, and bind it to the captured registration commit,
tree, Cargo lock, build command, and toolchain.

The executable is rehashed immediately before launch and after process exit.
Any drift is terminal. The registration intentionally cannot contain the
future executable hash; it closes that identity through the required private
binding after build and before launch.

## Private Execution Binding

The private evidence root is created outside Git only after the registered
build succeeds. Its create-only `execution.binding.json` has schema
`tinyrustlm.qwen3-real-composition-private-binding.v1`. It contains private
absolute paths and must never enter Git, public reports, screenshots,
telemetry, or public error text.

The bounded canonical binding records:

- the public profile path, bytes, hash, registration commit/tree, branch, and
  fresh-remote equality;
- the exact source anchor and captured build source commit/tree;
- build root, command, environment, separate build-log identities, executable
  path/length/hash/PE machine, and toolchain;
- both source-lock paths and hashes, both distinct source directories and
  exact inventories, and the corrected composition profile identity;
- exact executable, argument order, working directory, absent output root,
  separate converter stream paths, duration and stream bounds, one launch,
  no retry, and terminal rule; and
- a final preflight proving source bytes and tree types, output absence,
  source/output nonoverlap, evidence-file absence, executable identity, and
  remote-exact registration.

The binding is created once after executable capture and before process launch.
An existing file is accepted only when its bytes are exactly equal before any
launch. It is never overwritten or deleted.

## One Invocation

The invocation is the captured executable, command `qwen3-composition`, and
exact absolute operands in this order:

1. model source lock;
2. model source directory;
3. tokenizer source lock;
4. tokenizer source directory; and
5. absent output root.

The maximum duration is 43,200,000 milliseconds. Stdout is bounded to 65,536
bytes and stderr to 4,096 bytes. The private controller writes a create-only
start record after binding and before launch, launches exactly one process,
captures the streams separately, hashes them, records the exit code, and never
adopts or kills an unknown process. A partial root is terminal evidence and is
not cleanup material.

## Terminal Decision

A pass requires exactly one launch, exit zero, empty stderr, a bounded strict
CLI summary, native pass without native rejection, exact ten-file success
inventory, rehash and canonical reparse of all six artifacts, managed durable
inspector pass, unchanged executable after exit, and create-only private
terminal and verification records.

A rejection requires absence of native pass, a strict native rejection and
attempt lineage, managed durable inspector rejection, preserved partial
output, and create-only private terminal and verification records.

No valid mutually exclusive native terminal evidence is ambiguous. Ambiguous
is neither pass nor retry authorization. The root and all evidence remain
untouched. Another attempt, if deliberately approved, requires another public
registration and different logical roots.

## Claim Boundary

This checkpoint proves only that one exact real execution is registered before
its build and output. It does not prove that the build completed, a private
binding exists, the converter ran, a composition exists, source-framework
parity, native inference, browser-WASM inference, browser chat, quality, P2P,
catalog announcement, package publication, deployment, MemoryEndpoints, or any
campaign counter.

MemoryEndpoints remains unauthorized and disconnected. Counters remain 0/20,
0/50, 0/25, 0/40, and 0/20.

## Next Operation

1. Commit the four registered paths without any other change.
2. Push, fetch, and prove local, tracking, `FETCH_HEAD`, and actual remote
   equality.
3. Capture the registration commit/tree and verify its allowed path diff.
4. Create one private build root and run the exact offline release build once.
5. Capture the future executable and create the exact private binding.
6. Revalidate every input and absence rule, then write the start record.
7. Invoke the converter exactly once and preserve every byte and terminal fact.
8. Independently inspect the terminal output and create a bounded public-safe
   result only after the private terminal decision is complete.

