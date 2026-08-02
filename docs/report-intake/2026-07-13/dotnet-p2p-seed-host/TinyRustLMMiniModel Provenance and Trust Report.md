# TinyRustLM/MiniModel Provenance and Trust Report

## 1. Publicly Verified Facts and Explicit Unknowns

- **Model identity and source.**  The target model is **Qwen/Qwen2.5-1.5B-Instruct** (an instruction-tuned 1.5B-parameter model).  Its official model card on Hugging Face shows **License: Apache-2.0**, and the LICENSE file confirms *“Copyright 2024 Alibaba Cloud. Licensed under the Apache License, Version 2.0…”*.  A Qwen blog confirms that *“all our open-source models… are licensed under Apache 2.0”* (excluding some larger variants).  The model’s files (checkpoint, tokenizer, config, etc.) were last updated “almost 2 years ago” according to Hugging Face.  The model card and documentation make clear this is an Alibaba/Qwen-developed model (e.g. “You are Qwen, created by Alibaba Cloud” in the README).

- **TinyRustLM fixture.**  The **TinyLM-16M deterministic fixture** (a tiny 4,824-parameter model) is publicly listed in the MiRust catalog as “Observed TinyRustLM SLM1 f32… deterministic runtime smoke only; no trained assistant quality is claimed”.  This confirms the policy that trivial models are marked **runtime-smoke-only** and not conflated with a full conversational model.  (The 8.6 KiB fixture is marked similarly).

- **Licensing facts.**  Both sources above confirm Apache-2.0 for Qwen2.5-1.5B-Instruct.  MiRust’s policies require recording the *exact license identifier* and hashing the license text.  All model artifacts must include exact source revision and license metadata.

- **Provenance framework.**  The TinyRustLM/MiniModel architecture prescribes an **SLM1 model container** with a header that binds the model to its source and evidence.  ModelBreeder documentation shows that a TinyRust runtime produces a *“release packet”* containing the model and adapter hashes, evaluation evidence, and diagnostics.  MiRust’s catalog enforces that no model is listed without evidence-backed verification.

- **Known constraints.**  The Qwen2.5-1.5B model is still in *instruction-only* form.  MiRust notes its *“public boundary is conversation-proven with full assistant quality still pending”* (per task requirements).  The tiny fixture (4.8K params) is confirmed never to be treated as conversational.

- **Explicit unknowns (need local evidence):**  We do *not* have independent proof of the exact **model file hash**, its safetensors shards, or the specific Hugging Face commit.  The private conversion tools (e.g. producing the `.slm`) and their outputs are not publicly inspectable.  We cannot see the local evaluation transcripts or the internal seed peer receipts.  Therefore, details of conversion input, ephemeral keys, raw quality scores, and private chain-of-custody logs are unknown.  We can only assert that those pieces *should* exist per policy.

## 2. End-to-End Provenance Graph

We trace the model’s lineage from the upstream HF repository to our catalog, annotating each artifact with identities, hashes, and assertions:

- **Upstream source (Hugging Face).**  Identity = `Qwen/Qwen2.5-1.5B-Instruct`.  We record the *exact immutable revision* (preferably the commit hash that `main` resolved to).  Licenses: Apache-2.0 (ID=`Apache-2.0`) with full license text SHA-256.  The upstream repository metadata (e.g. model card) may also be hashed or snapshot.  We log the upload timestamp from HF (e.g. “almost 2 years ago”) and verify the LICENSE file content and its CRC/SHA.  All filenames (safetensors shards, merges.txt, vocab) should be hashed and checked.

- **Local download.**  The model artifacts (safetensors and auxiliary files) are downloaded from Hugging Face.  We record the *download timestamp* and the network addresses.  We compute an overall SHA-256 digest of the complete original model bundle as a binding reference.  Any LFS or remote shards (e.g. “safetensors” files) are validated via their hashes.

- **Conversion to SLM1.**  The downloaded model and tokenizer are fed into the TinyRustLM conversion pipeline, producing a single `.slm` package (Rust/WASM-ready format).  We document the version of the conversion tool (if known), environment, and all input file hashes.  The output `.slm` is hashed (SHA-256) and its size recorded.  The SLM1 header includes fields that we bind: e.g. *source model ID*, *source revision (commit)*, *source license ID*, *modification notice text and hash*, along with *seed determination* for any deterministic conversion.  The converter should sign or digest this metadata.

