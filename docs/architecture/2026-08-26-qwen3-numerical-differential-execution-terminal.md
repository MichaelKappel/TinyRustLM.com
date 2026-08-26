# Qwen3 Numerical Differential Execution Terminal

Date: 2026-08-26
Status: immutable terminal source-process failure; independently verified;
no numerical pass claim

## Decision

Operation `qwen3-numerical-c1899de-aece952-20260826-v1` is permanently
closed as `terminal-failure`. Its sole owner launched the pinned publisher
source arm exactly once. That process exited 1 after 54,038 milliseconds with
the bounded safe code `source-trace-model-load`. The owner stopped before the
reconstructed SLM2, Rust scalar, and read-only verifier stages. No trace output
root was created.

The public bounded result is
`contracts/vnext/qwen3-numerical-differential-execution-result.v1.json`,
9,163 bytes at SHA-256
`a751ef6f6b436f84a18a02483b718cf90efdb872d5546cb0ee70ae0ec8fbaa2d`.
It records identities, counts, status, and safe error codes only. Private
paths, raw streams, source bytes, model bytes, and traces remain outside Git.

This terminal result is not a retryable infrastructure journal. The request,
evidence, empty scratch root, and absence of material output roots are
immutable. They may not be deleted, overwritten, repaired, resumed, adopted,
or relabeled.

## Research And Source Lineage

The design came from the reviewed post-/10 report intake:

- `docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md`;
- `docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md`;
- `docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md`; and
- `wiki/runtime-mirust/reports/tinyrustlm-qwen3-numerical-differential-memory-2026-08-26.md`,
  17,399 bytes at SHA-256
  `5cf598b71d6983996bcba3cb6112e0b4072930a8852637896be9a9b10952cf05`.

Those reports remain advisory. The registration, source-controlled owner,
private evidence, and independent read-only verification provide the local
facts. No report establishes execution or quality by itself.

## Preregistration And Gate

The output-free registration is 24,467 bytes at SHA-256
`469e003e6f50cb3e4bb0574e2bd72c5836edb938eea0345ca1a23b4bfc9906a1`.
It was committed at
`1fbc78e2257089896aef79266d66c23ce8e7b4ee`, tree
`543abd5418d29d86a86a51d1dc2dcf2a0d033e0f`, then pushed and freshly
verified against local `HEAD`, the tracking ref, `FETCH_HEAD`, and the direct
remote branch.

Before the request existed, the maintained standard partition passed 1,541 of
1,543 tests with zero failures and two explicit infrastructure-only skips.
The protected release-surface gate passed 23/23. Its 3,995-byte aggregate is
SHA-256
`b11124b26e2a046b86e9f5a8f665da2af89011d9c4141fdad6af6f1cff3e5dbc`.
Both the maintained verifier and an independent filesystem hash reproduced
that identity.

## Request Custody

The sole private request is 1,458 bytes at SHA-256
`a7a55e245fbec19f01aebabc91239109290123c45132dfbd88723989e5672eeb`.
It was written with create-only semantics, flushed, reopened byte-for-byte,
and independently audited before owner execution.

The audit recomputed:

1. the remote-exact registration commit and tree;
2. the exact four-path registration diff;
3. all 11 source-controlled implementation artifacts from the registered
   parent and current worktree;
4. all five executable lengths and SHA-256 identities;
5. all nine pinned source files, totaling 1,519,207,688 bytes;
6. the closed 598,308,416-byte `/12` `model.slm2` identity; and
7. absence of all five future evidence, scratch, and output roots.

An operator-side PowerShell quoting attempt failed before Node evaluated any
file operation. It opened no registered path, created no file, invoked no
owner, and consumed no operation authority. The successful materialization
used stdin script delivery and created the request once. This observation is
retained rather than hidden, but it is not execution evidence.

## Sole Owner Outcome

The owner invocation count is one. Stage launch counts are:

- publisher source: 1;
- reconstructed SLM2: 0;
- Rust scalar: 0; and
- read-only verifier: 0.

The source process started normally, was not timed out or killed, did not
overflow either stream, and retained an unchanged pinned Python executable.
It emitted zero stdout bytes and 50 stderr bytes. The stderr bytes remain
private; their public-safe identity is SHA-256
`d5a573885f9ffa22be8f9ef11429a4e1feadeeec3618adfff69542e4a51d2b2b`.
The only disclosed diagnostic is `source-trace-model-load`.

That code identifies the source model-load boundary, not its root cause. The
record does not blame the source checkpoint, Transformers, PyTorch, storage,
RAM, or project code without a separate diagnostic reproduction.

## Independent Terminal Verification

One read-only audit recomputed the canonical owner terminal, request,
registration, source process terminal, both stream identities, launch counts,
complete evidence inventory, and root-presence state. It launched no material
process and wrote no evidence.

The private owner terminal is 2,794 bytes at SHA-256
`4e15242ba7c7fe98ca5dc278769029fdf41722c8e90398e2b894d6bef6e193ad`.
The private evidence root contains exactly nine regular files totaling 13,071
bytes. The source scratch root exists and is empty. The source,
reconstructed, and scalar output roots are absent.

## Failure-Driven Next Work

The next implementation must begin from this preserved failure:

1. add a generic model-load diagnostic that exercises the pinned local Qwen3
   source and reports bounded exception class and stage without exposing paths
   or source data;
2. reproduce the failure outside the closed operation under a new diagnostic
   identity;
3. write a minimal failing regression and counterexamples before changing the
   source owner or environment;
4. make one source-owned correction and delete any superseded execution path;
5. run focused and maintained gates, commit, push, freshly fetch, and prove
   direct remote equality; and
6. preregister a wholly new operation with new request, evidence, scratch, and
   output names.

The closed operation must never be invoked again. Its thresholds cannot be
changed and none of its private bytes may be adopted by a successor.

## Claim Boundary

The `/12` structural composition remains verified. This result additionally
proves only that one remote-exact, preregistered owner request was audited,
invoked once, and closed truthfully at the source model-load boundary.

It proves no source trace, source-to-reconstructed parity,
reconstructed-to-scalar parity, optimized-native parity, browser-WASM
execution, browser chat, conversational quality, P2P availability, catalog
announcement, package publication, site deployment, or MemoryEndpoints
continuity.

Campaign counters remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
