//! Immutable parser and direct matvec support for base-bound specialist overlays.

use crate::artifact_digest::sha256_bytes;
#[cfg(test)]
use crate::content_identity::ExecutionBindings;
use crate::content_identity::{Digest32, StandaloneModelIdentity};
use crate::errors::ErrorCode;
use crate::model_format::{TensorEntry, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q5_0, DTYPE_Q8_0};
use std::convert::TryInto;

const MAGIC: [u8; 4] = *b"SLO1";
const VERSION: u32 = 1;
const HEADER_BYTES: usize = 320;
const ENTRY_BYTES: usize = 128;
const ALIGNMENT: usize = 64;
const MAX_TARGETS: usize = 256;
const MAX_FACTOR_RANK: usize = 64;
const MAX_PACKAGE_BYTES: usize = 512 * 1024 * 1024;
const FORMAT_TAG: u32 = 1;

/// Borrowed arguments for one native base and immutable overlay matvec.
pub struct SpecialistMatvec<'a> {
    /// Loaded model tensor directory index.
    pub tensor_index: usize,
    /// Output row count.
    pub rows: usize,
    /// Input column count.
    pub cols: usize,
    /// Input activation vector.
    pub vector: &'a [f32],
    /// Caller-owned output vector.
    pub output: &'a mut [f32],
    /// Caller-owned scratch with at least the overlay's factor rank.
    pub scratch: &'a mut [f32],
}

/// Exact base and interpretation values an overlay package must bind.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct SpecialistOverlayBase {
    model_sha256: Digest32,
    standalone_content_digest: Digest32,
    tokenizer_sha256: Digest32,
    chat_template_sha256: Digest32,
    tensor_layout_sha256: Digest32,
    quantization_profile_sha256: Digest32,
    execution_profile_sha256: Digest32,
}

impl SpecialistOverlayBase {
    /// Derives package bindings from one validated standalone identity.
    pub(crate) fn from_identity(base: &StandaloneModelIdentity) -> Self {
        let bindings = base.execution_bindings();
        Self {
            model_sha256: base.model_sha256(),
            standalone_content_digest: base.id().digest(),
            tokenizer_sha256: bindings.tokenizer_sha256(),
            chat_template_sha256: bindings.chat_template_sha256(),
            tensor_layout_sha256: bindings.tensor_layout_sha256(),
            quantization_profile_sha256: bindings.quantization_profile_sha256(),
            execution_profile_sha256: bindings.execution_profile_sha256(),
        }
    }

    #[cfg(test)]
    fn new(
        model_sha256: Digest32,
        standalone_content_digest: Digest32,
        bindings: ExecutionBindings,
    ) -> Result<Self, ErrorCode> {
        require_digest(model_sha256)?;
        require_digest(standalone_content_digest)?;
        Ok(Self {
            model_sha256,
            standalone_content_digest,
            tokenizer_sha256: bindings.tokenizer_sha256(),
            chat_template_sha256: bindings.chat_template_sha256(),
            tensor_layout_sha256: bindings.tensor_layout_sha256(),
            quantization_profile_sha256: bindings.quantization_profile_sha256(),
            execution_profile_sha256: bindings.execution_profile_sha256(),
        })
    }

    pub(crate) fn ordered_digests(self) -> [Digest32; 7] {
        [
            self.model_sha256,
            self.standalone_content_digest,
            self.tokenizer_sha256,
            self.chat_template_sha256,
            self.tensor_layout_sha256,
            self.quantization_profile_sha256,
            self.execution_profile_sha256,
        ]
    }
}

/// One validated target and its once-decoded immutable f32 factors.
#[derive(Debug)]
struct SpecialistOverlayTarget {
    tensor_index: usize,
    rows: usize,
    cols: usize,
    factor_rank: usize,
    scale: f32,
    output_factors: Box<[f32]>,
    input_factors: Box<[f32]>,
}

impl SpecialistOverlayTarget {
    fn validate_apply(
        &self,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &[f32],
        scratch: &[f32],
    ) -> Result<(), ErrorCode> {
        if rows != self.rows
            || cols != self.cols
            || vector.len() != self.cols
            || out.len() != self.rows
            || scratch.len() < self.factor_rank
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok(())
    }

    fn add_to_output(&self, vector: &[f32], out: &mut [f32], scratch: &mut [f32]) {
        for (component, scratch_value) in scratch.iter_mut().enumerate().take(self.factor_rank) {
            let input_start = component * self.cols;
            let mut sum = 0.0f32;
            for (col, value) in vector.iter().copied().enumerate().take(self.cols) {
                sum += self.input_factors[input_start + col] * value;
            }
            *scratch_value = sum;
        }
        for (row, output) in out.iter_mut().enumerate().take(self.rows) {
            let mut delta = 0.0f32;
            for (component, scratch_value) in scratch.iter().enumerate().take(self.factor_rank) {
                delta += self.output_factors[component * self.rows + row] * scratch_value;
            }
            *output += self.scale * delta;
        }
    }
}

/// A completely validated immutable `SLO1` package.
#[derive(Debug)]
pub struct SpecialistOverlay {
    package_sha256: Digest32,
    base: SpecialistOverlayBase,
    targets: Vec<SpecialistOverlayTarget>,
    maximum_factor_rank: usize,
}

