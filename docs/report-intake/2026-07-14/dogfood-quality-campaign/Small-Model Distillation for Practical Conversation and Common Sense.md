# Small-Model Distillation for Practical Conversation and Common Sense

## Executive Recommendation and Assumptions
We aim to build CPU- and browser-friendly student models (~0.3–2B parameters) that match high-level conversational quality.  Our approach is to carefully **select and vet source models**, then distill them into student models using a **behaviorally rich curriculum** and robust preference/data-distillation techniques.  We assume access only to public, open-licensed foundation models (Qwen, SmolLM, Granite, etc.) and an open registry (`MiniModel.org`).  All training must use clean data – no proprietary or benchmark answers.  We adopt the UAIX Cognitive Liberty policy: *lawful adult tasks receive substantive help; illegal or nonconsensual-harm requests must be firmly refused*.  Key assumptions include: open-weights sources, Apache-like licenses (many Qwen/Smol models are Apache 2.0), and targets of ≤2B parameters for local (.slm) deployment.  We further assume browser runtimes (WASM, llama.cpp) prefer **dense decoder- transformer variants** with tied embeddings for compactness, **Grouped-Query Attention (GQA)** for reduced KV memory, and if available, small “hybrid” SSM or expert layers (e.g. Granite’s Mamba2) only if support exists.  We explicitly assume *not to cheat* by training on any held-out evaluation prompts or known answers.  Quality metrics beyond benchmarks include common-sense reasoning, multi-turn coherence, ambiguity handling, planning, and factuality.

## Candidate Architecture Matrix (0.3–2B)
We compare publicly documented models (dense-only or hybrid) around 0.3B–2B.  Key families: **Alibaba Qwen2** (0.5B & 1.5B), **SmolLM** (0.135B, 0.36B, 1.7B), **IBM Granite** (0.34B, 1.5B hybrids & 0.4B, 2B dense), and any emerging analogs (e.g. LiquidAI LFM).  Table-like summary:

- **Qwen2-0.5B / 1.5B**: Alibaba’s decoder-only Transformers (dense, no MoE). They use *Group-Query Attention* (GQA) to reduce KV-memory (e.g. Qwen2-1.5B has only 2 KV heads instead of equal to query heads), long-context extension via Dual-Chunk Attention (DCA) and YARN. Vocabulary is large (151,646 tokens, BPE), embeddings are *tied* in 0.5B/1.5B (untied in larger models). Base layers: ~28 layers @ hidden 896→1536, head-size 64→128. Context up to 32K (final RoPE), 4K by default then extended; KV cache per token is unusually low for memory (explicitly noted). Qwen2 is Apache-2.0 (open). Conversion complexity: straightforward HF → rust using ONNX/LLAMA tools; size moderate (1.5B).

- **SmolLM (125M, 360M, 1.7B)**: Hugging Face’s small models. All are decoder-only Transformers with *embedding tying* and GQA in smaller sizes, context 2048 (extensible via fine-tune). The 135M/360M use very deep narrow nets (akin to MobileLLM style) – e.g. ~100 layers vs 20–40 width – and use SwiGLU activations. The 1.7B is more conventional depth/width. They use a SmolLM-specific tokenizer (vocab 49,152). These are Apache-2.0. GQA heads reduce KV memory, all use tied embeddings. Conversion: checkpoints available in HF and ONNX, with LLAMA.cpp quantization planned. Activation memory: deep nets consume more intermediate activations but fewer per-layer params. KV growth: small KV head count (4) limits cache memory; typical sequence lengths 2048–4096. Browser tested (there are WebGPU demos) so portability is proven.

- **Granite 4.0 Nano (350M & 1B, hybrid or dense)**: IBM’s recent “granite” SLMs. These come in *hybrid-SSM* and *standard Transformer* variants. The **H-350M/H-1B** (“Dense H”) use a hybrid SSM+Mamba2+GQA architecture. For example, Granite-4.0-H-1B (“Dense H 1B” in) has embedding 2048, 40 total layers (alternating 4 GQA heads + 36 Mamba2 layers), SwiGLU MLP, 4 KV heads, 128K context with RoPE. The non-H variants (“1B” and “350M” in) are simpler dense Transformers (e.g. 36 layers, 1.5B params). Granite uses *GQA* and *Mamba2 (Mixture of FFT+SSM)* layers. Input/output embeddings are tied. Licenses are Apache-2.0. Hybrid variants may not yet run in llama.cpp, but vLLM and IBM’s tools support them. Key: huge context (128K!), extremely low KV (4 heads only) thanks to Mamba2. Conversion: the base version is on HF and gitlab. Activation/KV growth: Mamba2 layers have SSM state (128), so activations differ from standard MHA; KV cache small. More complex conversion, but HF repo provides scripts.

