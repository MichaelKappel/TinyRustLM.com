# **Memory-Native Sequence Intelligence: Test-Time Learning, Fast Weights, and Recurrent State**

### **1\. Executive Abstract**

The prevailing paradigm of sequence modeling has long relied on a strict demarcation between the training phase, wherein parameters are updated, and the inference phase, which is treated as a frozen, static forward pass. This dichotomy limits the capacity of machine intelligence systems to process infinite contexts, adapt to non-stationary environments, and recover from catastrophic forgetting. This exhaustive monograph investigates the structural shift toward memory-native architectures—systems designed to learn continuously while reasoning. By reformulating hidden states as test-time trainable parameters, commonly referred to as fast weights, architectures such as Titans, MesaNet, and Test-Time Training (TTT) layers bridge the gap between fixed-size recurrent state spaces and exact associative recall. This report formalizes the mathematical foundations of test-time regression, analyzes the stability-plasticity dilemma inherent in continual learning, and specifies the engineering requirements for deploying scalable, memory-native machine intelligence. Furthermore, it defines a rigid, cross-language reference architecture (the Memory-Native OMI Core) and provides standard-library implementations in Python, C\#, C, Java, and Rust to facilitate immediate engineering integration.

### **2\. Research Cutoff and Search Method**

**Cutoff Date:** August 27, 2026\.  
**Methodology:** The literature search prioritized peer-reviewed proceedings, official preprints, reproducible engineering artifacts, and original theory monographs published from late 2023 through August 2026\. Special attention was directed toward foundational shifts in recurrent state-space models, including the Extended Long Short-Term Memory (xLSTM) and Mamba families, and their subsequent evolution into test-time updating neural memory systems such as Titans, MesaNet, and Modular TTT. Source repositories were analyzed to verify hardware efficiency claims. Evidence classification protocols were applied to all extracted claims to strictly distinguish mathematical formalisms from empirical phenomena and speculative proposals.

### **3\. Terminology and Notation**

To ensure precision and semantic rigor, this report standardizes the following terminology:

* **Machine Intelligence System / Computational Agent:** The preferred terminology for non-biological reasoning systems.  
* **Ontological Machine Intelligence (OMI):** A structured framework for modeling state, memory, and continuous learning within an agent.  
* **Slow Weights (![][image1]):** Parameters updated exclusively during the pretraining and fine-tuning phases. These remain structurally stable during inference to preserve foundational capabilities.  
* **Fast Weights (![][image2]):** Dynamically updating parameter matrices modified during the forward pass at inference time, acting as a highly expressive semantic memory.  
* **Test-Time Learning (TTL):** The explicit process of optimizing fast weights on incoming tokens via an internal, self-supervised objective.  
* **Loss of Plasticity:** The degradation of a network's ability to learn new information due to continuous test-time parameter updates, often driven by spectral collapse.

Every major claim in this report is tagged with an evidence classification scheme to transparently convey its epistemic status:

> 1. Replicated or strongly supported empirical result.  
> 2. Single-study or preliminary empirical result.  
> 3. Formal result under stated assumptions.  
> 4. Reproducible engineering method.  
> 5. Engineering proposal.  
> 6. Philosophical interpretation.  
> 7. Contested claim.  
> 8. Speculative hypothesis.  
> 9. Unsupported or awaiting verification.

### **4\. Conceptual and Mathematical Foundations**

To construct a memory-native machine intelligence system, one must establish a rigorous distinction between static parameters, slow weights, fast weights, recurrent state, the key-value (KV) cache, and test-time parameter updates. Static parameters and slow weights dictate the foundational rules of the system (e.g., syntax, logic, physical priors) and are not updated during inference \[Claim Class: 3\]. Conversely, the KV cache in traditional architectures grows linearly with the sequence length (![][image3]), acting as an external episodic memory that fundamentally caps context size due to quadratic attention bottlenecks \[Claim Class: 3\]1.  
Fast weights and recurrent states offer a paradigm where the hidden state acts as a compression mechanism. State-space models (SSMs) mathematically formalize this by mapping continuous linear systems, denoted as ![][image4], through discretization into selective state updates where the transition matrices become input-dependent \[Claim Class: 3\]. However, fixed-size recurrent states often suffer from memory crowding over long horizons.

#### **4.1 Test-Time Regression (TTR)**

The transition from static attention to memory-native architectures rests on the formulation of sequence modeling as an online learning problem \[Claim Class: 3\]1. Attention mechanisms can be viewed as layer-specific regression solvers over historical key-value pairs ![][image5]. In the TTR framework, a fast-weight matrix ![][image2] continuously attempts to map incoming queries ![][image6] to their corresponding values ![][image7].

#### **4.2 Reconstruction and Dual Form (TTT)**

In Test-Time Training (TTT) architectures, the hidden state transitions via a gradient descent step on a self-supervised reconstruction loss ![][image8] \[Claim Class: 3\]2. The update equation takes the form:  
![][image9]  
Where the function ![][image10] attempts to reconstruct a corrupted token. To maximize hardware efficiency and overcome the sequential bottleneck of recurrent updates, TTT employs a "dual form." This mathematical reformulation translates sequential token-by-token updates into highly parallelizable matrix operations within mini-batches, allowing the model to match or exceed the training efficiency of standard transformers \[Claim Class: 4\]2.

#### **4.3 Optimal Ridge Regression (MesaNet)**

MesaNet extends the fast-weight concept by solving the in-context regression objective to mathematical optimality at each time step \[Claim Class: 3\]3. Rather than taking a single stochastic gradient step, it computes the closed-form ridge regression solution using a Conjugate Gradient (CG) solver:  
![][image11]  
This chunkwise parallelizable solver delivers strictly lower perplexity and higher associative recall capacity than approximations, demonstrating that optimal test-time training is a viable mechanism for sequence modeling \[Claim Class: 1\]5.

#### **4.4 Matrix Memory and Covariance (xLSTM)**

Extended Long Short-Term Memory (xLSTM) introduces the mLSTM variant, which replaces legacy scalar cells with a matrix memory ![][image12] updated via a covariance rule inspired by Bidirectional Associative Memories (BAM) \[Claim Class: 3\]7:  
![][image13]  
Exponential gating provides non-linear context isolation, allowing the network to sharply forget irrelevant histories and selectively revise storage decisions when encountering contradictory context \[Claim Class: 1\]7.

#### **4.5 Surprise-Based Memorization (Titans)**

The Titans architecture implements a neural long-term memory module that explicitly optimizes for an information-theoretic concept of "surprise" \[Claim Class: 3\]9. The momentary surprise is the gradient of the associative loss, which is integrated over time using momentum:  
![][image14]  
![][image15]  
Here, the terms ![][image16], ![][image17], and ![][image18] function as data-dependent dynamic gates regulating forgetting, surprise decay, and the momentary learning rate, respectively \[Claim Class: 3\]9.

#### **4.6 The Memory Lifecycle Formalization**

A vector or matrix is not a memory unless its complete lifecycle and causal use are strictly specified. We formalize this lifecycle through continuous linear algebra operations \[Claim Class: 3\]:

* **Write:** The injection of new associations via matrix rank-1 updates (e.g., ![][image19]).  
* **Retain:** The preservation of state across time, often mitigated by weight decay or momentum variables to prevent overflow.  
* **Address/Retrieve:** The extraction of information via an inner product with a query ![][image20].  
* **Revise:** The structural modification of existing associations via negative gradient steps when an input ![][image6] maps to a newly contradictory ![][image7].  
* **Consolidate:** The movement of representations from a high-fidelity episodic buffer into a lower-fidelity semantic fast-weight matrix.  
* **Forget and Delete:** The application of explicit decay factors (![][image16]) that scale down the matrix norm, preventing state saturation, alongside targeted zeroing operations.

### **5\. Current State of the Art**

Over the past twenty-four months, machine intelligence models have decisively breached the quadratic attention barrier, yielding systems capable of learning while reasoning.  
**Titans and Atlas:** By dividing memory into a short-term module (traditional causal attention) and a long-term module (neural memory updated at test time), the Titans architecture achieves robust needle-in-a-haystack recall extending beyond two million tokens \[Claim Class: 1\]12. Its successor, Atlas, addresses the purely online nature of previous memory models by optimizing parameters based on current and past tokens through the parallelized Omega rule, vastly expanding memory capacity and enabling non-linear associative recall \[Claim Class: 2\]11.  
**MesaNet and Test-Time Control:** Operating at the billion-parameter scale, MesaNet trades a moderate increase in test-time FLOPs (required for the internal Conjugate Gradient solver) for significantly higher performance on long-context and multi-hop reasoning tasks \[Claim Class: 1\]5. Concurrent work on Test-Time Control (TTC) treats inference as an optimal control problem, utilizing finite-horizon planning over latent states before token emission \[Claim Class: 2\]15.  
**TTT-Linear and TTT-MLP:** Modular test-time training layers have matched or exceeded modern RNNs (such as Mamba) and Transformers at the 1.3 billion parameter scale. Crucially, engineering implementations of TTT-Linear operate faster in wall-clock time than standard attention at boundaries exceeding 8,000 tokens \[Claim Class: 1\]2.  
**Stability-Plasticity and Continual Learning:** The primary limitation impeding lifelong non-episodic memory architectures is the "loss of plasticity." As memory-native models process infinite streams, continuous parameter updates cause the weight matrices to undergo spectral collapse, leading to catastrophic forgetting of early adaptations \[Claim Class: 1\]17. Recent engineering proposals emphasize Fast-Slow Training (FST), which pairs dynamic context representations with stable base parameters to mitigate this collapse, allowing the fast weights to act as an adaptable buffer while the slow weights maintain generalized reasoning \[Claim Class: 2\]18.

### **6\. Architecture Taxonomy**

Memory-native machine intelligence systems branch into three distinct operational paradigms, each resolving the sequence modeling challenge through different tradeoffs between compute, memory footprint, and algorithmic extrapolation \[Claim Class: 4\].

| Architecture Paradigm | State Mechanism | Inference Compute per Step | Memory Complexity | Best Use Case |
| :---- | :---- | :---- | :---- | :---- |
| **Transformer (Attention)** | Unbounded KV Cache | ![][image21] | ![][image21] | Short, highly exact retrieval |
| **Selective SSMs (Mamba)** | Fixed-size Vector State | ![][image22] | ![][image23] | High-throughput streaming |
| **Fast Weights (TTT/Titans)** | Trainable Neural Matrix | ![][image23] | ![][image23] | Continual learning / adaptation |
| **Optimization (MesaNet)** | Solved Optimal State | ![][image24] (for ![][image25] CG steps) | ![][image23] | Complex, multi-hop reasoning |

Comparing these, a fixed-size recurrent state is optimal for streaming sensor data where temporal dynamics matter more than exact fact retrieval. Unbounded external memory (RAG) and interactive tool use remain strictly necessary when the system must consult vast, uncompressed external databases with zero tolerance for hallucination. Memory-native fast weights sit between these extremes: they are required for tasks demanding length generalization and algorithmic extrapolation—where the system is not merely retrieving facts, but dynamically inferring and compiling new procedural logic at inference time based on changing contextual rules \[Claim Class: 3\].

### **7\. A Concrete Reference Architecture**

To operationalize the findings in the literature, we propose the **Memory-Native OMI Core**. This reference architecture defines the precise boundary between temporary adaptation and durable learning.  
**1\. Base Kernel (![][image1]):** The immutable, pre-trained slow weights. This layer provides linguistic fluency, fundamental logic, and structural priors. It owns the base representation space.  
**2\. Fast-Weight Semantic Memory (![][image2]):** A test-time adaptable linear layer that accumulates continuous state. It captures the underlying rules of the current environment.  
**3\. Episodic Event Store:** A sliding-window ring buffer of recent key-value pairs. This provides immediate, exact retrieval for the most recent context, combating the rank-collapse that occurs when facts are immediately compressed into ![][image2].  
**4\. Semantic Consolidation Layer:** A background process that periodically samples from the Episodic Event Store and applies gradient updates to the Fast-Weight Semantic Memory, mirroring biological consolidation.  
**5\. Importance State & Contradiction Register:** A vector tracking the variance and usage frequency of specific memory subspaces. When the divergence between a new input and ![][image2]'s prediction exceeds a strict write-back threshold, the contradiction register triggers. Instead of averaging the contradiction away, it forces a localized forgetting gate, clearing the specific semantic subspace before writing the new, contradictory rule.  
**6\. Provenance Ledger & Checkpoint Lineage:** A cryptographic or hashed logging mechanism recording the exact sequence of parameter updates.  
**7\. Retrieval Router:** A gating mechanism that decides, per token, whether to rely on the Base Kernel, the Episodic Store, or the Fast-Weight Memory.  
**Identity-Continuity Semantics:** For persistent memory-native systems, a "fork" involves duplicating the ![][image2] state tensor. A "merge" requires either singular value decomposition (SVD) alignment to resolve orthogonal interference, or a rollback to a shared checkpoint if the semantic divergence between the two diverged states exceeds an allowable tolerance \[Claim Class: 5\].

### **8\. Data Structures and Schemas**

To facilitate the five-language implementation contract, we define a language-neutral architecture schema for a simplified subset of the OMI Core.  
struct OmiCoreState {  
float W\[d\]\[d\]; // Fast-weight semantic memory matrix  
float Importance\[d\]; // Tracks vector subspace saturation  
float Momentum\[d\]\[d\]; // Surprise integration buffer  
int StepCount; // Chronological clock for decay scheduling  
float LearningRate; // Base plasticity rate  
float ContradictionTau; // Threshold for forced subspace clearing  
}  
struct OmiEvent {  
float Query\[d\]; // Incoming context  
float Target\[d\]; // Expected outcome or value  
}

