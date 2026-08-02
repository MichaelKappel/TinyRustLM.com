# Distillation and QAT Engineering Plan for TinyRustLM and the SLM Ecosystem

## Product constraints that should shape the model

TinyRustLM is explicitly designed for **browser-local inference**, emphasizes that **no prompts are sent to a server**, supports import and verification of local `.slm` artifacts, exposes generation presets for **rewrite, summarize, code explanation, and JSON**, and already presents **SmolLM2 360M Instruct** and **SmolLM2 135M Instruct** as browser-facing model options. It also exposes UAIX memory deck binding and provenance surfaces such as manifest, source snapshot, tokenizer import, admission, eval checksum, and next-gate status. Those product facts strongly imply that the first production student should optimize for **short-turn assistant quality, deterministic export, aggressive provenance, and fail-closed local execution**, not for frontier reasoning breadth. citeturn41view0turn28view0

MiniModel’s public catalog reinforces the same constraint set. Its model catalog declares `project_server_serves_model_bytes: false`, `project_server_runs_model_bytes: false`, and `execution_policy: "user-local-file-only"`, while catalog entries include fields such as `artifact_byte_count`, `artifact_sha256`, `slm_model_shape`, `slm_quantization`, `slm_checksum`, `slm_tokenizer_checksum`, and `slm_tensor_layout_checksum`. That means the export format for this plan should produce **content-addressed, browser-consumable, self-describing artifacts** that do not depend on silent server fallback. citeturn41view2

UAIX support is not incidental. TinyRustLM exposes UAIX memory setup modes including **Base active memory, Agent File Handoff, LLM Wiki, Talisman System, and Advanced Persona Profile**, and lets the user bind an extracted `.uai` folder locally. The public UAIX docs specify a required launch-baseline file suite, make `.uai/talisman.uai` a default active instruction file, define persona and advanced persona file sets, and define `.uai/long-term-memory.uai` as the required file for long-term-memory configurations. A browser assistant for this ecosystem therefore needs reliable behavior on **local-memory-grounded turns**, including “read, summarize, answer from memory deck, defer when absent, preserve persona bounds, and preserve no-op / human-review triggers.” citeturn41view0turn10view0turn10view1turn10view2turn9view2

The browser runtime also constrains size and precision choices. WebAssembly with 32-bit addressing is capped at **4 GiB** addressable memory, WebGPU implementations may impose their own memory limits, ONNX Runtime Web recommends WebGPU for performance and documents browser/version constraints, and Transformers.js explicitly recommends **quantized models** in browsers, with common dtypes including `q4` and `q8`, while warning that WebGPU remains experimental in many browsers. This pushes the plan toward **100M–400M, q4-class, short-context artifacts**, not larger dense models with fp16 KV caches. citeturn18search12turn18search2turn18search3turn43view1turn43view2

Because TinyRustLM’s visible product tasks are greetings, rewriting, summarization, code explanation, JSON generation, short multi-turn chat, and UAIX memory use, the student should optimize for **assistant utility under small-context, browser-budget conditions**. It should not be optimized for long hidden scratchpads, long-chain math, or speculative server augmentation. That product fit is also consistent with the intended deployment profile of modern compact model families such as SmolLM2, MobileLLM, and Llama 3.2 small-text models. citeturn41view0turn28view0turn31search1turn35view3

## Teacher and student blueprint

### Recommended teacher stack

The safest **primary teacher** for this ecosystem is **SmolLM2-1.7B-Instruct** or the corresponding SmolLM2 base/instruct family, because the family is openly documented, openly trained, and paired with released datasets and local-inference code. SmolLM2 was trained with a public data-centric recipe, includes open post-training assets such as SmolTalk, and the 360M model is already a natural TinyRustLM-facing deployment size. Using the same family as teacher and student reduces tokenizer mismatch, simplifies token-level KD, and produces a cleaner provenance story for public artifacts. citeturn28view0turn28view1turn28view2turn28view3

For a **secondary teacher**, I would use **Qwen2.5-3B-Instruct** as a sequence-level judge and response generator, not as the primary token-level teacher. Qwen2.5-3B-Instruct is strong in instruction following, JSON, structured output, and long-form generation, and its public model card explicitly calls out gains in structured data and JSON. That makes it a good source of **response candidates, preference pairs, and structured-output supervision**. However, it uses a different tokenizer, so it should sit primarily in the sequence-level and pairwise-preference path unless you are willing to implement cross-tokenizer logit distillation. citeturn35view1turn25search1turn25search18

