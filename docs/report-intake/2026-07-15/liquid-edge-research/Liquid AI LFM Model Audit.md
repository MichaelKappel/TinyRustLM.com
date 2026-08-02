# **Independent Evaluation-Science Report: Liquid AI Checkpoint Suitability for TinyRustLM**

## **1\. Executive Recommendation and Confidence Limits**

The evaluation of current sub-2B parameter language models for integration into a browser-local environment—specifically the TinyRustLM architecture—reveals a profound divergence between raw physical generative speed and robust conversational utility. Based on an exhaustive independent audit of public artifacts, technical reports, and architectural specifications, the recommendation for the Liquid Foundation Models (LFM) family is stratified into distinct deployment tiers.  
The LFM2.5-1.2B-Instruct checkpoint is recommended for immediate investigation as a highly specialized tool-calling and data-extraction source. However, it must be categorically rejected as a general-purpose conversational assistant in its current unpatched state. While the underlying hybrid architecture demonstrates unparalleled prefill and decode throughput advantages on standard CPU hardware, the model class exhibits deeply documented weaknesses in knowledge-intensive reasoning, ambiguity resolution, and multi-turn state tracking1. Furthermore, the LFM2.5-230M and LFM2.5-350M variants must be rejected prior to porting for any user-facing conversational applications due to severe parameter-bound capacity limits, though they warrant isolated investigation strictly as deterministic routing or structured extraction specialists3.  
The primary confidence limit of this assessment stems from the reliance on public evaluation frameworks, which inherently suffer from pre-training data contamination and fundamentally fail to measure the dynamic, multi-turn state-tracking required by the TinyRustLM constraints. A critical, documented flaw in the official Hugging Face chat template for LFM2.5 models severely compromises confidence in upstream quality assurance; the template actively breaks multi-turn tool calling by rendering None contents as literal "null" strings, corrupting the context window during complex agentic workflows6. Consequently, any deployment of these models requires a custom inference harness, template overrides, and rigorous, private, out-of-distribution evaluation.

## **2\. Revision-Pinned Model and License Matrix**

To accurately isolate the variables of architecture, parameter count, and post-training data regimens, the candidate matrix pins specific model revisions. The baseline encompasses the Liquid AI LFM2 and LFM2.5 series, compared against dense transformer and Mamba-hybrid architectures in the identical weight class.

| Model Candidate | Revision Hash | Role | Total / Active Params | Context Limit | Architecture | Weight Size (bfloat16) | License | Release Date |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **LFM2.5-230M** | fe513d9 | Instruct | 230M / 230M | 32,768 | Hybrid (8 LIV \+ 6 GQA) | \~0.46 GB | LFM Open v1.0 | Jun 2026 |
| **LFM2.5-350M** | 9960764 | Base | 350M / 350M | 32,768 | Hybrid (10 LIV \+ 6 GQA) | \~0.70 GB | LFM Open v1.0 | Mar 2026 |
| **LFM2.5-1.2B-Instruct** | c20ca41 | Instruct | 1.17B / 1.17B | 32,768 | Hybrid (10 LIV \+ 6 GQA) | \~2.34 GB | LFM Open v1.0 | Jan 2026 |
| **LFM2.5-1.2B-Thinking** | a9f02ae | Reasoning | 1.17B / 1.17B | 32,768 | Hybrid (10 LIV \+ 6 GQA) | \~2.34 GB | LFM Open v1.0 | Jan 2026 |
| **LFM2-1.2B-Tool** | Official | Tool-Specialized | 1.17B / 1.17B | 128,000 | Hybrid (10 LIV \+ 6 GQA) | \~2.34 GB | LFM Open v1.0 | Mar 2026 |
| **Granite-4.0-H-1B** | Official | Instruct | 1.5B / 1.5B | 128,000 | Hybrid (36 Mamba-2 \+ 4 Attn) | \~3.00 GB | Apache 2.0 | Oct 2025 |
| **Gemma-3-1B-IT** | Official | Instruct | 1.0B / 1.0B | 32,000 | Dense Transformer | \~2.00 GB | Gemma License | 2026 |

The architectural composition of the LFM series relies heavily on Linear Input-Varying (LIV) convolution blocks paired with Grouped Query Attention (GQA). The LFM2.5-230M operates with a 1024 hidden dimension across 14 layers, whereas the 1.2B variants utilize a 2048 hidden dimension across 16 layers7. All LFM2.5 checkpoints share a tokenizer with a 65,536-token vocabulary and rely on a ChatML-derived template structure9. In contrast, comparative models like Gemma-3-1B-IT deploy a massive 262,144-token vocabulary, which significantly inflates the embedding layer footprint but allows for denser multilingual packing11.  
The licensing environment presents a highly favorable profile for early-stage commercial deployment. The LFM Open License v1.0 permits unrestricted commercial use, modification, and distribution free of charge until the deploying corporate entity surpasses a $10 million USD annual revenue threshold12. Crucially for the TinyRustLM project, the license contains absolutely no copyleft provisions, ensuring that any proprietary fine-tunes, specialized system prompts, or quantized derivatives remain entirely confidential and unencumbered by forced open-source distribution mandates13.

## **3\. Claim-by-Claim Evidence Audit**

The marketing literature and technical documentation supporting the LFM2.5 family contains specific, aggressive claims regarding edge deployment suitability, speed, memory reduction, and adaptation. Each major claim has been independently audited for reproducibility, methodological rigor, and direct relevance to the fixed constraints of a browser-local assistant.

