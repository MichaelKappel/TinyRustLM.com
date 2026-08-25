# Qwen3 Real Composition Execution /4 Result And Build Custody Defect

Date: 2026-08-25

Status: terminal prelaunch failure; one Rust build attempt observed, no managed
build, private request, controller, converter, evidence root, output root,
composition artifact, or structural decision

## Result

Execution `/4` is permanently closed. Its bounded public result is
`contracts/vnext/qwen3-real-composition-execution-result.v4.json`, 5,293
canonical bytes at SHA256
`c928b55cf9eb871c09b7f1e1aacf1983bf3a7e2fe6ca4697aa58c50648187a35`.

The registration was correctly committed and pushed as
`8948baf1d21a73cde5781cf74a7c5020fd0b8cca`, tree
`6a25e28f45b9bf69d82782efb965a9c0da5dee76`. Local `HEAD`, tracking,
fresh `FETCH_HEAD`, and the actual remote branch were exact. The registration
commit changed only its four authorized public paths, and all five registered
private roots were absent before execution began.

## Observed Build

The registered Rust build command was launched once with the exact offline,
nonincremental environment and new private target root. Its raw stdout is zero
bytes at SHA256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
Its raw stderr is 1,874 bytes at SHA256
`edf2073ffe971fea9394d06c99c7fc201f34515aad85b3d2c41ae9a097a9fdae`.

The raw stderr contains Cargo's final `Finished` text. A direct regular x64 PE
candidate named `tinyrustlm-convert.exe` exists at 852,992 bytes with SHA256
`cd24a738b327b89d03501205301e89321bbd3955be91dfb245d2219a8b9201d5`.
The preserved build root contains 366 files totaling 105,438,470 bytes. No
Cargo, Rust compiler, linker, converter, or related build process remained
after reconciliation.

Those observations are deliberately not promoted to successful-build
evidence. The registered build contract requires a captured child exit code
of zero. The ad hoc process observer waited for the child, then attempted to
read an unavailable process `ExitTime` value before capturing `ExitCode`.
The observer terminated with an error, leaving the child exit code unknown.
No Windows Security or Sysmon process-stop record was available to recover it.
Cargo text and executable presence are indirect evidence and cannot replace
the missing exit status.

## Root Boundary

The `/4` control and Rust build roots now exist and are immutable evidence.
The managed-build, controller evidence, and composition output roots were
never created. No private request or binding exists. Controller invocation,
converter launch, managed build, and managed inspection counts are all zero.

The control/build roots and candidate executable may not be deleted,
overwritten, adopted, resumed, repaired, or reused. A later attempt requires a
new registration and five wholly new logical roots.

## General Cause And Required Correction

The defect is evidence custody, not known Rust source, converter, model source,
or composition behavior. An operator-local wrapper performed a material build
but did not durably capture the process status before attempting ancillary
process metadata.

Before another real attempt, build custody must become a source-controlled,
tested owner with these properties:

1. one strict canonical request schema;
2. exact source commit/tree, command, environment, runtime, and root binding;
3. create-only direct control and target roots;
4. separate bounded raw stdout and stderr opened before launch;
5. child exit status captured immediately after wait and before optional
   timestamps or diagnostics;
6. create-only terminal build record written for every spawn, overflow,
   timeout, signal, nonzero, zero, or observer failure;
7. executable inventory and PE/hash capture only after the status is durable;
8. no retry, resume, cleanup, stale-binary selection, or candidate adoption;
9. hostile tests for missing `ExitTime`, log overflow, spawn failure, process
   termination, output collision, and observer interruption; and
10. preregistered source/runtime identities before another private root exists.

The correction must not simply add a null check to another one-off command.
The custody owner is part of the evidence system and must be independently
testable before it is trusted with an irreversible build.

## Claim Boundary

`/4` proves only that one registered Rust build process was attempted and that
the listed raw logs, candidate executable bytes, build-root inventory, process
closure observation, and absent later roots were observed. It does not prove a
successful release build, converter invocation, structural composition,
source-framework parity, native inference, browser-WASM inference, browser
chat, model usefulness, P2P availability, catalog announcement, package or
site publication, MemoryEndpoints continuity, or campaign credit.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