A **shadow teacher lane** can evaluate **Gemma 3 1B IT** and **Llama 3.2 1B / 3B**. Gemma 3 1B has a smaller context than larger Gemma 3 sizes but is still a strong compact teacher candidate for summarization and QA. Llama 3.2 small-text models are explicitly optimized for **dialogue, retrieval, summarization, and rewriting**, use GQA, and Meta’s card says they already use distillation and post-training alignment rounds including SFT, rejection sampling, and DPO. These make them useful **comparators and shadow judges**, but for a public-development path I would avoid making them the canonical teacher unless legal review is comfortable with the downstream derivative story. citeturn35view0turn35view3turn37view0

### Recommended student line

I recommend a two-student public line and one optional control:

| Student | Role | Target params | Context target | Export target |
|---|---:|---:|---:|---:|
| **Assistant-S** | Fastest browser default | ~120M | 4K | q4-class |
| **Assistant-M** | Main production assistant | ~300M | 8K | q4-class |
| **Control-360** | Regression anchor | 360M | 8K | q4/q5 |

The architectural prior should be **decoder-only, RMSNorm, RoPE, SwiGLU, tied output embeddings, deep-and-thin, GQA**, following the direction validated in MobileLLM and widely adopted in compact modern assistants. MobileLLM’s central finding is directly relevant here: at sub-billion scale, architecture choices such as **deep-thin design, embedding sharing, and GQA** materially improve quality for on-device deployment. citeturn31search1turn31search15turn32search0

My recommended concrete shapes are:

- **Assistant-S**: 18 layers, `d_model=768`, `n_q_heads=12`, `n_kv_heads=2`, `head_dim=64`, `ffn=2048`, RoPE, RMSNorm, SwiGLU, tied output, factorized embeddings with `d_embed=256`, inherited tokenizer by default. This lands at roughly **122M parameters** before tiny norm/bias overheads.
- **Assistant-M**: 24 layers, `d_model=1024`, `n_q_heads=16`, `n_kv_heads=4`, `head_dim=64`, `ffn=3072`, RoPE, RMSNorm, SwiGLU, tied output, factorized embeddings with `d_embed=384`, inherited tokenizer by default. This lands at roughly **309M parameters**.

Those two shapes are deliberately chosen to keep the **KV cache** small enough for browser use. GQA matters because it reduces KV-cache growth during generation while staying much closer to standard multi-head quality than pure MQA; that tradeoff is exactly why GQA became the practical choice for compact inference-friendly decoders. citeturn32search0turn32search2turn35view3

### Why not make a 0.5B-class student the default

Qwen2.5-0.5B-Instruct is a solid public checkpoint, but a 0.5B dense student is materially more expensive to ship and keep interactive in the browser, especially once you add safety-preserving precision bumps, KV cache, and local-memory prefixes. TinyRustLM’s visible browser experience is far better served by a model that fits comfortably under **~100 MB** or **~220 MB** on disk depending on tier, rather than one that pressures download, initialization, and GPU memory budgets. Qwen’s own 0.5B card is useful as a quality reference, not as the ideal browser-default size. citeturn35view2turn43view1turn18search2

## Tokenizer, pruning, and distillation mechanics

### Tokenizer inheritance versus vocabulary reduction

For **v1 production**, inherit the **teacher-family tokenizer**. The reason is simple: same-tokenizer KD is still much easier, cleaner, and better understood than cross-tokenizer KD. Cross-tokenizer methods have improved rapidly in 2025–2026, but they remain extra engineering, extra validation burden, and extra provenance complexity. Since TinyRustLM already surfaces SmolLM2-based artifacts and local verification tooling, tokenizer inheritance is the default I would ship first. citeturn41view0turn28view0turn25search1turn25search18

For **v2 size minimization**, I would run a controlled vocabulary-reduction experiment only on the smallest student. Vocabulary trimming is a real compression lever because embeddings and LM heads are disproportionately expensive at this scale, and recent work shows vocabulary trimming or tokenizer adaptation can preserve much of the original performance when the target language/domain is narrow enough. However, the risk is obvious: if you prune too aggressively, tokenization fragments JSON keys, code symbols, filenames, version strings, and UAIX paths such as `.uai/system-profile.uai`. That failure mode is unacceptable for TinyRustLM’s ecosystem. citeturn23search10turn23search19turn23search8

My recommendation is:

- **Default path**: inherit the tokenizer unchanged.
- **Optional Assistant-S trim**: prune only to **32K–36K tokens**, but only after measuring degradation on JSON exactness, code tokens, dot-path tokens, file extensions, model names, semver strings, and UAIX path handling.
- **Never prune** tokens that occur in any of the following locked lexicons:
  - JSON punctuation and high-frequency schema keys
  - common code operators and delimiters
  - file extensions and CLI flags
  - `.uai/*` path fragments and UAIX type names
  - TinyRustLM / MiniModel surface strings like `.slm`, `sha256`, `manifest`, `checksum`

