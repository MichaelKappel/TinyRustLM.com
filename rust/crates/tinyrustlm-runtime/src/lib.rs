#![forbid(unsafe_code)]
#![doc = "Public TinyRustLM runtime harness operations."]

use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use tinyrustlm_runtime::errors::ErrorCode;
use tinyrustlm_runtime::generate::Runtime;
use tinyrustlm_runtime::sampler::MAX_SAMPLING_CANDIDATES;
use tinyrustlm_slm::{safe_load_slm_from_path, SlmInspection, SlmLoadPolicy};

/// Public runtime SDK version.
pub const SDK_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Maximum top-k candidate count accepted by the public runtime harness.
pub const MAX_GENERATION_TOP_K: u32 = MAX_SAMPLING_CANDIDATES as u32;

const MIN_COMPOSITION_BUNDLE_BYTES: u64 = 512;
const MAX_COMPOSITION_BUNDLE_BYTES: u64 = 512 * 1024 * 1024;
const COMPOSITION_BUNDLE_ALIGNMENT: u64 = 64;

/// Runtime generation options accepted by the public harness.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub struct GenerationOptions {
    /// Maximum number of new tokens to generate.
    pub max_new_tokens: u32,
    /// Sampling temperature.
    pub temperature: f32,
    /// Top-k sampling candidate cap.
    pub top_k: u32,
    /// Top-p nucleus threshold.
    pub top_p: f32,
    /// Deterministic sampling seed.
    pub seed: u32,
}

impl Default for GenerationOptions {
    fn default() -> Self {
        Self {
            max_new_tokens: 64,
            temperature: 0.7,
            top_k: 40,
            top_p: 0.9,
            seed: 1,
        }
    }
}

impl GenerationOptions {
    /// Builds generation options from native ABI values after range validation.
    pub fn from_native(
        max_new_tokens: u32,
        temperature: f64,
        top_k: u32,
        top_p: f64,
        seed: u32,
    ) -> Result<Self, RuntimeSdkError> {
        if !temperature.is_finite() || temperature < 0.0 || temperature > f32::MAX as f64 {
            return Err(RuntimeSdkError::InvalidGenerationOptions(
                "temperature must be finite and greater than or equal to zero".to_string(),
            ));
        }
        if !top_p.is_finite() || top_p <= 0.0 || top_p > 1.0 {
            return Err(RuntimeSdkError::InvalidGenerationOptions(
                "top_p must be finite, greater than zero, and less than or equal to one"
                    .to_string(),
            ));
        }
        let options = Self {
            max_new_tokens,
            temperature: temperature as f32,
            top_k,
            top_p: top_p as f32,
            seed,
        };
        options.validate()?;
        Ok(options)
    }

    /// Validates the public generation contract before runtime mutation.
    pub fn validate(self) -> Result<(), RuntimeSdkError> {
        if self.max_new_tokens == 0 {
            return Err(RuntimeSdkError::InvalidGenerationOptions(
                "max_new_tokens must be greater than zero".to_string(),
            ));
        }
        if !self.temperature.is_finite() || self.temperature < 0.0 {
            return Err(RuntimeSdkError::InvalidGenerationOptions(
                "temperature must be finite and greater than or equal to zero".to_string(),
            ));
        }
        if self.top_k == 0 || self.top_k > MAX_GENERATION_TOP_K {
            return Err(RuntimeSdkError::InvalidGenerationOptions(format!(
                "top_k must be between 1 and {MAX_GENERATION_TOP_K}"
            )));
        }
        if !self.top_p.is_finite() || self.top_p <= 0.0 || self.top_p > 1.0 {
            return Err(RuntimeSdkError::InvalidGenerationOptions(
                "top_p must be finite, greater than zero, and less than or equal to one"
                    .to_string(),
            ));
        }
        Ok(())
    }
}

/// Runtime generation output.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct GenerationResult {
    /// Generated UTF-8 text.
    pub text: String,
    /// Diagnostics captured immediately after generation.
    pub diagnostics: String,
}

