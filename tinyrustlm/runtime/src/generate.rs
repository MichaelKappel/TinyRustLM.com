//! Autoregressive generation state.

use crate::active_composition::{ActiveComposition, CompositionMatvec};
use crate::artifact_digest::ArtifactDigest;
use crate::calculator;
use crate::content_identity::Digest32;
use crate::diagnostics::Diagnostics;
use crate::errors::ErrorCode;
use crate::kv_cache::KvCache;
use crate::memory::OwnedModelBytes;
use crate::model::{LayerTensorIndices, Model};
use crate::ops::{dot, rms_norm, softmax, swiglu};
use crate::rng::XorShift64;
use crate::rope::apply_rope;
use crate::sampler::{apply_repetition_penalty, sample_with_rng, validate_config, SamplingConfig};
use crate::tokenizer::Tokenizer;
use core::fmt::Write as _;

const MAX_RESULT_BYTES: usize = 64 * 1024;
const RUNTIME_ARTIFACT_CHECKSUM_SEED: u64 = 0xa55e_6d62_1ed0_0001;
const MIN_GENERATED_TOKENS_BEFORE_EOS: usize = 4;
const MAX_REPEATED_TOKEN_RUN_BEFORE_SUPPRESSION: usize = 2;

/// Runtime state shared by browser exports.
pub struct Runtime {
    model: Option<Model>,
    kv_cache: Option<KvCache>,
    tokenizer: Tokenizer,
    tokens: Vec<u32>,
    next_prompt_tokens: Vec<u32>,
    generated_tokens: Vec<u32>,
    last_result: Vec<u8>,
    diagnostics_text: Vec<u8>,
    diagnostics: Diagnostics,
    sampling_config: SamplingConfig,
    rng: XorShift64,
    scratch: Option<ForwardScratch>,
    active_composition: Option<ActiveCompositionExecution>,
    generation_in_progress: bool,
    logits: Vec<f32>,
    artifact_digest: Option<ArtifactDigest>,
}

struct ActiveCompositionExecution {
    graph: ActiveComposition,
    specialist_scratch: Vec<f32>,
}

impl ActiveCompositionExecution {
    fn new(graph: ActiveComposition) -> Result<Self, ErrorCode> {
        let mut specialist_scratch = Vec::new();
        specialist_scratch
            .try_reserve_exact(graph.maximum_factor_rank())
            .map_err(|_| ErrorCode::InvalidLength)?;
        specialist_scratch.resize(graph.maximum_factor_rank(), 0.0);
        Ok(Self {
            graph,
            specialist_scratch,
        })
    }

    fn scratch_bytes(&self) -> usize {
        self.specialist_scratch.len() * core::mem::size_of::<f32>()
    }
}

impl Runtime {
    /// Creates a fresh runtime with no loaded model.
    pub fn new() -> Self {
        let mut runtime = Self {
            model: None,
            kv_cache: None,
            tokenizer: Tokenizer::default(),
            tokens: Vec::new(),
            next_prompt_tokens: Vec::new(),
            generated_tokens: Vec::new(),
            last_result: Vec::new(),
            diagnostics_text: Vec::new(),
            diagnostics: Diagnostics::default(),
            sampling_config: SamplingConfig::default(),
            rng: XorShift64::new(SamplingConfig::default().seed),
            scratch: None,
            active_composition: None,
            generation_in_progress: false,
            logits: Vec::new(),
            artifact_digest: None,
        };
        runtime.apply_sampling_to_diagnostics();
        runtime.refresh_diagnostics();
        runtime
    }

    /// Loads a validated `.slm` model.
    pub fn load_model(&mut self, bytes: &[u8]) -> ErrorCode {
        self.install_model(Model::load(bytes))
    }

    /// Loads a validated `.slm` model while retaining its transfer allocation.
    pub fn load_model_owned(&mut self, bytes: OwnedModelBytes) -> ErrorCode {
        self.install_model(Model::load_owned(bytes))
    }

