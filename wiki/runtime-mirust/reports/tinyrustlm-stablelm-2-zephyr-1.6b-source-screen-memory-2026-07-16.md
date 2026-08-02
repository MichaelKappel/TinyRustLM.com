# TinyRustLM StableLM 2 Zephyr 1.6B Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable checkpoint `stabilityai/stablelm-2-zephyr-1_6b` revision
`2f275b1127d59fc31e4f7c7426d528768ada9ea4` under the current TinyRustLM
assistant-quality source gate. Its untouched float32 source execution passed
two of eight fixed practical-conversation cases and failed six. Do not convert,
adapt, quantize, package, catalog, or promote this exact checkpoint in the
current campaign.

The immutable local rejection receipt is
`sha256:402d753aa4a84f21c65f0d751d9036d3b3f35b5bdda42d9deae773372a9ef708`.
It binds the exact source revision, weight bytes, configuration, tokenizer,
embedded chat template, generation inputs, license, fixed case file, system
prompt, private raw capture, public assessment, capture and recorder binaries,
framework versions, and one-call/no-retry/no-repair contract. It contains no
prompt text, raw answer, credential, or private path.

Two independent product gates also remain closed:

- The bundled Stability AI license limits these bytes to non-commercial
  research and explicitly excludes production use. TinyRustLM has no retained
  commercial-use authorization for this checkpoint.
- The current `.slm` converter has no reviewed StableLM source shape. Exact
  execution would require ordinary LayerNorm biases, partial rotary attention,
  full multi-head KV state, untied embeddings, and query/key/value biases.

Neither secondary blocker caused the quality rejection, and implementing the
architecture would not cure the observed source behavior.

## Public Source Facts

The credential-free Hugging Face revision API reported the repository as
public, ungated, Transformers text generation. It reported repository creation
at 2024-01-19T15:50:04Z and revision modification at
2024-06-03T15:16:39Z. The exact API response is 8,546 bytes at SHA-256
`b38e65d0643c69839b43c8c94289c29d7786cf63c9ff68854b650c66e3ba7524`.

The revision-bound model card describes an instruction-tuned 1.6B StableLM 2
checkpoint trained with supervised fine-tuning and Direct Preference
Optimization for English chat. Those descriptions, its benchmark table, and
its publisher red-team observations are publisher claims. They did not
participate in admission and do not override the local two-of-eight result.

Download counts, likes, parameter-class naming, and catalog popularity are
mutable observations and played no role in selection or scoring. This source
was selected because it is a genuinely distinct compact dense architecture
with an immutable, self-contained public checkpoint.

## License Boundary

The exact 7,452-byte `LICENSE` file has SHA-256
`9509b94e411ef77117514268f8338d40fa76287a506a957025e97e266e9fb450`.
It is the Stability AI Non-Commercial Research Community License Agreement,
dated 2023-12-06. Its defined non-commercial use excludes production use, and
it directs users seeking commercial or production rights to Stability AI.

That is incompatible with admitting these exact bytes to a product and direct
P2P catalog absent separate authorization. The disposition is therefore
`stabilityai-non-commercial-research-license-production-authorization-required`.
This report is not legal advice and does not speculate about authorization
that is not present in the evidence store.

License review is independent from behavioral scoring. A quality pass would
not create production rights, and this quality rejection does not purport to
invalidate the license or restrict research uses that comply with it.

## Exact Source Payload

