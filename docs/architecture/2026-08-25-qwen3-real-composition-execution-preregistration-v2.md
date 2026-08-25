# Qwen3 Real Composition Execution Preregistration /2

Date: 2026-08-25

Status: output-free registration; neither build nor execution evidence

## Decision

TinyRustLM will make one new, zero-retry attempt to convert the exact locked
`Qwen/Qwen3-0.6B` source revision into the sole current complete-composition
artifact family. The public registration is
`contracts/vnext/qwen3-real-composition-execution-preregistration.v2.json`.
It is 27,596 canonical bytes at SHA-256
`cfc924334083d5623852511950d48486b2bbb80d3aa9d7e403c7d957b2f89a5f`.

The `/2` suffix is an execution-evidence identity. It is not a second product,
legacy lane, compatibility path, migration, alias, or fallback. TinyRustLM is
one unreleased product and this attempt targets only its best current format
and implementation.

The registration itself creates no private directory, build artifact,
conversion process, model output, structural decision, inference result, or
campaign credit. It exists so those later observations cannot be selected,
rewritten, repaired, or relabeled after their outcome is known.

## Why A New Registration Is Required

Registration `/1` authorized one release build. That build exited zero, but
the private operation stopped after preserving its build stdout and stderr and
before creating the mandatory private binding. It launched no converter and
created no output root. The bounded public result is
`qwen3-real-composition-execution-result.v1.json`, 4,076 bytes at SHA-256
`dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce`.

The root cause of that pre-launch interruption is not established. Therefore
`/1` is closed. Its private files will not be completed, resumed, retried,
deleted, overwritten, repaired, or treated as conversion evidence. A new
attempt requires a new profile and five new owned logical roots.

## Source And Registration Custody

The registration parent is remote-exact commit
`3e3b06ef2c9a4ecd419eec93e33fd208d5981058`, tree
`a70e5d2f8c6cddc7feeda90bdfc9d9e062a8230c`, on
`codex/model-acquisition-v2`. Before the profile was written, local `HEAD`, its
tracking ref, `FETCH_HEAD`, and the actual remote branch agreed, and the
worktree was clean.

The registration commit may change only:

1. the public contract index;
2. the `/2` preregistration profile;
3. this architecture record; and
4. the `/2` preregistration test.

That commit must be a single-parent descendant of the parent above. It must be
pushed and independently fetched so local `HEAD`, tree, tracking ref,
`FETCH_HEAD`, and actual remote branch all agree before either build starts.
The build source commit and tree are the registration commit, not merely the
parent named above.

## Exact Source Inputs

The attempt binds these immutable public identities:

- model source lock: 1,901 bytes, SHA-256
  `e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d`;
- Tokenizer2 source lock: 1,108 bytes, SHA-256
  `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70`;
- complete-composition profile `/2`: 8,835 bytes, SHA-256
  `d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718`;
- execution controller: 33,731 bytes, SHA-256
  `c78b6f8d59f61299aab511365fe8a699f6cd0a7989f222b954229d1d7e0e3508`;
- Node runtime: 91,380,224 bytes, SHA-256
  `63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088`,
  version `v24.14.0`, platform `win32`, architecture `x64`;
- managed inspection command owner: 4,315 bytes, SHA-256
  `ed81944fd92fdb52ccc980af0969cda79393564b6217e8d8de0b23d84b16f031`;
- managed inspector program: 2,513 bytes, SHA-256
  `8f17d0ff130d8993493ad5f2415f4d2e30520aa7a7d2da3687ae0d17ef762e48`;
  and
- managed inspector project: 609 bytes, SHA-256
  `20291d1c01805bc54886551e3b9208d17a4d9bad8dc470d388ec33d6eaf25823`.

The model and tokenizer locks must name the same model ID and immutable
revision while retaining their distinct, correct architecture-profile IDs.
Their five shared files must have identical complete records. The two source
roots must be distinct and direct non-reparse directories. No source,
repository, control, build, evidence, or output tree may overlap another.

