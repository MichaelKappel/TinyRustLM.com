use crate::error::require_finite;
use crate::{OracleError, MAX_VECTOR_DIMENSION};

/// Reconstruction metrics that do not encode undefined zero-norm values as NaN.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DistortionMetrics {
    /// Mean squared reconstruction error.
    pub mean_squared_error: f64,
    /// Squared error divided by reference energy, or `None` for zero energy.
    pub normalized_mean_squared_error: Option<f64>,
    /// Angle in radians, or `None` when either vector has zero norm.
    pub angular_error_radians: Option<f64>,
}

impl DistortionMetrics {
    /// Computes reconstruction metrics from equal-length finite f64 vectors.
    pub fn from_vectors(reference: &[f64], reconstructed: &[f64]) -> Result<Self, OracleError> {
        validate_pair(reference, reconstructed)?;
        let mut squared_error = 0.0;
        let mut reference_energy = 0.0;
        let mut reconstructed_energy = 0.0;
        let mut dot = 0.0;
        for (expected, observed) in reference.iter().zip(reconstructed) {
            let difference = expected - observed;
            squared_error += difference * difference;
            reference_energy += expected * expected;
            reconstructed_energy += observed * observed;
            dot += expected * observed;
            if !squared_error.is_finite()
                || !reference_energy.is_finite()
                || !reconstructed_energy.is_finite()
                || !dot.is_finite()
            {
                return Err(OracleError::NonFiniteResult);
            }
        }

        let mean_squared_error = squared_error / reference.len() as f64;
        let normalized_mean_squared_error = if reference_energy == 0.0 {
            None
        } else {
            Some(squared_error / reference_energy)
        };
        let angular_error_radians = if reference_energy == 0.0 || reconstructed_energy == 0.0 {
            None
        } else {
            let denominator = reference_energy.sqrt() * reconstructed_energy.sqrt();
            Some((dot / denominator).clamp(-1.0, 1.0).acos())
        };
        Ok(Self {
            mean_squared_error,
            normalized_mean_squared_error,
            angular_error_radians,
        })
    }
}

/// Bias and variance of estimated scalar scores relative to references.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ScoreErrorMetrics {
    /// Arithmetic mean of `estimate - reference`.
    pub bias: f64,
    /// Population variance of score errors around `bias`.
    pub variance: f64,
    /// Root mean squared score error.
    pub root_mean_squared_error: f64,
}

impl ScoreErrorMetrics {
    /// Computes score-estimator error moments from finite paired observations.
    pub fn from_scores(reference: &[f64], estimates: &[f64]) -> Result<Self, OracleError> {
        validate_pair(reference, estimates)?;
        let errors: Vec<f64> = reference
            .iter()
            .zip(estimates)
            .map(|(expected, estimate)| estimate - expected)
            .collect();
        require_finite(&errors)?;
        let bias = errors.iter().sum::<f64>() / errors.len() as f64;
        let mut variance_sum = 0.0;
        let mut squared_error_sum = 0.0;
        for error in errors {
            variance_sum += (error - bias) * (error - bias);
            squared_error_sum += error * error;
            if !variance_sum.is_finite() || !squared_error_sum.is_finite() {
                return Err(OracleError::NonFiniteResult);
            }
        }
        Ok(Self {
            bias,
            variance: variance_sum / reference.len() as f64,
            root_mean_squared_error: (squared_error_sum / reference.len() as f64).sqrt(),
        })
    }
}

/// Pairwise ordering outcomes under one explicit near-tie tolerance.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RankOrderMetrics {
    /// Pairs with a reference separation larger than the tolerance.
    pub comparable_pairs: usize,
    /// Comparable pairs whose estimated strict order is reversed.
    pub inversions: usize,
    /// Comparable pairs collapsed to an estimated near tie.
    pub estimated_ties: usize,
    /// Reference near-tie pairs excluded from inversion judgment.
    pub reference_ties: usize,
}