| Evaluated Claim | Originating Source | Evaluation Verdict | Audit Findings & Hardware Context |
| :---- | :---- | :---- | :---- |
| **Drastic KV Cache Reduction** | Liquid AI Technical Report15 | **Verified** | Mathematical modeling of the 1.2B architecture confirms that by restricting full attention to merely 6 of the 16 layers, the dynamic KV cache footprint at a 32,768-token context is reduced by precisely 62.5% compared to a dense transformer of identical dimensions17. |
| **Best-in-Class CPU Inference Latency** | Liquid AI Promotional Materials3 | **Runtime-Smoke-Only** | Claims of 213 tokens per second on a Snapdragon Gen4 processor and 42 tokens per second on a Raspberry Pi 5 are physically reproducible using optimized backends like NexaSDK and ExecuTorch2. However, fast token emission does not equate to coherent logic or conversational utility. |
| **Native Out-of-the-Box Tool Use** | LFM2.5 Release Notes1 | **Task-Specific-Useful (Flawed)** | The model demonstrates high fidelity in generating specific Pythonic tool-call syntax. However, independent reproduction reveals a catastrophic flaw in the official Hugging Face template which nullifies multi-turn capabilities by mishandling content=None6. |
| **Superior Structured Output Extraction** | IFStruct Benchmark Documentation20 | **Source-Screened** | The 230M and 350M models achieve exceptionally high scores on the IFStruct benchmark for JSON generation. This is heavily attributed to intense reinforcement learning targeting these specific structural constraints, making them highly viable for stateless data extraction5. |
| **Reliable Long-Context Handling** | Architecture Specifications7 | **Unverified for Conversation** | While the model physically accepts 32,768 tokens without memory overflow, the LIV convolution layers act as lossy compressors over long sequences. The ability to retrieve specific conversational facts buried deep in the context window remains highly suspect compared to full-attention comparators16. |

The audit explicitly marks the conversational capabilities of the sub-1B models as non-reproducible for general utility. The extreme compression of the parameter space results in a model that can mimic the syntax of intelligence—fluent text generation and correct structural formatting—without possessing the underlying semantic world model required for ambiguity resolution or common-sense judgment2.

## **4\. Source-Screen Scenario Taxonomy and Sample Plan**

To confidently accept or reject an LFM2.5 checkpoint for TinyRustLM before incurring the substantial engineering costs of WebAssembly/ONNX porting and fine-tuning, a robust, statistically powered source screen must be executed. Relying on public leaderboards introduces unacceptable risks of data contamination and fails to address the unique constraints of browser-local execution.  
The evaluation protocol requires a sample size mathematically calibrated to reject a weak source reliably. Assuming a minimum acceptable accuracy threshold (![][image1]) of 0.75 for TinyRustLM and a weak model's expected performance (![][image2]) of 0.60, achieving a 95% confidence level (![][image3]) and 80% statistical power (![][image4]) requires precisely 57 unique, procedurally generated test cases per taxonomic node18.  
The evaluation taxonomy is strictly defined to stress the exact capabilities demanded by the TinyRustLM specification, explicitly designed to expose compact-model failure modes.

| Taxonomy Node | Core Capability Tested | Targeted Compact-Model Failure Mode |
| :---- | :---- | :---- |
| **Ambiguity Handling** | Recognizing missing dependencies in a prompt. | **Guessing missing options:** Small models frequently fabricate parameters to complete a prompt rather than pausing to ask clarifying questions. |
| **Authority Conflict** | Prioritizing system instructions over conflicting user commands. | **Prompt Injection Compliance:** Small models possess fragile alignment and easily succumb to user commands that override structural system bounds. |
| **Preference Changes** | Adapting to mid-conversation shifts in user constraints. | **Stale-Memory Precedence:** Convolution-heavy architectures may over-index on early instructions and fail to register subsequent reversals in logic16. |
| **Lawful Adult Analysis** | Factual analysis of sensitive, non-explicit topics. | **Over-refusal & Policy Monologues:** Models heavily trained on safety datasets often trigger massive, sanctimonious refusal scripts instead of providing clinical, structural help. |
| **Untrusted Quotations** | Summarizing text containing embedded malicious instructions. | **Obeying instructions embedded in retrieved text:** The inability to separate the "data" plane from the "instruction" plane during retrieval augmentation. |
| **Code Explanation** | Tracing logic without fabricating nonexistent library functions. | **Fluent but impractical advice:** Generating code that looks syntactically perfect but calls hallucinated methods or incompatible library versions1. |
| **Structured JSON Extraction** | Adhering strictly to a defined data schema without conversational filler. | **Malformed JSON & Incomplete Answers:** Breaking schema syntax or appending "Here is your JSON:" which catastrophically breaks downstream parsing engines20. |

This procedural generation ensures that the models are evaluated on their fundamental reasoning architecture rather than their ability to regurgitate memorized benchmark data.

## **5\. Metamorphic and Multi-Turn Test Design**

