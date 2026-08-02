# Black-Box Failure Analysis of TinyRustLM

## Scope and method

This investigation was constrained to public evidence only: the live TinyRustLM site, MiniModel metadata, public MiRust/TinyRustLM implementation documentation, and authoritative external model documentation. I was able to inspect the live public UI state and the audited implementation/public manifests, but I could not independently execute browser-controlled prompt runs from this environment without fabricating outputs. The report therefore separates **directly observed public evidence** from **high-confidence engineering inferences** and from **explicit unknowns**. That distinction matters here because the strongest public evidence already isolates several root causes before any prompt-level replay: the live UI shows a load-state failure, the public MiniModel demo catalog points to a synthetic smoke fixture, and the audited TinyRustLM implementation docs state that shipped artifacts are regression artifacts rather than assistant-quality models. citeturn46view0turn14view0turn15view1turn21view0turn20view0

The most important conclusion is straightforward: the publicly visible behavior is **not primarily explained by sampling knobs**. It is explained first by **artifact identity and runtime compatibility**. The MiniModel example catalog exposes a synthetic q8 fixture with an 8,832-byte artifact, a tiny `hidden=8, layers=1` shape, context `16`, `max_tokens`/`max_new_tokens` of `16`, and `trained_quality_claim: "not-claimed"`. MiRust’s audited artifact catalog likewise says the supplied SLM artifacts are executable regression artifacts whose manifests explicitly deny trained assistant quality, and its runtime-smoke gate explicitly says a pass does **not** mean useful language behavior. citeturn14view0turn15view1turn36view1turn21view0

## What the public evidence proves

The live public page currently shows a contradictory surface. It says it is **“Loading the verified MiniModel demo”**, then immediately presents **“Something needs attention”** and **“Check the selected model and try again.”** The same page shows the model selector headed by **“SmolLM2 360M Instruct q4_0”** and **“SmolLM2 135M Instruct q8_0”**, yet the runtime panel still says **Model: waiting**, benchmark counters remain zero, provenance fields remain waiting, and the footer says **“No model loaded.”** That is direct public evidence of a pre-generation load/state failure on the public chat surface. citeturn46view0

A second contradiction appears when the live UI is compared with the audited implementation snapshot. The audited implementation says the browser boot sequence loads the default `tinylm16q8` route, and that the selector maps to only **eight fixed same-origin local `.slm` paths**: TinyLM-16M in three quantizations plus five tiny fixtures. The same audited docs say TinyLM-16M-shaped options default to **eight** new tokens and tiny fixtures default to **sixteen**. That does not match the current live UI, which publicly renders a 1024-token preset and SmolLM2 labels first in the selector. The most plausible engineering reading is **front-end/source drift** or a **metadata-first UI that is presenting candidate model labels not backed by the audited local artifact set**. citeturn34view0turn23view1turn46view0

The MiniModel public catalog also matters because it identifies what the “verified demo” actually is. MiniModel’s example catalog exposes `tinyrustlm/tiny-test-model-q8`, a synthetic fixture with `artifact_byte_count: 8832`, `slm_model_shape: vocab=260,hidden=8,layers=1,...,context=16`, quantization `q8_0`, `source_kind: "synthetic"`, `source_identity: "tinyrustlm-fixture-q8"`, `quality_claim: "not-endorsed-by-project"`, and `trained_quality_claim: "not-claimed"`. That is not a weak assistant. It is a deliberate execution/regression fixture. citeturn14view0turn15view1

MiRust’s artifact catalog and model pages reinforce that point. The audited catalog lists only eight bundled SLM artifacts: three TinyLM-16M variants and five tiny fixtures. It then states, plainly, that these artifacts are **“executable regression artifacts”** and that their manifests **“explicitly deny trained assistant quality.”** The specific TinyLM-16M q8 page further says its role is **“runtime-smoke only”** and that it has **“Deterministic smoke weights; no trained assistant quality.”** citeturn36view1turn32search0

