use std::collections::HashSet;

use sha2::{Digest, Sha256};

use crate::format::{
    canonical_layout, hex_lower, validate_profile_identity, Layout, Template2Error,
    TemplateIdentity, END_OF_TEXT_TOKEN_ID, EXPECTED_LITERALS, FLAG_ADDED_TOKEN,
    FLAG_FORBIDDEN_CONTENT, FLAG_SPECIAL_TOKEN, FORMAT_ID, HEADER_BYTES, KNOWN_LITERAL_FLAGS,
    LITERAL_COUNT, LITERAL_RECORD_BYTES, MAGIC, MAXIMUM_ARTIFACT_BYTES, MAXIMUM_MESSAGES,
    MAXIMUM_MESSAGE_CONTENT_BYTES, MAXIMUM_PROMPT_TOKENS, MAXIMUM_RENDERED_BYTES,
    MAXIMUM_TOTAL_CONTENT_BYTES, MESSAGE_END_TOKEN_ID, MESSAGE_START_TOKEN_ID,
    MODEL_VOCABULARY_SIZE, NONE_TOKEN_ID, QWEN3_TEMPLATE2_ARTIFACT_SHA256,
    SOURCE_MODEL_CONFIG_SHA256, SOURCE_TEMPLATE_SHA256, TEMPLATE2_FORMAT_PROFILE_ID,
    THINKING_END_TOKEN_ID, THINKING_START_TOKEN_ID, TOKENIZER_ARTIFACT_BYTES, TOKENIZER_SHA256,
    TOKENIZER_TOKEN_COUNT,
};

/// Caller-selected resource ceilings for one validated Template2 runtime.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Template2Policy {
    maximum_artifact_bytes: u64,
    maximum_messages: u32,
    maximum_message_content_bytes: u32,
    maximum_total_content_bytes: u32,
    maximum_rendered_bytes: u32,
    maximum_prompt_tokens: u32,
}

impl Template2Policy {
    /// Constructs policy ceilings no larger than the frozen artifact profile.
    pub fn new(
        maximum_artifact_bytes: u64,
        maximum_messages: u32,
        maximum_message_content_bytes: u32,
        maximum_total_content_bytes: u32,
        maximum_rendered_bytes: u32,
        maximum_prompt_tokens: u32,
    ) -> Result<Self, Template2Error> {
        if maximum_artifact_bytes == 0
            || maximum_artifact_bytes > MAXIMUM_ARTIFACT_BYTES
            || maximum_messages == 0
            || maximum_messages > MAXIMUM_MESSAGES
            || maximum_message_content_bytes == 0
            || maximum_message_content_bytes > MAXIMUM_MESSAGE_CONTENT_BYTES
            || maximum_total_content_bytes == 0
            || maximum_total_content_bytes > MAXIMUM_TOTAL_CONTENT_BYTES
            || maximum_rendered_bytes == 0
            || maximum_rendered_bytes > MAXIMUM_RENDERED_BYTES
            || maximum_prompt_tokens == 0
            || maximum_prompt_tokens > MAXIMUM_PROMPT_TOKENS
        {
            return Err(Template2Error::new("template2-policy"));
        }
        Ok(Self {
            maximum_artifact_bytes,
            maximum_messages,
            maximum_message_content_bytes,
            maximum_total_content_bytes,
            maximum_rendered_bytes,
            maximum_prompt_tokens,
        })
    }

    /// Returns a policy matching every frozen profile maximum exactly.
    pub fn exact_profile_limits() -> Self {
        Self {
            maximum_artifact_bytes: MAXIMUM_ARTIFACT_BYTES,
            maximum_messages: MAXIMUM_MESSAGES,
            maximum_message_content_bytes: MAXIMUM_MESSAGE_CONTENT_BYTES,
            maximum_total_content_bytes: MAXIMUM_TOTAL_CONTENT_BYTES,
            maximum_rendered_bytes: MAXIMUM_RENDERED_BYTES,
            maximum_prompt_tokens: MAXIMUM_PROMPT_TOKENS,
        }
    }

