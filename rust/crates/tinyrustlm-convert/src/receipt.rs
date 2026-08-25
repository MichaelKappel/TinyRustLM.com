use sha2::{Digest, Sha256};

/// Exact cryptographic identity of a promoted conversion receipt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReceiptIdentity {
    byte_length: u64,
    sha256: [u8; 32],
}

impl ReceiptIdentity {
    pub(crate) fn from_bytes(bytes: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        Self {
            byte_length: bytes.len() as u64,
            sha256: hasher.finalize().into(),
        }
    }

    /// Returns the exact receipt byte length.
    pub const fn byte_length(self) -> u64 {
        self.byte_length
    }

    /// Returns the plain SHA-256 over the exact receipt bytes.
    pub const fn sha256(self) -> [u8; 32] {
        self.sha256
    }

    /// Returns the lowercase hexadecimal SHA-256 over the exact receipt bytes.
    pub fn sha256_hex(self) -> String {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut output = String::with_capacity(64);
        for byte in self.sha256 {
            output.push(char::from(HEX[(byte >> 4) as usize]));
            output.push(char::from(HEX[(byte & 0x0f) as usize]));
        }
        output
    }
}
