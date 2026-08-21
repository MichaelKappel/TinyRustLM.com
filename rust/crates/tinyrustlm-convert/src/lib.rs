#![forbid(unsafe_code)]
#![doc = "Fail-closed source-family converters for the TinyRustLM SLM2 format."]

mod qwen2;

pub use qwen2::{
    convert_locked_qwen2_source, ConverterExecutionIdentity, Qwen2ConversionError,
    Qwen2ConversionResult, QWEN2_CONVERSION_PROFILE_ID, QWEN2_CONVERSION_PROFILE_SHA256,
    QWEN2_SOURCE_LOCK_SCHEMA,
};
