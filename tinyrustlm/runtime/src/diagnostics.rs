//! Diagnostics and benchmark counters.

use crate::errors::ErrorCode;

/// Runtime diagnostics rendered for the browser UI.
pub struct Diagnostics {
    /// Last model load time in milliseconds.
    pub model_load_time_ms: u32,
    /// Last prompt token count.
    pub prompt_token_count: u32,
    /// Prompt tokens served from an exact retained KV-cache prefix.
    pub prefill_reused_token_count: u32,
    /// Prompt tokens evaluated during the latest prefill.
    pub prefill_computed_token_count: u32,
    /// Last generated token count.
    pub generated_token_count: u32,
    /// Last measured tokens per second.
    pub tokens_per_second: f32,
    /// Peak scratch arena usage in bytes.
    pub peak_scratch_arena_usage: usize,
    /// Current KV cache length.
    pub kv_cache_length: usize,
    /// Allocated KV cache storage size in bytes.
    pub kv_cache_byte_budget: usize,
    /// Allocated KV cache storage expressed as 64 KiB WebAssembly pages.
    pub kv_cache_page_count: usize,
    /// Active quantization mode.
    pub active_quantization_mode: &'static str,
    /// Whether a complete immutable composition graph is active.
    pub composition_active: bool,
    /// SHA-256 of the admitted canonical `ACG1` bundle.
    pub active_composition_bundle_sha256: String,
    /// Typed identity of the active immutable composition.
    pub active_composition_id: String,
    /// SHA-256 of the graph owning runtime execution and cache state.
    pub active_composition_graph_sha256: String,
    /// Typed route-policy identity bound into the active graph.
    pub active_route_policy_id: String,
    /// Typed KV-format identity bound into the active graph.
    pub active_kv_format_id: String,
    /// Number of specialist members in the active graph.
    pub active_composition_member_count: usize,
    /// Number of state-changing graph activations since model load.
    pub composition_activation_count: u32,
    /// Last error code.
    pub last_error: ErrorCode,
    /// Whether a model is loaded.
    pub model_loaded: bool,
    /// Tokenizer output for developer mode.
    pub tokenizer_output: String,
    /// Last logits summary for developer mode.
    pub logits_summary: String,
    /// Last selected token for developer mode.
    pub selected_next_token: u32,
    /// Top candidate summary for developer mode.
    pub top_k_candidates: String,
    /// Reason the last generation run stopped.
    pub generation_stop_reason: &'static str,
    /// Longest consecutive run of the same generated token in the last run.
    pub generated_max_repeated_token_run: u32,
    /// Number of distinct token ids generated in the last run.
    pub generated_distinct_token_count: u32,
    /// Sampling temperature currently used for generation.
    pub sampling_temperature: f32,
    /// Sampling top-k candidate cap currently used for generation.
    pub sampling_top_k: usize,
    /// Sampling top-p nucleus threshold currently used for generation.
    pub sampling_top_p: f32,
    /// Sampling seed currently used for deterministic stochastic decoding.
    pub sampling_seed: u64,
    /// Repetition penalty applied to recently generated tokens.
    pub sampling_repetition_penalty: f32,
    /// Name of the last deterministic local tool invoked through the runtime.
    pub local_tool: &'static str,
    /// Non-cryptographic audit checksum of the last local tool input.
    pub local_tool_input_checksum: u64,
    /// Outcome class of the last local tool invocation.
    pub local_tool_result: &'static str,
}

