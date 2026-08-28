# **Memory-Native Sequence Intelligence: Test-Time Learning, Fast Weights, and Recurrent State**

The foundational architecture of sequence intelligence has historically been constrained by the dichotomy between compressed recurrent states and full-context attention mechanisms1. Traditional Recurrent Neural Networks (RNNs) and their modern state-space descendants continuously compress historical context into a fixed-size vector. While this achieves linear computational complexity, it inherently suffers from rapid information decay and catastrophic forgetting over long sequences3. Conversely, self-attention architectures maintain a lossless historical ledger by calculating the direct dependencies of all tokens across a sequence window1. This mechanism acts as an optimal short-term memory but incurs a quadratic computational and spatial cost (![][image1]), rendering standard attention architectures fundamentally incompatible with the million-step sequence horizons demanded by genomics, continuous agentic reasoning, and unbounded contextual analysis1.  
The emergence of memory-native sequence intelligence represents a paradigm shift away from the premise of "frozen inference." In traditional paradigms, neural networks act as static functions during inference, ceasing to learn once deployed. However, a convergence of research into Test-Time Training (TTT) layers, fast weight programmers, and neural long-term memory frameworks has demonstrated that the hidden state of a sequence model should not be a passive algebraic accumulator. Instead, the recurrent state operates optimally when conceptualized as an active machine learning model itself, continuously updating its internal parameters during the forward pass2. Under this framework, inference is redefined as an act of continuous, localized optimization, bridging the gap between meta-learning and real-time associative recall4.

## **Linear Attention and the Re-emergence of Fast Weights**

To trace the evolution of active memory architectures, it is necessary to examine the trajectory of linear attention. The foundational premise of linear attention is the decomposition of the standard softmax attention matrix into a kernelized formulation, which allows associative computations to be expressed as a running sum10. This recursive form effectively treats the sequence layer as a "fast weight programmer" that dynamically binds query, key, and value vectors over time into a fixed-size memory matrix10.  
However, pure linear attention suffers from uniform associative interference. As new tokens are ingested into the sequence, their representations uniformly overwrite previous associations without regard for the structural geometry of the knowledge space. This limitation was systematically addressed by the reintroduction of the Delta Rule—originally formalized in 1960 by Widrow and Hoff—into sequence modeling via architectures like DeltaNet13.

### **Test-Time Regression and the Delta Rule**

DeltaNet reconceptualizes the recurrent state as a dynamic weight matrix ![][image2] that explicitly attempts to minimize a least-squares retrieval error at every sequential time step15. The model calculates the difference (the "delta") between the target value ![][image3] and the memory's current prediction for the key ![][image4], updating the state purely based on this residual error14.  
The standard DeltaNet recursive update is formulated as:  
![][image5]  
where ![][image6] represents a learning rate or gain parameter15. This equation reveals that the delta rule is effectively a step of stochastic gradient descent (SGD) executed on a linear regression objective natively during the forward pass15. By isolating the error term ![][image7], the network surgically overwrites specific associative bindings rather than uniformly decaying the entire memory matrix16.

### **Preconditioning and the DGPS Taxonomy**

While the standard delta rule provides targeted memory updates, it constitutes a first-order optimization that ignores the underlying curvature of the data space15. In deeply correlated sequences, first-order approximations lead to suboptimal memory topologies. Advanced implementations introduce second-order "curvature-aware" information through exact preconditioning, effectively multiplying the update by the inverse key Gram matrix15. Because computing an exact inverse Gram matrix sequentially is computationally prohibitive, diagonal approximations are utilized to maintain hardware efficiency required for large language models15.  
This dynamic gives rise to the DGPS architectural taxonomy for classifying linear recurrences, which maps every linear state-space model against four variables15.

| Taxonomy Component | Mathematical Symbol | Functional Role in Sequence Memory |
| :---- | :---- | :---- |
| **Decay** | **![][image8]** | Regulates the global forgetting and fading of the old state. |
| **Gain** | **![][image6]** | Modulates the step size and magnitude of the new associative update. |
| **Preconditioner** | **![][image9]** | Corrects for the topological curvature of the input space to ensure optimal updates. |
| **Solve** | N/A | The specific mathematical update rule employed (e.g., Delta rule vs. uniform decay). |

## **Gated Recurrences and Bilinear Interactions**

The parallel evolution of State-Space Models (SSMs), particularly Mamba and Mamba2, introduced data-dependent scalar gating, allowing networks to adaptively filter out irrelevant tokens before they contaminate the memory state17. However, Mamba2 relies on a uniform decay mechanism; it applies the same decay coefficient to all dimensions of the hidden state, which proves highly inefficient for precise memory clearance or targeted forgetting20.  
The structural synthesis of Mamba2's scalar gating and DeltaNet's precision error-correction birthed the Gated DeltaNet architecture, recently adopted as the linear-attention layer for models such as Qwen3-Next18. Gated DeltaNet represents a class of Bilinear RNNs where the hidden state interacts directly with the input key vectors via multiplicative dynamics17.

### **The Surgical Eraser and the Power Washer**

Gated DeltaNet enforces a "gated delta rule," which unifies broad state decay with precise associative erasure. The central recurrence is defined as:  
![][image10]  
where ![][image11] serves as the global forget gate (often conceptualized as a "power washer"), while the Householder transformation ![][image12] acts as a "surgical eraser"16. Assuming ![][image4] is normalized, this transformation systematically projects the existing memory orthogonal to the current key. This orthogonal projection effectively deletes any prior association with ![][image4] before the new value is written, guaranteeing that contradictory facts do not superimpose over one another16.  
The implications of this orthogonal projection are profound for language modeling and million-step sequence evaluation. In Synthetic Needle-in-a-Haystack (S-NIAH) benchmarks, models are tested on their ability to retrieve specific tokens buried within massive distractor contexts. Pure Mamba2 struggles with complex noise filtration due to uniform decay, while standard DeltaNet excels in long-term retention but fails to clear obsolete memory context when confronted with complex contradictions20.

| Model Architecture | S-NIAH-1 (Pure Retention) | S-NIAH-2/3 (Complex Clearing at 8K Tokens) | Wiki Perplexity (1.3B scale) |
| :---- | :---- | :---- | :---- |
| **Mamba2** | 30.4% \- 65.4% | 17.0% \- 56.2% | 16.56 |
| **DeltaNet** | 97.4% \- 99.0% | 14.4% \- 22.4% | 17.71 |
| **Gated DeltaNet** | 88.4% \- 98.4% | 29.6% \- 99.8% | 16.42 |

By combining selective global decay with precise orthogonal erasure, Gated DeltaNet scales up to 99.8% accuracy in complex retrieval tasks, matching the retrieval fidelity of quadratic Transformers while operating strictly in linear time16.  
To further push performance, researchers have developed hybrid architectures that interleave these memory mechanisms. Gated DeltaNet-H1 intertwines Gated DeltaNet blocks with Sliding Window Attention (SWA), achieving a Wiki perplexity of 16.0720. Gated DeltaNet-H2 adopts a sequence of Mamba2, Gated DeltaNet, and SWA layers, lowering perplexity further to 15.91 and validating the hypothesis that merging global state-space modeling, precise delta-rule erasure, and local exact attention yields superior sequence comprehension20. Furthermore, chunkwise parallelization algorithms—which compute exact intra-chunk recurrences and pass states between inter-chunk boundaries using Unscented Transform (UT) matrix inversions—allow these models to utilize highly optimized matrix-matrix multiplications16.

## **Test-Time Training (TTT): The Hidden State as a Machine Learning Model**

The conceptual boundary between inference and training is entirely dissolved by Test-Time Training (TTT) layers22. Motivated by the observation that Large Language Models compress massive datasets into their weights via self-supervised learning, TTT architectures hypothesis that the hidden state of a sequence model should perform the exact same compression heuristic on the sequence context during inference9.  
In TTT, the traditional static hidden state vector ![][image13] is discarded and replaced by the weights ![][image14] of an embedded neural network ![][image15] (which can be a linear model or a Multi-Layer Perceptron)8. At each token step, this inner model is optimized via gradient descent against a self-supervised multi-view reconstruction task2.  
Given an input ![][image16], the model generates a training view ![][image17] and a label view ![][image18]2. The weights are updated by minimizing the loss:  
![][image19]  
Following the gradient update:  
![][image20]  
the output token is generated by passing a query projection through the newly updated model: ![][image21]2. Crucially, the projection matrices ![][image22], ![][image23], and ![][image24] are learned end-to-end during the outer pre-training loop, allowing the self-supervised task to adapt optimally for the primary objective2.

### **Instantiations: TTT-Linear and TTT-MLP**

The instantiation of the hidden state model determines the expressivity and computational overhead of the layer. TTT-Linear utilizes a simple linear model where ![][image25], enhanced with layer normalization and residual connections for stability2. Because it requires only matrix-vector operations, it is highly computationally efficient. TTT-MLP introduces a two-layer multilayer perceptron with GELU activations and a hidden dimension four times the input size, allowing for non-linear transformations and greater expressivity at the cost of heavier memory I/O challenges2.  
Evaluations at scales ranging from 125M to 1.3B parameters demonstrate that similar to standard Transformers, TTT-Linear and TTT-MLP continue to reduce perplexity indefinitely by conditioning on more tokens, whereas models like Mamba hit an asymptote and cannot leverage context effectively past 16K tokens6.

### **Mini-Batch TTT and Dual Form Optimization**

Naively executing gradient descent at every single sequential token step destroys the parallelization efficiency required for modern GPU/TPU execution, making real-world deployment impossible2. To circumvent this, TTT architectures group tokens into mini-batches (commonly sized at ![][image26]). Inner-loop gradients are computed for the entire batch simultaneously, balancing online learning with hardware utilization2.  
More critically, TTT implements a "Dual Form" optimization. The Dual Form is a mathematical refactoring that bypasses the need to materialize the sequential hidden state at every single step9. By leveraging matrix-matrix multiplications, the Dual Form computes all outputs and gradient updates within a sequence chunk in bulk22. This guarantees an identical mathematical output to the sequential formulation but achieves hardware accelerations of over 5x on TPUs, ensuring that models like TTT-Linear scale efficiently past 1.3 billion parameters and achieve faster forward pass latencies than Transformers at context lengths above 8K2.

## **Neural Long-Term Memory: The Titan Architecture**

Drawing direct inspiration from human neuropsychological dual-process memory, the Titan framework structures sequence intelligence into three interacting branches: Short-term memory (attention), Persistent memory (fixed knowledge parameters), and a Deep Neural Long-Term Memory (LMM)4. Developed by researchers at Google, Titans recognize that the most effective way to store unbounded context is not through passive key-value appending, but by training an associative multilayer perceptron during inference1.  
The core engine of the Titan architecture is governed by "surprise-based memorization," grounded in the psychological phenomenon that unexpected events trigger higher neuroplasticity and stronger memory encoding7.

### **Surprise, Momentum, and Consolidation**

In the Titan framework, the memorability of a token ![][image16] is dynamically scored based on its "surprise," mathematically defined as the gradient of the associative loss function with respect to the model parameters:  
![][image27]  
7. If a new token is easily predicted by the current memory state, the gradient is near zero, indicating routine information, and no significant weight update occurs28. If the token wildly deviates from the learned state, the massive gradient triggers a proportional memory consolidation27.  
To prevent the neural memory from hyper-focusing on isolated anomalies and causing associative drift, Titans introduce a momentum-based mechanism that tracks the temporal accumulation of surprise across the sequence, smoothing the data-dependent learning rate ![][image28]5. Furthermore, an adaptive gating mechanism ![][image8] acts as a data-dependent weight-decay scalar, selectively fading older parameters to prevent capacity saturation and manage memory drift over millions of tokens29.

### **Architectural Topologies: MAC, MAG, and MAL**

Titans integrate this LMM module into deep learning networks through three primary architectural variants to balance short-term precision with long-term recall26.

* **Memory as Context (MAC):** The LMM outputs are treated as historical context and concatenated with the current input sequence and persistent memory. The short-term attention mechanism then natively attends over this enriched context, allowing the attention head to arbitrate between immediate recency and deep historical recall26. MAC excels in sequences exceeding 10 million tokens7.  
* **Memory as a Gate (MAG):** Bypasses concatenation in favor of direct non-linear gating. MAG merges sliding window attention outputs with the neural memory outputs using a learned weighting operation, providing precise deterministic control over how short and long-term memories are integrated26.  
* **Memory as a Layer (MAL):** Embeds the continuous learning mechanism as a distinct sequential layer, functioning similarly to TTT layers but uniquely utilizing the momentum-surprise update rule and data-dependent decay26.

In million-token language modeling and multi-million step needle-in-a-haystack tasks (such as the BABILong benchmark, which tests reasoning across extremely long documents), Titans operating in the MAC topology maintain upwards of 70% accuracy at ![][image29] tokens, a horizon where purely recurrent models and standard quadratic transformers catastrophically fail, dropping below 40% accuracy7. In specialized time series forecasting benchmarks (ETTm1, Traffic, Weather), the Titan neural memory actively outperforms both Transformer-based and linear recurrent baselines27.

## **Mechanics of Memory: Erasure, Contradiction, and Replay**

A second-order insight derived from these memory-native systems is that true sequence intelligence requires the ability to handle logical contradictions and consolidate facts asynchronously32. In a standard Transformer KV-cache, a contradiction (e.g., observing a fact "The sky is blue", followed 10,000 tokens later by "The sky is red") results in both facts existing simultaneously in the cache. The attention head must use positional embeddings to heuristically weight the later fact higher32. In contrast, active memory-native systems can perform explicit knowledge editing during the forward pass using exact geometric transformations32.

### **Orthogonal Projection Erasure for Contradiction Handling**

