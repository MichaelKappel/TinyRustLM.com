# Tiny Model Distillation and Pruning for High-Quality .slm Models

## What the research says about making tiny models good

For very small language models, the literature is unusually clear on one point: **logits-only compression is usually not enough**. Classic knowledge distillation starts from Hinton-style soft targets with temperature-scaled teacher probabilities, but transformer compression work such as TinyBERT, MobileBERT, MiniLM, and MiniLMv2 consistently found that students keep more quality when they also learn from **intermediate structure**—hidden states, self-attention maps, or attention-value relations—not just the final next-token distribution. That is especially important once the student is small enough that every lost degree of freedom matters. citeturn2search0turn1search4turn1search2turn1search1turn1search9

That same theme shows up in more recent LLM-focused distillation work. Recent analyses note that LLM distillation has often over-relied on logit matching, while newer methods explicitly argue for feature or hidden-state supervision because internal representations carry knowledge that plain output matching misses. For autoregressive models, Generalized KD also shows that **on-policy distillation**—training the student on sequences it generates itself, then comparing with the teacher—works well for instruction tuning and task-agnostic distillation, which is more relevant to chat-style SLMs than older masked-LM recipes alone. citeturn16search0turn20search1turn16search1

The teacher–student gap also matters more than many teams expect. Teacher-assistant distillation was introduced specifically because very large teachers can transfer poorly to much smaller students, and later work continued to show that “stronger” teachers are not automatically better teachers for instruction tuning; compatibility between teacher outputs and what the student can actually learn is a major variable. In practice, that argues against blindly using the biggest available frontier model for every synthetic dataset or distillation run. citeturn18search0turn29search0turn29search3

For instruction following, the data story is equally important. LIMA showed that a strong pretrained base could learn good response-format behavior from only **1,000 carefully curated** prompts and responses. Other studies found that very small, high-quality instruction datasets can be surprisingly competitive: a simple “longest 1,000 instructions” baseline is tough to beat, and even a 200-example instruction set improved MiniGPT-4-style tuning when the examples were filtered for quality. That is good news for tiny `.slm` projects: your lowest-cost path is usually **better selection and better supervision**, not just more examples. citeturn3search2turn3search4turn3search0turn3search8

A practical implication is that tiny-model quality usually comes from combining three kinds of supervision: **next-token or SFT loss for stability, logit distillation for output behavior, and hidden-state or attention-relation distillation for internal structure**. If the task requires reasoning or format consistency, adding teacher rationales or curriculum ordering can make small students more sample-efficient than plain SFT. Distilling Step-by-Step and TAPIR both point in that direction. citeturn16search3turn16search11turn16search6

## Tokenizer and vocabulary decisions

Tokenizer and vocabulary choices are not side issues for tiny models; they are part of the compression budget. SentencePiece was designed as a **self-contained** tokenizer format so normalization and segmentation are reproducible, which is attractive for `.slm` packaging. More recent work on vocabulary transfer, vocabulary trimming, and tokenizer adaptation shows that shrinking or refining vocabularies can reduce model size and sometimes inference cost with only modest quality loss in narrow domains or reduced language coverage. In multilingual trimming, roughly half the original vocabulary could often be retained while preserving much of the original performance for target-language use cases. citeturn17search0turn17search2turn5search1turn5search17

But the literature also warns against overdoing this. Newer studies found that **larger vocabularies can improve LLM quality**, and tokenization research keeps showing that compression quality matters for downstream performance. Tokenizer-free or byte-level models can be more robust to corruptions, but they often pay for that with **longer sequences and higher inference cost**, depending heavily on task length statistics. For a tiny runtime-bound `.slm`, vocabulary shrinkage is therefore best treated as a **domain specialization move**, not as an unconditional compression trick. citeturn5search4turn5search10turn4search6turn4search18

There is also a sequencing issue: if you plan to use **logits distillation**, changing the tokenizer late is expensive because the student and teacher no longer share the same token space. Universal Logit Distillation was proposed precisely to handle tokenizer mismatch, which tells you the mismatch is real enough to need special machinery. The simplest practical rule is: **decide the final tokenizer before your main distillation run**, or be prepared to use tokenizer-mismatch KD methods and revalidate the whole pipeline. citeturn1search3turn5search1turn4search11