impl Default for Diagnostics {
    fn default() -> Self {
        Self {
            model_load_time_ms: 0,
            prompt_token_count: 0,
            prefill_reused_token_count: 0,
            prefill_computed_token_count: 0,
            generated_token_count: 0,
            tokens_per_second: 0.0,
            peak_scratch_arena_usage: 0,
            kv_cache_length: 0,
            kv_cache_byte_budget: 0,
            kv_cache_page_count: 0,
            active_quantization_mode: "none",
            composition_active: false,
            active_composition_bundle_sha256: "none".to_string(),
            active_composition_id: "none".to_string(),
            active_composition_graph_sha256: "none".to_string(),
            active_route_policy_id: "none".to_string(),
            active_kv_format_id: "none".to_string(),
            active_composition_member_count: 0,
            composition_activation_count: 0,
            last_error: ErrorCode::Ok,
            model_loaded: false,
            tokenizer_output: String::new(),
            logits_summary: String::new(),
            selected_next_token: 0,
            top_k_candidates: String::new(),
            generation_stop_reason: "none",
            generated_max_repeated_token_run: 0,
            generated_distinct_token_count: 0,
            sampling_temperature: 0.0,
            sampling_top_k: 1,
            sampling_top_p: 1.0,
            sampling_seed: 1,
            sampling_repetition_penalty: 1.0,
            local_tool: "none",
            local_tool_input_checksum: 0,
            local_tool_result: "none",
        }
    }
}

impl Diagnostics {
    /// Clears generation-specific counters and developer fields.
    pub fn reset_generation(&mut self) {
        self.prompt_token_count = 0;
        self.prefill_reused_token_count = 0;
        self.prefill_computed_token_count = 0;
        self.generated_token_count = 0;
        self.tokens_per_second = 0.0;
        self.peak_scratch_arena_usage = 0;
        self.kv_cache_length = 0;
        self.tokenizer_output.clear();
        self.logits_summary.clear();
        self.selected_next_token = 0;
        self.top_k_candidates.clear();
        self.generation_stop_reason = "none";
        self.generated_max_repeated_token_run = 0;
        self.generated_distinct_token_count = 0;
        self.reset_local_tool();
    }

    /// Records a deterministic local tool invocation without claiming model tokens.
    pub fn record_local_tool(
        &mut self,
        name: &'static str,
        input_checksum: u64,
        result: &'static str,
    ) {
        self.prompt_token_count = 0;
        self.prefill_reused_token_count = 0;
        self.prefill_computed_token_count = 0;
        self.generated_token_count = 0;
        self.tokens_per_second = 0.0;
        self.peak_scratch_arena_usage = 0;
        self.tokenizer_output.clear();
        self.logits_summary.clear();
        self.selected_next_token = 0;
        self.top_k_candidates.clear();
        self.generation_stop_reason = "local_tool";
        self.generated_max_repeated_token_run = 0;
        self.generated_distinct_token_count = 0;
        self.local_tool = name;
        self.local_tool_input_checksum = input_checksum;
        self.local_tool_result = result;
    }

    /// Clears local-tool diagnostics before model generation or runtime reset.
    pub fn reset_local_tool(&mut self) {
        self.local_tool = "none";
        self.local_tool_input_checksum = 0;
        self.local_tool_result = "none";
    }

    /// Records token-level quality signals for the latest generation run.
    pub fn record_generation_quality(
        &mut self,
        generated_tokens: &[u32],
        stop_reason: &'static str,
    ) {
        self.generation_stop_reason = stop_reason;
        self.generated_max_repeated_token_run = max_repeated_run(generated_tokens);
        self.generated_distinct_token_count = distinct_count(generated_tokens);
    }

    /// Records the model-specific KV cache allocation after a model load.
    pub fn record_kv_cache_allocation(&mut self, byte_budget: usize, page_count: usize) {
        self.kv_cache_byte_budget = byte_budget;
        self.kv_cache_page_count = page_count;
    }

    /// Clears KV cache allocation diagnostics when no model is loaded.
    pub fn reset_kv_cache_allocation(&mut self) {
        self.kv_cache_length = 0;
        self.kv_cache_byte_budget = 0;
        self.kv_cache_page_count = 0;
    }

