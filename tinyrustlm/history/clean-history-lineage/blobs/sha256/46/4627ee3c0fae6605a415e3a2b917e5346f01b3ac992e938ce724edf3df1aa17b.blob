use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt::{Display, Formatter};

use crate::{sha256, OracleError, TransformFamily, TransformPlan, MAX_VECTOR_DIMENSION};

/// Largest serialized exact-flat snapshot admitted by the experiment.
pub const MAX_FLAT_INDEX_BYTES: usize = 256 * 1024 * 1024;
/// Largest number of records admitted before byte-size limits are applied.
pub const MAX_FLAT_RECORDS: usize = 1_000_000;
/// Largest requested result count for one scalar query.
pub const MAX_FLAT_SEARCH_RESULTS: usize = 100_000;

const MAGIC: [u8; 8] = *b"TRFLAT01";
const FORMAT_VERSION: u16 = 1;
const HEADER_BYTES: usize = 248;
const RECORD_PREFIX_BYTES: usize = 16;
const FOOTER_BYTES: usize = 32;
const F32_ENCODING_CODE: u8 = 1;
const F32_BYTES: usize = 4;
const ZERO_HASH: [u8; 32] = [0; 32];

/// Scalar score used by the exact-flat retrieval baseline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RetrievalMetric {
    /// Larger inner products rank first.
    DotProduct,
    /// Smaller squared Euclidean distances rank first.
    SquaredEuclidean,
    /// Larger dot products between L2-normalized vectors rank first.
    Cosine,
}

impl RetrievalMetric {
    fn code(self) -> u8 {
        match self {
            Self::DotProduct => 1,
            Self::SquaredEuclidean => 2,
            Self::Cosine => 3,
        }
    }

    fn from_code(code: u8) -> Result<Self, FlatIndexError> {
        match code {
            1 => Ok(Self::DotProduct),
            2 => Ok(Self::SquaredEuclidean),
            3 => Ok(Self::Cosine),
            _ => Err(FlatIndexError::InvalidHeader),
        }
    }
}

/// Canonical normalization performed before optional transformation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VectorNormalization {
    /// Preserve finite input magnitudes.
    None,
    /// Divide each nonzero vector by its f64 L2 norm.
    L2Unit,
}

impl VectorNormalization {
    fn code(self) -> u8 {
        match self {
            Self::None => 0,
            Self::L2Unit => 1,
        }
    }

    fn from_code(code: u8) -> Result<Self, FlatIndexError> {
        match code {
            0 => Ok(Self::None),
            1 => Ok(Self::L2Unit),
            _ => Err(FlatIndexError::InvalidHeader),
        }
    }
}

/// Optional deterministic orthogonal transform in the frozen f32 pipeline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RetrievalTransform {
    /// Store canonicalized vectors without a transform.
    None,
    /// Apply the scalar oracle's seeded signed permutation.
    SignedPermutation,
    /// Apply the scalar oracle's seeded normalized Walsh-Hadamard transform.
    SignedHadamard,
}

impl RetrievalTransform {
    fn code(self) -> u8 {
        match self {
            Self::None => 0,
            Self::SignedPermutation => 1,
            Self::SignedHadamard => 2,
        }
    }

    fn from_code(code: u8) -> Result<Self, FlatIndexError> {
        match code {
            0 => Ok(Self::None),
            1 => Ok(Self::SignedPermutation),
            2 => Ok(Self::SignedHadamard),
            _ => Err(FlatIndexError::InvalidHeader),
        }
    }

    fn family(self) -> Option<TransformFamily> {
        match self {
            Self::None => None,
            Self::SignedPermutation => Some(TransformFamily::SignedPermutation),
            Self::SignedHadamard => Some(TransformFamily::SignedHadamard),
        }
    }
}

/// Calibration identity for the exact f32 baseline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CalibrationIdentity {
    /// No data-derived calibration is applied.
    None,
    /// One immutable externally computed calibration hash is identity-bound.
    Frozen([u8; 32]),
}

impl CalibrationIdentity {
    fn code(self) -> u8 {
        match self {
            Self::None => 0,
            Self::Frozen(_) => 1,
        }
    }

    fn hash(self) -> [u8; 32] {
        match self {
            Self::None => ZERO_HASH,
            Self::Frozen(hash) => hash,
        }
    }
}

/// Unvalidated caller input for one exact-flat configuration.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FlatIndexConfigSpec {
    /// Number of f32 coordinates in every record and query.
    pub dimension: usize,
    /// Exact scalar ranking metric.
    pub metric: RetrievalMetric,
    /// Input normalization contract.
    pub normalization: VectorNormalization,
    /// Optional deterministic transform family.
    pub transform: RetrievalTransform,
    /// Seed bound to a non-`None` transform.
    pub transform_seed: u64,
    /// SHA-256 of the embedding-model bytes.
    pub embedding_model_sha256: [u8; 32],
    /// SHA-256 of the tokenizer bytes or canonical tokenizer package.
    pub tokenizer_sha256: [u8; 32],
    /// Codebook identity; forbidden for the exact f32 baseline.
    pub codebook_sha256: Option<[u8; 32]>,
    /// Frozen or absent calibration identity.
    pub calibration: CalibrationIdentity,
    /// SHA-256 identity of the implementation inputs used for this snapshot.
    pub implementation_sha256: [u8; 32],
}

