# Qwen3 Execution `/8` Managed Build Failure

Date: 2026-08-25

Status: immutable terminal managed-build failure; no retry, cleanup, output
adoption, composition request, controller, converter invocation, or later
`/8` operation is authorized

## Decision

Qwen3 complete-composition execution `/8` is closed as
`terminal-managed-build-failure`. Its registered environment authority passed.
Its sole Rust custody operation passed and qualified both the source-built x64
scratch inspector and x64 converter. Its sole managed custody child then exited
with code `1` before any required managed output or managed scratch inspection
could qualify.

The bounded public result is
`contracts/vnext/qwen3-real-composition-execution-result.v8.json`, 16,999
canonical ASCII/LF bytes at SHA-256
`9caa23225dfa2b0e01f4bfd550c0a4cf178d4d7db2f301159f0e2b040dd94f40`.
It contains no private absolute path, raw stream, credential, model byte, or
prompt. Private requests, roots, streams, terminals, build products, and
scratch evidence remain outside Git and are preserved without modification.

The observed .NET diagnostic class is an assets-lock read failure with code
`NETSDK1060` and exception parameter `path1`. That observation does not prove
whether the underlying cause is source, project configuration, stale restore
state, the registered minimal child environment, the .NET SDK, or another
boundary. The result therefore sets `rootCauseEstablished` to `false`.

## Remote-Exact Registration

The output-free `/8` registration is 61,969 bytes at SHA-256
`4a7e255c500ef87e3ddac4d7befb7331232167e7bcf47aae6cdabfbd752fec21`.
It was committed at
`2a0e175daee7bd2810eab74f5daeeb0c7eda0aa3`, tree
`37fc4adb26bc8c40229a81a038dcc1b9021014f0`, on
`codex/model-acquisition-v2`. Local `HEAD`, the tracking reference, fresh
`FETCH_HEAD`, and the branch advertised directly by the remote were equal
before any `/8` private byte existed. All 15 registered names were distinct
and absent.

The source remained at that exact commit and tree through environment
materialization, both custody requests, both preflights, and both build
operations. No source edit, dependency update, output repair, or preferred
result selection occurred during execution.

One pre-owner PowerShell guard used a stale remembered Node hash and rejected
before invoking the environment owner. It created no environment output and
did not modify the already immutable request. The committed registration
itself pinned the current Node bytes correctly. A profile-derived guard then
verified the exact bytes and invoked the environment owner once. The public
result records the rejected observation separately so it cannot be mistaken
for a materializer invocation or hidden retry.

## Exact MSVC Authority

The canonical environment request is 1,546 private bytes at SHA-256
`492990407ef21fc7a78f6a9969de5fa5d4480208dd35b8d048b41d06158b9b72`.
The committed owner materialized it once and returned status `pass` with code
`msvc-environment-materialized`. It selected:

- Visual Studio product line `2022`;
- installation `17.14.37531.7`;
- MSVC toolset `14.44.35207`;
- Windows SDK `10.0.26100.0`; and
- target `x86_64-pc-windows-msvc`.

The create-only private binding, public lock, and terminal are respectively
9,878, 157,301, and 2,016 bytes. Their SHA-256 identities are:

- private binding:
  `2c44d4b2818c099822e06e34fe8eb4303112d6834348c791e8760d0a750ef660`;
- public lock:
  `142a1cece889583a7395dad451659046ad23dd9edd23e3bb9635eef463ca8059`;
  and
- terminal:
  `2637d4a2506776303cc1f783557a58137003a722783410a41ec4f789137ecf51`.

The authority regenerated without drift during Rust initial validation,
immediately before the Rust child, after the Rust child, after Rust scratch
inspection, during managed initial validation, immediately before the managed
child, and after the managed child. No managed post-scratch validation exists
because the managed child failed before that registered stage.

## Passing Rust Custody `/3`

The canonical Rust custody `/3` request is 7,241 private bytes at SHA-256
`77c761cec48297393b2b3f366afa21af0c3b3db48ef0912f5d06c2fc6a69ee64`.
It binds the remote-exact registration commit and tree, exact Git, Node, Cargo,
Rustc, taskkill, source owners, custody `/3`, scratch profile `/1`, shared MSVC
authority, 17-entry supplement, and three wholly new roots.

Its one read-only preflight passed while all three roots were absent. The
detached owner then executed once. The direct Cargo child started at
`2026-08-25T21:11:10.732Z` and exited at
`2026-08-25T21:11:35.524Z` with code `0`, no signal, timeout, overflow, spawn
error, stream error, or capture-close error. Stdout is empty. The 2,083 stderr
bytes remain private at SHA-256
`5481d2f1ae2d9488b966937c076249761e2aef58ed07e392faa9e974e4780895`.

The target inventory contains 487 entries: 398 files and 89 directories
totaling 126,921,175 bytes. Two required x64 PE outputs qualified:

1. `x86_64-pc-windows-msvc/release/tinyrustlm-build-scratch-inspect.exe`
   is 240,128 bytes at SHA-256
   `b038227799d03f322eb1b7ce55abe662b5ed1d481e37e282b186ecd545315c5c`.
2. `x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe` is 852,992 bytes
   at SHA-256
   `c90d963752f92c7de10866d071a9086334d5b80160de8815a508df2ff0a8d48c`.

The source-built helper ran exactly once. Its pre/post identity was stable,
stderr was empty, and the double no-follow inventory passed. It represented
the one contained same-root Windows known-folder junction without following
it. The observation contains 25 entries, one file, 23 directories, one
junction, zero aggregate file bytes, and inventory SHA-256
`9f3836d1d6cc4740fd6892e200fd1d59506361d9021f056577a71210a05e8a96`.

