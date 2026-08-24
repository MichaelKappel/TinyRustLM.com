use std::io::{Read, Seek, SeekFrom};

use sha2::{Digest, Sha256};
use tinyrustlm_prompt2::{
    Prompt2Artifact, Prompt2Runtime, PROMPT2_ARTIFACT_SHA256, PROMPT2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_sampling2::{SAMPLING2_ARTIFACT_SHA256, SAMPLING2_FORMAT_PROFILE_SHA256};
use tinyrustlm_slm2::{
    validate_model, ModelSpec, ValidatedModel, ValidationPolicy, SLM2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_template2::{QWEN3_TEMPLATE2_ARTIFACT_SHA256, TEMPLATE2_FORMAT_PROFILE_SHA256};
use tinyrustlm_tokenizer2::{
    QWEN3_TOKENIZER2_ARTIFACT_BYTES, QWEN3_TOKENIZER2_ARTIFACT_SHA256,
    TOKENIZER2_FORMAT_PROFILE_SHA256,
};

use crate::format::{
    Acg2Error, Acg2Graph, Acg2Identity, Acg2Member, MemberRole, STREAM_HASH_BUFFER_BYTES,
};

/// One owned random-access member source.
pub trait Acg2Read: Read + Seek {}

impl<T: Read + Seek> Acg2Read for T {}

/// Resolves exact graph identities without taking path, URL, or alias authority.
pub trait MemberResolver {
    /// Opens one source for the exact role and immutable identity.
    ///
    /// The implementation must not return until it owns the source. ACG2 drops
    /// it before requesting the next member, so only one source is open at once.
    fn open(&mut self, role: MemberRole, identity: Acg2Member) -> Option<Box<dyn Acg2Read>>;
}

/// Complete bounded resource plan accepted before activation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ResourcePlan {
    graph_identity: Acg2Identity,
    resolved_member_bytes: u64,
    model_artifact_bytes: u64,
    resident_dependency_artifact_bytes: u64,
    model_tensor_count: u32,
    stream_hash_buffer_bytes: u64,
}

impl ResourcePlan {
    /// Returns all exact graph identities.
    pub const fn graph_identity(self) -> Acg2Identity {
        self.graph_identity
    }

    /// Returns the checked sum of all graph member lengths.
    pub const fn resolved_member_bytes(self) -> u64 {
        self.resolved_member_bytes
    }

    /// Returns the streamed model artifact length.
    pub const fn model_artifact_bytes(self) -> u64 {
        self.model_artifact_bytes
    }

    /// Returns the exact total artifact bytes retained for non-model runtimes.
    pub const fn resident_dependency_artifact_bytes(self) -> u64 {
        self.resident_dependency_artifact_bytes
    }

    /// Returns the validated SLM2 tensor count.
    pub const fn model_tensor_count(self) -> u32 {
        self.model_tensor_count
    }

    /// Returns the sole fixed streaming hash buffer size.
    pub const fn stream_hash_buffer_bytes(self) -> u64 {
        self.stream_hash_buffer_bytes
    }
}

/// Accepts or rejects the complete candidate resource plan before mutation.
pub trait ResourcePreflight {
    /// Returns true only when the complete plan can be activated.
    fn accept(&mut self, plan: ResourcePlan) -> bool;
}

struct ValidatedRuntime {
    model: ValidatedModel,
    prompt: Prompt2Runtime,
}

/// Fully resolved, parsed, dependency-closed, and preflight-accepted candidate.
pub struct PreparedComposition {
    pub(crate) graph: Acg2Graph,
    pub(crate) resource_plan: ResourcePlan,
    runtime: Option<Box<ValidatedRuntime>>,
}

impl PreparedComposition {
    /// Returns the immutable validated graph.
    pub const fn graph(&self) -> Acg2Graph {
        self.graph
    }

    /// Returns the accepted complete resource plan.
    pub const fn resource_plan(&self) -> ResourcePlan {
        self.resource_plan
    }

    /// Returns validated SLM2 metadata for the inactive candidate.
    pub fn model(&self) -> &ValidatedModel {
        &self
            .runtime
            .as_ref()
            .expect("production candidate always has a validated runtime")
            .model
    }

    /// Returns the dependency-closed Prompt2 runtime for the inactive candidate.
    pub fn prompt(&self) -> &Prompt2Runtime {
        &self
            .runtime
            .as_ref()
            .expect("production candidate always has a validated runtime")
            .prompt
    }

    #[cfg(test)]
    pub(crate) fn fixture(graph: Acg2Graph) -> Self {
        Self {
            resource_plan: ResourcePlan {
                graph_identity: graph.identity(),
                resolved_member_bytes: graph.resolved_member_bytes(),
                model_artifact_bytes: graph.member(MemberRole::Model).artifact_bytes(),
                resident_dependency_artifact_bytes: graph
                    .resolved_member_bytes()
                    .saturating_sub(graph.member(MemberRole::Model).artifact_bytes()),
                model_tensor_count: 1,
                stream_hash_buffer_bytes: STREAM_HASH_BUFFER_BYTES as u64,
            },
            graph,
            runtime: None,
        }
    }
}

impl std::fmt::Debug for PreparedComposition {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("PreparedComposition")
            .field("graph", &self.graph)
            .field("resource_plan", &self.resource_plan)
            .finish_non_exhaustive()
    }
}

