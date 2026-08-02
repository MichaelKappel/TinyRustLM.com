//! Runtime error codes.

/// Explicit error values returned across the WASM ABI.
#[repr(u32)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ErrorCode {
    /// Operation completed successfully.
    Ok = 0,
    /// A pointer argument was null when data was required.
    NullPointer = 1,
    /// A length argument was invalid or exceeded supported limits.
    InvalidLength = 2,
    /// Input bytes were not valid UTF-8.
    InvalidUtf8 = 3,
    /// The model file magic was not `SLM1`.
    InvalidModelMagic = 4,
    /// The model version is not supported by this runtime.
    UnsupportedModelVersion = 5,
    /// Header fields were malformed or out of range.
    InvalidHeader = 6,
    /// The tensor directory was malformed or out of range.
    InvalidTensorDirectory = 7,
    /// A required tensor was absent from the directory.
    MissingTensor = 8,
    /// Tensor dimensions did not match the model header or operation shape.
    ShapeMismatch = 9,
    /// The tensor dtype is not supported by the active runtime path.
    UnsupportedDType = 10,
    /// The prompt or generation would exceed the context window.
    ContextExceeded = 11,
    /// Generation was requested before a model was loaded.
    ModelNotLoaded = 12,
    /// Generation failed after validation.
    GenerationFailed = 13,
    /// The output buffer could not hold the requested result.
    OutputBufferExceeded = 14,
    /// Calculator input was not a supported arithmetic expression.
    InvalidExpression = 15,
    /// Calculator evaluation produced NaN or infinity.
    NonFiniteResult = 16,
    /// Generation was requested without an admitted immutable composition graph.
    CompositionNotActive = 17,
    /// A state-changing operation was attempted while generation owned the runtime.
    RuntimeBusy = 18,
}

impl ErrorCode {
    /// Returns a stable human-readable message for this error code.
    pub fn message(self) -> &'static str {
        match self {
            ErrorCode::Ok => "ok",
            ErrorCode::NullPointer => "null pointer",
            ErrorCode::InvalidLength => "invalid length",
            ErrorCode::InvalidUtf8 => "invalid utf-8",
            ErrorCode::InvalidModelMagic => "invalid model magic",
            ErrorCode::UnsupportedModelVersion => "unsupported model version",
            ErrorCode::InvalidHeader => "invalid header",
            ErrorCode::InvalidTensorDirectory => "invalid tensor directory",
            ErrorCode::MissingTensor => "missing tensor",
            ErrorCode::ShapeMismatch => "shape mismatch",
            ErrorCode::UnsupportedDType => "unsupported dtype",
            ErrorCode::ContextExceeded => "context exceeded",
            ErrorCode::ModelNotLoaded => "model not loaded",
            ErrorCode::GenerationFailed => "generation failed",
            ErrorCode::OutputBufferExceeded => "output buffer exceeded",
            ErrorCode::InvalidExpression => "invalid arithmetic expression",
            ErrorCode::NonFiniteResult => "non-finite arithmetic result",
            ErrorCode::CompositionNotActive => "composition not active",
            ErrorCode::RuntimeBusy => "runtime busy",
        }
    }

    /// Converts this error into its ABI integer representation.
    pub fn as_u32(self) -> u32 {
        self as u32
    }
}
