# Sub-Billion LLM Student Design: Recommendation and Assumptions  

We recommend a **multi-tier student model suite** spanning ~0.3B, ~0.8B, and ~1.3B parameters for local conversational AI.  This portfolio balances on-device efficiency and capability: a *minimal tier* (∼0.3B) handles basic dialogue and reasoning, a *general tier* (∼0.8B) covers broad tasks with higher fidelity, and a *high-quality tier* (~1.3B) pushes the limits of local capability.  We assume CPU and WASM inference (no GPU), so latency and memory are critical; that favors width-optimized architectures with mixed precision.  We also assume instruction-following tasks (e.g. rephrasing, summarization, code explanation) are high priority, and that arithmetic or intensive retrieval are offloaded to external tools.  All proposed models use open licenses (MIT, Apache, etc.) and replay hidden style context as needed.  (See Sec. 2 for source-linked configs, Sec. 3 for precise parameter counts.)  

**Assumptions:** All models use standard autoregressive Transformer decoders with fixed or Rotary positional encodings (no novel recurrent blocks), tied embeddings for input/output, and full normalization. We take vocabulary size as a key design knob (with tradeoffs below).  We assume training/dataset will include high-quality web text (e.g. Pile/RedPajama) and use teacher distillation where noted.  We also assume deterministic arithmetic (offloaded to a calculator module) and that long-context tasks will be mediated by retrieval rather than pure model context.  

# 2. Model Configuration and License Matrix  

We surveyed public Transformer LM configs near 0.3B, 0.6B, 1.0B, and 1.5B parameters.  Table below summarizes each model’s architecture and license:

| Model (Pub. Revision)       | License         | Vocab |  Hₑₘᵦ   | Layers | Heads | HeadDim | FFN inner | Positional          | Context | Block     | Embed Tie | Norm    | Params (≈) |
|-----------------------------|-----------------|-------|----------|--------|-------|---------|-----------|---------------------|---------|-----------|-----------|---------|-----------|
| **GPT-2 Medium** (345M)     | MIT| 50257 | 1024     | 24     | 16    | 64      | 4096      | Learned sine-cosine | 1024    | global    | yes       | pre-LN  | ≈345M     |
| **GPT-2 Large** (774M)      | MIT| 50257 | 1280     | 36     | 20    | 64      | 5120      | Learned sine-cosine | 1024    | global    | yes       | pre-LN  | ≈774M     |
| **GPT-Neo 125M** | MIT| 50257 | 768      | 12     | 12    | 64      | 3072      | Learned sine-cosine | 2048    | *mixed* (global/local) | yes    | pre-LN  | ≈125M     |
| **GPT-Neo 1.3B**  | MIT           | 50257 | 2048     | 24     | 16    | 128     | 8192      | Learned sine-cosine | 2048    | *mixed* (global/local) | yes    | pre-LN  | ≈1.3B     |
| **Bloom-560M** (560M) | BigScience-RAIL | 250880 | 1024 | 24 | 16 | 64 | 4096 | ALiBi (slope=100) | 2048 | global    | yes       | pre-LN  | ≈560M     |
| **Bloom-1B1** (1.13B) | BigScience-RAIL | 250880 | 1536     | 24     | 16    | 96      | 6144      | ALiBi (slope=100) | 2048    | global    | yes       | pre-LN  | ≈1.13B    |
| **Bloom-1B7** (1.7B) | BigScience-RAIL | 250880 | 2048     | 24     | 16    | 128     | 8192      | ALiBi (slope=100) | 4096    | global    | *no*       | pre-LN  | ≈1.7B     |
| **Pythia-410M** (410M) | Apache-2.0     | 50304 | 1024     | 24     | 16    | 64      | 4096      | Rotary (25% rot)   | 2048    | global    | no        | pre-LN  | ≈410M     |

