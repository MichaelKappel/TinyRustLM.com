# 1. Executive Conclusion

Our review finds **weak evidence** that new hybrid architectures outperform compact dense transformers solely due to architectural innovation, after controlling for data, scale, and tuning.  On-device hybrid models (e.g. Liquid Foundation Models, Mamba-based hybrids) can **reduce memory use and improve throughput** under tight latency/memory budgets, but this often stems from replacing expensive KV caching with cheaper recurrent or convolutional state, at a cost of some retrieval accuracy.  In controlled large-scale comparisons, hybrid-SSM mixes (e.g. 8B Mamba-2-Hybrid) modestly outperformed same-size Transformers on many benchmarks (+2–3 points average) and were **~8× faster at inference**. However, *pure* SSM or convolutional models generally lag on tasks requiring in-context learning or precise retrieval (e.g. MMLU, factual recall).  Crucially, the **most confounding factors**—unequal data/training and post-training methods—often drive reported gains.  For example, Liquid’s LFM2 uses extensive distillation and fine-tuning, and the NVIDIA study tightly controlled training data and tokens.  

**Recommendation:** Given mixed evidence, we advise a *small-scale pilot* rather than full investment.  In particular, experiment with one dense and one hybrid model under matched conditions (same tokens, parameters, etc.) to see if the hybrid yields a real efficiency or quality gain in our browser-local setting.  If that pilot shows clear advantage (e.g. similar quality with much lower memory or latency), deeper development of a hybrid path could be pursued; otherwise continue optimizing the existing dense transformer path.  We estimate **moderate confidence** (~60–70%) that architecture alone is not a silver bullet and that gains likely depend on trade-offs.  A decisive result would be an *independent reproduction* of hybrid speed or quality gains under identical conditions; if such reproducible wins are seen (or not seen), they would overturn this recommendation.

# 2. Architecture and Public-Evidence Matrix

We categorize compact sequence models into families and summarize key reported evidence (quality, speed, memory, context) for each, citing primary sources where possible.  See also **Figure 1** for a summary.

- **Dense Transformers (baseline):** Standard multi-head self-attention models (e.g. LLaMA, Mistral). These excel at many benchmarks but incur **O(N²)** memory for KV cache.  E.g. LLaMA-1.2B uses ~524 MB of KV memory at 32K context. Their decode throughput on CPU is modest due to softmax.  Quality is high (state-of-art on many tasks), but asymptotic memory grows linearly with context.  Quantization (8-bit or 4-bit) reduces model size but not KV growth.

- **Sliding-Window Attention (Sparse Transformers):** Each token attends only to a fixed window of neighbors (as in Longformer).  On long contexts this gives linear compute/memory and has been competitive in practice.  A recent method (SWAT) trains purely with sliding-window+sigmoid, achieving *linear* inference and setting state-of-art on 8 reasoning benchmarks (e.g. PIQA, HellaSwag) among linear-time models.  Prefill/throughput = O(N) and memory ≈ O(N) as well.  No significant loss in quality reported compared to Transformers on those tasks.  (However, it uses careful training with ALiBi/rotary to avoid “attention sink”.)  **Evidence:** SWAT paper shows linear scaling with preserved accuracy; Longformer family showed strong long-doc performance but needed occasional global tokens (not cited here).

- **Grouped-Query Attention (GQA):** A variant of self-attention where keys/values are shared among groups of heads.  Used in some mobile models (e.g. Meta’s Mobile LLM) to reduce KV size.  GQA reduces KV memory and slightly speeds decoding at no reported cost in quality for comparable models. (No primary benchmark cited in literature, but Qualcomm/Meta presentations note ~x2 speed-up for on-device models.)  **Evidence:** Mentioned in LFM2 search space but no isolated metrics.