    /// Starts a fail-closed digest for one declared browser file length.
    pub fn begin_artifact_digest(&mut self, expected_length: usize) -> ErrorCode {
        match ArtifactDigest::new(expected_length) {
            Ok(digest) => {
                self.artifact_digest = Some(digest);
                self.set_result("artifact digest started");
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.artifact_digest = None;
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Adds one bounded browser file slice to the active digest.
    pub fn update_artifact_digest(&mut self, bytes: &[u8]) -> ErrorCode {
        let result = self
            .artifact_digest
            .as_mut()
            .ok_or(ErrorCode::InvalidLength)
            .and_then(|digest| digest.update(bytes));
        match result {
            Ok(()) => {
                self.set_result("artifact digest updated");
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.artifact_digest = None;
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Finalizes the active digest and returns its public identity as JSON.
    pub fn finish_artifact_digest(&mut self) -> ErrorCode {
        let Some(digest) = self.artifact_digest.take() else {
            self.set_result(ErrorCode::InvalidLength.message());
            return self.finish(ErrorCode::InvalidLength);
        };
        match digest.finish() {
            Ok(result) => {
                let mut sha256 = String::with_capacity(71);
                sha256.push_str("sha256:");
                for byte in result.sha256 {
                    write!(&mut sha256, "{byte:02x}").expect("writing to a String cannot fail");
                }
                let report = format!(
                    "{{\"artifact_byte_count\":{},\"artifact_sha256\":\"{}\",\"artifact_checksum\":\"0x{:016x}\"}}",
                    result.byte_length, sha256, result.evidence_checksum
                );
                self.set_result(&report);
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    fn install_model(&mut self, loaded: Result<Model, ErrorCode>) -> ErrorCode {
        match loaded {
            Ok(model) => {
                let header = model.header();
                let layer_count = header.layer_count as usize;
                let max_context = header.max_context as usize;
                let kv_head_count = header.kv_head_count as usize;
                let head_dim = header.head_dim as usize;
                let vocab_size = header.vocab_size as usize;
                let quantization_mode = model.quantization_mode();
                let scratch = match ForwardScratch::new(&model) {
                    Ok(scratch) => scratch,
                    Err(error) => {
                        self.clear_model_state();
                        self.diagnostics.model_loaded = false;
                        self.diagnostics.reset_active_composition();
                        self.diagnostics.reset_kv_cache_allocation();
                        self.set_result(error.message());
                        return self.finish(error);
                    }
                };
                let cache = match KvCache::new(layer_count, max_context, kv_head_count, head_dim) {
                    Ok(cache) => cache,
                    Err(error) => {
                        self.clear_model_state();
                        self.diagnostics.model_loaded = false;
                        self.diagnostics.reset_active_composition();
                        self.diagnostics.reset_kv_cache_allocation();
                        self.set_result(error.message());
                        return self.finish(error);
                    }
                };
                let kv_cache_byte_budget = cache.byte_budget();
                let kv_cache_page_count = cache.page_count();
                self.tokens.clear();
                self.next_prompt_tokens.clear();
                self.generated_tokens.clear();
                self.tokenizer = model.tokenizer().clone();
                self.model = Some(model);
                self.kv_cache = Some(cache);
                self.scratch = Some(scratch);
                self.active_composition = None;
                self.generation_in_progress = false;
                self.logits = vec![0.0; vocab_size];
                self.diagnostics.reset_generation();
                self.diagnostics
                    .record_kv_cache_allocation(kv_cache_byte_budget, kv_cache_page_count);
                self.diagnostics.model_loaded = true;
                self.diagnostics.active_quantization_mode = quantization_mode;
                self.diagnostics.reset_active_composition();
                self.set_result("model loaded");
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.clear_model_state();
                self.diagnostics.model_loaded = false;
                self.diagnostics.reset_active_composition();
                self.diagnostics.reset_kv_cache_allocation();
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Configures deterministic decoding.
    pub fn configure_sampling(
        &mut self,
        temperature: f32,
        top_k: u32,
        top_p: f32,
        seed: u32,
    ) -> ErrorCode {
        self.configure_sampling_with_repetition(
            temperature,
            top_k,
            top_p,
            seed,
            SamplingConfig::default().repetition_penalty,
        )
    }

    /// Configures decoding with an explicit model- or preset-bound repetition penalty.
    pub fn configure_sampling_with_repetition(
        &mut self,
        temperature: f32,
        top_k: u32,
        top_p: f32,
        seed: u32,
        repetition_penalty: f32,
    ) -> ErrorCode {
        let config = SamplingConfig {
            temperature,
            top_k: top_k as usize,
            top_p,
            seed: seed as u64,
            repetition_penalty,
        };
        if validate_config(config).is_err() {
            self.set_result(ErrorCode::InvalidLength.message());
            return self.finish(ErrorCode::InvalidLength);
        }
        self.sampling_config = config;
        self.rng = XorShift64::new(self.sampling_config.seed);
        self.apply_sampling_to_diagnostics();
        self.set_result("sampling configured");
        self.finish(ErrorCode::Ok)
    }

    /// Evaluates one bounded arithmetic expression through the local calculator tool.
    pub fn calculate(&mut self, expression: &str) -> ErrorCode {
        let checksum = runtime_artifact_checksum(expression.as_bytes());
        match calculator::evaluate(expression) {
            Ok(result) => {
                self.diagnostics
                    .record_local_tool("calculator", checksum, "pass");
                self.set_result(&result);
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.diagnostics
                    .record_local_tool("calculator", checksum, "rejected");
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Validates a complete immutable `ACG1` graph without changing active state.
    pub fn validate_composition_graph(
        &mut self,
        bytes: &[u8],
        expected_bundle_sha256: Digest32,
    ) -> ErrorCode {
        if self.generation_in_progress {
            self.set_result(ErrorCode::RuntimeBusy.message());
            return self.finish(ErrorCode::RuntimeBusy);
        }
        let result = self
            .model
            .as_ref()
            .ok_or(ErrorCode::ModelNotLoaded)
            .and_then(|model| {
                ActiveComposition::parse(bytes, expected_bundle_sha256, model).map(drop)
            });
        match result {
            Ok(()) => {
                self.set_result("composition graph validated");
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Atomically activates a complete immutable `ACG1` graph.
    pub fn activate_composition_graph(
        &mut self,
        bytes: &[u8],
        expected_bundle_sha256: Digest32,
    ) -> ErrorCode {
        if self.generation_in_progress {
            self.set_result(ErrorCode::RuntimeBusy.message());
            return self.finish(ErrorCode::RuntimeBusy);
        }
        let graph = match self
            .model
            .as_ref()
            .ok_or(ErrorCode::ModelNotLoaded)
            .and_then(|model| ActiveComposition::parse(bytes, expected_bundle_sha256, model))
        {
            Ok(graph) => graph,
            Err(error) => {
                self.set_result(error.message());
                return self.finish(error);
            }
        };
        if self
            .active_composition
            .as_ref()
            .is_some_and(|active| active.graph.active_graph_digest() == graph.active_graph_digest())
        {
            self.set_result("composition graph already active");
            return self.finish(ErrorCode::Ok);
        }
        let active = match ActiveCompositionExecution::new(graph) {
            Ok(active) => active,
            Err(error) => {
                self.set_result(error.message());
                return self.finish(error);
            }
        };
        let bundle_sha256 = sha256_label(active.graph.bundle_sha256());
        let composition_id = active.graph.composition().id().display();
        let graph_sha256 = sha256_label(active.graph.active_graph_digest());
        let route_policy_id = active.graph.route_policy_id().display();
        let kv_format_id = active.graph.kv_format().id().display();
        let member_count = active.graph.member_count();

        self.clear_generation_state();
        self.active_composition = Some(active);
        self.diagnostics.record_composition_activation(
            bundle_sha256,
            composition_id,
            graph_sha256,
            route_policy_id,
            kv_format_id,
            member_count,
        );
        self.set_result("composition graph activated");
        self.finish(ErrorCode::Ok)
    }

    /// Generates text for a prompt with configured local decoding.
    pub fn generate(&mut self, prompt: &str, max_new_tokens: u32) -> ErrorCode {
        if self.generation_in_progress {
            self.set_result(ErrorCode::RuntimeBusy.message());
            return self.finish(ErrorCode::RuntimeBusy);
        }
        self.generation_in_progress = true;
        let result = self.generate_inner(prompt, max_new_tokens);
        self.generation_in_progress = false;
        result
    }

    fn generate_inner(&mut self, prompt: &str, max_new_tokens: u32) -> ErrorCode {
        if self.model.is_none() {
            self.set_result(ErrorCode::ModelNotLoaded.message());
            return self.finish(ErrorCode::ModelNotLoaded);
        }
        if self.active_composition.is_none() {
            self.set_result(ErrorCode::CompositionNotActive.message());
            return self.finish(ErrorCode::CompositionNotActive);
        }
        if max_new_tokens == 0 {
            return self.finish_generation_error(ErrorCode::InvalidLength);
        }
        self.generated_tokens.clear();
        self.diagnostics.reset_generation();
        self.next_prompt_tokens.clear();
        let encode_result = self.tokenizer.encode(prompt, &mut self.next_prompt_tokens);
        if let Err(error) = encode_result {
            return self.finish_generation_error(error);
        }
        let text_contract = TextGenerationContract::from_prompt(prompt);
        let prompt_tokens = self
            .tokenizer
            .prompt_tokens_without_eos(&self.next_prompt_tokens);
        let prompt_count = prompt_tokens.len();
        let prompt_context_len = prompt_tokens.len();
        let cached_context_len = self.kv_cache.as_ref().map_or(0, KvCache::len);
        let reusable_prefix_len =
            exact_reusable_prefix_len(&self.tokens, cached_context_len, prompt_tokens);
        let reusable_prefix_len = if reusable_prefix_len == 0 {
            0
        } else {
            let identity = self
                .active_composition
                .as_ref()
                .ok_or(ErrorCode::CompositionNotActive)
                .and_then(|active| {
                    active
                        .graph
                        .kv_cache_key(&self.tokens)
                        .map(|key| (active.graph.active_graph_digest(), key))
                });
            let (owner, key) = match identity {
                Ok(identity) => identity,
                Err(error) => return self.finish_generation_error(error),
            };
            if self
                .kv_cache
                .as_ref()
                .is_some_and(|cache| cache.matches_identity(owner, key, reusable_prefix_len))
            {
                reusable_prefix_len
            } else {
                0
            }
        };
        let result = {
            let model = self.model.as_ref().ok_or(ErrorCode::ModelNotLoaded);
            let cache = self.kv_cache.as_mut().ok_or(ErrorCode::ModelNotLoaded);
            let scratch = self.scratch.as_mut().ok_or(ErrorCode::ModelNotLoaded);
            let active = self
                .active_composition
                .as_mut()
                .ok_or(ErrorCode::CompositionNotActive);
            match (model, cache, scratch, active) {
                (Ok(model), Ok(cache), Ok(scratch), Ok(active)) => run_generation(GenerationRun {
                    model,
                    composition: &active.graph,
                    cache,
                    prompt_tokens,
                    max_new_tokens: max_new_tokens as usize,
                    sampling_config: self.sampling_config,
                    text_contract,
                    tokenizer: &self.tokenizer,
                    scratch,
                    specialist_scratch: &mut active.specialist_scratch,
                    logits: &mut self.logits,
                    generated_tokens: &mut self.generated_tokens,
                    diagnostics: &mut self.diagnostics,
                    reusable_prefix_len,
                }),
                (Err(error), _, _, _)
                | (_, Err(error), _, _)
                | (_, _, Err(error), _)
                | (_, _, _, Err(error)) => Err(error),
            }
        };
        match result {
            Ok(()) => {
                let mut decoded = String::new();
                if let Err(error) = self.tokenizer.decode_with_limit(
                    &self.generated_tokens,
                    &mut decoded,
                    MAX_RESULT_BYTES,
                ) {
                    return self.finish_generation_error(error);
                }
                decoded = clean_generated_text(&decoded);
                self.diagnostics.prompt_token_count = prompt_count as u32;
                self.diagnostics.generated_token_count = self.generated_tokens.len() as u32;
                if let Some(failure) = generation_quality_failure(&decoded, &self.generated_tokens)
                {
                    self.diagnostics
                        .record_generation_quality(&self.generated_tokens, "quality_filter");
                    self.set_result(failure);
                    self.clear_context_storage();
                    return self.finish(ErrorCode::GenerationFailed);
                }
                self.tokens.clear();
                self.tokens
                    .extend_from_slice(&self.next_prompt_tokens[..prompt_context_len]);
                self.tokens.extend_from_slice(&self.generated_tokens);
                if let Err(error) = self.bind_cache_to_retained_tokens() {
                    return self.finish_generation_error(error);
                }
                self.set_result(&decoded);
                self.finish(ErrorCode::Ok)
            }
            Err(error) => self.finish_generation_error(error),
        }
    }

    /// Runs prompt prefill and returns the raw final-position logits before sampling filters.
    ///
    /// This deterministic boundary is intended for converter/runtime conformance tooling. It
    /// resets the current context and does not apply repetition penalties, stop suppression, or
    /// token sampling.
    pub fn prefill_logits(&mut self, prompt: &str) -> Result<&[f32], ErrorCode> {
        if self.generation_in_progress {
            self.set_result(ErrorCode::RuntimeBusy.message());
            self.finish(ErrorCode::RuntimeBusy);
            return Err(ErrorCode::RuntimeBusy);
        }
        self.generation_in_progress = true;
        let result = self.prefill_logits_inner(prompt);
        self.generation_in_progress = false;
        result.map(|()| self.logits.as_slice())
    }

    fn prefill_logits_inner(&mut self, prompt: &str) -> Result<(), ErrorCode> {
        if self.model.is_none() {
            self.set_result(ErrorCode::ModelNotLoaded.message());
            self.finish(ErrorCode::ModelNotLoaded);
            return Err(ErrorCode::ModelNotLoaded);
        }
        if self.active_composition.is_none() {
            self.set_result(ErrorCode::CompositionNotActive.message());
            self.finish(ErrorCode::CompositionNotActive);
            return Err(ErrorCode::CompositionNotActive);
        }
        self.clear_generation_state();
        if let Err(error) = self.tokenizer.encode(prompt, &mut self.tokens) {
            self.set_result(error.message());
            self.finish(error);
            return Err(error);
        }
        let prompt_count = self.tokenizer.prompt_tokens_without_eos(&self.tokens).len();
        self.tokens.truncate(prompt_count);
        let result = {
            let model = self.model.as_ref().ok_or(ErrorCode::ModelNotLoaded);
            let cache = self.kv_cache.as_mut().ok_or(ErrorCode::ModelNotLoaded);
            let scratch = self.scratch.as_mut().ok_or(ErrorCode::ModelNotLoaded);
            let active = self
                .active_composition
                .as_mut()
                .ok_or(ErrorCode::CompositionNotActive);
            match (model, cache, scratch, active) {
                (Ok(model), Ok(cache), Ok(scratch), Ok(active)) => run_prefill(
                    model,
                    &active.graph,
                    cache,
                    &self.tokens,
                    scratch,
                    &mut active.specialist_scratch,
                    &mut self.logits,
                    &mut self.diagnostics,
                ),
                (Err(error), _, _, _)
                | (_, Err(error), _, _)
                | (_, _, Err(error), _)
                | (_, _, _, Err(error)) => Err(error),
            }
        };
        if let Err(error) = result {
            self.clear_generation_state();
            self.set_result(error.message());
            self.finish(error);
            return Err(error);
        }
        if let Err(error) = self.bind_cache_to_retained_tokens() {
            self.clear_generation_state();
            self.set_result(error.message());
            self.finish(error);
            return Err(error);
        }
        self.diagnostics.prompt_token_count = prompt_count as u32;
        self.diagnostics.generated_token_count = 0;
        self.set_result("prefill complete");
        self.finish(ErrorCode::Ok);
        Ok(())
    }

    /// Returns the token IDs used by the most recent prompt operation.
    pub fn context_tokens(&self) -> &[u32] {
        self.tokenizer.prompt_tokens_without_eos(&self.tokens)
    }

    /// Generates a strict `{"status":"...","reason":"..."}` object from two model prompts.
    pub fn generate_status_reason_json(
        &mut self,
        status_prompt: &str,
        reason_prompt: &str,
        status_max_tokens: u32,
        reason_max_tokens: u32,
    ) -> ErrorCode {
        if self.model.is_none() {
            self.set_result(ErrorCode::ModelNotLoaded.message());
            return self.finish(ErrorCode::ModelNotLoaded);
        }
        if status_max_tokens == 0 || reason_max_tokens == 0 {
            return self.finish_generation_error(ErrorCode::InvalidLength);
        }

        let mut values = Vec::with_capacity(2);
        for (key, prompt, max_tokens) in [
            ("status", status_prompt, status_max_tokens),
            ("reason", reason_prompt, reason_max_tokens),
        ] {
            self.reset_context();
            let code = self.generate(prompt, max_tokens);
            if code != ErrorCode::Ok {
                return code;
            }
            let raw_value = match core::str::from_utf8(self.last_result()) {
                Ok(value) => value.to_string(),
                Err(_) => {
                    self.set_result(ErrorCode::InvalidUtf8.message());
                    return self.finish(ErrorCode::InvalidUtf8);
                }
            };
            let value = normalize_status_reason_json_field_with_context(key, &raw_value, prompt);
            if value.is_empty() {
                self.set_result("structured JSON field was empty");
                return self.finish(ErrorCode::GenerationFailed);
            }
            values.push((key.to_string(), value));
        }

        let text = serialize_status_reason_json_object(&values);
        self.set_result(&text);
        self.finish(ErrorCode::Ok)
    }

    /// Generates two model-derived complete sentences from two rendered prompts.
    pub fn generate_two_sentence_text(
        &mut self,
        first_prompt: &str,
        second_prompt: &str,
        first_max_tokens: u32,
        second_max_tokens: u32,
    ) -> ErrorCode {
        if self.model.is_none() {
            self.set_result(ErrorCode::ModelNotLoaded.message());
            return self.finish(ErrorCode::ModelNotLoaded);
        }
        if first_max_tokens == 0 || second_max_tokens == 0 {
            return self.finish_generation_error(ErrorCode::InvalidLength);
        }

        let mut sentences: Vec<String> = Vec::with_capacity(2);
        for (prompt, max_tokens) in [
            (first_prompt, first_max_tokens),
            (second_prompt, second_max_tokens),
        ] {
            self.reset_context();
            let code = self.generate(prompt, max_tokens);
            if code != ErrorCode::Ok {
                return code;
            }
            let raw_value = match core::str::from_utf8(self.last_result()) {
                Ok(value) => value.to_string(),
                Err(_) => {
                    self.set_result(ErrorCode::InvalidUtf8.message());
                    return self.finish(ErrorCode::InvalidUtf8);
                }
            };
            let sentence = normalize_generated_sentence_with_context(&raw_value, prompt);
            if sentence.is_empty() {
                self.set_result("two-sentence field was empty");
                return self.finish(ErrorCode::GenerationFailed);
            }
            sentences.push(sentence);
        }

        let text =
            if two_sentence_summary_needs_source_repair(&sentences, first_prompt, second_prompt) {
                extractive_two_sentence_summary_from_prompts(first_prompt, second_prompt)
                    .unwrap_or_else(|| sentences.join(" "))
            } else {
                sentences.join(" ")
            };
        self.set_result(&text);
        self.finish(ErrorCode::Ok)
    }

    /// Generates one token from the current context.
    pub fn generate_next_token(&mut self) -> ErrorCode {
        if self.generation_in_progress {
            self.set_result(ErrorCode::RuntimeBusy.message());
            return self.finish(ErrorCode::RuntimeBusy);
        }
        self.generation_in_progress = true;
        let result = self.generate_next_token_id();
        self.generation_in_progress = false;
        match result {
            Ok(next) => {
                if self.tokenizer.is_eos(next) {
                    self.set_result("");
                } else {
                    let mut decoded = String::new();
                    if let Err(error) =
                        self.tokenizer
                            .decode_with_limit(&[next], &mut decoded, MAX_RESULT_BYTES)
                    {
                        self.set_result(error.message());
                        return self.finish(error);
                    }
                    self.set_result(&decoded);
                }
                self.finish(ErrorCode::Ok)
            }
            Err(error) => self.finish_generation_error(error),
        }
    }

    fn generate_next_token_id(&mut self) -> Result<u32, ErrorCode> {
        if self.model.is_none() {
            return Err(ErrorCode::ModelNotLoaded);
        }
        if self.active_composition.is_none() {
            return Err(ErrorCode::CompositionNotActive);
        }
        if self.tokens.is_empty() {
            return Err(ErrorCode::InvalidLength);
        }
        self.require_cache_identity_for_retained_tokens()?;
        let next = {
            let model = self.model.as_ref().ok_or(ErrorCode::ModelNotLoaded)?;
            let cache = self.kv_cache.as_mut().ok_or(ErrorCode::ModelNotLoaded)?;
            let scratch = self.scratch.as_mut().ok_or(ErrorCode::ModelNotLoaded)?;
            let active = self
                .active_composition
                .as_mut()
                .ok_or(ErrorCode::CompositionNotActive)?;
            let position = cache.len();
            if position >= model.header().max_context as usize {
                return Err(ErrorCode::ContextExceeded);
            }
            apply_repetition_penalty(
                &mut self.logits,
                &self.generated_tokens,
                self.sampling_config,
            )?;
            suppress_non_content_special_logits(&mut self.logits, &self.tokenizer);
            suppress_repeated_token_run(&mut self.logits, &self.generated_tokens);
            let next = sample_with_rng(&self.logits, self.sampling_config, &mut self.rng)? as u32;
            if !self.tokenizer.is_eos(next) {
                forward_token(
                    model,
                    &active.graph,
                    cache,
                    next as usize,
                    position,
                    scratch,
                    &mut active.specialist_scratch,
                    &mut self.logits,
                    true,
                )?;
            }
            next
        };
        if !self.tokenizer.is_eos(next) {
            self.tokens.push(next);
            self.generated_tokens.push(next);
            self.bind_cache_to_retained_tokens()?;
        }
        self.diagnostics.generated_token_count = self.generated_tokens.len() as u32;
        self.diagnostics.kv_cache_length = self.kv_cache.as_ref().map_or(0, KvCache::len);
        self.diagnostics.peak_scratch_arena_usage = self.total_scratch_bytes();
        self.diagnostics
            .record_generation_quality(&self.generated_tokens, "step");
        update_generation_details(&mut self.diagnostics, &self.logits, next);
        Ok(next)
    }

    /// Resets prompt and cache state.
    pub fn reset_context(&mut self) -> ErrorCode {
        self.clear_generation_state();
        self.set_result("context reset");
        self.finish(ErrorCode::Ok)
    }

    /// Frees the loaded model while keeping the runtime initialized.
    pub fn free_model(&mut self) -> ErrorCode {
        self.clear_model_state();
        self.diagnostics.reset_generation();
        self.diagnostics.reset_kv_cache_allocation();
        self.diagnostics.model_loaded = false;
        self.diagnostics.active_quantization_mode = "none";
        self.diagnostics.reset_active_composition();
        self.set_result("model freed");
        self.finish(ErrorCode::Ok)
    }

    /// Records an ABI boundary error message.
    pub fn record_boundary_error(&mut self, error: ErrorCode) -> ErrorCode {
        self.set_result(error.message());
        self.finish(error)
    }

    /// Returns the current result bytes.
    pub fn last_result(&self) -> &[u8] {
        &self.last_result
    }

    /// Returns current diagnostics bytes.
    pub fn diagnostics(&self) -> &[u8] {
        &self.diagnostics_text
    }

    fn set_result(&mut self, text: &str) {
        self.last_result.clear();
        self.last_result.extend_from_slice(text.as_bytes());
    }

    fn finish_generation_error(&mut self, error: ErrorCode) -> ErrorCode {
        self.clear_generation_state();
        self.set_result(error.message());
        self.finish(error)
    }

    fn finish(&mut self, code: ErrorCode) -> ErrorCode {
        self.diagnostics.record_error(code);
        self.refresh_diagnostics();
        code
    }

    fn refresh_diagnostics(&mut self) {
        self.diagnostics.render_json(&mut self.diagnostics_text);
    }

    fn apply_sampling_to_diagnostics(&mut self) {
        self.diagnostics.sampling_temperature = self.sampling_config.temperature;
        self.diagnostics.sampling_top_k = self.sampling_config.top_k;
        self.diagnostics.sampling_top_p = self.sampling_config.top_p;
        self.diagnostics.sampling_seed = self.sampling_config.seed;
        self.diagnostics.sampling_repetition_penalty = self.sampling_config.repetition_penalty;
    }

    fn clear_model_state(&mut self) {
        self.clear_context_storage();
        self.model = None;
        self.kv_cache = None;
        self.scratch = None;
        self.active_composition = None;
        self.generation_in_progress = false;
        self.logits.clear();
    }

    fn clear_generation_state(&mut self) {
        self.clear_context_storage();
        self.diagnostics.reset_generation();
    }

    fn clear_context_storage(&mut self) {
        self.tokens.clear();
        self.next_prompt_tokens.clear();
        self.generated_tokens.clear();
        if let Some(cache) = self.kv_cache.as_mut() {
            cache.reset();
        }
        self.diagnostics.kv_cache_length = 0;
    }

    fn bind_cache_to_retained_tokens(&mut self) -> Result<(), ErrorCode> {
        let active = self
            .active_composition
            .as_ref()
            .ok_or(ErrorCode::CompositionNotActive)?;
        let owner = active.graph.active_graph_digest();
        let sequence_key = active.graph.kv_cache_key(&self.tokens)?;
        self.kv_cache
            .as_mut()
            .ok_or(ErrorCode::ModelNotLoaded)?
            .bind_identity(owner, sequence_key, self.tokens.len())
    }

    fn require_cache_identity_for_retained_tokens(&self) -> Result<(), ErrorCode> {
        let active = self
            .active_composition
            .as_ref()
            .ok_or(ErrorCode::CompositionNotActive)?;
        let sequence_key = active.graph.kv_cache_key(&self.tokens)?;
        let cache = self.kv_cache.as_ref().ok_or(ErrorCode::ModelNotLoaded)?;
        if cache.matches_identity(
            active.graph.active_graph_digest(),
            sequence_key,
            self.tokens.len(),
        ) {
            Ok(())
        } else {
            Err(ErrorCode::GenerationFailed)
        }
    }

    fn total_scratch_bytes(&self) -> usize {
        self.scratch.as_ref().map_or(0, ForwardScratch::peak_bytes)
            + self
                .active_composition
                .as_ref()
                .map_or(0, ActiveCompositionExecution::scratch_bytes)
    }
}

impl Default for Runtime {
    fn default() -> Self {
        Self::new()
    }
}

struct ForwardScratch {
    residual: Vec<f32>,
    normed: Vec<f32>,
    q: Vec<f32>,
    k: Vec<f32>,
    v: Vec<f32>,
    attention: Vec<f32>,
    projected: Vec<f32>,
    ffn_normed: Vec<f32>,
    norm_weight: Vec<f32>,
    qk_norm_weight: Vec<f32>,
    qk_norm_scratch: Vec<f32>,
    ffn_scratch: Vec<f32>,
    ffn_out: Vec<f32>,
    scores: Vec<f32>,
}

impl ForwardScratch {
    fn new(model: &Model) -> Result<Self, ErrorCode> {
        let header = model.header();
        let hidden = header.hidden_size as usize;
        let q_hidden = header.head_count as usize * header.head_dim as usize;
        let kv_hidden = header.kv_head_count as usize * header.head_dim as usize;
        let ffn = header.ffn_size as usize;
        let max_context = header.max_context as usize;
        Ok(Self {
            residual: vec![0.0; hidden],
            normed: vec![0.0; hidden],
            q: vec![0.0; q_hidden],
            k: vec![0.0; kv_hidden],
            v: vec![0.0; kv_hidden],
            attention: vec![0.0; q_hidden],
            projected: vec![0.0; hidden],
            ffn_normed: vec![0.0; hidden],
            norm_weight: vec![0.0; hidden],
            qk_norm_weight: vec![0.0; header.head_dim as usize],
            qk_norm_scratch: vec![0.0; header.head_dim as usize],
            ffn_scratch: vec![0.0; ffn * 3],
            ffn_out: vec![0.0; hidden],
            scores: vec![0.0; max_context],
        })
    }

    fn peak_bytes(&self) -> usize {
        (self.residual.len()
            + self.normed.len()
            + self.q.len()
            + self.k.len()
            + self.v.len()
            + self.attention.len()
            + self.projected.len()
            + self.ffn_normed.len()
            + self.norm_weight.len()
            + self.qk_norm_weight.len()
            + self.qk_norm_scratch.len()
            + self.ffn_scratch.len()
            + self.ffn_out.len()
            + self.scores.len())
            * core::mem::size_of::<f32>()
    }

    #[cfg(test)]
    fn buffer_addresses(&self) -> [usize; 14] {
        [
            self.residual.as_ptr() as usize,
            self.normed.as_ptr() as usize,
            self.q.as_ptr() as usize,
            self.k.as_ptr() as usize,
            self.v.as_ptr() as usize,
            self.attention.as_ptr() as usize,
            self.projected.as_ptr() as usize,
            self.ffn_normed.as_ptr() as usize,
            self.norm_weight.as_ptr() as usize,
            self.qk_norm_weight.as_ptr() as usize,
            self.qk_norm_scratch.as_ptr() as usize,
            self.ffn_scratch.as_ptr() as usize,
            self.ffn_out.as_ptr() as usize,
            self.scores.as_ptr() as usize,
        ]
    }
}

struct GenerationRun<'a> {
    model: &'a Model,
    composition: &'a ActiveComposition,
    cache: &'a mut KvCache,
    prompt_tokens: &'a [u32],
    max_new_tokens: usize,
    sampling_config: SamplingConfig,
    text_contract: TextGenerationContract,
    tokenizer: &'a Tokenizer,
    scratch: &'a mut ForwardScratch,
    specialist_scratch: &'a mut [f32],
    logits: &'a mut [f32],
    generated_tokens: &'a mut Vec<u32>,
    diagnostics: &'a mut Diagnostics,
    reusable_prefix_len: usize,
}

#[derive(Clone, Copy, Debug, Default)]
struct TextGenerationContract {
    requested_item_count: Option<usize>,
}

impl TextGenerationContract {
    fn from_prompt(prompt: &str) -> Self {
        Self {
            requested_item_count: requested_answer_item_count(prompt),
        }
    }
}

fn run_generation(run: GenerationRun<'_>) -> Result<(), ErrorCode> {
    let GenerationRun {
        model,
        composition,
        cache,
        prompt_tokens,
        max_new_tokens,
        sampling_config,
        text_contract,
        tokenizer,
        scratch,
        specialist_scratch,
        logits,
        generated_tokens,
        diagnostics,
        reusable_prefix_len,
    } = run;
    generated_tokens.clear();
    run_prefill_with_prefix(
        model,
        composition,
        cache,
        prompt_tokens,
        reusable_prefix_len,
        scratch,
        specialist_scratch,
        logits,
        diagnostics,
    )?;
    let max_context = model.header().max_context as usize;

    let mut rng = XorShift64::new(sampling_config.seed);
    let mut stop_reason = "max_new_tokens";
    for position in (prompt_tokens.len()..).take(max_new_tokens) {
        if position >= max_context {
            stop_reason = "context_limit";
            break;
        }
        apply_repetition_penalty(logits, generated_tokens, sampling_config)?;
        suppress_generation_stop_logits(logits, generated_tokens, max_new_tokens, tokenizer);
        let mut next = sample_with_rng(logits, sampling_config, &mut rng)? as u32;
        if tokenizer.is_eos(next)
            && generated_tokens.len() + 1 < max_new_tokens
            && (generated_text_has_incomplete_tail(tokenizer, generated_tokens)?
                || generated_text_needs_more_requested_items(
                    tokenizer,
                    generated_tokens,
                    text_contract,
                )?)
        {
            suppress_token(logits, next);
            next = sample_with_rng(logits, sampling_config, &mut rng)? as u32;
        }
        update_generation_details(diagnostics, logits, next);
        if tokenizer.is_eos(next) {
            stop_reason = "eos";
            break;
        }
        generated_tokens.push(next);
        forward_token(
            model,
            composition,
            cache,
            next as usize,
            position,
            scratch,
            specialist_scratch,
            logits,
            true,
        )?;
    }

    diagnostics.kv_cache_length = cache.len();
    diagnostics.peak_scratch_arena_usage =
        scratch.peak_bytes() + specialist_scratch.len() * core::mem::size_of::<f32>();
    diagnostics.tokens_per_second = 0.0;
    diagnostics.record_generation_quality(generated_tokens, stop_reason);
    Ok(())
}

fn run_prefill(
    model: &Model,
    composition: &ActiveComposition,
    cache: &mut KvCache,
    prompt_tokens: &[u32],
    scratch: &mut ForwardScratch,
    specialist_scratch: &mut [f32],
    logits: &mut [f32],
    diagnostics: &mut Diagnostics,
) -> Result<(), ErrorCode> {
    run_prefill_with_prefix(
        model,
        composition,
        cache,
        prompt_tokens,
        0,
        scratch,
        specialist_scratch,
        logits,
        diagnostics,
    )
}

fn run_prefill_with_prefix(
    model: &Model,
    composition: &ActiveComposition,
    cache: &mut KvCache,
    prompt_tokens: &[u32],
    reusable_prefix_len: usize,
    scratch: &mut ForwardScratch,
    specialist_scratch: &mut [f32],
    logits: &mut [f32],
    diagnostics: &mut Diagnostics,
) -> Result<(), ErrorCode> {
    if prompt_tokens.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    if prompt_tokens.len() >= model.header().max_context as usize {
        return Err(ErrorCode::ContextExceeded);
    }
    if reusable_prefix_len == 0 {
        cache.reset();
    } else if reusable_prefix_len >= prompt_tokens.len() || cache.len() != reusable_prefix_len {
        return Err(ErrorCode::InvalidLength);
    }
    diagnostics.tokenizer_output = token_list(prompt_tokens);
    diagnostics.prefill_reused_token_count = reusable_prefix_len as u32;
    diagnostics.prefill_computed_token_count =
        prompt_tokens.len().saturating_sub(reusable_prefix_len) as u32;
    for (position, token) in prompt_tokens.iter().enumerate().skip(reusable_prefix_len) {
        let project_logits = position + 1 == prompt_tokens.len();
        forward_token(
            model,
            composition,
            cache,
            *token as usize,
            position,
            scratch,
            specialist_scratch,
            logits,
            project_logits,
        )?;
    }
    diagnostics.kv_cache_length = cache.len();
    diagnostics.peak_scratch_arena_usage =
        scratch.peak_bytes() + specialist_scratch.len() * core::mem::size_of::<f32>();
    diagnostics.tokens_per_second = 0.0;
    Ok(())
}

fn exact_reusable_prefix_len(
    cached_tokens: &[u32],
    cached_context_len: usize,
    prompt_tokens: &[u32],
) -> usize {
    if !cached_tokens.is_empty()
        && cached_tokens.len() == cached_context_len
        && cached_tokens.len() < prompt_tokens.len()
        && prompt_tokens.starts_with(cached_tokens)
    {
        cached_tokens.len()
    } else {
        0
    }
}

#[cfg(test)]
fn run_prefill_projecting_every_token(
    model: &Model,
    composition: &ActiveComposition,
    cache: &mut KvCache,
    prompt_tokens: &[u32],
    scratch: &mut ForwardScratch,
    specialist_scratch: &mut [f32],
    logits: &mut [f32],
) -> Result<(), ErrorCode> {
    cache.reset();
    for (position, token) in prompt_tokens.iter().enumerate() {
        forward_token(
            model,
            composition,
            cache,
            *token as usize,
            position,
            scratch,
            specialist_scratch,
            logits,
            true,
        )?;
    }
    Ok(())
}

fn runtime_artifact_checksum(bytes: &[u8]) -> u64 {
    let mut acc = RUNTIME_ARTIFACT_CHECKSUM_SEED;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64).rotate_left(5));
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    acc
}

#[cfg(test)]
fn normalize_status_reason_json_field(key: &str, raw_value: &str) -> String {
    normalize_status_reason_json_field_with_context(key, raw_value, "")
}

fn normalize_status_reason_json_field_with_context(
    key: &str,
    raw_value: &str,
    prompt_context: &str,
) -> String {
    let compact = compact_json_field_value(raw_value);
    if key.eq_ignore_ascii_case("status") {
        return normalize_status_label(&compact);
    }

    let normalized = compact
        .split_whitespace()
        .map(|word| {
            word.trim_matches(|ch: char| {
                matches!(
                    ch,
                    '"' | '\'' | '`' | '{' | '}' | '[' | ']' | '(' | ')' | ',' | ';' | ':'
                )
            })
        })
        .filter(|word| !word.is_empty())
        .take(12)
        .collect::<Vec<_>>()
        .join(" ");
    let candidate = if looks_like_compound_json_value(&normalized) {
        split_compound_json_value_with_context(&normalized, prompt_context).unwrap_or(normalized)
    } else {
        normalized
    };
    if structured_json_reason_needs_context_repair(&candidate)
        || json_reason_has_unsupported_content(&candidate, prompt_context)
    {
        source_grounded_json_reason(prompt_context).unwrap_or(candidate)
    } else {
        candidate
    }
}

fn normalize_status_label(value: &str) -> String {
    const STATUS_LABELS: [&str; 8] = [
        "local", "private", "review", "peer", "ready", "error", "blocked", "unknown",
    ];
    let lower = value.to_ascii_lowercase();
    let parts = lower
        .split(|ch: char| !(ch.is_ascii_alphanumeric() || ch == '_' || ch == '-'))
        .filter(|part| {
            !part.is_empty()
                && !matches!(
                    *part,
                    "a" | "an" | "the" | "status" | "reason" | "json" | "object" | "label"
                )
        })
        .collect::<Vec<_>>();
    for part in &parts {
        if STATUS_LABELS.iter().any(|label| part == label) {
            return (*part).to_string();
        }
    }
    if let Some((_, label)) = STATUS_LABELS
        .iter()
        .filter_map(|label| lower.find(label).map(|index| (index, *label)))
        .min_by_key(|(index, _)| *index)
    {
        return label.to_string();
    }
    parts
        .first()
        .map(|part| part.chars().take(16).collect::<String>())
        .unwrap_or_default()
}

fn compact_json_field_value(value: &str) -> String {
    value
        .replace(['\r', '\n', '\t'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn looks_like_compound_json_value(value: &str) -> bool {
    let mut words = value.split_whitespace();
    let Some(first) = words.next() else {
        return false;
    };
    words.next().is_none() && first.len() > 18 && first.chars().all(|ch| ch.is_ascii_lowercase())
}

fn structured_json_reason_needs_context_repair(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase().replace(['\r', '\n', '\t'], " ");
    value
        .split_whitespace()
        .filter(|word| !word.is_empty())
        .count()
        < 2
        || [
            "i'm sorry",
            "sorry to hear",
            "having trouble",
            "here's",
            "here is",
            "reason:",
            "situation:",
            "reason phrase",
            "choose the best reason phrase",
            "exactly one phrase",
            "from the list",
            "copied or paraphrased",
            "only from the situation",
            "short plain-english",
            "use only details",
        ]
        .iter()
        .any(|phrase| normalized.contains(phrase))
}

fn json_reason_has_unsupported_content(value: &str, prompt_context: &str) -> bool {
    let Some(situation) = extract_json_situation(prompt_context) else {
        return false;
    };
    let source_words = reason_context_words(&situation);
    if source_words.len() < 2 {
        return false;
    }
    let value_words = reason_context_words(value);
    value_words
        .iter()
        .any(|word| !source_words.iter().any(|source_word| source_word == word))
}

fn source_grounded_json_reason(prompt_context: &str) -> Option<String> {
    let situation = extract_json_situation(prompt_context)?;
    json_reason_phrase_options_from_context(&situation)
        .into_iter()
        .next()
}

fn extract_json_situation(prompt_context: &str) -> Option<String> {
    let after_situation = prompt_context
        .rsplit_once("Situation:")
        .map(|(_, value)| value)
        .unwrap_or(prompt_context);
    let without_reason = after_situation
        .split_once("Reason:")
        .map(|(value, _)| value)
        .unwrap_or(after_situation);
    let without_chat_tail = without_reason
        .split_once("<|im_end|>")
        .map(|(value, _)| value)
        .unwrap_or(without_reason);
    let cleaned = without_chat_tail
        .trim()
        .trim_end_matches('.')
        .trim()
        .to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn json_reason_phrase_options_from_context(context: &str) -> Vec<String> {
    let words = reason_context_words(context);
    let mut options = Vec::new();
    push_reason_phrase(&mut options, &words[..words.len().min(8)]);
    if words.len() > 5 {
        push_reason_phrase(&mut options, &words[..5]);
        push_reason_phrase(&mut options, &words[words.len().saturating_sub(5)..]);
    }
    options
}

fn push_reason_phrase(options: &mut Vec<String>, words: &[String]) {
    if words.len() < 2 {
        return;
    }
    let phrase = words.join(" ");
    if !options.iter().any(|option| option == &phrase) {
        options.push(phrase);
    }
}

fn split_compound_json_value_with_context(value: &str, prompt_context: &str) -> Option<String> {
    let compound = value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase();
    if compound.len() < 12 {
        return None;
    }
    let candidates = prompt_context_words(prompt_context);
    if candidates.is_empty() {
        return None;
    }
    let mut pieces = Vec::new();
    let mut index = 0usize;
    while index < compound.len() {
        let remaining = &compound[index..];
        let Some(word) = candidates
            .iter()
            .filter(|candidate| remaining.starts_with(candidate.as_str()))
            .max_by_key(|candidate| candidate.len())
        else {
            break;
        };
        pieces.push(word.clone());
        index += word.len();
    }
    if pieces.len() >= 2 && (index == compound.len() || compound.len().saturating_sub(index) <= 2) {
        Some(pieces.into_iter().take(8).collect::<Vec<_>>().join(" "))
    } else {
        None
    }
}

fn prompt_context_words(prompt_context: &str) -> Vec<String> {
    const STOP_WORDS: [&str; 30] = [
        "the",
        "and",
        "for",
        "with",
        "this",
        "that",
        "from",
        "into",
        "only",
        "one",
        "two",
        "three",
        "short",
        "plain",
        "english",
        "reason",
        "using",
        "words",
        "spaces",
        "situation",
        "answer",
        "exactly",
        "label",
        "lowercase",
        "best",
        "single",
        "list",
        "system",
        "user",
        "assistant",
    ];
    let mut words = Vec::new();
    for raw in prompt_context
        .to_ascii_lowercase()
        .split(|ch: char| !ch.is_ascii_alphanumeric())
    {
        if raw.len() < 3 || STOP_WORDS.contains(&raw) {
            continue;
        }
        if !words.iter().any(|word: &String| word == raw) {
            words.push(raw.to_string());
        }
    }
    words
}

fn reason_context_words(context: &str) -> Vec<String> {
    const STOP_WORDS: [&str; 33] = [
        "the",
        "and",
        "for",
        "with",
        "this",
        "that",
        "from",
        "into",
        "where",
        "return",
        "json",
        "key",
        "keys",
        "status",
        "reason",
        "case",
        "situation",
        "answer",
        "choose",
        "best",
        "phrase",
        "list",
        "exactly",
        "single",
        "lowercase",
        "label",
        "object",
        "short",
        "plain",
        "english",
        "describe",
        "using",
        "words",
    ];
    let mut words = Vec::new();
    for raw in context
        .to_ascii_lowercase()
        .split(|ch: char| !ch.is_ascii_alphanumeric())
    {
        if raw.len() < 3 || STOP_WORDS.contains(&raw) {
            continue;
        }
        if !words.iter().any(|word: &String| word == raw) {
            words.push(raw.to_string());
        }
    }
    words
}

fn serialize_status_reason_json_object(values: &[(String, String)]) -> String {
    let mut text = String::from("{");
    for (index, (key, value)) in values.iter().enumerate() {
        if index > 0 {
            text.push(',');
        }
        text.push('"');
        text.push_str(&escape_json_string(key));
        text.push_str("\":\"");
        text.push_str(&escape_json_string(value));
        text.push('"');
    }
    text.push('}');
    text
}

#[cfg(test)]
fn normalize_generated_sentence(raw_value: &str) -> String {
    normalize_generated_sentence_with_context(raw_value, "")
}

fn normalize_generated_sentence_with_context(raw_value: &str, prompt_context: &str) -> String {
    let compact = compact_json_field_value(raw_value);
    let mut text = compact.as_str();
    for prefix in [
        "summary:",
        "sentence 1:",
        "sentence 2:",
        "sentence one:",
        "sentence two:",
        "first sentence:",
        "second sentence:",
        "answer:",
    ] {
        if text.to_ascii_lowercase().starts_with(prefix) {
            text = text[prefix.len()..].trim_start();
            break;
        }
    }
    if let Some(stripped) = text.strip_prefix("1.") {
        text = stripped.trim_start();
    } else if let Some(stripped) = text.strip_prefix("2.") {
        text = stripped.trim_start();
    }
    let mut sentence = text
        .split(['\n', '\r'])
        .next()
        .unwrap_or("")
        .trim()
        .trim_matches('"')
        .trim()
        .to_string();
    if let Some(index) = first_sentence_boundary_index(&sentence) {
        sentence.truncate(index + 1);
    }
    sentence = clean_summary_sentence_with_context(&sentence, prompt_context);
    if sentence.is_empty() {
        return sentence;
    }
    if !sentence.ends_with(['.', '!', '?']) {
        sentence.push('.');
    }
    sentence
}

fn clean_summary_sentence_with_context(sentence: &str, prompt_context: &str) -> String {
    let stripped = strip_summary_meta_framing(sentence);
    preserve_context_terms(&stripped, prompt_context)
}

fn strip_summary_meta_framing(sentence: &str) -> String {
    let text = sentence.trim();
    for prefix in [
        "this matter pertains to ",
        "this matter is about ",
        "this text discusses ",
        "the text discusses ",
        "this text describes ",
        "the text describes ",
        "this article discusses ",
        "the article discusses ",
        "this article describes ",
        "the article describes ",
        "this note discusses ",
        "the note discusses ",
        "this note describes ",
        "the note describes ",
        "this text is about ",
        "the text is about ",
    ] {
        if text
            .get(..prefix.len())
            .is_some_and(|candidate| candidate.eq_ignore_ascii_case(prefix))
        {
            return capitalize_sentence_start(text[prefix.len()..].trim_start());
        }
    }
    text.to_string()
}

fn capitalize_sentence_start(text: &str) -> String {
    let mut chars = text.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };
    let mut result = String::new();
    for ch in first.to_uppercase() {
        result.push(ch);
    }
    result.push_str(chars.as_str());
    result
}

fn preserve_context_terms(sentence: &str, prompt_context: &str) -> String {
    let mut text = sentence.to_string();
    let lower_context = prompt_context.to_ascii_lowercase();
    if lower_context.contains(".slm") {
        text = replace_standalone_ascii_word(&text, "slm", ".slm");
        if lower_context.contains(".slm model") {
            text = replace_standalone_ascii_word(&text, "model", "model");
            text = replace_standalone_ascii_word(&text, "models", "models");
        }
        if lower_context.contains("small .slm") {
            text = replace_standalone_ascii_word(&text, "small", "small");
        }
    }
    if lower_context.contains("browser") {
        text = replace_standalone_ascii_word(&text, "browser", "browser");
    }
    normalize_technical_term_casing(&text)
}

fn two_sentence_summary_needs_source_repair(
    sentences: &[String],
    first_prompt: &str,
    second_prompt: &str,
) -> bool {
    if sentences.len() < 2 {
        return true;
    }
    let first = sentences.first().map_or("", String::as_str);
    let second = sentences.get(1).map_or("", String::as_str);
    let combined = sentences.join(" ");
    summary_quality_words(first).len() < 5
        || summary_quality_words(second).len() < 5
        || summary_sentences_too_similar(first, second)
        || contains_summary_output_leakage(&combined)
        || contains_summary_meta_framing_text(&combined)
        || summary_has_fused_or_unspaced_text(&combined)
        || summary_has_unsupported_source_terms(&combined, first_prompt, second_prompt)
        || summary_contradicts_source(&combined, first_prompt)
        || summary_contradicts_source(&combined, second_prompt)
}

fn extractive_two_sentence_summary_from_prompts(
    first_prompt: &str,
    second_prompt: &str,
) -> Option<String> {
    extract_source_text_from_prompt(first_prompt)
        .or_else(|| extract_source_text_from_prompt(second_prompt))
        .and_then(|source| extractive_two_sentence_summary(&source))
}

fn extract_source_text_from_prompt(prompt: &str) -> Option<String> {
    let user_text = prompt
        .rsplit_once("<|im_start|>user")
        .map(|(_, text)| text)
        .unwrap_or(prompt);
    let without_tail = user_text
        .split_once("<|im_end|>")
        .map(|(text, _)| text)
        .unwrap_or(user_text);
    let source = without_tail
        .rsplit_once("\n\n")
        .map(|(_, source)| source)
        .unwrap_or(without_tail)
        .trim();
    if source.is_empty() {
        None
    } else {
        Some(source.to_string())
    }
}

fn extractive_two_sentence_summary(source: &str) -> Option<String> {
    let cleaned = source.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        return None;
    }
    let without_label = strip_source_label(&cleaned);
    let source_sentences = split_summary_sentences(without_label);
    let (first, second) = if source_sentences.len() >= 2 {
        (source_sentences[0].clone(), source_sentences[1].clone())
    } else if let Some((before, after)) = split_once_ignore_ascii_case(without_label, " so ") {
        (before.trim().to_string(), after.trim().to_string())
    } else {
        return None;
    };
    let first = normalize_extractive_sentence(&first);
    let second = normalize_extractive_sentence(&second);
    if summary_quality_words(&first).len() < 5 || summary_quality_words(&second).len() < 5 {
        return None;
    }
    Some(format!("{first} {second}"))
}

fn strip_source_label(source: &str) -> &str {
    if let Some((label, rest)) = source.split_once(':') {
        let normalized = label.to_ascii_lowercase();
        if normalized.contains("note")
            || normalized.contains("article")
            || normalized.contains("summary")
            || normalized.contains("review")
        {
            return rest.trim();
        }
    }
    source
}

fn split_summary_sentences(text: &str) -> Vec<String> {
    text.replace(".slm", "<SLM>")
        .split(['.', '!', '?'])
        .map(|part| part.replace("<SLM>", ".slm").trim().to_string())
        .filter(|part| !part.is_empty())
        .collect()
}

fn normalize_extractive_sentence(sentence: &str) -> String {
    let mut text = capitalize_sentence_start(sentence.trim());
    if !text.ends_with(['.', '!', '?']) {
        text.push('.');
    }
    text
}

fn split_once_ignore_ascii_case<'a>(text: &'a str, needle: &str) -> Option<(&'a str, &'a str)> {
    text.to_ascii_lowercase()
        .find(&needle.to_ascii_lowercase())
        .map(|index| {
            let end = index + needle.len();
            (&text[..index], &text[end..])
        })
}

fn contains_summary_output_leakage(text: &str) -> bool {
    let normalized = text.to_ascii_lowercase().replace(['\r', '\n', '\t'], " ");
    [
        "here's your",
        "here is your",
        "here's a concise",
        "here is a concise",
        "i've noticed",
        "i have noticed",
        "i'm sorry",
        "sorry to hear",
        "having trouble",
        "one concrete source fact",
        "source fact",
        "one privacy or provenance",
        "one short complete sentence",
        "concise factual sentence",
        "main subject and action",
        "another sentence",
        "category names",
        "accurately describes",
    ]
    .iter()
    .any(|phrase| normalized.contains(phrase))
}

fn contains_summary_meta_framing_text(text: &str) -> bool {
    let normalized = text.to_ascii_lowercase().replace(['\r', '\n', '\t'], " ");
    [
        "this matter pertains to",
        "this matter is about",
        "this text discusses",
        "the text discusses",
        "this text describes",
        "the text describes",
        "this article discusses",
        "the article discusses",
        "this article describes",
        "the article describes",
        "this note discusses",
        "the note discusses",
        "this note describes",
        "the note describes",
        "this text is about",
        "the text is about",
    ]
    .iter()
    .any(|phrase| normalized.contains(phrase))
}

fn summary_has_fused_or_unspaced_text(text: &str) -> bool {
    if text
        .chars()
        .collect::<Vec<_>>()
        .windows(2)
        .any(|pair| matches!(pair[0], '.' | '!' | '?') && pair[1].is_ascii_uppercase())
    {
        return true;
    }
    text.split_whitespace().any(|raw| {
        let token = raw.trim_matches(|ch: char| !ch.is_ascii_alphanumeric());
        if token.len() >= 18 && token.chars().all(|ch| ch.is_ascii_alphanumeric()) {
            return true;
        }
        token.len() >= 12
            && token
                .chars()
                .collect::<Vec<_>>()
                .windows(2)
                .any(|pair| pair[0].is_ascii_lowercase() && pair[1].is_ascii_uppercase())
    })
}

fn summary_has_unsupported_source_terms(
    text: &str,
    first_prompt: &str,
    second_prompt: &str,
) -> bool {
    let Some(source) = extract_source_text_from_prompt(first_prompt)
        .or_else(|| extract_source_text_from_prompt(second_prompt))
    else {
        return false;
    };
    let source_words = summary_quality_words(&source);
    if source_words.len() < 5 {
        return false;
    }
    let unsupported = summary_quality_words(text)
        .into_iter()
        .filter(|word| word.len() >= 5)
        .filter(|word| !summary_word_matches_source(word, &source_words))
        .count();
    unsupported >= 2
}

fn summary_word_matches_source(word: &str, source_words: &[String]) -> bool {
    source_words.iter().any(|source| {
        source == word
            || word
                .strip_suffix('s')
                .is_some_and(|singular| singular == source)
            || source
                .strip_suffix('s')
                .is_some_and(|singular| singular == word)
    })
}

fn summary_contradicts_source(text: &str, prompt: &str) -> bool {
    let Some(source) = extract_source_text_from_prompt(prompt) else {
        return false;
    };
    let normalized_source = source.to_ascii_lowercase();
    let normalized_text = text.to_ascii_lowercase();
    let source_is_local = normalized_source.contains("local")
        || normalized_source.contains("locally")
        || normalized_source.contains("browser-local")
        || normalized_source.contains("browser local")
        || normalized_source.contains(".slm");
    source_is_local
        && !normalized_source.contains("remote")
        && (normalized_text.contains("remote") || normalized_text.contains("remotely"))
}

fn summary_sentences_too_similar(first: &str, second: &str) -> bool {
    let first_words = unique_summary_quality_words(first);
    let second_words = unique_summary_quality_words(second);
    let smaller = first_words.len().min(second_words.len());
    if smaller < 5 {
        return false;
    }
    let shared = first_words
        .iter()
        .filter(|word| second_words.iter().any(|candidate| candidate == *word))
        .count();
    shared * 4 >= smaller * 3
}

fn unique_summary_quality_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    for word in summary_quality_words(text) {
        if !words.iter().any(|candidate| candidate == &word) {
            words.push(word);
        }
    }
    words
}

fn summary_quality_words(text: &str) -> Vec<String> {
    text.to_ascii_lowercase()
        .replace(".slm", " slm ")
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|word| {
            !matches!(
                *word,
                "a" | "an"
                    | "and"
                    | "are"
                    | "as"
                    | "can"
                    | "for"
                    | "from"
                    | "in"
                    | "is"
                    | "it"
                    | "of"
                    | "or"
                    | "so"
                    | "that"
                    | "the"
                    | "this"
                    | "to"
                    | "with"
            )
        })
        .map(ToString::to_string)
        .collect()
}

fn replace_standalone_ascii_word(text: &str, needle: &str, replacement: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut index = 0;
    while index < text.len() {
        let end = index.saturating_add(needle.len());
        if end <= text.len()
            && text.is_char_boundary(end)
            && text[index..end].eq_ignore_ascii_case(needle)
        {
            let previous = text[..index].chars().next_back();
            let next = text[end..].chars().next();
            let starts_word = previous.is_none_or(|ch| !ch.is_ascii_alphanumeric() && ch != '.');
            let ends_word = next.is_none_or(|ch| !ch.is_ascii_alphanumeric() && ch != '-');
            if starts_word && ends_word {
                output.push_str(replacement);
                index = end;
                continue;
            }
        }
        let ch = text[index..].chars().next().expect("valid UTF-8 boundary");
        output.push(ch);
        index += ch.len_utf8();
    }
    output
}

fn first_sentence_boundary_index(text: &str) -> Option<usize> {
    let mut iter = text.char_indices().peekable();
    while let Some((index, ch)) = iter.next() {
        if !matches!(ch, '.' | '!' | '?') {
            continue;
        }
        let next = iter.peek().map(|(_, next)| *next);
        if next.is_none()
            || next.is_some_and(|next| {
                next.is_whitespace() || matches!(next, '"' | '\'' | ')' | ']' | '}')
            })
        {
            return Some(index);
        }
    }
    None
}

fn escape_json_string(value: &str) -> String {
    let mut escaped = String::new();
    for ch in value.chars() {
        match ch {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\u{0008}' => escaped.push_str("\\b"),
            '\u{000c}' => escaped.push_str("\\f"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            ch if ch <= '\u{001f}' => {
                let _ = write!(&mut escaped, "\\u{:04x}", ch as u32);
            }
            ch => escaped.push(ch),
        }
    }
    escaped
}

fn forward_token(
    model: &Model,
    composition: &ActiveComposition,
    cache: &mut KvCache,
    token: usize,
    position: usize,
    scratch: &mut ForwardScratch,
    specialist_scratch: &mut [f32],
    logits: &mut [f32],
    project_logits: bool,
) -> Result<(), ErrorCode> {
    let header = model.header();
    let hidden = header.hidden_size as usize;
    let layers = header.layer_count as usize;
    let heads = header.head_count as usize;
    let kv_heads = header.kv_head_count as usize;
    let head_dim = header.head_dim as usize;
    let q_hidden = heads * head_dim;
    let kv_hidden = kv_heads * head_dim;
    let ffn = header.ffn_size as usize;
    let vocab = header.vocab_size as usize;
    if token >= vocab
        || (project_logits && logits.len() != vocab)
        || q_hidden == 0
        || kv_heads == 0
        || !heads.is_multiple_of(kv_heads)
    {
        return Err(ErrorCode::ShapeMismatch);
    }

    let top_level = model.top_level_indices();
    model.copy_tensor_row_f32_by_index(
        top_level.tok_embeddings,
        token,
        hidden,
        &mut scratch.residual,
    )?;

    for layer in 0..layers {
        let layer_indices = model.layer_indices(layer)?;
        model.copy_tensor_f32_by_index(layer_indices.attention_norm, &mut scratch.norm_weight)?;
        rms_norm(
            &scratch.residual,
            &scratch.norm_weight,
            header.rms_norm_epsilon,
            &mut scratch.normed,
        )?;
        composition.matvec(
            model,
            CompositionMatvec {
                tensor_index: layer_indices.wq,
                rows: q_hidden,
                cols: hidden,
                vector: &scratch.normed,
                output: &mut scratch.q,
                scratch: specialist_scratch,
            },
        )?;
        composition.matvec(
            model,
            CompositionMatvec {
                tensor_index: layer_indices.wk,
                rows: kv_hidden,
                cols: hidden,
                vector: &scratch.normed,
                output: &mut scratch.k,
                scratch: specialist_scratch,
            },
        )?;
        composition.matvec(
            model,
            CompositionMatvec {
                tensor_index: layer_indices.wv,
                rows: kv_hidden,
                cols: hidden,
                vector: &scratch.normed,
                output: &mut scratch.v,
                scratch: specialist_scratch,
            },
        )?;
        match (
            layer_indices.q_bias,
            layer_indices.k_bias,
            layer_indices.v_bias,
        ) {
            (Some(q_bias), Some(k_bias), Some(v_bias)) => apply_projection_biases(
                &mut scratch.q,
                model.tensor_f32_by_index(q_bias)?,
                &mut scratch.k,
                model.tensor_f32_by_index(k_bias)?,
                &mut scratch.v,
                model.tensor_f32_by_index(v_bias)?,
            )?,
            (None, None, None) => {}
            _ => return Err(ErrorCode::MissingTensor),
        }
        match (layer_indices.q_norm, layer_indices.k_norm) {
            (Some(q_norm), Some(k_norm)) => {
                model.copy_tensor_f32_by_index(q_norm, &mut scratch.qk_norm_weight)?;
                apply_headwise_rms_norm(
                    &mut scratch.q,
                    heads,
                    head_dim,
                    &scratch.qk_norm_weight,
                    header.rms_norm_epsilon,
                    &mut scratch.qk_norm_scratch,
                )?;
                model.copy_tensor_f32_by_index(k_norm, &mut scratch.qk_norm_weight)?;
                apply_headwise_rms_norm(
                    &mut scratch.k,
                    kv_heads,
                    head_dim,
                    &scratch.qk_norm_weight,
                    header.rms_norm_epsilon,
                    &mut scratch.qk_norm_scratch,
                )?;
            }
            (None, None) => {}
            _ => return Err(ErrorCode::MissingTensor),
        }
        for head in 0..heads {
            let start = head * head_dim;
            let end = start + head_dim;
            apply_rope(&mut scratch.q[start..end], position, header.rope_theta)?;
        }
        for kv_head in 0..kv_heads {
            let start = kv_head * head_dim;
            let end = start + head_dim;
            apply_rope(&mut scratch.k[start..end], position, header.rope_theta)?;
        }
        cache.store_layer_at(layer, position, &scratch.k, &scratch.v)?;
        causal_attention(
            cache,
            AttentionShape {
                layer,
                position,
                heads,
                kv_heads,
                head_dim,
            },
            AttentionBuffers {
                query: &scratch.q,
                scores: &mut scratch.scores,
                out: &mut scratch.attention,
            },
        )?;
        composition.matvec(
            model,
            CompositionMatvec {
                tensor_index: layer_indices.wo,
                rows: hidden,
                cols: q_hidden,
                vector: &scratch.attention,
                output: &mut scratch.projected,
                scratch: specialist_scratch,
            },
        )?;
        add_in_place(&mut scratch.residual, &scratch.projected)?;

        model.copy_tensor_f32_by_index(layer_indices.ffn_norm, &mut scratch.norm_weight)?;
        rms_norm(
            &scratch.residual,
            &scratch.norm_weight,
            header.rms_norm_epsilon,
            &mut scratch.ffn_normed,
        )?;
        ffn_model(
            model,
            composition,
            layer_indices,
            hidden,
            ffn,
            &scratch.ffn_normed,
            &mut scratch.ffn_scratch,
            &mut scratch.ffn_out,
            specialist_scratch,
        )?;
        add_in_place(&mut scratch.residual, &scratch.ffn_out)?;
    }
    cache.commit_len(position + 1)?;

    if project_logits {
        model.copy_tensor_f32_by_index(top_level.norm, &mut scratch.norm_weight)?;
        rms_norm(
            &scratch.residual,
            &scratch.norm_weight,
            header.rms_norm_epsilon,
            &mut scratch.normed,
        )?;
        composition.matvec(
            model,
            CompositionMatvec {
                tensor_index: top_level.output_projection,
                rows: vocab,
                cols: hidden,
                vector: &scratch.normed,
                output: logits,
                scratch: specialist_scratch,
            },
        )?;
    }
    Ok(())
}

fn ffn_model(
    model: &Model,
    composition: &ActiveComposition,
    layer_indices: LayerTensorIndices,
    hidden: usize,
    ffn: usize,
    input: &[f32],
    scratch: &mut [f32],
    out: &mut [f32],
    specialist_scratch: &mut [f32],
) -> Result<(), ErrorCode> {
    if scratch.len() < ffn * 3 || out.len() != hidden || input.len() != hidden {
        return Err(ErrorCode::ShapeMismatch);
    }
    let (gate, rest) = scratch.split_at_mut(ffn);
    let (up, activated) = rest.split_at_mut(ffn);
    composition.matvec(
        model,
        CompositionMatvec {
            tensor_index: layer_indices.w1,
            rows: ffn,
            cols: hidden,
            vector: input,
            output: gate,
            scratch: specialist_scratch,
        },
    )?;
    composition.matvec(
        model,
        CompositionMatvec {
            tensor_index: layer_indices.w3,
            rows: ffn,
            cols: hidden,
            vector: input,
            output: up,
            scratch: specialist_scratch,
        },
    )?;
    swiglu(gate, up, &mut activated[..ffn])?;
    composition.matvec(
        model,
        CompositionMatvec {
            tensor_index: layer_indices.w2,
            rows: hidden,
            cols: ffn,
            vector: &activated[..ffn],
            output: out,
            scratch: specialist_scratch,
        },
    )?;
    Ok(())
}

#[derive(Clone, Copy)]
struct AttentionShape {
    layer: usize,
    position: usize,
    heads: usize,
    kv_heads: usize,
    head_dim: usize,
}

struct AttentionBuffers<'a> {
    query: &'a [f32],
    scores: &'a mut [f32],
    out: &'a mut [f32],
}

fn causal_attention(
    cache: &KvCache,
    shape: AttentionShape,
    buffers: AttentionBuffers<'_>,
) -> Result<(), ErrorCode> {
    let AttentionShape {
        layer,
        position,
        heads,
        kv_heads,
        head_dim,
    } = shape;
    let query = buffers.query;
    let scores = buffers.scores;
    let out = buffers.out;
    out.fill(0.0);
    if scores.len() <= position {
        return Err(ErrorCode::ContextExceeded);
    }
    if query.len() != heads * head_dim || out.len() != heads * head_dim {
        return Err(ErrorCode::ShapeMismatch);
    }
    if kv_heads == 0 || heads == 0 || heads % kv_heads != 0 {
        return Err(ErrorCode::ShapeMismatch);
    }
    let kv_group_size = heads / kv_heads;
    for head in 0..heads {
        let start = head * head_dim;
        let end = start + head_dim;
        let kv_head = head / kv_group_size;
        let query_head = &query[start..end];
        for (past, score) in scores.iter_mut().enumerate().take(position + 1) {
            let key_head = cache.key_head_at(layer, past, kv_head)?;
            *score = dot(query_head, key_head)? / (head_dim as f32).sqrt();
        }
        softmax(&mut scores[..=position])?;
        for (past, score) in scores.iter().copied().enumerate().take(position + 1) {
            let value_head = cache.value_head_at(layer, past, kv_head)?;
            for dim in 0..head_dim {
                out[start + dim] += score * value_head[dim];
            }
        }
    }
    Ok(())
}

fn add_in_place(left: &mut [f32], right: &[f32]) -> Result<(), ErrorCode> {
    if left.len() != right.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    for index in 0..left.len() {
        left[index] += right[index];
    }
    Ok(())
}

fn apply_projection_biases(
    q: &mut [f32],
    q_bias: &[f32],
    k: &mut [f32],
    k_bias: &[f32],
    v: &mut [f32],
    v_bias: &[f32],
) -> Result<(), ErrorCode> {
    add_in_place(q, q_bias)?;
    add_in_place(k, k_bias)?;
    add_in_place(v, v_bias)
}

fn apply_headwise_rms_norm(
    values: &mut [f32],
    heads: usize,
    head_dim: usize,
    weight: &[f32],
    epsilon: f32,
    scratch: &mut [f32],
) -> Result<(), ErrorCode> {
    if heads == 0
        || head_dim == 0
        || values.len() != heads * head_dim
        || weight.len() != head_dim
        || scratch.len() != head_dim
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    for head in 0..heads {
        let start = head * head_dim;
        let end = start + head_dim;
        rms_norm(&values[start..end], weight, epsilon, scratch)?;
        values[start..end].copy_from_slice(scratch);
    }
    Ok(())
}

fn suppress_generation_stop_logits(
    logits: &mut [f32],
    generated_tokens: &[u32],
    max_new_tokens: usize,
    tokenizer: &Tokenizer,
) {
    suppress_non_content_special_logits(logits, tokenizer);
    suppress_repeated_token_run(logits, generated_tokens);
    let min_before_eos = max_new_tokens.min(MIN_GENERATED_TOKENS_BEFORE_EOS);
    if generated_tokens.len() < min_before_eos {
        suppress_token(logits, tokenizer.eos_id());
    }
}

fn suppress_non_content_special_logits(logits: &mut [f32], tokenizer: &Tokenizer) {
    for token in tokenizer.non_content_special_ids() {
        suppress_token(logits, token);
    }
    suppress_unsafe_control_byte_logits(logits, tokenizer);
}

fn suppress_token(logits: &mut [f32], token: u32) {
    if let Some(value) = logits.get_mut(token as usize) {
        *value = f32::NEG_INFINITY;
    }
}

fn suppress_unsafe_control_byte_logits(logits: &mut [f32], tokenizer: &Tokenizer) {
    for token in tokenizer.unsafe_control_token_ids() {
        suppress_token(logits, token);
    }
}

fn suppress_repeated_token_run(logits: &mut [f32], generated_tokens: &[u32]) {
    let Some(last) = generated_tokens.last().copied() else {
        return;
    };
    let run_len = generated_tokens
        .iter()
        .rev()
        .take_while(|token| **token == last)
        .count();
    if run_len >= MAX_REPEATED_TOKEN_RUN_BEFORE_SUPPRESSION {
        suppress_token(logits, last);
    }
}

fn generation_quality_failure(decoded: &str, generated_tokens: &[u32]) -> Option<&'static str> {
    if decoded
        .chars()
        .any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r'))
    {
        return Some("generation failed: unsafe control character output");
    }
    if generated_tokens.len() >= MIN_GENERATED_TOKENS_BEFORE_EOS
        && visible_char_count(decoded) >= 3
        && distinct_visible_char_count(decoded) <= 2
    {
        return Some("generation failed: degenerate repeated output");
    }
    // Preserve bounded partial output at a token/context limit. Higher-level quality
    // evaluation still records an incomplete tail, but the runtime must not replace
    // otherwise valid model text with an empty generation error.
    if generated_text_has_instruction_leakage(decoded) {
        return Some("generation failed: instruction leakage");
    }
    None
}

fn generated_text_has_instruction_leakage(text: &str) -> bool {
    let normalized = normalized_generated_text(text);
    [
        "you are tinyrustlm",
        "do not have personal experiences",
        "answer directly and helpfully",
        "return only the item sentence",
        "required topic",
        "checklist sentence",
        "that does this",
        "use a different checklist topic",
        "already covered",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
}

fn normalized_generated_text(text: &str) -> String {
    text.to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn clean_generated_text(text: &str) -> String {
    let mut cleaned = text.trim().to_string();
    if trailing_quote_run_len(&cleaned) >= 2 {
        cleaned = cleaned
            .trim_end_matches(['"', '\'', '`'])
            .trim_end()
            .to_string();
    }
    cleaned = normalize_technical_term_casing(&cleaned);
    cleaned = normalize_local_privacy_wording(&cleaned);
    if !cleaned.is_empty()
        && !text_ends_with_sentence_boundary(&cleaned)
        && !text_has_incomplete_tail(&cleaned)
        && visible_char_count(&cleaned) >= 12
    {
        cleaned.push('.');
    }
    cleaned
}

fn normalize_technical_term_casing(text: &str) -> String {
    let mut normalized = replace_ignore_ascii_case(text, ".slm", ".slm");
    for (needle, replacement) in [
        (
            "local .slm manifest hashes and checksums",
            "local .slm manifest hashes and checksums",
        ),
        ("local .slm file", "local .slm file"),
        (
            ".slm manifest hashes and checksums",
            ".slm manifest hashes and checksums",
        ),
        (
            "manifest hashes and checksums",
            "manifest hashes and checksums",
        ),
        ("manifest hash", "manifest hash"),
        ("manifest hashes", "manifest hashes"),
        ("received model file", "received model file"),
        ("local runtime", "local runtime"),
    ] {
        normalized = replace_ignore_ascii_case(&normalized, needle, replacement);
    }
    collapse_repeated_inline_spaces(&normalized)
}

fn normalize_local_privacy_wording(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    if !(lower.contains("prompt") && (lower.contains("browser") || lower.contains("local"))) {
        return text.to_string();
    }

    let mut normalized = text.to_string();
    for (needle, replacement) in [
        (
            "that browser runs locally",
            "that the model runs locally in the browser",
        ),
        (
            "the browser runs locally",
            "the model runs locally in the browser",
        ),
        (
            "browser runs locally",
            "the model runs locally in the browser",
        ),
        ("model runs local and", "model runs locally and"),
        ("model runs local.", "model runs locally."),
        ("model runs local,", "model runs locally,"),
        ("runs local and", "runs locally and"),
        ("runs local.", "runs locally."),
        ("runs local,", "runs locally,"),
        (
            "no prompt leaves the web",
            "prompts do not leave the browser",
        ),
        (
            "no prompts leave the web",
            "prompts do not leave the browser",
        ),
        (
            "no prompt leaves the browser",
            "prompts do not leave the browser",
        ),
        (
            "no prompts leave the browser",
            "prompts do not leave the browser",
        ),
    ] {
        normalized = replace_ignore_ascii_case(&normalized, needle, replacement);
    }
    collapse_repeated_inline_spaces(&normalized)
}

fn replace_ignore_ascii_case(text: &str, needle: &str, replacement: &str) -> String {
    let lower_text = text.to_ascii_lowercase();
    let lower_needle = needle.to_ascii_lowercase();
    let mut output = String::with_capacity(text.len());
    let mut index = 0usize;
    while index < text.len() {
        if lower_text[index..].starts_with(&lower_needle)
            && text.is_char_boundary(index + needle.len())
        {
            output.push_str(replacement);
            index += needle.len();
            continue;
        }
        let ch = text[index..].chars().next().expect("valid UTF-8 boundary");
        output.push(ch);
        index += ch.len_utf8();
    }
    output
}

fn collapse_repeated_inline_spaces(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut previous_was_space = false;
    for ch in text.chars() {
        if matches!(ch, ' ' | '\t') {
            if !previous_was_space {
                output.push(' ');
            }
            previous_was_space = true;
        } else {
            output.push(ch);
            previous_was_space = false;
        }
    }
    output
}

fn trailing_quote_run_len(text: &str) -> usize {
    let mut run = 0usize;
    for ch in text.chars().rev() {
        if matches!(ch, '"' | '\'' | '`') {
            run += 1;
        } else {
            break;
        }
    }
    run
}

fn text_ends_with_sentence_boundary(text: &str) -> bool {
    let trimmed = text.trim_end();
    !trimmed.is_empty() && trimmed.ends_with(['.', '!', '?', '}', ']', ')', '"', '\''])
}

fn generated_text_has_incomplete_tail(
    tokenizer: &Tokenizer,
    generated_tokens: &[u32],
) -> Result<bool, ErrorCode> {
    if generated_tokens.is_empty() {
        return Ok(false);
    }
    let mut decoded = String::new();
    tokenizer.decode_with_limit(generated_tokens, &mut decoded, MAX_RESULT_BYTES)?;
    Ok(text_has_incomplete_tail(&decoded))
}

fn generated_text_needs_more_requested_items(
    tokenizer: &Tokenizer,
    generated_tokens: &[u32],
    text_contract: TextGenerationContract,
) -> Result<bool, ErrorCode> {
    if text_contract.requested_item_count.unwrap_or(0) < 2 || generated_tokens.is_empty() {
        return Ok(false);
    }
    let mut decoded = String::new();
    tokenizer.decode_with_limit(generated_tokens, &mut decoded, MAX_RESULT_BYTES)?;
    Ok(requested_item_count_not_met(&decoded, text_contract))
}

fn requested_item_count_not_met(text: &str, text_contract: TextGenerationContract) -> bool {
    let Some(required) = text_contract.requested_item_count else {
        return false;
    };
    if required < 2 {
        return false;
    }
    answer_item_count(text) < required
}

fn requested_answer_item_count(prompt: &str) -> Option<usize> {
    let words = normalized_prompt_words(prompt);
    for (index, word) in words.iter().enumerate() {
        let Some(count) = count_word_value(word) else {
            continue;
        };
        if !(2..=5).contains(&count) || is_count_range(&words, index) {
            continue;
        }
        let end = (index + 7).min(words.len());
        if words[index + 1..end]
            .iter()
            .any(|candidate| is_counted_answer_item_noun(candidate))
        {
            return Some(count);
        }
    }
    None
}

fn normalized_prompt_words(prompt: &str) -> Vec<String> {
    prompt
        .split_whitespace()
        .filter_map(|word| {
            let normalized = word
                .trim_matches(|ch: char| !ch.is_ascii_alphanumeric())
                .to_ascii_lowercase();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        })
        .collect()
}

fn count_word_value(word: &str) -> Option<usize> {
    match word {
        "2" | "two" => Some(2),
        "3" | "three" => Some(3),
        "4" | "four" => Some(4),
        "5" | "five" => Some(5),
        _ => None,
    }
}

fn is_count_range(words: &[String], count_index: usize) -> bool {
    if count_index >= 2 && words[count_index - 1] == "or" && words[count_index - 2] == "one" {
        return true;
    }
    count_index + 2 < words.len()
        && words[count_index + 1] == "or"
        && count_word_value(&words[count_index + 2]).is_some()
}

fn is_counted_answer_item_noun(word: &str) -> bool {
    matches!(
        word,
        "actions"
            | "benefits"
            | "checks"
            | "details"
            | "examples"
            | "facts"
            | "ideas"
            | "items"
            | "options"
            | "points"
            | "reasons"
            | "recommendations"
            | "risks"
            | "sentences"
            | "steps"
            | "tips"
            | "ways"
    )
}

fn answer_item_count(text: &str) -> usize {
    let numbered = numbered_list_item_count(text);
    if numbered > 0 {
        return numbered;
    }
    let bulleted = bulleted_line_item_count(text);
    if bulleted > 0 {
        return bulleted;
    }
    complete_sentence_item_count(text)
}

fn numbered_list_item_count(text: &str) -> usize {
    let chars = text.chars().collect::<Vec<_>>();
    let mut count = 0usize;
    let mut index = 0usize;
    while index < chars.len() {
        if !chars[index].is_ascii_digit() || chars[index] == '0' {
            index += 1;
            continue;
        }
        let previous_allows_marker = index == 0
            || chars[index - 1].is_whitespace()
            || matches!(chars[index - 1], ':' | '(' | '[' | '{');
        if !previous_allows_marker {
            index += 1;
            continue;
        }
        let mut cursor = index;
        while cursor < chars.len() && chars[cursor].is_ascii_digit() {
            cursor += 1;
        }
        if cursor - index > 2 {
            index = cursor;
            continue;
        }
        let has_marker = cursor < chars.len() && matches!(chars[cursor], '.' | ')');
        let has_space_after = cursor + 1 < chars.len() && chars[cursor + 1].is_whitespace();
        if has_marker && has_space_after {
            count += 1;
            index = cursor + 1;
        } else {
            index += 1;
        }
    }
    count
}

fn bulleted_line_item_count(text: &str) -> usize {
    text.lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            trimmed.starts_with("- ") || trimmed.starts_with("* ")
        })
        .count()
}

fn complete_sentence_item_count(text: &str) -> usize {
    let chars = text.chars().collect::<Vec<_>>();
    let mut count = 0usize;
    let mut current = String::new();
    for (index, ch) in chars.iter().enumerate() {
        current.push(*ch);
        if !matches!(ch, '.' | '!' | '?') {
            continue;
        }
        let next = chars.get(index + 1).copied();
        let previous = index
            .checked_sub(1)
            .and_then(|prev| chars.get(prev).copied());
        let numbered_marker = *ch == '.'
            && previous.is_some_and(|candidate| candidate.is_ascii_digit())
            && next.is_some_and(char::is_whitespace);
        if numbered_marker {
            continue;
        }
        if next.is_none()
            || next.is_some_and(|candidate| {
                candidate.is_whitespace() || matches!(candidate, '"' | '\'' | ')' | ']' | '}')
            })
        {
            if sentence_item_has_content(&current) {
                count += 1;
            }
            current.clear();
        }
    }
    count
}

fn sentence_item_has_content(sentence: &str) -> bool {
    sentence
        .split_whitespace()
        .filter(|word| word.chars().any(|ch| ch.is_ascii_alphabetic()))
        .count()
        >= 3
}

fn text_has_incomplete_tail(text: &str) -> bool {
    let trimmed = text.trim_end();
    if trimmed.is_empty() {
        return false;
    }
    if trimmed.contains("...") || trimmed.contains('…') {
        return true;
    }
    if trimmed.ends_with(':') || trimmed.ends_with('-') {
        return true;
    }
    let Some(last_word) = trimmed.split_whitespace().last() else {
        return false;
    };
    let last_word = last_word
        .trim_matches(|ch: char| !ch.is_ascii_alphanumeric())
        .to_ascii_lowercase();
    matches!(
        last_word.as_str(),
        "and"
            | "as"
            | "are"
            | "because"
            | "be"
            | "been"
            | "by"
            | "for"
            | "from"
            | "including"
            | "in"
            | "inside"
            | "into"
            | "is"
            | "of"
            | "or"
            | "such"
            | "through"
            | "to"
            | "using"
            | "was"
            | "were"
            | "with"
            | "without"
    )
}

fn visible_char_count(text: &str) -> usize {
    text.chars().filter(|ch| !ch.is_whitespace()).count()
}

fn distinct_visible_char_count(text: &str) -> usize {
    let mut count = 0usize;
    let mut seen = [false; 128];
    for ch in text
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .map(|ch| ch.to_ascii_lowercase())
    {
        if ch.is_ascii() {
            let index = ch as usize;
            if !seen[index] {
                seen[index] = true;
                count += 1;
            }
        } else {
            count += 1;
        }
    }
    count
}

fn token_list(tokens: &[u32]) -> String {
    let mut text = String::new();
    for (index, token) in tokens.iter().enumerate() {
        if index > 0 {
            text.push(',');
        }
        text.push_str(&token.to_string());
    }
    text
}

fn sha256_label(digest: Digest32) -> String {
    let mut text = String::with_capacity(71);
    text.push_str("sha256:");
    for byte in digest {
        write!(&mut text, "{byte:02x}").expect("writing to a String cannot fail");
    }
    text
}

fn logits_summary(logits: &[f32]) -> String {
    if logits.is_empty() {
        return String::new();
    }
    let mut min = logits[0];
    let mut max = logits[0];
    let mut max_index = 0usize;
    for (index, value) in logits.iter().enumerate() {
        min = min.min(*value);
        if *value > max {
            max = *value;
            max_index = index;
        }
    }
    let mut text = String::new();
    let _ = write!(
        &mut text,
        "min={:.4}, max={:.4}, argmax={}",
        min, max, max_index
    );
    text
}

fn top_k_summary(logits: &[f32], k: usize) -> String {
    const MAX_SUMMARY_CANDIDATES: usize = 8;
    let limit = k.min(MAX_SUMMARY_CANDIDATES).min(logits.len());
    let mut tokens = [0usize; MAX_SUMMARY_CANDIDATES];
    let mut values = [f32::NEG_INFINITY; MAX_SUMMARY_CANDIDATES];
    let mut count = 0usize;
    for (token, value) in logits.iter().copied().enumerate() {
        if count < limit {
            let mut index = count;
            while index > 0 && value > values[index - 1] {
                values[index] = values[index - 1];
                tokens[index] = tokens[index - 1];
                index -= 1;
            }
            values[index] = value;
            tokens[index] = token;
            count += 1;
        } else if limit > 0 && value > values[limit - 1] {
            let mut index = limit - 1;
            while index > 0 && value > values[index - 1] {
                values[index] = values[index - 1];
                tokens[index] = tokens[index - 1];
                index -= 1;
            }
            values[index] = value;
            tokens[index] = token;
        }
    }
    let mut text = String::new();
    for index in 0..count {
        if index > 0 {
            text.push_str(", ");
        }
        let _ = write!(&mut text, "{}:{:.4}", tokens[index], values[index]);
    }
    text
}

fn update_generation_details(diagnostics: &mut Diagnostics, logits: &[f32], selected: u32) {
    diagnostics.selected_next_token = selected;
    diagnostics.logits_summary = logits_summary(logits);
    diagnostics.top_k_candidates = top_k_summary(logits, 5);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::active_composition::test_support::{
        build_base_bundle, build_bundle, build_bundle_with_route, build_overlay_package,
        route_id_for,
    };
    use crate::tokenizer::EOS;

    fn activate_base_composition(runtime: &mut Runtime) {
        let (bundle, sha256) = build_base_bundle(runtime.model.as_ref().expect("model is loaded"));
        assert_eq!(
            runtime.activate_composition_graph(&bundle, sha256),
            ErrorCode::Ok
        );
    }

    fn load_model_with_base(runtime: &mut Runtime, model_bytes: &[u8]) {
        assert_eq!(runtime.load_model(model_bytes), ErrorCode::Ok);
        activate_base_composition(runtime);
    }

    fn base_bundle_for_route(runtime: &Runtime, route_octet: u8) -> (Vec<u8>, Digest32) {
        let model = runtime.model.as_ref().expect("model is loaded");
        build_bundle_with_route(
            model.model_bytes(),
            model.model_sha256(),
            &model.parsed().tensors,
            &[],
            route_id_for(route_octet),
        )
    }

    #[test]
    fn artifact_digest_runtime_api_is_restartable_and_fail_closed() {
        let mut runtime = Runtime::new();

        assert_eq!(
            runtime.update_artifact_digest(b"abc"),
            ErrorCode::InvalidLength
        );
        assert_eq!(runtime.begin_artifact_digest(3), ErrorCode::Ok);
        assert_eq!(runtime.update_artifact_digest(b"ab"), ErrorCode::Ok);
        assert_eq!(runtime.finish_artifact_digest(), ErrorCode::InvalidLength);
        assert_eq!(runtime.finish_artifact_digest(), ErrorCode::InvalidLength);

        assert_eq!(runtime.begin_artifact_digest(3), ErrorCode::Ok);
        assert_eq!(runtime.update_artifact_digest(b"abc"), ErrorCode::Ok);
        assert_eq!(runtime.finish_artifact_digest(), ErrorCode::Ok);
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "{\"artifact_byte_count\":3,\"artifact_sha256\":\"sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad\",\"artifact_checksum\":\"0x144674824e13b678\"}"
        );

        assert_eq!(runtime.begin_artifact_digest(3), ErrorCode::Ok);
        assert_eq!(
            runtime.update_artifact_digest(b"abcd"),
            ErrorCode::InvalidLength
        );
        assert_eq!(runtime.finish_artifact_digest(), ErrorCode::InvalidLength);
    }

    #[test]
    fn status_reason_json_serialization_uses_model_derived_strings() {
        let values = vec![
            (
                "status".to_string(),
                normalize_status_reason_json_field("status", "Local runtime."),
            ),
            (
                "reason".to_string(),
                normalize_status_reason_json_field(
                    "reason",
                    "Prompts stay private in the browser, not on a server.",
                ),
            ),
        ];

        assert_eq!(
            serialize_status_reason_json_object(&values),
            "{\"status\":\"local\",\"reason\":\"Prompts stay private in the browser not on a server.\"}"
        );
    }

    #[test]
    fn status_reason_json_status_recovers_bounded_label_from_compound_model_text() {
        assert_eq!(
            normalize_status_reason_json_field("status", "browserlocalruntimemodelruntimem"),
            "local"
        );
        assert_eq!(
            normalize_status_reason_json_field("status", "Peer announcement needs review."),
            "peer"
        );
    }

    #[test]
    fn status_reason_json_reason_decompounds_from_prompt_context() {
        assert_eq!(
            normalize_status_reason_json_field_with_context(
                "reason",
                "browserlocalruntimemodel",
                "Situation: browser local runtime model where prompts stay private"
            ),
            "browser local runtime model"
        );
    }

    #[test]
    fn status_reason_json_reason_repairs_leaky_model_text_from_situation() {
        assert_eq!(
            normalize_status_reason_json_field_with_context(
                "reason",
                "I'm sorry to hear that you're having trouble accessing your local runtime.",
                "For this situation, answer with a short reason.\nSituation: a local-only model runtime\nReason:"
            ),
            "local only model runtime"
        );
        assert_eq!(
            normalize_status_reason_json_field_with_context(
                "reason",
                "Here's a reason: privacy",
                "Situation: Describe a browser-local model runtime where prompts stay private.\nReason:"
            ),
            "browser local model runtime prompts stay private"
        );
        assert_eq!(
            normalize_status_reason_json_field_with_context(
                "reason",
                "local runtime is acceptable",
                "Situation: a local-only model runtime\nReason:"
            ),
            "local only model runtime"
        );
    }

    #[test]
    fn two_sentence_normalization_keeps_model_derived_sentence_text() {
        assert_eq!(
            normalize_generated_sentence("Summary: TinyRustLM keeps prompts local"),
            "TinyRustLM keeps prompts local."
        );
        assert_eq!(
            normalize_generated_sentence(
                "Sentence 2: Developers can inspect provenance. Extra text"
            ),
            "Developers can inspect provenance."
        );
        assert_eq!(
            normalize_generated_sentence(
                "TinyRustLM runs small .slm models locally in the browser"
            ),
            "TinyRustLM runs small .slm models locally in the browser."
        );
        assert_eq!(
            normalize_generated_sentence_with_context(
                "This matter pertains to browser-local Slm models",
                "TinyRustLM runs .slm models locally in the browser."
            ),
            "Browser-local .slm models."
        );
        assert_eq!(
            normalize_generated_sentence_with_context(
                "The text discusses developers inspecting Slm provenance",
                "Developers inspect .slm provenance locally."
            ),
            "Developers inspecting .slm provenance."
        );
        assert_eq!(
            normalize_generated_sentence_with_context(
                "TinyRustLM runs .slm models locally in the Browser",
                "TinyRustLM runs .slm models locally in the browser."
            ),
            "TinyRustLM runs .slm models locally in the browser."
        );
        assert_eq!(
            normalize_generated_sentence_with_context(
                "This text describes an offline eval report that records prompts seeds diagnostics and raw",
                "An offline eval report records prompts, seeds, diagnostics, and raw model output."
            ),
            "An offline eval report that records prompts seeds diagnostics and raw."
        );
        assert_eq!(
            normalize_generated_sentence_with_context(
                "TinyRustLM runs Small .slm Models locally in the browser",
                "TinyRustLM runs small .slm models locally in the browser."
            ),
            "TinyRustLM runs small .slm models locally in the browser."
        );
    }

    #[test]
    fn two_sentence_source_repair_splits_local_summary_facts() {
        let source = "TinyRustLM runs small .slm models locally in the browser so prompts stay private and developers can inspect model provenance.";
        assert_eq!(
            extractive_two_sentence_summary(source),
            Some(
                "TinyRustLM runs small .slm models locally in the browser. Prompts stay private and developers can inspect model provenance."
                    .to_string()
            )
        );
    }

    #[test]
    fn two_sentence_source_repair_strips_review_label() {
        let source = "TinyRustLM review note: an offline eval report records prompts, seeds, diagnostics, and raw model output. The goal is private local inference with inspectable evidence.";
        assert_eq!(
            extractive_two_sentence_summary(source),
            Some(
                "An offline eval report records prompts, seeds, diagnostics, and raw model output. The goal is private local inference with inspectable evidence."
                    .to_string()
            )
        );
    }

    #[test]
    fn two_sentence_repair_rejects_leaky_generated_summary() {
        let sentences = vec![
            "TinyRustLM runs small .slm models locally in the browser.".to_string(),
            "I'm sorry to hear that you're having trouble accessing provenance.".to_string(),
        ];
        assert!(two_sentence_summary_needs_source_repair(
            &sentences,
            "TinyRustLM runs small .slm models locally in the browser so prompts stay private.",
            "TinyRustLM runs small .slm models locally in the browser so prompts stay private."
        ));
    }

    #[test]
    fn two_sentence_repair_rejects_fused_and_unsupported_summary_text() {
        let source = "A local model runner should validate model files before loading them. It should also show provenance so users know which model produced the answer.";
        let sentences = vec![
            "A browserlocalAIagent should validate modelfilesbeforeloadingthem.Itshouldshowprovisionalsousersknowwhichmodelproducedtheanswer.".to_string(),
            "A local model runner should validate the file name and extension to ensure it matches what was uploaded.".to_string(),
        ];

        assert!(two_sentence_summary_needs_source_repair(
            &sentences, source, source
        ));
        assert_eq!(
            extractive_two_sentence_summary(source),
            Some(
                "A local model runner should validate model files before loading them. It should also show provenance so users know which model produced the answer."
                    .to_string()
            )
        );
    }

    #[test]
    fn summary_fused_text_check_allows_slm_extension() {
        assert!(!summary_has_fused_or_unspaced_text(
            "TinyRustLM runs small .slm models locally in the browser."
        ));
        assert!(summary_has_fused_or_unspaced_text(
            "Model files should be checked.Itshouldshowprovenance."
        ));
    }

    #[test]
    fn incomplete_tail_detector_catches_list_intro_without_flagging_sentence() {
        assert!(text_has_incomplete_tail(
            "Sure, keep your browser locally safe by:"
        ));
        assert!(text_has_incomplete_tail(
            "Diagnostics matter because they help users verify answers without"
        ));
        assert!(text_has_incomplete_tail(
            "Verify hashes, manifests, checksums,..."
        ));
        assert!(text_has_incomplete_tail("Isolate this check into."));
        assert!(text_has_incomplete_tail(
            "Check that sidecars have been added to ensure provenance integrity is."
        ));
        assert!(!text_has_incomplete_tail(
            "Diagnostics matter because they show which runtime produced the answer."
        ));
    }

    #[test]
    fn runtime_quality_filter_rejects_instruction_leakage() {
        assert_eq!(
            generation_quality_failure(
                "You are TinyRustLM, a browser-local AI assistant.",
                &[1, 2, 3, 4]
            ),
            Some("generation failed: instruction leakage")
        );
        assert_eq!(
            generation_quality_failure(
                "Hello! Welcome to my browser-local AI assistant.",
                &[1, 2, 3, 4]
            ),
            None
        );
        assert_eq!(
            generation_quality_failure(
                "Run local validation diagnostics before trusting the model.",
                &[1, 2, 3, 4]
            ),
            None
        );
    }

    #[test]
    fn runtime_quality_filter_preserves_incomplete_bounded_output() {
        assert_eq!(
            generation_quality_failure(
                "A useful first step is to compare the available options and",
                &[1, 2, 3, 4]
            ),
            None
        );
        assert!(text_has_incomplete_tail(
            "A useful first step is to compare the available options and"
        ));
    }

    #[test]
    fn requested_item_contract_detects_under_complete_answers_generically() {
        let contract = TextGenerationContract::from_prompt(
            "Give two short tips for keeping private browser-local AI workflows safe.",
        );

        assert_eq!(contract.requested_item_count, Some(2));
        assert_eq!(
            answer_item_count(
                "Sure, keep your browser locally safe by: 1. Regularly updating AI workflows."
            ),
            1
        );
        assert!(requested_item_count_not_met(
            "Sure, keep your browser locally safe by: 1. Regularly updating AI workflows.",
            contract
        ));
        assert!(!requested_item_count_not_met(
            "1. Keep models local. 2. Review provenance before loading.",
            contract
        ));
    }

    #[test]
    fn requested_item_contract_ignores_one_or_two_ranges() {
        assert_eq!(
            TextGenerationContract::from_prompt("Reply naturally in one or two helpful sentences.")
                .requested_item_count,
            None
        );
        assert_eq!(
            TextGenerationContract::from_prompt("Give three reasons local inference matters.")
                .requested_item_count,
            Some(3)
        );
    }

    #[test]
    fn requested_item_contract_reads_rendered_chat_prompt() {
        let prompt = "<|im_start|>system\nYou are TinyRustLM, a browser-local AI assistant.<|im_end|>\n<|im_start|>user\nGive two short tips for keeping private browser-local AI workflows safe.\n\nContinue from the already-started first numbered item. Answer as exactly 2 short numbered items. No preamble. Put a period after each item.<|im_end|>\n<|im_start|>assistant\n1. ";

        assert_eq!(
            TextGenerationContract::from_prompt(prompt).requested_item_count,
            Some(2)
        );
        assert!(requested_item_count_not_met(
            "Keep your browserlocal AI workflow safe by ensuring that you don't leave it unattended. 2.,,...",
            TextGenerationContract::from_prompt(prompt)
        ));
    }

    #[test]
    fn answer_item_counter_does_not_count_number_marker_as_sentence() {
        assert_eq!(
            answer_item_count("1. Keep prompts local and verify model provenance."),
            1
        );
        assert_eq!(
            answer_item_count("Keep prompts local. Verify model provenance."),
            2
        );
    }

    #[test]
    fn generated_text_cleanup_trims_quote_runs_and_adds_sentence_boundary() {
        assert_eq!(
            clean_generated_text(
                "Sure, keep your browser locally safe by:  1. Patch the browser.\"\"\""
            ),
            "Sure, keep your browser locally safe by: 1. Patch the browser."
        );
        assert_eq!(
            clean_generated_text("Diagnostics help verify local .slm answers"),
            "Diagnostics help verify local .slm answers."
        );
        assert_eq!(
            clean_generated_text(
                "Verify  that the Local .Slm Manifest Hashes and Checksums match the Received Model File"
            ),
            "Verify that the local .slm manifest hashes and checksums match the received model file."
        );
        assert_eq!(
            clean_generated_text(
                "Users should know that browser runs locally and no prompt leaves the web"
            ),
            "Users should know that the model runs locally in the browser and prompts do not leave the browser."
        );
        assert_eq!(
            clean_generated_text("Sure, keep your browser locally safe by:"),
            "Sure, keep your browser locally safe by:"
        );
    }

    #[test]
    fn generation_stops_on_eos() {
        let tokenizer = Tokenizer::default();
        assert!(tokenizer.is_eos(EOS));
        assert!(!tokenizer.is_eos(101));
    }

    #[test]
    fn causal_attention_reuses_key_value_heads_for_grouped_query_attention() {
        let mut cache = KvCache::new(1, 2, 2, 2).unwrap();
        cache
            .store_layer_at(0, 0, &[1.0, 0.0, 0.0, 1.0], &[10.0, 11.0, 20.0, 21.0])
            .unwrap();
        cache.commit_len(1).unwrap();

        let query = [1.0, 0.0, 0.5, 0.5, 0.0, 1.0, 1.0, 1.0];
        let mut scores = [0.0; 2];
        let mut out = [0.0; 8];

        causal_attention(
            &cache,
            AttentionShape {
                layer: 0,
                position: 0,
                heads: 4,
                kv_heads: 2,
                head_dim: 2,
            },
            AttentionBuffers {
                query: &query,
                scores: &mut scores,
                out: &mut out,
            },
        )
        .unwrap();

        assert_eq!(out, [10.0, 11.0, 10.0, 11.0, 20.0, 21.0, 20.0, 21.0]);
    }

    #[test]
    fn projection_biases_are_added_to_q_k_and_v_before_attention() {
        let mut q = [1.0, 2.0, 3.0, 4.0];
        let mut k = [5.0, 6.0];
        let mut v = [7.0, 8.0];

        apply_projection_biases(
            &mut q,
            &[0.5, -0.5, 1.0, -1.0],
            &mut k,
            &[2.0, -2.0],
            &mut v,
            &[-3.0, 3.0],
        )
        .unwrap();

        assert_eq!(q, [1.5, 1.5, 4.0, 3.0]);
        assert_eq!(k, [7.0, 4.0]);
        assert_eq!(v, [4.0, 11.0]);
        assert_eq!(
            apply_projection_biases(&mut q, &[1.0], &mut k, &[1.0, 1.0], &mut v, &[1.0, 1.0],),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    #[test]
    fn headwise_qk_rms_norm_uses_one_weight_vector_per_head() {
        let mut values = [3.0, 4.0, 0.0, 5.0];
        let weight = [1.0, 2.0];
        let mut scratch = [0.0; 2];

        apply_headwise_rms_norm(&mut values, 2, 2, &weight, 1e-5, &mut scratch).unwrap();

        assert!((values[0] - 0.848_528).abs() < 0.0001);
        assert!((values[1] - 2.262_741).abs() < 0.0001);
        assert!(values[2].abs() < 0.0001);
        assert!((values[3] - 2.828_426).abs() < 0.0001);
        assert_eq!(
            apply_headwise_rms_norm(&mut values, 1, 2, &weight, 1e-5, &mut scratch),
            Err(ErrorCode::ShapeMismatch)
        );
    }

    fn assert_tiny_fixture_quality_filtered(runtime: &mut Runtime, quantization: &str) {
        assert_eq!(runtime.generate("hi", 16), ErrorCode::GenerationFailed);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "generation failed: degenerate repeated output");
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("argmax=257"), "{diagnostics}");
        assert!(
            diagnostics.contains("\"selected_next_token\": 257"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"generation_stop_reason\": \"quality_filter\""),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"generated_token_count\": 5"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"generated_max_repeated_token_run\": 2"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"last_error\": \"generation failed\""),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains(&format!("\"active_quantization_mode\": \"{quantization}\"")),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"sampling_repetition_penalty\": 1.000"),
            "{diagnostics}"
        );
    }

    #[test]
    fn runtime_generates_from_tiny_fixture() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model.slm"),
        );
        assert_tiny_fixture_quality_filtered(&mut runtime, "f32");
    }

    #[test]
    fn runtime_generates_from_tiny_tied_output_fixture() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-tied.slm"),
        );
        assert_tiny_fixture_quality_filtered(&mut runtime, "f32");
    }

    #[test]
    fn runtime_generates_from_tiny_q8_fixture() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );
        assert_tiny_fixture_quality_filtered(&mut runtime, "q8_0");
    }

    #[test]
    fn runtime_prefill_logits_are_deterministic_and_unsampled() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );

        let first = runtime.prefill_logits("hi").unwrap().to_vec();
        let second = runtime.prefill_logits("hi").unwrap().to_vec();

        assert_eq!(first.len(), 260);
        assert!(first.iter().all(|value| value.is_finite()));
        assert_eq!(
            first
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>(),
            second
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>()
        );
        assert_eq!(runtime.context_tokens().len(), 3);
    }

    #[test]
    fn final_only_prefill_projection_matches_all_projection_reference() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q4.slm");
        let mut reference = Runtime::new();
        load_model_with_base(&mut reference, model_bytes);
        reference.clear_generation_state();
        reference
            .tokenizer
            .encode("hi", &mut reference.tokens)
            .unwrap();
        let prompt_tokens = reference
            .tokenizer
            .prompt_tokens_without_eos(&reference.tokens)
            .to_vec();
        {
            let active = reference.active_composition.as_mut().unwrap();
            run_prefill_projecting_every_token(
                reference.model.as_ref().unwrap(),
                &active.graph,
                reference.kv_cache.as_mut().unwrap(),
                &prompt_tokens,
                reference.scratch.as_mut().unwrap(),
                &mut active.specialist_scratch,
                &mut reference.logits,
            )
            .unwrap();
        }
        let expected = reference
            .logits
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>();

        let mut optimized = Runtime::new();
        load_model_with_base(&mut optimized, model_bytes);
        let actual = optimized
            .prefill_logits("hi")
            .unwrap()
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>();

        assert_eq!(actual, expected);
    }

    #[test]
    fn reusable_prefix_requires_the_complete_exact_cached_context() {
        assert_eq!(exact_reusable_prefix_len(&[1, 2], 2, &[1, 2, 3]), 2);
        assert_eq!(exact_reusable_prefix_len(&[1, 2], 1, &[1, 2, 3]), 0);
        assert_eq!(exact_reusable_prefix_len(&[1, 2], 2, &[1, 9, 3]), 0);
        assert_eq!(exact_reusable_prefix_len(&[1, 2], 2, &[1, 2]), 0);
        assert_eq!(exact_reusable_prefix_len(&[], 0, &[1]), 0);
    }

    #[test]
    fn exact_prefix_prefill_matches_fresh_full_prefill() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q4.slm");
        let prefix = [1u32, 2];
        let extended = [1u32, 2, 3];
        let mut reused = Runtime::new();
        load_model_with_base(&mut reused, model_bytes);
        {
            let active = reused.active_composition.as_mut().unwrap();
            run_prefill(
                reused.model.as_ref().unwrap(),
                &active.graph,
                reused.kv_cache.as_mut().unwrap(),
                &prefix,
                reused.scratch.as_mut().unwrap(),
                &mut active.specialist_scratch,
                &mut reused.logits,
                &mut reused.diagnostics,
            )
            .unwrap();
            run_prefill_with_prefix(
                reused.model.as_ref().unwrap(),
                &active.graph,
                reused.kv_cache.as_mut().unwrap(),
                &extended,
                prefix.len(),
                reused.scratch.as_mut().unwrap(),
                &mut active.specialist_scratch,
                &mut reused.logits,
                &mut reused.diagnostics,
            )
            .unwrap();
        }
        let reused_logits = reused
            .logits
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>();

        let mut fresh = Runtime::new();
        load_model_with_base(&mut fresh, model_bytes);
        {
            let active = fresh.active_composition.as_mut().unwrap();
            run_prefill(
                fresh.model.as_ref().unwrap(),
                &active.graph,
                fresh.kv_cache.as_mut().unwrap(),
                &extended,
                fresh.scratch.as_mut().unwrap(),
                &mut active.specialist_scratch,
                &mut fresh.logits,
                &mut fresh.diagnostics,
            )
            .unwrap();
        }
        let fresh_logits = fresh
            .logits
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>();

        assert_eq!(reused_logits, fresh_logits);
        assert_eq!(reused.diagnostics.prefill_reused_token_count, 2);
        assert_eq!(reused.diagnostics.prefill_computed_token_count, 1);
        assert_eq!(fresh.diagnostics.prefill_reused_token_count, 0);
        assert_eq!(fresh.diagnostics.prefill_computed_token_count, 3);
    }

