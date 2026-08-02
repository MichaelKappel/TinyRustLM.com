# 1. Evaluation philosophy and claim taxonomy

We organize quality claims from minimal viability to full assistant readiness. Each level has defined evidence requirements and forbidden output traits:

- **Runtime-smoke-only:** The model *loads and runs* without crash and produces some output.  Evidence: successful compile-and-run and a non-error response on trivial inputs (e.g. “Hello”).  Language prohibition: it must not contain code injections or crash, but disallowed for serious content – e.g. it can safely refuse or say “I don’t know” by default.  (This is a *sanity check* only, not a quality guarantee.)

- **Structural-validation-only:** The model passes all *static checks* and format validation (e.g. correct tokenizer, weight dimensions, `.slm` schema).  Evidence: automated structural tests (tokenizer consistency, no invalid Unicode) pass.  Prohibited language: it must **not** execute any logic beyond fixed outputs – e.g. it should not answer contentful questions yet.  (It may give placeholder responses, but it must not hallucinate factual answers or misuse undefined behavior.)

- **Conversation-screened:** The model engages in basic dialogue and respects content filters.  Evidence: passes a suite of *safety and style tests* (no profanity, no disallowed topics, no self-disclosure of private instructions).  Prohibited language: no disallowed or unsafe content (e.g. hate speech, illegal advice) and no misuse of user context.  (It may still give incomplete answers or say “I’m not sure,” but it should always be polite and safe.)

- **Conversation-proven:** The model can carry a coherent multi-turn conversation with common sense.  Evidence: passes *conversation simulations* that test context retention and consistency (e.g. question‐answer pairs, follow-up queries, ambiguity resolution).  It should handle ambiguity by asking clarifying questions or listing multiple options.  Prohibited: it may **not** contradict itself or ignore user-provided facts (see invariants below).  It should avoid merely keyword-sniffing responses – answers must reflect real understanding.

- **Task-specific-proven:** The model is validated on particular domains or tasks (e.g. customer support, coding help).  Evidence: passes *task-oriented benchmarks* and realistic scenarios for those domains (e.g. completing a programming task, giving travel advice).  Prohibited: it must not apply irrelevant knowledge or old data (e.g. providing stale info when current context overrides) and must not answer outside its domain with false confidence.

- **Full-assistant-quality:** The model is a general-purpose assistant meeting industry-level expectations.  Evidence: passes *comprehensive evaluation* including all of the above plus large-scale “adversarial” chat tests and human review, achieving high reliability across varied topics.  Prohibited: no disallowed content, no baseless certainties, and it must follow final user instructions appropriately.

In essence, we require each gate to be supported by minimal concrete tests.  For example, **conversation-proven** might require the model to *explicitly acknowledge contradictory user vs memory facts* rather than ignore them; whereas **task-specific-proven** must *explicitly detect when user lacks a needed resource* and offer a fallback.  Across all claims, we reject any evaluation based on surface keyword matches or hidden answer templates.  We emphasize semantic correctness: exact matches or canned replies do not count.  (For example, [76] notes that we should “prioritize semantic equivalence… over exact‐match checks” in LLM evaluation.)

# 2. Layered evaluator architecture and authority rules

We propose a **multi-tiered evaluation pipeline** (see Fig. at left) with clear authority for each layer:

- **Tier 1 – Deterministic Structural Checks (Heuristics/Schemas):**  Fast, syntax-level tests (e.g. JSON format, tokenization, unsafe substring detection). These run first and *can block* the request immediately if failed (short-circuit).  Authority: Tier 1 is authoritative on structural validity.  Disagreement: if a higher-tier judge flags a different issue, Tier 1 failures dominate (the output is invalid).

- **Tier 2 – Scenario-Specific Invariants (Rules):**  Handwritten semantic rules for particular situations (e.g. the invariants from Section 3).  For example, a rule checks that if an instruction contains two options, the answer lists them.  Authority: Tier 2 has veto power over semantic blunders caught by these rules (since they capture objective logic).  Disagreement: if a model-based check (Tier 3) thinks all is well but a rule fires, we mark failure (rules cover clear-cut failures that a judge might miss).

