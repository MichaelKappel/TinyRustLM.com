# Qwen3 Numerical Successor Owner Clean Cut

Date: 2026-08-26
Status: implementation complete; focused and canonical clean gates green;
implementation commit/push proof complete; durable-memory checkpoint,
successor preregistration, and execution remain

## Decision

The sole active Qwen3 numerical execution owner now accepts only these current
technical contracts:

- `tinyrustlm.qwen3_numerical_execution_request.v2`;
- `tinyrustlm.qwen3_numerical_differential_execution_preregistration.v2`;
- `tinyrustlm.qwen3_numerical_execution_owner_contract.v2`; and
- `tinyrustlm.qwen3_numerical_source_request.v2`.

Its one active registration path is
`contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json`.
That registration does not exist at this implementation checkpoint. It must be
authored separately against an exact, green, pushed parent commit so its
implementation identities are not self-referential.

The numeric suffixes identify technical contracts. TinyRustLM remains one
unversioned prelaunch product. There is no product V2, migration surface,
compatibility reader, alias, shim, dual parser, runtime translation, fallback,
retry, repair, or accepted debt.

## Immutable Predecessor

Operation `qwen3-numerical-c1899de-aece952-20260826-v1` and its v1
preregistration remain immutable historical evidence. The operation launched
the source stage once, ended `terminal-failure` at
`source-trace-model-load`, and launched neither reconstructed, scalar, nor
verifier stages. It cannot be invoked, resumed, repaired, overwritten,
deleted, adopted, translated, or promoted.

The v1 preregistration test now verifies its canonical bytes, fixed digest,
source graph, names, claims, and closed counters without passing those bytes
to the active production validator. Historical interpretability therefore
does not preserve an executable v1 acceptance path.

## Corrected Source Closure

The active owner validates the complete source request before creating private
execution roots. It requires:

- Python 3.12.10;
- PyTorch 2.7.0;
- Transformers 4.51.0;
- Safetensors 0.5.3;
- Tokenizers 0.21.1;
- NumPy 2.2.5;
- Accelerate 1.14.0; and
- psutil 7.2.2.

It also requires CPU float32 eager attention, one intra-operation thread, one
inter-operation thread, deterministic algorithms, local-files-only loading,
and `networkAllowed: false`. Environment-authority and environment-lock
references are closed content identities, not ambient configuration.

This closes the contract gap exposed by the preserved model-load failure. A
request omitting Accelerate, omitting psutil, changing either version,
enabling network access, naming the former source-request schema, or carrying
unknown framework fields rejects before material execution.

## Registration Ordering

The successor sequence is deliberately split:

1. test and commit this sole active owner implementation;
2. run the complete canonical clean gate;
3. push and prove local HEAD, tracking ref, fresh `FETCH_HEAD`, and direct
   remote ref equality;
4. record that implementation checkpoint in durable `.uai` memory;
5. choose one wholly new operation ID and six derived private basenames;
6. prove all six names absent beneath the owned external evidence parent;
7. author an output-free v2 preregistration that binds the exact parent,
   tools, profiles, model/source identities, executable identities, cases,
   thresholds, limits, and claim boundary;
8. test, commit, push, fetch, and prove that registration remote-exact;
9. re-prove every future name absent without creating it;
10. materialize one canonical private owner request create-only; and
11. invoke the sole owner once.

No request, scratch root, output root, trace, stream, process, or receipt may
exist before the registration is remote-exact. A launch or ambiguous launch
observation consumes the successor identity. Any failure remains terminal and
immutable.

## Test-First Evidence

The focused tests were first observed failing against the old owner. They now
require:

- the v2 registration path and request schema;
- the v2 owner and preregistration schemas;
- registration profile identity `/2`;
- exact rejection of former v1 active schemas and profile identity;
- exact seven-package source framework metadata in addition to Python;
- rejection of missing Accelerate, changed psutil, and enabled network access;
- one-launch, no-retry, no-overwrite, no-repair terminal policy; and
- byte-exact preservation of the historical v1 registration without active
  validation.

The focused result is 21 passed, zero failed, and zero skipped. The broader
pinned-environment numerical and model-load suite passed 53/53 with zero skip.

## Clean Implementation Checkpoint

The implementation checkpoint is commit
`b9b820299e463db3469b6cc5fc156b95aadc99eb`, tree
`7d6ec9ef5639528b7e9188495670362ef6ae65f3`. Immediately after push and a
fresh fetch, local `HEAD`, the tracking ref, `FETCH_HEAD`, and the direct
remote branch ref were identical and the worktree was clean.

The wholly new external clean-gate root
`qwen3-numerical-successor-owner-clean-gate-20260826-v1` produced:

- canonical standard partition: 1,568 pass, zero fail, two explicit skip of
  1,570;
- protected release surface: 23/23 pass;
- protected run ID
  `9ef25fd42c90714285ca86a58d20174c2efc1a8a037e8f90c5ec314f0f04561f`;
- aggregate: 3,995 bytes, SHA-256
  `0514f83b28a210ac195456553774daccf48be8129dc60d9b6ed5681be2d0105a`;
  and
- a second maintained read-only verification that reproduced the same run
  ID, test count, aggregate length, digest, and `pass` verdict.

The source remained clean at the exact commit and tree after both execution
and verification. This is source, contract, and release-control evidence. It
does not prove a source trace, either numerical arrow, model usefulness,
browser model execution, P2P availability, publication, deployment, or any
campaign counter.

## Claim Boundary

This clean cut proves only current contract validation and immutable
historical separation. It creates no successor registration, private request,
trace, numerical comparison, model qualification, optimized-native result,
browser-WASM result, browser conversation, P2P availability, package,
publication, deployment, or MemoryEndpoints result.

MemoryEndpoints remains unauthorized. Campaign counters remain exactly
`0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
