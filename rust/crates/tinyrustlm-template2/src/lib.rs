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
