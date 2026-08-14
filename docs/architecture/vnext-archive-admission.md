# TinyRustLM vNext Archive Admission And Secret-Scan Boundary

## Status

This document records the sole current archive-member admission path as of
2026-08-14. It replaces operating-system archive commands and consumer-owned
ZIP parsing in current production code. Historical v2 scan receipts remain
immutable evidence, but they are not accepted as current v4 scan authority and
there is no compatibility reader.

The implementation is local conformance evidence. One clean `win-x64`
`release-package` built from source revision
`5db9e943ecdbcef83e27be1782d9bcb5ec4109fe` passed the maintained
clean-consumer suite and the frozen native-package vector replay on 2026-08-14.
That package is not signed, published, installed on every RID, or evidence of a
successful hosted-CI or production publication operation.

## Frozen Profiles

Four exact raw-byte profiles own the boundary:

| Profile | Identifier | SHA-256 |
| --- | --- | --- |
| Archive admission | `tinyrustlm.vnext.archive-admission.v1` | `05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031` |
| Process transport | `tinyrustlm.vnext.archive-scan-process.v1` | `a5ab1ba16af4db2cf4660bee8c9efd9a32b018cc30211d2144f4c852912d05ad` |
| Node client and helper package | `tinyrustlm.vnext.archive-scan-client.v1` | `08bb532cd88273f5633a8693040c2108fd7fef0935f9705f34b98cb1ab405441` |
| Native package fixed-vector replay | `tinyrustlm.vnext.archive-scan-helper-verification.v1` | `825c2b76c7a1a2bc53cd79db778018b1efcb963d3e95bd16f21a7f029f4edd42` |

Every reader verifies its profile bytes against the compiled or pinned hash.
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

## Helper Package And Provenance

The Node client accepts one explicit absolute package root, not a direct
executable path. The package is create-only and contains exactly the RID-native
helper, `archive-scan-helper-manifest.v1.json`, and
`archive-scan-helper-provenance.v1.json`. Both JSON files must be strict
canonical JCS documents with their exact current schemas. Unknown fields,
duplicate keys, alternate filenames, links or reparse points, noncanonical
bytes, an existing output directory, and package mutation fail closed.

The manifest binds the platform, RID, build profile, trust class, executable
size and SHA-256, helper source closure, both Rust profiles, and provenance
identity. The provenance binds the exact Git source revision, whether the
source worktree was clean, `Cargo.lock`, Cargo and rustc versions, package
builder source closure, helper source closure, process profile, executable,
platform, and trust class. `release-package` is accepted only with a release
build and a clean source worktree. A debug build cannot be relabeled as release
because the executable's parent build-profile directory is checked.

`tinyrustlm/tools/archive-scan-helper-package.js` owns materialization. It
refuses replacement, copies and re-hashes the source executable, writes both
metadata files exclusively with file fsync, performs exact readback, and on
failure removes only the new output root it created. This is package creation
durability, not a physical power-loss claim or publication authorization.

