use crate::OracleError;

/// Largest bit width admitted by the scalar packed-code experiment.
pub const MAX_CODE_WIDTH: u8 = 16;

/// Largest code count accepted by one packing or unpacking operation.
pub const MAX_CODE_COUNT: usize = 16_777_216;

/// Returns the one canonical byte count for `count` codes of `bit_width`.
pub fn packed_byte_len(count: usize, bit_width: u8) -> Result<usize, OracleError> {
    validate_width(bit_width)?;
    validate_count(count)?;
    let total_bits = count
        .checked_mul(usize::from(bit_width))
        .ok_or(OracleError::ArithmeticOverflow)?;
    total_bits
        .checked_add(7)
        .ok_or(OracleError::ArithmeticOverflow)
        .map(|rounded| rounded / 8)
}

/// Packs unsigned codes least-significant bit first in one little-endian bitstream.
pub fn pack_unsigned_codes(codes: &[u32], bit_width: u8) -> Result<Vec<u8>, OracleError> {
    validate_width(bit_width)?;
    validate_count(codes.len())?;
    let maximum = maximum_unsigned(bit_width);
    let mut packed = vec![0_u8; packed_byte_len(codes.len(), bit_width)?];
    for (index, code) in codes.iter().copied().enumerate() {
        if code > maximum {
            return Err(OracleError::UnsignedCodeOutOfRange {
                index,
                code,
                maximum,
            });
        }
        write_code(&mut packed, index, bit_width, code);
    }
    Ok(packed)
}

/// Unpacks the canonical little-endian bitstream into unsigned codes.
pub fn unpack_unsigned_codes(
    packed: &[u8],
    count: usize,
    bit_width: u8,
) -> Result<Vec<u32>, OracleError> {
    validate_packed(packed, count, bit_width)?;
    Ok((0..count)
        .map(|index| read_code(packed, index, bit_width))
        .collect())
}

/// Packs signed two's-complement codes at the declared fixed width.
pub fn pack_signed_codes(codes: &[i32], bit_width: u8) -> Result<Vec<u8>, OracleError> {
    validate_width(bit_width)?;
    validate_count(codes.len())?;
    let (minimum, maximum) = signed_range(bit_width);
    let mask = maximum_unsigned(bit_width);
    let mut unsigned = Vec::with_capacity(codes.len());
    for (index, code) in codes.iter().copied().enumerate() {
        if code < minimum || code > maximum {
            return Err(OracleError::SignedCodeOutOfRange {
                index,
                code,
                minimum,
                maximum,
            });
        }
        unsigned.push((code as u32) & mask);
    }
    pack_unsigned_codes(&unsigned, bit_width)
}

/// Unpacks fixed-width two's-complement codes into signed 32-bit values.
pub fn unpack_signed_codes(
    packed: &[u8],
    count: usize,
    bit_width: u8,
) -> Result<Vec<i32>, OracleError> {
    let unsigned = unpack_unsigned_codes(packed, count, bit_width)?;
    let sign_bit = 1_u32 << (bit_width - 1);
    let mask = maximum_unsigned(bit_width);
    Ok(unsigned
        .into_iter()
        .map(|code| {
            if code & sign_bit == 0 {
                code as i32
            } else {
                (code | !mask) as i32
            }
        })
        .collect())
}

/// Reads one unsigned code without allocating a reconstructed code vector.
pub(crate) fn read_packed_code(
    packed: &[u8],
    count: usize,
    bit_width: u8,
    index: usize,
) -> Result<u32, OracleError> {
    validate_packed(packed, count, bit_width)?;
    if index >= count {
        return Err(OracleError::PackedCodeIndexOutOfRange { index, count });
    }
    Ok(read_code(packed, index, bit_width))
}

