//! Immutable `ACG1` composition graphs and composition-bound runtime identities.

use crate::artifact_digest::sha256_bytes;
use crate::content_identity::{
    ArtifactKind, BaseDependentAdapterIdentity, CompositionIdentity, CompositionMember,
    CompositionSemantics, ContentId, Digest32, ExecutionBindings, KvFormatIdentity,
    StandaloneModelIdentity,
};
use crate::errors::ErrorCode;
use crate::model::Model;
use crate::model_format::TensorEntry;
use crate::specialist_overlay::{SpecialistOverlay, SpecialistOverlayBase};
use std::convert::TryInto;

const MAGIC: [u8; 4] = *b"ACG1";
const VERSION: u32 = 1;
const HEADER_BYTES: usize = 512;
const MEMBER_BYTES: usize = 128;
const ALIGNMENT: usize = 64;
/// Maximum number of canonical specialist members in one active composition.
pub const MAX_COMPOSITION_MEMBERS: usize = 64;
const MAX_BUNDLE_BYTES: usize = 512 * 1024 * 1024;
const CONTENT_VERSION: u32 = 1;
const ACTIVE_GRAPH_DOMAIN: &str = "tinyrustlm.runtime.active-composition.v1";
const PROMPT_TOKEN_DOMAIN: &str = "tinyrustlm.content.prompt-token-sequence.v1";

/// Exact runtime KV storage interpretation admitted by `ACG1`.
pub const KV_FORMAT_DESCRIPTOR: &[u8] = b"tinyrustlm.kv-format.f32-layer-major.v1\n\
keys=f32-le\n\
values=f32-le\n\
layout=layer-position-head-dimension\n\
commit=all-layers-per-position\n";

/// Exact position and prefix-reuse interpretation admitted by `ACG1`.
pub const POSITION_POLICY_DESCRIPTOR: &[u8] =
    b"tinyrustlm.position-policy.absolute-rope-no-window.v1\n\
origin=zero\n\
reuse=exact-prefix\n";

const KV_FORMAT_SHA256: Digest32 = [
    0xf6, 0xe3, 0xf0, 0xa2, 0xf5, 0x8a, 0x5b, 0x39, 0x22, 0x0f, 0xcc, 0x0d, 0x55, 0xa5, 0x23, 0xe5,
    0x76, 0xb7, 0x78, 0x8f, 0x14, 0xd3, 0x42, 0x76, 0xb4, 0x32, 0x88, 0x50, 0xe3, 0x9f, 0x1c, 0xb5,
];
const POSITION_POLICY_SHA256: Digest32 = [
    0x8b, 0x91, 0x13, 0x62, 0x7c, 0x9f, 0x0f, 0xfa, 0xb6, 0xfd, 0x33, 0xad, 0x10, 0x97, 0x66, 0xc5,
    0xd8, 0xbb, 0x19, 0x8b, 0xe5, 0xd8, 0xa0, 0xda, 0x5b, 0xcc, 0x40, 0x12, 0x09, 0xf9, 0x44, 0xaa,
];

/// Borrowed arguments for one active-composition matrix-vector product.
pub(crate) struct CompositionMatvec<'a> {
    pub(crate) tensor_index: usize,
    pub(crate) rows: usize,
    pub(crate) cols: usize,
    pub(crate) vector: &'a [f32],
    pub(crate) output: &'a mut [f32],
    pub(crate) scratch: &'a mut [f32],
}

/// One completely validated immutable active composition graph.
#[derive(Debug)]
pub struct ActiveComposition {
    bundle_sha256: Digest32,
    base: StandaloneModelIdentity,
    composition: CompositionIdentity,
    route_policy_id: ContentId,
    kv_format: KvFormatIdentity,
    position_policy_sha256: Digest32,
    active_graph_digest: Digest32,
    overlays: Vec<SpecialistOverlay>,
    maximum_factor_rank: usize,
}

/// Canonical bytes and identities for one newly authored `ACG1` bundle.
#[derive(Debug)]
pub struct ActiveCompositionBundle {
    bytes: Vec<u8>,
    sha256: Digest32,
    composition_id: ContentId,
    active_graph_digest: Digest32,
}

