use std::error::Error;
use std::fmt::{Display, Formatter};

/// Describes a bounded, deterministic rejection from the scalar oracle.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OracleError {
    /// A required input collection was empty.
    EmptyInput,
    /// A vector dimension was zero or exceeded the experimental ceiling.
    DimensionOutOfRange {
        /// Requested dimension.
        dimension: usize,
        /// Largest accepted dimension.
        maximum: usize,
    },
    /// Two related slices or declared dimensions did not agree.
    LengthMismatch {
        /// Required number of elements.
        expected: usize,
        /// Observed number of elements.
        actual: usize,
    },
    /// A floating-point input was NaN or infinite.
    NonFiniteInput {
        /// Index of the rejected value.
        index: usize,
    },
    /// A finite input produced a non-finite arithmetic result.
    NonFiniteResult,
    /// A transform family does not define the requested dimension.
    UnsupportedDimension {
        /// Stable transform-family name.
        family: &'static str,
        /// Rejected dimension.
        dimension: usize,
    },
    /// A packed-code width was outside the scalar format's admitted range.
    InvalidBitWidth {
        /// Rejected width in bits.
        width: u8,
        /// Largest accepted width in bits.
        maximum: u8,
    },
    /// A code collection exceeded the bounded scalar experiment ceiling.
    CodeCountOutOfRange {
        /// Requested number of codes.
        count: usize,
        /// Largest accepted number of codes.
        maximum: usize,
    },
    /// An unsigned code could not be represented at the declared width.
    UnsignedCodeOutOfRange {
        /// Index of the rejected code.
        index: usize,
        /// Rejected code value.
        code: u32,
        /// Largest representable code.
        maximum: u32,
    },
    /// A signed code could not be represented at the declared width.
    SignedCodeOutOfRange {
        /// Index of the rejected code.
        index: usize,
        /// Rejected signed value.
        code: i32,
        /// Smallest representable value.
        minimum: i32,
        /// Largest representable value.
        maximum: i32,
    },
    /// Packed bytes did not have the one canonical length for the declaration.
    PackedLengthMismatch {
        /// Required byte count.
        expected: usize,
        /// Observed byte count.
        actual: usize,
    },
    /// Bits outside the declared final code were nonzero.
    NonZeroTailPadding,
    /// A count or byte calculation exceeded the host integer range.
    ArithmeticOverflow,
    /// A scalar codebook requested zero, too many, or too many-for-input levels.
    LevelCountOutOfRange {
        /// Requested centroid count.
        levels: usize,
        /// Largest accepted centroid count for this input.
        maximum: usize,
    },
    /// A Lloyd iteration budget was zero or exceeded the experiment ceiling.
    IterationCountOutOfRange {
        /// Requested iteration count.
        iterations: usize,
        /// Largest accepted iteration count.
        maximum: usize,
    },
    /// A discrete sample weight was zero, negative, NaN, or infinite.
    InvalidWeight {
        /// Index of the rejected weighted sample.
        index: usize,
    },
    /// Deterministic reassignment left one Lloyd cluster without mass.
    EmptyCluster {
        /// Index of the empty cluster.
        cluster: usize,
    },
    /// Supplied codebook centroids were not finite and strictly increasing.
    InvalidCentroidOrder {
        /// Index at which the order contract failed.
        index: usize,
    },
    /// Lloyd updates did not converge within the declared budget.
    DidNotConverge {
        /// Exhausted update count.
        iterations: usize,
    },
    /// A code index did not identify a centroid.
    CodebookIndexOutOfRange {
        /// Rejected codebook index.
        code: u32,
        /// Number of available centroids.
        levels: usize,
    },
    /// A packed-vector position was outside its declared code count.
    PackedCodeIndexOutOfRange {
        /// Rejected zero-based position.
        index: usize,
        /// Declared number of packed codes.
        count: usize,
    },
    /// A tolerance parameter was negative, NaN, or infinite.
    InvalidTolerance,
}

impl Display for OracleError {
    /// Formats the stable experimental rejection without embedding input data.
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyInput => write!(formatter, "input must not be empty"),
            Self::DimensionOutOfRange { dimension, maximum } => write!(
                formatter,
                "dimension {dimension} is outside the accepted range 1..={maximum}"
            ),
            Self::LengthMismatch { expected, actual } => write!(
                formatter,
                "length mismatch: expected {expected}, observed {actual}"
            ),
            Self::NonFiniteInput { index } => {
                write!(formatter, "input at index {index} is not finite")
            }
            Self::NonFiniteResult => write!(formatter, "operation produced a non-finite result"),
            Self::UnsupportedDimension { family, dimension } => write!(
                formatter,
                "transform family {family} does not support dimension {dimension}"
            ),
            Self::InvalidBitWidth { width, maximum } => write!(
                formatter,
                "bit width {width} is outside the accepted range 1..={maximum}"
            ),
            Self::CodeCountOutOfRange { count, maximum } => write!(
                formatter,
                "code count {count} is outside the accepted range 0..={maximum}"
            ),
            Self::UnsignedCodeOutOfRange {
                index,
                code,
                maximum,
            } => write!(
                formatter,
                "unsigned code {code} at index {index} exceeds {maximum}"
            ),
            Self::SignedCodeOutOfRange {
                index,
                code,
                minimum,
                maximum,
            } => write!(
                formatter,
                "signed code {code} at index {index} is outside {minimum}..={maximum}"
            ),
            Self::PackedLengthMismatch { expected, actual } => write!(
                formatter,
                "packed length mismatch: expected {expected}, observed {actual}"
            ),
            Self::NonZeroTailPadding => write!(formatter, "packed tail padding must be zero"),
            Self::ArithmeticOverflow => write!(formatter, "bounded size calculation overflowed"),
            Self::LevelCountOutOfRange { levels, maximum } => write!(
                formatter,
                "level count {levels} is outside the accepted range 1..={maximum}"
            ),
            Self::IterationCountOutOfRange {
                iterations,
                maximum,
            } => write!(
                formatter,
                "iteration count {iterations} is outside the accepted range 1..={maximum}"
            ),
            Self::InvalidWeight { index } => {
                write!(formatter, "sample weight at index {index} is invalid")
            }
            Self::EmptyCluster { cluster } => {
                write!(formatter, "Lloyd cluster {cluster} has no sample mass")
            }
            Self::InvalidCentroidOrder { index } => write!(
                formatter,
                "centroid at index {index} is not finite and strictly increasing"
            ),
            Self::DidNotConverge { iterations } => write!(
                formatter,
                "Lloyd updates did not converge within {iterations} iterations"
            ),
            Self::CodebookIndexOutOfRange { code, levels } => write!(
                formatter,
                "codebook index {code} does not identify one of {levels} centroids"
            ),
            Self::PackedCodeIndexOutOfRange { index, count } => {
                write!(formatter, "packed-code index {index} is outside 0..{count}")
            }
            Self::InvalidTolerance => {
                write!(formatter, "tolerance must be finite and nonnegative")
            }
        }
    }
}

impl Error for OracleError {}

/// Verifies that all floating-point values are finite before oracle work.
pub(crate) fn require_finite(values: &[f64]) -> Result<(), OracleError> {
    for (index, value) in values.iter().enumerate() {
        if !value.is_finite() {
            return Err(OracleError::NonFiniteInput { index });
        }
    }
    Ok(())
}

/// Verifies that a computed vector stayed finite after arithmetic.
pub(crate) fn require_finite_result(values: &[f64]) -> Result<(), OracleError> {
    if values.iter().all(|value| value.is_finite()) {
        Ok(())
    } else {
        Err(OracleError::NonFiniteResult)
    }
}