/// Rejects unsupported widths before shifts or allocations occur.
fn validate_width(bit_width: u8) -> Result<(), OracleError> {
    if bit_width == 0 || bit_width > MAX_CODE_WIDTH {
        Err(OracleError::InvalidBitWidth {
            width: bit_width,
            maximum: MAX_CODE_WIDTH,
        })
    } else {
        Ok(())
    }
}

/// Rejects code counts above the explicit scalar allocation ceiling.
fn validate_count(count: usize) -> Result<(), OracleError> {
    if count > MAX_CODE_COUNT {
        Err(OracleError::CodeCountOutOfRange {
            count,
            maximum: MAX_CODE_COUNT,
        })
    } else {
        Ok(())
    }
}

/// Validates canonical byte length and zeroed final padding bits.
pub(crate) fn validate_packed(
    packed: &[u8],
    count: usize,
    bit_width: u8,
) -> Result<(), OracleError> {
    let expected = packed_byte_len(count, bit_width)?;
    if packed.len() != expected {
        return Err(OracleError::PackedLengthMismatch {
            expected,
            actual: packed.len(),
        });
    }
    let used_tail_bits = count
        .checked_mul(usize::from(bit_width))
        .ok_or(OracleError::ArithmeticOverflow)?
        % 8;
    if used_tail_bits != 0 {
        let unused_mask = !((1_u8 << used_tail_bits) - 1);
        if packed.last().is_some_and(|last| last & unused_mask != 0) {
            return Err(OracleError::NonZeroTailPadding);
        }
    }
    Ok(())
}

/// Returns the largest unsigned integer represented by one declared code.
fn maximum_unsigned(bit_width: u8) -> u32 {
    (1_u32 << bit_width) - 1
}

/// Returns the inclusive two's-complement range for one declared code.
fn signed_range(bit_width: u8) -> (i32, i32) {
    let magnitude = 1_i32 << (bit_width - 1);
    (-magnitude, magnitude - 1)
}

/// Writes one code into the canonical little-endian bitstream.
fn write_code(packed: &mut [u8], index: usize, bit_width: u8, code: u32) {
    let start_bit = index * usize::from(bit_width);
    for code_bit in 0..usize::from(bit_width) {
        if code & (1_u32 << code_bit) != 0 {
            let stream_bit = start_bit + code_bit;
            packed[stream_bit / 8] |= 1_u8 << (stream_bit % 8);
        }
    }
}

/// Reads one code from the canonical little-endian bitstream.
fn read_code(packed: &[u8], index: usize, bit_width: u8) -> u32 {
    let start_bit = index * usize::from(bit_width);
    let mut code = 0_u32;
    for code_bit in 0..usize::from(bit_width) {
        let stream_bit = start_bit + code_bit;
        if packed[stream_bit / 8] & (1_u8 << (stream_bit % 8)) != 0 {
            code |= 1_u32 << code_bit;
        }
    }
    code
}

#[cfg(test)]
mod tests {
    use super::{
        pack_signed_codes, pack_unsigned_codes, packed_byte_len, read_packed_code,
        unpack_signed_codes, unpack_unsigned_codes, MAX_CODE_COUNT, MAX_CODE_WIDTH,
    };
    use crate::OracleError;

    /// Generates width-bounded codes without sharing packing logic.
    fn unsigned_fixture(width: u8, count: usize) -> Vec<u32> {
        let mask = (1_u32 << width) - 1;
        (0..count)
            .map(|index| ((index * 37 + usize::from(width)) as u32) & mask)
            .collect()
    }

    /// Covers every width and every tail residue with exact unsigned replay.
    #[test]
    fn unsigned_round_trip_covers_widths_and_tails() {
        for width in 1..=MAX_CODE_WIDTH {
            for count in 0..=24 {
                let codes = unsigned_fixture(width, count);
                let packed = pack_unsigned_codes(&codes, width).expect("pack");
                assert_eq!(packed.len(), packed_byte_len(count, width).expect("length"));
                assert_eq!(
                    unpack_unsigned_codes(&packed, count, width).expect("unpack"),
                    codes
                );
            }
        }
    }

