# 1. Executive portfolio recommendation  
Build a single strong general “champion” (e.g. a ~7B–20B LLM) and a set of compact specialists for high-value tasks.  For example, include a **structured-output extractor** (e.g. JSON/table extraction), **summarizer**, **rewriter/paraphraser**, **code explainer**, **bounded planner**, and **classifier**.  Each specialist should yield a clear accuracy or speed gain on its domain with very little overhead (as small as 50M–500M params or lightweight adapters).  Empirical evidence shows narrow SLMs often *outperform larger general models on their domains*, so we target such tasks.  All specialists must clearly defer to the champion outside their scope, and the champion serves as a catch-all fallback.  In practice, choose a mix of adapter-style specialists (for tasks where the champion’s architecture suffices) and a few standalone tiny models (for very different modalities or formats), optimizing for the lowest added bytes per task.  The portfolio should maximize in-domain coverage with positive responses far outweighing refusals, while maintaining the champion’s general abilities intact.

# 2. Specialist claim taxonomy and scope contract  
We define a **semantic scope taxonomy** for each specialist (not just label names):

- **In-scope (Positive)**:  Inputs that match the specialist’s claim and on which the specialist significantly outperforms the champion.  For example, a “JSON extractor” specialist claims tasks like “extract all names and dates into JSON” – such inputs are *positive in-scope*.  
- **Adjacent**:  Inputs related but not exactly matching. E.g. for a summary specialist, an adjacent case might be a document that partially meets the summarization criteria (or the user’s request is phrased slightly differently).  Specialists may try them but with caution.  
- **Ambiguous**:  Inputs that could plausibly fall under multiple specialists or the champion.  These should be handled conservatively (e.g. routing logic or deferring to champion), since it’s unclear which specialist best applies.  
- **Compound**:  Inputs combining in-scope and out-of-scope tasks (e.g. “Summarize the document *and* translate to French”).  The specialist should ideally handle its part (summarization) and either pass the rest to the champion or do nothing beyond its remit.  
- **Clearly out-of-scope**:  Anything outside the narrow claim (e.g. a medical diagnosis query to a JSON-extraction specialist).  Specialists must *refuse or abstain and fallback* in such cases.  

Each specialist’s **scope contract** must be carefully defined by semantic criteria (not just keywords).  We ensure it has a narrow, calibrated domain with clear fallbacks.  The specialist’s training and prompt curriculum should enforce this taxonomy: it is only trained on positive in-scope examples and treated as undefined outside them.  The champion handles general conversational demands, ambiguity, and any case not explicitly certified in-scope.

# 3. Adapter-versus-standalone architecture matrix  
**Adapters (LoRA/IA³/DoRA/etc.)** attach small trainable modules to the base champion model.  They **reuse the champion’s tokenizer, embeddings, and layers**.  Pros: very low additional parameters and storage (often just a few MB or <10% of base params), low training cost (only adapters updated), and near-zero extra RAM at runtime (use base model’s memory).  Cons: they **depend on the base model and its tokenizer**, cannot change the vocabulary or architecture, and switching specialists means loading or activating adapter weights.  

- *LoRA* adds low-rank matrices (factorized weights) to attention layers.  Only a tiny fraction of weights are trained.  Storage overhead is small, and inference adds no extra parameters.  Training is cheap but yields “intruder dimensions” not present in full-finetune.  
- *IA³ (Infinitesimal Adapters)* adds just three learned scaling vectors per layer (for Q, K, V) instead of full matrices.  This is even more lightweight than LoRA.  
- *DoRA* (Weight-Decomposed LoRA) splits pretrained weights into magnitude + direction and applies LoRA on the directional component, improving capacity and stability.  Its inference cost is the same as LoRA.  
- *Sparse or pruning adapters* (less common) would update a small mask of weights.  

All adapters share the champion’s tokenizer and head, so **no new embedding or vocabulary overhead**, but they *cannot* run without the base model.  Adding an adapter means the champion model plus adapter weights must be available at inference.  

