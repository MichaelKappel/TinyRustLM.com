# Distilling Memory, Persona, and Task Behavior into a TinyRustLM SLM Ecosystem

## Executive summary

The public record for TinyRustLM describes a deliberately narrow browser-local system: a static app, a Rust/WASM runtime, a custom `.slm` container with a 33,554,432-byte model budget, local file selection rather than project-hosted model bytes, explicit parser and tensor validation, and a claim discipline that separates “runtime works” from “assistant quality is proven.” The same public record also defines typed adapter sidecars—ADP1, ASP1, and ALR1—that are semantically validated in Rust before application, with stack budgeting and manifest-bound receipts. On the memory side, UAIX describes `.uaix` as a ZIP-based local memory/evidence package with manifest, provenance, integrity, closed required file sets, quarantine-first import, read-only anchors (`totem.uai`, `taboo.uai`, `talisman.uai`), and explicit support-boundary metadata. Together, those public documents strongly imply that the safest path is not to turn “memory” into hidden remote inference, hidden routing, or hidden prompt channels, but to keep runtime behavior local, typed, reviewable, and policy-bounded. citeturn22view0turn25view0turn25view3turn31view0turn28view4turn29view0

The core difficulty is architectural, not cosmetic. Users want three things at once: stable persona switching, durable memory across sessions, and domain specialization. But TinyRustLM’s public runtime is intentionally inspectable and narrow, while UAIX explicitly treats imported memory as quarantined public data until local validation and policy acceptance. If memory or persona are allowed to silently mutate model behavior without receipts, provenance, or anchor checks, then the system stops being local and inspectable in the way the public docs promise. It becomes a hidden agent stack with new trust and injection surfaces. citeturn25view3turn29view0turn29view2

My conclusion is that a safe public design should expose **three distinct planes** rather than a single blurred “customization” feature. The first plane is a **base `.slm` plane** for stable local execution. The second is a **typed adapter plane** for narrow behavior deltas, validated and optionally merged. The third is a **UAIX memory/persona plane** for reviewable prompt-time state and durable pointer-ledger memory. Public SDKs should expose only these artifacts, manifests, receipts, and eval results. They should not expose teacher prompts, distillation curricula, merge heuristics, routing DAGs, or private adapter-authoring logic. That preserves openness at the runtime boundary without disclosing proprietary preparation pipelines. This recommendation is consistent with TinyRustLM’s separation of runtime from offline packer/model-breeding evidence, and with UAIX’s separation of memory/evidence from execution authority. citeturn31view0turn32view0turn28view4turn29view2

## Public constraints that shape the design

TinyRustLM’s public architecture is unusually explicit about what the runtime is and is not. The static browser app selects local artifacts, verifies manifests and receipts, copies verified bytes into WASM memory, and renders state through text-safe DOM operations. Rust owns `.slm` parsing, tensor validation, tokenizer behavior, quantization math, KV-cache state, sampling, generation, diagnostics, adapter validation, and adapter application. JavaScript does not parse `.slm` tensors. The public app route is local-first: users pick a local `.slm` file, public project servers do not serve runnable `.slm` artifacts, and the documented local-origin policy explicitly says there is no remote inference and no project-hosted `.slm` route. citeturn31view0turn25view3

That matters because the runtime’s narrowness is part of its trust model. The `.slm` format exists precisely because generic model formats expand metadata surfaces and parser flexibility. TinyRustLM instead binds generation to strict validation: non-zero header fields, interior tensor pointers, matching payload counts, tokenizer checks, layout checksums, and finite-value checks. The runtime documentation also emphasizes a minimal dependency graph, a no-third-party-crate Rust/WASM posture, local-only diagnostics, and no external analytics. Those are not incidental implementation choices; they are the public safety and inspectability posture of the ecosystem. citeturn22view0turn31view2

