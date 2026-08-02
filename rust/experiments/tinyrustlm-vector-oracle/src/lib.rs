//! Independent scalar numerical oracles for pre-product vector experiments.
//!
//! This crate deliberately has no dependencies and no TinyRustLM runtime
//! integration. It defines correctness references, not a product format or a
//! performance implementation.

#![forbid(unsafe_code)]

mod accounting;
mod affine_u8_index;
mod bitpack;
mod codebook;
mod error;
mod flat_index;
mod metrics;
mod prng;
mod score;
mod sha256;
mod transform;

pub use accounting::StorageAccounting;
pub use affine_u8_index::{
    AffineU8Config, AffineU8ConfigSpec, AffineU8Error, AffineU8Index, AffineU8IndexBuilder,
    AFFINE_U8_FOOTER_BYTES, AFFINE_U8_HEADER_BYTES, MAX_AFFINE_U8_DIMENSION,
    MAX_AFFINE_U8_INDEX_BYTES, MAX_AFFINE_U8_RECORDS,
};
pub use bitpack::{
    pack_signed_codes, pack_unsigned_codes, packed_byte_len, unpack_signed_codes,
    unpack_unsigned_codes, MAX_CODE_COUNT, MAX_CODE_WIDTH,
};
pub use codebook::{ScalarCodebook, WeightedSample, MAX_CODEBOOK_LEVELS, MAX_LLOYD_ITERATIONS};
pub use error::OracleError;
pub use flat_index::{
    CalibrationIdentity, ExactFlatIndex, ExactFlatIndexBuilder, FlatIndexConfig,
    FlatIndexConfigSpec, FlatIndexError, RetrievalMetric, RetrievalTransform, SearchHit,
    VectorNormalization, MAX_FLAT_INDEX_BYTES, MAX_FLAT_RECORDS, MAX_FLAT_SEARCH_RESULTS,
};
pub use metrics::{DistortionMetrics, RankOrderMetrics, ScoreErrorMetrics};
pub use prng::DeterministicRng;
pub use score::PackedVector;
pub use sha256::sha256;
pub use transform::{TransformFamily, TransformPlan, MAX_VECTOR_DIMENSION};
