# TinyRustLM OpenELM 1.1B Instruct Source Preflight Memory

Date: 2026-07-16

## Decision

Exact source `apple/OpenELM-1_1B-Instruct` revision
`effd796da2a77361d7360e45e54c7cc14bc5df2a` is terminally rejected before
weight acquisition. The repository is public and ungated, but the pinned
configuration delegates both `AutoConfig` and `AutoModelForCausalLM` to
publisher Python. The pinned Transformers 5.13.1 auto-configuration and
causal-language-model registries contain no native `openelm` mapping. Running
the publisher path would require `trust_remote_code=True`, which is forbidden
for the untouched source screen.

The same revision is not a self-contained conversational source. It publishes
no tokenizer files and no chat template. Apple's generation script defaults
to `meta-llama/Llama-2-7b-hf`, and the model card's evaluation commands name
that external tokenizer while enabling remote code. TinyRustLM must not invent
a tokenizer, template, role grammar, or stop contract to make the source
runnable.

## Public Source Identity

The pinned Hugging Face API response was observed on 2026-07-16 and returned:

- model ID `apple/OpenELM-1_1B-Instruct`;
- immutable revision `effd796da2a77361d7360e45e54c7cc14bc5df2a`;
- public, ungated, enabled access;
- `transformers`, `text-generation`, and `custom_code` metadata;
- bundled Apple Machine Learning Research Model License metadata; and
- one `model.safetensors` object of 2,159,808,696 bytes with published LFS
  SHA-256 `9b2de324cd4a3c6a4d08d8b105d3145ef1cffdee7a4d669cae31d9bcb5c1197d`.

No model weight was downloaded. A range request read only the eight-byte
safetensors prefix and its 25,776-byte JSON header. Bounded metadata evidence
is retained outside Git. The public receipt binds hashes and primary URLs but
does not publish private local paths.

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `config.json` | 1,604 | `df957dc69695d5fbe5d94b21d7ec148f093c626c5ebac330a0bccbec043a581c` |
| publisher configuration | 14,264 | `d0da88fc5fafdfef155052ec4e5483db8d6be2917cb68bdee9e7ead1cb7e6f15` |
| publisher generation script | 7,453 | `9755dcadaa553348fc43f416277f6ca2c69b1ced4267f2dd0b1aaaa725e49c10` |
| bundled license | 5,820 | `d8f5d9dfbdb60dc81b8f1720421699e7811070f0b46f6668f90253d5ac8c0b20` |
| model card | 12,789 | `2ef16d4fa6aab3515f10b74260552fbf76e04ae6952293d7297684c0f7975731` |
| publisher modeling code | 39,348 | `ffb56f297ccb48ba689bc15b352c971eb1337a3604449662303a2d4919aa77c4` |
| pinned repository API response | 2,289 | `bb29173fff9c0499a70697c6550874204b31bbb0f5347d8391303266534a6fa3` |
| bounded safetensors header | 39,238 | `487fe35bb0064467efbee5de9a054955534e6232a108c810258835af25ac49c7` |
| Transformers 5.13.1 config registry | 19,425 | `c1ff7fc0cb204cfdbe837993b7bba85aadec28254852c55fe32be997bdf1411a` |
| Transformers 5.13.1 model registry | 108,841 | `43707fe59131464f37fe7616ce3948484be7bc7ec9cda76558071d76e0a3e226` |

## Architecture Facts

The pinned configuration and bounded header describe an OpenELM decoder with:

- 28 transformer layers and model dimension 2,048;
- a 32,000-token vocabulary and tied input/output embeddings;
- layer-wise query-head counts from 16 through 32;
- layer-wise KV-head counts from 4 through 8, with four GQA groups;
- head dimension 64, Q/K normalization, RoPE, RMS normalization, Swish, and a
  gated feed-forward network;
- declared maximum context 2,048 and RoPE maximum length 4,096; and
- 226 BF16 tensors containing 1,079,891,456 values.

The 169 KV heads summed across all layers imply a BF16 cache cost of
`2 * 169 * 64 * 2 = 43,264` bytes per cached token, or 84.5 MiB at 2,048
tokens. This is architecture arithmetic, not a TinyRustLM runtime or browser
measurement.

## Loader Contract Failure

The exact `config.json` contains:

```json
{
  "architectures": ["OpenELMForCausalLM"],
  "auto_map": {
    "AutoConfig": "configuration_openelm.OpenELMConfig",
    "AutoModelForCausalLM": "modeling_openelm.OpenELMForCausalLM"
  },
  "model_type": "openelm"
}
```