## Fresh Owned Roots

The following public-safe logical root names were all absent before
registration:

- `qwen3-composition-control-c1899de-20260825-v2`;
- `qwen3-composition-build-3e3b06e-20260825-v2`;
- `qwen3-composition-execution-c1899de-20260825-v2`;
- `qwen3-composition-managed-inspector-3e3b06e-20260825-v2`; and
- `qwen3-composition-c1899de-20260825-v2`.

Their absolute paths are private. They may appear only in bounded private
request and evidence files outside Git. They must not appear in committed
contracts, documentation, logs intended for publication, screenshots,
telemetry, or safe error bodies.

No owned root may be reused if it appears after registration for any reason.
An unexpected existing root is terminal for this registration. The root may
not be inspected and then cleaned to make the attempt appear fresh.

## Rust Build Gate

The Rust converter receives exactly one offline release-build attempt:

```text
cargo build --locked --release -p tinyrustlm-convert --target x86_64-pc-windows-msvc
```

The registered environment contains only the exact controls
`CARGO_INCREMENTAL=0`, `CARGO_NET_OFFLINE=true`, and a private absolute
`CARGO_TARGET_DIR`. The target root must be absent before the command. The
parent must be an existing direct non-reparse directory. Stdout and stderr are
captured separately as bounded, create-only binary evidence.

A successful build requires exit code zero and the expected PE x86-64
`tinyrustlm-convert.exe`. Its path, length, streamed SHA-256, PE machine,
source commit, source tree, lock file, command, environment, and toolchain are
captured before a private request is written. The executable is rehashed
immediately before converter launch and after exit. Any build failure or
identity drift closes `/2`; it grants no invocation retry.

## Managed Inspector Build Gate

The read-only inspector receives exactly one offline, nonincremental release
build attempt:

```text
dotnet build dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj --configuration Release --no-restore --no-incremental --output <private-managed-build-root>
```

The command may not restore packages or use the network. The output root must
be absent and direct. The exact .NET host is 167,208 bytes at SHA-256
`ab1b71fd3dd71062e074c9fab8312081a81b7f2b3e0327c48c4d249c8d1a3135`.
The SDK is `10.0.400` commit `14fbf8d527`; MSBuild is
`18.9.6+14fbf8d52`; the host is `10.0.11` x64; the RID is `win-x64`; and
the project targets `net8.0`.

Every direct managed-build output is inventoried and hashed. The inspector
assembly, dependency manifest, and runtime configuration are mandatory. The
assembly and .NET host are rehashed immediately before and after inspection.
A managed build failure closes the inspection gate and cannot be hidden by
using a previously built binary.

## Private Request And Controller Order

After both successful builds, the operator creates one canonical private
`execution.request.json` in the fresh control root. The request is at most
65,536 bytes, UTF-8 without BOM, pretty-printed in the registered property
order, terminated by one LF, and written create-only. It binds all private
absolute paths, exact build logs and executables, the profile and registration
commit, controller bytes, Node executable bytes and runtime identity, source
inventories, output root, invocation bounds, and exact command arguments.

The controller performs all expensive checks before creating the evidence
root. This includes rehashing roughly 1.52 GB of locked model source. It then:

1. creates the evidence root once;
2. writes `execution.binding.json` as its first member;
3. writes one start authorization;
4. rehashes the converter;
5. launches exactly one owned converter child;
6. captures converter stdout and stderr separately under strict byte and time
   ceilings;
7. terminates only that owned child on timeout or overflow;
8. rehashes the executable and inventories output; and
9. writes one create-only controller terminal record.

The controller itself is invoked once. Its stdout and stderr are separate from
the converter streams. It has no resume, retry, output cleanup, repair,
best-of-N selection, unknown-process adoption, or unknown-process termination
path.

## Independent Managed Inspection

A controller candidate pass is not structural acceptance. Only after the
controller terminal exists may the operator create one canonical private
managed inspection intent. It binds the same locks, sources, profile,
converter, policy, output root, and terminal rule.

