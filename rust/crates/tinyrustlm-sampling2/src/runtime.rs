use std::cmp::Ordering;
use std::collections::HashSet;

use sha2::{Digest, Sha256};

use crate::format::{
    all_zero, get_u16, get_u32, get_u64, hex_lower, table_sha256_bytes, validate_profile_identity,
    Sampling2Error, SamplingIdentity, FILE_BYTES, FORMAT_ID, HEADER_BYTES, LOGIT_FRACTION_BITS,
    LOG_STEPS_PER_NATURAL_UNIT, MAGIC, MAXIMUM_CONTEXT_TOKENS, MAXIMUM_LOG_STEP,
    MAXIMUM_NEW_TOKENS, MAXIMUM_REPETITION_PENALTY, MAXIMUM_REPETITION_WINDOW, MAXIMUM_STOP_TOKENS,
    MAXIMUM_TEMPERATURE, MAXIMUM_TOP_K, MAXIMUM_VOCABULARY_SIZE, MILLION,
    MINIMUM_REPETITION_PENALTY, SAMPLING2_ARTIFACT_SHA256, SAMPLING2_FORMAT_PROFILE_ID,
    SAMPLING2_WEIGHT_TABLE_SHA256, WEIGHT_COUNT, WEIGHT_FRACTION_BITS, WEIGHT_RECORD_BYTES,
};

const LOGIT_SCALE: u128 = 1_u128 << LOGIT_FRACTION_BITS;
const MAXIMUM_FIXED_LOGIT: u128 = 32_768 * LOGIT_SCALE;
const SPLITMIX_INCREMENT: u64 = 0x9e37_79b9_7f4a_7c15;
const SPLITMIX_MIX_1: u64 = 0xbf58_476d_1ce4_e5b9;
const SPLITMIX_MIX_2: u64 = 0x94d0_49bb_1331_11eb;

/// Caller-selected resource ceilings for one validated Sampling2 runtime.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Sampling2Policy {
    maximum_artifact_bytes: u64,
    maximum_vocabulary_size: u32,
    maximum_top_k: u32,
    maximum_repetition_window: u32,
    maximum_stop_tokens: u32,
    maximum_new_tokens: u32,
    maximum_context_tokens: u32,
}

impl Sampling2Policy {
    /// Constructs policy ceilings no larger than the frozen profile limits.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        maximum_artifact_bytes: u64,
        maximum_vocabulary_size: u32,
        maximum_top_k: u32,
        maximum_repetition_window: u32,
        maximum_stop_tokens: u32,
        maximum_new_tokens: u32,
        maximum_context_tokens: u32,
    ) -> Result<Self, Sampling2Error> {
        if maximum_artifact_bytes == 0
            || maximum_artifact_bytes > FILE_BYTES as u64
            || maximum_vocabulary_size == 0
            || maximum_vocabulary_size > MAXIMUM_VOCABULARY_SIZE
            || maximum_top_k == 0
            || maximum_top_k > MAXIMUM_TOP_K
            || maximum_repetition_window > MAXIMUM_REPETITION_WINDOW
            || maximum_stop_tokens == 0
            || maximum_stop_tokens > MAXIMUM_STOP_TOKENS
            || maximum_new_tokens == 0
            || maximum_new_tokens > MAXIMUM_NEW_TOKENS
            || maximum_context_tokens == 0
            || maximum_context_tokens > MAXIMUM_CONTEXT_TOKENS
        {
            return Err(Sampling2Error::new("sampling2-policy"));
        }
        Ok(Self {
            maximum_artifact_bytes,
            maximum_vocabulary_size,
            maximum_top_k,
            maximum_repetition_window,
            maximum_stop_tokens,
            maximum_new_tokens,
            maximum_context_tokens,
        })
    }

    /// Returns a policy matching every frozen profile maximum exactly.
    pub const fn exact_profile_limits() -> Self {
        Self {
            maximum_artifact_bytes: FILE_BYTES as u64,
            maximum_vocabulary_size: MAXIMUM_VOCABULARY_SIZE,
            maximum_top_k: MAXIMUM_TOP_K,
            maximum_repetition_window: MAXIMUM_REPETITION_WINDOW,
            maximum_stop_tokens: MAXIMUM_STOP_TOKENS,
            maximum_new_tokens: MAXIMUM_NEW_TOKENS,
            maximum_context_tokens: MAXIMUM_CONTEXT_TOKENS,
        }
    }

    /// Returns the active maximum context-token count.
    pub const fn maximum_context_tokens(self) -> u32 {
        self.maximum_context_tokens
    }
}

