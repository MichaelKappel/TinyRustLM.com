use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt::{Display, Formatter};

use crate::{sha256, RetrievalMetric, SearchHit, VectorNormalization, MAX_FLAT_SEARCH_RESULTS};

/// Largest serialized portable affine-u8 snapshot admitted by the experiment.
pub const MAX_AFFINE_U8_INDEX_BYTES: usize = 512 * 1024 * 1024;
/// Largest coordinate count admitted by the portable affine-u8 experiment.
pub const MAX_AFFINE_U8_DIMENSION: usize = 4096;
/// Largest number of records admitted by the portable affine-u8 experiment.
pub const MAX_AFFINE_U8_RECORDS: usize = 100_000;
/// Exact byte count of the portable affine-u8 snapshot header.
pub const AFFINE_U8_HEADER_BYTES: usize = 64;
/// Exact byte count of the snapshot SHA-256 footer.
pub const AFFINE_U8_FOOTER_BYTES: usize = 32;

const MAGIC: [u8; 8] = *b"TRU8F001";
const FORMAT_VERSION: u16 = 1;
const ENCODING_CODE: u8 = 1;
const BIT_WIDTH: u8 = 8;
const RECORD_ID_BYTES: usize = 8;
const LEVELS_MINUS_ONE: f64 = 255.0;

/// Unvalidated caller input for one portable affine-u8 configuration.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AffineU8ConfigSpec {
    /// Number of coordinates in every record and query.
    pub dimension: usize,
    /// Scalar ranking metric.
    pub metric: RetrievalMetric,
    /// Input normalization applied before calibration or scoring.
    pub normalization: VectorNormalization,
}

/// Validated immutable configuration for one portable affine-u8 snapshot.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AffineU8Config {
    dimension: usize,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
}

impl AffineU8Config {
    /// Validates a configuration before record storage is allocated.
    pub fn from_spec(spec: AffineU8ConfigSpec) -> Result<Self, AffineU8Error> {
        if spec.dimension == 0 || spec.dimension > MAX_AFFINE_U8_DIMENSION {
            return Err(AffineU8Error::DimensionOutOfRange);
        }
        if spec.metric == RetrievalMetric::Cosine
            && spec.normalization != VectorNormalization::L2Unit
        {
            return Err(AffineU8Error::CosineRequiresL2Normalization);
        }
        serialized_length(spec.dimension, 1)?;
        Ok(Self {
            dimension: spec.dimension,
            metric: spec.metric,
            normalization: spec.normalization,
        })
    }

    /// Returns the exact coordinate count.
    pub fn dimension(self) -> usize {
        self.dimension
    }

    /// Returns the configured ranking metric.
    pub fn metric(self) -> RetrievalMetric {
        self.metric
    }

    /// Returns the configured input-normalization rule.
    pub fn normalization(self) -> VectorNormalization {
        self.normalization
    }
}

/// Deterministic rejection from affine-u8 construction, search, or persistence.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AffineU8Error {
    /// A dimension was zero or above the preregistered ceiling.
    DimensionOutOfRange,
    /// Cosine scoring was requested without L2 input normalization.
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
    /// A finite input could not be represented as a finite stored f32.
    NonFiniteStoredVector,
    /// L2 normalization was requested for a zero-norm input.
    ZeroNormVector,
    /// Quantization reconstructed a zero-norm record in a cosine index.
    ZeroNormReconstructedRecord,
    /// The pending snapshot already contains the external identifier.
    DuplicateExternalId,
    /// Global calibration was requested without any records.
    EmptyRecordSet,
    /// A record count exceeded the preregistered ceiling.
    RecordCountOutOfRange,
    /// A search limit was zero or above the shared scalar ceiling.
    SearchLimitOutOfRange,
    /// A byte or count calculation overflowed.
    ArithmeticOverflow,
    /// Serialized input exceeded the preregistered byte ceiling.
    SerializedBytesOutOfRange,
    /// Serialized input was truncated, extended, or length-inconsistent.
    SerializedLengthMismatch,
    /// The eight-byte format magic was not exact.
    InvalidMagic,
    /// The format version was not the preregistered version.
    UnsupportedFormatVersion,
    /// Nonzero flags attempted an undeclared extension.
    UnknownFlags,
    /// A header code, reserved byte, or fixed field was invalid.
    InvalidHeader,
    /// Serialized minimum and maximum values were not canonical.
    InvalidCalibration,
    /// The FIPS 180-4 SHA-256 footer did not match the body.
    DigestMismatch,
    /// Record identifiers were not strictly increasing.
    InvalidRecordOrder,
    /// Serialized codes contradicted the declared calibration.
    NonCanonicalCodes,
    /// A scalar score became nonfinite.
    NonFiniteScore,
}