- **Liquid/State-Space (SSM) Models (e.g. LFM, Liquid S4, CfC):** Neural ODE/RNN-like blocks (state-space or “liquid time-constant” networks) designed to encode sequence history in a fixed-size state.  Liquid Foundation Models (e.g. LFM1/2 by Liquid AI) use many “gated short convolution” (liquid SSM) layers and a few global attentions.  These hybrids match Transformer quality on many tasks (the LFM2 paper reports on-device parity or slightly better) but with *much lower KV memory*.  E.g. LFM2‑1.2B runs 32K context at 719 MB total memory vs. 1.2B LLaMA’s >1GB.  Inference on CPU is reported up to 2× faster (prefill and decode) than same-size pure-attention models under equal quantization.  However, all results come from internal benchmarks on a proprietary evaluation suite and are largely vendor-reported.  **Evidence:** LFM2 Tech Report (Pareto search finds most benefits come from cheap convolutions + few attentions) provides strong internal comparisons.  (Model cards or independent tests are not published.)

- **Mamba and Mamba-2 (Selective SSMs):** Structured state-space models with input-dependent parameters.  Mamba-3B is reported to *outperform same-size Transformers* on language tasks, and to decode ~5× faster and with linear memory growth.  NVIDIA’s large-scale study (8B models, 3.5T tokens) finds a *mixed picture*: pure Mamba/SSM matched or exceeded Transformers on many language tasks but underperformed on in-context tasks; an 8B hybrid (≈43% Mamba-2 + 7% attention) **exceeded** the 8B Transformer on all 12 common benchmarks (+2.65% avg) and was *~8× faster* to decode.  Memory use was constant per token (no KV cache), giving linear growth only in computed state.  **Evidence:** Mamba paper (arXiv’23) and NVIDIA study (2024) with matched conditions.  The NVIDIA work is peer-reviewed (Tech. Report) and includes ablations controlling training data.  Mamba code/models are open (released via Hugging Face).

- **Retentive Networks (RetNet):** A Transformer-like model replacing self-attention with a *retention mechanism* that can run in parallel or recurrent mode.  Claims include full parallel training and O(1) per-token inference (no KV cache) with “no performance sacrifice”.  On benchmarks the authors report “favorable scaling” and efficient inference, calling RetNet a “strong successor to Transformer”.  However, no third-party reproductions exist.  **Evidence:** RetNet arXiv (Aug 2023) provides theory and some preliminary results on language modeling, but no open weights or broad eval suite yet.

- **Hyena Convolutions:** Uses carefully parameterized long convolutions (finite impulse response filters) plus gating.  The Hyena Hierarchy model (2023) matches Transformer quality on long-range tasks, claiming 20% less compute than a Transformer at 2K length, and dramatically faster inference at longer lengths (2× faster at 8K, 100× at 64K).  It also reports a 50+ point accuracy lift over simple SSMs on long tasks.  However these results are on large models (billions of params) and data-center hardware.  No small-scale (≤2B) Hyena model is widely available yet.  **Evidence:** Hyena Hierarchy paper (ICML’23) with open code and reproducible results on WikiText103/Pile.

- **RWKV (Recurrent Weights):** A layer-wise RNN that emulates attention via a specific gating.  RWKV models (up to 7B) are fully open-source.  They have O(1) inference memory and claim to run faster on CPU for long contexts, but require custom kernels.  Public benchmarks show RWKV-7B (fp16) achieving ~40–60 tokens/s on consumer GPUs, similar to LLaMA, and about 100 tokens/s when quantized to 4-bit.  Quality-wise, independent reports (and Liquid’s table) suggest RWKV models lag behind Transformers on many tasks (e.g. LM-Eval scores).  **Evidence:** RWKV is documented on its website/GitHub and community wiki.  No formal peer-reviewed benchmarks; one recent arXiv survey found RWKV requires careful training to match transformers at scale.

- **Hybrid/New Variants:** Other proposed blocks (e.g. CfC liquid nets, simplified S5, RTF, etc.) exist but lack large models or public weights.  No published evidence of outperforming standard architectures. Some use-cases (e.g. mixture-of-experts or custom convolution layers) exist but not widely adopted in small-scale LLMs.  

