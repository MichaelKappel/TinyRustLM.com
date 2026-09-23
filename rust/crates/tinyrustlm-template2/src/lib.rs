#![forbid(unsafe_code)]
#![doc = "Canonical Template2 artifact and bounded Qwen3 chat renderer."]

mod format;
mod runtime;

pub use format::{
    write_template, Template2Error, TemplateIdentity, QWEN3_TEMPLATE2_ARTIFACT_SHA256,
    TEMPLATE2_FORMAT_PROFILE_ID, TEMPLATE2_FORMAT_PROFILE_SHA256,
};
pub use runtime::{
    ControlInsertion, ControlKind, Message, RenderedPrompt, Role, Template2, Template2Policy,
    ThinkingMode,
};

/// Exact source file required when emitting the frozen Qwen3 Template2 artifact.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TemplateSourceFile {
    /// Required source-relative filename from the current profile.
    pub path: &'static str,
    /// Exact length of the original source bytes, before parsing or normalization.
    pub byte_length: u64,
    /// SHA-256 of those exact bytes.
    pub sha256: [u8; 32],
}

/// The complete tokenizer configuration also binds its embedded chat template.
pub const QWEN3_TEMPLATE2_TOKENIZER_CONFIG: TemplateSourceFile = TemplateSourceFile {
    path: "tokenizer_config.json",
    byte_length: 9_732,
    sha256: [
        0xd5, 0xd0, 0x9f, 0x07, 0xb4, 0x8c, 0x30, 0x86, 0xc5, 0x08, 0xb3, 0x0d, 0x1c, 0x91, 0x14,
        0xbd, 0x11, 0x89, 0x14, 0x5b, 0x74, 0xe9, 0x82, 0xa2, 0x65, 0x35, 0x0c, 0x92, 0x3a, 0xcd,
        0x81, 0x01,
    ],
};

/// Model configuration identity shared with the frozen artifact header.
pub const QWEN3_TEMPLATE2_MODEL_CONFIG: TemplateSourceFile = TemplateSourceFile {
    path: "config.json",
    byte_length: 726,
    sha256: format::SOURCE_MODEL_CONFIG_SHA256,
};
