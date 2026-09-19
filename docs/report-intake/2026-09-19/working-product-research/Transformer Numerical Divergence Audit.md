# **Localization of Numerical Divergence in Prerelease TinyRustLM Inference**

## **Executive Decision and Falsification**

The recommended approach to isolate numerical divergence in the prerelease TinyRustLM engine is the construction of a strictly deterministic, simulated-scalar Python reference pipeline. This pipeline must exactly mirror the project's row-wise symmetric int8 quantization scheme and its explicit left-to-right F32 accumulation contracts. By enforcing strict environmental determinism within the canonical PyTorch 2.7.0 environment, this reference will act as the absolute ground truth. The subsequent audit must sequentially evaluate scalar Rust, optimized native Rust, and WebAssembly (WASM) inferences against this ground truth using a hierarchical, teacher-forced tracing methodology stored in the SafeTensors format.

The strongest reason this recommendation could fail is if the historical 54-second model loading failure stems from an environment-level exception—such as memory exhaustion, file-system mapping limits in the WASM sandbox, or structural binary incompatibility in the proprietary model.slm2 file—rather than a true arithmetic divergence during inference. If the execution framework crashes before the first token's forward pass completes, a numerical tracing harness cannot collect the necessary intermediate activations to perform differential debugging, rendering numerical analysis moot until the runtime environment is stabilized.

The smallest experiment that could falsify this recommendation is to execute a single-token forward pass of a minimal, synthetically generated dummy payload (e.g., a one-layer, one-head, one-hidden-dimension configuration) through the Python reference, scalar Rust, and WASM pipelines. If this minimal trace crashes during the load phase or the initial execution step, it confirms a structural or environmental defect rather than an arithmetic divergence. This would invalidate the immediate need for deep numerical profiling, pivoting the engineering focus toward memory management and structural binary parsing.

## **Epistemological Ledger**

To ensure rigorous differential debugging without access to the proprietary codebase, the following analysis partitions the project state into distinct epistemic categories. This separation prevents the conflation of verified architectural truths with local implementation artifacts.

### **Project-Supplied Facts**

The current implementation binds exactly six artifacts: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2. The active model is a six-member Qwen3 composition, with the model.slm2 payload occupying exactly 598,308,416 bytes. A previous source-framework trace failed at approximately 54 seconds during the model load phase; consequently, reconstructed and scalar comparison stages never executed. The canonical environment is strictly defined as Python 3.12.10, PyTorch 2.7.0, Transformers 4.51.0, NumPy 2.2.5, Safetensors 0.5.3, Tokenizers 0.21.1, and Accelerate 1.14.0. The target weight profile relies on row-wise symmetric int8 matrices with finite F32 scales, alongside F32 normalization weights and admitted biases. The scalar execution contract demands explicit F32 operations and left-to-right accumulation without Fused Multiply-Add (FMA) instructions. Canonical source paths are strictly E:\\Source\\Rust\\TinyRustLM.com, and model payloads reside in D:\\LLMs\\TinyRustLM. MiniModel.org is explicitly authorized to supply live initial server seeds, overriding any legacy project prose prohibiting external network sourcing for initial default models. The rejected Qwen3-0.6B revision c1899de289a04d12100db370d81485cdf75e47ca remains available exclusively for runtime diagnosis.

### **Externally Verified Facts**

The Qwen2.5/Qwen3 0.5B base architecture utilizes 24 hidden layers, a hidden dimension of 896, an intermediate (MLP) dimension of 4864, and tied word embeddings1. The model employs Grouped Query Attention (GQA) with 14 query heads and 2 key/value heads, yielding a head dimension of 641. A critical architectural deviation in Qwen3 models is the introduction of independent Root Mean Square Normalization (RMSNorm) applied exclusively to the queries (q\_norm) and keys (k\_norm) prior to Rotary Position Embeddings (RoPE)4. The MLP utilizes a SwiGLU activation, requiring the element-wise multiplication of a SiLU-activated gate projection and an up projection7.

Within the execution environment, PyTorch utilizes non-deterministic algorithms and TensorFloat-32 (TF32) on Ampere-class GPUs by default, which reduces FP32 mantissa precision to 10 bits9. Reproducibility requires explicitly disabling TF32 and enabling deterministic algorithms11. Furthermore, WebAssembly strictly enforces IEEE-754 32-bit and 64-bit floating-point arithmetic; divergence only legally occurs regarding NaN payloads and via the "relaxed SIMD" proposal13. Finally, subnormal floating-point handling differs across hardware architectures, where enabling Flush-to-Zero (FTZ) or Denormals-Are-Zero (DAZ) breaks IEEE-754 strictness16.

### **Hypotheses**

The 54-second crash during the model.slm2 loading phase is hypothesized to result from an out-of-memory exception, a 32-bit WASM memory addressing limitation, or an invalid binary offset in the custom .slm2 format parsing logic, rather than an arithmetic failure. Regarding tokenization, Rust Byte Pair Encoding (BPE) tokenizers are hypothesized to fail or diverge on invalid UTF-8 byte fallbacks compared to Python reference tokenizers19. During inference, native Rust optimizations likely utilize AVX-512 VNNI instructions (e.g., vpdpbusd), which compute fused 8-bit dot products and accumulate into 32-bit integers, bypassing the rounding errors inherent in the specified scalar left-to-right F32 accumulation and thus generating localized numerical drift21.

### **Recommendations**

The engineering team must abandon attempts to validate inference solely through structural inspection. Mathematical correctness cannot be established by successfully loading a binary into memory structs. The diagnostic process must focus on deep execution tracing. Furthermore, legacy compatibility paths for the retired SLM1 format should be discarded immediately to reduce technical debt and clarify the active codebase.

### **Locally Unverified Conditions**

The analysis proceeds without verifying the exact byte-level struct packing of the proprietary .slm2 and .acg2 formats. The underlying hardware architecture (x86\_64 versus ARM64) executing the WebAssembly environment remains unknown, which dictates the severity of relaxed SIMD divergence13. Additionally, the presence of hardware-accelerated VNNI or AMX instruction sets on the local development machine at E:\\Source\\Rust is unverified.

## **Specification of Execution Reference Arms**

To rigorously isolate quantization artifacts from core engine implementation bugs, the differential debugging program must evaluate execution across five distinct reference arms. Comparing a quantized inference engine directly against an unquantized FP16 PyTorch model is a widespread anti-pattern. Quantization inherently alters the underlying mathematics through representation limits and asymmetric scaling. A bug-free quantized engine must diverge from an FP16 baseline; interpreting this divergence as a bug leads to perpetual, unresolvable optimization cycles.

### **Arm A: Original Source Model (FP16/BF16)**

This arm represents the unmodified Hugging Face canonical representation of the Qwen3 model, executing in PyTorch using bfloat16 or float16 precision. Its purpose is to establish the theoretical upper bound of the model's linguistic capability and to capture the reference logits prior to weight compression. The expected parity with the deployed TinyRustLM engine is statistical similarity only. Exact numerical parity is mathematically impossible and must not be a product acceptance gate.

### **Arm B: Emulated Quantized Source-Framework (The Ground Truth)**

Arm B is a custom PyTorch implementation executing the independently reconstructed row-wise symmetric int8 weights. This arm serves as the absolute, bit-exact ground truth for all subsequent engineering targets in TinyRustLM. To ensure validity, this execution must enforce strict determinism by setting torch.use\_deterministic\_algorithms(True) and torch.backends.cuda.matmul.allow\_tf32 \= False9. Furthermore, standard PyTorch torch.matmul functions cannot be used, as cuBLAS utilizes hierarchical block accumulation that alters floating-point rounding24. The harness must utilize a custom PyTorch extension or highly controlled tensor looping to emulate the strict left-to-right sequential accumulation required by the TinyRustLM scalar contract.

### **Arm C: Scalar Rust**

This arm is the native Rust implementation executing standard scalar f32 multiplication and addition in a strict, unoptimized left-to-right loop. The expected parity between Arm C and Arm B is exact agreement (0 Units in the Last Place, or ULP). Because both arms execute identical arithmetic operations in an identical sequence over identical quantized weights, any divergence strictly indicates an indexing bug, a shape broadcasting error, a tensor layout mismatch, or an improperly handled subnormal floating-point value.

### **Arm D: Optimized Native Rust**

This represents the production Rust target utilizing hardware intrinsics, specifically AVX-512 vpdpbusd for INT8 Vector Neural Network Instructions (VNNI) dot products, or their NEON equivalents21. This arm will inherently diverge from both Arm B and Arm C. Vectorized dot-product instructions compute fused multiplications and maintain higher internal precision (or utilize intermediate 32-bit integer accumulators) before ultimately casting the sum to f3222. The acceptance criteria for Arm D is approximate agreement within a defined absolute error bound (e.g., ![][image1]) relative to Arm C.

### **Arm E: Browser WebAssembly (WASM)**

Arm E is the final deployment target executing via a browser's WASM engine. WebAssembly strictly enforces IEEE-754 semantics26. If the WASM target disables the "relaxed SIMD" proposal, the arithmetic must be perfectly deterministic13. Under these conditions, it must achieve exact 0 ULP parity with Arm C. If WebAssembly SIMD is enabled, the execution will exhibit bounded, hardware-dependent deviation, and should be evaluated against the tolerances established for Arm D.

## **Reference-Model Loading as an Isolated Experiment**

The historical trace failure at roughly 54 seconds during model loading suggests a critical bottleneck in memory allocation or file I/O, independent of the neural network's arithmetic logic. Evaluating the inference engine requires separating environment failure from runtime disagreement.

The canonical environment is bound to Python 3.12.10 and PyTorch 2.7.0. The diagnostic harness must first verify this execution space before allocating the model tensors. A 54-second delay strongly implies synchronous I/O blocking or severe memory swapping. The model.slm2 file, measuring 598,308,416 bytes, must not be eagerly loaded into resident memory. Instead, the implementation should employ virtual memory mapping (mmap). Memory mapping is particularly critical in WebAssembly environments, which impose strict linear memory addressing limits. Attempting to allocate a contiguous 598 MB buffer in a 32-bit WASM sandbox often triggers an out-of-bounds trap15.

