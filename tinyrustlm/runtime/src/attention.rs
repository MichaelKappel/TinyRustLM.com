//! Causal attention helpers.

use crate::errors::ErrorCode;
use crate::ops::{dot, softmax};

/// Computes causal attention for one query over cached keys and values.
pub fn attend_single(
    query: &[f32],
    keys: &[&[f32]],
    values: &[&[f32]],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if keys.len() != values.len() || query.is_empty() || out.len() != query.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut scores = Vec::with_capacity(keys.len());
    let scale = 1.0 / (query.len() as f32).sqrt();
    for key in keys {
        scores.push(dot(query, key)? * scale);
    }
    softmax(&mut scores)?;
    out.fill(0.0);
    for (position, value) in values.iter().enumerate() {
        if value.len() != out.len() {
            return Err(ErrorCode::ShapeMismatch);
        }
        for index in 0..out.len() {
            out[index] += scores[position] * value[index];
        }
    }
    Ok(())
}
