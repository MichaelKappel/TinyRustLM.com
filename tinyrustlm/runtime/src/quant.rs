//! Quantization helpers for q8_0, q5_0, and q4_0.

#![allow(unsafe_code)]

use crate::errors::ErrorCode;

#[cfg(target_arch = "x86")]
type Q4M128i = core::arch::x86::__m128i;
#[cfg(target_arch = "x86")]
type Q4M256 = core::arch::x86::__m256;
#[cfg(target_arch = "x86_64")]
type Q4M128i = core::arch::x86_64::__m128i;
#[cfg(target_arch = "x86_64")]
type Q4M256 = core::arch::x86_64::__m256;

/// Computes a q8_0 row-major matrix-vector product with one scale per row.
pub fn matvec_q8_0(
    weights: &[i8],
    scales: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if weights.len() != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
        || scales.len() != rows
        || vector.len() != cols
        || out.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }

    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    if std::arch::is_x86_feature_detected!("avx2") {
        // The validated row-major lengths keep every eight-byte weight load and
        // eight-lane activation load inside their respective slices.
        unsafe {
            matvec_q8_0_avx2_validated(weights, scales, rows, cols, vector, out);
        }
        return Ok(());
    }

    matvec_q8_0_scalar_validated(weights, scales, rows, cols, vector, out);
    Ok(())
}

/// Computes validated q8 rows using the portable scalar operation order.
fn matvec_q8_0_scalar_validated(
    weights: &[i8],
    scales: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) {
    for (row, output) in out.iter_mut().enumerate().take(rows) {
        let mut sum = 0.0f32;
        let row_start = row * cols;
        for col in 0..cols {
            sum += f32::from(weights[row_start + col]) * scales[row] * vector[col];
        }
        *output = sum;
    }
}

/// Computes validated q8 rows with AVX2 conversion and lane-local accumulation.
#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[target_feature(enable = "avx2")]
unsafe fn matvec_q8_0_avx2_validated(
    weights: &[i8],
    scales: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) {
    #[cfg(target_arch = "x86")]
    use core::arch::x86::*;
    #[cfg(target_arch = "x86_64")]
    use core::arch::x86_64::*;

    for (row, output) in out.iter_mut().enumerate().take(rows) {
        let row_start = row * cols;
        let scale = _mm256_set1_ps(scales[row]);
        let mut accumulated = _mm256_setzero_ps();
        let mut col = 0usize;
        while col + 8 <= cols {
            let packed =
                unsafe { _mm_loadl_epi64(weights.as_ptr().add(row_start + col).cast::<__m128i>()) };
            let values = unsafe { _mm256_loadu_ps(vector.as_ptr().add(col)) };
            let expanded = _mm256_cvtepi32_ps(_mm256_cvtepi8_epi32(packed));
            let products = _mm256_mul_ps(_mm256_mul_ps(expanded, scale), values);
            accumulated = _mm256_add_ps(accumulated, products);
            col += 8;
        }
        let mut sum = q4_avx2_horizontal_sum(accumulated);
        while col < cols {
            sum += f32::from(weights[row_start + col]) * scales[row] * vector[col];
            col += 1;
        }
        *output = sum;
    }
}

/// Quantizes one f32 row into signed q8_0 values and returns its scale.
pub fn quantize_q8_row(row: &[f32], out: &mut [i8]) -> Result<f32, ErrorCode> {
    if row.len() != out.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut max_abs = 0.0f32;
    for value in row {
        if !value.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
        max_abs = max_abs.max(value.abs());
    }
    let scale = if max_abs == 0.0 { 1.0 } else { max_abs / 127.0 };
    for (index, value) in row.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-127.0, 127.0) as i8;
    }
    Ok(scale)
}