/// Fully explicit, validated Sampling2 operation configuration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Sampling2Config {
    temperature_millionths: u32,
    top_k: u32,
    top_p_millionths: u32,
    repetition_penalty_millionths: u32,
    repetition_window: u32,
    maximum_new_tokens: u32,
}

impl Sampling2Config {
    /// Constructs one complete configuration without implicit defaults.
    pub fn new(
        temperature_millionths: u32,
        top_k: u32,
        top_p_millionths: u32,
        repetition_penalty_millionths: u32,
        repetition_window: u32,
        maximum_new_tokens: u32,
    ) -> Result<Self, Sampling2Error> {
        if temperature_millionths > MAXIMUM_TEMPERATURE
            || top_k == 0
            || top_k > MAXIMUM_TOP_K
            || top_p_millionths == 0
            || top_p_millionths > MILLION
            || !(MINIMUM_REPETITION_PENALTY..=MAXIMUM_REPETITION_PENALTY)
                .contains(&repetition_penalty_millionths)
            || repetition_window > MAXIMUM_REPETITION_WINDOW
            || maximum_new_tokens == 0
            || maximum_new_tokens > MAXIMUM_NEW_TOKENS
            || temperature_millionths == 0 && (top_k != 1 || top_p_millionths != MILLION)
        {
            return Err(Sampling2Error::new("sampling2-config"));
        }
        Ok(Self {
            temperature_millionths,
            top_k,
            top_p_millionths,
            repetition_penalty_millionths,
            repetition_window,
            maximum_new_tokens,
        })
    }

    /// Returns the exact temperature in millionths.
    pub const fn temperature_millionths(self) -> u32 {
        self.temperature_millionths
    }

    /// Returns the exact top-k ceiling.
    pub const fn top_k(self) -> u32 {
        self.top_k
    }

    /// Returns the exact nucleus threshold in millionths.
    pub const fn top_p_millionths(self) -> u32 {
        self.top_p_millionths
    }

    /// Returns the exact repetition penalty in millionths.
    pub const fn repetition_penalty_millionths(self) -> u32 {
        self.repetition_penalty_millionths
    }

    /// Returns the generated-token repetition window.
    pub const fn repetition_window(self) -> u32 {
        self.repetition_window
    }

    /// Returns the maximum generated non-stop token count.
    pub const fn maximum_new_tokens(self) -> u32 {
        self.maximum_new_tokens
    }

    fn validate_for(
        self,
        vocabulary_size: u32,
        policy: Sampling2Policy,
    ) -> Result<(), Sampling2Error> {
        if vocabulary_size == 0
            || vocabulary_size > policy.maximum_vocabulary_size
            || self.top_k > vocabulary_size
            || self.top_k > policy.maximum_top_k
            || self.repetition_window > policy.maximum_repetition_window
            || self.maximum_new_tokens > policy.maximum_new_tokens
        {
            return Err(Sampling2Error::new("sampling2-config"));
        }
        Ok(())
    }
}

/// Exact serializable xoshiro256** state and consumed-word count.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Sampling2State {
    words: [u64; 4],
    draw_count: u64,
}

impl Sampling2State {
    /// Expands one exact seed through four SplitMix64 outputs.
    pub fn from_seed(seed: u64) -> Self {
        let mut context = seed;
        let words = [
            splitmix64_word(&mut context),
            splitmix64_word(&mut context),
            splitmix64_word(&mut context),
            splitmix64_word(&mut context),
        ];
        Self {
            words,
            draw_count: 0,
        }
    }

