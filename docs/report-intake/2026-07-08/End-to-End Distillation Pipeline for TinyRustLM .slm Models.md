# End-to-End Distillation Pipeline for TinyRustLM `.slm` Models

## Deployment target and hard constraints

The central problem is not just “make the model smaller.” It is to compress instruction-following behavior into a student that is simultaneously small enough to ship into a browser, compatible with the current TinyRustLM Rust/WASM execution path, robust under q4/q8 quantization, and predictable enough for local deterministic evaluation. Today’s TinyRustLM runtime validates a custom `.slm` v1 container, supports only `f32`, `q8_0`, and `q4_0`, executes a scalar decoder-only transformer in Rust/WASM, loads the full artifact into WASM memory, rejects values over 128 MiB in the transfer allocator, and currently rejects grouped-query and multi-query attention because KV heads must equal attention heads in execution. The same runtime exposes local generation, diagnostics, and a simple eval runner with sidecars, which makes quality gates technically feasible but also makes architecture mismatch a hard failure rather than a soft optimization problem. citeturn1view1turn12view0turn12view3turn14search0

That constraint stack changes the design objective. A useful TinyRustLM-ready student must preserve assistant-style behaviors that TinyRustLM already exposes in its UI—chat, summarization, rewrite, code explanation, and JSON generation—while running fully local with no server round-trips. In practice that means optimizing not only perplexity or benchmark scores, but also response shape, chat control-token behavior, structural correctness, short-context reasoning, and quantization stability under browser-local inference. Small language models can be strong on-device when architecture and data are chosen deliberately, but the runtime here is stricter than many mobile stacks because the execution contract is explicit and the operator surface is narrow. citeturn1view0turn9view0turn9view1turn8view0

A critical packaging implication follows from the current artifact cap. Using TinyRustLM’s own shipped artifact ratios as a rough guide, q8 storage is about 1.0066 bytes per parameter and q4 storage is about 0.6252 bytes per parameter; that implies a 135M model is about 129.6 MiB in q8 and about 80.5 MiB in q4, while a 360M model is about 345.6 MiB in q8 and about 214.6 MiB in q4. So under the current 128 MiB transfer limit, 135M is realistic in q4, borderline or slightly too large in q8, and 360M is not shippable as a single current-format browser artifact without either changing the loader, sharding, or reducing parameter count. A sub-100M student around 90M would be about 86.4 MiB in q8 and about 53.7 MiB in q4, which fits much more comfortably. citeturn1view1turn16calculator0turn17calculator0turn17calculator1turn26calculator0turn26calculator1

The core difficulty, then, is a three-way compression problem. The teacher knows *what* to do, the student must learn *how* to do it with far less capacity, and the final runtime constrains *how the student is allowed to exist*. That is why a successful pipeline must jointly solve architecture compatibility, behavior transfer, and quantization-aware deployment rather than treating format conversion as a final afterthought. citeturn2search0turn2search2turn24search2turn1view1

## Architecture choices for teacher and student

Teacher selection should be driven by behavioral coverage first and architectural proximity second. For this use case, the teacher must already be strong at instruction following, rewriting, summarization, short reasoning, and structured generation; it does **not** need to be TinyRustLM-compatible, because the teacher runs offline during distillation. A larger instruct model in the 1.7B–8B range is typically the right regime: large enough to provide high-quality targets, small enough that dense logit extraction and hidden-state capture remain tractable. Work on teacher-assisted distillation shows that when the gap between teacher and student is too wide, transfer quality often degrades; introducing an intermediate assistant can improve compression. That is especially relevant here because a browser-targeted 90M–135M student is much smaller than modern instruct teachers. citeturn10search0turn10search4turn10academia17turn8view0turn7search2

For architecture, the teacher and student do **not** need identical attention head counts or hidden sizes if the distillation recipe uses relational attention losses such as MiniLM/MiniLMv2 rather than naïve one-to-one head matching. MiniLMv2 explicitly removes the requirement that teacher and student have the same number of attention heads by distilling self-attention relations instead of raw same-shaped tensors. That flexibility is valuable because many performant small open models use grouped-query attention, while the current TinyRustLM runtime does not execute GQA/MQA. citeturn2search1turn2search5turn11search20turn1view1