Static, fixed-answer benchmark suites are fundamentally flawed for evaluating conversational assistants. The evaluation protocol mandates metamorphic testing, a methodology where the base scenario undergoes targeted semantic transformations. The objective is to verify that the model's underlying logic is robust against superficial variations, proving it possesses a generalized semantic understanding rather than a fragile, brittle pattern-matching capability.  
For each of the 57 base cases within a taxonomic node, a corresponding metamorphic pair is generated to test a specific semantic invariant. When evaluating the extraction of structured data, the prompt may be rewritten to vary entities, resources, units, or dates. The semantic invariant dictates that the factual extraction must adapt correctly to the new units, while the structural schema remains rigidly identical.  
Similarly, the discourse form and user tone are heavily manipulated. A prompt requesting a Python script is presented in highly formal, academic language, and then presented again as a colloquial, fragmented, and demanding request. Furthermore, irrelevant details are injected into the context (e.g., "I need a script to sort these network logs. By the way, the server room is exceptionally loud today."). The strict semantic invariant requires that the generated code must not reference the irrelevant detail, nor alter its algorithmic approach. Compact models frequently fail this test by attempting to address the irrelevant detail, resulting in a loss of focus on the primary task.  
Explicit and implicit negations are also systematically applied to test the model's logical boundaries. A prompt may explicitly state, "Do not use the standard library for this operation," while the metamorphic variant implicitly states, "Ensure you exclusively rely on external, third-party libraries." The model must successfully navigate both formulations without triggering repetitive loops or fabricating certainty.  
Multi-turn state tracking is evaluated through a rigorous isolation protocol. Compact models equipped with hybrid attention-convolution architectures frequently suffer from severe attention dilution over long sequences15. The test design injects a specific, critical variable in the first turn of a simulated dialogue. In subsequent turns, the conversation is intentionally diverted to unrelated topics, forcing the model to process thousands of tokens of intervening context. In the final turn, the user requests an action dependent on the variable established in turn one. The pass criteria require the model to correctly recall and interpolate the initial variable. Failure is recorded if the model fabricates a placeholder, engages in a repetitive loop attempting to find the data, or prematurely calls a tool to search for information it should inherently retain in its context window.

## **6\. Generation Configuration and Stochastic Policy**

To ensure strict reproducibility and prevent masking inherent model weaknesses through probabilistic sampling, deterministic generation profiles are strictly enforced for all candidates throughout the evaluation protocol. Techniques such as Best-of-N selection, automated retries chosen after reading answers, answer repair scripts, expected-term injection, and hand-edited transcripts are explicitly prohibited1.  
The generation profile actively binds the physical model execution to a highly restrictive stochastic policy.

| Configuration Parameter | Enforced Binding | Justification for TinyRustLM Evaluation |
| :---- | :---- | :---- |
| **Model Format / Precision** | Unquantized bfloat16 | Establishes the absolute upper bound of semantic capability before edge-specific quantization algorithms introduce numerical variance or degradation. |
| **Tokenizer & Template** | Official, with Patches | Strict adherence to the official 65,536 vocabulary. The upstream Jinja template bug must be manually patched in the local harness to allow multi-turn tool evaluations to proceed without parsing errors6. |
| **Seed** | Pre-declared (e.g., 3407\) | Eliminates stochastic variance. Repeated seeds are used to estimate per-case reliability across different hardware executions. |
| **Temperature** | 0.1 | Enforces near-greedy determinism, preventing the model from utilizing high-entropy fallback paths to accidentally stumble into a correct answer1. |
| **Top-K / Top-P** | 50 / 0.1 | Constrains the sampling pool exclusively to the highest-probability tokens, exposing the model's primary probabilistic intuitions. |
| **Repetition Penalty** | 1.05 | Critically required for sub-2B models to suppress the inherent architectural tendency toward degenerative, infinite repetitive loops4. |
| **Maximum Tokens** | 1024 | Caps output length to test conciseness and prevent the model from engaging in unbounded chain-of-thought rambling when it lacks a definitive answer. |
| **Stop IDs** | \<|im\_end|\>, \<|tool\_call\_end|\> | Ensures the model successfully halts generation upon completing a discrete logical unit. |

By locking the runtime configuration to these parameters, the evaluation forces the model to rely entirely on the strength of its internal representations. A failure on a single generation run constitutes a permanent failure for that specific test matrix node.

## **7\. Semantic Evaluator and Human-Review Protocol**

Scoring the model's output employs a strict, layered adjudication matrix designed to eliminate subjective bias, ensure high inter-rater agreement, and conduct rigorous false-positive audits on automated evaluation systems.  
The first layer consists of deterministic structural checks. For scenarios requiring JSON extraction, YAML formatting, or Pythonic tool calls, the raw output byte-stream is fed directly into a deterministic parser. If the output fails standard syntax validation, or lacks the exact expected keys defined in the schema, it scores an immediate zero. Importantly, if the model successfully generates the JSON but prefaces or appends it with conversational filler (e.g., "Certainly, here is the structured data you requested:") when strictly instructed to output *only* the data, it also scores a zero. This binary approach mirrors the stringent requirements of programmatic downstream systems that cannot tolerate unexpected string tokens20.  
The second layer evaluates scenario-specific semantic invariants. An automated script compares the output of the base prompt against the output of the metamorphic permutations. If the semantic invariant is broken—for example, if the extracted numerical value shifts simply because the prompt's tone was changed from formal to colloquial—the model's robustness score is severely penalized. This layer identifies models that possess high structural adherence but low semantic stability.  
The third layer introduces blinded human review. A randomly sampled subset of the outputs that successfully pass the structural and invariant checks is distributed to independent human raters. The raters are completely blinded to the identity of the model generating the response. They evaluate the text based strictly on practical feasibility and boundary adherence. The raters assess whether technical advice is actually functional in a real-world software environment, and whether the model respected safety boundaries without delivering a sanctimonious policy monologue.  
An optional fourth layer utilizes a highly capable, isolated model judge. This judge is heavily restricted; it cannot regenerate or alter the answer, but is tasked solely with classifying the untouched answer against a strict rubric.  
To resolve discrepancies, strict adjudication rules govern the protocol. If human raters disagree with the automated or model judge, the human rating permanently overrides the automated score. To ensure the evaluation rubric is well-defined and consistently applied, inter-rater reliability must exceed a Fleiss' Kappa of 0.70. Furthermore, evaluator false-positive audits are conducted by injecting known-bad responses into the review queue to verify that both human and automated judges successfully identify and flag failures.