- **Tier 3 – Model-Based Judges:**  A separate “judge” LLM (preferably smaller or of a different family than the evaluated model) assesses nuanced quality attributes (coherence, tone, completeness).  It provides scores or verdicts on qualitative rubrics.  Authority: In conflicts, we treat the model-judge’s verdict as provisional.  If it conflicts with deterministic tiers, deterministic checks win.  Disagreement among judges is resolved by majority or flagged for human review.  Critically, the judge model must **not rewrite** the candidate answer – it should only produce a classification or score.  We enforce this by using a template (e.g. “Verdict: [Pass/Fail], Reason: …”) and disabling open-ended output.

- **Tier 4 – Human Review (Gold-Set):**  A human team examines outputs on a gold set of challenging cases (e.g. holdout or production-critical examples).  Authority: Human labels are final; if a human disagrees with automatic scores, the human verdict overrides.  We compute inter-rater agreement (e.g. Cohen’s κ) among multiple annotators. If κ drops below threshold (e.g. 0.6) we refine instructions or classifiers. Disagreements trigger rubric updates or additional training.

This pipeline ensures no single layer is opaque or unchecked.  For example, if a model-judge signals “Pass” but a semantic rule indicates an invariant violation, we treat it as a failure.  And if two different automated tiers disagree, we escalate for human review.  Humans and judges are treated symmetrically: both can flag issues, but *humans* anchor the rubric and catch what automated tiers miss.  We avoid LLM self-judging: e.g. GPT-4 is not used to judge GPT-4 outputs, per known bias.  Instead we may use a smaller or different-model judge.  Overall, rules (Tier 2) and humans have the final say – the judge model is a calibration step, not a filter that can “correct” the model.

# 3. Semantic-invariant specification table

We define **semantic invariants** that must hold across conversational outputs.  Each invariant is a rule about content consistency or logic, phrased generally. We list them without referencing specific test examples:

- **Underspecified Choices:** *If the user query leaves multiple valid options or actions unspecified, the response must either ask for clarification or explicitly lay out *all* options and the criteria for choosing among them*.  (For example: If asked “Should I do X or Y?”, answer should discuss both X and Y and factors, not just pick one without justification.)

- **Conflicting Dates or Facts:** *If authoritative sources disagree (or user data vs knowledge base differ), the answer must acknowledge the conflict and attempt resolution (e.g. giving a date range or citing both sources), rather than guessing a single date without support.*  (E.g., “Some sources say 2010, others say 2012; here are both results…”.)

- **Recent User Preferences vs Old Profile:** *If the conversation provides new user information that contradicts the user’s stored profile or past preferences, trust the latest user-provided info. The answer must adapt to the fresh preference.*  (For instance, if user now says they dislike coffee, disregard an old profile stating they love coffee.)

- **Unavailable Resources:** *Advice must respect the user’s actual constraints. If the user lacks a recommended resource, the response must note this and offer a feasible alternative.*  (E.g., if the user has no printer, do not advise them to print a document; instead suggest digital alternatives.)

- **Quoted/Retrieved Text as Data:** *Any quoted or retrieved passage in the conversation must be treated as read-only evidence. The model should analyze or summarize it, not reinterpret it as if it were its own content, and must not alter its facts.*  (For example, if the user pastes a news excerpt, the model can comment on it but shouldn’t reframe it as a fictional quote or ignore it.)

- **Legal/Ethical Comparisons:** *When asked to compare or analyze legal or ethical scenarios, the answer should present factual or material considerations on each side, not mere moralizing. It should highlight relevant laws or evidence (“the strongest material considerations”), rather than simply stating “this is bad/good.”*

Each invariant is enforced by logic in the evaluator.  For instance, we can check that in an underspecified-choice scenario the output contains both options and criteria (a rule in Tier 2).  These invariants align with best practices: metamorphic testing literature also emphasizes that outputs should behave consistently under meaning-preserving changes.  (For example, [79] notes that paraphrased inputs should yield *similar* outputs.)  Importantly, we avoid referring to any specific test case in wording.