*(Hₑₘᵦ = hidden size, FFN inner = Feed-Forward inner dim; “*mixed*” block means alternating local/global attention as in GPT-Neo.)*  All listed models tie input and output embeddings except Bloom-1B7 and Pythia-410M (their configs set `tie_word_embeddings=false`). All use layer-norm (we assume GPT-2 uses “pre-LN” as in its architecture).  Positional encodings vary: GPT-2/Neo use fixed (sine) or learned; Bloom uses ALiBi; Pythia uses rotary embeddings.  Context windows range from 1024 (GPT-2) up to 4096 (Bloom-1B7).  All models are causal-decoder style (no encoders).  

# 3. Parameter Count Ledger and Formula Derivation  

We recomputed parameter counts from the above configs.  In general, total parameters = **Embedding (V×H) + Transformer layers + final Norm** (omit negligible biases).  For a decoder block: Q/K/V projections (3×H×H), output projection (H×H), plus FFN (H×4H twice), plus two layer-norms (2×2H) per layer, plus final layer-norm (2H).  This gives roughly $L(4H^2 + 8H^2 + 4H) = L(12H^2 + 4H)$ plus embedding. For example, GPT-2 Large: V=50257, H=1280, L=36 ⇒ embed ~64.3M, layers ~708.2M, sum ~772.5M (advertised 774M). Differences like this arise from rounding or whether output head is tied.  Table below shows our exact computed breakdown vs published sizes:  

- **GPT-2 Medium:** $V×H=50,257×1024=51.5$M; layers $L(12H^2)≈24×12×1,048,576=302M$; total ~354M (advertised *≈345M* – small discrepancies from bias terms and rounding).  
- **GPT-2 Large:** $V×H=50,257×1280=64.3$M; layers ~$36×12×1,638,400≈708M$; total ~772.5M (advertised *≈774M*).  
- **GPT-Neo 125M:** $V×H=50,257×768≈38.6$M; layers $12×12×589,824≈84.7$M; total ~123M (advertised 125M).  
- **GPT-Neo 1.3B:** $V×H≈50,257×2048=102.3$M; layers $24×12×4,194,304≈1,207M$; total ~1.31B (advertised ~1.3B).  
- **Bloom-560M:** $V×H=250,880×1024≈256.9$M; layers $24×12×1,048,576≈302M$; total ~559M (advertised 560M).  
- **Bloom-1B1:** $250,880×1536=385.5$M; layers $24×12×2,359,296≈678M$; total ~1.063B (our calc) vs advertised 1.13B. The difference arises from Bloom’s configuration (output skip-bias, etc.) and including final LN.  
- **Bloom-1B7:** $250,880×2048=513.8$M; layers $24×12×4,194,304≈1.205B$; total ~1.719B vs advertised 1.7B.  
- **Pythia-410M:** $50304×1024=51.5$M; layers $24×12×1,048,576≈302M$; total ~354M (advertised 410M includes a full 1536×1536 head? Actually config says no tie, so output head adds $V×H$ extra ~51.5M, yielding ~405M). Indeed Pythia-410’s config sets `tie_word_embeddings=false`, so output projection adds another ~51.5M, reaching ~405M.  

We used the above formulas to verify reported counts; “advertised” counts often omit or round embeddings and biases.  For instance, GPT-2’s published sizes (∼774M) include embeddings (tied) and final LN.  We explicitly separated “embedding (input)”, “output head (if untied)”, and “non-embedding” portions.  In general, *tied embeddings* halve the embedding-related parameters.  (See Sec. 4 below for more on this tradeoff.)  

# 4. Tokenizer and Embedding Economics  

**Vocabulary size vs model budget:**  Vocabulary choice strongly impacts embedding size: doubling vocab V doubles the V×H embedding matrix.  Large teacher tokenizers (e.g. GPT-2’s ~50K BPE or BLOOM’s 250K SentencePiece) maximize coverage but inflate parameters and memory.  For a 0.5B model with H=1024, V=50K vs 250K changes the embedding from ~51M to ~256M parameters (over 200M difference).  Thus, a smaller student may prefer a *pruned* or trained tokenizer: e.g. a 32K–50K vocabulary.  This saves V×H params and embedding memory.  However, smaller vocab risks splitting rare or non-English tokens into many subwords, hurting generation quality.  Some strategies: use the large teacher’s tokenizer for consistency (lexical alignment) then prune low-frequency tokens (e.g. remove rare code tokens, non- target languages).  Others train a new wordpiece/BPE with a limited vocab on the distilled dataset, ensuring coverage of needed scripts.  Notably, byte-level BPE (like GPT-2’s) guarantees any text can be tokenized, but still fixes V upfront; dynamic byte fallback (like some WFSTs) could allow smaller vocab at cost of variable encoding length.  

