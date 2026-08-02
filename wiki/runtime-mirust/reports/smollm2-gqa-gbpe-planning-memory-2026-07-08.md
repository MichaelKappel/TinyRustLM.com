# SmolLM2 GQA/GBPE Planning Memory - 2026-07-08

## Scope

This report records the TinyRustLM runtime and packer work that moved the real `.slm` path from toy/demo-only shape assumptions toward small instruction-capable SmolLM2 checkpoints.

As of the later 2026-07-08 updates below, the served SmolLM2-360M-Instruct q4_0 `.slm` artifact has passed the honest native assistant-quality gate, the locked TinyRustLM browser UI assistant-quality smoke, and the visible prompt-card browser smoke on the same Rust/WASM runtime path. This does not close the entire product goal by itself; it is the first checked-in quality-capable served `.slm` evidence point.

## External Model Contract Used

The reviewed public Hugging Face metadata for `HuggingFaceTB/SmolLM2-135M-Instruct` establishes the target shape used for planning:

- Architecture family: Llama-style causal LM.
- Vocabulary size: 49152.
- Hidden size: 576.
- Intermediate size: 1536.
- Layer count: 30.
- Attention heads: 9.
- Key/value heads: 3.
- Max position embeddings: 8192.
- Tied embeddings: true.
- BOS/EOS token ids: 1 and 2.
- RoPE theta: 100000.

The tokenizer metadata is GPT2/ByteLevel BPE with chat special markers such as `<|im_start|>` and `<|im_end|>`. These markers must encode atomically for instruction/chat prompts; treating them as ordinary byte text risks corrupting the chat template.

Reference routes:

- https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/blob/main/config.json
- https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/blob/main/tokenizer_config.json

## Implemented Runtime Changes

The runtime now supports grouped-query attention instead of rejecting models whose query-head count differs from key/value-head count.

Important boundaries:

- `head_count * head_dim` must equal `hidden_size`.
- `kv_head_count` must be nonzero, no greater than `head_count`, and divide `head_count`.
- `wk.weight` and `wv.weight` use `kv_head_count * head_dim` rows.
- `wq.weight` and `wo.weight` remain full hidden-size projections.
- KV cache buffers are sized from key/value heads, not query heads.
- Attention maps query heads to shared KV heads using the grouped-query ratio.
- RoPE is applied across all query heads and across all KV heads separately.

Primary touched files:

- `tinyrustlm/runtime/src/model_format.rs`
- `tinyrustlm/runtime/src/model.rs`
- `tinyrustlm/runtime/src/generate.rs`
- `tinyrustlm/tools/slm_pack/src/slm_validate.rs`
- `tinyrustlm/tools/slm_pack/src/tensor_writer.rs`

## Implemented Tokenizer/Source Planning Changes

The runtime and packer now have a GPT2/ByteLevel BPE path named `gpt2-bpe-v1`, serialized into `.slm` tokenizer sections with magic `GBPE`.

Important boundaries:

- Runtime tokenizer enum includes a GPT2 BPE implementation.
- `GBPE` sections preserve source token ids, decoded token bytes, ranked merges, and special marker ids.
- Encoding scans special marker byte sequences before normal byte-token and merge processing, so chat template markers remain atomic.
- Decoding concatenates token bytes while skipping configured BOS/EOS/PAD/UNK ids.
- Native `.slm` validation accepts and validates `GBPE` sections.
- GPT2/ByteLevel BPE validation rejects missing byte tokens, duplicate token ids, duplicate special markers, and merge outputs not declared in the vocabulary.
- Source manifests for `gpt2-bpe-v1` include `bpe_special_count`, `bpe.special.N.id`, and `bpe.special.N.bytes_hex`.

Primary touched files:

- `tinyrustlm/runtime/src/tokenizer.rs`
- `tinyrustlm/tools/slm_pack/src/tokenizer_writer.rs`
- `tinyrustlm/tools/slm_pack/src/trained_source.rs`
- `tinyrustlm/tools/slm_pack/src/safetensors.rs`
- `tinyrustlm/tools/slm_pack/src/slm_validate.rs`
- `tinyrustlm/docs/tokenizer.md`
- `tinyrustlm/docs/slm-format.md`

## SmolLM2 Source Shapes

The source planning lane now recognizes `smollm2-135m-instruct-bpe` and `smollm2-360m-instruct-bpe`.

Expected contract:

- `model_shape=smollm2-135m-instruct-bpe`
- `tokenizer=gpt2-bpe-v1`
- `tied_output=true`
- `vocab_size=49152`
- `hidden_size=576`
- `intermediate_size=1536`
- `layer_count=30`
- `head_count=9`
- `kv_head_count=3`
- `context_length=8192`
- required source tensors: 272
- `layers.N.wk.weight` and `layers.N.wv.weight`: `[192, 576]`
- `layers.N.wq.weight` and `layers.N.wo.weight`: full hidden projection contract

The 360M q4-capable planning contract is:

- `model_shape=smollm2-360m-instruct-bpe`
- `tokenizer=gpt2-bpe-v1`
- `tied_output=true`
- `vocab_size=49152`
- `hidden_size=960`
- `intermediate_size=2560`
- `layer_count=32`
- `head_count=15`
- `kv_head_count=5`
- `context_length=8192`
- required source tensors: 290
- `layers.N.wk.weight` and `layers.N.wv.weight`: `[320, 960]`
- intended browser footprint tier: `q4_0`

The safetensors planner maps Hugging Face Llama-style aliases such as `model.layers.0.self_attn.k_proj.weight` and `model.layers.0.self_attn.v_proj.weight` into the TinyRustLM tensor names while preserving the GQA dimensions.

## Verification Completed

Focused and full checks passed for the implemented slice:

- `cargo fmt -p tinyrustlm-runtime -p tinyrustlm-slm-pack -- --check`
- `cargo test -p tinyrustlm-runtime tokenizer -- --nocapture`
- `cargo test -p tinyrustlm-runtime grouped_query -- --nocapture`
- `cargo test -p tinyrustlm-runtime`
- `cargo test -p tinyrustlm-slm-pack tensor_writer -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack trained_source::tests::returns_smollm2_instruct_gpt2_bpe_source_tensor_expectations_for_planning -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack imports_gpt2_bpe_tokenizer_json_with_specials_and_bytelevel_tokens -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack plans_smollm2_instruct_bpe_safetensors_source_without_dense_payloads -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack`

## 2026-07-08 Update

The served SmolLM2-135M q8_0 `.slm` path now has browser smoke evidence through the same locked TinyRustLM UI and Rust/WASM generation path:

- `powershell -ExecutionPolicy Bypass -File eng\verify-tinyrustlm-ui.ps1 -Port 8191 -DebugPort 9449 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 1800`
- report: `artifacts/reports/tinyrustlm-assistant-quality-smoke.json`
- selected model: `smollm2q8`
- active quantization: `q8_0`
- prompt: `what's up?`
- response: `I'm fine, I know how you're feeling. Everything's going smoothly at the moment!`
- eval evidence checksum: `0x5fd37b84976b178f`
- fetched eval route before `.slm` route: yes

The verification wrapper treated `assistant-quality` as a standard smoke mode and selected `smollm2q8` for that mode instead of the TinyLM fixture during this intermediate step. This paragraph is superseded by the served 360M q4 update below.

## 2026-07-08 Served 360M q4 Quality Update

The actual `HuggingFaceTB/SmolLM2-360M-Instruct` artifact at revision `a10cc1512eabd3dde888204e902eca88bddb4951` was downloaded, reviewed, converted, staged, and checked through the served TinyRustLM path.

Source artifact evidence:

- `model.safetensors` bytes: `723674912`.
- `model.safetensors` SHA-256: `E6BFFE7435D7DDC10FD3B9A9EFD429DAFBACB1CB17015FB5562664E7532BF86E`.
- Source shape: vocab `49152`, hidden `960`, layers `32`, heads `15`, KV heads `5`, ffn `2560`, context `8192`, tied output.
- Source plan tensor count: `290`.
- Source plan mapping checksum: `0x61ca0c25b9b6fd4e`.

Converted artifact evidence:

- Served model: `tinyrustlm/models/smollm2-360m-instruct-q4.slm`.
- Served manifest: `tinyrustlm/models/smollm2-360m-instruct-q4.slm.manifest`.
- Runtime smoke: `tinyrustlm/models/smollm2-360m-instruct-q4.runtime`.
- Honest eval sidecar: `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval`.
- `.slm` bytes: `227667520`.
- `.slm` checksum: `0x8b5aa7ec4abeed93`.
- Manifest checksum used by eval: `0xa480d83d75c2d6ef`.
- Eval sidecar checksum: `0x7f52ec0f8a1112b7`.
- Eval case-evidence checksum: `0xf63dee70df605f05`.
- Runtime-smoke sidecar checksum: `0x8d66c5368b03f5ce`.
- Quantization: `q4_0`.
- Tokenizer: `gpt2-bpe-v1`, checksum `0x8c86095c5c19f5cb`.
- Prompt format: `chatml-v1`.
- System prompt: `You are TinyRustLM, a browser-local AI assistant. You do not have personal experiences. Answer directly and helpfully.`