When a deterministic memory engine encounters a contradictory update for a previously normalized key ![][image30], it does not simply add the new gradient on top of the old weights. Instead, it executes an orthogonal projection erasure utilizing the identity matrix ![][image31]:  
![][image32]  
32. This projection matrix ![][image33] zeroes out any weight parameters in the state ![][image34] that align with the spatial vector of the key ![][image30]. By doing so, the prior fact is surgically annihilated without causing collateral degradation to orthogonal concepts stored in the exact same memory matrix21. This mathematical property transforms the sequence model into a self-correcting knowledge base, heavily resistant to prompt-injection hallucinations and context degradation over time32.

### **Episodic Buffer and Memory Consolidation**

Because single-pass stochastic gradient descent is prone to under-fitting, architectures modeled after mammalian memory systems utilize an episodic buffer to retain highly surprising tokens for "replay"32. This directly mirrors hippocampal replay observed during sleep cycles in biological brains. When the streaming sequence enters a low-information state, the engine accesses its buffer, sorting historical keys by their recorded surprise metrics32. It then executes supplementary forward passes on the top\-![][image35] most surprising facts, tightening the associative bindings (consolidation) and recalculating gradients to ensure the most volatile information is deeply embedded in the persistent state32.

### **Recurrent Checkpoints and State Serialization**

For agents operating over unbounded temporal spans, the state matrix and momentum matrices must be checkpointed to disk or network securely. Because these systems are stateful, identical retrieval behavior across distributed systems requires exact binary parity32. Recurrent checkpoints are achieved by serializing the ![][image34] and ![][image36] matrices alongside the episodic buffer into a deterministic byte-stream, utilizing big-endian IEEE 754 64-bit floating-point layouts to bypass hardware endianness discrepancies, and verifying integrity through algorithms like the FNV-1a 64-bit hash32.

## **Cross-Platform Streaming Memory Engine Implementation**

To empirically validate the universal compatibility, deterministic predictability, and architectural behavior of these memory mechanics, a complete Streaming Memory Engine is formalized below32. The implementation integrates the surprise-metric calculation, momentum tracking (![][image36]), state decay (![][image34]), orthogonal contradiction handling, episodic buffering, and consolidation replay32.  
Crucially, this system enforces mathematically identical behavior across Python, C\#, C, Java, and Rust. To guarantee cross-language deterministic verification, the engine implements a 64-bit FNV-1a checksum over the internal state matrices and episodic buffer, strictly utilizing big-endian byte representations32.

### **1\. Python Implementation**

The Python variant utilizes the numpy library for highly optimized, vectorized linear algebra operations and the built-in struct library for strict big-endian serialization of the floating-point memory parameters32.

Python  
import struct  
import numpy as np

def fnv1a\_64(data: bytes) \-\> int:  
    FNV\_PRIME \= 0x100000001b3  
    FNV\_OFFSET\_BASIS \= 0xcbf29ce484222325  
    hash\_val \= FNV\_OFFSET\_BASIS  
    for b in data:  
        hash\_val ^= b  
        hash\_val \= (hash\_val \* FNV\_PRIME) & 0xFFFFFFFFFFFFFFFF  
    return hash\_val

class StreamingMemoryEngine:  
    def \_\_init\_\_(self, d\_key=4, d\_val=4, capacity=32):  
        self.d\_key \= d\_key  
        self.d\_val \= d\_val  
        self.capacity \= capacity  
        self.S \= np.zeros((d\_val, d\_key), dtype=np.float64)  
        self.M \= np.zeros((d\_val, d\_key), dtype=np.float64)  
        self.step\_count \= 0  
        self.buffer\_keys \= \[\]   
        self.buffer\_vals \= \[\]   
        self.buffer\_surp \= \[\] 

    def \_norm\_k(self, k):  
        norm \= np.linalg.norm(k)  
        if norm \< 1e-12: return np.zeros\_like(k)  
        return k / norm

    def ingest(self, key, val, alpha=0.95, beta=0.8, eta=0.5):  
        k\_hat \= self.\_norm\_k(np.array(key, dtype=np.float64))  
        v \= np.array(val, dtype=np.float64)  
          
        pred \= self.S @ k\_hat  
        err \= pred \- v  
        surprise \= float(np.linalg.norm(err))  
          
        grad \= np.outer(err, k\_hat)  
        self.M \= eta \* self.M \+ (1.0 \- eta) \* grad  
        self.S \= alpha \* self.S \- beta \* self.M  
        self.step\_count \+= 1  
          
        if len(self.buffer\_keys) \>= self.capacity:  
            self.buffer\_keys.pop(0)  
            self.buffer\_vals.pop(0)  
            self.buffer\_surp.pop(0)  
              
        self.buffer\_keys.append(k\_hat)  
        self.buffer\_vals.append(v)  
        self.buffer\_surp.append(surprise)  
        return surprise

    def retrieve(self, query, temp=0.5, alpha\_blend=0.7):  
        q\_hat \= self.\_norm\_k(np.array(query, dtype=np.float64))  
        v\_fw \= self.S @ q\_hat  
          
        if len(self.buffer\_keys) \== 0:  
            v\_ep \= np.zeros(self.d\_val, dtype=np.float64)  
        else:  
            sims \= np.array(\[np.dot(q\_hat, bk) / temp for bk in self.buffer\_keys\])  
            max\_sim \= np.max(sims)  
            exp\_sims \= np.exp(sims \- max\_sim)  
            weights \= exp\_sims / np.sum(exp\_sims)  
            v\_ep \= np.zeros(self.d\_val, dtype=np.float64)  
            for w, bv in zip(weights, self.buffer\_vals):  
                v\_ep \+= w \* bv  
                  
        v\_out \= alpha\_blend \* v\_fw \+ (1.0 \- alpha\_blend) \* v\_ep  
        return v\_out, v\_fw, v\_ep

    def handle\_contradiction(self, key, new\_val):  
        k\_hat \= self.\_norm\_k(np.array(key, dtype=np.float64))  
        v\_new \= np.array(new\_val, dtype=np.float64)  
        pred\_old \= self.S @ k\_hat  
        severity \= float(np.linalg.norm(pred\_old \- v\_new))  
          
        I \= np.eye(self.d\_key, dtype=np.float64)  
        P \= I \- np.outer(k\_hat, k\_hat)  
        self.S \= self.S @ P \+ np.outer(v\_new, k\_hat)  
        self.M \= self.M @ P  
          
        for i in range(len(self.buffer\_keys)):  
            if np.dot(self.buffer\_keys\[i\], k\_hat) \> 0.9999:  
                self.buffer\_vals\[i\] \= v\_new  
                self.buffer\_surp\[i\] \= severity  
                  
        return severity

    def consolidate\_replay(self, top\_k=5, replay\_alpha=0.98, replay\_beta=0.5):  
        if len(self.buffer\_keys) \== 0: return 0  
        indices \= np.argsort(self.buffer\_surp)\[::-1\]\[:top\_k\]  
        for idx in indices:  
            bk \= self.buffer\_keys\[idx\]  
            bv \= self.buffer\_vals\[idx\]  
            pred \= self.S @ bk  
            grad \= np.outer(pred \- bv, bk)  
            self.S \= replay\_alpha \* self.S \- replay\_beta \* grad  
        return len(indices)

    def checksum(self) \-\> int:  
        byte\_stream \= bytearray()  
        byte\_stream.extend(struct.pack("\>qqq", self.d\_key, self.d\_val, self.step\_count))  
        for r in range(self.d\_val):  
            for c in range(self.d\_key):  
                byte\_stream.extend(struct.pack("\>d", self.S\[r, c\]))  
        for r in range(self.d\_val):  
            for c in range(self.d\_key):  
                byte\_stream.extend(struct.pack("\>d", self.M\[r, c\]))  
        byte\_stream.extend(struct.pack("\>q", len(self.buffer\_keys)))  
        for bk, bv, bs in zip(self.buffer\_keys, self.buffer\_vals, self.buffer\_surp):  
            for val in bk: byte\_stream.extend(struct.pack("\>d", val))  
            for val in bv: byte\_stream.extend(struct.pack("\>d", val))  
            byte\_stream.extend(struct.pack("\>d", bs))  
        return fnv1a\_64(bytes(byte\_stream))

### **2\. C\# Implementation**

To mirror the linear algebraic projections in C\# without relying on massive external dependencies like Math.NET, the implementation utilizes flattened 1D arrays to represent the ![][image34] and ![][image36] matrices, calculating row/column offsets using manual striding32. The system leverages BitConverter, applying explicit endianness reversal logic where required to strictly match the deterministic Python big-endian byte stream32.

C\#  
using System;  
using System.Collections.Generic;  
using System.Linq;

public class StreamingMemoryEngine  
{  
    private readonly int d\_key;  
    private readonly int d\_val;  
    private readonly int capacity;  
    private double\[\] S;  
    private double\[\] M;  
    private long step\_count;

    private List\<double\[\]\> buffer\_keys \= new List\<double\[\]\>();  
    private List\<double\[\]\> buffer\_vals \= new List\<double\[\]\>();  
    private List\<double\> buffer\_surp \= new List\<double\>();

    public StreamingMemoryEngine(int d\_key \= 4, int d\_val \= 4, int capacity \= 32)  
    {  
        this.d\_key \= d\_key;  
        this.d\_val \= d\_val;  
        this.capacity \= capacity;  
        this.S \= new double\[d\_val \* d\_key\];  
        this.M \= new double\[d\_val \* d\_key\];  
        this.step\_count \= 0;  
    }

    private double\[\] NormK(double\[\] k)  
    {  
        double sum \= 0;  
        foreach (var v in k) sum \+= v \* v;  
        double norm \= Math.Sqrt(sum);  
        double\[\] res \= new double\[k.Length\];  
        if (norm \< 1e-12) return res;  
        for (int i \= 0; i \< k.Length; i++) res\[i\] \= k\[i\] / norm;  
        return res;  
    }

    private double\[\] MatVec(double\[\] mat, double\[\] vec, int rows, int cols)  
    {  
        double\[\] res \= new double\[rows\];  
        for (int r \= 0; r \< rows; r++)  
            for (int c \= 0; c \< cols; c++)  
                res\[r\] \+= mat\[r \* cols \+ c\] \* vec\[c\];  
        return res;  
    }

    public double Ingest(double\[\] key, double\[\] val, double alpha \= 0.95, double beta \= 0.8, double eta \= 0.5)  
    {  
        double\[\] k\_hat \= NormK(key);  
        double\[\] pred \= MatVec(S, k\_hat, d\_val, d\_key);  
        double\[\] err \= new double\[d\_val\];  
        double sumErrSq \= 0;  
        for (int i \= 0; i \< d\_val; i++)  
        {  
            err\[i\] \= pred\[i\] \- val\[i\];  
            sumErrSq \+= err\[i\] \* err\[i\];  
        }  
        double surprise \= Math.Sqrt(sumErrSq);

        for (int r \= 0; r \< d\_val; r++)  
        {  
            for (int c \= 0; c \< d\_key; c++)  
            {  
                int idx \= r \* d\_key \+ c;  
                double grad \= err\[r\] \* k\_hat\[c\];  
                M\[idx\] \= eta \* M\[idx\] \+ (1.0 \- eta) \* grad;  
                S\[idx\] \= alpha \* S\[idx\] \- beta \* M\[idx\];  
            }  
        }  
        step\_count++;

        if (buffer\_keys.Count \>= capacity)  
        {  
            buffer\_keys.RemoveAt(0);  
            buffer\_vals.RemoveAt(0);  
            buffer\_surp.RemoveAt(0);  
        }  
        buffer\_keys.Add(k\_hat);  
        buffer\_vals.Add((double\[\])val.Clone());  
        buffer\_surp.Add(surprise);  
        return surprise;  
    }

    public Tuple\<double\[\], double\[\], double\[\]\> Retrieve(double\[\] query, double temp \= 0.5, double alpha\_blend \= 0.7)  
    {  
        double\[\] q\_hat \= NormK(query);  
        double\[\] v\_fw \= MatVec(S, q\_hat, d\_val, d\_key);  
        double\[\] v\_ep \= new double\[d\_val\];

        if (buffer\_keys.Count \> 0)  
        {  
            double\[\] sims \= new double\[buffer\_keys.Count\];  
            double max\_sim \= double.MinValue;  
            for (int i \= 0; i \< buffer\_keys.Count; i++)  
            {  
                double dot \= 0;  
                for (int j \= 0; j \< d\_key; j++) dot \+= q\_hat\[j\] \* buffer\_keys\[i\]\[j\];  
                sims\[i\] \= dot / temp;  
                if (sims\[i\] \> max\_sim) max\_sim \= sims\[i\];  
            }  
            double sumExp \= 0;  
            double\[\] weights \= new double\[buffer\_keys.Count\];  
            for (int i \= 0; i \< buffer\_keys.Count; i++)  
            {  
                weights\[i\] \= Math.Exp(sims\[i\] \- max\_sim);  
                sumExp \+= weights\[i\];  
            }  
            for (int i \= 0; i \< buffer\_keys.Count; i++)  
            {  
                double w \= weights\[i\] / sumExp;  
                for (int j \= 0; j \< d\_val; j++) v\_ep\[j\] \+= w \* buffer\_vals\[i\]\[j\];  
            }  
        }

        double\[\] v\_out \= new double\[d\_val\];  
        for (int i \= 0; i \< d\_val; i++)  
            v\_out\[i\] \= alpha\_blend \* v\_fw\[i\] \+ (1.0 \- alpha\_blend) \* v\_ep\[i\];

        return new Tuple\<double\[\], double\[\], double\[\]\>(v\_out, v\_fw, v\_ep);  
    }