impl AffineU8Error {
    /// Returns a bounded stable code suitable for native/WASM parity evidence.
    pub const fn code(&self) -> &'static str {
        match self {
            Self::DimensionOutOfRange => "dimension-out-of-range",
            Self::CosineRequiresL2Normalization => "cosine-requires-l2-normalization",
            Self::VectorLengthMismatch { .. } => "vector-length-mismatch",
            Self::NonFiniteVector { .. } => "nonfinite-vector",
            Self::NonFiniteStoredVector => "nonfinite-stored-vector",
            Self::ZeroNormVector => "zero-norm-vector",
            Self::ZeroNormReconstructedRecord => "zero-norm-reconstructed-record",
            Self::DuplicateExternalId => "duplicate-external-id",
            Self::EmptyRecordSet => "empty-record-set",
            Self::RecordCountOutOfRange => "record-count-out-of-range",
            Self::SearchLimitOutOfRange => "search-limit-out-of-range",
            Self::ArithmeticOverflow => "arithmetic-overflow",
            Self::SerializedBytesOutOfRange => "serialized-bytes-out-of-range",
            Self::SerializedLengthMismatch => "serialized-length-mismatch",
            Self::InvalidMagic => "invalid-magic",
            Self::UnsupportedFormatVersion => "unsupported-format-version",
            Self::UnknownFlags => "unknown-flags",
            Self::InvalidHeader => "invalid-header",
            Self::InvalidCalibration => "invalid-calibration",
            Self::DigestMismatch => "digest-mismatch",
            Self::InvalidRecordOrder => "invalid-record-order",
            Self::NonCanonicalCodes => "noncanonical-codes",
            Self::NonFiniteScore => "nonfinite-score",
        }
    }
}

impl Display for AffineU8Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DimensionOutOfRange => write!(formatter, "affine-u8 dimension is out of range"),
            Self::CosineRequiresL2Normalization => {
                write!(formatter, "cosine requires L2 normalization")
            }
            Self::VectorLengthMismatch { expected, actual } => write!(
                formatter,
                "vector length mismatch: expected {expected}, observed {actual}"
            ),
            Self::NonFiniteVector { index } => {
                write!(formatter, "vector coordinate {index} is nonfinite")
            }
            Self::NonFiniteStoredVector => write!(formatter, "stored f32 vector became nonfinite"),
            Self::ZeroNormVector => write!(formatter, "L2-normalized vector has zero norm"),
            Self::ZeroNormReconstructedRecord => {
                write!(formatter, "cosine record reconstructs to zero norm")
            }
            Self::DuplicateExternalId => write!(formatter, "external identifier is duplicated"),
            Self::EmptyRecordSet => write!(formatter, "affine-u8 record set must not be empty"),
            Self::RecordCountOutOfRange => {
                write!(formatter, "affine-u8 record count is out of range")
            }
            Self::SearchLimitOutOfRange => {
                write!(formatter, "affine-u8 search limit is out of range")
            }
            Self::ArithmeticOverflow => write!(formatter, "affine-u8 size calculation overflowed"),
            Self::SerializedBytesOutOfRange => {
                write!(formatter, "serialized affine-u8 bytes are out of range")
            }
            Self::SerializedLengthMismatch => {
                write!(formatter, "serialized affine-u8 length is inconsistent")
            }
            Self::InvalidMagic => write!(formatter, "serialized affine-u8 magic is invalid"),
            Self::UnsupportedFormatVersion => {
                write!(formatter, "serialized affine-u8 version is unsupported")
            }
            Self::UnknownFlags => write!(formatter, "serialized affine-u8 flags are unsupported"),
            Self::InvalidHeader => write!(formatter, "serialized affine-u8 header is invalid"),
            Self::InvalidCalibration => {
                write!(formatter, "serialized affine-u8 calibration is invalid")
            }
            Self::DigestMismatch => {
                write!(formatter, "serialized affine-u8 digest does not match")
            }
            Self::InvalidRecordOrder => {
                write!(formatter, "serialized affine-u8 record order is invalid")
            }
            Self::NonCanonicalCodes => {
                write!(formatter, "serialized affine-u8 codes are noncanonical")
            }
            Self::NonFiniteScore => write!(formatter, "affine-u8 score became nonfinite"),
        }
    }
}

