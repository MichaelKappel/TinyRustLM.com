use crate::error::require_finite;
use crate::OracleError;

/// Largest centroid count admitted by the scalar codebook experiment.
pub const MAX_CODEBOOK_LEVELS: usize = 65_536;

/// Largest Lloyd update budget admitted by one fit operation.
pub const MAX_LLOYD_ITERATIONS: usize = 10_000;

/// One finite support point and positive mass for a discrete scalar distribution.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WeightedSample {
    /// Finite scalar support value.
    pub value: f64,
    /// Finite strictly positive mass associated with `value`.
    pub weight: f64,
}

/// Immutable scalar reconstruction centroids and derived decision boundaries.
#[derive(Clone, Debug, PartialEq)]
pub struct ScalarCodebook {
    centroids: Vec<f64>,
    boundaries: Vec<f64>,
}

impl ScalarCodebook {
    /// Constructs a codebook from finite, strictly increasing centroids.
    pub fn from_centroids(centroids: Vec<f64>) -> Result<Self, OracleError> {
        if centroids.is_empty() {
            return Err(OracleError::EmptyInput);
        }
        if centroids.len() > MAX_CODEBOOK_LEVELS {
            return Err(OracleError::LevelCountOutOfRange {
                levels: centroids.len(),
                maximum: MAX_CODEBOOK_LEVELS,
            });
        }
        for (index, centroid) in centroids.iter().enumerate() {
            if !centroid.is_finite()
                || index > 0 && centroids[index - 1].total_cmp(centroid).is_ge()
            {
                return Err(OracleError::InvalidCentroidOrder { index });
            }
        }
        Ok(Self::from_valid_centroids(centroids))
    }

    /// Fits a deterministic Lloyd-Max analogue to a finite discrete measure.
    ///
    /// Initialization selects evenly spaced support values. Boundary ties map
    /// to the lower code, and an empty cluster is an error rather than an
    /// implicit reseed. This is a scalar correctness oracle, not a claim about
    /// a continuous paper distribution.
    pub fn fit_discrete(
        samples: &[WeightedSample],
        levels: usize,
        max_iterations: usize,
    ) -> Result<Self, OracleError> {
        let support = normalize_samples(samples)?;
        let maximum_levels = support.len().min(MAX_CODEBOOK_LEVELS);
        if levels == 0 || levels > maximum_levels {
            return Err(OracleError::LevelCountOutOfRange {
                levels,
                maximum: maximum_levels,
            });
        }
        if max_iterations == 0 || max_iterations > MAX_LLOYD_ITERATIONS {
            return Err(OracleError::IterationCountOutOfRange {
                iterations: max_iterations,
                maximum: MAX_LLOYD_ITERATIONS,
            });
        }

        let mut centroids = initialize_centroids(&support, levels)?;
        for _ in 0..max_iterations {
            let boundaries = derive_boundaries(&centroids);
            let mut weighted_sums = vec![0.0_f64; levels];
            let mut cluster_weights = vec![0.0_f64; levels];
            for sample in &support {
                let cluster = code_for_boundaries(&boundaries, sample.value);
                weighted_sums[cluster] += sample.value * sample.weight;
                cluster_weights[cluster] += sample.weight;
                if !weighted_sums[cluster].is_finite() || !cluster_weights[cluster].is_finite() {
                    return Err(OracleError::NonFiniteResult);
                }
            }

            let mut updated = Vec::with_capacity(levels);
            for cluster in 0..levels {
                if cluster_weights[cluster] == 0.0 {
                    return Err(OracleError::EmptyCluster { cluster });
                }
                let centroid = weighted_sums[cluster] / cluster_weights[cluster];
                if !centroid.is_finite() {
                    return Err(OracleError::NonFiniteResult);
                }
                updated.push(centroid);
            }
            if centroids
                .iter()
                .zip(&updated)
                .all(|(left, right)| left.to_bits() == right.to_bits())
            {
                return Ok(Self::from_valid_centroids(updated));
            }
            centroids = updated;
        }
        Err(OracleError::DidNotConverge {
            iterations: max_iterations,
        })
    }

    /// Returns reconstruction centroids in code order.
    pub fn centroids(&self) -> &[f64] {
        &self.centroids
    }

    /// Returns midpoint decision boundaries; ties select the lower code.
    pub fn boundaries(&self) -> &[f64] {
        &self.boundaries
    }

    /// Maps one finite scalar to its deterministic nearest-centroid code.
    pub fn encode(&self, value: f64) -> Result<u32, OracleError> {
        require_finite(&[value])?;
        Ok(code_for_boundaries(&self.boundaries, value) as u32)
    }

    /// Maps one code to its exact reconstruction centroid.
    pub fn decode(&self, code: u32) -> Result<f64, OracleError> {
        self.centroids
            .get(code as usize)
            .copied()
            .ok_or(OracleError::CodebookIndexOutOfRange {
                code,
                levels: self.centroids.len(),
            })
    }

    /// Encodes a finite scalar slice without packing its codes.
    pub fn encode_all(&self, values: &[f64]) -> Result<Vec<u32>, OracleError> {
        require_finite(values)?;
        values.iter().map(|value| self.encode(*value)).collect()
    }

