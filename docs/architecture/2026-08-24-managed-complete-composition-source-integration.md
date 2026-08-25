# Managed Complete-Composition Source Integration

## Decision

The private managed conversion boundary now exposes one operation only:
`TinyRustLmConversionTool.ConvertCompositionAsync`. It invokes only
`tinyrustlm-convert qwen3-composition` and accepts no model-only or
tokenizer-only success kind. The private companion source branch consumes that
complete result and may enter `Available` only with all six independently
rehased artifact identities.

This is a prelaunch clean replacement. The removed component-level managed API
has no alias, adapter, overload, migration reader, compatibility package, or
fallback. The two native component commands remain implementation primitives
inside the Rust converter; their receipts are inputs to the complete terminal
receipt and are not product availability.

## Exact Managed Request

`TinyRustLmCompositionConversionRequest` binds eight values:

1. model source-lock path;
2. expected model source-lock SHA-256;
3. model source directory;
4. tokenizer source-lock path;
5. expected tokenizer source-lock SHA-256;
6. tokenizer source directory;
7. registered complete-composition profile SHA-256; and
8. an absent output root under an existing direct non-reparse parent.

The exact profile identity is
`tinyrustlm.qwen3-complete-composition-conversion/2` with SHA-256
`d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718`.
Model-lock, tokenizer-lock, or profile drift rejects before the process starts
and before the output root exists.

The wrapper invokes the executable directly with `UseShellExecute=false`, an
argument list rather than a command string, no window, strict UTF-8 stdout and
stderr, and no shell interpretation. The default duration ceiling is twelve
hours. Stdout and stderr have independent byte ceilings. Timeout, caller
cancellation, or output flood kills the owned process tree and waits for exit.
The wrapper never deletes a started output root or retries the transaction.

## Independent Success Verification

Zero process exit is necessary but insufficient. Managed success requires all
of the following:

- empty stderr;
- one strict, bounded, unknown-field-rejecting CLI summary;
- exact summary schema, status, output-directory basename, terminal receipt
  basename, graph digest, next-gate text, and canonical six-artifact order;
- an existing direct non-reparse output root;
- exactly ten regular non-reparse files and no subdirectories or extras;
- terminal pass receipt present and terminal rejection absent;
- exact artifact names and kinds in SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2 order;
- a positive length and lowercase SHA-256 for every artifact;
- a fresh streamed hash of every complete artifact matching both summary and
  terminal receipt;
- exact format-profile ID and profile SHA-256 for every receipt artifact;
- exact registered conversion profile, source-lock identities, relationship
  status, converter executable identity, structural claim boundary, and next
  gate in the terminal receipt;
- deterministic recomputation of the native operation ID from the profile,
  both source locks, converter version, and executable SHA-256;
- a strict attempt receipt agreeing with the same operation, profile, source,
  converter, and terminal-root rule;
- fresh length and hash verification of both component receipt files;
- exact graph identity agreement between summary and terminal receipt;
- bounded nonzero resource-plan fields and the registered one-mebibyte streamed
  hash buffer; and
- converter executable SHA-256 equality before and after verification.

The wrapper preserves the native converter's truthful claim boundary. A
verified conversion establishes complete structural composition and byte
identity only. The receipt must continue to state that source-framework
parity, model quality, native runtime, browser WASM, browser chat, P2P
availability, and publication were not assessed by conversion.

## Companion Source Branch

`CompanionSourceConversion` operates only on an existing journal operation in
`AcquiringSource` with branch `Source`. It reloads the immutable acquisition
request from the owned journal, validates its deterministic operation identity
and stored request hash, and requires the registered composition-profile
identity.

The only successful transition sequence is:

```text
AcquiringSource
  -> Converting
  -> VerifyingComposition
  -> Available
```

The coordinator supplies the journaled source-lock and profile identities to
the managed conversion request. It maps a verified conversion to exactly six
`CompanionArtifact` records using `sha256:<lowercase-digest>` content IDs and
positive byte counts. It validates that set before entering
`VerifyingComposition`, sums all six lengths with checked arithmetic, and
writes `Available` only with equal completed and total byte counts.

A native typed failure advances from `Converting` to `Rejected` with the same
bounded public-safe error code. Invalid local inputs become
`companion-conversion-input`. Caller cancellation advances to `Cancelled`
after process-tree termination. No failure or cancellation attaches artifacts,
deletes output evidence, enters `Available`, or automatically launches another
transaction.

## Test Fixture Boundary

`TinyRustLM.ConversionFixtureTool` is a private deterministic process-control
fixture. It emits ten small structurally shaped files so tests can exercise
argument transport, operation identity, strict JSON, inventory, hashing,
receipt lineage, timeout, cancellation, and journal transitions without a
large model. Its bytes are not valid production SLM2 composition evidence and
cannot qualify a model, browser round, peer lane, catalog entry, package, or
release.

The focused managed tests cover:

- complete six-artifact success;
- absence of the component-level managed API;
- exact native error propagation and private-error redaction;
- malformed summary, unexpected stderr, output flood, and timeout;
- summary, terminal receipt, source-lock, and inventory dishonesty;
- create-only terminal-root behavior;
- request-level model-lock, tokenizer-lock, and profile drift;
- complete Companion state transitions and artifact mapping;
- wrong-state and journaled-profile rejection;
- native rejection without false availability;
- real process-tree cancellation with preserved attempt evidence; and
- tamper detection for the immutable journal request.

## Remaining Boundary

This checkpoint does not acquire source bytes, discover or fetch peers, expose
a loopback listener, pair a browser, transfer composition members, persist a
browser composition, execute a real model, recover a completed conversion
after Companion process loss, publish an archive or package, or deploy a site.
The next implementation must preregister the closed loopback capability and
restart-recovery protocols before producing comparative transport output.

No real model has qualified. No browser chat has run through this path. No
public peer is proven. MemoryEndpoints remains unauthorized and disconnected.
Campaign counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.
