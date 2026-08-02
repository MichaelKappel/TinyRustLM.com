//! Feed-forward network helpers.

use crate::errors::ErrorCode;
use crate::ops::{matvec_f32, swiglu};

/// Row-major FFN matrices for a SwiGLU block.
#[derive(Clone, Copy, Debug)]
pub struct FfnWeights<'a> {
    /// Gate projection matrix.
    pub w1: &'a [f32],
    /// Down projection matrix.
    pub w2: &'a [f32],
    /// Up projection matrix.
    pub w3: &'a [f32],
}

/// Hidden and feed-forward dimensions for an FFN block.
#[derive(Clone, Copy, Debug)]
pub struct FfnShape {
    /// Model hidden width.
    pub hidden: usize,
    /// Feed-forward intermediate width.
    pub ffn: usize,
}

/// Runtime buffers used while applying an FFN block.
pub struct FfnBuffers<'a> {
    /// Input activation vector.
    pub input: &'a [f32],
    /// Scratch buffer sized to at least `ffn * 3`.
    pub scratch: &'a mut [f32],
    /// Output activation vector.
    pub out: &'a mut [f32],
}

/// Applies a f32 SwiGLU feed-forward block.
pub fn ffn_f32(
    weights: FfnWeights<'_>,
    shape: FfnShape,
    buffers: FfnBuffers<'_>,
) -> Result<(), ErrorCode> {
    let hidden = shape.hidden;
    let ffn = shape.ffn;
    let input = buffers.input;
    let scratch = buffers.scratch;
    let out = buffers.out;
    if scratch.len() < ffn * 3 || out.len() != hidden || input.len() != hidden {
        return Err(ErrorCode::ShapeMismatch);
    }
    let (gate, rest) = scratch.split_at_mut(ffn);
    let (up, activated) = rest.split_at_mut(ffn);
    matvec_f32(weights.w1, ffn, hidden, input, gate)?;
    matvec_f32(weights.w3, ffn, hidden, input, up)?;
    swiglu(gate, up, &mut activated[..ffn])?;
    matvec_f32(weights.w2, hidden, ffn, &activated[..ffn], out)?;
    Ok(())
}
