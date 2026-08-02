//! Typed content identities for immutable champion and specialist portfolios.

use crate::artifact_digest::{sha256_bytes, ArtifactDigest};
use crate::errors::ErrorCode;

const CONTENT_VERSION: u32 = 1;
const MAX_IDENTITY_MEMBERS: usize = 1024;
const STANDALONE_DOMAIN: &str = "tinyrustlm.content.standalone-model.v1";
const ADAPTER_DOMAIN: &str = "tinyrustlm.content.base-dependent-adapter.v1";
const COMPOSITION_DOMAIN: &str = "tinyrustlm.content.composition.v1";
const SHARED_CHUNK_DOMAIN: &str = "tinyrustlm.content.shared-chunk.v1";
const ROUTE_POLICY_DOMAIN: &str = "tinyrustlm.content.route-policy.v1";
const KV_FORMAT_DOMAIN: &str = "tinyrustlm.content.kv-format.v1";
const RETRIEVAL_INDEX_DOMAIN: &str = "tinyrustlm.content.retrieval-index.v1";
const STORAGE_LAYOUT_DOMAIN: &str = "tinyrustlm.content.storage-layout.v1";
const KV_CACHE_KEY_DOMAIN: &str = "tinyrustlm.content.kv-cache-key.v1";

/// One exact SHA-256 value used by identity inputs.
pub type Digest32 = [u8; 32];

/// Executable artifact classes admitted by the clean-slate identity contract.
#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub enum ArtifactKind {
    /// One complete standalone `.slm` model.
    StandaloneModel = 1,
    /// One adapter that depends on an exact standalone base.
    BaseDependentAdapter = 2,
    /// One immutable base and adapter composition.
    Composition = 3,
    /// One physical content-deduplication chunk.
    SharedChunk = 4,
    /// One pre-generation route policy.
    RoutePolicy = 5,
    /// One KV storage format descriptor.
    KvFormat = 6,
    /// One durable local retrieval index.
    RetrievalIndex = 7,
}

impl ArtifactKind {
    /// Returns the frozen one-byte typed-identity tag.
    pub fn tag(self) -> u8 {
        self as u8
    }

    /// Returns the full-hash display prefix for this artifact class.
    pub fn display_prefix(self) -> &'static str {
        match self {
            Self::StandaloneModel => "model-sha256-",
            Self::BaseDependentAdapter => "adapter-sha256-",
            Self::Composition => "composition-sha256-",
            Self::SharedChunk => "chunk-sha256-",
            Self::RoutePolicy => "route-sha256-",
            Self::KvFormat => "kv-format-sha256-",
            Self::RetrievalIndex => "retrieval-sha256-",
        }
    }
}

/// A kind-tagged, full SHA-256 content identity.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct ContentId {
    kind: ArtifactKind,
    digest: Digest32,
}

impl ContentId {
    /// Parses one exact lowercase full-hash display identity.
    pub fn parse_display(value: &str) -> Result<Self, ErrorCode> {
        let (kind, digest_text) = [
            ArtifactKind::StandaloneModel,
            ArtifactKind::BaseDependentAdapter,
            ArtifactKind::Composition,
            ArtifactKind::SharedChunk,
            ArtifactKind::RoutePolicy,
            ArtifactKind::KvFormat,
            ArtifactKind::RetrievalIndex,
        ]
        .into_iter()
        .find_map(|kind| {
            value
                .strip_prefix(kind.display_prefix())
                .map(|digest| (kind, digest))
        })
        .ok_or(ErrorCode::InvalidHeader)?;
        if digest_text.len() != 64 {
            return Err(ErrorCode::InvalidHeader);
        }
        let mut digest = [0u8; 32];
        for (index, output) in digest.iter_mut().enumerate() {
            let offset = index * 2;
            let high = decode_lower_hex(
                *digest_text
                    .as_bytes()
                    .get(offset)
                    .ok_or(ErrorCode::InvalidHeader)?,
            )?;
            let low = decode_lower_hex(
                *digest_text
                    .as_bytes()
                    .get(offset + 1)
                    .ok_or(ErrorCode::InvalidHeader)?,
            )?;
            *output = (high << 4) | low;
        }
        Self::from_parts(kind, digest)
    }

    /// Returns this identity's executable artifact class.
    pub fn kind(self) -> ArtifactKind {
        self.kind
    }

    /// Returns the complete SHA-256 digest.
    pub fn digest(self) -> Digest32 {
        self.digest
    }

    /// Renders the public full-hash identity without timestamps or aliases.
    pub fn display(self) -> String {
        format!("{}{}", self.kind.display_prefix(), hex(&self.digest))
    }

    pub(crate) fn from_parts(kind: ArtifactKind, digest: Digest32) -> Result<Self, ErrorCode> {
        require_digest(digest)?;
        Ok(Self { kind, digest })
    }

    fn new(kind: ArtifactKind, digest: Digest32) -> Self {
        Self { kind, digest }
    }

    pub(crate) fn append_typed(self, output: &mut Vec<u8>) {
        output.push(self.kind.tag());
        output.extend_from_slice(&self.digest);
    }
}

fn decode_lower_hex(value: u8) -> Result<u8, ErrorCode> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err(ErrorCode::InvalidHeader),
    }
}

/// Profile hashes that must match across a base, adapter, and composition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ExecutionBindings {
    tokenizer_sha256: Digest32,
    chat_template_sha256: Digest32,
    tensor_layout_sha256: Digest32,
    quantization_profile_sha256: Digest32,
    execution_profile_sha256: Digest32,
}

impl ExecutionBindings {
    /// Creates exact non-sentinel profile bindings for one model interpretation.
    pub fn new(
        tokenizer_sha256: Digest32,
        chat_template_sha256: Digest32,
        tensor_layout_sha256: Digest32,
        quantization_profile_sha256: Digest32,
        execution_profile_sha256: Digest32,
    ) -> Result<Self, ErrorCode> {
        for digest in [
            tokenizer_sha256,
            chat_template_sha256,
            tensor_layout_sha256,
            quantization_profile_sha256,
            execution_profile_sha256,
        ] {
            require_digest(digest)?;
        }
        Ok(Self {
            tokenizer_sha256,
            chat_template_sha256,
            tensor_layout_sha256,
            quantization_profile_sha256,
            execution_profile_sha256,
        })
    }