/// Validated immutable exact-flat configuration.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FlatIndexConfig {
    dimension: usize,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    transform: RetrievalTransform,
    transform_seed: u64,
    embedding_model_sha256: [u8; 32],
    tokenizer_sha256: [u8; 32],
    calibration: CalibrationIdentity,
    implementation_sha256: [u8; 32],
}

impl FlatIndexConfig {
    /// Validates every identity field before any record allocation.
    pub fn from_spec(spec: FlatIndexConfigSpec) -> Result<Self, FlatIndexError> {
        if spec.dimension == 0 || spec.dimension > MAX_VECTOR_DIMENSION {
            return Err(FlatIndexError::DimensionOutOfRange);
        }
        require_nonzero_hash(&spec.embedding_model_sha256, "embedding-model-sha256")?;
        require_nonzero_hash(&spec.tokenizer_sha256, "tokenizer-sha256")?;
        require_nonzero_hash(&spec.implementation_sha256, "implementation-sha256")?;
        if spec.codebook_sha256.is_some() {
            return Err(FlatIndexError::CodebookNotAllowedForF32);
        }
        if let CalibrationIdentity::Frozen(hash) = spec.calibration {
            require_nonzero_hash(&hash, "calibration-sha256")?;
        }
        if spec.transform == RetrievalTransform::None && spec.transform_seed != 0 {
            return Err(FlatIndexError::TransformSeedMustBeZero);
        }
        if spec.transform == RetrievalTransform::SignedHadamard && !spec.dimension.is_power_of_two()
        {
            return Err(FlatIndexError::UnsupportedTransformDimension);
        }
        if spec.metric == RetrievalMetric::Cosine
            && spec.normalization != VectorNormalization::L2Unit
        {
            return Err(FlatIndexError::CosineRequiresL2Normalization);
        }
        serialized_length(spec.dimension, 0)?;
        Ok(Self {
            dimension: spec.dimension,
            metric: spec.metric,
            normalization: spec.normalization,
            transform: spec.transform,
            transform_seed: spec.transform_seed,
            embedding_model_sha256: spec.embedding_model_sha256,
            tokenizer_sha256: spec.tokenizer_sha256,
            calibration: spec.calibration,
            implementation_sha256: spec.implementation_sha256,
        })
    }

    /// Returns the exact coordinate count.
    pub fn dimension(&self) -> usize {
        self.dimension
    }

    /// Returns the exact ranking metric.
    pub fn metric(&self) -> RetrievalMetric {
        self.metric
    }
}

/// One public-safe scalar search result with no stored text payload.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SearchHit {
    /// Stable caller-owned identifier.
    pub external_id: u64,
    /// Exact scalar score; lower is better only for squared Euclidean distance.
    pub score: f64,
}

/// Deterministic rejection from exact-flat construction or persistence.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FlatIndexError {
    /// A dimension was zero or above the scalar ceiling.
    DimensionOutOfRange,
    /// One required SHA-256 identity was all zero.
    InvalidIdentity {
        /// Stable identity-field label without private content.
        field: &'static str,
    },
    /// The f32 baseline cannot declare a codebook.
    CodebookNotAllowedForF32,
    /// A transform-free configuration supplied a nonzero seed.
    TransformSeedMustBeZero,
    /// The requested transform does not define the dimension.
    UnsupportedTransformDimension,
    /// Cosine scoring requires the frozen L2 normalization pipeline.
    CosineRequiresL2Normalization,
    /// A record or query length did not equal the configured dimension.
    VectorLengthMismatch {
        /// Required coordinate count.
        expected: usize,
        /// Observed coordinate count.
        actual: usize,
    },
    /// An input coordinate was NaN or infinite.
    NonFiniteVector {
        /// Rejected coordinate index.
        index: usize,
    },
    /// A finite transformation could not be represented as finite f32.
    NonFiniteStoredVector,
    /// L2 normalization was requested for a zero-norm vector.
    ZeroNormVector,
    /// The snapshot already contains the external identifier.
    DuplicateExternalId,
    /// The requested external identifier is absent.
    ExternalIdNotFound,
    /// The requested external identifier is already tombstoned.
    AlreadyDeleted,
    /// The next record-set revision equals the current revision.
    RevisionNotAdvanced,
    /// A revision hash was all zero.
    InvalidRevision,
    /// Compaction was requested without any tombstone.
    NoTombstonesToCompact,
    /// A record count exceeded the explicit experiment ceiling.
    RecordCountOutOfRange,
    /// A search limit was zero or above its explicit ceiling.
    SearchLimitOutOfRange,
    /// A byte or count calculation overflowed.
    ArithmeticOverflow,
    /// Serialized input exceeded the explicit byte ceiling.
    SerializedBytesOutOfRange,
    /// Serialized input was truncated, extended, or internally length-inconsistent.
    SerializedLengthMismatch,
    /// The eight-byte format magic was not exact.
    InvalidMagic,
    /// The format version was not the one preregistered version.
    UnsupportedFormatVersion,
    /// A header code, reserved byte, or fixed field was invalid.
    InvalidHeader,
    /// Nonzero format flags attempted an undeclared extension.
    UnknownFlags,
    /// The FIPS 180-4 SHA-256 footer did not match the body.
    DigestMismatch,
    /// Record identifiers were not strictly increasing.
    InvalidRecordOrder,
    /// A record state code was not active or tombstoned.
    InvalidRecordState,
    /// Stored f32 bytes were nonfinite, negative zero, malformed, or noncanonical.
    NonCanonicalStoredVector,
    /// Header active count did not match parsed active records.
    ActiveCountMismatch,
    /// A scalar score overflowed despite finite input.
    NonFiniteScore,
    /// A shared scalar transform rejected the request.
    Numerical(OracleError),
}