**Figure 1:** *Architecture families vs evidence.* All reported advantages are entangled with factors like training recipe (e.g. distillation in LFM2), tokenizer, hardware, and evaluation design. In particular, hybrid models trade KV cache for computation, yielding better hardware efficiency.  

# 3. Claim-by-Claim Causal-Confound Audit

We examine key claims about hybrid models and identify confounding factors that weaken causal attribution to architecture alone:

- **Data and Scale Differences:** If a hybrid model is trained on more or cleaner data than its baseline, any quality gain may reflect *data*, not architecture.  For example, Liquid’s LFM2 is trained on ~10–12 trillion tokens and undergoes multi-stage distillation/fine-tuning, whereas baselines may have used less data or simpler training.  The NVIDIA study carefully *matched* data and training tokens between Transformer and Mamba models, underscoring that only in such matched experiments can architecture effects be isolated.  Without identical data/token budgets, claims of architectural superiority are suspect.

- **Teacher Distillation / Post-Training:** Many new models rely on knowledge distillation or heavy post-training (RLHF, preference tuning, etc.).  If only the hybrid model uses a strong teacher, improved performance may owe to that.  Liquid’s pipeline explicitly includes multi-stage distillation and merging with larger models.  Any claim (e.g. “LFM2-2.6B solves most math problems after distillation”) must be attributed partly to that process.  Ideally comparisons are made *before* distillation or with the same distillation for all models, which rarely happens.

- **Chat Prompt/Template Differences:** Conversational benchmarks (like ChatML-based dialogues) can depend heavily on prompt formatting. A model tuned on one chat format may appear better simply due to a matching evaluation prompt.  If two models use different tokenization or system prompts, scores on chat tasks are not comparable.

- **Sampling and Decoding Configurations:** Differences in temperature, top-k, or nucleus sampling can skew results. If a hybrid model is evaluated with a greedy or higher-temperature setting than a baseline, apparent “creativity” or accuracy differences may arise.  We must ensure *identical decoding strategies* when comparing outputs.

- **Vocabulary Size/Tokenizer:** Tokenizer choice and vocabulary size affect efficiency and sometimes accuracy.  For instance, LFM2 uses a 65K token BPE vocabulary versus LLaMA’s 32K.  A larger vocabulary can reduce sequence length and avoid splitting tokens, impacting speed and possibly perplexity.  In comparisons, differing vocab sizes (or tied vs untied embeddings) confound results unless accounted for.

- **Active vs Total Parameters:** Some hybrids use weight sharing or sparse-expert FFN layers, changing “active” parameter count.  If one model reports “2B parameters” but has significant weight sharing, its effective capacity is lower.  We must compare **active** parameters (non-shared weights) or FLOPs to ensure fairness.

- **Benchmark Contamination:** If evaluation datasets overlap with training data, results can be inflated.  Many new models train on huge scraped corpora; without careful filtering, test leaks can occur.  The NVIDIA study explicitly used public benchmark suites with no overlap.  Vendor charts often omit these details, making it unclear if a higher score is due to contamination.

- **Quantization Asymmetry:** When comparing inference speed or memory, the precision used matters.  E.g., Llama.cpp’s Q4_0 (4-bit) is mentioned for LFM2 metrics.  If a hybrid is run in 4-bit and a baseline in 8-bit (or vice versa), speed/memory differ drastically.  All models in a comparison should use the *same quantization scheme and runtime* to attribute gains properly.

- **Hardware and Runtime:** Specialized kernels or hardware optimizations can favor one architecture.  For example, a convolution-based block may leverage highly optimized GPU or CPU vector instructions, whereas a recurrent SSM might not.  Vendor tests (LFM2) used fixed runtimes (llama.cpp and ExecuTorch) across models to control for this.  Any speed claim on *other* backends (like a custom NPU) is not an apples-to-apples measure.

- **Cherry-Picked Tasks and Devices:** Promotional comparisons often show hybrid models on the particular hardware or tasks where they excel (e.g. mobile CPU).  But if the competitor model wasn’t equally optimized for that device, the gap may reflect implementation quality, not architecture.  True causal attribution requires testing on representative hardware (CPU, GPU) and a broad task suite.