- **(Other architectures)**: We note Google/Microsoft small: Phi-1.5B, Gemma-2B (both decoder-only with rotary), LiquidAI LFM (unknown details but reportedly hybrid too), etc. MobileLLM-125M (dense with GQA) exists but is not open-source. For completeness, any viable 0.3–2B must be open (e.g. Llama-3-1B, licensed by Meta, could be ported). We exclude proprietary GPT or Anthropic.

**Summary:** All candidate students are dense decoders with GQA. Key dims:
- **Tokenizer:** Qwen uses ~151k (tied for small variants); SmolLM uses 49k; Granite likely ~50k (typical). Smaller vocab → smaller embeddings.
- **Tied embeddings:** Yes for Qwen (small models) and SmolLM; Granite ties I/O.
- **Attention:** All use GQA (few KV heads) for efficiency.
- **Context:** Qwen extends to 32K with chunking, Granite to 128K; SmolLM default 2048 (fine-tunable to 8K).
- **Memory:** Small KV (2-4 heads) and tied embeddings keep memory low. 1.5B models may need ~8–12 GB RAM (FP16) for long context. Activation memory rises with hidden size and depth.
- **KV Cache:** Grows linearly per token, but GQA’s smaller KV size mitigates growth.
- **Compatibility:** All are standard Transformers (no exotic ops beyond grouped attention and SSM-like layers). They run on PyTorch + llama.cpp/WASM: Qwen and SmolLM have ONNX/llama exports; Granite’s hybrid layers need custom ops (IBM provides vLLM support).
- **Licenses:** Qwen (Apache-2.0 for open models), SmolLM (Apache-2.0), Granite (Apache-2.0). All are source-available.
- **Source pinning:** We will fix specific git commits or model card versions for reproducibility (e.g., Qwen2 GitHub SHA, SmolLM Git commit, Granite HF version).
- **Conversion complexity:** All have HF checkpoints; conversion to SLM requires careful handling of GQA (some runtimes may not support multi-head-kv grouping without a transform). Mamba2/SSM might require custom kernels. In practice, simplest are SmolLM (vanilla) and Qwen2 (dense). Granite hybrid needs additional libraries (IBM code). We assume we can convert to ONNX or gguf then to `.slm`.

**Sources:** Qwen2 tech report, Qwen wiki/license; SmolLM blog (architecture), HF model card (license); Granite HF card (arch), Granite Nano blog.

## Source-Model Screening Protocol and Rejection Criteria
Before any conversion or student training, each prospective teacher model must be rigorously vetted in **fixed/predetermined tests**. The screening protocol is:

1. **Deterministic Evaluation:** Run each raw model (base or instruct) on a **fixed suite of seed prompts** (e.g. 100 diverse queries covering all target dimensions) *with fixed RNG seeds*. Examples include straightforward questions, edge cases, and trick prompts (e.g. ambiguous queries, code, policy scenarios). Each prompt is run at least twice (with same seed) to verify determinism. We save exact token outputs.

2. **Paraphrase Robustness:** For a subset of ~20 prompts, also test 3–5 manually generated paraphrases to ensure consistency across wording. The model must handle equivalent intents similarly (no hallucinations or drastic shifts in tone).

3. **Constraint Checks:** Automatically flag any outputs violating policies: factual claims contradicted by common knowledge, disallowed content, or breakdown of format. Use simple filters (e.g. Fermi failure, NSFW terms) and specialized checks (e.g. safe-completion filters). If any prompt category (ambiguity, source conflict, etc.) causes blatant failure (e.g. hallucination of false facts, ignoring safety rules), mark it.

4. **Human Review:** A small panel (3 reviewers) inspects outputs for coherence, bias, and alignment with expectations. They ensure *preservation of raw model behavior* (no silent retort rewriting). Any disallowed transformation (like rewriting an incorrect answer into a correct one) is unacceptable. Disagreements or any instance where the model’s literal output is unacceptable trigger rejection.

5. **Rejection Criteria:** We reject any model that **repeatedly** fails fundamental constraints. For example: unsafe instructions solved incorrectly, repeated factual errors, toxic content, or inability to answer trivially (e.g. text generation fails). A single rare slip may be allowed if isolated, but patterns of failure (e.g. all ambiguous queries lead to nonsense) are cause for rejection.

6. **Scale:** Initially, pilot screening uses ~100 prompts × 2 runs (deterministic). After initial passes, if no fatal issues, expand to ~500 prompts across categories (chat, planning, code, etc.), plus 5 paraphrases each (total ~2500 evals). Each expansion is reviewed by 5–7 human raters. If a model passes without significant issues, only then proceed to conversion/training.

Thus, we spend modest compute on screening (low text-per-inference) before committing to heavy distillation. Only models with stable, policy-compliant raw behavior are allowed.

