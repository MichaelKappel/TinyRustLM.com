# **Qwen3-0.6B SLM2 Composition Behavioral Contract: Tokenizer2, Template2, Sampling2, and Prompt2**

## **1\. Executive Semantic-Closure Recommendation**

To achieve cross-platform deterministic execution and exact numerical parity for the Qwen3-0.6B small language model (SLM) across Rust, .NET, JavaScript, and WebAssembly (WASM) browser environments, the non-weight execution pipeline must be sealed behind a strict declarative contract. The legacy paradigm of distributing unbounded executable scripts, such as Python pre-tokenizers or arbitrary Jinja templates, introduces critical security vulnerabilities, environment-specific variations, and non-deterministic state mutations that violate the constraints of edge-deployed environments.  
The analysis indicates that achieving exact semantic closure for the pinned revision c1899de289a04d12100db370d81485cdf75e47ca requires substituting the publisher's implicit runtime logic with four bounded, declarative components1. First, Tokenizer2 must operate as a byte-level transducer utilizing offline-compiled deterministic finite automata (DFA) for regular expression matching and Byte-Pair Encoding (BPE) operations. Second, Template2 must replace Jinja evaluation with a strict, formally verifiable finite state machine that handles conversational formatting and context retention natively. Third, Prompt2 must provide an authoritative context assembly schema to govern the token budget and enforce project policy over untrusted inputs. Finally, Sampling2 must implement a mathematically deterministic logit processing pipeline requiring exact IEEE 754 bit-level parity to eliminate floating-point drift across hardware architectures3. The implementation shall explicitly reject ambient runtime defaults, silent input repairs, and fallback parsing paths, thereby establishing a zero-trust boundary against adversarial string injections and token smuggling.

## **2\. Pinned Publisher Tokenizer Behavior**

