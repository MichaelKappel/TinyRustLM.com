# vNext Directory Durability Boundary

## Status And Scope

`tinyrustlm.vnext.directory-flush.v1` is the sole current platform boundary for
flushing one exact directory beneath an owned filesystem root. Its frozen
profile is `contracts/vnext/directory-flush-profile.v1.json`, 5,820 bytes with
SHA-256
`aaf82fde396e89d03e82a6cd7c761bfbedb1d766250dc9dd537124be68adcfd8`.
The implementation is the `tinyrustlm-durability` Rust crate and the
`tinyrustlm-directory-flush` process. The sole Node process/package client is
`tinyrustlm.vnext.directory-flush-client.v1`. Its frozen profile is
`contracts/vnext/directory-flush-client-profile.v1.json`, 5,068 bytes with
SHA-256
`9f367bbe58bf8afc8ecba57a1b33e5cda5a83592a80517c4db38d0775cf9fde6`.
Its declared five-member source closure has SHA-256
`37dc6e85be3655743a31de5623fa574f565578351f4c6b255621a9d976a8c487`.

This checkpoint proves a bounded Rust operation/process protocol and the exact
Node-to-packaged-Rust invocation boundary. It does not yet replace the Node
create-only store's Win32 unavailability result, bind file fsync plus
publication plus readback into a finalized vNext receipt, or complete Gate D.
It does not advance a campaign counter.

## Why A Separate Boundary Exists

The current Node stores already use exclusive same-directory temporaries,
bounded writes, file `fsync`, hard-link create-if-absent publication, and exact
readback. Node cannot request the required Win32 directory handle flags through
its public filesystem API, so those stores honestly return
`unavailable-win32-node` when directory synchronization is unavailable.

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

The process accepts one JSON document on stdin, capped at 16,384 bytes:

```json
{
  "operationId": "directory-flush-operation-001",
  "ownedRoot": "<absolute private owned root>",
  "relativeDirectory": "receipts/sha256",
  "schema": "tinyrustlm.vnext.directory_flush_request.v1"
}
```

Duplicate keys, unknown keys, a wrong schema, an invalid operation ID, an
oversized request, a non-absolute root, and an unsafe relative path fail. Paths
are transported through stdin rather than command-line arguments so ordinary
process listings do not disclose them.

Success emits exactly one path-redacted JSON observation:

```json
{
  "architecture": "x86_64",
  "directoryIdentitySha256": "<64 lowercase hex>",
  "method": "win32-backup-semantics-flush-file-buffers",
  "operatingSystem": "windows",
  "operationId": "directory-flush-operation-001",
  "profileId": "tinyrustlm.vnext.directory-flush.v1",
  "profileSha256": "aaf82fde396e89d03e82a6cd7c761bfbedb1d766250dc9dd537124be68adcfd8",
  "requestSha256": "<64 lowercase hex>",
  "schema": "tinyrustlm.vnext.directory_flush_observation.v1",
  "status": "performed"
}
```

The directory identity hashes a domain separator, canonical absolute owned
root, and normalized relative directory. The raw identity material is never
returned. Failure emits only `errorCode`, `schema`, and `status`; raw paths,
request bytes, and host diagnostics are excluded.

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

The child receives no arguments, no parent environment variables, no inherited
stdio, and no caller working directory. It runs from the verified package root
with `shell: false`, private bounded pipes, a 10-second timeout, and `SIGKILL`
as the timeout signal. Stdin is the canonical request. Stderr must be empty.
Success and failure stdout must be bounded, strict, canonical documents. A
validated helper failure contributes only its bounded public-safe error code as
the client error cause.

The path-redacted client result binds the client profile and source closure,
Node runtime version, helper profile, package manifest, source closure,
executable, platform/RID, request, operation, directory identity, method, and
observation. The Node process API does not provide an OS network sandbox. The
helper contract forbids network use, but a release claim additionally requires
a trusted, provenance-verified package and controlled installation root. A
`local-test-build` package is test evidence only.

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

## Receipt Integration Boundary

The next Gate D change must integrate this client into the sole create-only
publication path. The client now independently verifies the helper executable
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

into immutable vNext receipt lineage. A caller-supplied success flag or a
synthetic observation is forbidden. Store activation must remain after the
complete receipt-backed sequence. A failed or interrupted operation may leave
only bytes that restart can revalidate; it cannot create accepted durability
truth.

## Verification

The crate currently has 14 passing tests:

- eight owned-path and platform-operation tests, including actual Win32
  success and junction rejection; and
- six frozen-profile and strict library/process protocol tests, including
  exact profile identity and semantics, duplicate fields, unknown fields,
  wrong schema, byte limits, path redaction, bounded failure, and real
  child-process execution.

The Node client has 32 passing tests. They cover exact profile/source-closure
identity, real helper success and safe failure, owned-root scope, configured
package discovery, accessor and unknown-field rejection, request bounds,
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

## Primary Sources

Retrieved 2026-08-11:

- [Microsoft CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew), last updated 2023-02-08. It documents directory handles and `FILE_FLAG_BACKUP_SEMANTICS`.
- [Microsoft FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers), last updated 2021-10-13. It documents `GENERIC_WRITE`, success/failure, and the scope of its flush guarantee.
- [Rust OpenOptionsExt](https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html), Rust 1.96.0 documentation retrieved 2026-08-11. It documents Windows access, share, and custom flag control.
- [Rust Windows MetadataExt](https://doc.rust-lang.org/std/os/windows/fs/trait.MetadataExt.html), Rust 1.96.0 documentation retrieved 2026-08-11. It documents stable file-attribute inspection; file-index and volume-serial access remain experimental on this toolchain, which is why stable path-topology ownership is an explicit caller precondition.
- [Rust File::sync_all](https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all), Rust 1.96.0 documentation retrieved 2026-08-11. It documents synchronization of OS-internal content and metadata to the filesystem.

## Explicit Non-Claims

- Gate D is not complete.
- Node store publication is not yet using this helper.
- No vNext durable-publication receipt has been admitted.
- The Node client does not impose an OS network sandbox or prove release
  provenance for a self-described package.
- The helper does not independently establish stable path-topology ownership
  of its caller-supplied root and directory components.
- No physical power interruption has been executed.
- No Linux or physical ARM64 execution evidence exists for this helper.
- No release, deployment, publication, model qualification, browser round,
  live memory round, outside lane proof, or catalog announcement follows from
  these tests.