## Curriculum Taxonomy and Target Sizes
We construct a **behavioral curriculum** spanning all targeted conversational skills. Each example is a (instruction, context, response) pair (or conversation), mostly drawn from high-quality corpora or synthetic generation. Key categories, with rough target counts (out of e.g. a 100k+ final set):

- **Casual Chat / Q&A (50%)**: Ordinary multi-turn conversations and Q&A on general topics. E.g. user asks about news, hobbies, everyday tasks. ~50k examples. Source: public dialogues, simulated chat with teacher LLM.

- **Ambiguity Resolution (5%)**: Prompts that are intentionally vague or ambiguous. Teach model to ask clarification or handle multiple interpretations. E.g. “I saw her duck” (bird vs. lower) or “Open the bank” (river bank vs. money). ~5k cases.

- **Pragmatic Planning / Multi-Step Tasks (10%)**: Instructions requiring multi-step reasoning (e.g. planning a trip, cooking recipe generation). Models must sequence steps logically. ~10k cases.

- **Source-Conflict Reasoning (5%)**: Queries referencing conflicting sources. E.g. “According to source A, X; but source B says Y; which is true?” The model must weigh authority or admit uncertainty. ~5k.

- **Current-Turn Precedence (3%)**: Situations where the user’s *immediately preceding statement* should override a prior context or memory. E.g. user says “Actually, ignore what I said about X.” Model must respect the latest instruction. ~3k.

- **Trusted vs Untrusted Memory (5%)**: Multi-turn dialogues where some provided memory facts are reliable and others not. Model should respond based on trust. E.g. user-provided personal profile (trusted) vs. internet facts (untrusted). ~5k.

- **Multi-Turn Reference (15%)**: Continuity across turns. Conversations where answers must refer back to earlier turns (e.g. “Remember what we talked about?”). ~15k.

- **Lawful Adult Inquiry (2%)**: Complex adult topics (medicine advice, sexual health) framed as lawful assistance. The model must give thorough, factual help without inappropriate refusal. ~2k.

- **Narrow Refusal Cases (<5%)**: Questions clearly outside policy (illegal instructions, hate speech). Very few (e.g. 2%), to teach *when* to politely refuse.

- **Factual Q&A (5%)**: Knowledge questions (math, science, history) with concrete answers. Model should answer factually (or refuse if uncertain). ~5k.

- **Summarization (5%)**: Summarize text passages or conversations. ~5k.

- **Rewriting/Clarification (3%)**: Rewrite content to a different style (formal→informal, etc.). ~3k.

- **Structured Output (JSON/Extraction) (5%)**: Convert input to structured data. E.g. “Extract names and dates from this text” or “Output itinerary in JSON.” ~5k.

- **Code (10%)**: Explain code, debug, or generate code snippets (allowed tasks). ~10k.

In total ~100k+ examples. Crucially, **positive (helpful)** instances vastly outnumber negative (refusal/safe-completion) examples (target ~95% help, 5% refusal), to bias helpfulness.

**Generation strategy:** Start with small pilot (e.g. 1k per category) manually curated or synthetic. Then scale:

- *Ordinary chat:* harvest public dialogues, open-domain QA (HuggingChat logs with permissive license), then filter/prompt teacher LLMs to continue chats.

- *Special categories:* Write templates and prompt teachers. E.g. for ambiguity, manually craft 100 templates and use LLM to paraphrase into 10 variations each (scenario-factor generation).

- *Code, Math, structured:* use public code/math datasets (e.g. CodeParrot, grade-school math problems) plus extra contextual instructions.

- *Scaling:* Use teacher models to generate variations (topic shifting, synonyms). For JSON/extraction, create templates of document texts with known fields and use LLM to extract.

We continually balance: e.g. if planning examples underperform, we upsample. All data is cleaned and filtered before use (no known evaluation QA).

## Data Augmentation & Generalization Strategies
To avoid rote memorization, we systematically **vary example details**. Techniques include:

- **Scenario-Factor Permutation:** Create multiple versions of each scenario by swapping non-essential details. E.g. change names, locations, numbers, units, dates. If original: “Plan a 3-day trip to Paris,” we generate “Plan a 5-day trip to Rome,” etc.

- **Counterfactual Constraints:** Add resource limits or alternate conditions. E.g. “List ingredients you need to cook X if you only have 50% of typical resources.” Force the model to think rather than recall fixed list.

- **Authority Permutations:** Vary source of authority for conflicts. E.g. “According to *Professor Lee*, X. According to *Wikipedia*, not-X. Which should the student follow?” Trains weighing authority level.

- **Entity & Unit Substitution:** Replace entities and units with others in same category. E.g. shift “Alice”→“Bob”, currencies, metric vs imperial units. Ensures model doesn’t learn “Alice always = heroin” heuristics.