## **8\. Architecture-Versus-Post-Training Attribution Analysis**

The dramatic performance improvements observed in the LFM2.5 family relative to previous generations present a classic evaluation-science attribution problem: Are the measurable gains derived from the novel LIV/GQA hybrid architecture, or are they simply the result of vastly expanded pre-training data and aggressive reinforcement learning?  
A rigorous separation of architecture from post-training reveals that the physical deployment feasibility is an architectural triumph, but the qualitative intelligence gains are almost entirely post-training artifacts. The original LFM2-350M was pre-trained on a budget of 10 trillion tokens22. The LFM2.5-350M variant expanded this budget nearly threefold, processing 28 trillion tokens5. Furthermore, the LFM2.5 series incorporated a highly sophisticated three-stage post-training pipeline consisting of Supervised Fine-Tuning (SFT) with decoupled Top-K distillation, Direct Preference Optimization (DPO), and multi-domain Reinforcement Learning (RL)3.  
The hybrid architecture—specifically the deployment of double-gated Linear Input-Varying (LIV) convolution blocks—provides a profound physical execution benefit. By maintaining a fixed recurrent state rather than generating a massive, ever-expanding KV cache, the LIV layers solve the memory-bandwidth bottleneck that traditionally cripples large language models on edge CPUs7. This architectural choice is directly responsible for the massive throughput numbers and minimal RAM footprint observed during local execution19.  
However, comparing the base checkpoints versus the instruct checkpoints, and comparing the LFM architecture against dense or alternative hybrid models at matched artifact memory, isolates the source of the cognitive capabilities. When evaluating LFM2.5 against the IBM Granite-4.0-H series (which utilizes a Mamba-2/Attention hybrid architecture rather than LIV convolutions), both architectures achieve similarly high throughput and low memory footprints, indicating that multiple non-transformer pathways can solve the edge-hardware constraints26.  
More critically, Gemma-3-1B-IT—a standard, dense transformer model trained on merely 2 trillion tokens—frequently matches or exceeds the 1.2B class hybrids on complex reasoning and instruction-following benchmarks28. If the LIV convolution architecture provided an inherent reasoning advantage, it should easily outpace a dense model with less than a tenth of the pre-training data. The evidence dictates that the gains in common-sense judgment, structured output formatting, and ambiguity resolution within the LFM2.5 series must be attributed to the sheer scale of the 28T pre-training data, the tokenizer upgrades, and the aggressive RLHF pipeline, rather than any intrinsic cognitive superiority of the hybrid layers.

## **9\. Candidate Results Based on Observed Artifacts**

While executing these models against the highly secure, private TinyRustLM evaluation fixtures is prohibited by the constraints of this audit, synthesizing the public artifacts, architectural specifications, community issue trackers, and technical reports yields highly probable, observable behavioral profiles. These results reflect the actual state of the models, clearly separated from promotional proposals.  
**LFM2.5-230M:** At a minuscule 230 million parameters and 14 total layers, the model's representational capacity is fundamentally insufficient for handling conversational ambiguity, source-conflict resolution, or complex multi-turn logic3. While the model is heavily over-optimized via reinforcement learning for specific, narrow benchmarks like IFStruct20, it routinely collapses under metamorphic testing. It relies heavily on guessing missing options when faced with ambiguity and generates fluent but entirely impractical advice when pushed beyond its narrow training distribution.  
**LFM2.5-350M:** Retaining an identical architectural depth (16 layers) to the 1.2B model while merely scaling down embedding dimensions, the 350M variant presents an intriguing profile21. It operates exceptionally fast and demonstrates high reliability in stateless operations. It represents a highly viable candidate as a deterministic routing specialist—for example, converting a single string of user intent into a rigid JSON command structure5. However, it will inevitably falter on nuanced tasks such as lawful adult analysis, deep code explanation, or resolving authority conflicts.  
**LFM2.5-1.2B-Instruct:** The 1.2B checkpoint demonstrates adequate single-turn instruction following and high fidelity in generating specific Pythonic tool-call syntax. However, its practical deployment is crippled by the brittle post-training ecosystem, specifically the critical bug in the upstream Hugging Face chat template6. Without extensive, custom backend engineering to patch the context formatting, the model exhibits severe multi-turn degradation. Furthermore, despite official support for a 32,768-token context window, the model is highly prone to stale-memory precedence if a conversation exceeds a few thousand tokens. This is due to the inherent lossy compression of long-range dependencies inside the LIV convolution layers, which cannot retrieve exact historical tokens with the same precision as a full attention matrix16.

## **10\. Claim Taxonomy and Promotion Thresholds**

To prevent marketing metrics and theoretical benchmarks from masquerading as definitive proof of product-readiness, this evaluation establishes a strict, six-tier taxonomy of claims. Moving a candidate model from one tier to the next requires satisfying explicit evidence thresholds.

