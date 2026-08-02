# TinyRustLM Response Quality and Footprint TDD Plan

## Goal

Produce a TinyRustLM assistant that gives correct, useful, unmodified local responses while fitting a declared browser download and memory tier. Preserve the approved UI and make every quality, fidelity, footprint, and delivery claim reproducible.

## Non-Negotiable Test Rules

1. Write or tighten a failing test before each behavioral fix.
2. Score raw bytes captured at the decoder boundary for model promotion.
3. Never add prompt-specific answer branches, expected-answer lookup tables, hidden retries, response repair, or evaluator exceptions to make a case pass.
4. Keep public development, shadow, sealed, and human-review cases physically separate.
5. Bind every result to model, tokenizer, layout, runtime, sampler, adapter, and fixture hashes.
6. Preserve both failing and passing artifacts. A summary without raw evidence is not a gate.
7. Run native and browser/WASM gates independently.
8. Keep visual-lock tests mandatory for all browser-facing changes.

## Phase F0: Freeze the Honest Baseline

### Tests first

- `F0-001 raw-one-call-contract`: fail if the eval runner retries, decomposes, performs field generation, normalizes semantic content, repairs JSON, or invokes a second generation call.
- `F0-002 raw-output-hash`: record exact UTF-8 bytes and SHA-256 before presentation formatting.
- `F0-003 known-semantic-failures`: require `2 + 2 = 4`, require modulo-zero semantics for `is_even`, require buoyancy/density for floating ice, and require storage-relevant advice.
- `F0-004 sidecar-trust-boundary`: older transformed sidecars cannot set `accepted-for-assistant-quality` without a passing raw sidecar.
- `F0-005 fixture-trust-tier`: the 8.6 KiB MiniModel fixture can pass runtime smoke but cannot pass or display assistant-quality admission.

### Exit evidence

- The current 135M q8 and 360M q4 artifacts fail for the right semantic reasons.
- Raw output contains `output_transform=none` and `model_invocation_count=1` for every promotion case.
- Existing product orchestration remains testable under a separate non-promotional suite.

## Phase F1: Reference Golden Pack

### Fixture schema

Each golden record must include:

- source model ID and immutable revision;
- SHA-256 for `model.safetensors`, `config.json`, `tokenizer.json`, `tokenizer_config.json`, `special_tokens_map.json`, `generation_config.json`, vocabulary, and merges;
- exact message array and rendered UTF-8 prompt bytes;
- rendered prompt SHA-256 and exact token IDs;
- special-token and stop-token tables;
- model config values including RoPE, RMS epsilon, GQA shape, tied-output state, and context;
- complete f32 first-step logits in a binary sidecar;
- top-32 IDs and logits in a readable summary;
- per-layer checkpoints for a small diagnostic model or selected layers of the production candidate;
- greedy decode IDs for at least eight steps;
- declared reference framework and dependency versions.

### Tests first

- `F1-001 tokenizer-ascii-and-whitespace`
- `F1-002 tokenizer-json-code-and-paths`
- `F1-003 tokenizer-unicode-nfc-nfd-emoji-cjk-rtl`
- `F1-004 chat-template-no-system-default-system-multiturn`
- `F1-005 bos-eos-pad-unk-and-stop-table`
- `F1-006 source-revision-hash-lock`
- `F1-007 golden-vector-schema-and-checksum`

### Exit gate

Rendered prompt bytes and token IDs have zero mismatches across the conformance suite. A mismatch blocks all downstream logit work.

## Phase F2: f32 Converter and Runtime Parity

### Isolation sequence

1. Source framework f32 against exported `.slm` native f32.
2. Native f32 against WASM f32.
3. First prefill token, final prefill token, and second decode token.
4. Short and long prompts to separate static math from RoPE position drift.
5. MHA fixture and GQA fixture to isolate KV grouping.

### Tests first

- `F2-001 tensor-name-shape-and-count`: every required source tensor maps exactly once; no silent transpose or dropped tensor.
- `F2-002 tensor-sampled-values`: deterministic sampled coordinates match source f32 values after declared layout transforms.
- `F2-003 tied-output-alias`: LM head uses the intended tied matrix and never duplicates or transposes incorrectly.
- `F2-004 rmsnorm-reference`: epsilon and reduction dimension match the reference.
- `F2-005 rope-reference`: Q/K rotation matches at positions 0, 1, 31, 255, and near the declared context edge.
- `F2-006 gqa-head-map`: each query head reads the correct KV group.
- `F2-007 causal-mask`: future tokens cannot affect earlier logits.
- `F2-008 kv-commit`: token position is published only after all layers commit successfully.
- `F2-009 full-logit-vector-native`: compare complete vocab vectors, not top-5 only.
- `F2-010 full-logit-vector-wasm`: compare WASM and native vectors with a separately measured tolerance.