impl Display for FlatIndexError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DimensionOutOfRange => write!(formatter, "flat-index dimension is out of range"),
            Self::InvalidIdentity { field } => {
                write!(formatter, "identity field {field} is invalid")
            }
            Self::CodebookNotAllowedForF32 => {
                write!(formatter, "f32 baseline cannot declare a codebook")
            }
            Self::TransformSeedMustBeZero => write!(formatter, "transform-free seed must be zero"),
            Self::UnsupportedTransformDimension => {
                write!(formatter, "transform does not support dimension")
            }
            Self::CosineRequiresL2Normalization => {
                write!(formatter, "cosine requires L2 normalization")
            }
            Self::VectorLengthMismatch { expected, actual } => {
                write!(
                    formatter,
                    "vector length mismatch: expected {expected}, observed {actual}"
                )
            }
            Self::NonFiniteVector { index } => {
                write!(formatter, "vector coordinate {index} is nonfinite")
            }
            Self::NonFiniteStoredVector => write!(formatter, "stored f32 vector became nonfinite"),
            Self::ZeroNormVector => {
                write!(formatter, "L2-normalized vector must have nonzero norm")
            }
            Self::DuplicateExternalId => write!(formatter, "external identifier is duplicated"),
            Self::ExternalIdNotFound => write!(formatter, "external identifier was not found"),
            Self::AlreadyDeleted => write!(formatter, "external identifier is already deleted"),
            Self::RevisionNotAdvanced => write!(formatter, "record-set revision did not advance"),
            Self::InvalidRevision => write!(formatter, "record-set revision is invalid"),
            Self::NoTombstonesToCompact => {
                write!(formatter, "snapshot has no tombstones to compact")
            }
            Self::RecordCountOutOfRange => {
                write!(formatter, "flat-index record count is out of range")
            }
            Self::SearchLimitOutOfRange => {
                write!(formatter, "flat-index search limit is out of range")
            }
            Self::ArithmeticOverflow => write!(formatter, "flat-index size calculation overflowed"),
            Self::SerializedBytesOutOfRange => {
                write!(formatter, "serialized flat-index bytes are out of range")
            }
            Self::SerializedLengthMismatch => {
                write!(formatter, "serialized flat-index length is inconsistent")
            }
            Self::InvalidMagic => write!(formatter, "serialized flat-index magic is invalid"),
            Self::UnsupportedFormatVersion => {
                write!(formatter, "serialized flat-index version is unsupported")
            }
            Self::InvalidHeader => write!(formatter, "serialized flat-index header is invalid"),
            Self::UnknownFlags => write!(formatter, "serialized flat-index flags are unsupported"),
            Self::DigestMismatch => {
                write!(formatter, "serialized flat-index digest does not match")
            }
            Self::InvalidRecordOrder => write!(formatter, "serialized record order is invalid"),
            Self::InvalidRecordState => write!(formatter, "serialized record state is invalid"),
            Self::NonCanonicalStoredVector => {
                write!(formatter, "serialized vector is noncanonical")
            }
            Self::ActiveCountMismatch => {
                write!(formatter, "serialized active count does not match records")
            }
            Self::NonFiniteScore => write!(formatter, "flat-index score became nonfinite"),
            Self::Numerical(error) => {
                write!(formatter, "scalar transform rejected vector: {error}")
            }
        }
    }
}

impl Error for FlatIndexError {}

impl From<OracleError> for FlatIndexError {
    fn from(value: OracleError) -> Self {
        Self::Numerical(value)
    }
}

#[derive(Clone, Debug, PartialEq)]
struct StoredRecord {
    active: bool,
    vector: Vec<f32>,
}

