# TinyRustLM vNext Archive Admission And Secret-Scan Boundary

## Status

This document records the sole current archive-member admission path as of
2026-08-13. It replaces operating-system archive commands and consumer-owned
ZIP parsing in current production code. Historical v2 scan receipts remain
immutable evidence, but they are not accepted as current v3 scan authority and
there is no compatibility reader.

The implementation is local conformance evidence. It does not claim that a
release-packaged helper has been signed, published, installed on every RID, or
used in a successful production publication.

## Frozen Profiles

Two exact raw-byte profiles own the boundary:

| Profile | Identifier | SHA-256 |
| --- | --- | --- |
| Archive admission | `tinyrustlm.vnext.archive-admission.v1` | `05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031` |
| Process transport | `tinyrustlm.vnext.archive-scan-process.v1` | `a5ab1ba16af4db2cf4660bee8c9efd9a32b018cc30211d2144f4c852912d05ad` |

Both readers verify their profile bytes against the compiled or pinned hash.
A changed profile requires a changed identity and rerun evidence. Unknown
request fields, alternate formats, and noncanonical request bytes fail closed.

## Admission Contract

`tinyrustlm-archive` owns ZIP and tar-gzip parsing. Consumers do not normalize
archive paths, resolve duplicate members, extract files, or select a more
permissive parser after rejection.

The frozen limits are:

- 512 MiB maximum compressed archive bytes;
- 16,384 maximum visible members and regular members;
- 1,024 bytes per member name, 64 path components, and 255 bytes per component;
- 64 MiB maximum decoded bytes for one regular member;
- 2 GiB maximum aggregate regular-member bytes;
- 2,214,592,512 maximum decoded tar-container bytes; and
- 200:1 maximum decoded-to-compressed expansion ratio.

ZIP admits only stored and deflated regular files and zero-length directories.
It rejects encryption, comments, unknown extra fields, links, special files,
trailing bytes, malformed central-directory structure, and integrity drift.
Tar-gzip admits one gzip stream containing regular files and zero-length
directories. It rejects concatenated streams, trailing bytes, PAX path
substitution, links, special files, malformed padding, and size drift.

Both formats reject absolute paths, backslashes, empty components, dot and
dot-dot components, Windows alternate-data-stream syntax, trailing dots or
spaces, Windows reserved device names, and portable case-insensitive
collisions. Nested archives are rejected by both known suffix and content
magic. Every member is decoded and hashed during whole-archive admission.
Consumer callbacks begin only after all metadata, paths, types, limits,
content, and whole-container checks pass.

## Process Boundary

`tinyrustlm-archive-scan` is the bounded host process for non-Rust consumers.
It accepts no command-line arguments and inherits no protocol state from the
caller. Its stdin is one exact JSON object with fields in this order:

```json
{"archivePath":"<absolute-observed-path>","format":"zip","schema":"tinyrustlm.vnext.archive_scan_request.v1"}
```

The helper reads at most 16,384 request bytes and at most 512 MiB from one
absolute regular file. Observed symbolic-link and reparse-point components are
rejected. It opens no network connection and writes no decoded member to disk.

Success uses the binary `TRASV1\0\0` stream. Each member frame binds the
validated path, exact decoded byte count, decoded-content SHA-256, and decoded
bytes. One terminal frame binds member count, aggregate decoded bytes, format,
compressed archive SHA-256, sorted path-redacted content-manifest SHA-256, and
both profile hashes. Ordinary rejection uses exit code 2, empty stdout, and one
bounded path-free failure JSON object on stderr. Output transport failure uses
exit code 3 and never constitutes partial success.

## Node Verification

`tinyrustlm/tools/archive-scan-client.js` requires an explicit absolute helper
path whenever an archive is present. There is no `PATH` lookup, shell, system
`tar`, JavaScript ZIP fallback, or best-effort mode. The client:

1. verifies both frozen profile files;
2. resolves one observed regular helper file and hashes it before and after
   every invocation;
3. resolves one bounded observed archive path;
4. starts the helper with no arguments, no inherited environment variables,
   private pipes, `shell: false`, and a bounded timeout;
5. parses frames incrementally without buffering aggregate decoded content;
6. validates every path, count, length, format code, lowercase digest, member
   digest, portable collision key, and profile identity;
7. independently rebuilds the sorted content-manifest SHA-256;
8. rejects malformed, incomplete, duplicated, or trailing wire bytes; and
9. returns only bounded identities and counts after process and executable
   readback succeed.

The public evidence scanner now emits
`tinyrustlm.public_artifact_secret_scan.v3` reports and
`tinyrustlm.secret-scan-v3` receipts. Plain files require pre/post identity
agreement. Archives additionally require helper archive-hash agreement.
Secret detection receives decoded member bytes directly and resets its carry
at every member boundary so bytes from separate files cannot form an invented
match. Reports contain labels, sizes, hashes, counts, formats, profile
identities, finding codes, and helper identity; they contain no filesystem
paths or matched secret material.

The scanner tool identity is a deterministic source closure over the active
Node client, report writer, and strict JSON parser. When archives are present,
the receipt adds the exact helper executable SHA-256 as a second tool identity.
No archive tool is claimed for a plain-file-only scan.

## Consumers

- `tinyrustlm-memory` sends `.zip` and ZIP-encoded `.uaix` bytes through the
  Rust admission authority before applying UAIX package-selection rules. The
  memory crate has no direct production ZIP parser.
- `public-evidence-secret-scan.js` sends `.zip`, `.nupkg`, `.snupkg`, `.tgz`,
  and `.tar.gz` artifacts through the explicit Rust process boundary.
- `web-release-secret-scan.js` retains the same scanner for its closed web
  file set. A web-only scope does not falsely claim archive execution.

## Verification

Run the current focused gates with Cargo output outside the source worktree:

```powershell
$env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA 'TinyRustLM\cargo-target'
cargo test -p tinyrustlm-archive --all-targets --locked
cargo clippy -p tinyrustlm-archive --all-targets --locked -- -D warnings
node --test tinyrustlm/tests/archive-scan-client.test.js `
  tinyrustlm/tests/public-evidence-secret-scan.test.js `
  tinyrustlm/tests/web-release-secret-scan.test.js
```

The Rust suite covers malformed containers, paths, duplicate portable names,
links, special files, nested archives, comments, unsupported compression,
trailing bytes, concatenated gzip streams, count/size/ratio bombs, profile
identity, canonical requests, and no-output rejection. Node tests split valid
wire output one byte at a time, corrupt member and terminal identities, reject
reserved names and trailing output, execute the real Rust helper for ZIP and
tar-gzip, detect decoded secrets, and prove a late hostile member invokes no
content callback.

## Non-Claims And Remaining Gates

A passing admission proves bounded structural and decoded-content handling for
the exact bytes. It does not prove that those bytes are malware-free, licensed,
provenance-approved, semantically correct, safe to execute, eligible for
publication, or available from a registry. A local debug helper is not release
provenance. Production closure still requires a per-RID packaged helper,
source/build provenance, package and executable hashes, signing where required,
malware-scan boundary evidence, clean-consumer tests, release authorization,
deployment, and HTTPS readback.