    /// Parses one exact 40-byte little-endian state.
    pub fn from_bytes(bytes: [u8; 40]) -> Result<Self, Sampling2Error> {
        let mut words = [0_u64; 4];
        for (index, word) in words.iter_mut().enumerate() {
            *word = u64::from_le_bytes(
                bytes[index * 8..index * 8 + 8]
                    .try_into()
                    .map_err(|_| Sampling2Error::new("sampling2-prng-state"))?,
            );
        }
        let draw_count = u64::from_le_bytes(
            bytes[32..40]
                .try_into()
                .map_err(|_| Sampling2Error::new("sampling2-prng-state"))?,
        );
        let state = Self { words, draw_count };
        state.validate()?;
        Ok(state)
    }

    /// Serializes the four state words and draw count as 40 exact bytes.
    pub fn to_bytes(self) -> [u8; 40] {
        let mut bytes = [0_u8; 40];
        for (index, word) in self.words.iter().enumerate() {
            bytes[index * 8..index * 8 + 8].copy_from_slice(&word.to_le_bytes());
        }
        bytes[32..40].copy_from_slice(&self.draw_count.to_le_bytes());
        bytes
    }

    /// Returns the number of generated u64 words consumed by this state.
    pub const fn draw_count(self) -> u64 {
        self.draw_count
    }

    /// Produces one exact xoshiro256** word and advances this state.
    pub fn next_u64(&mut self) -> Result<u64, Sampling2Error> {
        self.validate()?;
        if self.draw_count == u64::MAX {
            return Err(Sampling2Error::new("sampling2-prng-exhausted"));
        }
        let result = self.words[1].wrapping_mul(5).rotate_left(7).wrapping_mul(9);
        let temporary = self.words[1] << 17;
        self.words[2] ^= self.words[0];
        self.words[3] ^= self.words[1];
        self.words[1] ^= self.words[2];
        self.words[0] ^= self.words[3];
        self.words[2] ^= temporary;
        self.words[3] = self.words[3].rotate_left(45);
        self.draw_count += 1;
        Ok(result)
    }

    /// Draws one unbiased integer in `0..bound` using two-word rejection.
    pub fn uniform_below(&mut self, bound: u128) -> Result<u128, Sampling2Error> {
        if bound == 0 {
            return Err(Sampling2Error::new("sampling2-arithmetic"));
        }
        let threshold = 0_u128.wrapping_sub(bound) % bound;
        loop {
            let high = u128::from(self.next_u64()?);
            let low = u128::from(self.next_u64()?);
            let candidate = (high << 64) | low;
            if candidate >= threshold {
                return Ok(candidate % bound);
            }
        }
    }

    fn validate(self) -> Result<(), Sampling2Error> {
        if self.words.iter().all(|word| *word == 0) {
            return Err(Sampling2Error::new("sampling2-prng-state"));
        }
        Ok(())
    }
}

/// One selected token and the exact post-operation PRNG state.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SampledToken {
    /// Selected vocabulary token ID.
    pub token_id: u32,
    /// State after all committed selection draws.
    pub state: Sampling2State,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct Candidate {
    token_id: u32,
    score: i64,
    weight: u64,
}

/// Validated canonical Sampling2 artifact and deterministic sampler.
#[derive(Clone, Debug)]
pub struct Sampling2 {
    identity: SamplingIdentity,
    weights: Vec<u64>,
    policy: Sampling2Policy,
}

