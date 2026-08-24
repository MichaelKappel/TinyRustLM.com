# Companion Source Conversion Reconciliation Preregistration

Date: 2026-08-24

## Decision

TinyRustLM will make a source conversion restart-safe by binding the local
inputs, output root, converter executable, and process limits into one private
create-only intent before launching the native complete-composition command.
After a Companion process interruption, a new Companion process may inspect
and independently verify terminal native evidence from that exact intent. It
may never infer success from a directory, relaunch automatically, adopt or
kill an unknown process, repair output, select a more convenient attempt, or
overwrite a journal terminal state.

The normative output-free registration is
`contracts/vnext/companion-source-conversion-reconciliation-preregistration.v1.json`.
Its registration parent is commit
`d0c589cb984fd4eb70271dc3ff3f3beae5d363f3`, tree
`c6beb42bb8a89376a63050f83df30d05ef5153ef`. The profile records the exact
source closure that existed before reconciliation implementation.

This checkpoint creates no operational intent, model output, conversion
attempt, pass receipt, rejection receipt, runtime output, browser output,
quality evidence, or campaign credit. The profile, this decision, and their
executable validator must be committed and pushed before production code is
changed.

## Product Boundary

There is one prelaunch product. Names such as operation schema `v2`, SLM2,
ACG2, Tokenizer2, Template2, Sampling2, and Prompt2 are technical identities,
not product generations.

The operation record schema is replaced cleanly by
`tinyrustlm.companion.operation.v2`. The prior operation-record reader is not
retained, no migration is written, and no alternate field name or compatibility
path is accepted. Existing development journals can be discarded because the
product has not launched. This prevents a temporary prelaunch record shape
from becoming permanent debt.

The implementation admits no fallback, response repair, automatic retry,
best-of-N selection, fixture-as-product path, or promotion of incomplete
evidence. MemoryEndpoints remains unauthorized and disconnected.

## Existing Failure Window

The current managed path transitions a source operation to `Converting`,
launches the native `qwen3-composition` process, reads its stdout and stderr,
and advances through `VerifyingComposition` to `Available`. The native owner
already writes a create-only attempt record and one mutually exclusive terminal
pass or rejection file. Its output root is terminal and is never resumed.

If the managed process disappears after the native process starts, the journal
does not retain the source paths, output path, converter identity, or process
policy needed to identify that attempt. A replacement process cannot prove
which output belongs to the operation. It also cannot reconstruct the current
managed success object because that object combines durable receipt facts with
ephemeral stdout and elapsed time.

This registration closes that evidence gap. It does not yet solve ownership of
a still-running orphaned converter. That is a separate, preregistered process
supervision gate. Conflating terminal evidence reconciliation with uncertain
process ownership would make restart behavior less trustworthy.

## Immutable Managed Intent

`TinyRustLmConversionTool.CreateCompositionIntent` will validate and normalize
one requested conversion before launch. The resulting
`TinyRustLmCompositionConversionIntent` has the exact schema
`tinyrustlm.qwen3-composition-conversion-intent.v1` and contains, in canonical
order:

1. the schema identity;
2. normalized model source-lock path and its SHA-256;
3. normalized model source-directory path;
4. normalized tokenizer source-lock path and its SHA-256;
5. normalized tokenizer source-directory path;
6. the frozen complete-composition profile SHA-256;
7. the normalized absent output root;
8. normalized converter executable path and its SHA-256;
9. maximum duration in integer milliseconds;
10. maximum stdout summary bytes;
11. maximum stderr bytes; and
12. the terminal rule `existing-output-root-is-never-resumed`.

At intent creation, source locks and the converter must be direct regular
non-reparse files. Source directories and the output parent must be direct
non-reparse directories. The output root must be absent. Source and output
trees must not overlap. Paths are normalized absolute platform paths, limited
to 32,767 characters, and reject embedded NUL characters.

The supplied lock hashes must equal both the bytes on disk and the immutable
acquisition request. The profile hash must equal the registered composition
profile. The executable is streamed through SHA-256 before its identity enters
the intent. The duration, stdout, and stderr bounds must remain inside the
registered limits.

Immediately before launch, `ConvertCompositionAsync` accepts the intent rather
than reconstructing a request. It revalidates the exact paths, policies,
profile, source-lock hashes, converter hash, output absence, and tree
relationships. A changed file or parameter fails before process creation.

## Private Companion Envelope

The Companion wraps that managed intent in
`tinyrustlm.companion.source-conversion-intent.v1`. The envelope contains the
Companion operation ID, the immutable acquisition request SHA-256, and the
exact nested managed intent. It is serialized as canonical UTF-8 without a
BOM, with one final LF, strict property order, and at most 65,536 bytes.

The file is named `source-conversion.intent.json` and lives directly inside
the owned operation directory. It is private operational state because it
contains local paths. It must never appear in public receipts, screenshots,
telemetry, error messages, or campaign reports.

Publication is create-only. If the file is absent, the Companion creates,
flushes, rereads, and hashes it. If it already exists, the operation can
continue only when the existing bytes equal the newly derived canonical bytes
exactly. A changed byte, duplicate property, unknown property, wrong case,
oversized file, reparse point, or identity mismatch is rejected without
overwrite or deletion.

