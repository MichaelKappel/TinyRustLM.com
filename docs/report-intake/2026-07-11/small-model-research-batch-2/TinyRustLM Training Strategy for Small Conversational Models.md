# TinyRustLM Training Strategy for Small Conversational Models

## Research context and executive decision

**UTC research date:** 2026-07-12. Before forming any recommendation, I reviewed the current public TinyRustLM product, the current MiniModel public site, and the current UAIX Cognitive Liberty Charter draft. TinyRustLM’s public site currently positions the product as a **browser-local Rust/WASM runtime** with no prompts sent to a server, local `.slm` import and verification, Hugging Face metadata search, optional UAIX memory deck support, optional web memory that is **off by default**, local-connect approvals that ask before app control, and a default demo list that includes quantized **SmolLM2 360M Instruct q4_0** and **SmolLM2 135M Instruct q8_0** variants. MiniModel’s public site presents itself as the public format, conversion, and verification layer that TinyRustLM uses for tiny verified artifacts. The current UAIX charter draft is dated **June 15, 2026** and explicitly frames lawful inquiry, adult agency, persona integrity, transparent boundaries, and resistance to hidden moral conditioning or covert rewrites as core governance principles. citeturn4time0turn37search0turn2view1turn29view0

The central conclusion is straightforward: **TinyRustLM should not begin with random-init training unless it has a clearly superior corpus, strong data engineering, and the budget to absorb failed iterations.** For a 0.5B–2B local model, the highest expected-return path is usually:

1. start from a **small, permissively licensed, already-overtrained base** such as SmolLM2,  
2. use **continued pretraining only when there is a real corpus mismatch**,  
3. then perform **high-quality behavioral post-training** centered on teacher distillation, narrow full SFT or strong adapters, and a conservative preference-optimization stage.  

That conclusion follows from three public observations. First, Chinchilla-style compute-optimal scaling gives a useful lower bound, but it is not the regime that many modern high-performing small models actually use. Second, current small open models such as SmolLM2 are trained on **far more** than Chinchilla-style token counts: the public model cards state **2T tokens for 135M**, **4T for 360M**, and **11T for 1.7B**. Third, inference-aware scaling work argues that when deployment demand matters, the optimum shifts toward **smaller models trained longer**, not larger models trained shorter. citeturn41search0turn24search0turn24search1turn11view0turn41search6

For TinyRustLM’s stated target behavior — strong conversational logic, common sense, practical unavailable-resource fallbacks, conflict handling, latest-user-intent precedence, resistance to stale or untrusted memory, prompt-injection resistance during harmless completion, and neutral handling of lawful adult inquiry — **behavioral post-training matters more than raw pretraining scale after a competent base exists**. SmolLM2’s own public materials describe a pipeline of pretraining followed by public/curated **SFT** and **DPO**; Qwen3’s public materials describe long chain-of-thought cold-start post-training and strong-to-weak distillation in the post-training stack; Toolformer and Gorilla-style work show that tool use and retrieval-grounded execution are best learned as explicit behaviors, not as accidental by-products of generic language modeling. citeturn11view1turn6search3turn20search0turn20search4

**Executive decision:**  
For TinyRustLM, the best implementation-ready plan is:

- **default path:** continue from an existing small open base and do **distillation-first post-training**,  
- **use continued pretraining sparingly:** only if your public corpus contains domain/style/interaction patterns the base plainly lacks,  
- **use from-scratch training only as a later-stage strategic program**, after the eval harness and post-training stack have already shown that the current best open base is the limiting factor rather than your corpus quality or post-training method. citeturn11view0turn11view1turn37search0turn29view0

## Why from-scratch training is usually the wrong first move

Chinchilla gives the standard dense-transformer training approximation **FLOPs ≈ 6ND**, where **N** is non-embedding-or-all-parameter scale depending on accounting convention and **D** is training tokens; the paper’s practical takeaway is that compute-optimal models should scale model size and token count together, roughly implying **about 20 tokens per parameter** as a classic baseline. But that is a **lower-bound scaling baseline**, not a guarantee of competitiveness for local, high-quality conversational assistants. Modern small-model practice often goes far beyond it because a small deployment model benefits disproportionately from more training data, cleaner curriculum, stronger post-training, and because inference-aware scaling can favor smaller-but-longer-trained models. citeturn41search0turn41search1turn41search6

SmolLM2 is the clearest public proof point in the size class most relevant to TinyRustLM. The public model cards state that the **135M**, **360M**, and **1.7B** variants were trained on **2T**, **4T**, and **11T** tokens respectively, all under **Apache-2.0**, with the 1.7B model trained on **256 H100 GPUs** using **Nanotron**. That is not remotely close to the Chinchilla lower bound. It is a data-centric, overtrained-small-model strategy. TinyRustLM should treat that as the public reference class for “competitive modern small model,” even if it does not attempt to match the absolute scale. citeturn24search1turn24search0turn11view0turn30search0

The table below uses my calculations from the Chinchilla FLOP approximation, an added **1.15× systems-overhead factor** for real training, **H100 SXM 80 GB** dense-BF16 assumptions based on NVIDIA’s published specs, and current public **Lambda** on-demand H100 pricing. I assume sustained training throughput of roughly **35% of dense peak** at the job level, which is conservative for a small-model dense stack with competent kernels and sharding but still requires solid systems work. Electricity uses the latest public U.S. industrial price series from EIA as a rough reference; cloud rental dominates it by a wide margin. These are **engineering estimates**, not vendor quotes. citeturn26search0turn38view1turn13search6turn41search0

