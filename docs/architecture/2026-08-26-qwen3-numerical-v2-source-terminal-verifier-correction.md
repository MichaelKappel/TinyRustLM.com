# Qwen3 Numerical V2 Source-Terminal Verifier Correction

Date: 2026-08-26

Status: maintained read-only verifier implemented and fixture-tested; source
commit, remote equality, output-free verification preregistration, and one real
verification invocation remain pending

## Preserved Owner Result

Operation `qwen3-numerical-c1899de-4891e8a-20260826-v2` was invoked through
its sole owner exactly once. The owner created its registered evidence and
source scratch roots, launched only the publisher-source stage, and closed as
`terminal-failure` with owner reason `source-process-not-pass`.

The source child started once, exited 1 after 45,945 milliseconds, emitted
zero stdout bytes, and emitted one bounded 57-byte safe stderr code:
`source-trace-environment-drift`. The Python executable was unchanged before
and after launch. No timeout, output overflow, spawn fault, stream fault, or
termination request occurred.

The reconstructed, scalar, and trace-verifier launch counts are zero. The
source, reconstructed, and scalar material output roots are absent. The source
scratch root exists and is empty. The private owner evidence root contains nine
direct files and no unexpected member. The operation cannot be retried,
repaired, overwritten, cleaned, adopted, relabeled, or invoked again.

These are private observations pending independent verification. They are not
yet a committed public result.

## Preserved Verification Defect

The first ad hoc read-only terminal verifier was invoked once after owner
termination. It performed no writes and produced no verification receipt. It
failed with its own bounded assertion `verifier_scalar_request`.

Source inspection identified the verifier defect. The scalar child request
correctly has this closed field set:

```text
cases
compositionResultSha256
compositionRoot
evidenceParent
model
operationId
outputRoot
policy
schema
traceProfileId
```

It deliberately has no `registrationSha256` member. The scalar child is bound
through the sole owner request, committed preregistration, composition result,
model identity, evidence binding, and immutable owner terminal. The failed ad
hoc verifier incorrectly required an additional `registrationSha256` member.
That was verifier drift, not evidence drift and not a scalar-owner defect.

The failed verifier invocation remains part of the truthful operation account.
It is not rerun, repaired, or described as a pass. Because its implementation
was process-local and created no file, this architecture record and the new
regression test preserve the failure class and safe code.

## Maintained Correction

`tinyrustlm/tools/qwen3-numerical-source-terminal-verifier.js` is a new
read-only verifier for the sole active request and preregistration schemas. It
does not import the numerical execution owner. It uses only Node built-ins for
bounded reads, strict canonical JSON replay, direct-file and direct-directory
checks, streaming hashes, and path-free result generation.

The verifier has no evidence write API, subprocess API, network API, retry,
repair, fallback, result selection, or legacy schema branch. It accepts only
one source-stage terminal-failure shape and independently reconstructs:

1. the exact owner-request and preregistration binding;
2. all six registered private names;
3. the source, reconstructed, and scalar child requests;
4. the exact scalar request field set without an invented registration field;
5. the binding and start records;
6. the source process arguments identity;
7. Python executable before/after identity;
8. process chronology, one-launch cardinality, exit, and stream identities;
9. the bounded source safe code;
10. the owner decision, claim closure, and zero later-stage launch counts;
11. the complete eight-file pre-terminal inventory and nine-file final
    inventory;
12. an empty source scratch root and absent material output roots; and
13. a path-free verification identity with `writesPerformed: false`.

Unknown, missing, additional, noncanonical, malformed, linked, drifted,
oversized, contradictory, or authority-inflating material rejects with a
bounded safe code.

## Test-First Evidence

The regression was red before the verifier existed. The maintained test now
passes seven cases:

1. verify one complete source-stage terminal failure without changing any
   evidence identity or modification time;
2. accept the exact scalar child and reject an invented
   `registrationSha256` member;
3. reject launch-count inflation and any material output root;
4. reject source-stream drift and an unexpected evidence member;
5. reject process outcome and owner-request binding drift;
6. emit one canonical path-free CLI summary; and
7. prove the verifier source has no evidence writer, subprocess, network, or
   owner import.

Fixture generation uses the producer's current child-request derivation, while
the verifier independently encodes and checks the expected contracts. This
keeps the test useful as a cross-implementation differential rather than a
self-approval path.

## Claim Boundary

The maintained verifier has not yet been invoked against the real private
evidence. Its fixture pass proves only implementation behavior. The owner
operation remains a terminal source-stage failure and establishes no source
trace, quantization comparison, scalar parity, optimized native execution,
browser-WASM execution, browser chat, model quality, P2P availability,
publication, deployment, or campaign progress.

MemoryEndpoints remains unauthorized. Campaign counters remain `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.

## Next Gate

Run the focused verifier and owner-contract tests, diff and privacy checks,
then commit and push the verifier implementation. Freshly prove remote
equality. In a separate output-free registration commit, bind the exact
verifier source, tests, this decision, registration, owner request, owner
terminal, source process terminal, safe stderr identity, and final private
inventory. Only after that second commit is remote exact may the maintained
verifier be invoked once against the immutable real evidence. Its pass or
failure must be preserved without retry or repair.
