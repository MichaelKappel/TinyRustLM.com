# TinyRustLM Hugging Face Supported Source Gate Memory - 2026-07-03

## Source

This pass follows the Hugging Face local download opt-in work and the user's requirement that Hugging Face rows must not imply fake runnable or fake conversion states.

## Memory

TinyRustLM now separates unmatched Hugging Face rows into source-backed and no-supported-source states. A row with at least one `.safetensors` sibling remains eligible for `Start Conversion`, because the generated local kit can use a reviewed local file or an explicit `TINYRUSTLM_ALLOW_HF_DOWNLOAD=1` direct Hugging Face download before Rust preflight/conversion.

A row without `.safetensors` metadata no longer shows `Start Conversion` in the simple beginner surface. It is labeled `No supported source listed`, explains that Rust conversion needs a reviewed `.safetensors` source before it can create `.slm` metadata for P2P reuse, and the advanced panel shows `Rust script unavailable until metadata lists a .safetensors source.` The model-card review path remains available.

The Hugging Face availability summary now distinguishes `model needs Rust conversion` from `model has no supported source listed`. This prevents the UI from treating arbitrary Hugging Face model cards, PyTorch `.bin`-only repositories, or incomplete metadata rows as if they already have a concrete TinyRustLM conversion path.

## Verification

`hf-search-ui` now intercepts three Hugging Face rows: one `.safetensors` source-backed row, one P2P-ready `.slm` metadata row, and one no-supported-source row. The smoke proves the source-backed row gets `Start Conversion`, the P2P-ready row gets `P2P Import`, the no-supported-source row gets no primary conversion action, and the summary reports all three states. `hf-conversion-kit-exec` still proves the source-backed row converts into a verified `.slm`, MiniModel manifest, 17 peer pieces, catalog snapshots, announcement feed, serve helper, and publish README.

## Boundary

This is a UI and handoff truthfulness gate. It does not add hosted model-byte service, browser Hugging Face `/resolve/` byte fetching, or project-server execution. Project servers remain metadata/docs only.