**Standalone specialists** are independent small models distilled or trained for the task.  They can use a reduced vocab or even a new tokenizer (enabling domain-specific tokens).  Pros: fully independent (no base model needed at runtime), can have custom architecture (e.g. fewer layers or smaller FFN).  Cons: much larger size relative to adapters (embedding+LM weights duplicated), higher training cost (training a full model), and more runtime RAM for the separate model.  For example, a 200M-parameter standalone model might take ~200MB on disk vs a 5MB adapter on a 7B model.  Standalone specialists can be deployed flexibly, but each brings its full embedding matrix (which can **dominate small models’ size**).  Adapters, by contrast, only store their delta (e.g. 1–10MB).  

|                    | **Adapter (LoRA/IA³/DoRA)**                                                 | **Standalone Student**                          |
|--------------------|-----------------------------------------------------------------------------|-----------------------------------------------|
| **Architecture**   | Tied to champion’s model (same layers, vocab)                               | Independent (can pick smaller depth/width, vocab) |
| **Tokenizer**      | Uses champion’s tokenizer and head                                          | Own tokenizer/embeddings (or share champion’s)    |
| **Trainable params** | Very few (LoRA often <10%, IA³ even less)     | All student weights (100%)                       |
| **Training cost**  | Lower (only train adapters)                                                | Higher (train full model)                        |
| **Storage**        | Small (adapter delta ~MBs)                                                 | Larger (full model + tokenizer, e.g. 100+MB)    |
| **RAM (inference)**| Slightly more (base model + adapter overhead, negligible increase)          | Smaller footprint if model tiny, but still full base size of student |
| **Flexibility**    | Less (must use champion’s model, cannot alter arch or vocab)                | More (can tailor to task, use fewer tokens)      |

In summary, adapters minimize incremental bytes and reuse the champion, whereas standalone students maximize flexibility at the cost of memory.  For tasks where the champion’s architecture is already well-suited, adapters give a huge storage and training advantage.  If a task demands a very different tokenizer or architecture, a distilled standalone model may be justified.

# 4. Curriculum proportions and scenario-generation system  
We construct a **rich curriculum** that covers valid in-scope cases, “near miss” cases, and hard negatives.  Key components:  

- **Data factors & variations** – Include *scenario factors* (e.g. different contexts, domains, formality levels) and *entity substitutions* (swap names, numbers, entities) so the specialist isn’t fixated on particular examples.  For instance, replace dates, names, or locations with others to force generalization.  Introduce *discourse variations* (e.g. invert sentence order, use active vs passive voice) so phrasing differences are learned.  
- **Counterfactual constraints** – Generate pairs of inputs where only a minor detail changes (e.g. one fact is flipped or removed) to ensure the model must really understand the content.  These teach the model to pay attention to critical details.  
- **Authority/style permutations** – If relevant, vary the writing style or level of authority in the prompt or example (e.g. informal vs formal tone, technical vs layman explanation) so the specialist learns to preserve style.  
- **Multi-turn states** – For dialogue-based tasks, include examples with state updates (e.g. document annotation, progressive extraction) to train the specialist to handle context changes over turns.  
- **Adversarial instructions and hard negatives** – Deliberately include *adversarial prompts* (misleading instructions or contradictory conditions) and off-scope queries as negatives.  For example, a JSON-extractor should see examples of irrelevant text requiring refusal or champion fallback.  Techniques like TAPIR use an LLM oracle to pick *difficult* instruction examples for the student, ensuring the curriculum escalates in difficulty.  
- **Teacher disagreement cases** – Use multiple teacher outputs (ensemble or variants) to find questions where answers conflict.  Include such items with curated “correct” resolution.  This ensures the student learns to be robust when different teachers disagree or to defer to the champion.  Techniques like “knowledge purification” merge conflicting teacher rationales into a single answer.  

We may structure phases (curriculum proportions) akin to TSCL or CLPD.  For example, we can start with easy, single-turn tasks and progressively add complexity (multi-turn or compound tasks).  CLPD explicitly orders examples from easy to hard and schedules stronger teachers on harder examples.  Similarly, TSCL (Task-Structured Curriculum Learning) first trains on “question-only” or prediction-only tasks, then joint input-output, then full explanation tasks.  We would allocate more training tokens to straightforward in-scope examples (e.g. 50–70% of data), with a smaller fraction to near-in-scope, and sprinkle in adversarial negatives.  Adapting TAPIR’s approach, we could use the champion as an oracle to label question difficulty and balance the curriculum across difficulties.  