There is also hard evidence that, even if the site were trying to use a real SmolLM2 model, the current runtime would not be a clean fit. SmolLM2-360M-Instruct’s official config shows `num_attention_heads: 15` and `num_key_value_heads: 5`, which is Grouped Query Attention rather than equal-head MHA. TinyRustLM’s current implementation limitations page says the runtime currently requires **equal attention and KV-head counts**. That makes a real SmolLM2-360M-class import a compatibility problem unless there is an unpublished adapter or a runtime change not present in public evidence. citeturn40view0turn40view1turn39search6turn26view4

Finally, the public evidence shows a likely chat-format mismatch for any instruct-class model that might eventually load. The live UI’s transcript behavior documentation says each form submission sends **only the current prompt field** to `generate`, and earlier transcript turns are **not concatenated** automatically. Hugging Face’s SmolLM2 docs and tokenizer config show that the instruct model expects a chat template built around `<|im_start|>...<|im_end|>` messages, and Hugging Face’s chat-template docs warn that using a format different from the training format can cause **severe, silent performance degradation**. So even a successfully loaded SmolLM2-derived artifact would underperform badly without model-specific templating and conversational prompt serialization. citeturn23view4turn41search0turn41search1turn41search2turn45search14

### Raw evidence captures

The following short public captures are the most load-bearing pieces of evidence:

> “Loading the verified MiniModel demo.” citeturn46view0

> “Something needs attention. Check the selected model and try again.” citeturn46view0

> “No model loaded” citeturn46view0

> “Load the default `tinylm16q8` route.” citeturn34view0

> “Pass means the artifact is admitted for local runtime execution evidence. It does not mean useful language behavior.” citeturn21view0

> `"trained_quality_claim": "not-claimed"` citeturn15view1

> `"num_attention_heads": 15` and `"num_key_value_heads": 5` citeturn40view0turn40view1

These captures also explain why there are no trustworthy screenshot attachments in this report: the available public tooling here can inspect and cite the live page text and public manifests, but it cannot safely fabricate browser-run screenshots or prompt outputs that were not actually executed.

## Reproducible prompt matrix

Because I could not legally or technically fabricate 30 executed generations, the matrix below is a **reproducible execution plan** grounded in the public configuration state. For every row, the public live UI currently renders these inherited operator values: **Max Tokens 1024, Temperature 0.70, Top-K 40, Top-P 0.90**, with the selector headed by **SmolLM2 360M Instruct q4_0** and **SmolLM2 135M Instruct q8_0**, while runtime state still says **waiting** and **No model loaded**. If the MiniModel demo actually resolves instead, the only publicly exposed example demo artifact is the tiny synthetic q8 fixture with **context 16** and **max tokens 16**. citeturn46view0turn14view0turn15view1

For each run, the local operator should record exactly the public runbook fields MiRust prescribes: prompt bytes or approved redacted prompt, model identity, sampling configuration, max token request, result message, numeric code, diagnostics JSON, browser elapsed time, and console entry. The diagnostics surface is documented to expose model-loaded state, last error, prompt/generated token counts, KV length, quantization mode, tokenizer output, logits summary, selected token, top-k summary, and active sampling configuration. citeturn26view7turn35view0