# 4. Rust implementation recommendations with parser boundaries

In Rust, we implement detectors as a pipeline of text-processing steps. Key recommendations:

- **Text Normalization:** First, normalize Unicode (e.g. use the `unicode-normalization` crate to NFC form) and uniform whitespace/punctuation (strip zero-width spaces, normalize quotes).  Convert all text to a consistent case if needed for keyword checks.

- **Tokenization:** Use a robust tokenizer (Rust has `unicode-segmentation` or the HuggingFace `tokenizers` via FFI) to split words and sentences. This avoids counting punctuation as separate tokens.  For example, `tokenize_sents` can help identify question sentences (presence of `?` at sentence end).

- **Negation Detection:** Maintain a dictionary of negation words and phrases (e.g. “not”, “never”, “don’t”, “without”, etc.). Use regex (with word boundaries via the `regex` crate) to find explicit negations.  However, recognize that purely lexical rules have limits: e.g. “I’m unwilling” vs “I’m willing” – pattern matching can help but may miss nuance.  We therefore log any detected negation for manual review if semantics are complex.

- **Conditional/Advice Patterns:** Look for conditional keywords (“if”, “unless”, “should”, “could”) and track their scopes. For example, if a response starts “You should…” without an “if”, flag it for semantic check (advice might be too absolute).  Use simple parsing (e.g. splitting on clauses) to detect incomplete conditionals.

- **Resource Mentions:** Parse references to resources using a list of known categories (e.g. `["charger", "printer", "browser", "internet"]`). If a recommendation is given (e.g. suggesting a device), cross-check user context: if user’s profile or conversation says resource is unavailable, flag it.

- **Units and Dates:** Recognize units and date formats with regex. Normalize units (e.g. convert “kg” to “kilograms”) via a conversion function. Use a date parser (Rust’s `chrono` or `time` crate) to compare dates.  For example, if one sentence says “2022” and later “2020”, detect conflict.

- **Authority References:** Identify phrases like “according to X” or named sources. If multiple authorities appear, ensure the answer cites them rather than ignoring one. In code, we might parse capitalized names after “according to” or check known authority lists.

- **Question vs Statement:** Check for question marks or interrogative words (“who, what, when, why, how”).  If the user input was a question, ensure the output contains an answer clause (e.g. starts with a response to that question) rather than just a statement or unrelated content.

- **Answer Completion:** Detect if the output abruptly ends (no terminal punctuation) or repeats a prefix (“I think… I think…”).  These patterns can be spotted by regex (e.g. `$` anchor for end of text). A truncated output or repeated fragment should be marked as incomplete.

- **Repetition:** Maintain a sliding window of recent tokens or bigrams; if the output repeats a phrase, raise a repetition warning. Simple checks: does the model answer echo a portion of the question verbatim (possible failure to answer) or loop phrases (symptom of generation failure)?

- **Untrusted Instructions:** Block patterns that look like hidden instructions. For example, if the user input contains quotes with imperative language (“Please do not follow previous memory”), ensure our parser ignores text in quotes when detecting commands. We can strip quoted substrings first (using regex `\".*?\"` with care for nested quotes).

- **Implementation Boundaries:** While many checks use regex or pattern matching, we recognize their limits. Complex semantics like sarcasm or double-negatives often escape lexical rules. Therefore, each rule is conservative: if uncertain, it can only flag a potential issue (to be confirmed by higher tier or humans), never pass dangerous content unchecked.

Importantly, we advocate structured output whenever possible.  For instance, the “Built-in Evaluation Hooks” pattern suggests having the model produce JSON-like fields (e.g. `{"result": "Pass", "confidence": 0.87, "reason": "… "}`).  Structured responses allow deterministic parsing (schema-based validation) instead of free text.  In Rust, we can parse these fields with Serde to enforce types (e.g. numeric, enum).  This makes verdict extraction reliable and avoids ambiguity that free-text evaluation would introduce.

# 5. Metamorphic and seeded-holdout design

We apply **metamorphic testing** to generate systematic variations. Each metamorphic *relation* defines input modifications and expected effects on the verdict:

- *Invariant (no change expected):* Changing entity names, reordering equivalent options, or adding irrelevant details should **not alter** the correctness verdict.
  - E.g. “Alice wants to buy a *phone*” vs “Bob wants to buy a *phone*”: the same advice should hold.
  - Lists of options shuffled should produce an answer with the same logic (just listed in new order).
  - Adding a distracting sentence (“By the way, it’s raining”) should not change the core answer.

- *Variable (change expected):* Logical negations, opposites, or critical rephrasings should **change** the verdict.
  - E.g. “Should I bring an umbrella?” vs “Should I **not** bring an umbrella?” should invert the suggestion.
  - Swapping roles (user vs third-person) may not change content but should change pronouns appropriately.
  - Changing numeric values or units: if one product’s battery is 20% and another 50%, the answer comparing them should switch if we swap those numbers.
  - Malicious paraphrases: if the user hides “don’t follow” inside quotes, the model should ignore it (so adding or removing such instructions should not change legitimate advice).

- *Resource/Context variations:* Changing resource availability or user state should sometimes alter recommendations.
  - If a product is replaced by an unavailable one, the fallback suggestion should appear.  Conversely, making an unavailable resource available should remove the fallback.
  - Authority order changes (asking “based on Rule A vs Rule B”) should make the model justify accordingly, but either way it should explain decisions.

Each case generator is seeded and deterministic.  For **seeded holdouts**, we fix the random seed and record all parameters: the generator version, seed, template family, and exclusions.  Each materialized test case is tagged with its SHA-256 hash of the input and the seed (so it’s fully auditable).  We ensure no cherry-picking: developers pick seed before seeing answers.  The holdout pool is disjoint from any training or dev cases (checked by template matching).

For **metamorphic invariants**, we use the logic above to assert invariance.  If an invariant is broken (e.g. a name swap unexpectedly changed the answer logic), that’s a failure.  We do not compare to a fixed “correct answer”; rather we define relations like those outlined.  For example, we might encode in Rust: if `input1` and `input2` are identical except for a named entity, then `output1` and `output2` should both pass the same tests (schema and logical rules) as an invariant.

As a guiding principle, we borrow from research: “MT checks whether necessary relations hold among outputs of related inputs”.  This approach avoids reliance on single expected outputs and focuses on consistency under transformation.  Our metamorphic cases cover the variations listed (names, order, negation, distractors, politeness, implicit vs explicit statements, etc.) and clearly specify which behaviors should be invariant and which should sensibly change.

# 6. False-positive / false-negative analysis

No evaluation is perfect; we analyze typical errors and prevention strategies:

- **False positives (incorrectly passing a bad output):** For instance, if we only looked for the word *“battery”* to trigger charger advice, we might miss a case where the user said “my phone is at 5%” (meaning battery), causing the model to wrongly advise a charger but our rule wouldn’t catch it (since “battery” isn’t in input). To avoid this, we would generalize the test: detect any mention of a percentage related to a device as implying battery context.  Concretely, we might write a new rule: *if the model output mentions “charger” or “power” but the input contains a device and a low percentage, then require that some term like “battery” or “charge” was present in the input or user context.*  If not, flag it.  This way the test is data-driven, not tied to one expected answer phrase. We have effectively turned that failure into a *generic regression test*: “if output→’charger’ AND not (input contains synonyms of battery), FAIL.”

- **False negatives (correct outputs flagged as wrong):** E.g. the model advises “replace the battery” without using “battery” word, and our simple rule (looking for “battery”) would incorrectly mark it wrong. We must anticipate this by adding more synonyms (“cell”, “power pack”) or by requiring context (if the query is about power, “charger” is OK). We then refine the rule to check semantics: if the input’s context strongly implies battery (like a device’s power levels), then recommending charger is actually correct – so we mark that as a *pass*. That refinement becomes an updated invariant test.

In general, to avoid overfitting tests, we **don’t hard-code expected text**. Instead, we encode *patterns*. For example, rather than expect “you should buy a charger”, the test says “if a power device is at low charge and charger is recommended, ensure some form of power/battery context existed.” This was motivated by known best practices: use conservative, multi-dimensional checks, not single-keyword or literal-match tests.