## Journal Binding

The replacement operation record adds nullable field
`sourceConversionIntentSha256`. It is null when an operation is created,
during branch selection, and on every peer branch state. It remains null for
the source branch while the operation is only `AcquiringSource`.

The exact ordering for source conversion is:

1. read and validate the operation and immutable acquisition request;
2. derive the managed conversion intent from local inputs;
3. create or exactly observe the private Companion intent;
4. reread and hash the persisted bytes;
5. advance from `AcquiringSource` to `Converting` with that hash; and
6. revalidate the exact managed intent and launch the converter.

`Converting`, `VerifyingComposition`, and source-branch `Available` records
require the hash. Once non-null, it cannot change or return to null. A
`Cancelled` or `Rejected` record created before intent publication may remain
null; a terminal transition from an intent-bound state must preserve the exact
hash. Peer operations must reject a non-null source-conversion intent hash.

Every historical record remains create-only. Advancing `current.json` does not
rewrite history. No terminal state is eligible for reconciliation or another
transition.

## Durable Result And Live Observation

The managed conversion API currently combines durable facts with facts known
only to the live parent process. That type will be split.

`TinyRustLmVerifiedComposition` contains only facts independently derivable
from durable bytes:

- native operation ID;
- output and receipt paths;
- receipt SHA-256;
- all six artifact paths, lengths, and SHA-256 identities;
- graph identity;
- model and tokenizer source-lock identities;
- converter version and executable identity; and
- the required next gate.

`TinyRustLmCompositionConversionObservation` contains only live observations:

- the live-observation schema;
- exact stdout-summary SHA-256; and
- elapsed duration.

A normal live call returns both objects. A recovered pass returns only the
durable composition. It does not fabricate a process exit code, stdout,
stderr, timing, or proof that the replacement process observed the original
child. Structural availability is valid because the native pass and all
referenced bytes are independently reverified; live-process claims remain
absent.

## Terminal Inspector

`TinyRustLmConversionTool.InspectCompositionTerminal` receives the exact
persisted managed intent. It does not launch a process and does not require the
original source directories, source-lock files, or converter executable still
to exist. Their frozen identities are checked against durable native evidence.

The inspector has three valid outcomes: `pending`, `pass`, and `rejected`.
Invalid evidence throws a bounded typed conversion error; it is not another
valid status.

### Pending

An absent output root is pending. A direct non-reparse output root containing
no terminal file is also pending after a bounded direct-inventory check. This
includes a partial root because the native process may still be working or may
have stopped before terminal publication.

Pending does not mean success, failure, safe retry, or dead process. The
inspector does not use PID files, creation times, process names, executable
paths, or filesystem activity to infer ownership or liveness.

### Pass

A pass is valid only when `composition.conversion-receipt.json` exists and
`composition.rejection.json` does not. The inspector requires the exact
ten-file success inventory: six artifacts, the attempt record, two component
receipts, and the terminal pass receipt.

It then independently verifies:

- strict bounded JSON with no duplicate or unknown properties;
- composition profile ID and SHA-256;
- native operation identity;
- model and tokenizer lock hashes from the intent;
- converter executable hash from the intent;
- all artifact lengths and streamed SHA-256 values;
- all six registered format identities;
- component receipt lengths and hashes;
- graph identity and member metadata;
- bounded resource-plan facts;
- native durability facts;
- the exact attempt receipt; and
- every converter nonclaim and required-next-gate field.

The live CLI summary is unnecessary because the pass receipt and artifacts
carry the durable facts. This does not weaken normal live execution: its stdout
summary, process exit, empty stderr, duration, and post-execution executable
hash are still checked as live observations.

### Rejected

A rejection is valid only when `composition.rejection.json` exists and the
terminal pass does not. Partial artifact and staging files may remain because
native failure intentionally preserves evidence. The direct root inventory is
still bounded to twelve regular non-reparse entries and may not contain nested
directories.

The strict rejection must bind its schema, rejected status, profile identity,
native operation ID, bounded public-safe error code, `safeNoOp: false`, and
`retryable: false`. The strict attempt record must bind that same operation,
the source-lock identities, converter version and executable hash, and the
terminal rule. Recovery never turns a native rejection into cancellation or
another attempt.

### Invalid

The following are invalid evidence, not pending:

- an output path that is a file or reparse point;
- a nested directory or reparse entry;
- more than twelve direct entries;
- pass and rejection files together;
- malformed, oversized, duplicate-property, or unknown-property terminal JSON;
- wrong profile, source, converter, operation, graph, artifact, receipt, or
  durability identity;
- unexpected files in a claimed pass; or
- an invalid rejection or attempt relationship.

The Companion preserves the output root and advances the operation to
`Rejected` with public-safe code `companion-conversion-terminal-invalid`. It
does not expose the local path or rewrite the native evidence.

## Companion Reconciliation

`CompanionSourceConversion.ReconcileTerminal` accepts only source-branch
operations currently in `Converting` or `VerifyingComposition`. It rereads the
private intent, requires its byte hash to equal the journal binding, validates
the operation and request identities, and invokes the terminal inspector.