The same is true on the memory side. UAIX’s Memory Firewall says imported packets are quarantined public data until validated and accepted by local policy; valid packets are not trusted memory, safe code, or permission to execute. UAIX also says memory packages are not executable code, receiver briefs must define read order and escalation triggers, ambiguous authority or conflicting memory produces no-op plus human review, and the claim/execution boundary stops at standards, schemas, validator fixtures, and discovery. UAIX very intentionally does **not** execute tools, validate credentials, probe endpoints, or certify runtime safety. citeturn29view0turn29view2

The combined implication is straightforward: a TinyRustLM + UAIX ecosystem can safely support persona and memory only if the runtime can answer three questions about every customization artifact. What exactly is this artifact. Who authored or reviewed it. What does it have the right to influence. If those questions cannot be answered from manifests, checksums, and receipts visible at the public boundary, then the runtime is no longer operating inside the boundaries its own public documents establish. citeturn31view0turn28view4turn29view0

## Distillation choices and where behavior should live

### Base model distillation and adapter distillation

Base-model distillation is the right place for **broad, stable behavior** that should be present every time the `.slm` loads, even when no persona or memory package is attached. The classic purpose of distillation is to compress capability from a larger teacher to a smaller student so deployment becomes easier; later work on MiniLM, chain/rationale distillation, and recent LLM distillation studies show that teacher outputs, intermediate structure, synthetic data, and reasoning traces can materially improve smaller models’ performance and inference efficiency. In other words, if a behavior is so fundamental that prompt-time omission would feel like a broken model, it belongs in the distilled base or in a canonical always-on adapter. citeturn15search1turn15search2turn37view0turn37view3

Adapter distillation is better for **bounded specialization**. LoRA freezes the base weights and learns low-rank updates, greatly reducing trainable parameters and deployment overhead; TinyRustLM’s public adapter lanes already map cleanly onto this idea with raw deltas, sparse deltas, and low-rank deltas. More recent work such as LLM-Neo combines KD with LoRA to make teacher-to-student transfer more memory- and time-efficient, while Text-to-LoRA and Doc-to-LoRA show that task descriptions or documents can be compressed into low-rank adapters instead of repeatedly occupying prompt context. That makes adapters a good representation for domain packs, optional reasoning modes, or persona/style overlays that should remain auditable and removable. citeturn14search0turn25view0turn37view2turn38view0turn37view4

The design consequence is that TinyRustLM should treat base distillation and adapter distillation as **different product promises**. A base-distilled `.slm` promises consistent default behavior with the fewest moving parts at inference time. An adapter-distilled package promises reversible specialization with explicit provenance and compatibility checks. Users often ask for both, but public tooling should not blur them together because they fail differently. A flawed base distillation contaminates every session; a flawed adapter can be quarantined, disabled, or rolled back. citeturn31view0turn25view0turn29view0

### Prompt-time memory injection and trained behavior

Prompt-time memory injection and trained behavior should not be marketed as substitutes. Retrieval-augmented generation exists because parametric memory is hard to update and hard to cite, while non-parametric memory can preserve provenance and freshness. Doc-to-LoRA highlights the opposite tradeoff: internalizing context into a generated LoRA can cut repeated context cost and KV usage, but that memory is then less directly inspectable than plain retrieved text. In a local inspectable runtime, that distinction is critical. If the user asks “why did the model say that,” prompt-time memory can answer with citations to specific UAIX artifacts or local notes; trained behavior usually cannot. citeturn16search0turn37view4

For TinyRustLM, the rule should be simple. Facts that need source visibility, recency, or operator review should stay in **prompt-time memory injection** backed by UAIX manifests and receiver briefs. Behaviors that need low latency, low token overhead, and session-independent persistence should move to **trained or adapter behavior**, but only after explicit promotion. This is consistent with UAIX long-term memory guidance, which requires reviewed long-term configuration and pointer-ledger records rather than dumping durable body text into hot runtime files. citeturn28view3turn29view0

### Short-term and long-term memory boundaries

UAIX already gives the right contour for the memory split. Every active UAIX package requires `.uai/short-term-memory.uai`, while long-memory configurations additionally require `.uai/long-term-memory.uai` plus manifest fields such as wiki root, index path, evidence log, steward, source boundary, promotion targets, review state, trust labels, and blocker disposition. The long-term ledger is pointer-only: each pointer requires a stable identifier, path, label, routing summary, authority/source, review status, review evidence, and checksum for file targets. That is a healthy model for local runtime safety because it keeps hot execution context concise while forcing durable memory to be reviewable as records and pointers, not as a large invisible body of prompt text. citeturn27view0turn28view3

