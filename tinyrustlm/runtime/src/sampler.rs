//! Token sampling helpers.

use crate::errors::ErrorCode;
use crate::rng::XorShift64;

/// Maximum stochastic candidates retained without heap allocation.
pub const MAX_SAMPLING_CANDIDATES: usize = 1024;
/// Recent generated tokens considered for repetition penalty.
pub const REPETITION_PENALTY_WINDOW: usize = 64;

/// Sampling configuration.
#[derive(Clone, Copy)]
pub struct SamplingConfig {
    /// Temperature for stochastic sampling.
    pub temperature: f32,
    /// Maximum top-k candidate count.
    pub top_k: usize,
    /// Nucleus sampling probability.
    pub top_p: f32,
    /// Deterministic seed.
    pub seed: u64,
    /// Penalty applied to recently generated tokens before sampling.
    pub repetition_penalty: f32,
}

impl Default for SamplingConfig {
    fn default() -> Self {
        Self {
            temperature: 0.0,
            top_k: 1,
            top_p: 1.0,
            seed: 1,
            repetition_penalty: 1.0,
        }
    }
}

impl SamplingConfig {
    /// Returns true when this configuration should select the greedy argmax.
    pub fn is_greedy(self) -> bool {
        self.temperature <= 0.0 || self.top_k == 1
    }
}

/// Validates a sampling config against runtime fixed-buffer limits.
pub fn validate_config(config: SamplingConfig) -> Result<(), ErrorCode> {
    if !config.temperature.is_finite()
        || config.temperature < 0.0
        || !config.top_p.is_finite()
        || config.top_p <= 0.0
        || config.top_p > 1.0
        || config.top_k == 0
        || config.top_k > MAX_SAMPLING_CANDIDATES
        || !config.repetition_penalty.is_finite()
        || config.repetition_penalty < 1.0
        || config.repetition_penalty > 128.0
    {
        return Err(ErrorCode::InvalidLength);
    }
    Ok(())
}

/// Applies a repetition penalty to recently generated token logits in place.
pub fn apply_repetition_penalty(
    logits: &mut [f32],
    generated_tokens: &[u32],
    config: SamplingConfig,
) -> Result<(), ErrorCode> {
    validate_config(config)?;
    if config.repetition_penalty <= 1.0 || generated_tokens.is_empty() {
        return Ok(());
    }

    let start = generated_tokens
        .len()
        .saturating_sub(REPETITION_PENALTY_WINDOW);
    for index in start..generated_tokens.len() {
        let token = generated_tokens[index] as usize;
        if token >= logits.len() || generated_tokens[index + 1..].contains(&generated_tokens[index])
        {
            continue;
        }
        if logits[token] > 0.0 {
            logits[token] /= config.repetition_penalty;
        } else {
            logits[token] *= config.repetition_penalty;
        }
    }
    Ok(())
}

/// Selects the highest finite-logit token.
///
/// Negative infinity is treated as an intentional suppression mask. NaN,
/// positive infinity, or a distribution with no finite candidate fails instead
/// of selecting an undefined token.
pub fn greedy(logits: &[f32]) -> Result<usize, ErrorCode> {
    if logits.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    finite_argmax(logits)?.ok_or(ErrorCode::GenerationFailed)
}

fn finite_argmax(logits: &[f32]) -> Result<Option<usize>, ErrorCode> {
    let mut best = None;
    for (index, value) in logits.iter().copied().enumerate() {
        if value.is_nan() || value == f32::INFINITY {
            return Err(ErrorCode::GenerationFailed);
        }
        if value == f32::NEG_INFINITY {
            continue;
        }
        match best {
            Some((_, best_value)) if value <= best_value => {}
            _ => {
                best = Some((index, value));
            }
        }
    }
    Ok(best.map(|(index, _)| index))
}

/// Selects a token using deterministic greedy or seeded stochastic sampling.
///
/// Negative-infinity suppression entries never enter the candidate set. NaN,
/// positive infinity, or a distribution with no finite candidate returns
/// [`ErrorCode::GenerationFailed`].
pub fn sample(logits: &[f32], config: SamplingConfig) -> Result<usize, ErrorCode> {
    let mut rng = XorShift64::new(config.seed);
    sample_with_rng(logits, config, &mut rng)
}

