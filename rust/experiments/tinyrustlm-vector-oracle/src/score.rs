use crate::bitpack::{pack_unsigned_codes, read_packed_code, validate_packed};
use crate::error::require_finite;
use crate::{OracleError, ScalarCodebook};

/// Immutable canonical packed codes used by direct scalar scoring oracles.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PackedVector {
    count: usize,
    bit_width: u8,
    bytes: Vec<u8>,
}

impl PackedVector {
    /// Encodes unsigned code indices into the canonical packed bitstream.
    pub fn from_codes(codes: &[u32], bit_width: u8) -> Result<Self, OracleError> {
        Ok(Self {
            count: codes.len(),
            bit_width,
            bytes: pack_unsigned_codes(codes, bit_width)?,
        })
    }

    /// Validates and adopts canonical caller-provided packed bytes.
    pub fn from_bytes(bytes: Vec<u8>, count: usize, bit_width: u8) -> Result<Self, OracleError> {
        validate_packed(&bytes, count, bit_width)?;
        Ok(Self {
            count,
            bit_width,
            bytes,
        })
    }

    /// Returns the declared number of scalar codes.
    pub fn len(&self) -> usize {
        self.count
    }

    /// Returns whether this packed vector contains no codes.
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    /// Returns the exact fixed code width in bits.
    pub fn bit_width(&self) -> u8 {
        self.bit_width
    }

    /// Returns canonical payload bytes without interpreting them as a model format.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Reads one packed code without reconstructing the vector.
    pub fn code_at(&self, index: usize) -> Result<u32, OracleError> {
        read_packed_code(&self.bytes, self.count, self.bit_width, index)
    }

    /// Computes a scalar packed-domain dot product through codebook lookups.
    pub fn dot(
        &self,
        other: &Self,
        self_codebook: &ScalarCodebook,
        other_codebook: &ScalarCodebook,
    ) -> Result<f64, OracleError> {
        self.validate_pair(other)?;
        let mut accumulator = CompensatedSum::default();
        for index in 0..self.count {
            let left = self_codebook.decode(self.code_at(index)?)?;
            let right = other_codebook.decode(other.code_at(index)?)?;
            accumulator.add(left * right)?;
        }
        accumulator.total()
    }

    /// Computes squared Euclidean distance through codebook lookups.
    pub fn squared_distance(
        &self,
        other: &Self,
        self_codebook: &ScalarCodebook,
        other_codebook: &ScalarCodebook,
    ) -> Result<f64, OracleError> {
        self.validate_pair(other)?;
        let mut accumulator = CompensatedSum::default();
        for index in 0..self.count {
            let left = self_codebook.decode(self.code_at(index)?)?;
            let right = other_codebook.decode(other.code_at(index)?)?;
            let difference = left - right;
            accumulator.add(difference * difference)?;
        }
        accumulator.total()
    }

    /// Computes a dense-query dot product without reconstructing packed values.
    pub fn dot_dense(&self, dense: &[f64], codebook: &ScalarCodebook) -> Result<f64, OracleError> {
        if dense.len() != self.count {
            return Err(OracleError::LengthMismatch {
                expected: self.count,
                actual: dense.len(),
            });
        }
        if self.is_empty() {
            return Err(OracleError::EmptyInput);
        }
        require_finite(dense)?;
        let mut accumulator = CompensatedSum::default();
        for (index, dense_value) in dense.iter().enumerate() {
            accumulator.add(codebook.decode(self.code_at(index)?)? * dense_value)?;
        }
        accumulator.total()
    }

    /// Requires equal, nonempty dimensions before pairwise packed scoring.
    fn validate_pair(&self, other: &Self) -> Result<(), OracleError> {
        if self.count != other.count {
            return Err(OracleError::LengthMismatch {
                expected: self.count,
                actual: other.count,
            });
        }
        if self.is_empty() {
            return Err(OracleError::EmptyInput);
        }
        Ok(())
    }
}

/// Neumaier-style compensated sum used by scalar high-precision references.
#[derive(Clone, Copy, Debug, Default)]
struct CompensatedSum {
    sum: f64,
    correction: f64,
}

impl CompensatedSum {
    /// Adds one finite term and rejects overflow instead of returning infinity.
    fn add(&mut self, value: f64) -> Result<(), OracleError> {
        if !value.is_finite() {
            return Err(OracleError::NonFiniteResult);
        }
        let updated = self.sum + value;
        if !updated.is_finite() {
            return Err(OracleError::NonFiniteResult);
        }
        if self.sum.abs() >= value.abs() {
            self.correction += (self.sum - updated) + value;
        } else {
            self.correction += (value - updated) + self.sum;
        }
        if !self.correction.is_finite() {
            return Err(OracleError::NonFiniteResult);
        }
        self.sum = updated;
        Ok(())
    }