/// Runtime capability report intentionally limited to public SDK operations.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RuntimeCapabilities {
    /// Stable capability schema kind.
    pub kind: String,
    /// Stable capability schema version.
    pub version: u32,
    /// SDK package version.
    pub sdk_version: String,
    /// Whether `.slm` validation and inspection are available.
    pub slm_validation: bool,
    /// Whether local model loading is available.
    pub model_loading: bool,
    /// Whether immutable, hash-bound `.acg1` composition activation is available.
    pub composition_activation: bool,
    /// Whether generation is available.
    pub generation: bool,
    /// Whether step-by-step generation is available.
    pub step_generation: bool,
    /// Whether diagnostics are available.
    pub diagnostics: bool,
    /// Whether public metadata-bound P2P workflows are available.
    pub p2p_metadata_workflows: bool,
    /// Whether public UAIX memory and persona package workflows are available.
    pub memory_package_workflows: bool,
    /// Capabilities intentionally withheld from the NuGet SDK.
    pub excluded_private_capabilities: Vec<String>,
}

/// Public model load report.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct LoadReport {
    /// Validated model inspection report.
    pub inspection: SlmInspection,
    /// Runtime diagnostics captured after loading.
    pub diagnostics: String,
}

/// Public composition activation report.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CompositionActivationReport {
    /// Exact activated graph byte count.
    pub byte_count: u64,
    /// Canonical SHA-256 identity for the activated graph.
    pub sha256: String,
    /// Runtime diagnostics captured after atomic activation.
    pub diagnostics: String,
}

/// Public runtime harness that owns exactly one local model context.
pub struct PublicRuntime {
    runtime: Runtime,
    loaded: Option<SlmInspection>,
}

impl PublicRuntime {
    /// Creates an empty runtime context.
    pub fn create() -> Self {
        Self {
            runtime: Runtime::new(),
            loaded: None,
        }
    }

    /// Loads a validated `.slm` model from disk under the supplied policy.
    pub fn load_model_path(
        &mut self,
        path: impl AsRef<Path>,
        policy: &SlmLoadPolicy,
    ) -> Result<LoadReport, RuntimeSdkError> {
        let loaded = safe_load_slm_from_path(path, policy)?;
        let code = self.runtime.load_model(loaded.bytes());
        if code != ErrorCode::Ok {
            self.loaded = None;
            return Err(RuntimeSdkError::Runtime(code.message().to_string()));
        }
        let inspection = loaded.inspection().clone();
        self.loaded = Some(inspection.clone());
        Ok(LoadReport {
            inspection,
            diagnostics: self.diagnostics(),
        })
    }

    /// Unloads the current model while keeping the runtime context alive.
    pub fn unload_model(&mut self) -> Result<(), RuntimeSdkError> {
        let code = self.runtime.free_model();
        if code == ErrorCode::Ok {
            self.loaded = None;
            Ok(())
        } else {
            Err(RuntimeSdkError::Runtime(code.message().to_string()))
        }
    }

    /// Reads, verifies, and atomically activates one immutable `.acg1` graph.
    pub fn activate_composition_path(
        &mut self,
        path: impl AsRef<Path>,
        expected_sha256: &str,
    ) -> Result<CompositionActivationReport, RuntimeSdkError> {
        if self.loaded.is_none() {
            return Err(RuntimeSdkError::Runtime(
                ErrorCode::ModelNotLoaded.message().to_string(),
            ));
        }
        let expected_digest = parse_sha256(expected_sha256)?;
        let bytes = read_composition_bundle(path.as_ref())?;
        let code = self
            .runtime
            .activate_composition_graph(&bytes, expected_digest);
        if code != ErrorCode::Ok {
            return Err(RuntimeSdkError::Runtime(code.message().to_string()));
        }
        Ok(CompositionActivationReport {
            byte_count: bytes.len() as u64,
            sha256: format!("sha256:{}", hex_digest(expected_digest)),
            diagnostics: self.diagnostics(),
        })
    }