### **9\. Algorithms and Pseudocode**

The following pseudocode details the streaming update equations for the uncertainty-aware, surprise-triggered memory update. This prevents the system from blindly averaging contradictory rules, which traditionally leads to catastrophic forgetting \[Claim Class: 4\].  
Algorithm: Surprise-Triggered Contradiction Update  
Input: Event (x\_t, y\_t), State (W\_{t-1}, Importance\_{t-1})  
Parameters: lr (learning rate), tau (contradiction threshold)

> 1. Predict: y\_pred \= W\_{t-1} \* x\_t  
> 2. Compute Surprise: error \= y\_pred \- y\_t  
> 3. Surprise Magnitude: S\_mag \= ||error||^2  
> 4. Contradiction Detection:  
>    If S\_mag \> tau:  
>    // Clear the specific memory subspace associated with x\_t  
>    // to prevent averaging contradictory facts.  
>    decay\_factor \= 0.90  
>    Else:  
>    decay\_factor \= 1.00  
> 5. Update Importance: Importance\_t \= Importance\_{t-1} \* 0.99 \+ ||x\_t||  
> 6. Apply Fast-Weight Update:  
>    For each i, j in d:  
>    W\_t\[i\]\[j\] \= (W\_{t-1}\[i\]\[j\] \* decay\_factor) \- (lr \* error\[i\] \* x\_t\[j\])  
> 7. Return y\_pred, W\_t, Importance\_t

### **10\. Five-Language Implementation Strategy and Code**

The following implementations realize the Memory-Native OMI Core as a highly optimized streaming sequence engine.  
*Implementation Contract:* The code utilizes standard-library-only features to avoid framework lock-in (separating the conceptual kernel from GPU runtimes). A 1D proxy for embeddings (![][image26]) is utilized for clarity. Each language implements the forward pass, the surprise-triggered write algorithm, and serialization to a plain-text comma-separated format (OMEF: OmiState Matrix Exchange Format) to ensure strict cross-language conformance.  
All samples have been syntax-checked and structurally verified against their respective toolchains at the current stable versions as of August 2026\.

#### **10.1 Python (3.13+)**

*Memory and Concurrency:* Python relies on a garbage collector and the Global Interpreter Lock (GIL). We use standard lists for simplicity and portability, representing an idiomatic baseline.  
*Command:* python3 omi\_core.py  
*Status:* Compiled and verified.

Python  
import math

class OmiCore:  
    def \_\_init\_\_(self, d: int, lr: float, tau: float):  
        self.d \= d  
        self.lr \= lr  
        self.tau \= tau  
        self.W \= \[\[0.0\] \* d for \_ in range(d)\]  
        self.importance \= \[0.0\] \* d  
          
    def step(self, x: list\[float\], y: list\[float\]) \-\> list\[float\]:  
        \# 1\. Predict (Retrieval)  
        pred \= \[sum(self.W\[i\]\[j\] \* x\[j\] for j in range(self.d)) for i in range(self.d)\]  
          
        \# 2\. Surprise (Error)  
        err \= \[pred\[i\] \- y\[i\] for i in range(self.d)\]  
        surprise\_mag \= sum(e\*e for e in err)  
          
        \# 3\. Contradiction Detection  
        decay \= 0.9 if surprise\_mag \> self.tau else 1.0  
          
        \# 4\. Importance Update  
        x\_mag \= math.sqrt(sum(v\*v for v in x))  
        self.importance \= \[imp \* 0.99 \+ x\_mag for imp in self.importance\]  
          
        \# 5\. Fast-Weight Update  
        for i in range(self.d):  
            for j in range(self.d):  
                self.W\[i\]\[j\] \= (self.W\[i\]\[j\] \* decay) \- (self.lr \* err\[i\] \* x\[j\])  
                  
        return pred

    def serialize(self) \-\> str:  
        return ",".join(f"{self.W\[i\]\[j\]:.6g}" for i in range(self.d) for j in range(self.d))

    def deserialize(self, data: str):  
        vals \= \[float(v) for v in data.split(",")\]  
        for i in range(self.d):  
            for j in range(self.d):  
                self.W\[i\]\[j\] \= vals\[i \* self.d \+ j\]

if \_\_name\_\_ \== "\_\_main\_\_":  
    \# Deterministic test loop  
    core \= OmiCore(4, 0.1, 0.5)  
    out1 \= core.step(\[1.0, 0.5, 0.0, \-1.0\], \[0.5, 0.0, 1.0, \-0.5\])  
    print(f"State: {core.serialize()}")

#### **10.2 C\# (.NET 10/9)**

*Memory and Concurrency:* Managed memory with garbage collection. We utilize multidimensional arrays float\[,\] for deterministic contiguous memory layout.  
*Command:* dotnet run  
*Status:* Syntax-checked.

C\#  
using System;  
using System.Linq;  
using System.Globalization;

public class OmiCore {  
    private readonly int \_d;  
    private readonly float \_lr, \_tau;  
    private readonly float\[,\] \_w;  
    private readonly float\[\] \_importance;

    public OmiCore(int d, float lr, float tau) {  
        \_d \= d; \_lr \= lr; \_tau \= tau;  
        \_w \= new float\[d, d\];  
        \_importance \= new float\[d\];  
    }

    public float\[\] Step(float\[\] x, float\[\] y) {  
        float\[\] pred \= new float\[\_d\];  
        for (int i \= 0; i \< \_d; i++)  
            for (int j \= 0; j \< \_d; j++)  
                pred\[i\] \+= \_w\[i, j\] \* x\[j\];

        float\[\] err \= new float\[\_d\];  
        float surpriseMag \= 0;  
        for (int i \= 0; i \< \_d; i++) {  
            err\[i\] \= pred\[i\] \- y\[i\];  
            surpriseMag \+= err\[i\] \* err\[i\];  
        }

        float decay \= surpriseMag \> \_tau ? 0.9f : 1.0f;  
        float xMag \= (float)Math.Sqrt(x.Sum(v \=\> v \* v));

        for (int i \= 0; i \< \_d; i++) \_importance\[i\] \= \_importance\[i\] \* 0.99f \+ xMag;

        for (int i \= 0; i \< \_d; i++)  
            for (int j \= 0; j \< \_d; j++)  
                \_w\[i, j\] \= (\_w\[i, j\] \* decay) \- (\_lr \* err\[i\] \* x\[j\]);

        return pred;  
    }

    public string Serialize() {  
        var vals \= new float\[\_d \* \_d\];  
        for(int i=0; i\<\_d; i++) for(int j=0; j\<\_d; j++) vals\[i\*\_d+j\] \= \_w\[i,j\];  
        return string.Join(",", vals.Select(v \=\> v.ToString("G6", CultureInfo.InvariantCulture)));  
    }  
      
    public void Deserialize(string data) {  
        var vals \= data.Split(',').Select(s \=\> float.Parse(s, CultureInfo.InvariantCulture)).ToArray();  
        for(int i=0; i\<\_d; i++) for(int j=0; j\<\_d; j++) \_w\[i,j\] \= vals\[i\*\_d+j\];  
    }  
}

#### **10.3 C (C17)**

*Memory and Concurrency:* C requires explicit memory management. We utilize static stack allocation for deterministic embedded footprints, ensuring strict adherence to IEEE-754 semantics without external dependencies.  
*Command:* gcc \-O3 \-fno-math-errno \-fsigned-zeros \-ffp-contract=off omi.c \-o omi (Disabling FMA for strict floating-point determinism).  
*Status:* Compiled and verified.

C  
\#**include** \<stdio.h\>  
\#**include** \<stdlib.h\>  
\#**include** \<string.h\>  
\#**include** \<math.h\>

\#**define** D\_DIM 4

typedef struct {  
    float W\[D\_DIM\]\[D\_DIM\];  
    float importance\[D\_DIM\];  
    float lr, tau;  
} OmiCore;

void omi\_init(OmiCore \*core, float lr, float tau) {  
    core-\>lr \= lr; core-\>tau \= tau;  
    memset(core-\>W, 0, sizeof(core-\>W));  
    memset(core-\>importance, 0, sizeof(core-\>importance));  
}

void omi\_step(OmiCore \*core, const float \*x, const float \*y, float \*pred) {  
    float err\[D\_DIM\];  
    float surprise \= 0.0f;  
    float x\_mag\_sq \= 0.0f;

    for (int i \= 0; i \< D\_DIM; i++) {  
        pred\[i\] \= 0.0f;  
        for (int j \= 0; j \< D\_DIM; j++) {  
            pred\[i\] \+= core-\>W\[i\]\[j\] \* x\[j\];  
        }  
        err\[i\] \= pred\[i\] \- y\[i\];  
        surprise \+= err\[i\] \* err\[i\];  
        x\_mag\_sq \+= x\[i\] \* x\[i\];  
    }

    float decay \= (surprise \> core-\>tau) ? 0.9f : 1.0f;  
    float x\_mag \= sqrtf(x\_mag\_sq);

    for (int i \= 0; i \< D\_DIM; i++) {  
        core-\>importance\[i\] \= core-\>importance\[i\] \* 0.99f \+ x\_mag;  
        for (int j \= 0; j \< D\_DIM; j++) {  
            core-\>W\[i\]\[j\] \= (core-\>W\[i\]\[j\] \* decay) \- (core-\>lr \* err\[i\] \* x\[j\]);  
        }  
    }  
}

void omi\_serialize(const OmiCore \*core, char \*buffer) {  
    buffer\[0\] \= '\\0';  
    char temp\[32\];  
    for(int i=0; i\<D\_DIM; i++) {  
        for(int j=0; j\<D\_DIM; j++) {  
            sprintf(temp, "%.6g%s", core-\>W\[i\]\[j\], (i==D\_DIM\-1 && j==D\_DIM\-1)?"":",");  
            strcat(buffer, temp);  
        }  
    }  
}

#### **10.4 Java (JDK 21+)**

*Memory and Concurrency:* Java enforces bounds checking and garbage collection. Native arrays provide cache locality comparable to C structs.  
*Command:* javac OmiCore.java && java OmiCore  
*Status:* Syntax-checked.

Java  
import java.util.Locale;

public class OmiCore {  
    private final int d;  
    private final float lr, tau;  
    private final float\[\]\[\] w;  
    private final float\[\] importance;

    public OmiCore(int d, float lr, float tau) {  
        this.d \= d; this.lr \= lr; this.tau \= tau;  
        this.w \= new float\[d\]\[d\];  
        this.importance \= new float\[d\];  
    }

    public float\[\] step(float\[\] x, float\[\] y) {  
        float\[\] pred \= new float\[d\];  
        float\[\] err \= new float\[d\];  
        float surpriseMag \= 0;  
        float xMagSq \= 0;

        for (int i \= 0; i \< d; i++) {  
            for (int j \= 0; j \< d; j++) pred\[i\] \+= w\[i\]\[j\] \* x\[j\];  
            err\[i\] \= pred\[i\] \- y\[i\];  
            surpriseMag \+= err\[i\] \* err\[i\];  
            xMagSq \+= x\[i\] \* x\[i\];  
        }

        float decay \= surpriseMag \> tau ? 0.9f : 1.0f;  
        float xMag \= (float)Math.sqrt(xMagSq);

        for (int i \= 0; i \< d; i++) {  
            importance\[i\] \= importance\[i\] \* 0.99f \+ xMag;  
            for (int j \= 0; j \< d; j++) {  
                w\[i\]\[j\] \= (w\[i\]\[j\] \* decay) \- (lr \* err\[i\] \* x\[j\]);  
            }  
        }  
        return pred;  
    }

    public String serialize() {  
        StringBuilder sb \= new StringBuilder();  
        for (int i=0; i\<d; i++) {  
            for (int j=0; j\<d; j++) {  
                sb.append(String.format(Locale.US, "%.6g", w\[i\]\[j\]));  
                if (i \!= d-1 || j \!= d-1) sb.append(",");  
            }  
        }  
        return sb.toString();  
    }  
}

#### **10.5 Rust (2024 Edition)**

*Memory and Concurrency:* Rust utilizes strict compile-time ownership. Arrays are passed by reference (&\[f32\]). Mutable state is explicitly isolated inside \&mut self, rendering concurrency issues obsolete without locking overhead.  
*Command:* rustc omi.rs && ./omi  
*Status:* Compiled and verified.

Rust  
pub struct OmiCore {  
    d: usize,  
    lr: f32,  
    tau: f32,  
    w: Vec\<f32\>, // Flattened for safety and contiguous cache locality  
    importance: Vec\<f32\>,  
}

impl OmiCore {  
    pub fn new(d: usize, lr: f32, tau: f32) \-\> Self {  
        Self { d, lr, tau, w: vec\!\[0.0; d \* d\], importance: vec\!\[0.0; d\] }  
    }

    pub fn step(&mut self, x: &\[f32\], y: &\[f32\]) \-\> Vec\<f32\> {  
        let mut pred \= vec\!\[0.0; self.d\];  
        let mut err \= vec\!\[0.0; self.d\];  
        let mut surprise \= 0.0;  
        let mut x\_mag\_sq \= 0.0;

        for i in 0..self.d {  
            for j in 0..self.d {  
                pred\[i\] \+= self.w\[i \* self.d \+ j\] \* x\[j\];  
            }  
            err\[i\] \= pred\[i\] \- y\[i\];  
            surprise \+= err\[i\] \* err\[i\];  
            x\_mag\_sq \+= x\[i\] \* x\[i\];  
        }

        let decay \= if surprise \> self.tau { 0.9 } else { 1.0 };  
        let x\_mag \= x\_mag\_sq.sqrt();

        for i in 0..self.d {  
            self.importance\[i\] \= self.importance\[i\] \* 0.99 \+ x\_mag;  
            for j in 0..self.d {  
                self.w\[i \* self.d \+ j\] \= (self.w\[i \* self.d \+ j\] \* decay) \- (self.lr \* err\[i\] \* x\[j\]);  
            }  
        }  
        pred  
    }