If a false pass/fail occurs, we audit the cause and write a new generic test. For example, to catch the battery-charger issue, we’d add multiple test cases with varied wording (phones, laptops at 5%, etc.) to ensure our rule generalizes. We never alter the model output to force a pass; we only adjust the *evaluator code* or new invariants.  In this way, each bug becomes a new rule or metamorphic relation, driving the evaluator to be more precise.

# 7. Stochastic statistics and repeat policy

Since TinyRustLM can be stochastic (temperature, sampling), our policy is:

- **Fixed seeds per-case (repeatability):** By default, each test case is evaluated with a **predefined seed**. This ensures reproducibility: the same seed always produces the same output, so we can verify failures exactly. For final gate decisions, we may run *N* seeds per case to estimate stability.  For example, we might require that the model “passes” the case in ≥90% of seeds (a confidence interval on pass rate).

- **Confidence intervals:** Treat each test case result as a Bernoulli trial (pass/fail).  Over multiple runs, compute a confidence interval for the pass probability.  We only consider a case passed if the lower bound of the 95% CI exceeds the required threshold.  This quantifies uncertainty and prevents a single lucky sample from granting a pass.

- **Correlated failures:** If test cases are not independent (e.g. variations of the same scenario), we cluster them and account for correlation.  Overlapping input content reduces the “effective N” of samples, inflating variance. In practice, we might use cluster-robust standard errors or ensure holdout cases are sufficiently dissimilar.

- **Multiple comparisons:** We guard against cherry-picking by correcting for multiple test criteria.  For example, if a model must pass 100 independent tests, the chance of fluke increases.  We set per-test thresholds (e.g. p<0.01 for each) so that the family-wise error stays low, or we use False Discovery Rate control across rubrics.

- **Flaky infrastructure:** We repeat any evaluation on different machines/environments to rule out nondeterministic faults.  If a case sometimes fails due to a timeout or out-of-memory (and those are unrelated to model logic), we mark it as “infra error” and exclude it from scoring until fixed.

- **No “best-of-N” selection:** We **never** cherry-pick the best output across multiple trials unless *this is documented behavior of the product*. In other words, we evaluate each sample’s output as the model produces it, not allow the system to run it N times and choose the most favorable response. Doing the latter would inflate success rates and create a false impression of quality.  (If the product claims “we use top-5 sampling and pick the best,” then we must measure exactly that process. Otherwise, we treat best-of-N as an invalid “cheating” metric.)

- **Reporting:** For each metric we report point estimates and 95% confidence intervals (CI) over seeds.  We treat overlapping CIs as indicating uncertainty; only non-overlapping CIs imply significant difference.  If comparing models, we recommend a formal paired test on their outputs rather than just checking CI overlap.

In summary, evaluation results are treated statistically: a model is considered to *pass* a test only if the pass probability is high and statistically confident. We document all seeds used, and any random sampling is fixed or averaged. This prevents spurious findings from stochastic noise.

# 8. Cryptographic evidence and versioning schema

We treat every element of the model–evaluation pipeline as an **auditable artifact** bound by cryptographic hashes, inspired by AI Supply Chain (AIBOM) principles:

- **Content-addressable identities:** Each static artifact (model weights file, tokenizer config, code repo commit, system prompt text, sampling parameters, runtime binary, evaluator binary, test-case file, holdout generator code) is hashed (e.g. SHA-256) when used. These hashes are recorded in a “bill of materials” for the evaluation. For example, the model’s binary weight file has digest `H_model`; the Rust evaluator binary has `H_eval`; each test file and seed have `H_case`. All are logged together.

- **Manifest (AIBOM):** We maintain a machine-readable manifest (like a CycloneDX SBOM) that lists each artifact name, its cryptographic digest, version or commit identifier, and provenance. This becomes our source of truth. For instance, it might record: `model: v1.2 (commit abc123)`, `rust_runtime: v0.9 (bin hash 0xdeadbeef)`, `tokenizer: 2026-07-14 build (hash 0x111222)`, etc.