    /// Generates text from a prompt with explicit sampling options.
    pub fn generate(
        &mut self,
        prompt: &str,
        options: GenerationOptions,
    ) -> Result<GenerationResult, RuntimeSdkError> {
        options.validate()?;
        self.configure_sampling(options)?;
        let code = self.runtime.generate(prompt, options.max_new_tokens);
        if code != ErrorCode::Ok {
            return Err(RuntimeSdkError::Runtime(code.message().to_string()));
        }
        Ok(GenerationResult {
            text: self.last_result(),
            diagnostics: self.diagnostics(),
        })
    }

    /// Generates one token from the current context.
    pub fn step(&mut self) -> Result<GenerationResult, RuntimeSdkError> {
        let code = self.runtime.generate_next_token();
        if code != ErrorCode::Ok {
            return Err(RuntimeSdkError::Runtime(code.message().to_string()));
        }
        Ok(GenerationResult {
            text: self.last_result(),
            diagnostics: self.diagnostics(),
        })
    }

    /// Resets prompt and cache state.
    pub fn reset(&mut self) -> Result<(), RuntimeSdkError> {
        let code = self.runtime.reset_context();
        if code == ErrorCode::Ok {
            Ok(())
        } else {
            Err(RuntimeSdkError::Runtime(code.message().to_string()))
        }
    }

    /// Returns the current diagnostics text.
    pub fn diagnostics(&self) -> String {
        String::from_utf8_lossy(self.runtime.diagnostics()).into_owned()
    }

    /// Returns inspection metadata for the currently loaded model.
    pub fn loaded_model(&self) -> Option<&SlmInspection> {
        self.loaded.as_ref()
    }

    fn configure_sampling(&mut self, options: GenerationOptions) -> Result<(), RuntimeSdkError> {
        let code = self.runtime.configure_sampling(
            options.temperature,
            options.top_k,
            options.top_p,
            options.seed,
        );
        if code == ErrorCode::Ok {
            Ok(())
        } else {
            Err(RuntimeSdkError::Runtime(code.message().to_string()))
        }
    }

    fn last_result(&self) -> String {
        String::from_utf8_lossy(self.runtime.last_result()).into_owned()
    }
}

/// Returns the public runtime capability report.
pub fn runtime_capabilities() -> RuntimeCapabilities {
    RuntimeCapabilities {
        kind: "tinyrustlm.runtime.capabilities.v0".to_string(),
        version: 1,
        sdk_version: SDK_VERSION.to_string(),
        slm_validation: true,
        model_loading: true,
        composition_activation: true,
        generation: true,
        step_generation: true,
        diagnostics: true,
        p2p_metadata_workflows: true,
        memory_package_workflows: true,
        excluded_private_capabilities: vec![
            ".slm authoring internals".to_string(),
            "model conversion tools".to_string(),
            "quantization authoring tools".to_string(),
            "adapter authoring".to_string(),
            "adapter auto-assembly".to_string(),
            "selector registry generation".to_string(),
            "offline breeding operators".to_string(),
            "lineage promotion logic".to_string(),
            "eval/provenance authoring pipeline".to_string(),
            "premium routing algorithms".to_string(),
            "enterprise orchestration".to_string(),
            "premium optimizer logic".to_string(),
            "model-encryption key handling".to_string(),
            "server-assisted commercial features".to_string(),
            "telemetry backends".to_string(),
            "license server internals".to_string(),
        ],
    }
}

/// Error returned by public runtime SDK operations.
#[derive(Debug)]
pub enum RuntimeSdkError {
    /// `.slm` loading or validation failed.
    Slm(tinyrustlm_slm::SlmError),
    /// Generation options violated the public fixed-buffer runtime contract.
    InvalidGenerationOptions(String),
    /// Composition input violated the bounded immutable graph contract.
    InvalidComposition(String),
    /// Runtime execution failed.
    Runtime(String),
}