The decision table is fixed:

| Current state | Evidence | Journal effect | Result |
| --- | --- | --- | --- |
| `Converting` | pending | none | typed `awaiting-terminal-evidence` |
| `VerifyingComposition` | pending | none | typed `awaiting-terminal-evidence` |
| `Converting` | valid pass | `VerifyingComposition`, then `Available` | durable composition |
| `VerifyingComposition` | valid pass | `Available` | durable composition |
| either admitted state | valid native rejection | `Rejected` | native safe error code |
| either admitted state | invalid evidence | `Rejected` | `companion-conversion-terminal-invalid` |

Pending never mutates sequence, timestamps, progress, or history. Pass derives
the six Companion artifact identities from the independently verified durable
composition and computes total bytes with checked arithmetic. Rejection
preserves the exact intent hash. A call against `Available`, `Cancelled`,
`Rejected`, a peer branch, or an unbound record fails without a write.

## Crash Windows

Before intent publication, the operation remains `AcquiringSource` and the
same validated request may be submitted again. If the process disappears
after intent publication but before journal transition, the same request may
observe the exact existing bytes and continue. No native process has been
launched before the transition step.

After the `Converting` transition, a disappearance may happen immediately
before process creation, while the child is running, or after the child ends.
An absent or nonterminal root remains pending in all three cases. This narrow
gate deliberately does not guess which case occurred.

After a native pass, the new process can reverify the durable root and advance
to `Available`. After a native rejection, it can reverify and advance to
`Rejected`. If interruption occurs after the journal reaches
`VerifyingComposition`, a pass advances once to `Available`. Once any journal
terminal state exists, it is immutable.

The pending-before-launch corner is real and remains visible. A later process
ownership gate must provide an authenticated launch lease or equivalent
proof before safe relaunch or adoption can be implemented. Until then, manual
inspection may diagnose the blockage, but no code path may convert uncertainty
into retry or success.

## Cancellation Race

Caller cancellation owns the live process tree. The managed owner first
terminates and waits for that process tree, then inspects the exact output:

- a valid durable pass wins and the operation becomes `Available`;
- a valid native rejection wins and the operation becomes `Rejected`;
- no terminal evidence becomes `Cancelled`; and
- invalid terminal evidence becomes `Rejected`.

This rule is limited to the cancellation race. A known live protocol violation
such as timeout, output overflow, unexpected stderr, executable drift, or
nonzero exit without a valid rejection remains a rejection. A valid pass found
after such a violation is not used to launder the violated live contract.

## Required Tests

The implementation gate requires focused tests for canonical intent bytes and
hashes, path normalization, policy bounds, prelaunch schema replacement,
create-only publication, exact idempotent observation, changed-intent
rejection, strict JSON, journal hash invariants, and peer/source separation.

Terminal tests must cover pass recovery from both admitted states, native
rejection recovery, absent and partial pending roots, pass/rejection collision,
malformed terminal JSON, extra entries, directories, reparse points, over-limit
inventory, and drift in every source, executable, profile, operation, artifact,
component receipt, graph, resource, and durability identity.

Process-race tests must prove no launch, retry, adoption, or kill during
reconciliation; the cancellation precedence rules; terminal-state
immutability; and refusal to launder a known live protocol violation.
Recovery must also succeed after the original source and converter paths are
made unavailable, because the pass itself and frozen intent contain the
required identities.

Fixture output remains structural test evidence only. It cannot satisfy a real
model, quality, browser, P2P, deployment, publication, or campaign gate.

## Claim Boundary

A recovered pass can prove exact source-lock binding, exact converter identity
binding, complete six-artifact structure, artifact byte identities, and the
native durability receipt. It cannot prove managed process exit, stdout,
stderr, elapsed time, source-framework numerical parity, native inference,
browser WebAssembly inference, browser chat, model usefulness, P2P
availability, deployment, or publication.

Campaign counters remain 0/20 qualified models, 0/50 deletion-backed browser
rounds, 0/25 authorized live memory rounds, 0/40 current outside-network lane
proofs, and 0/20 live catalog announcements.

## Implementation Sequence

1. Commit and push this preregistration while its output boundary is empty.
2. Fresh-fetch and prove local, tracking, `FETCH_HEAD`, and direct remote-ref
   equality.
3. Replace the operation record schema and add exact journal invariants.
4. Add managed intent creation, canonical private persistence, and launch-time
   revalidation.
5. Split durable composition facts from live observations.
6. Refactor strict receipt verification into the output-only terminal
   inspector without weakening the normal live path.
7. Add Companion reconciliation and cancellation-race handling.
8. Extend the fixture and tests for every registered state and fault.
9. Run formatting, build, warnings-denied tests, contract validators, source
   scans, secret scans, and frozen-goal verification.
10. Commit, push, fresh-fetch, and prove exact remote equality before any real
    source conversion is executed.

## Registration Status

This registration is immutable for the implementation checkpoint. A material
implementation disagreement requires stopping before operational output and
deliberately replacing the unpromoted registration. It does not authorize a
compatibility path, evidence rewrite, automatic retry, or weaker test.
