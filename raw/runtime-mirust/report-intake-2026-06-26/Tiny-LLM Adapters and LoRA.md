# 1. Tiny-LLM Adapters and LoRA

Recent work shows that even very small LLMs (on the order of 1–3B parameters) can be adapted to complex tasks via parameter-efficient tuning.  For example, the *Tina* models fine-tune only low-rank adapters (LoRA) on a 1.5B base model and achieve reasoning performance comparable to much larger models.  In one benchmark, a LoRA-tuned 1.5B model attained a 20% higher reasoning score at 260× lower training cost than the full-sized baseline.  Similarly, tiny decoders (1.1B–1.3B) fine-tuned with LoRA or adapter layers can exceed 80% accuracy on NLP tasks.  These adapter-based methods train only a small fraction of parameters, drastically cutting compute and memory needs while retaining strong performance.

Moreover, multiple LoRA adapters can be **merged** to create multi-skilled models. Tools like **LoRAX** allow on-the-fly merging of task-specific LoRA deltas into one model.  Typical merge strategies include weighted averaging (“linear” model soups) or advanced schemes like “TIES” and “DARE” that sparsify and combine adapters.  For example, averaging the weights of two fine-tuned models (a simple “model soup”) often improves accuracy without additional inference cost.  In practice, we can mix adapter deltas as:  
```
ΔW_child = α·ΔW1 + (1–α)·ΔW2 + ε
```  
(where ΔW are the effective weight deltas of two parents, α a blend factor, and ε small noise) and then fine-tune the result.  This preserves the “skill” of each adapter.  If parents are highly compatible (same base model), linear merging often works.  If models differ more, techniques like transfer learning or distillation are needed instead (see below).

# 2. Rust ML Frameworks for Inference and Training

The Rust ecosystem now offers several high-performance ML libraries. **Burn** is a full-stack deep learning framework built in Rust for training and inference.  It supports dynamic graphs, multi-backend execution (CPU, CUDA, etc.), and automatic optimizations like fusion.  Notably, Burn’s design minimizes differences between training and deployment: you can train a model and then run inference on it *without code changes*.  This makes it a good choice for running differentiable breeding operations (fine-tuning, distillation, pruning) within Rust.

For lightweight inference, Hugging Face’s **Candle** is designed for exactly this purpose.  Candle is a minimalist, Rust-native runtime optimized for CPU/GPU/WASM, focusing on fast startup and small binaries. It supports popular model formats (safetensors, GGML, PyTorch) and quantized inference.  **mistral.rs** is a pure-Rust LLM-serving engine (built on Candle) that provides accelerated inference (including GPU/Metal support) and even an OpenAI-compatible API.  Together, Candle/mistral.rs let Rust code load and run pre-trained models at low latency.

Another option is **tch-rs** (PyTorch bindings).  It exposes LibTorch (C++ PyTorch) to Rust, so you can train or run models using PyTorch’s ecosystem from Rust code.  This can be handy if you want to leverage existing PyTorch models or use algorithms not yet ported to native Rust.

For model storage, the **safetensors** format is recommended. Safetensors is a zero-copy, memory-safe tensor file format (no Python pickle) used widely in Rust and Python. Using safetensors (or Rust-friendly formats like GGUF) allows the registry to store immutable base weights and adapter deltas safely. In summary, a practical Rust stack could use Burn for all training/breeding steps, Candle or mistral.rs for serving, tch-rs for any PyTorch interop, and safetensors for model files.

# 3. Breeding Operators and Compatibility

**Parameter-level breeding** (e.g. merging weights) is only valid when two models truly align.  Concretely, the “baseFamily”, architecture, tokenizer, and tensor schema must match exactly.  If those compatibility fields differ, we cannot simply mix weights.  When compatible, we can apply operators like **LoRA merge**, adapter crossover/mutation, pruning, or incremental fine-tuning.  For example, merging two LoRA-trained adapters often means adding their low-rank deltas (possibly scaled) and then projecting back to a target rank.  This follows the linear merge idea of *model soups*.  More robust merges (TIES/DARE) sparsify weights to avoid interference.  After merging, we usually fine-tune the child model on a mix of data from both parents (including any newly mined hard examples) to ensure it stands on its own.  

In contrast, **structural breeding** or *knowledge transfer* is used when compatibility breaks.  If the architecture or tokenizer differs, we should train a new student model via *distillation*.  A large ensemble (or very capable model) acts as teacher and generates outputs on data (possibly including hard examples); the small student model learns to imitate those outputs.  This is standard LLM distillation: “teacher as oracle” labeling data for the student.  The student can be any supported architecture implementing the same input/output contract.  Similarly, if mixing different sizes in one family (e.g. 1B and 2B models), one can distill the larger into the smaller or vice versa, possibly transferring only the first N layers if aligned.  In short, **parameter merging (like simple LoRA addition) is only safe for compatible models**, whereas any heterogeneity forces distillation or retraining.  