/// Resolves, streams, parses, cross-checks, and preflights one inactive graph.
pub fn prepare_composition<R, P>(
    graph: Acg2Graph,
    resolver: &mut R,
    preflight: &mut P,
) -> Result<PreparedComposition, Acg2Error>
where
    R: MemberResolver,
    P: ResourcePreflight,
{
    validate_owner_profiles()?;
    let mut model = None;
    let mut tokenizer = None;
    let mut template = None;
    let mut sampling = None;
    let mut prompt = None;

    for member in graph.members() {
        let mut source = resolver
            .open(member.role(), member)
            .ok_or_else(|| Acg2Error::new("acg2-resolve-open"))?;
        stream_and_verify(&mut source, member)?;
        source
            .seek(SeekFrom::Start(0))
            .map_err(|_| Acg2Error::new("acg2-resolve-length"))?;
        match member.role() {
            MemberRole::Model => {
                let policy = ValidationPolicy::new(
                    member.artifact_bytes(),
                    ValidationPolicy::default().maximum_tensors(),
                )
                .map_err(|_| Acg2Error::new("acg2-member-parse"))?;
                let parsed = validate_model(&mut source, policy)
                    .map_err(|_| Acg2Error::new("acg2-member-parse"))?;
                if parsed.identity().byte_length() != member.artifact_bytes()
                    || parsed.identity().artifact_sha256() != &member.artifact_sha256()
                {
                    return Err(Acg2Error::new("acg2-member-parse"));
                }
                model = Some(parsed);
            }
            MemberRole::Tokenizer => tokenizer = Some(read_exact_member(&mut source, member)?),
            MemberRole::Template => template = Some(read_exact_member(&mut source, member)?),
            MemberRole::Sampling => sampling = Some(read_exact_member(&mut source, member)?),
            MemberRole::Prompt => prompt = Some(read_exact_member(&mut source, member)?),
        }
    }

    let model = model.ok_or_else(|| Acg2Error::new("acg2-member-parse"))?;
    let tokenizer = tokenizer.ok_or_else(|| Acg2Error::new("acg2-member-parse"))?;
    let template = template.ok_or_else(|| Acg2Error::new("acg2-member-parse"))?;
    let sampling = sampling.ok_or_else(|| Acg2Error::new("acg2-member-parse"))?;
    let prompt = prompt.ok_or_else(|| Acg2Error::new("acg2-member-parse"))?;
    validate_prompt_bound_graph(&graph)?;
    let prompt_runtime = Prompt2Runtime::from_artifacts(&prompt, &tokenizer, &template, &sampling)
        .map_err(|_| Acg2Error::new("acg2-dependency"))?;
    let prompt_artifact = prompt_runtime.prompt2_artifact();
    if !model_spec_matches_prompt(model.spec(), &prompt_artifact) {
        return Err(Acg2Error::new("acg2-dependency"));
    }
    let model_tensor_count =
        u32::try_from(model.tensors().len()).map_err(|_| Acg2Error::new("acg2-arithmetic"))?;
    let model_artifact_bytes = graph.member(MemberRole::Model).artifact_bytes();
    let resource_plan = ResourcePlan {
        graph_identity: graph.identity(),
        resolved_member_bytes: graph.resolved_member_bytes(),
        model_artifact_bytes,
        resident_dependency_artifact_bytes: graph
            .resolved_member_bytes()
            .checked_sub(model_artifact_bytes)
            .ok_or_else(|| Acg2Error::new("acg2-arithmetic"))?,
        model_tensor_count,
        stream_hash_buffer_bytes: STREAM_HASH_BUFFER_BYTES as u64,
    };
    if !preflight.accept(resource_plan) {
        return Err(Acg2Error::new("acg2-resource-preflight"));
    }
    Ok(PreparedComposition {
        graph,
        resource_plan,
        runtime: Some(Box::new(ValidatedRuntime {
            model,
            prompt: prompt_runtime,
        })),
    })
}

