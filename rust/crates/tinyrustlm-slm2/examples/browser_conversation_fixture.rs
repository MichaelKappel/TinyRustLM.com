//! Test-only synthetic conversation weights; emits SLM2 to stdout without storing model files.
#![forbid(unsafe_code)]

use std::io::{self, Cursor, Write};
use tinyrustlm_slm2::{required_model_tensors, write_model, ArtifactClass, ModelSpec, TensorInput};

/// Accept two distinct visible token rows already checked by the caller's tokenizer.
fn output_rows(args: &[String]) -> Result<[u32; 2], &'static str> {
    if args.len() != 2 {
        return Err("fixture requires two token IDs");
    }
    let mut rows = [0; 2];
    for (index, arg) in args.iter().enumerate() {
        if arg.is_empty() || !arg.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err("fixture token ID is invalid");
        }
        rows[index] = arg.parse().map_err(|_| "fixture token ID is invalid")?;
    }
    if rows[0] != 0 || rows[1] == 0 || rows[1] >= 151_643 {
        return Err("fixture output rows are invalid");
    }
    Ok(rows)
}

/// Build finite, small weights through the production writer; this is not a trained model.
fn model(rows: [u32; 2]) -> Result<Vec<u8>, tinyrustlm_slm2::Slm2Error> {
    let spec = ModelSpec {
        artifact_class: ArtifactClass::BaseModel,
        vocabulary_size: 151_936,
        context_length: 40_960,
        embedding_size: 8,
        feed_forward_size: 16,
        layer_count: 1,
        head_count: 2,
        kv_head_count: 1,
        head_dimension: 8,
        rope_theta: 10_000.0,
        normalization_epsilon: 0.000_01,
        tied_embeddings: false,
        qkv_bias: true,
        qk_normalization: true,
    };
    let mut tensors = Vec::new();
    for (tensor_index, tensor) in required_model_tensors(&spec, 64)?.into_iter().enumerate() {
        let count = tensor.shape().iter().product::<u64>() as usize;
        let columns = *tensor
            .shape()
            .last()
            .expect("registered tensor has dimensions") as usize;
        let mut bytes = Vec::with_capacity(count * 4);
        for index in 0..count {
            let row = (index / columns) as u32;
            let column = index % columns;
            let value: f32 = if tensor.semantic_role().contains("normalization") {
                1.0
            } else if tensor.semantic_role() == "model.output-projection.weight" {
                // Opposite rows cover either hidden-state sign; row zero wins an exact tie.
                if column != 0 {
                    0.0
                } else if row == rows[0] {
                    1.0
                } else if row == rows[1] {
                    -1.0
                } else {
                    0.0
                }
            } else {
                let magnitude = 0.01
                    + (tensor_index % 7) as f32 * 0.001
                    + (row % 5) as f32 * 0.0005
                    + (column % 3) as f32 * 0.00025;
                if (tensor_index + index).is_multiple_of(2) {
                    magnitude
                } else {
                    -magnitude
                }
            };
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        tensors.push(TensorInput::new(tensor, Cursor::new(bytes)));
    }
    let mut destination = Cursor::new(Vec::new());
    write_model(&mut destination, &spec, &mut tensors)?;
    Ok(destination.into_inner())
}

/// Keep binary stdout separate from bounded errors, with no filesystem output option.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rows = output_rows(&std::env::args().skip(1).collect::<Vec<_>>())?;
    io::stdout().lock().write_all(&model(rows)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_missing_duplicate_control_and_malformed_rows() {
        for args in [
            vec![],
            vec!["0"],
            vec!["0", "0"],
            vec!["1", "2"],
            vec!["0", "151643"],
            vec!["0", "-1"],
            vec!["0", "+1"],
            vec!["0", "4294967296"],
            vec!["0", "1", "2"],
            vec!["", "1"],
        ] {
            assert!(output_rows(&args.into_iter().map(String::from).collect::<Vec<_>>()).is_err());
        }
        assert_eq!(output_rows(&["0".into(), "32".into()]).unwrap(), [0, 32]);
    }

    #[test]
    fn emits_deterministic_current_weights_sensitive_to_selected_row() {
        let first = model([0, 32]).unwrap();
        assert!(first.starts_with(b"SLM2"));
        assert!(first.len() < 4 * 1024 * 1024);
        assert_eq!(first, model([0, 32]).unwrap());
        assert_ne!(first, model([0, 33]).unwrap());
    }
}