- **End-to-end binding:** Whenever we run an evaluation, the manifest is signed or hashed as well, linking to all inputs and outputs. Even the *raw model outputs* (the text generated) are saved and hashed, then tied into the manifest. Finally, the final decision (pass/fail) is a function of these hashed inputs. This creates a cryptographic chain: given the manifest and any one hash, we can verify the entire context of that evaluation.

- **History tracking:** When the evaluator code or pipeline changes (e.g. we add a new rule or adjust a classifier), we treat it as a new version. The new evaluator’s binary and manifest get a fresh digest. We do *not* overwrite old evaluation results. Instead, we archive the prior manifest and hash chain. This way, each evaluation result can be traced to exactly which version of each component was used.

- **Immutable logs:** We store all evidence (manifests, logs, decisions) in an append-only repository. Each evaluation run produces a new cryptographic checkpoint. If the evaluator logic is updated, a new checkpoint is issued; previous checkpoints remain immutable references.

This design follows best practices for verifiability. For example, [28] describes how embedding cryptographic identifiers into an AI artifact’s metadata makes the pipeline “reproducible, audit-able, and securely integrated into regulatory audit pipelines”. By hashing everything from the model binary to the final verdict, we ensure **no cheating**: one cannot retroactively adjust a test without breaking the hash chain. Even the *source of random seeds* is recorded. If an artifact is missing or altered, its hash won’t match, signaling tampering.

# 9. Human review and independent-audit protocol

We require an **independent** audit team and red-team testing separate from model developers:

- **Blinded human evaluation:** A set of human evaluators (ideally 3–5 per example) rates model outputs on rubrics (correctness, helpfulness, safety). Evaluators are blind to which model produced each output and to each other’s labels. We randomize output order to minimize bias.  For example, outputs from candidate and baseline are pooled and shuffled; judges don’t know which is which.

- **Inter-rater reliability:** We train annotators on clear guidelines. During labeling, we compute inter-rater agreement metrics (Cohen’s κ, Krippendorff’s α) for each rubric. We aim for κ≥0.6; if below, we revisit the rubric or train evaluators more. Results are reported with confidence bounds and κ scores, not just means.

- **Calibration and drift checks:** We maintain a gold set of human-checked cases. Periodically (e.g. monthly) we re-run the model (or judge model) on the gold set. If its performance drifts (human–machine κ falls below threshold), we recalibrate. This may involve updating prompts, switching judge models, or retraining classifiers. This ensures the evaluation criteria remain stable over time.

- **Challenge/Red-team sets:** We curate specialized challenge sets focusing on:
  - *Censorship/jailbreak:* prompts that try to induce prohibited content, checking for over- or under-refusal.
  - *Over-refusal:* legitimate requests that the model might wrongly refuse (e.g. non-sensitive advice) – ensuring helpful answers.
  - *Fabricated certainty:* checks for unjustified claims; e.g. vague “some studies” without citation.
  - *Unsafe/impossible advice:* tests that the model doesn’t give advice that’s dangerous or logically impossible.

  These sets are developed by security and ethics experts, not by the core dev team. Red-teamers try adversarial prompts (inclusion of hidden instructions, tricky phrasing) to probe failure modes. Any issue found is fed back into invariants or model adjustments, but the red-team’s results remain recorded as independent evidence.

- **Evaluator drift monitoring:** We log changes in evaluator tools themselves (if the judge model or rule set changes, that’s a new version as described). We also run blind evaluation batches regularly to detect any unintended shifts in model behavior.

- **Independent audit:** A separate group (with access only to logs and model outputs, not training data) performs spot checks: re-evaluating cases and confirming verdicts. They ensure that evidence (seed, output, decision) matches the manifest. Inter-rater agreement and blind comparisons are re-validated.

In short, the human element is treated rigorously: it is a statistical measurement process, not assumed infallible. We explicitly quantify uncertainty, report agreement statistics, and design the protocol to minimize biases (e.g. anchoring, hostility to long answers).  This hybrid human–automated approach catches subtle issues that pure automation might miss.

# 10. TDD implementation sequence with acceptance criteria