impl Display for RuntimeSdkError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Slm(error) => Display::fmt(error, formatter),
            Self::InvalidGenerationOptions(message) => formatter.write_str(message),
            Self::InvalidComposition(message) => formatter.write_str(message),
            Self::Runtime(message) => formatter.write_str(message),
        }
    }
}

fn read_composition_bundle(path: &Path) -> Result<Vec<u8>, RuntimeSdkError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        RuntimeSdkError::InvalidComposition(format!("composition graph metadata failed: {error}"))
    })?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() < MIN_COMPOSITION_BUNDLE_BYTES
        || metadata.len() > MAX_COMPOSITION_BUNDLE_BYTES
        || !metadata.len().is_multiple_of(COMPOSITION_BUNDLE_ALIGNMENT)
    {
        return Err(RuntimeSdkError::InvalidComposition(
            "composition graph file is not a bounded aligned regular file".to_string(),
        ));
    }
    let byte_count = usize::try_from(metadata.len()).map_err(|_| {
        RuntimeSdkError::InvalidComposition(
            "composition graph byte count is not addressable".to_string(),
        )
    })?;
    let mut bytes = Vec::new();
    bytes.try_reserve_exact(byte_count).map_err(|_| {
        RuntimeSdkError::InvalidComposition("composition graph allocation failed".to_string())
    })?;
    bytes.resize(byte_count, 0);
    let mut file = File::open(path).map_err(|error| {
        RuntimeSdkError::InvalidComposition(format!("composition graph open failed: {error}"))
    })?;
    file.read_exact(&mut bytes).map_err(|error| {
        RuntimeSdkError::InvalidComposition(format!("composition graph read failed: {error}"))
    })?;
    let mut trailing = [0u8; 1];
    if file.read(&mut trailing).map_err(|error| {
        RuntimeSdkError::InvalidComposition(format!("composition graph read failed: {error}"))
    })? != 0
    {
        return Err(RuntimeSdkError::InvalidComposition(
            "composition graph changed while it was read".to_string(),
        ));
    }
    Ok(bytes)
}

fn parse_sha256(value: &str) -> Result<[u8; 32], RuntimeSdkError> {
    let raw = value.strip_prefix("sha256:").unwrap_or(value);
    if raw.len() != 64
        || !raw
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(RuntimeSdkError::InvalidComposition(
            "composition SHA-256 must be 64 lowercase hexadecimal characters".to_string(),
        ));
    }
    let mut digest = [0u8; 32];
    for (index, pair) in raw.as_bytes().chunks_exact(2).enumerate() {
        digest[index] = (hex_nibble(pair[0]) << 4) | hex_nibble(pair[1]);
    }
    Ok(digest)
}

fn hex_nibble(value: u8) -> u8 {
    match value {
        b'0'..=b'9' => value - b'0',
        b'a'..=b'f' => value - b'a' + 10,
        _ => unreachable!("SHA-256 input is validated before decoding"),
    }
}

fn hex_digest(value: [u8; 32]) -> String {
    let mut output = String::with_capacity(64);
    for byte in value {
        use std::fmt::Write as _;
        write!(&mut output, "{byte:02x}").expect("writing to a String cannot fail");
    }
    output
}

impl std::error::Error for RuntimeSdkError {}

impl From<tinyrustlm_slm::SlmError> for RuntimeSdkError {
    fn from(value: tinyrustlm_slm::SlmError) -> Self {
        Self::Slm(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const FIXTURE_COMPOSITION_SHA256: &str =
        "sha256:1e3f267ff1ad5d076d7d1e6594f2e5e0fe7451e9055fe03f538ef756301d782f";

    fn fixture_model() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model.slm")
    }

    fn fixture_composition() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model.base.acg1")
    }

    #[test]
    fn reports_public_capability_boundary() {
        let report = runtime_capabilities();
        assert!(report.slm_validation);
        assert!(report.composition_activation);
        assert!(report.generation);
        assert!(report
            .excluded_private_capabilities
            .iter()
            .any(|item| item.contains("model conversion")));
    }