Overall, the curriculum generator programmatically creates diverse scenarios by permuting entities/discourse and mixing in counterfactual or adversarial cases.  Teacher disagreement is flagged by ensembling: if two teacher models output different answers, mark that example for special treatment.  This multi-dimensional design ensures specialists see a wide variety of “in-scope” and borderline inputs during training.

# 5. Distillation and optimization method comparison  
We compare several training paradigms for specialists (very small students).  Key methods:  

- **Full-sequence SFT**: Train the student on entire dialogues or text (all roles) in next-token prediction.  This requires a compatible tokenizer but not necessarily the same architecture (the student can learn from the teacher’s tokens).  It provides strong context learning but can be data-inefficient.  
- **Assistant-only SFT**: Only use the assistant’s output tokens as supervision (mask system/user tokens).  This isolates the student to learn to generate answers given context, aligning with how it will be used.  It relies on the teacher’s outputs but does not require teacher introspection.  This does *not* require same architecture or tokenizer (just uses teacher-generated text as targets).  
- **Token-level KD (logit distillation)**: Student minimizes KL-divergence to the teacher’s output logits for each token (optionally only top-K logits).  This *white-box* method requires the teacher and student to share vocabulary/embedding mapping, since logit spaces must align.  It tends to be stable and is common in small-model distillation.  Delta-KD notes that token-KL is the standard form.  
- **Sequence-level KD**: Student is trained to match the teacher’s distribution over whole sequences (e.g. by minimizing KL on sequence probabilities or via reinforcement learning on samples).  This can work with a black-box teacher (only needs sampled sequences and probabilities) and can use different tokenizers.  Delta-KD describes this as aligning distributions over sampled sequences.  It can capture global coherence but is more computationally expensive (sampling required).  
- **Top-k logit distillation**: A variant where the teacher only provides its top-k logits or tokens (reducing bandwidth) and the student matches those.  Requires vocabulary compatibility for the top-k entries.  
- **Hidden-state matching**: Use intermediate representations as targets (FitNet style).  This requires *the same architecture or layer sizes* to compute hidden features.  It often boosts distillation when layers align.  
- **Preference optimization (RLHF/DPO)**: Optimize the student against a reward or preference model.  For small specialists, one can use Direct Preference Optimization (DPO) or other RLHF methods to align outputs to desired outcomes.  This only requires a reward signal or preference comparisons, not token-level compatibility.  Cui et al.’s PAD approach explicitly distills the *teacher’s preference distribution* into the student, which can be viewed as KL on preference rankings.  
- **Self-distillation**: Have the student distill from itself (its own outputs).  SDFT (Self-Distillation Fine-Tuning) is one example: the student samples a response, then receives a teacher KL loss against itself (on-policy).  This requires compatible architecture (teacher and student are same model) and often uses temperature or past checkpoints.  

Compatibility notes: **Token-level/logit-KL** and **hidden-state** distillation *require* the same vocabulary and similar model structure (so you usually fine-tune a copy of the teacher, or ensure aligned tokenization).  **Sequence-level KD** and **Preference/RL** do *not* strictly require same tokens (you could distill from an API teacher).  **Self-distillation** inherently assumes the student model itself.  **SFT variants** only need the student to parse and generate text; the teacher can be black-box as long as it provides ground-truth sequences.  

Empirically, token-KL often yields the best fidelity in small students, but can lead to exposure bias. Sequence-KD or RL methods can mitigate that by learning from the student’s own distribution.  Preference-based distillation (PAD) can instill finer quality judgments.  In practice, a hybrid is useful: e.g. start with token-KL to teach output style, then fine-tune with a small amount of self-distillation or preference KL for better robustness.  