We adopt a **test-driven workflow** for adding any new semantic detector:

1. **Retain the raw failure:** When a semantic issue is found (e.g. in user testing or production), we log the entire context: seed, input, and raw model output. This evidence is frozen in the test suite (in a ‘failures archive’).

2. **Write a minimal failing test:** Create a new automated test case that captures the failure pattern *generically*. For example, if the model ignored a low-battery scenario, we write a test that looks for advice about charging when a device has low percentage. The test should *fail* on the current evaluator (without checking for a specific phrase).

3. **Add positive and counterexamples:** Expand the test to include a passing example (if applicable) and a negative example to avoid overfitting. For instance, include a case where recommending a charger is correct (to ensure the detector doesn’t block all “charger” mentions).

4. **Run full suite:** Execute the entire eval pipeline. The new test should fail while other tests still pass. This confirms the test is specific.

5. **Implement the detector:** Modify the Rust evaluation code to catch this pattern. This might be adding a new rule or updating a regex. Write comments in the code describing the rule and any parameters (e.g. what keywords it looks for).

6. **Regression suite:** Rerun all tests. The new test should now pass (fix), and no old tests should break. We also regenerate holdouts if needed.

7. **Versioning:** Commit the updated evaluator as a new version (bump the manifest’s evaluator hash). Log this change in the audit trail.  Archive the previous decision logs for posterity (never delete or override them).

8. **CI gate:** In continuous integration, include this test. The PR should not merge unless the suite (including the new test) passes. This ensures the issue is permanently guarded.

9. **Never overwrite evidence:** The failing output that motivated the test is kept as part of the record. Our acceptance criterion is that the *generic test* passes, not that the model produces a specific answer. We do not use techniques like answer-completion or post-editing to “fix” the model output before scoring.

This TDD cycle parallels software engineering best practices: write test first, see it fail, then implement behavior. We also tag the test with metadata (issue ID, date, etc.) so its origin is clear. The acceptance criterion for each detector is simply that all relevant tests in the suite pass after the change, with no unintended regressions.  Finally, we version the evaluator and retrigger only the evaluation jobs (not retraining any models at this stage), so that the evidence history remains consistent.

# 11. Adversarial test matrix

We generate a matrix of adversarial transformations to stress-test invariants. For each transformation, we note whether the model’s **correctness verdict** should remain *invariant* or change:

| **Variation**                         | **Expected effect on verdict**                                  |
|---------------------------------------|----------------------------------------------------------------|
| **Change entity names** (Alice→Bob)   | *Invariant:* Answer adapts names but logic same.               |
| **Synonyms / paraphrases**            | *Invariant:* Core meaning same, answer should match semantically.  |
| **Reorder list of options**           | *Invariant:* Decision logic unchanged (just different presentation).  |
| **Add irrelevant detail** (“BTW: X”)  | *Invariant:* No effect; model should ignore distractor.        |
| **Flip numeric values (keeping order)** | *Invariant:* If ordering of sizes is same, the correct choice is the same (with values updated).  |
| **Swap numeric values (changing order)** | *Alter:* The better option flips; the answer should reflect the new ordering. |
| **Units synonym (kg↔lbs)**            | *Invariant:* Answer logic unchanged; numeric value should convert but conclusion same.  |
| **Authority order (cite A then B, vs B then A)** | *Invariant:* Argument points remain, though explanation order may change. |
| **Sentence order** (swap clauses)     | *Invariant:* Meaning preserved; answer content same.           |
| **Explicit negation** (“not X”)       | *Alter:* Answer stance flips (approve→disapprove).             |
| **Implicit negation** (“I didn’t go”) | *Alter:* Understanding changes; output adjusts accordingly.    |
| **Polite vs terse style**             | *Invariant:* Only tone changes; factual content should not.    |
| **Casual vs formal wording**          | *Invariant:* Same meaning, only style differs.                 |
| **Irrelevant distractor sentence**    | *Invariant:* Should have no impact on the answer.              |
| **Malicious hidden instructions**     | *Invariant (should ignore):* The answer must *not* follow any hidden directive. The verdict (pass/fail) should not change because of obfuscated instructions. |

