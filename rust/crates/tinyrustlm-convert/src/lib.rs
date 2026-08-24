#![forbid(unsafe_code)]
#![doc = "Fail-closed source-family converters for the TinyRustLM SLM2 format."]

mod execution;
mod qwen3;
mod qwen3_composition;
mod qwen_tokenizer;
mod qwen_tokenizer2;

pub use execution::{ConverterExecutionIdentity, ConverterExecutionIdentityError};
pub use qwen3::{
    convert_locked_qwen3_source, Qwen3ConversionError, Qwen3ConversionResult,
    QWEN3_CONVERSION_PROFILE_ID, QWEN3_CONVERSION_PROFILE_SHA256, QWEN3_SOURCE_LOCK_SCHEMA,
};
pub use qwen3_composition::{
    convert_locked_qwen3_composition, CompositionArtifactIdentity, Qwen3CompositionConversionError,
    Qwen3CompositionConversionResult, QWEN3_COMPOSITION_CONVERSION_PROFILE_ID,
    QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256,
};
pub use qwen_tokenizer2::{
    convert_locked_qwen_tokenizer2_source, QwenTokenizer2ConversionError,
    QwenTokenizer2ConversionResult, QWEN_TOKENIZER2_CONVERSION_PROFILE_ID,
    QWEN_TOKENIZER2_CONVERSION_PROFILE_SHA256, QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA,
};