| Prompt | Probe class | What it tests | Expected public-state outcome now | If MiniModel demo actually loads |
|---|---|---|---|---|
| hello | greeting | baseline generation | pre-generation load rejection | trivial or nonsensical short output |
| hi there | greeting | same as above | pre-generation load rejection | trivial short output |
| test | ambiguous | degenerate one-word prompt | pre-generation load rejection | repetition or meaningless completion |
| continue | ambiguous | continuation behavior | pre-generation load rejection | likely repetition/collapse |
| what can you do | greeting | instruction following | pre-generation load rejection | canned-looking but incoherent fragment |
| What is the capital of France? | ordinary QA | factual retrieval | pre-generation load rejection | low-confidence trivial answer or nonsense |
| Why is the sky blue? | ordinary QA | explanatory answer | pre-generation load rejection | shallow fragment |
| Convert 37 C to F. | short reasoning | deterministic arithmetic | pre-generation load rejection | likely wrong or trivial |
| If all cats are mammals and Milo is a cat, what is Milo? | short reasoning | syllogism | pre-generation load rejection | weak or incoherent |
| Which is larger, 0.5 or 0.05? | short reasoning | token-level comparison | pre-generation load rejection | may be right by chance, not evidence of assistant quality |
| Rewrite this sentence professionally: “send me the file asap” | rewriting | style transfer | pre-generation load rejection | too short/trivial to be useful |
| Rewrite to plain English: “The implementation exhibits nondeterministic boundary behavior.” | rewriting | paraphrase | pre-generation load rejection | fragmentary |
| Summarize: Rust emphasizes memory safety without garbage collection. | summarization | short summary | pre-generation load rejection | likely truncation |
| Summarize in one sentence: Tiny models can run locally in a browser. | summarization | one-sentence abstraction | pre-generation load rejection | may emit trivial echo |
| Explain this code: `for (const x of xs) total += x;` | code explanation | code understanding | pre-generation load rejection | shallow or incomplete |
| Explain what a mutex does in multithreaded code. | code explanation | systems concept explanation | pre-generation load rejection | weak fragment |
| Output exact JSON only: `{"ok":true,"items":[1,2,3]}` | exact JSON | strict structured output | pre-generation load rejection | likely invalid JSON |
| Output exact JSON only with keys `name`, `age`: Alice, 30 | exact JSON | schema obedience | pre-generation load rejection | likely malformed JSON |
| Respond with only the word `blue` | exact constrained output | strict decoding | pre-generation load rejection | may still drift |
| First turn: My favorite color is green. | multi-turn | memory setup | pre-generation load rejection | stored only in transcript, not serialized for next turn |
| Second turn: What is my favorite color? | multi-turn follow-up | conversational carry-over | pre-generation load rejection | prior turn ignored by UI path |
| First turn: I live in Denver. | multi-turn | memory setup | pre-generation load rejection | same limitation |
| Second turn: Where do I live? | multi-turn follow-up | transcript/context serialization | pre-generation load rejection | prior turn ignored |
| Summarize this 5-paragraph article... | long context | prompt budget and truncation | pre-generation load rejection | likely context exceeded or useless truncation |
| Extract three themes from this 2-page text... | long context | sustained context use | pre-generation load rejection | likely context exceeded |
| Repeat the word “data” 50 times. | adversarial repetition | repetition stability | pre-generation load rejection | repetition collapse likely |
| Continue `ha ha ha ha ha ...` | adversarial repetition | loop behavior | pre-generation load rejection | repetition collapse likely |
| Complete the pattern: `A A A A A` | adversarial repetition | degeneracy resistance | pre-generation load rejection | repetitive degeneration |
| Write a 200-word product description for a backpack. | ordinary generation | extended coherence | pre-generation load rejection | impossible under 16-token demo budget |
| Give me two concise pros and two cons of local inference. | ordinary reasoning | list structure | pre-generation load rejection | incomplete/trivial |

Two engineering notes matter for interpreting this matrix. First, the live public state suggests that many of these rows will currently fail before generation because no usable model is loaded. Second, if the MiniModel demo is what eventually loads, the public artifact metadata makes it unsuitable for this matrix by construction: context 16, output 16, synthetic/non-trained source, and no assistant-quality claim. citeturn46view0turn15view1turn20view0turn21view0

## Failure taxonomy ranked by confidence and impact

The table below ranks the user’s proposed failure classes by **public-evidence confidence** and **practical impact**.