    #[test]
    fn loads_fixture_and_generates() {
        let mut runtime = PublicRuntime::create();
        let load = runtime
            .load_model_path(fixture_model(), &SlmLoadPolicy::default())
            .expect("load");
        assert!(load.inspection.tensor_count > 0);
        let activation = runtime
            .activate_composition_path(fixture_composition(), FIXTURE_COMPOSITION_SHA256)
            .expect("activate composition");
        assert_eq!(activation.byte_count, MIN_COMPOSITION_BUNDLE_BYTES);
        assert_eq!(activation.sha256, FIXTURE_COMPOSITION_SHA256);
        let output = runtime
            .generate(
                "hello",
                GenerationOptions {
                    max_new_tokens: 2,
                    ..GenerationOptions::default()
                },
            )
            .expect("generate");
        assert!(!output.diagnostics.is_empty());
    }

    #[test]
    fn generation_requires_explicit_composition_activation() {
        let mut runtime = PublicRuntime::create();
        runtime
            .load_model_path(fixture_model(), &SlmLoadPolicy::default())
            .expect("load");

        let error = runtime
            .generate("hello", GenerationOptions::default())
            .expect_err("generation must fail closed before composition activation");

        assert!(matches!(error, RuntimeSdkError::Runtime(_)));
        assert!(
            error.to_string().contains("composition not active"),
            "{error}"
        );
    }

    #[test]
    fn composition_activation_rejects_mismatched_identity() {
        let mut runtime = PublicRuntime::create();
        runtime
            .load_model_path(fixture_model(), &SlmLoadPolicy::default())
            .expect("load");

        let error = runtime
            .activate_composition_path(
                fixture_composition(),
                "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            )
            .expect_err("mismatched composition identity");

        assert!(matches!(error, RuntimeSdkError::Runtime(_)));
        assert!(!error.to_string().is_empty());
        let generation_error = runtime
            .generate("hello", GenerationOptions::default())
            .expect_err("failed activation must not make a graph active");
        assert!(generation_error
            .to_string()
            .contains("composition not active"));
    }

    #[test]
    fn unloads_model() {
        let mut runtime = PublicRuntime::create();
        runtime
            .load_model_path(fixture_model(), &SlmLoadPolicy::default())
            .expect("load");
        runtime.unload_model().expect("unload");
        assert!(runtime.loaded_model().is_none());
    }

    #[test]
    fn rejects_invalid_generation_options_before_runtime_call() {
        let mut runtime = PublicRuntime::create();
        let error = runtime
            .generate(
                "hello",
                GenerationOptions {
                    max_new_tokens: 0,
                    ..GenerationOptions::default()
                },
            )
            .expect_err("invalid options");
        assert!(matches!(
            error,
            RuntimeSdkError::InvalidGenerationOptions(_)
        ));
        assert!(error.to_string().contains("max_new_tokens"), "{error}");
    }

    #[test]
    fn rejects_native_generation_options_before_lossy_casts() {
        let error = GenerationOptions::from_native(1, f32::MAX as f64 * 2.0, 40, 0.9, 1)
            .expect_err("temperature overflow");
        assert!(matches!(
            error,
            RuntimeSdkError::InvalidGenerationOptions(_)
        ));
        assert!(error.to_string().contains("temperature"));

        let error = GenerationOptions::from_native(1, 0.7, MAX_GENERATION_TOP_K + 1, 0.9, 1)
            .expect_err("top-k overflow");
        assert!(matches!(
            error,
            RuntimeSdkError::InvalidGenerationOptions(_)
        ));
        assert!(error.to_string().contains("top_k"));

        let error = GenerationOptions::from_native(1, 0.7, 40, f64::INFINITY, 1)
            .expect_err("top-p infinity");
        assert!(matches!(
            error,
            RuntimeSdkError::InvalidGenerationOptions(_)
        ));
        assert!(error.to_string().contains("top_p"));
    }
}