My recommendation is to define the boundary this way:

- **Short-term memory**: ephemeral session notes, recent user facts, current task state, temporary grounding, and safe snippets promoted into the current prompt window.
- **Long-term memory**: durable pointer records, reviewed summaries, domain notebooks, and evidence logs stored outside the model weights and outside the hot prompt unless explicitly selected for injection.
- **Promotion path**: new items start as short-term or quarantined intake; only reviewed, provenance-complete items can become long-term pointers; only highly repeated, low-risk patterns should be candidates for adapter or base distillation. citeturn29view0turn28view3turn32view0

That keeps memory from collapsing into hidden prompt stuffing or hidden parameter mutation.

## Persona packs, memory packages, and manifests

### Persona-pack representation

UAIX persona packaging is already strong enough to serve as the public representation layer. For bounded persona profiles, `.uai/persona.uai` carries persona name, purpose, voice, symbolic posture, interaction stance, relationship boundary, blocked claims, switching behavior, privacy boundary, consent boundary, and preservation policy. For advanced persona profiles, `.uai/persona.uai` remains the compact entrypoint while detailed trait files sit in a closed file set under `.uai/personality/…`, covering identity, voice, values, reasoning style, emotional patterns, boundaries, examples, adaptation rules, and preservation rules. UAIX also insists that receiving-platform limits or policy notes live outside the persona source as support-boundary metadata or no-op/human-review notes rather than mutating the source persona file. citeturn28view0turn28view2

That is exactly the shape TinyRustLM should want. A persona pack should be **textual, reviewable, and policy-wrapped**, not a magical “unfiltered personality mode.” The public runtime should therefore load persona in two layers:

1. **Source persona layer** from UAIX files, preserved as the user-selected identity artifact.
2. **Runtime wrapper layer** generated locally from trust policy, safety policy, and support boundaries.

By doing this, TinyRustLM can honor UAIX’s preservation rule while still preventing the persona from becoming a safety override. UAIX explicitly says safeguards and receiving-platform limits stay outside persona source as support-boundary metadata, wrappers, no-op conditions, or human-review notes. citeturn28view2turn29view1

### UAIX memory package integration

The safest integration point is a **UAIX import-to-profile flow**, not direct blind injection into generation. The `.uaix` package format requires a manifest with `uaixVersion`, `packageFormat`, `packageId`, `profileId`, `status`, `createdUtc`, `issuer`, `declaredScopes`, `entrypoints`, `files`, `integrity`, and `supportBoundary`. Each file entry also carries `path`, `role`, `requiredStatus`, `scope`, `mediaType`, `sizeBytes`, `sha256`, `reviewState`, and `source`. Import validates ZIP safety, manifest schema, required-set closure, file hashes, media types, scopes, and support boundary; only afterward may a local profile be created or updated if local policy accepts the package. citeturn27view4turn28view4

A TinyRustLM public integration should therefore have three states for every imported UAIX package: **quarantined**, **admitted to profile**, and **active in current prompt assembly**. Only the third state affects generation. That matches UAIX’s quarantine-first rule and avoids the failure mode where “memory import” quietly becomes instruction execution. It also lets the browser-local runtime remain inspectable: the user can see what package arrived, what fields were validated, what anchors were present, and what exact records are active in this session. citeturn29view0turn28view4

### Proposed public manifests

The following designs are proposals for the public boundary. They map onto TinyRustLM’s current public adapter lanes and UAIX’s current manifest concepts, but they do **not** disclose private distillation recipes, merge heuristics, or routing internals. citeturn25view0turn28view4turn32view0