- **MiniModel manifest creation.**  We produce a manifest (e.g. `models.v0.json`) with *model ID* and version.  It binds one ID to the exact artifact: byte count, SHA-256, and any `.slm` internal checksum fields (miRust’s docs mention an SLM1 “checkpoint-hash” in TinyRustLM’s header).  We include *fixed-piece layout* if the `.slm` is chunked, computing a Merkle root of the piece hashes.  We attach “source metadata”: the Qwen model ID, source commit SHA, license ID (`Apache-2.0`) and exact license-text SHA, a *modification notice* (e.g. “Instruction-tuned from Qwen2.5 base”), plus its SHA.  We also link any “conversation evidence” (seeded chat transcripts) and “quality evaluation evidence” by hash.  The manifest lists the *quality tier* (initially conversation-proven) and any *known limitations* tags (e.g. “bi-modellicensing or data-constraints” as per policy).  Finally, we include *peer metadata*: for example, identifiers of seed peers or IP addresses that hold pieces, possibly signed proofs of storage.

- **Local serve/import receipt.**  After serving the model locally (e.g. via IPFS or a local catalog), the system logs a receipt: who (device ID) served it, when, and hashes of what was served.  This receipt is signed by the local host’s key and stored.  (This ensures that a node claiming to offer the model has indeed seen the exact artifact.)

- **External reachability receipts.**  The model should then be fetchable by an independent peer.  When a peer fetches pieces from us, it can optionally log its own receipt (with our peer signature) showing reachability.  This provides “outside-network proof” that the model is available.  (Until two independent seed peers publish receipts, the model should not be publicly announced, per policy.)

- **Catalog announcement.**  Once provenance and quality evidence are collected, the model is announced in the mini-model catalog.  This includes publishing the manifest (signed) and a summary of evidence.  We log the announcement event (timestamp, who posted it).  From this point, the model transitions to an active catalog entry with its attached evidence references.  

Throughout, every artifact (source files, .slm, manifest, receipts) is tied by cryptographic hashes and signatures.  For example, the TinyRustLM runtime’s “release packet” pseudocode shows returning *parent_model_digest = HASH(model_bytes)* and *eval_evidence*.  In practice, we store all such hashes in a tamper-evident ledger (the MiniModel manifest itself can be hashed or signed).  Claims (like “conversation-proven”) are separated from these facts: we only assert them once the evidence (chat transcripts, metrics) have their own hash stored.  

## 3. Recommended Manifest/Evidence Fields and Validation Rules

We propose a JSON manifest schema (versioned) that enforces the following fields (each validated exactly):

- **`model_id`**: a unique canonical name (e.g. `Qwen2.5-1.5B-Instruct_v0.0.1`).  Must match a strict naming regex to avoid Unicode confusables or path escapes.  
- **`artifact_bytes`**: integer byte count of the `.slm`.  Validate equals actual file size.
- **`sha256`**: SHA-256 of the `.slm` file (in hex).  Must match a freshly computed hash during validation.
- **`slm_checksums`**: (if applicable) internal SLM1 checksums (e.g. segment or tensor directory hashes).  Validate against known SLM1 spec.
- **`pieces`**: list of piece hashes or `piece_list_hash`.  If large, we store a Merkle root under `merkle_root`.  Each piece size should be fixed, and the number of pieces implied by `artifact_bytes`.  Validate merkle chain if pieces are separately stored.
- **`source`** (object):
  - `model_id`: original upstream identifier (`Qwen/Qwen2.5-1.5B-Instruct`).
  - `commit_hash`: full immutable git or hub commit SHA from the source repo.  **Reject** if empty or if resolution (via API) yields a different SHA.
  - `license_id`: SPDX identifier (must be e.g. `"Apache-2.0"`).  **Reject** unknown or local-named licenses.
  - `license_hash`: SHA-256 of the exact license text (the one in repository).  Validate by downloading or caching the license file and hashing.
  - `modified_notice`: short string describing our modifications (“Instruction-tuned, converted to .slm”).  This must be human-readable and hashed (see below).
  - `modified_hash`: SHA-256 of a detailed *modification notice file*, if used (e.g. diff or explanation).  This file is stored privately but its hash goes here.
- **`conversation_evidence_hash`**: SHA-256 of the chat transcript evidencing basic conversational ability (see Tier 4 below).  The transcript itself is private, but this hash (and a summary) is public.
- **`quality_evidence_hash`**: SHA-256 of the evaluation results file (scores or logs).  Again kept private, but hashed here.
- **`quality_tier`**: enumerated string: one of `runtime-smoke-only`, `structural-only`, `conversation-proven`, `task-specific-proven`, `full-assistant`.  Only these exact values allowed.
- **`limitations`**: (optional) list of known limitations or disallowed uses (e.g. `"medical"`, `"privacy-sensitive"` if relevant).  Free text with validation (no script tags, max length).
- **`created_at`**: UTC timestamp of manifest creation (ISO 8601).  
- **`publisher_key`**: ID or fingerprint of the key that signed the manifest.
- **`signature`**: The manifest is signed (e.g. with ED25519/DSSE) and the signature block is included.  We verify it matches the listed `publisher_key` and is valid.
- **`peers`**: list of peer identifiers known to hold the model pieces.  (These could be hostnames, IPs, or DHT addresses, validated if public.)

