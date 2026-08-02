# TinyRustLM Self-Locating Conversion Kit Memory - 2026-07-02

TinyRustLM's Hugging Face `Start Conversion` handoff now saves a more runnable local PowerShell kit. The browser still treats Hugging Face rows as metadata-only model-card/source discovery and still does not fetch Hugging Face `/resolve/` model bytes. The generated `.tinyrustlm-convert.ps1` script now resolves:

- `TINYRUSTLM_WORKSPACE`
- `SLMCOMPOSER_WORKSPACE`
- `MINIMODEL_WORKSPACE`
- `TINYRUSTLM_SOURCE_SAFETENSORS`

When those environment variables are absent, the script checks nearby workspace paths and the local `E:/Source/Rust/SLMComposer.com` / `E:/Source/Rust/MiniModel.org` development paths. For source weights, the script accepts a reviewed `.safetensors` file placed beside the script or under `source/` using the Hugging Face metadata-suggested filename.

The script prints the resolved TinyRustLM workspace, MiniModel workspace, conversion request path, source `.safetensors` path, and output directory before it runs conversion. Missing paths fail with one explicit action-oriented error instead of making the user edit three placeholder assignments.

The local-only conversion boundary remains unchanged:

- project servers do not run model bytes
- project servers do not serve model bytes
- the browser does not download model weights
- Rust owns `convert-huggingface-request`
- MiniModel `prepare-peer-share` prepares checksum-bound peer metadata and local pieces
- `add-peer-source`, `write-peer-source-announcement`, `apply-peer-source-announcements`, and `write-catalog-snapshot-with-announcements` remain metadata-only publication paths

The `hf-search-ui` browser smoke now asserts the generated conversion script includes the self-location helper, environment-variable routes, source-file candidate logic, and resolved-path status output. It also rejects the old placeholder paths `EDIT_ME\model.safetensors`, `EDIT_ME\\SLMComposer.com`, and `EDIT_ME\\MiniModel.org` in generated conversion scripts.

Source files changed:

- `tinyrustlm/app/app.js`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/app/index.html`
- `tinyrustlm/index.html`
- `tinyrustlm/README.md`
- `tinyrustlm/docs/browser-runtime.md`

Synced public/developer surfaces:

- `E:\Source\Rust\TinyRustLM.com`
- `E:\Source\Rust\TinyRustLM.MiRust.com`

This is a workflow improvement, not completion of broad P2P discovery. Future work still needs a real peer-discovery layer or a local companion that can make conversion/import feel fully one-click without violating the no-project-server-model-byte boundary.
