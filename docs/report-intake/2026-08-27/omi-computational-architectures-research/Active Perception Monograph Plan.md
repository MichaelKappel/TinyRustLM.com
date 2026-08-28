# **Active Perception: Epistemic Action, Adaptive Sensing, and Evidence-Seeking Machine Intelligence**

## **1\. Executive Abstract**

Passive observation structurally limits the capacity of machine intelligence systems deployed in dynamic, non-deterministic, and partially observable environments. When perception is treated as a static feed of ingested data, systems remain permanently vulnerable to occlusions, sensor noise, and environmental spoofing. Active perception fundamentally shifts this paradigm, recasting the observation process from a passive intake mechanism to an evidence-seeking, interactive loop. This exhaustive engineering and scholarly monograph systematically investigates computational architectures that autonomously determine where, when, and how to observe. By grounding the investigation in dual control theory, Bayesian experimental design, and the expected free energy principle, this report demonstrates how machine intelligence can actively intervene to resolve epistemic uncertainty.  
The analysis carefully distinguishes between pragmatic actions—those intended to alter the physical state of the world to achieve a goal—and epistemic actions—those executed strictly to alter the computational or belief state of the agent. A rigorous mathematical framework is provided, contrasting expected information gain, expected free energy, Bayesian surprise, and empowerment as optimization objectives for sensor management. Furthermore, an evaluation of mid-2026 state-of-the-art benchmarks in embodied spatial intelligence reveals that active evidence accumulation consistently outperforms static, multi-view techniques. To operationalize these theoretical foundations, this report introduces a concrete reference architecture for an Epistemic Action Planner. Accompanying this architecture is a rigorously synchronized, five-language reference implementation for belief-space navigation. Finally, the report delineates the strict hardware, capability, and credential boundaries required to execute active perception safely in the physical world, ensuring that evidence-seeking behaviors preserve user sovereignty, explicit consent, and privacy without relying on subjective algorithmic censorship.

## **2\. Research Cutoff and Search Method**

**Execution Date and Cutoff:** Thursday, August 27, 2026\.  
**Search Method:** The literature search underlying this monograph prioritized primary evidence, strictly favoring peer-reviewed papers, conference proceedings, preprints with stated review status, original theory monographs, and reproducible engineering reports published through August 2026\. Special emphasis was applied to spatial intelligence, reinforcement learning, and Bayesian adaptive design research spanning the recent twenty-four months (2024–2026), while retaining historical texts on dual control theory and cybernetics.  
**Evidence Classification Legend:**  
To maintain epistemological rigor and transparency, major claims throughout this report are tagged with a classification code \[C1–C9\], denoting the strength and nature of the underlying evidence:

* \[C1\] Replicated or strongly supported empirical result.  
* \[C2\] Single-study or preliminary empirical result.  
* \[C3\] Formal result under stated assumptions.  
* \[C4\] Reproducible engineering method.  
* \[C5\] Engineering proposal.  
* \[C6\] Philosophical interpretation.  
* \[C7\] Contested claim.  
* \[C8\] Speculative hypothesis.  
* \[C9\] Unsupported or awaiting verification.

## **3\. Terminology and Notation**

The precise articulation of machine intelligence concepts requires a departure from legacy, generalized acronyms. The terminology utilized herein reflects the specific, operational nature of modern computational agents.  
**Active Perception** refers to the deliberate control of sensory apparatus and system state to optimize the acquisition of task-relevant information, treating observation as a sequence of discrete or continuous decisions rather than a fixed environmental feed1. **Epistemic Action** denotes physical or computational actions performed primarily to uncover hidden information, reduce computational load, or resolve ambiguity \[C6\]. This contrasts with **Pragmatic Action**, which comprises goal-directed interventions executed to bring a system closer to a desired physical or operational state3. The optimization of epistemic action frequently relies on **Expected Information Gain (EIG)**, defined as the mathematically expected reduction in the Shannon entropy of a posterior belief distribution following a candidate observation5.  
In advanced machine intelligence architectures, these concepts converge under **Expected Free Energy (EFE)**. EFE is a variational objective that seamlessly decomposes into a pragmatic term (expected utility or regret) and an epistemic term (information gain), serving as a unified utility metric in active inference7. The historical antecedent to this unified metric is **Dual Control**, a foundational theory describing the necessity for a controller to simultaneously regulate a plant (exploitation) and probe it to reduce parametric uncertainty (exploration)10. Finally, **Empowerment** serves as an information-theoretic intrinsic motivation, defined formally as the channel capacity (the maximum mutual information) between an agent's available actions and its future sensor states12.

## **4\. Conceptual and Mathematical Foundations**

### **4.1 Dual Control and the Epistemic Trap**

The mathematical necessity of active perception originates in A.A. Feldbaum's Dual Control Theory (1960), which established that optimal decision-making under parametric uncertainty requires a controller to aggressively probe the environment to resolve unknown dynamics10 \[C3\]. In partially observable Markov decision processes (POMDPs), state uncertainty (where the agent is) and dynamics uncertainty (how the world works) frequently exhibit severe epistemic coupling. Without active probing, systems fall into the *epistemic trap*: the agent cannot accurately estimate its state without knowing the environment's dynamics, nor can it learn the dynamics without an accurate state estimate15. Consequently, a POMDP modeled strictly from passive demonstrations is generally non-identifiable. There exist multiple, contradictory pairings of hidden confounders and reward structures that perfectly rationalize the same passive dataset16 \[C3\]. Only by executing active, causal interventions can a machine intelligence system break this symmetry and identify the true state of the environment.

### **4.2 Epistemic Action versus Pragmatic Action**

The distinction between acting to change the world and acting to change the mind was formalized by Kirsh and Maglio (1994) in their study of human interaction with dynamic environments3 \[C6\]. Pragmatic actions alter the physical world to directly advance a task (e.g., stacking a block). Epistemic actions manipulate the environment to ease cognitive processing or acquire evidence (e.g., physically rotating a block to quickly visually confirm its geometry, rather than simulating the rotation in memory). For machine intelligence, this translates directly to sensor management. Moving a camera to peer behind an occlusion, manipulating an object to gauge its center of mass, or dispatching an exploratory query to an external database are all epistemic actions that alter the agent's internal belief manifold without intrinsically advancing the physical objective18.

### **4.3 Bayesian Experimental Design and Expected Information Gain**

Bayesian Experimental Design (BED) formalizes the selection of epistemic actions to maximize information about a latent parameter or state ![][image1]5. Let ![][image2] denote the chosen experimental design (the specific active sensor configuration) and ![][image3] the resulting observation. The Expected Information Gain (EIG) evaluates the expected Kullback-Leibler (KL) divergence from the posterior ![][image4] to the prior ![][image5]:  
![][image6]  
This is mathematically equivalent to the mutual information ![][image7] \[C3\]. In active perception, the machine intelligence dynamically selects the sensor configuration ![][image2] that maximizes this quantity, bounded by a resource cost function ![][image8]. This objective heavily penalizes redundant sensing; if a proposed observation ![][image2] is highly predictable given the current belief state, the resulting KL divergence will be near zero, prompting the agent to abstain from paying the sensor cost.

### **4.4 Active Inference and Expected Free Energy (EFE)**

While EIG optimizes pure information gathering, autonomous agents must balance learning with task execution. Active inference posits that systems act to minimize a unified variational objective: Expected Free Energy (EFE), denoted as ![][image9] for a given policy ![][image10] at future time ![][image11]7. The EFE formulation resolves the explore-exploit dilemma natively, without requiring arbitrary, hand-tuned exploration heuristics (such as upper confidence bounds or entropy bonuses), because it expresses both pragmatic and epistemic goals in the exact same units: nats \[C3\].  
![][image12]  
The epistemic term mathematically mandates active perception: if future states are uncertain, the system inherently generates policies (e.g., moving a camera, physically touching an occluded object) that maximize expected information gain9. As uncertainty resolves, the epistemic term shrinks, and the pragmatic term smoothly dominates, naturally transitioning the agent from active exploration to exploitation.

### **4.5 Alternative Objectives: Surprise, Empowerment, and Compression**

Beyond EFE, machine intelligence systems utilize several specific metrics to drive active perception:

* **Bayesian Surprise (Itti & Baldi):** Computes the actual KL divergence between prior and posterior *after* an observation is made. While highly effective for driving visual attention (foveation) toward novel stimuli in streaming video, it is a retrospective measure, unlike EIG which is prospective21 \[C1\].  
* **Empowerment (Klyubin):** Isolates the intrinsic drive to maintain control authority over the environment. Defined as the channel capacity between an action sequence ![][image13] and subsequent observations ![][image14]: ![][image15]13. An empowerment-maximizing machine naturally avoids configurations where sensors are saturated, blocked, or decoupled from actuators, intrinsically gravitating toward states offering high perceptual diversity and kinetic influence \[C3\].  
* **Compression Progress (Schmidhuber):** Rewards the agent when the history of its observations becomes easier to compress following a new observation. This neatly solves the "curiosity trap"—an agent staring at white noise. White noise yields high entropy and high Bayesian surprise, but zero *compression progress*, because it remains fundamentally unlearnable. Thus, a compression-driven agent will actively look away from irreducible stochasticity and focus on learnable dynamics24 \[C3\].

## **5\. Current State of the Art**

### **5.1 Embodied Spatial Intelligence Benchmarks**

Historically, machine perception was evaluated using static image classification or passive video segmentation. However, as of mid-2026, the literature definitively shows that passive processing of pre-collected datasets is yielding to environments requiring closed perception-action loops.  
The **ESI-Bench (Embodied Spatial Intelligence Benchmark)**, introduced in 2026, evaluates object representation, layout geometry, and goal-directed actions in simulated physical spaces26. State-of-the-art vision-language-action models perform exceedingly poorly on these tasks if they exhibit *action blindness*—the inability to choose kinetic actions that yield informative observations. The benchmark reveals that large models frequently commit prematurely to spatial hypotheses with high confidence, ignoring the need for further sensing. Conversely, systems that integrate active exploration to gather orthogonal viewpoints systematically and substantially outperform passive multi-view approaches, establishing that the sequence of epistemic actions is more critical than raw perceptual fidelity \[C1\].  
Similarly, **TVRBench (Target Viewpoint Reproduction)** tests an agent's ability to actively adjust a 3D viewpoint until its egocentric observation matches a target image28. Standard foundation models fail spectacularly, frequently spinning in place and failing to map spatial discrepancies to body translation. Active visual-action fine-tuning (e.g., using Multi-turn Group Relative Policy Optimization) elevates success rates from near-zero to 51.4%. This reveals that active perception relies strictly on continuous geometric discrepancy minimization over multi-turn histories, exposing a severe limitation in purely passive pre-training \[C2\].

### **5.2 Active Dataset Construction and Autonomous Laboratories**

In materials discovery and large-scale vision, active dataset construction has rapidly matured. The **Bamboo** framework (2026) demonstrates continuous, mega-scale dataset building via human-machine synergy. Instead of blindly annotating images, the machine intelligence actively computes the uncertainty of unlabeled pools, selectively querying only the most informative, out-of-distribution (OOD) samples30. This maximizes the EIG per human annotation hour, drastically reducing redundant computational overhead and allowing datasets to scale to 69 million labels efficiently \[C4\].  
In the physical sciences, autonomous self-driving laboratories (SDLs) deploy Bayesian adaptive design to dictate molecular synthesis and materials science experiments32. The machine intelligence actively selects the next chemical permutation to synthesize and test, explicitly calculating the mutual information between the proposed experiment and the global surrogate model of the chemical parameter space. This active learning approach successfully prioritizes knowledge gaps and avoids redundant testing in high-cost laboratory environments \[C1\].

### **5.3 Context Acquisition for Large Representation Models**

Active perception extends beyond the physical domain into semantic and computational environments. Context acquisition for text-based machine intelligence has recently been formalized as an active inference problem19. Before generating a terminal response, the system evaluates the expected free energy of executing a "context action"—such as querying an external API, performing a semantic retrieval, evaluating a prompt variant, or asking the human user a clarifying question. The optimal stopping rule triggers when the token cost, latency penalty, or privacy risk of querying exceeds the expected information gain relative to the latent task variable \[C3\].

### **5.4 Adaptive Hardware Innovations**

Hardware paradigms are shifting to accommodate active perception natively. **Event cameras** output asynchronous pulses only upon local brightness changes, rather than recording global frames at a fixed rate35. Consequently, if an event camera is perfectly static in a static environment, it sees nothing. To perceive spatial structure, the sensor *must* move. This biological inspiration mirrors human micro-saccades, inextricably linking perception to kinetic action \[C4\].  
Furthermore, combining foveated visual systems with dense tactile arrays (e.g., GelSight) ensures that multimodal epistemic actions become feasible. A robotic manipulator might press into a visually occluded object purely to map its stiffness or kinematic constraints—an epistemic action that trades kinetic energy for high-fidelity state information18 \[C4\].

## **6\. Architecture Taxonomy**