# 6. Teacher review, provenance, and contamination controls  
We enforce strict data hygiene and review for all teacher-generated training content:  
- **Ensembles & diversity**: For each prompt, sample multiple outputs from the teacher (e.g. with varied temperature or top‑$p$) to capture diverse valid answers.  If using multiple teacher models or checkpoints, collect all answers.  This ensemble helps surface uncertainties or contradictions.  
- **Deterministic replay**: Log seeds and parameters so every generated example can be exactly reproduced.  Record the full generation context (teacher prompt, model version, RNG state).  This ensures our synthetic data is fully auditable and debuggable.  
- **Factual verification**: Whenever possible, verify teacher answers against trusted sources or logic rules.  For example, use a separate retrieval system or a fact-checker LLM to flag factual errors.  Discard or correct answers that fail verification before using them as training labels.  
- **Rubric review**: Define a rubric for answer quality and format (completeness, style, correctness).  Automatically score or even manually spot-check teacher outputs to ensure they meet criteria.  Filter out examples with obvious failures or toxicity.  
- **Disagreement adjudication**: When multiple teachers disagree, either remove the example or consolidate via aggregation (e.g. using a neutral “aggregator” model or majority voting).  Zeng et al.’s “Knowledge Purification” approach merges multiple teacher rationales into one; a simpler approach is to exclude questions with high teacher variance.  
- **PII/licensing filtering**: Scrub any personal data (names, addresses, etc.) from teacher outputs.  Ensure all content respects licensing – e.g. do not include copyrighted text in the prompts or answers.  
- **Chain-of-Thought exclusion**: In teacher outputs, disable “hidden chain-of-thought.”  The student should never see teacher reasoning steps that wouldn’t be present in normal usage.  We only retain the final answers or succinct rationales.  (In particular, do not train on chain-of-thought prompts that contain forbidden cues.)  
- **Answer deletion (no leakage)**: Follow LatestEval practices: remove any explicit answers from context examples so models must infer answers rather than copy.  For example, if crafting a question based on a reference passage, delete the passage’s answer sentence before giving it to the model.  This “deletion lineage” prevents simply memorizing evaluation phrases.  

Throughout, every synthetic example is accompanied by provenance metadata (which teacher/model, generation settings, filters passed).  We never include sealed test prompts or known answers in training.  Every example is traceable (prompt → teacher output → final filtered label) to avoid contamination.

# 7. Capacity, tokenizer, context, and footprint analysis  
We allocate each small model’s capacity carefully:  

- **Vocabulary/Tokenization**: The tokenizer size can *dominate* a very small model’s footprint.  In tiny models (≤2B), the embedding layer is no longer negligible – it can be ~25–30% of total parameters.  For instance, a 50k-token vocab × 512-dim embeddings is ~25M parameters alone.  To optimize, specialists can share the champion’s tokenizer (no extra embed matrix) or use a trimmed vocab.  Sharing the champion’s vocabulary is storage-free but forces the specialist to support all tokens (costly if many are unused).  Trimming (removing unused tokens) can greatly shrink the embedding and speed up softmax.  We should profile token frequencies in the specialist domain to decide: if most general tokens are irrelevant, we build a lean vocab.  Otherwise, reuse the champion’s tokenizer for ease of alignment (the champion’s embedding can be loaded and frozen).  

- **Embedding vs Output projection**: We usually tie input and output embeddings.  For a standalone student, reducing hidden dimension or vocab directly reduces both.  Adapter specialists use the champion’s embeddings/softmax, so they pay no extra cost here (only the small adapter matrices).  

- **Depth (layers) and Width (hidden dim)**: A smaller depth (fewer layers) linearly cuts parameters and compute but may limit expressivity.  Width (hidden size) has a quadratic effect on feed-forward network (FFN) size and modest effect on attention.  Balanced choice: e.g. for a 1B specialist you might use half the layers of the champion or 60% of its hidden size.  

- **Attention Heads and KV heads**: Fewer heads (with correspondingly larger head dimension) can reduce overhead but may impact multi-head representational power.  Since even small models often use scaled-down architectures, we might reduce heads by factor (e.g. 8→4 heads).  KV (key/value) size is tied to hidden size.  LoRA adapters add overhead proportional to number of heads and their size (LoRA’s U/V matrices).  IA³ uses 3 vectors per layer regardless of head count, making it very light.  

- **Feed-Forward Network (FFN)**: The FFN contributes ~2× the hidden size in params per layer.  Reducing the FFN hidden factor (typical 4× hidden) to 2–3× in a specialist can cut ~30–50% of a layer’s parameters.  However, too shallow an FFN may bottleneck capacity, so this must be validated.  