A concrete warning: the appealing open 135M and 360M SmolLM2 checkpoints are *not* directly current-runtime compatible. SmolLM2’s model family is attractive because it explicitly targets on-device use and spans 135M, 360M, and 1.7B sizes, but its published configs use a Llama-style decoder with `num_key_value_heads` smaller than `num_attention_heads`, which means GQA rather than plain MHA. The current TinyRustLM runtime rejects that execution pattern. So the right move is not direct conversion of those checkpoints, but rather distillation **into a TinyRustLM-native sibling architecture** that preserves the useful decoder-only/RoPE/RMSNorm/SwiGLU design while setting `num_key_value_heads = num_attention_heads`. citeturn8view0turn18search0turn18search3turn23view3turn1view1

The student architecture should therefore be “runtime-native Llama-like,” meaning: decoder-only transformer, RoPE, RMSNorm, SwiGLU-style MLP, causal self-attention, optional tied input/output embeddings, and plain MHA. The Hugging Face Llama config docs define `num_key_value_heads = num_attention_heads` as standard multi-head attention; TinyRustLM’s runtime already advertises RoPE and RMS epsilon in the binary header and executes embedding lookup, RMSNorm, Q/K/V, RoPE, causal attention, residual flow, SwiGLU FFN, final norm, logits, and sampling. That combination is the safest target because it aligns the training-time architecture with the deployed execution substrate instead of relying on lossy architectural conversion later. citeturn23view3turn1view1

The most practical architecture grid is the following recommendation:

| Target | Recommended student shape | Current TinyRustLM viability | Best packaging mode |
|---|---|---:|---|
| ~90M | 24–28 layers, hidden 512–640, heads 8–10, MHA, tied embeddings | High | q8 or q4 |
| 135M | 28–32 layers, hidden 640–704, heads 10–11, MHA, tied embeddings | High in q4, borderline in q8 | q4 preferred |
| 360M | 30–36 layers, hidden 960–1024, heads 15–16, MHA, tied embeddings | Low with current 128 MiB importer | q4 only after loader changes |

These are design recommendations, not published checkpoint specs. They follow the deployment cap, the runtime operator set, the value of deep-and-thin sub-billion designs reported by MobileLLM, and the current inability of TinyRustLM to execute GQA. citeturn9view0turn1view1turn16calculator2turn16calculator3turn17calculator0

A good teacher/student ladder for this project is therefore:

```text
Teacher: strong instruct model (1.7B–8B, offline only)
Optional assistant: 1.7B Tiny/Smol/Phi-class instruct model
Student: TinyRustLM-native MHA model at 360M, 135M, or sub-100M
Deployment artifact: .slm q4_0 or q8_0
```

If the final deployed target is 135M or below, I would prefer a two-stage teacher path—large teacher to 1.7B assistant, then assistant to tiny student—over one-shot transfer whenever hidden-state and attention matching are used. For pure output-only distillation, a single strong teacher is usually sufficient. citeturn10search0turn10search4turn2search1turn20search0

## Distillation objectives and loss design

For this deployment problem, the student should be trained with a **multi-loss objective**, not a single KD term. DistilBERT showed that combining language modeling supervision, distillation, and hidden-state similarity outperformed pure output matching; TinyBERT and Patient KD showed that intermediate-layer supervision matters; MiniLM and MiniLMv2 showed that attention relations are unusually effective transfer signals; and sequence-level distillation and on-policy GKD address the train/inference mismatch of autoregressive students. In other words, the right solution is composite distillation with stage-specific loss weights. citeturn2search2turn11search0turn11search4turn2search5turn2search1turn20search0turn2search7

A practical total loss is:

\[
\mathcal{L}_{total}=
\lambda_{hard}\mathcal{L}_{CE}+
\lambda_{logit}\mathcal{L}_{KD}+
\lambda_{hid}\mathcal{L}_{hid}+
\lambda_{attn}\mathcal{L}_{attn}+
\lambda_{seq}\mathcal{L}_{seq}+
\lambda_{q}\mathcal{L}_{QAT}
\]

