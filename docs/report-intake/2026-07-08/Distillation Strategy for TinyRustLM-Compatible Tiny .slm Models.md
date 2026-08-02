# Distillation Strategy for TinyRustLM-Compatible Tiny .slm Models

## Executive design choices

A workable strategy for **browser-useful** TinyRustLM students is to treat them as **behaviorally specialized assistants**, not miniature general-purpose frontier models. The public TinyRustLM docs describe a strict `.slm` artifact contract for browser-local WASM loading, embedded tokenizer data, checksum-bound tensor layouts, and a currently documented runtime envelope of **33,554,432 bytes** with published weight formats `f32`, `q8_0`, and `q4_0`. The same docs report approximate storage costs of **4.0 bytes/param for f32**, **1.0625 bytes/param for q8_0**, and **0.5625 bytes/param for q4_0**. That means a 50M-parameter q4 artifact is roughly **28.1 MB** and can fit the current envelope, while 100M, 300M, and 500M q4 artifacts would be roughly **56.3 MB, 168.8 MB, and 281.3 MB** before tokenizer and metadata overhead, so those larger targets require either a larger `.slm` budget, runtime paging/streaming, or a format/runtime extension beyond the publicly documented ceiling. citeturn25view0turn28view0turn26view0

For the training recipe itself, the most important lesson from the alignment literature is that **instruction tuning mainly teaches behavior and format**, while broad knowledge is largely inherited from pretraining. LIMA showed that a strong pretrained model can learn a lot of response style from a relatively small amount of curated instruction data, while context-distillation work shows that useful prompt- or scratchpad-conditioned behaviors can be internalized into parameters. In practice, that implies your tiny students should start from a real base LM foundation or be pretrained first, and then receive a **post-training distillation stack** for chat, summarization, rewriting, JSON, and local-agent behavior. citeturn5search1turn8search1turn6search6

Because the user experience target is “feels useful in the browser UI,” the right objective is not benchmark maximalism. It is a compact assistant that can answer briefly, obey constraints, produce valid JSON, perform short rewrites and summaries, explain code snippets, and choose or abstain on a small local toolset. That target matches what recent small-model and on-device work emphasizes: architecture matters disproportionately below 1B parameters, and tool calling plus verifiable instruction following are separable, trainable capabilities. citeturn23view0turn12search0turn36view0turn37view0

## Recommended teacher and student stack

The best teacher setup here is a **small ensemble of open instruct teachers**, with each teacher assigned to the capability where it is strongest. A practical high-confidence stack is: **Qwen3-14B** as the primary reasoning-and-agent teacher, **Qwen2.5-7B-Instruct** as the stable non-thinking chat/JSON teacher, and **SmolLM3-3B** as a secondary style/tool-calling teacher. Qwen3-14B is Apache-2.0, supports a hard switch between thinking and non-thinking behavior, advertises strong instruction following and agent capabilities, and uses GQA; Qwen2.5-7B-Instruct is Apache-2.0 and explicitly highlights stronger instruction following and structured output, especially JSON; SmolLM3-3B is Apache-2.0, fully open, trained as a decoder-only transformer with GQA, and its model card explicitly documents tool calling and custom system-instruction behavior. citeturn21view0turn17view0turn18view0

For the **student architectures**, the design center should be **decoder-only, deep-and-thin, tied embeddings, RoPE or equivalent position handling, RMSNorm, SwiGLU, and GQA**, because MobileLLM finds that deep/thin architectures with **embedding sharing** and **grouped-query attention** are particularly effective below 1B parameters, and SmolLM-family releases show that compact decoder-only models can still be meaningfully useful on-device. citeturn23view0turn22view0turn18view0

| Target class | Recommended student shape | Intended UI role |
|---|---|---|
| **50M** | ~18 layers, `d_model≈384`, tied embeddings, GQA with ~6 Q heads / 2 KV heads, 2k context | ultra-fast local helper for rewrite, short summaries, schema-filled JSON, short code explanations |
| **100M** | ~24 layers, `d_model≈512`, tied embeddings, GQA with ~8 Q / 2 KV, 2k–4k context | default browser assistant if runtime budget is raised beyond current public `.slm` ceiling |
| **300M** | ~36 layers, `d_model≈768`, tied embeddings, GQA with ~12 Q / 4 KV, 4k context | higher-quality local assistant on WebGPU or desktop-grade browser targets |
| **500M** | ~32–36 layers, `d_model≈1024`, tied embeddings, GQA with ~16 Q / 4 KV, 4k context | premium local mode; likely not viable on current documented TinyRustLM scalar-WASM envelope without runtime evolution |