- **Context length**: A longer context linearly increases per-token memory (activations) but does not affect parameter count.  We typically keep context equal to champion’s (e.g. 2048 tokens) to preserve continuity.  If memory is tight, we can trim context for some specialists.  

- **Output projection**: For standalone models, the output (softmax) is the transpose of embeddings if tied.  For adapters (sharing base vocab), they incur no extra projection.  If a specialist has its own reduced vocab, its final linear layer shrinks accordingly.  

In sum, for a micro-model specialist (~50M parameters), one might allocate ~10–15M to embeddings (or reuse), ~30M to a few layers (e.g. 6 layers with 768-1024 hidden), and leave ~5M for adapters or heads.  If the tokenizer is large, it could exceed the rest of the model (as [67] shows).  Sharing the champion’s tokenizer saves that chunk but couples deployments.  We must weigh these: if the specialist’s task truly never uses rare tokens, trimming yields large gains in footprint and speed.  

# 8. Routing, abstention, and champion fallback contract  
A specialist must **abstain gracefully** whenever it’s outside its scope, without overly refusing valid in-scope requests.  We enforce: 

- **Uncertainty thresholding**: If the specialist’s confidence (e.g. softmax peak or output entropy) falls below a calibrated threshold, it should defer to the champion.  This prevents guessing.  For example, if it encounters ambiguous wording or fails an internal domain check, it says “I’m not sure” or passes the query.  
- **Out-of-scope detection**: Simple rule-based filters (keywords or input features) and learned classifiers can flag obvious out-of-domain inputs.  A specialist can also be trained on negative examples to know what to refuse.  In either case, it never tries to answer clearly out-of-scope queries.  
- **Compound requests**: If part of the user’s request is in-scope, the specialist answers that part and refers the rest to the champion.  For instance, if asked “summarize this and then translate,” the summarizer could produce the summary, then output a marker like “[TRANSLATION REQUEST HANDLED BY GENERAL MODEL]” or simply stop, deferring to the champion for translation.  
- **Keep user selection**: If the user explicitly selected the specialist (e.g. “use the JSON assistant”), we obey unless it’s harmful to do so.  That means even when in doubt, try partial answer rather than flat refusal, and clearly note the coverage limit.  
- **Minimize refusal bias**: Specialists should not learn to refuse simply to avoid risk. We ensure the training includes many valid positive examples and very few “I cannot do that” cases.  Fallback is a fallback, not the default.  
- **Consistent fallback style**: When routing to the champion, the specialist should offer a consistent reason (e.g. “This request is beyond my scope; transferring to the general assistant.”). This maintains user trust and continuity.  
- **No silent failure**: We avoid “silent dropouts.” If the specialist cannot produce a valid output, it must explicitly hand off to the champion rather than output garbage or silence.

In summary, the specialist’s behavior contract is: *“Answer confidently on in-scope inputs; otherwise, defer to the champion in a helpful way.”*  This respects the user’s choice of specialist without catastrophically refusing normal queries.  

# 9. Sealed promotion experiment and statistical plan  
To evaluate specialists, we design **matched-pair A/B experiments** comparing: 
1. **Champion baseline** (no specialist),  
2. **Champion + adapter** (with specialist adapter enabled),  
3. **Standalone specialist** (answers alone, champion disabled),  
4. **Portfolio routing** (system routes queries via a specialist router or decision logic to use either champion or the relevant specialist).  

Each condition receives the same test prompts (sampled from both in-scope and general queries) with fixed random seeds for any sampling.  We preserve all raw outputs (no manual edits) and retain the seeds to ensure reproducibility.  We measure metrics on: (a) **specialist tasks** (e.g. accuracy/F1 on extraction or classification, n-gram ROUGE for summarization, etc.), and (b) **general tasks** (standard LLM benchmarks or multi-turn chats) to detect regressions.  Human raters or automated judges score correctness and helpfulness, and we compute statistical significance (paired t-test or bootstrap) on the differences.  

Specifically, we will test: “Does *Champion+Adapter* significantly outperform *Champion only* on the specialist’s domain tasks without harming general performance?” and similarly for standalone vs champion, and the router portfolio.  We also include a control: *Champion with irrelevant adapter* to check for spurious effects.  Repeated experiments (different random seeds in generation) will validate stability of results.  Any promotion to production requires that the specialist condition shows a statistically significant gain (p<0.05) on in-scope benchmarks **and** no statistically significant loss on general benchmarks.  Raw model outputs and seeds will be logged for audit and error analysis.