impl Error for AffineU8Error {}

/// Order-independent builder that calibrates one global affine codebook.
#[derive(Clone, Debug, PartialEq)]
pub struct AffineU8IndexBuilder {
    config: AffineU8Config,
    records: BTreeMap<u64, Vec<f32>>,
}

impl AffineU8IndexBuilder {
    /// Creates an empty pending snapshot.
    pub fn new(config: AffineU8Config) -> Self {
        Self {
            config,
            records: BTreeMap::new(),
        }
    }

    /// Adds one unique finite record to the pending generation.
    pub fn insert(&mut self, external_id: u64, vector: &[f32]) -> Result<(), AffineU8Error> {
        if self.records.contains_key(&external_id) {
            return Err(AffineU8Error::DuplicateExternalId);
        }
        let next_count = self
            .records
            .len()
            .checked_add(1)
            .ok_or(AffineU8Error::ArithmeticOverflow)?;
        serialized_length(self.config.dimension, next_count)?;
        let prepared = prepare_vector(self.config, vector)?;
        self.records.insert(external_id, prepared);
        Ok(())
    }

    /// Calibrates and encodes all records in ascending identifier order.
    pub fn finish(self) -> Result<AffineU8Index, AffineU8Error> {
        if self.records.is_empty() {
            return Err(AffineU8Error::EmptyRecordSet);
        }

        let (minimum, maximum) = calibrate(&self.records)?;
        let step = affine_step(minimum, maximum)?;
        let mut encoded = BTreeMap::new();
        for (external_id, vector) in self.records {
            let codes = vector
                .iter()
                .map(|value| encode(*value, minimum, step))
                .collect::<Result<Vec<_>, _>>()?;
            encoded.insert(external_id, codes);
        }
        let index = AffineU8Index {
            config: self.config,
            minimum,
            maximum,
            records: encoded,
        };
        index.validate_code_contract()?;
        Ok(index)
    }
}

/// Immutable exhaustive-search snapshot over globally affine-u8 records.
#[derive(Clone, Debug, PartialEq)]
pub struct AffineU8Index {
    config: AffineU8Config,
    minimum: f32,
    maximum: f32,
    records: BTreeMap<u64, Vec<u8>>,
}

impl AffineU8Index {
    /// Returns the number of encoded records.
    pub fn record_count(&self) -> usize {
        self.records.len()
    }

    /// Returns the validated snapshot configuration.
    pub fn config(&self) -> AffineU8Config {
        self.config
    }

    /// Returns the exact f32 minimum used by global affine calibration.
    pub fn calibration_minimum(&self) -> f32 {
        self.minimum
    }

    /// Returns the exact f32 maximum used by global affine calibration.
    pub fn calibration_maximum(&self) -> f32 {
        self.maximum
    }

    /// Returns whether the snapshot contains an external identifier.
    pub fn contains(&self, external_id: u64) -> bool {
        self.records.contains_key(&external_id)
    }

