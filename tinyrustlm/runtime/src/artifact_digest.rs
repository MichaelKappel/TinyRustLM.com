//! Incremental cryptographic identity for bounded browser file transfers.

use crate::errors::ErrorCode;

const BLOCK_BYTES: usize = 64;
const MAX_ARTIFACT_BYTES: usize = 1024 * 1024 * 1024;
const EVIDENCE_CHECKSUM_PRIME: u64 = 0x100_0000_01b3;
const INITIAL_STATE: [u32; 8] = [
    0x6a09_e667,
    0xbb67_ae85,
    0x3c6e_f372,
    0xa54f_f53a,
    0x510e_527f,
    0x9b05_688c,
    0x1f83_d9ab,
    0x5be0_cd19,
];
const ROUND_CONSTANTS: [u32; 64] = [
    0x428a_2f98,
    0x7137_4491,
    0xb5c0_fbcf,
    0xe9b5_dba5,
    0x3956_c25b,
    0x59f1_11f1,
    0x923f_82a4,
    0xab1c_5ed5,
    0xd807_aa98,
    0x1283_5b01,
    0x2431_85be,
    0x550c_7dc3,
    0x72be_5d74,
    0x80de_b1fe,
    0x9bdc_06a7,
    0xc19b_f174,
    0xe49b_69c1,
    0xefbe_4786,
    0x0fc1_9dc6,
    0x240c_a1cc,
    0x2de9_2c6f,
    0x4a74_84aa,
    0x5cb0_a9dc,
    0x76f9_88da,
    0x983e_5152,
    0xa831_c66d,
    0xb003_27c8,
    0xbf59_7fc7,
    0xc6e0_0bf3,
    0xd5a7_9147,
    0x06ca_6351,
    0x1429_2967,
    0x27b7_0a85,
    0x2e1b_2138,
    0x4d2c_6dfc,
    0x5338_0d13,
    0x650a_7354,
    0x766a_0abb,
    0x81c2_c92e,
    0x9272_2c85,
    0xa2bf_e8a1,
    0xa81a_664b,
    0xc24b_8b70,
    0xc76c_51a3,
    0xd192_e819,
    0xd699_0624,
    0xf40e_3585,
    0x106a_a070,
    0x19a4_c116,
    0x1e37_6c08,
    0x2748_774c,
    0x34b0_bcb5,
    0x391c_0cb3,
    0x4ed8_aa4a,
    0x5b9c_ca4f,
    0x682e_6ff3,
    0x748f_82ee,
    0x78a5_636f,
    0x84c8_7814,
    0x8cc7_0208,
    0x90be_fffa,
    0xa450_6ceb,
    0xbef9_a3f7,
    0xc671_78f2,
];

/// Computes SHA-256 for one nonempty bounded byte slice.
pub(crate) fn sha256_bytes(bytes: &[u8]) -> Result<[u8; 32], ErrorCode> {
    let mut digest = ArtifactDigest::for_loaded_bytes(bytes.len())?;
    digest.update(bytes)?;
    Ok(digest.finish()?.sha256)
}

/// Final identity values for one exact artifact byte stream.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactDigestResult {
    /// Number of bytes incorporated into both digests.
    pub byte_length: usize,
    /// Standard SHA-256 bytes.
    pub sha256: [u8; 32],
    /// Existing TinyRustLM browser evidence checksum.
    pub evidence_checksum: u64,
}

/// Restartable digest state bound to one declared artifact length.
#[derive(Debug, Clone)]
pub struct ArtifactDigest {
    expected_length: usize,
    byte_length: usize,
    state: [u32; 8],
    block: [u8; BLOCK_BYTES],
    block_length: usize,
    evidence_checksum: u64,
}

impl ArtifactDigest {
    /// Creates a digest that must receive exactly `expected_length` bytes.
    pub fn new(expected_length: usize) -> Result<Self, ErrorCode> {
        if expected_length == 0 || expected_length > MAX_ARTIFACT_BYTES {
            return Err(ErrorCode::InvalidLength);
        }
        Ok(Self::with_expected_length(expected_length))
    }

    fn for_loaded_bytes(expected_length: usize) -> Result<Self, ErrorCode> {
        if expected_length == 0
            || u64::try_from(expected_length)
                .ok()
                .and_then(|length| length.checked_mul(8))
                .is_none()
        {
            return Err(ErrorCode::InvalidLength);
        }
        Ok(Self::with_expected_length(expected_length))
    }