These exact layer/width values are **architecture recommendations**, not claims from a single source, but they follow the deep-thin/GQA direction supported by MobileLLM and the compact-decoder practice seen in SmolLM-family releases. The 50M class is the only one that naturally aligns with the currently public TinyRustLM q4 envelope; the 100M+ classes should be treated as **future TinyRustLM-compatible `.slm` targets** that require a larger artifact budget and, realistically, a faster runtime path than today’s publicly described scalar one-token-at-a-time WASM loops. citeturn23view0turn22view0turn24search8turn9search0turn9search18

A critical recommendation is to **distill mostly from the teachers’ non-thinking modes for shipping models**, even if one teacher supports visible reasoning. Qwen3 explicitly separates thinking and non-thinking behavior, and sequence-level KD literature shows that students inherit not only teacher strengths but also teacher failure modes and memorization tendencies. For tiny browser models, verbose trace imitation usually hurts latency, output concision, and UX. If you want rationale supervision, use **short hidden rationales as training-only auxiliary targets**, not visible production behavior. citeturn21view0turn38search4turn6search0

## Data design and synthetic generation policy

For the legally cleanest version, I recommend a **permissive-only core corpus** and a separate optional **share-alike enriched** variant. The safest core is: **OpenAssistant/oasst1** for open conversational supervision under Apache-2.0, plus **license-allowlisted permissive code-and-doc repositories** using a provenance-aware source such as **The Stack v2**, filtered to permissive SPDX families like MIT, BSD, Apache, ISC, NCSA, and Zlib. OpenAssistant’s public release is explicitly permissive, and The Stack v2 exists specifically to improve provenance, opt-outs, and licensing hygiene versus earlier code collections. SPDX provides standardized identifiers that make this filtering operationally tractable. citeturn40search0turn40search13turn2search4turn34search0turn34search1

I would **exclude CC-NC and CC-ND sources entirely** from any training track intended for downstream redistribution. I would also keep **CC-BY-SA materials in a separate training lineage**, not mixed invisibly into the permissive track, because Creative Commons itself notes that attribution obligations always apply to CC-licensed works and that the interaction of licensing conditions with AI training is not a simple one-size-fits-all question. In other words, if you need a commercially uncomplicated shipping artifact, build a **permissive-only student**; if you want a broader open-text student, ship a separately labeled **share-alike-enriched student** with explicit lineage metadata and disclosures. citeturn15search0turn15search2turn34search1

For the actual task mix, use public/open source material only, but generate most of the **task formatting synthetically**:

| Capability | Recommended source class | Training form |
|---|---|---|
| General chat | OpenAssistant/oasst1 | direct SFT plus teacher restyling to your target browser persona citeturn40search0turn40search13 |
| Summarization | permissively licensed docs / README / technical articles from allowlisted repos | source document + teacher reference summary + compression-ratio metadata citeturn2search4turn13search3turn13search2 |
| Rewrite | same permissive documents plus deterministic rewrite transforms | simplify / shorten / formalize / bulletize / convert-tone tasks with teacher cleanup citeturn8search1turn5search13 |
| Code explanation | permissive repos from allowlisted license families | snippet + surrounding docstring/tests + teacher explanation, with exact symbol grounding checks citeturn2search4turn13search1 |
| JSON generation | fully synthetic JSON schemas plus permissive tool schemas you author or extract from allowlisted repos | prompt + schema + gold JSON + negative invalid variants citeturn14search0turn14search2turn7search2 |
| Local-agent behavior | synthetic local tools such as `read_selection`, `summarize_page`, `extract_json`, `create_todo`, `search_notes` | tool selection, abstention, and argument construction on toy/local tools citeturn36view0turn37view0turn18view0 |

