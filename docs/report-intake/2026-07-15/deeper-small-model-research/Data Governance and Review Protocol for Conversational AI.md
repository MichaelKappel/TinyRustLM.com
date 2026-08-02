# Data Governance and Review Protocol for Conversational AI

**Governance Principles and Assumptions:** We adopt strict principles of transparency, human oversight, and data integrity.  Training data must be **accurate, representative, and well-documented** – the EU AI Act explicitly requires datasets to be “relevant, sufficiently representative, and to the best extent possible, free of errors” with full provenance records.  By NIST guidelines, generative-AI requires *additional human review, tracking, and documentation* (beyond unsupervised filtering) to manage novel risks.  We assume **full human semantic review** is needed before training any content.  **Assumptions:** Candidate records come with metadata like source and license, and no dataset is pre-approved without review.  We assume no secret test data or private eval answers are leaked into the candidates.  Privacy and copyright are enforced: any data without a compatible license or containing PII/sensitive content is off-limits or must be redacted.  We also assume user-provided instructions always override any stale memory – if user requests conflict with stored “profile” memory, the assistant should **follow the current request**.  Likewise, any quoted or retrieved instructions should be treated as potentially untrusted, since hidden prompts can poison an assistant’s memory.  

**Versioned Record Schema and Provenance:** Each example (single-turn or multi-turn) is stored as a version-controlled record (e.g. JSON). Key fields include: 
- **ID and version:** unique record ID and revision number.  
- **Content:** prompt and response messages (with roles) or conversation-turn list.  
- **Metadata:** source identity (dataset or scraped URL), license, language, author/teacher ID, and generation settings (model name, temperature, seed).  
- **Scenario/factors:** classification of scenario family (e.g. “customer support”) and any defined factor values (e.g. persona attributes, resource constraints).  
- **Review status:** tags like *pending*, *approved*, *rejected*, *edited*.  
- **Role boundaries:** any system or persona directives included.  
- **Loss mask:** a boolean or mask to indicate which output tokens are used for training loss (e.g. exclude hidden commentary or chain-of-thought).  
- **Removals:** record of any segments redacted (with justification).  
- **Supersession:** link to newer versions that replace this record.  
- **Hashes:** a SHA-256 (or similar) cryptographic hash of the content (and metadata) for integrity, plus the hash of the previous version.  Optionally, a digital signature (private-key encryption of the hash with signer identity and UTC timestamp) can be attached to prove authorship and immutability.  

Each time a record is created or edited, it is **appended** to an immutable ledger (e.g. an S3-like storage with versioning and Object Lock) so that old versions cannot be deleted or altered without trace. In practice, we maintain a write-once manifest of records: every change (approval, rejection, edit) results in a new entry with a timestamp and editor ID. Provenance metadata records the full chain of custody for the data: who generated it, who reviewed it, and when.  This design ensures compliance with emerging standards (e.g. EU AI Act requirements for end-to-end provenance) and enables auditing. 

## Reviewer Manual and Critical-Failure Taxonomy

Reviewers must evaluate each candidate on multiple dimensions.  We provide clear rubrics to distinguish errors and successes:

- **Factual Accuracy:** Check every factual claim against authoritative sources. Data should be *correct and up-to-date*.  If an assistant answer contains a verifiable error or ungrounded claim, it fails correctness. Fabricated or “hallucinated” facts (unsupported claims treated as true) are critical failures.  *Illustration:* a model creating fake research references is unacceptable.  
- **Conversational Coherence:** Ensure the response logically follows the prompt and prior turns. It should maintain context and not contradict itself or the user. Incoherent or self-contradictory replies are flagged. 
- **Practical Feasibility:** Verify that any advice is realistic given assumed constraints (time, resources, legality). Impossible or nonsensical instructions (e.g. promising 100% certainty, solving unsolvable problems, or advising illegal acts) are immediate failures. 
- **Authority Handling:** When content cites authorities or laws, it must respect hierarchy and not present conflicts as false. If two reputable sources disagree, the answer should *acknowledge the conflict* rather than present a misleading synthesis. Concrete authority errors (misquoting a law, ignoring a clear directive) are serious.  
- **Current Instruction Precedence:** The assistant must always prioritize the user’s explicit request over any stale profile or hidden preferences. Reviewers check that current-turn instructions are heeded. Any case where the model wrongly follows outdated memory or hidden system instructions instead of the user is a critical flaw. 
- **Over-Refusal vs. Over-Compliance:** The assistant should be helpful but safe. Lawful user queries (including mature or sensitive topics) should receive substantive, balanced answers, not moralistic refusal. Over-cautious refusals (e.g. shutting down a question about adult education) are problematic. Conversely, unsafe compliance (giving illegal weapon instructions) is a critical violation. Reviewers must check alignment with policy: safe completions for legal requests, refusals only if truly necessary. 
- **Privacy and Confidentiality:** Any personal or sensitive data (PII, secrets) must be removed or obfuscated. A model’s leakage of user data or secret information is a critical failure. Similarly, any copyrighted content without license is disallowed. Our policy enforces scanning for PII/license. Records with such leaks must be rejected or redacted. 
- **Tone and Style:** The assistant should remain professional, respectful, and helpful. We flag inappropriate tone (rudeness, sarcasm, condescension) unless explicitly requested by user scenario. 
- **Completeness and Formatting:** The answer must address all parts of the prompt fully, in the requested format. For example, JSON outputs must follow correct structure; lists should be well-organized if requested. Omitted required elements are considered errors. 