### Embedding factorization and vocabulary pruning

Use **factorized embeddings** on both students. ALBERT’s factorized embedding parameterization exists precisely to decouple vocabulary cost from hidden width, and that matters even more at 100M–400M where the embedding table can consume a large fraction of total parameters. The clean browser consequence is smaller artifacts and less pressure to flatten the network width. citeturn24search0turn24search11

The recommended settings are:

- Assistant-S: `d_embed=256`, projected to `d_model=768`
- Assistant-M: `d_embed=384`, projected to `d_model=1024`

If the tokenizer is pruned later, prune the embedding rows and tied LM-head rows together, store the original tokenizer checksum and a new tokenizer checksum in lineage metadata, and preserve a reversible mapping file so every trimmed token ID can be traced back to its parent vocabulary. That is not just good engineering; it matches TinyRustLM’s visible provenance expectations and MiniModel’s checksum-oriented cataloging style. citeturn41view0turn41view2

### Layer, head, channel, and FFN pruning

Use **structured pruning**, not unstructured sparsity, because the browser runtime needs predictable dense kernels and deterministic packing. Sheared LLaMA is the right precedent: prune to a target shape, then continue pretraining. Recent evidence also suggests that for small language models, quantization usually preserves fidelity better than pruning unless pruning is followed by retraining, so pruning should be modest and structured. citeturn14search0turn14search13turn14search7

My pruning order is:

1. **FFN channel pruning first**, because FFNs dominate parameter count and tolerate moderate compression well.
2. **Attention head regrouping next**, by reducing KV heads only if the cache budget demands it.
3. **Layer pruning last**, and only in upper layers if latency still misses target.
4. **Embedding pruning only after** tokenizer decision is finished.

Recommended pruning ceilings before recovery training:

- Assistant-S: at most **10% FFN width** and **0–1 top layers**
- Assistant-M: at most **15% FFN width**, **10–12% attention channels**, and **0–2 top layers**

If quality drops more than the stop/go thresholds below, back out layer pruning before backing out FFN pruning. In assistants of this size, depth is usually more valuable than another small amount of FFN width, which is consistent with the deep-thin MobileLLM findings. citeturn31search1turn31search4turn31search15

### Token-level and sequence-level distillation

This plan should combine **token-level KD** and **sequence-level distillation**, not choose one. DistilBERT showed the value of pretraining-time KD, TinyBERT showed the usefulness of multi-stage distillation and hidden-state transfer, MiniLM showed the value of attention-transfer, and MiniLLM showed that **on-policy distillation** matters for generative models because student trajectories differ from teacher-trajectories. citeturn15search0turn15search1turn15search13turn14search1turn13search0

The rule I recommend is:

- On **continued pretraining**: primarily token-level KD on mixed raw text.
- On **instruction tuning**: mixed next-token CE and sequence-level distillation with teacher completions.
- On **final alignment**: on-policy student sampling + teacher scoring + DPO or DPO-like preference optimization.

That yields a more stable small assistant than pure imitation SFT, especially for clarification, JSON, and short multi-turn turns where exposure bias matters. citeturn13search0turn20search0

### Forward KL, reverse KL, JS divergence, and temperature

For this use case:

- **Forward KL** `D_KL(p_teacher || p_student)` is the main distillation loss early because it is safer and more mode-covering.
- **Reverse KL** `D_KL(p_student || p_teacher)` should be introduced only later, and only on curated assistant-response spans, to reduce overly flat student distributions.
- **JS divergence** is a useful stabilizer in the middle phase when you want softer mutual shaping without letting reverse KL sharpen too early.
- **Temperature** should start higher and anneal downward.

I recommend:

- Early continued pretraining: `T = 2.5 -> 1.8`
- Mid/late pretraining: `T = 1.8 -> 1.4`
- SFT/post-training: `T = 1.6 -> 1.2`
- Never use high-temperature logits on unsafe/refusal spans; use `T <= 1.2` there so refusals stay crisp.

This follows the classic intuition behind KD and is also consistent with why MiniLLM and related generative KD methods emphasize preserving the teacher distribution on the relevant student trajectories instead of only copying one-best responses. citeturn15search0turn13search0

### Hidden-state and attention-map matching

Use **layer-mapped hidden-state cosine/MSE losses** and **attention-map relation losses** during continued pretraining and the first half of SFT. TinyBERT and MiniLM are the right precedents here. For students this small, hidden-state losses help prevent the assistant from collapsing into shallow imitation of surface outputs. citeturn15search1turn14search1

Recommended mappings:

- Assistant-S ← teacher layers `{2, 4, 6, …, 36}` sampled proportionally
- Assistant-M ← teacher layers `{2, 3, 5, 6, …}` proportionally across depth