    /// Returns the exact tokenizer interpretation digest.
    pub fn tokenizer_sha256(self) -> Digest32 {
        self.tokenizer_sha256
    }

    /// Returns the exact chat-template interpretation digest.
    pub fn chat_template_sha256(self) -> Digest32 {
        self.chat_template_sha256
    }

    /// Returns the exact tensor-layout interpretation digest.
    pub fn tensor_layout_sha256(self) -> Digest32 {
        self.tensor_layout_sha256
    }

    /// Returns the exact quantization-profile interpretation digest.
    pub fn quantization_profile_sha256(self) -> Digest32 {
        self.quantization_profile_sha256
    }

    /// Returns the exact execution-profile interpretation digest.
    pub fn execution_profile_sha256(self) -> Digest32 {
        self.execution_profile_sha256
    }

    fn append(&self, output: &mut Vec<u8>) {
        output.extend_from_slice(&self.tokenizer_sha256);
        output.extend_from_slice(&self.chat_template_sha256);
        output.extend_from_slice(&self.tensor_layout_sha256);
        output.extend_from_slice(&self.quantization_profile_sha256);
        output.extend_from_slice(&self.execution_profile_sha256);
    }
}

/// Validated logical identity for one complete standalone model.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StandaloneModelIdentity {
    id: ContentId,
    model_bytes: u64,
    model_sha256: Digest32,
    bindings: ExecutionBindings,
}

impl StandaloneModelIdentity {
    /// Builds a standalone identity from full model bytes and interpretation bindings.
    pub fn new(
        model_bytes: u64,
        model_sha256: Digest32,
        bindings: ExecutionBindings,
    ) -> Result<Self, ErrorCode> {
        require_positive_bytes(model_bytes)?;
        require_digest(model_sha256)?;
        let mut material = identity_material(STANDALONE_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        push_u64(&mut material, model_bytes);
        material.extend_from_slice(&model_sha256);
        bindings.append(&mut material);
        Ok(Self {
            id: ContentId::new(ArtifactKind::StandaloneModel, identity_hash(&material)?),
            model_bytes,
            model_sha256,
            bindings,
        })
    }

    /// Returns the typed standalone model identity.
    pub fn id(&self) -> ContentId {
        self.id
    }

    /// Returns the complete logical model byte count.
    pub fn model_bytes(&self) -> u64 {
        self.model_bytes
    }

    /// Returns the SHA-256 of the complete standalone model bytes.
    pub fn model_sha256(&self) -> Digest32 {
        self.model_sha256
    }

    /// Returns all interpretation bindings used by the standalone identity.
    pub fn execution_bindings(&self) -> ExecutionBindings {
        self.bindings
    }
}

/// Declared adapter or composition behavior.
#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CompositionSemantics {
    /// The immutable base without adapters.
    BaseOnly = 0,
    /// Exact additive deltas whose order is irrelevant.
    Additive = 1,
    /// One replacement overlay.
    Replacement = 2,
    /// Order-sensitive sequential application.
    Sequential = 3,
    /// Order-sensitive application with explicit earlier dependencies.
    Dependent = 4,
}

impl CompositionSemantics {
    fn tag(self) -> u8 {
        self as u8
    }
}

/// Validated identity and bindings for one base-dependent adapter.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BaseDependentAdapterIdentity {
    id: ContentId,
    adapter_bytes: u64,
    adapter_sha256: Digest32,
    base_id: ContentId,
    bindings: ExecutionBindings,
    semantics: CompositionSemantics,
}

impl BaseDependentAdapterIdentity {
    /// Builds an adapter identity bound to one exact standalone base.
    pub fn new(
        adapter_bytes: u64,
        adapter_sha256: Digest32,
        base: &StandaloneModelIdentity,
        semantics: CompositionSemantics,
    ) -> Result<Self, ErrorCode> {
        require_positive_bytes(adapter_bytes)?;
        require_digest(adapter_sha256)?;
        if semantics == CompositionSemantics::BaseOnly {
            return Err(ErrorCode::InvalidHeader);
        }
        let mut material = identity_material(ADAPTER_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        push_u64(&mut material, adapter_bytes);
        material.extend_from_slice(&adapter_sha256);
        base.id.append_typed(&mut material);
        base.bindings.append(&mut material);
        material.push(semantics.tag());
        Ok(Self {
            id: ContentId::new(
                ArtifactKind::BaseDependentAdapter,
                identity_hash(&material)?,
            ),
            adapter_bytes,
            adapter_sha256,
            base_id: base.id,
            bindings: base.bindings,
            semantics,
        })
    }

    /// Returns the typed adapter identity.
    pub fn id(&self) -> ContentId {
        self.id
    }

    /// Returns the adapter's incremental byte count.
    pub fn adapter_bytes(&self) -> u64 {
        self.adapter_bytes
    }

    /// Returns the SHA-256 of every exact adapter package byte.
    pub fn adapter_sha256(&self) -> Digest32 {
        self.adapter_sha256
    }

    /// Returns the exact standalone base identity required by this adapter.
    pub fn base_id(&self) -> ContentId {
        self.base_id
    }

    /// Returns all execution bindings inherited from the standalone base.
    pub fn execution_bindings(&self) -> ExecutionBindings {
        self.bindings
    }

    /// Returns the declared immutable composition behavior.
    pub fn semantics(&self) -> CompositionSemantics {
        self.semantics
    }
}

/// One adapter plus explicit dependencies used by a composition.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompositionMember {
    adapter: BaseDependentAdapterIdentity,
    dependencies: Vec<ContentId>,
}

impl CompositionMember {
    /// Creates a member whose dependencies are validated by its composition.
    pub fn new(adapter: BaseDependentAdapterIdentity, dependencies: Vec<ContentId>) -> Self {
        Self {
            adapter,
            dependencies,
        }
    }

    /// Returns this member's exact base-dependent adapter identity.
    pub fn adapter(&self) -> &BaseDependentAdapterIdentity {
        &self.adapter
    }

    /// Returns the canonical explicit dependency identities.
    pub fn dependencies(&self) -> &[ContentId] {
        &self.dependencies
    }
}

/// Validated immutable composition identity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompositionIdentity {
    id: ContentId,
    base: StandaloneModelIdentity,
    semantics: CompositionSemantics,
    members: Vec<CompositionMember>,
}