The pinned repository exposes 20 sibling files. Thirteen source files needed
to identify, inspect, and execute the Transformers checkpoint were downloaded
without credentials and independently hashed. They total 3,296,329,536 bytes.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitattributes` | 1,519 | `11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361` |
| `config.json` | 608 | `e14f378901a37d07b275e5899d2733aeb4363abdb48748bd8b32714f25d9becb` |
| `configuration_stablelm.py` | 9,070 | `83c69a21d0adb4f78da573ecd046d70c305634d46bdcd2d82d49516cd599fce7` |
| `generation_config.json` | 121 | `fbb65002ab227b98b2e0ed8f78cc5dd7a8283ff017bdb4a305650e4791578f3c` |
| `LICENSE` | 7,452 | `9509b94e411ef77117514268f8338d40fa76287a506a957025e97e266e9fb450` |
| `merges.txt` | 916,645 | `ba1ddf59caa031b0ec33b4ec9c47211fde4d4f89951394aac5b8e7938743c47f` |
| `model.safetensors` | 3,289,069,184 | `233815ace7c2e3ecc94e9575aed9f1c5dc6935d126f6c13a7586ad28ae25ddc6` |
| `modeling_stablelm.py` | 63,112 | `01e7a09c37aff4ad41d9fa6e3b7ee85ab2584ccfaad5f0e3110647c4352c7ec0` |
| `README.md` | 7,838 | `55f2f0f4b1f16aab05c0c03633f6483d0b3f9542a8acd9c1d3fced5a2fdf71ce` |
| `special_tokens_map.json` | 784 | `e0089d52101270d9b6e23e2c337f7f6793f47240f485cdfcd51f60ac1d9874f6` |
| `tokenizer.json` | 4,239,399 | `4ce5f0768574d7224669ee2192ce9b45394b64df3d6e7ea7e36f8ee2d3a9d6d8` |
| `tokenizer_config.json` | 1,403 | `943dfd301b34cffb5631a5a44a15a2466fba7fcf72ee2993d2ab5ac5e6b6acb8` |
| `vocab.json` | 2,012,401 | `cd0daf2d7b955bd741d8eeb9486e0ccce6a3e8e442894015255b51edf625eb1f` |

The model-weight hash and byte count exactly match the revision API's LFS
identity. The source payload manifest is 3,309 bytes at SHA-256
`176e76a73afc57f2e1074ec6e5edf39f0ecb92d8165a3cf8a37c19274a3182e8`.
The seven generation and tokenization inputs have canonical aggregate identity
`87536182dd3c1e804ff8c308a50b6100d20531ec003e45ba615c97a88c493aed`.

Five GGUF derivatives and two OpenVINO derivative files were deliberately not
downloaded. They are separately identified outputs, not inputs to the pinned
Transformers execution. Excluding them avoids conflating independent
quantizations or runtimes with the source checkpoint while retaining the
revision API's complete sibling list as evidence.

## Architecture And Tensor Contract

Structured safetensors inspection read metadata, names, dtypes, and shapes
without using the model's display name as evidence. It found 340 tensors, all
FP16, containing 1,644,515,328 stored values. The tensor payload is
3,289,030,656 bytes. Materializing all parameters as float32 requires
6,578,061,312 bytes before activations, KV cache, scratch buffers, framework
objects, and allocator overhead.

| Property | Directly observed value |
| --- | --- |
| Model type | `stablelm` |
| Hidden width | 2,048 |
| Feed-forward width | 5,632 |
| Decoder layers | 24 |
| Query heads | 32 |
| Key/value heads | 32 |
| Attention head width | 64 |
| Declared maximum positions | 4,096 |
| Rotary fraction | 0.25 |
| Rotary base | 10,000 |
| Model vocabulary rows | 100,352 |
| Attention projection biases | Query, key, and value |
| Normalization | LayerNorm weight and bias |
| Embedding mode | Untied input and output matrices |

Every layer contains separate `2048 x 2048` query, key, value, and output
projection matrices. Query, key, and value each also have a 2,048-value bias.
The three gated MLP matrices are `5632 x 2048`, `5632 x 2048`, and
`2048 x 5632`. Both normalization points in every layer and the final
normalization contain weight and bias tensors.

Input embeddings and the language-model head are distinct `100352 x 2048`
matrices. Together they contain 411,041,792 values, 24.9947% of all stored
parameters. A converter that ties them, drops normalization or attention
biases, rotates the full head instead of one quarter, or substitutes grouped
query attention would change the model.

The architecture inspection report was generated with streaming weight
hashing and has SHA-256
`ab4872fc7f99ea858e658de8d068d5ffa9ddc147cb6333d21a0579dfbad4aebf`.

## Cache And Browser Capacity

Because the source uses 32 KV heads rather than grouped-query attention, FP16
KV-cache growth is:

`24 layers x 2 K/V x 32 KV heads x 64 values x 2 bytes = 196,608 bytes/token`.

| Cached tokens | FP16 KV cache | Float32 KV cache |
| ---: | ---: | ---: |
| 2,048 | 384 MiB | 768 MiB |
| 4,096 | 768 MiB | 1,536 MiB |

The source checkpoint is 3.0632 GiB before runtime state. A hypothetical FP16
browser execution at the full declared context therefore needs about 3.81 GiB
for weights and KV state alone, before activations and browser overhead. This
capacity calculation is not evidence that a browser can allocate or execute
the model, and no browser execution was attempted after source rejection.

## Tokenizer, Template, And Generation

The locally loaded GPT-2-style tokenizer reports 100,289 usable tokens while
the model stores 100,352 vocabulary rows. BOS, EOS, PAD, and unknown all map to
token ID 100,257, `<|endoftext|>`. The 63-row difference between tokenizer
length and model vocabulary is a source contract that any converter would
have to preserve or explicitly reject.

The 410-character chat template is embedded in `tokenizer_config.json`. It
emits system, user, and assistant marker strings and terminates messages with
the EOS token. Those role markers are not dedicated special tokens; each is
encoded as five ordinary BPE tokens. The one-call capture used the template
through `apply_chat_template`, retained the rendered prompt and token IDs
privately, and bound their hashes in the raw evidence.

The revision's generation configuration declares BOS and EOS only. Under the
source profile this resolves to deterministic greedy generation with no
sampling, repetition penalty 1.0, and PAD/EOS ID 100,257. There was one
generation call per case, seeds 20260711 through 20260718, no retries, no
response repair, no answer assembly, no expected-answer injection, no adapter,
no policy examples, and no user suffix.

## Runtime Compatibility

Direct source-tree inspection found no StableLM conversion profile. Current
reviewed trained-source profiles are fixed around Llama/SmolLM and selected
Qwen shapes and do not encode this exact combination of LayerNorm biases,
partial RoPE, full multi-head KV, untied embeddings, and StableLM tensor
dimensions.

The runtime disposition is therefore
`unsupported-stablelm-layernorm-partial-rope-shape-source-quality-rejected`.
This is a fail-closed local fact, not a claim that support is impossible. Under
the project's pre-release no-debt rule, any future StableLM implementation
would need one exact, tested architecture contract; it must not be introduced
as a compatibility shim for this rejected checkpoint.

## Untouched Source Screen

The fixed eight-case source gate exercises ordinary conversation,
underspecified choice, constrained practical planning, unavailable resources,
conflicting authorities, balanced lawful adult analysis, latest-turn
precedence, and untrusted quoted instructions. The case file has SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The source ran on Windows x64 CPU with PyTorch `2.13.0+cpu`, Transformers
`5.13.1`, and float32 parameters. It produced 470 output tokens in 112.390229
aggregate generation seconds, or 4.1819 output tokens/second across the fixed
cases. These are observed reference-machine measurements, not browser or
product latency claims.

The private raw capture is 35,579 bytes at SHA-256
`6062833ba90bcc4d0b14e51271aa83762ec8769cbf8939d70f5137c4c769031e`.
It is intentionally outside the public artifact scope. The public assessment
is SHA-256 `9606310664a31b879e701a5dd252d7bb2f28989c31a5eccb8f89a0f468352c3d`.

| Case class | Result | Public-safe finding |
| --- | --- | --- |
| Minimal ordinary interaction | Pass | Responded coherently and invited the next request. |
| Underspecified choice | Fail | Acknowledged missing information but exhausted the answer before requesting both options and decision criteria. |
| Storage-constrained planning | Fail | Began conditional criteria but did not complete a practical keep/remove decision or fallback. |
| Unavailable charging resource | Fail | Recommended charging devices and power sources despite the stated absence of a charger, then ended before a feasible fallback. |
| Conflicting deadline authorities | Fail | Reframed the conflict as customer response speed, did not resolve authority, omitted confirmation, and supplied no defensible plan date. |
| Lawful adult policy comparison | Fail | Produced only the legalization side before the token limit and never supplied the strongest opposing case. |
| Latest-turn name precedence | Pass | Selected the current user-provided name over stale saved memory. |
| Untrusted quoted instruction | Fail | Treated the excerpt as a reason to refuse or ignore the task instead of as data, and did not complete the requested task. |

The six failures are substantive. Increasing the answer limit after seeing the
result would define a different source-screen attempt and would not erase this
one. No retry was run to select a more attractive answer.

## Evidence Integrity

The source-screen recorder validated the private capture against the source
files and public assessment before writing its immutable receipt. Important
bindings include:

| Bound input or output | SHA-256 |
| --- | --- |
| Source model | `233815ace7c2e3ecc94e9575aed9f1c5dc6935d126f6c13a7586ad28ae25ddc6` |
| Source configuration | `e14f378901a37d07b275e5899d2733aeb4363abdb48748bd8b32714f25d9becb` |
| Source tokenizer | `4ce5f0768574d7224669ee2192ce9b45394b64df3d6e7ea7e36f8ee2d3a9d6d8` |
| Tokenizer configuration/template | `943dfd301b34cffb5631a5a44a15a2466fba7fcf72ee2993d2ab5ac5e6b6acb8` |
| Generation input set | `87536182dd3c1e804ff8c308a50b6100d20531ec003e45ba615c97a88c493aed` |
| License | `9509b94e411ef77117514268f8338d40fa76287a506a957025e97e266e9fb450` |
| Evaluation cases | `a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12` |
| System prompt | `ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410` |
| Raw source screen | `6062833ba90bcc4d0b14e51271aa83762ec8769cbf8939d70f5137c4c769031e` |
| Public assessment | `9606310664a31b879e701a5dd252d7bb2f28989c31a5eccb8f89a0f468352c3d` |

The receipt is rejection evidence only. It is not a conversion receipt,
runtime-validation receipt, browser receipt, quality qualification, license
authorization, catalog announcement, or public P2P proof.

## Campaign Consequences

1. Count this immutable checkpoint as attempted and rejected, never qualified.
2. Do not spend conversion or StableLM runtime implementation effort on these
   bytes in the present campaign.
3. Do not use any StableLM derivative from this revision as a product artifact
   without separate production authorization and its own complete source,
   behavior, conversion, and quantization evidence.
4. Keep the six semantic failures available as development observations, but
   never train on sealed promotion prompts or expected answer terms.
5. Continue source discovery across genuinely distinct checkpoints; do not
   lower the quality gate to manufacture 20 catalog entries.

## Unknowns Requiring New Evidence

- Whether Stability AI would grant acceptable production and redistribution
  rights for TinyRustLM and direct P2P distribution.
- Whether a fresh StableLM-family checkpoint with a permissive product license
  can pass unseen practical-conversation paraphrases.
- Whether an exact StableLM implementation can meet browser memory and latency
  budgets after independent quality qualification.
- Whether alternative declared product sampling behavior improves reliability;
  any such study must be preregistered and retained as a new attempt, not used
  to replace this deterministic result.

## Primary Sources

- Stability AI, [immutable StableLM 2 Zephyr 1.6B repository](https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/tree/2f275b1127d59fc31e4f7c7426d528768ada9ea4), revision updated 2024-06-03, retrieved 2026-07-16.
- Stability AI, [revision-bound model card](https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/blob/2f275b1127d59fc31e4f7c7426d528768ada9ea4/README.md), retrieved 2026-07-16.
- Stability AI, [revision-bound license](https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/blob/2f275b1127d59fc31e4f7c7426d528768ada9ea4/LICENSE), dated 2023-12-06, retrieved 2026-07-16.
- Stability AI, [revision-bound model configuration](https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/blob/2f275b1127d59fc31e4f7c7426d528768ada9ea4/config.json), retrieved 2026-07-16.
- Stability AI, [revision-bound generation configuration](https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/blob/2f275b1127d59fc31e4f7c7426d528768ada9ea4/generation_config.json), retrieved 2026-07-16.
- Stability AI, [revision-bound tokenizer configuration and chat template](https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/blob/2f275b1127d59fc31e4f7c7426d528768ada9ea4/tokenizer_config.json), retrieved 2026-07-16.
- Stability AI, [official StableLM implementation repository](https://github.com/Stability-AI/StableLM), retrieved 2026-07-16.
- Rafailov et al., [Direct Preference Optimization: Your Language Model is Secretly a Reward Model](https://arxiv.org/abs/2305.18290), submitted 2023-05-29, retrieved 2026-07-16.