impl RankOrderMetrics {
    /// Compares all score pairs while treating absolute differences at or below
    /// `tie_tolerance` as ties in both reference and estimated scores.
    pub fn from_scores(
        reference: &[f64],
        estimates: &[f64],
        tie_tolerance: f64,
    ) -> Result<Self, OracleError> {
        validate_pair(reference, estimates)?;
        if !tie_tolerance.is_finite() || tie_tolerance < 0.0 {
            return Err(OracleError::InvalidTolerance);
        }
        let mut metrics = Self {
            comparable_pairs: 0,
            inversions: 0,
            estimated_ties: 0,
            reference_ties: 0,
        };
        for left in 0..reference.len() {
            for right in (left + 1)..reference.len() {
                let reference_delta = reference[left] - reference[right];
                if !reference_delta.is_finite() {
                    return Err(OracleError::NonFiniteResult);
                }
                if reference_delta.abs() <= tie_tolerance {
                    metrics.reference_ties = metrics
                        .reference_ties
                        .checked_add(1)
                        .ok_or(OracleError::ArithmeticOverflow)?;
                    continue;
                }
                metrics.comparable_pairs = metrics
                    .comparable_pairs
                    .checked_add(1)
                    .ok_or(OracleError::ArithmeticOverflow)?;
                let estimate_delta = estimates[left] - estimates[right];
                if !estimate_delta.is_finite() {
                    return Err(OracleError::NonFiniteResult);
                }
                if estimate_delta.abs() <= tie_tolerance {
                    metrics.estimated_ties = metrics
                        .estimated_ties
                        .checked_add(1)
                        .ok_or(OracleError::ArithmeticOverflow)?;
                } else if reference_delta.is_sign_positive() != estimate_delta.is_sign_positive() {
                    metrics.inversions = metrics
                        .inversions
                        .checked_add(1)
                        .ok_or(OracleError::ArithmeticOverflow)?;
                }
            }
        }
        Ok(metrics)
    }
}

/// Validates finite equal-size vectors under the scalar allocation ceiling.
fn validate_pair(left: &[f64], right: &[f64]) -> Result<(), OracleError> {
    if left.is_empty() {
        return Err(OracleError::EmptyInput);
    }
    if left.len() > MAX_VECTOR_DIMENSION {
        return Err(OracleError::DimensionOutOfRange {
            dimension: left.len(),
            maximum: MAX_VECTOR_DIMENSION,
        });
    }
    if left.len() != right.len() {
        return Err(OracleError::LengthMismatch {
            expected: left.len(),
            actual: right.len(),
        });
    }
    require_finite(left)?;
    require_finite(right)
}

#[cfg(test)]
mod tests {
    use super::{DistortionMetrics, RankOrderMetrics, ScoreErrorMetrics};
    use crate::{DeterministicRng, OracleError, ScalarCodebook};

    /// Computes known distortion values including the angular metric.
    #[test]
    fn distortion_metrics_match_hand_computed_vectors() {
        let metrics = DistortionMetrics::from_vectors(&[1.0, 0.0], &[0.0, 1.0]).expect("metrics");
        assert_eq!(metrics.mean_squared_error, 1.0);
        assert_eq!(metrics.normalized_mean_squared_error, Some(2.0));
        assert_eq!(
            metrics.angular_error_radians,
            Some(std::f64::consts::FRAC_PI_2)
        );
    }

    /// Zero norms remain explicit optional values rather than NaN metrics.
    #[test]
    fn zero_norm_metrics_are_explicit() {
        let both_zero =
            DistortionMetrics::from_vectors(&[0.0, 0.0], &[0.0, 0.0]).expect("zero metrics");
        assert_eq!(both_zero.mean_squared_error, 0.0);
        assert_eq!(both_zero.normalized_mean_squared_error, None);
        assert_eq!(both_zero.angular_error_radians, None);
    }

