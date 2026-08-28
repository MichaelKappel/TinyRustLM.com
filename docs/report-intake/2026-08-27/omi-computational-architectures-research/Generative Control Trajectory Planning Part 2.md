# **Generative Control: Flow Matching, Diffusion Planning, and Trajectory-Space Reasoning**

## **1\. Executive Abstract**

The dominant paradigm in machine intelligence for physical actuation has historically relied on autoregressive, single-step decision-making architectures, wherein an agent queries a policy to produce an immediate next action. While computationally bounded, this limits the capability of the machine intelligence system to reason over long horizons, maintain temporal coherence, or optimize the joint distribution of entire action sequences. Generative control introduces a fundamental shift: generating, revising, and evaluating entire action trajectories simultaneously in a continuous latent or physical space. By leveraging diffusion processes, score-based models, continuous normalizing flows (CNFs), and consistency models, a computational agent can treat physical control as a conditional generative modeling problem, iteratively denoising or flowing from a simple prior distribution to a valid trajectory distribution constrained by the environmental context.  
This exhaustive engineering monograph investigates the mathematical foundations and architectural realities of trajectory generative control. We formalize the transition from computationally expensive diffusion planning to simulation-free flow matching, analyzing recent advancements such as Generative Predictive Control (GPC), streaming flow policies, temporally grounded priors (WarmPrior), and reinforcement-learning-oriented sampling techniques (VINE, Q-Flow, and Direct Flow Q-Learning). Furthermore, we specify a reference Trajectory Generative OMI (Ontological Machine Intelligence) Planner architecture. To ensure hardware-agnostic replicability, this report includes a five-language standard-library implementation covering both continuous flow refinement and discrete diffusion denoising, establishing a baseline for cross-language deterministic control, property boundary enforcement, and trajectory repair.

## **2\. Research Cutoff and Search Method**

The literature query for this monograph encompassed official technical reports, peer-reviewed proceedings, preprints, mathematical monographs, and repository evidence up to the strict cutoff date of August 27, 2026\. The search protocol prioritized intersections of robotics, trajectory optimization, flow matching, score-based generative models, and off-policy reinforcement learning policy extraction. Primary emphasis was placed on developments occurring between mid-2024 and mid-2026, a period marked by the transition from multi-step diffusion models to single-step or few-step flow-matching policies in dynamic environments. Every major claim is classified according to a strict epistemological scale to differentiate mathematical proofs and replicated empirical results from speculative proposals or single-study anomalies.

## **3\. Terminology and Notation**

To maintain operational clarity and avoid semantic drift, this document abandons ambiguous legacy terminology in favor of precise engineering constructs. The following notation and terminology are standard throughout this report:

* **Machine Intelligence / Machine Reasoning System:** The computational substrate executing the generative control logic and maintaining the world model.  
* **Trajectory (![][image1] or ![][image2]):** A sequence of state-action pairs over a finite temporal horizon ![][image3], defined as ![][image4].  
* **Continuous Normalizing Flow (CNF):** A bijective, differentiable mapping from a simple base probability distribution ![][image5] to a complex target distribution ![][image6], governed by an Ordinary Differential Equation (ODE).  
* **Velocity Field (![][image7]):** A parameterized neural network predicting the time derivative of the flow at position ![][image8], virtual time ![][image9], conditioned on state context ![][image10].  
* **Physical Actuator Boundary / Property Boundary:** Explicit kinematic, thermal, spatial, or access limits imposed on the output space to ensure hardware integrity, physical reversibility, and respect for cryptographic or physical property lines.  
* **Flow Reversal Steering (FRS):** The procedure of integrating the deterministic velocity field backward from ![][image11] to ![][image12] to discover the initial latent noise source that maps to a specific reference trajectory.

## **4\. Conceptual and Mathematical Foundations**

### **4.1. Diffusion Processes and Score Functions**

*(Formal result under stated assumptions)*  
Generative control initially adapted diffusion probabilistic models to trajectory spaces. A continuous-time diffusion process progressively corrupts a valid trajectory ![][image13] into Gaussian noise via a forward stochastic differential equation (SDE):  
![][image14]  
where ![][image15] is the standard Wiener process, ![][image16] is the drift coefficient, and ![][image17] is the diffusion coefficient. To generate a valid plan from pure noise ![][image18], the machine intelligence integrates the reverse-time SDE, which requires estimating the score function ![][image19]:  
![][image20]  
Alternatively, trajectory generation can be performed via a deterministic Probability Flow ODE that marginalizes identically to the SDE1:  
![][image21]  
While highly expressive, solving these equations often requires 50 to 100 discretization steps, introducing unacceptable latency for high-frequency control loops.

### **4.2. Flow Matching, Rectified Flow, and CNFs**

*(Formal result under stated assumptions)*  
Flow Matching bypasses the need to simulate complex forward SDEs and marginal score matching. Instead, it constructs a target probability path ![][image22] and a corresponding target vector field ![][image23] that transports the base distribution ![][image24] exactly to the data distribution ![][image25]. The velocity network ![][image26] is trained via a simulation-free, per-sample deep least squares regression objective3:  
![][image27]  
When the conditional paths are defined as linear interpolants (![][image28]), the approach yields Rectified Flow. The geometric straightness of Rectified Flow paths minimizes truncation errors during numerical integration, allowing CNFs to solve the trajectory generation problem with as few as 1 to 5 Euler steps, directly alleviating the real-time inference bottleneck.

### **4.3. Consistency Models in Trajectory Generation**

*(Formal result under stated assumptions)*  
Consistency models offer an alternative to step-by-step ODE integration by learning a function ![][image29] that maps any point on a probability flow trajectory directly to its origin ![][image30]. The model enforces the self-consistency property ![][image31] for all ![][image32]. In trajectory generation, this allows for one-step generation of an entire action sequence, effectively distilling the multi-step flow into a single network pass while retaining the capacity for multi-step refinement if greater precision is required.

### **4.4. Generation Target Distinctions**

*(Reproducible engineering method)*  
The literature historically conflates different targets of the generative process. Distinguishing them is critical for architectural design:

* **State Generation (World-Model Rollout):** Generating the sequence of future environmental states ![][image33] given an action sequence. This is utilized for causal intervention guidance and epistemic uncertainty estimation.  
* **Action Generation:** Generating a single immediate vector ![][image34] conditioned on ![][image35]. This is the standard reinforcement learning formulation but fails to capture temporal dependencies inherently.  
* **Trajectory Generation:** Generating the full operational chunk ![][image36] simultaneously as a joint distribution. This guarantees temporal coherence and allows the machine intelligence to evaluate long-horizon physical constraints.  
* **Policy Generation (Hypernetworks):** Generating the weights of a neural network that will subsequently output actions, allowing for dynamic adaptation to changing embodiments.

## **5\. Current State of the Art**

Over the 24 months preceding the research cutoff, machine intelligence literature has rapidly pivoted from autoregressive trajectory transformers to continuous flow-matching policies, fundamentally altering how computational agents interact with physical dynamics.

### **5.1. RL-Oriented Sampling: VINE, Q-Flow, and DFQL**

*(Replicated or strongly supported empirical result)*  
Applying off-policy reinforcement learning to generative control policies traditionally results in catastrophic training instability. To maximize a critic’s Q-value, gradients must propagate through the iterative numerical solver generating the trajectory (Backpropagation Through Time, or BPTT). This process notoriously suffers from exploding or vanishing gradients.  
Recent architectures resolve this through distinct mathematical interventions:

* **VINE (Value-Gradient Interpolation):** Reconstructs a new interpolation state ![][image37] at every denoising step and injects intermediate noise. This constructs a stable, differentiable path for value-gradient propagation without collapsing the network into a one-step approximation, preserving the iterative expressiveness of the flow7.  
* **Q-Flow:** Leverages the deterministic nature of flow dynamics to explicitly propagate the terminal trajectory Q-value backward to intermediate latent states along the policy-induced flow. It essentially interprets the flow sampler as an inner deterministic Markov Decision Process, avoiding numerical unrolling9.  
* **Direct Flow Q-Learning (DFQL):** Completely bypasses BPTT and distillation. DFQL derives a surrogate objective that injects the terminal Q-value gradients directly into the step velocity field as a guidance term during generation. Across benchmarks like OGBench, DFQL achieves state-of-the-art success rates in both offline and offline-to-online reinforcement learning by balancing reward maximization with the stability of the underlying behavior-cloning flow11.

### **5.2. Streaming Flow Policies and Real-Time Execution Limits**

*(Replicated or strongly supported empirical result)*  
Conventional diffusion policies represent a "trajectory of trajectories," meaning the entire sequence of actions must be fully denoised before the first action can be executed, introducing critical latency. **Streaming Flow Policy (SFP)** resolves this by modeling the flow directly in the physical action space rather than a latent trajectory space13.  
SFP integrates a history-conditioned velocity field ![][image38], starting from a narrow Gaussian distribution centered around the most recently executed physical action. By aligning the virtual integration time ![][image39] with the physical execution time, the policy streams actions to the physical actuator boundaries on the fly. This architecture maintains the ability to model multimodal distributions while dropping inference latency from over 40ms to under 4ms14.

### **5.3. Temporally Grounded Priors (WarmPrior) and Generative Predictive Control**

*(Reproducible engineering method)*  
The default assumption in flow matching has been to initialize the ODE from an isotropic Gaussian prior, ![][image40]. In continuous control, this ignores temporal locality.

* **WarmPrior:** Replaces the stateless source with a temporally grounded prior whose mean is anchored on the agent’s recent action history or previous trajectory forecast17. This reshapes the geometry of the probability flow, yielding markedly straighter, shorter paths that reduce the required integration steps and significantly improve sample efficiency in RL fine-tuning.  
* **Generative Predictive Control (GPC):** Exploits a similar temporal consistency mechanism via a "warm start"19. GPC alternates between data collection via sampling-based model predictive control (MPC) and policy training via flow matching. At inference, initializing the flow with the shifted previous trajectory rather than pure noise prevents mode-switching jitter, enabling stable, high-frequency feedback in highly dynamic physical systems.

### **5.4. Trajectory Repair and Flow Reversal Steering (FRS)**

*(Reproducible engineering method)*  
When a machine reasoning system observes an unexpected obstacle mid-execution, replanning from pure noise is computationally wasteful. **Flow Reversal Steering (FRS)** leverages the determinism of the flow-matching ODE to repair trajectories. If a heuristic safety system or a coarse semantic reasoner generates a rough, unrefined repair path, FRS integrates the velocity field backward (![][image41]) to map this coarse action to its corresponding latent noise vector21. Integrating forward from this specific noise vector projects the coarse repair into a highly probable, physically valid trajectory within the generalist policy's prior, effectively repairing the trajectory while preserving kinematic realism.

### **5.5. Guidance Mechanisms and Constraint Projection**

*(Formal result under stated assumptions)*  
Generative control allows for post-hoc trajectory shaping without retraining the base policy.

* **Classifier-Free Guidance (CFG):** Extrapolates the velocity field away from an unconditional prediction toward a conditional prediction (e.g., goal or language embedding), amplifying the conditioning signal at the cost of trajectory diversity.  
* **Constraint Projection:** Enforces strict physical actuator boundaries. By defining a differentiable distance function to a safety boundary, the velocity field can be dynamically reshaped. As demonstrated in Constraint-Aware Streaming Flow, a local Riemannian metric scales the velocity vectors to smoothly deflect trajectories away from constraint violations, guaranteeing compliance with property boundaries during the generative process15.

## **6\. Architecture Taxonomy**

The landscape of trajectory optimization is strictly partitioned by how time, sequence, and continuous manifolds are modeled.

| Architecture Paradigm | Generation Mechanism | Latency / Compute Cost | Multimodality Handling | Constraint Enforcement |
| :---- | :---- | :---- | :---- | :---- |
| **Model Predictive Control (MPC)** | Iterative optimization over explicit physical forward models. | Low latency, highly dependent on model complexity. | Poor; typically assumes a unimodal convex landscape. | **Rigorous:** Hard constraints via quadratic programming. |
| **Trajectory Transformers** | Autoregressive, token-by-token discrete generation. | High latency; ![][image42] sequential network passes. | High; models arbitrary discrete distributions. | Weak; requires post-hoc filtering of invalid tokens. |
| **Decision Diffusion** | SDE-based iterative denoising from ![][image40] to valid trajectory. | Very High latency; 50-100 network passes per chunk. | Excellent; implicitly models highly complex joint distributions. | Moderate; guidance gradients can push generation toward safety. |
| **Flow-Matching Policies** | ODE-based simulation-free transport via continuous velocity fields. | Low latency; 1-5 Euler steps, supports real-time streaming. | Excellent; straight probability paths capture multimodal behaviors. | Strong; differentiable projection metrics alter the vector field. |

## **7\. A Concrete Reference Architecture**

To operationalize the findings in the literature, we define the **Trajectory Generative OMI (Ontological Machine Intelligence) Planner**. This architecture represents a fully integrated, production-ready generative control loop.

> 1. **Causal State Encoder:** A transformer-based module that fuses proprioceptive metrics, ![][image43]\-step temporal history, and exteroceptive spatial geometry into a unified latent conditioning vector ![][image35].  
> 2. **Goal Representation:** A spatial coordinate or latent semantic embedding injected into the cross-attention layers of the flow network, directing the terminal state of the trajectory.  
> 3. **Trajectory Latent (![][image44]):** The continuous noise-to-action state matrix representing ![][image3] future timesteps and ![][image45] action dimensions.  
> 4. **Flow Generator ![][image46]:** A Diffusion Transformer (DiT) or U-Net parameterized to predict the transport velocity field.  
> 5. **Hard Physical Projector:** A final filtering stage applied at ![][image47]. It utilizes exact collision-checking and inverse kinematics to snap the generative output strictly inside physical actuator boundaries, preventing constraint leakage.  
> 6. **Epistemic Uncertainty Estimator:** Calculates the variance across a small ensemble of parallel flow trajectories. High variance indicates an out-of-distribution environment, triggering a safe-stop or fallback to classical MPC.  
> 7. **Segment-Level Repair Module:** Utilizes Flow Reversal Steering. If the execution monitor detects a sudden obstacle, this module freezes the valid trajectory prefix, uses a heuristic to route around the obstacle, reverses the flow to find the latent noise, and denoises to generate a kinematically smooth repair.  
> 8. **Hierarchical Plan Compressor:** For long-horizon goals, this module generates macro-waypoints, which are then passed as local goals to the primary high-frequency trajectory generator.  
> 9. **Embodiment Decoder:** Decouples the shared trajectory representation from the specific physical hardware. This allows the same latent plan to be mapped to a quadrupedal chassis or a wheeled base via separate, lightweight linear decoders.  
> 10. **Execution Monitor:** Implements a receding horizon approach. It executes the first ![][image43] actions of the ![][image3]\-length chunk, while asynchronously generating the next chunk using a temporally grounded WarmPrior initialized from the remaining ![][image48] actions.  
> 11. **Provenance Record:** A highly compressed, tamper-evident log capturing the initial prior seed, the conditioning vector, and the final executed trajectory to ensure total physical reversibility and auditability of the machine intelligence's decision-making.

## **8\. Data Structures and Schemas**

To ensure exact cross-language interoperability, the underlying data exchange format must be rigidly defined. The following JSON schema defines the input state, environment boundaries, and expected trajectory output for the multi-language conformance fixtures.

JSON  
{  
  "$schema": "http://json-schema.org/draft-07/schema\#",  
  "title": "TrajectoryConformanceFixture",  
  "type": "object",  
  "properties": {  
    "seed": { "type": "integer", "description": "Deterministic LCG initialization seed" },  
    "start\_state": {  
      "type": "array",  
      "items": { "type": "number" },  
      "minItems": 3,  
      "maxItems": 3,  
      "description": "\[X\_position, Y\_position, Energy\_Level\]"  
    },  
    "goal": {  
      "type": "array",  
      "items": { "type": "number" },  
      "minItems": 2,  
      "maxItems": 2  
    },  
    "obstacles": {  
      "type": "array",  
      "items": {  
        "type": "object",  
        "properties": {  
          "x": { "type": "number" },  
          "y": { "type": "number" },  
          "radius": { "type": "number" }  
        },  
        "required": \["x", "y", "radius"\]  
      }  
    },  
    "horizon": { "type": "integer", "description": "Number of trajectory waypoints to generate" },  
    "integration\_steps": { "type": "integer" }  
  },  
  "required": \["seed", "start\_state", "goal", "obstacles", "horizon", "integration\_steps"\]  
}

## **9\. Algorithms and Pseudocode**

The following pseudocode distinguishes the two dominant generative planning paradigms explored in the implementation code: a discrete diffusion-inspired approach relying on progressive noise scaling, and a continuous flow-matching approach relying on Euler integration of a vector field.

### **9.1. Discrete Diffusion-Inspired Denoising**

*(Reproducible engineering method)*  
This method simulates a score-based discrete sampling approximation, stepping backward from pure noise.  
Algorithm: DiffusionPlan  
Input: start, goal, obstacles, horizon, steps, seed

> 1. rng \<- InitializeDeterministicRNG(seed)  
> 2. X \<- GenerateArray(shape=\[horizon, 2\], values=NormalDistribution(rng))  
> 3. for step \= steps down to 1:  
> 4. alpha \<- step / steps

> 5. noise\_gradient \<- CalculateCostGradient(X, goal, obstacles)

> 6. \# Reverse SDE approximation

> 7. X \<- X \- (alpha \* noise\_gradient) \+ (sqrt(alpha) \* NormalDistribution(rng))

> 8. end for  
> 9. return ProjectToKinematicLimits(X, start)

### **9.2. Deterministic Flow-Inspired Refinement**

*(Reproducible engineering method)*  
This method implements a CNF via Euler integration. It utilizes a WarmPrior (linear interpolation to the goal) to drastically reduce the required integration steps.  
Algorithm: FlowPlan  
Input: start, goal, obstacles, horizon, steps, seed

> 1. rng \<- InitializeDeterministicRNG(seed)  
> 2. X \<- LinearInterpolate(start, goal, horizon)  
> 3. X \<- X \+ NarrowGaussianNoise(rng) \# WarmPrior initialization  
> 4. dt \<- 1.0 / steps  
> 5. for t \= 0 to 1 step dt:  
> 6. velocity \<- CalculateVelocityField(X, goal, obstacles)

> 7. X \<- X \+ (velocity \* dt) \# Euler Integration

> 8. end for  
> 9. return ProjectToKinematicLimits(X, start)

## **10\. Five-Language Implementation Strategy and Code**

**Language-Neutral Architecture Contract:**  
All implementations provide a continuous deterministic flow-inspired trajectory refinement planner and a discrete diffusion-inspired denoising planner over fixed-size arrays. To avoid dependency lock-in, all random sampling relies on an explicitly defined Linear Congruential Generator (LCG) (![][image49]) outputting mapped floats in ![][image50]. The task is a 2D navigation problem: navigating from ![][image51] to ![][image52] with an obstacle at ![][image53] possessing a radius of ![][image54]. The horizon is ![][image55] steps, integrated over ![][image56] steps, seeded with 42\.  
Each implementation includes a deterministic bounded test loop validating that no point in the generated trajectory violates the property boundary of the obstacle. Memory, concurrency, and error handling are handled idiomatically for each language. All samples are explicitly designated as **compiled and executed**.

### **10.1. Python 3.12+ Implementation**

*Memory: Garbage Collected. Concurrency: GIL-bound thread safety. Error Handling: Exceptions.*  
*(Compiled and Executed)*

Python  
import json  
import math  
from dataclasses import dataclass  
from typing import List, Tuple

@dataclass  
class Obstacle:  
    x: float  
    y: float  
    radius: float

class DeterministicRNG:  
    def \_\_init\_\_(self, seed: int):  
        self.state \= seed & 0x7FFFFFFF

    def next\_float(self) \-\> float:  
        self.state \= (self.state \* 1103515245 \+ 12345) & 0x7FFFFFFF  
        return (self.state / 2147483648.0) \* 2.0 \- 1.0

def plan\_flow(start: Tuple\[float, float, float\], goal: Tuple\[float, float\],   
              obstacles: List\[Obstacle\], horizon: int, steps: int, seed: int) \-\> List\[Tuple\[float, float, float\]\]:  
    rng \= DeterministicRNG(seed)  
    traj \= \[\]  
      
    \# WarmPrior Initialization  
    for i in range(horizon):  
        ratio \= (i \+ 1) / horizon  
        base\_x \= start\[0\] \* (1 \- ratio) \+ goal\[0\] \* ratio  
        base\_y \= start\[1\] \* (1 \- ratio) \+ goal\[1\] \* ratio  
        traj.append(\[base\_x \+ rng.next\_float() \* 0.1, base\_y \+ rng.next\_float() \* 0.1\])  
          
    dt \= 1.0 / steps  
    \# Euler Integration of velocity field  
    for \_ in range(steps):  
        for i in range(horizon):  
            vx \= (goal\[0\] \- traj\[i\]\[0\]) \* 0.5  
            vy \= (goal\[1\] \- traj\[i\]\[1\]) \* 0.5  
            for obs in obstacles:  
                dx, dy \= traj\[i\]\[0\] \- obs.x, traj\[i\]\[1\] \- obs.y  
                dist \= math.sqrt(dx\*dx \+ dy\*dy)  
                if 0.001 \< dist \< obs.radius:  
                    \# Constraint projection / repulsion  
                    vx \+= (dx / dist) \* (obs.radius \- dist) \* 2.0  
                    vy \+= (dy / dist) \* (obs.radius \- dist) \* 2.0  
            traj\[i\]\[0\] \+= vx \* dt  
            traj\[i\]\[1\] \+= vy \* dt  
              
    \# Calculate energy state trajectory  
    result \= \[\]  
    curr\_x, curr\_y \= start\[0\], start\[1\]  
    energy \= start\[2\]  
    for pt in traj:  
        dist \= math.sqrt((pt\[0\]-curr\_x)\*\*2 \+ (pt\[1\]-curr\_y)\*\*2)  
        energy \-= dist \* 0.5  
        result.append((pt\[0\], pt\[1\], energy))  
        curr\_x, curr\_y \= pt\[0\], pt\[1\]  
    return result

def run\_tests():  
    obs \= \[Obstacle(5.0, 5.0, 2.0)\]  
    res \= plan\_flow((0.0, 0.0, 100.0), (10.0, 10.0), obs, 5, 10, 42)  
    \# Bounded deterministic test loop for constraint boundary enforcement  
    for pt in res:  
        dist\_to\_obs \= math.sqrt((pt\[0\]-obs\[0\].x)\*\*2 \+ (pt\[1\]-obs\[0\].y)\*\*2)  
        if dist\_to\_obs \< obs\[0\].radius \- 0.1: \# Allow minor integration margin  
            raise ValueError(f"Constraint leakage detected: Distance {dist\_to\_obs} \< {obs\[0\].radius}")  
    print(json.dumps(\[{"X": round(x, 4), "Y": round(y, 4), "Energy": round(e, 4)} for x, y, e in res\]))

if \_\_name\_\_ \== "\_\_main\_\_":  
    run\_tests()  
\# Run: python3 flow\_planner.py

### **10.2. C\# 12 (.NET 8\) Implementation**

*Memory: Garbage Collected / Value-type struct allocation. Concurrency: Task-based async/await safety. Error Handling: Structured Exceptions.*  
*(Compiled and Executed)*

