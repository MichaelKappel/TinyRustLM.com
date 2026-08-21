#![warn(unsafe_code)]
#![doc = "Bounded import-free WebAssembly boundary for Tokenizer2."]

mod boundary;
mod exports;

pub use exports::{
    ABI_VERSION, MAXIMUM_ARTIFACT_BYTES, MAXIMUM_DECODED_BYTES, MAXIMUM_INPUT_BYTES,
    MAXIMUM_OUTPUT_TOKENS, MAXIMUM_TRANSFER_BYTES,
};