impl ActiveCompositionBundle {
    /// Builds and independently reparses one canonical base-only or additive bundle.
    ///
    /// The route-policy identity is admitted control-plane input. This operation
    /// validates its type but does not claim that the corresponding route policy
    /// was reviewed, signed, or approved.
    pub fn build(
        model: &Model,
        bindings: ExecutionBindings,
        route_policy_id: ContentId,
        packages: &[&[u8]],
    ) -> Result<Self, ErrorCode> {
        validate_runtime_descriptors()?;
        if route_policy_id.kind() != ArtifactKind::RoutePolicy
            || packages.len() > MAX_COMPOSITION_MEMBERS
        {
            return Err(ErrorCode::InvalidHeader);
        }

        let base =
            StandaloneModelIdentity::new(model.model_bytes(), model.model_sha256(), bindings)?;
        let overlay_base = SpecialistOverlayBase::from_identity(&base);
        let mut package_values = Vec::new();
        package_values
            .try_reserve_exact(packages.len())
            .map_err(|_| ErrorCode::InvalidLength)?;
        for package in packages {
            let package_bytes =
                u64::try_from(package.len()).map_err(|_| ErrorCode::InvalidLength)?;
            let package_sha256 = sha256_bytes(package)?;
            let overlay = SpecialistOverlay::parse(
                package,
                package_sha256,
                overlay_base,
                &model.parsed().tensors,
            )?;
            let adapter = BaseDependentAdapterIdentity::new(
                package_bytes,
                package_sha256,
                &base,
                CompositionSemantics::Additive,
            )?;
            package_values.push(BundlePackage {
                adapter,
                package_sha256,
                bytes: package,
                target_count: u32::try_from(overlay.target_count())
                    .map_err(|_| ErrorCode::InvalidLength)?,
                maximum_factor_rank: u32::try_from(overlay.maximum_factor_rank())
                    .map_err(|_| ErrorCode::InvalidLength)?,
            });
        }
        package_values.sort_by_key(|value| value.adapter.id());
        if package_values
            .windows(2)
            .any(|window| window[0].adapter.id() == window[1].adapter.id())
        {
            return Err(ErrorCode::InvalidHeader);
        }

        let semantics = if package_values.is_empty() {
            CompositionSemantics::BaseOnly
        } else {
            CompositionSemantics::Additive
        };
        let members = package_values
            .iter()
            .map(|value| CompositionMember::new(value.adapter.clone(), Vec::new()))
            .collect();
        let composition = CompositionIdentity::new(&base, semantics, members)?;
        let kv_format = runtime_kv_format()?;
        let graph_digest = active_graph_digest(
            composition.id(),
            route_policy_id,
            kv_format.id(),
            POSITION_POLICY_SHA256,
        )?;
        let payload_offset = HEADER_BYTES
            .checked_add(
                package_values
                    .len()
                    .checked_mul(MEMBER_BYTES)
                    .ok_or(ErrorCode::InvalidLength)?,
            )
            .ok_or(ErrorCode::InvalidLength)?;
        let total_bytes = package_values
            .iter()
            .try_fold(payload_offset, |total, value| {
                total
                    .checked_add(value.bytes.len())
                    .ok_or(ErrorCode::InvalidLength)
            })?;
        if total_bytes > MAX_BUNDLE_BYTES || !total_bytes.is_multiple_of(ALIGNMENT) {
            return Err(ErrorCode::InvalidLength);
        }
        let mut bytes = Vec::new();
        bytes
            .try_reserve_exact(total_bytes)
            .map_err(|_| ErrorCode::InvalidLength)?;
        bytes.resize(total_bytes, 0);

        bytes[0..4].copy_from_slice(&MAGIC);
        write_u32(&mut bytes, 4, VERSION)?;
        write_u32(
            &mut bytes,
            8,
            u32::try_from(HEADER_BYTES).map_err(|_| ErrorCode::InvalidLength)?,
        )?;
        write_u32(&mut bytes, 16, semantics as u32)?;
        write_u32(
            &mut bytes,
            20,
            u32::try_from(package_values.len()).map_err(|_| ErrorCode::InvalidLength)?,
        )?;
        write_u32(
            &mut bytes,
            24,
            u32::try_from(MEMBER_BYTES).map_err(|_| ErrorCode::InvalidLength)?,
        )?;
        write_u64(
            &mut bytes,
            32,
            u64::try_from(HEADER_BYTES).map_err(|_| ErrorCode::InvalidLength)?,
        )?;
        write_u64(
            &mut bytes,
            40,
            u64::try_from(payload_offset).map_err(|_| ErrorCode::InvalidLength)?,
        )?;
        write_u64(
            &mut bytes,
            48,
            u64::try_from(total_bytes).map_err(|_| ErrorCode::InvalidLength)?,
        )?;
        write_u64(&mut bytes, 56, model.model_bytes())?;
        bytes[64..96].copy_from_slice(&model.model_sha256());
        write_padded_id(&mut bytes, 96, base.id())?;
        for (offset, digest) in [
            (136, bindings.tokenizer_sha256()),
            (168, bindings.chat_template_sha256()),
            (200, bindings.tensor_layout_sha256()),
            (232, bindings.quantization_profile_sha256()),
            (264, bindings.execution_profile_sha256()),
        ] {
            bytes[offset..offset + 32].copy_from_slice(&digest);
        }
        write_padded_id(&mut bytes, 296, composition.id())?;
        write_padded_id(&mut bytes, 336, route_policy_id)?;
        write_padded_id(&mut bytes, 376, kv_format.id())?;
        bytes[416..448].copy_from_slice(&POSITION_POLICY_SHA256);
        write_u64(&mut bytes, 448, composition.incremental_specialist_bytes()?)?;
        write_u64(&mut bytes, 456, composition.logical_bytes()?)?;
        bytes[464..496].copy_from_slice(&graph_digest);

        let mut package_offset = payload_offset;
        for (index, value) in package_values.iter().enumerate() {
            let entry = HEADER_BYTES
                .checked_add(
                    index
                        .checked_mul(MEMBER_BYTES)
                        .ok_or(ErrorCode::InvalidLength)?,
                )
                .ok_or(ErrorCode::InvalidLength)?;
            write_padded_id(&mut bytes, entry, value.adapter.id())?;
            bytes[entry + 40..entry + 72].copy_from_slice(&value.package_sha256);
            write_u64(
                &mut bytes,
                entry + 72,
                u64::try_from(package_offset).map_err(|_| ErrorCode::InvalidLength)?,
            )?;
            write_u64(
                &mut bytes,
                entry + 80,
                u64::try_from(value.bytes.len()).map_err(|_| ErrorCode::InvalidLength)?,
            )?;
            write_u32(&mut bytes, entry + 88, value.target_count)?;
            write_u32(&mut bytes, entry + 92, value.maximum_factor_rank)?;
            let package_end = package_offset
                .checked_add(value.bytes.len())
                .ok_or(ErrorCode::InvalidLength)?;
            bytes
                .get_mut(package_offset..package_end)
                .ok_or(ErrorCode::InvalidLength)?
                .copy_from_slice(value.bytes);
            package_offset = package_end;
        }
        if package_offset != bytes.len() {
            return Err(ErrorCode::InvalidLength);
        }

        let sha256 = sha256_bytes(&bytes)?;
        let parsed = ActiveComposition::parse(&bytes, sha256, model)?;
        if parsed.composition().id() != composition.id()
            || parsed.route_policy_id() != route_policy_id
            || parsed.active_graph_digest() != graph_digest
        {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(Self {
            bytes,
            sha256,
            composition_id: composition.id(),
            active_graph_digest: graph_digest,
        })
    }

    /// Returns every exact canonical bundle byte.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Consumes the bundle and returns every exact canonical byte.
    pub fn into_bytes(self) -> Vec<u8> {
        self.bytes
    }

    /// Returns the SHA-256 over every exact bundle byte.
    pub fn sha256(&self) -> Digest32 {
        self.sha256
    }

    /// Returns the typed immutable composition identity.
    pub fn composition_id(&self) -> ContentId {
        self.composition_id
    }

    /// Returns the graph digest that owns all KV-cache state.
    pub fn active_graph_digest(&self) -> Digest32 {
        self.active_graph_digest
    }
}

struct BundlePackage<'a> {
    adapter: BaseDependentAdapterIdentity,
    package_sha256: Digest32,
    bytes: &'a [u8],
    target_count: u32,
    maximum_factor_rank: u32,
}

