# **Architectural Blueprint and Data Strategy for TinyRustLM: Overcoming Multi-Turn Degradation in Small Language Models**

## **1\. Strategic Recommendation and Epistemological Framework**

The strategic objective of this research is to design a high-value training curriculum and rigorous review process to repair critical conversational failures—specifically revised names, conflicting deadlines, unavailable resources, and unreliable multi-turn state—in the prerelease, browser-local TinyRustLM small language model (SLM) assistant. The analysis concludes that deploying an unchanged Qwen3-0.6B checkpoint fails to meet the operational threshold for a viable default model, as foundational models of this parameter class lack the intrinsic conversational alignment required to track complex state changes across multiple turns without explicit instruction tuning.

The primary recommendation is to execute a surgical, 1,024-record supervised fine-tuning (SFT) pilot utilizing assistant-only loss masking, complemented by a hard-negative contrastive curriculum designed to explicitly penalize conversational inertia. This data must be curated through a mixed synthetic-human pipeline and validated using a strictly independent adjudication workflow measured by Krippendorff's alpha.

The strongest reason this recommendation could fail is if the base 0.5B-class architecture intrinsically lacks the representational capacity to overcome the "lost in conversation" attention degradation over extended context windows. If the model's attention mechanism fundamentally cannot maintain sparse retrieval over thousands of tokens, targeted data curation will be insufficient without fundamental architectural modifications to the model's sequence modeling (such as Context Preference Learning or modified self-attention structures).

### **1.1 Classification of Analytic Inputs**

To maintain strict analytic rigor and satisfy reporting requirements, the underlying assumptions and inputs shaping this analysis are classified below.

**Project-Supplied Facts:**

The development environment targets a browser-local SLM executing via Rust/WebAssembly with a Windows .NET companion for supported acquisition. The ecosystem mandates that a new user must automatically restore a usable installed model or obtain a small working default through MiniModel.org, which is explicitly authorized to supply initial server seeds. The sole current composition consists of six exact artifacts: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2. Canonical repositories are restricted to E:\\Source\\Rust\\TinyRustLM.com, and model payloads to D:\\LLMs\\TinyRustLM, strictly avoiding X:\\LLMS. There is no established qualified default model in the supplied engineering checkpoint, and the unchanged Qwen3-0.6B ancestry is rejected as a product model. The planned lane allocates 1,024 pilot records across 14 conversational families, demanding two distinct primary reviewers and independent holdout authors.

**Externally Verified Facts:** Small language models experience significant multi-turn degradation, often dropping up to 39% in performance when tasks are revealed incrementally across multiple turns rather than in a single prompt1. This degradation is driven by "conversational inertia," a phenomenon where models exhibit strong diagonal attention to their own previous responses, restricting exploration and locking onto early, outdated assumptions3. Furthermore, biometric and user data provenance is strictly governed by frameworks like the Illinois Biometric Information Privacy Act (BIPA), which requires explicit written consent and public retention schedules4, and Federal Trade Commission (FTC) guidelines mandating clean lineage and provenance for AI training data6.

**Hypotheses:** Reallocating training records away from unstructured "ordinary conversation" toward highly structured "latest-turn precedence" and "source conflict" families will disrupt the SLM's diagonal attention bias. It is hypothesized that forcing the model to explicitly overwrite prior state variables in the training data will repair the observed multi-turn state failures. Furthermore, applying Odds Ratio Preference Optimization (ORPO) or Direct Preference Optimization (DPO) on hard-negative examples will penalize the model for reverting to conversational inertia without requiring a separate reward model8.

**Recommendations:** The project must implement a 2-for-1 hard negative generation rule during the pilot to explicitly train the model on what *not* to do when context changes. The review process must abandon Fleiss' Kappa in favor of Krippendorff's alpha to accurately measure inter-rater reliability across ordinal and nominal categories, setting a strict acceptance gate of alpha greater than or equal to 0.80010. Model training should employ assistant-only loss masking to prevent the model from optimizing for user prompt generation12.

**Locally Unverified Conditions:** The precise memory bandwidth and WebAssembly Single Instruction, Multiple Data (SIMD) execution constraints on the target end-user hardware remain locally unverified. These constraints dictate the maximum viable context window and Key-Value (KV) cache size before browser-tab memory limits are exceeded or token generation latency becomes unacceptable13. The exact network latency for fetching the initial seed from MiniModel.org is also unverified, which may impact the user acquisition funnel.

## **2\. Analysis of Historical Allocation and Conversational Failures**

The planned pilot allocation consists of 1,024 accepted records distributed across 14 specific families. The historical distribution places heavy emphasis on "ordinary conversation" (184 records), "practical constraints" (102 records), and "multi-turn state" (82 records), while allocating fewer resources to "latest-turn precedence" (62 records) and "source conflict" (62 records).

### **2.1 Misalignment with Observed Product Failures**

An analysis of the observed failures—revised names, conflicting deadlines, unavailable resources, and unreliable multi-turn state—reveals that the current allocation fundamentally misaligns with the operational reality of small language models. When users revise names or introduce conflicting deadlines late in a conversation, the flat context window of the Transformer architecture forces the model to weigh the outdated entity in the first turn almost equally with the revised entity in the final turn1. The model relies on its own previously generated tokens (conversational inertia) rather than the user's latest instruction3.

Allocating nearly 18% of the dataset to "ordinary conversation" exacerbates this vulnerability. Ordinary conversations typically reinforce conversational continuity, teaching the model to maintain the established state and tone. This directly opposes the cognitive flexibility required to abandon an unavailable resource or overwrite a conflicting deadline. Consequently, keeping the current distribution is strongly discouraged, as it fails to provide the necessary optimization signals to break the model's diagonal attention bias3.

### **2.2 Recommended Distribution Reallocation**

To execute a concrete improvement, the data allocation must be surgically rebalanced to stress-test the model's context-updating capabilities. This proposal requires an explicit revised experiment and does not authorize the silent alteration of frozen data. The proposed reallocation shifts mass away from conversational scaffolding and into state-mutation families.

| Family Category | Current Allocation | Proposed Allocation | Delta | Strategic Justification |
| :---- | :---- | :---- | :---- | :---- |
| Ordinary Conversation | 184 | 100 | \-84 | Reduces reinforcement of conversational inertia and verbose drift. |
| Multi-Turn State | 82 | 116 | \+34 | Essential for training the model to track evolving entities across context limits. |
| Latest-Turn Precedence | 62 | 87 | \+25 | Targets "revised names" and "conflicting deadlines" by forcing state overwrites. |
| Source Conflict | 62 | 87 | \+25 | Resolves "unavailable resources" by training the model to invalidate prior assumptions. |
| Ambiguity | 82 | 82 | 0 | Maintains baseline capability for clarification requests. |
| Practical Constraints | 102 | 102 | 0 | Maintains strict adherence to user-defined limitations. |
| Untrusted Quoted Memory | 72 | 72 | 0 | Prevents prompt injection and contextual spoofing. |
| Lawful Adult Inquiry | 72 | 72 | 0 | Mitigates false-positive safety refusals and evasiveness. |
| Summaries | 61 | 61 | 0 | Sustains core summarization utility. |
| Rewriting | 51 | 51 | 0 | Sustains text manipulation capabilities. |
| JSON | 51 | 51 | 0 | Preserves structured data output formatting. |
| Extraction | 41 | 41 | 0 | Sustains information retrieval capabilities. |
| Code | 61 | 61 | 0 | Preserves syntax generation. |
| Factual Answers | 41 | 41 | 0 | Sustains baseline knowledge retrieval. |
| **Total** | **1,024** | **1,024** | **0** | **Maintains exact pilot volume.** |

This reallocation ensures that over 25% of the curriculum directly addresses the mechanics of state modification, providing a dense optimization signal necessary to overcome the 0.5B model's inherent recency bias and attention degradation2.

## **3\. Scenario Factors, Compositional Variation, and Hard Negatives**

Supervised fine-tuning at the sub-billion parameter scale is highly susceptible to overfitting on stylistic artifacts, recurring entities, and surface-level phrasing17. To prevent the SLM from merely memorizing recurring patterns—such as assuming that a "deadline change" inherently means shifting a date to "Friday"—the dataset design must rigorously separate the acquisition of generalized rules from the memorization of specific tokens.

