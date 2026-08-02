//! Deterministic pseudo-random generator for sampling.

/// Small xorshift PRNG for deterministic text sampling.
pub struct XorShift64 {
    state: u64,
}

impl XorShift64 {
    /// Creates a generator with a non-zero seed.
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { 0x9e3779b97f4a7c15 } else { seed },
        }
    }

    /// Returns the next u64 value.
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    /// Returns the next f32 value in `[0, 1)`.
    pub fn next_f32(&mut self) -> f32 {
        let value = self.next_u64() >> 40;
        (value as f32) / ((1u32 << 24) as f32)
    }
}