    /// Proves signed values use fixed-width two's-complement interpretation.
    #[test]
    fn signed_round_trip_covers_declared_extremes() {
        for width in 1..=MAX_CODE_WIDTH {
            let magnitude = 1_i32 << (width - 1);
            let codes = vec![-magnitude, -1, 0, magnitude - 1];
            let packed = pack_signed_codes(&codes, width).expect("pack signed");
            assert_eq!(
                unpack_signed_codes(&packed, codes.len(), width).expect("unpack signed"),
                codes
            );
        }
    }

    /// Pins bit order independently with a hand-computed cross-byte stream.
    #[test]
    fn bit_order_is_little_endian_across_byte_boundaries() {
        let packed = pack_unsigned_codes(&[0b101, 0b011, 0b110], 3).expect("pack");
        assert_eq!(packed, vec![0b1001_1101, 0b0000_0001]);
        assert_eq!(read_packed_code(&packed, 3, 3, 2), Ok(0b110));
    }

    /// Confirms slice alignment has no semantic effect on unpacking.
    #[test]
    fn deliberately_unaligned_slice_decodes_identically() {
        let codes = unsigned_fixture(7, 17);
        let packed = pack_unsigned_codes(&codes, 7).expect("pack");
        let mut container = vec![0xaa];
        container.extend_from_slice(&packed);
        assert_eq!(
            unpack_unsigned_codes(&container[1..], codes.len(), 7).expect("unaligned unpack"),
            codes
        );
    }

    /// Rejects invalid widths, over-limit counts, and out-of-range values.
    #[test]
    fn parameter_and_code_bounds_fail_before_ambiguous_encoding() {
        assert_eq!(
            packed_byte_len(1, 0),
            Err(OracleError::InvalidBitWidth {
                width: 0,
                maximum: MAX_CODE_WIDTH,
            })
        );
        assert_eq!(
            packed_byte_len(1, MAX_CODE_WIDTH + 1),
            Err(OracleError::InvalidBitWidth {
                width: MAX_CODE_WIDTH + 1,
                maximum: MAX_CODE_WIDTH,
            })
        );
        assert_eq!(
            packed_byte_len(MAX_CODE_COUNT + 1, 1),
            Err(OracleError::CodeCountOutOfRange {
                count: MAX_CODE_COUNT + 1,
                maximum: MAX_CODE_COUNT,
            })
        );
        assert_eq!(
            pack_unsigned_codes(&[8], 3),
            Err(OracleError::UnsignedCodeOutOfRange {
                index: 0,
                code: 8,
                maximum: 7,
            })
        );
        assert_eq!(
            pack_signed_codes(&[4], 3),
            Err(OracleError::SignedCodeOutOfRange {
                index: 0,
                code: 4,
                minimum: -4,
                maximum: 3,
            })
        );
    }

    /// Rejects truncation, extension, and noncanonical tail bits separately.
    #[test]
    fn malformed_packed_lengths_and_tail_padding_are_rejected() {
        let packed = pack_unsigned_codes(&[1, 2, 3], 3).expect("pack");
        assert_eq!(
            unpack_unsigned_codes(&packed[..1], 3, 3),
            Err(OracleError::PackedLengthMismatch {
                expected: 2,
                actual: 1,
            })
        );
        let mut extended = packed.clone();
        extended.push(0);
        assert_eq!(
            unpack_unsigned_codes(&extended, 3, 3),
            Err(OracleError::PackedLengthMismatch {
                expected: 2,
                actual: 3,
            })
        );
        let mut dirty_tail = packed;
        dirty_tail[1] |= 0b1000_0000;
        assert_eq!(
            unpack_unsigned_codes(&dirty_tail, 3, 3),
            Err(OracleError::NonZeroTailPadding)
        );
    }
}
