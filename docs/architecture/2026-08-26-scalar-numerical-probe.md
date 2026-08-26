# Scalar Numerical Probe

Date: 2026-08-26

## Decision

TinyRustLM now has one dedicated, non-shipping Rust executable for creating
private scalar-native numerical traces from an already validated SLM2 model.
The executable is `tinyrustlm-numerical-probe`; its sole contract is
`contracts/vnext/scalar-numerical-probe-profile.v1.json`.

This is an implementation checkpoint, not numerical evidence for Qwen3. The
probe has passed five tests against the canonical 8,704-byte mixed-Q8 fixture.
It has not been invoked on the 598,308,416-byte `/12` model, has not observed a
source-framework tensor, and cannot decide numerical parity by itself.

## Why A Separate Probe Exists

The canonical `tinyrustlm-runtime` scalar path is the converted-byte reference,
but its maintained vectors currently use a tiny model. A real-model parity
operation needs bounded traces without adding evidence concerns, filesystem
paths, or source-framework dependencies to the shipping runtime.

The probe is therefore a leaf executable:

```text
strict private request
        |
        v
exact model length + streamed SHA-256
        |
        v
complete SLM2 validation + memory preflight
        |
        v
ScalarSession::forward_token_traced
        |
        v
create-only f32le trace packs
        |
        v
probe.json written last
```

It imports the scalar API but does not expose another runtime, model reader,
quantization interpretation, sampler, or fallback. Production code cannot
dispatch to it.

## Request Boundary

One request is canonical pretty UTF-8 JSON with one final LF. The parser
denies unknown fields and then reserializes the typed request; byte inequality
is fatal. This also rejects duplicate keys, alternate ordering, alternate
whitespace, explicit nulls, and trailing data rather than normalizing them.

The request binds:

- one lowercase ASCII operation ID;
- the public structural-result SHA-256;
- one canonical composition root;
- exact `model.slm2` length and SHA-256;
- one existing evidence parent and one absent direct output child;
- the sole trace profile;
- model, sequence, KV, scratch, trace, case, and per-case token ceilings; and
- one or more uniquely identified token-ID sequences without raw text or
  expected answers.

Every case resets the scalar session. Every token is executed once. There is
no sampling, generation retry, output repair, or response selection.

## Pre-Output Ordering

The owner creates no output root until all of these checks pass:

1. request type, size, strict schema, and canonical bytes;
2. profile, identifier, policy, case, and token closure;
3. canonical source and evidence-parent boundaries;
4. exact output name and absence;
5. model regular-file type, byte length, and streamed SHA-256;
6. complete independent SLM2 validation; and
7. scalar model, KV-cache, and scratch-memory admission.

After the output root exists, any failure preserves it. A later operation may
inspect those bytes but may not repair, overwrite, resume, relabel, or turn an
absent `probe.json` into success.

## Trace Format

Each case step has one create-only `.f32le` pack. Values are finite IEEE 754
binary32 in little-endian order. The pack contains the scalar runtime's exact
ordered stages:

1. token embedding;
2. attention-normalized input, query after RoPE, key after RoPE, value,
   grouped-query attention output, post-attention residual,
   feed-forward-normalized input, SiLU-gated activation, and post-feed-forward
   residual for every layer;
3. final normalized state; and
4. vocabulary logits.

The stage count is `3 + 9 * layer_count`. Every stage records its layer,
offset, element count, byte length, and SHA-256. Every pack records total
length and SHA-256. The sink writes borrowed values directly and never creates
an F32 weight shadow.

The trace budget is operation-wide. When a stage would exceed it, the sink
records one typed failure. Computation cannot convert that failure into a
short successful trace. The partial create-only file remains forensic
evidence and `probe.json` is absent.

## Result Semantics

`probe.json` is created last and synchronized after every trace file is
flushed and synchronized. It binds the request, composition result, exact
model, model specification, policy, admitted memory plan, token-stream hashes,
positions, committed KV bytes, greedy token IDs, trace identities, and stage
identities.

The result deliberately claims only
`private-scalar-traces-created-not-numerical-parity`. File synchronization is
observed; directory synchronization is explicitly not claimed. A process
owner and terminal evidence graph will provide the stronger one-shot custody
boundary for the real operation.

## Verification

The five current Rust tests establish:

- a complete two-token fixture trace and self-consistent result;
- rejection of noncanonical and unknown request forms before output;
- rejection of model drift before output;
- refusal to overwrite an existing output while preserving its bytes; and
- preservation of an incomplete trace when a registered budget is exceeded.

The fixture is not a useful model and earns no model, browser, P2P, release, or
campaign claim.

## Next Gate

Before real observation, the project still needs:

1. a pinned offline Python/PyTorch/Transformers source-framework closure;
2. a source owner that captures the exact same synthetic token cases without
   publishing raw tensors;
3. a reconstructed-weight diagnostic arm that separates quantization error
   from runtime interpretation;
4. an independent verifier with preregistered tensor-class metrics,
   thresholds, and first-divergence ordering;
5. wholly new request, source-output, scalar-output, evidence, and terminal
   identities proven absent; and
6. an output-free registration committed, pushed, freshly fetched, and exact
   before any of those roots or outputs are materialized.

Only a terminal verifier pass may establish source-to-scalar numerical parity.
Optimized native, browser WASM, conversational quality, and release remain
separate later gates.