| Failure origin | Confidence | Impact | Why |
|---|---|---|---|
| Deliberately untrained execution fixture | Very high | Critical | Public MiniModel metadata identifies the example demo as a synthetic fixture with no trained-quality claim, and MiRust’s artifact catalog says bundled artifacts are regression artifacts rather than assistant-quality models. citeturn15view1turn36view1turn20view0 |
| Tiny output budget | Very high for the MiniModel demo; high overall | High | The public MiniModel demo example exposes context 16 and max output 16. The audited selector defaults are also only 8 tokens for TinyLM and 16 for tiny fixtures. That is enough to force trivial, clipped, or apparently “stupid” behavior. citeturn14view0turn15view1turn23view1 |
| Context serialization failure | Very high | High | MiRust’s UI/transcript docs say each submission sends only the current prompt and does not auto-serialize previous turns into the next prompt. That breaks follow-up questions even with a good instruct model. citeturn23view4 |
| Front-end/source drift around advertised default | High | High | The live site publicly advertises SmolLM2 selector entries and 1024-token creative-style defaults, while the audited runtime docs describe eight fixed local SLM routes and a default `tinylm16q8` load path. citeturn46view0turn34view0turn23view1 |
| GQA and KV-head incompatibility | High for SmolLM2-class models | High | SmolLM2-360M-Instruct uses 15 attention heads and 5 KV heads, while TinyRustLM publicly documents a current equal-head-count requirement. That is a compatibility blocker, not a quality tweak. citeturn40view0turn40view1turn26view4turn39search6 |
| Chat-template mismatch | High for instruct models | High | SmolLM2’s official tokenizer config requires an `<|im_start|>...<|im_end|>` chat template and Hugging Face warns that training-format mismatch causes severe silent degradation. TinyRustLM’s UI does not apply automatic multi-turn chat templating. citeturn41search0turn41search1turn41search2turn23view4turn45search14 |
| Browser/WASM resource limits | High | Medium to high | TinyRustLM publicly documents full-file copy, a 128 MiB single-transfer cap, synchronous main-thread execution, and no worker or cancellation. Those limits make larger useful defaults difficult and can degrade UX severely. citeturn26view5turn28search5turn27view1turn27view2 |
| Weak trained weights | Low as current primary explanation | Medium | There is no public evidence that the live default is a merely weak trained model. The strongest evidence points instead to smoke fixtures and/or incompatibility before generation. citeturn15view1turn36view1 |
| Quantization damage | Low to medium as current primary explanation | Medium | q4 can absolutely reduce quality, but the public evidence already explains failure without invoking quantization damage: smoke fixtures, tiny budgets, and incompatibility. Quantization would be secondary here. citeturn36view1turn26view5 |
| Incorrect BOS/EOS/control-token handling | Medium as a future conversion risk; low as proved current cause | Medium | TinyRustLM’s tokenizer contract uses reserved control IDs and explicit BOS/EOS handling, while SmolLM2 uses its own special-token scheme. That is a real integration risk, but no public converted SmolLM2 SLM artifact is available to prove a live mismatch. citeturn23view5turn41search2turn42view1 |
| Tokenizer incompatibility | Medium as a future conversion risk; low as proved current cause | Medium | TinyRustLM can convert trained sources to SLM1 and embeds a tokenizer contract, but no public converted-trained SmolLM2 artifact is exposed for direct validation. So incompatibility is plausible, not yet proven. citeturn42view1turn42view1turn42view1 |
| Sampling parameters | Medium as an amplifier; low as root cause | Low to medium | The live UI renders `temp=0.70, top-k=40, top-p=0.90`, but the audited runtime originally documented deterministic defaults. Sampling affects style and repetition, but it does not explain “No model loaded,” non-trained fixtures, or GQA mismatch. citeturn46view0turn23view6 |
| Repetition penalty | Very low | Low | No repetition-penalty control is exposed in the live selector panel or the public sampler docs. Public evidence does not support this as a root cause. citeturn46view0turn23view6 |
| Quality-gate false positives | Medium | Medium | Public provenance and smoke-gate docs show a real trust/interpretation gap: artifacts can look “verified” or “admitted” while still carrying no assistant-quality claim, and sidecars are informational rather than binding admission authority. That is a labeling/governance false-positive more than a text-generation false-positive. citeturn21view0turn20view0turn44view2 |

The short version is that the failure stack is layered, but its root is not subtle. The **first-order** cause is that the publicly surfaced “demo/default” path is tied to non-assistant artifacts or to an unresolved load path. The **second-order** causes are that the runtime, as publicly documented, lacks the compatibility features needed for a real modern instruct model such as SmolLM2, and the UI lacks the prompt-formatting and context-serialization behavior such a model expects. citeturn46view0turn15view1turn36view1turn40view1turn23view4turn45search14