**Validation rules:** The manifest JSON must conform exactly to this schema. No unknown fields are allowed (reject if any extra keys).  Numeric fields must be in range (e.g. byte count > 0). Strings must match expected formats. Unicode should be normalized (e.g. NFD/NFC) to prevent homograph attacks. We must reject any file paths that include `..` or absolute roots.  We verify the `sha256` by recomputing it on the `.slm`. We fetch and verify the upstream commit (e.g. via HF or git) to ensure `commit_hash` truly corresponds to `model_id`.  We fetch the license file (or trust our cached copy) to ensure `license_hash` is correct.  If `license_id` is Apache-2.0, its text must exactly match the known Apache-2.0 license (modulo copyright notice).

The manifest should be **versioned** (e.g. JSON property `manifest_version: 1.0`) so the schema can evolve.  We recommend using a digital-signature container (like DSSE) to embed the JSON and signature together, which prevents any tampering of fields.

## 4. Qwen2.5-1.5B Licensing and Notices

**Primary licensing fact:** Qwen2.5-1.5B-Instruct is released under **Apache License 2.0**.  The HF repository’s LICENSE file explicitly states “Licensed under the Apache License, Version 2.0”.  (The Qwen team’s blog likewise confirms Apache-2.0 for all open Qwen models).  We treat this as authoritative.

**Obligations:**
- *License text retention:* We must keep the exact license text and include it with any redistribution.  MiRust policy says to record the *exact license identifier and hash*.  Therefore, we embed the full Apache-2.0 text (with the Alibaba Cloud copyright notice).
- *Modification notice:* If we alter or convert the model, we must add our own notice.  The Apache license encourages putting a notice like “This work is based on [Original Model] by [Original authors]”, but at minimum we should include a clear modification statement.  We will store this in a NOTICE file (or manifest field) and hash it as `modified_hash`.
- *Attribution:* The original notice on Apache-2.0 requires preserving the copyright attribution (“Copyright 2024 Alibaba Cloud”).  We must keep that visible.  We should also credit the Qwen team (e.g. “Qwen Team (Alibaba Cloud)”) in documentation or in our model card to respect authorship.
- *Redistribution:* Apache-2.0 permits redistribution and modification.  We can redistribute the model and converted weights, including commercial use.  No copyleft obligations (unlike GPL), but we must maintain license and notices.
- *Patent grant:* Apache-2.0 includes a patent license.  We should note that downstream users are granted any patents on the model under the license.  (This is not an immediate issue unless disputes arise.)
- *Trademarks:* Apache-2.0 does NOT grant trademark rights.  Any mention of “Qwen” or logos should be treated as a trademark license issue.  If Alibaba has a Qwen trademark, we should avoid implying endorsement.  (Consult legal: for example, using the name “Qwen” as model ID is arguably nominative use, but it’s a question for counsel.)
- *Distribution restrictions:* There is no “copy-left” enforcement.  We should verify that none of the model’s content (training data, tokenizer vocab) is separately licensed (e.g. no hidden third-party copyright).  The Qwen license appears to cover all model files.

**SPDX and license metadata:** In the manifest we use `“license_id”: "Apache-2.0"` (SPDX tag).  We record the full text’s SHA-256 as `license_hash`.  If any doubt remains about modifications, we might include a “NOTICE” file if required by Apache (the license suggests a NOTICE for any added attribution requirements).

**Counsel questions:** Legal review should confirm that no additional patent or export restrictions apply.  For example, if the model was trained on licensed data, that might impose limits (not apparent here).  We should ensure we comply with any Qwen-specific clauses (though likely none beyond Apache).  Another question: if we later fine-tune or adapt the model (e.g. quantization), Apache-2.0 still applies, but we must ensure our contributions are licensed (the manifest includes an SPDX 3rdParty if needed).  Ambiguous/custom licenses are not present here; Qwen has a clear open license.

## 5. Quality-Tier Semantics

We define a **tiered quality rubric**. Each tier requires its own evidence before promotion:

- **Runtime-Smoke-Only:** The model *loads* and runs deterministically on fixed inputs, but no generative quality claim.  Evidence: a minimal test (“fixture”) with deterministic outputs (same seed produces same output).  No open-ended evaluation.  As seen in MiRust’s verified entries, the small 16M and 8K models are marked this way.  Promotion gate: simply passing the build and smoke-run tests with fixed seed.  *No claim of conversational ability is made*.

- **Structural-Validation-Only:** The model’s structure (shapes, quantization, tokenizer) is fully validated.  For example, we verify that the model can process inputs to outputs without errors, and that the JSON config (if any) is well-formed.  Evidence: a suite of structural tests (shape checks, reading/writing, tokenization tests).  Seeds and raw outputs are preserved to ensure *raw generation preservation* – we do not, for instance, normalize or truncate outputs at this level.  This tier is not explicitly named in policy but could be intermediate before conversational testing.

