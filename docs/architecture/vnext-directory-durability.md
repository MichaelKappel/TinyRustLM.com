# vNext Directory Durability Boundary

## Status And Scope

`tinyrustlm.vnext.directory-flush.v1` is the sole current platform boundary for
flushing one exact directory beneath an owned filesystem root. Its frozen
profile is `contracts/vnext/directory-flush-profile.v1.json`, 5,539 bytes with
SHA-256
`51effab85d325493e77ca57de5aa14bf7d3fa2fd3b5f16139baadc8979d395bb`.
The implementation is the `tinyrustlm-durability` Rust crate and the
`tinyrustlm-directory-flush` process.

This checkpoint proves a bounded Rust operation and process protocol. It does
not yet replace the Node create-only store's Win32 unavailability result, bind
file fsync plus publication plus readback into a finalized vNext receipt, or
complete Gate D. It does not advance a campaign counter.

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
  "profileSha256": "51effab85d325493e77ca57de5aa14bf7d3fa2fd3b5f16139baadc8979d395bb",
  "schema": "tinyrustlm.vnext.directory_flush_observation.v1",
  "status": "performed"
}
```

The directory identity hashes a domain separator, canonical absolute owned
root, and normalized relative directory. The raw identity material is never
returned. Failure emits only `errorCode`, `schema`, and `status`; raw paths,
request bytes, and host diagnostics are excluded.

## Owned-Path Validation

The caller must own the root and prevent every independent writer from
mutating it from initial inspection through post-flush inspection. Within that
single-writer boundary, the library requires all of the following before
opening a handle:

1. The root is absolute, UTF-8 representable, bounded, present, and a
   directory.
2. Every existing root component is inspected with `symlink_metadata` and is
   neither a symbolic link nor a Windows reparse point.
3. The relative directory contains one to 64 normal components, with no root,
   prefix, current-directory, or parent-directory component.
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

The next Gate D change must integrate this helper into the sole create-only
publication path. The caller must independently verify the helper executable
identity, strict output schema, profile ID and hash, operation ID, platform,
method, directory identity, and `performed` status. It must then bind:

- exact input and output byte hashes;
- temporary-file fsync;
- create-if-absent publication disposition;
- this exact directory-flush observation;
- exact postpublication readback; and
- the helper binary and configuration identities

into immutable vNext receipt lineage. A caller-supplied success flag or a
synthetic observation is forbidden. Store activation must remain after the
complete receipt-backed sequence. A failed or interrupted operation may leave
only bytes that restart can revalidate; it cannot create accepted durability
truth.

## Verification

The crate currently has 13 passing tests:

- seven owned-path and platform-operation tests, including actual Win32
  success and junction rejection; and
- six frozen-profile and strict library/process protocol tests, including
  exact profile identity and semantics, duplicate fields, unknown fields,
  wrong schema, byte limits, path redaction, bounded failure, and real
  child-process execution.

The crate forbids unsafe Rust. The frozen profile is compiled into the library
and rehashed before every operation; a profile-byte mismatch fails as
`directory_profile_invalid`.

## Primary Sources

Retrieved 2026-08-11:

- [Microsoft CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew), last updated 2023-02-08. It documents directory handles and `FILE_FLAG_BACKUP_SEMANTICS`.
- [Microsoft FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers), last updated 2021-10-13. It documents `GENERIC_WRITE`, success/failure, and the scope of its flush guarantee.
- [Rust OpenOptionsExt](https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html), Rust 1.96.0 documentation retrieved 2026-08-11. It documents Windows access, share, and custom flag control.
- [Rust Windows MetadataExt](https://doc.rust-lang.org/std/os/windows/fs/trait.MetadataExt.html), Rust 1.96.0 documentation retrieved 2026-08-11. It documents stable file-attribute inspection; file-index and volume-serial access remain experimental on this toolchain, which is why single-writer ownership is an explicit caller precondition.
- [Rust File::sync_all](https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all), Rust 1.96.0 documentation retrieved 2026-08-11. It documents synchronization of OS-internal content and metadata to the filesystem.

## Explicit Non-Claims

- Gate D is not complete.
- Node store publication is not yet using this helper.
- No vNext durable-publication receipt has been admitted.
- The helper does not independently establish single-writer ownership of its
  caller-supplied root.
- No physical power interruption has been executed.
- No Linux or physical ARM64 execution evidence exists for this helper.
- No release, deployment, publication, model qualification, browser round,
  live memory round, outside lane proof, or catalog announcement follows from
  these tests.