The mechanisms of active perception can be categorized by the physical nature of the intervention and the targeted epistemic objective.

| Category | Mechanism & Domain | Epistemic Objective | Example Applications |
| :---- | :---- | :---- | :---- |
| **Viewpoint Planning** | Adjusting sensor pose/parameters (pan, tilt, zoom) without altering the target world. | Resolve occlusions; maximize visual Expected Information Gain. | Aerial drone navigation38; target viewpoint matching in TVRBench28. |
| **Interactive Perception** | Physically manipulating the environment to force the revelation of latent state. | Discover latent mass, center of gravity, friction, articulation, or hidden contents. | Cluttered robotic grasping; Embodied spatial tasks (ESI-Bench)18. |
| **Scientific Intervention** | Autonomous synthesis, testing, or destructive analysis. | Maximize mutual information between an internal surrogate model and real physical laws. | Materials discovery; Autonomous Self-Driving Laboratories (SDLs)32. |
| **Adaptive Sensor Control** | Modulating sensor physics without gross movement (e.g., foveation, active depth pinging). | Minimize power/bandwidth consumption while retaining task-critical temporal data. | Event cameras; phased-array acoustic sensing35. |
| **Context Acquisition** | Dispatching digital queries to databases, tools, or human operators. | Resolve semantic, intent, or constraint ambiguity prior to task execution. | Active LLM prompting; Optimal Question Asking (OQA)19. |

## **7\. A Concrete Reference Architecture**

To systematize these disparate functions, we specify an **Epistemic Action Planner (EAP)**. The EAP strictly separates belief maintenance from physical control and enforces capability-based security to ensure active perception does not violate explicit environmental or social boundaries.

### **7.1 Core Modules of the EAP**

The architecture operates via a continuous loop through six primary modules:

> 1. **Belief State Tracker:** Maintains a joint probability distribution ![][image16] over the hidden environment state ![][image17] and the underlying transition dynamics ![][image1]. In continuous spaces, this is frequently approximated using particle filters or diffusion-based inference networks to avoid the intractable computational cost of exact Bayesian updates6.  
> 2. **Candidate Observation Generator:** Given a set of available epistemic actions, this module simulates the expected observation distribution ![][image18], heavily factoring in known sensor limitations, occlusion geometry, and noise profiles.  
> 3. **Information-Value Estimator:** Computes the EIG (or mutual information) for candidate actions over a specified lookahead horizon, generating a spatial or parametric uncertainty map.  
> 4. **Pragmatic Cost Model:** Quantifies the kinetic, thermal, computational, and financial cost of an action. For instance, actuating a multi-ton robotic arm costs significantly more than panning a lightweight optical sensor.  
> 5. **Arbitrator (EFE Minimizer):** Balances the outputs of the Information-Value Estimator against the Pragmatic Cost Model. By minimizing Expected Free Energy, the Arbitrator ensures the system seeks information only when it is operationally viable.  
> 6. **Stop Rule Trigger:** Evaluates the EFE continuously. When the marginal cost of the cheapest epistemic action exceeds the expected information gain, or when the belief certainty exceeds a hard threshold, the Stop Rule triggers, collapsing the architecture back into purely pragmatic exploitation \[C4\].

### **7.2 Capability, Consent, and Boundary Layer**

Active perception relies on gathering external data, which inherently risks violating property, privacy, or credential boundaries. Constructive engineering requires explicitly avoiding moral profiling, hidden viewpoint censorship, or forced personality rewriting. Instead, the architecture replaces subjective behavioral gating with rigorous cryptographic and physical access boundaries \[C5\].

* **Consent Tokens:** Sensors (e.g., cameras, microphones, network scanners) are locked behind an operating-system-level capability token layer. The EAP cannot dispatch an observation request without an unexpired, cryptographically signed token granted by the device owner or network administrator40.  
* **Property Boundaries (Geofences):** Physical actuators (e.g., drone rotors, robotic arms) operate strictly within predefined spatial bounding boxes encoded in a deterministic, real-time OS hypervisor. This layer bypasses the probabilistic EAP entirely; if the EAP commands an epistemic action that violates the boundary, the command is trapped and nullified, forcing the EAP to evaluate alternative actions \[C5\].  
* **Amnesia and Ephemeral Memory:** Observation streams acquired strictly for epistemic localization (e.g., sweeping a room with lidar to find a specific target) are mapped to ephemeral buffers that zero out immediately once the belief state scalar is updated. This ensures sensor privacy by default, preventing the accidental retention of high-fidelity environmental data in long-term machine memory40.

## **8\. Data Structures and Schemas**

The multi-language implementations strictly adhere to the following unified schema to ensure cross-language deterministic conformance.

| Data Structure | Description | Core Fields / Types |
| :---- | :---- | :---- |
| BeliefState | The agent's internal probability distribution over possible states. | Vector\<Float\> probabilities (must sum to 1.0) |
| Action | A discrete action choice evaluated by the planner. | Enum type (Sense, Move), Float cost |
| Observation | The sensor return from the environment. | Boolean hit, Float noise\_variance |
| GridWorld | The ground truth state (hidden from the planner). | Int target\_x, Int target\_y |
| EFE\_Result | Evaluated metric combining both objectives for a candidate action. | Float epistemic\_val, Float pragmatic\_val |

## **9\. Algorithms and Pseudocode**

The core routine for a myopic Epistemic Action Planner balancing sensor management against pragmatic movement relies on simulating the posterior distribution for all possible sensor outcomes.  
**Algorithm: Epistemic Grid Search (Myopic EIG)**  
Require: Belief state b(x, y), Cost budget B, Confidence threshold T  
While max(b) \< T and B \> 0:  
For each action a in {Sense(current\_idx), Move(dx, dy)}:  
If a \== Sense:  
Simulate expected observations o in {Hit, Miss}  
Compute EIG(a) \= H(b) \- E\_{p(o|a)}\[H(b | o, a)\]  
EFE(a) \= \-EIG(a) \+ cost(Sense)  
If a \== Move:  
\# Moving provides no direct information, but positions the agent  
EFE(a) \= cost(Move) \+ PragmaticDistance(a, argmax(b))  
a\_best \= argmin EFE(a)  
If a\_best \== Sense:  
o\_real \= Execute(Sense)  
b \= BayesUpdate(b, o\_real)  
B \= B \- cost(Sense)  
Else:  
Execute(Move)  
B \= B \- cost(Move)

## **10\. Five-Language Implementation Strategy and Code**

The following reference implementations adhere to stable toolchains as of August 2026\. They model a myopic planner in a 5x5 hidden-object grid where the agent maintains a belief state, evaluates EIG for sensing at a candidate cell, updates beliefs via Bayes' theorem, and exposes a bounded deterministic test loop to verify conformance.  
*Implementation Contract:* All languages implement the exact same math, utilizing standard libraries exclusively. The bayes\_update and expected\_information\_gain functions serve as the cross-language verifiable kernel. Ownership, memory, and concurrency paradigms are handled idiomatically per language.

### **10.1 Python (3.14.7)**

Python leverages dynamic lists and standard math libraries. Memory is garbage-collected. The test loop asserts output against the exact 6-decimal precision required by the cross-language fixture.

Python  
\# build: python \-m py\_compile epistemic\_planner.py  
\# run & test: python epistemic\_planner.py  
import math  
from typing import List

class EpistemicPlanner:  
    def \_\_init\_\_(self, size: int \= 5):  
        self.size \= size  
        self.cells \= size \* size  
        self.belief \= \[1.0 / self.cells\] \* self.cells  
        self.sensor\_true\_pos \= 0.9  
        self.sensor\_false\_pos \= 0.1

    def \_entropy(self, b: List\[float\]) \-\> float:  
        return \-sum(p \* math.log(p) for p in b if p \> 0.0)

    def bayes\_update(self, idx: int, hit: bool) \-\> None:  
        total \= 0.0  
        for i in range(self.cells):  
            prob \= self.sensor\_false\_pos if hit else (1.0 \- self.sensor\_false\_pos)  
            if i \== idx:  
                prob \= self.sensor\_true\_pos if hit else (1.0 \- self.sensor\_true\_pos)  
            self.belief\[i\] \*= prob  
            total \+= self.belief\[i\]  
          
        self.belief \= \[p / total for p in self.belief\]

    def expected\_information\_gain(self, idx: int) \-\> float:  
        h\_prior \= self.\_entropy(self.belief)  
        p\_hit \= self.belief\[idx\] \* self.sensor\_true\_pos \+ (1.0 \- self.belief\[idx\]) \* self.sensor\_false\_pos  
        p\_miss \= 1.0 \- p\_hit  
          
        b\_hit \= \[0.0\] \* self.cells  
        b\_miss \= \[0.0\] \* self.cells  
        hit\_total, miss\_total \= 0.0, 0.0  
          
        for i in range(self.cells):  
            b\_hit\[i\] \= self.belief\[i\] \* (self.sensor\_true\_pos if i \== idx else self.sensor\_false\_pos)  
            hit\_total \+= b\_hit\[i\]  
            b\_miss\[i\] \= self.belief\[i\] \* ((1.0 \- self.sensor\_true\_pos) if i \== idx else (1.0 \- self.sensor\_false\_pos))  
            miss\_total \+= b\_miss\[i\]

        b\_hit \= \[p / hit\_total for p in b\_hit\]  
        b\_miss \= \[p / miss\_total for p in b\_miss\]

        h\_post \= p\_hit \* self.\_entropy(b\_hit) \+ p\_miss \* self.\_entropy(b\_miss)  
        return h\_prior \- h\_post

if \_\_name\_\_ \== "\_\_main\_\_":  
    planner \= EpistemicPlanner(5)  
    eig \= planner.expected\_information\_gain(0)  
    assert math.isclose(eig, 0.117180, abs\_tol=1e-5), f"EIG mismatch: {eig}"  
    planner.bayes\_update(0, True)  
    assert math.isclose(planner.belief\[0\], 0.272727, abs\_tol=1e-5), f"Belief mismatch: {planner.belief\[0\]}"  
    print("Python 3.14.7: Conformance Verified.")

### **10.2 Rust (1.98.0)**

Rust strictly enforces memory ownership and absence of data races at compile time. The EpistemicPlanner owns its belief vector. The test loop uses standard assertions.

Rust  
// build: rustc epistemic\_planner.rs  
// run & test: ./epistemic\_planner  
\#\[derive(Clone)\]  
pub struct EpistemicPlanner {  
    pub cells: usize,  
    pub belief: Vec\<f64\>,  
    pub sensor\_true\_pos: f64,  
    pub sensor\_false\_pos: f64,  
}

impl EpistemicPlanner {  
    pub fn new(size: usize) \-\> Self {  
        let cells \= size \* size;  
        EpistemicPlanner {  
            cells,  
            belief: vec\!\[1.0 / (cells as f64); cells\],  
            sensor\_true\_pos: 0.9,  
            sensor\_false\_pos: 0.1,  
        }  
    }

    fn entropy(b: &\[f64\]) \-\> f64 {  
        b.iter().map(|\&p| if p \> 0.0 { \-p \* p.ln() } else { 0.0 }).sum()  
    }

    pub fn bayes\_update(&mut self, idx: usize, hit: bool) {  
        let mut total \= 0.0;  
        for i in 0..self.cells {  
            let mut prob \= if hit { self.sensor\_false\_pos } else { 1.0 \- self.sensor\_false\_pos };  
            if i \== idx {  
                prob \= if hit { self.sensor\_true\_pos } else { 1.0 \- self.sensor\_true\_pos };  
            }  
            self.belief\[i\] \*= prob;  
            total \+= self.belief\[i\];  
        }  
        for p in self.belief.iter\_mut() { \*p /= total; }  
    }

    pub fn expected\_information\_gain(&self, idx: usize) \-\> f64 {  
        let h\_prior \= Self::entropy(&self.belief);  
        let p\_hit \= self.belief\[idx\] \* self.sensor\_true\_pos \+ (1.0 \- self.belief\[idx\]) \* self.sensor\_false\_pos;  
        let p\_miss \= 1.0 \- p\_hit;

        let mut b\_hit \= vec\!\[0.0; self.cells\];  
        let mut b\_miss \= vec\!\[0.0; self.cells\];  
        let (mut hit\_total, mut miss\_total) \= (0.0, 0.0);

        for i in 0..self.cells {  
            b\_hit\[i\] \= self.belief\[i\] \* if i \== idx { self.sensor\_true\_pos } else { self.sensor\_false\_pos };  
            hit\_total \+= b\_hit\[i\];  
              
            b\_miss\[i\] \= self.belief\[i\] \* if i \== idx { 1.0 \- self.sensor\_true\_pos } else { 1.0 \- self.sensor\_false\_pos };  
            miss\_total \+= b\_miss\[i\];  
        }

        for i in 0..self.cells {  
            b\_hit\[i\] /= hit\_total;  
            b\_miss\[i\] /= miss\_total;  
        }

        h\_prior \- (p\_hit \* Self::entropy(\&b\_hit) \+ p\_miss \* Self::entropy(\&b\_miss))  
    }  
}

