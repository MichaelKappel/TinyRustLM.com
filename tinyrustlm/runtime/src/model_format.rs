//! Parser for the custom `.slm` binary format.

use crate::errors::ErrorCode;
use std::convert::TryInto;

/// Supported `.slm` file magic.
pub const SLM_MAGIC: [u8; 4] = *b"SLM1";
/// Supported `.slm` version.
pub const SLM_VERSION: u32 = 1;
/// Minimum header length for version 1.
pub const HEADER_LEN: usize = 108;
/// Tensor directory entry length including reserved padding.
pub const TENSOR_ENTRY_LEN: usize = 64;

/// Float32 tensor dtype.
pub const DTYPE_F32: u32 = 1;
/// Q8_0 tensor dtype.
pub const DTYPE_Q8_0: u32 = 2;
/// Q4_0 tensor dtype.
pub const DTYPE_Q4_0: u32 = 3;
/// Q5_0 tensor dtype using LSB-first signed five-bit codes and f32 block scales.
pub const DTYPE_Q5_0: u32 = 4;

const MODEL_TYPE_TRANSFORMER: u32 = 1;

/// Parsed `.slm` header.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SlmHeader {
    /// Explicit format version.
    pub version: u32,
    /// Header length in bytes.
    pub header_length: u32,
    /// Model type identifier.
    pub model_type: u32,
    /// Format flags.
    pub flags: u32,
    /// Token vocabulary size.
    pub vocab_size: u32,
    /// Special token count.
    pub special_token_count: u32,
    /// Transformer hidden size.
    pub hidden_size: u32,
    /// Transformer layer count.
    pub layer_count: u32,
    /// Attention head count.
    pub head_count: u32,
    /// Key/value head count.
    pub kv_head_count: u32,
    /// Per-head dimension.
    pub head_dim: u32,
    /// Feed-forward intermediate size.
    pub ffn_size: u32,
    /// Maximum context length.
    pub max_context: u32,
    /// RoPE theta value.
    pub rope_theta: f32,
    /// RMSNorm epsilon.
    pub rms_norm_epsilon: f32,
    /// Tokenizer section offset.
    pub tokenizer_offset: u64,
    /// Tokenizer section length.
    pub tokenizer_length: u64,
    /// Tensor directory offset.
    pub tensor_directory_offset: u64,
    /// Tensor count.
    pub tensor_count: u32,
    /// Tensor data section offset.
    pub tensor_data_offset: u64,
    /// Simple custom checksum.
    pub checksum: u64,
}

/// Parsed tensor directory entry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TensorEntry {
    /// Stable hash of the tensor name.
    pub name_hash: u64,
    /// Tensor dtype.
    pub dtype: u32,
    /// Tensor rank.
    pub rank: u32,
    /// Dimension 0.
    pub dim0: u32,
    /// Dimension 1.
    pub dim1: u32,
    /// Dimension 2.
    pub dim2: u32,
    /// Dimension 3.
    pub dim3: u32,
    /// Byte offset relative to the file start.
    pub byte_offset: u64,
    /// Tensor byte length.
    pub byte_length: u64,
    /// Quantization scale offset when quantized.
    pub scale_offset: u64,
    /// Quantization block size when quantized.
    pub block_size: u32,
}

/// Parsed `.slm` view.
#[derive(Debug)]
pub struct ParsedSlm {
    /// Parsed header.
    pub header: SlmHeader,
    /// Parsed tensor directory entries.
    pub tensors: Vec<TensorEntry>,
}