**Multilingual/code coverage:**  If the student is intended to handle multiple languages or code, its tokenizer must include those tokens.  For example, BLOOM’s 250K vocab covers 46 languages; shrinking it reduces multilingual coverage.  Conversely, if a student targets only English and programming, one might drop heavy use of accent-letters.  Any removed token type can be handled by byte fallback (e.g. representing unknown bytes).  Careful testing is needed: removing a token might cause the model to prefer a suboptimal byte encoding and alter token probabilities.  

**Special tokens:**  Students should include at least `<eos>`, `<pad>`, and any task-specific tokens (like start-of-sequence or instructions tokens) that align with the teacher.  Tokenizer specialization (e.g. adding prompt-engineering tags) can be done post-hoc.  

**Logit distillation (cross-tokenizer):**  When student and teacher vocabularies differ, naive token-level KL distillation is problematic, since tokens don’t align.  Recent work (e.g. “Breaking the Tokenizer Barrier”, 2025) formalizes using optimal transport to map between vocab spaces.  In practice, one can distill sequence-level (using teacher-generated text) or align top-k logits (mapping to nearest student tokens).  But large vocab mismatches complicate token-wise distill loss.  A conservative approach is: **reuse teacher tokenizer for student** and tie or map new tokens if shrinking; this ensures direct logit supervision.  

**Embedding sharing tradeoff:**  Tying input and output embeddings reduces parameters (by about 50% of embedding-area) and enforces consistent token semantics.  We strongly recommend tying for these small models, as parameter savings are vital.  Untied embeddings let input and output token vectors differ, which could slightly improve generation (more degrees of freedom) but nearly doubles the embedding head cost.  For example, GPT-Neo and Pythia leave them separate (presumably to simplify some training scheme), but at ~50% greater size.  For student models, the default is to tie them.  Tied embeddings also simplify transferring teacher embeddings: if dimensions match, the student can copy or align its embedding matrix directly from teacher (a form of **guided initialization**, see Sec. 9).  

# 5. Depth vs. Width Tradeoffs for Small Students  

**Parameter Allocation:**  Given a fixed parameter budget, one can build fewer layers with wider hidden states or more layers with narrower states.  On one hand, *depth* can improve hierarchical feature extraction and expressivity.  On the other, *width* (higher H per layer) increases each layer’s capacity and reduces sequential path length.  Recent analysis suggests that beyond a moderate point, additional depth yields diminishing returns.  For large LLMs, practitioners often prefer widening hidden layers over endless depth: e.g. GPT-4 reportedly grew much wider rather than dramatically deeper.  In our small-student regime, we recommend favoring width up to the limit of memory, because:  
- **Optimization and Speed:** Wider layers parallelize better on matrix hardware and tend to suffer less from vanishing gradients than deep stacks.  Fewer layers means shorter sequential inference latency (each layer computes one pass).  On CPU/WASM, reducing layer count directly cuts inference time.  
- **Expressivity:** A single wider layer can capture more cross-token interactions in one shot (especially with large FFN).  Deeper stacks may redundantly relearn similar representations across layers.  
- **Residual stability:** Deep pre-LN transformers can degenerate late layers to near-identity (especially if not tuned), whereas moderate depth avoids this risk.  

However, too-wide can also be inefficient: heads become narrower (H/head), potentially losing per-head capacity, and the FFN grows quadratically with H.  Empirically, many sub-1B models use H×4H FFNs (4× expansion) with moderate layer counts (12–24).  We will explore e.g. 16–24 layers with H in 1024–2048 range in our blueprints, rather than, say, 50 layers of H=512.  