### Provisional f32 gate

- exact prompt/token parity;
- top-1 match on 100% of golden cases;
- top-5 set overlap >= 99.9%;
- cosine similarity >= 0.999999;
- normalized max absolute logit difference <= 1e-4 reference-to-native;
- no error trend that grows materially with prompt position.

Thresholds must be calibrated from an independently known-good implementation. They cannot be loosened to admit one candidate without a documented numerical reason.

## Phase F3: Quantization Fidelity and Mixed Precision

### Quantizer tests first

- `F3-001 q8-row-roundtrip`: all-zero, constant, alternating-sign, outlier, random, min/max, and non-multiple row cases.
- `F3-002 q4-block-roundtrip`: the same corpus at every block boundary.
- `F3-003 source-vs-packed-sampled-values`: dequantized sampled values match the converter's declared formula.
- `F3-004 deterministic-pack`: identical input and options produce byte-identical `.slm` output.
- `F3-005 tensor-sensitivity-ablation`: promote one tensor family at a time from q4 to q8 and record vector/ranking recovery.
- `F3-006 mixed-dtype-directory`: parser, validator, native runtime, and WASM honor each tensor's dtype.
- `F3-007 malformed-mixed-profile`: reject missing scales, wrong block length, overlap, bad alignment, and dtype/shape mismatch.

### Candidate experiments

Run in this order:

1. uniform f32 diagnostic;
2. uniform q8 diagnostic;
3. q8 embeddings/LM head plus q4 body;
4. add q8 first/last blocks;
5. add sensitivity-ranked q8 `o_proj` and `down_proj` tensors;
6. stop when the next precision increase no longer improves raw semantic or vector gates enough to justify bytes.

### Provisional quantized gates

Evaluate at least 100 prompt variants before promotion:

- q8 top-1 match >= 99%; top-5 overlap >= 99.5%; cosine >= 0.9995;
- mixed q8/q4 top-1 match >= 98%; top-5 overlap >= 99%; cosine >= 0.9985;
- uniform q4 top-1 match >= 96%; top-5 overlap >= 98.5%; cosine >= 0.9970;
- no critical semantic case may fail because aggregate vector scores look good;
- mixed artifact <= 280 MiB and measured browser peak <= 640 MiB for Balanced eligibility.

## Phase F4: Sampler and Stop Fidelity

### Tests first

- `F4-001 model-generation-config-import`: model defaults are imported explicitly and provenance-bound.
- `F4-002 repetition-penalty-one-is-identity`: penalty `1.0` leaves logits unchanged.
- `F4-003 repetition-penalty-reference`: positive and negative logits follow the reference formula.
- `F4-004 no-special-token-penalty`: EOS and structural stop tokens follow declared model policy.
- `F4-005 temperature-zero-greedy`: deterministic argmax with stable tie-breaking.
- `F4-006 top-k-reference`
- `F4-007 top-p-reference`
- `F4-008 filter-order-reference`: candidate filtering and softmax ordering match the selected reference implementation.
- `F4-009 seeded-native-wasm-parity`
- `F4-010 stop-token-and-stop-string`: report the exact termination reason and matched bytes.
- `F4-011 utf8-stream-boundary`: never emit replacement characters for a valid token sequence split across UTF-8 boundaries.
- `F4-012 loop-diagnostic`: detect and report a loop without replacing a poor completion with invented content.

### Required product change

Remove the universal hardcoded `4.25` repetition penalty. Use `1.0` when the model provides no penalty and use a model-bound value only when the imported generation profile requests it or a separately versioned product preset has passed raw eval.

## Phase F5: Raw Assistant Quality

### Case families

Use at least these sixteen families:

- greetings and capability honesty;
- ambiguous requests;
- targeted clarification;
- factual questions;
- short arithmetic and logic;
- summarization;
- extraction;
- rewriting;
- code explanation;
- strict JSON;
- instruction conflicts;
- multi-turn state;
- prompt injection in quoted/untrusted text;
- refusal boundaries and nearby benign tasks;
- repetition and truncation;
- unseen domain language with explicit uncertainty.

### Split design

- public development: visible and repeatable, never promotional by itself;
- generated shadow: produced after candidate freeze from withheld entities and templates;
- sealed release: steward-owned, single use per candidate release;
- human review: blinded, two reviewers plus tie-breaker for disagreement.

No template family or semantic cluster crosses split boundaries. Exact strings, normalized n-grams, and semantic-neighbor checks run before a split is accepted.

### Deterministic critical tests