Furthermore, to isolate the loading sequence, the execution must be confined to a single thread. Race conditions during the initialization of the simulated scalar accumulation logic can cause silent memory corruption. By setting torch.set\_num\_threads(1) and explicitly disabling CPU subnormal flushing (FTZ/DAZ)17, the environment is stabilized, ensuring that if a crash occurs, it is definitively a parsing or memory mapping error within the .slm2 format, rather than a transient thread starvation or hardware state issue. The offline local revision loading must utilize the rejected c1899de289a04d12100db370d81485cdf75e47ca revision as the diagnostic payload, confirming that the import mechanism properly isolates the artifact identity without conflating it with subsequent product qualification data.

## **Architectural Defect Classes and Implementation Nuances**

When auditing the TinyRustLM implementation against the Qwen3 0.5B architecture, specific topological nuances must be meticulously verified. The following details rank the most plausible defect classes without assuming which currently exists locally.

### **Tied Embeddings and Tensor Orientation**

The Qwen3 0.5B model utilizes tied word embeddings, a configuration explicitly marked by tie\_word\_embeddings: true in the public configuration2. In this architecture, the input embedding matrix, possessing the shape \[151936, 896\], is physically shared with the final language modeling head (lm\_head). A frequent implementation defect in low-level languages is allocating two separate physical buffers in memory. If the inference state machine mutates one buffer without mirroring the changes, or fails to properly transpose the memory stride when executing the final logit projection, the output distribution will catastrophically degrade. The physical tensor count inside the .slm2 file must be verified against the logical tensor count expected by the execution graph.

### **Grouped-Query Attention (GQA) and KV-Cache Layout**

The attention mechanism employs Grouped-Query Attention with 14 query heads and only 2 key/value heads2. Consequently, the concatenated QKV projection matrix is asymmetric. During the scaled dot-product attention calculation, the Key and Value tensors must be logically repeated or physically broadcasted to match the 14 Query heads. A highly prevalent defect class involves misaligned memory access during this broadcasting. Native optimized Rust implementations generally favor a \[batch, head, seq, head\_dim\] memory layout to ensure contiguous memory access during the dot products, whereas standard model checkpoints often serialize weights in a \[batch, seq, head, head\_dim\] layout. Writing to the KV cache with transposed strides will result in random, high-magnitude activation values.

### **The Q/K Normalization Anomaly**

A distinctive feature of the Qwen3 architecture, contrasting sharply with models like LLaMA, is the application of Root Mean Square Normalization (RMSNorm) to the queries and keys immediately after the linear projection but strictly before the Rotary Position Embeddings (RoPE)4. This normalization is applied exclusively over the head dimension, which is exactly 64 for this model configuration (![][image2]). Failing to apply q\_norm and k\_norm causes the attention softmax to become overly peaked, destroying the model's predictive entropy.

### **RoPE Position Indexing: Prefill versus Decode**

Rotary Position Embeddings inject spatial structure using trigonometric absolute position indices. The implementation transitions between prefill and decode stages fundamentally alter this calculation28. During the prefill stage, a prompt of length ![][image3] computes RoPE for positions ![][image4] to ![][image5] simultaneously using dense matrix operations. During the autoregressive decode stage, the newly generated token must compute RoPE precisely for position ![][image3]. A pervasive defect class is off-by-one errors in decode position indexing. If the state machine miscalculates the offset, the attention mechanism misaligns the query's spatial rotation relative to the cached keys, resulting in immediate, unrecoverable autoregressive divergence.

### **Accumulation Order and IEEE-754 Strictness**

The fundamental arithmetic of floating-point addition dictates that it is commutative but not associative. In strict IEEE-754 compliance, ![][image6] is not necessarily equal to ![][image7]. The project's scalar contract mandates explicit left-to-right accumulation. Standard pairwise summation, often utilized in BLAS libraries to bound numerical error to ![][image8], will diverge from a linear loop, which accumulates error bounded to ![][image9]24. The differential program must explicitly enforce a sequential loop in the Python reference to match the Rust execution behavior, preventing false positive divergence flags.

## **Error Metrics and Tolerance Setting Procedures**

Applying a single, universal epsilon (e.g., ![][image1]) across an entire transformer architecture is inadequate for differential debugging. Accumulation errors scale non-linearly with sequence length and the dimension of the hidden states. Neural network tensors frequently contain values clustered near zero where relative error calculations explode, alongside large outlier magnitudes where absolute error dominates. Therefore, a multi-faceted metric approach is required.

### **Metric Derivations**

> 1. **Maximum Absolute Error (MaxAE):** ![][image10]. This metric is essential for identifying catastrophic failures, such as NaN or Infinity values, or massive architectural routing bugs where a completely incorrect memory block is accessed.  
> 2. **Mean Relative Error (MRE):** ![][image11]. This metric evaluates precision decay over deep layers while ignoring near-zero values where floating-point noise is irrelevant.  
> 3. **Cosine Similarity:** ![][image12]. This is the most robust metric for intermediate high-dimensional neural activations. Vectors that maintain high cosine similarity (e.g., ![][image13]) preserve their directional geometry within the latent space. This indicates that the model's semantic understanding remains completely intact, even if scalar magnitudes drift slightly due to discrepancies between FMA and non-FMA instructions.  
> 4. **Top-Token Margin:** This metric evaluates the specific logit values of the top 5 predicted tokens in both execution arms. Divergent autoregressive paths only occur if the absolute ranking of the top token flips; minor fluctuations in the underlying logit values are harmless if the argmax remains stable.

### **Tolerance Table Justification**

The following tolerance thresholds are proposals based on standard quantization error propagation arithmetic29. All tolerances assume a baseline comparison against Arm B (Emulated Quantized).

&nbsp;

| Operation Target | Arm C (Scalar Rust) Tolerance | Arm D (Optimized Rust) Tolerance | Failure Interpretation |
| :---- | :---- | :---- | :---- |
| **Dequantization** | 0 ULP (Bit-exact) | 0 ULP (Bit-exact) | Incorrect scale broadcasting or asymmetric zero-point logic applied during row-wise reconstruction. |
| **QKV Projections** | MaxAE ![][image14] | Cosine Sim ![][image15] | Accumulation loop topology divergence or the unauthorized introduction of FMA instructions. |
| **RoPE Embedding** | 0 ULP (Bit-exact) | MaxAE ![][image14] | Incorrect trigonometric cache generation (e.g., discrepancies in sin/cos approximation precision). |
| **Attention Softmax** | MaxAE ![][image14] | MaxAE ![][image14] | Denormal values being prematurely flushed to zero due to FTZ/DAZ hardware flags16. |
| **Residual Add** | 0 ULP (Bit-exact) | MaxAE ![][image14] | In-place tensor mutation incorrectly overwriting the residual stream prior to normalization. |
| **Final Logits** | Top-1 Exact Match | Top-1 Exact Match | Acceptable numerical drift causing a catastrophic routing failure in the vocabulary projection. |

## **Layer-by-Layer Capture Plan and Trace Format**

Differential debugging requires tapping the execution graph at deterministic intervals. Dumping every activation for every token across 24 layers of a 0.5B model generates highly redundant gigabytes of data. The capture plan utilizes a hierarchical bounded trace format.

### **Bounded Trace Format Strategy**

To avoid floating-point rounding errors caused by JSON text serialization, all tensor captures must be serialized using the SafeTensors binary format. SafeTensors employs a well-defined binary structure: an initial 8-byte header specifies the length of a UTF-8 encoded JSON metadata section, followed directly by the raw, byte-aligned tensor buffers31. This format supports zero-copy memory mapping, making it optimal for rapid trace comparison.

When designing the comparison algorithm, full tensor slices (e.g., shape \[1, seq\_len, 896\]) are strictly necessary for the early layers (Layers 0 through 2\) during integration testing. However, for deep layers and ongoing regression testing, generating full slices is prohibitive. In these cases, cryptographic hashes of the raw byte arrays (e.g., BLAKE3) or targeted statistical summaries (L2 norm, Min, Max, NaN-count) are sufficient to prove ongoing mathematical stability.

### **Sequential Interception Nodes**

The differential harness must capture the exact following states for a given layer\_idx. These nodes verify model-specific details against the exact public configuration of the Qwen3 architecture.

> 1. input\_ids: The exact integer tokens fed to the model embedding layer.  
> 2. embed\_out: The output of the tied token embedding matrix27.  
> 3. pre\_norm: The output of the RMSNorm applied prior to the attention mechanism.  
> 4. qkv\_proj: The raw, pre-normalization outputs of the Query, Key, and Value linear projections.  
> 5. qk\_norm: The specific outputs of the Qwen3 q\_norm and k\_norm normalizers4.  
> 6. rope\_out: The Query and Key tensors immediately post-Rotary Position Embedding.  
> 7. attn\_scores: The raw ![][image16] matrix before causal masking and softmax.  
> 8. attn\_mask: The causal lower-triangular boolean mask32.  
> 9. attn\_probs: The post-softmax attention probability distributions.  
> 10. attn\_out: The output of the Value matrix mixing and subsequent o\_proj.  
> 11. post\_norm: The output of the RMSNorm applied prior to the MLP.  
> 12. mlp\_gate & mlp\_up: The separated branches of the SwiGLU activation8.  
> 13. mlp\_silu: The SiLU-activated gate branch.  
> 14. mlp\_out: The combined output following the down\_proj.  
> 15. final\_norm: The output of the terminal RMSNorm prior to the language head.  
> 16. logits: The final vocabulary projection (shape \[1, seq\_len, 151936\])33.

## **Minimal Deterministic Diagnostic Traces**

To isolate cache, index, and state-machine bugs, the differential harness must execute a matrix of specific edge-case traces. Free-running autoregressive generation allows minute errors to compound rapidly; therefore, all diagnostic traces must utilize **teacher-forced** inputs. This technique supplies the known sequence to the engine step-by-step, regardless of the model's actual token prediction, ensuring that layer ![][image3] in both arms receives the exact same input state.