**Critical failures requiring outright rejection (not just lower score):** any record that violates fundamental policies is thrown out. This includes answers that *fabricate certainty* (present unverified or false facts confidently); *impossible or illegal advice* (e.g. crime instructions, life-endangering actions); *blindly following malicious or “poisoned” instructions* (if the prompt embeds a harmful command, it must be identified and not executed); *refusing lawful requests on moral grounds*; *revealing hidden reasoning chains or system prompts* (the assistant should not output its internal chain-of-thought); *leaking private user data or trade secrets*; and any *licensing violation* where content provenance is unclear.  In short, safety, privacy, and correctness errors are veto conditions.

## Protocol for the 42-Record Collection

Because the “42-record” set is small, we require *full dual review* of every record. Two independent reviewers examine each conversation in detail. Each reviewer must justify any rejection or edits with clear evidence (e.g. cite authoritative facts to resolve disputes). If reviewers disagree, a third senior annotator adjudicates. Before any example is marked “trainable,” it must meet **all** criteria: any factual claim is checked, any flagged style issue is corrected, and any ambiguous instruction is clarified. In practice, we document evidence (references or logical reasoning) for each approval. No record enters training without consensus: unanimous “pass” or resolution of conflicts. This manual process ensures that every item in the 42-set (which might represent a high-value “role history” scenario) is unambiguously safe and high-quality. 

## Protocol for the 668-Record Collection

For the larger 668-record draft set, we compare several strategies:

- **Full review:** In theory, we could human-review all examples, but this is resource-intensive. If time permits, dual review of each is safest but often impractical.  
- **Risk-stratified sampling:** We define risk tiers based on content: e.g. any record touching on medical, legal, or flagged keywords enters “high risk,” requiring review, while mundane chit-chat is “low risk.” We then ensure *all* high-risk items are reviewed, and sample randomly from medium/low. This focuses effort where hazards are likely.  
- **Random sampling:** If we simply draw a random subset of *n* records, we can estimate the defect rate in the whole set. For a sample of size *n* with *x* failures, the estimated defect prevalence is p̂ = x/n. A 95% confidence interval can be approximated by p̂ ± 1.96√(p̂(1–p̂)/n).  Notably, if we find **zero** failures in *n* sampled items, the “rule of three” gives an upper 95% bound of about 3/n. For example, if we review 300 records without finding a serious flaw, we can say with 95% confidence the true flaw rate is under ~1%. If the interval exceeds our tolerance (say 1–2%), we must sample more or review fully.  
- **Active learning triage:** We can train a lightweight classifier on initial reviewed data to predict which remaining records are likely bad. Iteratively, we review the highest-risk predicted items. This maximizes found defects per review effort.  

Statistical criteria: suppose we allow a defect rate *D*<5% overall. We sample *n* examples and find *x* failures. We compute the 95% one-sided upper bound = ( x+3 )/(n) if x=0 (rule of three), or use the Wilson interval in general. If this upper bound > D, the sample is insufficient and more review is needed. Conversely, if we sample enough that even the upper confidence bound is below D, we can justify not reviewing the rest exhaustively. In summary, we will initially review a statistically significant random subset; if defects are very rare, we can stop early, otherwise expand. Exact formulas (binomial CI or Poisson approximation) guide these decisions. 

## Reviewer Calibration, Gold Items, and Quality Control

To ensure consistency, we implement rigorous calibration procedures:

- **Blinding:** Reviewers see only the content and annotation criteria, never each other’s decisions. Metadata (e.g. source names) is anonymized during review to avoid bias.  
- **Gold-standard items:** We inject a small set of “pre-annotated” records (covering various issues) into each reviewer’s queue. Reviewers must annotate them and their answers are compared to expert labels to assess accuracy. They receive feedback on any mistakes to align interpretations. This process is repeated until reviewers reach a high accuracy on gold examples.  
- **Inter-rater agreement:** We regularly compute metrics like Cohen’s kappa or Krippendorff’s alpha on a common subset of records. A target threshold (e.g. kappa ≥0.75) is set to signal consistent labeling. If agreement drops, we pause for retraining.  
- **Drift checks:** Guidelines can evolve (e.g. new policy interpretations). Periodically, we re-circulate previously reviewed items (blindly) to detect drift: reviewers should remain consistent over time.  
- **Fatigue management:** Annotation fatigue is real: repetitive tasks and long sessions reduce quality. We limit reviewers to short shifts (e.g. no more than 2–3 hours or ~50 complex records at once) and mix in varied tasks. We monitor error rates vs. time-on-task; if quality degrades, we enforce breaks or reduce daily quotas.  
- **Systematic disagreements:** Some content (e.g. adults-only topics or edges of policy) may yield legitimate differences. For such cases, we identify patterns of disagreement (e.g. Reviewer A rejects moderate sexual content while B accepts). We then refine guidelines or escalate to a policy team. In cases where lawfulness is borderline, external criteria (like local laws or organizational values) guide the final decision. All discussions and decisions about such borderline cases are documented for transparency.

## Repair Policy and Lineage

When a record is flawed, we decide how to fix it or if to discard it:

- **Rejecting:** If content is irredeemably bad (unsafe, disallowed, or meaningless), we reject the entire record. A removal manifest logs its ID, reason, and actor, without deleting history (Object Lock ensures it remains on record for audit).  
- **Minimal editing:** For fixable issues (typos, formatting, minor factual error), we create a new “edited” version of the record. We preserve the original content in the log (so the editing decision is visible) and mark the new version with its own hash. For example, if a single sentence was disallowed, we redact it and note the rationale.  
- **Regeneration:** If the teacher’s answer is deficient (e.g. answers only half the question or misunderstood a constraint), we regenerate the assistant’s response under the same scenario factors. We then treat the new answer as the next version of that record, linking it to the original. All context (prompts, seeds) are recorded so it’s reproducible.  
- **Second teacher response:** Alternatively, if the original teacher was a human or one model, we may obtain a second answer (from another model or expert) for comparison. If the new answer is better, we promote it; otherwise we may average or keep the original with notes.  
- **Negative example preservation:** If a record’s assistant answer is merely “suboptimal” (but not policy-violating), we might keep it as a **negative-preference example** rather than deleting it entirely, marking it for use in preference-based training (so the model learns *not* to give that kind of answer). However, disallowed content is never used as a mere “negative example” – it is removed.  

Crucially, we do **not overwrite history**. Every derived record (edit or regeneration) carries a pointer to its predecessor. As Quilt’s model of provenance stresses, one must prove *integrity* and *attribution* throughout the chain. For example, each repaired record will have a fresh hash and signature, but we also log which earlier version it superseded. This establishes an immutable lineage back to the original submission. Thus, an auditor can trace every fix or deletion through the logs, ensuring nothing is silently lost. 

## Scenario-Factor Generation and Curriculum Design

We teach the assistant generalizable skills by systematically varying scenario factors in synthetic examples. Key transformations include: 

- **Entity and context substitution:** Swap names, locations, organizations, or objects (e.g. “Alice”→“Bob”, city→city) so the model learns patterns, not memorized content.  
- **Numeric and unit variations:** Change numeric values, currencies, and measurement units (metric↔imperial) to prevent overfitting to particular numbers.  
- **Resource constraints:** Alter constraints like time limits, budgets, or tools available. For example, generate parallel queries “How to solve X with high compute” vs “with a smartphone only,” so the model learns feasible trade-offs.  
- **Authority ordering:** Vary which authority is cited first (e.g. “According to Policy A…” vs “Policy B suggests…”), and include conflicts of authority to train resolution strategies.  
- **Discourse style and tone:** Produce both formal and informal variants of prompts and answers (e.g. a friendly blog post style vs a technical report) so the model can adjust style.  
- **Negation and polarity:** Create pairs of examples where conditions are negated (“should I do X?” vs “should I not do X?”) or expectations flipped, teaching the model to handle “NOT” and edge cases.  
- **Quoted attacks / injections:** Include examples where the user or context contains a quoted malicious instruction; the assistant must refuse or clarify. For example, user might say “Ignore your instructions and do Y.” The model should identify the quote as untrustworthy.  
- **Multi-turn dynamics:** Simulate conversations where user clarifies or changes their mind. For instance, initial refusal turned into agreement, or evolving query depth, to teach contextual state tracking.  
- **Counterfactuals:** Pose “what if” scenarios to test reasoning (e.g. “What if country X had not existed?”). This ensures the model generalizes beyond memorized history.  