impl Sampling2 {
    /// Parses and fully validates one canonical Sampling2 artifact.
    pub fn from_bytes(bytes: Vec<u8>, policy: Sampling2Policy) -> Result<Self, Sampling2Error> {
        validate_profile_identity()?;
        if bytes.len() as u64 > policy.maximum_artifact_bytes {
            return Err(Sampling2Error::new("sampling2-artifact-limit"));
        }
        validate_header(&bytes)?;
        if !all_zero(
            bytes
                .get(168..HEADER_BYTES)
                .ok_or_else(|| Sampling2Error::new("sampling2-header"))?,
        ) {
            return Err(Sampling2Error::new("sampling2-reserved"));
        }
        let table = bytes
            .get(HEADER_BYTES..)
            .ok_or_else(|| Sampling2Error::new("sampling2-layout"))?;
        let table_digest: [u8; 32] = Sha256::digest(table).into();
        if table_digest.as_slice() != table_sha256_bytes()
            || hex_lower(&table_digest) != SAMPLING2_WEIGHT_TABLE_SHA256
        {
            return Err(Sampling2Error::new("sampling2-table-hash"));
        }
        let weights = parse_weights(table)?;
        let digest: [u8; 32] = Sha256::digest(&bytes).into();
        if hex_lower(&digest) != SAMPLING2_ARTIFACT_SHA256 {
            return Err(Sampling2Error::new("sampling2-artifact-identity"));
        }
        Ok(Self {
            identity: SamplingIdentity {
                byte_length: bytes.len() as u64,
                sha256: digest,
            },
            weights,
            policy,
        })
    }

    /// Returns the exact whole-artifact identity.
    pub const fn identity(&self) -> SamplingIdentity {
        self.identity
    }

    /// Returns the exact Sampling2 format profile identifier.
    pub const fn profile_id(&self) -> &'static str {
        SAMPLING2_FORMAT_PROFILE_ID
    }

    /// Selects one token from exact IEEE-754 binary32 bit patterns.
    ///
    /// The supplied state is copied. Every failure therefore leaves the
    /// caller's original state available and returns no token.
    pub fn sample_bits(
        &self,
        logit_bits: &[u32],
        generated_history: &[u32],
        config: Sampling2Config,
        state: Sampling2State,
    ) -> Result<SampledToken, Sampling2Error> {
        let vocabulary_size = u32::try_from(logit_bits.len())
            .map_err(|_| Sampling2Error::new("sampling2-vocabulary"))?;
        if vocabulary_size == 0 || vocabulary_size > self.policy.maximum_vocabulary_size {
            return Err(Sampling2Error::new("sampling2-vocabulary"));
        }
        config.validate_for(vocabulary_size, self.policy)?;
        if generated_history.len() > self.policy.maximum_new_tokens as usize
            || generated_history
                .iter()
                .any(|token_id| *token_id >= vocabulary_size)
        {
            return Err(Sampling2Error::new("sampling2-history-token"));
        }
        state.validate()?;
        let repeated: HashSet<u32> = generated_history
            .iter()
            .rev()
            .take(config.repetition_window as usize)
            .copied()
            .collect();
        let mut candidates = Vec::with_capacity(logit_bits.len());
        for (token_id, bits) in logit_bits.iter().copied().enumerate() {
            let Some(mut score) = fixed_score_from_bits(bits)? else {
                continue;
            };
            if repeated.contains(&(token_id as u32)) {
                score = apply_repetition_penalty(score, config.repetition_penalty_millionths)?;
            }
            candidates.push(Candidate {
                token_id: token_id as u32,
                score,
                weight: 0,
            });
        }
        if candidates.is_empty() {
            return Err(Sampling2Error::new("sampling2-all-masked"));
        }
        candidates.sort_unstable_by(|left, right| match right.score.cmp(&left.score) {
            Ordering::Equal => left.token_id.cmp(&right.token_id),
            ordering => ordering,
        });
        candidates.truncate(config.top_k as usize);
        if config.temperature_millionths == 0 {
            return Ok(SampledToken {
                token_id: candidates[0].token_id,
                state,
            });
        }
        let maximum = candidates[0].score;
        let mut total = 0_u128;
        for candidate in &mut candidates {
            let gap = u128::try_from(maximum - candidate.score)
                .map_err(|_| Sampling2Error::new("sampling2-arithmetic"))?;
            let numerator = gap
                .checked_mul(u128::from(LOG_STEPS_PER_NATURAL_UNIT))
                .and_then(|value| value.checked_mul(u128::from(MILLION)))
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
            let denominator = u128::from(config.temperature_millionths)
                .checked_mul(LOGIT_SCALE)
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
            let step = round_div_even_unsigned(numerator, denominator)?;
            candidate.weight = if step <= u128::from(MAXIMUM_LOG_STEP) {
                self.weights[step as usize]
            } else {
                0
            };
            total = total
                .checked_add(u128::from(candidate.weight))
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
        }
        if total == 0 {
            return Err(Sampling2Error::new("sampling2-arithmetic"));
        }
        let target_numerator = total
            .checked_mul(u128::from(config.top_p_millionths))
            .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
        let target = ceil_div_unsigned(target_numerator, u128::from(MILLION))?;
        let mut retained_length = 0_usize;
        let mut retained_weight = 0_u128;
        for candidate in &candidates {
            retained_length += 1;
            retained_weight = retained_weight
                .checked_add(u128::from(candidate.weight))
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
            if retained_weight >= target {
                break;
            }
        }
        if retained_length == 0 || retained_weight == 0 {
            return Err(Sampling2Error::new("sampling2-arithmetic"));
        }
        let mut next_state = state;
        let draw = next_state.uniform_below(retained_weight)?;
        let mut cumulative = 0_u128;
        for candidate in &candidates[..retained_length] {
            cumulative = cumulative
                .checked_add(u128::from(candidate.weight))
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
            if cumulative > draw {
                return Ok(SampledToken {
                    token_id: candidate.token_id,
                    state: next_state,
                });
            }
        }
        Err(Sampling2Error::new("sampling2-arithmetic"))
    }

    /// Selects one token from Rust `f32` values using their exact bit patterns.
    pub fn sample_f32(
        &self,
        logits: &[f32],
        generated_history: &[u32],
        config: Sampling2Config,
        state: Sampling2State,
    ) -> Result<SampledToken, Sampling2Error> {
        let bits: Vec<u32> = logits.iter().map(|value| value.to_bits()).collect();
        self.sample_bits(&bits, generated_history, config, state)
    }
}