Your **synthetic data generator** should obey five hard rules. First, never seed generation from benchmark prompts, schemas, function lists, or examples that will later be used for evaluation. Second, keep **all derivatives of the same source document** in the same split. Third, maintain a benchmark denylist for **IFEval, IFBench, BFCL, API-Bank, HumanEval, MBPP, and JSONSchemaBench** prompt text, schemas, and function definitions. Fourth, run approximate de-duplication and overlap checks across train/eval to reduce contamination risk. Fifth, version the generator itself so you can prove which prompt templates created which records. These rules are directly motivated by contamination work and by IFBench’s finding that many models overfit narrow verifiable instruction templates; IFBench explicitly improves evaluation by using **unseen prompts plus unseen constraints**. citeturn4search18turn4search23turn32view0

One additional rule matters for tiny students: **do not distill benchmark-specific surface forms into the main shipping model** just because they move public scores. IFBench shows that models can score well on IFEval while still generalizing poorly to unseen constraints. The shipping model should learn the *skill family*—counting, formatting, copying, ratio constraints, abstention, schema compliance—not the public test inventory. citeturn32view0turn12search0

## Distillation recipe and curriculum

The most robust recipe is a **four-stage post-training stack** layered on top of a real base model.

### Response-style distillation

Start with **response-style SFT** on clean teacher generations for chat, summarization, rewrite, JSON, and local-tool tasks. This is the easiest way to transfer tone, formatting, brevity, and conversational cadence. Sequence-level KD and Self-Instruct-style work both support using teacher-completed examples as tractable supervision, and LIMA suggests that limited but high-quality alignment data can teach response form surprisingly well. For tiny students, this stage should dominate early training because it directly affects UI feel. citeturn38search0turn5search13turn5search1

### Logit distillation

After style SFT stabilizes, add **white-box logit KD** with KL divergence over the teacher distribution on the same prompts. This follows the classic Hinton formulation and is especially useful for preserving calibrated next-token preferences that simple response imitation throws away. For 100M–500M students, use this heavily. For 50M students, use it selectively on short outputs because the capacity bottleneck is severe. Recent white-box distillation literature explicitly notes that logits and hidden states provide richer supervision than black-box sequence distillation alone. citeturn1search0turn35search7

### Hidden-state distillation

Add **hidden-state matching** only on a subset of layers, and only after the student already writes acceptable responses. TinyBERT and MiniLM showed the value of transferring internal representations and attention relations, while more recent hidden-state work suggests that hidden-state matching can materially improve LM distillation. For your use case, match a **small number of alternating or semantically aligned layers**, not every layer, to control cost. My recommendation is to use hidden-state KD mainly for **300M and 500M**, sometimes for **100M**, and only minimally for **50M**. citeturn6search1turn1search2turn35search0turn35search2

### Preference distillation and verifiable reward tuning

Finish with **preference distillation** using DPO or a similar offline preference objective, followed by **RL with verifiable rewards** on the skills that can actually be programmatically checked. DPO is attractive because it is much simpler than RLHF while still aligning to pairwise preferences. For browser assistants, the highest-value verifiable tasks are: valid JSON under a schema, exact key preservation in rewrite tasks, bounded-length summaries, tool abstention when no tool applies, and precise formatting/constraint following. IFBench shows that RL with verifiable rewards can materially improve precise instruction following and that a preference signal may be needed to stop the policy from over-optimizing constraints at the expense of response quality. citeturn39search0turn39search4turn32view0

A practical **curriculum by model size** is:

- **50M:** Mostly response-style SFT, very light short-context logit KD, almost no hidden-state KD, then a small DPO/RLVR pass for JSON and exact constraint obedience. This size should be optimized for short answers and strict format compliance, not broad reasoning. citeturn5search1turn12search0turn14search2
- **100M:** Response-style SFT plus meaningful logit KD, selective hidden-state KD, then DPO/RLVR for JSON, summarization, and local tools. This is the smallest class where a “real” compact browser assistant is plausible once runtime limits are raised. citeturn1search0turn35search0turn32view0
- **300M:** Full multi-objective recipe: response-style SFT + logit KD + hidden-state KD + DPO + RLVR. This is the sweet spot if you have WebGPU acceleration and want clearly useful behavior. citeturn23view0turn35search7turn36view0
- **500M:** Same as 300M, but add longer-context summarization/rewrite examples and more tool-call planning. This class is strong enough to justify a richer agent curriculum, but it is no longer aligned with the currently published TinyRustLM artifact envelope. citeturn21view0turn36view0turn25view0

## Evaluation, quality gates, and proving real capability

