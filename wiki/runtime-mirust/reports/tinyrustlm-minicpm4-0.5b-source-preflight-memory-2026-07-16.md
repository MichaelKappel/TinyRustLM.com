# TinyRustLM MiniCPM4 0.5B Source Preflight Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable candidate `openbmb/MiniCPM4-0.5B` revision
`5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630` before source acquisition or
inference. Do not download the tensor payload, execute the repository Python,
weaken the local-only source-screen loader contract, add a MiniCPM-specific
reference loader, implement MiniCPM runtime or converter support, quantize the
checkpoint, or use it in a browser or catalog lane for this campaign.

The current local rejection receipt is
`sha256:a913153dcd115cb4b7811c1bdca662eff78721099edefa521a7e50c6f858f81a`.
It binds the immutable Hugging Face revision, public repository metadata,
configuration, tokenizer configuration, both custom Python files, a bounded
safetensors-header observation, the linked official Apache-2.0 license, the
Transformers 5.13.1 auto-configuration registry, the public engineering
assessment, and recorder identity. It supersedes preliminary receipt
`sha256:8a64851e4112cbd2116ff6c6b45279d1614903b8112731863b06bd2bde3d18ac`,
which was recorded before the safetensors header was added to the evidence
set. Neither receipt is a quality claim.

This is an engineering admission decision under the campaign's fixed
local-files-only, no-remote-code source-screen contract. It is not a claim
that MiniCPM4 is malicious, low quality, or impossible to port in another
project.

## Directly Observed Public Facts

The credential-free Hugging Face API reported the candidate as public,
ungated, enabled, and associated with Transformers text generation. It
reported model revision
`5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630`, card license metadata
`apache-2.0`, creation time 2025-06-05, and last modification time
2025-10-20.

The revision contains twelve repository files. It includes:

- `model.safetensors`, 867,772,648 bytes, with publisher storage SHA-256
  `ef74f4de1d1c580dd64e425d11f29881b9fd39f9be16a485150f727d4583181c`;
- `modeling_minicpm.py`, 69,994 bytes;
- `configuration_minicpm.py`, 9,660 bytes;
- `tokenizer.json`, 6,701,371 bytes;
- `tokenizer.model`, 1,181,204 bytes;
- model, tokenizer, generation, and special-token configuration files.

The model repository does not contain a `LICENSE` or `NOTICE` file. Its model
card declares Apache-2.0 and links the official OpenBMB/MiniCPM repository's
license. On retrieval, the official repository head was immutable commit
`0fcc3d08330ee612d59d58e312a778ae78165d97`, whose `LICENSE` body is the
Apache License 2.0 and has SHA-256
`202d02b14796563546e1a1d1e761410fa9e399bf7e1b85d8b43c972658341202`.
The absence of a revision-local license copy is a packaging fact, not the
reason for rejection.

The pinned model configuration declares:

| Field | Value |
| --- | ---: |
| Architecture | `MiniCPMForCausalLM` |
| Hidden width | 1,024 |
| Intermediate width | 4,096 |
| Layers | 24 |
| Query heads | 16 |
| KV heads | 2 |
| Head width | 64 |
| Vocabulary | 73,448 |
| Maximum positions | 32,768 |
| Source dtype | BF16 |
| Embedding scale | 12 |
| Depth scale | 1.4 |
| Logit base dimension | 256 |

The config has an `auto_map` that routes `AutoConfig` and causal-language-model
loading to `configuration_minicpm.py` and `modeling_minicpm.py`. It does not
declare a standard Transformers `model_type`. The pinned model card's
Transformers example explicitly passes `trust_remote_code=True`.

The config contains LongRoPE short and long factor arrays. The custom model
implementation multiplies token embeddings by `scale_emb`, scales each
attention and MLP residual contribution by
`scale_depth / sqrt(num_hidden_layers)`, and divides final hidden states by
`hidden_size / dim_model_base` before the language-model projection. These are
model semantics, not metadata that can be ignored by treating the checkpoint
as ordinary Llama weights.

The family model card discusses InfLLM v2 sparse attention, but the pinned
0.5B config has no active sparse configuration. The reviewed implementation
path is dense causal GQA with eager, SDPA, and optional FlashAttention
variants. This decision therefore does not classify the exact checkpoint as a
sparse-attention runtime.