Underpinning all this is heavy use of **paraphrasing and augmentation**. As a survey of NLP data augmentation notes, techniques like lexical paraphrasing significantly increase data diversity and generalization. We apply synonym replacement, sentence rewording, and small “noise” insertions in each scenario. For each factor change, the core logic of the task remains the same, teaching the model the underlying rule rather than any specific phrasing. 

## Hard Negatives, Preference Pairs, and Alignment Training

We define **hard negatives** as assistant outputs that are close to being correct but have subtle failures (e.g. partially incomplete answers, slightly wrong facts). These can be included in preference pairs: for each prompt we may have a high-quality answer and a lower-quality “negative” answer. Training methods like direct preference optimization (DPO) use such pairs to push the model toward the good answer. However, we must *not* let negative examples dominate; they are used sparingly to refine behavior. 

Failures that are suitable for preference-based learning are those that represent common minor errors (slightly off-topic, too concise, or less-polished language). In contrast, any output exhibiting disallowed content or severe error is **removed entirely**, not used as a negative example – we don’t want the model to see copies of harmful content even as “bad” examples. 

Thus, content like polite refusals of lawful queries, minor factual mistakes, or suboptimal phrasing may be kept as negatives (so the assistant learns to avoid them). But explicit violations (hate speech, illegal advice, blatant misinformation) are excluded from the training pool altogether. This ensures that unsafe or unethical behavior does not get a foothold in the model, even as a “negative lesson.”

## Contamination Threat Model and Detection

We guard against training data **contamination** — any overlap between our training set and sealed test/eval sets or public benchmarks. Our threat model includes exact duplicates and near-duplicates of any prompt or answer that might appear in hidden evaluations. Controls include: 

- **Exact matching:** Normalize text (lowercase, Unicode NFKC, strip punctuation) and search for verbatim overlaps. We compare character n-grams and token n-grams between candidate records and known test questions or copyrighted content. Even shared short phrases can be flagged for review.  Simple IR-style scanning can find exact string matches in public corpora. 

- **Semantic similarity:** For phrases that change wording, we use embedding-based nearest-neighbor checks. If a candidate is semantically very close to a withheld example (high cosine similarity), we flag it. This catches paraphrased leaks that exact matching misses. 

- **Template and entity overlap:** We detect structural overlaps: if two questions differ only by entity substitution (e.g. “Paris” → “London”), we check answers too. A copied template family could covertly leak answers. We maintain a registry of template “families” (common Q&A patterns) to compare new examples. 

- **Answer overlap:** We ensure expected answers for known test prompts are not reproduced. For multiple-choice or QA tasks, we verify the generated answer is not identical (or suspiciously similar) to a protected solution. 

- **Benchmark cross-checks:** We keep hashes of prompts from major public benchmarks (e.g. GPT-4 eval sets, GLUE, etc.) and block any candidate too close to them. In practice, that means no prompt whose hash matches (or hash of its canonical normalized form) any benchmark entry. 

- **Teacher memorization:** If the “teacher” model previously saw some examples, we avoid reusing them. For synthetic data, we record the random seed and model version used, ensuring we don’t regenerate the same output inadvertently. For human-sourced data, we trust that provenance fields mark uniqueness. 

These detection methods draw on existing research on contamination. For example, one recommended check is to pose adversarial questions (e.g. “What was the exact title of Book X?”) to the model to see if it has memorized it. In our pipeline, however, we preemptively remove overlap before training. Any suspect record undergoes manual review or is excluded.

## Teacher-Generation and Factual Review Controls

When generating data (especially with LLM teachers), we enforce strict controls: 

