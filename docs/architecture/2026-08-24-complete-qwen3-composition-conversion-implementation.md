# Complete Qwen3 Composition Conversion Implementation

Date: 2026-08-24

## Status

`tinyrustlm-convert qwen3-composition` now implements the exact output-free
registration in
`contracts/vnext/qwen3-composition-conversion-profile.v1.json`. The profile is
7,978 bytes at SHA-256
`2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158`
and was committed and fresh-remote verified at
`afc53619343a7d46acafa6558babe288c3bf342c` before this implementation
checkpoint.

This is the sole complete source-to-composition command for TinyRustLM's one
prelaunch product. The exact `qwen3-safetensors` and `qwen-tokenizer2`
operations remain internal component compiler primitives. Their individual
receipts are necessary inputs to the complete receipt, but neither component
operation can establish product-ready composition availability.

No complete transaction has run against real model source at this checkpoint.
The implementation and deterministic fixtures are not model, quality,
inference, browser, P2P, release, deployment, or campaign evidence.

## Implementation Owners

The transaction is implemented in
`rust/crates/tinyrustlm-convert/src/qwen3_composition.rs`, 59,532 bytes at
SHA-256
`ff6f338c4abf1311e702072cf54dee592a8b075b5076d1e67e7714b9ac4b1966`.
It composes existing exact owners rather than copying their parsers or writers:

| Artifact | Canonical owner |
| --- | --- |
| SLM2 | `tinyrustlm-slm2` and the Qwen3 component converter |
| Tokenizer2 | `tinyrustlm-tokenizer2` and the Qwen tokenizer component converter |
| Template2 | `tinyrustlm-template2` |
| Sampling2 | `tinyrustlm-sampling2` |
| Prompt2 | `tinyrustlm-prompt2` |
| ACG2 | `tinyrustlm-composition2` |

The converter crate now depends directly on those owners. It does not
introduce a general plug-in registry, caller-selected artifact factory,
alternate composition shape, compatibility parser, alias, migration, or
fallback.

## Source Admission

Before creating an output root, the transaction:

1. verifies its embedded profile bytes against the frozen SHA-256;
2. reads each source lock as a bounded regular file;
3. requires exact model and tokenizer lock schemas;
4. requires equal model ID, immutable revision, and architecture profile;
5. requires exact equality for the five shared config/tokenizer file records;
6. requires distinct existing direct non-reparse source directories;
7. requires an absent output root under an existing direct non-reparse parent;
   and
8. rejects every source/output tree overlap.

The component converters subsequently perform their own strict duplicate-key,
unknown-field, exact-directory, file-length, and streamed-hash validation.
Therefore a permissively shaped relationship candidate cannot become a pass:
both source locks must independently satisfy their canonical owners.

The CLI now inspects caller-supplied existing paths and output parents for
symlinks or Windows reparse points before canonicalization. This prevents the
command adapter from erasing a path property that the Rust transaction is
required to reject.

## Operation Identity

One deterministic operation ID is domain-separated and binds:

- complete-composition profile SHA-256;
- model source-lock SHA-256;
- tokenizer source-lock SHA-256;
- converter implementation version; and
- converter executable SHA-256.

It does not bind an operator-specific absolute path. Moving the same immutable
inputs does not change their operation identity, while changing any contract,
source lock, converter version, or executable bytes does.

## Create-Only Transaction

The output root is created once and immediately made durable at its parent.
`composition.attempt.json` is then written create-only, synchronized, verified
byte-for-byte, promoted in the same directory, and followed by a directory
flush. It binds the operation, profile, source locks, and converter identity
before component conversion starts.

The transaction then creates:

1. `model.slm2` and its component receipt;
2. `tokenizer.tokenizer2` and its component receipt;
3. `template.template2`;
4. `sampling.sampling2`;
5. `prompt.prompt2`; and
6. `composition.acg2`.

Every fixed member is written to a create-new same-directory stage,
synchronized, read as a bounded regular file, independently parsed by its
canonical owner, compared to the writer identity, and promoted through a
create-only hard-link operation. The stage is removed only after promotion.
The transaction never overwrites a destination or silently cleans an incident.

Template2, Sampling2, and Prompt2 must reproduce their exact registered hashes.
Tokenizer2 must reproduce both its exact 7,038,773-byte length and exact
artifact SHA-256. The model must independently reparse as the sole accepted
Qwen3-0.6B architecture relation, whether its source lock identifies a base or
specialist model.