    /// Returns the maximum accepted prompt-token count.
    pub const fn maximum_prompt_tokens(self) -> u32 {
        self.maximum_prompt_tokens
    }
}

/// One accepted conversational role in the frozen profile.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    /// Optional first system instruction.
    System,
    /// User turn.
    User,
    /// Prior assistant turn.
    Assistant,
}

/// One flat string-content message supplied to the renderer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Message<'a> {
    /// Exact closed-enum role.
    pub role: Role,
    /// Exact UTF-8 content inserted without normalization or trimming.
    pub content: &'a str,
}

/// Frozen generation thinking behavior.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ThinkingMode {
    /// Emit the publisher's explicit disabled-thinking prefix.
    Disabled,
}

/// Semantic kind of one template-owned control-token insertion.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ControlKind {
    /// Start marker for one supplied message.
    MessageStart,
    /// End marker for one supplied message.
    MessageEnd,
    /// Start marker for the generated assistant turn.
    GenerationStart,
    /// Opening thinking marker in the disabled-thinking prefix.
    ThinkingStart,
    /// Closing thinking marker in the disabled-thinking prefix.
    ThinkingEnd,
}

/// One exact template-owned control-token insertion and rendered byte offset.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ControlInsertion {
    /// Semantic insertion kind.
    pub kind: ControlKind,
    /// Source message index, or absence for generation-prefix insertions.
    pub message_index: Option<u32>,
    /// Exact Tokenizer2 token ID represented by the inserted bytes.
    pub token_id: u32,
    /// Zero-based UTF-8 byte offset in the rendered prompt.
    pub byte_offset: u64,
}

/// Complete fail-atomic prompt rendering result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenderedPrompt {
    utf8: String,
    insertions: Vec<ControlInsertion>,
}

impl RenderedPrompt {
    /// Returns the exact rendered UTF-8 bytes as a string.
    pub fn as_str(&self) -> &str {
        &self.utf8
    }

    /// Returns the exact rendered UTF-8 bytes.
    pub fn as_bytes(&self) -> &[u8] {
        self.utf8.as_bytes()
    }

    /// Returns all template-owned control insertions in byte-offset order.
    pub fn insertions(&self) -> &[ControlInsertion] {
        &self.insertions
    }

    /// Returns the explicit frozen thinking mode.
    pub const fn thinking_mode(&self) -> ThinkingMode {
        ThinkingMode::Disabled
    }

    /// Returns the ordered generation stop-token set.
    pub const fn stop_token_ids(&self) -> [u32; 2] {
        [MESSAGE_END_TOKEN_ID, END_OF_TEXT_TOKEN_ID]
    }

    /// Reports that no beginning-of-sequence token was inserted.
    pub const fn bos_inserted(&self) -> bool {
        false
    }

    /// Reports that no automatic end-of-sequence token was inserted.
    pub const fn eos_inserted(&self) -> bool {
        false
    }
}

#[derive(Clone, Debug)]
struct Literal {
    flags: u16,
    bytes: Vec<u8>,
}

/// Validated, bounded Template2 artifact and renderer.
#[derive(Clone, Debug)]
pub struct Template2 {
    identity: TemplateIdentity,
    literals: Vec<Literal>,
    policy: Template2Policy,
}

