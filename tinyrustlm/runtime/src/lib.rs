//! TinyRustLM zero-dependency Rust runtime.
//!
//! The runtime is designed for browser-hosted WebAssembly without wasm-bindgen,
//! JavaScript frameworks, tokenizer crates, inference frameworks, or remote
//! APIs. Early milestones expose a strict memory boundary, byte tokenizer,
//! `.slm` parser, math kernels, diagnostics, and deterministic sampling.

/// Immutable active composition graph parsing and identity binding.
pub mod active_composition;
mod adapter;
mod artifact_digest;
/// Causal attention helpers.
pub mod attention;
/// Bounded local arithmetic evaluation for the calculator tool.
pub mod calculator;
/// Clean-slate typed identities for immutable models and specialist compositions.
pub mod content_identity;
/// Runtime diagnostics and benchmark counters.
pub mod diagnostics;
/// Error codes shared across Rust and the browser host.
pub mod errors;
/// Native evaluation runner for local model/case evidence.
pub mod eval_runner;
/// Feed-forward network helpers.
pub mod ffn;
/// Autoregressive generation state.
pub mod generate;
/// Key/value cache storage.
pub mod kv_cache;
/// WASM memory boundary helpers.
pub mod memory;
/// Loaded model metadata and tensor lookup.
pub mod model;
/// Custom `.slm` binary parser.
pub mod model_format;
/// Core math operations.
pub mod ops;
/// Quantization helpers.
pub mod quant;
/// Deterministic pseudo-random generator.
pub mod rng;
/// Rotary positional embedding helpers.
pub mod rope;
/// Sampling helpers.
pub mod sampler;
/// Immutable, base-bound specialist low-rank overlays.
pub mod specialist_overlay;
/// Tensor view types.
pub mod tensor;
/// Byte-level tokenizer.
pub mod tokenizer;
/// Exports consumed by the handwritten JavaScript bootstrap.
pub mod wasm_exports;

pub use errors::ErrorCode;
