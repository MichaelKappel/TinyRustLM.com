use serde::{Deserialize, Serialize};

/// Sole canonical metadata representation of one whole-member HTTP seed.
pub const DIRECT_COMPOSITION_SEED_SCHEMA: &str = "tinyrustlm.direct-composition-seed/1";

/// Path-free metadata whose canonical compact JSON plus LF identifies the piece set.
///
/// Each of the six whole members is one transfer unit in the current HTTP profile.
/// This descriptor's digest identifies those units; it does not establish qualification.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectCompositionSeedDescriptor {
    /// Exact seed descriptor schema.
    pub schema: String,
    /// Exact direct-composition HTTP profile.
    pub protocol: String,
    /// Exact ACG2 composition profile.
    pub composition_profile: String,
    /// SHA-256 identity of that profile.
    pub composition_profile_sha256: String,
    /// Exact ACG2 graph content ID.
    pub composition_id: String,
    /// Six whole-member identities in the fixed transport order.
    pub members: Vec<DirectCompositionSeedMember>,
}

/// One member identity in the canonical seed descriptor; no local path is serialized.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectCompositionSeedMember {
    /// Fixed member filename.
    pub name: String,
    /// Complete member length.
    pub bytes: u64,
    /// Lowercase SHA-256 digest without a content-ID prefix.
    pub sha256: String,
}
