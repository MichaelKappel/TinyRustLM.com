# Qwen3 Numerical V2 Source-Terminal Verification: Terminal Ambiguous

Date: 2026-08-26
Status: immutable `terminal-ambiguous`; verifier rejected; no verification
pass or numerical claim

## Decision

Verification operation
`qwen3-numerical-c1899de-4891e8a-20260826-v2-terminal-verification-v1`
is closed forever as `terminal-ambiguous`, reason
`verifier-rejected-and-process-terminal-writer-failed`.

The maintained verifier was invoked exactly once. It wrote no stdout and
wrote the bounded typed rejection `source-terminal-process-binding` to its
registered stderr stream. The orchestration did not durably retain the child
exit code. After the child closed, the first process-terminal writer failed
with `process-terminal-write-failed`. The verifier was not rerun. A later
support action wrote one create-only terminal closure that reports these
facts, claims no pass, and authorizes no retry.

The bounded public result is
`contracts/vnext/qwen3-numerical-source-terminal-verification-result.v1.json`,
6,268 ASCII/LF bytes at SHA-256
`e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa`.
Private paths and raw streams remain outside Git.

## Registered Authority

The output-free registration is 10,440 canonical bytes at SHA-256
`afccb28dc8e4b67e3dff81beb44c74290e01f1c673c9e4a7f3c3989224468860`.
It was committed and pushed at
`7685b91ea9ecbe884bee6603031e52a39f81a6ea`, tree
`1e9d60967396325f4d6be7bcf17f50c4c68c4dab`. Local `HEAD`, the tracking
ref, fresh `FETCH_HEAD`, and the direct remote branch were exact before any
private verification output. Source was clean, and the registered private
output root was absent both at registration and immediately before execution.

The registration authorized one Node invocation, no network, bounded stdout
and stderr, one hour maximum duration, no overwrite, no repair, no retry, and
no second invocation. It bound the maintained 30,633-byte verifier at SHA-256
`82c885cc6bf23caf7c767aa26b0c0d248770f0ca449e5787cbbd77458175fd13`.

## Exact Outcome

The consumed private verification root contains exactly three files totaling
2,684 bytes:

| Member | Bytes | SHA-256 |
|---|---:|---|
| `verifier.stdout.bin` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `verifier.stderr.bin` | 69 | `064f6476e36abbb3e9aeaaf18509b361cbaf4e522145965bbc755667f3390d6f` |
| `verifier.process-terminal.json` | 2,615 | `889c0826eb1b36aabb80ac612a2dbc0c29220ae225a61d63858b2f61f901ad2f` |

The terminal file has schema
`tinyrustlm.qwen3_numerical_source_terminal_verifier_process_terminal.v1`,
status `terminal-ambiguous`, and the same reason code as the public result. It
explicitly records that the late create-only write is closure evidence, not a
verifier rerun or a reconstruction of a successful child outcome.

The source operation remains separately immutable `terminal-failure`. Its
nine owner-evidence files still match the preregistered names, lengths, and
digests and total 13,143 bytes. Its source scratch root remains empty, and the
source, reconstructed, and scalar material roots remain absent. The full
preregistered read-only proof is nevertheless false because the verification
orchestration did not retain the source-evidence metadata snapshot needed for
a before/after comparison.

## Root Cause

The rejection is a verifier contract defect, not evidence drift. The numerical
owner contract registers Python with three identity fields:

```text
basename, byteLength, sha256
```

The normative process terminal records the executable before and after with
two fields:

```text
byteLength, sha256
```

Both recorded executable identities have the registered byte length 104,952
and SHA-256
`4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a`.
The verifier nevertheless required whole-object equality with the three-field
registration object. The extra registered basename made that equality false.

The correction must validate the one normative process-terminal shape and
derive its expected two-field identity from the registration. It must not
accept two wire shapes, add a compatibility reader, mutate historical
evidence, or weaken any independent content check.

## Why The Status Is Ambiguous

The typed verifier rejection is exact and preserved. That alone establishes
that this invocation did not pass. `terminal-ambiguous` is required because
the registered process terminal was not written by the original orchestration,
the child exit code was not durably captured, and the complete registered
metadata-before/after proof was not retained. A later closure may preserve
these omissions; it cannot turn them into observations.

No majority rule, stderr inference, expected-output comparison, or source-code
inspection may relabel the operation as pass. Conversely, no process rerun is
needed to diagnose the general verifier defect.

## Failure-Driven Correction

The next coherent source change is test-first:

1. add a positive fixture proving the two-field executable identity accepted
   by the process-terminal schema;
2. add negative fixtures for wrong byte length, wrong digest, added basename,
   missing field, and unknown field;
3. derive the expected process identity explicitly from the registered
   executable identity;
4. retain closed object shapes and all other exact owner, request, graph,
   stream, inventory, root, and claim checks;
5. run focused and affected tests, then the maintained repository gate;
6. commit, push, freshly fetch, and prove four-way remote equality; and
7. author a separate output-free registration with a wholly new operation ID
   and absent output root before invoking the corrected verifier once.

The current private verification root cannot be reused, deleted, completed,
or adopted by that successor.

## Claim Boundary

This result proves only that one remote-exact verification registration was
consumed once and truthfully closed after a typed verifier rejection and
terminal-writer failure. It does not independently verify the source terminal
failure and does not establish source-framework traces, reconstructed traces,
scalar-native parity, optimized-native parity, browser-WASM execution, browser
chat, behavioral quality, P2P availability, catalog announcement, package
publication, site deployment, or MemoryEndpoints behavior.

Campaign counters remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