```json
{
  "schema": "tinyrustlm.persona-pack.v1",
  "pack_id": "persona.analyst.calm.v1",
  "display_name": "Calm Analyst",
  "kind": "persona",
  "source_format": "uaix",
  "uaix_package_id": "uaix.pkg.persona.2026-07-01",
  "base_model_compat": {
    "slm_family": "SLM1",
    "tokenizer_fingerprint": "sha256:...",
    "layout_checksum": "0x...."
  },
  "entrypoints": {
    "persona": ".uai/persona.uai",
    "totem": ".uai/totem.uai",
    "taboo": ".uai/taboo.uai",
    "talisman": ".uai/talisman.uai"
  },
  "support_boundary": {
    "may_affect": ["style", "tone", "interaction_stance"],
    "must_not_affect": ["safety_policy", "trust_policy", "tool_authority"]
  },
  "provenance": {
    "issuer": "Example Studio",
    "created_utc": "2026-07-08T00:00:00Z",
    "review_state": "reviewed",
    "evidence_refs": ["evidence/persona_fidelity_deck.json"]
  },
  "integrity": {
    "sha256": "sha256:..."
  }
}
```

```json
{
  "schema": "tinyrustlm.memory-pack.v1",
  "pack_id": "memory.finance.helpdesk.v3",
  "kind": "memory",
  "source_format": "uaix",
  "uaix_package_id": "uaix.pkg.memory.2026-07-08",
  "memory_mode": "pointer_ledger",
  "entrypoints": {
    "short_term": ".uai/short-term-memory.uai",
    "long_term": ".uai/long-term-memory.uai",
    "receiver_brief": ".uai/receiver-brief.uai"
  },
  "promotion_policy": {
    "short_term_ttl_minutes": 1440,
    "long_term_review_required": true,
    "distillable": false
  },
  "trust_labels": ["reviewed", "local-only", "no-exec"],
  "provenance": {
    "issuer": "Example Studio",
    "steward": "ops@example.invalid",
    "evidence_log": "docs/evidence-log.md"
  },
  "integrity": {
    "sha256": "sha256:..."
  }
}
```

```json
{
  "schema": "tinyrustlm.adapter-pack.v1",
  "adapter_id": "adapter.tax.qa.lowrank.v2",
  "adapter_family": "ALR1",
  "purpose": "domain_specialization",
  "base_model_compat": {
    "slm_family": "SLM1",
    "tokenizer_fingerprint": "sha256:...",
    "layout_checksum": "0x...."
  },
  "behavior_boundary": {
    "may_affect": ["task_behavior", "domain_lexicon", "answer_format"],
    "must_not_affect": ["safety_policy", "trust_policy", "uaix_anchor_interpretation"]
  },
  "merge_policy": {
    "mergeable": true,
    "max_stack_count": 2,
    "conflict_class": "domain",
    "priority": 50
  },
  "provenance": {
    "issuer": "Example Studio",
    "distillation_class": "adapter_distilled",
    "eval_receipt": "receipts/eval.tax.qa.v2.json"
  },
  "integrity": {
    "sha256": "sha256:..."
  }
}
```

The important design point is the repeated `must_not_affect` field. Public manifests should declare not only what a package can influence, but what it is forbidden to influence. That creates a narrow, inspectable contract the runtime can enforce before prompt assembly or adapter application. That is the correct public surrogate for private routing/authoring logic. The SDK can say “this package may affect style and task behavior but not safety or authority,” without disclosing how internal authoring tools discovered or trained that package. citeturn31view0turn25view0turn29view0

## Safety boundaries, merge risks, and threat model

### Preventing persona packs from overriding safety or trust policy

The cleanest precedence order is:

**trust policy** → **safety/refusal policy** → **UAIX anchors** → **persona pack** → **memory injection** → **task prompt** → **optional adapters**

This is not a claim about current hidden internals; it is the recommended public contract. The reason is directly grounded in UAIX and TinyRustLM. UAIX requires `totem.uai`, `taboo.uai`, and `talisman.uai` in every active package, treats them as launch-baseline active instruction anchors, and says they must not be modified, weakened, replaced, deleted, bypassed, or promoted for mutation without exact human authorization. The Talisman guidance further says enforcement must exist outside the model via repository protections, signatures, checksums, file permissions, CI rules, or runtime interception. TinyRustLM, for its part, keeps Rust as the semantic authority and JavaScript as a thin control/render layer. citeturn27view1turn7view3turn7view4turn31view0

