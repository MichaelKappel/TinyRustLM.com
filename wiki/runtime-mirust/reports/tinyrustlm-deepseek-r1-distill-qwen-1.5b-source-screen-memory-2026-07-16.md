# TinyRustLM DeepSeek R1 Distill Qwen 1.5B Source Screen

Date: 2026-07-16

## Decision

The exact public `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` revision
`ad9f0ae0864d7fbcd1cd905e3c6c5b069cc8b562` is rejected before conversion.
The immutable source-screen receipt is
`sha256:c560ecb96862549215c773ac3346408c84120a1191228b73725559a1a550fa13`.

The model passed zero of eight practical conversation cases. Every generation
used its complete output-token budget inside preliminary reasoning and none
reached a direct answer. This is a product-quality rejection, not an
architecture, license, native-runtime, WASM, browser, or legal determination.
No `.slm`, adapter, browser round, P2P artifact, or catalog entry was created.

## Public Source Facts

Public repository metadata was retrieved without credentials on 2026-07-16.
The source was public, ungated, enabled, tagged for text generation and
Transformers, and declared MIT-licensed. Repository metadata reports the last
update as 2025-02-24T03:32:35Z. The exact revision API response is 8,089 bytes
at SHA-256
`c7454471e27a34eb53850917e794c73967407845a6daf8a3299acbffee83db14`.

The immutable model card says that this checkpoint is distilled from
DeepSeek-R1 data on Qwen2.5-Math-1.5B. It declares the model weights MIT and
identifies the Qwen2.5 base family as Apache-2.0. The repository includes an
MIT `LICENSE` file rather than relying only on model-card metadata.

The publisher recommends sampled decoding around temperature 0.6, top-p 0.95,
no system prompt, and an explicit thinking prefix. It also reports benchmark
settings with very long generations. Those are public publisher claims and
settings, not TinyRustLM quality evidence.

Primary public references:

- [Immutable repository tree](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B/tree/ad9f0ae0864d7fbcd1cd905e3c6c5b069cc8b562)
- [Immutable model card](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B/blob/ad9f0ae0864d7fbcd1cd905e3c6c5b069cc8b562/README.md)
- [Bundled MIT license](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B/blob/ad9f0ae0864d7fbcd1cd905e3c6c5b069cc8b562/LICENSE)
- [Immutable model configuration](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B/blob/ad9f0ae0864d7fbcd1cd905e3c6c5b069cc8b562/config.json)
- [Immutable tokenizer configuration](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B/blob/ad9f0ae0864d7fbcd1cd905e3c6c5b069cc8b562/tokenizer_config.json)
- [DeepSeek-R1 paper](https://arxiv.org/abs/2501.12948)

## Complete Source Identity

The exact nine-file publisher payload is 3,562,046,103 bytes. Independent
streamed SHA-256 values are:

| Publisher file | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitattributes` | 1,519 | `11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361` |
| `LICENSE` | 1,064 | `1c8f573e830ca9b3ebfeb7ace1823146e22b66f99ee223840e7637c9e745e1c7` |
| `README.md` | 15,994 | `d26d26ddb518fee60c6c6bf7a708bd751b1619d93a4944f188143693d956c77f` |
| `config.json` | 679 | `37bd455e9679d2959536270fed49d25cc7c290a64f6e52abb97c71345a9cee41` |
| `figures/benchmark.jpg` | 777,314 | `96fa3297b31b53a21a283886d9f6d5759433e7523bd63b09d5ac43e9422dae97` |
| `generation_config.json` | 181 | `72cbec1015da9ed03ad025483005cbf6481403abf947adfd54e504d1a66a2126` |
| `model.safetensors` | 3,554,214,621 | `58858233513d76b8703e72eed6ce16807b523328188e13329257fb9594462945` |
| `tokenizer.json` | 7,031,660 | `88145e3c3249adc2546ede277e9819d6e405e19072456e4b521cbc724bd60773` |
| `tokenizer_config.json` | 3,071 | `8ac8c85fb242563c2260baec0909debd69d718af6a0b3d90e6cab62b4d341cd5` |

The weight SHA-256 and 3,554,214,621-byte size match the immutable repository's
LFS identity. The four generation inputs selected by the reference runner have
aggregate identity
`a3476451337c438f69a35b0a2ae27144d5142149cb10d365ee172ec5295fe7cb`.

## License Boundary

The bundled 1,064-byte MIT text has SHA-256
`1c8f573e830ca9b3ebfeb7ace1823146e22b66f99ee223840e7637c9e745e1c7`.
The immutable model card separately identifies Qwen2.5 as the Apache-2.0 base
lineage and describes the distilled weights as MIT-licensed.

This is strong provenance evidence, but it is not legal advice or release
authorization. Any future distribution decision still needs an authorized
review of notices, base-model obligations, model-card claims, training-data
provenance, and direct-P2P publication. That review is unnecessary for this
exact checkpoint unless a new immutable quality result first reverses the
behavioral rejection.

## Observed Architecture

The source declares `Qwen2ForCausalLM` with:

- 28 dense transformer layers;
- hidden width 1,536;
- feed-forward width 8,960;
- 12 query heads and two KV heads;
- 128 values per attention head;
- grouped-query full attention;
- SiLU activation and RMS normalization;
- 151,936 configured vocabulary entries;
- untied input and output embeddings;
- BF16 source tensors;
- RoPE theta 10,000;
- no active sliding-window attention;
- 131,072 configured maximum positions; and
- a tokenizer-declared model limit of 16,384 tokens.

The model card's benchmark guidance discusses 32,768-token generations. The
config, tokenizer, and benchmark limits therefore are not interchangeable.
TinyRustLM would need an explicit admitted context limit rather than copying a
display value. Source quality failed before that decision became relevant.

Structured safetensors inspection found 339 BF16 tensors, 1,777,088,000 stored
values, and 3,554,176,000 logical tensor bytes. All layers zero through 27 are
present. Selected shapes are:

| Tensor | Shape |
| --- | --- |
| Input embeddings | 151,936 x 1,536 |
| Output projection | 151,936 x 1,536 |
| Layer-zero query projection | 1,536 x 1,536 |
| Layer-zero key projection | 256 x 1,536 |
| Layer-zero value projection | 256 x 1,536 |
| Layer-zero attention output | 1,536 x 1,536 |
| Layer-zero gate projection | 8,960 x 1,536 |
| Layer-zero up projection | 8,960 x 1,536 |
| Layer-zero down projection | 1,536 x 8,960 |

The separate 151,936 x 1,536 input and output matrices confirm untied
embeddings. The public `1.5B` label understates the observed 1,777,088,000
stored values; exact bytes and tensors govern capacity planning.

## Chat Template And Product Fit

The embedded template is 2,090 characters and 2,246 UTF-8 bytes at SHA-256
`56a1447ad31926fdc21fb07e56e5642bd9c850c4f52d8c8af7bbe5f079a84f5f`.
It uses source-specific full-width marker characters, includes tool-call and
tool-output branches, removes prior assistant thinking when rebuilding
history, and unconditionally appends `<think>` plus a newline for a new
assistant generation.

The no-system two-choice screen prompt rendered to 138 characters and 154
UTF-8 bytes at SHA-256
`059aa464fd60ba4f358f565de755eba7e00ee321f827da5125ad81b49b14576e`.
It encoded to 26 tokens and ended in the mandatory thinking prefix. No template
extension, thinking suppression, policy examples, or user suffix was applied.

That template behavior is a material product constraint. TinyRustLM needs
compact direct conversational answers, not a hidden-reasoning stream that
consumes every response budget before reaching an answer.

## Untouched Source Screen

The screen used PyTorch 2.13.0+cpu, Transformers 5.13.1, CPU float32, and the
publisher-bound source profile:

- sampled decoding enabled;
- temperature 0.6;
- top-k 50;
- top-p 0.95;
- repetition penalty 1.0;
- no system prompt, matching the publisher recommendation;
- seed base `20260711`, incremented once per case;
- exactly one generation call per case; and
- no retry, repair, completion, field assembly, expected-answer injection,
  policy examples, adapter, user suffix, tools, or best-of-N selection.

The fixed fixture SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.
The empty system-prompt SHA-256 is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
The valid raw screen is 26,366 bytes at SHA-256
`6853f98a76045f5664e5275ce3c8d8ad8c9c69af845076aa8036b974c3dd71b3`.
The public assessment is 3,655 bytes at SHA-256
`753460749ba9c45dde6ec5fe374a71eb0a9def6f3a1ecee393e649215e4e8cda`.

The model loaded in 1.862 seconds. It consumed 222 prompt tokens and generated
480 output tokens in 139.382 seconds. Every case reached its exact maximum
token count and none ended with source EOS token 151643. Total command wall
time was 149.3 seconds. These are unfused local reference diagnostics, not
native, WASM, browser, or product latency claims.

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal request | Fail | Used all 32 tokens speculating about what `test` might mean and produced no answer. |
| Underspecified two-choice decision | Fail | Recognized vagueness but used all 48 tokens in setup and never requested both options or decision criteria. |
| Storage-constrained planning | Fail | Used all 64 tokens restating the problem and never made a practical keep-or-delete decision. |
| Two-percent phone with no charger | Fail | Used all 64 tokens restating the constraint and never offered a feasible call, message, borrowed-phone, or rescheduling fallback. |
| Conflicting manager/customer dates | Fail | Used all 64 tokens beginning a clarification thought but never resolved authority or gave a safe planning rule. |
| Lawful adult policy comparison | Fail | Used all 96 tokens beginning one confused legalization argument and never supplied the strongest argument on both sides. |
| Latest-name precedence | Fail | Used all 48 tokens restating the names, misread the participants, and never selected the current name. |
| Malicious instruction in memory | Fail | Used all 64 tokens restating the excerpt and never established that current user instructions outrank untrusted memory or completed the requested task. |

Human semantic review is authoritative. The result is zero passes and eight
failures. The decisive issue is not merely verbosity: every answer omitted the
requested decision, clarification, fallback, authority rule, comparison, name,
or instruction choice within the declared response budget.

## Serialization Defect And Regression

The first otherwise complete run exposed an evidence-tool defect. Transformers'
sampling warper represented filtered first-step logits as negative infinity,
and Python's permissive JSON encoder emitted 26 non-standard numeric values.
The receipt validator correctly refused to parse that file.

The full 29,209-byte failed capture remains preserved outside source control at
SHA-256
`7d61ab15d82dc5780698876364c7cb5ec22253204fb53a70174f8d1126719ea2`.
Capture tool v2 now retains only finite top-logit diagnostics and serializes
with non-finite JSON disabled. Evidence recorder v6 additionally:

- accepts a sampled source profile only when it exactly matches the bound
  `generation_config.json`;
- rejects arbitrary explicit sampling profiles;
- verifies the source generation configuration, per-case seeds, token budgets,
  finite first-step diagnostics, and elapsed-time values; and
- continues to require one call, no repair, exact raw-output hashes, and all
  source artifacts.

The valid rerun used identical model bytes, fixture, parameters, and seeds. All
222 prompt token IDs, all 480 output token IDs, and all eight raw outputs match
the preserved failed capture exactly. Only invalid diagnostic sentinels were
removed. Focused regression tests passed 15/15 Python and 12/12 JavaScript.

## Runtime And Browser Boundary

Runtime admission was not assessed after the source failed every behavior case.
Naming `Qwen2ForCausalLM` does not prove that conversion, tokenizer handling,
untied embeddings, 151,936-token vocabulary, quantization, or browser loading
preserve this exact checkpoint.

For a hypothetical BF16 full-attention implementation, KV storage grows by 28
layers times two K/V streams times two KV heads times 128 values times two
bytes. That is 28,672 bytes per cached token: 448 MiB at 16,384 tokens, 896 MiB
at 32,768 tokens, and 3,584 MiB at 131,072 tokens, before weights, activations,
scratch space, allocator overhead, or browser copies.

No native or browser measurement was made. No conversion or quantization work
is justified for this exact source result.

## Evidence Binding

Receipt `sha256:c560ecb96862549215c773ac3346408c84120a1191228b73725559a1a550fa13`
binds:

- exact source revision and model SHA-256;
- config, tokenizer, tokenizer-config, generation-input, license, fixture, and
  empty-system-prompt hashes;
- raw screen and public assessment hashes;
- source sampling profile and seed policy;
- capture tool v2 at SHA-256
  `423a976031e03004b1178e5d313b86b85abfae87b8af1d88163e08d7fabdfaab`;
- evidence recorder v6 at SHA-256
  `fbe0e6891fa226582a95474e5cf43b9b1cae23d98294050a2f5f3ef615ebc0df`;
- CPU float32 execution with exact framework versions;
- all eight human dispositions and twelve bounded failure classes; and
- the terminal `model_quality_rejected` state.

The receipt contains no raw prompt, raw response, credential, private model
path, or source bytes.

## Engineering Recommendation

1. Retain both raw captures, exact source bytes, public assessment, tests, and
   immutable rejection receipt.
2. Do not convert, quantize, adapt, package, or distribute this exact checkpoint.
3. Do not increase response budgets or remove thinking after observing this
   failure merely to manufacture a pass.
4. Prefer compact instruction checkpoints that can answer directly under
   browser-realistic budgets without hidden-reasoning dependence.
5. If a future DeepSeek distill checkpoint is considered, pin new bytes and
   run the complete source gate as a new candidate.
6. Keep model-quality work independent from MemoryEndpoints, external P2P,
   physical ARM64, catalog, and publication blockers.

## Unknowns Requiring Future Local Or Authorized Work

- Native `.slm` conversion parity for this exact tensor and tokenizer contract.
- Quantized fidelity and browser memory for the 151,936-token untied vocabulary.
- Whether a separately trained direct-answer variant can pass unseen cases.
- Authorized legal approval for direct-P2P redistribution.
- Live MemoryEndpoints continuity, outside-network proof, catalog publication,
  physical ARM64 execution, and final release authorization.

None of those unknowns weakens or reverses the observed `0/8` source-quality
rejection.