/// Order-independent builder for one immutable record-set revision.
#[derive(Clone, Debug, PartialEq)]
pub struct ExactFlatIndexBuilder {
    config: FlatIndexConfig,
    record_set_revision: [u8; 32],
    records: BTreeMap<u64, StoredRecord>,
}

impl ExactFlatIndexBuilder {
    /// Creates an empty builder bound to one nonzero record-set revision.
    pub fn new(
        config: FlatIndexConfig,
        record_set_revision: [u8; 32],
    ) -> Result<Self, FlatIndexError> {
        validate_revision(&record_set_revision)?;
        Ok(Self {
            config,
            record_set_revision,
            records: BTreeMap::new(),
        })
    }

    /// Adds one unique identifier and finite vector to the pending snapshot.
    pub fn insert(&mut self, external_id: u64, vector: &[f32]) -> Result<(), FlatIndexError> {
        if self.records.contains_key(&external_id) {
            return Err(FlatIndexError::DuplicateExternalId);
        }
        let next_count = self
            .records
            .len()
            .checked_add(1)
            .ok_or(FlatIndexError::ArithmeticOverflow)?;
        serialized_length(self.config.dimension, next_count)?;
        let vector = prepare_vector(&self.config, vector)?;
        self.records.insert(
            external_id,
            StoredRecord {
                active: true,
                vector,
            },
        );
        Ok(())
    }

    /// Freezes the current sorted record map without changing its revision.
    pub fn finish(self) -> ExactFlatIndex {
        ExactFlatIndex {
            config: self.config,
            record_set_revision: self.record_set_revision,
            records: self.records,
        }
    }
}

/// Immutable exact scalar f32 retrieval snapshot.
#[derive(Clone, Debug, PartialEq)]
pub struct ExactFlatIndex {
    config: FlatIndexConfig,
    record_set_revision: [u8; 32],
    records: BTreeMap<u64, StoredRecord>,
}

impl ExactFlatIndex {
    /// Returns all active and tombstoned record slots.
    pub fn record_count(&self) -> usize {
        self.records.len()
    }

    /// Returns the number of searchable records.
    pub fn active_record_count(&self) -> usize {
        self.records.values().filter(|record| record.active).count()
    }

    /// Returns the exact record-set revision identity.
    pub fn record_set_revision(&self) -> &[u8; 32] {
        &self.record_set_revision
    }

    /// Returns whether an identifier is currently searchable.
    pub fn contains_active(&self, external_id: u64) -> bool {
        self.records
            .get(&external_id)
            .is_some_and(|record| record.active)
    }

    /// Returns whether an active or tombstoned slot retains the identifier.
    pub fn contains_any(&self, external_id: u64) -> bool {
        self.records.contains_key(&external_id)
    }

    /// Produces a new snapshot with one added record and advanced revision.
    pub fn with_added(
        &self,
        external_id: u64,
        vector: &[f32],
        next_revision: [u8; 32],
    ) -> Result<Self, FlatIndexError> {
        self.validate_next_revision(&next_revision)?;
        if self.records.contains_key(&external_id) {
            return Err(FlatIndexError::DuplicateExternalId);
        }
        let next_count = self
            .records
            .len()
            .checked_add(1)
            .ok_or(FlatIndexError::ArithmeticOverflow)?;
        serialized_length(self.config.dimension, next_count)?;
        let mut next = self.clone();
        next.record_set_revision = next_revision;
        next.records.insert(
            external_id,
            StoredRecord {
                active: true,
                vector: prepare_vector(&self.config, vector)?,
            },
        );
        Ok(next)
    }

    /// Produces a new snapshot whose tombstone contains only zero coordinates.
    pub fn with_deleted(
        &self,
        external_id: u64,
        next_revision: [u8; 32],
    ) -> Result<Self, FlatIndexError> {
        self.validate_next_revision(&next_revision)?;
        let mut next = self.clone();
        let record = next
            .records
            .get_mut(&external_id)
            .ok_or(FlatIndexError::ExternalIdNotFound)?;
        if !record.active {
            return Err(FlatIndexError::AlreadyDeleted);
        }
        record.vector.fill(0.0);
        record.active = false;
        next.record_set_revision = next_revision;
        Ok(next)
    }

    /// Produces a new snapshot with every tombstoned slot removed.
    pub fn compacted(&self, next_revision: [u8; 32]) -> Result<Self, FlatIndexError> {
        self.validate_next_revision(&next_revision)?;
        if self.records.values().all(|record| record.active) {
            return Err(FlatIndexError::NoTombstonesToCompact);
        }
        let records = self
            .records
            .iter()
            .filter(|(_, record)| record.active)
            .map(|(external_id, record)| (*external_id, record.clone()))
            .collect();
        Ok(Self {
            config: self.config.clone(),
            record_set_revision: next_revision,
            records,
        })
    }

