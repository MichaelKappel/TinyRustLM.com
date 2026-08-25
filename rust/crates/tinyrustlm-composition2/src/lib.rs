#![deny(unsafe_code)]
#![doc = "Canonical ACG2 graph, bounded member resolution, and fail-atomic activation."]

mod activation;
mod format;
mod resolution;
#[cfg(target_arch = "wasm32")]
mod wasm;

pub use activation::{ActivationState, GenerationState, OperationIdentity, TranscriptState};
pub use format::{
    write_acg2, Acg2Error, Acg2Graph, Acg2Identity, Acg2Member, Acg2Policy, MemberRole,
    ACG2_FORMAT_PROFILE_ID, ACG2_FORMAT_PROFILE_SHA256,
};
pub use resolution::{
    prepare_composition, Acg2Read, MemberResolver, PreparedComposition, ResourcePlan,
    ResourcePreflight,
};