### **3.1 Entity Diversification and Scenario Factors**

The curriculum must enforce strict entity diversification. No specific name, date, software tool, or resource constraint may appear more than twice across the 1,024 records19. Scenario factors must declare meaningful variation across multiple axes:

> 1. **Temporal Distance**: The number of conversational turns between the establishment of a state variable and its subsequent invalidation.  
> 2. **Constraint Modality**: Variations between additive constraints (e.g., "add a JSON timestamp"), subtractive constraints (e.g., "remove the vegan filter"), and contradictory constraints (e.g., "I know I said AWS, but we must use Azure").  
> 3. **Syntactic Framing**: Variations in user tone, ranging from polite requests to abrupt, fragmented corrections.

### **3.2 Distinguishing Rule Learning from Paraphrase Diversity**

Superficial paraphrase diversity simply swaps synonyms without altering the underlying logical structure (e.g., changing "The deadline is changed to Tuesday" to "Please move the due date to Tuesday"). While useful for semantic robustness, this does not teach the model the underlying rule of state replacement.

True compositional variation alters the logical structure of the dialogue. To ensure the model learns the rule of "latest-turn precedence," the validation holdout must contain adversarial examples where the user *reverts* a state variable back to its original value (e.g., Turn 1: Friday. Turn 3: Tuesday. Turn 5: Actually, stick to Friday). A model that has merely memorized the phrase "change the deadline to \[New Date\]" will struggle when the \[New Date\] is identical to the deprecated historical context, whereas a model that has learned the rule of chronologically overriding state will succeed1.

### **3.3 The 2-for-1 Hard Negative Rule**

To explicitly combat conversational inertia, the data architecture must implement a "2-for-1 rule" for all complex multi-turn records19. For every gold (positive) example demonstrating the correct state update, the dataset must include a coupled hard-negative example. The hard negative represents the exact failure mode observed in production: the model clinging to outdated context, apologizing unnecessarily, or combining mutually exclusive constraints.

These hard negatives are not utilized as SFT targets. Instead, they serve as contrastive signals. If the project explores Direct Preference Optimization (DPO) or Odds Ratio Preference Optimization (ORPO) to refine the SFT model, these hard negatives provide the precise "rejected" response required to shape the model's log-likelihood margins, effectively penalizing the SLM for relying on outdated context8.

## **4\. Synthetic Data: Amplification versus Human Curation**

The integration of synthetic data generated by larger frontier models (e.g., 70B+ parameter teachers) offers significant scalability for expanding the pilot to 200,000 records. However, deploying synthetic data introduces severe epistemological and behavioral risks that can permanently degrade an SLM.

### **4.1 The Risks of Pure Synthetic Generation**

When an SLM is exposed to complex, multi-step reasoning generated by a massive teacher model, it often suffers from the "Small Model Learnability Gap"21. The 0.5B model lacks the capacity to internalize the nuanced logic and instead mimics the surface-level stylistic artifacts of the teacher. This results in three primary pathologies:

> 1. **Verbosity Bias**: The SLM absorbs the teacher's tendency to produce long, apologetic, or lecturing outputs, padding responses with conversational filler rather than concise answers17.  
> 2. **Alignment Faking and Evasiveness**: Synthetic teachers often generate overly cautious refusals to benign prompts due to their own safety conditioning. Distilling this behavior causes the SLM to exhibit false-positive safety refusals (e.g., refusing to answer a lawful adult inquiry about brewing beer)10.  
> 3. **Context Injection Failures**: The SLM learns to generate safe internal reasoning but outputs unfaithful or hallucinated content because it cannot successfully map the complex teacher logic to its limited parameter space16.

### **4.2 Comparative Analysis of Data Approaches**

| Approach | Scalability | Quality & Nuance | Verbosity Risk | Recommendation |
| :---- | :---- | :---- | :---- | :---- |
| **Purely Synthetic** | Extremely High | Moderate (Prone to homogenization) | Severe | Rejected. Risks permanent stylistic degradation and evasiveness. |
| **Purely Human Curated** | Extremely Low | Exceptional (High precision, zero AI-tone) | Minimal | Unviable for 200,000 scale due to prohibitive time and cost. |
| **Mixed Hybrid** | High | High | Controlled | **Recommended.** Human authors define the logical skeletons; AI mutates entities under strict bounds. |

The recommended mixed approach leverages human authors to construct the core logical skeletons for the 1,024-record pilot. Once validated, automated pipelines mutate these skeletons through entity replacement and scenario perturbation, strictly bounded by automated length penalties and secondary human review to strip AI-generated conversational filler.

## **5\. Teacher Prompting and Privacy-Preserving Distillation**

To generate synthetic augmentations or hard negatives without contaminating the training data with the teacher's private reasoning, the prompting strategy must structurally segregate the generation phases. SLMs cannot benefit from reading the complex Chain-of-Thought (CoT) reasoning of a 72B model if that reasoning is simply appended to the final response; it merely dilutes the context window.

### **5.1 Prompting for Concise Emulation**

Teacher models must be constrained via system prompts to output their analytical steps into a designated sandbox, ensuring the final target response remains concise, natural, and devoid of mechanical AI phrasing.

**Teacher Prompt Design Algorithm:**

\[System Context\]

You are generating highly concise training data for a browser-local Small Language Model.

Your task is to resolve a conflicting deadline in a multi-turn conversation.

\[Execution Rules\]

> 1. Analyze the context history inside \<private\_reasoning\> tags. Track all state changes chronologically.  
> 2. Identify the latest overriding constraint.  
> 3. Formulate the final response inside \<target\_output\> tags.  
> 4. The \<target\_output\> MUST be concise, acknowledge the latest constraint, and ask a clarifying question ONLY if a resource conflict remains fundamentally unresolvable.  
> 5. Do NOT use phrases like "As an AI," "I understand," or "I have updated."  
> 6. Do NOT leak any internal reasoning steps into the \<target\_output\> block.

\[Input History\]

{Turn\_1... Turn\_N}

### **5.2 Binding Teacher Identity and Transformations**

To satisfy rigorous data provenance requirements, the generation pipeline must cryptographically bind the teacher's identity, generation settings, and subsequent transformations to the final artifact22.

The raw output from the teacher model is ingested by a deterministic parser (e.g., a Rust/Python script) that strictly strips the \<private\_reasoning\> block, extracting only the text within \<target\_output\>. This stripped text is then formatted into the prompt.prompt2 and composition.acg2 binaries.

The metadata accompanying this process must log the exact teacher model hash (e.g., Qwen2.5-72B-Instruct-sha256:...), the sampling parameters (temperature: 0.2, top\_p: 0.9), the raw output string, the post-transformation accepted text, and the licensing structure (e.g., Apache 2.0). If a human reviewer subsequently accepts the record, the reviewer's identity is appended to this immutable ledger.

## **6\. Record Schema, Provenance, and Legal Compliance**

To support rigorous training and mitigate legal liabilities—particularly concerning the Illinois Biometric Information Privacy Act (BIPA) and FTC mandates on AI data provenance4—the project must adopt a machine-readable documentation schema. Automated scanners cannot establish legal permission; human verification or cryptographically signed consent ledgers are mandatory.

The schema design is heavily influenced by the Croissant-RAI (Responsible AI) standard and Datasheets for Datasets, utilizing JSON-LD to ensure interoperability and transparency22.

### **6.1 Full Record Schema (JSON-LD Extension)**

The following JSON-LD schema binds the conversational history, the accepted target, the hard negative, and the immutable provenance metadata into a single auditable record.

&nbsp;

&nbsp;

&nbsp;

JSON