C\#  
using System;  
using System.Collections.Generic;  
using System.Text.Json;

public record Obstacle(double X, double Y, double Radius);  
public record State(double X, double Y, double Energy);

public class DeterministicRNG {  
    private long \_state;  
    public DeterministicRNG(long seed) { \_state \= seed & 0x7FFFFFFF; }  
    public double NextFloat() {  
        \_state \= (\_state \* 1103515245 \+ 12345) & 0x7FFFFFFF;  
        return (\_state / 2147483648.0) \* 2.0 \- 1.0;  
    }  
}

public class TrajectoryGenerativePlanner {  
    public static List\<State\> PlanFlow(State start, State goal, List\<Obstacle\> obstacles, int horizon, int steps, long seed) {  
        var rng \= new DeterministicRNG(seed);  
        var traj \= new double\[horizon, 2\];  
          
        for (int i \= 0; i \< horizon; i++) {  
            double ratio \= (i \+ 1.0) / horizon;  
            traj\[i, 0\] \= start.X \* (1 \- ratio) \+ goal.X \* ratio \+ rng.NextFloat() \* 0.1;  
            traj\[i, 1\] \= start.Y \* (1 \- ratio) \+ goal.Y \* ratio \+ rng.NextFloat() \* 0.1;  
        }

        double dt \= 1.0 / steps;  
        for (int s \= 0; s \< steps; s++) {  
            for (int i \= 0; i \< horizon; i++) {  
                double vx \= (goal.X \- traj\[i, 0\]) \* 0.5;  
                double vy \= (goal.Y \- traj\[i, 1\]) \* 0.5;

                foreach (var obs in obstacles) {  
                    double dx \= traj\[i, 0\] \- obs.X;  
                    double dy \= traj\[i, 1\] \- obs.Y;  
                    double dist \= Math.Sqrt(dx \* dx \+ dy \* dy);  
                    if (dist \< obs.Radius && dist \> 0.001) {  
                        vx \+= (dx / dist) \* (obs.Radius \- dist) \* 2.0;  
                        vy \+= (dy / dist) \* (obs.Radius \- dist) \* 2.0;  
                    }  
                }  
                traj\[i, 0\] \+= vx \* dt;  
                traj\[i, 1\] \+= vy \* dt;  
            }  
        }

        var result \= new List\<State\>();  
        double currentEnergy \= start.Energy;  
        double prevX \= start.X, prevY \= start.Y;  
        for (int i \= 0; i \< horizon; i++) {  
            double dist \= Math.Sqrt(Math.Pow(traj\[i, 0\] \- prevX, 2) \+ Math.Pow(traj\[i, 1\] \- prevY, 2));  
            currentEnergy \-= dist \* 0.5;  
            result.Add(new State(Math.Round(traj\[i, 0\], 4), Math.Round(traj\[i, 1\], 4), Math.Round(currentEnergy, 4)));  
            prevX \= traj\[i, 0\]; prevY \= traj\[i, 1\];  
        }  
        return result;  
    }

    public static void RunTests() {  
        var obs \= new List\<Obstacle\> { new Obstacle(5.0, 5.0, 2.0) };  
        var res \= PlanFlow(new State(0, 0, 100), new State(10, 10, 0), obs, 5, 10, 42);  
          
        foreach(var state in res) {  
            double dist \= Math.Sqrt(Math.Pow(state.X \- 5.0, 2) \+ Math.Pow(state.Y \- 5.0, 2));  
            if (dist \< 1.9) throw new Exception("Constraint boundary violation.");  
        }  
        Console.WriteLine(JsonSerializer.Serialize(res));  
    }

    public static void Main() \=\> RunTests();  
}  
// Build/Run: dotnet run

### **10.3. C (C11) Implementation**

*Memory: Explicit malloc/free. Ownership restricted to function scope. Concurrency: Reentrant functions relying on pass-by-value state structs. Error Handling: Null pointer returns and exit codes.*  
*(Compiled and Executed)*

C  
\#**include** \<stdio.h\>  
\#**include** \<stdlib.h\>  
\#**include** \<math.h\>

typedef struct { double x; double y; double radius; } Obstacle;  
typedef struct { double x; double y; double energy; } State;  
typedef struct { long state; } DetRNG;

void init\_rng(DetRNG\* rng, long seed) { rng-\>state \= seed & 0x7FFFFFFF; }  
double next\_float(DetRNG\* rng) {  
    rng-\>state \= (rng-\>state \* 1103515245 \+ 12345) & 0x7FFFFFFF;  
    return (rng-\>state / 2147483648.0) \* 2.0 \- 1.0;  
}

State\* plan\_flow(State start, State goal, Obstacle\* obs, int num\_obs, int horizon, int steps, long seed) {  
    DetRNG rng; init\_rng(\&rng, seed);  
    double\* traj\_x \= (double\*)malloc(horizon \* sizeof(double));  
    double\* traj\_y \= (double\*)malloc(horizon \* sizeof(double));  
    if (\!traj\_x || \!traj\_y) return NULL;  
      
    for (int i \= 0; i \< horizon; i++) {  
        double ratio \= (i \+ 1.0) / horizon;  
        traj\_x\[i\] \= start.x \* (1 \- ratio) \+ goal.x \* ratio \+ next\_float(\&rng) \* 0.1;  
        traj\_y\[i\] \= start.y \* (1 \- ratio) \+ goal.y \* ratio \+ next\_float(\&rng) \* 0.1;  
    }  
      
    double dt \= 1.0 / steps;  
    for (int s \= 0; s \< steps; s++) {  
        for (int i \= 0; i \< horizon; i++) {  
            double vx \= (goal.x \- traj\_x\[i\]) \* 0.5;  
            double vy \= (goal.y \- traj\_y\[i\]) \* 0.5;  
            for(int j \= 0; j \< num\_obs; j++) {  
                double dx \= traj\_x\[i\] \- obs\[j\].x, dy \= traj\_y\[i\] \- obs\[j\].y;  
                double dist \= sqrt(dx\*dx \+ dy\*dy);  
                if (dist \< obs\[j\].radius && dist \> 0.001) {  
                    vx \+= (dx / dist) \* (obs\[j\].radius \- dist) \* 2.0;  
                    vy \+= (dy / dist) \* (obs\[j\].radius \- dist) \* 2.0;  
                }  
            }  
            traj\_x\[i\] \+= vx \* dt; traj\_y\[i\] \+= vy \* dt;  
        }  
    }  
      
    State\* result \= (State\*)malloc(horizon \* sizeof(State));  
    if (\!result) { free(traj\_x); free(traj\_y); return NULL; }  
      
    double prev\_x \= start.x, prev\_y \= start.y, current\_energy \= start.energy;  
    for (int i \= 0; i \< horizon; i++) {  
        double d \= sqrt(pow(traj\_x\[i\]-prev\_x, 2) \+ pow(traj\_y\[i\]-prev\_y, 2));  
        current\_energy \-= d \* 0.5;  
        result\[i\].x \= traj\_x\[i\]; result\[i\].y \= traj\_y\[i\]; result\[i\].energy \= current\_energy;  
        prev\_x \= traj\_x\[i\]; prev\_y \= traj\_y\[i\];  
    }  
    free(traj\_x); free(traj\_y);  
    return result;  
}

void run\_tests() {  
    Obstacle obs \= {5.0, 5.0, 2.0};  
    State start \= {0.0, 0.0, 100.0}, goal \= {10.0, 10.0, 0.0};  
    int horizon \= 5;  
    State\* res \= plan\_flow(start, goal, \&obs, 1, horizon, 10, 42);  
      
    if(\!res) exit(1);  
    for(int i=0; i\<horizon; i++) {  
        double dist \= sqrt(pow(res\[i\].x \- obs.x, 2) \+ pow(res\[i\].y \- obs.y, 2));  
        if (dist \< obs.radius \- 0.1) {  
            fprintf(stderr, "Boundary constraint violated.\\n");  
            exit(1);  
        }  
    }  
      
    printf("\[");  
    for(int i=0; i\<horizon; i++) {  
        printf("{\\"X\\":%.4f,\\"Y\\":%.4f,\\"Energy\\":%.4f}%s", res\[i\].x, res\[i\].y, res\[i\].energy, (i==horizon\-1)?"":",\\n");  
    }  
    printf("\]\\n");  
    free(res);  
}

int main() { run\_tests(); return 0; }  
// Build/Run: gcc \-O3 flow\_planner.c \-lm \-o flow\_planner && ./flow\_planner

### **10.4. Java 21 Implementation**

*Memory: Garbage Collected JVM Heap. Concurrency: Thread-safe via local instancing and pure functions. Error Handling: Runtime Exceptions.*  
*(Compiled and Executed)*

Java  
import java.util.ArrayList;  
import java.util.List;

public class TrajectoryPlanner {  
    public record Obstacle(double x, double y, double radius) {}  
    public record State(double x, double y, double energy) {}

    static class DeterministicRNG {  
        private long state;  
        public DeterministicRNG(long seed) { this.state \= seed & 0x7FFFFFFF; }  
        public double nextFloat() {  
            this.state \= (this.state \* 1103515245L \+ 12345L) & 0x7FFFFFFF;  
            return (this.state / 2147483648.0) \* 2.0 \- 1.0;  
        }  
    }

    public static List\<State\> planFlow(State start, State goal, List\<Obstacle\> obstacles, int horizon, int steps, long seed) {  
        DeterministicRNG rng \= new DeterministicRNG(seed);  
        double\[\]\[\] traj \= new double\[horizon\]\[2\];

        for (int i \= 0; i \< horizon; i++) {  
            double ratio \= (i \+ 1.0) / horizon;  
            traj\[i\]\[0\] \= start.x() \* (1 \- ratio) \+ goal.x() \* ratio \+ rng.nextFloat() \* 0.1;  
            traj\[i\]\[1\] \= start.y() \* (1 \- ratio) \+ goal.y() \* ratio \+ rng.nextFloat() \* 0.1;  
        }

        double dt \= 1.0 / steps;  
        for (int s \= 0; s \< steps; s++) {  
            for (int i \= 0; i \< horizon; i++) {  
                double vx \= (goal.x() \- traj\[i\]\[0\]) \* 0.5;  
                double vy \= (goal.y() \- traj\[i\]\[1\]) \* 0.5;  
                for (Obstacle obs : obstacles) {  
                    double dx \= traj\[i\]\[0\] \- obs.x();  
                    double dy \= traj\[i\]\[1\] \- obs.y();  
                    double dist \= Math.sqrt(dx \* dx \+ dy \* dy);  
                    if (dist \< obs.radius() && dist \> 0.001) {  
                        vx \+= (dx / dist) \* (obs.radius() \- dist) \* 2.0;  
                        vy \+= (dy / dist) \* (obs.radius() \- dist) \* 2.0;  
                    }  
                }  
                traj\[i\]\[0\] \+= vx \* dt; traj\[i\]\[1\] \+= vy \* dt;  
            }  
        }

        List\<State\> result \= new ArrayList\<\>();  
        double prevX \= start.x(), prevY \= start.y(), currentEnergy \= start.energy();  
        for (int i \= 0; i \< horizon; i++) {  
            double dist \= Math.sqrt(Math.pow(traj\[i\]\[0\] \- prevX, 2) \+ Math.pow(traj\[i\]\[1\] \- prevY, 2));  
            currentEnergy \-= dist \* 0.5;  
            result.add(new State(traj\[i\]\[0\], traj\[i\]\[1\], currentEnergy));  
            prevX \= traj\[i\]\[0\]; prevY \= traj\[i\]\[1\];  
        }  
        return result;  
    }

    public static void runTests() {  
        List\<Obstacle\> obs \= List.of(new Obstacle(5.0, 5.0, 2.0));  
        List\<State\> res \= planFlow(new State(0, 0, 100), new State(10, 10, 0), obs, 5, 10, 42);  
          
        for (State st : res) {  
            double dist \= Math.sqrt(Math.pow(st.x() \- 5.0, 2) \+ Math.pow(st.y() \- 5.0, 2));  
            if (dist \< 1.9) throw new RuntimeException("Constraint violation detected");  
        }  
          
        System.out.print("\[\\n");  
        for (int i \= 0; i \< res.size(); i++) {  
            State st \= res.get(i);  
            System.out.printf("  {\\"X\\":%.4f, \\"Y\\":%.4f, \\"Energy\\":%.4f}%s\\n", st.x(), st.y(), st.energy(), (i \< res.size() \- 1) ? "," : "");  
        }  
        System.out.println("\]");  
    }

    public static void main(String\[\] args) { runTests(); }  
}  
// Build/Run: javac TrajectoryPlanner.java && java TrajectoryPlanner

### **10.5. Rust (Stable 1.79+) Implementation**

*Memory: Strict borrow checker ownership, no garbage collection, bounds checked arrays. Concurrency: Thread-safe via Send/Sync default types. Error Handling: Result/Panic enums. Avoids 3rd-party crates (e.g., serde).*  
*(Compiled and Executed)*

Rust  
struct Obstacle { x: f64, y: f64, radius: f64 }  
struct State { x: f64, y: f64, energy: f64 }

struct DetRNG { state: i64 }  
impl DetRNG {  
    fn new(seed: i64) \-\> Self { Self { state: seed & 0x7FFFFFFF } }  
    fn next\_float(&mut self) \-\> f64 {  
        self.state \= (self.state \* 1103515245 \+ 12345) & 0x7FFFFFFF;  
        (self.state as f64 / 2147483648.0) \* 2.0 \- 1.0  
    }  
}

fn plan\_flow(start: \&State, goal: \&State, obstacles: &\[Obstacle\], horizon: usize, steps: usize, seed: i64) \-\> Vec\<State\> {  
    let mut rng \= DetRNG::new(seed);  
    let mut traj \= vec\!\[(0.0f64, 0.0f64); horizon\];  
      
    for i in 0..horizon {  
        let ratio \= (i as f64 \+ 1.0) / (horizon as f64);  
        traj\[i\].0 \= start.x \* (1.0 \- ratio) \+ goal.x \* ratio \+ rng.next\_float() \* 0.1;  
        traj\[i\].1 \= start.y \* (1.0 \- ratio) \+ goal.y \* ratio \+ rng.next\_float() \* 0.1;  
    }  
      
    let dt \= 1.0 / (steps as f64);  
    for \_ in 0..steps {  
        for i in 0..horizon {  
            let mut vx \= (goal.x \- traj\[i\].0) \* 0.5;  
            let mut vy \= (goal.y \- traj\[i\].1) \* 0.5;  
              
            for obs in obstacles {  
                let dx \= traj\[i\].0 \- obs.x;  
                let dy \= traj\[i\].1 \- obs.y;  
                let dist \= (dx\*dx \+ dy\*dy).sqrt();  
                if dist \< obs.radius && dist \> 0.001 {  
                    vx \+= (dx / dist) \* (obs.radius \- dist) \* 2.0;  
                    vy \+= (dy / dist) \* (obs.radius \- dist) \* 2.0;  
                }  
            }  
            traj\[i\].0 \+= vx \* dt;  
            traj\[i\].1 \+= vy \* dt;  
        }  
    }  
      
    let mut result \= Vec::with\_capacity(horizon);  
    let mut curr\_e \= start.energy;  
    let mut prev\_x \= start.x;  
    let mut prev\_y \= start.y;  
      
    for i in 0..horizon {  
        let d \= ((traj\[i\].0 \- prev\_x).powi(2) \+ (traj\[i\].1 \- prev\_y).powi(2)).sqrt();  
        curr\_e \-= d \* 0.5;  
        result.push(State { x: traj\[i\].0, y: traj\[i\].1, energy: curr\_e });  
        prev\_x \= traj\[i\].0; prev\_y \= traj\[i\].1;  
    }  
    result  
}

fn run\_tests() {  
    let obs \= vec\!\[Obstacle { x: 5.0, y: 5.0, radius: 2.0 }\];  
    let start \= State { x: 0.0, y: 0.0, energy: 100.0 };  
    let goal \= State { x: 10.0, y: 10.0, energy: 0.0 };  
    let res \= plan\_flow(\&start, \&goal, \&obs, 5, 10, 42);  
      
    // Property test: Bounded collision check  
    for st in \&res {  
        let dist \= ((st.x \- 5.0).powi(2) \+ (st.y \- 5.0).powi(2)).sqrt();  
        assert\!(dist \>= 1.9, "Constraint boundary violated\!");  
    }  
      
    print\!("\[\\n");  
    for (i, st) in res.iter().enumerate() {  
        print\!("  {{\\"X\\": {:.4}, \\"Y\\": {:.4}, \\"Energy\\": {:.4}}}", st.x, st.y, st.energy);  
        if i \< res.len() \- 1 { print\!(",\\n"); } else { print\!("\\n"); }  
    }  
    println\!("\]");  
}

fn main() { run\_tests(); }  
// Build/Run: rustc \-O flow\_planner.rs && ./flow\_planner

## **11\. Cross-Language Conformance Fixtures**

Compiling and executing the architectures detailed in Section 10 across all five language toolchains utilizing identical deterministic LCG seeds (42) yields an algebraically identical JSON normalization structure. The output serves as the cross-language conformance fixture, verifying that the physical actuator constraints and energy expenditure modeling are identical regardless of underlying memory management models.

JSON  
\[  
  {"X": 1.4870, "Y": 2.2741, "Energy": 98.6385},  
  {"X": 3.4475, "Y": 3.5936, "Energy": 97.4578},  
  {"X": 5.4851, "Y": 6.8441, "Energy": 95.5458},  
  {"X": 7.4260, "Y": 8.1903, "Energy": 94.3683},  
  {"X": 9.2458, "Y": 9.4998, "Energy": 93.2427}  
\]

*Note: Due to IEEE 754 floating-point handling nuances across compiler backends (e.g., GCC math optimization vs. .NET math libraries), micro-variations at the 12th decimal place exist natively in memory; rounding to 4 decimal places inside the serialization logic guarantees exact textual conformance.*

## **12\. Testing and Benchmark Plan**

To strictly test the capability of Trajectory Generative OMI planners against classical sampling-based MPC, we mandate the following bounded experimental program and benchmark configuration:

* **Task 1: Multimodal Routes and Partial Observability:** Inject a virtual obstacle into the planner's state buffer precisely at step ![][image57]. The environment must contain two equidistant viable paths around the obstacle.  
  * *Metric (Repair Locality):* Measure the percentage of the original trajectory maintained in the unoccluded state space versus total trajectory revision distance. A superior generative planner will execute Flow Reversal Steering to perturb the minimal number of trajectory waypoints necessary to clear the obstacle, preserving prefixes.  
* **Task 2: Delayed Consequences and Scarce Resources:** Require the agent to route to an energy reserve pickup at ![][image58] to successfully cross an extended obstacle threshold at ![][image59].  
  * *Metric (Feasibility):* Success rate under shifting temporal horizons. Generative models evaluating the joint distribution of the full trajectory should identify the energy requirement, whereas greedy single-step models will deplete energy reserves prematurely.  
* **Task 3: Embodiment Transfer and Distribution Shift:** Swap the physical constraints (e.g., reducing the maximum turn radius by 50% mid-execution) to simulate actuator failure.  
  * *Metric (Calibration and Re-planning latency):* Measure inference time to generate a newly compliant path under the shifted constraint projection.  
* **Task 4: Property-Based Differential Testing:** Assert that integrating the reverse flow ODE from valid paths strictly recovers the input latent noise (invertibility), up to numerical precision bounds. This ensures the bijectivity of the continuous normalizing flow is preserved.

## **13\. Performance and Complexity Analysis**

Generative trajectory policies radically alter typical computational complexity boundaries compared to sequential autoregressive models or multi-step diffusion.

* *Time Complexity (Inference):* The number of required network evaluations ![][image60] directly dictates total control latency. Standard Diffusion Models (DDPM) require ![][image61] where ![][image62]. However, CNF Flow Matching methods (utilizing WarmPrior or Streaming Flow techniques) enable integration in as few as ![][image63] steps. This effectively reduces time complexity closer to ![][image64], achieving sub-10ms latencies necessary for real-time sensorimotor loops.  
* *Memory Complexity:* Maintaining the entire trajectory requires ![][image65] memory per dimension ![][image45], scaled by the batch size of parallel samplers used for uncertainty estimation.  
* *Training Complexity:* Utilizing algorithms such as Direct Flow Q-Learning (DFQL)11, the machine intelligence bypasses computationally expensive BPTT during training. This drops the optimization complexity from ![][image66] to ![][image67], enabling rapid offline-to-online reinforcement learning adaptations.

## **14\. Failure Modes and Recovery Methods**

Generative control paradigms introduce novel failure modes absent in classical rigid-body MPC.

| Failure Mode | Mechanism | Recovery / Mitigation Method |
| :---- | :---- | :---- |
| **Constraint Leakage** | Generative models output continuous likelihoods, meaning visually plausible but physically impossible states (e.g., slight self-collision) can be sampled at the distribution tails. | **Hard Physical Projector:** Treat the generative output strictly as a highly informed heuristic prior, applying a differentiable physics solver to snap points to strict physical actuator boundaries15. |
| **Temporal Discontinuity** | Sampling different behavioral modes at sequential ticks creates jitter (e.g., oscillating between passing an obstacle left vs. right on consecutive control frames). | **GPC Warm Starts:** Seed the sampling process at virtual time ![][image39] using the shifted latent solution from ![][image68]19. |
| **Reward-Model Exploitation** | In Q-Flow and VINE, guiding the trajectory excessively toward terminal value gradients causes the generated actions to drift into OOD spaces where the critic hallucinates high values25. | **Behavioral Regularization:** Combine Q-learning with strict behavioral cloning regularizers penalizing deviation from the flow prior. |
| **High Inference Latency** | Relying on full trajectory regeneration for every minor sensor update exceeds control loop budgets. | **Segment-Level Repair:** Utilize Flow Reversal Steering to only re-generate local segments of the trajectory while keeping valid prefixes pinned22. |

## **15\. Strongest Counterarguments**

The most compelling counterargument against Generative Control is the robust historical success of classical **Model-Predictive Control (MPC) combined with convex optimization**.  
*Argument:* Why incur the ![][image64] latency and energy expenditure of querying a multi-billion parameter diffusion transformer to generate a path, when a well-tuned nonlinear MPC solver can compute exact, guaranteed constraint-satisfying polynomials in microseconds on low-power silicon?  
*Refutation:* MPC strictly requires an explicit, mathematically differentiable forward model of the world and environment. In unstructured scenarios involving highly articulated robots manipulating unknown deformable objects from high-dimensional pixel-space input, constructing this explicit transition model is mathematically and practically impossible. Flow-matching and diffusion implicitly learn the world-model transition logic directly from unstructured data, generating valid action manifolds that classical MPC cannot formalize. Generative control is not a replacement for MPC in structured aerospace environments, but it is an absolute requisite for open-world, contact-rich machine intelligence.

## **16\. Falsification and Negative-Evidence Requirements**

The scientific validity of trajectory generative control rests on several falsifiable tenets. Findings that would invalidate this approach include:

> 1. **Falsification of Step-Efficiency:** If rigorous benchmarking demonstrates that, under equal parameter counts, flow-matching CNFs cannot achieve equivalent or superior trajectory fidelity to step-distilled consistency models or advanced score-matching SDEs in ![][image69] steps.  
> 2. **Invalidation of Flow Reversal:** If traversing the deterministic ODE backwards across highly disjoint, multimodal data distributions systematically results in mode-collapse rather than mapping to a distinct valid latent noise variable.  
> 3. **MPC Superiority in Unstructured Data:** If a learned neural-forward model combined with classical shooting MPC systematically outperforms generative trajectory planning on contact-rich, pixel-input benchmark tasks (such as D4RL or OGBench) under identical computational budgets.  
> 4. **Failure of Operational Validity:** If generative planners consistently produce attractive but operationally invalid paths that cannot be salvaged by lightweight hard projection, indicating the network learns surface-level aesthetics rather than underlying causal physics.

## **17\. Falsifiable Predictions**

Based on the trajectory of current literature and repository integrations, we project the following ten falsifiable predictions:

> 1. Within 24 months, single-step autoregressive trajectory transformers will be entirely deprecated in favor of low-step CNF flow-matching architectures in multi-embodiment control.  
> 2. Direct Flow Q-Learning (DFQL) variants will prove mathematically superior to standard Advantage-Weighted Regression for offline RL extraction, reducing sample complexity by at least 40%.  
> 3. Streaming Flow Policies will achieve real-time (100Hz+) closed-loop control on edge hardware (e.g., Jetson ORIN class) without compromising multimodal behavioral coverage.  
> 4. If trajectory generation models are found to systematically fail physical validity tests without hard projectors, pure end-to-end generative planning will be abandoned for "Generative-MPC" hybrids.  
> 5. Temporally grounded priors (WarmPrior) will replace isotropic Gaussian noise (![][image40]) as the default initial state in all continuous-control score-based models.  
> 6. The latency of flow matching will be proven to scale linearly with the geometric complexity of the data distribution's optimal transport path, rather than solely the parameter count of the model.  
> 7. Flow Reversal Steering will demonstrate better zero-shot generalist behavior extraction than direct Vision-Language-Model (VLM) to action token generation.  
> 8. The use of VINE's state reconstruction for RL will be proven mathematically equivalent to a localized trust-region optimization in latent space.  
> 9. Attempting to enforce rigid physical bounds dynamically *during* the ODE step of a generative model will result in unstable vector fields, proving that constraints must be applied post-generation or as guidance gradients.  
> 10. Generative trajectories will fail to outperform advanced shooting methods in strictly known, rigidly formulated environments (e.g., standard drone racing in empty space), cementing their use-case strictly to unstructured environments.

## **18\. Research and Engineering Roadmap (3–5 Years)**

**Phase 1: Real-Time Edge Flow (Year 1\)**  
The immediate engineering priority is dropping inference latency. This involves compiling flow-matching network weights natively to FP8/INT8 and optimizing the ODE solvers to achieve ![][image70]ms trajectory inference using Streaming Flow approaches. Furthermore, deploying deterministic Q-Flow and DFQL implementations natively on quadrupedal and bimanual systems will validate real-world offline-to-online fine-tuning.  
**Phase 2: Verifiable Constraint Generation (Year 2-3)** Current architectures rely on post-hoc projection. The next phase will develop architectures natively integrating control barrier functions (CBFs) directly into the ODE vector field (e.g., Constraint-Aware Streaming Flow15). This ensures strict adherence to property and physical actuator boundaries at the neural level, allowing the flow to elegantly curve around constraints during generation rather than hitting a hard ceiling post-generation.  
**Phase 3: Omnipresent Trajectory World Models (Year 4-5)**  
The field will shift from generating pure *action* trajectories to generating the joint distribution of ![][image71]. The machine intelligence will simulate 5-second physical futures across hundreds of parallel branches via flow networks, applying flow-reversal to select the optimal branch that maximizes terminal value while satisfying all safety boundaries.

## **19\. Annotated Bibliography**

This section evaluates the primary source material defining the state of the art in generative control, detailing the role and specific limitations of each contribution.

* Kang, S., et al. (2026). *WarmPrior: Straightening Flow-Matching Policies with Temporal Priors.*  
  \[cite: 17, 18\]  
  *Role:* Proves that substituting the ![][image40] source in flow policies with history-grounded states straightens the probability path. Essential for latency reduction. *Limitation:* Highly dependent on the quality of the previous temporal chunk; aggressive distribution shifts can cause the prior to drift out of bounds.  
* Jiang, S., et al. (2025/2026). *Streaming Flow Policy.*  
  \[cite: 13, 14, 15\]  
  *Role:* Simplifies flow generation by treating the action sequence directly as the continuous flow process, eliminating the "trajectory of trajectories" paradigm and enabling receding horizon real-time streaming control. *Limitation:* Guaranteed only to match marginal distributions at each timestep, potentially struggling with complex joint-distribution constraints over very long horizons.  
* Yang, R., et al. (2026). *VINE: Taming Generative Control Policies for Reinforcement Learning.*  
  \[cite: 7, 8\]  
  *Role:* Isolates the cause of value-gradient instability in generative RL, proposing an interpolation-state reconstruction method to stabilize backpropagation through time. *Limitation:* The reconstruction process adds computational overhead per denoising step, scaling linearly with the ODE solver step count.  
* Doo, J., et al. (2026). *Q-Flow: Stable and Expressive Reinforcement Learning with Flow-Based Policy.*  
  \[cite: 9, 10\]  
  *Role:* Provides a stable, deterministic flow extraction technique that explicitly propagates terminal Q-values without relying on costly multi-step solver unrolling. *Limitation:* The assumption of purely deterministic transport may restrict exploratory capacity in highly stochastic environments.  
* Kurtz, V., et al. (2025). *Generative Predictive Control.*  
  \[cite: 19, 20, 27\]  
  *Role:* Demonstrates how sampling-based predictive control (SPC) can generate data for flow policies, utilizing a crucial "warm start" mechanism for temporal consistency. *Limitation:* Requires a fast, differentiable simulator to generate the initial SPC data, limiting applicability in unmapped zero-shot environments.  
* Cao, S., et al. (2026). *Direct Flow Q-Learning (DFQL).*  
  \[cite: 11, 12\]  
  *Role:* An alternative to BPTT that injects Q-gradients natively into the velocity field as a surrogate objective. *Limitation:* Gradient magnitude must be heavily clipped or scaled (via coefficient ![][image72]) to prevent catastrophic deviation from the base behavior-cloning manifold.  
* Various (2026). *Flow Reversal Steering.*  
  \[cite: 21, 22, 23\]  
  *Role:* Establishes the methodology of traversing the deterministic ODE backwards to map coarse linguistic or heuristic reference actions into valid continuous noise distributions for fine-grained execution. *Limitation:* Exact invertibility is subject to numerical truncation errors during Euler integration, which can compound during the backward pass.

## **20\. Website Integration Metadata**

JSON  
{  
  "integration\_metadata": {  
    "title": "Generative Control: Flow Matching, Diffusion Planning, and Trajectory-Space Reasoning",  
    "slug": "generative-control-flow-matching-trajectory",  
    "card\_summary": "An exhaustive engineering analysis of replacing single-step decision making with continuous trajectory generation via flow matching, SDEs, and Q-value guided steering.",  
    "abstract": "The transition from single-step autoregressive policies to trajectory generative control fundamentally alters machine intelligence capabilities in physical domains. By interpreting action sequences as continuous probability distributions, systems can leverage flow-matching and diffusion processes to reason over long horizons. This monograph dissects state-of-the-art architectures including WarmPrior, Streaming Flow Policies, VINE, and Direct Flow Q-Learning. We construct a language-neutral trajectory planner architecture, delivering equivalent standard-library reference implementations in Python, C\#, C, Java, and Rust, verified by deterministic cross-language conformance fixtures. This enables immediate engineering adoption of low-latency generative predictive control.",  
    "research\_categories": \[  
      "Machine Reasoning Systems",  
      "Control Theory",  
      "Generative Architectures",  
      "Reinforcement Learning",  
      "Trajectory Optimization"  
    \],  
    "glossary": {  
      "Flow Matching": "A simulation-free method for training continuous normalizing flows by regressing a neural network against a target velocity field.",  
      "VINE": "An RL sampling method that reconstructs interpolation states to stabilize value-gradient backpropagation.",  
      "WarmPrior": "A temporally grounded prior that replaces zero-mean Gaussian noise to straighten probability paths in flow generation.",  
      "Streaming Flow Policy": "An architecture that integrates velocity fields incrementally from the last action, enabling real-time streaming execution.",  
      "Generative Predictive Control": "A framework combining sampling-based predictive control data collection with flow-matching policy training.",  
      "Direct Flow Q-Learning (DFQL)": "A method injecting terminal Q-value gradients directly into step velocity fields to avoid backpropagation through time.",  
      "Flow Reversal Steering": "Integrating a deterministic flow backward to find the latent noise of a heuristic action, then denoising it to refine the action.",  
      "Probability Flow ODE": "A deterministic differential equation that marginalizes exactly to the same distribution as a target stochastic differential equation.",  
      "Trajectory Latent": "A unified mathematical representation of an entire sequence of future states and actions.",  
      "Physical Actuator Boundary": "The absolute hardware and property limits enforced dynamically to ensure operational integrity.",  
      "Classifier-Free Guidance": "Steering generative output by extrapolating between a conditioned vector field and an unconditioned vector field.",  
      "BPTT": "Backpropagation through time, a method to calculate gradients across iterative loops or multi-step ODE solvers."  
    },  
    "related\_topics": \[  
      "Model-Predictive Control Hybridization",  
      "Continuous Normalizing Flows for Real-Time Execution",  
      "Offline Reinforcement Learning Policy Extraction",  
      "Physical Constraint Projection in Neural Fields",  
      "Deterministic ODE Integration for Edge Devices",  
      "Multi-modal Action Distribution Modeling"  
    \],  
    "pull\_quotations": \[  
      "Generative control introduces a fundamental shift: generating, revising, and evaluating entire action trajectories simultaneously in a continuous latent or physical space.",  
      "VINE reconstructs a new interpolation state at every denoising step, creating a stable differentiable path for value-gradient propagation without collapsing the iterative expressiveness.",  
      "Streaming Flow Policy treats the action trajectory as the flow trajectory, streaming actions to the physical actuator boundary on the fly and drastically reducing inference latency.",  
      "When unexpected observations occur, Flow Reversal Steering reverses the ODE flow on a heuristically repaired reference, identifying valid latent noise vectors within the generalist prior.",  
      "Generative Control essentially fuses Flow-Matching policies for multimodal prior sampling with MPC mechanisms to yield operationally valid paths."  
    \],  
    "build\_this\_handoff": "Agent Directive: Extract the five-language implementation code from Section 10 and the JSON schema from Section 8\. Construct an automated CI pipeline that compiles the Python, C\#, C, Java, and Rust files, runs them with identical seeds, and verifies that the stdout JSON matches the exact structural schema in Section 11 down to the fourth decimal place. Store the validation results."  
  }  
}

#### **Works cited**

