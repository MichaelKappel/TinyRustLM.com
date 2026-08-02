use crate::error::{require_finite, require_finite_result};
use crate::{DeterministicRng, OracleError};

/// Hard allocation ceiling for the scalar experiment.
pub const MAX_VECTOR_DIMENSION: usize = 1_048_576;

/// Orthogonal transform families admitted by the first scalar oracle.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransformFamily {
    /// A seeded signed permutation, valid for every supported dimension.
    SignedPermutation,
    /// A seeded sign diagonal followed by a normalized Walsh-Hadamard transform.
    SignedHadamard,
}

impl TransformFamily {
    /// Returns the stable receipt identity for this mathematical family.
    pub fn identity(self) -> &'static str {
        match self {
            Self::SignedPermutation => "signed-permutation-v1",
            Self::SignedHadamard => "signed-normalized-hadamard-v1",
        }
    }
}

/// Seed- and dimension-bound scalar transform plan.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransformPlan {
    family: TransformFamily,
    dimension: usize,
    signs: Vec<i8>,
    permutation: Vec<usize>,
}

impl TransformPlan {
    /// Builds a bounded deterministic plan for `family`, `dimension`, and
    /// `seed`, rejecting dimensions the family does not define.
    pub fn new(family: TransformFamily, dimension: usize, seed: u64) -> Result<Self, OracleError> {
        if dimension == 0 || dimension > MAX_VECTOR_DIMENSION {
            return Err(OracleError::DimensionOutOfRange {
                dimension,
                maximum: MAX_VECTOR_DIMENSION,
            });
        }
        if family == TransformFamily::SignedHadamard && !dimension.is_power_of_two() {
            return Err(OracleError::UnsupportedDimension {
                family: family.identity(),
                dimension,
            });
        }

        let mut generator = DeterministicRng::new(seed);
        let signs = (0..dimension)
            .map(|_| if generator.next_u64() & 1 == 0 { 1 } else { -1 })
            .collect();
        let mut permutation: Vec<usize> = (0..dimension).collect();
        if family == TransformFamily::SignedPermutation {
            for index in (1..dimension).rev() {
                let other = generator.index_below(index + 1);
                permutation.swap(index, other);
            }
        }

        Ok(Self {
            family,
            dimension,
            signs,
            permutation,
        })
    }

    /// Returns the stable transform-family receipt identity.
    pub fn family_identity(&self) -> &'static str {
        self.family.identity()
    }

    /// Returns the exact vector dimension accepted by this plan.
    pub fn dimension(&self) -> usize {
        self.dimension
    }

    /// Applies the plan without mutating caller-owned input.
    pub fn forward(&self, input: &[f64]) -> Result<Vec<f64>, OracleError> {
        self.validate_input(input)?;
        let output = match self.family {
            TransformFamily::SignedPermutation => self.forward_signed_permutation(input),
            TransformFamily::SignedHadamard => self.forward_signed_hadamard(input),
        };
        require_finite_result(&output)?;
        Ok(output)
    }

    /// Applies the exact inverse associated with this immutable plan.
    pub fn inverse(&self, input: &[f64]) -> Result<Vec<f64>, OracleError> {
        self.validate_input(input)?;
        let output = match self.family {
            TransformFamily::SignedPermutation => self.inverse_signed_permutation(input),
            TransformFamily::SignedHadamard => self.inverse_signed_hadamard(input),
        };
        require_finite_result(&output)?;
        Ok(output)
    }

    /// Checks shape and finiteness before either transform direction runs.
    fn validate_input(&self, input: &[f64]) -> Result<(), OracleError> {
        if input.len() != self.dimension {
            return Err(OracleError::LengthMismatch {
                expected: self.dimension,
                actual: input.len(),
            });
        }
        require_finite(input)
    }

    /// Applies a destination-indexed signed permutation.
    fn forward_signed_permutation(&self, input: &[f64]) -> Vec<f64> {
        self.permutation
            .iter()
            .enumerate()
            .map(|(destination, source)| f64::from(self.signs[destination]) * input[*source])
            .collect()
    }

    /// Scatters a signed permutation back into its source coordinates.
    fn inverse_signed_permutation(&self, input: &[f64]) -> Vec<f64> {
        let mut output = vec![0.0; self.dimension];
        for (destination, source) in self.permutation.iter().enumerate() {
            output[*source] = f64::from(self.signs[destination]) * input[destination];
        }
        output
    }

    /// Applies the sign diagonal and normalized in-place Hadamard butterflies.
    fn forward_signed_hadamard(&self, input: &[f64]) -> Vec<f64> {
        let mut output: Vec<f64> = input
            .iter()
            .zip(&self.signs)
            .map(|(value, sign)| *value * f64::from(*sign))
            .collect();
        normalized_hadamard(&mut output);
        output
    }

    /// Uses Hadamard self-inversion, then reverses the original sign diagonal.
    fn inverse_signed_hadamard(&self, input: &[f64]) -> Vec<f64> {
        let mut output = input.to_vec();
        normalized_hadamard(&mut output);
        for (value, sign) in output.iter_mut().zip(&self.signs) {
            *value *= f64::from(*sign);
        }
        output
    }
}

/// Applies a normalized Walsh-Hadamard transform to a power-of-two slice.
fn normalized_hadamard(values: &mut [f64]) {
    let mut width = 1;
    while width < values.len() {
        for base in (0..values.len()).step_by(width * 2) {
            for offset in 0..width {
                let left = values[base + offset];
                let right = values[base + offset + width];
                values[base + offset] = left + right;
                values[base + offset + width] = left - right;
            }
        }
        width *= 2;
    }
    let scale = (values.len() as f64).sqrt().recip();
    for value in values {
        *value *= scale;
    }
}