/// Dequantizes a packed q4_0 block into signed f32 values.
pub fn dequant_q4_0_block(packed: &[u8], scale: f32, out: &mut [f32]) -> Result<(), ErrorCode> {
    if out.len() != packed.len() * 2 {
        return Err(ErrorCode::ShapeMismatch);
    }
    for (index, byte) in packed.iter().enumerate() {
        let lo = sign_extend_4(byte & 0x0f);
        let hi = sign_extend_4(byte >> 4);
        out[index * 2] = f32::from(lo) * scale;
        out[index * 2 + 1] = f32::from(hi) * scale;
    }
    Ok(())
}

/// Packs two signed q4_0 values into one byte using low nibble first.
pub fn pack_q4_pair(a: i8, b: i8) -> u8 {
    ((b as u8) & 0x0f) << 4 | ((a as u8) & 0x0f)
}

/// Quantizes one f32 block into signed q4_0 values and returns its scale.
pub fn quantize_q4_block(block: &[f32], out: &mut [i8]) -> Result<f32, ErrorCode> {
    if block.len() != out.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut max_abs = 0.0f32;
    for value in block {
        if !value.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
        max_abs = max_abs.max(value.abs());
    }
    let scale = if max_abs == 0.0 { 1.0 } else { max_abs / 7.0 };
    for (index, value) in block.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-8.0, 7.0) as i8;
    }
    Ok(scale)
}

/// Computes a q4_0 row-major matrix-vector product with one scale per quantization block.
pub fn matvec_q4_0(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if block_size == 0
        || !block_size.is_multiple_of(2)
        || !cols.is_multiple_of(block_size)
        || vector.len() != cols
        || out.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }

    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    if block_size == 32 && std::arch::is_x86_feature_detected!("avx2") {
        // The shape checks above prove that every unaligned load stays inside the
        // packed matrix and activation vector. AVX2 availability is detected at runtime.
        unsafe {
            matvec_q4_0_avx2_validated(packed, scales, rows, cols, vector, out);
        }
        return Ok(());
    }

    #[cfg(all(target_arch = "wasm32", feature = "wasm-simd"))]
    if block_size == 32 {
        // This function is emitted only in the opt-in SIMD WebAssembly artifact.
        // The browser loader validates that complete artifact before selecting it.
        unsafe {
            matvec_q4_0_simd128_validated(packed, scales, rows, cols, vector, out);
        }
        return Ok(());
    }

    matvec_q4_0_scalar_validated(packed, scales, block_size, rows, cols, vector, out);
    Ok(())
}