At the specified revision, the Qwen3-0.6B tokenizer operates as a Byte-Level Byte-Pair Encoding (BPE) pipeline4. An exact reconstruction of this pipeline reveals a series of sequential transformations that must be immutably preserved to ensure that downstream model inference aligns with the training distribution.  
The publisher tokenizer does not perform canonical Unicode normalization (e.g., NFC or NFD) by default, passing raw, unnormalized codepoints directly to the pre-tokenizer6. The pre-tokenizer relies on a sequential regular expression split operation to enforce sub-word boundaries. The exact pattern governing this split is (?i:'s|'t|'re|'ve|'m|'ll|'d)|\[^\\r\\n\\p{L}\\p{N}\]?\\p{L}+|\\p{N}| ?\[^\\s\\p{L}\\p{N}\]+\[\\r\\n\]\*|\\s\*\[\\r\\n\]+|\\s+(?\!\\S)|\\s+7. This expression forces the isolation of English contractions, groups continuous letter sequences defined by the Unicode \\p{L} property, isolates individual numerical digits defined by the \\p{N} property, and groups specific whitespace and punctuation characters. It is critical to note that the reliance on Unicode property escapes is notoriously brittle and inconsistent across C++ implementations (such as std::regex) and browser-native engines9.  
Following the regex split, the string chunks are mapped into a 256-character base vocabulary using a static byte-to-unicode mapping originally derived from the GPT-2 architecture11. This translation shifts non-printable bytes into a visible Unicode range, transforming a standard space into the character Ġ, which allows the subsequent BPE algorithm to operate on contiguous character strings rather than raw byte arrays11. The byte-mapped characters then undergo greedy pairwise merging based on integer rank precedence derived from a static merge table.  
The vocabulary profile of Qwen3-0.6B is structurally divided into a standard domain and a special token domain. The base vocabulary occupies IDs 0 through 151,642, resulting in 151,643 standard tokens. Added special tokens occupy IDs 151,643 through 151,668, creating a total contiguous domain of 151,669 tokens13. Externally observable behaviors that must survive the conversion to Tokenizer2 include the strict enforcement of digit splitting, the exact whitespace trailing logic for newline characters, and the preservation of invalid UTF-8 bytes through the byte-fallback mechanism16.

| Token ID Range | Token Category | Semantic Role |
| :---- | :---- | :---- |
| 0 \- 151642 | Standard BPE | Byte-level merges representing natural language, code, and raw bytes. |
| 151643 | \`\< | endoftext |
| 151644 \- 151645 | \`\< | im\_start |
| 151646 \- 151656 | Multimodal Markers | Bounding boxes, image pads, video pads, and object references. |
| 151665 \- 151668 | Blank Special Tokens | Reserved slots for extended semantic signaling. |

## **3\. Tokenizer2 Algorithms and Binary Representation**

To guarantee deterministic execution within constrained browser environments, Tokenizer2 must be implemented as a lock-free, zero-allocation streaming processor. The architecture entirely abandons runtime regular expression compilation in favor of an offline-compiled Deterministic Finite Automaton (DFA).

### **Exact Encoding and Decoding Algorithms**

The encoding process begins with the ingestion of host strings, receiving UTF-16 from JavaScript or .NET and UTF-8 from Rust. The string is transduced strictly into a raw byte array. Prior to structural pre-tokenization, this raw byte array is scanned using an Aho-Corasick automaton containing all valid special token string representations (e.g., \<|im\_start|\>). Any matches found during this pass must be assessed against the Prompt2 trust boundary to prevent adversarial token injection.  
The byte array is then routed through the static DFA representing the publisher's regex, yielding a sequence of byte spans. Each byte within a span is translated to its mapped Unicode character using the static 256-element array lookup. For BPE rank resolution, each span initializes a linked list of single-character tokens. The algorithm iteratively scans the list for adjacent pairs, performing ![][image1] lookups in a binary Double-Array Trie (DAT) to identify the pair with the lowest integer rank18. The lowest-ranked pair is merged, and the process repeats until no valid pairs exist in the Trie. In the event of multiple pairs possessing the exact same minimum rank, deterministic tie-breaking dictates that the leftmost pair in the sequence is prioritized20.  
The decoding algorithm reverses this process. It accepts an array of integer token IDs, maps them back to their canonical string representations (excluding special tokens, which are handled structurally by Template2), reverses the GPT-2 byte-to-unicode mapping, and emits raw UTF-8 bytes.

### **Binary Representation Specification**

Loading large JSON dictionaries for vocabularies and merge rules at runtime violates strict memory and initialization limits in WebAssembly. Therefore, Tokenizer2 utilizes a tightly packed, compiled binary format. The file begins with a fixed-size header specifying magic bytes, format version, and the total vocabulary size. This is followed by a special token block, formatted as an array of tuples containing the token length, the UTF-8 bytes, and the corresponding Token ID.  
The core of the binary format is the BPE Double-Array Trie (DAT). This compacted index structure maps byte pairs to integer ranks, providing the necessary ![][image1] lookup time per adjacent token pair. Because malicious inputs can trigger adversarial sequence lengths designed to induce integer overflows, the binary format mandates that all rank widths and length calculations utilize saturating or explicitly checked integer arithmetic19. This prevents buffer over-reads within the linear memory of the WASM sandbox. The binary format is designed for streaming loads, allowing the host application to map the DAT directly into a SharedArrayBuffer for zero-copy access by worker threads.

## **4\. Unicode and Hostile-Input Contract**

Language models are highly sensitive to Unicode anomalies, and byte-level BPE tokenizers inherently generate and process ill-formed UTF-84. The Tokenizer2 contract mandates strict, deterministic handling of adversarial Unicode and platform-specific string anomalies across all target runtimes.  
JavaScript and .NET represent strings internally as UTF-16, which allows for the presence of unpaired surrogate code units. When the host boundary integration (e.g., TextEncoder.encodeInto) encounters an unpaired surrogate, it shall not throw an exception nor silently strip the character; it must deterministically replace the surrogate with the standard Unicode Replacement Character U+FFFD21. Tokenizer2 will subsequently process the exact byte sequence 0xEF, 0xBF, 0xBD.  
Because Tokenizer2 operates strictly at the byte level, sequences of bytes that do not form valid UTF-8 scalar values must be preserved natively. The language model can and will generate standalone partial bytes (e.g., 0xE2), which map to independent tokens in the BPE vocabulary16. During generation, the decoder must accumulate these emitted bytes in a streaming buffer. If the Sampling2 component emits an End-Of-Sequence (EOS) token or reaches the strict token budget limit while the accumulated buffer contains a trailing incomplete UTF-8 sequence, the host's TextDecoder shall be configured with fatal: true (or equivalent strict mode)24. This ensures the application drops or explicitly flags the partial bytes rather than silently corrupting the output stream with host-specific fallback logic.  
Normalization lookalikes (e.g., precomposed characters versus combining sequences) are processed exactly as received. No Unicode normalization (NFC/NFD) is applied at any stage6. A visually identical user prompt composed of different scalar sequences will yield entirely different token streams, preserving the exact statistical distribution observed during the publisher's pre-training phase. Zero-Width Joiners (ZWJ), emoji sequences, right-to-left (RTL) controls, NUL bytes, tabs, and nonbreaking spaces are processed strictly as their constituent raw byte sequences without any semantic interpretation by the tokenizer.

## **5\. Special-Token Trust Boundary**

Special tokens in the Qwen3-0.6B architecture govern critical structural semantics, including chat formatting, reasoning visibility, and multimodal anchoring13. Permitting untrusted user data to evaluate as special tokens creates a severe vulnerability known as Prompt Smuggling or Special Token Injection26. This allows adversaries to artificially close a user turn, impersonate the system role, or prematurely terminate generation constraints.  
The SLM2 composition enforces a strict trust boundary separating structural tokens from literal user text.

| Route | Provenance | Special Token Processing Rule |
| :---- | :---- | :---- |
| **Trusted** | Template2 State Machine, System Policy | Emitted directly as integer IDs (e.g., 151644). Bypasses the string encoder entirely. |
| **Untrusted** | User Input, RAG Memory, Tool Outputs | Scanned by Aho-Corasick automaton. Literal matches to special token strings (e.g., \`\< |

Text originating from the untrusted payload route must never produce a token ID within the 151643 to 151668 domain. The implementation explicitly forbids the legacy practice of accepting user-provided special tokens as a mechanism for chat framing. There must be zero overlap between the byte-encoded output of a user string and the integer ID domain of structural markers.

## **6\. Template2 Declarative State Machine**

The publisher's reference implementation utilizes a Jinja template that dynamically evaluates conditional logic and loops to render conversation history, conditionally emitting \<|im\_start|\>system\\n, checking for an enable\_thinking variable, and managing tool-call formatting28. Executing an Abstract Syntax Tree (AST) for Jinja in a browser is computationally inefficient, requires massive dependencies, and poses arbitrary execution risks30. Template2 translates the entirety of this logic into a bounded Deterministic Finite Automaton (DFA).

### **State Machine Definition and Transitions**

The DFA tracks the conversational context through discrete states: INIT, SYSTEM\_TURN, USER\_TURN, ASSISTANT\_THINKING, ASSISTANT\_RESPONDING, and END.

> 1. **System Initialization**: The state machine begins in INIT. It transitions to SYSTEM\_TURN, directly appending the 151644 token ID (\<|im\_start|\>), followed by the byte-encoded string "system\\n". It then encodes the authoritative system prompt provided by Prompt2, appends the 151645 token ID (\<|im\_end|\>), and encodes a final \\n.  
> 2. **User Framing**: Transitioning to USER\_TURN, the machine emits 151644, encodes "user\\n", encodes the untrusted user payload, emits 151645, and appends \\n.  
> 3. **Reasoning and Response Generation**: When preparing the prompt for the model's forward pass, the DFA transitions from USER\_TURN to the assistant generation phase. If the enable\_thinking configuration is set to true (the default for Qwen3 reasoning models), the machine emits 151644 and encodes "assistant\\n". Qwen3 models expect the reasoning content to follow immediately after this header, separate from the final response32. If enable\_thinking is false, the machine encodes the hardcoded structural bypass sequence \\n\\n\\n\\n before the response32.  
> 4. **Rolling Checkpoint Mechanics**: A critical feature of Qwen3 multi-turn reasoning is the preserve\_thinking semantic33. When re-rendering history for multi-turn conversations, older models discarded the assistant's intermediate reasoning to save tokens. Template2 must maintain a rolling checkpoint. It traverses the message list to find the latest user turn; for any assistant replies following that index, it preserves the full reasoning blocks. This guarantees KV-cache stability across conversational turns, avoiding the re-serialization of past turns which invalidates prefix caching and degrades inference speed35.

To prove parity against the publisher reference, the validation strategy mandates generating a corpus of 10,000 randomized message arrays (permuting roles, complex tool calls, and enable\_thinking states). The token ID arrays produced by the Template2 DFA must achieve absolute bit-for-bit equivalence with the output of the publisher's apply\_chat\_template script. Any unsupported branches or malformed role orderings provided by the application state must be rejected with a typed error rather than silently repaired.

## **7\. Prompt2 Authority and Context Assembly**

Prompt2 functions as an explicit authority-ordered context contract, abandoning the legacy concept of treating prompts as hidden, monolithic text blobs. It governs the strict assembly of the context window and manages the token budget across Qwen3-0.6B's finite 32,768 token capacity28.

### **Authority Hierarchy**

Context assembly follows a deterministic priority queue, ensuring that critical safety alignments are never evicted from the context window:

> 1. **System Policy**: Immutable product constraints enforcing lawful adult helpfulness and explicit harm boundaries.  
> 2. **Current User Turn**: The immediate, primary instruction requiring execution.  
> 3. **Trustworthy Local State**: Application-injected context parameters (e.g., high-fidelity timestamps, validated user profiles).  
> 4. **Untrusted Retrieved Memory**: External retrieval-augmented generation (RAG) chunks and tool outputs. These are wrapped in standardized declarative XML markers (e.g., \<evidence\>) to segment them from execution instructions, preventing agentic compliance momentum attacks27.  
> 5. **Prior Conversation**: The sliding window of previous user and assistant interactions.

### **Context Budget and Progressive Degradation**

When the fully assembled token count exceeds the dynamic maximum token budget, Prompt2 executes a deterministic five-pass progressive degradation strategy36:

> 1. **Pass 1**: Prune the oldest prior conversation turns. This must be executed atomically; both the user query and the corresponding assistant response are dropped simultaneously to prevent orphan responses from poisoning the attention mechanism.  
> 2. **Pass 2**: Prune untrusted retrieved memory, explicitly dropping the lowest-ranked RAG chunks based on application-provided relevance scores.  
> 3. **Pass 3**: Substitute middle conversation history with a structural summary marker (e.g., \<history\_truncated\>), preserving only the original system policy and the latest active turns.  
> 4. **Pass 4**: Aggressively truncate individual overly verbose RAG chunks up to a hard token limit.  
> 5. **Pass 5 (Fatal)**: If the current user turn and system policy alone exceed the budget, Prompt2 must reject the request entirely. The architecture prohibits silent semantic rewriting or arbitrary truncation of the current user instruction, as this fundamentally degrades the user's explicit intent.

This architecture standardizes context assembly without disclosing the precise private English text of the TinyRustLM system prompt, fulfilling the project constraint regarding raw prompt privacy.

## **8\. Sampling2 Deterministic/Stochastic Contract**

Sampling2 defines the exact mathematical translation from raw, unnormalized logits to discrete token selection. Ambient library defaults (such as implicitly inheriting sampling configurations from Transformers or vLLM) are strictly rejected. Every parameter must be explicitly declared and mathematically verifiable.

### **The Repetition Penalty Anomaly**

The publisher's pipeline relies on the HuggingFace RepetitionPenaltyLogitsProcessor, which exhibits a well-documented mathematical flaw. It branches on the sign of the raw logit: transforming an already-seen token's logit ![][image2] by ![][image3] if ![][image4], and ![][image5] if ![][image6]37. Because the softmax function is shift-invariant (adding a constant to all logits does not change the probability distribution), the zero-point of a model's logits is arbitrary. Therefore, this sign-branching causes a fixed penalty parameter to behave erratically depending on the model's hidden state bias37.  
Despite this being a recognized bug that corrupts structured output, the SLM2 behavioral contract mandates that Sampling2 *must* replicate this exact sign-branching logic. Correcting the bug would break numerical parity with the pinned publisher revision.

### **Top-K, Top-P, and Min-P Mechanics**

The stochastic sampling pipeline executes in a strict monotonic ordering:

> 1. **Temperature Scaling**: All logits are divided by the temperature ![][image7]. If ![][image8], the sampler bypasses all stochastic logic and executes a strict argmax (greedy decoding).  
> 2. **Top-K**: The top ![][image9] logits are retained; all others are set to ![][image10].  
> 3. **Top-P (Nucleus)**: The remaining logits are converted to probabilities via softmax, sorted in descending order, and cumulatively summed. The sequence is truncated once the cumulative mass exceeds ![][image11].  
> 4. **Min-P**: As a final dynamic threshold, a base probability threshold is scaled by the probability of the most likely token38. The threshold is calculated as ![][image12]. Any remaining token where ![][image13] is masked out to ![][image10]40.

### **Floating-Point Determinism and Sorting**

Tokens with identical probabilities during the Top-P cumulative sum must be sorted by their Token ID (ascending) to guarantee deterministic tie-breaking. Non-stable sorts (e.g., C++ std::sort on floats) will cause execution divergence across platforms.  
WebAssembly, JavaScript, and .NET differ subtly in their handling of Fused Multiply-Add (FMA) instructions and transcendental functions (such as exp() required for softmax). Sampling2 mandates strict IEEE 754-2008 compliance41. Softmax denominators and logit scaling operations must avoid hardware-specific fast-math optimizations, utilizing standardized, cross-platform software routines to ensure exact bit-level determinism.  
The contract requires exposing the exact termination reason in the final output struct: StopToken (if the model naturally emitted 151645 or 151643), MaxTokens (if the budget was exhausted), or FatalError (if strict UTF-8 validation failed).

## **9\. Cross-Runtime Golden and Adversarial Vectors**

To validate the SLM2 composition across Rust, .NET, and JavaScript V8 environments, the following cross-runtime golden vectors define the absolute bounds of expected behavior.

| Vector ID | Category | Input / Trigger | Expected Output / Contractual Behavior |
| :---- | :---- | :---- | :---- |
| GV-001 | Encode Canonical | "Hello world" | \[9707, 1917\] (Exact BPE IDs). |
| GV-002 | Unicode Surrogate | "\\uD800" (Unpaired UTF-16 in JS) | Yields bytes EF BF BD ![][image14] \[79020\]. |
| GV-003 | Hostile UTF-8 | Buffer \[226, 152\] at EOS | FatalError via {fatal: true} TextDecoder. |
| GV-004 | Token Injection | User string: \`"\< | im\_start |
| GV-005 | Template Logic | enable\_thinking=false | Output injects \\n\\n\\n\\n prior to assistant content. |
| GV-006 | Sampling Bug Parity | Logit \= \-1.0, Penalty \= 1.2 | Logit evaluates to \-1.2 (branch multiplication). |
| GV-007 | Deterministic Sort | Exact ![][image15] tie on Top-P boundary | Retains lowest Token ID; masks higher ID. |
| GV-008 | ZWJ Emoji | 👨‍👩‍👧 (ZWJ sequence) | Encoded strictly as raw UTF-8 byte spans. |

## **10\. Property, Metamorphic, and Differential Tests**

Traditional unit testing is insufficient for boundless language permutations. Tokenizer2, Template2, and Sampling2 must be validated through property-based and metamorphic testing frameworks.

* **Metamorphic Tokenization Invariance**: Exploiting known topological anomalies in the embedding space (so-called "glitch tokens") provides a rigorous testing boundary43. The metamorphic relation dictates that appending a valid, bounded glitch token sequence to a harmless prefix string should not alter the sub-word segmentation of the preceding string boundary. If tok(A) \+ tok(B) \!= tok(A \+ B), the implementation must force a full re-evaluation of the sliding window to prevent state corruption44.  
* **Prompt Smuggling Fuzzing**: A fuzzer generates highly erratic Unicode sequences interlaced with fragments of special tokens (e.g., \<\\n|\\nim\_end\\n|\>). The property asserts that no output from the untrusted encoder route shall ever contain token IDs 151643 through 151668 unless explicitly constructed by the Template2 DFA26.  
* **Stochastic Replay Distributions**: Fuzz the random number generator (RNG) with fixed seed values across Rust, V8, and CoreCLR. The property asserts that the pseudo-random sampling paths must select the exact same sequence of Token IDs over 10,000 continuous generation steps, proving that IEEE 754 drift and RNG implementation artifacts have been successfully mitigated.

## **11\. Browser-Specific Implementation Constraints**

Deploying the SLM2 architecture locally within a web browser necessitates strict adherence to specific platform constraints.  
JavaScript's TextEncoder strictly processes UTF-16 strings into UTF-8 buffers. It silently translates unpaired surrogates into U+FFFD. The SLM2 architecture explicitly accepts this mutation at the perimeter, provided Tokenizer2 subsequently processes the resulting bytes identically across all platforms. Conversely, TextDecoder must not be allowed to silently swallow decoding errors or insert fallback characters during generation; it must be instantiated strictly with {fatal: true} to catch language model hallucinations of broken byte sequences24.  
To maintain high throughput without blocking the main UI thread, BPE vocabularies, DAT binary structures, and context buffers should be instantiated within a SharedArrayBuffer. Where cross-origin isolation policies permit, this enables zero-copy transfers and lock-free reading between the main thread and the Web Worker executing the inference loop. Furthermore, the pre-tokenizer DFA circumvents the need for native JavaScript RegExp engines, totally avoiding locale-sensitive API leakage (e.g., String.prototype.toLocaleLowerCase()) which varies significantly between older WebKit implementations and modern Chromium V8 engines.

## **12\. Tiered Acceptance Criteria and Implementation Plan**

The implementation of this behavioral contract is governed by a strict, three-tiered acceptance hierarchy.

* **Tier 1: Structural Parsing and Encoding**. Tokenizer2 must decode the binary DFA/DAT format and map 100% of the 151,643 standard vocabulary tokens and 26 special tokens perfectly compared to the reference HuggingFace tokenizer.json13.  
* **Tier 2: Algorithmic Parity (Single-Turn)**. Given a static RNG seed and a highly complex user prompt containing hostile Unicode, the entire unified pipeline (Prompt2 ![][image14] Template2 ![][image14] Tokenizer2 ![][image14] Sampling2) must produce the exact same token stream and apply the exact same repetition penalties as the original Python transformers pipeline.  
* **Tier 3: Multi-Turn Browser Parity**. The system successfully maintains the rolling KV-checkpoint (preserve\_thinking), progressively truncates context during budget exhaustion36, and executes seamlessly within a Web Worker under strict memory constraints (less than 100MB allocated for the non-weight execution environment).

Claims not explicitly proven by this hierarchy—such as actual model inference quality, quantization fidelity, or subjective downstream helpfulness—fall outside the scope of this non-weight behavioral contract and remain unproven.

## **13\. Unknowns Requiring Private Source/Artifact Inspection**

To achieve absolute completion and deployment readiness for the TinyRustLM product, the following unknowns must be resolved via authorized inspection of the private repositories and artifacts:

> 1. **Private System Prompts**: The precise character count, internal formatting, and semantic content of the proprietary system prompt are required to finalize the exact token budget mathematics and establish the Prompt2 baseline.  
> 2. **Tool and Function Schema Definitions**: It must be verified whether the SLM2 composition utilizes standard OpenAI-compatible JSON schema stringification or a custom XML-based schema for tool calling. The Template2 DFA transitions must be explicitly configured to match this format to prevent parsing collisions32.  
> 3. **Host RNG Implementation Algorithms**: The exact pseudo-random number generator algorithm utilized by the target browser and Rust environments (e.g., PCG32, ChaCha8) must be identified to ensure the fixed-seed stochastic replay tests succeed uniformly across all runtimes.

## **14\. Annotated Primary-Source Bibliography**

* **Tokenizer and Byte-Level Mechanics**: Firestone et al. (2025) detail how byte-level BPE tokenizers inherently generate ill-formed UTF-8 and demonstrate the absolute necessity of strict byte-fallback mechanisms during decoding4.  
* **Sampling Subsystem Flaws**: Evidence of the repetition\_penalty logit processor sign-branching bug is thoroughly documented by independent literature tracking standard LLM inference ecosystems, proving mathematically that a zero-point constant shift radically alters generation paths37. The min\_p dynamic truncation threshold mathematics are outlined in its foundational paper (arXiv:2407.01082)38.  
* **Chat Template Evaluation**: The Qwen3 specific chat template, its reliance on the enable\_thinking toggle, rolling checkpoints for multi-turn reasoning preservation, and optimized tool argument serialization are verified directly against the publisher's immutable HuggingFace repository templates28.  
* **Adversarial Token Defense**: The mechanics of Special Token Injection, exploiting tokenizer role spoofing (e.g., bypassing safeguards via injected \<|im\_start|\> sequences), are documented in contemporary prompt smuggling taxonomy reports26.  
* **Context Truncation Strategies**: Progressive degradation and stateless versus stateful cognitive offloading tokenization methods for agentic LLMs are documented in research targeting token-boundary stability (arXiv:2607.29678)36.  
* **Implementation Constraints**: Rust integration for exact BPE (splintr-rs)5 and NodeJS/Web API standards for TextEncoder surrogate pair mapping to U+FFFD21.

#### **Works cited**

> 1. hashformers/benchmarks/qwen/README.md at master \- Fastly, [https://ithub.global.ssl.fastly.net/ruanchaves/hashformers/blob/master/benchmarks/qwen/README.md](https://ithub.global.ssl.fastly.net/ruanchaves/hashformers/blob/master/benchmarks/qwen/README.md)  
> 2. mini-verl/docs/reproducibility.md at main · DaoyuanLi2816/mini-verl, [https://ithub.global.ssl.fastly.net/DaoyuanLi2816/mini-verl/blob/main/docs/reproducibility.md](https://ithub.global.ssl.fastly.net/DaoyuanLi2816/mini-verl/blob/main/docs/reproducibility.md)  
> 3. WASM: Big deal or little deal? \- Hacker News, [https://news.ycombinator.com/item?id=37385197](https://news.ycombinator.com/item?id=37385197)  
> 4. UTF-8 Plumbing: Byte-level Tokenizers Unavoidably Enable LLMs, [https://arxiv.org/pdf/2511.05578](https://arxiv.org/pdf/2511.05578)  
> 5. splintr-rs · PyPI, [https://pypi.org/project/splintr-rs/](https://pypi.org/project/splintr-rs/)  
> 6. tokenizers \- Hugging Face, [https://huggingface.co/docs/transformers.js/v3.8.1/api/tokenizers](https://huggingface.co/docs/transformers.js/v3.8.1/api/tokenizers)  
> 7. mistralai/Mistral-Small-3.1-24B-Instruct-2503 · regex pattern, [https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503/discussions/84](https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503/discussions/84)  
> 8. gguf\_tokenizer.rs \- source \- Docs.rs, [https://docs.rs/hanzo-engine/latest/src/hanzo\_engine/gguf/gguf\_tokenizer.rs.html](https://docs.rs/hanzo-engine/latest/src/hanzo_engine/gguf/gguf_tokenizer.rs.html)  
> 9. Error \[tokenizers:re2\_regex.cpp:26\] Failed to compile Regex for, [https://github.com/pytorch/executorch/issues/14432](https://github.com/pytorch/executorch/issues/14432)  
> 10. olive-recipes/Qwen-Qwen3.5-0.8B/builtin/optimize.py at ... \- GitHub, [https://github.com/microsoft/olive-recipes/blob/main/Qwen-Qwen3.5-0.8B/builtin/optimize.py](https://github.com/microsoft/olive-recipes/blob/main/Qwen-Qwen3.5-0.8B/builtin/optimize.py)  
> 11. The Hidden Engine of AI: Cracking the GPT Tokenizer | by Naren Suri, [https://medium.com/@SuriNaren/the-hidden-engine-of-ai-cracking-the-gpt-tokenizer-9c40129ffcf0](https://medium.com/@SuriNaren/the-hidden-engine-of-ai-cracking-the-gpt-tokenizer-9c40129ffcf0)  
> 12. How can I get a list of word segmentation results for non-English, [https://discuss.huggingface.co/t/how-can-i-get-a-list-of-word-segmentation-results-for-non-english-string/169917](https://discuss.huggingface.co/t/how-can-i-get-a-list-of-word-segmentation-results-for-non-english-string/169917)  
> 13. tokenizer\_config.json · Qwen/Qwen3-0.6B at main \- Hugging Face, [https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/tokenizer\_config.json](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/tokenizer_config.json)  
> 14. tokenizer\_config.json · Qwen/Qwen3-VL-Embedding-8B at main, [https://huggingface.co/Qwen/Qwen3-VL-Embedding-8B/blob/main/tokenizer\_config.json](https://huggingface.co/Qwen/Qwen3-VL-Embedding-8B/blob/main/tokenizer_config.json)  
> 15. tokenizer\_config.json · introspection-mechanisms/Qwen3, [https://huggingface.co/introspection-mechanisms/Qwen3-14B\_meta\_bias\_down\_sgd\_L8/blob/main/tokenizer\_config.json](https://huggingface.co/introspection-mechanisms/Qwen3-14B_meta_bias_down_sgd_L8/blob/main/tokenizer_config.json)  
> 16. UTF-8 Plumbing: Byte-level Tokenizers Unavoidably Enable LLMs, [https://arxiv.org/abs/2511.05578](https://arxiv.org/abs/2511.05578)  
> 17. Faster Superword Tokenization \- OpenReview, [https://openreview.net/pdf?id=0IJGXz4Wnv](https://openreview.net/pdf?id=0IJGXz4Wnv)  
> 18. Computer Science \- arXiv, [https://www.arxiv.org/list/cs/new?skip=275\&show=2000](https://www.arxiv.org/list/cs/new?skip=275&show=2000)  
> 19. Lab | Vansh Verma, [https://vanshverma.com/lab](https://vanshverma.com/lab)  
> 20. EPTCS 388 Non-Classical Models of Automata and Applications, [https://cgi.cse.unsw.edu.au/\~eptcs/Published/NCMA2023/Proceedings.pdf](https://cgi.cse.unsw.edu.au/~eptcs/Published/NCMA2023/Proceedings.pdf)  
> 21. Util | Node.js v26.7.0 Documentation, [https://nodejs.org/api/util.html](https://nodejs.org/api/util.html)  
> 22. util 实用工具| Node.js v26 文档, [https://nodejs.cn/api/util.html](https://nodejs.cn/api/util.html)  
> 23. Sampling from Your Language Model One Byte at a Time, [https://par.nsf.gov/servlets/purl/10631863](https://par.nsf.gov/servlets/purl/10631863)  
> 24. Duktape Programmer's Guide, [https://duktape.org/guide](https://duktape.org/guide)  
> 25. util \- Node documentation \- Deno Docs, [https://docs.deno.com/api/node/util/](https://docs.deno.com/api/node/util/)  
> 26. MetaBreak: Jailbreaking Online LLM Services via Special Token, [https://arxiv.org/html/2510.10271v2](https://arxiv.org/html/2510.10271v2)  
> 27. Arcanum PI Taxonomy \- Prompt Injection Attack Classification, [https://arcanum-sec.github.io/arc\_pi\_taxonomy/](https://arcanum-sec.github.io/arc_pi_taxonomy/)  
> 28. Qwen/Qwen3-0.6B \- Hugging Face, [https://huggingface.co/Qwen/Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B)  
> 29. chat\_template.jinja · Qwen/Qwen3.5-35B-A3B at main \- Hugging Face, [https://huggingface.co/Qwen/Qwen3.5-35B-A3B/blob/main/chat\_template.jinja](https://huggingface.co/Qwen/Qwen3.5-35B-A3B/blob/main/chat_template.jinja)  
> 30. Template engine — list of Rust libraries/crates // Lib.rs, [https://lib.rs/template-engine](https://lib.rs/template-engine)  
> 31. Solver-Aided Compiler Design for Programmable Network Devices, [https://cs.nyu.edu/media/publications/Xiangyu\_Gao\_PhD\_Thesis\_fv\_0910.pdf](https://cs.nyu.edu/media/publications/Xiangyu_Gao_PhD_Thesis_fv_0910.pdf)  
> 32. The 4 Things Qwen-3's Chat Template Teaches Us \- Hugging Face, [https://huggingface.co/blog/qwen-3-chat-template-deep-dive](https://huggingface.co/blog/qwen-3-chat-template-deep-dive)  
> 33. PSA: Qwen3.6 ships with preserve\_thinking. Make sure you have it on., [https://www.reddit.com/r/LocalLLaMA/comments/1sne4gh/psa\_qwen36\_ships\_with\_preserve\_thinking\_make\_sure/](https://www.reddit.com/r/LocalLLaMA/comments/1sne4gh/psa_qwen36_ships_with_preserve_thinking_make_sure/)  
> 34. ability to set template parameters like \`preserve\_thinking\` via, [https://github.com/ollama/ollama/issues/16240](https://github.com/ollama/ollama/issues/16240)  
> 35. Fixed Jinja chat template for Qwen 3.5, 3.6, and the new 3.8 release, [https://www.reddit.com/r/Qwen\_AI/comments/1voz9jy/fixed\_jinja\_chat\_template\_for\_qwen\_35\_36\_and\_the/](https://www.reddit.com/r/Qwen_AI/comments/1voz9jy/fixed_jinja_chat_template_for_qwen_35_36_and_the/)  
> 36. Harness-1: Reinforcement Learning for Search Agents with State, [https://arxiv.org/html/2606.02373v1](https://arxiv.org/html/2606.02373v1)  
> 37. Gauge dependence and structured-output corruption in sign ... \- arXiv, [https://arxiv.org/pdf/2607.09791](https://arxiv.org/pdf/2607.09791)  
> 38. Adapting the Creativity and Coherence with Bounded Entropy in, [https://papers.neurips.cc/paper\_files/paper/2025/file/294de0fa7149adcb88aa3119c239c63e-Paper-Conference.pdf](https://papers.neurips.cc/paper_files/paper/2025/file/294de0fa7149adcb88aa3119c239c63e-Paper-Conference.pdf)  
> 39. Impact of decoding strategies on GPU energy usage in large ... \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12808663/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12808663/)  
> 40. Top-H Decoding: Adapting the Creativity and Coherence with ... \- arXiv, [https://arxiv.org/html/2509.02510v1](https://arxiv.org/html/2509.02510v1)  
> 41. Encoding data — list of Rust libraries/crates // Lib.rs, [https://lib.rs/encoding](https://lib.rs/encoding)  
> 42. GitHub \- punkpeye/awesome-mcp-servers at danmackinlay.name, [https://github.com/punkpeye/awesome-mcp-servers?ref=danmackinlay.name](https://github.com/punkpeye/awesome-mcp-servers?ref=danmackinlay.name)  
> 43. Glitch Tokens in Large Language Models \- VTechWorks, [https://vtechworks.lib.vt.edu/server/api/core/bitstreams/6fc8fe0b-ce4a-4504-b983-5ba3127f7a1d/content](https://vtechworks.lib.vt.edu/server/api/core/bitstreams/6fc8fe0b-ce4a-4504-b983-5ba3127f7a1d/content)  
> 44. TokTier: Exact Stateful Tokenization for Agentic LLM Serving \- arXiv, [https://arxiv.org/html/2607.29678v1](https://arxiv.org/html/2607.29678v1)  
> 45. Exact Stateful CPU+GPU Tokenization for Agentic LLM Serving \- arXiv, [https://arxiv.org/html/2607.29678v3](https://arxiv.org/html/2607.29678v3)  
> 46. huggingface/transformers v5.0.0 on GitHub \- NewReleases.io, [https://newreleases.io/project/github/huggingface/transformers/release/v5.0.0](https://newreleases.io/project/github/huggingface/transformers/release/v5.0.0)  
> 47. ml-rust/splintr: A high-performance tokenizer (BPE \+ SentencePiece, [https://github.com/ml-rust/splintr](https://github.com/ml-rust/splintr)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAACcElEQVR4Xu2WT6hNURTGvxeKIn8j/yYyEQPyJwMMJDFASVEmZox5iNE1eAOT10tKmWBEMUWZeEUSMyUKiUQIEzN5fJ+1N/use84+517uK3W/+rXf22vfs799ztprb6Cv/0dTyWTfmdEkMt13dqPZZCvZQ5aRCcVwm1aSC+hscpkdIbt9oIkGyCbygNwk+wO3yDOy9s/QghaR22S5DwRNIQfIDNcv6aXcIOt8ICet8jR5iXZTip0nX8gqF9MC9XZarn8W2Usuwn73isxPByTaBnshSqNaycw58hnVK1QqfCJnYQajVpCnoU0ls7vIGnIFebNKnXtknw+U6RAZC22VZpKH5DGZk/QfJ9eR31iXkDcrDZFrZKIPpFpK3pInZJ6LpYpm00llUEZPxkEVamJ2O2yM8r9SLfIDtrKclpB3KE6qVv/viIMq1MTsavIG7fvlt5TQo7AU2FIMtUlxjbtDpoU+TfCebIiDKtTEbO3C4wBtHG2gnM7AvkAr6ZPZ16HNqROzKpWligPqHrQYVmc/olhLe2H2sA9EaVdrd+ceNEBOwN7qERfrhdnKNFCZuEy+oTrvVHdV1HUoqB6n0qZTJdFOzqmJ2UbP0okkMzrXvZnN5AMZhh2ZXvHLHPQBJ5nVTs+VJVWBF6jfO78GPofdCeJ9QHeDRzDDSoUyqV+L1ObzmgurHF9hKSS+w0yXHT6acxQNj1zdqrQq3bKUNwtQbTKVjkgtUodGt4rp2HL9/1y6Nd2FXUa6lU7R+6HtuXaSqyjP6zrp650ix8LfPZcmORrodMKNsAtMJ5f2v5YqySBZ7wMZLYTdScbVaF99jYd+ApnHebmMY+0wAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAAA7UlEQVR4Xu3RsWrCUBTG8SMqKG4iVKcuigpKO7tqN9GhCi6Ci44ufYIKLm4VdHAVHPoIHRyL4AO4+wLdXez/eNMaIwkGHPPBj3BPcrnn3IgECXKdBKrIWOsonhH5/8IjZexxxA/q6GJo/8gtesJMzCY9vYYvLMR04TsVfIgZyR4dT3lGT58g7qhrl2O8OOqnhNDGG8K2eh9NpDHHSFxGesUBW7yjhSk2eEAPT/jGo9lyThZLJFHETsyf0KeutfUcGvi01heJWf6iLabkchTdtELHVvMV7UTHKWEg5s58JY+1mEssON7dHOeoQe6VX/1hHCZurr7nAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAaCAYAAAD2dwHCAAADWklEQVR4Xu2YS6hNURjHP3mHPPPI65JnEaUUGXmUV8gjJFHyKpQkhYFHEjHwTIgklIwNkG6RiMwwkAHJwMTIxIT/z7f3vXuvu/c5517uuWfX+dW/s89a++y91re+x1rHrE6dItBVGiR1DjsKCHPpFja2Jxukn9KMsKOAbJcWho0RA6VF0siw41+4Lr2U+oYdBYPx35SGBO2dpDXSM2mT9FxalrqjjfSXXksHwo4CMks6GTaKVdI7qSH6jnc2Sr2j721mmvRRmhJ2FJBT0pygrUH6JO1KtK2UvkojEm1tgnx3T+oSdhQMQpWQTaYewvW4uaHGJNqJsopzfC9pnjQs+k5Fmm5usDOWn2CrBZOcYO41ccUfLQ1vuqM8zOFQ0IbBMFzoHLei9rKeN1X6Iv2WfkhLpY3SHvNBY8SeTXdXHyZFuDE+dEeaLF2zCiYXwTMuWcvUs878mURXTB/zwkEOZHuWS/xQDIbXzZceSVfNva81jJPemC9EpVr/95elIckzHjxtvLTX/LczkzeVAQ9jxxA6AW0Y75s1j+l71PbAWpmqZkvnzMO4FmHyp80XOQl5bGf0mQWeRQVNQiVttJYexr0YL7y/JAyIgYWrUyuwoCwsCxzCjuCiZW8tepiH+NignUj7bGkP45P8FxaQXMhrq6Wjlh+qFBNUChL5YPNBVaqsyWYxwNwA5N/WQp4jNYUhGBvvYKItLiBUYOxSEm5gZ73P0ufWrdLy6JqXnpAWNHdngmcsMV+ISkXiLweGu2KeU2NYpMvmyX2F9NDyDbvfsk8LWZt/9nofrMJCxM76l/lD8DwmdN78KMYAOxpy2BPzXQBVdkskCtMOc+NzFsV7jvhPUuQdxwDHIdRxDCD031uFhYiVvG2+sgwCi5Mo+Yw9Yqj5Ch+z/JBuL5jcYWmt1D26jrcrXDMeFniUueeFJwegUpPH80KQCv7KPM+9leamu/MhkaKY8G8nXrjZfEVemL+omvB+wjI58X7WMk9ioMeWXWkxcpZRk4Tz/i+Q69hXkS/uR99rEdIMeWuxpTfBGOSGZRu1KmCwu+Y78VrlrHRB2m1pL806jlUVch/FgxXdZvm5oyPJCm+uydPhcayqTJSemg9kUtBXy7Bt4hjX4Rv+sLDUqVOnTtH4A0lSiqM7UelkAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAACRElEQVR4Xu2WTUhUURiG39BAUYxM0ECRougHJcEgcKkpCFFBCZEEKdQqciG4CvqRFtXKsBa6CtGFrt1U6EAQUSKuatEikKBlqzZB6PvONzPcOXPv3Dt3GkW8DzzM3HPuzD3f+b5zzgUSEhL2M6foczpDb9La/O7KMkJXaS+tcvrico1+pV20nk7Sd/SQ96ZK00Af0E/0Kj2Y310SbfQ7Hfa0HaZf6D1P245RR8foBh1FvJJRMH9ot6ftAJ2nKVjmAtEA+ujRzLVmV+muzt0RH/3XDboOC1LPispLFAYl3tBf9LjTnqOTbtIt+pteorfofe9N/wGtsSuwslR5qkzD0OCDgvJrT6NMvIIFoixdpG9hu0w5a6EYCkaDUnCNTp8XlVYK/oMvGpRLD51CYYmoNGU5ZDeQNVg5hk2axvAe/oOPHJSypLPAXdDK5lPa77RH5Qh9QT+g9K0+aPBB7Tm0m1ynjxE+e6Wgcp6GnVsXYM8pFU2m3+AV1E/a6rSn0YOG6DjyZ/AObFG30Nf0CaIHrNN/KeNZxAsmy2X6D1ZFWWrockZ9L0Cn9V/YYaZMKWPaRrWIm+lteo5+pO32k6Joy56lx9yOmKh0P9NHnrYTsCxpXRagzjnYDnSGfoNt6/rUtdbSSdhsLWaud4Pz9AedgE26EvAMAZWj1HnTp5uakF+GCmQBAbOyg2gnHIC9dunVqSyUMZViB72L8PWhSdIGEUWVVtj/VQQt+hXYRnHa6fNjEHZwR/EhQt7dKolbpgkJCQl7l236XV9Hcr0OmgAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAaCAYAAAApOXvdAAADFklEQVR4Xu2YTcgNURjH/0IIvb7yERH5LKJEESsf+aYQklIiCiULJQuUBbHwLZSFULJgQUKyQthYWciClCykhIUF/v/3OfPemfPemXfuvcNcY371686dM3PnzDnPec45FygpKRJd6QDa2S8oqY/19Bud6hcUnE50LJ1Pe3plDXGRPqUtfkGB6UHPwt59B31Ch0WuqJO+9Dnd4xcUGKW48/SSO+5ObyOjNphMX9OJfkGBWUM/ovLOGvpXnDpuCOXPa7SLX1BQ+tNniL5zL/rIqeMOUcKdQ4e47wrzKbAfPEoXuPN5EUwOs1BZaYygQ9uuyI619Kf7DFC7vEXKCJ1E39Ff9DNdQjfQnbCb1bBK0HmhTj0Mq5/US02gF5DRJBFCz1JkfqCjQuen0e/0ROhcVfQDp2GNqF6YS+/BErKitBZG0xewzknrutY7k5kBq48icgzdBbt3eviijBhE39AfiNbzK6wzlf5qYiY9jozXXBmikXIE1vFhtJzb5j7jUNktehPxeVDrbK23w5GooLtBP8FGRmpUSVU2z+GdhDpZna1O99FK5BTiG0romi+w2XucVxawFO0jcSR9jxomZuXJVfQA4oe5JiyZhCaLgbDUkdakBgjTD5Yzlc/rRe+pRlVqikMNqlypnBmgyUnnZofOxaKHrKa7Ed2nb6bL3bF65RCdVymuiiJoMaxz0ppmCKkxzyHaEOq4M7Q3XUHvoLHGDtAqQhEcbLE1Wu/CdkyponMlLAFrJ6QI1Usqf2ibqUrnjfLeA9jqQ7P7Jqcmv62wDllI99L9dktDaFLSb6thFWzb6X0k5+Y21OOXYRGgir2C5Q99BpEzGBYJBxGfDv4UeqF9sF1LN3ccLJ10rPqo04fDIlSNkAUKspewiUjbTbVBKrQ/lQGqYPgvOr3QRljeeQxbtvxN9HwN6fBCug/a510tq1JHUUr0DD0rU5QztO5bRq+7782IUpT+tFiEf+D/BjXiVUS3Yc3GMXoS9hdbh9vCvFEu1QSlnt+C5qxwtdTQtGgB/BA2KY33ykrqxJ+8SkpKSv53fgPJyYCMrhe8wAAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAACKUlEQVR4Xu2WT0gUYRjGn6igKItSKEERwiihUkgIOuafk6ikQhiGBnUKOwiePKjhoaIgQQ/eRPTQvYtGCkGEQXhSqEMgQUdPXYLI5/HdXWa+mXF3Zw45OD/4sTvfzC7f+2feGSAjI+Mwc4W+oHO0n570n04fPXSTNtHT9BldoWe9Fx0UKuhRd9Ghln6n9z1r5+gX+sSz9l85Qm/RVfoKxdtIwfymNz1r+o9FugarXCSnaAutzh0fh5X7WOGKZKgiXfQzHaOV/tORTCMYlJinv+glZ73AdbpN/9Ed2kEH6LD3opgoOffoV/oUlrxy0Oajggpb30OVmIEFoiq10mXYlNGG4qK2ekg3cp/F2iwMtdYawje/b1Aut+kbBDOq1pTF0O9UEVVGFUqSGP3Xe4RvvuSgVCU9C9ysqppTtM1ZD2OIfqN3UXyylULU5qPWC2ia9NIJJMtsHm+1HiCYpHJQMsM2r6B+0hpnfQ8F1EdH4M/sI9i0ukhn6STKDzh/X+nBGWdIiE76F9ZFeU7Qdzn1PYCe1n9gDzNVShXTGNXovUAHaSP9ROvsJ2XjjvMz/tP7otG/Tsc9a/WwKumeDaCTC/Q8baBbsLGuTx3rXroMy9bb3HESFNwd+pG+ROnPqmb6g47Ckq4CPEdE56h03vLpoir421CBLCEiKzFRy9+gr2EJLQW1bjvthr06JUIVU9tco49hG0o9euX/ABsUV51zqcZt04yMjIz0sgtk51c/GVFtKAAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAaCAYAAABozQZiAAAAvklEQVR4XmNgGLnACYjvAvEjIrELRBsDAyMQTwHilUCsAOWDwBwg/gfEHlA+MxDbA/EDIDaFijGIA/EqIBaDCQCBIBCfZoAolEYS5wHixUAsAxMAOaEQLg0B+kD8CYjXADELkjjI0ElAzAsTCAViNbg0BEQD8X8gLkcTFwbiNAaE17ACkH9/A7ENugQhgMu/RAFjIP7KgOlfogAu/xIEoICYzzAk/AuK43NA/I4B4lcY/gLE1xkgBo6CUUAeAAAc6iv7Yi1TmwAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAABq0lEQVR4Xu2WzysGQRjHH6EovxWJIgfl5CBclMKBg4s4OeMoLk5O8g/ISeLgIHJ+8wc4KKWclFJvLk4cxEnh+93ZZd7ZnW2Xdl9qPvXpfffZne2Z2XlmRsThcGTBOLyD9wmdVM1ypQGuwF24ATtKb5dSAXfgMezxr8kefIdT/nUlHINFOOTH8qIbXsNFWAOn4S0c1h/SaYcnsE2LNcNLUR3o1OJ18BB2abGsqRI1wKf+/4AteAZrtdgXnEqrRmwAPkv4RezsNqzXYlnTCx/guhGfha9w0Ih7zMM+I7YAPyT8ola4JN9TNA846CwDM5cZUTky10Twc7/BUfNGGQiSt3XKjEdiq6cktIia5+ZqGSdXsjiYdFTyqTrFOcq5atZTuViT6ORTdcpWT+XClrwtHoILwIH8vJ7YnosJN8akNnkt7TAP5mMmH3SKq2Asv6knUg0n4FwKR7yWdphHUdRWorMMH2G/EQ/x1+qJ8OtvwgvY6Mc4eDwwHIklT+5RV/BJ1OcMfIE3YtnccoadKYg6yvGItA/PJd+TTSbw7MkB5pTlL68dDofD4fh3fAItAWUE/FzhMgAAAABJRU5ErkJggg==>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABGklEQVR4Xu2TsUoDQRCGRxLBYBHSmMLGIhEEO1ubiEUeQVGfQEgbQppACnvBzt7GJhDfwWhhE0glaGOhaKpUouYbdpfb7BlcsArcBx/H7gx3c//tiWT8lxq+4Y/nB554Pd2g3sNVr57iEr9xPyxAFQd4jCtBLUUJ7/EJ12dLsod93Aj257KF73gjyZNz2MAzLNi9KI7EZNG0a83jQkxuS64plnP8xF3cxAe8xaLfFIPL6xlP8UrMjfRj1L2+KFxeX9jGZTwQ89p643zS+jcur5Yk+ZRxhGPctntR6Plyefl0xDxEr1G4vB7FTOOjE+lkOmFY+5UdnOC1pLPRte7rdHry56K/zIvM/m+veGjra3gX1IdYsfWMjMVlCn+/PCJqzkDYAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAZCAYAAAC2JufVAAABUUlEQVR4Xu2UvytGURjHH6GISIpMXosSxSD5CwzUm/gTTMogUcpisEgUA7GbTEYRo4GZYjPYpAw2Pz7fzrnd+573pTfv+07Opz7de8/zdO9znnPONYtEIpH/QR3mcBrHsKkgmtKOE17d14xGPMA3fMYvfMcFrPc5zbiFL7iJc3iFUz5edZZw1dICcnhjrrh1bMEjPMY2nyM0mQ0czIwVoIRu7CnDLksL6MB9K16KXnzAD7zEcyvOEUO4HA4mjJibTTnumuuGGPbPpdDeesVPnAxiCZqkJvXTHvwTA7gdDnq0+Q/NLaO6pu6FqKgdbAgDlaAl2fPXkFm8wzNzhV1Ycd4MrgVjVUEvXjTXGaFrHh9x1FwhJ+YKO8U+nzNuruBSHawYfWAeb82dsCe8xv5Mjn4JK+Z+FSpO3pvbyzUlOcGtYSCDTq1Ob6elnY1EIpHf+AakOjcQrq8wCQAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAAA3UlEQVR4Xu3SvwsBYRzH8WcwGPzIJFFmZZJFMSizf8J/YPRXyCglg81qwaAsyt+gWCjCYpHC++I5d1931y22+9Srrvs8zz337U6pIDJV7PG0OOPwub6ijZje4JYe7iiL+wX1ftgEEdGZiWKBNZKiMzbN8UDNXn2TwwkjhESXwEo5v52ZunrP25QFKeGGJeKiM9NRzicYG2Y4oig6M3pG45Qhuh8D7NBHRi92ip5/iixSFmHLOtfo+Vuy8Btjfs9P5BX9/TdI2yt/yeOCsfI5r04FW/X7/zesi4IE+WteEE4wNyAyaW0AAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,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>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFMAAAAaCAYAAADL5WCkAAADNUlEQVR4Xu2Y26vMURTHl1xyv98viUI8iIQUnRIiQkiKJMKTiAe5PJCUUkoRiUjJ9cWDFHKOS/EkD0p5ksST/AES30/rt8/8zj5zO7+ZxnT8vvVpZq/fPjN7r7X2WnuOWa5cuXLl6o4aLZ6LL1Vyzv8sVzGtFB9Fi+id2FaJP+KC6JHYxps7/Wgy/q/UUwyKjZFwFJm2PLKfNnfm2sh+WGyIbN1a/cRO8V5sip7FGikuiYEp2wDxTHwXU1N2dETMj2wN02DzIzMpGbPQFWKeeebUU3zXcfFWrLfCkS2nWeZz08KBOLLNOjoZ7TavsQ0XGXLRvMZ8E2fEA7E1eb1i1W24kkaIs+KVWGq1BynUS45602iZOCZmih/iqrmDEUflZzInq8aZN4hWsdAKjaJWlaqX/1Q7xALzRf22jo5bLH6Jg8mYDOUITWyfUVpTxDXxWMy2+jkRcazbrHi9zKKu7KsqEenPYkLKttc8+qEz8mVkLtlWTtTc6+YNYkb0rB4qVy+zqNp9VaXQGamRvRIbr4w5+pSALEpnZz2POKeo6eplUIg097MgHPHV/EqCYznyD80Lf1dFxGlyb6w+zadcvWSte8RlMc28sRJMbieLxF3ztYxN5sf7GiXOi33m5YmMvWVdKAEh0ieSMRl0SnwQk82vGdvERvPFZHVG+lq0zrJ9TqV6OVesMXcAiUAz5YrH/FCuuFXQB4rti/ES8Smx4wuSLJ1oZUWk6dps8r54YX7EQ/SGJ++pg1yZahVlZb94J7ZY5atXX3HD/OpG0AM0TE7PofaZ7qDp4rW5ExHJcs88a4H32Irti2zmp+sT88DhTJ7TPyoqRPqReRS5DxYr6hx7FshrvYQTceaB+EGNwolPxbBkTLKEzIr3EY8Rc0M9HmPun6r6RrF6WUxEhghRd1qiZ80msoy1klUkBlkWrnw8u21+HVxtnfeVzlwUsnqO2JzYSopizZHZLoZGz9LaJe6Y/+4Nl/pmFb/ayHhEzX9phSsfdvZxUgyxzvsiE1utkKk486Z5sjG/rPjiQFhAKfHfnSxNo9Hqb4V1kp19Us9QvI/0mPnU9LTSn5crV65cuXI1l/4CkwWZvTO3/sUAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAdklEQVR4XmNgGAWjYMABBxCnATEPugQlgBGIW4HYGF2CUgAysBeIWdAlKAEg1xYAcRyUjRUIALEkiVgOiOcD8WQg5mOgEjAB4tVALIMuQS4QBuLFQCyPLkEJyALiCHRBSgAonU4FYml0CUoAKLZ5ofQoGAX0AAA5bAi7Yfn2hgAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAbCAYAAABFuB6DAAAA5UlEQVR4XmNgGAXUBHxA7AnEslA+NxC7AbExEDPDFHEC8VQgrgLiZ0DcAcRrgDgaSs8CYlaQQhcgrgZiTSB+C8RzoJpBwBSI30PVMCQAsRkQ+wHxX5ggFNgA8W8gLkISY2gF4gdALI0klg7E/4E4CEmMOIUgX+5hgDieBSoGokF8kLtB7gcDJSB+DsTlMAEgUATiJ0A8nQGhGewRkBUNUD4jEDcD8RUgloeKgQHIfaBgOAHEq4H4IAPEWglkRTxAfACItzJAwk8YKoYBsLkPK0hjgLgvDogF0ORQACguYTgCTW54AgD8LykjBVdY8AAAAABJRU5ErkJggg==>