#[cfg(test)]
mod tests {
    use super::{TransformFamily, TransformPlan, MAX_VECTOR_DIMENSION};
    use crate::OracleError;

    /// Computes squared Euclidean norm without sharing transform code.
    fn squared_norm(values: &[f64]) -> f64 {
        values.iter().map(|value| value * value).sum()
    }

    /// Compares finite slices under one absolute tolerance.
    fn assert_close(left: &[f64], right: &[f64], tolerance: f64) {
        assert_eq!(left.len(), right.len());
        for (left_value, right_value) in left.iter().zip(right) {
            assert!((left_value - right_value).abs() <= tolerance);
        }
    }

    /// Covers non-power-of-two parity through the universally defined family.
    #[test]
    fn signed_permutation_preserves_norm_and_round_trips_non_power_of_two() {
        let input = vec![1.0, -2.0, 3.5, 4.0, -5.25, 6.0];
        let plan = TransformPlan::new(TransformFamily::SignedPermutation, input.len(), 91)
            .expect("valid plan");
        let transformed = plan.forward(&input).expect("finite transform");
        let restored = plan.inverse(&transformed).expect("finite inverse");

        assert_eq!(plan.family_identity(), "signed-permutation-v1");
        assert_eq!(plan.dimension(), input.len());
        assert_eq!(squared_norm(&input), squared_norm(&transformed));
        assert_eq!(input, restored);
    }

    /// Covers power-of-two parity and norm preservation for Hadamard rotation.
    #[test]
    fn signed_hadamard_preserves_norm_and_round_trips_power_of_two() {
        let input = vec![1.0, -2.0, 3.5, 4.0, -5.25, 6.0, 0.125, -0.25];
        let plan = TransformPlan::new(TransformFamily::SignedHadamard, input.len(), 17)
            .expect("valid plan");
        let transformed = plan.forward(&input).expect("finite transform");
        let restored = plan.inverse(&transformed).expect("finite inverse");

        assert_eq!(plan.family_identity(), "signed-normalized-hadamard-v1");
        assert!((squared_norm(&input) - squared_norm(&transformed)).abs() <= 1.0e-12);
        assert_close(&input, &restored, 1.0e-12);
    }

    /// Proves the transform identity binds both seed and dimension.
    #[test]
    fn seed_and_dimension_change_generated_transform_state() {
        let input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let first = TransformPlan::new(TransformFamily::SignedHadamard, 8, 1).expect("first plan");
        let replay =
            TransformPlan::new(TransformFamily::SignedHadamard, 8, 1).expect("replay plan");
        let changed =
            TransformPlan::new(TransformFamily::SignedHadamard, 8, 2).expect("changed plan");

        assert_eq!(first, replay);
        assert_ne!(first, changed);
        assert_eq!(first.forward(&input), replay.forward(&input));
        assert_ne!(first.forward(&input), changed.forward(&input));
    }

    /// Confirms unsupported Hadamard dimensions fail instead of being padded.
    #[test]
    fn hadamard_rejects_non_power_of_two_dimension() {
        assert_eq!(
            TransformPlan::new(TransformFamily::SignedHadamard, 6, 1),
            Err(OracleError::UnsupportedDimension {
                family: "signed-normalized-hadamard-v1",
                dimension: 6,
            })
        );
    }

    /// Exercises zero, over-limit, and mismatched dimensions independently.
    #[test]
    fn dimension_and_length_limits_fail_boundedly() {
        assert_eq!(
            TransformPlan::new(TransformFamily::SignedPermutation, 0, 1),
            Err(OracleError::DimensionOutOfRange {
                dimension: 0,
                maximum: MAX_VECTOR_DIMENSION,
            })
        );
        assert_eq!(
            TransformPlan::new(
                TransformFamily::SignedPermutation,
                MAX_VECTOR_DIMENSION + 1,
                1,
            ),
            Err(OracleError::DimensionOutOfRange {
                dimension: MAX_VECTOR_DIMENSION + 1,
                maximum: MAX_VECTOR_DIMENSION,
            })
        );

        let plan =
            TransformPlan::new(TransformFamily::SignedPermutation, 3, 1).expect("valid plan");
        assert_eq!(
            plan.forward(&[1.0, 2.0]),
            Err(OracleError::LengthMismatch {
                expected: 3,
                actual: 2,
            })
        );
    }

    /// Rejects NaN/infinity and reports arithmetic overflow without panicking.
    #[test]
    fn non_finite_inputs_and_results_are_explicit() {
        let plan = TransformPlan::new(TransformFamily::SignedHadamard, 2, 1).expect("valid plan");
        assert_eq!(
            plan.forward(&[1.0, f64::NAN]),
            Err(OracleError::NonFiniteInput { index: 1 })
        );
        assert_eq!(
            plan.inverse(&[f64::INFINITY, 1.0]),
            Err(OracleError::NonFiniteInput { index: 0 })
        );
        assert_eq!(
            plan.forward(&[f64::MAX, f64::MAX]),
            Err(OracleError::NonFiniteResult)
        );
    }

    /// Keeps finite edge magnitudes accepted by a non-accumulating transform.
    #[test]
    fn zero_subnormal_sparse_anisotropic_and_huge_finite_values_remain_finite() {
        let input = vec![0.0, f64::from_bits(1), 1.0e-200, -1.0e150, 0.0, 7.0];
        let plan = TransformPlan::new(TransformFamily::SignedPermutation, input.len(), 3)
            .expect("valid plan");
        let transformed = plan.forward(&input).expect("finite transform");
        let restored = plan.inverse(&transformed).expect("finite inverse");

        assert!(transformed.iter().all(|value| value.is_finite()));
        assert_eq!(restored, input);
    }
}