fn matvec_q4_0_scalar_validated(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) {
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    for (row, output) in out.iter_mut().enumerate().take(rows) {
        let packed_row_start = row * bytes_per_row;
        let scale_row_start = row * blocks_per_row;
        let bytes_per_block = block_size / 2;
        let mut sum = 0.0f32;
        for block in 0..blocks_per_row {
            let packed_block_start = packed_row_start + block * bytes_per_block;
            let vector_block_start = block * block_size;
            let mut block_sum = 0.0f32;
            for pair in 0..bytes_per_block {
                let byte = packed[packed_block_start + pair];
                let col = vector_block_start + pair * 2;
                block_sum += f32::from(sign_extend_4(byte & 0x0f)) * vector[col];
                block_sum += f32::from(sign_extend_4(byte >> 4)) * vector[col + 1];
            }
            sum += block_sum * scales[scale_row_start + block];
        }
        *output = sum;
    }
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[target_feature(enable = "avx2")]
unsafe fn matvec_q4_0_avx2_validated(
    packed: &[u8],
    scales: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) {
    #[cfg(target_arch = "x86")]
    use core::arch::x86::*;
    #[cfg(target_arch = "x86_64")]
    use core::arch::x86_64::*;

    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / 32;
    let nibble_mask = _mm_set1_epi8(0x0f);
    let sign_bit = _mm_set1_epi8(8);

    for (row, output) in out.iter_mut().enumerate().take(rows) {
        let packed_row_start = row * bytes_per_row;
        let scale_row_start = row * blocks_per_row;
        let mut sum = 0.0f32;
        for block in 0..blocks_per_row {
            let packed_offset = packed_row_start + block * 16;
            let vector_offset = block * 32;
            let packed_lanes =
                unsafe { _mm_loadu_si128(packed.as_ptr().add(packed_offset).cast::<__m128i>()) };
            let low = _mm_and_si128(packed_lanes, nibble_mask);
            let high = _mm_and_si128(_mm_srli_epi16::<4>(packed_lanes), nibble_mask);
            let low_signed = _mm_sub_epi8(_mm_xor_si128(low, sign_bit), sign_bit);
            let high_signed = _mm_sub_epi8(_mm_xor_si128(high, sign_bit), sign_bit);
            let first = _mm_unpacklo_epi8(low_signed, high_signed);
            let second = _mm_unpackhi_epi8(low_signed, high_signed);

            let products = unsafe {
                let p0 = q4_avx2_mul_i8x8(first, vector.as_ptr().add(vector_offset));
                let p1 = q4_avx2_mul_i8x8(
                    _mm_srli_si128::<8>(first),
                    vector.as_ptr().add(vector_offset + 8),
                );
                let p2 = q4_avx2_mul_i8x8(second, vector.as_ptr().add(vector_offset + 16));
                let p3 = q4_avx2_mul_i8x8(
                    _mm_srli_si128::<8>(second),
                    vector.as_ptr().add(vector_offset + 24),
                );
                _mm256_add_ps(_mm256_add_ps(p0, p1), _mm256_add_ps(p2, p3))
            };
            sum += q4_avx2_horizontal_sum(products) * scales[scale_row_start + block];
        }
        *output = sum;
    }
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[target_feature(enable = "avx2")]
unsafe fn q4_avx2_mul_i8x8(weights: Q4M128i, vector: *const f32) -> Q4M256 {
    #[cfg(target_arch = "x86")]
    use core::arch::x86::*;
    #[cfg(target_arch = "x86_64")]
    use core::arch::x86_64::*;

    let weights = _mm256_cvtepi32_ps(_mm256_cvtepi8_epi32(weights));
    let values = unsafe { _mm256_loadu_ps(vector) };
    _mm256_mul_ps(weights, values)
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[target_feature(enable = "avx2")]
unsafe fn q4_avx2_horizontal_sum(values: Q4M256) -> f32 {
    #[cfg(target_arch = "x86")]
    use core::arch::x86::*;
    #[cfg(target_arch = "x86_64")]
    use core::arch::x86_64::*;

    let halves = _mm_add_ps(
        _mm256_castps256_ps128(values),
        _mm256_extractf128_ps::<1>(values),
    );
    let pairs = _mm_hadd_ps(halves, halves);
    _mm_cvtss_f32(_mm_hadd_ps(pairs, pairs))
}

#[cfg(all(target_arch = "wasm32", feature = "wasm-simd"))]
#[target_feature(enable = "simd128")]
unsafe fn matvec_q4_0_simd128_validated(
    packed: &[u8],
    scales: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) {
    use core::arch::wasm32::*;

    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / 32;
    let nibble_mask = i8x16_splat(0x0f);
    let sign_bit = i8x16_splat(8);
    for (row, output) in out.iter_mut().enumerate().take(rows) {
        let packed_row_start = row * bytes_per_row;
        let scale_row_start = row * blocks_per_row;
        let mut sum = 0.0f32;
        for block in 0..blocks_per_row {
            let packed_offset = packed_row_start + block * 16;
            let vector_offset = block * 32;
            let packed_lanes = unsafe { v128_load(packed.as_ptr().add(packed_offset).cast()) };
            let low = v128_and(packed_lanes, nibble_mask);
            let high = v128_and(u8x16_shr(packed_lanes, 4), nibble_mask);
            let low_signed = i8x16_sub(v128_xor(low, sign_bit), sign_bit);
            let high_signed = i8x16_sub(v128_xor(high, sign_bit), sign_bit);
            let first = i8x16_shuffle::<0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23>(
                low_signed,
                high_signed,
            );
            let second =
                i8x16_shuffle::<8, 24, 9, 25, 10, 26, 11, 27, 12, 28, 13, 29, 14, 30, 15, 31>(
                    low_signed,
                    high_signed,
                );

            let products = unsafe {
                let p0 =
                    q4_simd128_mul_i8x4(first, false, false, vector.as_ptr().add(vector_offset));
                let p1 =
                    q4_simd128_mul_i8x4(first, false, true, vector.as_ptr().add(vector_offset + 4));
                let p2 =
                    q4_simd128_mul_i8x4(first, true, false, vector.as_ptr().add(vector_offset + 8));
                let p3 =
                    q4_simd128_mul_i8x4(first, true, true, vector.as_ptr().add(vector_offset + 12));
                let p4 = q4_simd128_mul_i8x4(
                    second,
                    false,
                    false,
                    vector.as_ptr().add(vector_offset + 16),
                );
                let p5 = q4_simd128_mul_i8x4(
                    second,
                    false,
                    true,
                    vector.as_ptr().add(vector_offset + 20),
                );
                let p6 = q4_simd128_mul_i8x4(
                    second,
                    true,
                    false,
                    vector.as_ptr().add(vector_offset + 24),
                );
                let p7 = q4_simd128_mul_i8x4(
                    second,
                    true,
                    true,
                    vector.as_ptr().add(vector_offset + 28),
                );
                f32x4_add(
                    f32x4_add(f32x4_add(p0, p1), f32x4_add(p2, p3)),
                    f32x4_add(f32x4_add(p4, p5), f32x4_add(p6, p7)),
                )
            };
            let block_sum = f32x4_extract_lane::<0>(products)
                + f32x4_extract_lane::<1>(products)
                + f32x4_extract_lane::<2>(products)
                + f32x4_extract_lane::<3>(products);
            sum += block_sum * scales[scale_row_start + block];
        }
        *output = sum;
    }
}

#[cfg(all(target_arch = "wasm32", feature = "wasm-simd"))]
#[target_feature(enable = "simd128")]
unsafe fn q4_simd128_mul_i8x4(
    weights: core::arch::wasm32::v128,
    high_i8: bool,
    high_i16: bool,
    vector: *const f32,
) -> core::arch::wasm32::v128 {
    use core::arch::wasm32::*;

    let i16s = if high_i8 {
        i16x8_extend_high_i8x16(weights)
    } else {
        i16x8_extend_low_i8x16(weights)
    };
    let i32s = if high_i16 {
        i32x4_extend_high_i16x8(i16s)
    } else {
        i32x4_extend_low_i16x8(i16s)
    };
    let weights = f32x4_convert_i32x4(i32s);
    let values = unsafe { v128_load(vector.cast()) };
    f32x4_mul(weights, values)
}

/// Returns the exact byte count for an LSB-first packed five-bit code sequence.
pub fn packed_q5_len(element_count: usize) -> Result<usize, ErrorCode> {
    if !element_count.is_multiple_of(8) {
        return Err(ErrorCode::ShapeMismatch);
    }
    element_count
        .checked_mul(5)
        .ok_or(ErrorCode::InvalidLength)
        .map(|bits| bits / 8)
}

/// Packs signed q5 codes in two's-complement form, least-significant bit first.
pub fn pack_q5_codes(codes: &[i8], packed: &mut [u8]) -> Result<(), ErrorCode> {
    if packed.len() != packed_q5_len(codes.len())? {
        return Err(ErrorCode::ShapeMismatch);
    }
    packed.fill(0);
    for (index, code) in codes.iter().copied().enumerate() {
        if !(-16..=15).contains(&code) {
            return Err(ErrorCode::InvalidHeader);
        }
        let bits = (code as u8) & 0x1f;
        let bit_offset = index.checked_mul(5).ok_or(ErrorCode::InvalidLength)?;
        let byte_index = bit_offset / 8;
        let shift = bit_offset % 8;
        packed[byte_index] |= bits << shift;
        if shift > 3 {
            packed[byte_index + 1] |= bits >> (8 - shift);
        }
    }
    Ok(())
}

/// Decodes one signed q5 code from an LSB-first packed sequence.
pub fn q5_code_at(packed: &[u8], index: usize) -> Result<i8, ErrorCode> {
    let bit_offset = index.checked_mul(5).ok_or(ErrorCode::InvalidLength)?;
    if bit_offset.checked_add(5).ok_or(ErrorCode::InvalidLength)?
        > packed
            .len()
            .checked_mul(8)
            .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(q5_code_at_validated(packed, index))
}

/// Dequantizes one packed q5_0 block using a positive finite block scale.
pub fn dequant_q5_0_block(packed: &[u8], scale: f32, out: &mut [f32]) -> Result<(), ErrorCode> {
    if !scale.is_finite() || scale <= 0.0 || packed.len() != packed_q5_len(out.len())? {
        return Err(ErrorCode::ShapeMismatch);
    }
    for (index, value) in out.iter_mut().enumerate() {
        *value = f32::from(q5_code_at_validated(packed, index)) * scale;
    }
    Ok(())
}

/// Quantizes one f32 block into signed q5_0 values and returns its scale.
pub fn quantize_q5_block(block: &[f32], out: &mut [i8]) -> Result<f32, ErrorCode> {
    if block.len() != out.len() || !block.len().is_multiple_of(8) {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut extremum = 0.0f32;
    for value in block {
        if !value.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
        if value.abs() > extremum.abs() {
            extremum = *value;
        }
    }
    let scale = if extremum == 0.0 {
        1.0
    } else if extremum < 0.0 {
        -extremum / 16.0
    } else {
        extremum / 15.0
    };
    for (index, value) in block.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-16.0, 15.0) as i8;
    }
    Ok(scale)
}

/// Computes a q5_0 row-major matrix-vector product with one scale per block.
pub fn matvec_q5_0(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if block_size == 0
        || !block_size.is_multiple_of(8)
        || !cols.is_multiple_of(block_size)
        || vector.len() != cols
        || out.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let element_count = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
    let blocks_per_row = cols / block_size;
    if packed.len() != packed_q5_len(element_count)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    for row in 0..rows {
        let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
        let mut sum = 0.0f32;
        for block in 0..blocks_per_row {
            let scale = scales[row * blocks_per_row + block];
            let block_col = block * block_size;
            let packed_block_start = (row_start + block_col) * 5 / 8;
            for group in 0..(block_size / 8) {
                let packed_group_start = packed_block_start + group * 5;
                let word = q5_group_word(&packed[packed_group_start..packed_group_start + 5]);
                let vector_start = block_col + group * 8;
                for lane in 0..8 {
                    let code = sign_extend_5(((word >> (lane * 5)) & 0x1f) as u8);
                    sum += f32::from(code) * scale * vector[vector_start + lane];
                }
            }
        }
        out[row] = sum;
    }
    Ok(())
}

fn q5_code_at_validated(packed: &[u8], index: usize) -> i8 {
    let bit_offset = index * 5;
    let byte_index = bit_offset / 8;
    let shift = bit_offset % 8;
    let low = u16::from(packed[byte_index]);
    let high = packed.get(byte_index + 1).copied().map_or(0, u16::from);
    sign_extend_5(((low | (high << 8)) >> shift) as u8 & 0x1f)
}

fn q5_group_word(group: &[u8]) -> u64 {
    u64::from(group[0])
        | (u64::from(group[1]) << 8)
        | (u64::from(group[2]) << 16)
        | (u64::from(group[3]) << 24)
        | (u64::from(group[4]) << 32)
}

fn sign_extend_5(value: u8) -> i8 {
    let bits = (value & 0x1f) as i8;
    if bits >= 16 {
        bits - 32
    } else {
        bits
    }
}

fn sign_extend_4(value: u8) -> i8 {
    let nibble = (value & 0x0f) as i8;
    if nibble >= 8 {
        nibble - 16
    } else {
        nibble
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn q8_dequant_known_output() {
        let weights = [1i8, -2, 3, 4];
        let scales = [0.5, 1.0];
        let vector = [2.0, 1.0];
        let mut out = [0.0; 2];
        matvec_q8_0(&weights, &scales, 2, 2, &vector, &mut out).unwrap();
        assert_eq!(out, [0.0, 10.0]);
    }

    #[test]
    fn q8_quantize_row_produces_scale() {
        let mut out = [0i8; 2];
        let scale = quantize_q8_row(&[1.0, -1.0], &mut out).unwrap();
        assert!(scale > 0.0);
        assert_eq!(out, [127, -127]);
    }

    #[test]
    fn q8_optimized_path_matches_scalar_reference_with_tail_columns() {
        let rows = 7usize;
        let cols = 103usize;
        let weights = (0..rows * cols)
            .map(|index| ((index.wrapping_mul(73).wrapping_add(29) % 255) as i16 - 127) as i8)
            .collect::<Vec<_>>();
        let scales = (0..rows)
            .map(|index| 0.00390625 * (index + 1) as f32)
            .collect::<Vec<_>>();
        let vector = (0..cols)
            .map(|index| ((index as i32 % 23) - 11) as f32 / 9.0)
            .collect::<Vec<_>>();
        let mut actual = vec![0.0; rows];
        let mut expected = vec![0.0; rows];

        matvec_q8_0(&weights, &scales, rows, cols, &vector, &mut actual).unwrap();
        matvec_q8_0_scalar_validated(&weights, &scales, rows, cols, &vector, &mut expected);

        for (actual, expected) in actual.iter().zip(&expected) {
            let tolerance = 2.0e-5 * (1.0 + expected.abs());
            assert!(
                (actual - expected).abs() <= tolerance,
                "optimized={actual}, scalar={expected}, tolerance={tolerance}"
            );
        }
    }

    #[test]
    fn q4_dequant_known_output() {
        let packed = [0x1f, 0x80];
        let mut out = [0.0; 4];
        dequant_q4_0_block(&packed, 0.5, &mut out).unwrap();
        assert_eq!(out, [-0.5, 0.5, 0.0, -4.0]);
    }

    #[test]
    fn q4_pack_and_quantize_block_produce_low_nibble_first_bytes() {
        assert_eq!(pack_q4_pair(-1, 1), 0x1f);
        let mut out = [0i8; 2];
        let scale = quantize_q4_block(&[1.0, -1.0], &mut out).unwrap();
        assert!(scale > 0.0);
        assert_eq!(out, [7, -7]);
    }

    #[test]
    fn q4_matvec_uses_block_scales() {
        let packed = [0x11, 0x22];
        let scales = [1.0, 2.0];
        let vector = [1.0, 1.0, 1.0, 1.0];
        let mut out = [0.0];
        matvec_q4_0(&packed, &scales, 2, 1, 4, &vector, &mut out).unwrap();
        assert_eq!(out, [10.0]);
    }

    #[test]
    fn q4_block_accumulation_matches_elementwise_reference() {
        let rows = 3usize;
        let cols = 256usize;
        let block_size = 128usize;
        let packed = (0..rows * cols / 2)
            .map(|index| (index.wrapping_mul(37).wrapping_add(11) & 0xff) as u8)
            .collect::<Vec<_>>();
        let scales = [0.03125, 0.125, 0.5, 0.0625, 0.25, 1.0];
        let vector = (0..cols)
            .map(|index| ((index as i32 % 31) - 15) as f32 / 7.0)
            .collect::<Vec<_>>();
        let mut actual = vec![0.0; rows];
        let mut expected = vec![0.0; rows];

        matvec_q4_0(
            &packed,
            &scales,
            block_size,
            rows,
            cols,
            &vector,
            &mut actual,
        )
        .unwrap();
        for row in 0..rows {
            for col_byte in 0..cols / 2 {
                let byte = packed[row * cols / 2 + col_byte];
                let col = col_byte * 2;
                let scale = scales[row * (cols / block_size) + col / block_size];
                expected[row] += f32::from(sign_extend_4(byte & 0x0f)) * scale * vector[col];
                expected[row] += f32::from(sign_extend_4(byte >> 4)) * scale * vector[col + 1];
            }
        }

        for (actual, expected) in actual.iter().zip(&expected) {
            let tolerance = 1.0e-5 * (1.0 + expected.abs());
            assert!((actual - expected).abs() <= tolerance);
        }
    }

    #[test]
    fn q4_optimized_block_path_matches_scalar_reference() {
        let rows = 7usize;
        let cols = 96usize;
        let block_size = 32usize;
        let packed = (0..rows * cols / 2)
            .map(|index| (index.wrapping_mul(73).wrapping_add(29) & 0xff) as u8)
            .collect::<Vec<_>>();
        let scales = (0..rows * cols / block_size)
            .map(|index| 0.0078125 * ((index % 11) + 1) as f32)
            .collect::<Vec<_>>();
        let vector = (0..cols)
            .map(|index| ((index as i32 % 23) - 11) as f32 / 9.0)
            .collect::<Vec<_>>();
        let mut actual = vec![0.0; rows];
        let mut expected = vec![0.0; rows];

        matvec_q4_0(
            &packed,
            &scales,
            block_size,
            rows,
            cols,
            &vector,
            &mut actual,
        )
        .unwrap();
        matvec_q4_0_scalar_validated(
            &packed,
            &scales,
            block_size,
            rows,
            cols,
            &vector,
            &mut expected,
        );

        for (actual, expected) in actual.iter().zip(&expected) {
            let tolerance = 2.0e-5 * (1.0 + expected.abs());
            assert!(
                (actual - expected).abs() <= tolerance,
                "optimized={actual}, scalar={expected}, tolerance={tolerance}"
            );
        }
    }

    #[test]
    fn q5_pack_uses_lsb_first_signed_five_bit_codes() {
        let codes = [-16, -15, -1, 0, 1, 7, 15, -8];
        let mut packed = [0u8; 5];

        pack_q5_codes(&codes, &mut packed).unwrap();

        assert_eq!(packed, [0x30, 0x7e, 0x10, 0xce, 0xc3]);
        let decoded = (0..codes.len())
            .map(|index| q5_code_at(&packed, index).unwrap())
            .collect::<Vec<_>>();
        assert_eq!(decoded, codes);
    }

    #[test]
    fn q5_quantization_preserves_signed_extrema_and_rejects_non_finite_values() {
        let mut codes = [0i8; 8];
        let scale =
            quantize_q5_block(&[-16.0, -8.0, -1.0, 0.0, 1.0, 7.0, 15.0, 8.0], &mut codes).unwrap();

        assert_eq!(scale, 1.0);
        assert_eq!(codes, [-16, -8, -1, 0, 1, 7, 15, 8]);
        assert_eq!(
            quantize_q5_block(&[f32::NAN, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], &mut [0; 8]),
            Err(ErrorCode::InvalidHeader)
        );
    }

    #[test]
    fn q5_matvec_uses_block_scales_without_f32_shadow_weights() {
        let mut packed = [0u8; 5];
        pack_q5_codes(&[1, 2, 3, 4, 5, 6, 7, 8], &mut packed).unwrap();
        let scales = [0.5];
        let vector = [1.0; 8];
        let mut out = [0.0];

        matvec_q5_0(&packed, &scales, 8, 1, 8, &vector, &mut out).unwrap();

        assert_eq!(out, [18.0]);
    }
}
