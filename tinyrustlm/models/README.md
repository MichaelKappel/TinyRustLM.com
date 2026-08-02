# TinyRustLM Model Artifacts

This directory contains deterministic test fixtures and, where explicitly
identified, locally available research artifacts. It is not the production
model catalog.

## Source-Control Rule

Candidate, trained, converted, and product model payloads must live in an
operator-controlled external content-addressed root. This includes `.slm`,
SafeTensors, GGUF, ONNX, framework checkpoints, extracted raw tensors, and P2P
piece bytes. Private campaign manifests and receipts reference them by
absolute local path, byte count, and cryptographic identity.

Only small deterministic fixtures needed to test binary parsing, quantization,
tokenizers, runtime loading, malformed input, and failure behavior may be
tracked. The source-control allowlist is enforced against the Git index and
caps each `.slm` fixture at 64 KiB. A tracked fixture is never a qualifying
campaign model.

## Evidence Classes

Model artifacts must be described by the evidence they actually have:

- `runtime-smoke-only`: loads or executes a bounded fixture path.
- `structural-validation-only`: passes format and tensor checks.
- `conversation-screened`: passes an initial raw-output screen.
- `conversation-proven`: passes the current sealed conversation suite.
- `task-specific-proven`: passes a declared specialist suite.
- `full-assistant-quality`: passes the complete assistant-quality gate.

Aliases, filenames, popularity, model size, parameter count, and successful
conversion do not raise the claim level.

## Campaign Admission

A v2 dogfood model entry binds:

- external `.slm` path, byte count, and SHA-256;
- manifest path;
- source-review path;
- current quality-evidence path;
- immutable source model ID and revision;
- `.slm.acg1` path, URL, size, and SHA-256;
- base model ID and composition ID;
- active graph SHA-256;
- route, KV, and position policy identities;
- graph member count;
- evidence-supported quality claim.

The 20 campaign entries must have 20 distinct `.slm` SHA-256 values. Relabeled
bytes and smoke fixtures are rejected.

## Immutable Specialization

TinyRustLM specialization is represented by an immutable ACG1 composition
graph activated by Rust before evaluation and browser generation. The same
composition identity must appear in:

- model qualification evidence;
- the private campaign manifest;
- runtime diagnostics;
- browser execution evidence;
- the final browser receipt.

The browser does not infer or mutate adapter stacks, combine parent models, or
assemble a new artifact from mutable route metadata. A specialist that needs
different weights or behavior must be converted, qualified, and identified as
a distinct immutable artifact or graph.

## External Model Layout

A practical external layout is:

```text
<external-model-root>/
  <model-id>/
    source/
    review/
    converted/
      model.slm
      model.slm.manifest
      model.slm.acg1
    evaluation/
    receipts/
```

The external root is not a public model-byte server. MiniModel catalog metadata
may identify direct peers, but project websites must not proxy `.slm` bytes.

## Qualification

From the repository root:

```powershell
npm --prefix tinyrustlm run qualify:models -- `
  --inventory <candidate-inventory.json> `
  --source-root <external-model-root> `
  --output-root <qualification-output-root> `
  --evidence-root <evidence-root> `
  --indices <comma-separated-candidate-indices>
```

The current runner requires `q8_0` and current assistant-quality cases. It
preserves rejected and errored attempts as immutable evidence. A candidate must
pass source review, conversion, native runtime execution, semantic evaluation,
and composition activation before it can parent a browser receipt.

## Fixture Use

Fixtures are appropriate for:

- malformed header and tensor-bound tests;
- tokenizer and quantization fixtures;
- deterministic one-token runtime checks;
- WASM ABI checks;
- receipt and manifest parser tests;
- profile, network, and failure-path unit tests.

Fixtures are not appropriate for:

- the 20 qualified model count;
- the 50 clean-browser count;
- live MemoryEndpoints continuity;
- external P2P proof;
- catalog announcement;
- public release claims.

When a fixture test passes, record it as local or fixture evidence and keep all
live campaign counters unchanged.