Use projected hidden-state matching if hidden widths differ. Match:
- post-attention residual stream
- post-FFN residual stream
- masked attention probabilities
- value-relation matrices only on a small subset, because they are expensive

Turn these losses off in the final third of SFT and in DPO, where direct behavioral alignment matters more than representational mimicry. citeturn15search13turn14search1

### Reasoning-trace distillation without exposing hidden chain-of-thought

For this product, do **not** make long natural-language chain-of-thought a first-class public output behavior. TinyRustLM’s visible tasks are short assistant tasks, browser-local, often grounded in local memory or formatting. Distilling long explicit CoTs would increase latency, cost, and leakage risk while giving little benefit on the dominant task mix. citeturn41view0

The correct compromise is:

- Use **teacher rationales internally** for data curation and reward shaping.
- Train mainly on **answer-only** and **brief-explanation** outputs.
- Add a small auxiliary band of **latent or abstract reasoning supervision** only if it improves answer quality without surfacing hidden traces.

The most defensible public approach is to combine **Distilling Step-by-Step** ideas with **process supervision** and, optionally, a lightweight latent-reasoning experiment such as abstract-CoT or continuous-thought in a research lane, while keeping production outputs concise and non-scratchpad by default. citeturn21search0turn21search15turn22search0turn22search1

Concretely, for production v1:

- generate teacher rationales internally
- score them with a verifier or process reward signal
- keep only the final answer or a short public explanation in training targets
- never expose raw teacher scratchpads in the shipped chat template
- blacklist any latent-thought tokens from normal detokenization and generation if you experiment with them offline

That preserves the benefits of reasoning supervision without turning the shipped browser assistant into a visible CoT model. citeturn21search0turn22search0turn22search3

## Staged training recipe and exact losses

### Dataset plan

Use a **license-explicit, provenance-explicit** dataset stack with six buckets:

| Bucket | Purpose | Suggested public sources | Governance note |
|---|---|---|---|
| General web | fluency, summarization | FineWeb, FineWeb-Edu, DCLM-like public web | keep license ledger |
| Math/reasoning | compression of teacher competence | FineMath, selected synthetic reasoning | cap to avoid overfitting reasoning style |
| Code and config | code explanation, JSON, small tooling | Stack-Edu, permissive code, config snippets | retain file provenance |
| Instruction/dialogue | greetings, rewrite, clarify, short multi-turn | SmolTalk, UltraChat 200k, curated open SFT | heavy dedup required |
| Function calling / structured output | JSON reliability | Synth-APIGen and local schemas | schema-locked tests |
| Memory / persona / refusal | UAIX behavior | synthetic decks generated from public UAIX docs plus human-written cases | never train on private user memory |

FineWeb and FineWeb-Edu are both released under **ODC-By v1.0**, FineMath is also released under **ODC-By v1.0**, Stack-Edu is a **125B-token educational code** dataset derived from The Stack v2, The Stack v2 provides per-point provenance and requires respecting original source licenses, SmolTalk is a **1M-sample synthetic SFT dataset** used for SmolLM2-Instruct, UltraChat 200k is a filtered public dialogue dataset, and Synth-APIGen is available under **Apache-2.0** on the Hub. citeturn27search11turn27search3turn26search1turn26search2turn27search2turn27search6turn28view2turn26search6turn39search8

My recommended token budgets are:

| Stage | Assistant-S | Assistant-M | Notes |
|---|---:|---:|---|
| Continued pretraining + KD | 45B–60B | 70B–90B | from open corpus mix |
| SFT | 0.8B–1.2B | 1.0B–1.5B | mostly synthetic + curated dialogue |
| On-policy distillation + DPO | 0.2B–0.4B | 0.3B–0.6B | teacher-judged responses |
| QAT | 0.1B–0.25B | 0.15B–0.35B | calibration-rich, safety-heavy |

Those are intentionally smaller than full from-scratch budgets because this is a **distillation and productization** program, not a trillion-token base-model project.

### Deduplication, contamination control, and data freeze

Run **exact dedup** first, then **MinHash near-dup** dedup across all public corpora, then benchmark and eval-set blocking. FineWeb’s datasheet describes MinHash-style deduplication parameters, and recent contamination work shows that modern evaluations are increasingly vulnerable to both explicit and implicit contamination. The engineering consequence is simple: you need a documented dedup pipeline and an eval-blocking pipeline, not just best effort. citeturn36search5turn36search11turn36search3turn36search9

I recommend these controls:

- exact line and paragraph dedup
- document-level content hash ledger
- 5-gram MinHash LSH near-dup over the joined corpus
- repository-level dedup for code
- benchmark string blocking for all public dev/shadow evals
- date-based exclusion for post-cutoff sealed evals
- canary prompts seeded into private eval only
- contamination audit after every major data refresh