| Model | Token tier | Tokens | Approx. train FLOPs | Equivalent GPU-hours on H100 SXM | Wall-clock on 32 H100 | Raw GPU rental |
|---|---:|---:|---:|---:|---:|---:|
| 0.6B | Chinchilla baseline | 12B | 0.05 ZFLOPs | ~40 h | ~0.05 d | ~$159 |
| 0.6B | Practical scratch | 300B | 1.24 ZFLOPs | ~997 h | ~1.30 d | ~$3,977 |
| 0.6B | Stretch scratch | 1.0T | 4.14 ZFLOPs | ~3,322 h | ~4.33 d | ~$13,256 |
| 1.0B | Chinchilla baseline | 20B | 0.14 ZFLOPs | ~111 h | ~0.14 d | ~$442 |
| 1.0B | Practical scratch | 500B | 3.45 ZFLOPs | ~2,769 h | ~3.60 d | ~$11,047 |
| 1.0B | Stretch scratch | 1.5T | 10.35 ZFLOPs | ~8,306 h | ~10.81 d | ~$33,140 |
| 1.5B | Chinchilla baseline | 30B | 0.31 ZFLOPs | ~249 h | ~0.32 d | ~$994 |
| 1.5B | Practical scratch | 800B | 8.28 ZFLOPs | ~6,645 h | ~8.65 d | ~$26,512 |
| 1.5B | Stretch scratch | 2.0T | 20.70 ZFLOPs | ~16,611 h | ~21.63 d | ~$66,279 |

Those numbers are the **possible** case. The more important question is what is **likely to outperform an existing base**. Public evidence strongly suggests that a 0.6B–1.5B model trained from scratch on only Chinchilla-scale data is **unlikely** to beat a strong existing small base that has already seen trillions of tokens plus post-training. Even a “practical scratch” run in the few-hundred-billion-token range is better interpreted as “possible to make useful” than “likely to exceed the best public base.” The public small-model evidence points in the opposite direction: strong small models are overtrained, carefully curated, and heavily post-trained. citeturn41search0turn24search0turn24search1turn11view0

Operationally, scratch training also carries costs that GPU-hour arithmetic hides. You still need tokenizer development, source licensing review, content acquisition, deduplication, contamination control, checkpoint storage, job resumption, post-training data synthesis, preference data construction, and repeated evaluation runs. A single **1.7B/11T-class** public reference run at Lambda’s listed H100 SXM rate corresponds to a **mid-six-figure raw compute bill** before failed runs, storage, bandwidth, or staff time. That is why TinyRustLM should treat scratch training as a long-horizon strategic investment, not as the first lever to pull. citeturn11view0turn38view1

A few formulas matter enough to make explicit:

- **Parameter-state memory for full-parameter AdamW training**  
  A realistic resume-state budget is roughly  
  **M ≈ P × (2 bytes BF16 weights + 4 bytes FP32 master + 8 bytes Adam moments)**  
  **≈ 14 bytes/parameter**, before misc. metadata and fragmentation.  
  That implies about **8.4 GB** for 0.6B, **14 GB** for 1.0B, and **21 GB** for 1.5B just for resumable model+optimizer state.

- **Activation memory**  
  A useful rule of thumb is  
  **M_act ≈ c × B × S × L × H × bytes**,  
  where **B** is microbatch, **S** sequence length, **L** layers, **H** hidden size, and **c** depends heavily on rematerialization and kernel choices. Without aggressive checkpointing, **c** can land around **12–16**; with selective checkpointing and FlashAttention, it can often be pushed down toward **2–4**. Current post-training frameworks explicitly expose these optimizations because they materially change fit and throughput. citeturn39view0turn39view1turn16search2

- **Checkpoint volume**  
  A model-only BF16 checkpoint is roughly **2 bytes/parameter**. A resumable checkpoint is roughly **14 bytes/parameter**. At 1.0B parameters, that is about **2 GB** model-only or **14 GB** resumable. At a 5k-step cadence, gross checkpoint output can easily reach multi-terabyte totals unless old checkpoints are rotated.

- **Network traffic**  
  For FSDP/ZeRO-style dense training, a practical estimate is that per-step communication is on the order of  
  **T_step ≈ κ × P × bytes**, with **κ ≈ 4–8** depending on sharding pattern, overlap, and whether you account for all-gather plus reduce-scatter. Across long runs, aggregate cluster traffic reaches the **tens to hundreds of petabytes**, which is why 200–400 Gb/s fabric and careful overlap matter even for “small” models. This is an engineering inference from FSDP/parallel-training mechanics, not a single-paper constant. citeturn16search2turn30search1turn30search12turn30search13

## Quantitative comparison of adaptation, distillation, and preference methods

For TinyRustLM’s goal profile, the right question is not “which method is newest,” but “which method gives the best behavioral gain per unit of risk in the 0.5B–2B regime.” Current official documentation and primary papers make that hierarchy fairly clear. LoRA remains the safest default adapter. QLoRA remains the default when VRAM is the bottleneck. DoRA is worth testing when LoRA underfits. IA3 is appealing when trainable-parameter budgets must be tiny. Full-parameter SFT is still the best way to move the whole model when you have enough clean data and want fewer adapter failure modes. DPO remains the most broadly supported preference objective; KTO is especially attractive when you only have binary desirable/undesirable labels; ORPO is operationally elegant because it removes the separate reference-model phase; SimPO is strong in paper results but is less uniformly represented in the current official framework docs I rechecked than DPO/KTO/ORPO. citeturn39view6turn17search0turn14search15turn39view7turn39view0turn39view3turn39view4turn39view5turn21search4

The most important operational comparison is in the table below. The directions are intentionally blunt because TinyRustLM needs a build plan, not a survey course.

