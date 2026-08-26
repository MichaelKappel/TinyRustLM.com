# Qwen3 Numerical Differential Laboratory

Date: 2026-08-26
Status: implementation and hostile fixtures complete; real operation not registered or run

## Purpose And Authority

This document defines the non-shipping numerical laboratory that must precede
optimized native and browser-WASM work for the exact Qwen3-0.6B SLM2
composition closed by structural operation `/12`. It implements the accepted
parts of the post-`/10` report synthesis and TDD delta. Raw returned reports are
advisory inputs, not evidence that this code, model, runtime, or browser works.

TinyRustLM remains one unversioned prelaunch product. SLM2, Tokenizer2, and
operation suffixes are technical identities. This laboratory introduces no
legacy reader, compatibility contract, migration, alias, fallback runtime,
hidden retry, response repair, best-of-N selection, or shipping dispatch path.

The exact machine-readable authority is
`contracts/vnext/qwen3-numerical-differential-profile.v1.json`, 15,276 bytes at
SHA-256 `4f97304bf7875f226530bab4c8df8550db6b743aa949f53d89d43d47f2956d12`.
It binds the reviewed-report lineage, source lock, `/12` composition, model
shape, implementations, environment closure, trace format, comparison arrows,
metric families, claim boundary, and zero campaign counters.

## Three Independent Arms

The proof is intentionally split so one final-logit disagreement does not
conflate conversion, quantization, and runtime arithmetic.

1. The publisher-source arm loads the immutable local
   `Qwen/Qwen3-0.6B` revision
   `c1899de289a04d12100db370d81485cdf75e47ca` through pinned Transformers
   4.51.0 and PyTorch 2.7.0 on CPU. The original source weights execute in
   float32 with eager attention, one intra-op thread, one inter-op thread, and
   deterministic algorithms.
2. The reconstructed arm independently parses the exact 598,308,416-byte
   `model.slm2`, validates the fixed 310-tensor registry and mixed-Q8 payload
   contract, reconstructs only bounded row chunks to float32, and executes
   Qwen3 equations in pinned NumPy 2.2.5. It never creates a whole-model
   float32 shadow.
3. The Rust scalar arm is the already checked-in converted-byte reference. It
   consumes the same SLM2 bytes and token IDs through the canonical runtime's
   traced scalar path.

The first comparison is source framework to reconstructed SLM2. It diagnoses
conversion and quantization difference. The second is reconstructed SLM2 to
Rust scalar. It diagnoses packed-byte interpretation and scalar mathematics.
Neither result implies the other, and neither can be used transitively as
optimized-native or browser-WASM proof.

The Python arms are diagnostic programs only. Production cannot dispatch to
them, and an optimized runtime failure cannot route to them.

## Exact Offline Environment

`contracts/vnext/qwen3-numerical-oracle-environment-lock.v1.json` is 29,103
bytes at SHA-256
`bdccfc277c66640ab958f382713cd75fbf497e6232b57b5025cd78868ec5a0e5`.
It records an exact observed closure, not an original installation receipt.
It binds:

- 29 local wheels totaling 258,399,469 bytes, closure SHA-256
  `970c626fc754bdf160a0fa545df50c2daac708f72e66efe38909f48b5e356b49`;
- four bootstrap distributions and 170 non-cache bootstrap files, closure
  SHA-256
  `fba473d6da6254419fda06deb33794292169c7d8372b480c6a9b1c909c2ca659`;
- Python 3.12.10, its launcher, base interpreter, and `pyvenv.cfg`;
- 26 exact runtime distributions; and
- 17,535 non-cache runtime files totaling 1,378,685,662 bytes, closure
  SHA-256
  `90bbf5f9da3c92e689030d84bb45efa9054b494ea7851b1185aeca8f4af83b10`.

The authority validates wheel ZIP shape and metadata, each installed
distribution's `METADATA` and `RECORD`, every RECORD-listed file hash and
length, all non-cache installed files, absence of links/reparse points in the
owned roots, and exact distribution inventory. Both Python owners bind the
authority and lock by content and recompute the running environment before and
after trace production. Bytecode caches are explicitly excluded and disabled.

The Python audit hook rejects network connection, binding, DNS resolution,
URL request, subprocess, and process-spawn events. Hugging Face and
Transformers offline modes are explicit. Neither owner accepts an unrestricted
URL, model identifier to resolve, prompt text, or child command.

## Input And Output Contract

The future private requests are canonical recursively key-sorted, pretty UTF-8
JSON with one final LF. Duplicate or unknown fields, alternate serialization,
null substitutions, trailing bytes, oversized input, wrong profile identity,
wrong environment, wrong source, wrong model, wrong parent, or existing output
root are fatal before output creation.

Requests contain only preregistered case IDs and token IDs. They cannot contain
raw conversation text, expected answers, model download instructions, sampling
choices, or repair policy. Each case starts with empty KV state and advances
one registered token at a time. The three arms must receive the same case
order, token IDs, positions, and trace profile.