- **Conversation-Proven:** The model can engage in basic dialogue.  Evidence required: a *prompt suite* of multi-turn chats where the model (acting as assistant) provides coherent replies.  We record the exact prompts and replies on a deterministic seed (so results are reproducible) and hash the transcript.  Requirements: conversations should remain on-topic, answer queries correctly, and handle simple context (e.g. follow-up questions).  We check *conversational coherence* (no abrupt topic shifts) and *common-sense correctness* (no blatantly wrong facts) in these transcripts.  We also perform *no-cheat checks*: e.g. if the prompt was directly from an evaluation set, ensure the model isn’t simply outputting memorized lines (we would catch identical answers on different orders).  Truncation: we ensure prompts and outputs are within model limits (no silent cutoff).  If JSON output is expected (say for API), we do a “JSON repair” pass to measure how often minimal fixes are needed (but the goal is valid JSON at first pass).  Upon passing this suite, the model can be labeled **conversation-proven**.  *It is not yet full assistant quality*; we label it assistant-pending.

- **Task-Specific-Proven:** Here the model is tested on specialized tasks beyond chat.  Evidence: benchmark suites for coding, math, reasoning.  For example, run the model on code-generation problems (check if code compiles or meets specs), math word problems (check numeric accuracy), and common-sense QA.  We again use fixed seeds and inspect raw output (no answer smoothing) for fairness.  For math tasks, we allow the model to internally use calculation reasoning (or supply an attached calculator step if policy permits), but we emphasize *the model itself must not simply paste from known solutions* (looking at answer diversity).  Passing these tasks with acceptable accuracy (for non-expert level) promotes the model to this tier.  Note: math may be allowed as a tool, but we rate the model on how often it correctly decides to use a tool or compute. 

- **Full-Assistant-Quality:** This is the highest tier.  The model must demonstrate broad, reliable performance across varied open-ended interactions.  Evidence: comprehensive evaluation including adversarial and creative prompts, multi-domain tasks, and safety tests (within allowed scope).  The model should respect the user’s instructions (cognitive liberty) without injecting unauthorized content or hallucinations beyond known limits.  There must be *no undisclosed harmful behavior*.  We would run additional tests (e.g. openAIEval style) and measure scores.  Only if all checks (coherence, creativity, accuracy) exceed our threshold do we promote to full-assistant.  Until then, the model remains in *task-specific* or *conversation-proven* status, and we explicitly note limitations (e.g. “not recommended for high-stakes advice”).

**Common considerations:** For all tiers, we preserve raw generation (no post-editing), use deterministic random seeds, and version our prompt suites (so we know exactly which test cases were used).  We avoid “benchmark leaks”: test prompts should not be public until after evaluation to avoid model overfitting.  We also guard against *fixture memorization* by varying prompts slightly.  In short, each promotion requires binding evidence (transcript or scorecard) with cryptographic hash, so that claims can be audited against private logs (see next section).

## 6. Evidence Publication and Privacy Policy

We must publish model claims without revealing sensitive evaluation data.  Our approach is to **hash-bind** private evidence, inspired by the “hashmark” protocol:

- **Publish a bounded summary:** For each evaluation, we release only aggregate metrics or binary pass/fail outcomes and a cryptographic commitment to the detailed evidence.  For example, for a chat test we might say “achieved 85% factual accuracy on the 100-chat suite” and provide `chat_suite_hash = SHA256(concatenated transcripts)`.  This lets others verify consistency without seeing the actual prompts or answers.

- **Hash private logs:** All raw transcripts, prompts, and outputs from evaluations remain local.  We compute their SHA-256 (or another slow hash, if needed) and include the hash in the manifest.  This is analogous to hashing passwords: one cannot reconstruct prompts from the hash, but any party who claims to have the same evidence can prove it by showing the hash.

- **Binding claims to evidence:** The published manifest includes the `conversation_evidence_hash` and `quality_evidence_hash`.  Any query about our evidence would require producing a matching dataset (or revealing it under NDAs), but the hash proves it hasn’t been altered.  This satisfies the requirement to remain *auditable* – an auditor can challenge us to open our logs privately and verify the hash.

- **Privacy safeguards:** Evaluation data might contain proprietary prompts or personal data (e.g. user utterances).  We ensure logs have no embedded PII; we might use synthetic or public-domain prompts.  Weight files and conversion keys are never published.  Only the hashed digests of these artifacts go in public records.

- **Minimum public evidence:** We publish only what is necessary: model metadata (ID, size, license), summary scores, and hashes.  This “least disclosure” approach allows external parties to trust our claims without seeing raw secret data.  It strikes a balance between transparency and confidentiality.

## 7. Signing, Delegation, and Revocation Architecture