    /// Scans active records in identifier order and returns deterministic ranks.
    pub fn search(
        &self,
        query: &[f32],
        limit: usize,
        allowed_external_ids: Option<&BTreeSet<u64>>,
    ) -> Result<Vec<SearchHit>, FlatIndexError> {
        if limit == 0 || limit > MAX_FLAT_SEARCH_RESULTS {
            return Err(FlatIndexError::SearchLimitOutOfRange);
        }
        let query = prepare_vector(&self.config, query)?;
        let mut hits = Vec::with_capacity(self.active_record_count().min(limit));
        for (external_id, record) in &self.records {
            if !record.active
                || allowed_external_ids.is_some_and(|allowed| !allowed.contains(external_id))
            {
                continue;
            }
            let score = score(self.config.metric, &query, &record.vector)?;
            hits.push(SearchHit {
                external_id: *external_id,
                score,
            });
        }
        hits.sort_by(|left, right| {
            let score_order = match self.config.metric {
                RetrievalMetric::DotProduct | RetrievalMetric::Cosine => {
                    right.score.total_cmp(&left.score)
                }
                RetrievalMetric::SquaredEuclidean => left.score.total_cmp(&right.score),
            };
            score_order.then_with(|| left.external_id.cmp(&right.external_id))
        });
        hits.truncate(limit);
        Ok(hits)
    }

    /// Serializes one canonical sorted snapshot with a SHA-256 body footer.
    pub fn to_bytes(&self) -> Result<Vec<u8>, FlatIndexError> {
        let total_bytes = serialized_length(self.config.dimension, self.records.len())?;
        let record_bytes = record_bytes(self.config.dimension)?;
        let active_count = self.active_record_count();
        let record_count_u32 =
            u32::try_from(self.records.len()).map_err(|_| FlatIndexError::RecordCountOutOfRange)?;
        let active_count_u32 =
            u32::try_from(active_count).map_err(|_| FlatIndexError::RecordCountOutOfRange)?;
        let dimension_u32 = u32::try_from(self.config.dimension)
            .map_err(|_| FlatIndexError::DimensionOutOfRange)?;
        let record_bytes_u32 =
            u32::try_from(record_bytes).map_err(|_| FlatIndexError::ArithmeticOverflow)?;

        let mut output = Vec::with_capacity(total_bytes);
        output.extend_from_slice(&MAGIC);
        output.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
        output.extend_from_slice(&(HEADER_BYTES as u16).to_le_bytes());
        output.extend_from_slice(&0_u32.to_le_bytes());
        output.extend_from_slice(&dimension_u32.to_le_bytes());
        output.extend_from_slice(&record_count_u32.to_le_bytes());
        output.extend_from_slice(&active_count_u32.to_le_bytes());
        output.push(self.config.metric.code());
        output.push(self.config.normalization.code());
        output.push(self.config.transform.code());
        output.push(F32_ENCODING_CODE);
        output.push(self.config.calibration.code());
        output.extend_from_slice(&[0_u8; 7]);
        output.extend_from_slice(&self.config.transform_seed.to_le_bytes());
        output.extend_from_slice(&self.record_set_revision);
        output.extend_from_slice(&self.config.embedding_model_sha256);
        output.extend_from_slice(&self.config.tokenizer_sha256);
        output.extend_from_slice(&ZERO_HASH);
        output.extend_from_slice(&self.config.calibration.hash());
        output.extend_from_slice(&self.config.implementation_sha256);
        output.extend_from_slice(&record_bytes_u32.to_le_bytes());
        output.extend_from_slice(&0_u32.to_le_bytes());
        debug_assert_eq!(output.len(), HEADER_BYTES);

        for (external_id, record) in &self.records {
            output.extend_from_slice(&external_id.to_le_bytes());
            output.push(u8::from(!record.active));
            output.extend_from_slice(&[0_u8; 7]);
            for value in &record.vector {
                output.extend_from_slice(&value.to_bits().to_le_bytes());
            }
        }
        let digest = sha256(&output);
        output.extend_from_slice(&digest);
        debug_assert_eq!(output.len(), total_bytes);
        Ok(output)
    }