For example, we expect paraphrased inputs to yield answers that still satisfy our rules – a paraphrase invariant.  In contrast, negating a key condition is a functional change and the answer *should* invert.  These matrix entries become meta-tests: the evaluator checks whether the model’s answer on the transformed input yields the same classification result (if invariant) or the logically opposite result (if variant).  Any deviation (e.g. invariant case changed) is flagged.

# 12. Unknowns requiring private output inspection

Certain aspects cannot be fully tested via black-box evaluation and would need internal inspection:

- **Latent state / hidden logs:** For example, how the model uses its internal token embeddings or memory is opaque.  We cannot verify from output alone if the model silently accessed unauthorized memory segments or tooling.  Private “internal states” (attention weights, hidden layers) are not observable in output.

- **Gradient updates or fine-tuning triggers:** If the runtime environment includes adaptive fine-tuning, that state change isn’t visible externally.  Testing whether the model updated itself (or its embeddings) as a result of input cannot be done purely by output.

- **Training data provenance:** We cannot by output alone determine if the model has memorized a specific private text or copyrighted content.  Only by inspecting the training set or weight-attribution methods could we detect, say, hidden data leakage.

- **True randomness or hardware faults:** If the hardware RNG is used or there are nanosecond timing behaviors, those are outside output semantics.  Also, bugs in the Rust binary (e.g. memory leaks) would need code inspection.

- **User profile/data isolation:** We assume private user data stays isolated. Verifying no cross-talk (e.g. no leakage of another user’s data) is only possible with direct access logs.

- **Compiler/hardware quirk exploitation:** If the model binary or Rust runtime were maliciously modified to produce certain outputs (a trojan weight file), output testing alone might not reveal the cause.

In practice, these unknowns would require auditing the model’s code, training logs, or performing white-box vulnerability scans.  We note them as blind spots: for instance, adversarial trainers might embed steganography in model weights that our tests cannot detect.  Mitigations include secure development practices, third-party code audits, and running separate integrity checks on model binaries beyond this evaluation pipeline.

# 13. Current primary sources and directly linked research

- Wei Ma *et al.*, **“Rethinking Testing for LLM Applications: Characteristics, Challenges, and a Lightweight Interaction Protocol”** (ArXiv, 2025). Provides a multi-layer evaluation framework and emphasizes semantic over exact-match checks.
- Zheng *et al.*, **“Bidirectional Empowerment of Metamorphic Testing and Large Language Models: A Systematic Survey”** (ACM CSUR, 2026). Surveys metamorphic testing for LLMs and describes semantic relations (e.g. invariance under synonyms/paraphrases).
- Steven Cho *et al.*, **“LLMorph: Automated Metamorphic Testing of Large Language Models”** (ICSME 2025). Describes LLM-oriented metamorphic relations and test tools.
- Tad T. Brunye, **“Human Evaluation of Large Language Models: A Review and Protocol Selection Framework”** (MDPI AI, 2026). Reviews best practices in human evaluation (inter-rater reliability, blind protocols) and the STEP-V framework.
- Song *et al.*, **“AI Supply Chain Security: MBOM-PQC Provenance, PQC Attestation…”** (MDPI ACM Transactions on Cyber-Physical Systems, 2024). Introduces AIBOM/MBOM concepts for binding AI artifacts with cryptographic identities.
- *FutureAGI Team*, **“LLM Evaluation Architecture 2026”** (FutureAGI blog, 2026). Describes a tiered CI-based evaluation pipeline with heuristics (Tier 1) up to human gold-set (Tier 5), including calibration loops and regression gates.
- *Cameron R. Wolfe*, **“Applying Statistics to LLM Evaluations”** (2024) – a tutorial on confidence intervals and significance testing for LLM pass rates. (Used for general statistical guidance.)

All sources are cited with direct quotes or paraphrases above. Each informed the design of our evaluation system: for example, [76] guided our confidence-interval approach, and [51] illustrated multi-tier gating and calibration loops. These references and others form the basis of a rigorous, transparent evaluation pipeline for TinyRustLM.