`eng/build-archive-scan-helper.ps1` and
`eng/build-archive-scan-helper.sh` provide current-host builds for `win-x64`,
`linux-x64`, and `linux-arm64`. CI declares native jobs on each architecture,
including GitHub's `ubuntu-24.04-arm` hosted runner label, then reruns the real
consumer suite and the fixed-vector native verifier against the produced
release package before separate package and verification-receipt uploads.
The runner label is documented by [GitHub's hosted-runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
retrieved 2026-08-13. A workflow declaration is not successful execution
evidence; only a completed run can prove a particular package and runner.

The local `win-x64` package observation for the source revision above is:

| Identity | SHA-256 |
| --- | --- |
| Executable | `bde6cb38779cf9245e07621c3f26ad2bc638a4e4da729f4bb5e891a3c26250aa` |
| Helper source closure | `9e4c97c0908f662b90e99fe0d774874ea5755d69d151706751543f9b64ac102b` |
| Package-builder source closure | `57de3b8c8ec375b5dfc2f123c3f9164d499ac141f906760585fc769318342087` |
| Manifest | `1eae9e16fcf4570858d84c34003bea33833bdcc5b47dad83ca4903bd080188aa` |
| Provenance | `71f23c7229c9fda429d952c4375aafa9ef432eaa471a48802ce4b174baa996b6` |

The materializer reported `sourceWorktreeClean=true`, `buildProfile=release`,
`trustClass=release-package`, and `runtimeIdentifier=win-x64`. The exact
external package passed 20/20 archive-client and public-evidence tests with
zero skips. The consumer transcript has SHA-256
`7e78a34f438fabbbdc03e9a725e05b99fde60a916a326ef809cba60c4aa20c0e`.
These identities are bounded local build evidence, not a release ledger or
substitute for independently retained CI artifacts.

## Native Package Fixed-Vector Replay

`tinyrustlm/tools/archive-scan-helper-verification.js` is the only current
native package replay entry point. It requires three explicit, absolute,
pairwise-disjoint roots: a read-only helper package, an absent create-only
receipt output, and an existing caller-owned scratch parent. It rejects links
where the host API exposes them, verifies the package through the frozen Node
client, creates one unique scratch child, and removes that child before any
receipt is written.

The frozen profile contains exactly two small canonical vectors, one ZIP and
one tar-gzip. Each replay must execute the packaged helper, reproduce the exact
archive SHA-256, sorted content-manifest SHA-256, member count, aggregate
content bytes, member paths, member bytes, and member hashes, and retain package
identity before the verifier can create a receipt. The output directory then
contains exactly one canonical JCS file,
`archive-scan-helper-verification.v1.json`, written exclusively with file fsync
and exact readback.

The local package above produced a 2,031-byte receipt with SHA-256
`dde3309fa52fcc87925757f85335970d4f7807855debcae0dd405ad0ce5cddd8`.
It binds client source closure
`914c3900571148899f7fbebdcd97873c775edb2900189bb4ebe28e7271d1f2db`
and verifier source closure
`df35d6c53dcd7266f0292b2b36cc3a570d6b2aa3d4862801da1934f77d9283f0`
in addition to every package identity listed above. Its two case identities
are `canonical-package-tar-gzip` and `canonical-package-zip`. The receipt
intentionally has no timestamp: it is a deterministic package/vector replay
record, not proof of observation time, hosted execution, signing, publication,
physical durability, or production operation.

## Node Verification

`tinyrustlm/tools/archive-scan-client.js` requires an explicit absolute helper
package root whenever an archive is present. There is no `PATH` lookup, shell, system
`tar`, JavaScript ZIP fallback, or best-effort mode. The client:

1. verifies both frozen profile files;
2. verifies the canonical package manifest, provenance, platform, trust class,
   source and builder closures, and helper executable before and after every
   invocation;
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
`tinyrustlm.public_artifact_secret_scan.v4` reports and
`tinyrustlm.secret-scan-v4` receipts. Plain files require pre/post identity
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
node --test tinyrustlm/tests/archive-scan-helper-package.test.js
node --test tinyrustlm/tests/archive-scan-helper-verification.test.js
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

Source revision `04cd9db9642ac438caf711ef61af81ec4cd45d86` adds a
bounded deterministic property layer without adding a second parser. The
fixed generator identity is seed `0x6f4d26b98a31c5e7` with 64 logical archive
cases. Independently ordered ZIP and tar-gzip encodings must produce identical
sorted member evidence and content-manifest identity, while exact compressed
archive identities remain distinct. The test oracle independently recomputes
the domain-separated path identities, member digests, aggregate length, raw
archive digest, and content-manifest digest from callback bytes.

The same layer materializes 352 generated cross-format path-verdict pairs,
checks every proper byte prefix of one fixed six-member corpus in each format,
and applies 128 deterministic single-bit mutations per format. A mutation may
either reject with one error code declared by the frozen profile before any
callback, or admit and match the independent evidence oracle exactly. A
tar-gzip metadata-only mutation also proves that archive identity changes
without changing content identity.

The final Rust transcript
`D:\TinyRustLM-vnext-20260812\test-logs\archive-property-final2-20260813T202304.stdout.log`
has SHA-256
`77af3864f0a7a19fc4ba0ef797321de08035f3a333472a349e02f6b1eaf62712`
and records 24/24 passing tests. Denied-warning all-target Clippy passed; its
stderr transcript has SHA-256
`bd38213a961e771c440e7f9f4dc192a54d27f0cb17b4c73b059f57c7abeab161`.
The contained helper/client/public-scanner rerun passed 24/24; transcript
SHA-256 is
`7740513c1a794c9791bee82413771ba1f9b58ba9699ceaa5d3460bd74461ab97`.
The first consumer run is retained separately: it passed 8/24 and failed 16
helper-dependent cases because that process omitted the required external
Cargo target and exhausted E:. Cargo removed exactly the 87 generated files;
the corrected D:-contained rerun supplied the terminal verdict above.

The current clean physical-worktree Node run at source revision
`5db9e943ecdbcef83e27be1782d9bcb5ec4109fe` passed 947/947 with zero
failures, skips, cancellations, or todos. Its stdout transcript has SHA-256
`78375d023e9d67aee323c200e1f590155f452a7808164c017e53fca47aea0708`;
stderr was empty. That complete local run includes four focused tests for the
verification profile and CLI. The separate current release-package consumer
run passed 20/20, and the native verifier produced the receipt identified
above. No hosted run is inferred from these local results.

## Structured Fuzz And Corpus Checkpoint

Source commit `f2b19d6e499aa77207cb6123aa5c31abb084d95c` adds one
independent structure-aware fuzz workspace around the sole
`scan_archive_bytes` API. It contains no second archive parser, performs no
filesystem extraction or network access, and uses ZIP and tar-gzip writers only
to generate bounded inputs. The frozen 2,914-byte fuzz profile has SHA-256
`5af6f00aef3540aa6969bb122dc2a3efdde9b39049c0dfbb15cc1e0fa29ce22e`.
Its pinned `Cargo.lock` has SHA-256
`ceae70bcca6821cf350a5cc13f21f650934c96e7209fbd67c46a75b50930af7b`.

The frozen corpus manifest has SHA-256
`ad38ccecb671b47c5da5271e59219a091837d2f271c03624a09a3827c2076420`.
It binds 29 unique `TAF1` seeds no larger than 4,096 bytes: two canonical
admissions and 27 exact fail-closed path, nested-content, member-type,
truncation, bit-flip, trailing-data, and malformed-container verdicts. Stable
replay verifies the exact seed set, byte lengths, hashes, decoded format and
mode, verdict, callback count, and generated archive length. Hash drift and an
unlisted seed are explicit negative tests. The observation mode is read-only;
there is no manifest-update or `--bless` path.

The independent fuzz workspace passes 9/9 unit and replay tests, including the
29-seed replay; its fuzzer target type-checks with `libfuzzer-sys 0.4.13`; and
denied-warning all-target Clippy passes. The affected Node archive boundary
passes 27/27, and the production archive crate continues to pass 24/24 with
denied-warning Clippy. CI source now replays the corpus on `win-x64`,
`linux-x64`, and `linux-arm64`, and defines one 60-second AddressSanitizer-backed
run using `cargo-fuzz 0.13.2` and `nightly-2026-08-01` on Linux.

Source commit `c45faabcd27f9768fe53531f52ba655f7e4e6b7c` replaces the
ad hoc sanitizer command sequence with the single frozen
`tinyrustlm.vnext.archive-fuzz-hosted-verification.v1` runner and verifier.
The 7,150-byte profile has SHA-256
`0943bba8ceba94c6f925cd5cb33d163c33d654e4e59266c00ca3ef6346bfc415`.
The runner requires the exact GitHub repository, workflow, job, run, attempt,
event, clean source revision, hosted Linux runner class, and matching x64 or
ARM64 process architecture. It copies only manifest-bound seeds into an owned
runner-temp child, executes pinned cargo-fuzz and rustc identity probes, stable
manifest replay, libFuzzer corpus replay, and one explicit AddressSanitizer
interval with network-disabled child processes. Bounded raw logs remain
private CI artifacts; the canonical record contains only their byte counts and
hashes. A failing command stays a failing CI step while its record and bounded
crash inputs remain available for append-only diagnosis. Local execution
without the GitHub-hosted environment fails before evidence creation.

The exact committed physical-worktree archive union passes 36/36 with zero
skips. Its stdout SHA-256 is
`a799342037f5c82b9945cab2055dcbbf69a40a20ef376ea603ee3aa3105e491b`;
stderr is empty. Three affected .NET workflow/package assertions pass with TRX
SHA-256
`fb89ba75c4571fc54b089d5dba38bd17f09c55532520e1ad122a5625c66d2c17`.
The first fresh external-Cargo-target union passed 16/36 and exposed a test
helper that assumed its package parent survived an earlier run. The helper now
creates and validates only that direct owned parent; the second fresh target
and the clean committed physical worktree both pass 36/36 without weakening
the production package materializer's path or link policy.

Final combined transcripts are retained under
`D:\TinyRustLM-vnext-20260812\test-logs\archive-fuzz-final-20260814T0438Z`.
The focused fuzz transcript has SHA-256
`c34473d0e18f23337548255cf6a0cf610ad41ab7c6f4590095cfa6306e15b6a9`;
the production archive transcript has SHA-256
`eb550c37a5776d9367b1b65fed8f80c17c446c30c780bcaf403f109d1b32b24f`;
the 27-test affected Node transcript has SHA-256
`8b5d664883fbca107647f9cf1b46e500a9a5b04b5437e8ec5b75840a10622c37`;
and the 75-test documentation-linked transcript has SHA-256
`9ae472706d56ba032b414d791d710fc28a458492688567e32d1187a4646f0f49`.
The tracked-memory contract passes 9/9 with transcript SHA-256
`dde750ec2f94d5cd9d7dfc95cc115a28931242fe60ff9176493bb4b660c1c17b`.

## Non-Claims And Remaining Gates

A passing admission proves bounded structural and decoded-content handling for
the exact bytes. It does not prove that those bytes are malware-free, licensed,
provenance-approved, semantically correct, safe to execute, eligible for
publication, or available from a registry. A local debug helper is not release
provenance. The bounded local `win-x64` package above does not establish the
other RIDs or publication. Its deterministic replay receipt does not establish
observation time or an independently operated witness. Production closure
still requires current native packages and clean-consumer evidence for every
supported RID, successful hosted CI, signing where required, malware-scan
boundary evidence, release authorization, deployment, and HTTPS readback.
The maintained target and frozen seed corpus do not prove absence of parser
defects. A branch push and workflow source are not hosted execution evidence.
No hosted record or raw hosted log set has yet been independently retrieved and
verified for this source checkpoint, so no sanitizer result is claimed. No
crash was observed locally and therefore no retained minimized crash corpus
exists. Hosted artifact retrieval and verification, longer fuzz campaigns,
retention and minimization of any future findings, and repeated execution on
the supported native parser builds remain open Gate D evidence.