Rust custody therefore passed. Its outputs remain evidence owned by `/8` and
were used only where `/8` explicitly authorized them. The later terminal
managed failure does not permit another registration to adopt those bytes.

## Terminal Managed Child

The canonical managed custody `/3` request is 8,264 private bytes at SHA-256
`b8df72cdcc98fb6a39ae64867d7e6006755067adac062198c45c228e5def0b89`.
It binds the same source and environment authority, exact Node and .NET host,
a fresh managed control/target/scratch triplet, offline and no-restore build
arguments, and the qualified Rust helper as the sole staging source.

Its read-only preflight passed with all three roots absent. The detached owner
then executed once. The direct .NET child started at
`2026-08-25T21:14:42.816Z` and exited at
`2026-08-25T21:14:46.073Z` with code `1`, no signal, timeout, overflow, spawn
error, stream error, or capture-close error.

The owner durably preserved:

- 1,103 stdout bytes at SHA-256
  `fac2be8048d0f8a7a02021ab0ef1f73f963b1c1ef0ffbdb415936e2f41e3c926`;
- 99 stderr bytes at SHA-256
  `04dde9e46b902240a204acfb0cd5283be410828f0b3e1dc7b8e5f2d40e97272b`;
- a 2,269-byte process terminal at SHA-256
  `b0e8ad635eb25232a4acf94874fc30a094c65bda466c1d047d5f17cfcf36820d`;
  and
- a 9,352-byte custody terminal at SHA-256
  `9498831a2ac26bf2904b7f1774bcde5b760f3b690879298192418a5bc6359470`.

The final custody status is `terminal-build-failure` with code
`build-custody-child-nonzero`. No target inventory or required-output
qualification occurred. The fixed-name helper is not qualified as a managed
output. Managed scratch inspection did not start. The managed roots and all
raw evidence remain preserved; none may be cleaned, overwritten, adopted, or
reinterpreted.

During the same managed-child interval, .NET created one untracked source-
worktree side effect: the zero-byte marker `NuGet/Migrations/1` under two new
directories. The marker was created at `2026-08-25T21:14:45.4534601Z`, has
SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e464b934ca495991b7852b855`,
and contains no publishable payload. It was moved intact to private quarantine
outside Git so the registered source worktree could return to a clean state.
The marker must never enter source control. Its timing proves an execution
side effect, not which environment, SDK, restore-state, project, or custody
defect caused either the marker or the build failure.

## Bounded Diagnosis

The private stdout reports .NET diagnostic `NETSDK1060` while loading the
existing project assets lock and identifies exception parameter `path1`. The
private stderr reports a workload-verification warning. The public result
retains only those bounded classes and the two raw stream identities.

A read-only post-terminal JSON inspection established only that the assets
document:

- parses as JSON version `4`;
- contains no explicit JSON null;
- names two package folders; and
- includes the package root bound by the managed request.

Those observations disprove neither stale or environment-sensitive restore
state nor a .NET SDK or project-boundary defect. They also do not implicate the
qualified Rust helper, which the managed child never staged. The stable public
reason code is
`managed-dotnet-child-nonzero-assets-lock-read-failure`, while
`rootCauseEstablished` remains `false`.

## Required General Correction

Before another model execution may be registered, development must:

1. preserve `/8` and its raw failure without another invocation;
2. reproduce the assets-lock failure with a generic isolated managed-build
   regression that is not tied to the Qwen model or `/8` names;
3. vary one bounded input at a time to distinguish source-tree restore state
   from required child-environment state;
4. eliminate ambient mutable `obj` or package-state dependence from the sole
   managed build contract;
5. make all required offline restore/build inputs content-addressed and
   source-controlled or privately preregistered;
6. preserve `--no-restore` only if a separately proven immutable restore
   closure makes it truthful;
7. replace the current sole command/profile if the contract is defective,
   without a compatibility reader, alternate mode, fallback, or shim;
8. add positive, malformed-state, missing-variable, stale-assets, SDK-drift,
   package-root, clean-machine, and no-worktree-side-effect tests;
9. run the complete clean gate and commit/push/fresh-fetch the correction; and
10. use a new execution registration and wholly new private names.

No local rerun of the `/8` managed command may be used to select a favorable
result. An attractive output from any ad hoc diagnostic is not `/8` evidence
and cannot be adopted.

## Later Operations Stayed Absent

Exactly 12 of the 15 registered logical names now exist: the environment
request and three outputs, both custody requests, and both three-root custody
triplets. The composition request, controller evidence root, and composition
output root remain absent.

There was no composition request, controller process, converter launch,
execution binding, managed inspection, SLM2 artifact, or private verification
record. No relevant Node, .NET, MSBuild, Cargo, Rustc, linker, scratch
inspector, or converter process remained after terminal observation.

## Claim Boundary

`/8` proves one exact environment materialization, one passing Rust custody
operation, two qualified Rust PE outputs, and one terminal managed custody
operation. It proves no qualified managed inspector build, converter
invocation, SLM2 composition, source-framework parity, native runtime,
browser WASM, browser chat, model quality, P2P availability, catalog
announcement, package publication, site deployment, or MemoryEndpoints
operation.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

Attempt `/8` is an immutable technical evidence identity, not a product
generation. TinyRustLM remains one unversioned prelaunch product with no
legacy support, compatibility path, migration, alias, fallback, response
repair, retry, temporary patch, or accepted debt.
