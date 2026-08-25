# Qwen3 Execution /6 MSVC Linker Environment Failure

Date: 2026-08-25

Status: immutable terminal Rust build failure; no retry, cleanup, adoption, or
later `/6` operation is authorized

## Decision

Qwen3 complete-composition execution `/6` is closed as
`terminal-rust-build-failure`. The sole registered Rust custody child started,
returned exact exit code `101`, and produced a create-only terminal with code
`build-custody-child-nonzero`. The registered command environment did not
contain an MSVC linker parent. This is a request-environment defect, not proof
of a Rust source, converter, model, or custody-owner defect.

The bounded public result is
`contracts/vnext/qwen3-real-composition-execution-result.v6.json`, 6,644
canonical LF bytes at SHA-256
`58d6ce16304d804d3a09cfd2c6544e8fa10b39080359040383df3f2ac68bb72c`.
It contains no private path, raw log, credential, model byte, or prompt.

## Registration Authority

The output-free `/6` registration was committed at
`701d770c0ff1f1ca5fa573610f9fb532dd6af793`, tree
`e756ffaddb9fa76e256f6bc83e9b025bcd5561c3`. Local HEAD, tracking, fresh
`FETCH_HEAD`, and direct remote were exact before private materialization.
The commit was a single-parent descendant and changed only the four registered
public paths.

All six private roots and three request filenames were absent after that
remote proof. The Rust request was then written create-only and fsynced. It is
5,569 private bytes at SHA-256
`57a41f877be767e55c34aeb05211761de658f53590d6cdcc6f4faa3237dec70c`.
Its read-only preflight passed once while both Rust custody roots remained
absent.

## One Custodied Build

The custody owner was invoked once with operation
`qwen3-composition-v6-rust-build`. It created the registered control and target
roots, wrote the binding and start records, opened separate bounded binary
stdout and stderr files, and started one direct Cargo child.

The process-terminal record was written and fsynced from the child exit event
before optional diagnostics or output inventory. It records:

- process started and process ID observed;
- start `2026-08-25T13:16:07.313Z`;
- exit `2026-08-25T13:16:08.472Z`;
- exact exit code `101` and no signal;
- no timeout, overflow, spawn error, stream error, or termination action; and
- retry authorization false.

The final custody terminal is 2,209 bytes at SHA-256
`0f332516a5a0637021314247cb35dc1c0d4b5c19c3f49d0c5e2ce42baf667c8a`.
Its status is `terminal-build-failure`, not custody ambiguity. This confirms
that the source-controlled owner corrected the earlier `/4` exit-capture
defect: nonzero status is direct process evidence rather than inferred from
logs or output files.

## Root Cause

Raw stderr remains private. Its 1,402 bytes are bound by SHA-256
`1e088c4cd8c16d71ecec3d73b0db8b93d9afdd3df75a61eaea3fbc19615d38bc`.
The bounded semantic observation is that Rust could not locate `link.exe` for
the `x86_64-pc-windows-msvc` target.

Independent read-only inspection established:

- the exact registered command `PATH` had 35 entries;
- zero registered entry contained `link.exe`;
- an installed MSVC x64 linker exists outside that environment;
- Cargo, Rustc, linker, and converter process count was zero after terminal;
  and
- no source or converter failure was reached.

Therefore the stable root-cause code is
`msvc-linker-not-found-in-registered-command-environment`. The private request
materializer selected an incomplete environment. Cargo, Rustc, source code,
the converter, and the custody owner are not exonerated beyond what this early
failure actually exercised, but no defect in them was established by `/6`.

## Preserved Evidence

The Rust custody control root contains exactly six evidence files: binding,
start, stdout, stderr, process terminal, and final terminal. Their lengths and
hashes are bound in the public result. Stdout is exactly empty. Raw logs and
path-bearing records remain private.

The Rust target root contains 102 files in 85 directories, totaling
10,527,012 bytes with zero observed reparse points. It is partial compiler
state, not a successful build or candidate artifact. It remains immutable and
cannot be selected, adopted, copied into a later target, cleaned, or relabeled.

No managed custody request, managed custody root, managed target, composition
request, controller evidence root, composition output root, execution binding,
converter process, managed inspection, composition artifact, or private
execution verification was created. The latter is correctly absent because
the registered verification record occurs only after a controller terminal,
and no controller was authorized.

## Required General Correction

A later attempt requires a new output-free registration and wholly new private
logical names. Before that registration, the build environment contract must
be made linker-complete rather than relying on ambient developer-shell state.
At minimum it must:

1. discover one exact installed x64 MSVC toolchain and Windows SDK without
   selecting mutable `PATH` state;
2. bind the exact `link.exe` path privately and its byte length and SHA-256
   publicly;
3. bind the exact required MSVC and Windows SDK library directories and the
   environment variables needed by Rustc/linker invocation;
4. reject missing, reordered, duplicated, reparse, stale, or non-x64 tool and
   library roots before request creation;
5. assert that the command environment resolves the registered linker and no
   different linker;
6. keep every writable build, temporary, and output location off `D:` and
   inside approved private custody boundaries;
7. preregister the source-controlled materializer/validator and its hostile
   tests before any new request exists; and
8. retain exact no-retry, no-cleanup, no-adoption, and one-child custody rules.

Testing an unregistered build to find an attractive environment is not
allowed. The correction must be designed and frozen before the next observed
build.

## Claim Boundary

`/6` proves one honest registered build attempt and one exact terminal failure.
It proves no successful Rust build, managed build, converter invocation,
complete composition, source-framework parity, native runtime, browser WASM,
browser chat, model quality, P2P availability, package publication, catalog
announcement, site deployment, or MemoryEndpoints operation. MemoryEndpoints
remains unauthorized and disconnected. Campaign counters remain `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.

Attempt numbers are immutable technical evidence identities. They are not
product generations. TinyRustLM remains one unversioned prelaunch product with
no legacy support, compatibility path, migration, fallback, repair, temporary
patch, or accepted debt.