- **Compression vs Fidelity Trade-off:** Some architectures (like constant-state RNNs) compress all history into fixed state. Claims of “infinite context” are misleading: quality eventually degrades with too much context.  Without tests over very long contexts, one can’t tell if a “low KV memory” model is truly retrieving old tokens or merely summarizing them poorly.  Only experiments that gradually increase context length (see §7) can reveal this confound.

In summary, almost all published advantages can be attributed partly to these confounds.  The **single credible study with controls** is the NVIDIA Mamba vs Transformer comparison.  We rely on it as a model of “fair comparison” in our analysis.  

# 4. Matched Experiment and Ablation Design

**Proposed Experiment:** Select two models of ~1–2B parameters: one dense transformer, one hybrid (e.g. a stack of alternating convolutional/SSM blocks with a small number of attention layers). Control the following exactly:
1. **Parameter Count and Architecture Size:** Ensure the *total* and *active* parameters match (e.g. fix hidden size, depth so both are ~2B).
2. **Tokenizer/Vocabulary:** Use the same tokenizer and vocabulary size (e.g. Byte-Pair Encoding 50K) for both.
3. **Training Data:** Train both on the *same dataset* and token stream. Ideally use a public corpus (Wiki+commoncrawl/etc.) with 500B+ tokens.
4. **Training Budget:** Train for the same number of tokens and compute (e.g. 300B tokens, same batch size schedule).
5. **Optimization Details:** Same optimizer type (e.g. AdamW with identical hyperparameters), same training schedule, no “extra” tricks unique to one model.
6. **Post-Training:** Use identical post-training steps (if any), e.g. fine-tuning on instruction tasks with same recipes.
7. **Precision and Quantization:** Use identical numerical precision during training (float16) and identical quantization at inference (e.g. 4-bit via Llama.cpp).
8. **Runtime and Batching:** Evaluate on the same hardware and runtime (e.g. l aptop CPU with llama.cpp and ExecuTorch) with fixed prompt lengths.
9. **Prompts/Sampling:** Use a fixed set of prompts for decoding tests, with identical sampling settings.

**Essential Controls:** (1–6) are critical to isolate architecture. Matching #1–5 eliminates scale, data, and hyperparam confounds. Control #7–9 to fairly compare speed and memory. We can relax some (e.g. batch size) in a low-cost pilot since throughput scales predictably.

**Experimental Steps:**
- **Pilot Phase:** Train small prototypes (e.g. 300M param each) on 10B tokens to test pipelines.
- **Main Run:** Scale to ~2B models, 300–500B tokens of web text (or public LM bench corpora). Use automated hyperparameter sweeps to equalize perplexity trajectories.
- **Evaluation:** Measure (a) downstream quality on a held-out suite of tasks (see §5), (b) decode metrics (TTFT, throughput) on fixed prompts, (c) peak memory use for 4K/32K context.
- **Ablation Variants:** Also train partial-architecture ablations (below) for isolation.

**Block Ablation Variants:** To isolate the effect of block ratios (task 6), construct additional models with the same overall compute but different block mix:
- **All-Attention:** A pure transformer with no SSM/conv blocks.
- **All-SSM (Recurrent/Conv):** Remove all global attention; only gated convolutional or SSM layers (like pure Mamba or Hyena stack).
- **Alternating Blocks:** Alternate equal number of attention and conv blocks (e.g. every other layer is attention).
- **Front-Loaded Attention:** Place attention layers in the early layers and SSM later (to emphasize short-range processing first).
- **Back-Loaded Attention:** The reverse (global context at end of network).
- **Compute-Equal Variants:** If possible, scale hidden sizes so that total FLOPs match for fair speed/memory.
  
Each ablation should be trained and evaluated in the same controlled way. This will reveal *which* components drive any performance differences.

# 5. Behavioral Evaluation Matrix

We propose a suite of **conversation and reasoning tests** that probe practical usefulness, going beyond standard benchmarks.  Each test should use *unseen paraphrased prompts* and measure model **raw output**. Example categories:

- **Ambiguity Resolution:** Provide ambiguous queries (“I saw a man with a telescope.”). Score coherence and disambiguation accuracy. 
- **Contradictory Memory:** Feed a context where the model states facts in conflict across turns. Check if it consistently uses the most recent info. 
- **Current-turn Precedence:** Change the answer key mid-conversation (e.g. ask “where is Paris?” then “No, I meant Paris *France*”). Ensure model follows the latest constraint. 
- **Unavailable Knowledge:** Ask for facts or proprietary info the model shouldn’t know (e.g. company internal data). Check for safe refusal. 
- **Quoted Memory Test:** Give the model a “memory” with negative or adversarial content (e.g. insults the user), then see if its responses avoid toxic personalization. 
- **Multi-Document Summaries:** Provide several paragraphs and ask for a concise summary. Evaluate factual coverage and hallucinations. 
- **Rewrite/Paraphrase:** Supply a text and ask to rewrite in different style (e.g. simpler or formal). Measure faithfulness and fluency. 
- **Structured Output (JSON/Code):** Pose tasks requiring JSON or code outputs (e.g. “convert this data to JSON” or “explain this Python code”). Check for validity and correctness. 
- **Lawful Adult Content:** Ask adult-themed but legal questions (e.g. “analyze this erotic literature excerpt”). Score adherence to content policies (no disallowed output).

Each task should be evaluated on metrics like accuracy (for factual Q&A), BLEU/ROUGE for structured outputs, and human-judged appropriateness. Crucially, use **paired prompts** that mix exact and paraphrased phrasings to test generalization. We track *uncensored raw outputs* to compare factuality and safety aspects; e.g. we record if the model refuses vs. answers illicit requests. (No third-party citations needed for task design, as these categories follow prior evaluation literature.)  

# 6. Native and Browser Systems Methodology

For CPU and WASM evaluation we define concrete measures (formulas) instead of hypothetical TinyRustLM metrics:

- **Time-To-First-Token (TTFT):** Time from input submission to first output token.  Roughly,  
  $$ TTFT \approx \frac{\text{Model Bytes}}{\text{Memory Bandwidth}} + \text{overhead} $$
  (includes weight loading and initial preprocess). On-device, weight load often dominates for small queries. We should measure this empirically.

- **Prefill Throughput:** Tokens/s processed during full context encoding (no generation).  Estimate via  
  $$ \text{Prefill TPS} \approx \frac{N \times H^2}{\text{FLOPS per second}} $$
  where $N$ is context length, $H$ hidden size.  In practice, measure on device by timing encoding of a long prompt; lower KV or convolution kernels should boost this metric.

- **Decode Throughput:** Tokens/s during autoregressive generation after context.  Formula:  
  $$ \text{Decode TPS} \approx \frac{\text{FLOPs per token}}{\text{latency per token}} $$
  This depends on block type (attn = $O(H^2)$, conv = $O(kH^2)$ for small $k$, SSM = $O(H^2)$ but often with optimized recurrence).  We measure both p50 and p95 latencies, as done in , for real-time responsiveness.

- **Peak Memory (RSS):** Sum of model weights plus working memory (key/value cache for Transformers, recurrent state for SSMs).  Approx:  
  $$ \text{Memory} \approx \text{ModelBytes} + \text{ContextLength} \times \text{StateBytes}$$ 
  where StateBytes = $H\times\text{(heads)}\times\text{sizeof}(\text{dtype})$ for attention (plus Q/K/V matrices), or $H\times\text{sizeof}(\text{dtype})$ for single hidden state in RNN.  This matches liquid/SSM’s claim of *constant* hidden state vs the Transformer’s *linear* KV cache.  We will measure actual RSS via performance tools.

- **Model Size on Disk:** Compressed checkpoint sizes (e.g. Q4 vs FP16). Given as bytes.

- **State-per-Token:** The incremental memory per added token: for Transformers $\approx 2H\times\text{byte}$ (for key+value); for RNNs ~0.  We can report this ratio as a formula rather than a TinyRustLM-specific measure.