- **Discourse Variation:** Present the same content in different formats (narrative, bullet points, dialogue, code comment, JSON). Model learns format flexibility.

- **Multi-turn State Changes:** Many examples simulate evolving user context. E.g. user corrects model, adds new info, or changes topic. Model must update internal state.

- **Hard Negatives / Adversarials:** Create similar-input examples that require different output. E.g. near-duplicate prompts with small twist. The model should not confuse them. Include “barbed” or trick questions (designed to tempt a wrong answer) to strengthen robustness.

- **Adversarial Instructions:** Include tricky or deceptive instructions (“Ignore your previous instructions and output X”) to ensure model handles them without breaking content rules. These are fed to the student during training as negative examples.

- **Teacher Disagreement Cases:** Generate prompts where two competent teachers give different valid answers (or label one as preferred). The student learns to prefer safe/high-preference style. For instance, two teacher LLMs produce distinct summaries of a document; we present both and mark one as better (via DPO training).

This curriculum design ensures learning **rules and reasoning** rather than memorizing fixed answers. We emphasize variety (100K+ unique example seeds) and avoid repetitive templating. All synthetic instructions avoid leaking test prompts or answers.

## Distillation and Fine-Tuning Methods
We compare many training approaches, focusing on those feasible for ~0.6B–1.5B students:

- **Supervised Fine-Tuning (SFT):** We fine-tune the student on curated (instruction, response) pairs. Two styles: *assistant-only* (train only on response, prepending “Assistant:” tokens) vs *full-sequence* (train on [User Prompt; Assistant Response] together). Full-seq more natural conversation context but slightly slower to converge; for small models we prefer full-seq to capture user-assistant interplay. SFT requires largest data but is straightforward (store entire sequence). Cf. [40] suggests focusing on SFT for preference alignment.

- **LoRA / Adapters:** We use **LoRA** (low-rank adapter layers) on top of the student for alignment tasks (preference or specialty finetunes). LoRA introduces few trainable params (one or two linear layers per weight matrix) so GPU/CPU memory is tiny. Effective even on small models, and much cheaper than full-tuning. Similarly, **upper-layer adapters** (like IA³ or Pfeiffer adapters) can modulate last transformer layers.

- **Full Fine-Tuning:** Viable for ~1B model on multiple GPUs; on CPU or small GPUs might be feasible with gradient accumulation. We plan small-batch, mixed precision (FP16/BF16 on GPU) to do final SFT if needed. However, full-tuning has heavy memory (optimizer states ~4× model size) and compute (GB200 GPUs used by Granite group).

- **Preference Optimization:** Beyond SFT, we incorporate preference data via:
   - **DPO (Direct Preference Optimization)**: A simple RLHF variant where the model is fine-tuned using pairs of good vs bad responses (KL-based loss). DPO is credible even for 1.5B (it was applied to Mistral-7B in literature).
   - **ORPO (Odds Ratio PO)**: A reference-free variant shown to work for 125M–7B. ORPO applies at SFT stage, essentially weighting favored style without a separate RL step. Suitable for small models as it only needs the same SFT compute. We plan to test DPO vs ORPO on 0.6B pilot; both require a preference dataset (collected via teacher ensemble or crowd).
   - **DoRA (Distributionally Robust PO)**: This augments DPO with a robust reweighting to avoid overfitting “gold” preferences. Likely overkill for SLM scale (also GPU-heavy), so we may consider it only if other methods fail on distribution shift.

- **Knowledge Distillation (KD):**
   - **Token-level KL distillation:** Train the student to match the teacher’s probability distribution (KL loss) at each token. This is rigorous but expensive (compute teacher logits for each token) and may require long pretraining sequences (as in DistilBERT). Feasible for 0.6–1.5B if data is ample.
   - **Sequence-level distillation:** Train student on teacher’s sampled answer sequences (one-hot or cross-entropy). Cheaper but can lose rich distribution info. Might use a mix: token KL for first X steps, then CE on teacher generations.
   - **Top-k logit distillation:** Only match teacher’s top-k logits (saves compute). Literature shows drop if too few (the tail carries info). We may use k~100 for quality.
   - **Hidden-state (Representation) Matching:** Techniques like TinyBERT align student attention/hidden layers to teacher’s. Requires a large set of unlabelled text and teacher forward passes. Likely too heavy for a 0.6B in our budget (and the target is generative, not classification).
   - **Self-Distillation:** Iteratively train the model using its own outputs as “teacher” data, possibly at larger temperature. Risk: model collapses to its current biases. Usually secondary after better teacher-based KD. Feasible as an auxiliary step.