The evaluation strategy should be built around **programmatic checks first, human or LLM judges second**. G-Eval is useful as a secondary quality judge because it correlates better with human judgments than older automatic metrics on open-ended tasks, but the paper also warns about LLM-judge bias. So use programmatic validation wherever possible, and only then use LLM-as-judge for fluency, helpfulness, and explanation quality. citeturn33search0turn33search12

Your **training/eval split rules** should be strict:

- split by **source document** before any synthetic generation;
- keep all derivatives of one source in one split;
- keep **constraint families**, **schema families**, and **tool signatures** partitioned between train and eval when the metric is supposed to measure generalization;
- maintain a prompt/schema/function denylist for public benchmarks;
- run overlap scans on exact text and approximate paraphrase similarity. citeturn4search18turn4search23turn32view0

The **minimum quality gates** I would ship with are:

| Task | Gate |
|---|---|
| Chat | hidden set of fresh prompts; human preference win rate against previous student; IFEval-style strict constraint adherence; no benchmark prompts reused citeturn12search0turn32view0 |
| JSON | schema-valid rate, exact required-field coverage, type-validity, and value-accuracy on randomly generated held-out schemas; never accept syntax-only success as enough citeturn14search2turn14search11 |
| Summarization | ROUGE + BERTScore + judge score, plus factual slot checks for named entities / numbers on held-out docs citeturn13search3turn13search2turn33search0 |
| Rewrite | instruction preservation, exact required-string preservation, deletion/addition checks, and judge score for style goal attainment citeturn12search0turn33search0 |
| Code explanation | exact symbol/signature grounding checks, unit-test-backed behavioral descriptions where possible, and judge score for clarity/correctness citeturn13search1turn33search0 |
| Local-agent tasks | BFCL-style AST match for function calls, abstention accuracy, and multi-step success on held-out toy/local tool graphs citeturn36view0turn37view0 |

To show the model is **not memorizing canned UI demos**, report three kinds of generalization. First, **unseen constraint generalization** using IFBench-style held-out constraint families, because strong IFEval scores alone can be misleading. Second, **unseen schema generalization** on random held-out JSON schemas, not just a few UI fixtures. Third, **unseen tool-signature generalization** using BFCL-style AST evaluation on tools and arguments absent from training. If a model only succeeds on your browser’s canned examples but fails on new constraints, new schemas, and new tool signatures, it is not genuinely capable. citeturn32view0turn36view0turn14search2

I would also publish a simple **evidence packet** for each release: held-out prompts, random seeds, decoding settings, pass/fail tables, and the exact model+dataset lineage. TinyRustLM-adjacent docs already place strong emphasis on checksums, diagnostics, contracts, and eval sidecars; that is the right direction for proving capability rather than narrating it. citeturn24search2turn24search7turn26view0

## Quantization, .slm metadata, and Rust runtime implications

For compression, the right sequence is **distill first, quantize second**. Post-training quantization methods such as GPTQ and AWQ are designed to preserve accuracy in 3–4 bit regimes, and mixed-precision schemes such as SliM-LLM show why **non-uniform low-bit allocation** is preferable to naïve uniform sub-4-bit compression. That makes a **q4 baseline** and a **q4/q3 mixed-precision profile** a sensible target for TinyRustLM descendants. But there is an important constraint: the **currently public TinyRustLM documentation only publishes `f32`, `q8_0`, and `q4_0`**, not a q3 path. So q3 mixed precision should be specified as a **forward-compatible `.slm` profile extension**, not as something the present public runtime already supports. citeturn10search0turn10search15turn31search0turn28view0

A good `.slm` manifest should therefore carry both **artifact identity** and **training lineage**. TinyRustLM public docs already stress header validation, tokenizer checksum, layout checksum, and bounded validation; ONNX and safetensors show mature patterns for embedding model metadata; SPDX gives you a standard vocabulary for licenses. A practical metadata block for a TinyRustLM-compatible `.slm` should include at least the following fields. citeturn25view0turn9search5turn9search8turn34search0turn34search1