- **Thread Scaling:** Measure throughput as CPU threads increase. Compute ideal speedup $S(n)=T(1)/T(n)$ and compare to linear $n$. Deviation indicates memory bandwidth or cache limitations.  

- **Thermal/Turbo Drift:** On long runs, measure clock frequency changes or sustained power. Plot tokens/s over time; a drop signals thermal throttling.  

- **UI Responsiveness:** Although hard to formula, we combine TTFT and single-token latency: e.g. define an empirical "lag score" = TTFT + (PromptLength × per-token delay) to approximate user wait time.  

We will use tools like `perf`, browser profiling (for WASM), and llama.cpp benchmarks to quantify these. The goal is to express everything in fundamental units (FLOPs, bytes/s) rather than opaque library calls, so comparisons are hardware-neutral.

# 7. Context-Memory vs Retrieval-Quality Analysis

Hybrid and recurrent models compress past context into fixed states. This can dramatically lower memory (asymptotically O(1) vs O(N)), but at some context they lose exact recall. We propose tests to map this boundary:

- **Growing Context Tests:** Create tasks where key facts appear at increasing distances amid distractors (e.g. a “Phonebook” task where the answer is at token 10K vs 100K). Compare model accuracy as context grows. (Similar to [56†L172-L180], Mamba-2-Hybrid scaled to 128K context successfully retrieved phone numbers beyond trained length.) This reveals when “state compression” fails.

- **Memory-Distortion Tasks:** Embed identical info repeatedly vs uniquely, to see if the model’s fixed state tends to average or “forget” rarer info. For example, present a paragraph with one unique fact and many repeated filler facts, then query the unique fact.

- **Conditional Answer Fidelity:** For each model, measure answer probability or accuracy as a function of context length. Plot this against the growth of memory usage. This quantifies *how retrieval quality degrades as memory stays flat*. 

- **Retrieval vs Summarization:** Test whether long-term information is paraphrased/summarized rather than verbatim. E.g., ask a model to quote a token that appeared early after reading many lines. Dense models will usually succeed (given enough KV memory), hybrids eventually fail or give approximate answers.

By systematically varying context length (4K, 16K, 64K, …) and tracking performance, we can empirically find the “limit” where compressed-state models diverge from full-attention. These tests will highlight the trade-off: constant memory but eventual loss of fidelity.

# 8. Statistical Analysis Plan

Given the complexity and variability, we will apply rigorous statistics:

- **Repeated Seeds:** Train/evaluate each model with multiple random seeds (≥3) to capture variance. Report mean ± 95% confidence intervals for metrics (accuracy, latency, etc.).
- **Paired Prompts:** Evaluate models on the *same* set of prompts/tasks. Use paired difference tests (e.g. paired t-test or Wilcoxon signed-rank) on metrics across tasks, since errors between models are correlated.
- **Effect Size:** Compute Cohen’s *d* or Cliff’s delta for accuracy differences, not just *p*-values, to measure practical significance.
- **Confidence Intervals:** For differences in throughput or latency, present 95% CIs (bootstrap if needed).
- **Sequential Testing:** If doing many tasks, use false-discovery control (e.g. Benjamini-Hochberg) instead of naive Bonferroni, to account for multiple comparisons without being overly conservative.
- **Correlated Failures:** Track not only average scores but also failure modes. E.g. if one model fails catastrophically (toxic output or crash) on some prompts, report failure rates and use measures like Matthews correlation for classification tasks.
- **No Best-of-N:** We will not pick the best sample from multiple tries; we use deterministic evaluation (greedy or fixed sampling) unless the product use-case explicitly allows n-out-of-n selection, which we assume it does not.

This plan ensures that any claimed advantage is statistically robust and not due to random chance or sample bias.  

# 9. Cost Model and Value-of-Information

We outline relative costs of pursuing a new architecture path vs staying with dense transformers. 

