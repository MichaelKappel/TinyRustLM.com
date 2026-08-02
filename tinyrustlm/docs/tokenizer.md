# Tokenizer

## Purpose

The tokenizer layer proves prompt transfer and generation plumbing without external tokenizer libraries. Phase one uses a fixed byte tokenizer. Phase two adds a small custom BPE tokenizer section that is parsed from `.slm` bytes and selected during model load. The real-checkpoint lane also supports a Llama-compatible byte-fallback BPE section that preserves source token ids.

## Constraints

No tokenizers crate, SentencePiece runtime, or external vocabulary files are used in the browser runtime. Tokenizer metadata must live inside the `.slm` tokenizer section and be validated before runtime use. The packer can consume reviewed local tokenizer JSON only as source evidence, then emits project-compatible BPE rows into the raw source manifest and final `BPE1` or `LBPE` section.

## Data Structures

`Tokenizer` is the runtime enum selected from the loaded model section. `ByteTokenizer` maps bytes `0..255` directly to token ids. `BOS = 256`, `EOS = 257`, `PAD = 258`, and `UNK = 259`.

`CustomBpeTokenizer` stores a token table and a ranked merge table. Encoding begins with byte fallback tokens, repeatedly applies the lowest-rank available adjacent merge, then wraps the result with BOS and EOS. Decoding uses byte fallback for ids `0..255` and token-table bytes for merged ids.

`LlamaBpeTokenizer` stores source-preserved special ids, byte-fallback base, learned token bytes, and ranked merge rows. It supports the Llama layout used by `Xenova/llama2.c-stories15M`: `<unk>=0`, `<s>=1`, `</s>=2`, byte fallback ids `3..258`, and learned tokens from `259`. Encoding applies Llama metaspace normalization, prefixes BOS, does not append prompt EOS, and uses tokenizer-specific EOS for generation stop handling.

## Binary Formats

The phase-one tokenizer section uses `BTOK` magic, version `1`, declared vocab size `260`, and the four special token ids.

The phase-two tokenizer section uses `BPE1` magic, version `1`, vocab size, four special token ids, token count, merge count, a variable token table, and fixed merge entries. Each token table entry stores `token_id`, byte length, and raw token bytes. Each merge entry stores `left`, `right`, `output`, and `rank`.

The Llama-compatible tokenizer section uses `LBPE` magic, version `1`, vocab size, four special token ids, token count, merge count, byte fallback base, the same variable token table shape, and the same fixed merge entry shape. `LBPE` token rows exclude specials and byte-fallback ids; those low ids are interpreted from the header instead of being remapped.

## Failure Cases

Decode rejects unknown ids outside the selected tokenizer vocabulary. Encode rejects impossible oversized prompts. BPE section parsing rejects short sections, unsupported versions, vocab/header drift, duplicate token ids, empty token bytes, out-of-vocabulary merge ids, merge outputs missing from the token table, and trailing bytes. `LBPE` validation also rejects specials inside the byte-fallback range and learned token rows that collide with specials or byte-fallback ids.

## Validation Rules

Legacy byte and `BPE1` encoding add BOS and EOS. `LBPE` encoding prefixes BOS but does not append EOS to prompt text, matching the reviewed Llama tokenizer post-processor. Decoding ignores BOS, EOS, and PAD, emits `?` for UNK, and validates the resulting bytes as UTF-8.

The native `.slm` admission validator accepts `BTOK`, `BPE1`, and `LBPE`. For BPE, the tokenizer vocab must match the model header, every token id must be unique and inside the vocabulary, and every merge output must reference a token table entry.

The trained-source validator accepts `tokenizer=bpe-v1` for legacy BPE source shapes, `tokenizer=llama-bpe-v1` for `stories15m-bpe`, and `tokenizer=gpt2-bpe-v1` for the reviewed SmolLM2 instruct shape. Source manifests must declare BPE token and merge counts, token ids, token bytes as hex, merge ids, and ranks; GPT2/ByteLevel BPE manifests also declare `bpe_special_count` plus `bpe.special.N.*` rows so chat markers such as `<|im_start|>` encode atomically. Conversion serializes that metadata into the `.slm` `BPE1`, `LBPE`, or `GBPE` section before native admission validation runs. BPE safetensors candidate review requires a checksum-matched compatible local tokenizer JSON artifact before making exact byte estimates, records tokenizer version, added-token count, normalizer/pre-tokenizer/decoder/post-processor summaries, and `source_tokenizer_import_*` status/count/checksum rows for the manifest-ready rows; review-bound extraction rechecks those rows before carrying them into the source manifest.

## Current Runtime Proof

The checked-in `tiny-test-model-bpe.slm` fixture uses the `BPE1` section with a two-step merge table: `t` + `h` becomes token `260`, then token `260` + `e` becomes token `261`. Runtime generation for prompt `the` records tokenizer output `256,261`, proving the loaded `.slm` selected the custom BPE path and merged the body token before generation. The runtime also validates `LBPE` Llama byte-fallback tokenization and `GBPE` GPT2/ByteLevel tokenization, including atomic chat-template specials. The trained-source tests generate and convert a `tiny-fixture-bpe` source bundle into a q8_0 `.slm`, proving source tokenizer metadata survives conversion into the binary artifact. Safetensors review tests now use local BPE tokenizer JSON fixtures and prove the review's exact q8_0 byte estimate matches converted `.slm` bytes after extraction writes those reviewed tokenizer rows. The source-planning lane includes `tinylm16-bpe`, `stories15m-bpe`, and `smollm2-135m-instruct-bpe`; SmolLM2 planning uses `gpt2-bpe-v1`, tied output, and grouped-query K/V tensor shapes. The real `Xenova/llama2.c-stories15M` tensor plan, reviewed tokenizer import, q8 conversion, `.slm` validation, and runtime eval execution now run through the local Rust path; the honest assistant eval still fails because the checkpoint is a raw Stories completion model, not an instruction/chat assistant.

## Future Expansion Path

Current BPE support is end-to-end for a deterministic tiny fixture, a converted source fixture, review-bound import of project-compatible local BPE tokenizer JSON, TinyLM-16M BPE source-planning expectations, and the first Llama-compatible Stories-15M q8 conversion. The review artifact preserves tokenizer pipeline-shape evidence plus a checksum over the imported manifest rows. Future expansion should add more tokenizer families only as separate validated section kinds; do not remap trained tensor rows or use browser-side response templates to hide tokenizer mismatch.