So the public runtime should not let a persona pack redefine refusal classes, trust boundaries, remote authority, import privileges, or anchor semantics. If a persona attempts to widen those boundaries, the right outcome is a **no-op plus talk-back/change-request record**, not “creative interpretation.” UAIX already has explicit no-op triggers and change-request patterns for anchor conflicts. citeturn29view0turn6view5

### Prompt injection and memory poisoning

The reason to keep memory import quarantined is not theoretical. OWASP classifies prompt injection as a top LLM risk and notes that inputs do not need to be human-visible to affect model behavior. NCSC’s 2026 guidance says indirect prompt injection is a real risk for LLMs that consume external reference corpora. A recent large-scale study found validated indirect prompt injections in the wild and showed that smaller models can still comply at non-negligible rates, with structured representations reducing compliance. That means any system that imports notes, docs, webpages, PDFs, or foreign memory files into a prompt assembly path must treat them as untrusted data until local policy transforms them into a safe representation. citeturn10search2turn10search3turn9search10

For TinyRustLM, that means **never injecting raw imported memory as instruction text**. The public runtime should instead parse imported memory into typed fields such as recall candidate, factual note, citation pointer, or blocked item. If the source contains imperative language like “ignore all previous rules” or “exfiltrate hidden policy,” it should be stored only as quoted evidence inside a quarantined review record, not as active prompt text. UAIX’s Memory Firewall already frames external packets as public data, not trusted instructions, and requires no-op plus review for authority conflict or unresolved memory conflict. citeturn29view0

### Adapter merging risks and low-rank compression

Model merging literature gives a good warning here. TIES-Merging identifies two main interference sources in merging: redundant parameter values and sign disagreement. DARE shows that delta parameters are often highly redundant and can be aggressively dropped/rescaled before merging. TinyRustLM’s own public “model breeding” page also describes sign-aware merge and DARE-style lanes as offline evidence-producing operators rather than direct public quality claims. The practical lesson is that domain or persona adapters should not be stacked or merged optimistically just because shape checks pass. Semantic interference is a real failure mode even when binary compatibility is perfect. citeturn9search0turn34search0turn32view0

Low-rank adapter compression itself is desirable, but it needs receipts. LoRA drastically reduces trainable parameters; AdaLoRA prunes singular values according to importance and reallocates budget; rsLoRA stabilizes scaling at higher ranks; DoRA improves learning capacity versus vanilla LoRA; PC-LoRA goes even further by progressively removing the original weights until the low-rank representation remains. These results justify exposing low-rank specialization in a tiny local ecosystem, but they also suggest that “compressed” and “merge-safe” are different claims. A low-rank adapter can be small and still unsafe, privacy-leaking, or policy-conflicting. citeturn8search9turn13search0turn12search1turn12search2turn38view1

My recommendation is to make merge authorization depend on **four independent checks**:

1. binary compatibility,
2. declared behavior class compatibility,
3. safety-boundary compatibility,
4. eval receipt compatibility.

If any of the four fail, the runtime should refuse merge or require a local offline merge receipt produced by a reviewed toolchain. That lets the public SDK stay narrow: it exposes the result and evidence, not the proprietary merge recipe.

### Privacy and memorization risk

Distilling memory into weights always creates a privacy question. Training-data extraction work has shown that language models can emit memorized training examples, including personal information, and later work on production systems found that alignment does not eliminate extractable memorization. That means user memory should default to prompt-time reviewed storage, not weight-level distillation, unless the user or operator deliberately promotes it and the content is suitable for parameterization. citeturn11search4turn11search0

In practice, this implies a strict promotion policy:

- **personal data and ephemeral user facts**: never distill by default;
- **reviewed domain procedures and stable style exemplars**: adapter-distillable with receipts;
- **broad assistant defaults**: base-distillable only through offline governance.

That policy is exactly what keeps “memory” from becoming covert fine-tuning.