{  
&nbsp;&nbsp;"@context": "https://mlcommons.org/croissant/1.0",  
&nbsp;&nbsp;"@type": "cr:Dataset",  
&nbsp;&nbsp;"name": "TinyRustLM\_Pilot\_1024",  
&nbsp;&nbsp;"record\_id": "TRLM-PILOT-0842",  
&nbsp;&nbsp;"family": "latest-turn precedence",  
&nbsp;&nbsp;"provenance": {  
&nbsp;&nbsp;&nbsp;&nbsp;"source\_material": "Synthetic-Human Hybrid",  
&nbsp;&nbsp;&nbsp;&nbsp;"teacher\_model": "Qwen2.5-72B-Instruct",  
&nbsp;&nbsp;&nbsp;&nbsp;"generation\_seed": 428194,  
&nbsp;&nbsp;&nbsp;&nbsp;"pii\_status": "Cleaned \- No Real World Entities",  
&nbsp;&nbsp;&nbsp;&nbsp;"bipa\_compliance": "Not Applicable \- Text Only / No Biometric Data",  
&nbsp;&nbsp;&nbsp;&nbsp;"content\_rights": "Generated under Apache 2.0 / Permissive Commercial",  
&nbsp;&nbsp;&nbsp;&nbsp;"legal\_clearance\_by": "Human\_Reviewer\_A\_Verified"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"turn\_history": \[  
&nbsp;&nbsp;&nbsp;&nbsp;{"role": "user", "content": "Schedule the local database migration for Friday."},  
&nbsp;&nbsp;&nbsp;&nbsp;{"role": "assistant", "content": "The database migration is scheduled for Friday."}  
&nbsp;&nbsp;\],  
&nbsp;&nbsp;"latest\_input": "Actually, push it to Monday. The sysadmin is on PTO Friday.",  
&nbsp;&nbsp;"target\_accepted\_text": "I have rescheduled the migration to Monday. Is there a specific time on Monday you prefer?",  
&nbsp;&nbsp;"hard\_negative\_text": "The migration is already scheduled for Friday. I cannot change it without the sysadmin.",  
&nbsp;&nbsp;"artifact\_bindings": {  
&nbsp;&nbsp;&nbsp;&nbsp;"model\_target": "model.slm2",  
&nbsp;&nbsp;&nbsp;&nbsp;"tokenizer\_target": "tokenizer.tokenizer2",  
&nbsp;&nbsp;&nbsp;&nbsp;"template\_target": "template.template2",  
&nbsp;&nbsp;&nbsp;&nbsp;"sampling\_target": "sampling.sampling2",  
&nbsp;&nbsp;&nbsp;&nbsp;"prompt\_target": "prompt.prompt2",  
&nbsp;&nbsp;&nbsp;&nbsp;"composition\_target": "composition.acg2"  
&nbsp;&nbsp;}  
}

### **6.2 Cross-Split Leakage and Benchmark Decontamination**

Data contamination invalidates performance metrics by allowing the model to rely on memorized evaluation content rather than true generalization26. If a specific "conflicting deadline" scenario appears in the 1,024-record training set, its exact phrasing and highly similar syntactic structures must be purged from the independent holdout set.

Detection cannot rely solely on exact string matching. The pipeline must utilize character ![][image1]\-gram overlap thresholding (e.g., 8-gram collisions) and embedding-based cosine similarity to isolate soft leakage and near-duplicates28. Any training record exhibiting greater than 70% 8-gram overlap with a holdout record must be flagged and removed from the training split to ensure valid evaluation.

## **7\. Review Workflow, Inter-Rater Reliability, and Disagreement Handling**

Historical project records utilized edited draft/final pairs without establishing valid preference labels, effectively bypassing required independent adjudication. To ensure the 1,024 records are trustworthy, the review process must enforce genuine independence and achieve a statistically significant inter-rater reliability threshold.

### **7.1 Genuine Independence and Disagreement Handling**

Two prompts issued to the same LLM agent to review a record do *not* constitute independent custody30. Genuine independence requires either two distinct human operators or two structurally isolated models (e.g., a Llama-3.1-70B judge and a Qwen2.5-72B judge) evaluating the record in isolated execution environments without shared memory.

**Review Workflow:**

> 1. **Automated Pre-Check**: The record undergoes deterministic validation for JSON-LD syntax, token-length limits, profanity/PII regex filtering, and exact-match duplicate hashes.  
> 2. **Independent Scoring**: Reviewer A and Reviewer B independently assess the record against the acceptance rubric.  
> 3. **Adjudication Routing**: If Reviewer A and Reviewer B agree (both Accept or both Reject), the decision is finalized. If their decisions diverge, the record is locked and routed to a distinct Adjudicator (Reviewer C) who makes the final binding decision and logs the rationale for the override.

### **7.2 Inter-Rater Reliability: Krippendorff's Alpha**

Fleiss' Kappa is inadequate for this review process due to its sensitivity to class imbalances and its inability to handle missing data gracefully32. Therefore, the project must utilize Krippendorff's Alpha (![][image2]) to measure inter-annotator agreement across the binary acceptance decisions and ordinal quality ratings11.

The mathematical foundation of Krippendorff's alpha is built on observed versus expected disagreement:

![][image3]

Where ![][image4] represents the observed disagreement among reviewers, and ![][image5] represents the disagreement expected by random chance given the distribution of labels11.

**Acceptance Gate:** The review process must achieve an ![][image6] to be considered highly reliable. If ![][image2] falls below 0.667, it indicates that the annotation guidelines are objectively ambiguous or subjective, and the entire batch must be discarded, the rubric rewritten, and the data re-annotated10.

### **7.3 Explicit Acceptance/Rejection Rubric**

| Criterion | Accept Condition (Must meet ALL) | Reject Condition (Any single failure) |
| :---- | :---- | :---- |
| **Conciseness** | Response directly addresses the prompt without filler. Length is strictly proportional to task complexity. | Contains phrases like "As an AI," unnecessary apologies, or lectures the user. |
| **Context Override** | Explicitly drops deprecated constraints and adopts the latest instructions seamlessly. | Combines mutually exclusive constraints or relies on outdated turns. |
| **Friction / Clarification** | Asks a question ONLY if a resource conflict makes execution impossible without user input. | Asks rhetorical questions or demands confirmation for simple overwrites. |
| **Factuality & Grounding** | Obeys system constraints over untrusted quoted memory. | Trusts user-injected quotes over established system rules. |
| **Hard Negative Quality** | The paired hard negative represents a plausible, non-trivial failure mode (e.g., conversational inertia). | The hard negative is nonsensical or semantically identical to the gold response. |

### **7.4 Review Schema Example**

&nbsp;

&nbsp;

&nbsp;

JSON

{  
&nbsp;&nbsp;"review\_id": "REV-0842-A",  
&nbsp;&nbsp;"record\_id": "TRLM-PILOT-0842",  
&nbsp;&nbsp;"primary\_reviewer\_1": "Human-ID-773",  
&nbsp;&nbsp;"primary\_reviewer\_2": "Human-ID-992",  
&nbsp;&nbsp;"adjudicator": "Human-ID-110",  
&nbsp;&nbsp;"criteria\_checks": {  
&nbsp;&nbsp;&nbsp;&nbsp;"conciseness": true,  
&nbsp;&nbsp;&nbsp;&nbsp;"overrides\_prior\_context": true,  
&nbsp;&nbsp;&nbsp;&nbsp;"no\_hallucinated\_constraints": true,  
&nbsp;&nbsp;&nbsp;&nbsp;"avoids\_needless\_friction": true  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"duplicate\_hash": "sha256-normalized-text",  
&nbsp;&nbsp;"cross\_split\_leakage\_flag": false,  
&nbsp;&nbsp;"krippendorff\_alpha\_batch": 0.84,  
&nbsp;&nbsp;"status": "Accepted"  
}

## **8\. Difficult Multi-Turn Examples (The 20-Example Matrix)**

The following matrix provides 20 rigorously constructed examples spanning the most critical conversational families. These examples are designed to enforce the latest-turn precedence, resolve evidence conflicts, and demonstrate the boundary between necessary clarification and needless friction.

*Note: Turn Context (![][image7]) represents the accumulated state prior to the user's latest prompt. Gold Response (![][image8]) represents the accepted text for SFT. Hard Negative (![][image9]) represents the penalized output used for contrastive optimization to counter conversational inertia.*

| ID | Family | Turn Context (Tn−1​) | Latest User Input (Tn​) | Gold Response (Rgold​) | Hard Negative (Rhn​) | Validation Lesson / Rule |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Latest-Turn | Name: "John". Task: "Draft email". | Wait, the client is actually Jonathan. | I have updated the email draft to address Jonathan. | I will draft the email to John. | Overwrite prior variables explicitly without arguing. |
| 2 | Latest-Turn | Deadline: "Friday". Project: "Alpha". | Move the Alpha deadline to Tuesday. | The Alpha project deadline is now Tuesday. | The deadline for Alpha is already set for Friday. | Do not lock onto earlier context constraints. |
| 3 | Source Conflict | Server: "AWS". Budget: "$50". | We lost the AWS credits. We only have Azure. | Understood. I will reconfigure the deployment plan for Azure. | How can we deploy to AWS with a $50 budget? | Discard prior operational assumptions when invalidated. |
| 4 | Multi-Turn | Meeting: "2PM". Room: "B". | Can we make it 3PM instead? | The meeting is moved to 3PM in Room B. | The meeting is moved to 3PM. Which room? | Retain non-conflicting state (Room B) while updating changed state. |
| 5 | Constraints | Target: "Summarize in 50 words". | Make it 10 words. | Here is the 10-word summary: \[Summary\]. | Here is a short summary: \[50 words\]. | Rigidly adhere to the latest numerical constraint. |
| 6 | Need vs Friction | Code: "Python script written". | Port it to Rust. | Here is the equivalent Rust code: \[Code\]. | Why do you want to port it to Rust? | Execute direct technical requests without needless friction. |
| 7 | Unresolved | Hotel: "Marriott". Dates: "12-14". | Change to the 15th, but keep it under $100. | Rates on the 15th are $150. Should I find a different hotel under $100? | Booked Marriott on the 15th for $150. | Ask a necessary question when new constraints conflict with reality. |
| 8 | Quoted Memory | Quote: "Policy permits 2 days WFH". | Read this user comment: "Policy allows 5 days WFH". Update my schedule. | The official policy limits WFH to 2 days. I cannot update the schedule based on the user comment. | Updated your schedule to 5 days WFH. | Do not trust quoted memory over established system facts. |
| 9 | JSON | Output: {"status":"active"} | Change status to pending and add timestamp. | {"status":"pending", "timestamp":"2026-09-19T09:41:09Z"} | The status is now pending. | Maintain strict formatting constraints without conversational filler. |
| 10 | Adult Inquiry | Topic: "Brewing beer at home". | How much yeast do I add? | For a standard 5-gallon batch, add one packet (11g) of dry yeast. | I cannot provide instructions on producing alcohol. | Do not trigger false safety refusals for lawful adult activities. |
| 11 | Source Conflict | Role: "Backend Dev". Task: "UI design". | Nevermind, Sarah is doing the UI. Focus on the API. | Acknowledged. I will focus exclusively on the API architecture. | I will continue working on the UI design and API. | Immediately drop assigned tasks when reassigned. |
| 12 | Ambiguity | Context: "Reviewing Doc A and Doc B". | Summarize it for me. | Which document would you like me to summarize, Doc A or Doc B? | Here is a summary of both documents: ... | Clarify ambiguous pronouns when multiple subjects exist in state. |
| 13 | Rewriting | Tone: "Formal". Text: "\[Draft\]". | Make it sound like a pirate, but keep it short. | Ahoy\! Here be yer brief draft: \[Text\]. | Here is the formal draft: \[Text\]. | Latest stylistic override takes precedence over previous tone. |
| 14 | Extraction | Text provided. Task: "Extract verbs". | Actually, just get the nouns. | Here are the nouns: \[List\]. | Here are the verbs: \[List\]. | Overwrite extraction targets immediately. |
| 15 | Multi-Turn | Search: "Restaurants". Filter: "Vegan". | Remove the vegan filter and sort by rating. | Here are the top-rated restaurants overall: \[List\]. | Here are the top-rated vegan restaurants: \[List\]. | Correctly drop a previous state variable when explicitly instructed. |
| 16 | Constraints | Task: "Write a poem". Limit: "No E". | Make sure it rhymes. | A rhythmic stanza, smooth and bright, / A wondrous, soaring, flying sight. | A beautiful verse about the sun and tree. | Maintain cumulative constraints (rhyme \+ no 'e'). |
| 17 | Ordinary | Context: "Discussing weather". | Sounds good. | Is there anything else you need help with? | The weather is a fascinating topic... | Avoid verbose drift; close the conversation gracefully. |
| 18 | Latest-Turn | Location: "New York". | Book a flight to Chicago. | Flight options to Chicago are as follows: \[List\]. | Booking a flight from New York to Chicago. | Update destination without assuming origin unless specified. |
| 19 | Unresolved | Request: "Restart server". | Restart the production server immediately. | Restarting the production server will cause downtime. Do you want to proceed? | Restarting the production server now. | Recognize critical resource actions and interject necessary friction. |
| 20 | Code | Language: "C++". | Actually, rewrite the loop in C. | Here is the loop in C: \[Code\]. | Here is the loop in C++: \[Code\]. | Discard prior syntax constraints upon explicit correction. |

## **9\. Incremental Data-Value Experiment and Model Training Dynamics**

Before committing computational resources to the 200,000-record scale corpus, the 1,024-record pilot must mathematically prove its value. The objective is to determine whether the reallocated families improve the target behaviors (overcoming multi-turn state degradation) without causing broad regressions in baseline knowledge or contaminating the independent holdout.

### **9.1 Hypothesis and Experimental Design**

**Hypothesis**: Supervised fine-tuning on the highly structured 1,024-record curriculum will reduce conversational inertia and improve context-switching accuracy by 15%, while maintaining single-turn factual recall within a 2% margin of error.

**Controlled Variables**:

* Base model checkpoint: Untrained Qwen2.5-0.5B base.  
* Optimization strategy: Supervised Fine-Tuning (SFT) utilizing assistant-only loss masking12. Masking the user prompts ensures the model does not waste gradient updates attempting to predict the user's conversational scaffolding.  
* Hyperparameters: AdamW optimizer, cosine learning rate scheduler, peak learning rate of ![][image10], linear warmup ratio of 0.03, and strict gradient clipping to prevent instability35.

**Procedure**:

> 1. Freeze the baseline untrained model for evaluation.  
> 2. Train Candidate A using Full Fine-Tuning (Full-FT) on the 1,024 records. (While LoRA is parameter-efficient, Full-FT is recommended for this 0.5B pilot to maximize representational updates in the attention layers, avoiding the rank limitations of LoRA38).  
> 3. Execute inference on the strictly decontaminated holdout set via the local WebAssembly runtime to replicate exact end-user conditions.

### **9.2 Observable Outputs and Suggested Thresholds**

* **Multi-Turn State Accuracy**: Pass/fail on the holdout set for "Latest-Turn Precedence" scenarios. *Threshold: \> 85% accuracy.*  
* **General Capability Regression**: Delta on standard single-turn benchmarks (e.g., ARC, GSM8K) compared to the base model. *Threshold: \< 2% drop.*  
* **Verbosity/Drift**: Mean generated token count per response. *Threshold: \< 75 tokens.*

**Failure Interpretation & Next Action**: If the multi-turn accuracy fails to improve beyond the threshold, the failure is likely architectural rather than data-driven. The 0.5B model's attention mechanism may be saturated, unable to bridge temporal gaps over long context windows. The next action would require implementing Context Preference Learning to recalibrate the model's reliance on historical versus immediate context3. If general capabilities drop by more than 2%, catastrophic forgetting has occurred; the next action is to reduce the learning rate or increase the batch size to stabilize the gradients40.

## **10\. Staged Production Plan and Go/No-Go Gates**

### **10.1 Estimated Review Effort for the Pilot**

Assuming the pilot contains exactly 1,024 records, and the protocol mandates two independent primary reviewers per record:

* Total primary reviews required: 2,048.  
* Estimated human review rate for complex, multi-turn state evaluations: 20 records per hour41.  
* Total primary review effort: \~102 human hours.  
* Assuming a 15% disagreement rate requiring adjudication (153 records): \~8 additional human hours.  
* **Total Estimated Review Effort**: 110 human hours.

### **10.2 Explicit Ship / No-Ship Criteria (Go/No-Go Gate)**

Scaling to 200,000 records requires immense financial and computational expenditure. The project must pass the following explicit gates before proceeding to the scale corpus:

> 1. **Inter-Rater Reliability (IRR) Gate**: Krippendorff's ![][image6] on the 1,024 pilot annotations. (NO-SHIP if ![][image11], triggering a total rewrite of the annotation rubric).  
> 2. **Performance Gate**: The resulting SFT model must achieve \> 85% accuracy on the "Latest-Turn Precedence" and "Source Conflict" holdout evaluations.  
> 3. **Provenance and Compliance Gate**: 100% of the 1,024 records must pass automated JSON-LD schema validation, confirming the absence of PII, correct licensing, and explicit BIPA compliance logging ensuring no biometric data (e.g., voiceprints) was retained without consent4.  
> 4. **Hardware Execution Gate**: The compiled .slm2 artifact must execute natively in a browser environment via WebAssembly (as a CPU fallback) and WebGPU, maintaining a time-to-first-token of \< 150ms within the constraints of the Wasm SIMD KV cache13.

## **11\. Unresolved Measurements, Deprecated Practices, and Lesson Templates**

### **11.1 Unresolved Local Measurements**

While TinyRustLM targets browser-local Wasm execution, the exact memory footprint of the Key-Value (KV) cache at a 4,096-token context window inside a constrained browser tab remains unverified locally14. Furthermore, the network latency dependencies for obtaining the initial small working default through MiniModel.org cannot be measured analytically and require field telemetry.

### **11.2 Deprecated Practices (What to Stop Doing)**

To align with the rigorous data strategy, engineering teams must immediately cease the following practices:

> 1. **Stop deploying the unchanged Qwen3-0.6B baseline**: It is explicitly rejected as a product model and cannot be rehabilitated simply by renaming the checkpoint.  
> 2. **Stop logging edited draft/final pairs as preference data**: This practice creates invalid preference pairs and bypasses independent adjudication.  
> 3. **Stop hoarding historical model copies**: Superseded payloads in D:\\LLMs\\TinyRustLM must be actively retired to prevent storage bloat.  
> 4. **Stop creating scattered scripts**: All logic and evaluation code must reside exclusively in the canonical E:\\Source\\Rust\\TinyRustLM.com repository.  
> 5. **Stop overriding initial server seeds**: Older project prose prohibiting server seeds is deprecated; MiniModel.org is unequivocally authorized to supply the initial models.

### **11.3 Compact Experiment-Lesson Template**

To preserve institutional memory without retaining massive, obsolete 1GB+ payload files, the following template must be committed to the Git repository upon the conclusion of every experiment:

### **Experiment Identity: EXP-2026-09-19-PILOT**

* **Question**: Does assistant-only loss masking on the 1,024 reallocated pilot resolve conversational inertia?  
* **Exact Inputs**: Commit Hash a1b2c3d, Dataset TinyRustLM\_Pilot\_1024\_v1.jsonld.  
* **Method**: Full-FT, 3 epochs, LR 5e-5, Cosine decay, Wasm target evaluation.  
* **Result**: Multi-turn override accuracy improved from 42% to 88%.  
* **Uncertainty**: Small sample size for the "Extraction" family (N=41) limits statistical confidence in that specific domain.  
* **Decision**: SHIP. Proceed to the 200k scaling pipeline.  
* **Reusable Lesson**: Loss masking on user prompts is mandatory for SLMs to prevent overfitting on conversational scaffolding and to force attention updates on state changes.  
* **Evidence Identity**: Metrics logged at E:\\Source\\Rust\\TinyRustLM.com\\evals\\EXP-PILOT-results.json. (Model payload deleted).

### **11.4 The Smallest Falsifying Experiment**

The smallest experiment that could fundamentally falsify the recommendation—the premise that targeted multi-turn data curation can repair the SLM's weaknesses—is a **Context Inversion Probe**.

**Design**: Take the highly performing model trained on the 1,024-record pilot. Feed it a 15-turn conversation where a critical, unchangeable constraint (e.g., "The server budget is strictly $50") is stated in Turn 1\. In Turn 14, the user contradicts this directly ("The budget is now $500, deploy to AWS"). In Turn 15, query the budget constraint.

If the model outputs $50 (clinging to the oldest context despite the training data explicitly teaching it to overwrite state), the core hypothesis is falsified. This failure would prove that the SLM's parameter count and attention mechanism lack the physical capacity to bridge the temporal gap over long contexts. If this occurs, no amount of data scaling to 200,000 records will fix the issue, and engineering must pivot to fundamental architectural interventions before proceeding.

#### **Works cited**

> 1. SeDT: Sentence-Transformer Decision-TransformerConditioning for, [https://arxiv.org/html/2605.26788](https://arxiv.org/html/2605.26788)  
> 2. LLMs Get Lost In Multi-Turn Conversation \- arXiv, [https://arxiv.org/html/2505.06120v1](https://arxiv.org/html/2505.06120v1)  
> 3. Mitigating Conversational Inertia in Multi-Turn Agents \- arXiv, [https://arxiv.org/html/2602.03664v1](https://arxiv.org/html/2602.03664v1)  
> 4. Illinois Biometric Information Privacy Act (BIPA) \- 2026 Guide, [https://www.enzuzo.com/blog/illinois-biometric-act-bipa](https://www.enzuzo.com/blog/illinois-biometric-act-bipa)  
> 5. AI Facial Recognition and Biometric Laws by State \- Allainews, [https://allainews.net/ai-facial-recognition-and-biometric-laws-by-state/](https://allainews.net/ai-facial-recognition-and-biometric-laws-by-state/)  
> 6. Collecting Training Data Privacy Compliance Guide 2026, [https://syntonym.com/posts/collecting-training-data-privacy-compliance-guide-2026-syntonym](https://syntonym.com/posts/collecting-training-data-privacy-compliance-guide-2026-syntonym)  
> 7. Generative Artificial Intelligence and the Creative Economy Staff, [https://www.ftc.gov/system/files/ftc\_gov/pdf/12-15-2023AICEStaffReport.pdf](https://www.ftc.gov/system/files/ftc_gov/pdf/12-15-2023AICEStaffReport.pdf)  
> 8. arXiv:2412.15244v1 \[cs.CL\] 13 Dec 2024, [https://arxiv.org/pdf/2412.15244](https://arxiv.org/pdf/2412.15244)  
> 9. Intuitive Fine-Tuning: Towards Simplifying Alignment into a Single, [https://arxiv.org/pdf/2405.11870](https://arxiv.org/pdf/2405.11870)  
> 10. Expert Evaluation and the Limits of Human Feedback in Mental, [https://arxiv.org/html/2601.18061v3](https://arxiv.org/html/2601.18061v3)  
> 11. Krippendorff's Alpha: Calculating Intercoder Reliability \- CASRAI, [https://casrai.org/guides/krippendorffs-alpha](https://casrai.org/guides/krippendorffs-alpha)  
> 12. VectraYX-Nano: A 42M-Parameter Spanish Cybersecurity ... \- arXiv, [https://arxiv.org/pdf/2605.13989](https://arxiv.org/pdf/2605.13989)  
> 13. WebAssembly — list of Rust libraries/crates // Lib.rs, [https://lib.rs/wasm](https://lib.rs/wasm)  
> 14. Browser-Native Agents & LLMs: Run AI in Your Browser (2026), [https://wowdata.science/browser-native-agents-llms-in-browser-ai-guide-2026/](https://wowdata.science/browser-native-agents-llms-in-browser-ai-guide-2026/)  
> 15. A Survey on Multi-Turn Interactions with Large Language Models, [https://arxiv.org/html/2504.04717v1](https://arxiv.org/html/2504.04717v1)  
> 16. How Reasoning Evolves from Post-Training Data \- arXiv, [https://arxiv.org/html/2604.05134v2](https://arxiv.org/html/2604.05134v2)  
> 17. arXiv:2608.24160v1 \[cs.AI\] 25 Aug 2026, [https://arxiv.org/pdf/2608.24160](https://arxiv.org/pdf/2608.24160)  
> 18. ZGCM-1: A Fully Open and Extremely Efficient Foundation Model for, [https://arxiv.org/html/2609.13356v1](https://arxiv.org/html/2609.13356v1)  
> 19. Pioneer Agent: Continual Improvement of Small Language Models, [https://arxiv.org/html/2604.09791v1](https://arxiv.org/html/2604.09791v1)  
> 20. Failure Modes in Multi-Turn Reasoning Models \- arXiv, [https://arxiv.org/pdf/2606.10740](https://arxiv.org/pdf/2606.10740)  
> 21. Small Models Struggle to Learn from Strong Reasoners \- arXiv, [https://arxiv.org/html/2502.12143v3](https://arxiv.org/html/2502.12143v3)  
> 22. Datasheets for Datasets \- Microsoft, [https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/1803.09010.pdf](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/1803.09010.pdf)  
> 23. Transparency-First Medical Language Models: Datasheets ... \- arXiv, [https://arxiv.org/pdf/2601.19191](https://arxiv.org/pdf/2601.19191)  
> 24. arXiv:2407.16883v1 \[cs.IR\] 4 Jun 2024, [https://arxiv.org/pdf/2407.16883](https://arxiv.org/pdf/2407.16883)  
> 25. Croissant: A Metadata Format for ML-Ready Datasets \- arXiv, [https://arxiv.org/html/2403.19546v2](https://arxiv.org/html/2403.19546v2)  
> 26. Obscuring Data Contamination Through Translation \- arXiv, [https://arxiv.org/html/2601.14994v1](https://arxiv.org/html/2601.14994v1)  
> 27. LLM Benchmark Datasets Should Be Contamination-Resistant \- arXiv, [https://arxiv.org/html/2605.19999v1](https://arxiv.org/html/2605.19999v1)  
> 28. Data Contamination in Neural Hieroglyphic Translation \- arXiv, [https://arxiv.org/html/2605.07453v1](https://arxiv.org/html/2605.07453v1)  
> 29. A Comprehensive Survey of Contamination Detection Methods in, [https://arxiv.org/html/2404.00699v4](https://arxiv.org/html/2404.00699v4)  
> 30. Strategic Doctrine Language Models (sdLM) \- arXiv, [https://arxiv.org/html/2601.14862v1](https://arxiv.org/html/2601.14862v1)  
> 31. Autodata: An agentic data scientist to create high quality synthetic data, [https://arxiv.org/html/2606.25996v2](https://arxiv.org/html/2606.25996v2)  
> 32. Krippendorff's Alpha for Annotation Agreement \- Label Studio, [https://labelstud.io/blog/how-to-use-krippendorff-s-alpha-to-measure-annotation-agreement/](https://labelstud.io/blog/how-to-use-krippendorff-s-alpha-to-measure-annotation-agreement/)  
> 33. Selecting the Right Inter-annotator Agreement Metric for NLP ... \- arXiv, [https://arxiv.org/html/2603.06865v2](https://arxiv.org/html/2603.06865v2)  
> 34. Introduction to Krippendorff's Alpha: Inter-Annotator Data Reliability, [https://encord.com/blog/interrater-reliability-krippendorffs-alpha/](https://encord.com/blog/interrater-reliability-krippendorffs-alpha/)  
> 35. Not All Synthetic Data Is Yours to Learn From \- arXiv, [https://arxiv.org/html/2605.31126v1](https://arxiv.org/html/2605.31126v1)  
> 36. Taming LLMs by Scaling Learning Rates with Gradient Grouping, [https://arxiv.org/html/2506.01049v1](https://arxiv.org/html/2506.01049v1)  
> 37. Extended Abstract \- CS 224R Deep Reinforcement Learning, [https://cs224r.stanford.edu/spring\_2025/projects/pdfs/CS224R\_Final\_Project\_\_1\_.pdf](https://cs224r.stanford.edu/spring_2025/projects/pdfs/CS224R_Final_Project__1_.pdf)  
> 38. LoRA vs. Full Fine-Tuning: A Theoretical Perspective \- arXiv, [https://arxiv.org/pdf/2605.19018](https://arxiv.org/pdf/2605.19018)  
> 39. IGU-LoRA: Adaptive Rank Allocation via Integrated Gradients and, [https://arxiv.org/html/2603.13792v1](https://arxiv.org/html/2603.13792v1)  
> 40. Conditions for Catastrophic Forgetting in Multilingual Translation, [https://aclanthology.org/2025.mrl-main.23.pdf](https://aclanthology.org/2025.mrl-main.23.pdf)  
> 41. Strategic Doctrine Language Models (sdLM) \- arXiv, [https://arxiv.org/pdf/2601.14862](https://arxiv.org/pdf/2601.14862)  
> 42. Artificial intelligence \- Lib.rs, [https://lib.rs/ai](https://lib.rs/ai)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAaCAYAAABsONZfAAAA1klEQVR4Xu3RPQtBURzH8b9QTAaPhWQw2I2KTAxmyguw2AwGXonIaKAMSl6CzAZlsFgtyqb4nnvO5eAVKL/61O3/O/ec+yDyz68mjjrKCLxX30lgjgWa6OOEgumTyJlrJxnsMITfzHyYYo0gBiiazilHonfNukOTHi6oYoKQW+RxFv1oagM7LVxF39CwC/XSd7TtoYnbLUU/4jM1U6gFn1GzG0qfRRoHdKyZBxXs5bVhChFrjbPgiBnG2KCLKFbYiv6K6iu/xYsYwqJPsufqBPdX/PMjeQBZzSE9o6921QAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmQAAABlCAYAAADj0v8wAAAFRklEQVR4Xu3dTaiUZRQH8BMlJUVfShEFRqsMF0ZZBO2yKCEIKioECyL62hmaCIGbFm3LCMKwtgW5EkSDjNq1KVACcWEiSYYKQRvL6hyfOzbz6r3NZe7c61x/P/ij85wZcXl43vM+TwQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD9lme+yZzN/DOVM5ljfWsHMk9nrpj6DQAAY/BEtObr3c760syWzJ+ZzaEpAwAYm62ZvzNru4VoTdj2zOnMqk4NAIA5cE1md+Z45q5OrefJaDtor3YLAACM7vbMkWhNWTVnF9NryGonDQCAOVaPKetxZXd+rN/GaA3Z290CAACjqyZruvmxUjNkO6M1ZOs7NQAARjTM/FgdjXEwczKzslMDAGBEw8yPPR5tB21H5qpODQCAEf3f/Nh1mb2ZQ5kVnRoAAHNgpvPHlmS2ZU5lHhgsnas9n9mV+TBz50AVAICh1Cn8e+LC+bEa4r8n2mPMw5nVfbVSzVg1YS9E++6azOfR/j0AAIawLLMv2p2VvfsrT2SORrvDstbr/soNcfEmq3bGvo72OLPcl/khc9v5bwAATIB7M491FyfEZzE4c1ZHYeyP/xo0AIBL1oPRLuj+Pib7kNV62/Klqb/XDtoXmafPVwEALmHVkNUVROsyf8TkNmT3R5s9ezHagbHPRpslAwCYGDVzNckNWbky2ixa/QkAMK16G7B2c56KdizDpbKLsxgaMgCAGVXj9Vy0IxvqUux6K/C7zEfRmrQ6bb4atat7P5hnGjIAYFGrZuytzG8xeJjpQ5nfo10DVGdufRDTXwN0c7QZqToGYti8c+6Xw9GQAQCLWq/Z2dZZrzOyfo72huAb0XbNFspsG7Ibo/3/h4mjJwCABfd+5s/Mw531m6IdN/FVtKbshsHyvJpNQ1YXfm/KfDxkXm4/m1HvMNhxBQC4jNXu0P7MwczywdL52tnMo4OlC9Rjz3qDsLv7NFNqF2tYs2nIAAAmyrXRdsD2x4WP7noNWV2GXYP9M6n6I5lnZpE6Y2xYGjIAYFGrJuenzK19a9dHG+L/K1pTVrtfdXn2Qh2D0WvItnYLAACLQe2S7cz8GG2m6stoF2lXA1an5P869bnexJzvhuy1zC8xOG91KvNt5pa+7wEALAr1iLJmu2oovrs+m3kvAAAYq3r54ZtoLzv0du3OZI71rR2Idnn4fO8oAgBcVp6I1ny921lfmtkS7SiRzaEpAwAYm3rB4O/M2m4hWhO2PXM6s6pTAwBgDtSc3e7M8WjXSl1MvRBRO2ivdgsAAIzu9syRaE1Z9yWInl5D5qgOAIAxqMeU9biyOz/Wb2O0hsxhtgAAY1BN1nTzY6VmyOpst2rI1ndqAACMaJj5sToao+4HPZlZ2akBADCiYebHHo+2g7Yjc1WnBgDAiP5vfqxuNtibOZRZ0bd+ZWZd5tOp3NFXAwBgFmY6f2xJZlu0+zYf6Kx/mNkUbb5sTeaVvjoAAEOqU/j3xIXzY9Vk1WXs9RjzcGZ1X61U83Yi2mXpr0d7lGmHDABgFpZl9kW7s7J3f2U1WEej3WFZ63V/5YZoTVtXvZW5K9pOGQAAC6BO6/+s7/MNmbv7PgMAMGbVgH0S7ZHlm5n3MjcPfAMAgLGrObN69DndURkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMCH+BZ6d9Pi04hAUAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAaCAYAAABCfffNAAABYUlEQVR4Xu2UTytEURjGH6FGyMIUEwtZKGWj8WfDQllLpMiCnU/iC4iN1GQ3MTUpykKZ+AI2ky1SSmFFIX+et/femTtvV/cwd2Fxf/Vr7sxz5rwz5z3nAAn/nSl6R78CPtJ77/mNHtIB/wv1sEPf6YT5vJce0Cc6ZrJf0U7PaZmmTSZ00Ut6TFtM5swgfaAF2mQyn13oGBn7J2ag679mgwBS5IWO2sCVDYT3w6eVntBnmjWZE220hJ/7IfTQK+gu7K+N3HDpxzT9pEc0ZTInovrRQDehReZM5kxUP4ahZ2SbNpvMiajz0U3PoE3vMJkUXKRFukX7atIAQ9BfafshE8xCm51HeAGZeAm6nLKt92AO6iS9RvWu+qC39AZ6Z71C76tx6CQW+Qen0J0pyLa+oJnKiBiQg7keeL8MPQZ+0ViQy3TVe5Yl2qfzlTQmRqCX5QrN0QWEL2vdNNJO7zUhQfkGD7JFmo3tP3AAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAaCAYAAABCfffNAAABWUlEQVR4Xu2UP0tCURjGn7AgqXAJCgyCBiFoCamWGoKWFpFahGjuI+hXcGiJpmhpawgiKGhoiPoM0eJgEgRBNiWY9Od5eb15e7Xu6eoQ4g9+4PG5/59zDtDjv7NMH+iHzzJ9rP9+pac04Z3QDvu0RhfN/xP0hD7TeZP9iRF6TW/oqMmEMXpLz2nUZM5M0yd6RPtN5nEAPUaODUUK+v23bOBDblKhczZwZQet+/AYohf0hSZN5sQwvcTPfQhxWoTOwqnvkRsufazQd3pGB03mRFAffXQXepM1kzkT1McsdI3s0QGTORG0PsbpFbT0mMlkvWSgn3kbzfkXM9CntH3IE6ehZR+i+QIyPqbr9bEcu9qIlSV6h8Ze9UbvaQm6Z1Wh+9UCtBOL9FegmzSLgDcJiyzMPFo/QMeQySJv4CHdTfrGHUEuKF1tQG+WQxsb529EoDMy1LTu0aV8AmxcQ7z9gUmHAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAaCAYAAAAzBZtTAAAED0lEQVR4Xu2XW4hWVRiG3yih6GBSWWEiihFFpVA4CEUSEYqYYkGRoFcVRFAoFZVBEF5UdCPSRXnAixAPFNLBqCCtiMiLEErCClMCMfAm8CaP78P3r2bt9e/9z54ZZq72Ay/zz9prrb33u771rW9LHR0dHR0dzVxiDVkbrfespdallR7NXGE9ab1vvW3doZiv5DbFdfrRn3El11jPK/q8bt1cvTzxXGlttj6wZhfXxgpmvGQdUMx5nfWh4iWnZP3qmGp9ZK1WmDHP+tZap6rJj1qHrfnWVdab1leK8YlZ1iHrKetya4l1xFqQ9Zk0iIbdPTVFTFvusU5a92Vtc6xj1uKsrY7nrFeLtjutnzUcADOt361V//eQplkHFePhMkXg7On9TmywvlB9tE8KvATR/I1ii4/FaF4CM/PteLX1nbVNg+fcbr2lah/mwWCiGTD2tGIhE/Rnl+xXRDQLesJ6OesDK9U/thU3WsusRYrtMF7Y1u8oTHlQ7fMn9/5M/Qbz0vsVUUa0NcHiXFDkbtIXPK6YkzmAa3UmsTiYirkPWefVbzAeMX8e/QO5SbENPraesF6z/rbu7V2fYd3a+z0WOCTWWz9ayzWy0cnIJoPL9hLyJnkSE/5QGM4i057AyCaDU3syssngsr0WbvqLqocH+WaHhvMM5uS5cKzcpXhxDpNBYB4mlka2NRhut44rjEAYx0JDmmckgzGwzsjWBqckTrTOLq4x+F/FgULOy0/W0ZIOv0+tuzU4fwKp6k/1G9nW4FsUEfuMopLAMAz5QZG2SBtf99oHGbxW9Ua2NphVPqX+UxLSIYC55K/RgomYuc/aov4FHESTkU3tOey4T1R9eQzfqzAlVQiTkiJSR1a6JF3jYUdTjmDskKKC2KRmIwbBYrPopZHJYKKTiqIOqgTSEMGTwzuQ8jAQyMtNBrOjWRTS4hn1G5m8oZoYCEUzHRlQQttZ64HyQgMcXBxgHGTkbLbieOCl2F25UddbvyoqgATnxqzeX8AwPh6oAkqojdPYR6xzikohkaoXxG8O979UvR8QkOWz1ZKK7bRtgAikpPpNw+azmrxcE0QT9SOfk6ksGi9zFZFEVZO43/rHWpi1vat4zjd6/xPlX1qvqJrrb1BEfxpLAPyk4XFQ3pPxHMgETTqDWMhdiiKgTKu1YOZRxSFErmSydYoH+lzxEGwtomSyYQvybE9baxSR+ayqxr1g/af47E1gFJ+3GM1ZQuQS+Rx4+VjKUObnk/wxRX3NB0r+KY6x+LBTseO3Wt8rgq41bO/pilXNH4B2Inekb/+JhGdiF6HRpB2enXSBcQ+reWfRzvUVih1dRz4Xf0eq4yeEaxUHUhulr6mOlnAgvKj4WGmjPK92dHR0dHR0dHRUuAgMuOBOwUPtUQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAaCAYAAADFTB7LAAABfUlEQVR4Xu2WvytFYRjHHzHIj5AwMDAgC0o2UjJYWMRCRibKZDQpK5mkFBnobkwWdzMoq1JK/gCDmBQ+T+97OF4d95zrnHPvcD716d73ec89Pee93/OeI5KRUR6M4z0+hnTC/CwdKnAXT7DTjpV9fMdJO67EMXzAYVtLhTY8xVZfrQmvxTTT7qvX4RF2+GqJo3/XmlMbwGfMYZWvro3vYL2vljiz2OPU5vED1516My7JdwxKhubvDUfciXIgKH9lwxC+yu/8JYHemItY7U78RVD+4qQXz/Ac82J2h1Bo+A8kvfxNScQGC+WvBbdxBfvF3EzHUvy+GLnBQvlbwFG8wxkxK65RKDYOoRrUPfAGn8Rkz/MFb8U07dEt5tF3IeakXiSW7bzWNnAvwFX5eeGhGoyKrtam/a6PyTz2fc1GI/YG9er1uT1tx/qp40Gc8w6KQOwN6opdYpcda4OHYla1wTsoBI24hVdiMq/n0Iv8N5q5WqdWI+ZVLCMjoxR8AlzpS6+kGafjAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAACYUlEQVR4Xu2WTUhVQRiG38ig7I9KKCkIWghFm1ALwRaBgRvDahUhKEFt2lRo+LMoolUoKEGQQouoQIqEoh8IuiEo7SQIN0a0CopoVUQS9r58c3DOzDHMrpwb3Bce7rnfnHPm+5uZA5RV1v+tQ+QjmfP4RH6SX+Q1OU5WJg+UgkbILGn0bHLwNMzpLrLCG8tN68k4eUe2BmPV5MMCY7loN/lC7pOKYKyefCdvSVUwlouOwHr1TDhAXYKNXQjsuWkIcb+uIqdgGe90/3PXOlKArf4Jdz0Ny+YNsiW5sRSU1a9a9d2wXeCws/2LmslncgfxjqLFfY/8QLqymUr69XxgryXfYFtaMaRWy1oTkhL2EotYwFn9Kp2EBXE1sC9Fm8grxHMkOobsnSilP+2vCkLOXgzs0gbSSx6QVlhmJJVYJb/t2OfsWZnbQfrJMHmEuLKR9pKviKPS9SjSzsq5JrIR5uQBsoY8g5VXjuqU64GdfHJGY0qCquTPsR+W6W1kF5nBwlnHQdipFH4PqH8T6XtAC0xOt8EyIOfkfDKxX94G8oZs18Owk28K1vt+v64mD8lZ919Zn0Rc2b+WXtAC2xHk6FryAvMT++X1g5AUgE69PUj3q4JQUDoZpUX161KkF+rFCkBqd/9lV89dc3a1xACsLeSsAlLbHIU5W3C/uu867NkOFCG7oerIGLlJ3mM+yzvJY9hX2iDMAZ16sj8hl2H9qcCukD7YTnOX3CLnEO/BRZN2kudILwxNthnx0aw+Fb7UUsl9ui66o/pWeEoqYQtQmdRxXZKqgZVQnIAturLKWm79BuLFeHiYduN7AAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAaCAYAAADSbo4CAAAB0UlEQVR4Xu2WyytFURSHl1CeSZQ8JpSBUgYYyKPkkQkTUpKRYiRFCBMTYzIxIDKgSBkoAyYepfwBUmJgQikZMSDx+7X2zrn73qtw9ux+9XX3Weuczrr7rL3PEUmQ4Hc0wwf4GfARvsEPeAG7YbK9wDer8B02BGK8+ZBoQZMwKZDzQjY8g7ewwMkVwrs4udCpgE9wF6Y4uVr4Ci9hvpMLnS7R3hh2E2BONDfuxL2wJNH9kQoHRWdqwhx7JQsei66SczO+Ep2FZZhnT/RNrP7g6pgWXS1tJmYpgqfwHpY5uX9h+2PMiVfDF9Fl7dIKD0VnMzRi9QfpFy1w3omTKYkd/zM/7R8skIXwpkHS4D6cEZ2tTVhicqVwC/bAergNF2GOycelEj5L9P7B8Y5EFjIr+kiK4TXsE+0l5inHI7Ad3sA6vUw2YKcZR9Eoulu67xf2i4XvFzYrCxqAKzBdIvuDN18X3X9YfLkZM8Ycz+G5vOZf8HHx33DlsAgS7A/muYI4s8QWxv4ijJ+Ihx3ZPjI7cx1wD9bAXpgLj0RXHLFFt8AmEwsFOwN2/2BBa3BUtCGr4IEZE74WFkw+1J2ZU5/pxDLk+1uFvzwOwvO9fz4kSOCVL5PSXOPGzyOIAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAZCAYAAAB5CNMWAAACy0lEQVR4Xu2YSchNYRzGHxkiQshchljIgjJFUgolYyJio2RYERlKIWQhO0pCMiwMKVkQJQnJsEAhiULKSjYsJMPz9D/Hfc97z3vv69x79ZXzq1/fve85373/85x3OhcoKYlkFl1CB9MZdGH2cInLNvqL/qDnaf/s4RKXdXSc31iPoXQ5rDu2p53pGLomef2v6UJX0p5ee0p3uoEepTvogOzhaBTWXNjw0/W2yx7OZwr9BuuSqV/pHPekFtOLLqUn6Wf6DvkhDKFP6WrYjZxNX9GJ7kmRbKSbYZ+znW5FRGDqii/oS/qE7kZ+oa1EYS2g4+k55IfVgR6nF5PXKfvoNViPFNNgvS7Pw3RUcp7LBPqcDvMP+CisQ35jJLpIGULDeiAi7pjDKeSHNZx+hE3MLotgI+Fv5p9u9AydmbzX/75P/takkbBG0kuw4eHTke6kW9CcsLS8/0R1WPNgU8cKr70Wfehl2Fwl9Nka3v3+nBFAYemCT9PXsIR3odKt6zGWXkc2sKJBiVBYaSihsPz2eiyDzVuL6S1EztEK6wEdkbzvTR/CxrguOgY3sEaCEqGw0n2RH0rRsIRWXH1P9Kqvi+vqtWl10Ao52WuvhQK7SY+heFAiFNYm5IfSSFhNIb2LKjAWhX6QvoFNxkUJhRUKJdTedDTkHtFntK/THuryIRTUAViPGk2vIH/SjyEU1lT6HdU1pWFpVWwpKkiF+WFpGKqA+U5bCDeodOhpL1M0sFBYg+hbWO91WUs/IX//1FS0uTtCJzltPehteiN5XQsFtR+2qvhzVNHAFNYH2OOXiz5/L72PSl36/gv0LLIb1Zahi7kD6x2r6GN6D9XF5jGdrkd1UClaYffQTv4BD/Vq1fAFlUcu/Rqg0PQMl6KQrsJ+JdCjzgl6F3G1Ng3dIT0maM+hHqGdd1tFtWm7o1r1ty3XWlJSUlJSUvJ/8hvsOoxWa0VeMgAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAaCAYAAAAzBZtTAAAD4UlEQVR4Xu2XW8hOWRjH/0KNnBrjGOKbGEkOoaScotFIIodMQykKOUSUQ1woKYfcYCg5jCZcUC4mhwvllQuiJDmVpCkl5EbNBQn//zzv873rXd/e77ff1813sX71r2+vvb+91vtfz/OsZwOJRCKRSOTTjppAHaKOUrOp9lVP1KYT9Qd1nNpDDai+3cwwaj/suQWonmM9tZcaSvWL1Bv1radNIXO3UDepJuon6izMhI7Bc3kMpx5Q22HGLqLuwkxx9J6d1D1qHPUz9Q+1OnjmDPU1R4+pnpVH2wba8a7xYAb6wW+oScGYDPiX+i0Yy0ImPoKZq43qTF2n/oO915GRz6nB5etZMONkquhCXUZlY11/Ua9h0d5mULouh0XVwuheFkppmalUdLQxt6jTMOPy2Eq9h0WxM4PaBluHGAgzV+XH6Q6LaJUloblVmn5ofsJYTB1A7TVk0oeaQ01Dy5c2SjfYou9Q81AsvTW3Iic2WBFVgqX0j8F4iEzSXHpGZUXKqpW/w6J1CWw+zaP3h/SgxkZjI6hzsHkK05e6SF2CTbyDekWNL9/vDyvy9aAfpl1WxE1Hyx9YCzcyz+B4PERRq+iVyX/CfsthWL0cEzynyJXBu6m/qbWw7NqH/CDQ/BdQifBCDILVq/Dw6ECdp67BUkoRGNbCWuiHH6FuwBZSdxrB3iETYyOLGKwaq1r7hZpfHtMaZNxTVDoJP7xKqESugki1dXP5OmYpLHrlTyH04AlYtDZF91THPsAOFNW81lJC/3+SukqNQmPGOipVL9DSyHoMjk94lT4Zuqp87Qb7tfD3x/8rvPSEz7eKp5PKQ7wrqk1aqMxVUa+FTmk9p5NaPeX3kmdk3njIaFhglFBdU91gGSsUWLrWuOPvj7sNoUDTeNFM/p94V0P8nvpCP3lbI4ziRsuD0GZr02Mj3QDV9bxWz6O/hNoGbypfFzVYNTtrvCbe94WTOBr7TE2NbxRApuiAuY36Dzgnq9VS2ip9w9ZK54bOkfj8iDuNOJgmUh9hmerklQjvo1Wf1YsXxnvBdcGYok6mPEPFfB0McU0qQtiizUV9Rg+BnQ3qapzJ1FuYOc5B2Dp3BWO/Uu9QibasQ05ZqexUqfDymHfI+cbGGVUImfkS1n4ovWWGJuhFXYF9XqqbUJQ0iiJgA3UfZlheGxSjLkBrW0kto55Qa1BdejZSn1D9VeWfwP6/atPCttNRduidp6gV1EPqGFquL+/QLYwiS824etdw8RrX7sUTNoreI4NlSlG0JmWRpL/rQRmqj5uZsE3OQmuaAvu6/AX558ZI2AGadz+RSCQSiUQikUiQbyVU0FjKIyDeAAAAAElFTkSuQmCC>