impl CompositionIdentity {
    /// Builds a homogeneous composition and canonicalizes additive member order.
    pub fn new(
        base: &StandaloneModelIdentity,
        semantics: CompositionSemantics,
        members: Vec<CompositionMember>,
    ) -> Result<Self, ErrorCode> {
        validate_member_count(semantics, members.len())?;
        if members.len() > MAX_IDENTITY_MEMBERS {
            return Err(ErrorCode::InvalidLength);
        }
        let mut canonical_members = members;
        for member in &canonical_members {
            if member.adapter.base_id != base.id
                || member.adapter.bindings != base.bindings
                || member.adapter.semantics != semantics
            {
                return Err(ErrorCode::ShapeMismatch);
            }
        }
        if semantics == CompositionSemantics::Additive {
            canonical_members.sort_by_key(|member| member.adapter.id);
        }
        require_unique_member_ids(&canonical_members)?;
        validate_dependencies(semantics, &canonical_members)?;

        let mut material = identity_material(COMPOSITION_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        base.id.append_typed(&mut material);
        base.bindings.append(&mut material);
        material.push(semantics.tag());
        push_count(&mut material, canonical_members.len())?;
        for member in &canonical_members {
            member.adapter.id.append_typed(&mut material);
            push_count(&mut material, member.dependencies.len())?;
            for dependency in &member.dependencies {
                dependency.append_typed(&mut material);
            }
        }
        Ok(Self {
            id: ContentId::new(ArtifactKind::Composition, identity_hash(&material)?),
            base: base.clone(),
            semantics,
            members: canonical_members,
        })
    }

    /// Returns the typed composition identity.
    pub fn id(&self) -> ContentId {
        self.id
    }

    /// Returns the exact standalone base shared by every member.
    pub fn base(&self) -> &StandaloneModelIdentity {
        &self.base
    }

    /// Returns the declared composition behavior.
    pub fn semantics(&self) -> CompositionSemantics {
        self.semantics
    }

    /// Returns members in their identity-material order.
    pub fn members(&self) -> &[CompositionMember] {
        &self.members
    }

    /// Returns the complete logical bytes required to execute this composition.
    pub fn logical_bytes(&self) -> Result<u64, ErrorCode> {
        self.members
            .iter()
            .try_fold(self.base.model_bytes, |total, member| {
                total
                    .checked_add(member.adapter.adapter_bytes)
                    .ok_or(ErrorCode::InvalidLength)
            })
    }

    /// Returns bytes added beyond an already-present immutable base.
    pub fn incremental_specialist_bytes(&self) -> Result<u64, ErrorCode> {
        self.members.iter().try_fold(0u64, |total, member| {
            total
                .checked_add(member.adapter.adapter_bytes)
                .ok_or(ErrorCode::InvalidLength)
        })
    }
}

/// Validated identity for one shared physical chunk.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedChunkIdentity {
    id: ContentId,
    chunk_bytes: u64,
    chunk_sha256: Digest32,
}

impl SharedChunkIdentity {
    /// Builds one physical chunk identity.
    pub fn new(chunk_bytes: u64, chunk_sha256: Digest32) -> Result<Self, ErrorCode> {
        require_positive_bytes(chunk_bytes)?;
        require_digest(chunk_sha256)?;
        let mut material = identity_material(SHARED_CHUNK_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        push_u64(&mut material, chunk_bytes);
        material.extend_from_slice(&chunk_sha256);
        Ok(Self {
            id: ContentId::new(ArtifactKind::SharedChunk, identity_hash(&material)?),
            chunk_bytes,
            chunk_sha256,
        })
    }

    /// Returns the typed chunk identity.
    pub fn id(&self) -> ContentId {
        self.id
    }
}

/// A non-executable physical layout for reconstructing one standalone model.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StorageLayoutIdentity {
    digest: Digest32,
    target: StandaloneModelIdentity,
    chunks: Vec<SharedChunkIdentity>,
}

impl StorageLayoutIdentity {
    /// Builds an ordered, deduplicated chunk layout for one standalone model.
    pub fn new(
        target: &StandaloneModelIdentity,
        chunks: Vec<SharedChunkIdentity>,
    ) -> Result<Self, ErrorCode> {
        if chunks.is_empty() || chunks.len() > MAX_IDENTITY_MEMBERS {
            return Err(ErrorCode::InvalidLength);
        }
        let mut total = 0u64;
        for (index, chunk) in chunks.iter().enumerate() {
            total = total
                .checked_add(chunk.chunk_bytes)
                .ok_or(ErrorCode::InvalidLength)?;
            if chunks[..index].iter().any(|prior| prior.id == chunk.id) {
                return Err(ErrorCode::InvalidHeader);
            }
        }
        if total != target.model_bytes {
            return Err(ErrorCode::ShapeMismatch);
        }
        let mut material = identity_material(STORAGE_LAYOUT_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        target.id.append_typed(&mut material);
        push_u64(&mut material, target.model_bytes);
        push_count(&mut material, chunks.len())?;
        for chunk in &chunks {
            chunk.id.append_typed(&mut material);
            push_u64(&mut material, chunk.chunk_bytes);
        }
        Ok(Self {
            digest: identity_hash(&material)?,
            target: target.clone(),
            chunks,
        })
    }

    /// Returns the layout's full SHA-256 without assigning an executable kind.
    pub fn digest(&self) -> Digest32 {
        self.digest
    }

    /// Verifies each chunk and the reconstructed target without concatenating it.
    pub fn verify_reconstruction(&self, payloads: &[&[u8]]) -> Result<(), ErrorCode> {
        if payloads.len() != self.chunks.len() {
            return Err(ErrorCode::InvalidLength);
        }
        let target_len =
            usize::try_from(self.target.model_bytes).map_err(|_| ErrorCode::InvalidLength)?;
        let mut target_digest = ArtifactDigest::new(target_len)?;
        for (chunk, payload) in self.chunks.iter().zip(payloads) {
            let payload_bytes =
                u64::try_from(payload.len()).map_err(|_| ErrorCode::InvalidLength)?;
            if payload_bytes != chunk.chunk_bytes || sha256_bytes(payload)? != chunk.chunk_sha256 {
                return Err(ErrorCode::InvalidHeader);
            }
            target_digest.update(payload)?;
        }
        let reconstructed = target_digest.finish()?;
        if reconstructed.sha256 != self.target.model_sha256 {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(())
    }
}

/// Validated KV format descriptor identity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KvFormatIdentity {
    id: ContentId,
    descriptor_bytes: u64,
}

impl KvFormatIdentity {
    /// Builds a KV descriptor identity without granting cache reuse.
    pub fn new(descriptor_bytes: u64, descriptor_sha256: Digest32) -> Result<Self, ErrorCode> {
        require_positive_bytes(descriptor_bytes)?;
        require_digest(descriptor_sha256)?;
        let mut material = identity_material(KV_FORMAT_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        push_u64(&mut material, descriptor_bytes);
        material.extend_from_slice(&descriptor_sha256);
        Ok(Self {
            id: ContentId::new(ArtifactKind::KvFormat, identity_hash(&material)?),
            descriptor_bytes,
        })
    }

    /// Returns the typed KV format identity.
    pub fn id(&self) -> ContentId {
        self.id
    }
}

/// Retrieval score interpretation encoded in an index identity.
#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RetrievalMetric {
    /// Cosine similarity, larger scores first.
    Cosine = 1,
    /// Inner product, larger scores first.
    InnerProduct = 2,
    /// Squared Euclidean distance, smaller scores first.
    SquaredEuclidean = 3,
}

/// Validated durable retrieval-index identity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetrievalIndexIdentity {
    id: ContentId,
    index_bytes: u64,
}