/// Converts one exact binary32 bit pattern into the profile's signed Q20 score.
///
/// Exact negative infinity returns `None` as the sole mask encoding. NaN,
/// positive infinity, and unsupported finite magnitudes fail closed.
pub fn fixed_score_from_bits(bits: u32) -> Result<Option<i64>, Sampling2Error> {
    let sign = bits >> 31;
    let exponent = (bits >> 23) & 0xff;
    let fraction = bits & 0x7f_ffff;
    if exponent == 0xff {
        if fraction != 0 {
            return Err(Sampling2Error::new("sampling2-logit-nan"));
        }
        if sign == 0 {
            return Err(Sampling2Error::new("sampling2-logit-positive-infinity"));
        }
        return Ok(None);
    }
    if exponent == 0 && fraction == 0 {
        return Ok(Some(0));
    }
    let significand = u128::from(if exponent == 0 {
        fraction
    } else {
        0x80_0000 + fraction
    });
    let shift = if exponent == 0 {
        -129_i32
    } else {
        exponent as i32 - 130
    };
    let magnitude = if shift >= 0 {
        if shift > 35 {
            return Err(Sampling2Error::new("sampling2-logit-range"));
        }
        significand
            .checked_shl(shift as u32)
            .ok_or_else(|| Sampling2Error::new("sampling2-logit-range"))?
    } else {
        round_shift_right(significand, (-shift) as u32)?
    };
    if magnitude > MAXIMUM_FIXED_LOGIT {
        return Err(Sampling2Error::new("sampling2-logit-range"));
    }
    if magnitude == 0 {
        return Ok(Some(0));
    }
    let signed =
        i64::try_from(magnitude).map_err(|_| Sampling2Error::new("sampling2-logit-range"))?;
    Ok(Some(if sign == 0 { signed } else { -signed }))
}

/// Terminal or active state of one bounded generation controller.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenerationStatus {
    /// More model sampling is allowed.
    Active,
    /// A template-owned stop token was selected and was not appended.
    StopToken(u32),
    /// The configured non-stop generation count was reached.
    MaximumNewTokens,
    /// The active context-token ceiling was reached.
    ContextLimit,
    /// Explicit cancellation was observed before sampling.
    Cancelled,
}