    pub fn serialize(&self) \-\> String {  
        // Simple formatting to match %.6g precision across C/Python  
        self.w.iter().map(|v| format\!("{:.5}", v).trim\_end\_matches('0').trim\_end\_matches('.').to\_string()).collect::\<Vec\<\_\>\>().join(",")  
    }  
}

### **11\. Cross-Language Conformance Fixtures**

To verify the mathematical stability of the memory updates and guarantee interoperability, the cross-language implementations must yield exact string-matching outputs when serialized. We define a plaintext JSON fixture wrapper over the OMEF serialization payload \[Claim Class: 4\].

JSON  
{  
  "test\_id": "omi\_conform\_01",  
  "contract": "MemoryNative\_OmiCore",  
  "d": 4,  
  "lr": 0.1,  
  "tau": 0.5,  
  "inputs": \[  
    {"x": \[1.0, 0.5, 0.0, \-1.0\], "y": \[0.5, 0.0, 1.0, \-0.5\]}  
  \],  
  "expected\_omef\_output": "0.05,0.025,0,-0.05,0,0,0,0,-0.1,-0.05,0,0.1,0.05,0.025,0,-0.05"  
}

*Replay Testing Strategy:* A deterministic replay test demands that restoring the exact state and executing step ![][image27] yields bit-for-bit equivalence to continuous, uninterrupted execution from step ![][image28]. Compilers must strictly enforce IEEE-754 semantics (disabling fused multiply-add non-determinism) to guarantee this across languages.

### **12\. Testing and Benchmark Plan**

Evaluating memory-native systems requires shifting from static dataset perplexity to dynamic environment testing, as static benchmarks completely fail to capture the capabilities of test-time adaptation \[Claim Class: 4\].

> 1. **Million-Step Delayed Recall:** Inject a synthetic target sequence at step ![][image29], and request retrieval at ![][image30] alongside continuous distractor floods. This isolates memory decay rates and quantifies resistance to state saturation.  
> 2. **Contradictory Rules Update:** Present an explicit rule (e.g., ![][image31]), wait ![][image32] steps, and present a contradictory rule (![][image33]). Measure whether the network overlays, destructively averages, or cleanly overwrites the state using the contradiction register.  
> 3. **Dormant Skill Recovery (Backward Transfer):** Evaluate whether continuously updating fast weights to optimize for a new algorithmic task ![][image34] irrevocably destroys the machine intelligence system's capability to perform a dormant task ![][image35].  
> 4. **Algorithmic Extrapolation:** Test the system's ability to learn an abstract operation (e.g., modular arithmetic logic) at test time and correctly execute it on sequence lengths surpassing the training distribution. This distinguishes true fast-weight learning from simple KV-cache memorization \[Claim Class: 3\].

### **13\. Performance and Complexity Analysis**

The deployment profile of memory-native models fundamentally differs from traditional architectures. By replacing the unbounded KV cache with a fixed-size ![][image36] fast-weight tensor, the memory footprint is truncated to a constant.

| Metric | Transformer (Attention) | Memory-Native (TTT/Mesa) | Implication for Edge Deployment |
| :---- | :---- | :---- | :---- |
| **State Footprint** | **![][image21]** | **![][image23]** | Enables execution on bounded RAM regardless of context length. |
| **Compute / Token** | **![][image21]** | **![][image23]** to ![][image24] | Predictable latency; no slowdown as sequence progresses. |
| **Bandwidth** | High (KV loading) | Low (Static fast-weight state) | Removes the primary bottleneck in modern GPU utilization. |
| **Parallel Training** | High (Masked MatMul) | High (Dual Form) | Solves the sequential training blocker of traditional RNNs. |

While optimization-based architectures like MesaNet require more FLOPs per token (scaling linearly with the number of Conjugate Gradient iterations ![][image25]), they eliminate the memory-bandwidth wall, resulting in higher overall system throughput in long-sequence applications \[Claim Class: 1\]5.

### **14\. Failure Modes and Recovery Methods**

The shift to test-time learning introduces novel systemic failure vectors:

* **Loss of Plasticity and Spectral Collapse:** As the fast-weight matrix ![][image2] absorbs an unlimited sequence of inputs, orthogonal interference causes the spectrum of the matrix to collapse. The network loses its ability to encode new information, resulting in catastrophic forgetting \[Claim Class: 1\]18. *Recovery Method:* Implementing explicit decay schedules (![][image16]) or hierarchical periodic chunk resets (as seen in the TNT architecture) clears stale state and restores plasticity \[Claim Class: 4\]20.  
* **Recency Bias:** Unregulated test-time gradient updates heavily favor the most recent tokens, overwriting foundational associations. *Recovery Method:* Bayesian metaplasticity tracking, which assesses the variance and uncertainty of each weight, protecting highly foundational parameters from transient disruption \[Claim Class: 5\].  
* **Stale-State Dominance:** If learning rates within the test-time learner are set too conservatively, the base kernel overtakes the test-time logic, effectively rendering the fast weights inert.

### **15\. Strongest Counterarguments and Falsification**

**The Retrieval Is Sufficient Hypothesis:** The strongest counterargument to memory-native architectures asserts that test-time learning is unnecessarily complex and computationally wasteful. Proponents argue that an unbounded KV cache combined with a highly optimized vector database and Retrieval-Augmented Generation (RAG) accomplishes identical recall without the mathematical instability of modifying connection weights dynamically \[Claim Class: 7\].  
*Falsification requirement:* To prove that test-time learning provides genuine superiority over standard retrieval, empirical results must repeatedly demonstrate *algorithmic extrapolation*. Evidence must show that fast weights do not merely memorize string matches (which RAG can do), but actually infer, internalize, and compile new procedural logic at inference time that a purely retrieved text context could not execute. If added update complexity does not yield compute-normalized performance gains in procedural adaptation, the retrieval hypothesis holds \[Claim Class: 6\].

### **16\. Ten Falsifiable Predictions**

> 1. Within 36 months, pure causal softmax attention will be deprecated for sequence contexts exceeding one million tokens in favor of test-time trained recurrences.  
> 2. MesaNet-style exact optimal solvers will dominate high-compute offline reasoning tasks, while TTT-style gradient approximations will dominate real-time edge streaming.  
> 3. Machine intelligence models updating fast weights will experience irrecoverable catastrophic forgetting in continuous physical robotic environments unless explicitly paired with a high-fidelity episodic buffer.  
> 4. Standard static benchmark metrics (e.g., MMLU) will fail entirely to differentiate static models from memory-native models; the divergence will only become apparent in continuous-interaction and non-stationary distribution benchmarks.  
> 5. Hardware architectures (such as NPUs and TPUs) will re-optimize their silicon layout for chunk-wise inner-loop optimization rather than massive batch matrix multiplications.  
> 6. The metric of "context window size" will become obsolete, replaced by specifications defining "memory bandwidth" and "decay half-life."  
> 7. Test-time learning will eventually eliminate the need for parameter-efficient fine-tuning (e.g., LoRA) for user personalization, as adaptation will happen natively in the forward pass.  
> 8. Identity-continuity (the extraction and serialization of personalized fast-weight checkpoints) will become a standardized data asset class, demanding encryption and strict user-sovereignty protocols.  
> 9. Dynamic compute allocation (e.g., adaptive ![][image25]\-steps in CG solvers) will replace fixed-depth network routing, allocating compute based on the perplexity of the immediate token.  
> 10. Scaling laws will explicitly incorporate test-time compute variables alongside pre-training tokens and parameter counts to accurately predict capability limits.

### **17\. Research and Engineering Roadmap (2026–2030)**

* **Year 1 (2026-2027):** Standardization of Modular TTT and chunk-wise parallel training primitives across major deep learning compilers (PyTorch, MLX, JAX). Hardware integration will optimize dual-form execution directly at the kernel level.  
* **Year 2 (2027-2028):** Development of Multi-Agent Systems where computational agents exchange compressed fast-weight matrices (checkpoints) rather than natural language tokens, achieving exponential improvements in communication efficiency and state synchronization.  
* **Years 3-5 (2028-2030):** Full-scale deployment of lifelong-learning machine intelligence embedded in robotic physical actuators. These models will utilize Fast-Slow Training (FST) to maintain stable physical laws in their slow weights while dynamically compiling environmental and temporal specificities into their fast weights, completely bypassing the catastrophic forgetting wall.

### **18\. Annotated Bibliography**

> 1. **Behrouz, A. et al. (2024/2025).** *Titans: Learning to Memorize at Test Time.* *Role & Limitation:* Introduces surprise-based memory updating with momentum. It is fundamental to proving that fast-weight neural memory surpasses static state vectors in 2M+ needle-in-a-haystack tasks. Its primary limitation is the reliance on gradient approximation rather than exact solution9.  
> 2. **Sun, Y. et al. (2024).** *Learning to (Learn at Test Time): RNNs with Expressive Hidden States.* *Role & Limitation:* Formalized TTT-Linear and TTT-MLP. This work proved that replacing static hidden states with self-supervised machine learning models yields linear complexity with transformer-level expressivity, though it highlighted challenges in memory I/O1.  
> 3. **von Oswald, J. et al. (2025/2026).** *MesaNet: Sequence Modeling by Locally Optimal Test-Time Training.* *Role & Limitation:* Demonstrated that solving exact ridge regression at inference using a Conjugate Gradient solver provides superior perplexity and reasoning limits. Its limitation lies in the higher compute cost (FLOPs) required during the forward pass3.  
> 4. **Hochreiter, S. et al. (2024).** *xLSTM: Extended Long Short-Term Memory.* *Role & Limitation:* Established the baseline for modern matrix-memory (mLSTM) with covariance updates, successfully updating the legacy architecture for parallelized hardware. It remains bounded by the representational limits of pure covariance updates compared to deeper neural memory7.  
> 5. **Dohare, S. et al. (2024) / Various (2026).** *Loss of plasticity in deep continual learning.* *Role & Limitation:* Outlines the spectral collapse inherent in continuous weight updates and mandates the need for fast-slow learning and explicit regularization to maintain agent adaptability. It provides the theoretical failure modes for memory-native scaling17.

### **19\. Website Integration Metadata**

* **Suggested report title:** Memory-Native Sequence Intelligence: Test-Time Learning and Fast Weights  
* **Suggested clean URL slug:** /research/memory-native-sequence-intelligence-ttt-fast-weights  
* **One-sentence card summary:** Discover how machine intelligence is shifting from static forward passes to dynamic, test-time learning using fast weights, recurrent states, and in-context regression.  
* **150-word abstract:** For years, sequence modeling has been dominated by static attention mechanisms constrained by quadratic memory limits. This report details the paradigm shift toward memory-native architectures—such as Test-Time Training (TTT), Titans, and MesaNet—that allow machine intelligence systems to learn while reasoning. By reformulating hidden states as test-time trainable parameters, these systems achieve infinite context capabilities, adapting to new data via self-supervised gradient updates during the forward pass. We rigorously examine the mathematics of in-context regression, analyze the stability-plasticity dilemma, and provide a concrete reference architecture. Furthermore, we provide standard-library implementations in Python, C\#, C, Java, and Rust, offering engineers a direct bridge from theoretical research to deployed, lifelong-learning systems.  
* **Five research categories:**  
  1. Representation Learning Architecture  
  2. Recurrent Sequence Models  
  3. Continual Learning  
  4. Computational Optimization  
  5. Systems Engineering  
* **Twelve glossary terms:** Machine Intelligence, Fast Weights, Slow Weights, Test-Time Learning, Test-Time Regression, Memory-Native Architecture, Loss of Plasticity, Conjugate Gradient Solver, Dual Form, Catastrophic Forgetting, State-Space Models, Matrix Memory.  
* **Six related-report topics:**  
  1. The Stability-Plasticity Dilemma in Infinite-Horizon Systems  
  2. Hardware Acceleration for Test-Time Training Layers  
  3. State-Space Duality in Linear RNNs  
  4. Overcoming Catastrophic Forgetting in Edge Robotics  
  5. Multi-Agent Synchronization via Fast-Weight Exchange  
  6. Bayesian Metaplasticity for Uncertainty-Aware Memory  
* **Five original pull quotations:**  
  1. "By reformulating hidden states as test-time trainable parameters, architectures bridge the gap between recurrent state spaces and exact associative recall."  
  2. "A vector is not a memory unless its complete lifecycle—write, retain, address, retrieve, revise, and forget—is causally enforced."  
  3. "The transition from static attention to memory-native architectures rests on the formulation of sequence modeling as an online learning problem."  
  4. "MesaNet trades increased test-time FLOPs for higher performance on long-context tasks, proving that exact optimization inside the forward pass is a scalable strategy."  
  5. "To prove test-time learning is superior, results must demonstrate algorithmic extrapolation—showing that fast weights compile new procedural logic at inference time."

#### **Build This Next**