where each term is turned on only in the stages where it is useful. The hard-label term keeps the student anchored to gold or teacher-approved targets; the logit term transfers local next-token uncertainty; the hidden-state and attention terms align internal computation; the sequence term aligns free-running behavior; and the QAT term injects fake quantization so the trained student learns the distortions it will face at inference. This structure is a synthesis of classic KD, Transformer compression work, sequence-level KD, and LLM QAT literature. citeturn2search0turn2search2turn11search4turn2search1turn20search0turn24search2turn3search1

The standard logit distillation term should be temperature-scaled KL divergence over the teacher and student token distributions:

\[
\mathcal{L}_{KD}
=
\tau^2 \cdot
\frac{1}{T}
\sum_{t=1}^{T}
KL\left(
\text{softmax}(z_t^T/\tau)\;||\;\text{softmax}(z_t^S/\tau)
\right)
\]

where \(z_t^T\) and \(z_t^S\) are teacher and student logits at position \(t\), and \(\tau\) is a softening temperature. This is the canonical Hinton-style loss, and the temperature-scaled KL form remains the most stable default for token-level imitation in autoregressive LMs. citeturn2search0turn2search4

For hidden-state matching, use a layer map \(m(i)\) from student layer \(i\) to teacher layer \(m(i)\), then compare normalized states with either cosine loss or projected MSE:

\[
\mathcal{L}_{hid}
=
\frac{1}{L_s}
\sum_{i=1}^{L_s}
\left\|
P_i h_i^S - h_{m(i)}^T
\right\|_2^2
\quad\text{or}\quad
1-\cos(P_i h_i^S, h_{m(i)}^T)
\]

where \(P_i\) is a learned projection if hidden dimensions differ. Patient KD and TinyBERT both support the idea that intermediate supervision improves transfer, especially when the student is shallow or narrow. If the student is extremely small, I would supervise only every second or third student layer to reduce optimization noise. citeturn11search0turn11search3turn11search4turn11search13

For attention transfer, prefer **relation matching** over raw head-by-head map identity. A TinyBERT-style option is KL or MSE over teacher/student attention matrices after masking. A more robust MiniLMv2-style option is to match self-attention relations derived from query, key, and value interactions, which is specifically designed to survive head-count mismatch:

\[
\mathcal{L}_{attn}
=
\frac{1}{L_s}
\sum_{i=1}^{L_s}
\Big[
KL(R_{QK}^{T,m(i)}||R_{QK}^{S,i})
+
KL(R_{VV}^{T,m(i)}||R_{VV}^{S,i})
\Big]
\]

This is the better default when the teacher uses GQA and the student uses MHA, because the relational objective is less brittle than raw attention-map imitation. citeturn2search5turn2search1turn11search20

For sequence-level distillation, I recommend two complementary modes. The **offline** mode uses teacher-generated completions as targets and trains the student with standard autoregressive CE on those sequences:

\[
\mathcal{L}_{seq-offline}
=
-\sum_{t=1}^{T}\log p_S(y_t^T \mid x, y_{<t}^T)
\]

The **on-policy** mode follows GKD: sample student rollouts \(\hat y\), then train with teacher token distributions on the student’s own prefixes:

\[
\mathcal{L}_{seq-onpolicy}
=
\mathbb{E}_{\hat y \sim p_S}
\left[
\sum_{t=1}^{|\hat y|}
KL(
p_T(\cdot \mid x,\hat y_{<t})
\;||\;
p_S(\cdot \mid x,\hat y_{<t})
)
\right]
\]

The offline mode is cheaper; the on-policy mode is better at fixing exposure bias and prompt brittleness. For TinyRustLM deployment, that second property matters a lot because the student will free-run in a local browser with no server-side rescue step. citeturn2search7turn20search0turn20search7