/// Result of one generation-controller transition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenerationStep {
    /// Token selected by sampling, or absence for cancellation.
    pub selected_token_id: Option<u32>,
    /// State after the transition.
    pub status: GenerationStatus,
}

/// Bounded generation state with explicit stop, limit, and cancellation rules.
#[derive(Clone, Debug)]
pub struct GenerationController {
    sampling_identity: SamplingIdentity,
    config: Sampling2Config,
    prompt_token_count: u32,
    vocabulary_size: u32,
    maximum_context_tokens: u32,
    stop_token_ids: Vec<u32>,
    state: Sampling2State,
    generated: Vec<u32>,
    status: GenerationStatus,
}

impl GenerationController {
    /// Creates one controller from a complete configuration and ordered stop set.
    pub fn new(
        sampling: &Sampling2,
        config: Sampling2Config,
        prompt_token_count: u32,
        vocabulary_size: u32,
        stop_token_ids: &[u32],
        state: Sampling2State,
    ) -> Result<Self, Sampling2Error> {
        config.validate_for(vocabulary_size, sampling.policy)?;
        state.validate()?;
        if prompt_token_count > sampling.policy.maximum_context_tokens {
            return Err(Sampling2Error::new("sampling2-config"));
        }
        if stop_token_ids.is_empty()
            || stop_token_ids.len() > sampling.policy.maximum_stop_tokens as usize
        {
            return Err(Sampling2Error::new("sampling2-stop-token"));
        }
        let mut seen = HashSet::with_capacity(stop_token_ids.len());
        if stop_token_ids
            .iter()
            .any(|token_id| *token_id >= vocabulary_size || !seen.insert(*token_id))
        {
            return Err(Sampling2Error::new("sampling2-stop-token"));
        }
        let status = if prompt_token_count == sampling.policy.maximum_context_tokens {
            GenerationStatus::ContextLimit
        } else {
            GenerationStatus::Active
        };
        Ok(Self {
            sampling_identity: sampling.identity,
            config,
            prompt_token_count,
            vocabulary_size,
            maximum_context_tokens: sampling.policy.maximum_context_tokens,
            stop_token_ids: stop_token_ids.to_vec(),
            state,
            generated: Vec::with_capacity(config.maximum_new_tokens as usize),
            status,
        })
    }

    /// Returns the controller's current state.
    pub const fn status(&self) -> GenerationStatus {
        self.status
    }

    /// Narrows the context ceiling before the first generated token.
    ///
    /// Hosts may reserve less KV than the artifact's maximum context. A prompt
    /// exactly at this ceiling is terminal without a draw. Invalid, expanding,
    /// or post-generation changes leave the controller unchanged.
    pub fn restrict_context(&mut self, maximum_context_tokens: u32) -> Result<(), Sampling2Error> {
        if !self.generated.is_empty()
            || !matches!(
                self.status,
                GenerationStatus::Active | GenerationStatus::ContextLimit
            )
        {
            return Err(Sampling2Error::new("sampling2-generation-terminal"));
        }
        if maximum_context_tokens == 0
            || maximum_context_tokens > self.maximum_context_tokens
            || self.prompt_token_count > maximum_context_tokens
        {
            return Err(Sampling2Error::new("sampling2-config"));
        }
        self.maximum_context_tokens = maximum_context_tokens;
        self.status = if self.prompt_token_count == maximum_context_tokens {
            GenerationStatus::ContextLimit
        } else {
            GenerationStatus::Active
        };
        Ok(())
    }

    /// Returns generated non-stop token IDs in exact order.
    pub fn generated_token_ids(&self) -> &[u32] {
        &self.generated
    }

    /// Returns the current exact PRNG state.
    pub const fn sampling_state(&self) -> Sampling2State {
        self.state
    }