## Public SDK interfaces, evaluations, and browser-local optimization

### Public SDK surface

The public SDK should be artifact-centric and policy-enforcing. It should expose import, validation, activation, and evaluation. It should not expose training curriculum, router internals, teacher prompts, or authoring graphs. TinyRustLM’s public docs already separate runtime responsibilities from offline packer/model-breeding evidence, so the SDK should do the same. citeturn31view0turn32view0

A minimal public TypeScript surface could look like this:

```ts
export interface SlmLoadReceipt {
  modelId: string;
  tokenizerFingerprint: string;
  layoutChecksum: string;
  quantization: "f32" | "q8_0" | "q4_0";
  byteLength: number;
  diagnostics: Record<string, unknown>;
}

export interface PackageValidationResult {
  accepted: boolean;
  state: "quarantined" | "admitted" | "rejected";
  reasons: string[];
  provenance: {
    issuer?: string;
    createdUtc?: string;
    sha256?: string;
    reviewState?: string;
  };
}

export interface MemoryActivationPlan {
  shortTermRefs: string[];
  longTermRefs: string[];
  personaRef?: string;
  adapterIds: string[];
}

export interface TinyRustLmSdk {
  loadModel(file: File): Promise<SlmLoadReceipt>;
  validateAdapter(file: File): Promise<PackageValidationResult>;
  installAdapter(file: File): Promise<PackageValidationResult>;
  importUaixPackage(file: File): Promise<PackageValidationResult>;
  activate(plan: MemoryActivationPlan): Promise<void>;
  generate(input: { prompt: string; sessionId?: string }): Promise<{ text: string; citations?: string[]; diagnostics: Record<string, unknown> }>;
  runEval(suiteId: string): Promise<{ suiteId: string; passed: boolean; cases: Array<{ id: string; passed: boolean; notes?: string }> }>;
}
```

The public contract should also expose **receipts instead of recipes**. For example, `validateAdapter()` can return compatibility, provenance, and eval references, but not the hidden authoring chain that produced the adapter. `runEval()` can return exact case results, but not private judge prompts or internal grading heuristics. This is how the SDK stays transparent where users need transparency and opaque where the implementation legitimately remains proprietary. citeturn31view1turn32view0

### Evaluation plan

The public evaluation plan should combine TinyRustLM’s deterministic smoke philosophy with UAIX’s portable evidence packets. TinyRustLM already documents browser smoke coverage for malformed model rejection, missing model handling, context overflow, adapter-sidecar application, selector routing, drift rejection, and performance soak. UAIX provides evaluation packet templates for no-op justification, local sandbox safety review, memory ecosystem handoff, and DE11 benchmark summary. Together they support a clean public eval program. citeturn31view1turn7view5turn30view1turn30view2turn30view0turn7view6

The test matrix should include at least these families:

**Memory recall.** Verify that reviewed short-term records are recalled when activated, that long-term pointer records can be retrieved with citations, that stale/quarantined records are not injected, and that unresolved conflicts trigger no-op rather than confident synthesis. citeturn29view0turn30view0

**Refusal and policy preservation.** Verify that persona packs cannot loosen refusal behavior, that taboo-anchor conflicts produce no-op/talk-back, and that harmful or authority-widening memory text is treated as untrusted quoted evidence rather than instructions. citeturn7view3turn29view0turn10search2

**Style consistency.** Verify that persona style remains stable across turns, but only inside allowed style dimensions; support-boundary metadata should explain variance instead of silently mutating the source persona. UAIX explicitly requires variance and fidelity evidence for advanced persona packages. citeturn28view2turn28view3

**Privacy.** Probe whether the model emits memorized private strings from promoted memory corpora or distilled adapters, and treat any extraction-like success as a blocker for promotion. Training-data extraction literature makes this a required class, not a nice-to-have class. citeturn11search4turn11search0

**Determinism and replayability.** Fix seeds, verify output drift bounds, and keep proof paths deterministic. TinyRustLM already emphasizes seeded sampling, fixed candidate caps, and replayability. citeturn31view1turn31view2