    /// Reconstructs a code slice and rejects the first unknown code.
    pub fn decode_all(&self, codes: &[u32]) -> Result<Vec<f64>, OracleError> {
        codes.iter().map(|code| self.decode(*code)).collect()
    }

    /// Creates a codebook after caller-facing validation has succeeded.
    fn from_valid_centroids(centroids: Vec<f64>) -> Self {
        let boundaries = derive_boundaries(&centroids);
        Self {
            centroids,
            boundaries,
        }
    }
}

/// Validates, sorts, and combines equal support points without losing mass.
fn normalize_samples(samples: &[WeightedSample]) -> Result<Vec<WeightedSample>, OracleError> {
    if samples.is_empty() {
        return Err(OracleError::EmptyInput);
    }
    let values: Vec<f64> = samples.iter().map(|sample| sample.value).collect();
    require_finite(&values)?;
    for (index, sample) in samples.iter().enumerate() {
        if !sample.weight.is_finite() || sample.weight <= 0.0 {
            return Err(OracleError::InvalidWeight { index });
        }
    }

    let mut ordered = samples.to_vec();
    ordered.sort_by(|left, right| left.value.total_cmp(&right.value));
    let mut support: Vec<WeightedSample> = Vec::with_capacity(ordered.len());
    for sample in ordered {
        if let Some(last) = support.last_mut() {
            if last.value.to_bits() == sample.value.to_bits() {
                last.weight += sample.weight;
                if !last.weight.is_finite() {
                    return Err(OracleError::NonFiniteResult);
                }
                continue;
            }
        }
        support.push(sample);
    }
    Ok(support)
}

/// Selects distinct, evenly spaced support values for deterministic startup.
fn initialize_centroids(
    support: &[WeightedSample],
    levels: usize,
) -> Result<Vec<f64>, OracleError> {
    let denominator = levels
        .checked_mul(2)
        .ok_or(OracleError::ArithmeticOverflow)?;
    let mut centroids = Vec::with_capacity(levels);
    for level in 0..levels {
        let numerator = level
            .checked_mul(2)
            .and_then(|value| value.checked_add(1))
            .and_then(|value| value.checked_mul(support.len()))
            .ok_or(OracleError::ArithmeticOverflow)?;
        let index = numerator / denominator;
        centroids.push(support[index].value);
    }
    Ok(centroids)
}

/// Derives overflow-resistant midpoint boundaries from ordered centroids.
fn derive_boundaries(centroids: &[f64]) -> Vec<f64> {
    centroids
        .windows(2)
        .map(|pair| pair[0] / 2.0 + pair[1] / 2.0)
        .collect()
}

/// Binary-searches midpoint boundaries, assigning exact ties to the lower code.
fn code_for_boundaries(boundaries: &[f64], value: f64) -> usize {
    let mut lower = 0;
    let mut upper = boundaries.len();
    while lower < upper {
        let middle = lower + (upper - lower) / 2;
        if value > boundaries[middle] {
            lower = middle + 1;
        } else {
            upper = middle;
        }
    }
    lower
}

#[cfg(test)]
mod tests {
    use super::{ScalarCodebook, WeightedSample, MAX_CODEBOOK_LEVELS, MAX_LLOYD_ITERATIONS};
    use crate::OracleError;

    /// Converts unweighted support points into the explicit discrete measure.
    fn unit_samples(values: &[f64]) -> Vec<WeightedSample> {
        values
            .iter()
            .map(|value| WeightedSample {
                value: *value,
                weight: 1.0,
            })
            .collect()
    }

    /// Pins a hand-computed two-level Lloyd solution and tie behavior.
    #[test]
    fn canonical_symmetric_measure_converges_exactly() {
        let samples = unit_samples(&[-3.0, -2.0, 2.0, 3.0]);
        let codebook = ScalarCodebook::fit_discrete(&samples, 2, 8).expect("fit");

        assert_eq!(codebook.centroids(), &[-2.5, 2.5]);
        assert_eq!(codebook.boundaries(), &[0.0]);
        assert_eq!(codebook.encode(-100.0), Ok(0));
        assert_eq!(codebook.encode(0.0), Ok(0));
        assert_eq!(codebook.encode(f64::from_bits(1)), Ok(1));
        assert_eq!(codebook.decode(0), Ok(-2.5));
        assert_eq!(codebook.decode(1), Ok(2.5));
    }

    /// Confirms sorting and duplicate-mass combination do not change the fit.
    #[test]
    fn input_order_and_duplicate_support_are_deterministic() {
        let ordered = unit_samples(&[-3.0, -2.0, 2.0, 3.0]);
        let shuffled_with_duplicates = vec![
            WeightedSample {
                value: 3.0,
                weight: 1.0,
            },
            WeightedSample {
                value: -2.0,
                weight: 0.25,
            },
            WeightedSample {
                value: 2.0,
                weight: 1.0,
            },
            WeightedSample {
                value: -3.0,
                weight: 1.0,
            },
            WeightedSample {
                value: -2.0,
                weight: 0.75,
            },
        ];
        assert_eq!(
            ScalarCodebook::fit_discrete(&ordered, 2, 8),
            ScalarCodebook::fit_discrete(&shuffled_with_duplicates, 2, 8)
        );
    }

