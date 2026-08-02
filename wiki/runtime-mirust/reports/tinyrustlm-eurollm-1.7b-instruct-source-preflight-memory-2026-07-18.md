# TinyRustLM EuroLLM 1.7B Instruct Source Preflight Memory

Date: 2026-07-18

## Decision

Exact source `utter-project/EuroLLM-1.7B-Instruct` revision
`fbfaca89e5213c640dbb048ed169ac24213da338` is terminally rejected at source
preflight. Its source bytes are public and ungated, and the native dense Llama
checkpoint is structurally inspectable without publisher Python. The blocker
is the publisher's internally inconsistent conversation contract.

TinyRustLM did not run the private quality suite, convert this source, create
an adapter, or produce an `.slm`. No catalog, quality, browser, memory, or P2P
credit follows from this review.

## Fact Classes

- **Direct public observation:** the immutable repository API, model card,
  configuration, generation configuration, special-token map, and tokenizer
  configuration listed below were retrieved from the publisher revision.
- **Local observation of public source:** the exact safetensors object was
  acquired outside Git, streamed through SHA-256, and inspected structurally.
  A local Transformers 5.13.1 render was performed without remote code.
- **Engineering decision:** a source with contradictory role serialization
  and stop metadata is rejected before raw quality evaluation or conversion.
- **Not established:** conversational quality, TinyRustLM numerical parity,
  quantized quality, runtime speed, browser memory, redistribution approval,
  or production suitability.

## Public Source Identity

The pinned repository API was observed at
`2026-07-18T17:07:13.3404906Z` and reported:

- public, ungated, enabled access;
- native `LlamaForCausalLM` and `model_type: llama` metadata;
- Apache-2.0 card metadata;
- one 3,313,726,248-byte BF16 safetensors object; and
- published LFS SHA-256
  `853ac1edd51009c46ce28e457a389ef69206b27e3b9734a43ae0644e766553ac`.

The locally streamed hash matched that publisher LFS identity. The weight file
remains outside Git. The public assessment records only its name, size, and
SHA-256; it contains no private path or model bytes.

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `config.json` | 712 | `f0c12f25e72422f319f3d995b171b686adcc502811d6a4871851a0a410e7d325` |
| `generation_config.json` | 132 | `6228bd42af4cfb741f38c5bfb05eebe129283ae138daf9209b926e363c19e548` |
| Apache-2.0 text | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| model card | 12,862 | `99d9d767545eeccff1689abda880980517c8d35ae698fce4002bc02c18dbf274` |
| repository API response | 3,675 | `676165754e7c96981b71c1e4dedf90f8245f5266dc351fe683d1657785e53095` |
| special-token map | 443 | `60f4998edef989ba22a5eba0838fdce563b44fd6c75a22fc27967720541ff6ad` |
| tokenizer configuration | 47,340 | `859ddfb37cd6febfd2e3cf237ec952f91af1149db5b532849238e409aa50f576` |

## Structural Observation

Local safetensors inspection found 219 BF16 tensors and 1,656,850,432
parameters. The publisher configuration and tensor inventory agree on:

- 24 dense decoder layers;
- hidden width 2,048 and intermediate width 5,632;
- 16 query heads and 8 key/value heads, each with dimension 128;
- RMSNorm, SiLU/SwiGLU, and RoPE with theta 10,000;
- a 128,000-token vocabulary and untied input/output embeddings; and
- a declared 4,096-token context.

For BF16 keys and values, the declared geometry implies
`2 * 24 * 8 * 128 * 2 = 98,304` KV-cache bytes per cached token, before
allocator and runtime overhead. A full 4,096-token cache is therefore
384 MiB. These are arithmetic consequences of the public configuration, not
measured browser memory.

## Publisher Conversation Contract Failure

Three independent publisher surfaces disagree about how generation starts and
ends:

1. `config.json` declares `eos_token_id: 4`.
2. `tokenizer_config.json` and `special_tokens_map.json` identify token 4 as
   `<|im_end|>` and token 2 (`</s>`) as padding.
3. `generation_config.json` declares `eos_token_id: 2` and enables sampling.

The embedded chat template serializes every supplied role through a terminal
`<|im_end|>`, but it does not reference `add_generation_prompt` and never emits
the next `<|im_start|>assistant` prefix. With Transformers 5.13.1, the system
message `System rule.` and user message `Hello.` rendered identically whether
`add_generation_prompt` was false or true:

```text
<|im_start|>system
System rule.<|im_end|>
<|im_start|>user
Hello.<|im_end|>
```

Those UTF-8 bytes had SHA-256
`47e19676071d4e8ea3eff341217f647c79d5f4efe2a0b04b26475d848dd81575`.
The model card's own example instead hand-builds a string ending in
`<|im_start|>assistant\n`. It does not use the published chat template.

TinyRustLM cannot choose between these contracts without modifying source
behavior. Appending an assistant prefix, replacing the stop token, or selecting
the most attractive output would make the source screen a TinyRustLM-authored
experiment rather than an untouched publisher-source evaluation.

## Evidence Control

`source-model-preflight-evidence.js` tool version 6 introduces assessment
schema `tinyrustlm.source_model_preflight_assessment.v2`. For source-acquired
rejections it requires:

- an explicit `sourceAcquisitionStatus: complete`;
- a private source root supplied only at execution time;
- streamed size and SHA-256 verification for every direct or indexed
  safetensors artifact;
- exact index-to-shard agreement for indexed checkpoints; and
- `sourceModel`, `sourceWeightSet`, and per-weight hashes in the receipt.

Historical v1 assessments remain readable as immutable audit evidence, but v1
can no longer infer acquisition from an empty missing-file list. The public
receipt exposes source identity and bounded counts only.

The terminal reasons are:

- `publisher-chat-template-card-serialization-conflict`;
- `publisher-chat-template-generation-prefix-absent`;
- `publisher-generation-stop-token-conflict`; and
- `source-screen-conversation-contract-incomplete`.

## License Boundary

The model card and repository metadata declare Apache-2.0, but the immutable
repository tree contains no bundled `LICENSE` file. This review records the
declaration and the absence; it does not claim that TinyRustLM completed legal
review or approved P2P redistribution.

## Consequences

- Keep the exact source and bounded public metadata evidence outside Git until
  ordinary retention cleanup is authorized.
- Do not run raw quality, conversion, quantization, browser, or P2P phases for
  this revision.
- Do not add a compatibility template, alternate stop rule, model-specific
  repair, or legacy branch to make this candidate pass.
- A future publisher revision may be assessed as a new immutable source. It
  must publish one coherent template, generation-prefix rule, and stop-token
  contract before evaluation begins.

## Primary Sources

- [Immutable repository tree](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct/tree/fbfaca89e5213c640dbb048ed169ac24213da338)
- [Model card](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct/blob/fbfaca89e5213c640dbb048ed169ac24213da338/README.md)
- [Model configuration](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct/blob/fbfaca89e5213c640dbb048ed169ac24213da338/config.json)
- [Generation configuration](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct/blob/fbfaca89e5213c640dbb048ed169ac24213da338/generation_config.json)
- [Special-token map](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct/blob/fbfaca89e5213c640dbb048ed169ac24213da338/special_tokens_map.json)
- [Tokenizer configuration](https://huggingface.co/utter-project/EuroLLM-1.7B-Instruct/blob/fbfaca89e5213c640dbb048ed169ac24213da338/tokenizer_config.json)
- [Pinned repository API](https://huggingface.co/api/models/utter-project/EuroLLM-1.7B-Instruct/revision/fbfaca89e5213c640dbb048ed169ac24213da338)
- [EuroLLM paper](https://arxiv.org/abs/2409.16235)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)