    /// Parses and fully validates one canonical exact-flat snapshot.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, FlatIndexError> {
        if bytes.len() > MAX_FLAT_INDEX_BYTES {
            return Err(FlatIndexError::SerializedBytesOutOfRange);
        }
        if bytes.len() < HEADER_BYTES + FOOTER_BYTES {
            return Err(FlatIndexError::SerializedLengthMismatch);
        }
        if bytes[..8] != MAGIC {
            return Err(FlatIndexError::InvalidMagic);
        }
        if read_u16(bytes, 8)? != FORMAT_VERSION {
            return Err(FlatIndexError::UnsupportedFormatVersion);
        }
        if usize::from(read_u16(bytes, 10)?) != HEADER_BYTES {
            return Err(FlatIndexError::InvalidHeader);
        }
        if read_u32(bytes, 12)? != 0 {
            return Err(FlatIndexError::UnknownFlags);
        }
        let dimension = usize::try_from(read_u32(bytes, 16)?)
            .map_err(|_| FlatIndexError::DimensionOutOfRange)?;
        let record_count = usize::try_from(read_u32(bytes, 20)?)
            .map_err(|_| FlatIndexError::RecordCountOutOfRange)?;
        let declared_active_count = usize::try_from(read_u32(bytes, 24)?)
            .map_err(|_| FlatIndexError::RecordCountOutOfRange)?;
        let expected_length = serialized_length(dimension, record_count)?;
        if bytes.len() != expected_length {
            return Err(FlatIndexError::SerializedLengthMismatch);
        }
        let record_bytes = record_bytes(dimension)?;
        if usize::try_from(read_u32(bytes, 240)?).map_err(|_| FlatIndexError::InvalidHeader)?
            != record_bytes
        {
            return Err(FlatIndexError::InvalidHeader);
        }
        if bytes[33..40].iter().any(|value| *value != 0) || read_u32(bytes, 244)? != 0 {
            return Err(FlatIndexError::InvalidHeader);
        }
        let body_end = bytes.len() - FOOTER_BYTES;
        if sha256(&bytes[..body_end]) != bytes[body_end..] {
            return Err(FlatIndexError::DigestMismatch);
        }
        if bytes[31] != F32_ENCODING_CODE || bytes[144..176] != ZERO_HASH {
            return Err(FlatIndexError::InvalidHeader);
        }

        let metric = RetrievalMetric::from_code(bytes[28])?;
        let normalization = VectorNormalization::from_code(bytes[29])?;
        let transform = RetrievalTransform::from_code(bytes[30])?;
        let calibration_hash = read_hash(bytes, 176)?;
        let calibration = match bytes[32] {
            0 if calibration_hash == ZERO_HASH => CalibrationIdentity::None,
            1 if calibration_hash != ZERO_HASH => CalibrationIdentity::Frozen(calibration_hash),
            _ => return Err(FlatIndexError::InvalidHeader),
        };
        let config = FlatIndexConfig::from_spec(FlatIndexConfigSpec {
            dimension,
            metric,
            normalization,
            transform,
            transform_seed: read_u64(bytes, 40)?,
            embedding_model_sha256: read_hash(bytes, 80)?,
            tokenizer_sha256: read_hash(bytes, 112)?,
            codebook_sha256: None,
            calibration,
            implementation_sha256: read_hash(bytes, 208)?,
        })?;
        let record_set_revision = read_hash(bytes, 48)?;
        validate_revision(&record_set_revision)?;

        let mut records = BTreeMap::new();
        let mut offset = HEADER_BYTES;
        let mut previous_id = None;
        let mut active_count = 0_usize;
        for _ in 0..record_count {
            let external_id = read_u64(bytes, offset)?;
            if previous_id.is_some_and(|previous| external_id <= previous) {
                return Err(FlatIndexError::InvalidRecordOrder);
            }
            previous_id = Some(external_id);
            let active = match bytes[offset + 8] {
                0 => true,
                1 => false,
                _ => return Err(FlatIndexError::InvalidRecordState),
            };
            if bytes[offset + 9..offset + RECORD_PREFIX_BYTES]
                .iter()
                .any(|value| *value != 0)
            {
                return Err(FlatIndexError::InvalidHeader);
            }
            let vector_start = offset + RECORD_PREFIX_BYTES;
            let vector_end = vector_start + dimension * F32_BYTES;
            let mut vector = Vec::with_capacity(dimension);
            for word in bytes[vector_start..vector_end].chunks_exact(F32_BYTES) {
                let value = f32::from_bits(u32::from_le_bytes(
                    word.try_into().expect("four-byte f32 word"),
                ));
                vector.push(value);
            }
            validate_stored_vector(&config, active, &vector)?;
            if active {
                active_count = active_count
                    .checked_add(1)
                    .ok_or(FlatIndexError::ArithmeticOverflow)?;
            }
            records.insert(external_id, StoredRecord { active, vector });
            offset += record_bytes;
        }
        if offset != body_end {
            return Err(FlatIndexError::SerializedLengthMismatch);
        }
        if active_count != declared_active_count {
            return Err(FlatIndexError::ActiveCountMismatch);
        }
        Ok(Self {
            config,
            record_set_revision,
            records,
        })
    }

    fn validate_next_revision(&self, next_revision: &[u8; 32]) -> Result<(), FlatIndexError> {
        validate_revision(next_revision)?;
        if next_revision == &self.record_set_revision {
            return Err(FlatIndexError::RevisionNotAdvanced);
        }
        Ok(())
    }
}

fn require_nonzero_hash(hash: &[u8; 32], field: &'static str) -> Result<(), FlatIndexError> {
    if hash == &ZERO_HASH {
        Err(FlatIndexError::InvalidIdentity { field })
    } else {
        Ok(())
    }
}

fn validate_revision(revision: &[u8; 32]) -> Result<(), FlatIndexError> {
    if revision == &ZERO_HASH {
        Err(FlatIndexError::InvalidRevision)
    } else {
        Ok(())
    }
}