    /// Returns the corrected finite result after all terms are observed.
    fn total(self) -> Result<f64, OracleError> {
        let total = self.sum + self.correction;
        if total.is_finite() {
            Ok(total)
        } else {
            Err(OracleError::NonFiniteResult)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PackedVector;
    use crate::{OracleError, ScalarCodebook};

    /// Computes an independent dense f64 dot product for comparison.
    fn dense_dot(left: &[f64], right: &[f64]) -> f64 {
        left.iter().zip(right).map(|(a, b)| a * b).sum()
    }

    /// Computes independent dense f64 squared distance for comparison.
    fn dense_distance(left: &[f64], right: &[f64]) -> f64 {
        left.iter()
            .zip(right)
            .map(|(a, b)| {
                let difference = a - b;
                difference * difference
            })
            .sum()
    }

    /// Direct packed scores match separately reconstructed f64 references.
    #[test]
    fn packed_dot_and_distance_match_dense_oracles() {
        let left_book =
            ScalarCodebook::from_centroids(vec![-3.0, -1.0, 2.0, 5.0]).expect("left codebook");
        let right_book =
            ScalarCodebook::from_centroids(vec![-4.0, 0.5, 1.5, 7.0]).expect("right codebook");
        let left_codes = vec![0, 1, 2, 3, 2, 1, 0];
        let right_codes = vec![3, 2, 1, 0, 1, 2, 3];
        let left = PackedVector::from_codes(&left_codes, 2).expect("left packed");
        let right = PackedVector::from_codes(&right_codes, 2).expect("right packed");
        let left_dense = left_book.decode_all(&left_codes).expect("left dense");
        let right_dense = right_book.decode_all(&right_codes).expect("right dense");

        assert_eq!(
            left.dot(&right, &left_book, &right_book),
            Ok(dense_dot(&left_dense, &right_dense))
        );
        assert_eq!(
            left.squared_distance(&right, &left_book, &right_book),
            Ok(dense_distance(&left_dense, &right_dense))
        );
        assert_eq!(
            left.dot_dense(&right_dense, &left_book),
            Ok(dense_dot(&left_dense, &right_dense))
        );
    }

    /// Canonical byte adoption preserves identity and exposes bounded metadata.
    #[test]
    fn canonical_bytes_can_be_validated_without_reencoding() {
        let original = PackedVector::from_codes(&[1, 3, 7, 0, 2], 3).expect("packed");
        let adopted = PackedVector::from_bytes(original.bytes().to_vec(), 5, 3).expect("adopted");

        assert_eq!(adopted, original);
        assert_eq!(adopted.len(), 5);
        assert!(!adopted.is_empty());
        assert_eq!(adopted.bit_width(), 3);
        assert_eq!(adopted.code_at(2), Ok(7));
        assert_eq!(
            adopted.code_at(5),
            Err(OracleError::PackedCodeIndexOutOfRange { index: 5, count: 5 })
        );
    }

    /// Shape, empty input, dense finiteness, and codebook bounds fail explicitly.
    #[test]
    fn score_input_contracts_reject_ambiguous_results() {
        let codebook = ScalarCodebook::from_centroids(vec![-1.0, 1.0]).expect("codebook");
        let two = PackedVector::from_codes(&[0, 1], 1).expect("two");
        let one = PackedVector::from_codes(&[0], 1).expect("one");
        let empty = PackedVector::from_codes(&[], 1).expect("empty");
        let bad_code = PackedVector::from_codes(&[3], 2).expect("bad code payload");

        assert_eq!(
            two.dot(&one, &codebook, &codebook),
            Err(OracleError::LengthMismatch {
                expected: 2,
                actual: 1,
            })
        );
        assert_eq!(
            empty.dot(&empty, &codebook, &codebook),
            Err(OracleError::EmptyInput)
        );
        assert_eq!(
            two.dot_dense(&[1.0], &codebook),
            Err(OracleError::LengthMismatch {
                expected: 2,
                actual: 1,
            })
        );
        assert_eq!(
            two.dot_dense(&[f64::NAN, 1.0], &codebook),
            Err(OracleError::NonFiniteInput { index: 0 })
        );
        assert_eq!(
            bad_code.dot_dense(&[1.0], &codebook),
            Err(OracleError::CodebookIndexOutOfRange { code: 3, levels: 2 })
        );
    }

    /// Non-finite products and accumulations are rejected instead of saturated.
    #[test]
    fn score_overflow_is_explicit() {
        let codebook =
            ScalarCodebook::from_centroids(vec![f64::MAX / 2.0]).expect("finite codebook");
        let packed = PackedVector::from_codes(&[0, 0], 1).expect("packed");
        assert_eq!(
            packed.dot(&packed, &codebook, &codebook),
            Err(OracleError::NonFiniteResult)
        );
    }
}