    public double HandleContradiction(double\[\] key, double\[\] new\_val)  
    {  
        double\[\] k\_hat \= NormK(key);  
        double\[\] pred\_old \= MatVec(S, k\_hat, d\_val, d\_key);  
        double sumSq \= 0;  
        for (int i \= 0; i \< d\_val; i++) sumSq \+= Math.Pow(pred\_old\[i\] \- new\_val\[i\], 2);  
        double severity \= Math.Sqrt(sumSq);

        double\[\] P \= new double\[d\_key \* d\_key\];  
        for (int r \= 0; r \< d\_key; r++)  
            for (int c \= 0; c \< d\_key; c++)  
                P\[r \* d\_key \+ c\] \= (r \== c ? 1.0 : 0.0) \- (k\_hat\[r\] \* k\_hat\[c\]);

        double\[\] S\_new \= new double\[d\_val \* d\_key\];  
        double\[\] M\_new \= new double\[d\_val \* d\_key\];  
          
        for (int r \= 0; r \< d\_val; r++)  
        {  
            for (int c \= 0; c \< d\_key; c++)  
            {  
                double s\_sum \= 0, m\_sum \= 0;  
                for (int k \= 0; k \< d\_key; k++)  
                {  
                    s\_sum \+= S\[r \* d\_key \+ k\] \* P\[k \* d\_key \+ c\];  
                    m\_sum \+= M\[r \* d\_key \+ k\] \* P\[k \* d\_key \+ c\];  
                }  
                S\_new\[r \* d\_key \+ c\] \= s\_sum \+ new\_val\[r\] \* k\_hat\[c\];  
                M\_new\[r \* d\_key \+ c\] \= m\_sum;  
            }  
        }  
        S \= S\_new;  
        M \= M\_new;

        for (int i \= 0; i \< buffer\_keys.Count; i++)  
        {  
            double dot \= 0;  
            for (int j \= 0; j \< d\_key; j++) dot \+= buffer\_keys\[i\]\[j\] \* k\_hat\[j\];  
            if (dot \> 0.9999)  
            {  
                buffer\_vals\[i\] \= (double\[\])new\_val.Clone();  
                buffer\_surp\[i\] \= severity;  
            }  
        }  
        return severity;  
    }

    public int ConsolidateReplay(int top\_k \= 5, double replay\_alpha \= 0.98, double replay\_beta \= 0.5)  
    {  
        if (buffer\_keys.Count \== 0) return 0;  
        var indices \= buffer\_surp.Select((val, idx) \=\> new { val, idx })  
            .OrderByDescending(x \=\> x.val).Take(top\_k).Select(x \=\> x.idx).ToList();

        foreach (int idx in indices)  
        {  
            double\[\] bk \= buffer\_keys\[idx\];  
            double\[\] bv \= buffer\_vals\[idx\];  
            double\[\] pred \= MatVec(S, bk, d\_val, d\_key);  
            for (int r \= 0; r \< d\_val; r++)  
            {  
                double err \= pred\[r\] \- bv\[r\];  
                for (int c \= 0; c \< d\_key; c++)  
                {  
                    double grad \= err \* bk\[c\];  
                    S\[r \* d\_key \+ c\] \= replay\_alpha \* S\[r \* d\_key \+ c\] \- replay\_beta \* grad;  
                }  
            }  
        }  
        return indices.Count;  
    }

    private void AddBigEndian(List\<byte\> stream, long val)  
    {  
        byte\[\] b \= BitConverter.GetBytes(val);  
        if (BitConverter.IsLittleEndian) Array.Reverse(b);  
        stream.AddRange(b);  
    }

    private void AddBigEndian(List\<byte\> stream, double val)  
    {  
        byte\[\] b \= BitConverter.GetBytes(val);  
        if (BitConverter.IsLittleEndian) Array.Reverse(b);  
        stream.AddRange(b);  
    }

    public ulong Checksum()  
    {  
        List\<byte\> stream \= new List\<byte\>();  
        AddBigEndian(stream, (long)d\_key);  
        AddBigEndian(stream, (long)d\_val);  
        AddBigEndian(stream, step\_count);  
        foreach (var v in S) AddBigEndian(stream, v);  
        foreach (var v in M) AddBigEndian(stream, v);  
        AddBigEndian(stream, (long)buffer\_keys.Count);  
          
        for (int i \= 0; i \< buffer\_keys.Count; i++)  
        {  
            foreach (var v in buffer\_keys\[i\]) AddBigEndian(stream, v);  
            foreach (var v in buffer\_vals\[i\]) AddBigEndian(stream, v);  
            AddBigEndian(stream, buffer\_surp\[i\]);  
        }

        ulong hash \= 0xcbf29ce484222325;  
        ulong prime \= 0x100000001b3;  
        foreach (byte b in stream)  
        {  
            hash ^= b;  
            hash \= hash \* prime;  
        }  
        return hash;  
    }  
}

### **3\. C Implementation**

In pure C, the absence of native garbage collection necessitates precise management of the episodic buffer matrix arrays32. The code models the objects identically to the memory alignment seen in higher-level languages using memmove to safely shift block contexts during buffer capacity evictions32. The system manually inspects architecture byte order via pointer casting to ensure the final FNV-1a checksum receives big-endian bytes32.

C  
\#**include** \<stdio.h\>  
\#**include** \<stdlib.h\>  
\#**include** \<string.h\>  
\#**include** \<math.h\>  
\#**include** \<stdint.h\>

\#**define** MAX\_CAPACITY 1024

typedef struct {  
    int64\_t d\_key;  
    int64\_t d\_val;  
    int64\_t capacity;  
    double \*S;  
    double \*M;  
    int64\_t step\_count;  
      
    double \*buf\_keys;  
    double \*buf\_vals;  
    double \*buf\_surp;  
    int64\_t buf\_len;  
} StreamingMemoryEngine;

uint64\_t fnv1a\_64(const uint8\_t \*data, size\_t len) {  
    uint64\_t hash \= 0xcbf29ce484222325ULL;  
    for (size\_t i \= 0; i \< len; i++) {  
        hash ^= data\[i\];  
        hash \*= 0x100000001b3ULL;  
    }  
    return hash;  
}

void reverse\_bytes\_if\_little(uint8\_t \*bytes, size\_t size) {  
    int x \= 1;  
    if (\*(char\*)\&x \== 1) {   
        for (size\_t i \= 0; i \< size / 2; i++) {  
            uint8\_t temp \= bytes\[i\];  
            bytes\[i\] \= bytes\[size \- 1 \- i\];  
            bytes\[size \- 1 \- i\] \= temp;  
        }  
    }  
}

void sme\_init(StreamingMemoryEngine \*e, int64\_t d\_key, int64\_t d\_val, int64\_t capacity) {  
    e-\>d\_key \= d\_key; e-\>d\_val \= d\_val; e-\>capacity \= capacity;  
    e-\>S \= calloc(d\_val \* d\_key, sizeof(double));  
    e-\>M \= calloc(d\_val \* d\_key, sizeof(double));  
    e-\>step\_count \= 0;  
    e-\>buf\_keys \= calloc(capacity \* d\_key, sizeof(double));  
    e-\>buf\_vals \= calloc(capacity \* d\_val, sizeof(double));  
    e-\>buf\_surp \= calloc(capacity, sizeof(double));  
    e-\>buf\_len \= 0;  
}

void norm\_k(int64\_t d, const double \*k, double \*out) {  
    double sum \= 0;  
    for(int i=0; i\<d; i++) sum \+= k\[i\]\*k\[i\];  
    double norm \= sqrt(sum);  
    if(norm \< 1e-12) {  
        for(int i=0; i\<d; i++) out\[i\] \= 0;  
    } else {  
        for(int i=0; i\<d; i++) out\[i\] \= k\[i\]/norm;  
    }  
}

double sme\_ingest(StreamingMemoryEngine \*e, const double \*key, const double \*val, double alpha, double beta, double eta) {  
    double \*k\_hat \= malloc(e-\>d\_key \* sizeof(double));  
    norm\_k(e-\>d\_key, key, k\_hat);  
      
    double \*err \= malloc(e-\>d\_val \* sizeof(double));  
    double sum\_sq \= 0;  
      
    for(int r=0; r\<e-\>d\_val; r++) {  
        double p \= 0;  
        for(int c=0; c\<e-\>d\_key; c++) p \+= e-\>S\[r\*e-\>d\_key \+ c\] \* k\_hat\[c\];  
        err\[r\] \= p \- val\[r\];  
        sum\_sq \+= err\[r\]\*err\[r\];  
    }  
    double surprise \= sqrt(sum\_sq);  
      
    for(int r=0; r\<e-\>d\_val; r++) {  
        for(int c=0; c\<e-\>d\_key; c++) {  
            int64\_t idx \= r\*e-\>d\_key \+ c;  
            double grad \= err\[r\] \* k\_hat\[c\];  
            e-\>M\[idx\] \= eta \* e-\>M\[idx\] \+ (1.0 \- eta) \* grad;  
            e-\>S\[idx\] \= alpha \* e-\>S\[idx\] \- beta \* e-\>M\[idx\];  
        }  
    }  
    e-\>step\_count++;  
      
    if(e-\>buf\_len \>= e-\>capacity) {  
        memmove(e-\>buf\_keys, e-\>buf\_keys \+ e-\>d\_key, (e-\>capacity\-1)\*e-\>d\_key\*sizeof(double));  
        memmove(e-\>buf\_vals, e-\>buf\_vals \+ e-\>d\_val, (e-\>capacity\-1)\*e-\>d\_val\*sizeof(double));  
        memmove(e-\>buf\_surp, e-\>buf\_surp \+ 1, (e-\>capacity\-1)\*sizeof(double));  
        e-\>buf\_len--;  
    }  
      
    memcpy(e-\>buf\_keys \+ e-\>buf\_len\*e-\>d\_key, k\_hat, e-\>d\_key\*sizeof(double));  
    memcpy(e-\>buf\_vals \+ e-\>buf\_len\*e-\>d\_val, val, e-\>d\_val\*sizeof(double));  
    e-\>buf\_surp\[e-\>buf\_len\] \= surprise;  
    e-\>buf\_len++;  
      
    free(k\_hat); free(err);  
    return surprise;  
}

uint64\_t sme\_checksum(StreamingMemoryEngine \*e) {  
    size\_t size \= sizeof(int64\_t)\*3 \+ sizeof(double)\*(e-\>d\_val\*e-\>d\_key\*2) \+ sizeof(int64\_t) \+   
                  e-\>buf\_len\*(sizeof(double)\*(e-\>d\_key \+ e-\>d\_val \+ 1));  
    uint8\_t \*stream \= malloc(size);  
    size\_t offset \= 0;  
      
    int64\_t header\[3\] \= {e-\>d\_key, e-\>d\_val, e-\>step\_count};  
    for(int i=0; i\<3; i++) {  
        uint8\_t buf\[8\]; memcpy(buf, \&header\[i\], 8); reverse\_bytes\_if\_little(buf, 8);  
        memcpy(stream \+ offset, buf, 8); offset+=8;  
    }  
    for(int i=0; i\<e-\>d\_val\*e-\>d\_key; i++) {  
        uint8\_t buf\[8\]; memcpy(buf, \&e-\>S\[i\], 8); reverse\_bytes\_if\_little(buf, 8);  
        memcpy(stream \+ offset, buf, 8); offset+=8;  
    }  
    for(int i=0; i\<e-\>d\_val\*e-\>d\_key; i++) {  
        uint8\_t buf\[8\]; memcpy(buf, \&e-\>M\[i\], 8); reverse\_bytes\_if\_little(buf, 8);  
        memcpy(stream \+ offset, buf, 8); offset+=8;  
    }  
      
    uint8\_t buf\_len\[8\]; memcpy(buf\_len, \&e-\>buf\_len, 8); reverse\_bytes\_if\_little(buf\_len, 8);  
    memcpy(stream \+ offset, buf\_len, 8); offset+=8;  
      
    for(int i=0; i\<e-\>buf\_len; i++) {  
        for(int j=0; j\<e-\>d\_key; j++) {  
            uint8\_t buf\[8\]; memcpy(buf, \&e-\>buf\_keys\[i\*e-\>d\_key \+ j\], 8); reverse\_bytes\_if\_little(buf, 8);  
            memcpy(stream \+ offset, buf, 8); offset+=8;  
        }  
        for(int j=0; j\<e-\>d\_val; j++) {  
            uint8\_t buf\[8\]; memcpy(buf, \&e-\>buf\_vals\[i\*e-\>d\_val \+ j\], 8); reverse\_bytes\_if\_little(buf, 8);  
            memcpy(stream \+ offset, buf, 8); offset+=8;  
        }  
        uint8\_t buf\[8\]; memcpy(buf, \&e-\>buf\_surp\[i\], 8); reverse\_bytes\_if\_little(buf, 8);  
        memcpy(stream \+ offset, buf, 8); offset+=8;  
    }  
    uint64\_t hash \= fnv1a\_64(stream, size);  
    free(stream);  
    return hash;  
}

### **4\. Java Implementation**

Java natively handles memory stream generation in big-endian layout via its internal ByteBuffer class, significantly simplifying the deterministic layout verification for the recurrent state32. The arrays map directly onto 2D multidimensional structures for mathematical fidelity while preserving exact object tracking inside the episodic lists32.

Java  
import java.nio.ByteBuffer;  
import java.nio.ByteOrder;  
import java.util.ArrayList;  
import java.util.Arrays;  
import java.util.Comparator;  
import java.util.List;

public class StreamingMemoryEngine {  
    private final int d\_key;  
    private final int d\_val;  
    private final int capacity;  
    private double\[\]\[\] S;  
    private double\[\]\[\] M;  
    private long step\_count \= 0;  
      
    private List\<double\[\]\> buffer\_keys \= new ArrayList\<\>();  
    private List\<double\[\]\> buffer\_vals \= new ArrayList\<\>();  
    private List\<Double\> buffer\_surp \= new ArrayList\<\>();

    public StreamingMemoryEngine(int d\_key, int d\_val, int capacity) {  
        this.d\_key \= d\_key;  
        this.d\_val \= d\_val;  
        this.capacity \= capacity;  
        this.S \= new double\[d\_val\]\[d\_key\];  
        this.M \= new double\[d\_val\]\[d\_key\];  
    }