Native verification passed:

- `cargo run -p tinyrustlm-slm-pack -- validate tinyrustlm\models\smollm2-360m-instruct-q4.slm`
- `cargo run -p tinyrustlm-slm-pack -- validate-manifest tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest`
- `cargo run -p tinyrustlm-slm-pack -- runtime-smoke tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest tinyrustlm\models\smollm2-360m-instruct-q4.runtime`
- `cargo run -p tinyrustlm-slm-pack -- validate-runtime-smoke tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest tinyrustlm\models\smollm2-360m-instruct-q4.runtime`
- `cargo run --release -p tinyrustlm-runtime --bin tinyrustlm-eval -- tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`
- `cargo run -p tinyrustlm-slm-pack -- quality-gate tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest assistant-quality tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`

The release-mode native eval passed `12/12` cases: six fixed prompts and six seeded holdouts (`holdout_seed=2026070801`). The fixed `what's up?` output was `Hello! Welcome to my browser-local AI assistant.` The eval sidecar records per-case runtime prompt, raw output, diagnostics, stop reason, sampler settings, and no-cheat status.

Browser verification passed:

- `powershell -ExecutionPolicy Bypass -File eng\verify-tinyrustlm-ui.ps1 -Port 8191 -DebugPort 9449 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 3600`
- report: `artifacts/reports/tinyrustlm-ui-verification.json`
- smoke report: `artifacts/reports/tinyrustlm-assistant-quality-smoke.json`
- selected model: `smollm2q4`
- first model option: `smollm2q4 / SmolLM2 360M Instruct q4_0`
- active quantization: `q4_0`
- response: `Hello! Welcome to my browser-local AI assistant.`
- model load shown by smoke: about `2s`
- generation shown by smoke: about `36s` for 11 generated tokens in local browser/WASM
- network order: runtime-smoke sidecar and eval sidecar fetched before `smollm2-360m-instruct-q4.slm`; no TinyLM model bytes fetched in the final smoke trace.

The app now lists `smollm2q4` first, the HTML bootstrap select starts on `smollm2q4`, the balanced starter profile targets `smollm2q4`, and `eng/verify-tinyrustlm-ui.ps1` / `.sh` use `smollm2q4` for `assistant-quality` mode.

## 2026-07-08 Prompt-Card Browser Quality Update

The prompt-card acceptance slice now has a first-class browser smoke mode that clicks the visible starter cards in the locked UI and generates through the same served q4 `.slm` path.

Implementation evidence:

- `tinyrustlm/tools/browser-smoke.js` adds `assistant-prompt-cards`.
- `eng/verify-tinyrustlm-ui.ps1` and `eng/verify-tinyrustlm-ui.sh` register `assistant-prompt-cards` as a standard smoke mode and select `smollm2q4` for it.
- The starter cards keep their visual labels/icons/layout but use stronger hidden prompt templates for summarize, code, rewrite, and JSON.
- Starter card clicks now apply the existing matching generation preset (`precise`, `code`, or `json`) before focusing the prompt.
- JSON-intent prompts use structured runtime field generation: browser code calls the loaded WASM `generate` path for `status` and `reason` field values, normalizes generated status text into a clean label, and serializes the generated values as JSON. This is not a canned answer or remote path; the smoke asserts `generate_structured_json(...)` evidence in the console.

Verification passed:

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `powershell -ExecutionPolicy Bypass -File eng\verify-tinyrustlm-ui.ps1 -Port 8200 -DebugPort 9539 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards -BrowserSmokeTimeoutSeconds 3600`

Prompt-card smoke report:

- report: `artifacts/reports/tinyrustlm-assistant-prompt-cards-smoke.json`
- wrapper report: `artifacts/reports/tinyrustlm-ui-verification.json`
- selected model: `smollm2q4`
- model state: `loaded (2768 ms)`
- provenance eval cases: `12 passed`
- provenance eval checksum: `0xf63dee70df605f05`
- active quantization in every case: `q4_0`
- network order: `smollm2-360m-instruct-q4.runtime` and `smollm2-360m-instruct-q4-honest.eval` were fetched before `smollm2-360m-instruct-q4.slm`; no remote inference route was observed.