My recommendation for tiny `.slm` work is to shrink the tokenizer only when at least one of these is true: the model is monolingual but inherited a multilingual vocabulary, the task domain is narrow enough that many tokens will be cold forever, or the embedding/LM-head size is dominating the checkpoint. Even then, keep a small fallback path for rare characters or bytes rather than trying to force an aggressively tiny fixed vocabulary. That recommendation is a synthesis of the vocabulary-trimming, tokenizer-adaptation, and tokenization-efficiency literature. citeturn5search17turn4search11turn5search10turn5search4

## Pruning and factorization that actually help

If your goal is a tiny model that is not only smaller on disk but also faster in deployment, **structured pruning is far more practical than pure unstructured sparsity**. CoFi prunes layers, heads, and hidden units jointly and uses layerwise distillation to recover quality. Sheared-LLaMA goes further in the LLM setting by pruning a large model down to a target shape and then continuing pretraining, showing that structured pruning can be a cost-effective way to build strong 1–3B-class models without training from scratch. LayerDrop and ShortGPT reinforce the same message from different angles: many layers are redundant enough that carefully chosen depth reduction can work, but only if you validate aggressively and recover with more training. citeturn8search0turn8search4turn19search0turn19search4turn7search0turn19search1

Attention-head pruning is well-supported by older and newer transformer work. Michel et al. and Voita et al. both showed that many heads can be removed with surprisingly small quality loss, while specialized heads tend to be the last ones worth keeping. More recent head-pruning work continues to improve selection, but the practical lesson has not changed much: **prune heads globally, not uniformly layer by layer, and expect some heads to matter a lot more than others**. citeturn9search0turn9search1turn9search2turn9search12

The same pattern holds for MLPs and hidden units. CoFi already treats hidden units as pruneable fine-grained structure, while newer FFN-focused work targets intermediate dimensions directly. In tiny models, MLP compression is often more important than people expect because feed-forward layers are a large share of both parameters and compute. If you can only afford one width-pruning pass, pruning **MLP intermediate dimensions** often gives more real payoff than obsessing over head counts alone. citeturn8search0turn8search8turn19search14

Unstructured sparsity is still useful, but mostly when your runtime actually exploits it. Movement Pruning helped make pruning more adaptive in fine-tuning settings, while SparseGPT and Wanda showed that one-shot pruning can reach roughly **50–60% sparsity** with limited perplexity damage and can be combined with quantization. The catch is that this mostly describes **model-side compressibility**, not guaranteed deployment-side speed. Sparse kernels are required to get real acceleration, and even then the speedup depends strongly on the sparsity pattern. citeturn6search5turn6search2turn6search3turn15search2turn15search4

Low-rank factorization is the other major lever worth using before export. Weighted low-rank compression and data-aware low-rank compression both show that substantial extra parameter reductions are possible after task adaptation, and LoSparse is especially relevant because it combines a low-rank component with a sparse residual rather than forcing a model to choose between the two. For tiny `.slm` models, low-rank factorization is most attractive for the largest linear layers—typically MLP projections and sometimes attention projections—because it preserves dense execution patterns better than arbitrary sparsity. citeturn11search0turn11search3turn11search2turn11search6

## Practical pipeline for building a high-quality tiny .slm

Below, `.slm` refers to the **final exported deployment artifact**. The best practical pipeline is not “train dense, quantize hard, hope for the best.” It is a staged compression-and-recovery loop.

A good default pipeline is:

- **Choose the final student family, depth, width, and tokenizer early.** If tokenizer shrinkage or vocabulary transfer is part of the plan, do it before the main distillation run so your logit space and embedding layout are already final. This avoids forcing late tokenizer-mismatch KD or a second full recovery pass. citeturn1search3turn5search1turn17search0

- **Run domain or general continued pretraining with distillation on unlabeled text.** Use a mixed loss made of language-modeling loss, token-level KL on teacher logits, and intermediate alignment on hidden states or attention relations. MiniLM, TinyBERT, and newer feature-distillation work support this combination. If the teacher–student gap is very large, add a teacher assistant or multi-step distillation. citeturn1search1turn1search4turn1search9turn20search1turn18search0

