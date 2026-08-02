use crate::OracleError;

/// Explicit effective-byte accounting for one scalar experiment arm.
///
/// Every field is caller-observed or caller-bounded. The type does not infer
/// allocator behavior and cannot hide codebooks, transforms, pages, padding,
/// scratch space, or allocator overhead behind payload bytes.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct StorageAccounting {
    /// Packed persistent vector codes.
    pub persistent_codes: usize,
    /// Headers, IDs, offsets, lengths, and other persistent metadata.
    pub metadata: usize,
    /// Persisted transform seed, signs, matrices, or equivalent state.
    pub transforms: usize,
    /// Persisted reconstruction centroids and estimator correction data.
    pub codebooks: usize,
    /// Page tables and page-level persistent or ephemeral control bytes.
    pub pages: usize,
    /// Alignment and tail padding not included in another field.
    pub padding: usize,
    /// Peak temporary bytes required by the measured operation.
    pub scratch: usize,
    /// Measured or explicitly bounded allocator overhead.
    pub allocator_overhead: usize,
}

impl StorageAccounting {
    /// Sums all declared byte classes and rejects host-integer overflow.
    pub fn total_bytes(self) -> Result<usize, OracleError> {
        [
            self.persistent_codes,
            self.metadata,
            self.transforms,
            self.codebooks,
            self.pages,
            self.padding,
            self.scratch,
            self.allocator_overhead,
        ]
        .into_iter()
        .try_fold(0_usize, |total, value| {
            total
                .checked_add(value)
                .ok_or(OracleError::ArithmeticOverflow)
        })
    }

    /// Compares two arms only after every declared byte class is counted.
    pub fn has_equal_total(self, other: Self) -> Result<bool, OracleError> {
        Ok(self.total_bytes()? == other.total_bytes()?)
    }
}

#[cfg(test)]
mod tests {
    use super::StorageAccounting;
    use crate::OracleError;

    /// Proves every field contributes to the effective byte total.
    #[test]
    fn total_includes_every_declared_byte_class() {
        let accounting = StorageAccounting {
            persistent_codes: 1,
            metadata: 2,
            transforms: 4,
            codebooks: 8,
            pages: 16,
            padding: 32,
            scratch: 64,
            allocator_overhead: 128,
        };
        assert_eq!(accounting.total_bytes(), Ok(255));
    }

    /// Equal payloads are not equal-byte arms when hidden overhead differs.
    #[test]
    fn matched_payload_does_not_hide_overhead_mismatch() {
        let baseline = StorageAccounting {
            persistent_codes: 100,
            metadata: 10,
            ..StorageAccounting::default()
        };
        let hidden_codebook = StorageAccounting {
            persistent_codes: 100,
            codebooks: 16,
            ..StorageAccounting::default()
        };
        let actually_equal = StorageAccounting {
            persistent_codes: 90,
            metadata: 20,
            ..StorageAccounting::default()
        };

        assert_eq!(baseline.has_equal_total(hidden_codebook), Ok(false));
        assert_eq!(baseline.has_equal_total(actually_equal), Ok(true));
    }

    /// Oversized accounting fails rather than wrapping to a favorable result.
    #[test]
    fn total_overflow_is_rejected() {
        let accounting = StorageAccounting {
            persistent_codes: usize::MAX,
            metadata: 1,
            ..StorageAccounting::default()
        };
        assert_eq!(
            accounting.total_bytes(),
            Err(OracleError::ArithmeticOverflow)
        );
        assert_eq!(
            accounting.has_equal_total(StorageAccounting::default()),
            Err(OracleError::ArithmeticOverflow)
        );
    }
}