/// Parses and validates an `.slm` byte slice.
pub fn parse_slm(bytes: &[u8]) -> Result<ParsedSlm, ErrorCode> {
    if bytes.len() < HEADER_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    if bytes[0..4] != SLM_MAGIC {
        return Err(ErrorCode::InvalidModelMagic);
    }

    let header = SlmHeader {
        version: read_u32(bytes, 4)?,
        header_length: read_u32(bytes, 8)?,
        model_type: read_u32(bytes, 12)?,
        flags: read_u32(bytes, 16)?,
        vocab_size: read_u32(bytes, 20)?,
        special_token_count: read_u32(bytes, 24)?,
        hidden_size: read_u32(bytes, 28)?,
        layer_count: read_u32(bytes, 32)?,
        head_count: read_u32(bytes, 36)?,
        kv_head_count: read_u32(bytes, 40)?,
        head_dim: read_u32(bytes, 44)?,
        ffn_size: read_u32(bytes, 48)?,
        max_context: read_u32(bytes, 52)?,
        rope_theta: f32::from_bits(read_u32(bytes, 56)?),
        rms_norm_epsilon: f32::from_bits(read_u32(bytes, 60)?),
        tokenizer_offset: read_u64(bytes, 64)?,
        tokenizer_length: read_u64(bytes, 72)?,
        tensor_directory_offset: read_u64(bytes, 80)?,
        tensor_count: read_u32(bytes, 88)?,
        tensor_data_offset: read_u64(bytes, 92)?,
        checksum: read_u64(bytes, 100)?,
    };

    validate_header(&header, bytes.len())?;
    validate_checksum(bytes, &header)?;
    let tensors = parse_tensor_directory(bytes, &header)?;
    validate_tensor_ranges(bytes.len(), &tensors)?;
    Ok(ParsedSlm { header, tensors })
}