### **Prioritized Experiment Matrix**

&nbsp;

| Hypothesis / Target | Controlled Input (Input-Selection Rule) | Procedure & Observable Outputs | Failure Interpretation & Next Action |
| :---- | :---- | :---- | :---- |
| **Unit Logic / Shape Parsing** | \[151643\] (BOS token only, one token) | Execute a single-token forward pass. Observe logits shape and MaxAE. | Interprets structural load failure. If it crashes, inspect file mapping and basic 1D linear algebra loop bounds. |
| **KV Cache Transition** | \[151643, 856\] (Two tokens) | Pass Token 1 as prefill, forcing a cache write. Pass Token 2 as decode. | Exposes prefill-to-decode transition bugs. If Token 2 fails, inspect KV cache block allocation and verify RoPE index incrementing. |
| **Boundary Degradation** | \[\] (Empty array of size 0\) | Pass an empty context to the execution engine. | Validates state machine safety. If a crash occurs, implement explicit sequence length assertions and return a graceful error. |
| **Causal Mask Integrity** | \[100, 100, 100\] (Repeated sequence) | Observe attn\_scores and attn\_probs. Tokens must not attend to future identical tokens. | If Attention Scores differ on identical token IDs, inspect the causal mask boolean layout (upper versus lower triangular boolean matrix shapes)32. |
| **Context Window Wrapping** | 33,000 synthesized tokens | Push past the established context boundary. Qwen3-0.5B limits max\_position\_embeddings to 32,7682. | If silent memory corruption occurs, implement explicit bounds checking on RoPE indices and KV cache allocation tables. |

## **Required Decision Artifacts**

### **Divergence-Localization Decision Tree**

When the automated harness detects a divergence, engineers must execute the following state machine to systematically isolate the error without requiring access to the private Rust source code:

> 1. **State 1: Verify Weight Extraction.** Are the raw weights extracted from the Python reference bit-exact with the weights loaded by the Rust engine?  
   * *No:* Stop. The .slm2 file parser is misaligned, the endianness is flipped, or the byte offsets mapped in composition.acg2 are incorrect.  
   * *Yes:* Proceed to State 2\.  
> 2. **State 2: Verify Initial Embedding.** Does Arm C (Scalar) match Arm B (Python) at the embed\_out stage?  
   * *No:* Stop. The token-to-row lookup logic is flawed, or the tied-embedding memory reference is corrupted.  
   * *Yes:* Proceed to State 3\.  
> 3. **State 3: Verify Linear Projections.** Do the qkv\_proj outputs match exactly (0 ULP)?  
   * *No:* Stop. The left-to-right accumulation contract is violated. Inspect the inner matrix-multiplication loop for implicit FMA usage or pairwise summation optimizations.  
   * *Yes:* Proceed to State 4\.  
> 4. **State 4: Verify Attention Normalization.** Does the attn\_probs (Softmax) stage diverge?  
   * *No:* Proceed to State 5\.  
   * *Yes:* Stop. Check if the unique q\_norm and k\_norm operations were correctly applied to the head dimension. Check for DAZ/FTZ denormal flushing hardware flags16.  
> 5. **State 5: Verify Autoregressive State.** Does divergence only manifest when Sequence Length ![][image17]?  
   * *No:* The bug is a general arithmetic defect present in prefill.  
   * *Yes:* Stop. This is a severe autoregressive KV cache misalignment. Verify that slot\_mapping and rotary\_position\_ids are incrementing correctly during the decode phase28.

### **Executable-Style Pseudocode Harness**

The following schema defines the execution harness, bridging Python reference data to Rust structs for evaluation without exposing private code.

&nbsp;

&nbsp;

&nbsp;

Python

\# differential\_harness.py  
import torch  
import safetensors.torch  
from qwen\_sim import Qwen3RowInt8Simulated

\# 1\. Enforce strict numerical determinism  
torch.use\_deterministic\_algorithms(True)  
torch.backends.cuda.matmul.allow\_tf32 \= False  
torch.manual\_seed(42)  
torch.set\_num\_threads(1)

def generate\_differential\_trace(model\_path, output\_path, tokens):  
&nbsp;&nbsp;&nbsp;&nbsp;\# Initialize the simulated model from the proprietary format  
&nbsp;&nbsp;&nbsp;&nbsp;model \= Qwen3RowInt8Simulated.from\_slm2(model\_path)  
&nbsp;&nbsp;&nbsp;&nbsp;activations \= {}  
&nbsp;&nbsp;&nbsp;&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;\# Forward hook factory to capture exact tensor state  
&nbsp;&nbsp;&nbsp;&nbsp;def hook\_fn(name):  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;def hook(module, input, output):  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\# Capture as FP32, detached, forced to CPU to avoid device drift  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;activations\[name\] \= output.detach().cpu().to(torch.float32)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return hook

&nbsp;&nbsp;&nbsp;&nbsp;\# Register hooks (Layer 0 subset utilized for minimal tracing)  
&nbsp;&nbsp;&nbsp;&nbsp;model.layers\[0\].q\_proj.register\_forward\_hook(hook\_fn("L0\_q\_proj"))  
&nbsp;&nbsp;&nbsp;&nbsp;model.layers\[0\].k\_norm.register\_forward\_hook(hook\_fn("L0\_k\_norm"))  
&nbsp;&nbsp;&nbsp;&nbsp;model.layers\[0\].attn.softmax.register\_forward\_hook(hook\_fn("L0\_attn\_probs"))

&nbsp;&nbsp;&nbsp;&nbsp;\# Execute trace under teacher-forced conditions  
&nbsp;&nbsp;&nbsp;&nbsp;with torch.no\_grad():  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;logits \= model(torch.tensor(\[tokens\], dtype=torch.long))  
&nbsp;&nbsp;&nbsp;&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;activations\["final\_logits"\] \= logits.detach().cpu().to(torch.float32)