/// Selects a token using temperature, top-k, top-p, and caller-owned RNG state.
pub fn sample_with_rng(
    logits: &[f32],
    config: SamplingConfig,
    rng: &mut XorShift64,
) -> Result<usize, ErrorCode> {
    if logits.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    validate_config(config)?;
    let finite_fallback = finite_argmax(logits)?.ok_or(ErrorCode::GenerationFailed)?;
    if config.is_greedy() {
        return Ok(finite_fallback);
    }

    let limit = config.top_k.min(logits.len());
    let mut tokens = [0usize; MAX_SAMPLING_CANDIDATES];
    let mut weights = [f32::NEG_INFINITY; MAX_SAMPLING_CANDIDATES];
    let mut count = 0usize;
    for (token, value) in logits.iter().copied().enumerate() {
        if value == f32::NEG_INFINITY {
            continue;
        }
        if count < limit {
            insert_candidate(&mut tokens, &mut weights, count, token, value);
            count += 1;
        } else if limit > 0 && value > weights[limit - 1] {
            insert_candidate(&mut tokens, &mut weights, limit - 1, token, value);
        }
    }

    let max_logit = weights[0];
    let mut total = 0.0f32;
    for weight in weights.iter_mut().take(count) {
        let scaled = ((*weight - max_logit) / config.temperature).exp();
        *weight = if scaled.is_finite() { scaled } else { 0.0 };
        total += *weight;
    }
    if total <= 0.0 || !total.is_finite() {
        return Ok(finite_fallback);
    }

    let mut keep = count;
    if config.top_p < 1.0 {
        let mut cumulative = 0.0f32;
        let threshold = total * config.top_p;
        for (index, weight) in weights.iter().take(count).enumerate() {
            cumulative += *weight;
            if cumulative >= threshold {
                keep = index + 1;
                break;
            }
        }
        keep = keep.max(1);
    }
    let truncated_total = weights.iter().take(keep).sum::<f32>();
    if truncated_total <= 0.0 || !truncated_total.is_finite() {
        return Ok(finite_fallback);
    }

    let threshold = rng.next_f32() * truncated_total;
    let mut cumulative = 0.0f32;
    for index in 0..keep {
        cumulative += weights[index];
        if threshold <= cumulative {
            return Ok(tokens[index]);
        }
    }
    Ok(tokens[keep - 1])
}