impl ActiveComposition {
    /// Parses one canonical graph against an already loaded immutable model.
    pub fn parse(
        bytes: &[u8],
        expected_bundle_sha256: Digest32,
        model: &Model,
    ) -> Result<Self, ErrorCode> {
        let binding = ModelBinding {
            model_bytes: model.model_bytes(),
            model_sha256: model.model_sha256(),
            tensors: &model.parsed().tensors,
        };
        Self::parse_for_binding(bytes, expected_bundle_sha256, binding)
    }

    fn parse_for_binding(
        bytes: &[u8],
        expected_bundle_sha256: Digest32,
        model: ModelBinding<'_>,
    ) -> Result<Self, ErrorCode> {
        validate_runtime_descriptors()?;
        validate_envelope(bytes, expected_bundle_sha256)?;

        let semantics = match read_u32(bytes, 16)? {
            0 => CompositionSemantics::BaseOnly,
            1 => CompositionSemantics::Additive,
            _ => return Err(ErrorCode::InvalidHeader),
        };
        let member_count =
            usize::try_from(read_u32(bytes, 20)?).map_err(|_| ErrorCode::InvalidLength)?;
        if (semantics == CompositionSemantics::BaseOnly && member_count != 0)
            || (semantics == CompositionSemantics::Additive
                && (member_count == 0 || member_count > MAX_COMPOSITION_MEMBERS))
        {
            return Err(ErrorCode::InvalidHeader);
        }
        let payload_offset = HEADER_BYTES
            .checked_add(
                member_count
                    .checked_mul(MEMBER_BYTES)
                    .ok_or(ErrorCode::InvalidLength)?,
            )
            .ok_or(ErrorCode::InvalidLength)?;
        if read_usize_u64(bytes, 32)? != HEADER_BYTES
            || read_usize_u64(bytes, 40)? != payload_offset
            || read_usize_u64(bytes, 48)? != bytes.len()
        {
            return Err(ErrorCode::InvalidTensorDirectory);
        }

        if read_u64(bytes, 56)? != model.model_bytes
            || read_digest(bytes, 64)? != model.model_sha256
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        let declared_base_id = read_padded_id(bytes, 96, 1)?;
        let bindings = ExecutionBindings::new(
            read_digest(bytes, 136)?,
            read_digest(bytes, 168)?,
            read_digest(bytes, 200)?,
            read_digest(bytes, 232)?,
            read_digest(bytes, 264)?,
        )?;
        let base = StandaloneModelIdentity::new(model.model_bytes, model.model_sha256, bindings)?;
        if declared_base_id != base.id() {
            return Err(ErrorCode::InvalidHeader);
        }

        let declared_composition_id = read_padded_id(bytes, 296, 3)?;
        let route_policy_id = read_padded_id(bytes, 336, 5)?;
        let declared_kv_format_id = read_padded_id(bytes, 376, 6)?;
        let kv_format = runtime_kv_format()?;
        if declared_kv_format_id != kv_format.id()
            || read_digest(bytes, 416)? != POSITION_POLICY_SHA256
        {
            return Err(ErrorCode::InvalidHeader);
        }

        let overlay_base = SpecialistOverlayBase::from_identity(&base);
        let mut overlays = Vec::new();
        overlays
            .try_reserve_exact(member_count)
            .map_err(|_| ErrorCode::InvalidLength)?;
        let mut members = Vec::new();
        members
            .try_reserve_exact(member_count)
            .map_err(|_| ErrorCode::InvalidLength)?;
        let mut prior_member_id = None;
        let mut expected_package_offset = payload_offset;
        let mut incremental_specialist_bytes = 0u64;
        let mut maximum_factor_rank = 0usize;

        for member_index in 0..member_count {
            let entry_offset = HEADER_BYTES
                .checked_add(
                    member_index
                        .checked_mul(MEMBER_BYTES)
                        .ok_or(ErrorCode::InvalidLength)?,
                )
                .ok_or(ErrorCode::InvalidLength)?;
            let declared_adapter_id = read_padded_id(bytes, entry_offset, 2)?;
            if prior_member_id.is_some_and(|prior| prior >= declared_adapter_id) {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            prior_member_id = Some(declared_adapter_id);
            let package_sha256 = read_digest(bytes, entry_offset + 40)?;
            let package_offset = read_usize_u64(bytes, entry_offset + 72)?;
            let package_bytes = read_usize_u64(bytes, entry_offset + 80)?;
            if package_offset != expected_package_offset
                || package_bytes == 0
                || !package_bytes.is_multiple_of(ALIGNMENT)
            {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            let package_end = package_offset
                .checked_add(package_bytes)
                .filter(|end| *end <= bytes.len())
                .ok_or(ErrorCode::InvalidTensorDirectory)?;
            require_zero(bytes, entry_offset + 96, entry_offset + MEMBER_BYTES)?;
            let package = bytes
                .get(package_offset..package_end)
                .ok_or(ErrorCode::InvalidTensorDirectory)?;
            if sha256_bytes(package)? != package_sha256 {
                return Err(ErrorCode::InvalidHeader);
            }
            let overlay =
                SpecialistOverlay::parse(package, package_sha256, overlay_base, model.tensors)?;
            if usize::try_from(read_u32(bytes, entry_offset + 88)?)
                .map_err(|_| ErrorCode::InvalidLength)?
                != overlay.target_count()
                || usize::try_from(read_u32(bytes, entry_offset + 92)?)
                    .map_err(|_| ErrorCode::InvalidLength)?
                    != overlay.maximum_factor_rank()
            {
                return Err(ErrorCode::InvalidHeader);
            }
            let adapter = BaseDependentAdapterIdentity::new(
                u64::try_from(package_bytes).map_err(|_| ErrorCode::InvalidLength)?,
                package_sha256,
                &base,
                CompositionSemantics::Additive,
            )?;
            if adapter.id() != declared_adapter_id {
                return Err(ErrorCode::InvalidHeader);
            }
            incremental_specialist_bytes = incremental_specialist_bytes
                .checked_add(adapter.adapter_bytes())
                .ok_or(ErrorCode::InvalidLength)?;
            maximum_factor_rank = maximum_factor_rank.max(overlay.maximum_factor_rank());
            members.push(CompositionMember::new(adapter, Vec::new()));
            overlays.push(overlay);
            expected_package_offset = package_end;
        }
        if expected_package_offset != bytes.len() {
            return Err(ErrorCode::InvalidTensorDirectory);
        }

        let composition = CompositionIdentity::new(&base, semantics, members)?;
        if composition.id() != declared_composition_id
            || composition.incremental_specialist_bytes()? != incremental_specialist_bytes
            || read_u64(bytes, 448)? != incremental_specialist_bytes
            || read_u64(bytes, 456)? != composition.logical_bytes()?
        {
            return Err(ErrorCode::InvalidHeader);
        }
        let graph_digest = active_graph_digest(
            composition.id(),
            route_policy_id,
            kv_format.id(),
            POSITION_POLICY_SHA256,
        )?;
        if read_digest(bytes, 464)? != graph_digest {
            return Err(ErrorCode::InvalidHeader);
        }

        Ok(Self {
            bundle_sha256: expected_bundle_sha256,
            base,
            composition,
            route_policy_id,
            kv_format,
            position_policy_sha256: POSITION_POLICY_SHA256,
            active_graph_digest: graph_digest,
            overlays,
            maximum_factor_rank,
        })
    }

    /// Returns the SHA-256 of every exact canonical `ACG1` byte.
    pub fn bundle_sha256(&self) -> Digest32 {
        self.bundle_sha256
    }

    /// Returns the exact standalone model identity.
    pub fn base(&self) -> &StandaloneModelIdentity {
        &self.base
    }

    /// Returns the exact immutable composition identity.
    pub fn composition(&self) -> &CompositionIdentity {
        &self.composition
    }

    /// Returns the externally admitted route-policy identity.
    pub fn route_policy_id(&self) -> ContentId {
        self.route_policy_id
    }

    /// Returns the exact runtime KV-format identity.
    pub fn kv_format(&self) -> &KvFormatIdentity {
        &self.kv_format
    }

    /// Returns the runtime position-policy digest.
    pub fn position_policy_sha256(&self) -> Digest32 {
        self.position_policy_sha256
    }

    /// Returns the digest that owns every cache position for this graph.
    pub fn active_graph_digest(&self) -> Digest32 {
        self.active_graph_digest
    }

    /// Returns the number of canonical additive members.
    pub fn member_count(&self) -> usize {
        self.overlays.len()
    }

    /// Returns the largest caller-owned f32 scratch length needed by a matvec.
    pub fn maximum_factor_rank(&self) -> usize {
        self.maximum_factor_rank
    }

    /// Builds the full composition-bound KV key for exact retained tokens.
    pub fn kv_cache_key(&self, retained_tokens: &[u32]) -> Result<Digest32, ErrorCode> {
        let prompt_sha256 = prompt_token_sequence_digest(retained_tokens)?;
        crate::content_identity::kv_cache_key(
            &self.composition,
            self.position_policy_sha256,
            &self.kv_format,
            prompt_sha256,
        )
    }

    pub(crate) fn matvec(
        &self,
        model: &Model,
        operation: CompositionMatvec<'_>,
    ) -> Result<(), ErrorCode> {
        if model.model_sha256() != self.base.model_sha256()
            || model.model_bytes() != self.base.model_bytes()
            || operation.scratch.len() < self.maximum_factor_rank
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        for overlay in &self.overlays {
            overlay.validate_apply(
                operation.tensor_index,
                operation.rows,
                operation.cols,
                operation.vector,
                operation.output,
                operation.scratch,
            )?;
        }
        model.matvec_by_index(
            operation.tensor_index,
            operation.rows,
            operation.cols,
            operation.vector,
            operation.output,
        )?;
        for overlay in &self.overlays {
            overlay.add_to_output(
                operation.tensor_index,
                operation.vector,
                operation.output,
                operation.scratch,
            )?;
        }
        Ok(())
    }
}

#[derive(Clone, Copy)]
struct ModelBinding<'a> {
    model_bytes: u64,
    model_sha256: Digest32,
    tensors: &'a [TensorEntry],
}

/// Computes the exact prompt-token sequence digest used by KV identities.
pub fn prompt_token_sequence_digest(tokens: &[u32]) -> Result<Digest32, ErrorCode> {
    let mut material = domain_material(PROMPT_TOKEN_DOMAIN);
    material.extend_from_slice(&CONTENT_VERSION.to_le_bytes());
    material.extend_from_slice(
        &u32::try_from(tokens.len())
            .map_err(|_| ErrorCode::InvalidLength)?
            .to_le_bytes(),
    );
    material
        .try_reserve(
            tokens
                .len()
                .checked_mul(core::mem::size_of::<u32>())
                .ok_or(ErrorCode::InvalidLength)?,
        )
        .map_err(|_| ErrorCode::InvalidLength)?;
    for token in tokens {
        material.extend_from_slice(&token.to_le_bytes());
    }
    sha256_bytes(&material)
}

fn active_graph_digest(
    composition_id: ContentId,
    route_policy_id: ContentId,
    kv_format_id: ContentId,
    position_policy_sha256: Digest32,
) -> Result<Digest32, ErrorCode> {
    let mut material = domain_material(ACTIVE_GRAPH_DOMAIN);
    material.extend_from_slice(&CONTENT_VERSION.to_le_bytes());
    composition_id.append_typed(&mut material);
    route_policy_id.append_typed(&mut material);
    kv_format_id.append_typed(&mut material);
    material.extend_from_slice(&position_policy_sha256);
    sha256_bytes(&material)
}

fn runtime_kv_format() -> Result<KvFormatIdentity, ErrorCode> {
    KvFormatIdentity::new(
        u64::try_from(KV_FORMAT_DESCRIPTOR.len()).map_err(|_| ErrorCode::InvalidLength)?,
        KV_FORMAT_SHA256,
    )
}

fn validate_runtime_descriptors() -> Result<(), ErrorCode> {
    if KV_FORMAT_DESCRIPTOR.len() != 134
        || POSITION_POLICY_DESCRIPTOR.len() != 85
        || sha256_bytes(KV_FORMAT_DESCRIPTOR)? != KV_FORMAT_SHA256
        || sha256_bytes(POSITION_POLICY_DESCRIPTOR)? != POSITION_POLICY_SHA256
    {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn validate_envelope(bytes: &[u8], expected_bundle_sha256: Digest32) -> Result<(), ErrorCode> {
    require_digest(expected_bundle_sha256)?;
    if bytes.len() < HEADER_BYTES
        || bytes.len() > MAX_BUNDLE_BYTES
        || !bytes.len().is_multiple_of(ALIGNMENT)
        || sha256_bytes(bytes)? != expected_bundle_sha256
    {
        return Err(ErrorCode::InvalidLength);
    }
    if bytes.get(0..4) != Some(MAGIC.as_slice()) {
        return Err(ErrorCode::InvalidHeader);
    }
    if read_u32(bytes, 4)? != VERSION {
        return Err(ErrorCode::UnsupportedModelVersion);
    }
    if read_u32(bytes, 8)? != HEADER_BYTES as u32
        || read_u32(bytes, 12)? != 0
        || read_u32(bytes, 24)? != MEMBER_BYTES as u32
    {
        return Err(ErrorCode::InvalidHeader);
    }
    require_zero(bytes, 28, 32)?;
    require_zero(bytes, 496, HEADER_BYTES)
}

fn read_padded_id(bytes: &[u8], offset: usize, expected_tag: u8) -> Result<ContentId, ErrorCode> {
    let tag = *bytes.get(offset).ok_or(ErrorCode::InvalidLength)?;
    if tag != expected_tag {
        return Err(ErrorCode::InvalidHeader);
    }
    require_zero(bytes, offset + 1, offset + 8)?;
    let digest = read_digest(bytes, offset + 8)?;
    let kind = match tag {
        1 => crate::content_identity::ArtifactKind::StandaloneModel,
        2 => crate::content_identity::ArtifactKind::BaseDependentAdapter,
        3 => crate::content_identity::ArtifactKind::Composition,
        5 => crate::content_identity::ArtifactKind::RoutePolicy,
        6 => crate::content_identity::ArtifactKind::KvFormat,
        _ => return Err(ErrorCode::InvalidHeader),
    };
    ContentId::from_parts(kind, digest)
}

fn require_digest(digest: Digest32) -> Result<(), ErrorCode> {
    if digest == [0; 32] {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn require_zero(bytes: &[u8], start: usize, end: usize) -> Result<(), ErrorCode> {
    let range = bytes.get(start..end).ok_or(ErrorCode::InvalidLength)?;
    if range.iter().any(|byte| *byte != 0) {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn domain_material(domain: &str) -> Vec<u8> {
    let mut material = Vec::with_capacity(domain.len() + 1);
    material.extend_from_slice(domain.as_bytes());
    material.push(0);
    material
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let value: [u8; 4] = bytes
        .get(offset..end)
        .ok_or(ErrorCode::InvalidLength)?
        .try_into()
        .map_err(|_| ErrorCode::InvalidLength)?;
    Ok(u32::from_le_bytes(value))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
    let value: [u8; 8] = bytes
        .get(offset..end)
        .ok_or(ErrorCode::InvalidLength)?
        .try_into()
        .map_err(|_| ErrorCode::InvalidLength)?;
    Ok(u64::from_le_bytes(value))
}

fn read_usize_u64(bytes: &[u8], offset: usize) -> Result<usize, ErrorCode> {
    usize::try_from(read_u64(bytes, offset)?).map_err(|_| ErrorCode::InvalidLength)
}

fn read_digest(bytes: &[u8], offset: usize) -> Result<Digest32, ErrorCode> {
    let end = offset.checked_add(32).ok_or(ErrorCode::InvalidLength)?;
    let digest = bytes
        .get(offset..end)
        .ok_or(ErrorCode::InvalidLength)?
        .try_into()
        .map_err(|_| ErrorCode::InvalidLength)?;
    require_digest(digest)?;
    Ok(digest)
}

fn write_padded_id(bytes: &mut [u8], offset: usize, id: ContentId) -> Result<(), ErrorCode> {
    let end = offset.checked_add(40).ok_or(ErrorCode::InvalidLength)?;
    let target = bytes.get_mut(offset..end).ok_or(ErrorCode::InvalidLength)?;
    target[0] = id.kind().tag();
    target[8..40].copy_from_slice(&id.digest());
    Ok(())
}

fn write_u32(bytes: &mut [u8], offset: usize, value: u32) -> Result<(), ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    bytes
        .get_mut(offset..end)
        .ok_or(ErrorCode::InvalidLength)?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn write_u64(bytes: &mut [u8], offset: usize, value: u64) -> Result<(), ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
    bytes
        .get_mut(offset..end)
        .ok_or(ErrorCode::InvalidLength)?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use crate::content_identity::ArtifactKind;
    use crate::model_format::DTYPE_F32;

    pub(crate) fn digest(octet: u8) -> Digest32 {
        [octet; 32]
    }

    pub(crate) fn bindings() -> ExecutionBindings {
        ExecutionBindings::new(
            digest(0x33),
            digest(0x44),
            digest(0x55),
            digest(0x66),
            digest(0x77),
        )
        .unwrap()
    }

    pub(crate) fn base_identity(
        model_bytes: u64,
        model_sha256: Digest32,
    ) -> StandaloneModelIdentity {
        StandaloneModelIdentity::new(model_bytes, model_sha256, bindings()).unwrap()
    }

    pub(crate) fn route_id() -> ContentId {
        route_id_for(0x88)
    }

    pub(crate) fn route_id_for(octet: u8) -> ContentId {
        ContentId::from_parts(ArtifactKind::RoutePolicy, digest(octet)).unwrap()
    }

    pub(crate) fn build_overlay_package(
        base: &StandaloneModelIdentity,
        tensor_index: usize,
        tensor: TensorEntry,
        scale: f32,
        output_factors: &[f32],
        input_factors: &[f32],
    ) -> Vec<u8> {
        let factor_rank = input_factors.len() / tensor.dim1 as usize;
        assert!(factor_rank > 0);
        assert_eq!(output_factors.len(), factor_rank * tensor.dim0 as usize);
        assert_eq!(input_factors.len(), factor_rank * tensor.dim1 as usize);
        let payload_offset = align64(320 + 128);
        let factor_end = payload_offset + (output_factors.len() + input_factors.len()) * 4;
        let total_bytes = align64(factor_end);
        let mut bytes = vec![0u8; total_bytes];
        bytes[0..4].copy_from_slice(b"SLO1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, 320);
        write_u32(&mut bytes, 16, 1);
        write_u32(&mut bytes, 20, 128);
        write_u64(&mut bytes, 24, 320);
        write_u64(&mut bytes, 32, payload_offset as u64);
        write_u64(&mut bytes, 40, total_bytes as u64);
        for offset in [48usize, 52, 56, 60] {
            write_u32(&mut bytes, offset, 1);
        }
        let overlay_base = SpecialistOverlayBase::from_identity(base);
        for (index, digest) in overlay_base.ordered_digests().iter().enumerate() {
            bytes[64 + index * 32..96 + index * 32].copy_from_slice(digest);
        }

        let entry = 320;
        let output_bytes = output_factors.len() * 4;
        let input_offset = payload_offset + output_bytes;
        let input_bytes = input_factors.len() * 4;
        write_u32(&mut bytes, entry, tensor_index as u32);
        write_u32(&mut bytes, entry + 4, factor_rank as u32);
        write_u32(&mut bytes, entry + 8, tensor.dim0);
        write_u32(&mut bytes, entry + 12, tensor.dim1);
        write_u64(&mut bytes, entry + 16, tensor.name_hash);
        write_u32(&mut bytes, entry + 24, tensor.dtype);
        write_u32(&mut bytes, entry + 28, tensor.block_size);
        write_u32(&mut bytes, entry + 32, 2);
        write_u32(&mut bytes, entry + 36, tensor.dim0);
        write_u32(&mut bytes, entry + 40, tensor.dim1);
        write_u32(&mut bytes, entry + 52, scale.to_bits());
        write_u64(&mut bytes, entry + 56, payload_offset as u64);
        write_u64(&mut bytes, entry + 64, output_bytes as u64);
        write_u64(&mut bytes, entry + 72, input_offset as u64);
        write_u64(&mut bytes, entry + 80, input_bytes as u64);
        for (index, value) in output_factors.iter().enumerate() {
            write_u32(&mut bytes, payload_offset + index * 4, value.to_bits());
        }
        for (index, value) in input_factors.iter().enumerate() {
            write_u32(&mut bytes, input_offset + index * 4, value.to_bits());
        }
        let factor_sha256 = sha256_bytes(&bytes[payload_offset..factor_end]).unwrap();
        bytes[entry + 88..entry + 120].copy_from_slice(&factor_sha256);
        bytes
    }

    pub(crate) fn build_bundle(
        model_bytes: u64,
        model_sha256: Digest32,
        tensors: &[TensorEntry],
        packages: &[Vec<u8>],
    ) -> (Vec<u8>, Digest32) {
        build_bundle_with_route(model_bytes, model_sha256, tensors, packages, route_id())
    }

    pub(crate) fn build_bundle_with_route(
        model_bytes: u64,
        model_sha256: Digest32,
        tensors: &[TensorEntry],
        packages: &[Vec<u8>],
        route: ContentId,
    ) -> (Vec<u8>, Digest32) {
        let base = base_identity(model_bytes, model_sha256);
        let mut package_values = packages
            .iter()
            .map(|bytes| {
                let package_sha256 = sha256_bytes(bytes).unwrap();
                let adapter = BaseDependentAdapterIdentity::new(
                    bytes.len() as u64,
                    package_sha256,
                    &base,
                    CompositionSemantics::Additive,
                )
                .unwrap();
                (adapter, package_sha256, bytes)
            })
            .collect::<Vec<_>>();
        package_values.sort_by_key(|value| value.0.id());
        let semantics = if package_values.is_empty() {
            CompositionSemantics::BaseOnly
        } else {
            CompositionSemantics::Additive
        };
        let members = package_values
            .iter()
            .map(|value| CompositionMember::new(value.0.clone(), Vec::new()))
            .collect();
        let composition = CompositionIdentity::new(&base, semantics, members).unwrap();
        let kv_format = runtime_kv_format().unwrap();
        let graph_digest = active_graph_digest(
            composition.id(),
            route,
            kv_format.id(),
            POSITION_POLICY_SHA256,
        )
        .unwrap();
        let payload_offset = HEADER_BYTES + package_values.len() * MEMBER_BYTES;
        let total_bytes = payload_offset
            + package_values
                .iter()
                .map(|value| value.2.len())
                .sum::<usize>();
        let mut bytes = vec![0u8; total_bytes];
        bytes[0..4].copy_from_slice(&MAGIC);
        write_u32(&mut bytes, 4, VERSION);
        write_u32(&mut bytes, 8, HEADER_BYTES as u32);
        write_u32(&mut bytes, 16, semantics as u32);
        write_u32(&mut bytes, 20, package_values.len() as u32);
        write_u32(&mut bytes, 24, MEMBER_BYTES as u32);
        write_u64(&mut bytes, 32, HEADER_BYTES as u64);
        write_u64(&mut bytes, 40, payload_offset as u64);
        write_u64(&mut bytes, 48, total_bytes as u64);
        write_u64(&mut bytes, 56, model_bytes);
        bytes[64..96].copy_from_slice(&model_sha256);
        write_padded_id(&mut bytes, 96, base.id());
        let binding = base.execution_bindings();
        for (offset, digest) in [
            (136, binding.tokenizer_sha256()),
            (168, binding.chat_template_sha256()),
            (200, binding.tensor_layout_sha256()),
            (232, binding.quantization_profile_sha256()),
            (264, binding.execution_profile_sha256()),
        ] {
            bytes[offset..offset + 32].copy_from_slice(&digest);
        }
        write_padded_id(&mut bytes, 296, composition.id());
        write_padded_id(&mut bytes, 336, route);
        write_padded_id(&mut bytes, 376, kv_format.id());
        bytes[416..448].copy_from_slice(&POSITION_POLICY_SHA256);
        write_u64(
            &mut bytes,
            448,
            composition.incremental_specialist_bytes().unwrap(),
        );
        write_u64(&mut bytes, 456, composition.logical_bytes().unwrap());
        bytes[464..496].copy_from_slice(&graph_digest);

        let overlay_base = SpecialistOverlayBase::from_identity(&base);
        let mut package_offset = payload_offset;
        for (index, (adapter, package_sha256, package)) in package_values.iter().enumerate() {
            let parsed =
                SpecialistOverlay::parse(package, *package_sha256, overlay_base, tensors).unwrap();
            let entry = HEADER_BYTES + index * MEMBER_BYTES;
            write_padded_id(&mut bytes, entry, adapter.id());
            bytes[entry + 40..entry + 72].copy_from_slice(package_sha256);
            write_u64(&mut bytes, entry + 72, package_offset as u64);
            write_u64(&mut bytes, entry + 80, package.len() as u64);
            write_u32(&mut bytes, entry + 88, parsed.target_count() as u32);
            write_u32(&mut bytes, entry + 92, parsed.maximum_factor_rank() as u32);
            bytes[package_offset..package_offset + package.len()].copy_from_slice(package);
            package_offset += package.len();
        }
        assert_eq!(package_offset, bytes.len());
        let bundle_sha256 = sha256_bytes(&bytes).unwrap();
        (bytes, bundle_sha256)
    }

    pub(crate) fn build_base_bundle(model: &Model) -> (Vec<u8>, Digest32) {
        build_bundle(
            model.model_bytes(),
            model.model_sha256(),
            &model.parsed().tensors,
            &[],
        )
    }

    pub(crate) fn frozen_tensors() -> Vec<TensorEntry> {
        let mut tensors = vec![
            TensorEntry {
                name_hash: 1,
                dtype: DTYPE_F32,
                rank: 2,
                dim0: 1,
                dim1: 1,
                dim2: 0,
                dim3: 0,
                byte_offset: 0,
                byte_length: 4,
                scale_offset: 0,
                block_size: 0,
            };
            8
        ];
        tensors[7] = TensorEntry {
            name_hash: 0x0123_4567_89ab_cdef,
            dtype: DTYPE_F32,
            rank: 2,
            dim0: 3,
            dim1: 8,
            dim2: 0,
            dim3: 0,
            byte_offset: 0,
            byte_length: 96,
            scale_offset: 0,
            block_size: 0,
        };
        tensors
    }

    fn align64(value: usize) -> usize {
        value.div_ceil(64) * 64
    }

    fn write_padded_id(bytes: &mut [u8], offset: usize, id: ContentId) {
        bytes[offset] = id.kind().tag();
        bytes[offset + 8..offset + 40].copy_from_slice(&id.digest());
    }

    fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
        bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn write_u64(bytes: &mut [u8], offset: usize, value: u64) {
        bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;

    fn hex(digest: Digest32) -> String {
        digest.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    #[test]
    fn frozen_runtime_descriptors_and_prompt_key_match_preregistration() {
        validate_runtime_descriptors().unwrap();
        assert_eq!(
            hex(runtime_kv_format().unwrap().id().digest()),
            "0d23cdfedf48081bde5a7e1f579c204ca17b1f933fb509c7f1740c0e40efc04e"
        );
        assert_eq!(
            hex(prompt_token_sequence_digest(&[1, 2, 3]).unwrap()),
            "5ab9dd20e2a1eb98f6e43b7a1da7852f636a55f0dce83fd497ae40093b8c9a5c"
        );
    }

    #[test]
    fn parses_a_complete_base_only_bundle_for_an_exact_loaded_model() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let (bytes, bundle_sha256) = build_base_bundle(&model);
        let graph = ActiveComposition::parse(&bytes, bundle_sha256, &model).unwrap();
        assert_eq!(graph.bundle_sha256(), bundle_sha256);
        assert_eq!(graph.member_count(), 0);
        assert_eq!(graph.maximum_factor_rank(), 0);
        assert_eq!(
            graph.composition().semantics(),
            CompositionSemantics::BaseOnly
        );
    }

    #[test]
    fn production_builder_emits_the_canonical_graph_and_rejects_false_authority() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let (expected_base, expected_base_sha256) = build_base_bundle(&model);
        let built = ActiveCompositionBundle::build(&model, bindings(), route_id(), &[]).unwrap();
        assert_eq!(built.bytes(), expected_base);
        assert_eq!(built.sha256(), expected_base_sha256);
        assert_eq!(built.composition_id().kind(), ArtifactKind::Composition);

        let tensor_index = model
            .parsed()
            .tensors
            .iter()
            .position(|tensor| tensor.rank == 2 && tensor.dim0 > 1 && tensor.dim1 > 1)
            .unwrap();
        let tensor = model.parsed().tensors[tensor_index];
        let rows = tensor.dim0 as usize;
        let cols = tensor.dim1 as usize;
        let base = base_identity(model.model_bytes(), model.model_sha256());
        let package_a = build_overlay_package(
            &base,
            tensor_index,
            tensor,
            0.5,
            &vec![1.0; rows],
            &vec![0.25; cols],
        );
        let package_b = build_overlay_package(
            &base,
            tensor_index,
            tensor,
            -0.25,
            &vec![0.5; rows],
            &vec![0.75; cols],
        );
        let forward = ActiveCompositionBundle::build(
            &model,
            bindings(),
            route_id(),
            &[&package_a, &package_b],
        )
        .unwrap();
        let reverse = ActiveCompositionBundle::build(
            &model,
            bindings(),
            route_id(),
            &[&package_b, &package_a],
        )
        .unwrap();
        assert_eq!(forward.bytes(), reverse.bytes());
        assert_eq!(forward.sha256(), reverse.sha256());
        assert_eq!(forward.active_graph_digest(), reverse.active_graph_digest());
        assert_eq!(
            ActiveCompositionBundle::build(
                &model,
                bindings(),
                route_id(),
                &[&package_a, &package_a],
            )
            .unwrap_err(),
            ErrorCode::InvalidHeader
        );
        assert_eq!(
            ActiveCompositionBundle::build(&model, bindings(), base.id(), &[]).unwrap_err(),
            ErrorCode::InvalidHeader
        );
    }

    #[test]
    fn parses_canonical_additive_members_and_runs_base_once() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let tensor_index = model
            .parsed()
            .tensors
            .iter()
            .position(|tensor| tensor.rank == 2 && tensor.dim0 > 1 && tensor.dim1 > 1)
            .unwrap();
        let tensor = model.parsed().tensors[tensor_index];
        let rows = tensor.dim0 as usize;
        let cols = tensor.dim1 as usize;
        let mut output_factors = vec![0.0; rows];
        output_factors[0] = 1.0;
        let mut input_factors = vec![0.0; cols];
        input_factors[0] = 1.0;
        let base = base_identity(model.model_bytes(), model.model_sha256());
        let package = build_overlay_package(
            &base,
            tensor_index,
            tensor,
            0.5,
            &output_factors,
            &input_factors,
        );
        let (bytes, bundle_sha256) = build_bundle(
            model.model_bytes(),
            model.model_sha256(),
            &model.parsed().tensors,
            &[package],
        );
        let graph = ActiveComposition::parse(&bytes, bundle_sha256, &model).unwrap();
        let vector = vec![1.0; cols];
        let mut expected = vec![0.0; rows];
        model
            .matvec_by_index(tensor_index, rows, cols, &vector, &mut expected)
            .unwrap();
        expected[0] += 0.5;
        let mut actual = vec![0.0; rows];
        let mut scratch = vec![0.0; graph.maximum_factor_rank()];
        graph
            .matvec(
                &model,
                CompositionMatvec {
                    tensor_index,
                    rows,
                    cols,
                    vector: &vector,
                    output: &mut actual,
                    scratch: &mut scratch,
                },
            )
            .unwrap();
        assert_eq!(actual, expected);
    }

    #[test]
    fn rejects_hash_identity_range_and_embedded_package_mutations() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let (original, original_sha256) = build_base_bundle(&model);
        assert_eq!(
            ActiveComposition::parse(&original, digest(0xff), &model).unwrap_err(),
            ErrorCode::InvalidLength
        );

        for offset in [0usize, 12, 28, 96 + 1, 376, 416, 464, 496] {
            let mut bytes = original.clone();
            bytes[offset] ^= 1;
            let digest = sha256_bytes(&bytes).unwrap();
            assert!(ActiveComposition::parse(&bytes, digest, &model).is_err());
        }
        assert!(ActiveComposition::parse(&original, original_sha256, &model).is_ok());
    }

    #[test]
    fn frozen_overlay_packages_match_the_acg_preregistration() {
        let tensors = frozen_tensors();
        let base = base_identity(4096, digest(0x11));
        assert_eq!(
            base.id().display(),
            "model-sha256-49e7f315aa18de68b1cf706c24b950aff32d746ed6e315646845c62a94582b13"
        );
        let package_a = build_overlay_package(
            &base,
            7,
            tensors[7],
            0.5,
            &[1.0, -0.5, 0.25, 0.5, 1.5, -1.0],
            &[
                0.25, -0.5, 1.0, 0.0, 0.5, -0.25, 2.0, -1.0, -1.0, 0.5, 0.25, 2.0, -0.5, 1.0, -1.5,
                0.25,
            ],
        );
        let package_b = build_overlay_package(
            &base,
            7,
            tensors[7],
            -0.25,
            &[0.5, -1.0, 2.0],
            &[1.0, 0.0, -0.5, 0.25, 1.0, -1.0, 0.5, 0.0],
        );
        assert_eq!(
            hex(sha256_bytes(&package_a).unwrap()),
            "2fed8956c4a4bc361d79c0296c5567fd36de43698266622437077934c3c00537"
        );
        assert_eq!(
            hex(sha256_bytes(&package_b).unwrap()),
            "13ec97fbd998f28bdd6d1469bd3e571c0bf46d4f862faead825b3b1376386274"
        );
    }
}
