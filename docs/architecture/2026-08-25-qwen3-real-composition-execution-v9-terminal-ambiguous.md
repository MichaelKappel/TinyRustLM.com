# Qwen3 Real Composition Execution `/9` Terminal Result

Date: 2026-08-25

Status: terminal ambiguous; registration closed; candidate bytes preserved but
not structurally qualified

## Decision

Technical execution `/9` is complete and cannot be resumed or retried. Its
canonical public-safe result is
`contracts/vnext/qwen3-real-composition-execution-result.v9.json`, 16,578
canonical ASCII/LF bytes at SHA-256
`e22ec93b089beb814ee88ba4221213e5eb73920f81fd74f5ce5eec547eab9414`.
The private verification is 42,323 bytes at SHA-256
`55bc8d97dc4f7e11cc6ec83723f2724e6bfe8654bf0b0ab61af7b92593ce3471`
and records `terminal-ambiguous` with reason code
`controller-raw-streams-absent-and-managed-inspection-intent-path`.

This is not a structural composition pass. It does not qualify, release,
adopt, publish, or grant campaign credit to the candidate output. No failed or
missing evidence was reconstructed after execution.

## Observed Passes

The exact remote registration remained unchanged throughout the operation.
The one registered Windows x64 MSVC environment materialization passed and
bound Visual Studio 2022 installation `17.14.37531.7`, MSVC toolset
`14.44.35207`, and Windows SDK `10.0.26100.0`.

Both source-controlled build-custody `/4` operations passed:

- Rust custody launched one locked release build, qualified one x64 scratch
  inspector and one x64 converter, and passed its bounded no-follow scratch
  inspection.
- Managed custody launched one locked no-restore, no-incremental build,
  qualified its five required outputs, staged the byte-identical Rust scratch
  inspector, and passed its bounded no-follow scratch inspection.
- Both operations bound `APPDATA`, `LOCALAPPDATA`, `TEMP`, and `TMP` to exact
  owned environment-root children and validated the prelaunch directory
  inventory and authority closure.

The controller launched the converter exactly once. The converter exited zero,
emitted no stderr, and created the exact ten-file success inventory. The
candidate `model.slm2` is 598,308,416 bytes at SHA-256
`a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7`.
The Tokenizer2 member is 7,038,773 bytes at SHA-256
`cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
These identities describe preserved private candidate bytes, not qualified
product artifacts.

## Terminal Defects

Two independent evidence defects prevent a structural pass.

### Controller Outer Streams

The registration required create-only `controller.stdout.bin` and
`controller.stderr.bin` records in addition to the controller-owned converter
streams. The controller invocation was not wrapped by a source-owned process
owner that opened those two registered files before launch. Both files are
absent.

The converter stdout and stderr are intact, as are the controller binding,
start, and terminal records. Those records cannot substitute for missing outer
streams. Reconstructing empty files or copying remembered console output after
the process would invent evidence and is forbidden.

Root cause is established as an orchestration ownership defect:
`controller-invocation-did-not-own-registered-outer-stream-capture`.

### Managed Inspection Path

The managed inspection intent itself is canonical: 1,382 bytes at SHA-256
`4a9859af23a9ad38b1cda2901b3db8df1ec62f2efc01db23a751676d1bfa1a49`.
The exact managed inspector and exact `dotnet.exe` remained unchanged.

The sole managed-inspection invocation received a fully qualified path using
noncanonical Windows separators. The inspector intentionally requires the
argument to equal the platform-canonical fully qualified path byte-for-byte.
It therefore exited `1`, emitted no stdout, and wrote one 140-byte typed error
to stderr:

```text
managed-inspection-intent-path
```

The intent content and durable output were never inspected. Calling the same
inspector again with rewritten separators would be a retry under the same
registration and is not authorized.

## Evidence Boundary

All created private requests, build roots, environment roots, controller
evidence, candidate output, managed-inspection streams, and final verification
remain immutable outside Git. Absolute paths and raw private streams are not
published. The public result contains only bounded status, sizes, hashes,
typed codes, and non-secret tool identities.

Execution `/9` cannot be:

- retried or resumed;
- cleaned, repaired, overwritten, or completed after the fact;
- adopted by a later registration;
- relabeled as a structural pass;
- used for source-framework, native-runtime, browser-WASM, browser-chat,
  quality, P2P, catalog, package, site, or MemoryEndpoints claims; or
- counted toward any campaign target.

## Required General Correction

The next attempt requires one source-controlled end-to-end orchestration owner,
not another ad hoc shell sequence. Before any child launch it must:

1. parse and validate one exact preregistered request;
2. normalize every child argument with the platform path owner and require the
   resulting canonical Windows form;
3. open every registered stdout, stderr, start, and process-terminal artifact
   create-only before launch;
4. enforce exact executable, assembly, environment, duration, and byte limits;
5. preserve raw streams byte-for-byte and durably finalize one process terminal;
6. invoke the managed inspector no more than once;
7. independently rehash every applicable evidence edge; and
8. write the final verification create-only without relying on remembered
   console output.

Regression tests must prove canonical and noncanonical path forms, spawn
failure, nonzero exit, overflow, timeout, missing streams, contradictory
terminal evidence, and the exact pass path. The owner must have no converter
launch API during managed inspection and no retry, repair, compatibility,
fallback, or stale-output adoption path.

Only after that implementation, its complete clean gates, a pushed and freshly
verified registration commit, and wholly new absent private names may another
one-shot attempt begin.

## Claim Boundary

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`. The preserved
candidate does not change those values. Even a later structural pass would
still require independent source/native parity, real-browser WASM parity,
untouched quality evaluation, working browser-local acquisition and multi-turn
chat, and separately authorized P2P and publication evidence.