Quantization-aware distillation should be built directly into the latter training stages. QAT for LLMs works by simulating low-precision arithmetic during training, and recent LLM-specific work shows that combining KD and QAT is especially important below 8-bit precision. Here the runtime only supports q4 and q8, so the deployment-oriented recipe is simpler than recent sub-4-bit research: add fake quantization to the student’s linear weights during forward, optionally to activations and KV cache if your exporter/runtime contract supports it later, and compute the KD losses on top of the quantized forward path so the student learns to preserve behavior *after* quantization noise. citeturn24search2turn24search3turn3search1turn3search5

A very workable staged algorithm is:

```text
Stage A: tokenizer/chat-template freeze and architecture initialization
Stage B: broad LM distillation on mixed web/math/code corpus
Stage C: supervised + synthetic instruction distillation
Stage D: on-policy sequence distillation on chat/rewrite/JSON tasks
Stage E: q8-aware distillation
Stage F: q4-aware distillation and export calibration
Stage G: .slm packing, browser smoke, eval gate, release packet
```

The failure mode to avoid is trying to solve all objectives at once from step zero. In tiny students, that often causes optimization conflict: hard CE pushes memorization of targets, logit KD pushes uncertainty imitation, hidden-state matching fights dimension bottlenecks, and QAT magnifies instability early. Stage the losses. citeturn2search2turn11search4turn20search0turn24search2

## Synthetic data, chat template, and tokenizer strategy

Synthetic instruction data is necessary here because the target behaviors are narrow and deployment-specific, but Self-Instruct, Evol-Instruct, Orca, and LIMA collectively point to the right lesson: quality and diversity matter more than sheer volume, synthetic data works best when filtered and deduplicated, and explanation traces can improve small-model behavior when they carry actual process signal rather than just style. LIMA also reinforces that pretraining stores most of the model’s knowledge, while instruction tuning mainly teaches response format and task-following behavior. That means the synthetic set should be designed to transfer *behavioral priors*—how to answer, how to structure, how to remain concise and helpful—without pretending it can manufacture missing world knowledge in a 90M or 135M student. citeturn4search0turn4search1turn4search2turn4search3

The safest generation strategy is to synthesize from **latent task schemas**, not fixed prompt phrasings. Instead of writing 10,000 prompts that all look like “Summarize the following article,” define an abstract task graph with dimensions such as task family, domain, tone, length policy, reasoning depth, formatting requirement, refusal condition, and output schema. Then sample many user renderings from that graph, ideally using a paraphraser separate from the main teacher. This makes the student learn the latent task rather than a narrow surface form. It also makes evaluation easier because you can hold out entire schema combinations and paraphrase templates from training. That recommendation is a synthesis of Self-Instruct-style task bootstrapping, Evol-Instruct-style complexity variation, and known prompt-overfitting failure modes. citeturn4search0turn4search1turn25search6turn25search0

A concrete data generator should work like this:

```text
1. Define canonical capability schemas:
   chat, summarize, rewrite, code_explain, json_extract, short_reason

2. For each schema, sample latent controls:
   domain, tone, verbosity cap, safety boundary, formatting contract,
   context length, ambiguity level, presence/absence of system prompt

3. Render multiple user phrasings:
   plain, noisy, terse, verbose, imperative, indirect, multi-turn follow-up

4. Ask teacher for:
   a) final answer
   b) optional brief rationale (hidden or dropped from final target)
   c) structured metadata: task type, refusal flag, schema id, quality score

5. Filter:
   validity, duplication, template overlap, unsafe leakage, benchmark contamination

6. Keep only one or two answer styles per latent schema to avoid mode collapse.
```

The important part is step 4b: if rationale supervision is used, keep it **brief**. Orca and Distilling Step-by-Step show that explanation traces can teach smaller models richer behavior, but a browser-local student optimized for short reasoning should not be trained to emit long chain-of-thought as a default. Use short rationale summaries or latent rationale tokens during training, then either drop them from final targets or expose them only in a special “brief reasoning” mode. citeturn4search2turn20search1turn20search5

