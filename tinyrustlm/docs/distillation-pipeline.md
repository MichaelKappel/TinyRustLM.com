# Distillation And Specialist Research

## Status

TinyRustLM has no promoted trained derivative. Training tools, curricula,
review workbooks, adapters, specialist proposals, and experiments are research
infrastructure only. A successful dataset freeze, optimizer run, adapter export,
or conversion does not establish assistant quality or product eligibility.

The immutable public
`Qwen/Qwen3-0.6B` source at revision
`c1899de289a04d12100db370d81485cdf75e47ca` is terminally rejected as a product
model. It is permitted only as ancestry for a distinct derivative in the
[current working-model lane](../training/qwen3-0.6b-working-model-v1/README.md).
That lane still requires independent evaluation custody, reviewed curriculum,
fresh exact environment/training bindings, untouched derivative qualification,
SLM2 conversion and native/WASM/browser evidence. No working default model is
established by the research infrastructure.

The older generic sequence/top-k trainer, teacher-cache builder and
adapter-source/ALR1 exporter are retired designs. Their 18 recipes, two cache
controls and three test modules have also been reviewed for removal. Automatic
approval review blocked the 26-file deletion; those files physically remain
pending the hash-checked owner cleanup command. Do not execute or restore that
route. Exact source history and useful experimental lessons are retained in
Git and `wiki/runtime-mirust/reports/ecosystem-experiment-lessons-2026-09-12.md`.

## No-Cheat Boundary

Training and evaluation custody are separate:

- sealed evaluation prompts, paraphrase families, expected concepts, judge
  rubrics, and failed holdouts never enter training or teacher generation;
- source records bind prompt, reviewed final answer, provenance, license,
  reviewer decision, and exclusion-set identity;
- hidden reasoning, credentials, private memory, personally identifying data,
  and malicious teacher-policy artifacts reject;
- assistant-only loss masks system, history, and active user tokens;
- teacher drafts are not approved examples;
- every removal or correction has append-only lineage;
- exact, n-gram, semantic-neighbor, template-family, entity-substituted, and
  answer-concept overlap checks run before freezing;
- a failed sealed holdout is preserved and never converted into training data;
- raw candidate outputs are never repaired, completed, or selected best-of-N.

Positive ordinary helpfulness must substantially outnumber refusal and boundary
examples. A curriculum covers ordinary conversation, ambiguity, practical
constraints, conflicting authorities, latest-turn precedence, trusted and
untrusted memory, multi-turn references, lawful adult inquiry, narrow harm
boundaries, factual uncertainty, summaries, rewrites, JSON, extraction, and
code explanation.

## Generalization Design

Examples teach a rule through controlled scenario factors rather than a fixed
answer phrase. Vary:

- entities, products, dates, percentages, units, and discourse style;
- available and unavailable resources;
- authority order and source reliability;
- explicit and implicit negation;
- current user preferences and stale profile claims;
- trustworthy state versus quoted or retrieved untrusted instructions;
- multi-turn state changes and references;
- hard negatives and teacher disagreement.

Hold out complete template and factor combinations, not merely individual
strings. Promotion requires unseen paraphrases and changed-factor behavior,
including cases where the correct answer must change.

## Method Ladder

Use the smallest credible experiment first:

1. screen an eligible new source under the declared product template and
   sampling profile; do not replay terminally rejected exact bytes;
2. run a small reviewed assistant-only SFT or sequence-distillation pilot;
3. compare a low-rank adapter only if the sole current composition contract
   defines and validates that adapter type;
4. consider preference optimization only after a sufficiently large,
   independently reviewed paired corpus exists;
5. consider token-level KL, top-k-logit, hidden-state, or full fine-tuning only
   when teacher access, corpus scale, compute, and reproducibility justify the
   additional complexity.

Do not introduce a production adapter format, specialist router, or training
dependency merely because a report describes one. It must beat a simpler
baseline under equal compute, latency, memory, and broad-quality accounting.

## Specialist Portfolio

A specialist must be a genuinely trained and independently executable model or
an exact-base-bound adapter admitted by the sole current composition contract.
Arbitrary layers, heads, tensors, vocabulary rows, or byte slices from a dense
model are not useful specialists.

Routing is evaluated separately from specialist quality. It must be
deterministic or explicitly sampled, visible before generation, bounded, and
free of hidden champion retries. A composition change invalidates KV state.
Twenty different filenames or quantization encodings are not twenty useful
models unless each artifact has distinct bytes, provenance, qualification, and
a meaningful product role.

Colibri, TurboVec, TurboQuant, vector quantization, compressed KV, sparse
subnetworks, and one-bit or ternary systems remain comparison research. They are
not TinyRustLM implementation claims.

## Compute And Reproducibility

Every experiment binds source and teacher identities, dataset and exclusion
manifests, code commit/tree, dependency locks, tokenizer/template/prompt
profiles, seeds, precision, optimizer, batch and sequence policy, checkpoint
cadence, hardware class, and terminal state.

Estimate time rather than inventing measurements:

```text
optimizer_steps = ceil(training_tokens / effective_tokens_per_step)
wall_time = optimizer_steps * observed_seconds_per_step
steady_checkpoint_storage = one_current_payload + compact_progress_receipts
replacement_peak_storage = old_payload + verified_new_payload + compact_receipts
```

Memory estimates separately account for parameters, gradients, optimizer
states, activations, temporary buffers, adapters, and framework overhead.
CPU-only pilots validate data, loss masks, determinism, restart safety, and
learning direction; they do not predict GPU throughput.

Stop a failed run when data integrity, numerical stability, exclusion custody,
generalization, ordinary helpfulness, or preregistered resource limits fail.
Do not continue solely to recover sunk compute.

## Promotion Matrix

Compare under identical rendered prompts, tokens, seeds, limits, and raw-output
custody:

- untouched source framework;
- trained checkpoint;
- adapter plus exact base, if applicable;
- merged model, if applicable;
- scalar-native SLM2;
- optimized native;
- browser-WASM SLM2.

Numerical parity and behavioral noninferiority are separate. Promotion requires
ordinary-helpfulness regression budgets, catastrophic-failure limits,
multi-turn and metamorphic cases, blinded human review, stochastic confidence
intervals where sampling is shipped, latency/memory evidence, and a complete
contamination audit.

An honest reject is a successful experiment outcome. It preserves evidence and
leads to a new source or separately registered training experiment, never a
lower gate or relabeled artifact.

## Source Control

Small schemas, generators, tests, public-safe manifests, and bounded results
belong in Git. Model weights, datasets containing private text, raw outputs,
teacher drafts, checkpoints, and private evidence stay outside the repository.
No maintained document should give commands using `D:`; private roots are
operator-supplied and separately owned.