Also maintain a **hard exclusion set** for evaluation prompts and any teacher-generation prompts used for held-out shadow/sealed eval creation. Do not let those strings back into later synthetic augmentation rounds. citeturn36search3turn36search15

### Stage recipe

#### Corpus adaptation and structural compression

Start from the chosen student initialization. If using an existing base checkpoint, apply only modest structured pruning, then run a short recovery phase on general-web and code/config data before any instruction tuning.

Recommended optimizer and schedule:
- AdamW
- `betas=(0.9, 0.95)`
- `weight_decay=0.1`
- `lr=3e-4` for Assistant-S, `2.2e-4` for Assistant-M
- linear warmup over 2% of steps
- cosine decay to 10% of max LR
- gradient clip `1.0`
- sequence length curriculum `2048 -> 4096`

**Stop/go**: proceed only if post-recovery perplexity on held-out web and code slices is within **8%** of the unpruned baseline and JSON-key tokenization regressions are under **1%** relative. If not, reduce layer pruning first.  

#### Continued pretraining with mixed token-level KD

This is the core knowledge transfer stage. Use a mixed corpus with approximate proportions:

- 45% general web
- 15% educational web
- 15% code/config
- 10% math/reasoning
- 10% short instructions and dialogue
- 5% memory/persona/refusal templates

Global token batch:
- Assistant-S: ~2M tokens
- Assistant-M: ~4M tokens

Primary loss for this stage:

\[
L_{\text{cpt}} =
0.45L_{\text{CE}}
+0.30T^2 D_{KL}(p_t^T \,\|\, p_s^T)
+0.07L_{\text{JS}}
+0.08L_{\text{hid}}
+0.05L_{\text{attn}}
+0.03L_{\text{anchor}}
+0.02L_{\text{z}}
\]

where:

- `L_CE` is hard next-token loss on ground-truth text
- `D_KL(p_t || p_s)` is forward KL
- `L_JS` is Jensen-Shannon divergence between teacher and student softened distributions
- `L_hid` is projected hidden-state cosine/MSE loss
- `L_attn` is masked attention-map relation loss
- `L_anchor` is KL against the pre-stage student to reduce catastrophic forgetting
- `L_z` is a small logit stabilization term

Temperature schedule:
- first 30% steps: `T=2.5`
- middle 50%: cosine to `T=1.8`
- last 20%: cosine to `T=1.4`

At the end of the stage, replace half of `L_JS` with a small **answer-span reverse KL** on instruction-heavy minibatches:

\[
L_{\text{late}} =
0.50L_{\text{CE}}
+0.27T^2 D_{KL}(p_t^T \,\|\, p_s^T)
+0.03 D_{KL}(p_s \,\|\, p_t)
+0.07L_{\text{hid}}
+0.05L_{\text{attn}}
+0.06L_{\text{anchor}}
+0.02L_{\text{z}}
\]

That late reverse-KL injection helps the student stop sounding excessively flat on assistant outputs.  

**Stop/go**: continue only if held-out assistant dev improves on at least **5 of 7** target categories and refusal retention remains within **2 points** of pre-stage behavior.  

#### Instruction tuning and conversation formatting

Use one chat format, one system-header convention, and one memory-grounding convention throughout. Since TinyRustLM is a short-turn browser assistant with local memory options, the student should learn a single default pattern:

1. short system guidance
2. optional local-memory excerpt block
3. user turn
4. terse assistant answer by default
5. longer explanation only when asked

Train on:
- greetings and salutations
- rewrite/edit requests
- summarization
- code explanation
- JSON and schema filling
- clarification dialogues
- short multi-turn follow-ups
- memory-grounded question answering from `.uai/*` excerpts
- refusal / no-op / human-review examples for policy conflicts

Recommended SFT loss:

\[
L_{\text{SFT}} =
0.70L_{\text{CE,assist}}
+0.10L_{\text{CE,safety}}
+0.08T^2 D_{KL}(p_t^T \,\|\, p_s^T)
+0.04 D_{KL}(p_s \,\|\, p_t)_{\text{answer-only}}
+0.04L_{\text{hid}}
+0.02L_{\text{format}}
+0.02L_{\text{memory-ground}}
\]

`L_format` penalizes malformed JSON, broken delimiters, bad speaker tags, and invalid citation tags for memory-grounded answers. `L_memory-ground` is a span-level loss that rewards selecting the correct deck excerpt or correctly answering “not found / need clarification” when the needed file is absent.

Batching:
- median sequence length `1024`
- 10% of steps at `2048–4096` for summarization and memory decks
- global batch `256K–512K` tokens
- LR `5e-5`
- warmup `3%`
- cosine decay

