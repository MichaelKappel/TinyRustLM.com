# Deterministic Windows X64 MSVC Environment Authority

Date: 2026-08-25

Status: implemented and locally verified; build-custody integration remains the
next required source-controlled gate

## Decision

TinyRustLM has one source-controlled authority for discovering, selecting,
binding, materializing, and revalidating the x64 MSVC and Windows SDK closure
needed by future `x86_64-pc-windows-msvc` Rust builds:

- profile: `contracts/vnext/windows-x64-msvc-environment-profile.v1.json`;
- owner: `tinyrustlm/tools/windows-x64-msvc-environment.js`;
- hostile synthetic tests:
  `tinyrustlm/tests/windows-x64-msvc-environment.test.js`; and
- explicit installed-machine observation:
  `tinyrustlm/tests/windows-x64-msvc-environment-observation.test.js`.

This is a technical schema identity inside one unversioned prelaunch product.
It introduces no second product generation, legacy path, migration, alias,
fallback linker, retry, repair, or best-of-N selection.

The terminal execution `/6` remains immutable. Its exact build environment did
not contain a parent that resolved `link.exe`; the installed linker observed
outside that environment cannot be retroactively adopted. The request, both
Rust custody roots, six custody records, and partial target remain inert
historical evidence. The environment authority is for a wholly new future
operation only.

## Frozen Identities

The current profile is 6,510 canonical ASCII/LF bytes at SHA-256
`76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607`.

The current implementation is 54,052 canonical ASCII/LF bytes at SHA-256
`48b550da9fa0a81735467d2af6dc733fa5ba2df4e9f815e505c37b57bfdb4ebf`.

The hostile synthetic test is 16,180 canonical ASCII/LF bytes at SHA-256
`00963fc4b5931fbb36db2b448e4e1b941cb6b088b8ffcd23153de7267f27c89d`.

The explicit real-installation observation test is 5,023 canonical ASCII/LF
bytes at SHA-256
`8eee95bca6b81b22af402917b8074b5efb012bcf9935692cbbc8f4205f820825`.

These identities describe this source checkpoint. A source change invalidates
the corresponding identity and requires the architecture and UAI state to be
updated before a future registration binds it.

## Request Boundary

The owner accepts one canonical UTF-8/LF JSON request. Unknown, missing,
reordered, compact, BOM-prefixed, or extended material rejects. The request
binds:

1. one operation ID and fixed materialization timestamp;
2. the exact profile path, length, SHA-256, and profile ID;
3. one exact `vswhere.exe` path, length, and SHA-256;
4. one Windows Kits root and one System root;
5. one Visual Studio product-line version;
6. inclusive minimum and exclusive maximum four-part installation versions;
7. inclusive minimum and exclusive maximum four-part SDK versions;
8. three distinct, absent, direct-sibling output paths; and
9. an ordered prohibited-write-root set that must contain `D:\`.

Every request path must be a normalized uppercase local-drive absolute path.
UNC and device namespace paths reject. Every existing component is inspected;
symbolic links, junction-style aliases that resolve elsewhere, non-direct
parents, invalid file kinds, and path escapes reject.

The output parent must already exist. The owner never creates a directory,
searches for a convenient output location, writes `D:`, or adopts an existing
output.

## Discovery And Selection

The owner invokes only the request-bound `vswhere.exe`, without a shell, using
the exact arguments:

```text
-all
-products
*
-requires
Microsoft.VisualStudio.Component.VC.Tools.x86.x64
-format
json
-utf8
```

The child receives only the request-bound `SystemRoot`. A nonzero exit,
signal, process error, empty or oversized stdout, any stderr, malformed JSON,
more than 64 candidates, or malformed candidate metadata rejects.

Every candidate is normalized before selection. Eligibility requires:

- complete;
- launchable;
- non-prerelease;
- no reboot required;
- exact requested product-line version; and
- installation version inside the declared range.

The highest eligible four-part installation version is selected. Two eligible
instances at the same highest version are ambiguous and reject. The owner does
not try candidates in sequence or retain whichever one builds.

The selected instance's documented default toolset file must contain exactly
one strict three-part version. The only accepted tool directory is
`VC/Tools/MSVC/{version}/bin/Hostx64/x64`; the only accepted MSVC library root
is `VC/Tools/MSVC/{version}/lib/x64`.

SDK selection computes the set intersection of strict four-part version
directories under `Include`, `Lib`, and `bin`, filters it through the requested
range, orders it numerically, and selects the highest complete candidate. An
incomplete higher version is not eligible. An inspection error, malformed
version entry, link, or invalid present path is terminal and never becomes a
fall-through to an older SDK.

A complete SDK contains:

- `Include/{version}/shared`;
- `Include/{version}/ucrt`;
- `Include/{version}/um`;
- `bin/{version}/x64`;
- `Lib/{version}/ucrt/x64`; and
- `Lib/{version}/um/x64`.

## Closure And Binary Checks

The owner inventories all direct regular files in the selected MSVC and SDK
tool directories. It inventories all direct `.lib` regular files in the
selected MSVC, UCRT, and UM x64 library directories. Inventory members are
strictly ordered by unsigned UTF-8 bytes and bound by name, byte length,
SHA-256, aggregate bytes, member count, required member set, and a
domain-separated closure hash.

The owner rejects case-insensitive name collisions, links, empty members,
oversized files, oversized roots, malformed archives, or mutation during a
streamed read. Small canonical documents are read, hashed, and identity-checked
through one open descriptor. Large closure files use bounded 1 MiB streaming
with pre-read, post-read, and final-path filesystem identity checks.

Named MSVC tools are `cl.exe`, `dumpbin.exe`, `lib.exe`, `link.exe`, and
`ml64.exe`. Named SDK tools are `mt.exe` and `rc.exe`. Every named tool must be
a structurally valid PE x86-64 image whose bytes exactly equal its inventory
record.

Named required MSVC archives are `libcmt.lib`, `libvcruntime.lib`,
`oldnames.lib`, and `vcruntime.lib`. Required UCRT archives are `libucrt.lib`
and `ucrt.lib`. Required UM archives are `advapi32.lib`, `bcrypt.lib`,
`kernel32.lib`, `ntdll.lib`, `userenv.lib`, and `ws2_32.lib`. Every selected
`.lib` begins with the COFF archive magic `!<arch>\n` and is byte-bound.

These checks prove static identity and the narrow structural properties named
above. They do not prove that Cargo, rustc, the linker, or the converter will
execute successfully.

## Exact Environment

The rendered environment contains exactly these ordered entries:

- `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER`;
- `LIB`;
- `LIBPATH`;
- `PATH`;
- `Platform`;
- `UCRTVersion`;
- `UniversalCRTSdkDir`;
- `VCINSTALLDIR`;
- `VCToolsInstallDir`;
- `VCToolsVersion`;
- `VSCMD_ARG_HOST_ARCH`;
- `VSCMD_ARG_TGT_ARCH`;
- `WindowsSdkDir`;
- `WindowsSDKLibVersion`; and
- `WindowsSDKVersion`.

`PATH` contains only the selected MSVC Hostx64/x64 bin, selected SDK x64 bin,
and request-bound System32, in that order. `LIB` and `LIBPATH` contain only the
selected MSVC x64, UCRT x64, and UM x64 roots, in that order. The Cargo target
linker is the exact absolute selected `link.exe`; it is not a bare command.

The owner proves that `cl.exe`, `lib.exe`, `link.exe`, `ml64.exe`, `mt.exe`,
and `rc.exe` each resolve from exactly one expected `PATH` role. A colliding
command in another bound role, including System32, rejects. No Developer
Command Prompt environment is inherited.

## Public And Private Evidence

All documents are completely rendered before the first output write.
Materialization order is:

1. private binding;
2. public lock; and
3. terminal record.

The private binding contains exact private paths, filesystem identities,
selected installation identity, roots, tool paths, and full environment
values. It remains outside Git and publication.

The public basis contains public versions, product/channel IDs, bounded counts,
arguments, required roles, inventories, tool hashes, environment value hashes,
and command-resolution results. Private environment values use
domain-separated hashes. The Visual Studio instance ID is also
domain-separated. No private absolute path appears.

The private binding binds the exact public-basis length and SHA-256. The public
lock binds the exact private-binding length and SHA-256 and embeds the exact
public basis. The terminal record binds the request, public basis, private
binding, public lock, selected versions, one-shot policy, and explicit claim
boundary.

Each output uses a deterministic same-directory staging name. The owner opens
the staging file create-only, writes all bytes, flushes the file, and creates
the absent final name through a same-volume hard link. It proves staging and
final names refer to the same file, rereads the final bytes, and only then
removes staging. Existing final or staging material rejects. A failure leaves
the partial operation inert and forbids same-operation resume, cleanup, repair,
or overwrite.

The profile deliberately does not claim directory-entry power-loss durability.
It claims file flush, atomic create-only hard-link publication, and exact final
readback. A later requirement for durable directory-entry proof must replace
this profile cleanly before any operation that requires that stronger claim;
it must not be implied retroactively.

## Revalidation

`validate` is read-only. It reopens the canonical request, revalidates profile
and `vswhere` identities, reruns exact discovery, reselects the installation and
SDK, reinventories and rehashes every closure member, rerenders all three
documents, and requires exact byte equality with each materialized output.

Any installer servicing, added or removed member, changed tool, changed SDK,
changed raw discovery output, changed environment value, changed filesystem
identity, changed request, changed profile, or changed selected installation
rejects before future child launch.

The current source-controlled build-custody owner does not yet consume this
authority. The next clean technical contract must make read-only exact
revalidation mandatory immediately before its sole child process launch and
must require the registered command environment to contain these exact entries
without override.

## Verification

The synthetic gate passes 8 of 8 tests. It covers:

- profile identity and no-legacy/no-fallback policy;
- unknown, reordered, compact, and prohibited-root request rejection;
- incomplete-highest SDK exclusion and highest-complete SDK selection;
- exclusion of a newer unrequested Visual Studio product line;
- public/private binding and public path redaction;
- exact regeneration and validation;
- equal-highest Visual Studio ambiguity;
- System32 `link.exe` collision;
- post-lock library-byte drift;
- injected failure between private and public publication; and
- bounded CLI errors without private-path disclosure.

The explicit real-machine observation ran with
`TINYRUSTLM_REAL_MSVC_ENVIRONMENT_OBSERVATION=1` and passed 1 of 1 in
7,280.3864 ms. It invoked the installed standard `vswhere`, selected a Visual
Studio 2022 x64 toolset and complete Windows 10 SDK, validated seven named x64
tools, five complete inventories, six unique command resolutions, materialized
all evidence in an owned C: temporary root, regenerated the closure, required
byte-exact equality, found no absolute Windows path in public evidence, and
removed the owned test root. It did not write `D:`.

The widened adjacent gate passes 54 of 54 tests across this authority, sole
build custody, immutable `/6` closure, architecture decisions, and the vNext
contract inventory.

## Claim Boundary And Next Step

This checkpoint proves one source-controlled environment selection and
evidence mechanism plus one read-only observation of the installed closure. It
does not prove a successful Rust build, converter, SLM2 artifact, structural
composition, native inference, browser WASM, chat quality, P2P availability,
publication, deployment, MemoryEndpoints, or campaign progress.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain exactly 0/20 qualified models, 0/50 deletion-backed browser rounds,
0/25 authorized live memory rounds, 0/40 current outside-network lane proofs,
and 0/20 live catalog announcements.

After this change is committed, pushed, freshly fetched, and equal across local
HEAD, tracking, `FETCH_HEAD`, and direct remote, replace the current custody
profile with one clean technical schema that binds and immediately revalidates
this authority. Run its hostile and real-Windows gates, update source truth,
commit/push/fresh-verify again, and only then consider a wholly new output-free
composition registration with new absent names. No `/7` material exists or is
authorized by this checkpoint.