The tokenizer configuration declares `LlamaTokenizer`, adds BOS, does not add
EOS automatically, and embeds a ChatML-style template using
`<|im_start|>`/`<|im_end|>`. Its configured EOS token is `<|im_end|>`, while
the model config lists EOS IDs 2 and 73440. The tokenizer's enormous
`model_max_length` sentinel is not evidence of a context larger than the
model's 32,768 configured positions.

## Bounded Tensor-Header Observation

No complete model file or tensor payload was acquired. A credential-free HTTP
range read retrieved the eight-byte safetensors header length and the exact
24,800-byte JSON header, after which the temporary range bytes were deleted.
The bound summary reports:

- 218 tensors, all BF16;
- 433,873,920 total tensor elements;
- 867,747,840 tensor-payload bytes;
- standard Llama-like names for embedding, RMSNorm, Q/K/V/O, and gated MLP
  tensors;
- embedding shape `[73448, 1024]`;
- first-layer Q/O shapes `[1024, 1024]` and K/V shapes `[128, 1024]`;
- first-layer gate/up shapes `[4096, 1024]` and down shape `[1024, 4096]`;
- no separate `lm_head.weight`, consistent with tied output embeddings.

Header compatibility does not prove executable compatibility. The custom
scaling and LongRoPE operations are outside the current TinyRustLM source
contract even though the tensor names look familiar.

## Transformers Compatibility Observation

The exact official Transformers 5.13.1
`configuration_auto.py` registry contains no MiniCPM configuration mapping.
The installed campaign reference environment independently reported
Transformers 5.13.1 with neither `MiniCPMConfig` nor
`MiniCPMForCausalLM` exported and no `minicpm` auto-config entry. No repository
Python was imported or executed to reach that result.

Consequently, `AutoModelForCausalLM.from_pretrained(...,
trust_remote_code=False)` has no native architecture route for this pinned
checkpoint. Loading it through the publisher's documented path would require
executing revision-supplied Python, which the source-screen evidence schema and
campaign test plan explicitly prohibit.

## Sourced External Facts

The model card says MiniCPM4 was released on 2025-06-06, labels this artifact a
0.5B model trained on one trillion tokens, and describes UltraChat v2,
InfLLM v2, and CPM.cu as family technologies. The associated technical report
is arXiv:2506.07900. Those are publisher statements, not locally validated
training receipts, quality measurements, or browser results.

The model card also reports benchmark and throughput results. None influenced
this decision. Popularity, benchmark familiarity, parameter count, and a
standard-looking tensor header cannot substitute for the required untouched
TinyRustLM source screen.

## Engineering Determination

Three related but independently recorded rejection codes apply:

1. `custom-publisher-code-required`: the pinned config routes model loading to
   revision-supplied Python and the publisher's own example enables remote
   code.
2. `native-transformers-architecture-absent`: the exact Transformers 5.13.1
   reference registry has no MiniCPM mapping, so disabling remote code leaves
   no standard loader path.
3. `source-screen-loader-contract-incompatible`: the campaign requires every
   new source screen to bind local files, `trust_remote_code=false`, eager
   CPU execution, one generation call, and untouched output. This candidate
   cannot reach that screen without first changing the architecture contract.

Implementing a MiniCPM-only Python loader, Rust converter, LongRoPE path, and
runtime scaling path before the candidate passes source quality would reverse
the campaign's required ordering. It would spend engineering effort and create
an architecture obligation before the source model earns conversion work. The
pre-release no-debt rule therefore makes this a terminal source-review
rejection for the exact revision.

## Evidence Inventory

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| Revision-bound model config | 2,403 | `610c5b519420a3633ec4950c15a26d83ad0e9be35ef9d00a9e3d2b621b325f72` |
| Revision-bound custom configuration | 9,660 | `1e289912fdc0608ccad3983f4ff8b381ec8f161f45c85be4d694f92f17596b0a` |
| Pinned official Apache-2.0 license | 11,335 | `202d02b14796563546e1a1d1e761410fa9e399bf7e1b85d8b43c972658341202` |
| Revision-bound model card | 11,590 | `9ecaf0591b47a7d2d94555f1e796afa032bdfe28cbd75ae1a20edc9c4cfa23b7` |
| Revision-bound custom modeling | 69,994 | `c646022c44d0e1cc1d149fb80422a5d5f1ba6de66dd0f525f2be1e18d99994bf` |
| Credential-free repository response | 3,146 | `0638254a18a408b8668d28a980b183c3a2ae1f84a20f61f85a85f1102047a96a` |
| Bounded safetensors-header summary | 5,845 | `ef995b775414ae7312da1186d698a9d375c1e42eee87e15082b5feae708231d8` |
| Revision-bound tokenizer config | 2,835 | `8bef75d59004eb0e62db89e97090d4736b14fd6c4a0282370c28833be1e83051` |
| Transformers 5.13.1 auto-config registry | 19,425 | `c1ff7fc0cb204cfdbe837993b7bba85aadec28254852c55fe32be997bdf1411a` |
| Canonical evidence set | n/a | `49e384862afb66ab2a8d4b328af012d02808706b6a16d289d0c390b39ac4dbb0` |
| Public assessment | 5,527 | `9d93f0abd0e7cdfdbbd50db78ec76291d2c0d4ad71c2263c78d4653f97b9a87e` |
| Preflight recorder v1 | 15,480 | `adf1b0442d63ceeced06c2330bba2d750134454d0f8c1d09b99f0800b9269df0` |