Deduplication is mandatory, not optional. Repetition in training data measurably increases memorization, benchmark overlap, and verbatim regeneration risk; deduplication reduces both memorized text emission and train-test overlap. For synthetic corpora, dedupe at several levels: exact prompt string, normalized prompt, latent schema hash, teacher-output SimHash/MinHash, and n-gram overlap against evaluation corpora. This is one of the strongest low-cost defenses against both canned-prompt overfitting and accidental leakage into evaluation. citeturn21search1turn21search5turn21search16

Chat-template preservation deserves its own policy because it is an easy way to silently ruin the whole project. Hugging Face’s chat-template docs and blog are explicit that chat models are trained on specific serialized message formats and that using a different format produces severe silent degradation. TinyRustLM’s runtime already serializes prompt text through its tokenizer and appends BOS/EOS behavior at generation time. So the student’s **training-time serialization must exactly match the deployment-time serialization**. That means freezing the chat template before instruction distillation, storing it in model provenance, reproducing the same system/user/assistant control tokens in all training data, and banning any “close enough” template substitutions during export. citeturn23view0turn23view1turn23view2turn12view0

Tokenizer choice is equally critical. TinyRustLM supports a phase-one byte tokenizer and a custom BPE tokenizer with byte fallback, while the `.slm` package embeds tokenizer information and the runtime adds BOS/EOS. If you change tokenizer family mid-pipeline, token-level KD becomes awkward or invalid because teacher and student logits no longer refer to the same vocabulary. The safest options are either: keep the student tokenizer fixed from the beginning and ask the teacher to supervise text that is re-tokenized by the student; or use same-family tokenizers and perform direct token-level KD. In this runtime, I would strongly prefer a single BPE tokenizer frozen at student initialization, with vocabulary, BOS/EOS IDs, and chat control tokens treated as part of the deployment ABI. citeturn12view0turn23view2turn23view3

For dataset mixture, use a deliberately imbalanced recipe that protects general language ability while biasing toward deployment tasks. A good default for post-pretraining and instruction distillation is:

| Split | Purpose | Suggested share |
|---|---|---:|
| Broad text continuation | Preserve fluency, syntax, generalization | 35% |
| Code and code-adjacent text | Support code explanation and structured reasoning | 15% |
| Rewrite/summarization tasks | Core TinyRustLM UX behaviors | 20% |
| Chat instruction following | Assistant style and turn-taking | 15% |
| JSON / structured extraction | High-value deterministic local task | 10% |
| Short-reasoning / rubric tasks | Preserve concise reasoning | 5% |

This mixture is a deployment-oriented recommendation grounded in the data-mixture lessons from SmolLM2, the availability of rewrite/function/summary datasets in its post-training stack, and the known importance of specialized instruction tuning rather than raw task-count inflation. citeturn9view1turn8view0turn22search0turn22search8

## Training recipes and experiment matrix

The training schedule should change by target size because 360M, 135M, and sub-100M students do not fail in the same way. A 360M student is mainly limited by current packaging/runtime constraints; a 135M student is limited by both capacity and q4 brittleness; a sub-100M student is limited by expressiveness and tends to collapse into templated patterns. The experiments should therefore be designed around different primary risks rather than using one universal recipe. citeturn1view1turn16calculator2turn17calculator0turn26calculator0

My recommended training matrix is:

| Target | Primary goal | Primary risk | Distillation emphasis | Release expectation |
|---|---|---|---|---|
| 360M | Highest quality tiny local model | Too large for current importer | Full multi-loss + on-policy + q4 QAT | “Next runtime” candidate |
| 135M | Best current practical browser model | Quantization cliff, template overfit | Logit + attention relations + moderate on-policy + q4 QAT | Current `.slm` product candidate |
| <100M | Fastest and safest current artifact | Under-capacity, canned behavior | Strong hard targets + logit KD + limited rationale + q8/q4 | Constrained assistant / utility mode |

Those are deployment recommendations, but they follow directly from the current runtime cap and the different compression pathologies seen in small-model work. citeturn1view1turn9view0turn8view0