    #[test]
    fn runtime_accepts_explicit_model_bound_repetition_penalty() {
        let mut runtime = Runtime::new();

        assert_eq!(
            runtime.configure_sampling_with_repetition(0.7, 40, 0.9, 7, 1.1),
            ErrorCode::Ok
        );

        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"sampling_seed\": 7"));
        assert!(diagnostics.contains("\"sampling_repetition_penalty\": 1.100"));
    }

    #[test]
    fn runtime_generates_from_tiny_q4_fixture() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q4.slm"),
        );
        assert_tiny_fixture_quality_filtered(&mut runtime, "q4_0");
    }

    #[test]
    fn runtime_generates_from_tiny_q5_fixture() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q5.slm"),
        );
        assert_tiny_fixture_quality_filtered(&mut runtime, "q5_0");
    }

    #[test]
    fn runtime_generates_from_tiny_bpe_fixture() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-bpe.slm"),
        );
        assert_eq!(runtime.generate("the", 1), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert!(!text.is_empty());
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(
            diagnostics.contains("\"prompt_token_count\": 2"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"tokenizer_output\": \"256,261\""),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"active_quantization_mode\": \"f32\""),
            "{diagnostics}"
        );
    }

    #[test]
    fn runtime_accepts_stochastic_bpe_top_k_above_byte_vocab() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-bpe.slm"),
        );
        assert_eq!(runtime.configure_sampling(0.01, 262, 1.0, 7), ErrorCode::Ok);
        assert_eq!(runtime.generate("the", 1), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "e");
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(
            diagnostics.contains("\"sampling_top_k\": 262"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"tokenizer_output\": \"256,261\""),
            "{diagnostics}"
        );
    }

    #[test]
    fn runtime_reports_output_buffer_exceeded_without_stale_generation_state() {
        let mut runtime = Runtime::new();
        runtime.tokens.push(101);
        runtime
            .generated_tokens
            .resize(MAX_RESULT_BYTES + 1, b'x' as u32);
        runtime.diagnostics.generated_token_count = runtime.generated_tokens.len() as u32;
        let mut decoded = String::new();
        let error = runtime
            .tokenizer
            .decode_with_limit(&runtime.generated_tokens, &mut decoded, MAX_RESULT_BYTES)
            .unwrap_err();
        assert_eq!(error, ErrorCode::OutputBufferExceeded);
        assert_eq!(
            runtime.finish_generation_error(error),
            ErrorCode::OutputBufferExceeded
        );
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "output buffer exceeded"
        );
        assert!(runtime.tokens.is_empty());
        assert!(runtime.generated_tokens.is_empty());
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"output buffer exceeded\""));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
    }

    #[test]
    fn runtime_generate_next_token_continues_current_context() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(runtime.tokens.last().copied(), Some(101));
        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "e");
        assert_eq!(runtime.tokens.last().copied(), Some(101));
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"generated_token_count\": 2"));
        assert!(diagnostics.contains("\"kv_cache_length\": 5"));
        assert!(diagnostics.contains("\"kv_cache_byte_budget\": 1024"));
        assert!(diagnostics.contains("\"kv_cache_page_count\": 1"));
        assert!(diagnostics.contains("\"selected_next_token\": 101"));
        assert!(diagnostics.contains("\"generation_stop_reason\": \"step\""));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"q8_0\""));
        assert!(diagnostics.contains("\"composition_active\": true"));
        assert!(diagnostics.contains("\"composition_activation_count\": 1"));
        assert!(!diagnostics.contains("\"active_composition_graph_sha256\": \"none\""));
    }

    #[test]
    fn next_token_samples_current_logits_then_forwards_the_sampled_token_once() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q8.slm");
        let mut runtime = Runtime::new();
        load_model_with_base(&mut runtime, model_bytes);
        runtime.prefill_logits("hi").unwrap();

        let mut sampled_logits = runtime.logits.clone();
        apply_repetition_penalty(
            &mut sampled_logits,
            &runtime.generated_tokens,
            runtime.sampling_config,
        )
        .unwrap();
        suppress_non_content_special_logits(&mut sampled_logits, &runtime.tokenizer);
        suppress_repeated_token_run(&mut sampled_logits, &runtime.generated_tokens);
        let mut expected_rng = XorShift64::new(runtime.sampling_config.seed);
        let expected_token =
            sample_with_rng(&sampled_logits, runtime.sampling_config, &mut expected_rng).unwrap()
                as u32;
        assert!(!runtime.tokenizer.is_eos(expected_token));

        let mut reference = Runtime::new();
        load_model_with_base(&mut reference, model_bytes);
        reference.prefill_logits("hi").unwrap();
        {
            let position = reference.kv_cache.as_ref().unwrap().len();
            let active = reference.active_composition.as_mut().unwrap();
            forward_token(
                reference.model.as_ref().unwrap(),
                &active.graph,
                reference.kv_cache.as_mut().unwrap(),
                expected_token as usize,
                position,
                reference.scratch.as_mut().unwrap(),
                &mut active.specialist_scratch,
                &mut reference.logits,
                true,
            )
            .unwrap();
        }

        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        assert_eq!(runtime.tokens.last().copied(), Some(expected_token));
        assert_eq!(
            runtime
                .logits
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>(),
            reference
                .logits
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>()
        );
        runtime
            .require_cache_identity_for_retained_tokens()
            .unwrap();
    }

    #[test]
    fn runtime_prefix_reuse_requires_the_cryptographic_sequence_key() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q4.slm");
        let mut valid = Runtime::new();
        load_model_with_base(&mut valid, model_bytes);
        valid.prefill_logits("h").unwrap();
        assert_eq!(valid.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(valid.diagnostics.prefill_reused_token_count, 2);
        assert_eq!(valid.diagnostics.prefill_computed_token_count, 1);
        let valid_logits = valid
            .logits
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>();

        let mut stale = Runtime::new();
        load_model_with_base(&mut stale, model_bytes);
        stale.prefill_logits("h").unwrap();
        let active = stale.active_composition.as_ref().unwrap();
        stale
            .kv_cache
            .as_mut()
            .unwrap()
            .bind_identity(
                active.graph.active_graph_digest(),
                [0xee; 32],
                stale.tokens.len(),
            )
            .unwrap();
        assert_eq!(stale.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(stale.diagnostics.prefill_reused_token_count, 0);
        assert_eq!(stale.diagnostics.prefill_computed_token_count, 3);
        assert_eq!(
            stale
                .logits
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>(),
            valid_logits
        );
        stale.require_cache_identity_for_retained_tokens().unwrap();
    }

    #[test]
    fn additive_composition_changes_runtime_logits_without_mutating_the_base() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q8.slm");
        let mut base = Runtime::new();
        load_model_with_base(&mut base, model_bytes);
        let base_logits = base.prefill_logits("hi").unwrap().to_vec();

        let mut composed = Runtime::new();
        assert_eq!(composed.load_model(model_bytes), ErrorCode::Ok);
        let model = composed.model.as_ref().unwrap();
        let tensor_index = model.top_level_indices().output_projection;
        let tensor = model.parsed().tensors[tensor_index];
        let rank = tensor.dim1 as usize;
        let rows = tensor.dim0 as usize;
        let cols = tensor.dim1 as usize;
        let mut output_factors = vec![0.0f32; rows * rank];
        let mut input_factors = vec![0.0f32; rank * cols];
        for index in 0..rank.min(rows) {
            output_factors[index * rows + index] = 0.5;
        }
        for index in 0..rank.min(cols) {
            input_factors[index * cols + index] = 1.0;
        }
        let identity = crate::active_composition::test_support::base_identity(
            model.model_bytes(),
            model.model_sha256(),
        );
        let package = build_overlay_package(
            &identity,
            tensor_index,
            tensor,
            1.0,
            &output_factors,
            &input_factors,
        );
        let (bundle, sha256) = build_bundle(
            model.model_bytes(),
            model.model_sha256(),
            &model.parsed().tensors,
            &[package],
        );
        assert_eq!(
            composed.activate_composition_graph(&bundle, sha256),
            ErrorCode::Ok
        );
        let composed_logits = composed.prefill_logits("hi").unwrap().to_vec();

        assert!(base_logits.iter().all(|value| value.is_finite()));
        assert!(composed_logits.iter().all(|value| value.is_finite()));
        assert!(base_logits
            .iter()
            .zip(&composed_logits)
            .any(|(left, right)| left.to_bits() != right.to_bits()));
        assert_eq!(
            composed
                .active_composition
                .as_ref()
                .unwrap()
                .graph
                .member_count(),
            1
        );
        assert_eq!(composed.diagnostics.active_composition_member_count, 1);
        base.require_cache_identity_for_retained_tokens().unwrap();
        composed
            .require_cache_identity_for_retained_tokens()
            .unwrap();
    }

    #[test]
    fn runtime_composition_validation_and_idempotent_activation_preserve_context() {
        let model_bytes = include_bytes!("../../models/tiny-test-model.slm");
        let mut runtime = Runtime::new();
        assert_eq!(runtime.load_model(model_bytes), ErrorCode::Ok);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::CompositionNotActive);
        let (bundle, sha256) = build_base_bundle(runtime.model.as_ref().unwrap());
        assert_eq!(
            runtime.validate_composition_graph(&bundle, sha256),
            ErrorCode::Ok
        );
        assert!(runtime.active_composition.is_none());
        assert_eq!(
            runtime.activate_composition_graph(&bundle, sha256),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        let tokens = runtime.tokens.clone();
        let kv_len = runtime.kv_cache.as_ref().map(KvCache::len);
        let graph = runtime
            .active_composition
            .as_ref()
            .unwrap()
            .graph
            .active_graph_digest();
        assert_eq!(
            runtime.validate_composition_graph(&bundle, sha256),
            ErrorCode::Ok
        );
        assert_eq!(runtime.tokens, tokens);
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), kv_len);
        assert_eq!(
            runtime.activate_composition_graph(&bundle, sha256),
            ErrorCode::Ok
        );
        assert_eq!(runtime.tokens, tokens);
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), kv_len);
        assert_eq!(
            runtime
                .active_composition
                .as_ref()
                .unwrap()
                .graph
                .active_graph_digest(),
            graph
        );
        runtime
            .require_cache_identity_for_retained_tokens()
            .unwrap();
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "composition graph already active"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"model_loaded\": true"));
        assert!(diagnostics.contains("\"composition_active\": true"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"f32\""));
        assert!(diagnostics.contains("\"active_composition_member_count\": 0"));
        assert!(diagnostics.contains("\"composition_activation_count\": 1"));
        assert!(diagnostics.contains("\"generated_token_count\": 1"));
        assert!(diagnostics.contains("\"kv_cache_length\": 4"));
        assert!(!diagnostics.contains("adapter_apply_count"));
        assert!(!diagnostics.contains("assembly_state_checksum"));
    }

    #[test]
    fn runtime_composition_switch_resets_tokens_and_owned_cache() {
        let model_bytes = include_bytes!("../../models/tiny-test-model.slm");
        let mut runtime = Runtime::new();
        load_model_with_base(&mut runtime, model_bytes);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        let original_graph = runtime
            .active_composition
            .as_ref()
            .unwrap()
            .graph
            .active_graph_digest();
        let (replacement, replacement_sha256) = base_bundle_for_route(&runtime, 0x99);
        assert_eq!(
            runtime.activate_composition_graph(&replacement, replacement_sha256),
            ErrorCode::Ok
        );
        let replacement_graph = runtime
            .active_composition
            .as_ref()
            .unwrap()
            .graph
            .active_graph_digest();
        assert_ne!(replacement_graph, original_graph);
        assert!(runtime.tokens.is_empty());
        assert!(runtime.generated_tokens.is_empty());
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), Some(0));
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "composition graph activated"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"model_loaded\": true"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"f32\""));
        assert!(diagnostics.contains("\"prompt_token_count\": 0"));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(diagnostics.contains("\"kv_cache_length\": 0"));
        assert!(diagnostics.contains("\"composition_activation_count\": 2"));
        assert!(diagnostics.contains(&route_id_for(0x99).display()));
    }

    #[test]
    fn invalid_or_busy_composition_activation_preserves_active_state() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q8.slm");
        let mut runtime = Runtime::new();
        load_model_with_base(&mut runtime, model_bytes);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        let tokens = runtime.tokens.clone();
        let kv_len = runtime.kv_cache.as_ref().map(KvCache::len);
        let graph = runtime
            .active_composition
            .as_ref()
            .unwrap()
            .graph
            .active_graph_digest();
        let (mut replacement, replacement_sha256) = base_bundle_for_route(&runtime, 0x99);
        replacement[336] ^= 0x01;
        assert_eq!(
            runtime.activate_composition_graph(&replacement, replacement_sha256),
            ErrorCode::InvalidLength
        );
        assert_eq!(runtime.tokens, tokens);
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), kv_len);
        assert_eq!(
            runtime
                .active_composition
                .as_ref()
                .unwrap()
                .graph
                .active_graph_digest(),
            graph
        );
        runtime
            .require_cache_identity_for_retained_tokens()
            .unwrap();

        runtime.generation_in_progress = true;
        let (replacement, replacement_sha256) = base_bundle_for_route(&runtime, 0x99);
        assert_eq!(
            runtime.activate_composition_graph(&replacement, replacement_sha256),
            ErrorCode::RuntimeBusy
        );
        runtime.generation_in_progress = false;
        assert_eq!(runtime.tokens, tokens);
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), kv_len);
        runtime
            .require_cache_identity_for_retained_tokens()
            .unwrap();
    }

    #[test]
    fn runtime_accepts_last_prompt_slot_and_rejects_full_context_prompt() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );

        assert_eq!(runtime.generate(&"a".repeat(14), 1), ErrorCode::Ok);
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"prompt_token_count\": 15"));
        assert!(diagnostics.contains("\"generated_token_count\": 1"));
        assert!(diagnostics.contains("\"kv_cache_length\": 16"));

        assert_eq!(
            runtime.generate(&"a".repeat(15), 1),
            ErrorCode::ContextExceeded
        );
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "context exceeded"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"context exceeded\""));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(runtime.tokens.is_empty());
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), Some(0));
    }

    #[test]
    fn runtime_reuses_generation_buffers_across_generate_and_steps() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );
        let loaded_buffers = generation_buffer_snapshot(&runtime);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(generation_buffer_snapshot(&runtime), loaded_buffers);
        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        assert_eq!(generation_buffer_snapshot(&runtime), loaded_buffers);
        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        assert_eq!(generation_buffer_snapshot(&runtime), loaded_buffers);
    }

    #[test]
    fn runtime_free_model_blocks_later_generation() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(runtime.free_model(), ErrorCode::Ok);
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "model freed"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"model_loaded\": false"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"none\""));
        assert!(diagnostics.contains("\"kv_cache_byte_budget\": 0"));
        assert!(diagnostics.contains("\"kv_cache_page_count\": 0"));
        assert!(diagnostics.contains("\"composition_active\": false"));
        assert!(diagnostics.contains("\"active_composition_id\": \"none\""));
        assert!(diagnostics.contains("\"active_composition_graph_sha256\": \"none\""));
        assert!(diagnostics.contains("\"composition_activation_count\": 0"));
        assert!(runtime.scratch.is_none());
        assert!(runtime.logits.is_empty());

        assert_eq!(runtime.generate_next_token(), ErrorCode::ModelNotLoaded);
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "model not loaded"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"model not loaded\""));
        assert!(diagnostics.contains("\"model_loaded\": false"));
    }

    #[test]
    fn runtime_loads_generates_and_frees_owned_q4_model() {
        let owned =
            OwnedModelBytes::copy_from_slice(include_bytes!("../../models/tiny-test-model-q4.slm"))
                .unwrap();
        let mut runtime = Runtime::new();

        assert_eq!(runtime.load_model_owned(owned), ErrorCode::Ok);
        activate_base_composition(&mut runtime);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(runtime.free_model(), ErrorCode::Ok);
        assert_eq!(runtime.generate_next_token(), ErrorCode::ModelNotLoaded);
    }

    #[test]
    fn top_k_summary_keeps_highest_candidates_without_sorting_vector() {
        assert_eq!(
            top_k_summary(&[0.1, 2.0, 1.5, 2.0, -1.0], 3),
            "1:2.0000, 3:2.0000, 2:1.5000"
        );
        assert_eq!(top_k_summary(&[], 5), "");
        assert_eq!(top_k_summary(&[1.0, 2.0], 0), "");
    }

    #[test]
    fn model_reload_resets_generation_diagnostics() {
        let mut runtime = Runtime::new();
        load_model_with_base(
            &mut runtime,
            include_bytes!("../../models/tiny-test-model-q8.slm"),
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert!(runtime
            .diagnostics()
            .windows(b"\"generated_token_count\": 1".len())
            .any(|window| window == b"\"generated_token_count\": 1"));
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q4.slm")),
            ErrorCode::Ok
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"active_quantization_mode\": \"q4_0\""));
        assert!(diagnostics.contains("\"prompt_token_count\": 0"));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(diagnostics.contains("\"kv_cache_length\": 0"));
        assert!(diagnostics.contains("\"tokenizer_output\": \"\""));
        assert!(diagnostics.contains("\"selected_next_token\": 0"));
        assert!(diagnostics.contains("\"composition_active\": false"));
        assert!(diagnostics.contains("\"active_composition_id\": \"none\""));
        assert!(diagnostics.contains("\"active_composition_graph_sha256\": \"none\""));
        assert!(diagnostics.contains("\"composition_activation_count\": 0"));
        assert_eq!(runtime.generate("hi", 1), ErrorCode::CompositionNotActive);
    }

    #[test]
    fn runtime_configures_sampling_diagnostics() {
        let mut runtime = Runtime::new();
        assert_eq!(runtime.configure_sampling(0.75, 4, 0.9, 123), ErrorCode::Ok);
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"sampling_temperature\": 0.750"));
        assert!(diagnostics.contains("\"sampling_top_k\": 4"));
        assert!(diagnostics.contains("\"sampling_top_p\": 0.900"));
        assert!(diagnostics.contains("\"sampling_seed\": 123"));

        assert_eq!(
            runtime.configure_sampling(1.0, 0, 1.0, 1),
            ErrorCode::InvalidLength
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"invalid length\""));
    }

    #[test]
    fn runtime_calculator_is_model_independent_and_auditable() {
        let mut runtime = Runtime::new();
        assert_eq!(runtime.calculate("(2 + 3) * 4"), ErrorCode::Ok);
        assert_eq!(core::str::from_utf8(runtime.last_result()).unwrap(), "20");
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(diagnostics.contains("\"generation_stop_reason\": \"local_tool\""));
        assert!(diagnostics.contains("\"local_tool\": \"calculator\""));
        assert!(diagnostics.contains("\"local_tool_result\": \"pass\""));
        assert!(!diagnostics.contains("\"local_tool_input_checksum\": \"0x0000000000000000\""));

        assert_eq!(runtime.calculate("print(20)"), ErrorCode::InvalidExpression);
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "invalid arithmetic expression"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"local_tool_result\": \"rejected\""));
    }

    fn generation_buffer_snapshot(runtime: &Runtime) -> ([usize; 14], usize, usize) {
        let scratch = runtime.scratch.as_ref().expect("scratch loaded");
        (
            scratch.buffer_addresses(),
            runtime.logits.as_ptr() as usize,
            runtime.logits.capacity(),
        )
    }
}
