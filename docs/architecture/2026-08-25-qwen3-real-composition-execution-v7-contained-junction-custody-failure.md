# Qwen3 Execution /7 Contained Junction Custody Failure

Date: 2026-08-25

Status: immutable terminal Rust custody failure; no retry, cleanup, adoption,
managed build, conversion, or later `/7` operation is authorized

## Decision

Qwen3 complete-composition execution `/7` is closed as
`terminal-rust-custody-failure`. Its sole registered Rust child completed with
exit code `0` and produced the required x64 converter. The custody terminal is
nevertheless an honest failure because post-exit scratch inspection found one
Windows directory junction where the current contract permits no reparse
entry of any kind.

The bounded public result is
`contracts/vnext/qwen3-real-composition-execution-result.v7.json`, 11,166
canonical ASCII/LF bytes at SHA-256
`e37790ffb827fe7082e31cc6adecc8148839dd6ef757231165587c45dd35b444`.
It contains no private absolute path, raw stream, credential, model byte, or
prompt.

## Remote-Exact Registration

The output-free `/7` registration is 53,432 bytes at SHA-256
`788f894c3e6116d3bd360386a4a1bbbe892d80f843cdf513e2ca7c781db293a1`.
It was committed at `53998f553bf7b24111eadf35b9b4eaca41885c99`, tree
`a4641555f199b99064ee5b4efe8cf7aac752e8c2`, on
`codex/model-acquisition-v2`. Local HEAD, tracking, fresh `FETCH_HEAD`, and
the direct remote branch were equal before any `/7` private material existed.
All 15 registered names were distinct and absent.

The registration remains immutable. This result does not edit, reinterpret,
or select an attractive subset of it. The earlier command-line quoting and
wrong-`where.exe` candidate observations happened before either affected
create-only request existed. They did not invoke an environment materializer,
custody execute operation, build child, or converter. The authoritative
counts are exactly one environment materialization and one Rust custody
execution.

## Exact MSVC Authority

The canonical environment request is 1,546 private bytes at SHA-256
`21b5012ec086922dd48020299325644a5c5671e3c8123442ffde46f414001b08`.
The committed owner materialized it once, with exit code `0`, canonical stdout,
and empty stderr. It selected:

- Visual Studio product line `2022`;
- installation `17.14.37531.7`;
- MSVC toolset `14.44.35207`;
- Windows SDK `10.0.26100.0`; and
- target `x86_64-pc-windows-msvc`.

The create-only private binding, public lock, and terminal are respectively
9,878, 157,301, and 2,016 bytes. Their SHA-256 identities are bound in the
public result. The exact closure regenerated without drift after
materialization, during Rust preflight, immediately before child launch, and
after child exit. Every phase observed public-lock SHA-256
`8e16a82b73828fa2152feb75ba4d42a9045efd97f7421fba7c445c1af859552a`
and combined-environment SHA-256
`6b65e2be0ebc2ffefd7c4f76d01a6fb0b8b97a7f341d599732eee9857316a2ff`.

This is real evidence that `/7` had a linker-complete deterministic build
environment. It is not conversion, model, runtime, browser, or quality proof.

## One Custodied Rust Build

The canonical V2 custody request is 6,367 private bytes at SHA-256
`90cecbc1c9673f95cd1a8e0e6c722a399c9c004456bce3f4a0a83c7ccd765d8f`.
It binds the registration commit and tree, exact Git, owner, profile, Node,
Cargo, Rustc, taskkill, six environment-authority artifacts, a 17-entry
supplement, three wholly new roots, offline locked compilation, bounded binary
streams, and one required PE output.

Its one read-only preflight passed while the control, target, and scratch roots
were absent. The owner then executed once. The direct Cargo child started at
`2026-08-25T16:48:55.511Z` and exited at
`2026-08-25T16:49:20.499Z` with code `0`, no signal, timeout, overflow, spawn
error, stream error, or capture-close error. Stdout is exactly empty. The 1,874
raw stderr bytes remain private at SHA-256
`cfac0d70b33edfbf13f6a1be3204a1cc2cdb7b20d455b779f54dd55ab5f2d5cb`.