impl Template2 {
    /// Parses and fully validates one canonical Template2 artifact.
    pub fn from_bytes(bytes: Vec<u8>, policy: Template2Policy) -> Result<Self, Template2Error> {
        validate_profile_identity()?;
        if bytes.len() as u64 > policy.maximum_artifact_bytes {
            return Err(Template2Error::new("template2-artifact-limit"));
        }
        let layout = validate_header(&bytes)?;
        if !all_zero(
            &bytes,
            usize::try_from(layout.literal_table_end)
                .map_err(|_| Template2Error::new("template2-layout"))?,
            usize::try_from(layout.byte_table_offset)
                .map_err(|_| Template2Error::new("template2-layout"))?,
        ) {
            return Err(Template2Error::new("template2-padding"));
        }
        let literals = parse_literals(&bytes, layout)?;
        let digest: [u8; 32] = Sha256::digest(&bytes).into();
        if hex_lower(&digest) != QWEN3_TEMPLATE2_ARTIFACT_SHA256 {
            return Err(Template2Error::new("template2-artifact-identity"));
        }
        Ok(Self {
            identity: TemplateIdentity {
                byte_length: bytes.len() as u64,
                sha256: digest,
            },
            literals,
            policy,
        })
    }

    /// Returns the exact whole-artifact identity.
    pub const fn identity(&self) -> TemplateIdentity {
        self.identity
    }

    /// Returns the required Tokenizer2 artifact SHA-256.
    pub const fn required_tokenizer_sha256(&self) -> [u8; 32] {
        TOKENIZER_SHA256
    }

    /// Returns the exact source publisher template SHA-256.
    pub const fn source_template_sha256(&self) -> [u8; 32] {
        SOURCE_TEMPLATE_SHA256
    }