```json
{
  "format": "slm1",
  "model_id": "tinyrustlm-chat-100m-v0.9.0",
  "lineage": {
    "base_student_family": "custom-deep-thin-decoder",
    "base_checkpoint": "optional-open-base-or-scratch",
    "training_run_id": "uuid",
    "parents": ["teacher-qwen3-14b-nonthink", "teacher-qwen2.5-7b-instruct"]
  },
  "architecture": {
    "params_total": 98615296,
    "layers": 24,
    "d_model": 512,
    "ffn_ratio": 3.5,
    "attention": { "q_heads": 8, "kv_heads": 2, "gqa": true },
    "norm": "rmsnorm",
    "mlp": "swiglu",
    "position_encoding": "rope"
  },
  "teacher_models": [
    { "id": "Qwen/Qwen3-14B", "license": "Apache-2.0", "mode": "non-thinking", "role": "agent+chat" },
    { "id": "Qwen/Qwen2.5-7B-Instruct", "license": "Apache-2.0", "role": "json+structured-output" }
  ],
  "dataset_class": {
    "license_track": "permissive-only",
    "sources": [
      { "name": "OpenAssistant/oasst1", "license": "Apache-2.0" },
      { "name": "TheStack-v2-allowlisted", "license_expression": "MIT OR Apache-2.0 OR BSD-3-Clause OR ISC OR NCSA OR Zlib" }
    ],
    "synthetic_policy_version": "synth-v3",
    "benchmark_denylist_version": "benchblock-v2"
  },
  "distillation": {
    "response_style_sft": true,
    "logit_kd": true,
    "hidden_state_kd": "subset-layers",
    "preference_distillation": "DPO",
    "verifiable_reward_tuning": ["json", "instruction_constraints", "tool_abstention"]
  },
  "quantization_profile": {
    "runtime_profile": "q4_0",
    "mixed_precision_profile": "future-q4_q3_mp1",
    "effective_bits_estimate": null,
    "calibration_set_id": "calib-2026-07"
  },
  "eval_results": {
    "chat_pref_win_rate": 0.63,
    "json_schema_valid_rate": 0.97,
    "summary_rougeL": 0.41,
    "rewrite_constraint_pass_rate": 0.94,
    "code_expl_grounding_pass_rate": 0.89,
    "tool_ast_match_rate": 0.81
  },
  "integrity": {
    "artifact_sha256": "…",
    "tokenizer_sha256": "…",
    "tensor_layout_sha256": "…"
  }
}
```

On the **Rust runtime** side, the immediate implication is that today’s publicly described TinyRustLM path is still conservative: scalar Rust loops compiled to WASM, no batched prefill, and no documented public q3 path. The public roadmap points toward SIMD, more advanced quantization, better KV-cache handling, and narrow/portable WASM boundaries, while the broader Rust/WebGPU ecosystem already provides a path via `wgpu`, which runs natively and in the browser on top of WebGPU. So the runtime roadmap is straightforward: keep the strict `.slm` contract, but add **SIMD-accelerated q4**, then **mixed-precision q3/q4 kernels**, then **WebGPU compute** for the 100M–500M classes. Without that evolution, the 50M q4 class is the only one that cleanly fits both the current published artifact budget and current execution model. citeturn24search8turn26view0turn9search0turn9search18

## Open questions and limitations

The biggest unresolved issue is not the distillation math; it is the **current public TinyRustLM runtime contract**. The public docs clearly document `.slm`, embedded tokenizer/checksum validation, and q4/q8/f32, but they do **not** publicly document q3 support, a larger-than-33.5MB artifact budget, or a shipping WebGPU path. So the 100M, 300M, and 500M targets are best understood as **TinyRustLM-compatible future profiles** unless you are also extending the runtime. citeturn25view0turn28view0turn24search8

There is also a genuine licensing and governance choice to make. If you want the cleanest redistribution story, keep the main release **permissive-only** and publish any broader open-data variants as separate lineages with explicit disclosures. Creative Commons guidance makes clear that attribution obligations remain relevant and that the interaction between open licenses and AI training is context-dependent enough that pretending everything is frictionless would be misleading. citeturn15search0turn15search2

The practical bottom line is simple: **ship 50M first**, **target 100M next if you raise the `.slm` budget and add faster kernels**, and treat **300M/500M as WebGPU-era targets**. Distill for behavior, compress after distillation, evaluate on unseen constraints/schemas/tools, and publish lineage-rich `.slm` metadata so capability claims are backed by evidence instead of demos. citeturn25view0turn23view0turn32view0turn36view0