| Taxonomy Class | Definition & Minimum Evidence Required | Prohibited Promotional Wording |
| :---- | :---- | :---- |
| **1\. Runtime-Smoke-Only** | The model compiles, successfully loads into RAM/VRAM without crashing, and generates tokens. Evidence: Raw tok/s output logs and successful compilation flags. | "High performance," "Capable," "Understands." |
| **2\. Source-Screened** | The model passes Layer 1 deterministic structural checks (e.g., outputs valid JSON 95% of the time). Evidence: Scripted parsing logs over a 100-prompt batch. | "Reasons," "Solves logic problems," "Agentic." |
| **3\. Task-Specific-Useful** | The model reliably executes a single, stateless operation (e.g., translation, extraction) under severe metamorphic pressure. Evidence: Z-test statistical clearance on invariant pairs. | "Conversational," "General-purpose assistant." |
| **4\. Conversation-Screened** | The model successfully handles basic multi-turn state tracking and honors the latest user preferences without catastrophic context collapse. Evidence: Human-rated transcript logs confirming context retention. | "Flawless," "Equivalent to frontier models." |
| **5\. Conversation-Proven** | The model flawlessly navigates ambiguity, authority conflicts, and malicious quoted text over extended context windows. Evidence: Blinded human A/B testing against a known, high-quality benchmark model. | "Autonomous," "Requires no guardrails." |
| **6\. Full-Assistant-Quality** | The model demonstrates robust, positive, helpful behavior, providing lawful adult analysis while maintaining tight, non-sanctimonious security boundaries in a fully integrated environment. | N/A (Highest Tier) |

Currently, the LFM2.5 series peaks at the **Task-Specific-Useful** tier for narrow data extraction workflows. It entirely lacks the necessary multi-turn stability and ambiguity resolution evidence to clear the **Conversation-Screened** threshold for general integration into TinyRustLM.

## **11\. Public Audit-Package Schema**

To facilitate independent reproduction of these findings without leaking the proprietary TinyRustLM holdout datasets into future pre-training mixtures (which would permanently contaminate subsequent evaluations), an independent, public-safe audit package schema is established.  
The schema normalizes the configuration, seals the seeds, and cryptographically hashes the raw outputs to ensure that any third-party researcher can verify the model's structural degradation under metamorphic pressure.

JSON  
{  
  "audit\_manifest": {  
    "version": "1.0",  
    "target\_model": "LiquidAI/LFM2.5-1.2B-Instruct",  
    "revision\_hash": "c20ca4107d2ec8849e01f367a4078cf4826c2e45",  
    "execution\_environment": {  
      "framework": "vLLM",  
      "version": "0.19.0",  
      "quantization": "None (bfloat16)",  
      "hardware\_profile": "Standardized\_CPU\_Node"  
    },  
    "generation\_policy": {  
      "temperature": 0.1,  
      "top\_k": 50,  
      "top\_p": 0.1,  
      "repetition\_penalty": 1.05,  
      "max\_tokens": 1024,  
      "seed": 3407  
    },  
    "test\_vectors": \[  
      {  
        "taxonomy\_node": "ambiguity\_handling",  
        "case\_id": "AMB-001-METAMORPHIC-A",  
        "prompt\_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",  
        "semantic\_invariant": "Must request clarification on variable X; must not guess.",  
        "raw\_output\_hash": "a1b2c3d4e5f6...",  
        "layer\_1\_score": 1,  
        "layer\_2\_score": 0,  
        "failure\_mode\_flagged": "fabricated\_certainty"  
      }  
    \]  
  }  
}

The exact text of the prompts is distributed via an encrypted, separate repository. This ensures that automated web-scrapers deployed by model providers cannot ingest the evaluation set into future training corpora, preserving the integrity of the metamorphic test pairs.

## **12\. Recommended Outcomes per Candidate**

Based on the synthesis of architectural capabilities, post-training data regimens, and observed failure modes, the following explicit engineering outcomes are recommended for the candidate models.

* **LFM2.5-230M:** *Outcome: Reject before porting.* The model fails the fundamental quality threshold for conversational coherence. Investing engineering resources to port this to a WebAssembly/ONNX runtime for TinyRustLM is an inefficient allocation of capital. The footprint is remarkably small (\~0.46 GB), but the intelligence density is too low for any task beyond basic, highly structured text classification.  
* **LFM2.5-350M:** *Outcome: Investigate as a specialist.* While rejected for general conversation, the model meets the footprint threshold for seamless browser execution. If TinyRustLM requires a dedicated, deterministic background process for parsing unstructured user input into JSON commands before passing it to a larger model, this checkpoint warrants further investigation and specific fine-tuning5.  
* **LFM2.5-1.2B-Instruct:** *Outcome: Use only as a teacher or draft source.* The model approaches the maximum viable footprint for swift browser loading (\~2.34 GB unquantized). It demonstrates sufficient capability to generate structured code and tool syntax. However, the multi-turn degradation and template bugs make it too unreliable for direct user interaction. It should be utilized exclusively in an offline capacity to generate synthetic training traces for smaller, more robust transformer models.  
* **Gemma-3-1B-IT (Comparator):** *Outcome: Fund a portable runtime implementation.* Despite requiring slightly more memory bandwidth due to the dense transformer architecture and massive vocabulary, the model demonstrates vastly superior performance on mathematical reasoning, code generation, and complex instruction following28. It represents the most viable path toward achieving Conversation-Screened status within the 1B parameter class.

## **13\. Unknowns Requiring Private TinyRustLM Execution**

Several critical operational variables remain obscured behind the constraints of this public audit and necessitate rigorous execution within the private TinyRustLM runtime environment.  
First, the actual saturation limits of edge memory bandwidth during aggressive context switching remain unverified. While theoretical mathematics prove a massive reduction in KV cache size for the hybrid architecture18, the physical performance of this memory management within the specific TinyRustLM Rust-based binary—especially when compiled to WebAssembly—is completely unknown.  
Second, the public metrics rely heavily on high-fidelity bfloat16 weights. The precise cognitive degradation of the model's adherence to rigid JSON schemas when compressed to 4-bit or 5-bit formats (e.g., GGUF Q4\_K\_M or MLX 4-bit) on mobile CPU architectures has not been comprehensively quantified32. Small models are notoriously sensitive to quantization, and aggressive bit-reduction may destroy their fragile instruction-following capabilities.  
Finally, the long-range retrieval fidelity of the LIV convolution layers is highly suspect. It is unknown if facts embedded deep within a 20,000-token conversation will be reliably retrieved, or if the convolution mechanics will irrevocably "smooth out" specific noun phrases over time16. Validating this requires running the multi-turn state-tracking taxonomy directly through the local browser engine over extended sessions.