The target inventory contains 450 entries: 365 files and 85 directories
totaling 105,686,862 bytes. It contains the required x64 PE converter:

- relative path
  `x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe`;
- 852,992 bytes;
- SHA-256
  `f5712d2d4cc9f7fe61cbb3102c126cdd3bb7da3f7142edd5a95f9fa0c6b6bdf4`;
  and
- PE machine `0x8664`.

These bytes remain failed-attempt evidence. They are not a qualified build and
cannot be copied, adopted, relabeled, selected, cleaned, or used by a later
attempt.

## Exact Scratch Failure

The current V2 contract requires a recursively bounded scratch tree with no
reparse point. Post-exit inspection rejected the tree with
`build-custody-environment-scratch-reparse`. The immutable final terminal is
10,889 bytes at SHA-256
`f0a818869f3037d9fe51f5bf86bb22d0f9149ee5925bda72a1a0f946a0105e2c`.

A separate read-only post-terminal observation did not follow the link. It
found 25 scratch entries: one zero-byte file, 23 direct directories, and one
reparse entry. The only reparse entry is the Windows known-folder junction:

```text
home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5
```

Its absolute target resolves inside the same owned scratch root and is safely
reported only as the relative target:

```text
home/AppData/Local/Microsoft/Windows/INetCache/IE
```

No external target was observed. This fact does not retroactively make `/7`
pass. The current contract has no representation for a contained junction, so
the owner correctly failed closed.

The stable root-cause code is
`windows-inetcache-contained-junction-not-representable-by-current-scratch-contract`.
The owner implementation matches profile `/2`; the defect is the blanket
scratch contract, not evidence of source, converter-build, or MSVC-authority
failure.

## Required General Correction

A later attempt requires a new source-controlled custody profile and wholly
new registration. Simply allowing reparse points is prohibited. The new
contract must classify every entry and accept an internal directory junction
only when all of these conditions are proven:

1. the link itself is a directory junction, never a file symlink, device,
   mount point, socket, pipe, or unknown entry;
2. the target text and normalized target are bounded and recorded without
   exposing the private root publicly;
3. the normalized target is a strict descendant of the same owned scratch
   root;
4. every target path component is direct, present, and independently checked;
5. target resolution cannot escape through another junction or symlink;
6. the inspector never traverses the link and inventories the target through
   its direct path exactly once;
7. duplicate aliases, cycles, chains, broken targets, case-fold collisions,
   external targets, and target drift fail closed;
8. link count, target count, path bytes, tree entries, and aggregate bytes are
   bounded;
9. the terminal binds each link's relative path, normalized relative target,
   link class, and identity; and
10. hostile tests cover internal, external, chained, cyclic, dangling,
    raced, case-conflicting, file-link, and unknown-reparse cases.

The sole current profile must be replaced rather than extended with a legacy
reader or compatibility mode. Historical `/7` bytes remain inert evidence.
No broad `allowReparse`, warning-only path, retry, cleanup, output adoption, or
special case keyed only to `Content.IE5` is acceptable.

## Later Operations Stayed Absent

The environment request and its three outputs, Rust request, and three Rust
roots exist and remain preserved. The seven later registered names remain
absent: the managed request and its three roots, the composition request,
controller evidence root, and composition output root.

No managed preflight, managed build, composition request, controller,
converter launch, managed inspection, execution binding, SLM2 artifact, or
private final verification occurred. No relevant Cargo, Rustc, linker, or
converter build process remained after terminal observation.

## Claim Boundary

`/7` proves one environment materialization, one Rust custody operation, one
zero-exit Rust child, and one preserved candidate converter inside a terminally
failed custody root. It proves no qualified Rust build, managed inspector
build, converter invocation, SLM2 composition, source-framework parity,
native runtime, browser WASM, browser chat, model quality, P2P availability,
catalog announcement, package publication, site deployment, or
MemoryEndpoints operation.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

Attempt `/7` is an immutable technical evidence identity, not a product
generation. TinyRustLM remains one unversioned prelaunch product with no
legacy support, compatibility path, migration, alias, fallback, response
repair, retry, temporary patch, or accepted debt.