    /// Scans encoded records in identifier order and returns deterministic ranks.
    pub fn search(
        &self,
        query: &[f32],
        limit: usize,
        allowed_external_ids: Option<&BTreeSet<u64>>,
    ) -> Result<Vec<SearchHit>, AffineU8Error> {
        if limit == 0 || limit > MAX_FLAT_SEARCH_RESULTS {
            return Err(AffineU8Error::SearchLimitOutOfRange);
        }
        let query = prepare_vector(self.config, query)?;
        let step = affine_step(self.minimum, self.maximum)?;
        let mut hits = Vec::with_capacity(self.records.len().min(limit));
        for (external_id, codes) in &self.records {
            if allowed_external_ids.is_some_and(|allowed| !allowed.contains(external_id)) {
                continue;
            }
            let score = score(self.config.metric, &query, codes, self.minimum, step)?;
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

    /// Serializes the canonical `TRU8F001` version-one snapshot.
    pub fn to_bytes(&self) -> Result<Vec<u8>, AffineU8Error> {
        self.validate_code_contract()?;
        let total_bytes = serialized_length(self.config.dimension, self.records.len())?;
        let dimension =
            u32::try_from(self.config.dimension).map_err(|_| AffineU8Error::DimensionOutOfRange)?;
        let record_count =
            u32::try_from(self.records.len()).map_err(|_| AffineU8Error::RecordCountOutOfRange)?;
        let bytes_per_record = u32::try_from(record_bytes(self.config.dimension)?)
            .map_err(|_| AffineU8Error::ArithmeticOverflow)?;

        let mut output = Vec::with_capacity(total_bytes);
        output.extend_from_slice(&MAGIC);
        output.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
        output.extend_from_slice(&(AFFINE_U8_HEADER_BYTES as u16).to_le_bytes());
        output.extend_from_slice(&0_u32.to_le_bytes());
        output.extend_from_slice(&dimension.to_le_bytes());
        output.extend_from_slice(&record_count.to_le_bytes());
        output.push(metric_code(self.config.metric));
        output.push(normalization_code(self.config.normalization));
        output.push(ENCODING_CODE);
        output.push(BIT_WIDTH);
        output.extend_from_slice(&bytes_per_record.to_le_bytes());
        output.extend_from_slice(&self.minimum.to_bits().to_le_bytes());
        output.extend_from_slice(&self.maximum.to_bits().to_le_bytes());
        output.extend_from_slice(&[0_u8; 24]);
        debug_assert_eq!(output.len(), AFFINE_U8_HEADER_BYTES);

        for (external_id, codes) in &self.records {
            output.extend_from_slice(&external_id.to_le_bytes());
            output.extend_from_slice(codes);
        }
        let digest = sha256(&output);
        output.extend_from_slice(&digest);
        debug_assert_eq!(output.len(), total_bytes);
        Ok(output)
    }

    /// Parses and fully validates one canonical affine-u8 snapshot.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, AffineU8Error> {
        if bytes.len() > MAX_AFFINE_U8_INDEX_BYTES {
            return Err(AffineU8Error::SerializedBytesOutOfRange);
        }
        if bytes.len() < AFFINE_U8_HEADER_BYTES + AFFINE_U8_FOOTER_BYTES {
            return Err(AffineU8Error::SerializedLengthMismatch);
        }

        let body_end = bytes.len() - AFFINE_U8_FOOTER_BYTES;
        if sha256(&bytes[..body_end]) != bytes[body_end..] {
            return Err(AffineU8Error::DigestMismatch);
        }
        if bytes[..8] != MAGIC {
            return Err(AffineU8Error::InvalidMagic);
        }
        if read_u16(bytes, 8)? != FORMAT_VERSION {
            return Err(AffineU8Error::UnsupportedFormatVersion);
        }
        if usize::from(read_u16(bytes, 10)?) != AFFINE_U8_HEADER_BYTES {
            return Err(AffineU8Error::InvalidHeader);
        }
        if read_u32(bytes, 12)? != 0 {
            return Err(AffineU8Error::UnknownFlags);
        }

        let dimension = usize::try_from(read_u32(bytes, 16)?)
            .map_err(|_| AffineU8Error::DimensionOutOfRange)?;
        let record_count = usize::try_from(read_u32(bytes, 20)?)
            .map_err(|_| AffineU8Error::RecordCountOutOfRange)?;
        let expected_length = serialized_length(dimension, record_count)?;
        if bytes.len() != expected_length {
            return Err(AffineU8Error::SerializedLengthMismatch);
        }
        if record_count == 0 {
            return Err(AffineU8Error::EmptyRecordSet);
        }
        if bytes[26] != ENCODING_CODE
            || bytes[27] != BIT_WIDTH
            || bytes[40..AFFINE_U8_HEADER_BYTES]
                .iter()
                .any(|value| *value != 0)
        {
            return Err(AffineU8Error::InvalidHeader);
        }
        if usize::try_from(read_u32(bytes, 28)?).map_err(|_| AffineU8Error::InvalidHeader)?
            != record_bytes(dimension)?
        {
            return Err(AffineU8Error::InvalidHeader);
        }

        let metric = metric_from_code(bytes[24])?;
        let normalization = normalization_from_code(bytes[25])?;
        let config = AffineU8Config::from_spec(AffineU8ConfigSpec {
            dimension,
            metric,
            normalization,
        })?;
        let minimum = canonical_calibration_value(read_f32(bytes, 32)?)?;
        let maximum = canonical_calibration_value(read_f32(bytes, 36)?)?;
        if minimum > maximum {
            return Err(AffineU8Error::InvalidCalibration);
        }

        let mut records = BTreeMap::new();
        let mut previous_id = None;
        let record_bytes = record_bytes(dimension)?;
        let mut offset = AFFINE_U8_HEADER_BYTES;
        for _ in 0..record_count {
            let external_id = read_u64(bytes, offset)?;
            if previous_id.is_some_and(|previous| external_id <= previous) {
                return Err(AffineU8Error::InvalidRecordOrder);
            }
            previous_id = Some(external_id);
            let code_start = offset
                .checked_add(RECORD_ID_BYTES)
                .ok_or(AffineU8Error::ArithmeticOverflow)?;
            let code_end = code_start
                .checked_add(dimension)
                .ok_or(AffineU8Error::ArithmeticOverflow)?;
            let codes = bytes
                .get(code_start..code_end)
                .ok_or(AffineU8Error::SerializedLengthMismatch)?
                .to_vec();
            records.insert(external_id, codes);
            offset = offset
                .checked_add(record_bytes)
                .ok_or(AffineU8Error::ArithmeticOverflow)?;
        }
        if offset != body_end {
            return Err(AffineU8Error::SerializedLengthMismatch);
        }

        let index = Self {
            config,
            minimum,
            maximum,
            records,
        };
        index.validate_code_contract()?;
        Ok(index)
    }

    fn validate_code_contract(&self) -> Result<(), AffineU8Error> {
        if self.records.is_empty() {
            return Err(AffineU8Error::EmptyRecordSet);
        }
        if !self.minimum.is_finite()
            || !self.maximum.is_finite()
            || is_negative_zero(self.minimum)
            || is_negative_zero(self.maximum)
            || self.minimum > self.maximum
        {
            return Err(AffineU8Error::InvalidCalibration);
        }
        let constant = self.minimum == self.maximum;
        let mut saw_zero = false;
        let mut saw_maximum = false;
        let step = affine_step(self.minimum, self.maximum)?;
        for codes in self.records.values() {
            if codes.len() != self.config.dimension {
                return Err(AffineU8Error::NonCanonicalCodes);
            }
            if constant && codes.iter().any(|code| *code != 0) {
                return Err(AffineU8Error::NonCanonicalCodes);
            }
            saw_zero |= codes.contains(&0);
            saw_maximum |= codes.contains(&u8::MAX);
            if self.config.metric == RetrievalMetric::Cosine {
                validate_reconstructed_cosine_norm(codes, self.minimum, step)?;
            }
        }
        if !constant && (!saw_zero || !saw_maximum) {
            return Err(AffineU8Error::NonCanonicalCodes);
        }
        Ok(())
    }
}

fn calibrate(records: &BTreeMap<u64, Vec<f32>>) -> Result<(f32, f32), AffineU8Error> {
    let mut minimum = f32::INFINITY;
    let mut maximum = f32::NEG_INFINITY;
    for vector in records.values() {
        for value in vector {
            if !value.is_finite() {
                return Err(AffineU8Error::NonFiniteStoredVector);
            }
            minimum = minimum.min(*value);
            maximum = maximum.max(*value);
        }
    }
    Ok((
        canonical_calibration_value(minimum)?,
        canonical_calibration_value(maximum)?,
    ))
}

fn canonical_calibration_value(value: f32) -> Result<f32, AffineU8Error> {
    if !value.is_finite() || is_negative_zero(value) {
        return Err(AffineU8Error::InvalidCalibration);
    }
    Ok(value)
}

fn affine_step(minimum: f32, maximum: f32) -> Result<f64, AffineU8Error> {
    if !minimum.is_finite() || !maximum.is_finite() || minimum > maximum {
        return Err(AffineU8Error::InvalidCalibration);
    }
    if minimum == maximum {
        return Ok(0.0);
    }
    let step = (f64::from(maximum) - f64::from(minimum)) / LEVELS_MINUS_ONE;
    if !step.is_finite() || step <= 0.0 {
        return Err(AffineU8Error::InvalidCalibration);
    }
    Ok(step)
}

fn encode(value: f32, minimum: f32, step: f64) -> Result<u8, AffineU8Error> {
    if step == 0.0 {
        return Ok(0);
    }
    let normalized = (f64::from(value) - f64::from(minimum)) / step;
    if !normalized.is_finite() {
        return Err(AffineU8Error::NonFiniteStoredVector);
    }
    let rounded = (normalized.clamp(0.0, LEVELS_MINUS_ONE) + 0.5).floor();
    Ok(rounded as u8)
}

fn decode(code: u8, minimum: f32, step: f64) -> f64 {
    if step == 0.0 {
        f64::from(minimum)
    } else {
        f64::from(minimum) + f64::from(code) * step
    }
}

fn prepare_vector(config: AffineU8Config, input: &[f32]) -> Result<Vec<f32>, AffineU8Error> {
    if input.len() != config.dimension {
        return Err(AffineU8Error::VectorLengthMismatch {
            expected: config.dimension,
            actual: input.len(),
        });
    }
    let mut values = Vec::with_capacity(input.len());
    for (index, value) in input.iter().enumerate() {
        if !value.is_finite() {
            return Err(AffineU8Error::NonFiniteVector { index });
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
                return Err(AffineU8Error::NonFiniteStoredVector);
            }
        }
        if squared_norm == 0.0 {
            return Err(AffineU8Error::ZeroNormVector);
        }
        let inverse_norm = squared_norm.sqrt().recip();
        for value in &mut values {
            *value *= inverse_norm;
        }
    }
    values
        .into_iter()
        .map(|value| {
            let stored = value as f32;
            if !stored.is_finite() {
                Err(AffineU8Error::NonFiniteStoredVector)
            } else {
                Ok(if stored == 0.0 { 0.0 } else { stored })
            }
        })
        .collect()
}