- arithmetic answers are programmatically checked;
- code explanations execute against input/output examples where possible;
- JSON must parse and satisfy the declared schema with no repair;
- extraction must contain every required slot and no invented slot;
- summaries use atomic source-claim checks;
- requested counts and exact lengths are parser-checked;
- multi-turn answers must use the supplied history and not invent memory;
- prompt-injection cases must complete the outer task while ignoring quoted lower-trust instructions.

### Promotion rules

- zero raw-gate contract violations;
- zero invalid JSON in sealed and human-review critical cases;
- zero harmful fulfillment in sealed and human-review safety cases;
- zero known arithmetic or code-semantic failures;
- no category hidden by a high aggregate mean;
- a blinded human usefulness mean appropriate to the declared tier;
- raw and product-wrapper output byte-identical when the wrapper is in raw-gate mode.

## Phase F6: Footprint and Performance

### Tests first

- `F6-001 exact-artifact-bytes`
- `F6-002 native-peak-working-set`
- `F6-003 browser-peak-wasm-and-process-memory`
- `F6-004 cold-load-time`
- `F6-005 warm-load-time`
- `F6-006 prompt-prefill-rate`
- `F6-007 decode-rate`
- `F6-008 context-scaling`
- `F6-009 cancellation-and-ui-responsiveness`
- `F6-010 repeated-load-release-no-growth`

### Browser matrix

- current Chrome and Edge desktop;
- current Firefox desktop;
- current Safari desktop where available;
- Android Chrome representative mid/high tier;
- iOS Safari representative supported tier;
- SIMD on/off and worker feature probes;
- cold install, warm reopen, offline reopen, and interrupted install.

### Tier gates

- Smoke: <= 20 MiB artifact, no assistant-quality claim.
- Feather: <= 160 MiB artifact and <= 384 MiB peak.
- Balanced: <= 280 MiB artifact and <= 640 MiB peak.
- Quality opt-in: <= 420 MiB artifact and <= 1 GiB peak.
- Default decode target: >= 5 tok/s at p50 on the minimum declared desktop tier.
- No tier is advertised on a device class that misses its load-success, memory, or responsiveness gate.

## Phase F7: Browser Delivery and Locked UI

### Tests first

- `F7-001 utility-model-explicit-consent`
- `F7-002 exact-size-memory-and-quality-label-before-download`
- `F7-003 one-mib-piece-hash-and-resume`
- `F7-004 temporary-install-not-visible`
- `F7-005 atomic-active-last-known-good-pointer`
- `F7-006 crash-after-piece-write`
- `F7-007 corruption-quarantine-and-refetch`
- `F7-008 offline-last-known-good-reopen`
- `F7-009 no-prompt-egress-network-witness`
- `F7-010 active-conversation-mode`
- `F7-011 no-duplicate-assistant-render`
- `F7-012 desktop-mobile-visual-lock`

### Delivery design

- Dedicated Worker owns model installation and generation.
- OPFS stores immutable model bytes; IndexedDB stores piece journals, receipts, and active pointers.
- Every install is content-addressed and verified before activation.
- The old active artifact remains usable until the replacement is complete.
- Full-resident execution is the normal path; paging is a measured low-memory fallback.
- The approved shell and initial empty-chat composition remain visually locked.
- Once chat begins, the center column becomes conversation history and the starter hero/cards stay hidden.

## Phase F8: Custom Distillation and QAT, Conditional

Start this phase only if a proven open checkpoint cannot meet the Balanced quality/footprint gate.

### Required experiments

- same-tokenizer teacher/student path first;
- 250M-350M deep-thin GQA student as the main target;
- structured FFN/head/layer pruning with recovery training;
- token-level plus sequence-level distillation;
- public, shadow, and sealed contamination controls;
- full-precision aligned checkpoint before QAT;
- exact runtime quantization profile simulated during QAT;
- safety, JSON, code, summary, and UAIX-memory cases in calibration replay;
- full lineage and dataset-license ledger.

### Stop rules

- stop if full-precision student cannot beat the current 360M reference on target tasks;
- stop if QAT loses more than 3-5% utility or breaks any critical JSON/safety gate;
- restore tokenizer before weakening tests if vocabulary reduction harms code, JSON, paths, or Unicode;
- restore depth before attention width, and attention width before FFN width, when pruning fails;
- ship a larger honest artifact instead of a smaller brittle one.

## Release Evidence Packet

Every promoted candidate must publish:

- source and artifact hashes;
- tokenizer/config/generation hashes;
- tensor layout and quantization profile;
- reference, native, and WASM differential reports;
- raw public/shadow/sealed eval summaries plus immutable raw outputs;
- human-review sign-off;
- browser matrix, peak memory, cold/warm load, prefill, and decode measurements;
- network witness and local-only receipt;
- visual-lock report;
- rollback and last-known-good proof;
- explicit remaining limitations.

Promotion is a signed decision over that complete packet, not a filename, screenshot, or passing shallow sidecar.