**Feature-level mixing** (like hidden-state blending) generally requires learned projections or joint training and is more complex.  We avoid that unless absolutely needed (e.g. multi-modal merging might do that).  Instead, our design keeps models **behaviorally interchangeable** via well-defined contracts (versioned input/output schemas), so that routing cares only about the interface, not the internal architecture.

# 4. Evaluation, Safety, and Promotion

Every candidate must clear strict gates before being considered.  This means *automated validators and tests* ensure the model is safe, correct, and performant under fixed limits. For example, one would run the model on a safety/test suite (toxicity checks, logic puzzles, red-team prompts, etc.) and only accept it if **all safety tests pass**.  Recent LLM safety surveys highlight benchmarks for toxicity, bias, truthfulness, jailbreaks, etc..  The model’s output format should be validated by a deterministic parser or schema check (e.g. valid JSON), catching any format errors.  We also verify the model artifact (check its cryptographic signature, base hashes match, etc.) and ensure it doesn’t violate any “no-train” rules (e.g. proprietary data). 

For performance, we impose hard limits on resources: the candidate’s memory use and p95 latency must not exceed configured ceilings.  If any hard gate fails, we reject the candidate outright.  Only after all gates pass do we compute a *fitness score*.  Typically this is a weighted combination of metrics: task quality (accuracy) *plus* calibration, robustness, coverage of new capabilities, **minus** costs (latency, memory, compute, etc.).  Conceptually, one computes:  
```
Fitness = w_Q·(quality) + w_C·(calibration) + ... – w_L·(latency) – w_M·(memory) – …  
```  
This multi-objective scoring ensures we reward improvements in accuracy or robustness, but penalize any increased inference cost.  In practice, rather than collapsing to one scalar, we maintain a *Pareto frontier* of elite models.  For example, one model might offer top accuracy, another minimal latency, another best robustness; all are Pareto-optimal.  A deployment can then pick the best model matching its resource profile.  Prior work explicitly maps such accuracy-latency (or accuracy-FLOPs) trade-offs for reasoning models, guiding selection of cost-effective checkpoints.

Finally, deployment uses canary-release and rollback.  A new candidate is first exposed to limited traffic, and its metrics (accuracy on incoming queries, safety alerts, latency) are compared to the incumbent.  If it significantly regresses or violates any threshold, we abort and roll back.  If it shows net improvement (considering its higher cost), we promote it in the registry.  Every model in the registry carries signed metadata (its genome) and an immutable lineage, so we always know exactly how it was bred and evaluated.  This completes the two-timescale process: rapid parameter updates within fixed structures, and slower structural changes (merge, add, prune) that only occur when justified by comprehensive evaluation.

# 5. Rust Crate Layout and Core Traits

A modular Rust design helps keep components cleanly separated.  For example:

```text
tiny-ecology/
├── Cargo.toml
├── crates/
│   ├── ecology-contracts/   (domain types and traits: ModelId, ModelGenome, ModelEngine, etc.)
│   ├── ecology-registry/    (model metadata store, compatibility logic)
│   ├── ecology-runtime/     (loader for ModelEngines, main loop, task dispatch)
│   ├── ecology-router/      (routing policies implementing ModelRouter)
│   ├── ecology-verifier/    (safety/schema validators, heuristics)
│   ├── ecology-telemetry/   (logging of latency, quality, resource use)
│   ├── ecology-breeder/     (BreedingOperator implementations: finetune, merge, etc.)
│   ├── ecology-evaluator/   (CandidateEvaluator that runs hidden test sets)
│   ├── ecology-promotion/   (canary rollout, Pareto archive management)
│   ├── backend-burn/        (glue to run Burn-based models as ModelEngine)
│   ├── backend-candle/      (glue for Candle or mistral-rs models)
│   ├── backend-mistralrs/
│   ├── artifact-store/      (storage of weight files, immutability enforcement)
│   └── ecology-daemon/      (orchestrator that ties everything together)
└── xtask/                  (build scripts and evaluation harnesses)
```

The **ecology-contracts** crate defines the core types and interfaces.  For example:

```rust
/// Uniquely identifies a model (including version).
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ModelId(pub String);

/// Checks if two models share the same base family, architecture, and tokenizer.
pub struct CompatibilityIdentity {
    pub base_family: String,
    pub architecture_hash: String,
    pub tokenizer_hash: String,
    pub tensor_schema_hash: String,
}

/// Immutable ancestry information.
#[derive(Clone, Debug)]
pub struct Lineage {
    pub parents: Vec<ModelId>,
    pub operation: BreedingOperation,
}

/// Genome (metadata) for a model artifact.
#[derive(Clone, Debug)]
pub struct ModelGenome {
    pub id: ModelId,
    pub compatibility: CompatibilityIdentity,
    pub interface_version: String,
    pub capabilities: BTreeSet<String>,
    pub lineage: Lineage,
    pub artifact_hash: String,
    // ... additional fields like resource profile ...
}

/// A loaded model artifact and its weights file.
#[derive(Clone, Debug)]
pub struct ModelArtifact {
    pub genome: ModelGenome,
    pub weights_path: PathBuf,
}

/// An inference query with a versioned capability.
#[derive(Clone, Debug)]
pub struct InferenceRequest {
    pub capability: String,
    pub prompt: String,
    pub maximum_new_tokens: usize,
}

/// The model’s text output and observed latency.
#[derive(Clone, Debug)]
pub struct InferenceResponse {
    pub model_id: ModelId,
    pub text: String,
    pub latency_milliseconds: u64,
}

/// A corpus of evaluation data (immutable).
#[derive(Clone, Debug)]
pub struct EvaluationCorpus {
    pub corpus_path: PathBuf,
    pub corpus_hash: String,
}

/// Evaluation metrics for promotion decisions.
#[derive(Clone, Debug)]
pub struct EvaluationReport {
    pub task_quality: f64,
    pub calibration: f64,
    pub robustness: f64,
    pub safety_pass_rate: f64,
    pub p95_latency_milliseconds: u64,
    pub resident_memory_bytes: u64,
}
```

Key **traits** (interfaces) include:

```rust
/// Provides inference for one loaded model artifact.
pub trait ModelEngine: Send + Sync {
    /// Returns immutable genome metadata for this model.
    fn genome(&self) -> &ModelGenome;

    /// Executes an inference request.
    ///
    /// # Arguments
    ///
    /// * `request` – The versioned capability request to execute (with prompt and options).
    fn infer(
        &self,
        request: &InferenceRequest,
    ) -> EcologyResult<InferenceResponse>;
}

/// Selects a sequence (cascade/ensemble) of models for a request.
pub trait ModelRouter: Send + Sync {
    /// Determines candidate engines in preferred order.
    ///
    /// * `request` – The request (capability, prompt, etc.) to route.
    /// * `engines` – All currently loaded engines that meet the capability contract.
    fn route(
        &self,
        request: &InferenceRequest,
        engines: &[Arc<dyn ModelEngine>],
    ) -> EcologyResult<Vec<Arc<dyn ModelEngine>>>;
}

/// Creates a descendant model artifact from parent artifacts.
pub trait BreedingOperator: Send + Sync {
    /// Human-readable name of this breeding method.
    fn name(&self) -> &'static str;

    /// Returns true if this operator can handle the given parents.
    ///
    /// * `parents` – The immutable parent artifacts under consideration.
    fn supports(&self, parents: &[Arc<ModelArtifact>]) -> bool;

    /// Produces a new (unpromoted) child artifact.
    ///
    /// * `parents` – The parent model artifacts.
    /// * `corpus` – The approved training or distillation corpus to use.
    fn breed(
        &self,
        parents: &[Arc<ModelArtifact>],
        corpus: &EvaluationCorpus,
    ) -> EcologyResult<ModelArtifact>;
}

/// Evaluates a candidate model in isolation.
pub trait CandidateEvaluator: Send + Sync {
    /// Runs fixed tests and collects metrics for the candidate.
    ///
    /// * `candidate` – The unpromoted candidate model artifact.
    /// * `corpus` – The hidden evaluation corpus (regression and safety tests).
    fn evaluate(
        &self,
        candidate: &ModelArtifact,
        corpus: &EvaluationCorpus,
    ) -> EcologyResult<EvaluationReport>;
}

/// Checks if two models can have their parameters merged.
pub fn parameter_merge_compatible(
    left: &ModelGenome,
    right: &ModelGenome,
) -> bool {
    left.compatibility == right.compatibility
}
```

Each method includes doc comments describing its purpose and parameters.  Other crates implement these traits: e.g. **backend-burn** would implement `ModelEngine` by loading weights into a Burn model; **ecology-router** would implement `ModelRouter` with logic to pick one engine or cascade; **ecology-breeder** would register several `BreedingOperator`s (like LoRA-merge, fine-tune, quantize) to try on parent sets; **ecology-evaluator** implements `CandidateEvaluator` by running the model on the hidden test suites under fixed compute caps.

This modular design cleanly separates concerns (models vs routing vs breeding vs promotion), uses safe Rust for concurrency, and ensures that breeding (which may involve heavy compute) is isolated from the inference-serving plane.  All important compatibility and lineage logic is captured in the contracts and registry (with signed genomes), ensuring the system can evolve its population of tiny models in a robust, trackable way.

**Sources:** Recent research on adapter-tuning and LoRA for small models; tools and strategies for merging adapters; Rust ML framework documentation (Burn, Candle, mistral.rs); safetensors format; routing/cascading surveys; evaluation and safety benchmarks. These inform the design of the multi-model breeding ecology outlined above.