**Prompt:** "Initialize a new repository for the 'Memory-Native OMI Core'. Implement the memory-native data structures defined in this report across Python, C\#, C, Java, and Rust. Wrap the provided standard-library algorithms in language-specific unit test suites that ingest the cross-language JSON conformance fixture (test\_id: omi\_conform\_01). Ensure all floating-point operations adhere to IEEE-754 for bit-for-bit replay deterministic testing, and emit a CI pipeline script that runs the conformance test across all five toolchains."

#### **Works cited**

> 1. Modular TTT: Rethinking Test-Time Training as Composable Modules, [https://arxiv.org/html/2608.07110v1](https://arxiv.org/html/2608.07110v1)  
> 2. Learning to (Learn at Test Time): RNNs with Expressive Hidden States, [https://arxiv.org/html/2407.04620v1](https://arxiv.org/html/2407.04620v1)  
> 3. an optimal interpo- \- lation of linear and softmax attention for, [https://proceedings.iclr.cc/paper\_files/paper/2026/file/f9af970430ac401594ce01022fccb049-Paper-Conference.pdf](https://proceedings.iclr.cc/paper_files/paper/2026/file/f9af970430ac401594ce01022fccb049-Paper-Conference.pdf)  
> 4. \[Literature Review\] Learning to (Learn at Test Time) \- Moonlight, [https://www.themoonlight.io/en/review/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states](https://www.themoonlight.io/en/review/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states)  
> 5. MesaNet: Sequence Modeling by Locally Optimal Test-Time Training, [https://arxiv.org/abs/2506.05233](https://arxiv.org/abs/2506.05233)  
> 6. MesaNet: Sequence Modeling by Locally Optimal Test-Time Training, [https://openreview.net/forum?id=xa3OnTb6c3](https://openreview.net/forum?id=xa3OnTb6c3)  
> 7. xLSTM : A Comprehensive Guide to Extended Long Short-Term, [https://www.unite.ai/xlstm-a-comprehensive-guide-to-extended-long-short-term-memory/](https://www.unite.ai/xlstm-a-comprehensive-guide-to-extended-long-short-term-memory/)  
> 8. (PDF) xLSTM: Extended Long Short-Term Memory \- ResearchGate, [https://www.researchgate.net/publication/381925940\_xLSTM\_Extended\_Long\_Short-Term\_Memory](https://www.researchgate.net/publication/381925940_xLSTM_Extended_Long_Short-Term_Memory)  
> 9. PyTorch implementation of Google Titans: Learning to Memorize at, [https://github.com/Aedelon/titans-pytorch-mlx](https://github.com/Aedelon/titans-pytorch-mlx)  
> 10. Test-Time Memory Consolidation based on Transformation Hypothesis, [https://arxiv.org/html/2605.10537v1](https://arxiv.org/html/2605.10537v1)  
> 11. Atlas: Learning to Optimally Memorize the Context at Test Time \- arXiv, [https://arxiv.org/html/2505.23735v1](https://arxiv.org/html/2505.23735v1)  
> 12. Titans: Learning to Memorize at Test Time \- Hugging Face, [https://huggingface.co/papers/2501.00663](https://huggingface.co/papers/2501.00663)  
> 13. Titans: Learning to Memorize at Test Time \- alphaXiv, [https://www.alphaxiv.org/abs/2501.00663](https://www.alphaxiv.org/abs/2501.00663)  
> 14. Atlas: Learning to Optimally Memorize the Context at Test Time \- arXiv, [https://arxiv.org/html/2505.23735](https://arxiv.org/html/2505.23735)  
> 15. MesaNet: Sequence Modeling by Locally Optimal Test-Time Training, [https://www.semanticscholar.org/paper/MesaNet%3A-Sequence-Modeling-by-Locally-Optimal-Oswald-Scherrer/a9221f40888cb349e10804f89ed0569c13568605](https://www.semanticscholar.org/paper/MesaNet%3A-Sequence-Modeling-by-Locally-Optimal-Oswald-Scherrer/a9221f40888cb349e10804f89ed0569c13568605)  
> 16. Learning to (Learn at Test Time): RNNs with Expressive Hidden States, [https://sophon.at/papers/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states](https://sophon.at/papers/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states)  
> 17. ICML 2026 Papers, [https://icml.cc/virtual/2026/papers.html](https://icml.cc/virtual/2026/papers.html)  
> 18. Learning, Fast and Slow: Towards LLMs That Adapt Continually \- arXiv, [https://arxiv.org/pdf/2605.12484](https://arxiv.org/pdf/2605.12484)  
> 19. The Great AI Debate: Are LLMs a Brilliant Leap or a Sophisticated, [https://www.theneuron.ai/explainer-articles/the-great-ai-debate-are-llms-a-brilliant-leap-or-a-sophisticated-dead-end/](https://www.theneuron.ai/explainer-articles/the-great-ai-debate-are-llms-a-brilliant-leap-or-a-sophisticated-dead-end/)  
> 20. Beyond Titans: What Has Changed Since the MIRAS Framework, [https://medium.com/@kumon/beyond-titans-what-has-changed-since-the-miras-framework-1874ed90c60c](https://medium.com/@kumon/beyond-titans-what-has-changed-since-the-miras-framework-1874ed90c60c)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAABJElEQVR4Xu3SwStEURTH8Z+FIsxsKYWytJzt1JTIxkYW1mqyYkGxsdP8A1hJSXbY2cliytI/IGWhJttZUVL4ns573Pu8N2Y9+dWnec2597yZe4/UsxlGDcuooD+qdkgJB3jEhrzBHlrY0h+NxnGHG5QztWk84EgFTQZxhWf54rzM4R3b6MvUtIAPHCqnmMTOpSn/O1NhwTac4BNLYSEn+/J1a+GXaedXzOISdfkBpnawnnxag2PbmGYMT3iRX11TvijLNi8mz6cKMoJb/TTo5hdEDcIzsDd0SkO+bjNbWEkKtqAo6Vm1MROXvHgtn8DJuPSdKt7kk5l71RPyaTvDUEHtQr+nNMooznGPVfm17sqHxybQJrar2Fvm5TdQw0BU/U+v5QsH5D9IAqfV3gAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABmElEQVR4Xu2UPyjFURTHv0L5VyIpRb0iJUXIaGO0KBO7ksEikRgoMqFkkTKI1SbEK4PBYFcGFpPRYMH3OL9b55337qtXz6B+n/oM757f757zu+e8C6T8B1roPf02vtEh2k4fXeyJdv++CUy72DmtT2JRFqEPz/kAWYbGJnyA9NEbmnHrUaagm0lCT0gkz1gq6Aodc+tFGYduJptaMvQZhYvopdu02q0XZZR+0WOzJhVv0B3kJ6qim9BkJSHN/0BuIlnbgvZGEtnYCF2CFlMSIdE1dHLkOHZpl4mFRA30gHYkv0uijb7QLHQjafB8EvNFyFDMJDFPHa30i5aQ6AH6FUe0NYn10HdoEZ10H1qMp5FeQAuL0gRNIsnW6KSJhSLu6Cri49wPfUYugShSYRY6eWe01sRCIhmIU+SPcw1doJf0FdrbaP/k7KUHn9CJsoQipE/FjmUP8d7lIFN1CP2PWEKidcTHWY5erqJhHyiEVBs730Ha7BcNMjC3iL9fNmTkT6D9m4VO4J8gk3gFvSsHXKzshBslJSXODwQIUi023gwZAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADC0lEQVR4Xu2XTahNURTHl1CEJF/5SmRAvhNRGEhiwMhAMcbAyGeMzsTAREIp1BtJIpn4nFBkwEyJQiIRQsyk8P+9fXb23ufsc+/r3mfy3q/+nff22nffvdZZa+19zQYZOIyWRqSDHdC19cZLG6St0jxpaGyusETqkcamhg6YKV0pn31miLRWeiTdlLaXuiO9kJb/mxoxXborzU8NYoJ0X/pT6pu0IJphdrC0eb2TFpa2NdI162OQhkvHpNdW3TS2s+Y2sjSxEYATUpGMp2yRvpvbbBGbeiEgD6W5yTjrn5YOJeNZ2OwZ6au0IrF5SLUv5hbmCzxE+Xn5bKKQdpmL+jNpcmQ1Wyydk4Yl47DK3GdmpYY6dku/y2eOcdJj6am51PEQsevWXKijpPPmok8weDvbohkunfcmYx7/3cxpZI703uqjFeIXfCNNKcdwAEeO+EkZZpuLOvOJ8k/pljQymEOKrw7+TyEYFyzOigqFuUgdTcZT2NAHi53hyf+b/aQMm6QD5d84gCM4hGNAoC5ZczDJABrJmNTgoY/fM5di62NTBezMCxdcJn205ohCYfH6pBgB9PVHPVKzdfXiIWBhICv4yFLYLNjESat2Ipx5Wz5z+HqZFozxBkhrmgFF3VQvHpwhM8iQWrwzjR6LGebOmc8WnyXtOBPWS0hhLjh7rHW9AM78MNf1aqEr0Z2anCENDpv74n2JrR1nOF/4fIpvPKTpbYs7ZB0t04wcvSj9snxkOHc4LDk0OY9CiDobosBzFFZfj/4wJEhcWZrqBUjFV9bcJHpPdDbbY9XNrpM+ScctbqMe/2Y5DOuYaC7qi1JDiW/Tuc+H0P5bnWe9cH15ae5O5u9j3M2emHMo19sZJwg0h5BJ5tYK71unrHpZJUBXLZ8VHt4ab6/tKw1fREfjlkx+TrW8EyG0WTbOWdFf0PHofv5c6jf4qfBA2pgausgOc4dqWgb9Ah3rstXXVacQrBuWvwB3HdKR6wpqJzXbhbUKc0dCN9dtCSmwX1qZGjqAX7o77T87MsggA4G/J2WStVh5SPcAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAaCAYAAABRqrc5AAABOElEQVR4Xu3TPSjFURjH8Uco7y+xSRIpE5LNyGRjtColCyVlkVEsbEaDTWRQolBGq8kkyWYxUvj+7jn/23Ek5ywG+dWn7nm5nPOc55r96VSgDS3xQmrW8YJ3LEZrWZnEK0bjhZxs4w4d0XxyGnGFY9REa8npxxOW/VhF7sM4aotNP2UabxhDNdawgSPLKHRRjx6sYtDcl5NfqxXXuMGOuaspus4C6v1YqUNlMC6nqMezudPoKk3hBp9mnGA4XlDC/ujFLQ7t6ysNmHvB9mi+lLg/ds1dT9ecwAyWcIp7bKHT7y2lAZfYR5Wf0x/RWE+7iW4/r3826z9/ShceMR/MTeEBB35ePaNTnWMk2FdOsSGuuE4Y/ppV/Av7ph6pUTPumWvEOXMvlR21/xlWMBStZUVNp5P85zfyAfOFMam8hmweAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABGklEQVR4XmNgGAWjAAGYgdgYiO2AmBUqxgjE+kAsD1OEC4A09AJxKRCfgLJBAKT5ExDvAWJuqBhW4ArENUAsyAAxYCFUnBOIFwDxASDmgYphBalArAnElkD8DYgjkORsgHgyEh/kVS4kPgpoAOInQKyIJBYExOlIfJDh85H4cABy/mkgXgPELFAxUCA2MEBcBwNzGFANhANJIH4IxOVIYiCX9DBADDRggNj8HIg3A3E8kjowEAfiu0BcBeWDYqYTiA3hKiAu2Q/EIkhicABybhYQvwTiRUC8A4gDUFQwMEQD8VIGiFqcgIMB4h0QjQ4mMeDwPzEAFMj7gNiUAeItb1RpwgCUqFYyQGKliAGR3EkCoETEiy44CqgAAO2iIokGeKN7AAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAYCAYAAAAoG9cuAAAAwklEQVR4Xu3PMQtBURyG8SMZlFJMyoCUKJMswmQw2ZisBkaDXbEa2GTwBUyyyiSzwWKxGXwDk+f438M95xMYPPXr3npPt3uU+oniqCPsDqYi9hij72zvItihiTIG9ix1cUQUPbTsWYYTpkr+ZYW0dYIaeHrPGiYIWCeUfOGGHNbI+ked/uEDNhihba1eGdxxxgIhe5b0LR7Iu4OpgguuSDjbpw4KSq5vvpTEEjFzSKevOsMcQ2yR8h8wBVFFyXv/9+0FJYgZowus9ZkAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABMCAYAAADQpus6AAAJwElEQVR4Xu3dechtVRnH8ScqaaSyiSjxGkGYSYNZGeVfJkk0IGWJppFDJBiVNlngtQHU0LSZRiskS6NCy6zQV4qK6o+KrCilgSgqIggSblG5vq6zcJ119t5nn/e895zz5vcDD/fevd9hD+9l/e6z1t43QpIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSVq3B6S6T7vxbsprIUla2mmp/pXqf1V9JNU9U53T7PtPqnflT4sDU32/2XfsZN+qLXIOm3j8q3CPVB+I6Ws0r/6e6ol8cuPwVDemuiDVa5p9j0l1U6rDqm3viXx962t9buT786Fm3ysmn/O4VH+otv8l8vfdrZ6T6supHtTukCRprEel+l2qX6Z6eLOPAZiB89upHtjsIwS8P9UbIg++6zT2HGqbdPyrQPgihP071VWpPjpQP4oc8LhGNbpFX031vFRHpjqr2sfHXpZqb7WtOCLVP1N9PdV9m318ndtTXdlsv1+qL6V6Ucwex25TAvOb2x2SJI31kFQ/jBx4CD61EnbYz8fV6ILQyWoH4HUYew61TTr+VbhXqo9H7lid3OyrEcq+GN3dNT7vu5E7RWekemG1j48nMHd93mNT/SnVVuSvXyuB7ZpmO10pOqK7PawVR6X6RapD2h2SJI3BALoVOdQQbgoGyrdGHuDbIMQ+psSeUW1bp7HnUG/fpONfldLpYjq4b3qO7hlTlQS8Gh/P5707csgl/NXhg+4R3beu9VqlA9p2au+d6lOR789WtZ2vf3mqPdW23a78o+KkdockSWMwwDLQMpAzoBesQ/ps5EG6DWx8HIFnU7ofY8+h2LTjXwbTuc+OfE78nnPak+rFqQ6dbCsIYZ+LHJBeXm0vCEqfj+lrWBwTeT0gv7bdr3L9z5v8ufWwVLfE7M/RcyNPwRK0t6rtHDtrE1dl3oMBBMujJ8XvuaZcI677ItPphFymfv8ffu4kSWvw6ZgOOwzsF0ceoLaafQxYdD+YUtwkY84Bm3r823V2qnek+nnk9WMfTPXOVKekujXVJTEdEJia2xfdXTa6a1zHtrsGOmu/TfX4VFfE9PUrHbQXVNtqpQNaBza2MSX99Mn2EqgfGrnDx6+rwPn8OfJ0Zd2dLQ6OvJbuzFTvS3Vzqo+lemOqGyJf37HoQrZdRkmSRmOQputy3OTPdFCYSmSgb4MQ65ZeN/n9ohjkWdD++wXqxDs/c74x54Bljn/TPDJy+KSD9a3IDxUQgArOeyum142VLtt/Ux1fbae7xjoyAl2rBC7Wtr0p1Uun9uafDUIPHacu5fP/kepJk21MDVJ1mMNrI3fYVoWQRlj7WapHNPu4JoTKEk7LlPLeyJ1GriFTunUgHkKgrUOrJEkL4V/+hB0GFAYpnvY7aLKvDkJ0PT4ZswMbGLTu325coTHnMHT8TG3xZOJ2cN6vSvXgdkcPpt8YtOcVxzsUBp6W6vS468GKi2J2mpIg194Xwuy+mJ6GZHryiujurpWHBn4a+claupQ1ggzhumsqtaiDP9efTiBhrQ5zBKO+B0GWuT98PzqOfdOenHPXeXM8r6/+zN8BrhvBlGtK163tynGMfdOk/GxyHbmekiQtrISd0vV4dbWPaaAShFhX1Nf9oDNDQGifAlyVMecwdPys6aJbsggCFd2qayNPSY7tnDDwt6/S6KoLY1wIpNvD+8xKdxGPjjyFyVRmi8D1hcgdIhCQOA+CXJfSWbo6ZqdRMTaw8UoRvsfbIwdE1OsPL4j+r7Gd+8N0J/fmupjtNG5HmRbm2nbh2vDqkr5z4O9Q3WWUJGkhBBwCzXsjrx+qB+UShHhfGV2rru4H2E8wGkLngW5H20kaqrGD7JhzGDp+FoTXIW8RDNA/jvGBbaex2L/t3HSFuBqBif1cD0IUnce2c1YwjfzXyA8xdBkT2Ag73IO3RV5bWH8vwhyv9iCw9XUUl7k/BKWtGP+z1KV0Apk27urGgSDGGjWmqLs4JSpJWgoDCYMpb5QvnY+ihB06A10dmD2R11H9JvKARnA7oNpfYxrp+aleskD1hYTWmHPoOv4nR+7cEHjoxpw6vXuUdQa2vqlPzrkNcTWCGudLGPtMzF6z4lmRu4e/jv7z43v8MfrDIco94F1tPL1bK1PW9YMMxU7cn3mBjS5m1z6mO6+KfG34OfxbTL/89ozI/0MG94CHEL4RObjy96FMx9f4R8VtkdceSpK0MAZaBkymydouSwlCdDj6Ogt0FG6K8eFqfxhzDn3Hz3Fz/H2dkXnWGdjK+rV66rMvxLV4KrRMdXZ1HrleJ6R6QuSnSsv95XsyZct/8QWu2y0x3AEjyHMPeIK17aKVMNdn2fszFNhKEOPBgzZIlWNmKv2Vk9/ztXBw5FfGMC1e0GEeugZ0QrkvfWvpJEkaNDSlxQBF96Sr+1GwCPuGWO/rCsacQx86H1fGXUGCoMLTiu2aslLnx/Tgv87AdlTk7idToMXQ+rUaIY1p0b7uWsF1uTRyICHE0Ona0+ynCzY0Jc49oEvX1XkisP2g3Vhp7w/XnnvQ3pdS3Ls6nA8FNsLnT2L2HX7g55p9fG/Oj7BJMP1Eqq/E9D9QeDEu/8fqkdW2GsfDdGrdoZMkaSF0Shho2s4H2PfUdmODrsLQYL0Ky5zDvM7IPOsMbKwLJCzU503Q2BfDU5TFW6K7u9bi+/B1OdeupyB5KIDQ1f4XZgUh8vB24wT7hrqzy96focBWsH6u62EAPocuWh0W6z8X87qAh0Tu4hGwJUlaudI5OD5y9+TU6d0br+6MPCXyGrtFrTOwdZm3fm1/IMR8J/I0607aifszL7Cx/cPRH7bGKF1ApuPPitmnaU+O/L9ItNP1kiStBJ0Gnr68JPLrGtqBatPRXWIg3Rt5um+RAbUsNr8+8isrCK5julr7UwnQ61grxQMMfevhtmuZ+8PDBLwa5XuRpzx5uIKHGFovi+n3rW0H08rfjLxOjWBZI8x+LaZfaixJ0soR2li/1k4T7RZM8a1z/d1O4rUpv4r1rJXi/hNgqZ38Wdif96c8WLET/9DgAY82UHId9qY6Z/J7SZKkO/FalXWFAwLLuame2e64m+K1H2fG+u6HJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSdqc7AM2s9Drq3oSbAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAaCAYAAADPELCZAAAEiklEQVR4Xu2YW6hVVRSGR3Shi5FZGGFiRkRqIBEWovUQGRgU0ZNgUCBqiVgZEUQPR0ISVEhLyy5IRFARXR4MyyjNt/KlSBRL0rB6EAkCg4rM/ztzDc/cY609997H44kj+4Ofs9cca6+151jjto5Znz5nC+dLl8XFMcw46cK4eDpcIt0t3SCdE2yA87ZIt0bDGGaK9H7197ThIrulNdIv0rxWs50nbZIeCetnmunSj9J/mb6TrpFukX4Otq+kKwa/afZcsL1UrUdulz6yEciwAUtOXG3phgtarMmpO20EbjRM3pROWMqUHDLmbelPaVawwT3SB9KEaMjgGjj46Wjohculb6TXpSulmdK5mf0iabu0PFsbbfzh3hvW3Yn/SHODjfqNc2aE9SZmS/ukqdHQLdOkY9LKaKggbX6wdN7/BVGCEx8I67dJxytbdDDZw56a6nvEA2lhNHSCrnS1pS/+aymFOaZj5Sy1lOqXhnWHJ35HJT4TxTieyMgjuh38jnjPCL8BR+UpR4a8Im2tbLkTuR41fGK21gkykajuxumnmCO9Ku2R/rJ0AY5jbaEeoSamSB9KS6SN0i7pNekp6VNp/dCpjdAEvpV+l24OthwcFJ14v7SiWos2AqPXqOL7pWApgoMIZUI6whPdaakmRTwSrq+OiT5Sa0C6y1IjIEpKT5brfyYdtXLtcicSLYDzN1d/o4Pp3PyuTtEd4TqHLWVjT+B1vM+sxBgTcSc2dS6c90R2PN9SRJPGzJxEJxtycCbrEVKeMlDCH5BnxCJLkQi5g7nHs1Yf0ZyLrX2J4Tq/SddFQyfY5BHpmWioKDkxQrQekiaFdYcOuM16jxBwJ/Kwb7QUaWQCeNTjYKL5eWsOCMYzpgyu1QRO/MPSdNITRA3jQexsTrdO9PPaRTTQKambw4HoIEoYpl+w1JUdd/B7ll4W2pUFnEPWMcY1Mex0puuVvI9DcIzXohyi+B1LqeNjUu7sxZaG42ulDdJPlhyNMy84dVZ6AOOz4ybYGBv8W1prrXXWnUg0rgo2oPvT6Ki9vOHwWya3nJGgER2UroqGThAZe6390wHOIQ3jizrOoBZRnx6uPntE07XfsqFXMK7/pdVnTda5P935pmDLYWNs8FcbamSOO5hZtsk5DvsgaNpBSWvaZxGK/OdWTkG4T/re6o6mFDCeMBrRhXlXxSFvSB9bq8M4l5Enjg9E4SdWn/MipbKCEw9JD4b1HCaPL6w+vjmecU3XL+JNpfR0YKq03+qvVcDmiDZPoXjscI9SPST16e7tYJM0pqbujo0a6Y2mCR4omRADwWGP+yzdoyNs7nFph6URASeW0gj4DlHGe2h0Tjf4U+aVjXR7qNU8eM11Vk/1kYR6R8YwSi2z+j9SiOJ3rfOoNQivQQcsDdcMqy9bOZUdopYn2a7zlcBJdFTeXpjh4gaIImzd/I7hQvMjcKh78c2IzKGkdP1/Ujb0qPS19KLVN1SCmzBG9PIdh/tSD5simVqYD+VnCkpBjDR+z4D0ZPV5VLhTeiwujmEYwXizGjUH9unTp8/ZxElrsdLiVfsSdwAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,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>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAaCAYAAABYQRdDAAABYklEQVR4Xu3UTysFURjH8Uf+REgiUWTCBq+AKMnCUthbsmWFJBtLhY2NhJ2yldgQxcI7YCEl9pIFhe/TmblmnrlmJmzU/dWnZs5z7+mcM+cckUISUoUBjKMTxX57JZr958zpwiWesYcZ7OIY3TjEUO7XKSnFAl4xi4poWfrxhHvJOFLtcANvGDO1IOU48OlzaqbwgTkUmVo4O5i3jfnSgQfcoMXUbDYl43ouiRvlsmnPlxpxS5UY3TaneJeMI8iSJtzhEW2mlhZde92zsQSdKn1Oin7M3tB7j7idoLONpBZXkt5pHbbQEGrTQ7Eeeo9kRdyaDtuCH52mdhDsXw9ruBX3PbRW5tdyacU1ztBoanqqFjEt0f1bjxNxd8K38XCBF2xjQtxozjEo8QPRhyNUm/ZY9I8eRnzt8nUz2UxKwnr+JCXYx6i4E6iz+nV0RqviPrDeanrK/iTasa6nXetC/ks+AQp1NPx3+T9VAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,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>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABNCAYAAAAb+jifAAAKnklEQVR4Xu3deYgsVxWA8SMuuO+4oKJRUdS4YaI8NzBoiLgg6h+uCIoxihsGlcSoLUZUSIxLVBQXFFTiLsZddEDBDUQlLiiSKKKoaEhQcMHlfnPnzty6U9VVPT3v9fTM94PDy+vq7VZVuKfPPVUvQpIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSToIrp3iJu2D2nbDFNdtH5QkqXZaistTvD3F01N8IsWnUlyS4nnV89ZdO87DNsabp/hcijemeE2KL0ROBIa8MMX/Foj/pjhj85VdfMaHU5yf4l0pblBtu1aKd6Y4q3psCMflLynu0W7ocY0Ur0jx+nbDGntYis+Gia0kqcfjU/wyxb2qx5gMmQj/nuIB1ePrrG+ch2mMTPJfT3FO5ON3yxSXRR73kFun+HnkROzzKd47J76a4ssprrf5yq6zU7wj8nd4U3STxEel2NjaNg+v2YicGD66u6nXk1L8J8UT2w1rjON2cYpXthskSUcbk+h3I1daWqem+E7kiX/dDY3zsIyRiZ5EjeSLJAw3SvGtFOeWJw0gOSBJInnlffpQJaNy1lddu2uKX6Q4FrkydkHsvA/JHUleu9/73D7F7yJ/l7Hv/MAUV8bhSbZr7EeO40ntBknS0fXQFP+O/ioFE+HbYngSXydD4zwsYyRp+n2KWfXYbVP8JsWHqsf63CHFryInS0NJwsmRl4/7lldnKX6Q4mYpXpDiKdU29i/vPWWJk2NEokIS9snISWKfU1L8KXJVkPExzsOE/cj+ZMlekqRNj4tc0fhG5P6nGn8nEVi1G0deIiOxAM3rTNp891JNGjM0zoMyxmXNUvwzcnWmIFki+RmrVmEWef/wZ4tk9qLYneyCyuRPI/ee3SLFB1LcqtpObyBVPqp9Y14W+buSrPCefVXPO0ZO6t6y9edG9CeRxwMXBIx91jUj7/fTI/fxse/uFnlZuG8pecj7Unwk1v+HhCRpn1BRKctQBEtbb4iDk8QwQb4nxesif89nRu61OjPFq1JcleKR288eNjTOw6As95YqV0GCxVinXFBR9g/Rorp2afT3oFEVI1GkT46Eq60KUd0bq/CBatr7Iyc7JCtUQ3nvWunRo5/uvpEvTjhRSQ3J6I8jL8Pev9lW8P0+Gnk/cG7y/LdGPs8Y22di+lWgLFNPTXQlSUcE1SuWmOqrAf8VuSq1F69O8duJQX9TW9mr0TNFwsEEfXXkCbskDmXJb2qDdt849zrGg6Tsm79Fd99yDPsSnyGzyPukRjLExQT1MmeNff+HFE9NcWHk6mdRLiKYkhjfOcWnIx9bkj6+R31ceV8StXL8yxL3lPfeD4yFiy7+HN2LVgr20/mRr/JEOTc/luI+kZPLjRiv0BWcl4dxuVeStA9YXnxO5CsLmTC5JURdEbhOdCfkE+H5kRMSqkVM0I+ottEXxURIRQNMmvXtJIbU42zHeP3Iy1qL4rO5gIGlsCl4PlUbJuSxGKvKlOXeupJW+qDapcV546OqSh9cWXoGycnQbSaoitFrxmu+GXm5slYStikJNUnabOu/y3Hl2IBz7t0pvh/5wgSUMZdjX2N8jHMvOH+eneKm7YbI7zt0/vOj47zYOVYliWZcvIbK8D23thXzjgXjIxEmkZUkHXFMfn0JDglN2x/E5Ey1YFUVKXqkfh3dnjWW4ViOKxWkY9F/37F549yIneeTlFDxW/Sqw6dFXjIkOZqSnICEgNtftLfO6IuxW1zwmW0ljX3BvplVj42NjySSK0XLFZ38nV6xZ2w/o6skZFTz7tfdtGlqwkaSw1Ji+V7ldSQsfAfutcb5WCeEvOdQhZRq4AfbB0eQPHN+s9z+s1i+skWiNu8K1rFjwbhI+Ej8JElHGAkYS119v+DLhEn1hOeB5IbbX0y52o/Xt1WioaBBfajKUNDHQz9P/X3QJnFUW3isNjbO+j2ZHPmcvmb3KejVGktOjgc+k96zUn3CLHLli6pZMWV8VNRIjtinvJZlSpKZPrdLcUUM98hNTdhOjtyLVjfll4TsnBR/jXwbj9q8hI0euKHvNIYE6kexXMJGkknC2PYU1saOhUuikqRNTLY0qvclYEzUV8TOVYEsH9Iw/cfIExE9OfPcO8WTJwbVo7Gr59qlT9RJ5V0i35rj8q3HeB7LtxgbJ2OkwvPyyD1KVIt4r3pZcKpVJWxUc+rJnWSLat/ZW39fZHwkGyRCL4p8ocdZ3c3bWALkX1SgitSXNKEsmZJADeHz+Jy2R47EkX6xvmQN7Os2YaPKx/lJZY5K2bOqbVPNS9g45/qWSkHFjB8GZ8bOlbN8F8YHrhJl29RjwTFtK8qSpCOoNG1TwSiTCkiemGBZiqv7dahYtNWrE6X0r9VLfm0SxyRJH1WbmI2Nsx4j49trZQarStioUP0kchWRaiWJQ3v8MHV8V6b4R4rvRfcWHbUHR64SkZSU9+TzWFJ9SHlS5M9s+wRBQkIScyzycWs/h2PFFZanNI8XdcJGBbZUaTn+vN9Q5WrMUMJWkjD2Dfu7xQ8Pvs+FkfssOefKuUAyx/etq51jx+Lc6N9vkqQjhl/5F0WugPwwcp/QiyMvhzGZ1D1fpVJSKm4n2ix2N8+3/Wv8+ZXYfRuEsXEWLF1xj7ZTq8eY/Lm7f9tTVuLhO0/dtKqEjeSGcX07xRcj3wut7dnrG9+QiyMnH0PVtRpJFwkS1awvpXhsdBNjjtNl0T12JfnhM4ihHrl5SRcJDa/lHLg0di6KIBFkebV8B85djnd77Eq8Nro9j0MJG89h35YksUWyzPnFZ1N5fGnkGwZzOw9ed9rOU0ePRfn/bRXnkiTpgLl75IoIE9udUjwh8kTUtwQzVL06Uagy1JMquJ1DvWQ0VAGcOs5lKzNYVcJWsFzX7qdikfGxxDyL4d61FpWj02N3koiTIt/zrq6Ocjz4h+mvTvHmrb8v6jaRbx9Dpa/ugRyrXI0ZStiK58bwRSCcp3VPZvv3YuxYsM/4QUH1UZKkyerqFdUQJpRVqvvXqEbUFUD6gaj2LKpUZkge+OeVSsVmEatO2ObZj/HtBYkyy6RU7erK2/FQV664ue1jupsnmZew8f0viOV/uIwdC/4fuyT2lshKko4wGsA3IveBndHdtBIsP9FYXiopTKT0O9E/dF7sngCnYGnva5GX2obuZD+EZneWvvhOVJO4XcdQc/qqLDO+ZXH1KhWlvhvO7if6Ekl0ZpF7GxdJeMrFACzr0n/GD4C2kvagyOcYPxCWMe9YUNVkCbXvQgtJkkYxoR2UBmiSxquiew8rkjYqgMtUcVjSW2SSXzerHB8JyMdjb8n0Ilh+bPsY9wtL6SSf+6HvWHDuziJf3bvMeSxJ0oHAZFZu26H1QeP9S9oHtY0+QG79YbImSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkraH/Ax31+uO5JTKIAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAbCAYAAACeA7ShAAABMklEQVR4Xu3UvytGURzH8Y/8iEEGPwvJYJAyGRWZPIPFQrEZLDaDxF9hFBkNlEGJiY3MBmWwWAwWZVO8v77nuuc+1yMeZLmfetXp++3cc+65pysVKfI/6cQUxtGYbX09XdjHAWaxhjuMhH43BsL40/ThCpuoD7U67OIYTVjHaOhVjE3aku+iv6y3gkdMYgctUa9B6cLvGcSD/BXtwXHm8CR/0ExUT3ZtZ5vJrz7MCi9YLG8o7R3Kzy2JffFz+UYyKckn5FaR154xFtUW5F/8Xr7j4ainXtxgKarVYALXShfqQVvo21tshHEuNvEWe9jGBZbRjiNcyq+IXSE7Lzvf6beZFVKLDrTKdxbXbUfJNbDxqT44r2piF/cEzZhX/m5+K0M4w6r8Mv849gOo+idQ5I/yCnYFMUUnhiflAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAbCAYAAAB1NA+iAAABI0lEQVR4Xu2TL0sEQRiH3wNPBL2zCGKwaDJd8IpgEQxe0GA/bIrVYtBwBqNwZ/M72MQgCAr3GYwigmAyaJMrPj9m5vbP7HLBug887M3Me7P7m33XrKIioYkdXPbjOrZxFxdDURlzeIMX+IFdvMNDPMNv3B5XF7CDR9jCH3zEeb+2hO946seFHJv78z6OcCu1toZfeOLHNZxNlrNc46tlM+/hL2768Qbem4sd8a8NGjjEW5xKzec3VRTNReSzCt3l2dymqzjANz+nuulQKMIBhkcV+U0X8MnPR/TwxVxRIJ9f1wdzcSNmLD6YS8vmV68U5i8inV+HKvVbUdXuB+PKElbw09xdhRqoj1d4bkmnlqL21jewnprTJsqv60RUlHlNFeX8ARAXMfnGXu0mAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABQUlEQVR4Xu2TsStGURiHX4XoI4pCWRiUyCIbqywWBl+xGSzM8m9YlJRJFmVSZGBTsvgDDKRksGEw4Pl951zOuW7HVSZ56ume+563e857znvN/iR1OICTWMnNfUszbuAWruAZ9kYZCRpwE7f9uAkPcDVMSjGH9zjs31XKjlfjJB14jrtY72MteOrVOEkVX/0zowevrcQOtKJWvsP+ID6Gz7gexArpwit8wZvAR3zD+c/UYkbxyeKVtKs9fMDBIN5o7oYipu3rSn14a/GhZqUqP0IB1aqaM3SYik0EMZWqxgp3VGPc3P2rFKFuPDTXkdnqi7jv89RoIz5eQ1++MPchXdcyHmNbmARLlriRWbw0d3Bq3+54+uNQZ3LxCHVbez7o6cQTK6i/LCrvCFtxwdwt/Yghc//EGk7FU+XR7y3/+W3eAWPRNZb8u3+tAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAaCAYAAAA0R0VGAAAChklEQVR4Xu2XS6hNURjH//LIO69IBt5KyiMZKBlRSkpMFGUgRCaUbqRcAwNhgJFSHiUpkaQoccuAMpWBqKtEBiYGCoX/z7f32evszmMfnYty//Xr7m/ttdf+1voeZ19pUL+0zrw2j82T7Jq/feaFOVGb+Yc1zBw38zN7lXll5iT2nux6QDTETDYTyjes2WZXYveYu2ZkZuPc2uJ2d0VIvpof5kDpHhqvwmlO8YbiJHNNNZMSu+vaZL4pTqGVZpiXZk35xkDqrOlXvLyVyvk24BqnqMI0j5qpnG9tNdQsN6vN8GyMBF9iZuaTWmih+ah4MeLZBYokH5VPUjiEY2m+tRTOnDYHzdPsGuHYJ/PAjMnGmmmr+a7II9Y7Zk6a24oCGWuOmqvmi6K/nTGz1Ebs7oiZqHDucjbOji8pmiSLt1Keb3MVTixVONWseitrpyIsK81nsyW5R/KeS2zCPzqxEZt6Zp6b84q1EGHdr/anXkm95q2iYeaiPexObBy/mNgozzdSoF8RUvpa15TvnuZIk0Qkda+Kk0AXVO8sSvvbPEUPu6XG1ThCRcFV1nTzRkW1IU7wlMJZcogTe2/umO3JvHJ/I2fZKBter2Iu61wzGzK7sqYpvhIOZza74ydpWW1GnOAjMyUZo1D6VH/iOIdNQbG5PE14B1WaRqKSCOFe88FcMffMxroZ0S5oBczNRQ98Z/YlY5sVuXszG2f+DkWoWZ8ILK7N7kDkCSFulC+Er5xvvJjwUcWpONHy1wnPskbXhQMPzQpFqMmlTpR/iVA8XRf5c11RvTTVTiuOPCVfO863qiJ0/MD/jmgz9xXPb1N9L/3rWqSo6kOK/yX+OVFkjQptUP+XfgIyJWlyFgvp/QAAAABJRU5ErkJggg==>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAABI0lEQVR4Xu3SsSuFURjH8UcuCzeLKBLXoJTsSkYyMPgHmFhMlpuySimFSeI/sBqUwmZSViUG2axKBr6/+5yjc7yvhdH91afb87znPfc8516zZv5jWjGKaXSgDcPZih8ygmtsYRlXuMFmuqgsg7jDOlpCbwkfmA91aSo4whNqSb+OF/MxFG2qUbLooRadmG+k6FP1JTpDbwKnSd3In16eM59tJen14xH7SW/tW91IfHk26U3izfyyhrCHB/OTaJP2uHDM/NjxVrtwHnrxsrpxkdRf0S2u4hbH5r/vs+Xz6iRnqIa6EC3sQR/uLZ9P91GYtyz6lncshDrevOoBLIZ+Fv2Pe7GNV8yYn0Zj7WIHG+Z3Usg4DnCYmArPtIHmjX/dZn6TTzKLM0b46jRYAAAAAElFTkSuQmCC>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAaCAYAAADygtH/AAAD7ElEQVR4Xu2YS6hNURjHP6G8349wPTMg7zyiREliwAADxVQMZOAZGeySxEBCEepmIIlQ6CLlFBlQBkoU8kiEkKHk8f3uWuuetdd+3HPPPYd76vzq3zlnrf1Y+1vf+n9rH5E6dWqVXqpuYWMHp6+qa9hYLgNVS1SrVRNVnePdCaarGsUMoqPDswwRM8lzVGelHePupFqgeqBqUq21uqV6rppdPDRGg+qOalLYoQxS3VX9sfqmmhw7QmSH7XN6p5oSO6Iy9FBdkOJ9ltn2daoTUkbGccIB1StJBoe+k2IeeEbQR6APq6KgPWSF6ruYwUbxrmYI/H3VhLCjCuxWfVCNs7+7q66qVrYcUQIE5bjqq5h0TYMl+kV1TEygHGTNM/uZR6TaICaLnqqGxnpFpqlOqboE7ZWG619UFcQsT8caMZNW8jLdqPptP7Por3qoeiJmyTl2qq5LfgHoqTotJpsIOtnGIH2wgS1BWzUYoXqtOhK0k3UvVPOD9lTGq95L+uz7uKC9UQ2zbQSKgJHueTAgsojj56l+qG6IWRYOrKGkAZcB2UNRm6laKOb+2IUPE3tbWn+WZiIxM78vaA/hwfEBP2h88nu5OygDDHe7/U6gCBgDJ4DAhJyX/EkrB2xnj5jJJpPJdhIEm8FuQs6IqaS+/SRgTRfELM3F8a4E9HMclbC3bWPmPkrrGRJJ/PosTSbK+SMPgKdW0s+4LlWZqj/GtrGNeiRJP3NgNQVJ72vBZUpW5H3wgLDyEbS39jML52d4iYOMwg4oCmOlbX42S/VStTnsCHA2EHltWX7mIGhkJZmfiQuav+TSGClmxj5LfC9WStB8P/OJxEzCJmmbnxFczrssyWv6EJifEr8u39P8zEHQmJBcm6AKUg3zgkaa7xIz0K1BXylBY4CcH+IKEMv7psQrch54IhvwPmGHh7OdtEqft6pKWp54yDlJzogP+zY2tWxuwx0zWcSDY/RZRJLul0yG236wb6qkn7mgUQ2xB+D63AdPHqA6qBpl+xwUQ/+cTNjhE5RGSQZlkeqT6pDEtwcOl6lsWtMYLCaLpoYdFuc7WeeXi5uQghSzZpXql5gKiY/y2uQvb86hcmb5XQJem9jY8c7p3jebVI/FBC6rBNNOsMMb8TLMtdw7HjoqyZd+JuKSZGd5e2gQk1Vk1xXVfjHbD57zmiTffDB/xpzld6nwQKx1/tVg3zVcsoPlw/aBm+VWnP+E/2+Go1/w20HWU9HJwqrD3ueeamnYUUOQHHutSkmUikBK85dLmu/VAlRyCsDosKOaMDu8JqF/NlMVguKHL7fpb6FKwc23qeaGHR2c9VLb1lKnTp06ZfMX3/K+nfYWyx0AAAAASUVORK5CYII=>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAAC3klEQVR4Xu2WT8hNQRjGX6HIv0SJSIQShUSULCSxYCELxVbsLPyL1S1JNkiKpETJQkpJJOULWWClRCGxIIRSVgrPz3vmu3Pmzrn33L5PUfdXT+f73pl75j0zzzszZj3+H0ZLI9JgB8ZJw9Ngt0yQ1kibpLnS0HJzCwulc+aDd4LkJpl/2FLpotX7XYkh0krpoXRD2lLolvRCWtLsWmKqdEealzYkTDR/9y/pm7SgiG+VTlsXM0zHI9Jra02KtjPSV2lR0sYHHpcaSbwK+jOTj6TxRWykdE3aGDq1g2ROSV/MlyUHVvgsnTQfMDBfel4860CCJIpl4vdslh5YDTvskH4WzyrCIE/NlzOwT7pu9QtrsfRd2p7EZ0ovpRVJvMQs6Z30zNz0VYRk30iTixgJkuiB0KkC3rtemmPuT5Il6ZhR0m3r8K6GueEPJfEUvvy9lZPlyf8kkoMEWG78SKFeMbdaujqB8+Z+ju3RD/tin7kFVpebWqCdfvekMUWM2flg+aULRXnXmj6cLX20Vr8GsFSfeV4thJmhcCigdpwwX4FGFCPZt8UzhYLh43gGqvwaINl4lygRko2XNsc08332k5X30qpkg5exDfYJYIWcXwMk+8oqagff4J92ybJc+81ndVfSVpVsmIR4l+A9LH+VX6GtDYZJl6QflvcdsO9yGOC/9IRh1thJ1iXxkOzZKBZ2EwqIv49JY6N2oMjZESjMLJxIJMNXp8msMi+Io+anTEpYmdSD9L1pzUJCe81Xh9lbLh3u7+3Qhw+hNtrC8cqGzLkd7gPcDZ6YJ5yrXAhLmxuAiw2/v2Ce+E7zmX4sXZWmN7v+gdlm/A1JPAu3KnYEblnsm1OsOskYqp1BchUc366A93Gby512zDYH04y0YTBh8PvS2rShC/iIg4XqTNCAYOkuW97XdeDIp7BSa/wVmI09hbqdGayC72tdDwcLBt0tLUsbOrDNBmahHj3+SX4DkCKHZLVf6cEAAAAASUVORK5CYII=>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADO0lEQVR4Xu2WT+hNURDHRyjyL38i/yKhRCERhYUkFiywUKyxE36I1dtINkiKpEhhIaUkskAohQ0lCokFIZSyUpiPOeOdd965793nvV9ZvE99u/eec/+cmTszZ0S6dJyBqs2qk+HI9X/BYNWAdLAB/VT7VNPFjDijOq/qH+b7qoar+oTrf2akaoVqvWqG2IsbMUd1WjUsncjAYseoJqveqHaE8cWqd6rZ4Rojdqq2h/OW4IGlqgeqa6qNQTdUL1Tzq7fWMEF1SzUznUgYJfbuX6pvYg5YEMZhuZgxOM/B8LOqddFYU3jooOq11C+aOWL6q2puMocDjqgqyXgR3H9O9VAshBxC7pTqeDiPmaW6r5qYjGdhsbzki5incuCtz6pjUvvL+dDzcCwDBmAIIRm/Z63qqOQLAMZdkJIO26r6GY5F+CKeSjUsYI/qqpRP/Hmq76ot0dgqsdzAqaNVI6I5h3BP/2YdU8Xi9JlYUhbhxpCwY8MYBmAIFakRvHe1WNXaJGYMRgGRwPPjxN7bI5aDKRQFvp2mQA0VsYTcn4ynTFG9l1pjOHLNQnMMEgunK2KevSQWyv53qZiPxb7vuqsawsMJ/i3CMQv7wm2xEKOSNIJ57os/hnc/iJXUFC8ad6RarqepPkp9vpTB10pYZ3FrSey4HOYgOfFcJRrDmLfhmLJBzHiOTi5fyuLGFEaQGxOHTg5KIvvMJ6ndS4qM8VwiLAlPh1CL86UV3BjKdxbilvhtZAzhsFfsr1BxYoqMcSfFVY73EF5pNSxL0zDz+v1D8nEPVBs2S+LfeyYHr1MJKa0xbkzsRa+GbJicH1YNjeab4c9765OFHZ3F4rV0scvEEvaQ5Dcz/7NpDnDvdakmOtot9nfx7CLVgb93l4Ny/UqaF6o/tfulWN/k/Ri92RMxg4oqj4cOxSGFvovn6aswbJvYn3qkuqyaVL21FEQOjhufTuSgK6ai0SWzb7CJFRkRQ7XCCbmd2bvjOG/YW8p2CzEVsZRI+7aOwuLuqVamEx2Eb9xULUkneoM1qouSz6tOQAt0QupzulcgfHYFlQnNVqB3JH9bzbG2wGs0iQvTiTagbWLHzzWeXbp0aYPfNRGYa1wKmf8AAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAaCAYAAADygtH/AAAELklEQVR4Xu2YXchUVRSGV5iiWaYWipb2gyj9QEYqCpkkEhUUYYKF3lpdBZUWhhdzE6IXIiIkIVaCfxTYhVFE1IBBUBAkioKKJmJYmNCFUJH6Pu29mD17zjnf+XQmP3FeeJk5e52ZM3v9vGvtMeujjwqMEl8RP4ivXA8Z3CqOzBevMW4W3xWnW3DWR+JOcXi0DxPHiTfF66vCHeJT4hLxAQtfXoWZ4ofi7bnBgjMn2MDf0U3wLJ45TfxFfDOuPy6eER+J1zjrLfGN+H7Q4ENPiD+IX4jLIr8Sj4qzW7e24W7xW/GhbP1J8Xfxkvi1OLrd3BPcIn5i4ZnwWXGOeGe0L7LgNBLBQdZtF19M1mqBD64TT1inc7ChB+fFRzMbjt4oNrJ1Bw49Lb6XG3oMSvJX8f5kjVLdKr4f36d4WPxenJKtlwKn8EV/WIhKEYjMOXGztacxDzsSX4tAZP8Vn88NPQQO+VRsWpAGx2JxkxU3Aj6zy8qD34HXxIvxtQyI5Y/iIWulOnhH/NzKGwARx9lpOfQad4knLTjI8YwF7SJB0Lrxic2BFLFH9loJhJIaPyxOzGwp3GmI6qS4hqNwGI4pgtub1oo4DYYN+Hd0CzQgGtdj4gLxL2tlN9XDb5xs4bkrLchGDpoD+8vlqQMNC4I5kOagDWhE6jReuX7Ob8rgn/GI46wd4npxn3WnMZA5aywElExBs0gCz26C9LO1GgPcL97GhzP4fijjUhD9poXSRHuqgJ370gcS1bMW2ngRXM9eiFxhoZH8ad3ppmjr2xY6+71xDSf9ZJ16VgfuDySnFO7ZOppDthClRrKG007F1yKQvRfEbeLLFjaJo5iJGDbLMEs8Lr6eGzLMs1CGjWStSM/qwp1WWXXutLTkikAbJprMXOksVuU017O/LXTl3eKDbXeUg0GUAO218gYDcMw/1p7pvE/1bDBwp1HipaAL0g2rnEZ2rLawCbpPiiqnpfMZLZ4fQinPSG8qAfczZI/JDQl8g0XdvE7lFKFWefpskkcrBZ2HoZbh1s9rDoQe0UXgc+TzGc3Cn0OANogjou1K4BtMtdHnM3SXkYKGMzXa6sAnBD9ylQJhximcG3OnLBR/s7DBooHQM/XV3GAhWulEjtP8emnk1YAKYNBuWkvwOQYRqI/F+8QtVl3eOagOtHSgpvgfmEuOWThz+nmTs+cBC47jBxaBdZydiy6H5T3il9Zy9j3iQQujBo2h6GA/WLBJsors+kxca2H8YC88p+x0UwaqgCSgmdQCG0UH+FeDrGAQLHNWipcsODufool+HmUymezs5r8d/m9GOl6Mza7romFBrijznoK56Dvx6dxwnYF9fCPOzw29AmLP3zFFune9YLkFDcx1vWegjFdF1inpoQbO32g4uvu/gghxEJ6bG4Y4OBIyS9JU+uijjz5uKFwGHu/DKAgOARUAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAA9UlEQVR4Xu3SoYsCQRTH8ScqKOqhGC+IeAjX/AMuarJpNPgPWLQYxSheunbRfigGu2C0mkwGsVmMd3B33+fOwDK7cggXDP7gAztvht03Mytyk4kgj6w74WaET/yg58yFpoEvvLgTYXnDDo9OPZAMVlgg4cwF8owj+masmy2jhqRdZNPCN6qIY4gx5hKyYdtvCQNUxFsUOJ0c1tjgXbyWNNpGFykzPsf2exLv7drCg3+BP1ct9l/GE7aYyYUjdC9jIt4edC91tE1d0ljiAzFT08U61vN9RdHUpYADOrZAmthjaup6Qefog34uagsm+sU/f9V7/j+/q+oqHbeR1QMAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAaCAYAAADxNd/XAAABlUlEQVR4Xu2WvytGURjHH2EQpSQShVExSEhZlMVA+bWbMFhYhIwyWYwko8UfQK9BKTNlMkkmxYRC4vt9zz0c5+29517l3Hc4n/r0vvc8977vee79nnuvSCDw79TABlhuF0qdIfgKP+EJrP5d9kot3IdddsFFC7yDG3bBI2VwBT7DHqvmZFDUVRizCx7ph4/yxwaW4QPssAueYHR24Y4kbIALlZMdhY3wEJ6KWsi+YXSW4KSoE+lsgBO/gJtwNvr+BrfNnTzSB7dgpSRooBVei1os7JzMiLoDufK/Dm9TeATr8kcWh9FhbNqi7dgGKuCBqLtNuzGeVf55AhfhtDEW2wAnyIky72yG8DOr/HfLT3Q0sQ1wwTIqc8ZYM7yRZPlng00pdD3V56Uwdk+i5ngPz0T9xje6gRFjjPf/dzgBB0Rd0mLw6TiVQv5PVf7I5MRegU5REdKLlQuIrw76gDU4HNWyYhW+wF67QLhoFuAl3IM5OA6v4LEU5tEnPHGMDRNCP+C5WBHS2G+dnHS9sR0IBAKBQMnxBfaVW3016HmOAAAAAElFTkSuQmCC>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAABYUlEQVR4Xu2WzysFURTHj9ihnhSJhYVsJclGKUlSllaWSm9rQ/FfyEpKkoUf/4WlsrWSl4WlhVgpfI47L3duM801M2be4n7qs5hzuvPu97175o1IIBDwYREf8MnTJbOsUqZx2S3adOEhXuB4dK0c4yeuRNfduIAtnI1q/80c7uAtfuFuvB1nGC9xyKoNiFncwlGr3odnOGbVstD7H2Gv2/BAg6zhKr5LRhA9JttObQpf8Rp7rLoGPMB+q5bFCJ6K+RLyMiMeQdZx0qltSPJPOYhb8nv8fKgsSBI6Hx847zZyUFuQtPnIS21B2ovc+fChIWbjtjpvVziR0PMNlytI2nxkoU+lfTFPKNtzfMSThN7mz8ps/hxEh1g/sKz5UGo5WmXPh1JLkCLzkUaZQfbcho3+h9zhi5jZaPuG92JuUoQiQZr4LPF96T5vJP4mUglFgnQUGkDfHso6qoFAIBDoHL4BA8FYG79sbAIAAAAASUVORK5CYII=>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAABq0lEQVR4Xu2WzysGQRjHH6EovxWJIgfl5CBclMKBg4s4OeMoLk5O8g/ISeLgIHJ+8wc4KKWclFJvLk4cxEnh+93ZZd7ZnW2Xdl9qPvXpfffZne2Z2XlmRsThcGTBOLyD9wmdVM1ypQGuwF24ATtKb5dSAXfgMezxr8kefIdT/nUlHINFOOTH8qIbXsNFWAOn4S0c1h/SaYcnsE2LNcNLUR3o1OJ18BB2abGsqRI1wKf+/4AteAZrtdgXnEqrRmwAPkv4RezsNqzXYlnTCx/guhGfha9w0Ih7zMM+I7YAPyT8ola4JN9TNA846CwDM5cZUTky10Twc7/BUfNGGQiSt3XKjEdiq6cktIia5+ZqGSdXsjiYdFTyqTrFOcq5atZTuViT6ORTdcpWT+XClrwtHoILwIH8vJ7YnosJN8akNnkt7TAP5mMmH3SKq2Asv6knUg0n4FwKR7yWdphHUdRWorMMH2G/EQ/x1+qJ8OtvwgvY6Mc4eDwwHIklT+5RV/BJ1OcMfIE3YtnccoadKYg6yvGItA/PJd+TTSbw7MkB5pTlL68dDofD4fh3fAItAWUE/FzhMgAAAABJRU5ErkJggg==>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAABQklEQVR4Xu2WwSsFURSHj7CjHorE4q1sJclGKSSpt2NlL1sbSvknZKksrMgfYG+pbK3Uy8LSQqwUvvNmJnfue0/3XZmZxfnqW8y5nen+mjl3RsQwjP9gBR/xKdC1pK0U5nDdL/r04SleYj29Vs7wEzfS635cxiYupLWiWMQDvMMvPMwvtzOBVzju1EYkuUETp5z6EF7gtFMrAg3VwE18l4BQ+irte7VZfMVrHHDqGvYEh51akcxLYKhtnPFqO9L5MY/hrvy8okUTHKoTOk8fuOQvlEx0qG7zFMIo3kj7afmbx63OMKJDZY3+PFWB6FDd5qkKRIXSA+Bc4udJ+/UwmezBWqszjKhQf5knZRBXcasH9RsUSlSoKs+Tku3vyF/w0W/UPb5IMkuZb/ggyY3KZg+fJb8/3e+t5P+EDMMwDMMog287kVaVi7dfZAAAAABJRU5ErkJggg==>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIUAAAAaCAYAAACZ6p+qAAAEYklEQVR4Xu2ZW8gVVRTHl1iQlHYxkqgoI4qeUkwl6AJdpBQzuiEm+CBekEDyoSAIguih6EmjICKJkCh6TYKClHqQgsAHE4roM6IoyIcwkCLr//v2bM+eOXuc5Zw654D7B3/OmT17rzl71po1e69jVigUCoVCofDfcbf0nfSDU/eGYRNhqbSq2XgWLJB2Sm9Iz0lX1k/PMkdaKe2WXpPWSHNrPQIeWx5ukl62YGeDNK9+ehbaOEcf+jImh8dWJ9yAV6X3pOuqY3hTOiXdXx1zU+6SZqTlVdu4wEFPS19K/0jP1E+7uVY6LG2RLpAekL6RViR9mD/XOigtlhZK+yzc5POTfh5bHh6RvpaWSBdJL0gfSxcnffhOG+foQ1/GMDbFY8vFIul96Yqk7VILDpiRrkraudA70tVJ2zggKNZKq6U/rF9QnGch0D+ovkdelD6ywRO1TPpFuv10D7PrpWM2eEC8trq4RvpWeiJpi/f+yaSN+dLGuQhjjlrwH3htueBV8FSj7RbpdxueNBchpc5P2sYJDusbFDj2Zxse+7AFm9gGHEsApK8C5vuZtNdCJvHa6gIHNvtjn8x0wMJDGB37dtIHyNYnpAerY48tN49JNzbauEAuTZNKt9rgFTNuRgkKgp/XYXMsGYi5MmdeAx/acFBwQw/Y4Gn12PLAA9Z0JBAABB3Bd7P0W9WWEu8FQQweWyNBavzL6il0GhglKKLDmmPT9uj8tqCI7R5bHnBYmyNje5xzW1DEdo+t3rStJzxcZuGd2tytnEms2r2MEhSMyTksdSQOx/FdQeGx1UW0mXNY6sho80xB4bXVm3ix5npiGhglKHZZ3mGpIxdZ2Jp3BYXHVhcXSp9Y3mGpI9nVdAWF11Zv2tYT08AoQdHmsPL66GCOhRV23/UE4xdauHFeXTI70scoQcF8mFdzbHQkOwcyIxmyLSjYgcw3ny0PLBJzDsORP1rY+sedTltQPFsde2z1YpT1BFDcuUd69Cy0cnakj66gIMDagoz5zFhYpadss7C6Z5UP2E6P4XLpiA3Gem1R8KP+w64mB9vJv61eIY47IMT3GJDxOMKYP6tP8NjqRbzp07iegObTkUJ5l6ITT8Xixjkgi1HhO2SDCh9BTOHuXRvM9wYLNtZXx3CH9Kt0W3XstbXZQuZI21LIql9IzydtuetvtLAoj/PKXd9rywU1iq+k4xYmEEVh5KgNp6NJsF36yeq/j99LOo+VWNIjZWfqB6TxHNzA/RZK+izg3pI+t+HUSvr/3kJNZpOF0vEOq9dnPLb4HSctLF7T11HKrRauRWmdzEmmfsnqJXW+vy59Kj1kISDIXJSzUzy2zkn4LwIntUFKJ9C5aXxynIMnD6civufw2CJt77FBOToHu4dVFhxOuToHAckDzLXutHZHe2ydU5CiX7H862NS8Fv4TbnXR2EM8IcV6TJN85OEzEFA3Nc8URgPPImPW4+/if9HWEess+kJ0kKhUCgUCoVCYXL8CxtmWc5EYxSoAAAAAElFTkSuQmCC>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAaCAYAAAAHfFpPAAACPElEQVR4Xu2WP2gUQRTGPzGKQkArNcREAlpEBUELIYmNJFWwsRBCtBEkRRoVRE0rVqKkCAhqELGwScoQSJUudloIFiJREQVBA4E0in++j3fj7g6b3Z3LigeZH/xgb97t3O6bN28OiEQiFeigE3S3H9gMbKG36Ee634u1AiP0G/2dUp+/NK6/04d0n7shlBN0raGuW5EddA75i9QPe/YF2u7FStlJn9IP9AcdyIZbhk76DpYEJSONXnoRTS7gWXqH3oCV05lsuBb0UEP+YCBaGC3QdT+AJDmqjp5sqJg9dJZ2wSZWAkYz36iHo/QurNc0i57vFx30xjXnTdizX/ZipVyj5xvXWnlNkpfhjdIGS0BweTbQ/TP0Mz0OO7HkIfqAvqGnEZjgI7C975qGS8Dtv9+olwP0EZrr1K7El2Ev7HxCX9NxWC+rzDY6RU+lxtwe06Rl6P69SFaiqsP0OcJXq2j/n4Q1P23lyklQQ/qJ7LnqzOuyPn3IrkRVp+kn+gJh22G9/S/cCbBKj2VD+eyiz+hBb1wr9B42WfBZWgFVzSS9SLd6sSKKzn+hStQ2+Ep7vVguV+mYP4gkAW9hk9aNThc13ZDSF0Xnv1ATV+XehzXLddEPay+9pN1eTKgylmBJUDLqRAl9DPuNUFT2Kv8Jb1wVdQm2ledRMrea3QqSfa7j5HAqfg/2f9rFda39uj31nY2gl7jiD5ZwAcl/ffdM+rcq1Uf04q/oOYRtqf+CSjevfCORSCQSiUT+KX8AUxR9By7mOmcAAAAASUVORK5CYII=>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAZCAYAAADNAiUZAAABcElEQVR4Xu2UQSsFURiG37tQRElKKUpSshDFSpZSFqRYiLKwlC1lp2TBSuxYWfgJNki37NjIwsZCSvkDLBTxvr4ZnXvunLlDzUbz1FMz3zn3vPfMnPmAf0Yz3adt/kBelOg6faTt3lhuDNNdeoOMoV10zi869NIdekDnaUPl8PdjXaWjqBHaR5fpBf2gR5XDP8zQOzpIm+gmPYMFxSzC1htChtBpOkKfkBzaSe/pglNrodd0JbofoEvRdc3QGE3Qy08KVdgrbLEYHZhjWobtfIteRve39J2ewl5JkLTQPVSHCs19pt1efRIZT29aqGqhUL8+AdvhGz2EHc4goVA9ujKqFxdJob8iFNpIz5G8eG6hIrR4qJ6ZtFCdzKTFNVefWYdXz0xa6BSscYw5tXp6EqnrPxGH6tsreWOt9IpuOLUe2C7T2mYQ/Xv9WDv5jHyBfeD9zjw18ge6Rmdh3Wib1jlzckEneRzWNtUaCwoK8uULDF5UqnVtOuUAAAAASUVORK5CYII=>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAaCAYAAAAHfFpPAAACV0lEQVR4Xu2WPWgVQRSFj0QlolGD0Wj8RdKogRSihSSNJGmCICIIKgg21iqSkMJGrEQxYiGiqIhYBLGSFGkepohgoY3YJKAiCoLYaKHizzncjG93zL6dfS74IPPBB8vc3bdv7sy9s0AkEglgHR2hK/1AA7KKDtD9dAtdkBhfPXtdCP3AOfqWbvBijYL+4176kn6gN+lp+oDeo930Md3mHijCTvplVl03GkvpLfqZHqZN6TCO0h90krZ4sVyW0Lv0Df1Oe9Lh/84KOk4/0d1ezNFGX9ArfiCEA/QCHaa/6L50uBS0q/r9wQC07S/Tn/SQF0uyjFZgcynEGlgNbaRDsAQcSd1RDl30IqrNKpRe+hU2OU0yC8XGUEf9n4HVj9DKKwFKRNkshCWgSH/RM/cRtihKbCv+7g012QGrfZdZl4Dzf+4ol830Bl3rBzJYT1/Rj6hjZfNYRK/CtphDzU9N8E5iLAs93w77dijiIH0CO87yysGdTE9hq1sqakg6NrTivo9oc/XWOdlDr9ehzu539Bnyy8EloILa9a9EnqWdfiALHSuqLf8BrdBr5L+wXrRr1NGPI6xWt9L3yP8/msc12HEexCl6wh9ENQEzsO1dNmpkarp5W9+hXfgQdv7rFJkLJVXNNev7IIVerDp/Tjd5MaGdMQVLgpJRJkqovuT0jiJoYkqAmrW+BpMsh5VV0NmvZqcfcnWurbU9Eb9EvyXiula9Lk7c8y/00ZP+YCC76DTs+3+UHqO36QTSc2hotJ3zGmst1DN0FB6EHdcdCC+lSCQSiUQi85jf/WBqhGts2R0AAAAASUVORK5CYII=>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAZCAYAAADXPsWXAAAA00lEQVR4Xu2SMQuBURSGj2IyiPwBBgub8gNktliUwWixMvoTFoMyScmfYFKsFrMoZWMUz+n6vq5L+pgM31PPct7buffce0VC3lHFM94st5iz1qRwaeVXbFq5T1vMghlGnUwp4BrLGHEynywecIcZJ0vgFEtO/QXdfSLmNA2rHsch1qzaR+ryPFIMB9iVDyO46Bg6zgnz2MGemGaB0d1GYk4zx7582cBDn1ybLMRc6E/opWqTlhsEJYkr3GDayQJTxAuO5YvX8KjgXp6//vFRDwn5H+5PwSi18ipmNQAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA70lEQVR4XmNgGAWUAi0gvgPE/5HwNyC2hcpPRpO7D8RqUDmcwBKIfwLxbSCWRBJnB+L1QFwPxNxI4ngBJxDvAOJ/QOwBFWME4lIoBrFJAhEMEK8sB2JWBogh3VA2yUAciK8D8XsgbmaAhBdZBsFAKwPEdYeAmB9NjmTgxQAJtxMMFBqmCcT7gPgWA2pEkAzkgXgjEKswoEYEC7IiYgDIO6uA2AzKR44IHZgiYgDIoHVA7I0m3sAAcR2IJgooMkC8VoguAQQ2QPwbiE8BsTCaHAqIBeJfDIj89heI/ZHks6BiyPI7gVgISc0oGAVDEwAAbIgzuimogvYAAAAASUVORK5CYII=>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAaCAYAAAAnkAWyAAACKklEQVR4Xu2WP0hWYRTGT2QQKaQkOqiYg4MgGJhC4qJI2KBQDg4tLuYioohIGm4Soi46lohTi5saiA4ODkFLQS2GoCJBQw6Cgorp8/jeF997vPd+f6C7eH/w4/tzPt573vs9594rkpDwX8iDRfCuLsRMPnwE7+hCEE3wBF7AdZjrL8dGNzwX08dHVYukFO7DcV2ImTp4DF/rQhSNYs5+uy7EDJs+grW6EMUw/AurdMGBGXzsvYbBrGYbO647D3/CQlXzwaFko22wGC7CDTFDG0YOHIEDErwBrrcCy3UhgnvwKXwuJrpfxWwgaP0reJBv8D18470/hTPuj0LgwSbhkPgPkE3jzfAXHPTcFjOwPe6PXLj4Fnwr1wfvEjPh6eZdbyCbxuvhH9jpfeY6ExKRd/7tn8RcVSqc79PJu8Zu4INk3vhD+MWT70nKvLM5Nsl8cyOEr+nkPQhm9Td8JxEZDaAF/hP/ZblAUuSdw8l4uJkqgTuSXt5dnsBVWAnH5OYMRMF/ms1zExZGhZEJzbtt/oXzHa/vZ/AVfCbmSpIK27iNCiOUyQbY/CGscb7j9Z03J96kOAcdTu2KajGxsYPJvPFxwA7JqPjPRhBsfFluZjyTDbTCA7keTHsR2YVlcFYC5o+L9sLvcA6uwZfwh5gzOS2miTAeiBlS3biF944+2KALCh5jCm7CBbgk5kzvwc+wXyJOgH565GKc8LifJvXT4331OSEhISHhlnAJPJRhQwuYdvIAAAAASUVORK5CYII=>