fn record_bytes(dimension: usize) -> Result<usize, FlatIndexError> {
    dimension
        .checked_mul(F32_BYTES)
        .and_then(|bytes| bytes.checked_add(RECORD_PREFIX_BYTES))
        .ok_or(FlatIndexError::ArithmeticOverflow)
}

fn serialized_length(dimension: usize, record_count: usize) -> Result<usize, FlatIndexError> {
    if dimension == 0 || dimension > MAX_VECTOR_DIMENSION {
        return Err(FlatIndexError::DimensionOutOfRange);
    }
    if record_count > MAX_FLAT_RECORDS {
        return Err(FlatIndexError::RecordCountOutOfRange);
    }
    let total = record_bytes(dimension)?
        .checked_mul(record_count)
        .and_then(|bytes| bytes.checked_add(HEADER_BYTES + FOOTER_BYTES))
        .ok_or(FlatIndexError::ArithmeticOverflow)?;
    if total > MAX_FLAT_INDEX_BYTES {
        return Err(FlatIndexError::SerializedBytesOutOfRange);
    }
    Ok(total)
}

fn prepare_vector(config: &FlatIndexConfig, input: &[f32]) -> Result<Vec<f32>, FlatIndexError> {
    if input.len() != config.dimension {
        return Err(FlatIndexError::VectorLengthMismatch {
            expected: config.dimension,
            actual: input.len(),
        });
    }
    let mut values = Vec::with_capacity(input.len());
    for (index, value) in input.iter().enumerate() {
        if !value.is_finite() {
            return Err(FlatIndexError::NonFiniteVector { index });
        }
        values.push(if *value == 0.0 {
            0.0
        } else {
            f64::from(*value)
        });
    }
    if config.normalization == VectorNormalization::L2Unit {
        let mut squared_norm = 0.0;
        for value in &values {
            squared_norm += value * value;
            if !squared_norm.is_finite() {
                return Err(FlatIndexError::NonFiniteStoredVector);
            }
        }
        if squared_norm == 0.0 {
            return Err(FlatIndexError::ZeroNormVector);
        }
        let inverse_norm = squared_norm.sqrt().recip();
        for value in &mut values {
            *value *= inverse_norm;
        }
    }
    if let Some(family) = config.transform.family() {
        values = TransformPlan::new(family, config.dimension, config.transform_seed)?
            .forward(&values)?;
    }
    values
        .into_iter()
        .map(|value| {
            let stored = value as f32;
            if !stored.is_finite() {
                Err(FlatIndexError::NonFiniteStoredVector)
            } else if stored == 0.0 {
                Ok(0.0)
            } else {
                Ok(stored)
            }
        })
        .collect()
}

fn validate_stored_vector(
    config: &FlatIndexConfig,
    active: bool,
    vector: &[f32],
) -> Result<(), FlatIndexError> {
    if vector.len() != config.dimension {
        return Err(FlatIndexError::NonCanonicalStoredVector);
    }
    if !active {
        return if vector.iter().all(|value| value.to_bits() == 0) {
            Ok(())
        } else {
            Err(FlatIndexError::NonCanonicalStoredVector)
        };
    }
    if vector
        .iter()
        .any(|value| !value.is_finite() || value.to_bits() == (-0.0_f32).to_bits())
    {
        return Err(FlatIndexError::NonCanonicalStoredVector);
    }
    if config.normalization == VectorNormalization::L2Unit {
        let norm = vector
            .iter()
            .map(|value| f64::from(*value) * f64::from(*value))
            .sum::<f64>()
            .sqrt();
        if !norm.is_finite() || (norm - 1.0).abs() > 1.0e-5 {
            return Err(FlatIndexError::NonCanonicalStoredVector);
        }
    }
    Ok(())
}