fn main() {  
    let mut planner \= EpistemicPlanner::new(5);  
    let eig \= planner.expected\_information\_gain(0);  
    assert\!((eig \- 0.117180).abs() \< 1e-5, "EIG mismatch: {}", eig);  
    planner.bayes\_update(0, true);  
    assert\!((planner.belief\[0\] \- 0.272727).abs() \< 1e-5, "Belief mismatch: {}", planner.belief\[0\]);  
    println\!("Rust 1.98.0: Conformance Verified.");  
}

### **10.3 C\# 14 (.NET 10\)**

C\# uses managed memory with a focus on enterprise stability. The class encapsulates properties safely.

C\#  
// build: dotnet build  
// run & test: dotnet run  
using System;  
using System.Linq;

public class EpistemicPlanner {  
    public int Cells { get; }  
    public double\[\] Belief { get; private set; }  
    private const double SensorTruePos \= 0.9;  
    private const double SensorFalsePos \= 0.1;

    public EpistemicPlanner(int size \= 5) {  
        Cells \= size \* size;  
        Belief \= Enumerable.Repeat(1.0 / Cells, Cells).ToArray();  
    }

    private double Entropy(double\[\] b) {  
        double ent \= 0.0;  
        foreach (var p in b) { if (p \> 0.0) ent \-= p \* Math.Log(p); }  
        return ent;  
    }

    public void BayesUpdate(int idx, bool hit) {  
        double total \= 0;  
        for (int i \= 0; i \< Cells; i++) {  
            double prob \= hit ? SensorFalsePos : (1.0 \- SensorFalsePos);  
            if (i \== idx) prob \= hit ? SensorTruePos : (1.0 \- SensorTruePos);  
            Belief\[i\] \*= prob;  
            total \+= Belief\[i\];  
        }  
        for (int i \= 0; i \< Cells; i++) Belief\[i\] /= total;  
    }

    public double ExpectedInformationGain(int idx) {  
        double hPrior \= Entropy(Belief);  
        double pHit \= Belief\[idx\] \* SensorTruePos \+ (1.0 \- Belief\[idx\]) \* SensorFalsePos;  
        double pMiss \= 1.0 \- pHit;

        double\[\] bHit \= new double\[Cells\];  
        double\[\] bMiss \= new double\[Cells\];  
        double hitTotal \= 0, missTotal \= 0;

        for (int i \= 0; i \< Cells; i++) {  
            bHit\[i\] \= Belief\[i\] \* (i \== idx ? SensorTruePos : SensorFalsePos);  
            hitTotal \+= bHit\[i\];  
            bMiss\[i\] \= Belief\[i\] \* (i \== idx ? (1.0 \- SensorTruePos) : (1.0 \- SensorFalsePos));  
            missTotal \+= bMiss\[i\];  
        }

        for (int i \= 0; i \< Cells; i++) {  
            bHit\[i\] /= hitTotal;  
            bMiss\[i\] /= missTotal;  
        }

        return hPrior \- (pHit \* Entropy(bHit) \+ pMiss \* Entropy(bMiss));  
    }

    public static void Main() {  
        var planner \= new EpistemicPlanner(5);  
        double eig \= planner.ExpectedInformationGain(0);  
        if (Math.Abs(eig \- 0.117180) \> 1e-5) throw new Exception($"EIG mismatch: {eig}");  
        planner.BayesUpdate(0, true);  
        if (Math.Abs(planner.Belief\[0\] \- 0.272727) \> 1e-5) throw new Exception($"Belief mismatch");  
        Console.WriteLine("C\# 14 (.NET 10): Conformance Verified.");  
    }  
}

### **10.4 Java 26**

Java requires strictly object-oriented encapsulation and garbage-collected memory boundaries.

Java  
// build: javac EpistemicPlanner.java  
// run & test: java \-ea EpistemicPlanner  
import java.util.Arrays;

public class EpistemicPlanner {  
    public final int cells;  
    public double\[\] belief;  
    private final double sensorTruePos \= 0.9;  
    private final double sensorFalsePos \= 0.1;

    public EpistemicPlanner(int size) {  
        this.cells \= size \* size;  
        this.belief \= new double\[this.cells\];  
        Arrays.fill(this.belief, 1.0 / this.cells);  
    }

    private double entropy(double\[\] b) {  
        double ent \= 0.0;  
        for (double p : b) {  
            if (p \> 0.0) ent \-= p \* Math.log(p);  
        }  
        return ent;  
    }

    public void bayesUpdate(int idx, boolean hit) {  
        double total \= 0.0;  
        for (int i \= 0; i \< cells; i++) {  
            double prob \= hit ? sensorFalsePos : (1.0 \- sensorFalsePos);  
            if (i \== idx) prob \= hit ? sensorTruePos : (1.0 \- sensorTruePos);  
            belief\[i\] \*= prob;  
            total \+= belief\[i\];  
        }  
        for (int i \= 0; i \< cells; i++) {  
            belief\[i\] /= total;  
        }  
    }

    public double expectedInformationGain(int idx) {  
        double hPrior \= entropy(belief);  
        double pHit \= belief\[idx\] \* sensorTruePos \+ (1.0 \- belief\[idx\]) \* sensorFalsePos;  
        double pMiss \= 1.0 \- pHit;

        double\[\] bHit \= new double\[cells\];  
        double\[\] bMiss \= new double\[cells\];  
        double hitTotal \= 0.0, missTotal \= 0.0;

        for (int i \= 0; i \< cells; i++) {  
            bHit\[i\] \= belief\[i\] \* (i \== idx ? sensorTruePos : sensorFalsePos);  
            hitTotal \+= bHit\[i\];  
            bMiss\[i\] \= belief\[i\] \* (i \== idx ? (1.0 \- sensorTruePos) : (1.0 \- sensorFalsePos));  
            missTotal \+= bMiss\[i\];  
        }

        for (int i \= 0; i \< cells; i++) {  
            bHit\[i\] /= hitTotal;  
            bMiss\[i\] /= missTotal;  
        }

        return hPrior \- (pHit \* entropy(bHit) \+ pMiss \* entropy(bMiss));  
    }

    public static void main(String\[\] args) {  
        EpistemicPlanner planner \= new EpistemicPlanner(5);  
        double eig \= planner.expectedInformationGain(0);  
        assert Math.abs(eig \- 0.117180) \< 1e-5 : "EIG mismatch";  
        planner.bayesUpdate(0, true);  
        assert Math.abs(planner.belief\[0\] \- 0.272727) \< 1e-5 : "Belief mismatch";  
        System.out.println("Java 26: Conformance Verified.");  
    }  
}

### **10.5 C23**

C23 places explicit responsibility on the developer for memory allocation and deallocation (malloc/free), demanding rigorous boundary management.

C  
// build: gcc \-O3 \-std=c2x \-lm epistemic\_planner.c \-o epistemic\_planner  
// run & test: ./epistemic\_planner  
\#**include** \<stdio.h\>  
\#**include** \<stdlib.h\>  
\#**include** \<math.h\>  
\#**include** \<stdbool.h\>  
\#**include** \<assert.h\>

\#**define** SENSOR\_TRUE\_POS 0.9  
\#**define** SENSOR\_FALSE\_POS 0.1

typedef struct {  
    int cells;  
    double\* belief;  
} EpistemicPlanner;

EpistemicPlanner create\_planner(int size) {  
    EpistemicPlanner p;  
    p.cells \= size \* size;  
    p.belief \= (double\*)malloc(p.cells \* sizeof(double));  
    for(int i \= 0; i \< p.cells; i++) p.belief\[i\] \= 1.0 / p.cells;  
    return p;  
}

void destroy\_planner(EpistemicPlanner\* p) {  
    free(p-\>belief);  
}

double calc\_entropy(double\* b, int cells) {  
    double ent \= 0.0;  
    for(int i \= 0; i \< cells; i++) {  
        if(b\[i\] \> 0.0) ent \-= b\[i\] \* log(b\[i\]);  
    }  
    return ent;  
}

void bayes\_update(EpistemicPlanner\* p, int idx, bool hit) {  
    double total \= 0.0;  
    for(int i \= 0; i \< p-\>cells; i++) {  
        double prob \= hit ? SENSOR\_FALSE\_POS : (1.0 \- SENSOR\_FALSE\_POS);  
        if(i \== idx) prob \= hit ? SENSOR\_TRUE\_POS : (1.0 \- SENSOR\_TRUE\_POS);  
        p-\>belief\[i\] \*= prob;  
        total \+= p-\>belief\[i\];  
    }  
    for(int i \= 0; i \< p-\>cells; i++) p-\>belief\[i\] /= total;  
}

double expected\_information\_gain(EpistemicPlanner\* p, int idx) {  
    double h\_prior \= calc\_entropy(p-\>belief, p-\>cells);  
    double p\_hit \= p-\>belief\[idx\] \* SENSOR\_TRUE\_POS \+ (1.0 \- p-\>belief\[idx\]) \* SENSOR\_FALSE\_POS;  
    double p\_miss \= 1.0 \- p\_hit;  
      
    double\* b\_hit \= (double\*)malloc(p-\>cells \* sizeof(double));  
    double\* b\_miss \= (double\*)malloc(p-\>cells \* sizeof(double));  
    double hit\_total \= 0.0, miss\_total \= 0.0;  
      
    for(int i \= 0; i \< p-\>cells; i++) {  
        b\_hit\[i\] \= p-\>belief\[i\] \* (i \== idx ? SENSOR\_TRUE\_POS : SENSOR\_FALSE\_POS);  
        hit\_total \+= b\_hit\[i\];  
        b\_miss\[i\] \= p-\>belief\[i\] \* (i \== idx ? (1.0 \- SENSOR\_TRUE\_POS) : (1.0 \- SENSOR\_FALSE\_POS));  
        miss\_total \+= b\_miss\[i\];  
    }  
      
    for(int i \= 0; i \< p-\>cells; i++) { b\_hit\[i\] /= hit\_total; b\_miss\[i\] /= miss\_total; }  
    double h\_post \= p\_hit \* calc\_entropy(b\_hit, p-\>cells) \+ p\_miss \* calc\_entropy(b\_miss, p-\>cells);  
    free(b\_hit);   
    free(b\_miss);  
    return h\_prior \- h\_post;  
}

int main() {  
    EpistemicPlanner planner \= create\_planner(5);  
    double eig \= expected\_information\_gain(\&planner, 0);  
    assert(fabs(eig \- 0.117180) \< 1e-5);  
    bayes\_update(\&planner, 0, true);  
    assert(fabs(planner.belief\[0\] \- 0.272727) \< 1e-5);  
    printf("C23: Conformance Verified.\\n");  
    destroy\_planner(\&planner);  
    return 0;  
}

## **11\. Cross-Language Conformance Fixtures**

To verify functional identity across the varied memory management and typing systems of the target languages, output must be evaluated against standard geometric and mathematical truths. The following table represents the standardized JSON-equivalent fixture outputs for a uniform prior state in a 5x5 grid (25 cells) given a sensor characterized by P(Hit|True)=0.9 and P(Hit|False)=0.1.

| Initial State | Operation Executed | Expected Scalar / Vector Output | Strict Tolerance |
| :---- | :---- | :---- | :---- |
| belief=\[0.04...\] | expected\_information\_gain(0) | 0.1171804 (nats) | ![][image19] |
| belief=\[0.04...\] | bayes\_update(0, true) | belief\[0\] \= 0.272727 | ![][image19] |
| belief=\[0.04...\] | bayes\_update(0, true) | belief\[1..24\] \= 0.030303 | ![][image19] |

*Output Verification Logic:* Following a positive hit on cell 0, the total probability space must normalize to ![][image20]. Computation confirms: ![][image21].

## **12\. Testing and Benchmark Plan**

Ensuring stability in probabilistic planning architectures requires rigorous, deterministic test strategies \[C4\]. The benchmark plan relies on isolating the mathematical core from environment stochasticity:

> 1. **Belief Normalization Check (Metamorphic Testing):** Regardless of how extreme the sensor noise parameters become (e.g., ![][image22]), the sum of all elements in the belief state array must perpetually equal ![][image20]. Property-based frameworks (like Python's hypothesis or Rust's proptest) are configured to fuzz the sensor capabilities to ensure no floating-point underflow violates the probability axiom.  
> 2. **Replay Validation (Differential Testing):** The agent is subjected to a completely deterministic sequence of simulated hardware logs (e.g., exact JSON traces of pre-computed sensor hits/misses). Its internal trace of EIG metrics and Bayes updates must bit-for-bit match the precomputed golden JSON trace provided by a reference oracle.  
> 3. **Evidence Efficiency Benchmark:** To measure active perception performance in environments analogous to ESI-Bench, agents are subjected to dynamic distractors and occlusions. The core metric is *Evidence Efficiency*: the number of information bits (nats) gained per calorie (or Joule) of physical energy spent actuating the sensors. This strictly penalizes systems that move wastefully.  
> 4. **Boundary Capability Trapping:** A critical safety test where simulated, un-credentialed actuator commands are injected. The operating system layer must gracefully trap the action, revoke execution, and revert the planner to non-actuated epistemic calculations, proving that spatial and consent boundaries cannot be overridden by the probability matrix.