/// Computes the stable FNV-1a hash used for tensor names.
pub fn name_hash(name: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in name.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Computes a simple checksum over model bytes.
pub fn simple_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x9e3779b97f4a7c15u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (100..108).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn validate_header(header: &SlmHeader, file_len: usize) -> Result<(), ErrorCode> {
    if header.version != SLM_VERSION {
        return Err(ErrorCode::UnsupportedModelVersion);
    }
    if header.checksum == 0 {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.header_length < HEADER_LEN as u32 || header.header_length as usize > file_len {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.model_type != MODEL_TYPE_TRANSFORMER {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.vocab_size < header.special_token_count || header.special_token_count < 4 {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.hidden_size == 0
        || header.layer_count == 0
        || header.head_count == 0
        || header.kv_head_count == 0
        || header.head_dim == 0
        || header.ffn_size == 0
        || header.max_context == 0
    {
        return Err(ErrorCode::InvalidHeader);
    }
    header
        .head_count
        .checked_mul(header.head_dim)
        .ok_or(ErrorCode::InvalidLength)?;
    if header.kv_head_count > header.head_count
        || !header.head_count.is_multiple_of(header.kv_head_count)
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    if !header.rope_theta.is_finite() || header.rope_theta <= 0.0 {
        return Err(ErrorCode::InvalidHeader);
    }
    if !header.rms_norm_epsilon.is_finite() || header.rms_norm_epsilon <= 0.0 {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.tokenizer_offset < u64::from(header.header_length) {
        return Err(ErrorCode::InvalidHeader);
    }
    if !header
        .tensor_directory_offset
        .is_multiple_of(TENSOR_ENTRY_LEN as u64)
        || !header
            .tensor_data_offset
            .is_multiple_of(TENSOR_ENTRY_LEN as u64)
    {
        return Err(ErrorCode::InvalidHeader);
    }
    if !range_within(file_len, header.tokenizer_offset, header.tokenizer_length) {
        return Err(ErrorCode::InvalidHeader);
    }
    let directory_len = u64::from(header.tensor_count)
        .checked_mul(TENSOR_ENTRY_LEN as u64)
        .ok_or(ErrorCode::InvalidTensorDirectory)?;
    let directory_end = header
        .tensor_directory_offset
        .checked_add(directory_len)
        .ok_or(ErrorCode::InvalidTensorDirectory)?;
    if !range_within(file_len, header.tensor_directory_offset, directory_len) {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    if header.tensor_data_offset < directory_end || header.tensor_data_offset > file_len as u64 {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn validate_checksum(bytes: &[u8], header: &SlmHeader) -> Result<(), ErrorCode> {
    if header.checksum != simple_checksum(bytes) {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn parse_tensor_directory(bytes: &[u8], header: &SlmHeader) -> Result<Vec<TensorEntry>, ErrorCode> {
    let mut tensors = Vec::with_capacity(header.tensor_count as usize);
    let start = usize_from_u64(header.tensor_directory_offset)?;
    for index in 0..header.tensor_count as usize {
        let base = start + index * TENSOR_ENTRY_LEN;
        let entry = TensorEntry {
            name_hash: read_u64(bytes, base)?,
            dtype: read_u32(bytes, base + 8)?,
            rank: read_u32(bytes, base + 12)?,
            dim0: read_u32(bytes, base + 16)?,
            dim1: read_u32(bytes, base + 20)?,
            dim2: read_u32(bytes, base + 24)?,
            dim3: read_u32(bytes, base + 28)?,
            byte_offset: read_u64(bytes, base + 32)?,
            byte_length: read_u64(bytes, base + 40)?,
            scale_offset: read_u64(bytes, base + 48)?,
            block_size: read_u32(bytes, base + 56)?,
        };
        validate_tensor_entry(bytes.len(), &entry)?;
        tensors.push(entry);
    }
    Ok(tensors)
}

fn validate_tensor_ranges(file_len: usize, tensors: &[TensorEntry]) -> Result<(), ErrorCode> {
    for tensor in tensors {
        validate_tensor_entry(file_len, tensor)?;
    }
    Ok(())
}

fn validate_tensor_entry(file_len: usize, tensor: &TensorEntry) -> Result<(), ErrorCode> {
    if tensor.rank == 0 || tensor.rank > 4 {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    if !matches!(
        tensor.dtype,
        DTYPE_F32 | DTYPE_Q8_0 | DTYPE_Q4_0 | DTYPE_Q5_0
    ) {
        return Err(ErrorCode::UnsupportedDType);
    }
    for dim in tensor_dims(tensor).iter().copied() {
        if dim == 0 {
            return Err(ErrorCode::InvalidTensorDirectory);
        }
    }
    if !tensor.byte_offset.is_multiple_of(TENSOR_ENTRY_LEN as u64) {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    if !range_within(file_len, tensor.byte_offset, tensor.byte_length) {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    if tensor.byte_length != expected_tensor_payload_len(tensor)? {
        return Err(ErrorCode::InvalidTensorDirectory);
    }

    match tensor.dtype {
        DTYPE_F32 => {
            if tensor.scale_offset != 0 || tensor.block_size != 0 {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
        }
        DTYPE_Q8_0 => {
            if tensor.scale_offset == 0 {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            let (rows, cols) = tensor_matrix_shape(tensor)?;
            if tensor.block_size != cols as u32 {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            validate_scale_range(file_len, tensor.scale_offset, rows)?;
        }
        DTYPE_Q4_0 => {
            if tensor.scale_offset == 0 || tensor.block_size == 0 {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            let (rows, cols) = tensor_matrix_shape(tensor)?;
            let block_size = tensor.block_size as usize;
            if !block_size.is_multiple_of(2) || !cols.is_multiple_of(block_size) {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            let scale_count = rows
                .checked_mul(cols / block_size)
                .ok_or(ErrorCode::InvalidLength)?;
            validate_scale_range(file_len, tensor.scale_offset, scale_count)?;
        }
        DTYPE_Q5_0 => {
            if tensor.scale_offset == 0 || tensor.block_size == 0 {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            let (rows, cols) = tensor_matrix_shape(tensor)?;
            let block_size = tensor.block_size as usize;
            if !block_size.is_multiple_of(8) || !cols.is_multiple_of(block_size) {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            let scale_count = rows
                .checked_mul(cols / block_size)
                .ok_or(ErrorCode::InvalidLength)?;
            validate_scale_range(file_len, tensor.scale_offset, scale_count)?;
        }
        _ => return Err(ErrorCode::UnsupportedDType),
    }
    Ok(())
}

fn expected_tensor_payload_len(tensor: &TensorEntry) -> Result<u64, ErrorCode> {
    let element_count = tensor_element_count(tensor)?;
    match tensor.dtype {
        DTYPE_F32 => element_count.checked_mul(4).ok_or(ErrorCode::InvalidLength),
        DTYPE_Q8_0 => Ok(element_count),
        DTYPE_Q4_0 => {
            if !element_count.is_multiple_of(2) {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            Ok(element_count / 2)
        }
        DTYPE_Q5_0 => {
            if !element_count.is_multiple_of(8) {
                return Err(ErrorCode::InvalidTensorDirectory);
            }
            element_count
                .checked_mul(5)
                .ok_or(ErrorCode::InvalidLength)
                .map(|bits| bits / 8)
        }
        _ => Err(ErrorCode::UnsupportedDType),
    }
}

fn validate_scale_range(file_len: usize, offset: u64, count: usize) -> Result<(), ErrorCode> {
    let byte_len = count.checked_mul(4).ok_or(ErrorCode::InvalidLength)? as u64;
    if !range_within(file_len, offset, byte_len) {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    Ok(())
}

fn tensor_element_count(tensor: &TensorEntry) -> Result<u64, ErrorCode> {
    let mut total = 1u64;
    for dim in tensor_dims(tensor).iter().copied() {
        total = total
            .checked_mul(u64::from(dim))
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok(total)
}

fn tensor_matrix_shape(tensor: &TensorEntry) -> Result<(usize, usize), ErrorCode> {
    let dims = tensor_dims(tensor);
    let rows = if dims.len() <= 1 {
        1usize
    } else {
        usize::try_from(dims[0]).map_err(|_| ErrorCode::InvalidLength)?
    };
    let mut cols = if dims.len() <= 1 {
        u64::from(dims[0])
    } else {
        1u64
    };
    for dim in dims.iter().copied().skip(1) {
        cols = cols
            .checked_mul(u64::from(dim))
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok((
        rows,
        usize::try_from(cols).map_err(|_| ErrorCode::InvalidLength)?,
    ))
}

fn tensor_dims(tensor: &TensorEntry) -> Vec<u32> {
    let all = [tensor.dim0, tensor.dim1, tensor.dim2, tensor.dim3];
    all.iter().take(tensor.rank as usize).copied().collect()
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidHeader)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u32::from_le_bytes(
        slice.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
    ))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidHeader)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u64::from_le_bytes(
        slice.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
    ))
}

fn range_within(file_len: usize, offset: u64, len: u64) -> bool {
    let Some(end) = offset.checked_add(len) else {
        return false;
    };
    end <= file_len as u64
}

fn usize_from_u64(value: u64) -> Result<usize, ErrorCode> {
    usize::try_from(value).map_err(|_| ErrorCode::InvalidLength)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_header_bytes(tensor_count: u32) -> Vec<u8> {
        let directory_offset = 128u64;
        let directory_len = tensor_count as usize * TENSOR_ENTRY_LEN;
        let tensor_data_offset = ((directory_offset as usize + directory_len + 63) & !63) as u64;
        let mut bytes = vec![0u8; tensor_data_offset as usize];
        bytes[0..4].copy_from_slice(b"SLM1");
        bytes[4..8].copy_from_slice(&SLM_VERSION.to_le_bytes());
        bytes[8..12].copy_from_slice(&(HEADER_LEN as u32).to_le_bytes());
        bytes[12..16].copy_from_slice(&1u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&0u32.to_le_bytes());
        bytes[20..24].copy_from_slice(&260u32.to_le_bytes());
        bytes[24..28].copy_from_slice(&4u32.to_le_bytes());
        bytes[28..32].copy_from_slice(&8u32.to_le_bytes());
        bytes[32..36].copy_from_slice(&1u32.to_le_bytes());
        bytes[36..40].copy_from_slice(&2u32.to_le_bytes());
        bytes[40..44].copy_from_slice(&2u32.to_le_bytes());
        bytes[44..48].copy_from_slice(&4u32.to_le_bytes());
        bytes[48..52].copy_from_slice(&16u32.to_le_bytes());
        bytes[52..56].copy_from_slice(&16u32.to_le_bytes());
        bytes[56..60].copy_from_slice(&10000.0f32.to_le_bytes());
        bytes[60..64].copy_from_slice(&0.00001f32.to_le_bytes());
        bytes[64..72].copy_from_slice(&(HEADER_LEN as u64).to_le_bytes());
        bytes[72..80].copy_from_slice(&0u64.to_le_bytes());
        bytes[80..88].copy_from_slice(&directory_offset.to_le_bytes());
        bytes[88..92].copy_from_slice(&tensor_count.to_le_bytes());
        bytes[92..100].copy_from_slice(&tensor_data_offset.to_le_bytes());
        bytes[100..108].copy_from_slice(&0u64.to_le_bytes());
        let checksum = simple_checksum(&bytes);
        bytes[100..108].copy_from_slice(&checksum.to_le_bytes());
        bytes
    }

    fn valid_one_f32_tensor_bytes() -> Vec<u8> {
        let mut bytes = valid_header_bytes(1);
        let payload_offset = read_u64(&bytes, 92).unwrap() as usize;
        bytes.resize(payload_offset + 16, 0);
        write_tensor_entry(
            &mut bytes,
            TensorEntry {
                name_hash: name_hash("test.weight"),
                dtype: DTYPE_F32,
                rank: 1,
                dim0: 4,
                dim1: 1,
                dim2: 1,
                dim3: 1,
                byte_offset: payload_offset as u64,
                byte_length: 16,
                scale_offset: 0,
                block_size: 0,
            },
        );
        for index in 0..4 {
            let offset = payload_offset + index * 4;
            bytes[offset..offset + 4].copy_from_slice(&(index as f32 + 1.0).to_le_bytes());
        }
        refresh_checksum(&mut bytes);
        bytes
    }

    fn valid_one_q8_tensor_bytes() -> Vec<u8> {
        let mut bytes = valid_header_bytes(1);
        let payload_offset = read_u64(&bytes, 92).unwrap() as usize;
        let scale_offset = payload_offset + 8;
        bytes.resize(scale_offset + 8, 0);
        write_tensor_entry(
            &mut bytes,
            TensorEntry {
                name_hash: name_hash("test_q8.weight"),
                dtype: DTYPE_Q8_0,
                rank: 2,
                dim0: 2,
                dim1: 4,
                dim2: 1,
                dim3: 1,
                byte_offset: payload_offset as u64,
                byte_length: 8,
                scale_offset: scale_offset as u64,
                block_size: 4,
            },
        );
        bytes[payload_offset..payload_offset + 8].copy_from_slice(&[1, 2, 3, 4, 5, 6, 7, 8]);
        bytes[scale_offset..scale_offset + 4].copy_from_slice(&1.0f32.to_le_bytes());
        bytes[scale_offset + 4..scale_offset + 8].copy_from_slice(&0.5f32.to_le_bytes());
        refresh_checksum(&mut bytes);
        bytes
    }

    fn valid_one_q5_tensor_bytes() -> Vec<u8> {
        let mut bytes = valid_header_bytes(1);
        let payload_offset = read_u64(&bytes, 92).unwrap() as usize;
        let scale_offset = payload_offset + 5;
        bytes.resize(scale_offset + 4, 0);
        write_tensor_entry(
            &mut bytes,
            TensorEntry {
                name_hash: name_hash("test_q5.weight"),
                dtype: DTYPE_Q5_0,
                rank: 2,
                dim0: 1,
                dim1: 8,
                dim2: 1,
                dim3: 1,
                byte_offset: payload_offset as u64,
                byte_length: 5,
                scale_offset: scale_offset as u64,
                block_size: 8,
            },
        );
        bytes[payload_offset..payload_offset + 5].copy_from_slice(&[0x30, 0x7e, 0x10, 0xce, 0xc3]);
        bytes[scale_offset..scale_offset + 4].copy_from_slice(&1.0f32.to_le_bytes());
        refresh_checksum(&mut bytes);
        bytes
    }

    fn write_tensor_entry(bytes: &mut [u8], entry: TensorEntry) {
        let base = 128usize;
        write_u64(bytes, base, entry.name_hash);
        write_u32(bytes, base + 8, entry.dtype);
        write_u32(bytes, base + 12, entry.rank);
        write_u32(bytes, base + 16, entry.dim0);
        write_u32(bytes, base + 20, entry.dim1);
        write_u32(bytes, base + 24, entry.dim2);
        write_u32(bytes, base + 28, entry.dim3);
        write_u64(bytes, base + 32, entry.byte_offset);
        write_u64(bytes, base + 40, entry.byte_length);
        write_u64(bytes, base + 48, entry.scale_offset);
        write_u32(bytes, base + 56, entry.block_size);
    }

    fn refresh_checksum(bytes: &mut [u8]) {
        write_u64(bytes, 100, 0);
        let checksum = simple_checksum(bytes);
        write_u64(bytes, 100, checksum);
    }

    fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
        bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn write_u64(bytes: &mut [u8], offset: usize, value: u64) {
        bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    }

    #[test]
    fn slm_header_parse() {
        let parsed = parse_slm(&valid_header_bytes(0)).unwrap();
        assert_eq!(parsed.header.hidden_size, 8);
        assert_eq!(parsed.header.layer_count, 1);
        assert_eq!(parsed.header.tensor_count, 0);
    }

    #[test]
    fn header_accepts_query_width_larger_than_hidden_size() {
        let mut bytes = valid_header_bytes(0);
        bytes[44..48].copy_from_slice(&8u32.to_le_bytes());
        refresh_checksum(&mut bytes);

        let parsed = parse_slm(&bytes).unwrap();
        assert_eq!(parsed.header.hidden_size, 8);
        assert_eq!(parsed.header.head_count * parsed.header.head_dim, 16);
    }

    #[test]
    fn header_rejects_query_width_overflow() {
        let mut bytes = valid_header_bytes(0);
        bytes[36..40].copy_from_slice(&u32::MAX.to_le_bytes());
        bytes[44..48].copy_from_slice(&2u32.to_le_bytes());
        refresh_checksum(&mut bytes);

        assert_eq!(parse_slm(&bytes).unwrap_err(), ErrorCode::InvalidLength);
    }

    #[test]
    fn tensor_directory_parse_accepts_valid_payload_metadata() {
        let parsed = parse_slm(&valid_one_f32_tensor_bytes()).unwrap();

        assert_eq!(parsed.tensors.len(), 1);
        assert_eq!(parsed.tensors[0].dtype, DTYPE_F32);

        let parsed = parse_slm(&valid_one_q8_tensor_bytes()).unwrap();

        assert_eq!(parsed.tensors.len(), 1);
        assert_eq!(parsed.tensors[0].dtype, DTYPE_Q8_0);

        let parsed = parse_slm(&valid_one_q5_tensor_bytes()).unwrap();

        assert_eq!(parsed.tensors.len(), 1);
        assert_eq!(parsed.tensors[0].dtype, DTYPE_Q5_0);
    }

    #[test]
    fn invalid_magic_rejection() {
        let mut bytes = vec![0; HEADER_LEN];
        bytes[0..4].copy_from_slice(b"NOPE");
        assert_eq!(parse_slm(&bytes).unwrap_err(), ErrorCode::InvalidModelMagic);
    }

    #[test]
    fn checksum_rejection() {
        let mut bytes = valid_header_bytes(0);
        bytes[20] ^= 1;
        assert_eq!(parse_slm(&bytes).unwrap_err(), ErrorCode::InvalidHeader);
    }

    #[test]
    fn non_finite_header_rejection_after_checksum_refresh() {
        let mut bytes = valid_header_bytes(0);
        bytes[56..60].copy_from_slice(&f32::NAN.to_le_bytes());
        refresh_checksum(&mut bytes);

        assert_eq!(parse_slm(&bytes).unwrap_err(), ErrorCode::InvalidHeader);
    }

    #[test]
    fn zero_tensor_dimension_rejection_after_checksum_refresh() {
        let mut bytes = valid_one_f32_tensor_bytes();
        write_u32(&mut bytes, 128 + 16, 0);
        refresh_checksum(&mut bytes);

        assert_eq!(
            parse_slm(&bytes).unwrap_err(),
            ErrorCode::InvalidTensorDirectory
        );
    }

    #[test]
    fn tensor_payload_length_rejection_after_checksum_refresh() {
        let mut bytes = valid_one_f32_tensor_bytes();
        write_u64(&mut bytes, 128 + 40, 12);
        refresh_checksum(&mut bytes);

        assert_eq!(
            parse_slm(&bytes).unwrap_err(),
            ErrorCode::InvalidTensorDirectory
        );
    }

    #[test]
    fn q8_scale_range_rejection_after_checksum_refresh() {
        let mut bytes = valid_one_q8_tensor_bytes();
        let invalid_scale_offset = bytes.len() as u64 - 2;
        write_u64(&mut bytes, 128 + 48, invalid_scale_offset);
        refresh_checksum(&mut bytes);

        assert_eq!(
            parse_slm(&bytes).unwrap_err(),
            ErrorCode::InvalidTensorDirectory
        );
    }

    #[test]
    fn q5_rejects_non_byte_aligned_block_contract() {
        let mut bytes = valid_one_q5_tensor_bytes();
        write_u32(&mut bytes, 128 + 56, 4);
        refresh_checksum(&mut bytes);

        assert_eq!(
            parse_slm(&bytes).unwrap_err(),
            ErrorCode::InvalidTensorDirectory
        );
    }
}
