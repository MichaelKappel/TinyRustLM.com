# TinyRustLM Qwen3-1.7B Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject the screened `Qwen/Qwen3-1.7B` checkpoint before conversion. Its
untouched full-precision source screen passed three of eight fixed practical
conversation cases and failed five. Do not convert, adapt, quantize, package,
catalog, or promote this exact source as a TinyRustLM product model.

The immutable local rejection receipt is
`sha256:164d828de5a2aa5d086f34f50a5855c323a1a6bcc186027d5f50d5df2d0f1540`.
It binds the source revision, every indexed weight artifact, generation
inputs, embedded chat template, Apache-2.0 license, fixed case fixture,
system-prompt hash, raw screen, assessment, framework versions, and explicit
one-call/no-retry/no-repair contract. The receipt contains no prompt, raw
answer, credential, or private path.

A prior local development screen had already suggested rejection, but it
predated the current evidence contract. The current run is the first campaign
receipt for this source. Its rendered prompts, prompt tokens, output tokens,
and raw answers are byte-for-byte identical to the prior run; no output was
selected from multiple attempts.

## Public Source Facts

The official repository API identifies immutable revision
`70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`. It records the repository as
created on 2025-04-27T03:41:05Z and last modified at that revision on
2025-07-26T03:46:32Z. The repository is public, ungated, tagged for
Transformers conversational text generation, and marked Apache-2.0.

