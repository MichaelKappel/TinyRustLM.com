//! Quantization writer helpers.

#![allow(dead_code)]

/// Quantizes one f32 row into signed q8 values and a row scale.
pub fn quantize_q8_row(row: &[f32], out: &mut [i8]) -> f32 {
    let mut max_abs = 0.0f32;
    for value in row {
        max_abs = max_abs.max(value.abs());
    }
    let scale = if max_abs == 0.0 { 1.0 } else { max_abs / 127.0 };
    for (index, value) in row.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-127.0, 127.0) as i8;
    }
    scale
}

/// Packs signed q4 nibbles into bytes using low nibble first.
pub fn pack_q4_pair(a: i8, b: i8) -> u8 {
    ((b as u8) & 0x0f) << 4 | ((a as u8) & 0x0f)
}

/// Quantizes one f32 block into signed q4 values and a block scale.
pub fn quantize_q4_block(block: &[f32], out: &mut [i8]) -> f32 {
    let mut max_abs = 0.0f32;
    for value in block {
        max_abs = max_abs.max(value.abs());
    }
    let scale = if max_abs == 0.0 { 1.0 } else { max_abs / 7.0 };
    for (index, value) in block.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-8.0, 7.0) as i8;
    }
    scale
}

/// Returns the exact byte count for an LSB-first packed five-bit sequence.
pub fn packed_q5_len(element_count: usize) -> Option<usize> {
    if !element_count.is_multiple_of(8) {
        return None;
    }
    element_count.checked_mul(5).map(|bits| bits / 8)
}

/// Quantizes one f32 block into signed q5 values and a block scale.
pub fn quantize_q5_block(block: &[f32], out: &mut [i8]) -> f32 {
    debug_assert_eq!(block.len(), out.len());
    let mut extremum = 0.0f32;
    for value in block {
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
    scale
}

/// Packs signed q5 codes in two's-complement form, least-significant bit first.
pub fn pack_q5_codes(codes: &[i8], packed: &mut [u8]) -> Result<(), &'static str> {
    if packed_q5_len(codes.len()) != Some(packed.len()) {
        return Err("q5 code and payload lengths do not match");
    }
    packed.fill(0);
    for (index, code) in codes.iter().copied().enumerate() {
        if !(-16..=15).contains(&code) {
            return Err("q5 code is outside the signed five-bit range");
        }
        let bits = (code as u8) & 0x1f;
        let bit_offset = index * 5;
        let byte_index = bit_offset / 8;
        let shift = bit_offset % 8;
        packed[byte_index] |= bits << shift;
        if shift > 3 {
            packed[byte_index + 1] |= bits >> (8 - shift);
        }
    }
    Ok(())
}

/// Reads one signed q5 code from an LSB-first packed sequence.
pub fn q5_code_at(packed: &[u8], index: usize) -> Result<i8, &'static str> {
    let bit_offset = index.checked_mul(5).ok_or("q5 code index overflow")?;
    if bit_offset.checked_add(5).ok_or("q5 code range overflow")?
        > packed
            .len()
            .checked_mul(8)
            .ok_or("q5 payload range overflow")?
    {
        return Err("q5 code index exceeds the payload");
    }
    let byte_index = bit_offset / 8;
    let shift = bit_offset % 8;
    let low = u16::from(packed[byte_index]);
    let high = packed.get(byte_index + 1).copied().map_or(0, u16::from);
    let bits = ((low | (high << 8)) >> shift) as u8 & 0x1f;
    Ok(if bits >= 16 {
        bits as i8 - 32
    } else {
        bits as i8
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantize_q8_row_produces_scale() {
        let mut out = [0i8; 2];
        let scale = quantize_q8_row(&[1.0, -1.0], &mut out);
        assert!(scale > 0.0);
        assert_eq!(out, [127, -127]);
    }

    #[test]
    fn pack_q4_pair_low_nibble_first() {
        assert_eq!(pack_q4_pair(-1, 1), 0x1f);
    }

    #[test]
    fn quantize_q4_block_produces_scale() {
        let mut out = [0i8; 2];
        let scale = quantize_q4_block(&[1.0, -1.0], &mut out);
        assert!(scale > 0.0);
        assert_eq!(out, [7, -7]);
    }

    #[test]
    fn q5_pack_and_quantization_are_deterministic() {
        let mut codes = [0i8; 8];
        let scale = quantize_q5_block(&[-16.0, -8.0, -1.0, 0.0, 1.0, 7.0, 15.0, 8.0], &mut codes);
        let mut packed = [0u8; 5];
        pack_q5_codes(&codes, &mut packed).unwrap();

        assert_eq!(scale, 1.0);
        assert_eq!(codes, [-16, -8, -1, 0, 1, 7, 15, 8]);
        assert_eq!(packed_q5_len(codes.len()), Some(5));
        assert_eq!(
            (0..codes.len())
                .map(|index| q5_code_at(&packed, index).unwrap())
                .collect::<Vec<_>>(),
            codes
        );
    }
}