| Method | Best use in TinyRustLM | Typical compute multiplier vs adapter baseline | Storage / memory profile | Main upside | Main risk |
|---|---|---:|---|---|---|
| From-scratch dense training | Only if base models are the bottleneck | 100×–1000× | Highest | Maximum control | Huge data/iteration risk |
| Continued pretraining | When base lacks domain/style/interaction priors | 10×–100× | High | Preserves base strengths while shifting priors | Can dull chat behavior if mis-mixed |
| Full-parameter SFT | When you have clean, broad human/teacher behavior data | 5×–20× | High | Strongest behavior move | Easier to catastrophically overfit small models |
| LoRA | Default PEFT choice | 1× | Low | Mature, cheap, easy to merge | Underfits broad behavior shifts |
| QLoRA | VRAM-constrained LoRA | 0.8×–1.4× wall-clock, far lower VRAM | Very low VRAM | Enables large-batch context on cheap GPUs | Some quality loss and slower kernels |
| DoRA | When LoRA underfits quality-sensitive tasks | 1.1×–1.5× | Low | Better expressivity at same inference form | More tuning friction |
| IA3 | Extremely low trainable budget | ~1× | Lowest | Very cheap, stable | Less expressive than LoRA-family |
| Sequence-level distillation | Cheap teacher imitation for style/behavior | 2×–10× | Very low storage | Simple, teacher-API-friendly | Bakes in teacher phrasing and refusal habits |
| Token-logit distillation | Best small-student knowledge transfer | 3×–15× | Moderate | Preserves teacher uncertainty structure | Requires online teacher or large top-k cache |
| Hidden/attention distillation | When representation transfer is essential | 5×–20× | High to extreme | Helps compression if done selectively | Layer mapping and storage blow up |
| DPO / KTO / ORPO / SimPO | Final preference shaping | 1.2×–4× | Moderate | Improves style tradeoffs after SFT | Can amplify over-refusal or verbosity |

**Continued pretraining of a permissively licensed checkpoint** is the best middle ground when the base is strong but stylistically wrong. SmolLM2 is unusually relevant here because it is both explicitly on-device-oriented and explicitly Apache-2.0. My recommendation is to treat continued pretraining as a **narrow instrument**: use it to teach the student your desired interaction prior, source-ranking behavior, and tool-trace format, but do not expect it by itself to solve conversational fallbacks or refusal behavior. Those are post-training problems. citeturn11view0turn11view1

**LoRA / QLoRA / DoRA / IA3 / layer-restricted adapters / composition** should be handled with a sharp default order:

- **LoRA** first, because current PEFT support is mature and parameter overhead is tiny relative to the base. Hugging Face’s LoRA docs still describe it as a low-rank injection that drastically reduces trainable parameters, and the original method showed meaningful adaptation with tiny trainable fractions. citeturn39view6
- **QLoRA** second, when VRAM is the practical bottleneck. The original QLoRA paper remains the core reference, and current torchtune and BitsAndBytes ecosystems still center it as the standard answer for memory-bounded fine-tuning. citeturn17search0turn30search2turn16search0
- **DoRA** third, when behavior quality is not moving enough under standard LoRA. NVIDIA’s DoRA explanation summarizes the key point: decompose weight magnitude and direction to improve learning capacity without extra inference cost. citeturn14search15
- **IA3** only when you need the absolute smallest adaptation surface or want a very conservative modification to the base. Current PEFT docs describe it as learned activation rescaling vectors rather than matrix updates. citeturn39view7
- **Layer-restricted adapters** are often underrated for tiny models. If the target behavior is mainly conversational framing, conflict resolution, latest-user-intent precedence, and stable fallbacks, limiting adapters to upper layers can reduce destructive rewrites of the base’s general linguistic competence. That is an engineering recommendation, not a formal theorem.
- **Adapter composition** is useful for inference-time specialization — for example, “helpful chat,” “strict JSON,” and “tool-first calculator routing” — but current PEFT docs make clear that mixed-adapter compatibility is constrained and should not be treated as universal. citeturn40search0

For a 1B–1.7B decoder where adapters target the usual attention and MLP projections across all layers, a practical trainable-parameter range is typically in the **single-digit to low-tens of millions** at **rank 16–32**, which is usually around **well under 2%** of base parameters. That is why LoRA-class adapters are attractive — but only if the target behavior change is not too global.

**Sequence-level teacher distillation** is ideal when you want the student to imitate high-level conversational conduct, tool-call placement, refusal alternatives, tone, and stopping behavior. It is cheap to store because you only keep prompts and teacher outputs. But it is also the most likely path to importing the teacher’s bad habits — especially generic capability disclaimers, overlong preambles, and over-refusal. If TinyRustLM uses sequence-level distillation, the teacher must itself be screened for the target policy shape. Generalized token-on-student-sequences distillation is better than naïve fixed-sequence imitation because it reduces train–test distribution mismatch. citeturn42search1turn42search3

**Token-logit or distribution distillation** is usually the most valuable distillation signal for tiny students. It transfers “dark knowledge” — what the teacher nearly believed, not just what it emitted. Operationally, the right compromise is usually **temperature 1.5–2.5** with **top-k storage** rather than full-vocabulary storage. A simple storage estimate helps: if you store **k = 64** logits per token using **fp16 logits + uint32 token ids**, you spend roughly **384 bytes/token** including some metadata padding; at **100M assistant tokens**, that is on the order of **tens of gigabytes**, which is operationally easy. By contrast, storing multiple full hidden-state layers reaches **terabyte-scale** quickly. The operational implication is simple: for TinyRustLM, prefer **logit distillation first**, and use hidden-state distillation only selectively or online. The usefulness of distributional KD is the core point of standard KD, while GKD extends it cleanly to autoregressive students. citeturn42search3turn17search0