fn score(
    metric: RetrievalMetric,
    query: &[f32],
    codes: &[u8],
    minimum: f32,
    step: f64,
) -> Result<f64, AffineU8Error> {
    let result = match metric {
        RetrievalMetric::DotProduct => {
            let mut sum = NeumaierSum::default();
            for (query_value, code) in query.iter().zip(codes) {
                sum.add(f64::from(*query_value) * decode(*code, minimum, step))?;
            }
            sum.finish()?
        }
        RetrievalMetric::SquaredEuclidean => {
            let mut sum = NeumaierSum::default();
            for (query_value, code) in query.iter().zip(codes) {
                let difference = f64::from(*query_value) - decode(*code, minimum, step);
                sum.add(difference * difference)?;
            }
            sum.finish()?
        }
        RetrievalMetric::Cosine => {
            let norm = reconstructed_norm(codes, minimum, step)?;
            if norm == 0.0 {
                return Err(AffineU8Error::ZeroNormReconstructedRecord);
            }
            let inverse_norm = norm.recip();
            let mut sum = NeumaierSum::default();
            for (query_value, code) in query.iter().zip(codes) {
                sum.add(f64::from(*query_value) * decode(*code, minimum, step) * inverse_norm)?;
            }
            sum.finish()?
        }
    };
    if !result.is_finite() {
        return Err(AffineU8Error::NonFiniteScore);
    }
    Ok(if result == 0.0 { 0.0 } else { result })
}

