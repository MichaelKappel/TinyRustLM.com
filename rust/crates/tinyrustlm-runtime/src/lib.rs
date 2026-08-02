#![forbid(unsafe_code)]
#![doc = "Public TinyRustLM runtime harness operations."]

use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::path::Path;
use tinyrustlm_runtime::errors::ErrorCode;
use tinyrustlm_runtime::generate::Runtime;
use tinyrustlm_runtime::sampler::MAX_SAMPLING_CANDIDATES;
use tinyrustlm_slm::{safe_load_slm_from_path, SlmInspection, SlmLoadPolicy};

/// Public runtime SDK version.
pub const SDK_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Maximum top-k candidate count accepted by the public runtime harness.
pub const MAX_GENERATION_TOP_K: u32 = MAX_SAMPLING_CANDIDATES as u32;

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
    /// Runtime execution failed.
    Runtime(String),
}

impl Display for RuntimeSdkError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Slm(error) => Display::fmt(error, formatter),
            Self::InvalidGenerationOptions(message) => formatter.write_str(message),
            Self::Runtime(message) => formatter.write_str(message),
        }
    }
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

    fn fixture_model() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model.slm")
    }

    #[test]
    fn reports_public_capability_boundary() {
        let report = runtime_capabilities();
        assert!(report.slm_validation);
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