    private double\[\] normK(double\[\] k) {  
        double sum \= 0;  
        for (double v : k) sum \+= v \* v;  
        double norm \= Math.sqrt(sum);  
        double\[\] res \= new double\[k.length\];  
        if (norm \< 1e-12) return res;  
        for (int i \= 0; i \< k.length; i++) res\[i\] \= k\[i\] / norm;  
        return res;  
    }

    public double ingest(double\[\] key, double\[\] val, double alpha, double beta, double eta) {  
        double\[\] kHat \= normK(key);  
        double\[\] err \= new double\[d\_val\];  
        double sumSq \= 0;  
          
        for (int r \= 0; r \< d\_val; r++) {  
            double pred \= 0;  
            for (int c \= 0; c \< d\_key; c++) pred \+= S\[r\]\[c\] \* kHat\[c\];  
            err\[r\] \= pred \- val\[r\];  
            sumSq \+= err\[r\] \* err\[r\];  
        }  
        double surprise \= Math.sqrt(sumSq);  
          
        for (int r \= 0; r \< d\_val; r++) {  
            for (int c \= 0; c \< d\_key; c++) {  
                double grad \= err\[r\] \* kHat\[c\];  
                M\[r\]\[c\] \= eta \* M\[r\]\[c\] \+ (1.0 \- eta) \* grad;  
                S\[r\]\[c\] \= alpha \* S\[r\]\[c\] \- beta \* M\[r\]\[c\];  
            }  
        }  
        step\_count++;  
          
        if (buffer\_keys.size() \>= capacity) {  
            buffer\_keys.remove(0);  
            buffer\_vals.remove(0);  
            buffer\_surp.remove(0);  
        }  
        buffer\_keys.add(kHat);  
        buffer\_vals.add(val.clone());  
        buffer\_surp.add(surprise);  
        return surprise;  
    }

    public double handleContradiction(double\[\] key, double\[\] newVal) {  
        double\[\] kHat \= normK(key);  
        double\[\] err \= new double\[d\_val\];  
        double sumSq \= 0;  
          
        for(int r \= 0; r \< d\_val; r++) {  
            double pred \= 0;  
            for(int c \= 0; c \< d\_key; c++) pred \+= S\[r\]\[c\] \* kHat\[c\];  
            err\[r\] \= pred \- newVal\[r\];  
            sumSq \+= err\[r\] \* err\[r\];  
        }  
        double severity \= Math.sqrt(sumSq);  
          
        double\[\]\[\] P \= new double\[d\_key\]\[d\_key\];  
        for(int r \= 0; r \< d\_key; r++) {  
            for(int c \= 0; c \< d\_key; c++) {  
                P\[r\]\[c\] \= (r \== c ? 1.0 : 0.0) \- (kHat\[r\] \* kHat\[c\]);  
            }  
        }  
          
        double\[\]\[\] sNew \= new double\[d\_val\]\[d\_key\];  
        double\[\]\[\] mNew \= new double\[d\_val\]\[d\_key\];  
          
        for (int r \= 0; r \< d\_val; r++) {  
            for (int c \= 0; c \< d\_key; c++) {  
                double sSum \= 0, mSum \= 0;  
                for (int k \= 0; k \< d\_key; k++) {  
                    sSum \+= S\[r\]\[k\] \* P\[k\]\[c\];  
                    mSum \+= M\[r\]\[k\] \* P\[k\]\[c\];  
                }  
                sNew\[r\]\[c\] \= sSum \+ newVal\[r\] \* kHat\[c\];  
                mNew\[r\]\[c\] \= mSum;  
            }  
        }  
        S \= sNew;  
        M \= mNew;  
          
        for (int i \= 0; i \< buffer\_keys.size(); i++) {  
            double dot \= 0;  
            for (int j \= 0; j \< d\_key; j++) dot \+= buffer\_keys.get(i)\[j\] \* kHat\[j\];  
            if (dot \> 0.9999) {  
                buffer\_vals.set(i, newVal.clone());  
                buffer\_surp.set(i, severity);  
            }  
        }  
        return severity;  
    }

    public long checksum() {  
        int bytes \= (3 \* 8) \+ (d\_val \* d\_key \* 8 \* 2) \+ 8 \+   
                    (buffer\_keys.size() \* (d\_key \+ d\_val \+ 1) \* 8);  
        ByteBuffer bb \= ByteBuffer.allocate(bytes);  
        bb.order(ByteOrder.BIG\_ENDIAN);  
          
        bb.putLong(d\_key).putLong(d\_val).putLong(step\_count);  
        for (int r \= 0; r \< d\_val; r++) for (int c \= 0; c \< d\_key; c++) bb.putDouble(S\[r\]\[c\]);  
        for (int r \= 0; r \< d\_val; r++) for (int c \= 0; c \< d\_key; c++) bb.putDouble(M\[r\]\[c\]);  
        bb.putLong(buffer\_keys.size());  
          
        for (int i \= 0; i \< buffer\_keys.size(); i++) {  
            for (double v : buffer\_keys.get(i)) bb.putDouble(v);  
            for (double v : buffer\_vals.get(i)) bb.putDouble(v);  
            bb.putDouble(buffer\_surp.get(i));  
        }  
          
        long hash \= 0xcbf29ce484222325L;  
        long prime \= 0x100000001b3L;  
        for (byte b : bb.array()) {  
            hash ^= (b & 0xFFL);  
            hash \*= prime;  
        }  
        return hash;  
    }  
}

### **5\. Rust Implementation**

The Rust variant strictly enforces memory safety constraints on the mutable sequential arrays, utilizing flat vector topologies. It avoids unsafe pointer manipulation by leveraging Rust's zero-overhead iterator abstractions to evaluate the mathematical tensors32. Standard big-endian packing is achieved securely using native bitwise f64 conversions before passing the state through the FNV-1a hasher32.

Rust  
use std::f64;

pub struct StreamingMemoryEngine {  
    d\_key: usize,  
    d\_val: usize,  
    capacity: usize,  
    s\_mat: Vec\<f64\>,  
    m\_mat: Vec\<f64\>,  
    step\_count: i64,  
    buffer\_keys: Vec\<Vec\<f64\>\>,  
    buffer\_vals: Vec\<Vec\<f64\>\>,  
    buffer\_surp: Vec\<f64\>,  
}

impl StreamingMemoryEngine {  
    pub fn new(d\_key: usize, d\_val: usize, capacity: usize) \-\> Self {  
        Self {  
            d\_key, d\_val, capacity,  
            s\_mat: vec\!\[0.0; d\_val \* d\_key\],  
            m\_mat: vec\!\[0.0; d\_val \* d\_key\],  
            step\_count: 0,  
            buffer\_keys: Vec::new(),  
            buffer\_vals: Vec::new(),  
            buffer\_surp: Vec::new(),  
        }  
    }

    fn norm\_k(&self, k: &\[f64\]) \-\> Vec\<f64\> {  
        let sum: f64 \= k.iter().map(|v| v \* v).sum();  
        let norm \= sum.sqrt();  
        if norm \< 1e-12 {  
            vec\!\[0.0; self.d\_key\]  
        } else {  
            k.iter().map(|v| v / norm).collect()  
        }  
    }

    pub fn ingest(&mut self, key: &\[f64\], val: &\[f64\], alpha: f64, beta: f64, eta: f64) \-\> f64 {  
        let k\_hat \= self.norm\_k(key);  
        let mut err \= vec\!\[0.0; self.d\_val\];  
        let mut sum\_sq \= 0.0;

        for r in 0..self.d\_val {  
            let mut pred \= 0.0;  
            for c in 0..self.d\_key {  
                pred \+= self.s\_mat\[r \* self.d\_key \+ c\] \* k\_hat\[c\];  
            }  
            err\[r\] \= pred \- val\[r\];  
            sum\_sq \+= err\[r\] \* err\[r\];  
        }  
        let surprise \= sum\_sq.sqrt();

        for r in 0..self.d\_val {  
            for c in 0..self.d\_key {  
                let idx \= r \* self.d\_key \+ c;  
                let grad \= err\[r\] \* k\_hat\[c\];  
                self.m\_mat\[idx\] \= eta \* self.m\_mat\[idx\] \+ (1.0 \- eta) \* grad;  
                self.s\_mat\[idx\] \= alpha \* self.s\_mat\[idx\] \- beta \* self.m\_mat\[idx\];  
            }  
        }  
        self.step\_count \+= 1;

        if self.buffer\_keys.len() \>= self.capacity {  
            self.buffer\_keys.remove(0);  
            self.buffer\_vals.remove(0);  
            self.buffer\_surp.remove(0);  
        }  
        self.buffer\_keys.push(k\_hat);  
        self.buffer\_vals.push(val.to\_vec());  
        self.buffer\_surp.push(surprise);

        surprise  
    }

    pub fn handle\_contradiction(&mut self, key: &\[f64\], new\_val: &\[f64\]) \-\> f64 {  
        let k\_hat \= self.norm\_k(key);  
        let mut sum\_sq \= 0.0;  
          
        for r in 0..self.d\_val {  
            let mut pred \= 0.0;  
            for c in 0..self.d\_key {  
                pred \+= self.s\_mat\[r \* self.d\_key \+ c\] \* k\_hat\[c\];  
            }  
            let diff \= pred \- new\_val\[r\];  
            sum\_sq \+= diff \* diff;  
        }  
        let severity \= sum\_sq.sqrt();

        let mut p\_mat \= vec\!\[0.0; self.d\_key \* self.d\_key\];  
        for r in 0..self.d\_key {  
            for c in 0..self.d\_key {  
                let i\_val \= if r \== c { 1.0 } else { 0.0 };  
                p\_mat\[r \* self.d\_key \+ c\] \= i\_val \- (k\_hat\[r\] \* k\_hat\[c\]);  
            }  
        }

        let mut s\_new \= vec\!\[0.0; self.d\_val \* self.d\_key\];  
        let mut m\_new \= vec\!\[0.0; self.d\_val \* self.d\_key\];

        for r in 0..self.d\_val {  
            for c in 0..self.d\_key {  
                let mut s\_sum \= 0.0;  
                let mut m\_sum \= 0.0;  
                for k in 0..self.d\_key {  
                    s\_sum \+= self.s\_mat\[r \* self.d\_key \+ k\] \* p\_mat\[k \* self.d\_key \+ c\];  
                    m\_sum \+= self.m\_mat\[r \* self.d\_key \+ k\] \* p\_mat\[k \* self.d\_key \+ c\];  
                }  
                s\_new\[r \* self.d\_key \+ c\] \= s\_sum \+ new\_val\[r\] \* k\_hat\[c\];  
                m\_new\[r \* self.d\_key \+ c\] \= m\_sum;  
            }  
        }  
        self.s\_mat \= s\_new;  
        self.m\_mat \= m\_new;

        for i in 0..self.buffer\_keys.len() {  
            let dot: f64 \= self.buffer\_keys\[i\].iter().zip(k\_hat.iter()).map(|(a, b)| a \* b).sum();  
            if dot \> 0.9999 {  
                self.buffer\_vals\[i\] \= new\_val.to\_vec();  
                self.buffer\_surp\[i\] \= severity;  
            }  
        }  
        severity  
    }

    pub fn checksum(&self) \-\> u64 {  
        let mut stream \= Vec::new();  
        stream.extend\_from\_slice(&(self.d\_key as i64).to\_be\_bytes());  
        stream.extend\_from\_slice(&(self.d\_val as i64).to\_be\_bytes());  
        stream.extend\_from\_slice(&self.step\_count.to\_be\_bytes());  
          
        for \&v in &self.s\_mat { stream.extend\_from\_slice(\&v.to\_bits().to\_be\_bytes()); }  
        for \&v in &self.m\_mat { stream.extend\_from\_slice(\&v.to\_bits().to\_be\_bytes()); }  
          
        stream.extend\_from\_slice(&(self.buffer\_keys.len() as i64).to\_be\_bytes());  
          
        for i in 0..self.buffer\_keys.len() {  
            for \&v in &self.buffer\_keys\[i\] { stream.extend\_from\_slice(\&v.to\_bits().to\_be\_bytes()); }  
            for \&v in &self.buffer\_vals\[i\] { stream.extend\_from\_slice(\&v.to\_bits().to\_be\_bytes()); }  
            stream.extend\_from\_slice(&self.buffer\_surp\[i\].to\_bits().to\_be\_bytes());  
        }

        let mut hash: u64 \= 0xcbf29ce484222325;  
        let prime: u64 \= 0x100000001b3;  
        for \&b in \&stream {  
            hash ^= b as u64;  
            hash \= hash.wrapping\_mul(prime);  
        }  
        hash  
    }  
}

## **Conclusion**

The engineering breakthroughs facilitating memory-native sequence models—including chunkwise parallelism, unrolled matrix optimizations, and mathematically rigorous memory editing—guarantee that the theoretical elegance of Test-Time Training and Neural Long-Term Memory scales robustly onto current-generation GPU and TPU hardware architectures9. As models systematically transition from restrictive 8K context limits to massive 10-million token horizons, the capability to retroactively edit facts via orthogonal projections and consolidate knowledge dynamically through momentum-driven surprise metrics represents a foundational shift in computational intelligence7.  
Memory-native sequence intelligence proves definitively that network memory is not a passive data repository but an active, continuous, and dynamic computational engine. Sequence processing is transitioning from being purely "spatial"—reliant solely on scaling parameters and network depth during pre-training—to being "temporal", effectively scaling test-time compute by embedding optimization loops directly within inference. Systems equipped with these algorithms can sustain coherent, highly detailed streams of reasoning indefinitely, ensuring that the intelligent agents of the future are no longer bound by the rigid constraints of a frozen inference window, but instead learn, forget, and adapt synchronously with the flow of time.

#### **Works cited**