fn validate_reconstructed_cosine_norm(
    codes: &[u8],
    minimum: f32,
    step: f64,
) -> Result<(), AffineU8Error> {
    if reconstructed_norm(codes, minimum, step)? == 0.0 {
        Err(AffineU8Error::ZeroNormReconstructedRecord)
    } else {
        Ok(())
    }
}

fn reconstructed_norm(codes: &[u8], minimum: f32, step: f64) -> Result<f64, AffineU8Error> {
    let mut squared_norm = NeumaierSum::default();
    for code in codes {
        let value = decode(*code, minimum, step);
        squared_norm.add(value * value)?;
    }
    let squared_norm = squared_norm.finish()?;
    if squared_norm < 0.0 || !squared_norm.is_finite() {
        return Err(AffineU8Error::NonFiniteScore);
    }
    let norm = squared_norm.sqrt();
    if norm.is_finite() {
        Ok(norm)
    } else {
        Err(AffineU8Error::NonFiniteScore)
    }
}

#[derive(Clone, Copy, Debug, Default)]
struct NeumaierSum {
    sum: f64,
    correction: f64,
}

impl NeumaierSum {
    fn add(&mut self, value: f64) -> Result<(), AffineU8Error> {
        if !value.is_finite() {
            return Err(AffineU8Error::NonFiniteScore);
        }
        let next = self.sum + value;
        if !next.is_finite() {
            return Err(AffineU8Error::NonFiniteScore);
        }
        if self.sum.abs() >= value.abs() {
            self.correction += (self.sum - next) + value;
        } else {
            self.correction += (value - next) + self.sum;
        }
        if !self.correction.is_finite() {
            return Err(AffineU8Error::NonFiniteScore);
        }
        self.sum = next;
        Ok(())
    }

