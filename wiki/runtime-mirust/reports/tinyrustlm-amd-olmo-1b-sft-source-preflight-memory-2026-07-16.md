# TinyRustLM AMD-OLMo 1B SFT Source Preflight Memory

Date: 2026-07-16

## Decision

Exact source `amd/AMD-OLMo-1B-SFT` revision
`228e18a8172beabcce6a0e686ac084cede5820fc` is terminally rejected before
weight acquisition. The repository is public, ungated, and natively recognized
by Transformers 5.13.1, but it does not publish a complete executable
conversation contract. The tokenizer has no embedded `chat_template`, the
repository has no `chat_template.jinja`, and the model card specifies only a
single-turn string. Extending that example into system-role and multi-turn
serialization would invent source behavior.

The source also contains a direct tokenizer/template conflict. The model card
sets `bos = tokenizer.eos_token`, but the pinned tokenizer maps EOS to the PII
placeholder `|||IP_ADDRESS|||` at token ID 50279. It maps
`<|endoftext|>` to ID 0, and the documented `<|user|>` and
`<|assistant|>` strings are ordinary multi-token text rather than registered
special tokens. TinyRustLM must not silently choose which publisher artifact
is authoritative.

Receipt
`sha256:59ed6823274b16068057cdc21da110777cb92a0aac54e58978106f8cd73639f4`
records the current rejection. Earlier receipt
`sha256:70f3e54f5dd7b8407586dff43c6a1c14049cd3beb8b16f3d4776b8eed0781c01`
is retained as immutable superseded history from before the tokenizer conflict
was added to the assessment.

## Public Source Identity

The Hugging Face model API was observed on 2026-07-16 and returned:

- model ID `amd/AMD-OLMo-1B-SFT`;
- immutable revision `228e18a8172beabcce6a0e686ac084cede5820fc`;
- public, ungated, enabled access;
- `transformers` and `text-generation` metadata;
- Apache-2.0 metadata declaration; and
- one direct `model.safetensors` object of 4,707,070,632 bytes.

No model weight was downloaded. Metadata-only evidence is retained outside the
Git repository under the private source-review root. The preflight receipt
binds the exact public artifacts without publishing private local paths.

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `config.json` | 609 | `95153241d18c58f712a0e12d41014a82d30c694c0472cfa7d6e72d8a8acc4d55` |
| `generation_config.json` | 115 | `e9a6fc6755330e6da09ba04b1137c4db0744faafc0fa609ff378fd6989518295` |
| model card | 17,201 | `2357d920cd33ee59faae782e47a53c03553f3f5dd31d6a8a6ce5691027c2063a` |
| repository API response | 2,208 | `648717aa9b52bb87e57a402f787eaaa25875a860537d2754393786b73d4dce2d` |
| `tokenizer_config.json` | 5,374 | `20899789303ffebe50f26c91b5ad426c3910346476dce36682c1c4b949d65380` |
| Apache-2.0 authority text | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

The exact model repository does not bundle a `LICENSE` file. Its model card
declares Apache-2.0, and the assessment binds the Apache Software Foundation's
license text as external authority. Distribution eligibility still requires
authorized review; this report is not legal advice.

## Architecture Facts

The pinned configuration declares a dense OLMo decoder with:

- 16 layers;
- hidden size 2,048;
- intermediate size 8,192;
- 16 query heads and 16 KV heads;
- full multi-head attention rather than GQA;
- maximum position count 2,048;
- vocabulary matrix size 50,304;
- tied input/output embeddings;
- no attention projection biases; and
- source dtype `float32`.

Transformers 5.13.1 resolves the source without remote code to
`transformers.models.olmo.modeling_olmo.OlmoForCausalLM`. A metadata-only
`meta` instantiation contains exactly 1,176,764,416 unique parameters:

```text
embedding = 50,304 * 2,048 = 103,022,592
attention/layer = 4 * 2,048 * 2,048 = 16,777,216
MLP/layer = 3 * 2,048 * 8,192 = 50,331,648
total = 103,022,592 + 16 * (16,777,216 + 50,331,648)
      = 1,176,764,416
```

At float32, the public weight object's size is consistent with those unique
values plus a bounded safetensors header. Full attention would add
`2 * 16 layers * 16 KV heads * 128 head dimension * bytes_per_element` per
cached token. These are source/configuration facts, not TinyRustLM runtime or
browser measurements.