impl SpecialistOverlay {
    /// Parses and completely validates one package without changing a model.
    pub(crate) fn parse(
        bytes: &[u8],
        expected_package_sha256: Digest32,
        expected_base: SpecialistOverlayBase,
        tensors: &[TensorEntry],
    ) -> Result<Self, ErrorCode> {
        validate_package_envelope(bytes, expected_package_sha256, expected_base)?;
        let target_count =
            usize::try_from(read_u32(bytes, 16)?).map_err(|_| ErrorCode::InvalidLength)?;
        let directory_end = HEADER_BYTES
            .checked_add(
                target_count
                    .checked_mul(ENTRY_BYTES)
                    .ok_or(ErrorCode::InvalidLength)?,
            )
            .ok_or(ErrorCode::InvalidLength)?;
        let payload_offset = read_usize_u64(bytes, 32)?;
        if payload_offset != align_to_64(directory_end)? {
            return Err(ErrorCode::InvalidTensorDirectory);
        }
        require_zero(bytes, directory_end, payload_offset)?;

        let mut targets = Vec::new();
        targets
            .try_reserve_exact(target_count)
            .map_err(|_| ErrorCode::InvalidLength)?;
        let mut prior_tensor_index = None;
        let mut expected_output_offset = payload_offset;
        let mut prior_factor_end = payload_offset;
        let mut maximum_factor_rank = 0usize;
        for entry_index in 0..target_count {
            let entry_offset = HEADER_BYTES
                .checked_add(
                    entry_index
                        .checked_mul(ENTRY_BYTES)
                        .ok_or(ErrorCode::InvalidLength)?,
                )
                .ok_or(ErrorCode::InvalidLength)?;
            let target = parse_target(
                bytes,
                entry_offset,
                tensors,
                prior_tensor_index,
                expected_output_offset,
                prior_factor_end,
            )?;
            prior_tensor_index = Some(target.tensor_index);
            prior_factor_end = read_usize_u64(bytes, entry_offset + 72)?
                .checked_add(read_usize_u64(bytes, entry_offset + 80)?)
                .ok_or(ErrorCode::InvalidLength)?;
            expected_output_offset = align_to_64(prior_factor_end)?;
            maximum_factor_rank = maximum_factor_rank.max(target.factor_rank);
            targets.push(target);
        }
        if expected_output_offset != bytes.len() {
            return Err(ErrorCode::InvalidLength);
        }
        require_zero(bytes, prior_factor_end, bytes.len())?;
        Ok(Self {
            package_sha256: expected_package_sha256,
            base: expected_base,
            targets,
            maximum_factor_rank,
        })
    }

    /// Returns the SHA-256 of every exact package byte.
    pub fn package_sha256(&self) -> Digest32 {
        self.package_sha256
    }

    /// Returns the number of targeted base tensors.
    pub fn target_count(&self) -> usize {
        self.targets.len()
    }

    /// Returns the largest caller-owned scratch length needed by this overlay.
    pub fn maximum_factor_rank(&self) -> usize {
        self.maximum_factor_rank
    }

    pub(crate) fn base_model_sha256(&self) -> Digest32 {
        self.base.model_sha256
    }

    pub(crate) fn validate_apply(
        &self,
        tensor_index: usize,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &[f32],
        scratch: &[f32],
    ) -> Result<(), ErrorCode> {
        if let Some(target) = self.target(tensor_index) {
            target.validate_apply(rows, cols, vector, out, scratch)
        } else {
            if vector.len() != cols || out.len() != rows {
                return Err(ErrorCode::ShapeMismatch);
            }
            Ok(())
        }
    }

    pub(crate) fn add_to_output(
        &self,
        tensor_index: usize,
        vector: &[f32],
        out: &mut [f32],
        scratch: &mut [f32],
    ) -> Result<(), ErrorCode> {
        if let Some(target) = self.target(tensor_index) {
            target.add_to_output(vector, out, scratch);
        }
        Ok(())
    }

    fn target(&self, tensor_index: usize) -> Option<&SpecialistOverlayTarget> {
        self.targets
            .binary_search_by_key(&tensor_index, |target| target.tensor_index)
            .ok()
            .map(|index| &self.targets[index])
    }
}