    fn with_expected_length(expected_length: usize) -> Self {
        Self {
            expected_length,
            byte_length: 0,
            state: INITIAL_STATE,
            block: [0; BLOCK_BYTES],
            block_length: 0,
            evidence_checksum: 0x4d59_5df4_d0f3_3173,
        }
    }

    /// Adds the next exact byte range, rejecting overflow and overrun.
    pub fn update(&mut self, bytes: &[u8]) -> Result<(), ErrorCode> {
        if bytes.is_empty() {
            return Err(ErrorCode::InvalidLength);
        }
        let next_length = self
            .byte_length
            .checked_add(bytes.len())
            .filter(|length| *length <= self.expected_length)
            .ok_or(ErrorCode::InvalidLength)?;
        for (offset, byte) in bytes.iter().enumerate() {
            let index = self.byte_length + offset;
            self.evidence_checksum ^= u64::from(*byte).wrapping_add((index as u64) << 2);
            self.evidence_checksum = self
                .evidence_checksum
                .rotate_left(9)
                .wrapping_mul(EVIDENCE_CHECKSUM_PRIME);
        }
        self.update_sha256(bytes);
        self.byte_length = next_length;
        Ok(())
    }

    /// Finalizes only after the declared byte count has been received.
    pub fn finish(mut self) -> Result<ArtifactDigestResult, ErrorCode> {
        if self.byte_length != self.expected_length {
            return Err(ErrorCode::InvalidLength);
        }
        let bit_length = (self.byte_length as u64).wrapping_mul(8);
        self.block[self.block_length] = 0x80;
        self.block_length += 1;
        if self.block_length > 56 {
            self.block[self.block_length..].fill(0);
            let block = self.block;
            self.compress(&block);
            self.block = [0; BLOCK_BYTES];
            self.block_length = 0;
        }
        self.block[self.block_length..56].fill(0);
        self.block[56..64].copy_from_slice(&bit_length.to_be_bytes());
        let block = self.block;
        self.compress(&block);

        let mut sha256 = [0u8; 32];
        for (index, word) in self.state.iter().enumerate() {
            sha256[index * 4..index * 4 + 4].copy_from_slice(&word.to_be_bytes());
        }
        Ok(ArtifactDigestResult {
            byte_length: self.byte_length,
            sha256,
            evidence_checksum: self.evidence_checksum,
        })
    }

    fn update_sha256(&mut self, bytes: &[u8]) {
        let mut offset = 0;
        if self.block_length > 0 {
            let count = (BLOCK_BYTES - self.block_length).min(bytes.len());
            self.block[self.block_length..self.block_length + count]
                .copy_from_slice(&bytes[..count]);
            self.block_length += count;
            offset = count;
            if self.block_length == BLOCK_BYTES {
                let block = self.block;
                self.compress(&block);
                self.block_length = 0;
            }
        }
        while offset + BLOCK_BYTES <= bytes.len() {
            let block: &[u8; BLOCK_BYTES] = bytes[offset..offset + BLOCK_BYTES]
                .try_into()
                .expect("SHA-256 block length is fixed");
            self.compress(block);
            offset += BLOCK_BYTES;
        }
        if offset < bytes.len() {
            let remaining = &bytes[offset..];
            self.block[..remaining.len()].copy_from_slice(remaining);
            self.block_length = remaining.len();
        }
    }

