# Owned Application-Data Build Custody

## Decision

TinyRustLM has one current Windows x64 build-custody contract:
`tinyrustlm.source-controlled-build-custody/4`. The number is a technical
identity for exact request and evidence bytes. It is not a TinyRustLM product
version.

Custody `/4` replaces `/3` outright. No current reader accepts `/3`, no profile
selector negotiates between them, and no migration, alias, fallback, retry,
repair, or output-adoption path exists. Historical executions continue to
verify their exact `/3` bytes from their frozen Git parents. The current tree
contains only `contracts/vnext/build-custody-profile.v4.json`.

The replacement binds the two Windows application-data locations used by the
installed .NET/NuGet build closure to owned scratch:

- `APPDATA = <environmentRoot>/home/AppData/Roaming`;
- `LOCALAPPDATA = <environmentRoot>/home/AppData/Local`;
- `TEMP = <environmentRoot>/temp`; and
- `TMP = <environmentRoot>/temp`.

The owner validates those exact canonical absolute paths before creating any
control, target, or environment root. It then creates the following direct
non-reparse directory closure before child launch:

1. `home`;
2. `home/AppData`;
3. `home/AppData/Local`;
4. `home/AppData/Roaming`; and
5. `temp`.

The environment root still has exactly two direct children, `home` and
`temp`. The existing source-built no-follow scratch inspector inventories all
nested state after the child and retains the same strict same-root junction
policy.

## Predecessor Failure Boundary

Execution `/8` remains terminal and immutable. It ran the registered managed
custody child once. That child exited `1`; custody recorded
`build-custody-child-nonzero`; the bounded diagnostic included `NETSDK1060`,
an assets-lock read failure, and exception parameter `path1`. It also created
untracked zero-byte `NuGet/Migrations/1` under the source working directory.
That file was preserved outside Git as an unregistered side effect.

Those observations did not by themselves prove a cause. This implementation
does not reinterpret `/8`, use its Rust outputs, create its three absent
composition names, repair its output, or rerun any part of it.

## Causal Experiment

`tinyrustlm/tests/managed-build-isolated-environment.test.js` reproduces the
exact relevant managed command outside execution `/8` and outside every
registered private root. Each case receives a new owned temporary root, a new
working directory, a new output directory, a staged scratch-inspector input,
the exact installed `dotnet` executable, the packages path declared by the
existing `project.assets.json`, no restore, no incremental build, no shell,
bounded output, and an explicit environment.

The experiment changes one location class at a time:

1. Without `APPDATA` or `LOCALAPPDATA`, the build exits nonzero with
   `NETSDK1060` and `Value cannot be null. (Parameter 'path1')`; relative
   `NuGet/Migrations/1` also appears under the owned working directory.
2. With only `APPDATA` bound, the same no-restore build succeeds and emits all
   five required files, proving that the roaming application-data path is the
   first causal divergence for the assets-lock failure. The relative NuGet
   migration marker still appears, independently preserving the second
   defect.
3. With `APPDATA` and `LOCALAPPDATA` both bound to owned direct directories,
   the build succeeds, emits all five required files, creates no migration
   marker under the working directory, and places the marker under the owned
   local application-data directory.

The experiment therefore establishes two distinct missing inputs rather than
one broad "environment problem":

- `APPDATA` is required to read the assets lock under this isolated command;
- `LOCALAPPDATA` is required to keep NuGet migration state out of the working
  directory.

Adding `ProgramData` did not change the relative migration behavior during
development and was rejected as a solution. The maintained contract does not
copy the ambient process environment, add a restore, change the command, use a
new packages folder, retry, or permit source mutation.

## External Implementation Context

The local experiment is authoritative for this repository. Public NuGet code
also explains the split: `NuGetEnvironment.GetFolderPath` maps Windows
`ApplicationData` to `APPDATA` and Windows `LocalApplicationData` to
`LOCALAPPDATA`. NuGet's migration runner has separately been reported to use
the local-application-data special folder for `NuGet/Migrations`.

Public references retrieved 2026-08-25:

- NuGet client source:
  <https://github.com/NuGet/NuGet.Client/blob/dev/src/NuGet.Core/NuGet.Common/PathUtil/NuGetEnvironment.cs>
- NuGet issue documenting the migration-directory behavior:
  <https://github.com/NuGet/Home/issues/12712>