- **Instruction-tune on a tiny, high-quality dataset instead of a giant noisy one.** Start with a few hundred to a few thousand curated prompts, then add synthetic data only if it is diverse and compatible with the student. LIMA, TAPIR, and compatibility-aware teacher selection all support this approach. citeturn3search2turn16search6turn29search0

- **Prune structurally toward the deployment shape, then recover.** Prune layers, heads, and MLP dimensions iteratively; after each pruning stage, run a short recovery phase with teacher guidance. This is closer to CoFi and Sheared-LLaMA than to one-shot export-time surgery. citeturn8search0turn19search0

- **Apply low-rank factorization to the largest dense matrices if latency still matters.** This usually composes better with browser or CPU runtimes than unstructured sparse matrices do. citeturn11search0turn11search2

- **Use unstructured sparsity only when you know the runtime can exploit it.** If the final runtime is dense-only, zeros mostly buy you checkpoint cosmetics, not user-visible speed. citeturn15search2turn15search4turn15search9

- **Quantize last.** The literature treats pruning/sparsity and quantization as complementary, not competing, and modern pruning papers explicitly note that they compose. Quantization should normally be your final compression stage after the model topology is stable. citeturn6search2turn19search1turn15search0

The highest-quality tiny `.slm` family usually comes from building **several adjacent students**, not a single heroic tiny checkpoint. A 0.5B, 0.8B, and 1.2B family distilled from the same teacher, using the same tokenizer and eval harness, is often more useful than one aggressively minimized build, because it lets you see where the quality cliff begins. That recommendation follows from the repeated findings that teacher–student capacity gap, layer redundancy, and pruning aggressiveness all have nonlinear effects. citeturn18search0turn20search15turn19search1

## Which compression steps should happen before .slm export

Anything that changes **token IDs, tensor shapes, layer count, head count, hidden dimensions, or matrix factorization** should happen before `.slm` export. In concrete terms, the following belong in the pre-export training pipeline: tokenizer shrinkage, vocabulary reduction or transfer, structured pruning, layer dropping, MLP-width reduction, attention-head reduction, and low-rank factorization. Those steps alter the model’s actual topology or token interface, so they should be stabilized and recovered before you freeze the artifact. citeturn5search1turn5search17turn8search0turn19search0turn11search2

By contrast, **post-training quantization** is usually the last step at or immediately before export, because it tends to preserve graph structure while changing storage and arithmetic format. The pruning literature also repeatedly notes that sparsity techniques are compatible with quantization, which is another reason to place quantization at the end of the pipeline rather than at the beginning. citeturn6search2turn15search0turn19search1

Unstructured sparsity is the main exception. If your `.slm` runtime does not implement sparse kernels and sparse serialization semantics, then unstructured sparse pruning should **not** survive into the exported artifact as a first-class representation. Either convert the model back into a dense-reoptimized form or skip that step entirely. Sparse masks without sparse execution usually do not produce the deployment win practitioners hope for. citeturn15search2turn15search4turn15search9

A practical rule is:

- **Must be done before export:** tokenizer/vocabulary changes, layer/head/MLP pruning, low-rank factorization, recovery distillation, continued pretraining, instruction tuning. citeturn17search0turn5search1turn8search0turn19search0turn11search0
- **Usually done at finalization/export:** quantization, packing, checksum generation, optional runtime-specific tensor layout conversion. citeturn6search2turn15search0
- **Only keep in export if the runtime supports it natively:** sparse formats and sparse metadata. citeturn15search2turn15search4turn24view0turn26view0

## What metadata and evaluation proof should be stored

The right mental model here is not just “save the checkpoint.” It is “ship a **model card plus reproducibility packet**.” Model Cards were proposed specifically so released models carry intended-use, evaluation, and risk information, and the reproducibility checklists used in ML conferences emphasize dataset statistics, splits, preprocessing, code, seeds, and evaluation procedure details. Hugging Face’s model card guidance operationalizes that into a practical artifact. citeturn30search0turn30search1turn30search2turn30search5turn30search13

For a tiny `.slm`, I would store three layers of metadata.