    /// Returns the frozen renderer profile identifier.
    pub const fn profile_id(&self) -> &'static str {
        TEMPLATE2_FORMAT_PROFILE_ID
    }

    /// Returns the ordered generation stop-token set.
    pub const fn stop_token_ids(&self) -> [u32; 2] {
        [MESSAGE_END_TOKEN_ID, END_OF_TEXT_TOKEN_ID]
    }

    /// Checks a post-tokenization prompt count against the active policy.
    pub fn validate_prompt_token_count(&self, token_count: u32) -> Result<(), Template2Error> {
        if token_count > self.policy.maximum_prompt_tokens {
            return Err(Template2Error::new("template2-token-limit"));
        }
        Ok(())
    }

    /// Renders a next-assistant prompt after validating the complete request.
    pub fn render(&self, messages: &[Message<'_>]) -> Result<RenderedPrompt, Template2Error> {
        let validated = self.validate_messages(messages)?;
        let start = &self.literals[0].bytes;
        let end = &self.literals[1].bytes;
        let newline = &self.literals[5].bytes;
        let thinking_disabled = &self.literals[6].bytes;
        let assistant = &self.literals[4].bytes;

        let mut rendered_length = checked_sum(&[
            start.len(),
            assistant.len(),
            newline.len(),
            thinking_disabled.len(),
        ])?;
        for message in &validated {
            rendered_length = rendered_length
                .checked_add(checked_sum(&[
                    start.len(),
                    self.role_bytes(message.role).len(),
                    newline.len(),
                    message.content.len(),
                    end.len(),
                    newline.len(),
                ])?)
                .ok_or_else(|| Template2Error::new("template2-rendered-limit"))?;
        }
        if rendered_length > self.policy.maximum_rendered_bytes as usize {
            return Err(Template2Error::new("template2-rendered-limit"));
        }

        let mut output = Vec::with_capacity(rendered_length);
        let mut insertions = Vec::with_capacity(messages.len() * 2 + 3);
        for (index, message) in validated.iter().enumerate() {
            insertions.push(ControlInsertion {
                kind: ControlKind::MessageStart,
                message_index: Some(index as u32),
                token_id: MESSAGE_START_TOKEN_ID,
                byte_offset: output.len() as u64,
            });
            output.extend_from_slice(start);
            output.extend_from_slice(self.role_bytes(message.role));
            output.extend_from_slice(newline);
            output.extend_from_slice(message.content);
            insertions.push(ControlInsertion {
                kind: ControlKind::MessageEnd,
                message_index: Some(index as u32),
                token_id: MESSAGE_END_TOKEN_ID,
                byte_offset: output.len() as u64,
            });
            output.extend_from_slice(end);
            output.extend_from_slice(newline);
        }
        insertions.push(ControlInsertion {
            kind: ControlKind::GenerationStart,
            message_index: None,
            token_id: MESSAGE_START_TOKEN_ID,
            byte_offset: output.len() as u64,
        });
        output.extend_from_slice(start);
        output.extend_from_slice(assistant);
        output.extend_from_slice(newline);
        insertions.push(ControlInsertion {
            kind: ControlKind::ThinkingStart,
            message_index: None,
            token_id: THINKING_START_TOKEN_ID,
            byte_offset: output.len() as u64,
        });
        insertions.push(ControlInsertion {
            kind: ControlKind::ThinkingEnd,
            message_index: None,
            token_id: THINKING_END_TOKEN_ID,
            byte_offset: output.len() as u64 + b"<think>\n\n".len() as u64,
        });
        output.extend_from_slice(thinking_disabled);
        if output.len() != rendered_length {
            return Err(Template2Error::new("template2-render-length"));
        }
        let utf8 = String::from_utf8(output)
            .map_err(|_| Template2Error::new("template2-rendered-utf8"))?;
        Ok(RenderedPrompt { utf8, insertions })
    }

    fn validate_messages<'a>(
        &self,
        messages: &'a [Message<'a>],
    ) -> Result<Vec<ValidatedMessage<'a>>, Template2Error> {
        if messages.is_empty() || messages.len() > self.policy.maximum_messages as usize {
            return Err(Template2Error::new("template2-message-count"));
        }
        let conversational_start = usize::from(messages[0].role == Role::System);
        if conversational_start >= messages.len() {
            return Err(Template2Error::new("template2-role-order"));
        }
        let mut total_content = 0_usize;
        let mut validated = Vec::with_capacity(messages.len());
        for (index, message) in messages.iter().enumerate() {
            if !(index == 0 && message.role == Role::System) {
                let conversational_index = index
                    .checked_sub(conversational_start)
                    .ok_or_else(|| Template2Error::new("template2-role-order"))?;
                let expected = if conversational_index.is_multiple_of(2) {
                    Role::User
                } else {
                    Role::Assistant
                };
                if message.role != expected {
                    return Err(Template2Error::new("template2-role-order"));
                }
            }
            let content = message.content.as_bytes();
            if content.len() > self.policy.maximum_message_content_bytes as usize {
                return Err(Template2Error::new("template2-content-limit"));
            }
            total_content = total_content
                .checked_add(content.len())
                .ok_or_else(|| Template2Error::new("template2-total-content-limit"))?;
            if total_content > self.policy.maximum_total_content_bytes as usize {
                return Err(Template2Error::new("template2-total-content-limit"));
            }
            for literal in &self.literals {
                if literal.flags & FLAG_FORBIDDEN_CONTENT != 0
                    && contains_bytes(content, &literal.bytes)
                {
                    return Err(Template2Error::new("template2-content-control-token"));
                }
            }
            validated.push(ValidatedMessage {
                role: message.role,
                content,
            });
        }
        if messages.last().map(|message| message.role) != Some(Role::User) {
            return Err(Template2Error::new("template2-role-order"));
        }
        Ok(validated)
    }

    fn role_bytes(&self, role: Role) -> &[u8] {
        match role {
            Role::System => &self.literals[2].bytes,
            Role::User => &self.literals[3].bytes,
            Role::Assistant => &self.literals[4].bytes,
        }
    }
}

#[derive(Clone, Copy)]
struct ValidatedMessage<'a> {
    role: Role,
    content: &'a [u8],
}