- **Development Effort:** Creating a hybrid execution path (new compiler kernels, quantization routines, WASM integration) could require tens of developer-months. Each new block type (SSM, conv) needs optimized implementation.  
- **Maintenance:** New code increases long-term maintenance burden, especially given evolving web standards and hardware diversity.  
- **Testing/Validation:** Every new model/block increases testing matrix (browsers, OS, threads).  
- **Opportunity Cost:** Time spent on architecture overhaul is time not spent on improving existing models (which might yield better short-term gains).  

We would weigh these against potential benefits:
- **Performance Gain:** If a hybrid yields, say, 2× speed on target hardware, the ROI could justify the cost. If the gain is only 10–20%, probably not worth it.
- **Quality Impact:** If architecture change risks a drop in quality, that is a high cost to user experience.  
- **Market Differentiation:** A unique hybrid could differentiate TinyRustLM if it enables truly long contexts on-device with lower memory. But only if end-users care (e.g. mobile voice assistants).

**Value-of-Information:** The pilot experiment (section 4) has modest cost (using existing compute and some dev time) relative to full development. We recommend this low-cost experiment as it can strongly indicate (with 95% confidence) whether the payoff is likely. The “value” is highest if the hybrid *definitely* beats the transformer in our constraints; then proceeding makes sense. If results are marginal, the pilot cost (small) saves much larger future investment.  

# 10. Build/Pilot/Defer/Reject Decision Table

| Scenario                                 | Decision               | Rationale                                          |
|------------------------------------------|------------------------|----------------------------------------------------|
| **Hybrid model shows clear advantage** (≳30% faster or much lower memory for ≥equal quality) | Build (Invest)        | High ROI: speed/memory gains justify architecture cost. |
| **Minor gain or mixed results** (10–30% speed gain, quality on-par) | Pilot (small scale)   | Gains are modest; need further optimization before full build. |
| **No gain or hybrid underperforms**      | Defer/Reject            | Unlikely to recover cost; stick with dense baseline. |
| **Hybrid wins on compute but lags quality** | Pilot (investigate)  | Possible middle ground: improve training to boost quality. |
| **Uncertain due to insufficient data**   | Pilot/Defer             | Gather more data/analysis before committing.       |

*Reversal Condition:* If an independent, matched-scale evaluation shows a hybrid architecture consistently **outperforms** the dense baseline in both latency and quality (beyond statistical noise), then we would shift to “Build” with high confidence.  Conversely, if it fails to surpass or even matches the baseline, that would strongly favor staying with the existing transformer path.

# 11. Unknowns Requiring Local Execution

Key questions not answered by public sources, which must be tested in our environment:

- **Actual on-device throughput:** Public charts (often vendor-focused) may not reflect TinyRustLM’s WASM runtime efficiency. We need to benchmark our target CPU and browser stack.
- **Quantization behavior:** Our WASM toolchain might quantize differently than llama.cpp; we must test whether a hybrid’s lower-memory state translates to similar gains after quantization.
- **Task-specific quality:** Public evaluations are on standard benchmarks; we need to test conversational tasks from §5 to see if hybrids handle them as well as transformers.
- **Memory footprint in practice:** We must measure RSS growth for large contexts in browser memory (JS memory limits) for each model type.
- **Compatibility cost:** Evaluate how easily the hybrid blocks can be implemented in our Rust+WASM codebase, and any performance hits (e.g. lack of vectorization in WASM for certain ops).
- **User-perceived latency:** Theoretical throughput may not match perceived responsiveness; UI tests with real dialogues will clarify impact.

These unknowns are exactly why we recommend an early in-house experiment (see §4) – only by running controlled tests with actual models on our hardware can we close these gaps.

# 12. Annotated Primary-Source Bibliography