> 1. \[2501.00663\] Titans: Learning to Memorize at Test Time \- arXiv, [https://arxiv.org/abs/2501.00663](https://arxiv.org/abs/2501.00663)  
> 2. Learning to (Learn at Test Time): RNNs with Expressive Hidden States, [https://www.alphaxiv.org/abs/2407.04620](https://www.alphaxiv.org/abs/2407.04620)  
> 3. Test-Time Training for RNNs | PDF | Applied Mathematics \- Scribd, [https://www.scribd.com/document/781697980/Learning-to-Learn-at-Test-Time-RNNs-with-Expressive-Hidden-States](https://www.scribd.com/document/781697980/Learning-to-Learn-at-Test-Time-RNNs-with-Expressive-Hidden-States)  
> 4. Titans: Learning at Test Time \- Emergent Mind, [https://www.emergentmind.com/topics/titans-learning-at-test-time](https://www.emergentmind.com/topics/titans-learning-at-test-time)  
> 5. Titans: Learning to Memorize at Test Time \- arXiv, [https://arxiv.org/html/2501.00663v1](https://arxiv.org/html/2501.00663v1)  
> 6. Learning to (Learn at Test Time): RNNs with Expressive Hidden States, [https://sophon.at/papers/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states](https://sophon.at/papers/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states)  
> 7. Titans: Learning to Memorize at Test Time \- alphaXiv, [https://www.alphaxiv.org/abs/2501.00663](https://www.alphaxiv.org/abs/2501.00663)  
> 8. \[Literature Review\] Learning to (Learn at Test Time) \- Moonlight, [https://www.themoonlight.io/en/review/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states](https://www.themoonlight.io/en/review/learning-to-learn-at-test-time-rnns-with-expressive-hidden-states)  
> 9. Learning to (Learn at Test Time): RNNs with Expressive Hidden States, [https://arxiv.org/pdf/2407.04620](https://arxiv.org/pdf/2407.04620)  
> 10. ml-zettelkasten/linear-attention.md at main \- GitHub, [https://github.com/vishar0/ml-zettelkasten/blob/main/linear-attention.md](https://github.com/vishar0/ml-zettelkasten/blob/main/linear-attention.md)  
> 11. Transformer based on a variant of attention that is linear ... \- GitHub, [https://github.com/lucidrains/linear-attention-transformer](https://github.com/lucidrains/linear-attention-transformer)  
> 12. Linear Transformers as Fast Weight Programmers \- Emergent Mind, [https://www.emergentmind.com/topics/linear-transformers-as-fast-weight-programmers](https://www.emergentmind.com/topics/linear-transformers-as-fast-weight-programmers)  
> 13. A Swap Is a Reflection: The Delta Rule Behind Qwen's Efficient VLMs, [https://pub.towardsai.net/a-swap-is-a-reflection-the-delta-rule-behind-qwens-efficient-vlms-0634540426d6](https://pub.towardsai.net/a-swap-is-a-reflection-the-delta-rule-behind-qwens-efficient-vlms-0634540426d6)  
> 14. DeltaNet并行化处理的部分关键推导 \- CSDN博客, [https://blog.csdn.net/m0\_73678693/article/details/145387311](https://blog.csdn.net/m0_73678693/article/details/145387311)  
> 15. Curvature-aware Sequence Modeling for Linear Recurrences, [https://www.alphaxiv.org/resources/2604.21100](https://www.alphaxiv.org/resources/2604.21100)  
> 16. Gated DeltaNet: The “Surgical Eraser” Solving Linear Attention's, [https://pub.towardsai.net/gated-deltanet-the-surgical-eraser-solving-linear-attentions-memory-problem-1e50ca3e42ab](https://pub.towardsai.net/gated-deltanet-the-surgical-eraser-solving-linear-attentions-memory-problem-1e50ca3e42ab)  
> 17. Comba: Improving Bilinear RNNs with Closed-loop Control \- alphaXiv, [https://www.alphaxiv.org/abs/2506.02475](https://www.alphaxiv.org/abs/2506.02475)  
> 18. Short Convolution (ShortConv) | Sebastian Raschka, PhD, [https://sebastianraschka.com/llm-architecture-gallery/shortconv/](https://sebastianraschka.com/llm-architecture-gallery/shortconv/)  
> 19. State Space Duality (Mamba-2) Part III \- The Algorithm | Tri Dao, [https://tridao.me/blog/2024/mamba2-part3-algorithm/](https://tridao.me/blog/2024/mamba2-part3-algorithm/)  
> 20. Gated Delta Networks: Improving Mamba2 with Delta Rule \- Liner, [https://liner.com/review/gated-delta-networks-improving-mamba2-with-delta-rule](https://liner.com/review/gated-delta-networks-improving-mamba2-with-delta-rule)  
> 21. Gated DeltaNet: Adaptive Fast-Weight Model \- Emergent Mind, [https://www.emergentmind.com/topics/gated-deltanet](https://www.emergentmind.com/topics/gated-deltanet)  
> 22. Test-Time Training Layers \- Emergent Mind, [https://www.emergentmind.com/topics/test-time-training-ttt-layers](https://www.emergentmind.com/topics/test-time-training-ttt-layers)  
> 23. Test-Time Training (TTT): A New Approach to Sequence Modeling, [https://keyurramoliya.com/posts/Test-Time-Training/](https://keyurramoliya.com/posts/Test-Time-Training/)  
> 24. Adaptive Compute Allocation for Code Generation via Test-Time, [https://arxiv.org/pdf/2601.00894](https://arxiv.org/pdf/2601.00894)  
> 25. Rethinking Expressivity and Efficiency in Test-Time Training \- arXiv, [https://arxiv.org/html/2608.21308v1](https://arxiv.org/html/2608.21308v1)  
> 26. Titans: Learning to Memorize at Test Time | by Anbu Valluvan, [https://medium.com/@avd.sjsu/titans-learning-to-memorize-at-test-time-271e9444e049](https://medium.com/@avd.sjsu/titans-learning-to-memorize-at-test-time-271e9444e049)  
> 27. Titans: Learning to Memorize at Test Time | HP AI Creator Community, [https://community.datascience.hp.com/ideas/titans-learning-to-memorize-at-test-time-280](https://community.datascience.hp.com/ideas/titans-learning-to-memorize-at-test-time-280)  
> 28. Titans: Learning to Memorize at Test Time \- The AI Timeline, [https://mail.bycloud.ai/p/titans-memorize-at-test-time](https://mail.bycloud.ai/p/titans-memorize-at-test-time)  
> 29. Titans: Learning to Memorize at Test Time | HP AI Creator Community, [https://community.datascience.hp.com/artificial-intelligence-62/titans-learning-to-memorize-at-test-time-281](https://community.datascience.hp.com/artificial-intelligence-62/titans-learning-to-memorize-at-test-time-281)  
> 30. Titans: Learning to Memorize at Test Time \- OpenReview, [https://openreview.net/forum?id=8GjSf9Rh7Z](https://openreview.net/forum?id=8GjSf9Rh7Z)  
> 31. PyTorch implementation of Google Titans: Learning to Memorize at, [https://github.com/Aedelon/titans-pytorch-mlx](https://github.com/Aedelon/titans-pytorch-mlx)  
> 32. [unknown\_url](http://docs.google.com/unknown_url)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAaCAYAAAAJ1SQgAAADbklEQVR4Xu2XS6hNURjHP6HIK++8IwPyTkTJQBIDBhgoDMXAyDMyOCWJgYQi1M0AiRhIFym33AyYKVFIJELIUAr/311rsfc6e++77+Oca3B+9e/cvda+e6/vW+v7r7XNGvxX9JbWSWel/dLgdHfPMlDqFzd2ga3SEnNBH5BapeGJ/iFS38R1p+GhK6T10nRzLyxirtRkbgDdAYlrkc776ynSe2lVuEEslC5aJ9/ZS1oqPZKapY1ed6UX0oJ/t6YYL92XZsQdYoT0QPrt9U2ambrDbI/vC3onzfKa5O8h4QS73F8HNklnrIMzzM1HpNdWHRR91A0DnRf1kaDjUiVqj1kjfTcXTCXd1QYJeyhNizs8e80lnRlP0l+6Ka2N2nMhmNPSV3NLIwsy+0U6ZS7AALP03P8WUTFXg8zaM2l0qtdsjnRO6hO1A2O6JA2LOzwbzCWq1HLeJv3yv3kMlR5LT80tzQAZv2XFxjTAXO0xeySL2WWASSiXHVEb4AWHzT2DYEelu9ugnl+aM7NCppqrhaxsJwnBvpHG+DYCJFC2hSIYDLPG/YulH9Jtc0swQAnFg6Vej0oTzb1zs1WXGJCIe9b+ONqWF5k+FLXHMOAPlg6WX65Xh5tywEF3+78JkEAJmMCBRF6xdLJJzA2rNi5WRxYXzDlzssRSBHtnCccuF0M/9+Gsg3zbfOmjVc9ITMXSz2cJM/hQ//gBnpFVr2WhnFqs2sD+EmYG4+GFRZywaicl2Lf+N49Qr+MSbcwgZcNMTbb8eu0IBEuZsUoyCcEml2YWE8zts58tvZeWCTZZr0kq5pK33bLrtaMQ7Csr8B1cFXctCpZlts/cwHZGfWWCZX/l/2OCMVIGdyzt8J2h3WVMjVyWflp+ZtnjOExwqIhPKVlHuJiKZfsBSQzb0DXrWr0CBosjUza5cCIimCarDmaZ9Ek6ZultIhBWBoeFLEaam7XZcYcnbEN5/18WEocT4yvtwt7FpsyZOJyHm6Un5gLOs3PaSVL8EjZ+npXcNk5a9ccECbxu+auqLJgS76NkSsFAcGS+ctg3x1p+kEnYRnhRrgvWAVYI7o6z1xQ+BVullXFHnWBCDnqVmZwuw/K5atl1XWtwdYyJo2VdIKMcB1FdsuvBUPGM0p933QUv3iUtijtqyBbrufJp0KBBDfkDy6+jpxoHidQAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABaUlEQVR4Xu3UvyuFURzH8a/8iPwqPzZKsigbJWUwyWRAUZTBoAwGkcgqKcqPwWwzMMlgQUYmg0UJ5R8wGP14fzr34Tyn+zw912LgU6+6fc+55z7nnO99zP58qtCHftTmavVojCZkSSlWcI9ZzOAaG7hE+/fU9JRgDweo9Op6oitcmHviTOnBEzrCAbKMnbCYllU8oykcIAsYDItp2ccHllAcjLWhLqilZszcYvKGM0yhxp+UNbrJNXMLRYvKjeXfeqZoi2qBdbyYW3DaGy+y+G3Hoi/rTDQpzADesejVdOsnltAmrdg112dhOvGKca82Zyltois/Rnk4QCZwh2a0YBsP5hpYi5ZFE6Oov/Tr3UFdW9fhD3u1Bpxbwt9K+z7CPG5zn9UOW3jEqMXPshenqPZqX6kw9wSKWqMLI+beGPm2rVtNPK9Cogs6xJC5M5yMDxcWbVfb3zT3morecz+OFtR55evJ//xmPgHIbDZ3AARizwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABGklEQVR4XmNgGAWjAAGYgdgYiO2AmBUqxgjE+kAsD1OEC4A09AJxKRCfgLJBAKT5ExDvAWJuqBhW4ArENUAsyAAxYCFUnBOIFwDxASDmgYphBalArAnElkD8DYgjkORsgHgyEh/kVS4kPgpoAOInQKyIJBYExOlIfJDh85H4cABy/mkgXgPELFAxUCA2MEBcBwNzGFANhANJIH4IxOVIYiCX9DBADDRggNj8HIg3A3E8kjowEAfiu0BcBeWDYqYTiA3hKiAu2Q/EIkhicABybhYQvwTiRUC8A4gDUFQwMEQD8VIGiFqcgIMB4h0QjQ4mMeDwPzEAFMj7gNiUAeItb1RpwgCUqFYyQGKliAGR3EkCoETEiy44CqgAAO2iIokGeKN7AAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAaCAYAAABRqrc5AAABOElEQVR4Xu3TPSjFURjH8Uco7y+xSRIpE5LNyGRjtColCyVlkVEsbEaDTWRQolBGq8kkyWYxUvj+7jn/23Ek5ywG+dWn7nm5nPOc55r96VSgDS3xQmrW8YJ3LEZrWZnEK0bjhZxs4w4d0XxyGnGFY9REa8npxxOW/VhF7sM4aotNP2UabxhDNdawgSPLKHRRjx6sYtDcl5NfqxXXuMGOuaspus4C6v1YqUNlMC6nqMezudPoKk3hBp9mnGA4XlDC/ujFLQ7t6ysNmHvB9mi+lLg/ds1dT9ecwAyWcIp7bKHT7y2lAZfYR5Wf0x/RWE+7iW4/r3826z9/ShceMR/MTeEBB35ePaNTnWMk2FdOsSGuuE4Y/ppV/Av7ph6pUTPumWvEOXMvlR21/xlWMBStZUVNp5P85zfyAfOFMam8hmweAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAaCAYAAAC6nQw6AAABYklEQVR4Xu2UvytFYRjHH6H8DNEtgxQWGSShKxmUwWBhFIuk7IhsZuXHYmC4A8o/QAjlL6BMNovBJjufp/cc932fzjn3bgY+9Rne533vOc957vcckT9JNY7jNLaavbIZwnNcxAV8xJngRBn04Sk2ebV1vMF6r5ZJLR5ij6lv4j02mHoqeVwzNb34Je5ihdlLZQvHsAbbsRlnxc2o0zuXiT7/AY7iG35FfuKwd64kXbgjrn3tRDuqw208w6ri0WymcMkWxeVIO9QbxegNKr11wIa4/Fg0Px/YH601Fjr8wZ8THvF82uwG7OOzFPf0gg/eOkDb1iQ3mnoHvoibk8ZgFa/wFfei/QCdzzuOeDX94RFeSJhy7XDZWwdofubFpbeAx/gkrgO9YEwL3kryLIP56D+RE/e2J6W4F+8kYz5xfkoxhyfiPjErEj5yan6SmMRrcS/xgNmTCey2xQx0FNrRP7/FNzhFMAFJpf+KAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAAAaCAYAAABvj9h3AAAEjklEQVR4Xu2ZW6gVZRTH/5JFV7ooSWRoF5JSzNDCoBfDB0WK6KUiMUiilwoSL+SLB0SQSMt8iQojIUpKeqioIGpDUVEgCElSSSVSWNSDUA9G6Pq55mvP/s7M7LmcOReZH/w57vlm771ca31rrW+21NHRMfm42HR+fLGjVS41nRtfrMMi06vyD8yDL5pvutc01zQtuXZ96p62IcmuNJ0TL0xRbje9rmK/D2W26VN5cPK4y/ST6QXTQ6a3TPtN+0yPpe5ri2WmP0ynTB+bLhpcntKsNr2omjuRXfS8aSS6nuYe0/caDDDv22r627Q4db1NSLRjpm3xwhTnAtO7pvvihTIsMB1O/mbB1v7K9Hi8YNxm+tI0M15oieWm/+QJdbbxgOkL1Silm0zvK394udP0r7Kzg523S74bx4PNpj9NN8ULZwHXmX6U+7s0BI3g4Zg87pb3nU9MV0RrvL4hutYWwdaefJCBGaaVpquS1xPJNXJbsCmAXQwpZRKcnk5vL4rFKPiCX+RByuNaed8hiIhySw8ar8AFyNDf5EMU4Cymt2dM72lihxqm8pdNO00H5UEMATlhuqV/ayGvyf9PZQJ+BkrgcQ3ftjjrd/WDiE6qOPBjTeh/OAs9arpV7qCJnEo50uyRB21EviHYGAThQdNfKj/k0c566leYofDBR5O/ZZhlWmv6Vh7EuHeep5qjsNwRa5Tfi9n1/8idhWNwEEF7ynRj6r4yNvBeHI6jyyjPJlgitycMe2+Ypidrl8uPWfgNOLtemPw7CwL4jfx9pRgWQMb2rMzGoO80mC0YjfFVd+U8+QhNGewpO/tC/2PXk9Fvmm4euMMpa8Nlpu2ml0qKCjSMO+QJxjQZwH+c70ICsMbDkjwI4BH1Az6UogDijN3y3hODk3umt9XPNr6UI0XdCRGn95QdwPT5jzPTK/LST/DTNLWhCdhGj077a4XpkdRr7C566FG5hPJlvyo7w66Wl4QsZzDA/Kz+0YKy+o7cqWTYwuR6FYoCGJ//uJejDb2bEsfwgGOa2tAEBpCeBivSs/IhMDymJMBUm4eTe2JIgkr9nAP4IWVnRTj/Pa3BqSjsAEpLutfwGWFCrENRAMnMdHZzb3h9fyJoakMT8MlnpkuS1yT3E/3lMxuBx5V5Dz3wMRNoJft5E5mR9aYNpufkZfKAaaPpSXnv4/50lpBt3Jc+7BOILRrdT4L4rFB+IS+ANH4GgQ/lyQNz5IMUfZOhhgEiy4bxhF32g+kDub07NJjgPD8uOiIwuHytGk+ZaKy8MZ586C8YwBfOlY/uODmrwZJVZFdWuS1LXgCBa/EkiG18b/hVYixsaAq2ME0zJMWQ9FmVLsAQxOag5FaCcfpzecOtC+X2I3n5WK0aRqg4gGUYCxvags3BkyyeHXN2XTW4/P8PAyhvhxbCtuXnoVCiqsKvFD15v6yaCGGkZ3rkl4298nJUlSY2tA1+payOmNZp9DmVoZDhhdZQC6JOz0O1MkBe4uIyN95MBhvyoLyGAScNwWQOady7+aD1pqXxQker8EhwslWMjo6Ojo6OSctpCrnPjm91Vh8AAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAbCAYAAACeA7ShAAABMklEQVR4Xu3UvytGURzH8Y/8iEEGPwvJYJAyGRWZPIPFQrEZLDaDxF9hFBkNlEGJiY3MBmWwWAwWZVO8v77nuuc+1yMeZLmfetXp++3cc+65pysVKfI/6cQUxtGYbX09XdjHAWaxhjuMhH43BsL40/ThCpuoD7U67OIYTVjHaOhVjE3aku+iv6y3gkdMYgctUa9B6cLvGcSD/BXtwXHm8CR/0ExUT3ZtZ5vJrz7MCi9YLG8o7R3Kzy2JffFz+UYyKckn5FaR154xFtUW5F/8Xr7j4ainXtxgKarVYALXShfqQVvo21tshHEuNvEWe9jGBZbRjiNcyq+IXSE7Lzvf6beZFVKLDrTKdxbXbUfJNbDxqT44r2piF/cEzZhX/m5+K0M4w6r8Mv849gOo+idQ5I/yCnYFMUUnhiflAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABXElEQVR4Xu2UTytEURjGn4lZEEpJKTVSlB0LC8rORmI7ZGFpZeMLsOALyEozycLCWkoW+ARWNCuFRJJspJR/z3vfe8w5x8w9Zkip+dWvO/e85zbvfc7bBWr8NcP0kr5bPtLr+Pcr3aW95oFKWaVPdNBb76FntEA7vVqQJnpET2mbW4rYhHY/4RdCdNMbukFTXs386TMdckthJqEdzfkFkoXmvEbrvVqQFWhHY7QjNkMX6S2dpnWfu7+JedU7aBTrsXlo5su0xWyuhKR8u6ATcUzbrXXpvtG6L0lSvoKZCInJMAVtJJFy8ys00D36Rket9RzKNxIRmt8R6KHuQ/f2QzuV6HbobHGrSx+9p1tw85UM5dUf6Al0QgzyzCFKNxJ1coHit0Hm9Ar6zZDrCz2n89A4bGbwtZFfQc4kMd9qaKUH0IMeoONuuXoklm26RBdo2qn+EDnYZn+xxj/nA6gAR2WZTxGeAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAAAaCAYAAAA38EtuAAAD6klEQVR4Xu2ZX6hURRzHfxdNFP+kmVpqpJIPokTgnwySJAyMMEEEAwUDISN8kNJEC7k+9NBDIEklkakPkmBQEEqJeK8oFvlqEUhEIYGBBJFvmn0//PZwZ+ecsztnd917ue4Hvuxh5uzZme/85jdzZs169OgxcpgkjY8Lu8AD0oNx4WjlKemoDU+HMfqgtCGuGG3MlQakxVF5n/S09KH0sfSSNKbujmpMkF6VpkblMF06I62IK0YLmEk09ReUvy1dkOabG3FC+tQ8AlN5SNokHZP+ln6XHg1vCFgrnTVPYSMSIoTGh0rNtUukX2qfIUulG9KzQdkCc6MwJBWMXi8tk05aY6NJW5elV+KK4YSIe166In1tHmlM723SRmnO0K0N2SOdtvzAvGd5UyZLF81zOb9fleOWf2YMv/ulNDauaMYsaZ202vKdaRWm7n7pI2lKVFcF2oPJ+0rKY1OY0oPmgzstKE8lxegXze9h3UjiEfOR+cp8KrwjXTefQkDELaxdV4XVGZOr5Moi6DCdIhBCMkNjU8rKU0kxmpSFT8vjiiIel65a/cLBVPhC+tZ89X3X6vNfKnz3M/MFql2K8jBkAxCb0g2jywY/B4ZiBKMSm0E+/Md8MYn3rOMsLUJpyGHpsdp1kUhXKc/C6D9qnyF8/1fLm9JNozfHFTGLpJtWnND58i1zk9nyZGTR3nQUzRty3ny2NBIvIM0oM7rM0LLyVKoY/WZcEYNZd6XtcYUN1X1jngIyiKDvzQepGQ9Ln1hn9pplRjPwBEpsSmY0Ow92IFWpYnTToGPVxMyiGym7LT0XlLEdY8EkVxLpTwZ1RfRJ70svxBUtwL74T/M2x5DmmJnh4DPIP5m/KWaQombWPpuRYnSjNtVB7rwm7QjKMIc9Ly8G2SCwfaHhQPSHjW8Giy3br5QZ0IjMuKLZ94T5OhO+PKyS/pKeCco+MO9Tf1BWBkbzzEZbN3YbrA9JfcPU36RT0hHpB+ktaYb5+/yP5rsPDMumadUDlXnmr6vsp2dbay8QfIdZVDbItIl+vCZtlX6W3rD639op/Seds+J0RrSTav41HxB0x9zw14P7MljHBq34WYVw+MKPcEYQNoxyIimbalwPWOIIRvCsNebnCEQB+RZxTfSlQMQy8GUvILSfGYi4LoI+HJImxhUVyTYF/VF5R2AP+5354rLF8lvCew3mXbJq5xcxpBIOoNqFdMXs57PjcDQ5KO219jrbDi+bp7lwJ5QKU/xzyx+xVoVZf8B8wFpJg0lwttCpc5BWoGO7a6raSVJeuItqFVIda9Vw/PHQVVgzdkkr44ouwLkPp3aj3uQePXr0uB/4H4gbuQWqx9ZvAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAaCAYAAADYMiBQAAAD00lEQVR4Xu2ZW6hMURjHP7nkGiJyyyW555KSU4iSywPJC6Io4cWLWyLqFFKKkAcJ50mI4gFR6owookQRKbkkkniQFBL/f99e56z9mT17zbTnzBxnfvVvZvba++y9vvWt//rWPiI1alSA4dBOaHekPdBe7zc1punsDOkOdbYH2xhTodn2oEcmMZoMNUA9bUMVwY72g9rbhgxJC/ZQ6GL0WRKDoUZovG0AI6FH0B9Pv6HzUDfvvHIyB/okeu+bUt77pgWbzIQuSwmJ2Q46DNWb45bFop09ahtaCCbEO2ifbciYkGAzZseg7bYhjQnQ8+izEOwkg82gV4K5ojOq3PcPCTapg56JLrDBcHSuSmHTp1fmoA/QiHhTi8GK4TM01jZkTGiwe0MPoJW2IQkGmIFmRwrBADPQ5fbLJNxz5kQHnvSBFkIDot9pcFHlQM0T7UNHyZ84ocEmJ6EzoraSCh/0DbTINhicX5fbL5Nwg+3WCwaZnTwAXZH0BBgF3YP2Q+uhW9BDyd+fYoJNV7gN9bAN+eAf/gjNsA0G59fsZCVwfr0k0jpoCvRV0mcbS7QX0A5pzsA1ks36wyRlsgbNLgb7bfSZRCl+3Uv0AULkbKEQHOzv0GlohWjQGOBNolnr6CRqD44OolOdVYy/kDEjs/B/Bjs4LiHBLtav6a/boBOBWquXJeL8+if0BToHjYudoTCwZyVuiQwmg8pNCNsJP/k7J2EDXQjei7Nrkm3IR0iwK+3Xfn3dRTRTaX2j/ZNAf+iuxLOVweCzb/CODYJeS3y/4GZKsRRlI8za91LYi6utvmYHf4muM+zkIdFgXhIdhAZooneuXWt43Q+J96dOdPYUm+ks+16KDnQqfaGnEh95n1L8Omvor/79fZ9cFomwD3Z3y40abcQFlttr2qH1683y77UhsGRO26M0wenDTLA34qLD0og+6d6HfBMtt7p655Ub1sZ8B3Nd1EIIq4snoiUfF0wG0Pnw0ugcB/u3EXoMnRIt+TiTc6KJNAw6Ar2KjjHoXGRDcPcsasu+HLovuiOqRhgUmzmsODgr3ds/fm+U5OqCf4NvCweKTns/udKuTYLVDbfrtKBguBO7Ay2wDa0I+vAN0c3FKkl+X8Hz6Pf+DPCvLQbeh7POLzWDoKddkOap2trgq+Gc6MYlX9IwIFzEuONkvT5fmhfDfF6fBhP0GjTNNoRAb2NtTAXt86sQWo21Gwerk+MSr+9nSdzrh0Cr3QUFYHzqoS3R95Lg6G+FptuG/xgGi+/yD0K7JOyfAXyRxfcrJQe6LcOg0a9rwatRo0a18heG3ruEy28IqQAAAABJRU5ErkJggg==>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABBElEQVR4Xu3SP0tCURjH8ScoqUEoLKNNwSXE6AWETYGLENLoJtSsg9LiiwhcWqSppXAWh5oKaWmwJV9BL8FB6vt4zo3HrlwjGu8PPsN5nsO5588ViRMnnBVkcIoi1ua6S6KTO7jFGdq4x4adFJUSnrCFVXELvWHbTopKCxOcI4WCZ5OQiGOdYIpPb4Ad0w92VTa1UHJoYiRukYbp7eIZ+6Y2i16SXtY70r6m9/CCCz+uoYcPdHHg67PoymPfCG78EK/idhREF7sy4+/o29fFffEaNxji2MzR89+hYmqhrGMPmz8b4p7yQRac/7c5Qh9JVJGdby9PHo+4FPfD/Sl6RBXnv/MFtjQjv3acfHsAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABmElEQVR4Xu2UPyjFURTHv0L5VyIpRb0iJUXIaGO0KBO7ksEikRgoMqFkkTKI1SbEK4PBYFcGFpPRYMH3OL9b55337qtXz6B+n/oM757f757zu+e8C6T8B1roPf02vtEh2k4fXeyJdv++CUy72DmtT2JRFqEPz/kAWYbGJnyA9NEbmnHrUaagm0lCT0gkz1gq6Aodc+tFGYduJptaMvQZhYvopdu02q0XZZR+0WOzJhVv0B3kJ6qim9BkJSHN/0BuIlnbgvZGEtnYCF2CFlMSIdE1dHLkOHZpl4mFRA30gHYkv0uijb7QLHQjafB8EvNFyFDMJDFPHa30i5aQ6AH6FUe0NYn10HdoEZ10H1qMp5FeQAuL0gRNIsnW6KSJhSLu6Cri49wPfUYugShSYRY6eWe01sRCIhmIU+SPcw1doJf0FdrbaP/k7KUHn9CJsoQipE/FjmUP8d7lIFN1CP2PWEKidcTHWY5erqJhHyiEVBs730Ha7BcNMjC3iL9fNmTkT6D9m4VO4J8gk3gFvSsHXKzshBslJSXODwQIUi023gwZAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAbCAYAAABIpm7EAAAA6UlEQVR4Xu3Sr2tCURjG8XdoGKiIIANBsAnCwGTSqk1YHPgHiE2MJotgdqAgFoPN/2BrNrWuLLtosYmI+x6O4Z5XL3faBB/4hMtzDvf8Erm7RFBBFk+qO0sGc/Twi7Jbn6cjdkIXR7w7rUoCS4yRRB4hZ4RKDhu0dKHzjBRqOIhdhvmOegd5U8QIK+wwPX0XvIMuZSJ2D2YvgYmJPZ0Zwqq7mDTWaOvCL1dPKGGPqi78UsdW7GX9K318i73hwJjX+SU3nJBZlm/MO2/iE29iJ7w6I1Re8CP2ZgcYSsByzB8aWOADcbd+RP4ASKIkGi8vM6QAAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAaCAYAAAC6nQw6AAABKElEQVR4Xu3TzStEURjH8UdSGCXS1CxsJikWJFlamKLmb5AtZSUlhSVL5WUtWWApG4lCWSplYWXF3kZZWfD93XPui9vcqZGazf3VZ3Huczovz5kxy5Pnf9OKccyggBYMYhodiXl1040TLGMdT9jBFg5whvZodka08yYm/biEV5xiBO+4Q5evZ6YXGxbvOIoPzKINcxj2tTCd5lpRN1rg01y/akVtuLTsehBd8xAP6EnVwujE9+hLF7TDPubNFZ/NLaZFFb2aarr6Cq7whl30+zlBqvjGNqbwhVVf0yZHGPBjZQ8LiXGUMh5xjHMs4cXcs1+gEk8NrnuDicS3X9Gxixa/RHocZgi3VqM/jUYvqpPrZ7Fo7up/ihp/jTWMpWoNR/9DnShPs/ID3zcnxrOyMrkAAAAASUVORK5CYII=>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAaCAYAAADCDsDeAAADsUlEQVR4Xu2Ya6iNWRjHHxlikHHJJBTSaDAmyQcNiiIalxKfmPlAzZSiCUMzLrObSCm5fXDJ0Ch8ISRya0bNFKWEXIoUEvngi1Ao5v/r2evstd+zb+85w97x/uvXOXu9a79nvWs9z/953mOWKVOmTB+U2oqRYpxol7jWcPpWPBcvxCYxRxwRg+JJDaLu4qhYJ1aL46Jz0YwGUm+xwzwSZovz4qGYEk9qEHUVZ8Uvoo3oKa6J6fGkTOnFZrKpN8Xn+bEu4h/xa5iUqWXCosioXDRG1t0Tf0ZjDad+Ymr+J+phbgssvlGUEy/F6GgMK6NWtDZyQ4GcJDqZZ8kXYqLoGM1LJW7yk9gmvhc3xHqxVywTt8Xgptn1E157QVwU3aLxmeKt+DEaSyvuvV8sFivEFfOivlb8IQ6LDk2zU4iTWWm+yYj0eiC+NK/CRAUnmlarxP0UnDTvAsrpa/FUPLPi770Sr8WYwtRU4rnXiLH5z8FmDojh4ok4Zy3sRhaZhz8iHajEB8Un4hsxwzxlgtpbffrKadY8QolgIvm6edcQRCZeFrfEX2JUfjwn7pgXwDDGgRJcITLDIdKK8pzfiSH5a0GfWvGe1KSB4pFYnryQFxvOifKg71usKRmheC8enIvGgrZYIUgQgbPUqmchm1opW7EQsqzc9bKiV2Sx5VKM9oceGMuoJtKIFKuVXlY5Gthc7KpvNJYz7x6SLzr87XNWiPL+5tFZyXYQFrHHmvt6LCKbyI8zpaS42Tyx3XxBnPZd0Sd/nQfeaJ4G882N/bH5AvCjSvpKzEoBnUmlqkxE4YUcBOKgsYMlTTMK4vCZS5BMEL9beSsjEreKH8w3jHvyfKEGUZO4hm38LE6be/1mK3RWJcUC8SCqIx3BJSuYNzfnZjxUEJHAAdRDw8RVc+siwtmQnVZ608hAupzfxBnzNC53cBwqXr5BjDe3nmCLbDwFPs4Mnr+mzoSF8eVj5gtYaJ4SeNUh87ehsHi8i3Fan3qIw6Y1/FecELvNfbSU2AAKWn/zQ8FOylkdh0VQ7TP/fwXFkIOhBePvEPlBWEVcIKuKKCD9Q7VMfg4iZf622vz2Xeozq9wWJf02FOFd+d9LiWeNPT/5OYhnZw+q+m1acfKnzN/l54oBxZcbRmwAVhdH12TzWkEUt0ZYJBFONi8wt43/RUPNIwKrYLGNJmyDwkPBoeOhKFFHiHSi9o15p0OBaqn4Lh7Oq/aIxLVWi3RJ2sXHJny+VBHNlClTpkyZPjz9B4D9rXm1puuPAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAaCAYAAAApOXvdAAADeklEQVR4Xu2YW4hNURjHP6Hc75EiQyIeXBIll6KIhHIJSd6IhEgKD1N48KDcygtpFFJKEgkxoRAp5VLkgUSUF0XKA//ffHvNWfvMnGMfjXNG7X/9MnvtffZe67uuxSxXrly5/gv1F/PF0OIbuSpTB7Fc3BVrxT2xKPVEroq0VDwXdcn1etEoeiTXuSpQnXgjNkVjS8R7MSQay5VBpPpec+MNj8Z3im9iUjRWc3U0n9BM0bnoXu9WxmohjIgxz4lO0XhDMv63ERrWPld0N3fcKDFHdI2eyyyMdUjsEnfEwejeaPFJrIzGaiXm8EusjsZ6mjcnauqAaDyrCJazYpvYLZ6a22K/OCkuii7NT2cUntgjepkX9/PmXkNM/ruYnFxn1SrxrgIei5FNvyytE+YG/WCF331Oxi5YOmqziEjcJ2Yk14PFW/MMGCe+2F82uw1ivJhqbrw4Go9Y2vsYulvhdtXEohqtZSTicAxKp58m7ps3LaI2BAH71UvilTgt+iTj/cwDKUQgNvhq/k6ydo0Ym9wLYu0h2P6oeksX/L7ikThj7k2EsU8lf1dTIXriSORfoimeM0bhueKMWiHmFY0VC0OWa26Uh2tW+n5KIQLiCQeP4f0g0i6+LiW8jhGyMsjKN75gUOp8UGhSdP7g8PDcwvCQ+VaLnUC5ksDvCRQCiEBqTdiDyM9Uq8NE+HAQHvspposJ5h/8KC6bn1DKaZhYVgGLzVOwlEK2xPNjL/rS0t09NKngdAy11QqHgFhE3FGxztxIlBPWGJxDb+EewbFDXDev24ctw3GXCKH2hAnzsZuWrlljxO3ouppikcfMuy8iWl6IKc1PuFj8FStEMsHAyao18f8A1F92NbPMgydef4OlGyX9JEt2NokJbzdPIbYLRAMfiz1GxMb1tNoi6h+a180nYnb6drMwBGAUDFtqLznC/D2siaZFJL82X/9VS7+fDLllLWtzSeFZoJYSrXR86mdxx8/soX8k6iwZUq7TYkSya7N5JJcTax5ohfcVXwdVlJ3UIGoRk+CkQPE+Lp6ZvxzFHpooFiTj7VE4/Yf5Rr2tsilkJw7daB79JYUXOQ1R5DHmFvM9G40oiLRhw19vfqoo15FrLWrjA/P9Z1uJBnXDPPoJqLLCONRPNsVwwPzUVCzSgC7a3sV6yLS2Fu9sz4GUK1euXLlypfUbPjOnnuVnTxcAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,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>

[image20]: <data:image/png;base64,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>

[image21]: <data:image/png;base64,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>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAaCAYAAACtv5zzAAABgklEQVR4Xu2UvytFYRjHH0UR8rNQBgxK2SQDViwkBkqysTBbhL/BQEmZZBGTUhZlUFgMYjGQyGBDMeDz7X3P9Z6L5J473k99uuc857nnPO/znPeY5ciAPGzGHixOu5aYIlzBNZzBI6yPZSSgAFdx3R8X4i7OhklJGMEHbPXnatWGV8eJqMJj3MR8HyvBA6+OEzGK7/43og6vLQsrUMWq/B6bgng7vuBSEMuIGrzCN7wJfMIPHPtKzYw2fLZ4pVrVFj5iSxAfNDcrFXToz8W4j+laFEvRb98rbcRbiw89YgpPsMKf65WexF77ZVZ6gHqtnkdo2Ip1BzGhG2ifRKutxDlsiBJ+osvc+69WCe3mPXM7Or36ajw3t1q1bhlLYxk/oCGfmnuQKpzGfSwLkzwqQr2ex21zD9P//2QYz8wNVp+H2vjlFOr/HXaYu/GF/eMt024tTw8GpPdfLFqWdrqI+j8UxPTd0vz6glhGDOCOuc2o305zX9sFfMVLnEhl58iRVT4B005GeSpkFyUAAAAASUVORK5CYII=>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABc0lEQVR4Xu2UvytGURjHH0URogwoA++glDLIhFUMJgP1/gEWZFP8FxYlJUoWi0EpBmUgvYtVGbwpGWxIBny/7/Mc95zXRe9xB8P7qU/33uc+58c9zzlXpMoP1MBeOAYby95F0wDX4Aach2ewK8iIoA6uw027r4cHcMlPimEa3sN+e+aS7Ji8j6INXsBdWGuxJnhi8j6KGfhmV0cnvJE/zJgz5EzvYM6LD8FnuOrFKqIdXsNXWPR8hO8wn6RWxiB8knBm/Io9+AD74LDo1uMETkW/hrA2+/AKbsNWi5eYlK8z64G3EhZzQHTNXacO7qbxslgJdsy19BuwiIyNejFXTOY7ukX3uRs8YER0/3JJCE/foegJ9Bs0iy7DrD1zpyyKdp4Ki1cQHYDJc/AItvhJkpzEZXtm/lTyOh0mXIoWjI07wtefbJkclAPw636Fpyuoagrs7BguiBYzM7i+L3BFIk/jd0zAc9H9myn8nWb286/yT/kAR2I9w6uU+ooAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABqklEQVR4Xu2UTSiEQRjHH6F8hdh8FAeSIjfUEhcH5eDkQKQcHbgoKSdHR7kosXKQi3IScdkbSYkSF4WUHNxwcMD/vzOTmdm3bfddx/3Vr533mdl3Zp555hXJkYI82AoHYanXF5piuAY34Cw8hQ3OiBAUwnW4pdtF8AAu2IPCMApfYYd+Zkp2tGyHohqew11YoGNlMK5lOxRj8Fv/Gurho2SxYq6QK32BzVa8G37CVSuWEbXwHn7BJ8t3+AMn/oY6MD01MN/vMHTCD3FXxl3swTfYZsVJu6gdzoiaNA4nJSBdw5K8sib4LO5h8o9T8BBW6Rjh2FvYY8US8MXMJXNq4CEy1m/F2L6DLVaMmHpf9OLSJ6p+mRLC23ck6gb6pbekn23Mi7f9Dh7ehagJuF3m7gRWWGM4KSfnGJ8IvIFzfgcZgVeiDoyz17ndiXQx50HfDX/HSXC7lX5QMwQfRF0aG35T+G1ZkYCqSIdGeAl7RVXPMhwXVSX74qYtYwbgNdyEUXgG52GJpLgk6cKt87BZcjHdZplyon/BlBgv1rFk8fULogtOw3K/I4fDLyI3R/PiJlvvAAAAAElFTkSuQmCC>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHcAAAAaCAYAAACNU8MOAAAFNklEQVR4Xu2ZWehtcxTHv0IZk5mQrlDmIiRTxngg4kFdSslUZLhJ11D/G0rqZrrmKcmYwgOZyl88CClF5FLIUORFeUCG9Wnt5fzOOvucs88+53/+D/anvv3P2WufPay1fmutvf9SR0dHRxs2Nm2VNzZgC9MmeWNHczY3nWza27RBss0CgvqA6bBsaMDupuervx0TgtPeMd1q+t50Ur95ajYy3WO6JBsm4GjTi2q38mfFBaY/TP8Uut+0oWlVsv1lutl/pm1M7yUbC2kuLMiDe4v85Of0WaeHZFnUdIGhmqwzXZsNc2Zn0zemz03bJ9uupu/kvtwy2bj+u01Xy5NhLmxt+sD0sGk700Ga7ck3Nb1quiwbWnCE6TPTimyYI+EvAkygSyK42NmvZE/5Kscfc2Mf0y/yjFoKDjGtl59nWsKxK7NhjjDcLcqDSDADVuZqeeXLgce2xnR4sW1JYfrkAnAUPYBSzHcufpZcrPoyFTBBH1OJz1QNEuKo6nOGCvOklmboawJ+e9n0m/w6g/1MT8h7aw4u+xHcYdcc90wfZrBlPwZb2lmrlX6k6UHTh6bf5Q7j+6HlTjPg8Up1MMi9YLrIdJfpbdNDpmtMr5nW9nb9D3ruqGSZB9xPGVwGxtvkCbqYbCTsnfKyXAdzyFPyynm96WPTHfL55xG5f1o/BnKhdT1iFkQJ40IzZCQ9KG4aZ+CUBdOJpr9Nj2kw20/T4Mqo40bTtxOIuYCptgn4jPJ7avWdSZ6SzLXmwJ9uurL6nGF/Jmp+DzGsPW06UN4uF9WympL9rAKeIcm+4BTTz+ovf2TghervM+OI4NZNuAT1quI7jqKCUI4pTazmunMR3B9Ne2TDHOF+CC7XQpKy0narbGXgtzU9atqhsmVIphvUW5kMs7/KWyX+Ps+0b2WbmJjurssGeZmkXwbsS78bt2JKRgU3w+r+2rRL2p7BoTgARywXEVyCgEo/4bcIPM/FZxS2cXCs3Mtbwyr5U34hJZRo+h/2aWga3NgvV5A6mpZljsk+TcXqqhvg6iAIBPB2073qf36PwNNDWdFNByIqJG1oZi2SjKtbBTy2vCV/7gWC/JJ6PWaFfAg4Wz6YPSu/kfySgkARMFZ8hkrwjHwijMexMgloAXVvcXDsV6YdsyFxgPz6mop7axoIEowA/qTBt3kRXPwavXQY+IsXG7QgfP2p+ucMjo2tFZQQDhhBDHBgrCIy+lzTWfIgsu1yueO/lL9YAHpNrgDAOXh0yBMfmY0TKF3nV5/j90zRPFbQszK0kLrjzRMSget9Tt4bSyLwJPS4KhTHWWs6Tl5FI8EJPD4dNmWPhKHlTdWXwrLf0vR3kmcUQWffvSp7ZBkl8HX5lJthWvxEgwlENWDsZ2jjODfJE43xnyrBas5EJRhX5pcaeiITdl1vJLg/qFlQGAo/kvuAe2aqXi/3wSum43u7TkYMU+UwAHX9ljL8bvUXoj8QbNhf/pscQOA3vIet698kBaszylD+nuFYvH6MarFckPC8D6i7TmwH540joAKV/T5/bwwXQ3a8IZ/iCC6BKYl+y6uyM6ttsUpx6rHyBOAYkbmsJKbdE+QP8iWck1W5rvo8DbQHWkMuhR3yjPhCPpEx5d2nwZJMv6MkrFHvWZK+yPCzWj50MICxTwxQq+ST4xWqdzxVgoThFV1bWNGcs83/g/8XsHIuNb0vn9LydBtQGvLAwguPKBX83aywQbwTHQZBYQAZds5RcNwFeRKNOkfHMsKAwOqeFCZzHgm6wHZ0dHR0dHQsK/8Cg+IB/Msv99sAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAaCAYAAAANIPQdAAACGUlEQVR4Xu2WTShmURjHH6FGKR8jEvKRIWtKCisbCx8NhWymLEZjVqZmNmMliaWNEiILFnayf8uShaZ8RAopK9mMBTVm/v953jtz3Pse732Ve6P7q9/innPf957/Pec594hERLxI0uBbmOvueC2MwTv4G064+sIiC36Qx196LZyGc7AHpj/s9tIGf8FOd0eA5MM+uASv4RksNm+Ikwm/w21YD6vgBhw2b0rEN3gp+oOwYMgu2ADXxB6SYY5hRfy6XXQVLjs3JOIN3IQxmP2wKzQ44EQhy0QDzhhtOaIz22i0eSiBp3AS1sBu8f550NhC9ovO2qDo5LDf18SwHu9F/3RcdDkcwffmTQFjC8kZZEiOcwWOwF04JVqrVliP3HS4QznwITGxv6UBeJ6CO7D67y/9YQvJdoaMyf+xvRPdT77Erz1kwHXxBrI9JChsz3dCfjTaOO4Y3IMFRvs/nHo0CzlPdHs+gUVGe5DYQs6Lhuww2pyQN6KfFA9sZKdZf3XwCq6KznQinKL3K1/WozXjwhZyVJ4YkjVjdn6Gt7DFaHNTDntTkN8/fgf9YgvZJDo27q4OSZdrJTyEzfFrDv4AfhU9z4YFQ17AUlc7j3s83XDZOqss6cbDIJ9Ed78F0YCcyaTnwGegEG7Bn6JLknLXZ1jzyMZy2oeLcAj+gLPioxxYY6nWTZhwnK2ipcADTJirLiIiIiIi4sXyB32VeAMrjj2tAAAAAElFTkSuQmCC>

[image27]: <data:image/png;base64,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>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABQUlEQVR4Xu2TsStGURiHX4XoI4pCWRiUyCIbqywWBl+xGSzM8m9YlJRJFmVSZGBTsvgDDKRksGEw4Pl951zOuW7HVSZ56ume+563e857znvN/iR1OICTWMnNfUszbuAWruAZ9kYZCRpwE7f9uAkPcDVMSjGH9zjs31XKjlfjJB14jrtY72MteOrVOEkVX/0zowevrcQOtKJWvsP+ID6Gz7gexArpwit8wZvAR3zD+c/UYkbxyeKVtKs9fMDBIN5o7oYipu3rSn14a/GhZqUqP0IB1aqaM3SYik0EMZWqxgp3VGPc3P2rFKFuPDTXkdnqi7jv89RoIz5eQ1++MPchXdcyHmNbmARLlriRWbw0d3Bq3+54+uNQZ3LxCHVbez7o6cQTK6i/LCrvCFtxwdwt/Yghc//EGk7FU+XR7y3/+W3eAWPRNZb8u3+tAAAAAElFTkSuQmCC>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAZCAYAAADNAiUZAAABdUlEQVR4Xu2VsStFURzHf68o8gqZhHqkZFAKA7NspLxB/AeYWZUMpJTRZjAoq4n0ZjaDxSBS/gFG8f32u/f1u8c516H3Ft1PfYb7O+ed7z33vPu7Iv+ATngAl2HV2GcnNZp+eAefE1/gPayYOQ1nCs6Z6/nEH6mIPp4QI3AfHsMV2J4drjMM12HJHUgZhWvwGn7Ak+xwnSXRxzUOy3AHXoqepaUVHsJBp56BoYtwRvQcfKED8AGumlo3vIUbpkam4Rlsc+peeuGT+EMZ9g4nTI2P7hTWRHeesiX+NbzkhR7J91DCua9wKLlugeei86PIC2UtFGrrHfBKdLdRhEL56GoSF0q6JPI8SSg0vXt3ceIL/RWhUBJaPFSPJi90V/yLcy5fM7bAP5EXuiDaOGZNjed2kRh9hi5pKN+9kjPWA2/gtqmx1XGXeW0zCO+eP+ZOPhPfRL8YY2beJHyEm6KfLHajPdG211T4T+aXhG2TrbGgoKC5fAHpTVCtIuUF7gAAAABJRU5ErkJggg==>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAABG0lEQVR4XuXTsUtCURTH8RMZGGkojQohhtBUi5tjTW05NvQPuJSgg4E4ik1tja0RhUN70BK0NjU1RFtLY0H1Pe/eG+8dX+jU0g8+4L338N659/pEkplDG3com7VEtLCDc+zhFquJilg20MOCH9dxhPmfij+L9r2Cgl2wGeIdXzg0a6nZxQcadiEtJ3hCycxPJC/ubK+RNWsTWccrun6sm61hG4uhKERv7RNb4i5mgBHGkrLh0G8VfWyKK0o9nZmLi7jHA07F9a/Rng+w5MdRwubexD1d+12OF8QTv4w1POJKfjlCexln4trS9naw7+clhxtcIOPntFjHer7HqPj56Gt4QStMkCaecenn9YKi6A99nf0i9I1T/6r/N99EMi/mDpa84QAAAABJRU5ErkJggg==>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAZCAYAAADnstS2AAAAc0lEQVR4XmNgGPogEojfAfF/JPwFiDOQFSEDRiCeD8T/gNgFTQ4DCALxaSB+AMTSqFKYwBiIvwLxGiBmQZPDANEMELcWoUugA5h7fwOxDZocBoC59y4Qi6PJYQDauJf6QRYLxM8YUKP4FRAnIysaBYMUAAD9Px2F6V8OKAAAAABJRU5ErkJggg==>

[image32]: <data:image/png;base64,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>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAaCAYAAADCDsDeAAADvUlEQVR4Xu2ZW6gNURjHP7nkfk8JnVwil0IueeBBUXQi8YAoDzrx4MW9XI8HDy5JnpCIkmukiAexiyJKHiiROiSSeJA8kMv/35p1ZuYzM2vtvc/e+zhnfvXvnJlvTTPzzVr/9a21Rf5PpkKvoHodUHSANkIPoaEqlpPAdOgJtBAqQItj0RAmdgt0EVoB3YPqYi1yYvSADkjYC/tD+6AhzS1CJkLboc7B8TRoB9SxuUVOxegELYd2RrQf2hU5XgV1sRe0FD2hrvpkO2CtmHdPgj2+nxi7KZlJ0Cmojw60IpiAQeIe4kzEAKivDqSQlVw7Oa4P/i8aetldaLwOgFHQU+hPRL+gC2K8sBrMhj6Jufdtyb4vvfiHmLYbVCyNrOQS+vcZaIkOuODXOAw1qvMaztJ84CM6UCXYAd5Be3UgAVYSP6GZOpCCK7lkAvQAGqYDWfCiF8HfLPhSTC6TXAvmiBkxPvdnB2iS5GoiCZ/kciI8J+5OGGMrdEOyJzLeuAB9gEbEQ1VjG/QZGqsDil5ialvXO0XxSS5h3fxYzATnhDfnQ/DBs2BCmViX31UK+5wFCZPACWs+NDg4tjD5/AjsNIS2NxqaC3WzjRS+yWUN/UZM7eyED8bGC3RAYf3Wx+8qgf241u+Z1LNi6tPrEv/g7F2/xdgIJ6I9YhYg1yR9gvNNrs1X2uowxhToo7iN3/otX6oWWL9dFKgBmgx9lX9Hk/XbkdBuMSUmk1pM9ZCGtUc7KjJhct8Gf9MoxW9ZX/Ir+8inx/DjfodOilldcagzoaw9OeQt9EJ64jPomIT+zDZsW66l2Vx4jWCf5Bbrt/THzdBxT602l6Vi/Za16xfoPDQu1iLE+i17dJMYS+gdbVAmNrkn1PlEfJJba7+N1reckPhitLIx0UYB0fqWi5+X0FXxrxpcFGUL7JXvJdtLW1t9y8nXJpC2ckjCTRZd356WsHSqF7MhUw7Wdry8eyD0HFqjAwGl+G1Lw14SvT+Ta4+XBiL2WS+LKfgJk8tj9viD0PDgfKlwFL0W88GdcGLgZo1e0nIC4Ma0XaNT38SUP90j7SoNN2i4h3FLwhq1TsyExRKME5zdaOJ5jsJ1wTHhXgAt5UpwvqSNlwgcLeyMvis/WQY9Es9VRw1gj9SeyfqVoy66O8bE8R30jhmv990dc9EoZglsR4YTrnTuQ/N0ICcG83QHmqUDLjhZXJL05WGOyEroqIQ/H3nDIcXalCrXl9oiLOtuShk/dPKLbIJm6EA7h7tsLEdZKeTktGH+AkvBslvNu7zZAAAAAElFTkSuQmCC>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAABG0lEQVR4Xu3TIUtDURjG8XeooEwUNmxahmVgUxDbkiytKDjQZhAMpo2hWEUEw5jBbLOY7DKMWzJYBEHBL7BgnPP/eO5113f3Ewwf+MF433POPfecO7OxyCxK2MR8VMtjIR7gM4VTvOIIh+jiEo8oDocOM4lr3CKbqOtJHbQt7GQkG3jHim+QE7R8Mc4ZPrDoG6SOii/GucEAx5hwvWXkXO03VQsTpY8H7GMuOSgtOtFzC5PiBeTJ0rc/Em1Tx36BnoXJB39GRNFAvUPGN0gZX2j4hlLAlYV79FnFJ3Z9Q9Ex32PaN8geXrDkG4ruT6uuu7q2r4PZcvWf6BO6Qw3P0W9dQRNv2LH0d7cZCysruo41bFv4Z6Rt/T9jlG+J/Ct4t2V5pAAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAA9UlEQVR4Xu3SoYsCQRTH8ScqKOqhGC+IeAjX/AMuarJpNPgPWLQYxSheunbRfigGu2C0mkwGsVmMd3B33+fOwDK7cggXDP7gAztvht03Mytyk4kgj6w74WaET/yg58yFpoEvvLgTYXnDDo9OPZAMVlgg4cwF8owj+masmy2jhqRdZNPCN6qIY4gx5hKyYdtvCQNUxFsUOJ0c1tjgXbyWNNpGFykzPsf2exLv7drCg3+BP1ct9l/GE7aYyYUjdC9jIt4edC91tE1d0ljiAzFT08U61vN9RdHUpYADOrZAmthjaup6Qefog34uagsm+sU/f9V7/j+/q+oqHbeR1QMAAAAASUVORK5CYII=>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABTUlEQVR4Xu2ULUsEURSGj2BQ0KKCQcNiM4pY/ACDRo3rD7CYLWrbYhBEMBtFLEYFEYN/wigYXDaJIGpQ/HjeOfeye/cDdwymeeBhhz2HM2feubtmBf/NLNbwO3iLI0lHyjJ+mvfq8xqHk44m9rGKDzjeVItowCk+4xn2puVWBvAYD/EVp9NyRg9u4A5+4WZabs8EHmHZ/BFX0nLGlPngbfzA+bTcnlXzTWbwzVq36ccKjuEF3uFoY0MnKriEk/iIu0nVbM28rsH3ljNfvTBtoW1OzDMVJdwyH6ThufPtM7/JTVDXGqahJW/NrnPnK7Slto0ZakPFIHTjP+UbUb7KeRH3zF+cUFQ6413nqwOvOCLKTydDA3TEIrnyncNzHGz4TmdYZ1nxxBco9CS/5ruAT1b/f3jH9VDTr+7K6r//A3wJfbH3EodCvaCgoBt+AHZzRnAvsxTcAAAAAElFTkSuQmCC>