fn model_spec_matches_prompt(spec: &ModelSpec, prompt: &Prompt2Artifact) -> bool {
    spec.vocabulary_size == prompt.model_vocabulary_size()
        && spec.context_length == prompt.maximum_context_tokens()
}

fn validate_owner_profiles() -> Result<(), Acg2Error> {
    let expected = [
        (MemberRole::Model, SLM2_FORMAT_PROFILE_SHA256),
        (MemberRole::Tokenizer, TOKENIZER2_FORMAT_PROFILE_SHA256),
        (MemberRole::Template, TEMPLATE2_FORMAT_PROFILE_SHA256),
        (MemberRole::Sampling, SAMPLING2_FORMAT_PROFILE_SHA256),
        (MemberRole::Prompt, PROMPT2_FORMAT_PROFILE_SHA256),
    ];
    if expected
        .iter()
        .any(|(role, digest)| role.profile_sha256_hex() != *digest)
    {
        return Err(Acg2Error::new("acg2-dependency"));
    }
    Ok(())
}

fn validate_prompt_bound_graph(graph: &Acg2Graph) -> Result<(), Acg2Error> {
    let expected = [
        (MemberRole::Tokenizer, QWEN3_TOKENIZER2_ARTIFACT_SHA256),
        (MemberRole::Template, QWEN3_TEMPLATE2_ARTIFACT_SHA256),
        (MemberRole::Sampling, SAMPLING2_ARTIFACT_SHA256),
        (MemberRole::Prompt, PROMPT2_ARTIFACT_SHA256),
    ];
    for (role, digest) in expected {
        if hex_lower(&graph.member(role).artifact_sha256()) != digest {
            return Err(Acg2Error::new("acg2-dependency"));
        }
    }
    if graph.member(MemberRole::Tokenizer).artifact_bytes() != QWEN3_TOKENIZER2_ARTIFACT_BYTES {
        return Err(Acg2Error::new("acg2-dependency"));
    }
    Ok(())
}

fn stream_and_verify(source: &mut dyn Acg2Read, member: Acg2Member) -> Result<(), Acg2Error> {
    let observed = source
        .seek(SeekFrom::End(0))
        .map_err(|_| Acg2Error::new("acg2-resolve-length"))?;
    if observed != member.artifact_bytes() {
        return Err(Acg2Error::new("acg2-resolve-length"));
    }
    source
        .seek(SeekFrom::Start(0))
        .map_err(|_| Acg2Error::new("acg2-resolve-length"))?;
    let mut remaining = observed;
    let mut buffer = vec![0_u8; STREAM_HASH_BUFFER_BYTES];
    let mut hasher = Sha256::new();
    while remaining > 0 {
        let requested = usize::try_from(remaining.min(STREAM_HASH_BUFFER_BYTES as u64))
            .map_err(|_| Acg2Error::new("acg2-arithmetic"))?;
        source
            .read_exact(&mut buffer[..requested])
            .map_err(|_| Acg2Error::new("acg2-resolve-length"))?;
        hasher.update(&buffer[..requested]);
        remaining -= requested as u64;
    }
    let digest: [u8; 32] = hasher.finalize().into();
    if digest != member.artifact_sha256() {
        return Err(Acg2Error::new("acg2-resolve-hash"));
    }
    Ok(())
}

fn read_exact_member(source: &mut dyn Acg2Read, member: Acg2Member) -> Result<Vec<u8>, Acg2Error> {
    let length =
        usize::try_from(member.artifact_bytes()).map_err(|_| Acg2Error::new("acg2-arithmetic"))?;
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| Acg2Error::new("acg2-resource-preflight"))?;
    bytes.resize(length, 0);
    source
        .read_exact(&mut bytes)
        .map_err(|_| Acg2Error::new("acg2-resolve-length"))?;
    Ok(bytes)
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

