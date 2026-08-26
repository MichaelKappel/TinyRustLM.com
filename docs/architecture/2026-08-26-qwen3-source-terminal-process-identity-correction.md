# Qwen3 Source-Terminal Process Identity Correction

Date: 2026-08-26

Status: source corrected and affected tests green; clean remote-exact source
gate and successor preregistration remain pending

## Preserved History

Verification operation
`qwen3-numerical-c1899de-4891e8a-20260826-v2-terminal-verification-v1`
remains immutable `terminal-ambiguous`. Its maintained verifier invocation
rejected with `source-terminal-process-binding`, and its original process
terminal writer failed. It is not rerun, repaired, completed, overwritten,
adopted, relabeled, or used as pass evidence.

The predecessor numerical owner remains immutable `terminal-failure`. This
source correction changes no private evidence, terminal record, public result,
or historical receipt.

## Defect

The numerical registration identifies Python with exactly three fields:

```text
basename, byteLength, sha256
```

The normative process terminal identifies the executable before and after
launch with exactly two fields:

```text
byteLength, sha256
```

The meaningful registered and observed values matched. The verifier still
compared each two-field process identity to the complete three-field
registration object. Whole-object equality therefore rejected the sole
normative process-terminal shape.

The existing fixture copied the complete registration object into the process
terminal, so it reproduced the verifier's mistaken expectation instead of the
owner's actual wire contract.

## Sole Corrected Contract

The verifier now constructs one expected process identity by projecting only
`byteLength` and `sha256` from the registered Python identity. Before binding,
both `executableBefore` and `executableAfter` are independently validated as
exact two-field artifact references.

This gives two fail-closed verdict classes:

1. Added, missing, malformed, non-integer, negative, or invalid-digest fields
   reject as `source-terminal-process-shape`.
2. Well-formed identities with the wrong byte length or digest, or a changed
   before/after identity, reject as `source-terminal-process-binding`.

The verifier does not accept the three-field terminal shape, strip unknown
fields, infer intent, translate historical records, or support both meanings.
All request, operation, process, stream, inventory, path, terminal, and claim
checks remain unchanged.

## Test-First Evidence

The fixture was first changed to emit the owner's normative two-field process
identity, and hostile cases were added for:

- added `basename`;
- missing `sha256`;
- wrong byte length;
- wrong digest; and
- changed after-launch identity with `executableUnchanged: false`.

Before implementation, the focused file passed 2 and failed 7 tests. The
ordinary valid case failed with `source-terminal-process-binding`, and the
added-field case returned binding rather than the required shape verdict.

After implementation, the focused file passes 9/9. The complete verification
registration, immutable result, verifier, and durable-memory union passes
27/27. The adjacent model-load, environment, differential-profile, and owner
union passes 37, fails zero, and retains one pre-existing conditional
pinned-Python skip across 38 tests.

Corrected source identities before the clean source checkpoint are:

| File | Bytes | SHA-256 |
|---|---:|---|
| `tinyrustlm/tools/qwen3-numerical-source-terminal-verifier.js` | 30,944 | `b074082a2385e2cde734b3e11832dfed56496afc2dd21645a18457b9cade8ee5` |
| `tinyrustlm/tests/qwen3-numerical-source-terminal-verifier.test.js` | 15,891 | `cd8f6044e8f881f2a0fc8b6573131e8cfd2d6d494eef728bb748dd3a721c32ab` |

## Source And Execution Ordering

1. Commit this correction and its tests from the canonical worktree.
2. Push it and freshly prove local `HEAD`, tracking ref, `FETCH_HEAD`, and the
   direct remote ref are equal.
3. Run the complete standard and protected release-surface gates from the
   clean exact source into a wholly new external evidence root.
4. Preserve the gate account in durable UAI memory and push that checkpoint.
5. Create a separate output-free successor verification registration with a
   wholly new operation ID and absent private output root.
6. Commit, push, freshly fetch, and prove that registration remote-exact before
   materializing any successor verification output.
7. Invoke the corrected verifier once. Preserve either terminal outcome
   without retry or repair.

The successor cannot reuse the v1 verification operation ID, root, streams,
terminal, registration, or public result.

## Claim Boundary

This is source and fixture evidence only. It is not independent verification
of the predecessor source terminal and does not prove source-framework traces,
scalar-native parity, optimized-native parity, browser-WASM parity, browser
chat, model quality, P2P availability, package publication, deployment, or
campaign progress.

MemoryEndpoints remains unauthorized. Campaign counters remain exactly
`0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