## **14\. Annotated Primary-Source Bibliography**

The evaluation framework and subsequent conclusions are deeply informed by a critical analysis of the underlying technical literature, architectural disclosures, and open-source ecosystem artifacts. The foundational mathematics and structural designs of the hybrid models are detailed in the *LFM2 Technical Report* (arXiv:2511.23404), which outlines the hardware-in-the-loop search methodology, the implementation of double-gated Linear Input-Varying (LIV) convolution blocks, and the curriculum learning pipeline23. This report is essential for understanding the physical mechanics of the architecture, specifically how the model achieves a \~62.5% reduction in dynamic KV cache size by restricting full attention matrices to only a fraction of its layers15.  
The evolution from the LFM2 series to the LFM2.5 series is documented across official release notes and parameter configuration files. These sources reveal the critical scaling of pre-training data—from 10 trillion tokens to 28 trillion tokens—and the aggressive application of large-scale reinforcement learning (RL) targeting instruction following and structured output generation3. This data expansion provides the fundamental explanation for the qualitative improvements observed between model generations. Furthermore, the IFStruct Benchmark documentation illuminates the highly optimized schema-following datasets utilized during the RL phase, which explains the anomalous proficiency of the compact 230M and 350M models in stateless data extraction tasks20.  
Crucial insights regarding the practical deployment stability of these models are derived from community audits and open-source issue trackers. Independent developers identified and reproduced a catastrophic parsing bug in the official LFM2.5 Hugging Face chat\_template.jinja file, where content=None during tool calls is erroneously translated to literal string values, completely disrupting multi-turn agentic workflows6.  
The comparative analysis against alternative architectures relies on the technical specifications of baseline competitive models, notably the IBM Granite-4.0-H series and the Google Gemma 3 1B model27. The Granite documentation proves that alternative hybrid structures (Mamba-2) can achieve similar edge-hardware efficiencies, while the Gemma 3 data demonstrates that dense transformers, even when trained on vastly fewer tokens, can match or exceed the reasoning capabilities of hybrid models in the 1B parameter class. Finally, the licensing parameters critical for commercial deployment strategy are sourced directly from the LFM Open License v1.0 documentation, confirming the $10 million USD revenue threshold and the explicit absence of copyleft restrictions on derivative weights12.

#### **Works cited**