fn insert_candidate(
    tokens: &mut [usize; MAX_SAMPLING_CANDIDATES],
    weights: &mut [f32; MAX_SAMPLING_CANDIDATES],
    mut index: usize,
    token: usize,
    value: f32,
) {
    while index > 0 && value > weights[index - 1] {
        weights[index] = weights[index - 1];
        tokens[index] = tokens[index - 1];
        index -= 1;
    }
    weights[index] = value;
    tokens[index] = token;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_repetition_penalty_is_reference_identity() {
        assert_eq!(SamplingConfig::default().repetition_penalty, 1.0);
    }

    #[test]
    fn repetition_penalty_one_leaves_logits_bit_exact() {
        let config = SamplingConfig::default();
        let mut logits = [8.0, -4.0, 2.0, 0.0];
        let before = logits.map(f32::to_bits);

        apply_repetition_penalty(&mut logits, &[0, 1, 0], config).unwrap();

        assert_eq!(logits.map(f32::to_bits), before);
    }

    #[test]
    fn greedy_sampler_deterministic_selection() {
        assert_eq!(greedy(&[0.1, 2.0, 1.5]).unwrap(), 1);
    }

    #[test]
    fn greedy_sampler_masks_suppression_and_rejects_malformed_logits() {
        assert_eq!(
            greedy(&[f32::NAN, 2.0, 1.5]),
            Err(ErrorCode::GenerationFailed)
        );
        assert_eq!(
            greedy(&[0.1, f32::INFINITY, 1.5]),
            Err(ErrorCode::GenerationFailed)
        );
        assert_eq!(greedy(&[0.1, 2.0, f32::NEG_INFINITY]), Ok(1));
        assert_eq!(
            greedy(&[f32::NEG_INFINITY; 3]),
            Err(ErrorCode::GenerationFailed)
        );
    }

    #[test]
    fn stochastic_sampler_is_seeded_and_top_k_limited() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 2,
            top_p: 1.0,
            seed: 42,
            repetition_penalty: 1.0,
        };
        let logits = [0.0, 10.0, 9.0, 1.0];
        let first = sample(&logits, config).unwrap();
        let second = sample(&logits, config).unwrap();
        assert_eq!(first, second);
        assert!(first == 1 || first == 2);
    }

    #[test]
    fn stochastic_sampler_masks_suppression_and_rejects_malformed_logits() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 3,
            top_p: 0.9,
            seed: 42,
            repetition_penalty: 1.0,
        };

        assert_eq!(
            sample(&[f32::NAN, 2.0, 1.5], config),
            Err(ErrorCode::GenerationFailed)
        );
        assert_eq!(
            sample(&[0.1, f32::INFINITY, 1.5], config),
            Err(ErrorCode::GenerationFailed)
        );
        let selected = sample(&[0.1, 2.0, f32::NEG_INFINITY], config).unwrap();
        assert!([0, 1].contains(&selected));
        assert_eq!(
            sample(&[f32::NEG_INFINITY; 3], config),
            Err(ErrorCode::GenerationFailed)
        );
    }

    #[test]
    fn stochastic_sampler_accepts_fixed_candidate_cap_without_vocab_vector() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: MAX_SAMPLING_CANDIDATES,
            top_p: 1.0,
            seed: 7,
            repetition_penalty: 1.0,
        };
        let mut logits = [0.0f32; MAX_SAMPLING_CANDIDATES + 4];
        logits[3] = 10.0;
        logits[MAX_SAMPLING_CANDIDATES + 1] = 9.5;
        assert!(sample(&logits, config).is_ok());
    }

    #[test]
    fn stochastic_sampler_accepts_bpe_vocab_above_byte_tokenizer_size() {
        let config = SamplingConfig {
            temperature: 0.01,
            top_k: 262,
            top_p: 1.0,
            seed: 7,
            repetition_penalty: 1.0,
        };
        let mut logits = [0.0f32; 262];
        logits[261] = 5.0;
        assert_eq!(sample(&logits, config).unwrap(), 261);
    }

    #[test]
    fn top_p_can_collapse_to_the_highest_probability_token() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 4,
            top_p: 0.5,
            seed: 99,
            repetition_penalty: 1.0,
        };
        assert_eq!(sample(&[5.0, 1.0, 0.0, -1.0], config).unwrap(), 0);
    }

    #[test]
    fn sampler_rejects_invalid_stochastic_config() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 0,
            top_p: 1.0,
            seed: 1,
            repetition_penalty: 1.0,
        };
        assert_eq!(sample(&[1.0, 2.0], config), Err(ErrorCode::InvalidLength));

        let oversized = SamplingConfig {
            temperature: 1.0,
            top_k: MAX_SAMPLING_CANDIDATES + 1,
            top_p: 1.0,
            seed: 1,
            repetition_penalty: 1.0,
        };
        assert_eq!(
            sample(&[1.0, 2.0], oversized),
            Err(ErrorCode::InvalidLength)
        );
    }

    #[test]
    fn repetition_penalty_dampens_recent_unique_generated_tokens() {
        let config = SamplingConfig {
            temperature: 0.0,
            top_k: 1,
            top_p: 1.0,
            seed: 1,
            repetition_penalty: 4.25,
        };
        let mut logits = [0.0, 8.0, 2.0, -1.0];
        apply_repetition_penalty(&mut logits, &[1, 1], config).unwrap();
        assert!(logits[1] < logits[2]);
        assert_eq!(greedy(&logits).unwrap(), 2);
    }

    #[test]
    fn repetition_penalty_rejects_invalid_penalty() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 1,
            top_p: 1.0,
            seed: 1,
            repetition_penalty: 0.5,
        };
        let mut logits = [1.0, 2.0];
        assert_eq!(
            apply_repetition_penalty(&mut logits, &[1], config),
            Err(ErrorCode::InvalidLength)
        );
    }
}