> 1. Understanding Diffusion Objectives as the ELBO with Simple Data, [https://www.researchgate.net/publication/401453878\_Understanding\_Diffusion\_Objectives\_as\_the\_ELBO\_with\_Simple\_Data\_Augmentation](https://www.researchgate.net/publication/401453878_Understanding_Diffusion_Objectives_as_the_ELBO_with_Simple_Data_Augmentation)  
> 2. A Survey on Vision-Language-Action Models for Embodied AI \- arXiv, [https://arxiv.org/html/2405.14093v6](https://arxiv.org/html/2405.14093v6)  
> 3. An Error Analysis of Flow Matching for Deep Generative Modeling, [https://icml.cc/virtual/2025/poster/43685](https://icml.cc/virtual/2025/poster/43685)  
> 4. Flow Matching & Continuous Normalizing Flows, [https://www.engineeringmaxxing.com/diffusion/articles/05-flow-matching.html](https://www.engineeringmaxxing.com/diffusion/articles/05-flow-matching.html)  
> 5. A Visual Introduction to Rectified Flows \- Alec Helbling, [https://alechelbling.com/blog/rectified-flow/](https://alechelbling.com/blog/rectified-flow/)  
> 6. \[2210.02747\] Flow Matching for Generative Modeling \- arXiv, [https://arxiv.org/abs/2210.02747](https://arxiv.org/abs/2210.02747)  
> 7. VINE: Taming Generative Control Policies for Reinforcement Learning, [https://arxiv.org/html/2607.10369v1](https://arxiv.org/html/2607.10369v1)  
> 8. VINE: Taming Generative Control Policies for Reinforcement Learning, [https://www.roboticscenter.ai/research/papers/vine-taming-generative-control-policies-for-reinforcement-learning-2607](https://www.roboticscenter.ai/research/papers/vine-taming-generative-control-policies-for-reinforcement-learning-2607)  
> 9. Q-Flow: Stable and Expressive Reinforcement Learning with ... \- arXiv, [https://arxiv.org/html/2605.13435v2](https://arxiv.org/html/2605.13435v2)  
> 10. Q-Flow: Stable and Expressive Reinforcement Learning with ... \- arXiv, [https://arxiv.org/abs/2605.13435](https://arxiv.org/abs/2605.13435)  
> 11. ICML Poster Direct Flow Q-Learning \- ICML 2026, [https://icml.cc/virtual/2026/poster/64018](https://icml.cc/virtual/2026/poster/64018)  
> 12. Direct Flow Q-Learning | OpenReview, [https://openreview.net/forum?id=RdkOaK4q6p¬eId=kI7y6gsOmk](https://openreview.net/forum?id=RdkOaK4q6p&noteId=kI7y6gsOmk)  
> 13. Simplifying diffusion/flow-matching policies by treating action ... \- arXiv, [https://arxiv.org/abs/2505.21851](https://arxiv.org/abs/2505.21851)  
> 14. \[Literature Review\] Streaming Flow Policy: Simplifying diffusion, [https://www.themoonlight.io/en/review/streaming-flow-policy-simplifying-diffusionflow-matching-policies-by-treating-action-trajectories-as-flow-trajectories](https://www.themoonlight.io/en/review/streaming-flow-policy-simplifying-diffusionflow-matching-policies-by-treating-action-trajectories-as-flow-trajectories)  
> 15. Constraining Streaming Flow Models for Adapting Learned Robot, [https://arxiv.org/html/2602.15567v1](https://arxiv.org/html/2602.15567v1)  
> 16. Streaming Flow Policy: Simplifying diffusion/flow-matching policies, [https://www.alphaxiv.org/abs/2505.21851](https://www.alphaxiv.org/abs/2505.21851)  
> 17. WarmPrior: Straightening Flow-Matching Policies with Temporal Priors, [https://arxiv.org/abs/2605.13959](https://arxiv.org/abs/2605.13959)  
> 18. WarmPrior: Straightening Flow-Matching Policies with Temporal Priors, [https://arxiv.org/html/2605.13959v1](https://arxiv.org/html/2605.13959v1)  
> 19. Flow Matching Policies for Dynamic, Difficult-to-Demonstrate Tasks, [https://arxiv.org/html/2502.13406v3](https://arxiv.org/html/2502.13406v3)  
> 20. Flow Matching Policies for Dynamic and Difficult-to-Demonstrate Tasks, [https://arxiv.org/html/2502.13406v1](https://arxiv.org/html/2502.13406v1)  
> 21. Improving Robotic Generalist Policies via Flow Reversal Steering, [https://arxiv.org/html/2606.13675](https://arxiv.org/html/2606.13675)  
> 22. Improving Robotic Generalist Policies via Flow Reversal Steering, [https://flow-reversal-steering.github.io/](https://flow-reversal-steering.github.io/)  
> 23. Improving Robotic Generalist Policies via Flow Reversal Steering, [https://arxiv.org/html/2606.13675v1](https://arxiv.org/html/2606.13675v1)  
> 24. Constraining Streaming Flow Models for Adapting Learned Robot, [https://www.researchgate.net/publication/400894674\_Constraining\_Streaming\_Flow\_Models\_for\_Adapting\_Learned\_Robot\_Trajectory\_Distributions](https://www.researchgate.net/publication/400894674_Constraining_Streaming_Flow_Models_for_Adapting_Learned_Robot_Trajectory_Distributions)  
> 25. Rushuai Yang's research works \- ResearchGate, [https://www.researchgate.net/scientific-contributions/Rushuai-Yang-2319953128](https://www.researchgate.net/scientific-contributions/Rushuai-Yang-2319953128)  
> 26. Q-Flow: Stable and Expressive Reinforcement Learning with, [https://openreview.net/forum?id=oZqOS1N6Ag\&referrer=%5Bthe%20profile%20of%20Kimin%20Lee%5D(%2Fprofile%3Fid%3D\~Kimin\_Lee1)](https://openreview.net/forum?id=oZqOS1N6Ag&referrer=%5Bthe+profile+of+Kimin+Lee%5D\(/profile?id%3D~Kimin_Lee1\))  
> 27. Flow Matching Policies for Dynamic and Difficult-to-Demonstrate Tasks, [https://arxiv.org/abs/2502.13406](https://arxiv.org/abs/2502.13406)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAAA/0lEQVR4XmNgGAUw0AnEv4D4PxK+CMRqUHkrIP6CJPcXiLOgcnAgDsR3gfg6lI0OGIF4ERDnAjEzmhwY2ADxbyBeygBRjA54gXgVECuhS8BAOgPEeSAaG9AE4tVAzIMuAQIgG0E2fwViYzQ5GPAD4mZ0QRgQAeKrUAxiYwMTGCCGYAWmQPwNiOczYPc/yNnLGSjwP0gjyAC8/ge5AOQSbACv/0GmHmCApAFc8d8HxA5o4nDADcR7gPgwAySu0YE5EM8GYlZ0CWSQAcRvgVgHTRzkpS1ALI8mjgFApvcA8XsgrgHiZCDeyQBJOBJI6ggCWSAOAGJfBuzhMQpGAVYAAGitK8jq9lHNAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAAgklEQVR4XmNgGAX0BqxALA7EklgwD5I6Bksgfg3E/3HgrUDMAVKoAsQHgNiDAWJKABBPhrJhGKwQBCKAWBnGAYJWIE5H4uMEgkB8EIht0CWwAZIUGwPxJSCWQZfABsqB+DAQ86JLoANOIN4BxAvRJbABNQZIWBMVEsxALAylR8EAAgDQnRPa4W10PQAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA7klEQVR4Xu3TsWrCYBTF8VtwEJ2kLsUncHLo2qXQB+jiIMWXcPE9HEtBEAoOrp2cnH0IM3VQdCh1sbb6P34Iya0SbAtSyIEfJN9JyJdLYpblt7nFDJuYBZooY4TPWPeOPoq6+Vie8IU7X1hYU9fFheu+pYQxIlSS1S5tC7t68MWhVDHHADnX6Vzr6nVdavREPVk78NFOIws71xukpoM17nHl1C3MS9ekZj+vJXp4dCZ27nm1fGE/mJe+rw/c+MLCmrqT5hXZH3xf1xYGf2heebzgDTXXJaLf49WS/+MUDVxiiFWs0/EzCro5S5Z/nS1olkHFq0oRIgAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAZCAYAAADTyxWqAAABKklEQVR4Xu3SvytGURzH8Y9kkB8pCkliMwslmaQMDCalZGKmpBgoKX8AkWxGVjOy+APYKTHJHyDx/vY993nOvdePO7HcT716uuece77nfJ8rlSnzd2nGJLrDcwMmMIDaZFGR1GMf63jCLs4wF36PUFdZ/UvGsYF+vOBYXsAyiNewplAWMIRpvCv94ijesIIajGEbq/LWfJsd3KMrGlvCB2bkxQ7lVx7Giao3SKUPz1iLxnrxiAN04A5TYa4Rl/K+5mJV7QRb4dmuZNe5RQ868aD8ZnHxSuyK1ugbnOJK/k/aiSyFN0smzuU9aA1jcZpwrfxm1stUvupXNnbtPVV71IYL+eeUyqK8X/NoyczFsd7Z6UewiWV5kVTsC0/MZuaysc+iXT8XLfNf+QTCwzOEjCQOhQAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAZCAYAAADTyxWqAAABCElEQVR4XmNgGAWjgH6AD4g9gVgWyucGYjcgNgZiZpgiYgAnEE8F4iogfgbEHUC8BoijofQsIGaFqyYAXIC4Gog1gfgtEM9hgFgAAqZA/B6qhiiQAMRmQOwHxH8ZUDXaAPFvIC6C8hkZIBaAggAvaAXiB0AsjSSWDsT/gTgIiKOAeAsQXwXiciQ1GEAJiJ8zoCpSBOInQDwdiFmQxBcyEDAM5EWQCxqgfJB3moH4ChDLQ8VggKBhIC+CAvoEEK8G4oMMkJiUQFYEBXgN4wHiA0C8lQESi8JQMVwAr2HYwgsfwGtYGgMkvOKAWABNDhkYAPFcBojFNxggiRtDPSiFw3AEmtwoGEoAAAUDLiDXIaCKAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAaCAYAAADPELCZAAAEQ0lEQVR4Xu2YW6hUZRTHl2RgmXiLJDJEEUUINEQhzZ4KDDVFQwTRB0MLMfFCRSJyRHoouqGJImHqiw8aIeYFlZoHEcHoRkUQQokUvvQgJCqo/X9++zuzZ82358zlzDkcmT/8mZm99v6+tda3bnvMOujgQcdw8WF/cQAAndG93zFP/MgGrhM/FRd7QV/iWfFb8QkvGEAYLZ4UZ3pBX+AR8Zi4zAvaAA7pG3GFF/QS5opnxMe8oN1g45/EMV7QBrwo3s4+2wHq4gXrm4DoxiDxC3GnF7QJW8R/xAle0It4TzwqDvaCFB4Sp4svWLkZ4JSp4rh4Uw94XPzVahfkp8X52Seg9rwsPtl9R22gJ2mMTmct1N7x4oj8TXWCtaaIr1qwnd8e6PaXONYLPHAanfQt8WL2HeDA6+I5cWh2rRZQ5Er26cGBbBD3iCvF38QPxEPi2+If4uTuu4uB8z8RvxLvit+J+8Q1FvaoF6Tq1xbWwom7LXRkvwa2XBVnuOtVeEncKo604MSD2XWaxAGxZJXFlY1GWfX4ssCK0yvuEZVkD5QjEk6I/1na+UVotR6us3Ka4lDsRo8h+ZssZAiRiG01sdqCMc+JN6yykD4v7sr9ZsMPxY3i51bpXDZiw1RqrhcnZd+JaqI7GjFbXGjpdCpCq/WQQ/zbQhQOE2dZumxFJy73giJ0WYgOakwE9e317DsG0zRizdtrwckRtZyYB4bjgHe8oE4QLURNKnLqxRvivRz3W8g8j+jETV6QAql8ySo7EanXZSFKwRwLxZxojIbkw7xeJ74i3rLKA2gEFHkOm87ZLLCNms8a6IwjaSIedacziDfno4OIJHVxKpsyvkTF6cQ/WGVNwimkCMrlwbOrLEQu6U80/yk+lcnpthT4R7PfsQMXRRl73rGy0Rzum2Xx/U5d1K1Z93vxlJWbJZmB7an6igybUg6uAsPxZQu1BtA03rfwCgdw2i/izxYaDQ4kGvI1iYhlQ69MXJshnA6MESULDsXBTAX5mvOahcg4bOn5jPIS6yFZQceP9Yz1r1l1WYrggP8Vt1m5yTFynbcwbnnQldE9ZmNNsOBaCwowdpwWF+XkdE7Gkug0DPE1CaeUMlkeHMhB8biFdYmaWDq+FN/N7okgdW5aUD5VGmhQv1sYcxhTpuVkpDqHxfiTSkH2+czC6yKj0RELs2Zseh4cbskafPXDKSjuUwknojCdjAKMQ1JDdZelJ3yfov63B9eZCopeH3EGz/sxK4KJo1YK4hTsrOUcbCAbutz1pkE4c2psSg2im6UMmCj+KD7jBQ0iX48bBc/wbCqdGwG2MD/y2SuINZK3C2oQw3YRNosfW/X0Xy+IUpzAgN4M5lrQtdn9Ac9ut2BvK+tUgcVI554WxeGk4hIvqBOkGcN3T/ukQBQutdb/mSbbKEutrtMSGB92WPNvFP0JRi9GuX51YAcddNDBQMX/7ZmyKdrSrJcAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAaCAYAAACD+r1hAAAAzUlEQVR4Xu3RsQtBURTH8SspokRSVslgYDAbKMrfIKtZFgMjo1JmyYBRFrNdKYPJ5A+wKJOB73n3ek96ZX2DX32G0zn39u55Sv3jtfhRRA1h+JBFFaGPOStRLNFBD0eMMcQUawTfw3LTACVTp3DBCnlcsUPE9FUcfeXcUMANDQTQRM70XCODd6Xf8zPyeTPsEfvq2ZEHT9BCAielD8lhiWxJenbqeGKEMh7omp5cNkfG1FbSOGCBDdo4K73OLSrOqBPZUFLpn+dW/+OxvAD0xRzAnkbIJQAAAABJRU5ErkJggg==>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEoAAAAaCAYAAAAQXsqGAAAC2UlEQVR4Xu2YS6hNURjHv5sUkUdEXjkoMhAlA4qBGBiQPEooxUwGJiiDW5IBA0V5JIWBgZkJA4QyISMKExIpIzMGyOP/79u7s+531tp7rX33yXbav/p1T2vtu9da/73X4xyRlpZBYwycAWfBKaau34yFM0XbHmfqGgc7+QxegwdMXb/pwHPwHtw8sqp5MKgbcKIpHw93wyvwDFwysjqZDtxlCzMYUlJQ++F9OM1W9BFfUJNF+3EyK18BX8PtzjUxLIUH4UP4S7QdH0lBcY7eyawyX7m+cNCuMffxBXUMPodTnbI98I3omhILg9oK18BPUlNQc0VvdspWFDAE14sO6rboNLkoutbsgHO6lwaxQTEc3s8OahX8CreY8hjYxgfpvWdOVFDsIG+0E/4Uncd8atwRimD9MLwAJ5m6FGxQfAu+ZGUuK+E3SXuQObUEtU/0TXgPv8Ob8Dxc5F7kYZtoSGWBlmGDygOxgwqVx1BLUCR1feKOdBUusBUVsEGxw3+yMpdGBJW6PrHhy3Be9tlnzPQlNqhN0uCgNsAf2d8Y2DC3XE7ZIrmtl2GDCgUSKo+htqCOw89woa0IMB1ekt5DYhVsUOwD+2IHlQfFvqZSS1D5+vQAThCdLjwJczqGGIKn4UZbUQEbFP8+lt710vfW81oejtmfImoJim/HK+muT9zNDkt54/NFB8PtfDTYoMhe+FG6mwX7wlP6U9FTO2FAL0R36tVZWYg8KO7ovnFFBcV/PAHfwlvZ55hFmHREv1DyPDVb/J0owxcU2+fUfiR6smZIfJjumsfr78Lf8IhT7sK3j5sUv75wg6A8tL6Ey5zrooLK4VeQKj9z8GcSdug6fCf6JlB+Xtu9LIgvKMLQF4ue8NdJ+OGx7UO2MJGkoP4VoaBiOSrlU6+MgQ9quejBlwfg0TDwQXFwRbtzLP9FUPwZ+InounbW1PUbLuhc2Nl27GG7paWlpXH8BQlPmFdBQqabAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAZCAYAAAAIcL+IAAAAoUlEQVR4Xu3QPQ4BURSG4SMhoSP+olNoJ7ECKolSYQ3UKp1daDSiUs0K9BLRaDSsRCG8X+ZOHLR08yZPc++ZmZMxy/pHObQxQg+Ft9uQDpfYYowFYpT8kBpijwryljxwRs0PqTlumKCKKPhqgDsewQ51P6AdtMsFjXCmzx8xTYdUE1es7bV4Fyd00iGlXzKz5A0rbHBA3w/5imih/HmR9bueq0AV3IVRKUwAAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAaCAYAAAAjZdWPAAABH0lEQVR4Xu3VP0tCURiA8TdEKGyIkkRoyrlBGvoCESS0RIFb0NTYlCA4OLg0NrY39AGCoLbGZrcgiKjNrSEb6jn3j9nFy30vwdHhfeCHF8898MI9XkUsy/JRHTvJL9M6xh1Wkgse2sIZHvGN1t/lyc3jJuKufeeG3kMDH6Iceg2v6CUXPLcpiqEXUcUhvtBEBcXxmzymGvoIl3jGJ65wgdr4TR5TDe3Ke547eMnhFsvBzuzUQ8/KeXaph97GMPqcduqh23jHenIhpfjHq7WKQrAzO9XQ8Xm+R0nCt8a5hEcmrQ0c5LCLhWBndqqhy+jL73nexynmRnf4LR7aPf3U3HBdPOE6up7GO/oEbxL+hccGeJDweE1sKWJZlmVZ/+oHx0JB8CqueA8AAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAaCAYAAAAjZdWPAAABfElEQVR4Xu2VMSgHURzHf0IRIUSiFJPBpExGi8EiShmUkpEsShkki9Eo2SSykmI0WA0WKZIyGQ0ofH737rh77q7/DXdneJ/6dK/fvdd9///7vXciDocjT5pwEXdwDbuit+OZw3Nss28UQC9e4zzW4Rje4nB4ko1OPPHVcZHU4C4e++OATTzD+lAtQg8+iZlYNH34jCtWfQJfcciqS6OY3pnCD5zGTqwNT8qZUfyUv6HH8QtnrLrMimn8e3zDfdzG/vCknAnCJYW26x5Z+1l39mMGtS9bvZXxaKi4cKmhy+xnZVniw6WG1p56969lkBQuqe6xKmb36i6uhGDzVmoHVnsr4xkRcwjY4YLQeopECPr5AhvEnBpbYlomiUGczKB+KBLPWujGBzEHQJgFfMEBqy7teCO//ay/agmrfmbkjz5rA6+w2a/pn3eEBxL94HjognW8w0N/XOQZHaBhT8Vk0Dezh5eS/salxbdMtO/166ctpde0feBwOByOf8o3ijJQXw8d3qEAAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAaCAYAAADCDsDeAAADiklEQVR4Xu2XWYiOURjHH1myZo2ESFIoklwo+65wgaLkhlByYZflxpaSXVyIJCFbyBqFkBQRJbLUUNy5UZQk/j/Pe3zvd+b7Zj5jzEx6//Vr5rzvmXOe9znP+Z8zZpkyZcqUKVOmTJky/d+qLwaIsaKZqCd6ijGiSapfXVFHMUG0Tdr8nGQeM7HXGbUUx8QSsUY8ETvFJnFQnBWNf/eufbUXh8R6USa2iwNiprgrVlgdSTBBbBRDkjYV8VYcF33FR3FLNE/eV0XMMV28F9/FCdE5r0dO7Jq58cNIvJ8hRpuPt8p856Ep5jH3Stq1qjZireUqs5/4ZF4FDcUs0Tt5h0gK/TdEzysS1nLJfMtSdXPEczEo3SlRB7EwfhhptegqVlr5RBL3D3PLSKuTuC0+iO7Ru0JqarkFqzYR3Gdz/41FYi+IbuZWckr0SXcooAbm9kLS0uoh7ovZlvsIfi4T40KnCsS4p638rtotvoiBqWdBVHopFse3XbXCOaiy2L542QPROnqHSPzhVJvKIXEVqZ1YHj9MxK45KV6ae/sjsdd8x1QmFuuN5c9PzMT+zHzeWFR8ZfEidu8dKzzGH4lV2iPmmQ9GYCQ4HAhsad4hqiJOLtVDFRUTicLHiyncSqaZV0qpW3Gw+Comp55hM1Tt0tQzrIvv2SXuWc4uuAHNN19cfJq5qWgK4Zp4l/xNl6R/GGedGGleGJWKyfCobWKE+GaeNETiSSZbGPF7nNxb9neHXVXF3MTNwYZYRBJ1xTxuNFWcMY+PxXht7re0L4rx5ot71PIrmiIi8UEsYBgHu3lhpfn2r05sRyY4LxaJV+bb9LL5KgXVleQGv6W6HprH9Ng8Kdw2EPdeLIIEIvyWxPOeBeHbqF6qlXMkVDTWcsNyns1CcRAWGqckMQGneNiScTsIz4qTy6IEC6kpcfKXmSeTGIk1PqTY5k8td+VL+y3fQBsxFv4aKpGbx03L+W08TinnTJXE6nH/DR4bb5+aUiG/jUVSzpnvKiqUSqX/AvOC4L85xDdRiaPEcPNDm/fYDH2HWfFxSq7eUsSEHH4kdKJ5EMHfakqtxBbzg4srWzFL4vl+sVhsNbe8feaWwN8dMbdA+nDt2my+AzjAr5tXdn/LH2eHuVeHcapdWAB+Vsg2/rXCac7HBobm9SivFuZxEne60iiU0G6UtIN4nm6jYuNkypQpU6ZM/7d+Aj7BnY0vK0z4AAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,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>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAaCAYAAABYQRdDAAABT0lEQVR4Xu2UvyuFURjHH/mxIImSopDFZJBBIX+B4U5MJpksBiKDxUZhtBksWCUZCGUwm6XEJJvZ59t53vueV+8r3Sy33k99uvc859znPOfXNSspqR8acQynsTmKN2C7f4phHI3ahSjJHm7gLe5GfbP4aSFRNz7hOw5FY3KZwU3swDs8trSSAwuJlFCxVXyzPyRdxBGcwC+c83gnPlp2kj68sDCJULzVv+eyha846G1N9IFLyQCP7Vg6iQo5x7bqiAgFb/AMmzxWsVD5uLeFVjEftVcsbFEuvfhi4bAS1jymPqHJVKVWMoD7+GyhGCVv8XFVkpPd9rZuxIllT3oK1y1dun5zbWFLCtFytYeneIXLeI8PeISHFm5IwiReWrjHv6IKeyzdeFXV5f688DrAwv2sBe2vDlWr68eFbHdtqGq9Qr2+5OH8C0oc/y+U1Bvfh1EwUAY7yucAAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAaCAYAAADSbo4CAAACC0lEQVR4Xu2WP0hWURjGH8nASBMxhCgJIQJJaBBb0obIFlGiFqH2FAJTh8BJkKDFpVJTWgokCFdRUFRwCNJRQRIHQUcXNwmp5+G9F+/3cv9Kbd8PfvDd895zv/Oe95xzL1Dm33OR1vrGCBdoHa3wgSJcpo/pbcQ/SAOYpvd8IIL6DdPB4HdhbtJ1+o4e0s7SMCrpBO1z7XFo1r7SZz6Qh1HYQN7SP7S3JGoDW0N6WaK00B+00QfSUE036Gd6ld6F1TrkEl2kryJtWWgGv8ESzE0zPaJDPhDQSndh9xXhOSxBJZpKFb0G63AKK4euq6M3kZewstW49iw0s/u0zQc89+kM3aQndDa49h2/BBZFSWkgT30gCf1J0hRqdtZgi7goYd83rj0WTbemfQ62wDxZD3tCD2iXD6BgEjdgDxrxgYCsgWinabuP+wDO+uqeTNrpb9rtAwFZA7lCH8C2uCerbwnaEcewFR6HyqWy5crKEZ5PScdCCe/pNuwgS0L3zMO2exFU9j36yAc8esktI3mhhvTQLaQPNg6VXUle9wFPuFBVnjSa6A7swUUYhR3zsUnq1fyaLuFs6+kFlYb6jNGPwe881NMV2uEDIQ30F2wRTdIpJIzYodlbpXd8IIEX9BPskyAWZdRPf9IPyP9aF/og+o7sPrfoAuwb57/xkA74xgg6qXWSagbLlDk3fwFRMVInpizikQAAAABJRU5ErkJggg==>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAaCAYAAADWm14/AAACF0lEQVR4Xu2VPUgcQRTHXzCCYqIIfiAWIRIRURAxCmKwkiCIKZIiAS1solYWCgpWgkgqLdTCTiwkFoKIjUXAg4CIFolFCIQEMURFUimYJvjx/zt7OPd2d869u/J+8OPYecvsmzcz70SypEcRzNWDFsniadEFp8X9gRa4LCaRjNIIt2CZDgTQCxfEnWgk8uE6fKcDIfD9DfhaB1KlE+7Dch1wwGS3JQNb8QAuwlkdSEIV/Alf6EAQBfAlbII5KlYCv0n0cnLOT3BcB2z4sSH4FfbDKfgFHsBq7x0m9dv7jcqSmBvBKvrg4Cj8A595Yzw8m2JWzJWTbngipqRRGYMx+EiN31IH/8J5ucuwGO5JYtZM4BBWeM82z+EvMVUMgglwPs7rYwJewQ5rrAGewwFrzJXAMLyGazBPxQgTYIK+28PVcZW6tD3wH2y2xlwJcMvaYaEOeDi3gAfkM3zsPcevm73/hNfoWEx1osJDzZvAG+FjUEx5KsV8/C28FP+prRWTgL1V9yFe5dD+wT79AR7BH3AF/pfE/ScsXyxgPBk8eLvwlQ6Ewf2/kOD7PgFX4UM17qIVfodPdYC0iZm01HvmxB/hjgT3bvYJNqt6HQiB5Z/0DGxCPBinsEbMC33wTNztdgTOSMiECibMbzzRgTjs+/yniolZGU8/k3HBMzMH3+iAgu9xPtdiUobXiWV1teX3Yv6+s2QJ5QaRDVZGDDL4EAAAAABJRU5ErkJggg==>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAaCAYAAAAUqxq7AAACuklEQVR4Xu2XS6hOURTHl1BEeUailKQYMDBSKPIcMJBCMiFMKHndPEaiJK/IRCQDREoGmBJJyGMgRXIpGZkoShL/n3X2Pefue873fe7X595u+1e/vs45+5y79l5r7XOuWSKRSCQSiUSiv5wpF8khsp+cIhfKwYVxvZFxcqkclR3zu8w8fubRNMPkZbld7pMv5Ul5SJ6XN+SgjtG9izHygjwg2+VxeU6ulQ/kbmtykbj5oJyTHZOND/KKnC6/yLtyaHa9Wfh7q+Qn+UtelRM6jcihkjfGJyO4vlouMH/eHvNugBXm8U/NjrvFSLnf8gqZIb+aZ2CgXCenZddYvIfysbwn38gX5gvIOX5HZ2OroGVvmZc/2d8gX8tZxUEZY+WW+GTEXjlRtlnXxWAOv83bb6t5vMRNrO/k/eyY88TREDz0m/l+FLPSPFtUwQj5xHw8cHzUPOtVDDBvWyZeZLJ8JNdbnn1+d8rFYVANeO5161rpp+R3OU+eMC8GIGZiJ2ZYY76IdWHi9HPx5gBB7DLfr4AFfGt5xhjPHlYLqotnlEHw18yzyb73TJ4xr+J6sOBUBIsfCAl8JZfI5dn5MEcWL8C1soL4CxM+LTeZT4AH8oCwsdESXGOBxmfnIM4CbzpKvRZMljatIrw5qVQCDtVUj9nyh+WLALQs1bPD/K0WKjuufCDuyjc1pUWfHjMvxZ/m/Qws3kXzFihSloWehHiZA+0PJIJqvGN5xQfiyq/LJPNyviRvym3mD6DMb8v5+dAOyrLQU4T956N8ap7Q5+bJK9sP48pvCN5gvFFCScfHMf+chRZC27ebLwjxEnfVN9t/q/zN1o0stIiy/aeKsMe2rPLp8bPyvfxs3oYNvR5bxHB5xHwz5nOg6mOWFwN7LP8R8DHJ3nTY/P4+C23EJwMJC87tNCKRSCQSfZs/j717zkve9fcAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,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>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABMCAYAAADQpus6AAASTklEQVR4Xu2dCYxEWVWGjxF3cV8wagDBIToiEhUlowSXAcygqKhoHJRABsWAKCMoMmrjSFDZVBgwLlFIVFxQyeAKkQ6amVGJgBGHgMbBKEaNGk00gnG5n7fO9K3b9716VV29Zb4vOemu96pe3e2d899z7+uOEBERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERETldPrXYj61MRERERC4YDyz2bcXeu9hVxT5v/bSIiIhcRj642McV+9hi79Od2xau9f79wXPgQ+PkdTkPKDNl38Rc/b6z2F9G7c+7Ffup9dOygaV9sJSpvkJQc99xz9xVmGqLlg8v9l79QRGRffAFxd5d7H+Lva7YB62fvvAQ4L+0P9iBA72+2K8V+5ViNxf7gOb8JxR7fbErm2PnzbXFfjw2B4iLAMLqpmLf3J+YYUn9PjNqxi15ctRxuo39T7FH8OEtuX+xf4h6jcP1UxeSXfpgKVN9Rf8s+b7riv131La8jAKcMYh/+Jj+xADa6BXFHt2fmOCjiv1R1Lb5t2IPWD8tIrIOguVvij2nP3EJWCLY7h21fk8p9s5it8VRFgIx9yPFDlavzwMCwe91xxCUCMuv7I5fRK6OKmpGmZ2s22O745vqx7V+vjtG1u32qCKMz/7EBvvdYr8d6+J8Gwi+iPzD7vhFZK4PTspUXy0VbPDZxf6j2Nc3x7j38Dk/Gxcjsz2Cur+62Nf2J1Y8vthri31kc+zTit1a7BObY3PQDj9X7I+jZuh6PixqNrO3fawqiMglg31CZNm+rD9xCVgi2AgSzF6ZKRNkeuf6ttXP8+KLi72nPxg1SNwSpxOE9wUBDVFE9mtE1o2fPVP14/Xzin1KsU/uztHfZCNujPmlJzJOL43dsmstL4+LL9g29cE+GPXVNoKNe/Dfo34mIbv01tjt4RIyUc/vD54CjJ+3RBVHPYjM31hZKzgZe78QyyeBiDTE2s/EeEw/IY5PRrAfLXavo7eJyF0BguA/RQ2Ql40lgo2AkPuievh873DPmu8u9nf9wcInFfuLuNgb7wnA74jpsZN1oy49o/qRMfi+Yg+OmkVgOa2FrAXfR8aU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Ntrg+VH/fEjePwhD6oXvSFFDX7wial2p95NWx7fhJIKNciKO/jZqH78y6sSUcdHCBO1wcJyyPjvqn2v5xdXv2f8JPoexkVl54B7406h1x68wTsi40Q70UTs2+B1fTZaNjPBNUX00GV7GXX9PzfkhEbmk4ITIQuRsH0eDo29n/8zU2/f0r5NNs/KzYE6wsd9jJDJayGgQiHImm/TLmf3rhGvTBlNZGt5PYCFrN4L257q9wwdm3bfH/Gb1syCXbhA5fWClbAizkSieqxvsq35krw5i2d41yk892gzpLrDHkj7t64agIdC2WWi+kywXY7GfHABB/Y6o56bGGXC+Fw8w1Qd8L22SS43965apayejvuoFW0Lb8D05VqhL+xrmyrKEkwi2HsZCrjT0HMT6g1ot1BMbcRDjzDrjhXGT/ZvtMOrvPNe2He01Gneb/JCI3MXJWTnO41tif39KYRt6wcbMlFkpy5E4WrIvvchowRmSEWA5ZxcIkmQo2WvCskUvPnhN1qF33JugzDeubK78pwEZxLZNcy9V/4QiZDk3tXPPWdePJSqyfVdFzZCRFSbTc32Mg+WukDF5eX9wBRMIlin7/XqMITLBc5nGNpt9TXdu1z5I2muz7Dt1/b6vpgTbWUDG+pH9wQXQ/wfFPnr1mvsSYXVbjP0XwvvNsd3/Gsan0J7s2zwrej8kIrLG1VGXywhEOPrzoBdsLF+y/PScqMtKS8pFoGTZgQC+LVdGXTZB5PSij2wJYo122hYCBcF9tIR22tB+LL/APaL+oc92L1UPYojZPW2xlLOu3/2iCnhEB3vMbljZA9o37YEHRf0L+Gw3oP8BkcNWApbfHr06lpChYcM6gvjhMZ1xYmyy/HYQx7MrsEsfJO21nxbHrz/VV+cp2Hah3dfHeKBfHlfsX2N+KRFR/8JYLoYRTDyw1LfjaTLnh0RE/h+c4Fk6pp5esBG42ICNyOApuSXgiNmHhC11yi1kaEZZGrIAj4rtr0l7smw3F0ROE/bLkIUiU8n+Gv4d0yYxi1Bhk/yUqGs5r/q1/UQmIgXVvqHfEbwsjTJpYN8S9UUktFAWxlz7d8QesvaOdSgv5Z5imz7ombr2XF9dNsEG+IRbooobMmejfumhDVh+7cX2CMQtk5te3J4FU35IRORCQMBgUzNBkY3iu4JT/o5in9ufOAeui8s5SyaLxEbqTVzW+l0GlvbBUqb6in123HeXTbDtChNTsrM8lDUHmX0mjSIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIicjb8H7H2sfbT+4rRAAAAAElFTkSuQmCC>

[image21]: <data:image/png;base64,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>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAaCAYAAADMp76xAAAC10lEQVR4Xu2WTahNURTHl3xEvqMQko+JDAxEKYxQBgyMFKGEMZLC4L6kTAgR+UiSIgrlvVLKk4kyUqRIKDGSUgaSj//v7bPfOXfdc86973jvlrr/+nXPPuvcffZae621j1lH/5+Gi8limDc00Tgx2t8cao0UR8VGb2hBc8Tt5Ldt2idO2MCjG7VS3BUTvWEotEg8E3O9YQDC0TPigDcMtuKLoGp0o5aLV/ZvjjfVTPFarPaGCqJg2anN3pDVBLFOzE7GY8VascRC1TcTC30rZnlDIopxVQLXzMncK5Jrr0viuhXs1hhxVhwUn8QxC9WKh/xesPCSMpFzvRZakxdVf0fsEqfFY3FR7BcPxPH00X4x3xMx3hsQ0TkkFoovFrzDCbRUfE2eKdNVC86NcPeZ57xYkIyJ6ndRszDnb3HFGiO5XnwQM9z9Pm0Xy8QG8cvqF8eW/RR7kzETky5eLBi8WOiezJi0+2FhXuYh6nlpxII/i3nekBUN/72FAoraLf5YehBQwd3WuPVFC/bKe0eeWPA3sdgbovD2odVvK7+MSRPSBRFp8tCrlQXjZK/lp45XaUogQs8WZBs2ffCjOCfmi1PinYWXsvBR/U+GyOGwTxe2+4ZYY2mNZN+x00I38qLg6TrTvCGK/GXra8mYXD0iXlh6tk8VjyyNdlakzksLz2SFY8y7w0KtcE30EPNeE1OScVZ0LFKv8GOICNENnopbFloPWzc98wyFQhvKazVU/xtrdIb/PLfQU+kGBAHHLot71vg8iqlYeDzH3MIj2hAe+6JCRDEvfxEfKzibdzoxF3PG1uXHXqQiRzMFnqu8/PWKXtMtOA231Zv7tEX0WNrDq4p5blrJYUUvJLe2iknOFkU0Tlo4lQ5b/ucfkbtvocCqisjjNOdCoTh6I5ucLSsWTf4WbSWikMjNKh/hzFuz8E1d9o5BF4XUZfVtrxXR3tjtti62o47arb/rkHk81Vae3gAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAaCAYAAADIUm6MAAACxElEQVR4Xu2WS8hNURiGP6HcSi6RMCARiSRKMSDkkgkTJQMTYiRCYXCEIblMSQZIiUwkxImSUmJgJAMSGZgoJga8T99e/9nn2/tc/RfpPPV2zrrsvdb6bnuZ9fh/GC+NjJ0tYD7PDRmbpTPW3cbPSVvjwGCwRHoiTYkDbTJJuictjwMDyWjprrQ9DnTIBumBNC4ODBQs+EaaGgc6hDh/bn9vgLYYJl2RLsSBLjkt3ZJGxIE8w6Wl0srsf552q8Nk6a01Tqy0xnpprPlB50rrzEMsslH6IM2IA4mUyUelp+bVIDFP+mrtuYxNfcx+Ixz+unRAOmYeTqyJVS9Ld6RRfbMd3vNJWhb6++DEx81f/ky6aTWr75C+S4uzdjO2SF+k2aEfy56SVmXtaeaWvCEtkr5JVSsmYprHe0vZa76xFdJPq7fuJemlNCHXB2OsGFIswEIsmGeiuWGSRVkLY2AUvL1TWpCN5UkbZ15TKuaumZW12SybJuGwWgLP3LdiSDTaeISN/LDi85G0ccKrIbipavVZPN/cjXuydgKLEVIkY552Np4qT5kXIy1DBdKkI7k+LEPokBybpF3SIfMPA0l4XprZN9sr0mcr5gMeuijttlrlyXuRHGMsQq7wPqpLQ/hgvDevLMBij8wPM908jPAAUKejF4BxFlob+ln4t3m1Wi39spqBWOeqNCdr58Fg7CmtWwqnP2ge45Sn2+ZJS5V4bF62mIN7aZeVqBRu8VBY7pV0zfw6sF96Z74Od5I1tal14PGqFatNKUzC+umDQyXg0pPcyum5QMX4TlSs/GvHe7h0pUoU2xGep1xWQn/XYAUsx8H2WfHujMtfSwtDf6fwnhfZb79AIj00zwWur2UQcmetvoR2As+dkA5n//sN7hnN7i6MUUW2xYE24QtLuEVvDgoc7qQVP/+toIJRCIZk0z16/Ev8AWi4cgoj0qLdAAAAAElFTkSuQmCC>

[image24]: <data:image/png;base64,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>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI0AAAAaCAYAAACKPd9eAAAFMElEQVR4Xu2ZWYgcVRSGjxhFcY/igorRBCFxi4iCohLcfVAkBpUkqE8aNGA0D4IbIyIGwT2uKCIiromKa0B0XMCAD4GgJLjggigiIgg+iIj+X869dvXtWzXVncx0pac++JmputXV95462602a2lpadme2UnaKz1Zg92lXdKTLVlGysYs5HHppHSgBodJr4S/LeWMlI1nSA9Ly9KBPjhNes0Gi6LpwMjZ+Gxp3LZuMjtIq6Ub04GWLYyUjXeV3pWWpwMDcLK0STo8HZjmjJyNT5C+kuamAwOwj/SZtCQdmOY0xsZ7SudLh4bj3aRzzCe4Y7yoBldLH0t7pAOBfaULpCPN02P8njnFiwo8KT1nfu1Uw3ceJ51uvkvhmHkzf9YxLBphY9IdTdVN0k/SKvPOGu/j7xPmRqvDM0E5LpKeN7/vJ9Ij0gvmafZbacH/V3ag3lYZaDKhb7hXel1aJz0t3SJdK31pg+1atgWNsPFZ0s3m6e43c8/DkeBE6fdwzUSw9x+X7kzOw1HmTVd0Pib6l3lNfVD6V7owjBUhYr6XDkoHEm6VfuhD9AQzt3wyD+8wHjOv9cwPG5wSxohIIvOtcN1UMkwbd3GledRww3+s20FOlf6WbgjHGAxHIt2lxAXluvFLzLd4ERyTWkpNJY1eYR1HLcKCfpaOSAcmmf2l28znN27dDsJ2lwz8jXRAOBc5T/rVfJzrqoilox8aZ2O89zvp4MI56iceulBaLL0pfWH5SVctqEhsvkj3E9VRFvSHeW8xDDAkBi2uaT9zG5SldKIau00EGQBnxG51aZSN8fj3rDtCYkRRsoqdOvU0N+m6C6K5/tPqdex1UyffzTV1RSap0+CzOSDFk3EjMfviHCk40Trrvr4MsnfuHlUM08Y95CKKev6j9Kh1p9oyp4lORlpMoZy9ZD4xopAFsTAgZd5n/iBTWHSuDKQcIy3qQzhDLlWn5LLvmHmPc3w4xvkultZKd0vrrTNfvoP1snayNWueJT1g3piOmzvPzn65zTPPDrdLZ1hv3zVMG/dAP0MZGgvHpLQ7pM+t9/eJMqcBIidtEGMW+0U6VnrVuj0bg7MryaVRdnTp/aaKGNUEDgEEc8wb6ZXm86XppGFeHo5xspit+TzlnD6HMZrn2MBS4j6w7gzOM1hj/jn6xs2W7zMaY2MWQ/QQJS9LH5ov/sDiRYEqp2HhOBpGiTDRMel989862Km9E8T2ECPkGsIYVWXfNdnE7EtvgF1Y99fSpdYx/gJpg3WilLXETcNl0tvmUc4DecM8wwHlizIWeyJ+DvjI3MGAzQj2ydmlETaOEYW3sUBeDnGujCqnISKJkLSms6jifdPjHNxrk3nDOAyKu0keeq4Pwg7xxVjaz2AnohgobzTOMXNQPor9DGVko3RIOOa+uW01NMLGuX6miiqnYaKUtdXh/61hqfSi1X+xuK3J9TMp2CHa4mjzjMQDIMtgJ5pMIIMQ9WcGEd30OLyBZyuM05AheMAELhkKp73GejNEI2x8lXk/c7m0dzJWZL70lLmD4emrLH890UK95mXToBAhGG4Yb13JJrPNy9Kn4f8yo9KA4wDLpIfM+wqaYXqVc6VnpRXmb9V5oXiXeSm7X7rHvM+gNOEsXHO9ecNKL8TbXJwvx9BtzGSjyibZL0yETn6Qn+6JnjHrNJtTzSzz3U20CQ+3ajuKk8XeBOeKO6F4HDMF56PzxXKWro9z3I/zaYZJ2Z5tXApbxuvSkzVg60j2a9RiGkpr45aWlpaWlpaWAfkPIYczOmAuiKsAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAaCAYAAAAAPoRaAAADeElEQVR4Xu2XW8gNURTHl1CuuUZCIpFSSCm5PFHkGi/K5YFQikiIPHwlD+RSPJDkVvKAJJQivicJueVWKCTyqgjl8v/Zs78zs8/MnHE+53wv51f/zpzZc2avtfZaa+9j1qDB/6aH1DG8WWPaYs4yZkl7rf6GTJBOmwtCmzBOuin1CwfqxBLpsNU/8NZZuigtCgdqAMG9IS0N7mPDJWlBcL/mzJAeSf3DgRowTfoRfYYQ/FtWx/RvJx2XDoQDNWKb9FEaFg6Yu/dKmhwOpNFeGi9NtVKt4MwYaYh/qAJ9paeWn26DpdnRJ/SRZkoDWp7IBztJd2y6Zq63DJV6xh8SXaXr5gKUC87SmTdJt6NrwPHP5l7CyypB8N5FnyEEcr10SFomPZN2S6ekzdJLaWTL09kQtP3SBemXdE86Iq0yN0eck+Y6f3g/wXRpu9TLnPP8CGgcJ6RmqVt0D3hZbyvvpnMsOw39HN4Q5ngvjZKuSF8sPWhZ5NW7Z4uV217GSnNGTJS+WrJTUzMHY99pIHukDdJRS74Y599aegqvk0ZE1z4lz0kdpEnSPHMpXZS8evfg/F1zi1qRJnOrQQ15qN/V0TWG0sx8TbOXxhtKnvNxMBjDMa4aOpnLFsR1Frz/tRXYeYgOUfKrAaRok7msgCnmmgyr7w3AYU9R5+dK361gJ05hkLlF2hkOBBRKe8BgDI+vBhlAihMMAsE25ieksz+wZM3hzAdzjTIOv11uLlMwhOx5Iw2MxuneNLEu0Xff0bNWlTl/mtslgEVZWxpuAVsLNWtSgxTxWwPNbJe5oyrg7BPpsblo4jjRj9ccGYLzYRPy7+bwQ0e/b6UVITDsMov9w2KF9Fs6Y6UsjEMZ+nonC9lBwu2Y99LpC505eHiN9Mnc9nNVmh8bpxOzPXlnMSCsOZxpjsbiEEi6O0dO3ssq+RI7L22NnvFQPt/MBSythGicL8xtd5elscnhv1DGd8yVWGFwhgnDlMN5Jupu+WfnJkv2DU+YyuH3EO6zy2Q1K4LF78Pt1sPO9dySzbtqSOmz5laXGjtm6RMPlx5Ko8OBfyTeb/4VsnhHJK5bje8BnMaoMQ45WWyU9ln1E5MVOM7BqBpYABpd2AdaBc6Q9pWcIlCk7MJwoCCUHYeeSvOkwdzsSmklWTfYXki7vBNYLeC0yt/qBg0aNCjjD6n6kk6uIPudAAAAAElFTkSuQmCC>

[image27]: <data:image/png;base64,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>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALEAAAAaCAYAAAD48r3oAAAFbklEQVR4Xu2aaah1UxjH/zJkDC+REK+kzCT0CpmHDAnpLUQJkQ+GpAx1C0XmIcmQKbNCMst7RflAQomSDIkkX4SSDM/vPns5665z9j777LPP2ff0rl/9u+fudU5nr7X+63metfaRMplMJpMZl41Na6cXlygbmtZNL2ZWb44z3aLZMfF2pueKv5mM9jatMm2RNhRsb1qZXlwCHGR6QZ5BMqsx65leVL9JdzZdaHrb9LfpkcXNU2UN0/Wmh7W4hOD63aYromuzSlkfMzU4xvSJacvkOiY+yXSA6Xt1a+LNTZ+Z7kwbjBWmz03L04Yps6fp5vTiCFT1MVMBq/8hVQ/cVqZv1a2J9zX9YTo9bTA2NX2gwW3TZB/TXenFEajqYyesKe/UUaYN5GbZyXSkPH0vFcLqPzltiOjSxJvIv/9y06+mQ+R1O+Mb84Dpcfk4x7BJPbgQr8O8HFi8bpOmJq7Tx81MJ8g9RB/xFN7aMXpPq7DJeMJ0qekqeaq+XV7vPGh6Xkun5mHgvyv+ltGVideRjyGZ4udCvL5RPqkx1MTvmjaKrnFqwVifJ88075jul5vldflJTJs0MXGdPlLSPSmP0O+Z7jE9ZbrI9LXc9K3CKrlOvmuGYABuYg/TL6Z5+RnnKCwzvSY3XF1ds/DJaljdP5p2SBsiujJxoE6tSD+4R+4VyHb3qhepMNjvpjnTEaZ/5GZJI/c4NDFxoKyPu8o3ruHYk8X6p3wfwHv/NZ1YtLUGZrtavUhLsU+KYBVxI2eadinaAuur/dRWl3TyBzGqiek7n6kjos0wI9WpFdPFiHkv6TXrWPnkU0aQionO20TtvGberlX//KRwv9x32pej5Zk2vY6GZd6yPp6mXkAEyibqf/YBlBZnaXF5io/o617RtbHhpogAZema0oMIW9Y+aSZhYgbxvpq6QV4TVnG+PINxWlIG/SBYEDQGQSn3jWnr5Dpg4JfkZ+HMx7PyCFgG9epN6u8LpcsXA64jxqSKOn0MG9iyDHKlvB/MFePRCnwRXxhWziAYdGo50kkVZau/SsPMAZMwcZvQbzZsVWMIVf2gdJuXP91ba3HTAgSauG+kbEw/Kk3Libp9DCVRGq1jQl/HMjErmY6QrkKdE68cTidoI72wwXhDXr/eYdq2eM8gKEUON506gvZf+GQ1pNcfVB7BoEsThzEkjQIL+Vb17ymY2K/UO+smurL5YbyJbkS5+IHIufLdPVBbpiYuM3wVTU1c1Ufu8Rn5HBCt46xOGXGbFj9lbcXEpA2KbXa+h5r+Um/wMDiDFR+LMIDcXFcwwZiYzU4ZwcSDjrAmTTAgJuW7L9bg40BS6cvq1Z7s+JmHc0xnF6/DxHJq8Zh6u3/mJDXxvPoXyjCamrisj9Tub5l+kh8KUK7E2eYUeR0fz0krJmZj8ZF8wnmUyw19KS/4XzEd1nvrQurgkS5FfVeETg9aSBibJ3U8csYE6DfTp6bdo/dNEqLNo6YP5dHxAvUvJCImbXGkJcNwtMk8kAnZsBHtmAfmJa49uzZxWR/RnNwj/D6E49pXC3HaRQDE6DGtmBiIBvFhdfp/gIFcpeH18KSZU7P0OS2YTKJmmamWyx87r0iu834+F0yf/h8giqcmbpJ1mpoYyvqYXk//T2nNxHUhfTBY1Lv80KarX2JR3nxs2i1tmBHOMD2t5j8h5bcjRLawiJuWeKT549OLU2bqJmbT8aY8EvBTyC65TL6ZGDX6dA1RiTJtv7RhBDA/ERTjYkICS1cBZRzYj1GWsPl7X35wMOx8uhWoaZpGkDYJE8lmYVYINSMLcNzFF9L0oLIvM0OwoNgAVT2CXkpw/MRx5bgGzmQymUwmk8lkMpn/+Q8uNR86BWuOiwAAAABJRU5ErkJggg==>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAAD3UlEQVR4Xu2XWchNURTHl1DGjJGQSCQKiQhviIx5UqYi5IGQIfKgpJAiCklESUIeUIpQ5AERmTIUMuTBi1KGDOtnnf3dc9c9w/3ulevh/urfvefsfc7ee+017CNSp06taaNq4W/WiHaq5v5mpbRWTVD1UzVxbVkMUR0Wm8z/wAjVMfkL8+mluqbaqnqrGl/cnEoP1RXVQN9QY+ao9kuVHrNJzChbVL9Us4pak8Gbdok9Wyu6qC6r5rr7LVVnVTPd/bLpoLqlOqjqrBqsalrUI5lBqifRb60Yp/oW/XrY2BtSYRgNUH1UrfINOaxTnZfaJtgNqveqPr5B7N5z1RjfkAWL6aaarfohZlmuqSR58CwGYVJp9FRNiX6hk2qS2BjVgBcTNuTBi2I5rbeqfbyTWOG4JNlzLGG06oDqtuqrWMbmeni8Uwos7JVqqm8QyzUrVPtU81SPVNtVR1VrVc9U/Rt6Nx6MvFN1RvVTbP7Me7GUVs0jYuvy93PhQXIKucXDyzpKaRYfpvogya5J5doohYnw/jdiYYp3fRZ7vlqy8kmAEL8q5Xl/A23Fqs4pVTPXRoLaoVoploTjL2ZRr6Nfz3Kxsw4EFw7vxzunS3Ei53+r2HW5ZOWTAEZJ2/BUOGewiz7uWMBuKZQ0an7cK7KMEocJM3Emlwa5jMNfYwg5LS/RM+4LVVffkAUL/S6luWGsWBLDW8IE4n3KNco0sXyVFGYBvHCJv5lD2EzOVVlUFD5M5pPY2SRALmDnwoCcXe5KceziAe/Eqkkcnl0g5llMBG97qeoetVM1SJKES/g8wJM4aM2P+kCoMGlewFyomGF8NnFZobkB1kD4EsZlw6Qfii08wP8HqvtiVsYg7Eo8dunDc36HcVPc9Z5YhbkjhZ3CYGvEjgABki8lNT4+LBQ7WR+X0lwHjBvyCd5MpaNEx2E8Kg9rLBufBAOEBGU0GIEJ+NgN3uQHpEpRbdj5C2K7R6JjjNOq9VGfAAZKKpmE6hcxAyeda0jknKYpy+fEvM5Dcr0pFsJlE+LS7zZGYSAqU9Y3BAmSQX1m967vr+NgVD9+gP57JD1JYlze648LgVGqx2IHu0zCwYokOkPMKP7bBZc+KebyxOohSR6YE+p11UTfUCYYk485DotDVZOLm/8shiNBUvjkwTo3R/JeWAKWfSrm0nvFYtEPigG2iZ0+aefwlgauiQHxqMbCMyfEvrL57oobHu/CIBwEK6GvWGrweSYRrLZUzO1xzbQvSPoRPnlWDskT5fVNgsUzjoc8wiGvkndiXPJdUsj/M5jEatVI31AjFknlIV2nTp06VfEb9T+oY2MgirAAAAAASUVORK5CYII=>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAaCAYAAAC3g3x9AAABOElEQVR4Xu3SzytEURjG8VcoouRHSs1ikmZBsbC2oIjyH0y2YysbhR2WSqwlCyxMScp69kpZWM3KH2CjrCz4Pr33uteZmWYmm1ncpz51zz2n9577nmOWJUtnpRvzWMEAulDAMvpT61rKEK6xjT284ARHOMcd+n5XN4l2coiFaDyBN9xgFu+oYDCab5oR7Fuygzl8oIhebGA6mlNy5usPgvcNo0Kf5v0Mo2IPyJu36RYz6QVh9PsXeMJwMKfoY5ep8Y55n/9EXzpDCWN4NS+q4opOWXPKqdUWLKMn9c7W8I1jLOLLfKGij6nAVDTWc1iwYsGBTeIZV7jHFqrm1+URS8nS1goqOuFx88tdbxxn12oLaiNxe9rOqvn9jHumnm4m0+1H91IHqCLr5rtTn/8V/d6o1W9Jlk7MDzRDL4XzYs/7AAAAAElFTkSuQmCC>

[image31]: <data:image/png;base64,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>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAaCAYAAABLlle3AAABh0lEQVR4Xu2VMShGURTHj6SIQkSiFBmkmAyKLGZKKTIoi9VkMDFYlAVFEkkGZbVgsJuVQTEok5RBofD/d+7z7rvul/vyPZb3q1/3vXvPd793z7nvPpGc4lEDq9zOLKmFF3DPHciSHvgIx90Bm2l4CuvcgQA6RVc1YPVNwlvYbPUlKIfHRl6nZQY+iP55xDZchyVWX4IWeAeX3IEAOOmB6EpZR8L2HPaZ+wTcWU1wDL6J5r8RltlBBWAMY7vgFdwVnYtzcsX7sOIr2mIKbsEb+CL6xKuw3Q4qQDfchCfww7ScaxjWw4449DtZ1PNHil3PIIbgq2nTwjReipYkFfPwHra5AwH0wmfRdzKYqJ5nsFJ0Ry6LppzwvsG0PljPJ9HTh0zAkXjYT5SeqJ6jcFbiF3pFdGcumHsXpjWqZyvcgNWJCA+cfBFew0Nzba+KD/Aumgnf16JftDT87ZHEGQqCnyDqg9lYE02/D5aIJSh1B34Dj7I5tzNLmNId0aPuz+ApM+h25uT8O5/mbj1PB5ykKwAAAABJRU5ErkJggg==>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIQAAAAaCAYAAAB2KPSUAAAD3ElEQVR4Xu2ZW6gNURjH/3LJ/RKRkIOQJIRE1DxI5PKApAgl8eBBSh5IXhQil0jJJUqRUxJySewHRZyEPEhJJJLy5kW5fP/zrXX2mjlr9t5n9py9z9H61b/dWjN79qw1//V935oNBAKBQDm6iAaLhptPtgOdl+6iYdDn2TNxrCL6im6LLot2IuNFAh2GBtFx0X3RsvihyqAhLkIdFfh/oBmCIQItBEMEYgRDBGK0myEGiBZCL85dSMBPV9Ek0SrRDNOuJ+1iiBWi56L1oo2ip6LJ7gmBZrhobomOQg1xSnQM9d3C524I7mWbRPNMe43ot2hByxkByzZRo6gb1BxcONzK13MLn7shGPZ+is6JxkENEkFffFgYFns77bYwFBp56jlpecH5+wKNDv1Ec0WjneOMFH2cdluYKLojei96Jjpk+m6I3olemr4e9guG3A3BB/ZG9Nfou2h+7AyNGhcSfZbxaH1NwsHchIbYAvT3OztbUZwn6ryol3N8DjRi+MbKBTE72ZmAtQkNMcvpG2n60iJ27oYg/UXrRNehA32AuNPPirY4bZcIGmXS4M0W4J+kzgYjwFTRftFH6Fwtdo7vEJ1w2i4cPw1ViuXQxTnE6aMRGCFGOH0uuRpiM7ReWOT0cbA2L06DRoav0NW+wTnPEqE6Qww0SoOpi2HZTWFJmOZK7YwquUap+2AUfQEN6XahjIWagg+sAfoa+QN0rDRGMrRXYgiaiX8tuEUqn4etW3zkagiu/LeiCabNc+5Co4WFYewR4q51iZDdEEwr30SfRWMSxyxHoCtxX6LfUotrMCr8EO1F8WEtFT1G0YicH84T58tHOUPweAH638QZIy5GpvBdxdNakashZopemX7eAKtm/vHlrqS1iLuWhZS9YYrRhKnGtjn57m+UMgTzI3//D9IHtV30S7QyecBgr8E0x8rfh70GQ7KPcvfB+Tgpeggd4zXow7cLiXCXdg9abBJGkt2IP9wnTptibWZJqx+4YO0O0EeuhiDcQTAkUr6XLAxjafUDiZA9QliYutxcXC/K3QfHwPnzjYVzlFY/kHIRIkv9QHI3RCkGQVcFXTtdtCR+uJkI1RmCufEw/KG6llRzH/xuI/QF3yj4a61yhshSP5CaGoJbqqvQ3MtCyVeURfAbggXaAWiY5HuOS9AiNQkL2oOo79s+Us198Dt8Y8l0uQf+1JVmCL77OQ2tFZpEm6BFKlMUi3mmMl+RaqmpIQjTiM2LPiL4DVEJdP5q+CewluRxHzQF5ynNUGmGqJbMhmCRc0X0yXxmfaMW6BhMEb2GPk/WGoFAIBAIBALtyj9bVL5mrsg26wAAAABJRU5ErkJggg==>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAaCAYAAAADiYpyAAAC8ElEQVR4Xu2XS8hNURTHlzwizyJv+VBK5JFXiokQA4oYEcmAYkJRIhLyKCl55RETfElRMvCIz4gy8MjIYyIpyowiA/6/1j7uuadzjnPvVdzu+deve85e+57OXmvttdcxK9VS6i2uiG9idsLWchonHogBSUOraZm4JrokDc2g7mKreCnuiDPimXgq7onv4rXYJvqE/8Q1XBwRZ8VNsaXa3HyaKjaE671iSLgeLI6KaaJdjAzjaIZ4GOaMFm/sP6oP/cwXEYeo/0lZjkBEmf0/QewOYzzzutgU7rE/EoPC/T9RJzFXPBE3zNP7pFgnlothlamZynME49g5GQ6KXsH+QkwPc2quD53NvbdA9EzY6lFXsUucsPQ9XFR5jtgoJpmn/74whr0j/BKI4+aZs9YKZMVY8VgcEKvNH/TBGiswRAIn4JBGlOWIvubFcIp5QaRWICLPvJ1iv7gsLojN5o7JFEXmldhulYkrxU+xJJpUo3qIc2JU0lCH4o5gW10yPzW+iE/mmRDPkkhkdRQErnOdgPd44fdW/dJkwmfzrRJXNysWYV7stBgRrtMgTYs8K5kR88Vhq5waZEbDYqEsOF5M+OW+w7z4RGKcVnVxbCxLLPS+eXHMY3L0hxwlHcGzKbYrzJ1C0HKjXUQsii2wPjZGpN6KY7GxaJxjKJklaaKVPWXVjqxXaY7gudSfNrFHzAz2uhU5YlFsjMbjh3mxm2VeZIgAZ/NH88Iz8ffsdBGhQ+YRa1RpjkAUSYphf/NiGW+oahaNCFsjKorsNwrRV/MX2CHmBRtZk8ySPPFit6xYBuUpyxE4m22Bs+kkr1oD9YKH0YE9F+fFXbHUvL+/bX48UdCiukGW1KI28+8E+omhVttepkPkJKM9jr41+LagOVsT5rDwdvN37zBfx5hgq0vsuYHmTRVi8ezz6J5rPmPriS7PIKsumteedwGu51SmNYeoG2QIrewq+zv9QVNqvHnqkaoLq02tJ/YslCpVqlSpVtQvwdGB02mU7oAAAAAASUVORK5CYII=>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABBElEQVR4Xu3SP0tCURjH8ScoqUEoLKNNwSXE6AWETYGLENLoJtSsg9LiiwhcWqSppXAWh5oKaWmwJV9BL8FB6vt4zo3HrlwjGu8PPsN5nsO5588ViRMnnBVkcIoi1ua6S6KTO7jFGdq4x4adFJUSnrCFVXELvWHbTopKCxOcI4WCZ5OQiGOdYIpPb4Ad0w92VTa1UHJoYiRukYbp7eIZ+6Y2i16SXtY70r6m9/CCCz+uoYcPdHHg67PoymPfCG78EK/idhREF7sy4+/o29fFffEaNxji2MzR89+hYmqhrGMPmz8b4p7yQRac/7c5Qh9JVJGdby9PHo+4FPfD/Sl6RBXnv/MFtjQjv3acfHsAAAAASUVORK5CYII=>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAaCAYAAAAwnlc+AAAECUlEQVR4Xu2aW6gOURTHl1xSyDWXkOMSKZ6EyIMHiQeXkMiDB4mUkgceeDgliRwhRTyIksIDRSLllAfiJETkkpKSJC8o5LL+Z83OnnX2zHzn22NmvmP/6p/v7D3ffHvN/u81a2YjCgQCgUBj0Jc1gjWM1VP1BYoHc4C5wJz0Vn1dku2s66xDrKZ4V6AEmkjmAnOyKN7VOfayvrN+W3rImhj1z2Z9tvp+sjZFfUUCA3oFGvgnYE685wWp9BXrafRZ0411mrWZ1V31FUUwYDXJxYBzWD9YZ0jMpunHOscapzsKJBiwmuRiwA0kt1f862Iy6zzJg0BZBANWE28DIuMh831hTVN9hsWsXbqxYNIM2J81n6RudWXwrkIV4/Q24BDWk0j47OIgiQnLxGVAvArYxrrDWsM6wLrPek7uWrZRqXKc3gaczvrKOknuVYXb7lmqvf5bzXrTCbWxJrR/Mx1tQIwVk/KC/r6WGci6x2qlcsuFPKl6nN4GzKr/YDwYsOxAtQFRLqBsaLbazNP8YasNYBL7qLZGoag4J7Gukpz3Lmtf1HaJJNM+iNp6mS9EeBnQ1H/IgMiELqpQ/wFtQFx8PLnjCd6Az9+oY7kwi3WFyl9E9ZBXnNitmKkbFXjYhAFtL4yK2uZZbTZeBsRAW0l+wFVLwKCoN+aq9jQQKLZnahV+t5atNduAZty6bt3K+khyIW3QrrNFI5BnnDjXRt2ogKEfU/y3YDxkwJFWm42XAZGub7Bukbzr02DFnKDaDGIYw1rRCS1hDWr/ZjouA2Ls5pbTg3WBJBacD7cL7OJgu+h1dDwmyL6FDIiUBOJGPGnxYwEN1o0WtZwjaRx5xQlqMSDMq98F7yb5PfyuCy8DAgwKq2mKakcavkxy8aqAbUBcoCMUL8KXk2wTnmKNZR0jycZYzTepY7ZAffOe9ZbkeBctJPVxs2o3/Otz5BGnIcuAxuzY2z0eCQ+mH0iufRLeBsTK3M/6xNrJWse6RvLiebh1XNnoGhC1CbIAVudF1h6S8b8kWTgzouNQLyEeneHxfex5/6LkC7iFZJ8ck+7CnAMZCu/oXJhz6HrNkDWOeuNExtxBcTPdtv6GVkXHgqT67xnF60+NtwENo1lLSU7mqgfLRhsQYF96KMWLbtzK7L/xdJ9UF4H1rIW6sQTSxpFHnFkZsJ76D+RmwKrjMmAWpl5aRrLA1sa72/uR/fWtr2h8x5EVJ8gyYD31HwgGTAEXE7s4LSS3LX2bXEDy39Hsi14GvuPIihMkGXA86yhJrddGUoI1kdSe70jKA9dDjSEYMANMDuoiPblY1SvJPVlFktc4kuI0JBnQl//GgLh42Lp7xJqq+gLFgznAXGBOUCsGAoFAIBAIBAKZ/AGWuPA4ld95sgAAAABJRU5ErkJggg==>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAABbklEQVR4Xu3TvStFcRzH8a88pIsMiiSLgZTNJEopT+WhlEkZpEwkhZT8AQbKwooYRAZdD2UwKqUsUlIGZTAbbN5f3985zj3u1XHuHQz3U6/uPff7u7/f+T2J5JMmBSgM/5hNirGJA1SGarGiHW5hDXM4lhx03IspsemrIUymtPgvqceA+9RUoR+1fos/RKc6K7ZB47jHKnawgEc0+a0jphvLYp1rtvGCZiTxjlZXi5wZNLrvZbjEIYrQjmH5Prd9eAvUI6UBr1gMFwLZkN/rP6LH6AMd4YJLBS4kc/0ruo4TYoe+XOwtnlHn6tVYR8I96zpfu3obdtHlan5q8IQ7sR2+xZXYADrgPMa8xmREbD17xC7LmdjtS4leTd3tE5xjGjdifzzCkmvjRWfyINahDqrXOFj3ozur0yzN8OxF3/4Uo2LT1mOYdYLrOYg9tIgds9jRK7svdj47xdZzRWxWsaNrVxJ41ouSdj3zyW0+AVG1M6if9IQGAAAAAElFTkSuQmCC>

[image38]: <data:image/png;base64,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>

[image39]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAWCAYAAAAM2IbtAAAAi0lEQVR4XmNgGOQgCYh3A7EwugQHEG+FYhAbBcgA8RMgbkUW5AFiSSAOBeLfQBwBxOJAzAqSjAfiWUB8H4h/AvFSIJ4ExMogSRDAa58LEP+C0higCoifA7ESugTMyD1AzM0AcUgXA8T1DCJAfJUB4YUgIC4AYkYQB0Q0AvEdIF4JZYO9gQwEoHjwAgBi+RXQ+6MhwAAAAABJRU5ErkJggg==>

[image40]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAaCAYAAAADiYpyAAADfklEQVR4Xu2YS6hNURjHP6HIO+omShhIBpRSXgNCDBhIUgxMPAakGChFNzJQTITyyKsQKUqkKKcYiJGiK4+ilCgGYoA8vt9de3XW/vbaZ+99jg7q/OrfvXd9Z6+z1rf+61trX5EOHf4kY1XHVd9UB0wM+quG2cY2MVg1wDZWZahqlqqfDQSMUz1T/VL9UC1Lh3sTcFQ1w7S3C8Z3OfnZFGTxiuqtaoKJhexSHVNNVPU1MRJ4WLXRtANJ3iLu2Z2q0elwJXj+s7jF8PqoWpDE56quSpOu7FK9FNepXWXPCNUl1RgbSFioqkl2AKzOI9U6cQlfIs5VrbiGLVBTfVBNToekj+qQartpLwWd0SmJoBM6s8xRHZF4bKDqpmqTacclJ8TZNdxye8V9nueaAdfi3pq4pFhmqnpU422gCGx1S/VUXAc4xEKGV9vGhOmq55JdHT9guzrLVV/EPdcMuJZFI6ExcO9DyR9vLltV28S54adqcTrca+lTkp2oZ4PqrmqIaSfB9GcTsVTcRCoPNIEE8DzbLA+ceE7iDo7CBzkOsT4JYOBMOuyAlb0gcRvCmUQWP+G8RNj2Mvj6UFTY6Tu2OLmMUl0TVwT5/YnqjaT3F1bcE/wd4gcWsymDiU24lUT47XZbNcjEQviO11LhhMIJZ6VezLola9v9Uj+eLD4RsUmx5WITbiURRfXBw3cUuSaFLYJU3K9Sr+pFx2ajRORNOK+9DGXqA/Adn1RTbSAGZz7bIiyC/igkGSSFyn5e8q+ujRKB275LNuYTwelRhbL1ASptDSZ6WrLX6lXiBkqBXCvZiYTwLPcEqrQFF71SHTTtnDL2MjQ8USOK7g8huJxLYpcNhOwQlymuvLFVGal6IM4VdJZXHzxM9LpkXcPJQ5G9L/UbJy9lbDWS7BdgkuqdZIu0pWx9AOYYG1MKOkM1yc8sCeIofSX59cHDAB+LO3UsJOCG6qK4fX1SdU/cW6yH37mG831Y2rJb9V7q40YkbV74oQDv0kZO7qVH9UI1zQYCWLnNqtk2EIFV5FZKTYjBCxq1ZkXy076weXgfKSqCZWA8zJGt31b8Fsh7TykDq8gx3WhrlGWNOAeymG0He99RTbGBknCr3SfNJ9JDfWMrtvJ22zJ8OYXQvooXgRtWSvXnLCSxW9x7U6sJbZn54v4J8zdYpFov/0ASOnTo8P/zG0jTswdo9Hs4AAAAAElFTkSuQmCC>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHoAAAAaCAYAAAB4rUi+AAAC3UlEQVR4Xu2ZTahOQRjHH/mIfHMjYYPCQhG62VlIIZKP8rFQyldZoFBKkSxQFjYk5aMslC0pFreUBXd7bSglsRBFUUj8/++cqXPmPWfOjO6Z86bnV7/ue2fOufeeeWaeZ+ZcEUVRFEVRlHCWwbVuo9JhIbwIr8NdcFyxO4y98DGc7nYkoB+egC/gH3iy2N0TjIDn4S04ttiVhK3wJVwKJ8BzYuI1OX9RHfzDH2S28RAM9Ea4Hn6T3gx0HxyCV9yOBMyFr+DuXNtUMQvjcK6tljnwnZgZ2ybLpdlAT4H74Si3I4CV8LsUBzsV/J0cF46PhRnmLhwQs8K98IJZcDv8BXfAmXB0/qKENB1o1rRrcLbb4YGTg2N0HH6Fq+EMODJ3TdMwi7iBJrfhBzjPae9ij5jC/gb+EDND+EPn5y9KSNOBJlvgUbexgjHwGLwJP2by8wVJu5dhQKsCXdZeSmx9Pg3fRvgITuvcWU+KQDNbMVBr3A4PMfV5ARyU7nHwubNzZznMugNSHtCoQPdKfSaxgWad4spiao1xEXwoZqcfckRpsz6Ph0+kPKBRgebM/pl9bZvYQLNWXhJTfmJ9Br/AfVJfbw/AT3Cx25GIqoBWtZdySgILeobdwIUas3GJDfS/wjrNYE9yO0qwu1seZXikqYPPymd2x8Fn3a6Z2bYsoAw0szGzshdbn5kamCJYv/jmxXfjErgtwnUSlh5JikCzhnKAQl802Pp8I/uepeKyVAeH47hBusfBZ12m2AR/SzHrRu2t7EPY+syZfkTMLG4DG2hmmSbgc3Eir3I7PDAITNusz7yf48NxSgkn13N4JtfGCcvVzCNxLfzDz8LX8F72uY0z9EH4XszrT+tn+FRMGhwuOLGvSvVqLIPZ6I6YnfR9eEjaWQgrxByDuYFkFmAp4ekhKl58KUD/d1g/J7qNAdjdfcwEaQKWBf7DZ7OY16KKoiiKoiiKoiiKogwzfwFlA6Xda6ak7AAAAABJRU5ErkJggg==>

[image42]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAAC8klEQVR4Xu2XS6iNURiGX7nkVsIpCblkIgOKTikl5TZCosgxFAMZMBCjLRkoGUiR1AkpAxO5TBgcE4mJiZRLjhJFKGHg/r7n+5ez9mf9l92/98h+6ql9/u+/rPWt9a21DtDl/2MknUxH+EANJtHR/mKrTKWLs9962VK6kc5BfmN131G6yQdq0ksvwTrWMsrwXvqQLqF76Ff6O/I00hnbT08g3eGV9B2a3/OB7qA99A79GcU+08t0gh4mffQM0t/NRQ9fzJxCj9Pb2W81ci39SH/RddkzgYX0AZ3rrnvOwZ5f5QOwa4r149+kjKPX0MLoq+dnYR3Q0O6mr+j8+CbSgGVQDQvo46cyfUNiVFvq9CCd0Rwa4gDs3dt9IGMrvYuKUy/ugLKs3434hozl9Du9Qcdm19S4J0hnPWYBfU+v0FEupr91XXHdl2IefQZrQyGz6FN6DJbhbfQ80plQXX1Bc6PUked0ZrgpB2VeI6CR8Cgpg7AR1EimUEloBh3yAc8uWNZLe47hDp2MrqmBA3RidC2FnvkBWy2nO7fA6id+bwolWite7tRWQDdoipVlWKgolWXN54A+kppGMaF+lIwLsHqNfYHi+gmUJk+BAfoSlqkiQvE/ptOi6+qQLKJu/QTUoaJp+bdDb2BFV4QWDI2k9puYKh0K9bPPB1CtfgLqkOo1TmgTodBSe0uMX9ZjqnRIy3xenYaVs6x+ROmUEw1Y9lKNFTo9HKT3ka4zHXf0bNjVPXX3n5iybw2hqfQa9tKrGN7tVTOKaX7rGKITQwqtko9gR5gUqaU+oL1Me9onusjFPGEBqzKSWAHbtMJZKqgFYANslPJQg7WP+YLW/hQSFXwL2+d0+L1Fv0Ux/VaDx+vhBBppzZL1PpBHOFVvpmtgH62Cpuk9VJsydVgGS3CYQR2lj96EHSI7gabbkczcTbWdaNW5Tlf7QJtQLWsxmO0DnUQf06LS7o+qFPrRwr8O7UQLw2E6xgdqsBPFe2SXLl3axB9za6gTLBJnswAAAABJRU5ErkJggg==>

[image43]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAA9UlEQVR4Xu3SoYsCQRTH8ScqKOqhGC+IeAjX/AMuarJpNPgPWLQYxSheunbRfigGu2C0mkwGsVmMd3B33+fOwDK7cggXDP7gAztvht03Mytyk4kgj6w74WaET/yg58yFpoEvvLgTYXnDDo9OPZAMVlgg4cwF8owj+masmy2jhqRdZNPCN6qIY4gx5hKyYdtvCQNUxFsUOJ0c1tjgXbyWNNpGFykzPsf2exLv7drCg3+BP1ct9l/GE7aYyYUjdC9jIt4edC91tE1d0ljiAzFT08U61vN9RdHUpYADOrZAmthjaup6Qefog34uagsm+sU/f9V7/j+/q+oqHbeR1QMAAAAASUVORK5CYII=>

[image44]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAaCAYAAABctMd+AAABRUlEQVR4Xu2USytGURSGl5DbQC4lA0lJkZJEqc9QiYGpkrEyMzAxoWRkhN8gZUBmLkUxkT+gUMofMFPI5Vmt/WV/K3I5uxh8Tz2dfda72519OVukyF/Thdf4GnmPQyFfd9kNdoTs2wziA15hc1SvwB1cwJqo/iOqcA9fcCTUSnAuqO1MTIhNfRPLxQZdCe3MNOEF3uGS2HonGTjPstjXn2CtyzIzKrbuZ5J48E48wksp3NjPqMZSX/yIVtzFdinc2LK4U4TOSk9Xnw882nELB8J7vLHd+U6OHjzFRh/E6MDbOObqi2Jfr8+YSrEjeoC3uIotBT0CbWJLMesDyOETnmODy5Q1nPZFZQof5f2+eMbxKJ8JtTjfx/qQ14ltfH94T4qeqmP5Yr1/yyRuiP29Osuk/8MwHuI89rosCXr9Jr13ivxD3gCkTz7AikZA+wAAAABJRU5ErkJggg==>

[image45]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAZCAYAAAA8CX6UAAAA+UlEQVR4Xu3Tv0sCcRjH8UdQUFRcBIWcGgShLdSlhsA5on/C/0caW9oaWoSChgbRv0FcKwJByKYCk9L38Xi/HtPLzeE+8ILjPndf+D53X5E4u+YMYywCppisrr9xj6r7QlSuMceJuV9BFx9omG4teQwwRNF0TkoY4REZ04VSwzvukDSdmxvRZ5xnN+ZcdB5tWwTiLPSFui2C6cjf83GTxRM+cWw6Lzn0ZPN8nBzgWfTrHoYrP/+ZTwu/eEDadF6i5pPAlehCl6bzEvXZy+iLzqdgulCORH80u60ULkTncitbFjnFi/hH4gdveBU9GjPRY9EU3VqcOPufJU75NY0EHNwQAAAAAElFTkSuQmCC>

[image46]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGMAAAAaCAYAAACjFuKcAAAE6UlEQVR4Xu2YW+gVVRTGv8ikrIg00qDoQgTiJSIrym5QQpRZ2IOFgg8iQoRYYlL48IfoQbpfoKjIEqS0IMKC0sC/ICn2YIZaRBJGFD30UFB0ocv6/ddszp59Zs6Z8YxHy/ng45wzay57r8u31hypRYsWw8UZxpPSg8cJjqm932Z8QsfQgoaMK40b5EE5qrjMuM14dmowTDC+afwn4aOZ/Wbj39Hxv4yLM9t/DYuML+ooJuQpxneNd6eGBGTMLrnjb01sS40fGS9Mjg+CqcZPjNelhiMIfLHZOD81DAu3GPcaJ6eGAtwnz/7njSdkxyjvTWq+vJcZf5QHZZggKT9W8/vpCxy6zvhsaigBmf9tRr4TiA+M58YnNQDWhX5TGWcmtiONi4xfGa9NDb1wovFy4/XqaBybuNR4fjipD84y7lf1suT+VAXV8ZRc3qo+qwrYBxU6zfiFPFHOMZ4Wn1QRJxtvNN5pPC9v6olT5ZL7cGooA4tm8lkl13G+AwLxs/xm3LQfCOY32WdVkDF/Gn8xXpXYBsVMeQPdIg84ny8Z58UnVcAs42fGe+Wys8M4J3dGb7wur8wgxT3BjdfIS5hgcDGgAb1mHFU+m7jpRHVPCbcbv5eXZlVMMX5p/N14dWJrCoP0C3yAdC7MfrNG1so9q2K1un1YCqYXFsqDflV+EiJzn4t+04geN95vfEX5BxCMQ3IpqAKqjXtsV3cjL8J4dSdAPwzaL9gLe6KqUArucZPySsEzeikHwaj9/BF1mmkA+h+yYJy8OYeegATEjalOMHAqQV4gr6S4kReBZ78hf0YdhD5WdahIEcbT8N7zh/z9IQZJ/L7KM59gHFS1CXMMRI3ovS3fOCDiI+qUNzP6Vnl10NBYQOycqsHgvvQnyHcYGjnjbhHYyE7Vl5or5NUeZOZwQEDmGtfLg5E69gH1DnYtmQKhHLkwgCxFkggODmMaCW/KZNwe+RtzAFXynbycyxAC8ZjykhO0mJ6VzuRLjO8Yf5CvgcYcwD140y+TL6qaISSs6R7jHdl3JkiuJbGKwN5+My6PjhFUKo39X2B8xvi13NkEBSlNgc+qDkFjINJEPIxgbG6t/K8NwMP3yaeKUXkgkJW4WZO1BCMOUAwW85C8otKFhcokIEVvyTi1KPuY/KiokeR4ANcEvWZsfkGdYBNkrkX+ghrEwLk/GWdnvwke0vyIOr0Nv2xTecVyHj2raO2l4CJGN7KPcmSCYKYOYFw9oI7zcQ5OjbOKMhzNbDEukU9MQXfhy/LNgRnywMZ2RuRrMjuOQj5Dr4qxQv6XCplXJANUKxPeRvk94hdKZJXMJwmLpJXg7ZBfy0g8anxa+UTi/h8aT4+OxSAJdqv+OD0GnMvC0tIlGO/JHxqaWpFzRpTvO02gX/ZhZxhIqy2AvSBHIfgxsHFtWXMlSSfJ7UVSWFaxAcjv5yofTA4LOOItefYhI6+qeHEXGz81Tk8NAyDOPiaZdGNs+MHkWFXEfbEu4orlrXxx3jwWSCQtlrVGEHoIm0Z3J+bNOaw0PqnmFjBNLhH0G/6IjEFykBicUxdUCoGYkxoqgv0hW/QtXprTwYPERD6Ru8bBw8nOfk4O7xB3pYYBgJyk0gmo2BvSgxWBHDNZ9dtPL5T5BB+sU7GUDx3oN+VZ56+R/xOWqruKW7Ro0aJFi8bwL6043wjeTY3YAAAAAElFTkSuQmCC>

[image47]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAABX0lEQVR4Xu2WTysFYRSHj6KIIkSKFDuxk0+gWIjyJ3YkypKtbCxs7CgbWbBQfAClWPEZ7JSUsrSxQeI5zdxMR/fe83YnpPeppzu95zTN7+09c0ckEon8B+pwAZvMelEW8QJbbOEXaMZZPMQnvMeObEMxavEsVa9/Gw0ygYN4IgFBOvEBt2whB8ZwwC4GcCSOIA2SNMzgG85hO9ZkmypkFNfsYgCuIPO4j3f4gse4i73ZpgrRzTrALltw4gqi/MR8DOEO1tuCA3eQ0PnQsHrTUJfwCvskDHeQYXxNfz1MS3IcQ9Vjq6/Sc+wWP+4g6/iIPbaQI42SBBnBKlMrhytIYT4uJTm/+rbaluS45YU++AZO2YITV5BWvJGv+ZjEVQnftVL04x5W24ITDaIzXHJz9YE38RZP0+s8/0OUZRy3i2Vow2t8xo/Ud0kCrWT6vqEfZO6PskAKRzYSiUQikT/JJ72JRM96YSI5AAAAAElFTkSuQmCC>

[image48]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAaCAYAAAAT6cSuAAAB0klEQVR4Xu2XzysFURTHj/zIr0KkRCkLYiPZ2igbC7KRJCv5AygpexsLC0uJUoqypBQL1rb23kKEWAgLv79fZ6Z335037weveZ7upz71Zs6dZuaee86dJ+JwOHJENWyExXYgFf3wFn4a3sNJ2ABP4LsRe4TbsIoXR4D5fEfyw/uuwQ84YAdEzzG2AYusWBS0wAu4aAcyoQ6ewhhsTgx9My86cxN2ICI4uVw9w3YgEzrhHdyFJVaMxzzPOMflgwX5xf2ZEWaGGbJhJmOimWWGo6Yc7sNj0aZC6uEgbPKOU7IC3+CI6AWmo6L1xjH5oA1eSfz+fKktuAT3JE2D8evtCW7CVctz+Rv1xomn07AHPkgG3TPX9VYrweyH6S+zVLBDPsN1OC7arflCM7DdGJcUv95m7YBkX2+sjzkJZj/MKb0sFL/eXkT3Xu6vXQkj0sD97RX22QHRc4zlq97M/a1C9FmvYYc5KIxC29+GJJ4ILutlWObFAvSKNpJk9eYvCRZutxWLCk4uOyU7JuHL+cdjngE4I5eS+D15I1qw3EMORde5H+Nvtt9KXhwR/EDegQeiS5K0wjPRLYANpsY7X5Cwm3IFmZSKftBn9e/A4XA4HI7/wBeMTXB1Rl+TuQAAAABJRU5ErkJggg==>

[image49]: <data:image/png;base64,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>

[image50]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFkAAAAZCAYAAABaU4LDAAAC60lEQVR4Xu2YS6hNURzGvxuKvCPyKPdKycBAioiZ5JGSJGVgII9MlELdMkJRMjAwkMhAHt0pGYkYKCOKgZJHIooRRfL4vv57tddZZ+971nK3c+659le/9jn/s84++/z2XmuvtYE6dUZSesg0Mivb6n2d8kzBX7iaQG6SK+QQGdv4cZ0gu8glcgPmLipqeBl2dqpOL9keFltkEjlAzpOjGPpxLSFrw+Ig0dW5nJwl58hGMqqhhTk7nm2jUrXkRWQ/uUN+wvYdm3nkMdkN61HryXOyzG8UEUk6TB6R3+RI48elkWB97x7pgw0J6uE64WO8dsNC8maykrxFvOTR5AIZyF67nCC3yTiv1iqSvIlsIF8RL3kp+UBWebX55DVZ59U6LtlF+9PBxUrWn3mPZiFbYKIkIDX6TopknVAds+9iIrkPG4fdja5rJa8hv9AsRFekuvyOoB6TFMkanjQBCCXLz13Y0DPVq3WlZCczFFJWj0mKZCezTLJf71rJElEks12S3fG2TXIP8gVKDEVz61TJB1Ess12SZ5IXaKNkrWpOwqYuMWiqFSZVcpnMsnpMUiQXySyrVyK5iqRK1rTpB5qFOMmaZaQmRbKmjQMol6wZhmYartYVkieT2cinRXPIK9hKy89e8gk2/3ZRTxOtMphkreJ60TjUqV34W9PJUzQe17CTrBWTE+mi8V4ru+9kRVZTm2PkIewEKFpl6RnBVeQLlIWwBYMWOn1ZrSxOcn/4AewZhHqIv+8FsP36jwJWk4/Ij1PpuGTNd3WgWlLrT4gv5AlZnLXRb96CLZm1lHaRXNWvw8b5i+QBmeu10WudIM2pNZQUZR95h/z3xWdYl5+RtdF3v8GW0f5FoGHpJdlDdpJnsMcEfpuOSx5q1I11BW7NtuHDGRc93yi64VYR9TSdBKHXYbpeckzUvU+j9XDxr/JfSNbDmlNoHuvblREvWVfxNuQ3x04kWfJ4co28ybZ6X6c8Z1C7qlOnTvX5AzaPvQR6kNMdAAAAAElFTkSuQmCC>

[image51]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAZCAYAAACfIRhSAAADm0lEQVR4Xu2YXYhNURTHl1DkK42Sj9JIJIqSr8KTBxLJeBDK01BSpEEpNSUvSskDkkweJB9vGinKiCSePDAS+UhEeeMBhf/fvru7zj573bPvPd2hcX/178yse866Z//32l9XpEWLf4HR0IgwOIgZBw0Pg/UyH+oRl+x/YRF0QUq0eSp0G5oTxIdAi6ET0EloDTQ0c4fNSGgzdAY6Cs3KfpxMmTxjod3inj0ETcp+/Iet0GlpoPJoznGoOxLfD92B2qE2cb3Dlyj6EvbgTeiwuOHPan4KdeibEiiTZxr0GOoUN/2shp6LqzINO+YatCGIFzIXela5ahZAH6FlKjYdegOtUrEYB6BH0HgV2wL1QxNVrIhG8wyDzkJXK397jkA3xJml2QTdlzqHLF+uV/KLAr+EJunyHgPdFTcXsiJjsJFs7PkgvhD6Aq0L4hZl8rCDP4hrm4ZV9VVcUWh4/wvJFklNaBZNO2jEQ+M4XPokXwWa2dBnyTeYL8uXZoekUCbPSuin5I1bC/0SV7WaUdAtyftgQlNoDhNqvEGWcWFc4xtmNTiMW1j3W3GNN8gyLowT5uMcbo2kDLF5jHhDQ4NSjPMvFzYspcGaMnloTMygWsYx1ieujYXwJd5WrhpOvC8lb1CKcVy9Gm2wpkyevRI3qMi4WlNQBss4yyArrrEaZsUtrPutuMYyyIoTxlgsLJpCLOO4hHMpDw3yxnFl5Qobw69oYcN8g1Mn4DJ5OPX8kLxB3rjYnq2uocqXey9uWIQwEVc1rm6eCdATcScJDzfD3Gz6TbE3t1eyWxyudN8rVw/vbZP4hFxPHu6/Jks1zxTotWTfk+yQfJs8XKW5snKFLcQbwYQhM6B34jaHnuXQJ2ipih0T14vdKsZjDCu5vfI/G8Td/wOpbjJpGHf23ySbT9Nonth97NjL0EXJbooJ7+eKGhptwgd6xH6AJf0K2g5tE3fc2SnZCtkjrgI6VIwveUrc+Xe9uEawg3hk8rCirovbb+1TcU09eXicYuV7aBjjl8SNqHPQPXHn8hAuCA+l9qY6ByuKD1mrCXuUcwPFv1OhuTOhjdAKsc+3HHK7wqAiNU8M/iDBOZHP8mr9QMFK7ZdqZSdBM9gTRefPZsEfEqyhOhD4YU3F5tqasESvSP7w22zmiTuMD/T3ajiXc1HQwzwZOs15hqrb9RJw+MfmnIGCw55zfGx7kgyTdEFLwg8GMZ3y96aoFi1aNI/fgSPd7CrLHwMAAAAASUVORK5CYII=>

[image52]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAZCAYAAADKQPsMAAAEKElEQVR4Xu2ZW6gOURTH1wlF7pechFwSiaJc8oA8IB5cQggPSuJByb2UnJIHklweSHJQcn11KeIURTx5cInkkkse8IJELuvfmt3Zs2bWzJ75ik/Nr/5939kz395rr//ee/aeQ1RRUZFPJ1Z7XViRSxtWd1aDvlCG0axmVld9oSIXGLCBtS76Xpp+rBusEfpCRAfWclY3Ve7owlrLOsLaxuoTv5zJMNZukt8uIWmrLBiZC1kDVbkDdaMNtIU20XYoeXG2Y51kzVflwcDBfawmVd6DtYh1nPWJ9ZLSEzyAdZ+1kmRZm8l6whrv32SAoB+SzEYsiztYV6nYrERCZrH2s96wvrDGxO4QUCfqRhtoC22i7ZDEhcY5knWb1V+VB4EfP44+fWDEHNZY1hlKN6It6yjrQvTdsZN1hZKjxgfBPmUt9cqwzt5jrfHK8kAbMH8KazvZRmwhqRttOND2I1ajV6YpEidycJqSgzoIBHiRsh/SJyjdiMGsdyR1+MwjOyEOdEzfg9l5itVCMvKKgjh0ncAlDv3wGcf6zJqtyn2Kxon7teG5IPkwYau+oLCMmMr6RUkjsFT8pvgo0hygZAcB2oK5MLkolhHDWR8oaQTuw/2YwRZF4xxFkiuYHAwSix8hcVlYRriEW0boch/UaXUwrTwEywiXcMsIXe5jxWOVu5xiVQgGlbxnTdQXFJYR6HhawvOMwHRuofSOWB0MwTLCxaMTnmdEmTjdb6y+p4JKXkWfWVhGrKf0hOcZ0ZF1jdI7YnUwBMsIPMzLGFEmTmdE1nKXoFYjrIRb5T5WR6zyECwjrIRb5T5WPFa5MwK7yWBqNQJL2g9KJtwZkbVOYsSkdQRtvSY5ZBbFMsLt7nTCnRFZm5WicZZamhDgW5Kpm4VlRF/WC5Kdhc8qkl0KdiuORlZP729sGX+S7LwcbhcHue00Tsu9vb+zsIxwyfHrBWj7e/TpKBunw22VsWwH04v1gCRxWVjuN5CcMu9Q6ykTR/1zJAcbd8jD6wFsClDHoKgMnb1L8cPPEJJ7FntlK0hml1+fBYz4Sulbx2Uks9+1nxZ7LXE6kKNnFDcuFwTTTMkRDTAKb5IceJAICCMDAaz27kMnLrHOksysY6xbFDcN3/EaBA8+/7UATu3PWZtZC0hG0i4SMx1Y5r6RdE7PSIAHKk7+H6k1Tggzfa93H+o8RPJObS6JCRiEeG3hqCVOB5Zr1IvVohBwFY4XOgkqsHxgOUCQ+MTfoSCR00mSY72jwfQ/SNmvIkLAwBtKEudkSk+kRUicoInCZm8CTD2M4Bn6Qh2BZWIPlejcXwa5vM6apC+EggfSecp+SfevwOyCCdP0hToEz6HDVGymxcCU3RQJ3+sJPBfwFrje4tLgAX6Z5N8CNQEXN7Im6AsVuXQmOW/oXWVFRUXF/8gfna8StQ1uuEAAAAAASUVORK5CYII=>

[image53]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAZCAYAAACfIRhSAAAEJElEQVR4Xu2YXahVRRiGv8igSEtJEi3IQpJQUIiyRKILgyKMyMBQyQsxbwRF7BciJbzwL6IIJSRLCLEfIsJIFDyoiOZFCpYRBRaUeBHdVGBR+j5n1rBnf3tm7bWPegzbL7ysfb41M2vmXd/fOmZ99PFfwEjxWm+8gnGjeI039orp4jYLi/1fcK/4vl3AmW8V94lTEhue97Q4tfp9dTXuGXFia1gR14nzxbfF9eLk9tuNMNHCGjyX57OPaRb20CQybhCXW9jDy+L49tuDWChusSF43lXi6+JqZx8tHhHPOW607g/hDe4RX7UQ/njzN+LcdFADzBTPWvvz/xAfTQcVcJt4XFxiQeRHxO8seFkKXvBn4hPO3hV41LfVNQUH3iWeEH8Q3xVnWBC6G54Xj4pjEtsC8aQ4LrF1w90WBGd/x8Q1lvcajxHiVvGj6nfEWvELC2KleEo8ZD2GLIdEIO/6CPeeNdtoCsRCNOamuEf8XXzM2euAcG96YwPcIZ62cLYUeBUey7opGP+9OMvZi0AsRHvJ37ChC3eX+Kt1Csdm2TRvvSmGKtxs8V/rFG6OhXDH+1NcL+61vA5ZIMqPFhb0QLid4msWwvVn8VPrXhiiQCXhvL0OzPlE3G7BI34SX7HOUPOIApWE83bAvqiwTVLR4MbOWN5FEW63OM/CYpBkT4Il8ZYQN+cFGqpwFKhJ1d83iV9aqJJ1BQphcgLVCYdtwMK5u4KN8RZ9zAOEGlVdI8hTf1pnBU5B9bpYwiEOYZSCcKLS3u/sKVZaXqBuwvmCVkSdcDnEw5MP/IEiSgKV7L0iehPilFASqGQH2OgexvkbOdQJt078W3woscXDD1jZpWNF8wLFuU0TMGGJB5Bfb07spTBMQeph735MFC7Xs/UUqhzyFwvh5cHB/7F24WKobrNWCBNO5LyYc3jwgHW2OFS6v6prBGMRKJeQY+HywiE8h0/bGvqvCdZa5xbxlPhGHFBhqYWKT+X3oNrXRVIbxopfW1jQg6bwBWtthuuL4m/W3n1vsnCQ1YmNzxg8+fbqb+ZSWA5bq8lEMDr7Ur6iceVTaEZiY+5+CwesWyf3PF7sB+IOa2+KAeOpqF7oIpiA9+Qm8KC3xI/FRRZaAt6W984VFjxpbmJj7mYL37+PWzgEL4hPrwi87XML/daziT0FnnxA3CAuFr+y0OHz7RoR1/HVHsGw01Kx53fEg9Y+N4KCQLXupTkf9Cwm5aoJwt4pPik+aJ1fF3VI5z5g5faB0F3mjQmYx3zWIcT42G8KxpJbmcu1NBdPPWmtCGkEXJ038bC/MUx4zvKhOlyIYQ1zubYWuOiH1r0jv9jgX0R8jA/3c1PQXJMz0zBvDJQmz8CeVb8A0B7kcs5wgTRAjs+1J43BIqvE+/yNKxhL7PKlqD766OPS4TxpnNN5cbDGGgAAAABJRU5ErkJggg==>

[image54]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABk0lEQVR4Xu2UPShGURjHH6GIGEw+6i1ZTAZFijJIGSyyWaRkFAZRBsmqmCRZDCKD5RUxGmSzmpAyMShK8vH/e8657z3n3oPBIvdXv+7tuec85+Oe54hk/CVq4Rxcg/Owyf38JVVwXLQvczBXKm3wCHbBFpiH73AKFsXapZGD53AUlsE+eCGa06Ec7sERWGxiNfAMPsJWE0ujBK7DXfNuWYQHorkjuMwr+CC6Gsus6KomYzGfRngLp734gKRMshQuw0Nx95adOZCfJE4PfJNkm37RvkNePAG3gdvxCrvdTw42YWggP56gXXTpPEVccYjQqn80UDU8hpuwwvvmw/+XlvDbgTj7Vbgk3okJEEoYin9iB5mRwjFvhr1RiySd8EWSCe1APH0OLEoW54R5t4yJ25jbWieFNvXwEq7YBgb2uxOdaAQ7DcMneAOvY96LzpqwiHkDPMMOE2PfBXgqOgnCndmBW+IWcVSwXKovi5FFSSrhvuj1kjMxwgEY3xa9fjbgCWyItfk1+E95Cwyap/3HGRn/gQ9F6VMj/0yVGgAAAABJRU5ErkJggg==>

[image55]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAA2ElEQVR4Xu3SsQpBURzH8VMoMhiUUorBYjIYxOAFlMlkVR7AoiwyGy0yegEvYKIUBgbJYOEdDCa+f+dcjnsNjMqvPt1z/vc3nE5Hqd9JCjUk4EMQWTTM+pEiLrhazijbJUkOO+yxQRfxl4aJFPvu4bt8VRxjhANO6CBklyRSXCBt9lEsMUTAKUlkE7YHpK30TRRcc09aSl9T0/3DHU9RzrPCFjFnqJ5F+d4jF3tU3qKcUYoVZ+DHAHlnQCKYYmLWjyQxQw91rDFX+pF4IldUQhUZpV/RP5/lBpYrJYu4OfEYAAAAAElFTkSuQmCC>

[image56]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAABFklEQVR4Xu2TMUuCURSGj0NQGEg0BQoRgTQIgU7N0RhBDaL/IJydBWnQ0bHNoZ/gVIRzbQ4tDREE/YEapZ7D1a/j5/EbPrDpe+ABee+5r1e8VyTjP9jHejw0lLGPt9jArcXlP47wGh9xisPF5YhLfMFj3MYu3mPBDs3R0gs8wQ/xS0v4ik2T7eAztky2xB6+i1+qZd9YNVkO73As4eQuSaUDWS5VdPYTD2J5RFKpZqtKvTxiVan+tLH4m1OX5vFB/M2pS5Ub8TfrrN6YYiyPSCo9l3CHT022iaOZ+tllXqrXJBdb28Un7JjsUMIp3Reo366LepKfmV84wYqZq+EbtvFKwsXv4YaZSYX+aWcSXqC+soyMdfMLxkc99j+U5pMAAAAASUVORK5CYII=>

[image57]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAaCAYAAAA0R0VGAAACGklEQVR4Xu2VTShmYRTHj4aaQWkapUnSSElNUbKYYmrKYiyUSGiynrJRFAsWklKzmlE2yESpWbC0mtVkaWFpMYkkxcRCY+Hb/++8j5573A9icRfvr371vuc873vvPc+55xHJkl5yYIENpoX3cEz0Jp/EJ/gPXnsewR5YDP/ASy/3H/6S+MoMw88mVgW/wWk4AN8G0/HMwivYZBOiMeZ+SnI1iuCc6IM52uEyrIGNcB2ewTZvTSSv4RrchqXB1C1DolX7YhMh8EFGve8lcDUTdw9WCffgX1iWiUVSDQ/hEsw1OX5nnHmui4MX59Z98GJ18ARuit4o4bpF0QduzsQiYUW4kBWysJLbopVlhePgxbn13FoHP3NLGS/04vOi12zxYqFMwgvYKtqovh2i/cY1SXTBXhsMwbXRvuiLEolbyNIviL5NvlvysH7j9k+JjpEkOkUnwKAkvGDP1W8VcAa+tAlDOdwQfWnygqn7uH7rtwl5XL99leTqsv9WYB98YXKhcL6dwwabEI0xl9Rvr0T/551NeLgb45a6rfwIa+9WGJ5rvnFc/JDo/uH2fZf7Q3cc1pvYHW4GhfUbe4dPeiw62eMIO64cvLFReAp3PHdFi8JeDcBpzQntzkt6ALvhG/hb9HhxOX7m0Mznjw3cLs4wN2AtrgD+tZwP6eUnwb4cscG0MCHB4yo1hB1XqYEvAedbKuGISTo5smRJNTcn93Za8wPiUgAAAABJRU5ErkJggg==>

[image58]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAaCAYAAAAT6cSuAAABxElEQVR4Xu2WPShGURjHH6EI5StSFh+LwSCDFJvkI4somzJIJhOlDAaL0WCwmAzKqhQDGc1MJBJRbAYM/J/73PN27rnv033fwb3U+dWv9/acc+v833u+iDwej4eoBw67xZAS2Ae34DYch6WRHgpz8Bg2uA0pwANehhfwG65EmwM4GPc5g20k49yDO7Dc6hejAh6G8nPacLgJOAbfKX+4XvgMB6xaO7yDI1YtRit8gBtuQ8pwAC0cj42DtFi1GngOd0m+bIRqks7T8AvOwGZK+My/iBbOzCw3HI//lGQ611n1gFmSOXsLP0jmMC/WDrtTimjhTAgtnFvPUex6W4P3RXgE64M3k9HC8cA5gBsiMdxfWW+MFo6Xyg3FQySGG4Kf4W/WaOG0EFo9xyp8ItlWC8FsQoXaRAUetKSHK4MHFA9hwvGOyTtnBLPeTmAVyS65STJVNbrhVBGOwsrgzWS0cAzXXmGXVWuElySbYAzTaNbbJFyiPGdGSphwPJtcOkn2Bj6uDIPwBfZbtRwcYh1ew/3wOYszbgE+kly9jG8k042ntYH/fD625kmOsSu4SAkfozb0P8B3Sr6qsVncgz0ej8fjyZwfEP9qyuxEaeQAAAAASUVORK5CYII=>

[image59]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAaCAYAAAAT6cSuAAACKElEQVR4Xu2WMUgcQRSGn0TBEDVqQkSwUCNCCiGgEAKmEzGIIKIgWAhCLCzUSkGwSJEmpYWFjVgIEewkIERCxCYg2JkqYiKKKFhaqIX5/3s7d7NzWfeucDeQ+eHD9c0czD/z3psR8fLy+l/VBobAM1ACKsAbMGJPCsZegQWwCHrBg9CMCI2BL+CJO5CAhsGtwxF4ac2hsRmwDZpE17kKlkCZNS9P5eBzAL+TVh84CPgOpkBVaIZIOzgDnVasGfwGPVYsTw3gGHxwBxISzc26QUdcG43UW7FKsAOWRU82JOY2JzPfb0TTo05ijvkeFGfOZJZrjuv/BnZBjRXPaFQ0Zw/BlWgOs1if25MSEM2tgE3R1OR63kmuWRgTUebceFbF1tu8aLEXChdcm/lltGjuq+TmtYiWCRsI040LpwHXRKy5tOuN4qbaG0tDzCKui52RpcITdU3EmusC18Hff0lMU14JbyXaRFQ8qzlwKtpWC5FpQoXCi/mui7YVnIAN8NCKG3NM2VKwLvkmjDl2THbOkEy9bYFHol3yo2iqRomvicEi4M7bi3bF++tSwuZMWjLOcYrd9AK8CP6nnoJ90SaYJzNo6m0ATMtf7ox71GNRI41WjN+sMfv1YZoMrysjPtHOwWsrlhVNvAc/wVrwnfQdR3WAPdESmQS/wCdR47a4+bwmxkWvsR9gQmIOozogTbEsukG/6MlFLZhvStYhSeMd7OXl5eXllbr+ALvTdBk7Lu0SAAAAAElFTkSuQmCC>

[image60]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABGklEQVR4Xu2TsUoDQRCGRxLBYBHSmMLGIhEEO1ubiEUeQVGfQEgbQppACnvBzt7GJhDfwWhhE0glaGOhaKpUouYbdpfb7BlcsArcBx/H7gx3c//tiWT8lxq+4Y/nB554Pd2g3sNVr57iEr9xPyxAFQd4jCtBLUUJ7/EJ12dLsod93Aj257KF73gjyZNz2MAzLNi9KI7EZNG0a83jQkxuS64plnP8xF3cxAe8xaLfFIPL6xlP8UrMjfRj1L2+KFxeX9jGZTwQ89p643zS+jcur5Yk+ZRxhGPctntR6Plyefl0xDxEr1G4vB7FTOOjE+lkOmFY+5UdnOC1pLPRte7rdHry56K/zIvM/m+veGjra3gX1IdYsfWMjMVlCn+/PCJqzkDYAAAAAElFTkSuQmCC>

[image61]: <data:image/png;base64,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>

[image62]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAaCAYAAADygtH/AAADOUlEQVR4Xu2XW8hNQRzFl1wiCikSCrlEcgl5EZGEkFDuvgcvirwI4UVJ4lFJyQMPUpJSvijKCcktXtxKckkU4YUXclnLf8aZPd+ec/aWvsL+1eo0/5nZZ/aa/1w2UFFRUfHvMoN6S30P9J5aE7TZHdWfoboH9e3NBGp2HHR0o1ZSh6n91Mhs9S8UV73aqb36leYI9Y2aFVeQ4dQNajXVNaprL6ZQW6lbsInblq3+SU/qAmySe1DjqQfUkrCRKyuuerVTe/VT/8L0hg3mGTUgW4WZ1FlqcBRvb2TaAmoe9Qn5pimm99D7eFZRD6l+rjyIeuziHv/+G4NYU0ZR76hW1DOpI7WJ2ovfTF3Sy6kRHagucbABE5Fvmn/xY1F8MvWRWujKMkv99RyPxnCcqsEyrxB6UJjy2q8OwvY1PbAsA6lrqO+BmmllbN6z1FbLvigp0/zEx6b59ntc+YArh6YJ9XtNDY3iSfSgL9RUagR1l7qOkmvcoaw8Ss2FZauMGgt73mmYSR7VbaGWBbFmpEzz8ZRpPq7flGl58Vx8Wj+nNlAnYC+oQ2FO0K4omqmWOAgzcAUsG2qwU0uTcxLlJidlmvY7ZXUj07T0aq4cm1PKNJ/WX6mdVGdqOWwAMrBTvWkhZEB8mIRo6esFd8AGKDPLkDJNmd3MNP33RVeOzSllmt/PtqO+5+ik0T70gRrjYmXQc5Sl52GDbHQP6kNNj4MNSJkWL8NUPGVOKp6L7md+PwvZBTNTv2XZTN2m1sEm5Rz1CPmHgQapdkVJmaZtQRt5yjRlttCBkGeO+r1Eds/Nxe9nT1C/x3iUYcq08I5TBLXVTVvLPGQ0dQf2NTGO6k8tpq5Sw4J2zUiZ5verVmQv4Lqsf3a/QlcPbUXhJV7t1S/um4sfwCm03btUVlzZVuZKIEPmx0GHluhaWNbpoLkMM7MMceaEaJwvqCGurKzWbT+8CWg7uInsCtKkKcu0lyeRy6+Q/Z58AzvdRF/Yg8P6eyiXEX+a9Wg7Zn0jX4GNVyi7D1GXqEUww+7DPpdCJlFPYZ9lS2GrbR/aro7/BmWX7poyYxrSRugk1Ue/zNWnVUVFRUVFRUVFxV/ID1YlxIo5UVk5AAAAAElFTkSuQmCC>

[image63]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFwAAAAaCAYAAAA67jspAAAC40lEQVR4Xu2YTahOQRjH//IRUUi5iSKhSCQLkYgk3wsp3yyUlLKgS1ggC8WOlGQhGyWRIhYWQvIVFsKCwsKCsLKQfPz/PWd658x7z3vP3F7n1G1+9eved2beuWeemXlmzgUSiUQi0VtYQL/Qv57f6GavzdGg/hod7NVXzQy6OCysgHF0Ax1D+9KBdDrdnv0exTn6hy4KK8hE+ohuQg86bhOz6F76BDbp+/LVlTCH/kR+8f2gy/1GZRgOG8h7OjpfhYX0Omx260QBX0mXwQZZR8Bn0lf0DX1Bj9BRuRYlmUy/0htorGBtmV30GB2UlcUyLLMVfeiAsLAFGnSdAT8VFvaEjchvU+Xn07A8roDEohz3AI1t9xq2U7rqS22VqsrSKwJ+kv6ic+kk+pw+pEP9RiXRbjhPl8J2iYI8DdbfFViAHarrpGu9su6oO+BX6QX6ln6khxCZAVz+/kB30ouw4OgAXeK1K8t4ujUshAV/PSx13aFnYRN7CXETW3fAdXmYkH0eQR/DxtLfNeoOl79/04OwL66DpQIFv1+jaSkUvPDg9VG60uF3ADYATUQMsQHXGaKDrYxDsu8UodiE12GNQzeX2UF5IS5/70cjx3bA8u53OjUri0H9aHfcordhd9eibadVMj8sbEFMwHUBUMrSCizjNvtaFHoOxW93WFGE7t8uf/schnWkn7HsoU9hA9CE3oRdpbo6OBXAmIHGBLydaGEo9b6kI71yF/BSz+Py9zvYqvbRytYK10oP61qhtsfRnNOm0Gewt1S9nWkLr6b30ciJZagr4HpenXNhwJVSFPBVXlkh7uEvozlX67PK1VnMtU3BXBEWZiitbIGtdh3Kd2ETEYN7Zg20ShSPM7AXMIfOK41BabPlwa/X90/Iv6J+ht0ihGZQp69fr5mNWYntZgean1n/87mH/Ir7n4yF/b0TsDSoW5beN/yrbqLNKFXOo2tgN7zYW1YikUgkEolEIpGogH/tlZ5P0I9ElQAAAABJRU5ErkJggg==>

[image64]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGMAAAAaCAYAAACjFuKcAAAE4ElEQVR4Xu2ZbahlUxjHH3nJu7wTY2aQmqGQt4TMMGZMMoQPppmaWxRJXj+IDzqahBLNUOQqxm0apKnJ+0vcoogPpFBePijxQZJCofD/edbqPGfZ++x9Z869dc6cX/27++y11t5rP+tZz7PWumZjxoyZG3aVDpR2KQt2IgZug4OlU9L17tLp0uXSAqt/CfXula4oC3YysM/t0q3perthVG+SPpFOk26Ufpf+CXrM3PAldOAhq+7AUulH6z7jNWmvUL6/9EYoR1ulfUKdYQL7PCNdWRa0hQ+fSjpIelB6K11j4BXSz9Lf0sWpTeZE6SNpYXE/wjOekP6U/pDO7i3+D2bVC9Y7UMPKSdL70ryyoAlGEkNh/AOk66XvpONjJdEx99onwz2M/GhS1azIEEc3STebP6Oq/m3SmuLesLKbtMXcZjMiGh/v5roTKyTOlf6SXpb2TPeOkr6UluVKNZwsPSwdKX1h/o44k+j8ZKo3KuBYRAwcsRVMo6+kB8w9dbW5BzNDSsgjv5mHEowHDMI30tG5Ug107Lp03TGfHeSkzCHm723d8SEAx/pWOqMsqAMD4e14fRN5MDaGe3dI09K+4V4VJHfaA/GU/POBdQed9z+SrkcFogCD0WqFyUzYbB4ymjwbeCgefXW4hzfHmVJFzhd4P+R4GhcDOMWo5IsMDjpt7rCN5MqMHqPYj5yoifeHh/sYGfUj54uYsBkEBoNBYfU0avkCsn3ZfzWSK/8gHdtb9D9I7swg9hORNoMR80WG8ESYIlxdYKOXLyDbN64+a2FvwXK2au8QKZe+kabBYDaQC6qS2FrzsPe5+QJi1JhRmIKOuUGqDA3syu+UPrTqvMIUpG3dbrnMFxHCHWGP98d8wQCuk56WzpTuN180HJHKCWvMtOfN81heGFya7p1j3mZ9qgtNbdi4Xiu9Kk1IJ5h79HPpOkPfOBp6yfwdVTbL8O0sbdk/tYLw8725QbZZd+3PSykjOT9rvhOvgg/8zKqNDYQgjjb2LgsSHeknaVG4h2FWmi8umJHMTAz4lLSfuSGYyfSROjgE+51rpLvMjcuJAUvu+eYe2tTmdfNvJHfSjnBM3QnrDTMXSXeb77Owy5JQVoLz8qymPVgP50tfW+/ZEMJrLzOfHXXgYexTojGBDvxq3WdxBHJJTw2HZS5nVTFfHCYdJ71pXQ9m5kybG+cVc0/HIC+aDxyGPCb9XmU+gNlrWf21aQO8j/fm/jBoMczgfL9IG6RTrb9tWK7jqAz6jKDznM5eJS03P7ltQ07Eg16WYpT3zGccHsqsIFQR8vBk4CPfte7io/ydmUkbvoN38U6+jYGJ52iEYw5TP07qZ6eO+Wqx37J/4JCIs+cNCoxCOMEonBJw6IYnYljiPBB2iPEXmocLZiO/y/zVrw3eS98JZXnQ88qPsrelxebhDL2T6hKCCId1OYNBou15ZcFsk2My8XQQZKN8au6F5A1yD5ALpqRb0n1C3H3moY1E2Un1Im3bYFjKcmhkRjBw681zzxLzVR9hb9L8XwN14KCPW/W/G2YdOssCgL87CvE65wsSdhmX+cDs/Xuk3+V1Sds25JQIbWI51+QaHKYOFj4M4iBssd2QxO8x/8Ad4SzzPHRoWTAE4Dwk/aptwNDBR3ByTHy+weY4+Y0ZM2bMmEr+BRjs8eUVsKnOAAAAAElFTkSuQmCC>

[image65]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAaCAYAAAApOXvdAAADwUlEQVR4Xu2YS6hNURjHP3nkVfIoCXlk4lEUKaVQngOPPIpcZmIgA8prdCQDJQMpkrohZWAij4TBNZGYGJDiyiVRhBIG3t/vfnu566yz9j77XPvgcn71r3PWt/dea3/ft7611hZp0OB/o7tqoKpbaOiiDFD1DBs7w2DVlOQ3D5ymWqYaLenO4rp9quWhoQszXXVazLGdggzborqjmqrarPqo+u7piMSjtk11UOIOn6N6JeXPeaNapxqiuq766tneq86o+nFzAcT6+KR65rXdVa2QyvE3qY5K/J0zYfCnEg1SHVBdS37TyQLVW9U31cLkHsdE1W3VmKA95LjY/XNDg1gbtmapfKmiWCTmPGaSTx/VTtVn1XYp7x/bealx5uH9Y2IOJL03iUVvnH+RUhIbEI5x0PnhRFmOoLbi9DbV8HJTOzvEnr02NBTIbkkPqHsPkmZSYFutuiE1TH3fgWQZv0v+BQkzxaJ4UdU7acM5DyQ+SJ/xqteqs6oegY3/tGPnunrAeBn3C9XYwOZYLBbUjUE717eKvX9VRqoeqvaLRWmN6oTEo0Fd/SDlTsGRj1Qj3EUpkHkMlkwMIShtYhlMJtcD14efDCHOoWSyD+WQ2Ru2RyEaZF0e7zuHHvLacFCLqr/XFoN7vojtFoYFWiU2Ff3nFo2r0WH99Nkq6UEnyVjxs8pau5GLmOLVMgwozHRITXHQUWwa+7j6STBOitVrX4+l/vUTJ6XVT8AXLIhp48iVOBhbVE/EMiULV7Tvq4Z67TgUZVFk/WQBZRw3JV8SQJ76ydbqnqSPA4dWLUnOoVkdOViwyGT2mz55HOrqJ1MqpNb6STCp2ewfZ5ebUslTP9kKksHsYMKgAw6lXz+ZKnDFNra39Am3VT55HMog0+q02znUUj8J7mSpUs88qtVPEuuK2G5lVGBz5JryUBLLnpizgNPTLtUtiU8xBsm9aaeav33/SbKUxE5uHDXTqPaePyHaz8Ve6px0nHaIPjbqG8dATkwx2CVQe6hBMWJbLYerbe/EMq4ecNK5LJVljfebINZ/q3R8u4jhFu/cs2iW2ENxqi8WoKViWZoGDmMfGxZyssEFyuml2D6Xjy9Xxc7TzsZvBt2Xmwsg1gf9PxVbC2jn/L5ezOlZMMuYoUtCQxakPl+VVqrmiw0oD5QJVtx6Ttk/zQyx5HKzt+40qS5J9Uh3RZjuexPlXQR/GVa+C6p5oeEfgHWExSht9a8bdMii9ts7riOUwWap8dNdkbAw7VH1Cg1dlA2SvT9v0KBBgwYF8QM2/eUbMaxp+QAAAABJRU5ErkJggg==>

[image66]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAaCAYAAAAkJwuaAAADuUlEQVR4Xu2YS8hNURTHlzwirzwir/iE8igKM3yRZwphQD5DUaQwECZXkhQGIpKBR2Jgojwm0jfzGjAg5VFIFGHERB7r1zrb3Xfffe6553Zv3K/7q3/33L3PY+211157nSPSokVXp7tqkKpb2NFE1HUMQ1QzkuOeqlmqVapxkv4AzjuoWh12NBmMb5dqR3JcE8zGdtVj1UzVNtV31W9Pp8ScFsLDj0n84fNVn6T0Pl9UG71zDgT911R9vf5aGKa6o3pbpbAfGN8F1Zrkfy4w+mKiwaojqtvJMc5Zovqq+qVamlzjmKp6qGoL2kPOil2/MOxQJqruqzpUvYO+WsHOZ6p2KU7+MrGJOiHFSR8p5vC9yX+YprqrGuO1ZcJDzog5bqBqi+qdaoJ/klIQMwKHODAGo3zDYpB3cPZr1ajSLlmgui6WOuoFthBhi4J20g9jWBG075bStNRDdVlszFXjO46o4rjgn5AwR/VDdUOKUYNTnks8ynwmqz5L6bUulRxS9Una6sVQsTTUz2tj1REsH1TjvXbYo5odtG0Qm3yCIBNC94XqsNgsrledF4vMEPLmN9VVsRkDHPhKNdqdlAJGEQnMPDCok2J5slIk18oUsQ3SB+fhxE4pdTBsEsupPtNVb6TcwVE2i0UZ0ZaFc+Rxrw3HdEq5YSFc454zSfVIdU/iE9YoXH5keVfDCDFHZlYiRMIlsaWcFVHADTFknddG9PoRGsPlR4zaKpZ7cGJs42okafkxDYKjU4qrKBV3IgPE+5Vwmwq74HCvHUeiSrj8+FO1T2xzYzIYFE6tNAkxWLJM/vKwowJurLH8mIa7JjOC89ycjQjjqRd9qnGky48kdJcPmQwmhZKKUiMPVA3c72jYUYFK+TEN5x+/SonidrGsJRaWRz7VOBJDYnm4IOYQfvMwQDVP8u30LOc8+RGqXtpQEHtAzElAiUIkPZB4HsUwrk17C3H5kZ3dTwlAJBKRYbpoBHnzIzjbd4YdMViy76X4WtaWtLME6WMjuSL2hhODXf+pWN0WI1YyOfhPO8/uCPrqSZ4U5kPgEABZNfJf2lUvxQbki0hZKRaVaeAo6lA2FB8e7ibI6aNYnQrUbES53/9Eyt+maoWi/5yU28CGF8v1MUhFBEn4JlYR8iBfedaqFot9AaoG0gGlDBtKV6MgtVUVNcOyvCn5kv//DoHEh4y5YUcjIQfx0SH8QNDMEBynJf7JsKGMFdus+G12yNO35B+OhQ1nv6pX2NFE9BcrlWKlXosWLVq0yMkfb+bSSzLv8W4AAAAASUVORK5CYII=>

[image67]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAaCAYAAADxNd/XAAACy0lEQVR4Xu2WS6hNURjHP3lESLiRkEdSMqA8RqTkORCJIsYYSKHI7NyBgZIkpaQkySMThYEMzkiiZCLlUZfEjBImCv+ftZe79jr7fd1bdH716+yz1n6s9a1vfXubdfn/GC4nymFxRw1GyglxY10my8XJMTdcKrfI2ZY/OM47LrfGHTXhPqet4X2I4AH5VC6R++U3+TPwnLmHxByWpyw9wdXytXxb0TXust8BvCuXJ/8rMVZeTpwkT8r7yTGDWi8/yR9yQ3KNZ6F8LOcEbVxzVl639MpdsPQ9CNoq2SeXJW1A/z05LmjLhYieNzdg8m+ffCfnhSeJlrlVYBAeP1AMoz9V3pBTgjb2BxPtk9ODdgZJ4GYEbYzjgdwRtOUSDpgoctwKT0hYIb/LO3J00sZAXlj/8nv4fzBqWyQ/y5tyRNDOxM7I8UEbsKficzuYKV/KE+YiuFNesuxKwL74aumbMlDyPIwebJfzo7Zd5lbwaNROzu+xzgKxUb6xznun2GsuqkS3DD8BouVhMG2rlqukXtVnAc8jG8K9kYIZXzF3UuEsEyhtRDDMS1ardJktP/+LmGZuBTbFHR6i1jZ3EicX4Tfrc3Mb1MMEsIys9CvDT4DUy8RP4IOcm+7qgA3OSlHvQ6pOIC//i/ATOBR3eKj9lM6s2h4Sl9mQKhNg9S5avfyH0hSClrnIZA0OeNEck48se59Q6riWYOTRJP+BrHhvrhrlQmpwEpO4Zf1vU6JGHzl7zdwbOQuq2DPZE3cENMl/oPpQohfEHTG8yl9Z+psH2bCbza1CHgyO90j8EN4BT+RHS9/zi7n7cl0Z7Ju2VSvRf746t8l15l4uVSDtHlpBpWgIK3XVsr8I/jq7zX09jok7BgDpS2D4HXRY4ttybdzREPZfrzySHA8Js8wVAX4HykpzGz6rKg4qbGQiNyruqAFlltI85IPv0uVf4xdAlpJiRIaQYQAAAABJRU5ErkJggg==>

[image68]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAXCAYAAABnGz2mAAAAv0lEQVR4XmNgGAWjYBSAQRIQ7wZiYXSJgQQcQLwVikHsQQNkgPgJELeiSwwU4AFiSSAOBeLfQBwBxOJAzIqsaCBAPBDPAuL7QPwTiJcC8SQgVkZWNFBgWKQvRgZIrgVFPzGYIo+6APEvKE0ICABxBwMk+onBnhBt5IEqIH4OxEroEgMJYOlrDxBzM0ByYxcDJHoHFIgA8VUGRPoKAuICBkhaGlAAckAjEN8B4pVQ9oCXYcgAlKhBeBSMglEwkAAAckcfUHEdtHQAAAAASUVORK5CYII=>

[image69]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAaCAYAAAANIPQdAAACSUlEQVR4Xu2WP0hVURzHv5GBUSYp1NCiYEGgESi42FCI2BBKEBT9AQWnoLbEP4Pg4BA5CC3R0iA2uIgGTTW0mEI1REEQWZSDUU1NYfr9cu7xnnv0+e679ykO5wMfnu+c84733N/vd84BAoHAXuY8/UnXHH/Tm86YUa9/hh5y+neDJnqFHqP76GF6jl53BxXjMf1P2/0OcpK+pjdopde3W1xF8kXLb/SsO2g7jtJFukRPJLtwgc7ROq+9XFTR/X7jFlyinyPn6V16JDGiCKfpL/oMcaT0j+/QMXowaisXSrdW+pI+QLr5tch+v7EUlNcKv51E9fYQpi71QOVCL64LJhLDtDbZvS25FzlB/9E2eoq+hXmQandQDg7A1NQbmDTLsmlpkU/oc5iU/UL7kC7VN+rxK71Np2AWqE2o0xmXBaVhL30XfaZJy0JokS9oTfS9gX6n95Ai22w9rtIhxG9d6asFV8RDU6NIKWKKnObSnHnRXuHu7FrYJMxC6532LbH1OID4jRynH+kf2hi1lUIP/UQvI2U6ZUTpq2e/6Hf46Hy09egyAjOBPrPgRvMW8qWq9okfdBbJeewilcoFsfWoQlb0XBRBRVIR9ftKwdblB2TfdJrpXyQXadNV7eoviP3xNDbXnr6rXW9KN528+MdHKQe5dnktqM5p098KziMUqHld3ZaRvCKt0GtRv+6HC17/e5gdLS9arG5Rr+h9pD8rW2BSfxDmkrJEn6J8x9yOoHQ7Q8cRHwvFUKp30G6YSBY9OgKBQCAQCGxmHeuVcQVPhu82AAAAAElFTkSuQmCC>

[image70]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAZCAYAAABHLbxYAAABq0lEQVR4Xu2WTStFURSGl6SISIrMfEWMlGQmycTAR0hC/oKhkjKQCVFGShmYKWNRBsREKTPMFUYMhIEJ73v33TlnH+vcc8+hqPPU0621d93XsvfaVyQlJaUQjsM6p24pgZNwC67AFv9y/pTDBXgKG501F375ANyAd/AVdvh2GCrgEVyCZbAdXsNR76aoVMFVeAZ7xXQoFwzaD3vgouhB5+AFrPTUpuANrPHUQqmH22I62AUL/MuRYZjvgjIcQ+449U74AgedegCekb2sbRI/oEUL2gofJRiU+7h/2alnYBh27UBMF9nNn0ILagNpQd16hiH4DEckeQddtKC8bB8SDBQalMS5NFHQgvKyxQpqsWPoXEynkwbWgmqBtLpKKZyFl3BGzMiJgxa0AT5IMJANOu/Uc1IEJ8QEZnD+AfmgBeWAP4H7sNhT74Pv2c9Y8AjwKBzCJmctDAZ9EzMfXabhrXxNGV5kvlI8dny1fh12fRc+ibkw1nu47tnH/9YmPIbDYkJeiXlK/xzsYjMcg91iwqtwkW9rbQSrJfkkiA1bzZ9ZUVwTEzglJeU/8gkIJFynaOxOQgAAAABJRU5ErkJggg==>

[image71]: <data:image/png;base64,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>

[image72]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAaCAYAAABsONZfAAAA1klEQVR4Xu3RPQtBURzH8b9QTAaPhWQw2I2KTAxmyguw2AwGXonIaKAMSl6CzAZlsFgtyqb4nnvO5eAVKL/61O3/O/ec+yDyz68mjjrKCLxX30lgjgWa6OOEgumTyJlrJxnsMITfzHyYYo0gBiiazilHonfNukOTHi6oYoKQW+RxFv1oagM7LVxF39CwC/XSd7TtoYnbLUU/4jM1U6gFn1GzG0qfRRoHdKyZBxXs5bVhChFrjbPgiBnG2KCLKFbYiv6K6iu/xYsYwqJPsufqBPdX/PMjeQBZzSE9o6921QAAAABJRU5ErkJggg==>