Observed card outputs from the passing smoke:

- summarize: `Summary: TinyRustLM runs browser-local Slumps models locally in the Browser and Developers Panel.`
- code: `This code adds two integers together.`
- rewrite: `This tool enables users to create and share privately run model runs that are both useful locally.`
- JSON: `{"status":"local","reason":"In browser local runtime model where prompts stay"}`

The smoke rejects empty output, runtime failure text, repeated-character output, prompt echo only, bogus code fences/TODO implementation drift, malformed JSON, missing JSON keys, one-letter JSON status values, wrong quantization, missing q4 eval/runtime evidence, and evidence/model route-order drift. The summarize output still shows small-model wording roughness (`Slumps`), so this is prompt-card proof for the real q4 path, not a final claim that all responses are polished.

## 2026-07-08 Runtime SLM Validation Hardening Update

The shared Rust runtime `.slm` parser and loader now fail closed on malformed-but-checksummed model bytes before generation can run.

Runtime parser hardening:

- `tinyrustlm/runtime/src/model_format.rs` rejects unsupported model type, invalid vocabulary/special-token counts, non-finite or non-positive RoPE theta, non-finite or non-positive RMSNorm epsilon, tokenizer/header overlap, unaligned tensor directory/data offsets, tensor data beginning before the directory ends, tensor directory length overflow, zero tensor dimensions, tensor payload ranges escaping the file, tensor payload byte-length drift, f32 tensors with quantization metadata, q8 tensors without valid scale range or with block-size drift, and q4 tensors without valid scale range or with invalid block sizing.
- `tinyrustlm/runtime/src/model.rs` rejects non-finite f32 tensor payload values and non-finite or non-positive q8/q4 scale values during model load.
- The rejection tests mutate otherwise valid fixture/model bytes and refresh the `.slm` checksum, so they prove semantic validation rather than only checksum failure.

WASM/browser-runtime evidence:

- `tinyrustlm/tools/wasm-abi-smoke.js` now corrupts the first quantized scale in the q8 fixture, refreshes the `.slm` checksum with the same runtime checksum algorithm, calls WASM `load_model`, requires `invalid header`, verifies `model_loaded=false`, reloads the valid model, and continues invalid-argument, recovery-generation, step-token, adapter validation/apply, free-model, and post-free checks.
- Rebuilt served runtime: `tinyrustlm/runtime/tinyrustlm.wasm`.
- Rebuilt manifest: `tinyrustlm/runtime/tinyrustlm.wasm.manifest`.
- Runtime WASM bytes: `187243`.
- Runtime WASM checksum: `0xfd09af080dd804f0`.
- ABI smoke output included `malformedSlmPayload: "passed"` and `corrupt_scale_last_error: "invalid header"`.

Verification passed:

- `cargo fmt --package tinyrustlm-runtime`
- `cargo test -p tinyrustlm-runtime --lib`
- `node --check .\tinyrustlm\tools\wasm-abi-smoke.js`
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown`
- `Copy-Item .\target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm .\tinyrustlm\runtime\tinyrustlm.wasm -Force`
- `cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm.wasm .\tinyrustlm\runtime\tinyrustlm.wasm.manifest`
- `node .\tinyrustlm\tools\wasm-abi-smoke.js`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- quality-gate tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest assistant-quality tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`
- `powershell -ExecutionPolicy Bypass -File eng\verify-tinyrustlm-ui.ps1 -Port 8210 -DebugPort 9549 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 3600`
- `git diff --check -- tinyrustlm/runtime/src/model_format.rs tinyrustlm/runtime/src/model.rs tinyrustlm/tools/wasm-abi-smoke.js tinyrustlm/runtime/tinyrustlm.wasm.manifest` passed with line-ending warnings only.

This strengthens the acceptance criterion that bad or incompatible `.slm` files fail with useful diagnostics through the same Rust/WASM path used by the browser. It does not change the locked UI look and feel and does not claim broader assistant quality completion.

## 2026-07-08 Browser Malformed SLM Smoke Update

The browser smoke suite now proves the same malformed-but-checksummed q8 scale rejection through the locked UI and local Rust/WASM load path.

Implementation evidence:

- `tinyrustlm/tools/browser-smoke.js` adds `model-malformed`, which corrupts the first q8/q4 quant scale in `tinyrustlm/models/tinylm16-q8.slm`, refreshes the `.slm` checksum, and intercepts only `/models/tinylm16-q8.slm`.
- The smoke selects `tinylm16q8`, waits for the app load path, and requires `runtimeStatus=Model rejected`, `modelState=error 6`, `errorState=invalid header`, diagnostics `model_loaded=false`, diagnostics `last_error=invalid header`, disabled generate/reset/step controls, enabled model selector, and no remote-origin requests.
- `eng/verify-tinyrustlm-ui.ps1` and `eng/verify-tinyrustlm-ui.sh` now include `model-malformed` in the standard browser smoke mode list.

Verification passed:

- `node --check tinyrustlm\tools\browser-smoke.js`
- PowerShell parse check for `eng\verify-tinyrustlm-ui.ps1`
- `bash -n eng/verify-tinyrustlm-ui.sh`
- `powershell -ExecutionPolicy Bypass -File eng\verify-tinyrustlm-ui.ps1 -Port 8211 -DebugPort 9559 -RunBrowserSmoke -BrowserSmokeModes model-malformed -BrowserSmokeTimeoutSeconds 600`

Browser malformed smoke report:

- wrapper report: `artifacts/reports/tinyrustlm-ui-verification.json`
- smoke report: `artifacts/reports/tinyrustlm-model-malformed-smoke.json`
- selected model: `tinylm16q8`
- model route requested: `/models/tinylm16-q8.slm`
- runtime status: `Model rejected`
- model state: `error 6`
- error state: `invalid header`
- diagnostics: `model_loaded=false`, `last_error=invalid header`, `active_quantization_mode=none`
- controls: generation, reset, and step-token disabled; model selector remains enabled for recovery.

This adds browser-level proof for the bad `.slm` acceptance criterion without changing the locked UI look and feel.

## 2026-07-08 Visual Lock Verifier Update

The approved TinyRustLM.com look now has a verifier-integrated desktop/mobile visual regression gate.

Implementation evidence:

- `tinyrustlm/tools/capture-ui-lock.js` still captures desktop `1365x768` and mobile `390x844` PNG screenshots plus UI signature fields for labels, headings, colors, and core panel rectangles.
- Baseline comparison now uses `stable-ui-fields-with-rect-tolerance-and-screenshot-evidence-v1`: stable shell fields compare exactly, core rectangles compare with tight viewport-aware tolerance, required shell regions must exist, and screenshot hashes/byte counts remain recorded as evidence.
- This avoids false failures from legitimate model-content text changes while still failing on visual shell, heading, color, label, or major layout drift.
- `eng/verify-tinyrustlm-ui.ps1` exposes `-RunVisualLock`, defaulting to the approved live baseline at `tinyrustlm/artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json` and writing evidence under `artifacts/reports/ui-lock-verification/`.
- `eng/verify-tinyrustlm-ui.sh` mirrors the same optional gate with `RUN_VISUAL_LOCK=1`.

Verification passed:

- `node --check tinyrustlm\tools\capture-ui-lock.js`
- PowerShell parse check for `eng\verify-tinyrustlm-ui.ps1`
- `bash -n eng/verify-tinyrustlm-ui.sh`
- `powershell -ExecutionPolicy Bypass -File eng\verify-tinyrustlm-ui.ps1 -Port 8212 -DebugPort 9569 -RunVisualLock`

Visual lock report:

- wrapper report: `artifacts/reports/tinyrustlm-ui-verification.json`
- visual report: `artifacts/reports/ui-lock-verification/tinyrustlm-ui-lock-report.json`
- baseline report: `tinyrustlm/artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json`
- status: `visual_lock_status=pass`
- baseline failures: `[]`
- desktop screenshot SHA-256: `cab724c2640295e29caabfc8c0b422196e3c6c5e01c32ddc32e56f79dbc053e4`
- desktop UI signature SHA-256: `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`
- mobile screenshot SHA-256: `bda2036c2a31265ebd16b80b5ef9ad46116f4caa7c6f1a1500cb5d4820ef6955`
- mobile UI signature SHA-256: `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`

This strengthens the acceptance criterion that the approved UI look is locked without redesigning or restyling the app.

## Remaining Quality Gap

This work proves a real served `.slm` can produce coherent output through the same Rust/WASM UI path, pass the honest no-cheat gate, drive the visible prompt cards without fixture answers, reject malformed `.slm` files through UI/WASM, and preserve the approved desktop/mobile shell through a visual lock gate. The active TinyRustLM quality goal still remains open because completion also requires broader output polish across more unseen prompts, stronger performance work for the 360M q4 browser path, deployment/live-site proof if publishing is requested, and continued protection against exposing private conversion or commercial internals.