For the 360M line, I would run three ablations. First, an **architecture ablation**: SmolLM2-like depth/width but converted to strict MHA. Second, a **distillation ablation**: logits-only vs logits+hidden+attention vs full multi-loss. Third, a **sequence ablation**: offline teacher sequences only vs mixed offline/on-policy GKD. Even though 360M does not fit the current browser importer, it is still the best research target because it exposes which behavioral transfers survive compression before the harsher 135M or 90M cuts. If the loader later gains sharding or larger imports, that line becomes deployable quickly. citeturn18search0turn23view3turn20search0turn2search1

For the 135M line, the default recipe should be: initialize a TinyRustLM-native MHA student; run broad LM KD on mixed general text; switch to task-weighted instruction distillation; then perform q8-aware and q4-aware late-stage distillation. I would bias the loss weights roughly toward \(\lambda_{hard}=1.0\), \(\lambda_{logit}=0.7\), \(\lambda_{hid}=0.15\), \(\lambda_{attn}=0.25\), \(\lambda_{seq}=0.35\) during the instruction stage, then reduce hidden-state loss and increase sequence/QAT losses late. The exact numbers are recommendations, but the shape matters: in tiny students, aggressive hidden matching late in training often harms output calibration more than it helps. citeturn2search2turn11search4turn2search1turn20search0turn24search2

For the sub-100M line, simplify. Use fewer objectives, shorter outputs, and stricter formatting. This student class should be positioned as a compact utility assistant rather than a general chat model. I would train it on high-density tasks where correctness is externally checkable—JSON extraction, constrained summarization, concise rewrite, code explanation with bounded templates—and reduce free-form open-ended chat proportion. The literature on small and on-device language models consistently shows that architecture and data selection matter more as parameter count falls; trying to preserve broad assistantness too aggressively at this size usually produces brittle prompt imitation instead of reliable local utility. citeturn9view0turn8view0turn4search3

A concrete optimizer/config template that should work well for all three targets is:

```text
Optimizer: AdamW or fused AdamW equivalent
LR schedule: warmup + cosine decay
Warmup: 1%–3% of steps
Global batch: as large as memory allows, target stable token-level KL
Gradient clipping: 1.0
Label smoothing: off for hard CE, rely on teacher softness
Temperature τ: 1.5–2.5 for KD, sweep once per target size
Context lengths:
  broad KD: 512–2048
  chat/rewrite/json: 256–1024
  browser regression suite: 64–512
QAT entry:
  q8 fake quant after student becomes behaviorally stable
  q4 fake quant only in final third of training
Checkpoint policy:
  save best by held-out unseen-prompt suite, not train loss
```

The goals behind that template are standard: avoid early quantization destabilization, avoid choosing checkpoints by memorization-friendly train metrics, and keep context lengths realistic for browser-local latency. These are recommendations supported by KD and QAT practice rather than exact source prescriptions. citeturn24search2turn3search1turn20search0

The most important failure modes during training are predictable. If the student begins answering with the same opening phrase or with near-identical JSON wrappers across many tasks, you have prompt-specific collapse. If q4 performance drops disproportionately on JSON validity and bracket closure, you have a quantization cliff in low-entropy formatting tokens. If chat performance looks good in the lab but fails after export, suspect chat-template or BOS/EOS mismatch before suspecting the optimizer. If the model scores well on public test sets but fails on paraphrase or private prompts, suspect contamination or template overfitting. citeturn23view0turn23view1turn21search1turn25search0turn25search6turn22search6

## Evaluation, memorization controls, and `.slm` release packaging

Evaluation gates should be built around **unseen prompts**, not seen prompt families. IFEval is a strong anchor for verifiable instruction following; MT-Bench is useful for broad chat quality; OpenRewriteEval directly measures rewrite behavior; and custom deterministic suites are essential for JSON, code explanation, summarization, and browser smoke. Because TinyRustLM already has a local eval runner and sidecar concept, the release process should separate public benchmark reporting from frozen deployment gates. Public benchmarks tell you whether the student is broadly sane; private gates decide whether a `.slm` ships. citeturn6search4turn6search0turn8view0turn22search0turn22search3turn12view3

The minimum release gate set I would require is:

| Gate | Metric style | Why it matters |
|---|---|---|
| Unseen chat prompts | pairwise judge + human spot checks | Assistantness |
| IFEval-style prompts | exact/rule-based | Instruction following |
| OpenRewriteEval subset | Rouge-L + pairwise quality | Rewrite behavior |
| Summarization holdout | factuality rubric + compression ratio | Useful summaries |
| JSON schema suite | exact schema validation | Deterministic local utility |
| Code explanation set | rubric for correctness and clarity | Developer use case |
| Browser runtime smoke | exact-match and stability | Deployment readiness |
| Quantized parity | q4/q8 vs f32 delta | Packaging confidence |

The specific thresholds should be defined relative to a candidate baseline, but the release rule should be conservative: no `.slm` promotion if q4 loses structural reliability even when it still “sounds” plausible. The runtime’s sidecar/release-packet model is a good fit for that philosophy because it already anticipates cases, pass/fail, lineage, evidence, and rollback. citeturn12view3turn12view0

To detect memorized or prompt-specific behavior, use three different probes instead of one. First, **paraphrase invariance**: rewrite every evaluation prompt through several templating styles and measure score drop; brittle models that learned canned phrasing will fall sharply. Second, **nearest-neighbor contamination search**: compute lexical and embedding similarity from every eval prompt/output pair to the instruction corpus and synthetic cache, then flag unusually close matches for audit. Third, **extraction-style memorization probes**: ask open-ended continuations, prefix-completion tasks, and adversarial prompts modeled after known training-data extraction work, and inspect whether the student reproduces long verbatim spans. These methods are motivated by memorization and extraction research as well as recent work on prompt overfitting and contamination detection. citeturn6search3turn6search7turn21search1turn21search5turn25search6turn25search2turn25search15

A particularly good anti-overfitting test plan for this project is a **template holdout matrix**. During data generation, assign every synthetic example a latent schema ID and a surface-template ID. At evaluation time, hold out entire template families, not just random examples. Then add perturbations: role-token style changes, system-message removal, shorter or longer user wording, reordered instructions, and synonym-heavy rewrites. If performance stays high only when the original serialization is preserved exactly, you do not have good instruction transfer; you have prompt memorization. citeturn25search0turn25search6turn23view0turn23view1

The final export should produce more than a raw `.slm` blob. The binary itself should contain the model header, tokenizer section, tensor directory, quantized tensor payloads, and checksums required by `.slm` v1. Alongside that, ship a provenance manifest and an eval sidecar. TinyRustLM’s own workspace already distinguishes binary admission, provenance validation, quantized-variant emission, diagnostics, eval sidecars, and release packets, so the packaging story should follow that shape rather than inventing a separate release model. citeturn1view1turn12view0turn12view3

A production-ready release packet should include at least:

```text
model.slm
model.provenance.json
model.eval.json
model.receipt.json
```

where `model.provenance.json` records teacher identity, teacher version, student architecture, tokenizer checksum, chat template, training code commit, data sources and licenses, distillation loss weights, quantization recipe, export tool version, SHA-256 hashes, and known limitations; `model.eval.json` records the frozen unseen-prompt suite, metrics, q4/q8/f32 deltas, browser smoke results, and pass/fail decisions; and `model.receipt.json` records promotion time, parent lineage, rollback target, and artifact digests. That is slightly more specific than the currently published TinyRustLM docs, but it is directly aligned with their provenance manifest, eval sidecar, and release packet concepts. citeturn12view0turn12view3turn1view3

The final recommendation is straightforward. If the goal is a **current** TinyRustLM browser-local model, prioritize a 135M q4 student and a sub-100M fallback, both on a TinyRustLM-native MHA architecture with frozen tokenizer/template ABI, multi-loss distillation, late-stage q4-aware training, and strict unseen-prompt gates. If the goal is a **research** line that will become product-ready after runtime improvements, add a 360M MHA student now, but treat it as a future `.slm` candidate until the importer and memory path exceed today’s 128 MiB constraints. That division respects the actual runtime today while still building a clear path to better local quality tomorrow. citeturn1view1turn16calculator2turn17calculator0turn26calculator0