**Stop/go**: proceed only if JSON exact-match, clarification helpfulness, and short dialogue win rate each beat the previous checkpoint by preset margins, and if UAIX memory-grounded hallucination rate is under **3%** on held-out deck tasks.  

#### On-policy sequence distillation and preference optimization

Now switch to **student-sampled trajectories**. This stage is where MiniLLM-style logic helps most: the student must learn to recover when it starts from its own imperfect prefixes. Generate 2–4 student completions per prompt, rescore with the primary teacher and a small rule-based validator set, then build preference pairs. citeturn13search0turn20search0

Recommended preference mixture:
- 35% human-written or curator-labeled pairs
- 45% teacher-judged student-vs-student pairs
- 20% rule-derived pairs for JSON validity, memory grounding, and refusal preservation

Use DPO with the SFT checkpoint as reference:

\[
L_{\text{align}} = 
0.70L_{\text{DPO}}(\beta=0.1)
+0.10L_{\text{CE,safety}}
+0.08L_{\text{JSON}}
+0.07L_{\text{memory-ground}}
+0.05L_{\text{anti-forget}}
\]

I would not use RLHF/PPO here. DPO is simpler, cheaper, and more stable for this small-model target. citeturn20search0turn20search2

**Stop/go**: continue only if answer preference win rate rises while refusal retention and JSON success do not regress. If stylistic quality improves but safety drops, cut preference intensity and increase safety replay.  

#### Quantization-aware training

Run QAT only after the best aligned bf16 checkpoint is frozen. Meta’s Llama 3.2 quantization notes are the most directly usable official precedent here: 4-bit groupwise linear weights with dynamic 8-bit activations, higher precision for embeddings and classification head, and an additional QAT/QLoRA-style post-training round. Combine that with outlier handling from SmoothQuant / SpinQuant ideas and keep the runtime simple by folding all transforms offline into the export graph. citeturn37view0turn16search2turn38search0

Suggested QAT objective:

\[
L_{\text{QAT}} =
0.55L_{\text{CE}}
+0.20T^2 D_{KL}(p_{bf16}^T \,\|\, p_{qat}^T)
+0.10L_{\text{DPO-distill}}
+0.08L_{\text{safety}}
+0.04L_{\text{JSON}}
+0.03L_{\text{memory-ground}}
\]

Use the **bf16 aligned checkpoint as teacher**, not the original large teacher. This makes the quantized student preserve the exact post-alignment behavior you actually want to ship.

Run QAT on a **calibration-rich replay mix**:
- 35% normal assistant requests
- 20% JSON/function-structured requests
- 15% code and config explanation
- 15% summarization
- 10% safety/refusal
- 5% UAIX memory/persona tasks

This composition matters because low-bit quantization can silently damage refusal and alignment behavior even when perplexity looks fine. Recent work on KV-cache quantization shows there is **no universal safe bit-width** and that safety features can be much more fragile than general perplexity suggests. That is exactly why safety cases have to be in the QAT and calibration mix. citeturn17academia15turn17search0

**Stop/go**: ship only if q4-class quality loses less than **3–5%** on core utility metrics, less than **1 point** on safety/refusal retention, and stays within browser latency targets.

### Catastrophic-forgetting controls

Use four controls across all post-training stages:

1. **Replay ring**: keep **10–15% general-language replay** in every stage after continued pretraining.
2. **Reference anchoring**: small KL anchor to the previous best checkpoint.
3. **Bottom-layer freeze** for the first 20–30% of SFT if the model starts losing fluency.
4. **Capability canaries**: fixed held-out sets for greetings, rewrite, summarize, explain code, JSON, clarify, and memory-grounding.

This is also where context distillation is helpful conceptually: it shows that models can internalize instructions and scratchpads, but that same mechanism means you can easily overwrite earlier competencies if you over-index on narrow chat data. citeturn22search3

## Quantization and .slm export design

### Mixed q4/q5/q6 precision allocation

A pure q4-everywhere export is not what I recommend. For this product, use a **q4-class mixed-precision layout**:

| Component | Precision |
|---|---:|
| Embeddings | q6 |
| LM head / output projection | q6 |
| First transformer block | q6 |
| Last transformer block | q6 |
| Attention `o_proj` and memory-critical layers | q5 |
| Middle attention `q/k/v` and FFN matrices | q4 |
| Norms, scales, zero-points | fp16 / fp32 metadata |
| Activations | int8 dynamic per-token |
| KV cache default | int4 |
| KV cache for prefix-critical spans | int8 for first 128–256 tokens |

Why this allocation:

- embeddings and LM head disproportionately affect lexical fidelity, JSON keys, and rare-but-important tokens
- first and last blocks are unusually sensitive to low-bit damage
- most middle FFN weights survive q4 well after QAT
- keeping the first 128–256 prefix tokens in higher-KV precision protects system instructions, safety prefixes, and local-memory headers

This follows the spirit of Meta’s published small-model quantization scheme, while adapting it to TinyRustLM’s assistant-heavy use case. citeturn37view0turn16search1turn16search2turn38search0

### Outlier-channel handling

Use an **offline outlier pipeline** before QAT:

1. collect activation statistics on the calibration corpus
2. apply SmoothQuant-style migration or a fused SpinQuant-style rotation
3. freeze the transformed graph shape
4. run QAT with the exact export granularity

AWQ, SmoothQuant, and SpinQuant all point to the same practical truth: low-bit failure is often dominated by a small number of salient weights or activation outliers. For a browser artifact, the runtime should not pay for fancy online transforms. Learn or compute them offline and fold them into exported weights and scales. citeturn16search1turn16search2turn38search0

### Activation and KV-cache quantization

Use:

- **W4A8** for most linear layers
- **int8 dynamic per-token activations**
- **int4 KV cache** by default
- **int8 KV prefix** for the system block and the first memory deck block

Avoid 2-bit KV in production v1. KIVI shows that very low-bit KV quantization can be surprisingly effective with careful asymmetric schemes, but the newer alignment-collapse work shows that low-bit KV can silently destroy refusal behavior in model-specific ways that perplexity will not catch. That makes 2-bit KV a poor default for a safety-preserving browser assistant. citeturn17search0turn17academia15

### Predicted byte sizes

Using the recommended mixed-precision packing, expected shipping sizes are:

| Artifact | Params | Expected average precision | Predicted `.slm` bytes |
|---|---:|---:|---:|
| Assistant-S q4-class | ~122M | ~4.4 bits/param | **74–88 MB** |
| Assistant-S q5-safe | ~122M | ~5.1 bits/param | **88–102 MB** |
| Assistant-M q4-class | ~309M | ~4.5 bits/param | **176–208 MB** |
| Assistant-M q5-safe | ~309M | ~5.2 bits/param | **208–246 MB** |
| Control-360 q4-class | 360M | ~4.5 bits/param | **205–240 MB** |

These numbers include low-bit weights, per-group scales/zero-points, tensor-layout metadata, tokenizer payload, and manifest/provenance overhead. They are deliberately conservative because browser imports pay for metadata and packing overhead that naïve `params × bits` math ignores.

### Quantization-aware `.slm` export design

The exported `.slm` should contain:

- weight sections packed by module and submodule
- explicit tensor layout version
- per-tensor and per-group quantization descriptors
- tokenizer payload and tokenizer checksum
- optional vocabulary-trim map
- runtime precision profile
- artifact sha256 and byte count
- model shape string
- config checksum
- calibration checksum
- eval checksum
- lineage section

The accompanying MiniModel manifest / catalog entry should expose at least:

- `artifact_kind`
- `artifact_byte_count`
- `artifact_sha256`
- `slm_model_shape`
- `slm_quantization`
- `slm_checksum`
- `slm_tokenizer_checksum`
- `slm_tensor_layout_checksum`
- `execution_policy`
- `quality_claim`
- `trained_quality_claim`
- `required_next_gate`

Those are directly aligned with the public MiniModel catalog fields and the provenance surfaces visible in TinyRustLM. citeturn41view2turn41view0

For TinyRustLM specifically, add one more requirement: export must support **fail-closed local inference**. If the required memory deck is absent, malformed, or exceeds the local budget, the assistant should answer with a bounded “cannot verify from current local memory” response, not a guessed answer. That is a model behavior target, not a UI band-aid.

## Evaluation, provenance, gates, and failure recovery

### Public-development, shadow, and sealed evaluation

Use three evaluation layers.

**Public-development** should be totally reproducible and used for trend tracking only. Include:
- rewrite/edit suites
- summarization suites
- code explanation from permissive snippets
- JSON exact-match tasks
- short multi-turn dialogue
- memory-grounded synthetic UAIX decks built only from public docs
- open safety/refusal sets

Because contamination risk is real, do not use these public scores as the only ship criterion. citeturn36search3turn36search12

**Shadow eval** should be private but continuously refreshed. Build it from:
- recent public docs after the training cutoff
- held-out TinyRustLM / MiniModel / UAIX examples written after corpus freeze
- new code/config snippets
- new JSON schemas
- newly-authored short assistant scenarios

This is where you catch product drift that public benchmarks miss.

**Sealed eval** should be the ship gate:
- human-authored prompts
- never shown to data curators or synthetic-data generators
- stored hashed
- prompt families rotated every release
- includes adversarial safety and quantization-specific refusal probes

