//! Core math operations for CPU/WASM inference.

use crate::errors::ErrorCode;

/// Computes a dot product between equal-length slices.
pub fn dot(a: &[f32], b: &[f32]) -> Result<f32, ErrorCode> {
    if a.len() != b.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut sum = 0.0f32;
    for index in 0..a.len() {
        sum += a[index] * b[index];
    }
    Ok(sum)
}

/// Computes a row-major f32 matrix-vector product.
pub fn matvec_f32(
    matrix: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if matrix.len() != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
        || vector.len() != cols
        || out.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    for (row, output) in out.iter_mut().enumerate().take(rows) {
        let start = row * cols;
        *output = dot(&matrix[start..start + cols], vector)?;
    }
    Ok(())
}

/// Computes a row-major f32 matrix-matrix product.
pub fn matmul_f32(
    a: &[f32],
    a_rows: usize,
    a_cols: usize,
    b: &[f32],
    b_cols: usize,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if a.len() != a_rows.checked_mul(a_cols).ok_or(ErrorCode::InvalidLength)?
        || b.len() != a_cols.checked_mul(b_cols).ok_or(ErrorCode::InvalidLength)?
        || out.len() != a_rows.checked_mul(b_cols).ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    for row in 0..a_rows {
        for col in 0..b_cols {
            let mut sum = 0.0f32;
            for inner in 0..a_cols {
                sum += a[row * a_cols + inner] * b[inner * b_cols + col];
            }
            out[row * b_cols + col] = sum;
        }
    }
    Ok(())
}

/// Applies RMSNorm to `input` with per-channel `weight`.
pub fn rms_norm(
    input: &[f32],
    weight: &[f32],
    epsilon: f32,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if input.len() != weight.len() || input.len() != out.len() || input.is_empty() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut mean_square = 0.0f32;
    for value in input {
        mean_square += value * value;
    }
    mean_square /= input.len() as f32;
    let scale = 1.0 / (mean_square + epsilon).sqrt();
    for index in 0..input.len() {
        out[index] = input[index] * scale * weight[index];
    }
    Ok(())
}

/// Applies stable softmax in-place.
pub fn softmax(values: &mut [f32]) -> Result<(), ErrorCode> {
    if values.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    let mut max = f32::NEG_INFINITY;
    for value in values.iter() {
        max = max.max(*value);
    }
    let mut sum = 0.0f32;
    for value in values.iter_mut() {
        *value = (*value - max).exp();
        sum += *value;
    }
    if sum == 0.0 || !sum.is_finite() {
        return Err(ErrorCode::GenerationFailed);
    }
    for value in values.iter_mut() {
        *value /= sum;
    }
    Ok(())
}

/// Computes the SiLU activation.
pub fn silu(value: f32) -> f32 {
    value / (1.0 + (-value).exp())
}

/// Computes SwiGLU activation for paired slices.
pub fn swiglu(gate: &[f32], up: &[f32], out: &mut [f32]) -> Result<(), ErrorCode> {
    if gate.len() != up.len() || up.len() != out.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    for index in 0..gate.len() {
        out[index] = silu(gate[index]) * up[index];
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(actual: f32, expected: f32) {
        assert!(
            (actual - expected).abs() < 0.0001,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn dot_known_output() {
        let left = [1.0, -2.0, 0.5];
        let right = [4.0, 3.0, -8.0];
        assert_close(dot(&left, &right).unwrap(), -6.0);
    }

    #[test]
    fn dot_rejects_shape_mismatch() {
        assert_eq!(dot(&[1.0, 2.0], &[1.0]), Err(ErrorCode::ShapeMismatch));
    }

    #[test]
    fn rmsnorm_known_vector() {
        let input = [1.0, 2.0, 3.0, 4.0];
        let weight = [1.0, 1.0, 1.0, 1.0];
        let mut out = [0.0; 4];
        rms_norm(&input, &weight, 0.0, &mut out).unwrap();
        assert_close(out[0], 0.36514837);
    }

    #[test]
    fn softmax_sum_is_one() {
        let mut values = [1.0, 2.0, 3.0];
        softmax(&mut values).unwrap();
        let sum: f32 = values.iter().sum();
        assert_close(sum, 1.0);
    }

    #[test]
    fn softmax_rejects_empty_slice() {
        let mut values = [];
        assert_eq!(softmax(&mut values), Err(ErrorCode::InvalidLength));
    }

    #[test]
    fn matvec_known_output() {
        let matrix = [1.0, 2.0, 3.0, 4.0];
        let vector = [2.0, 3.0];
        let mut out = [0.0; 2];
        matvec_f32(&matrix, 2, 2, &vector, &mut out).unwrap();
        assert_eq!(out, [8.0, 18.0]);
    }

    #[test]
    fn matvec_rejects_shape_mismatch() {
        let mut out = [0.0; 2];
        assert_eq!(
            matvec_f32(&[1.0, 2.0, 3.0, 4.0], 2, 2, &[1.0], &mut out),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    #[test]
    fn matmul_known_output() {
        let a = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        let b = [7.0, 8.0, 9.0, 10.0, 11.0, 12.0];
        let mut out = [0.0; 4];
        matmul_f32(&a, 2, 3, &b, 2, &mut out).unwrap();
        assert_eq!(out, [58.0, 64.0, 139.0, 154.0]);
    }

    #[test]
    fn matmul_rejects_shape_mismatch() {
        let mut out = [0.0; 4];
        assert_eq!(
            matmul_f32(&[1.0, 2.0, 3.0], 1, 3, &[1.0, 2.0, 3.0], 2, &mut out),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    #[test]
    fn silu_known_values() {
        assert_close(silu(0.0), 0.0);
        assert_close(silu(1.0), 0.7310586);
        assert_close(silu(-1.0), -0.26894143);
    }

    #[test]
    fn swiglu_known_output() {
        let gate = [0.0, 1.0, -1.0];
        let up = [2.0, 3.0, 4.0];
        let mut out = [0.0; 3];
        swiglu(&gate, &up, &mut out).unwrap();
        assert_close(out[0], 0.0);
        assert_close(out[1], 2.1931758);
        assert_close(out[2], -1.0757657);
    }

    #[test]
    fn swiglu_rejects_shape_mismatch() {
        let mut out = [0.0; 2];
        assert_eq!(
            swiglu(&[1.0, 2.0], &[1.0], &mut out),
            Err(ErrorCode::ShapeMismatch)
        );
    }
}