# 10. Compute formulas, pilot stages, and stop rules  
We quantify training cost and throughput with standard scaling formulas.  Let **$N$** = total model parameters, **$T_{\rm tok}$** = total training tokens (i.e. number of tokens seen, = epochs × dataset size), and assume $6N$ FLOPs per token (forward+backward).  Then total training FLOPs ≈ $6 N \times T_{\rm tok}$.  If hardware delivers $\tau$ (FLOPs/s), training time $t = \frac{6 N\,T_{\rm tok}}{\tau}$.  

In terms of memory: each parameter takes $b$ bytes (e.g. $b=2$ for float16).  For Adam optimizer, we store two moment vectors, so memory ≈ $3 N b$.  For LoRA adapters, $N$ refers to trainable adapter params only (much smaller $N_{\rm train}$).  We also count activation memory: $\sim$ $B\times L \times H$ floats for a batch of size $B$ and sequence length $L$ (context) with hidden size $H$.  

For example, a pilot run: if a specialist has $N=100$M parameters and sees $T_{\rm tok}=10^{9}$ tokens, training flops = $6\times10^8 \times10^9=6\times10^{17}$ FLOPs.  On a GPU delivering 100 TF/s, that’s ~6000 seconds.  More generally:
- **Steps** = $T_{\rm tok}/(B \cdot L)$,
- **FLOPs/step** ≈ $6 N \, (B\cdot L)$,
- **Time/step** = $6 N \, (B L)/\tau$.

We use these formulas to plan pilot stages.  Initially train on a small subset of tasks for a fixed budget (e.g. 10M tokens) and measure performance.  If the specialist fails to improve or general performance drops, we can abort (stop rule).  We gradually increase data and scale only if gains are observed.  At each stage, check regression metrics to ensure stability.  Stop training when validation loss no longer improves or when general-task metrics approach degradation.  Crucially, we do *not* cherry-pick seeds or tune until a pass; everything is pre-specified.  

# 11. Ordinary-helpfulness regression requirements  
Even narrow specialists must remain *helpful on baseline tasks* to a degree.  In promotions, we enforce a “regression gate”: the specialist-augmented model must not score worse than the champion on general conversational or safety benchmarks beyond a small tolerance.  For example, if the champion ordinarily answers simple Q&A or polite refusal correctly 95% of the time, the specialist-added system should not drop below ~93–94%.  We flag any critical failures (e.g. factual hallucinations, refusal on trivial general queries, or toxic outputs) as immediate disqualifiers.  

**What to omit from a narrow claim:** Specialists are allowed to *ignore* behavior outside their contract.  E.g. the JSON-extractor need not explain concepts or debate philosophy.  But it **must not**: (a) produce unsafe or toxic content when faced with adversarial prompts, (b) hallucinate facts in-scope (e.g. invent names in extraction), or (c) behave robotically.  Failures like these reject promotion.  

In short, we **do not** relax safety or helpfulness for specialists.  If a specialist is incompetent on broad-user requests, it simply defers to the champion.  Any sign that the specialist causes the system to underperform on normal usage (e.g. increased refusal rates, complaints, or obvious errors) requires corrective action or dropping the specialist.  This ensures specialty gains do not come at the cost of essential competence.

# 12. Unknowns requiring approved local data and execution  
Certain aspects cannot be fully resolved from literature and must be validated with in-house experiments or proprietary data:  
- **Domain-specific validation:** Real user queries and gold labels for our exact target tasks will refine the specialist’s scope and curriculum.  
- **Threshold calibration:** Confidence cut-offs for abstention need tuning on held-out logs.  
- **Realistic multi-turn tests:** The effect of specialists in long dialogues should be tested end-to-end (with memory, state).  
- **User preference data:** Ultimately, A/B testing with real users or domain experts will verify if specialty models improve experience.  
- **Safety review:** We will run full safety and fairness audits on specialist outputs using local compliance standards.  