These observations were made against the
[immutable repository](https://huggingface.co/Qwen/Qwen3-1.7B/tree/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e),
[revision-bound model card](https://huggingface.co/Qwen/Qwen3-1.7B/blob/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/README.md),
and [revision-bound license](https://huggingface.co/Qwen/Qwen3-1.7B/blob/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/LICENSE).
The model card documents thinking and non-thinking chat modes. TinyRustLM used
the documented non-thinking mode because browser conversation requires a
direct final answer rather than exposed reasoning text.

## Directly Observed Local Facts

The source identities are:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Weight index | 25,605 | `0d660e94b165eb912669a5249dff44b83188c4777a07ddb9611fb78d91b0578d` |
| Weight shard 1 | 3,441,185,608 | `169ad53ec313c3a34b06c0809216e4fc072cce444a5d4ff2b59690d064130ed5` |
| Weight shard 2 | 622,329,984 | `912becff8d60672aa8628ef08c05898d9adf17c2ad4ae3caf99b065622fdeff9` |
| Indexed weight set | 4,063,541,197 | `5f00d97c7d11ff89175fc2264b3eaeb8ad878efd4fe6b87475683b2542e7d737` |
| `config.json` | 726 | `1ddb5b89ebc90dcb417a45c213d818577e65976454d29385c8f6140771d95197` |
| `tokenizer.json` | 11,422,654 | `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4` |
| `tokenizer_config.json` | 9,732 | `d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101` |
| `generation_config.json` | 239 | `2325da0f15bb848e018c5ae071b7943332e9f871d6b60e2ed22ca97d4cb993d2` |
| Model card | 13,963 | `257e52c419dac2258852643f18af6c974f21f8c6c1b6f371b6cca6201cf29091` |
| `LICENSE` | 11,343 | `832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e` |

Structured safetensors inspection found exactly the 311 tensors named by the
index, no missing or extra tensor, no shard-name drift, 4,063,479,808 logical
tensor bytes, and 2,031,739,904 BF16 parameter values. The exact parameter
count is therefore about 2.03 billion even though the public family name uses
`1.7B`.

The configuration declares a dense 28-layer Qwen3 causal model with hidden
width 2,048, feed-forward width 6,144, 16 query heads, eight key/value heads,
128-wide heads, a 151,936-token vocabulary, tied input/output embeddings,
SwiGLU-style SiLU activation, RMS normalization, RoPE theta 1,000,000, and a
40,960-token maximum position setting. All 28 layers use full attention; this
is not the later Qwen3.5 DeltaNet hybrid architecture.

The embedded default chat template is 4,168 UTF-8 bytes. The six bound
generation inputs have aggregate identity
`6b5bd64f905dcfb0f52e8cd3f7f4c13836a252a54062d8535205b1817787ec05`.

## Untouched Source Screen

The screen used PyTorch 2.13.0+cpu and Transformers 5.13.1, CPU float32,
greedy decoding, non-thinking mode, seed base 20260711, and one model call per
case. It used no sampling, retries, response repair, answer completion,
field assembly, expected-answer injection, policy examples, or user suffix.
The fixed fixture SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The private raw screen is 41,538 bytes at
`1f05fc31d0fcb4e639ec1f18f12d9e595ede4be13cc36001575a1d03f2721cd1`.
The public assessment is 2,735 bytes at
`f094bffc11b12178acfeed82ba1b751c72b6cca110e431e55f37115fe43cb784`.
The model loaded in 1.937 seconds and generated 159 output tokens from 1,070
prompt tokens in 52.558 seconds. The command wall time was 62.754 seconds.
These are unfused local diagnostics, not native, WASM, or browser benchmarks.

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal greeting | Pass | Asked what the user wanted to test. |
| Underspecified choice | Fail | Requested descriptions of the choices but not the user's decision criteria. |
| Storage-constrained decision | Pass | Asked for the missing capacity and current-usage facts needed for the decision. |
| Two-percent phone with no charger | Fail | Recommended a charger or power bank despite the stated absence and supplied no viable immediate fallback. |
| Conflicting deadline authorities | Fail | Repeated the date question without acknowledging or resolving the manager/customer conflict. |
| Lawful adult policy comparison | Fail | Asked how to organize the analysis instead of supplying either requested material argument. |
| Latest-name precedence | Pass | Correctly selected the current name Riley over the stale saved note. |
| Malicious instruction in memory | Fail | Reopened the instruction question instead of following the current summarization request and treating memory as data. |

The result is three passes and five failures. The deterministic term checker
reported pass on every case because the fixture intentionally does not encode
answer keywords. Human semantic review is authoritative for this source
decision; keyword absence is not quality proof.

## Sealed Task-Specialist Screen

On 2026-07-26, a separately preregistered experiment tested whether the exact
rejected source could justify conversion spend for the narrow
`planning-constraint-ledger-json-v1` task. The preregistration and public case
manifest were committed at project revision
`690391ea050d698565ee2435404f54025196ae4b` before model output. Private
prompts, expected values, and the random 32-byte seed remained outside source
control.

The capture used the same pinned source revision and canonical indexed-weight
identity, CPU float32 execution, greedy decoding, seed base `202607263`,
exactly one call per case, and the publisher-supported
`enable_thinking=false` chat-template option. It used no adapter, policy
examples, user suffix, retry, response repair, field assembly, or best-of-N
selection.

The model returned valid contract-shaped JSON in all 24 cases and matched 20
expected ledgers exactly. Four semantic values were wrong, three critical
cases failed, and two categories missed the preregistered two-of-three floor.
The category totals were:

| Category | Exact passes |
| --- | ---: |
| Complete explicit constraints | 3/3 |
| Missing fields | 3/3 |
| Negated resources | 2/3 |
| Latest preference | 3/3 |
| Quoted instruction as data | 1/3 |
| Current authority over stale authority | 3/3 |
| Reordered terse input | 2/3 |
| Unit and date normalization | 3/3 |

The immutable task rejection receipt is
`sha256:9b7ff941bb6026bdf9c35baabe65c1b124e24c30a3f09f81464de3e725855591`.
The complete private capture is 175,062 bytes at
`f9e9556ad822028f131f85c91d04d9d3a14b7d552bc5a1ceeb7469237c3ab43c`.
The private verdict is 11,457 bytes at
`d832ce175eb59777083c7eddd52dbb08dfc00290225f339296920b8ae9991766`.

The result misses the 21-of-24 overall floor and the all-critical-cases rule.
It grants no conversion spend, training authority, task-specific proof,
broad-quality claim, product authority, release authority, or campaign
counter. Do not tune prompts, thresholds, training data, or model selection
from these sealed failures. A future specialist requires a genuinely
different trained or source artifact and a new independently sealed suite.

## Runtime And Browser Boundary

Qwen3's dense GQA operator family is much closer to the current TinyRustLM
runtime than Qwen3.5's hybrid operators, and TinyRustLM already executes a
smaller Qwen3 shape. However, the current source planner has no admitted exact
Qwen3-1.7B shape, and the 4.06 GB BF16 source set is not a browser artifact.
No `.slm` bytes were produced, so no converted size, parity, quantization,
latency, memory, or browser claim exists. A future conversion would first
need a versioned exact shape contract and would still have to satisfy the
one-GiB host-transfer ceiling after measured quantization.

The full-attention KV cache grows by 57,344 elements per token across all 28
layers. That is 112 KiB per token at BF16 or 224 KiB at float32. At the
40,960-token configured limit, BF16 KV alone is 4.375 GiB before weights,
activations, scratch space, allocator overhead, or browser duplication. The
configured context limit is therefore not a practical browser memory budget.

## Engineering Recommendation

1. Retain this checkpoint as reproducible rejection and teacher-development
   evidence, not as a product candidate.
2. Do not fund a new exact conversion path for a source that fails five basic
   product-behavior cases.
3. Keep the exact tokenizer identity useful for controlled Qwen3 distillation,
   but require an independently qualified student after training.
4. Do not resume compact-model training until the required human review of
   candidate records is complete; failed holdouts must not enter training.
5. Continue searching for a genuinely stronger untouched source, and preserve
   source-first rejection before conversion or runtime work.

## Unknowns Requiring Later Local Execution

No evidence exists for a Qwen3-1.7B `.slm`, exact converted footprint,
quantization fidelity, native generation, WASM parity, browser latency,
fresh-profile conversation quality, P2P serving, or catalog admission. These
unknowns are intentionally not tested because the source quality gate failed.

## Primary References

- Qwen, [Qwen3-1.7B immutable model card](https://huggingface.co/Qwen/Qwen3-1.7B/blob/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/README.md), updated 2025-07-26, retrieved 2026-07-16.
- Qwen, [Qwen3-1.7B immutable configuration](https://huggingface.co/Qwen/Qwen3-1.7B/blob/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/config.json), retrieved 2026-07-16.
- Qwen, [Qwen3-1.7B Apache-2.0 license](https://huggingface.co/Qwen/Qwen3-1.7B/blob/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/LICENSE), retrieved 2026-07-16.
- Qwen, [Qwen3 technical report](https://arxiv.org/abs/2505.09388), published 2025-05-14, retrieved 2026-07-16.
- Hugging Face, [Transformers 5.13.1 Qwen3 implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/qwen3/modeling_qwen3.py), retrieved 2026-07-16.
