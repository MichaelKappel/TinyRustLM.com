//! Runtime parser for adapter-delta packages.

use crate::errors::ErrorCode;
use crate::model_format::TensorEntry;

const RAW_MAGIC: &[u8; 4] = b"ADP1";
const SPARSE_MAGIC: &[u8; 4] = b"ASP1";
const LOW_RANK_MAGIC: &[u8; 4] = b"ALR1";
const VERSION: u32 = 1;
const HEADER_LEN: usize = 64;
const ENTRY_LEN: usize = 64;
const CHECKSUM_OFFSET: usize = 56;
const SPARSE_PAIR_LEN: usize = 12;
const LOW_RANK_HEADER_LEN: usize = 16;
const LOW_RANK_MAX_COMPONENTS: usize = 8;

/// Identity values the adapter package must match before it can be applied.
pub(crate) struct AdapterExpected<'a> {
    pub(crate) flags: u32,
    pub(crate) tensors: &'a [TensorEntry],
    pub(crate) parameter_count: u64,
    pub(crate) tensor_layout_checksum: u64,
    pub(crate) tokenizer_checksum: u64,
}

/// Validated adapter payload ranges, aligned to the model tensor directory order.
pub(crate) struct AdapterDelta {
    entries: Vec<AdapterDeltaEntry>,
}

struct AdapterDeltaEntry {
    byte_offset: usize,
    element_count: usize,
    kind: AdapterDeltaPayloadKind,
}