To ensure authenticity of manifests and events, we recommend a multi-layered signing infrastructure:

- **Ed25519 signed envelopes:** As a starting point, every manifest (and major evidence file) should be signed by the publisher’s private key using a modern algorithm like Ed25519.  We embed the signature in a DSSE envelope or a similar structure.  The public key (or its fingerprint) is recorded in the manifest.  Verifiers recompute the manifest hash and verify the signature, ensuring the content hasn’t been tampered with.

- **In-Toto attestations:** We align with the in-toto framework for supply-chain security.  Manifests can include an in-toto style “statement” (e.g. predicate `model-breach/v1.0`) and a DSSE-wrapped signature.  This allows richer metadata (e.g. what steps were run to build the model) to be signed and verified in a standardized way.

- **Sigstore/Transparency logs:** For ease of key management and audit, we can use Sigstore’s keyless signing option.  This generates ephemeral certificates tied to an email/GitHub identity and automatically logs signatures in an append-only transparency log.  Anyone can later verify that the model’s signature is publicly logged, preventing stealthy re-signing.  Transparency logs provide proof-of-inclusion via an append-only Merkle log, giving high trust that no backdoor signing occurred.

- **TUF-style role separation:** Borrowing from The Update Framework, we assign roles: a **root** key (offline, highly secured) that can sign new delegations; a **targets** key (or multiple delegated keys) that sign the manifests themselves.  This way, daily operations use delegated keys, while the offline root key can be rotated or revoked if needed.  Delegation allows, for example, different teams to sign models in specific categories.

- **Key rotation and revocation:** We establish a key rotation schedule (e.g. yearly) and a revocation procedure (if a key is compromised, issue a signed revocation certificate to remove trust).  Delegated keys can be replaced by updating the manifest of authorized keys (which itself is signed by the root).  Sigstore’s certificate transparency mechanism aids in detecting rogue keys.

- **Threshold signing:** For highest assurance (e.g. for “active” status release), we could require *m-of-n* key signatures (e.g. 2-of-3 officers must sign off).  This can be done by bundling multiple signatures (DSSE allows multiple signatures) or using a threshold cryptography scheme.

- **Transparency log monitoring:** Model signers should monitor the Sigstore/GitHub log for any unexpected signatures on their model (as encouraged by Sigstore’s guidance).  This would alert if someone else tries to sign a malicious variant with their key.

- **Offline-release keys:** The root key (and any high-value keys) should be offline (hardware token or air-gapped machine).  We can publish their fingerprints in the catalog so verifiers know them.  For example, a known CD key that signs the initial manifest.  This mitigates the risk of an attacker forging catalogs out-of-band.

In summary, we recommend starting with a straightforward Ed25519 signature for manifests (using Sigstore to log it).  As the system matures, we can integrate full TUF/in-toto workflows with multiple roles and threshold keys.  This provides a clear upgrade path from simple signing to robust supply-chain attestations.

## 8. Catalog Lifecycle State Machine

We define distinct states for a catalog entry:

- **Admission:** Initial submission of a model entry (manifest posted to a staging area).  In this state, the entry is **pending verification**.  It is not yet listed publicly.  Administrative checks (license, schema) are performed but content awaits evaluation results.  

- **Pending:** The model has passed basic format and license checks but awaits quality evidence.  It may be tested by validators.  In *pending*, the model cannot be cited as approved.  No rank or tier promotion occurs yet.

- **Active:** The model has passed all checks (proven at least conversation-proven tier) and is officially published in the catalog.  Its manifest is signed, evidence logged, and any peer seeds are available.  Clients can confidently use the model reference from the catalog.

- **Superseded:** If a newer model version is admitted, the old one is marked superseded.  The old model remains retrievable (bits not deleted) but its primary claim may be downgraded or archived.  E.g. a V0.0.1 of Qwen2.5 would become superseded by Qwen2.5 v0.1.0.  We record the `superseded_by` field in the manifest.

- **Stale:** If a model’s **reachability proof expires** (e.g. no seed has checked in for 30 days) or if no active conversation test is maintained, we mark it stale.  A stale model remains listed but flagged (e.g. “Network unverified after 2026-08-01”).  This indicates it may not be currently retrievable.  Peers should refresh or alert.

- **Revoked:** If a serious issue is discovered (license violation, key compromise, detected tampering), the model is revoked.  We mark the entry revoked and **remove any trust**.  Users are advised not to use it.  Pieces may be retracted from peers.  The manifest is updated (revocation reason and date).

- **Removed:** A revoked or superseded model can be eventually removed from the catalog (especially if footprint or legal risk is high).  Removal means the entry is archived, and clients should not fetch it.  (Pieces on peer networks might linger unless a kill-switch is enforced.)