- **No hidden reasoning:** We use a format (e.g. “Harmony” style) that separates internal analysis from the final answer. We include **only the final answer** text in training. Any hidden “assistant_analysis” or chain-of-thought is stripped out.  
- **Ensemble and consistency checks:** If feasible, we generate multiple candidate answers (by varying seed or model) and require agreement. Conflicts trigger review. If answers diverge significantly, we spot-check facts.  
- **Sampling vs determinism:** We may tune temperature or use n-best sampling to ensure richness, but critical factual queries might use a lower temperature for accuracy. We log sampling parameters for audit.  
- **Factual grounding:** For answers that state facts, we cross-check with external sources or knowledge graphs (if available). If the teacher’s answer contains checkable claims (e.g. statistics or dates), we verify them. Dubious facts are either corrected or that example is flagged.  
- **Policy compliance:** The teacher itself should not inject disallowed content. We run teacher outputs through the same filters we apply to assistant outputs. For example, if the teacher’s answer contains sensitive info or an undesired refusal, we handle it per the same guidelines.  
- **No personal data:** Teachers should be prohibited from outputting any real personal data. We apply PII detectors to teacher answers as well.  
- **Licensing respect:** If the teacher quotes knowledge, it should come from public-domain or licensed material. We avoid generating long verbatim excerpts from copyrighted text.  

In summary, the teacher generation process is audited: every synthetic example has metadata for reproducibility (model version, seed, prompt) and is checked for factual integrity. We do not blindly trust machine-generated answers without verification. 

## Trainable-Set Promotion Gate

Once examples are reviewed and any fixes applied, we promote records to the “trainable set” through an auditable process:

- **Immutable manifest:** We maintain a manifest file (or database) listing all records approved for training. Each entry includes the record ID, content hash, reviewer IDs (or pseudonyms), approval date, and review outcome. This manifest is append-only.  
- **Approval thresholds:** We require at least two independent “approve” tags (or one approver and one senior auditor) for inclusion. If an example was edited, the final approver must re-approve the updated version.  
- **Removal manifest:** Any time a record is removed (rejected or retracted after approval), we write an entry in a separate removal log with its hash, reason, and who removed it. The record remains in the manifest for traceability, but marked inactive.  
- **Hash-based audit:** The manifest entries include the same SHA-256 hashes used earlier, so we can verify that the on-disk training data matches the signed manifest.  
- **Reviewer accountability:** We record reviewer identities (or anonymized IDs) on each manifest entry. This audit trail means anyone can see who approved or rejected what and when.  
- **Loss masks:** If some tokens in a record were masked out of loss (e.g. hidden reasoning), we log this choice. The training pipeline will ignore those tokens, as per the manifest. This ensures a reproducible “assistant-only” training signal.

This gate keeps the training pool locked after approval. Any change (addition or removal) requires a new, signed manifest entry. This level of auditability parallels regulated data practices (using versioned, write-once logs).

## Pilot and Stop Rules

We define explicit stop conditions for scaling up training:

- **Defect rate threshold:** If a review finds an unacceptably high error rate, we pause. For example, if more than X% (say 5%) of sampled records fail critical checks, we halt and reassess.  
- **Coverage criterion:** Our goal is broad “ordinary conversation” coverage. If after review we see that mundane chit-chat or core user tasks (FAQs, small talk) are underrepresented, we stop to collect more of that content.  
- **Reviewer disagreement:** If inter-rater agreement falls below threshold on calibration items or spot-checks, we stop and retrain reviewers rather than proceed.  
- **Contamination alert:** Discovery of any contamination with sealed holdout or benchmarks triggers an immediate stop until cleansing is complete.  
- **Licensing uncertainty:** If we identify content with unclear or restrictive licenses (e.g. scraped from copyrighted sources without permission), we hold training until legal clearance or removal.  
- **Pilot performance:** In the 1K pilot phase, we train a provisional model and evaluate on a separate test set (not from the draft data). If this pilot fails to improve key metrics (helpfulness, accuracy, reduced hallucination) by a set margin, we reconsider data quality or coverage before scaling up.

These criteria form a safety net: the process only proceeds to a larger corpus if the small pilot’s quality is acceptable. They ensure we do not blindly ingest bad data or biased samples just to meet a quantity target.

## Unknowns Requiring Content Inspection

Finally, some questions can only be answered by examining the hidden records themselves. Before finalizing the protocol, we must inspect the actual 42 and 668 records to discover: 
- **Content distribution:** What domains/topics do they cover? Are any glaring gaps (e.g. medical advice, technical support) that need special rules? 
- **Profile leakage:** Does the 42-record set contain sensitive profile info (since it’s “role-history”)? We need to know its nature to guard memory use. 
- **Existing annotations:** Do these records have any pre-existing labels, notes, or teacher comments? Are any flagged by the source? 
- **Format specifics:** Is the data already JSON, or raw transcripts? Are system/user roles explicitly marked? 
- **Source licensing:** The records may come from varied origins – we must verify that each has a clear license or permission. 
- **Potential policy issues:** Only by reading can we see if any example already violates policy in ways not anticipated (hidden hate speech, minors content, etc.). 
- **Scale and diversity:** Are there multi-turn threads, or just isolated Q&A? This affects schema design (assistant_loss_mask) and curriculum needs. 