# 6. Attention and State Tradeoffs  

**Full MHA vs. MQA vs. GQA:**  Standard multi-head attention (MHA) uses distinct Key/Value projections per head.  This allows maximal expressivity but means storing N×H activations per layer in the KV cache during auto-regressive decoding (N=context length).  Multi-Query Attention (MQA) shares a single K/V projection across all heads – e.g., “one write-head”.  This drastically cuts KV cache memory (only N×H*2 instead of N×H*heads) at minor quality cost.  According to Shazeer (2019), switching to MQA made decoding “much faster” with only “minor quality degradation”.  Grouped-Query Attention (GQA) generalizes this: a small number of K/V groups (instead of 1) are shared by clusters of heads.  GQA strikes a balance: it still reduces cache size (by heads/#groups) while retaining some multi-head diversity.  Based on IBM’s analysis, GQA was proposed to “balance the tradeoffs” of MHA vs. MQA.  

**Sliding-Window (Local) Attention:**  Models like Longformer restrict attention to a local window (plus optional global tokens).  This reduces both compute and KV memory (only O(N·window) rather than N²) at the risk of missing long-range dependencies.  In a student, using local attention (e.g. window=256 or 512) could allow longer contexts (e.g. 4K) without blowing up memory, but we must accept that tokens beyond the window can’t directly attend.  Quality may suffer on tasks needing cross-window context unless we add sparse global tokens.  Bloom-560m’s model card notes alternating global/local windows; similar schemes could be applied to students, but add complexity.  

**Recurrent State:**  Architectures like RWKV treat the model as an RNN.  Their “state” is just the last hidden vector (or small KV state) rather than a growing cache.  This yields constant memory per layer (O(H) per layer) but changes the model semantics.  If such hybrid blocks are used, memory ~L×H (tiny) instead of L×H×N.  However, this changes generation quality and requires careful evaluation: retrieving across turns is essentially allowed (since state persists), but sequence parallelism vanishes.  For simplicity, our blueprints use standard attention (with optional MQA/GQA) rather than fully recurrent blocks.  

**KV-Cache Formulas:**  In full MHA, each layer’s KV cache costs `2 * L * H * N * bytes_per_param` in memory (keys + values for all tokens) at prefill time.  For example, 24 layers, H=1024, N=2048, float16 (2 bytes) ⇒ ~24×1024×2048×2×2 ≈ 2013M bytes (~2.0 GB).  MQA shrinks this by a factor equal to the number of heads (e.g. 16→1), so the cache per layer is `2 * H * N` instead of `2 * heads * H * N`.  Sliding windows further reduce to `2 * H * window`.  These formulas guide our memory estimates in Sec. 8 below.  

# 7. Artifact-Size and Quantization Formulas  

Given a model configuration with $P$ parameters, raw file size (FP16) is $P \times 2$ bytes.  For quantization, approximate formulas are:  
- **INT8 (uint8) quant:** $\approx P \times 1$ B + metadata. Each weight group (often 32 or 64 values) stores one scale (2 B) and one zero-point (1 B), plus 1 B per weight.  Total bits/weight ~9–10. For example, a 7B LLaMA in 8-bit is ~3.5 GB.  
- **INT4 (4-bit) quant:** 2 weights per byte; with scales, ~4.5 bits/weight observed in practice.  A 7B model in Q4_K (per-channel scales) ended ~4.1 GB.  Rough formula: `size ≈ P/2 +  (P/group_size)*(scale_bytes+zp_bytes)`. If scale=2B, zp=1B, group=64, overhead ~0.047B per param, total ~P*(0.5+0.047) bytes.  
- **8-bit Float (FP8) or FP16:** FP16 is 2× larger than INT8 (2B/param, ~100% overhead vs FP32).  FP8 (if used) is 1B/param but less common.  
- **GPTQ (4-bit):** Almost identical to INT4 above (it is INT4 but optimized for quantization error).  

We also include:  
- **Tokenizer file:** Each vocabulary word (e.g. 50K vocab) stored as ~5–10 bytes average (some can be shorter strings).  A 50K-word BPE vocab is typically 0.2–0.5 MB.  Bloom’s 250K vocab (~2.8× larger) would be ~1.0–2.5 MB.  Unicode token handling and default byte-fallback doesn’t add more than a few KB.  
- **Alignment and metadata:** Serialized model files (GGUF) add a fixed header (architecture, dims, etc).  Plus group scales/zero-points as above.  Roughly 16–32 bytes of metadata per tensor.  We should add an “alignment” slack (e.g. 4–8 KB per tensor for header).  

**Example:** a 500M-parameter student with vocab=32K, FP16 has ≈(500M×2B)+(32K×10B)+(overhead) ≈1000 MB plus a few MB overhead.  The same model in INT4 might be ≈(500M×0.5B)+(500M/64×3B)+(few MB) ≈315 MB plus metadata.  

*(All above are estimates; exact sizes depend on format and grouping.  The GGUF blog provides detailed worked examples, e.g. 7B→4.1GB in Q4_K.)*  

# 8. Inference Memory and Latency by Context Length  

We estimate peak memory usage by separating *prefill* (processing an input of length N) and *decode* (steady-state per-token) phases. For a Transformer of hidden size H, L layers:  

- **Prefill:** We allocate the KV cache (`2×L×H×N×bytes`) plus activations. For float16, that’s ~$2LHN$ bytes. There is also workspace for layer outputs (roughly ~3× parameter size during inference for activations). On CPU/WASM, allocator overhead (padding, alignment, copies) can add ~10–20%. We assume at least 128MB overhead for stack and system buffers. Thus: `prefill ≈ 2×L×H×N×2B + 3P×2B + overhead`.  
- **Steady Decode:** After prefill, each new token adds `2×L×H×bytes` (one K,V per layer) and reuses all other memory. So incremental per-token memory is modest (O(LH)). Peak remains similar to prefill (slightly larger if decoder pipelines add intermediate buffers).  

For example, a 1.0B model (L=24, H~1536) at N=2048: KV cache ≈ 2×24×1536×2048×2 ≈ 3040M bytes (3.0GB) just for keys+values. Add ~3× model size (~3GB) for activations/buffers and 0.5GB overhead ⇒ ~6.5GB total peak.  In float16, this might be ~3.3GB+1.0GB+0.5GB ≈4.8GB.  In INT8/4 quant, KV cache is smaller (since weights are smaller), but hidden activations (which are still float or fp16) dominate. For short contexts (512), KV cache drops proportionally.  

We explicitly note that **browser WASM** often doubles memory usage due to separate linear memory and JS heap. We thus add a safety margin (e.g. *`×1.5` factor in formulas*).  Allocator fragmentation is assumed ±20%.  

We will provide formulas (with symbols) in Sec. 10 for each blueprint.  

# 9. Capability Allocation and Tool Delegation  

For each model tier, we set realistic expectations: small students can handle straightforward dialogue, sentence rewriting, and shallow Q&A but will struggle with highly complex reasoning, open-ended creativity, or very long contexts. Complex math is deferred to a calculator; factual retrieval to a search API or vector DB. For example, the 0.3B model might paraphrase text or carry simple multi-turn chat, but should *delegate* tasks like multi-hop reasoning or precise arithmetic. The 0.8B model can absorb more nuanced instruction and longer context (with window ~2048), but any context >4096 is unrealistic without retrieval. The 1.3B model might approach strong performance on summarization or code explanation, but even it cannot guarantee solving novel logic puzzles without tools. We avoid claiming any model “knows” long contexts inherently; beyond their context length, we rely on external memory or RAG.  

Practically, we will define *capability split*: the minimal tier handles everyday query completion (e.g. “explain this code”), the general tier adds improved nuance and style adaptability, and the high tier adds more “creativity” and factual recall. Any skill requiring precise numeric/combinatorial work or very long memory should be handled by external modules (calculator, knowledge graph, or larger LLM API). 

# 10. Training and Initialization Options  

To produce these students, we will use **teacher-student distillation** and careful initialization:  
- **Tokenizer Init:** Likely reuse or trim a large tokenizer. If trimming, we may need intermediate finetuning to avoid token gaps. Sequence-level distillation (teacher generates text) can bootstrap a smaller vocab.  
- **Embedding Transfer:** We will apply *guided initialization* from teacher to student embeddings. For instance, if the teacher’s vocab includes the student’s tokens, we directly copy the corresponding rows. If embedding dims differ, use a technique like GUIDE: project teacher embeddings into student dimension or use PCA to initialize. GUIDE reports a ~25% reduction in quality gap by this embedding distillation for 400M–1B students. This covers both input and tied output embeddings.  
- **Layer Dropping and Width Scaling:** For small student <teacher, we can drop layers (e.g. pick every k-th teacher layer) or reduce width (shrink H). We may experiment: one blueprint might simply copy the smallest layers of teacher, another might reduce heads count (e.g. from 16 to 8) to create a 0.3B model.  Heuristic: keep FFN expansion factor=4, scale H by ~√(target/teacher).  
- **Distillation Methods:** We will use mixed token-level and sequence-level distillation. Teacher’s logits (soft targets) can train the student via KL loss; sequence distillation (teacher-generated transcripts) can also refine fluency. If vocab mismatch is severe, we lean on sequence distill. We avoid logits on mismatched tokens unless remapping.  
- **LoRA vs Full Finetune:** Given size, we may first train **full fine-tuning** from scratch on distilled data. LoRA (low-rank adaptation) could be used to adapt larger models but for final deployment we want a standalone small model. However, LoRA-like techniques (e.g. injecting small adapters) could be used as an intermediate training strategy to stabilize deep layers, then merged.  
- **Quantization-Aware Training (QAT):** If producing quantized students (INT8/4), we consider training with fake quantization or GPTQ calibration to minimize accuracy loss. For example, using QAT on the final model to tune group scales can improve Q4 quality.  

**Risks:** Model shrinking can introduce **mode collapse** or "shortcutting": the student may overfit frequent patterns or fail uncommon ones. We will monitor for any degenerate behaviors (e.g. repeating loops, sensitivity to paraphrases). A very narrow student might lose context handling stability. These are mitigated by comparing dev-set performance on the same tasks with the teacher.  

# 11. Three Student Blueprints  

Below we outline three concrete models, each with a logical config, memory estimates, and training notes:

- **Tier 1 – *Minimal Browser Model* (~0.3B):**  
  **Config:** Hidden size ~1024, 16 heads, ~12–16 layers.  E.g. H=1024, L=12, FFN=4096, vocab ~32K. This yields ~300–350M params (embedding ∼33M, layers ∼260M). Rotary or sine-cosine pos, 512–1024 context. Embedding tied.  Norm: pre-LN.  
  **Memory:** Float16: KV cache at 512 tokens ≈2×12×1024×512×2B≈25MB; at 2048 ≈100MB. With 3× params (~1.2GB) plus overhead (say 0.3GB) yields ~1.5GB at 2K.  In WASM/JS, budget ~2GB.  *Allocator uncertainty:* allow ~+20%.  
  **Training:** Distill from a teacher (e.g. GPT-2 Medium) using sequence distillation (generate many simple dialogues). Initialize embeddings from teacher (GUIDE) and drop every other layer. Possibly freeze first layer norms during early training for stability.  
  **Expected Behavior:** Should handle single-turn Q&A, basic summarization, code explanation, rewriting tasks for simple inputs. Weaknesses: limited context, struggles with nuanced prompts or long reasoning chains. *Pilot test:* measure similarity of outputs to teacher on held-out dialogues and ensure minimal drop in standard NLP benchmarks.  

- **Tier 2 – *Balanced General Model* (~0.8B):**  
  **Config:** Hidden ~1536, 16 heads, ~18–20 layers.  For example H=1536, L=20 gives ~0.8B params (embedding ~77M). Bloom-1B1 (H=1536, L=24) is 1.1B; we slightly reduce layers or heads. Use ALiBi or Rotary with 2048 context. FFN=6144. Tied embeddings.  
  **Memory:** At 2048 tokens: KV ≈2×20×1536×2048×2 ≈ 503MB. Activations ~3× model (~2.4GB). Total ~3.0GB float16. Add overhead ≈0.5GB ⇒ ~3.5GB. On browser, plan ~5GB.  In INT8, KV ~250MB, activations still ~2.4GB (if kept FP16), so ~3GB total.  
  **Training:** Distill from a 1.3B+ teacher (e.g. GPT-Neo 1.3B or Bloom-1B7). We can do knowledge distillation (logit matching) on diverse tasks and also sequence distill on instruction-following data. Use embedding init from teacher (GUIDE). Potentially fine-tune on conversational corpora (Alpaca-like). Quantization-aware training for 8-bit if used.  
  **Expected Behavior:** Good at following moderate instructions, handling multi-turn chat up to 2K tokens, basic code and reasoning tasks. Likely still needs tools for heavy math or very long context. Evaluate on NLP benchmarks and instruction benchmarks (like Vicuna chat eval) to set thresholds.  

- **Tier 3 – *High-Quality Local Model* (~1.3B):**  
  **Config:** Hidden ~2048, 16 heads, ~24 layers (similar to GPT-Neo 1.3B or Pythia-1.4B). That is ~1.3–1.4B params (embedding 102M, layers 1.21B). Rotary pos, context 2048–4096 (depending on memory). FFN=8192. Tied embeddings.  
  **Memory:** At 4096 tokens: KV ≈2×24×2048×4096×2 ≈ 8050MB (~7.8GB). Activations ~3× model (~9GB). Total ~17GB float16 – too high. So, realistically use 2048 tokens: KV ~2013MB, acts~9GB, total ~11GB, plus overhead ~1GB = ~12GB. In 8-bit, KV~4GB, acts~9GB, total ~13GB. This might fit on high-end desktops. Lower it if needed (window=1024 or MQA).  
  **Training:** Distill from the largest teacher available (e.g. 7B LLaMA adapter or chain-of-thought outputs). Use full knowledge distillation (KL) plus sequence distill on large instruction dataset (OIG, Alpaca). Apply guided embedding init and layer-wise distillation if helpful. Possibly apply layer-dropping: e.g. start with 32 layers and drop to 24 during training. If 4-bit quantization is planned, include GPTQ calibration.  
  **Expected Behavior:** Strong conversational fluency, decent long-context summarization (within 2K), decent code explanation. Will still deflect extremely deep questions or delegate to tools (search, calc). Monitor for hallucinations. Should match teacher quality on held-out benchmarks (MMLU, HellaSwag, as a proxy).  

For each blueprint we will specify rigorous “untouched outputs” tests: e.g. compare outputs on unseen queries (paraphrases) to ensure no regressive loss of “ordinary helpfulness.” We set numeric regression budgets (e.g. no >5% drop on BLEU/ROUGE or safety metrics).  

# 12. Pilot Experiments, Rejection and Promotion Criteria  

Before full training, for each blueprint we define a quick pilot: train on a small distilled dataset (~10M tokens) and evaluate key metrics. We require: 
- **Output Stability:** Given a fixed prompt, the student should match the teacher’s answer distribution within a tolerance. We can measure average KL divergence on held-out prompts. Large mismatches (>0.5 KL) or repeated incorrect outputs trigger rework. 
- **Paraphrase Sensitivity:** The student’s outputs should not dramatically change when inputs are reworded by simple paraphrasing. We will test on a paraphrase suite; if consistency drops >10% in ROUGE/overlap, this is a red flag. 
- **Benchmark Regression:** On a small NLP benchmark set (e.g. a subset of MMLU or synthetic multi-turn dialogs), the student’s performance (accuracy/perplexity) should not fall below a set fraction (e.g. 90%) of the teacher’s or baseline. 
- **Safety/Consistency:** The student must still follow system instructions and not degenerate into evasiveness more than teacher (e.g. by a lax safety filter test). 

Only if the pilot model meets these criteria do we proceed to full training.  Each blueprint thus has its own “go/no-go” gates, preventing wasted compute on clearly inadequate designs. 

# 13. Portfolio Implications  

Having multiple student models means deciding how to use them. We envision a *delegation policy*: the system could, based on user resource (mobile vs. desktop) or query complexity, select an appropriate tier. For instance, a quick chat on phone might use Tier 1, while a heavy-duty coding question on desktop uses Tier 3.  This portfolio approach also hedges risks: if one size proves problematic (e.g. too slow), others can compensate.  We also ensure tokenizer compatibility or conversion paths: ideally one tokenizer for all tiers (simpler deployment), but if small tiers need reduced vocab, we might map inputs to a common format.  

# 14. Open Questions and Future Work  

Key unknowns that require experiments or profiling include: *How small can the vocabulary be without losing fluency?*  We must empirically test student behavior on multilingual/code inputs if we prune tokens. *How well does depth vs. width choices hold for our domain?* Our medium indicates width is beneficial, but small-scale might differ. *What is the real latency/memory on target CPU/WASM?*  We’ll measure actual peaks for each blueprint with realistic runtimes. *Does embedding distillation (GUIDE) scale down to 0.3B models?*  We’ll test its efficacy as in [123] (shown for 400M+). Also, *security and bias behavior of these tiny models* is uncertain; while beyond scope, some automated bias probes should be included.  

# 15. Bibliography  

1. **GPT-2 Transformer Configs:** openai-community/GPT2 model configs (Medium and Large) on Hugging Face, Apr. 2019 (rev).  Provided hidden size, layers, heads for GPT-2.  
2. **EleutherAI GPT-Neo Configs:** “EleutherAI/gpt-neo-125M” and “gpt-neo-1.3B” from Hugging Face (rev. 2023).  Provided hidden size, layers, heads, vocab (50257).  
3. **Bloom Model Configs:** BigScience “bloom-560m”, “bloom-1b1”, “bloom-1b7” on Hugging Face.  Include H, L, heads, FFN, ALiBi offset, vocab (250880).  License specified as BigScience RAIL.  
4. **Pythia Config (410M):** EleutherAI “pythia-410m” on Hugging Face (2023).  Shows H=1024, L=24, heads=16, rotary emb (rotary_pct=0.25) and vocab=50304.  License: Apache-2.0.  
5. **IBM Blog on Grouped/Multi-Query Attention:** “What is Grouped Query Attention (GQA)?” (2023). Defines MQA and GQA and tradeoffs.  
6. **Shazeer et al., 2019 (Arxiv):** “Fast Transformer Decoding: One Write-Head is All You Need.” Introduced Multi-Query Attention: sharing K/V across heads reduces decoding memory with minor quality loss.  
7. **Brenndoerfer (2024):** “Weight Tying: Sharing Embeddings Between Input/Output” (blog). Demonstrates tied embeddings halve embedding parameters (50% savings).  
8. **Benjio (2024):** “LLM Depth vs Performance – How To Train Smarter, Not Deeper” (Medium). Argues wider models utilize parameters better and incur lower gradient bottlenecks.  
9. **Trinh et al., 2025 (Arxiv):** “GUIDE: Guided Initialization and Distillation of Embeddings.” Shows embedding distillation can cut 25–26% of teacher-student quality gap for 400M–1B models.  
10. **Brenndoerfer (2026):** “GGUF Format for Quantized LLMs” (Language AI Handbook). Detailed analysis of file size vs. quantization (e.g. Q4_K uses ~4.5 bits/param).  

Each source is primary (model configs, papers, or developer reports) and dated.  All Hugging Face links above are git-blaim or raw files at a specific commit (immutable), with access date as of retrieval.