- **Quarantined:** A temporary state if, for example, we receive conflicting evidence or suspect foul play.  While investigating, the model stays hidden (effectively like pending, but if it was active it is temporarily suspended).  After resolution, it transitions to revoked or back to active.

**State transitions:** 
- Admission → Pending → Active upon successful checks.  
- Active → Superseded when a new version is published.  Active → Stale if evidence expires.  
- Pending/Active → Quarantined if irregularities are found.  
- Quarantined → Revoked (if confirmed bad) or back to Pending (if corrected).  
- Revoked → Removed after a retention period.

**Effects on peers:** If a model is revoked or removed, peers who have its pieces should be notified (e.g. via a new manifest state or CRL).  They should cease serving it.  If a model is superseded, pieces can still be served for compatibility, but the catalog will prefer the latest version.  If only quality is downgraded (e.g. a full-assistant claim fails), we may move it back to Pending or Stale, but peers with pieces can still use them with caution labels.

For example, if an upstream license changes or a violation is reported, we would move Qwen2.5-1.5B-Instruct to **revoked** until counsel clears it.  Similarly, if our validation finds the manifest’s `sha256` doesn’t match the actual `.slm`, we immediately revoke that entry and require correction before re-announcement.

## 9. Threat Model and Malformed-Input Test Corpus

We anticipate attackers who might try to compromise the catalog or ingestion pipeline by submitting malicious manifests or exploiting parsing flaws.  Key threats and test cases include:

- **Unknown JSON fields:** An attacker adds extra keys to the manifest.  We must reject or ignore them.  *Test:* Feed manifest with random additional fields (e.g. `"eval_flag": true`) and ensure parser errors or drops unknown fields.

- **Duplicate JSON keys:** Some JSON parsers allow duplicate keys (last-win semantics).  This could hide a malicious override.  *Test:* Create manifest JSON with the same key twice (e.g. two `model_id` fields).  Our system should detect duplicates and reject the manifest.

- **Unicode confusables:** Using visually similar characters to spoof IDs (e.g. Cyrillic “А” vs Latin “A”).  We should normalize or reject unusual codepoints.  *Test:* Use mixed-script names (e.g. “Qwеn” with a Cyrillic e) and verify they do not parse or are flagged.

- **Path escape sequences:** If any manifest field can contain paths (e.g. evidence file names), ensure no “../” to escape intended directories.  *Test:* Insert `"license_hash": "../etc/passwd"` or symlink strings in evidence paths, ensure validator blocks this.

- **Oversized fields:** Extremely large fields (very long strings, base64, or nested lists) can cause DoS.  *Test:* Attempt a manifest with a 1 GB string in `modified_notice` or an enormous pieces list.  The system should enforce reasonable size limits (e.g. 1 MiB per field) and reject beyond.

- **Symbolic links:** If the system eventually unpacks or stores files locally, a symlink in the package could lead to path traversal.  *Test:* Package a dummy model archive that contains a symlink from “pieces/0” to “/sensitive”, ensure extraction stops or cleans links.

- **Checksum drift:** If an attacker tries to slip in a wrong piece, the hashes won’t match.  *Test:* Tamper with a piece or `.slm` after manifest generation and see that the SHA-256 check fails.

- **Tier-claim mismatch:** Claiming a higher quality tier without evidence.  *Test:* Submit a manifest marked `full-assistant`, but with no `quality_evidence_hash`.  The validator should flag missing evidence or ignore the unsupported tier.

- **Source revision drift:** Manfest says `commit_hash = ABC`, but the actual `.slm` was built from commit `XYZ`.  *Test:* Change the upstream repo between packaging, and see if our tools detect mismatch (this is hard to auto-test, but we might re-clone and compare metadata).

- **Forged receipts:** An attacker might forge a fake receipt claiming to serve pieces.  *Test:* A peer tries to advertise it has pieces by submitting random proof; we should require signatures or logs that we can verify against known seeds.

- **Replay/rollback attacks:** Someone replays an old manifest or uses old evidence.  *Test:* Try feeding a known-valid manifest twice or with older timestamp.  We should have a mechanism (e.g. timestamp or monotonic version) to reject stale repeats.

- **Equivocation:** Serving different catalogs to different clients (split-view attack).  *Test:* If we replicate catalogs to two servers, we ensure they have identical content via our signing and logs.  (This is more operational).

- **Malicious catalog snapshots:** If the entire catalog JSON is signed, an attacker might supply a fake “snapshot” of catalog.  *Test:* Change one entry’s manifest in a test catalog and verify that signature or root hash fails.  The catalog should itself be signed (akin to TUF’s snapshot role).

Together, these tests form a malformed-input corpus.  We would automate many of them using fuzzing and strict JSON schema checks, rejecting any manifest that fails syntax or semantic rules.  The goal is that no malformed or malicious manifest can enter the active catalog without detection.

## 10. Test and Audit Plan