These steps require internal data and infrastructure (for example, a dataset of actual user requests or a human annotation effort) and must be done under controlled conditions.  Metrics like “time to switch model,” “latency impact,” and true fallback behavior need live trials.  We will proceed only after internal review of these unknowns.

# 13. Annotated primary-source bibliography  

- Cao et al. (2026-05-11). *Curriculum Learning–Guided Progressive Distillation in LLMs* (arXiv preprint). Introduces CLPD, which orders training examples by difficulty and schedules progressively stronger teachers.  
- Bensaid et al. (2026-05-28). *SLAD: Shared LoRA Adapters for Task-Specific Distillation* (arXiv). Studies multi-stage distillation (TinyBERT pipeline) and proposes sharing LoRA adapters between teacher and student for better alignment.  
- Yue et al. (2024-05). *Distilling Instruction-Following Abilities via Task-Aware Curriculum Planning (TAPIR)* (arXiv). Uses a strong LLM to identify difficult instructions and build a multi-round, difficulty-balanced curriculum for distillation.  
- Ezgi & Onan (2026-01-12). *Task-Structured Curriculum Learning for Multi-Task Distillation* (Comput. Mater. & Continua). Proposes TSCL with phased curriculum (prediction-only, joint, explanation) to distill reasoning, showing improved accuracy and faithfulness.  
- Amodei et al. (2025-01). *Delta Knowledge Distillation for LLMs* (arXiv). Analyzes token-level vs. sequence-level distillation (token-KL vs aligning sequence distributions) and introduces Parallelogram Loss for multi-teacher distillation.  
- Zhang et al. (2026-03). *Self-Distillation Fine-Tuning with QLoRA: Stability vs. LoRA Rank* (arXiv). Discusses self-distillation (SDFT) using student’s own trajectories with a KL loss. Shows SDFT anchors student to teacher outputs on-policy and can improve retention of formats.  
- Cui et al. (2025-07). *Preference-Aligned Distillation for Small LMs* (Findings ACL 2025). Presents PAD, which distills a teacher’s nuanced preference distribution into a student, aligning to human evaluations. Models teacher preference as a probability over outputs and trains the student via KL.  
- Liu et al. (2024). *DoRA: Weight-Decomposed Low-Rank Adaptation* (ICML 2024). A variant of LoRA that decomposes pre-trained weights into magnitude and direction, using LoRA on the directional part. Achieves better capacity and stability than LoRA with no extra inference cost.  
- Chen et al. (2024). *Parameter-Efficient Fine-Tuning With Adapters* (arXiv 2405.05493). Surveys adapters; describes IA³ adapter which uses three scaling vectors for Q/K/V (vs LoRA’s matrices), and compares PEFT methods’ sizes.  
- Shuttleworth et al. (2024). *LoRA vs Full Fine-tuning: An Illusion of Equivalence* (ArXiv). Shows LoRA’s low-rank updates lead to different “intruder” singular vectors than full fine-tuning, and notes that LoRA remembers old tasks better.  
- Li et al. (2023-12). *Avoiding Data Contamination in LM Evaluation: LatestEval* (arXiv 2312.12343). Constructs QA benchmarks by removing answer phrases from context so models must infer rather than copy, illustrating “deletion lineage” to prevent leakage of answers.  
- Zeng et al. (2026-02). *Exploring Knowledge Purification in Multi-Teacher KD* (arXiv 2602.01064). Studies routing/distillation from multiple teachers. Defines **Knowledge Purification**, which consolidates multiple teacher rationales into one to mitigate conflicts. Demonstrates a distilled student can even outperform the average of multiple teachers.  
- Gupta et al. (2026-01). *Small Language Models (SLMs) Survey* (arXiv 2501.05465). Surveys 1M–9B models across tasks. Key insight: “task-specific SLMs consistently outperform larger general-purpose models in their specialized domains”, motivating narrow experts.  
- Kim (2025-08-04). *Vocabulary Trimming for SLM Acceleration* (SqueezeBits blog). Reports that for 0.5–2B models, the embedding layer can be ~25–30% of total parameters. Demonstrates that removing unused vocabulary (“dead tokens”) drastically reduces model size and inference cost without loss of quality.  

Each source is cited above with direct quotes or paraphrases. All dates are as published or arXiv upload. 

