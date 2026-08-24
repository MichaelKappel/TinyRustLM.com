#![deny(unsafe_code)]
#![deny(unsafe_op_in_unsafe_fn)]
#![doc = "Bounded native ABI for the canonical TinyRustLM runtime and direct transport."]

#[allow(unsafe_code)]
mod ffi;
mod files;
mod model;
mod response;
mod runtime;
mod transport;