    /// Exercises weighted centroids plus batch encode/decode behavior.
    #[test]
    fn positive_weights_control_centroids_and_batch_reconstruction() {
        let samples = vec![
            WeightedSample {
                value: -2.0,
                weight: 1.0,
            },
            WeightedSample {
                value: 0.0,
                weight: 3.0,
            },
            WeightedSample {
                value: 8.0,
                weight: 2.0,
            },
        ];
        let codebook = ScalarCodebook::fit_discrete(&samples, 2, 8).expect("fit");
        assert_eq!(codebook.centroids(), &[-0.5, 8.0]);
        let codes = codebook.encode_all(&[-2.0, 0.0, 8.0]).expect("encode all");
        assert_eq!(codes, vec![0, 0, 1]);
        assert_eq!(
            codebook.decode_all(&codes).expect("decode all"),
            vec![-0.5, -0.5, 8.0]
        );
    }

    /// Rejects malformed centroid lists and unknown codes without fallback.
    #[test]
    fn direct_codebook_and_code_bounds_are_strict() {
        assert_eq!(
            ScalarCodebook::from_centroids(vec![]),
            Err(OracleError::EmptyInput)
        );
        assert_eq!(
            ScalarCodebook::from_centroids(vec![0.0, 0.0]),
            Err(OracleError::InvalidCentroidOrder { index: 1 })
        );
        assert_eq!(
            ScalarCodebook::from_centroids(vec![0.0, f64::INFINITY]),
            Err(OracleError::InvalidCentroidOrder { index: 1 })
        );
        let codebook = ScalarCodebook::from_centroids(vec![-1.0, 1.0]).expect("codebook");
        assert_eq!(
            codebook.decode(2),
            Err(OracleError::CodebookIndexOutOfRange { code: 2, levels: 2 })
        );
        assert_eq!(
            codebook.encode(f64::NAN),
            Err(OracleError::NonFiniteInput { index: 0 })
        );
    }

    /// Covers every level, iteration, value, and weight rejection parameter.
    #[test]
    fn fit_parameter_validation_is_bounded() {
        let samples = unit_samples(&[-1.0, 1.0]);
        assert_eq!(
            ScalarCodebook::fit_discrete(&samples, 0, 8),
            Err(OracleError::LevelCountOutOfRange {
                levels: 0,
                maximum: 2,
            })
        );
        assert_eq!(
            ScalarCodebook::fit_discrete(&samples, 3, 8),
            Err(OracleError::LevelCountOutOfRange {
                levels: 3,
                maximum: 2,
            })
        );
        assert_eq!(
            ScalarCodebook::fit_discrete(&samples, 1, 0),
            Err(OracleError::IterationCountOutOfRange {
                iterations: 0,
                maximum: MAX_LLOYD_ITERATIONS,
            })
        );
        assert_eq!(
            ScalarCodebook::fit_discrete(&samples, 1, MAX_LLOYD_ITERATIONS + 1),
            Err(OracleError::IterationCountOutOfRange {
                iterations: MAX_LLOYD_ITERATIONS + 1,
                maximum: MAX_LLOYD_ITERATIONS,
            })
        );
        assert_eq!(
            ScalarCodebook::fit_discrete(
                &[WeightedSample {
                    value: f64::INFINITY,
                    weight: 1.0,
                }],
                1,
                1,
            ),
            Err(OracleError::NonFiniteInput { index: 0 })
        );
        assert_eq!(
            ScalarCodebook::fit_discrete(
                &[WeightedSample {
                    value: 0.0,
                    weight: 0.0,
                }],
                1,
                1,
            ),
            Err(OracleError::InvalidWeight { index: 0 })
        );
        assert_eq!(MAX_CODEBOOK_LEVELS, 65_536);
    }

    /// A deliberately short budget records nonconvergence instead of partial output.
    #[test]
    fn exhausted_iteration_budget_is_not_silently_accepted() {
        let samples = unit_samples(&[-10.0, -9.0, -8.0, 0.0, 1.0, 2.0, 20.0]);
        assert_eq!(
            ScalarCodebook::fit_discrete(&samples, 2, 1),
            Err(OracleError::DidNotConverge { iterations: 1 })
        );
    }

    /// Finite edge values either fit or fail explicitly, never yielding NaN.
    #[test]
    fn finite_edge_magnitudes_do_not_create_non_finite_codebooks() {
        let codebook = ScalarCodebook::fit_discrete(
            &unit_samples(&[
                -1.0e150,
                -f64::from_bits(1),
                0.0,
                f64::from_bits(1),
                1.0e150,
            ]),
            2,
            32,
        )
        .expect("finite fit");
        assert!(codebook.centroids().iter().all(|value| value.is_finite()));
        assert!(codebook.boundaries().iter().all(|value| value.is_finite()));
    }
}