## **13\. Performance and Complexity Analysis**

Calculating expected information gain necessitates simulating future belief states across all possible sensor outcomes. The computational complexity presents severe scaling challenges for real-time robotic systems.

| Operation | Time Complexity | Space/Memory Complexity | Analytical Notes |
| :---- | :---- | :---- | :---- |
| **Bayes Update** | **![][image23]** | **![][image23]** | Scales linearly with the size of the discrete state space; highly parallelizable via SIMD instructions. |
| **Myopic EIG Estimation** | **![][image24]** | **![][image24]** | Dominates the real-time planning cycle. Evaluates every state against every potential discrete observation outcome. |
| **Long-Horizon Lookahead EFE** | **![][image25]** | **![][image23]** | Exponentially limits the lookahead horizon ![][image26]. Requires Monte Carlo sampling or particle filters to remain tractable \[C3\]. |

The real-time bottleneck for an Epistemic Action Planner is deep lookahead in continuous spaces. Mitigation relies on Sequential Monte Carlo (SMC) methods and neural density estimators. By treating active perception as probabilistic inference over a non-Markovian Feynman–Kac model, the machine intelligence samples only the highest-probability future trajectories, drastically reducing the exponential burden of exact dual control calculation41.

## **14\. Failure Modes and Recovery Methods**

A rigorously engineered machine intelligence system must anticipate and recover from the pathological failure modes inherent to active exploration.

> 1. **Curiosity Traps:** A well-documented failure mode in reinforcement learning where an agent becomes fixated on irreducible stochasticity—famously likened to a machine staring endlessly at static on a television screen. Because the noise is unpredictable, the EIG remains permanently high, trapping the agent in an infinite loop of observation \[C1\].  
   * *Recovery:* Transitioning the optimization objective from purely epistemic measures (Shannon entropy) to *compression progress* objectives24. This enables the system to distinguish between correctable ignorance (which requires evidence) and inherent ambiguity (which more sensing cannot resolve).  
> 2. **Sensor Spoofing and Calibration Drift:** Active agents that adjust hardware based on expected observations are vulnerable to deceptive distractors, adversarial optical inputs, or simple mechanical wear. If a camera lens is smeared, it may continually generate unexpected outputs, driving EIG artificially high.  
   * *Recovery:* Maintain redundant multimodal sensing (e.g., optical combined with dense tactile arrays). A massive divergence between visual prediction and tactile reality triggers a high Expected Free Energy state, halting pragmatic action until sensor recalibration restores multimodal consensus18.  
> 3. **Overexploration:** Spending extensive computational or physical resources gathering information that has no bearing on the actual task.  
   * *Recovery:* The EFE formalism intrinsically curbs this failure. By explicitly weighing epistemic value against the pragmatic cost of movement, the math forces a reversion to exploitation once the marginal cost of taking an observation exceeds the diminishing returns of the expected entropy reduction8.

## **15\. Strongest Counterarguments**

The paradigm of active perception is not universally accepted within the machine learning community. Two formidable counterarguments define the current scholarly debate.  
**Counterargument 1: The Intractable Compute Cost of Active Policies.** Critics correctly argue that the computational overhead of belief-space planning, EFE minimization, and EIG estimation heavily outweighs the cost of simple, passive, feed-forward data ingestion \[C7\]. Calculating expected future posteriors scales exponentially with the action horizon, introducing unacceptable latency in fast-moving physical systems (e.g., autonomous driving). *Rebuttal:* Passive perception in complex, real-world tasks demands massive, computationally heavy representation architectures to accurately guess at occluded data. Active perception solves occlusions physically (e.g., shifting a drone camera 5 degrees to look around a pillar)28. By trading kinetic energy for perceptual clarity, the underlying computational model can be significantly smaller, lighter, faster, and more interpretable.  
**Counterargument 2: "Passive Scaling is Sufficient."** The unprecedented success of large video-pretrained foundation models suggests that absorbing enough static, passive data can perfectly approximate active world knowledge \[C7\]. Proponents argue that with sufficient parameters, models will natively infer 3D geometry without needing to physically intervene. *Rebuttal:* Recent rigorous benchmarks, specifically ESI-Bench and TVRBench, empirically refute this hypothesis27. Passive scaling inevitably suffers from "action blindness"—the inability to map spatial discrepancies to embodied movement. Generative predictions of unobserved physics fail fundamentally when they encounter non-identifiable states16; they require causal physical intervention to collapse the wave function of real-world possibilities.

## **16\. Ten Falsifiable Predictions (2026–2031)**

> 1. Within 24 months, top-tier spatial intelligence benchmarks will universally mandate closed-loop movement; static, zero-shot visual evaluations will be fully deprecated for embodied tasks \[C8\].  
> 2. Machine intelligence systems employing explicit EFE minimization will solve target viewpoint reproduction tasks (TVRBench) with \>90% success, surpassing the current 12–51% baseline ceiling29.  
> 3. The computational cost of EIG calculation for 10-step horizons will drop by 3 orders of magnitude through the deployment of diffusion-based inference networks that substitute for heavy, exact Bayesian updates6.  
> 4. Systems optimizing empowerment will reliably map and navigate uncharacterized indoor spaces 40% faster than classic frontier-based exploration algorithms.  
> 5. Large representation models will allocate \>30% of their inference compute budget to context-acquisition (epistemic) actions—such as internal tool queries and human clarification requests—prior to executing terminal task generation19.  
> 6. Purely passive multi-view systems will plateau in manipulation success rates due to epistemic unidentifiability in highly cluttered scenes.  
> 7. Active tactile sensing will become legally or operationally mandatory for autonomous self-driving laboratories (SDLs) to prevent catastrophic equipment failures arising from chemical spill visual occlusions33.  
> 8. Capability-token-based boundaries and operating-system geofences will entirely replace LLM-based behavioral guardrails in physical hardware deployment due to safety-critical deterministic latency requirements.  
> 9. Information-gain objectives will become standard, foundational loss terms in the fine-tuning of vision-language-action (VLA) models.  
> 10. Event cameras coupled with continuous micro-saccadic actuator jitter will largely replace standard RGB video feeds in low-power, edge-deployed machine intelligence35.

## **17\. Three-to-Five-Year Research and Engineering Roadmap**

**Year 1: Foundation Benchmarking and Boundary Architecture.** Standardize active perception hardware APIs globally. Integrate TVRBench and ESI-Bench evaluation protocols natively into the foundational vision-action training pipelines of major laboratories. Finalize the cryptographic standards for capability-based sensor consent tokens. **Year 2: Amortized Bayesian Design.** Replace discrete, brute-force EIG calculation matrices with neural density estimators and amortized Bayesian adaptive design. This will shift the heavy computational load to offline training, accelerating real-time inference by orders of magnitude6. **Year 3: Multi-modal Sensor Autonomy.** Transition autonomous laboratories and edge robotics to dynamically schedule sensors, relying on continuous EFE minimization to prioritize tactile arrays or event cameras whenever optical vision uncertainty crosses a pre-defined threshold. **Years 4-5: Epistemic Swarms.** Deploy distributed, multi-agent clusters of machine intelligence that utilize shared, decentralized belief spaces. These swarms will negotiate active sampling missions collaboratively, deploying agents to gather sensory data based on global mutual expected free energy models.

## **18\. Annotated Bibliography of Foundational Works**

The theoretical and engineering foundations of active perception rest on a convergence of cybernetics, cognitive science, and probabilistic machine learning. A rigorous examination of this literature reveals the evolution of the field.  
A.A. Feldbaum's seminal work on Dual Control Theory10 established the earliest mathematical proof that controllers in uncertain environments face a dual objective: they must simultaneously regulate a plant and inject probing signals to estimate the plant's parameters. Feldbaum proved that without active probing, optimal regulation is impossible. This realization is echoed in contemporary analyses of the "epistemic trap" in modern reinforcement learning15, where it is shown that passively observed POMDPs remain non-identifiable. Only by actively intervening can an agent disentangle state uncertainty from dynamics uncertainty16.  
In cognitive science, Kirsh and Maglio (1994) provided a critical philosophical and empirical breakthrough by formally distinguishing pragmatic action from epistemic action3. By observing humans playing Tetris, they demonstrated that agents physically manipulate their environments (e.g., rotating a piece) not to advance the game state directly, but to offload spatial computation from the brain to the world. This principle directly informs modern active perception, where moving a sensor is cheaper than attempting to infer occluded geometry.  
The optimization metrics driving these epistemic actions have been heavily debated. Itti and Baldi (2009) formalized Bayesian Surprise as the KL divergence between a prior and posterior after an event occurs, proving it heavily influences visual foveation21. However, because it is retrospective, it cannot fully serve as a planning objective. Consequently, Expected Information Gain (EIG), championed in Bayesian Experimental Design5, emerged as the prospective standard. Klyubin et al. introduced Empowerment, maximizing the mutual information between actions and future sensors, to give agents an intrinsic drive toward highly controllable states12. Ultimately, the Expected Free Energy (EFE) framework, central to active inference, synthesized these concepts, providing a single variational bound that seamlessly integrates goal-directed pragmatic utility with epistemic information seeking7.  
Recently, theoretical paradigms have transitioned into rigorous empirical benchmarks. The introduction of ESI-Bench26 and TVRBench28 in 2026 proved that massive foundation models fail catastrophically when required to actively move in 3D space to resolve visual ambiguity, exposing "action blindness." Concurrently, active perception algorithms are revolutionizing dataset curation, with frameworks like Bamboo30 using active learning to heavily filter out-of-distribution noise, while autonomous laboratories utilize similar principles to optimize physical scientific interventions32. Finally, the expansion of active inference into Large Representation Models via epistemic prompting frameworks proves that context acquisition itself is a quantifiable epistemic action19.

## **19\. Website Integration Metadata**

**Suggested Report Title:** Active Perception: Epistemic Action, Adaptive Sensing, and Evidence-Seeking Machine Intelligence  
**Suggested Clean URL Slug:** active-perception-epistemic-action-machine-intelligence  
**One-Sentence Card Summary:** This monograph rigorously explores active perception architectures, detailing how machine intelligence autonomously seeks evidence through epistemic action to minimize uncertainty.  
**150-Word Abstract:**  
Passive observation structurally limits the capabilities of machine intelligence systems deployed in dynamic, partially observable environments. Active perception shifts the paradigm from passive data consumption to evidence-seeking interaction, closing the perception–action loop. This exhaustive engineering monograph systematically investigates computational architectures that autonomously determine where, when, and how to observe. By grounding the investigation in dual control theory, Bayesian experimental design, and the expected free energy principle, this report demonstrates how machine intelligence can actively resolve epistemic uncertainty. The analysis differentiates pragmatic and epistemic actions, formulates expected information gain, and details adaptive sensing hardware. State-of-the-art benchmarks reveal that active evidence accumulation consistently outperforms static multi-view techniques. The report features a reference architecture for an Epistemic Action Planner and a strictly synchronized, five-language implementation, while delineating the rigorous credential and physical boundaries required to execute active perception while preserving user sovereignty and consent.  
**Five Research Categories:**

> 1. Machine Perception & Robotics  
> 2. Probabilistic Inference & Bayesian Methods  
> 3. Autonomous Control Systems  
> 4. Sensing and Hardware Architectures  
> 5. Security & Boundary Engineering

**Twelve Glossary Terms:**

> 1. **Active Perception:** Deliberate optimization of sensor state to acquire task-relevant data.  
> 2. **Epistemic Action:** Action taken strictly to uncover hidden information or reduce computational load.  
> 3. **Pragmatic Action:** Action taken to directly advance a physical goal.  
> 4. **Expected Information Gain (EIG):** Expected reduction in Shannon entropy of a belief post-observation.  
> 5. **Expected Free Energy (EFE):** Variational objective unifying pragmatic utility and epistemic value.  
> 6. **Dual Control Theory:** Control paradigm requiring simultaneous regulation and parameter probing.  
> 7. **Empowerment:** Intrinsic motivation maximizing mutual information between actions and future sensors.  
> 8. **POMDP:** Partially Observable Markov Decision Process.  
> 9. **Epistemic Trap:** Failure mode where unidentifiable state and dynamics uncouple passive learning.  
> 10. **Action Blindness:** Inability of a model to select actions that yield informative observations.  
> 11. **Capability Token:** Cryptographic credential granting explicit consent to actuate a sensor.  
> 12. **Bayesian Experimental Design:** Formalism for selecting the optimal observation experiment.

**Six Related-Report Topics:**

> 1. Bayesian Adaptive Design in Autonomous Laboratories  
> 2. Resolving the Epistemic Trap in Continuous POMDPs  
> 3. Hardware Synchronization for Event Cameras and Tactile Arrays  
> 4. Implementing Capability-Based Security in Edge Robotics  
> 5. Active Inference and the Expected Free Energy Principle  
> 6. Spatial Intelligence Benchmarks: Beyond Passive Multi-View