To ensure trustworthiness, we will adopt a layered testing and audit strategy:

- **Schema validation:** Implement unit tests to check that valid manifests pass and invalid ones (e.g. missing required fields, unknown fields, bad formats) fail.  Use JSON Schema or custom checks.  For each field, write tests (e.g. missing `sha256`, bad `license_id`, oversized text).

- **End-to-end ingestion tests:** Automated pipeline tests that ingest a known good model (the fixture) and verify end states (manifest updated, signature verified, model listed as conversation-proven).  These include the smoke example from MiRust.

- **Fuzz testing:** Randomly generate or mutate manifest JSON and run through the parser to ensure it handles unexpected input robustly.  Use tools like AFL or go-fuzz (if using Go) targeting manifest parsing code.

- **Signature verification tests:** Create fake manifests and test that invalid signatures are rejected.  Also test key rotation by adding/removing keys in a test TUF-like repository.

- **Security code review:** Audit the code that handles files and JSON for common vulnerabilities (XSS in any web UI, injection when constructing commands, safe hashing practices).  Ensure we use memory-safe parsing libraries to prevent buffer overflows.

- **Chain-of-custody reenactment:** Internally, simulate the entire chain (download, convert, manifest, distribute) under controlled conditions.  Compare recorded hashes at each step to expected values.  Do this regularly when conversion tools are updated.

- **External pen-testing:** Invite third-party security experts to try to break the ingestion pipeline (submit malicious manifests, try signature forgery, DDoS the service, etc.).  For example, test that uploading a manifest with a corrupt `.slm` is caught early.

- **Peer auditing and transparency logs:** We can leverage Sigstore logs as an audit.  E.g. write a script to query the transparency log for all certificates used to sign models and ensure they correspond to known identities.  This helps catch insider misuse.

- **Continuous re-evaluation:** Periodically, scheduled jobs re-run the evaluation suite on active models to detect performance drift.  If a model’s hardware or software environment changes, retest to ensure it still meets its tier.  Any anomalies move the model to **Stale** or **Quarantined** pending review.

- **Governance reviews:** Regular (e.g. monthly) governance meetings to review any corner cases, update policies (like adding new quality tests), and confirm all state transitions were appropriate.

Throughout, we document all test results and any detected issues in an audit log.  We maintain a “scoreboard” of models versus their claimed tier and evidence date.  This way, any gap (like “no conversation evidence for Qwen since Dec 2026”) is visible.

## 11. Prioritized Implementation Recommendations

1. **Define the manifest schema and JSON versioning.**  Implement strict parsing code and schema (blocking unknown keys) first.  This foundational step ensures we can safely add fields later.

2. **Record immutable upstream references.**  Whenever importing a model, immediately resolve and fix the *commit hash* (not branch).  Store this in the manifest.  Do not rely on `main` or floating tags.  This locks the source and license text.  

3. **Hashlink evidence.**  Implement the hashing of evaluation transcripts (Hashmarks style).  Ensure the manifest includes those hashes.  This creates cryptographic commitments between public claims and private evidence.

4. **Integrate signing early.**  Use a readily available DSSE/Ed25519 solution to sign each manifest.  At first, one key per publishing entity is sufficient.  Later, evolve into Sigstore for transparency logging and in-toto statements.

5. **Automate quality gating.**  Build the evaluation pipeline to automatically run conversation and task tests and produce hashed results.  Link it with the manifest generator so a manual sign-off is needed only after tests pass.  Initially, allow “conversation-proven” with minimal tests, then iterate to higher tiers.

6. **Publish a “privacy summary.”**  Create a template report that includes only the non-sensitive outputs (scores, hashes).  Standardize it so that legal/privacy counsel can review the publication policy easily.  This ensures consistency.

7. **Add catalog state management.**  Implement a small state machine for model entries (admitted→pending→active→…).  Include logic to detect stale entries (timestamp comparison) and to handle revocations (e.g. mark as revoked and propagate to peers).

8. **Initial strict rules.**  We recommend starting with conservative checks (e.g. any warning on schema fails the model) even if it slows onboarding.  We can relax as confidence grows.

9. **Document every step.**  Maintain a procedural document tying these pieces together.  Make sure all developers and reviewers know the chain-of-custody requirements and do not bypass them.  For example, forbid manual edits of key manifest fields without re-signing.

10. **Plan upgrade path.**  While building the first version, lay groundwork for future: e.g. use a common signing format (DSSE) so we can plug in new attestation types.  Track outstanding tickets for threshold signing or certificate rotation, and prioritize them as second-phase work.

## 12. Questions Requiring Local Evidence or Legal Review

- **Upstream Source Verification:** We must obtain the exact commit hash of the Qwen2.5-1.5B-Instruct on Hugging Face or its GitHub repo.  Hugging Face shows last-update “2 years ago”, but the immutable SHA (used for pinning) may require API calls.  Local evidence: run `git rev-parse` on the HF repo or contact Qwen developers for the source revision.