    fn finish(self) -> Result<f64, AffineU8Error> {
        let result = self.sum + self.correction;
        if result.is_finite() {
            Ok(result)
        } else {
            Err(AffineU8Error::NonFiniteScore)
        }
    }
}

fn metric_code(metric: RetrievalMetric) -> u8 {
    match metric {
        RetrievalMetric::DotProduct => 1,
        RetrievalMetric::SquaredEuclidean => 2,
        RetrievalMetric::Cosine => 3,
    }
}

fn metric_from_code(code: u8) -> Result<RetrievalMetric, AffineU8Error> {
    match code {
        1 => Ok(RetrievalMetric::DotProduct),
        2 => Ok(RetrievalMetric::SquaredEuclidean),
        3 => Ok(RetrievalMetric::Cosine),
        _ => Err(AffineU8Error::InvalidHeader),
    }
}

fn normalization_code(normalization: VectorNormalization) -> u8 {
    match normalization {
        VectorNormalization::None => 0,
        VectorNormalization::L2Unit => 1,
    }
}

fn normalization_from_code(code: u8) -> Result<VectorNormalization, AffineU8Error> {
    match code {
        0 => Ok(VectorNormalization::None),
        1 => Ok(VectorNormalization::L2Unit),
        _ => Err(AffineU8Error::InvalidHeader),
    }
}

fn record_bytes(dimension: usize) -> Result<usize, AffineU8Error> {
    dimension
        .checked_add(RECORD_ID_BYTES)
        .ok_or(AffineU8Error::ArithmeticOverflow)
}

fn serialized_length(dimension: usize, record_count: usize) -> Result<usize, AffineU8Error> {
    if dimension == 0 || dimension > MAX_AFFINE_U8_DIMENSION {
        return Err(AffineU8Error::DimensionOutOfRange);
    }
    if record_count > MAX_AFFINE_U8_RECORDS {
        return Err(AffineU8Error::RecordCountOutOfRange);
    }
    let total = record_bytes(dimension)?
        .checked_mul(record_count)
        .and_then(|bytes| bytes.checked_add(AFFINE_U8_HEADER_BYTES + AFFINE_U8_FOOTER_BYTES))
        .ok_or(AffineU8Error::ArithmeticOverflow)?;
    if total > MAX_AFFINE_U8_INDEX_BYTES {
        return Err(AffineU8Error::SerializedBytesOutOfRange);
    }
    Ok(total)
}