First, store **identity and lineage**: teacher model ID and revision, student architecture, tokenizer revision and hash, special-token map, vocabulary-reduction recipe, pruning targets, low-rank ranks, quantization scheme, training corpus fingerprints, licenses, and a changelog of each compression step. SentencePiece’s self-contained packaging and model-card conventions both support this style of reproducibility. citeturn17search2turn30search1turn30search13

Second, store **training and compression provenance**: distillation losses and weights, temperature, layer-mapping policy, whether logits distillation used shared-tokenizer KL or tokenizer-mismatch methods, recovery-training token counts, pruning masks or target shapes, optimizer configuration, random seeds, and the exact eval harness commit. This is where most future debugging time is saved. citeturn2search0turn1search3turn8search0turn19search0turn30search2

Third, store **evaluation proof**, not just headline scores. The proof bundle should include raw outputs for a fixed canary set, benchmark version identifiers, scoring scripts, prompt templates, decoding settings, and per-benchmark subscores. If you keep only one number—say, “MMLU 54.1”—you will miss important regressions and may not even realize the benchmark itself is noisy. citeturn27search0turn21search4turn21search7turn21search9

A strong, compact evaluation proof bundle for tiny `.slm` models should include:

- **Instruction following:** IFEval plus IFBench or an equivalent out-of-domain verifiable-constraints set. IFEval checks precise, reproducible constraints; IFBench was introduced because models can overfit to existing instruction-following benchmarks without generalizing. citeturn21search4turn27search6turn27search17
- **General knowledge and reasoning:** MMLU-Redux rather than raw MMLU alone, plus BBH or BBEH if reasoning matters. MMLU-Redux exists because the original MMLU has annotation errors substantial enough to change conclusions. citeturn27search0turn27search13turn22search2turn22search5
- **Open-ended chat quality:** length-controlled AlpacaEval or carefully designed human/LLM-judge comparisons, not raw win rates alone, because verbosity and length biases are well documented. citeturn21search7turn21search3turn21search1turn21search9
- **Truthfulness and hallucination:** TruthfulQA and HaluEval when the model will answer open-domain questions. citeturn22search0turn22search1
- **Deployment metrics:** artifact size, tokens/sec, cold-load time, peak memory, and chars/token or tokens/char statistics after tokenizer changes. Tokenization work shows that compression behavior influences downstream efficiency, so these deserve to sit beside quality metrics, not below them. citeturn5search10turn4search18

## Risks of over-pruning and how to detect collapse early

The largest risk is not “the benchmark will go down a bit.” It is **capability cliffing**: the model looks acceptable on average metrics while a narrow but important behavior—format obedience, tool-style JSON structure, factual reliability, code syntax closure, or domain terminology—has already collapsed. Research on capacity gap in distillation, teacher-assistant methods, and pruning-induced recovery all points to the same danger: once the student gets too small for the learning signal, degradation becomes discontinuous rather than graceful. citeturn18search0turn20search15turn19search0

Tokenizer shrinkage has its own version of this risk. Because vocabulary size interacts with both model size and sequence length, an aggressively shrunken tokenizer can save parameters but silently increase token counts so much that latency, long-context behavior, and rare-term fidelity all degrade. The fact that larger vocabularies can improve LLM quality is the main reason tokenizer reduction should be tested as an architectural hypothesis, not assumed to be free compression. citeturn5search4turn5search10turn4search18

The tests I would use to catch quality collapse are:

- **Token-level teacher-agreement canaries.** On a fixed prompt set, measure KL divergence between teacher and student next-token distributions. Because logits distillation is directly optimizing this behavior, a sharp jump here is often the earliest sign of collapse after pruning or tokenizer changes. citeturn2search0turn16search1

- **Hidden-state drift canaries.** Measure cosine or MSE drift between mapped teacher and student layers on a fixed corpus. Hidden-state distillation exists because these representations matter; drift spikes immediately after pruning are a warning that headline evals may soon drop. citeturn1search4turn20search1

- **Exact instruction adherence tests.** Run IFEval and IFBench, plus your own deterministic checks for JSON/schema validity, keyword placement, line-count rules, or stop-sequence obedience. Precise instruction following is exactly where tiny models often fail first. citeturn21search4turn27search6turn27search8