    /// Bias, variance, and RMSE match one independently derived error series.
    #[test]
    fn score_error_moments_are_correct() {
        let metrics = ScoreErrorMetrics::from_scores(&[1.0, 2.0, 3.0], &[2.0, 2.0, 2.0])
            .expect("score metrics");
        assert_eq!(metrics.bias, 0.0);
        assert_eq!(metrics.variance, 2.0 / 3.0);
        assert_eq!(metrics.root_mean_squared_error, (2.0_f64 / 3.0).sqrt());
    }

    /// Separates strict inversions, estimated ties, and reference near ties.
    #[test]
    fn rank_metrics_respect_the_declared_near_tie_tolerance() {
        let metrics =
            RankOrderMetrics::from_scores(&[10.0, 9.0, 8.95, 1.0], &[9.0, 9.05, 10.0, 1.0], 0.1)
                .expect("rank metrics");
        assert_eq!(
            metrics,
            RankOrderMetrics {
                comparable_pairs: 5,
                inversions: 1,
                estimated_ties: 1,
                reference_ties: 1,
            }
        );
    }

    /// Exercises empty, length, nonfinite, overflow, and tolerance failures.
    #[test]
    fn metric_input_failures_are_typed() {
        assert_eq!(
            DistortionMetrics::from_vectors(&[], &[]),
            Err(OracleError::EmptyInput)
        );
        assert_eq!(
            ScoreErrorMetrics::from_scores(&[1.0], &[1.0, 2.0]),
            Err(OracleError::LengthMismatch {
                expected: 1,
                actual: 2,
            })
        );
        assert_eq!(
            DistortionMetrics::from_vectors(&[f64::NAN], &[0.0]),
            Err(OracleError::NonFiniteInput { index: 0 })
        );
        assert_eq!(
            DistortionMetrics::from_vectors(&[f64::MAX], &[-f64::MAX]),
            Err(OracleError::NonFiniteResult)
        );
        assert_eq!(
            RankOrderMetrics::from_scores(&[1.0], &[1.0], -1.0),
            Err(OracleError::InvalidTolerance)
        );
    }

    /// Runs synthetic distribution families through quantization and metrics.
    #[test]
    fn finite_distribution_families_produce_finite_or_explicit_metrics() {
        let codebook =
            ScalarCodebook::from_centroids(vec![-4.0, -1.0, 1.0, 4.0]).expect("codebook");
        let mut generator = DeterministicRng::new(20260722);
        let mut gaussian = Vec::new();
        let mut laplace = Vec::new();
        for _ in 0..32 {
            let u1 = generator.next_unit_f64().max(f64::MIN_POSITIVE);
            let u2 = generator.next_unit_f64();
            gaussian.push((-2.0 * u1.ln()).sqrt() * (std::f64::consts::TAU * u2).cos());
            let centered = generator.next_unit_f64() - 0.5;
            laplace.push(-centered.signum() * (1.0 - 2.0 * centered.abs()).ln());
        }
        let families = vec![
            vec![0.0; 16],
            vec![f64::from_bits(1), -f64::from_bits(1), 0.0],
            vec![1.0e150, -1.0e150, 0.0],
            vec![0.0, 0.0, 7.0, 0.0, -3.0],
            vec![1.0e-9, 1.0e9, -1.0e-3, -1.0e3],
            gaussian,
            laplace,
            vec![-3.9, -3.8, 0.9, 1.0, 1.1, 3.8, 3.9],
            vec![-2.5, -2.5 + f64::EPSILON, 0.0, 2.5 - f64::EPSILON, 2.5],
        ];

        for values in families {
            let codes = codebook.encode_all(&values).expect("finite encode");
            let reconstructed = codebook.decode_all(&codes).expect("decode");
            let metrics =
                DistortionMetrics::from_vectors(&values, &reconstructed).expect("finite metrics");
            assert!(metrics.mean_squared_error.is_finite());
            assert!(metrics
                .normalized_mean_squared_error
                .is_none_or(|value| value.is_finite()));
            assert!(metrics
                .angular_error_radians
                .is_none_or(|value| value.is_finite()));
        }
    }
}
