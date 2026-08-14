# vNext Directory Durability Boundary

## Status And Scope

`tinyrustlm.vnext.directory-flush.v1` is the sole current platform boundary for
flushing one sorted batch of one to 1,024 exact directories beneath an owned
filesystem root. Its frozen profile is
`contracts/vnext/directory-flush-profile.v1.json`, 7,021 bytes with
SHA-256
`bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb`.
The implementation is the `tinyrustlm-durability` Rust crate and the
`tinyrustlm-directory-flush` process. The sole Node process/package client is
`tinyrustlm.vnext.directory-flush-client.v1`. Its frozen profile is
`contracts/vnext/directory-flush-client-profile.v1.json`, 5,845 bytes with
SHA-256
`0d5fe88e8abb371a99db58f1ce3fabce180dc00f77287b6f44ea40d268d709a1`.
Its declared five-member source closure has SHA-256
`b265141e0749422bcdadefab7777c97d154f442ac18397f69664dd1af24447f3`.

This checkpoint proves a bounded Rust operation/process protocol, the exact
Node-to-packaged-Rust invocation boundary, and the sole non-recursive
durable-publication primitive used by every current vNext store. The
primitive's 7,469-byte frozen profile has
SHA-256
`4c1006a986ced8359346cb856ea698c03cc187ae7a0b77b8108719a043becc35`.
Its six-member source closure has SHA-256
`845acd1da5aa060ad7eb15dee0fdb866d9ac13ea20a699fe13f4ea6b0592b2d9`.
The receipt, subject, campaign-artifact, campaign-operation, and append-only
runner-lock paths all use this primitive. There is no unsupported-success
class or caller-supplied durability path. Gate D remains incomplete because
archive admission, protected equality-list custody, broader hostile/fuzz
coverage, and physical evidence remain separate requirements. No campaign
counter advances.

## Why A Separate Boundary Exists

The current Node stores use exclusive same-directory temporaries, bounded
writes, file `fsync`, hard-link create-if-absent publication, exact readback,
and this verified helper for every required directory flush. Node cannot
request the required Win32 directory-handle flags through its public
filesystem API, so helper absence or failure is a bounded hard failure rather
than a success-shaped unsupported result.

Microsoft documents that opening a directory through `CreateFileW` requires
`FILE_FLAG_BACKUP_SEMANTICS`. It separately documents that
`FlushFileBuffers` requires a handle with `GENERIC_WRITE`. The Rust Windows
filesystem extension permits those CreateFile flags and access rights to be
set without exposing a raw handle across the TinyRustLM API. Rust
`File::sync_all` is then the bounded standard-library flush call.

The Microsoft documentation does not promise that one successful directory
handle flush is equivalent to POSIX directory `fsync` under every filesystem,
controller, storage-device, power-loss, or virtualization condition. The
helper therefore records the platform call as `performed`; it does not return
`power-loss-proven` or any similar claim.

## Frozen Protocol

The process accepts one canonical JSON batch document on stdin, capped at
4 MiB. It must contain one to 1,024 members sorted bytewise by unique
`operationId`:

```json
{
  "requests": [
    {
      "operationId": "directory-flush-operation-001",
      "ownedRoot": "<absolute private owned root>",
      "relativeDirectory": "receipts/sha256",
      "schema": "tinyrustlm.vnext.directory_flush_request_member.v1"
    },
    {
      "operationId": "directory-flush-operation-002",
      "ownedRoot": "<absolute private owned root>",
      "relativeDirectory": "subjects/sha256",
      "schema": "tinyrustlm.vnext.directory_flush_request_member.v1"
    }
  ],
  "schema": "tinyrustlm.vnext.directory_flush_batch_request.v1"
}
```

Duplicate keys, unknown keys, a wrong schema, an invalid operation ID, an
empty or oversized batch, duplicate or out-of-order operation IDs, a
non-absolute root, and an unsafe relative path fail the entire call. Paths are
transported through stdin rather than command-line arguments so ordinary
process listings do not disclose them.