fn validate_header(bytes: &[u8]) -> Result<Layout, Template2Error> {
    let layout = canonical_layout()?;
    if bytes.len() < HEADER_BYTES as usize
        || bytes.get(0..8) != Some(MAGIC.as_slice())
        || bytes.get(8..24) != Some(FORMAT_ID.as_slice())
        || read_u32(bytes, 24)? != HEADER_BYTES as u32
        || read_u16(bytes, 28)? != 2
        || read_u16(bytes, 30)? != 0
        || read_u32(bytes, 32)? != 0x0102_0304
    {
        return Err(Template2Error::new("template2-header"));
    }
    if read_u16(bytes, 36)? != 1
        || read_u16(bytes, 38)? != 0
        || !all_zero(bytes, 246, HEADER_BYTES as usize)
    {
        return Err(Template2Error::new("template2-profile"));
    }
    if read_u64(bytes, 40)? != bytes.len() as u64 || bytes.len() as u64 != layout.file_size {
        return Err(Template2Error::new("template2-header"));
    }
    if read_u64(bytes, 48)? != layout.literal_table_offset
        || read_u32(bytes, 56)? != LITERAL_COUNT
        || read_u32(bytes, 60)? != LITERAL_RECORD_BYTES as u32
        || read_u64(bytes, 64)? != layout.byte_table_offset
        || read_u64(bytes, 72)? != layout.byte_table_length
    {
        return Err(Template2Error::new("template2-layout"));
    }
    if bytes.get(80..112) != Some(TOKENIZER_SHA256.as_slice())
        || bytes.get(112..144) != Some(SOURCE_TEMPLATE_SHA256.as_slice())
        || bytes.get(144..176) != Some(SOURCE_MODEL_CONFIG_SHA256.as_slice())
    {
        return Err(Template2Error::new("template2-source-binding"));
    }
    if read_u32(bytes, 176)? != 4_168
        || read_u64(bytes, 180)? != TOKENIZER_ARTIFACT_BYTES
        || read_u32(bytes, 188)? != TOKENIZER_TOKEN_COUNT
        || read_u32(bytes, 192)? != MODEL_VOCABULARY_SIZE
        || read_u32(bytes, 196)? != MESSAGE_START_TOKEN_ID
        || read_u32(bytes, 200)? != MESSAGE_END_TOKEN_ID
        || read_u32(bytes, 204)? != MESSAGE_END_TOKEN_ID
        || read_u32(bytes, 208)? != END_OF_TEXT_TOKEN_ID
        || read_u32(bytes, 212)? != MAXIMUM_MESSAGES
        || read_u32(bytes, 216)? != MAXIMUM_MESSAGE_CONTENT_BYTES
        || read_u32(bytes, 220)? != MAXIMUM_TOTAL_CONTENT_BYTES
        || read_u32(bytes, 224)? != MAXIMUM_RENDERED_BYTES
        || read_u32(bytes, 228)? != MAXIMUM_PROMPT_TOKENS
    {
        return Err(Template2Error::new("template2-token-binding"));
    }
    if read_u16(bytes, 232)? != 0
        || read_u16(bytes, 234)? != 3
        || read_u16(bytes, 236)? != 1
        || read_u16(bytes, 238)? != 1
        || read_u16(bytes, 240)? != 1
        || read_u16(bytes, 242)? != 0
        || read_u16(bytes, 244)? != 1
    {
        return Err(Template2Error::new("template2-profile"));
    }
    Ok(layout)
}