    /// Records a state-changing activation of one fully validated immutable graph.
    pub fn record_composition_activation(
        &mut self,
        bundle_sha256: String,
        composition_id: String,
        graph_sha256: String,
        route_policy_id: String,
        kv_format_id: String,
        member_count: usize,
    ) {
        self.composition_active = true;
        self.active_composition_bundle_sha256 = bundle_sha256;
        self.active_composition_id = composition_id;
        self.active_composition_graph_sha256 = graph_sha256;
        self.active_route_policy_id = route_policy_id;
        self.active_kv_format_id = kv_format_id;
        self.active_composition_member_count = member_count;
        self.composition_activation_count = self.composition_activation_count.saturating_add(1);
    }

    /// Clears all active-composition claims on model replacement or free.
    pub fn reset_active_composition(&mut self) {
        self.composition_active = false;
        self.active_composition_bundle_sha256.clear();
        self.active_composition_bundle_sha256.push_str("none");
        self.active_composition_id.clear();
        self.active_composition_id.push_str("none");
        self.active_composition_graph_sha256.clear();
        self.active_composition_graph_sha256.push_str("none");
        self.active_route_policy_id.clear();
        self.active_route_policy_id.push_str("none");
        self.active_kv_format_id.clear();
        self.active_kv_format_id.push_str("none");
        self.active_composition_member_count = 0;
        self.composition_activation_count = 0;
    }

    /// Records an error for the next diagnostics render.
    pub fn record_error(&mut self, error: ErrorCode) {
        self.last_error = error;
    }

    /// Renders diagnostics as JSON without using serde.
    pub fn render_json(&self, out: &mut Vec<u8>) {
        out.clear();
        let text = format!(
            "{{\n  \"model_load_time_ms\": {},\n  \"prompt_token_count\": {},\n  \"prefill_reused_token_count\": {},\n  \"prefill_computed_token_count\": {},\n  \"generated_token_count\": {},\n  \"tokens_per_second\": {:.3},\n  \"peak_scratch_arena_usage\": {},\n  \"kv_cache_length\": {},\n  \"kv_cache_byte_budget\": {},\n  \"kv_cache_page_count\": {},\n  \"active_quantization_mode\": \"{}\",\n  \"composition_active\": {},\n  \"active_composition_bundle_sha256\": \"{}\",\n  \"active_composition_id\": \"{}\",\n  \"active_composition_graph_sha256\": \"{}\",\n  \"active_route_policy_id\": \"{}\",\n  \"active_kv_format_id\": \"{}\",\n  \"active_composition_member_count\": {},\n  \"composition_activation_count\": {},\n  \"model_loaded\": {},\n  \"last_error\": \"{}\",\n  \"tokenizer_output\": \"{}\",\n  \"logits_summary\": \"{}\",\n  \"selected_next_token\": {},\n  \"top_k_candidates\": \"{}\",\n  \"generation_stop_reason\": \"{}\",\n  \"generated_max_repeated_token_run\": {},\n  \"generated_distinct_token_count\": {},\n  \"sampling_temperature\": {:.3},\n  \"sampling_top_k\": {},\n  \"sampling_top_p\": {:.3},\n  \"sampling_seed\": {},\n  \"sampling_repetition_penalty\": {:.3},\n  \"local_tool\": \"{}\",\n  \"local_tool_input_checksum\": \"0x{:016x}\",\n  \"local_tool_result\": \"{}\"\n}}",
            self.model_load_time_ms,
            self.prompt_token_count,
            self.prefill_reused_token_count,
            self.prefill_computed_token_count,
            self.generated_token_count,
            self.tokens_per_second,
            self.peak_scratch_arena_usage,
            self.kv_cache_length,
            self.kv_cache_byte_budget,
            self.kv_cache_page_count,
            self.active_quantization_mode,
            if self.composition_active {
                "true"
            } else {
                "false"
            },
            json_escape(&self.active_composition_bundle_sha256),
            json_escape(&self.active_composition_id),
            json_escape(&self.active_composition_graph_sha256),
            json_escape(&self.active_route_policy_id),
            json_escape(&self.active_kv_format_id),
            self.active_composition_member_count,
            self.composition_activation_count,
            if self.model_loaded { "true" } else { "false" },
            self.last_error.message(),
            json_escape(&self.tokenizer_output),
            json_escape(&self.logits_summary),
            self.selected_next_token,
            json_escape(&self.top_k_candidates),
            self.generation_stop_reason,
            self.generated_max_repeated_token_run,
            self.generated_distinct_token_count,
            self.sampling_temperature,
            self.sampling_top_k,
            self.sampling_top_p,
            self.sampling_seed,
            self.sampling_repetition_penalty,
            self.local_tool,
            self.local_tool_input_checksum,
            self.local_tool_result,
        );
        out.extend_from_slice(text.as_bytes());
    }
}