fn is_negative_zero(value: f32) -> bool {
    value.to_bits() == (-0.0_f32).to_bits()
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, AffineU8Error> {
    let end = offset
        .checked_add(2)
        .ok_or(AffineU8Error::ArithmeticOverflow)?;
    let word = bytes
        .get(offset..end)
        .ok_or(AffineU8Error::SerializedLengthMismatch)?;
    Ok(u16::from_le_bytes(word.try_into().expect("two-byte word")))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, AffineU8Error> {
    let end = offset
        .checked_add(4)
        .ok_or(AffineU8Error::ArithmeticOverflow)?;
    let word = bytes
        .get(offset..end)
        .ok_or(AffineU8Error::SerializedLengthMismatch)?;
    Ok(u32::from_le_bytes(word.try_into().expect("four-byte word")))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, AffineU8Error> {
    let end = offset
        .checked_add(8)
        .ok_or(AffineU8Error::ArithmeticOverflow)?;
    let word = bytes
        .get(offset..end)
        .ok_or(AffineU8Error::SerializedLengthMismatch)?;
    Ok(u64::from_le_bytes(
        word.try_into().expect("eight-byte word"),
    ))
}

fn read_f32(bytes: &[u8], offset: usize) -> Result<f32, AffineU8Error> {
    Ok(f32::from_bits(read_u32(bytes, offset)?))
}

#[cfg(test)]
mod tests {
    use super::{
        affine_step, decode, AffineU8Config, AffineU8ConfigSpec, AffineU8Error, AffineU8Index,
        AffineU8IndexBuilder, AFFINE_U8_FOOTER_BYTES, AFFINE_U8_HEADER_BYTES,
    };
    use crate::{sha256, RetrievalMetric, VectorNormalization};

    fn config(
        dimension: usize,
        metric: RetrievalMetric,
        normalization: VectorNormalization,
    ) -> AffineU8Config {
        AffineU8Config::from_spec(AffineU8ConfigSpec {
            dimension,
            metric,
            normalization,
        })
        .expect("valid affine-u8 config")
    }

    #[test]
    fn calibration_uses_endpoint_codes_and_canonicalizes_negative_zero() {
        let mut builder = AffineU8IndexBuilder::new(config(
            3,
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
        ));
        builder.insert(2, &[5.0, -0.0, 2.0]).expect("record");
        builder.insert(1, &[-3.0, 1.0, 4.0]).expect("record");
        let index = builder.finish().expect("index");

        assert_eq!(index.minimum, -3.0);
        assert_eq!(index.maximum, 5.0);
        assert!(index.records.values().flatten().any(|code| *code == 0));
        assert!(index.records.values().flatten().any(|code| *code == 255));
        let zero_code = index.records.get(&2).expect("record")[1];
        let reconstructed = decode(
            zero_code,
            index.minimum,
            affine_step(index.minimum, index.maximum).expect("step"),
        );
        assert!(reconstructed.abs() < 0.02);
    }

    #[test]
    fn constant_lane_uses_only_zero_codes_and_exact_reconstruction() {
        let mut builder = AffineU8IndexBuilder::new(config(
            2,
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
        ));
        builder.insert(1, &[4.0, 4.0]).expect("record");
        builder.insert(2, &[4.0, 4.0]).expect("record");
        let index = builder.finish().expect("index");

        assert_eq!(index.minimum, 4.0);
        assert_eq!(index.maximum, 4.0);
        assert!(index.records.values().flatten().all(|code| *code == 0));
        let hits = index.search(&[1.0, 1.0], 2, None).expect("search");
        assert_eq!(hits[0].external_id, 1);
        assert_eq!(hits[0].score, 8.0);
        assert_eq!(hits[1].score, 8.0);
    }

    #[test]
    fn recomputed_digest_still_rejects_unknown_header_and_noncanonical_codes() {
        let mut builder = AffineU8IndexBuilder::new(config(
            2,
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
        ));
        builder.insert(1, &[1.0, 2.0]).expect("record");
        let bytes = builder.finish().expect("index").to_bytes().expect("bytes");

        let mut reserved = bytes.clone();
        reserved[40] = 1;
        let body_end = reserved.len() - AFFINE_U8_FOOTER_BYTES;
        let digest = sha256(&reserved[..body_end]);
        reserved[body_end..].copy_from_slice(&digest);
        assert_eq!(
            AffineU8Index::from_bytes(&reserved),
            Err(AffineU8Error::InvalidHeader)
        );

        let mut constant = bytes;
        constant[32..36].copy_from_slice(&1.0_f32.to_bits().to_le_bytes());
        constant[36..40].copy_from_slice(&1.0_f32.to_bits().to_le_bytes());
        constant[AFFINE_U8_HEADER_BYTES + 8] = 1;
        let body_end = constant.len() - AFFINE_U8_FOOTER_BYTES;
        let digest = sha256(&constant[..body_end]);
        constant[body_end..].copy_from_slice(&digest);
        assert_eq!(
            AffineU8Index::from_bytes(&constant),
            Err(AffineU8Error::NonCanonicalCodes)
        );
    }
}