#[cfg(test)]
mod model_prompt_tests {
    use tinyrustlm_prompt2::{write_prompt2, Prompt2Artifact, Prompt2Policy};
    use tinyrustlm_slm2::{ArtifactClass, ModelSpec};

    use super::model_spec_matches_prompt;

    #[test]
    fn model_vocabulary_and_context_must_both_match_prompt2() {
        let mut bytes = Vec::new();
        write_prompt2(&mut bytes).expect("Prompt2 writer");
        let prompt = Prompt2Artifact::from_bytes(&bytes, Prompt2Policy::exact_profile_limits())
            .expect("Prompt2 parser");
        let exact = exact_spec();
        assert!(model_spec_matches_prompt(&exact, &prompt));

        let mut vocabulary_drift = exact.clone();
        vocabulary_drift.vocabulary_size -= 1;
        assert!(!model_spec_matches_prompt(&vocabulary_drift, &prompt));

        let mut context_drift = exact;
        context_drift.context_length -= 1;
        assert!(!model_spec_matches_prompt(&context_drift, &prompt));
    }

    fn exact_spec() -> ModelSpec {
        ModelSpec {
            artifact_class: ArtifactClass::BaseModel,
            vocabulary_size: 151_936,
            context_length: 40_960,
            embedding_size: 1_024,
            feed_forward_size: 3_072,
            layer_count: 28,
            head_count: 16,
            kv_head_count: 8,
            head_dimension: 128,
            rope_theta: 1_000_000.0,
            normalization_epsilon: 0.000_001,
            tied_embeddings: true,
            qkv_bias: false,
            qk_normalization: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::{self, Read, Seek, SeekFrom};
    use std::sync::{Arc, Mutex};

    use super::*;

    struct PatternSource {
        length: u64,
        position: u64,
        maximum_request: Arc<Mutex<usize>>,
    }

    impl Read for PatternSource {
        fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
            let remaining = self.length.saturating_sub(self.position);
            let count = usize::try_from(remaining.min(output.len() as u64)).unwrap_or(0);
            if count == 0 {
                return Ok(0);
            }
            let mut maximum_request = self.maximum_request.lock().expect("request lock");
            *maximum_request = (*maximum_request).max(output.len());
            drop(maximum_request);
            for (index, byte) in output[..count].iter_mut().enumerate() {
                *byte = ((self.position + index as u64) % 251) as u8;
            }
            self.position += count as u64;
            Ok(count)
        }
    }

    impl Seek for PatternSource {
        fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
            let next = match position {
                SeekFrom::Start(value) => i128::from(value),
                SeekFrom::End(value) => i128::from(self.length) + i128::from(value),
                SeekFrom::Current(value) => i128::from(self.position) + i128::from(value),
            };
            if next < 0 || next > i128::from(self.length) {
                return Err(io::Error::new(io::ErrorKind::InvalidInput, "seek"));
            }
            self.position = next as u64;
            Ok(self.position)
        }
    }

    #[test]
    fn stream_hash_uses_one_fixed_buffer_for_a_large_member() {
        let length = 5 * 1_048_576 + 137;
        let mut expected_source = PatternSource {
            length,
            position: 0,
            maximum_request: Arc::new(Mutex::new(0)),
        };
        let mut expected_hasher = Sha256::new();
        let mut expected_buffer = vec![0_u8; STREAM_HASH_BUFFER_BYTES];
        loop {
            let count = expected_source
                .read(&mut expected_buffer)
                .expect("pattern read");
            if count == 0 {
                break;
            }
            expected_hasher.update(&expected_buffer[..count]);
        }
        let maximum_request = Arc::new(Mutex::new(0));
        let mut source = PatternSource {
            length,
            position: 0,
            maximum_request: Arc::clone(&maximum_request),
        };
        let member = Acg2Member::new(MemberRole::Model, length, expected_hasher.finalize().into())
            .expect("member");
        stream_and_verify(&mut source, member).expect("stream hash");
        assert_eq!(
            *maximum_request.lock().expect("request lock"),
            STREAM_HASH_BUFFER_BYTES
        );
        assert_eq!(source.position, length);
    }

    #[test]
    fn owner_profiles_are_exact() {
        validate_owner_profiles().expect("owner profiles");
    }
}