Success emits exactly one canonical path-redacted batch observation, also
capped at 4 MiB and ordered by operation ID:

```json
{
  "observations": [
    {
      "architecture": "x86_64",
      "directoryIdentitySha256": "<64 lowercase hex>",
      "method": "win32-backup-semantics-flush-file-buffers",
      "operatingSystem": "windows",
      "operationId": "directory-flush-operation-001",
      "profileId": "tinyrustlm.vnext.directory-flush.v1",
      "profileSha256": "bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb",
      "requestSha256": "<64 lowercase hex>",
      "schema": "tinyrustlm.vnext.directory_flush_observation_member.v1",
      "status": "performed"
    }
  ],
  "schema": "tinyrustlm.vnext.directory_flush_batch_observation.v1",
  "status": "performed"
}
```

The directory identity hashes a domain separator, canonical absolute owned
root, and normalized relative directory. The raw identity material is never
returned. If any member fails, the process emits no success members and only
one failure document containing `errorCode`, `schema`, and `status`; raw paths,
request bytes, host diagnostics, and partial success output are excluded. This
all-or-no-result API is not an atomic storage transaction: earlier directory
flushes may already have completed before a later member fails.

## Node Package And Process Boundary

`tinyrustlm/tools/vnext-directory-flush-client.js` resolves one explicit
absolute package root from
`TINYRUSTLM_DIRECTORY_FLUSH_PACKAGE_ROOT`. On Windows it rejects UNC, device,
and other non-drive-root forms before filesystem access. Every existing path
component must be an ordinary directory or regular file rather than a link or
exposed reparse point.

The package contains one canonical JCS manifest and exactly named helper
executable. The manifest binds operating system, architecture, RID, build
profile, trust class, helper profile ID and hash, executable byte count and
SHA-256, and helper source-closure SHA-256. The client rejects duplicate or
unknown fields, noncanonical bytes, size overflow, platform drift, helper
profile drift, unexpected executable names, self-described release trust on a
debug build, and executable byte drift. It re-reads the manifest and executable
after execution; replacement before or during the operation fails closed.

`flushMany` is the sole client implementation. It preflights one to 1,024
requests, rejects duplicates and accessors, sorts by operation ID, and invokes
exactly one helper process. `flush` delegates through a size-one batch and adds
no alternate path. The child receives no arguments, no parent environment variables, no inherited
stdio, and no caller working directory. It runs from the verified package root
with `shell: false`, private bounded pipes, a 10-second timeout, and `SIGKILL`
as the timeout signal. Stdin is the canonical request. Stderr must be empty.
Success and failure stdout must be bounded, strict, canonical documents. A
validated helper failure contributes only its bounded public-safe error code as
the client error cause.

Each path-redacted member result binds the client profile and source closure,
Node runtime version, helper profile, package manifest, source closure,
executable, platform/RID, exact batch request and observation, operation,
directory identity, and method. The Node process API does not provide an OS
network sandbox. The helper contract forbids network use, but a release claim
additionally requires a trusted, provenance-verified package and controlled
installation root. A `local-test-build` package is test evidence only.

## Owned-Path Validation

The caller must own the root and prevent independent rename, replacement,
link, or reparse mutation of the root and directory path components from
initial inspection through post-flush inspection. Concurrent member-file
creation is permitted. Within that stable-topology boundary, the library
requires all of the following before opening a handle:

1. The root is absolute, UTF-8 representable, bounded, present, and a
   directory.
2. Every existing root component is inspected with `symlink_metadata` and is
   neither a symbolic link nor a Windows reparse point.
3. The relative directory is either the explicit `.` owned-root scope or one
   to 64 normal components, with no root, prefix, or parent component.
4. Every relative component exists, is a directory, and is not a link or
   reparse point.