- **Reasoning and knowledge tests with benchmark hygiene.** Use MMLU-Redux and one reasoning-heavy suite such as BBH or BBEH. This avoids mistaking benchmark noise for model quality. citeturn27search0turn22search2turn22search5

- **Length-controlled pairwise quality checks.** If you use LLM judges, use length-controlled AlpacaEval-style comparisons and inspect output-length distributions, because verbose students can look better than they are. citeturn21search7turn21search3

- **Truth and hallucination probes.** Use TruthfulQA and HaluEval or task-specific factual probes. Tiny students often become more eager to guess when they lose representational capacity. citeturn22search0turn22search1

- **Tail metrics, not just means.** Track p95 failure rate on canary prompts, not only aggregate averages. This recommendation is an inference from the benchmark-bias literature: mean scores can hide narrow, user-visible failures. citeturn21search9turn21search7turn27search0

A good release gate for a tiny `.slm` is not “score within 2% of baseline on one benchmark.” It is “pass all deterministic format tests, stay within a bounded teacher-KL drift band, keep hallucination metrics inside tolerance, and show no major tail regression on user-critical canaries.” That is stricter than many leaderboard practices, but it is what prevents shipping a beautifully compressed artifact that is unusable in production. citeturn21search4turn22search0turn22search1turn30search0

## Sparse runtime tradeoffs in Rust and WASM

For Rust/WASM deployment, the key tradeoff is that **browser-friendly compute is biased toward dense, contiguous kernels**. Rust’s `wasm32` intrinsics expose atomics and SIMD, and the SIMD model is built around a **128-bit `v128`** register type. The Rust docs also note that shipping SIMD in WebAssembly is nuanced, and there is no simple runtime dynamic detection path inside Rust’s standard model; you generally decide at build/distribution time whether you ship SIMD-enabled binaries. citeturn32view0

Browser support for WebAssembly SIMD and threads is now broad in aggregate, but that does not mean sparse execution is cheap. Current support tables show wide availability for both SIMD and threads/atomics, yet MDN also makes clear that shared WebAssembly memory inherits the `SharedArrayBuffer` security requirements: the page must be in a secure context and be cross-origin isolated for shared memory between workers. That means multithreaded sparse inference in the browser is operationally possible, but not “free.” citeturn24view0turn26view0turn31view0

The deeper issue is algorithmic. Sparse acceleration requires **replacing dense kernels with sparse kernels**, and the speedup for block-sparse or unstructured sparsity is variable and pattern-dependent. Sparse-matrix literature and practical framework notes both emphasize overhead from irregular memory access, metadata, and load imbalance. Inference-side speedups from unstructured sparsity are therefore much harder to realize than the theoretical FLOP reduction suggests. citeturn15search2turn15search4turn15search19turn15search1

That matters even more in WASM. Because WebAssembly SIMD is 128-bit and dense-friendly, my reading of the evidence is that **browser-targeted Rust/WASM runtimes will usually prefer a smaller dense model, a structurally pruned model, or a low-rank-factored dense model over an unstructured sparse one**, unless sparsity is very high and you have custom kernels. That is an inference, but it is a well-supported one: dense kernels map naturally to SIMD lanes, while irregular sparse kernels pay metadata and gather/scatter overhead; modern pruning work keeps rediscovering that zeros alone do not guarantee wall-clock wins. citeturn32view0turn15search2turn15search4turn15search9

For Rust specifically, frameworks like Candle emphasize lightweight binaries and serverless-style inference, which fits the “small dense artifact” philosophy better than a highly irregular sparse runtime. So for a browser or WASM-first `.slm`, I would prioritize, in order: **tokenizer specialization, structured pruning, layer dropping, MLP-width reduction, low-rank factorization, final quantization**. I would only export sparse tensors if you can prove—on your actual Rust/WASM kernel stack—that they beat the dense baseline in load time, memory, and tokens/sec. citeturn12search2turn8search0turn19search0turn11search2turn24view0turn26view0

The short version is this: for tiny `.slm` models, **distill first, prune structurally second, factorize where useful, quantize last, and treat unstructured sparsity as opt-in runtime engineering rather than a default compression step**. That ordering matches the strongest part of the current literature and is the safest path to high-quality tiny deployment artifacts. citeturn1search4turn1search9turn8search0turn19search0turn11search2turn6search2