**Hidden-state, attention-map, or intermediate-feature distillation** is worth using only when the student is meaningfully smaller than the teacher and you have reason to believe generation-only KD is not enough. TinyBERT and MiniLM remain the canonical references that attention and hidden-state alignment can help compact Transformer students, with attention often contributing strongly. But the storage and complexity cost is real, especially for long-context chat distillation. For TinyRustLM, I would only use intermediate-feature KD on a **thin layer subset** — for example, every fourth layer or just one mid-layer plus the final layer — and only during the first half of training. citeturn42search14turn42search6

**Preference optimization** should be conservative. TinyRustLM does not need frontier reasoning theatrics; it needs reliable conversational choices. My ranking is:

- **DPO** as the baseline when you already have chosen/rejected pairs and want the best-supported implementation path. citeturn21search0turn39view3
- **KTO** when your labeling pipeline yields binary good/bad outcomes more naturally than paired rankings. Its current official trainer docs explicitly note this advantage. citeturn21search3turn39view4
- **ORPO** when you want a single reference-free stage that fuses NLL and preference pressure. It is appealing for small-model efficiency. citeturn21search2turn39view5
- **IPO** and **SimPO** as ablations, not default production choices for TinyRustLM. IPO is useful if DPO appears to overfit pairwise preferences; SimPO has strong paper results, but the current support surface I rechecked remains more obviously mature for DPO/KTO/ORPO/IPO than for SimPO in the mainstream official docs. citeturn22search14turn21search4turn39view0

**Quantization-aware fine-tuning and post-quantization recovery** are worth real investment because TinyRustLM is explicitly shipping local quantized artifacts and browser-local execution. QLoRA is the entry point. For stronger artifact quality, current TorchAO documentation shows active **QAT integrations** with Axolotl and torchtune, and explicitly reports a **QAT + LoRA** recipe that in early experiments is **1.89× faster** and uses **36.1% memory** compared with vanilla QAT. LoftQ and related methods are the right “recovery” layer when a quantized backbone loses too much fidelity before adaptation. For TinyRustLM’s browser-local path, this is an unusually high-leverage area because regressions often appear only after quantization and only in the Wasm/GPU runtime. citeturn17search0turn17search1turn39view2turn37search0

**Curriculum routing and tool-use training** should be explicit and narrow. Toolformer’s central lesson remains sound: teach the model **when** to call a calculator, search, or other deterministic helper, rather than flooding the base corpus with arithmetic drills. Gorilla and APIBench add the operational lesson that execution-grounded tool use generalizes better when retrieval and validation are part of the training/eval story. For TinyRustLM, that means calculator-routing examples should be a **small but explicit** slice of post-training — enough to make delegation reliable, but not so large that calculator syntax crowds out ordinary conversation. citeturn20search0turn20search4

## Corpus program for conversational logic, fallback behavior, and non-refusal

TinyRustLM needs **two different corpus programs**, not one:

- a **base-text program** for continued pretraining, if used;  
- a **behavioral post-training program** for SFT, distillation, preferences, and tool traces.

That distinction matters. Continued pretraining changes priors and latent world knowledge. Post-training changes conduct. If you mix those goals carelessly, you risk an assistant that sounds “aligned” in the vague sense but is actually worse at practical help, more repetitive, and more disclaimer-prone. SmolLM2’s public training materials and Qwen3’s public post-training description both reflect multi-stage stacks rather than one monolithic finetune. citeturn11view0turn11view1turn6search3

### Base-text corpus program

For base-text data, the strongest public open sources with reasonably usable licensing signals are:

- **FineWeb / FineWeb-Edu**, released under **ODC-By v1.0** and derived from Common Crawl, good for broad English web text. citeturn34search1turn34search19
- **Dolma**, also publicly available and moved to **ODC-BY**, useful as a reproducible large-scale open text mixture. citeturn34search6turn34search12
- **Wikipedia / Wikimedia text**, with **CC BY-SA 4.0 / GFDL** licensing context. citeturn34search8turn34search17
- **The Stack / The Stack v2** for permissively licensed or provenance-tracked code, with per-item provenance and original-license obligations. citeturn33search1turn33search5turn33search13

My recommendation for TinyRustLM’s **continued-pretraining** corpus scale is:

| Scale | Documents | Tokens | Purpose |
|---|---:|---:|---|
| Minimum | 20M–40M | 10B–20B | Light domain/style correction only |
| Recommended | 80M–200M | 30B–60B | Real continued pretraining |
| Ambitious | 300M–700M | 100B–300B | Strong corpus-prior shift without scratch |

For a local conversational assistant, the base-text mixture should remain broadly distributed. A practical recommended ratio is:

| Base-text family | Recommended token share |
|---|---:|
| General high-quality web / encyclopedia | 45% |
| Educational / explanatory prose | 20% |
| Documentation / manuals / API text | 10% |
| Code + code comments + issue discussions | 10% |
| Dialogue / forum / Q&A with polite cleanup | 10% |
| Small targeted conflict/memory/tool traces in plain text | 5% |

That ratio intentionally keeps code and synthetic traces from taking over the model. TinyRustLM is a conversational local assistant, not a code-only or synthetic-only student.

### Behavioral post-training corpus program

The behavioral corpus is where TinyRustLM wins or loses. This is where you teach:

- positive open conversation,  
- honest uncertainty without evasiveness,  
- unavailable-resource fallbacks,  
- conflict handling across sources,  
- latest-user-intent precedence,  
- memory distrust when memory is stale or lower priority,  
- prompt-injection resistance while still doing the harmless task,  
- neutral lawful adult inquiry,  
- narrow, concrete harm boundaries with nearby lawful assistance,  
- anti-repetition and bounded stopping.

The public sources most worth reusing are:

- **SmolTalk / SmolTalk2**, because Hugging Face explicitly states the new datasets added there are **Apache 2.0** and because the public description already includes rewrite, summarize, and function-calling behavior. citeturn32search0turn32search3
- **UltraFeedback**, which remains a major public preference source and is published under **MIT** in its repository. citeturn32search4turn32search10
- **Synth-APIGen / APIGen-derived function-calling traces**, for verifiable tool schemas and tool-call formatting. citeturn32search2turn32search11
- **Self-generated synthetic data** using an open teacher and a reproducible generation pipeline, because that is the only realistic way to create enough targeted “latest-user-correction overrides stale memory” and “retrieved prompt injection but harmless completion continues” examples. Argilla’s synthetic-data generator and distilabel stack are good public starting points for this. citeturn32search17

My recommended **behavioral** record targets are:

| Scale | Records | Assistant tokens | Preference pairs |
|---|---:|---:|---:|
| Minimum | 300k–700k | 80M–150M | 30k–60k |
| Recommended | 1.5M–4M | 300M–700M | 120k–300k |
| Ambitious | 6M–12M | 1B–2B | 500k–1M |

For TinyRustLM’s target behavior, I recommend the following **exact task-family ratio** for **recommended-scale behavioral training tokens**:

| Behavioral family | Token share |
|---|---:|
| Positive open conversation and greetings | 16% |
| Factual explanation with honest uncertainty | 12% |
| Summarization, extraction, rewriting, strict formats | 14% |
| Code explanation and low-risk code transformation | 8% |
| Practical judgment with unavailable-resource fallbacks | 12% |
| Underspecified choices requiring options and priorities | 10% |
| Conflicting manager/customer/document/status/memory sources | 10% |
| Latest user correction overriding stale memory | 6% |
| Retrieved-content prompt injection resistance while completing harmless tasks | 5% |
| Neutral lawful adult-policy inquiry | 4% |
| Narrow concrete-harm boundaries with nearby lawful help | 2% |
| Anti-repetition, clean stopping, bounded output | 1% |

This ratio is intentionally **positive-first**. The narrow-harm boundary bucket is tiny on purpose. Over-refusal is not an abstract risk; it is now a directly studied and benchmarked failure mode, and refusal behavior itself appears surprisingly low-dimensional in mechanistic work. That means a small model can learn blanket refusal style too easily if you over-rehearse it. citeturn28search0turn28search8turn28search12

### Refusal budget and positive-rehearsal ratio

My recommendation is to keep **pure refusal-only records** under **1% of behavioral SFT tokens** and under **2–3% of preference pairs**. If you count all “boundary behavior” records including nearby lawful help, reformulation, or neutral alternatives, keep the total under **4–5%**. At the same time, maintain at least a **20:1 ratio**, and preferably a **30:1 ratio**, of **lawful-helpful-positive rehearsal** to **refusal-shaped examples**. This is a design recommendation, not a published universal constant, but it is a very plausible one given the public over-refusal results and the finding that safety refusal appears mediated by a highly concentrated direction in representation space. citeturn28search0turn28search8turn28search12

A practical implication follows: do **not** train many examples whose answer template begins with phrases like “I cannot help,” “I’m unable to assist,” “I can’t provide that,” or moralizing preambles unless the exact boundary is necessary. Those templates tend to leak because they are short, highly reusable, and become high-probability continuations across unrelated prompts. That leakage claim is an inference from the public refusal-mechanism literature and from standard next-token learning dynamics, not a directly published percentage. citeturn28search8turn28search12

### Deduplication, contamination, and split design

TinyRustLM’s no-cheat requirements are correct and should be hardened further. The split design should be defined **before any training data synthesis**:

- **Public dev split**: published prompts and rubrics.  
- **Seeded paraphrase split**: deterministic paraphrases created from a disclosed seed and frozen before training.  
- **Sealed holdout**: prompts, paraphrases, and rubrics withheld; publish only hashes and audit metadata until the model is frozen.

For contamination control, do three things:

1. **Reject exact document matches.**
2. **Reject normalized five-gram overlap** against all eval prompts, answer keys, and expected-answer branches.  
3. **Reject semantic near-duplicates**, because n-gram filtering alone is not enough. Public contamination work now explicitly shows that soft contamination and semantic duplicates can bypass simple string filters. OLMo-style decontamination work and broader contamination audits both support treating semantic similarity as a first-class problem, not a cleanup afterthought. citeturn18search13turn18search14turn18search10

I recommend the following normalization for five-gram filters:

- lowercase,  
- NFKC Unicode normalization,  
- collapse whitespace,  
- normalize quotes/dashes,  
- strip punctuation except code delimiters in code tasks,  
- canonicalize JSON field ordering when gold outputs are structured,  
- then compute exact five-gram sets on both prompt and answer text.

That still is **not sufficient quality evaluation**. It is only a contamination gate.

### Linguistic audits for disclaimer leakage and fake capability talk

TinyRustLM should run automated audits after every post-training stage. String checks are not enough, but they are still useful alarms. The audit suite should score at least:

- harmful over-refusal on a harmless control set,  
- frequency of phrases like “I cannot help,” “I’m unable to,” or “I can’t provide that” on benign prompts,  
- moralizing preambles on benign prompts,  
- fabricated tool-access claims,  
- impossible fallback claims,  
- repeated n-gram loops,  
- stop-control failures,  
- output-length overflow.

Those audits must be evaluated on **benign prompts**, **ambiguous prompts**, and **boundary-adjacent lawful prompts**. OR-Bench is relevant because it gives a large public over-refusal framing, while TinyRustLM’s current product context makes fabricated capability language especially important: the UI explicitly exposes local files, memory decks, web memory, and local-connect approvals, so the model must not hallucinate cloud abilities or deny capabilities it actually has in a given runtime. citeturn28search0turn37search0

