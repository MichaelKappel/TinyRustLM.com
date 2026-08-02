//! Rotary positional embedding helpers.

use crate::errors::ErrorCode;

/// Applies Llama-style split-half RoPE to an even-length vector in-place.
pub fn apply_rope(vector: &mut [f32], position: usize, theta: f32) -> Result<(), ErrorCode> {
    if !vector.len().is_multiple_of(2) || theta <= 0.0 {
        return Err(ErrorCode::ShapeMismatch);
    }
    let half = vector.len() / 2;
    for index in 0..half {
        let rotated = index + half;
        let freq = theta.powf(-((index * 2) as f32) / vector.len() as f32);
        let angle = position as f32 * freq;
        let cos = angle.cos();
        let sin = angle.sin();
        let x = vector[index];
        let y = vector[rotated];
        vector[index] = x * cos - y * sin;
        vector[rotated] = y * cos + x * sin;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rope_known_small_vector() {
        let mut vector = [1.0, 0.0];
        apply_rope(&mut vector, 0, 10000.0).unwrap();
        assert!((vector[0] - 1.0).abs() < 0.0001);
        assert!(vector[1].abs() < 0.0001);
    }

    #[test]
    fn rope_uses_llama_split_half_pairs() {
        let mut vector = [1.0, 2.0, 3.0, 4.0];
        apply_rope(&mut vector, 1, 10000.0).unwrap();
        let cos0 = 1.0f32.cos();
        let sin0 = 1.0f32.sin();
        let angle1 = 10000.0f32.powf(-0.5);
        let cos1 = angle1.cos();
        let sin1 = angle1.sin();

        assert!((vector[0] - (1.0 * cos0 - 3.0 * sin0)).abs() < 0.0001);
        assert!((vector[2] - (3.0 * cos0 + 1.0 * sin0)).abs() < 0.0001);
        assert!((vector[1] - (2.0 * cos1 - 4.0 * sin1)).abs() < 0.0001);
        assert!((vector[3] - (4.0 * cos1 + 2.0 * sin1)).abs() < 0.0001);
    }
}