## Complete Verification

After all six artifacts exist, the transaction flushes the member directory
and reparses ACG2. Its resolver opens only the exact path associated with the
requested closed member role and verifies expected length and hash before
returning a file.

`tinyrustlm-composition2` then:

- streams and hashes one member at a time with a fixed 1 MiB buffer;
- reparses SLM2 under a closed tensor limit;
- admits only the exact Tokenizer2, Template2, Sampling2, and Prompt2 artifact
  identities and format profiles;
- builds Prompt2's dependency-closed runtime;
- requires the SLM2 vocabulary and context to equal Prompt2's model vocabulary
  and maximum context;
- computes the complete resource plan; and
- calls preflight before returning an inactive prepared composition.

The vocabulary/context predicate has a direct regression covering exact match,
vocabulary drift, and context drift. Tokenizer2's exact artifact length and
hash now have one exported owner in `tinyrustlm-tokenizer2` rather than a
private duplicated constant in the composition crate.

The complete converter preflight accepts only a positive model no larger than
2 GiB, at most 2,048 tensors, positive resident dependencies no larger than 80
MiB, the exact graph identity, and the exact 1 MiB streaming buffer plan.

## Evidence And Failure

The final receipt rehashes all six artifacts and both component receipts. It
records artifact order, kind, filename, profile ID and hash, byte length,
artifact hash, graph and member-table identities, source relationship,
converter identity, resource plan, and member-directory durability
observation.

Its structural claim is exactly `verified`. Quality, source-framework parity,
native runtime, browser WASM, browser chat, P2P availability, and publication
remain `not-assessed-by-converter`.

`composition.conversion-receipt.json` is written last on the success path.
Success still requires command exit zero and absence of
`composition.rejection.json`; a receipt file alone is not sufficient.

After output-root creation, every failure attempts to preserve one create-only
`composition.rejection.json` with the original stable error code and
`retryable: false`. The record truthfully uses `safeNoOp: false` because a
rejected root may contain the attempt and partial artifacts. The root remains
terminal and a second invocation is rejected before mutation.

## CLI Boundary

The command requires exactly:

```text
tinyrustlm-convert qwen3-composition \
  <model-source-lock> <model-source-directory> \
  <tokenizer-source-lock> <tokenizer-source-directory> \
  <absent-output-root>
```

On pass, stdout contains one bounded structured summary naming the operation,
terminal receipt, six artifacts, their byte lengths and hashes, graph identity,
and required next gate. Errors emit one stable code and a nonzero process exit.
No command writes instructions, scripts, request files, or repaired model
output for a user to complete manually.

## Verification

The affected locked Rust matrix passes 60 tests:

- 16 `tinyrustlm-composition2` unit and integration tests;
- 27 `tinyrustlm-convert` transaction, model, and tokenizer tests; and
- 17 `tinyrustlm-tokenizer2` contract and vector tests.

The transaction tests cover profile identity, exact model shape, related source
locks, deterministic operation identity, canonical fixed-member writing and
reparse, create-only collision, immutable direct rejection, and a started
wrapper failure that preserves an attempt plus truthful terminal rejection and
refuses resume.

Warnings-denied all-target Clippy and Rust formatting pass. Thirty-five focused
Node tests pass across complete-conversion registration, model-converter
registration, ACG2 registration, vectors, Node WASM, and fresh Chromium with
zero network. Those ACG2 browser tests use the registered deterministic format
fixture; they are not a real-model composition run.

## Claim Boundary And Next Work

This checkpoint proves local implementation and deterministic contract tests
only. No real source was downloaded or converted by the complete command. No
full command pass receipt exists. The unchanged Qwen3-0.6B base remains
terminally rejected as a product model and is usable only for numerical parity
and derivative ancestry.

The private managed wrapper now exposes only this complete transaction, and the
private Companion source coordinator reaches `Available` only from its six
verified member identities. That implementation is documented in
`2026-08-24-managed-complete-composition-source-integration.md`. The next gate
is restart-safe private transport registration and implementation, followed by
one external pinned-source run for source/native/browser numerical parity and
untouched qualification of a genuinely useful derivative.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain 0/20, 0/50, 0/25, 0/40, and 0/20.