A small but critical curriculum choice: **calculator routing examples should be explicit but sparse**. Keep calculator/tool traces to roughly **1–3% of behavioral tokens**, and keep free-form arithmetic drill data below **0.5–1%** unless arithmetic is a core product task. Toolformer is the right precedent here: teach the model to decide when to use the tool, not to bloat the language-model curriculum with rote arithmetic. citeturn20search0

## Implementation-ready recipes and compute plans

### Conservative adapter recipe

**Use this when:** you want the fastest path to a better local assistant without destabilizing the base.

**Base assumption:** SmolLM2-1.7B or SmolLM2-360M, starting from a public Apache-2.0 checkpoint. SmolLM2 already has public evidence of rewrite/summarize/function-calling post-training plus DPO, so it is a reasonable local-first starting point. citeturn11view0turn11view1

**Configuration**

| Setting | Recommendation |
|---|---|
| Sequence length | 4096 |
| Packing | On, multipack by length |
| Loss mask | Assistant-only for conversational SFT |
| Adapter type | LoRA first; DoRA A/B run if LoRA underfits |
| Rank | 16 on 360M, 16–32 on 1.7B |
| Alpha | 32 for r16, 64 for r32 |
| Target modules | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| Dropout | 0.05 |
| Optimizer | `paged_adamw_8bit` or AdamW8bit |
| Learning rate | 2e-4 for 360M, 1e-4 to 1.5e-4 for 1.7B |
| Betas | (0.9, 0.95) |
| Weight decay | 0.01 |
| Warmup | 3% of steps |
| Scheduler | Cosine decay |
| Global batch | 128k–512k tokens |
| Epochs | 1.5–2.5 over recommended behavioral corpus |
| Checkpoint cadence | every 500–1000 optimizer steps |
| Precision | bf16 compute, 4-bit base only if QLoRA fallback is needed |
| Gradient clipping | 1.0 |
| Rehearsal mix | keep 15–25% broad benign conversation in every epoch |
| Early stopping | on sealed holdout + ordinary-conversation regression |

**Budget:**  
A 360M adapter run can be done on a single **L40S** or **A100** cheaply at current public prices; a 1.7B LoRA run fits comfortably on a single **A100 80 GB** and is still inexpensive. Runpod’s current public pricing lists **L40S at $0.99/hr**, **A100 PCIe 80 GB at $1.39/hr**, and **A100 SXM 80 GB at $1.49/hr**. For a 10–20 hour run, the raw GPU cost is still in the **tens of dollars**, not thousands. citeturn38view0

**What this recipe can and cannot do:**  
It is excellent for teaching better format control, fallback behavior, latest-user-correction precedence, and anti-disclaimer phrasing. It is **not** the right first choice if you need a deep shift in latent world knowledge or domain priors.

### Full SFT or continued-pretraining recipe

**Use this when:** adapter probes help, but the base still misses the underlying interaction prior or domain language.

**Stage A: continued pretraining**

| Setting | Recommendation |
|---|---|
| Base | SmolLM2-1.7B base |
| Tokens | 30B recommended, 60B if corpus quality is excellent |
| Sequence length | 4096 or 8192 if infrastructure is ready |
| Packing | On |
| Objective | standard causal LM |
| Optimizer | AdamW |
| Learning rate | peak 8e-5 to 1e-4 |
| Warmup | 1k–2k steps |
| Scheduler | cosine to 10% of peak |
| Global batch | 0.5M–2M tokens |
| Precision | bf16 |
| Gradient clipping | 1.0 |
| Regularization | keep dropout at base defaults; no aggressive extra regularization |
| Checkpoint cadence | every 2k–5k steps |
| Resume policy | mandatory resumable optimizer states + rotating last-5 |
| Eval cadence | every 1–2B tokens on held-out general + behavioral dev |

**Stage B: full-parameter SFT**

| Setting | Recommendation |
|---|---|
| Sequence length | 4096 |
| Packing | On with conversation boundaries respected |
| Loss mask | Assistant-only |
| Optimizer | AdamW |
| Learning rate | 5e-6 to 1.5e-5 |
| Warmup | 2–3% |
| Scheduler | cosine |
| Global batch | 128k–512k assistant tokens |
| Epochs | 1–2 |
| Rehearsal | keep 20% broad positive everyday chat |
| Early stopping | strict, because small full-SFT can overshoot quickly |

**Budget:**  
Using current public H100 pricing, the current on-demand rate is roughly **$2.99/hr on Runpod H100 SXM** or **$3.99/hr on Lambda H100 SXM**. A focused 30B–60B-token CPT run on 8 H100s plus a brief full SFT stage is still far cheaper than scratch training and is the right “serious but not reckless” move once adapters stop helping. citeturn38view0turn38view1

**Why this is not the default:**  
Because continued pretraining can mildly “de-instruct” the model if the data mix is wrong. Always follow it with shallow behavioral SFT and do not let the CPT mixture become too code-heavy or too raw-web-heavy.

### Distillation plus preference-optimization recipe

**Use this when:** you want the strongest behavioral gain per dollar for a small local student.

**Teacher assumption:** a stronger open teacher, ideally one whose outputs you can legally and operationally reuse without ambiguity. Because outputs and tool traces are part of the asset, the cleanest path is usually an open teacher, not a hidden API dependency. Qwen3’s public technical material is directly relevant here because it publicly discusses strong-to-weak distillation in post-training. citeturn6search3

**Stage A: prompt pool**

Create a prompt pool with at least:

- 25% natural open-ended benign conversation,
- 20% explanation/uncertainty,
- 15% format/JSON/extraction/rewrite,
- 10% code explanation,
- 15% conflict/memory/source ranking,
- 5% prompt injection resistance,
- 5% lawful adult inquiry,
- 5% narrow harm boundaries.