These public references are explanatory only. They do not replace the exact
installed-tool test, and their mutable branches are not source identities for
the custody decision.

## Sole Contract

The exact profile is:

- path: `contracts/vnext/build-custody-profile.v4.json`;
- schema: `tinyrustlm.build-custody-profile.v4`;
- profile ID: `tinyrustlm.source-controlled-build-custody/4`;
- byte length: 10,274; and
- SHA-256:
  `26b75c36911c14d744a764c19d8a40ec0c28762add5e6616501080120aad9b45`.

Its evidence family is solely:

- `tinyrustlm.build-custody-request.v4`;
- `tinyrustlm.build-custody-binding.v4`;
- `tinyrustlm.build-custody-start.v4`;
- `tinyrustlm.build-custody-process-terminal.v4`;
- `tinyrustlm.build-custody-scratch-inspection-process-terminal.v4`;
- `tinyrustlm.build-custody-terminal.v4`; and
- `tinyrustlm.build-custody-summary.v4`.

Requests remain canonical, closed, source-bound, create-only, one-shot, and
unknown-field rejecting. The owner still requires the exact Git source,
source tree, branch, owner, profile, Node runtime, child command, taskkill
binary, MSVC environment authority, scratch-inspector profile, three absent
sibling roots, capture ceilings, and sorted required outputs.

`APPDATA`, `LOCALAPPDATA`, `TEMP`, and `TMP` are required supplemental entries.
They may not overlap a case-insensitive authority-owned name. Their values are
cross-checked against `environmentRoot`; caller-selected absolute paths are
not accepted. `HOMEDRIVE`, `HOMEPATH`, and `USERPROFILE` continue to bind the
same owned `home` directory.

## Execution Order

The owner performs the following order for a future registered operation:

1. Parse and validate the canonical `/4` request without writing.
2. Validate exact committed source, owner, profile, runtime, command, and
   termination identities.
3. Regenerate and compare the complete MSVC environment authority.
4. Combine only authority entries and request-bound supplemental entries.
5. Reject missing, duplicate, overlapping, noncanonical, external, or
   mismatched application-data and temporary paths.
6. Prove all three operation roots absent and their direct parent valid.
7. Write the create-only binding.
8. Create the target root, environment root, and five deterministic
   environment directories with direct non-reparse inspection.
9. Write the create-only start record.
10. Launch the exact child once with the exact combined environment.
11. Capture and fsync process status before optional diagnostics.
12. Revalidate the MSVC environment after every process outcome.
13. On a zero exit, inventory required outputs and prove exact source and Git
    cleanliness, including untracked files.
14. Invoke the exact source-built scratch inspector once, preserve its raw
    streams and process terminal, and require one canonical passing
    observation.
15. Revalidate environment and source identities again before a pass.
16. Write one create-only terminal. Never clean or adopt a failed root.

## Regression Boundary

The focused Windows x64 custody suite passes 21/21 and now proves:

- `/3` has no maintained profile file;
- `/3` request and profile identities reject;
- missing `APPDATA`, `LOCALAPPDATA`, `TEMP`, or `TMP` rejects;
- external `APPDATA`, `LOCALAPPDATA`, or `TMP` rejects before root creation;
- exact owned values reach the child and no ambient caller sentinel does;
- a successful empty-scratch fixture inventories exactly five directories;
- source, environment, helper, output, timeout, overflow, collision, process,
  observer-death, and contained/external junction behavior remains closed.

The installed-SDK causal regression passes 1/1. It is intentionally separate
from the synthetic custody owner suite so a future NuGet or SDK behavior
change is visible rather than normalized into fixture logic.

## Clean-Slate Boundary

This is one incompatible technical replacement inside the sole prelaunch
product. There is no product V2. Profile `/3` is not retained as a reader,
writer, command switch, test fixture, migration source, alias, fallback, or
alternate execution mode. Immutable Git history and terminal `/8` evidence
remain audit truth only.

No current request, private root, build output, conversion, SLM2 artifact,
source-framework parity result, native inference, browser chat, quality result,
P2P proof, package publication, deployment, MemoryEndpoints operation, or
campaign credit is created by this change. A future material operation
requires a new output-free registration that binds the exact committed `/4`
profile and owner with wholly new absent names.