impl RetrievalIndexIdentity {
    /// Builds an index identity bound to its embedding model and metric.
    pub fn new(
        index_bytes: u64,
        index_sha256: Digest32,
        embedding_model: &StandaloneModelIdentity,
        embedding_profile_sha256: Digest32,
        vector_dimension: u32,
        metric: RetrievalMetric,
    ) -> Result<Self, ErrorCode> {
        require_positive_bytes(index_bytes)?;
        require_digest(index_sha256)?;
        require_digest(embedding_profile_sha256)?;
        if vector_dimension == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        let mut material = identity_material(RETRIEVAL_INDEX_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        push_u64(&mut material, index_bytes);
        material.extend_from_slice(&index_sha256);
        embedding_model.id.append_typed(&mut material);
        material.extend_from_slice(&embedding_profile_sha256);
        push_u32(&mut material, vector_dimension);
        material.push(metric as u8);
        Ok(Self {
            id: ContentId::new(ArtifactKind::RetrievalIndex, identity_hash(&material)?),
            index_bytes,
        })
    }

    /// Returns the typed retrieval-index identity.
    pub fn id(&self) -> ContentId {
        self.id
    }
}

/// Validated pre-generation route-policy identity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoutePolicyIdentity {
    id: ContentId,
    policy_bytes: u64,
}

impl RoutePolicyIdentity {
    /// Builds a route policy with sorted specialist and selector identities.
    pub fn new(
        policy_bytes: u64,
        policy_sha256: Digest32,
        champion: &CompositionIdentity,
        specialists: &[CompositionIdentity],
        selectors: &[ContentId],
    ) -> Result<Self, ErrorCode> {
        require_positive_bytes(policy_bytes)?;
        require_digest(policy_sha256)?;
        if champion.semantics != CompositionSemantics::BaseOnly
            || specialists.is_empty()
            || specialists.len() > MAX_IDENTITY_MEMBERS
            || selectors.len() > MAX_IDENTITY_MEMBERS
        {
            return Err(ErrorCode::InvalidHeader);
        }
        let mut specialist_ids = specialists.iter().map(|value| value.id).collect::<Vec<_>>();
        specialist_ids.sort();
        require_unique_ids(&specialist_ids)?;
        if specialist_ids.contains(&champion.id) {
            return Err(ErrorCode::InvalidHeader);
        }
        let mut selector_ids = selectors.to_vec();
        selector_ids.sort();
        require_unique_ids(&selector_ids)?;
        if selector_ids.iter().any(|id| {
            !matches!(
                id.kind,
                ArtifactKind::StandaloneModel | ArtifactKind::RetrievalIndex
            )
        }) {
            return Err(ErrorCode::ShapeMismatch);
        }

        let mut material = identity_material(ROUTE_POLICY_DOMAIN);
        push_u32(&mut material, CONTENT_VERSION);
        push_u64(&mut material, policy_bytes);
        material.extend_from_slice(&policy_sha256);
        champion.id.append_typed(&mut material);
        push_count(&mut material, specialist_ids.len())?;
        for id in &specialist_ids {
            id.append_typed(&mut material);
        }
        push_count(&mut material, selector_ids.len())?;
        for id in &selector_ids {
            id.append_typed(&mut material);
        }
        Ok(Self {
            id: ContentId::new(ArtifactKind::RoutePolicy, identity_hash(&material)?),
            policy_bytes,
        })
    }

    /// Returns the typed route-policy identity.
    pub fn id(&self) -> ContentId {
        self.id
    }
}

/// Builds the complete key that gates KV reuse for one composition.
pub fn kv_cache_key(
    composition: &CompositionIdentity,
    position_policy_sha256: Digest32,
    kv_format: &KvFormatIdentity,
    prompt_token_sha256: Digest32,
) -> Result<Digest32, ErrorCode> {
    require_digest(position_policy_sha256)?;
    require_digest(prompt_token_sha256)?;
    let mut material = identity_material(KV_CACHE_KEY_DOMAIN);
    push_u32(&mut material, CONTENT_VERSION);
    composition.id.append_typed(&mut material);
    material.extend_from_slice(&composition.base.bindings.tokenizer_sha256);
    material.extend_from_slice(&composition.base.bindings.chat_template_sha256);
    material.extend_from_slice(&position_policy_sha256);
    kv_format.id.append_typed(&mut material);
    material.extend_from_slice(&prompt_token_sha256);
    material.extend_from_slice(&composition.base.bindings.execution_profile_sha256);
    identity_hash(&material)
}

/// Current and peak memory bytes measured for one execution composition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeMemoryBytes {
    /// Currently allocated KV capacity.
    pub kv_allocated_bytes: u64,
    /// Currently committed KV bytes.
    pub kv_committed_bytes: u64,
    /// Peak KV bytes for the measured operation.
    pub kv_peak_bytes: u64,
    /// Peak overlay activation scratch.
    pub activation_scratch_bytes: u64,
    /// Peak temporary decoded tensor bytes.
    pub decoded_temporary_bytes: u64,
    /// Peak resident process bytes.
    pub peak_resident_bytes: u64,
}