## Immediate, intermediate, and architectural corrections

The immediate correction is not to “fix responses.” It is to stop presenting a regression fixture as if it were a useful local assistant default. The public chat surface should either ship with **no autoloaded chat model** or it should autoload only a **converted-trained artifact that has actually passed the assistant-quality gate**. MiRust’s own public docs already define that boundary: assistant-quality requires `source_kind = converted-trained` plus evaluation sidecars and a quality decision accepted for assistant-quality, while the current fixture explicitly is not product evidence. citeturn20view0

The second immediate correction is to make the selector truthful. If a selector row is only metadata discovery or a future conversion candidate, it should not appear as a ready local runtime choice beside actual loadable `.slm` routes. The audited selector contract says a selector entry proves only that the static application knows a route; it does not prove runtime acceptance or quality. The live UI should therefore clearly separate **verified local artifacts**, **importable local files**, **conversion candidates**, and **metadata-only model cards**. citeturn23view1

The third immediate correction is to bind prompt construction to model identity. For instruct models, TinyRustLM needs a model-specific chat-template layer and it needs to serialize prior turns into the next prompt. Right now the public docs say the UI sends only the current turn, and Hugging Face explicitly warns that using the wrong training format causes severe silent degradation. This is one of the highest-return fixes because it improves every future trained model without weakening any safety or quality gate. citeturn23view4turn45search14turn41search2

Intermediate work should focus on **real compatibility** rather than cosmetics. The runtime needs GQA-capable attention and KV-cache handling if it wants to support current instruct models such as SmolLM2-360M. It also needs a worker-owned runtime so generation moves off the main thread, because the public docs say the current monolithic generate call is synchronous and non-cancellable. Finally, it needs verified artifact admission and a persistent local artifact store so the browser is not forced to refetch and recopy full model files on each usage path. citeturn40view1turn26view4turn27view1turn27view2turn44view2

Architecturally, the project should decide whether it wants to remain an SLM1-only custom-runtime experiment or become a credible browser LLM runtime. Its own roadmap already points in the right direction: trained-model admission, worker ownership, a verified local store, and a true compatibility path rather than aliasing formats. Public MiRust docs explicitly say current TinyRustLM has **no GGUF parser**, uses **scalar CPU loops**, supports **one model at a time**, and still treats provenance sidecars as informational rather than authenticating admission. A production path needs those boundaries closed, not hidden. citeturn26view5turn32search1turn17search8turn44view2

## Proposed production default and quantitative targets

Under the **current publicly documented runtime constraints**, the only plausible production default that could provide useful language behavior is **not** SmolLM2-360M-Instruct q4_0 and **not** SmolLM2-135M-Instruct q8_0. Public file sizes make both of those bad fits for the current architecture: the current runtime has a **128 MiB single-transfer ceiling**, SmolLM2-135M-Instruct **Q8_0** is publicly listed at **0.14 GB**, and SmolLM2-360M-Instruct **Q4_0** is publicly listed at **0.23 GB**. Both exceed the present transfer model’s practical ceiling. By contrast, SmolLM2-135M-Instruct **Q4_0** is publicly listed at about **0.09 GB**, which is the only one of the obvious candidates that fits the current transfer envelope. citeturn28search5turn30view1turn31view0

So the best **near-term production default** is this:

**Converted-trained SmolLM2-135M-Instruct q4_0 in SLM1, with model-specific chat template application, multi-turn prompt serialization, truthful provenance labeling, and assistant-quality gate acceptance.** That is the highest-utility model choice that is still compatible with the public runtime’s current size ceiling, assuming the runtime is extended far enough to support the model’s tokenizer/control-token semantics and its instruct chat template. citeturn30view1turn41search2turn20view0turn45search14

Once the runtime adds **worker execution, chunked/verified loading, persistent storage, and GQA support**, the better long-term default becomes **SmolLM2-360M-Instruct** in a browser-suitable quantization, because the 360M class is explicitly intended for compact on-device use and is meaningfully more capable than the 135M class. But that should be a **phase-two** default, not a launch default for the current implementation. citeturn29search2turn29search8turn40view1turn27view1