- **License File Integrity:** The current license text’s exact SHA is known, but if the upstream license were ever changed (e.g. added NOTICE file), we would need to capture that.  Local evidence: download the HF LICENSE at import time and store it with a hash.

- **Legal obligations:** Although we can identify Apache-2.0, legal counsel should verify if any additional obligations exist (e.g. explicit Alibaba Cloud trademarks, or if any components are under different terms).  For instance, ensure the license covers tokenizer data and merges.txt content.  Counsel should review our proposed modification notice wording and any attribution statements to be safe.

- **Quality evidence logs:** To upgrade the model’s tier (e.g. to conversation-proven), we need the actual transcripts and evaluation logs.  These are private; we have to ensure they exist and meet criteria.  For now, only summary hashes are public.  If challenged, we will provide these logs offline for audit.

- **Key management:** We assume the signing keys are secure.  Local evidence: key generation and storage processes (e.g. a hardware security module or keyfile with access control).  Also, if delegating keys, evidence of delegation policy.

- **Seed node proofs:** Policy says “seed endpoints have proof” before public announcement.  We need local logs of these external receipts.  Only by having running endpoints (on different networks) retrieve the model can we claim this.  We must verify and store those receipts as evidence to move beyond pending.

- **Adversarial test logs:** We propose certain security tests above.  We must maintain logs of fuzzing attempts and results.  If an attacker later exploits a manifest vulnerability, we should have evidence that we tested that case (or we update tests and re-run).

- **Policy compliance:** Some policy items (like “no cheating”) are partly human judgment.  We should have internal review records for each model evaluation to show that an appropriate process was followed.  If issues arise (e.g. user finds a hidden defect), we need to revisit the logs.

- **Jurisdictional issues:** If Apache-2.0 is standard, fine.  But counsel should confirm that redistributing model weights to other countries has no export restrictions (unlikely for text models but worth checking).  

In summary, many technical assertions (hashes, commit IDs, test pass results) rely on artifacts only on our machines or CI systems.  We must preserve these logs and make them available under NDA if a third party audits the catalog.  Legal counsel should also review the licensing summary (especially the modification notice) to ensure we fulfill all obligations.  

## 13. Annotated Bibliography

- **Qwen Team (2024-09-19)** – *“Qwen2.5: A Party of Foundation Models!”* (Qwen blog). Announces Qwen2.5 models and licenses. Confirms open-source models (including 1.5B) are under Apache 2.0. (Retrieved 2026-07-13 from qwenlm.github.io/blog/qwen2.5)

- **Hugging Face (2026-03-16)** – *“Purpose of commit_hash in PreTrainedModel.from_pretrained”* (Hugging Face forum). Explains HF revisions vs commit hashes: “revision” can be branch/tag, “_commit_hash” is the exact commit. This underscores why pinned commit IDs are necessary. (Discussion by Namiek, retrieved 2026-07-13.)

- **Paul Bricman (2023-12-01)** – *“Hashmarks: Privacy-Preserving Benchmarks for High-Stakes AI Evaluation”* (arXiv 2312.00645). Introduces the idea of hashing benchmark answers so models can be evaluated without revealing answers. We adopt this scheme for private evaluation evidence. (Retrieved 2026-07-13 via ar5iv.)

- **OpenSSF Sigstore Team (2023)** – *“sigstore/model-transparency: Supply chain security for ML”* (GitHub repository). Demonstrates signing ML models with Sigstore (DSSE/in-toto) and recording events in transparency logs. Informs our signing architecture and use of transparency logs. (Accessed 2026-07-13; Apache-2.0 project.)

- **ModelBreeder (2026-06-29)** – *“TinyRustLM browser runtime architecture”* (ModelBreeder.com). Provides pseudocode for model loading and building a “release packet” containing model hashes and eval evidence. It illustrates the chain-of-custody concept (package identity and evaluation). (Retrieved 2026-07-13.)

- **ModelBreeder (2026-06-25)** – *“Model license policy”* (MiRust site). Governance guide stating that every model profile must record source, exact license ID, text hash, and known restrictions. This guided our manifest fields and license handling. (Retrieved 2026-07-13 via mirust.com.)

- **ModelBreeder (2026-06-25)** – *“Models directory”* (MiRust verified model listing). Shows example entries (TinyLM-16M) labeled *“deterministic runtime smoke only; no trained assistant quality is claimed”*. Confirms categorization of small models. Also contains project boundary notes. (Retrieved 2026-07-13.)

- **ModelBreeder (2026-06-25)** – *“Home – MiRust”* (MiRust site). Provides project overview and notes that “verified model sections remain empty until evidence-backed entries are published”. Emphasizes the evidence gate. (Retrieved 2026-07-13.)  