fn parse_literals(bytes: &[u8], layout: Layout) -> Result<Vec<Literal>, Template2Error> {
    let mut expected_relative_offset = 0_u64;
    let mut byte_owners = HashSet::with_capacity(EXPECTED_LITERALS.len());
    let mut token_owners = HashSet::with_capacity(EXPECTED_LITERALS.len());
    let mut literals = Vec::with_capacity(EXPECTED_LITERALS.len());
    for (index, expected) in EXPECTED_LITERALS.iter().enumerate() {
        let record_offset = usize::try_from(layout.literal_table_offset)
            .map_err(|_| Template2Error::new("template2-layout"))?
            + index * LITERAL_RECORD_BYTES as usize;
        let relative_offset = read_u64(bytes, record_offset)?;
        let byte_length = read_u32(bytes, record_offset + 8)? as u64;
        let kind = read_u16(bytes, record_offset + 12)?;
        let flags = read_u16(bytes, record_offset + 14)?;
        let token_id = read_u32(bytes, record_offset + 16)?;
        let reserved = read_u32(bytes, record_offset + 20)?;
        if relative_offset != expected_relative_offset
            || byte_length == 0
            || reserved != 0
            || relative_offset
                .checked_add(byte_length)
                .filter(|end| *end <= layout.byte_table_length)
                .is_none()
        {
            return Err(Template2Error::new("template2-literal-record"));
        }
        if kind != expected.kind {
            return Err(Template2Error::new("template2-literal-order"));
        }
        if flags & !KNOWN_LITERAL_FLAGS != 0
            || flags != expected.flags
            || flags & FLAG_SPECIAL_TOKEN != 0 && flags & FLAG_ADDED_TOKEN == 0
        {
            return Err(Template2Error::new("template2-literal-flags"));
        }
        if token_id != expected.token_id
            || (flags & FLAG_ADDED_TOKEN != 0) != (token_id != NONE_TOKEN_ID)
            || token_id != NONE_TOKEN_ID && token_id >= TOKENIZER_TOKEN_COUNT
        {
            return Err(Template2Error::new("template2-token-binding"));
        }
        let start = usize::try_from(
            layout
                .byte_table_offset
                .checked_add(relative_offset)
                .ok_or_else(|| Template2Error::new("template2-layout"))?,
        )
        .map_err(|_| Template2Error::new("template2-layout"))?;
        let end = start
            .checked_add(byte_length as usize)
            .ok_or_else(|| Template2Error::new("template2-layout"))?;
        let literal_bytes = bytes
            .get(start..end)
            .ok_or_else(|| Template2Error::new("template2-layout"))?;
        if std::str::from_utf8(literal_bytes).is_err() {
            return Err(Template2Error::new("template2-literal-utf8"));
        }
        if literal_bytes != expected.bytes {
            return Err(Template2Error::new("template2-literal-bytes"));
        }
        if !byte_owners.insert(literal_bytes.to_vec()) {
            return Err(Template2Error::new("template2-duplicate-literal"));
        }
        if token_id != NONE_TOKEN_ID && !token_owners.insert(token_id) {
            return Err(Template2Error::new("template2-duplicate-token-id"));
        }
        literals.push(Literal {
            flags,
            bytes: literal_bytes.to_vec(),
        });
        expected_relative_offset = expected_relative_offset
            .checked_add(byte_length)
            .ok_or_else(|| Template2Error::new("template2-layout"))?;
    }
    if expected_relative_offset != layout.byte_table_length {
        return Err(Template2Error::new("template2-layout"));
    }
    Ok(literals)
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, Template2Error> {
    let value = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| Template2Error::new("template2-header"))?;
    Ok(u16::from_le_bytes(
        value
            .try_into()
            .map_err(|_| Template2Error::new("template2-header"))?,
    ))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, Template2Error> {
    let value = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| Template2Error::new("template2-header"))?;
    Ok(u32::from_le_bytes(
        value
            .try_into()
            .map_err(|_| Template2Error::new("template2-header"))?,
    ))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, Template2Error> {
    let value = bytes
        .get(offset..offset + 8)
        .ok_or_else(|| Template2Error::new("template2-header"))?;
    Ok(u64::from_le_bytes(
        value
            .try_into()
            .map_err(|_| Template2Error::new("template2-header"))?,
    ))
}

fn all_zero(bytes: &[u8], start: usize, end: usize) -> bool {
    bytes
        .get(start..end)
        .is_some_and(|range| range.iter().all(|byte| *byte == 0))
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    needle.len() <= haystack.len()
        && haystack
            .windows(needle.len())
            .any(|window| window == needle)
}

fn checked_sum(values: &[usize]) -> Result<usize, Template2Error> {
    values.iter().try_fold(0_usize, |total, value| {
        total
            .checked_add(*value)
            .ok_or_else(|| Template2Error::new("template2-rendered-limit"))
    })
}