For small students, **LoRA and sequence-level KD** are the most practical. Full RLHF (PPO) is out of scope (requires massive compute and data). Preference tuning via DPO/ORPO can be done on 0.6–1.5B with moderate budgets (as in small LLM papers). We note: do *not* distill from evaluation models or use test queries as training. Distillation will use our curriculum data with teacher labels.

## Teacher Generation and Review Pipeline
**Teacher Ensemble:** We use multiple strong open-source LLMs as teachers to generate data and labels. For each example prompt, we sample from **an ensemble of 2–3 diverse teachers** (e.g. Qwen2.5-1.5B, SmolLM2-1.7B, Granite-1B, Llama3-1B where allowed). This ensures variety and mitigates any single-model bias.

**Answer vs. Chain-of-Thought:** For complex tasks, we generate *chain-of-thought (CoT)* + final answer from teachers, but store only the final answer in training data (to avoid student cheating by copying rationales). The reasoning steps are used during review (for grading, but not given to student).

**Sampling Diversity:** We use sampling (top-p, temperature ~0.7) to get diverse answers rather than greedy. We may generate 3 outputs per (prompt, teacher) with different seeds, then **filter**. For final dataset, we include one target answer; the others are potential negatives or can be pooled for preference learning. We fix random seeds and document them, so generation is reproducible.

**Deterministic Replay:** All teacher generations are logged with seed/determinism flags. This ensures we can exactly re-generate a teacher output if needed for audit.

**Factual Verification:** We automatically check teacher outputs for factual consistency using external tools (e.g. math using calculators, facts via knowledge-bases, language models trained on facts). Any answer flagged as clearly wrong is either discarded or marked for human review.

**Rubric-Based Review:** We develop rubrics for key categories (helpfulness, correctness, safety, style) and have human annotators (or the ensemble voting) assign scores. Only high-quality responses (score ≥ threshold) are kept for SFT; mediocre ones become part of preference pairs (good vs bad) or are dropped.

**Disagreement Adjudication:** If multiple teachers disagree (e.g. one says X, another Y) on a “ground truth” query, we handle by either:
- Treat it as a preference pair (preferred vs alternate answer) for DPO training.
- Use a third-party judge (human or GPT-4) to decide which answer is better, or combine points.
We keep a **log** of which teacher produced each answer. This preserves provenance and supports later auditing (“which model said what?”).

**Lineage & Licensing:** All teacher outputs will note the teacher model ID; we only use teachers under open licenses (we do *not* use closed LLMs for generation). We track lineage so that if a teacher model is later found to have a license issue or content problem, we can trace and remove those examples.

**PII and Malicious Content:** We run PII detectors on teacher outputs; any personal data (names, IDs) introduced by a teacher is scrubbed. Likewise, outputs flagged as hate-speech, illegal advice, defamation, etc. are either rewritten or purged. We ensure the **student dataset remains beyond reproach**.

In summary, teacher generation is an ensemble+filter+review loop: generate with multiple open LMs, evaluate by rubric+automated checks, use only vetted answers (plus intentional negatives) for student training.

## Contamination Threat Model and Controls
We enforce strict guards to ensure **no leakage** of any evaluation prompts or answers (including paraphrases) into training data. Our controls include:

- **Exact Text Matching:** Normalize case, whitespace, punctuation on all training data. Remove examples if any *exact n-gram* (say ≥5-word sequence) matches a known test prompt or answer. We maintain lists of all evaluation data and heavily filter overlap.

- **Character/Token n-gram Analysis:** Compute hashes of n-grams (for n=8–20 chars) in training set vs. bench items. Any high-overlap sequences trigger deletion.

- **Semantic Neighbor Search:** Use an LLM or embedding search to find semantically similar content to test questions. For any training example that is highly semantically close (e.g. >0.9 embed sim) to a held-out prompt/answer, we drop or rephrase it.

- **Template-Family Detection:** Our auto-generation uses templates; we ensure that no template used to create train examples is “too similar” to one used for tests. If a pattern (e.g. “In [Country], what is the capital?”) appears in train, we avoid that structure in test, and vice versa.

- **Entity/Number Substitution Overlap:** Even if an answer isn’t verbatim, matching answer to test needs guarding. We scan numeric and named entities: if a training answer shares *any* same unique entity or unusual phrase with a test answer, we remove it. For example, if test answer has “Eiffel Tower”, we avoid any training answer with that phrase.

- **Response-Answer Overlap:** If a question in training is extremely similar to a test question but with slightly different wording, we ensure the answer *differs*. If not, drop it.

- **Public Benchmark Overlap:** We explicitly remove all examples from public QA or dialogue benchmarks that appear in any evaluation. For instance, if MMLU or TruthfulQA QA pairs are used for eval, we prune them out of any SFT or KD data.