Neither pinned Transformers 5.13.1 registry contains `openelm`. Apple's model
card and generation script use `trust_remote_code=True`. The preflight copied
and hashed those Python files as inert text; it did not import or execute them.
Allowing repository code during source selection would make public source
review an arbitrary-code execution boundary and would prevent a deterministic
native loader contract.

## Tokenizer And Conversation Failure

The immutable repository contains only nine files: Git attributes, license,
model card, model configuration, two publisher implementation modules, a
generation script, generation configuration, and the weight. It contains no
`tokenizer.json`, tokenizer model, tokenizer configuration, special-token map,
or `chat_template.jinja`.

The official generation script defaults to the external
`meta-llama/Llama-2-7b-hf` tokenizer. The model card repeats that tokenizer for
evaluation and specifies no executable system-role or multi-turn
serialization. Even if remote execution were allowed, the exact OpenELM
revision alone cannot deterministically produce the bytes needed for an
untouched TinyRustLM conversation screen.

## License Boundary

The repository bundles the Apple Machine Learning Research Model License and
labels the model `apple-amlr`. This preflight proves only that the license text
was present and hashed. It does not authorize TinyRustLM P2P redistribution,
derivatives, catalog publication, or a product release. Authorized license and
distribution review was intentionally not performed after the earlier loader
gate failed. This report is not legal advice.

## Fail-Closed Enforcement

`source-model-preflight-evidence.js` tool version 3 adds a generic invariant
for `candidate_source_loader_contract_rejected`. A receipt can use that blocker
only when it:

- records `custom-publisher-code-required`,
  `native-transformers-architecture-absent`, and
  `source-screen-loader-contract-incompatible`;
- names the unacquired `model.safetensors`; and
- binds config, publisher configuration, publisher modeling, repository-tree,
  and pinned Transformers auto-configuration registry evidence.

Focused TDD first demonstrated that the prior recorder accepted a loader claim
without those artifacts. The new negative and positive tests now pass.

## Consequences

- Do not acquire the 2.16 GB weight or the external Llama tokenizer.
- Do not execute publisher code or accept access terms for an external source.
- Do not run or claim an untouched quality screen.
- Do not add OpenELM runtime code, tokenizer shims, or invented templates.
- Do not convert, quantize, adapt, package, catalog, or distribute this source.
- Do not count it as one of the 20 required qualifying artifacts.

Reconsider only a new immutable revision that is self-contained, has a native
approved loader, publishes tokenizer and multi-turn chat serialization, and
passes a fresh metadata preflight. New evidence must not overwrite this
rejection.

## Truth Boundary

This evidence proves exact public identity, bounded metadata inspection,
absence from two pinned native registries, architecture arithmetic, and a
terminal engineering preflight decision. It does not execute source code,
inspect full weights, generate text, judge model quality, prove `.slm`
compatibility, measure native/WASM/browser performance, authorize licensing or
redistribution, validate MemoryEndpoints accounts, prove P2P reachability, or
grant release authority.

## Primary Sources

Retrieved 2026-07-16:

- [Pinned OpenELM repository](https://huggingface.co/apple/OpenELM-1_1B-Instruct/tree/effd796da2a77361d7360e45e54c7cc14bc5df2a)
- [Pinned model card](https://huggingface.co/apple/OpenELM-1_1B-Instruct/blob/effd796da2a77361d7360e45e54c7cc14bc5df2a/README.md)
- [Pinned configuration](https://huggingface.co/apple/OpenELM-1_1B-Instruct/blob/effd796da2a77361d7360e45e54c7cc14bc5df2a/config.json)
- [Pinned publisher configuration](https://huggingface.co/apple/OpenELM-1_1B-Instruct/blob/effd796da2a77361d7360e45e54c7cc14bc5df2a/configuration_openelm.py)
- [Pinned generation script](https://huggingface.co/apple/OpenELM-1_1B-Instruct/blob/effd796da2a77361d7360e45e54c7cc14bc5df2a/generate_openelm.py)
- [Pinned publisher modeling](https://huggingface.co/apple/OpenELM-1_1B-Instruct/blob/effd796da2a77361d7360e45e54c7cc14bc5df2a/modeling_openelm.py)
- [Pinned Apple license](https://huggingface.co/apple/OpenELM-1_1B-Instruct/blob/effd796da2a77361d7360e45e54c7cc14bc5df2a/LICENSE)
- [Transformers 5.13.1 auto-configuration registry](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/auto/configuration_auto.py)
- [Transformers 5.13.1 causal-model registry](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/auto/modeling_auto.py)
- [Apple OpenELM research page](https://machinelearning.apple.com/research/openelm)
- [OpenELM paper](https://arxiv.org/abs/2404.14619)