impl RuntimeMemoryBytes {
    /// Validates monotonic peak relationships without inventing measurements.
    pub fn validate(self) -> Result<Self, ErrorCode> {
        if self.kv_committed_bytes > self.kv_allocated_bytes
            || self.kv_peak_bytes < self.kv_allocated_bytes
            || self.kv_peak_bytes < self.kv_committed_bytes
            || self.peak_resident_bytes < self.kv_peak_bytes
            || self.peak_resident_bytes < self.activation_scratch_bytes
            || self.peak_resident_bytes < self.decoded_temporary_bytes
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok(self)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct PhysicalObject {
    id: ContentId,
    bytes: u64,
}

/// Physical storage set used to derive deduplicated portfolio byte counts.
#[derive(Clone, Debug, Default)]
pub struct PhysicalPortfolio {
    objects: Vec<PhysicalObject>,
    layout_targets: Vec<ContentId>,
}

impl PhysicalPortfolio {
    /// Creates an empty physical object set.
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds a monolithic standalone model object.
    pub fn add_standalone(&mut self, model: &StandaloneModelIdentity) -> Result<(), ErrorCode> {
        self.insert(model.id, model.model_bytes)
    }

    /// Adds a verified chunk layout instead of a monolithic model object.
    pub fn add_storage_layout(&mut self, layout: &StorageLayoutIdentity) -> Result<(), ErrorCode> {
        if self.layout_targets.contains(&layout.target.id) {
            return Err(ErrorCode::InvalidHeader);
        }
        for chunk in &layout.chunks {
            self.insert(chunk.id, chunk.chunk_bytes)?;
        }
        self.layout_targets.push(layout.target.id);
        Ok(())
    }

    /// Adds one adapter object.
    pub fn add_adapter(&mut self, adapter: &BaseDependentAdapterIdentity) -> Result<(), ErrorCode> {
        self.insert(adapter.id, adapter.adapter_bytes)
    }

    /// Adds one route-policy object.
    pub fn add_route_policy(&mut self, route: &RoutePolicyIdentity) -> Result<(), ErrorCode> {
        self.insert(route.id, route.policy_bytes)
    }

    /// Adds one retrieval-index object.
    pub fn add_retrieval_index(&mut self, index: &RetrievalIndexIdentity) -> Result<(), ErrorCode> {
        self.insert(index.id, index.index_bytes)
    }

    /// Adds one KV-format descriptor object.
    pub fn add_kv_format(&mut self, format: &KvFormatIdentity) -> Result<(), ErrorCode> {
        self.insert(format.id, format.descriptor_bytes)
    }

    /// Derives all required active-composition and physical byte categories.
    pub fn account(
        &self,
        active: &CompositionIdentity,
        runtime: RuntimeMemoryBytes,
    ) -> Result<ByteAccounting, ErrorCode> {
        let base_present = self
            .objects
            .iter()
            .any(|object| object.id == active.base.id)
            || self.layout_targets.contains(&active.base.id);
        if !base_present
            || active.members.iter().any(|member| {
                !self
                    .objects
                    .iter()
                    .any(|object| object.id == member.adapter.id)
            })
        {
            return Err(ErrorCode::MissingTensor);
        }
        let runtime = runtime.validate()?;
        let physical_portfolio_bytes = self.objects.iter().try_fold(0u64, |total, object| {
            total
                .checked_add(object.bytes)
                .ok_or(ErrorCode::InvalidLength)
        })?;
        Ok(ByteAccounting {
            standalone_artifact_bytes: active.base.model_bytes,
            logical_composition_bytes: active.logical_bytes()?,
            incremental_specialist_bytes: active.incremental_specialist_bytes()?,
            physical_portfolio_bytes,
            route_policy_bytes: self.sum_kind(ArtifactKind::RoutePolicy)?,
            retrieval_index_bytes: self.sum_kind(ArtifactKind::RetrievalIndex)?,
            kv_format_descriptor_bytes: self.sum_kind(ArtifactKind::KvFormat)?,
            kv_allocated_bytes: runtime.kv_allocated_bytes,
            kv_committed_bytes: runtime.kv_committed_bytes,
            kv_peak_bytes: runtime.kv_peak_bytes,
            activation_scratch_bytes: runtime.activation_scratch_bytes,
            decoded_temporary_bytes: runtime.decoded_temporary_bytes,
            peak_resident_bytes: runtime.peak_resident_bytes,
        })
    }

    fn insert(&mut self, id: ContentId, bytes: u64) -> Result<(), ErrorCode> {
        require_positive_bytes(bytes)?;
        if let Some(existing) = self.objects.iter().find(|object| object.id == id) {
            return if existing.bytes == bytes {
                Ok(())
            } else {
                Err(ErrorCode::ShapeMismatch)
            };
        }
        self.objects.push(PhysicalObject { id, bytes });
        Ok(())
    }

    fn sum_kind(&self, kind: ArtifactKind) -> Result<u64, ErrorCode> {
        self.objects
            .iter()
            .filter(|object| object.id.kind == kind)
            .try_fold(0u64, |total, object| {
                total
                    .checked_add(object.bytes)
                    .ok_or(ErrorCode::InvalidLength)
            })
    }
}

/// Complete non-overloaded byte categories for one active composition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ByteAccounting {
    /// Complete standalone base artifact bytes.
    pub standalone_artifact_bytes: u64,
    /// Base plus every active adapter byte.
    pub logical_composition_bytes: u64,
    /// Active adapter bytes assuming the base is already present.
    pub incremental_specialist_bytes: u64,
    /// Every unique physical object in the portfolio.
    pub physical_portfolio_bytes: u64,
    /// Unique route policy bytes.
    pub route_policy_bytes: u64,
    /// Unique retrieval index bytes.
    pub retrieval_index_bytes: u64,
    /// Unique KV format descriptor bytes.
    pub kv_format_descriptor_bytes: u64,
    /// Currently allocated KV bytes.
    pub kv_allocated_bytes: u64,
    /// Currently committed KV bytes.
    pub kv_committed_bytes: u64,
    /// Peak KV bytes.
    pub kv_peak_bytes: u64,
    /// Peak activation scratch bytes.
    pub activation_scratch_bytes: u64,
    /// Peak decoded temporary bytes.
    pub decoded_temporary_bytes: u64,
    /// Peak resident bytes.
    pub peak_resident_bytes: u64,
}

fn validate_member_count(semantics: CompositionSemantics, count: usize) -> Result<(), ErrorCode> {
    let valid = match semantics {
        CompositionSemantics::BaseOnly => count == 0,
        CompositionSemantics::Additive
        | CompositionSemantics::Sequential
        | CompositionSemantics::Dependent => count >= 1,
        CompositionSemantics::Replacement => count == 1,
    };
    if valid {
        Ok(())
    } else {
        Err(ErrorCode::ShapeMismatch)
    }
}

fn require_unique_member_ids(members: &[CompositionMember]) -> Result<(), ErrorCode> {
    for (index, member) in members.iter().enumerate() {
        if members[..index]
            .iter()
            .any(|prior| prior.adapter.id == member.adapter.id)
        {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn validate_dependencies(
    semantics: CompositionSemantics,
    members: &[CompositionMember],
) -> Result<(), ErrorCode> {
    for (index, member) in members.iter().enumerate() {
        if member.dependencies.len() > MAX_IDENTITY_MEMBERS {
            return Err(ErrorCode::InvalidLength);
        }
        if semantics != CompositionSemantics::Dependent {
            if !member.dependencies.is_empty() {
                return Err(ErrorCode::ShapeMismatch);
            }
            continue;
        }
        if member
            .dependencies
            .iter()
            .any(|dependency| dependency.kind != ArtifactKind::BaseDependentAdapter)
            || !strictly_sorted(&member.dependencies)
            || member.dependencies.iter().any(|dependency| {
                !members[..index]
                    .iter()
                    .any(|prior| prior.adapter.id == *dependency)
            })
        {
            return Err(ErrorCode::ShapeMismatch);
        }
    }
    Ok(())
}

fn strictly_sorted(values: &[ContentId]) -> bool {
    values.windows(2).all(|pair| pair[0] < pair[1])
}

fn require_unique_ids(values: &[ContentId]) -> Result<(), ErrorCode> {
    if values.windows(2).any(|pair| pair[0] == pair[1]) {
        Err(ErrorCode::InvalidHeader)
    } else {
        Ok(())
    }
}

fn identity_material(domain: &str) -> Vec<u8> {
    let mut output = Vec::with_capacity(domain.len() + 256);
    output.extend_from_slice(domain.as_bytes());
    output.push(0);
    output
}

fn identity_hash(material: &[u8]) -> Result<Digest32, ErrorCode> {
    sha256_bytes(material)
}

fn push_count(output: &mut Vec<u8>, count: usize) -> Result<(), ErrorCode> {
    push_u32(
        output,
        u32::try_from(count).map_err(|_| ErrorCode::InvalidLength)?,
    );
    Ok(())
}

fn push_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn push_u64(output: &mut Vec<u8>, value: u64) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn require_positive_bytes(bytes: u64) -> Result<(), ErrorCode> {
    if bytes == 0 {
        Err(ErrorCode::InvalidLength)
    } else {
        Ok(())
    }
}

fn require_digest(digest: Digest32) -> Result<(), ErrorCode> {
    if digest == [0; 32] {
        Err(ErrorCode::InvalidHeader)
    } else {
        Ok(())
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn digest(byte: u8) -> Digest32 {
        [byte; 32]
    }

    fn bindings() -> ExecutionBindings {
        ExecutionBindings::new(
            digest(0x22),
            digest(0x33),
            digest(0x44),
            digest(0x55),
            digest(0x66),
        )
        .unwrap()
    }

    fn model() -> StandaloneModelIdentity {
        StandaloneModelIdentity::new(1024, digest(0x11), bindings()).unwrap()
    }

    fn adapter(
        base: &StandaloneModelIdentity,
        byte: u8,
        semantics: CompositionSemantics,
    ) -> BaseDependentAdapterIdentity {
        BaseDependentAdapterIdentity::new(128, digest(byte), base, semantics).unwrap()
    }

    #[test]
    fn full_hash_display_identity_parsing_is_exact_and_typed() {
        let original = model().id();
        let display = original.display();
        assert_eq!(ContentId::parse_display(&display).unwrap(), original);
        assert_eq!(
            ContentId::parse_display(
                "route-sha256-1111111111111111111111111111111111111111111111111111111111111111"
            )
            .unwrap()
            .kind(),
            ArtifactKind::RoutePolicy
        );
        for invalid in [
            "",
            "model-sha256-",
            "model-sha256-11",
            "model-sha256-111111111111111111111111111111111111111111111111111111111111111g",
            "model-sha256-111111111111111111111111111111111111111111111111111111111111111A",
            "model-sha256-0000000000000000000000000000000000000000000000000000000000000000",
            "unknown-sha256-1111111111111111111111111111111111111111111111111111111111111111",
            " model-sha256-1111111111111111111111111111111111111111111111111111111111111111",
        ] {
            assert_eq!(
                ContentId::parse_display(invalid).unwrap_err(),
                ErrorCode::InvalidHeader
            );
        }
    }

    #[test]
    fn frozen_cross_language_identity_vectors_match() {
        let base = model();
        assert_eq!(base.model_sha256(), digest(0x11));
        assert_eq!(base.execution_bindings().tokenizer_sha256(), digest(0x22));
        assert_eq!(
            base.execution_bindings().chat_template_sha256(),
            digest(0x33)
        );
        assert_eq!(
            base.execution_bindings().tensor_layout_sha256(),
            digest(0x44)
        );
        assert_eq!(
            base.execution_bindings().quantization_profile_sha256(),
            digest(0x55)
        );
        assert_eq!(
            base.execution_bindings().execution_profile_sha256(),
            digest(0x66)
        );
        assert_eq!(
            hex(&base.id.digest),
            "83d45410e3001af2e476fe0ec9e3b24ce25da89ff764984bf8113d17c6e70712"
        );
        let delta = adapter(&base, 0x77, CompositionSemantics::Additive);
        assert_eq!(
            hex(&delta.id.digest),
            "0d36e52ccbfa3d41b4186d1a3a2d9adeda28f41a0ae40d7fc184763fd20ac9f6"
        );
        let champion =
            CompositionIdentity::new(&base, CompositionSemantics::BaseOnly, vec![]).unwrap();
        let specialist = CompositionIdentity::new(
            &base,
            CompositionSemantics::Additive,
            vec![CompositionMember::new(delta.clone(), vec![])],
        )
        .unwrap();
        assert_eq!(
            hex(&champion.id.digest),
            "217a076597ef9e5ecbd5c7152cf20b5d4158db4b0faadf9ac4e3cef42ab9bb59"
        );
        assert_eq!(
            hex(&specialist.id.digest),
            "c7a1d4b8586cee3f9d8d284dd7bbc5f555bc8be620a766f5120dcfbfb7d41e20"
        );

        let chunk_one = SharedChunkIdentity::new(512, digest(0x88)).unwrap();
        let chunk_two = SharedChunkIdentity::new(512, digest(0x99)).unwrap();
        assert_eq!(
            hex(&chunk_one.id.digest),
            "f79a22b124d46f5d8516b581d3bb84a5d9e652a6002ff47c03d482b19309f3a6"
        );
        assert_eq!(
            hex(&chunk_two.id.digest),
            "46432c105cdeab0fdc64bbdddf32aee4132a6ebefd166f9f481ea81fa2c0eba0"
        );
        let layout = StorageLayoutIdentity::new(&base, vec![chunk_one, chunk_two]).unwrap();
        assert_eq!(
            hex(&layout.digest),
            "210193d2db2f3bf84dce1d7390ab8be25e92d3a4b518ede1ac5bb9498f662db9"
        );

        let kv_format = KvFormatIdentity::new(64, digest(0xaa)).unwrap();
        assert_eq!(
            hex(&kv_format.id.digest),
            "8108d7a2bda41c88d3e541f47b17be789462b7360c391a7ebbe9264408322430"
        );
        let retrieval = RetrievalIndexIdentity::new(
            256,
            digest(0xbb),
            &base,
            digest(0xcc),
            64,
            RetrievalMetric::Cosine,
        )
        .unwrap();
        assert_eq!(
            hex(&retrieval.id.digest),
            "b5b59c101fd6ce1245c94043665db7616c217359208e99a1461a5906ed899a59"
        );
        let route = RoutePolicyIdentity::new(
            96,
            digest(0xdd),
            &champion,
            std::slice::from_ref(&specialist),
            &[retrieval.id],
        )
        .unwrap();
        assert_eq!(
            hex(&route.id.digest),
            "f33ccf5198a97517a07bc68408aa7784bdefe5d779532f4ffedd612ae08dccfe"
        );
        assert_eq!(
            hex(&kv_cache_key(&specialist, digest(0x11), &kv_format, digest(0x44)).unwrap()),
            "be74ec931c3fa92500ba6f292d046789c61324ce712636476a45aec9758d0f51"
        );
    }

    #[test]
    fn typed_displays_and_required_digests_are_fail_closed() {
        let base = model();
        assert_eq!(base.id.kind(), ArtifactKind::StandaloneModel);
        assert_eq!(
            base.id.display(),
            "model-sha256-83d45410e3001af2e476fe0ec9e3b24ce25da89ff764984bf8113d17c6e70712"
        );
        assert_eq!(
            StandaloneModelIdentity::new(0, digest(0x11), bindings()),
            Err(ErrorCode::InvalidLength)
        );
        assert_eq!(
            ExecutionBindings::new(
                [0; 32],
                digest(0x33),
                digest(0x44),
                digest(0x55),
                digest(0x66)
            ),
            Err(ErrorCode::InvalidHeader)
        );
    }

    #[test]
    fn additive_order_commutes_but_sequential_order_is_material() {
        let base = model();
        let left = adapter(&base, 0x70, CompositionSemantics::Additive);
        let right = adapter(&base, 0x71, CompositionSemantics::Additive);
        let first = CompositionIdentity::new(
            &base,
            CompositionSemantics::Additive,
            vec![
                CompositionMember::new(left.clone(), vec![]),
                CompositionMember::new(right.clone(), vec![]),
            ],
        )
        .unwrap();
        let second = CompositionIdentity::new(
            &base,
            CompositionSemantics::Additive,
            vec![
                CompositionMember::new(right, vec![]),
                CompositionMember::new(left, vec![]),
            ],
        )
        .unwrap();
        assert_eq!(first.id, second.id);

        let left = adapter(&base, 0x70, CompositionSemantics::Sequential);
        let right = adapter(&base, 0x71, CompositionSemantics::Sequential);
        let first = CompositionIdentity::new(
            &base,
            CompositionSemantics::Sequential,
            vec![
                CompositionMember::new(left.clone(), vec![]),
                CompositionMember::new(right.clone(), vec![]),
            ],
        )
        .unwrap();
        let second = CompositionIdentity::new(
            &base,
            CompositionSemantics::Sequential,
            vec![
                CompositionMember::new(right, vec![]),
                CompositionMember::new(left, vec![]),
            ],
        )
        .unwrap();
        assert_ne!(first.id, second.id);
    }

    #[test]
    fn member_count_binding_and_duplicate_rules_reject() {
        let base = model();
        let additive = adapter(&base, 0x70, CompositionSemantics::Additive);
        let repeated = CompositionMember::new(additive.clone(), vec![]);
        assert_eq!(
            CompositionIdentity::new(
                &base,
                CompositionSemantics::Additive,
                vec![repeated; MAX_IDENTITY_MEMBERS + 1]
            ),
            Err(ErrorCode::InvalidLength)
        );
        assert_eq!(
            CompositionIdentity::new(
                &base,
                CompositionSemantics::BaseOnly,
                vec![CompositionMember::new(additive.clone(), vec![])]
            ),
            Err(ErrorCode::ShapeMismatch)
        );
        assert_eq!(
            CompositionIdentity::new(&base, CompositionSemantics::Replacement, vec![]),
            Err(ErrorCode::ShapeMismatch)
        );
        assert_eq!(
            CompositionIdentity::new(
                &base,
                CompositionSemantics::Additive,
                vec![
                    CompositionMember::new(additive.clone(), vec![]),
                    CompositionMember::new(additive, vec![])
                ]
            ),
            Err(ErrorCode::InvalidHeader)
        );

        let other = StandaloneModelIdentity::new(1024, digest(0x12), bindings()).unwrap();
        let wrong_base = adapter(&other, 0x73, CompositionSemantics::Additive);
        assert_eq!(
            CompositionIdentity::new(
                &base,
                CompositionSemantics::Additive,
                vec![CompositionMember::new(wrong_base, vec![])]
            ),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    #[test]
    fn dependent_graph_requires_sorted_earlier_adapter_ids() {
        let base = model();
        let first = adapter(&base, 0x70, CompositionSemantics::Dependent);
        let second = adapter(&base, 0x71, CompositionSemantics::Dependent);
        CompositionIdentity::new(
            &base,
            CompositionSemantics::Dependent,
            vec![
                CompositionMember::new(first.clone(), vec![]),
                CompositionMember::new(second.clone(), vec![first.id]),
            ],
        )
        .unwrap();
        assert_eq!(
            CompositionIdentity::new(
                &base,
                CompositionSemantics::Dependent,
                vec![
                    CompositionMember::new(first, vec![second.id]),
                    CompositionMember::new(second, vec![])
                ]
            ),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    #[test]
    fn storage_layout_verifies_chunks_and_full_reconstruction() {
        let left = vec![0x41; 512];
        let right = vec![0x42; 512];
        let mut whole = left.clone();
        whole.extend_from_slice(&right);
        let target = StandaloneModelIdentity::new(
            whole.len() as u64,
            sha256_bytes(&whole).unwrap(),
            bindings(),
        )
        .unwrap();
        let left_id =
            SharedChunkIdentity::new(left.len() as u64, sha256_bytes(&left).unwrap()).unwrap();
        let right_id =
            SharedChunkIdentity::new(right.len() as u64, sha256_bytes(&right).unwrap()).unwrap();
        let layout = StorageLayoutIdentity::new(&target, vec![left_id.clone(), right_id]).unwrap();
        layout.verify_reconstruction(&[&left, &right]).unwrap();

        let mut changed = right.clone();
        changed[0] ^= 1;
        assert_eq!(
            layout.verify_reconstruction(&[&left, &changed]),
            Err(ErrorCode::InvalidHeader)
        );
        assert_eq!(
            StorageLayoutIdentity::new(&target, vec![left_id.clone(), left_id]),
            Err(ErrorCode::InvalidHeader)
        );
    }

    #[test]
    fn route_and_kv_identities_reject_wrong_roles() {
        let base = model();
        let champion =
            CompositionIdentity::new(&base, CompositionSemantics::BaseOnly, vec![]).unwrap();
        let delta = adapter(&base, 0x77, CompositionSemantics::Additive);
        let specialist = CompositionIdentity::new(
            &base,
            CompositionSemantics::Additive,
            vec![CompositionMember::new(delta, vec![])],
        )
        .unwrap();
        assert_eq!(
            RoutePolicyIdentity::new(
                96,
                digest(0xdd),
                &champion,
                std::slice::from_ref(&specialist),
                &[specialist.id]
            ),
            Err(ErrorCode::ShapeMismatch)
        );
        assert_eq!(
            RoutePolicyIdentity::new(
                96,
                digest(0xdd),
                &specialist,
                std::slice::from_ref(&champion),
                &[]
            ),
            Err(ErrorCode::InvalidHeader)
        );
        assert_eq!(
            kv_cache_key(
                &specialist,
                [0; 32],
                &KvFormatIdentity::new(64, digest(0xaa)).unwrap(),
                digest(0x44)
            ),
            Err(ErrorCode::InvalidHeader)
        );
    }

    #[test]
    fn byte_accounting_keeps_logical_physical_and_runtime_fields_separate() {
        let base = model();
        let delta = adapter(&base, 0x77, CompositionSemantics::Additive);
        let active = CompositionIdentity::new(
            &base,
            CompositionSemantics::Additive,
            vec![CompositionMember::new(delta.clone(), vec![])],
        )
        .unwrap();
        let route = RoutePolicyIdentity {
            id: ContentId::new(ArtifactKind::RoutePolicy, digest(0x91)),
            policy_bytes: 96,
        };
        let retrieval = RetrievalIndexIdentity {
            id: ContentId::new(ArtifactKind::RetrievalIndex, digest(0x92)),
            index_bytes: 256,
        };
        let kv_format = KvFormatIdentity::new(64, digest(0xaa)).unwrap();
        let mut physical = PhysicalPortfolio::new();
        physical.add_standalone(&base).unwrap();
        physical.add_adapter(&delta).unwrap();
        physical.add_route_policy(&route).unwrap();
        physical.add_retrieval_index(&retrieval).unwrap();
        physical.add_kv_format(&kv_format).unwrap();
        let accounting = physical
            .account(
                &active,
                RuntimeMemoryBytes {
                    kv_allocated_bytes: 4096,
                    kv_committed_bytes: 2048,
                    kv_peak_bytes: 8192,
                    activation_scratch_bytes: 512,
                    decoded_temporary_bytes: 256,
                    peak_resident_bytes: 16384,
                },
            )
            .unwrap();
        assert_eq!(accounting.standalone_artifact_bytes, 1024);
        assert_eq!(accounting.logical_composition_bytes, 1152);
        assert_eq!(accounting.incremental_specialist_bytes, 128);
        assert_eq!(accounting.physical_portfolio_bytes, 1568);
        assert_eq!(accounting.route_policy_bytes, 96);
        assert_eq!(accounting.retrieval_index_bytes, 256);
        assert_eq!(accounting.kv_format_descriptor_bytes, 64);
        assert_eq!(
            RuntimeMemoryBytes {
                kv_allocated_bytes: 10,
                kv_committed_bytes: 11,
                kv_peak_bytes: 12,
                activation_scratch_bytes: 0,
                decoded_temporary_bytes: 0,
                peak_resident_bytes: 20,
            }
            .validate(),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    #[test]
    fn physical_accounting_requires_base_and_adapter_coverage() {
        let base = model();
        let delta = adapter(&base, 0x77, CompositionSemantics::Additive);
        let active = CompositionIdentity::new(
            &base,
            CompositionSemantics::Additive,
            vec![CompositionMember::new(delta.clone(), vec![])],
        )
        .unwrap();
        let runtime = RuntimeMemoryBytes {
            kv_allocated_bytes: 0,
            kv_committed_bytes: 0,
            kv_peak_bytes: 0,
            activation_scratch_bytes: 0,
            decoded_temporary_bytes: 0,
            peak_resident_bytes: 0,
        };
        let mut physical = PhysicalPortfolio::new();
        physical.add_standalone(&base).unwrap();
        assert_eq!(
            physical.account(&active, runtime),
            Err(ErrorCode::MissingTensor)
        );
        physical.add_adapter(&delta).unwrap();
        physical.account(&active, runtime).unwrap();
    }
}
