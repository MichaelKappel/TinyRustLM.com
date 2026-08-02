/// Small deterministic generator used only to make replayable oracle inputs.
///
/// The generator is intentionally not advertised as cryptographic or
/// statistically suitable for training. Its xorshift transition is fully
/// specified here so a seed has stable experiment semantics.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    /// Creates a replayable stream from `seed`; zero maps to the sole explicit
    /// nonzero sentinel because the xorshift transition cannot leave zero.
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { u64::MAX } else { seed },
        }
    }

    /// Advances the xorshift stream and returns all 64 output bits.
    pub fn next_u64(&mut self) -> u64 {
        let mut value = self.state;
        value ^= value << 13;
        value ^= value >> 7;
        value ^= value << 17;
        self.state = value;
        value
    }

    /// Returns a deterministic value in the half-open interval `[0, 1)`.
    pub fn next_unit_f64(&mut self) -> f64 {
        const DENOMINATOR: f64 = (1_u64 << 53) as f64;
        ((self.next_u64() >> 11) as f64) / DENOMINATOR
    }

    /// Returns an unbiased index in `0..upper` using rejection sampling.
    pub(crate) fn index_below(&mut self, upper: usize) -> usize {
        debug_assert!(upper > 0);
        let upper_u64 = upper as u64;
        let acceptance_limit = u64::MAX - (u64::MAX % upper_u64);
        loop {
            let candidate = self.next_u64();
            if candidate < acceptance_limit {
                return (candidate % upper_u64) as usize;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::DeterministicRng;

    /// Confirms equal seeds replay exactly and distinct seeds separate streams.
    #[test]
    fn explicit_seed_controls_replay() {
        let mut first = DeterministicRng::new(42);
        let mut replay = DeterministicRng::new(42);
        let mut different = DeterministicRng::new(43);

        let first_values: Vec<u64> = (0..16).map(|_| first.next_u64()).collect();
        let replay_values: Vec<u64> = (0..16).map(|_| replay.next_u64()).collect();
        let different_values: Vec<u64> = (0..16).map(|_| different.next_u64()).collect();

        assert_eq!(first_values, replay_values);
        assert_ne!(first_values, different_values);
    }

    /// Confirms the zero-seed sentinel advances and unit values honor bounds.
    #[test]
    fn zero_seed_and_unit_interval_are_bounded() {
        let mut generator = DeterministicRng::new(0);
        let first = generator.next_u64();
        assert_ne!(first, 0);

        for _ in 0..1_000 {
            let value = generator.next_unit_f64();
            assert!((0.0..1.0).contains(&value));
        }
    }

    /// Exercises every accepted upper bound in a small deterministic range.
    #[test]
    fn bounded_indices_never_escape_the_requested_range() {
        let mut generator = DeterministicRng::new(7);
        for upper in 1..=257 {
            for _ in 0..32 {
                assert!(generator.index_below(upper) < upper);
            }
        }
    }
}