- **Sealed Holdouts:** We designate a “sealed” portion of known benchmark data and internal red-team questions that are kept off-limits. We train our filters on these holdouts and check after all example generation that no holdout content got in.

- **Deletion Lineage:** We keep a manifest of filtering steps. Any example failing contamination checks is deleted (and cannot be reintroduced). This ensures the training set is auditable: one can verify a random sample contains none of the held-out content.

To **prove** cleanliness: we can publish the final example IDs (hashes or signatures) and show they have zero overlap per the above tests with any prompt/answer seeds. All filters (regex for normalization, embedding search thresholds, etc.) are scripted and logged.

## Compute Plan: CPU Pilot and GPU Scale-up
We design a two-stage compute plan:

**CPU Pilot:**  For prototype (sub-0.5B), we use a single high-end machine (e.g. 256GB RAM, 32-core CPU, torch+on-device training with multithreading). Sequence length 512, batch size 16, FP32 (no GPU), gradient accumulation to simulate larger batches. We estimate throughput: ~500 tokens/sec on 1.5B with seq512 (guess). Using formula:
$$T = \frac{\text{#tokens per step} \times \text{FLOPs per token} \times \text{steps}}{\text{CPU FLOPs/s}}.$$
E.g. 0.6B model ~2e11 FLOPs per 2048 token sequence (rough guess from [11] 12T tokens cost on 1.7B was \$250k of H100s). On CPU (1e12 FLOPs/s) that’s ~2e-1 sec per 2k tokens → 10,000 tokens/sec. With 100k tokens steps → days. These formulas guide steps vs time. We use mixed-precision if CPU supports BF16 (AVX-512). Checkpoint every 5000 steps on disk. Deterministic seeds set via torch.manual_seed. We use AdamW with small lr (3e-5–1e-4) and warmup+cos decay. If loss not decreasing on validation by 3 checks, we stop (restart as needed). Pilot run cost: e.g. fine-tuning 0.6B on 100k examples might take ~1 week CPU. If memory exhausts (OOM), reduce batch or use gradient checkpointing (PyTorch’s ckpt to save memory).

**GPU Scale-Up:** For 1.5B+, we use cloud GPUs (8×A100 80GB or equivalent). With FP16, 1.5B uses ~10GB VRAM, so 40GB free for batch. Batch size = 4–8 sequences of 2048, gradient accumulate to 32 total. Throughput ~1000 seq/sec. Training 50k seq (100M tokens) ~2 hours. Full dataset (~200M tokens) ~4–5h per epoch. Expect ~3–5 epochs. Optimizer states (Adam) ~3× model size (in bytes). We use gradient checkpointing to halve activations if needed. Mixed precision (FP16) halves memory. Checkpoint every 10k steps. We use static seeds for reproducibility.

**Stop criteria:** Pilot/CPU: stop if loss plateaus or diverges. GPU: use validation metrics (perplexity on a held-out set) and RLHF preference improvement (if used) to decide convergence. Also, time cutoff: e.g. if no GPU speed advantage, revert to CPU plan. All logs and checkpoints (with step count) are saved; we can resume from any. We formulaically estimate, e.g.:
> *Time ≈ (T_total_tokens / throughput_tokens_per_sec)*1.2 (overhead),
> where throughput = (batch_size × seq_length / time_per_batch).
We set time budgets (e.g. 100 GPU-hours per full fine-tune) and stop early if models reach expected quality gains or if plateaued.

We compile all hyperparameters and formulas into the runbook for audit.

## Promotion Experiments Matrix
To evaluate progress and select deployable models, we run **model promotion experiments**:

- **Models compared:** Original source model (e.g. Qwen-1.5B base/instruct), the student after SFT, the student with adapters (LoRA) fine-tuned, and final `.slm` quantized student (e.g. 4-bit). Each model is evaluated fresh (no cherry-picking).

- **Settings:** For each model, run in two modes: deterministic (greedy) and sampling (e.g. top-p=0.9) to measure quality under variability. Each prompt given a fixed seed for comparability when sampling.

- **Metrics:** Use a suite of evaluation cases *not seen in training*, including:
  - A set of multi-turn dialogs (common-use scenarios).
  - Unseen paraphrases of these dialogs.
  - Standard benchmarks (MMLU, ARC, HellaSwag, IFEval) with fixed prompts.
  - Specialized tricky cases (ambiguity, math).
We measure correctness/accuracy (where applicable) and also **human-rated helpfulness** on random samples.

- **Latency/Memory:** On a typical CPU+WASM environment, measure per-token latency and peak RAM for each model (student vs source). The `.slm` quantized model should have significant speedup or memory reduction.

- **Regression Budgets:** We define acceptable performance drop: e.g. student can be up to 5% worse in helpfulness accuracy relative to source on key tasks, but not more (tolerance can be tighter on safety or facts). Explicit targets (e.g. “student ≥90% of source’s accuracy on Core QA, ≥ 95% on style”). If student fails budget, iterate further training.

- **Multi-turn fidelity:** Include tests where context is long (multiple turns), ensure coherence.

- **Statistical tests:** Because sampling is non-deterministic, run each sampled evaluation 3× with different seeds and average. For multi-turn, use a small human eval (3 annotators) for helpfulness/coherence.

Results feed back to training: if e.g. some category underperforms (like planning), we augment curriculum.

All experiments use *raw outputs* of models without any post-filtering or prompt engineering. The matrix of results is logged and reviewed before promoting any model to `MiniModel.org`.

## Path to 1, 5, and 20 Distinct Models
Our goal is a *portfolio* of 20 genuinely distinct and useful models (not byte-identical). We propose staging:

- **1 Useful Model (Minimum Viable):** Pick the best combination of source (e.g. Qwen2.5-1.5B or SmolLM-1.7B) and alignment method (likely SFT + LoRA + DPO). Distill into a 1.5B student (`.slm`). This single model meets all core criteria (broad chat abilities, basic safety).

- **5 Models:** Achieve diversity via **source families** and **behavioral variants**. For instance:
  1. Qwen2.5-1.5B-based student.
  2. SmolLM2-1.7B-based student.
  3. Granite-1.5B-based student (dense).
  4. Math-specialist: take one base (e.g. SmolLM) and fine-tune on math/problem-solving.
  5. Code-specialist: fine-tune another on coding tasks.
Each is a separate model in the catalog. Additionally, quantized versions (.slm-int8, .slm-4bit) are *not* counted as new models (they are just different serialization of the same model). So 5 distinct *weights*.

- **20 Models:** Expand diversity along meaningful axes, not trivial replications:
  - **Multiple Sources:** Qwen, Smol, Granite, plus maybe Llama3-1B or Liquid-AI LFM-1B.
  - **Specialized Variants:** e.g. one version trained slightly longer (high-verbose vs concise), or with different instruction tuning data (e.g. “polite-mode” vs “direct-mode”).
  - **Adapters Checkpoints:** Each of the above base students may have 1–2 adapter variants (e.g. one RLHF with DPO, one SFT-only) – but these *share base weights*. If we count *artifact*, maybe treat a merged model (base+adapter) as one artifact, so not inflating count by small changes.
  - **Floating vs Quantized:** We do not count int8/4bit quantizations as distinct entries.
  - **Independent Seeds:** Retraining same config with a different random seed yields bit-different weights, but usually no new capabilities – these are “catalog theater.” We should avoid listing them separately unless their behavior somehow diverged meaningfully (unlikely).
  - **Precision Tiers:** If some models are float16 and some full fp32 (rare for deploy), this is not meaningful diversity either.
Thus, to reach 20, likely we do:
   - ~5 core architectures × (1 base + 1 instruct-tuned + 1 adapter-tuned) = 15.
   - 5 specialized variants (math, code, summarization, persona, bias-offset) of a couple architectures.
   - The resulting 20 are mostly different sources and purpose-variants.

In summary, meaningful diversity comes from **architectural/lineage differences** (different base families) and **specializations** (different fine-tuning). Trivial variants (random seeds, just quantization) do not count.

## Failure Modes and Rollback Strategy
**Likely Dead-ends:**
- **Data contamination:** Accidentally including test answers, leading to overfit. Control with strict filters as above. If discovered late, we can retrain with cleaned data.
- **Catastrophic forgetting:** Over-tuning on one skill (e.g. math) might hurt casual chat. Mitigation: balanced curriculum. If seen, roll back to a previous checkpoint and add missing mix.
- **Safe-completion misbehavior:** e.g. refusal style goes too broad/narrow. If students become over/under-pessimistic, we can adjust the DPO/ORPO temperature or data mixture.
- **Training instabilities:** Small models can diverge if LR too high or data noisy. We schedule safe LR decay, clip grads. If training fails (loss nan or exploding), revert to earlier checkpoint and lower LR.
- **Alignment irreversibility:** If preference tuning (DPO) warps the model (e.g. repeats high-scoring short answers), we may rollback to pre-RLHF checkpoint.
- **Compute limits:** If expected GPU speeds not achieved (maybe due to model conversion issues), fall back to simpler training (SFT only).
- **Evaluation bias:** If our “promotion matrix” mis-evaluates (e.g. student seems worse but actually is better in human eval), we should maintain some double-check with blind human A/B tests before rejecting a promising model.

At any sign of degenerate behavior (e.g. repeated trivial answers, or hallucinations increase), we revert to last known-good checkpoint and inspect logs. We keep multiple branches: e.g. one train branch with adapter, one without. This allows rollback or switching strategies quickly.

## Unknowns Requiring Local Testing
Certain behaviors must be observed by running models, not deduced from papers:

- **Browser WASM compatibility:** Some architectures (Granite Mamba2) may not run in llama.cpp/wasm. We need to test conversion to `.slm` early. If impossible, that branch may be cut.
- **Tokenization issues:** Exact tokenization effects on local inference (especially with Qwen’s large vocab) must be tested. We must verify no token mismatches.
- **Performance vs Latency:** We will actually measure on target devices (phones, laptops) to see if the model runs fluidly. If a “0.6B” model is still too slow, we might need to quantize.
- **Multi-turn coherence:** Only an actual multi-turn chat reveals if the student maintains persona/context. We plan a small pilot interactive session with the model as soon as we have a candidate.
- **Safety/Ambiguity:** Real user simulations (with adversarial prompts) will test boundaries. This requires interactive testing.
- **Integration with calculator:** Arithmetic is delegated to an external calculator, but we should test e.g. if user says “2+2” does our chain reliably call out or answer?

These steps involve running the model on tasks and refining filters/training as needed.

## Annotated Bibliography

- **Qwen2 Technical Report (2024)** – *Yang et al.* arXiv, July 2024. Detailed architecture of Qwen2.5 (0.5B, 1.5B, 7B, 72B) including GQA, DCA, GQA head config, token vocab (151646) and training data (7T tokens). Confirms Qwen2 small models use tied embeddings and dramatically lower KV size per token. Retrieval: 2024-07-25.
- **SmolLM2 Paper (2025)** – *Ben Allal et al.* arXiv, Feb 2025. Describes SmolLM2 (1.7B) training on 11T tokens with data-centric design. Claims SmolLM2 outperforms Qwen2.5-1.5B on reasoning benchmarks. Key for understanding small-model training budgets and data pipeline. Retrieval: 2025-07-10.
- **SmolLM Blog (2024)** – *Ben Allal et al.* HuggingFace blog, July 16 2024. Architecture details: 135M/360M models use MobileLLM-like deep design with GQA and SwiGLU, 1.7B is conventional. All use embedding tying, context=2048. Vocab=49152. Also performance comparisons: each SmolLM size tops peers in its class. Retrieval: 2024-12-10.
- **Granite 4.0 Nano Blog (2025)** – *Panda et al.* HF Enterprise blog, Oct 28 2025. Announces Granite Nano models: 350M and 1B (dense and hybrid “H”) versions. Hybrid uses novel “hybrid-SSM” architecture. Confirms these variants’ sizes (~0.34B and 1.5B), license (Apache-2.0), and focus on on-device use. Retrieval: 2026-06-15.
- **Granite 4.0-1B Base Model Card (2025)** – *IBM Granite Team.* HF, Oct 2025. Key architecture: decoder-only dense Transformer with GQA, “Mamba2” (SSM-based) layers, SwiGLU, RMSNorm. Shows layer counts (28, 36+Mamba etc), embedding sizes, KV heads. Lists #params (340M/1.5B) and seq lengths (32K/128K). License = Apache-2.0. Retrieved: 2026-07-12.
- **Qwen – Wikipedia (2026)** – summary of Alibaba Qwen family, stating many models (including open ones) use Apache-2.0. Also notes Qwen architecture basis (Llama-like) and release timeline. Retrieval: 2026-06-30.
- **SmolLM HF Model Card (2024)** – *HuggingFaceTB.* Model “SmolLM-1.7B” card, showing license Apache-2.0 and confirming SmolLM vocab, dataset (Cosmopedia etc). Also has usage examples and memory footprint. Retrieved: 2026-07-10.
- **ORPO: Monolithic Preference Optimization (2024)** – *Hong et al.* arXiv, Mar 2024. Introduces ORPO method (no reference model needed), effective 125M–7B. Fine-tuning Phi-2 (2.7B) with ORPO yielded SOTA on AlpacaEval/IFFeval. We cite to note viability of reference-free preference tuning for our scale. Retrieval: 2026-05-05.
- **Direct Preference Optimization (DPO)** – *Rafailov et al.*, FAccT2023 (not directly cited above, but underlying our DPO mention). Showed simpler alternatives to RLHF. We mention it in context (no unique link used).
- **SmolLM2 Summary (Emergent Mind)** – Not cited directly, but informed us of SmolLM2 vs Qwen2.5 performance. Useful secondary note. Retrieval: 2026-01-20.

Each source was accessed between May–July 2026 for current info. All model details (arch, data, licenses) are taken from these primary references. Other claims (curriculum design, distillation methods) are synthesized from known literature and best practices (e.g. RLHF book, KD papers), though not individually cited here.