The nine public evidence bodies are retained outside the repository as local
review inputs. The committed assessment contains only public URLs, timestamps,
sizes, hashes, bounded codes, and immutable identities. The full model, tensor
payload, tokenizer payloads, and custom code are not packaged into campaign
source artifacts.

## What Was Not Done

- No credential, access token, or terms acceptance was required or used.
- No complete model or tokenizer artifact was acquired.
- No tensor payload was downloaded; only the bounded safetensors header range
  was inspected.
- No repository Python or custom publisher code was imported or executed.
- No inference, generation, source quality screen, conversion, quantization,
  browser run, latency measurement, or memory measurement occurred.
- No claim is made that MiniCPM4 0.5B would pass or fail any conversational
  case.
- No MiniCPM, LongRoPE, residual-scaling, or custom-loader compatibility path
  was added.

## Campaign Consequences

1. Count this exact source identity as attempted at source review and rejected,
   never qualified.
2. Keep it out of the 20-model target and all conversion, runtime, browser,
   P2P, and catalog queues.
3. Preserve both receipt attempts. The second supersedes the first because it
   binds strictly more public evidence; neither receipt may be overwritten.
4. Do not create a MiniCPM-specific compatibility route for these rejected
   bytes.
5. A future immutable source may receive a new review if it has a natively
   registered, no-remote-code loader path. That would be a new source decision,
   not a relabeling or retry of this rejected revision.

## Unknowns Requiring A Different Product Decision

- Untouched conversational quality on the private source-screen cases.
- Whether an independently authored MiniCPM implementation could match the
  publisher's first-step logits exactly.
- Native and WASM correctness for custom residual scaling and LongRoPE.
- Quantized quality, browser memory, KV-cache behavior, and latency.
- Whether the upstream repository has an additional attribution or notice
  obligation beyond the linked Apache-2.0 text.

None of these unknowns needs resolution for the present rejection.

## Primary Sources

- OpenBMB, [immutable MiniCPM4 0.5B repository](https://huggingface.co/openbmb/MiniCPM4-0.5B/tree/5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630), retrieved 2026-07-16.
- OpenBMB, [revision-bound model card](https://huggingface.co/openbmb/MiniCPM4-0.5B/blob/5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630/README.md), released 2025-06-06, retrieved 2026-07-16.
- OpenBMB, [revision-bound model configuration](https://huggingface.co/openbmb/MiniCPM4-0.5B/blob/5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630/config.json), retrieved 2026-07-16.
- OpenBMB, [revision-bound custom configuration](https://huggingface.co/openbmb/MiniCPM4-0.5B/blob/5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630/configuration_minicpm.py), retrieved 2026-07-16.
- OpenBMB, [revision-bound custom modeling](https://huggingface.co/openbmb/MiniCPM4-0.5B/blob/5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630/modeling_minicpm.py), retrieved 2026-07-16.
- OpenBMB, [revision-bound tokenizer configuration](https://huggingface.co/openbmb/MiniCPM4-0.5B/blob/5253c7fcc5e29e1cf3eacb59a58adf1ba4df8630/tokenizer_config.json), retrieved 2026-07-16.
- OpenBMB, [Apache-2.0 license at official commit](https://github.com/OpenBMB/MiniCPM/blob/0fcc3d08330ee612d59d58e312a778ae78165d97/LICENSE), retrieved 2026-07-16.
- Hugging Face, [Transformers 5.13.1 auto-configuration registry](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/auto/configuration_auto.py), retrieved 2026-07-16.
- OpenBMB, [MiniCPM4 technical report](https://arxiv.org/abs/2506.07900), submitted 2025-06-09, retrieved 2026-07-16.