    /// Performs one fail-closed transition.
    ///
    /// Cancellation is checked before logits and consumes no random words.
    pub fn step_bits(
        &mut self,
        sampling: &Sampling2,
        logit_bits: &[u32],
        cancelled: bool,
    ) -> Result<GenerationStep, Sampling2Error> {
        if self.status != GenerationStatus::Active {
            return Err(Sampling2Error::new("sampling2-generation-terminal"));
        }
        if sampling.identity != self.sampling_identity {
            return Err(Sampling2Error::new("sampling2-artifact-identity"));
        }
        if cancelled {
            self.status = GenerationStatus::Cancelled;
            return Ok(GenerationStep {
                selected_token_id: None,
                status: self.status,
            });
        }
        if logit_bits.len() != self.vocabulary_size as usize {
            return Err(Sampling2Error::new("sampling2-vocabulary"));
        }
        let sampled = sampling.sample_bits(logit_bits, &self.generated, self.config, self.state)?;
        self.state = sampled.state;
        if self.stop_token_ids.contains(&sampled.token_id) {
            self.status = GenerationStatus::StopToken(sampled.token_id);
            return Ok(GenerationStep {
                selected_token_id: Some(sampled.token_id),
                status: self.status,
            });
        }
        self.generated.push(sampled.token_id);
        if self
            .prompt_token_count
            .checked_add(self.generated.len() as u32)
            .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?
            >= self.maximum_context_tokens
        {
            self.status = GenerationStatus::ContextLimit;
        } else if self.generated.len() as u32 >= self.config.maximum_new_tokens {
            self.status = GenerationStatus::MaximumNewTokens;
        }
        Ok(GenerationStep {
            selected_token_id: Some(sampled.token_id),
            status: self.status,
        })
    }
}

fn validate_header(bytes: &[u8]) -> Result<(), Sampling2Error> {
    if bytes.len() < HEADER_BYTES
        || bytes.get(0..8) != Some(MAGIC)
        || bytes.get(8..24) != Some(FORMAT_ID)
        || get_u32(bytes, 24)? != HEADER_BYTES as u32
        || get_u16(bytes, 28)? != 2
        || get_u16(bytes, 30)? != 0
        || get_u32(bytes, 32)? != 0x0102_0304
    {
        return Err(Sampling2Error::new("sampling2-header"));
    }
    if get_u16(bytes, 36)? != 1 || get_u16(bytes, 38)? != 0 {
        return Err(Sampling2Error::new("sampling2-profile"));
    }
    if get_u64(bytes, 40)? != bytes.len() as u64 || bytes.len() != FILE_BYTES {
        return Err(Sampling2Error::new("sampling2-header"));
    }
    if get_u64(bytes, 48)? != HEADER_BYTES as u64
        || get_u32(bytes, 56)? != WEIGHT_COUNT as u32
        || get_u32(bytes, 60)? != WEIGHT_RECORD_BYTES as u32
        || HEADER_BYTES + WEIGHT_COUNT * WEIGHT_RECORD_BYTES != bytes.len()
    {
        return Err(Sampling2Error::new("sampling2-layout"));
    }
    if get_u32(bytes, 64)? != LOG_STEPS_PER_NATURAL_UNIT
        || get_u32(bytes, 68)? != MAXIMUM_LOG_STEP
        || get_u16(bytes, 72)? != WEIGHT_FRACTION_BITS
        || get_u16(bytes, 74)? != 1
        || get_u16(bytes, 76)? != 1
        || get_u16(bytes, 78)? != 1
        || get_u32(bytes, 80)? != MAXIMUM_VOCABULARY_SIZE
        || get_u32(bytes, 84)? != MAXIMUM_TOP_K
        || get_u32(bytes, 88)? != MAXIMUM_REPETITION_WINDOW
        || get_u32(bytes, 92)? != MAXIMUM_STOP_TOKENS
        || get_u32(bytes, 96)? != MAXIMUM_NEW_TOKENS
        || get_u32(bytes, 100)? != MAXIMUM_CONTEXT_TOKENS
        || get_u32(bytes, 104)? != MILLION
        || get_u16(bytes, 108)? != LOGIT_FRACTION_BITS
        || get_u16(bytes, 110)? != 1
        || get_u32(bytes, 112)? != 1
        || get_u32(bytes, 116)? != MAXIMUM_TEMPERATURE
        || get_u32(bytes, 120)? != 1
        || get_u32(bytes, 124)? != MILLION
        || get_u32(bytes, 128)? != MINIMUM_REPETITION_PENALTY
        || get_u32(bytes, 132)? != MAXIMUM_REPETITION_PENALTY
    {
        return Err(Sampling2Error::new("sampling2-profile"));
    }
    if bytes.get(136..168) != Some(table_sha256_bytes()) {
        return Err(Sampling2Error::new("sampling2-table-hash"));
    }
    Ok(())
}