The quantitative targets below are therefore proposed engineering targets, not claims about current TinyRustLM performance:

| Target area | Immediate realistic target | Intermediate target | Architectural target |
|---|---|---|---|
| Default artifact download | **≤ 100 MiB** so it fits the current 128 MiB transfer ceiling with margin | **≤ 250 MiB** with chunked verified store | **≤ 400 MiB** for “high-quality browser default” tier |
| Peak browser memory during default load | **≤ 512 MiB** total working set | **≤ 768 MiB** with worker + persistent store | **≤ 1.5 GiB** for extended-quality tier |
| Time to usable first response | **< 4 s** on desktop broadband | **< 2 s** after warm cache | **< 1 s** warm start with persistent verified store |
| Decode rate | **≥ 8 tok/s** desktop, **≥ 3 tok/s** mid-tier mobile | **≥ 15 tok/s** desktop, **≥ 5 tok/s** mobile | **≥ 25 tok/s** desktop warm-cache |
| Output budget | **≥ 128 new tokens** truthful hard cap | **≥ 256** | **≥ 512** |
| Context budget | **≥ 2,048 tokens** effective user-visible cap | **≥ 4,096** | **≥ 8,192** |
| Browser compatibility | latest two stable releases of Chromium, Firefox, Safari desktop | plus current Android Chrome and iOS Safari | same, with persistent-store recovery and worker-based cancellation everywhere |

Those targets are chosen to close the precise public gaps identified above: the current transfer cap, the current lack of worker execution, the current main-thread sync path, the current lack of persistent artifact storage, and the current mismatch between a useful instruct model and the runtime’s admitted artifact set. citeturn28search5turn27view1turn27view2turn26view5turn44view2

## Explicit unknowns that public evidence cannot establish

Several things remain unknowable from public evidence alone.

First, I cannot truthfully provide a completed table of **30 executed prompt outputs, latencies, and token counts** from this environment, because I could not independently drive the live site through all prompt submissions. Public evidence supports the diagnosis, but it does not justify invented run outputs.

Second, I cannot establish whether the **SmolLM2 selector entries** on the live page are inert labels, metadata-only candidates, pending conversion routes, or real loadable artifacts backed by an unpublished runtime build. The public implementation audit from 2026-06-25 says the selector maps to eight fixed local SLM artifacts, while the live site now renders SmolLM2 choices. That discrepancy is real, but its exact operational cause is not public. citeturn34view0turn46view0

Third, I cannot establish whether a **real converted-trained SmolLM2 SLM artifact** exists privately and merely failed to load, or whether the live UI is attempting to bootstrap only the MiniModel fixture and never reaches a trained model path. No public signed manifest or artifact bytes are available to settle that. MiniModel’s public example content is still only the tiny synthetic fixture. citeturn15view1turn44view2

Fourth, I cannot prove a current **tokenizer/BOS/EOS/control-token bug** in a real trained artifact path. I can show that TinyRustLM has an explicit tokenizer/control-token contract and that SmolLM2 expects its own special tokens and chat template, but without a public converted SmolLM2 SLM and a reproducible run, that remains a plausible integration risk rather than a demonstrated live bug. citeturn23view5turn41search2turn42view1

Fifth, I cannot prove the existence of a separate **post-generation rejection filter** that is falsely discarding otherwise good model text. The public evidence I found points to **model-load/state rejection** and to **artifact-quality mislabeling**, not to a hidden response-quality filter rejecting outputs after successful generation. citeturn46view0turn21view0turn44view2

Taken together, the public evidence is still enough to reach a strong engineering verdict: TinyRustLM’s bad default behavior is best explained by **the wrong artifact class on the chat surface, incompatible or unresolved runtime/model wiring, and missing instruct-model prompt serialization**, not by a merely “weak model” and not by superficial sampling tweaks. citeturn15view1turn36view1turn40view1turn23view4turn45search14