fn json_escape(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\u{0008}' => escaped.push_str("\\b"),
            '\u{000C}' => escaped.push_str("\\f"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            '\u{2028}' => escaped.push_str("\\u2028"),
            '\u{2029}' => escaped.push_str("\\u2029"),
            ch if ch <= '\u{001F}' => {
                escaped.push_str("\\u00");
                escaped.push(hex_digit(((ch as u32) >> 4) as u8));
                escaped.push(hex_digit((ch as u32 & 0x0F) as u8));
            }
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn max_repeated_run(tokens: &[u32]) -> u32 {
    let Some(first) = tokens.first().copied() else {
        return 0;
    };
    let mut previous = first;
    let mut current = 1u32;
    let mut max_run = 1u32;
    for token in tokens.iter().copied().skip(1) {
        if token == previous {
            current = current.saturating_add(1);
        } else {
            previous = token;
            current = 1;
        }
        max_run = max_run.max(current);
    }
    max_run
}

fn distinct_count(tokens: &[u32]) -> u32 {
    let mut count = 0u32;
    for (index, token) in tokens.iter().enumerate() {
        if !tokens[..index].contains(token) {
            count = count.saturating_add(1);
        }
    }
    count
}

fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'A' + (value - 10)) as char,
    }
}

#[cfg(test)]
mod tests {
    use super::Diagnostics;

    #[test]
    fn diagnostics_json_escapes_control_characters() {
        let diagnostics = Diagnostics {
            tokenizer_output: "quote \" slash \\ bell \u{0007} next\nline".to_string(),
            logits_summary: "separator \u{2028} paragraph \u{2029}".to_string(),
            top_k_candidates: "tab\tform\u{000C}back\u{0008}".to_string(),
            ..Diagnostics::default()
        };

        let mut rendered = Vec::new();
        diagnostics.render_json(&mut rendered);
        let text = core::str::from_utf8(&rendered).expect("diagnostics JSON is UTF-8");

        assert!(text.contains("quote \\\" slash \\\\ bell \\u0007 next\\nline"));
        assert!(text.contains("separator \\u2028 paragraph \\u2029"));
        assert!(text.contains("tab\\tform\\fback\\b"));
        assert!(text.contains("\"kv_cache_byte_budget\": 0"));
        assert!(text.contains("\"kv_cache_page_count\": 0"));
        assert!(text.contains("\"prefill_reused_token_count\": 0"));
        assert!(text.contains("\"prefill_computed_token_count\": 0"));
        assert!(text.contains("\"composition_active\": false"));
        assert!(text.contains("\"active_composition_bundle_sha256\": \"none\""));
        assert!(text.contains("\"active_composition_id\": \"none\""));
        assert!(text.contains("\"active_composition_graph_sha256\": \"none\""));
        assert!(text.contains("\"active_composition_member_count\": 0"));
        assert!(text.contains("\"composition_activation_count\": 0"));
        assert!(!text.contains("adapter_apply_count"));
        assert!(!text.contains("assembly_state_checksum"));
    }

