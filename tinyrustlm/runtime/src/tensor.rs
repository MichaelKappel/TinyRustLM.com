//! Tensor view types.

use crate::errors::ErrorCode;

/// Borrowed immutable tensor view.
pub struct TensorView<'a> {
    /// Flat tensor data.
    pub data: &'a [f32],
    /// Tensor shape.
    pub shape: &'a [usize],
}

impl<'a> TensorView<'a> {
    /// Creates a validated immutable tensor view.
    pub fn new(data: &'a [f32], shape: &'a [usize]) -> Result<Self, ErrorCode> {
        let expected = element_count(shape)?;
        if expected != data.len() {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok(Self { data, shape })
    }

    /// Returns a row-major flat index for the provided multidimensional index.
    pub fn flat_index(&self, index: &[usize]) -> Result<usize, ErrorCode> {
        flat_index(self.shape, index)
    }
}

/// Borrowed mutable tensor view.
pub struct MutableTensorView<'a> {
    /// Flat tensor data.
    pub data: &'a mut [f32],
    /// Tensor shape.
    pub shape: &'a [usize],
}

impl<'a> MutableTensorView<'a> {
    /// Creates a validated mutable tensor view.
    pub fn new(data: &'a mut [f32], shape: &'a [usize]) -> Result<Self, ErrorCode> {
        let expected = element_count(shape)?;
        if expected != data.len() {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok(Self { data, shape })
    }

    /// Returns a row-major flat index for the provided multidimensional index.
    pub fn flat_index(&self, index: &[usize]) -> Result<usize, ErrorCode> {
        flat_index(self.shape, index)
    }
}

/// Computes the total element count for a shape.
pub fn element_count(shape: &[usize]) -> Result<usize, ErrorCode> {
    if shape.is_empty() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut total = 1usize;
    for dim in shape {
        if *dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        total = total.checked_mul(*dim).ok_or(ErrorCode::InvalidLength)?;
    }
    Ok(total)
}

fn flat_index(shape: &[usize], index: &[usize]) -> Result<usize, ErrorCode> {
    if shape.len() != index.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut stride = 1usize;
    let mut flat = 0usize;
    for axis in (0..shape.len()).rev() {
        if index[axis] >= shape[axis] {
            return Err(ErrorCode::ShapeMismatch);
        }
        flat += index[axis] * stride;
        stride *= shape[axis];
    }
    Ok(flat)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tensor_view_validates_shape_and_row_major_index() {
        let data = [0.0f32; 24];
        let view = TensorView::new(&data, &[2, 3, 4]).expect("valid tensor view");

        assert_eq!(view.flat_index(&[0, 0, 0]), Ok(0));
        assert_eq!(view.flat_index(&[0, 1, 2]), Ok(6));
        assert_eq!(view.flat_index(&[1, 2, 3]), Ok(23));
        assert_eq!(view.flat_index(&[2, 0, 0]), Err(ErrorCode::ShapeMismatch));
        assert_eq!(view.flat_index(&[0, 0]), Err(ErrorCode::ShapeMismatch));
    }

    #[test]
    fn mutable_tensor_view_validates_shape_and_indexes_scratch() {
        let mut scratch = [0.0f32; 6];
        let view = MutableTensorView::new(&mut scratch, &[2, 3]).expect("valid mutable view");
        let index = view.flat_index(&[1, 2]).expect("flat index");
        view.data[index] = 7.5;

        assert_eq!(scratch[5], 7.5);
    }

    #[test]
    fn tensor_views_reject_bad_shapes() {
        let data = [0.0f32; 4];
        assert!(matches!(
            TensorView::new(&data, &[2, 3]),
            Err(ErrorCode::ShapeMismatch)
        ));
        assert!(matches!(
            TensorView::new(&data, &[0, 4]),
            Err(ErrorCode::ShapeMismatch)
        ));
        assert!(matches!(
            TensorView::new(&data, &[]),
            Err(ErrorCode::ShapeMismatch)
        ));
    }

    #[test]
    fn element_count_rejects_overflow() {
        assert_eq!(
            element_count(&[usize::MAX, 2]),
            Err(ErrorCode::InvalidLength)
        );
    }
}