5. Canonical containment beneath the canonical root holds.
6. Metadata from the opened handle still describes a non-reparse directory.
7. Post-flush path inspection still describes a non-reparse directory.

The helper performs no deletion, replacement, rename, or recursive traversal.
It returns a bounded error if any inspection or platform call fails.

## Windows Operation

The Windows implementation opens the validated directory through Rust
`OpenOptionsExt` with:

- `GENERIC_WRITE`;
- `FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE`;
- `FILE_FLAG_BACKUP_SEMANTICS`; and
- `FILE_FLAG_OPEN_REPARSE_POINT`.

It checks metadata from that handle, calls `File::sync_all`, checks the path
again, and emits success only after every step returns success. There is no
read-only-handle retry, alternate Win32 call, ignored error, or success-shaped
unsupported result.

The current `win-x64` development host executed this exact path successfully.
The conformance suite also created a real directory junction and proved that
the helper rejects it as `directory_path_link`. This is local API execution
evidence, not a crash-recovery, power-interruption, filesystem matrix, or
storage-device claim.

## Unix Operation

On Unix, the helper opens the exact validated directory read-only and invokes
`File::sync_all`, producing method `posix-directory-fsync`. Other platforms
fail as `directory_flush_unsupported`. Cross-compilation alone does not count
as executed Linux or ARM64 evidence.

## Store Integration Boundary

The client is integrated into the sole create-only vNext publication path. It
independently verifies the helper executable
and package identities, strict output schema, profile ID and hash, operation
ID, platform, method, directory identity, and `performed` status. The store
must bind:

- exact input and output byte hashes;
- temporary-file fsync;
- create-if-absent publication disposition;
- this exact directory-flush observation;
- exact postpublication readback;
- the client profile/source and Node runtime identities; and
- the helper binary, package, source, and configuration identities

into immutable vNext durability-receipt lineage. A caller-supplied success
flag or synthetic observation is forbidden. Store activation occurs only
after the complete receipt-backed sequence. A failed or interrupted operation
may leave preserved bytes, but without a matching marker those bytes are
inactive and are quarantined on reconstruction.

`tinyrustlm/tools/vnext-durable-publication.js` now implements that sequence as
an isolated production boundary. It accepts no caller filesystem, platform,
randomness, helper, process output, directory-flush result, or readback result.
It requires a preexisting privately owned root and accepts one to 1,024 unique
target paths. It fully preflights the batch, durably creates child layout
directories in bounded helper batches, fsyncs every same-directory temporary,
publishes through create-if-absent hard links, flushes all target directories
through one verified helper batch, and reads every target back exactly. It then
persists one canonical content-addressed durability receipt per target, flushes
all receipt directories through one verified helper batch, repeats exact
receipt and target readback, and activates the complete batch only after all
verification succeeds. It returns no partial result, but interruption may
leave inactive files because the filesystem operations are not transactional.

`tinyrustlm/tools/vnext-create-only-files.js` is the only shared store adapter.
It constructs the durable publisher internally from an exact store profile ID
and SHA-256. It accepts no injected filesystem, platform, randomness, helper,
readback, or success result. Layout creation, quarantine metadata changes, and
other owned-directory synchronization use the same verified helper through the
profile's auxiliary-directory-flush operation.

The durability receipt deliberately excludes evidence of its own publication.
Including that result would require either a self-hash cycle or an infinite
receipt chain. The receipt file is therefore the explicit terminal persistence
trust anchor. Restart does not trust existence alone: it performs fresh helper
flushes of the target and receipt directories and exact readbacks before
activation. [ADR-012](adr/ADR-012-durable-publication-bootstrap.md) freezes
this bootstrap rule. Targets without matching current receipts and receipts
without exact targets remain inactive.

## Verification

The Rust crate's focused tests cover:

- eight owned-path and platform-operation tests, including actual Win32
  success and junction rejection; and