impl AdapterDelta {
    /// Parses and validates an adapter package for a loaded model identity.
    pub(crate) fn parse(bytes: &[u8], expected: &AdapterExpected<'_>) -> Result<Self, ErrorCode> {
        let format = validate_adapter_bytes(bytes)?;
        let tensor_count = read_u32(bytes, 12)? as usize;
        if tensor_count != expected.tensors.len() {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u32(bytes, 16)? != expected.flags {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u64(bytes, 24)? != expected.parameter_count {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u64(bytes, 32)? != expected.tensor_layout_checksum {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u64(bytes, 40)? != expected.tokenizer_checksum {
            return Err(ErrorCode::ShapeMismatch);
        }

        let data_offset = usize_from_u64(read_u64(bytes, 48)?)?;
        let mut entries = Vec::with_capacity(tensor_count);
        for (index, tensor) in expected.tensors.iter().enumerate() {
            let entry_offset = HEADER_LEN + index * ENTRY_LEN;
            validate_entry_identity(bytes, entry_offset, tensor, data_offset)?;
            let byte_offset = usize_from_u64(read_u64(bytes, entry_offset + 32)?)?;
            let byte_length = usize_from_u64(read_u64(bytes, entry_offset + 40)?)?;
            let element_count = usize_from_u64(read_u64(bytes, entry_offset + 48)?)?;
            let kind = match format {
                AdapterPackageFormat::RawF32 => {
                    validate_finite_payload(bytes, byte_offset, element_count)?;
                    AdapterDeltaPayloadKind::RawF32
                }
                AdapterPackageFormat::SparseF32 => {
                    let pair_count =
                        validate_sparse_payload(bytes, byte_offset, byte_length, element_count)?;
                    AdapterDeltaPayloadKind::SparseF32 { pair_count }
                }
                AdapterPackageFormat::LowRankF32 => {
                    let (factor_rank, rows, cols) =
                        low_rank_payload_shape(bytes, byte_offset, byte_length, element_count)?;
                    AdapterDeltaPayloadKind::LowRankF32 {
                        factor_rank,
                        rows,
                        cols,
                    }
                }
            };
            entries.push(AdapterDeltaEntry {
                byte_offset,
                element_count,
                kind,
            });
        }
        Ok(Self { entries })
    }

    pub(crate) fn entries(&self) -> impl Iterator<Item = AdapterDeltaPayload> + '_ {
        self.entries.iter().map(|entry| AdapterDeltaPayload {
            byte_offset: entry.byte_offset,
            element_count: entry.element_count,
            kind: entry.kind,
        })
    }
}

/// The storage layout for one validated adapter payload.
#[derive(Clone, Copy)]
pub(crate) enum AdapterDeltaPayloadKind {
    /// Dense f32 deltas, one value for each tensor element.
    RawF32,
    /// Sparse f32 deltas, stored as sorted `(u64 index, f32 delta)` pairs.
    SparseF32 {
        /// Number of sparse pairs in the payload.
        pair_count: usize,
    },
    /// Low-rank f32 matrix deltas, stored as component-major `A` and `B` factors.
    LowRankF32 {
        /// Number of outer-product components.
        factor_rank: usize,
        /// Matrix row count represented by the factors.
        rows: usize,
        /// Matrix column count represented by the factors.
        cols: usize,
    },
}

/// One validated adapter payload.
#[derive(Clone, Copy)]
pub(crate) struct AdapterDeltaPayload {
    pub(crate) byte_offset: usize,
    pub(crate) element_count: usize,
    pub(crate) kind: AdapterDeltaPayloadKind,
}

/// Computes the checksum used by packer reports for tokenizer sections.
pub(crate) fn section_checksum(bytes: &[u8], seed: u64) -> u64 {
    let mut acc = seed;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 2);
        acc = acc.rotate_left(9).wrapping_mul(0x100000001b3);
    }
    acc
}

/// Computes the checksum used by packer reports for tensor layout identity.
pub(crate) fn tensor_layout_checksum(tensors: &[TensorEntry]) -> u64 {
    let mut sorted = tensors.iter().collect::<Vec<_>>();
    sorted.sort_by_key(|tensor| tensor.name_hash);
    let mut acc = 0x74656e736f722d6cu64;
    for tensor in sorted {
        mix_u64(&mut acc, tensor.name_hash);
        mix_u64(&mut acc, u64::from(tensor.dtype));
        mix_u64(&mut acc, u64::from(tensor.rank));
        for dim in [tensor.dim0, tensor.dim1, tensor.dim2, tensor.dim3] {
            mix_u64(&mut acc, u64::from(dim));
        }
        mix_u64(&mut acc, u64::from(tensor.block_size));
        mix_u64(&mut acc, tensor.byte_length);
    }
    acc
}

pub(crate) fn parameter_count(tensors: &[TensorEntry]) -> Result<u64, ErrorCode> {
    tensors.iter().try_fold(0u64, |acc, tensor| {
        acc.checked_add(tensor_element_count(tensor)? as u64)
            .ok_or(ErrorCode::InvalidLength)
    })
}

pub(crate) fn read_f32(bytes: &[u8], offset: usize) -> Result<f32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(f32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

/// Reads one sparse `(value_index, delta)` pair from a validated sparse payload.
pub(crate) fn read_sparse_delta_pair(
    bytes: &[u8],
    payload: AdapterDeltaPayload,
    pair_index: usize,
) -> Result<(usize, f32), ErrorCode> {
    let AdapterDeltaPayloadKind::SparseF32 { pair_count } = payload.kind else {
        return Err(ErrorCode::ShapeMismatch);
    };
    if pair_index >= pair_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    let offset = payload
        .byte_offset
        .checked_add(
            pair_index
                .checked_mul(SPARSE_PAIR_LEN)
                .ok_or(ErrorCode::InvalidLength)?,
        )
        .ok_or(ErrorCode::InvalidLength)?;
    let value_index = usize_from_u64(read_u64(bytes, offset)?)?;
    let delta = read_f32(bytes, offset + 8)?;
    Ok((value_index, delta))
}

/// Reconstructs one value from a validated low-rank payload.
pub(crate) fn read_low_rank_delta_value(
    bytes: &[u8],
    payload: AdapterDeltaPayload,
    value_index: usize,
) -> Result<f32, ErrorCode> {
    let AdapterDeltaPayloadKind::LowRankF32 {
        factor_rank,
        rows,
        cols,
    } = payload.kind
    else {
        return Err(ErrorCode::ShapeMismatch);
    };
    if factor_rank == 0 {
        return Ok(0.0);
    }
    if value_index >= payload.element_count || rows == 0 || cols == 0 {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row = value_index / cols;
    let col = value_index % cols;
    if row >= rows {
        return Err(ErrorCode::ShapeMismatch);
    }
    let a_offset = payload
        .byte_offset
        .checked_add(LOW_RANK_HEADER_LEN)
        .ok_or(ErrorCode::InvalidLength)?;
    let b_offset = a_offset
        .checked_add(
            factor_rank
                .checked_mul(rows)
                .and_then(|value| value.checked_mul(4))
                .ok_or(ErrorCode::InvalidLength)?,
        )
        .ok_or(ErrorCode::InvalidLength)?;
    let mut delta = 0.0f32;
    for component in 0..factor_rank {
        let a_index = component
            .checked_mul(rows)
            .and_then(|value| value.checked_add(row))
            .ok_or(ErrorCode::InvalidLength)?;
        let b_index = component
            .checked_mul(cols)
            .and_then(|value| value.checked_add(col))
            .ok_or(ErrorCode::InvalidLength)?;
        let a = read_f32(
            bytes,
            a_offset
                .checked_add(a_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
                .ok_or(ErrorCode::InvalidLength)?,
        )?;
        let b = read_f32(
            bytes,
            b_offset
                .checked_add(b_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
                .ok_or(ErrorCode::InvalidLength)?,
        )?;
        delta += a * b;
    }
    if !delta.is_finite() {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(delta)
}

fn validate_adapter_bytes(bytes: &[u8]) -> Result<AdapterPackageFormat, ErrorCode> {
    let format = adapter_format(bytes)?;
    if read_u32(bytes, 4)? != VERSION {
        return Err(ErrorCode::UnsupportedModelVersion);
    }
    if read_u32(bytes, 8)? as usize != HEADER_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    let tensor_count = read_u32(bytes, 12)? as usize;
    if read_u32(bytes, 20)? as usize != ENTRY_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    let data_offset = usize_from_u64(read_u64(bytes, 48)?)?;
    let directory_end = HEADER_LEN
        .checked_add(
            tensor_count
                .checked_mul(ENTRY_LEN)
                .ok_or(ErrorCode::InvalidLength)?,
        )
        .ok_or(ErrorCode::InvalidLength)?;
    if data_offset < directory_end || !data_offset.is_multiple_of(64) || data_offset > bytes.len() {
        return Err(ErrorCode::InvalidHeader);
    }
    if read_u64(bytes, CHECKSUM_OFFSET)? != adapter_checksum(bytes)? {
        return Err(ErrorCode::InvalidHeader);
    }
    for index in 0..tensor_count {
        let entry_offset = HEADER_LEN + index * ENTRY_LEN;
        let byte_offset = usize_from_u64(read_u64(bytes, entry_offset + 32)?)?;
        let byte_length = usize_from_u64(read_u64(bytes, entry_offset + 40)?)?;
        let element_count = usize_from_u64(read_u64(bytes, entry_offset + 48)?)?;
        match format {
            AdapterPackageFormat::RawF32 => {
                let expected_byte_length = element_count
                    .checked_mul(4)
                    .ok_or(ErrorCode::InvalidLength)?;
                if byte_length != expected_byte_length {
                    return Err(ErrorCode::ShapeMismatch);
                }
            }
            AdapterPackageFormat::SparseF32 => {
                if !byte_length.is_multiple_of(SPARSE_PAIR_LEN)
                    || byte_length / SPARSE_PAIR_LEN > element_count
                {
                    return Err(ErrorCode::ShapeMismatch);
                }
            }
            AdapterPackageFormat::LowRankF32 => {
                low_rank_payload_shape(bytes, byte_offset, byte_length, element_count)?;
            }
        }
        let end = byte_offset
            .checked_add(byte_length)
            .ok_or(ErrorCode::InvalidLength)?;
        let payload = bytes
            .get(byte_offset..end)
            .ok_or(ErrorCode::InvalidHeader)?;
        if read_u64(bytes, entry_offset + 56)? != payload_checksum(payload) {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(format)
}

#[derive(Clone, Copy)]
enum AdapterPackageFormat {
    RawF32,
    SparseF32,
    LowRankF32,
}

fn adapter_format(bytes: &[u8]) -> Result<AdapterPackageFormat, ErrorCode> {
    match bytes.get(0..4) {
        Some(magic) if magic == RAW_MAGIC => Ok(AdapterPackageFormat::RawF32),
        Some(magic) if magic == SPARSE_MAGIC => Ok(AdapterPackageFormat::SparseF32),
        Some(magic) if magic == LOW_RANK_MAGIC => Ok(AdapterPackageFormat::LowRankF32),
        _ => Err(ErrorCode::InvalidHeader),
    }
}

fn validate_entry_identity(
    bytes: &[u8],
    entry_offset: usize,
    tensor: &TensorEntry,
    data_offset: usize,
) -> Result<(), ErrorCode> {
    if read_u64(bytes, entry_offset)? != tensor.name_hash {
        return Err(ErrorCode::ShapeMismatch);
    }
    if read_u32(bytes, entry_offset + 8)? != tensor.rank {
        return Err(ErrorCode::ShapeMismatch);
    }
    for (dim_index, expected) in [tensor.dim0, tensor.dim1, tensor.dim2, tensor.dim3]
        .iter()
        .enumerate()
    {
        if read_u32(bytes, entry_offset + 12 + dim_index * 4)? != *expected {
            return Err(ErrorCode::ShapeMismatch);
        }
    }
    if read_u32(bytes, entry_offset + 28)? != 0 {
        return Err(ErrorCode::InvalidHeader);
    }
    let byte_offset = usize_from_u64(read_u64(bytes, entry_offset + 32)?)?;
    if byte_offset < data_offset || !byte_offset.is_multiple_of(64) {
        return Err(ErrorCode::InvalidHeader);
    }
    let element_count = read_u64(bytes, entry_offset + 48)?;
    if element_count != tensor_element_count(tensor)? as u64 {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(())
}

fn validate_finite_payload(
    bytes: &[u8],
    byte_offset: usize,
    element_count: usize,
) -> Result<(), ErrorCode> {
    for value_index in 0..element_count {
        let offset = byte_offset
            .checked_add(value_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
            .ok_or(ErrorCode::InvalidLength)?;
        if !read_f32(bytes, offset)?.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn validate_sparse_payload(
    bytes: &[u8],
    byte_offset: usize,
    byte_length: usize,
    element_count: usize,
) -> Result<usize, ErrorCode> {
    let pair_count = byte_length / SPARSE_PAIR_LEN;
    let mut previous_index = None;
    for pair_index in 0..pair_count {
        let offset = byte_offset
            .checked_add(
                pair_index
                    .checked_mul(SPARSE_PAIR_LEN)
                    .ok_or(ErrorCode::InvalidLength)?,
            )
            .ok_or(ErrorCode::InvalidLength)?;
        let value_index = usize_from_u64(read_u64(bytes, offset)?)?;
        if value_index >= element_count
            || previous_index.is_some_and(|previous| value_index <= previous)
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        let delta = read_f32(bytes, offset + 8)?;
        if !delta.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
        previous_index = Some(value_index);
    }
    Ok(pair_count)
}

fn low_rank_payload_shape(
    bytes: &[u8],
    byte_offset: usize,
    byte_length: usize,
    element_count: usize,
) -> Result<(usize, usize, usize), ErrorCode> {
    if byte_length == 0 {
        return Ok((0, 0, 0));
    }
    if byte_length < LOW_RANK_HEADER_LEN {
        return Err(ErrorCode::ShapeMismatch);
    }
    let rows = usize_from_u64(u64::from(read_u32(bytes, byte_offset)?))?;
    let cols = usize_from_u64(u64::from(read_u32(bytes, byte_offset + 4)?))?;
    let factor_rank = usize_from_u64(u64::from(read_u32(bytes, byte_offset + 8)?))?;
    if read_u32(bytes, byte_offset + 12)? != 0
        || rows == 0
        || cols == 0
        || factor_rank == 0
        || factor_rank > LOW_RANK_MAX_COMPONENTS
        || factor_rank > rows.min(cols)
        || rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)? != element_count
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let factor_values = factor_rank
        .checked_mul(rows.checked_add(cols).ok_or(ErrorCode::InvalidLength)?)
        .ok_or(ErrorCode::InvalidLength)?;
    let expected_len = LOW_RANK_HEADER_LEN
        .checked_add(
            factor_values
                .checked_mul(4)
                .ok_or(ErrorCode::InvalidLength)?,
        )
        .ok_or(ErrorCode::InvalidLength)?;
    if byte_length != expected_len {
        return Err(ErrorCode::ShapeMismatch);
    }
    for value_index in 0..factor_values {
        let offset = byte_offset
            .checked_add(
                LOW_RANK_HEADER_LEN
                    .checked_add(value_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
                    .ok_or(ErrorCode::InvalidLength)?,
            )
            .ok_or(ErrorCode::InvalidLength)?;
        if !read_f32(bytes, offset)?.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok((factor_rank, rows, cols))
}

fn adapter_checksum(bytes: &[u8]) -> Result<u64, ErrorCode> {
    if bytes.len() < HEADER_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    let mut acc = 0x6164617074657231u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (CHECKSUM_OFFSET..CHECKSUM_OFFSET + 8).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 3);
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    Ok(acc)
}

fn payload_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x64656c7461663332u64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn tensor_element_count(entry: &TensorEntry) -> Result<usize, ErrorCode> {
    let mut total = 1usize;
    for dim in [entry.dim0, entry.dim1, entry.dim2, entry.dim3]
        .into_iter()
        .take(entry.rank as usize)
    {
        if dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        total = total
            .checked_mul(dim as usize)
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok(total)
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u64::from_le_bytes([
        slice[0], slice[1], slice[2], slice[3], slice[4], slice[5], slice[6], slice[7],
    ]))
}

fn usize_from_u64(value: u64) -> Result<usize, ErrorCode> {
    usize::try_from(value).map_err(|_| ErrorCode::InvalidLength)
}

fn mix_u64(acc: &mut u64, value: u64) {
    for byte in value.to_le_bytes() {
        *acc ^= u64::from(byte);
        *acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
}
