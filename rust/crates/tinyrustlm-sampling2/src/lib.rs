#![forbid(unsafe_code)]
#![doc = "Canonical Sampling2 artifact, deterministic sampler, and bounded generation controller."]

mod format;
mod runtime;

pub use format::{
    write_sampling2, Sampling2Error, SamplingIdentity, SAMPLING2_ARTIFACT_SHA256,
    SAMPLING2_FORMAT_PROFILE_ID, SAMPLING2_FORMAT_PROFILE_SHA256, SAMPLING2_WEIGHT_TABLE_SHA256,
};
pub use runtime::{
    fixed_score_from_bits, GenerationController, GenerationStatus, GenerationStep, SampledToken,
    Sampling2, Sampling2Config, Sampling2Policy, Sampling2State,
};