### Required provenance and lineage records

Every released checkpoint and `.slm` artifact should carry a machine-readable lineage record with:

- parent checkpoint IDs and hashes
- teacher model IDs and exact revisions
- tokenizer origin and checksum
- dataset manifests, versions, licenses, and token counts
- dedup configuration and contamination filter version
- training schedule hash
- loss recipe hash
- QAT profile hash
- calibration corpus manifest and checksum
- evaluation suite versions and eval checksum
- export toolchain version
- artifact sha256 and byte count
- release decision record with sign-off

This is not overkill. TinyRustLM’s UI already exposes provenance categories such as source snapshot, source validation, admission, eval checksum, and next gate, and MiniModel’s catalog is already checksum-centric. The released model should plug into that ecosystem cleanly. citeturn41view0turn41view2

### Stage-by-stage stop/go criteria

| Stage | Go only if | No-go if |
|---|---|---|
| Corpus freeze | all sources licensed / logged, dedup complete, eval blocklist applied | missing license state, unresolved contamination, missing provenance |
| Structural compression | perplexity hit < 8%, no JSON/path-token collapse | large lexical damage, broken formatting behavior |
| Continued pretraining KD | gains on utility slices, refusal within 2 points | generic fluency or refusal regression |
| SFT | JSON exact-match, clarification win rate, memory-grounding accuracy all improve | generic model helpfulness collapses or memory hallucinations > 3% |
| Preference stage | preference win rate rises with stable safety | style improves but refusal weakens |
| QAT | q4-class loses < 3–5% utility and < 1 point refusal retention | hidden alignment loss, browser OOM, JSON reliability breaks |
| Export | verified checksums, reproducible local load, no server dependency | unresolved hash drift, unverifiable tokenizer, hidden remote path |

### Failure-recovery plan when compression hurts instruction quality

If the compressed student loses instruction quality, I would recover in this order:

First, determine whether the failure is **training-side** or **quantization-side**. Re-run the same validation suite on the bf16 aligned checkpoint and the q4-class checkpoint. If bf16 is healthy and q4 fails, do not touch the instruction data yet; fix the quantization profile first.

If the failure is quantization-side, use this sequence:
1. raise precision of embeddings and LM head to q6
2. raise first and last blocks to q6
3. move attention `o_proj` in the worst layers from q4 to q5
4. increase KV prefix precision from int4 to int8 for the first 256 tokens
5. re-run short QAT on the failure subset only
6. if refusal is the only thing collapsing, inject safety-heavy QAT replay before broadening precision further

If the failure is training-side:
1. restore the last good checkpoint before the regression stage
2. increase generic replay to 15–20%
3. cut sequence-level synthetic data weight by 20%
4. lower reverse-KL and preference intensity
5. re-enable hidden-state matching for another short SFT round
6. add 50K–200K high-quality human-edited assistant examples in the failed categories
7. if memory-grounding regressed, increase negative examples where the correct response is “not found / need the relevant `.uai` file”

If the failure traces back to tokenization or vocabulary trimming:
1. revert to inherited tokenizer
2. keep only embedding factorization
3. ship the larger artifact rather than a brittle smaller artifact

If the failure traces back to excessive pruning:
1. restore depth first
2. restore attention width second
3. restore FFN width last

That recovery sequence reflects what the literature and current practice both suggest: compact assistants usually fail first on **alignment-sensitive lexical behavior** and **format reliability**, not just on raw perplexity. Distillation and QAT recover those failures best when you isolate the source of degradation instead of blindly adding more chat data. citeturn14search0turn13search0turn37view0turn17academia15

## Final engineering recommendation

For **public development**, I would ship **Assistant-S ~122M q4-class** and **Assistant-M ~309M q4-class**, both trained with an inherited tokenizer, a SmolLM-family primary teacher, Qwen2.5-3B sequence-level shadow supervision, structured pruning only where needed, DPO-based final alignment, and a safety-aware QAT pass. That gives the best balance of TinyRustLM fit, MiniModel compatibility, browser practicality, and provenance cleanliness. citeturn41view0turn41view2turn28view0turn31search1turn35view1turn20search0

For **shadow experiments**, I would test:
- tokenizer trimming to 32K–36K on Assistant-S only
- cross-tokenizer on-policy KD only after the inherited-tokenizer path is stable
- latent-reasoning auxiliaries only in offline research lanes
- int4-vs-int8-prefix KV cache tradeoffs as a safety/perf knob

What I would not ship is equally important: no memorized eval prompts, no answer-template hacks, no browser post-processing that invents missing content, and no remote fallback disguised as local execution. The public TinyRustLM and MiniModel surfaces already make that engineering philosophy very clear, and this plan is intentionally aligned to it. citeturn41view0turn41view2