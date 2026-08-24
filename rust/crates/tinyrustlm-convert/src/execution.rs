use std::error::Error;
use std::fmt;

/// A bounded public-safe converter execution-identity failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConverterExecutionIdentityError {
    code: &'static str,
}

impl ConverterExecutionIdentityError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for ConverterExecutionIdentityError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for ConverterExecutionIdentityError {}

/// Identity of the exact converter executable running one operation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConverterExecutionIdentity {
    implementation_version: String,
    executable_sha256: String,
}

impl ConverterExecutionIdentity {
    /// Creates a validated converter execution identity.
    pub fn new(
        implementation_version: impl Into<String>,
        executable_sha256: impl Into<String>,
    ) -> Result<Self, ConverterExecutionIdentityError> {
        let result = Self {
            implementation_version: implementation_version.into(),
            executable_sha256: executable_sha256.into(),
        };
        if !valid_safe_identifier(&result.implementation_version, 128)
            || !valid_sha256(&result.executable_sha256)
        {
            return Err(ConverterExecutionIdentityError::new(
                "converter-identity-invalid",
            ));
        }
        Ok(result)
    }

    /// Returns the bounded implementation version.
    pub fn implementation_version(&self) -> &str {
        &self.implementation_version
    }

    /// Returns the lowercase executable SHA-256.
    pub fn executable_sha256(&self) -> &str {
        &self.executable_sha256
    }
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn valid_safe_identifier(value: &str, maximum: usize) -> bool {
    !value.is_empty()
        && value.len() <= maximum
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b'/' | b':')
        })
}

#[cfg(test)]
mod tests {
    use super::ConverterExecutionIdentity;

    #[test]
    fn accepts_only_bounded_version_and_lowercase_sha256() {
        let identity = ConverterExecutionIdentity::new("0.1.8", "a".repeat(64)).unwrap();
        assert_eq!(identity.implementation_version(), "0.1.8");
        assert_eq!(identity.executable_sha256(), "a".repeat(64));

        assert_eq!(
            ConverterExecutionIdentity::new("", "a".repeat(64))
                .unwrap_err()
                .code(),
            "converter-identity-invalid"
        );
        assert_eq!(
            ConverterExecutionIdentity::new("0.1.8", "A".repeat(64))
                .unwrap_err()
                .code(),
            "converter-identity-invalid"
        );
    }
}