### Browser-local runtime optimization

Public TinyRustLM documents currently describe handwritten scalar Rust loops compiled to WebAssembly, and a source-grounded guide says the runtime presently has no batched prefill, no WebGPU dispatch, and no worker isolation in that reviewed implementation path. By contrast, WebLLM shows that browser-native local inference can use WebGPU, WebAssembly, workers, paged KV management, and ahead-of-time compiled kernels while retaining up to about 80% of native decoding throughput on the same hardware. ONNX Runtime Web’s WebGPU execution provider adds graph capture for static-shape models and GPU-resident IO binding to keep recurrent transformer steps on-GPU. citeturn19view1turn36view0turn35view0turn35view2turn35view3

So the optimization roadmap for distilled `.slm` models is clear:

First, keep the current narrow `.slm` loader and Rust validation path exactly as they are, because that is the inspectability boundary. Second, split execution backends behind the same public ABI: scalar WASM as the reference backend, SIMD-augmented WASM as the deterministic fast path when acceptable, and an optional WebGPU backend for larger or more compute-heavy distilled models. Third, preallocate GPU or WASM buffers for generation loops and keep recurrent tensors device-resident whenever possible; ORT’s IO binding guidance exists precisely because transformers repeatedly feed prior outputs back into the model. Fourth, use workers so UI responsiveness and execution safety remain separated, as WebLLM does. citeturn22view0turn31view0turn19view1turn36view0turn35view2

I would therefore publish one stable runtime contract and three optional execution classes:

- **Reference**: scalar WASM, maximum inspectability.
- **Optimized local**: SIMD/packed WASM, same semantics, better throughput.
- **Accelerated local**: WebGPU, static-shape graph capture where available, explicit diagnostics that the backend changed but the trust boundary did not.

That gives users performance without turning the runtime into a black box.

## Recommended architecture

The most robust public architecture is a **promotion ladder**:

**UAIX source artifacts** → **quarantined profile records** → **active prompt-time memory/persona assembly** → **optional adapter distillation** → **optional base distillation**

At each step, the runtime should require more evidence and less ambiguity. Prompt-time activation needs manifest validity, anchors, support boundary, and local policy acceptance. Adapter distillation additionally needs compatibility, task-scope declaration, safety-boundary declaration, and eval receipts. Base distillation needs all of that plus offline governance and broader regression evidence, because it permanently changes the default model behavior. This is consistent with TinyRustLM’s claim discipline: execution proof and assistant-quality proof are different evidentiary categories. citeturn31view0turn29view0turn28view4

The design rule that keeps the ecosystem honest is this:

**Memory stays visible until it earns the right to become behavior.**

That one rule solves most of the problem. It prevents hidden remote inference because the authoritative runtime state is local and artifact-based. It prevents unverified prompt injection because imported memory begins in quarantine and is represented as typed records rather than raw instructions. It prevents persona packs from overriding policy because policy and anchors sit above persona in precedence and because support-boundary metadata is separate from source persona. It prevents adapter merging from becoming folklore because mergeability is claim-backed rather than assumed. And it lets the SDK stay open at the runtime boundary without leaking proprietary authoring logic. citeturn25view3turn29view0turn28view2turn9search0turn34search0

## Open questions and limitations

Some parts of the TinyRustLM and UAIX public surfaces are clearly documented, while others remain implementation- or roadmap-dependent. The public TinyRustLM site documents `.slm`, current adapter lanes, runtime/testing boundaries, and offline evidence concepts, but it does not publicly disclose a complete finalized SDK or the exact private authoring pipeline that produces higher-quality distilled assistants. UAIX’s `.uaix` desktop-client package format is public but still marked Draft v0.1, so any hard production contract should preserve versioning and compatibility negotiation. citeturn25view0turn31view0turn27view0

The report’s interface definitions and enforcement order are therefore **recommended public designs**, not claims that those exact APIs or precedence tables already exist privately. They are intended to fit the documented TinyRustLM and UAIX public boundaries while avoiding disclosure of proprietary training, routing, or adapter-authoring internals. citeturn31view0turn29view2