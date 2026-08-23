#![forbid(unsafe_code)]
#![doc = "Canonical Prompt2 artifact, wire contracts, and exact prompt composition runtime."]

mod format;
mod runtime;
mod wire;

pub use format::{
    write_prompt2, Prompt2Artifact, Prompt2Error, Prompt2Identity, Prompt2Policy,
    PROMPT2_ARTIFACT_SHA256, PROMPT2_FORMAT_PROFILE_ID, PROMPT2_FORMAT_PROFILE_SHA256,
};
pub use runtime::{Prompt2Plan, Prompt2Runtime};
pub use wire::{
    parse_load_bundle, parse_request, parse_result, write_load_bundle, write_request, write_result,
    MappedControlInsertion, Prompt2InitialStatus, Prompt2LoadBundle, Prompt2Message,
    Prompt2Request, Prompt2Result,
};