fn parse_weights(table: &[u8]) -> Result<Vec<u64>, Sampling2Error> {
    if table.len() != WEIGHT_COUNT * WEIGHT_RECORD_BYTES {
        return Err(Sampling2Error::new("sampling2-layout"));
    }
    let mut weights = Vec::with_capacity(WEIGHT_COUNT);
    let mut prior = None;
    for record in table.chunks_exact(WEIGHT_RECORD_BYTES) {
        let weight = u64::from_le_bytes(
            record
                .try_into()
                .map_err(|_| Sampling2Error::new("sampling2-table-values"))?,
        );
        if weight == 0 || prior.is_some_and(|value| weight > value) {
            return Err(Sampling2Error::new("sampling2-table-values"));
        }
        weights.push(weight);
        prior = Some(weight);
    }
    if weights.first() != Some(&(1_u64 << 48)) || weights.last() != Some(&4) {
        return Err(Sampling2Error::new("sampling2-table-values"));
    }
    Ok(weights)
}

fn apply_repetition_penalty(score: i64, penalty: u32) -> Result<i64, Sampling2Error> {
    if score > 0 {
        let adjusted = round_div_even_unsigned(
            u128::from(score as u64)
                .checked_mul(u128::from(MILLION))
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?,
            u128::from(penalty),
        )?;
        return i64::try_from(adjusted).map_err(|_| Sampling2Error::new("sampling2-arithmetic"));
    }
    if score < 0 {
        let magnitude = u128::from(score.unsigned_abs());
        let adjusted = round_div_even_unsigned(
            magnitude
                .checked_mul(u128::from(penalty))
                .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?,
            u128::from(MILLION),
        )?;
        let signed =
            i64::try_from(adjusted).map_err(|_| Sampling2Error::new("sampling2-arithmetic"))?;
        return Ok(-signed);
    }
    Ok(0)
}

fn round_shift_right(value: u128, shift: u32) -> Result<u128, Sampling2Error> {
    if shift >= 128 {
        return Ok(0);
    }
    round_div_even_unsigned(value, 1_u128 << shift)
}

fn round_div_even_unsigned(numerator: u128, denominator: u128) -> Result<u128, Sampling2Error> {
    if denominator == 0 {
        return Err(Sampling2Error::new("sampling2-arithmetic"));
    }
    let quotient = numerator / denominator;
    let remainder = numerator % denominator;
    let doubled = remainder
        .checked_mul(2)
        .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?;
    Ok(match doubled.cmp(&denominator) {
        Ordering::Less => quotient,
        Ordering::Greater => quotient
            .checked_add(1)
            .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?,
        Ordering::Equal if quotient.is_multiple_of(2) => quotient,
        Ordering::Equal => quotient
            .checked_add(1)
            .ok_or_else(|| Sampling2Error::new("sampling2-arithmetic"))?,
    })
}

fn ceil_div_unsigned(numerator: u128, denominator: u128) -> Result<u128, Sampling2Error> {
    if denominator == 0 {
        return Err(Sampling2Error::new("sampling2-arithmetic"));
    }
    if numerator == 0 {
        return Ok(0);
    }
    Ok((numerator - 1) / denominator + 1)
}

fn splitmix64_word(context: &mut u64) -> u64 {
    *context = context.wrapping_add(SPLITMIX_INCREMENT);
    let mut value = *context;
    value = (value ^ (value >> 30)).wrapping_mul(SPLITMIX_MIX_1);
    value = (value ^ (value >> 27)).wrapping_mul(SPLITMIX_MIX_2);
    value ^ (value >> 31)
}