Generate prompts from public seed templates plus seeded paraphrase generators. Freeze the pool before distillation.

**Stage B: distribution distillation**

| Setting | Recommendation |
|---|---|
| Student | 0.6B or 1.7B |
| Sequence length | 4096 |
| Storage | top-k logits, `k = 32` to `64`, temperature `T = 2.0` |
| Loss | `0.55 * KL_soft + 0.35 * CE_hard + 0.10 * sequence-level imitation` |
| Hidden-state KD | optional 5–10% loss on 2–4 selected layers only |
| Optimizer | AdamW |
| Learning rate | 5e-5 full-parameter on pretrained student |
| Warmup | 2% |
| Scheduler | cosine |
| Batch | 128k–512k student tokens |
| Checkpoint cadence | every 1k steps |
| Rehearsal | 20% plain broad chat not sourced from the teacher’s hardest prompts |

For **100M assistant tokens**, a **top-64** cache is operationally comfortable, while full hidden-state caches are not. This is why I prefer offline top-k logit caches plus online sequence regeneration on a small hard subset rather than all-online co-training.

**Stage C: preference optimization**

Start with **DPO**. If the labeling pipeline is binary rather than pairwise, use **KTO** instead. If GPU memory is very constrained and you want fewer moving parts, ORPO is the next-best single-stage candidate. citeturn21search0turn39view4turn39view5

A good DPO configuration for this size range:

| Setting | Recommendation |
|---|---|
| Loss | DPO |
| Beta | 0.05–0.15 |
| LR | 5e-6 to 1e-5 |
| Reference model | frozen pre-DPO student |
| Preference pairs | 120k–300k clean chosen/rejected pairs |
| Epochs | 1 |
| Assistant masking | yes |
| Length control | mandatory in eval, not optional |
| Early stop trigger | any rise in harmless over-refusal or verbosity |

**Budget:**  
The teacher generation bill dominates if the teacher is remote; the student fine-tune bill dominates if the teacher is local and open. Either way, this path usually beats scratch training on return-on-compute for TinyRustLM’s target scope.

### Detecting no-op versus destructive adapters before conversion

Before merging or converting any adapter, TinyRustLM should require five checks:

1. **Weight-delta sanity:** merged weights must differ measurably from the base.  
2. **Logit-delta sanity:** on a fixed canary prompt set, adapter-on vs adapter-off must shift logits by more than numerical noise.  
3. **Behavior win test:** adapter-on must improve at least one targeted metric without regressing ordinary chat.  
4. **Quantized-merge test:** after merge/quantization, the artifact must preserve most of the gain.  
5. **Browser-runtime test:** the merged artifact must still behave acceptably in TinyRustLM’s browser-local runtime, not just in Python/native inference. citeturn37search0

A **no-op adapter** usually shows tiny delta norms, near-zero logit shift, and no consistent behavioral gain. A **destructive adapter** usually shows large delta norms, some apparent targeted wins, but broad regression on ordinary conversation, increased disclaimers, or quantization collapse after merge. Treat those as different failure classes.

## Evaluation design, rollback rules, milestones, and the decision tree

TinyRustLM’s own constraints imply a stricter eval harness than generic open-model tinkering. The public product is browser-local, quantized, and optionally memory-augmented. Therefore every candidate must be tested in **five forms**:

1. **unadapted source**,  
2. **adapted source**,  
3. **quantized artifact**,  
4. **native runtime**,  
5. **browser runtime**.  

That requirement comes directly from the public product surface, not just from model-training orthodoxy. citeturn37search0

### Core evaluation matrix

I recommend six benchmark families, all private except the public dev splits:

| Family | What it tests | Failure sign |
|---|---|---|
| Ordinary conversation | helpfulness, tone, non-repetition | generic disclaimers, verbosity, loops |
| Conflict handling | source ranking, stale-memory distrust, latest user precedence | obeys stale memory or lower-priority docs |
| Practical fallback | unavailable-resource handling | fake tool use, fake browsing, dead-end refusals |
| Injection resistance | retrieved prompt attacks with harmless task completion | obeys attacker text or refuses harmless task |
| Lawful adult inquiry | neutrality without lectures | over-refusal, moralizing, evasiveness |
| Narrow harm boundaries | concrete risky prompts plus nearby lawful help | either unsafe leakage or blanket refusal |

Use pairwise judging for many of these, but do **not** rely only on LLM-as-judge. Include exact-format checks, bounded-output checks, repetition penalties, and human review on a rotating sample.

### Rollback rules

Rollback immediately if any of the following hold relative to the current champion:

- harmless over-refusal rises by **>2 percentage points**,  
- ordinary-conversation pairwise win rate drops by **>1.5 points**,  
- browser-runtime artifact loses **>3 points** on key behavioral groups relative to native,  
- fabricated capability claims exceed **0.5%** of benign prompts,  
- prompt-injection resistance improves but ordinary conversation regresses,  
- output-length control worsens materially.

That last rule matters. Small models often “improve” targeted safety behavior by becoming shorter, more evasive, and less useful overall.

### Phased milestones

**Phase one** should be pure evaluation-harness work: lock the public/seeded/sealed splits, implement five-gram and semantic contamination gates, build browser/native comparison, and define the harmless over-refusal suite. Do **not** skip this and go straight to training. citeturn18search10turn18search14turn37search0

**Phase two** should be the conservative adapter baseline. If LoRA on a good public base cannot noticeably improve TinyRustLM’s target behaviors without regression, that is evidence that your **corpus or evals** are the problem, not that you need scratch training.

**Phase three** should be distillation-first post-training. This is the most likely place to get real improvements in fallback conduct, conflict handling, neutral lawful adult inquiry, and prompt-injection resistance.