The inspector is invoked once through the exact bound .NET host and exact
built inspector assembly:

```text
dotnet TinyRustLM.CompositionInspector.dll inspect <private-intent-path>
```

The command can call only intent validation and durable terminal inspection.
It exposes no converter process API. Calling the managed conversion wrapper
after the direct Rust process would be a prohibited second converter launch.

The managed result meanings are:

| Exit | Status | Meaning |
| --- | --- | --- |
| `0` | `pass` | All durable terminal and six-artifact checks passed. |
| `2` | `rejected` | A typed durable native rejection was verified. |
| `3` | `pending` | No mutually exclusive durable terminal decision exists. |
| `1` | `error` | Intent, I/O, schema, canonicalization, or inspection failed. |

All outputs are bounded, separate, raw, create-only binary evidence. A
pending or error result is not a pass and does not authorize retry.

## Terminal Decision Matrix

A final structural pass requires all of the following from the one registered
attempt:

- one controller invocation and one converter child launch;
- converter exit zero, empty stderr, and a strict bounded pass summary;
- a native terminal pass and no terminal rejection;
- exactly ten expected output files;
- independent rehash and canonical reparse of all six composition artifacts;
- one managed inspection with exit zero, status `pass`, and operation
  `read-only-no-converter-launch`;
- unchanged converter, managed assembly, and runtime identities; and
- create-only terminal and verification evidence.

A controller process failure remains a terminal failure with every raw stream
and partial output preserved. A managed exit-two rejection is a final strict
rejection. A candidate pass followed by managed pending, error, malformed,
overflowing, or contradictory evidence is ambiguous and fails closed. None of
these outcomes authorizes deleting output, repairing bytes, changing a
threshold, rerunning the process, or choosing another answer under `/2`.

## Evidence And Privacy Boundary

The public repository may contain the registration, safe identities, sizes,
hashes, status, bounded codes, and a later minimized result. It must not
contain source locations, output locations, raw converter streams, raw managed
inspection payloads, prompts, credentials, invitation URLs, tokens, workspace
keys, or hosted-memory content.

Private evidence is append-only and create-only. A public result may summarize
it only after independent checks establish exact hashes and remove private
paths. Public-safe evidence never modifies the private record it describes.

The final private `execution.verification.json` also has a frozen canonical
schema. It binds the exact registration, both build attempts and streams,
converter and inspector identities, controller streams and records, managed
intent and result, output inventory, one closed decision status, and false
values for every broader claim. Every referenced private member is rehashed
before the create-only record is written. Its decision vocabulary is limited
to structural pass, either build failure, controller failure, managed
rejection, or terminal ambiguity; unknown status text cannot become a pass.

## Claim Boundary

This registration proves only that one future attempt was specified before
its build and output were observed. It does not prove that either build ran,
that a converter or inspector started, that an SLM2 composition exists, or
that structural validation passed.

Even a future structural pass will not prove source-framework numerical
parity, native generation, browser-WASM generation, browser chat behavior,
conversational quality, P2P availability, outside-network reachability,
catalog announcement, package publication, site deployment, or
MemoryEndpoints continuity. MemoryEndpoints remains unauthorized and
disconnected. Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and
`0/20`.

## Authorized Next Sequence

1. Commit only the four registered public paths.
2. Push and fresh-fetch the registration commit and prove actual-remote
   equality.
3. Reconfirm all five logical roots remain absent.
4. Run the Rust build command once and preserve its streams.
5. Run the managed inspector build command once and preserve its streams.
6. Capture exact future executable and managed output identities.
7. Create the private control root and canonical request once.
8. Invoke the controller once in `execute` mode.
9. If and only if controller terminal evidence permits inspection, create the
   managed intent and invoke the inspect-only command once.
10. Write one create-only private verification decision.
11. Preserve every outcome and add a minimized public result plus synchronized
    UAI memory.

No step may be repeated under this registration.