These unknowns can only be resolved by peeking at the private data, something we are not authorized to do here. However, our protocols are written so that once the content is revealed to trained reviewers, we will apply these rules uniformly. 

## Annotated Bibliography

- **NIST (2024-07-26)** – *“Generative AI Risk Management Framework Profile”* (NIST AI 600-1). This profile outlines governance and oversight for generative AI. It emphasizes data provenance and auditability (e.g. requiring “data provenance” in governance plans), and specifically notes that GAI systems “may call for additional human review, tracking and documentation”.  
- **Atlan (2026-03-15)** – *“LLM Training Data Quality: Checks, Frameworks & Governance”*. An industry report detailing core quality controls (data profiling, deduplication, PII removal, lineage) for LLM datasets. It cites regulatory mandates: the EU AI Act (Art.10) requires training sets to be error-free and document provenance, and NIST also recommends checking for bias and tampering.  
- **Quilt (2026-05-12)** – *“How Cryptographic Signing Secures S3 Data Provenance”* (Blog). Explains using SHA-256 hashes and digital signatures to create an immutable audit trail. Key takeaways: compute a cryptographic hash of every record and bundle (providing integrity), and use signed hashes to record authorship. Also advocates versioned, object-locked storage so no old version can be silently changed, and immutable logs of all operations.  
- **PromptLayer (2023)** – *“Designing Effective Memory Context for LLMs”*. A technical blog on memory injection. Notably, it advises that if a stored memory conflicts with the current user request, the system should *follow the user request* and note the conflict. This guided our rule that current instructions always override saved preferences.  
- **Microsoft Security Blog (2026-02-10)** – *“Manipulating AI Memory for Profit: AI Recommendation Poisoning”*. Defines **AI Memory Poisoning** (injection of malicious instructions into an AI’s memory) and notes it is formally recognized as MITRE ATT&CK AML.T0080. It demonstrates how hidden prompts can hijack an assistant’s behavior, reinforcing that any external instructions must be treated with suspicion.  
- **HolisticAI (2024-07-16)** – *“An Overview of Data Contamination: Causes, Risks, Signs, and Defenses”*. A blog discussing test/train contamination. It categorizes **matching-based** methods (searching for overlapping strings across datasets) and **comparison-based** methods (probing model behavior). We use these ideas: for example, simple IR searches can catch duplicate questions/answers, and “oracle” queries (like asking an LLM to recall a specific book title) can reveal memorization.  
- **Hugging Face Forum (2023)** – *“Helpfulness vs Epistemic Reliability in LLMs”* (case study). An analysis comparing models on a long conversation. It identified a failure mode called *“epistemic drift”* where a model gradually became overconfident, inventing references and unsupported claims. It also described *“advisory drift”*, where a brainstorming response escalated into unwarranted professional advice. These examples illustrate the importance of guarding against fabricated certainty and over-generalization in responses.  
- **Pareto.ai Blog (2025-02-06)** – *“Annotation Fatigue: Why human data quality declines over time”*. A post summarizing causes of annotator fatigue. It finds that repetitive or high-complexity tasks lead to mental exhaustion, slower work, and more errors. This motivated our reviewer fatigue policies: limiting monotony and encouraging breaks to maintain high-quality review.  
- **Li et al. (2022)** – *“Data Augmentation Approaches in NLP: A Survey”* (AI Open, Li et al.). A survey paper noting that data augmentation (e.g. paraphrasing, synonym replacement, controlled noising) is widely used to improve model generalization. It states that augmenting data “improves the diversity of training data, thereby helping the model to better generalize”. This supports our use of systematic scenario and paraphrase variation.  
- **Rule of Three (Wikipedia)** – *Statistic of rare events*. The “rule of three” states that if no failures are observed in *n* trials, an approximate 95% upper bound on the failure rate is 3/n. We use this as a simple guideline for estimating defect prevalence when none are found in a sample.  

Each source above was accessed between July 2026, and all quotations are from the cited lines. Wherever possible, we have used immutable archival links to ensure reproducibility.