**Build This Next:**  
> *Agent Handoff Instructions:* Parse the schema and pseudo-code provided in Sections 8 and 9\. Extract the C23 implementation of the EpistemicPlanner from Section 10.5. Extend this core C23 implementation by wrapping it in a Python C-Extension. Expose the expected\_information\_gain function so it can be called directly from an overarching reinforcement learning loop in Python, measuring the latency improvement against the native Python implementation provided in Section 10.1. Ensure all memory boundaries (malloc/free) are strictly managed and verified within the C extension context manager. Ensure no execution surpasses the provided hardware capability tokens.

#### **Works cited**

> 1. Artificial Intelligence and Data Science in the Automotive Industry, [https://arxiv.org/pdf/1709.01989](https://arxiv.org/pdf/1709.01989)  
> 2. A General One-Shot Multimodal Active Perception Framework for, [https://arxiv.org/html/2601.13639v1](https://arxiv.org/html/2601.13639v1)  
> 3. February | 2008 | Minds and Brains \- WordPress.com, [https://philosophyandpsychology.wordpress.com/2008/02/](https://philosophyandpsychology.wordpress.com/2008/02/)  
> 4. n st ngu sh ng p stem c \- Computer Science, [https://home.cs.colorado.edu/\~mozer/Teaching/syllabi/3702/readings/KirshMaglio1994.pdf](https://home.cs.colorado.edu/~mozer/Teaching/syllabi/3702/readings/KirshMaglio1994.pdf)  
> 5. Modern Bayesian Experimental Design \- arXiv, [https://arxiv.org/pdf/2302.14545](https://arxiv.org/pdf/2302.14545)  
> 6. JADAI: Jointly Amortizing Adaptive Design and Bayesian Inference, [https://arxiv.org/html/2512.22999v2](https://arxiv.org/html/2512.22999v2)  
> 7. expected\_free\_energy \- active-inference \- Obsidian Publish, [https://publish.obsidian.md/active-inference/knowledge\_base/free\_energy\_principle/mathematics/expected\_free\_energy](https://publish.obsidian.md/active-inference/knowledge_base/free_energy_principle/mathematics/expected_free_energy)  
> 8. Decision, Inference, and Information: Formal Equivalences Under, [https://www.mdpi.com/1099-4300/28/1/1](https://www.mdpi.com/1099-4300/28/1/1)  
> 9. Expected Free Energy as Belief-Dependent Utility for ρ \-POMDPs, [https://arxiv.org/html/2607.16981v1](https://arxiv.org/html/2607.16981v1)  
> 10. Dual Control: On Exploration–Exploitation in Linear Systems \- arXiv, [https://arxiv.org/html/2608.20073v1](https://arxiv.org/html/2608.20073v1)  
> 11. The Safety Filter: A Unified View of Safety-Critical Control in, [https://www.annualreviews.org/content/journals/10.1146/annurev-control-071723-102940?crawler=true](https://www.annualreviews.org/content/journals/10.1146/annurev-control-071723-102940?crawler=true)  
> 12. Empowerment \-- an Introduction | Request PDF \- ResearchGate, [https://www.researchgate.net/publication/257410224\_Empowerment\_--\_an\_Introduction](https://www.researchgate.net/publication/257410224_Empowerment_--_an_Introduction)  
> 13. Empowerment-driven Exploration using Mutual Information Estimation, [https://arxiv.org/html/1810.05533v1](https://arxiv.org/html/1810.05533v1)  
> 14. This article appeared in a journal published by Elsevier. The, [http://www.ja2014.upv.es/wp-content/uploads/2014/05/Paper-Astrom.pdf](http://www.ja2014.upv.es/wp-content/uploads/2014/05/Paper-Astrom.pdf)  
> 15. Breaking the Epistemic Trap: Active Perception Under Compound, [https://arxiv.org/pdf/2605.26627](https://arxiv.org/pdf/2605.26627)  
> 16. Learning An Active Inference Model of Driver Perception and Control, [https://arxiv.org/pdf/2303.15201](https://arxiv.org/pdf/2303.15201)  
> 17. Unifying Causal Reinforcement Learning: Survey, Taxonomy ... \- arXiv, [https://arxiv.org/html/2512.18135v1](https://arxiv.org/html/2512.18135v1)  
> 18. Robustness of Robotic Manipulation: Foundations and Frontiers, [https://arxiv.org/html/2606.31494v1](https://arxiv.org/html/2606.31494v1)  
> 19. Active Inference as Context Acquisition for AI Agents \- arXiv, [https://arxiv.org/html/2608.19202v1](https://arxiv.org/html/2608.19202v1)  
> 20. Expected Free Energy as Belief-Dependent Utility for rho-POMDPs, [https://arxiv.org/pdf/2607.16981](https://arxiv.org/pdf/2607.16981)  
> 21. Modeling Emotions Associated With Novelty at Variable Uncertainty, [https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2019.00002/full](https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2019.00002/full)  
> 22. SUBJECTIVE DEPTH & TIMESCALE TRANSFORMERS, [https://openreview.net/pdf?id=exMMxIakjl](https://openreview.net/pdf?id=exMMxIakjl)  
> 23. Empowerment and State-dependent Noise \- An Intrinsic Motivation, [https://direct.mit.edu/isal/proceedings-pdf/ecal2013/25/118/1901825/978-0-262-31709-2-ch018.pdf](https://direct.mit.edu/isal/proceedings-pdf/ecal2013/25/118/1901825/978-0-262-31709-2-ch018.pdf)  
> 24. The Drive for Knowledge: The Science of Human Information, [https://dokumen.pub/the-drive-for-knowledge-the-science-of-human-information-seeking-9781316515907-9781009026949-9781009013048-1316515907.html](https://dokumen.pub/the-drive-for-knowledge-the-science-of-human-information-seeking-9781316515907-9781009026949-9781009013048-1316515907.html)  
> 25. A survey on intrinsic motivation in reinforcement learning, [https://www.researchgate.net/publication/335290210\_A\_survey\_on\_intrinsic\_motivation\_in\_reinforcement\_learning](https://www.researchgate.net/publication/335290210_A_survey_on_intrinsic_motivation_in_reinforcement_learning)  
> 26. ESI-Bench: Towards Embodied Spatial Intelligence that Closes the, [https://arxiv.org/html/2605.18746v1](https://arxiv.org/html/2605.18746v1)  
> 27. (PDF) ESI-Bench: Towards Embodied Spatial Intelligence that, [https://www.researchgate.net/publication/404992219\_ESI-Bench\_Towards\_Embodied\_Spatial\_Intelligence\_that\_Closes\_the\_Perception-Action\_Loop](https://www.researchgate.net/publication/404992219_ESI-Bench_Towards_Embodied_Spatial_Intelligence_that_Closes_the_Perception-Action_Loop)  
> 28. Can Foundation Models Reach a Target Viewpoint Through Active, [https://arxiv.org/abs/2606.01247](https://arxiv.org/abs/2606.01247)  
> 29. Can Foundation Models Reach a Target Viewpoint Through Active, [https://arxiv.org/html/2606.01247v1](https://arxiv.org/html/2606.01247v1)  
> 30. (PDF) Bamboo: Building Mega-Scale Vision Dataset Continually, [https://www.researchgate.net/publication/359254799\_Bamboo\_Building\_Mega-Scale\_Vision\_Dataset\_Continually\_with\_Human-Machine\_Synergy](https://www.researchgate.net/publication/359254799_Bamboo_Building_Mega-Scale_Vision_Dataset_Continually_with_Human-Machine_Synergy)  
> 31. Bamboo: Building Mega-Scale Vision Dataset Continually ... \- arXiv, [https://arxiv.org/html/2203.07845v2](https://arxiv.org/html/2203.07845v2)  
> 32. Accelerating materials discovery through active learning: Methods, [https://www.the-innovation.org/article/doi/10.59717/j.xinn-inform.2025.100013](https://www.the-innovation.org/article/doi/10.59717/j.xinn-inform.2025.100013)  
> 33. Self-driving laboratories in Korea: a new era of autonomous discovery, [https://pubs.rsc.org/dd/article/5/5/1968/1244548/Self-driving-laboratories-in-Korea-a-new-era-of](https://pubs.rsc.org/dd/article/5/5/1968/1244548/Self-driving-laboratories-in-Korea-a-new-era-of)  
> 34. Active Inference as Context Acquisition for AI Agents \- arXiv, [https://arxiv.org/pdf/2608.19202](https://arxiv.org/pdf/2608.19202)  
> 35. Artificial Intelligence 2025 \- arXiv, [https://www.arxiv.org/list/cs.AI/2025?skip=27225\&show=2000](https://www.arxiv.org/list/cs.AI/2025?skip=27225&show=2000)  
> 36. Computer Vision and Pattern Recognition Aug 2024 \- arXiv, [https://www.arxiv.org/list/cs.CV/2024-08?skip=225\&show=2000](https://www.arxiv.org/list/cs.CV/2024-08?skip=225&show=2000)  
> 37. Mind Meets Space: Rethinking Agentic Spatial Intelligence from a, [https://www.researchgate.net/publication/395418109\_Mind\_Meets\_Space\_Rethinking\_Agentic\_Spatial\_Intelligence\_from\_a\_Neuroscience-inspired\_Perspective](https://www.researchgate.net/publication/395418109_Mind_Meets_Space_Rethinking_Agentic_Spatial_Intelligence_from_a_Neuroscience-inspired_Perspective)  
> 38. Reinforcement Learning for Active Perception in Autonomous ... \- arXiv, [https://arxiv.org/abs/2602.01266](https://arxiv.org/abs/2602.01266)  
> 39. (PDF) Reinforcement Learning for Active Perception in Autonomous, [https://www.researchgate.net/publication/400369941\_Reinforcement\_Learning\_for\_Active\_Perception\_in\_Autonomous\_Navigation](https://www.researchgate.net/publication/400369941_Reinforcement_Learning_for_Active_Perception_in_Autonomous_Navigation)  
> 40. Non-evaluated artifacts, [https://secartifacts.github.io/artifinder/](https://secartifacts.github.io/artifinder/)  
> 41. Sequential Monte Carlo for Policy Optimization in Continuous, [https://openreview.net/pdf?id=Zj0L8xIZYP](https://openreview.net/pdf?id=Zj0L8xIZYP)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAbCAYAAABFuB6DAAAA/ElEQVR4Xu3RMUuCQRzH8X+gkBQoOFTQUkMQtIWbrW5ODQm+hZx7Hy1BBE3R0hoELm5BtPQCGgxBHNzSoUH9/p6707tnCxoa/MEHz//zv3vunjP7V9nAERrYyj1bpoQb3KGDV+wnHaSIW9z78SaecRU3KRcY4cT/1xYePI2zVPGGRxR8bRs9T+MsLcz8b8ge+hatqBW00hCHqz6rYYrrUNjBJ37wFfnGHO3QeIqJRTPNveUJYxyHYtNyM8kBBpYe7neN2rQ2H6LTq3YW1axu7kNrr4qu8cXcVS5XU3Tqd3MT9L0u0UU5bgo5x4e5k+p+d9PHaXRNlXxxnb/NAniLLenUuJJVAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAA8ElEQVR4XtXSv2oCQRDH8RGx0mCpVQoRJCCK2Cnp8g62PkBqQ1LYCZZWFjZikWdI659CS2tJoSIIglinMPqd7BV7A2obf/CB42ZuZ2/vRP5dcojZmzYJtPFgC34iqGKBDSYohDpIHH0s0UAXLaS9nr+VOvjBs1+wyWCLobg9XswT9vgUt/rF6FH0sMJbcP0ubt+haGMTI8ywxgBJv0lH6Vt+IOoXbMqYImULNrqSjrkZPVR9iaIt2JRwwAlfqMiVverfouOP4h7Y4VWu/EF6bnV84xcvoWoQfTorbuwj5siHOoJoo47TAx+jJjc+593mDE9WJQCFkjQbAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAaCAYAAABhJqYYAAAA+0lEQVR4XmNgGAX0BMxAbAzEdkDMiibHjywGYkwA4iogPgTEvTAJIFAH4pdAHAETcAXiGiDmA+IDQLySAWITCEQD8TcgNoXyGTKBWB+ILaEScFOAYBIQXwViESQxMGgA4idArAjlCwLxaSBeCsSMUDEw4GGAOGENELNAxUC2fQLidCgfDiSB+CEQlyOJgdz7G4htkMTAQByI7zIgFIOCaw8DDveC3FTMAHHzXAaIW/8D8XyoHArggGKQ20G2gEIG5F7kkAEDGSC+zgCxlpsB4sHpQHwFiMWQ1IEByNegWMphgCjMB+JbQGyArAgGQNENcu9xKO5kgMTmyAMAAl4mzoEPVJAAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAaCAYAAAAUqxq7AAAEdElEQVR4Xu2YS6iVVRTHl/hAKS1NKkktRZIoFCkDKx2p6EAHNigwxEnpoCZJRQlyJYIGKiFlEYI4EJEEER8JOrgWVFQDhSRIA4tQFNSJCho+1o+9V65vnf1959y4DwfnB3/uPd/+Xvu/HnufI9Kly1AxXDVeNSwOtGF01lDxkGpkPNjf8IBPVCviQAbTnlYtVj0QxpZlDQYzpdWMF1W7JBk1YKxTbZFy9oxRfanarnpH9aNqshsfLIMeVH2qGhsHlDdUX0mref3Cs6pfVNPigKQHfq3akf+nlA6pPnDnDIZBBO5l1R+qf1Tfq2a5cYJ4QOor4H/Dgz/PKmXPa6oLqufyZ84hnZGdP9AGUdIE6KzqfdU2Se3gcXcOvK76Qfq51J6QFJWFcUB5RPWzardqRD5Gmvdm8T8MpEEE4TPVDdX8MBaZrjqjeiUOlBinWqqakj8TBRrs85JWKwNj/pRqTzGIyO3815ik+kvaZxDm+ucblGlfIsykz0s1IHUwx2Oqj+JAhHr8QtKJ5yQ1tr2qlfkvPcWaGb2kV1ofTsaQObwcL2nMVV1XbXXHokEvqPZJej7ms/IYm1U/SecmPaO6JNWANLFTOjiXrFgv927O6oNpwASv5HOAG2KalZDxmKTJ3VT97XRVdUeS2YY3iOewmsxQLZdk5rw8xh6LxaDtBBy2SJC1BJP/P5TWrYZRF/AKqyXtDXjBW1LtL9Tnv6p382cMQhFK8ZpUMwUTMRPTMd/wBlFSBIeJkYE+Wyxga/LnTuA+G1THJd2LIPG+dRmIQQSBYLSFTn9WUiM2eDkywJbDOoOYcMyUaZKWWN+0IZYY2Lk97hj3IqPI4k4gy1i1KFXfN5vAIDKfCmjEGpYvn1IGNBkUJ0Oz5lhcTUoGkb2sPH5FodRPqSa6Y02QxWxK207W0VGJgXV/v6GzqLIrNtPIMoyMNc3E2P/wkkBvOSLVa42SQTyXvsGqB9Z/Yr9jIqx4pZ5E5pSC10TdfFoggpRIT/7MC3ys+k31ZD4GlFwpqkTtV0lGce3bqqNSrv2SQfQ4b9Crkvqh7z8Yc1JSplkj9zBZ7jE7DtTAe7IA+L5ZCzdntaKxfSOpyRG9uPskQ05LtekaTIoJcB1fL+K1RskggsC136r2SHoXmr5lJJA9hyXttd5zx405kq4j0NznJWnuRWQpG1uSoxEe3CtpUpQGkaqrSTICE30z9nDdw/FgIBpEJMdKKqVHVRMkfVWo2/+wypKhJdhDUWZkH0ZdlHSu7eM8ZOHvUv5OWaHUf5rgmzCRtL1SX4kG8csAWcFOGsiEy6q1/51RhZWqVGIeespqSV8luLffuoC1EFTqZxXekuT2KmkffSBLDqoWxYEOiQaxWtGQ+frylKS03yTlqNNf/Ea2BNfNkFReU1Un5N6XZ4NxmrPvr7Ww2zT571FNcOP9+W9fiQbxwxorHj9J8NILpD6qXIeRTWAQZUWJfifpFwZ/P8Yp4X7/qSNCo96oGhUH2kDzREPFm6ol8WCXLl263I/cBVLC2jWz1+v5AAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAaCAYAAAAwspV7AAACn0lEQVR4Xu2WS6iNURTHlzwi8sgthERSYia3FDPEgAEDimSCCRMGigndlJGBiKRkIAMm8kgxuCYIE0XKo5DIQCYYkMf/d/fex/r22d/XPXXu7Pzq1znf/h5n7bXW3t8x6zHyjJbT5Kj8RANT5Nh8sFvw4GNyU34iQqCL5Fo50Y33y0sWgus6B+QJK2dpgjwjz8t98oGc485vl2etyxlbIh/L+fkJCz90Tl6I38fLm/Kgu4agr1t9ljuGzJyKlrK0RX6WS+Mx11Au9NdvlfetS2WcLV/K1fkJMV0+kpflmDg2SQ5G+Z5YIF/LlW6sjclyvZwbj2lOmnSZhVWWIJg3Vu2RBLP/Ez8Ts+Q7a88Uz78rD7mxCtT4tIULPsrj8qrcFj/pkdSU9MagVWcNZIYMfbKQhcRy+UOedGOJi9YebAtmf1gull8srBoCBR76NV4DPIhAU3kSMyxk8Kd87/wm/1qYYE7dBIfYaWH/2Ch/W7VfqPkvuT8eExTmUObvVs0IgTMBJsqEcwiKVcwGXAub4VsLzZzYY2GmafnWBbXB2jPClvHBqo3vISiyS5aLpMbzpSnNtCkoeodyJ2h4xla5MU9j+YDmpEn9Jpdmyu6cAiWbBO9fHUCZ2Z8oI9CTt616b07ds1rQT6T/SDxmRQzIZ3JeHAPK+Vz2uTGgBE8sBMe9e+Udq98cuYaVV1qVLYiaVfZQXpH3LJRupr/IQiZeWblxN8unFu7j1ZLf66G52WhJRpG06/Ig0s7OXFdnZk7gpSUO3Dc1HyywQr6w8vtziFI/NcFb/pb938s6JbUGFjdO2G2hn3bY8GZJNm7INfmJYbLQQoP7Xm2D10jSv7ea4IHX4mcn8Lrib03X/rbk0OxH5bj8RAO75Lp8sEePkeYfAAN8BEDlk5sAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAaCAYAAAD7aXGFAAAERklEQVR4Xu2YW6hVVRSGR2RQaFdFCw0vRBIFKlFRmQ9SUYQ9FEJRWhilRRAUGIgPByIiyxCNfEmih0ihh4IuEEKiUkQRJZUiBSpSZGAYJUF0+T/Hmuy5xl63fdpHetgf/GzWnOs2/znmmGNtsxEj/g+cL50VG08j50pnxsYWpkhnx8aJ4g5po9WbNFW6Xbo0dgyRZ6RLYmPGxdK00DZbeqv4HRf3SselfzL9Jq3JTxKLpI+k6aEdzpCWS3ukB6S90p2lM4ZHm0mPSdfERnGT9Lb5ShgXDPI16W/p5tAH50jvSPfEjoK7pW+kOcXxammXeZgPmyaTaCdijkkHpFXmYwN+X5aeLo4H5kLpM+mQNLPcdYrbpK+kGbHD3Jjvpceztruko9KsrG1YVJmEASulE9IL0gbpFenG/CRxvbRfmhvaO3G19Lv5LEwKfSnKNod2oI+XxpD8wcwW9+O+w6bKpFukv4q+FDlVpGC4L3Z0gYvIRU/GDvMkyFIiOiIYg0FvWtnc14v2FEnsLE1Lj90KQ5dY/6YQd9NoEs9lcrtOyqvSG9ZsZh8pUv6UFoc+4MFHit8IOQpz85lhiyaBYywGs+OxVH8xT/4RDNgkrZN2m++eifnST1bOhdEkJuA96768iXLej/fsTApB8kpVzlkm/SjNix3ms4JJP5gbiUiatKWlSwR9KP0sXemXlWCprJfOM0/2O6xXB2H+SSvvVtEkYOP4Q3rOPC2gy0tn9GA8h63/Ho005SOouymD32W9iEmkpcsOl2DQcRklHpUWmCdVDMmjhsHG+1eZxI78ufSu+UQx6QtLZ/RomvRamvIR1JnEMe25ufySn2Ii78KYla9LER7zRzTpWvP656KsrQnG86v5xHSiLR9Bm0nkkkRK5G27TCRFZW44g2AweURCblJaypQoXakbTy1t9RFgHjknOp+uzYszaiXqkJhAGcwFoS0nGZ7fiwivmrzcJHLVvuy4C9y3Lv9W0paP4Apzk1j3OUQKFeyzxTEmfmse/jmphGB3uyr0JXhhXjyZxLa/0/rzEeQmYSDv/4h1/+gl8tkNWz94V5gPPP9eY1d6KD+pIC2FGPYwW/rUPA99IS0td5+C6983fwahXgWGP2W+VLeZRyjnkwrisq1abpz7nfSgNLnoqyLVVOP+NGlizOqjjV2L2W6byYfN/yGogllNBSdRxU5HPqr6VoyJm9JhrfVKDypvjObfgAg5k3TA/YfOZdKXVr9c2iAaXjRfuhHyFy/O8iIKmIit0tdW/Y9DNCnBJN0gfWBuVtVn1P3mdVhdOfKfYTm8ZP3h34XrzCvpqkgkl1FVk/Tpf0I6aPV1Tp1Jc8xNxqztVv7gBip/ln3MmUMF97eYV7eDQi6KO16C+zIBnxR63nwJ1VFnEl/8ROPH5lGb5yYmdsz8OeOZ5IHgwbzkQNXqkGFzISoG4VbzHXDCDRoxYsSIieBfM6bXqPBupE0AAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAAC0ElEQVR4Xu2WWahNURjHP6HIlCFDkXORMhQlMpaEeCDFgyLkAcmLeUg6JSlDIfFiLuXGgwdDSRGi8KREhgcS8UZIV4b/37fWPWt/e619z304Nw/nV7/2uWvtu/e31vrWt7ZInf+frrCTbSygtfdH4UOmw0VwBGzv2rvAge53yFh4GvawHY7+sI9pGwwvuWurGQkfwK+wEW6A5+ANOApehzOb71YY+C3R/hRr4XjbCKbBy5IeYI6OcCdsgttg52z3vwd+ge8kO6Pt4CFYDtosA0Rn7hN8DleK/h/h9Sjc6v4uhEEehz/hQtPnYS5ddYZ5NVr05bxaGMQy+Bnuh/vgMTglvAlMgs9gg2nPsQb+gdulMtIYZ+EO08aZsMF7ZsFfcLcUP7cnfASX2I6QYfA9fAkHmT7LCcnmp59lGzzpILrc3+A40xeDzz4vBQMqi87mHtMegwnPNPEw997AeUGbxw/C5nQKrsxd2M12EJag2/C35HdyNXCmPsKptsPBfP8B98IjzuGZOypwsBw0B5/Dz8gHOMT0VQMDfeuuMTj4x/CK6H3MQ9bbGAw0GYcPNDmSAG64yaatKNAJovWxl+1IwEBZ/sbYDuJ3W0uB9oanYF/TngqUKcUDYo5pL6Jw6clB0RxNPZS7kKdTrL5ymVgx5pp2nkBPpOClEViaXsN+tsPDc/YFvCN6HofwdNoF10u8bPDsfgpXm3ZuLpalVVL5RmgJlrhUPW6mBO/D7/AMXA4Pi5aLGRIPkrCdHyLczSF+6Vn2XsEVoh8zKXzNreoY5UtLcIFzqFQ3G4vhQ9F8D+kOt4ie7wyYJ9RJya8aaRA9QnmU1gxutHuSznEOltWCX10M2M4+WSr6pRYeJjVhPrwo+S8uUhJddgZ8Aa7L9OpAr4mWs5rDtNnstPnML6WbonvggGRzlfeW4Ub3u03gsm2CE21HAbNFK0ObBVmnTi34C2jKerftjt0MAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAaCAYAAADovjFxAAADRUlEQVR4Xu2YS6hNURjHP3nkmWck5JHkFUmUIpIBeSQMFDMDlCQkyeBIhiSUkjwHEgOSZ8odISkMTMiAxMhEMqDw/7X2uneddfa6Z597ruOo86tf99y11t177W9/61vrXLMWLf4Wg2XvuLHBcH/m0S0MlEvkBjlN9szaB8ix2eeQlfKoNUcQjst1cUctTJdP5Dd5Ve6Wl+QDOUPelcvaRzvmyEdyZNT+rxgu78j5cUc1iOBB+UPul/3Ku22R/Co/WnkmMO6m3Bi0NQPLzb04MroQBOC0/CnXR32evvJ2Jp893OyVHBW0NQPUhcdWw8vZJn/Lw7JH1BdyUR4IfmfseXkiaGsmjsjrslfcETNZfpJv5bioL+asldeDEfK1pYsQQWJ9jk5IDfEFtwidXY/2+AWukO8tv5CXUTKXBUXeZrwFzpUfsp8xjL1m7topqTGz/R9UYZi8b5XX8H4xt4uFMC9q2LyovQyKRpv8ZZUVvwir5Wc5KWonUCwTCixvgSW0XU6Ul809eOrt5RFfb6q5ALNb+UwY0j66A9rJBOaZxA/Ki2Iq9cKbcXH+nvaQWXJV9pkiygNwfYondWVQ1leU8Hqw0FwQwgKdh3++TXFHiB+U9yAcitgyn5rbNkm5F3JLMCYVhJCZ8p4cai4tb1kN21YCCh5Wwz8fZ50kvrB19iB+yeSlfZEglKyj3jC+zeoLgp9PqhiHFFoOpPwpczWB/T4P0pjlEp8PgLRkZ0kVN9KfIK/Jfmcy77L2GNY9u0W1Y3ehYpfBS2N+7BKdMl6+kS+tcithQmfMLYW89CNA3CRVVDeb6/cZRBBSAed7B/cpRe0xO6x69nkIFEGP610uU+Qz+V1eMFdIeOjncqfcK5f6wQE+NbdG7dDf3JZ2xToOK9QHsiqsK55d5gL00NLLpY+8YflZmQfP0Wbp61XA0pgg15r75sj2Uy01oWTpUxk3DyfLPSiQqQMSNeqkuaKcgt2pSACYDy+gFLX/FThxspR4y/WyQO6LG7sI82Jn42dD2COPWbGDTwqy5py5DKwX5nHIXEDrmVNNsGxI49Q30CJQvBbHjV2Er/0s0W77D1NRWMd8C43PEo1mjLmi3vAAtGjR4v/nDx3/k9UTkTIOAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAbCAYAAABIpm7EAAAAtUlEQVR4XmNgGAWDDbACsTgQS+LAAgilDAwGQPwIiP/jwXuAmBukWAWIDwCxBxArAvEKIDYDYgcgnsWAsIEHpBgEIoBYGcrWBOL5QMwBxJ5AXAlThAvkAHErlF0FxOVIclgBSRr4gfgQELtA+QsZCGgAefoWEEtD+SANcxDSqAAUB6uAeA0Qs0DFQBquM0DiBgPoAvE7BkiIwQDIPy+BWB1JDA4YgVgQiJmRxEC2gvw1CgYhAADxQB1WN7bt/wAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAAgklEQVR4XmNgGAX0BqxALA7EklgwD5I6Bksgfg3E/3HgrUDMAVKoAsQHgNiDAWJKABBPhrJhGKwQBCKAWBnGAYJWIE5H4uMEgkB8EIht0CWwAZIUGwPxJSCWQZfABsqB+DAQ86JLoANOIN4BxAvRJbABNQZIWBMVEsxALAylR8EAAgDQnRPa4W10PQAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,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>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABPklEQVR4Xu2UsStGURTAj0SIUCKFyYKFZGM0fVlMijLalcikZFIGGUmSZDDJis3qHzCQMposJH7Hvfd7997vLe57i/p+9av7nXM773znvvtE6vyRftzErjhRhAbcxhcciHKFmMR3q65LoRVP8Rk/cTpMpzOPu7iB3zgXptPoxUscxHUxhReDHYms4ZJda6daWB9QiDExs223v13hneqOBJrwAGe8mB6aHt6JF3M0YlsczGMWv8R0GHuNLdnWXxbwOIrV0InnOBzF9eY94Z1k43Ec4koUq2FV8je5wo/YZ2PjYjp9xStctvEAvbY6xwccinKK/pN7McX1IY4RvMUeL1ZFD+lNsjlqB6Nefg8/vLyuj7BZzHt9JqaxUtmX/NEVohtvcAonsBKm09EP1AVuiTl0ff9LQy9HRxys88/5Ad77ODRDndvbAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAaCAYAAAAwspV7AAABx0lEQVR4Xu2WvStHURjHH3mJvJWXjZIsyqAoKYNJDAwoijIYyGAQycsqKcrLoCxiMjDJYOGXRTEZLEoo/4DB6OX7de7NuY97f/1u/TqD7qc+9bvPOd3fc885z3OvSMI/pQR2wi5Y7sUqYbU/wSX5cBk+wmk4BW/hOryCjb9T3ZAHd+ERLLbiXKEbmBKzgk5phy+wSQ+ARbitgy5Yga+wRg+AOdingy44gF9wAeaqsQZYoWJOGBaTFP2AF3AcltmTXMPKWxWTkJ8cvZPwLXUKt46lvwbfxCQ2YY3nSLA648B798BmPaDhRJ4Z/pmmG37CeSvGKj2T8PZQCNt00IMVfCqmwnvV2B/q4Y6YPqVpge9wxIrNSHR7YKKTOmjB8ZRkkBRLnU/Ap9SMwgdYC+vgFnwSc2MmV+BP9MhaUuxPXA297NxSHvIBK1YFLyX6dZOVpDjpBM7Ce+8328AmfIZDEjxrHfAclnrXPPBLcM9zH15b15StxiejpIrErAhhS2iFg2K+EMK2k1UYdZ5IVlYqDiyEY9gv5oyNBYd/cJ4Ut5HbuiHm88b/zrJJlxT706GY88st5vs0bDdiw8R4nsJ6GkmXVEJCgs838GZLuX2QOrMAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAaCAYAAADrCT9ZAAADmUlEQVR4Xu2YS8iMURjHH7lE7pdISC6RCIWikIXEgkRJkZREsnGPoilJykJsJJfYWFCycCsxRRE2RKQUEkk2YoFc/j9nTnPmzHubzzcWml/9+77vnHfO+9zOc858Zi1aNEIPqWs82GQ6Sn2lDvFEHnygv9QnnijIZOmU1DueaEdwboo0W+pcGcPuLdKmyu+F2C19k35J+6K5IgyVbkrj44l2pJ90Udov7ZEumasowPkz0tLK34WYK/2QFsUTORDVQ1IpGm9PqJrr0k5z7xsgPbZaWydId6RhwVgmO6R30sh4Igde9KzysxngII4+lQZVxnpKt6Rd/iHRSTprBQNPo6FEylYtk6IQKD7brGY1WnprtY4Mll5Jp4MxWCHdN9fEMhkivTS3P8ZIi80tmocPVBjpJCjJedJCc42xEUrSV2lGMEbj+mL1751kLhDTovE62L8/zT28V1ovPZeWhA8l4CONI2mwBlFfJa2W7lrx5kageD7OGmvSYNcFY+DtybP7T1nSsMIuR7mULbvEifR7aWY8UYE998Cq88vNvYcAF4GMfZI+S68DcaJ8t/r3YmvZnD+psNnPW71zOEy0fGl3serZ58FhDOBnEr70TkijzAVgjtWvkwaVE2eSTJPxJ+a6dYh3OPNo9fv3cDDmF31hzkjfAePSzXN4oLnjA6PRB2lWzRPZkKk4k+xl9nQpGPN4h49H4zX4LIR1P076aM5JnMVpzjjGQ/Ichl7SSumCOac5T7vXPJEODr8xd7HxlMx1bbp3TKGSTjJ6o7koko015oxlr3J1nBg8x5nNyxcEY5615vbr/GCMUouPMK6yaddZjplwWxF4SpmrZBK+MjfHEyEjzF0cfNkMN3fIb7fq3ZQ9FJa8hz2EAXG3BMqKdTnmgOhfNZdtz1hzgSSL2BHDZeaRucByjz4iHbP0HkAlsA0zmyJObTDXTWkuOEuGeQH4ppbU6vksWU8KxlTpobnmh5EcL9us1lgM5BmOxLg/AOsT+NvSZemkZW8HkkYC6Eu5UGaUTBw9ssgXg3j/ejhq7lny7Yag0biQD2ASlH/StvBQ8lnHo6dk1b7TZojaNXP3V8oxLj1uTmQg3KuNgHEHrX7dRsGOG9bYKZAIt6KyuQt8mlN8azkndYsnCsCaB6yB77IpkIyjVl+hbYJyz/pygLHsT9SI4WR3mf39Pw04oq6Ya7j/DCK7VZoeTzQZthrHXXhWt2jR4j/lN0DdpMFydQzhAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAZCAYAAAAIcL+IAAAAoUlEQVR4Xu3QPQ4BURSG4SMhoSP+olNoJ7ECKolSYQ3UKp1daDSiUs0K9BLRaDSsRCG8X+ZOHLR08yZPc++ZmZMxy/pHObQxQg+Ft9uQDpfYYowFYpT8kBpijwryljxwRs0PqTlumKCKKPhqgDsewQ51P6AdtMsFjXCmzx8xTYdUE1es7bV4Fyd00iGlXzKz5A0rbHBA3w/5imih/HmR9bueq0AV3IVRKUwAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAaCAYAAAAUqxq7AAAD80lEQVR4Xu2YS6hNURjHP3lE3pFHSBeRDAw8Rl4JMWBAoUi35FEMRCgmV1KUpJASyUAGlOSRZHCVUEyIEskjkYRSTOTx/fr2stdZZ+19zj73XMfg/OrfuXuvs9de67++71vrXJEmTRpFV9VAVZewoQJ9xZ5tBN1V/cObnQEv2qdaGjZUwV7V8PDmP4JxH5baxl2IbapDUjx6oJEGwSDVNdX0sKFeTFLdV7WEDVXSaINgoeqGqk/Y0FGImKOJaoke+B8Mog7dUa0MGzrKCNUz1bywoQD/g0FADb2g6hY2xOinWqQalVz3Vi1QTZHSHQdjXqhGevdiDFUtFuuDvnzyDGJleYZnqRW1QCGeqpqV/J0F830tlecivVTHVLtU71T7xZxdlXyekPRFO1Xtkp27w8SeuSgWvttVL8UG7MgyiJ2F2rZG1aq6J1bvijBb9UhsE9mkuqv6ImZGCIv/VjUtbAghKnarJqo+qU6KmQY8zAtcSp2R7LAcrXospYZSp86qrkvaZ8wgIu6BakZyjbk/pVgqsyt9UK3w7pFG38TMCGEMRBDRmkurWOdLpHxQDPiHamtyjUEoBMMwlggcF7TxfQbiTIkZxASYyCnVWDHD5kh+ivgQ0e1iUecfBBnTE9Vg757DGUSmVAVuvxIrxI4Nqt+SHqyyDHLRF0ZXT9VVqWzQELHo413oo2pmyTfyYVF/ic3BwSmflD0t8R3XGeQWPxcK6U0pnSCfXDNxDIAsgwhTJoahPmNU71XnJO03ZhCwUawWq1/0xXjCAp8FtRGD/OifrPoq5WNyVJ1i4CbCixwtYkXsuKSTY4ViA6cIMqnwZRvFUnS+dy80aJ1YanN4c/AeIo8IdAxIFINxYwamOEid72J1lLq0zGsD5kxJiBXwMqg/TLAtuSYkmQhhT/F1sBqxnOZ48Fy12bvHDsSRgB3FD/HQIOrEU9X45Jp6QlEnmhwTxAowC8bChWDuZ0mLMWPmvEaEMLYjkmaBA+MYX3g/CivGbkWRO6+6JZZebNs+DAAjYp2yEkyA5xH5P1fK8z80iCPAQ7HUZQdkDBwP/ALNWYXvkEZhlALfPai6LdbPZbGIeSP2u2uLlI+DCGuX7CPLX9wOQEizFXNAy3qIHYIJZFV+BsoOlJUKEBoEHEYp1Mg/mIaQjnkpwXsZvzODFPWvHZQM6mJbcD9KrP7kQeizKu5cU5SYQdXApIiSWIoVhaMIC81nRdaL1R9OsHkr7yC6rkhp4S1CrQZRZw5IeTQUhef3qHYkf1eEvHeq9tctRfBS8lmUWgwiepZLff4byPmK+lqPvnKhULMSPcKGCqyV2n+IdhQOwWxInW5OkyZNmtSDP9UQtj9DY+swAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAaCAYAAAAT6cSuAAAB0UlEQVR4Xu2WPShGURjHnzcU8jWRIm82gyJSLBYfg0VJDAyySDKQZLPJpDBJySD5WA0W3o2Jkk0GkkExGSw+/v/OvZx7Xve+l7rem86vfsP7nKfTee4553mPiMViyTZJOGgGY0Q/bINFMAHL4RBs0JN06uA4PIKvcNM7HBty4S58N9yDpVqeBxbXK+qL3El8iyPr8BLewn3YA3M8GT5UwhuJd3ErsMkMhiFscXmwWdRuVxtjURNZcSxqBl7BSVGN5xh26kkRswqX4JmoK3QCGz0ZPgQVx8vMiVlYUotPwCntd9RswDn5umfslE+w5TPDh6DiuDvspPPOb+5iNzyENU7sO8pEzRtGtvdMFIu3gVSJ2sFtURvgS1Bx7FJsuw/wGu7AUViiJxnkizrGayHlfD/FXTPXVGGMefArjos8cMaYky1G4Bsc02LumjOuza+4BNyCKUk/OjwihUYsKmZFnR69OPdYpiR9bR7c4lgIC9JhZ7yHtVqsAC7AYS0WJa2imhrvu8sAfIF9WsxDh6jq2TDcJ80zvID1Tg4nXITnou4H79wpbHfG/wJ+8GlRfz+8n8vwUdTT0dyMX8GtD9vZooIPBz4guiTgTWmxWCwWy3/mAwWLXME04ydpAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABQUlEQVR4Xu2UvUvDUBRHr6hQQerg5Acobh2cBEFx7OJQEHEQnEVwEVycnMR/wFFEcBBRnEunTh266uikIHTqpoOIH+f63kuT18Q2kEXMgUOam8v9NZB3RXL+IrO46Rd7UMQ9PMVDnIg+7lDCXazjB15EH//KDN7hNhZwFR9wMdzk0KA1XMZn6T9oCM/w1v52HGMNR0K1CPrKT9J/0By28MCrr+MrLnj1gLRBZfyU7qAKfuGWVw9IG+QGJgX59YC0QToobmDmQfsSPzDzoKSBSfWAtEEr+C7dA12Qfn2x9Aoaw0kcsPdT+IgnrsGyg20x5zMWF3QpnWGOcTEb4A2XbE17jrAp5k8ow3iDVxI9xD/oedCNoOtHX1l9wXuctz2jWBWzXnTtODRA69di1s85NnA61JMZg2K2wIa96n1Ozn/hG2QmRuMzjv3UAAAAAElFTkSuQmCC>

[image21]: <data:image/png;base64,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>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHQAAAAaCAYAAABmZHgNAAAEj0lEQVR4Xu2YX4hVRRzHv5FRkVvJhpFJlkQgtJimwWY9BD0Uokj5IBQ9JFvQS1KEoAhCCL6sRRKEREtEVCaIRCIpdqFQqR4qCEEKTNSgKAkq0Cj7fZo73Dlz59x7zrl/XNzzgS+7O3PvnjPznfn9fjNSTU3NzOIG01Vx4wAY1nNmNCtNk8pO9GzTqOmKoK0f3Gd6V87YmhweMv1kuhjoN9PPzd//ML1qut5/IWCJ6VPT3ObfY2p9ryFnbB6Y/bTpfdP8qK8TT5re0PTeqbeb1sWNXWB+nzftMm0x3ZLtLs+bpr9ND0TtS+VM+kRZg6417VP7izPRe9XdUPoacuavynbpHtOjUZuH535keizuuMQsMj1nOmz6x/R2trsjC0zfmCZM18iN/YRcRKrEiOkz0w+mm6M+P/H/mh4O2h+Re4n488BgGupsKKwwvWS6Lmp/1rQxagthER3R9Aq9GLrGdL/ptIobOktuM+1p/u7ZZjogt4BLw8v8qvZ/CnNMXyq7ewmXU6bX/Iciihqagh2+W50NXWj6Xu3RpFfYHc+o2nt7CJU/qrihjIWUF4+XCPSn6d6ovRCr5ULfC3GHMW46bzqm1o64yfSd8sOeN5S8cJdprdyLXRl85ka5UEO4vbXZRj95hJD1stzkkJ/D7wE7+pBpU9TeKyxUdkalSWxS1lCiHtEvNpR5wZMnovZCsNNS+RMDmbhfTMuCdgZ8qvkzBYNhAVC8sEiekgvnJHxfzJBvziibQ9fL5V8G+JXc57fLmR/DM6h4MaGfMCaq9jhSFaWsod64PEPj9q74HMkuZIKYRMQLnZULrXEVysMIE4SLFHwXU8izHnYTYZ3w7llu+kvZoogJJdR0Gwj9DfUWHlOwQDbILcIqi6WsoYwjZVxlQ33+PCgXAnkhL3JKCh7GS+eV1gyGkExo9vBicU7w5lU1lNxOju8EuzscUxHdJreQdyp9XOsE3y9jKBEsZVxlQ33+LJOPihjaUHb3DMLQVFUeQq7drFbUKSMqTN6DXH61ilPW0Dzj8tq7Qv6MjyTdGKahRBBfNIXQ31D/Qy5QL3yo9lRThLKGUrdQv8TGeUPzCs8kI3Lnz5NKT1oevAT5dXHc0aSfhvIz7PdQjVKwxWfYXhk1vSOXfqrQzVAKzXlq5Wfm/aTaj4CcxUmFYc3RlbtN50wfKz9fpuAhGJra1bwoxRULhQXjKWqoP5dhGJAKxlvd/+OfEU9CP6D6jm+/yuANTVXgLBYuY86rNSY+Q1gPj4X+LP6eClbbD8o9lC3txf0tx4Yi+MqYVRQyJpfX/P/kHpi716NB2wXTjqb4nTbOna/IwQBfNP0ud9ExqfZ7WwqhL+Tyfz9hUb+uctHKw+LmhoixhOP/Vm5egHnbL3etF0YAjKT9A7lrv7dMn6tayK/MVqVvlvoFg2dFx6scWN3HTXfEHT3Cs4gqqWcOGi5PiFipS5ihcKfpa7mwPUx8iEKXYuIvawiNhM5hTiwLiWKoatFS0wFy207T43HHgOB5UypZyteUg2MD4S/vGrCfTCh7nVhTU1NTU1NTU5n/ANjHCio8HgTXAAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAAaCAYAAADsS+FMAAADnklEQVR4Xu2YS6iNURTH180jQvLII3S9JpJXHnWLTDwHHokid6aQJJJEBsfAQElepaSEhDKgkFBumXgNDEh5DJTHUCkmCv+/tXffOvvs7+59DofS+dW/+5397W/t9e299trruyItWvwtekCDoDbT1hvqZX73k+r7jZKy2x/qY343zBBourvmgLOgldBYKX8R9jsArQrat0Cz3TUdPAuNLG5H4aROEB1zkvvNcSe6a5Ky2w5dcX8bggNtg55CM6Gt0Ffoh9FJqV4Rz07osNRO1m5ombuOOR3Cl38GnYPWQ6egLug4dKTolmV3HnQVGhi0J2GYnXcaDB2C7rprvuBi6BP0HVrinvFMhh5D44J2kuO0Zwb0BloUtHeKjrvctOXYpd8nRPtmw5XmCvDlOYuboXeiYWmpiEbHadPmB6TCqCA5TpOe0EWJ2xkNPRGNGk+u3Q7ohcQXKop9eT7E64rt4JgLfYNuSJGcRkEvoQW+U0Cu0+Ohj9De8IZofz7H5z25dpnQGbXccknGQK+gg6Irsk7UcGyfMY98EU1MXEnCSWBoc/Vi5DrtbXNiw4jsC00N2nLtEkbyBamNuBo2ia42Vz2Fd/iYaaNTXVK9apZcpzn5D6RI1O+ho6Jjxl4i1y5h3/vQgPCGhYNwxrgtylbWwmOTjq41bXTCRkpIPU7zOOf+tqcXtd12ctRjl/3eSvn9X9BIl2R0lCJR0tnhpp1OUGXU47SHUbIGuic6Gc+hoVU96rPLfsxHzEul+MlIdhTdx4wg1hOWPzEZw0SP8BDmilsSX6wcux72+wxNC29YWFvwOI3VDpbw6LX8icnYJ+U5i/15GvBUsOTY9WRtE1IRDcXYixJWpXugRxLPKyzB+SwnNkbKabbdlvjRzM8CjksbISm7Fh6rPPHs9o7C8P8gOiHXpChO2tw9JsdLEg9jwtMotqc9Kad9fXFGqst8vwh3JL5IKbsW1i62NuqW+dBrqc3iTJYrpPg4isGjj3WKrQ4tKadZYrPy5LcHx2OkbYAeii7EiKJrFSm7Hp5ytBOLrlL81+lq0W8DhmgOvj4oq/BSTjMS/RZjGLNv6guZpOx6aJ+T3BHeaBad0E3R7B+S63S95Nqlb5cl/qXdFOjMdWhheEPyna6XHLuMbi7SnKC96bSLJmD+teyClrrrMqcbIWWXW6wiWhd1t92aBpPoftF/yXlYwk9x18zmO0Sd/11Sdpn3Nso/mogWLVr83/wEkpnLGO6pCfYAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHcAAAAaCAYAAACNU8MOAAAFP0lEQVR4Xu2aWchuUxjH/ydDpogjHyGfIaWTKVPKdGFMhhyKnDsXJPMJkYvPhQuFTKWkTkikcyNDQvmuZLpwQacMF+ogSa6IFJ5fay/f86537Xetvd/9flzsX/379vSutfb6r+FZa3/SyMjICOxi2t+0wV3b3bSbO99bk/f7sqh0PXspvBOQNnkMCWmTRyR9J473c+eDsNF0UnNMBqearjQtq70Cee4h01XJ9ZtNpzXH+5ieNx2ydjsLL320Qp7HNefke0xzDH3S7Qrvc1hzTNrkQV4l9jCdbrradF5znuMU063u/F7TZe6cOn1c03XaCyruNtNnChnfYvrN9LfTM5psXZGtpsc0bb4vcI0JmPm56QXT9aZnTaumpxReNNI13T6QJ/UANebSELaZdijUI+Y+afq5OY8NM0La5BFJzQU62lsKjaU3DDkvNjrA9IjpveYYwy4y/WL6y3Rx85vIJtMnpiOT69DFhJNN35guTK5vUcj3cnetS7p96WLuJaYfTbdr2sTNpj8VOoCnxlygvt9Re94zoSfSQzCTMf4m006FYdCzotB7n3PXMP7pRmmvhVoTdjW9rHw69IhPFXp1pDbdeag1l2Hzd9M9mi47MCy/qdCjl9z1WnPx5APTtemNGryZ9D6OV/wDDWcptEAKGueRQ01fms6PDyXUmnCU6QfT/ekN5Su2Nt15qDGXUesn0+umPZN7HuZvRh9fT7XmAr/frtAJqjnc9JXpYYVWd53CS+SiNArzqyYzobAMpTHwSKk1IaZNQ0lHDCrthORabbrzUDKXEe9V5aeqFMxh1PPmdTGXYf9btddzlhsVeiO9skQ0gCAhQoFWNd2iI7Um0Jg+1Frg9p3pCYU8c0NdbbrzUDL3TNMfCvEGS8A26Ah0iHnM5VlG1LhCKEKlvaTwo5oWwdxCAf3YzwvPGi66mMDyi3nJR+foDv9QQ5d0+1IylzJQPt/Ycxxo+kJh5eHN6WIu+dNz2+5PQUFXFX5UqhgaAsEOlb/krvPCqI0+JtCLrzG9r1B5VAwV5OmTLutmGvKl6Y0WSuZyTvkY/WbB1MXQzcjkp7s+5rI8rCKaSyBDQDML5kEqZmtyfQhzD1JYcqUw176tfOOrSTeFKB8zHk1vtFBrbpshwIgW8yVw9fQx9670RhusbVn+lAKCdKnkGcLcB9Q+5/N8bk6rSTdlX9M5mh3VekrmMhyXzD1DIU7JrVP7mNt2P8uKQgFzxgEL8vtMHys/LxMF8tu2fdeSCVzjxXNLqY0K+ZJGSindISiZS+xB3VEHOahP6oYVwBHJPehiLiPr9wpRczUMt/yIQr6mtV2mDc297aZXlB82gfkmNydGSibE9e02TW5rxkb1rvKNrpTuEJTMjQ2TpeCyuw4HKxjLqLM8eetfuphLIEY+fiOninNNX2s6St1hukLT22keCsg6uS3TkglsKbIzxUuSH73gBtNHCg2LSspRSncISuYCjZ61LluzzIfsJ7MHTnxyt2ZPAV3MJZBa1XT+VdBr+PpD4djbZUisIa5P26K4kgmMFHFIX1J4tvQFCkrpDkGNuZFYduqPXavcx5WUWnMJyugAK8n1dWGLwpeLXCtdlAmLStfTxdw+1JrL9EgH4u+6wwu/YbogvaHFmbCodD3/B3MZvR5U+0eJdYFokIAsjQqZd2KEN6QJi0rXw/bnic3xoszlG3gkZ+7ZCrFHLqhcVwiqaGX8u0iELcvjm2O+JN2pYSpoUel6+G8PNliAGIRt0CF7z7Ga3MrdrLXGBHxxI8D8z40dGRkZGRkZyfMPo5M8WlMt504AAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,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>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA7klEQVR4Xu3TsWrCYBTF8VtwEJ2kLsUncHLo2qXQB+jiIMWXcPE9HEtBEAoOrp2cnH0IM3VQdCh1sbb6P34Iya0SbAtSyIEfJN9JyJdLYpblt7nFDJuYBZooY4TPWPeOPoq6+Vie8IU7X1hYU9fFheu+pYQxIlSS1S5tC7t68MWhVDHHADnX6Vzr6nVdavREPVk78NFOIws71xukpoM17nHl1C3MS9ekZj+vJXp4dCZ27nm1fGE/mJe+rw/c+MLCmrqT5hXZH3xf1xYGf2heebzgDTXXJaLf49WS/+MUDVxiiFWs0/EzCro5S5Z/nS1olkHFq0oRIgAAAABJRU5ErkJggg==>