use tinyrustlm_sampling2::{
    GenerationController, GenerationStatus, Sampling2, Sampling2Policy, Sampling2State,
    SAMPLING2_ARTIFACT_SHA256 as ACCEPTED_SAMPLING2_ARTIFACT_SHA256, SAMPLING2_FORMAT_PROFILE_ID,
    SAMPLING2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_template2::{
    ControlInsertion, Message, Template2, Template2Policy, ThinkingMode,
    QWEN3_TEMPLATE2_ARTIFACT_SHA256, TEMPLATE2_FORMAT_PROFILE_ID, TEMPLATE2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_tokenizer2::{
    Tokenizer2, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID, TOKENIZER2_FORMAT_PROFILE_SHA256,
};

use crate::format::{
    digest_matches, hex_lower, Prompt2Artifact, Prompt2Error, Prompt2Policy, MAXIMUM_PROMPT_TOKENS,
    MAXIMUM_RENDERED_BYTES, MODEL_VOCABULARY_SIZE, SAMPLING_ARTIFACT_BYTES,
    SAMPLING_ARTIFACT_SHA256, SAMPLING_PROFILE_SHA256, SOURCE_TEMPLATE_SHA256, STOP_TOKEN_IDS,
    TEMPLATE_ARTIFACT_BYTES, TEMPLATE_ARTIFACT_SHA256, TEMPLATE_PROFILE_SHA256,
    TOKENIZER_ARTIFACT_BYTES, TOKENIZER_ARTIFACT_SHA256, TOKENIZER_PROFILE_SHA256,
    TOKENIZER_TOKEN_COUNT,
};
use crate::wire::{
    parse_load_bundle, parse_request, MappedControlInsertion, Prompt2InitialStatus, Prompt2Request,
    Prompt2Result,
};

/// Fully validated Prompt2 dependency set and exact composition runtime.
#[derive(Clone, Debug)]
pub struct Prompt2Runtime {
    artifact: Prompt2Artifact,
    tokenizer: Tokenizer2,
    template: Template2,
    sampling: Sampling2,
}

impl Prompt2Runtime {
    /// Parses one exact load bundle and validates all four dependency identities.
    pub fn from_load_bundle(bytes: &[u8], maximum_bytes: usize) -> Result<Self, Prompt2Error> {
        let bundle = parse_load_bundle(bytes, maximum_bytes)?;
        Self::from_artifacts(
            bundle.prompt2(),
            bundle.tokenizer2(),
            bundle.template2(),
            bundle.sampling2(),
        )
    }

    /// Validates the exact Prompt2, Tokenizer2, Template2, and Sampling2 artifacts.
    pub fn from_artifacts(
        prompt2_bytes: &[u8],
        tokenizer2_bytes: &[u8],
        template2_bytes: &[u8],
        sampling2_bytes: &[u8],
    ) -> Result<Self, Prompt2Error> {
        validate_dependency_profiles()?;
        let artifact =
            Prompt2Artifact::from_bytes(prompt2_bytes, Prompt2Policy::exact_profile_limits())?;
        validate_dependency_identity(
            tokenizer2_bytes,
            TOKENIZER_ARTIFACT_BYTES,
            TOKENIZER_ARTIFACT_SHA256,
        )?;
        validate_dependency_identity(
            template2_bytes,
            TEMPLATE_ARTIFACT_BYTES,
            TEMPLATE_ARTIFACT_SHA256,
        )?;
        validate_dependency_identity(
            sampling2_bytes,
            SAMPLING_ARTIFACT_BYTES,
            SAMPLING_ARTIFACT_SHA256,
        )?;
        let tokenizer_policy = TokenizerPolicy::new(
            TOKENIZER_ARTIFACT_BYTES as u64,
            MAXIMUM_RENDERED_BYTES,
            MAXIMUM_PROMPT_TOKENS,
            MAXIMUM_RENDERED_BYTES,
        )
        .map_err(|_| Prompt2Error::new("prompt2-tokenizer"))?;
        let tokenizer = Tokenizer2::from_bytes(tokenizer2_bytes.to_vec(), tokenizer_policy)
            .map_err(|_| Prompt2Error::new("prompt2-tokenizer"))?;
        let template = Template2::from_bytes(
            template2_bytes.to_vec(),
            Template2Policy::exact_profile_limits(),
        )
        .map_err(|_| Prompt2Error::new("prompt2-template"))?;
        let sampling = Sampling2::from_bytes(
            sampling2_bytes.to_vec(),
            Sampling2Policy::exact_profile_limits(),
        )
        .map_err(|_| Prompt2Error::new("prompt2-sampling"))?;
        if tokenizer.token_count() != TOKENIZER_TOKEN_COUNT
            || template.profile_id() != TEMPLATE2_FORMAT_PROFILE_ID
            || template.required_tokenizer_sha256() != tokenizer.identity().sha256
            || hex_lower(&template.source_template_sha256()) != SOURCE_TEMPLATE_SHA256
            || template.stop_token_ids() != STOP_TOKEN_IDS
            || sampling.profile_id() != SAMPLING2_FORMAT_PROFILE_ID
        {
            return Err(Prompt2Error::new("prompt2-dependency-shape"));
        }
        Ok(Self {
            artifact,
            tokenizer,
            template,
            sampling,
        })
    }

    /// Parses one canonical request wire and compiles it exactly once.
    pub fn compile_request_bytes(
        &self,
        request_bytes: &[u8],
        maximum_bytes: usize,
    ) -> Result<Prompt2Plan, Prompt2Error> {
        let request = parse_request(request_bytes, maximum_bytes)?;
        self.compile(&request)
    }

    /// Renders, tokenizes, maps control insertions, and creates one controller.
    pub fn compile(&self, request: &Prompt2Request) -> Result<Prompt2Plan, Prompt2Error> {
        let messages: Vec<Message<'_>> = request
            .messages()
            .iter()
            .map(|message| Message {
                role: message.role(),
                content: message.content(),
            })
            .collect();
        let rendered = self
            .template
            .render(&messages)
            .map_err(|_| Prompt2Error::new("prompt2-template"))?;
        if rendered.as_bytes().len() > MAXIMUM_RENDERED_BYTES as usize
            || rendered.thinking_mode() != ThinkingMode::Disabled
            || rendered.stop_token_ids() != STOP_TOKEN_IDS
            || rendered.bos_inserted()
            || rendered.eos_inserted()
        {
            return Err(Prompt2Error::new("prompt2-template"));
        }
        let mut token_ids = Vec::new();
        self.tokenizer
            .encode(rendered.as_str(), &mut token_ids)
            .map_err(map_tokenizer_error)?;
        if token_ids.len() > MAXIMUM_PROMPT_TOKENS as usize
            || token_ids
                .iter()
                .any(|token_id| *token_id >= TOKENIZER_TOKEN_COUNT)
        {
            return Err(Prompt2Error::new("prompt2-prompt-limit"));
        }
        self.template
            .validate_prompt_token_count(token_ids.len() as u32)
            .map_err(|_| Prompt2Error::new("prompt2-prompt-limit"))?;
        let insertions =
            self.map_control_insertions(rendered.as_str(), &token_ids, rendered.insertions())?;
        let initial_sampling_state = Sampling2State::from_seed(request.seed());
        let controller = GenerationController::new(
            &self.sampling,
            request.sampling(),
            token_ids.len() as u32,
            MODEL_VOCABULARY_SIZE,
            &STOP_TOKEN_IDS,
            initial_sampling_state,
        )
        .map_err(|_| Prompt2Error::new("prompt2-sampling"))?;
        let initial_status = match controller.status() {
            GenerationStatus::Active => Prompt2InitialStatus::Active,
            GenerationStatus::ContextLimit => Prompt2InitialStatus::ContextLimit,
            _ => return Err(Prompt2Error::new("prompt2-sampling")),
        };
        let result = Prompt2Result::new(
            rendered.as_str().to_owned(),
            token_ids,
            insertions,
            STOP_TOKEN_IDS,
            initial_sampling_state,
            initial_status,
        )?;
        Ok(Prompt2Plan { result, controller })
    }

    /// Returns the exact Prompt2 artifact identity.
    pub const fn prompt2_artifact(&self) -> Prompt2Artifact {
        self.artifact
    }

    /// Returns the validated Sampling2 runtime used by generation controllers.
    pub const fn sampling(&self) -> &Sampling2 {
        &self.sampling
    }

    fn map_control_insertions(
        &self,
        rendered: &str,
        whole_token_ids: &[u32],
        insertions: &[ControlInsertion],
    ) -> Result<Vec<MappedControlInsertion>, Prompt2Error> {
        let rendered_bytes = rendered.as_bytes();
        let mut recomposed = Vec::with_capacity(whole_token_ids.len());
        let mut mapped = Vec::with_capacity(insertions.len());
        let mut cursor = 0_usize;
        let mut prior_byte_offset = None;
        let mut scratch = Vec::new();
        for insertion in insertions {
            let byte_offset = usize::try_from(insertion.byte_offset)
                .map_err(|_| Prompt2Error::new("prompt2-control-layout"))?;
            let literal = control_literal(insertion.token_id)?;
            let literal_end = byte_offset
                .checked_add(literal.len())
                .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?;
            if byte_offset < cursor
                || prior_byte_offset.is_some_and(|prior| byte_offset <= prior)
                || rendered_bytes.get(byte_offset..literal_end) != Some(literal)
            {
                return Err(Prompt2Error::new("prompt2-control-layout"));
            }
            let span = std::str::from_utf8(
                rendered_bytes
                    .get(cursor..byte_offset)
                    .ok_or_else(|| Prompt2Error::new("prompt2-control-layout"))?,
            )
            .map_err(|_| Prompt2Error::new("prompt2-control-layout"))?;
            self.tokenizer
                .encode(span, &mut scratch)
                .map_err(map_tokenizer_error)?;
            recomposed.extend_from_slice(&scratch);
            let token_index = recomposed.len() as u64;
            recomposed.push(insertion.token_id);
            mapped.push(MappedControlInsertion {
                kind: insertion.kind,
                message_index: insertion.message_index,
                token_id: insertion.token_id,
                byte_offset: insertion.byte_offset,
                token_index,
            });
            cursor = literal_end;
            prior_byte_offset = Some(byte_offset);
        }
        let tail = std::str::from_utf8(
            rendered_bytes
                .get(cursor..)
                .ok_or_else(|| Prompt2Error::new("prompt2-control-layout"))?,
        )
        .map_err(|_| Prompt2Error::new("prompt2-control-layout"))?;
        self.tokenizer
            .encode(tail, &mut scratch)
            .map_err(map_tokenizer_error)?;
        recomposed.extend_from_slice(&scratch);
        if recomposed != whole_token_ids
            || mapped.iter().any(|insertion| {
                whole_token_ids.get(insertion.token_index as usize) != Some(&insertion.token_id)
            })
        {
            return Err(Prompt2Error::new("prompt2-control-tokenization"));
        }
        Ok(mapped)
    }
}

/// One exact Prompt2 result paired with its live generation controller.
#[derive(Clone, Debug)]
pub struct Prompt2Plan {
    result: Prompt2Result,
    controller: GenerationController,
}

impl Prompt2Plan {
    /// Returns the immutable canonical composition result.
    pub const fn result(&self) -> &Prompt2Result {
        &self.result
    }

    /// Returns the live generation controller.
    pub const fn controller(&self) -> &GenerationController {
        &self.controller
    }

    /// Returns the mutable live generation controller.
    pub fn controller_mut(&mut self) -> &mut GenerationController {
        &mut self.controller
    }

    /// Consumes the plan into its exact result and controller.
    pub fn into_parts(self) -> (Prompt2Result, GenerationController) {
        (self.result, self.controller)
    }
}

fn validate_dependency_profiles() -> Result<(), Prompt2Error> {
    if TOKENIZER2_FORMAT_PROFILE_ID != "org.minimodel.tokenizer2/2.0"
        || TOKENIZER2_FORMAT_PROFILE_SHA256 != TOKENIZER_PROFILE_SHA256
        || TEMPLATE2_FORMAT_PROFILE_ID != "org.minimodel.template2/2.0"
        || TEMPLATE2_FORMAT_PROFILE_SHA256 != TEMPLATE_PROFILE_SHA256
        || SAMPLING2_FORMAT_PROFILE_ID != "org.minimodel.sampling2/2.0"
        || SAMPLING2_FORMAT_PROFILE_SHA256 != SAMPLING_PROFILE_SHA256
        || QWEN3_TEMPLATE2_ARTIFACT_SHA256 != TEMPLATE_ARTIFACT_SHA256
        || ACCEPTED_SAMPLING2_ARTIFACT_SHA256 != SAMPLING_ARTIFACT_SHA256
    {
        return Err(Prompt2Error::new("prompt2-dependency-profile"));
    }
    Ok(())
}

fn validate_dependency_identity(
    bytes: &[u8],
    expected_length: usize,
    expected_sha256: &str,
) -> Result<(), Prompt2Error> {
    if bytes.len() != expected_length || !digest_matches(bytes, expected_sha256)? {
        return Err(Prompt2Error::new("prompt2-dependency-identity"));
    }
    Ok(())
}

fn map_tokenizer_error(error: tinyrustlm_tokenizer2::Tokenizer2Error) -> Prompt2Error {
    if matches!(
        error.code(),
        "tokenizer2-token-limit" | "tokenizer2-output-limit"
    ) {
        Prompt2Error::new("prompt2-prompt-limit")
    } else {
        Prompt2Error::new("prompt2-tokenizer")
    }
}

fn control_literal(token_id: u32) -> Result<&'static [u8], Prompt2Error> {
    match token_id {
        151_644 => Ok(b"<|im_start|>"),
        151_645 => Ok(b"<|im_end|>"),
        151_667 => Ok(b"<think>"),
        151_668 => Ok(b"</think>"),
        _ => Err(Prompt2Error::new("prompt2-control-layout")),
    }
}
