# Companion Source-Conversion Reconciliation Implementation

## Status

Implemented and locally verified on 2026-08-24 against the output-free
registration in
`contracts/vnext/companion-source-conversion-reconciliation-preregistration.v1.json`.
That registration is remote-exact in commit
`af7857bbc4afa122d8013f2952b2944b53b6e3d2` and remains the normative decision
authority for this change.

This checkpoint closes deterministic reconciliation of terminal native
conversion evidence. It does not provide process adoption or relaunch for a
nonterminal attempt, a loopback server, browser pairing, P2P acquisition,
source download, browser transfer, a real model conversion, model quality,
publication, deployment, or campaign credit.

## Clean-Slate Contract Cutover

The Companion operation record is exactly
`tinyrustlm.companion.operation.v2`. Its new nullable
`sourceConversionIntentSha256` field binds source conversion to one private
canonical intent. The earlier operation-v1 reader is not retained, no migration
is written, and no alias or fallback field exists.

The private intent envelope is exactly
`tinyrustlm.companion.source-conversion-intent.v1` and contains:

1. the deterministic Companion operation ID;
2. the SHA-256 of the immutable acquisition request; and
3. one exact `tinyrustlm.qwen3-composition-conversion-intent.v1` value.

The managed conversion intent freezes:

- canonical model source-lock path and SHA-256;
- canonical model source directory;
- canonical tokenizer source-lock path and SHA-256;
- canonical tokenizer source directory;
- exact complete-composition profile SHA-256;
- canonical previously absent output root;
- canonical converter executable path and SHA-256;
- integral maximum duration in milliseconds;
- maximum stdout summary bytes;
- maximum stderr bytes; and
- `existing-output-root-is-never-resumed` as the sole terminal rule.

All paths are normalized before publication. Source and tokenizer trees must be
disjoint from each other and from the output tree. Digests are exact lowercase
SHA-256 values. Policy values are bounded. The current complete-composition
profile remains
`2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158`.

## Canonical Private Intent

`source-conversion.intent.json` is written directly inside the owned operation
directory. Its contract is:

- create-only;
- UTF-8 without a BOM;
- one fixed property order at both object levels;
- one final LF;
- at most 65,536 bytes;
- duplicate-key rejection;
- unknown-field rejection;
- case-sensitive field names;
- no comments or trailing commas;
- full semantic validation; and
- exact equality with the sole canonical re-encoding.

The first write is immutable. A second observation of byte-identical intent is
idempotent. Different bytes at the same path are a conflict and are never
overwritten. The file is private because it contains local paths; public
evidence may carry its digest but not its bytes or paths.

The digest may first enter history only on the source transition from
`AcquiringSource` to `Converting`. It is required and unchanged in source
`Converting`, `VerifyingComposition`, and `Available`. A later source
`Cancelled` or `Rejected` record preserves it. A terminal state reached before
intent publication may retain null. Peer records reject a non-null source
intent hash. Once non-null, the field cannot change or return to null.

## Live Execution

The normal source-conversion path performs these ordered actions:

1. reload and verify the immutable acquisition request;
2. reject a composition-profile mismatch before intent creation;
3. normalize and hash every source, converter, output, and policy input;
4. write or exactly observe the create-only private intent;
5. bind its digest while entering `Converting`;
6. revalidate the exact tool path, policy, source paths, source hashes,
   converter hash, absent output, and tree relationships;
7. start one bounded converter process without a shell;
8. own bounded stdout, stderr, duration, cancellation, and full process-tree
   termination;
9. verify strict live summary behavior; and
10. independently verify durable terminal bytes before availability.

The public conversion result is deliberately split:

- `tinyrustlm.verified-composition.v1` contains facts reconstructable from the
  immutable intent and durable output; and
- `tinyrustlm.composition-conversion-live-observation.v1` contains the exact
  stdout summary hash and elapsed duration observed only by the process owner.

Recovery never invents a summary hash or duration. A reconciled pass has a
durable composition and no live observation.

## Output-Only Terminal Inspection

`InspectCompositionTerminal` is static and read-only. It validates the frozen
intent but does not require the original source locks, source directories, or
converter executable to remain present. It does not launch, adopt, retry, or
kill a process.

The direct output inventory is bounded to at most twelve regular non-reparse
entries. A missing output root is `Pending`. An existing non-reparse directory
with no terminal pass or rejection file is also `Pending` after the bounded
inventory check. A path that is a file, a root reparse point, a nested
directory, a reparse entry, an over-limit inventory, or an unreadable inventory
is invalid.

A pass and rejection file in the same root are a terminal collision. Neither
is selected.

### Durable Pass

A pass requires exactly ten direct files:

1. `model.slm2`;
2. `tokenizer.tokenizer2`;
3. `template.template2`;
4. `sampling.sampling2`;
5. `prompt.prompt2`;
6. `composition.acg2`;
7. `composition.attempt.json`;
8. `model.slm2.conversion-receipt.json`;
9. `tokenizer.tokenizer2.conversion-receipt.json`; and
10. `composition.conversion-receipt.json`.

Verification freshly streams all six artifact hashes and validates exact
lengths, ordinal and kind, file names, format-profile IDs and hashes, component
receipt identities, source-lock identities, converter implementation and
executable identities, deterministic native operation identity, graph hashes,
resource plan, durability facts, structural status, required next gate, and
every explicit nonclaim. Stdout is not consulted.

### Durable Rejection

A rejection requires a strict started-attempt record plus
`composition.rejection.json`. The attempt binds profile, deterministic native
operation, both source-lock hashes, converter version and executable hash, and
terminal rule. The rejection binds the same operation and profile, carries one
bounded public-safe error code, and requires `safeNoOp: false` and
`retryable: false`.

Malformed JSON, duplicate or unknown fields, identity drift, changed operation,
changed source, changed tool, changed profile, changed component receipt,
changed graph, extra files, or contradictory terminal evidence is invalid. No
invalid state is repaired or converted into a pass.

## Companion Reconciliation

`ReconcileTerminal` admits only a source operation in `Converting` or
`VerifyingComposition` with the exact bound intent hash, no artifact set, and no
error. Its decision table is:

| Current state | Terminal inspection | Journal effect | Result |
| --- | --- | --- | --- |
| `Converting` | pending | none | pending, `awaiting-terminal-evidence` |
| `VerifyingComposition` | pending | none | pending, `awaiting-terminal-evidence` |
| `Converting` | pass | `VerifyingComposition`, then `Available` | durable composition, no live observation |
| `VerifyingComposition` | pass | `Available` | durable composition, no live observation |
| either admitted state | native rejection | `Rejected` | exact native error code |
| either admitted state | invalid intent or evidence | `Rejected` | `companion-conversion-terminal-invalid` |

Pending performs no journal write. Terminal states are not admitted and cannot
be overwritten. The method does not scan operations automatically and does not
turn an unknown process state into a new attempt.

## Cancellation And Live Violations

Caller cancellation first terminates and waits for the owned process tree, then
inspects the exact intent-bound output:

- a valid durable pass becomes `Available`;
- a valid native rejection becomes `Rejected` with its native code;
- no terminal evidence becomes `Cancelled`; and
- invalid terminal evidence becomes `Rejected` with the managed invalid code.

This precedence is limited to caller cancellation after owned-process
termination. A known live timeout, output overflow, unexpected stderr,
executable drift, or nonzero process exit is rejected immediately. A durable
pass left by such a live protocol violation cannot be used to launder the
violation through the same journal operation.

## Local Verification

The 2026-08-24 Release managed run passes 163 tests with zero skips:

- `TinyRustLM.Package.Tests`: 38/38;
- `TinyRustLM.Core.Tests`: 80/80; and
- `TinyRustLM.Companion.Tests`: 45/45.

Focused tests cover canonical intent bytes and digest, exact idempotence,
changed-intent conflict, duplicate and unknown JSON, operation-v1 rejection,
peer/source separation, immutable hash propagation, path and policy bounds,
source or converter drift before launch, pass recovery from both admitted
states, rejection recovery, absent and partial pending roots, no-launch pending
reconciliation, pass/rejection collision, malformed terminal records, excess
inventory, directory and reparse attribute policy, source/tool/profile/
operation/artifact/component/graph/resource/durability tampering, recovery after
source and converter removal, late cancellation outcomes, terminal-state
immutability, pre-cancel nonlaunch, typed process-start failure, and refusal to
launder unexpected stderr.

The executable fixture is deterministic structural evidence. These tests do
not prove a real Qwen3 conversion, multi-gigabyte behavior, physical power-loss
durability, Linux or arm64 execution, browser transfer, inference, quality,
public P2P, package publication, or deployment.

## Claim Boundary And Next Gate

No real model is qualified or available. No Companion archive is released. No
loopback endpoint exists. No browser has acquired or activated these six
artifacts. MemoryEndpoints remains unauthorized and disconnected. Campaign
counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.

The next output-producing boundary is forbidden until one exact numeric-
loopback browser capability protocol is output-free preregistered. That
registration must close installation discovery, numeric endpoint selection,
user presence, origin and Host validation, capability issue and expiry, route
and header allowlists, CORS and Private Network Access behavior, resource
limits, cancellation, restart, secret handling, and hostile-origin tests.