- frozen-profile and strict library/process batch protocol cases, including
  exact profile identity and semantics, duplicate fields, unknown fields,
  wrong schema, empty and oversized batches, duplicate and out-of-order IDs,
  byte limits, path redaction, no partial success output, bounded failure, and
  real child-process execution.

The Node client focused tests cover exact profile/source-closure
identity, real helper success and safe failure, owned-root scope, configured
package discovery, accessor and unknown-field rejection, request bounds,
sorted multi-member transport, duplicate and 1,025-member rejection,
empty-environment process execution, package-root link rejection, duplicate,
noncanonical, oversized, platform-drifted, and profile-drifted manifests,
debug/release trust mismatch, timeout, output overflow, stderr, signals,
unexpected exit status, malformed success/failure documents, canonical
observation substitution, and executable or manifest replacement before and
after execution. Synthetic process results exercise only rejection branches;
successful evidence is produced by the real packaged Rust helper.

The crate forbids unsafe Rust. The frozen profile is compiled into the library
and rehashed before every operation; a profile-byte mismatch fails as
`directory_profile_invalid`.

## Adjacent Package Reproducibility Boundary

Unsigned NuGet archives use the separate first-class
`TinyRustLM.PackageCanonicalizer` tool before package audit, hash-manifest
generation, or publication planning. The tool applies the ZIP epoch timestamp
through a same-directory exclusive temporary and verifies entry metadata plus
decompressed content before replacement and final readback. Both PowerShell
and Bash pack paths invoke that one implementation; there is no shell-specific
ZIP mutator or legacy audit reader. Two complete physical `win-x64` builds
from source `9e60539` reproduced all eight `.nupkg`/`.snupkg` bytes exactly,
and current source `7cc3579` passes the 67-test package suite and cross-writer
v1 audit parity.

This boundary removes timestamp-only archive drift. It does not replace the
directory-flush helper, prove persistence across power loss, make signing
reproducible, authorize publication, or establish package execution on another
RID. Signed packages are rejected because post-signature ZIP mutation would
invalidate the signature; repository signatures added by a public feed remain
a separately verified transformation.

## Primary Sources

Retrieved 2026-08-11:

- [Microsoft CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew), last updated 2023-02-08. It documents directory handles and `FILE_FLAG_BACKUP_SEMANTICS`.
- [Microsoft FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers), last updated 2021-10-13. It documents `GENERIC_WRITE`, success/failure, and the scope of its flush guarantee.
- [Rust OpenOptionsExt](https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html), Rust 1.96.0 documentation retrieved 2026-08-11. It documents Windows access, share, and custom flag control.
- [Rust Windows MetadataExt](https://doc.rust-lang.org/std/os/windows/fs/trait.MetadataExt.html), Rust 1.96.0 documentation retrieved 2026-08-11. It documents stable file-attribute inspection; file-index and volume-serial access remain experimental on this toolchain, which is why stable path-topology ownership is an explicit caller precondition.
- [Rust File::sync_all](https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all), Rust 1.96.0 documentation retrieved 2026-08-11. It documents synchronization of OS-internal content and metadata to the filesystem.

## Explicit Non-Claims

- Gate D is not complete; compressed archive admission, protected equality-list
  custody, broader parser fuzzing, and physical durability evidence remain.
- All four current vNext Node stores and runner-lock records require the
  durable-publication primitive; this does not prove unrelated older tools
  have completed their clean-slate deletion gate.
- Local hostile tests admit disposable durability receipts only; no production
  or campaign receipt follows from them.
- The Node client does not impose an OS network sandbox or prove release
  provenance for a self-described package.
- The helper does not independently establish stable path-topology ownership
  of its caller-supplied root and directory components.
- A successful batch is not an atomic all-or-nothing filesystem transaction;
  it proves only that every listed directory flush returned success.
- No physical power interruption has been executed.
- No Linux or physical ARM64 execution evidence exists for this helper.
- No release, deployment, publication, model qualification, browser round,
  live memory round, outside lane proof, or catalog announcement follows from
  these tests.