**Phase four** should be narrowly scoped continued pretraining only if Phase three reveals clear base-prior limitations.

**Phase five** should be scratch training only if all earlier phases converge to the same conclusion: the best available public base is the limiting factor, your corpus program is already demonstrably strong, and the expected advantage is strategic rather than cosmetic.

### Decision tree

Use this decision tree literally:

| Condition | Action |
|---|---|
| Public base already passes general chat, but misses product-specific conduct | **Stay on existing base + adapter/SFT** |
| Base sounds wrong in domain/style/source ranking, but adapters partly help | **Do continued pretraining + light full SFT** |
| Base has decent knowledge, but small student needs better behavior at local size | **Do teacher distillation + preference optimization** |
| Quantized/browser artifact is the main regression point | **Do QAT / post-quant recovery, not new pretraining** |
| Multiple strong public bases all fail the same target behaviors, and your corpus/evals are proven | **Consider scratch training** |
| You cannot yet prove contamination control, regression coverage, and runtime honesty | **Do not train from scratch yet** |

## Machine-readable assumptions and budget appendix

```json
{
  "research_date_utc": "2026-07-12",
  "public_context_reviewed": {
    "tinyrustlm": true,
    "minimodel": true,
    "uaix_cognitive_liberty_charter": true
  },
  "default_recommendation": "distillation_first_on_existing_small_open_base",
  "preferred_base_family": "SmolLM2",
  "scratch_training_assumptions": {
    "flops_formula": "6 * N * D * 1.15",
    "gpu_type": "NVIDIA H100 SXM 80GB",
    "effective_dense_bf16_tflops_per_gpu": 346,
    "cloud_price_usd_per_gpu_hour": 3.99,
    "site_power_kw_per_gpu": 1.0,
    "electricity_usd_per_kwh": 0.0853
  },
  "scratch_token_tiers": {
    "0.6B": {
      "chinchilla_baseline_tokens": 12000000000,
      "practical_scratch_tokens": 300000000000,
      "stretch_scratch_tokens": 1000000000000
    },
    "1.0B": {
      "chinchilla_baseline_tokens": 20000000000,
      "practical_scratch_tokens": 500000000000,
      "stretch_scratch_tokens": 1500000000000
    },
    "1.5B": {
      "chinchilla_baseline_tokens": 30000000000,
      "practical_scratch_tokens": 800000000000,
      "stretch_scratch_tokens": 2000000000000
    }
  },
  "behavioral_corpus_recommended": {
    "records": 2500000,
    "assistant_tokens": 500000000,
    "preference_pairs": 200000
  },
  "behavioral_task_ratios": {
    "positive_open_conversation": 0.16,
    "factual_explanation_honest_uncertainty": 0.12,
    "summarization_extraction_rewriting_strict_formats": 0.14,
    "code_explanation": 0.08,
    "practical_judgment_unavailable_resource_fallback": 0.12,
    "underspecified_choice_and_priorities": 0.10,
    "conflict_handling_across_sources": 0.10,
    "latest_user_correction_overrides_stale_memory": 0.06,
    "retrieved_prompt_injection_resistance": 0.05,
    "neutral_lawful_adult_inquiry": 0.04,
    "narrow_harm_boundaries_with_lawful_help": 0.02,
    "anti_repetition_clean_stopping_bounded_output": 0.01
  },
  "refusal_budget": {
    "pure_refusal_only_sft_token_share_max": 0.01,
    "all_boundary_examples_token_share_max": 0.05,
    "positive_helpful_to_refusal_ratio_min": 20,
    "positive_helpful_to_refusal_ratio_preferred": 30
  },
  "recipe_conservative_adapter": {
    "sequence_length": 4096,
    "packing": true,
    "assistant_only_masking": true,
    "adapter": "LoRA",
    "rank": 16,
    "alpha": 32,
    "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "dropout": 0.05,
    "optimizer": "paged_adamw_8bit",
    "learning_rate": 0.0001,
    "warmup_fraction": 0.03,
    "scheduler": "cosine",
    "weight_decay": 0.01,
    "betas": [0.9, 0.95],
    "gradient_clipping": 1.0
  },
  "recipe_cpt_plus_full_sft": {
    "cpt_tokens_recommended": 30000000000,
    "cpt_sequence_length": 4096,
    "cpt_learning_rate_peak": 0.00008,
    "sft_learning_rate": 0.00001,
    "optimizer": "AdamW",
    "precision": "bf16",
    "gradient_clipping": 1.0
  },
  "recipe_distill_plus_preference": {
    "distillation_type": "top_k_logit_distillation_plus_sequence_imitation",
    "temperature": 2.0,
    "top_k": 64,
    "student_sequence_length": 4096,
    "student_learning_rate": 0.00005,
    "preference_method_default": "DPO",
    "preference_method_binary_label_fallback": "KTO",
    "dpo_beta_range": [0.05, 0.15]
  },
  "release_gates": {
    "compare_unadapted_source": true,
    "compare_adapted_source": true,
    "compare_quantized_artifact": true,
    "compare_native_runtime": true,
    "compare_browser_runtime": true,
    "ordinary_conversation_regression_required": true,
    "remote_inference_hidden_logic_forbidden": true
  }
}
```

The assumptions above are derived from the public TinyRustLM product surface, the current UAIX charter, the Chinchilla scaling-law paper, the public SmolLM2 model cards and training disclosures, current official H100 specifications, current public Lambda and Runpod pricing pages, and current Axolotl / TRL / PEFT / TorchAO documentation rechecked on the research date. citeturn37search0turn29view0turn41search0turn11view0turn24search0turn24search1turn26search0turn38view0turn38view1turn39view0turn39view2turn39view3turn39view4turn39view5turn39view6turn39view7