## Conversation Contract Failure

The pinned tokenizer resolves natively as `GPTNeoXTokenizer`, with tokenizer
vocabulary 50,254 and effective length 50,280. Direct local checks observed:

| Check | Observation |
| --- | --- |
| Embedded chat template | `null` |
| `chat_template.jinja` in repository | absent |
| user-only `apply_chat_template` | rejected by Transformers |
| system plus user `apply_chat_template` | rejected by Transformers |
| two-turn `apply_chat_template` | rejected by Transformers |
| EOS | ID 50279, `|||IP_ADDRESS|||` |
| `<|endoftext|>` | ID 0 |
| `<|user|>` | ordinary token sequence `[29, 93, 4537, 49651]` |
| `<|assistant|>` | ordinary token sequence `[29, 93, 515, 5567, 49651]` |

The model card's sole usage example constructs:

```text
tokenizer.eos_token + "<|user|>\n" + prompt + "\n<|assistant|>\n"
```

It does not specify how to serialize a system role, close an assistant turn,
append another user turn, distinguish EOS from the leading marker, or resolve
the PII-placeholder mismatch. Publisher benchmark claims, including MT-Bench,
do not supply those missing bytes. A TinyRustLM-created Jinja template would
therefore adapt the source before the untouched source screen and invalidate
the no-cheat gate.

## Preflight Enforcement

`source-model-preflight-evidence.js` tool version 2 adds the generic blocker
`candidate_source_conversation_contract_rejected`. That blocker is accepted
only when evidence binds the model card, repository tree, tokenizer config,
the absent `chat_template.jinja`, and all three base rejection codes:

- `publisher-chat-template-absent`;
- `publisher-multi-turn-serialization-absent`; and
- `source-screen-conversation-contract-incomplete`.

This source additionally records
`publisher-tokenizer-template-contract-conflict`. Focused TDD first proved the
old recorder incorrectly accepted a conversation-contract claim without naming
the missing template, then proved the corrected fail-closed rule.

## Consequences

- Do not acquire the 4.7 GB source weight.
- Do not run or claim an untouched quality screen.
- Do not convert, quantize, adapt, package, catalog, or distribute this source.
- Do not add OLMo runtime behavior, template shims, or compatibility code for
  this rejected checkpoint.
- Do not count the model as one of the 20 required artifacts.
- Do not infer that the DPO sibling is valid; it requires its own immutable
  preflight and has the same repository-level template risk until proven
  otherwise.

Reconsider only if AMD publishes an immutable source revision containing an
executable system and multi-turn template, consistent special-token semantics,
and clear stop-token behavior. That new revision must receive a fresh
metadata-only preflight and untouched raw source screen. It must not supersede
or overwrite this rejection.

## Truth Boundary

This evidence proves a local metadata-only preflight, exact public source
identity, native configuration/tokenizer loading, architecture arithmetic,
and a publisher conversation-contract inconsistency. It does not inspect model
weights, execute generation, judge response quality, prove `.slm`
compatibility, measure native/WASM/browser performance, authorize licensing or
redistribution, validate MemoryEndpoints accounts, prove P2P reachability, or
grant release authority.

## Primary Sources

Retrieved 2026-07-16:

- [Pinned AMD-OLMo 1B SFT repository](https://huggingface.co/amd/AMD-OLMo-1B-SFT/tree/228e18a8172beabcce6a0e686ac084cede5820fc)
- [Pinned model card](https://huggingface.co/amd/AMD-OLMo-1B-SFT/blob/228e18a8172beabcce6a0e686ac084cede5820fc/README.md)
- [Pinned configuration](https://huggingface.co/amd/AMD-OLMo-1B-SFT/blob/228e18a8172beabcce6a0e686ac084cede5820fc/config.json)
- [Pinned tokenizer configuration](https://huggingface.co/amd/AMD-OLMo-1B-SFT/blob/228e18a8172beabcce6a0e686ac084cede5820fc/tokenizer_config.json)
- [AMD technical article](https://www.amd.com/en/developer/resources/technical-articles/introducing-the-first-amd-1b-language-model.html)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)
- [Transformers OLMo implementation at v5.13.1](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/olmo/modeling_olmo.py)