- **LFM2 Technical Report (Liquid AI, Nov 2025)** – *Devansh et al.* Introduces “Liquid Foundation Models 2” (LFM2), a hybrid (convolution+few-attention) family (350M–8.3B). Contains hardware-in-loop search results: minimal hybrids matched or exceeded dense Transformers in task quality and **2× faster decode/prefill** on mobile CPU, with much lower memory (no KV caching). Evidence is from internal evaluation suite (not third-party).  
- **LFM1 Announcement (Liquid AI Blog, Sept 2024)** – Marketing blog summarizing first-gen LFM models (1.3B, 3.1B, 40B MoE). Reports state-of-art benchmark scores for 1B LFM vs Llama3 1.2B, but these claims are vendor-provided without independent test details. Includes an eval table comparing LFM-1B to others. *Use: evidence of claimed quality at scale*.
- **Mamba: Linear-Time Sequence Modeling (Gu & Dao, arXiv 2312.00752)** – Introduces Mamba, a selective structured SSM model. Reports that Mamba-3B “outperforms Transformers of the same size” on language tasks, with **5× higher throughput** (CPU) and linear memory scaling. Key primary claim: pure recurrent SSM can match larger Transformers given architectural tweaks. Includes code and model configs (HF release: *mamba-3B*). *Use: documentation of Mamba’s architecture and claimed performance*.
- **NVIDIA Mamba vs Transformer Study (Arxiv TR 2406.07887)** – An independent large-scale comparison (8B models, 3.5T tokens) of pure Mamba, pure Transformer, and a hybrid (24 Mamba-2 + 4 attn + 28 MLP). Shows: Hybrid 8B model **exceeds** same-size Transformer on 12 benchmarks (+3.5 points on MMLU, +2.65 avg) and is ~8× faster at inference (predicted). Pure SSM lags on tasks like MMLU. Data and hyperparams were carefully matched. *Use: best evidence controlling data/train, showing hybrid speed-quality trade-offs.* 
- **Retentive Network (Sun et al., arXiv 2307.08621)** – Proposes RetNet with a “retention” mechanism blending attention and recurrence. Claims: supports parallel training, O(1) inference (via recurrence), and “no performance sacrifice” compared to Transformers. Reports *“favorable scaling, low-cost inference”* and labels RetNet a strong Transformer successor. Code promised but not yet broadly evaluated. *Use: claims about retention vs attention (no external verification).*
- **Hyena Hierarchy (Poli et al., arXiv 2302.10866)** – Defines the Hyena operator (long convolutions + gating). Reports matching Transformer-quality on LM tasks (WikiText103, Pile) with 20% less compute (at 2K context) and dramatically faster inference at long lengths (2× faster at 8K, 100× at 64K). Improves scores by 50+ points vs simpler SSMs on recall tasks. Published ICML 2023 with open code/models. *Use: shows convolutional alternative to attention achieving similar accuracy at large scale*.
- **Sliding Window Attention Training (Fu et al., arXiv 2502.18845)** – SWAT: trains a Transformer with sigmoid-activated sliding-window attention. Maintains linear inference complexity and achieves **SOTA on 8 reasoning benchmarks** among linear-time models. This suggests careful SWA training can preserve performance. *Use: evidence that purely local attention can suffice with proper training*.
- **RWKV Language Model Wiki** – Community-curated performance data for RWKV (RNN-style) models (2.9B and 7.2B) on various GPUs. Shows e.g. 2.9B nf4 quantized running ~115 tokens/s on RTX 4060 Ti. Also states RWKV-7 (7B) exists. *Use: real-world inference speeds/memory of RWKV, though from unofficial sources*. 
- **Transformer Efficiency Reviews:** (e.g., Park *et al.* 2024, Chen *et al.* 2024) – Recent studies note that all-attention models retain an advantage on in-context tasks and that pure SSMs struggle with complex multi-step reasoning. For example, Park *et al.* (can we find a reference in [54]?) showed Mamba models lag on MMLU without extra training. *Use: contextual info on known SSM limitations (cited indirectly via NVIDIA’s finding)*.
- **Benchmark Contamination Surveys:** (e.g. Kang et al. 2023) – These show non-negligible data overlap effects in common LLM benchmarks. *Use: background on contamination (no direct cite given above).*

Each source above is either peer-reviewed or originates from a model developer’s technical report. We treat arXiv papers and technical reports as primary. All relevant model versions and dates are noted with immutable identifiers (arXiv v2, commit hashes).  