&nbsp;&nbsp;&nbsp;&nbsp;\# Serialize to Bounded Trace Format  
&nbsp;&nbsp;&nbsp;&nbsp;metadata \= {  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"model\_architecture": "qwen3-0.5b",&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"execution\_arm": "B\_emulated\_quantized",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"seq\_len": str(len(tokens))  
&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;&nbsp;&nbsp;safetensors.torch.save\_file(activations, output\_path, metadata=metadata)

\# Generate the baseline trace for the KV Transition hypothesis  
generate\_differential\_trace("D:\\\\LLMs\\\\TinyRustLM\\\\model.slm2",&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"E:\\\\Source\\\\Rust\\\\TinyRustLM.com\\\\traces\\\\trace\_L0\_kv.safetensors",&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\[151643, 856\])

## **Implementation Sequence and Project Directives**

To rectify the current state of TinyRustLM and proceed to a stable prerelease, the engineering team must execute the following sequence.

### **Implementation Sequence**

> 1. **Halt Advanced Feature Work:** Immediately cease development on custom peers, IP settings, and Hugging Face local-file imports. These are advanced features that distract from core inference stability.  
> 2. **Implement Network Override:** Configure the Windows .NET companion and browser client to automatically fetch a known-working 0.5B default model payload from MiniModel.org upon initialization. This satisfies the non-negotiable user requirement to "open it and have a useful conversation" without complex setup.  
> 3. **Trace Generation:** Execute the diagnostic matrix within the Python reference environment to generate the golden .safetensors trace files.  
> 4. **Integration Automation:** Construct a Rust test suite that loads the .safetensors files, injects the identical input\_ids into the Rust scalar pipeline, and asserts the intermediate tensors against the Tolerance Table.  
> 5. **Iterative Resolution:** Utilize the Divergence-Localization Decision Tree to walk backward from the final logits until the first layer of numerical divergence is pinpointed and patched.

### **Ship/No-Ship Criteria**

* **Ship:** The MiniModel.org network download initializes successfully without user intervention. Arm C (Scalar Rust) produces exactly the top-1 logit predictions as Arm B (Python Reference) across a 512-token context window. Furthermore, the browser WASM target opens successfully and processes a prompt without triggering Out-of-Memory exceptions or WASM linear memory traps.  
* **No-Ship:** Arm C diverges from Arm B by ![][image18] Absolute Error in the early attention layers (prior to Layer 2). The application attempts to load the 598 MB payload synchronously into WASM linear memory, freezing the browser thread. No kernels may be optimized, no derivatives trained, and no numerical agreement claimed until Arm C achieves exact top-1 logit parity with Arm B.

### **Unresolved Local Measurements and Blind Spots**

The primary blind spot in this analysis is the lack of visibility into the exact WebAssembly target compiler flags used in the E:\\Source\\Rust repository. If the Rust toolchain is configured to emit relaxed SIMD instructions, the WASM execution will silently drift from strict IEEE-754 compliance. An independent cross-check must be established by compiling a separate, minimal Rust binary using standard cargo build (without TinyRustLM's specific optimization flags) to execute the matrix multiplication, ensuring the divergence is an artifact of the codebase and not the local compiler environment.

### **What to Stop Doing**

The engineering team must stop attempting to validate inference through structural inspection alone. A binary loading successfully into structs does not validate mathematical correctness. Second, stop maintaining historical and obsolete readers. If the custom .slm2 parser requires modifications to fix KV cache logic, the layout must be overwritten coherently; do not clutter the prerelease branch with legacy compatibility paths. Finally, stop using standard PyTorch FP16 inference for the baseline. Using full-precision targets to debug an INT8 implementation will result in perpetual ghost-chasing due to acceptable quantization noise.

### **Experiment-Lesson Template**

To preserve closed evidence while authorizing new experiments after a verified fix, document all findings utilizing the following compact schema. This ensures lessons are retained compactly within the Git history.

* **Question:** Does the Qwen3 Q/K normalization occur before or after the linear projection?  
* **Exact Inputs:** Single teacher-forced token ID \[151643\].  
* **Method:** Intercept q\_proj output in Arm B. Compare directly with q\_norm output in Arm C.  
* **Result:** Arm C absolute error diverges significantly to ![][image19].  
* **Uncertainty:** Could initially be caused by a scaling discrepancy in the RMSNorm epsilon (![][image20]).  
* **Decision:** Qwen3 applies RMSNorm strictly *after* projection. The Rust implementation applied it before. Code modified to correct the topological order.  
* **Reusable Lesson:** Qwen architectural topologies differ substantially from LLaMA in their attention pre-processing sequence. Assumptions regarding standard topological order cause catastrophic divergence.  
* **Evidence Identity:** Commit c1899de289a04d12100db370d81485cdf75e47ca, Trace file: trace\_L0\_qnorm.safetensors.

#### **Works cited**

> 1. Qwen/Qwen2.5-0.5B-Instruct \- Hugging Face, [https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)  
> 2. config.json · Qwen/Qwen2.5-0.5B at, [https://huggingface.co/Qwen/Qwen2.5-0.5B/blob/060db6499f32faf8b98477b0a26969ef7d8b9987/config.json](https://huggingface.co/Qwen/Qwen2.5-0.5B/blob/060db6499f32faf8b98477b0a26969ef7d8b9987/config.json)  
> 3. gated\_attention/configuration\_qwen3.py at main \- GitHub, [https://github.com/qiuzh20/gated\_attention/blob/main/configuration\_qwen3.py](https://github.com/qiuzh20/gated_attention/blob/main/configuration_qwen3.py)  
> 4. Text Capability Loss in Vision-Language Adaptation \- arXiv, [https://arxiv.org/html/2609.00746v1](https://arxiv.org/html/2609.00746v1)  
> 5. Qwen3 support please?? · Issue \#1902 · OpenNMT/CTranslate2, [https://github.com/OpenNMT/CTranslate2/issues/1902](https://github.com/OpenNMT/CTranslate2/issues/1902)  
> 6. modeling\_qwen3\_moe.py \- huggingface/transformers \- GitHub, [https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3\_moe/modeling\_qwen3\_moe.py](https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3_moe/modeling_qwen3_moe.py)  
> 7. Helion SwiGLU MLP Example, [https://helionlang.com/examples/swiglu.html](https://helionlang.com/examples/swiglu.html)  
> 8. SwiGLU in modern LLMs \- Sebastian Raschka, [https://sebastianraschka.com/faq/docs/swiglu-modern-llms.html](https://sebastianraschka.com/faq/docs/swiglu-modern-llms.html)  
> 9. PyTorch and TensorFloat32 \- NVIDIA CUDA, [https://dev-discuss.pytorch.org/t/pytorch-and-tensorfloat32/504](https://dev-discuss.pytorch.org/t/pytorch-and-tensorfloat32/504)  
> 10. CUDA semantics — PyTorch 2.14 documentation, [https://docs.pytorch.org/docs/stable/notes/cuda.html](https://docs.pytorch.org/docs/stable/notes/cuda.html)  
> 11. Give Me FP32 or Give Me Death?Challenges and Solutions ... \- arXiv, [https://arxiv.org/html/2506.09501v1](https://arxiv.org/html/2506.09501v1)  
> 12. Solving Reproducibility Challenges in Deep Learning and LLMs, [https://www.ingonyama.com/oldblogs/solving-reproducibility-challenges-in-deep-learning-and-llms-our-journey](https://www.ingonyama.com/oldblogs/solving-reproducibility-challenges-in-deep-learning-and-llms-our-journey)  
> 13. WebAssembly Runs Identically Everywhere, Except Where It Leaks, [https://scrapfly.dev/posts/wasm-cpu-architecture-leak/](https://scrapfly.dev/posts/wasm-cpu-architecture-leak/)  
> 14. WebAssembly Specification, [https://webassembly.github.io/spec/versions/core/WebAssembly-3.0-draft.pdf](https://webassembly.github.io/spec/versions/core/WebAssembly-3.0-draft.pdf)  
> 15. rotifer-spec/rotifer-ir-specification.md at main \- GitHub, [https://github.com/rotifer-protocol/rotifer-spec/blob/main/rotifer-ir-specification.md](https://github.com/rotifer-protocol/rotifer-spec/blob/main/rotifer-ir-specification.md)  
> 16. 36821 – Flush denormals to Zero Flag, [https://gcc.gnu.org/bugzilla/show\_bug.cgi?id=36821](https://gcc.gnu.org/bugzilla/show_bug.cgi?id=36821)  
> 17. CUDA Pro Tip: Flush Denormals with Confidence \- NVIDIA Developer, [https://developer.nvidia.com/blog/cuda-pro-tip-flush-denormals-confidence/](https://developer.nvidia.com/blog/cuda-pro-tip-flush-denormals-confidence/)  
> 18. Best-practices | Avoiding subnormal floating-point calculations, [https://co-design.pop-coe.eu/best-practices/avoid-subnormals.html](https://co-design.pop-coe.eu/best-practices/avoid-subnormals.html)  
> 19. Effectively Avoid Problems When Consuming Legacy Character, [https://colinsblog.net/2023-10-21-nonstandard-string-encodings-rust/](https://colinsblog.net/2023-10-21-nonstandard-string-encodings-rust/)  
> 20. bpe-tokenizer \- crates.io: Rust Package Registry, [https://crates.io/crates/bpe-tokenizer](https://crates.io/crates/bpe-tokenizer)  
> 21. Efficient way for using int8 AVX512-VNNI instruction, especially, [https://stackoverflow.com/questions/79265574/efficient-way-for-using-int8-avx512-vnni-instruction-especially-about-loading-t](https://stackoverflow.com/questions/79265574/efficient-way-for-using-int8-avx512-vnni-instruction-especially-about-loading-t)  
> 22. How to implement an efficient \_mm256\_madd\_epi8 dot-products of, [https://stackoverflow.com/questions/51382276/how-to-implement-an-efficient-mm256-madd-epi8-dot-products-of-groups-of-four-i8](https://stackoverflow.com/questions/51382276/how-to-implement-an-efficient-mm256-madd-epi8-dot-products-of-groups-of-four-i8)  
> 23. 1-Bit LLMs in Pure Rust \- Naz Quadri, [https://nazquadri.com/blog/everyday-thoughts/oxibonsai-1-bit-pure-rust/](https://nazquadri.com/blog/everyday-thoughts/oxibonsai-1-bit-pure-rust/)  
> 24. Pairwise summation \- Wikipedia, [https://en.wikipedia.org/wiki/Pairwise\_summation](https://en.wikipedia.org/wiki/Pairwise_summation)  
> 25. GitHub \- xigh/herbert-rs: Local LLM inference engine written from, [https://github.com/xigh/herbert-rs](https://github.com/xigh/herbert-rs)  
> 26. Types — WebAssembly 1.1, [https://webassembly.github.io/reference-types/core/syntax/types.html](https://webassembly.github.io/reference-types/core/syntax/types.html)  
> 27. Qwen2 \- Transformers \- Hugging Face, [https://huggingface.co/docs/transformers/v4.40.0/model\_doc/qwen2](https://huggingface.co/docs/transformers/v4.40.0/model_doc/qwen2)  
> 28. M-RoPE (Multimodal Rotary Position Embedding) \- AWS Neuron SDK, [https://awsdocs-neuron.readthedocs-hosted.com/en/latest/vllm-neuron/docs/design/multimodal/mrope.html](https://awsdocs-neuron.readthedocs-hosted.com/en/latest/vllm-neuron/docs/design/multimodal/mrope.html)  
> 29. Quantization Error Propagation: Revisiting Layer-Wise Post-Training, [https://arxiv.org/html/2504.09629v3](https://arxiv.org/html/2504.09629v3)  
> 30. Accurate Compensation for Quantized Large Language Models \- arXiv, [https://arxiv.org/pdf/2507.11017](https://arxiv.org/pdf/2507.11017)  
> 31. Gradient-Based Model Fingerprinting for LLM Similarity Detection, [https://arxiv.org/html/2506.01631v2](https://arxiv.org/html/2506.01631v2)  
> 32. Multi-Head Attention Fundamentals | rasbt/LLMs-from-scratch, [https://deepwiki.com/rasbt/LLMs-from-scratch/4.1-multi-head-attention-fundamentals](https://deepwiki.com/rasbt/LLMs-from-scratch/4.1-multi-head-attention-fundamentals)  
> 33. Matrix-Driven Identification and Reconstruction of LLM Weight, [https://arxiv.org/html/2508.06309v3](https://arxiv.org/html/2508.06309v3)  
> 34. config.json · Qwen/Qwen3-8B at main \- Hugging Face, [https://huggingface.co/Qwen/Qwen3-8B/blob/main/config.json](https://huggingface.co/Qwen/Qwen3-8B/blob/main/config.json)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAZCAYAAABD2GxlAAABq0lEQVR4Xu2WPyhFURzHfy8UUZJSikhKlCgyyCijFIPYDRKDoizkz8Aok4nBMymLiWRmM1gMUspoYRTfb797vXPvO+d0PV6Pup/69O4759x7v/fc8+eKpFiphDNwELbAKdgVaVFiauAV/IAvcBFWmA1KDQNuBr/fphVOxgsNOuAO3Bd9NVXR6kQw2BYcgmOwMVqdTyechZfwHR5Gq78Yh3ewV/QmG/Ac1pqNEsBzs6JjsB6ewoFIixgMyCfhCU9iD9gM7+G0UVYHb+Bc8L8czov2rs1Vsb/WFXgser4XdvWj2AMy2BvsM8oy8Eh0wNtu7KIHnkju1S5Lwmv4Au5KfkDCts+wLVbuYxgeSG5o8Np7og/sxReQZa6AtnIfnFjropNxAV7ApkgLB66A4bplC1JIQFIGGwJ5nAhXwGrRp7QFKTRgQbgCElcQV3lR8AXkwmoLwrZcmhKNoZ/iCzgquohzBoZw0z8L5HHRCQNybcvE6rjiX8M1o6xdtPd8W+OvwF7hjdhD/MKgr/AWdhvt+uEDXIITorvItvyxLxHO6BHRrZHbX0pKSsp/5hMZe1fDzG2zpQAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG4AAAAZCAYAAADQfBuCAAAELklEQVR4Xu2ZW6hVVRSG/8igULLMS4GShhSKoqImQT2ZEUIgZhgF0lOp+OAFvAsShJj2kBFESVEQvQUiopiEFxCphzTSIAoxrECph0jfuozvjDXPnnu21tpr7X22nmx98HPYc83LmHPMOeZY60gNDQ3/X24zjUwLG4Y/M0yvyh3YUJG7TC+Y3jW9bpqu/AV8RP6ces+abm9/PEjc32umie2Pc9lmejotzJhjeiotzAGb15pWpg9uAnXWoCu7R5s+Na0wPWCaZTpp2qCW8/j7kuk70xOmB00fmz6SGxgzzXTWtEVu7HOmL0zj40oJ2PC+aWxUtsC00fSl6W/TpuhZEbS5pmp1+0ndNejK7jWmrUkZYesr05Ts91x5x9QNPGT62fR8VIZh38gNDnfWMXlb+ijiSdPOpIzJPGNarGqTwvmfq7qT+0XdNeja7g9Nu9UeGjl5OI7TB/vkHbOQgVGm46ZDpjuzMgb+Vb7jAgtNm/XvkxlgXMLvY+mDjLBpyiZFH+tNe9S5br+pswY92U38xSk4J2R1y+UOwTmAc4scd0nuaHbOGXlouy8Tu6/oHgxMMH0gb59HFcdxOvfKnd+pbj+puwY92c19xd2FY76XO/JUVh4oc9zv8pPJDmOnYfjb8mTjLdN502xvkguhdnVaGNHJcSwWCcBkda7bb+qswZDYzYA/yp2DcNTd0XMWl/KlURl33C9qxe4w+F9RPUIBYfhb5WdVI+QT5E4tomxS9L9OfvlDWd2YMaYj8jlX1Y6BluVUXYNu7W6Dzjhhr8gzSzrASaflRx3YHVywhLQ75AMTszEwdRy7K84OOaX0R/8pOP89te7IPMom9ajpDblNUFb3RlB1DXq2m8vyoNob4MgD8oHiLJJdyivAT/LQukr+2hDuOMIlYfO4WncjBKM5xSlM5MW0MKFoUozxjjzUBIrq3iiqrMGQ2M1AOCHOgACHEkryFjvAjmJnHZKfmAmmH1RudAxj7FfrlaOIoknNNH2t9nB2RT7WH9lvXjPyIGIQTdhwVXXPQMtyqqxBL3YPwqJckIesFN7tyDSBU3hC/nbPpIG27K7wHsd99Yk8o7o3K4M0TARo/6baX0PyKHJcHlXrEqJI0ZfV0IKBluXUXYNAVbsHYVccVetlMTBOvmtIUyF0jFEYx8TJiGgb76xFpqvy+kCf6cUcKPvEFRPGTj8S5DHfdF3V6vaLOmsQ6MruqaZzcidw39CYEEiiEpyJcw7LnUUd6n5muj97HsCh200XTS/LU+HLpnlxJXmyQ6JDaCmC73Z8mWGnBv0mT6TST0f8Jpn6U626hJ+OIacPVF0D6NluXhDZIYQEPubm/XsFgxicOg+rPMRNMi1RcV+Pyyd3K9NpDf6T7FLxJ66GYQrhkTBZ9ImrYZhCQlKUXTUMY0hu0vfGhoaGhoaGoeQfbMQkvaLlKVEAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAw0lEQVR4Xu3RPwtBURzG8Z9BUUomMwPZlKwmi4EUE96HssriDSibF2EyMCozdovJxmLhezp/Opxu3VV56tPtPue5dzkiv5U0BlhijvLnsU4WG0yRQRUn9PyRyhgH5LxuiDPytlCHarSyhUkdd3RsUcFNwmEND8y+i6ih69t4+YVJMGxJzGFQRPVBEdUXcfULEzuc2ELdxA5rpGxJmniap8sIFxTMe0L0de5FX69LEgts0TWjo+g7D6L+UkIfDdEf/xMvb7M7LHVni9rlAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAABlElEQVR4Xu2WrUsEQRjGX8Hgx+EXoggWoyAY1CBYFINgECyGMwgGDYIg2K9aNGjSokmDmMVq8S/QLNhELJYT/Hge31mdnaAzB7tjmB/8YJl39u6em3lnVySRSJTJNHyEH8ZL2GrVO+CVVacXsN2aUwb8TSuwyxn/lSZ4CF9hHU7my18swnPJhy6aHrgEj+EzvIcD9oS/6IYncFN0RQ5Ew9pswaozVjQMtgDH4Zk0EGwU7onedAcf4JBVb4ZHZl4s+McHB+NKrJnrmuiqbXxXRXpFP5grG4uGgu3CMXM9Irqfb2CnGZuC++Y6FsHBsv7iqhBuu1P4DufMGFez7P5yCQ6W9Zd9WDAQgzEgT8GQ/uJxzC/3sWLu8SE4mN1fGdyC3IrckjPi318tcFv00eHjqt7mRVAwrhJ7Z8ItgGXRQ+QW7ji1GAQFc/vLpl/06Ge42P1FgoJxm/H1qM0tGGrwCQ474zFgMD5fB92CzSx8kZ93vzqcz81QePTz3dGnv4qgD15L/re+iQZct+YlEolEIpH4r3wCVlxVXVGEC3QAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAAAaCAYAAADR2YAqAAADoklEQVR4Xu2YS6hNYRTHl1Dej8gj5JGJCKXkFgaSRyHJQDGQAUPlWXegOxFFkcdEJMrAI5Q8krhhIIxElBQSGZgoAwPx/93v7Hv2XfvsY599r9s+2r/6d27ft8/Za/+/9a1v3W1WUlJSZYg0wA8WnGaMOcFc6aw03E8UBAweK/V345OlK5XPpmSi9ECa6ScKwHTppfRb+iJN6zrdwSLpuhU3cVLpIx2V2tx4kSDrb0rtFsqMh2c4Ie31E0VnlvSm8vkvmSMd9oMZmSC9l/a78Tgt0mtpqp/ICLERY69CtpBV//rQmicd94MZWSr9ktb4iRgjpWfSRj+REWIjxl4j2s6tfsLBQbdSmuQnGqA75pMg1PvZ0jJpodS3yxWB09IFC2WoUXrCfHxaLS22ZGOQYLz0wcIXajFYOindkDZI56RX0t3KXCPkNT9KkJ8WmgIymzhuW/KAZZEeSUPdeBa6Y/44Cx3XNQs+7bPgkY+vC9zsq4VM8rByp6SHVv0ROg0ykJa00ezKa35U7+9ZNQ5+67slyxBJRDKRVI2S13xaXLoxvMIzYnwifZNmxK5LwM0+Vj496yzUWVYyggOJh94WG/OwKKMsGBDXculMjXFU77whMcj6uNHE+8OS3Q3mp7WjEdzL3x8RGzH6cZ4lLdH6WSh1n6x60DO2RVpr6d/rIM38aKv7B2HL89D++jhjpEMWMiEutiRdlR9HnCdpYLDPIuKg798RGwPMJznqdS3rLXl/RGzE6McPSiM6vpmEmIiNkoPpDZFmPivO9vVdEKtMzR8dG8tK3rJDffd1/JiF3dASG4PeLjvcr1YSZIKs/mzJzIvMx+yIqJWjm+DvI9Kw2Pzf6I75KIKOgn7+kiU7CnbEOwvXNEoe8/EN82s1LIOsdkfWCRlMJvsaPlC6Y9WDFe2xcCPKABl3oPPqbOQ1v82q2zqKA/NrvctpteRuzUoe82m930qb3fgS6aqF8yIVHgaD2cYeXrS9kM5bWIjtFnbCcwvvUWo9fD3yms97p/sWFuCWhVcMU2LzESwO1/hDOCt5zAeynwP3soUzot1CYmaqCnQzTy2UEg/bmi0cZVLUyeTJrLzmQ3TftIMP6DbYEf4cyEpe8yHyiWajbqnx8FCPpRV+oofhHFnlB3uQTdJFS54DWSG2PAd1t6GHZttQ65sREoiSNN9PNANs690V1f3HoIAQb5u0s/J3U8J23SUt8BMFhxdtW62JjS8pKSkp+X/5A/CgpleF7EjhAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAAAaCAYAAADR2YAqAAADpUlEQVR4Xu2YW4hNURjHP6Fcc82lSCQliiIhPMmlEBLK5ZEXL27JSE1JFEooESklRPFCRJmiCClFJB5IJEkpTx74/6yzOvus2efM3mtmzDnav/p3Ztba5+xv/9e3vrXWNisoKKg/+km9wsY6pZFibZOp0jlpQNDOQw6TugftXc0Y6Wrps6EZJd2TJiXaZkufpd/SE2lQoq9emCtdt9YJ0zB0k45KzUE7DJVempsRXFdvENMJaVfY8S85LE0JGzMyWXpd+gyZJv2U1oUdOSAu4ussZkmvpLFhx7/iuDmjYiBrblj64rXZnPmxvw18l/g6C8ohZTF3grCITZQWSH2DvjzEmo/hGN8Udpib0pQbHmy8tNRcFuctPx1hfk9purRcGh30wRnpguWIbYL0SDogbZRapE/StsQ1WYk1f6T03pyxIb7ek/mXzWXWLemkOTOy0h7zMXON9NacL/z9UFqdvMjc7L0v9Q/aU2F79EbabeXR4uHYWSzzF+Ug1ny+80WaE3ZYud6ftrLZDFLeMhRrPr5sl75KM0pta815dMxfVIK4SCKSqSY9zE2Tj1a5SDCy38yVoWpQJrhBqLPSwpT2IVZ7KmLMh9JnCMkQGs1D8vBpM4X7cL8wBuIivrAdpa0zHj/4zYm2cdJeaUSiDYiHbTH9NcFcTOaAwEAAn/zfYu5QU41V5jIxFLuVayntB6WBf7+ZTjXzfb2n7FB+PPvNmb840ebhIHbIWsdAXMQXtqO03/GQ3b8sfVaGYP4Py7Dj89nDTsIzXHpnradTVtpTdtLMJwFarHIR84tzOGPbIqbs+PvjCd60Reay481PjjqjyyivNLdv3Zroy0Ks+UxTFvkwA/3DJw8vnAO+S/usdikLiTGfnd9dS68E7BD7BG2UyEwDxUNQdvzCytGYG/n6ukeaX+rLSqz5fkeTnIVAGbxorswACy5lgjjzHuVjzAcG/pm5dcTDoJySNiTaoMmqn1UqIGu2SM/NLUR3pBXSC+m2dMTybeUg1nxf29PKHS/ankrnzW3jGIzBFVdkI9Z8BvmSOZ8YeO6PV/Oscub59TLXKwamU/JtIYaTiTFvD2PNB7Zvjy39xRmxEGM49fMQa76HDQO1vFoMrD+8XqBcdwlLLMNiUwWm9QNpUdjRQRAX8XUW680dAvNWi7qB9eeK1DvsqHNInJtWPoQ1JNTQnSXl2cl0JcTZbO4U3CgxV4Vpu0OaGXbUKbyM3GT/gfEFBQUFBR3PHwYzpl3rTyPQAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAaCAYAAADPELCZAAAEjElEQVR4Xu2Ya8hlYxTH/0Ix7s3UIJpGvrg1pplxCw0hl0iiFPk2wwfN5DLEp1OSpBCKXJp8kEJ8cBmhnCJEEeWSSyIRQskXd+v3rr3mPHudvfc5x3u8Yzi/+nfes5999rOe9azLs19pxoz/KrubdskXtyP2Mu2cL86HxabTTOebDjHtWB8e4kjTZrkhAU7lOTsU1/7NHGV6SPU1TAyLPdH0ummL6aJKz5k+Mq0Z3FrjANOLpsOq70eYvjH9aerLnblQnGT6Vj43eta0azG+p3w9MY4eN+1WjV9sukd/MyL50c2mTzXsLMbuNf1gWpnGcPztpl66zm+e0MI7EbAJe38x/Ww6tj48x3mmx1R3MPD9Sfn4RLDgu03fy0O6CVL6O9Ndqqfn4aYPqs/Mg9o2TtxHPvdGeaRlm+FKeZY1caHpFU2Y1peZ/qg+28CwN0zvmpYU1681Pa3mhrKtnLjCdJtpP9P7pi9My4vxnUz3Vfc1cZDpY9PxeaCNg01fyidbmsZKwomfyY0DHIcDr4+bEm1OpNlcIP/dKjU3LZ691nSu6UB5LSOyrtOgfrVBhF1a/d2TR+PlW0c9CLCNNTXB819Q+7qG6MknuTFdz7A7X6nuRD75fnbclMhOJKUukW/GWtMy0y2m5037VvcAnf5D001yh3D/J6b1ps/lju/iVg3uocxQy1/TID2JsDurv9vAdjp1LgNDsLi+PJVPqQ8NwTj3vWTao7qGoV+rPeyzE0+VL+iEuEFejx+RF3OKOqKjUvRJO6DI/246WT5318KiHkbJ4RkPy20/vbpGlLbVw4Ay1ddwFg0RkUTDoHF0cYc8YnvFNZzYFRmlEyP1c00FDP5VvhlhE78NiHTmphmMIuph6WichxNxJpvUVQ8DbCID2lJ+K2FwmaJNUJM4J3L+irMgTOJE6i0pGd9LMDicFEeMvgb3EYltR5VMWQ8D0ph0JguIZuwa5Rxswt6uPjEHEUFkdDmRHaWYs8ir0tgkToy5mnY3nBgpdqbpR3nEbJCfXWkMXWkMjFPr8jkXOEQzx3vy8/Aoxk7nqBeRSk1wbmQHObzmUzzNhs5+RroelE6MuThu8IZTQlNjDpoA4IjV8i7O5o5cSEWuhyVEFCeQcrO6wCY69KiTwBy8gbCAzRp2EqHP6xvdLp/sIaIrp09QOhGYiwM9URHgKF4zeeuJSLtf3lh4bw9RRrJ9GezlFW5RHqjoabz6jx10ZvrA2BD+HC5ZDLuEtpjekRvWlkZcx/l5Mt6dOaKw6wjHRfc/1PSq6SnTA/JN2KS6g84y/ab6+y2iJhOhGZ79kwb3UT95RoZIp/PncpJhHF+ckwdGwYGXHWLX6Yb7q915JbwiMeEowzJ7y1MsRxfRygYcl64vNz2j9rejaUIDI/WZc0EgHV/W4Aw2X+jQfTXXQbr0WB1zHhA4N1QaJ4imBmH/qJrr5qQsM71tukL1KKUMvGm6Rv/s4ngNpqFgx4LCoqhraBoL5D0ZZ+HMtypRQ4/WdJ7fBptGjZ/432DTAgOuNh2TB7Yj1ml6ZWnGjBkz/nf8BcUu7q4Zz3qbAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADC0lEQVR4Xu2XTahNURTHl1CEJF/5SmRAvhNRGEhiwMhAMcbAyGeMzsTAREIp1BtJIpn4nFBkwEyJQiIRQsyk8P+9fXb23ufsc+/r3mfy3q/+nff22nffvdZZa+19zQYZOIyWRqSDHdC19cZLG6St0jxpaGyusETqkcamhg6YKV0pn31miLRWeiTdlLaXuiO9kJb/mxoxXborzU8NYoJ0X/pT6pu0IJphdrC0eb2TFpa2NdI162OQhkvHpNdW3TS2s+Y2sjSxEYATUpGMp2yRvpvbbBGbeiEgD6W5yTjrn5YOJeNZ2OwZ6au0IrF5SLUv5hbmCzxE+Xn5bKKQdpmL+jNpcmQ1Wyydk4Yl47DK3GdmpYY6dku/y2eOcdJj6am51PEQsevWXKijpPPmok8weDvbohkunfcmYx7/3cxpZI703uqjFeIXfCNNKcdwAEeO+EkZZpuLOvOJ8k/pljQymEOKrw7+TyEYFyzOigqFuUgdTcZT2NAHi53hyf+b/aQMm6QD5d84gCM4hGNAoC5ZczDJABrJmNTgoY/fM5di62NTBezMCxdcJn205ohCYfH6pBgB9PVHPVKzdfXiIWBhICv4yFLYLNjESat2Ipx5Wz5z+HqZFozxBkhrmgFF3VQvHpwhM8iQWrwzjR6LGebOmc8WnyXtOBPWS0hhLjh7rHW9AM78MNf1aqEr0Z2anCENDpv74n2JrR1nOF/4fIpvPKTpbYs7ZB0t04wcvSj9snxkOHc4LDk0OY9CiDobosBzFFZfj/4wJEhcWZrqBUjFV9bcJHpPdDbbY9XNrpM+ScctbqMe/2Y5DOuYaC7qi1JDiW/Tuc+H0P5bnWe9cH15ae5O5u9j3M2emHMo19sZJwg0h5BJ5tYK71unrHpZJUBXLZ8VHt4ab6/tKw1fREfjlkx+TrW8EyG0WTbOWdFf0PHofv5c6jf4qfBA2pgausgOc4dqWgb9Ah3rstXXVacQrBuWvwB3HdKR6wpqJzXbhbUKc0dCN9dtCSmwX1qZGjqAX7o77T87MsggA4G/J2WStVh5SPcAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHkAAAAaCAYAAACTmvO9AAAEcklEQVR4Xu2ZWahWVRTHV5RRZBQU2WRJlA3aAJW9aC9R2IMRYlBUEDRJ+FJS0QCBEIVPFWUQCEY0aOCL9lISF4OyAvElhKCHIhOJiiQljYb/766zPfvse4bv656uOzl/+ON393DOWmuvaR/NBgwYMGAmMEs8JR0ccGzZ5VpxZTrYgcvFR8WT0oljCP/GLtliXGXw8E3iJ+KpydzRxonievGw+HfEH8Tfit97xFXmerRhXLtkjXGVWS7+JX4rnpPM5QIyzU/i2+Jx0fjx4rPmh706Gq/DuHbJGuMoc5b4sbhP3CteVJ3OBreZH+TD6YS5vgfECXF2daqCceySPcZR5nHztW+aG4q9OeJ5a5YvOMC74gnJXIxx7DLpLeeLt5inEWrBdeLt4txiDSllvriiWENaicGeG8UnxEfM18ZpiAaI1Bl4hrkCRF48Fu8JGFWZBeJGc3045D/ExZUVeQD5JsSvxDOrU3aauF38Ubw6mUsxql0mwWFS7PGeN8S3xLvFZ8y97YFi/DHzh7L2VSu97GRxi/iFeIn5y3eKr1vZPFwj7rCy4cBLzxO/LP7+WVxr9d3wKMogy8vikuLvJ82fu+zIinxACaGUbBbPtdLJkR27MU7QdWEUu1TAQ78Xd4tzijE6UzrUQ1YaD5Bq4qYG7+MAv7Fy71LxT/PUE+MGcb95xJMNXhCfKn43YRRlbhZfstLxwiHjrLkhpOMPzYMncKu5vcmIdRktxSh2qYAD4+BeicZCWkmvIhgw7VxZGzcJoXlgbQyE54CJXObICNO9KuBkZIaLozEOF0Om7wc3FWxDWl7a2FRmmtBUj3kGDo/cDyZzdTJ32WUKwiHHRgmHDOMDrDtkUja1eFdBvJJrTJ2RQ3r/VbwqmatDlzLMxXfOmLHTAiIdIxP5bbjVqlHWxhfF031bJ9rqMQjBsc3Kr1lNMnfZZQqmc8j8+7l5fZ1XjDVFMiByaYx+NzfSdCJ5nnkUE00xwvt5T05ouh8HUOYIjg+svj+J0WaXWkznkLnrIRgCBsSHTOq8shhHMa458A7zDvieYq4JTcrg4dTh1MNBXUScLa4T11i3Y/1XaLsfIxNf6uJepk3mJrs0IjReT0djbYeMN+KVAIERPG6yQgplLUQgmqv7xY/MazwHTk3+RVzk22pRpwzPustcNmpyigvMbwET5rLzrvvMryWfiheGhTMMysdB8fpknExEdGOz1ebydslcZ5dGsPCwlXWMqxDRRXMUxvjN2GfRGHvYi5HfMz8s0iN31VXia+ad+fvm16+4VlLz5ph35GHsaysjPkaqzL1WlZceINQ3opb3Ew1hnm/Cz5lf73BEoqXtI0PfIO1usPLbdLDndwX5jT70MVf4lkkgY5vMqV1mBEQMKTyuJV11ZRT0pQxGeke8M53IGG0y92WXLNCXMpSXHeJC8SGrb3xyQ5vMfdklC/SlzKXm/3lBE3NZMpcr2mTuyy5ZoE9lKB99lJCZRJPMfdrlqGO+Tf08OmCwy4ABAwYMGPC/wz/nFwuzk6JiTgAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAAAfCAYAAAAV8rhrAAAE80lEQVR4Xu2aWchuUxjH/zJkypwpdV5DJE6UKULnAhniwpBjvjqdQ8kUckRfoVwgRZShgzJPCaWTi5NOHHKjTIlypCThihsZnl/PXt71LXta+93v9+7v+H717/v2Xvvd+93rv9aznrXWKy1+zjftlJ6M2Mp0mGmbtGABOdR0XHpyS2eNaef0ZMTppo2m3dOCjhxoesv0jekj04ZC75vOkjeElGNMK9KTWzp1xuxqete02bRfUjYJB5k+l1d44EzTd/LemdK7MVvLW8HRacGAqDPmStON8kqkMvviNHkPiXvheXJj6FEpvRqz1vSmvLWdm5QNiSpjRqbrTcfKKyxu3ZNyj2mdxmHrENOHpnP+vWI+vRoDvPAG5RvD5wgdXbWb2lNmDBWGKSP5/egxJ8cXTMD2prdNL5vuMN0lD5dnq3x8gcEYc5Ppb9MfphdMjzWIF/ul+Az6wrSP2lFmzAmmx00XmlaZftX8dzjFdGd0fKr++52CHjEdPr60dHzh3LfyRAPS+w/GGD63Xl7Jt6i6JaUQn18z/SWP2W1IjdnBdLvpYHlvIcx8YFodXTMJZePLAabvVf2MwRgDI3lK+afGLakNJBy3mZ5Tu7lHaszF8soLhHe4tTg+Xt4Tus4r0vGFvzS+z+QGld1/UMbABXJjvjItS8rqoNXzcm0yqWDMSB42f5dXHmMB5+82/WT60nRtcd19Ks+e6hiZHjb9YPpY41C3SR4295U3KsxJ7z84Y2hND8pDGq1s2/nFtfBsKreJtMc0gdn3yitwGpTdv1djmL88Y/pNHqNvVruKSgmTPMwhKeibXGMIc2vlafQ0KLt/r8b0CXGXzAjxf5/kGjMLBmsMXC7vNe/Je1FfsIDZNuubFYTw7dKTbQlziBzlwJdjsORzj6pdxlVH+l0WkwbHMnmGxgRt/6RsiRlCCHtJ/Y8zMWeY9k5PJuwlT2/raNrnWXD2NL0ob9ksYobxgOVsZvPMB8jWctazgFD2kHxuM00ulc/4q2COxHtdlhYkDDKpoEUxWftRvs8QYDZ7VXTcFgZn0m007YG6yZiL5Gt4YSWgiipjmDKwFjcTSO9o2c8XCgM161eU5UJYILefxgQzpc4YQtycvNGxOlBHlTGco2wmrDQdJe8t9Joj5S2dNSx6Uw6Ywuw/xxSuTVd121JlDN+fleYjTE8XqqOrMTybiTTLN+z19wYvcIN89ZTxZZO8lXHM+ZxQxCDPYJ8zb+H+LES+qn57DIZgDPcnjL2i+pS9izFslPF7gKks99AjGAsCTAxZOeWhl0TnmyA1fqP425Zd5AkCuX7VEnoTZcbQAx+QVyh7NM/K1wBDxe9heqL4GwjGkJmxjRAWLdfJl6jCMSLCkDR9In8OzzhJeY24EcaQeC+EDSuMeb0oawM95B15HOdL1uka05OmTzWegP2sbmEMyoxZIa+8sEPKbwF4p7qwnNtjqBsyVqJE7i5sK8L4EjOn5heJuU6+z95VT6lbGIPUGFrynDxNDrBavlljo0hM2IqOyTWGZf6NmkIY4wUYpFloJL6PojIG//vVc9ecErExhMOv5S05/NKHbeT18n0iMs4TTVfIx7WYXGOom6vlgz6NG7N77zWLmbTHNEECQKNbrvm9KteYAONZTrLzvyHXGMIzAzbhLc7SqoxZoiO5xlSxZEzP7Cjfe5+UxbDPs8RC8w+o5yav9cvbYgAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAdCAYAAAAU0BSYAAAC40lEQVR4Xu2YS6hNURjH//LIM9wrMVIGJAYkSkp3IFLIs0SZyKMYyB3IrVtnokgkA4Ob8ih5zi6RDI4MCMXEI5EoDE2VxP/ft1Zn7e/u6+6tu7XT+deve9Zae33n/s9ea6/v20A1GkFOk6N+wGkKuUTekhekGXhMdpOR8cI6ayn5Ri76gRxNJU/I+qRvAflCupK+WmocaZAT5CYZlRkdqHmwuzo76VsMM7ss6aulNsDuyGHYkpyYDuZoB7LXdZA75ABsO9RW02EmR5N15Clsmf5JZ8gD0gtbEXfJHtR8v+ouHCI9ZAs5Tj6SmWF8LvlMNoa2lLdfY9++pK92mk/2w8yJ1eQ9bE9K2st6ws4IbSlvv04iD2F3vJbSsm3AlnGUHjKfwt/B5PertJl8JYuSvtpoDXkOW6JrQ5/u2A3yE/awWR76o3S+HiNvyAfSF7hPbpE5rUvbaqutQfTrP6Mtr07YEzZKT8YlSTtP05A9P32MVWgdS36sSPw8+XmbyISkXUhKCLYnbZ2TXUnbS8lCP+zMjPIx9DlmUn4sL/5BWLKh0k+pZJM8ImdhubPk5ynjGioPH6Ai/0yqreQHLCeO8jHKmpVUC59HqxjQj6q8+WRo+3mVm9XSbJCryBbqPkZZs2PJbWRXi4w0Yd8n+XmVmtUvrlxXObGK9LRQ9zHKmlWu/AqtVFMV0BFynUwOfX5epWZlUmZlWks4LdR9jLJmV8IqJq0WlX4XyDlYmhnl51VmVon/KdgXqJy7jGxC72OUNev3a+zrh+1dyc+rzKza22DXip3kJewIknyMMmbz9qvUg+x3+HmVmO2EPSTiLyzprURaqPsYZcz6/SrNIq9Jd9Ln5w272b3kHaw0Wxj6VpB7sHLuCuyNhI9R1OwuWEn4HbY1+sg18gxW56bLunKzReVjFDVbRn5e2+xQGo5/xseorVkd4OOTto6ZMUm7iHwMfY6vRv3Y38SX/DwVAbV+z/xP9Rv1Y8TEw4oK7QAAAABJRU5ErkJggg==>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAZCAYAAABw43NsAAADi0lEQVR4Xu2XW6hNQRjHP6EIiaNQ5ByJPLiUWwp5kKhDcjyISFFSlCeX8rAliSfJpVwSJQ8evJBCOQcPQvGCcknK5UFeFLnk8v+ZNWfP2tbaa845O6XWv37tvWbNfGvmm2++mTErVapUqVKN0gRxQBwXq0T/9Otc9RKzxCFxVMxLymoV2m8TvdOv/4hv8m3q7BWj0q87FWPrn4kOPBZTxUCxR1wTg8NKGeorKuKumCQmig6x26oO5HedeCrmijHinDhr6QkaYa7tQXNOaxUvxZygTqytXPVLaJRGi2didVA2RNwTm4OyLC0X38SioIzBfhCzk+dp4pOlbY0Vb8XK5LmPOCmeiOG+krnou2PVSYyxVVdUJir2i6aad90RTqNDdMyLGWZG281FYpaYwMv2d9uR4pW5ZYz4/SWWdNZwNtvNtccOEYvDKQu/R5ufYkHyHGOrUAxusrgiTomW9OsuiQ7VOgCdEe/MTVaWfKdr23rn8Y462MkbMPWo7yOKslrn0XZ78hxjq0sieV5I4H9XRYdqHVCv3KvIeS/MLcF6A/4oplix81jSKMZWt0T0EYU3ze1+RGeR8hyAipyHKuKzmBGUkfO+WzUSyEUMmPzoRTQT1d4+OY3cdksMCuqR82hLX1CMrR6JDh+xOCcOENct+8MxzmO3Y+fbae477L5ECQP0zsMxfON08p56O8zlstB+m3hvrs+o2dwGEjov1laP1CSOidvmOlFPeU7KK69Vs7kBvREPxBpL5zw01NwGRB2cvcnc5HoHIxzRKp4n5RfFRkvnPBRjq1ui8WFxw4qjzoulkeUknPfa8g+qefI7p99tszRMPLLiHRLnhbttlmJt5apFnBCXzO3CMU7zWip+WLqD/hgSdohTfHPwjEjQD8WyoAx75EF/zsP5HWKrVfvFRJHgw7PZFnM5j1SAqMvyDM95sbYKReNGHFdY4twQKkHZOHNRF3ZovbkldN7coRb53bCSPPucRMrwdRgcke3bkau4Vl219M5KpH+1qtNnmtsImAyvWFu5wmksSZYmS7RH6zzRdHNXoW1ihbnbBYdwOueFo74kdfysEwn3zV3ncC7/iRY2Ii8GxQQzSA7kDJRDPtexUDiJK+IGscvc5K219CqKtZWrxWKfNeZ2EYoBLzS3BLmyxYplPN/qt2MSmCAmZrzlpxXOhUwS/QgnIFSsrVKlSpUqVapUqf9FvwHMgeh8Z7kvxgAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAWCAYAAACL6W/rAAAAuUlEQVR4XmNgGAWjYBSMAhoDPiCuAeJDQKyMJjckgTAQdwPxYSB2AmJmVOmhBxSBeC4DJIbMgZgRVXroAXUgXg3FWgxD3EMgx4NiZTsDJJZAsTUsgD8QfwLiIIYhHkPYwLArJNABrFg/wQCJyWHnQW4gzgfic0AcB8ScqNJDH7ACcQQDxIMgj4I8PKwAKEmCkuYOIFZBkxsFo4BKAJSPxIFYkggsxjCESkoDIJ5FJO5lgHhwFIwCKgIAWvIZc96tnjMAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAAAWCAYAAAB9oOpzAAAAuklEQVR4Xu2WMQ4BQBREv4iISDQSoleLTqKjlmjVHMAFxAVEp3ILJ1BoFCIO4SDe323sNkSj2HnJq6b72cysmRBCiL8xwSsusJZlxdPAJT5whc00Fv5i/OXccIOtNBZVnOIFd9hOY1HBEZ7xgL00FnXc4hP7WVYk76W8NpVyOIAf4m6a8YCvkK+R/2vmFku4aLxUvVy9ZMemgwRmeMKBxRUSQvyEL07XYs98smMF9c8Qj1+6N/1+hch4AUHBGV3EHlQ4AAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAaCAYAAAAUqxq7AAADGklEQVR4Xu2XS8gNYRjH/0K55ppLlI9QLgvis5AUIYodRdhYiJSSJJf4SpJEESlsZcNCkWz0lYXbwsalXPIpWRBWFpLL/9/zvuY97zdzZs5hjvjmV7/OmfPMOXPmmed95hmgooIspy/pbXrHvddrJ31Cj/7aswfShx6mU9z2AvqCTgq2t7r3DTOCLqOr6TTauzb8TzCRbg62d9PrtJ/bVoKWJuF8etGF9D69Qdc7b8Ey357s2lIW0ff0R+BHujHY51AUv0rH0KEurmq6DKsozyg6PNiuS1/YenyF7olQ7Bz9RGdHsVZygX6nS+IAbBndoxuQVEjIOPoM6d/NRQk4C7sq86KYZyYsQadhldZqhtEHtAt2siGL6TXaFn0eEvefhtgCuzJ6zWIsfU0f05FRLETJa3OvWai/DYw/zEF98ANqe4j64nZ6hPZ3n2UR95/CTKZv6SPYmszCJ0jqfRZa63vpDqQnSSeqPzohDuSgXqjeohMVSvAZWB9KO06IkqJjhv2nMB2wA+u1HuPpG+QnSGjJHqO7UPvnm02OOEW/wpbKVPqQ3qVDwp0iBtGD9CL9Apt/TqL+UqxBP9CJ5MD1UFz7aeAaHMXSiJP0O8nx/UcXZxu9BEuO2oIGwdIoumyESrtIpYX4JJ1H88kRvv98o/tgv7sW9n+ULC3rUvAJyqsKlbGumGaRGVEsj7mwHrcf+b0iC99/9iD5jdH0KezOqjtsKehupLuSnk90wCw0W6icd8aBHGbRm7AZ5QC696SiaP5JawMdaLyqG0KlqRL1V0Glq4lU88Jxt625SHENitouik+OX1b6bjNJ8v0n7SL62UyVFMf+GJqMfQLW0TXuc90+1RC76AnkzxkhSo4Gt7jnNJOkOfQz7DEh7jX+8UFVpCovjXb6HFbGmhW05vUso0rSlKqT0VBWpIIGwBpznByPH+7mx4EIPRKod+nkve9gF1FoZtMzYxjXLKe5rhR08mqoenpfBXsKDgerlS5e4dgEK201Zg1pV9DYMvvvWYGkdNWjsh5ieyx61tHcoeqZHsUqKioqKir+Lj8BumWiSzEopbUAAAAASUVORK5CYII=>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAZCAYAAABQDyyRAAAA50lEQVR4Xu2UIQsCMRzF/2JRjCabWmwWEavVYPWrGI1iEQTFIPYDq2AwCOJX0WjTqu9xN9kt3bY7MOwHPzhug729u00kECieMpzApvG+UKpwDFfwDl+wl5phUEnMCwYYwSGcSYYAbXiGC1g3xnyZSoYApAS78AT3sJUediZzAJ0OPCTy2QenAAq2wDaucCBxS7Z4BVA04EbcguQSgPDn3MKb2J1p7wDc/RpexH73xDkAv/8OHiU+HbYLK6wCFHEUGeAN++aADhdmvayZdbN2H2owgk/40XzApTbvB6/NueR/CwYCgf/nC018K4D0OzkoAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAZCAYAAABpaJ3KAAACJUlEQVR4Xu2XMUgcQRSGXzCKoiBiIYIQTaEERARREUNIkcbCICQIajrBKr1gYyEiWggGTcBgkVQBSaekSGEIFoK1pjYQrbTSFDb6/3mz3u7czd3e3t4Sj/3g47jZYef+ndk3cyIp955eOA0fwQE4BWsCPSqUUXhj/Ak7g5crFwan/w1VcBy2W+0edXASbsIV2BW8HBqGfmM+n4qOmzgMwx+wBv/AK9gX6KE0wu9wATaIvqfH8JW/U0g43jvR+0zADVgd6JGDWmNcMPgIfA7nxR18Fh7CJl8bi9Iv2GK+PxNdDbl8D5+Yfn7aRB/gkH3B5rHok1+Gzda1UmG4XMEZlqE/We398BK+tNrz8VD0NZkx31vhiYR85x/AHvgNbsGO4OXIuIJzps4lOzj7sf+i1Z4PrtbPoquM8N5cNd13PULCArNtjFpsPFzBvYCu4HZ7IYZFawVn+St8KzqZkeCsc/a5Lw5KtBu5gnv7rh0wanDCwsZlzs9Y4M1YJaM8AFdwLsu4g5cFFr0PcF/ce3IuXMFdAV3ticPZXod7UvxsE1dw7iRnkh3QCz5ntScG3++PcEe02hcb2MMVnO/hD7grwTPEC3htPhOD4eLe0hj8r+j+bMMj5m/JjMPxWZkPRE91ZYcDchlzOXNZc3mXQj38Ai8k84+JnsJVXz8eKVk3OO6YaOgj0aNrIrDCLkn8p7Yw8KHzL+Rr0eNpwfN1SkpKSkpKyj9uAfRQaP8zbMBtAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABaElEQVR4Xu2TvytGURjHv8IgyqAUKZLFZFCkKJPRQHZZWDGIMthRNjFIUgaDASX+ApvVRmIzKAqJ77fnnPe997zv/cGm7qc+ve89zzn3ec5zzwEK/hNtdJXu0DXaEw/nppMe0dYwIAboJR2hffSMftNFWhOZl0U93aN3sMJjNNATOkNr3VgLvaavtN+N5WGKfiIhkQYUeIHtxrMC29VCZCyNLljbT5GQSNvdoheIB5dgifSbhd6xAfsE+0hIVI06eky/6Gg8VJVJ2M71PX+VaBD2fdQKVZuGTtkubXbPuRNpwRU9oI1BLERFrMMK8+RKpIXbdBN2GrMYR7llnsxEPskyyse8l46VZlSigu4DP2CH6BF2cWNdUUW6nPPuv2eWTkSe1dZ2pF/ixB1p0TR9ow+IV/dMh908XeIb+k6H3FiI3nUIe09HECtdWG039Il2u3lN9Jzewk5ayBysML9WLaxoXUFBwd/5Aft6TWcAEASsAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAaCAYAAAAT6cSuAAAB2UlEQVR4Xu2WMShFURjHP6GQMFgMIoUMJkoMLCSDUgxKJgMhA9kMyiBGKSUpyWCWwcIblYEUiwxKlJnBIP7/vnt759733n1Hue+9dH71G+655917/u9897tXxOFw5JtGOB4eLEBa4SbchaOwOHg6SRuchefwCx4ETxcUpXAFXsEO2ARP4Iw5yYThRmAPfJbCDscQD6IVRobgt1isuQ4+icXEPFEvGmzLGKsW3ckuYywttuFYGp2iu80b5gr2Au7SBCwTXW9lYEYE2cIx1LLov7cgerMLOGBOihHuGMOtwUM4B2/ghujaIokKVwK3JVjvZB4uGsdxwnUxXEKSO9YMX+GSd5yRqHDcHXbSVe+Y/9QgPIMN3lg6akSva2O2EvPDTRtj/E0C3sFaYzyFqHB7ohd+g4/wGE7BKnNSCD4XLGO+i2zk9aLw1zBsjPnhPkRfDRnJFI6LPPXOcU6+YPn/ebgieCTBWvfhl0FFaCwuuuGnaLf0+XVZMggDmbAzvoh+EfiUw3U4aYzFCe/HrxGWJxscydpQ+kW/TNgwuO30Hd7Cdm8OGwhb7rXo88Fn7hL2eedzBb+m7uG+6DPKNe6IxavABpaBTWeLEwbphWOwRVKrzOFwOByOf88P8Cti7amjZnQAAAAASUVORK5CYII=>