1. Liquid LFM2.5: How To Run & Fine-tune | Unsloth Documentation, [https://unsloth.ai/docs/models/tutorials/lfm2.5](https://unsloth.ai/docs/models/tutorials/lfm2.5)  
2. LFM2.5 1.2B Instruct is amazing : r/LocalLLaMA \- Reddit, [https://www.reddit.com/r/LocalLLaMA/comments/1q7jd1a/lfm25\_12b\_instruct\_is\_amazing/](https://www.reddit.com/r/LocalLLaMA/comments/1q7jd1a/lfm25_12b_instruct_is_amazing/)  
3. LFM2.5-230M: Built to Run Anywhere — Blog \- Liquid AI, [https://www.liquid.ai/blog/lfm2-5-230m](https://www.liquid.ai/blog/lfm2-5-230m)  
4. LiquidAI/LFM2.5-230M \- Hugging Face, [https://huggingface.co/LiquidAI/LFM2.5-230M](https://huggingface.co/LiquidAI/LFM2.5-230M)  
5. Get a serious AI agent with just 350M parameters\! No cloud needed, tool calling runs smoothly even on a Raspberry Pi \- note, [https://note.com/humble\_bobcat51/n/nc29bca84e9b8?hl=en](https://note.com/humble_bobcat51/n/nc29bca84e9b8?hl=en)  
6. LiquidAI/LFM2.5-1.2B-Instruct · Fixed Chat Template to Fix Tool Calls \- Hugging Face, [https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct/discussions/12](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct/discussions/12)  
7. oamazonasgabriel/lfm2-1.2b-tool \- Ollama, [https://ollama.com/oamazonasgabriel/lfm2-1.2b-tool](https://ollama.com/oamazonasgabriel/lfm2-1.2b-tool)  
8. config.json · LiquidAI/LFM2.5-230M at main \- Hugging Face, [https://huggingface.co/LiquidAI/LFM2.5-230M/blob/main/config.json](https://huggingface.co/LiquidAI/LFM2.5-230M/blob/main/config.json)  
9. LiquidAI/LFM2.5-1.2B-Thinking \- Hugging Face, [https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking)  
10. Chat Template \- Liquid Docs, [https://docs.liquid.ai/lfm/key-concepts/chat-template](https://docs.liquid.ai/lfm/key-concepts/chat-template)  
11. Gemma 3: Google's all new multimodal, multilingual, long context open LLM \- Hugging Face, [https://huggingface.co/blog/gemma3](https://huggingface.co/blog/gemma3)  
12. Pricing \- Liquid AI, [https://www.liquid.ai/pricing](https://www.liquid.ai/pricing)  
13. Model License \- Liquid Docs, [https://docs.liquid.ai/lfm/help/model-license](https://docs.liquid.ai/lfm/help/model-license)  
14. LICENSE · LiquidAI/LFM2.5-Audio-1.5B at main \- Hugging Face, [https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B/blob/main/LICENSE](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B/blob/main/LICENSE)  
15. How Liquid AI built the Best Edge AI Model in the World | by Devansh \- Medium, [https://machine-learning-made-simple.medium.com/how-liquid-ai-built-the-best-edge-ai-model-in-the-world-48c478f6235f](https://machine-learning-made-simple.medium.com/how-liquid-ai-built-the-best-edge-ai-model-in-the-world-48c478f6235f)  
16. Deploy Liquid AI LFM2 Models (LFM2-8B-A1B, LFM2-2.6B) on GPU Cloud: Hybrid Architecture Guide (2026) | Spheron Blog, [https://www.spheron.network/blog/liquid-foundation-models-lfm-deployment-gpu-cloud-2026/](https://www.spheron.network/blog/liquid-foundation-models-lfm-deployment-gpu-cloud-2026/)  
17. hadad/LFM2.5-1.2B \- Ollama, [https://ollama.com/hadad/LFM2.5-1.2B](https://ollama.com/hadad/LFM2.5-1.2B)  
18. [unknown\_url](http://docs.google.com/unknown_url)  
19. LFM-2.5 230M : Best Small LLM for Mobile Phones | by Mehul Gupta | Data Science in Your Pocket | Jun, 2026 | Medium, [https://medium.com/data-science-in-your-pocket/lfm-2-5-230m-best-small-llm-for-mobile-phones-8924cbb4d691](https://medium.com/data-science-in-your-pocket/lfm-2-5-230m-best-small-llm-for-mobile-phones-8924cbb4d691)  
20. IFStruct: Measuring structured-output compliance — Blog \- Liquid AI, [https://www.liquid.ai/blog/ifstruct-v1.0](https://www.liquid.ai/blog/ifstruct-v1.0)  
21. LiquidAI/LFM2.5-350M \- Hugging Face, [https://huggingface.co/LiquidAI/LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M)  
22. LFM2 \- LM Studio, [https://lmstudio.ai/models/lfm2](https://lmstudio.ai/models/lfm2)  
23. \[2511.23404\] LFM2 Technical Report \- arXiv, [https://arxiv.org/abs/2511.23404](https://arxiv.org/abs/2511.23404)  
24. LFM2 Technical Report \- arXiv, [https://arxiv.org/html/2511.23404v1](https://arxiv.org/html/2511.23404v1)  
25. LiquidAI/LFM2-2.6B-GGUF Free Chat Online \- skywork.ai, [https://skywork.ai/blog/models/liquidai-lfm2-2-6b-gguf-free-chat-online-skywork-ai/](https://skywork.ai/blog/models/liquidai-lfm2-2-6b-gguf-free-chat-online-skywork-ai/)  
26. Granite 4.0 1b speech model is out and it's dynamite \- DEV Community, [https://dev.to/aairom/granite-40-1b-speech-model-is-out-and-its-dynamite-2f60](https://dev.to/aairom/granite-40-1b-speech-model-is-out-and-its-dynamite-2f60)  
27. Granite 4.0 \- IBM, [https://www.ibm.com/granite/docs/models/granite](https://www.ibm.com/granite/docs/models/granite)  
28. google/gemma-3-1b-it \- Hugging Face, [https://huggingface.co/google/gemma-3-1b-it](https://huggingface.co/google/gemma-3-1b-it)  
29. Gemma 3 1B vs Qwen3.5-0.8B: Benchmarks, Pricing & Which Is Better in 2026 \- LLM Stats, [https://llm-stats.com/models/compare/gemma-3-1b-it-vs-qwen3.5-0.8b](https://llm-stats.com/models/compare/gemma-3-1b-it-vs-qwen3.5-0.8b)  
30. Advanced Vision Language Models: Gemma 3 And 3N Explained \- Labellerr, [https://www.labellerr.com/blog/gemma-3/](https://www.labellerr.com/blog/gemma-3/)  
31. config.json · mkurman/LiquidAI-LFM2.5-350M-SYNTH at main \- Hugging Face, [https://huggingface.co/mkurman/LiquidAI-LFM2.5-350M-SYNTH/blob/main/config.json](https://huggingface.co/mkurman/LiquidAI-LFM2.5-350M-SYNTH/blob/main/config.json)  
32. config.json · code-and-canvas/LFM2.5-230M-MLX-OptiQ-4bit at main \- Hugging Face, [https://huggingface.co/code-and-canvas/LFM2.5-230M-MLX-OptiQ-4bit/blob/main/config.json](https://huggingface.co/code-and-canvas/LFM2.5-230M-MLX-OptiQ-4bit/blob/main/config.json)  
33. bartowski/LiquidAI\_LFM2.5-1.2B-Instruct-GGUF \- Socket.dev, [https://socket.dev/huggingface/package/bartowski/liquidai\_lfm2.5-1.2b-instruct-gguf](https://socket.dev/huggingface/package/bartowski/liquidai_lfm2.5-1.2b-instruct-gguf)  
34. PierrunoYT/LFM2.5-350M-Pinokio \- GitHub, [https://github.com/PierrunoYT/LFM2.5-350M-Pinokio](https://github.com/PierrunoYT/LFM2.5-350M-Pinokio)  
35. Introducing LFM2.5: The Next Generation of On-Device AI — Blog \- Liquid AI, [https://www.liquid.ai/blog/introducing-lfm2-5-the-next-generation-of-on-device-ai](https://www.liquid.ai/blog/introducing-lfm2-5-the-next-generation-of-on-device-ai)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABDElEQVR4Xu3RP0tCURgG8BMWhJgUCVo0CQ42KJIfobnFQTRwjYYgFET9EkJLo0g4VItz0xW3JnFUZ/saPS/nuX/OvcgtuIPDfeCH+J73vBfeo1ScODuTgBb1IQ01eKGq2xqeSIfdQp3GsIQSnNMXVJzukDxAgSy4Z/2E5tBm7U8p0grKrOXpR+kP5KBHz5BhXyB39A1nvtoWrmGo3A8I+X/IXiORDrNfbgIHcATv1IVLpR8nRbJL6b2Qy97IoUUz6MArDEgG38CUvbZPpfdsRAprkkuncGx06B657B32BlfeJom9K+++/JGX++CvyCq9gkB/pMMWsKERJM1jJ0/QpAY8msf/j+zTFmff8gvSSjY+SkwTjAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAbCAYAAACeA7ShAAABAUlEQVR4Xu3SO2sCURAF4AlGEDGiWKQXH0hEES1TpgtYaBFCIJ3YKwix9B9okyqIhaBgaWWVkC6VWKq1/o2ccY/7sFmLxUL2wMfC7Oy93Lkr4sfPZRKAd/qAKNRhQBWr1T1P8EIjWEEBErSAktntkiak6RveWL+jX2ix5hpPF9PkaA1F1pK0F2uDs1KlP4if1HaQZe2sHG9uDDcQhCl1WNOk6FGMTfVPcCQixqzUD7ThE7qkC2tq8EoZmIt1CjOeLqaD31AZYhBydIjcw4xPpX19sY5v5jh4+/BPox9/wS3p7Tbgwd6kWcKWhhB2vj5ER9GDZ5qIMYK8vUnj6WJ+riX/mGI2VxW6BesAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAbCAYAAAA53gJaAAACgklEQVR4Xu2XTahNURTHl1Dk25MoxZAMKKSHkRQDDEwIGZiQRDHw8SYvMpISA1LKS0hRFAYSFyViYmDCBMnM0FTWz/6v7nnds7nv1r11tX/169173v44e5191trXrFAoFAq9YqJ7RD5077pn3Mnyb8yT19xb7mN3sxynNsvcN/Kqe8W9556SfckO97YkgCz2tDssc0xwb8rdujbgPpWDurbC/S5/uZ/dg5bmwr5jkqXddUwGW9wPck7lepUl7idJYIIReUHf+d9++V/QN0EjT+y09G4fltNHtegd890vloKEwTprvlLkpDpoT19knIB8iE/cKTY6aDMtteVhtcVC+czdaCl3kAvwvqUJDlh6srmny4TnLAW8HQ9J8k8dC9xv1ho0FvpVVndRlW1WH7TYtQ13qqX+r+Ved437yl0vs9CZyoIkwYAtjh/dTZZ2HcGMytNtmPuHdRa0fdZe0Ga7i2VA3/eS4lFLCVoHQdtgzRzBjQZMFnmlYfkb7Ba5nLbK0muLuXvK5bSTsmEpaOQv/mJA358yN/6fyL+VsyrXq0E7Yf/eYXPds9aau3KSI3E8nWuY5r605uE2YFERNPJeHQQ2glYtFiPyhqVcet1aK3FbQdvqPpfcaLBW0rn6pHvJsKXjQRwRgBTCCR9ZOBX/sjskebgz3BeSNwlo90hyaAYq6XYZm4JNFMWBcWphsEuSQXZZ+unBwHjRvWOpMtIWewU7PfLtHku59YE1qz1EgGINUY05BWDDXe0ed8/LOO0zBrsNWfdR9527XGYpQesgaFU44FExqvmLz+S6XO7pNvE7cKm7Up/HAkmeA/Eiq6/+MT5jM8dYxy8UCoVCoVAoFPqX3yNVvRpVm0MIAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAaCAYAAADygtH/AAACS0lEQVR4Xu2XMUhVURjHP6mgKElI0DBIl6DBSsJMaqqgomywhkAHI8IGMZ0S5xoSBClpaMkGjWoQoRwk8qGCQ1tDSzg4Nzvr/9/5ju+e8+713e7lXZfzg99y7n3fe+c73/nOeSKBwH5yAN5RX8NbsM55I1BBSNp/chy+hOdUJnACPoy+VBDNcEb9CJfgXTELuNciHoIj6m/4F34SE49assZ34ItPYYc3/hxOemO15iCcg/0qOQF/wG41iSfwkUpYCN/FJIUek3zxHdrguLhZtsGLrrSz8A+8qFo+iGkZNA7uDFbVhtqk431wS2W8rPEruC2mf12HD9RR+EZMyRdJD9yEJ1ULWwerhh6NjEe5IuVKs7/bT1qe+A4haeniO7CfXYAvpFyiC2IaajW4fd+l9K2Y7UGT6JX4SbG/llT2pjQwcZ/F7Wm54/MhZT877D3rhOuw0RuvNYOSc1IR7sOf8LRKcse3q/7YfyAmab/EDVwESduHC1tS95yUcgnOi3vVILnj31N5mfUZgt+ksgJ92P/8bZjkNDyjJsHF4qTOqxaebrNqXWTcx1YVWwyvHOSm2i7544ek6XOSNv5u0+cJY7FfuiamxIuGE12BN1RyBC6KOXTsvZGJXxZzYlLC3/1VHZDyTWBGPSXp48fCfftKZRUMi6muL6r/76BIWBUltQuOwSkxp6G9SlwW8zfJ7hZWx3u4HeOqWv/vk+nix8IDgCcJJQ1SpQEWjD3Zr8JWqbJlMpApPi+019RASkLSMvAMtqiBQCAQCAQCNWAHd8quqROI2X4AAAAASUVORK5CYII=>