    #[test]
    fn diagnostics_records_and_clears_kv_cache_allocation() {
        let mut diagnostics = Diagnostics::default();
        diagnostics.record_kv_cache_allocation(131_072, 2);
        diagnostics.kv_cache_length = 7;
        diagnostics.prefill_reused_token_count = 5;
        diagnostics.prefill_computed_token_count = 2;
        diagnostics.reset_generation();
        assert_eq!(diagnostics.kv_cache_length, 0);
        assert_eq!(diagnostics.prefill_reused_token_count, 0);
        assert_eq!(diagnostics.prefill_computed_token_count, 0);
        assert_eq!(diagnostics.kv_cache_byte_budget, 131_072);
        assert_eq!(diagnostics.kv_cache_page_count, 2);

        diagnostics.reset_kv_cache_allocation();
        assert_eq!(diagnostics.kv_cache_byte_budget, 0);
        assert_eq!(diagnostics.kv_cache_page_count, 0);
    }

    #[test]
    fn diagnostics_records_generation_quality_signals() {
        let mut diagnostics = Diagnostics::default();
        diagnostics.record_generation_quality(&[1, 2, 2, 2, 3, 3], "max_new_tokens");

        assert_eq!(diagnostics.generation_stop_reason, "max_new_tokens");
        assert_eq!(diagnostics.generated_max_repeated_token_run, 3);
        assert_eq!(diagnostics.generated_distinct_token_count, 3);

        let mut rendered = Vec::new();
        diagnostics.render_json(&mut rendered);
        let text = core::str::from_utf8(&rendered).expect("diagnostics JSON is UTF-8");
        assert!(text.contains("\"generation_stop_reason\": \"max_new_tokens\""));
        assert!(text.contains("\"generated_max_repeated_token_run\": 3"));
        assert!(text.contains("\"generated_distinct_token_count\": 3"));
    }

    #[test]
    fn diagnostics_separates_local_tool_results_from_model_tokens() {
        let mut diagnostics = Diagnostics {
            generated_token_count: 7,
            ..Diagnostics::default()
        };
        diagnostics.record_local_tool("calculator", 0x1234, "pass");

        assert_eq!(diagnostics.generated_token_count, 0);
        assert_eq!(diagnostics.local_tool, "calculator");
        assert_eq!(diagnostics.local_tool_input_checksum, 0x1234);
        assert_eq!(diagnostics.generation_stop_reason, "local_tool");

        diagnostics.reset_generation();
        assert_eq!(diagnostics.local_tool, "none");
        assert_eq!(diagnostics.local_tool_input_checksum, 0);
        assert_eq!(diagnostics.local_tool_result, "none");
    }

    #[test]
    fn diagnostics_records_and_clears_cryptographic_composition_state() {
        let mut diagnostics = Diagnostics::default();
        diagnostics.record_composition_activation(
            "sha256:bundle".to_string(),
            "composition-sha256-id".to_string(),
            "sha256:graph".to_string(),
            "route-policy-sha256-id".to_string(),
            "kv-format-sha256-id".to_string(),
            2,
        );
        assert!(diagnostics.composition_active);
        assert_eq!(
            diagnostics.active_composition_bundle_sha256,
            "sha256:bundle"
        );
        assert_eq!(diagnostics.active_composition_id, "composition-sha256-id");
        assert_eq!(diagnostics.active_composition_graph_sha256, "sha256:graph");
        assert_eq!(diagnostics.active_route_policy_id, "route-policy-sha256-id");
        assert_eq!(diagnostics.active_kv_format_id, "kv-format-sha256-id");
        assert_eq!(diagnostics.active_composition_member_count, 2);
        assert_eq!(diagnostics.composition_activation_count, 1);

        diagnostics.reset_active_composition();
        assert!(!diagnostics.composition_active);
        assert_eq!(diagnostics.active_composition_bundle_sha256, "none");
        assert_eq!(diagnostics.active_composition_id, "none");
        assert_eq!(diagnostics.active_composition_graph_sha256, "none");
        assert_eq!(diagnostics.active_route_policy_id, "none");
        assert_eq!(diagnostics.active_kv_format_id, "none");
        assert_eq!(diagnostics.active_composition_member_count, 0);
        assert_eq!(diagnostics.composition_activation_count, 0);
    }
}