Every Python output root is an absent direct child of one registered existing
evidence parent. Creation is exclusive. Each token produces one immutable
`.f32le` trace pack. `probe.json` is written last, create-only, after all trace
files and pre-terminal invariants pass. A failure leaves partial files intact
without a completed manifest. No owner deletes, overwrites, resumes, retries,
or adopts partial evidence.

## Trace Semantics

The trace profile is `tinyrustlm.scalar-full-stage-f32le/1`. A token has 255
ordered stages for this 28-layer Qwen3 model:

1. token embedding;
2. per layer: attention-normalized state;
3. query after RoPE;
4. key after RoPE;
5. value projection;
6. pre-output-projection attention result;
7. post-attention residual;
8. feed-forward-normalized state;
9. pre-down-projection activated feed-forward state;
10. post-feed-forward residual;
11. final normalized state; and
12. vocabulary logits.

The formula is `3 + 9 * layer_count`. Every stage binds its semantic name,
nullable layer, offset, element count, byte length, and SHA-256. Every pack
binds total length and SHA-256. Values are contiguous IEEE 754 binary32 in
little-endian order. Empty, malformed, overlapping, out-of-order, nonfinite,
oversized, missing, duplicate, or extra stages fail.

The source hook topology was tested against a tiny one-layer Qwen3 model in the
pinned environment. That fixture exercises embedding, norms, Q/K RoPE capture,
V and attention capture, MLP capture, residual capture, final norm, and logits.
It is not a Qwen3-0.6B run.

## Independent Verification

`tinyrustlm/tools/qwen3-numerical-trace-verifier.js` is read-only. Its source
contains no filesystem write, append, mkdir, rename, copy, remove, or write
stream path. It writes only one bounded canonical receipt to stdout.

The verifier reopens and hashes the profile, manifests, traces, source lock,
environment identities, `/12` composition identity, and model bytes claimed by
the manifests. It requires exact inventory and case closure across all three
arms. It never repairs an answer, translates evidence, chooses a majority,
selects a seed, searches tolerances, or changes an owner result.

For each preregistered arrow and stage, it computes maximum absolute error,
maximum relative error with a positive registered floor, normalized RMSE,
cosine similarity, sign disagreement above a registered floor, and maximum
float32 ULP distance. For logits it also computes stable top-k overlap with
value-descending and token-ID-ascending tie order, plus lowest-token-ID greedy
tie identity.

Thresholds are registered separately for each proof arrow with a default and
optional exact stage overrides. They must exist before any real trace output.
Threshold search or loosening after output is an owner defect requiring an
entirely new registration.

On failure, the verifier reports the first registered divergence in this
order: arrow, case, token step, stage, layer, element, and chunk. Query, key,
value, and attention elements also localize to a head. Coordinate-level
absolute, relative, and ULP failures retain the first failing coordinate
rather than merely reporting whichever later coordinate had the largest
aggregate error.

## Fixture Evidence And Limits

The focused gate completed 10/10 tests with the exact pinned Python interpreter
and no skipped test in that invocation. It established:

- report, profile, lock, source-lock, and implementation content bindings;
- dependency-free owner and environment-authority self-tests;
- synthetic Qwen3 hook execution in pinned PyTorch/Transformers;
- synthetic NumPy RMSNorm, RoPE position-zero, and grouped-query attention;
- read-only pass over complete equal 255-stage traces;
- first source-to-reconstructed divergence localization;
- second-arrow localization only after the first arrow passes;
- rejection of a syntactically valid cross-arm environment drift;
- trace-byte drift and unknown request rejection; and
- absence of a verifier evidence-write or permissive-selection path.

These fixtures contain no real model execution, source-model output, `/12`
trace, numerical-parity decision, browser execution, conversation, quality
judgment, P2P transfer, package publication, deployment, or campaign credit.

## Exact Next Gate

No real owner may run yet. The next coherent change is one wholly new
output-free numerical registration. It must bind the remote-exact source
commit/tree containing this implementation; the profile and environment lock;
all three executable identities; exact source and `/12` model identities;
private case hashes and token IDs; per-arrow and per-stage thresholds; relative
and sign floors; top-k; resource and receipt ceilings; existing evidence
parent; all absent output roots; process cardinality; timeout; terminal-state
classification; and the read-only verifier invocation.

That registration must be committed, pushed, freshly fetched, and direct
remote-ref exact before any registered output path is materialized. Every
future path and logical identity must be new. Any launch, crash, timeout,
partial output, environment drift, source drift, model drift, verifier failure,
or ambiguous observation closes that operation. It cannot be repaired,
resumed, retried, overwritten, deleted, adopted, or promoted.

Even a successful two-arrow numerical result would prove no optimized kernel,
browser-WASM execution, conversational usefulness, direct P2P availability,
site release, or campaign completion. MemoryEndpoints is unauthorized, and
campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