fn score(metric: RetrievalMetric, query: &[f32], record: &[f32]) -> Result<f64, FlatIndexError> {
    let mut result = 0.0;
    match metric {
        RetrievalMetric::DotProduct | RetrievalMetric::Cosine => {
            for (left, right) in query.iter().zip(record) {
                result += f64::from(*left) * f64::from(*right);
                if !result.is_finite() {
                    return Err(FlatIndexError::NonFiniteScore);
                }
            }
        }
        RetrievalMetric::SquaredEuclidean => {
            for (left, right) in query.iter().zip(record) {
                let difference = f64::from(*left) - f64::from(*right);
                result += difference * difference;
                if !result.is_finite() {
                    return Err(FlatIndexError::NonFiniteScore);
                }
            }
        }
    }
    Ok(if result == 0.0 { 0.0 } else { result })
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, FlatIndexError> {
    let end = offset
        .checked_add(2)
        .ok_or(FlatIndexError::ArithmeticOverflow)?;
    let word = bytes
        .get(offset..end)
        .ok_or(FlatIndexError::SerializedLengthMismatch)?;
    Ok(u16::from_le_bytes(word.try_into().expect("two-byte word")))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, FlatIndexError> {
    let end = offset
        .checked_add(4)
        .ok_or(FlatIndexError::ArithmeticOverflow)?;
    let word = bytes
        .get(offset..end)
        .ok_or(FlatIndexError::SerializedLengthMismatch)?;
    Ok(u32::from_le_bytes(word.try_into().expect("four-byte word")))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, FlatIndexError> {
    let end = offset
        .checked_add(8)
        .ok_or(FlatIndexError::ArithmeticOverflow)?;
    let word = bytes
        .get(offset..end)
        .ok_or(FlatIndexError::SerializedLengthMismatch)?;
    Ok(u64::from_le_bytes(
        word.try_into().expect("eight-byte word"),
    ))
}

fn read_hash(bytes: &[u8], offset: usize) -> Result<[u8; 32], FlatIndexError> {
    let end = offset
        .checked_add(32)
        .ok_or(FlatIndexError::ArithmeticOverflow)?;
    bytes
        .get(offset..end)
        .ok_or(FlatIndexError::SerializedLengthMismatch)?
        .try_into()
        .map_err(|_| FlatIndexError::SerializedLengthMismatch)
}

#[cfg(test)]
mod tests {
    use super::{
        CalibrationIdentity, ExactFlatIndex, ExactFlatIndexBuilder, FlatIndexConfig,
        FlatIndexConfigSpec, FlatIndexError, RetrievalMetric, RetrievalTransform,
        VectorNormalization, FOOTER_BYTES, HEADER_BYTES,
    };
    use crate::sha256;

    fn hash(byte: u8) -> [u8; 32] {
        [byte; 32]
    }

    fn config() -> FlatIndexConfig {
        FlatIndexConfig::from_spec(FlatIndexConfigSpec {
            dimension: 4,
            metric: RetrievalMetric::DotProduct,
            normalization: VectorNormalization::None,
            transform: RetrievalTransform::None,
            transform_seed: 0,
            embedding_model_sha256: hash(1),
            tokenizer_sha256: hash(2),
            codebook_sha256: None,
            calibration: CalibrationIdentity::None,
            implementation_sha256: hash(3),
        })
        .expect("config")
    }

    fn one_record() -> ExactFlatIndex {
        let mut builder = ExactFlatIndexBuilder::new(config(), hash(4)).expect("builder");
        builder.insert(7, &[1.25, -2.5, -0.0, 8.0]).expect("record");
        builder.finish()
    }

    #[test]
    fn deletion_overwrites_every_stored_coordinate_before_serialization() {
        let deleted = one_record().with_deleted(7, hash(5)).expect("delete");
        let record = deleted.records.get(&7).expect("slot");
        assert!(!record.active);
        assert!(record.vector.iter().all(|value| value.to_bits() == 0));
        let bytes = deleted.to_bytes().expect("bytes");
        let vector_start = HEADER_BYTES + 16;
        assert!(bytes[vector_start..vector_start + 16]
            .iter()
            .all(|value| *value == 0));
    }

    #[test]
    fn recomputed_digest_cannot_authorize_unknown_header_or_record_state() {
        let bytes = one_record().to_bytes().expect("bytes");

        let mut reserved = bytes.clone();
        reserved[33] = 1;
        let body_end = reserved.len() - FOOTER_BYTES;
        let digest = sha256(&reserved[..body_end]);
        reserved[body_end..].copy_from_slice(&digest);
        assert_eq!(
            ExactFlatIndex::from_bytes(&reserved),
            Err(FlatIndexError::InvalidHeader)
        );

        let mut state = bytes;
        state[HEADER_BYTES + 8] = 2;
        let body_end = state.len() - FOOTER_BYTES;
        let digest = sha256(&state[..body_end]);
        state[body_end..].copy_from_slice(&digest);
        assert_eq!(
            ExactFlatIndex::from_bytes(&state),
            Err(FlatIndexError::InvalidRecordState)
        );
    }

    #[test]
    fn negative_zero_is_canonicalized_and_frozen_calibration_is_identity_only() {
        let index = one_record();
        let bytes = index.to_bytes().expect("bytes");
        let restarted = ExactFlatIndex::from_bytes(&bytes).expect("restart");
        assert_eq!(
            restarted.records.get(&7).expect("record").vector[2].to_bits(),
            0
        );

        let frozen = FlatIndexConfig::from_spec(FlatIndexConfigSpec {
            calibration: CalibrationIdentity::Frozen(hash(8)),
            ..FlatIndexConfigSpec {
                dimension: 4,
                metric: RetrievalMetric::DotProduct,
                normalization: VectorNormalization::None,
                transform: RetrievalTransform::None,
                transform_seed: 0,
                embedding_model_sha256: hash(1),
                tokenizer_sha256: hash(2),
                codebook_sha256: None,
                calibration: CalibrationIdentity::None,
                implementation_sha256: hash(3),
            }
        })
        .expect("frozen config");
        assert_ne!(config(), frozen);
    }
}