    fn compress(&mut self, block: &[u8; BLOCK_BYTES]) {
        let mut schedule = [0u32; 64];
        for (index, word) in block.chunks_exact(4).take(16).enumerate() {
            schedule[index] = u32::from_be_bytes(word.try_into().expect("word length is fixed"));
        }
        for index in 16..64 {
            let left = schedule[index - 15];
            let right = schedule[index - 2];
            let sigma0 = left.rotate_right(7) ^ left.rotate_right(18) ^ (left >> 3);
            let sigma1 = right.rotate_right(17) ^ right.rotate_right(19) ^ (right >> 10);
            schedule[index] = schedule[index - 16]
                .wrapping_add(sigma0)
                .wrapping_add(schedule[index - 7])
                .wrapping_add(sigma1);
        }

        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = self.state;
        for index in 0..64 {
            let sum1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let choice = (e & f) ^ ((!e) & g);
            let temporary1 = h
                .wrapping_add(sum1)
                .wrapping_add(choice)
                .wrapping_add(ROUND_CONSTANTS[index])
                .wrapping_add(schedule[index]);
            let sum0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let majority = (a & b) ^ (a & c) ^ (b & c);
            let temporary2 = sum0.wrapping_add(majority);
            h = g;
            g = f;
            f = e;
            e = d.wrapping_add(temporary1);
            d = c;
            c = b;
            b = a;
            a = temporary1.wrapping_add(temporary2);
        }
        self.state[0] = self.state[0].wrapping_add(a);
        self.state[1] = self.state[1].wrapping_add(b);
        self.state[2] = self.state[2].wrapping_add(c);
        self.state[3] = self.state[3].wrapping_add(d);
        self.state[4] = self.state[4].wrapping_add(e);
        self.state[5] = self.state[5].wrapping_add(f);
        self.state[6] = self.state[6].wrapping_add(g);
        self.state[7] = self.state[7].wrapping_add(h);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    fn expected_evidence_checksum(bytes: &[u8]) -> u64 {
        let mut checksum = 0x4d59_5df4_d0f3_3173u64;
        for (index, byte) in bytes.iter().enumerate() {
            checksum ^= u64::from(*byte).wrapping_add((index as u64) << 2);
            checksum = checksum
                .rotate_left(9)
                .wrapping_mul(EVIDENCE_CHECKSUM_PRIME);
        }
        checksum
    }

    #[test]
    fn sha256_matches_standard_vectors() {
        for (input, expected) in [
            (
                b"".as_slice(),
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            ),
            (
                b"abc".as_slice(),
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            ),
            (
                b"The quick brown fox jumps over the lazy dog".as_slice(),
                "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
            ),
        ] {
            let mut digest = ArtifactDigest::new(input.len().max(1)).unwrap();
            if input.is_empty() {
                digest.expected_length = 0;
            } else {
                digest.update(input).unwrap();
            }
            let result = digest.finish().unwrap();
            assert_eq!(hex(&result.sha256), expected);
        }
    }

    #[test]
    fn chunk_boundaries_preserve_both_identities() {
        let bytes: Vec<u8> = (0..1_048_713)
            .map(|index| ((index * 131 + index / 251) & 0xff) as u8)
            .collect();
        let mut digest = ArtifactDigest::new(bytes.len()).unwrap();
        let chunk_sizes = [1usize, 63, 64, 65, 4093, 65_536, 17];
        let mut offset = 0;
        let mut chunk = 0;
        while offset < bytes.len() {
            let end = (offset + chunk_sizes[chunk % chunk_sizes.len()]).min(bytes.len());
            digest.update(&bytes[offset..end]).unwrap();
            offset = end;
            chunk += 1;
        }
        let result = digest.finish().unwrap();
        assert_eq!(
            hex(&result.sha256),
            "4b24754f16ae2dda650ad4fb4dbb284f24c020f555b357ebd3d6233586bcf879"
        );
        assert_eq!(result.evidence_checksum, expected_evidence_checksum(&bytes));
    }

    #[test]
    fn declared_length_is_fail_closed() {
        assert_eq!(
            ArtifactDigest::new(0).unwrap_err(),
            ErrorCode::InvalidLength
        );
        assert_eq!(
            ArtifactDigest::new(MAX_ARTIFACT_BYTES + 1).unwrap_err(),
            ErrorCode::InvalidLength
        );
        let mut digest = ArtifactDigest::new(3).unwrap();
        assert_eq!(digest.update(&[]), Err(ErrorCode::InvalidLength));
        assert_eq!(digest.update(&[1, 2, 3, 4]), Err(ErrorCode::InvalidLength));
        digest.update(&[1, 2]).unwrap();
        assert_eq!(digest.finish().unwrap_err(), ErrorCode::InvalidLength);
    }

    #[test]
    fn loaded_byte_hashing_is_not_limited_by_browser_transfer_policy() {
        let digest = ArtifactDigest::for_loaded_bytes(MAX_ARTIFACT_BYTES + 1).unwrap();
        assert_eq!(digest.expected_length, MAX_ARTIFACT_BYTES + 1);
        assert_eq!(
            ArtifactDigest::new(MAX_ARTIFACT_BYTES + 1).unwrap_err(),
            ErrorCode::InvalidLength
        );
    }
}