fn validate_package_envelope(
    bytes: &[u8],
    expected_package_sha256: Digest32,
    expected_base: SpecialistOverlayBase,
) -> Result<(), ErrorCode> {
    require_digest(expected_package_sha256)?;
    if bytes.len() < HEADER_BYTES
        || bytes.len() > MAX_PACKAGE_BYTES
        || !bytes.len().is_multiple_of(ALIGNMENT)
    {
        return Err(ErrorCode::InvalidLength);
    }
    if sha256_bytes(bytes)? != expected_package_sha256 {
        return Err(ErrorCode::InvalidHeader);
    }
    if bytes.get(0..4) != Some(MAGIC.as_slice()) {
        return Err(ErrorCode::InvalidHeader);
    }
    if read_u32(bytes, 4)? != VERSION {
        return Err(ErrorCode::UnsupportedModelVersion);
    }
    if read_u32(bytes, 8)? != HEADER_BYTES as u32
        || read_u32(bytes, 12)? != 0
        || read_u32(bytes, 20)? != ENTRY_BYTES as u32
        || read_usize_u64(bytes, 24)? != HEADER_BYTES
        || read_usize_u64(bytes, 40)? != bytes.len()
    {
        return Err(ErrorCode::InvalidHeader);
    }
    let target_count =
        usize::try_from(read_u32(bytes, 16)?).map_err(|_| ErrorCode::InvalidLength)?;
    if target_count == 0 || target_count > MAX_TARGETS {
        return Err(ErrorCode::InvalidHeader);
    }
    let directory_bytes = target_count
        .checked_mul(ENTRY_BYTES)
        .ok_or(ErrorCode::InvalidLength)?;
    let directory_end = HEADER_BYTES
        .checked_add(directory_bytes)
        .ok_or(ErrorCode::InvalidLength)?;
    if read_usize_u64(bytes, 32)? != align_to_64(directory_end)? {
        return Err(ErrorCode::InvalidHeader);
    }
    if read_u32(bytes, 48)? != FORMAT_TAG
        || read_u32(bytes, 52)? != FORMAT_TAG
        || read_u32(bytes, 56)? != FORMAT_TAG
        || read_u32(bytes, 60)? != FORMAT_TAG
    {
        return Err(ErrorCode::InvalidHeader);
    }
    for (index, expected) in expected_base.ordered_digests().iter().enumerate() {
        require_digest(*expected)?;
        if read_digest(bytes, 64 + index * 32)? != *expected {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    require_zero(bytes, 288, HEADER_BYTES)
}

fn parse_target(
    bytes: &[u8],
    offset: usize,
    tensors: &[TensorEntry],
    prior_tensor_index: Option<usize>,
    expected_output_offset: usize,
    prior_factor_end: usize,
) -> Result<SpecialistOverlayTarget, ErrorCode> {
    let tensor_index =
        usize::try_from(read_u32(bytes, offset)?).map_err(|_| ErrorCode::InvalidLength)?;
    if prior_tensor_index.is_some_and(|prior| tensor_index <= prior) {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let model_tensor = tensors
        .get(tensor_index)
        .ok_or(ErrorCode::InvalidTensorDirectory)?;
    let factor_rank =
        usize::try_from(read_u32(bytes, offset + 4)?).map_err(|_| ErrorCode::InvalidLength)?;
    let rows =
        usize::try_from(read_u32(bytes, offset + 8)?).map_err(|_| ErrorCode::InvalidLength)?;
    let cols =
        usize::try_from(read_u32(bytes, offset + 12)?).map_err(|_| ErrorCode::InvalidLength)?;
    if rows == 0
        || cols == 0
        || factor_rank == 0
        || factor_rank > MAX_FACTOR_RANK
        || factor_rank > rows
        || factor_rank > cols
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let tensor_name_hash = read_u64(bytes, offset + 16)?;
    let source_dtype = read_u32(bytes, offset + 24)?;
    let source_block_size = read_u32(bytes, offset + 28)?;
    if tensor_name_hash != model_tensor.name_hash
        || source_dtype != model_tensor.dtype
        || source_block_size != model_tensor.block_size
        || read_u32(bytes, offset + 32)? != 2
        || read_u32(bytes, offset + 36)? != rows as u32
        || read_u32(bytes, offset + 40)? != cols as u32
        || read_u32(bytes, offset + 44)? != 0
        || read_u32(bytes, offset + 48)? != 0
        || model_tensor.rank != 2
        || model_tensor.dim0 != rows as u32
        || model_tensor.dim1 != cols as u32
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    validate_source_block_size(source_dtype, source_block_size, cols)?;
    let scale = read_f32(bytes, offset + 52)?;
    if !scale.is_finite() || scale == 0.0 {
        return Err(ErrorCode::InvalidHeader);
    }

    let output_count = factor_rank
        .checked_mul(rows)
        .ok_or(ErrorCode::InvalidLength)?;
    let input_count = factor_rank
        .checked_mul(cols)
        .ok_or(ErrorCode::InvalidLength)?;
    let output_bytes = output_count
        .checked_mul(4)
        .ok_or(ErrorCode::InvalidLength)?;
    let input_bytes = input_count.checked_mul(4).ok_or(ErrorCode::InvalidLength)?;
    let output_offset = read_usize_u64(bytes, offset + 56)?;
    let declared_output_bytes = read_usize_u64(bytes, offset + 64)?;
    let input_offset = read_usize_u64(bytes, offset + 72)?;
    let declared_input_bytes = read_usize_u64(bytes, offset + 80)?;
    if output_offset != expected_output_offset
        || declared_output_bytes != output_bytes
        || input_offset
            != output_offset
                .checked_add(output_bytes)
                .ok_or(ErrorCode::InvalidLength)?
        || declared_input_bytes != input_bytes
    {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    require_zero(bytes, prior_factor_end, output_offset)?;
    let factor_end = input_offset
        .checked_add(input_bytes)
        .ok_or(ErrorCode::InvalidLength)?;
    let factor_bytes = bytes
        .get(output_offset..factor_end)
        .ok_or(ErrorCode::InvalidTensorDirectory)?;
    let expected_factor_sha256 = read_digest(bytes, offset + 88)?;
    require_digest(expected_factor_sha256)?;
    if sha256_bytes(factor_bytes)? != expected_factor_sha256 {
        return Err(ErrorCode::InvalidHeader);
    }
    require_zero(bytes, offset + 120, offset + ENTRY_BYTES)?;

    let output_factors = decode_f32(bytes, output_offset, output_count)?;
    let input_factors = decode_f32(bytes, input_offset, input_count)?;
    validate_rank_components(&output_factors, &input_factors, factor_rank, rows, cols)?;
    Ok(SpecialistOverlayTarget {
        tensor_index,
        rows,
        cols,
        factor_rank,
        scale,
        output_factors,
        input_factors,
    })
}

fn validate_source_block_size(dtype: u32, block_size: u32, cols: usize) -> Result<(), ErrorCode> {
    let block_size = usize::try_from(block_size).map_err(|_| ErrorCode::InvalidLength)?;
    let valid = match dtype {
        DTYPE_F32 => block_size == 0,
        DTYPE_Q8_0 => block_size == cols,
        DTYPE_Q4_0 => {
            block_size > 0 && block_size.is_multiple_of(2) && cols.is_multiple_of(block_size)
        }
        DTYPE_Q5_0 => {
            block_size > 0 && block_size.is_multiple_of(8) && cols.is_multiple_of(block_size)
        }
        _ => return Err(ErrorCode::UnsupportedDType),
    };
    if !valid {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(())
}

fn validate_rank_components(
    output_factors: &[f32],
    input_factors: &[f32],
    factor_rank: usize,
    rows: usize,
    cols: usize,
) -> Result<(), ErrorCode> {
    for component in 0..factor_rank {
        let output = &output_factors[component * rows..(component + 1) * rows];
        let input = &input_factors[component * cols..(component + 1) * cols];
        if !output.iter().any(|value| *value != 0.0) || !input.iter().any(|value| *value != 0.0) {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn decode_f32(bytes: &[u8], offset: usize, count: usize) -> Result<Box<[f32]>, ErrorCode> {
    let byte_count = count.checked_mul(4).ok_or(ErrorCode::InvalidLength)?;
    let end = offset
        .checked_add(byte_count)
        .ok_or(ErrorCode::InvalidLength)?;
    let source = bytes
        .get(offset..end)
        .ok_or(ErrorCode::InvalidTensorDirectory)?;
    let mut values = Vec::new();
    values
        .try_reserve_exact(count)
        .map_err(|_| ErrorCode::InvalidLength)?;
    for encoded in source.chunks_exact(4) {
        let value = f32::from_le_bytes(encoded.try_into().map_err(|_| ErrorCode::InvalidLength)?);
        if !value.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
        values.push(value);
    }
    Ok(values.into_boxed_slice())
}

fn require_digest(digest: Digest32) -> Result<(), ErrorCode> {
    if digest == [0; 32] {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn require_zero(bytes: &[u8], start: usize, end: usize) -> Result<(), ErrorCode> {
    if start > end
        || !bytes
            .get(start..end)
            .ok_or(ErrorCode::InvalidLength)?
            .iter()
            .all(|byte| *byte == 0)
    {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn align_to_64(value: usize) -> Result<usize, ErrorCode> {
    value
        .checked_add(ALIGNMENT - 1)
        .map(|aligned| aligned & !(ALIGNMENT - 1))
        .ok_or(ErrorCode::InvalidLength)
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    Ok(u32::from_le_bytes(
        bytes
            .get(offset..end)
            .ok_or(ErrorCode::InvalidLength)?
            .try_into()
            .map_err(|_| ErrorCode::InvalidLength)?,
    ))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
    Ok(u64::from_le_bytes(
        bytes
            .get(offset..end)
            .ok_or(ErrorCode::InvalidLength)?
            .try_into()
            .map_err(|_| ErrorCode::InvalidLength)?,
    ))
}

fn read_usize_u64(bytes: &[u8], offset: usize) -> Result<usize, ErrorCode> {
    usize::try_from(read_u64(bytes, offset)?).map_err(|_| ErrorCode::InvalidLength)
}

fn read_f32(bytes: &[u8], offset: usize) -> Result<f32, ErrorCode> {
    Ok(f32::from_bits(read_u32(bytes, offset)?))
}

fn read_digest(bytes: &[u8], offset: usize) -> Result<Digest32, ErrorCode> {
    let end = offset.checked_add(32).ok_or(ErrorCode::InvalidLength)?;
    bytes
        .get(offset..end)
        .ok_or(ErrorCode::InvalidLength)?
        .try_into()
        .map_err(|_| ErrorCode::InvalidLength)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content_identity::ExecutionBindings;
    use crate::model::Model;
    use crate::ops::matvec_f32;

    const FROZEN_PACKAGE_SHA256: &str =
        "9e4181606e362b6fc970ed8d6dd1e3325fe7f0a3ce2eb48e5f837380e5b8f07f";
    const FROZEN_FACTOR_SHA256: &str =
        "dbeca01321757007acb3edec02653d6922e40388289c148131696bc7e461feee";

    fn digest(octet: u8) -> Digest32 {
        [octet; 32]
    }

    fn digest_from_hex(value: &str) -> Digest32 {
        assert_eq!(value.len(), 64);
        let mut digest = [0u8; 32];
        for (index, byte) in digest.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16).unwrap();
        }
        digest
    }

    fn frozen_base() -> SpecialistOverlayBase {
        SpecialistOverlayBase::new(
            digest(0x11),
            digest(0x22),
            ExecutionBindings::new(
                digest(0x33),
                digest(0x44),
                digest(0x55),
                digest(0x66),
                digest(0x77),
            )
            .unwrap(),
        )
        .unwrap()
    }

    fn frozen_tensors() -> Vec<TensorEntry> {
        let mut tensors = vec![
            TensorEntry {
                name_hash: 1,
                dtype: DTYPE_F32,
                rank: 2,
                dim0: 1,
                dim1: 1,
                dim2: 0,
                dim3: 0,
                byte_offset: 0,
                byte_length: 4,
                scale_offset: 0,
                block_size: 0,
            };
            8
        ];
        tensors[7] = TensorEntry {
            name_hash: 0x0123_4567_89ab_cdef,
            dtype: DTYPE_F32,
            rank: 2,
            dim0: 3,
            dim1: 8,
            dim2: 0,
            dim3: 0,
            byte_offset: 0,
            byte_length: 96,
            scale_offset: 0,
            block_size: 0,
        };
        tensors
    }

    fn frozen_factors() -> (Vec<f32>, Vec<f32>) {
        (
            vec![1.0, -0.5, 0.25, 0.5, 1.5, -1.0],
            vec![
                0.25, -0.5, 1.0, 0.0, 0.5, -0.25, 2.0, -1.0, -1.0, 0.5, 0.25, 2.0, -0.5, 1.0, -1.5,
                0.25,
            ],
        )
    }

    struct TestPackageTarget<'a> {
        tensor_index: usize,
        tensor: TensorEntry,
        factor_rank: usize,
        scale: f32,
        output_factors: &'a [f32],
        input_factors: &'a [f32],
    }

    fn build_packages(base: SpecialistOverlayBase, targets: &[TestPackageTarget<'_>]) -> Vec<u8> {
        assert!(!targets.is_empty());
        let payload_offset = align_to_64(HEADER_BYTES + targets.len() * ENTRY_BYTES).unwrap();
        let mut next_output_offset = payload_offset;
        for target in targets {
            assert_eq!(
                target.output_factors.len(),
                target.factor_rank * target.tensor.dim0 as usize
            );
            assert_eq!(
                target.input_factors.len(),
                target.factor_rank * target.tensor.dim1 as usize
            );
            next_output_offset = align_to_64(
                next_output_offset
                    + target.output_factors.len() * 4
                    + target.input_factors.len() * 4,
            )
            .unwrap();
        }
        let mut bytes = vec![0u8; next_output_offset];
        bytes[0..4].copy_from_slice(&MAGIC);
        write_u32(&mut bytes, 4, VERSION);
        write_u32(&mut bytes, 8, HEADER_BYTES as u32);
        write_u32(&mut bytes, 16, targets.len() as u32);
        write_u32(&mut bytes, 20, ENTRY_BYTES as u32);
        write_u64(&mut bytes, 24, HEADER_BYTES as u64);
        write_u64(&mut bytes, 32, payload_offset as u64);
        write_u64(&mut bytes, 40, next_output_offset as u64);
        write_u32(&mut bytes, 48, FORMAT_TAG);
        write_u32(&mut bytes, 52, FORMAT_TAG);
        write_u32(&mut bytes, 56, FORMAT_TAG);
        write_u32(&mut bytes, 60, FORMAT_TAG);
        for (index, digest) in base.ordered_digests().iter().enumerate() {
            bytes[64 + index * 32..96 + index * 32].copy_from_slice(digest);
        }

        let mut output_offset = payload_offset;
        for (target_index, target) in targets.iter().enumerate() {
            let output_bytes = target.output_factors.len() * 4;
            let input_bytes = target.input_factors.len() * 4;
            let input_offset = output_offset + output_bytes;
            let factor_end = input_offset + input_bytes;
            let entry = HEADER_BYTES + target_index * ENTRY_BYTES;
            write_u32(&mut bytes, entry, target.tensor_index as u32);
            write_u32(&mut bytes, entry + 4, target.factor_rank as u32);
            write_u32(&mut bytes, entry + 8, target.tensor.dim0);
            write_u32(&mut bytes, entry + 12, target.tensor.dim1);
            write_u64(&mut bytes, entry + 16, target.tensor.name_hash);
            write_u32(&mut bytes, entry + 24, target.tensor.dtype);
            write_u32(&mut bytes, entry + 28, target.tensor.block_size);
            write_u32(&mut bytes, entry + 32, 2);
            write_u32(&mut bytes, entry + 36, target.tensor.dim0);
            write_u32(&mut bytes, entry + 40, target.tensor.dim1);
            write_u32(&mut bytes, entry + 52, target.scale.to_bits());
            write_u64(&mut bytes, entry + 56, output_offset as u64);
            write_u64(&mut bytes, entry + 64, output_bytes as u64);
            write_u64(&mut bytes, entry + 72, input_offset as u64);
            write_u64(&mut bytes, entry + 80, input_bytes as u64);
            for (index, value) in target.output_factors.iter().enumerate() {
                write_u32(&mut bytes, output_offset + index * 4, value.to_bits());
            }
            for (index, value) in target.input_factors.iter().enumerate() {
                write_u32(&mut bytes, input_offset + index * 4, value.to_bits());
            }
            let factor_sha256 = sha256_bytes(&bytes[output_offset..factor_end]).unwrap();
            bytes[entry + 88..entry + 120].copy_from_slice(&factor_sha256);
            output_offset = align_to_64(factor_end).unwrap();
        }
        bytes
    }

    fn build_package(
        base: SpecialistOverlayBase,
        tensor_index: usize,
        tensor: TensorEntry,
        factor_rank: usize,
        scale: f32,
        output_factors: &[f32],
        input_factors: &[f32],
    ) -> Vec<u8> {
        build_packages(
            base,
            &[TestPackageTarget {
                tensor_index,
                tensor,
                factor_rank,
                scale,
                output_factors,
                input_factors,
            }],
        )
    }

    fn frozen_package() -> Vec<u8> {
        let (output, input) = frozen_factors();
        build_package(
            frozen_base(),
            7,
            frozen_tensors()[7],
            2,
            0.5,
            &output,
            &input,
        )
    }

    fn refresh_factor_hash(bytes: &mut [u8]) {
        let output_offset = read_usize_u64(bytes, HEADER_BYTES + 56).unwrap();
        let input_offset = read_usize_u64(bytes, HEADER_BYTES + 72).unwrap();
        let input_bytes = read_usize_u64(bytes, HEADER_BYTES + 80).unwrap();
        let factor_sha256 =
            sha256_bytes(&bytes[output_offset..input_offset + input_bytes]).unwrap();
        bytes[HEADER_BYTES + 88..HEADER_BYTES + 120].copy_from_slice(&factor_sha256);
    }

    fn parse_with_current_hash(
        bytes: &[u8],
        base: SpecialistOverlayBase,
        tensors: &[TensorEntry],
    ) -> Result<SpecialistOverlay, ErrorCode> {
        SpecialistOverlay::parse(bytes, sha256_bytes(bytes)?, base, tensors)
    }

    fn assert_rejected(bytes: &[u8]) {
        assert!(parse_with_current_hash(bytes, frozen_base(), &frozen_tensors()).is_err());
    }

    #[test]
    fn frozen_package_matches_preregistered_hashes_and_direct_math() {
        let bytes = frozen_package();
        assert_eq!(bytes.len(), 576);
        assert_eq!(
            sha256_bytes(&bytes).unwrap(),
            digest_from_hex(FROZEN_PACKAGE_SHA256)
        );
        assert_eq!(
            &bytes[HEADER_BYTES + 88..HEADER_BYTES + 120],
            digest_from_hex(FROZEN_FACTOR_SHA256).as_slice()
        );
        let overlay = SpecialistOverlay::parse(
            &bytes,
            digest_from_hex(FROZEN_PACKAGE_SHA256),
            frozen_base(),
            &frozen_tensors(),
        )
        .unwrap();
        assert_eq!(overlay.target_count(), 1);
        assert_eq!(overlay.maximum_factor_rank(), 2);
        assert_eq!(
            overlay.package_sha256(),
            digest_from_hex(FROZEN_PACKAGE_SHA256)
        );

        let vector = [1.0, 2.0, -1.0, 0.5, -0.5, 1.5, 0.25, -2.0];
        let mut output = [-1.0625, 2.0, 2.625];
        let mut scratch = [0.0; 2];
        overlay
            .validate_apply(7, 3, 8, &vector, &output, &scratch)
            .unwrap();
        overlay
            .add_to_output(7, &vector, &mut output, &mut scratch)
            .unwrap();
        assert_eq!(scratch, [0.125, 1.625]);
        assert_eq!(output, [-0.59375, 3.1875, 1.828125]);
    }

    #[test]
    fn rejects_envelope_binding_and_canonical_layout_mutations() {
        for (offset, value) in [
            (0usize, b'X'),
            (4, 2),
            (8, 0),
            (12, 1),
            (16, 0),
            (20, 0),
            (24, 0),
            (32, 0),
            (40, 0),
            (48, 2),
            (52, 2),
            (56, 2),
            (60, 2),
            (64, 0),
            (96, 0),
            (128, 0),
            (160, 0),
            (192, 0),
            (224, 0),
            (256, 0),
            (288, 1),
        ] {
            let mut bytes = frozen_package();
            bytes[offset] = value;
            assert_rejected(&bytes);
        }
        let mut trailing = frozen_package();
        trailing.push(0);
        assert_rejected(&trailing);
        assert!(SpecialistOverlay::parse(
            &frozen_package(),
            digest(0xaa),
            frozen_base(),
            &frozen_tensors(),
        )
        .is_err());
    }

    #[test]
    fn rejects_target_identity_shape_dtype_and_payload_mutations() {
        for (offset, value) in [
            (HEADER_BYTES, 6u32),
            (HEADER_BYTES + 4, 0),
            (HEADER_BYTES + 8, 0),
            (HEADER_BYTES + 12, 0),
            (HEADER_BYTES + 24, 2),
            (HEADER_BYTES + 28, 8),
            (HEADER_BYTES + 32, 1),
            (HEADER_BYTES + 36, 4),
            (HEADER_BYTES + 40, 4),
            (HEADER_BYTES + 44, 1),
            (HEADER_BYTES + 48, 1),
            (HEADER_BYTES + 52, 0),
            (HEADER_BYTES + 56, 0),
            (HEADER_BYTES + 64, 0),
            (HEADER_BYTES + 72, 0),
            (HEADER_BYTES + 80, 0),
            (HEADER_BYTES + 120, 1),
        ] {
            let mut bytes = frozen_package();
            write_u32(&mut bytes, offset, value);
            assert_rejected(&bytes);
        }
        let mut name = frozen_package();
        write_u64(&mut name, HEADER_BYTES + 16, 0);
        assert_rejected(&name);

        let mut payload = frozen_package();
        payload[448] ^= 1;
        assert_rejected(&payload);

        let mut nonfinite = frozen_package();
        write_u32(&mut nonfinite, 448, f32::NAN.to_bits());
        refresh_factor_hash(&mut nonfinite);
        assert_rejected(&nonfinite);

        let mut empty_component = frozen_package();
        for index in 0..3 {
            write_u32(&mut empty_component, 448 + index * 4, 0);
        }
        refresh_factor_hash(&mut empty_component);
        assert_rejected(&empty_component);

        let mut padding = frozen_package();
        padding[575] = 1;
        assert_rejected(&padding);

        let mut over_rank = frozen_package();
        write_u32(&mut over_rank, HEADER_BYTES + 4, 65);
        assert_rejected(&over_rank);

        let mut over_targets = frozen_package();
        write_u32(&mut over_targets, 16, 257);
        assert_rejected(&over_targets);

        let unsupported_tensor = TensorEntry {
            dtype: 99,
            ..frozen_tensors()[7]
        };
        let (output, input) = frozen_factors();
        let unsupported = build_package(
            frozen_base(),
            7,
            unsupported_tensor,
            2,
            0.5,
            &output,
            &input,
        );
        let mut tensors = frozen_tensors();
        tensors[7] = unsupported_tensor;
        assert_eq!(
            parse_with_current_hash(&unsupported, frozen_base(), &tensors).unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn parses_sorted_multiple_targets_and_rejects_order_or_padding_drift() {
        let tensors = frozen_tensors();
        let (primary_output, primary_input) = frozen_factors();
        let first_output = [0.5f32];
        let first_input = [0.25f32];
        let package = build_packages(
            frozen_base(),
            &[
                TestPackageTarget {
                    tensor_index: 6,
                    tensor: tensors[6],
                    factor_rank: 1,
                    scale: 1.0,
                    output_factors: &first_output,
                    input_factors: &first_input,
                },
                TestPackageTarget {
                    tensor_index: 7,
                    tensor: tensors[7],
                    factor_rank: 2,
                    scale: 0.5,
                    output_factors: &primary_output,
                    input_factors: &primary_input,
                },
            ],
        );
        assert_eq!(package.len(), 768);
        let overlay = parse_with_current_hash(&package, frozen_base(), &tensors).unwrap();
        assert_eq!(overlay.target_count(), 2);
        assert_eq!(overlay.maximum_factor_rank(), 2);

        let mut first_result = [1.0f32];
        let mut scratch = [0.0f32; 2];
        overlay
            .add_to_output(6, &[2.0], &mut first_result, &mut scratch)
            .unwrap();
        assert_eq!(first_result, [1.25]);

        let mut duplicate = package.clone();
        write_u32(&mut duplicate, HEADER_BYTES + ENTRY_BYTES, 6);
        assert!(parse_with_current_hash(&duplicate, frozen_base(), &tensors).is_err());

        let mut noncanonical_offset = package.clone();
        write_u64(
            &mut noncanonical_offset,
            HEADER_BYTES + ENTRY_BYTES + 56,
            641,
        );
        assert!(parse_with_current_hash(&noncanonical_offset, frozen_base(), &tensors).is_err());

        let mut nonzero_padding = package;
        nonzero_padding[600] = 1;
        assert!(parse_with_current_hash(&nonzero_padding, frozen_base(), &tensors).is_err());
    }

    #[test]
    fn model_native_dtypes_match_direct_and_materialized_references_without_drift() {
        for model_bytes in [
            include_bytes!("../../models/tiny-test-model.slm").as_slice(),
            include_bytes!("../../models/tiny-test-model-q8.slm").as_slice(),
            include_bytes!("../../models/tiny-test-model-q5.slm").as_slice(),
            include_bytes!("../../models/tiny-test-model-q4.slm").as_slice(),
        ] {
            let model = Model::load(model_bytes).unwrap();
            let bindings = ExecutionBindings::new(
                digest(0x31),
                digest(0x32),
                digest(0x33),
                digest(0x34),
                digest(0x35),
            )
            .unwrap();
            let base = StandaloneModelIdentity::new(
                model_bytes.len() as u64,
                model.model_sha256(),
                bindings,
            )
            .unwrap();
            let tensor_index = model.layer_indices(0).unwrap().wq;
            let tensor = model.parsed().tensors[tensor_index];
            let rows = tensor.dim0 as usize;
            let cols = tensor.dim1 as usize;
            let rank = 2usize;
            let output_factors = (0..rank * rows)
                .map(|index| {
                    if index < rows {
                        0.25
                    } else if index.is_multiple_of(2) {
                        0.125
                    } else {
                        -0.125
                    }
                })
                .collect::<Vec<_>>();
            let input_factors = (0..rank * cols)
                .map(|index| {
                    if index < cols {
                        0.0625
                    } else if index.is_multiple_of(2) {
                        0.03125
                    } else {
                        -0.03125
                    }
                })
                .collect::<Vec<_>>();
            let vector = (0..cols)
                .map(|index| match index % 4 {
                    0 => 1.0,
                    1 => -0.5,
                    2 => 0.25,
                    _ => -0.25,
                })
                .collect::<Vec<_>>();
            let package = build_package(
                SpecialistOverlayBase::from_identity(&base),
                tensor_index,
                tensor,
                rank,
                0.5,
                &output_factors,
                &input_factors,
            );
            let package_sha256 = sha256_bytes(&package).unwrap();
            let overlay = model
                .parse_specialist_overlay(&package, package_sha256, &base)
                .unwrap_or_else(|error| panic!("overlay parse failed for {tensor:?}: {error:?}"));

            let mut base_output = vec![0.0; rows];
            model
                .matvec_by_index(tensor_index, rows, cols, &vector, &mut base_output)
                .unwrap();
            let mut expected_direct = base_output.clone();
            let mut expected_scratch = vec![0.0f32; rank];
            for component in 0..rank {
                let mut sum = 0.0f32;
                for col in 0..cols {
                    sum += input_factors[component * cols + col] * vector[col];
                }
                expected_scratch[component] = sum;
            }
            for row in 0..rows {
                let mut delta = 0.0f32;
                for component in 0..rank {
                    delta += output_factors[component * rows + row] * expected_scratch[component];
                }
                expected_direct[row] += 0.5 * delta;
            }

            let mut direct = vec![0.0; rows];
            let mut scratch = vec![0.0; rank];
            model
                .matvec_with_specialist_overlay(
                    &overlay,
                    SpecialistMatvec {
                        tensor_index,
                        rows,
                        cols,
                        vector: &vector,
                        output: &mut direct,
                        scratch: &mut scratch,
                    },
                )
                .unwrap();
            assert_eq!(direct, expected_direct);

            let mut materialized = vec![0.0; rows * cols];
            model
                .copy_tensor_f32_by_index(tensor_index, &mut materialized)
                .unwrap();
            for row in 0..rows {
                for col in 0..cols {
                    let mut delta = 0.0f32;
                    for component in 0..rank {
                        delta += output_factors[component * rows + row]
                            * input_factors[component * cols + col];
                    }
                    materialized[row * cols + col] += 0.5 * delta;
                }
            }
            let mut materialized_output = vec![0.0; rows];
            matvec_f32(&materialized, rows, cols, &vector, &mut materialized_output).unwrap();
            for (direct_value, materialized_value) in direct.iter().zip(&materialized_output) {
                assert!((direct_value - materialized_value).abs() <= 0.000_02);
            }

            for _ in 0..100 {
                let mut returned_base = vec![0.0; rows];
                model
                    .matvec_by_index(tensor_index, rows, cols, &vector, &mut returned_base)
                    .unwrap();
                assert_eq!(
                    returned_base
                        .iter()
                        .map(|value| value.to_bits())
                        .collect::<Vec<_>>(),
                    base_output
                        .iter()
                        .map(|value| value.to_bits())
                        .collect::<Vec<_>>()
                );
                let mut switched = vec![0.0; rows];
                model
                    .matvec_with_specialist_overlay(
                        &overlay,
                        SpecialistMatvec {
                            tensor_index,
                            rows,
                            cols,
                            vector: &vector,
                            output: &mut switched,
                            scratch: &mut scratch,
                        },
                    )
                    .unwrap();
                assert_eq!(switched, direct);
            }

            let mut unchanged = vec![123.0; rows];
            let mut short_scratch = vec![0.0; rank - 1];
            assert_eq!(
                model.matvec_with_specialist_overlay(
                    &overlay,
                    SpecialistMatvec {
                        tensor_index,
                        rows,
                        cols,
                        vector: &vector,
                        output: &mut unchanged,
                        scratch: &mut short_scratch,
                    },
                ),
                Err(ErrorCode::ShapeMismatch)
            );
            assert_eq!(unchanged, vec![123.0; rows]);
        }
    }

    fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
        bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn write_u64(bytes: &mut [u8], offset: usize, value: u64) {
        bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    }
}
